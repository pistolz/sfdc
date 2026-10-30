#!/usr/bin/env node
/**
 * Builds the hexagonal world used by the Flag Wars globe.
 *
 * Output: public/geo/world-hex.json
 *   - N:        size of the Fibonacci sphere (the client regenerates lat/lon from point indexes)
 *   - countries: [{ code, name, color, anchor, hexes }]  (anchor = point index of the flag spot)
 *   - points:    delta-encoded point indexes of every land hex (ascending)
 *   - owner:     country index per land hex (-1 = unclaimable land)
 * Also copies the flag-icons 4x3 SVGs of every country present to public/flags/.
 *
 * Usage: node scripts/build-geo.mjs [--if-missing] [--n 60000]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { geoContains, geoBounds, geoArea, geoCentroid, geoDistance } from "d3-geo";
import { feature } from "topojson-client";
import countries from "i18n-iso-countries";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "public/geo/world-hex.json");
const flagsOut = join(root, "public/flags");
const args = process.argv.slice(2);

if (args.includes("--if-missing") && existsSync(outFile)) {
  console.log("[geo] world-hex.json present, skipping (run `npm run geo` to rebuild).");
  process.exit(0);
}

const N = Number(args[args.indexOf("--n") + 1]) || 60000;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// Countries without a numeric ISO id in world-atlas, or that we merge into a parent.
const NAME_OVERRIDES = { Kosovo: "XK", Somaliland: "SO", "N. Cyprus": "CY", "Siachen Glacier": "IN", "Indian Ocean Ter.": "AU" };
const NAME_LABELS = { XK: "Kosovo", US: "United States", GB: "United Kingdom", RU: "Russia", KR: "South Korea", KP: "North Korea",
  IR: "Iran", SY: "Syria", VN: "Vietnam", LA: "Laos", BO: "Bolivia", VE: "Venezuela", TZ: "Tanzania", MD: "Moldova",
  CD: "DR Congo", CG: "Congo", TW: "Taiwan", PS: "Palestine", FM: "Micronesia", BN: "Brunei", CZ: "Czechia", MK: "North Macedonia",
  CI: "Côte d'Ivoire", CV: "Cabo Verde", SZ: "Eswatini", TR: "Türkiye", VA: "Vatican City", FK: "Falkland Islands" };
// Manual flag colour picks where the "most saturated" heuristic reads poorly on a dark globe.
const COLOR_OVERRIDES = { JP: "#ff4f8b", CA: "#ff3b4e", US: "#3c6eff", GB: "#2b5bd7", FR: "#3a63ff", BR: "#22c55e", DE: "#ffc93c",
  IT: "#2fbf5f", ES: "#ffb020", MX: "#1fb36b", IN: "#ff9933", AR: "#6cc4ff", AU: "#4f7dff", KR: "#e8455d", MA: "#e0263a",
  DZ: "#1db954", TN: "#ff3344", NG: "#22b35b", SA: "#1fae5a", PT: "#29a745", NL: "#ff6a1a", BE: "#ffd23f", SE: "#2f7bff",
  NO: "#ff3b4e", PL: "#ff4a5f", UA: "#ffd23f", RU: "#4466ff", CN: "#ff3b3b", EG: "#d4af37", TR: "#ff3b4e", PH: "#3b6cff" };

function fib(i) {
  const y = 1 - (2 * (i + 0.5)) / N;
  const r = Math.sqrt(1 - y * y);
  const t = GOLDEN * i;
  const x = Math.cos(t) * r, z = Math.sin(t) * r;
  return [(Math.atan2(z, x) * 180) / Math.PI, (Math.asin(y) * 180) / Math.PI]; // [lon, lat]
}

function hexToRgb(h) {
  let s = h.replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function satLum([r, g, b]) {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  return { s, l };
}
function flagColor(code) {
  if (COLOR_OVERRIDES[code]) return COLOR_OVERRIDES[code];
  const file = join(dirname(require.resolve("flag-icons/package.json")), "flags/4x3", `${code.toLowerCase()}.svg`);
  if (!existsSync(file)) return "#ff6b8b";
  const svg = readFileSync(file, "utf8");
  const counts = new Map();
  for (const m of svg.matchAll(/fill(?:=|:)\s*"?(#[0-9a-fA-F]{3,6})\b/g)) {
    const c = m[1].toLowerCase();
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  let best = null, bestScore = -1;
  for (const [c, n] of counts) {
    const { s, l } = satLum(hexToRgb(c));
    if (l > 0.92 || l < 0.12 || s < 0.25) continue;
    const score = s * Math.sqrt(n) * (1 - Math.abs(l - 0.5));
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best || "#ff6b8b";
}

const topo = require("world-atlas/countries-50m.json");
const fc = feature(topo, topo.objects.countries);

// Resolve each feature to an ISO alpha-2 code; merge duplicates (e.g. Somaliland into Somalia).
const byCode = new Map();
for (const f of fc.features) {
  const name = f.properties?.name;
  const code = NAME_OVERRIDES[name] || (f.id ? countries.numericToAlpha2(f.id) : undefined);
  if (!code) { console.warn(`[geo] no ISO code for "${name}", treated as unclaimable land`); }
  const key = code || `__${name}`;
  if (!byCode.has(key)) byCode.set(key, { code, features: [] });
  byCode.get(key).features.push(f);
}

const list = [...byCode.values()];
const shapes = []; // { ci, f, bbox }
list.forEach((c, ci) => {
  for (const f of c.features) {
    const [[w, s], [e, n]] = geoBounds(f);
    shapes.push({ ci, f, w, s, e, n, wraps: w > e });
  }
});

console.time("[geo] point-in-polygon");
const points = [], owner = [];
for (let i = 0; i < N; i++) {
  const p = fib(i);
  const [lon, lat] = p;
  for (const sh of shapes) {
    if (lat < sh.s - 0.5 || lat > sh.n + 0.5) continue;
    if (!sh.wraps ? lon < sh.w - 0.5 || lon > sh.e + 0.5 : lon < sh.w - 0.5 && lon > sh.e + 0.5) continue;
    if (geoContains(sh.f, p)) { points.push(i); owner.push(sh.ci); break; }
  }
}
console.timeEnd("[geo] point-in-polygon");

// Nearest Fibonacci index to a lon/lat (inverse of fib, refined locally).
function nearestIndex([lon, lat]) {
  const y = Math.sin((lat * Math.PI) / 180);
  const approx = Math.round(((1 - y) * N) / 2 - 0.5);
  let best = 0, bd = Infinity;
  const win = Math.ceil(Math.sqrt(N)) * 4;
  for (let i = Math.max(0, approx - win); i < Math.min(N, approx + win); i++) {
    const d = geoDistance(fib(i), [lon, lat]);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

const pointSet = new Map(points.map((p, k) => [p, k]));
const out = [];
list.forEach((c, ci) => {
  // anchor: centroid of the largest polygon
  let biggest = null, area = -1;
  for (const f of c.features) {
    const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const coords of polys) {
      const g = { type: "Polygon", coordinates: coords };
      const a = geoArea(g);
      if (a > area) { area = a; biggest = g; }
    }
  }
  const centroid = geoCentroid(biggest);
  let mine = points.filter((_, k) => owner[k] === ci);
  if (mine.length === 0) {
    // tiny country: force one hex at its centroid
    let idx = nearestIndex(centroid);
    if (pointSet.has(idx)) owner[pointSet.get(idx)] = ci; // steal from bigger neighbour
    else { points.push(idx); owner.push(ci); pointSet.set(idx, points.length - 1); }
    mine = [idx];
  }
  // anchor = own hex closest to centroid
  let anchor = mine[0], bd = Infinity;
  for (const p of mine) { const d = geoDistance(fib(p), centroid); if (d < bd) { bd = d; anchor = p; } }
  out[ci] = { code: c.code || null, anchor, hexes: mine.length };
});

// Sort points ascending and delta-encode.
const order = points.map((p, k) => k).sort((a, b) => points[a] - points[b]);
const sortedPts = order.map((k) => points[k]);
const sortedOwner = order.map((k) => owner[k]);

// Drop unresolved shapes: they stay as land (-1) but are not listed as countries.
const finalCountries = [];
const remap = new Map();
out.forEach((c, ci) => {
  if (!c.code) { remap.set(ci, -1); return; }
  remap.set(ci, finalCountries.length);
  const name = NAME_LABELS[c.code] || countries.getName(c.code, "en", { select: "alias" }) || countries.getName(c.code, "en") || c.code;
  finalCountries.push({ code: c.code, name, color: flagColor(c.code), anchor: c.anchor, hexes: c.hexes });
});
const deltas = sortedPts.map((p, k) => (k === 0 ? p : p - sortedPts[k - 1]));

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify({ version: 1, N, countries: finalCountries, points: deltas, owner: sortedOwner.map((o) => remap.get(o)) }));
console.log(`[geo] ${sortedPts.length} land hexes, ${finalCountries.length} countries → ${outFile}`);

mkdirSync(flagsOut, { recursive: true });
const flagDir = join(dirname(require.resolve("flag-icons/package.json")), "flags/4x3");
let copied = 0;
for (const c of finalCountries) {
  const src = join(flagDir, `${c.code.toLowerCase()}.svg`);
  if (existsSync(src)) { copyFileSync(src, join(flagsOut, `${c.code}.svg`)); copied++; }
}
console.log(`[geo] copied ${copied} flags → public/flags/`);
