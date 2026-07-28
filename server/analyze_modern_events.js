import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dumpPath = path.join(__dirname, 'all_events_dump.json');
const events = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

console.log(`Total events: ${events.length}`);

events.forEach(evt => {
  const data = evt.data;
  // If it's a modern event (has stateRegion or eventCountry)
  if (data.stateRegion !== undefined || data.eventCountry !== undefined) {
    console.log(`ID: ${evt.id}`);
    console.log(`  eventName: "${data.eventName}"`);
    console.log(`  location (venue): "${data.location}"`);
    console.log(`  city: "${data.city}"`);
    console.log(`  stateRegion: "${data.stateRegion}"`);
    console.log(`  eventCountry: "${data.eventCountry}"`);
    console.log(`  state (legacy): "${data.state}"`);
    console.log(`  country (legacy): "${data.country}"`);
  }
});
