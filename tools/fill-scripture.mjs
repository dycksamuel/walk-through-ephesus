// Fills in the exact World English Bible wording for every passage named in
// content/fragments.json and content/riot.json, from the reference copy in docs/web-reference.
// Run with:  node tools/fill-scripture.mjs
// You only need this if you change a "ref" (which verses a fragment or riot step shows).
import { readFileSync, writeFileSync } from 'node:fs';

const BOOKS = { Ephesians: 'docs/web-reference/ephesians.json', Acts: 'docs/web-reference/acts-18-20.json' };
const web = {};
for (const [book, file] of Object.entries(BOOKS)) web[book] = JSON.parse(readFileSync(file, 'utf8'));

export function versesFor(ref) {
  const m = /^(Ephesians|Acts) (\d+):(\d+)(?:[–-](?:(\d+):)?(\d+))?$/.exec(String(ref).trim());
  if (!m) return null;
  const book = web[m[1]], c1 = +m[2], v1 = +m[3], c2 = m[4] ? +m[4] : c1, v2 = m[5] ? +m[5] : v1, out = [];
  for (let c = c1; c <= c2; c++) {
    for (let v = (c === c1 ? v1 : 1); ; v++) {
      if (c === c2 && v > v2) break;
      const t = book[`${c}:${v}`];
      if (!t) { if (c === c2) return null; break; }
      // show the chapter number on the first verse and whenever the chapter changes
      out.push([(out.length === 0 || v === 1) ? `${c}:${v}` : String(v), t]);
    }
  }
  return out.length ? out : null;
}

if (process.argv[1] && process.argv[1].endsWith('fill-scripture.mjs')) {
  const fill = (item, where) => {
    if (!item || !item.ref) return;
    const v = versesFor(item.ref);
    if (!v) { console.error(`  ✗ ${where}: can't find "${item.ref}"`); process.exitCode = 1; return; }
    item.verses = v; console.log(`  ✓ ${where}: ${item.ref} (${v.length} verses)`);
  };
  const save = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  const fr = JSON.parse(readFileSync('content/fragments.json', 'utf8'));
  fr.fragments.forEach((f) => fill(f, `fragment "${f.id}"`)); fill(fr.epilogue, 'epilogue');
  save('content/fragments.json', fr);
  const riot = JSON.parse(readFileSync('content/riot.json', 'utf8'));
  riot.steps.forEach((s, i) => fill(s, `riot step ${i + 1}`));
  fill(riot.journal, 'riot journal page');
  save('content/riot.json', riot);
}
