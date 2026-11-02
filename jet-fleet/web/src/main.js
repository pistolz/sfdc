// SKY FLEET — every follower gets a private jet flying in formation above the city at night.
// Deterministic renderFrame(t) driven by scripts/render.mjs.
import {
  clamp, lerp, ease, easeOut, backOut, rand, hashStr, skyGradient, starfield, moon, clouds, cityline,
  jet, contrail, sparkles, JET_LEN,
} from './art.js';

const W = 1080, H = 1920;
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const flagUrl = (cc) => `/node_modules/flag-icons/flags/4x3/${String(cc).toLowerCase()}.svg`;

// ------------------------------------------------------------------ formation layout
const JET_S = 0.6;            // jet scale in the formation
const ROW = 190, TOP0 = -560;  // world y of the first row (city skyline is at y = 0)
export function slot(i) {
  const r = Math.floor(i / 2), c = i % 2;
  return { x: (c ? 790 : 290) + (r % 2 ? 36 : -36), y: TOP0 - r * ROW, row: r };
}
const formationTop = (n) => TOP0 - Math.max(0, Math.ceil(n / 2) - 1) * ROW;
const vipSlot = (n) => ({ x: 540, y: formationTop(n) - 300 });

const BODIES = ['#f3f5fa', '#f3f5fa', '#f3f5fa', '#ffffff', '#e8ecf5', '#1b2340', '#d9dee9'];
const TAILS = ['#2f6fe0', '#e23b3b', '#16a34a', '#f59e0b', '#7c3aed', '#0ea5e9', '#111827', '#ec4899'];
function look(spec) {
  const h = hashStr(spec.name || 'x');
  return { body: spec.hull || BODIES[h % BODIES.length], tail: spec.accent || TAILS[(h >>> 8) % TAILS.length], lights: (spec.extras || []).includes('lights') };
}

// ------------------------------------------------------------------ helpers
const popEnv = (t, a, b = Infinity, d = 0.35) => {
  if (t < a) return { o: 0, s: 0.6 };
  const k = clamp((t - a) / d); let o = clamp(k * 2.2), s = 0.6 + 0.4 * backOut(k, 2.2);
  if (t > b) { const q = clamp((t - b) / 0.25); o *= 1 - q; s *= 1 - 0.12 * q; }
  return { o, s };
};
function sampleKeys(keys, t) {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b.t) { const u = ease((t - a.t) / (b.t - a.t)); return a.v.map((x, j) => lerp(x, b.v[j], u)); }
  }
  return keys[keys.length - 1].v;
}
const arrive = (s) => 1 - Math.pow(1 - clamp(s), 2.6);

async function init() {
  const epPath = (params.get('episode') || 'episodes/day01.json').replace(/^\/+/, '');
  const ep = await (await fetch('/' + epPath)).json();
  ep.mode = ep.mode || (ep.day === 1 ? 'intro' : 'daily');
  await Promise.all(['700 64px Oswald', '600 64px Oswald', '900 64px Nunito'].map((f) => document.fonts.load(f)));

  const flags = {};
  const ccs = new Set([...(ep.yachts || []).map((y) => y.country), ep.vip?.country, ep.demo?.country].filter(Boolean));
  await Promise.all([...ccs].map(async (cc) => { const img = new Image(); img.src = flagUrl(cc); try { await img.decode(); flags[cc] = img; } catch { /* missing flag */ } }));

  const jets = (ep.yachts || []).map((spec, i) => ({ spec, i, slot: slot(i), look: look(spec), flag: flags[spec.country], phase: (i * 1.37) % 6 }));
  const n = jets.length;
  const plan = ep.mode === 'intro' ? introPlan(ep) : dailyPlan(ep, jets);

  // ---------------------------------------------------------------- overlay DOM
  const ov = document.getElementById('overlay');
  ov.innerHTML = `
    <div class="header" id="hdr">
      <div class="brand">${esc(ep.brand || 'SKY FLEET')}</div>
      <div class="day">DAY ${String(ep.day).padStart(2, '0')}</div>
      <div class="live"><span class="dot"></span>LIVE SERIES</div>
      <div class="counter" id="ctr"><span class="num" id="num">0</span> JETS IN THE SKY <span class="plus" id="plus"></span></div>
    </div>`;
  const hdr = ov.querySelector('#hdr');
  const H_EL = { brand: hdr.querySelector('.brand'), day: hdr.querySelector('.day'), live: hdr.querySelector('.live'), counter: hdr.querySelector('#ctr') };
  const elNum = hdr.querySelector('#num'), elPlus = hdr.querySelector('#plus');
  const caps = plan.captions.map((c) => { const el = document.createElement('div'); el.className = 'cap ' + c.cls; el.innerHTML = c.html; ov.appendChild(el); return { el, c }; });
  const tags = plan.tags.map((tg) => { const el = document.createElement('div'); el.className = 'tag ' + (tg.cls || ''); el.innerHTML = tg.html; ov.appendChild(el); return { el, tg }; });
  const coverEl = document.createElement('div'); coverEl.className = 'cap cover';
  coverEl.innerHTML = `<div class="rule">1 <span class="y">FOLLOW</span> = 1 <span class="y">PRIVATE JET</span></div><div class="pill">WITH YOUR NAME ON IT</div>`;
  ov.appendChild(coverEl);
  await Promise.all([...ov.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));

  const canvas = document.getElementById('gl');
  const ctx = canvas.getContext('2d');

  // ---------------------------------------------------------------- frame
  function renderFrame(t, cover = false) {
    const [cx, cy, z] = sampleKeys(plan.camera, t);
    const toS = (wx, wy) => [(wx - cx) * z + 540, (wy - cy) * z + 960];

    skyGradient(ctx, 1);
    starfield(ctx, t, cy);
    moon(ctx, 880, 640 - (cy + 600) * 0.03, 74);
    // far clouds (parallax 0.4), city (0.85), near clouds (1.2)
    for (const [wy, sd, a] of [[-900, 2, 0.12], [-1700, 4, 0.1], [-2600, 8, 0.1], [-3600, 9, 0.08]]) clouds(ctx, t, (wy - cy) * 0.4 * z + 960, { seed: sd, alpha: a, speed: 30, scale: z });
    const [, cityY] = toS(0, 0);
    cityline(ctx, t, 960 + (0 - cy) * 0.85 * z + 40, { speed: 18 });

    // formation
    const drawJet = (j, x, y, s, extra = {}) => {
      jet(ctx, x, y, s, t, { name: j.spec.name, body: j.look.body, tail: j.look.tail, stripe: j.look.tail, flag: j.flag, lights: j.look.lights, phase: j.phase, ...extra });
    };
    for (const j of jets) {
      const m = plan.movers.get(j);
      let wx = j.slot.x + Math.sin(t * 0.7 + j.phase) * 8, wy = j.slot.y + Math.sin(t * 1.1 + j.phase) * 6;
      if (m) {
        const sN = (t - m.ta) / m.da;
        if (sN < 0) continue;
        const u = arrive(sN);
        wx = lerp(-520, wx, u); wy = lerp(wy + 140, wy, u);
        // contrail
        const pts = [];
        for (let k = 0; k < 16; k++) {
          const tk = t - k * 0.05, sk = (tk - m.ta) / m.da; if (sk < 0) break;
          const uk = arrive(sk);
          const [px, py] = toS(lerp(-520, j.slot.x, uk) - JET_LEN * JET_S * 0.5, lerp(j.slot.y + 140, j.slot.y, uk) - 10);
          pts.push({ x: px, y: py, a: (1 - k / 16) * clamp(1 - sk) });
        }
        contrail(ctx, pts.reverse(), z);
      }
      const [sx, sy] = toS(wx, wy);
      if (sx < -400 || sx > 1480 || sy < -300 || sy > 2200) continue;
      drawJet(j, sx, sy, JET_S * z);
    }
    // VIP golden jet / hologram
    if (plan.vip) {
      const v = plan.vip, vs = vipSlot(n);
      const sN = (t - v.ta) / v.da;
      if (sN >= 0) {
        const u = arrive(sN);
        const wx = lerp(-700, vs.x, u), wy = lerp(vs.y + 200, vs.y, u) + Math.sin(t * 1.1) * 6;
        const [sx, sy] = toS(wx, wy);
        if (v.hologram) {
          ctx.globalAlpha = (0.35 + 0.15 * Math.sin(t * 8)) * clamp(sN * 3);
          jet(ctx, sx, sy, JET_S * 1.5 * z, t, { body: '#ffd76a', tail: '#ffb020', stripe: '#fff1a8', vip: true });
          ctx.globalAlpha = 1;
        } else {
          jet(ctx, sx, sy, JET_S * 1.5 * z, t, { name: v.spec.name, body: v.spec.hull || '#e8b84a', tail: v.spec.accent || '#11151f', stripe: '#11151f', flag: flags[v.spec.country], vip: true, lights: true });
        }
        sparkles(ctx, sx, sy, 300 * z, t, 22);
      }
    }
    // demo jet (Day 01)
    if (plan.demo) {
      const d = plan.demo, s0 = slot(0);
      const sN = (t - d.ta) / d.da;
      if (sN >= 0) {
        const u = arrive(sN);
        const pts = [];
        for (let k = 0; k < 18; k++) { const tk = t - k * 0.05, sk = (tk - d.ta) / d.da; if (sk < 0) break; const uk = arrive(sk); const [px, py] = toS(lerp(-520, s0.x, uk) - JET_LEN * JET_S * 0.5, lerp(s0.y + 160, s0.y, uk) - 10); pts.push({ x: px, y: py, a: (1 - k / 18) * clamp(1.2 - sk) }); }
        contrail(ctx, pts.reverse(), z);
        const [sx, sy] = toS(lerp(-520, s0.x, u), lerp(s0.y + 160, s0.y, u) + Math.sin(t * 1.1) * 6);
        jet(ctx, sx, sy, JET_S * z, t, { name: d.name, body: '#f3f5fa', tail: '#2f6fe0', stripe: '#2f6fe0', flag: flags[d.country] });
      }
    }

    // ---------------- overlay
    const hd = plan.header;
    hdr.style.transform = `scale(${sampleKeys(hd.scale, t)[0].toFixed(4)})`;
    for (const k of Object.keys(H_EL)) {
      const win = hd[k];
      if (!win || cover && k === 'counter' && !plan.counter) { H_EL[k].style.display = 'none'; continue; }
      H_EL[k].style.display = '';
      const e = cover ? { o: 1, s: 1 } : popEnv(t, win[0], win[1]);
      H_EL[k].style.opacity = e.o.toFixed(3); H_EL[k].style.transform = `scale(${e.s.toFixed(3)})`;
    }
    if (plan.counter) { const c = plan.counter(t); elNum.textContent = fmt(c.value); elPlus.textContent = c.plus ? `+${fmt(c.plus)} TODAY` : ''; }
    for (const { el, c } of caps) { const e = cover ? { o: 0, s: 1 } : popEnv(t, c.in, c.out); el.style.opacity = e.o.toFixed(3); el.style.transform = `scale(${e.s.toFixed(3)})`; }
    for (const { el, tg } of tags) {
      const e = cover ? { o: 0, s: 1 } : popEnv(t, tg.in, tg.out, 0.3);
      const [wx, wy] = tg.anchor();
      let [x, y] = toS(wx, wy);
      x = clamp(x, 200, 880); y = clamp(y, 560, 1500);
      el.style.opacity = e.o.toFixed(3); el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${e.s.toFixed(3)})`;
    }
    coverEl.style.opacity = cover ? '1' : '0';
  }

  window.__marina = {
    ready: true, duration: plan.duration, audio: plan.audio.sort((a, b) => a.t - b.t), renderer: 'Canvas 2D',
    renderFrame: (t) => renderFrame(t),
    renderCover: () => { renderFrame(plan.coverTime ?? 0.8, true); hdr.style.transform = 'scale(1)'; },
  };

  if (!RENDER) {
    const stage = document.getElementById('stage');
    const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / W, innerHeight / H)})`; };
    fit(); addEventListener('resize', fit);
    if (params.get('t') != null) { renderFrame(parseFloat(params.get('t'))); return; }
    let s0 = performance.now(); addEventListener('click', () => { s0 = performance.now(); });
    const loop = () => { renderFrame(((performance.now() - s0) / 1000) % plan.duration); requestAnimationFrame(loop); }; loop();
  }
}

// ------------------------------------------------------------------ DAY 01
function introPlan(ep) {
  const T = ep.text || {};
  const s0 = slot(0), vs = vipSlot(0);
  const demoTa = 5.4, demoDa = 3.2;
  return {
    duration: 16.8,
    coverTime: 0.8,
    camera: [
      { t: 0, v: [540, -560, 0.95] }, { t: 3, v: [540, -640, 0.95] },
      { t: 5.6, v: [430, s0.y + 40, 1.1] }, { t: 8.8, v: [s0.x + 40, s0.y + 10, 1.75] }, { t: 9.8, v: [s0.x + 60, s0.y, 1.8] },
      { t: 11.2, v: [540, vs.y + 40, 1.15] }, { t: 13.2, v: [540, vs.y + 20, 1.2] },
      { t: 15.2, v: [540, -640, 0.95] }, { t: 16.8, v: [540, -560, 0.95] },
    ],
    header: { brand: [0.1, Infinity], day: [0.2, Infinity], live: [0.45, Infinity], counter: null, scale: [{ t: 0, v: [1] }, { t: 2.8, v: [1] }, { t: 3.2, v: [0.6] }, { t: 13.4, v: [0.6] }, { t: 13.9, v: [1] }] },
    captions: [
      { cls: 'pill-y mid', html: esc(T.subtitle || 'AN EMPTY SKY'), in: 0.8, out: 2.8 },
      { cls: 'big mid', html: `1 <span class="y">FOLLOW</span> = 1 <span class="y">PRIVATE JET</span>`, in: 3.2, out: 5.4 },
      { cls: 'pill-y low', html: esc(T.ruleSub || 'WITH YOUR NAME ON IT'), in: 3.6, out: 5.4 },
      { cls: 'big mid', html: `<span class="y">MOST LIKED</span> COMMENT`, in: 10.6, out: 13.2 },
      { cls: 'pill-y low', html: esc(T.vipSub || "= TODAY'S GOLDEN JET"), in: 11.0, out: 13.2 },
      { cls: 'big mid', html: `<span class="y">FOLLOW</span> + <span class="r">COMMENT</span>`, in: 13.9, out: Infinity },
      { cls: 'pill-y low', html: esc(T.ctaSub || 'YOUR NAME + YOUR COUNTRY'), in: 14.2, out: Infinity },
      { cls: 'pill-w lower', html: esc(T.next || 'DAY 02 · YOUR JET TAKES OFF'), in: 14.5, out: Infinity },
    ],
    tags: [
      { html: tagHtml(ep.demo?.name || '@your.name', ep.demo?.country, 'YOU?'), anchor: () => [s0.x, s0.y - 110], in: 8.6, out: 10.2 },
      { cls: 'vip', html: tagHtml(T.vipTag || 'YOUR NAME HERE', null, 'VIP'), anchor: () => [vs.x, vs.y - 160], in: 11.4, out: 13.2 },
    ],
    movers: new Map(),
    demo: { ta: demoTa, da: demoDa, name: ep.demo?.name || '@your.name', country: ep.demo?.country },
    vip: { ta: 9.8, da: 1.8, hologram: true, spec: {} },
    counter: null,
    audio: [
      { t: 0.2, type: 'whoosh' }, { t: 0.35, type: 'sting' },
      { t: 3.1, type: 'whoosh', gain: 0.5 }, { t: 3.25, type: 'pop' }, { t: 3.6, type: 'pop', pitch: 1.2 },
      { t: demoTa, type: 'jet' }, { t: 8.6, type: 'pop', pitch: 1.1 }, { t: 8.65, type: 'chime' },
      { t: 9.9, type: 'whoosh', gain: 0.7 }, { t: 10.2, type: 'shimmer' }, { t: 11.4, type: 'pop', pitch: 1.3 },
      { t: 13.7, type: 'whoosh', gain: 0.6 }, { t: 13.95, type: 'pop' }, { t: 14.5, type: 'chime' },
    ],
  };
}

// ------------------------------------------------------------------ DAY N
function dailyPlan(ep, jets) {
  const T = ep.text || {};
  const R = rand(ep.day * 97 + 5);
  const n = jets.length, newOnes = jets.filter((j) => j.spec.new);
  const total = ep.followers ?? n, prev = Math.max(0, total - newOnes.length);
  const featured = jets.filter((j) => j.spec.featured).slice(0, 4);
  const top = formationTop(n), vs = vipSlot(n);
  // camera flies up through the whole fleet, then holds at the top where new jets join
  const ZP = 0.62;
  const BOTTOM = [540, -420, ZP];
  const TOPV = [540, top + 700, ZP];
  const OV = TOPV;
  const tA0 = 2.6, tA1 = 8.4, tF = 9.0, fd = 1.9;
  const tV = tF + featured.length * fd + 0.2, vd = ep.vip ? 4.4 : 0, tE = tV + vd, duration = tE + 4;
  const movers = new Map();
  const order = [...newOnes].sort((a, b) => (b.spec.featured ? 1 : 0) - (a.spec.featured ? 1 : 0));
  order.forEach((j, k) => movers.set(j, { ta: tA0 + (order.length > 1 ? (k / (order.length - 1)) * (tA1 - 2.4 - tA0) : 0) + R() * 0.15, da: 2.3 }));
  const dock = [...movers.values()].map((m) => m.ta + m.da * 0.8).sort((a, b) => a - b);

  const camera = [{ t: 0, v: BOTTOM }, { t: 2.6, v: TOPV }, { t: tA1, v: [540, top + 620, ZP] }];
  const tags = [], captions = [], audio = [];
  featured.forEach((j, k) => {
    const t0 = tF + k * fd;
    camera.push({ t: t0 + 0.55, v: [j.slot.x + 30, j.slot.y + 10, 1.75] }, { t: t0 + fd - 0.1, v: [j.slot.x + 50, j.slot.y, 1.85] });
    tags.push({ html: tagHtml(j.spec.name, j.spec.country, null, j.spec.request), anchor: () => [j.slot.x, j.slot.y - 110], in: t0 + 0.45, out: t0 + fd - 0.05 });
    audio.push({ t: t0 + 0.2, type: 'whoosh', gain: 0.35 }, { t: t0 + 0.5, type: 'pop', pitch: 1 + k * 0.1 });
  });
  let vip = null;
  if (ep.vip) {
    vip = { ta: tV - 0.4, da: 2.8, spec: ep.vip };
    camera.push({ t: tV + 0.6, v: [400, vs.y + 60, 1.0] }, { t: tV + 2.6, v: [540, vs.y + 20, 1.2] }, { t: tE, v: [560, vs.y + 10, 1.25] });
    tags.push({ cls: 'vip', html: tagHtml(ep.vip.name, ep.vip.country, 'VIP', ep.vip.request, ep.vip.likes), anchor: () => [vs.x, vs.y - 170], in: tV + 2.2, out: tE + 0.2 });
    captions.push({ cls: 'big low', html: `<span class="y">GOLDEN JET</span> OF THE DAY`, in: tV + 0.3, out: tE });
    audio.push({ t: tV - 0.3, type: 'jet' }, { t: tV + 0.3, type: 'shimmer' }, { t: tV + 2.2, type: 'pop', pitch: 1.3 }, { t: tV + 2.3, type: 'chime' });
  }
  camera.push({ t: tE + 2, v: [540, (ep.vip ? vs.y : top) + 760, ZP] }, { t: duration, v: [540, (ep.vip ? vs.y : top) + 820, ZP] });
  camera.sort((a, b) => a.t - b.t);
  if (newOnes.length) captions.push({ cls: 'big mid', html: `<span class="y">+${fmt(newOnes.length)}</span> ${newOnes.length === 1 ? 'JET' : 'JETS'} TODAY`, in: 3.0, out: 7.4 });
  captions.push(
    { cls: 'big mid', html: `<span class="y">FOLLOW</span> + <span class="r">COMMENT</span>`, in: tE + 0.6, out: Infinity },
    { cls: 'pill-y low', html: esc(T.ctaSub || '= YOUR JET, YOUR NAME'), in: tE + 0.9, out: Infinity },
    { cls: 'pill-w lower', html: esc(T.next || "MOST LIKED COMMENT = TOMORROW'S GOLDEN JET"), in: tE + 1.2, out: Infinity },
  );
  audio.push({ t: 0.2, type: 'whoosh' }, { t: 0.35, type: 'sting' }, { t: 0.6, type: 'jet', gain: 0.6 }, { t: tE + 0.4, type: 'whoosh', gain: 0.6 }, { t: tE + 0.65, type: 'pop' }, { t: tE + 1.25, type: 'chime' });
  for (const m of movers.values()) if (R() < 0.12) audio.push({ t: m.ta, type: 'jet', gain: 0.35 });
  for (const d of dock) audio.push({ t: d, type: 'pop', pitch: 0.85 + R() * 0.5, gain: 0.5, dense: true });
  return {
    duration, coverTime: 0.6, camera, tags, captions, movers, vip, demo: null,
    header: { brand: [0.1, Infinity], day: [0.2, Infinity], live: [0.45, Infinity], counter: [0.7, Infinity], scale: [{ t: 0, v: [1] }, { t: 2.4, v: [1] }, { t: 2.9, v: [0.62] }, { t: tE + 0.2, v: [0.62] }, { t: tE + 0.7, v: [1] }] },
    counter: (t) => { let k = 0; while (k < dock.length && dock[k] <= t) k++; return { value: prev + (total - prev) * (dock.length ? k / dock.length : 1), plus: newOnes.length }; },
    audio,
  };
}

function tagHtml(name, country, badge, request, likes) {
  const flag = country ? `<img src="${flagUrl(country)}">` : '';
  return `<div class="tag-in"><div class="tag-pill">${flag}<span>${esc(name)}</span>${badge ? `<b>${esc(badge)}</b>` : ''}${likes ? `<b>♥ ${fmt(likes)}</b>` : ''}</div>${request ? `<div class="tag-req">${esc(request)}</div>` : ''}<div class="tag-stem"></div></div>`;
}

init().catch((e) => { console.error(e); window.__marina = { ready: false, error: String(e && e.stack || e) }; });
