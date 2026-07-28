import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';

const serviceAccount = JSON.parse(
  await readFile(new URL('./pharmasocii_admin.json', import.meta.url))
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const snapshot = await db.collection('eventsCollection')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  console.log(`Found ${snapshot.docs.length} recent events:`);
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  eventName: ${data.eventName}`);
    console.log(`  createdAt: ${data.createdAt ? data.createdAt.toDate().toISOString() : 'N/A'}`);
    console.log(`  location (venue): ${data.location}`);
    console.log(`  city: ${data.city}`);
    console.log(`  state: ${data.state}`);
    console.log(`  stateRegion: ${data.stateRegion}`);
    console.log(`  country: ${data.country}`);
    console.log(`  eventCountry: ${data.eventCountry}`);
    console.log('---');
  });
}

run().catch(console.error);
