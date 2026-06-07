/**
 * One-off: deactivate listings whose plan billing period has ended.
 *
 * Dry run (default):
 *   node server/scripts/cleanup-expired-listings.js
 *
 * Apply changes:
 *   node server/scripts/cleanup-expired-listings.js --apply
 *
 * Requires server/pharmasocii_admin.json (same as other server scripts).
 */
import admin from "firebase-admin";
import Stripe from "stripe";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { cleanupExpiredListings } from "../cleanupExpiredListings.js";

function loadEnvFile(filePath) {
    if (!existsSync(filePath)) return;
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
    }
}

const ROOT = resolve(process.cwd());
loadEnvFile(resolve(ROOT, "server/.env"));
loadEnvFile(resolve(ROOT, ".env"));

const APPLY = process.argv.includes("--apply");

function initAdmin() {
    const keyPath = resolve(ROOT, "server/pharmasocii_admin.json");
    if (existsSync(keyPath)) {
        const key = JSON.parse(readFileSync(keyPath, "utf8"));
        admin.initializeApp({ credential: admin.credential.cert(key) });
        return;
    }
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

async function main() {
    initAdmin();

    if (!APPLY) {
        console.log("Dry run — pass --apply to deactivate expired listings in Firestore.");
        console.log("(The frontend fix already hides them; this only updates database records.)");
        return;
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const stripe = stripeKey ? new Stripe(stripeKey) : null;
    const result = await cleanupExpiredListings({ stripe });
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
});
