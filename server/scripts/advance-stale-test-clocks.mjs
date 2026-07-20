/**
 * Catch up every partner Stripe test clock behind wall clock, then sync renewals.
 * Needed for accelerated test billing on an always-on server (Render paid).
 *
 * Usage (from repo root):
 *   node server/scripts/advance-stale-test-clocks.mjs
 *   node server/scripts/advance-stale-test-clocks.mjs --force
 */
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(__dirname, "..");
const args = ["index.js", "advance-stale-test-clocks"];
if (process.argv.includes("--force")) args.push("--force");

const child = spawn(process.execPath, args, {
    cwd: serverDir,
    stdio: "inherit",
    env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
