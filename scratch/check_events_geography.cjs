const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('/Users/arinkhosla/Desktop/pharmasocii/server/pharmasocii_admin.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const snapshot = await db.collection('eventsCollection').get();
  console.log(`Found ${snapshot.docs.length} events:`);
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  eventName: ${data.eventName}`);
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
