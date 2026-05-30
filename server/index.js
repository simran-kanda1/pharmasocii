import express from "express";
import cors from "cors";
import Stripe from "stripe";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { cleanupExpiredSpotlights } from "./cleanupExpiredSpotlights.js";

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

async function resolveListingDocRef(partnerId, collectionName, listingId) {
    const canonicalRef = getListingDocRef(partnerId, collectionName, listingId);
    if (!canonicalRef) return null;

    const canonicalSnap = await canonicalRef.get();
    if (canonicalSnap.exists) return canonicalRef;

    // Transitional fallback: some historical non-business records were embedded under partnersCollection.
    if (partnerId && collectionName && collectionName !== "businessOfferingsCollection") {
        const legacyEmbeddedRef = db
            .collection("partnersCollection")
            .doc(partnerId)
            .collection(collectionName)
            .doc(listingId);
        const legacySnap = await legacyEmbeddedRef.get();
        if (legacySnap.exists) return legacyEmbeddedRef;
    }

    return canonicalRef;
}

/** Multi-day event dates from basic→standard+ upgrade; applied only after billing succeeds. */
function buildPendingEventDatesPatch(startDate, endDate) {
    const start = typeof startDate === "string" ? startDate.trim() : "";
    const end = typeof endDate === "string" ? endDate.trim() : "";
    if (!start || !end || end < start || end === start) return null;
    return { startDate: start, endDate: end };
}

function buildPendingEventDatesFromMetadata(metadata) {
    if (!metadata) return null;
    return buildPendingEventDatesPatch(
        metadata.pendingEventStartDate,
        metadata.pendingEventEndDate
    );
}

/** Stripe metadata first; fall back to listing.pendingUpgradeEventDates from pre-checkout save. */
async function resolveEventDatesAfterPlanUpgrade({ metadata, listingRef, newPlanId }) {
    const fromMeta = buildPendingEventDatesFromMetadata(metadata);
    if (fromMeta) return fromMeta;
    if (!listingRef || !newPlanId || newPlanId === "basic_event") return null;
    try {
        const snap = await listingRef.get();
        if (!snap.exists) return null;
        const pending = snap.data()?.pendingUpgradeEventDates;
        if (!pending) return null;
        if (pending.targetPlanId && pending.targetPlanId !== newPlanId) return null;
        return buildPendingEventDatesPatch(pending.startDate, pending.endDate);
    } catch (err) {
        console.warn("   Could not read pendingUpgradeEventDates from listing:", err?.message || err);
        return null;
    }
}

async function persistPendingUpgradeEventDatesOnListing(listingRef, newPlanId, pendingEventDates) {
    if (!listingRef || !pendingEventDates || !newPlanId || newPlanId === "basic_event") return;
    await listingRef.set(
        {
            pendingUpgradeEventDates: {
                startDate: pendingEventDates.startDate,
                endDate: pendingEventDates.endDate,
                targetPlanId: newPlanId,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}

function getInvoiceSubscriptionId(invoice) {
    if (!invoice?.subscription) return null;
    return typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id || null;
}

function getInvoiceCustomerId(invoice) {
    if (!invoice?.customer) return null;
    return typeof invoice.customer === "string" ? invoice.customer : invoice.customer.id || null;
}

/** Checkout Session / webhooks may expose subscription or customer as an id string or an expanded object. */
function toStripeSubscriptionId(value) {
    if (value == null || value === "") return null;
    if (typeof value === "string") {
        const s = value.trim();
        return s || null;
    }
    if (typeof value === "object" && value !== null && typeof value.id === "string") {
        const s = value.id.trim();
        return s || null;
    }
    return null;
}

function toStripeCustomerId(value) {
    if (value == null || value === "") return null;
    if (typeof value === "string") {
        const s = value.trim();
        return s || null;
    }
    if (typeof value === "object" && value !== null && typeof value.id === "string") {
        const s = value.id.trim();
        return s || null;
    }
    return null;
}

function getInvoicePeriodEndDate(invoice) {
    const firstLine = invoice?.lines?.data?.[0];
    const periodEndSeconds = firstLine?.period?.end || null;
    if (!periodEndSeconds) return null;
    return new Date(periodEndSeconds * 1000);
}

/**
 * Stripe sometimes omits line-item period on invoice webhooks; subscription.current_period_end is reliable.
 */
async function resolveBillingPeriodEndFromStripe(stripeClient, invoice, subscriptionId) {
    const fromInvoice = getInvoicePeriodEndDate(invoice);
    if (fromInvoice) return fromInvoice;
    const subId = toStripeSubscriptionId(subscriptionId);
    if (!subId || !stripeClient) return null;
    try {
        const sub = await stripeClient.subscriptions.retrieve(subId);
        if (sub?.current_period_end) return new Date(sub.current_period_end * 1000);
    } catch (err) {
        console.error("resolveBillingPeriodEndFromStripe:", err?.message || err);
    }
    return null;
}

function partnerIdFromPartnersPlanRef(ref) {
    const parts = ref?.path?.split("/") || [];
    return parts[0] === "partnersCollection" && parts[1] ? parts[1] : "";
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

async function createUpgradeTransactionIfMissing({
    session,
    partnerId,
    newPlanId,
    listingId,
    collectionName,
    group,
}) {
    const partnerKey =
        (partnerId && String(partnerId).trim()) ||
        (session?.client_reference_id && String(session.client_reference_id).trim()) ||
        null;
    if (!session?.id || !partnerKey) return { created: false, reason: "missing-context" };

    const existingUpgradeTxn = await db.collection("transactionsCollection")
        .where("sessionId", "==", session.id)
        .limit(1)
        .get();
    if (!existingUpgradeTxn.empty) return { created: false, reason: "exists" };

    let detailSource = null;
    if (listingId && collectionName) {
        const listingRef = await resolveListingDocRef(partnerKey, collectionName, listingId);
        if (listingRef) {
            const listingSnap = await listingRef.get();
            if (listingSnap.exists) detailSource = listingSnap.data();
        }
    }
    if (!detailSource && partnerKey) {
        const partnerSnap = await db.collection("partnersCollection").doc(partnerKey).get();
        if (partnerSnap.exists) detailSource = partnerSnap.data();
    }

    await db.collection("transactionsCollection").add({
        partnerId: partnerKey,
        amount: (session.amount_total || 0) / 100,
        currency: session.currency || "usd",
        status: "succeeded",
        type: "listing",
        planId: newPlanId || session.metadata?.newPlanId || null,
        featureId: null,
        group: group || session.metadata?.group || null,
        listingId: listingId || session.metadata?.listingId || null,
        collectionName: collectionName || session.metadata?.collectionName || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sessionId: session.id,
        customerEmail: session.customer_details?.email || "",
        selectedCategories: detailSource?.selectedCategories || [],
        selectedSubcategories: detailSource?.selectedSubcategories || [],
        serviceCountries: detailSource?.serviceCountries || [],
        serviceRegions: detailSource?.serviceRegions || [],
        businessName: detailSource?.businessName || "",
        companyRepresentatives: detailSource?.companyRepresentatives || [],
    });

    return { created: true, reason: "inserted" };
}

/**
 * When a plan upgrade is applied without Checkout (e.g. $0 proration remainder), there is no session — still record billing history.
 */
async function recordPlanUpgradeWithoutCheckoutIfMissing({
    partnerId,
    newPlanId,
    listingId,
    collectionName,
    group,
    amount,
    stripeSubscriptionId,
    subscriptionPeriodEndSec,
}) {
    const partnerKey = partnerId && String(partnerId).trim();
    if (!partnerKey || !newPlanId) return { created: false, reason: "missing-context" };

    const upgradeDedupeKey = [
        "inline_plan_upgrade",
        partnerKey,
        listingId || "",
        collectionName || "",
        newPlanId,
        stripeSubscriptionId || "",
        String(subscriptionPeriodEndSec || 0),
    ].join(":");

    const existing = await db.collection("transactionsCollection")
        .where("upgradeDedupeKey", "==", upgradeDedupeKey)
        .limit(1)
        .get();
    if (!existing.empty) return { created: false, reason: "exists" };

    let detailSource = null;
    if (listingId && collectionName) {
        const listingRef = await resolveListingDocRef(partnerKey, collectionName, listingId);
        if (listingRef) {
            const listingSnap = await listingRef.get();
            if (listingSnap.exists) detailSource = listingSnap.data();
        }
    }
    if (!detailSource) {
        const partnerSnap = await db.collection("partnersCollection").doc(partnerKey).get();
        if (partnerSnap.exists) detailSource = partnerSnap.data();
    }

    await db.collection("transactionsCollection").add({
        partnerId: partnerKey,
        amount: typeof amount === "number" && Number.isFinite(amount) ? amount : 0,
        currency: "usd",
        status: "succeeded",
        type: "listing",
        planId: newPlanId,
        featureId: null,
        group: group || null,
        listingId: listingId || null,
        collectionName: collectionName || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sessionId: null,
        upgradeDedupeKey,
        upgradeSource: "subscription_update_no_checkout",
        stripeSubscriptionId: stripeSubscriptionId || null,
        customerEmail: "",
        selectedCategories: detailSource?.selectedCategories || [],
        selectedSubcategories: detailSource?.selectedSubcategories || [],
        serviceCountries: detailSource?.serviceCountries || [],
        serviceRegions: detailSource?.serviceRegions || [],
        businessName: detailSource?.businessName || "",
        companyRepresentatives: detailSource?.companyRepresentatives || [],
    });

    return { created: true, reason: "inserted" };
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
            const meta = session.metadata || {};
            const partnerId =
                (meta.partnerId && String(meta.partnerId).trim()) ||
                (session.client_reference_id && String(session.client_reference_id).trim()) ||
                null;
            const { planId, group, listingId, collectionName, featureId } = meta;
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

            if (session.metadata?.jobListingPlanUpgrade === "true") {
                const upgradeListingId = session.metadata?.listingId || listingId;
                const upgradeCollectionName = session.metadata?.collectionName || resolvedCollectionName;
                const fromPlanId = session.metadata?.fromPlanId || "";
                const toPlanId = session.metadata?.toPlanId || session.metadata?.planId || "";
                if (!partnerRef || !partnerId || !upgradeListingId || !upgradeCollectionName || !toPlanId) {
                    console.log("   ⚠ Job listing upgrade checkout missing metadata; skipping.");
                    break;
                }
                await finalizeJobListingPlanUpgradeWrites({
                    session,
                    partnerId,
                    partnerRef,
                    listingId: upgradeListingId,
                    collectionName: upgradeCollectionName,
                    fromPlanId,
                    toPlanId,
                    group: session.metadata?.group || "jobs",
                });
                break;
            }

            if (session.metadata?.upgradeFlow === "true") {
                const {
                    subscriptionId,
                    subscriptionItemId,
                    newPriceId,
                    newPlanId,
                    listingId: upgradeListingId,
                    collectionName: upgradeCollectionName,
                } = session.metadata;

                const subId = toStripeSubscriptionId(subscriptionId);
                if (!subId || !subscriptionItemId || !newPriceId || !newPlanId || !partnerId) {
                    console.log("   ⚠ Upgrade checkout missing metadata; skipping upgrade completion.");
                    break;
                }

                const upgradedSubscription = await stripe.subscriptions.update(subId, {
                    items: [{ id: subscriptionItemId, price: newPriceId }],
                    proration_behavior: "none",
                    metadata: {
                        partnerId,
                        planId: newPlanId,
                        listingId: upgradeListingId || "",
                        collectionName: upgradeCollectionName || "",
                    },
                });

                if (upgradeListingId && upgradeCollectionName) {
                    const listingRef = await resolveListingDocRef(partnerId, upgradeCollectionName, upgradeListingId);
                    if (listingRef) {
                        const includedSpotlight = PLANS_WITH_INCLUDED_SPOTLIGHT[newPlanId] || null;
                        const pendingEventDates = await resolveEventDatesAfterPlanUpgrade({
                            metadata: session.metadata,
                            listingRef,
                            newPlanId,
                        });
                        const listingUpgradePatch = {
                            selectedPlan: newPlanId,
                            stripeSubscriptionId: upgradedSubscription.id,
                            stripeCustomerId: toStripeCustomerId(upgradedSubscription.customer),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            pendingUpgradeEventDates: admin.firestore.FieldValue.delete(),
                            ...(pendingEventDates || {}),
                        };
                        if (includedSpotlight) {
                            listingUpgradePatch.selectedAddon = includedSpotlight;
                            listingUpgradePatch.featuredPlacement = includedSpotlight;
                            listingUpgradePatch.isFeatured = true;
                            listingUpgradePatch.lastFeaturePaymentReceivedAt = admin.firestore.FieldValue.serverTimestamp();
                            if (upgradedSubscription.current_period_end) {
                                listingUpgradePatch.featureSpotlightPaidThrough = new Date(
                                    upgradedSubscription.current_period_end * 1000
                                );
                            }
                        }
                        await listingRef.set(listingUpgradePatch, { merge: true });
                        if (includedSpotlight) {
                            await upsertIncludedPlanFeature(partnerRef, {
                                featureId: includedSpotlight,
                                listingId: upgradeListingId,
                                collectionName: upgradeCollectionName,
                                planId: newPlanId,
                                sessionId: session.id,
                                accessThrough: upgradedSubscription.current_period_end
                                    ? new Date(upgradedSubscription.current_period_end * 1000)
                                    : null,
                            });
                            await deactivateSupersededPartnerFeatures(partnerRef, upgradeListingId, includedSpotlight);
                        }
                    }
                }

                const planSnap = await db.collection("partnersCollection")
                    .doc(partnerId)
                    .collection("planCollection")
                    .where("listingId", "==", (upgradeListingId || null))
                    .limit(1)
                    .get();
                if (!planSnap.empty) {
                    await planSnap.docs[0].ref.set({
                        planId: newPlanId,
                        planName: newPlanId.replace(/_/g, " "),
                        billingPeriodEnd: upgradedSubscription.current_period_end
                            ? new Date(upgradedSubscription.current_period_end * 1000)
                            : admin.firestore.FieldValue.delete(),
                        upgradedAt: new Date(),
                        stripeSubscriptionId: upgradedSubscription.id,
                        stripeCustomerId: toStripeCustomerId(upgradedSubscription.customer),
                        cancelAtPeriodEnd: false,
                        cancelAt: admin.firestore.FieldValue.delete(),
                    }, { merge: true });
                }

                await logAudit({
                    partnerId,
                    action: "PLAN_UPGRADED",
                    details: `Plan upgraded to ${newPlanId.replace(/_/g, " ")} after Stripe payment.`,
                    category: "billing",
                    metadata: {
                        subscriptionId: upgradedSubscription.id,
                        sessionId: session.id,
                        planId: newPlanId,
                    },
                });
                const upgradeTxnResult = await createUpgradeTransactionIfMissing({
                    session,
                    partnerId,
                    newPlanId,
                    listingId: upgradeListingId,
                    collectionName: upgradeCollectionName,
                    group: group || null,
                });
                if (upgradeTxnResult.created) {
                    console.log(`   ✓ Upgrade transaction record created for session ${session.id}`);
                } else {
                    console.log(`   ℹ Upgrade transaction skipped for session ${session.id}: ${upgradeTxnResult.reason}`);
                }

                break;
            }

            if (session.metadata?.featureUpgradeFlow === "true") {
                const upgradeFeatureId = session.metadata?.featureId || featureId;
                const upgradeListingId = session.metadata?.listingId || listingId;
                const upgradeCollectionName = session.metadata?.collectionName || resolvedCollectionName;
                if (!partnerId || !upgradeFeatureId || !upgradeListingId || !upgradeCollectionName) {
                    console.log("   ⚠ Feature upgrade checkout missing metadata; skipping.");
                    break;
                }
                await finalizeFeatureUpgradeAfterPayment({
                    session,
                    partnerId,
                    partnerRef,
                    featureId: upgradeFeatureId,
                    listingId: upgradeListingId,
                    collectionName: upgradeCollectionName,
                    group: session.metadata?.group || group || null,
                });
                await logAudit({
                    partnerId,
                    action: "FEATURE_UPGRADED",
                    details: `Spotlight upgraded to ${upgradeFeatureId.replace(/_/g, " ")} after Stripe payment.`,
                    category: "listing",
                    metadata: {
                        featureId: upgradeFeatureId,
                        previousFeatureId: session.metadata?.previousFeatureId || null,
                        sessionId: session.id,
                    },
                });
                const existingFeatureUpgradeTxn = await db.collection("transactionsCollection")
                    .where("sessionId", "==", session.id)
                    .limit(1)
                    .get();
                if (existingFeatureUpgradeTxn.empty) {
                    let detailSource = null;
                    const listingRef = await resolveListingDocRef(partnerId, upgradeCollectionName, upgradeListingId);
                    if (listingRef) {
                        const listingSnap = await listingRef.get();
                        if (listingSnap.exists) detailSource = listingSnap.data();
                    }
                    await db.collection("transactionsCollection").add({
                        partnerId,
                        amount: (session.amount_total || 0) / 100,
                        currency: session.currency || "usd",
                        status: "succeeded",
                        type: "feature",
                        planId: null,
                        featureId: upgradeFeatureId,
                        group: session.metadata?.group || group || null,
                        listingId: upgradeListingId,
                        collectionName: upgradeCollectionName,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        sessionId: session.id,
                        customerEmail: session.customer_details?.email || "",
                        businessName: detailSource?.businessName || detailSource?.eventName || "",
                    });
                }
                break;
            }

            if (featureId) {
                await finalizeSpotlightAddonPurchaseWrites({
                    session,
                    partnerId,
                    partnerRef,
                    featureId,
                    listingId,
                    resolvedCollectionName,
                    group: group || null,
                });
                if (listingId && resolvedCollectionName) {
                    const listingRef = await resolveListingDocRef(partnerId, resolvedCollectionName, listingId);
                    if (listingRef) {
                        const listingSnap = await listingRef.get();
                        if (listingSnap.exists) {
                            listingData = listingSnap.data();
                            detailSource = listingData;
                        }
                    }
                }
                console.log(`   ✓ Spotlight add-on subscription linked for ${featureId}`);

                await logAudit({
                    partnerId,
                    action: session.metadata?.featureUpgrade === "true" ? "FEATURE_UPGRADED" : "FEATURE_ADDED",
                    details:
                        session.metadata?.featureUpgrade === "true"
                            ? `Spotlight upgraded to ${featureId.replace(/_/g, " ")}.`
                            : `New feature added: ${featureId.replace(/_/g, " ")}.`,
                    category: "listing",
                    metadata: {
                        featureId,
                        previousFeatureId: session.metadata?.previousFeatureId || null,
                    },
                });
            } else if (listingId && resolvedCollectionName) {
                // Core listing payment - update the listing status
                const listingRef = await resolveListingDocRef(partnerId, resolvedCollectionName, listingId);
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

                    const startDate = new Date();
                    const isYearly = planId?.includes("_yr");
                    const billingPeriodEnd = new Date(startDate);
                    if (isYearly) {
                        billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
                    } else {
                        billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
                    }

                    const includedSpotlight = PLANS_WITH_INCLUDED_SPOTLIGHT[planId] || null;
                    const spotlightPaidThrough = billingPeriodEnd;
                    const listingPaymentUpdate = {
                        status: "Approved",
                        active: true,
                        lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                        stripeSubscriptionId: toStripeSubscriptionId(session.subscription),
                        stripeCustomerId: toStripeCustomerId(session.customer),
                    };
                    if (includedSpotlight) {
                        listingPaymentUpdate.selectedAddon = includedSpotlight;
                        listingPaymentUpdate.featuredPlacement = includedSpotlight;
                        listingPaymentUpdate.isFeatured = true;
                        listingPaymentUpdate.lastFeaturePaymentReceivedAt = admin.firestore.FieldValue.serverTimestamp();
                        listingPaymentUpdate.featureSpotlightPaidThrough = spotlightPaidThrough;
                    }
                    await listingRef.update(listingPaymentUpdate);
                    if (includedSpotlight) {
                        await upsertIncludedPlanFeature(partnerRef, {
                            featureId: includedSpotlight,
                            listingId,
                            collectionName: resolvedCollectionName,
                            planId,
                            sessionId: session.id,
                            accessThrough: spotlightPaidThrough,
                        });
                        await deactivateSupersededPartnerFeatures(partnerRef, listingId, includedSpotlight);
                    }
                    console.log(`   ✓ Listing ${listingId} updated to status: Approved`);

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
                            stripeSubscriptionId: toStripeSubscriptionId(session.subscription),
                            stripeCustomerId: toStripeCustomerId(session.customer),
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
                            stripeSubscriptionId: toStripeSubscriptionId(session.subscription),
                            stripeCustomerId: toStripeCustomerId(session.customer),
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
                    stripeSubscriptionId: toStripeSubscriptionId(session.subscription),
                    stripeCustomerId: toStripeCustomerId(session.customer),
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
            await processSubscriptionInvoicePaid(invoice);
            break;
        }

        case "customer.subscription.deleted": {
            const subscription = event.data.object;
            console.log(`❌ Subscription deleted: ${subscription.id}`);
            const listingUpdateOnEnd = {
                active: false,
                status: "Cancelled",
                selectedAddon: admin.firestore.FieldValue.delete(),
                featuredPlacement: admin.firestore.FieldValue.delete(),
                isFeatured: false,
                featureSpotlightCancelPending: admin.firestore.FieldValue.delete(),
                featureSpotlightAccessEnd: admin.firestore.FieldValue.delete(),
                featureSpotlightPaidThrough: admin.firestore.FieldValue.delete(),
                lastFeaturePaymentReceivedAt: admin.firestore.FieldValue.delete(),
                featureSpotlightStripeSubscriptionId: admin.firestore.FieldValue.delete(),
                featureSpotlightSubscriptionItemId: admin.firestore.FieldValue.delete(),
            };

            const topLevelCollections = ["eventsCollection", "jobsCollection", "consultingServicesCollection", "consultingCollection"];
            for (const col of topLevelCollections) {
                const addonSnap = await db.collection(col)
                    .where("featureSpotlightStripeSubscriptionId", "==", subscription.id)
                    .get();
                for (const lDoc of addonSnap.docs) {
                    const d = lDoc.data() || {};
                    const pid = d.partnerId;
                    if (pid) {
                        await applyListingAfterSpotlightAddonSubscriptionDeleted(pid, lDoc.id, col, subscription.id);
                    }
                }
            }

            for (const col of topLevelCollections) {
                const snap = await db.collection(col).where("stripeSubscriptionId", "==", subscription.id).get();
                for (const lDoc of snap.docs) {
                    await lDoc.ref.set(listingUpdateOnEnd, { merge: true });
                    const listingData = lDoc.data() || {};
                    await deactivateIncludedPlanFeaturesForListing(
                        listingData.partnerId || null,
                        lDoc.id,
                        col
                    );
                }
            }

            const partners = await db.collection("partnersCollection").get();
            for (const pDoc of partners.docs) {
                const embeddedCols = ["businessOfferingsCollection", "consultingServicesCollection", "consultingCollection", "eventsCollection", "jobsCollection"];
                for (const col of embeddedCols) {
                    const addonSnap = await pDoc.ref.collection(col)
                        .where("featureSpotlightStripeSubscriptionId", "==", subscription.id)
                        .get();
                    for (const lDoc of addonSnap.docs) {
                        await applyListingAfterSpotlightAddonSubscriptionDeleted(pDoc.id, lDoc.id, col, subscription.id);
                    }
                }
                for (const col of embeddedCols) {
                    const snap = await pDoc.ref.collection(col).where("stripeSubscriptionId", "==", subscription.id).get();
                    for (const lDoc of snap.docs) {
                        await lDoc.ref.set(listingUpdateOnEnd, { merge: true });
                        await deactivateIncludedPlanFeaturesForListing(pDoc.id, lDoc.id, col);
                    }
                }
                const pSnap = await pDoc.ref.collection("planCollection").where("stripeSubscriptionId", "==", subscription.id).get();
                for (const pPlan of pSnap.docs) {
                    await pPlan.ref.update({
                        active: false,
                        cancelAtPeriodEnd: false,
                        expiredAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
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
                    const partnerId = partnerIdFromPartnersPlanRef(p.ref);
                    if (partnerId) partnerIds.add(partnerId);
                });
                const featSnap = await db.collectionGroup("featuresCollection")
                    .where("stripeSubscriptionId", "==", subscriptionId)
                    .get();
                featSnap.docs.forEach((p) => {
                    const partnerId = partnerIdFromPartnersPlanRef(p.ref);
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
    standard_job: { amount: 40000, name: "Standard Job Listing", interval: "month" },
    premium_job: { amount: 80000, name: "Premium Job Listing", interval: "month" },
    premium_plus_job: { amount: 100000, name: "Premium Plus Job Listing", interval: "month" },
};

/** Tier rank for upgrade rules (higher = higher tier). Same rank for mo/yr of same product level. */
const PLAN_TIER_RANK = {
    basic_mo: 1,
    standard_mo: 2,
    premium_mo: 3,
    premium_plus_mo: 4,
    basic_yr: 1,
    standard_yr: 2,
    premium_yr: 3,
    premium_plus_yr: 4,
    basic_event: 1,
    standard_event: 2,
    premium_event: 3,
    premium_plus_event: 4,
    standard_job: 1,
    premium_job: 2,
    premium_plus_job: 3,
};

const SECONDS_PER_YEAR = 31557600; // 365.25 * 24 * 3600

const LEGACY_PLAN_ID_ALIASES = {
    basic: { month: "basic_mo", year: "basic_yr" },
    standard: { month: "standard_mo", year: "standard_yr" },
    premium: { month: "premium_mo", year: "premium_yr" },
    premium_plus: { month: "premium_plus_mo", year: "premium_plus_yr" },
    premiumplus: { month: "premium_plus_mo", year: "premium_plus_yr" },
};

function normalizePlanId(planId, interval = null) {
    if (!planId || typeof planId !== "string") return null;
    if (PLAN_PRICES[planId]) return planId;

    const normalized = planId.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const alias = LEGACY_PLAN_ID_ALIASES[normalized];
    if (!alias) return null;
    if (interval === "year" && alias.year) return alias.year;
    if (interval === "month" && alias.month) return alias.month;
    return alias.month || alias.year || null;
}

function resolveTierRank({ planId = null, amount = null, interval = null }) {
    const normalizedPlanId = normalizePlanId(planId, interval) || planId;
    const tierFromId = PLAN_TIER_RANK[normalizedPlanId];
    if (tierFromId) return tierFromId;

    if (amount != null) {
        const matched = Object.entries(PLAN_PRICES).find(([, p]) => p.amount === amount && p.interval === interval);
        if (matched) {
            return PLAN_TIER_RANK[matched[0]] || 0;
        }
    }

    return 0;
}

function inferCurrentPlanIdFromSubscription(subscription, subscriptionItem) {
    const metaId = subscription?.metadata?.planId;
    const recurringInterval = subscriptionItem?.price?.recurring?.interval || null;
    const ua = subscriptionItem?.price?.unit_amount;
    const iv = recurringInterval;

    // Prefer explicit Stripe subscription metadata (e.g. standard_job vs premium_mo both $400/mo).
    if (metaId && PLAN_PRICES[metaId]) {
        const planFromMeta = PLAN_PRICES[metaId];
        if (!iv || planFromMeta.interval === iv) {
            return metaId;
        }
    }

    const normalizedMetaId = normalizePlanId(metaId, recurringInterval);
    if (normalizedMetaId && PLAN_PRICES[normalizedMetaId]) {
        const normalizedMetaPlan = PLAN_PRICES[normalizedMetaId];
        if (!iv || normalizedMetaPlan.interval === iv) return normalizedMetaId;
    }

    if (ua != null) {
        for (const [pid, p] of Object.entries(PLAN_PRICES)) {
            if (p.amount === ua && p.interval === iv) return pid;
        }
    }

    return null;
}

function isAllowedSubscriptionUpgrade({
    currentPlanId,
    newPlanId,
    currentAmount,
    currentInterval,
}) {
    const normalizedCurrentPlanId = normalizePlanId(currentPlanId, currentInterval) || currentPlanId;
    const normalizedNewPlanId = normalizePlanId(newPlanId, PLAN_PRICES[newPlanId]?.interval) || newPlanId;
    if (!normalizedCurrentPlanId || !normalizedNewPlanId || normalizedCurrentPlanId === normalizedNewPlanId) return false;

    const curTier = resolveTierRank({
        planId: normalizedCurrentPlanId,
        amount: currentAmount,
        interval: currentInterval || PLAN_PRICES[normalizedCurrentPlanId]?.interval || null,
    });
    const newTier = resolveTierRank({
        planId: normalizedNewPlanId,
        amount: PLAN_PRICES[normalizedNewPlanId]?.amount ?? null,
        interval: PLAN_PRICES[normalizedNewPlanId]?.interval ?? null,
    });
    if (!curTier || !newTier) return false;

    if (normalizedCurrentPlanId.includes("_event")) {
        return normalizedNewPlanId.includes("_event") && newTier > curTier;
    }
    if (normalizedCurrentPlanId.includes("_job")) {
        return normalizedNewPlanId.includes("_job") && newTier > curTier;
    }
    if (normalizedNewPlanId.includes("_event") || normalizedNewPlanId.includes("_job")) return false;

    const normalizedCurrentInterval = currentInterval || PLAN_PRICES[normalizedCurrentPlanId]?.interval || null;
    const normalizedNewInterval = PLAN_PRICES[normalizedNewPlanId]?.interval || null;

    const curMo = normalizedCurrentInterval === "month" || (!normalizedCurrentInterval && normalizedCurrentPlanId.includes("_mo"));
    const curYr = normalizedCurrentInterval === "year" || (!normalizedCurrentInterval && normalizedCurrentPlanId.includes("_yr"));
    const newMo = normalizedNewInterval === "month" || (!normalizedNewInterval && normalizedNewPlanId.includes("_mo"));
    const newYr = normalizedNewInterval === "year" || (!normalizedNewInterval && normalizedNewPlanId.includes("_yr"));
    if (curMo && newMo) return newTier > curTier;
    if (curMo && newYr) return newTier >= curTier;
    if (curYr && newYr) return newTier > curTier;
    return false;
}

// ─── Feature plan add-ons ───
const FEATURE_PRICES = {
    landing_page: { amount: 40000, name: "Landing Page Spotlight", interval: "month" },
    home_page: { amount: 80000, name: "Home Page Spotlight", interval: "month" },
    both: { amount: 100000, name: "Landing + Home Page Spotlight", interval: "month" },
};

const FEATURE_SPOTLIGHT_TIER = {
    landing_page: 1,
    home_page: 2,
    both: 3,
};

/** Plans that include a spotlight tier on the listing (set at payment time). */
const PLANS_WITH_INCLUDED_SPOTLIGHT = {
    premium_event: "landing_page",
    premium_job: "landing_page",
    premium_plus_event: "home_page",
    premium_plus_job: "home_page",
};

function addDays(date, days) {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
}

async function resolveSpotlightAddonPeriodEndFromSession(session) {
    const subId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id || null;
    if (subId) {
        try {
            const sub = await stripe.subscriptions.retrieve(subId);
            if (sub?.current_period_end) return new Date(sub.current_period_end * 1000);
        } catch (err) {
            console.error("resolveSpotlightAddonPeriodEndFromSession:", err?.message || err);
        }
    }
    return addDays(new Date(), 30);
}

/**
 * After Checkout completes for a spotlight add-on (subscription mode), persist Stripe + Firestore links for renewals.
 */
async function finalizeSpotlightAddonPurchaseWrites({
    session,
    partnerId,
    partnerRef,
    featureId,
    listingId,
    resolvedCollectionName,
    group,
}) {
    if (!partnerRef || !featureId) return;
    const paidThrough = await resolveSpotlightAddonPeriodEndFromSession(session);
    const subId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id || null;
    const custId = typeof session.customer === "string"
        ? session.customer
        : session.customer?.id || null;
    let subscriptionItemId = null;
    if (subId) {
        try {
            const sub = await stripe.subscriptions.retrieve(subId);
            subscriptionItemId = sub.items?.data?.[0]?.id || null;
        } catch (err) {
            console.error("finalizeSpotlightAddonPurchaseWrites retrieve sub:", err?.message || err);
        }
    }

    const existingFeature = await partnerRef
        .collection("featuresCollection")
        .where("sessionId", "==", session.id)
        .limit(1)
        .get();
    const featPayload = {
        featureId,
        featureName: featureId.replace(/_/g, " "),
        listingId: listingId || null,
        collectionName: resolvedCollectionName || null,
        group: group || null,
        lastPaymentReceived: new Date(),
        active: true,
        sessionId: session.id,
        source: "spotlight_addon",
        stripeSubscriptionId: subId || null,
        stripeCustomerId: custId || null,
        subscriptionItemId: subscriptionItemId || null,
        accessThrough: paidThrough,
    };
    if (existingFeature.empty) {
        await partnerRef.collection("featuresCollection").add(featPayload);
    } else {
        await existingFeature.docs[0].ref.set(featPayload, { merge: true });
    }

    if (listingId && resolvedCollectionName) {
        const listingRef = await resolveListingDocRef(partnerId, resolvedCollectionName, listingId);
        if (listingRef) {
            await listingRef.set({
                selectedAddon: featureId,
                featuredPlacement: featureId,
                isFeatured: true,
                active: true,
                status: "Approved",
                lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastFeaturePaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                featureSpotlightPaidThrough: paidThrough,
                featureSpotlightStripeSubscriptionId: subId || null,
                featureSpotlightSubscriptionItemId: subscriptionItemId || null,
                featureSpotlightCancelPending: admin.firestore.FieldValue.delete(),
                featureSpotlightAccessEnd: admin.firestore.FieldValue.delete(),
            }, { merge: true });
            await deactivateSupersededPartnerFeatures(partnerRef, listingId, featureId);
        }
    }

    await partnerRef.set({
        selectedAddon: featureId,
        lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(custId ? { stripeCustomerId: custId } : {}),
    }, { merge: true });
}

function resolveFeatureCheckoutAmount(targetFeatureId, listingAddonRaw, featuredPlacementRaw, listingData = null) {
    const target = FEATURE_PRICES[targetFeatureId];
    if (!target) {
        return { error: `Unknown feature: ${targetFeatureId}` };
    }
    const cur = String(listingAddonRaw || featuredPlacementRaw || "").trim();
    if (!cur || !FEATURE_PRICES[cur]) {
        return { unitAmount: target.amount, previousFeatureId: "", isUpgrade: false };
    }
    if (cur === targetFeatureId) {
        return { error: "You already have this spotlight tier." };
    }
    const curTier = FEATURE_SPOTLIGHT_TIER[cur];
    const newTier = FEATURE_SPOTLIGHT_TIER[targetFeatureId];
    if (!curTier || !newTier || newTier <= curTier) {
        return { error: "That is not a valid upgrade from your current spotlight tier." };
    }
    const diff = target.amount - FEATURE_PRICES[cur].amount;
    if (diff <= 0) {
        return { error: "Invalid upgrade pricing." };
    }
    // Time-prorate upgrade within the current 30-day spotlight window (from last feature payment if known).
    let unitAmount = diff;
    if (listingData) {
        const paidAt = toDateValue(listingData.lastFeaturePaymentReceivedAt) || toDateValue(listingData.lastPaymentReceivedAt);
        if (paidAt) {
            const windowEnd = addDays(paidAt, 30);
            const now = new Date();
            const totalMs = Math.max(windowEnd.getTime() - paidAt.getTime(), 1);
            const remainingMs = Math.max(windowEnd.getTime() - now.getTime(), 0);
            const ratio = Math.min(Math.max(remainingMs / totalMs, 0), 1);
            unitAmount = Math.max(Math.round(diff * ratio), 50); // Stripe minimum sensible charge
        }
    }
    return { unitAmount, previousFeatureId: cur, isUpgrade: true };
}

/** Apply spotlight tier after prorated upgrade Checkout payment (subscription update or listing-only). */
async function finalizeFeatureUpgradeAfterPayment({
    session,
    partnerId,
    partnerRef,
    featureId,
    listingId,
    collectionName,
    group,
}) {
    const meta = session?.metadata || {};
    const upgradeSubId = toStripeSubscriptionId(meta.subscriptionId);
    const subscriptionItemId = meta.subscriptionItemId || null;
    const newPriceId = meta.newPriceId || null;
    const noSeparateSub = meta.featureUpgradeNoSub === "true";

    const listingRef =
        partnerId && listingId && collectionName
            ? await resolveListingDocRef(partnerId, collectionName, listingId)
            : null;

    let paidThrough = addDays(new Date(), 30);
    let newItemId = subscriptionItemId;
    let subId = upgradeSubId;
    let custId = null;

    if (!noSeparateSub && upgradeSubId && subscriptionItemId && newPriceId) {
        const currentSub = await stripe.subscriptions.retrieve(upgradeSubId);
        const currentPriceId = currentSub.items?.data?.[0]?.price?.id;
        const updatedSub =
            currentPriceId === newPriceId
                ? currentSub
                : await stripe.subscriptions.update(upgradeSubId, {
                      items: [{ id: subscriptionItemId, price: newPriceId }],
                      proration_behavior: "none",
                      metadata: {
                          purchaseType: "spotlight_addon",
                          partnerId: partnerId || "",
                          featureId: featureId || "",
                          listingId: listingId || "",
                          collectionName: collectionName || "",
                          group: group || "",
                      },
                  });
        paidThrough = updatedSub.current_period_end
            ? new Date(updatedSub.current_period_end * 1000)
            : paidThrough;
        newItemId = updatedSub.items?.data?.[0]?.id || subscriptionItemId;
        custId = toStripeCustomerId(updatedSub.customer);
        subId = updatedSub.id;
    }

    if (listingRef) {
        const listingPatch = {
            selectedAddon: featureId,
            featuredPlacement: featureId,
            isFeatured: true,
            featureSpotlightPaidThrough: paidThrough,
            lastFeaturePaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
            featureSpotlightCancelPending: admin.firestore.FieldValue.delete(),
            featureSpotlightAccessEnd: admin.firestore.FieldValue.delete(),
        };
        if (subId) {
            listingPatch.featureSpotlightStripeSubscriptionId = subId;
            listingPatch.featureSpotlightSubscriptionItemId = newItemId;
        }
        await listingRef.set(listingPatch, { merge: true });
        if (partnerRef) {
            await deactivateSupersededPartnerFeatures(partnerRef, listingId, featureId);
        }
    }

    if (partnerRef && subId) {
        const fcSnap = await partnerRef
            .collection("featuresCollection")
            .where("stripeSubscriptionId", "==", subId)
            .limit(10)
            .get();
        const fcDoc = fcSnap.docs.find((d) => (d.data() || {}).source === "spotlight_addon");
        const featPatch = {
            featureId,
            featureName: featureId.replace(/_/g, " "),
            listingId: listingId || null,
            collectionName: collectionName || null,
            group: group || null,
            lastPaymentReceived: new Date(),
            active: true,
            source: "spotlight_addon",
            stripeSubscriptionId: subId,
            stripeCustomerId: custId,
            subscriptionItemId: newItemId,
            accessThrough: paidThrough,
            sessionId: session?.id || "",
        };
        if (fcDoc) {
            await fcDoc.ref.set(featPatch, { merge: true });
        } else {
            await partnerRef.collection("featuresCollection").add(featPatch);
        }
    }

    if (partnerRef) {
        await partnerRef.set({
            selectedAddon: featureId,
            lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(custId ? { stripeCustomerId: custId } : {}),
        }, { merge: true });
    }
}

async function deactivateSupersededPartnerFeatures(partnerRef, listingId, newFeatureId) {
    if (!partnerRef || !listingId || !newFeatureId) return;
    const snap = await partnerRef.collection("featuresCollection").where("listingId", "==", listingId).get();
    for (const doc of snap.docs) {
        const d = doc.data() || {};
        if (d.active && d.featureId && d.featureId !== newFeatureId) {
            await doc.ref.set(
                {
                    active: false,
                    supersededBy: newFeatureId,
                    supersededAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );
        }
    }
}

async function upsertIncludedPlanFeature(partnerRef, {
    featureId,
    listingId,
    collectionName,
    planId,
    sessionId,
    accessThrough = null,
}) {
    if (!partnerRef || !featureId || !listingId || !collectionName) return;
    const featuresRef = partnerRef.collection("featuresCollection");
    // Keep this query index-light to avoid blocking webhook flow.
    const byListing = await featuresRef
        .where("listingId", "==", listingId)
        .get();
    const existingDoc = byListing.docs.find((doc) => {
        const d = doc.data() || {};
        return d.collectionName === collectionName &&
            d.featureId === featureId &&
            d.source === "included_plan";
    }) || null;

    const basePayload = {
        featureId,
        featureName: featureId.replace(/_/g, " "),
        listingId,
        collectionName,
        source: "included_plan",
        planId: planId || "",
        active: true,
        cancelPending: false,
        lastPaymentReceived: new Date(),
        sessionId: sessionId || "",
    };

    if (!existingDoc) {
        const createPayload = {
            ...basePayload,
            ...(accessThrough ? { accessThrough } : {}),
        };
        await featuresRef.add(createPayload);
    } else {
        const updatePayload = {
            ...basePayload,
            cancelScope: admin.firestore.FieldValue.delete(),
            deactivatedAt: admin.firestore.FieldValue.delete(),
            accessThrough: accessThrough || admin.firestore.FieldValue.delete(),
        };
        await existingDoc.ref.set(updatePayload, { merge: true });
    }
}

/**
 * Recurring spotlight add-on (separate Stripe subscription from listing plan).
 */
async function tryProcessSpotlightAddonInvoicePaid({
    invoice,
    subscriptionId,
    customerId,
    billingReason,
    billingPeriodEnd,
}) {
    const featSnap = await db.collectionGroup("featuresCollection")
        .where("stripeSubscriptionId", "==", subscriptionId)
        .get();
    const addonDocs = featSnap.docs.filter((d) => (d.data() || {}).source === "spotlight_addon");
    if (addonDocs.length === 0) {
        console.log(`   ⚠ No spotlight add-on feature record for subscription ${subscriptionId}`);
        return;
    }

    const partnerIds = new Set();
    let primaryCtx = null;

    for (const fDoc of addonDocs) {
        const fd = fDoc.data() || {};
        const partnerId = partnerIdFromPartnersPlanRef(fDoc.ref);
        if (!partnerId) continue;
        partnerIds.add(partnerId);

        const periodEnd = billingPeriodEnd
            || await resolveBillingPeriodEndFromStripe(stripe, invoice, subscriptionId);

        await fDoc.ref.set({
            lastPaymentReceived: new Date(),
            active: true,
            ...(periodEnd ? { accessThrough: periodEnd } : {}),
            ...(customerId ? { stripeCustomerId: customerId } : {}),
        }, { merge: true });

        if (!primaryCtx && fd.listingId && fd.collectionName) {
            primaryCtx = {
                partnerId,
                listingId: fd.listingId,
                collectionName: fd.collectionName,
                featureId: fd.featureId || null,
                group: fd.group || null,
            };
        }

        if (fd.listingId && fd.collectionName && fd.featureId && periodEnd) {
            const listingRef = await resolveListingDocRef(partnerId, fd.collectionName, fd.listingId);
            if (listingRef) {
                await listingRef.set({
                    selectedAddon: fd.featureId,
                    featuredPlacement: fd.featureId,
                    isFeatured: true,
                    active: true,
                    status: "Approved",
                    lastFeaturePaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    featureSpotlightPaidThrough: periodEnd,
                    ...(customerId ? { stripeCustomerId: customerId } : {}),
                }, { merge: true });
            }
        }
    }

    for (const partnerId of partnerIds) {
        await db.collection("partnersCollection").doc(partnerId).set({
            lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastFeaturePaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(customerId ? { stripeCustomerId: customerId } : {}),
        }, { merge: true });
    }

    if (billingReason === "subscription_create") {
        console.log(`   ℹ Initial spotlight subscription invoice ${invoice.id} already covered by checkout.`);
        return;
    }

    const existingInvoiceTxn = await db.collection("transactionsCollection")
        .where("invoiceId", "==", invoice.id).limit(1).get();
    if (!existingInvoiceTxn.empty) {
        console.log(`   ℹ Transaction already exists for invoice ${invoice.id}`);
        return;
    }

    let detailSource = null;
    if (primaryCtx?.listingId && primaryCtx?.collectionName) {
        const listingRef = await resolveListingDocRef(
            primaryCtx.partnerId,
            primaryCtx.collectionName,
            primaryCtx.listingId
        );
        if (listingRef) {
            const listingSnap = await listingRef.get();
            if (listingSnap.exists) detailSource = listingSnap.data();
        }
    }
    if (!detailSource && primaryCtx?.partnerId) {
        const partnerSnap = await db.collection("partnersCollection").doc(primaryCtx.partnerId).get();
        if (partnerSnap.exists) detailSource = partnerSnap.data();
    }

    const primaryPartnerId = primaryCtx?.partnerId
        || partnerIdFromPartnersPlanRef(addonDocs[0].ref);

    const renewalTransaction = {
        partnerId: primaryPartnerId || null,
        amount: (invoice.amount_paid || invoice.amount_due || 0) / 100,
        currency: invoice.currency || "usd",
        status: "succeeded",
        type: "feature",
        planId: null,
        featureId: primaryCtx?.featureId || null,
        group: primaryCtx?.group || null,
        listingId: primaryCtx?.listingId || null,
        collectionName: primaryCtx?.collectionName || null,
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
    console.log(`   ✓ Spotlight renewal transaction recorded for invoice ${invoice.id}`);

    for (const partnerId of partnerIds) {
        await logAudit({
            partnerId,
            action: "PAYMENT_SUCCESS",
            details: `Spotlight subscription invoice ${invoice.id} paid (${renewalTransaction.amount} ${renewalTransaction.currency.toUpperCase()}).`,
            category: "billing",
            metadata: {
                invoiceId: invoice.id,
                subscriptionId,
                billingReason,
                featureId: primaryCtx?.featureId || null,
            }
        });
    }
}

/**
 * Shared handler for subscription invoice.paid (webhook) and test-only forced billing.
 * Updates planCollection, listing, partner, transactionsCollection (renewals), and audit.
 */
async function processSubscriptionInvoicePaid(invoice) {
    const subscriptionId = getInvoiceSubscriptionId(invoice);
    const customerId = getInvoiceCustomerId(invoice);
    const billingReason = invoice.billing_reason || "unknown";
    const billingPeriodEnd = await resolveBillingPeriodEndFromStripe(stripe, invoice, subscriptionId);

    console.log(`💳 Invoice paid: ${invoice.id} (reason: ${billingReason})`);

    if (!subscriptionId) {
        console.log("   ℹ No subscription ID on invoice, skipping subscription renewal sync.");
        return;
    }

    const planSnap = await db.collectionGroup("planCollection")
        .where("stripeSubscriptionId", "==", subscriptionId)
        .get();

    if (planSnap.empty) {
        await tryProcessSpotlightAddonInvoicePaid({
            invoice,
            subscriptionId,
            customerId,
            billingReason,
            billingPeriodEnd,
        });
        return;
    }

    const partnerIds = new Set();
    let primaryPlanContext = null;

    for (const planDoc of planSnap.docs) {
        const planData = planDoc.data() || {};
        const partnerId = partnerIdFromPartnersPlanRef(planDoc.ref);
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
            const listingRef = await resolveListingDocRef(partnerId, planData.collectionName, planData.listingId);
            if (listingRef) {
                const includedSpotlight = PLANS_WITH_INCLUDED_SPOTLIGHT[planData.planId] || null;
                const listingRenew = {
                    active: true,
                    status: "Approved",
                    lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    stripeSubscriptionId: subscriptionId,
                    ...(customerId ? { stripeCustomerId: customerId } : {}),
                };
                if (includedSpotlight && billingPeriodEnd) {
                    listingRenew.selectedAddon = includedSpotlight;
                    listingRenew.featuredPlacement = includedSpotlight;
                    listingRenew.isFeatured = true;
                    listingRenew.lastFeaturePaymentReceivedAt = admin.firestore.FieldValue.serverTimestamp();
                    listingRenew.featureSpotlightPaidThrough = billingPeriodEnd;
                }
                await listingRef.set(listingRenew, { merge: true });

                if (includedSpotlight && billingPeriodEnd) {
                    const partnerRef = db.collection("partnersCollection").doc(partnerId);
                    await upsertIncludedPlanFeature(partnerRef, {
                        featureId: includedSpotlight,
                        listingId: planData.listingId,
                        collectionName: planData.collectionName,
                        planId: planData.planId,
                        sessionId: planData.sessionId || invoice.id || "",
                        accessThrough: billingPeriodEnd,
                    });
                    await deactivateSupersededPartnerFeatures(partnerRef, planData.listingId, includedSpotlight);
                }
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
    if (billingReason === "subscription_create") {
        console.log(`   ℹ Initial subscription invoice ${invoice.id} already covered by checkout event.`);
        return;
    }

    const existingInvoiceTxn = await db.collection("transactionsCollection")
        .where("invoiceId", "==", invoice.id).limit(1).get();
    if (!existingInvoiceTxn.empty) {
        console.log(`   ℹ Transaction already exists for invoice ${invoice.id}`);
        return;
    }

    let detailSource = null;
    if (primaryPlanContext?.listingId && primaryPlanContext?.collectionName) {
        const listingRef = await resolveListingDocRef(
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
}

async function deactivateIncludedPlanFeaturesForListing(partnerId, listingId, collectionName) {
    if (!partnerId || !listingId || !collectionName) return;
    const byListing = await db.collection("partnersCollection")
        .doc(partnerId)
        .collection("featuresCollection")
        .where("listingId", "==", listingId)
        .get();
    for (const doc of byListing.docs) {
        const d = doc.data() || {};
        if (d.collectionName !== collectionName || d.source !== "included_plan" || d.active !== true) continue;
        await doc.ref.set({
            active: false,
            cancelPending: false,
            deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
}

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

/**
 * Legacy: older job tier upgrades used a one-time Checkout (payment mode) with metadata jobListingPlanUpgrade.
 * New job listings renew monthly like events. This handler remains for any in-flight legacy sessions.
 */
async function finalizeJobListingPlanUpgradeWrites({
    session,
    partnerId,
    partnerRef,
    listingId,
    collectionName,
    fromPlanId,
    toPlanId,
    group,
}) {
    if (!partnerRef || !listingId || !collectionName || !toPlanId) {
        console.log("   ⚠ Job plan upgrade finalize: missing required fields");
        return { ok: false };
    }

    const listingRef = await resolveListingDocRef(partnerId, collectionName, listingId);
    if (!listingRef) return { ok: false };

    const listingSnap = await listingRef.get();
    if (!listingSnap.exists) return { ok: false };
    const listingData = listingSnap.data() || {};

    let planSnap = await partnerRef
        .collection("planCollection")
        .where("listingId", "==", listingId)
        .where("collectionName", "==", collectionName)
        .limit(8)
        .get();
    let planDoc =
        planSnap.docs.find((d) => {
            const p = d.data() || {};
            return p.active !== false && isFirestorePlanBillingLive(p);
        }) || planSnap.docs[0];
    if (!planDoc) {
        const fallback = await partnerRef
            .collection("planCollection")
            .where("listingId", "==", listingId)
            .limit(8)
            .get();
        planDoc = fallback.docs[0] || null;
    }

    const prevPlanData = planDoc ? planDoc.data() || {} : {};
    const planEnd = toDateValue(prevPlanData.billingPeriodEnd);
    const spotlightThrough =
        planEnd ||
        toDateValue(listingData.featureSpotlightPaidThrough) ||
        addDays(new Date(), 30);

    const includedSpotlight = PLANS_WITH_INCLUDED_SPOTLIGHT[toPlanId] || null;

    const custId =
        typeof session.customer === "string"
            ? session.customer
            : session.customer?.id || null;

    const listingPatch = {
        selectedPlan: toPlanId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(custId ? { stripeCustomerId: custId } : {}),
        stripeSubscriptionId: admin.firestore.FieldValue.delete(),
    };

    if (includedSpotlight) {
        listingPatch.selectedAddon = includedSpotlight;
        listingPatch.featuredPlacement = includedSpotlight;
        listingPatch.isFeatured = true;
        listingPatch.lastFeaturePaymentReceivedAt = admin.firestore.FieldValue.serverTimestamp();
        listingPatch.featureSpotlightPaidThrough = spotlightThrough;
    }

    await listingRef.set(listingPatch, { merge: true });

    if (includedSpotlight) {
        await upsertIncludedPlanFeature(partnerRef, {
            featureId: includedSpotlight,
            listingId,
            collectionName,
            planId: toPlanId,
            sessionId: session.id,
            accessThrough: spotlightThrough,
        });
        await deactivateSupersededPartnerFeatures(partnerRef, listingId, includedSpotlight);
    }

    if (planDoc) {
        await planDoc.ref.set(
            {
                planId: toPlanId,
                planName: toPlanId.replace(/_/g, " "),
                billingInterval: "month",
                upgradedAt: new Date(),
                stripeSubscriptionId: admin.firestore.FieldValue.delete(),
                ...(custId ? { stripeCustomerId: custId } : { stripeCustomerId: admin.firestore.FieldValue.delete() }),
                cancelAtPeriodEnd: false,
                cancelAt: admin.firestore.FieldValue.delete(),
            },
            { merge: true }
        );
    }

    await logAudit({
        partnerId,
        action: "PLAN_UPGRADED",
        details: `Job listing upgraded from ${(fromPlanId || "").replace(/_/g, " ")} to ${toPlanId.replace(/_/g, " ")}.`,
        category: "billing",
        metadata: {
            sessionId: session.id,
            planId: toPlanId,
            fromPlanId: fromPlanId || null,
            listingId,
            collectionName,
        },
    });

    const txn = await createUpgradeTransactionIfMissing({
        session,
        partnerId,
        newPlanId: toPlanId,
        listingId,
        collectionName,
        group: group || "jobs",
    });
    if (txn.created) {
        console.log(`   ✓ Job plan upgrade transaction recorded for session ${session.id}`);
    }

    return { ok: true, transaction: txn };
}

const isFirestorePlanBillingLive = (plan) => {
    if (plan?.active === false) return false;
    const end = toDateValue(plan?.billingPeriodEnd) || toDateValue(plan?.cancelAt);
    if (end && end.getTime() < Date.now()) return false;
    return true;
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
        if (!isFirestorePlanBillingLive(plan)) return;
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
 * When a monthly spotlight *add-on* Stripe subscription ends, clear add-on fields and optionally restore included-plan spotlight.
 */
async function applyListingAfterSpotlightAddonSubscriptionDeleted(partnerId, listingId, collectionName, deletedSubscriptionId) {
    if (!partnerId || !listingId || !collectionName || !deletedSubscriptionId) return;
    const partnerRef = db.collection("partnersCollection").doc(partnerId);
    const listingRef = await resolveListingDocRef(partnerId, collectionName, listingId);
    if (!listingRef) return;

    const planSnap = await partnerRef
        .collection("planCollection")
        .where("listingId", "==", listingId)
        .where("collectionName", "==", collectionName)
        .where("active", "==", true)
        .limit(8)
        .get();
    const livePlan = planSnap.docs.find((doc) => isFirestorePlanBillingLive(doc.data() || {}));

    const patch = {
        featureSpotlightStripeSubscriptionId: admin.firestore.FieldValue.delete(),
        featureSpotlightSubscriptionItemId: admin.firestore.FieldValue.delete(),
        featureSpotlightPaidThrough: admin.firestore.FieldValue.delete(),
        lastFeaturePaymentReceivedAt: admin.firestore.FieldValue.delete(),
    };

    if (livePlan) {
        const planData = livePlan.data() || {};
        const included = PLANS_WITH_INCLUDED_SPOTLIGHT[planData.planId];
        const through = toDateValue(planData.billingPeriodEnd);
        if (included && through) {
            patch.selectedAddon = included;
            patch.featuredPlacement = included;
            patch.isFeatured = true;
            patch.featureSpotlightPaidThrough = through;
            patch.lastFeaturePaymentReceivedAt = admin.firestore.FieldValue.serverTimestamp();
        } else {
            patch.selectedAddon = admin.firestore.FieldValue.delete();
            patch.featuredPlacement = admin.firestore.FieldValue.delete();
            patch.isFeatured = false;
        }
    } else {
        patch.selectedAddon = admin.firestore.FieldValue.delete();
        patch.featuredPlacement = admin.firestore.FieldValue.delete();
        patch.isFeatured = false;
    }

    await listingRef.set(patch, { merge: true });

    const fSnap = await partnerRef
        .collection("featuresCollection")
        .where("stripeSubscriptionId", "==", deletedSubscriptionId)
        .limit(20)
        .get();
    for (const fd of fSnap.docs) {
        if ((fd.data() || {}).source !== "spotlight_addon") continue;
        await fd.ref.set(
            {
                active: false,
                deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    }
}

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

        const resolvedCollectionName =
            req.body.collectionName ||
            (group === "business_offerings"
                ? "businessOfferingsCollection"
                : group === "consulting"
                    ? "consultingServicesCollection"
                    : group === "events"
                        ? "eventsCollection"
                        : "jobsCollection");

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
                collectionName: resolvedCollectionName,
            },
        };

        if (plan.interval) {
            sessionParams.subscription_data = {
                metadata: {
                    partnerId,
                    planId,
                    group,
                    listingId: req.body.listingId || "",
                    collectionName: resolvedCollectionName,
                },
            };
        }

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
        const listingRef = await resolveListingDocRef(partnerId, collectionName, listingId);
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
            .limit(5)
            .get();
        const livePlanDoc = activePlanSnap.docs.find((d) => isFirestorePlanBillingLive(d.data() || {}));
        if (!livePlanDoc) {
            return res.status(400).json({ error: "No active paid plan found for this listing." });
        }

        const pricing = resolveFeatureCheckoutAmount(
            featureId,
            listingData.selectedAddon,
            listingData.featuredPlacement,
            listingData
        );
        if (pricing.error) {
            return res.status(400).json({ error: pricing.error });
        }

        if (listingData.featureSpotlightStripeSubscriptionId && !pricing.isUpgrade) {
            return res.status(400).json({
                error: "This listing already has a monthly spotlight subscription. Use upgrade to change tier, or cancel the add-on in Stripe before subscribing again.",
            });
        }

        const productName = pricing.isUpgrade
            ? `Pharma Socii — Spotlight upgrade (${pricing.previousFeatureId.replace(/_/g, " ")} → ${feature.name})`
            : `Pharma Socii — ${feature.name}`;
        const productDescription = pricing.isUpgrade
            ? "Monthly spotlight subscription; upgrade may include a one-time proration on your next Stripe invoice."
            : "Monthly recurring spotlight add-on (renews until cancelled in Stripe).";

        const existingSubId = toStripeSubscriptionId(listingData.featureSpotlightStripeSubscriptionId);
        const existingItemId = listingData.featureSpotlightSubscriptionItemId || null;

        if (pricing.isUpgrade && pricing.unitAmount > 0) {
            const newPrice = await stripe.prices.create({
                currency: "usd",
                unit_amount: feature.amount,
                recurring: { interval: feature.interval || "month" },
                product_data: { name: `Pharma Socii — ${feature.name}` },
            });

            let stripeCustomerId = null;
            if (existingSubId) {
                try {
                    const existingSub = await stripe.subscriptions.retrieve(existingSubId);
                    stripeCustomerId =
                        typeof existingSub.customer === "string" ? existingSub.customer : existingSub.customer?.id || null;
                } catch (subErr) {
                    console.warn("Feature upgrade: could not load existing subscription customer:", subErr?.message);
                }
            }

            const upgradeMetadata = {
                partnerId: partnerId || "",
                featureUpgradeFlow: "true",
                featureId,
                listingId: listingId || "",
                collectionName: collectionName || "",
                group: group || "",
                previousFeatureId: pricing.previousFeatureId || "",
                featureUpgrade: "true",
                ...(existingSubId && existingItemId
                    ? {
                        subscriptionId: existingSubId,
                        subscriptionItemId: existingItemId,
                        newPriceId: newPrice.id,
                    }
                    : { featureUpgradeNoSub: "true" }),
            };

            const upgradeSession = await stripe.checkout.sessions.create({
                mode: "payment",
                line_items: [
                    {
                        price_data: {
                            currency: "usd",
                            product_data: {
                                name: productName,
                                description: productDescription,
                            },
                            unit_amount: pricing.unitAmount,
                        },
                        quantity: 1,
                    },
                ],
                success_url:
                    successUrl ||
                    "https://orange-bear-967180.hostingersite.com/partner/dashboard?feature=success&session_id={CHECKOUT_SESSION_ID}",
                cancel_url: cancelUrl || "https://orange-bear-967180.hostingersite.com/partner/dashboard?feature=cancelled",
                ...(stripeCustomerId
                    ? { customer: stripeCustomerId }
                    : partnerEmail
                      ? { customer_email: partnerEmail }
                      : {}),
                client_reference_id: partnerId,
                metadata: upgradeMetadata,
            });

            console.log(
                `✓ Feature upgrade checkout created: ${upgradeSession.id} (${pricing.unitAmount} cents, ${existingSubId ? "with sub" : "listing-only"})`
            );
            return res.json({ url: upgradeSession.url, sessionId: upgradeSession.id, proratedAmount: pricing.unitAmount / 100 });
        }

        if (pricing.isUpgrade && pricing.unitAmount <= 0) {
            const newPrice = await stripe.prices.create({
                currency: "usd",
                unit_amount: feature.amount,
                recurring: { interval: feature.interval || "month" },
                product_data: { name: `Pharma Socii — ${feature.name}` },
            });
            if (existingSubId && existingItemId) {
                const updatedSub = await stripe.subscriptions.update(existingSubId, {
                    items: [{ id: existingItemId, price: newPrice.id, quantity: 1 }],
                    proration_behavior: "none",
                    metadata: {
                        purchaseType: "spotlight_addon",
                        partnerId,
                        featureId,
                        listingId: listingId || "",
                        collectionName: collectionName || "",
                        group: group || "",
                    },
                });
                await finalizeFeatureUpgradeAfterPayment({
                    session: {
                        id: "inline-feature-upgrade",
                        metadata: {
                            subscriptionId: updatedSub.id,
                            subscriptionItemId: updatedSub.items?.data?.[0]?.id || existingItemId,
                            newPriceId: newPrice.id,
                        },
                    },
                    partnerId,
                    partnerRef,
                    featureId,
                    listingId,
                    collectionName,
                    group,
                });
            } else {
                await listingRef.set(
                    {
                        selectedAddon: featureId,
                        featuredPlacement: featureId,
                        isFeatured: true,
                        lastFeaturePaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                );
                await deactivateSupersededPartnerFeatures(partnerRef, listingId, featureId);
                await partnerRef.set({
                    selectedAddon: featureId,
                    lastPaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            return res.json({
                success: true,
                noCheckoutRequired: true,
                upgraded: true,
                message: "Spotlight tier updated with no prorated charge remaining in this period.",
            });
        }

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: productName,
                            description: productDescription,
                        },
                        unit_amount: feature.amount,
                        recurring: { interval: feature.interval || "month" },
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
                previousFeatureId: pricing.previousFeatureId || "",
                featureUpgrade: pricing.isUpgrade ? "true" : "false",
            },
            subscription_data: {
                metadata: {
                    purchaseType: "spotlight_addon",
                    partnerId,
                    featureId,
                    listingId: listingId || "",
                    collectionName: collectionName || "",
                    group: group || "",
                    previousFeatureId: pricing.previousFeatureId || "",
                    featureUpgrade: pricing.isUpgrade ? "true" : "false",
                },
            },
        });

        console.log(
            `✓ Feature subscription checkout created: ${session.id} for ${featureId}${pricing.isUpgrade ? ` (upgrade from ${pricing.previousFeatureId})` : ""}`
        );
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
 * POST /api/cron/cleanup-expired-spotlights
 * Clears spotlight addon after featureSpotlightAccessEnd when cancel was pending.
 * Header: x-cron-secret: process.env.CRON_SECRET (or Cloud Scheduler OIDC to your gateway).
 */
app.post("/api/cron/cleanup-expired-spotlights", async (req, res) => {
    const expected = process.env.CRON_SECRET;
    if (!expected || req.headers["x-cron-secret"] !== expected) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    if (!admin.apps?.length) {
        return res.status(503).json({ error: "Firebase Admin not initialized" });
    }
    try {
        const result = await cleanupExpiredSpotlights();
        return res.json({ ok: true, ...result });
    } catch (err) {
        console.error("cleanup-expired-spotlights:", err);
        return res.status(500).json({ error: err.message || "Cleanup failed" });
    }
});

/**
 * POST /api/cron/bill-subscription-now
 * Test keys only: creates, finalizes, and pays a subscription invoice so Stripe sends invoice.paid (or call processSubscriptionInvoicePaid after pay).
 * Header: x-cron-secret: process.env.CRON_SECRET
 * Body: { subscriptionId: string }
 */
app.post("/api/cron/bill-subscription-now", async (req, res) => {
    const expected = process.env.CRON_SECRET;
    if (!expected || req.headers["x-cron-secret"] !== expected) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    if (!STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
        return res.status(403).json({ error: "Only allowed with Stripe test secret key (sk_test_)." });
    }
    const subscriptionId = toStripeSubscriptionId(req.body?.subscriptionId);
    if (!subscriptionId) {
        return res.status(400).json({ error: "subscriptionId is required." });
    }
    try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) {
            return res.status(400).json({ error: "Subscription has no customer id." });
        }

        let invoice = await stripe.invoices.create({
            customer: customerId,
            subscription: subscriptionId,
            auto_advance: true,
        });

        if (invoice.status === "draft") {
            invoice = await stripe.invoices.finalizeInvoice(invoice.id);
        }
        if (invoice.status === "open") {
            invoice = await stripe.invoices.pay(invoice.id);
        }

        const retrieved = await stripe.invoices.retrieve(invoice.id);
        await processSubscriptionInvoicePaid(retrieved);

        return res.json({
            ok: true,
            invoiceId: retrieved.id,
            status: retrieved.status,
            note: "If your server also receives invoice.paid via webhook, processing is idempotent (same invoiceId).",
        });
    } catch (err) {
        console.error("bill-subscription-now:", err);
        return res.status(500).json({
            error: err.message || "Billing failed",
            hint: "If Stripe reports nothing to invoice, attach a Test Clock to the customer and advance time, or wait for the natural renewal.",
        });
    }
});

/**
 * POST /api/upgrade-subscription
 * Upgrade a subscription to a higher tier plan
 * Body: { subscriptionId, newPlanId, partnerId, listingId, collectionName }
 */
app.post("/api/upgrade-subscription", async (req, res) => {
    try {
        const {
            subscriptionId,
            newPlanId,
            currentPlanId: expectedCurrentPlanId,
            partnerId,
            listingId,
            collectionName,
            partnerEmail,
            successUrl,
            cancelUrl,
            pendingEventStartDate,
            pendingEventEndDate,
        } = req.body;

        const pendingEventDates = buildPendingEventDatesPatch(pendingEventStartDate, pendingEventEndDate);

        console.log(`⬆️ Upgrading subscription: ${subscriptionId} to ${newPlanId}`);

        const newPlan = PLAN_PRICES[newPlanId];
        if (!newPlan) {
            return res.status(400).json({ error: `Unknown plan: ${newPlanId}` });
        }

        let effectiveSubscriptionId = toStripeSubscriptionId(subscriptionId);
        if (!effectiveSubscriptionId && partnerId) {
            const partnerPlanQuery = db.collection("partnersCollection").doc(partnerId).collection("planCollection");
            if (listingId) {
                const listingPlanSnap = await partnerPlanQuery
                    .where("listingId", "==", listingId)
                    .where("active", "==", true)
                    .limit(5)
                    .get();
                for (const planDoc of listingPlanSnap.docs) {
                    const candidate = toStripeSubscriptionId(planDoc.data()?.stripeSubscriptionId);
                    if (candidate) {
                        effectiveSubscriptionId = candidate;
                        break;
                    }
                }
            }
            if (!effectiveSubscriptionId && !listingId) {
                const anyActivePlanSnap = await partnerPlanQuery
                    .where("active", "==", true)
                    .limit(10)
                    .get();
                for (const planDoc of anyActivePlanSnap.docs) {
                    const candidate = toStripeSubscriptionId(planDoc.data()?.stripeSubscriptionId);
                    if (candidate) {
                        effectiveSubscriptionId = candidate;
                        break;
                    }
                }
            }
        }

        if (!effectiveSubscriptionId) {
            return res.status(400).json({
                error:
                    "Could not find an existing subscription to upgrade for this listing. Refresh the dashboard and try again, or contact support if this persists.",
            });
        }

        {
            let subscription = await stripe.subscriptions.retrieve(effectiveSubscriptionId);
            const customerIdForLookup = typeof subscription.customer === "string" ? subscription.customer : null;
            const expectedCurrentPlan = PLAN_PRICES[expectedCurrentPlanId] || null;

            if (customerIdForLookup) {
                const allCustomerSubscriptions = await stripe.subscriptions.list({
                    customer: customerIdForLookup,
                    status: "all",
                    limit: 100,
                });

                const liveStatuses = new Set(["active", "trialing", "past_due", "unpaid"]);
                const list = allCustomerSubscriptions.data || [];
                const hasExpectedListingContext = Boolean(listingId);
                const collectionMatchRequired = Boolean(collectionName);
                const byListing = hasExpectedListingContext
                    ? list.find((sub) => {
                        if (!liveStatuses.has(sub.status)) return false;
                        const metaListingId = sub.metadata?.listingId || "";
                        const metaCollection = sub.metadata?.collectionName || "";
                        if (metaListingId !== listingId) return false;
                        if (collectionMatchRequired && metaCollection && metaCollection !== collectionName) return false;
                        return Boolean(sub.items?.data?.[0]?.price?.recurring?.interval);
                    })
                    : null;

                const byExpectedPlan = expectedCurrentPlan
                    ? list.find((sub) => {
                        if (!liveStatuses.has(sub.status)) return false;
                        const item = sub.items?.data?.[0];
                        const amt = item?.price?.unit_amount ?? null;
                        const iv = item?.price?.recurring?.interval || null;
                        return amt === expectedCurrentPlan.amount && iv === expectedCurrentPlan.interval;
                    })
                    : null;

                const resolvedSubscription = byListing || byExpectedPlan || subscription;
                if (resolvedSubscription.id !== subscription.id) {
                    console.log("   Resolved upgrade subscription mismatch:", {
                        requestedSubscriptionId: effectiveSubscriptionId,
                        resolvedSubscriptionId: resolvedSubscription.id,
                        strategy: byListing ? "listing-metadata" : "expected-current-plan",
                    });
                }
                subscription = resolvedSubscription;
                effectiveSubscriptionId = resolvedSubscription.id;
            }

            const subscriptionItem = subscription.items?.data?.[0];
            if (!subscriptionItem) {
                return res.status(400).json({ error: "Unable to locate active subscription item for upgrade." });
            }

            const currentAmount = subscriptionItem.price?.unit_amount || 0;
            const currentInterval = subscriptionItem.price?.recurring?.interval || null;
            const currentPlanId = inferCurrentPlanIdFromSubscription(subscription, subscriptionItem);
            console.log("   Upgrade validation input:", {
                effectiveSubscriptionId,
                expectedCurrentPlanId: expectedCurrentPlanId || null,
                currentPlanId,
                currentAmount,
                currentInterval,
                newPlanId,
                newPlanInterval: newPlan.interval || null,
            });

            if (!currentPlanId) {
                return res.status(400).json({
                    error:
                        "Could not determine your current plan from Stripe. Please contact support or complete the upgrade after your subscription metadata is updated.",
                });
            }

            if (
                partnerId &&
                listingId &&
                collectionName &&
                expectedCurrentPlanId &&
                expectedCurrentPlanId !== currentPlanId &&
                !String(expectedCurrentPlanId).includes("_job")
            ) {
                const listingRef = await resolveListingDocRef(partnerId, collectionName, listingId);
                if (listingRef) {
                    await listingRef.set({
                        selectedPlan: currentPlanId,
                        stripeSubscriptionId: subscription.id,
                        stripeCustomerId: subscription.customer || null,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                }

                const planCollectionRef = db.collection("partnersCollection").doc(partnerId).collection("planCollection");
                let planByListingSnap = await planCollectionRef
                    .where("listingId", "==", listingId)
                    .where("collectionName", "==", collectionName)
                    .limit(5)
                    .get();
                if (planByListingSnap.empty) {
                    planByListingSnap = await planCollectionRef
                        .where("listingId", "==", listingId)
                        .limit(8)
                        .get();
                }
                const mismatchedPlanDoc = planByListingSnap.docs.find((doc) => {
                    const d = doc.data() || {};
                    return toStripeSubscriptionId(d.stripeSubscriptionId) === effectiveSubscriptionId || d.planId === expectedCurrentPlanId;
                }) || planByListingSnap.docs[0];
                if (mismatchedPlanDoc) {
                    await mismatchedPlanDoc.ref.set({
                        planId: currentPlanId,
                        planName: currentPlanId.replace(/_/g, " "),
                        stripeSubscriptionId: subscription.id,
                        stripeCustomerId: subscription.customer || null,
                        billingPeriodEnd: subscription.current_period_end
                            ? new Date(subscription.current_period_end * 1000)
                            : admin.firestore.FieldValue.delete(),
                        updatedAt: new Date(),
                    }, { merge: true });
                }
            }

            if (currentPlanId === newPlanId) {
                return res.status(409).json({
                    error: `This listing is already on ${newPlanId.replace(/_/g, " ")}. Refresh the dashboard.`,
                    alreadyOnPlan: true,
                    subscriptionId: effectiveSubscriptionId,
                });
            }

            if (!isAllowedSubscriptionUpgrade({
                currentPlanId,
                newPlanId,
                currentAmount,
                currentInterval,
            })) {
                return res.status(400).json({
                    error:
                        "That plan change is not allowed. Choose a higher tier on the same billing cycle, or an annual plan at the same tier or higher.",
                });
            }

            // Time-based proration for the remainder of the current Stripe billing period.
            const periodStart = subscription.current_period_start || Math.floor(Date.now() / 1000);
            const periodEnd = subscription.current_period_end || periodStart;
            const now = Math.floor(Date.now() / 1000);
            const totalSeconds = Math.max(periodEnd - periodStart, 1);
            const remainingSeconds = Math.max(periodEnd - now, 0);
            const remainingRatio = Math.min(Math.max(remainingSeconds / totalSeconds, 0), 1);

            const newInterval = newPlan.interval;
            const normalizedCurrentIv = currentInterval || null;
            const normalizedNewIv = newInterval || null;
            const alignedBillingIntervals = normalizedCurrentIv === normalizedNewIv;

            let proratedDiffAmount;
            if (alignedBillingIntervals) {
                const planDiffAmount = newPlan.amount - currentAmount;
                if (planDiffAmount <= 0) {
                    return res.status(400).json({ error: "Selected plan is not higher than the current plan." });
                }
                proratedDiffAmount = Math.max(Math.round(planDiffAmount * remainingRatio), 0);
            } else {
                // e.g. monthly → annual: credit unused monthly prepayment, charge annual slice for the same wall time.
                const creditCents = Math.round(currentAmount * remainingRatio);
                if (normalizedCurrentIv === "month" && normalizedNewIv === "year") {
                    // For monthly -> annual upgrades, charge annual price now minus unused monthly credit.
                    // This avoids accidental $0 upgrades caused by prorating annual cost to only the remaining month.
                    proratedDiffAmount = Math.max(0, newPlan.amount - creditCents);
                } else {
                    const newCentsForRemainder =
                        newInterval === "year"
                            ? Math.round((remainingSeconds / SECONDS_PER_YEAR) * newPlan.amount)
                            : Math.round((remainingSeconds / totalSeconds) * newPlan.amount);
                    proratedDiffAmount = Math.max(0, newCentsForRemainder - creditCents);
                }
            }

            const newPrice = await stripe.prices.create({
                currency: "usd",
                unit_amount: newPlan.amount,
                recurring: newPlan.interval ? { interval: newPlan.interval } : undefined,
                product_data: {
                    name: `Pharma Socii — ${newPlan.name}`,
                },
            });

            const currentTierRank = resolveTierRank({
                planId: currentPlanId,
                amount: currentAmount,
                interval: currentInterval,
            });
            const newTierRank = resolveTierRank({
                planId: newPlanId,
                amount: newPlan.amount,
                interval: newPlan.interval,
            });
            const isPaidTierUpgrade = newTierRank > currentTierRank && newPlan.amount > currentAmount;

            // Avoid silent $0 upgrades when moving to a higher tier — always collect via Checkout when owed.
            if (proratedDiffAmount <= 0 && isPaidTierUpgrade) {
                const fullDiff = newPlan.amount - currentAmount;
                proratedDiffAmount = Math.max(
                    50,
                    Math.round(fullDiff * Math.max(remainingRatio, 0.05))
                );
                console.log("   Applied minimum prorated upgrade charge:", {
                    proratedDiffAmount,
                    fullDiff,
                    remainingRatio,
                });
            }

            if (proratedDiffAmount <= 0) {
                const updatedSubscription = await stripe.subscriptions.update(effectiveSubscriptionId, {
                    items: [{ id: subscriptionItem.id, price: newPrice.id }],
                    proration_behavior: "none",
                    metadata: {
                        partnerId: partnerId || "",
                        planId: newPlanId,
                        listingId: listingId || "",
                        collectionName: collectionName || "",
                    },
                });

                let inlineListingRef = null;
                if (listingId && collectionName && partnerId) {
                    inlineListingRef = await resolveListingDocRef(partnerId, collectionName, listingId);
                    if (inlineListingRef) {
                        const inlineEventDates = await resolveEventDatesAfterPlanUpgrade({
                            metadata: {
                                pendingEventStartDate: pendingEventDates?.startDate,
                                pendingEventEndDate: pendingEventDates?.endDate,
                            },
                            listingRef: inlineListingRef,
                            newPlanId,
                        });
                        await inlineListingRef.set({
                            selectedPlan: newPlanId,
                            stripeSubscriptionId: updatedSubscription.id,
                            stripeCustomerId: updatedSubscription.customer || null,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            pendingUpgradeEventDates: admin.firestore.FieldValue.delete(),
                            ...(inlineEventDates || {}),
                        }, { merge: true });
                    }
                }

                if (partnerId) {
                    const planCollectionRef = db.collection("partnersCollection").doc(partnerId).collection("planCollection");
                    let targetPlanDoc = null;

                    if (listingId) {
                        let byListingQuery = planCollectionRef.where("listingId", "==", listingId);
                        if (collectionName) {
                            byListingQuery = byListingQuery.where("collectionName", "==", collectionName);
                        }
                        const byListingSnap = await byListingQuery.limit(5).get();
                        targetPlanDoc = byListingSnap.docs.find((doc) => {
                            const d = doc.data() || {};
                            return toStripeSubscriptionId(d.stripeSubscriptionId) === effectiveSubscriptionId;
                        }) || byListingSnap.docs[0] || null;
                    }

                    if (!targetPlanDoc) {
                        const bySubSnap = await planCollectionRef
                            .where("stripeSubscriptionId", "==", effectiveSubscriptionId)
                            .limit(3)
                            .get();
                        targetPlanDoc = bySubSnap.docs[0] || null;
                    }

                    if (targetPlanDoc) {
                        await targetPlanDoc.ref.set({
                            planId: newPlanId,
                            planName: newPlanId.replace(/_/g, " "),
                            billingPeriodEnd: updatedSubscription.current_period_end
                                ? new Date(updatedSubscription.current_period_end * 1000)
                                : admin.firestore.FieldValue.delete(),
                            upgradedAt: new Date(),
                            stripeSubscriptionId: updatedSubscription.id,
                            stripeCustomerId: updatedSubscription.customer || null,
                            cancelAtPeriodEnd: false,
                            cancelAt: admin.firestore.FieldValue.delete(),
                        }, { merge: true });
                    }

                    await logAudit({
                        partnerId,
                        action: "PLAN_UPGRADED",
                        details: `Plan upgraded to ${newPlanId.replace(/_/g, " ")} with no prorated payment required.`,
                        category: "billing",
                        metadata: {
                            subscriptionId: updatedSubscription.id,
                            planId: newPlanId,
                            noProrationCharge: true,
                        },
                    });

                    const inlineTxn = await recordPlanUpgradeWithoutCheckoutIfMissing({
                        partnerId,
                        newPlanId,
                        listingId: listingId || null,
                        collectionName: collectionName || null,
                        group: req.body.group || (targetPlanDoc ? targetPlanDoc.data()?.group : null) || null,
                        amount: 0,
                        stripeSubscriptionId: updatedSubscription.id,
                        subscriptionPeriodEndSec: updatedSubscription.current_period_end || 0,
                    });
                    if (inlineTxn.created) {
                        console.log("   ✓ Transaction recorded for plan upgrade (no Checkout session)");
                    } else {
                        console.log(`   ℹ Inline upgrade transaction: ${inlineTxn.reason}`);
                    }
                }

                return res.json({
                    success: true,
                    noCheckoutRequired: true,
                    subscriptionId: updatedSubscription.id,
                    proratedAmount: 0,
                    message: "Upgrade applied with no prorated charge remaining in this billing cycle.",
                });
            }

            const stripeCustomerId =
                typeof subscription.customer === "string"
                    ? subscription.customer
                    : null;

            if (pendingEventDates && listingId && collectionName && partnerId) {
                const checkoutListingRef = await resolveListingDocRef(partnerId, collectionName, listingId);
                if (checkoutListingRef) {
                    await persistPendingUpgradeEventDatesOnListing(
                        checkoutListingRef,
                        newPlanId,
                        pendingEventDates
                    );
                }
            }

            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                line_items: [
                    {
                        price_data: {
                            currency: "usd",
                            product_data: {
                                name: `Pharma Socii — ${newPlan.name} Upgrade (Prorated)`,
                                description: "Prorated charge for upgrading your active subscription",
                            },
                            unit_amount: proratedDiffAmount,
                        },
                        quantity: 1,
                    },
                ],
                success_url: successUrl || "https://orange-bear-967180.hostingersite.com/partner/dashboard?upgrade=success&session_id={CHECKOUT_SESSION_ID}",
                cancel_url: cancelUrl || "https://orange-bear-967180.hostingersite.com/partner/dashboard?upgrade=cancelled",
                ...(stripeCustomerId
                    ? { customer: stripeCustomerId }
                    : (partnerEmail ? { customer_email: partnerEmail } : {})),
                client_reference_id: partnerId,
                metadata: {
                    partnerId: partnerId || "",
                    upgradeFlow: "true",
                    subscriptionId: effectiveSubscriptionId,
                    subscriptionItemId: subscriptionItem.id,
                    newPriceId: newPrice.id,
                    newPlanId,
                    listingId: listingId || "",
                    collectionName: collectionName || "",
                    planId: newPlanId,
                    group: "",
                    ...(pendingEventDates
                        ? {
                            pendingEventStartDate: pendingEventDates.startDate,
                            pendingEventEndDate: pendingEventDates.endDate,
                        }
                        : {}),
                },
            });

            console.log(`   ✓ Upgrade checkout session created: ${session.id} (prorated ${proratedDiffAmount} cents)`);
            return res.json({
                success: true,
                url: session.url,
                sessionId: session.id,
                proratedAmount: proratedDiffAmount / 100,
            });
        }

    } catch (err) {
        console.error("❌ Upgrade subscription error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/cancel-plan
 * Cancel spotlight add-on only, or cancel the subscription (which also removes a paid add-on on the listing).
 * Body: { partnerId, planDocId, cancelScope }
 * cancelScope: "feature" | "plan" (plan_and_feature accepted as alias of plan for older clients)
 */
app.post("/api/cancel-plan", async (req, res) => {
    try {
        const { partnerId, planDocId, cancelScope = "plan" } = req.body;

        if (!partnerId || !planDocId) {
            return res.status(400).json({ error: "partnerId and planDocId are required." });
        }
        if (!["feature", "plan", "plan_and_feature"].includes(cancelScope)) {
            return res.status(400).json({ error: "cancelScope must be feature or plan." });
        }

        const partnerRef = db.collection("partnersCollection").doc(partnerId);
        const planRef = partnerRef.collection("planCollection").doc(planDocId);
        const planSnap = await planRef.get();
        if (!planSnap.exists) {
            return res.status(404).json({ error: "Plan not found." });
        }

        const plan = planSnap.data() || {};
        let cancelledPlan = false;
        let cancelledFeature = false;
        let stripeCancelAt = null;
        let linkedFeatureId = null;

        const cancelFeatureOnly = cancelScope === "feature";
        const cancelPlan = cancelScope === "plan" || cancelScope === "plan_and_feature";

        const resolveAccessEndDate = async () => {
            let end = toDateValue(plan.billingPeriodEnd) || toDateValue(plan.cancelAt);
            if (!end && plan.stripeSubscriptionId) {
                try {
                    const planSubId = toStripeSubscriptionId(plan.stripeSubscriptionId);
                    if (!planSubId) {
                        return end;
                    }
                    const sub = await stripe.subscriptions.retrieve(planSubId);
                    if (sub?.current_period_end) {
                        end = new Date(sub.current_period_end * 1000);
                    }
                } catch (e) {
                    console.warn("   ⚠ Could not read Stripe subscription for access end:", e.message);
                }
            }
            if (!end) {
                end = addDays(new Date(), 30);
            }
            return end;
        };

        // Standalone spotlight: schedule removal at billing-period end; do not strip visibility immediately.
        if (cancelFeatureOnly) {
            if (!plan.listingId || !plan.collectionName) {
                return res.status(400).json({ error: "Feature cancellation requires a listing-backed plan." });
            }
            const listingRef = await resolveListingDocRef(partnerId, plan.collectionName, plan.listingId);
            if (!listingRef) {
                return res.status(400).json({ error: "Unable to resolve listing for feature cancellation." });
            }
            const listingSnap = await listingRef.get();
            if (!listingSnap.exists) {
                return res.status(400).json({ error: "Listing not found for feature cancellation." });
            }
            const listingData = listingSnap.data() || {};
            linkedFeatureId = listingData.selectedAddon || listingData.featuredPlacement || null;
            const accessEnd = await resolveAccessEndDate();

            await listingRef.set(
                {
                    featureSpotlightCancelPending: true,
                    featureSpotlightAccessEnd: accessEnd,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );

            const featuresRef = partnerRef.collection("featuresCollection");
            let featureDocs = [];
            if (plan.listingId) {
                const byListing = await featuresRef.where("listingId", "==", plan.listingId).where("active", "==", true).get();
                featureDocs = byListing.docs;
            }
            if (featureDocs.length === 0 && linkedFeatureId) {
                const byFeatureId = await featuresRef
                    .where("featureId", "==", linkedFeatureId)
                    .where("active", "==", true)
                    .get();
                featureDocs = byFeatureId.docs;
            }
            for (const fDoc of featureDocs) {
                await fDoc.ref.set(
                    {
                        cancelPending: true,
                        accessThrough: accessEnd,
                        cancelScope: "feature",
                    },
                    { merge: true }
                );
                cancelledFeature = true;
            }
        }

        if (cancelPlan) {
            const planStripeSubId = toStripeSubscriptionId(plan.stripeSubscriptionId);
            if (planStripeSubId) {
                const subscription = await stripe.subscriptions.update(planStripeSubId, {
                    cancel_at_period_end: true,
                });
                stripeCancelAt = subscription.current_period_end;
            }

            await planRef.set({
                cancelAtPeriodEnd: true,
                cancelledAt: new Date(),
                ...(stripeCancelAt
                    ? {
                        billingPeriodEnd: new Date(stripeCancelAt * 1000),
                        cancelAt: new Date(stripeCancelAt * 1000),
                    }
                    : {
                        active: false,
                        cancelAt: new Date(),
                    }),
            }, { merge: true });

            // Remove included spotlight visibility immediately when listing plan is cancelled.
            const includedSpotlight = PLANS_WITH_INCLUDED_SPOTLIGHT[plan.planId] || null;
            if (includedSpotlight && plan.listingId && plan.collectionName) {
                const listingRef = await resolveListingDocRef(partnerId, plan.collectionName, plan.listingId);
                if (listingRef) {
                    const listingSnap = await listingRef.get();
                    if (listingSnap.exists) {
                        const listingData = listingSnap.data() || {};
                        const currentSpotlight = String(
                            listingData.selectedAddon || listingData.featuredPlacement || ""
                        ).trim();
                        if (!currentSpotlight || currentSpotlight === includedSpotlight) {
                            await listingRef.set({
                                selectedAddon: admin.firestore.FieldValue.delete(),
                                featuredPlacement: admin.firestore.FieldValue.delete(),
                                isFeatured: false,
                                featureSpotlightCancelPending: admin.firestore.FieldValue.delete(),
                                featureSpotlightAccessEnd: admin.firestore.FieldValue.delete(),
                                featureSpotlightPaidThrough: admin.firestore.FieldValue.delete(),
                                lastFeaturePaymentReceivedAt: admin.firestore.FieldValue.delete(),
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            }, { merge: true });
                        }
                    }
                }
                const includedFeatureDocs = await partnerRef.collection("featuresCollection")
                    .where("listingId", "==", plan.listingId)
                    .where("collectionName", "==", plan.collectionName)
                    .where("source", "==", "included_plan")
                    .where("active", "==", true)
                    .get();
                for (const fDoc of includedFeatureDocs.docs) {
                    await fDoc.ref.set({
                        active: false,
                        cancelPending: false,
                        deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                }
            }
            cancelledPlan = true;
        }

        await logAudit({
            partnerId,
            action: "SUBSCRIPTION_CANCELLED",
            details: `Cancellation processed (${cancelScope}).`,
            category: "billing",
            metadata: {
                cancelScope,
                planDocId,
                subscriptionId: plan.stripeSubscriptionId || null,
                featureId: linkedFeatureId || null,
            },
        });

        res.json({
            success: true,
            cancelledPlan,
            cancelledFeature,
            cancelScope,
            cancelAt: stripeCancelAt,
        });
    } catch (err) {
        console.error("❌ Cancel plan error:", err.message);
        res.status(500).json({ error: err.message || "Failed to process cancellation." });
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

        const subId = toStripeSubscriptionId(subscriptionId);
        if (!subId) {
            return res.status(400).json({ error: "subscriptionId is required" });
        }

        console.log(`🚫 Cancelling subscription: ${subId}`);

        // Cancel at period end (not immediately)
        const subscription = await stripe.subscriptions.update(subId, {
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

        // Retrieve the checkout session from Stripe (expand subscription for spotlight add-on writes)
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ["subscription"],
        });

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        console.log(`   Session status: ${session.status}, payment_status: ${session.payment_status}`);

        // Check that Checkout completed and Stripe recorded payment (subscriptions may use no_payment_required in edge cases).
        const checkoutPaid =
            session.status === "complete" &&
            ["paid", "no_payment_required"].includes(session.payment_status);
        if (!checkoutPaid) {
            return res.json({
                success: false,
                message: "Payment not completed",
                status: session.status,
                paymentStatus: session.payment_status
            });
        }

        const { planId, group, listingId, collectionName, featureId } = session.metadata || {};
        const partnerId =
            (session.metadata?.partnerId && String(session.metadata.partnerId).trim()) ||
            (session.client_reference_id && String(session.client_reference_id).trim()) ||
            null;
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

        if (session.metadata?.jobListingPlanUpgrade === "true") {
            if (!partnerRef || !partnerId) {
                return res.status(400).json({ error: "Missing partner for job plan upgrade verification." });
            }
            const upgradeListingId = session.metadata?.listingId || listingId;
            const upgradeCollectionName = collectionName || resolvedCollectionName;
            const fromPlanId = session.metadata?.fromPlanId || "";
            const toPlanId = session.metadata?.toPlanId || session.metadata?.planId || "";
            if (!upgradeListingId || !upgradeCollectionName || !toPlanId) {
                return res.status(400).json({ error: "Job upgrade verification metadata is incomplete." });
            }
            await finalizeJobListingPlanUpgradeWrites({
                session,
                partnerId,
                partnerRef,
                listingId: upgradeListingId,
                collectionName: upgradeCollectionName,
                fromPlanId,
                toPlanId,
                group: session.metadata?.group || "jobs",
            });
            return res.json({
                success: true,
                updated: true,
                jobUpgrade: true,
                status: session.status,
                paymentStatus: session.payment_status,
            });
        }

        if (session.metadata?.featureUpgradeFlow === "true") {
            const upgradeFeatureId = session.metadata?.featureId;
            const upgradeListingId = session.metadata?.listingId || listingId;
            const upgradeCollectionName = session.metadata?.collectionName || resolvedCollectionName;
            if (!partnerRef || !partnerId || !upgradeFeatureId || !upgradeListingId || !upgradeCollectionName) {
                return res.status(400).json({ error: "Feature upgrade verification metadata is incomplete." });
            }
            await finalizeFeatureUpgradeAfterPayment({
                session,
                partnerId,
                partnerRef,
                featureId: upgradeFeatureId,
                listingId: upgradeListingId,
                collectionName: upgradeCollectionName,
                group: session.metadata?.group || group || null,
            });
            await logAudit({
                partnerId,
                action: "FEATURE_UPGRADED",
                details: `Spotlight upgraded to ${upgradeFeatureId.replace(/_/g, " ")}.`,
                category: "listing",
                metadata: {
                    featureId: upgradeFeatureId,
                    previousFeatureId: session.metadata?.previousFeatureId || null,
                    sessionId: session.id,
                    verifyFallback: true,
                },
            });
            const existingFeatureUpgradeTxn = await db.collection("transactionsCollection")
                .where("sessionId", "==", session.id)
                .limit(1)
                .get();
            if (existingFeatureUpgradeTxn.empty) {
                let detailSource = null;
                const listingRef = await resolveListingDocRef(partnerId, upgradeCollectionName, upgradeListingId);
                if (listingRef) {
                    const listingSnap = await listingRef.get();
                    if (listingSnap.exists) detailSource = listingSnap.data();
                }
                await db.collection("transactionsCollection").add({
                    partnerId,
                    amount: (session.amount_total || 0) / 100,
                    currency: session.currency || "usd",
                    status: "succeeded",
                    type: "feature",
                    featureId: upgradeFeatureId,
                    group: session.metadata?.group || group || null,
                    listingId: upgradeListingId,
                    collectionName: upgradeCollectionName,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    sessionId: session.id,
                    customerEmail: session.customer_details?.email || "",
                    businessName: detailSource?.businessName || detailSource?.eventName || "",
                });
            }
            return res.json({
                success: true,
                updated: true,
                featureUpgradeProcessed: true,
                status: session.status,
                paymentStatus: session.payment_status,
            });
        }

        const isUpgradeFlow = session.metadata?.upgradeFlow === "true" || Boolean(session.metadata?.newPriceId && session.metadata?.subscriptionId);

        if (isUpgradeFlow) {
            const {
                subscriptionId: upgradeSubscriptionId,
                subscriptionItemId,
                newPriceId,
                newPlanId,
                listingId: upgradeListingId,
                collectionName: upgradeCollectionName,
            } = session.metadata || {};

            const upgradeSubId = toStripeSubscriptionId(upgradeSubscriptionId);
            if (!upgradeSubId || !newPriceId || !newPlanId || !partnerId) {
                return res.status(400).json({ error: "Upgrade verification metadata is incomplete." });
            }

            const currentSubscription = await stripe.subscriptions.retrieve(upgradeSubId);
            const currentItem = currentSubscription.items?.data?.[0];
            const alreadyUpgraded = currentItem?.price?.id === newPriceId;
            const itemIdToUpdate = subscriptionItemId || currentItem?.id;
            if (!alreadyUpgraded && !itemIdToUpdate) {
                return res.status(400).json({ error: "Unable to resolve subscription item for upgrade verification." });
            }
            const upgradedSubscription = alreadyUpgraded
                ? currentSubscription
                : await stripe.subscriptions.update(upgradeSubId, {
                    items: [{ id: itemIdToUpdate, price: newPriceId }],
                    proration_behavior: "none",
                    metadata: {
                        partnerId,
                        planId: newPlanId,
                        listingId: upgradeListingId || "",
                        collectionName: upgradeCollectionName || "",
                    },
                });

            if (upgradeListingId && upgradeCollectionName) {
                const listingRef = await resolveListingDocRef(partnerId, upgradeCollectionName, upgradeListingId);
                if (listingRef) {
                    const includedSpotlight = PLANS_WITH_INCLUDED_SPOTLIGHT[newPlanId] || null;
                    const pendingEventDates = await resolveEventDatesAfterPlanUpgrade({
                        metadata: session.metadata,
                        listingRef,
                        newPlanId,
                    });
                    const listingUpgradePatch = {
                        selectedPlan: newPlanId,
                        stripeSubscriptionId: upgradedSubscription.id,
                        stripeCustomerId: toStripeCustomerId(upgradedSubscription.customer),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        pendingUpgradeEventDates: admin.firestore.FieldValue.delete(),
                        ...(pendingEventDates || {}),
                    };
                    if (includedSpotlight) {
                        listingUpgradePatch.selectedAddon = includedSpotlight;
                        listingUpgradePatch.featuredPlacement = includedSpotlight;
                        listingUpgradePatch.isFeatured = true;
                        listingUpgradePatch.lastFeaturePaymentReceivedAt = admin.firestore.FieldValue.serverTimestamp();
                        if (upgradedSubscription.current_period_end) {
                            listingUpgradePatch.featureSpotlightPaidThrough = new Date(
                                upgradedSubscription.current_period_end * 1000
                            );
                        }
                    }
                    await listingRef.set(listingUpgradePatch, { merge: true });
                    if (includedSpotlight) {
                        await upsertIncludedPlanFeature(partnerRef, {
                            featureId: includedSpotlight,
                            listingId: upgradeListingId,
                            collectionName: upgradeCollectionName,
                            planId: newPlanId,
                            sessionId: session.id,
                            accessThrough: upgradedSubscription.current_period_end
                                ? new Date(upgradedSubscription.current_period_end * 1000)
                                : null,
                        });
                        await deactivateSupersededPartnerFeatures(partnerRef, upgradeListingId, includedSpotlight);
                    }
                    updated = true;
                }
            }

            const planByListingSnap = await db.collection("partnersCollection")
                .doc(partnerId)
                .collection("planCollection")
                .where("listingId", "==", (upgradeListingId || null))
                .limit(3)
                .get();
            const planDocToUpdate = planByListingSnap.docs.find((doc) => {
                const data = doc.data() || {};
                if (data.stripeSubscriptionId) {
                    return toStripeSubscriptionId(data.stripeSubscriptionId) === upgradeSubId;
                }
                return true;
            }) || planByListingSnap.docs[0];
            if (planDocToUpdate) {
                await planDocToUpdate.ref.set({
                    planId: newPlanId,
                    planName: newPlanId.replace(/_/g, " "),
                    billingPeriodEnd: upgradedSubscription.current_period_end
                        ? new Date(upgradedSubscription.current_period_end * 1000)
                        : admin.firestore.FieldValue.delete(),
                    upgradedAt: new Date(),
                    stripeSubscriptionId: upgradedSubscription.id,
                        stripeCustomerId: toStripeCustomerId(upgradedSubscription.customer),
                    cancelAtPeriodEnd: false,
                    cancelAt: admin.firestore.FieldValue.delete(),
                }, { merge: true });
                updated = true;
            }

            await logAudit({
                partnerId,
                action: "PLAN_UPGRADED",
                details: `Plan upgraded to ${newPlanId.replace(/_/g, " ")}.`,
                category: "billing",
                metadata: {
                    subscriptionId: upgradedSubscription.id,
                    sessionId: session.id,
                    planId: newPlanId,
                    verifyFallback: true,
                },
            });

            const upgradeTxnVerify = await createUpgradeTransactionIfMissing({
                session,
                partnerId,
                newPlanId,
                listingId: upgradeListingId,
                collectionName: upgradeCollectionName,
                group,
            });
            if (upgradeTxnVerify.created) {
                console.log(`   ✓ Upgrade transaction recorded via verify-payment (${session.id})`);
            } else {
                console.log(`   ℹ verify-payment upgrade transaction: ${upgradeTxnVerify.reason}`);
            }

            return res.json({
                success: true,
                updated,
                upgradeProcessed: true,
                status: session.status,
                paymentStatus: session.payment_status,
            });
        }

        if (featureId) {
            if (!partnerRef) {
                return res.status(400).json({ error: "Missing partner for feature verification." });
            }
            await finalizeSpotlightAddonPurchaseWrites({
                session,
                partnerId,
                partnerRef,
                featureId,
                listingId,
                resolvedCollectionName,
                group: group || null,
            });
            if (listingId && resolvedCollectionName) {
                const listingRef = await resolveListingDocRef(partnerId, resolvedCollectionName, listingId);
                if (listingRef) {
                    const listingSnap = await listingRef.get();
                    if (listingSnap.exists) {
                        listingData = listingSnap.data();
                        detailSource = listingData;
                    }
                }
            }
            updated = true;
            console.log(`   ✓ Spotlight add-on verified for session ${session.id}`);
        } else if (listingId && resolvedCollectionName) {
            // Check current listing status
            const listingRef = await resolveListingDocRef(partnerId, resolvedCollectionName, listingId);
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
                    stripeSubscriptionId: toStripeSubscriptionId(session.subscription),
                    stripeCustomerId: toStripeCustomerId(session.customer),
                });
                updated = true;
                console.log(`   ✓ Listing ${listingId} updated to status: Approved`);

                // Calculate billing period (same rules as events / other monthly listing plans)
                const startDate = new Date();
                const isYearly = planId?.includes("_yr");
                const billingPeriodEnd = new Date(startDate);
                if (isYearly) {
                    billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
                } else {
                    billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
                }
                const spotlightPaidThrough = billingPeriodEnd;

                const includedSpotlight = PLANS_WITH_INCLUDED_SPOTLIGHT[planId] || null;
                if (includedSpotlight) {
                    await listingRef.set({
                        selectedAddon: includedSpotlight,
                        featuredPlacement: includedSpotlight,
                        isFeatured: true,
                        lastFeaturePaymentReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                        featureSpotlightPaidThrough: spotlightPaidThrough,
                    }, { merge: true });
                    await upsertIncludedPlanFeature(partnerRef, {
                        featureId: includedSpotlight,
                        listingId,
                        collectionName: resolvedCollectionName,
                        planId,
                        sessionId: session.id,
                        accessThrough: spotlightPaidThrough,
                    });
                    await deactivateSupersededPartnerFeatures(partnerRef, listingId, includedSpotlight);
                    updated = true;
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
                        stripeSubscriptionId: toStripeSubscriptionId(session.subscription),
                        stripeCustomerId: toStripeCustomerId(session.customer),
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
                    stripeSubscriptionId: toStripeSubscriptionId(session.subscription),
                    stripeCustomerId: toStripeCustomerId(session.customer),
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

/**
 * POST /api/backfill-upgrade-transactions
 * Scans paid Stripe upgrade checkout sessions and inserts missing transactionsCollection records.
 * Body: { daysBack?: number, limit?: number }
 */
app.post("/api/backfill-upgrade-transactions", async (req, res) => {
    try {
        const daysBackRaw = Number(req.body?.daysBack);
        const limitRaw = Number(req.body?.limit);
        const daysBack = Number.isFinite(daysBackRaw) && daysBackRaw > 0 ? Math.min(Math.floor(daysBackRaw), 3650) : 365;
        const maxToScan = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 5000) : 1000;
        const createdGteSeconds = Math.floor(Date.now() / 1000) - (daysBack * 24 * 60 * 60);

        let scanned = 0;
        let matchedUpgradeSessions = 0;
        let inserted = 0;
        let alreadyPresent = 0;
        let skippedMissingContext = 0;
        let lastSessionId = null;

        while (scanned < maxToScan) {
            const pageLimit = Math.min(100, maxToScan - scanned);
            const page = await stripe.checkout.sessions.list({
                limit: pageLimit,
                ...(lastSessionId ? { starting_after: lastSessionId } : {}),
                created: { gte: createdGteSeconds },
            });

            const sessions = page.data || [];
            if (sessions.length === 0) break;

            for (const session of sessions) {
                scanned += 1;
                lastSessionId = session.id;

                const isUpgrade = session.metadata?.upgradeFlow === "true";
                const paid = session.payment_status === "paid" || session.status === "complete";
                if (!isUpgrade || !paid) continue;

                matchedUpgradeSessions += 1;
                const result = await createUpgradeTransactionIfMissing({
                    session,
                    partnerId: session.metadata?.partnerId || null,
                    newPlanId: session.metadata?.newPlanId || session.metadata?.planId || null,
                    listingId: session.metadata?.listingId || null,
                    collectionName: session.metadata?.collectionName || null,
                    group: session.metadata?.group || null,
                });

                if (result.created) inserted += 1;
                else if (result.reason === "exists") alreadyPresent += 1;
                else skippedMissingContext += 1;
            }

            if (!page.has_more) break;
        }

        return res.json({
            success: true,
            daysBack,
            maxToScan,
            scanned,
            matchedUpgradeSessions,
            inserted,
            alreadyPresent,
            skippedMissingContext,
        });
    } catch (err) {
        console.error("❌ Backfill upgrade transactions error:", err.message);
        return res.status(500).json({ error: err.message || "Backfill failed." });
    }
});

// ─── Admin Partner Creation ───
app.post("/api/admin/create-partner", async (req, res) => {
    try {
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).json({ error: "Unauthorized" });

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const adminDoc = await db.collection("adminCollection").doc(decodedToken.uid).get();
        if (!adminDoc.exists) return res.status(403).json({ error: "Forbidden: Admins only" });

        const {
            firstName,
            lastName,
            email,
            phone,
            altContactName,
            altEmail,
            password,
            companyName,
            companyWebsite,
            businessPhone,
            linkedinProfile,
            profileHtml,
            addressHtml,
            status,
            selectedGroup,
            selectedPlan,
            featuredPlan,
            trialPeriod
        } = req.body;

        if (!email || !password || !firstName || !companyName) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`.trim(),
            emailVerified: true
        });

        const uid = userRecord.uid;

        // Create member doc
        await db.collection("membersCollection").doc(uid).set({
            userId: uid,
            email,
            name: `${firstName} ${lastName}`.trim(),
            userName: `${firstName} ${lastName}`.trim().toLowerCase().replace(/\s+/g, ""),
            accountStatus: status === "Inactive" ? "disabled" : "active",
            role: "partner",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Create partner doc
        await db.collection("partnersCollection").doc(uid).set({
            firstName,
            lastName,
            email,
            phone: phone || null,
            altContactName: altContactName || null,
            altEmail: altEmail || null,
            companyName,
            companyWebsite: companyWebsite || null,
            businessPhone: businessPhone || null,
            linkedinProfile: linkedinProfile || null,
            profileHtml: profileHtml || null,
            addressHtml: addressHtml || null,
            status: status || "Pending Review",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdByAdmin: true
        });

        // Handle Plan Selection (Free Grant by Admin)
        if (selectedPlan && selectedPlan !== "none") {
            let collectionName = "businessOfferingsCollection";
            if (selectedGroup === "Consulting Services") collectionName = "consultingServicesCollection";
            else if (selectedGroup === "Events") collectionName = "eventsCollection";
            else if (selectedGroup === "Jobs") collectionName = "jobsCollection";

            // If we are giving them a plan, create the planCollection doc
            const isYearly = selectedPlan.endsWith("_yr");
            const startDate = new Date();
            const billingPeriodEnd = new Date();
            let isTrial = false;

            if (trialPeriod && trialPeriod !== "none") {
                isTrial = true;
                if (trialPeriod === "7_days") billingPeriodEnd.setDate(billingPeriodEnd.getDate() + 7);
                else if (trialPeriod === "30_days") billingPeriodEnd.setDate(billingPeriodEnd.getDate() + 30);
                else if (trialPeriod === "3_months") billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 3);
            } else {
                if (isYearly) billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
                else billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
            }

            await db.collection("partnersCollection").doc(uid).collection("planCollection").add({
                planId: selectedPlan,
                planName: selectedPlan.replace(/_/g, " "),
                startDate,
                billingPeriodEnd,
                billingInterval: isYearly ? "year" : "month",
                active: true,
                lastPaymentReceivedAt: startDate,
                partnerId: uid,
                collectionName,
                source: "admin_granted",
                isTrial: isTrial || false
            });
        }

        // Handle Featured Plan
        if (featuredPlan && featuredPlan !== "none") {
            const startDate = new Date();
            const paidThrough = new Date();
            paidThrough.setMonth(paidThrough.getMonth() + 1); // features are monthly

            await db.collection("partnersCollection").doc(uid).collection("featuresCollection").add({
                featureId: featuredPlan,
                featureName: featuredPlan.replace(/_/g, " "),
                active: true,
                lastPaymentReceived: startDate,
                accessThrough: paidThrough,
                partnerId: uid,
                source: "admin_granted"
            });
        }

        return res.json({ success: true, uid });
    } catch (err) {
        console.error("❌ Add partner error:", err.message);
        return res.status(500).json({ error: err.message || "Failed to create partner." });
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
