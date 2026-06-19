/**
 * Advance a partner's Stripe test clock to trigger subscription renewal (test mode only).
 *
 * Usage:
 *   node server/scripts/advance-partner-test-clock.mjs <partnerId> [advanceDays]
 *
 * Requires STRIPE_SECRET_KEY (sk_test_) in server/.env or env.
 */
import Stripe from "stripe";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(process.cwd());
const partnerId = process.argv[2];
const advanceDays = Number(process.argv[3] || process.env.STRIPE_TEST_BILLING_DAYS || 5);

function loadEnvFile(filePath) {
    if (!existsSync(filePath)) return;
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        if (!process.env[key]) {
            process.env[key] = trimmed.slice(eq + 1).trim();
        }
    }
}

loadEnvFile(resolve(ROOT, "server/.env"));
loadEnvFile(resolve(ROOT, ".env"));

async function main() {
    if (!partnerId) {
        console.error("Usage: node server/scripts/advance-partner-test-clock.mjs <partnerId> [advanceDays]");
        process.exit(1);
    }
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey?.startsWith("sk_test_")) {
        console.error("STRIPE_SECRET_KEY must be a test key (sk_test_).");
        process.exit(1);
    }

    const apiBase = (process.env.API_BASE_URL || "https://pharmasocii.onrender.com").replace(/\/$/, "");
    const resp = await fetch(`${apiBase}/api/advance-test-billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, advanceDays }),
    });
    const data = await resp.json();
    console.log(JSON.stringify(data, null, 2));
    if (!resp.ok) process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
