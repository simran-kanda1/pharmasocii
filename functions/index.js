/**
 * Scheduled cleanup: remove spotlight fields after featureSpotlightAccessEnd.
 * Community: comment counts, spam thresholds, spam-block release.
 * Community-only email testing: onMemberDocumentCreatedVerificationMirror (Firestore) +
 * requestVerificationEmailCc (resend) mirror links to verificationMirrors and optional SMTP
 * to VERIFICATION_CC_EMAIL (default simrankaurkanda42@gmail.com).
 *
 * Deploy: cd functions && npm install && cd .. && firebase deploy --only functions,firestore:rules
 *
 * Optional SMTP (Gmail example): set on both functions in Google Cloud Console → Environment variables:
 *   SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_USER=...  SMTP_PASS=app-password  SMTP_FROM=...
 * Optional: VERIFICATION_CC_EMAIL=...
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

// --- Email verification mirror (testing): Firebase Auth cannot CC its own messages.
// Writes the same link to Firestore (admin-readable) and optionally emails SMTP to VERIFICATION_CC_EMAIL.
// Set env on the function in Google Cloud Console: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (optional).
// Override recipient: VERIFICATION_CC_EMAIL
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const nodemailer = require("nodemailer");

const VERIFICATION_CC_EMAIL =
    process.env.VERIFICATION_CC_EMAIL || "simrankaurkanda42@gmail.com";

function escapeHtmlVerification(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendVerificationMirrorSmtp(userEmail, verifyLink) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || smtpUser;
    if (!host || !smtpUser || !smtpPass || !from) {
        console.info(
            `[verification-mirror] SMTP not configured; Firestore mirror only. user=${userEmail}. ` +
                "Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM on the function for Gmail CC."
        );
        return;
    }
    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
        from: `"Pharmasocii (test)" <${from}>`,
        to: VERIFICATION_CC_EMAIL,
        subject: `[TEST CC] Email verification for ${userEmail}`,
        text:
            `Testing phase — copy of verification link.\n\nUser: ${userEmail}\n\nLink:\n${verifyLink}\n`,
        html:
            `<p><b>User:</b> ${escapeHtmlVerification(userEmail)}</p>` +
            `<p><a href="${verifyLink}">Open verification link</a></p>` +
            `<p style="color:#666;font-size:12px">Mirror for QA (not the Firebase template email).</p>`,
    });
}

async function recordVerificationMirror(userEmail, verifyLink, source) {
    await db.collection("verificationMirrors").add({
        userEmail,
        verifyLink,
        source,
        ccTo: VERIFICATION_CC_EMAIL,
        createdAt: FieldValue.serverTimestamp(),
    });
}

async function mirrorVerificationForEmail(userEmail, source) {
    const verifyLink = await admin.auth().generateEmailVerificationLink(userEmail);
    await recordVerificationMirror(userEmail, verifyLink, source);
    try {
        await sendVerificationMirrorSmtp(userEmail, verifyLink);
    } catch (e) {
        console.error("[verification-mirror] SMTP failed", e);
    }
}

/** Server-side mirror when a community member doc is created (no client callable / IAM issues). */
exports.onMemberDocumentCreatedVerificationMirror = onDocumentCreated(
    {
        document: "membersCollection/{userId}",
        region: "us-central1",
    },
    async (event) => {
        const userId = event.params.userId;
        try {
            const userRecord = await admin.auth().getUser(userId);
            if (!userRecord.email || userRecord.emailVerified) return;
            await mirrorVerificationForEmail(userRecord.email, "firestore_member_created");
        } catch (e) {
            console.error("onMemberDocumentCreatedVerificationMirror", userId, e);
        }
    }
);

exports.requestVerificationEmailCc = onCall(
    {
        region: "us-central1",
        cors: true,
    },
    async (request) => {
        if (!request.auth?.token?.email || !request.auth.uid) {
            throw new HttpsError("unauthenticated", "Sign in required.");
        }
        const memberSnap = await db.collection("membersCollection").doc(request.auth.uid).get();
        if (!memberSnap.exists) {
            throw new HttpsError(
                "failed-precondition",
                "Community member profile required (verification mirror is community-only)."
            );
        }
        const email = request.auth.token.email;
        if (request.auth.token.email_verified) {
            return { ok: true, skipped: "already_verified" };
        }
        try {
            await mirrorVerificationForEmail(email, "callable_resend");
            return { ok: true };
        } catch (e) {
            console.error("requestVerificationEmailCc", e);
            throw new HttpsError("internal", "Could not create verification mirror.");
        }
    }
);
