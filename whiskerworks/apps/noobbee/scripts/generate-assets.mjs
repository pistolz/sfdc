#!/usr/bin/env node
/**
 * Generates favicons / app icons from the brand mark and the 1200×630 social card (og.png)
 * showing the bee, its current level and the latest skills. Run after `nb build`.
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

const state = JSON.parse(readFileSync(pub("data/state.json"), "utf8"));

// 2D bee + honeycomb wall illustration
const hex = (cx, cy, r) => Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 6 + (k * Math.PI) / 3; return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`; }).join(" ");
let comb = "";
for (let j = 0; j < 14; j++) for (let i = 0; i < 4; i++) {
  const r = 26, w = Math.sqrt(3) * r;
  comb += `<polygon points="${hex(i * w + (j % 2 ? w / 2 : 0), j * 1.5 * r, r - 3)}" fill="#f6bf3b" stroke="#ffe07a" stroke-width="2"/>`;
}
const beeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="630" viewBox="0 0 560 630">
  <defs>
    <radialGradient id="h" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#fff2a8"/><stop offset=".55" stop-color="#ffd23f"/><stop offset="1" stop-color="#e9a817"/></radialGradient>
    <radialGradient id="e" cx="40%" cy="35%" r="65%"><stop offset="0" stop-color="#8a4a1c"/><stop offset="1" stop-color="#2e1407"/></radialGradient>
    <clipPath id="wl"><rect x="0" y="0" width="120" height="630"/></clipPath>
    
  </defs>
  <g clip-path="url(#wl)"><rect width="120" height="630" fill="#c98618"/>${comb}</g>
  <g clip-path="url(#wl)" transform="translate(440 0)"><rect width="120" height="630" fill="#c98618"/>${comb}</g>
  <rect x="0" y="0" width="120" height="22" fill="#45b04a"/><rect x="440" y="0" width="120" height="22" fill="#45b04a"/>
  <rect x="0" y="560" width="560" height="70" fill="#f1c46b"/>
  <ellipse cx="280" cy="565" rx="110" ry="16" fill="#000" opacity=".12"/>
  <ellipse cx="185" cy="360" rx="80" ry="48" fill="#d6fbff" opacity=".7" transform="rotate(-25 185 360)"/>
  <ellipse cx="375" cy="360" rx="80" ry="48" fill="#d6fbff" opacity=".7" transform="rotate(25 375 360)"/>
  <ellipse cx="280" cy="470" rx="95" ry="90" fill="url(#h)"/>
  <path d="M195 455 Q280 480 365 455" stroke="#5b3417" stroke-width="13" fill="none"/>
  <path d="M200 500 Q280 525 360 500" stroke="#5b3417" stroke-width="13" fill="none"/>
  <ellipse cx="230" cy="555" rx="34" ry="20" fill="#5b3417"/><ellipse cx="330" cy="555" rx="34" ry="20" fill="#5b3417"/>
  <circle cx="190" cy="455" r="28" fill="url(#h)"/><circle cx="370" cy="455" r="28" fill="url(#h)"/>
  <path d="M245 210 Q235 140 205 110" stroke="#5b3417" stroke-width="8" fill="none"/><circle cx="203" cy="106" r="20" fill="url(#h)"/>
  <path d="M315 210 Q325 140 355 110" stroke="#5b3417" stroke-width="8" fill="none"/><circle cx="357" cy="106" r="20" fill="url(#h)"/>
  <circle cx="280" cy="320" r="135" fill="url(#h)"/>
  <ellipse cx="228" cy="318" rx="31" ry="38" fill="url(#e)"/><ellipse cx="332" cy="318" rx="31" ry="38" fill="url(#e)"/>
  <circle cx="240" cy="302" r="10" fill="#fff"/><circle cx="344" cy="302" r="10" fill="#fff"/>
  <circle cx="220" cy="335" r="5" fill="#fff"/><circle cx="324" cy="335" r="5" fill="#fff"/>
  <path d="M200 268 L250 276" stroke="#5b3417" stroke-width="8" stroke-linecap="round"/><path d="M310 276 L360 268" stroke="#5b3417" stroke-width="8" stroke-linecap="round"/>
  <ellipse cx="190" cy="362" rx="20" ry="12" fill="#ff9a8a" opacity=".6"/><ellipse cx="370" cy="362" rx="20" ry="12" fill="#ff9a8a" opacity=".6"/>
  <path d="M258 365 Q280 395 302 365 Z" fill="#c8283c"/>
</svg>`;

const font = (pkg, file) => readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), "files", file));
const fonts = [
  { name: "Unbounded", data: font("@fontsource/unbounded", "unbounded-latin-800-normal.woff"), weight: 800, style: "normal" },
  { name: "Unbounded", data: font("@fontsource/unbounded", "unbounded-latin-600-normal.woff"), weight: 600, style: "normal" },
  { name: "Figtree", data: font("@fontsource/figtree", "figtree-latin-600-normal.woff"), weight: 600, style: "normal" },
];
const h = (type, props, ...children) => ({ type, props: { ...props, children: children.length > 1 ? children : children[0] } });
const strip = (s) => s.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").trim();
const latest = state.levels.slice(-3).reverse();
const card = h("div", { style: { width: 1200, height: 630, display: "flex", background: "linear-gradient(180deg, #5aa9e6 0%, #a9dcf2 70%, #f3c54e 100%)", color: "#fff", fontFamily: "Figtree" } },
  h("div", { style: { display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 64px", width: 640 } },
    h("div", { style: { fontFamily: "Unbounded", fontWeight: 600, fontSize: 26, letterSpacing: 12, color: "#fff" } }, "NOOB BEE"),
    h("div", { style: { display: "flex", flexWrap: "wrap", fontFamily: "Unbounded", fontWeight: 800, fontSize: 64, lineHeight: 1.05, marginTop: 14, color: "#fff", textShadow: "0 4px 0 #2a1d0c" } },
      h("span", { style: { marginRight: 20 } }, "1"), h("span", { style: { color: "#ffc93c" } }, "COMMENT ="), h("span", {}, "1 LEVEL UP")),
    h("div", { style: { display: "flex", gap: 12, marginTop: 24 } },
      ...[["DAY", state.day, "#fff"], ["LEVEL", state.totals.levels, "#ffc93c"], ["RANK", state.bee.rank.toUpperCase(), "#fff"]].map(([k, v, c]) =>
        h("div", { style: { display: "flex", alignItems: "baseline", gap: 10, padding: "6px 12px", borderRadius: 12, border: `4px solid ${c}`, background: "rgba(46,40,26,0.9)" } },
          h("span", { style: { fontFamily: "Unbounded", fontWeight: 600, fontSize: 13, color: c, letterSpacing: 2 } }, k),
          h("span", { style: { fontFamily: "Unbounded", fontWeight: 800, fontSize: 24, color: c } }, String(v))))),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 24 } },
      ...latest.map((l) => h("div", { style: { display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderRadius: 16, background: "rgba(232,250,220,0.92)", border: "3px solid #fff", color: "#3e5a2c" } },
        h("span", { style: { fontFamily: "Unbounded", fontWeight: 800, fontSize: 14, padding: "3px 8px", borderRadius: 7, background: "#ffc93c", color: "#2a1d0c" } }, `LV ${l.n}`),
        h("span", { style: { fontFamily: "Unbounded", fontWeight: 800, fontSize: 24 } }, strip(l.skill).slice(0, 26)),
        h("span", { style: { fontSize: 18, color: "#4b6b3a" } }, `@${l.handle}`)))),
    h("div", { style: { display: "flex", alignItems: "center", marginTop: 26, fontSize: 22, color: "#2a1d0c" } },
      h("img", { src: `data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`, width: 34, height: 34, style: { marginRight: 12 } }),
      "noobbee.whiskerworks.games")),
  h("img", { src: `data:image/svg+xml;base64,${Buffer.from(beeSvg).toString("base64")}`, width: 540, height: 630 }),
);
const svg = await satori(card, { width: 1200, height: 630, fonts });
writeFileSync(pub("og.png"), png(svg, 1200));
console.log("[assets] icons + og.png written");
