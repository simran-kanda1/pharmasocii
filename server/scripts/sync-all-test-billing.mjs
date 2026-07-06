/**
 * Sync all partner plans from Stripe after test-clock advances.
 * Runs billing logic directly in the Express server (no HTTP call).
 *
 * Usage (from repo root):
 *   node server/scripts/sync-all-test-billing.mjs
 *
 * Requires server/.env with STRIPE_SECRET_KEY (sk_test_) and Firebase credentials.
 */
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(__dirname, "..");

const child = spawn(process.execPath, ["index.js", "sync-all-test-billing"], {
    cwd: serverDir,
    stdio: "inherit",
    env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
