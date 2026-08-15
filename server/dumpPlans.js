import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = resolve(__dirname, "pharmasocii_admin.json");

if (existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "pharmasocii"
    });
} else {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: "pharmasocii"
    });
}

const db = admin.firestore();

async function run() {
  const docRef = db.collection('config').doc('plansConfig');
  const docSnap = await docRef.get();
  console.log(JSON.stringify(docSnap.data(), null, 2));
}

run().catch(console.error);
