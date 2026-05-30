/**
 * Scheduled cleanup: remove spotlight fields after featureSpotlightAccessEnd.
 * Community: comment counts, spam thresholds, spam-block release.
 * Community-only email testing: onMemberDocumentCreatedVerificationMirror (Firestore) +
 * requestVerificationEmailCc (resend) mirror links to verificationMirrors and optional SMTP
 * to VERIFICATION_CC_EMAIL (comma-separated; default includes simrankaurkanda42@gmail.com and singhamyw@outlook.com).
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
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

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
const { renderEmail } = require("./emailTemplates");

function parseVerificationCcEmails() {
    const raw =
        process.env.VERIFICATION_CC_EMAIL ||
        "simrankaurkanda42@gmail.com,singhamyw@outlook.com";
    return raw
        .split(/[,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
}

const VERIFICATION_CC_EMAILS = parseVerificationCcEmails();
/** Comma-separated CC list for Firestore logs and display. */
const VERIFICATION_CC_EMAIL = VERIFICATION_CC_EMAILS.join(", ");
const COMMUNITY_EMAIL_CC_ALL = process.env.COMMUNITY_EMAIL_CC_ALL === "true";
/** Must be an authorized domain in Firebase Auth (e.g. pharmasocii.firebaseapp.com or localhost). */
const APP_PUBLIC_URL =
    process.env.APP_PUBLIC_URL || "https://pharmasocii.firebaseapp.com";

function escapeHtmlVerification(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Parse SMTP_FROM env (plain email or `Name <email>`) for nodemailer. */
function getNodemailerFrom() {
    const raw = String(process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
    if (!raw) return null;
    const angle = raw.match(/<([^>]+)>/);
    if (angle) {
        const name = raw.replace(/<[^>]+>/, "").trim().replace(/^["']|["']$/g, "") || "Pharmasocii";
        return `"${name}" <${angle[1].trim()}>`;
    }
    return `"Pharmasocii" <${raw}>`;
}

async function archiveAllCommentsForPost(postId) {
    const commentsSnap = await db
        .collection("postsCollection")
        .doc(postId)
        .collection("commentsCollection")
        .get();
    const batch = db.batch();
    let n = 0;
    for (const c of commentsSnap.docs) {
        if (c.data().archived === true) continue;
        batch.update(c.ref, { archived: true, archivedReason: "post_archived" });
        n += 1;
    }
    if (n > 0) await batch.commit();
    return n;
}

async function sendAccountActivationEmail(userId, userEmail, userName, verifyLink, options = {}) {
    const { forceResend = false } = options;
    if (!verifyLink || !userEmail) return { sent: false };

    if (!forceResend && userId) {
        const pending = await db.collection("pendingVerifications").doc(userId).get();
        if (pending.exists() && pending.data()?.activationEmailSentAt) {
            return { sent: false, skipped: "already_sent" };
        }
    }

    try {
        await sendCommunityEmail({
            type: "account_activation",
            toEmail: userEmail,
            payload: { userName, verifyLink },
            link: verifyLink,
        });
        if (userId) {
            await updatePendingVerificationDoc(userId, {
                activationEmailSentAt: FieldValue.serverTimestamp(),
            });
        }
        return { sent: true };
    } catch (mailErr) {
        console.error("sendAccountActivationEmail", userId, userEmail, mailErr);
        return { sent: false, error: mailErr?.message || String(mailErr) };
    }
}

async function sendCommunityEmail({ type, toEmail, payload, link }) {
    if (!toEmail) return;
    const mergedPayload = {
        ...(payload || {}),
        ...(link ? { verifyLink: link, resetLink: link } : {}),
    };
    const { subject, text, html } = renderEmail(type, mergedPayload);
    const ccList = COMMUNITY_EMAIL_CC_ALL ? VERIFICATION_CC_EMAILS : [];
    const ccTo = ccList.length ? VERIFICATION_CC_EMAIL : null;

    await db.collection("emailLogCollection").add({
        type,
        toEmail,
        subject,
        bodyText: text,
        link: link || null,
        payload: payload || {},
        ccTo: ccTo || null,
        createdAt: FieldValue.serverTimestamp(),
    });

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const from = getNodemailerFrom();
    if (!host || !smtpUser || !smtpPass || !from) {
        console.info(`[community-email] SMTP not configured; logged ${type} for ${toEmail}`);
        return;
    }
    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: smtpUser, pass: smtpPass },
    });
    try {
        await transporter.sendMail({
            from,
            to: toEmail,
            ...(ccList.length ? { cc: ccList } : {}),
            subject: ccList.length ? `[CC] ${subject}` : subject,
            text: ccList.length ? `${text}\n\n---\nQA copy to ${ccTo}` : text,
            html: ccList.length
                ? `${html}<hr/><p style="color:#666;font-size:12px">QA copy (CC ${escapeHtmlVerification(ccTo)})</p>`
                : html,
        });
    } catch (mailErr) {
        console.error("[community-email] SMTP send failed", type, toEmail, mailErr);
    }
}

function getVerificationActionCodeSettings() {
    const base = APP_PUBLIC_URL.replace(/\/$/, "");
    return {
        url: `${base}/member/login?verify=1`,
        handleCodeInApp: false,
    };
}

async function generateVerificationLinkForEmail(userEmail) {
    const settings = getVerificationActionCodeSettings();
    try {
        return await admin.auth().generateEmailVerificationLink(userEmail, settings);
    } catch (firstErr) {
        console.warn(
            "generateEmailVerificationLink with actionCodeSettings failed, retrying without settings",
            firstErr?.message || firstErr
        );
        return await admin.auth().generateEmailVerificationLink(userEmail);
    }
}

async function getMemberEmailAndName(userId) {
    const m = await db.collection("membersCollection").doc(userId).get();
    if (!m.exists) return { email: null, userName: null };
    const d = m.data();
    return { email: d.email || null, userName: d.userName || d.name || null };
}

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
        const commentId = event.params.commentId;
        const postSnap = await postRef.get();
        const postAuthor = postSnap.data()?.authorId;
        if (postAuthor && authorId && postAuthor !== authorId) {
            const text = String(data.text || "").slice(0, 200);
            let fromUserName = String(data.userName || "");
            if (!fromUserName) {
                const memberSnap = await db.collection("membersCollection").doc(authorId).get();
                if (memberSnap.exists) {
                    fromUserName =
                        String(memberSnap.data()?.userName || memberSnap.data()?.name || "") ||
                        "A member";
                }
            }
            await db
                .collection("membersCollection")
                .doc(postAuthor)
                .collection("notificationsCollection")
                .add({
                    type: "comment",
                    isRead: false,
                    createdAt: FieldValue.serverTimestamp(),
                    postId,
                    commentId,
                    fromUserId: authorId,
                    fromUserName,
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

        let contentArchived = false;
        let contentTypeLabel = targetType === "post" ? "post" : "comment";

        if (targetType === "post") {
            const pref = db.collection("postsCollection").doc(postId);
            let shouldCascade = false;
            await db.runTransaction(async (tx) => {
                const p = await tx.get(pref);
                if (!p.exists) return;
                const next = (p.data().spamReportCount || 0) + 1;
                const update = { spamReportCount: next };
                if (next >= SPAM_THRESHOLD) {
                    update.archived = true;
                    update.archivedReason = "spam_reports";
                    shouldCascade = true;
                    contentArchived = true;
                }
                tx.update(pref, update);
            });
            if (shouldCascade) await archiveAllCommentsForPost(postId);
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
                    contentArchived = true;
                }
                tx.update(cref, update);
            });
        }

        let newActive = 0;
        let blockedUntil = null;
        const memberRef = db.collection("membersCollection").doc(targetAuthorId);
        await db.runTransaction(async (tx) => {
            const m = await tx.get(memberRef);
            if (!m.exists) return;
            const active = (m.data().spamActiveReportCount || 0) + 1;
            const total = (m.data().spamTotalReportCount || 0) + 1;
            newActive = active;
            const update = {
                spamActiveReportCount: active,
                spamTotalReportCount: total,
            };
            if (active >= SPAM_THRESHOLD) {
                const until = new Date();
                until.setDate(until.getDate() + BLOCK_DAYS);
                blockedUntil = until;
                update.accountStatus = "spam_blocked";
                update.spamBlockUntil = admin.firestore.Timestamp.fromDate(until);
            }
            tx.update(memberRef, update);
        });

        const { email, userName } = await getMemberEmailAndName(targetAuthorId);
        if (email) {
            if (newActive === 1) {
                await sendCommunityEmail({ type: "spam_strike_1", toEmail: email, payload: { userName } });
            } else if (newActive === 2) {
                await sendCommunityEmail({ type: "spam_strike_2", toEmail: email, payload: { userName } });
            } else if (newActive >= SPAM_THRESHOLD) {
                await sendCommunityEmail({
                    type: "spam_strike_3_account_archived",
                    toEmail: email,
                    payload: {
                        userName,
                        untilDate: blockedUntil ? blockedUntil.toLocaleDateString() : null,
                    },
                });
            }
            if (contentArchived) {
                await sendCommunityEmail({
                    type: "content_archived_spam",
                    toEmail: email,
                    payload: { userName, contentType: contentTypeLabel },
                });
            }
        }
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
        for (const docSnap of qs.docs) {
            await docSnap.ref.update({
                accountStatus: "active",
                spamActiveReportCount: 0,
                spamBlockUntil: FieldValue.delete(),
            });
            const { email, userName } = await getMemberEmailAndName(docSnap.id);
            if (email) {
                await sendCommunityEmail({
                    type: "account_reactivated",
                    toEmail: email,
                    payload: { userName },
                });
            }
            n += 1;
        }
        console.log(`releaseExpiredSpamBlocks: released ${n} member(s).`);
    }
);

async function assertAdmin(uid) {
    const a = await db.collection("adminCollection").doc(uid).get();
    if (!a.exists) throw new HttpsError("permission-denied", "Admin only.");
}

exports.adminArchivePost = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
    await assertAdmin(request.auth.uid);
    const { postId, reason } = request.data || {};
    if (!postId) throw new HttpsError("invalid-argument", "postId required.");
    const pref = db.collection("postsCollection").doc(postId);
    const p = await pref.get();
    if (!p.exists) throw new HttpsError("not-found", "Post not found.");
    await pref.update({
        archived: true,
        archivedReason: reason || "admin",
        archivedAt: FieldValue.serverTimestamp(),
    });
    await archiveAllCommentsForPost(postId);
    return { ok: true };
});

exports.adminRestorePost = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
    await assertAdmin(request.auth.uid);
    const { postId } = request.data || {};
    if (!postId) throw new HttpsError("invalid-argument", "postId required.");
    const pref = db.collection("postsCollection").doc(postId);
    const p = await pref.get();
    if (!p.exists) throw new HttpsError("not-found", "Post not found.");
    const authorId = p.data().authorId;
    await pref.update({
        archived: false,
        archivedReason: FieldValue.delete(),
        spamReportCount: 0,
    });
    const { email, userName } = await getMemberEmailAndName(authorId);
    if (email) {
        await sendCommunityEmail({
            type: "admin_content_restored",
            toEmail: email,
            payload: { userName, contentType: "post" },
        });
    }
    return { ok: true };
});

exports.adminRestoreComment = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
    await assertAdmin(request.auth.uid);
    const { postId, commentId } = request.data || {};
    if (!postId || !commentId) throw new HttpsError("invalid-argument", "postId and commentId required.");
    const cref = db.collection("postsCollection").doc(postId).collection("commentsCollection").doc(commentId);
    const c = await cref.get();
    if (!c.exists) throw new HttpsError("not-found", "Comment not found.");
    const authorId = c.data().authorId;
    await cref.update({
        archived: false,
        archivedReason: FieldValue.delete(),
        spamReportCount: 0,
    });
    const { email, userName } = await getMemberEmailAndName(authorId);
    if (email) {
        await sendCommunityEmail({
            type: "admin_content_restored",
            toEmail: email,
            payload: { userName, contentType: "comment" },
        });
    }
    return { ok: true };
});

exports.adminSetMemberStatus = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
    await assertAdmin(request.auth.uid);
    const { userId, status, reason, clearSpamCounters } = request.data || {};
    if (!userId || !status) throw new HttpsError("invalid-argument", "userId and status required.");
    const allowed = ["active", "spam_blocked", "admin_hold"];
    if (!allowed.includes(status)) throw new HttpsError("invalid-argument", "Invalid status.");
    const update = { accountStatus: status };
    if (status === "active") {
        update.spamBlockUntil = FieldValue.delete();
        if (clearSpamCounters) {
            update.spamActiveReportCount = 0;
        }
    } else if (status === "spam_blocked") {
        const until = new Date();
        until.setDate(until.getDate() + BLOCK_DAYS);
        update.spamBlockUntil = admin.firestore.Timestamp.fromDate(until);
    } else if (status === "admin_hold") {
        update.spamBlockUntil = FieldValue.delete();
    }
    if (reason) update.adminHoldReason = reason;
    await db.collection("membersCollection").doc(userId).update(update);

    const { email, userName } = await getMemberEmailAndName(userId);
    if (email) {
        if (status === "admin_hold") {
            await sendCommunityEmail({
                type: "account_on_hold",
                toEmail: email,
                payload: { userName, reason: reason || "" },
            });
        } else if (status === "spam_blocked") {
            const until = update.spamBlockUntil?.toDate?.() || null;
            await sendCommunityEmail({
                type: "spam_strike_3_account_archived",
                toEmail: email,
                payload: {
                    userName,
                    untilDate: until ? until.toLocaleDateString() : null,
                },
            });
        } else if (status === "active") {
            await sendCommunityEmail({
                type: "account_reenabled",
                toEmail: email,
                payload: { userName },
            });
        }
    }
    return { ok: true };
});

exports.mirrorPasswordResetEmail = onCall({ region: "us-central1", cors: true }, async (request) => {
    const email = String(request.data?.email || "").trim().toLowerCase();
    if (!email) throw new HttpsError("invalid-argument", "email required.");
    try {
        const resetLink = await admin.auth().generatePasswordResetLink(email);
        await db.collection("emailLogCollection").add({
            type: "password_reset",
            toEmail: email,
            subject: "Password reset (mirror)",
            bodyText: resetLink,
            link: resetLink,
            createdAt: FieldValue.serverTimestamp(),
            ccTo: VERIFICATION_CC_EMAIL,
        });
        if (COMMUNITY_EMAIL_CC_ALL || process.env.SMTP_HOST) {
            await sendCommunityEmail({
                type: "password_reset",
                toEmail: email,
                payload: { resetLink },
                link: resetLink,
            });
        }
        return { ok: true };
    } catch (e) {
        console.error("mirrorPasswordResetEmail", e);
        return { ok: true, skipped: "user_not_found_or_error" };
    }
});

// --- Email verification: admin queue (pendingVerifications) + link history (verificationMirrors).
// Queue is written immediately on signup; links are attached when Auth allows.

async function syncPendingVerificationRecord({ userId, userEmail, userName, source }) {
    const ref = db.collection("pendingVerifications").doc(userId);
    const existing = await ref.get();
    const payload = {
        userId,
        userEmail,
        userName: userName || null,
        source: source || "unknown",
        status: "awaiting_verification",
        updatedAt: FieldValue.serverTimestamp(),
    };
    if (!existing.exists) {
        payload.createdAt = FieldValue.serverTimestamp();
    }
    await ref.set(payload, { merge: true });
    return ref;
}

async function sendVerificationMirrorSmtp(userEmail, verifyLink) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const from = getNodemailerFrom();
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
    try {
        await transporter.sendMail({
            from,
            to: VERIFICATION_CC_EMAILS,
            subject: `[TEST CC] Email verification for ${userEmail}`,
            text:
                `Testing phase — copy of verification link.\n\nUser: ${userEmail}\n\nLink:\n${verifyLink}\n`,
            html:
                `<p><b>User:</b> ${escapeHtmlVerification(userEmail)}</p>` +
                `<p><a href="${verifyLink}">Open verification link</a></p>` +
                `<p style="color:#666;font-size:12px">Mirror for QA (not the Firebase template email).</p>`,
        });
    } catch (mailErr) {
        console.error("[verification-mirror] SMTP send failed", userEmail, mailErr);
    }
}

const VERIFICATION_MIRROR_REUSE_MS = 15 * 60 * 1000;

async function getRecentVerificationMirrorLink(userEmail) {
    const snap = await db
        .collection("verificationMirrors")
        .where("userEmail", "==", userEmail)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    const createdAt = data.createdAt?.toDate?.();
    if (!data.verifyLink || !createdAt) return null;
    if (Date.now() - createdAt.getTime() > VERIFICATION_MIRROR_REUSE_MS) return null;
    return data.verifyLink;
}

async function recordVerificationMirror(userEmail, verifyLink, source, extra = {}) {
    await db.collection("verificationMirrors").add({
        userEmail,
        userId: extra.userId || null,
        verifyLink,
        source,
        ccTo: VERIFICATION_CC_EMAIL,
        createdAt: FieldValue.serverTimestamp(),
    });
}

function isAuthRateLimitError(err) {
    const msg = String(err?.message || err || "");
    return (
        err?.code === "auth/too-many-requests" ||
        err?.codePrefix === "auth" ||
        msg.includes("TOO_MANY_ATTEMPTS_TRY_LATER") ||
        msg.includes("too-many-requests")
    );
}

async function updatePendingVerificationDoc(userId, fields) {
    await db
        .collection("pendingVerifications")
        .doc(userId)
        .set({ ...fields, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

/** Attach or refresh verification link; always leaves pendingVerifications row for admin. */
async function tryAttachVerificationLink(userId, userEmail, source, options = {}) {
    const { forceNew = false, userName = null, forceResend = false } = options;
    let verifyLink = forceNew ? null : await getRecentVerificationMirrorLink(userEmail);
    let linkError = null;

    if (!verifyLink) {
        try {
            verifyLink = await generateVerificationLinkForEmail(userEmail);
            await recordVerificationMirror(userEmail, verifyLink, source, { userId });
        } catch (err) {
            linkError = err?.message || String(err);
            if (isAuthRateLimitError(err)) {
                verifyLink = await getRecentVerificationMirrorLink(userEmail);
                if (verifyLink) {
                    linkError = null;
                } else {
                    linkError =
                        "Firebase rate limit — wait 15–30 min, then use Generate link in admin.";
                }
            }
        }
    }

    const status = verifyLink ? "link_ready" : "link_unavailable";
    await updatePendingVerificationDoc(userId, {
        userEmail,
        status,
        verifyLink: verifyLink || FieldValue.delete(),
        linkError: linkError || FieldValue.delete(),
    });

    if (verifyLink) {
        await sendVerificationMirrorSmtp(userEmail, verifyLink);
        await sendAccountActivationEmail(userId, userEmail, userName, verifyLink, { forceResend });
    }
    return { verifyLink, linkError, status };
}

async function runVerificationPipeline(userId, userEmail, userName, source, options = {}) {
    await syncPendingVerificationRecord({ userId, userEmail, userName, source });
    return tryAttachVerificationLink(userId, userEmail, source, { ...options, userName });
}

/** Server-side mirror when a community member doc is created. */
exports.onMemberDocumentCreatedVerificationMirror = onDocumentCreated(
    {
        document: "membersCollection/{userId}",
        region: "us-central1",
    },
    async (event) => {
        const userId = event.params.userId;
        const memberData = event.data?.data?.() || {};
        try {
            const userRecord = await admin.auth().getUser(userId);
            if (!userRecord.email || userRecord.emailVerified) return;
            const userName = memberData.userName || memberData.name || null;
            await runVerificationPipeline(
                userId,
                userRecord.email,
                userName,
                "firestore_member_created"
            );
        } catch (e) {
            console.error("onMemberDocumentCreatedVerificationMirror", userId, e?.message || e);
            if (memberData.email) {
                await syncPendingVerificationRecord({
                    userId,
                    userEmail: memberData.email,
                    userName: memberData.userName || memberData.name,
                    source: "firestore_member_created_error",
                }).catch(() => {});
                await updatePendingVerificationDoc(userId, {
                    status: "link_unavailable",
                    linkError: e?.message || String(e),
                }).catch(() => {});
            }
        }
    }
);

/** Member client: ensure admin queue row exists (safe if trigger already ran). */
exports.ensureVerificationPending = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth?.uid || !request.auth.token?.email) {
        throw new HttpsError("unauthenticated", "Sign in required.");
    }
    if (request.auth.token.email_verified) {
        return { ok: true, skipped: "already_verified" };
    }
    const userId = request.auth.uid;
    const email = request.auth.token.email;
    const memberSnap = await db.collection("membersCollection").doc(userId).get();
    if (!memberSnap.exists) {
        throw new HttpsError("failed-precondition", "Community member profile required.");
    }
    const userName = memberSnap.data()?.userName || memberSnap.data()?.name || null;
    const result = await runVerificationPipeline(userId, email, userName, "client_ensure");
    return {
        ok: true,
        hasLink: Boolean(result.verifyLink),
        status: result.status,
        message: result.linkError || null,
    };
});

exports.requestVerificationEmailCc = onCall({ region: "us-central1", cors: true }, async (request) => {
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
    const userName = memberSnap.data()?.userName || memberSnap.data()?.name || null;
    const result = await runVerificationPipeline(
        request.auth.uid,
        email,
        userName,
        "callable_resend",
        { forceResend: true }
    );
    if (!result.verifyLink && result.linkError) {
        return { ok: true, queued: true, status: result.status, message: result.linkError };
    }
    return { ok: true, hasLink: Boolean(result.verifyLink), status: result.status };
});

exports.adminRefreshVerificationLink = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
    await assertAdmin(request.auth.uid);
    const { userId } = request.data || {};
    if (!userId) throw new HttpsError("invalid-argument", "userId required.");
    let userRecord;
    try {
        userRecord = await admin.auth().getUser(userId);
    } catch {
        throw new HttpsError("not-found", "User not found.");
    }
    if (!userRecord.email) throw new HttpsError("failed-precondition", "User has no email.");
    if (userRecord.emailVerified) {
        await updatePendingVerificationDoc(userId, { status: "verified" });
        return { ok: true, skipped: "already_verified" };
    }
    const { userName } = await getMemberEmailAndName(userId);
    const result = await runVerificationPipeline(
        userId,
        userRecord.email,
        userName,
        "admin_refresh",
        { forceNew: true, forceResend: true }
    );
    return {
        ok: true,
        hasLink: Boolean(result.verifyLink),
        status: result.status,
        message: result.linkError || null,
    };
});

/** QA: mark member verified without inbox (mimics user clicking Firebase verify link). */
exports.adminApproveMemberVerification = onCall(
    { region: "us-central1", cors: true },
    async (request) => {
        if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
        await assertAdmin(request.auth.uid);
        const { userId } = request.data || {};
        if (!userId) throw new HttpsError("invalid-argument", "userId required.");
        await admin.auth().updateUser(userId, { emailVerified: true });
        const memberRef = db.collection("membersCollection").doc(userId);
        const memberSnap = await memberRef.get();
        if (memberSnap.exists) {
            await memberRef.update({ emailVerified: true });
        }
        await updatePendingVerificationDoc(userId, {
            status: "admin_approved",
            verifyLink: FieldValue.delete(),
            linkError: FieldValue.delete(),
        });
        return { ok: true };
    }
);
