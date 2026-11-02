// The marina environment: sea, seabed, quay, hillside village, piers,
// breakwater + lighthouse, VIP berth decor and a few living details.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './util.js';
import {
  PIERS, PIER_WIDTH, PIER_HEIGHT, QUAY_HEIGHT, ROW_SPACING, FIRST_ROW_Z, pierX, vipBerth,
} from './layout.js';

// ---------------------------------------------------------------- helpers
function clean(g) {
  const geo = g.index ? g.toNonIndexed() : g;
  for (const n of Object.keys(geo.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'color') geo.deleteAttribute(n);
  return geo;
}
function paint(g, color, jitter = 0, rand = Math.random) {
  g = clean(g);
  const base = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  // jitter per triangle for a hand-made low-poly feel
  for (let i = 0; i < n; i += 3) {
    const k = 1 + (rand() - 0.5) * jitter;
    for (let j = 0; j < 3 && i + j < n; j++) {
      arr[(i + j) * 3] = base.r * k; arr[(i + j) * 3 + 1] = base.g * k; arr[(i + j) * 3 + 2] = base.b * k;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const boxG = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// ---------------------------------------------------------------- terrain
export function landHeight(x, z) {
  if (z > -12) return QUAY_HEIGHT;
  const d = -z - 12;
  const rise = d * 0.42 + Math.sin(x * 0.045 + 1.3) * Math.min(d, 30) * 0.12 + Math.sin(x * 0.11) * Math.min(d, 20) * 0.06;
  const bumps = Math.sin(x * 0.07 + z * 0.05) * 1.2 * Math.min(1, d / 15);
  return QUAY_HEIGHT + 0.3 + Math.max(0, rise + bumps);
}

// ---------------------------------------------------------------- water
function waterMaterial(theme) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color(theme.shallow) },
      uDeep: { value: new THREE.Color(theme.deep) },
      uSky: { value: new THREE.Color(theme.seaSky) },
      uFoam: { value: new THREE.Color(theme.foam) },
      uSun: { value: new THREE.Color(theme.sun) },
      uSunDir: { value: new THREE.Vector3(...theme.sunDir).normalize() },
      uFog: { value: new THREE.Color(theme.fog) },
      uFogNear: { value: theme.fogNear },
      uFogFar: { value: theme.fogFar },
    },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uShallow, uDeep, uSky, uFoam, uSun, uSunDir, uFog;
      uniform float uFogNear, uFogFar;
      varying vec3 vWorld;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      // Cheap animated caustic web
      float caustic(vec2 p, float t) {
        float c = 0.0;
        vec2 q = p;
        for (int i = 0; i < 3; i++) {
          q = vec2(q.x + sin(q.y * 0.9 + t * 0.7), q.y + cos(q.x * 0.8 - t * 0.6));
          c += abs(sin(q.x * 0.55) * sin(q.y * 0.55));
        }
        return pow(1.0 - clamp(c / 3.0, 0.0, 1.0), 6.0);
      }
      void main() {
        vec2 p = vWorld.xz;
        float t = uTime;
        // depth: shallow near the quay, deep further out to sea
        float depth = smoothstep(2.0, 75.0, p.y) ;
        depth = max(depth, smoothstep(-20.0, -60.0, p.x - 0.0) * 0.0);

        // wave normal from a few travelling sines
        vec2 g = vec2(0.0);
        g += vec2(0.7, 0.4) * cos(dot(p, vec2(0.21, 0.13)) + t * 1.1) * 0.06;
        g += vec2(-0.3, 0.9) * cos(dot(p, vec2(-0.09, 0.27)) + t * 1.4) * 0.05;
        g += vec2(0.9, -0.2) * cos(dot(p, vec2(0.37, -0.08)) - t * 1.7) * 0.03;
        g += (vec2(noise(p * 0.35 + t * 0.3), noise(p * 0.35 - t * 0.25 + 7.0)) - 0.5) * 0.12;
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));

        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);

        vec3 col = mix(uShallow, uDeep, depth);
        // caustics in the shallows
        col += uSun * caustic(p * 0.9, t) * (1.0 - depth) * 0.22;
        // sky reflection
        col = mix(col, uSky, fres * 0.3 + 0.02);
        // sun glint + sparkles
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(n, H), 0.0), 220.0) * 2.5;
        float sparkle = step(0.985, noise(p * 2.2 + vec2(t * 0.8, -t * 0.6))) * pow(max(dot(n, H), 0.0), 18.0) * 2.0;
        col += uSun * (spec + sparkle);

        // foam along the quay
        float qd = p.y;
        float foam = (1.0 - smoothstep(0.0, 1.1 + noise(vec2(p.x * 0.6, t)) * 0.8, qd)) * step(-0.5, qd);
        col = mix(col, uFoam, foam * 0.75);

        float alpha = mix(0.62, 0.96, depth) + foam * 0.3 + fres * 0.2;

        float dist = length(cameraPosition - vWorld);
        float fogF = smoothstep(uFogNear, uFogFar, dist);
        col = mix(col, uFog, fogF);
        alpha = mix(alpha, 1.0, fogF);
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }`,
  });
}

// ---------------------------------------------------------------- builder
export function buildWorld(scene, theme, size, seed = 7) {
  const rand = mulberry32(seed);
  const updaters = [];
  const vertexMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0, flatShading: true });
  const smoothMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.0 });
  const glowMat = new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffd27a', emissiveIntensity: 0.2 + theme.lampGlow });

  // Sea
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1400, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, 700 - 1), waterMaterial(theme));
  water.renderOrder = 2;
  scene.add(water);
  updaters.push((t) => { water.material.uniforms.uTime.value = t; });

  // Seabed (sand that falls away from the quay)
  {
    const g = new THREE.PlaneGeometry(1600, 700, 80, 70).rotateX(-Math.PI / 2).translate(0, 0, 350);
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const sand = new THREE.Color(theme.sand);
    const deep = new THREE.Color(theme.deep);
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i), x = pos.getX(i);
      const d = THREE.MathUtils.smoothstep(z, 0, 80);
      pos.setY(i, -0.9 - d * 12 - Math.sin(x * 0.2) * Math.sin(z * 0.25) * 0.25);
      const c = sand.clone().lerp(deep, d * 0.85);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const bed = new THREE.Mesh(g, smoothMat);
    bed.receiveShadow = true;
    scene.add(bed);
  }

  // Land: quay wall + promenade + hillside
  {
    const parts = [];
    parts.push(paint(boxG(1600, QUAY_HEIGHT + 3, 12, 0, (QUAY_HEIGHT - 3) / 2, -6), '#d9ccb2', 0.05, rand));
    parts.push(paint(boxG(1600, 0.06, 11.4, 0, QUAY_HEIGHT + 0.03, -5.9), '#f1e8d4', 0.02, rand));
    parts.push(paint(boxG(1600, 0.08, 0.6, 0, QUAY_HEIGHT + 0.04, -0.3), '#c8b796', 0.02, rand));
    const hill = new THREE.PlaneGeometry(1600, 260, 160, 40).rotateX(-Math.PI / 2).translate(0, 0, -12 - 130);
    const hp = hill.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i), z = hp.getZ(i);
      hp.setY(i, landHeight(x, Math.min(z, -12.01)) - (z > -12.5 ? 0.3 : 0));
    }
    const hillG = paint(hill, '#72b544', 0.14, rand);
    // darker grass higher up
    const hc = hillG.attributes.color, hpp = hillG.attributes.position;
    for (let i = 0; i < hc.count; i++) {
      const y = hpp.getY(i);
      const k = THREE.MathUtils.clamp((y - 2) / 40, 0, 1);
      hc.setXYZ(i, hc.getX(i) * (1 - k * 0.3), hc.getY(i) * (1 - k * 0.18), hc.getZ(i) * (1 - k * 0.35));
    }
    parts.push(hillG);
    const land = new THREE.Mesh(mergeGeometries(parts), vertexMat);
    land.receiveShadow = true;
    scene.add(land);
  }

  // Village houses, trees and palms
  {
    const parts = [];
    const walls = ['#fff8ec', '#ffe2b0', '#ffc9b5', '#fff0a0', '#cfe6ff', '#f9d7ea', '#ffffff', '#ffd59a', '#e9f7d9'];
    const roofs = ['#e2724a', '#d9623f', '#ec8a5a', '#c95a3a'];
    let placed = 0;
    for (let k = 0; k < 1600 && placed < 520; k++) {
      const x = -240 + rand() * 480;
      const z = -16 - Math.pow(rand(), 1.6) * 110;
      const y = landHeight(x, z);
      const w = 3 + rand() * 3.5, d = 3 + rand() * 3, h = 2.4 + rand() * 3.2;
      const rot = (rand() - 0.5) * 0.5;
      const wall = paint(boxG(w, h, d, 0, h / 2, 0), walls[Math.floor(rand() * walls.length)], 0.04, rand);
      const roof = paint(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.8 + rand(), 4).rotateY(Math.PI / 4).scale(w / Math.max(w, d), 1, d / Math.max(w, d)).translate(0, h + 0.9, 0), roofs[Math.floor(rand() * roofs.length)], 0.08, rand);
      for (const g of [wall, roof]) { g.rotateY(rot); g.translate(x, y - 0.3, z); parts.push(g); }
      placed++;
      if (rand() < 0.7) {
        const tx = x + (rand() - 0.5) * 9, tz = z + (rand() - 0.5) * 9, ty = landHeight(tx, tz);
        const s = 1 + rand() * 1.2;
        parts.push(paint(new THREE.CylinderGeometry(0.15 * s, 0.22 * s, 1.4 * s, 5).translate(tx, ty + 0.7 * s, tz), '#8a5a3b', 0.1, rand));
        parts.push(paint(new THREE.IcosahedronGeometry(1.3 * s, 0).translate(tx, ty + 2.1 * s, tz), rand() < 0.5 ? '#5fae4a' : '#4f9a45', 0.15, rand));
      }
    }
    // Cypress trees on the ridge
    for (let k = 0; k < 140; k++) {
      const x = -300 + rand() * 600, z = -40 - rand() * 100, y = landHeight(x, z);
      const s = 1 + rand() * 1.4;
      parts.push(paint(new THREE.ConeGeometry(0.9 * s, 5 * s, 6).translate(x, y + 2.3 * s, z), '#3f7f3a', 0.15, rand));
    }
    // Palms along the promenade
    for (let x = -300; x <= 300; x += 13) {
      const px = x + (rand() - 0.5) * 3, pz = -7.5 + (rand() - 0.5);
      const h = 5 + rand() * 1.5;
      const lean = (rand() - 0.5) * 0.25;
      const trunk = new THREE.CylinderGeometry(0.18, 0.28, h, 6).translate(0, h / 2, 0).rotateZ(lean);
      parts.push(paint(trunk.translate(px, QUAY_HEIGHT, pz), '#9b7653', 0.1, rand));
      const topX = px - Math.sin(lean) * h, topY = QUAY_HEIGHT + Math.cos(lean) * h;
      for (let f = 0; f < 7; f++) {
        const leaf = new THREE.ConeGeometry(0.45, 3.4, 4).rotateX(Math.PI / 2).scale(1, 0.25, 1).translate(0, 0, 1.6);
        leaf.rotateX(0.45).rotateY((f / 7) * Math.PI * 2 + rand() * 0.3);
        parts.push(paint(leaf.translate(topX, topY, pz), '#4caf50', 0.12, rand));
      }
    }
    const village = new THREE.Mesh(mergeGeometries(parts), vertexMat);
    village.castShadow = true; village.receiveShadow = true;
    scene.add(village);
  }

  // Promenade lamps (posts merged, bulbs glow at sunset / night)
  {
    const posts = [], bulbs = [];
    for (let x = -300; x <= 300; x += 13) {
      posts.push(paint(new THREE.CylinderGeometry(0.07, 0.09, 3, 6).translate(x + 6.5, QUAY_HEIGHT + 1.5, -1.6), '#2b3242'));
      bulbs.push(clean(new THREE.SphereGeometry(0.28, 8, 6).translate(x + 6.5, QUAY_HEIGHT + 3.1, -1.6)));
    }
    const p = new THREE.Mesh(mergeGeometries(posts), vertexMat); p.castShadow = true; scene.add(p);
    scene.add(new THREE.Mesh(mergeGeometries(bulbs), glowMat));
  }

  // Piers
  const pierGroup = new THREE.Group();
  scene.add(pierGroup);
  function buildPiers(pierLength) {
    pierGroup.clear();
    const parts = [], bulbs = [];
    for (let p = 0; p < PIERS; p++) {
      const x = pierX(p);
      parts.push(paint(boxG(PIER_WIDTH, 0.22, pierLength, x, PIER_HEIGHT - 0.11, pierLength / 2), '#d8b98a', 0.08, rand));
      // planks
      for (let z = 0.4; z < pierLength; z += 0.8) parts.push(paint(boxG(PIER_WIDTH + 0.02, 0.02, 0.06, x, PIER_HEIGHT + 0.005, z), '#b8956a'));
      for (let r = 0; ; r++) {
        const z = FIRST_ROW_Z + r * ROW_SPACING - ROW_SPACING / 2;
        if (z > pierLength) break;
        for (const s of [-1, 1]) {
          parts.push(paint(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6).translate(x + s * (PIER_WIDTH / 2 + 0.05), -0.2, z), '#7a5a3c'));
          parts.push(paint(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 8).translate(x + s * (PIER_WIDTH / 2 - 0.15), PIER_HEIGHT + 0.15, z), '#2b3242'));
          // finger pontoon between berths
          parts.push(paint(boxG(5.4, 0.12, 0.45, x + s * (PIER_WIDTH / 2 + 2.7), PIER_HEIGHT - 0.25, z), '#e2c79c', 0.06, rand));
        }
        if (r % 3 === 1) {
          parts.push(paint(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6).translate(x, PIER_HEIGHT + 0.8, z), '#2b3242'));
          bulbs.push(clean(new THREE.SphereGeometry(0.17, 8, 6).translate(x, PIER_HEIGHT + 1.65, z)));
        }
      }
      // pier head
      parts.push(paint(boxG(PIER_WIDTH * 2.4, 0.22, 1.8, x, PIER_HEIGHT - 0.11, pierLength + 0.6), '#d8b98a', 0.08, rand));
    }
    const m = new THREE.Mesh(mergeGeometries(parts), vertexMat);
    m.castShadow = true; m.receiveShadow = true;
    pierGroup.add(m);
    if (bulbs.length) pierGroup.add(new THREE.Mesh(mergeGeometries(bulbs), glowMat));
  }
  buildPiers(size.pierLength);

  // Breakwater + lighthouse on the east side
  {
    const parts = [];
    const bx = size.right + 9;
    const len = size.pierLength + 26;
    for (let z = -2; z < len; z += 1.6) {
      for (let k = 0; k < 3; k++) {
        const r = 1.6 + rand() * 1.8;
        const g = new THREE.IcosahedronGeometry(r, 0);
        g.rotateX(rand() * 3).rotateY(rand() * 3).scale(1, 0.7, 1);
        g.translate(bx + (rand() - 0.5) * 6, -0.2 + rand() * 0.9, z + (rand() - 0.5) * 1.5);
        parts.push(paint(g, rand() < 0.5 ? '#b9b3a8' : '#a39d93', 0.18, rand));
      }
    }
    parts.push(paint(boxG(3.2, 0.3, len, bx, 1.6, len / 2), '#e6ddc8', 0.04, rand));
    const lz = len + 1;
    parts.push(paint(new THREE.CylinderGeometry(3.4, 3.8, 1.6, 10).translate(bx, 0.9, lz), '#e6ddc8'));
    for (let i = 0; i < 5; i++) {
      const h0 = 1.7 + i * 2.1;
      const r0 = 1.6 - i * 0.12;
      parts.push(paint(new THREE.CylinderGeometry(r0 - 0.12, r0, 2.1, 12).translate(bx, h0 + 1.05, lz), i % 2 ? '#e2412f' : '#ffffff'));
    }
    parts.push(paint(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 12).translate(bx, 12.4, lz), '#2b3242'));
    parts.push(paint(new THREE.ConeGeometry(1.1, 1.3, 12).translate(bx, 14.6, lz), '#e2412f'));
    const m = new THREE.Mesh(mergeGeometries(parts), vertexMat);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.3, 12).translate(bx, 13.2, lz), glowMat);
    scene.add(lantern);
  }

  // VIP berth decor
  const vip = vipBerth();
  const vipGroup = new THREE.Group();
  scene.add(vipGroup);
  {
    const parts = [];
    // red carpet + gold rope posts along the quay
    parts.push(paint(boxG(vip.length + 2, 0.04, 2.2, vip.x, QUAY_HEIGHT + 0.07, -2.0), '#c0213a'));
    parts.push(paint(boxG(2.2, 0.04, 7, vip.x, QUAY_HEIGHT + 0.07, -6.5), '#c0213a'));
    for (let i = 0; i <= 8; i++) {
      const x = vip.x - (vip.length + 2) / 2 + (i / 8) * (vip.length + 2);
      parts.push(paint(new THREE.CylinderGeometry(0.09, 0.12, 1.0, 8).translate(x, QUAY_HEIGHT + 0.55, -3.3), '#f2b43a'));
      parts.push(paint(new THREE.SphereGeometry(0.15, 8, 6).translate(x, QUAY_HEIGHT + 1.1, -3.3), '#ffd35a'));
    }
    const m = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.5 }));
    m.castShadow = true; vipGroup.add(m);

    // VIP sign
    const c = document.createElement('canvas'); c.width = 1024; c.height = 384;
    const ctx = c.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, 0, 384);
    grd.addColorStop(0, '#1a2238'); grd.addColorStop(1, '#0d1222');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.roundRect(8, 8, 1008, 368, 60); ctx.fill();
    ctx.lineWidth = 16; ctx.strokeStyle = '#f2b43a'; ctx.stroke();
    ctx.fillStyle = '#ffd35a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '400 190px "Lilita One"'; ctx.fillText('VIP', 512, 165);
    ctx.font = '900 64px Nunito'; ctx.fillStyle = '#ffffff'; ctx.fillText('BERTH OF THE DAY', 512, 300);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    vipGroup.userData.signTexture = tex;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.6 }));
    sign.position.set(vip.x, QUAY_HEIGHT + 3.4, -8.5);
    sign.rotation.x = -0.25;
    sign.castShadow = true;
    vipGroup.add(sign);
    const legs = new THREE.Mesh(
      mergeGeometries([paint(boxG(0.25, 2.2, 0.25, vip.x - 3.2, QUAY_HEIGHT + 1.1, -8.7), '#f2b43a'), paint(boxG(0.25, 2.2, 0.25, vip.x + 3.2, QUAY_HEIGHT + 1.1, -8.7), '#f2b43a')]),
      new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.3 }));
    vipGroup.add(legs);

    // glowing berth outline on the water
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffcf4a', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 64), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(vip.length * 0.62, 3.6, 1);
    ring.position.set(vip.x, 0.08, vip.z);
    ring.renderOrder = 3;
    vipGroup.add(ring);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: '#ffb92e', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2;
    fill.scale.copy(ring.scale);
    fill.position.copy(ring.position);
    fill.renderOrder = 3;
    vipGroup.add(fill);
    vipGroup.userData.ring = ring;
    vipGroup.userData.fill = fill;
    updaters.push((t) => {
      const k = 0.5 + 0.5 * Math.sin(t * 3.2);
      ring.material.opacity = (0.35 + 0.45 * k) * (vipGroup.userData.glow ?? 1);
      fill.material.opacity = (0.06 + 0.1 * k) * (vipGroup.userData.glow ?? 1);
      const s = 1 + 0.04 * k;
      ring.scale.set(vip.length * 0.62 * s, 3.6 * s, 1);
    });
  }

  // Buoys marking the entrance
  {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const x = (i % 2 ? size.right + 2 : size.left - 4) ;
      const z = size.pierLength + 10 + Math.floor(i / 2) * 14;
      parts.push(paint(new THREE.CylinderGeometry(0.35, 0.55, 1.3, 8).translate(x, 0.4, z), i % 2 ? '#2fae4f' : '#e2412f'));
      parts.push(paint(new THREE.SphereGeometry(0.25, 8, 6).translate(x, 1.2, z), '#ffffff'));
    }
    const m = new THREE.Mesh(mergeGeometries(parts), smoothMat);
    m.castShadow = true;
    scene.add(m);
    updaters.push((t) => { m.position.y = Math.sin(t * 1.6) * 0.08; });
  }

  // Distant sailboats
  {
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 1).translate(0, 0.2, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }));
      const sail = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1.2, 0.5, 0, 1.0, 0.5, 0, -0.9, 5, 0], 3)).computeVertexNormals(), new THREE.MeshStandardMaterial({ color: '#fffaf0', side: THREE.DoubleSide, roughness: 0.6 }));
      g.add(hull, sail);
      hull.castShadow = sail.castShadow = true;
      const baseX = -200 + rand() * 400, z = size.pierLength + 70 + rand() * 120, speed = 1 + rand() * 1.5;
      g.position.set(baseX, 0, z);
      scene.add(g);
      updaters.push((t) => {
        g.position.x = baseX + t * speed;
        g.rotation.z = Math.sin(t * 1.2 + i) * 0.04;
      });
    }
  }

  // Seagulls
  {
    const gullGeo = new THREE.BufferGeometry();
    gullGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, -1.1, 0, -0.35, -0.2, 0, 0.25,
      0, 0, 0, 1.1, 0, -0.35, 0.2, 0, 0.25,
    ], 3));
    gullGeo.computeVertexNormals();
    const gullMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const gull = new THREE.Mesh(gullGeo.clone(), gullMat);
      const cx = -40 + rand() * 80, cz = 5 + rand() * 40, r = 12 + rand() * 18, h = 14 + rand() * 10, sp = 0.25 + rand() * 0.2, ph = rand() * 6;
      scene.add(gull);
      const pos = gullGeo.attributes.position.array.slice();
      updaters.push((t) => {
        const a = ph + t * sp;
        gull.position.set(cx + Math.cos(a) * r, h + Math.sin(t * 0.7 + ph) * 1.5, cz + Math.sin(a) * r);
        gull.rotation.y = -a;
        const flap = Math.sin(t * 7 + ph) * 0.45;
        const arr = gull.geometry.attributes.position.array;
        arr[4] = pos[4] + flap; arr[13] = pos[13] + flap;
        gull.geometry.attributes.position.needsUpdate = true;
      });
    }
  }

  return {
    vipGroup,
    update(t) { for (const u of updaters) u(t); },
  };
}
