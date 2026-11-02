// Procedural low-poly yachts. One merged, vertex-coloured mesh per yacht
// (+ glass, name plates and a flag) so hundreds of yachts stay fast.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const geoCache = new Map();
const textCache = new Map();

export const SIZES = {
  normal: { L: 6.4, W: 2.35, decks: 2 },
  super: { L: 19, W: 4.6, decks: 3 },
};

function hullShape(L, W) {
  const s = new THREE.Shape();
  s.moveTo(-L / 2, -W / 2);
  s.lineTo(L * 0.1, -W / 2);
  s.quadraticCurveTo(L * 0.42, -W / 2, L / 2, 0);
  s.quadraticCurveTo(L * 0.42, W / 2, L * 0.1, W / 2);
  s.lineTo(-L / 2, W / 2);
  s.closePath();
  return s;
}

function cabinShape(x0, x1, xNose, w) {
  const s = new THREE.Shape();
  s.moveTo(x0, -w / 2);
  s.lineTo(x1, -w / 2);
  s.quadraticCurveTo(xNose, -w / 2, xNose, 0);
  s.quadraticCurveTo(xNose, w / 2, x1, w / 2);
  s.lineTo(x0, w / 2);
  s.closePath();
  return s;
}

function clean(g) {
  let geo = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(geo.attributes)) {
    if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
  }
  return geo;
}

function paint(g, color) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Extrude a top-view shape upward from y0 by h. */
function slab(shape, y0, h, color, { scale = 1, bevel = 0.06, curve = 10 } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: h, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curve,
  });
  g.rotateX(-Math.PI / 2);
  if (scale !== 1) g.scale(scale, 1, scale);
  g.translate(0, y0, 0);
  g.computeVertexNormals();
  return paint(clean(g), color);
}

function box(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return paint(clean(g), color);
}

function cyl(rt, rb, h, x, y, z, color, seg = 10) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y, z);
  return paint(clean(g), color);
}

function sphere(r, x, y, z, color, seg = 8) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1));
  g.translate(x, y, z);
  return paint(clean(g), color);
}

function luminance(hex) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/**
 * Build (and cache) geometries for a yacht look.
 * Returns { body, glass, bulbs } BufferGeometries in local space (bow → +x).
 */
function buildGeometry(look) {
  const key = JSON.stringify(look);
  if (geoCache.has(key)) return geoCache.get(key);
  const { L, W, decks } = SIZES[look.size];
  const hull = look.hull, accent = look.accent;
  const teak = '#c99a64', white = '#f7f5ef';
  const bottom = luminance(hull) < 0.08 ? '#7a1f2b' : '#1d2a44';
  const parts = [], glass = [], bulbs = [];
  const hs = hullShape(L, W);

  // Hull: antifouling below the waterline, hull colour above, accent stripe.
  parts.push(slab(hs, -0.7, 0.62, bottom, { scale: 0.985, bevel: 0.05 }));
  parts.push(slab(hs, -0.08, 0.78, hull, { bevel: 0.07 }));
  parts.push(slab(hs, 0.5, 0.1, accent, { scale: 1.03, bevel: 0.04 }));
  parts.push(slab(hs, 0.74, 0.04, teak, { scale: 0.93, bevel: 0.02 }));
  // Swim platform
  parts.push(box(0.55, 0.08, W * 0.86, -L / 2 - 0.22, 0.12, 0, teak));

  // Superstructure decks
  let y = 0.8;
  const deckH = look.size === 'super' ? 1.0 : 0.56;
  for (let d = 0; d < decks; d++) {
    const t = d / decks;
    const x0 = -L * (0.36 - t * 0.08);
    const x1 = L * (0.06 - t * 0.1);
    const nose = L * (0.25 - t * 0.12);
    const w = W * (0.7 - d * 0.12);
    const cs = cabinShape(x0, x1, nose, w);
    parts.push(slab(cs, y, deckH, white, { bevel: 0.04, curve: 8 }));
    glass.push(clean(slab(cs, y + deckH * 0.3, deckH * 0.42, '#000', { scale: 1.035, bevel: 0.02, curve: 8 })));
    // overhanging roof plate
    parts.push(slab(cabinShape(x0 - 0.1, x1, nose + 0.08, w + 0.12), y + deckH, 0.05, white, { bevel: 0.03, curve: 8 }));
    y += deckH + 0.06;
  }
  const topY = y;

  // Radar arch + dome
  const archX = -L * 0.14;
  parts.push(box(0.18, 0.7, 0.18, archX, topY + 0.35, 0, white));
  parts.push(sphere(0.2, archX, topY + 0.78, 0, white));
  parts.push(box(0.6, 0.06, 0.14, archX, topY + 0.6, 0, '#2a3346'));

  // Accent: gold trim on the top deck edge for super yachts
  if (look.size === 'super') {
    parts.push(slab(hs, 0.84, 0.05, accent, { scale: 0.95, bevel: 0.01 }));
  }

  const extras = new Set(look.extras || []);
  if (extras.has('pool')) {
    const px = look.size === 'super' ? L * 0.33 : L * 0.3;
    parts.push(box(L * 0.13, 0.1, W * 0.48, px, 0.82, 0, '#f2f2f2'));
    parts.push(box(L * 0.11, 0.11, W * 0.4, px, 0.83, 0, '#33d6ff'));
  }
  if (extras.has('helipad')) {
    const hx = look.size === 'super' ? -L * 0.12 : -L * 0.2;
    const r = look.size === 'super' ? 1.7 : 0.8;
    parts.push(cyl(r, r, 0.06, hx, topY + 0.04, 0, '#3a4252', 20));
    const ring = new THREE.TorusGeometry(r * 0.72, r * 0.06, 4, 24);
    ring.rotateX(Math.PI / 2); ring.translate(hx, topY + 0.09, 0);
    parts.push(paint(clean(ring), '#ffffff'));
    parts.push(box(r * 0.12, 0.04, r * 0.7, hx - r * 0.2, topY + 0.09, 0, '#ffffff'));
    parts.push(box(r * 0.12, 0.04, r * 0.7, hx + r * 0.2, topY + 0.09, 0, '#ffffff'));
    parts.push(box(r * 0.4, 0.04, r * 0.1, hx, topY + 0.09, 0, '#ffffff'));
  }
  if (extras.has('jetski')) {
    const js = hullShape(1.5, 0.6);
    const g = slab(js, -0.05, 0.3, accent, { bevel: 0.03 });
    g.translate(-L / 2 - 1.3, 0, W * 0.15);
    parts.push(g);
    parts.push(box(0.3, 0.2, 0.2, -L / 2 - 1.4, 0.35, W * 0.15, '#1d2a44'));
  }
  if (extras.has('lights')) {
    const palette = ['#ff4d6d', '#ffd23f', '#3ddc97', '#4dabff', '#c77dff'];
    const n = look.size === 'super' ? 22 : 12;
    const top = new THREE.Vector3(archX, topY + 0.9, 0);
    const bow = new THREE.Vector3(L / 2, 0.9, 0), stern = new THREE.Vector3(-L / 2, 0.9, 0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const p = t < 0.5 ? bow.clone().lerp(top, t * 2) : top.clone().lerp(stern, (t - 0.5) * 2);
      p.y -= Math.sin(((t * 2) % 1) * Math.PI) * 0.25;
      bulbs.push(sphere(look.size === 'super' ? 0.11 : 0.07, p.x, p.y, p.z, palette[i % palette.length], 6));
    }
  }

  // Flag pole
  parts.push(cyl(0.035, 0.035, 1.6, -L / 2 + 0.25, 1.5, 0, '#d9d9d9', 6));

  const out = {
    body: mergeGeometries(parts),
    glass: mergeGeometries(glass),
    bulbs: bulbs.length ? mergeGeometries(bulbs) : null,
    topY,
  };
  out.body.computeBoundingSphere();
  geoCache.set(key, out);
  return out;
}

export function makeYachtMaterials(theme) {
  return {
    body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05 }),
    glass: new THREE.MeshStandardMaterial({
      color: '#22406b', roughness: 0.08, metalness: 0.35,
      emissive: new THREE.Color('#ffcf85'), emissiveIntensity: theme.windowGlow * 0.5,
    }),
    bulbs: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.3, emissive: '#ffffff', emissiveIntensity: 0.25 + theme.lampGlow * 0.6,
    }),
    hologram: new THREE.MeshBasicMaterial({
      color: '#ffc531', transparent: true, opacity: 0.45, depthWrite: false,
    }),
    hologramLines: new THREE.LineBasicMaterial({
      color: '#fff1b8', transparent: true, opacity: 0.9, depthWrite: false,
    }),
  };
}

function nameTexture(text, dark, isSuper) {
  const key = `${text}|${dark}|${isSuper}`;
  if (textCache.has(key)) return textCache.get(key);
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 160;
  const ctx = c.getContext('2d');
  let size = 124;
  ctx.font = `900 ${size}px Nunito`;
  while (ctx.measureText(text).width > 980 && size > 30) { size -= 4; ctx.font = `900 ${size}px Nunito`; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = dark ? (isSuper ? '#ffcf4a' : '#ffffff') : '#14213d';
  ctx.fillText(text, 512, 86);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  textCache.set(key, tex);
  return tex;
}

const nameMatCache = new Map();
function nameMaterial(tex) {
  if (nameMatCache.has(tex)) return nameMatCache.get(tex);
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: true });
  // Pull slightly toward the camera so it never z-fights with the hull.
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  nameMatCache.set(tex, m);
  return m;
}

/**
 * Create a yacht Object3D.
 * spec: { name, hull, accent, extras, size:'normal'|'super', flagTexture }
 */
export function createYacht(spec, mats) {
  const look = {
    size: spec.size || 'normal',
    hull: spec.hull || '#f7f5ef',
    accent: spec.accent || '#1d4ed8',
    extras: [...(spec.extras || [])].sort(),
  };
  const geo = buildGeometry(look);
  const { L, W } = SIZES[look.size];
  const root = new THREE.Group();
  const bob = new THREE.Group(); // receives bobbing / roll
  root.add(bob);

  const body = new THREE.Mesh(geo.body, mats.body);
  body.castShadow = true; body.receiveShadow = true;
  bob.add(body);
  const glass = new THREE.Mesh(geo.glass, mats.glass);
  glass.castShadow = false;
  bob.add(glass);
  if (geo.bulbs) bob.add(new THREE.Mesh(geo.bulbs, mats.bulbs));

  // Name on both sides of the hull
  if (spec.name) {
    const dark = luminance(look.hull) < 0.25;
    const mat = nameMaterial(nameTexture(spec.name, dark, look.size === 'super'));
    const w = L * 0.62, h = w / 6.4;
    const plane = new THREE.PlaneGeometry(w, h);
    const yMid = look.size === 'super' ? 0.3 : 0.26;
    const front = new THREE.Mesh(plane, mat);
    front.position.set(-L * 0.17, yMid, W / 2 + 0.1);
    bob.add(front);
    const back = new THREE.Mesh(plane, mat);
    back.position.set(-L * 0.17, yMid, -W / 2 - 0.1);
    back.rotation.y = Math.PI;
    bob.add(back);
    // Transom (stern): the name you read when the yacht is moored in its berth.
    const tw = W * 0.9;
    const stern = new THREE.Mesh(new THREE.PlaneGeometry(tw, tw / 6.4), mat);
    stern.position.set(-L / 2 - 0.1, look.size === 'super' ? 0.5 : 0.42, 0);
    stern.rotation.y = -Math.PI / 2;
    bob.add(stern);
  }

  if (spec.flagTexture) {
    const fs = look.size === 'super' ? 1.6 : 1;
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95 * fs, 0.71 * fs),
      new THREE.MeshStandardMaterial({ map: spec.flagTexture, side: THREE.DoubleSide, roughness: 0.8 }),
    );
    flag.position.set(-L / 2 + 0.25 - 0.5 * fs, 2.0 + (fs - 1) * 0.6, 0);
    flag.castShadow = true;
    bob.add(flag);
    root.userData.flag = flag;
  }

  root.userData.length = L;
  root.userData.width = W;
  root.userData.topY = geo.topY;
  root.userData.bob = bob;
  return root;
}

/** Translucent gold "ghost" of a yacht, used to tease the empty VIP berth. */
export function createHologram(mats, size = 'super') {
  const look = { size, hull: '#ffffff', accent: '#ffffff', extras: ['helipad', 'pool'] };
  const geo = buildGeometry(look);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo.body, mats.hologram));
  const edges = new THREE.EdgesGeometry(geo.body, 25);
  g.add(new THREE.LineSegments(edges, mats.hologramLines));
  return g;
}
