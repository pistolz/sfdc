// Small deterministic helpers shared by the scene, timeline and overlay.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const easeIn = (t) => { t = clamp(t); return t * t * t; };
export function easeOutBack(t, s = 1.70158) {
  t = clamp(t);
  const c3 = s + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
}

/** 0 → 1 between a and b (linear, clamped). */
export const range = (t, a, b) => clamp((t - a) / (b - a));

/**
 * Visibility envelope for an overlay element.
 * Returns {o: opacity, s: scale, y: offsetY} for time t, popping in at `inT`
 * and fading out at `outT` (outT = Infinity keeps it on screen).
 */
export function popEnvelope(t, inT, outT = Infinity, dur = 0.38) {
  if (t < inT) return { o: 0, s: 0.6, y: 0 };
  const a = range(t, inT, inT + dur);
  let o = clamp(a * 2.2);
  let s = 0.6 + 0.4 * easeOutBack(a, 2.2);
  let y = 0;
  if (t > outT) {
    const b = range(t, outT, outT + 0.25);
    o *= 1 - b;
    s *= 1 - 0.15 * b;
    y = -30 * b;
  }
  return { o, s, y };
}

/** Catmull-Rom interpolation through timed keys: keys = [{t, v:[...numbers]}]. */
export function sampleKeys(keys, t) {
  if (t <= keys[0].t) return keys[0].v.slice();
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v.slice();
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
  let u = (t - k1.t) / (k2.t - k1.t);
  const ease = k2.ease || 'inout';
  if (ease === 'inout') u = easeInOut(u);
  else if (ease === 'out') u = easeOut(u);
  else if (ease === 'in') u = easeIn(u);
  else if (ease === 'smooth') u = smooth(u);
  const u2 = u * u, u3 = u2 * u;
  return k1.v.map((p1, j) => {
    const p0 = k0.v[j], p2 = k2.v[j], p3 = k3.v[j];
    // Tension-reduced Catmull-Rom (0.5) keeps the camera from overshooting.
    const m1 = (p2 - p0) * 0.5 * 0.6, m2 = (p3 - p1) * 0.5 * 0.6;
    return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
  });
}

export function formatInt(n) {
  return Math.round(n).toLocaleString('en-US');
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
