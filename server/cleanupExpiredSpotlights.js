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
        lastFeaturePaymentReceivedAt: fv.delete(),
        updatedAt: fv.serverTimestamp(),
    });

    async function runQuery(collectionId, useCollectionGroup) {
        const base = useCollectionGroup ? db.collectionGroup(collectionId) : db.collection(collectionId);
        const snap = await base
            .where("featureSpotlightCancelPending", "==", true)
            .where("featureSpotlightAccessEnd", "<=", now)
            .get();
        let n = 0;
        for (const doc of snap.docs) {
            await doc.ref.set(listingClearPayload(), { merge: true });
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
