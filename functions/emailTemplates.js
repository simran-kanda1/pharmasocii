/** Transactional community email copy (SMTP + emailLogCollection). */

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
    '<p style="color:#666;font-size:12px;margin-top:24px">This is a no-reply email. Please use the Contact Us page for support.</p>';

function wrapHtml(bodyHtml) {
    return `${bodyHtml}${NO_REPLY_HTML}`;
}

function wrapText(bodyText) {
    return `${bodyText}${NO_REPLY_TEXT}`;
}

const templates = {
    account_activation: {
        subject: () => "Account activation",
        text: ({ verifyLink, ...payload }) => {
            const first = firstNameFrom(payload);
            let body =
                `Dear ${first},\n\n` +
                "Please use the link below to activate your Pharma SocII account.\n" +
                "Once activated, you will be able to post and comment within the community.\n\n";
            if (verifyLink) {
                body += `${verifyLink}\n\n`;
            }
            body +=
                "Welcome to the Pharma SocII community.\n\n" +
                "Pharma SocII Team";
            return wrapText(body);
        },
        html: ({ verifyLink, ...payload }) => {
            const first = escapeHtml(firstNameFrom(payload));
            let html =
                `<p>Dear ${first},</p>` +
                `<p>Please use the link below to activate your <b>Pharma SocII</b> account. ` +
                `Once activated, you will be able to post and comment within the community.</p>`;
            if (verifyLink) {
                html +=
                    `<p><a href="${verifyLink}" style="display:inline-block;padding:10px 16px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px">Activate account</a></p>` +
                    `<p style="word-break:break-all;font-size:12px;color:#666">Or copy this link:<br/>${escapeHtml(verifyLink)}</p>`;
            }
            html +=
                `<p>Welcome to the Pharma SocII community.</p>` +
                `<p>Pharma SocII Team</p>`;
            return wrapHtml(html);
        },
    },
    password_reset: {
        subject: () => "Reset your password",
        text: ({ resetLink, ...payload }) => {
            const first = firstNameFrom(payload);
            return wrapText(
                `Hi ${first},\n\n` +
                    "We received a request to reset the password for your Pharma SocII account.\n\n" +
                    "To create a new password, please use the link below:\n\n" +
                    `${resetLink || "[Reset Password]"}\n\n` +
                    "If you did not request a password reset, you can safely ignore this email.\n\n" +
                    "For security reasons, this link may expire after a limited time.\n\n" +
                    "Thank you,\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: ({ resetLink, ...payload }) => {
            const first = escapeHtml(firstNameFrom(payload));
            const link = resetLink
                ? `<p><a href="${resetLink}" style="display:inline-block;padding:10px 16px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px">Reset Password</a></p>` +
                  `<p style="word-break:break-all;font-size:12px;color:#666">${escapeHtml(resetLink)}</p>`
                : `<p>[Reset Password]</p>`;
            return wrapHtml(
                `<p>Hi ${first},</p>` +
                    `<p>We received a request to reset the password for your <b>Pharma SocII</b> account.</p>` +
                    `<p>To create a new password, please use the link below:</p>` +
                    link +
                    `<p>If you did not request a password reset, you can safely ignore this email.</p>` +
                    `<p>For security reasons, this link may expire after a limited time.</p>` +
                    `<p>Thank you,<br/>Pharma SocII Community Team</p>`,
            );
        },
    },
    spam_strike_1: {
        subject: () => "Notice of reported content (1st report)",
        text: (payload) => {
            const first = firstNameFrom(payload);
            return wrapText(
                `Hi ${first},\n\n` +
                    "We're writing to let you know that one of your recent posts or comments on the Pharma SocII Community " +
                    "has been reported by a member of the community.\n\n" +
                    "At this time, no action has been taken against your account. This notice is provided so you are aware of " +
                    "the report and can review your content to ensure it aligns with our Community Guidelines.\n\n" +
                    "Our community is built on respectful, professional, and constructive discussion, and we ask all members " +
                    "to help maintain that standard.\n\n" +
                    "What happens next:\n\n" +
                    "If a post or comment receives three reports, it will be automatically removed from the platform. If your " +
                    "account receives three reports, your account will be automatically paused for 30 days.\n\n" +
                    "Thank you for helping us keep the community valuable and professional.\n\n" +
                    "Regards,\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: (payload) => {
            const first = escapeHtml(firstNameFrom(payload));
            return wrapHtml(
                `<p>Hi ${first},</p>` +
                    `<p>We're writing to let you know that one of your recent posts or comments on the <b>Pharma SocII Community</b> ` +
                    `has been reported by a member of the community.</p>` +
                    `<p>At this time, no action has been taken against your account. This notice is provided so you are aware of ` +
                    `the report and can review your content to ensure it aligns with our Community Guidelines.</p>` +
                    `<p>Our community is built on respectful, professional, and constructive discussion, and we ask all members ` +
                    `to help maintain that standard.</p>` +
                    `<p><b>What happens next:</b></p>` +
                    `<ul>` +
                    `<li>If a post or comment receives three reports, it will be automatically removed from the platform.</li>` +
                    `<li>If your account receives three reports, your account will be automatically paused for 30 days.</li>` +
                    `</ul>` +
                    `<p>Thank you for helping us keep the community valuable and professional.</p>` +
                    `<p>Regards,<br/>Pharma SocII Community Team</p>`,
            );
        },
    },
    spam_strike_2: {
        subject: () => "Second notice regarding reported content",
        text: (payload) => {
            const first = firstNameFrom(payload);
            return wrapText(
                `Hi ${first},\n\n` +
                    "This is a follow-up regarding your recent post or comment on the Pharma SocII Community.\n\n" +
                    "Your content has now been reported twice.\n\n" +
                    "As a reminder of our reporting process:\n\n" +
                    "A post or comment is automatically removed after receiving three reports on that item.\n\n" +
                    "An account is automatically paused after receiving three total reports across any posts or comments.\n\n" +
                    "We encourage you to review your content to ensure it aligns with our Community Guidelines.\n\n" +
                    "Thank you for helping us keep the community valuable and professional.\n\n" +
                    "Regards,\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: (payload) => {
            const first = escapeHtml(firstNameFrom(payload));
            return wrapHtml(
                `<p>Hi ${first},</p>` +
                    `<p>This is a follow-up regarding your recent post or comment on the <b>Pharma SocII Community</b>.</p>` +
                    `<p>Your content has now been reported <b>twice</b>.</p>` +
                    `<p>As a reminder of our reporting process:</p>` +
                    `<ul>` +
                    `<li>A post or comment is automatically removed after receiving three reports on that item.</li>` +
                    `<li>An account is automatically paused after receiving three total reports across any posts or comments.</li>` +
                    `</ul>` +
                    `<p>We encourage you to review your content to ensure it aligns with our Community Guidelines.</p>` +
                    `<p>Thank you for helping us keep the community valuable and professional.</p>` +
                    `<p>Regards,<br/>Pharma SocII Community Team</p>`,
            );
        },
    },
    spam_strike_3_account_archived: {
        subject: () => "Community guidelines notice: account status update",
        text: (payload) => {
            const first = firstNameFrom(payload);
            return wrapText(
                `Hi ${first},\n\n` +
                    "This is a follow-up regarding your recent activity on the Pharma SocII Community.\n\n" +
                    "Your account has now accumulated three total community reports across one or more posts and/or comments/replies.\n\n" +
                    "In accordance with our Community Guidelines:\n\n" +
                    "Content that receives three reports may be removed from the community.\n\n" +
                    "If your account is currently active, it will be placed in read-only mode for 30 days.\n\n" +
                    "During the pause period, you will continue to have access to view community content and stay current on ongoing discussions; " +
                    "however, posting, commenting, and other contribution features will be temporarily unavailable. " +
                    "We will inform you once the account is reactivated.\n\n" +
                    "We encourage you to review our Community Guidelines to help ensure future contributions align with the standards of the community.\n\n" +
                    "Thank you for helping us maintain a valuable, respectful, and trusted environment for all members.\n\n" +
                    "Sincerely,\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: (payload) => {
            const first = escapeHtml(firstNameFrom(payload));
            return wrapHtml(
                `<p>Hi ${first},</p>` +
                    `<p>This is a follow-up regarding your recent activity on the <b>Pharma SocII Community</b>.</p>` +
                    `<p>Your account has now accumulated <b>three total community reports</b> across one or more posts and/or comments/replies.</p>` +
                    `<p>In accordance with our Community Guidelines:</p>` +
                    `<ul>` +
                    `<li>Content that receives three reports may be removed from the community.</li>` +
                    `<li>If your account is currently active, it will be placed in <b>read-only mode for 30 days</b>.</li>` +
                    `</ul>` +
                    `<p>During the pause period, you will continue to have access to view community content and stay current on ongoing discussions; ` +
                    `however, posting, commenting, and other contribution features will be temporarily unavailable. ` +
                    `We will inform you once the account is reactivated.</p>` +
                    `<p>We encourage you to review our Community Guidelines to help ensure future contributions align with the standards of the community.</p>` +
                    `<p>Thank you for helping us maintain a valuable, respectful, and trusted environment for all members.</p>` +
                    `<p>Sincerely,<br/>Pharma SocII Community Team</p>`,
            );
        },
    },
    account_reactivated: {
        subject: () => "Your Pharma SocII account has been reactivated",
        text: (payload) => {
            const first = firstNameFrom(payload);
            return wrapText(
                `Hi ${first},\n\n` +
                    "We're writing to let you know that your Pharma SocII account has been reactivated. You now have full access to the community again.\n\n" +
                    "We appreciate your cooperation and encourage you to review our Community Guidelines to ensure future contributions remain professional, " +
                    "respectful, and valuable to the life sciences community.\n\n" +
                    "If you have any questions, please contact us.\n\n" +
                    "Welcome back,\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: (payload) => {
            const first = escapeHtml(firstNameFrom(payload));
            return wrapHtml(
                `<p>Hi ${first},</p>` +
                    `<p>We're writing to let you know that your <b>Pharma SocII</b> account has been <b>reactivated</b>. ` +
                    `You now have full access to the community again.</p>` +
                    `<p>We appreciate your cooperation and encourage you to review our Community Guidelines to ensure future contributions remain professional, ` +
                    `respectful, and valuable to the life sciences community.</p>` +
                    `<p>If you have any questions, please contact us.</p>` +
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
        subject: () => "Content restored",
        text: (payload) => {
            const first = firstNameFrom(payload);
            return wrapText(
                `Hi ${first},\n\n` +
                    "We're writing to let you know that your post or comment on Pharma SocII has been restored by our moderation team.\n\n" +
                    "Thank you for contributing to the community,\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: (payload) => {
            const first = escapeHtml(firstNameFrom(payload));
            return wrapHtml(
                `<p>Hi ${first},</p>` +
                    `<p>We're writing to let you know that your post or comment on <b>Pharma SocII</b> has been restored by our moderation team.</p>` +
                    `<p>Thank you for contributing to the community,<br/>Pharma SocII Community Team</p>`,
            );
        },
    },
    content_archived_admin: {
        subject: () => "Community moderation notice: content archived",
        text: (payload) => {
            const first = firstNameFrom(payload);
            return wrapText(
                `Hi ${first},\n\n` +
                    "This message is regarding content you posted or commented on within the Pharma SocII Community.\n\n" +
                    "After review, the moderation team has determined that the content does not align with one or more aspects of " +
                    "our Community Guidelines. As a result, the content has been archived and is no longer visible to the community.\n\n" +
                    "Please note that content was archived by the moderation team to help maintain a professional, respectful, and " +
                    "valuable environment for all members. This action does not necessarily result in an account restriction.\n\n" +
                    "We encourage you to review our Community Guidelines before creating future posts or comments to help ensure " +
                    "your contributions remain visible and continue to add value to the community.\n\n" +
                    "Thank you for helping us build a trusted and collaborative life sciences network.\n\n" +
                    "The Pharma SocII Team",
            );
        },
        html: (payload) => {
            const first = escapeHtml(firstNameFrom(payload));
            return wrapHtml(
                `<p>Hi ${first},</p>` +
                    `<p>This message is regarding content you posted or commented on within the <b>Pharma SocII Community</b>.</p>` +
                    `<p>After review, the moderation team has determined that the content does not align with one or more aspects of ` +
                    `our Community Guidelines. As a result, the content has been <b>archived</b> and is no longer visible to the community.</p>` +
                    `<p>Please note that content was archived by the moderation team to help maintain a professional, respectful, and ` +
                    `valuable environment for all members. This action does not necessarily result in an account restriction.</p>` +
                    `<p>We encourage you to review our Community Guidelines before creating future posts or comments to help ensure ` +
                    `your contributions remain visible and continue to add value to the community.</p>` +
                    `<p>Thank you for helping us build a trusted and collaborative life sciences network.</p>` +
                    `<p>The Pharma SocII Team</p>`,
            );
        },
    },
    content_archived_spam: {
        subject: () => "Community notice: content removed after reports",
        text: (payload) => {
            const first = firstNameFrom(payload);
            const contentType = payload.contentType || "content";
            return wrapText(
                `Hi ${first},\n\n` +
                    `Your ${contentType} on the Pharma SocII Community received three member reports and has been automatically removed from the platform.\n\n` +
                    "No further action has been taken on your account at this time unless you have received a separate account status notice.\n\n" +
                    "We encourage you to review our Community Guidelines before creating future posts or comments.\n\n" +
                    "Regards,\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: (payload) => {
            const first = escapeHtml(firstNameFrom(payload));
            const contentType = escapeHtml(payload.contentType || "content");
            return wrapHtml(
                `<p>Hi ${first},</p>` +
                    `<p>Your <b>${contentType}</b> on the <b>Pharma SocII Community</b> received three member reports and has been automatically removed from the platform.</p>` +
                    `<p>No further action has been taken on your account at this time unless you have received a separate account status notice.</p>` +
                    `<p>We encourage you to review our Community Guidelines before creating future posts or comments.</p>` +
                    `<p>Regards,<br/>Pharma SocII Community Team</p>`,
            );
        },
    },
    account_on_hold: {
        subject: () => "Account put on hold by the moderation team",
        text: (payload) => {
            const first = firstNameFrom(payload);
            return wrapText(
                `Hi ${first},\n\n` +
                    "We're writing to inform you that your Pharma SocII account has been temporarily paused by our moderation team.\n\n" +
                    "This action is taken when content or account activity requires further review to ensure alignment with our Community Guidelines.\n\n" +
                    "What this means:\n\n" +
                    "You will not be able to post or comment while your account is under review\n\n" +
                    "You are welcome to review other posts and comments to stay current\n\n" +
                    "Our moderation team will assess the situation and determine next steps\n\n" +
                    "After our review is complete, we will notify you of the outcome\n\n" +
                    "Access may be restored, restricted, or remain paused depending on the results of our team's review\n\n" +
                    "If you would like to provide context, please contact us.\n\n" +
                    "Thank you for your understanding,\n" +
                    "Pharma SocII Community Team",
            );
        },
        html: (payload) => {
            const first = escapeHtml(firstNameFrom(payload));
            return wrapHtml(
                `<p>Hi ${first},</p>` +
                    `<p>We're writing to inform you that your <b>Pharma SocII</b> account has been temporarily paused by our moderation team.</p>` +
                    `<p>This action is taken when content or account activity requires further review to ensure alignment with our Community Guidelines.</p>` +
                    `<p><b>What this means:</b></p>` +
                    `<ul>` +
                    `<li>You will not be able to post or comment while your account is under review</li>` +
                    `<li>You are welcome to review other posts and comments to stay current</li>` +
                    `<li>Our moderation team will assess the situation and determine next steps</li>` +
                    `<li>After our review is complete, we will notify you of the outcome</li>` +
                    `<li>Access may be restored, restricted, or remain paused depending on the results of our team's review</li>` +
                    `</ul>` +
                    `<p>If you would like to provide context, please contact us.</p>` +
                    `<p>Thank you for your understanding,<br/>Pharma SocII Community Team</p>`,
            );
        },
    },
};

function renderEmail(type, payload = {}) {
    const t = templates[type];
    if (!t) {
        return {
            subject: `[Pharma SocII] ${type}`,
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

module.exports = { renderEmail, templates, firstNameFrom };
