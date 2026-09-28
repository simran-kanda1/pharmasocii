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

async function backfillAuditLogs() {
    console.log("🚀 Starting Audit Logs Backfill...");

    // 1. Load existing audit logs
    console.log("📥 Fetching existing audit logs...");
    const auditSnap = await db.collection("auditLogs").get();
    const existingPartnerAccountLogs = new Set();
    const existingListingIds = new Set();
    const existingPartnerListingLogs = new Map();

    auditSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.partnerId && (d.action === "ACCOUNT_CREATED" || d.category === "account")) {
            existingPartnerAccountLogs.add(d.partnerId);
        }
        if (d.metadata?.listingId) {
            existingListingIds.add(d.metadata.listingId);
        }
        if (d.partnerId) {
            if (!existingPartnerListingLogs.has(d.partnerId)) {
                existingPartnerListingLogs.set(d.partnerId, new Set());
            }
            if (d.details) existingPartnerListingLogs.get(d.partnerId).add(d.details.toLowerCase());
        }
    });

    console.log(`✓ Found ${auditSnap.size} existing audit logs in database.`);

    // 2. Fetch partners
    console.log("📥 Fetching all partners...");
    const pSnap = await db.collection("partnersCollection").get();
    const partnerMap = new Map();
    const newLogs = [];

    pSnap.docs.forEach(doc => {
        const d = doc.data() || {};
        const pId = doc.id;
        const name = d.businessName || d.companyName || d.primaryName || "Unnamed Partner";
        partnerMap.set(pId, { name, data: d });

        if (!existingPartnerAccountLogs.has(pId)) {
            const contactName = d.primaryName || `${d.firstName || ''} ${d.lastName || ''}`.trim() || name;
            const createdTs = d.createdAt || admin.firestore.FieldValue.serverTimestamp();
            const isAdmin = Boolean(d.createdByAdmin);

            newLogs.push({
                partnerId: pId,
                partnerName: name,
                action: "ACCOUNT_CREATED",
                details: isAdmin
                    ? `Partner account created by admin for ${name}.`
                    : `Partner account created for ${contactName}.`,
                category: "account",
                performedBy: isAdmin ? "admin" : "partner",
                metadata: {
                    email: d.email || d.primaryEmail || "",
                    phone: d.phone || d.phoneNumber || "",
                    createdByAdmin: isAdmin,
                    backfilled: true
                },
                timestamp: createdTs
            });
        }
    });

    console.log(`✓ Prepared ${newLogs.length} missing ACCOUNT_CREATED audit logs.`);

    // 3. Fetch listings across all collections
    console.log("📥 Fetching all listings across collections...");
    const cols = [
        "businessOfferingsCollection",
        "eventsCollection",
        "jobsCollection",
        "consultingServicesCollection",
        "consultingCollection"
    ];
    const seenListingIds = new Set();
    let listingLogsCount = 0;

    for (const colName of cols) {
        const cgSnap = await db.collectionGroup(colName).get();
        for (const doc of cgSnap.docs) {
            if (seenListingIds.has(doc.id)) continue;
            seenListingIds.add(doc.id);

            const d = doc.data() || {};
            const pId = d.partnerId || (doc.ref.path.includes("partnersCollection") ? doc.ref.path.split("/")[1] : "");
            const title = d.eventName || d.jobTitle || d.businessName || d.companyName || "Listing";

            const hasExplicitListingId = existingListingIds.has(doc.id);
            const partnerLogs = pId ? existingPartnerListingLogs.get(pId) : null;
            const hasTitleInLogs = partnerLogs && title && Array.from(partnerLogs).some(det => det.includes(title.toLowerCase()));

            if (!hasExplicitListingId && !hasTitleInLogs) {
                const partnerInfo = partnerMap.get(pId);
                const partnerName = partnerInfo?.name || d.businessName || d.companyName || "Unnamed Partner";
                const isAdmin = Boolean(d.createdByAdmin || partnerInfo?.data?.createdByAdmin);
                const groupLabel = colName === "eventsCollection" ? "Event" :
                                   colName === "jobsCollection" ? "Job" :
                                   colName.includes("consulting") ? "Consulting Service" : "Business Offering";
                const createdTs = d.createdAt || partnerInfo?.data?.createdAt || admin.firestore.FieldValue.serverTimestamp();

                newLogs.push({
                    partnerId: pId || doc.id,
                    partnerName,
                    action: "LISTING_CREATED",
                    details: `New ${groupLabel} listing created: "${title}".`,
                    category: "listing",
                    performedBy: isAdmin ? "admin" : "partner",
                    metadata: {
                        listingId: doc.id,
                        type: d.selectedGroup || (colName === "eventsCollection" ? "events" : colName === "jobsCollection" ? "jobs" : colName.includes("consulting") ? "consulting" : "business_offerings"),
                        collectionName: colName,
                        plan: d.selectedPlan || "none",
                        isFeatured: Boolean(d.isFeatured || d.selectedAddon),
                        createdByAdmin: isAdmin,
                        backfilled: true
                    },
                    timestamp: createdTs
                });
                listingLogsCount++;
            }
        }
    }

    console.log(`✓ Prepared ${listingLogsCount} missing LISTING_CREATED audit logs.`);
    console.log(`📊 Total new audit logs to write: ${newLogs.length}`);

    if (newLogs.length === 0) {
        console.log("🎉 All partners and listings already have audit logs. Nothing to write!");
        return;
    }

    // 4. Batch write in chunks of 450
    console.log("💾 Writing audit logs to Firestore in batches...");
    const CHUNK_SIZE = 450;
    for (let i = 0; i < newLogs.length; i += CHUNK_SIZE) {
        const chunk = newLogs.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();

        chunk.forEach(logData => {
            const ref = db.collection("auditLogs").doc();
            batch.set(ref, logData);
        });

        await batch.commit();
        console.log(`  ✓ Committed batch ${Math.floor(i / CHUNK_SIZE) + 1} / ${Math.ceil(newLogs.length / CHUNK_SIZE)} (${Math.min(i + CHUNK_SIZE, newLogs.length)} / ${newLogs.length})`);
    }

    console.log("🎉 Audit logs backfill complete successfully!");
}

backfillAuditLogs().catch(err => {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
}).then(() => process.exit(0));
