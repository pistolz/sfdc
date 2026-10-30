#!/usr/bin/env node
/**
 * Prints the NAMED array used by the Remotion video (tower_series/remotion/src/TowerDay2b.tsx) from data/ledger.json,
 * so the video and the site use the same floors, handles and comments.
 *   node scripts/named-from-ledger.mjs [--json]
 * Site world id → video prop set. Titles and card times (T) are editorial: the defaults below can be edited after.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const L = JSON.parse(readFileSync(join(root, "data/ledger.json"), "utf8"));
const VIDEO = { candy: "candy", "block-world": "blocks", obby: "obby", disco: "disco", "build-battle": "battle", neon: "neon", miugely: "mystery", "pink-stage": "stage", "blue-trees": "bluetrees", "little-chef": "kitchen", "football-god": "football", grassland: "grass", desert: "desert", ice: "ice", lava: "lava", crystal: "crystal" };
const TITLE = { "2": "CANDYLAND", "3": "MINECRAFT WORLD", "6": "ROBLOX", "12": "FORTNITE FLOOR", "36": "BLACKPINK WORLD", "55": "BLUE TREES", "62": "LITTLE CHEF", "67": "FOOTBALL GOD" };
const T = { 2: 2.0, 3: 3.0, 6: 3.95, 9: 4.85, 12: 5.7, 31: 6.7, 34: 7.5, 36: 8.75, 55: 9.8, 62: 10.9, 67: 15.1 };
const display = (s) => s.replace(/Λ/g, "A").replace(/И/g, "N"); // stylised letters → plain, as shown in the video
const top = L.likes.reduce((n, l) => n + l.count, 0);
const named = L.picks.filter((p) => p.floor && p.floor <= top).sort((a, b) => a.floor - b.floor).map((p) => ({
  floor: p.floor, theme: VIDEO[p.theme] ?? "grass", title: TITLE[p.floor] ?? display(p.text).toUpperCase(), handle: p.handle, comment: display(p.text),
  ...(p.theme === "football-god" ? { ball: true } : {}), T: T[p.floor] ?? 0,
}));
if (process.argv.includes("--json")) console.log(JSON.stringify(named, null, 2));
else console.log(`const NAMED: Named[] = [\n${named.map((n) => `  ${JSON.stringify(n).replace(/"(\w+)":/g, "$1: ")},`).join("\n")}\n];`);
