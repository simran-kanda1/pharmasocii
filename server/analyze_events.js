import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dumpPath = path.join(__dirname, 'all_events_dump.json');
const events = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

let hasLocation = 0;
let emptyLocation = 0;
let missingLocation = 0;
let hasStateRegion = 0;
let hasState = 0;
let hasEventCountry = 0;
let hasCountry = 0;

const emptyLocationSample = [];
const missingLocationSample = [];

events.forEach(evt => {
  const data = evt.data;
  
  if ('location' in data) {
    if (String(data.location).trim()) {
      hasLocation++;
    } else {
      emptyLocation++;
      if (emptyLocationSample.length < 5) emptyLocationSample.push({ id: evt.id, name: data.eventName, data });
    }
  } else {
    missingLocation++;
    if (missingLocationSample.length < 5) missingLocationSample.push({ id: evt.id, name: data.eventName, data });
  }
  
  if ('stateRegion' in data && data.stateRegion) hasStateRegion++;
  if ('state' in data && data.state) hasState++;
  if ('eventCountry' in data && data.eventCountry) hasEventCountry++;
  if ('country' in data && data.country) hasCountry++;
});

console.log(`Total events: ${events.length}`);
console.log(`Has location: ${hasLocation}`);
console.log(`Empty location string: ${emptyLocation}`);
console.log(`Missing location field: ${missingLocation}`);
console.log(`Has stateRegion: ${hasStateRegion}`);
console.log(`Has state (legacy): ${hasState}`);
console.log(`Has eventCountry: ${hasEventCountry}`);
console.log(`Has country (legacy): ${hasCountry}`);

console.log('\nSample empty location events:');
emptyLocationSample.forEach(s => {
  console.log(`ID: ${s.id}, Name: "${s.name}"`);
  console.log(`  location: "${s.data.location}", city: "${s.data.city}", stateRegion: "${s.data.stateRegion}", state: "${s.data.state}", eventCountry: "${s.data.eventCountry}", country: "${s.data.country}"`);
});

console.log('\nSample missing location events:');
missingLocationSample.forEach(s => {
  console.log(`ID: ${s.id}, Name: "${s.name}"`);
  console.log(`  city: "${s.data.city}", stateRegion: "${s.data.stateRegion}", state: "${s.data.state}", eventCountry: "${s.data.eventCountry}", country: "${s.data.country}"`);
});
