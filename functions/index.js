/**
 * Scheduled cleanup: remove spotlight fields after featureSpotlightAccessEnd.
 * Community: comment counts, spam thresholds, spam-block release.
 * Deploy: cd functions && npm install && cd .. && firebase deploy --only functions
 *
 * Keep logic aligned with server/cleanupExpiredSpotlights.js (HTTP cron fallback).
 */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
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

const SPAM_THRESHOLD = 3;
const BLOCK_DAYS = 30;

exports.onCommunityCommentCreated = onDocumentCreated(
    {
        document: "postsCollection/{postId}/commentsCollection/{commentId}",
        region: "us-central1",
    },
    async (event) => {
        const postId = event.params.postId;
        const snap = event.data;
        if (!snap) return;
        const data = snap.data();
        const postRef = db.collection("postsCollection").doc(postId);
        await postRef.update({
            commentCount: FieldValue.increment(1),
        });

        const authorId = data.authorId;
        const postSnap = await postRef.get();
        const postAuthor = postSnap.data()?.authorId;
        if (postAuthor && authorId && postAuthor !== authorId) {
            const text = String(data.text || "").slice(0, 200);
            await db
                .collection("membersCollection")
                .doc(postAuthor)
                .collection("notificationsCollection")
                .add({
                    type: "comment",
                    isRead: false,
                    createdAt: FieldValue.serverTimestamp(),
                    postId,
                    fromUserId: authorId,
                    preview: text,
                });
        }
    }
);

exports.onSpamReportCreated = onDocumentCreated(
    {
        document: "spamReportsCollection/{reportId}",
        region: "us-central1",
    },
    async (event) => {
        const snap = event.data;
        if (!snap) return;
        const d = snap.data();
        const targetType = d.targetType;
        const targetKey = d.targetKey;
        const targetAuthorId = d.targetAuthorId;
        const postId = d.postId;

        if (targetType === "post") {
            const pref = db.collection("postsCollection").doc(postId);
            await db.runTransaction(async (tx) => {
                const p = await tx.get(pref);
                if (!p.exists) return;
                const next = (p.data().spamReportCount || 0) + 1;
                const update = { spamReportCount: next };
                if (next >= SPAM_THRESHOLD) {
                    update.archived = true;
                    update.archivedReason = "spam_reports";
                }
                tx.update(pref, update);
            });
        } else if (targetType === "comment") {
            const parts = String(targetKey).split("__");
            const commentId = parts.length >= 2 ? parts[parts.length - 1] : null;
            if (!commentId || !postId) return;
            const cref = db
                .collection("postsCollection")
                .doc(postId)
                .collection("commentsCollection")
                .doc(commentId);
            await db.runTransaction(async (tx) => {
                const c = await tx.get(cref);
                if (!c.exists) return;
                const next = (c.data().spamReportCount || 0) + 1;
                const update = { spamReportCount: next };
                if (next >= SPAM_THRESHOLD) {
                    update.archived = true;
                    update.archivedReason = "spam_reports";
                }
                tx.update(cref, update);
            });
        }

        const memberRef = db.collection("membersCollection").doc(targetAuthorId);
        await db.runTransaction(async (tx) => {
            const m = await tx.get(memberRef);
            if (!m.exists) return;
            const active = (m.data().spamActiveReportCount || 0) + 1;
            const total = (m.data().spamTotalReportCount || 0) + 1;
            const update = {
                spamActiveReportCount: active,
                spamTotalReportCount: total,
            };
            if (active >= SPAM_THRESHOLD) {
                const until = new Date();
                until.setDate(until.getDate() + BLOCK_DAYS);
                update.accountStatus = "spam_blocked";
                update.spamBlockUntil = admin.firestore.Timestamp.fromDate(until);
            }
            tx.update(memberRef, update);
        });
    }
);

exports.releaseExpiredSpamBlocks = onSchedule(
    {
        schedule: "every 24 hours",
        timeZone: "Etc/UTC",
        retryCount: 1,
        region: "us-central1",
    },
    async () => {
        const now = admin.firestore.Timestamp.now();
        const qs = await db
            .collection("membersCollection")
            .where("accountStatus", "==", "spam_blocked")
            .where("spamBlockUntil", "<=", now)
            .get();
        let n = 0;
        for (const doc of qs.docs) {
            await doc.ref.update({
                accountStatus: "active",
                spamActiveReportCount: 0,
                spamBlockUntil: FieldValue.delete(),
            });
            n += 1;
        }
        console.log(`releaseExpiredSpamBlocks: released ${n} member(s).`);
    }
);
