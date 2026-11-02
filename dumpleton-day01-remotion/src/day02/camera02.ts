import * as THREE from "three";
import { FCurveN } from "../fcurve";
import { windowNoise } from "../timeline";
import { B, M2, TOTAL2 } from "./timeline02";

// Day 02 shot list (Blender space, Z up; pitch = degrees from straight down, yaw around Z — same convention as Day 01).
type CK = [number, [number, number, number], number, number];
const OPEN: [[number, number, number], number, number] = [[0, -60, 170], 80, 0]; // = last frame of Day 01
export const CAMERA_KEYS2: CK[] = [
  [0, ...OPEN],
  [0.3, [0, -58, 170], 78, 0],
  [1.4, [25, 30, 60], 40, -20], // tilt down onto the river: baskets coming downstream
  [3.6, [27, 36, 52], 42, -20],
  [4.4, [0, -6, 95], 4, 0], // whip: yesterday, one dumpling
  [6.8, [0, -5, 70], 5, 0],
  [7.3, [14, -30, 60], 30, -18], // 272 followers, boats on the river
  [11.6, [16, -28, 48], 32, -20],
  [12.3, [22, -30, 20], 45, -10], // boat one / two / three dock
  [14.7, [22, -29, 19], 46, -12],
  [15.0, [10, -40, 70], 30, -10], // welcome — wide
  [16.8, [8, -36, 62], 30, -10],
  [17.1, [19, -17, 7], 55, -20], // find me in the crowd
  [19.6, [19.5, -16.5, 7.5], 55, -20],
  [19.9, [23, -18, 6], 58, -18], // Lizz
  [22.6, [23.3, -17.6, 6.2], 58, -18],
  [23.3, [20, -20, 6.5], 57, -20], // Vip3r
  [26.2, [20.3, -19.5, 6.8], 57, -20],
  [26.8, [14, -14, 45], 15, -10], // rule #3
  [29.2, [12, -12, 40], 15, -10],
  [29.7, [0, -30, 40], 35, 0], // most liked comment: casino site
  [34.4, [0, -26, 36], 35, 0],
  [34.7, [0, -20, 80], 15, 0], // build it: forest cleared
  [35.6, [0, -10, 60], 20, 0],
  [38.4, [0, -6, 55], 22, 0],
  [39.1, [-10, -6, 18], 40, 15], // Jordan's lab
  [41.8, [-10.5, -5, 17], 40, 15],
  [42.3, [10, 10, 26], 32, -8], // Iker's turret + Counterpart's cannons
  [44.9, [8, 11, 25], 32, -6],
  [45.35, [-15, 9, 20], 38, 25], // Avnish's telescope
  [47.6, [-15.5, 10, 19], 38, 25],
  [47.9, [-11, 1, 5.5], 55, 15], // Sunny the witch
  [50.4, [-11, 1.5, 5.8], 55, 15],
  [50.7, [-30, -40, 60], 35, -30], // sunset time-lapse orbit
  [54.8, [-20, -45, 55], 35, -15],
  [55.3, [0, -6, 30], 42, 0], // casino up
  [56.7, [2, -4, 28], 42, 0],
  [56.85, [-8, -30, 14], 42, 15], // last roof
  [57.7, [-8, -29, 13], 42, 15],
  [58.4, [0, 0, 12], 60, 180], // wait. listen. (looking south)
  [59.9, [0, -2, 11], 62, 180],
  [60.7, [0, -14, 24], 55, 180], // red eyes in the dark south
  [62.9, [0, -16, 23], 56, 180],
  [63.95, [0, -62, 40], 40, 0], // chili imps
  [65.9, [0, -60, 38], 40, 0],
  [66.2, [0, 10, 30], 40, 0], // north, where the wall is
  [67.6, [0, 12, 28], 40, 0],
  [68.2, [0, -30, 60], 12, 0], // south, no wall at all
  [71.0, [0, -28, 52], 12, 0],
  [71.5, [10, -48, 24], 45, -10], // torches, south side burning
  [75.5, [-10, -48, 24], 45, 10],
  [76.8, [0, 0, 8], 62, 180], // Bao never quits — charge south
  [80.0, [0, -4, 7], 64, 180],
  [81.1, [0, -20, 70], 20, 180], // they ran
  [83.4, [0, -24, 75], 22, 180],
  [84.4, [-10, -10, 60], 10, -10], // counting us
  [88.6, [-6, -8, 55], 10, -8],
  [89.9, [0, -40, 30], 40, 0], // morning, 23 houses gone
  [91.4, [0, -38, 28], 40, 0],
  [92.8, [-3, -38, 9], 50, -10], // Carly's stone house
  [96.2, [-2, -37, 9.5], 50, -12],
  [97.3, [0, -20, 60], 18, 0], // CTA pull out
  [102.8, [0, -18, 75], 10, 0],
  [103.5, [8, -40, 70], 25, -8], // bakery? bridge? south wall?
  [107.3, [6, -38, 78], 20, -6],
  [108.1, [0, -14, 85], 6, 0],
  [109.75, ...OPEN], // day three starts now -> back to the sky (loop frame)
  [TOTAL2, [0, -62, 168], 82, 0], // ...wait, there are two of them
];

const D2R = Math.PI / 180;
const curve = new FCurveN(CAMERA_KEYS2.map(([t, p, pitch, yaw]) => [t, [p[0], p[1], p[2], pitch * D2R, 0, yaw * D2R]]));
export const SHAKE_WINDOWS2: [number, number][] = [
  [B.wait2, B.wait2 + 1.2],
  [B.two2 - 0.1, TOTAL2],
  [M2.fight[0], M2.fight[1] + 0.6],
];

export const cameraAt2 = (t: number) => {
  const v = curve.evaluate(t);
  return {
    loc: new THREE.Vector3(v[0] + windowNoise(t, SHAKE_WINDOWS2, 0.25, 1.5, 404), v[1] + windowNoise(t, SHAKE_WINDOWS2, 0.25, 1.5, 505), v[2]),
    rot: new THREE.Euler(
      v[3] + windowNoise(t, SHAKE_WINDOWS2, 0.015, 1.2, 101),
      v[4] + windowNoise(t, SHAKE_WINDOWS2, 0.015, 1.2, 202),
      v[5] + windowNoise(t, SHAKE_WINDOWS2, 0.015, 1.2, 303),
      "ZYX",
    ),
  };
};
