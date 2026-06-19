/**
 * Refresh billingPeriodEnd from Stripe and reactivate listings that still have
 * an active subscription but were marked cancelled locally (e.g. stale plan dates).
 *
 * Dry run (default):
 *   node server/scripts/sync-live-plans-from-stripe.js
 *
 * Apply:
 *   node server/scripts/sync-live-plans-from-stripe.js --apply
 *
 * Requires server/pharmasocii_admin.json and STRIPE_SECRET_KEY in env or server/.env.
 */
import admin from "firebase-admin";
import Stripe from "stripe";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
const ROOT = resolve(process.cwd());
const APPLY = process.argv.includes("--apply");

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

function initAdmin() {
    const keyPath = resolve(ROOT, "server/pharmasocii_admin.json");
    if (existsSync(keyPath)) {
        const key = JSON.parse(readFileSync(keyPath, "utf8"));
        admin.initializeApp({ credential: admin.credential.cert(key) });
        return;
    }
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

function partnerIdFromPartnersPlanRef(ref) {
    const parts = String(ref?.path || "").split("/");
    if (parts[0] === "partnersCollection" && parts[2] === "planCollection") return parts[1] || null;
    return null;
}

function getListingDocRef(db, partnerId, collectionName, listingId) {
    if (!collectionName || !listingId) return null;
    if (collectionName === "businessOfferingsCollection") {
        if (!partnerId) return null;
        return db.collection("partnersCollection").doc(partnerId).collection(collectionName).doc(listingId);
    }
    return db.collection(collectionName).doc(listingId);
}

async function resolveListingDocRef(db, partnerId, collectionName, listingId) {
    const canonicalRef = getListingDocRef(db, partnerId, collectionName, listingId);
    if (!canonicalRef) return null;
    const canonicalSnap = await canonicalRef.get();
    if (canonicalSnap.exists) return canonicalRef;

    if (partnerId && collectionName && collectionName !== "businessOfferingsCollection") {
        const legacyRef = db
            .collection("partnersCollection")
            .doc(partnerId)
            .collection(collectionName)
            .doc(listingId);
        const legacySnap = await legacyRef.get();
        if (legacySnap.exists) return legacyRef;
    }
    return canonicalRef;
}

const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

function toDateValue(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === "function") {
        const converted = value.toDate();
        return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
    }
    if (typeof value === "number") {
        const millis = value > 1e12 ? value : value * 1000;
        const converted = new Date(millis);
        return Number.isNaN(converted.getTime()) ? null : converted;
    }
    if (typeof value === "string") {
        const converted = new Date(value);
        return Number.isNaN(converted.getTime()) ? null : converted;
    }
    if (typeof value?.seconds === "number") {
        const converted = new Date(value.seconds * 1000);
        return Number.isNaN(converted.getTime()) ? null : converted;
    }
    return null;
}

async function main() {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
        console.error("Missing STRIPE_SECRET_KEY");
        process.exit(1);
    }

    initAdmin();
    const db = admin.firestore();
    const fv = admin.firestore.FieldValue;
    const stripe = new Stripe(stripeKey);

    const plansSnap = await db.collectionGroup("planCollection").get();
    let scanned = 0;
    let wouldUpdate = 0;
    let updated = 0;

    for (const planDoc of plansSnap.docs) {
        const plan = planDoc.data() || {};
        const subId = plan.stripeSubscriptionId;
        if (!subId) continue;

        scanned += 1;
        let sub;
        try {
            sub = await stripe.subscriptions.retrieve(String(subId));
        } catch (err) {
            console.warn(`Skip plan ${planDoc.id}: subscription ${subId} — ${err.message}`);
            continue;
        }

        if (!LIVE_STATUSES.has(String(sub.status || "").toLowerCase())) continue;

        const billingPeriodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : null;
        const partnerId = partnerIdFromPartnersPlanRef(planDoc.ref);
        const listingId = plan.listingId;
        const collectionName = plan.collectionName;

        const needsPlan =
            plan.active === false ||
            !plan.billingPeriodEnd ||
            (toDateValue(plan.billingPeriodEnd)?.getTime() || 0) < Date.now();

        let needsListing = false;
        let listingRef = null;
        if (partnerId && listingId && collectionName) {
            listingRef = await resolveListingDocRef(db, partnerId, collectionName, listingId);
            if (listingRef) {
                const listingSnap = await listingRef.get();
                if (listingSnap.exists) {
                    const listing = listingSnap.data() || {};
                    needsListing =
                        listing.active === false ||
                        String(listing.status || "").toLowerCase() === "cancelled";
                }
            }
        }

        if (!needsPlan && !needsListing) continue;

        wouldUpdate += 1;
        console.log(
            `${APPLY ? "UPDATE" : "WOULD UPDATE"} partner=${partnerId} listing=${listingId} plan=${planDoc.id} sub=${sub.status}`,
        );

        if (!APPLY) continue;

        await planDoc.ref.set(
            {
                active: true,
                billingPeriodEnd: billingPeriodEnd || fv.serverTimestamp(),
                lastPaymentReceivedAt: fv.serverTimestamp(),
                expiredAt: fv.delete(),
            },
            { merge: true },
        );
        updated += 1;

        if (listingRef && needsListing) {
            await listingRef.set(
                {
                    active: true,
                    status: "Approved",
                    updatedAt: fv.serverTimestamp(),
                },
                { merge: true },
            );
        }
    }

    console.log(
        JSON.stringify(
            { ok: true, apply: APPLY, scanned, wouldUpdate, updated: APPLY ? updated : 0 },
            null,
            2,
        ),
    );
}

main().catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
});
