#!/usr/bin/env node
/**
 * Level Tower data CLI. data/ledger.json is the private source of truth (likes per day + world picks);
 * public/data/state.json is derived from it and is what the website reads.
 *
 * Rules: 1 like = 1 floor. Commenters pick the world of the next floors, in comment order:
 * the first pick builds floor 2 (floor 1 is the Grassland base), the next pick floor 3, and so on.
 * Picks beyond the current floor count wait in the queue until enough likes arrive.
 * Floors nobody picked get a rotating world.
 *
 *   node scripts/tower.mjs build                              rebuild public/data/state.json
 *   node scripts/tower.mjs likes <n> [--day d] [--add]        set (or --add to) the like count of a day
 *   node scripts/tower.mjs add <world> <@handle> [--day d]    one manual world pick
 *   node scripts/tower.mjs import <file.csv|json> [--day d] [--kind comments|likes] [--dry-run]
 *        comments: columns id,handle,text,timestamp — the world is read from the text
 *        likes:    one row per like (handle column), or JSON { "likes": 123 }
 *   node scripts/tower.mjs match "<comment text>"             test the world parser
 *
 *   Custom requests (comments that name no known world are kept in data/requests.json):
 *   node scripts/tower.mjs requests                           list them, numbered
 *   OPTION 1 · custom label on an existing look (instant):
 *   node scripts/tower.mjs custom "<Label>" <@handle> --like <world> [--emoji 🟡] [--floor n] [--day d]
 *   node scripts/tower.mjs custom --request <n> --like <world> [--label "…"] [--emoji 🟡] [--floor n]
 *   OPTION 2 · a brand-new world (own colours, aliases, props; then add a "kit" in src/themes.json if wanted):
 *   node scripts/tower.mjs world-new <id> "<Name>" --like <world> [--emoji 🟡] [--colors top,rim,rock,accent]
 *                                    [--aliases "a,b,c"] [--from-label "<Label>"]   (--from-label upgrades option-1 floors)
 *   node scripts/tower.mjs add <world> <@handle> [--floor n] [--day d]   (--floor reserves that floor number)
 *   node scripts/tower.mjs day <n> | next-day
 *   node scripts/tower.mjs episode --day d --title "…" [--summary "…"] [--date YYYY-MM-DD]
 *                                  [--instagram url] [--tiktok url] [--youtube url] [--latest]
 *   node scripts/tower.mjs optout <@handle>                   show a handle as "anonymous"
 *   node scripts/tower.mjs stats
 *   node scripts/tower.mjs seed-demo                          replace the ledger with demo data
 *   node scripts/tower.mjs reset --yes                        empty the ledger (keeps series.json)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = {
  ledger: join(root, "data/ledger.json"),
  series: join(root, "data/series.json"),
  optout: join(root, "data/optout.json"),
  themes: join(root, "src/themes.json"),
  requests: join(root, "data/requests.json"),
  state: join(root, "public/data/state.json"),
};
const readJSON = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : d);
const writeJSON = (f, v, pretty = true) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(v, null, pretty ? 2 : 0) + "\n"); };
const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };

let THEMES = readJSON(P.themes, []);
const BASE = "grassland";
const DEFAULT_SERIES = {
  name: "Level Tower",
  tagline: "1 like = 1 floor. You pick the world.",
  rule: "1 like = 1 floor",
  day: 1,
  links: { latestEpisode: "", instagram: "https://www.instagram.com/ads_noads/", tiktok: "", youtube: "" },
  episodes: [],
};
const series = () => ({ ...DEFAULT_SERIES, ...readJSON(P.series, {}), links: { ...DEFAULT_SERIES.links, ...(readJSON(P.series, {}).links || {}) } });
const ledger = () => ({ likes: [], picks: [], ...readJSON(P.ledger, {}) });

export const cleanHandle = (h) => String(h || "").trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30);
const fold = (s) => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/* ---------------------------------------------------------------- world parser */
const aliasList = [];
const normAlias = (a) => fold(a).replace(/[^\p{L}\p{N}\p{Extended_Pictographic}‍️\s]/gu, " ").replace(/\s+/g, " ").trim();
for (const t of THEMES) for (const a of new Set([t.id, t.name, ...t.aliases])) if (normAlias(a)) aliasList.push([normAlias(a), t.id]);
aliasList.sort((a, b) => b[0].length - a[0].length); // longest alias first ("neon city" before "city")
/** Returns the theme id named in a comment (emoji or word, en/fr/es/de), or null. Earliest mention wins. */
export function parseWorld(text) {
  const s = ` ${fold(text).replace(/[^\p{L}\p{N}\p{Extended_Pictographic}‍️\s]/gu, " ")} `;
  let best = null;
  for (const [a, id] of aliasList) {
    const isWord = /^[\p{L}\p{N} ]+$/u.test(a);
    const re = isWord ? new RegExp(`(?<![\\p{L}\\p{N}])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u") : null;
    const idx = re ? s.search(re) : s.indexOf(a);
    if (idx >= 0 && (!best || idx < best.idx)) best = { idx, id };
  }
  return best?.id ?? null;
}

/* ---------------------------------------------------------------- build */
function buildState() {
  const S = series();
  const L = ledger();
  const opt = new Set(readJSON(P.optout, []).map(cleanHandle));
  const showName = (h) => (opt.has(h) ? "anonymous" : h);
  const tIndex = new Map(THEMES.map((t, i) => [t.id, i]));

  // likes → floors, and which day built each floor
  const byDay = new Map();
  for (const l of L.likes) byDay.set(l.day, (byDay.get(l.day) || 0) + Number(l.count || 0));
  const likesByDay = [...byDay].sort((a, b) => a[0] - b[0]).map(([day, likes]) => ({ day, likes }));
  const totalLikes = likesByDay.reduce((n, d) => n + d.likes, 0);
  const floorsCount = Math.max(1, totalLikes);
  const floorDay = [];
  for (const d of likesByDay) for (let k = 0; k < d.likes && floorDay.length < floorsCount; k++) floorDay.push(d.day);
  while (floorDay.length < floorsCount) floorDay.push(likesByDay[0]?.day ?? S.day);

  // picks in comment order → floors 2..N, overflow → queue
  const picks = [...L.picks].filter((p) => tIndex.has(p.theme)).sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : String(a.id).localeCompare(String(b.id))));
  const handles = [];
  const hIndex = new Map();
  const hid = (h) => { if (!hIndex.has(h)) { hIndex.set(h, handles.length); handles.push(h); } return hIndex.get(h); };
  const floors = [];
  const labels = {};
  const rotation = THEMES.map((t) => t.id).filter((id) => id !== BASE);
  // Reserved floors ("--floor n"): the first pick for a number gets it; everything else fills free floors in order.
  const pinned = new Map();
  const free = [];
  for (const p of picks) { const f = Number(p.floor); if (f >= 2 && !pinned.has(f)) pinned.set(f, p); else free.push(p); }
  const queueAt = [];
  const use = (p, f) => { if (p.label) labels[f] = { name: p.label, emoji: p.emoji || THEMES[tIndex.get(p.theme)].emoji }; };
  for (let f = 1; f <= floorsCount; f++) {
    if (f === 1) { floors.push([tIndex.get(BASE), -1, floorDay[0], 0]); continue; }
    const p = pinned.get(f) ?? free.shift();
    if (p) { floors.push([tIndex.get(p.theme), hid(showName(cleanHandle(p.handle))), floorDay[f - 1], p.day ?? floorDay[f - 1]]); use(p, f); }
    else floors.push([tIndex.get(rotation[(f * 7) % rotation.length]), -1, floorDay[f - 1], 0]);
  }
  // Queue: reserved floors above the top, then free picks on the next unclaimed floors.
  for (const [f, p] of pinned) if (f > floorsCount) queueAt.push([f, p]);
  for (let f = floorsCount + 1; free.length; f++) if (!pinned.has(f)) queueAt.push([f, free.shift()]);
  const queue = queueAt.sort((a, b) => a[0] - b[0]).map(([f, p]) => ({ handle: showName(cleanHandle(p.handle)), theme: p.theme, ...(p.label ? { label: p.label } : {}), floor: f, day: p.day }));

  // per-handle floor counts → top builders
  const count = new Map();
  floors.forEach(([, h]) => { if (h >= 0 && handles[h] !== "anonymous") count.set(h, (count.get(h) || 0) + 1); });
  const builders = [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 25).map(([h, n], i) => ({ rank: i + 1, handle: handles[h], floors: n }));
  const themeCounts = Object.fromEntries(THEMES.map((t) => [t.id, 0]));
  floors.forEach(([t]) => themeCounts[THEMES[t].id]++);

  const latestPicked = [...floors.entries()].filter(([, f]) => f[1] >= 0).slice(-3).reverse();
  const episodes = [...(S.episodes || [])].sort((a, b) => b.day - a.day);
  const state = {
    version: 1,
    updatedAt: new Date().toISOString(),
    day: S.day,
    series: { name: S.name, tagline: S.tagline, rule: S.rule },
    links: S.links,
    episodes,
    totals: {
      floors: floorsCount,
      likes: totalLikes,
      picks: picks.length,
      builders: new Set(picks.map((p) => cleanHandle(p.handle))).size,
      queued: queue.length,
      worlds: Object.values(themeCounts).filter(Boolean).length,
      likesToday: byDay.get(S.day) || 0,
    },
    rules: { base: BASE, floorsPerLike: 1 },
    themes: THEMES.map(({ id, name, emoji, top, rim, rock, accent, base, kit }) => ({ id, name, emoji, top, rim, rock, accent, ...(base ? { base } : {}), ...(kit ? { kit } : {}) })),
    labels,
    /** floors[i] = floor i+1 as [themeIndex, handleIndex (-1 = nobody), dayBuilt, dayPicked] */
    floors,
    handles,
    queue,
    builders,
    likesByDay,
    themeCounts,
    preview: {
      headline: "1 LIKE = 1 FLOOR",
      stat: floorsCount,
      statLabel: "floors",
      top: latestPicked.map(([i, f]) => ({ label: `Floor ${i + 1} · ${labels[i + 1]?.name ?? THEMES[f[0]].name}`, sub: `@${handles[f[1]]}` })),
    },
  };
  writeJSON(P.state, state, false);
  return state;
}

/* ---------------------------------------------------------------- import helpers */
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
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])));
}
function setLikes(L, day, n, add) {
  const cur = L.likes.filter((l) => l.day === day).reduce((s, l) => s + l.count, 0);
  L.likes = L.likes.filter((l) => l.day !== day);
  L.likes.push({ day, count: add ? cur + n : n, source: "manual" });
  L.likes.sort((a, b) => a.day - b.day);
}

/* ---------------------------------------------------------------- demo */
function seedDemo() {
  let s = 20261030; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const first = ["mia", "leo", "noah", "zoe", "sami", "yuki", "omar", "lina", "theo", "ava", "ines", "ravi", "jade", "max", "lou", "aya", "eli", "nina", "kai", "rosa", "ivan", "emma", "luca", "sofia", "jay", "nour", "tom", "lea", "finn", "maya"];
  const tags = ["builds", "climbs", "plays", "gg", "tower", "pixel", "skye", "nova", "lvl", "up", "xo", "dreams", "craft", "jumps"];
  const make = () => `${pick(first)}${pick([".", "_", "", "_the_"])}${pick(tags)}${rnd() < 0.4 ? Math.floor(rnd() * 99) : ""}`;
  const regulars = ["skye.climbs", "lava.queen", "pixel_theo", "nina.builds", "kai_up"];
  const pool = [...regulars, ...Array.from({ length: 150 }, make)];
  const favs = { "skye.climbs": "castle", "lava.queen": "lava", "pixel_theo": "cyber", "nina.builds": "sakura", "kai_up": "space" };
  const weights = { lava: 14, ice: 12, neon: 12, crystal: 10, space: 10, candy: 9, jungle: 8, desert: 7, ocean: 8, castle: 7, haunted: 6, cyber: 6, gold: 5, autumn: 4, sakura: 6, grassland: 3 };
  const wlist = Object.entries(weights).flatMap(([k, w]) => Array(w).fill(k));
  const phrasing = { lava: ["LAVA 🌋", "lava world pls", "volcano!!", "🔥🔥 lava"], ice: ["ice ❄️", "snow world", "frozen floor pls"], neon: ["neon city", "🌃", "NEON"], crystal: ["crystal cave 💎", "crystals"], space: ["space 🚀", "galaxy floor", "moon!"],
    candy: ["candy land 🍭", "sweets"], jungle: ["jungle 🌴", "tropical"], desert: ["desert with pyramids", "🏜️"], ocean: ["ocean 🌊", "beach floor"], castle: ["cloud castle 🏰", "castle"], haunted: ["haunted 👻", "spooky floor"],
    cyber: ["cyber grid 🤖", "robot world"], gold: ["gold 💰", "treasure vault"], autumn: ["autumn 🍂"], sakura: ["sakura 🌸", "cherry blossom"], grassland: ["grass 🌳"] };
  const picks = [];
  let id = 1;
  const days = [[1, 72], [2, 131], [3, 149]];
  for (const [day, n] of days) {
    for (let k = 0; k < n; k++) {
      const handle = rnd() < 0.18 ? pick(regulars) : pick(pool);
      const theme = favs[handle] && rnd() < 0.8 ? favs[handle] : pick(wlist);
      const ts = `2026-10-${String(27 + day).padStart(2, "0")}T${String(8 + Math.floor((k / n) * 14)).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}Z`;
      picks.push({ id: `demo-${id++}`, handle, theme, text: pick(phrasing[theme]), day, ts, source: "demo" });
    }
  }
  const likes = [{ day: 1, count: 66, source: "demo" }, { day: 2, count: 118, source: "demo" }, { day: 3, count: 154, source: "demo" }];
  writeJSON(P.ledger, { likes, picks });
  const S = series();
  S.day = 3;
  S.links = { ...S.links, latestEpisode: "https://www.instagram.com/ads_noads/" };
  S.episodes = [
    { day: 1, date: "2026-10-28", title: "One like. One floor.", summary: "Floor 1 is a quiet grassland. Every like adds a floor, and your comments pick the world.", links: { instagram: "https://www.instagram.com/ads_noads/" } },
    { day: 2, date: "2026-10-29", title: "You pick the world", summary: "Lava, ice and neon city stack up fast. The tower passes 180 floors.", links: { instagram: "https://www.instagram.com/ads_noads/" } },
    { day: 3, date: "2026-10-30", title: "Above the clouds", summary: "338 floors and every one of them named. 14 worlds are already waiting in the queue for the next likes.", links: { instagram: "https://www.instagram.com/ads_noads/" } },
  ];
  writeJSON(P.series, S);
  return picks.length;
}

/* ---------------------------------------------------------------- CLI */
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name, def) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : def; };
const has = (name) => rest.includes(`--${name}`);
const BOOL = ["--yes", "--dry-run", "--latest", "--add"];
const positional = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--") && !BOOL.includes(rest[i - 1])));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  switch (cmd) {
    case "build": {
      const st = buildState();
      console.log(`✔ state.json: day ${st.day}, ${st.totals.floors} floors, ${st.totals.picks} picks by ${st.totals.builders} builders, ${st.totals.queued} queued`);
      break;
    }
    case "likes": {
      const n = Number(positional[0]); if (!Number.isInteger(n) || n < 0) die("usage: likes <n> [--day d] [--add]");
      const L = ledger(); const day = Number(flag("day", series().day));
      setLikes(L, day, n, has("add")); writeJSON(P.ledger, L); const st = buildState();
      console.log(`✔ day ${day} likes ${has("add") ? "+" : "="}${n} → ${st.totals.floors} floors`);
      break;
    }
    case "add": {
      const [worldArg, handleArg] = positional;
      if (!worldArg || !handleArg) die("usage: add <world> <@handle> [--day d]");
      const theme = parseWorld(worldArg); if (!theme) die(`unknown world "${worldArg}" — try: ${THEMES.map((t) => t.id).join(", ")}`);
      const L = ledger(); const day = Number(flag("day", series().day));
      const floor = flag("floor") ? Number(flag("floor")) : undefined;
      L.picks.push({ id: `manual-${Date.now()}`, handle: cleanHandle(handleArg), theme, text: worldArg, day, ts: new Date().toISOString(), source: "manual", ...(floor ? { floor } : {}) });
      writeJSON(P.ledger, L); buildState();
      console.log(`✔ @${cleanHandle(handleArg)} picked ${theme}${floor ? ` for floor ${floor}` : ""} (day ${day})`);
      break;
    }
    case "import": {
      const file = positional[0]; if (!file || !existsSync(file)) die("usage: import <file.csv|json> [--day d] [--kind comments|likes] [--dry-run]");
      const raw = readFileSync(file, "utf8");
      const isJSON = extname(file).toLowerCase() === ".json";
      const data = isJSON ? JSON.parse(raw) : parseCSV(raw);
      const L = ledger(); const day = Number(flag("day", series().day));
      const kind = flag("kind", !isJSON && data[0] && !("text" in data[0] || "comment" in data[0]) ? "likes" : "comments");
      if (kind === "likes") {
        const n = isJSON && !Array.isArray(data) ? Number(data.likes) : new Set((Array.isArray(data) ? data : []).map((r) => cleanHandle(r.handle || r.username || r.user) || JSON.stringify(r))).size;
        if (!has("dry-run")) { setLikes(L, day, n, false); writeJSON(P.ledger, L); buildState(); }
        console.log(`✔ day ${day}: ${n} likes ${has("dry-run") ? "(dry run)" : "saved"}`);
        break;
      }
      const rows = Array.isArray(data) ? data : data.comments || [];
      const seen = new Set(L.picks.map((p) => String(p.id)));
      let added = 0, dup = 0; const unmatched = [];
      for (const r of rows) {
        const id = String(r.id || r.comment_id || `${r.handle || r.username}|${r.timestamp || r.ts}|${r.text}`);
        if (seen.has(id)) { dup++; continue; }
        const text = r.text ?? r.comment ?? r.body ?? "";
        const theme = parseWorld(text);
        if (!theme) { unmatched.push({ id, handle: cleanHandle(r.handle || r.username || r.user), text: String(text).slice(0, 140), day, ts: r.timestamp || r.ts || new Date().toISOString() }); continue; }
        seen.add(id);
        L.picks.push({ id, handle: cleanHandle(r.handle || r.username || r.user), theme, text: String(text).slice(0, 140), day, ts: r.timestamp || r.ts || new Date().toISOString(), source: "import" });
        added++;
      }
      if (!has("dry-run")) {
        writeJSON(P.ledger, L);
        const reqs = readJSON(P.requests, []); const known = new Set(reqs.map((q) => q.id));
        for (const u of unmatched) if (!known.has(u.id)) reqs.push(u);
        writeJSON(P.requests, reqs); buildState();
      }
      console.log(`✔ ${added} world pick(s) ${has("dry-run") ? "would be " : ""}added, ${dup} duplicate(s) skipped, ${unmatched.length} comment(s) without a known world`);
      if (unmatched.length) console.log(`  ${has("dry-run") ? "would be " : ""}kept in data/requests.json → review with: requests`, "\n  e.g.", unmatched.slice(0, 6).map((u) => JSON.stringify(u.text.slice(0, 50))).join(", "));
      break;
    }
    case "requests": {
      const reqs = readJSON(P.requests, []);
      if (!reqs.length) { console.log("No pending requests."); break; }
      reqs.forEach((q, i) => console.log(`${String(i + 1).padStart(3)}. day ${q.day} @${q.handle.padEnd(22)} ${JSON.stringify(q.text)}`));
      console.log(`\nOption 1: custom --request <n> --like <world> [--label "…"] [--floor n]\nOption 2: world-new <id> "<Name>" --like <world> …  then  add <id> @handle\nIgnore:   dismiss <n>`);
      break;
    }
    case "dismiss": {
      const reqs = readJSON(P.requests, []); const n = Number(positional[0]);
      if (!reqs[n - 1]) die("usage: dismiss <n> (see: requests)");
      const [q] = reqs.splice(n - 1, 1); writeJSON(P.requests, reqs);
      console.log(`✔ dismissed ${JSON.stringify(q.text)} by @${q.handle}`);
      break;
    }
    case "custom": {
      const like = flag("like"); const theme = like && parseWorld(like);
      if (!theme) die(`--like <world> is required (one of: ${THEMES.map((t) => t.id).join(", ")})`);
      const L = ledger(); const reqs = readJSON(P.requests, []);
      let label, handle, day = Number(flag("day", series().day)), id = `custom-${Date.now()}`, ts = new Date().toISOString(), text;
      if (flag("request")) {
        const n = Number(flag("request")); const q = reqs[n - 1]; if (!q) die("unknown request number (see: requests)");
        label = flag("label", q.text); handle = q.handle; day = q.day; id = q.id; ts = q.ts; text = q.text;
        reqs.splice(n - 1, 1); writeJSON(P.requests, reqs);
      } else {
        [label, handle] = positional; if (!label || !handle) die('usage: custom "<Label>" <@handle> --like <world> [--emoji 🟡] [--floor n]');
        text = label;
      }
      const floor = flag("floor") ? Number(flag("floor")) : undefined;
      L.picks.push({ id, handle: cleanHandle(handle), theme, label: String(label).slice(0, 32), ...(flag("emoji") ? { emoji: flag("emoji") } : {}), text, day, ts, source: "custom", ...(floor ? { floor } : {}) });
      writeJSON(P.ledger, L); buildState();
      console.log(`✔ @${cleanHandle(handle)} → "${label}" (looks like ${theme})${floor ? ` on floor ${floor}` : ""}`);
      break;
    }
    case "world-new": {
      const [idArg, name] = positional; const like = flag("like"); const base = like && parseWorld(like);
      const id = String(idArg || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!id || !name || !base) die('usage: world-new <id> "<Name>" --like <world> [--emoji 🟡] [--colors top,rim,rock,accent] [--aliases "a,b"] [--from-label "<Label>"]');
      if (THEMES.some((t) => t.id === id)) die(`world "${id}" already exists`);
      const b = THEMES.find((t) => t.id === base);
      const [top, rim, rock, accent] = (flag("colors", "") || "").split(",").map((c) => c.trim()).filter(Boolean);
      const aliases = [...new Set([id, fold(name), ...String(flag("aliases", "")).split(",").map((a) => fold(a.trim())).filter(Boolean)])];
      const theme = { id, name, emoji: flag("emoji", b.emoji), top: top || b.top, rim: rim || b.rim, rock: rock || b.rock, accent: accent || b.accent, base: b.base ?? b.id, aliases };
      THEMES = [...THEMES, theme]; writeJSON(P.themes, THEMES);
      let moved = 0;
      if (flag("from-label")) {
        const want = fold(flag("from-label")); const L = ledger();
        for (const p of L.picks) if (p.label && fold(p.label) === want) { p.theme = id; delete p.label; delete p.emoji; moved++; }
        writeJSON(P.ledger, L);
      }
      console.log(`✔ new world "${name}" (${id}) based on ${theme.base}${moved ? `, ${moved} custom floor(s) upgraded` : ""}.`);
      console.log(`  Run "build" (or any command) to publish. For unique props, add a "kit" to it in src/themes.json (see README).`);
      break;
    }
    case "match": {
      const id = parseWorld(positional.join(" "));
      console.log(id ? `${id} · ${THEMES.find((t) => t.id === id).name}` : "no world found");
      break;
    }
    case "day":
    case "next-day": {
      const S = series();
      S.day = cmd === "next-day" ? S.day + 1 : Number(positional[0]);
      if (!Number.isInteger(S.day) || S.day < 1) die("usage: day <n>");
      writeJSON(P.series, S); buildState();
      console.log(`✔ day is now ${S.day}`);
      break;
    }
    case "episode": {
      const S = series();
      const day = Number(flag("day", S.day));
      const links = Object.fromEntries(["instagram", "tiktok", "youtube"].map((k) => [k, flag(k)]).filter(([, v]) => v));
      const ep = { day, date: flag("date", new Date().toISOString().slice(0, 10)), title: flag("title", `Day ${day}`), summary: flag("summary", ""), links };
      S.episodes = [...(S.episodes || []).filter((e) => e.day !== day), ep].sort((a, b) => a.day - b.day);
      if (has("latest") || day >= S.day) S.links = { ...S.links, latestEpisode: links.instagram || links.tiktok || links.youtube || S.links.latestEpisode };
      writeJSON(P.series, S); buildState();
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
      const st = buildState();
      console.log(`Day ${st.day} · ${st.totals.floors} floors · ${st.totals.likes} likes · ${st.totals.picks} picks · ${st.totals.queued} queued`);
      for (const b of st.builders.slice(0, 10)) console.log(`${String(b.rank).padStart(3)}. @${b.handle.padEnd(24)} ${b.floors} floor(s)`);
      console.log("Worlds:", Object.entries(st.themeCounts).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", "));
      break;
    }
    case "seed-demo": {
      const n = seedDemo(); const st = buildState();
      console.log(`✔ demo ledger with ${n} picks → ${st.totals.floors} floors`);
      break;
    }
    case "reset": {
      if (!has("yes")) die("this empties data/ledger.json — re-run with --yes");
      writeJSON(P.ledger, { likes: [], picks: [] }); buildState();
      console.log("✔ ledger emptied");
      break;
    }
    default:
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n\/\*\*?/, "").replace(/^ \* ?/gm, ""));
  }
}
