// SISTER SURVIVAL SCOOPS — sarcastic daily series. Day 1.
// A glossy 3D sundae cone built live (scoop drop, fudge drips, sprinkles rain, cherry bounce)
// under the exact on-screen text, then the sarcastic punchline and the call to comment.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
const seg = (t, a, b) => clamp((t - a) / (b - a));
function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// text with Twemoji images (same look on every machine)
const emojiRe = /\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu;
const code = (e) => [...e].map((c) => c.codePointAt(0).toString(16)).filter((c) => c !== 'fe0f').join('-');
const withEmoji = (s) => s.replace(/[&<]/g, (c) => ({ '&': '&amp;', '<': '&lt;' }[c])).replace(emojiRe, (e) => `<img class="em" src="/node_modules/@twemoji/svg/${code(e)}.svg">`);

function scoopGeo(r, R, wob = 1) {
  const g = new THREE.SphereGeometry(r, 128, 96); const p = g.attributes.position, v = new THREE.Vector3();
  const ph = R() * 10;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const d = v.clone().normalize();
    const th = Math.atan2(d.z, d.x);
    let k = 1 + 0.03 * wob * (Math.sin(d.x * 6 + ph) * Math.sin(d.y * 5 + ph * 1.3) + 0.6 * Math.sin(d.z * 8 - ph)) + 0.012 * Math.sin(th * 23 + d.y * 9);
    v.multiplyScalar(k);
    if (d.y < -0.45) { // flat-ish bottom with a ruffled scooped lip
      const s = clamp((-0.45 - d.y) / 0.4);
      v.y = lerp(v.y, -r * 0.5, s);
      const lip = Math.sin(Math.PI * clamp((-0.45 - d.y) / 0.25)) * (1 + 0.5 * Math.sin(th * 13 + ph));
      v.x *= 1 + 0.1 * lip; v.z *= 1 + 0.1 * lip;
    }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
/** A drip running down a sphere (centre c, radius r) along a meridian from polar angle a0, length len (rad). */
function dripGeo(r, az, a0, len, thick) {
  const pts = []; for (let k = 0; k <= 24; k++) { const th = a0 + (k / 24) * len, rr = r; pts.push(new THREE.Vector3(Math.sin(th) * Math.cos(az) * rr, Math.cos(th) * rr, Math.sin(th) * Math.sin(az) * rr)); }
  const curve = new THREE.CatmullRomCurve3(pts); const g = new THREE.TubeGeometry(curve, 64, thick, 14, false);
  return { g, end: pts[pts.length - 1], curve };
}
function waffleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#e2a861'); gr.addColorStop(1, '#c98a45'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#9a5f2a'; g.lineWidth = 10;
  for (let k = -512; k < 1024; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 512, 512); g.stroke(); g.beginPath(); g.moveTo(k, 512); g.lineTo(k + 512, 0); g.stroke(); }
  g.strokeStyle = 'rgba(255,230,180,0.5)'; g.lineWidth = 3;
  for (let k = -512; k < 1024; k += 64) { g.beginPath(); g.moveTo(k + 6, 0); g.lineTo(k + 518, 512); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function create(stage, opts = {}) {
  const R = rng(Number(opts.seed || 5));
  stage.style.background = 'radial-gradient(120% 80% at 50% 62%, #fff1e6 0%, #ffd6dc 38%, #f7b6c8 70%, #e99ab4 100%)';
  // soft bokeh
  const bok = document.createElement('div'); bok.style.cssText = 'position:absolute;inset:0;';
  for (let i = 0; i < 18; i++) { const d = document.createElement('div'); const s = 40 + R() * 140; d.style.cssText = `position:absolute;left:${R() * 1080 - 60}px;top:${R() * 1920 - 60}px;width:${s}px;height:${s}px;border-radius:50%;background:rgba(255,255,255,${0.12 + R() * 0.18});filter:blur(${4 + R() * 10}px)`; bok.appendChild(d); }
  stage.appendChild(bok);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(1080, 1920, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.1, 100);

  const key = new THREE.DirectionalLight(0xfff2e0, 2.6); key.position.set(3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -4 }); key.shadow.radius = 8; scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc0d8, 2.2); rim.position.set(-4, 3, -4); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xf0b0c0, 0.5));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -2.6; floor.receiveShadow = true; scene.add(floor);

  const cream = new THREE.Group(); scene.add(cream);
  // waffle cone
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.66, 1.9, 96, 1, true), new THREE.MeshStandardMaterial({ map: waffleTexture(), roughness: 0.75, side: THREE.DoubleSide }));
  cone.rotation.x = Math.PI; cone.position.y = -0.95; cone.castShadow = true; cream.add(cone);
  const rimM = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.07, 24, 96), new THREE.MeshStandardMaterial({ color: 0xd99a55, roughness: 0.7 })); rimM.rotation.x = Math.PI / 2; cream.add(rimM);

  const mat = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.6, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.6, ...o });
  const flavors = [
    { c: 0x7a4228, r: 0.74, y: 0.42 },  // chocolate
    { c: 0xf7a2ba, r: 0.68, y: 1.36 },  // strawberry
    { c: 0xfbe4b4, r: 0.62, y: 2.2 },   // vanilla (drops in)
  ];
  const scoops = flavors.map((f) => { const m = new THREE.Mesh(scoopGeo(f.r, R), mat(f.c)); m.castShadow = true; m.position.y = f.y; cream.add(m); return m; });
  // strawberry bits + vanilla bean specks
  const speck = (sc, col, n, size) => { for (let i = 0; i < n; i++) { const d = new THREE.Vector3(R() - 0.5, R() * 0.9 - 0.1, R() - 0.5).normalize(); const m = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 })); m.position.copy(d.multiplyScalar(flavors[sc].r * 1.0)); scoops[sc].add(m); } };
  speck(1, 0xd8435f, 26, 0.03); speck(2, 0x3a2414, 40, 0.012);
  // melting drips down the cone from the chocolate scoop
  const melt = [];
  for (let i = 0; i < 0; i++) { const az = R() * Math.PI * 2, len = 0.25 + R() * 0.3; const pts = []; for (let k = 0; k <= 12; k++) { const y = -0.02 - (k / 12) * len, rr = 0.66 * (1 + y / 1.9) + 0.035; pts.push(new THREE.Vector3(Math.cos(az) * rr, y, Math.sin(az) * rr)); }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.045, 10, false); const m = new THREE.Mesh(g, mat(0x7a4228, { roughness: 0.22, clearcoat: 0.9 })); m.castShadow = true; cream.add(m);
    const dropM = new THREE.Mesh(new THREE.SphereGeometry(0.065, 20, 14), m.material); dropM.position.copy(pts[pts.length - 1]); cream.add(dropM); melt.push({ m, dropM, idx: g.index.count }); }
  // hot fudge on top of the vanilla scoop + drips
  const fudgeM = mat(0x3a1a0c, { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0 });
  const top = flavors[2];
  const cap = new THREE.Mesh(new THREE.SphereGeometry(top.r * 1.05, 96, 48, 0, Math.PI * 2, 0, 1.1), fudgeM); cap.position.y = top.y; cream.add(cap);
  const drips = []; for (let i = 0; i < 10; i++) { const az = (i / 10) * Math.PI * 2 + R() * 0.35, len = 0.35 + R() * 0.75; const { g, end } = dripGeo(top.r * 1.035, az, 1.0, len, 0.05 + R() * 0.02); const m = new THREE.Mesh(g, fudgeM); m.position.y = top.y; cream.add(m);
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), fudgeM); drop.position.copy(end).add(new THREE.Vector3(0, top.y, 0)); cream.add(drop); drips.push({ m, drop, idx: g.index.count, end }); }
  // sprinkles (instanced)
  const NS = 170, sg = new THREE.CapsuleGeometry(0.024, 0.1, 4, 8);
  const sm = new THREE.MeshStandardMaterial({ roughness: 0.4 }); const spr = new THREE.InstancedMesh(sg, sm, NS); spr.frustumCulled = false; spr.castShadow = true; cream.add(spr);
  const cols = [0xff4d7d, 0x4dc3ff, 0xffd23f, 0x7ee081, 0xb07cff, 0xffffff, 0xff8a3d];
  const sp = Array.from({ length: NS }, (_, i) => { spr.setColorAt(i, new THREE.Color(cols[i % cols.length])); const d = new THREE.Vector3(R() - 0.5, 0.75 + R() * 0.9, R() - 0.5).normalize(); return { d, t0: 0, rot: new THREE.Euler(R() * 6, R() * 6, R() * 6), fall: R() }; });
  spr.instanceColor.needsUpdate = true;
  // cherry
  const cherry = new THREE.Group();
  const cb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 48, 32), new THREE.MeshPhysicalMaterial({ color: 0xc4102a, roughness: 0.08, clearcoat: 1 })); cb.castShadow = true; cherry.add(cb);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(0.05, 0.3, 0), new THREE.Vector3(0.16, 0.45, 0)]), 20, 0.018, 8), new THREE.MeshStandardMaterial({ color: 0x4f6a2a, roughness: 0.6 })); cherry.add(stem);
  cream.add(cherry);

  // ---------------- on-screen text (exactly as given)
  const css = document.createElement('style');
  css.textContent = `.cap{position:absolute;left:40px;right:40px;text-align:center;font-family:Nunito,sans-serif;font-weight:900;color:#fff;line-height:1.18;
    text-shadow:0 0 2px #2a1018,0 3px 0 #2a1018,3px 0 0 #2a1018,-3px 0 0 #2a1018,0 -3px 0 #2a1018,2px 2px 0 #2a1018,-2px -2px 0 #2a1018,2px -2px 0 #2a1018,-2px 2px 0 #2a1018,0 10px 24px rgba(80,20,40,.35);
    opacity:0;transition:none}.cap .em{height:1.05em;width:1.05em;vertical-align:-0.16em;margin:0 0.03em;filter:drop-shadow(0 3px 0 rgba(42,16,24,.6))}`;
  document.head.appendChild(css);
  const mk = (lines, top, size) => { const d = document.createElement('div'); d.className = 'cap'; d.style.top = top + 'px'; stage.appendChild(d);
    for (const ln of [].concat(lines)) { const r = document.createElement('div'); const sp = document.createElement('span'); sp.style.whiteSpace = 'nowrap'; sp.style.display = 'inline-block'; sp.style.fontSize = size + 'px'; sp.innerHTML = withEmoji(ln); r.appendChild(sp); d.appendChild(r); let fs = size; while (sp.offsetWidth > 960 && fs > 30) { fs -= 2; sp.style.fontSize = fs + 'px'; } }
    return d; };
  const L = opts.lines ? JSON.parse(opts.lines) : null;
  const hook = mk(L?.hook || ['Did you know buying your sister🍦', '🍦ICE CREAM 🍦🍦eveny week helps', 'You live longer🤝🫶'], 270, 66);
  const punch = mk(L?.punch || ['…because she can’t kill you', 'while she’s eating 🙂🍦'], 290, 64);
  const cta = mk(L?.cta || ['Brothers: send this to her 📤🍦', 'Sisters: send it to him 👀🍦'], 270, 64);
  const cta2 = mk(L?.cta2 || ['No 🍦 back in 24h?', '…run. 🏃'], 1330, 62);

  const duration = Number(opts.dur || 15);
  const T = { scoop: 2.0, fudge: 3.0, sprinkle: 4.2, cherry: 6.6 };
  sp.forEach((s, i) => { s.t0 = T.sprinkle + (i / NS) * 1.8 + s.fall * 0.2; });

  function renderFrame(t) {
    // camera: slow push-in, ice cream turns gently
    const k = t / duration;
    camera.position.set(Math.sin(t * 0.2) * 0.35, 1.4 + k * 0.2, lerp(11.6, 10.6, easeOut(k)));
    camera.lookAt(0, 1.0 - k * 0.05, 0);
    cream.rotation.y = 0.4 + t * 0.32;
    cream.position.y = -0.55 + Math.sin(t * 1.4) * 0.03;
    // vanilla scoop drops in with a squash
    const s3 = scoops[2], u = seg(t, T.scoop - 0.55, T.scoop), land = seg(t, T.scoop, T.scoop + 0.35);
    s3.position.y = top.y + (1 - u * u) * 4.5; const sq = land > 0 && land < 1 ? 1 - 0.14 * Math.sin(Math.PI * land) : 1; s3.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); s3.visible = t > T.scoop - 0.55;
    // fudge: cap fades/grows in, drips grow down
    const fk = easeOut(seg(t, T.fudge, T.fudge + 0.5)); cap.visible = fk > 0; cap.scale.set(1 + (1 - fk) * 0.2, Math.max(0.01, fk), 1 + (1 - fk) * 0.2); cap.position.y = top.y + (1 - fk) * 0.3;
    drips.forEach((d, i) => { const g = easeOut(seg(t, T.fudge + 0.25 + i * 0.04, T.fudge + 2.8 + i * 0.1)); d.m.visible = g > 0.01; d.m.geometry.setDrawRange(0, Math.max(3, Math.floor(d.idx * g / 3) * 3)); d.drop.visible = g > 0.96; });
    melt.forEach((d, i) => { const g = 0.25 + 0.75 * easeOut(seg(t, 0.5 + i, 9 + i)); d.m.geometry.setDrawRange(0, Math.floor(d.idx * g / 3) * 3); d.dropM.visible = g > 0.97; });
    // sprinkles rain and stick
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), Pp = new THREE.Vector3();
    sp.forEach((s, i) => {
      const fu = seg(t, s.t0 - 0.5, s.t0); const end = s.d.clone().multiplyScalar(top.r * 1.09).add(new THREE.Vector3(0, top.y, 0));
      Pp.copy(end); Pp.y += (1 - fu * fu) * 4; const vis = t > s.t0 - 0.5;
      Q.setFromEuler(new THREE.Euler(s.rot.x + (1 - fu) * t * 6, s.rot.y, s.rot.z)); M.compose(Pp, Q, vis ? S : new THREE.Vector3(0, 0, 0)); spr.setMatrixAt(i, M);
    });
    spr.instanceMatrix.needsUpdate = true;
    // cherry drops and bounces
    const cu = seg(t, T.cherry - 0.5, T.cherry), cl = t - T.cherry; let cy = top.y + top.r * 1.05 + 0.15;
    if (cu < 1) cy += (1 - cu * cu) * 4; else if (cl < 0.6) cy += Math.abs(Math.sin(cl * 10)) * 0.25 * Math.exp(-cl * 6);
    cherry.position.set(0, cy, 0.02); cherry.visible = t > T.cherry - 0.5; cherry.rotation.z = -0.15;
    // texts
    const show = (el, a, b, f = 0.25) => { el.style.opacity = String(clamp(Math.min((t - a) / f, (b - t) / f))); };
    show(hook, -1, 6.0, 0.2); show(punch, 6.2, 10.2); show(cta, 10.4, duration + 1); show(cta2, 11.0, duration + 1);
    renderer.render(scene, camera);
  }
  renderFrame(0);
  return { duration, renderFrame };
}
