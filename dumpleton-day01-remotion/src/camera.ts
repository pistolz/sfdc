import * as THREE from "three";
import { FCurveN } from "./fcurve";
import { M, T, TOTAL, SHAKE_WINDOWS, windowNoise } from "./timeline";

// Camera keyframes, verbatim from scene.py CK(...) calls. Blender coords (Z up), pitch/yaw in degrees.
type CK = [number, [number, number, number], number, number];
const OPEN: [[number, number, number], number, number] = [[0, -60, 170], 80, 0];
const mk = M;
export const CAMERA_KEYS: CK[] = [
  [0, ...OPEN],
  [0.45, [0, -58, 170], 78, 0],
  [1.75, [0, -6, 160], 3, 0],
  [mk.intro[0] + 0.2, [0, -6, 150], 3, 0],
  [mk.intro[1] - 1.6, [0, -4, 60], 5, 0],
  [mk.intro[1] + 0.5, [-3, -10.5, 5.5], 45, -3],
  [mk.premise[0] + 0.15, [-2.9, -10.3, 5.8], 45, -3],
  [mk.premise[0] + 0.45, [6, -16, 26], 22, 10],
  [mk.premise[1] + 0.4, [15, -16, 24], 28, 30],
  [mk.threat[0] - 0.25, [14, -16, 25], 28, 30],
  [mk.threat[0] + 0.15, [0, -22, 130], 10, 0],
  [mk.giant[0] - 0.6, [6, -16, 118], 8, 4],
  [mk.giant[0] - 0.2, [-25, -60, 115], 28, -8],
  [mk.rule1[0] - 0.5, [-18, -52, 100], 26, -6],
  [mk.rule1[0] - 0.15, [0, -7, 46], 8, 0],
  [mk.build[0], [0, -4, 30], 8, 0],
  [T.tree + 0.6, [6, -2, 20], 22, 18],
  [T.door, [2, -13, 19], 32, 3],
  [mk.sunset[0] - 0.2, [-9, -11, 22], 32, -35],
  [mk.eyes[0] - 0.2, [-5, -22, 55], 24, -12],
  [mk.eyes[1] + 0.6, [0, 3, 15], 38, 0],
  [mk.rule2[0] - 0.35, [0, 4.5, 12.5], 40, 0],
  [mk.rule2[0], [0, -13, 12], 38, 0],
  [mk.roof[0] - 0.2, [0, -10.5, 9], 38, 0],
  [mk.roof[1] + 0.3, [7, -10, 20], 38, 35],
  [mk.steps[0] - 0.3, [8, -9, 22], 40, 45],
  [mk.steps[0] + 0.1, [0, -12, 95], 10, 0],
  [mk.morning[0] - 0.3, [0, -9, 72], 8, 0],
  [mk.morning[1] + 0.4, [2, -12, 26], 26, 5],
  [mk.cta[0] + 3.0, [0, -16, 55], 16, 0],
  [mk.cta[1] + 0.3, [0, -10, 78], 6, 0],
  [mk.end[0] + 0.4, [0, -10, 80], 6, 0],
  [TOTAL - 0.12, ...OPEN],
];

const D2R = Math.PI / 180;
const curve = new FCurveN(
  CAMERA_KEYS.map(([t, p, pitch, yaw]) => [t, [p[0], p[1], p[2], pitch * D2R, 0, yaw * D2R]]),
);

export const CAM_FOV = 2 * Math.atan(18 / 32) * (180 / Math.PI); // 58.7° vertical
export const CAM_NEAR = 0.5;
export const CAM_FAR = 6000;

export type CamState = { loc: THREE.Vector3; rot: THREE.Euler };

/** Camera in Blender space at time t, incl. the noise shake during the giant windows. */
export const cameraAt = (t: number): CamState => {
  const v = curve.evaluate(t);
  const rx = v[3] + windowNoise(t, SHAKE_WINDOWS, 0.02, 1.2, 101);
  const ry = v[4] + windowNoise(t, SHAKE_WINDOWS, 0.02, 1.2, 202);
  const rz = v[5] + windowNoise(t, SHAKE_WINDOWS, 0.02, 1.2, 303);
  const lx = v[0] + windowNoise(t, SHAKE_WINDOWS, 0.35, 1.5, 404);
  const ly = v[1] + windowNoise(t, SHAKE_WINDOWS, 0.35, 1.5, 505);
  return { loc: new THREE.Vector3(lx, ly, v[2]), rot: new THREE.Euler(rx, ry, rz, "ZYX") }; // three "ZYX" == Blender XYZ (Rz·Ry·Rx)
};

// Blender (Z-up) -> three (Y-up): rotate -90° around X.  three(x,y,z) = blender(x, z, -y)
export const B2T = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
export const b2t = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

/** World matrix of the three.js camera for Blender camera state. */
export const cameraMatrix = (s: CamState) => {
  const m = new THREE.Matrix4().compose(s.loc, new THREE.Quaternion().setFromEuler(s.rot), new THREE.Vector3(1, 1, 1));
  return new THREE.Matrix4().multiplyMatrices(B2T, m);
};

/** Ground point (Blender XY) the camera looks at (used to centre the shadow frustum). */
export const cameraGroundTarget = (s: CamState) => {
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(s.rot);
  if (dir.z > -0.05) {
    // looking at horizon: take a point 120 m ahead
    return new THREE.Vector3(s.loc.x + dir.x * 120, s.loc.y + dir.y * 120, 0);
  }
  const k = -s.loc.z / dir.z;
  return new THREE.Vector3(s.loc.x + dir.x * k, s.loc.y + dir.y * k, 0);
};
