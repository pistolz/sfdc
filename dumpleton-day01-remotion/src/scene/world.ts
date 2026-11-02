import * as THREE from "three";
import { rng } from "../timeline";

// ---------- Perlin noise (improved), output roughly in [-1, 1] like mathutils.noise.noise
const P = (() => {
  const r = rng(1337);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return new Uint8Array([...p, ...p]);
})();
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const grad = (h: number, x: number, y: number, z: number) => {
  const hh = h & 15;
  const u = hh < 8 ? x : y;
  const v = hh < 4 ? y : hh === 12 || hh === 14 ? x : z;
  return ((hh & 1) === 0 ? u : -u) + ((hh & 2) === 0 ? v : -v);
};
export const perlin3 = (x: number, y: number, z: number) => {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = P[X] + Y;
  const AA = P[A] + Z;
  const AB = P[A + 1] + Z;
  const B = P[X + 1] + Y;
  const BA = P[B] + Z;
  const BB = P[B + 1] + Z;
  const l = THREE.MathUtils.lerp;
  return l(
    l(l(grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z), u), l(grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z), u), v),
    l(
      l(grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1), u),
      l(grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1), u),
      v,
    ),
    w,
  );
};
/** Blender "Noise Texture" Fac-like value in [0,1] (detail ~3) */
export const noiseFac = (x: number, y: number, z: number) => {
  let v = 0;
  let a = 1;
  let f = 1;
  let n = 0;
  for (let i = 0; i < 4; i++) {
    v += a * perlin3(x * f, y * f, z * f);
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return THREE.MathUtils.clamp(0.5 + 0.5 * (v / n) * 1.4, 0, 1);
};

// ---------- terrain (scene.py)
export const riverX = (y: number) => 34 + 14 * Math.sin(y / 45) + 6 * Math.sin(y / 17 + 1.3);
export const CLEAR_R = 15;
export const height = (x: number, y: number) => {
  let h = 1.4 * perlin3(x / 40, y / 40, 0.3) + 0.5 * perlin3(x / 12, y / 12, 2.1);
  const r = Math.hypot(x, y);
  if (r < CLEAR_R + 6) h *= Math.max(0, (r - CLEAR_R + 2) / 8);
  const d = Math.abs(x - riverX(y));
  if (d < 10) h -= 2.2 * Math.pow(1 - d / 10, 1.5);
  return h;
};
export const treeOk = (x: number, y: number, rmin: number) => Math.hypot(x, y) > rmin && Math.abs(x - riverX(y)) > 9;

/** linear-space colour (Blender default_value tuples are linear) */
export const lin = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);

/** Blender bmesh.ops.create_icosphere(subdivisions=n) ~ three IcosahedronGeometry(detail = 2^n - 1), smooth-shaded */
export const icoSphere = (radius: number, subdivisions: number) => {
  const detail = Math.max(0, Math.pow(2, subdivisions) - 1);
  return new THREE.IcosahedronGeometry(radius, detail);
};
