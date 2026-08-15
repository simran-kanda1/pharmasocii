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
    const jobsGroup = data.groups.find(g => g.id === 'jobs');
    if (jobsGroup && jobsGroup.plans) {
        jobsGroup.plans.forEach(p => {
            if (p.id === 'job_premium' && p.subtitle === 'Premium Job Listing') {
                p.subtitle = 'Listing + Landing Page Feature';
                changed = true;
            } else if (p.id === 'job_premium_plus' && p.subtitle === 'Premium Plus Job Listing') {
                p.subtitle = 'Listing + Home Page Feature';
                changed = true;
            }
        });
    }
  }
  
  if (changed) {
    await docRef.set(data);
    console.log("Updated jobs subtitles in plansConfig.");
  } else {
    console.log("No subtitles needed updating.");
  }
}

run().catch(console.error);
