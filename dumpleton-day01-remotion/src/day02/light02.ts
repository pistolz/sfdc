import * as THREE from "three";
import { FCurve, FCurveN } from "../fcurve";
import type { LightState } from "../scene/Environment";
import { lin } from "../scene/world";
import { B, M2, TOTAL2 } from "./timeline02";

// Day 02 arc: morning (= Day 01 end) -> day -> sunset (food, spells, soldiers) -> night (imps, fire) -> dawn
const D2R = Math.PI / 180;
const SUNK: [number, number, number, number, [number, number, number]][] = [
  [0, 22, 132, 4.4, [1.0, 0.85, 0.62]],
  [5, 38, 150, 5.2, [1.0, 0.86, 0.66]],
  [B.food - 2, 26, 180, 4.8, [1.0, 0.8, 0.58]],
  [B.sunDown + 0.5, 7, 205, 3.5, [1.0, 0.55, 0.3]],
  [B.wait, 1, 215, 0.0, [1.0, 0.4, 0.25]],
  [M2.reflect[1] - 1.5, -2, 120, 0.0, [1, 0.6, 0.4]],
  [B.morning + 0.3, 14, 125, 3.8, [1.0, 0.78, 0.5]],
  [TOTAL2, 22, 132, 4.4, [1.0, 0.85, 0.62]],
];
const sunCurve = new FCurveN(SUNK.map(([t, el, az, en, c]) => [t, [(90 - el) * D2R, az * D2R, en * 0.72, c[0], c[1], c[2]]]));
const tn = B.wait + 0.2;
const tm = B.morning + 0.3;
const moon = new FCurve([
  [0, 0],
  [B.sunDown, 0],
  [tn, 1.3],
  [M2.reflect[1], 1.3],
  [tm, 0.3],
  [TOTAL2, 0],
]);
const world = new FCurveN(
  (
    [
      [0, 0.0, 0.5],
      [5, 0.0, 0.45],
      [B.food, 0.0, 0.42],
      [B.sunDown + 1.5, 0.35, 0.35],
      [tn, 1.0, 0.9],
      [M2.reflect[1], 1.0, 0.9],
      [tm, 0.1, 0.45],
      [TOTAL2, 0.0, 0.5],
    ] as [number, number, number][]
  ).map(([t, n, s]) => [t, [n, s * 0.8]]),
);
const fog = new FCurve([
  [0, 0.004],
  [B.sunDown, 0.004],
  [tn, 0.012],
  [B.burning, 0.02],
  [M2.reflect[1], 0.014],
  [tm, 0.012],
  [M2.cta[0], 0.004],
  [TOTAL2, 0.004],
]);
const aurora = new FCurve([
  [0, 0.45],
  [3, 0.1],
  [B.food, 0.0],
  [tn, 1.0],
  [M2.reflect[1], 1.0],
  [M2.cta[0], 0.3],
  [TOTAL2, 0.45],
]);
const lampDir = (rx: number, rz: number) => new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(rx, 0, rz, "ZYX"));

export const lightAt2 = (t: number): LightState => {
  const s = sunCurve.evaluate(t);
  const w = world.evaluate(t);
  return {
    sunDir: lampDir(s[0], s[1]),
    sunEnergy: Math.max(0, s[2]),
    sunColor: lin(s[3], s[4], s[5]),
    moonEnergy: Math.max(0, moon.evaluate(t)),
    night: THREE.MathUtils.clamp(w[0], 0, 1),
    bgStrength: w[1],
    fog: fog.evaluate(t),
    aurora: Math.max(0, aurora.evaluate(t)),
    elevation: 90 - s[0] / D2R,
  };
};
