/**
 * Clears spotlight fields after featureSpotlightAccessEnd when cancel is pending.
 * Used by POST /api/cron/cleanup-expired-spotlights — keep payload aligned with functions/index.js.
 */
import admin from "firebase-admin";

export async function cleanupExpiredSpotlights() {
    const db = admin.firestore();
    const fv = admin.firestore.FieldValue;
    const now = admin.firestore.Timestamp.now();

    const listingClearPayload = () => ({
        selectedAddon: fv.delete(),
        featuredPlacement: fv.delete(),
        isFeatured: false,
        featureSpotlightCancelPending: fv.delete(),
        featureSpotlightAccessEnd: fv.delete(),
        featureSpotlightPaidThrough: fv.delete(),
        featureSpotlightBillingPeriodStart: fv.delete(),
        lastFeaturePaymentReceivedAt: fv.delete(),
        // Clear Stripe add-on ids so the dashboard unlocks "Add spotlight" after expiry
        // (subscription.deleted may lag behind the access-end cleanup).
        featureSpotlightStripeSubscriptionId: fv.delete(),
        featureSpotlightSubscriptionItemId: fv.delete(),
        updatedAt: fv.serverTimestamp(),
    });

    async function deactivateFeaturesForListing(listingDoc) {
        const path = listingDoc.ref.path || "";
        // partnersCollection/{partnerId}/businessOfferingsCollection/{id}
        // or top-level eventsCollection/{id} with partnerId field
        let partnerId = null;
        const parts = path.split("/");
        if (parts[0] === "partnersCollection" && parts[1]) {
            partnerId = parts[1];
        } else {
            partnerId = String(listingDoc.data()?.partnerId || "").trim() || null;
        }
        if (!partnerId) return;

        const listingId = listingDoc.id;
        const featSnap = await db
            .collection("partnersCollection")
            .doc(partnerId)
            .collection("featuresCollection")
            .where("listingId", "==", listingId)
            .limit(20)
            .get();
        for (const fDoc of featSnap.docs) {
            const fd = fDoc.data() || {};
            if (fd.source === "included_plan") continue;
            if (fd.active === false) continue;
            await fDoc.ref.set(
                {
                    active: false,
                    cancelPending: fv.delete(),
                    deactivatedAt: fv.serverTimestamp(),
                },
                { merge: true },
            );
        }
    }

    async function runQuery(collectionId, useCollectionGroup) {
        const base = useCollectionGroup ? db.collectionGroup(collectionId) : db.collection(collectionId);
        const snap = await base
            .where("featureSpotlightCancelPending", "==", true)
            .where("featureSpotlightAccessEnd", "<=", now)
            .get();
        let n = 0;
        for (const doc of snap.docs) {
            await doc.ref.set(listingClearPayload(), { merge: true });
            await deactivateFeaturesForListing(doc);
            n += 1;
        }
        return n;
    }

    const top = ["eventsCollection", "jobsCollection", "consultingServicesCollection", "consultingCollection"];
    let total = 0;
    for (const col of top) {
        total += await runQuery(col, false);
    }
    total += await runQuery("businessOfferingsCollection", true);
    return { updated: total };
}
