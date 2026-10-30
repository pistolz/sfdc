#!/usr/bin/env node
/**
 * Generates favicons / app icons from the brand mark and the 1200×630 social card (og.png)
 * with a 2D render of the current stadium. Run after `sb build` so the card shows the live state.
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
for (const [file, size] of [["favicon-32.png", 32], ["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) writeFileSync(pub(file), png(mark, size));

/* ---- stadium illustration: tilted bowl, club wedges in their colours */
const state = JSON.parse(readFileSync(pub("data/state.json"), "utf8"));
const t = state.totals;
const cap = Math.max(t.seats, t.nextLevelSeats ?? t.goal, 1);
const fill = Math.min(1, t.seats / cap);
const arranged = [];
state.leaderboard.forEach((c, i) => (i % 2 ? arranged.push(c) : arranged.unshift(c)));
const tiers = Math.max(1, Math.min(5, t.level));
const cx = 330, cy = 340, squash = 0.56;
const tStart = -Math.PI / 2 - Math.PI * fill;
const P = (a, b, ang) => [cx + a * Math.cos(ang), cy + b * Math.sin(ang) * squash];
let shapes = "";
const A0 = 150, B0 = 118, depth = 150 / tiers;
for (let k = 0; k < tiers; k++) {
  const s0 = k * depth + 6, s1 = (k + 1) * depth;
  let cum = 0;
  const segs = [...arranged.map((c) => ({ c, w: c.seats / cap })), { c: null, w: 1 - fill }];
  for (const { c, w } of segs) {
    if (w <= 0) continue;
    const n = Math.max(2, Math.ceil(w * 120));
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(P(A0 + s0, B0 + s0, tStart + (cum + (w * i) / n) * Math.PI * 2));
    for (let i = n; i >= 0; i--) pts.push(P(A0 + s1, B0 + s1, tStart + (cum + (w * i) / n) * Math.PI * 2));
    shapes += `<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="${c ? c.colors[0] : "#dfe3ea"}" stroke="${c ? c.colors[1] : "#c9cfd9"}" stroke-width="1.2"/>`;
    cum += w;
  }
}
const pitch = `<rect x="${cx - 120}" y="${cy - 78 * squash}" width="240" height="${156 * squash}" fill="#62bd4b" stroke="#fff" stroke-width="2.5"/>
  <line x1="${cx}" y1="${cy - 78 * squash}" x2="${cx}" y2="${cy + 78 * squash}" stroke="#fff" stroke-width="2.5"/>
  <ellipse cx="${cx}" cy="${cy}" rx="22" ry="${22 * squash}" fill="none" stroke="#fff" stroke-width="2.5"/>`;
const stadiumSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="660" viewBox="0 0 660 660">
  <ellipse cx="${cx}" cy="${cy + 18}" rx="${A0 + 150 + 20}" ry="${(B0 + 150 + 20) * squash}" fill="#4f9c3a" opacity=".6"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${A0 + 2}" ry="${(B0 + 2) * squash}" fill="#5aad44"/>
  ${pitch}${shapes}
</svg>`;

const font = (pkg, file) => readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), "files", file));
const fonts = [
  { name: "Unbounded", data: font("@fontsource/unbounded", "unbounded-latin-800-normal.woff"), weight: 800, style: "normal" },
  { name: "Unbounded", data: font("@fontsource/unbounded", "unbounded-latin-600-normal.woff"), weight: 600, style: "normal" },
  { name: "Figtree", data: font("@fontsource/figtree", "figtree-latin-600-normal.woff"), weight: 600, style: "normal" },
];
const h = (type, props, ...children) => ({ type, props: { ...props, children: children.length > 1 ? children : children[0] } });
const top = state.leaderboard.slice(0, 3);
const card = h("div", { style: { width: 1200, height: 630, display: "flex", background: "linear-gradient(180deg, #7fc4f0 0%, #cfeaf9 55%, #79c257 56%, #5fae45 100%)", color: "#f3f5ff", fontFamily: "Figtree" } },
  h("div", { style: { display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 56px", width: 600 } },
    h("div", { style: { display: "flex", flexDirection: "column", padding: "34px 36px", borderRadius: 28, background: "rgba(21,26,58,0.94)", border: "3px solid #ffc93c" } },
      h("div", { style: { fontFamily: "Unbounded", fontWeight: 600, fontSize: 22, letterSpacing: 10, color: "#ffffff" } }, "STADIUM BUILDER"),
      h("div", { style: { display: "flex", fontFamily: "Unbounded", fontWeight: 800, fontSize: 44, lineHeight: 1.05, marginTop: 14 } },
        h("span", { style: { marginRight: 14 } }, "1"), h("span", { style: { color: "#ffc93c", marginRight: 14 } }, "CLUB"), h("span", { style: { marginRight: 14 } }, "="), h("span", {}, "1 STAND")),
      h("div", { style: { fontSize: 26, marginTop: 18, color: "#c9cff0" } }, `Day ${state.day} · ${t.seats.toLocaleString("en-US")} / ${t.goal.toLocaleString("en-US")} seats · ${t.clubs} clubs`),
      h("div", { style: { display: "flex", flexDirection: "column", marginTop: 20, gap: 8 } },
        ...top.map((r) => h("div", { style: { display: "flex", alignItems: "center", fontFamily: "Unbounded", fontWeight: 600, fontSize: 22 } },
          h("span", { style: { width: 36, color: ["#ffc93c", "#dfe6ff", "#ff9d5c"][r.rank - 1] } }, String(r.rank)),
          h("div", { style: { width: 34, height: 22, borderRadius: 5, marginRight: 14, background: `linear-gradient(90deg, ${r.colors[0]} 50%, ${r.colors[1]} 50%)`, border: "2px solid #fff" } }),
          h("span", {}, `${r.name.toUpperCase()}`)))),
      h("div", { style: { display: "flex", alignItems: "center", marginTop: 26, fontSize: 20, color: "#a9b0d6" } },
        h("img", { src: `data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`, width: 32, height: 32, style: { marginRight: 12 } }),
        "stadium.whiskerworks.games"))),
  h("img", { src: `data:image/svg+xml;base64,${Buffer.from(stadiumSvg).toString("base64")}`, width: 660, height: 660, style: { marginLeft: -40, marginTop: -30 } }),
);
const svg = await satori(card, { width: 1200, height: 630, fonts });
writeFileSync(pub("og.png"), png(svg, 1200));
console.log("[assets] icons + og.png written");
