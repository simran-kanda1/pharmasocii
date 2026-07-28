const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Look for service account key
const serviceAccountPath = '/Users/arinkhosla/Desktop/pharmasocii/serviceAccountKey.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account key not found!');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

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
  
  fs.writeFileSync('/Users/arinkhosla/Desktop/pharmasocii/scratch/all_events_dump.json', JSON.stringify(events, null, 2));
  console.log('Saved dump to scratch/all_events_dump.json');
}

run().catch(console.error);
