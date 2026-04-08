import admin from "firebase-admin";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(process.cwd());
const APPLY = process.argv.includes("--apply");
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split("=")[1]) : null;

const TARGETS = [
    { collection: "consultingServicesCollection", group: "consulting" },
    { collection: "consultingCollection", group: "consulting" },
    { collection: "eventsCollection", group: "events" },
    { collection: "jobsCollection", group: "jobs" },
];

function initAdmin() {
    const keyPath = resolve(ROOT, "server/pharmasocii_admin.json");
    if (existsSync(keyPath)) {
        const key = JSON.parse(readFileSync(keyPath, "utf8"));
        admin.initializeApp({ credential: admin.credential.cert(key) });
        return;
    }
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

function isEmptyValue(value) {
    if (value === undefined || value === null) return true;
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    return false;
}

function mergeWithTopPriority(embeddedData, topData) {
    const merged = { ...embeddedData, ...topData };

    // Preserve partnerId/group when top-level doc misses these.
    if (isEmptyValue(topData.partnerId) && !isEmptyValue(embeddedData.partnerId)) {
        merged.partnerId = embeddedData.partnerId;
    }
    if (isEmptyValue(topData.selectedGroup) && !isEmptyValue(embeddedData.selectedGroup)) {
        merged.selectedGroup = embeddedData.selectedGroup;
    }
    if (isEmptyValue(topData.selectedAddon) && !isEmptyValue(embeddedData.selectedAddon)) {
        merged.selectedAddon = embeddedData.selectedAddon;
    }
    if (isEmptyValue(topData.featuredPlacement) && !isEmptyValue(embeddedData.featuredPlacement)) {
        merged.featuredPlacement = embeddedData.featuredPlacement;
    }
    if (isEmptyValue(topData.status) && !isEmptyValue(embeddedData.status)) {
        merged.status = embeddedData.status;
    }

    return merged;
}

async function main() {
    initAdmin();
    const db = admin.firestore();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logsDir = resolve(ROOT, "server/migration-logs");
    mkdirSync(logsDir, { recursive: true });
    const logPath = resolve(logsDir, `nonbusiness-listings-${timestamp}${APPLY ? "-apply" : "-dry-run"}.json`);

    const summary = {
        mode: APPLY ? "apply" : "dry-run",
        generatedAt: new Date().toISOString(),
        totals: {
            scannedEmbeddedDocs: 0,
            toCreateTopLevel: 0,
            toMergeTopLevel: 0,
            toDeleteEmbedded: 0,
            migratedCreated: 0,
            migratedMerged: 0,
            deletedEmbedded: 0,
            errors: 0,
        },
        perCollection: {},
        actions: [],
    };

    for (const target of TARGETS) {
        const key = target.collection;
        summary.perCollection[key] = {
            embeddedFound: 0,
            create: 0,
            merge: 0,
            deleted: 0,
            errors: 0,
        };

        const embeddedSnap = await db.collectionGroup(target.collection).get();
        const embeddedDocs = embeddedSnap.docs.filter((docSnap) => docSnap.ref.path.startsWith("partnersCollection/"));
        const docsToProcess = LIMIT ? embeddedDocs.slice(0, LIMIT) : embeddedDocs;
        summary.perCollection[key].embeddedFound = docsToProcess.length;
        summary.totals.scannedEmbeddedDocs += docsToProcess.length;

        for (const docSnap of docsToProcess) {
            const embeddedRef = docSnap.ref;
            const topRef = db.collection(target.collection).doc(docSnap.id);
            const embeddedData = docSnap.data() || {};
            const topSnap = await topRef.get();
            const hasTop = topSnap.exists;
            const topData = hasTop ? (topSnap.data() || {}) : {};
            const actionType = hasTop ? "merge-top-and-delete-embedded" : "create-top-and-delete-embedded";
            const mergedData = hasTop ? mergeWithTopPriority(embeddedData, topData) : embeddedData;

            if (hasTop) {
                summary.perCollection[key].merge += 1;
                summary.totals.toMergeTopLevel += 1;
            } else {
                summary.perCollection[key].create += 1;
                summary.totals.toCreateTopLevel += 1;
            }
            summary.totals.toDeleteEmbedded += 1;

            const actionRecord = {
                collection: target.collection,
                id: docSnap.id,
                partnerPath: embeddedRef.path,
                topPath: topRef.path,
                actionType,
                before: {
                    embeddedData,
                    topData: hasTop ? topData : null,
                },
                status: "planned",
            };

            if (!APPLY) {
                summary.actions.push(actionRecord);
                continue;
            }

            try {
                await topRef.set({
                    ...mergedData,
                    migratedFromEmbeddedPath: embeddedRef.path,
                    migrationUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });

                if (hasTop) summary.totals.migratedMerged += 1;
                else summary.totals.migratedCreated += 1;

                await embeddedRef.delete();
                summary.totals.deletedEmbedded += 1;
                summary.perCollection[key].deleted += 1;

                actionRecord.status = "applied";
            } catch (error) {
                summary.totals.errors += 1;
                summary.perCollection[key].errors += 1;
                actionRecord.status = "error";
                actionRecord.error = error?.message || String(error);
            }

            summary.actions.push(actionRecord);
        }
    }

    writeFileSync(logPath, JSON.stringify(summary, null, 2), "utf8");

    console.log(JSON.stringify({
        mode: summary.mode,
        totals: summary.totals,
        perCollection: summary.perCollection,
        logPath,
    }, null, 2));
}

main().catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
});
