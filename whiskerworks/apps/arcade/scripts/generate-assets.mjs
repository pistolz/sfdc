#!/usr/bin/env node
/**
 * Favicons / app icons from the brand mark, and the 1200×630 social card (og.png)
 * showing the live machine count and the newest cabinets. Run after `arc build`.
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
const NEONS = ["#3df5ff", "#ffd23f", "#4dff88", "#ff3df0", "#ff8a3d", "#a07bff"];
const pad = (n) => `#${String(n).padStart(4, "0")}`;
const font = (pkg, file) => readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), "files", file));
const fonts = [
  { name: "Unbounded", data: font("@fontsource/unbounded", "unbounded-latin-800-normal.woff"), weight: 800, style: "normal" },
  { name: "Unbounded", data: font("@fontsource/unbounded", "unbounded-latin-600-normal.woff"), weight: 600, style: "normal" },
  { name: "Figtree", data: font("@fontsource/figtree", "figtree-latin-600-normal.woff"), weight: 600, style: "normal" },
];
const h = (type, props, ...children) => ({ type, props: { ...props, children: children.length > 1 ? children : children[0] } });

// three cabinets: founder in the middle, two newest followers either side
const picks = [state.machines.length > 2 ? state.machines.length - 1 : 1, 0, state.machines.length - 2].filter((i, k, a) => i >= 0 && i < state.machines.length && a.indexOf(i) === k);
const cabinet = (i, big) => {
  const m = state.machines[i], c = NEONS[m[3]], w = big ? 190 : 160;
  const name = i === 0 ? "FOUNDER" : m[0] ? `@${m[0]}` : "PLAYER";
  return h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", width: w, height: big ? 420 : 360, marginTop: big ? 0 : 60, border: `4px solid ${c}`, borderRadius: 10, background: "linear-gradient(180deg,#2a2163,#160f36)", boxShadow: `0 0 40px ${c}` } },
    h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: 70, borderBottom: `4px solid ${c}`, background: "#0b0616" } },
      h("div", { style: { fontSize: 14, color: c, fontFamily: "Unbounded", fontWeight: 600 } }, pad(i + 1)),
      h("div", { style: { fontSize: name.length > 11 ? 15 : 19, color: "#fff", fontFamily: "Unbounded", fontWeight: 800 } }, name)),
    h("div", { style: { display: "flex", marginTop: 26, width: w - 50, height: (w - 50) * 0.8, borderRadius: 8, background: `radial-gradient(circle at 50% 40%, ${c}, #0b0616 75%)` } }),
    h("div", { style: { display: "flex", marginTop: 26, width: w - 30, height: 26, borderRadius: 6, background: "#3a2f6e" } }),
    h("div", { style: { display: "flex", marginTop: 30, width: 50, height: 50, background: "#5b5866", alignItems: "center", justifyContent: "center" } },
      h("div", { style: { display: "flex", width: 8, height: 22, background: "#ffd23f" } })));
};
const card = h("div", { style: { width: 1200, height: 630, display: "flex", background: "radial-gradient(circle at 75% 60%, #2a1250 0%, #0a0614 55%, #050309 100%)", color: "#fff", fontFamily: "Figtree" } },
  h("div", { style: { display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 70px", width: 600 } },
    h("div", { style: { fontFamily: "Unbounded", fontWeight: 600, fontSize: 24, letterSpacing: 10, color: "#3df5ff" } }, "INSERT COIN CLUB"),
    h("div", { style: { display: "flex", flexWrap: "wrap", fontFamily: "Unbounded", fontWeight: 800, fontSize: 60, lineHeight: 1.08, marginTop: 18 } },
      h("span", { style: { marginRight: 20 } }, "1"), h("span", { style: { color: "#ffd23f", marginRight: 20 } }, "FOLLOWER"), h("span", {}, "="), h("span", {}, "1 ARCADE MACHINE")),
    h("div", { style: { fontSize: 30, marginTop: 26, color: "#d9d2ff" } }, `Day ${state.day} · ${state.totals.machines.toLocaleString("en-US")} machines and counting`),
    h("div", { style: { fontSize: 26, marginTop: 12, color: "#b3a8d6" } }, "Search your @handle and find yours."),
    h("div", { style: { display: "flex", alignItems: "center", marginTop: 40, fontSize: 22, color: "#b3a8d6" } },
      h("img", { src: `data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`, width: 36, height: 36, style: { marginRight: 12 } }),
      "arcade.whiskerworks.games")),
  h("div", { style: { display: "flex", alignItems: "flex-start", gap: 24, marginTop: 110 } }, ...picks.map((i) => cabinet(i, i === 0))),
);
const svg = await satori(card, { width: 1200, height: 630, fonts });
writeFileSync(pub("og.png"), png(svg, 1200));
console.log("[assets] icons + og.png written");
