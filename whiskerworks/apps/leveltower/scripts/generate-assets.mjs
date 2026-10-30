#!/usr/bin/env node
/**
 * Generates favicons / app icons from the brand mark and the 1200×630 social card (og.png)
 * with a flat illustration of the current tower. Run after `tower.mjs build` so the card shows the live state.
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

const state = JSON.parse(readFileSync(pub("data/state.json"), "utf8"));
const n = state.floors.length;
// flat tower: the top 6 floors, newest on top
const shown = Array.from({ length: Math.min(6, n) }, (_, i) => n - i).reverse();
let isl = "";
const H = 640, step = 100;
shown.forEach((f, i) => {
  const th = state.themes[state.floors[f - 1][0]];
  const y = H - 70 - i * step, cx = 300, w = 150 - (i % 2) * 8;
  isl += `<polygon points="${cx - w},${y + 6} ${cx + w},${y + 6} ${cx + 18},${y + 78} ${cx},${y + 92} ${cx - 22},${y + 74}" fill="${th.rock}"/>`;
  isl += `<rect x="${cx - w}" y="${y - 8}" width="${w * 2}" height="18" rx="8" fill="${th.rim}"/>`;
  isl += `<ellipse cx="${cx}" cy="${y - 10}" rx="${w}" ry="20" fill="${th.top}"/>`;
  for (let k = 0; k < 3; k++) { const px = cx - w * 0.6 + k * w * 0.55; isl += `<polygon points="${px - 14},${y - 8} ${px + 14},${y - 8} ${px},${y - 48}" fill="${th.accent}" opacity=".9"/>`; }
});
const towerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${H}" viewBox="0 0 600 ${H}">
  <rect x="284" y="0" width="32" height="${H}" fill="#f6f3ec"/>${isl}
  <ellipse cx="120" cy="170" rx="80" ry="26" fill="#fff" opacity=".85"/><ellipse cx="500" cy="420" rx="90" ry="28" fill="#fff" opacity=".85"/>
</svg>`;

const font = (pkg, file) => readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), "files", file));
const fonts = [
  { name: "Unbounded", data: font("@fontsource/unbounded", "unbounded-latin-800-normal.woff"), weight: 800, style: "normal" },
  { name: "Unbounded", data: font("@fontsource/unbounded", "unbounded-latin-600-normal.woff"), weight: 600, style: "normal" },
  { name: "Figtree", data: font("@fontsource/figtree", "figtree-latin-600-normal.woff"), weight: 600, style: "normal" },
];
const h = (type, props, ...children) => ({ type, props: { ...props, children: children.length > 1 ? children : children[0] } });
const latest = state.preview.top.slice(0, 3);
const card = h("div", { style: { width: 1200, height: 630, display: "flex", background: "linear-gradient(180deg, #3f86e6 0%, #bcdcff 100%)", color: "#fff", fontFamily: "Figtree" } },
  h("div", { style: { display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 72px", width: 660 } },
    h("div", { style: { fontFamily: "Unbounded", fontWeight: 600, fontSize: 26, letterSpacing: 12 } }, "LEVEL TOWER"),
    h("div", { style: { display: "flex", flexWrap: "wrap", fontFamily: "Unbounded", fontWeight: 800, fontSize: 76, lineHeight: 1.05, marginTop: 18, color: "#fff" } },
      h("span", { style: { marginRight: 22 } }, "1"), h("span", { style: { color: "#ffc93c", marginRight: 22 } }, "LIKE"), h("span", {}, "= 1 FLOOR")),
    h("div", { style: { display: "flex", marginTop: 26, gap: 14 } },
      h("div", { style: { display: "flex", padding: "10px 18px", borderRadius: 14, background: "#13235c", border: "3px solid #fff", fontFamily: "Unbounded", fontWeight: 800, fontSize: 26 } }, `DAY ${state.day}`),
      h("div", { style: { display: "flex", padding: "10px 18px", borderRadius: 14, background: "#13235c", border: "3px solid #ffc93c", color: "#ffc93c", fontFamily: "Unbounded", fontWeight: 800, fontSize: 26 } }, `FLOOR ${n.toLocaleString("en-US")}`)),
    h("div", { style: { display: "flex", flexDirection: "column", marginTop: 26, gap: 8 } },
      ...latest.map((r) => h("div", { style: { display: "flex", alignItems: "center", fontSize: 24, color: "#13235c", background: "#fff6d8", border: "3px solid #ffc93c", borderRadius: 12, padding: "6px 14px", alignSelf: "flex-start" } },
        h("span", { style: { fontFamily: "Unbounded", fontWeight: 800, marginRight: 14 } }, r.label.toUpperCase()), h("span", {}, r.sub)))),
    h("div", { style: { display: "flex", alignItems: "center", marginTop: 34, fontSize: 22, color: "#13235c" } },
      h("img", { src: `data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`, width: 36, height: 36, style: { marginRight: 12 } }),
      "tower.whiskerworks.games")),
  h("img", { src: `data:image/svg+xml;base64,${Buffer.from(towerSvg).toString("base64")}`, width: 600, height: H, style: { marginLeft: -60, marginTop: -10 } }),
);
const svg = await satori(card, { width: 1200, height: 630, fonts });
writeFileSync(pub("og.png"), png(svg, 1200));
console.log("[assets] icons + og.png written");
