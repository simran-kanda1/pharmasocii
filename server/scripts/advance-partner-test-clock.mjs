/**
 * Advance a partner's Stripe test clock and sync plans from Stripe.
 * Runs billing logic directly in the Express server (no HTTP call).
 *
 * Usage:
 *   node server/scripts/advance-partner-test-clock.mjs <partnerId> [advanceDays]
 *
 * Requires server/.env with STRIPE_SECRET_KEY (sk_test_) and Firebase credentials.
 */
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(__dirname, "..");
const partnerId = process.argv[2];
const advanceDays = process.argv[3];

if (!partnerId) {
    console.error("Usage: node server/scripts/advance-partner-test-clock.mjs <partnerId> [advanceDays]");
    process.exit(1);
}

const args = ["index.js", "advance-test-billing", partnerId];
if (advanceDays) args.push(advanceDays);

const child = spawn(process.execPath, args, {
    cwd: serverDir,
    stdio: "inherit",
    env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
