import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(readFileSync(resolve(__dirname, "../pharmasocii_admin.json"), "utf8"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "pharmasocii"
    });
}
const db = admin.firestore();

async function backfillTransactionAuditLogs() {
    console.log("🚀 Starting Transaction Audit Logs Backfill...");

    // 1. Load existing sessionIds and invoiceIds in auditLogs
    console.log("📥 Loading existing auditLogs...");
    const auditSnap = await db.collection("auditLogs").get();
    const existingSessionIds = new Set();
    const existingInvoiceIds = new Set();

    auditSnap.forEach(d => {
        const m = d.data().metadata;
        if (m?.sessionId) existingSessionIds.add(m.sessionId);
        if (m?.invoiceId) existingInvoiceIds.add(m.invoiceId);
    });
    console.log(`✓ Found ${auditSnap.size} existing audit logs with ${existingSessionIds.size} sessions and ${existingInvoiceIds.size} invoices.`);

    // 2. Fetch all partners for name lookup
    const partnerSnap = await db.collection("partnersCollection").get();
    const partnerMap = new Map();
    partnerSnap.forEach(d => {
        const data = d.data();
        partnerMap.set(d.id, data.businessName || data.companyName || data.primaryName || "Partner");
    });

    // 3. Fetch all listings across collections for title lookup
    const listingTitleMap = new Map();
    const cols = ["businessOfferingsCollection", "eventsCollection", "jobsCollection", "consultingServicesCollection", "consultingCollection"];
    for (const c of cols) {
        try {
            const cg = await db.collectionGroup(c).get();
            cg.forEach(d => {
                const data = d.data() || {};
                const title = data.eventName || data.jobTitle || data.businessName || data.title || "";
                if (title) listingTitleMap.set(d.id, title);
            });
        } catch (e) {
            console.warn(`Could not load collectionGroup ${c}:`, e.message);
        }
    }

    // 4. Find transactions missing audit logs
    console.log("📥 Scanning transactionsCollection...");
    const txnSnap = await db.collection("transactionsCollection").get();
    const missingTxns = [];

    txnSnap.forEach(d => {
        const t = d.data();
        const hasLog = (t.sessionId && existingSessionIds.has(t.sessionId)) ||
                       (t.invoiceId && existingInvoiceIds.has(t.invoiceId));
        if (!hasLog) {
            missingTxns.push({ id: d.id, ...t });
        }
    });

    console.log(`📊 Found ${missingTxns.length} transactions needing audit logs.`);
    if (missingTxns.length === 0) {
        console.log("🎉 All transactions are already present in auditLogs!");
        return;
    }

    // 5. Generate audit log documents
    const newLogs = [];
    for (const t of missingTxns) {
        const desc = String(t.description || "").toLowerCase();
        const isUpgrade = desc.includes("upgrade");
        const isRenewal = desc.includes("renewal") || desc.includes("recurring");
        const isFeature = t.type === "feature" || Boolean(t.featureId);

        let action = "SUBSCRIPTION_PURCHASED";
        let details = "Initial Listing";
        if (isUpgrade) {
            action = isFeature ? "FEATURE_UPGRADED" : "PLAN_UPGRADED";
            details = t.description || "Plan upgraded";
        } else if (isRenewal) {
            action = isFeature ? "FEATURE_RENEWED" : "PLAN_RENEWED";
            details = isFeature ? "Feature renewals" : "Plan renewals";
        } else if (isFeature) {
            action = "FEATURE_ADDED";
            details = "Feature added";
        }

        const partnerName = t.businessName || partnerMap.get(t.partnerId) || "Partner";
        const listingTitle = (t.listingId && listingTitleMap.get(t.listingId)) || t.listingName || partnerName;

        newLogs.push({
            partnerId: t.partnerId || "",
            partnerName,
            action,
            details,
            category: "billing",
            performedBy: isRenewal ? "system" : "partner",
            metadata: {
                sessionId: t.sessionId || null,
                invoiceId: t.invoiceId || null,
                subscriptionId: t.subscriptionId || null,
                type: t.type || (isFeature ? "feature" : "listing"),
                planId: t.planId || null,
                featureId: t.featureId || null,
                group: t.group || null,
                listingId: t.listingId || null,
                listingName: listingTitle,
                collectionName: t.collectionName || null,
                paymentStatus: "Complete",
                amount: t.amount || null,
                backfilled: true,
            },
            timestamp: t.createdAt || admin.firestore.FieldValue.serverTimestamp()
        });
    }

    // 6. Write in batches of 450
    console.log(`💾 Writing ${newLogs.length} audit logs in batches...`);
    const CHUNK_SIZE = 450;
    for (let i = 0; i < newLogs.length; i += CHUNK_SIZE) {
        const chunk = newLogs.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();
        for (const logData of chunk) {
            const ref = db.collection("auditLogs").doc();
            batch.set(ref, logData);
        }
        await batch.commit();
        console.log(`  ✓ Committed batch ${Math.floor(i / CHUNK_SIZE) + 1} / ${Math.ceil(newLogs.length / CHUNK_SIZE)}`);
    }

    console.log("🎉 Successfully backfilled all missing transaction audit logs!");
}

backfillTransactionAuditLogs().catch(err => {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
}).then(() => process.exit(0));
