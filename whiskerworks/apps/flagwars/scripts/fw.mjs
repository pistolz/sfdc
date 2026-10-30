#!/usr/bin/env node
/**
 * Flag Wars data CLI. The ledger (data/ledger.json) is the private source of truth;
 * public/data/state.json is derived from it and is what the website reads.
 *
 *   node scripts/fw.mjs build                         rebuild public/data/state.json
 *   node scripts/fw.mjs add <country> <@handle> [--count n] [--day d]
 *   node scripts/fw.mjs import <comments.csv|json> [--day d] [--dry-run]
 *   node scripts/fw.mjs day <n> | next-day
 *   node scripts/fw.mjs episode --day d --title "…" [--summary "…"] [--date YYYY-MM-DD]
 *                                [--instagram url] [--tiktok url] [--youtube url] [--latest]
 *   node scripts/fw.mjs optout <@handle>              hide a handle everywhere ("anonymous")
 *   node scripts/fw.mjs match "<comment text>"        test the country parser
 *   node scripts/fw.mjs stats
 *   node scripts/fw.mjs seed-demo                      replace the ledger with demo data
 *   node scripts/fw.mjs reset --yes                    empty the ledger (keeps series.json)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import countries from "i18n-iso-countries";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = {
  ledger: join(root, "data/ledger.json"),
  series: join(root, "data/series.json"),
  optout: join(root, "data/optout.json"),
  geo: join(root, "public/geo/world-hex.json"),
  state: join(root, "public/data/state.json"),
};
const LANGS = ["en", "fr", "es", "pt", "de", "it"];
for (const l of LANGS) countries.registerLocale(require(`i18n-iso-countries/langs/${l}.json`));

const readJSON = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : d);
const writeJSON = (f, v, pretty = true) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(v, null, pretty ? 2 : 0) + "\n"); };
const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };

const DEFAULT_SERIES = {
  name: "Flag Wars",
  tagline: "1 comment = 1 flag. Who conquers the world?",
  day: 1,
  rules: { levelSteps: [10, 50, 100, 250, 500, 1000] },
  links: { latestEpisode: "https://www.instagram.com/ads_noads/", instagram: "https://www.instagram.com/ads_noads/", tiktok: "", youtube: "" },
  episodes: [],
};

function geo() {
  const g = readJSON(P.geo, null);
  if (!g) die("public/geo/world-hex.json missing — run `npm run geo -w @whiskerworks/flagwars` first.");
  return new Map(g.countries.map((c) => [c.code, c]));
}

/* ---------------------------------------------------------------- parsing */
const norm = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const NICKNAMES = {
  US: ["usa", "u s a", "america", "united states of america", "merica", "etats unis", "estados unidos", "eeuu", "states"],
  GB: ["uk", "u k", "england", "scotland", "wales", "great britain", "britain", "angleterre", "inglaterra", "royaume uni", "northern ireland"],
  NL: ["holland", "pays bas", "the netherlands"], KR: ["korea", "south korea", "coree du sud", "corea del sur"], KP: ["north korea"],
  CD: ["drc", "rdc", "dr congo", "congo kinshasa"], CG: ["congo brazzaville"], AE: ["uae", "emirates", "dubai", "emirats"], SA: ["ksa", "saudi", "saudi arabia"],
  RU: ["russia", "russie", "rusia"], TR: ["turkey", "turkiye", "turquie", "turquia"], CI: ["ivory coast", "cote d ivoire", "cote divoire"],
  CZ: ["czech republic", "czechia", "tchequie"], PS: ["palestine", "palestina"], TW: ["taiwan"], VA: ["vatican"], VN: ["vietnam", "viet nam"],
  IR: ["iran", "persia"], SY: ["syria", "syrie"], LA: ["laos"], BO: ["bolivia"], VE: ["venezuela"], MD: ["moldova"], MK: ["north macedonia", "macedonia"],
  BA: ["bosnia"], XK: ["kosovo"], CV: ["cape verde", "cabo verde"], SZ: ["eswatini", "swaziland"], MM: ["myanmar", "burma"], PH: ["philippines", "pinas", "pilipinas"],
  DO: ["dominican republic", "rep dom"], NZ: ["new zealand", "aotearoa"], MA: ["morocco", "maroc", "marruecos"], DZ: ["algeria", "algerie", "dz"],
  BR: ["brasil"], MX: ["mexico"], JP: ["japan", "nippon"], CN: ["china"], IN: ["india", "bharat"],
};
const AMBIGUOUS_CODES = new Set(["IN", "IT", "IS", "ME", "NO", "TO", "AM", "BE", "DO", "GO", "SO", "AS", "AT", "BY", "MY", "OR", "ON", "AN", "HE", "HI", "OK", "US"]);

let _aliases;
function aliases(valid) {
  if (_aliases) return _aliases;
  const list = [];
  const add = (code, name) => { const n = norm(name); if (n.length >= 3 && valid.has(code)) list.push([n, code]); };
  for (const l of LANGS) for (const [code, names] of Object.entries(countries.getNames(l, { select: "all" }))) for (const n of names) add(code, n);
  for (const [code, ns] of Object.entries(NICKNAMES)) for (const n of ns) { const k = norm(n); if (valid.has(code)) list.push([k, code]); }
  for (const c of valid) { const g = geoCache.get(c); if (g) add(c, g.name); }
  // longest first so "south korea" beats "korea", "guinea bissau" beats "guinea"
  _aliases = [...new Map(list.map(([n, c]) => [n, c])).entries()].sort((a, b) => b[0].length - a[0].length);
  return _aliases;
}
let geoCache;
export function parseCountry(text, valid) {
  if (!text) return null;
  // 1) flag emoji (pair of regional indicators) — earliest wins
  const flag = /([\u{1F1E6}-\u{1F1FF}])([\u{1F1E6}-\u{1F1FF}])/u.exec(text);
  let best = null;
  if (flag) {
    const code = String.fromCharCode(flag[1].codePointAt(0) - 0x1f1e6 + 65, flag[2].codePointAt(0) - 0x1f1e6 + 65);
    const c = code === "UK" ? "GB" : code;
    if (valid.has(c)) best = { code: c, pos: flag.index };
  }
  // 2) names / aliases, as whole words
  const n = ` ${norm(text)} `;
  for (const [alias, code] of aliases(valid)) {
    const i = n.indexOf(` ${alias} `);
    if (i < 0) continue;
    // positions are not comparable between raw text and normalized text; prefer emoji when present,
    // otherwise earliest alias (ties → longest, guaranteed by sort order)
    if (!best) best = { code, pos: i, alias: true };
    else if (best.alias && i < best.pos) best = { code, pos: i, alias: true };
  }
  if (best) return best.code;
  // 3) bare ISO code: only when the whole comment is the code (e.g. "MAR", "FR", "CAN!!")
  const bare = text.replace(/[^\p{L}]/gu, "");
  if (/^[A-Z]{3}$/.test(bare)) { const c = countries.alpha3ToAlpha2(bare); if (c && valid.has(c)) return c; }
  if (/^[A-Z]{2}$/.test(bare) && !AMBIGUOUS_CODES.has(bare) && valid.has(bare)) return bare;
  return null;
}

/* ---------------------------------------------------------------- derive */
export function levelFor(flags, steps) {
  if (flags <= 0) return { level: 0, progress: 0, next: steps[0] ?? 10 };
  let level = 1, start = 1;
  for (let k = 0; ; k++) {
    const step = steps[Math.min(k, steps.length - 1)];
    if (flags - start < step) return { level, progress: flags - start, next: step };
    start += step; level++;
  }
}
const cleanHandle = (h) => String(h || "").trim().replace(/^@+/, "").toLowerCase();

function buildState() {
  const G = geo();
  const series = { ...DEFAULT_SERIES, ...readJSON(P.series, {}) };
  const ledger = readJSON(P.ledger, []);
  const optout = new Set(readJSON(P.optout, []).map(cleanHandle));
  const steps = series.rules?.levelSteps?.length ? series.rules.levelSteps : DEFAULT_SERIES.rules.levelSteps;
  const show = (h) => (optout.has(h) ? "anonymous" : h);

  const claims = [...ledger].filter((c) => G.has(c.country)).sort((a, b) => (a.day - b.day) || String(a.ts).localeCompare(String(b.ts)));
  const C = new Map(), H = new Map();
  for (const cl of claims) {
    const h = cleanHandle(cl.handle);
    if (!C.has(cl.country)) C.set(cl.country, { flags: 0, founder: h, foundedDay: cl.day, by: new Map() });
    const c = C.get(cl.country);
    c.flags++; c.by.set(h, (c.by.get(h) || 0) + 1);
    if (!optout.has(h)) {
      if (!H.has(h)) H.set(h, { total: 0, countries: {}, founderOf: [] });
      const u = H.get(h); u.total++; u.countries[cl.country] = (u.countries[cl.country] || 0) + 1;
    }
  }
  for (const [code, c] of C) if (H.has(c.founder)) H.get(c.founder).founderOf.push(code);

  const rows = [...C.entries()].map(([code, c]) => ({ code, c, ...levelFor(c.flags, steps) }))
    .sort((a, b) => b.c.flags - a.c.flags || a.c.foundedDay - b.c.foundedDay || a.code.localeCompare(b.code));
  const leaderboard = [], out = {};
  rows.forEach((r, i) => {
    const g = G.get(r.code);
    const founder = show(r.c.founder);
    leaderboard.push({ code: r.code, name: g.name, flags: r.c.flags, level: r.level, progress: r.progress, next: r.next, founder, rank: i + 1, color: g.color });
    out[r.code] = {
      name: g.name, flags: r.c.flags, level: r.level, progress: r.progress, next: r.next, founder, foundedDay: r.c.foundedDay, color: g.color,
      commanderCount: r.c.by.size,
      topCommanders: [...r.c.by.entries()].filter(([h]) => !optout.has(h)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([handle, flags]) => ({ handle, flags })),
    };
  });
  const handles = Object.fromEntries([...H.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  const commanders = new Set(claims.map((c) => cleanHandle(c.handle)));
  const state = {
    version: 1,
    updatedAt: new Date().toISOString(),
    day: series.day,
    totalFlags: claims.length,
    totalCountries: C.size,
    totalCommanders: commanders.size,
    rules: { levelSteps: steps },
    links: series.links,
    series: { name: series.name, tagline: series.tagline },
    episodes: [...(series.episodes || [])].sort((a, b) => b.day - a.day),
    leaderboard, countries: out, handles,
  };
  writeJSON(P.state, state, false);
  return state;
}

/* ---------------------------------------------------------------- import */
function parseCSV(src) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])));
}

/* ---------------------------------------------------------------- demo */
function seedDemo() {
  let s = 20261030; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const weights = { CA: 74, BR: 61, JP: 48, MA: 41, US: 37, FR: 33, MX: 29, IN: 26, DZ: 22, PH: 19, DE: 17, IT: 15, ES: 14, TN: 12, NG: 11,
    AR: 10, TR: 9, KR: 8, GB: 8, PT: 7, CO: 6, EG: 6, SN: 5, ID: 5, PL: 4, AU: 4, SE: 3, CM: 3, NZ: 2, IS: 1, PE: 2, CL: 2 };
  const bits = { CA: ["maple", "moose", "north"], BR: ["samba", "rio", "verde"], JP: ["sakura", "kenji", "tokyo"], MA: ["atlas", "casa", "zellige"],
    US: ["eagle", "texas", "nyc"], FR: ["baguette", "lyon", "paris"], MX: ["taco", "azteca", "cdmx"], IN: ["chai", "mumbai", "desi"], DZ: ["oran", "sahara", "dz"],
    PH: ["manila", "mango", "pinoy"], DE: ["berlin", "pretzel"], IT: ["roma", "pasta"], ES: ["sol", "madrid"] };
  const names = ["mira", "leo", "kai", "nora", "sami", "yuna", "omar", "lina", "theo", "zara", "ines", "ravi", "ana", "max", "lou", "noah", "aya", "eli", "jade", "milo", "rosa", "ivan", "nina", "adam"];
  const seps = ["_", ".", "", "_x", "."];
  const ledger = []; const used = new Map();
  let id = 1;
  const order = Object.entries(weights);
  for (const [code, w] of order) {
    const pool = [];
    const nh = Math.max(1, Math.round(w / 2.4));
    for (let k = 0; k < nh; k++) {
      let h; do { h = `${pick(bits[code] || [code.toLowerCase(), "flag", "world"])}${pick(seps)}${pick(names)}${rnd() < 0.35 ? Math.floor(rnd() * 99) : ""}`; } while (used.has(h) && used.get(h) !== code);
      used.set(h, code); pool.push(h);
    }
    for (let k = 0; k < w; k++) {
      const day = k === 0 ? (w > 30 ? 1 : w > 8 ? (rnd() < 0.6 ? 1 : 2) : pick([1, 2, 3])) : pick([1, 2, 2, 3, 3, 3]);
      const h = k === 0 ? pool[0] : rnd() < 0.45 ? pool[0] : pick(pool);
      const ts = `2026-10-${String(27 + day).padStart(2, "0")}T${String(8 + Math.floor(rnd() * 14)).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}:00Z`;
      ledger.push({ id: `demo-${id++}`, handle: h, country: code, day: Math.max(day, k === 0 ? 1 : 1), ts: k === 0 ? `2026-10-${String(27 + day).padStart(2, "0")}T07:00:00Z` : ts, source: "demo" });
    }
  }
  // a few globetrotters who flag several countries
  for (const [h, cs] of [["flagwars_fan", ["CA", "BR", "JP", "FR"]], ["world.tour.ana", ["MA", "ES", "PT", "IT", "MX"]]]) {
    for (const c of cs) ledger.push({ id: `demo-${id++}`, handle: h, country: c, day: 3, ts: "2026-10-30T20:00:00Z", source: "demo" });
  }
  writeJSON(P.ledger, ledger);
  const series = { ...DEFAULT_SERIES, ...readJSON(P.series, {}) };
  series.day = 3;
  series.episodes = [
    { day: 1, date: "2026-10-28", title: "Who conquers the world?", summary: "The globe is empty. One comment plants one flag — Canada is founded first.", links: { instagram: "https://www.instagram.com/ads_noads/" } },
    { day: 2, date: "2026-10-29", title: "Canada levels up", summary: "Canada hits level 2 and builds its first towers. Brazil and Japan join the top 3.", links: { instagram: "https://www.instagram.com/ads_noads/" } },
    { day: 3, date: "2026-10-30", title: "Brazil strikes back", summary: "Brazil closes the gap while Morocco storms into the top 5. Who takes the top spot?", links: { instagram: "https://www.instagram.com/ads_noads/" } },
  ];
  writeJSON(P.series, series);
  return ledger.length;
}

/* ---------------------------------------------------------------- CLI */
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name, def) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : def; };
const has = (name) => rest.includes(`--${name}`);
const positional = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--") && !["--yes", "--dry-run", "--latest"].includes(rest[i - 1])));

function series() { return { ...DEFAULT_SERIES, ...readJSON(P.series, {}) }; }

switch (cmd) {
  case "build": {
    const st = buildState();
    console.log(`✔ state.json: day ${st.day}, ${st.totalFlags} flags, ${st.totalCountries} countries, ${st.totalCommanders} commanders`);
    break;
  }
  case "add": {
    const G = geo(); geoCache = G;
    const [countryArg, handleArg] = positional;
    if (!countryArg || !handleArg) die("usage: add <country> <@handle> [--count n] [--day d]");
    const code = G.has(countryArg.toUpperCase()) ? countryArg.toUpperCase() : parseCountry(countryArg, new Set(G.keys()));
    if (!code) die(`unknown country "${countryArg}"`);
    const ledger = readJSON(P.ledger, []);
    const n = Number(flag("count", 1)), day = Number(flag("day", series().day));
    for (let k = 0; k < n; k++) ledger.push({ id: `manual-${Date.now()}-${k}`, handle: cleanHandle(handleArg), country: code, day, ts: new Date().toISOString(), source: "manual" });
    writeJSON(P.ledger, ledger);
    buildState();
    console.log(`✔ +${n} flag(s) for ${G.get(code).name} by @${cleanHandle(handleArg)} (day ${day})`);
    break;
  }
  case "import": {
    const G = geo(); geoCache = G; const valid = new Set(G.keys());
    const file = positional[0]; if (!file || !existsSync(file)) die("usage: import <comments.csv|json> [--day d] [--dry-run]");
    const raw = readFileSync(file, "utf8");
    const rows = extname(file).toLowerCase() === ".json" ? JSON.parse(raw) : parseCSV(raw);
    const ledger = readJSON(P.ledger, []);
    const seen = new Set(ledger.map((c) => c.id));
    const day = Number(flag("day", series().day));
    let added = 0, dup = 0, unmatched = [];
    for (const r of rows) {
      const id = String(r.id || r.comment_id || `${r.handle || r.username}|${r.timestamp || r.ts}|${r.text}`);
      if (seen.has(id)) { dup++; continue; }
      const text = r.text ?? r.comment ?? r.body ?? "";
      const code = parseCountry(text, valid);
      if (!code) { unmatched.push(text); continue; }
      seen.add(id);
      ledger.push({ id, handle: cleanHandle(r.handle || r.username || r.user), country: code, day, ts: r.timestamp || r.ts || new Date().toISOString(), source: "import" });
      added++;
    }
    if (!has("dry-run")) { writeJSON(P.ledger, ledger); buildState(); }
    console.log(`✔ ${added} flag(s) ${has("dry-run") ? "would be " : ""}added, ${dup} duplicate(s) skipped, ${unmatched.length} comment(s) without a country`);
    if (unmatched.length) console.log("  unmatched sample:", unmatched.slice(0, 8).map((t) => JSON.stringify(t.slice(0, 60))).join(", "));
    break;
  }
  case "match": {
    const G = geo(); geoCache = G;
    const code = parseCountry(positional.join(" "), new Set(G.keys()));
    console.log(code ? `${code} · ${G.get(code).name}` : "no country found");
    break;
  }
  case "day":
  case "next-day": {
    const s = series();
    s.day = cmd === "next-day" ? s.day + 1 : Number(positional[0]);
    if (!Number.isInteger(s.day) || s.day < 1) die("usage: day <n>");
    writeJSON(P.series, s); buildState();
    console.log(`✔ day is now ${s.day}`);
    break;
  }
  case "episode": {
    const s = series();
    const day = Number(flag("day", s.day));
    const links = Object.fromEntries(["instagram", "tiktok", "youtube"].map((k) => [k, flag(k)]).filter(([, v]) => v));
    const ep = { day, date: flag("date", new Date().toISOString().slice(0, 10)), title: flag("title", `Day ${day}`), summary: flag("summary", ""), links };
    s.episodes = [...(s.episodes || []).filter((e) => e.day !== day), ep].sort((a, b) => a.day - b.day);
    if (has("latest") || day >= s.day) s.links = { ...s.links, latestEpisode: links.instagram || links.tiktok || links.youtube || s.links.latestEpisode };
    writeJSON(P.series, s); buildState();
    console.log(`✔ episode day ${day} saved`);
    break;
  }
  case "optout": {
    const h = cleanHandle(positional[0]); if (!h) die("usage: optout <@handle>");
    const list = new Set(readJSON(P.optout, []).map(cleanHandle)); list.add(h);
    writeJSON(P.optout, [...list].sort()); buildState();
    console.log(`✔ @${h} is now shown as "anonymous"`);
    break;
  }
  case "stats": {
    const st = existsSync(P.state) ? readJSON(P.state) : buildState();
    console.log(`Day ${st.day} · ${st.totalFlags} flags · ${st.totalCountries} countries · ${st.totalCommanders} commanders`);
    for (const r of st.leaderboard.slice(0, 10)) console.log(`${String(r.rank).padStart(3)}. ${r.name.padEnd(22)} LV${r.level}  ${String(r.flags).padStart(5)} flags  (${r.progress}/${r.next})  founder @${r.founder}`);
    break;
  }
  case "seed-demo": {
    const n = seedDemo(); const st = buildState();
    console.log(`✔ demo ledger with ${n} claims → ${st.totalCountries} countries`);
    break;
  }
  case "reset": {
    if (!has("yes")) die("this empties data/ledger.json — re-run with --yes");
    writeJSON(P.ledger, []); buildState();
    console.log("✔ ledger emptied");
    break;
  }
  default:
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n\/\*\*?/, "").replace(/^ \* ?/gm, ""));
}
