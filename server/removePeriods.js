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
  if (!docSnap.exists) {
    console.log("No plansConfig found.");
    return;
  }
  
  const data = docSnap.data();
  let changed = false;
  
  if (data.groups) {
    data.groups.forEach(g => {
      if (typeof g.description === 'string' && g.description.trim().endsWith('.')) {
        g.description = g.description.trim().slice(0, -1);
        changed = true;
      }
      if (typeof g.subtitle === 'string' && g.subtitle.trim().endsWith('.')) {
        g.subtitle = g.subtitle.trim().slice(0, -1);
        changed = true;
      }
      if (g.plans) {
        g.plans.forEach(p => {
          if (typeof p.description === 'string' && p.description.trim().endsWith('.')) {
            p.description = p.description.trim().slice(0, -1);
            changed = true;
          }
          if (typeof p.subtitle === 'string' && p.subtitle.trim().endsWith('.')) {
            p.subtitle = p.subtitle.trim().slice(0, -1);
            changed = true;
          }
          if (typeof p.notes === 'string' && p.notes.trim().endsWith('.')) {
            p.notes = p.notes.trim().slice(0, -1);
            changed = true;
          }
        });
      }
    });
  }
  
  if (changed) {
    await docRef.set(data);
    console.log("Updated plansConfig and removed trailing periods.");
  } else {
    console.log("No periods found to remove.");
  }
}

run().catch(console.error);
