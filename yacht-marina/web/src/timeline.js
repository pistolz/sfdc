// Episode timelines. A "plan" describes, for every instant t (seconds):
//  - the camera path, tilt-shift amount
//  - which overlay texts / name tags are on screen
//  - which yachts are sailing in, and when
//  - the sound effects to mix
import * as THREE from 'three';
import { berth, vipBerth, pierX, QUAY_HEIGHT } from './layout.js';
import { berthPath, vipPath, arrivalEase } from './paths.js';
import { mulberry32, formatInt, escapeHtml } from './util.js';

const ICON_YACHT = `<svg viewBox="0 0 64 64" class="icon-inline"><path fill="#fff" d="M6 40h52l-7 12H15z"/><path fill="#ffd23f" d="M18 40V30h20l8 10z"/><path fill="#fff" d="M24 30v-7h10l5 7z"/><rect x="29" y="14" width="3" height="9" fill="#fff"/></svg>`;
const ICON_CROWN = `<svg viewBox="0 0 64 48" class="icon-inline"><path fill="#ffd23f" stroke="#10182b" stroke-width="4" d="M6 40 L10 12 L22 26 L32 6 L42 26 L54 12 L58 40 Z"/></svg>`;
const ICON_HEART = `<svg viewBox="0 0 32 28" class="icon-inline"><path fill="#ff3b5c" d="M16 27S2 18 2 9a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 9-14 18-14 18z"/></svg>`;

export const flagUrl = (cc) => `/node_modules/flag-icons/flags/4x3/${String(cc).toLowerCase()}.svg`;

function tagHtml({ name, country, badge, request, likes }) {
  const flag = country ? `<img src="${flagUrl(country)}">` : '';
  const badgeHtml = badge ? `<span class="tag-badge">${escapeHtml(badge)}</span>` : '';
  const likesHtml = likes ? `<span class="tag-badge">${ICON_HEART} ${formatInt(likes)}</span>` : '';
  const req = request ? `<div class="tag-req">${escapeHtml(request)}</div>` : '';
  return `<div class="tag-inner"><div class="tag-pill">${flag}<span>${escapeHtml(name)}</span>${badgeHtml}${likesHtml}</div>${req}<div class="tag-stem"></div></div>`;
}

const v = (px, py, pz, tx, ty, tz, fov = 38) => [px, py, pz, tx, ty, tz, fov];

/** Bird's-eye framing of the whole marina. */
function aerial(size, k = 1) {
  // Diagonal view from the south-east: piers in perspective, village as backdrop.
  const d = (1 + (size.pierLength - 35) / 90) * k;
  const L = size.pierLength;
  return v(20 * d, 60 * d, L + 55 * d, -15, 0, L * 0.15, 50);
}

function closeUp(x, z, topY, dist = 17, height = 6.5) {
  return v(x + 1.5, height, z + dist, x, topY * 0.5, z, 46);
}

export function buildPlan(ctx) {
  return ctx.config.mode === 'intro' ? introPlan(ctx) : dailyPlan(ctx);
}

// ------------------------------------------------------------------ DAY 01
function introPlan(ctx) {
  const { config, size, demo, hologram } = ctx;
  const T = config.text || {};
  const vip = vipBerth();
  const plan = basePlan(16.8);

  // Demo yacht sails to berth 0
  const b0 = berth(0);
  const path = berthPath(0, size);
  const ta = 5.0, da = 3.8;
  plan.movers.push({ obj: demo, path, ta, da, heading: b0.heading });
  const at = (t) => path.at(arrivalEase((t - ta) / da));

  const A = aerial(size);
  const A2 = aerial(size, 0.82);
  const p0 = at(ta), p1 = at(ta + 1.0), p2 = at(ta + 2.0), p3 = at(ta + 3.0);
  const topY = demo.userData.topY;
  plan.camera = [
    { t: 0, v: A },
    { t: 3.0, v: A2 },
    { t: 4.6, v: v(p0.x + 10, 16, p0.z + 26, p0.x, 1, p0.z - 4, 48) },
    { t: 6.0, v: v(p1.x + 9, 13, p1.z + 22, p1.x, 1, p1.z - 3, 48) },
    { t: 7.1, v: v(p2.x + 8, 10, p2.z + 20, p2.x, 1, p2.z - 1, 48) },
    { t: 8.2, v: v(p3.x + 4, 8, p3.z + 19, p3.x, 1.2, p3.z, 46) },
    { t: 9.4, v: closeUp(b0.x, b0.z, topY) },
    { t: 11.0, v: v(vip.x + 10, 14, vip.z + 34, vip.x, 3, vip.z, 48) },
    { t: 12.8, v: v(vip.x + 2, 12, vip.z + 31, vip.x, 3, vip.z, 48) },
    { t: 15.0, v: A2 },
    { t: 16.8, v: A },
  ];
  plan.tilt = [
    { t: 0, v: [3.2] }, { t: 3.2, v: [3.0] }, { t: 5.0, v: [1.8] }, { t: 8.5, v: [1.4] },
    { t: 10.5, v: [1.6] }, { t: 13.0, v: [1.6] }, { t: 15.0, v: [3.0] }, { t: 16.8, v: [3.2] },
  ];

  // Header
  plan.header = {
    brand: [0.15, Infinity], day: [0.3, Infinity], live: [0.55, Infinity],
    subtitle: [0.9, 2.7], counter: null,
    scale: [{ t: 0, v: [1] }, { t: 2.7, v: [1] }, { t: 3.2, v: [0.58] }, { t: 13.2, v: [0.58] }, { t: 13.7, v: [1] }],
  };
  plan.subtitle = T.subtitle || config.subtitle || 'AN EMPTY MARINA';

  plan.captions.push(
    { cls: 'rule display', html: `1 <span class="yellow">FOLLOW</span> <span class="eq">=</span> 1 <span class="yellow">YACHT</span>`, in: 3.15, out: 5.4 },
    { cls: 'rule-sub display', html: T.ruleSub || 'WITH YOUR NAME ON IT', in: 3.5, out: 5.4 },
    { cls: 'caption display', html: `${ICON_CROWN} <span class="gold">MOST LIKED</span> COMMENT`, in: 10.4, out: 13.0 },
    { cls: 'caption-sub display', html: T.vipSub || "= TODAY'S VIP SUPERYACHT", in: 10.75, out: 13.0 },
    { cls: 'cta display', html: `<span class="yellow">FOLLOW</span> + COMMENT`, in: 13.8, out: Infinity },
    { cls: 'cta-sub display', html: T.ctaSub || 'YOUR NAME + YOUR COUNTRY', in: 14.1, out: Infinity },
    { cls: 'next', html: `<div class="pill-next">${escapeHtml(T.next || `DAY ${String(config.day + 1).padStart(2, '0')} · YOUR YACHT ARRIVES`)}</div>`, in: 14.45, out: Infinity },
  );

  const d = config.demo || {};
  plan.tags.push({
    html: tagHtml({ name: d.name || '@your.name', country: d.country, badge: 'YOU?' }),
    anchor: () => new THREE.Vector3(b0.x, topY + 2.2, b0.z),
    in: 8.75, out: 10.3,
  });
  plan.tags.push({
    cls: 'vip',
    html: tagHtml({ name: T.vipTag || 'YOUR NAME HERE', badge: 'VIP' }),
    anchor: () => new THREE.Vector3(vip.x, 9.5, vip.z),
    in: 11.2, out: 13.2,
  });

  plan.hologram = { obj: hologram, in: 9.6, out: 13.6 };
  plan.vipGlow = (t) => (t < 9.0 ? 0.35 : t < 13.6 ? 1 : 0.5);

  plan.audio.push(
    { t: 0.25, type: 'whoosh' }, { t: 0.4, type: 'sting' },
    { t: 3.05, type: 'whoosh', gain: 0.5 }, { t: 3.2, type: 'pop', pitch: 1.0 }, { t: 3.55, type: 'pop', pitch: 1.2 },
    { t: 5.2, type: 'horn' },
    { t: 8.75, type: 'pop', pitch: 1.1 }, { t: 8.8, type: 'chime' },
    { t: 9.7, type: 'whoosh', gain: 0.7 }, { t: 10.1, type: 'shimmer' },
    { t: 10.45, type: 'pop', pitch: 0.9 }, { t: 11.25, type: 'pop', pitch: 1.3 },
    { t: 13.6, type: 'whoosh', gain: 0.6 }, { t: 13.85, type: 'pop' }, { t: 14.15, type: 'pop', pitch: 1.2 }, { t: 14.5, type: 'chime' },
  );
  return plan;
}

// ------------------------------------------------------------------ DAY N
function dailyPlan(ctx) {
  const { config, size, yachts, vipYacht } = ctx;
  const T = config.text || {};
  const vip = vipBerth();
  const rand = mulberry32(config.day * 977 + 13);
  const newOnes = yachts.filter((y) => y.spec.new);
  const prevTotal = Math.max(0, (config.followers ?? yachts.length) - newOnes.length);
  const total = config.followers ?? yachts.length;

  const featured = yachts.filter((y) => y.spec.featured).slice(0, 4);
  const tArriveStart = 1.4, tArriveEnd = 7.6;
  const tFeat0 = 8.2, featDur = 1.9;
  const tVip0 = tFeat0 + featured.length * featDur + 0.2;
  const vipDur = vipYacht ? 4.4 : 0;
  const tEnd0 = tVip0 + vipDur;
  const duration = tEnd0 + 4.2;
  const plan = basePlan(duration);

  // Arrivals: featured + newest first in the animated set, the rest drop in.
  const MAX_SAILING = 140;
  const order = [...newOnes].sort((a, b) => (b.spec.featured ? 1 : 0) - (a.spec.featured ? 1 : 0));
  const sailing = order.slice(0, MAX_SAILING);
  const dropping = order.slice(MAX_SAILING);
  const span = tArriveEnd - 2.6 - tArriveStart;
  sailing.forEach((y, k) => {
    const ta = tArriveStart + (sailing.length > 1 ? (k / (sailing.length - 1)) * span : 0) + rand() * 0.15;
    plan.movers.push({ obj: y.obj, path: berthPath(y.index, size), ta, da: 2.5, heading: y.berth.heading });
  });
  dropping.forEach((y) => {
    const ta = tArriveStart + 0.5 + rand() * span;
    plan.drops.push({ obj: y.obj, ta });
  });

  // Counter rolls up as yachts dock
  const dockTimes = [...plan.movers.map((m) => m.ta + m.da * 0.85), ...plan.drops.map((d) => d.ta + 0.3)].sort((a, b) => a - b);
  plan.counter = (t) => {
    let docked = 0;
    while (docked < dockTimes.length && dockTimes[docked] <= t) docked++;
    const frac = dockTimes.length ? docked / dockTimes.length : 1;
    return { value: prevTotal + (total - prevTotal) * frac, plus: newOnes.length };
  };

  const A = aerial(size), A2 = aerial(size, 0.78);
  plan.camera = [{ t: 0, v: A }, { t: 2.6, v: A2 }, { t: tArriveEnd, v: aerial(size, 0.7) }];
  featured.forEach((y, k) => {
    const t0 = tFeat0 + k * featDur;
    const b = y.berth;
    // From the fairway, looking at the stern (where the name is painted).
    const sx = b.x + b.side * 3.2;
    plan.camera.push({ t: t0 + 0.55, v: v(sx + b.side * 6.5, 8.5, b.z + 10, sx - b.side, 0.6, b.z - 0.5, 50) });
    plan.camera.push({ t: t0 + featDur - 0.1, v: v(sx + b.side * 5.5, 7.5, b.z + 8.5, sx - b.side, 0.6, b.z - 0.5, 50) });
    plan.tags.push({
      html: tagHtml({ name: y.spec.name, country: y.spec.country, request: y.spec.request }),
      anchor: () => new THREE.Vector3(b.x + b.side * 1.5, y.obj.userData.topY + 1.6, b.z),
      in: t0 + 0.45, out: t0 + featDur - 0.05,
    });
    plan.audio.push({ t: t0 + 0.2, type: 'whoosh', gain: 0.35 }, { t: t0 + 0.5, type: 'pop', pitch: 1 + k * 0.1 });
  });
  if (vipYacht) {
    const path = vipPath(vip, size);
    const ta = tVip0 - 0.6, da = 3.4;
    plan.movers.push({ obj: vipYacht, path, ta, da, heading: vip.heading });
    const at = (t) => path.at(arrivalEase((t - ta) / da));
    const p1 = at(tVip0 + 0.6), p2 = at(tVip0 + 1.8);
    plan.camera.push(
      { t: tVip0 + 0.5, v: v(p1.x + 16, 18, p1.z + 36, p1.x, 2, p1.z - 2, 48) },
      { t: tVip0 + 1.8, v: v(p2.x + 12, 15, p2.z + 34, p2.x - 2, 3, p2.z, 48) },
      { t: tVip0 + 3.3, v: v(vip.x + 8, 13, vip.z + 33, vip.x, 3, vip.z, 48) },
      { t: tVip0 + vipDur, v: v(vip.x + 3, 12, vip.z + 31, vip.x, 3, vip.z, 48) },
    );
    const s = config.vip;
    plan.tags.push({
      cls: 'vip',
      html: tagHtml({ name: s.name, country: s.country, badge: 'VIP', likes: s.likes, request: s.request }),
      anchor: () => new THREE.Vector3(vip.x, vipYacht.userData.topY + 3.2, vip.z),
      in: tVip0 + 2.5, out: tEnd0 + 0.2,
    });
    plan.captions.push(
      { cls: 'caption display', html: `${ICON_CROWN} <span class="gold">VIP</span> OF THE DAY`, in: tVip0 + 0.3, out: tEnd0 },
    );
    plan.audio.push({ t: tVip0 - 0.4, type: 'horn' }, { t: tVip0 + 0.3, type: 'shimmer' }, { t: tVip0 + 2.5, type: 'pop', pitch: 1.3 }, { t: tVip0 + 2.6, type: 'chime' });
  }
  plan.camera.push({ t: tEnd0 + 2.2, v: A2 }, { t: duration, v: A });
  plan.camera.sort((a, b) => a.t - b.t);

  plan.tilt = [{ t: 0, v: [3.2] }, { t: tArriveEnd, v: [2.8] }, { t: tFeat0 + 0.5, v: [1.5] }, { t: tEnd0, v: [1.6] }, { t: tEnd0 + 2.2, v: [3.0] }, { t: duration, v: [3.2] }];

  plan.header = {
    brand: [0.15, Infinity], day: [0.3, Infinity], live: [0.55, Infinity], subtitle: null, counter: [0.8, Infinity],
    scale: [{ t: 0, v: [1] }, { t: 2.4, v: [1] }, { t: 2.9, v: [0.62] }, { t: tEnd0 + 0.2, v: [0.62] }, { t: tEnd0 + 0.7, v: [1] }],
  };
  if (newOnes.length) {
    plan.captions.push({ cls: 'caption display', html: `<span class="yellow">+${formatInt(newOnes.length)}</span> ${newOnes.length === 1 ? 'YACHT' : 'YACHTS'} TODAY`, in: 3.0, out: 6.6 });
  }
  plan.captions.push(
    { cls: 'cta display', html: `<span class="yellow">FOLLOW</span> + COMMENT`, in: tEnd0 + 0.6, out: Infinity },
    { cls: 'cta-sub display', html: T.ctaSub || '= YOUR YACHT, YOUR NAME', in: tEnd0 + 0.9, out: Infinity },
    { cls: 'next', html: `<div class="pill-next">${escapeHtml(T.next || 'MOST LIKED COMMENT = TOMORROW\'S VIP')}</div>`, in: tEnd0 + 1.25, out: Infinity },
  );
  plan.vipGlow = () => 1;

  plan.audio.push({ t: 0.25, type: 'whoosh' }, { t: 0.4, type: 'sting' }, { t: tEnd0 + 0.4, type: 'whoosh', gain: 0.6 }, { t: tEnd0 + 0.65, type: 'pop' }, { t: tEnd0 + 1.3, type: 'chime' });
  for (const t of dockTimes) plan.audio.push({ t, type: 'pop', pitch: 0.85 + rand() * 0.5, gain: 0.55, dense: true });
  return plan;
}

function basePlan(duration) {
  return {
    duration,
    camera: [],
    tilt: [{ t: 0, v: [3] }],
    header: null,
    captions: [],
    tags: [],
    movers: [],
    drops: [],
    audio: [],
    counter: null,
    hologram: null,
    vipGlow: () => 1,
  };
}

export { pierX, QUAY_HEIGHT, ICON_YACHT };
