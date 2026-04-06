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

function getListingDocRef(partnerId, collectionName, listingId) {
    if (!collectionName || !listingId) return null;
    const isPartnerEmbeddedCollection = collectionName === "businessOfferingsCollection";
    if (isPartnerEmbeddedCollection) {
        if (!partnerId) return null;
        return db.collection("partnersCollection").doc(partnerId).collection(collectionName).doc(listingId);
    }
    return db.collection(collectionName).doc(listingId);
}

function getInvoiceSubscriptionId(invoice) {
    if (!invoice?.subscription) return null;
    return typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id || null;
}

function getInvoiceCustomerId(invoice) {
    if (!invoice?.customer) return null;
    return typeof invoice.customer === "string" ? invoice.customer : invoice.customer.id || null;
}

function getInvoicePeriodEndDate(invoice) {
    const firstLine = invoice?.lines?.data?.[0];
    const periodEndSeconds = firstLine?.period?.end || null;
    if (!periodEndSeconds) return null;
    return new Date(periodEndSeconds * 1000);
}

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
            const partnerRef = partnerId ? db.collection("partnersCollection").doc(partnerId) : null;

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
            let detailSource = null;

            if (featureId) {
                // Feature plan payment
                const existingFeature = await db.collection("partnersCollection").doc(partnerId)
                    .collection("featuresCollection").where("sessionId", "==", session.id).limit(1).get();
                if (existingFeature.empty) {
                    await db.collection("partnersCollection").doc(partnerId).collection("featuresCollection").add({
                        featureId,
                        featureName: featureId.replace(/_/g, " "),
                        lastPaymentReceived: new Date(),
                        active: true,
                        sessionId: session.id
                    });
                    console.log(`   ✓ Feature plan added: ${featureId}`);
                } else {
                    console.log(`   ℹ Feature plan already exists for session ${session.id}`);
                }

                // Attach feature visibility to a specific listing when provided.
                if (listingId && resolvedCollectionName) {
                    const listingRef = getListingDocRef(partnerId, resolvedCollectionName, listingId);
                    if (!listingRef) {
                        console.log(`   ⚠ Feature purchase listing could not be resolved: ${listingId}`);
                    } else {
                        const listingSnap = await listingRef.get();
                        if (listingSnap.exists) {
                            listingData = listingSnap.data();
                            detailSource = listingData;
                            await listingRef.set({
                                selectedAddon: featureId,
                                featuredPlacement: featureId,
                                isFeatured: true,
                                active: true,
                                status: "Approved",
                                lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                            }, { merge: true });
                            console.log(`   ✓ Listing ${listingId} spotlight set to ${featureId}`);
                        } else {
                            console.log(`   ⚠ Feature purchase listing not found: ${listingId}`);
                        }
                    }
                }
                if (partnerRef) {
                    await partnerRef.set({
                        selectedAddon: featureId,
                        lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                }

                await logAudit({
                    partnerId,
                    action: "FEATURE_ADDED",
                    details: `New feature added: ${featureId.replace(/_/g, " ")}.`,
                    category: "listing",
                    metadata: { featureId }
                });
            } else if (listingId && resolvedCollectionName) {
                // Core listing payment - update the listing status
                const listingRef = getListingDocRef(partnerId, resolvedCollectionName, listingId);
                if (!listingRef) {
                    console.log(`   ⚠ Listing could not be resolved for payment: ${listingId}`);
                } else {
                    // Get the listing data for the transaction record
                    const listingSnap = await listingRef.get();
                    if (listingSnap.exists) {
                        listingData = listingSnap.data();
                        detailSource = listingData;
                        console.log(`   ✓ Found listing data: categories=${listingData.selectedCategories?.length || 0}, countries=${listingData.serviceCountries?.length || 0}`);
                    }

                    await listingRef.update({
                        status: "Approved",
                        active: true,
                        lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                        stripeSubscriptionId: session.subscription || null,
                        stripeCustomerId: session.customer || null
                    });
                    console.log(`   ✓ Listing ${listingId} updated to status: Approved`);

                    // Calculate billing period end date
                    const startDate = new Date();
                    const isYearly = planId?.includes('_yr');
                    const billingPeriodEnd = new Date(startDate);
                    if (isYearly) {
                        billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
                    } else {
                        billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
                    }

                    // Also add to partner's plans with more details (idempotent by session)
                    const existingPlan = await db.collection("partnersCollection").doc(partnerId)
                        .collection("planCollection").where("sessionId", "==", session.id).limit(1).get();
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
                            stripeCustomerId: session.customer || null,
                            sessionId: session.id,
                            companyRepresentatives: listingData?.companyRepresentatives || []
                        });
                        console.log(`   ✓ Plan record created with billing period end: ${billingPeriodEnd.toISOString()}`);
                    } else {
                        console.log(`   ℹ Plan record already exists for session ${session.id}`);
                    }
                }
            } else {
                console.log(`   ℹ No listingId (${listingId}) or collectionName (${resolvedCollectionName}) - creating account-level plan record`);
                if (partnerId && planId) {
                    const partnerSnap = await partnerRef.get();
                    const partnerData = partnerSnap.exists ? partnerSnap.data() : {};
                    detailSource = partnerData || null;

                    const existingPlan = await partnerRef.collection("planCollection").where("sessionId", "==", session.id).get();
                    if (existingPlan.empty) {
                        const startDate = new Date();
                        const isYearly = planId?.includes('_yr');
                        const billingPeriodEnd = new Date(startDate);
                        if (isYearly) {
                            billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
                        } else {
                            billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
                        }

                        await partnerRef.collection("planCollection").add({
                            planId,
                            planName: planId.replace(/_/g, " "),
                            startDate: startDate,
                            billingPeriodEnd: billingPeriodEnd,
                            billingInterval: isYearly ? "year" : "month",
                            active: true,
                            lastPaymentReceivedAt: startDate,
                            listingId: null,
                            collectionName: null,
                            group: group || null,
                            stripeSubscriptionId: session.subscription || null,
                            stripeCustomerId: session.customer || null,
                            sessionId: session.id,
                            companyRepresentatives: partnerData?.companyRepresentatives || []
                        });
                    }
                }
            }

            if (partnerRef) {
                await partnerRef.set({
                    partnerStatus: "Approved",
                    lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    stripeSubscriptionId: session.subscription || null,
                    stripeCustomerId: session.customer || null,
                }, { merge: true });
                console.log(`   ✓ Partner ${partnerId} marked as Approved`);
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
                selectedCategories: detailSource?.selectedCategories || [],
                selectedSubcategories: detailSource?.selectedSubcategories || [],
                serviceCountries: detailSource?.serviceCountries || [],
                serviceRegions: detailSource?.serviceRegions || [],
                businessName: detailSource?.businessName || "",
                companyRepresentatives: detailSource?.companyRepresentatives || []
            };

            const existingTransaction = await db.collection("transactionsCollection")
                .where("sessionId", "==", session.id).limit(1).get();
            if (existingTransaction.empty) {
                await db.collection("transactionsCollection").add(transactionData);
                console.log(`   ✓ Transaction record created`);
            } else {
                console.log(`   ℹ Transaction already exists for session ${session.id}`);
            }

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

        case "invoice.paid": {
            const invoice = event.data.object;
            const subscriptionId = getInvoiceSubscriptionId(invoice);
            const customerId = getInvoiceCustomerId(invoice);
            const billingReason = invoice.billing_reason || "unknown";
            const billingPeriodEnd = getInvoicePeriodEndDate(invoice);

            console.log(`💳 Invoice paid: ${invoice.id} (reason: ${billingReason})`);

            if (!subscriptionId) {
                console.log("   ℹ No subscription ID on invoice, skipping subscription renewal sync.");
                break;
            }

            const planSnap = await db.collectionGroup("planCollection")
                .where("stripeSubscriptionId", "==", subscriptionId)
                .get();

            if (planSnap.empty) {
                console.log(`   ⚠ No plan records found for subscription ${subscriptionId}`);
                break;
            }

            const partnerIds = new Set();
            let primaryPlanContext = null;

            for (const planDoc of planSnap.docs) {
                const planData = planDoc.data() || {};
                const partnerId = planDoc.ref.path.split("/")[1] || "";
                if (!partnerId) continue;

                partnerIds.add(partnerId);

                const planUpdate = {
                    active: true,
                    lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    stripeSubscriptionId: subscriptionId,
                    ...(customerId ? { stripeCustomerId: customerId } : {}),
                    ...(billingPeriodEnd ? { billingPeriodEnd } : {}),
                };
                await planDoc.ref.set(planUpdate, { merge: true });

                if (!primaryPlanContext) {
                    primaryPlanContext = {
                        partnerId,
                        planId: planData.planId || null,
                        group: planData.group || null,
                        listingId: planData.listingId || null,
                        collectionName: planData.collectionName || null,
                    };
                }

                if (planData.listingId && planData.collectionName) {
                    const listingRef = getListingDocRef(partnerId, planData.collectionName, planData.listingId);
                    if (listingRef) {
                        await listingRef.set({
                            active: true,
                            status: "Approved",
                            lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                            stripeSubscriptionId: subscriptionId,
                            ...(customerId ? { stripeCustomerId: customerId } : {}),
                        }, { merge: true });
                    }
                }
            }

            for (const partnerId of partnerIds) {
                await db.collection("partnersCollection").doc(partnerId).set({
                    partnerStatus: "Approved",
                    lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    stripeSubscriptionId: subscriptionId,
                    ...(customerId ? { stripeCustomerId: customerId } : {}),
                }, { merge: true });
            }

            // checkout.session.completed already records the initial charge.
            // For invoice events, only record cycle renewals (and not creation invoices).
            if (billingReason === "subscription_create") {
                console.log(`   ℹ Initial subscription invoice ${invoice.id} already covered by checkout event.`);
                break;
            }

            const existingInvoiceTxn = await db.collection("transactionsCollection")
                .where("invoiceId", "==", invoice.id).limit(1).get();
            if (!existingInvoiceTxn.empty) {
                console.log(`   ℹ Transaction already exists for invoice ${invoice.id}`);
                break;
            }

            let detailSource = null;
            if (primaryPlanContext?.listingId && primaryPlanContext?.collectionName) {
                const listingRef = getListingDocRef(
                    primaryPlanContext.partnerId,
                    primaryPlanContext.collectionName,
                    primaryPlanContext.listingId
                );
                if (listingRef) {
                    const listingSnap = await listingRef.get();
                    if (listingSnap.exists) detailSource = listingSnap.data();
                }
            }

            if (!detailSource && primaryPlanContext?.partnerId) {
                const partnerSnap = await db.collection("partnersCollection").doc(primaryPlanContext.partnerId).get();
                if (partnerSnap.exists) detailSource = partnerSnap.data();
            }

            const renewalTransaction = {
                partnerId: primaryPlanContext?.partnerId || null,
                amount: (invoice.amount_paid || invoice.amount_due || 0) / 100,
                currency: invoice.currency || "usd",
                status: "succeeded",
                type: "listing",
                planId: primaryPlanContext?.planId || null,
                group: primaryPlanContext?.group || null,
                listingId: primaryPlanContext?.listingId || null,
                collectionName: primaryPlanContext?.collectionName || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                invoiceId: invoice.id,
                stripeInvoiceId: invoice.id,
                stripeSubscriptionId: subscriptionId,
                stripeCustomerId: customerId || null,
                customerEmail: invoice.customer_email || "",
                selectedCategories: detailSource?.selectedCategories || [],
                selectedSubcategories: detailSource?.selectedSubcategories || [],
                serviceCountries: detailSource?.serviceCountries || [],
                serviceRegions: detailSource?.serviceRegions || [],
                businessName: detailSource?.businessName || "",
                companyRepresentatives: detailSource?.companyRepresentatives || []
            };

            await db.collection("transactionsCollection").add(renewalTransaction);
            console.log(`   ✓ Renewal transaction recorded for invoice ${invoice.id}`);

            for (const partnerId of partnerIds) {
                await logAudit({
                    partnerId,
                    action: "PAYMENT_SUCCESS",
                    details: `Recurring invoice ${invoice.id} paid (${renewalTransaction.amount} ${renewalTransaction.currency.toUpperCase()}).`,
                    category: "billing",
                    metadata: {
                        invoiceId: invoice.id,
                        subscriptionId,
                        billingReason
                    }
                });
            }

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
            const customerId = getInvoiceCustomerId(invoice);
            const subscriptionId = getInvoiceSubscriptionId(invoice);
            console.log(`❌ Invoice payment failed for customer: ${customerId || "unknown"}`);

            const partnerIds = new Set();
            if (customerId) {
                const partnerSnap = await db.collection("partnersCollection").where("stripeCustomerId", "==", customerId).get();
                partnerSnap.docs.forEach((p) => partnerIds.add(p.id));
            }

            if (partnerIds.size === 0 && subscriptionId) {
                const planSnap = await db.collectionGroup("planCollection")
                    .where("stripeSubscriptionId", "==", subscriptionId)
                    .get();
                planSnap.docs.forEach((p) => {
                    const partnerId = p.ref.path.split("/")[1];
                    if (partnerId) partnerIds.add(partnerId);
                });
            }

            for (const partnerId of partnerIds) {
                await logAudit({
                    partnerId,
                    action: "PAYMENT_FAILED",
                    details: `Invoice payment failed for $${(invoice.amount_due || 0) / 100}.`,
                    category: "billing",
                    metadata: {
                        invoiceId: invoice.id,
                        amountDue: (invoice.amount_due || 0) / 100,
                        subscriptionId: subscriptionId || null
                    }
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

const toDateValue = (value) => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === "function") {
        const converted = value.toDate();
        return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
    }
    if (typeof value === "number") {
        const millis = value > 1e12 ? value : value * 1000;
        const converted = new Date(millis);
        return Number.isNaN(converted.getTime()) ? null : converted;
    }
    if (typeof value === "string") {
        const converted = new Date(value);
        return Number.isNaN(converted.getTime()) ? null : converted;
    }
    if (typeof value?.seconds === "number") {
        const converted = new Date(value.seconds * 1000);
        return Number.isNaN(converted.getTime()) ? null : converted;
    }
    return null;
};

const inferPlanGroup = (plan) => {
    if (plan?.group) return plan.group;
    if (plan?.collectionName === "businessOfferingsCollection") return "business_offerings";
    if (plan?.collectionName === "consultingServicesCollection" || plan?.collectionName === "consultingCollection") return "consulting";
    if (plan?.collectionName === "eventsCollection") return "events";
    if (plan?.collectionName === "jobsCollection") return "jobs";
    return "";
};

const getGroupPurchaseLockForPartner = async (partnerId, group) => {
    if (!partnerId || !["business_offerings", "consulting"].includes(group)) {
        return { blocked: false, blockedUntil: null };
    }

    const now = new Date();
    let blocked = false;
    let blockedUntil = null;
    let hasOpenEndedBlock = false;
    const plansSnap = await db
        .collection("partnersCollection")
        .doc(partnerId)
        .collection("planCollection")
        .where("active", "==", true)
        .get();

    plansSnap.forEach((doc) => {
        const plan = doc.data() || {};
        if (inferPlanGroup(plan) !== group) return;
        if (!plan.cancelAtPeriodEnd) {
            blocked = true;
            hasOpenEndedBlock = true;
            blockedUntil = null;
            return;
        }
        const periodEnd = toDateValue(plan.billingPeriodEnd) || toDateValue(plan.cancelAt);
        if (!periodEnd || now < periodEnd) {
            blocked = true;
            if (!hasOpenEndedBlock && periodEnd && (!blockedUntil || periodEnd > blockedUntil)) blockedUntil = periodEnd;
        }
    });

    return { blocked, blockedUntil };
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
        if (!partnerId || !group) {
            return res.status(400).json({ error: "partnerId and group are required." });
        }

        if (group === "business_offerings" || group === "consulting") {
            const lock = await getGroupPurchaseLockForPartner(partnerId, group);
            if (lock.blocked) {
                const listingType = group === "business_offerings" ? "Business Offering" : "Consulting Service";
                const dateLabel = lock.blockedUntil ? lock.blockedUntil.toISOString().slice(0, 10) : null;
                return res.status(409).json({
                    error: dateLabel
                        ? `You can add another ${listingType} after ${dateLabel}.`
                        : `You can only have one active ${listingType} plan at a time.`,
                    blockedUntil: lock.blockedUntil ? lock.blockedUntil.toISOString() : null,
                });
            }
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
            success_url: successUrl || "https://orange-bear-967180.hostingersite.com/partner/dashboard?payment=success",
            cancel_url: cancelUrl || "https://orange-bear-967180.hostingersite.com/partner/complete-profile?payment=cancelled",
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
        const { featureId, partnerId, partnerEmail, listingId, collectionName, group, successUrl, cancelUrl } = req.body;

        const feature = FEATURE_PRICES[featureId];
        if (!feature) {
            return res.status(400).json({ error: `Unknown feature: ${featureId}` });
        }
        if (!partnerId || !listingId || !collectionName) {
            return res.status(400).json({ error: "Feature add-ons require a paid listing-backed plan." });
        }

        const partnerRef = db.collection("partnersCollection").doc(partnerId);
        const listingRef = getListingDocRef(partnerId, collectionName, listingId);
        if (!listingRef) {
            return res.status(400).json({ error: "Unable to resolve listing for feature add-on purchase." });
        }
        const listingSnap = await listingRef.get();
        if (!listingSnap.exists) {
            return res.status(404).json({ error: "Listing not found for feature add-on purchase." });
        }

        const listingData = listingSnap.data() || {};
        if (listingData.status === "pending_payment" || listingData.active === false) {
            return res.status(400).json({ error: "Complete listing plan payment before purchasing a feature add-on." });
        }

        const activePlanSnap = await partnerRef
            .collection("planCollection")
            .where("listingId", "==", listingId)
            .where("collectionName", "==", collectionName)
            .where("active", "==", true)
            .limit(1)
            .get();
        if (activePlanSnap.empty) {
            return res.status(400).json({ error: "No active paid plan found for this listing." });
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
            success_url: successUrl || "https://orange-bear-967180.hostingersite.com/partner/dashboard?payment=success",
            cancel_url: cancelUrl || "https://orange-bear-967180.hostingersite.com/partner/complete-profile?payment=cancelled",
            customer_email: partnerEmail || undefined,
            client_reference_id: partnerId,
            metadata: {
                partnerId,
                featureId,
                listingId: listingId || "",
                collectionName: collectionName || "",
                group: group || "",
            },
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
                    const listingRef = getListingDocRef(partnerId, collectionName, listingId);
                    if (!listingRef) {
                        return res.status(400).json({ error: "Unable to resolve listing for upgrade." });
                    }
                    await listingRef.update({
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
            success_url: successUrl || "https://orange-bear-967180.hostingersite.com/partner/dashboard?payment=success",
            cancel_url: cancelUrl || "https://orange-bear-967180.hostingersite.com/partner/complete-profile?payment=cancelled",
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
        const partnerRef = partnerId ? db.collection("partnersCollection").doc(partnerId) : null;

        // Determine the correct collection name
        const resolvedCollectionName = collectionName ||
            (group === "business_offerings" ? "businessOfferingsCollection" :
                group === "consulting" ? "consultingServicesCollection" :
                    group === "events" ? "eventsCollection" :
                        group === "jobs" ? "jobsCollection" : null);

        console.log(`   Metadata: partnerId=${partnerId}, listingId=${listingId}, collection=${resolvedCollectionName}`);

        let updated = false;
        let listingData = null;
        let detailSource = null;

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

            if (listingId && resolvedCollectionName) {
                const listingRef = getListingDocRef(partnerId, resolvedCollectionName, listingId);
                if (!listingRef) {
                    return res.status(400).json({ error: "Unable to resolve listing for feature verification." });
                }
                const listingSnap = await listingRef.get();
                if (listingSnap.exists) {
                    listingData = listingSnap.data();
                    detailSource = listingData;
                    await listingRef.set({
                        selectedAddon: featureId,
                        featuredPlacement: featureId,
                        isFeatured: true,
                        active: true,
                        status: "Approved",
                        lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                    updated = true;
                    console.log(`   ✓ Listing ${listingId} spotlight set to ${featureId}`);
                }
            }
            if (partnerRef) {
                await partnerRef.set({
                    selectedAddon: featureId,
                    lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                updated = true;
            }
        } else if (listingId && resolvedCollectionName) {
            // Check current listing status
            const listingRef = getListingDocRef(partnerId, resolvedCollectionName, listingId);
            if (!listingRef) {
                return res.status(400).json({ error: "Unable to resolve listing for payment verification." });
            }
            const listingSnap = await listingRef.get();

            if (listingSnap.exists) {
                listingData = listingSnap.data();
                detailSource = listingData;

                await listingRef.update({
                    status: "Approved",
                    active: true,
                    lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    stripeSubscriptionId: session.subscription || null,
                    stripeCustomerId: session.customer || null
                });
                updated = true;
                console.log(`   ✓ Listing ${listingId} updated to status: Approved`);

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
                    .collection("planCollection").where("sessionId", "==", session.id).limit(1).get();

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
                        stripeCustomerId: session.customer || null,
                        sessionId: session.id,
                        companyRepresentatives: listingData?.companyRepresentatives || []
                    });
                    updated = true;
                    console.log(`   ✓ Plan record created`);
                }
            } else {
                console.log(`   ⚠ Listing not found: ${listingId}`);
            }
        } else if (partnerId && planId) {
            const partnerRef = db.collection("partnersCollection").doc(partnerId);
            const partnerSnap = await partnerRef.get();
            const partnerData = partnerSnap.exists ? partnerSnap.data() : {};
            detailSource = partnerData || null;

            const existingPlan = await partnerRef.collection("planCollection").where("sessionId", "==", session.id).get();
            if (existingPlan.empty) {
                const startDate = new Date();
                const isYearly = planId?.includes('_yr');
                const billingPeriodEnd = new Date(startDate);
                if (isYearly) {
                    billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
                } else {
                    billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
                }

                await partnerRef.collection("planCollection").add({
                    planId,
                    planName: planId.replace(/_/g, " "),
                    startDate: startDate,
                    billingPeriodEnd: billingPeriodEnd,
                    billingInterval: isYearly ? "year" : "month",
                    active: true,
                    lastPaymentReceivedAt: startDate,
                    listingId: null,
                    collectionName: null,
                    group: group || null,
                    stripeSubscriptionId: session.subscription || null,
                    stripeCustomerId: session.customer || null,
                    sessionId: session.id,
                    companyRepresentatives: partnerData?.companyRepresentatives || []
                });
                updated = true;
            }

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
                    listingId: null,
                    collectionName: null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    sessionId: session.id,
                    customerEmail: session.customer_details?.email || "",
                    selectedCategories: detailSource?.selectedCategories || [],
                    selectedSubcategories: detailSource?.selectedSubcategories || [],
                    serviceCountries: detailSource?.serviceCountries || [],
                    serviceRegions: detailSource?.serviceRegions || [],
                    businessName: detailSource?.businessName || "",
                    companyRepresentatives: detailSource?.companyRepresentatives || []
                });
                updated = true;
            }
        }

        if (partnerRef) {
            await partnerRef.set({
                partnerStatus: "Approved",
                lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            updated = true;
        }

        const existingTxn = await db.collection("transactionsCollection")
            .where("sessionId", "==", session.id).limit(1).get();

        if (existingTxn.empty) {
            await db.collection("transactionsCollection").add({
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
                selectedCategories: detailSource?.selectedCategories || [],
                selectedSubcategories: detailSource?.selectedSubcategories || [],
                serviceCountries: detailSource?.serviceCountries || [],
                serviceRegions: detailSource?.serviceRegions || [],
                businessName: detailSource?.businessName || "",
                companyRepresentatives: detailSource?.companyRepresentatives || []
            });
            updated = true;
            console.log(`   ✓ Transaction record created`);
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
