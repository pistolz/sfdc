#!/usr/bin/env node
// Build tomorrow's episode from yesterday's episode + a CSV of comments.
//
//   npm run new-day -- --comments data/comments-day01.csv --followers 1250
//
// CSV columns (header row required, extra columns ignored):
//   username   (required)  instagram handle, with or without @
//   comment    (optional)  full comment text → country + requests are read from it
//   likes      (optional)  likes on the comment → most liked = VIP of the day
//   country    (optional)  ISO code (fr, us, br…) — overrides what's read from the comment
//   request    (optional)  e.g. "red, pool, helipad" — overrides what's read from the comment
//
// Options
//   --prev <episode.json>  previous episode (default: highest episodes/dayNN.json)
//   --out <episode.json>   output (default: episodes/dayNN.json for the next day)
//   --followers <n>        follower count to show on the counter (default: number of yachts)
//   --theme day|sunset|night
//   --featured <n>         how many personalised yachts get a close-up (default 4)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './serve.mjs';

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = next; i++; }
  }
  return o;
}

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === ';' || c === '\t') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  const header = rows.shift().map((h) => h.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

// --------------------------------------------------------------- countries
const COUNTRY_NAMES = {
  fr: ['france', 'francia', 'frança'], us: ['usa', 'united states', 'america', 'etats-unis', 'états-unis', 'eeuu'],
  gb: ['uk', 'england', 'united kingdom', 'angleterre', 'royaume-uni', 'inglaterra'], br: ['brazil', 'brasil', 'brésil'],
  ma: ['morocco', 'maroc', 'marruecos', 'marrocos'], dz: ['algeria', 'algérie', 'algerie', 'argelia'], tn: ['tunisia', 'tunisie', 'túnez', 'tunez'],
  es: ['spain', 'espagne', 'españa', 'espana', 'espanha'], pt: ['portugal'], it: ['italy', 'italie', 'italia'], de: ['germany', 'allemagne', 'alemania', 'deutschland'],
  be: ['belgium', 'belgique', 'bélgica'], ch: ['switzerland', 'suisse', 'suiza'], nl: ['netherlands', 'pays-bas', 'holland', 'holanda'],
  ca: ['canada', 'canadá'], mx: ['mexico', 'méxico', 'mexique'], ar: ['argentina', 'argentine'], co: ['colombia', 'colombie'], cl: ['chile', 'chili'],
  pe: ['peru', 'pérou', 'perú'], ve: ['venezuela'], tr: ['turkey', 'turquie', 'türkiye', 'turquia'], eg: ['egypt', 'égypte', 'egipto'],
  sa: ['saudi', 'saudi arabia', 'arabie saoudite'], ae: ['uae', 'dubai', 'emirates', 'émirats'], qa: ['qatar'], in: ['india', 'inde'],
  pk: ['pakistan'], bd: ['bangladesh'], id: ['indonesia', 'indonésie'], ph: ['philippines', 'filipinas'], my: ['malaysia', 'malaisie'],
  th: ['thailand', 'thaïlande'], vn: ['vietnam'], cn: ['china', 'chine'], jp: ['japan', 'japon'], kr: ['korea', 'south korea', 'corée'],
  au: ['australia', 'australie'], nz: ['new zealand'], ng: ['nigeria'], gh: ['ghana'], sn: ['senegal', 'sénégal'], ci: ['ivory coast', "côte d'ivoire", 'cote divoire'],
  cm: ['cameroon', 'cameroun'], ke: ['kenya'], za: ['south africa', 'afrique du sud'], ru: ['russia', 'russie'], ua: ['ukraine'], pl: ['poland', 'pologne', 'polska'],
  ro: ['romania', 'roumanie'], gr: ['greece', 'grèce', 'grecia'], se: ['sweden', 'suède'], no: ['norway', 'norvège'], dk: ['denmark', 'danemark'],
  ie: ['ireland', 'irlande'], at: ['austria', 'autriche'], cz: ['czechia', 'czech republic', 'tchéquie'], hu: ['hungary', 'hongrie'], rs: ['serbia', 'serbie'],
  hr: ['croatia', 'croatie'], al: ['albania', 'albanie'], iq: ['iraq', 'irak'], ir: ['iran'], lb: ['lebanon', 'liban'], jo: ['jordan', 'jordanie'],
  ps: ['palestine'], sy: ['syria', 'syrie'], kw: ['kuwait', 'koweït'], ht: ['haiti', 'haïti'], do: ['dominican republic', 'république dominicaine'],
  cu: ['cuba'], pr: ['puerto rico', 'porto rico'], jm: ['jamaica', 'jamaïque'], ec: ['ecuador', 'équateur'], bo: ['bolivia', 'bolivie'],
  uy: ['uruguay'], py: ['paraguay'], cr: ['costa rica'], gt: ['guatemala'], hn: ['honduras'], ml: ['mali'], cd: ['congo', 'rdc', 'drc'],
};
const NAME_TO_CODE = Object.entries(COUNTRY_NAMES).flatMap(([cc, names]) => names.map((n) => [n, cc])).sort((a, b) => b[0].length - a[0].length);
const VALID = new Set(fs.readdirSync(path.join(ROOT, 'node_modules/flag-icons/flags/4x3')).map((f) => f.replace('.svg', '')));

export function findCountry(text) {
  const flag = text.match(/([\u{1F1E6}-\u{1F1FF}])([\u{1F1E6}-\u{1F1FF}])/u);
  if (flag) {
    const cc = String.fromCharCode(flag[1].codePointAt(0) - 0x1f1e6 + 97, flag[2].codePointAt(0) - 0x1f1e6 + 97);
    if (VALID.has(cc)) return cc;
  }
  const low = ' ' + text.toLowerCase().replace(/[^\p{L}\s'-]/gu, ' ').replace(/\s+/g, ' ') + ' ';
  for (const [name, cc] of NAME_TO_CODE) if (low.includes(' ' + name + ' ')) return cc;
  return null;
}

// --------------------------------------------------------------- requests
const COLORS = [
  ['#11151f', ['black', 'noir', 'noire', 'negro', 'negra', 'preto', 'preta']],
  ['#e8b84a', ['gold', 'golden', 'doré', 'dorée', 'dorado', 'dourado', 'ouro']],
  ['#e11d48', ['red', 'rouge', 'rojo', 'roja', 'vermelho', 'rosso']],
  ['#1d4ed8', ['blue', 'bleu', 'bleue', 'azul', 'blu']],
  ['#ec4899', ['pink', 'rose', 'rosa']],
  ['#10b981', ['green', 'vert', 'verte', 'verde']],
  ['#7c3aed', ['purple', 'violet', 'violette', 'morado', 'roxo', 'viola']],
  ['#f97316', ['orange', 'naranja', 'laranja']],
  ['#facc15', ['yellow', 'jaune', 'amarillo', 'amarelo', 'giallo']],
  ['#cbd5e1', ['silver', 'argent', 'plata', 'prata', 'chrome']],
  ['#ffffff', ['white', 'blanc', 'blanche', 'blanco', 'blanca', 'branco', 'bianco']],
];
const COLOR_LABEL = { '#11151f': 'BLACK', '#e8b84a': 'GOLD', '#e11d48': 'RED', '#1d4ed8': 'BLUE', '#ec4899': 'PINK', '#10b981': 'GREEN', '#7c3aed': 'PURPLE', '#f97316': 'ORANGE', '#facc15': 'YELLOW', '#cbd5e1': 'SILVER', '#ffffff': 'WHITE' };
const EXTRAS = [
  ['pool', ['pool', 'piscine', 'piscina', 'swimming']],
  ['helipad', ['helipad', 'heliport', 'héliport', 'helico', 'hélico', 'helicopter', 'hélicoptère', 'helicoptero', 'helicóptero', 'heli']],
  ['jetski', ['jetski', 'jet-ski', 'jet ski', 'jet', 'scooter des mers']],
  ['lights', ['lights', 'light', 'party', 'fête', 'fete', 'fiesta', 'festa', 'neon', 'néon', 'lumières', 'lumieres', 'luces', 'disco']],
];

export function parseRequest(text) {
  const low = (' ' + text.toLowerCase().replace(/[^\p{L}\s-]/gu, ' ').replace(/\s+/g, ' ') + ' ')
    .replace(/ (et|and|y|e|&) or /g, ' $1 doré ').replace(/ en or /g, ' doré ');
  const found = [];
  for (const [hex, words] of COLORS) {
    for (const w of words) {
      const i = low.indexOf(' ' + w + ' ');
      if (i >= 0) { found.push([i, hex]); break; }
    }
  }
  found.sort((a, b) => a[0] - b[0]);
  const colors = found.map((f) => f[1]);
  const extras = EXTRAS.filter(([, words]) => words.some((w) => low.includes(' ' + w + ' '))).map(([k]) => k);
  const look = {};
  if (colors[0] && colors[0] !== '#ffffff') look.hull = colors[0];
  if (colors[1]) look.accent = colors[1];
  else if (colors[0] === '#ffffff') look.hull = '#ffffff';
  if (look.hull && !look.accent) look.accent = look.hull === '#e8b84a' || look.hull === '#11151f' ? (look.hull === '#11151f' ? '#e8b84a' : '#11151f') : '#ffffff';
  const label = [...colors.slice(0, 2).map((c) => COLOR_LABEL[c]), ...extras.map((e) => e.toUpperCase())].join(' · ');
  return { look, extras, label };
}

// --------------------------------------------------------------- main
function latestEpisode() {
  const dir = path.join(ROOT, 'episodes');
  const days = fs.readdirSync(dir).map((f) => f.match(/^day(\d+)\.json$/)).filter(Boolean).sort((a, b) => Number(b[1]) - Number(a[1]));
  return days.length ? `episodes/${days[0][0]}` : null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const prevPath = args.prev || latestEpisode();
  if (!prevPath) throw new Error('No previous episode found (use --prev).');
  const prev = JSON.parse(fs.readFileSync(path.join(ROOT, prevPath), 'utf8'));
  const day = Number(args.day || prev.day + 1);

  const rows = args.comments ? parseCsv(fs.readFileSync(path.resolve(args.comments), 'utf8')) : [];
  const yachts = (prev.yachts || []).map((y) => ({ ...y, new: false, featured: false, request: undefined }));
  const byName = new Map(yachts.map((y) => [y.name.toLowerCase(), y]));
  const today = [];

  for (const r of rows) {
    const handle = (r.username || r.user || r.name || '').replace(/^@+/, '').trim();
    if (!handle) continue;
    const name = '@' + handle;
    const text = r.comment || r.text || '';
    const country = (r.country && VALID.has(r.country.toLowerCase()) ? r.country.toLowerCase() : null) || findCountry(r.country || '') || findCountry(text);
    const req = parseRequest(r.request || text);
    const likes = Number(String(r.likes || '0').replace(/[^\d]/g, '')) || 0;
    let y = byName.get(name.toLowerCase());
    if (!y) {
      y = { name, new: true };
      yachts.push(y);
      byName.set(name.toLowerCase(), y);
    }
    if (country) y.country = country;
    Object.assign(y, req.look);
    if (req.extras.length) y.extras = [...new Set([...(y.extras || []), ...req.extras])];
    if (req.label) y.request = req.label;
    today.push({ y, likes, label: req.label, country, name });
  }

  // VIP = most liked comment of the day
  today.sort((a, b) => b.likes - a.likes);
  const vipRow = today[0];
  const vip = vipRow ? {
    name: vipRow.name, country: vipRow.y.country, likes: vipRow.likes || undefined,
    request: vipRow.label || undefined, extras: vipRow.y.extras,
    ...(vipRow.y.hull ? { hull: vipRow.y.hull } : {}), ...(vipRow.y.accent && vipRow.y.hull ? { accent: vipRow.y.accent } : {}),
  } : null;

  const nFeat = Number(args.featured ?? 4);
  const candidates = today.filter((r) => r !== vipRow && r.y.new);
  const withReq = candidates.filter((r) => r.label);
  const featured = [...withReq, ...candidates.filter((r) => !r.label)].slice(0, nFeat);
  featured.forEach((r) => { r.y.featured = true; });
  for (const y of yachts) { if (!y.featured) delete y.request; if (!y.featured) delete y.featured; if (!y.new) delete y.new; }

  const episode = {
    day,
    mode: 'daily',
    theme: args.theme || prev.theme || 'day',
    brand: prev.brand,
    followers: Number(args.followers || yachts.length),
    yachts,
    vip,
    text: { next: "MOST LIKED COMMENT = TOMORROW'S VIP" },
    seed: prev.seed || 7,
  };
  const out = args.out || `episodes/day${String(day).padStart(2, '0')}.json`;
  fs.writeFileSync(path.join(ROOT, out), JSON.stringify(episode, null, 2));
  const newCount = yachts.filter((y) => y.new).length;
  console.log(`\nDay ${day}: ${yachts.length} yachts (${newCount} new), followers shown: ${episode.followers}`);
  if (vip) console.log(`VIP: ${vip.name}${vip.likes ? ` (${vip.likes} likes)` : ''}${vip.request ? ` — ${vip.request}` : ''}`);
  for (const r of featured) console.log(`Close-up: ${r.name}${r.label ? ` — ${r.label}` : ''}`);
  console.log(`\nSaved → ${out}\nReview/edit it, then: npm run render -- --episode ${out}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(e.message); process.exit(1); }
}
