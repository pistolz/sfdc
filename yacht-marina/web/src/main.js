// Entry point: builds the scene for one episode and exposes a deterministic
// renderFrame(t) that the offline renderer (scripts/render.mjs) calls frame by frame.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { THEMES } from './themes.js';
import { berth, marinaSize, vipBerth } from './layout.js';
import { buildWorld } from './world.js';
import { createYacht, createHologram, makeYachtMaterials } from './yacht.js';
import { createWake } from './wake.js';
import { createPost } from './post.js';
import { buildPlan, flagUrl, ICON_YACHT } from './timeline.js';
import { arrivalEase } from './paths.js';
import { sampleKeys, popEnvelope, hashString, formatInt, escapeHtml, clamp, easeOutBack } from './util.js';

const W = 1080, H = 1920;
const params = new URLSearchParams(location.search);
const RENDER_MODE = params.has('render');
// Debug: ?cam=px,py,pz,tx,ty,tz,fov pins the camera (handy to frame shots).
const CAM_OVERRIDE = params.get('cam') ? params.get('cam').split(',').map(Number) : null;

const HULLS = ['#f7f5ef', '#f7f5ef', '#f7f5ef', '#ffffff', '#eef3f8', '#1d2a44', '#f4efe6'];
const ACCENTS = ['#1d4ed8', '#0ea5e9', '#e11d48', '#10b981', '#f59e0b', '#7c3aed', '#111827', '#ef4444', '#14b8a6'];

async function loadFlagTexture(cc) {
  if (!cc) return null;
  const img = new Image();
  img.src = flagUrl(cc);
  try { await img.decode(); } catch { return null; }
  const c = document.createElement('canvas');
  c.width = 160; c.height = 120;
  c.getContext('2d').drawImage(img, 0, 0, 160, 120);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function defaultLook(name) {
  const h = hashString(name || 'x');
  return { hull: HULLS[h % HULLS.length], accent: ACCENTS[(h >>> 8) % ACCENTS.length] };
}

async function init() {
  const episodePath = params.get('episode') || 'episodes/day01.json';
  const config = await (await fetch('/' + episodePath.replace(/^\/+/, ''))).json();
  config.mode = config.mode || (config.day === 1 ? 'intro' : 'daily');
  const theme = { ...THEMES[config.theme || 'day'] };

  await Promise.all([
    document.fonts.load('400 64px "Lilita One"'),
    document.fonts.load('900 64px Nunito'),
    document.fonts.load('800 64px Nunito'),
  ]);

  // ---------------------------------------------------------------- renderer
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = theme.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.5, 2500);

  const yachtSpecs = config.yachts || [];
  const size = marinaSize(yachtSpecs.length);

  scene.add(new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiIntensity));
  const sun = new THREE.DirectionalLight(theme.sun, theme.sunIntensity);
  const center = new THREE.Vector3((size.left + size.right) / 2 - 10, 0, size.pierLength * 0.4);
  sun.position.copy(center).add(new THREE.Vector3(...theme.sunDir).normalize().multiplyScalar(220));
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  const ext = Math.max(110, size.pierLength + 60);
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 10; sc.far = 600;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  const world = buildWorld(scene, theme, size, config.seed || 7);
  const mats = makeYachtMaterials(theme);
  const wake = createWake(scene);

  // ---------------------------------------------------------------- yachts
  const countries = new Set(yachtSpecs.map((y) => y.country).filter(Boolean));
  if (config.vip?.country) countries.add(config.vip.country);
  if (config.demo?.country) countries.add(config.demo.country);
  const flagTex = {};
  await Promise.all([...countries].map(async (cc) => { flagTex[cc] = await loadFlagTexture(cc); }));

  const yachts = yachtSpecs.map((spec, index) => {
    const look = { ...defaultLook(spec.name), ...Object.fromEntries(Object.entries(spec).filter(([, v]) => v != null)) };
    const obj = createYacht({ ...look, flagTexture: flagTex[spec.country] }, mats);
    const b = berth(index);
    obj.position.set(b.x, 0, b.z);
    obj.rotation.y = b.heading;
    scene.add(obj);
    return { spec, obj, index, berth: b };
  });

  let demo = null, hologram = null, vipYacht = null;
  const vip = vipBerth();
  if (config.mode === 'intro') {
    const d = config.demo || {};
    demo = createYacht({ name: d.name || '@your.name', hull: d.hull || '#f7f5ef', accent: d.accent || '#1d4ed8', extras: d.extras || [], flagTexture: flagTex[d.country] }, mats);
    scene.add(demo);
    hologram = createHologram(mats);
    hologram.position.set(vip.x, 0.2, vip.z);
    hologram.rotation.y = vip.heading;
    scene.add(hologram);
  }
  if (config.vip) {
    const s = config.vip;
    vipYacht = createYacht({
      size: 'super', name: s.name, hull: s.hull || '#11151f', accent: s.accent || '#e8b84a',
      extras: [...new Set(['helipad', 'pool', 'lights', ...(s.extras || [])])], flagTexture: flagTex[s.country],
    }, mats);
    vipYacht.position.set(vip.x, 0, vip.z);
    vipYacht.rotation.y = vip.heading;
    scene.add(vipYacht);
  }

  const plan = buildPlan({ config, size, yachts, demo, hologram, vipYacht });
  const moving = new Set(plan.movers.map((m) => m.obj));
  const dropping = new Map(plan.drops.map((d) => [d.obj, d]));
  const allBoats = [...yachts.map((y) => y.obj), ...(demo ? [demo] : []), ...(vipYacht ? [vipYacht] : [])];
  const phase = new Map(allBoats.map((o, i) => [o, (i * 2.399) % (Math.PI * 2)]));

  const post = createPost(renderer, scene, camera, theme, W, H);

  // ---------------------------------------------------------------- overlay
  const overlay = document.getElementById('overlay');
  const header = document.createElement('div');
  header.className = 'header';
  header.innerHTML = `
    <div class="brand display yellow">${escapeHtml(config.brand || 'THE COMMENT MARINA')}</div>
    <div class="day display">DAY ${String(config.day).padStart(2, '0')}</div>
    <div class="live"><span class="pill-live"><span class="dot"></span>LIVE SERIES</span></div>
    <div class="subtitle display">${escapeHtml(plan.subtitle || '')}</div>
    <div class="counter"><span class="counter-box">${ICON_YACHT}<span class="num">0</span><span>YACHTS</span><span class="plus"></span></span></div>`;
  overlay.appendChild(header);
  const H_EL = {
    brand: header.querySelector('.brand'), day: header.querySelector('.day'), live: header.querySelector('.live'),
    subtitle: header.querySelector('.subtitle'), counter: header.querySelector('.counter'),
  };
  const counterNum = header.querySelector('.num');
  const counterPlus = header.querySelector('.plus');

  const captionEls = plan.captions.map((c) => {
    const el = document.createElement('div');
    el.className = 'el ' + c.cls;
    el.innerHTML = c.html;
    overlay.appendChild(el);
    return { el, c };
  });
  const tagEls = plan.tags.map((tg) => {
    const el = document.createElement('div');
    el.className = 'tag ' + (tg.cls || '');
    el.innerHTML = tg.html;
    overlay.appendChild(el);
    return { el, tg };
  });
  const coverEl = document.createElement('div');
  coverEl.className = 'el cover';
  coverEl.innerHTML = `<div class="rule-cover display">1 <span class="yellow">FOLLOW</span> = 1 <span class="yellow">YACHT</span></div>
    <div class="rule-cover-sub display">${escapeHtml(config.text?.coverSub || 'WITH YOUR NAME ON IT')}</div>`;
  overlay.appendChild(coverEl);
  await Promise.all([...overlay.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));

  function applyEnv(el, env, extra = '') {
    el.style.opacity = env.o.toFixed(3);
    el.style.transform = `translateY(${env.y.toFixed(1)}px) scale(${env.s.toFixed(4)}) ${extra}`;
  }

  // ---------------------------------------------------------------- frame
  const tmp = new THREE.Vector3();
  function renderFrame(t) {
    world.update(t);
    world.vipGroup.userData.glow = plan.vipGlow(t);

    wake.begin();
    for (const o of allBoats) {
      const ph = phase.get(o);
      const bob = o.userData.bob;
      bob.position.y = Math.sin(t * 1.25 + ph) * 0.06;
      bob.rotation.x = Math.sin(t * 1.05 + ph * 1.7) * 0.025;
      bob.rotation.z = Math.sin(t * 0.9 + ph * 0.6) * 0.012;
      if (o.userData.flag) o.userData.flag.rotation.y = Math.sin(t * 3 + ph) * 0.15;
    }
    for (const m of plan.movers) {
      const o = m.obj;
      const s = (t - m.ta) / m.da;
      o.visible = s >= 0;
      if (s < 0) continue;
      const u = arrivalEase(s);
      const p = m.path.at(u);
      o.position.set(p.x, 0, p.z);
      // settle on the berth heading during the last part of the approach
      let h = m.path.heading(u);
      const settle = clamp((s - 0.75) / 0.25);
      let dh = m.heading - h;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      h += dh * settle;
      o.rotation.y = h;
      const speed = Math.pow(clamp(1 - s), 1.4);
      o.userData.bob.rotation.z += speed * 0.05; // bow lifts while under way
      // wake
      const L = o.userData.length, Wd = o.userData.width;
      for (let k = 1; k <= 36; k++) {
        const tk = t - k * 0.035;
        const sk = (tk - m.ta) / m.da;
        if (sk < 0) break;
        const uk = arrivalEase(sk);
        const pk = m.path.at(uk);
        const hk = m.path.heading(uk);
        const sp = Math.pow(clamp(1 - sk), 1.2);
        const a = sp * (1 - k / 37) * 0.5;
        const bx = Math.cos(hk), bz = -Math.sin(hk);
        wake.add(pk.x - bx * L * 0.5, pk.z - bz * L * 0.5, (0.7 + k * 0.05) * Wd * 0.6, (0.55 + k * 0.06) * Wd * 0.6, hk, a);
      }
      if (speed > 0.02) {
        const bx = Math.cos(h), bz = -Math.sin(h);
        wake.add(p.x + bx * L * 0.42, p.z + bz * L * 0.42, L * 0.18, Wd * 0.62, h, speed * 0.55);
      }
    }
    for (const [o, d] of dropping) {
      const s = (t - d.ta) / 0.45;
      o.visible = s >= 0;
      o.scale.setScalar(s >= 0 ? Math.max(0.001, easeOutBack(s, 2)) : 0.001);
    }
    wake.end();

    if (plan.hologram) {
      const h = plan.hologram;
      const env = popEnvelope(t, h.in, h.out, 0.6);
      h.obj.visible = env.o > 0.01;
      const flick = 0.85 + 0.15 * Math.sin(t * 9);
      mats.hologram.opacity = 0.42 * env.o * flick;
      mats.hologramLines.opacity = 0.85 * env.o * flick;
      h.obj.position.y = 0.25 + Math.sin(t * 1.4) * 0.08;
    }

    const c = CAM_OVERRIDE || sampleKeys(plan.camera, t);
    camera.position.set(c[0], c[1], c[2]);
    camera.fov = c[6];
    camera.updateProjectionMatrix();
    camera.lookAt(c[3], c[4], c[5]);
    camera.updateMatrixWorld();
    const tilt = sampleKeys(plan.tilt, t);
    post.setTilt(tilt[0], 0.5, 0.15);
    post.render();

    // overlay
    if (plan.header) {
      const hd = plan.header;
      const sc = sampleKeys(hd.scale, t)[0];
      header.style.transform = `scale(${sc.toFixed(4)})`;
      for (const key of Object.keys(H_EL)) {
        const win = hd[key];
        if (!win) { H_EL[key].style.display = 'none'; continue; }
        H_EL[key].style.display = '';
        applyEnv(H_EL[key], popEnvelope(t, win[0], win[1]));
      }
    }
    if (plan.counter) {
      const cv = plan.counter(t);
      counterNum.textContent = formatInt(cv.value);
      counterPlus.textContent = cv.plus ? `+${formatInt(cv.plus)} TODAY` : '';
    }
    coverEl.style.opacity = '0';
    for (const { el, c: cap } of captionEls) applyEnv(el, popEnvelope(t, cap.in, cap.out));
    for (const { el, tg } of tagEls) {
      const env = popEnvelope(t, tg.in, tg.out, 0.32);
      tmp.copy(tg.anchor()).project(camera);
      const x = Math.min(W - 60, Math.max(60, (tmp.x + 1) / 2 * W));
      const y = Math.min(H * 0.78, Math.max(560, (1 - tmp.y) / 2 * H));
      el.style.opacity = env.o.toFixed(3);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${env.s.toFixed(4)})`;
    }
  }

  window.__marina = {
    ready: true,
    duration: plan.duration,
    audio: plan.audio.sort((a, b) => a.t - b.t),
    renderer: (() => {
      const gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    })(),
    renderFrame,
    renderCover() {
      // Thumbnail: opening aerial shot + full-size title + the rule.
      renderFrame(plan.coverTime ?? 0.01);
      header.style.transform = 'scale(1)';
      for (const key of Object.keys(H_EL)) {
        const show = key === 'brand' || key === 'day' || key === 'live' || (key === 'counter' && plan.counter);
        H_EL[key].style.display = show ? '' : 'none';
        H_EL[key].style.opacity = '1';
        H_EL[key].style.transform = 'none';
      }
      for (const { el } of captionEls) el.style.opacity = '0';
      for (const { el } of tagEls) el.style.opacity = '0';
      coverEl.style.opacity = '1';
    },
  };

  if (!RENDER_MODE) {
    // Live preview in a normal browser: scale the 1080×1920 stage to the window.
    const stage = document.getElementById('stage');
    const fit = () => {
      const s = Math.min(innerWidth / W, innerHeight / H);
      stage.style.transform = `scale(${s})`;
    };
    fit(); addEventListener('resize', fit);
    const fixed = params.get('t');
    if (fixed != null) { renderFrame(parseFloat(fixed)); return; }
    let start = performance.now();
    addEventListener('click', () => { start = performance.now(); });
    const loop = () => {
      const t = ((performance.now() - start) / 1000) % plan.duration;
      renderFrame(t);
      requestAnimationFrame(loop);
    };
    loop();
  }
}

init().catch((e) => {
  console.error(e);
  window.__marina = { ready: false, error: String(e && e.stack || e) };
});
