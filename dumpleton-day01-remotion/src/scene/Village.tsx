import * as THREE from "three";
import { useLayoutEffect, useMemo } from "react";
import { FCurve, FCurveN, popScale, unpopScale } from "../fcurve";
import { FPS, M, rng, T, T_CTA, T_EYES, T_HOUSE, fnoise } from "../timeline";
import { Dumpling, makeAnim } from "./Dumpling";
import { makePineGeometry, foliageMaterial, trunkMaterial } from "./Forest";
import { std } from "./materials";
import { lin } from "./world";

// ---------- shared unit geometries (Blender space, Z up)
const CYL10 = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 10);
  g.rotateX(Math.PI / 2);
  return g;
})();
const CYL24B = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 24);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, 0.5);
  return g;
})();
const CYL10B = (() => {
  const g = CYL10.clone();
  g.translate(0, 0, 0.5);
  return g;
})();
const BOXB = (() => {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0, 0.5);
  return g;
})();
const SPH = new THREE.IcosahedronGeometry(1, 3);
const SPH1 = new THREE.IcosahedronGeometry(1, 1);

// ---------- materials (scene.py colours, linear)
const MAT = {
  log: std([0.98, 0.7, 0.52], 0.35),
  log2: std([1.0, 0.82, 0.62], 0.35),
  plank: std([0.8, 0.56, 0.38], 0.8),
  door: std([0.35, 0.75, 0.62], 0.6),
  stone: std([0.75, 0.72, 0.7], 0.9, { flatShading: true }),
  bamboo: std([0.86, 0.7, 0.42], 0.7, { flatShading: true }),
  bamboo2: std([0.74, 0.56, 0.3], 0.7, { flatShading: true }),
  stump: std([0.98, 0.7, 0.52], 0.35),
  window: new THREE.MeshStandardMaterial({ color: lin(0.1, 0.08, 0.05), roughness: 0.4, emissive: lin(1.0, 0.62, 0.25), emissiveIntensity: 0 }),
  flame: new THREE.MeshStandardMaterial({ color: lin(1, 0.5, 0.1), roughness: 0.5, emissive: lin(1.0, 0.45, 0.08), emissiveIntensity: 9 }),
  ghost: new THREE.MeshStandardMaterial({
    color: lin(0.2, 1.0, 0.45),
    roughness: 0.4,
    emissive: lin(0.15, 1.0, 0.4),
    emissiveIntensity: 3,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  }),
  eye: new THREE.MeshStandardMaterial({ color: lin(1.0, 0.3, 0.2), roughness: 0.3, emissive: lin(1.0, 0.04, 0.03), emissiveIntensity: 45, flatShading: true }),
  puff: new THREE.MeshStandardMaterial({ color: lin(0.95, 0.97, 1.0), roughness: 0.9, transparent: true, opacity: 0.75, depthWrite: false, flatShading: true }),
  steam: new THREE.MeshStandardMaterial({ color: lin(1, 1, 1), roughness: 0.9, transparent: true, opacity: 0.45, depthWrite: false, flatShading: true }),
  smoke: new THREE.MeshStandardMaterial({ color: lin(0.85, 0.87, 0.92), roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false, flatShading: true }),
  flags: [
    [1, 0.55, 0.65],
    [1, 0.85, 0.4],
    [0.6, 0.9, 0.75],
    [0.75, 0.65, 1.0],
  ].map((c) => std(c as [number, number, number], 0.6, { side: THREE.DoubleSide })),
  shadowOnly: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
};

// Blender XYZ euler == three "ZYX"
const E = (x: number, y: number, z: number) => new THREE.Euler(x, y, z, "ZYX");

type PieceProps = {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  pos: [number, number, number];
  rot?: THREE.Euler;
  scale: [number, number, number];
  k: number; // pop factor
  cast?: boolean;
};
const Piece: React.FC<PieceProps> = ({ geo, mat, pos, rot, scale, k, cast = true }) => {
  if (k <= 0.0005) return null;
  return (
    <mesh
      geometry={geo}
      material={mat}
      position={pos}
      rotation={rot ?? E(0, 0, 0)}
      scale={[scale[0] * k, scale[1] * k, scale[2] * k]}
      castShadow={cast}
      receiveShadow
    />
  );
};

// ---------------------------------------------------------------------------------------------
// Cabin layout (scene.py) – computed once
// ---------------------------------------------------------------------------------------------
const CX = 0;
const CY = 2;
const W = 5.4;
const D = 4.2;
const LR = 0.2;
const LAYERS = 7;
export const H = 0.16 + LAYERS * 2 * LR * 0.92 + 0.1;
const RH = 1.9;
const SLOPE = Math.atan2(RH, W / 2);

type PuffEv = { loc: [number, number, number]; t: number; n: number; r: number; spread: number };
const PUFFS: PuffEv[] = [];
const puff = (loc: [number, number, number], t: number, n = 7, r = 0.35, spread = 1.2) => PUFFS.push({ loc, t, n, r, spread });

type Log = { pos: [number, number, number]; len: number; rot: THREE.Euler; t0: number; mat: THREE.Material };
const FLOOR: { pos: [number, number, number]; t0: number }[] = [];
for (let i = 0; i < 7; i++) {
  const y = CY - D / 2 + (D / 7) * (i + 0.5);
  const tt = T.floor + i * 0.07;
  FLOOR.push({ pos: [CX, y, 0], t0: tt });
  if (i % 3 === 0) puff([CX, y, 0.1], tt + 0.05, 5, 0.25);
}
const LOGS: Log[] = [];
for (let L = 0; L < LAYERS; L++) {
  const z = 0.16 + LR + L * 2 * LR * 0.92;
  const t0 = L < 3 ? T.walls + L * 0.32 : M.build[1] + 0.2 + (L - 3) * 1.05;
  const mat = L % 2 === 0 ? MAT.log : MAT.log2;
  const segs: [[number, number, number], number, THREE.Euler][] = [];
  segs.push([[CX, CY + D / 2, z], W + 0.6, E(0, Math.PI / 2, 0)]);
  segs.push([[CX - W / 2, CY, z], D + 0.6, E(Math.PI / 2, 0, 0)]);
  segs.push([[CX + W / 2, CY, z], D + 0.6, E(Math.PI / 2, 0, 0)]);
  if (L < 5) {
    segs.push([[CX - W / 4 - 0.3, CY - D / 2, z], W / 2 - 0.3, E(0, Math.PI / 2, 0)]);
    segs.push([[CX + W / 4 + 0.3, CY - D / 2, z], W / 2 - 0.3, E(0, Math.PI / 2, 0)]);
  } else segs.push([[CX, CY - D / 2, z], W + 0.6, E(0, Math.PI / 2, 0)]);
  segs.forEach(([loc, len, rot], j) => {
    const tt = t0 + j * 0.06;
    LOGS.push({ pos: loc, len, rot, t0: tt, mat });
    if (j === 0 || j === 3) puff([loc[0], loc[1], 0.2], tt + 0.05, 6, 0.3);
  });
}
const WINDOWS: { pos: [number, number, number]; size: [number, number, number]; t0: number }[] = [
  { pos: [CX - (W / 2 + 0.05), CY, 1.0], size: [0.12, 0.9, 0.7], t0: M.build[1] + 2.4 },
  { pos: [CX + (W / 2 + 0.05), CY, 1.0], size: [0.12, 0.9, 0.7], t0: M.build[1] + 2.7 },
  { pos: [CX + 1.6, CY + D / 2 + 0.05, 1.1], size: [0.9, 0.12, 0.7], t0: M.build[1] + 3.2 },
];
puff([CX, CY - D / 2 - 0.5, 0.1], T.door + 0.05);
const RAFTERS: Log[] = [];
for (let k = 0; k < 5; k++) {
  const yy = CY - D / 2 - 0.3 + (k * (D + 0.6)) / 4;
  for (const sx of [-1, 1]) {
    RAFTERS.push({
      pos: [CX + sx * (W / 4 + 0.15), yy, H + RH / 2],
      len: Math.hypot(W / 2 + 0.5, RH),
      rot: E(0, sx * (Math.PI / 2 - SLOPE), 0),
      t0: T.beam + 0.25 + k * 0.08 + (sx > 0 ? 0.04 : 0),
      mat: MAT.log,
    });
  }
}
// roof panels
const ROOF: { geo: THREE.BufferGeometry; pos: [number, number, number]; t0: number }[] = [];
{
  const r = rng(77);
  const top = lin(1.0, 0.72, 0.78);
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const f0 = i / 4;
      const f1 = (i + 1) / 4;
      const x0 = CX + sx * (W / 2 + 0.6) * (1 - f0);
      const z0 = H - 0.25 + (RH + 0.25) * f0;
      const x1 = CX + sx * (W / 2 + 0.6) * (1 - f1);
      const z1 = H - 0.25 + (RH + 0.25) * f1;
      const y0 = CY - D / 2 - 0.6;
      const y1 = CY + D / 2 + 0.6;
      const b = [
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z1],
        [x1, y0, z1],
      ];
      const tq = b.map(([x, y, z]) => [x, y, z + 0.18]);
      const all = [...b, ...tq];
      const c = all.reduce((a, v) => [a[0] + v[0] / 8, a[1] + v[1] / 8, a[2] + v[2] / 8], [0, 0, 0]);
      const P = all.map(([x, y, z]) => new THREE.Vector3(x - c[0], y - c[1], z - c[2]));
      const quads = [
        [4, 5, 6, 7],
        [3, 2, 1, 0],
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
      ];
      const pos: number[] = [];
      for (const q of quads) {
        const tri = [q[0], q[1], q[2], q[0], q[2], q[3]];
        for (const ix of tri) pos.push(P[ix].x, P[ix].y, P[ix].z);
      }
      let g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      // fix winding so normals point outward (from centre)
      const n = g.attributes.normal;
      const p = g.attributes.position;
      for (let f = 0; f < p.count; f += 3) {
        const cx = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3;
        const cy = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
        const cz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3;
        if (cx * n.getX(f) + cy * n.getY(f) + cz * n.getZ(f) < 0) {
          // swap vertices 1 and 2
          for (const a of [0, 1, 2]) {
            const t1 = [p.getX(f + 1), p.getY(f + 1), p.getZ(f + 1)][a];
            const t2 = [p.getX(f + 2), p.getY(f + 2), p.getZ(f + 2)][a];
            p.setComponent(f + 1, a, t2);
            p.setComponent(f + 2, a, t1);
          }
        }
      }
      g = g.toNonIndexed();
      g.computeVertexNormals();
      const base = lin(0.98, 0.32, 0.48).lerp(lin(1.0, 0.42, 0.58), r());
      const col = new Float32Array(g.attributes.position.count * 3);
      const nn = g.attributes.normal;
      const cc = new THREE.Color();
      for (let v = 0; v < nn.count; v++) {
        const k = THREE.MathUtils.smoothstep(nn.getZ(v) + 0.175, 0.8, 0.92);
        cc.copy(base).lerp(top, k);
        col.set([cc.r, cc.g, cc.b], v * 3);
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const t0 = i < 2 ? T.plank + i * 0.12 + (sx > 0 ? 0.05 : 0) : T.roof + (i - 2) * 0.12 + (sx > 0 ? 0.05 : 0);
      ROOF.push({ geo: g, pos: [c[0], c[1], c[2]], t0 });
    }
  }
}
const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3 });
puff([CX, CY, H + RH], T.roof + 0.3, 9, 0.5, 2.5);
for (const sx of [-1, 1]) puff([CX + sx * (W / 2 + 0.8), CY, 0.2], T.roof + 0.35, 7, 0.4, 1.8);
const PILE = Array.from({ length: 5 }, (_, i) => ({
  pos: [-6 + (i % 3) * 0.46 + (i >= 3 ? 0.23 : 0), 4, 0.22 + (i >= 3 ? 0.38 : 0)] as [number, number, number],
  t0: T.log + i * 0.1,
}));
puff([-6, 4, 0.1], T.log + 0.1, 7, 0.35, 1.5);
puff([1.5, 10, 0.2], T.tree + 0.45, 10, 0.6, 3.0);

// felled tree
const fellRotY = new FCurve(
  [
    [T.tree - 0.3, 0],
    [T.tree + 0.45, -1.45],
  ],
  "QUAD_IN",
);
const fellScale = new FCurve([
  [T.log - 0.2, 1],
  [T.log + 0.05, 0],
]);

// campfire
const FX = 0;
const FY = -3.6;
const STONES = Array.from({ length: 9 }, (_, i) => {
  const a = (i / 9) * 2 * Math.PI;
  return { pos: [FX + 0.75 * Math.cos(a), FY + 0.75 * Math.sin(a), 0.08] as [number, number, number], t0: T.door + 0.3 + i * 0.03 };
});
const FLAMES = (() => {
  const r = rng(91);
  return Array.from({ length: 4 }, (_, i) => {
    const g = new THREE.ConeGeometry(0.32 - i * 0.04, 0.9 - i * 0.1, 7);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, (0.9 - i * 0.1) / 2);
    return { geo: g, pos: [FX + (r() * 0.3 - 0.15), FY + (r() * 0.3 - 0.15), 0.05] as [number, number, number], seed: i * 13 };
  });
})();
const fireEnergy = new FCurve([
  [T.fire - 0.05, 0],
  [T.fire + 0.3, 450],
]);
export const fireLightW = (t: number) => {
  let e = fireEnergy.evaluate(t);
  if (t > T.fire + 0.3) e += 80 * 0.5 * fnoise((t * FPS) / 2, 3);
  return Math.max(0, e);
};

// steamer
const STEAMER = [0, 1, 2].map((k) => ({ pos: [1.9, -3.6, k * 0.34] as [number, number, number], t0: T.fire + 0.25 + k * 0.12, mat: k % 2 === 0 ? MAT.bamboo : MAT.bamboo2 }));

// windows glow
const winGlow = new FCurve([
  [0, 0],
  [M.sunset[0], 0],
  [M.sunset[1] + 0.5, 25],
  [M.morning[0] + 1.0, 25],
  [M.morning[1], 3],
]);

// ghost houses
const ghostGeo = (() => {
  const box = new THREE.BoxGeometry(3.0, 2.4, 1.8);
  box.translate(0, 0, 0.9);
  const v = [
    [-1.8, -1.5, 1.8],
    [1.8, -1.5, 1.8],
    [0, -1.5, 3.0],
    [-1.8, 1.5, 1.8],
    [1.8, 1.5, 1.8],
    [0, 1.5, 3.0],
  ];
  const tris = [
    [0, 1, 2],
    [5, 4, 3],
    [0, 2, 5],
    [0, 5, 3],
    [1, 4, 5],
    [1, 5, 2],
  ];
  const pos: number[] = [];
  for (const t of tris) for (const i of t) pos.push(...v[i]);
  const roof = new THREE.BufferGeometry();
  roof.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  roof.computeVertexNormals();
  const nb = box.toNonIndexed();
  nb.deleteAttribute("uv");
  const merged = new THREE.BufferGeometry();
  const a = new Float32Array([...(nb.attributes.position.array as Float32Array), ...pos]);
  merged.setAttribute("position", new THREE.BufferAttribute(a, 3));
  merged.computeVertexNormals();
  return merged;
})();
export const CTA_POS: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + ((i - 6.5) / 14) * 2 * Math.PI * 0.92;
    let r = 10.0 + (i % 2) * 2.8;
    let x = r * Math.cos(a);
    let y = r * Math.sin(a);
    if (Math.hypot(x - FX, y - FY) < 4.5 || Math.hypot(x + 6, y - 4) < 3 || Math.hypot(x - 6, y - 10) < 2.5) {
      r += 3;
      x = r * Math.cos(a);
      y = r * Math.sin(a);
    }
    out.push([x, y]);
  }
  return out;
})();

// crowd
const DCOL: [number, number, number][] = [
  [1.0, 0.93, 0.82],
  [1.0, 0.62, 0.7],
  [1.0, 0.85, 0.4],
  [0.78, 0.68, 0.98],
  [0.58, 0.92, 0.76],
];
const CROWD = (() => {
  const r = rng(303);
  return Array.from({ length: 36 }, (_, i) => {
    const color = i % 5 ? DCOL[1 + (i % 4)] : DCOL[i % 5];
    const rad = Math.round((0.85 + r() * 0.15) * 100) / 100;
    const [gx, gy] = CTA_POS[i % 14];
    const tx = gx * 0.75 + (r() * 3 - 1.5);
    const ty = gy * 0.75 + (r() * 3 - 1.5);
    const ts0 = T_CTA + 0.4 + i * 0.12;
    const x0 = r() * 4 - 2;
    const path = new FCurveN([
      [0, [x0, -42]],
      [ts0, [x0, -42]],
      [ts0 + 2.0, [tx * 0.3, -16]],
      [ts0 + 3.6, [tx, ty]],
    ]);
    const sc = new FCurve([
      [0, 0],
      [ts0 - 0.01, 0],
      [ts0 + 0.2, 1],
    ]);
    return { color, rad, path, sc, anim: makeAnim(500 + i) };
  });
})();

// Mayor Bao path (scene.py `path`)
const BAO_PATH = new FCurveN(
  (
    [
      [0, [-3, -5.5]],
      [M.premise[0], [-3, -5.5]],
      [T.tree - 1.6, [5.2, -2.0]],
      [T.tree - 0.5, [4.6, 8.4]],
      [T.tree + 0.6, [4.6, 8.4]],
      [T.log - 0.1, [-0.5, 7.2]],
      [T.log + 0.4, [-4.6, 5.6]],
      [T.floor - 0.2, [-4.9, 1.0]],
      [T.walls + 0.8, [-4.9, -1.6]],
      [T.door + 0.2, [-1.6, -2.4]],
      [T.fire - 0.2, [-1.6, -5.2]],
      [M.build[1] + 1.0, [-4.6, 5.0]],
      [M.build[1] + 2.6, [-4.9, 1.0]],
      [M.build[1] + 4.2, [-1.6, -5.4]],
      [M.eyes[0], [-1.6, -5.4]],
      [M.roof[0], [-1.6, -5.4]],
      [T.roof + 0.2, [-1.0, -5.6]],
      [M.steps[0], [-1.0, -5.6]],
      [M.morning[0] + 1.0, [-1.0, -5.6]],
      [M.morning[0] + 2.5, [1.2, -6.0]],
    ] as [number, number[]][]
  ).map(([t, v]) => [t, v]),
);
export const baoPos = (t: number) => BAO_PATH.evaluate(t);
const BAO_ANIM = makeAnim(42);

// hungry eyes
const EYES = (() => {
  const P: [number, number, number][] = [
    [22, 14.6, 1.5],
    [51, 13.8, 2.3],
    [63, 14.9, 1.3],
    [97, 14.2, 2.0],
    [108, 15.0, 3.0],
    [139, 13.9, 1.6],
    [171, 14.7, 2.4],
    [-12, 14.4, 1.8],
    [200, 14.8, 1.5],
  ];
  return P.map(([d, r, z], i) => {
    const x = r * Math.cos((d * Math.PI) / 180);
    const y = r * Math.sin((d * Math.PI) / 180);
    const ang = Math.atan2(-y, -x);
    const ts = T_EYES - 0.5 + i * 0.25;
    const zs = new FCurve([
      [0, 0],
      [ts, 0],
      [ts + 0.2, 0.6],
      [ts + 1.6, 0.6],
      [ts + 1.7, 0.05],
      [ts + 1.82, 0.6],
      [M.steps[1] + 0.5, 0.6],
      [M.steps[1] + 0.8, 0],
    ]);
    const xs = new FCurve([
      [0, 0],
      [ts, 0],
      [ts + 0.2, 1],
      [M.steps[1] + 0.5, 1],
      [M.steps[1] + 0.8, 0],
    ]);
    const mv = new FCurve([
      [ts, 0],
      [M.steps[1], 1],
    ]);
    return { x, y, z, ang, zs, xs, mv, light: i % 2 === 0 };
  });
})();
const eyeEnergy = new FCurve([
  [T_EYES - 0.6, 0],
  [T_EYES + 0.4, 350],
  [M.steps[1] + 0.4, 350],
  [M.steps[1] + 0.8, 0],
]);

// giant (invisible chopstick hand that only casts a shadow)
const t1 = M.threat[0] + 0.4;
const t2 = M.steps[0] + 0.5;
const giantX = new FCurve(
  [
    [t1, -160],
    [t1 + 3.2, 160],
    [t1 + 3.3, 400],
    [t2 - 0.1, -160],
    [t2 + 3.4, 160],
    [t2 + 3.5, 400],
  ],
  "LINEAR",
);
const giantY = new FCurve(
  [
    [t1, 10],
    [t1 + 3.2, 10],
    [t1 + 3.3, 10],
    [t2 - 0.1, -5],
    [t2 + 3.4, -5],
    [t2 + 3.5, 10],
  ],
  "LINEAR",
);

// ---------------------------------------------------------------------------------------------
// Puffs / steam / smoke: one instanced mesh each, transforms updated per frame
// ---------------------------------------------------------------------------------------------
const PUFF_L = new FCurve([
  [0, 0],
  [0.55, 1],
]);
const PUFF_SXY = new FCurve([
  [-0.02, 0],
  [0.06, 1],
  [0.3, 1.6],
  [0.6, 0],
]);
const PUFF_SZ = new FCurve([
  [-0.02, 0],
  [0.06, 1],
  [0.3, 1.0],
  [0.6, 0],
]);
type PuffSphere = { loc: THREE.Vector3; d: THREE.Vector3; rad: number; t: number };
const PUFF_SPHERES: PuffSphere[] = (() => {
  const r = rng(808);
  const out: PuffSphere[] = [];
  for (const p of PUFFS) {
    for (let i = 0; i < p.n; i++) {
      const a = (2 * Math.PI * i) / p.n + (r() * 0.6 - 0.3);
      const rad = p.r * (0.7 + r() * 0.5);
      const dd = p.spread * (0.8 + r() * 0.5);
      out.push({ loc: new THREE.Vector3(...p.loc), d: new THREE.Vector3(Math.cos(a), Math.sin(a), 0.25).multiplyScalar(dd), rad, t: p.t });
    }
  }
  return out;
})();
const STEAM_S = new FCurve([
  [0, 0],
  [0.4, 1],
  [2.8, 2.4],
  [3.5, 0],
]);
const STEAM_SZ = new FCurve([
  [0, 0],
  [0.4, 1],
  [2.8, 2.0],
  [3.5, 0],
]);
const SMOKE_S = new FCurve([
  [0, 0],
  [0.4, 1],
  [3.5, 3.2],
  [4.5, 0],
]);
const SMOKE_SZ = new FCurve([
  [0, 0],
  [0.4, 1],
  [3.5, 2.6],
  [4.5, 0],
]);
const MOVE35 = new FCurve([
  [0, 0],
  [3.5, 1],
]);
const MOVE45 = new FCurve([
  [0, 0],
  [4.5, 1],
]);

const InstancedSpheres: React.FC<{ count: number; mat: THREE.Material; geo: THREE.BufferGeometry; fill: (m: THREE.InstancedMesh) => void; deps: unknown[] }> = ({
  count,
  mat,
  geo,
  fill,
  deps,
}) => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = true;
    return m;
  }, [count, mat, geo]);
  useLayoutEffect(() => {
    fill(mesh);
    mesh.instanceMatrix.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh, ...deps]);
  return <primitive object={mesh} />;
};

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export type VillageOpts = {
  hideBao?: boolean;
  hideCrowd?: boolean;
  hideGhosts?: boolean;
  hideEyes?: boolean;
  hideGiant?: boolean;
  windowGlow?: number; // override of the window emission
  fireT?: number; // time used for fire/flame flicker (Day 02 keeps the Day 01 end state alive)
};
export const Village: React.FC<{ t: number; night: number } & VillageOpts> = ({ t, hideBao, hideCrowd, hideGhosts, hideEyes, hideGiant, windowGlow, fireT }) => {
  const tf = fireT ?? t;
  const m4 = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();
  const bao = baoPos(t);
  const winI = windowGlow ?? winGlow.evaluate(t);
  MAT.window.emissiveIntensity = winI;

  // felled tree
  const fs = t < T.log - 0.2 ? 1 : fellScale.evaluate(t);
  const fry = t < T.tree - 0.3 ? 0 : fellRotY.evaluate(t);

  // giant shadow caster position
  const gx = giantX.evaluate(t);
  const gy = giantY.evaluate(t);

  return (
    <group>
      {/* floor */}
      {FLOOR.map((f, i) => (
        <Piece key={`f${i}`} geo={BOXB} mat={MAT.plank} pos={f.pos} scale={[W + 0.4, (D / 7) * 0.95, 0.16]} k={popScale(t, f.t0)} />
      ))}
      {LOGS.map((l, i) => (
        <Piece key={`l${i}`} geo={CYL10} mat={l.mat} pos={l.pos} rot={l.rot} scale={[LR, LR, l.len]} k={popScale(t, l.t0)} />
      ))}
      {WINDOWS.map((w, i) => (
        <Piece key={`w${i}`} geo={BOXB} mat={MAT.window} pos={w.pos} scale={w.size} k={popScale(t, w.t0)} />
      ))}
      <Piece geo={BOXB} mat={MAT.door} pos={[CX, CY - D / 2, 0.16]} scale={[1.15, 0.14, 1.9]} k={popScale(t, T.door)} />
      <Piece geo={CYL10} mat={MAT.log2} pos={[CX, CY, H + RH]} rot={E(Math.PI / 2, 0, 0)} scale={[0.22, 0.22, D + 1.4]} k={popScale(t, T.beam)} />
      {RAFTERS.map((r, i) => (
        <Piece key={`r${i}`} geo={CYL10} mat={r.mat} pos={r.pos} rot={r.rot} scale={[0.13, 0.13, r.len]} k={popScale(t, r.t0) * unpopScale(t, T.roof + 0.35)} />
      ))}
      {ROOF.map((r, i) => (
        <Piece key={`rf${i}`} geo={r.geo} mat={roofMat} pos={r.pos} scale={[1, 1, 1]} k={popScale(t, r.t0)} />
      ))}
      <Piece geo={BOXB} mat={MAT.stone} pos={[CX + 1.5, CY + 1.2, H + 0.6]} scale={[0.8, 0.8, 2.2]} k={popScale(t, T.roof + 0.45)} />
      {PILE.map((p, i) => (
        <Piece key={`p${i}`} geo={CYL10} mat={MAT.log2} pos={p.pos} rot={E(0, Math.PI / 2, Math.PI / 2)} scale={[0.22, 0.22, 1.8]} k={popScale(t, p.t0)} />
      ))}
      {/* felled tree + stump */}
      {fs > 0.001 ? (
        <mesh
          geometry={makePineGeometry(0, 3)}
          material={[foliageMaterial(0, false), trunkMaterial]}
          position={[6, 10, 0]}
          rotation={E(0, fry, 0.3)}
          scale={fs}
          castShadow
          receiveShadow
        />
      ) : null}
      <mesh geometry={CYL10B} material={MAT.stump} position={[6, 10, 0]} scale={[0.35, 0.35, 0.4]} castShadow receiveShadow />
      {/* campfire */}
      {STONES.map((s, i) => (
        <Piece key={`s${i}`} geo={SPH1} mat={MAT.stone} pos={s.pos} scale={[0.22, 0.22, 0.22]} k={popScale(t, s.t0)} />
      ))}
      {FLAMES.map((f, i) => {
        const k = popScale(t, T.fire);
        const fl = t > T.fire ? 1 + 0.8 * 0.5 * fnoise((tf * FPS) / 3, f.seed) : 1;
        return k > 0.0005 ? <mesh key={`fl${i}`} geometry={f.geo} material={MAT.flame} position={f.pos} scale={[k, k, k * fl]} /> : null;
      })}
      {STEAMER.map((s, i) => (
        <Piece key={`st${i}`} geo={CYL24B} mat={s.mat} pos={s.pos} scale={[0.85, 0.85, 0.32]} k={popScale(t, s.t0)} />
      ))}
      <Piece geo={SPH} mat={MAT.bamboo2} pos={[1.9, -3.6, 1.0]} scale={[0.85, 0.85, 0.85]} k={popScale(t, T.fire + 0.7)} />
      {/* sign "POPULATION: 0" */}
      <mesh geometry={CYL10B} material={MAT.plank} position={[-7, -11, 0]} scale={[0.1, 0.1, 1.6]} castShadow />
      <mesh geometry={BOXB} material={MAT.plank} position={[-7, -11.1, 1.1]} rotation={[-0.6, 0, 0]} scale={[2.4, 0.15, 1.0]} castShadow />
      {/* bunting */}
      {[-5, 5].map((px) => (
        <Piece key={`pole${px}`} geo={CYL10B} mat={MAT.plank} pos={[px, -8, 0]} scale={[0.08, 0.08, 3.2]} k={popScale(t, T.roof + 0.8)} />
      ))}
      {Array.from({ length: 11 }, (_, i) => {
        const u = i / 10;
        const k = popScale(t, T.roof + 0.9 + i * 0.05);
        return k > 0.0005 ? (
          <mesh key={`flag${i}`} geometry={FLAG} material={MAT.flags[i % 4]} position={[-5 + 10 * u, -8, 3.0 - 0.9 * Math.sin(Math.PI * u)]} rotation={[0.9, 0, 0]} scale={k} />
        ) : null;
      })}
      {/* ghost houses */}
      {!hideGhosts && (() => {
        const k = popScale(t, T_HOUSE - 0.1) * unpopScale(t, M.threat[0] - 0.4);
        return k > 0.0005 ? <mesh geometry={ghostGeo} material={MAT.ghost} position={[9, -7, 0]} rotation={[0, 0, 0.4]} scale={k} /> : null;
      })()}
      {!hideGhosts && CTA_POS.map(([x, y], i) => {
        const k = popScale(t, T_CTA + 0.15 * i);
        return k > 0.0005 ? <mesh key={`g${i}`} geometry={ghostGeo} material={MAT.ghost} position={[x, y, 0]} rotation={[0, 0, Math.atan2(y, x) + Math.PI / 2]} scale={k} /> : null;
      })}
      {/* crowd */}
      {!hideCrowd && CROWD.map((c, i) => {
        const s = c.sc.evaluate(t);
        if (s <= 0.001) return null;
        const [x, y] = c.path.evaluate(t);
        return <Dumpling key={`c${i}`} t={t} color={c.color} r={c.rad} anim={c.anim} position={[x, y, 0]} scale={s} />;
      })}
      {/* Mayor Bao */}
      {!hideBao && <Dumpling t={t} color={[1.0, 0.8, 0.52]} r={1.4} hat anim={BAO_ANIM} position={[bao[0], bao[1], 0]} shake />}
      {/* hungry eyes */}
      {!hideEyes && EYES.map((e, i) => {
        const zs = e.zs.evaluate(t);
        const xs = e.xs.evaluate(t);
        if (xs <= 0.001) return null;
        const mv = e.mv.evaluate(t);
        const f = 1 - 0.1 * mv;
        return [-1, 1].map((sx) => {
          const ox = -Math.sin(e.ang) * 0.42 * sx;
          const oy = Math.cos(e.ang) * 0.42 * sx;
          return (
            <mesh key={`e${i}${sx}`} geometry={SPH1} material={MAT.eye} position={[e.x * f + ox, e.y * f + oy, e.z]} rotation={[0, 0, e.ang]} scale={[0.27 * xs, 0.27 * xs, 0.27 * zs]} />
          );
        });
      })}
      {!hideEyes && EYES.filter((e) => e.light).map((e, i) => {
        const w = eyeEnergy.evaluate(t);
        return w > 0.5 ? (
          <pointLight key={`el${i}`} position={[e.x * 0.95, e.y * 0.95, e.z + 0.5]} color={lin(1.0, 0.15, 0.08)} intensity={(w / (4 * Math.PI)) * 0.3} decay={2} distance={22} />
        ) : null;
      })}
      {/* fire light (450 W point) */}
      <pointLight position={[FX, FY, 1.2]} color={lin(1.0, 0.55, 0.2)} intensity={(fireLightW(tf) / (4 * Math.PI)) * 0.45} decay={2} distance={0} />
      {/* giant chopstick hand: shadow only */}
      <group position={[gx, gy, 70]} visible={!hideGiant}>
        {[-1, 1].map((sx) => (
          <mesh key={sx} geometry={BOX_C} material={MAT.shadowOnly} position={[sx * 9, 0, 0]} rotation={[0, 0, sx * 0.06]} scale={[3.2, 150, 3.0]} castShadow />
        ))}
        <mesh geometry={SPH} material={MAT.shadowOnly} position={[0, 80, 0]} scale={[30, 26, 6]} castShadow />
      </group>
      {/* puffs */}
      <InstancedSpheres
        count={PUFF_SPHERES.length}
        mat={MAT.puff}
        geo={SPH1}
        deps={[t]}
        fill={(mesh) => {
          PUFF_SPHERES.forEach((p, i) => {
            const dt = t - p.t;
            if (dt < -0.02 || dt > 0.6) return mesh.setMatrixAt(i, ZERO);
            const l = PUFF_L.evaluate(dt);
            const sxy = PUFF_SXY.evaluate(dt) * p.rad;
            const sz = PUFF_SZ.evaluate(dt) * p.rad;
            m4.compose(p.loc.clone().addScaledVector(p.d, l), q0, new THREE.Vector3(sxy, sxy, sz));
            mesh.setMatrixAt(i, m4);
          });
        }}
      />
      <InstancedSpheres
        count={30}
        mat={MAT.steam}
        geo={SPH1}
        deps={[t]}
        fill={(mesh) => {
          for (let i = 0; i < 30; i++) {
            const dt = t - (T.fire + 1.0 + i * 1.3);
            if (dt < 0 || dt > 3.5) {
              mesh.setMatrixAt(i, ZERO);
              continue;
            }
            const l = MOVE35.evaluate(dt);
            const s = STEAM_S.evaluate(dt) * 0.3;
            const sz = STEAM_SZ.evaluate(dt) * 0.3;
            m4.compose(new THREE.Vector3(1.9 + 1.5 * l, -3.6 + 0.8 * l, 1.2 + 4.3 * l), q0, new THREE.Vector3(s, s, sz));
            mesh.setMatrixAt(i, m4);
          }
        }}
      />
      <InstancedSpheres
        count={16}
        mat={MAT.smoke}
        geo={SPH1}
        deps={[t]}
        fill={(mesh) => {
          for (let i = 0; i < 16; i++) {
            const dt = t - (M.steps[0] + 4 + i * 0.75);
            if (dt < 0 || dt > 4.5) {
              mesh.setMatrixAt(i, ZERO);
              continue;
            }
            const l = MOVE45.evaluate(dt);
            const s = SMOKE_S.evaluate(dt) * 0.35;
            const sz = SMOKE_SZ.evaluate(dt) * 0.35;
            m4.compose(new THREE.Vector3(CX + 1.5 + 3 * l, CY + 1.2 + 1.5 * l, H + 2.9 + 5.1 * l), q0, new THREE.Vector3(s, s, sz));
            mesh.setMatrixAt(i, m4);
          }
        }}
      />
    </group>
  );
};

const FLAG = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-0.3, 0, 0, 0.3, 0, 0, 0, 0, -0.55], 3));
  g.computeVertexNormals();
  return g;
})();
const BOX_C = new THREE.BoxGeometry(1, 1, 1);
