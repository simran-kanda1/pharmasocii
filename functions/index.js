/**
 * Scheduled cleanup: remove spotlight fields after featureSpotlightAccessEnd.
 * Deploy: cd functions && npm install && cd .. && firebase deploy --only functions
 *
 * Keep logic aligned with server/cleanupExpiredSpotlights.js (HTTP cron fallback).
 */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const listingClearPayload = () => ({
    selectedAddon: FieldValue.delete(),
    featuredPlacement: FieldValue.delete(),
    isFeatured: false,
    featureSpotlightCancelPending: FieldValue.delete(),
    featureSpotlightAccessEnd: FieldValue.delete(),
    featureSpotlightPaidThrough: FieldValue.delete(),
    lastFeaturePaymentReceivedAt: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
});

async function cleanupCollectionGroup(collectionId, useCollectionGroup) {
    const now = admin.firestore.Timestamp.now();
    let snap;
    if (useCollectionGroup) {
        snap = await db
            .collectionGroup(collectionId)
            .where("featureSpotlightCancelPending", "==", true)
            .where("featureSpotlightAccessEnd", "<=", now)
            .get();
    } else {
        snap = await db
            .collection(collectionId)
            .where("featureSpotlightCancelPending", "==", true)
            .where("featureSpotlightAccessEnd", "<=", now)
            .get();
    }
    let n = 0;
    for (const doc of snap.docs) {
        await doc.ref.set(listingClearPayload(), { merge: true });
        n += 1;
    }
    return n;
}

async function runCleanup() {
    const top = ["eventsCollection", "jobsCollection", "consultingServicesCollection", "consultingCollection"];
    let total = 0;
    for (const col of top) {
        total += await cleanupCollectionGroup(col, false);
    }
    total += await cleanupCollectionGroup("businessOfferingsCollection", true);
    console.log(`cleanupExpiredSpotlights: updated ${total} listing(s).`);
    return total;
}

exports.cleanupExpiredSpotlights = onSchedule(
    {
        schedule: "every 60 minutes",
        timeZone: "Etc/UTC",
        retryCount: 1,
    },
    async () => {
        await runCleanup();
    }
);
