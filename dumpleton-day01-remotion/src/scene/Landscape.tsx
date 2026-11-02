import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useMemo } from "react";
import { rng } from "../timeline";
import { CLEAR_R, height, icoSphere, lin, noiseFac, perlin3, riverX } from "./world";

// Equirect "sky" used as reflection map for the glossy broth-blue river.
export const makeSkyEnv = () => {
  const w = 64;
  const h = 32;
  const data = new Uint16Array(w * h * 4);
  const top = lin(0.16, 0.3, 0.62);
  const hor = lin(0.62, 0.68, 0.78);
  const gnd = lin(0.05, 0.08, 0.04);
  for (let y = 0; y < h; y++) {
    const v = 1 - y / (h - 1); // 1 = up
    const el = (v - 0.5) * Math.PI;
    const c = el > 0 ? hor.clone().lerp(top, Math.pow(Math.sin(el), 0.6)) : gnd.clone();
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = THREE.DataUtils.toHalfFloat(c.r);
      data[i + 1] = THREE.DataUtils.toHalfFloat(c.g);
      data[i + 2] = THREE.DataUtils.toHalfFloat(c.b);
      data[i + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

export const Terrain: React.FC = () => {
  const geo = useMemo(() => {
    const SIZE = 1400;
    const DIV = 350;
    const g = new THREE.PlaneGeometry(SIZE, SIZE, DIV, DIV);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, height(p.getX(i), p.getY(i)));
    g.computeVertexNormals();
    // grass material (snow=True): base between two greens (object random), top colour where nz + .35*noise > .93
    const base = lin(0.06, 0.17, 0.03).lerp(lin(0.09, 0.23, 0.04), 0.45);
    const top = lin(0.14, 0.32, 0.06);
    const col = new Float32Array(p.count * 3);
    const n = g.attributes.normal;
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const gx = (p.getX(i) + 700) / 1400;
      const gy = (p.getY(i) + 700) / 1400;
      const nz = noiseFac(gx * 3, gy * 3, 0.5);
      // extra fine noise so the meadow is not uniform (Blender's noise has detail 2)
      const fine = 0.5 + 0.5 * perlin3(p.getX(i) / 9, p.getY(i) / 9, 4.2);
      const v = n.getZ(i) + 0.35 * (nz * 0.7 + fine * 0.3);
      const k = THREE.MathUtils.smoothstep(v, 0.93, 1.05);
      c.copy(base).lerp(top, k);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), []);
  return <mesh geometry={geo} material={mat} receiveShadow />;
};

export const Clearing: React.FC = () => {
  const geo = useMemo(() => {
    const r = rng(21);
    const g = new THREE.CircleGeometry(CLEAR_R - 4, 48);
    const p = g.attributes.position;
    for (let i = 1; i < p.count; i++) {
      p.setX(i, p.getX(i) + (r() * 2.4 - 1.2));
      p.setY(i, p.getY(i) + (r() * 2.4 - 1.2));
    }
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: lin(0.24, 0.42, 0.08),
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [],
  );
  return <mesh geometry={geo} material={mat} position={[0, 0, 0.03]} receiveShadow />;
};

export const River: React.FC<{ env: THREE.Texture; envIntensity: number }> = ({ env, envIntensity }) => {
  const geo = useMemo(() => {
    const pos: number[] = [];
    const idx: number[] = [];
    let k = 0;
    for (let i = -175; i <= 175; i++) {
      const y = i * 4;
      const x = riverX(y);
      const w = 6.5 + 1.5 * Math.sin(y / 23);
      pos.push(x - w, y, -0.9, x + w, y, -0.9);
      if (i > -175) idx.push(k - 2, k - 1, k + 1, k - 2, k + 1, k);
      k += 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: lin(0.25, 0.55, 0.75),
        roughness: 0.08,
        metalness: 0,
        envMap: env,
        side: THREE.DoubleSide,
      }),
    [env],
  );
  mat.envMapIntensity = envIntensity;
  return <mesh geometry={geo} material={mat} receiveShadow />;
};

export const Rocks: React.FC = () => {
  const data = useMemo(() => {
    const r = rng(33);
    const list: { p: [number, number, number]; s: [number, number, number]; rz: number; rad: number; top: number }[] = [];
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2;
      const rr = CLEAR_R - 3 + r() * (60 - CLEAR_R + 3);
      const x = rr * Math.cos(a);
      const y = rr * Math.sin(a);
      const rad = 0.4 + r() * 1.0;
      const sy = 0.6 + r() * 0.4;
      const sz = 0.4 + r() * 0.3;
      const rz = r() * 6;
      const top = r();
      if (Math.abs(x - riverX(y)) < 8) continue;
      list.push({ p: [x, y, height(x, y)], s: [1, sy, sz], rz, rad, top });
    }
    return list;
  }, []);
  const geo = useMemo(() => {
    const g = icoSphere(1, 1);
    const ng = g.toNonIndexed();
    ng.computeVertexNormals(); // faceted low-poly pebbles (sub=1, flat)
    return ng;
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: lin(0.88, 0.84, 0.8), roughness: 0.8 }), []);
  return (
    <group>
      {data.map((d, i) => (
        <mesh
          key={i}
          geometry={geo}
          material={mat}
          position={d.p}
          rotation={[0, 0, d.rz]}
          scale={[d.rad * d.s[0], d.rad * d.s[1], d.rad * d.s[2]]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
};

export const Mountains: React.FC<{ glow: number }> = ({ glow }) => {
  const meshes = useMemo(() => {
    const r = rng(44);
    const base0 = lin(0.42, 0.66, 0.4);
    const base1 = lin(0.55, 0.72, 0.48);
    const top = lin(0.75, 0.86, 0.62);
    const out: { geo: THREE.BufferGeometry; pos: [number, number, number] }[] = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * 2 * Math.PI + (r() * 0.2 - 0.1);
      const rr = 900 + r() * 400;
      const rad = 220 + r() * 140;
      const depth = 90 + r() * 90;
      let g: THREE.BufferGeometry = new THREE.ConeGeometry(rad, depth, 24, 5, true);
      g.rotateX(Math.PI / 2);
      g = mergeVertices(g);
      const p = g.attributes.position;
      const v = new THREE.Vector3();
      for (let k = 0; k < p.count; k++) {
        v.fromBufferAttribute(p, k);
        const len = v.length();
        if (len > 0) {
          const d = 10 * perlin3(v.x / 60, v.y / 60, v.z / 60);
          v.addScaledVector(v.clone().normalize(), d);
        }
        p.setXYZ(k, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      const base = base0.clone().lerp(base1, r());
      const col = new Float32Array(p.count * 3);
      const n = g.attributes.normal;
      const c = new THREE.Color();
      for (let k = 0; k < p.count; k++) {
        const nf = noiseFac(p.getX(k) / 120 + i, p.getY(k) / 120, p.getZ(k) / 120);
        const vv = n.getZ(k) + 0.35 * nf;
        c.copy(base).lerp(top, THREE.MathUtils.smoothstep(vv, 0.6, 0.72));
        col.set([c.r, c.g, c.b], k * 3);
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      out.push({ geo: g, pos: [rr * Math.cos(a), rr * Math.sin(a), 60] });
    }
    return out;
  }, []);
  const mat = useMemo(
    // far cones are lit mostly by the bright Nishita horizon in Blender: emulate with a little self-illumination
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: lin(0.75, 0.86, 0.62), emissiveIntensity: 0.0 }),
    [],
  );
  mat.emissiveIntensity = glow;
  return (
    <group>
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.geo} material={mat} position={m.pos} />
      ))}
    </group>
  );
};
