import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dumpPath = path.join(__dirname, 'all_events_dump.json');
const events = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

console.log(`Total events: ${events.length}`);

// Sample 5 events that have location and check their fields
let count = 0;
for (const evt of events) {
  const data = evt.data;
  if (data.location && String(data.location).trim()) {
    console.log(`\nEvent ID: ${evt.id}`);
    console.log(`Name: ${data.eventName}`);
    console.log(`location: ${JSON.stringify(data.location)}`);
    console.log(`city: ${JSON.stringify(data.city)}`);
    console.log(`stateRegion: ${JSON.stringify(data.stateRegion)}`);
    console.log(`eventCountry: ${JSON.stringify(data.eventCountry)}`);
    console.log(`state: ${JSON.stringify(data.state)}`);
    console.log(`country: ${JSON.stringify(data.country)}`);
    count++;
    if (count >= 10) break;
  }
}
