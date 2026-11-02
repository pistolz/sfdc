// Day 02 world content, layered on top of the finished Day 01 village (cabin, campfire, steamer, bunting…).
// Blender space (Z up), same conventions as src/scene/Village.tsx. Every animation is a pure function of t.
import * as THREE from "three";
import { useLayoutEffect, useMemo } from "react";
import { FCurve, FCurveN, popScale } from "../fcurve";
import { fnoise, FPS, rng } from "../timeline";
import { bodyGeometry, Dumpling, makeAnim } from "../scene/Dumpling";
import { std } from "../scene/materials";
import { height, lin, riverX } from "../scene/world";
import { B, M2 } from "./timeline02";

// ------------------------------------------------------------------ shared geometry / materials
const E = (x: number, y: number, z: number) => new THREE.Euler(x, y, z, "ZYX");
const zUp = (g: THREE.BufferGeometry) => {
  g.rotateX(Math.PI / 2);
  return g;
};
const BOXB = (() => {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0, 0.5);
  return g;
})();
const BOXC = new THREE.BoxGeometry(1, 1, 1);
const CYL = zUp(new THREE.CylinderGeometry(1, 1, 1, 20));
const CYLB = (() => {
  const g = zUp(new THREE.CylinderGeometry(1, 1, 1, 20));
  g.translate(0, 0, 0.5);
  return g;
})();
const CYL_OPEN = zUp(new THREE.CylinderGeometry(1, 1, 1, 32, 1, true));
const CONEB = (() => {
  const g = zUp(new THREE.ConeGeometry(1, 1, 16));
  g.translate(0, 0, 0.5);
  return g;
})();
const CONE7 = (() => {
  const g = zUp(new THREE.ConeGeometry(1, 1, 7));
  g.translate(0, 0, 0.5);
  return g;
})();
const SPH = new THREE.IcosahedronGeometry(1, 3);
const SPH1 = new THREE.IcosahedronGeometry(1, 1);
const DISC = new THREE.CircleGeometry(1, 32);
const PRISM = (() => {
  // gable roof: width 1 (x), depth 1 (y), height 1 (z), ridge along y
  const v = [
    [-0.5, -0.5, 0],
    [0.5, -0.5, 0],
    [0, -0.5, 1],
    [-0.5, 0.5, 0],
    [0.5, 0.5, 0],
    [0, 0.5, 1],
  ];
  const tris = [
    [0, 1, 2],
    [5, 4, 3],
    [0, 2, 5],
    [0, 5, 3],
    [1, 4, 5],
    [1, 5, 2],
    [0, 3, 4],
    [0, 4, 1],
  ];
  const pos: number[] = [];
  for (const t of tris) for (const i of t) pos.push(...v[i]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
})();

const MAT = {
  bamboo: std([0.86, 0.7, 0.42], 0.7, { side: THREE.DoubleSide }),
  bamboo2: std([0.74, 0.56, 0.3], 0.7, { side: THREE.DoubleSide }),
  stone: std([0.62, 0.6, 0.58], 0.9, { flatShading: true }),
  stoneDark: std([0.42, 0.42, 0.44], 0.9, { flatShading: true }),
  slate: std([0.25, 0.3, 0.4], 0.6, { flatShading: true }),
  wood: std([0.55, 0.36, 0.22], 0.8),
  red: std([0.72, 0.05, 0.07], 0.45),
  cream: std([1.0, 0.9, 0.75], 0.6),
  gold: new THREE.MeshStandardMaterial({ color: lin(1.0, 0.66, 0.18), roughness: 0.3, metalness: 0.7 }),
  white: std([0.95, 0.95, 0.97], 0.35),
  labWhite: std([0.72, 0.76, 0.8], 0.5),
  silver: new THREE.MeshStandardMaterial({ color: lin(0.75, 0.78, 0.82), roughness: 0.25, metalness: 0.8 }),
  iron: new THREE.MeshStandardMaterial({ color: lin(0.05, 0.05, 0.06), roughness: 0.4, metalness: 0.6 }),
  brass: new THREE.MeshStandardMaterial({ color: lin(0.85, 0.6, 0.25), roughness: 0.3, metalness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({ color: lin(0.5, 0.9, 1.0), roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }),
  potion: new THREE.MeshStandardMaterial({ color: lin(0.2, 1.0, 0.3), emissive: lin(0.2, 1.0, 0.3), emissiveIntensity: 6, roughness: 0.2 }),
  neon: new THREE.MeshStandardMaterial({ color: lin(1.0, 0.2, 0.6), emissive: lin(1.0, 0.15, 0.55), emissiveIntensity: 3.5, roughness: 0.3 }),
  bulb: new THREE.MeshStandardMaterial({ color: lin(1, 0.85, 0.4), emissive: lin(1.0, 0.8, 0.3), emissiveIntensity: 10, roughness: 0.3 }),
  flame: new THREE.MeshStandardMaterial({ color: lin(1, 0.5, 0.1), emissive: lin(1.0, 0.45, 0.08), emissiveIntensity: 9, roughness: 0.5 }),
  impEye: new THREE.MeshStandardMaterial({ color: lin(1.0, 0.3, 0.2), emissive: lin(1.0, 0.04, 0.03), emissiveIntensity: 45, roughness: 0.3, flatShading: true }),
  giantEye: new THREE.MeshStandardMaterial({ color: lin(1.0, 0.2, 0.1), emissive: lin(1.0, 0.04, 0.03), emissiveIntensity: 30, roughness: 0.3 }),
  impBody: std([0.8, 0.06, 0.03], 0.35, { emissive: lin(0.9, 0.05, 0.02), emissiveIntensity: 0.35 }),
  impStem: std([0.15, 0.5, 0.1], 0.6, { flatShading: true }),
  plume: std([0.95, 0.15, 0.2], 0.6),
  purple: std([0.25, 0.08, 0.35], 0.5, { flatShading: true }),
  black: std([0.02, 0.02, 0.03], 0.3),
  ghost: new THREE.MeshStandardMaterial({
    color: lin(0.2, 1.0, 0.45),
    roughness: 0.4,
    emissive: lin(0.15, 1.0, 0.4),
    emissiveIntensity: 3,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  }),
  puff: new THREE.MeshStandardMaterial({ color: lin(0.95, 0.97, 1.0), roughness: 0.9, transparent: true, opacity: 0.75, depthWrite: false, flatShading: true }),
  smoke: new THREE.MeshStandardMaterial({ color: lin(0.35, 0.35, 0.38), roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false, flatShading: true }),
  houseWall: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
  houseRoof: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, flatShading: true }),
  houseWin: new THREE.MeshStandardMaterial({ color: lin(0.1, 0.08, 0.05), emissive: lin(1.0, 0.62, 0.25), emissiveIntensity: 0, roughness: 0.4 }),
  crowdBody: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.32, sheen: 0.25, sheenColor: lin(0.5, 0.45, 0.4) }),
  crowdEye: std([0.02, 0.02, 0.03], 0.2, { flatShading: true }),
};

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const compose = (x: number, y: number, z: number, rz: number, sx: number, sy: number, sz: number, out = _m) =>
  out.compose(_v.set(x, y, z), _q.setFromEuler(E(0, 0, rz)), _s.set(sx, sy, sz));

/** a popping piece (scale 0 -> 1.18 -> 0.93 -> 1) */
const Pop: React.FC<{
  t: number;
  t0: number;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  pos: [number, number, number];
  scale: [number, number, number];
  rot?: THREE.Euler;
  cast?: boolean;
  until?: number;
}> = ({ t, t0, geo, mat, pos, scale, rot, cast = true, until }) => {
  let k = popScale(t, t0);
  if (until !== undefined && t > until) k *= Math.max(0, 1 - (t - until) / 0.25);
  if (k <= 0.0005) return null;
  return <mesh geometry={geo} material={mat} position={pos} rotation={rot ?? E(0, 0, 0)} scale={[scale[0] * k, scale[1] * k, scale[2] * k]} castShadow={cast} receiveShadow />;
};

// ------------------------------------------------------------------ puffs (dust on every pop)
type PuffEv = { loc: [number, number, number]; t: number; n: number; r: number; spread: number };
const PUFFS: PuffEv[] = [];
const puff = (loc: [number, number, number], t: number, n = 7, r = 0.45, spread = 1.6) => PUFFS.push({ loc, t, n, r, spread });
const PUFF_L = new FCurve([
  [0, 0],
  [0.55, 1],
]);
const PUFF_S = new FCurve([
  [-0.02, 0],
  [0.06, 1],
  [0.3, 1.6],
  [0.6, 0],
]);

// ------------------------------------------------------------------ layout
const halfW = (y: number) => 6.5 + 1.5 * Math.sin(y / 23);
export const DOCK_Y = [-4, -12, -20];
const ARRIVE = [B.boat1, B.boat2, B.boat3];
const boatDockX = (y: number) => riverX(y) - halfW(y) + 4.6;
const BOAT_Y = DOCK_Y.map((dy, i) => new FCurve([[0, 105 + 25 * i], [ARRIVE[i], dy]]));
export const boatPos = (i: number, t: number): [number, number, number] => {
  const y = BOAT_Y[i].evaluate(t);
  const k = THREE.MathUtils.clamp((t - (ARRIVE[i] - 2.5)) / 2.5, 0, 1);
  const x = riverX(y) - (halfW(y) - 4.6) * THREE.MathUtils.smoothstep(k, 0, 1);
  return [x, y, -0.9 + 0.08 * Math.sin(t * 2 + i)];
};

export const CASINO: [number, number] = [0, 22];
export const LAB: [number, number] = [-16, 11];
export const TELESCOPE: [number, number] = [-22, 25];
const WALL_R = 33;
const wallAt = (deg: number): [number, number] => [WALL_R * Math.cos((deg * Math.PI) / 180), WALL_R * Math.sin((deg * Math.PI) / 180)];
export const TURRET = wallAt(64);
export const CANNONS = [wallAt(98), wallAt(82)];
export const CARLY: [number, number] = [0, -27];
export const SUNNY_POS: [number, number] = [-12.5, 6.5];
export const BAKERY: [number, number] = [-25, -8];
export const BRIDGE_Y = -30;

// houses
type House = { x: number; y: number; rz: number; wall: THREE.Color; roof: THREE.Color; tPop: number; tRoof: number; burn: number };
const ROOFS: [number, number, number][] = [
  [0.98, 0.35, 0.5],
  [0.45, 0.85, 0.65],
  [0.7, 0.6, 1.0],
  [1.0, 0.8, 0.3],
  [1.0, 0.55, 0.4],
  [0.4, 0.65, 1.0],
];
export const HOUSES: House[] = (() => {
  const r = rng(2002);
  const cand: { x: number; y: number }[] = [];
  for (const rr of [19, 23.5, 28]) {
    const n = Math.floor((2 * Math.PI * rr) / 5.4);
    for (let j = 0; j < n; j++) {
      const a = (j / n) * 2 * Math.PI + rr * 0.11;
      const x = rr * Math.cos(a) + (r() - 0.5) * 1.2;
      const y = rr * Math.sin(a) + (r() - 0.5) * 1.2;
      const d = (p: [number, number]) => Math.hypot(x - p[0], y - p[1]);
      if (x > riverX(y) - 9) continue;
      if (Math.abs(x) < 8.5 && y > 14) continue; // casino
      if (d(LAB) < 5.5 || d(TELESCOPE) < 5 || d(CARLY) < 4.5 || d([25, -12]) < 6 || d(BAKERY) < 4) continue;
      cand.push({ x, y });
    }
  }
  // the 23 southern-most houses burn during the night
  const bySouth = [...cand].sort((a, b) => a.y - b.y);
  const burnSet = new Set(bySouth.slice(0, 23));
  // pop order: wave A (east/south-east, near the dock) while the crowd walks in, wave B during the time-lapse
  const byDock = [...cand].sort((a, b) => Math.hypot(a.x - 25, a.y + 12) - Math.hypot(b.x - 25, b.y + 12));
  const out: House[] = [];
  byDock.forEach((c, i) => {
    const waveA = i < 22;
    const tPop = waveA ? B.welcome + 1.2 + i * 0.55 : B.food + (i - 22) * ((B.casinoUp - 0.4 - B.food) / Math.max(1, byDock.length - 22));
    const isLast = i === byDock.length - 1;
    const roof = ROOFS[Math.floor(r() * ROOFS.length)];
    out.push({
      x: c.x,
      y: c.y,
      rz: Math.atan2(-c.y, -c.x) + Math.PI / 2,
      wall: lin(1.0, 0.9 - r() * 0.06, 0.78 - r() * 0.08),
      roof: lin(...roof),
      tPop: isLast ? B.lastRoof - 0.6 : tPop,
      tRoof: isLast ? B.lastRoof + 0.2 : tPop + 0.12,
      burn: -1,
    });
  });
  const burning = out.filter((h) => burnSet.has(byDock.find((c) => c.x === h.x && c.y === h.y)!));
  burning.sort((a, b) => a.x - b.x).forEach((h, j) => (h.burn = B.burning - 1.0 + j * 0.06));
  return out;
})();
for (const h of HOUSES) puff([h.x, h.y, 0.2], h.tPop + 0.05, 6, 0.4, 1.8);
const COLLAPSE = M2.reflect[0]; // burned houses fall in during "this valley was theirs…"

// crowd (150 = 3 boats x 50)
type Agent = { boat: number; seat: [number, number]; td: number; target: [number, number]; huddle: [number, number]; color: THREE.Color; ph: number };
const DCOL: [number, number, number][] = [
  [1.0, 0.93, 0.82],
  [1.0, 0.62, 0.7],
  [1.0, 0.85, 0.4],
  [0.78, 0.68, 0.98],
  [0.58, 0.92, 0.76],
];
export const AGENTS: Agent[] = (() => {
  const r = rng(272);
  const out: Agent[] = [];
  const taken: [number, number][] = HOUSES.map((h) => [h.x, h.y]);
  const free = (x: number, y: number) => {
    if (x > riverX(y) - 8) return false;
    if (Math.abs(x) < 4.5 && y > -1.5 && y < 5.5) return false; // cabin
    if (x > -2 && x < 4 && y > -6 && y < -1.5) return false; // fire/steamer
    if (Math.abs(x) < 7.5 && y > 16.5 && y < 27.5) return false; // casino
    if (Math.hypot(x - LAB[0], y - LAB[1]) < 4.5 || Math.hypot(x - TELESCOPE[0], y - TELESCOPE[1]) < 4 || Math.hypot(x - CARLY[0], y - CARLY[1]) < 3.5) return false;
    return taken.every(([a, b]) => Math.hypot(x - a, y - b) > 2.1);
  };
  for (let i = 0; i < 150; i++) {
    const boat = Math.floor(i / 50);
    const k = i % 50;
    const rr = 3.9 * Math.sqrt((k + 0.5) / 50);
    const ang = k * 2.39996;
    let target: [number, number] = [0, -10];
    for (let tries = 0; tries < 200; tries++) {
      const a = r() * Math.PI * 2;
      const d = 6 + r() * 22;
      const x = d * Math.cos(a);
      const y = d * Math.sin(a);
      if (free(x, y)) {
        target = [x, y];
        taken.push(target);
        break;
      }
    }
    const huddle: [number, number] = [target[0] * 0.35, 9 + target[1] * 0.22];
    out.push({
      boat,
      seat: [rr * Math.cos(ang), rr * Math.sin(ang)],
      td: B.welcome - 0.4 + k * 0.1 + boat * 0.5,
      target,
      huddle,
      color: lin(...(i % 5 ? DCOL[1 + (i % 4)] : DCOL[i % 5])),
      ph: r() * 6.28,
    });
  }
  return out;
})();
const CROWD_S = 0.62;
const lerp2 = (a: [number, number], b: [number, number], k: number): [number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const ss = (x: number) => THREE.MathUtils.smoothstep(x, 0, 1);
export const agentPos = (a: Agent, t: number): { x: number; y: number; z: number; moving: boolean } => {
  const bp = boatPos(a.boat, t);
  if (t < a.td) return { x: bp[0] + a.seat[0], y: bp[1] + a.seat[1], z: bp[2] + 0.35, moving: false };
  const dock: [number, number] = [boatDockX(DOCK_Y[a.boat]) - 5.2, DOCK_Y[a.boat]];
  let p: [number, number];
  let moving = false;
  if (t < a.td + 0.7) {
    p = lerp2([bp[0] + a.seat[0], bp[1] + a.seat[1]], dock, ss((t - a.td) / 0.7));
    moving = true;
  } else if (t < a.td + 6.2) {
    p = lerp2(dock, a.target, ss((t - a.td - 0.7) / 5.5));
    moving = true;
  } else p = a.target;
  // night: nobody walks alone -> everybody huddles in the north, back home at dawn
  const hIn = ss((t - B.wait) / 1.4);
  const hOut = ss((t - (B.morning + 0.6)) / 3);
  const h = hIn * (1 - hOut);
  if (h > 0) {
    p = lerp2(p, a.huddle, h);
    if (h < 0.999) moving = true;
  }
  const onBoat = t < a.td + 0.35;
  const z = onBoat ? bp[2] + 0.35 : height(p[0], p[1]);
  return { x: p[0], y: p[1], z, moving };
};

// named characters
const path = (keys: [number, [number, number]][]) => new FCurveN(keys.map(([t, v]) => [t, v]));
const BAO2 = path([
  [0, [1.2, -6.0]],
  [B.yesterday, [1.2, -6.0]],
  [B.n272, [6, -7]],
  [B.boat3 + 0.4, [21.5, -9]],
  [B.rule3, [21.5, -9]],
  [B.most, [8, -6]],
  [B.buildIt, [2, 12]],
  [B.jordan, [2, 12]],
  [B.food, [-2, -4]],
  [B.done2, [-1.6, -5.4]],
  [B.wait, [0, -8]],
  [B.bao, [0, -8]],
  [B.push + 0.4, [0, -18]],
  [B.ran + 2, [0, -17]],
  [B.morning, [-2.5, -23.5]],
  [B.n98 + 1, [-2.5, -23.5]],
  [B.oneFollow + 1, [1.2, -6]],
]);
const LIZZ = path([
  [0, [25.5, -11]],
  [B.rule3, [25.5, -11]],
  [B.most, [5, -9]],
  [B.wait, [5, -9]],
  [B.wait + 1.2, [3, -5]],
  [B.bao, [3, -5]],
  [B.push + 0.6, [-3, -19.5]],
  [B.ran + 2, [-3, -20]],
  [B.morning, [-4.5, -22]],
]);
const VIP3R = path([
  [0, [23, -12.8]],
  [B.rule3, [23, -12.8]],
  [B.most, [3, -9.5]],
  [B.wait, [3, -9.5]],
  [B.wait + 1.2, [-3, -5]],
  [B.bao, [-3, -5]],
  [B.push + 0.6, [3, -19.5]],
  [B.ran + 2, [3, -20]],
  [B.morning, [1.6, -23.8]],
]);
const SUNNY = path([
  [0, SUNNY_POS],
  [B.wait, SUNNY_POS],
  [B.wait + 1.4, [-4, 8]],
  [B.morning + 0.6, [-4, 8]],
  [B.morning + 3.6, SUNNY_POS],
]);
export const charPos = { bao: (t: number) => BAO2.evaluate(t), lizz: (t: number) => LIZZ.evaluate(t), vip3r: (t: number) => VIP3R.evaluate(t), sunny: (t: number) => SUNNY.evaluate(t) };
const T_LIZZ = B.welcome + 0.5;
const T_VIP3R = B.welcome + 0.7;
puff([25.5, -11, 0.2], T_LIZZ, 7, 0.45, 1.6);
puff([23, -12.8, 0.2], T_VIP3R, 7, 0.45, 1.6);
puff([SUNNY_POS[0], SUNNY_POS[1], 0.2], B.sunny, 8, 0.45, 1.8);
const ANIM = { bao: makeAnim(42), lizz: makeAnim(7001), vip3r: makeAnim(7002), sunny: makeAnim(7003) };
const KNIGHTS = Array.from({ length: 6 }, (_, i) => ({
  x0: -7.5 + i * 3,
  color: DCOL[(i + 1) % 5],
  anim: makeAnim(8000 + i),
  t0: B.knights + i * 0.06,
}));
KNIGHTS.forEach((k) => puff([k.x0, -12, 0.2], k.t0, 6, 0.4, 1.5));

// imps
type Imp = { a: number; r0: number; ph: number; rad: FCurve; tEye: number };
export const IMPS: Imp[] = (() => {
  const r = rng(666);
  return Array.from({ length: 40 }, (_, i) => {
    const a = ((232 + (i * 76) / 39 + (r() - 0.5) * 3) * Math.PI) / 180;
    const j = r();
    const r0 = 41 + j * 3;
    return {
      a,
      r0,
      ph: r() * 6.28,
      tEye: B.red - 0.3 + i * 0.03,
      rad: new FCurve([
        [0, r0],
        [B.chili, r0],
        [B.south2 + 1.5, 26 + j * 2.5],
        [B.bao, 25 + j * 2],
        [B.push + 0.6, 31 + j * 2],
        [B.ran, 32 + j * 2],
        [B.ran + 2.6, 64],
      ]),
    };
  });
})();
export const impPos = (m: Imp, t: number): [number, number, number] => {
  const rr = m.rad.evaluate(t);
  const wob = 0.06 * Math.sin(t * 1.7 + m.ph);
  const x = rr * Math.cos(m.a + wob);
  const y = rr * Math.sin(m.a + wob);
  return [x, y, height(x, y)];
};

// torches
const TORCHES = (() => {
  const out: { x: number; y: number; t0: number }[] = [];
  for (let i = 0; i < 18; i++) {
    const a = ((205 + (i * 130) / 17) * Math.PI) / 180;
    out.push({ x: 21.5 * Math.cos(a), y: 21.5 * Math.sin(a), t0: B.torches + i * 0.05 });
  }
  const extra: [number, number][] = [
    [-9, -2],
    [9, -2],
    [-6, 13],
    [6, 13],
    [-14, 4],
    [14, 6],
    [0, -14],
    [-4, -9],
  ];
  extra.forEach(([x, y], i) => out.push({ x, y, t0: B.torches + 0.9 + i * 0.07 }));
  return out;
})();
TORCHES.forEach((tc) => puff([tc.x, tc.y, 0.1], tc.t0, 3, 0.25, 0.8));

// ghosts (CTA): rebuild on 12 burned spots + bakery / bridge / south wall options
const GHOST_SPOTS = HOUSES.filter((h) => h.burn > 0).slice(0, 12);
const ghostGeo = (() => {
  const box = new THREE.BoxGeometry(3.0, 2.4, 1.8);
  box.translate(0, 0, 0.9);
  const roof = PRISM.clone();
  roof.scale(3.6, 3.0, 1.2);
  roof.translate(0, 0, 1.8);
  const a = box.toNonIndexed();
  a.deleteAttribute("uv");
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...(a.attributes.position.array as Float32Array), ...(roof.attributes.position.array as Float32Array)]), 3));
  g.computeVertexNormals();
  return g;
})();

// casino bulbs
const BULBS = Array.from({ length: 26 }, (_, i) => {
  const u = i / 25;
  return [CASINO[0] - 5.5 + 11 * u, CASINO[1] - 3.75, 4.0] as [number, number, number];
});

// big eyes in the sky for the twist ("…wait. There are two of them.")
const GIANT_EYES = [
  { c: [-270, 1150, 222], t0: B.wait2 + 0.2 },
  { c: [280, 1180, 246], t0: B.two2 },
];

// windows glow & fire curves
const winGlow2 = new FCurve([
  [0, 3],
  [5, 0],
  [B.sunDown, 0],
  [B.wait, 25],
  [B.morning + 1, 25],
  [M2.carly[1], 3],
]);
const fireGlow = new FCurve([
  [B.burning - 1.2, 0],
  [B.burning, 1],
  [M2.reflect[0] + 2, 1],
  [M2.reflect[1], 0],
]);
export const windowGlowAt = (t: number) => winGlow2.evaluate(t);

// ------------------------------------------------------------------ instanced helpers
const Inst: React.FC<{ geo: THREE.BufferGeometry; mat: THREE.Material; count: number; fill: (m: THREE.InstancedMesh) => void; t: number; cast?: boolean; colors?: THREE.Color[] }> = ({
  geo,
  mat,
  count,
  fill,
  t,
  cast = false,
  colors,
}) => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.frustumCulled = false;
    m.castShadow = cast;
    m.receiveShadow = true;
    if (colors) colors.forEach((c, i) => m.setColorAt(i, c));
    return m;
  }, [geo, mat, count, cast, colors]);
  useLayoutEffect(() => {
    fill(mesh);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh, t]);
  return <primitive object={mesh} />;
};

// accessories (children of a Dumpling body group; r = dumpling radius)
const Helmet: React.FC<{ r: number; plume?: boolean }> = ({ r, plume = true }) => (
  <group>
    <mesh geometry={SPH} material={MAT.silver} position={[0, 0, r * 1.15]} scale={[r * 0.6, r * 0.6, r * 0.45]} castShadow />
    <mesh geometry={BOXC} material={MAT.silver} position={[0, -r * 0.5, r * 1.12]} scale={[r * 0.16, r * 0.12, r * 0.5]} />
    {plume ? <mesh geometry={CONEB} material={MAT.plume} position={[0, r * 0.1, r * 1.5]} rotation={[-0.5, 0, 0]} scale={[r * 0.14, r * 0.14, r * 0.55]} /> : null}
    <mesh geometry={BOXC} material={MAT.silver} position={[r * 0.95, -r * 0.2, r * 0.75]} rotation={[0, 0.25, 0]} scale={[r * 0.07, r * 0.07, r * 1.1]} castShadow />
  </group>
);
const WhiteArmor: React.FC<{ r: number }> = ({ r }) => (
  <group>
    <mesh geometry={SPH} material={MAT.white} position={[0, 0, r * 1.15]} scale={[r * 0.62, r * 0.62, r * 0.47]} castShadow />
    <mesh geometry={BOXC} material={MAT.gold} position={[0, -r * 0.55, r * 1.1]} scale={[r * 0.12, r * 0.1, r * 0.45]} />
    {/* big white shield with a gold cross */}
    <group position={[-r * 0.95, -r * 0.45, r * 0.6]} rotation={[Math.PI / 2, 0, -0.45]}>
      <mesh geometry={CYL} material={MAT.white} scale={[r * 0.75, r * 0.75, r * 0.12]} castShadow />
      <mesh geometry={BOXC} material={MAT.gold} position={[0, 0, r * 0.07]} scale={[r * 0.18, r * 1.1, r * 0.04]} />
      <mesh geometry={BOXC} material={MAT.gold} position={[0, r * 0.15, r * 0.07]} scale={[r * 0.8, r * 0.18, r * 0.04]} />
    </group>
  </group>
);
const WitchHat: React.FC<{ r: number }> = ({ r }) => (
  <group>
    <mesh geometry={CYL} material={MAT.purple} position={[0, 0, r * 1.3]} scale={[r * 0.75, r * 0.75, 0.05]} castShadow />
    <mesh geometry={CONE7} material={MAT.purple} position={[0, 0, r * 1.3]} rotation={[0.25, 0, 0]} scale={[r * 0.42, r * 0.42, r * 1.2]} castShadow />
    <mesh geometry={CYLB} material={MAT.gold} position={[0, 0, r * 1.33]} scale={[r * 0.44, r * 0.44, r * 0.1]} />
  </group>
);

// ------------------------------------------------------------------ component
export const Village02: React.FC<{ t: number; night: number }> = ({ t }) => {
  const wg = windowGlowAt(t);
  MAT.houseWin.emissiveIntensity = wg;
  const fg = fireGlow.evaluate(t);
  const bulbOn = popScale(t, B.casinoUp + 0.3);
  MAT.bulb.emissiveIntensity = 10 * bulbOn;
  const bao = charPos.bao(t);
  const lz = charPos.lizz(t);
  const vp = charPos.vip3r(t);
  const sn = charPos.sunny(t);
  const houseCols = useMemo(() => HOUSES.map((h) => h.wall), []);
  const roofCols = useMemo(() => HOUSES.map((h) => h.roof), []);
  const crowdCols = useMemo(() => AGENTS.map((a) => a.color), []);
  const char = lin(0.08, 0.07, 0.07);

  return (
    <group>
      {/* ---------------- steamer-basket boats */}
      {[0, 1, 2].map((i) => {
        const p = boatPos(i, t);
        return (
          <group key={`boat${i}`} position={p} rotation={[0, 0, 0.25 * Math.sin(t * 0.6 + i)]}>
            <mesh geometry={CYL_OPEN} material={MAT.bamboo} position={[0, 0, 0.45]} scale={[4.8, 4.8, 1.1]} castShadow receiveShadow />
            <mesh geometry={CYL_OPEN} material={MAT.bamboo2} position={[0, 0, 0.45]} scale={[4.55, 4.55, 1.05]} receiveShadow />
            <mesh geometry={DISC} material={MAT.bamboo2} position={[0, 0, 0.2]} scale={[4.6, 4.6, 1]} receiveShadow />
            {[0.15, 0.6].map((z) => (
              <mesh key={z} geometry={CYL_OPEN} material={MAT.bamboo2} position={[0, 0, z]} scale={[4.83, 4.83, 0.12]} />
            ))}
          </group>
        );
      })}
      {/* ---------------- crowd (instanced) */}
      <Inst
        geo={bodyGeometry(0.9)}
        mat={MAT.crowdBody}
        count={AGENTS.length}
        t={t}
        cast
        colors={crowdCols}
        fill={(mesh) => {
          AGENTS.forEach((a, i) => {
            const p = agentPos(a, t);
            const fr = t * FPS;
            const sq = Math.sin(0.68 * fr + a.ph);
            const hop = (p.moving ? 0.35 : 0.2) * 0.9 * (Math.sin(0.34 * fr + a.ph) + 1);
            compose(p.x, p.y, p.z + hop * CROWD_S, 0, CROWD_S * (1 + 0.07 * sq), CROWD_S * (1 + 0.07 * sq), CROWD_S * (1 - 0.13 * sq));
            mesh.setMatrixAt(i, _m);
          });
        }}
      />
      <Inst
        geo={SPH1}
        mat={MAT.crowdEye}
        count={AGENTS.length * 2}
        t={t}
        fill={(mesh) => {
          const body = new THREE.Matrix4();
          const loc = new THREE.Matrix4();
          AGENTS.forEach((a, i) => {
            const p = agentPos(a, t);
            const fr = t * FPS;
            const sq = Math.sin(0.68 * fr + a.ph);
            const hop = (p.moving ? 0.35 : 0.2) * 0.9 * (Math.sin(0.34 * fr + a.ph) + 1);
            compose(p.x, p.y, p.z + hop * CROWD_S, 0, CROWD_S * (1 + 0.07 * sq), CROWD_S * (1 + 0.07 * sq), CROWD_S * (1 - 0.13 * sq), body);
            const blink = (t + a.ph) % 2.7 < 0.1 ? 0.1 : 1.25;
            [-1, 1].forEach((sx, j) => {
              loc.compose(_v.set(sx * 0.9 * 0.32, -0.9 * 0.78, 0.9 * 0.72), _q.identity(), _s.set(0.099, 0.06, 0.099 * blink));
              mesh.setMatrixAt(i * 2 + j, new THREE.Matrix4().multiplyMatrices(body, loc));
            });
          });
        }}
      />
      {/* ---------------- named characters */}
      <Dumpling t={t} color={[1.0, 0.8, 0.52]} r={1.4} hat anim={ANIM.bao} position={[bao[0], bao[1], height(bao[0], bao[1])]} />
      {t > T_LIZZ - 0.01 ? (
        <Dumpling t={t} color={[1.0, 0.62, 0.7]} r={1.0} anim={ANIM.lizz} position={[lz[0], lz[1], height(lz[0], lz[1])]} scale={popScale(t, T_LIZZ)}>
          <Helmet r={1.0} />
        </Dumpling>
      ) : null}
      {t > T_VIP3R - 0.01 ? (
        <Dumpling t={t} color={[0.95, 0.95, 0.97]} r={1.0} anim={ANIM.vip3r} position={[vp[0], vp[1], height(vp[0], vp[1])]} scale={popScale(t, T_VIP3R)}>
          <WhiteArmor r={1.0} />
        </Dumpling>
      ) : null}
      {t > B.sunny - 0.01 ? (
        <Dumpling t={t} color={[0.78, 0.68, 0.98]} r={0.95} anim={ANIM.sunny} position={[sn[0], sn[1], height(sn[0], sn[1])]} scale={popScale(t, B.sunny)}>
          <WitchHat r={0.95} />
        </Dumpling>
      ) : null}
      {KNIGHTS.map((k, i) => {
        const s = popScale(t, k.t0) * (t > B.morning ? Math.max(0, 1 - (t - B.morning) / 0.3) : 1);
        if (s <= 0.001) return null;
        const y = -12 - 7.5 * ss((t - k.t0 - 0.2) / 1.2) + 1.5 * ss((t - B.ran) / 2);
        return (
          <Dumpling key={`k${i}`} t={t} color={k.color} r={0.9} anim={k.anim} position={[k.x0, y, height(k.x0, y)]} scale={s}>
            <Helmet r={0.9} plume={i % 2 === 0} />
          </Dumpling>
        );
      })}
      {/* ---------------- houses (instanced) */}
      <Inst
        geo={BOXB}
        mat={MAT.houseWall}
        count={HOUSES.length}
        t={t}
        cast
        colors={houseCols}
        fill={(mesh) => {
          const c = new THREE.Color();
          HOUSES.forEach((h, i) => {
            const k = popScale(t, h.tPop);
            if (k <= 0.0005) return mesh.setMatrixAt(i, ZERO);
            let sz = 1;
            if (h.burn > 0) {
              const burnt = THREE.MathUtils.clamp((t - h.burn) / 6, 0, 1);
              c.copy(h.wall).lerp(char, burnt);
              mesh.setColorAt(i, c);
              sz = 1 - 0.78 * ss((t - COLLAPSE) / 1.2);
            }
            compose(h.x, h.y, height(h.x, h.y) - 0.05, h.rz, 2.6 * k, 2.2 * k, 1.8 * k * sz);
            mesh.setMatrixAt(i, _m);
          });
        }}
      />
      <Inst
        geo={PRISM}
        mat={MAT.houseRoof}
        count={HOUSES.length}
        t={t}
        cast
        colors={roofCols}
        fill={(mesh) => {
          const c = new THREE.Color();
          HOUSES.forEach((h, i) => {
            let k = popScale(t, h.tRoof);
            if (h.burn > 0) {
              const burnt = THREE.MathUtils.clamp((t - h.burn) / 5, 0, 1);
              c.copy(h.roof).lerp(char, burnt);
              mesh.setColorAt(i, c);
              k *= 1 - ss((t - COLLAPSE) / 0.8);
            }
            if (k <= 0.0005) return mesh.setMatrixAt(i, ZERO);
            compose(h.x, h.y, height(h.x, h.y) + 1.75 * k, h.rz, 3.1 * k, 2.7 * k, 1.2 * k);
            mesh.setMatrixAt(i, _m);
          });
        }}
      />
      <Inst
        geo={BOXB}
        mat={MAT.houseWin}
        count={HOUSES.length}
        t={t}
        fill={(mesh) => {
          HOUSES.forEach((h, i) => {
            const k = popScale(t, h.tPop + 0.2) * (h.burn > 0 && t > h.burn ? 0 : 1);
            if (k <= 0.0005) return mesh.setMatrixAt(i, ZERO);
            // front faces the village centre (local -y)
            const fx = Math.sin(h.rz) * 1.12;
            const fy = -Math.cos(h.rz) * 1.12;
            compose(h.x + fx, h.y + fy, height(h.x, h.y) + 0.7, h.rz, 0.7 * k, 0.1 * k, 0.6 * k);
            mesh.setMatrixAt(i, _m);
          });
        }}
      />
      {/* fire on the burning south houses */}
      <Inst
        geo={CONE7}
        mat={MAT.flame}
        count={HOUSES.length * 3}
        t={t}
        fill={(mesh) => {
          HOUSES.forEach((h, i) => {
            for (let j = 0; j < 3; j++) {
              const idx = i * 3 + j;
              const on = h.burn > 0 ? popScale(t, h.burn + j * 0.15) * (1 - ss((t - (COLLAPSE + 2.5)) / 2)) : 0;
              if (on <= 0.001) {
                mesh.setMatrixAt(idx, ZERO);
                continue;
              }
              const fl = 1 + 0.45 * fnoise(t * 8 + i * 3.1 + j, j + 5);
              const ox = (j - 1) * 0.8;
              const coll = 1 - 0.6 * ss((t - COLLAPSE) / 1.2);
              compose(h.x + ox * Math.cos(h.rz), h.y + ox * Math.sin(h.rz), height(h.x, h.y) + 2.2 * coll, 0, 0.55 * on, 0.55 * on, (1.6 + j * 0.3) * on * fl);
              mesh.setMatrixAt(idx, _m);
            }
          });
        }}
      />
      {/* morning smoke over the ruins */}
      <Inst
        geo={SPH1}
        mat={MAT.smoke}
        count={HOUSES.length * 3}
        t={t}
        fill={(mesh) => {
          HOUSES.forEach((h, i) => {
            for (let j = 0; j < 3; j++) {
              const idx = i * 3 + j;
              const start = COLLAPSE + 1 + ((i * 0.37 + j * 0.9) % 2.7);
              if (h.burn <= 0 || t < start || t > M2.cta[1]) {
                mesh.setMatrixAt(idx, ZERO);
                continue;
              }
              const u = ((t - start) % 3.2) / 3.2;
              const s = 0.5 + 1.6 * u;
              const fade = Math.sin(Math.PI * u);
              compose(h.x + 1.2 * u, h.y + 0.6 * u, height(h.x, h.y) + 1 + 5 * u, 0, s * fade, s * fade, s * fade * 0.8);
              mesh.setMatrixAt(idx, _m);
            }
          });
        }}
      />
      {/* ---------------- Carly's stone house (survives) */}
      <Pop t={t} t0={B.welcome + 2.6} geo={BOXB} mat={MAT.stone} pos={[CARLY[0], CARLY[1], height(CARLY[0], CARLY[1]) - 0.05]} scale={[3.6, 3.0, 2.3]} />
      <Pop t={t} t0={B.welcome + 2.75} geo={PRISM} mat={MAT.slate} pos={[CARLY[0], CARLY[1], height(CARLY[0], CARLY[1]) + 2.2]} scale={[4.1, 3.5, 1.4]} />
      <Pop t={t} t0={B.welcome + 2.9} geo={BOXB} mat={MAT.stoneDark} pos={[CARLY[0] + 1.1, CARLY[1] + 0.4, height(CARLY[0], CARLY[1]) + 2.6]} scale={[0.6, 0.6, 1.6]} />
      {/* ---------------- casino (most liked comment) */}
      <Pop t={t} t0={B.n150} geo={BOXB} mat={MAT.red} pos={[CASINO[0], CASINO[1], 0]} scale={[11, 7, 4.2]} />
      <Pop t={t} t0={B.n150 + 0.25} geo={BOXB} mat={MAT.gold} pos={[CASINO[0], CASINO[1], 4.2]} scale={[11.4, 7.4, 0.4]} />
      <Pop t={t} t0={B.n150 + 0.5} geo={BOXB} mat={MAT.cream} pos={[CASINO[0], CASINO[1] + 0.5, 4.6]} scale={[7, 5, 2.2]} />
      <Pop t={t} t0={B.n150 + 0.7} geo={BOXB} mat={MAT.gold} pos={[CASINO[0], CASINO[1] - 3.55, 0]} scale={[2.2, 0.25, 2.8]} />
      <Pop t={t} t0={B.casinoUp} geo={SPH} mat={MAT.gold} pos={[CASINO[0], CASINO[1] + 0.5, 6.8]} scale={[2.6, 2.6, 2.0]} />
      <Pop t={t} t0={B.casinoUp + 0.15} geo={BOXB} mat={MAT.neon} pos={[CASINO[0], CASINO[1] - 2.2, 6.9]} scale={[6, 0.3, 1.4]} cast={false} />
      {[-1, 1].map((sx) => (
        <Pop key={`die${sx}`} t={t} t0={B.casinoUp + 0.25} geo={BOXC} mat={MAT.white} pos={[CASINO[0] + sx * 3.4, CASINO[1] - 4.6, 0.55]} rot={E(0.3, 0.4 * sx, 0.6)} scale={[1.1, 1.1, 1.1]} />
      ))}
      <Inst
        geo={SPH1}
        mat={MAT.bulb}
        count={BULBS.length}
        t={t}
        fill={(mesh) => {
          BULBS.forEach((b, i) => {
            const chase = 0.6 + 0.4 * (Math.floor(t * 8 + i) % 3 === 0 ? 1 : 0);
            const k = bulbOn * chase;
            if (k <= 0.001) return mesh.setMatrixAt(i, ZERO);
            compose(b[0], b[1], b[2], 0, 0.18 * k, 0.18 * k, 0.18 * k);
            mesh.setMatrixAt(i, _m);
          });
        }}
      />
      {/* ---------------- north wall (40 on the north wall) */}
      {Array.from({ length: 21 }, (_, i) => {
        const deg = 40 + i * 5;
        const [x, y] = wallAt(deg);
        const rz = ((deg + 90) * Math.PI) / 180;
        const z = height(x, y) - 0.3;
        return (
          <group key={`wall${i}`}>
            <Pop t={t} t0={B.n40 + i * 0.04} geo={BOXB} mat={MAT.stone} pos={[x, y, z]} rot={E(0, 0, rz)} scale={[3.0, 1.3, 1.6]} />
            <Pop t={t} t0={B.wallUp + i * 0.02} geo={BOXB} mat={MAT.stone} pos={[x, y, z + 1.6]} rot={E(0, 0, rz)} scale={[3.0, 1.3, 1.1]} />
            <Pop t={t} t0={B.wallUp + 0.15 + i * 0.02} geo={BOXB} mat={MAT.stoneDark} pos={[x, y, z + 2.7]} rot={E(0, 0, rz)} scale={[1.2, 1.3, 0.6]} />
          </group>
        );
      })}
      {/* Iker's turret */}
      <Pop t={t} t0={B.iker} geo={CYLB} mat={MAT.stone} pos={[TURRET[0], TURRET[1], height(TURRET[0], TURRET[1]) - 0.3]} scale={[1.9, 1.9, 6]} />
      <Pop t={t} t0={B.iker + 0.2} geo={CONEB} mat={MAT.red} pos={[TURRET[0], TURRET[1], height(TURRET[0], TURRET[1]) + 5.7]} scale={[2.4, 2.4, 2.6]} />
      {/* Counterpart's cannons */}
      {CANNONS.map(([x, y], i) => (
        <group key={`can${i}`}>
          <Pop t={t} t0={B.cannons + i * 0.12} geo={BOXB} mat={MAT.wood} pos={[x, y, height(x, y) + 2.7]} scale={[1.2, 1.4, 0.5]} />
          <Pop t={t} t0={B.cannons + 0.1 + i * 0.12} geo={CYL} mat={MAT.iron} pos={[x, y + 0.6, height(x, y) + 3.5]} rot={E(-1.3, 0, 0)} scale={[0.38, 0.38, 2.4]} />
        </group>
      ))}
      {/* Avnish's telescope tower */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sy], i) => (
        <Pop key={`leg${i}`} t={t} t0={B.avnish + i * 0.05} geo={CYLB} mat={MAT.wood} pos={[TELESCOPE[0] + sx * 1.1, TELESCOPE[1] + sy * 1.1, height(TELESCOPE[0], TELESCOPE[1]) - 0.2]} scale={[0.15, 0.15, 6.2]} />
      ))}
      <Pop t={t} t0={B.avnish + 0.25} geo={BOXB} mat={MAT.wood} pos={[TELESCOPE[0], TELESCOPE[1], height(TELESCOPE[0], TELESCOPE[1]) + 6]} scale={[2.8, 2.8, 0.3]} />
      <Pop t={t} t0={B.avnish + 0.4} geo={CYL} mat={MAT.brass} pos={[TELESCOPE[0], TELESCOPE[1] + 0.6, height(TELESCOPE[0], TELESCOPE[1]) + 7.2]} rot={E(-0.9, 0, 0)} scale={[0.35, 0.35, 3.4]} />
      {/* Jordan's lab */}
      <Pop t={t} t0={B.jordan} geo={CYLB} mat={MAT.labWhite} pos={[LAB[0], LAB[1], height(LAB[0], LAB[1]) - 0.1]} scale={[3.0, 3.0, 3.0]} />
      <Pop t={t} t0={B.jordan + 0.25} geo={SPH} mat={MAT.glass} pos={[LAB[0], LAB[1], height(LAB[0], LAB[1]) + 2.9]} scale={[2.6, 2.6, 2.0]} cast={false} />
      <Pop t={t} t0={B.scientist} geo={SPH1} mat={MAT.potion} pos={[LAB[0], LAB[1], height(LAB[0], LAB[1]) + 3.7]} scale={[0.8, 0.8, 0.8]} cast={false} />
      <Pop t={t} t0={B.scientist + 0.1} geo={CYLB} mat={MAT.glass} pos={[LAB[0], LAB[1], height(LAB[0], LAB[1]) + 4.3]} scale={[0.25, 0.25, 0.8]} cast={false} />
      {/* ---------------- torches + south-side fire light */}
      {TORCHES.map((tc, i) => {
        const k = popScale(t, tc.t0) * (1 - ss((t - (B.morning + 1)) / 1));
        if (k <= 0.001) return null;
        const z = height(tc.x, tc.y);
        const fl = 1 + 0.35 * fnoise(t * 9 + i, 9);
        return (
          <group key={`torch${i}`}>
            <mesh geometry={CYLB} material={MAT.wood} position={[tc.x, tc.y, z]} scale={[0.09 * k, 0.09 * k, 2.0 * k]} castShadow />
            <mesh geometry={CONE7} material={MAT.flame} position={[tc.x, tc.y, z + 2.0 * k]} scale={[0.22 * k, 0.22 * k, 0.6 * k * fl]} />
          </group>
        );
      })}
      {fg > 0.01
        ? [
            [-13, -24],
            [0, -29],
            [13, -24],
          ].map(([x, y], i) => (
            <pointLight
              key={`fire${i}`}
              position={[x, y, 4]}
              color={lin(1.0, 0.45, 0.15)}
              intensity={((900 * fg) / (4 * Math.PI)) * (0.8 + 0.2 * fnoise(t * 6 + i, 31 + i))}
              decay={2}
              distance={40}
            />
          ))
        : null}
      {/* ---------------- chili imps */}
      <Inst
        geo={SPH}
        mat={MAT.impBody}
        count={IMPS.length}
        t={t}
        cast
        fill={(mesh) => {
          IMPS.forEach((m, i) => {
            const s = popScale(t, B.chili - 0.3 + i * 0.02) * (1 - ss((t - (B.ran + 2.4)) / 0.4));
            if (s <= 0.001) return mesh.setMatrixAt(i, ZERO);
            const [x, y, z] = impPos(m, t);
            const hop = 0.3 * Math.abs(Math.sin(t * 9 + m.ph));
            compose(x, y, z + 1.1 + hop, 0, 0.58 * s, 0.58 * s, 1.08 * s);
            mesh.setMatrixAt(i, _m);
          });
        }}
      />
      <Inst
        geo={CONE7}
        mat={MAT.impStem}
        count={IMPS.length}
        t={t}
        fill={(mesh) => {
          IMPS.forEach((m, i) => {
            const s = popScale(t, B.chili - 0.3 + i * 0.02) * (1 - ss((t - (B.ran + 2.4)) / 0.4));
            if (s <= 0.001) return mesh.setMatrixAt(i, ZERO);
            const [x, y, z] = impPos(m, t);
            const hop = 0.3 * Math.abs(Math.sin(t * 9 + m.ph));
            compose(x, y, z + 2.1 + hop, 0, 0.22 * s, 0.22 * s, 0.7 * s);
            mesh.setMatrixAt(i, _m);
          });
        }}
      />
      <Inst
        geo={SPH1}
        mat={MAT.impEye}
        count={IMPS.length * 2}
        t={t}
        fill={(mesh) => {
          IMPS.forEach((m, i) => {
            const k = popScale(t, m.tEye) * (1 - ss((t - (B.ran + 2.4)) / 0.4));
            const blink = (t + m.ph) % 2.3 < 0.1 ? 0.1 : 1;
            const [x, y, z] = impPos(m, t);
            const hop = 0.3 * Math.abs(Math.sin(t * 9 + m.ph));
            const fwd = Math.atan2(-y, -x); // facing the village
            [-1, 1].forEach((sx, j) => {
              if (k <= 0.001) return mesh.setMatrixAt(i * 2 + j, ZERO);
              const ex = x + Math.cos(fwd) * 0.5 - Math.sin(fwd) * 0.2 * sx;
              const ey = y + Math.sin(fwd) * 0.5 + Math.cos(fwd) * 0.2 * sx;
              compose(ex, ey, z + 1.5 + hop, fwd, 0.15 * k, 0.15 * k, 0.1 * k * blink);
              mesh.setMatrixAt(i * 2 + j, _m);
            });
          });
        }}
      />
      {/* ---------------- CTA ghosts: rebuild + bakery / bridge / south wall */}
      {GHOST_SPOTS.map((h, i) => {
        const k = popScale(t, B.oneFollow + i * 0.12);
        return k > 0.001 ? <mesh key={`gh${i}`} geometry={ghostGeo} material={MAT.ghost} position={[h.x, h.y, height(h.x, h.y)]} rotation={[0, 0, h.rz]} scale={k * 0.85} /> : null;
      })}
      {(() => {
        const k = popScale(t, B.bakery);
        return k > 0.001 ? (
          <group position={[BAKERY[0], BAKERY[1], height(BAKERY[0], BAKERY[1])]} scale={k}>
            <mesh geometry={ghostGeo} material={MAT.ghost} scale={1.4} />
            <mesh geometry={BOXB} material={MAT.ghost} position={[1.2, 0.6, 2.5]} scale={[0.7, 0.7, 2.2]} />
          </group>
        ) : null;
      })()}
      {(() => {
        const k = popScale(t, B.bridge);
        const x0 = riverX(BRIDGE_Y);
        return k > 0.001 ? (
          <group position={[x0, BRIDGE_Y, 0]} scale={k}>
            <mesh geometry={BOXC} material={MAT.ghost} position={[0, 0, 0.9]} scale={[17, 3.2, 0.5]} />
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={BOXC} material={MAT.ghost} position={[0, s * 1.5, 1.6]} scale={[17, 0.2, 0.9]} />
            ))}
          </group>
        ) : null;
      })()}
      {Array.from({ length: 25 }, (_, i) => {
        const deg = 210 + i * 5;
        const [x, y] = wallAt(deg);
        const k = popScale(t, B.southWall + i * 0.03);
        return k > 0.001 ? (
          <mesh key={`sw${i}`} geometry={BOXB} material={MAT.ghost} position={[x, y, height(x, y) - 0.3]} rotation={[0, 0, ((deg + 90) * Math.PI) / 180]} scale={[3.0 * k, 1.3 * k, 2.6 * k]} />
        ) : null;
      })}
      {/* ---------------- …wait. There are two of them. */}
      {GIANT_EYES.map((g, i) => {
        const k = popScale(t, g.t0);
        if (k <= 0.001) return null;
        const blink = t > g.t0 + 1.2 && t < g.t0 + 1.32 ? 0.1 : 1;
        return [-1, 1].map((sx) => (
          <mesh
            key={`ge${i}${sx}`}
            geometry={SPH}
            material={MAT.giantEye}
            position={[g.c[0] + sx * 46, g.c[1], g.c[2]]}
            rotation={[0, sx * 0.2, 0]}
            scale={[30 * k, 8 * k, 14 * k * blink]}
          />
        ));
      })}
      {/* ---------------- dust puffs */}
      <Inst
        geo={SPH1}
        mat={MAT.puff}
        count={PUFF_SPHERES.length}
        t={t}
        fill={(mesh) => {
          PUFF_SPHERES.forEach((p, i) => {
            const dt = t - p.t;
            if (dt < -0.02 || dt > 0.6) return mesh.setMatrixAt(i, ZERO);
            const l = PUFF_L.evaluate(dt);
            const s = PUFF_S.evaluate(dt) * p.rad;
            compose(p.x + p.dx * l, p.y + p.dy * l, p.z + p.dz * l, 0, s, s, s * 0.7);
            mesh.setMatrixAt(i, _m);
          });
        }}
      />
    </group>
  );
};

// puff spheres need every puff() call above -> build lazily after module init
const PUFF_SPHERES = (() => {
  const r = rng(909);
  // casino / wall / buildings pops
  puff([CASINO[0], CASINO[1] - 3.5, 0.2], B.n150 + 0.05, 10, 0.7, 4);
  puff([CASINO[0], CASINO[1], 7], B.casinoUp + 0.05, 9, 0.6, 3);
  puff([TURRET[0], TURRET[1], 0.4], B.iker + 0.05, 8, 0.5, 2);
  puff([LAB[0], LAB[1], 0.3], B.jordan + 0.05, 8, 0.5, 2.5);
  puff([TELESCOPE[0], TELESCOPE[1], 0.3], B.avnish + 0.05, 7, 0.5, 2);
  for (let i = 0; i < 21; i += 4) {
    const [x, y] = wallAt(40 + i * 5);
    puff([x, y, 0.3], B.n40 + i * 0.04 + 0.05, 5, 0.45, 1.6);
  }
  const out: { x: number; y: number; z: number; dx: number; dy: number; dz: number; rad: number; t: number }[] = [];
  for (const p of PUFFS) {
    const z0 = p.loc[2] + height(p.loc[0], p.loc[1]);
    for (let i = 0; i < p.n; i++) {
      const a = (2 * Math.PI * i) / p.n + (r() * 0.6 - 0.3);
      const d = p.spread * (0.8 + r() * 0.5);
      out.push({ x: p.loc[0], y: p.loc[1], z: z0, dx: Math.cos(a) * d, dy: Math.sin(a) * d, dz: 0.25 * d, rad: p.r * (0.7 + r() * 0.5), t: p.t });
    }
  }
  return out;
})();
