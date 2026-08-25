/**
 * One-off repair:
 * 1) Sync events/jobs selectedAddon + featuredPlacement to the plan-included spotlight
 *    (premium_* → landing_page, premium_plus_* → home_page).
 * 2) Backfill featureSpotlightBillingPeriodStart from Stripe current_period_start
 *    for listings with a standalone feature subscription.
 *
 * Usage (from repo root):
 *   node server/scripts/repair-spotlight-and-feature-periods.js           # dry-run
 *   node server/scripts/repair-spotlight-and-feature-periods.js --apply   # write
 */
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import Stripe from "stripe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const APPLY = process.argv.includes("--apply");

const PLAN_INCLUDED = {
    premium_event: "landing_page",
    premium_job: "landing_page",
    premium_plus_event: "home_page",
    premium_plus_job: "home_page",
};

function loadEnvFile(path) {
    if (!existsSync(path)) return;
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
    }
}

loadEnvFile(resolve(ROOT, "server/.env"));
loadEnvFile(resolve(ROOT, ".env"));

const keyPath = resolve(ROOT, "server/pharmasocii_admin.json");
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeKey ? new Stripe(stripeKey) : null;
if (!stripe) {
    console.warn("Warning: STRIPE_SECRET_KEY not found — period-start backfill will skip Stripe.");
}

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    if (typeof value === "number") return new Date(value > 1e12 ? value : value * 1000);
    if (typeof value === "string") {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}

async function patchListingEverywhere(partnerId, collectionName, listingId, patch) {
    const refs = [db.collection(collectionName).doc(listingId)];
    if (partnerId) {
        refs.push(
            db.collection("partnersCollection").doc(partnerId).collection(collectionName).doc(listingId)
        );
    }
    let updated = 0;
    for (const ref of refs) {
        const snap = await ref.get();
        if (!snap.exists) continue;
        if (APPLY) await ref.set(patch, { merge: true });
        updated += 1;
    }
    return updated;
}

async function repairEventJobSpotlights() {
    const results = [];
    for (const collectionName of ["eventsCollection", "jobsCollection"]) {
        const snap = await db.collection(collectionName).get();
        for (const doc of snap.docs) {
            const data = doc.data() || {};
            const planId = String(data.selectedPlan || "").trim().toLowerCase();
            const expected = PLAN_INCLUDED[planId];
            if (!expected) continue;
            const currentAddon = String(data.selectedAddon || "").trim();
            const currentPlacement = String(data.featuredPlacement || "").trim();
            if (currentAddon === expected && currentPlacement === expected && data.isFeatured === true) {
                continue;
            }
            const patch = {
                selectedAddon: expected,
                featuredPlacement: expected,
                isFeatured: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            const partnerId = data.partnerId || "";
            const updated = await patchListingEverywhere(partnerId, collectionName, doc.id, patch);
            results.push({
                collectionName,
                listingId: doc.id,
                partnerId,
                planId,
                from: { selectedAddon: currentAddon, featuredPlacement: currentPlacement, isFeatured: data.isFeatured },
                to: expected,
                docsUpdated: updated,
            });
        }
    }
    return results;
}

const periodStartCache = new Map();

async function stripePeriodStart(subId) {
    if (!stripe || !subId) return null;
    if (periodStartCache.has(subId)) return periodStartCache.get(subId);
    try {
        const sub = await stripe.subscriptions.retrieve(subId);
        const start = sub?.current_period_start ? new Date(sub.current_period_start * 1000) : null;
        periodStartCache.set(subId, start);
        return start;
    } catch (err) {
        periodStartCache.set(subId, null);
        console.warn(`  stripe retrieve failed for ${subId}: ${err.message}`);
        return null;
    }
}

async function maybeBackfillPeriodStart(collectionName, doc, data, partnerIdOverride = null) {
    const subId = String(data.featureSpotlightStripeSubscriptionId || "").trim();
    if (!subId) return null;

    const addon = String(data.selectedAddon || data.featuredPlacement || "").trim();
    const existing = toDate(data.featureSpotlightBillingPeriodStart);
    const periodStart = await stripePeriodStart(subId);
    if (!periodStart) return null;
    if (existing && Math.abs(existing.getTime() - periodStart.getTime()) < 1000) return null;

    const patch = {
        featureSpotlightBillingPeriodStart: periodStart,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const partnerId = partnerIdOverride || data.partnerId || "";
    let docsUpdated = 0;
    if (collectionName === "businessOfferingsCollection") {
        if (APPLY) await doc.ref.set(patch, { merge: true });
        docsUpdated = 1;
    } else {
        docsUpdated = await patchListingEverywhere(partnerId, collectionName, doc.id, patch);
    }

    return {
        collectionName,
        listingId: doc.id,
        partnerId,
        addon,
        subId,
        previous: existing ? existing.toISOString() : null,
        periodStart: periodStart.toISOString(),
        docsUpdated,
    };
}

async function repairFeaturePeriodStarts() {
    const results = [];
    const seen = new Set();

    // Prefer collectionGroup on the feature subscription field — much faster than scanning all partners.
    try {
        const cg = await db.collectionGroup("businessOfferingsCollection")
            .where("featureSpotlightStripeSubscriptionId", "!=", "")
            .get();
        for (const doc of cg.docs) {
            const path = doc.ref.path;
            if (seen.has(path)) continue;
            seen.add(path);
            const partnerId = path.match(/^partnersCollection\/([^/]+)\//)?.[1] || doc.data()?.partnerId || "";
            const r = await maybeBackfillPeriodStart(
                "businessOfferingsCollection",
                doc,
                { ...(doc.data() || {}), partnerId },
                partnerId
            );
            if (r) results.push(r);
        }
    } catch (err) {
        console.warn("businessOfferingsCollection group query failed, falling back:", err.message);
        const partners = await db.collection("partnersCollection").select().get();
        for (const pDoc of partners.docs) {
            const bizSnap = await pDoc.ref.collection("businessOfferingsCollection").get();
            for (const doc of bizSnap.docs) {
                const data = doc.data() || {};
                if (!data.featureSpotlightStripeSubscriptionId) continue;
                const path = doc.ref.path;
                if (seen.has(path)) continue;
                seen.add(path);
                const r = await maybeBackfillPeriodStart(
                    "businessOfferingsCollection",
                    doc,
                    { ...data, partnerId: pDoc.id },
                    pDoc.id
                );
                if (r) results.push(r);
            }
        }
    }

    for (const collectionName of ["consultingServicesCollection", "consultingCollection"]) {
        try {
            const snap = await db.collection(collectionName)
                .where("featureSpotlightStripeSubscriptionId", "!=", "")
                .get();
            for (const doc of snap.docs) {
                const path = doc.ref.path;
                if (seen.has(path)) continue;
                seen.add(path);
                const r = await maybeBackfillPeriodStart(collectionName, doc, doc.data() || {});
                if (r) results.push(r);
            }
        } catch (err) {
            console.warn(`${collectionName} query failed:`, err.message);
            const snap = await db.collection(collectionName).get();
            for (const doc of snap.docs) {
                const data = doc.data() || {};
                if (!data.featureSpotlightStripeSubscriptionId) continue;
                const path = doc.ref.path;
                if (seen.has(path)) continue;
                seen.add(path);
                const r = await maybeBackfillPeriodStart(collectionName, doc, data);
                if (r) results.push(r);
            }
        }
    }

    return results;
}

async function main() {
    console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
    const spotlightFixes = await repairEventJobSpotlights();
    console.log(`\nEvent/Job spotlight mismatches: ${spotlightFixes.length}`);
    for (const row of spotlightFixes) {
        console.log(
            `  ${row.collectionName}/${row.listingId} plan=${row.planId} addon '${row.from.selectedAddon || ""}' → ${row.to}`
        );
    }

    const periodFixes = await repairFeaturePeriodStarts();
    console.log(`\nFeature period-start backfills: ${periodFixes.length}`);
    for (const row of periodFixes) {
        console.log(
            `  ${row.collectionName}/${row.listingId} addon=${row.addon} ${row.previous || "(none)"} → ${row.periodStart}`
        );
    }

    if (!APPLY) {
        console.log("\nRe-run with --apply to write these changes.");
    } else {
        console.log("\nDone.");
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
