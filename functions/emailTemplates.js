/** Transactional email templates (SMTP + emailLogCollection). Plain text-first HTML. */

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function firstNameFrom(payload = {}) {
    const fn = String(payload.firstName || "").trim();
    if (fn) return fn;
    const name = String(payload.name || payload.userName || "").trim();
    if (!name) return "there";
    if (name.includes(" ")) return name.split(/\s+/)[0];
    return name;
}

const NO_REPLY_TEXT =
    "\n\nThis is a no-reply email. Please use the Contact Us page for support.";
const NO_REPLY_HTML =
    '<p style="color:#555;font-size:13px;margin-top:28px">This is a no-reply email. Please use the Contact Us page for support.</p>';

/** Minimal HTML — readable in any client, no marketing layout. */
function wrapHtml(bodyHtml) {
    return (
        `<!DOCTYPE html><html><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>Pharma SocII</title></head>` +
        `<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111;background:#fff">` +
        `<div style="max-width:560px">` +
        `<p style="margin:0 0 20px;font-size:15px"><strong>Pharma SocII</strong></p>` +
        `${bodyHtml}${NO_REPLY_HTML}` +
        `</div></body></html>`
    );
}

function wrapText(bodyText) {
    return `Pharma SocII\n\n${bodyText}${NO_REPLY_TEXT}`;
}

function ctaButton(href, label) {
    if (!href) return "";
    return (
        `<p style="margin:20px 0"><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></p>` +
        `<p style="word-break:break-all;font-size:13px;color:#555;margin:0">Or copy this link:<br/>${escapeHtml(href)}</p>`
    );
}

function linkLine(siteUrl) {
    const url = String(siteUrl || "").trim();
    if (!url) return { text: "", html: "" };
    return {
        text: `\n\n${url}`,
        html: `<p style="margin:16px 0 0"><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
    };
}

const templates = {
    partner_welcome: {
        subject: () => "Welcome to Pharma SocII",
        text: (payload) => {
            const site = linkLine(payload.siteUrl);
            return wrapText(
                "We've received your submission. Thank you for partnering with us.\n\n" +
                    "Pharma SocII Team" +
                    site.text,
            );
        },
        html: (payload) => {
            const site = linkLine(payload.siteUrl);
            return wrapHtml(
                `<p>We've received your submission. Thank you for partnering with us.</p>` +
                    `<p>Pharma SocII Team</p>` +
                    site.html,
            );
        },
    },
    partner_account_updated: {
        subject: () => "Your company profile was updated",
        text: (payload) => {
            const site = linkLine(payload.siteUrl);
            return wrapText(
                "Updates were made to your company profile on Pharma SocII " +
                    "(for example company name or website).\n\n" +
                    "Please sign in to review your profile. If you did not make these changes, " +
                    "update your password and contact support.\n\n" +
                    "Pharma SocII Team" +
                    site.text,
            );
        },
        html: (payload) => {
            const site = linkLine(payload.siteUrl);
            return wrapHtml(
                `<p>Updates were made to your company profile on Pharma SocII ` +
                    `(for example company name or website).</p>` +
                    `<p>Please sign in to review your profile. If you did not make these changes, ` +
                    `update your password and contact support.</p>` +
                    `<p>Pharma SocII Team</p>` +
                    site.html,
            );
        },
    },
    partner_plan_changed: {
        subject: () => "Your Pharma SocII plan was updated",
        text: (payload) => {
            const site = linkLine(payload.siteUrl);
            return wrapText(
                "Changes to your plan have been processed successfully. Thank you for your continued partnership.\n\n" +
                    "Pharma SocII Team" +
                    site.text,
            );
        },
        html: (payload) => {
            const site = linkLine(payload.siteUrl);
            return wrapHtml(
                `<p>Changes to your plan have been processed successfully. Thank you for your continued partnership.</p>` +
                    `<p>Pharma SocII Team</p>` +
                    site.html,
            );
        },
    },
    partner_email_verification: {
        subject: () => "Verify your new email address",
        text: (payload) => {
            const site = linkLine(payload.siteUrl);
            let body =
                "Please verify your new email address for Pharma SocII. Use the link below to confirm.\n\n";
            if (payload.verifyLink) body += `${payload.verifyLink}\n\n`;
            body += "Pharma SocII Team" + site.text;
            return wrapText(body);
        },
        html: (payload) => {
            const site = linkLine(payload.siteUrl);
            return wrapHtml(
                `<p>Please verify your new email address for Pharma SocII. Use the link below to confirm.</p>` +
                    ctaButton(payload.verifyLink, "Verify email") +
                    `<p>Pharma SocII Team</p>` +
                    site.html,
            );
        },
    },
    account_activation: {
        subject: () => "Activate your Pharma SocII account",
        text: ({ verifyLink }) => {
            let body =
                "Please use the link below to activate your Pharma SocII account.\n" +
                "Once activated, you can post and comment in the community.\n\n";
            if (verifyLink) body += `${verifyLink}\n\n`;
            body += "Pharma SocII Team";
            return wrapText(body);
        },
        html: ({ verifyLink }) => {
            return wrapHtml(
                `<p>Please use the link below to activate your Pharma SocII account. ` +
                    `Once activated, you can post and comment in the community.</p>` +
                    ctaButton(verifyLink, "Activate account") +
                    `<p>Pharma SocII Team</p>`,
            );
        },
    },
    password_reset: {
        subject: () => "Reset your Pharma SocII password",
        text: ({ resetLink }) => {
            return wrapText(
                "We received a request to reset the password for your Pharma SocII account.\n\n" +
                    "Create a new password using this link:\n\n" +
                    `${resetLink || "[Reset Password]"}\n\n` +
                    "If you did not request this, you can ignore this email.\n" +
                    "For security, this link expires after a limited time.\n\n" +
                    "Pharma SocII Team",
            );
        },
        html: ({ resetLink }) => {
            return wrapHtml(
                `<p>We received a request to reset the password for your Pharma SocII account.</p>` +
                    `<p>Create a new password using this link:</p>` +
                    (resetLink ? ctaButton(resetLink, "Reset password") : `<p>[Reset Password]</p>`) +
                    `<p>If you did not request this, you can ignore this email.</p>` +
                    `<p>For security, this link expires after a limited time.</p>` +
                    `<p>Pharma SocII Team</p>`,
            );
        },
    },
    password_changed: {
        subject: () => "Your Pharma SocII password was changed",
        text: (payload) => {
            const site = linkLine(payload.siteUrl);
            return wrapText(
                "Your Pharma SocII password was changed successfully.\n\n" +
                    "If you did not make this change, reset your password immediately and contact support.\n\n" +
                    "Pharma SocII Team" +
                    site.text,
            );
        },
        html: (payload) => {
            const site = linkLine(payload.siteUrl);
            return wrapHtml(
                `<p>Your Pharma SocII password was changed successfully.</p>` +
                    `<p>If you did not make this change, reset your password immediately and contact support.</p>` +
                    `<p>Pharma SocII Team</p>` +
                    site.html,
            );
        },
    },
    spam_strike_1: {
        subject: () => "Notice of reported content (1st report)",
        text: () => {
            return wrapText(
                "One of your recent posts or comments on the Pharma SocII Community was reported by a member.\n\n" +
                    "No action has been taken against your account. This notice is so you can review your content " +
                    "against our Community Guidelines.\n\n" +
                    "What happens next:\n" +
                    "- A post or comment is removed after three reports on that item.\n" +
                    "- An account is paused after three total reports across posts or comments.\n\n" +
                    "Thank you for helping keep the community professional.\n\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: () => {
            return wrapHtml(
                `<p>One of your recent posts or comments on the Pharma SocII Community was reported by a member.</p>` +
                    `<p>No action has been taken against your account. This notice is so you can review your content ` +
                    `against our Community Guidelines.</p>` +
                    `<p><b>What happens next:</b></p>` +
                    `<ul>` +
                    `<li>A post or comment is removed after three reports on that item.</li>` +
                    `<li>An account is paused after three total reports across posts or comments.</li>` +
                    `</ul>` +
                    `<p>Thank you for helping keep the community professional.</p>` +
                    `<p>Pharma SocII Community Team</p>`,
            );
        },
    },
    spam_strike_2: {
        subject: () => "Second notice regarding reported content",
        text: () => {
            return wrapText(
                "This is a follow-up about your recent post or comment on the Pharma SocII Community.\n\n" +
                    "Your content has now been reported twice.\n\n" +
                    "Reminder:\n" +
                    "- A post or comment is removed after three reports on that item.\n" +
                    "- An account is paused after three total reports across posts or comments.\n\n" +
                    "Please review our Community Guidelines.\n\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: () => {
            return wrapHtml(
                `<p>This is a follow-up about your recent post or comment on the Pharma SocII Community.</p>` +
                    `<p>Your content has now been reported twice.</p>` +
                    `<p><b>Reminder:</b></p>` +
                    `<ul>` +
                    `<li>A post or comment is removed after three reports on that item.</li>` +
                    `<li>An account is paused after three total reports across posts or comments.</li>` +
                    `</ul>` +
                    `<p>Please review our Community Guidelines.</p>` +
                    `<p>Pharma SocII Community Team</p>`,
            );
        },
    },
    spam_strike_3_account_archived: {
        subject: () => "Community guidelines notice: account status update",
        text: () => {
            return wrapText(
                "Your Pharma SocII Community account has accumulated three total reports across posts and/or comments.\n\n" +
                    "In accordance with our Community Guidelines, if your account is active it will be placed in " +
                    "read-only mode for 30 days. You can still view content; posting and commenting will be unavailable " +
                    "until reactivation.\n\n" +
                    "Please review our Community Guidelines.\n\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: () => {
            return wrapHtml(
                `<p>Your Pharma SocII Community account has accumulated three total reports across posts and/or comments.</p>` +
                    `<p>In accordance with our Community Guidelines, if your account is active it will be placed in ` +
                    `<b>read-only mode for 30 days</b>. You can still view content; posting and commenting will be unavailable ` +
                    `until reactivation.</p>` +
                    `<p>Please review our Community Guidelines.</p>` +
                    `<p>Pharma SocII Community Team</p>`,
            );
        },
    },
    account_reactivated: {
        subject: () => "Your Pharma SocII account has been reactivated",
        text: () => {
            return wrapText(
                "Your Pharma SocII account has been reactivated. You have full community access again.\n\n" +
                    "Please keep contributions professional and aligned with our Community Guidelines.\n\n" +
                    "Welcome back,\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: () => {
            return wrapHtml(
                `<p>Your Pharma SocII account has been reactivated. You have full community access again.</p>` +
                    `<p>Please keep contributions professional and aligned with our Community Guidelines.</p>` +
                    `<p>Welcome back,<br/>Pharma SocII Community Team</p>`,
            );
        },
    },
    account_reenabled: {
        subject: () => "Your Pharma SocII account has been reactivated",
        text: (payload) => templates.account_reactivated.text(payload),
        html: (payload) => templates.account_reactivated.html(payload),
    },
    admin_content_restored: {
        subject: () => "Your content was restored",
        text: () => {
            return wrapText(
                "Your post or comment on Pharma SocII has been restored by our moderation team.\n\n" +
                    "Thank you for contributing to the community.\n\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: () => {
            return wrapHtml(
                `<p>Your post or comment on Pharma SocII has been restored by our moderation team.</p>` +
                    `<p>Thank you for contributing to the community.</p>` +
                    `<p>Pharma SocII Community Team</p>`,
            );
        },
    },
    content_archived_admin: {
        subject: () => "Community moderation notice: content archived",
        text: () => {
            return wrapText(
                "Content you posted or commented on in the Pharma SocII Community was archived by the moderation team " +
                    "because it did not align with our Community Guidelines. It is no longer visible to the community.\n\n" +
                    "This does not necessarily mean your account is restricted. Please review the Community Guidelines " +
                    "before posting again.\n\n" +
                    "Pharma SocII Team",
            );
        },
        html: () => {
            return wrapHtml(
                `<p>Content you posted or commented on in the Pharma SocII Community was archived by the moderation team ` +
                    `because it did not align with our Community Guidelines. It is no longer visible to the community.</p>` +
                    `<p>This does not necessarily mean your account is restricted. Please review the Community Guidelines ` +
                    `before posting again.</p>` +
                    `<p>Pharma SocII Team</p>`,
            );
        },
    },
    content_archived_spam: {
        subject: () => "Community notice: content removed after reports",
        text: () => {
            return wrapText(
                "Your content on the Pharma SocII Community received three member reports and was automatically removed.\n\n" +
                    "Please review our Community Guidelines before creating future content.\n\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: () => {
            return wrapHtml(
                `<p>Your content on the Pharma SocII Community received three member reports and was automatically removed.</p>` +
                    `<p>Please review our Community Guidelines before creating future content.</p>` +
                    `<p>Pharma SocII Community Team</p>`,
            );
        },
    },
    account_on_hold: {
        subject: () => "Your Pharma SocII account is on hold",
        text: () => {
            return wrapText(
                "Your Pharma SocII account has been temporarily paused by our moderation team for review against " +
                    "our Community Guidelines.\n\n" +
                    "While under review you cannot post or comment. You can still read community content. " +
                    "We will notify you when the review is complete.\n\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: () => {
            return wrapHtml(
                `<p>Your Pharma SocII account has been temporarily paused by our moderation team for review against ` +
                    `our Community Guidelines.</p>` +
                    `<p>While under review you cannot post or comment. You can still read community content. ` +
                    `We will notify you when the review is complete.</p>` +
                    `<p>Pharma SocII Community Team</p>`,
            );
        },
    },
};

function renderEmail(type, payload = {}) {
    const t = templates[type];
    if (!t) {
        return {
            subject: `Pharma SocII notification (${type})`,
            text: wrapText(`Notification type: ${type}\n\n${JSON.stringify(payload, null, 2)}`),
            html: wrapHtml(`<p>Notification type: ${escapeHtml(type)}</p><pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`),
        };
    }
    return {
        subject: t.subject(payload),
        text: t.text(payload),
        html: t.html(payload),
    };
}

module.exports = { renderEmail, templates, firstNameFrom };
