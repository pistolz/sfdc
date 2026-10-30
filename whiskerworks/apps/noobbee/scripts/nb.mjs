#!/usr/bin/env node
/**
 * Noob Bee data CLI. 1 comment = 1 level up: every counted comment teaches the bee one skill.
 * data/ledger.json is the private source of truth; public/data/state.json is derived from it.
 *
 *   node scripts/nb.mjs build                              rebuild public/data/state.json
 *   node scripts/nb.mjs add <@handle> "<skill>" [--day d]   teach one skill by hand
 *   node scripts/nb.mjs import <comments.csv|json> [--day d] [--dedupe] [--dry-run]
 *                                                          CSV/JSON columns: id, handle, text, timestamp
 *   node scripts/nb.mjs clean "<comment text>"             test the skill cleaner / filter
 *   node scripts/nb.mjs day <n> | next-day
 *   node scripts/nb.mjs episode --day d --title "…" [--summary "…"] [--date YYYY-MM-DD]
 *                                 [--instagram url] [--tiktok url] [--youtube url] [--latest]
 *   node scripts/nb.mjs optout <@handle>                   show a handle as "anonymous" everywhere
 *   node scripts/nb.mjs remove <level>                     drop one level (moderation)
 *   node scripts/nb.mjs stats
 *   node scripts/nb.mjs seed-demo                          replace the ledger with demo data
 *   node scripts/nb.mjs reset --yes                        empty the ledger (keeps series.json)
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

const IG = "https://www.instagram.com/ads_noads/";
const DEFAULT_SERIES = {
  name: "Noob Bee",
  tagline: "1 comment = 1 level up. Teach the noob bee anything.",
  rule: "1 comment = 1 level up",
  day: 1,
  rules: { maxSkillLength: 40, dedupeSkills: false },
  links: { latestEpisode: IG, instagram: IG, tiktok: "", youtube: "" },
  episodes: [],
};

/* ---------------------------------------------------------------- bee ranks */
const RANKS = [
  [1, "Noob"], [10, "Rookie"], [25, "Apprentice"], [50, "Pro"], [100, "Expert"], [200, "Master"], [500, "Legend"], [1000, "Queen Bee"],
];
function rankFor(level) {
  let i = 0;
  while (i + 1 < RANKS.length && level >= RANKS[i + 1][0]) i++;
  return { rank: RANKS[i][1], nextRank: RANKS[i + 1]?.[1] ?? null, nextRankAt: RANKS[i + 1]?.[0] ?? null };
}

/* ---------------------------------------------------------------- skill cleaning */
// Small built-in blocklist (EN/FR/ES). Matching is on normalized text, as substrings.
const BLOCK = [
  "fuck", "fck", "shit", "bitch", "cunt", "nigg", "fag", "whore", "slut", "dick", "pussy", "rape", "nazi", "hitler", "kys",
  "kill yourself", "porn", "sex", "cock", "retard", "merde", "pute", "connard", "salope", "encule", "nique", "batard", "pd ",
  "puta", "mierda", "cabron", "pendejo", "maricon",
];
const plain = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
function cleanSkill(raw, max = 40) {
  if (!raw) return { ok: false, why: "empty" };
  let s = String(raw)
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/(^|\s)@[\w.]+/g, " ")
    .replace(/#(\w+)/g, "$1")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(teach (him|her|it|the bee|bee) (to |how to )?|learn (to |how to )?|level up:?\s*|skill:?\s*)/i, "")
    .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
    .trim();
  const letters = s.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return { ok: false, why: "no words" };
  const p = ` ${plain(s)} `;
  if (BLOCK.some((b) => p.includes(b))) return { ok: false, why: "blocked" };
  if (s.length > max) s = s.slice(0, max - 1).replace(/\s+\S*$/, "").trim() + "…";
  if (s === s.toUpperCase() && s.length > 4) s = s.toLowerCase();
  return { ok: true, skill: s };
}

const EMOJI = [
  [/moon ?walk/, "🕺"], [/wall/, "🧱"], [/skate/, "🛹"], [/backflip|front ?flip|flip/, "🤸"], [/cartwheel|gymnast/, "🤸"],
  [/fly|wing/, "🪽"], [/swim|dive/, "🏊"], [/surf/, "🏄"], [/ski\b|snowboard/, "⛷️"], [/bike|cycle/, "🚲"], [/drive|car\b/, "🚗"],
  [/dance|breakdance|twerk|floss/, "💃"], [/sing|opera|rap\b/, "🎤"], [/guitar/, "🎸"], [/piano/, "🎹"], [/drum/, "🥁"],
  [/karate|kung ?fu|ninja/, "🥋"], [/box|punch|fight/, "🥊"], [/soccer|football|kick/, "⚽"], [/basket/, "🏀"], [/tennis/, "🎾"],
  [/honey/, "🍯"], [/cook|bake|cake|pizza|chef/, "🧑‍🍳"], [/code|program|hack/, "💻"], [/read|book/, "📚"], [/math|count/, "🔢"],
  [/magic|spell|teleport|invisib/, "🪄"], [/sleep|nap/, "😴"], [/run|sprint/, "🏃"], [/climb/, "🧗"], [/jump|hop/, "🦘"],
  [/juggl/, "🤹"], [/speak|french|spanish|english|language|say/, "🗣️"], [/whistle/, "🎶"], [/fish/, "🎣"], [/paint|draw/, "🎨"],
  [/laser|robot/, "🤖"], [/fire|dragon/, "🔥"], [/rocket|space|moon\b/, "🚀"], [/sword/, "⚔️"], [/shield/, "🛡️"], [/yoga|meditat/, "🧘"],
  [/smile|laugh|joke/, "😄"], [/wave|hello|hi\b/, "👋"], [/game|play/, "🎮"], [/photo|selfie/, "📸"], [/garden|plant|flower|pollen/, "🌼"],
];
const emojiFor = (skill) => EMOJI.find(([re]) => re.test(plain(skill)))?.[1] ?? "⭐";
const cleanHandle = (h) => String(h || "").trim().replace(/^@+/, "").toLowerCase().replace(/[^\w.]/g, "");

/* ---------------------------------------------------------------- state */
function buildState() {
  const series = { ...DEFAULT_SERIES, ...readJSON(P.series, {}) };
  const ledger = readJSON(P.ledger, []);
  const optout = new Set(readJSON(P.optout, []).map(cleanHandle));
  const show = (h) => (optout.has(h) ? "anonymous" : h);

  const claims = [...ledger].filter((c) => !c.removed).sort((a, b) => (a.day - b.day) || String(a.ts).localeCompare(String(b.ts)) || String(a.id).localeCompare(String(b.id)));
  const levels = [];
  const H = new Map();
  for (const cl of claims) {
    const h = cleanHandle(cl.handle);
    const n = levels.length + 1;
    levels.push({ n, handle: show(h), skill: cl.skill, emoji: emojiFor(cl.skill), day: cl.day });
    if (!optout.has(h)) {
      if (!H.has(h)) H.set(h, { total: 0, levels: [], first: n, firstDay: cl.day });
      const u = H.get(h); u.total++; u.levels.push(n);
    }
  }
  const top = levels.length;
  const players = new Set(claims.map((c) => cleanHandle(c.handle))).size;
  const uniqueSkills = new Set(levels.map((l) => plain(l.skill))).size;
  const today = levels.filter((l) => l.day === series.day).length;
  const r = rankFor(Math.max(1, top));
  const handles = Object.fromEntries([...H.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  const topTeachers = [...H.entries()].sort((a, b) => b[1].total - a[1].total || a[1].first - b[1].first).slice(0, 10).map(([handle, u]) => ({ handle, levels: u.total }));
  const latest = levels.slice(-3).reverse();
  const state = {
    version: 1,
    updatedAt: new Date().toISOString(),
    day: series.day,
    series: { name: series.name, tagline: series.tagline, rule: series.rule },
    links: series.links,
    episodes: [...(series.episodes || [])].sort((a, b) => b.day - a.day),
    totals: { levels: top, players, uniqueSkills, today },
    bee: { level: top, rank: top ? r.rank : "Egg", nextRank: r.nextRank, nextRankAt: r.nextRankAt },
    preview: {
      headline: top ? `Noob Bee is a level ${top} ${r.rank}` : "Noob Bee hatches soon",
      stat: String(top),
      statLabel: "levels learned",
      top: latest.map((l) => ({ label: `${l.emoji} ${l.skill}`, sub: `LV ${l.n} · @${l.handle}` })),
    },
    topTeachers,
    levels,
    handles,
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
const DEMO_SKILLS = [
  "walk", "stand up", "open eyes", "say hi", "wave", "smile", "blink", "jump", "wall jump!", "jump a wall", "fly", "fly higher",
  "skateboard", "ollie on the skateboard", "kickflip", "moonwalk", "breakdance", "do the floss", "backflip", "cartwheel",
  "make honey", "find a flower", "collect pollen", "swim", "dive", "surf", "ski", "ride a bike", "drive a car", "play guitar",
  "play piano", "play drums", "sing opera", "rap", "beatbox", "karate", "kung fu", "ninja run", "boxing", "kick a ball", "dribble",
  "slam dunk", "play tennis", "cook pasta", "bake a cake", "make pizza", "code in python", "hack the mainframe", "read a book",
  "count to 10", "do math", "speak french", "speak spanish", "say bonjour", "whistle", "juggle", "magic trick", "teleport",
  "become invisible", "sleep", "power nap", "run fast", "sprint", "climb a tree", "climb a mountain", "fish", "paint", "draw a cat",
  "summon a dragon", "breathe fire", "fly a rocket", "land on the moon", "sword fight", "block with a shield", "yoga", "meditate",
  "tell a joke", "laugh", "take a selfie", "plant a garden", "play video games", "speedrun", "do a wheelie", "parkour", "slide",
  "double jump", "triple jump", "dodge", "roll", "spin", "hover", "dash", "ground pound", "grapple hook", "shoot lasers",
  "build a robot", "ride a dragon", "tame a cat", "pet the dog", "high five", "hug", "dance salsa", "tango", "ice skate",
  "snowboard", "bungee jump", "skydive", "parachute", "glide", "zip line", "wall run", "climb the honeycomb", "find the queen",
  "beat the boss", "save the hive", "open a portal", "time travel", "make friends", "dab", "the worm", "griddy", "macarena",
  "do a handstand", "push ups", "lift weights", "fly upside down", "barrel roll", "loop the loop", "catch a coin", "collect 100 coins",
  "level up faster", "be less noob", "stop falling", "not cry", "tie shoes", "brush teeth", "make coffee", "drink tea",
];
const DEMO_HANDLES = [
  "honey.mira", "buzz_kai", "noah.flies", "skate_lina", "queenbee_aya", "pollen.pete", "hive_mind_omar", "sami.buzz", "yuna_wings",
  "theo.stinger", "zara.honeycomb", "ines_bzz", "ravi.nectar", "ana_beekeeper", "max.wallrun", "lou_flaps", "eli.dash", "jade.dances",
  "milo_moonwalk", "rosa.petals", "ivan_hops", "nina_glides", "adam.combo", "leo.kickflip", "kai.ninja", "mira.sings", "omar_jumps",
  "lina.surf", "nora.codes", "aya_bakes", "jules.bee", "chloe_buzz", "tom.honey", "emma.flies", "lucas_noob", "sofia.wings", "hugo.pollen",
  "lea_hive", "gab.stings", "manon.drift", "nathan.wall", "camille_jam", "louis.combo", "zoe.flower", "arthur_pro", "alice.buzzz",
  "ethan.speedrun", "lily_nectar", "jay.parkour", "mia_runs", "leo.taps", "nova.k", "ruby.lvl9", "sam.combo", "ollie.gg", "bytebee",
  "lumi.play", "zed_jumps", "kaia.honey", "fern.bzz", "otto.flips", "pia.beebop", "remy_hover", "suki.dash", "tariq.glide", "uma.stripe",
  "vik.waggle", "wren.pollen", "xia.sting", "yara.combs", "zane.buzz",
];
function seedDemo() {
  let s = 20261030; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const perDay = [72, 88, 104];
  const regulars = DEMO_HANDLES.slice(0, 8); // a few super-teachers
  const ledger = [];
  let id = 1, skillIdx = 0;
  perDay.forEach((count, d) => {
    const day = d + 1;
    for (let k = 0; k < count; k++) {
      // the first skills follow the noob story, then the crowd takes over
      const skill = skillIdx < 12 ? DEMO_SKILLS[skillIdx++] : rnd() < 0.82 ? pick(DEMO_SKILLS.slice(8)) : DEMO_SKILLS[8 + Math.floor(rnd() * 12)];
      const handle = rnd() < 0.3 ? pick(regulars) : pick(DEMO_HANDLES);
      const mins = Math.floor((k / count) * 14 * 60);
      const ts = `2026-10-${String(27 + day).padStart(2, "0")}T${String(8 + Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}Z`;
      ledger.push({ id: `demo-${id++}`, handle, skill, day, ts, source: "demo" });
    }
  });
  writeJSON(P.ledger, ledger);
  const series = { ...DEFAULT_SERIES, ...readJSON(P.series, {}) };
  series.day = 3;
  series.episodes = [
    { day: 1, date: "2026-10-28", title: "Meet the noob", summary: "He can't even jump a wall. Every comment teaches him one thing: first lesson, walking.", links: { instagram: IG } },
    { day: 2, date: "2026-10-29", title: "Wall jump unlocked", summary: "Wall jumps, a skateboard and a very questionable moonwalk. The noob is now a Rookie.", links: { instagram: IG } },
    { day: 3, date: "2026-10-30", title: "Is he still a noob?", summary: "Over 250 levels: breakdance, karate, time travel. Tomorrow he goes Expert — what should he learn next?", links: { instagram: IG } },
  ];
  writeJSON(P.series, series);
  return ledger.length;
}

/* ---------------------------------------------------------------- CLI */
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name, def) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : def; };
const has = (name) => rest.includes(`--${name}`);
const BOOL = ["--yes", "--dry-run", "--latest", "--dedupe"];
const positional = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--") && !BOOL.includes(rest[i - 1])));
const series = () => ({ ...DEFAULT_SERIES, ...readJSON(P.series, {}) });

switch (cmd) {
  case "build": {
    const st = buildState();
    console.log(`✔ state.json: day ${st.day}, level ${st.totals.levels} (${st.bee.rank}), ${st.totals.players} players`);
    break;
  }
  case "add": {
    const [handleArg, ...skillParts] = positional;
    const res = cleanSkill(skillParts.join(" "), series().rules?.maxSkillLength ?? 40);
    if (!handleArg || !res.ok) die(`usage: add <@handle> "<skill>"${res.why ? ` (${res.why})` : ""}`);
    const ledger = readJSON(P.ledger, []);
    ledger.push({ id: `manual-${Date.now()}`, handle: cleanHandle(handleArg), skill: res.skill, day: Number(flag("day", series().day)), ts: new Date().toISOString(), source: "manual" });
    writeJSON(P.ledger, ledger);
    const st = buildState();
    console.log(`✔ level ${st.totals.levels}: @${cleanHandle(handleArg)} taught "${res.skill}"`);
    break;
  }
  case "import": {
    const file = positional[0]; if (!file || !existsSync(file)) die("usage: import <comments.csv|json> [--day d] [--dedupe] [--dry-run]");
    const raw = readFileSync(file, "utf8");
    const rows = extname(file).toLowerCase() === ".json" ? JSON.parse(raw) : parseCSV(raw);
    const s = series();
    const dedupe = has("dedupe") || s.rules?.dedupeSkills;
    const ledger = readJSON(P.ledger, []);
    const seen = new Set(ledger.map((c) => c.id));
    const known = new Set(ledger.map((c) => plain(c.skill)));
    const day = Number(flag("day", s.day));
    let added = 0, dup = 0, same = 0; const rejected = [];
    for (const r of rows) {
      const id = String(r.id || r.comment_id || `${r.handle || r.username}|${r.timestamp || r.ts}|${r.text}`);
      if (seen.has(id)) { dup++; continue; }
      const res = cleanSkill(r.text ?? r.comment ?? r.body ?? "", s.rules?.maxSkillLength ?? 40);
      if (!res.ok) { rejected.push(`${res.why}: ${String(r.text ?? "").slice(0, 40)}`); continue; }
      if (dedupe && known.has(plain(res.skill))) { same++; continue; }
      seen.add(id); known.add(plain(res.skill));
      ledger.push({ id, handle: cleanHandle(r.handle || r.username || r.user), skill: res.skill, day, ts: r.timestamp || r.ts || new Date().toISOString(), source: "import" });
      added++;
    }
    if (!has("dry-run")) { writeJSON(P.ledger, ledger); buildState(); }
    console.log(`✔ ${added} level(s) ${has("dry-run") ? "would be " : ""}added, ${dup} duplicate comment(s), ${same} repeated skill(s), ${rejected.length} rejected`);
    if (rejected.length) console.log("  rejected sample:", rejected.slice(0, 8).map((t) => JSON.stringify(t)).join(", "));
    break;
  }
  case "clean": {
    const res = cleanSkill(positional.join(" "));
    console.log(res.ok ? `✔ "${res.skill}" ${emojiFor(res.skill)}` : `✖ rejected (${res.why})`);
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
  case "remove": {
    const n = Number(positional[0]);
    const st = buildState();
    const lvl = st.levels[n - 1]; if (!lvl) die("usage: remove <level number>");
    const ledger = readJSON(P.ledger, []);
    const sorted = [...ledger].filter((c) => !c.removed).sort((a, b) => (a.day - b.day) || String(a.ts).localeCompare(String(b.ts)) || String(a.id).localeCompare(String(b.id)));
    sorted[n - 1].removed = true;
    writeJSON(P.ledger, ledger); buildState();
    console.log(`✔ removed level ${n} ("${lvl.skill}" by @${lvl.handle}); later levels moved down by one`);
    break;
  }
  case "stats": {
    const st = existsSync(P.state) ? readJSON(P.state) : buildState();
    console.log(`Day ${st.day} · level ${st.totals.levels} · ${st.bee.rank} bee · ${st.totals.players} players · ${st.totals.uniqueSkills} unique skills`);
    for (const t of st.topTeachers) console.log(`  @${t.handle.padEnd(20)} ${t.levels} level(s)`);
    console.log("Latest:", st.levels.slice(-5).map((l) => `${l.n}. ${l.skill} (@${l.handle})`).join(" · "));
    break;
  }
  case "seed-demo": {
    const n = seedDemo(); const st = buildState();
    console.log(`✔ demo ledger with ${n} comments → level ${st.totals.levels}`);
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
