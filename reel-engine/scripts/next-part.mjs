#!/usr/bin/env node
// Counts the votes in the comments of a part and prepares the next part:
// carries the story state over (days, budget, everything built) and adds an
// opening "results" beat ("68% of you chose to OPEN THE DOOR").
//
//   npm run next-part -- --from episodes/part1.json --comments data/part1-comments.csv
//   npm run next-part -- --from episodes/part1.json --votes open=1834,leave=912
//
// CSV columns: username, comment (one vote per username; the first option
// whose keywords appear in the comment counts; comments matching both are ignored).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './serve.mjs';

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true; else { o[a.slice(2)] = n; i++; }
  }
  return o;
}

function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',' || c === ';' || c === '\t') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else f += c;
  }
  row.push(f); if (row.some((x) => x.trim())) rows.push(row);
  const h = rows.shift().map((x) => x.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const args = parseArgs(process.argv.slice(2));
const fromPath = args.from || 'episodes/part1.json';
const prev = JSON.parse(fs.readFileSync(path.join(ROOT, fromPath), 'utf8'));
if (!prev.choice) { console.error('The previous part has no "choice" block.'); process.exit(1); }
const options = prev.choice.options;

// ------------------------------------------------------------- count votes
const counts = Object.fromEntries(options.map((o) => [o.id, 0]));
const voters = [];
if (args.votes) {
  for (const kv of String(args.votes).split(',')) { const [k, v] = kv.split('='); if (k in counts) counts[k] = Number(v) || 0; }
} else if (args.comments) {
  const seen = new Set();
  let ignored = 0;
  for (const r of parseCsv(fs.readFileSync(path.resolve(args.comments), 'utf8'))) {
    const user = (r.username || r.user || '').toLowerCase().replace(/^@/, '');
    const raw = (r.comment || r.text || '').trim();
    const txt = ' ' + raw.toLowerCase() + ' ';
    if (!user || seen.has(user)) continue;
    const hits = options.filter((o) => o.match.some((m) => txt.includes(m.toLowerCase())));
    if (hits.length !== 1) { ignored++; continue; }
    seen.add(user);
    counts[hits[0].id]++;
    voters.push({ name: '@' + user, text: raw.slice(0, 34), vote: hits[0].id, likes: Number(r.likes || 0) || 0 });
  }
  console.log(`Comments without a clear vote (ignored): ${ignored}`);
} else {
  console.error('Give --comments <file.csv> or --votes open=123,leave=45');
  process.exit(1);
}
const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
const winner = options.reduce((a, b) => (counts[b.id] > counts[a.id] ? b : a));
const results = options.map((o) => ({ id: o.id, label: o.label, votes: counts[o.id], percent: Math.round((counts[o.id] / total) * 1000) / 10, winner: o.id === winner.id }));

// ------------------------------------------------------------- final state of the previous part
let days = prev.start?.days ?? 200;
let budget = prev.start?.budget ?? 1000000;
const features = new Set(prev.start?.features || []);
for (const b of prev.beats) for (const e of b.events || []) {
  if (e.days != null) days = e.days;
  if (e.spend) budget -= e.spend;
  if (e.build) features.add(e.build);
}

const part = (prev.part || 1) + 1;
const pct = results.find((r) => r.winner).percent;
const next = {
  series: prev.series,
  part,
  voice: prev.voice,
  style: prev.style,
  hudDaysLabel: prev.hudDaysLabel,
  hud: prev.hud,
  mascot: prev.mascot,
  start: { days, budget, budgetVisible: true, features: [...features], wall: [...new Set([...(prev.start?.wall || []), ...voters.map((v) => v.name)])] },
  commenters: [...voters].sort((a, b) => b.likes - a.likes).slice(0, 7).map(({ name, text }) => ({ name, text })),
  history: [...(prev.history || []), { part: prev.part || 1, question: prev.choice.question, winner: winner.id, results }],
  coverTime: 1.5,
  cover: { html: `<div class="cover-part">PART ${part}</div><div class="t">YOU CHOSE:<br><span class="y">${winner.label}</span></div>` },
  beats: [
    {
      id: '01', scene: 'recap', args: { results },
      say: `In part ${part - 1}, you voted. ${Math.round(pct)} percent of you chose to ${winner.label.toLowerCase()}.`,
      keys: [
        { at: 'you voted', slot: 'top', style: 'white', show: 'YOU VOTED' },
        { at: 'chose', slot: 'bottom', style: winner.color === 'red' ? 'stamp-red' : 'stamp-green', show: winner.label },
      ],
    },
    ...(voters.length ? [{
      id: '02', scene: 'wall',
      say: 'Everyone who voted now has their name on the bunker wall.',
      keys: [{ at: 'Everyone', slot: 'top', style: 'white', show: 'YOUR NAMES ARE ON THE WALL' }],
    }] : []),
    {
      id: '03', scene: 'compose', args: { layers: [{ type: 'bg', preset: 'night' }, { type: 'label', text: 'TODO', x: 540, y: 960, size: 120 }] },
      say: `TODO: write what happens after "${winner.label}". Every sentence becomes one beat like in part ${part - 1}.`,
      keys: [],
    },
  ],
  choice: {
    question: 'TODO: the next question?',
    options: [
      { id: 'a', label: 'OPTION A', short: 'A', color: 'green', match: ['option a', ' a '] },
      { id: 'b', label: 'OPTION B', short: 'B', color: 'red', match: ['option b', ' b '] },
    ],
  },
  endHold: 3.0,
};
const out = args.out || `episodes/part${part}.json`;
fs.writeFileSync(path.join(ROOT, out), JSON.stringify(next, null, 2));
console.log('\nVote results:');
for (const r of results) console.log(`  ${r.winner ? '★' : ' '} ${r.label.padEnd(22)} ${String(r.votes).padStart(6)} votes  ${r.percent}%`);
console.log(`\nState carried over: day ${days}, budget $${budget.toLocaleString('en-US')}, built: ${[...features].join(', ')}`);
console.log(`\nSaved → ${out}\nWrite the part ${part} script in it (replace the TODO beat + the choice), then:`);
console.log(`  npm run voice  -- --episode ${out}\n  npm run render -- --episode ${out}\n`);
