/** Draft transactional email copy for community (refine in Firebase/console later). */

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

const templates = {
    account_activation: {
        subject: () => "Activate your Pharmasocii community account",
        text: ({ userName }) =>
            `Welcome to Pharmasocii Community${userName ? ", " + userName : ""}.\n\n` +
            "Please verify your email address using the link we sent separately (Firebase Auth).\n\n" +
            "Once verified, you can create posts, comment, and save discussions.\n",
        html: ({ userName }) =>
            `<p>Welcome to <b>Pharmasocii Community</b>${userName ? ", " + escapeHtml(userName) : ""}.</p>` +
            `<p>Please verify your email using the link in your inbox.</p>`,
    },
    password_reset: {
        subject: () => "Reset your Pharmasocii password",
        text: ({ resetLink }) =>
            `You requested a password reset.\n\nOpen this link to choose a new password:\n${resetLink}\n\nIf you did not request this, ignore this email.\n`,
        html: ({ resetLink }) =>
            `<p>You requested a password reset.</p>` +
            `<p><a href="${resetLink}">Reset your password</a></p>` +
            `<p style="color:#666;font-size:12px">If you did not request this, ignore this email.</p>`,
    },
    spam_strike_1: {
        subject: () => "Community notice: content reported",
        text: ({ userName }) =>
            `Hello${userName ? " " + userName : ""},\n\n` +
            "A post or comment on your account received a spam report. This is your first notice.\n\n" +
            "Please review our community guidelines. Repeated reports may restrict your account.\n",
        html: ({ userName }) =>
            `<p>Hello${userName ? " " + escapeHtml(userName) : ""},</p>` +
            `<p>A post or comment on your account received a <b>spam report</b>. This is your <b>first notice</b>.</p>` +
            `<p>Please review our community guidelines.</p>`,
    },
    spam_strike_2: {
        subject: () => "Community notice: second spam report",
        text: ({ userName }) =>
            `Hello${userName ? " " + userName : ""},\n\n` +
            "Your content received a second spam report. One more active report within this period will temporarily restrict posting for 30 days.\n",
        html: ({ userName }) =>
            `<p>Hello${userName ? " " + escapeHtml(userName) : ""},</p>` +
            `<p>This is your <b>second spam report</b>. One more may trigger a 30-day read-only restriction.</p>`,
    },
    spam_strike_3_account_archived: {
        subject: () => "Your community account is temporarily restricted",
        text: ({ userName, untilDate }) =>
            `Hello${userName ? " " + userName : ""},\n\n` +
            "Your account reached three spam reports and is restricted to view-only access for 30 days.\n" +
            (untilDate ? `Restriction ends around: ${untilDate}\n` : "") +
            "\nYou may still browse the community but cannot post or comment until the restriction lifts.\n",
        html: ({ userName, untilDate }) =>
            `<p>Hello${userName ? " " + escapeHtml(userName) : ""},</p>` +
            `<p>Your account reached <b>three spam reports</b> and is <b>view-only for 30 days</b>.</p>` +
            (untilDate ? `<p>Restriction ends around: ${escapeHtml(untilDate)}</p>` : "") +
            `<p>You can browse but not post or comment until then.</p>`,
    },
    account_reactivated: {
        subject: () => "Your Pharmasocii community access is restored",
        text: ({ userName }) =>
            `Hello${userName ? " " + userName : ""},\n\n` +
            "Your 30-day restriction has ended. You can post and comment again.\n" +
            "Please follow community guidelines to avoid further reports.\n",
        html: ({ userName }) =>
            `<p>Hello${userName ? " " + escapeHtml(userName) : ""},</p>` +
            `<p>Your restriction has ended. You can <b>post and comment</b> again.</p>`,
    },
    admin_content_restored: {
        subject: () => "Your community content was restored",
        text: ({ userName, contentType }) =>
            `Hello${userName ? " " + userName : ""},\n\n` +
            `An administrator restored your ${contentType || "content"} on Pharmasocii Community.\n`,
        html: ({ userName, contentType }) =>
            `<p>Hello${userName ? " " + escapeHtml(userName) : ""},</p>` +
            `<p>An administrator restored your <b>${escapeHtml(contentType || "content")}</b>.</p>`,
    },
    account_on_hold: {
        subject: () => "Your Pharmasocii community account is on hold",
        text: ({ userName, reason }) =>
            `Hello${userName ? " " + userName : ""},\n\n` +
            "An administrator placed your account on hold. You can browse but cannot post or comment.\n" +
            (reason ? `Note: ${reason}\n` : "") +
            "\nContact support if you have questions.\n",
        html: ({ userName, reason }) =>
            `<p>Hello${userName ? " " + escapeHtml(userName) : ""},</p>` +
            `<p>Your account is <b>on hold</b> (view-only).</p>` +
            (reason ? `<p>${escapeHtml(reason)}</p>` : ""),
    },
    account_reenabled: {
        subject: () => "Your Pharmasocii community account is active again",
        text: ({ userName }) =>
            `Hello${userName ? " " + userName : ""},\n\n` +
            "An administrator re-enabled your community account. You can post and comment again.\n",
        html: ({ userName }) =>
            `<p>Hello${userName ? " " + escapeHtml(userName) : ""},</p>` +
            `<p>Your account is <b>active</b> again.</p>`,
    },
    content_archived_spam: {
        subject: () => "Community notice: content archived",
        text: ({ userName, contentType }) =>
            `Hello${userName ? " " + userName : ""},\n\n` +
            `Your ${contentType || "content"} was archived after receiving multiple spam reports.\n` +
            "Contact an administrator if you believe this was a mistake.\n",
        html: ({ userName, contentType }) =>
            `<p>Hello${userName ? " " + escapeHtml(userName) : ""},</p>` +
            `<p>Your ${escapeHtml(contentType || "content")} was <b>archived</b> after spam reports.</p>`,
    },
};

function renderEmail(type, payload = {}) {
    const t = templates[type];
    if (!t) {
        return {
            subject: `[Pharmasocii] ${type}`,
            text: JSON.stringify(payload),
            html: `<pre>${escapeHtml(JSON.stringify(payload))}</pre>`,
        };
    }
    return {
        subject: t.subject(payload),
        text: t.text(payload),
        html: t.html(payload),
    };
}

module.exports = { renderEmail, templates };
