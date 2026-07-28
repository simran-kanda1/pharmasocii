import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.join(__dirname, 'pharmasocii_admin.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account key not found at', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const snapshot = await db.collection('eventsCollection').get();
  console.log(`Found ${snapshot.size} events:`);
  
  const events = [];
  snapshot.forEach(doc => {
    events.push({
      id: doc.id,
      data: doc.data()
    });
  });
  
  const outPath = path.join(__dirname, 'all_events_dump.json');
  fs.writeFileSync(outPath, JSON.stringify(events, null, 2));
  console.log('Saved dump to', outPath);
}

run().catch(console.error);
