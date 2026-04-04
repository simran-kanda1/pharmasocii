import express from "express";
import cors from "cors";
import Stripe from "stripe";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

//Load .env if present
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

//stripe Test Keys
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(STRIPE_SECRET_KEY);
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

// ─── Firebase Admin ───
// Recommended: export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
// Or place serviceAccountKey.json in server/ and we'll try to load it.
try {
    const serviceAccountPath = resolve(__dirname, "pharmasocii_admin.json");
    if (existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: "pharmasocii"
        });
        console.log("Firebase Admin initialized with local service account key.");
    } else {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: "pharmasocii"
        });
        console.log("Firebase Admin initialized with applicationDefault.");
    }
} catch (e) {
    console.error("❌ Firebase Admin failed to initialize. Webhooks will not work.", e.message);
}
const db = admin.firestore();

/**
 * Log action to auditLogs collection
 */
async function logAudit({ partnerId, action, details, category, metadata = {} }) {
    try {
        let partnerName = "Unknown Partner";
        if (partnerId) {
            const partnerDoc = await db.collection("partnersCollection").doc(partnerId).get();
            if (partnerDoc.exists) {
                partnerName = partnerDoc.data().businessName || "Unnamed Business";
            }
        }

        await db.collection("auditLogs").add({
            partnerId,
            partnerName,
            action,
            details,
            category,
            metadata,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Audit] ${action} logged for ${partnerName}`);
    } catch (err) {
        console.error("Error logging audit:", err.message);
    }
}

const app = express();
app.use(cors({ origin: true }));

// Stripe webhook requires raw body
app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    console.log("🔔 Webhook endpoint hit!");
    console.log("   Headers:", JSON.stringify(req.headers["stripe-signature"]?.substring(0, 50) + "..."));

    const sig = req.headers["stripe-signature"];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
        console.log("✓ Webhook signature verified, event type:", event.type);
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

                await logAudit({
                    partnerId,
                    action: "FEATURE_ADDED",
                    details: `New feature added: ${featureId.replace(/_/g, " ")}.`,
                    category: "listing",
                    metadata: { featureId }
                });
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

            await logAudit({
                partnerId,
                action: "PAYMENT_SUCCESS",
                details: `Payment of ${transactionData.amount} ${transactionData.currency.toUpperCase()} successful for session: ${session.id}`,
                category: "billing",
                metadata: {
                    sessionId: session.id,
                    type: transactionData.type,
                    planId: transactionData.planId
                }
            });

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

                await logAudit({
                    partnerId: pDoc.id,
                    action: "SUBSCRIPTION_CANCELLED",
                    details: `Subscription ${subscription.id} cancelled.`,
                    category: "billing",
                    metadata: { subscriptionId: subscription.id }
                });
            }
            break;
        }

        case "invoice.payment_failed": {
            const invoice = event.data.object;
            const customerId = invoice.customer;
            console.log(`❌ Invoice payment failed for customer: ${customerId}`);

            // Find partner by customer ID
            const partnerSnap = await db.collection("partnersCollection").where("stripeCustomerId", "==", customerId).limit(1).get();
            if (!partnerSnap.empty) {
                const partnerDoc = partnerSnap.docs[0];
                await logAudit({
                    partnerId: partnerDoc.id,
                    action: "PAYMENT_FAILED",
                    details: `Invoice payment failed for $${invoice.amount_due / 100}.`,
                    category: "billing",
                    metadata: { invoiceId: invoice.id, amountDue: invoice.amount_due / 100 }
                });
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

/**
 * POST /api/upgrade-subscription
 * Upgrade a subscription to a higher tier plan
 * Body: { subscriptionId, newPlanId, partnerId, listingId, collectionName }
 */
app.post("/api/upgrade-subscription", async (req, res) => {
    try {
        const { subscriptionId, newPlanId, partnerId, listingId, collectionName, partnerEmail, successUrl, cancelUrl } = req.body;

        console.log(`⬆️ Upgrading subscription: ${subscriptionId} to ${newPlanId}`);

        const newPlan = PLAN_PRICES[newPlanId];
        if (!newPlan) {
            return res.status(400).json({ error: `Unknown plan: ${newPlanId}` });
        }

        if (subscriptionId) {
            // If there's an existing Stripe subscription, update it
            try {
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                // Create a new price for the upgraded plan
                const newPrice = await stripe.prices.create({
                    currency: "usd",
                    unit_amount: newPlan.amount,
                    recurring: newPlan.interval ? { interval: newPlan.interval } : undefined,
                    product_data: {
                        name: `Pharma Socii — ${newPlan.name}`,
                    },
                });

                // Update the subscription with the new price (Stripe handles proration automatically)
                const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
                    items: [{
                        id: subscription.items.data[0].id,
                        price: newPrice.id,
                    }],
                    proration_behavior: 'create_prorations', // Charge the difference
                    metadata: {
                        partnerId,
                        planId: newPlanId,
                        listingId,
                        collectionName,
                    }
                });

                // Update the listing and plan in Firestore
                if (listingId && collectionName) {
                    await db.collection("partnersCollection").doc(partnerId).collection(collectionName).doc(listingId).update({
                        selectedPlan: newPlanId,
                    });

                    // Update the plan record
                    const planSnap = await db.collection("partnersCollection").doc(partnerId).collection("planCollection")
                        .where("listingId", "==", listingId).get();

                    if (!planSnap.empty) {
                        await planSnap.docs[0].ref.update({
                            planId: newPlanId,
                            planName: newPlanId.replace(/_/g, " "),
                            upgradedAt: new Date(),
                        });
                    }
                }

                console.log(`   ✓ Subscription upgraded to ${newPlanId}`);
                res.json({
                    success: true,
                    subscriptionId: updatedSubscription.id,
                    message: "Subscription upgraded successfully"
                });
                return;
            } catch (stripeErr) {
                console.log(`   ⚠ Stripe subscription update failed, creating new checkout: ${stripeErr.message}`);
            }
        }

        // If no subscription or update failed, create a new checkout session for the upgrade
        const lineItems = [];
        if (newPlan.interval) {
            lineItems.push({
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: `Pharma Socii — ${newPlan.name} (Upgrade)`,
                        description: "Plan upgrade",
                    },
                    unit_amount: newPlan.amount,
                    recurring: { interval: newPlan.interval },
                },
                quantity: 1,
            });
        } else {
            lineItems.push({
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: `Pharma Socii — ${newPlan.name} (Upgrade)`,
                    },
                    unit_amount: newPlan.amount,
                },
                quantity: 1,
            });
        }

        const session = await stripe.checkout.sessions.create({
            mode: newPlan.interval ? "subscription" : "payment",
            line_items: lineItems,
            success_url: successUrl || "http://localhost:5173/partner/dashboard?upgrade=success&session_id={CHECKOUT_SESSION_ID}",
            cancel_url: cancelUrl || "http://localhost:5173/partner/dashboard?upgrade=cancelled",
            customer_email: partnerEmail || undefined,
            client_reference_id: partnerId,
            metadata: {
                partnerId,
                planId: newPlanId,
                listingId: listingId || "",
                collectionName: collectionName || "",
                isUpgrade: "true",
            },
        });

        console.log(`   ✓ Upgrade checkout session created: ${session.id}`);
        res.json({ url: session.url, sessionId: session.id });

    } catch (err) {
        console.error("❌ Upgrade subscription error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/cancel-subscription
 * Cancel a Stripe subscription at period end
 * Body: { subscriptionId }
 */
app.post("/api/cancel-subscription", async (req, res) => {
    try {
        const { subscriptionId } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({ error: "subscriptionId is required" });
        }

        console.log(`🚫 Cancelling subscription: ${subscriptionId}`);

        // Cancel at period end (not immediately)
        const subscription = await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: true
        });

        console.log(`   ✓ Subscription will cancel at: ${new Date(subscription.current_period_end * 1000).toISOString()}`);

        res.json({
            success: true,
            cancelAt: subscription.current_period_end,
            status: subscription.status
        });

    } catch (err) {
        console.error("❌ Cancel subscription error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/verify-payment
 * Fallback endpoint to verify payment status and update listing if webhook failed
 * Body: { sessionId }
 */
app.post("/api/verify-payment", async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }

        console.log(`🔍 Verifying payment for session: ${sessionId}`);

        // Retrieve the checkout session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        console.log(`   Session status: ${session.status}, payment_status: ${session.payment_status}`);

        // Check if payment was successful
        if (session.status !== "complete" || session.payment_status !== "paid") {
            return res.json({
                success: false,
                message: "Payment not completed",
                status: session.status,
                paymentStatus: session.payment_status
            });
        }

        const { partnerId, planId, group, listingId, collectionName, featureId } = session.metadata;

        // Determine the correct collection name
        const resolvedCollectionName = collectionName ||
            (group === "business_offerings" ? "businessOfferingsCollection" :
                group === "consulting" ? "consultingServicesCollection" :
                    group === "events" ? "eventsCollection" :
                        group === "jobs" ? "jobsCollection" : null);

        console.log(`   Metadata: partnerId=${partnerId}, listingId=${listingId}, collection=${resolvedCollectionName}`);

        let updated = false;
        let listingData = null;

        if (featureId) {
            // Check if feature already exists
            const existingFeature = await db.collection("partnersCollection").doc(partnerId)
                .collection("featuresCollection").where("sessionId", "==", session.id).get();

            if (existingFeature.empty) {
                await db.collection("partnersCollection").doc(partnerId).collection("featuresCollection").add({
                    featureId,
                    featureName: featureId.replace(/_/g, " "),
                    lastPaymentReceived: new Date(),
                    active: true,
                    sessionId: session.id
                });
                updated = true;
                console.log(`   ✓ Feature plan added: ${featureId}`);
            } else {
                console.log(`   ℹ Feature already exists for this session`);
            }
        } else if (listingId && resolvedCollectionName) {
            // Check current listing status
            const listingRef = db.collection("partnersCollection").doc(partnerId).collection(resolvedCollectionName).doc(listingId);
            const listingSnap = await listingRef.get();

            if (listingSnap.exists) {
                listingData = listingSnap.data();

                if (listingData.status === "pending_payment") {
                    const isAutoApproved = group === "events" || group === "jobs";

                    await listingRef.update({
                        status: isAutoApproved ? "Approved" : "Pending Review",
                        active: true,
                        lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                        stripeSubscriptionId: session.subscription || null,
                        stripeCustomerId: session.customer || null
                    });
                    updated = true;
                    console.log(`   ✓ Listing ${listingId} updated to status: ${isAutoApproved ? "Approved" : "Pending Review"}`);

                    // Calculate billing period
                    const startDate = new Date();
                    const isYearly = planId?.includes('_yr');
                    const billingPeriodEnd = new Date(startDate);
                    if (isYearly) {
                        billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
                    } else {
                        billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
                    }

                    // Check if plan record already exists
                    const existingPlan = await db.collection("partnersCollection").doc(partnerId)
                        .collection("planCollection").where("listingId", "==", listingId).get();

                    if (existingPlan.empty) {
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
                        console.log(`   ✓ Plan record created`);
                    }

                    // Check if transaction already exists
                    const existingTxn = await db.collection("transactionsCollection")
                        .where("sessionId", "==", session.id).get();

                    if (existingTxn.empty) {
                        await db.collection("transactionsCollection").add({
                            partnerId,
                            amount: session.amount_total / 100,
                            currency: session.currency,
                            status: "succeeded",
                            type: "listing",
                            planId: planId || null,
                            group: group || null,
                            listingId: listingId || null,
                            collectionName: resolvedCollectionName || null,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            sessionId: session.id,
                            customerEmail: session.customer_details?.email || "",
                            selectedCategories: listingData?.selectedCategories || [],
                            selectedSubcategories: listingData?.selectedSubcategories || [],
                            serviceCountries: listingData?.serviceCountries || [],
                            serviceRegions: listingData?.serviceRegions || [],
                            businessName: listingData?.businessName || ""
                        });
                        console.log(`   ✓ Transaction record created`);
                    }
                } else {
                    console.log(`   ℹ Listing already updated (status: ${listingData.status})`);
                }
            } else {
                console.log(`   ⚠ Listing not found: ${listingId}`);
            }
        }

        res.json({
            success: true,
            updated,
            status: session.status,
            paymentStatus: session.payment_status
        });

    } catch (err) {
        console.error("❌ Verify payment error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Serve Static Frontend (Production) ───
const distPath = resolve(__dirname, "..", "dist");
if (existsSync(distPath)) {
    app.use(express.static(distPath));
    // SPA Catch-all: Route everything else to index.html
    app.get("*", (req, res) => {
        if (!req.path.startsWith("/api/")) {
            res.sendFile(resolve(distPath, "index.html"));
        } else {
            res.status(404).json({ error: "API endpoint not found" });
        }
    });
    console.log("✓ Serving static files from /dist");
} else {
    console.log("⚠ /dist directory not found. Server running in API-only mode.");
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Pharma Socii API server running at port ${PORT}`);
    console.log(`   Stripe test mode connected\n`);
});
