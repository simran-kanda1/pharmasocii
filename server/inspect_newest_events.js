import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dumpPath = path.join(__dirname, 'all_events_dump.json');
const events = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

// Sort events by createdAt descending (if seconds field exists)
const sortedEvents = events
  .filter(e => e.data.createdAt)
  .sort((a, b) => {
    const aTime = a.data.createdAt._seconds || 0;
    const bTime = b.data.createdAt._seconds || 0;
    return bTime - aTime;
  });

console.log("Newest 5 events:");
sortedEvents.slice(0, 5).forEach(e => {
  console.log(`ID: ${e.id}`);
  console.log(`Name: ${e.data.eventName}`);
  console.log(`location (venue): ${JSON.stringify(e.data.location)}`);
  console.log(`city: ${JSON.stringify(e.data.city)}`);
  console.log(`stateRegion: ${JSON.stringify(e.data.stateRegion)}`);
  console.log(`eventCountry: ${JSON.stringify(e.data.eventCountry)}`);
  console.log(`state: ${JSON.stringify(e.data.state)}`);
  console.log(`country: ${JSON.stringify(e.data.country)}`);
  console.log(`createdAt: ${JSON.stringify(e.data.createdAt)}`);
  console.log('---');
});
