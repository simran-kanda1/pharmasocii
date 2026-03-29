import express from "express";
import cors from "cors";
import Stripe from "stripe";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

// ─── Load .env if present ───
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
    const envPath = resolve(__dirname, ".env");
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
            const [key, ...rest] = trimmed.split("=");
            process.env[key.trim()] = rest.join("=").trim();
        }
    }
} catch { /* no .env file, use defaults */ }

// ─── Stripe Test Keys ───
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(STRIPE_SECRET_KEY);
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

// ─── Firebase Admin ───
// Recommended: export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
// Or place serviceAccountKey.json in server/ and we'll try to load it.
try {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: "pharmasocii"
    });
} catch (err) {
    console.warn("Firebase Admin fallback: applicationDefault failed, trying manual init if pharmasocii-admin.json exists...");
    try {
        const serviceAccount = JSON.parse(readFileSync(resolve(__dirname, "pharmasocii-admin.json"), "utf8"));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) {
        console.error("❌ Firebase Admin failed to initialize. Webhooks will not work.", e.message);
    }
}
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));

// Stripe webhook requires raw body
app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`❌ Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object;
            const { partnerId, planId, group, listingId, collectionName, featureId } = session.metadata;

            console.log(`💰 Payment succeeded for session: ${session.id}`);
            console.log(`   Metadata: partnerId=${partnerId}, planId=${planId}, group=${group}, listingId=${listingId}, collectionName=${collectionName}, featureId=${featureId}`);

            // Determine the correct collection name
            const resolvedCollectionName = collectionName ||
                (group === "business_offerings" ? "businessOfferingsCollection" :
                    group === "consulting" ? "consultingServicesCollection" :
                        group === "events" ? "eventsCollection" :
                            group === "jobs" ? "jobsCollection" : null);

            console.log(`   Resolved collection: ${resolvedCollectionName}`);

            let listingData = null;

            if (featureId) {
                // Feature plan payment
                await db.collection("partnersCollection").doc(partnerId).collection("featuresCollection").add({
                    featureId,
                    featureName: featureId.replace(/_/g, " "),
                    lastPaymentReceived: new Date(),
                    active: true,
                    sessionId: session.id
                });
                console.log(`   ✓ Feature plan added: ${featureId}`);
            } else if (listingId && resolvedCollectionName) {
                // Core listing payment - update the listing status
                const isAutoApproved = group === "events" || group === "jobs";
                const listingRef = db.collection("partnersCollection").doc(partnerId).collection(resolvedCollectionName).doc(listingId);

                // Get the listing data for the transaction record
                const listingSnap = await listingRef.get();
                if (listingSnap.exists) {
                    listingData = listingSnap.data();
                    console.log(`   ✓ Found listing data: categories=${listingData.selectedCategories?.length || 0}, countries=${listingData.serviceCountries?.length || 0}`);
                }

                await listingRef.update({
                    status: isAutoApproved ? "Approved" : "Pending Review",
                    active: true,
                    lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    stripeSubscriptionId: session.subscription || null,
                    stripeCustomerId: session.customer || null
                });
                console.log(`   ✓ Listing ${listingId} updated to status: ${isAutoApproved ? "Approved" : "Pending Review"}`);

                // Calculate billing period end date
                const startDate = new Date();
                const isYearly = planId?.includes('_yr');
                const billingPeriodEnd = new Date(startDate);
                if (isYearly) {
                    billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
                } else {
                    billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
                }

                // Also add to partner's plans with more details
                await db.collection("partnersCollection").doc(partnerId).collection("planCollection").add({
                    planId,
                    planName: planId.replace(/_/g, " "),
                    startDate: startDate,
                    billingPeriodEnd: billingPeriodEnd,
                    billingInterval: isYearly ? "year" : "month",
                    active: true,
                    lastPaymentReceivedAt: startDate,
                    listingId,
                    collectionName: resolvedCollectionName,
                    stripeSubscriptionId: session.subscription || null,
                    stripeCustomerId: session.customer || null
                });
                console.log(`   ✓ Plan record created with billing period end: ${billingPeriodEnd.toISOString()}`);
            } else {
                console.log(`   ⚠ No listingId (${listingId}) or collectionName (${resolvedCollectionName}) - skipping listing update`);
            }

            // Create global transaction record with listing details
            const transactionData = {
                partnerId,
                amount: session.amount_total / 100,
                currency: session.currency,
                status: "succeeded",
                type: featureId ? "feature" : "listing",
                planId: planId || null,
                featureId: featureId || null,
                group: group || null,
                listingId: listingId || null,
                collectionName: resolvedCollectionName || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                sessionId: session.id,
                customerEmail: session.customer_details?.email || "",
                // Include listing details for richer transaction display
                selectedCategories: listingData?.selectedCategories || [],
                selectedSubcategories: listingData?.selectedSubcategories || [],
                serviceCountries: listingData?.serviceCountries || [],
                serviceRegions: listingData?.serviceRegions || [],
                businessName: listingData?.businessName || ""
            };

            await db.collection("transactionsCollection").add(transactionData);
            console.log(`   ✓ Transaction record created`);

            break;
        }

        case "customer.subscription.deleted": {
            const subscription = event.data.object;
            console.log(`❌ Subscription deleted: ${subscription.id}`);
            // Find listing with this subscription ID and deactivate
            const partners = await db.collection("partnersCollection").get();
            for (const pDoc of partners.docs) {
                const collections = ["businessOfferingsCollection", "consultingServicesCollection", "eventsCollection", "jobsCollection"];
                for (const col of collections) {
                    const snap = await pDoc.ref.collection(col).where("stripeSubscriptionId", "==", subscription.id).get();
                    for (const lDoc of snap.docs) {
                        await lDoc.ref.update({ active: false, status: "Cancelled" });
                    }
                }
                const pSnap = await pDoc.ref.collection("planCollection").where("stripeSubscriptionId", "==", subscription.id).get();
                for (const pPlan of pSnap.docs) {
                    await pPlan.ref.update({ active: false });
                }
            }
            break;
        }

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

app.use(express.json());

// ─── Plan → price in cents ───
const PLAN_PRICES = {
    // Business / Consulting — Monthly
    basic_mo: { amount: 10000, name: "Basic (Monthly)", interval: "month" },
    standard_mo: { amount: 20000, name: "Standard (Monthly)", interval: "month" },
    premium_mo: { amount: 40000, name: "Premium (Monthly)", interval: "month" },
    premium_plus_mo: { amount: 100000, name: "Premium Plus (Monthly)", interval: "month" },
    // Business / Consulting — Yearly
    basic_yr: { amount: 108000, name: "Basic (Annual)", interval: "year" },
    standard_yr: { amount: 218400, name: "Standard (Annual)", interval: "year" },
    premium_yr: { amount: 432000, name: "Premium (Annual)", interval: "year" },
    premium_plus_yr: { amount: 1080000, name: "Premium Plus (Annual)", interval: "year" },
    // Events
    basic_event: { amount: 50000, name: "Basic Event", interval: "month" },
    standard_event: { amount: 85000, name: "Standard Event", interval: "month" },
    premium_event: { amount: 125000, name: "Premium Event", interval: "month" },
    premium_plus_event: { amount: 145000, name: "Premium Plus Event", interval: "month" },
    // Jobs — one-time
    standard_job: { amount: 40000, name: "Standard Job Listing", interval: null },
    premium_job: { amount: 80000, name: "Premium Job Listing", interval: null },
    premium_plus_job: { amount: 100000, name: "Premium Plus Job Listing", interval: null },
};

// ─── Feature plan add-ons ───
const FEATURE_PRICES = {
    landing_page: { amount: 40000, name: "Landing Page Spotlight" },
    home_page: { amount: 80000, name: "Home Page Spotlight" },
    both: { amount: 100000, name: "Landing + Home Page Spotlight" },
};

/**
 * POST /api/create-checkout-session
 * Body: { planId, group, partnerId, partnerEmail, successUrl, cancelUrl }
 */
app.post("/api/create-checkout-session", async (req, res) => {
    try {
        console.log("📝 Incoming checkout request:", req.body);
        const { planId, group, partnerId, partnerEmail, successUrl, cancelUrl } = req.body;

        const plan = PLAN_PRICES[planId];
        if (!plan) {
            return res.status(400).json({ error: `Unknown plan: ${planId}` });
        }

        const lineItems = [];

        if (plan.interval) {
            // Recurring subscription
            lineItems.push({
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: `Pharma Socii — ${plan.name}`,
                        description: `${group.replace(/_/g, " ")} listing plan`,
                    },
                    unit_amount: plan.amount,
                    recurring: { interval: plan.interval },
                },
                quantity: 1,
            });
        } else {
            // One-time payment (jobs)
            lineItems.push({
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: `Pharma Socii — ${plan.name}`,
                        description: `${group.replace(/_/g, " ")} listing`,
                    },
                    unit_amount: plan.amount,
                },
                quantity: 1,
            });
        }

        const sessionParams = {
            mode: plan.interval ? "subscription" : "payment",
            line_items: lineItems,
            success_url: successUrl || "http://localhost:5173/partner/dashboard?payment=success",
            cancel_url: cancelUrl || "http://localhost:5173/partner/complete-profile?payment=cancelled",
            client_reference_id: partnerId,
            metadata: {
                partnerId,
                planId,
                group,
                listingId: req.body.listingId || "",
                collectionName: req.body.collectionName || (group === "business_offerings" ? "businessOfferingsCollection" : group === "consulting" ? "consultingServicesCollection" : group === "events" ? "eventsCollection" : "jobsCollection")
            },
        };

        if (partnerEmail) {
            sessionParams.customer_email = partnerEmail;
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        console.log(`✓ Checkout session created: ${session.id} for plan ${planId}`);
        res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
        console.error("❌ Stripe error:", err);
        res.status(500).json({ error: err.message || "Stripe session creation failed", details: typeof err === 'object' ? err : String(err) });
    }
});

/**
 * POST /api/create-feature-checkout
 * Body: { featureId, partnerId, partnerEmail, successUrl, cancelUrl }
 */
app.post("/api/create-feature-checkout", async (req, res) => {
    try {
        const { featureId, partnerId, partnerEmail, successUrl, cancelUrl } = req.body;

        const feature = FEATURE_PRICES[featureId];
        if (!feature) {
            return res.status(400).json({ error: `Unknown feature: ${featureId}` });
        }

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: `Pharma Socii — ${feature.name}`,
                            description: "Feature add-on for increased visibility",
                        },
                        unit_amount: feature.amount,
                    },
                    quantity: 1,
                },
            ],
            success_url: successUrl || "http://localhost:5173/partner/dashboard?feature=success",
            cancel_url: cancelUrl || "http://localhost:5173/partner/dashboard?feature=cancelled",
            customer_email: partnerEmail || undefined,
            client_reference_id: partnerId,
            metadata: { partnerId, featureId },
        });

        console.log(`✓ Feature checkout session created: ${session.id} for ${featureId}`);
        res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
        console.error("Stripe feature error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Health check
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", stripe: "connected" });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`\n🚀 Pharma Socii API server running at http://localhost:${PORT}`);
    console.log(`   Stripe test mode connected\n`);
});
