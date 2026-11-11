// Checks the text files in /content before the site is published.
// Run with:  node tools/check-content.mjs
// It makes sure every file is valid JSON and that every place in the city plan has a name.
import { readFileSync, readdirSync } from 'node:fs';
import { PLACES, PLAQUES, PEOPLE } from '../src/world/layout.js';

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
for (const p of PLAQUES) {
  const t = names[p.id];
  if (!t) { fail(`locations.json has no entry for the plaque "${p.id}"`); continue; }
  for (const key of ['name', 'known', 'imagined']) if (!t[key] || !String(t[key]).trim()) fail(`locations.json: "${p.id}" is missing "${key}"`);
}
const ui = data['ui.json'] || {};
for (const key of ['title', 'subtitle', 'intro', 'start', 'continue', 'loading', 'howTouch', 'howKeys', 'mapTitle', 'mapClose', 'mapOpen', 'imaginedTag', 'mapNote', 'compass', 'errorNoWebGL', 'talk', 'goodbye', 'talkHint', 'scriptureNoteHead', 'plaqueKnown', 'plaqueImagined', 'read', 'close', 'imaginedBadge', 'plaqueHint']) {
  if (!(key in ui)) fail(`ui.json is missing "${key}"`);
}
if (ui.compass && ui.compass.length !== 8) fail('ui.json "compass" needs exactly 8 entries (N, NE, E, SE, S, SW, W, NW)');

// ---------- Scripture: every quotation must match the World English Bible exactly ----------
const BOOKS = { Ephesians: 'docs/web-reference/ephesians.json', Acts: 'docs/web-reference/acts-18-20.json' };
const web = {};
for (const [book, file] of Object.entries(BOOKS)) web[book] = JSON.parse(readFileSync(file, 'utf8'));
const squash = (t) => t.replace(/\s+/g, ' ').trim();
// "Acts 20:20–21", "Ephesians 1:1–14", "Ephesians 5:21–6:9", "Acts 19:28"
function versesFor(ref) {
  const m = /^(Ephesians|Acts) (\d+):(\d+)(?:[–-](?:(\d+):)?(\d+))?$/.exec(ref.trim());
  if (!m) return null;
  const book = web[m[1]], c1 = +m[2], v1 = +m[3], c2 = m[4] ? +m[4] : c1, v2 = m[5] ? +m[5] : v1, out = [];
  for (let c = c1; c <= c2; c++) {
    for (let v = (c === c1 ? v1 : 1); ; v++) {
      if (c === c2 && v > v2) break;
      const t = book[`${c}:${v}`];
      if (!t) { if (c === c2) return null; break; }
      out.push(t);
    }
  }
  return out.length ? squash(out.join(' ')) : null;
}
function checkScripture(where, sc, whole) {
  if (!sc || !sc.ref || !sc.text) { fail(`${where}: a "scripture" entry needs both "ref" and "text"`); return; }
  const full = versesFor(sc.ref);
  if (!full) { fail(`${where}: I can't find "${sc.ref}" in the reference text (use the form "Ephesians 1:1–14" or "Acts 19:28")`); return; }
  const got = squash(sc.text);
  if (whole ? got !== full : !full.includes(got)) {
    let i = 0; while (i < got.length && i < full.length && got[i] === full[i]) i++;
    fail(`${where}: the text for ${sc.ref} does not match the World English Bible.` + (whole || full.startsWith(got.slice(0, 20))
      ? `\n      It first differs here: "…${got.slice(Math.max(0, i - 25), i + 25)}…"\n      The WEB has:         "…${full.slice(Math.max(0, i - 25), i + 25)}…"` : ''));
  }
}

// ---------- characters and their conversations ----------
const chars = data['characters.json'] || {};
for (const p of PEOPLE) if (!chars[p.talk]) fail(`characters.json has no entry "${p.talk}" (needed by the person "${p.id}")`);
for (const [id, c] of Object.entries(chars)) {
  const at = `characters.json "${id}"`;
  for (const key of ['name', 'role', 'about']) if (!c[key]) fail(`${at} is missing "${key}"`);
  if (c.scripture) { checkScripture(at, c.scripture, false); if (!c.note) fail(`${at} needs a "note" explaining the quotation`); continue; }
  if (!c.nodes || !c.nodes[c.start]) { fail(`${at}: "start" must name one of its nodes`); continue; }
  for (const [nid, n] of Object.entries(c.nodes)) {
    const here = `${at} node "${nid}"`;
    if (!n.text || !String(n.text).trim()) fail(`${here} has no text`);
    else if (n.text.split(/\s+/).length > 60) fail(`${here} is too long (${n.text.split(/\s+/).length} words; keep it under about 45)`);
    if (n.scripture) checkScripture(here, n.scripture, false);
    if (n.end) { if (n.choices) fail(`${here} is an ending, so it should not have choices`); continue; }
    if (!Array.isArray(n.choices) || n.choices.length < 2 || n.choices.length > 4) { fail(`${here} needs 2 to 4 choices (or "end": true)`); continue; }
    for (const ch of n.choices) {
      if (!ch.label) fail(`${here} has a choice with no label`);
      if (!c.nodes[ch.to]) fail(`${here}: the choice "${ch.label}" points to "${ch.to}", which doesn't exist`);
    }
  }
  // every node can be reached, and every node can reach an ending
  const next = (nid) => (c.nodes[nid].choices || []).map((ch) => ch.to).filter((t) => c.nodes[t]);
  const seen = new Set([c.start]), queue = [c.start];
  while (queue.length) for (const t of next(queue.pop())) if (!seen.has(t)) { seen.add(t); queue.push(t); }
  for (const nid of Object.keys(c.nodes)) if (!seen.has(nid)) fail(`${at}: node "${nid}" can never be reached`);
  const canEnd = new Set(Object.keys(c.nodes).filter((nid) => c.nodes[nid].end));
  for (let changed = true; changed;) { changed = false; for (const nid of Object.keys(c.nodes)) if (!canEnd.has(nid) && next(nid).some((t) => canEnd.has(t))) { canEnd.add(nid); changed = true; } }
  for (const nid of Object.keys(c.nodes)) if (!canEnd.has(nid)) fail(`${at}: from node "${nid}" the conversation can never end`);
}

if (problems) { console.error(`\n${problems} problem(s) found. Nothing was published.`); process.exit(1); }
console.log('\nAll content files look good.');
