// Day 02 overlay — same visual language as overlay.py / src/hud/HUD.tsx (Anton + Barlow Condensed, 1080x1920 px).
import React from "react";
import * as THREE from "three";
import { CAM_FOV, cameraMatrix } from "../camera";
import { eio, eob, rng, tween, Word } from "../timeline";
import { f_anton, f_bar, measure, Odometer, rgba, RRect, Tag, Txt, XY } from "../hud/HUD";
import { cameraAt2 } from "./camera02";
import { B, M2, STEPS2, TOTAL2, WORDS2 } from "./timeline02";
import { boatPos, CANNONS, CARLY, CASINO, charPos, HOUSES, impPos, IMPS, LAB, TELESCOPE, TURRET, BAKERY, BRIDGE_Y, SUNNY_POS } from "./Village02";
import { riverX } from "../scene/world";

const W = 1080;
const H = 1920;

// ---------------------------------------------------------------- 3D -> screen (same camera as the render)
const projCam = new THREE.PerspectiveCamera(CAM_FOV, W / H, 0.5, 6000);
projCam.matrixAutoUpdate = false;
const project = (t: number, p: [number, number, number]): XY => {
  projCam.matrixWorld.copy(cameraMatrix(cameraAt2(t)));
  projCam.matrixWorldInverse.copy(projCam.matrixWorld).invert();
  const v = new THREE.Vector3(p[0], p[2], -p[1]);
  const vc = v.clone().applyMatrix4(projCam.matrixWorldInverse);
  if (vc.z > -0.1) return null;
  v.project(projCam);
  return [(v.x * 0.5 + 0.5) * W, (0.5 - v.y * 0.5) * H];
};

// ---------------------------------------------------------------- subtitles (same phrase logic as Day 01)
const RED = new Set(["red", "eyes", "dark", "south", "chili", "imps", "burning", "torches", "gone", "23", "theirs", "counting", "listen", "wait", "them", "fast"]);
const YEL = new Set([
  "river", "boats", "baskets", "272", "steamer", "50", "boat", "one", "two", "three", "welcome", "valley", "dumplings", "cream", "bun", "top", "hat",
  "lizz", "knight", "hired", "vip3r", "white", "shield", "done", "rule", "nobody", "alone", "sea", "sphinx", "11", "casino", "build", "150", "40",
  "north", "wall", "jordan", "lab", "chief", "scientist", "iker's", "turret", "counterpart's", "cannons", "avnish's", "telescope", "sunny", "witch",
  "food", "spells", "soldiers", "up", "roof", "bao", "knights", "push", "morning", "carly's", "stone", "98", "follow", "house", "most", "liked",
  "bakery", "bridge", "decide", "now", "quits",
]);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");
type Phrase = { s: number; e: number; p: Word[] };
const PHRASES: Phrase[] = (() => {
  const out: Word[][] = [];
  let cur: Word[] = [];
  WORDS2.forEach((wd, i) => {
    cur.push(wd);
    const nxt = i + 1 < WORDS2.length ? WORDS2[i + 1] : null;
    const last = wd[0][wd[0].length - 1];
    let brk = ".,?!:".includes(last) || cur.length >= 3 || (nxt !== null && nxt[1] - wd[2] > 0.35) || nxt === null;
    if (cur.length === 2 && nxt && nxt[0].length + cur.reduce((a, x) => a + x[0].length, 0) > 16) brk = true;
    if (brk) {
      out.push(cur);
      cur = [];
    }
  });
  return out.map((p, i) => {
    const s = p[0][1];
    let e = p[p.length - 1][2] + 0.45;
    if (i + 1 < out.length) e = Math.min(e, out[i + 1][0][1]);
    return { s, e, p };
  });
})();
const Subtitles: React.FC<{ t: number }> = ({ t }) => {
  const ph = PHRASES.find((x) => x.s <= t && t < x.e);
  if (!ph) return null;
  const k = eob((t - ph.s) / 0.14);
  const sc = 0.75 + 0.25 * k;
  const words = ph.p.map(([w]) => w.toUpperCase());
  const font = f_anton(Math.floor(118 * sc));
  let lines: string[][];
  if (words.reduce((a, w) => a + w.length, 0) <= 11 || words.length === 1) lines = [words];
  else {
    let best = 1;
    let bestV = Infinity;
    for (let i = 1; i < words.length; i++) {
      const v = Math.max(words.slice(0, i).join(" ").length, words.slice(i).join(" ").length) + (words.slice(i).length === 1 && words[words.length - 1].length < 3 ? 5 : 0);
      if (v < bestV) {
        bestV = v;
        best = i;
      }
    }
    lines = [words.slice(0, best), words.slice(best)];
  }
  const y0 = 1400 - (lines.length - 1) * 70;
  const sw = Math.floor(11 * sc);
  const twist = t > B.wait2;
  return (
    <g>
      {lines.map((ln, li) => {
        const widths = ln.map((w) => measure(w + " ", font));
        const tot = widths.reduce((a, b) => a + b, 0) - measure(" ", font);
        let x = 540 - tot / 2;
        return ln.map((w, wi) => {
          const key = norm(w);
          const red = RED.has(key) || (twist && key === "two");
          const col = red ? rgba(255, 70, 60) : YEL.has(key) ? rgba(255, 214, 40) : "#fff";
          const el = <Txt key={`${li}-${wi}`} x={x} y={y0 + li * 140} s={w} font={font} fill={col} stroke={sw} anchor="lm" />;
          x += widths[wi];
          return el;
        });
      })}
    </g>
  );
};

// ---------------------------------------------------------------- HUD
const END = TOTAL2;
const CLOCK: [number, number][] = [
  [0, 6 * 60 + 31],
  [B.n272, 7 * 60 + 10],
  [B.buildIt, 10 * 60],
  [B.food, 16 * 60 + 30],
  [B.sunDown + 1, 18 * 60 + 5],
  [B.wait, 20 * 60 + 40],
  [B.torches, 23 * 60 + 50],
  [B.ran, 26 * 60 + 10],
  [B.morning, 29 * 60 + 52],
  [END, 30 * 60 + 40],
];
const clock = (t: number) => {
  const m = ((tween(t, CLOCK) % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  return [`${hh % 12 || 12}:${String(Math.floor(m % 60)).padStart(2, "0")}`, hh < 12 ? "AM" : "PM"];
};
const housesBuilt = (t: number) => HOUSES.filter((h) => t > h.tRoof + 0.2).length;
const housesCount = (t: number) => {
  const built = 1 + (272 * housesBuilt(t)) / HOUSES.length;
  return built - 23 * eio((t - B.n23) / 0.8);
};

const Hud: React.FC<{ t: number }> = ({ t }) => {
  const x0 = 60;
  const F_HUDS = f_bar(40);
  const F_HUDB = f_bar(96);
  const F_HUDM = f_bar(34, "Bold");
  const F_SM = f_bar(30, "Bold");
  const [c, ap] = clock(t);
  const cw = measure(c, F_HUDB);
  const els: React.ReactNode[] = [];
  els.push(<ellipse key="dot" cx={x0 + 11} cy={169} rx={11} ry={11} fill={rgba(240, 50, 50)} />);
  els.push(<Txt key="day" x={x0 + 36} y={169} s="DAY 2" font={F_HUDS} fill="#fff" stroke={5} anchor="lm" />);
  els.push(<Txt key="clk" x={x0} y={250} s={c} font={F_HUDB} fill="#fff" stroke={7} anchor="lm" />);
  els.push(<Txt key="ap" x={x0 + cw + 12} y={272} s={ap} font={F_HUDM} fill="#fff" stroke={5} anchor="lm" />);
  els.push(<Txt key="vod" x={x0} y={325} s="VALLEY OF DUMPLINGS" font={F_HUDM} fill="#fff" stroke={5} anchor="lm" />);
  let yy = 372;
  for (const [tr, label, num] of [
    [-1, "NEVER STOP BUILDING", "#1"],
    [-1, "KEEP THE STEAMER FIRE BURNING", "#2"],
    [B.rule3 + 2.6, "NOBODY WALKS ALONE", "#3"],
  ] as [number, string, string][]) {
    if (t > tr) {
      const k = tr < 0 ? 1 : eob((t - tr) / 0.3);
      const w = measure(label, F_SM);
      const xx = x0 - Math.floor((1 - k) * 300);
      els.push(
        <g key={`pill${num}`}>
          <RRect box={[xx, yy - 22, xx + 110 + w + 24, yy + 22]} r={22} fill={rgba(20, 20, 30, 200)} />
          <RRect box={[xx, yy - 22, xx + 100, yy + 22]} r={22} fill={rgba(230, 60, 60)} />
          <Txt x={xx + 50} y={yy} s={`RULE ${num}`} font={F_SM} fill="#fff" />
          <Txt x={xx + 112} y={yy} s={label} font={F_SM} fill="#fff" anchor="lm" />
        </g>,
      );
      yy += 56;
    }
  }
  // right counters: dumplings 1 -> 273, houses 1 -> 273 -> 250
  const xr = W - 60;
  const dumplings = tween(t, [
    [B.n272, 1],
    [B.n272 + 3.2, 273],
  ]);
  const hv = housesCount(t);
  const dw = measure(String(Math.floor(dumplings)), F_HUDS);
  els.push(<Odometer key="odo1" id="d2odo1" x={xr} y={170} val={dumplings} font={F_HUDS} color="#fff" h={48} stroke={5} />);
  const ix = xr - 52 - dw;
  els.push(
    <g key="dicon">
      <ellipse cx={ix} cy={171} rx={18.5} ry={15.5} fill={rgba(255, 226, 170)} stroke="#000" strokeWidth={3} />
      <ellipse cx={ix - 5.5} cy={169} rx={2.5} ry={3} fill="#000" />
      <ellipse cx={ix + 5.5} cy={169} rx={2.5} ry={3} fill="#000" />
    </g>,
  );
  const hw = measure(String(Math.floor(hv)), F_HUDS);
  const hxr = ix - 50;
  els.push(<Odometer key="odo2" id="d2odo2" x={hxr + 10} y={170} val={hv} font={F_HUDS} color={t > B.n23 && t < B.n23 + 2.5 ? rgba(255, 80, 70) : "#fff"} h={48} stroke={5} />);
  const hx = hxr - hw - 30;
  els.push(
    <g key="hicon">
      <polygon points={`${hx - 20},170 ${hx},150 ${hx + 20},170`} fill={rgba(255, 140, 90)} stroke="#000" strokeWidth={1} />
      <rect x={hx - 15 + 1.5} y={171.5} width={27} height={17} fill={rgba(255, 190, 120)} stroke="#000" strokeWidth={3} />
    </g>,
  );
  const wood = tween(t, [
    [B.buildIt, 2],
    [B.n150 + 0.6, 320],
    [B.n40 + 0.6, 130],
    [B.food, 130],
    [B.done2, 6],
  ]);
  els.push(<Txt key="woodl" x={W - 60} y={238} s="WOOD" font={F_SM} fill={rgba(255, 190, 90)} stroke={5} anchor="rm" />);
  els.push(<Odometer key="wood" id="d2wood" x={W - 50} y={292} val={wood} font={f_bar(64)} color="#fff" h={66} stroke={6} />);
  // HUNGRY GIANT panel (top-right, 099 -> 098 at "98 days left"; x2 at the twist)
  const days = tween(t, [
    [B.n98, 99],
    [B.n98 + 0.8, 98],
  ]);
  const two = t > B.two2 - 0.05;
  const kTwo = two ? eob((t - B.two2) / 0.35) : 0;
  const pulse = t > B.wait2 ? 1 + 0.06 * Math.sin(t * 14) : 1;
  const s = 0.95 * pulse;
  const cx = W - 150;
  const cy = 395;
  const pw = Math.floor(220 * s);
  const ph = Math.floor(140 * s);
  els.push(
    <g key="giant">
      <RRect box={[cx - pw / 2, cy - ph / 2, cx + pw / 2, cy + ph / 2]} r={Math.floor(12 * s)} fill={rgba(40, 5, 10, 215)} outline={rgba(255, 60, 60)} width={Math.max(3, Math.floor(4 * s))} />
      <Txt x={cx} y={cy - ph / 2 + Math.floor(18 * s)} s={two ? "HUNGRY GIANTS" : "HUNGRY GIANT"} font={f_bar(Math.floor(22 * s), "Bold")} fill={rgba(255, 90, 90)} />
      <Txt x={cx} y={cy + Math.floor(6 * s)} s={String(Math.round(days)).padStart(3, "0")} font={f_bar(Math.floor(78 * s))} fill={rgba(255, 60, 60)} />
      <Txt x={cx} y={cy + ph / 2 - Math.floor(14 * s)} s="DAYS" font={f_bar(Math.floor(18 * s), "Bold")} fill={rgba(255, 90, 90)} />
      {two ? (
        <g transform={`translate(${cx + pw / 2 - 8},${cy - ph / 2 + 4}) scale(${kTwo})`}>
          <circle r={34} fill={rgba(255, 60, 60)} stroke="#000" strokeWidth={4} />
          <Txt x={0} y={2} s="x2" font={f_anton(40)} fill="#fff" />
        </g>
      ) : null}
    </g>,
  );
  return <g>{els}</g>;
};

// ---------------------------------------------------------------- centre cards
const panelK = (t: number, a: number, b: number, dur = 0.35) => eob((t - a) / dur) * (1 - eio((t - b) / 0.25));
const FollowersCard: React.FC<{ t: number }> = ({ t }) => {
  const a = B.n272 - 0.1;
  const b = B.boat1 - 0.4;
  if (!(a < t && t < b + 0.3)) return null;
  const k = panelK(t, a, b);
  if (k <= 0.01) return null;
  const w = Math.floor(760 * k);
  const h = Math.floor(400 * k);
  const cx = 540;
  const cy = 560;
  const n = Math.floor(tween(t, [
    [B.n272, 0],
    [B.n272 + 1.6, 272],
  ]));
  return (
    <g>
      <RRect box={[cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]} r={Math.floor(28 * k)} fill={rgba(15, 20, 25, 190)} outline={rgba(255, 214, 40)} width={Math.max(2, Math.floor(5 * k))} />
      {k > 0.6 ? (
        <g>
          <Txt x={cx} y={cy - 140} s="NEW FOLLOWERS" font={f_bar(48)} fill="#fff" />
          <Txt x={cx} y={cy - 55} s={`+${n}`} font={f_bar(130)} fill={rgba(255, 214, 40)} />
          <Txt x={cx} y={cy + 45} s={"3 STEAMER BOATS  ·  50 PER BOAT"} font={f_bar(48)} fill="#fff" />
          <RRect box={[cx - 260, cy + 105, cx + 260, cy + 165]} r={30} fill={rgba(70, 170, 90, 230)} />
          <Txt x={cx} y={cy + 135} s="ARRIVING BY STEAMER" font={f_bar(38, "Bold")} fill={rgba(235, 255, 235)} />
        </g>
      ) : null}
    </g>
  );
};
const Banner: React.FC<{ t: number; a: number; dur: number; title: string; label: string; col: [number, number, number]; cy?: number }> = ({ t, a, dur, title, label, col, cy = 700 }) => {
  if (!(a - 0.05 < t && t < a + dur)) return null;
  const k = eob((t - a) / 0.3) * (1 - eio((t - a - dur + 0.3) / 0.3));
  const w = Math.floor(900 * k);
  if (w < 20) return null;
  return (
    <g>
      <RRect box={[540 - w / 2, cy - 90, 540 + w / 2, cy + 90]} r={26} fill={rgba(20, 10, 15, 215)} outline={rgba(...col)} width={6} />
      {k > 0.7 ? (
        <g>
          <Txt x={540} y={cy - 38} s={title} font={f_bar(62)} fill={rgba(...col)} />
          <Txt x={540} y={cy + 35} s={label} font={f_bar(label.length < 22 ? 54 : 44)} fill="#fff" />
        </g>
      ) : null}
    </g>
  );
};
const CommentCard: React.FC<{ t: number; a: number; b: number; user: string; text: string; likes: number; tLikes: number; title?: string }> = ({ t, a, b, user, text, likes, tLikes, title = "MOST LIKED COMMENT" }) => {
  if (!(a < t && t < b + 0.4)) return null;
  const k = eob((t - a) / 0.4) * (1 - eio((t - b) / 0.3));
  if (k <= 0.02) return null;
  const cy = Math.floor(780 + (1 - k) * 500);
  const x0 = 70;
  const x1 = 1010;
  const n = tween(t, [
    [tLikes, 0],
    [tLikes + 0.8, likes],
  ]);
  const hx = x1 - 90;
  const hy = cy - 60;
  const pul = 1 + 0.25 * Math.exp(-Math.pow((t - tLikes - 0.8) * 6, 2));
  const r = Math.floor(22 * pul);
  const fu = f_bar(36, "Bold");
  return (
    <g>
      <RRect box={[x0, cy - 150, x1, cy + 150]} r={34} fill={rgba(255, 255, 255, Math.floor(245 * Math.min(1, k * 1.5)))} />
      <Txt x={540} y={cy - 210} s={title} font={f_anton(64)} fill={rgba(255, 214, 40)} stroke={7} />
      <ellipse cx={x0 + 90} cy={cy - 50} rx={50} ry={50} fill={rgba(120, 190, 255)} />
      <ellipse cx={x0 + 75} cy={cy - 57} rx={5} ry={5} fill="#000" />
      <ellipse cx={x0 + 105} cy={cy - 57} rx={5} ry={5} fill="#000" />
      <Txt x={x0 + 165} y={cy - 85} s={user} font={fu} fill={rgba(20, 20, 20)} anchor="lm" />
      <Txt x={x0 + 165 + measure(user + "  ", fu)} y={cy - 85} s="1d" font={f_bar(32, "Medium")} fill={rgba(140, 140, 140)} anchor="lm" />
      <Txt x={x0 + 165} y={cy - 25} s={text} font={f_bar(46, "SemiBold")} fill={rgba(20, 20, 20)} anchor="lm" />
      <Txt x={x0 + 165} y={cy + 45} s="Reply" font={f_bar(30, "SemiBold")} fill={rgba(140, 140, 140)} anchor="lm" />
      <ellipse cx={hx - r / 2} cy={hy - r / 2} rx={r / 2} ry={r / 2} fill={rgba(255, 48, 64)} />
      <ellipse cx={hx + r / 2} cy={hy - r / 2} rx={r / 2} ry={r / 2} fill={rgba(255, 48, 64)} />
      <polygon points={`${hx - r},${hy - r / 2 + 2} ${hx + r},${hy - r / 2 + 2} ${hx},${hy + r}`} fill={rgba(255, 48, 64)} />
      <Txt x={hx} y={hy + 50} s={String(Math.floor(n))} font={f_bar(34, "Bold")} fill={rgba(90, 90, 90)} />
    </g>
  );
};
const BuildOrders: React.FC<{ t: number }> = ({ t }) => {
  const a = B.n150 - 0.1;
  const b = B.jordan - 0.3;
  if (!(a < t && t < b + 0.3)) return null;
  const k = panelK(t, a, b);
  if (k <= 0.05) return null;
  const cy = 700;
  const k2 = eob((t - B.n40) / 0.35);
  return (
    <g>
      <Txt x={540} y={cy - 120} s="BUILD ORDERS" font={f_anton(Math.floor(84 * k))} fill={rgba(255, 214, 40)} stroke={8} />
      <RRect box={[540 - 330 * k, cy - 40, 540 + 330 * k, cy + 40]} r={40} fill={rgba(200, 40, 60, 235)} outline={rgba(60, 10, 20)} width={4} />
      {k > 0.6 ? <Txt x={540} y={cy} s="CASINO  ·  150 DUMPLINGS" font={f_bar(44)} fill="#fff" /> : null}
      {t > B.n40 ? (
        <g>
          <RRect box={[540 - 330 * k2, cy + 70, 540 + 330 * k2, cy + 150]} r={40} fill={rgba(120, 120, 130, 235)} outline={rgba(30, 30, 40)} width={4} />
          {k2 > 0.6 ? <Txt x={540} y={cy + 110} s="NORTH WALL  ·  40 DUMPLINGS" font={f_bar(44)} fill="#fff" /> : null}
        </g>
      ) : null}
    </g>
  );
};
const Cta: React.FC<{ t: number }> = ({ t }) => {
  const els: React.ReactNode[] = [];
  const a = B.same;
  const b = B.most2 - 0.2;
  if (a < t && t < b + 0.3) {
    const k = panelK(t, a, b);
    if (k > 0.05) {
      const cy = 760;
      els.push(
        <g key="cta">
          <Txt x={540} y={cy - 120} s="SAME RULES AS ALWAYS" font={f_anton(Math.floor(80 * k))} fill={rgba(255, 214, 40)} stroke={8} />
          <RRect box={[540 - 330 * k, cy - 40, 540 + 330 * k, cy + 40]} r={40} fill={rgba(60, 180, 90, 235)} outline={rgba(20, 60, 30)} width={4} />
          {k > 0.6 ? <Txt x={540} y={cy} s="1 FOLLOW = 1 DUMPLING + HOUSE" font={f_bar(44)} fill="#fff" /> : null}
          <RRect box={[540 - 330 * k, cy + 70, 540 + 330 * k, cy + 150]} r={40} fill={rgba(60, 140, 230, 235)} outline={rgba(20, 40, 80)} width={4} />
          {k > 0.6 ? <Txt x={540} y={cy + 110} s="TOP COMMENT = WHAT WE BUILD" font={f_bar(44)} fill="#fff" /> : null}
        </g>,
      );
    }
  }
  // vote card: bakery? bridge? south wall? you decide.
  const va = B.most2 - 0.1;
  const vb = B.day3 - 0.2;
  if (va < t && t < vb + 0.3) {
    const k = panelK(t, va, vb, 0.4);
    if (k > 0.03) {
      const cy = Math.floor(720 + (1 - k) * 400);
      els.push(
        <g key="vote">
          <Txt x={540} y={cy - 250} s="WHAT DO WE BUILD NEXT?" font={f_anton(64)} fill={rgba(255, 214, 40)} stroke={7} />
          <RRect box={[90, cy - 190, 990, cy + 190]} r={34} fill={rgba(15, 20, 25, 205)} outline={rgba(255, 214, 40)} width={5} />
          {(
            [
              [B.bakery, "A BAKERY?", [255, 170, 90]],
              [B.bridge, "A BRIDGE?", [110, 190, 255]],
              [B.southWall, "A SOUTH WALL?", [200, 200, 210]],
            ] as [number, string, [number, number, number]][]
          ).map(([to, label, col], i) => {
            const kk = eob((t - to) / 0.3);
            if (t < to) return null;
            const y = cy - 115 + i * 115;
            return (
              <g key={label}>
                <RRect box={[540 - 380 * kk, y - 44, 540 + 380 * kk, y + 44]} r={44} fill={rgba(...col, 235)} outline={rgba(0, 0, 0, 200)} width={4} />
                {kk > 0.6 ? <Txt x={540} y={y} s={label} font={f_bar(54)} fill="#fff" stroke={4} /> : null}
              </g>
            );
          })}
          {t > B.decide ? (
            <Txt x={540} y={cy + 245} s="YOU DECIDE: COMMENT BELOW" font={f_bar(Math.floor(48 * eob((t - B.decide) / 0.3)))} fill="#fff" stroke={6} />
          ) : null}
        </g>,
      );
    }
  }
  return <g>{els}</g>;
};

// ---------------------------------------------------------------- tracked tags (projected live from the camera)
type TagDef = { a: number; b: number; label: string; col: [number, number, number]; at: (t: number) => [number, number, number]; scale?: number };
const GREEN: [number, number, number] = [70, 220, 120];
const YELLOW: [number, number, number] = [255, 200, 60];
const REDC: [number, number, number] = [255, 70, 60];
const TAGS: TagDef[] = [
  ...[0, 1, 2].map((i) => ({
    a: [B.boat1, B.boat2, B.boat3][i] - 0.2,
    b: B.welcome,
    label: `BOAT ${i + 1} · 50`,
    col: YELLOW,
    at: (t: number) => {
      const p = boatPos(i, t);
      return [p[0], p[1], 3.2] as [number, number, number];
    },
  })),
  { a: B.findMe - 0.3, b: B.lizz - 0.1, label: "MAYOR BAO (ME)", col: YELLOW, scale: 1.3, at: (t) => [...charPos.bao(t), 3.2] as [number, number, number] },
  { a: B.lizz, b: B.rule3, label: "LIZZ · KNIGHT", col: [255, 120, 160], scale: 1.2, at: (t) => [...charPos.lizz(t), 2.6] as [number, number, number] },
  { a: B.vip3r, b: B.rule3, label: "VIP3R · WHITE KNIGHT", col: [235, 235, 245], scale: 1.2, at: (t) => [...charPos.vip3r(t), 2.6] as [number, number, number] },
  { a: B.n150 + 0.4, b: B.n40, label: "CASINO · 150", col: [255, 90, 160], at: () => [CASINO[0], CASINO[1], 6] },
  { a: B.n40 + 0.2, b: B.jordan - 0.3, label: "NORTH WALL · 40", col: [200, 200, 210], at: () => [0, 33, 3.5] },
  { a: B.scientist - 0.6, b: B.iker - 0.2, label: "JORDAN'S LAB · CHIEF SCIENTIST", col: GREEN, at: () => [LAB[0], LAB[1], 5.5] },
  { a: B.iker, b: B.avnish - 0.2, label: "IKER'S TURRET", col: [255, 120, 90], at: () => [TURRET[0], TURRET[1], 9] },
  { a: B.cannons, b: B.avnish - 0.2, label: "COUNTERPART'S CANNONS", col: [200, 200, 210], at: () => [(CANNONS[0][0] + CANNONS[1][0]) / 2, CANNONS[0][1], 5] },
  { a: B.avnish, b: B.sunny - 0.2, label: "AVNISH'S TELESCOPE", col: [255, 200, 90], at: () => [TELESCOPE[0], TELESCOPE[1], 9] },
  { a: B.sunny + 0.2, b: B.food, label: "SUNNY · WITCH", col: [190, 140, 255], scale: 1.2, at: () => [SUNNY_POS[0], SUNNY_POS[1], 3.2] },
  { a: B.casinoUp + 0.2, b: B.lastRoof - 0.2, label: "CASINO · OPEN", col: [255, 90, 160], at: () => [CASINO[0], CASINO[1], 9.5] },
  {
    a: B.chili + 0.2,
    b: B.north - 0.2,
    label: "CHILI IMPS",
    col: REDC,
    scale: 1.3,
    at: (t) => {
      const p = IMPS.map((m) => impPos(m, t));
      return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length, 3];
    },
  },
  { a: B.north + 0.2, b: B.south2 - 0.3, label: "NORTH WALL", col: [200, 200, 210], at: () => [0, 33, 3.5] },
  { a: B.south2 + 0.3, b: B.torches - 0.3, label: "SOUTH · NO WALL", col: REDC, scale: 1.2, at: () => [0, -30, 2] },
  { a: B.bao + 0.1, b: B.ran, label: "BAO", col: YELLOW, at: (t) => [...charPos.bao(t), 3.4] as [number, number, number] },
  { a: B.lizz + 0.1 > B.bao ? B.lizz : B.bao + 1.2, b: B.ran, label: "LIZZ", col: [255, 120, 160], at: (t) => [...charPos.lizz(t), 2.8] as [number, number, number] },
  { a: B.bao + 1.8, b: B.ran, label: "VIP3R", col: [235, 235, 245], at: (t) => [...charPos.vip3r(t), 2.8] as [number, number, number] },
  { a: B.carly, b: B.same - 0.2, label: "CARLY'S STONE HOUSE", col: GREEN, scale: 1.2, at: () => [CARLY[0], CARLY[1], 4.6] },
  { a: B.bakery + 0.2, b: B.day3, label: "BAKERY?", col: [255, 170, 90], at: () => [BAKERY[0], BAKERY[1], 5] },
  { a: B.bridge + 0.2, b: B.day3, label: "BRIDGE?", col: [110, 190, 255], at: () => [riverX(BRIDGE_Y), BRIDGE_Y, 3] },
  { a: B.southWall + 0.2, b: B.day3, label: "SOUTH WALL?", col: [200, 200, 210], at: () => [0, -33, 3.5] },
];
const Tags: React.FC<{ t: number }> = ({ t }) => {
  const els: React.ReactNode[] = [];
  TAGS.forEach((d, i) => {
    if (t > d.a && t < d.b) els.push(<Tag key={i} xy={project(t, d.at(t))} label={d.label} col={d.col} alpha={eio((t - d.a) / 0.2) * (1 - eio((t - d.b + 0.2) / 0.2))} scale={d.scale ?? 1} />);
  });
  // POPULATION sign (Day 01 sign at -7,-11)
  const sp = project(t, [-7, -11.4, 1.7]);
  if (sp && sp[0] > 0 && sp[0] < W && sp[1] > 300 && sp[1] < H - 200 && t < B.wait) {
    const pop = Math.floor(tween(t, [
      [B.welcome, 1],
      [B.welcome + 6, 273],
    ]));
    els.push(<Txt key="sign" x={sp[0]} y={sp[1]} s={`POPULATION: ${pop}`} font={f_bar(30, "Bold")} fill={rgba(255, 245, 220)} stroke={4} sfill={rgba(90, 50, 20)} />);
  }
  // floating text
  for (const [t0, label, col, at] of [
    [B.lastRoof + 0.3, "+1 HOUSE", [140, 255, 140], () => [HOUSES[HOUSES.length - 1].x, HOUSES[HOUSES.length - 1].y, 4]],
    [B.n23, "-23 HOUSES", [255, 90, 80], () => [0, -24, 4]],
    [B.casinoUp + 0.1, "CASINO UP!", [255, 214, 40], () => [CASINO[0], CASINO[1], 10]],
    [B.wallUp + 0.1, "WALL UP!", [255, 214, 40], () => [0, 33, 5]],
  ] as [number, string, [number, number, number], () => [number, number, number]][]) {
    if (t0 < t && t < t0 + 1.4) {
      const p = project(t, at());
      if (p) {
        const k = (t - t0) / 1.4;
        const al = 1 - eio((k - 0.6) / 0.4);
        els.push(<Txt key={label} x={p[0]} y={p[1] - 60 - k * 120} s={label} font={f_anton(70)} fill={rgba(...col, 255 * al)} stroke={7} sfill={rgba(0, 0, 0, 255 * al)} />);
      }
    }
  }
  return <g>{els}</g>;
};

// ---------------------------------------------------------------- particles / sparkles / jitter
const PART = (() => {
  const r = rng(23);
  return Array.from({ length: 40 }, () => [r() * W, r() * H, 0.4 + r() * 0.8, r() * 6.28]);
})();
const SPK = (() => {
  const r = rng(12);
  return Array.from({ length: 28 }, () => [r() * W, 300 + r() * 1400, r() * 6.28, 0.7 + r() * 0.8]);
})();
const Particles: React.FC<{ t: number }> = ({ t }) => {
  const night = eio((t - B.wait + 1) / 1.5) * (1 - eio((t - B.morning) / 1.5));
  return (
    <g>
      <g filter="url(#d2blur)">
        {PART.map(([x, y, s, ph], i) => {
          const xx = (((x + t * 30 * s + 20 * Math.sin(t * 1.3 + ph)) % W) + W) % W;
          const yy = (y + t * 45 * s) % H;
          if (night > 0.5) {
            // embers rise during the fire, fireflies otherwise
            const fire = t > B.burning - 1 && t < M2.reflect[0] + 2;
            const al = Math.floor(200 * night * (0.5 + 0.5 * Math.sin(t * 3 + ph)));
            return fire ? (
              <ellipse key={i} cx={xx} cy={H - yy} rx={4} ry={4} fill={rgba(255, 140, 50, al)} />
            ) : (
              <ellipse key={i} cx={xx} cy={yy} rx={5} ry={5} fill={rgba(255, 230, 120, al)} />
            );
          }
          const r = 6 * s;
          return <ellipse key={i} cx={xx} cy={yy} rx={r} ry={r * 0.6} fill={rgba(255, 190, 210, Math.floor(150 * (1 - night)))} />;
        })}
      </g>
      {SPK.map(([x, y, ph, s], i) => {
        const a = Math.pow(Math.max(0, Math.sin(t * 2.2 * s + ph)), 8);
        if (a <= 0.05) return null;
        const r = 14 * s * a;
        const c = rgba(255, 250, 220, 255 * a);
        return (
          <g key={`s${i}`}>
            <line x1={x - r} y1={y} x2={x + r} y2={y} stroke={c} strokeWidth={3} />
            <line x1={x} y1={y - r} x2={x} y2={y + r} stroke={c} strokeWidth={3} />
          </g>
        );
      })}
    </g>
  );
};

export const Overlay02: React.FC<{ frame: number }> = ({ frame }) => {
  const t = frame / 30;
  const j = STEPS2.reduce((acc, ts) => acc + (t > ts ? Math.exp(-(t - ts) * 7) : 0), 0);
  const dx = j > 0.02 ? Math.trunc(14 * j * Math.sin(t * 61)) : 0;
  const dy = j > 0.02 ? Math.trunc(14 * j * Math.sin(t * 47 + 1)) : 0;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <filter id="d2blur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>
      <g transform={`translate(${dx},${dy})`}>
        <Particles t={t} />
        <Tags t={t} />
        <FollowersCard t={t} />
        <Hud t={t} />
        <Banner t={t} a={B.welcome} dur={B.findMe - B.welcome - 0.1} title="WELCOME TO" label="THE VALLEY OF DUMPLINGS" col={[70, 220, 120]} />
        <Banner t={t} a={B.rule3} dur={2.6} title="RULE #3" label="NOBODY WALKS ALONE" col={[255, 70, 60]} />
        <CommentCard t={t} a={B.most - 0.2} b={B.n150 - 0.3} user="sea_sphinx" text="A CASINO! Build it!!" likes={11} tLikes={B.likes - 0.4} />
        <BuildOrders t={t} />
        <Cta t={t} />
        <Subtitles t={t} />
      </g>
    </svg>
  );
};
