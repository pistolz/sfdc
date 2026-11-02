// All timing is derived from audio/timeline_words.json (seconds). frame = t * FPS.
import TL from "./data/timeline_words.json";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const TOTAL: number = TL.total; // 85.6 s
export const DURATION_FRAMES = Math.round(TOTAL * FPS); // 2568

type Marks = Record<
  | "hook"
  | "intro"
  | "premise"
  | "threat"
  | "giant"
  | "rule1"
  | "build"
  | "sunset"
  | "eyes"
  | "rule2"
  | "roof"
  | "steps"
  | "morning"
  | "cta"
  | "end",
  [number, number]
>;
export const M = TL.marks as unknown as Marks;
export type Word = [string, number, number];
export const WORDS = TL.words as unknown as Word[];

/** First word (lower-case, punctuation stripped) starting at/after `after` seconds. Same as wt() in scene.py/overlay.py. */
export const wt = (word: string, after = 0): number => {
  for (const [w, a] of WORDS) {
    if (w.toLowerCase().replace(/[.,?!]/g, "") === word && a >= after - 1e-3) return a;
  }
  throw new Error(`word not found: ${word} after ${after}`);
};

// Build beats (scene.py T{})
export const T = {
  tree: wt("tree", M.build[0]),
  log: wt("log", M.build[0]),
  floor: wt("floor", M.build[0]),
  walls: wt("walls", M.build[0]),
  door: wt("door", M.build[0]),
  fire: wt("steamer", M.build[0]),
  beam: wt("last", M.roof[0]),
  plank: wt("petal", M.roof[0]),
  roof: wt("roof", M.roof[0]),
};

export const T_HOUSE = wt("house", M.premise[0]);
export const T_CTA = wt("every", M.cta[0]);
export const T_EYES = wt("hungry", M.eyes[0]);
export const T_MAYOR = wt("mayor", M.intro[0]);
export const T_RULE1 = wt("rule", M.rule1[0]);
export const T_RULE2 = wt("rule", M.rule2[0]);
export const T_100 = wt("100", M.giant[0]);
export const T_DAY = wt("day", M.intro[0]);
export const T_MOST = wt("most", M.cta[0]);
export const T_ONE_CTA = wt("one", M.cta[0]);

// Giant step beats (fc.txt / overlay.py)
export const STEPS: number[] = [
  ...[0, 1, 2].map((k) => M.threat[0] + 0.9 + k * 1.1),
  ...[0, 1, 2].map((k) => M.steps[0] + 0.2 + k * 1.2),
];
// Shake windows (scene.py fl_shake)
export const SHAKE_WINDOWS: [number, number][] = [
  [M.threat[0] + 0.8, M.threat[0] + 5.0],
  [M.steps[0] - 0.2, M.steps[0] + 4.8],
];

// ---------- easing helpers (identical to overlay.py)
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const eob = (x: number) => {
  x = clamp(x);
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
export const eio = (x: number) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
export const tween = (t: number, keys: [number, number][]) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, va] = keys[i];
    const [b, vb] = keys[i + 1];
    if (t <= b) return va + (vb - va) * eio(b > a ? (t - a) / (b - a) : 1);
  }
  return keys[keys.length - 1][1];
};
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Deterministic PRNG (mulberry32) so every frame/render is identical
export const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** smooth 1D value noise in [-1,1] (for shakes/flicker – deterministic). */
export const noise1 = (x: number, seed = 0) => {
  const h = (n: number) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
};
/** fractal noise ~ Blender F-curve NOISE modifier (approx). */
export const fnoise = (x: number, seed = 0) =>
  0.6 * noise1(x, seed) + 0.3 * noise1(x * 2.03, seed + 7) + 0.1 * noise1(x * 4.1, seed + 13);

/** Blender F-curve noise modifier restricted to a window with blend in/out (scene.py shake()). */
export const windowNoise = (t: number, windows: [number, number][], strength: number, scale: number, seed: number) => {
  let v = 0;
  windows.forEach(([a, b], wi) => {
    if (t < a || t > b) return;
    const bi = (b - a) * 0.3;
    const bo = (b - a) * 0.4;
    let w = 1;
    if (t < a + bi) w = (t - a) / bi;
    if (t > b - bo) w = Math.min(w, (b - t) / bo);
    // Blender noise: frame / scale ; strength is peak-to-peak
    v += w * strength * 0.5 * fnoise((t * FPS) / scale, seed + wi * 17);
  });
  return v;
};
