import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dumpPath = path.join(__dirname, 'all_events_dump.json');
const events = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

events.forEach(evt => {
  const data = evt.data;
  if (!data.location || !String(data.location).trim()) {
    console.log(`ID: ${evt.id}, Name: "${data.eventName}", Created: ${data.createdAt}, city: "${data.city}", stateRegion: "${data.stateRegion}", eventCountry: "${data.eventCountry}"`);
  }
});
