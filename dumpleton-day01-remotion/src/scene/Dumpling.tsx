import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useMemo } from "react";
import { FPS, fnoise, rng, SHAKE_WINDOWS, TOTAL, windowNoise } from "../timeline";
import { lin } from "./world";
import { std } from "./materials";

// Body geometry (scene.py make_dumpling): icosphere sub 3, pinched pleated top, flattened bottom.
const bodyCache = new Map<number, THREE.BufferGeometry>();
const bodyGeometry = (r: number) => {
  const c = bodyCache.get(r);
  if (c) return c;
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(r, 7);
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const zn = z / r;
    const ang = Math.atan2(y, x);
    if (zn > 0.2) {
      const k = (zn - 0.2) / 0.8;
      x *= 1 - 0.55 * k;
      y *= 1 - 0.55 * k;
      z += r * 0.35 * k * k;
      const pl = 1 + 0.07 * Math.sin(ang * 9) * k;
      x *= pl;
      y *= pl;
    }
    if (zn < -0.3) z = -0.3 * r + (z + 0.3 * r) * 0.35;
    z += 0.3 * r * 0.35 + 0.3 * r;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  bodyCache.set(r, g);
  return g;
};

const SPH2 = new THREE.IcosahedronGeometry(1, 3);
const SPH1 = new THREE.IcosahedronGeometry(1, 1);
const CYL = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 24);
  g.rotateX(Math.PI / 2); // Z up, centred
  return g;
})();
const CYL_BASE = (() => {
  const g = CYL.clone();
  g.translate(0, 0, 0.5);
  return g;
})();
const eyeMat = std([0.02, 0.02, 0.03], 0.2, { flatShading: true });
const blushMat = std([1.0, 0.45, 0.55], 0.6, { flatShading: true });
const hatMat = std([0.12, 0.1, 0.14], 0.4, { flatShading: true });
const bandMat = std([0.95, 0.25, 0.3], 0.4, { flatShading: true });

const bodyMatCache = new Map<string, THREE.Material>();
const bodyMat = (c: [number, number, number]) => {
  const k = c.join(",");
  let m = bodyMatCache.get(k);
  if (!m) {
    // roughness 0.22 jelly + a touch of emissive to fake the 0.35 subsurface glow
    const col = lin(...c);
    m = new THREE.MeshPhysicalMaterial({
      color: col,
      roughness: 0.32,
      sheen: 0.25,
      sheenColor: col.clone().multiplyScalar(0.5),
      emissive: col.clone().multiplyScalar(0.01),
    });
    bodyMatCache.set(k, m);
  }
  return m;
};

export type DumplingAnim = { ph: number; fr: number; blinks: number[]; n1: number; n2: number };
export const makeAnim = (seed: number): DumplingAnim => {
  const r = rng(seed);
  const ph = r() * 6.28;
  const fr = 0.3 + r() * 0.08;
  const blinks: number[] = [];
  let t = 0.5 + r() * 2;
  while (t < TOTAL) {
    blinks.push(t);
    t += 2 + r() * 1.5;
  }
  return { ph, fr, blinks, n1: r() * 50, n2: r() * 50 };
};

const blinkScale = (t: number, blinks: number[]) => {
  for (const b of blinks) {
    if (t < b) break;
    if (t < b + 0.07) return 1.25 + (0.1 - 1.25) * ((t - b) / 0.07);
    if (t < b + 0.15) return 0.1 + (1.25 - 0.1) * ((t - b - 0.07) / 0.08);
  }
  return 1.25;
};

export const Dumpling: React.FC<{
  t: number;
  color: [number, number, number];
  r: number;
  hat?: boolean;
  anim: DumplingAnim;
  position: [number, number, number];
  scale?: number;
  shake?: boolean;
  visible?: boolean;
}> = ({ t, color, r, hat, anim, position, scale = 1, shake, visible = true }) => {
  const geo = useMemo(() => bodyGeometry(r), [r]);
  const mat = useMemo(() => bodyMat(color), [color]);
  if (!visible || scale <= 0.001) return null;
  const frame = t * FPS + 1; // Blender frame
  const sq = Math.sin(anim.fr * 2 * frame + anim.ph);
  const sx = 1 + 0.07 * sq;
  const sz = 1 - 0.13 * sq;
  const hop = r * 0.22 * Math.sin(anim.fr * frame + anim.ph) + r * 0.22;
  let rx = 0.12 * 0.5 * fnoise(frame / 12, anim.n1);
  let ry = 0.12 * 0.5 * fnoise(frame / 12, anim.n2);
  if (shake) {
    rx += windowNoise(t, SHAKE_WINDOWS, 0.25, 1.5, 71);
    ry += windowNoise(t, SHAKE_WINDOWS, 0.25, 1.5, 72);
  }
  const ez = blinkScale(t, anim.blinks);
  return (
    <group position={position} scale={scale}>
      <group position={[0, 0, hop]} rotation={[rx, ry, 0]} scale={[sx, sx, sz]}>
        <mesh geometry={geo} material={mat} castShadow receiveShadow />
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh geometry={SPH2} material={eyeMat} position={[s * r * 0.32, -r * 0.78, r * 0.72]} scale={[r * 0.11, r * 0.11 * 0.6, r * 0.11 * ez]} />
            <mesh geometry={SPH1} material={blushMat} position={[s * r * 0.55, -r * 0.72, r * 0.5]} scale={[r * 0.12, r * 0.12 * 0.35, r * 0.12 * 0.6]} />
          </group>
        ))}
        {hat ? (
          <group>
            <mesh geometry={CYL} material={hatMat} position={[0, 0, r * 1.38]} scale={[r * 0.42, r * 0.42, 0.04]} castShadow />
            <mesh geometry={CYL_BASE} material={hatMat} position={[0, 0, r * 1.38]} scale={[r * 0.27, r * 0.27, r * 0.45]} castShadow />
            <mesh geometry={CYL_BASE} material={bandMat} position={[0, 0, r * 1.42]} scale={[r * 0.28, r * 0.28, r * 0.08]} />
          </group>
        ) : null}
      </group>
    </group>
  );
};
