/**
 * Deactivates listings whose backing plan is no longer billing-live (cancelled / expired).
 * Used by POST /api/cron/cleanup-expired-listings.
 */
import admin from "firebase-admin";

function toDateValue(value) {
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
}

function isFirestorePlanBillingLive(plan) {
    if (plan?.active === false) return false;
    const end = toDateValue(plan?.billingPeriodEnd) || toDateValue(plan?.cancelAt);
    if (end && end.getTime() < Date.now()) return false;
    return true;
}

function partnerIdFromPartnersPlanRef(ref) {
    const parts = String(ref?.path || "").split("/");
    if (parts[0] === "partnersCollection" && parts[2] === "planCollection") return parts[1] || null;
    return null;
}

function getListingDocRef(db, partnerId, collectionName, listingId) {
    if (!collectionName || !listingId) return null;
    if (collectionName === "businessOfferingsCollection") {
        if (!partnerId) return null;
        return db.collection("partnersCollection").doc(partnerId).collection(collectionName).doc(listingId);
    }
    return db.collection(collectionName).doc(listingId);
}

async function resolveListingDocRef(db, partnerId, collectionName, listingId) {
    const canonicalRef = getListingDocRef(db, partnerId, collectionName, listingId);
    if (!canonicalRef) return null;

    const canonicalSnap = await canonicalRef.get();
    if (canonicalSnap.exists) return canonicalRef;

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

const STRIPE_LIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

async function stripeSubscriptionStillLive(stripe, subscriptionId) {
    if (!stripe || !subscriptionId) return false;
    try {
        const sub = await stripe.subscriptions.retrieve(String(subscriptionId));
        return STRIPE_LIVE_SUBSCRIPTION_STATUSES.has(String(sub?.status || "").toLowerCase());
    } catch {
        return false;
    }
}

export async function cleanupExpiredListings(options = {}) {
    const { stripe = null } = options;
    const db = admin.firestore();
    const fv = admin.firestore.FieldValue;
    const listingUpdateOnEnd = {
        active: false,
        status: "Cancelled",
        updatedAt: fv.serverTimestamp(),
    };

    let updatedListings = 0;
    let updatedPlans = 0;

    const plansSnap = await db.collectionGroup("planCollection").get();

    for (const planDoc of plansSnap.docs) {
        const plan = planDoc.data() || {};
        if (isFirestorePlanBillingLive(plan)) continue;

        const stripeSubId = plan.stripeSubscriptionId;
        if (stripe && stripeSubId && (await stripeSubscriptionStillLive(stripe, stripeSubId))) {
            continue;
        }

        const partnerId = partnerIdFromPartnersPlanRef(planDoc.ref);
        const listingId = plan.listingId;
        const collectionName = plan.collectionName;
        if (!partnerId || !listingId || !collectionName) continue;

        if (plan.active !== false || !plan.expiredAt) {
            await planDoc.ref.set(
                {
                    active: false,
                    expiredAt: fv.serverTimestamp(),
                },
                { merge: true },
            );
            updatedPlans += 1;
        }

        const listingRef = await resolveListingDocRef(db, partnerId, collectionName, listingId);
        if (!listingRef) continue;

        const listingSnap = await listingRef.get();
        if (!listingSnap.exists) continue;

        const listingData = listingSnap.data() || {};
        if (listingData.active === false && String(listingData.status || "").toLowerCase() === "cancelled") {
            continue;
        }

        await listingRef.set(listingUpdateOnEnd, { merge: true });
        updatedListings += 1;
    }

    return { updatedListings, updatedPlans };
}
