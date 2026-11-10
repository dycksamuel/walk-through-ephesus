// Checks the text files in /content before the site is published.
// Run with:  node tools/check-content.mjs
// It makes sure every file is valid JSON and that every place in the city plan has a name.
import { readFileSync, readdirSync } from 'node:fs';
import { PLACES } from '../src/world/layout.js';

let problems = 0;
const fail = (msg) => { console.error('  ✗ ' + msg); problems++; };
const data = {};

for (const file of readdirSync('content').filter((f) => f.endsWith('.json'))) {
  try {
    data[file] = JSON.parse(readFileSync('content/' + file, 'utf8'));
    console.log('  ✓ ' + file);
  } catch (e) {
    fail(`${file} is not valid JSON: ${e.message}`);
  }
}

const names = data['locations.json'] || {};
for (const p of PLACES) {
  if (!names[p.id] || !names[p.id].name) fail(`locations.json has no "name" for the place "${p.id}"`);
}
const ui = data['ui.json'] || {};
for (const key of ['title', 'subtitle', 'intro', 'start', 'continue', 'loading', 'howTouch', 'howKeys', 'mapTitle', 'mapClose', 'mapOpen', 'imaginedTag', 'mapNote', 'compass', 'errorNoWebGL']) {
  if (!(key in ui)) fail(`ui.json is missing "${key}"`);
}
if (ui.compass && ui.compass.length !== 8) fail('ui.json "compass" needs exactly 8 entries (N, NE, E, SE, S, SW, W, NW)');

if (problems) { console.error(`\n${problems} problem(s) found. Nothing was published.`); process.exit(1); }
console.log('\nAll content files look good.');
