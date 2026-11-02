import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useLayoutEffect, useMemo } from "react";
import { rng } from "../timeline";
import { CLEAR_R, height, lin, noiseFac, riverX, treeOk } from "./world";
import { bakeTop, std, topMixMaterial } from "./materials";

// ---------------------------------------------------------------------------------------------
// "Puff pine" prototypes (scene.py make_pine): trunk cone + 3–4 squashed icospheres.
// ---------------------------------------------------------------------------------------------
type Proto = { tiers: number; h: number; r: number; cls: 0 | 1 | 2 }; // cls 0 pine, 1 ochre, 2 autumn
export const PROTOS: Proto[] = [
  { tiers: 4, h: 6.0, r: 2.0, cls: 0 }, // treeA
  { tiers: 3, h: 5.0, r: 1.8, cls: 0 }, // treeB
  { tiers: 4, h: 6.5, r: 2.1, cls: 1 }, // treeC (ochre/teal_m)
  { tiers: 4, h: 5.5, r: 2.0, cls: 2 }, // blossom (larch_m)
];
export const variant = (u: number) => (u < 0.17 ? 3 : u < 0.26 ? 2 : u < 0.62 ? 1 : 0);

const smoothIco = (radius: number, detail: number) => {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  // smooth normals even for detail 0
  const p = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
};

const geoCache = new Map<string, THREE.BufferGeometry>();
/** Build a tree prototype geometry. groups: 0 = foliage, 1 = trunk (unless withTrunk=false). */
export const makePineGeometry = (protoIndex: number, detail: number, withTrunk = true) => {
  const key = `${protoIndex}-${detail}-${withTrunk}`;
  const cached = geoCache.get(key);
  if (cached) return cached;
  const { tiers, h, r } = PROTOS[protoIndex];
  const rnd = rng(100 + protoIndex);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < tiers; i++) {
    const a = i * 2.4;
    const rr = i ? r * (0.6 + rnd() * 0.25) : r * 0.9;
    const cz = h * 0.62 + (i === 0 ? 0.15 * h : (-0.1 + rnd() * 0.15) * h);
    const cx = Math.cos(a) * r * 0.45 * (i > 0 ? 1 : 0);
    const cy = Math.sin(a) * r * 0.45 * (i > 0 ? 1 : 0);
    const g = smoothIco(rr, detail);
    g.scale(1, 1, 0.85);
    // analytic normals of the squashed (ellipsoid) sphere, keeps smooth shading on non-indexed geometry
    {
      const p = g.attributes.position;
      const n = g.attributes.normal;
      const v = new THREE.Vector3();
      for (let k = 0; k < p.count; k++) {
        v.set(p.getX(k), p.getY(k), p.getZ(k) / (0.85 * 0.85)).normalize();
        n.setXYZ(k, v.x, v.y, v.z);
      }
    }
    g.translate(cx, cy, cz);
    g.deleteAttribute("uv");
    parts.push(g);
  }
  let fol = mergeGeometries(parts)!;
  // per-vertex "top" factor (normal.z + 0.35*noise > 0.88)
  fol = bakeTop(fol, 0.88, (x, y, z) => noiseFac(x + 3.1 * protoIndex, y, z), 3 / (2 * r));
  if (!withTrunk) {
    geoCache.set(key, fol);
    return fol;
  }
  const tr = new THREE.CylinderGeometry((0.16 * r) / 2.2, (0.22 * r) / 2.2, h * 0.45, 7, 1, false);
  tr.rotateX(Math.PI / 2);
  tr.translate(0, 0, h * 0.225);
  tr.deleteAttribute("uv");
  tr.setAttribute("aTop", new THREE.BufferAttribute(new Float32Array(tr.attributes.position.count), 1));
  const ntr = tr.index ? tr.toNonIndexed() : tr;
  const nfol = fol.index ? fol.toNonIndexed() : fol;
  const merged = mergeGeometries([nfol, ntr], true)!;
  geoCache.set(key, merged);
  return merged;
};

// palette (ramp_cols, constant interpolation) + top colours, linear
const RAMPS: [number, number, number][][] = [
  [
    [0.025, 0.14, 0.04],
    [0.04, 0.2, 0.06],
    [0.07, 0.27, 0.05],
    [0.03, 0.17, 0.09],
    [0.05, 0.22, 0.03],
  ],
  [
    [0.4, 0.36, 0.04],
    [0.25, 0.3, 0.04],
    [0.55, 0.4, 0.03],
  ],
  [
    [0.55, 0.1, 0.02],
    [0.72, 0.22, 0.02],
    [0.7, 0.42, 0.04],
    [0.45, 0.07, 0.03],
    [0.85, 0.55, 0.08],
    [0.95, 0.45, 0.55],
  ],
];
const TOPS: [number, number, number][] = [
  [0.16, 0.42, 0.08],
  [0.55, 0.55, 0.08],
  [0.95, 0.45, 0.08],
];

const materialCache = new Map<string, THREE.Material>();
export const foliageMaterial = (cls: number, shake: boolean) => {
  const key = `${cls}-${shake}`;
  let m = materialCache.get(key);
  if (!m) {
    m = topMixMaterial(lin(...TOPS[cls]), { color: 0xffffff, roughness: 0.6 }, shake);
    materialCache.set(key, m);
  }
  return m;
};
export const trunkMaterial = std([0.45, 0.28, 0.18], 0.8);
export const treeColor = (cls: number, u: number) => {
  const ramp = RAMPS[cls];
  return lin(...ramp[Math.min(ramp.length - 1, Math.floor(u * ramp.length))]);
};

// ---------------------------------------------------------------------------------------------
// Scatter (scene.py): 2.6 m jittered grid to r=300 + 9000 sparse to 700; ring r<40 = shakeable.
// ---------------------------------------------------------------------------------------------
type Tree = { x: number; y: number; z: number; v: number; rz: number; s: number; cu: number; ph: number };
const buildScatter = () => {
  const r = rng(7);
  const cell = 2.6;
  const ring: Tree[] = [];
  const pts: Tree[] = [];
  const n = Math.floor(300 / cell);
  for (let gx = -n; gx < n; gx++) {
    for (let gy = -n; gy < n; gy++) {
      const x = gx * cell + (r() * 2.8 - 1.4);
      const y = gy * cell + (r() * 2.8 - 1.4);
      const rr = Math.hypot(x, y);
      const v = variant(r());
      const rz = r() * 6.28;
      const cu = r();
      const ph = r() * 100;
      if (rr > 300 || !treeOk(x, y, CLEAR_R + 1.5)) continue;
      if (rr < 40) {
        const s = 0.8 + r() * 0.5;
        ring.push({ x, y, z: height(x, y) - 0.2, v, rz, s, cu, ph });
      } else {
        const s = 0.75 + r() * 0.55;
        pts.push({ x, y, z: height(x, y) - 0.2, v, rz, s, cu, ph });
      }
    }
  }
  for (let i = 0; i < 9000; i++) {
    const a = r() * Math.PI * 2;
    const rr = 300 + r() * 400;
    const x = rr * Math.cos(a);
    const y = rr * Math.sin(a);
    const v = variant(r());
    const s = 0.75 + r() * 0.55;
    if (treeOk(x, y, 0)) pts.push({ x, y, z: height(x, y) - 0.2, v, rz: r() * 6.28, s, cu: r(), ph: 0 });
  }
  return { ring, pts };
};
let SCATTER: ReturnType<typeof buildScatter> | null = null;
export const getScatter = () => (SCATTER ??= buildScatter());

type Batch = { key: string; geo: THREE.BufferGeometry; mats: THREE.Material | THREE.Material[]; trees: Tree[]; shadow: boolean; shake: boolean };

const TreeBatch: React.FC<{ b: Batch; shakeAmp: number; time: number }> = ({ b, shakeAmp, time }) => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(b.geo, b.mats, b.trees.length);
    const mat = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const ph = new Float32Array(b.trees.length);
    b.trees.forEach((t, i) => {
      q.setFromEuler(e.set(0, 0, t.rz));
      mat.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      m.setMatrixAt(i, mat);
      m.setColorAt(i, treeColor(PROTOS[t.v].cls, t.cu));
      ph[i] = t.ph;
    });
    if (b.shake) b.geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(ph, 1));
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    m.castShadow = b.shadow;
    m.receiveShadow = true;
    return m;
  }, [b]);
  useLayoutEffect(() => {
    if (!b.shake) return;
    const mats = Array.isArray(b.mats) ? b.mats : [b.mats];
    for (const mm of mats) {
      const u = mm.userData.uniforms;
      if (u) {
        u.uShake.value = shakeAmp;
        u.uTime.value = time;
      }
    }
  }, [b, shakeAmp, time]);
  return <primitive object={mesh} />;
};

export const Forest: React.FC<{ shakeAmp: number; time: number }> = ({ shakeAmp, time }) => {
  const batches = useMemo(() => {
    const { ring, pts } = getScatter();
    const out: Batch[] = [];
    // ring trees: full detail, shakeable (one batch per prototype; aPhase attribute -> own geometry copy)
    for (let v = 0; v < 4; v++) {
      const trees = ring.filter((t) => t.v === v);
      const geo = makePineGeometry(v, 3).clone();
      out.push({ key: `ring${v}`, geo, mats: [foliageMaterial(PROTOS[v].cls, true), trunkMaterial], trees, shadow: true, shake: true });
    }
    // mid trees (40..150 m): detail 1, chunked 75 m; far trees (>150 m): detail 0, crown only, chunked 350 m
    const chunks = new Map<string, Tree[]>();
    for (const t of pts) {
      const rr = Math.hypot(t.x, t.y);
      const mid = rr < 150;
      const cs = mid ? 75 : 350;
      const k = `${mid ? "m" : "f"}|${Math.floor(t.x / cs)}|${Math.floor(t.y / cs)}|${t.v}`;
      if (!chunks.has(k)) chunks.set(k, []);
      chunks.get(k)!.push(t);
    }
    for (const [k, trees] of chunks) {
      const [lod, , , vs] = k.split("|");
      const v = Number(vs);
      if (lod === "m") {
        out.push({ key: k, geo: makePineGeometry(v, 1), mats: [foliageMaterial(PROTOS[v].cls, false), trunkMaterial], trees, shadow: true, shake: false });
      } else {
        out.push({ key: k, geo: makePineGeometry(v, 0, false), mats: foliageMaterial(PROTOS[v].cls, false), trees, shadow: false, shake: false });
      }
    }
    return out;
  }, []);
  return (
    <group>
      {batches.map((b) => (
        <TreeBatch key={b.key} b={b} shakeAmp={b.shake ? shakeAmp : 0} time={time} />
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------------------------
// Ground clutter r<60: 5000 instances — 60 % grass tufts, flowers (pink/yellow/white/lilac), stumps
// ---------------------------------------------------------------------------------------------
export const Clutter: React.FC = () => {
  const meshes = useMemo(() => {
    const r = rng(55);
    const fcols: [number, number, number][] = [
      [1, 0.45, 0.6],
      [1, 0.9, 0.35],
      [0.95, 0.95, 1.0],
      [0.7, 0.55, 1.0],
    ];
    const lists: { x: number; y: number; z: number; rz: number; s: number }[][] = [[], [], [], [], [], [], []];
    for (let i = 0; i < 5000; i++) {
      const a = r() * 6.283;
      const rr = 60 * Math.sqrt(r());
      const x = rr * Math.cos(a);
      const y = rr * Math.sin(a);
      const u = r();
      const vi = u < 0.6 ? 5 : u > 0.985 ? 6 : Math.floor(r() * 4);
      const rz = r() * 6.28;
      const s = (0.7 + r() * 0.7) * (vi === 5 ? 0.75 : 1);
      if (Math.abs(x - riverX(y)) < 8 || (Math.abs(x) < 4 && y > -1 && y < 5)) continue;
      lists[vi].push({ x, y, z: height(x, y), rz, s });
    }
    // prototypes
    const protos: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
    for (let i = 0; i < 4; i++) {
      const head = new THREE.IcosahedronGeometry(0.13, 1);
      head.translate(0, 0, 0.22);
      head.deleteAttribute("uv");
      const stem = new THREE.CylinderGeometry(0.02, 0.02, 0.22, 4, 1, true);
      stem.rotateX(Math.PI / 2);
      stem.translate(0, 0, 0.11);
      stem.deleteAttribute("uv");
      const g = mergeGeometries([head.toNonIndexed(), stem.toNonIndexed()])!;
      protos.push({ geo: g, mat: std(fcols[i], 0.6) });
    }
    const blades: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) {
      const a = k * 1.256;
      const c = new THREE.ConeGeometry(0.08, 0.45, 3, 1, true);
      c.rotateX(Math.PI / 2);
      c.applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(Math.sin(a), -Math.cos(a), 0), 0.3));
      c.translate(0.08 * Math.cos(a), 0.08 * Math.sin(a), 0.2);
      c.deleteAttribute("uv");
      blades.push(c.toNonIndexed());
    }
    protos.push({ geo: mergeGeometries(blades)!, mat: std([0.1, 0.3, 0.05], 0.8, { side: THREE.DoubleSide }) });
    const st = new THREE.CylinderGeometry(0.3, 0.35, 0.3, 9);
    st.rotateX(Math.PI / 2);
    st.translate(0, 0, 0.15);
    protos.push({ geo: st, mat: std([0.62, 0.42, 0.28], 0.8) });
    // proto order: 0-3 flowers, 4 tuft, 5 stump  <->  scatter variant ids 0-3, 5 (tuft), 6 (stump)
    const VARIANT_OF = [0, 1, 2, 3, 5, 6];
    return protos.map((p, i) => {
      const list = lists[VARIANT_OF[i]];
      const m = new THREE.InstancedMesh(p.geo, p.mat, list.length);
      const mat = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      list.forEach((t, j) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), t.rz);
        mat.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
        m.setMatrixAt(j, mat);
      });
      m.computeBoundingSphere();
      m.castShadow = i === 5;
      m.receiveShadow = true;
      return m;
    });
  }, []);
  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
};
