// Port of blender/post/overlay.py (Pillow HUD + subtitles) to SVG. Coordinates are 1080x1920 px, identical to the original.
import React from "react";
import {
  FPS,
  M,
  STEPS,
  T,
  T_CTA,
  T_DAY,
  T_HOUSE,
  T_MAYOR,
  T_MOST,
  T_ONE_CTA,
  T_RULE1,
  T_RULE2,
  T_100,
  TOTAL,
  WORDS,
  eio,
  eob,
  rng,
  tween,
  Word,
} from "../timeline";
import PROJ from "../data/proj.json";

const W = 1080;
const H = 1920;
export type XY = [number, number] | null;
const ANCHORS = (PROJ as unknown as { anchors: Record<string, XY>[] }).anchors;

export const ANTON = "Anton";
export const BARLOW = "Barlow Condensed";
export const f_bar = (size: number, w: "ExtraBold" | "Bold" | "SemiBold" | "Medium" = "ExtraBold") => ({
  fontFamily: BARLOW,
  fontWeight: w === "ExtraBold" ? 800 : w === "Bold" ? 700 : w === "SemiBold" ? 600 : 500,
  fontSize: size,
});
export const f_anton = (size: number) => ({ fontFamily: ANTON, fontWeight: 400, fontSize: size });

// text measurement (Pillow textlength equivalent)
let ctx: CanvasRenderingContext2D | null = null;
export const measure = (s: string, f: { fontFamily: string; fontWeight: number; fontSize: number }) => {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return s.length * f.fontSize * 0.5;
  ctx.font = `${f.fontWeight} ${f.fontSize}px "${f.fontFamily}"`;
  return ctx.measureText(s).width;
};
export const rgba = (r: number, g: number, b: number, a = 255) => `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;

type Anchor = "mm" | "lm" | "rm";
export const Txt: React.FC<{
  x: number;
  y: number;
  s: string;
  font: { fontFamily: string; fontWeight: number; fontSize: number };
  fill: string;
  stroke?: number;
  anchor?: Anchor;
  sfill?: string;
}> = ({ x, y, s, font, fill, stroke = 0, anchor = "mm", sfill = "#000" }) => (
  <text
    x={x}
    y={y}
    {...font}
    fill={fill}
    stroke={stroke > 0 ? sfill : "none"}
    strokeWidth={stroke * 2}
    strokeLinejoin="round"
    paintOrder="stroke"
    textAnchor={anchor === "mm" ? "middle" : anchor === "lm" ? "start" : "end"}
    dominantBaseline="central"
  >
    {s}
  </text>
);
export const RRect: React.FC<{ box: [number, number, number, number]; r: number; fill: string; outline?: string; width?: number }> = ({
  box,
  r,
  fill,
  outline,
  width = 0,
}) => {
  const [x0, y0, x1, y1] = box;
  const w = Math.max(0, x1 - x0);
  const h = Math.max(0, y1 - y0);
  const rr = Math.min(r, w / 2, h / 2);
  // Pillow draws the outline inside the box
  const inset = outline && width ? width / 2 : 0;
  return (
    <rect
      x={x0 + inset}
      y={y0 + inset}
      width={Math.max(0, w - 2 * inset)}
      height={Math.max(0, h - 2 * inset)}
      rx={Math.max(0, rr - inset)}
      fill={fill}
      stroke={outline ?? "none"}
      strokeWidth={width}
    />
  );
};

// ---------------------------------------------------------------- subtitles
const RED = new Set(["hungry", "giant", "eyes", "dark", "footsteps", "shaking", "100"]);
const YEL = [
  "valley", "dumplings", "zero", "mayor", "bao.", "house", "name", "never", "stop", "building.", "sunset,", "steamer", "fire", "roof,",
  "morning,", "99", "alone.", "follow,", "dumpling.", "dumpling", "most", "liked", "next.", "now.", "down,", "ends.", "quiet.", "burning.",
  "thunder,", "one,", "two,", "last", "tree,", "log,", "floor,", "walls,", "door", "coming.", "left.",
];
const strip = (s: string) => s.replace(/^[.,?!]+|[.,?!]+$/g, "");
const YELS = new Set(YEL);
const YEL_STRIPPED = new Set(YEL.map(strip));
type Phrase = { s: number; e: number; p: Word[] };
const PHRASES: Phrase[] = (() => {
  const out: Word[][] = [];
  let cur: Word[] = [];
  WORDS.forEach((wd, i) => {
    cur.push(wd);
    const nxt = i + 1 < WORDS.length ? WORDS[i + 1] : null;
    let brk = ".,?!".includes(wd[0][wd[0].length - 1]) || cur.length >= 3 || (nxt !== null && nxt[1] - wd[2] > 0.35) || nxt === null;
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
      const v =
        Math.max(words.slice(0, i).join(" ").length, words.slice(i).join(" ").length) +
        (words.slice(i).length === 1 && words[words.length - 1].length < 3 ? 5 : 0);
      if (v < bestV) {
        bestV = v;
        best = i;
      }
    }
    lines = [words.slice(0, best), words.slice(best)];
  }
  const y0 = 1400 - (lines.length - 1) * 70;
  const sw = Math.floor(11 * sc);
  return (
    <g>
      {lines.map((ln, li) => {
        const widths = ln.map((w) => measure(w + " ", font));
        const tot = widths.reduce((a, b) => a + b, 0) - measure(" ", font);
        let x = 540 - tot / 2;
        return ln.map((w, wi) => {
          const key = w.toLowerCase();
          const col = RED.has(strip(key)) ? rgba(255, 70, 60) : YELS.has(key) || YEL_STRIPPED.has(strip(key)) ? rgba(255, 214, 40) : "#fff";
          const el = <Txt key={`${li}-${wi}`} x={x} y={y0 + li * 140} s={w} font={font} fill={col} stroke={sw} anchor="lm" />;
          x += widths[wi];
          return el;
        });
      })}
    </g>
  );
};

// ---------------------------------------------------------------- odometer (rolling digits)
export const Odometer: React.FC<{ x: number; y: number; val: number; font: ReturnType<typeof f_bar>; color: string; h: number; stroke: number; id: string }> = ({
  x,
  y,
  val,
  font,
  color,
  h,
  stroke,
  id,
}) => {
  const fl = Math.floor(val + 1e-6);
  const s = `${fl}`;
  const frac = val - fl;
  const n = s.length;
  const dw = Math.floor(measure("0", font)) + 2;
  const tw = dw * n + 20;
  const th = h + 20;
  const px = x - tw; // anchor right
  const py = Math.floor(y - th / 2);
  return (
    <g>
      <clipPath id={id}>
        <rect x={px} y={py} width={tw} height={th} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        {s.split("").map((ch, i) => {
          const d = Number(ch);
          const place = n - 1 - i;
          const rest = place > 0 ? fl % Math.pow(10, place) : 0;
          const f = place === 0 || rest === Math.pow(10, place) - 1 ? frac : 0;
          const cx = px + 10 + i * dw + dw / 2;
          return (
            <g key={i}>
              <Txt x={cx} y={py + 10 + h / 2 - f * h} s={`${d}`} font={font} fill={color} stroke={stroke} />
              {f > 0 ? <Txt x={cx} y={py + 10 + h / 2 + (1 - f) * h} s={`${(d + 1) % 10}`} font={font} fill={color} stroke={stroke} /> : null}
            </g>
          );
        })}
      </g>
    </g>
  );
};

// ---------------------------------------------------------------- HUD
const END = M.end[1] + 0.05;
const CLOCK: [number, number][] = [
  [0, 6 * 60 + 12],
  [3, 6 * 60 + 20],
  [M.build[0], 10 * 60],
  [M.sunset[0] - 0.5, 16 * 60 + 40],
  [M.sunset[1], 18 * 60 + 5],
  [M.eyes[0], 20 * 60 + 30],
  [M.rule2[0], 21 * 60 + 40],
  [M.roof[1], 23 * 60 + 10],
  [M.steps[1], 25 * 60 + 5],
  [M.morning[0], 29 * 60 + 48],
  [END, 30 * 60 + 31],
];
const clock = (t: number) => {
  const m = ((tween(t, CLOCK) % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = Math.floor(m % 60);
  return [`${hh % 12 || 12}:${String(mm).padStart(2, "0")}`, hh < 12 ? "AM" : "PM"];
};

const Hud: React.FC<{ t: number }> = ({ t }) => {
  const a = eio((t - 2.9) / 0.35);
  if (a <= 0) return null;
  const x0 = 60 - Math.floor((1 - a) * 400);
  const F_HUDS = f_bar(40);
  const F_HUDB = f_bar(96);
  const F_HUDM = f_bar(34, "Bold");
  const F_SM = f_bar(30, "Bold");
  const [c, ap] = clock(t);
  const cw = measure(c, F_HUDB);
  const els: React.ReactNode[] = [];
  els.push(<ellipse key="dot" cx={x0 + 11} cy={169} rx={11} ry={11} fill={rgba(240, 50, 50)} />);
  els.push(<Txt key="day" x={x0 + 36} y={169} s="DAY 1" font={F_HUDS} fill="#fff" stroke={5} anchor="lm" />);
  els.push(<Txt key="clk" x={x0} y={250} s={c} font={F_HUDB} fill="#fff" stroke={7} anchor="lm" />);
  els.push(<Txt key="ap" x={x0 + cw + 12} y={272} s={ap} font={F_HUDM} fill="#fff" stroke={5} anchor="lm" />);
  els.push(<Txt key="vod" x={x0} y={325} s="VALLEY OF DUMPLINGS" font={F_HUDM} fill="#fff" stroke={5} anchor="lm" />);
  let yy = 372;
  for (const [tr, label, num] of [
    [T_RULE1 + 2.6, "NEVER STOP BUILDING", "#1"],
    [T_RULE2 + 2.6, "KEEP THE STEAMER FIRE BURNING", "#2"],
  ] as [number, string, string][]) {
    if (t > tr) {
      const k = eob((t - tr) / 0.3);
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
  // right counters
  const xr = W - 60 + Math.floor((1 - a) * 400);
  els.push(<Odometer key="odo1" id="odo1" x={xr} y={170} val={1} font={F_HUDS} color="#fff" h={48} stroke={5} />);
  const ix = xr - 80;
  els.push(
    <g key="dicon">
      <ellipse cx={ix} cy={171} rx={20 - 1.5} ry={17 - 1.5} fill={rgba(255, 226, 170)} stroke="#000" strokeWidth={3} />
      <ellipse cx={ix - 5.5} cy={169} rx={2.5} ry={3} fill="#000" />
      <ellipse cx={ix + 5.5} cy={169} rx={2.5} ry={3} fill="#000" />
    </g>,
  );
  const hx = xr - 130;
  const hv = tween(t, [
    [T.roof + 0.5, 0],
    [T.roof + 1.0, 1],
  ]);
  els.push(<Txt key="hcount" x={hx - 60} y={170} s={`${Math.round(hv)}`} font={F_HUDS} fill="#fff" stroke={5} />);
  els.push(
    <g key="hicon">
      <polygon points={`${hx - 120},170 ${hx - 100},150 ${hx - 80},170`} fill={rgba(255, 140, 90)} stroke="#000" strokeWidth={1} />
      <rect x={hx - 115 + 1.5} y={170 + 1.5} width={30 - 3} height={20 - 3} fill={rgba(255, 190, 120)} stroke="#000" strokeWidth={3} />
    </g>,
  );
  if (t > T.tree - 0.5) {
    const tt = T.tree;
    const wood = tween(t, [
      [tt + 0.5, 0],
      [tt + 1.4, 24],
      [T.floor, 24],
      [T.floor + 0.6, 17],
      [T.walls + 1.2, 9],
      [M.build[1] + 2, 32],
      [M.build[1] + 5, 14],
      [T.beam, 14],
      [T.roof + 0.6, 2],
    ]);
    els.push(<Txt key="woodl" x={W - 60} y={238} s="WOOD" font={F_SM} fill={rgba(255, 190, 90)} stroke={5} anchor="rm" />);
    els.push(<Odometer key="wood" id="woododo" x={W - 50} y={292} val={wood} font={f_bar(64)} color="#fff" h={66} stroke={6} />);
  }
  // HUNGRY GIANT countdown panel
  const tg = T_100;
  if (t > tg - 0.05) {
    const kBig = eob((t - tg) / 0.35);
    const kSmall = eio((t - (M.giant[1] + 0.9)) / 0.5);
    const days = tween(t, [
      [M.morning[0] + 2.4, 100],
      [M.morning[0] + 3.2, 99],
    ]);
    const cx = 540 + (W - 150 - 540) * kSmall;
    const cy = 820 + (395 - 820) * kSmall;
    let s = 1.9 * (1 - kSmall) + 0.95 * kSmall;
    if (kSmall <= 0) s *= 0.6 + 0.4 * kBig;
    const pw = Math.floor(220 * s);
    const ph = Math.floor(140 * s);
    const dv = Math.round(days);
    els.push(
      <g key="giant">
        <RRect box={[cx - pw / 2, cy - ph / 2, cx + pw / 2, cy + ph / 2]} r={Math.floor(12 * s)} fill={rgba(40, 5, 10, 215)} outline={rgba(255, 60, 60)} width={Math.max(3, Math.floor(4 * s))} />
        <Txt x={cx} y={cy - ph / 2 + Math.floor(18 * s)} s="HUNGRY GIANT" font={f_bar(Math.max(12, Math.floor(22 * s)), "Bold")} fill={rgba(255, 90, 90)} />
        <Txt x={cx} y={cy + Math.floor(6 * s)} s={String(dv).padStart(3, "0")} font={f_bar(Math.max(20, Math.floor(78 * s)))} fill={rgba(255, 60, 60)} />
        <Txt x={cx} y={cy + ph / 2 - Math.floor(14 * s)} s="DAYS" font={f_bar(Math.max(10, Math.floor(18 * s)), "Bold")} fill={rgba(255, 90, 90)} />
      </g>,
    );
  }
  return <g>{els}</g>;
};

// ---------------------------------------------------------------- intro stats card
const Stats: React.FC<{ t: number }> = ({ t }) => {
  const tPrem = M.premise[0];
  if (!(T_DAY - 0.1 < t && t < tPrem + 0.2)) return null;
  const k = eob((t - T_DAY + 0.1) / 0.35) * (1 - eio((t - tPrem) / 0.2));
  if (k <= 0.01) return null;
  const w = Math.floor(760 * k);
  const h = Math.floor(400 * k);
  const cx = 540;
  const cy = 560;
  return (
    <g>
      <RRect box={[cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]} r={Math.floor(28 * k)} fill={rgba(15, 20, 25, 190)} outline={rgba(255, 214, 40)} width={Math.max(2, Math.floor(5 * k))} />
      {k > 0.6 ? (
        <g>
          <Txt x={cx} y={cy - 140} s="FOLLOWERS" font={f_bar(48)} fill="#fff" />
          <Txt x={cx} y={cy - 55} s="0" font={f_bar(130)} fill={rgba(255, 214, 40)} />
          <Txt x={cx} y={cy + 45} s={"1 DUMPLING  ·  0 HOUSES"} font={f_bar(52)} fill="#fff" />
          <RRect box={[cx - 260, cy + 105, cx + 260, cy + 165]} r={30} fill={rgba(70, 170, 90, 230)} />
          <Txt x={cx} y={cy + 135} s="TODAY: OUR FIRST HOUSE" font={f_bar(38, "Bold")} fill={rgba(235, 255, 235)} />
        </g>
      ) : null}
    </g>
  );
};

// ---------------------------------------------------------------- big rule banners
const RuleBanner: React.FC<{ t: number }> = ({ t }) => {
  const out: React.ReactNode[] = [];
  for (const [tr, num, label] of [
    [T_RULE1, "#1", "NEVER STOP BUILDING"],
    [T_RULE2, "#2", "KEEP THE STEAMER FIRE BURNING"],
  ] as [number, string, string][]) {
    if (tr - 0.05 < t && t < tr + 2.6) {
      const k = eob((t - tr) / 0.3) * (1 - eio((t - tr - 2.3) / 0.3));
      const cy = 700;
      const w = Math.floor(900 * k);
      if (w < 20) continue;
      out.push(
        <g key={num}>
          <RRect box={[540 - w / 2, cy - 90, 540 + w / 2, cy + 90]} r={26} fill={rgba(20, 10, 15, 215)} outline={rgba(255, 70, 60)} width={6} />
          {k > 0.7 ? (
            <g>
              <Txt x={540} y={cy - 38} s={`RULE ${num}`} font={f_bar(62)} fill={rgba(255, 80, 70)} />
              <Txt x={540} y={cy + 35} s={label} font={f_bar(label.length < 22 ? 54 : 44)} fill="#fff" />
            </g>
          ) : null}
        </g>,
      );
    }
  }
  return <g>{out}</g>;
};

// ---------------------------------------------------------------- tracked tags
export const Tag: React.FC<{ xy: XY | undefined; label: string; col: [number, number, number]; alpha?: number; scale?: number }> = ({ xy, label, col, alpha = 1, scale = 1 }) => {
  if (!xy) return null;
  let [x, y] = xy;
  if (!(-100 < x && x < W + 100 && -100 < y && y < H + 100)) return null;
  const f = f_bar(Math.floor(34 * scale), "Bold");
  const w = measure(label, f) + 30;
  x = Math.min(Math.max(x, 40 + w / 2), W - 40 - w / 2);
  y = Math.min(Math.max(y, 520), H - 260);
  const a = Math.floor(230 * alpha);
  return (
    <g>
      <RRect box={[x - w / 2, y - 60 * scale, x + w / 2, y - 18 * scale]} r={Math.floor(18 * scale)} fill={rgba(15, 20, 25, a)} outline={rgba(...col, a)} width={3} />
      <polygon points={`${x - 10},${y - 19 * scale} ${x + 10},${y - 19 * scale} ${x},${y - 4 * scale}`} fill={rgba(...col, a)} />
      <Txt x={x} y={y - 39 * scale} s={label} font={f} fill={rgba(255, 255, 255, a)} />
    </g>
  );
};
const Tags: React.FC<{ t: number; fr: number }> = ({ t, fr }) => {
  const a = ANCHORS[Math.min(fr, ANCHORS.length - 1)];
  const els: React.ReactNode[] = [];
  if (T_MAYOR - 0.3 < t && t < M.premise[1]) els.push(<Tag key="me" xy={a.me} label="MAYOR BAO (ME)" col={[255, 200, 60]} alpha={eio((t - T_MAYOR + 0.3) / 0.2)} scale={1.3} />);
  if (T_HOUSE < t && t < M.threat[0] - 0.5) els.push(<Tag key="g0" xy={a.ghost0} label="YOUR NAME" col={[70, 220, 120]} alpha={eio((t - T_HOUSE) / 0.2)} scale={1.3} />);
  if (t < M.roof[0] && a.sign && M.premise[0] < t) {
    const [x, y] = a.sign;
    if (0 < x && x < W && 300 < y && y < H - 200)
      els.push(<Txt key="sign" x={x} y={y} s="POPULATION: 0" font={f_bar(30, "Bold")} fill={rgba(255, 245, 220)} stroke={4} sfill={rgba(90, 50, 20)} />);
  }
  if (t > T_CTA) {
    for (let i = 0; i < 14; i++) {
      const ti = T_CTA + 0.15 * i;
      if (t > ti + 0.2) els.push(<Tag key={`cta${i}`} xy={a[`cta${i}`]} label="YOUR NAME" col={[70, 220, 120]} alpha={eio((t - ti - 0.2) / 0.2)} scale={0.9} />);
    }
  }
  for (const [t0, key, label] of [
    [T.tree + 0.5, null, "+24 WOOD"],
    [T.roof + 0.6, "cabin", "+1 HOUSE"],
  ] as [number, string | null, string][]) {
    if (t0 < t && t < t0 + 1.4) {
      const p = key ? a[key] : ([700, 800] as [number, number]);
      if (p) {
        const k = (t - t0) / 1.4;
        const al = 1 - eio((k - 0.6) / 0.4);
        els.push(<Txt key={label} x={p[0]} y={p[1] - 60 - k * 120} s={label} font={f_anton(70)} fill={rgba(140, 255, 140, 255 * al)} stroke={7} sfill={rgba(0, 0, 0, 255 * al)} />);
      }
    }
  }
  return <g>{els}</g>;
};

// ---------------------------------------------------------------- CTA panel + comment card
const Cta: React.FC<{ t: number }> = ({ t }) => {
  const els: React.ReactNode[] = [];
  const t1 = T_ONE_CTA;
  if (t1 < t && t < T_MOST - 0.1) {
    const k = eob((t - t1) / 0.35) * (1 - eio((t - T_MOST + 0.4) / 0.3));
    if (k > 0.05) {
      const cy = 760;
      els.push(
        <g key="cta">
          <Txt x={540} y={cy - 120} s="BUILD THE VILLAGE!" font={f_anton(Math.floor(84 * k))} fill={rgba(255, 214, 40)} stroke={8} />
          <RRect box={[540 - 330 * k, cy - 40, 540 + 330 * k, cy + 40]} r={40} fill={rgba(60, 180, 90, 235)} outline={rgba(20, 60, 30)} width={4} />
          {k > 0.6 ? <Txt x={540} y={cy} s="1 FOLLOW = 1 DUMPLING + HOUSE" font={f_bar(44)} fill="#fff" /> : null}
          <RRect box={[540 - 330 * k, cy + 70, 540 + 330 * k, cy + 150]} r={40} fill={rgba(60, 140, 230, 235)} outline={rgba(20, 40, 80)} width={4} />
          {k > 0.6 ? <Txt x={540} y={cy + 110} s="TOP COMMENT = WHAT WE BUILD" font={f_bar(44)} fill="#fff" /> : null}
        </g>,
      );
    }
  }
  if (T_MOST - 0.2 < t && t < M.end[0] + 0.6) {
    const k = eob((t - T_MOST + 0.2) / 0.4) * (1 - eio((t - M.end[0] - 0.3) / 0.3));
    if (k > 0.02) {
      const cy = Math.floor(700 + (1 - k) * 500);
      const x0 = 70;
      const x1 = 1010;
      const likes = tween(t, [
        [T_MOST + 0.3, 0],
        [T_MOST + 2.6, 1284],
      ]);
      const hx = x1 - 90;
      const hy = cy - 60;
      const pul = 1 + 0.25 * Math.exp(-Math.pow((t - T_MOST - 2.6) * 6, 2));
      const r = Math.floor(22 * pul);
      const fu = f_bar(36, "Bold");
      els.push(
        <g key="card">
          <RRect box={[x0, cy - 150, x1, cy + 150]} r={34} fill={rgba(255, 255, 255, Math.floor(245 * Math.min(1, k * 1.5)))} />
          <Txt x={540} y={cy - 210} s="MOST LIKED COMMENT" font={f_anton(64)} fill={rgba(255, 214, 40)} stroke={7} />
          <ellipse cx={x0 + 90} cy={cy - 50} rx={50} ry={50} fill={rgba(255, 160, 180)} />
          <ellipse cx={x0 + 75} cy={cy - 57} rx={5} ry={5} fill="#000" />
          <ellipse cx={x0 + 105} cy={cy - 57} rx={5} ry={5} fill="#000" />
          <Txt x={x0 + 165} y={cy - 85} s="your_username" font={fu} fill={rgba(20, 20, 20)} anchor="lm" />
          <Txt x={x0 + 165 + measure("your_username  ", fu)} y={cy - 85} s="1d" font={f_bar(32, "Medium")} fill={rgba(140, 140, 140)} anchor="lm" />
          <Txt x={x0 + 165} y={cy - 25} s="Build a dumpling BAKERY next!!" font={f_bar(46, "SemiBold")} fill={rgba(20, 20, 20)} anchor="lm" />
          <Txt x={x0 + 165} y={cy + 45} s="Reply" font={f_bar(30, "SemiBold")} fill={rgba(140, 140, 140)} anchor="lm" />
          <ellipse cx={hx - r / 2} cy={hy - r / 2} rx={r / 2} ry={r / 2} fill={rgba(255, 48, 64)} />
          <ellipse cx={hx + r / 2} cy={hy - r / 2} rx={r / 2} ry={r / 2} fill={rgba(255, 48, 64)} />
          <polygon points={`${hx - r},${hy - r / 2 + 2} ${hx + r},${hy - r / 2 + 2} ${hx},${hy + r}`} fill={rgba(255, 48, 64)} />
          <Txt x={hx} y={hy + 50} s={Math.floor(likes).toLocaleString("en-US")} font={f_bar(34, "Bold")} fill={rgba(90, 90, 90)} />
          <Txt x={x1 - 30} y={cy + 125} s="example comment" font={f_bar(26, "Medium")} fill={rgba(150, 150, 150)} anchor="rm" />
        </g>,
      );
    }
  }
  return <g>{els}</g>;
};

// ---------------------------------------------------------------- particles / debris / sparkles
const PART = (() => {
  const r = rng(3);
  return Array.from({ length: 40 }, () => [r() * W, r() * H, 0.4 + r() * 0.8, r() * 6.28]);
})();
const Particles: React.FC<{ t: number }> = ({ t }) => {
  const night = eio((t - M.eyes[0] + 1) / 1.5) * (1 - eio((t - M.morning[0]) / 1.5));
  return (
    <g filter="url(#blur15)">
      {PART.map(([x, y, s, ph], i) => {
        const xx = (((x + t * 30 * s + 20 * Math.sin(t * 1.3 + ph)) % W) + W) % W;
        const yy = (y + t * 45 * s) % H;
        if (night > 0.5) {
          const al = Math.floor(200 * night * (0.5 + 0.5 * Math.sin(t * 3 + ph)));
          return <ellipse key={i} cx={xx} cy={yy} rx={5} ry={5} fill={rgba(255, 230, 120, al)} />;
        }
        const r = 6 * s;
        return <ellipse key={i} cx={xx} cy={yy} rx={r} ry={r * 0.6} fill={rgba(255, 190, 210, Math.floor(150 * (1 - night)))} />;
      })}
    </g>
  );
};
const DEB = (() => {
  const r = rng(11);
  const cols: [number, number, number][] = [
    [255, 180, 200],
    [240, 230, 210],
    [170, 220, 150],
  ];
  const deb = STEPS.map(() => Array.from({ length: 30 }, () => [r() * W, -200 + r() * 800, 0.6 + r() * 0.8, Math.floor(r() * 3)] as [number, number, number, number]));
  const spk = Array.from({ length: 28 }, () => [r() * W, 300 + r() * 1400, r() * 6.28, 0.7 + r() * 0.8]);
  return { deb, spk, cols };
})();
const Debris: React.FC<{ t: number }> = ({ t }) => {
  const els: React.ReactNode[] = [];
  STEPS.forEach((ts, si) => {
    const dt = t - ts;
    if (dt > 0 && dt < 2.2) {
      const al = Math.floor(230 * (1 - dt / 2.2));
      DEB.deb[si].forEach(([x, y, s, ci], i) => {
        const yy = y + dt * dt * 500 * s + dt * 200;
        const xx = x + 30 * Math.sin(dt * 4 * s + x);
        const r = 7 * s;
        els.push(<ellipse key={`d${si}-${i}`} cx={xx} cy={yy} rx={r} ry={r * 0.6} fill={rgba(...DEB.cols[ci], al)} />);
      });
    }
  });
  DEB.spk.forEach(([x, y, ph, s], i) => {
    const a = Math.pow(Math.max(0, Math.sin(t * 2.2 * s + ph)), 8);
    if (a > 0.05) {
      const r = 14 * s * a;
      const c = rgba(255, 250, 220, 255 * a);
      els.push(
        <g key={`s${i}`}>
          <line x1={x - r} y1={y} x2={x + r} y2={y} stroke={c} strokeWidth={3} />
          <line x1={x} y1={y - r} x2={x} y2={y + r} stroke={c} strokeWidth={3} />
        </g>,
      );
    }
  });
  return <g>{els}</g>;
};

export const Overlay: React.FC<{ frame: number }> = ({ frame }) => {
  const t = frame / FPS;
  const j = STEPS.reduce((acc, ts) => acc + (t > ts ? Math.exp(-(t - ts) * 7) : 0), 0);
  let dx = 0;
  let dy = 0;
  if (j > 0.02) {
    dx = Math.trunc(14 * j * Math.sin(t * 61));
    dy = Math.trunc(14 * j * Math.sin(t * 47 + 1));
  }
  if (t > TOTAL) return null;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <filter id="blur15" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>
      <g transform={`translate(${dx},${dy})`}>
        <Particles t={t} />
        <Debris t={t} />
        <Tags t={t} fr={frame} />
        <Stats t={t} />
        <Hud t={t} />
        <RuleBanner t={t} />
        <Cta t={t} />
        <Subtitles t={t} />
      </g>
    </svg>
  );
};
