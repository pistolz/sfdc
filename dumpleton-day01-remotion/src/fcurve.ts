// Port of Blender's F-curve evaluation for BEZIER keys with AUTO_CLAMPED handles
// (BKE_nurb_handle_calc_ex with is_fcurve=true + first/last-key flattening, constant extrapolation).
// This is what keyframe_insert() produces by default in Blender 4.x, so camera moves, the Mayor's path,
// pop animations and light ramps follow the exact same curves as in scene.py.

type Key = { x: number; y: number; hlx: number; hly: number; hrx: number; hry: number };

export type Interp = "BEZIER" | "LINEAR" | "QUAD_IN";

export class FCurve {
  keys: Key[];
  interp: Interp;
  constructor(points: [number, number][], interp: Interp = "BEZIER") {
    // sort + dedupe by x (later insert at same x replaces, like Blender)
    const map = new Map<number, number>();
    for (const [x, y] of points) map.set(Math.round(x * 1e6) / 1e6, y);
    const pts = [...map.entries()].sort((a, b) => a[0] - b[0]);
    this.interp = interp;
    this.keys = pts.map(([x, y]) => ({ x, y, hlx: x, hly: y, hrx: x, hry: y }));
    this.calcHandles();
  }

  private calcHandles() {
    const k = this.keys;
    const n = k.length;
    for (let i = 0; i < n; i++) {
      const b = k[i];
      const prev = i > 0 ? k[i - 1] : null;
      const next = i < n - 1 ? k[i + 1] : null;
      let p1x: number, p1y: number, p3x: number, p3y: number;
      if (prev) {
        p1x = prev.x;
        p1y = prev.y;
      } else if (next) {
        p1x = 2 * b.x - next.x;
        p1y = 2 * b.y - next.y;
      } else {
        p1x = b.x - 1;
        p1y = b.y;
      }
      if (next) {
        p3x = next.x;
        p3y = next.y;
      } else {
        p3x = 2 * b.x - p1x;
        p3y = 2 * b.y - p1y;
      }
      const dax = b.x - p1x;
      const day = b.y - p1y;
      const dbx = p3x - b.x;
      const dby = p3y - b.y;
      let lenA = dax === 0 ? 1 : dax;
      let lenB = dbx === 0 ? 1 : dbx;
      const tvx = dbx / lenB + dax / lenA;
      const tvy = dby / lenB + day / lenA;
      let len = tvx * 2.5614;
      if (len !== 0) {
        if (lenA > 5 * lenB) lenA = 5 * lenB;
        if (lenB > 5 * lenA) lenB = 5 * lenA;
        let leftViolate = false;
        let rightViolate = false;
        const la = lenA / len;
        b.hlx = b.x - tvx * la;
        b.hly = b.y - tvy * la;
        const lb = lenB / len;
        b.hrx = b.x + tvx * lb;
        b.hry = b.y + tvy * lb;
        if (prev && next) {
          const yd1 = prev.y - b.y;
          const yd2 = next.y - b.y;
          if ((yd1 <= 0 && yd2 <= 0) || (yd1 >= 0 && yd2 >= 0)) {
            b.hly = b.y;
            b.hry = b.y;
            leftViolate = rightViolate = false; // both flat already
          } else {
            if (yd1 <= 0) {
              if (prev.y > b.hly) {
                b.hly = prev.y;
                leftViolate = true;
              }
            } else if (prev.y < b.hly) {
              b.hly = prev.y;
              leftViolate = true;
            }
            if (yd2 <= 0) {
              if (next.y > b.hry) {
                b.hry = next.y;
                rightViolate = true;
              }
            } else if (next.y < b.hry) {
              b.hry = next.y;
              rightViolate = true;
            }
          }
          if (leftViolate || rightViolate) {
            const h1x = b.hlx - b.x;
            const h2x = b.x - b.hrx;
            if (leftViolate) b.hry = b.y + ((b.y - b.hly) / h1x) * h2x;
            else b.hly = b.y + ((b.y - b.hry) / h2x) * h1x;
          }
        }
      }
      // first/last key: flat (constant extrapolation)
      if (i === 0 || i === n - 1) {
        b.hly = b.y;
        b.hry = b.y;
      }
    }
  }

  evaluate(x: number): number {
    const k = this.keys;
    if (k.length === 0) return 0;
    if (x <= k[0].x) return k[0].y;
    if (x >= k[k.length - 1].x) return k[k.length - 1].y;
    // binary search segment
    let lo = 0;
    let hi = k.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (k[mid].x <= x) lo = mid;
      else hi = mid;
    }
    const a = k[lo];
    const b = k[hi];
    if (this.interp === "LINEAR") return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    if (this.interp === "QUAD_IN") {
      const u = (x - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * u * u;
    }
    // correct_bezpart: keep handles inside the segment
    let h1x = a.hrx;
    let h1y = a.hry;
    let h2x = b.hlx;
    let h2y = b.hly;
    const len = b.x - a.x;
    const l1 = h1x - a.x;
    const l2 = b.x - h2x;
    if (l1 + l2 > len && l1 + l2 > 0) {
      const f = len / (l1 + l2);
      h1x = a.x + l1 * f;
      h1y = a.y + (h1y - a.y) * f;
      h2x = b.x - l2 * f;
      h2y = b.y + (h2y - b.y) * f;
    }
    // solve bezier x(t) = x (monotone) by bisection
    let t0 = 0;
    let t1 = 1;
    let t = (x - a.x) / len;
    for (let it = 0; it < 40; it++) {
      const mt = 1 - t;
      const bx = mt * mt * mt * a.x + 3 * mt * mt * t * h1x + 3 * mt * t * t * h2x + t * t * t * b.x;
      if (Math.abs(bx - x) < 1e-7) break;
      if (bx < x) t0 = t;
      else t1 = t;
      t = (t0 + t1) / 2;
    }
    const mt = 1 - t;
    return mt * mt * mt * a.y + 3 * mt * mt * t * h1y + 3 * mt * t * t * h2y + t * t * t * b.y;
  }
}

/** Multi-channel convenience: keys of [t, [v0, v1, ...]] */
export class FCurveN {
  curves: FCurve[];
  constructor(keys: [number, number[]][], interp: Interp = "BEZIER") {
    const n = keys[0][1].length;
    this.curves = [];
    for (let c = 0; c < n; c++) this.curves.push(new FCurve(keys.map(([t, v]) => [t, v[c]]), interp));
  }
  evaluate(t: number) {
    return this.curves.map((c) => c.evaluate(t));
  }
}

// POP = [(-0.01, 0.0), (0.0, 0.001), (0.16, 1.18), (0.26, 0.93), (0.36, 1.0)]  (+ scale 0 at frame 1)
const POP_CURVE = new FCurve([
  [-1000, 0],
  [-0.01, 0],
  [0, 0.001],
  [0.16, 1.18],
  [0.26, 0.93],
  [0.36, 1.0],
]);
/** scale of a piece that pops at time t0 (Blender pop()) */
export const popScale = (t: number, t0: number) => {
  if (t < t0 - 0.01) return 0;
  if (t > t0 + 0.36) return 1;
  return POP_CURVE.evaluate(t - t0);
};
const UNPOP_CACHE = new Map<number, FCurve>();
/** unpop(): 1 -> 1.1 (0.08 s) -> 0 (d) — appended after a pop */
export const unpopScale = (t: number, t1: number, d = 0.25) => {
  if (t <= t1) return 1;
  if (t >= t1 + d) return 0;
  let c = UNPOP_CACHE.get(d);
  if (!c) {
    c = new FCurve([
      [0, 1],
      [0.08, 1.1],
      [d, 0],
    ]);
    UNPOP_CACHE.set(d, c);
  }
  return c.evaluate(t - t1);
};
