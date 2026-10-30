/**
 * Level Tower 3D scene: a vertical stack of low-poly floating islands around a white column with a
 * golden spiral staircase. Every floor exists as cheap instanced geometry (top / rim / rocky underside),
 * and themed props are only built for the floors near the camera (LOD), so thousands of floors stay smooth.
 */
import * as THREE from "three";
import type { TowerState, Theme, KitItem } from "./types";

export const FLOOR_H = 5.2; // vertical distance between floors
const ISLAND_R = 4;
const CONE_H = 2.5;
const COL_R = 0.62;
const STEPS_PER_FLOOR = 16;
const STEP_R = 1.32;

export interface TowerOptions {
  reducedMotion: boolean;
  onPick: (floor: number) => void;
  onFrame: () => void;
  onFloorChange: (floor: number) => void;
}
interface Flight { t0: number; dur: number; f0: number; f1: number; a0: number; da: number; d0: number; d1: number; bump: number }

const hash = (n: number) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const rng = (seed: number) => { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const yOf = (floor: number) => (floor - 1) * FLOOR_H;

/* ------------------------------------------------------------------ shared geometry & materials */
const G = {
  cyl9: new THREE.CylinderGeometry(1, 1, 1, 9),
  rim9: new THREE.CylinderGeometry(1, 0.9, 1, 9),
  cone7: (() => { const g = new THREE.ConeGeometry(1, 1, 7, 2); g.rotateX(Math.PI); g.translate(0, -0.5, 0); return g; })(),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  dode: new THREE.DodecahedronGeometry(1, 0),
  octa: new THREE.OctahedronGeometry(1, 0),
  sphere: new THREE.SphereGeometry(1, 12, 8),
  torus: new THREE.TorusGeometry(1, 0.22, 6, 18),
  ring: new THREE.TorusGeometry(1, 0.06, 6, 48),
  disc: new THREE.CylinderGeometry(1, 1, 0.08, 18),
};
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, emissive = 0, extra = ""): THREE.MeshStandardMaterial {
  const key = `${color}|${emissive}|${extra}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.82, metalness: extra === "metal" ? 0.55 : 0.02 });
    if (emissive) { m.emissive = new THREE.Color(color); m.emissiveIntensity = emissive; m.userData.pulse = extra === "pulse"; }
    if (extra === "water") { m.transparent = true; m.opacity = 0.62; m.depthWrite = false; m.userData.water = true; }
    matCache.set(key, m);
  }
  return m;
}

/* ------------------------------------------------------------------ themed props */
type Add = (geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, sx: number, sy?: number, sz?: number, ry?: number, emissive?: number, extra?: string) => THREE.Mesh;

function buildProps(theme: Theme, floor: number, add: Add, r: number) {
  const rnd = rng(floor * 977 + 13);
  const spots: [number, number][] = [];
  /** random spot on the island, away from the column and from other props */
  const spot = (min = 1.75, max = r - 0.55, gap = 0.95): [number, number] => {
    for (let k = 0; k < 18; k++) {
      const a = rnd() * Math.PI * 2, d = min + rnd() * (max - min);
      const p: [number, number] = [Math.cos(a) * d, Math.sin(a) * d];
      if (spots.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > gap)) { spots.push(p); return p; }
    }
    const a = rnd() * Math.PI * 2; const p: [number, number] = [Math.cos(a) * max, Math.sin(a) * max]; spots.push(p); return p;
  };
  const top = 0.35;
  const pine = (c = "#2e9e55", snow = false) => {
    const [x, z] = spot(); const s = 0.75 + rnd() * 0.5;
    add(G.cyl8, "#7a5233", x, top + 0.25 * s, z, 0.12 * s, 0.5 * s, 0.12 * s);
    add(G.cone6, c, x, top + 0.95 * s, z, 0.62 * s, 1.15 * s, 0.62 * s, rnd() * 3);
    add(G.cone6, c, x, top + 1.55 * s, z, 0.45 * s, 0.9 * s, 0.45 * s, rnd() * 3);
    if (snow) add(G.cone6, "#ffffff", x, top + 1.9 * s, z, 0.26 * s, 0.42 * s, 0.26 * s);
  };
  const roundTree = (c: string, trunk = "#7a5233") => {
    const [x, z] = spot(); const s = 0.7 + rnd() * 0.45;
    add(G.cyl8, trunk, x, top + 0.4 * s, z, 0.12 * s, 0.8 * s, 0.12 * s);
    add(G.ico1, c, x, top + 1.15 * s, z, 0.62 * s, 0.6 * s, 0.62 * s, rnd() * 3);
  };
  const rock = (c: string, s = 0.35 + rnd() * 0.35) => { const [x, z] = spot(1.7, r - 0.4, 0.6); add(G.dode, c, x, top + s * 0.55, z, s, s * 0.8, s, rnd() * 3); };
  const house = (wall: string, roof: string) => {
    const [x, z] = spot(2, r - 0.9, 1.3); const ry = rnd() * 3;
    add(G.box, wall, x, top + 0.42, z, 0.85, 0.85, 0.85, ry);
    add(G.cone4, roof, x, top + 1.1, z, 0.78, 0.6, 0.78, ry + Math.PI / 4);
  };
  const crystal = (c: string, glow = 0.35) => {
    const [x, z] = spot(1.6, r - 0.5, 0.55); const s = 0.25 + rnd() * 0.3;
    for (let k = 0; k < 3; k++) add(G.octa, c, x + (k - 1) * 0.18, top + s * 1.6, z + (k % 2) * 0.14, s * 0.5, s * (1.6 + k * 0.4), s * 0.5, rnd() * 3, glow, "pulse");
  };
  const waterfall = () => {
    const a = rnd() * Math.PI * 2;
    const m = add(G.box, "#d7f3ff", Math.cos(a) * (r - 0.1), -1.2, Math.sin(a) * (r - 0.1), 0.55, 2.8, 0.08, -a + Math.PI / 2, 0.25, "water");
    m.renderOrder = 2;
    add(G.disc, "#7fd6ff", Math.cos(a) * (r - 0.55), top - 0.02, Math.sin(a) * (r - 0.55), 0.55, 1, 0.55, 0, 0.1);
  };

  // Custom worlds: a JSON "kit" of generic props, or the props of an existing world ("base").
  if (theme.kit?.length) {
    for (const k of theme.kit) kitItem(k);
    return;
  }
  function kitItem(k: KitItem) {
    const n = Math.max(1, Math.min(k.count ?? 1, 12)), sz = k.size ?? 1, glow = k.glow ?? 0, c2 = k.color2 ?? k.color;
    for (let i = 0; i < n; i++) {
      switch (k.shape) {
        case "pine": pine(k.color); break;
        case "tree": roundTree(k.color); break;
        case "rock": rock(k.color, (0.35 + rnd() * 0.35) * sz); break;
        case "house": house(k.color, c2); break;
        case "crystal": crystal(k.color, glow || 0.35); break;
        case "waterfall": waterfall(); break;
        case "pillar": { const [x, z] = spot(1.7, r - 0.6, 0.85); const h = (0.8 + rnd() * 1.8) * sz; add(G.box, k.color, x, top + h / 2, z, 0.55 * sz, h, 0.55 * sz); if (c2 !== k.color || glow) add(G.box, c2, x, top + h + 0.04, z, 0.6 * sz, 0.08, 0.6 * sz, 0, glow || 1.2, "pulse"); break; }
        case "orb": { const [x, z] = spot(); add(G.sphere, k.color, x, top + 0.35 * sz, z, 0.35 * sz, 0.35 * sz, 0.35 * sz, 0, glow, glow ? "pulse" : ""); break; }
        case "ring": { const [x, z] = spot(1.8, r - 0.8, 1); add(G.torus, k.color, x, top + 0.6 * sz, z, 0.5 * sz, 0.5 * sz, 0.5 * sz, rnd() * 3, glow); break; }
        case "pyramid": { const [x, z] = spot(2, r - 1, 1.5); add(G.cone4, k.color, x, top + 0.7 * sz, z, sz, 1.4 * sz, sz, Math.PI / 4); break; }
        case "cone": { const [x, z] = spot(); add(G.cone6, k.color, x, top + 0.5 * sz, z, 0.4 * sz, sz, 0.4 * sz, rnd() * 3, glow); break; }
        case "cube": { const [x, z] = spot(); const s2 = (0.3 + rnd() * 0.3) * sz; add(G.box, k.color, x, top + s2 / 2, z, s2, s2, s2, rnd() * 3, glow, glow ? "pulse" : ""); break; }
        case "pool": { const [x, z] = spot(1.8, r - 1, 1.3); add(G.disc, k.color, x, top - 0.01, z, 0.9 * sz, 1, 0.9 * sz, 0, glow || 0.4, glow ? "pulse" : ""); break; }
        case "dots": { const ring = 1.6 + rnd() * (r - 2.2); for (let d = 0; d < 10; d++) { const a = (d / 10) * Math.PI * 2; add(G.sphere, k.color, Math.cos(a) * ring, top + 0.15, Math.sin(a) * ring, 0.09 * sz, 0.09 * sz, 0.09 * sz, 0, glow || 0.6); } break; }
        case "arch": { const [x, z] = spot(2.2, r - 1, 1.5); const ry = Math.atan2(x, z); add(G.box, k.color, x - Math.cos(ry) * 0.5 * sz, top + 0.6 * sz, z + Math.sin(ry) * 0.5 * sz, 0.12, 1.2 * sz, 0.12, ry); add(G.box, k.color, x + Math.cos(ry) * 0.5 * sz, top + 0.6 * sz, z - Math.sin(ry) * 0.5 * sz, 0.12, 1.2 * sz, 0.12, ry); add(G.box, c2, x, top + 1.25 * sz, z, 1.4 * sz, 0.12, 0.16, -ry + Math.PI / 2, glow); break; }
        case "star": add(G.octa, k.color, (rnd() - 0.5) * 2, 2.8 + rnd(), (rnd() - 0.5) * 2, 0.3 * sz, 0.45 * sz, 0.3 * sz, 0, glow || 0.9, "pulse"); break;
      }
    }
  }

  switch (theme.base ?? theme.id) {
    case "grassland":
      for (let k = 0; k < 4; k++) pine(rnd() < 0.5 ? "#3fae5c" : "#56c26a");
      for (let k = 0; k < 2; k++) roundTree("#c8e06a");
      house("#ffffff", "#ef7f7f"); rock("#cdbb9a", 0.55); waterfall();
      break;
    case "desert": {
      const [x, z] = spot(2.2, r - 1.3, 2);
      add(G.cone4, "#e9bf6a", x, top + 0.95, z, 1.45, 1.9, 1.45, Math.PI / 4);
      const [x2, z2] = spot(2, r - 0.9, 1.4); add(G.cone4, "#e2b25a", x2, top + 0.55, z2, 0.8, 1.1, 0.8, Math.PI / 4);
      for (let k = 0; k < 3; k++) { const [cx, cz] = spot(); add(G.cyl8, "#4f9a52", cx, top + 0.55, cz, 0.16, 1.1, 0.16); add(G.cyl8, "#4f9a52", cx + 0.22, top + 0.7, cz, 0.1, 0.45, 0.1); }
      rock("#c99a5b");
      break;
    }
    case "ice":
      for (let k = 0; k < 4; k++) pine("#2f8a6e", true);
      for (let k = 0; k < 3; k++) crystal("#bfeaff", 0.25);
      rock("#e6f4fb", 0.5); waterfall();
      break;
    case "neon": {
      const neon = ["#ff4fd8", "#38e8ff", "#ffd23f", "#8b5bff"];
      for (let k = 0; k < 6; k++) {
        const [x, z] = spot(1.7, r - 0.6, 0.85); const h = 0.8 + rnd() * 2.1; const c = neon[k % neon.length];
        add(G.box, "#16122b", x, top + h / 2, z, 0.62, h, 0.62);
        add(G.box, c, x, top + h + 0.04, z, 0.66, 0.08, 0.66, 0, 1.4, "pulse");
        add(G.box, c, x + 0.31, top + h / 2, z, 0.04, h * 0.9, 0.5, 0, 1.2);
      }
      break;
    }
    case "crystal":
      for (let k = 0; k < 7; k++) crystal(rnd() < 0.5 ? "#ff8ad8" : "#c79bff", 0.55);
      rock("#4a3570", 0.55); rock("#5b3f8a");
      break;
    case "lava": {
      const a = rnd() * 6.28;
      add(G.disc, "#ff5a1f", Math.cos(a) * 2.4, top - 0.01, Math.sin(a) * 2.4, 1.15, 1, 1.15, 0, 1.6, "pulse");
      for (let k = 0; k < 5; k++) { const [x, z] = spot(); const s = 0.3 + rnd() * 0.4; add(G.cone6, "#2a1714", x, top + s, z, s * 0.7, s * 2.2, s * 0.7, rnd() * 3); }
      const [vx, vz] = spot(2, r - 1, 1.6); add(G.cone6, "#3a2420", vx, top + 0.8, vz, 1.1, 1.6, 1.1); add(G.disc, "#ffb21f", vx, top + 1.62, vz, 0.42, 1, 0.42, 0, 2, "pulse");
      break;
    }
    case "candy":
      for (let k = 0; k < 4; k++) { const [x, z] = spot(); const c = ["#ff5fa2", "#7fd3ff", "#ffd23f", "#9b7bff"][k]; add(G.cyl8, "#ffffff", x, top + 0.6, z, 0.06, 1.2, 0.06); add(G.sphere, c, x, top + 1.35, z, 0.38, 0.38, 0.12, rnd() * 3); }
      for (let k = 0; k < 4; k++) { const [x, z] = spot(1.6, r - 0.4, 0.6); add(G.sphere, ["#7ee08a", "#ffb0d0", "#ffe08a", "#b9a6ff"][k], x, top + 0.12, z, 0.32, 0.3, 0.32); }
      house("#a8643b", "#ffffff");
      break;
    case "jungle":
      for (let k = 0; k < 4; k++) {
        const [x, z] = spot(); const lean = (rnd() - 0.5) * 0.4;
        const t = add(G.cyl8, "#8a6239", x, top + 0.8, z, 0.12, 1.6, 0.12); t.rotation.z = lean;
        for (let l = 0; l < 5; l++) { const leaf = add(G.cone4, "#2f9e47", x + lean * -0.8, top + 1.65, z, 0.18, 1.1, 0.42, l * 1.25); leaf.rotation.z = Math.PI / 2.4; leaf.rotation.y = l * 1.25; }
      }
      for (let k = 0; k < 3; k++) roundTree("#1f8a3c");
      waterfall();
      break;
    case "ocean": {
      add(G.disc, "#f2dfb0", 0, top + 0.02, 0, 1.75, 1, 1.75);
      for (let k = 0; k < 3; k++) { const [x, z] = spot(2.2, r - 0.6, 1.1); add(G.cyl8, "#ffffff", x, top + 0.18, z, 0.07, 0.3, 0.07); add(G.sphere, k % 2 ? "#ff5a5f" : "#ffd23f", x, top + 0.3, z, 0.18, 0.18, 0.18); }
      const [bx, bz] = spot(2.3, r - 0.8, 1.3); add(G.box, "#ffffff", bx, top + 0.14, bz, 0.9, 0.22, 0.4, rnd() * 3); add(G.cone4, "#ff8a5c", bx, top + 0.55, bz, 0.25, 0.6, 0.05);
      waterfall();
      break;
    }
    case "space": {
      for (let k = 0; k < 4; k++) { const [x, z] = spot(1.7, r - 0.5, 0.8); add(G.torus, "#3b3f73", x, top + 0.02, z, 0.38, 0.38, 0.5); }
      const [x, z] = spot(2, r - 1, 1.2);
      add(G.cyl8, "#f4f6ff", x, top + 1, z, 0.32, 1.6, 0.32); add(G.cone6, "#ff5a5f", x, top + 2.15, z, 0.32, 0.7, 0.32);
      for (let k = 0; k < 3; k++) add(G.box, "#ff5a5f", x + Math.cos(k * 2.1) * 0.35, top + 0.35, z + Math.sin(k * 2.1) * 0.35, 0.08, 0.6, 0.3, -k * 2.1);
      add(G.sphere, "#ffe066", 0, 3.6, 0, 0.25, 0.25, 0.25, 0, 1.6, "pulse");
      const [px, pz] = spot(2, r - 0.6, 1); add(G.sphere, "#8b5bff", px, top + 0.55, pz, 0.45, 0.45, 0.45); add(G.ring, "#ffd23f", px, top + 0.55, pz, 0.75, 0.75, 0.75, 0.5);
      break;
    }
    case "castle": {
      const [x, z] = spot(2.1, r - 1.2, 2.2);
      add(G.box, "#ffffff", x, top + 0.55, z, 1.4, 1.1, 1.0, rnd() * 3);
      for (const [dx, dz] of [[-0.75, -0.55], [0.75, -0.55], [-0.75, 0.55], [0.75, 0.55]]) {
        add(G.cyl8, "#f4f6ff", x + dx, top + 0.8, z + dz, 0.26, 1.6, 0.26); add(G.cone6, "#6c8cff", x + dx, top + 1.85, z + dz, 0.32, 0.6, 0.32);
      }
      add(G.box, "#ffd34d", x, top + 1.5, z, 0.04, 0.5, 0.04);
      for (let k = 0; k < 3; k++) { const [cx, cz] = spot(1.6, r - 0.3, 0.7); add(G.ico1, "#ffffff", cx, top + 0.35, cz, 0.45, 0.35, 0.45); }
      break;
    }
    case "haunted":
      for (let k = 0; k < 3; k++) { const [x, z] = spot(); const t = add(G.cyl8, "#2a2520", x, top + 0.8, z, 0.08, 1.6, 0.08); t.rotation.z = (rnd() - 0.5) * 0.3; const b = add(G.cyl8, "#2a2520", x + 0.25, top + 1.2, z, 0.05, 0.7, 0.05); b.rotation.z = -0.8; }
      for (let k = 0; k < 4; k++) { const [x, z] = spot(1.6, r - 0.4, 0.6); add(G.box, "#8e968a", x, top + 0.3, z, 0.42, 0.6, 0.14, rnd() * 3); }
      for (let k = 0; k < 3; k++) { const [x, z] = spot(1.6, r - 0.4, 0.6); add(G.sphere, "#ff8a1f", x, top + 0.2, z, 0.26, 0.2, 0.26, 0, 0.6, "pulse"); }
      add(G.sphere, "#e9fff0", 0, 2.6 + rnd(), 0, 0.3, 0.42, 0.3, 0, 0.8, "pulse");
      break;
    case "cyber":
      for (let k = -2; k <= 2; k++) { add(G.box, "#2ef2ff", k * 1.2, top + 0.02, 0, 0.04, 0.02, r * 1.7, 0, 1.4); add(G.box, "#2ef2ff", 0, top + 0.02, k * 1.2, r * 1.7, 0.02, 0.04, 0, 1.4); }
      for (let k = 0; k < 5; k++) { const [x, z] = spot(1.7, r - 0.6, 0.9); const s = 0.3 + rnd() * 0.35; add(G.box, rnd() < 0.5 ? "#2ef2ff" : "#ff3df2", x, top + 0.5 + s, z, s, s, s, rnd() * 3, 0.9, "pulse"); }
      break;
    case "gold":
      for (let k = 0; k < 5; k++) { const [x, z] = spot(1.6, r - 0.5, 0.65); const h = 1 + Math.floor(rnd() * 5); for (let l = 0; l < h; l++) add(G.cyl8, "#ffcf3a", x, top + 0.06 + l * 0.12, z, 0.28, 0.1, 0.28, 0, 0.15, "metal"); }
      { const [x, z] = spot(2, r - 0.9, 1.2); const ry = rnd() * 3; add(G.box, "#8a5a2b", x, top + 0.3, z, 0.9, 0.6, 0.6, ry); add(G.box, "#ffcf3a", x, top + 0.62, z, 0.94, 0.1, 0.64, ry, 0.3, "metal"); }
      add(G.octa, "#fff3b0", 0, 3.2, 0, 0.3, 0.45, 0.3, 0, 0.9, "pulse");
      break;
    case "autumn":
      for (let k = 0; k < 5; k++) roundTree(["#e9692c", "#f2a33a", "#c4462b"][k % 3]);
      for (let k = 0; k < 3; k++) { const [x, z] = spot(1.6, r - 0.4, 0.6); add(G.sphere, "#f27d1c", x, top + 0.2, z, 0.28, 0.22, 0.28); }
      house("#f5e6c8", "#8a3b22");
      break;
    case "sakura": {
      for (let k = 0; k < 4; k++) roundTree(k % 2 ? "#ffb3cf" : "#ff8fb8", "#5e3b2b");
      const [x, z] = spot(2.2, r - 1, 1.5); const ry = Math.atan2(x, z);
      add(G.box, "#e0443a", x - Math.cos(ry) * 0.5, top + 0.6, z + Math.sin(ry) * 0.5, 0.12, 1.2, 0.12, ry);
      add(G.box, "#e0443a", x + Math.cos(ry) * 0.5, top + 0.6, z - Math.sin(ry) * 0.5, 0.12, 1.2, 0.12, ry);
      add(G.box, "#e0443a", x, top + 1.25, z, 1.4, 0.12, 0.16, -ry + Math.PI / 2);
      waterfall();
      break;
    }
    default:
      for (let k = 0; k < 3; k++) roundTree(theme.accent);
  }
}

/* ------------------------------------------------------------------ sky palette by altitude */
const SKY: [number, string, string][] = [
  [0, "#4f9cf0", "#d6ebff"],
  [250, "#3f86e6", "#c4e0ff"],
  [600, "#2f6dd6", "#9cc4f5"],
  [1000, "#1d3d99", "#5d82d0"],
  [1600, "#0b1240", "#273a86"],
  [2500, "#04051a", "#12163f"],
];
function skyAt(floor: number): [THREE.Color, THREE.Color] {
  let i = 0; while (i < SKY.length - 1 && floor > SKY[i + 1][0]) i++;
  const a = SKY[i], b = SKY[Math.min(i + 1, SKY.length - 1)];
  const t = b[0] === a[0] ? 0 : THREE.MathUtils.clamp((floor - a[0]) / (b[0] - a[0]), 0, 1);
  return [new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), t), new THREE.Color(a[2]).lerp(new THREE.Color(b[2]), t)];
}

/* ------------------------------------------------------------------ the scene */
export class Tower {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.5, 600);
  private state!: TowerState;
  private floors = 0;
  private radii: number[] = [];
  private islandTop!: THREE.InstancedMesh;
  private islandRim!: THREE.InstancedMesh;
  private islandCone!: THREE.InstancedMesh;
  private column!: THREE.Mesh;
  private steps!: THREE.InstancedMesh;
  private clouds!: THREE.InstancedMesh;
  private stars!: THREE.Points;
  private ghost = new THREE.Group();
  private topFlag = new THREE.Group();
  private highlight = new THREE.Group();
  private details = new Map<number, THREE.Group>();
  private windowCenter = -999;
  private raf = 0;
  private running = false;
  private clock = new THREE.Clock();
  private fog = new THREE.Fog(0xbcdcff, 40, 140);

  // camera state
  floorPos = 1;
  private angle = 0.6;
  private dist = 26;
  private baseDist = 26;
  private vFloor = 0;
  private vAngle = 0;
  private flight: Flight | null = null;
  private selected = 0;
  private selectedAt = 0;
  private lastInput = 0;
  private lastReported = 0;
  private inset = { right: 0, bottom: 0 };

  constructor(private canvas: HTMLCanvasElement, private opts: TowerOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.fog = this.fog;

    this.scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x9a7a5a, 1.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(18, 30, 22);
    this.scene.add(sun);
    this.scene.add(sun.target);

    const islandMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0 });
    const MAX = 1;
    this.islandTop = new THREE.InstancedMesh(G.cyl9, islandMat, MAX);
    this.islandRim = new THREE.InstancedMesh(G.rim9, islandMat.clone(), MAX);
    this.islandCone = new THREE.InstancedMesh(G.cone7, islandMat.clone(), MAX);
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(COL_R, COL_R, 1, 12), new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.6 }));
    this.steps = new THREE.InstancedMesh(G.box, new THREE.MeshStandardMaterial({ color: 0xf2b53a, roughness: 0.55, metalness: 0.25, flatShading: true }), 80 * STEPS_PER_FLOOR);
    this.clouds = new THREE.InstancedMesh(G.ico1, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.18 }), 900);
    this.clouds.frustumCulled = false;
    this.steps.frustumCulled = false;
    this.scene.add(this.islandTop, this.islandRim, this.islandCone, this.column, this.steps, this.clouds, this.ghost, this.topFlag, this.highlight);

    // stars (visible at altitude)
    const sp = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) { const a = Math.random() * 6.283, r = 60 + Math.random() * 140, y = (Math.random() - 0.5) * 260; sp.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    this.buildHighlight();
    this.bindInput();
    this.resize();
    addEventListener("resize", () => this.resize());
  }

  /* ---------------------------------------------------------------- data */
  setState(state: TowerState) {
    this.state = state;
    const n = state.floors.length;
    const grow = n !== this.floors;
    this.floors = n;
    if (grow) {
      for (const m of [this.islandTop, this.islandRim, this.islandCone]) { this.scene.remove(m); m.dispose(); }
      const mk = (g: THREE.BufferGeometry, m: THREE.Material) => { const im = new THREE.InstancedMesh(g, m, n); im.frustumCulled = false; this.scene.add(im); return im; };
      this.islandTop = mk(G.cyl9, this.islandTop.material as THREE.Material);
      this.islandRim = mk(G.rim9, this.islandRim.material as THREE.Material);
      this.islandCone = mk(G.cone7, this.islandCone.material as THREE.Material);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    this.radii = [];
    for (let i = 0; i < n; i++) {
      const th = state.themes[state.floors[i][0]];
      const r = ISLAND_R * (0.9 + hash(i + 7) * 0.2);
      this.radii.push(r);
      const y = yOf(i + 1);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i * 3 + 1) * 6.283);
      m.compose(p.set(0, y, 0), q, s.set(r, 0.7, r)); this.islandTop.setMatrixAt(i, m); this.islandTop.setColorAt(i, c.set(th.top));
      m.compose(p.set(0, y - 0.75, 0), q, s.set(r * 1.02, 0.85, r * 1.02)); this.islandRim.setMatrixAt(i, m); this.islandRim.setColorAt(i, c.set(th.rim));
      m.compose(p.set(0, y - 1.15, 0), q, s.set(r * 0.92, CONE_H * (0.85 + hash(i + 99) * 0.35), r * 0.92)); this.islandCone.setMatrixAt(i, m); this.islandCone.setColorAt(i, c.set(th.rock));
    }
    for (const im of [this.islandTop, this.islandRim, this.islandCone]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    // column from below floor 1 to the top
    const h = yOf(n) + 10;
    this.column.scale.set(1, h, 1);
    this.column.position.y = h / 2 - 6;
    this.buildTop();
    for (const g of this.details.values()) this.scene.remove(g);
    this.details.clear();
    this.windowCenter = -999;
  }

  private buildTop() {
    const n = this.floors;
    this.ghost.clear();
    const gm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false });
    const wire = new THREE.MeshBasicMaterial({ color: 0xffd23f, wireframe: true, transparent: true, opacity: 0.55 });
    const top = new THREE.Mesh(G.cyl9, gm); top.scale.set(ISLAND_R, 0.7, ISLAND_R);
    const cone = new THREE.Mesh(G.cone7, gm); cone.scale.set(ISLAND_R * 0.92, CONE_H, ISLAND_R * 0.92); cone.position.y = -1.15;
    const tw = new THREE.Mesh(G.cyl9, wire); tw.scale.copy(top.scale);
    const cw = new THREE.Mesh(G.cone7, wire); cw.scale.copy(cone.scale); cw.position.y = cone.position.y;
    this.ghost.add(top, cone, tw, cw);
    this.ghost.position.y = yOf(n + 1);
    // crane flag on the top floor
    this.topFlag.clear();
    const pole = new THREE.Mesh(G.cyl8, mat("#f4f6ff")); pole.scale.set(0.07, 3, 0.07); pole.position.set(0, 1.5, 0);
    const flag = new THREE.Mesh(G.box, mat("#ffd23f", 0.4)); flag.scale.set(1.1, 0.65, 0.04); flag.position.set(0.6, 2.65, 0);
    this.topFlag.add(pole, flag);
    this.topFlag.position.set(0, yOf(n) + 0.35, 0);
  }

  private buildHighlight() {
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(G.ring, ringMat); ring.rotation.x = Math.PI / 2; ring.name = "ring";
    const ring2 = new THREE.Mesh(G.ring, ringMat.clone()); ring2.rotation.x = Math.PI / 2; ring2.name = "ring2";
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.name = "beam";
    const glow = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.name = "glow";
    this.highlight.add(ring, ring2, beam, glow);
    this.highlight.visible = false;
  }

  /* ---------------------------------------------------------------- LOD windows */
  private updateWindows(force = false) {
    const center = Math.round(this.floorPos);
    if (!force && Math.abs(center - this.windowCenter) < 6) { this.ensureDetails(center); return; }
    this.windowCenter = center;
    // stairs ±40 floors
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(0.95, 0.13, 0.38), p = new THREE.Vector3();
    let k = 0;
    const lo = Math.max(1, center - 40), hi = Math.min(this.floors, center + 39);
    for (let f = lo; f <= hi; f++) {
      const y0 = yOf(f) + 0.35;
      for (let j = 0; j < STEPS_PER_FLOOR && k < this.steps.count; j++) {
        const t = j / STEPS_PER_FLOOR;
        const a = f * 1.7 + t * Math.PI * 2;
        p.set(Math.cos(a) * STEP_R, y0 + t * FLOOR_H, Math.sin(a) * STEP_R);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
        m.compose(p, q, s);
        this.steps.setMatrixAt(k++, m);
      }
    }
    this.steps.count = k;
    this.steps.instanceMatrix.needsUpdate = true;
    // clouds: a sea below floor 1 + drifting clusters every few floors
    k = 0;
    const cm = this.clouds;
    const puff = (x: number, y: number, z: number, sc: number) => { if (k >= cm.count) return; m.compose(p.set(x, y, z), q.identity(), new THREE.Vector3(sc, sc * 0.62, sc)); cm.setMatrixAt(k++, m); };
    if (lo < 30) {
      const r = rng(4242);
      for (let i = 0; i < 160; i++) { const a = r() * 6.283, d = 5 + r() * 45; puff(Math.cos(a) * d, -9 - r() * 3, Math.sin(a) * d, 3 + r() * 4); }
    }
    for (let f = Math.max(1, lo - 4); f <= hi + 6; f += 3) {
      const r = rng(f * 31 + 5);
      const n = 1 + Math.floor(r() * 2);
      for (let c = 0; c < n; c++) {
        const a = r() * 6.283, d = 11 + r() * 14, y = yOf(f) + (r() - 0.5) * FLOOR_H * 2;
        const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
        const puffs = 3 + Math.floor(r() * 4);
        for (let j = 0; j < puffs; j++) puff(cx + (r() - 0.5) * 4, y + (r() - 0.5) * 0.8, cz + (r() - 0.5) * 3, 1 + r() * 1.6);
      }
    }
    cm.count = k;
    cm.instanceMatrix.needsUpdate = true;
    this.ensureDetails(center);
  }

  private detailRange() { return innerWidth < 760 ? 5 : 7; }
  private ensureDetails(center: number) {
    const R = this.detailRange();
    const want = new Set<number>();
    for (let f = Math.max(1, center - R); f <= Math.min(this.floors, center + R); f++) want.add(f);
    if (this.selected) want.add(this.selected);
    for (const [f, g] of this.details) if (!want.has(f)) { this.scene.remove(g); this.details.delete(f); }
    let built = 0;
    // nearest first, max 3 per frame to avoid jank
    const order = [...want].filter((f) => !this.details.has(f)).sort((a, b) => Math.abs(a - this.floorPos) - Math.abs(b - this.floorPos));
    for (const f of order) {
      if (built++ >= 3) break;
      this.details.set(f, this.buildDetail(f));
    }
  }

  private buildDetail(floor: number): THREE.Group {
    const g = new THREE.Group();
    const th = this.state.themes[this.state.floors[floor - 1][0]];
    const add: Add = (geo, color, x, y, z, sx, sy = sx, sz = sx, ry = 0, emissive = 0, extra = "") => {
      const mesh = new THREE.Mesh(geo, mat(color, emissive, extra));
      mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.rotation.y = ry;
      g.add(mesh);
      return mesh;
    };
    buildProps(th, floor, add, this.radii[floor - 1] ?? ISLAND_R);
    g.position.y = yOf(floor);
    g.rotation.y = hash(floor * 3 + 1) * 6.283;
    g.userData.floor = floor;
    this.scene.add(g);
    return g;
  }

  /* ---------------------------------------------------------------- camera control */
  get maxFloor() { return this.floors + 1; }
  private get zoomK() { return this.selected ? (this.camera.aspect > 1 ? 0.66 : 0.5) : 1; }
  get isFlying() { return !!this.flight; }

  flyTo(floor: number, opts: { instant?: boolean; select?: boolean } = {}) {
    floor = THREE.MathUtils.clamp(floor, 1, this.maxFloor);
    if (opts.select !== false) { this.selected = floor <= this.floors ? floor : 0; this.selectedAt = performance.now(); }
    const close = this.baseDist * this.zoomK;
    if (opts.instant || this.opts.reducedMotion) {
      this.flight = null; this.floorPos = floor; this.dist = close; this.vFloor = 0;
      this.updateWindows(true);
      return;
    }
    const df = floor - this.floorPos;
    const dur = Math.min(4.2, 1.1 + Math.log10(1 + Math.abs(df)) * 1.15);
    // ride the spiral: rotate around the tower while climbing (capped), and pull back mid-flight for a reveal
    const spin = Math.sign(df || 1) * Math.min(Math.abs(df) * 0.25, Math.PI * 2.2) + 0.35;
    this.flight = { t0: performance.now(), dur: dur * 1000, f0: this.floorPos, f1: floor, a0: this.angle, da: spin, d0: this.dist, d1: close, bump: Math.min(42, 6 + Math.abs(df) * 0.55) };
    this.vFloor = 0; this.vAngle = 0;
  }
  clearSelection() { this.selected = 0; }
  setInset(right: number, bottom: number) { this.inset = { right, bottom }; this.applyView(); }

  private bindInput() {
    const el = this.canvas;
    let down: { x: number; y: number; t: number; moved: number } | null = null;
    let last = { x: 0, y: 0 };
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      last = { x: e.clientX, y: e.clientY };
      this.flight = null; this.vFloor = 0; this.vAngle = 0; this.lastInput = performance.now();
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    el.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.baseDist = THREE.MathUtils.clamp(this.baseDist * (pinch / d), 16, 110), this.dist = this.baseDist * this.zoomK;
        pinch = d; return;
      }
      if (!down) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      down.moved += Math.abs(dx) + Math.abs(dy);
      const fpp = (this.dist * 0.83) / FLOOR_H / el.clientHeight; // floors per pixel at the current zoom
      this.floorPos = THREE.MathUtils.clamp(this.floorPos + dy * fpp, 1, this.maxFloor);
      this.angle -= dx * 0.008;
      this.vFloor = dy * fpp * 0.9; this.vAngle = -dx * 0.008 * 0.9;
      this.lastInput = performance.now();
    });
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (down && down.moved < 8 && performance.now() - down.t < 450) this.pick(e.clientX, e.clientY);
      down = null;
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.flight = null; this.lastInput = performance.now();
      if (e.ctrlKey) { this.baseDist = THREE.MathUtils.clamp(this.baseDist * (1 + e.deltaY * 0.01), 16, 110); this.dist = this.baseDist; return; }
      const d = (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) / 900;
      this.vFloor += -d * 1.4;
    }, { passive: false });
    el.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); this.flyTo(Math.round(this.floorPos) + (e.key === "PageUp" ? 10 : step), { select: false }); }
      else if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); this.flyTo(Math.round(this.floorPos) - (e.key === "PageDown" ? 10 : step), { select: false }); }
      else if (e.key === "ArrowLeft") this.vAngle = 0.05;
      else if (e.key === "ArrowRight") this.vAngle = -0.05;
      else if (e.key === "Home") this.flyTo(1, { select: false });
      else if (e.key === "End") this.flyTo(this.floors, { select: false });
      else if (e.key === "Enter") this.opts.onPick(Math.round(this.floorPos));
    });
  }

  private ray = new THREE.Raycaster();
  private pick(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hits = this.ray.intersectObjects([this.islandTop, this.islandCone, this.islandRim, ...this.details.values()], true);
    for (const h of hits) {
      if (h.instanceId !== undefined && (h.object === this.islandTop || h.object === this.islandCone || h.object === this.islandRim)) { this.opts.onPick(h.instanceId + 1); return; }
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.floor === undefined) o = o.parent;
      if (o) { this.opts.onPick(o.userData.floor as number); return; }
    }
  }

  /* ---------------------------------------------------------------- projection for HTML labels */
  private v = new THREE.Vector3();
  /** Screen position of the right edge of a floor's island (as seen from the camera). */
  project(floor: number): { x: number; y: number; visible: boolean; side: 1 | -1 } | null {
    if (floor < 1 || floor > this.floors + 1) return null;
    const r = (this.radii[floor - 1] ?? ISLAND_R) + 0.3;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize();
    const side: 1 | -1 = floor % 2 ? 1 : -1;
    this.v.set(right.x * r * side, yOf(floor) + 0.2, right.z * r * side).project(this.camera);
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    return { x: (this.v.x + 1) / 2 * W, y: (1 - this.v.y) / 2 * H, visible: this.v.z < 1 && Math.abs(this.v.x) < 1.15 && Math.abs(this.v.y) < 1.05, side };
  }
  visibleRange(): [number, number] {
    const span = (this.dist * 0.83) / FLOOR_H / 2 + 1;
    return [Math.max(1, Math.floor(this.floorPos - span)), Math.min(this.floors + 1, Math.ceil(this.floorPos + span))];
  }

  /* ---------------------------------------------------------------- loop */
  start() { if (this.running) return; this.running = true; this.clock.getDelta(); this.raf = requestAnimationFrame(this.tick); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  private tick = () => {
    if (!this.running) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    const now = performance.now();
    const t = now / 1000;

    if (this.flight) {
      const f = this.flight;
      const k = Math.min(1, (now - f.t0) / f.dur);
      const e = easeInOut(k);
      this.floorPos = f.f0 + (f.f1 - f.f0) * e;
      this.angle = f.a0 + f.da * e;
      this.dist = f.d0 + (f.d1 - f.d0) * e + Math.sin(Math.PI * e) * f.bump;
      if (k >= 1) this.flight = null;
    } else {
      this.floorPos = THREE.MathUtils.clamp(this.floorPos + this.vFloor, 1, this.maxFloor);
      this.angle += this.vAngle;
      this.vFloor *= 0.9; this.vAngle *= 0.9;
      if (Math.abs(this.vFloor) < 1e-4) this.vFloor = 0;
      if (!this.opts.reducedMotion && now - this.lastInput > 2500) this.angle += dt * (this.selected ? 0.05 : 0.09);
      const target = this.baseDist * this.zoomK;
      this.dist += (target - this.dist) * Math.min(1, dt * 3);
    }

    const y = yOf(this.floorPos);
    const look = new THREE.Vector3(0, y + 1.1, 0);
    this.camera.position.set(Math.sin(this.angle) * this.dist, y + 1.1 + this.dist * 0.22, Math.cos(this.angle) * this.dist);
    this.camera.lookAt(look);

    // sky & fog follow altitude
    const [skyTop, skyBottom] = skyAt(this.floorPos);
    const root = document.documentElement.style;
    root.setProperty("--sky-top", `#${skyTop.getHexString()}`);
    root.setProperty("--sky-bottom", `#${skyBottom.getHexString()}`);
    this.fog.color.copy(skyBottom);
    this.fog.near = this.dist + 6; this.fog.far = this.dist + 80;
    (this.stars.material as THREE.PointsMaterial).opacity = THREE.MathUtils.clamp((this.floorPos - 1100) / 600, 0, 1);
    this.stars.position.y = y; this.stars.rotation.y = t * 0.01;

    // animated materials
    for (const m of matCache.values()) {
      if (m.userData.pulse) m.emissiveIntensity = (m.userData.base ??= m.emissiveIntensity) * (0.75 + 0.35 * Math.sin(t * 2.4));
      if (m.userData.water) m.opacity = 0.5 + 0.15 * Math.sin(t * 6);
    }
    this.clouds.rotation.y = t * 0.006;
    this.ghost.rotation.y = t * 0.3;
    (this.ghost.children[0] as THREE.Mesh).position.y = Math.sin(t * 1.5) * 0.15;

    // selection highlight
    if (this.selected) {
      const h = this.highlight, r = (this.radii[this.selected - 1] ?? ISLAND_R);
      const age = (now - this.selectedAt) / 1000;
      const arrived = !this.flight;
      h.visible = true;
      h.position.y = yOf(this.selected);
      const pulse = 1 + 0.05 * Math.sin(t * 4);
      const ring = h.getObjectByName("ring")!, ring2 = h.getObjectByName("ring2")!, beam = h.getObjectByName("beam") as THREE.Mesh, glow = h.getObjectByName("glow") as THREE.Mesh;
      ring.scale.setScalar((r + 0.55) * pulse); ring.position.y = 0.4;
      const w = (t * 0.7) % 1; ring2.scale.setScalar(r + 0.4 + w * 3); ring2.position.y = 0.4; ((ring2 as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - w) * 0.8;
      beam.scale.set(r + 0.7, 40, r + 0.7); beam.position.y = 20; (beam.material as THREE.MeshBasicMaterial).opacity = arrived ? 0.06 + 0.03 * Math.sin(t * 3) : 0.02;
      glow.scale.setScalar(r * 1.6); glow.position.y = 0.3; (glow.material as THREE.MeshBasicMaterial).opacity = arrived ? 0.05 + 0.03 * Math.sin(t * 3) : 0;
      const g = this.details.get(this.selected);
      if (g) { const pop = arrived ? 1 + 0.06 * Math.max(0, Math.sin(Math.min(age, 1.2) * Math.PI / 1.2)) : 1; g.scale.setScalar(pop); }
    } else this.highlight.visible = false;

    this.updateWindows();
    const cur = Math.round(this.floorPos);
    if (cur !== this.lastReported) { this.lastReported = cur; this.opts.onFloorChange(cur); }
    this.renderer.render(this.scene, this.camera);
    this.opts.onFrame();
    this.raf = requestAnimationFrame(this.tick);
  };

  private applyView() {
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    // keep the focused floor centred in the space not covered by the panel
    if (this.inset.right || this.inset.bottom) this.camera.setViewOffset(W, H, this.inset.right / 2, this.inset.bottom / 2, W, H);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }
  resize() {
    const W = this.canvas.clientWidth || innerWidth, H = this.canvas.clientHeight || innerHeight;
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    this.renderer.setSize(W, H, false);
    this.camera.aspect = W / H;
    // portrait screens need to back off so the island fits the width
    this.baseDist = W / H < 0.75 ? 60 : W / H < 1.2 ? 50 : 46;
    if (!this.flight) this.dist = this.baseDist * this.zoomK;
    this.applyView();
  }
}
