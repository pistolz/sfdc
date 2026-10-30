#!/usr/bin/env node
/**
 * Generates favicons / app icons from the brand mark and the 1200×630 social card (og.png)
 * with a 2D render of the current hex globe. Run after `fw build` so the card shows the live state.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = (f) => join(root, "public", f);
const mark = readFileSync(pub("mark.svg"), "utf8");

const png = (svg, width) => new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
for (const [file, size] of [["favicon-32.png", 32], ["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) {
  writeFileSync(pub(file), png(mark, size));
}

/* ---- globe illustration (orthographic projection of the hex world) */
const geo = JSON.parse(readFileSync(pub("geo/world-hex.json"), "utf8"));
const state = JSON.parse(readFileSync(pub("data/state.json"), "utf8"));
const N = geo.N, G = Math.PI * (3 - Math.sqrt(5));
const fib = (i) => { const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), t = G * i; return [Math.cos(t) * r, y, -Math.sin(t) * r]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lat = 28 * Math.PI / 180, lon = -62 * Math.PI / 180;
const d = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)];
const right = norm(cross([0, 1, 0], d)), up = cross(d, right);

const fraction = (level, progress, next) => level <= 0 ? 0 : Math.min(1, 0.07 + 0.93 * Math.pow((level - 1 + Math.min(1, progress / next)) / 5, 0.85));
let p = 0;
const pts = geo.points.map((dp, k) => (p = k === 0 ? dp : p + dp));
const owned = new Map();
geo.countries.forEach((c, ci) => {
  const s = state.countries[c.code];
  if (!s) return;
  const a = fib(c.anchor);
  const mine = pts.map((pt, k) => [k, pt]).filter(([k]) => geo.owner[k] === ci).sort((x, y) => dot(fib(y[1]), a) - dot(fib(x[1]), a));
  const take = Math.max(1, Math.round(mine.length * fraction(s.level, s.progress, s.next)));
  mine.slice(0, take).forEach(([k]) => owned.set(k, s.color));
});

const R = 300, cx = 320, cy = 330, hr = Math.sqrt((4 * Math.PI) / N) * 0.55 * R;
let hexes = "";
pts.forEach((pt, k) => {
  const v = fib(pt);
  const z = dot(v, d);
  if (z < 0.05) return;
  const x = cx + dot(v, right) * R, y = cy - dot(v, up) * R;
  const s = hr * (0.55 + 0.45 * z);
  const c = owned.get(k) || (k % 3 ? "#45bcc6" : "#3aa9b8");
  const hp = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i; return `${(x + Math.cos(a) * s).toFixed(1)},${(y + Math.sin(a) * s).toFixed(1)}`; }).join(" ");
  hexes += `<polygon points="${hp}" fill="${c}"/>`;
});
const globeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="660" viewBox="0 0 640 660">
  <defs>
    <radialGradient id="o" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#2b56c9"/><stop offset="1" stop-color="#0e1f63"/></radialGradient>
    <radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0.86" stop-color="#3fa8ff" stop-opacity="0"/><stop offset="0.93" stop-color="#5fe3ea" stop-opacity=".55"/><stop offset="1" stop-color="#3fa8ff" stop-opacity="0"/></radialGradient>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${R * 1.16}" fill="url(#g)"/>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#o)"/>
  ${hexes}
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#7fe9ff" stroke-opacity=".7" stroke-width="3"/>
</svg>`;

const font = (pkg, file) => readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), "files", file));
const fonts = [
  { name: "Unbounded", data: font("@fontsource/unbounded", "unbounded-latin-800-normal.woff"), weight: 800, style: "normal" },
  { name: "Unbounded", data: font("@fontsource/unbounded", "unbounded-latin-600-normal.woff"), weight: 600, style: "normal" },
  { name: "Figtree", data: font("@fontsource/figtree", "figtree-latin-600-normal.woff"), weight: 600, style: "normal" },
];
const h = (type, props, ...children) => ({ type, props: { ...props, children: children.length > 1 ? children : children[0] } });
const top = state.leaderboard.slice(0, 3);
const card = h("div", { style: { width: 1200, height: 630, display: "flex", background: "radial-gradient(circle at 75% 55%, #1a2a80 0%, #0b1033 45%, #060920 100%)", color: "#f3f5ff", fontFamily: "Figtree" } },
  h("div", { style: { display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 72px", width: 640 } },
    h("div", { style: { fontFamily: "Unbounded", fontWeight: 600, fontSize: 26, letterSpacing: 12, color: "#5fe3ea" } }, "FLAG WARS"),
    h("div", { style: { display: "flex", flexWrap: "wrap", fontFamily: "Unbounded", fontWeight: 800, fontSize: 70, lineHeight: 1.05, marginTop: 18 } },
      h("span", { style: { marginRight: 22 } }, "1"), h("span", { style: { color: "#ffc93c" } }, "COMMENT"), h("span", { style: { marginTop: 4 } }, "= 1 FLAG")),
    h("div", { style: { fontSize: 30, marginTop: 26, color: "#c9cff0" } }, `Day ${state.day} · ${state.totalFlags.toLocaleString("en-US")} flags · ${state.totalCountries} nations`),
    h("div", { style: { display: "flex", flexDirection: "column", marginTop: 26, gap: 8 } },
      ...top.map((r) => h("div", { style: { display: "flex", alignItems: "center", fontFamily: "Unbounded", fontWeight: 600, fontSize: 24 } },
        h("span", { style: { width: 40, color: ["#ffc93c", "#dfe6ff", "#ff9d5c"][r.rank - 1] } }, String(r.rank)),
        h("img", { src: `data:image/svg+xml;base64,${Buffer.from(readFileSync(pub(`flags/${r.code}.svg`))).toString("base64")}`, width: 40, height: 30, style: { marginRight: 14, borderRadius: 4 } }),
        h("span", {}, `${r.name.toUpperCase()}  ·  LV ${r.level}`)))),
    h("div", { style: { display: "flex", alignItems: "center", marginTop: 40, fontSize: 22, color: "#a9b0d6" } },
      h("img", { src: `data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`, width: 36, height: 36, style: { marginRight: 12 } }),
      "flagwars.whiskerworks.games")),
  h("img", { src: `data:image/svg+xml;base64,${Buffer.from(globeSvg).toString("base64")}`, width: 640, height: 660, style: { marginLeft: -40, marginTop: -10 } }),
);
const svg = await satori(card, { width: 1200, height: 630, fonts });
writeFileSync(pub("og.png"), png(svg, 1200));
console.log("[assets] icons + og.png written");
