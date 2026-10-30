#!/usr/bin/env node
/**
 * Stadium Builder data CLI. The ledger (data/ledger.json) is the private source of truth;
 * public/data/state.json is derived from it and is what the website reads.
 *
 *   node scripts/sb.mjs build                          rebuild public/data/state.json
 *   node scripts/sb.mjs add "<club>" <@handle> [--count n] [--day d]
 *                                                      club = built-in name/alias, or any new club name (gets generated colours)
 *   node scripts/sb.mjs import <comments.csv|json> [--day d] [--dry-run]
 *                                                      columns: id, handle (or username), text (or comment), timestamp
 *   node scripts/sb.mjs match "<comment text>"         test the club parser
 *   node scripts/sb.mjs day <n> | next-day
 *   node scripts/sb.mjs episode --day d --title "…" [--summary "…"] [--date YYYY-MM-DD]
 *                                [--instagram url] [--tiktok url] [--youtube url] [--latest]
 *   node scripts/sb.mjs optout <@handle>               show a handle as "anonymous" everywhere
 *   node scripts/sb.mjs stats
 *   node scripts/sb.mjs seed-demo                       replace the ledger with demo data
 *   node scripts/sb.mjs reset --yes                     empty the ledger (keeps series.json)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { CLUBS } from "./clubs.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = {
  ledger: join(root, "data/ledger.json"),
  series: join(root, "data/series.json"),
  optout: join(root, "data/optout.json"),
  state: join(root, "public/data/state.json"),
};
const readJSON = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : d);
const writeJSON = (f, v, pretty = true) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(v, null, pretty ? 2 : 0) + "\n"); };
const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };

const IG = "https://www.instagram.com/ads_noads/";
const DEFAULT_SERIES = {
  name: "Stadium Builder",
  tagline: "1 club = 1 stand. Build the biggest stadium in the world.",
  rule: "1 club = 1 stand",
  day: 1,
  rules: {
    foundingSeats: 500,
    seatsPerComment: 100,
    goal: 100000,
    levels: [
      { level: 1, seats: 0, name: "Local ground" },
      { level: 2, seats: 5000, name: "Town stadium" },
      { level: 3, seats: 20000, name: "City arena" },
      { level: 4, seats: 60000, name: "Big stadium" },
      { level: 5, seats: 100000, name: "The biggest stadium in the world" },
    ],
  },
  links: { latestEpisode: IG, instagram: IG, tiktok: "", youtube: "" },
  episodes: [],
};
const series = () => {
  const s = { ...DEFAULT_SERIES, ...readJSON(P.series, {}) };
  s.rules = { ...DEFAULT_SERIES.rules, ...(s.rules || {}) };
  return s;
};

/* ---------------------------------------------------------------- clubs & parsing */
const norm = (s) => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const slug = (s) => norm(s).replace(/ /g, "-").slice(0, 40);
const BY_ID = new Map(CLUBS.map(([id, name, banner, c1, c2]) => [id, { id, name, banner, colors: [c1, c2] }]));
const ALIASES = (() => {
  const m = new Map();
  for (const [id, name, banner, , , ...al] of CLUBS) for (const a of [name, ...al]) { const n = norm(a); if (n.length >= 2 && !m.has(n)) m.set(n, id); }
  return [...m.entries()].sort((a, b) => b[0].length - a[0].length); // longest first: "inter miami" beats "inter"
})();

function hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, "0");
  return `#${f(0)}${f(8)}${f(4)}`;
}
function generatedClub(name) {
  let h = 2166136261; for (const ch of norm(name)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const hue = h % 360;
  return { id: `x-${slug(name)}`, name: name.trim(), banner: name.trim().toUpperCase().slice(0, 18), colors: [hsl(hue, 72, 48), hsl((hue + 150) % 360, 80, 58)], custom: true };
}

/** Find the club a comment is about. Returns { id, name? } or null. */
export function parseClub(text) {
  if (!text) return null;
  const n = ` ${norm(text)} `;
  let best = null;
  for (const [alias, id] of ALIASES) {
    const i = n.indexOf(` ${alias} `);
    if (i >= 0 && (!best || i < best.pos)) best = { id, pos: i };
  }
  if (best) return { id: best.id };
  // Unknown club written the usual way: "Example FC", "FC Example", "Sporting Example", "Example United"
  const m = /\b(?:(?:FC|AFC|CF|SC|AC|AS|CD|SV|SK|FK)\s+([A-Z][\p{L}'.-]+(?:\s+[A-Z][\p{L}'.-]+){0,2})|([A-Z][\p{L}'.-]+(?:\s+[A-Z][\p{L}'.-]+){0,2})\s+(?:FC|AFC|CF|SC|United|City|Athletic|Rovers|Wanderers))\b/u.exec(text);
  if (m) {
    const STOP = new Set(["go", "allez", "vamos", "forza", "come", "on", "up", "the", "i", "we", "love", "aupa", "hup", "for", "team", "my"]);
    const words = m[0].trim().split(/\s+/);
    while (words.length > 2 && STOP.has(words[0].toLowerCase())) words.shift();
    const name = words.join(" ");
    return { id: `x-${slug(name)}`, name };
  }
  return null;
}
function clubInfo(id, nameHint) {
  if (BY_ID.has(id)) return BY_ID.get(id);
  return { ...generatedClub(nameHint || id.replace(/^x-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())), id };
}
function resolveClubArg(arg) {
  const p = parseClub(arg);
  if (p && BY_ID.has(p.id)) return { id: p.id };
  const exact = BY_ID.get(arg.toLowerCase());
  if (exact) return { id: exact.id };
  return { id: `x-${slug(arg)}`, name: arg.trim() };
}

/* ---------------------------------------------------------------- derive */
const cleanHandle = (h) => String(h || "").trim().replace(/^@+/, "").toLowerCase();
function levelFor(seats, levels) {
  let cur = levels[0];
  for (const l of levels) if (seats >= l.seats) cur = l;
  const next = levels.find((l) => l.seats > seats) || null;
  return { level: cur.level, levelName: cur.name, levelSeats: cur.seats, nextLevelSeats: next ? next.seats : null };
}

function buildState() {
  const s = series();
  const R = s.rules;
  const ledger = readJSON(P.ledger, []);
  const optout = new Set(readJSON(P.optout, []).map(cleanHandle));
  const show = (h) => (optout.has(h) ? "anonymous" : h);
  const claims = [...ledger].filter((c) => c.club).sort((a, b) => (a.day - b.day) || String(a.ts).localeCompare(String(b.ts)) || String(a.id).localeCompare(String(b.id)));

  const C = new Map(), H = new Map();
  for (const cl of claims) {
    const h = cleanHandle(cl.handle);
    if (!C.has(cl.club)) C.set(cl.club, { info: clubInfo(cl.club, cl.clubName), comments: 0, founder: h, foundedDay: cl.day, fans: new Map() });
    const c = C.get(cl.club);
    c.comments++;
    if (!c.fans.has(h)) c.fans.set(h, { n: 0, fan: c.fans.size, firstDay: cl.day });
    c.fans.get(h).n++;
  }
  const rows = [...C.values()].map((c) => ({ ...c, seats: R.foundingSeats + (c.comments - 1) * R.seatsPerComment }))
    .sort((a, b) => b.seats - a.seats || a.foundedDay - b.foundedDay || a.info.name.localeCompare(b.info.name));

  const leaderboard = [], clubs = {};
  rows.forEach((r, i) => {
    const { id, name, banner, colors, custom } = r.info;
    const founder = show(r.founder);
    leaderboard.push({ id, name, banner, colors, seats: r.seats, comments: r.comments, fans: r.fans.size, founder, rank: i + 1 });
    clubs[id] = {
      name, banner, colors, custom: !!custom, seats: r.seats, comments: r.comments, fans: r.fans.size, founder, foundedDay: r.foundedDay, rank: i + 1,
      topFans: [...r.fans.entries()].filter(([h]) => !optout.has(h)).sort((a, b) => b[1].n - a[1].n || a[1].fan - b[1].fan).slice(0, 10)
        .map(([handle, f]) => ({ handle, comments: f.n, fan: f.fan })),
    };
    for (const [h, f] of r.fans) {
      if (optout.has(h)) continue;
      if (!H.has(h)) H.set(h, { total: 0, clubs: {}, founderOf: [] });
      const u = H.get(h);
      u.total += f.n;
      u.clubs[id] = { comments: f.n, fan: f.fan, day: f.firstDay };
      if (r.founder === h) u.founderOf.push(id);
    }
  });
  const seats = rows.reduce((t, r) => t + r.seats, 0);
  const lv = levelFor(seats, R.levels);
  const fans = new Set(claims.map((c) => cleanHandle(c.handle))).size;
  const fmt = (n) => n.toLocaleString("en-US");
  const state = {
    version: 1,
    updatedAt: new Date().toISOString(),
    day: s.day,
    series: { name: s.name, tagline: s.tagline, rule: s.rule },
    links: s.links,
    rules: R,
    totals: { seats, clubs: rows.length, fans, comments: claims.length, goal: R.goal, ...lv },
    preview: {
      headline: "1 club = 1 stand",
      stat: seats,
      statLabel: `seats · LV${lv.level} ${lv.levelName}`,
      top: leaderboard.slice(0, 3).map((r) => ({ label: r.name, sub: `${fmt(r.seats)} seats · founder @${r.founder}` })),
    },
    episodes: [...(s.episodes || [])].sort((a, b) => b.day - a.day),
    leaderboard,
    clubs,
    handles: Object.fromEntries([...H.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
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
  let sd = 20261030; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  // club → comment weight (founder first). "example-fc" mirrors the Day 1 video.
  const weights = {
    "real-madrid": 34, barcelona: 31, psg: 27, om: 22, "man-utd": 19, liverpool: 18, wydad: 16, "al-nassr": 15, flamengo: 13, bayern: 12,
    "inter-miami": 11, juventus: 10, boca: 9, "cf-montreal": 9, raja: 8, "al-ahly": 8, arsenal: 8, "man-city": 7, "ac-milan": 7, esperance: 6,
    chelsea: 6, napoli: 5, dortmund: 5, galatasaray: 5, benfica: 4, "mc-alger": 4, ajax: 4, river: 4, "club-america": 3, palmeiras: 3,
    "rc-lens": 3, celtic: 3, "kaizer-chiefs": 2, "al-hilal": 2, "toronto-fc": 2, porto: 2, ol: 2, sporting: 2, "atletico": 2, "js-kabylie": 1,
    wrexham: 1, "st-pauli": 1, "example-fc": 3,
  };
  const bits = {
    "real-madrid": ["hala", "madridista", "blanco"], barcelona: ["culer", "blaugrana", "visca"], psg: ["paris", "parisien", "titi"], om: ["massilia", "minot", "olympien"],
    "man-utd": ["reddevil", "ggmu", "mufc"], liverpool: ["ynwa", "kop", "anfield"], wydad: ["dima.wydad", "wac", "casa"], "al-nassr": ["nassr", "riyadh", "cr7"],
    flamengo: ["mengao", "rubro", "fla"], bayern: ["miasanmia", "munchen"], "inter-miami": ["miami", "goat10"], juventus: ["juve", "bianconero"], boca: ["xeneize", "bombonera"],
    "cf-montreal": ["mtl", "bleublanc", "impact"], raja: ["dima.raja", "green"], "al-ahly": ["ahlawy", "cairo"], "example-fc": ["example"],
  };
  const names = ["mira", "leo", "kai", "nora", "sami", "yuna", "omar", "lina", "theo", "zara", "ines", "ravi", "ana", "max", "lou", "noah", "aya", "eli", "jade", "milo", "rosa", "ivan", "nina", "adam", "yanis", "lea", "hugo", "salma", "rayan", "ali"];
  const seps = ["_", ".", "", "_x", "."];
  const fixedFounders = { "real-madrid": "hala.nora", barcelona: "culer.leo", psg: "paris_mira", om: "massilia_sami", wydad: "dima.wydad.aya", "example-fc": "example" };
  const ledger = []; const used = new Set(); let id = 1;
  for (const [club, w] of Object.entries(weights)) {
    const nh = Math.max(1, Math.round(w / 1.6));
    const pool = [];
    if (fixedFounders[club]) { pool.push(fixedFounders[club]); used.add(fixedFounders[club]); }
    while (pool.length < nh) {
      const h = `${pick(bits[club] || [club.replace(/^x-/, "").split("-")[0], "fan", "ultra"])}${pick(seps)}${pick(names)}${rnd() < 0.35 ? Math.floor(rnd() * 99) : ""}`;
      if (!used.has(h)) { used.add(h); pool.push(h); }
    }
    let founderDay = 1;
    for (let k = 0; k < w; k++) {
      const day = k === 0 ? (founderDay = fixedFounders[club] || w > 20 ? 1 : w > 6 ? (rnd() < 0.6 ? 1 : 2) : pick([1, 2, 3])) : Math.max(founderDay, pick([1, 2, 2, 3, 3, 3]));
      const h = k === 0 ? pool[0] : k < pool.length ? pool[k] : pick(pool);
      const ts = `2026-10-${String(27 + day).padStart(2, "0")}T${String(k === 0 ? 6 : 8 + Math.floor(rnd() * 14)).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}:00Z`;
      ledger.push({ id: `demo-${id++}`, handle: h, club, ...(club.startsWith("x-") ? { clubName: "Example FC" } : {}), day, ts, source: "demo" });
    }
  }
  // a groundhopper who backs several clubs
  for (const c of ["om", "wydad", "cf-montreal", "flamengo"]) ledger.push({ id: `demo-${id++}`, handle: "stadium_fan", club: c, day: 3, ts: "2026-10-30T21:00:00Z", source: "demo" });
  writeJSON(P.ledger, ledger);
  const s = series();
  s.day = 3;
  s.episodes = [
    { day: 1, date: "2026-10-28", title: "This is Stadium Builder", summary: "An empty pitch and one rule: 1 club = 1 stand. Example FC builds the first 500 seats.", links: { instagram: IG } },
    { day: 2, date: "2026-10-29", title: "Real Madrid vs Barça", summary: "The two giants take the biggest stands. PSG and OM start a rivalry in the corners.", links: { instagram: IG } },
    { day: 3, date: "2026-10-30", title: "City arena unlocked", summary: "Over 20,000 seats: a third tier rises. Wydad and Al Nassr storm into the top 10. Next stop: 60,000.", links: { instagram: IG } },
  ];
  s.links = { ...s.links, latestEpisode: IG };
  writeJSON(P.series, s);
  return ledger.length;
}

/* ---------------------------------------------------------------- CLI */
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name, def) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : def; };
const has = (name) => rest.includes(`--${name}`);
const BOOL = ["--yes", "--dry-run", "--latest"];
const positional = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--") && !BOOL.includes(rest[i - 1])));

switch (cmd) {
  case "build": {
    const st = buildState();
    console.log(`✔ state.json: day ${st.day}, ${st.totals.seats} seats (LV${st.totals.level}), ${st.totals.clubs} clubs, ${st.totals.fans} fans`);
    break;
  }
  case "add": {
    const [clubArg, handleArg] = positional;
    if (!clubArg || !handleArg) die('usage: add "<club>" <@handle> [--count n] [--day d]');
    const c = resolveClubArg(clubArg);
    const ledger = readJSON(P.ledger, []);
    const n = Number(flag("count", 1)), day = Number(flag("day", series().day));
    for (let k = 0; k < n; k++) ledger.push({ id: `manual-${Date.now()}-${k}`, handle: cleanHandle(handleArg), club: c.id, ...(c.name ? { clubName: c.name } : {}), day, ts: new Date().toISOString(), source: "manual" });
    writeJSON(P.ledger, ledger);
    buildState();
    console.log(`✔ +${n} comment(s) for ${clubInfo(c.id, c.name).name} by @${cleanHandle(handleArg)} (day ${day})`);
    break;
  }
  case "import": {
    const file = positional[0]; if (!file || !existsSync(file)) die("usage: import <comments.csv|json> [--day d] [--dry-run]");
    const raw = readFileSync(file, "utf8");
    const rows = extname(file).toLowerCase() === ".json" ? JSON.parse(raw) : parseCSV(raw);
    const ledger = readJSON(P.ledger, []);
    const seen = new Set(ledger.map((c) => c.id));
    const day = Number(flag("day", series().day));
    let added = 0, dup = 0; const unmatched = [];
    for (const r of rows) {
      const id = String(r.id || r.comment_id || `${r.handle || r.username}|${r.timestamp || r.ts}|${r.text}`);
      if (seen.has(id)) { dup++; continue; }
      const text = r.text ?? r.comment ?? r.body ?? "";
      const c = parseClub(text);
      if (!c) { unmatched.push(text); continue; }
      seen.add(id);
      ledger.push({ id, handle: cleanHandle(r.handle || r.username || r.user), club: c.id, ...(c.name ? { clubName: c.name } : {}), day, ts: r.timestamp || r.ts || new Date().toISOString(), source: "import" });
      added++;
    }
    if (!has("dry-run")) { writeJSON(P.ledger, ledger); buildState(); }
    console.log(`✔ ${added} comment(s) ${has("dry-run") ? "would be " : ""}added, ${dup} duplicate(s) skipped, ${unmatched.length} without a club`);
    if (unmatched.length) console.log("  unmatched sample:", unmatched.slice(0, 8).map((t) => JSON.stringify(String(t).slice(0, 60))).join(", "));
    break;
  }
  case "match": {
    const c = parseClub(positional.join(" "));
    console.log(c ? `${c.id} · ${clubInfo(c.id, c.name).name}${c.name ? " (new club, generated colours)" : ""}` : "no club found");
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
    const t = st.totals;
    console.log(`Day ${st.day} · ${t.seats.toLocaleString("en-US")}/${t.goal.toLocaleString("en-US")} seats · LV${t.level} ${t.levelName} · ${t.clubs} clubs · ${t.fans} fans`);
    for (const r of st.leaderboard.slice(0, 10)) console.log(`${String(r.rank).padStart(3)}. ${r.name.padEnd(26)} ${String(r.seats).padStart(7)} seats  ${String(r.comments).padStart(4)} comments  founder @${r.founder}`);
    break;
  }
  case "seed-demo": {
    const n = seedDemo(); const st = buildState();
    console.log(`✔ demo ledger with ${n} comments → ${st.totals.clubs} clubs, ${st.totals.seats} seats`);
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
