#!/usr/bin/env node
/**
 * Insert Coin Club data CLI (zero dependencies).
 * data/ledger.json is the private source of truth: one entry per follower, in follow order.
 * Machine number = position in the ledger (#0001 = founder). public/data/state.json is derived from it.
 *
 *   node scripts/arc.mjs build                               rebuild public/data/state.json
 *   node scripts/arc.mjs add <@handle> [--day d] [--at ISO]  give a follower the next machine
 *   node scripts/arc.mjs import <followers.csv|json> [--day d] [--dry-run]
 *        CSV columns: handle (or username), followed_at (optional). JSON: ["handle", …] or [{handle, followed_at}].
 *        Already-known handles are skipped; new ones get machines in followed_at order (else file order).
 *   node scripts/arc.mjs day <n> | next-day
 *   node scripts/arc.mjs episode --day d --title "…" [--summary "…"] [--date YYYY-MM-DD]
 *                                [--instagram url] [--tiktok url] [--youtube url] [--latest]
 *   node scripts/arc.mjs optout <@handle>                   show "PLAYER" instead of the handle
 *   node scripts/arc.mjs stats
 *   node scripts/arc.mjs seed-demo                           replace the ledger with demo data
 *   node scripts/arc.mjs reset --yes                         empty the ledger (keeps series.json)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

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

/** Must match src/games.ts (GAMES) and src/arcade.ts (NEONS). */
export const GAMES = ["Pyramid Climb", "Stripe Bounce", "Night Drive", "Block Drop", "Neon Pong", "Rock Blaster"];
export const NEONS = ["#3df5ff", "#ffd23f", "#4dff88", "#ff3df0", "#ff8a3d", "#a07bff"];

const DEFAULT_SERIES = {
  name: "Insert Coin Club",
  tagline: "1 follower = 1 arcade machine. The hall grows every day.",
  rule: "1 follower = 1 arcade machine",
  account: "ads_noads",
  day: 1,
  links: { latestEpisode: "https://www.instagram.com/ads_noads/", instagram: "https://www.instagram.com/ads_noads/", tiktok: "", youtube: "" },
  episodes: [],
};
const series = () => ({ ...DEFAULT_SERIES, ...readJSON(P.series, {}) });
/** Today = the series day, or later if follows were already recorded for a later day. */
const currentDay = () => Math.max(series().day, ...readJSON(P.ledger, []).map((e) => e.day), 1);

export const cleanHandle = (h) => String(h ?? "").trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30);
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

function buildState() {
  const s = series();
  const ledger = readJSON(P.ledger, []);
  const optout = new Set(readJSON(P.optout, []).map(cleanHandle));
  // machines: [handle, joinDay, gameIndex, neonIndex]; machine number = index + 1
  const machines = ledger.map((e, i) => {
    const h = optout.has(e.handle) ? "" : e.handle;
    const k = hash(e.handle || String(i));
    // neighbours get different neons (numbers are seated next to each other); the game is per-handle
    return i === 0 ? [h, e.day, 0, 0] : [h, e.day, k % GAMES.length, (i + ((k >>> 9) % 2) * 3) % NEONS.length];
  });
  const day = Math.max(s.day, ...ledger.map((e) => e.day), 1);
  const newToday = ledger.filter((e) => e.day === day).length;
  const pad = (n) => `#${String(n).padStart(4, "0")}`;
  const newest = machines.map((m, i) => ({ m, n: i + 1 })).filter(({ m }) => m[0]).slice(-3).reverse();
  const episodes = [...s.episodes].sort((a, b) => b.day - a.day);
  const state = {
    version: 1,
    updatedAt: new Date().toISOString(),
    day,
    series: { name: s.name, tagline: s.tagline, rule: s.rule, account: s.account },
    links: s.links,
    episodes,
    totals: { machines: machines.length, newToday, days: day },
    preview: {
      headline: "1 follower = 1 arcade machine",
      stat: machines.length,
      statLabel: "machines",
      top: newest.map(({ m, n }) => ({ label: `${pad(n)} @${m[0]}`, sub: `Joined day ${m[1]} · ${GAMES[m[2]]}` })),
    },
    games: GAMES,
    machines,
  };
  writeJSON(P.state, state, false);
  return state;
}

function parseCSV(src) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && src[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  return rows.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]?.trim() ?? ""])));
}

function readFollowers(file) {
  if (!existsSync(file)) die(`File not found: ${file}`);
  const src = readFileSync(file, "utf8");
  let rows = extname(file).toLowerCase() === ".json" ? JSON.parse(src) : parseCSV(src);
  if (!Array.isArray(rows)) rows = rows.followers ?? rows.relationships_followers ?? [];
  return rows.map((r, i) => {
    if (typeof r === "string") return { handle: cleanHandle(r), at: "", i };
    // Instagram "download your data" export: {string_list_data:[{value, timestamp}]}
    const sld = r.string_list_data?.[0];
    const handle = cleanHandle(r.handle ?? r.username ?? r.user ?? r.name ?? sld?.value);
    const ts = r.followed_at ?? r.timestamp ?? r.date ?? (sld?.timestamp ? new Date(sld.timestamp * 1000).toISOString() : "");
    return { handle, at: ts ? new Date(ts).toISOString() : "", i };
  }).filter((r) => r.handle);
}

const NAMES_A = ["leo", "mia", "sam", "nova", "kai", "ruby", "zed", "lumi", "byte", "ollie", "jo", "rex", "ivy", "ash", "max", "luna", "milo", "zoe", "theo", "nina", "axel", "cleo", "remy", "yuki", "omar", "lina", "noah", "sara", "eli", "ines", "hugo", "lea", "ava", "finn", "aria", "jay", "pixel", "retro", "joy", "neo"];
const NAMES_B = ["taps", "runs", "combo", "play", "gg", "lvl9", "k", "x", "_jr", ".exe", "arcade", "88", "_92", "highscore", "1up", "coins", "pad", "boss", "speed", "glitch", "neon", "bit", "rush", "quest", "ninja", "pro", "_fr", ".mtl", "_qc", "plays"];
function seedDemo() {
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const fixed = ["ads_noads", "j0rdy", "leo.taps", "mia_runs", "tapqueen", "kai_88", "ollie.gg", "sam.combo", "ruby.lvl9", "zed_jr", "nova.k", "bytebee", "lumi.play", "rex.1up"];
  const handles = new Set(fixed);
  while (handles.size < 312) {
    const a = NAMES_A[Math.floor(rnd() * NAMES_A.length)], b = NAMES_B[Math.floor(rnd() * NAMES_B.length)];
    const sep = b.startsWith("_") || b.startsWith(".") ? "" : rnd() < 0.5 ? "." : "_";
    handles.add(`${a}${sep}${b}${rnd() < 0.25 ? Math.floor(rnd() * 99) : ""}`);
  }
  const perDay = [1, 38, 71, 92, 110]; // new machines per day (sums to 312)
  const start = Date.parse("2026-10-26T15:00:00Z");
  const list = [...handles];
  let day = 1, cum = 0;
  const ledger = list.map((handle, i) => {
    while (i >= cum + perDay[day - 1] && day < perDay.length) { cum += perDay[day - 1]; day++; }
    return { handle, day, ts: new Date(start + (day - 1) * 86400000 + (i - cum) * 600000).toISOString(), source: "demo" };
  });
  writeJSON(P.ledger, ledger);
  const s = series();
  s.day = day;
  s.episodes = [
    { day: 1, date: "2026-10-26", title: "Day one", summary: "One follower, one machine. The founder's cabinet powers on alone in an empty hall.", links: { instagram: s.links.instagram } },
    { day: 2, date: "2026-10-27", title: "The first row", summary: "38 new followers, 38 new cabinets. @leo.taps and @mia_runs flank the founder.", links: { instagram: s.links.instagram } },
    { day: 3, date: "2026-10-28", title: "Lights on", summary: "The hall passes 100 machines and opens a second aisle.", links: { instagram: s.links.instagram } },
    { day: 4, date: "2026-10-29", title: "Grows every day", summary: "92 new machines. The neon is visible from the street now.", links: { instagram: s.links.instagram } },
    { day: 5, date: "2026-10-30", title: "Three hundred", summary: "Machine #0300 switches on. Can we fill a second hall?", links: { instagram: s.links.instagram } },
  ];
  writeJSON(P.series, s);
  return ledger.length;
}

/* ---------------------------------------------------------------- commands */
const [cmd, ...args] = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const has = (name) => args.includes(`--${name}`);
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !["--dry-run", "--yes", "--latest"].includes(args[i - 1])));

switch (cmd) {
  case "build": {
    const s = buildState();
    console.log(`✔ state.json · day ${s.day} · ${s.totals.machines} machines (${s.totals.newToday} new today)`);
    break;
  }
  case "add": {
    const handle = cleanHandle(positional[0]);
    if (!handle) die("Usage: add <@handle> [--day d] [--at ISO]");
    const ledger = readJSON(P.ledger, []);
    if (ledger.some((e) => e.handle === handle)) die(`@${handle} already has machine #${ledger.findIndex((e) => e.handle === handle) + 1}`);
    const day = Number(opt("day", currentDay()));
    ledger.push({ handle, day, ts: opt("at", new Date().toISOString()), source: "manual" });
    writeJSON(P.ledger, ledger);
    buildState();
    console.log(`✔ @${handle} → machine #${String(ledger.length).padStart(4, "0")} (day ${day})`);
    break;
  }
  case "import": {
    const file = positional[0];
    if (!file) die("Usage: import <followers.csv|json> [--day d] [--dry-run]");
    const ledger = readJSON(P.ledger, []);
    const known = new Set(ledger.map((e) => e.handle));
    const day = Number(opt("day", currentDay()));
    const rows = readFollowers(file);
    const fresh = [];
    for (const r of rows) if (!known.has(r.handle)) { known.add(r.handle); fresh.push(r); }
    fresh.sort((a, b) => (a.at && b.at ? a.at.localeCompare(b.at) : a.i - b.i));
    console.log(`${rows.length} rows · ${rows.length - fresh.length} already in the hall · ${fresh.length} new machines`);
    fresh.slice(0, 12).forEach((r, k) => console.log(`  #${String(ledger.length + k + 1).padStart(4, "0")} @${r.handle}`));
    if (fresh.length > 12) console.log(`  … and ${fresh.length - 12} more`);
    if (has("dry-run")) { console.log("(dry run, nothing written)"); break; }
    for (const r of fresh) ledger.push({ handle: r.handle, day, ts: r.at || new Date().toISOString(), source: "import" });
    writeJSON(P.ledger, ledger);
    const s = buildState();
    console.log(`✔ ${s.totals.machines} machines`);
    break;
  }
  case "day":
  case "next-day": {
    const s = series();
    s.day = cmd === "day" ? Number(positional[0]) : s.day + 1;
    if (!Number.isInteger(s.day) || s.day < 1) die("Usage: day <n>");
    writeJSON(P.series, s);
    buildState();
    console.log(`✔ day ${s.day}`);
    break;
  }
  case "episode": {
    const s = series();
    const day = Number(opt("day", s.day));
    const title = opt("title");
    if (!title) die('Usage: episode --day d --title "…" [--summary "…"] [--instagram url] [--tiktok url] [--youtube url] [--latest]');
    const links = Object.fromEntries(["instagram", "tiktok", "youtube"].map((k) => [k, opt(k)]).filter(([, v]) => v));
    const ep = { day, date: opt("date", new Date().toISOString().slice(0, 10)), title, summary: opt("summary", ""), links };
    s.episodes = [...s.episodes.filter((e) => e.day !== day), ep].sort((a, b) => a.day - b.day);
    if (has("latest")) s.links.latestEpisode = links.instagram || links.tiktok || links.youtube || s.links.latestEpisode;
    writeJSON(P.series, s);
    buildState();
    console.log(`✔ episode day ${day}: ${title}`);
    break;
  }
  case "optout": {
    const h = cleanHandle(positional[0]);
    if (!h) die("Usage: optout <@handle>");
    const list = new Set(readJSON(P.optout, []));
    list.add(h);
    writeJSON(P.optout, [...list].sort());
    buildState();
    console.log(`✔ @${h} hidden (machine stays, name shows as PLAYER)`);
    break;
  }
  case "stats": {
    const s = buildState();
    console.log(`Day ${s.day} · ${s.totals.machines} machines · ${s.totals.newToday} new today`);
    const byDay = {};
    for (const m of s.machines) byDay[m[1]] = (byDay[m[1]] ?? 0) + 1;
    for (const [d, n] of Object.entries(byDay)) console.log(`  day ${d}: +${n}`);
    break;
  }
  case "seed-demo": {
    const n = seedDemo();
    buildState();
    console.log(`✔ demo hall with ${n} machines (source: "demo"). Run \`reset --yes\` before going live.`);
    break;
  }
  case "reset": {
    if (!has("yes")) die("This empties the ledger. Re-run with --yes.");
    writeJSON(P.ledger, []);
    const s = series();
    s.day = 1;
    s.episodes = [];
    writeJSON(P.series, s);
    buildState();
    console.log("✔ ledger emptied, day 1");
    break;
  }
  default:
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n\/\*\*?/, "").replace(/^ \* ?/gm, ""));
}
