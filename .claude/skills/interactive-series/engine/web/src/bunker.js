// The property in cross-section: house on the surface, bunker rooms underground.
// Features appear when they are bought (state.features[name] = time it was bought).
import { C, fillRR, circle, text, rr, house, mountains, tree, sky, sun, stars, clamp, backOut, easeOut, glow, person, lerp } from './draw.js';

export const G = 820; // ground line
export const ROOMS = {
  basement: { x: 330, y: 860, w: 420, h: 200, label: 'BASEMENT' },
  living: { x: 130, y: 870, w: 400, h: 220, label: 'SHELTER' },
  door: { x: 560, y: 870, w: 390, h: 220, label: 'STEEL DOOR' },
  power: { x: 130, y: 1140, w: 400, h: 220, label: 'POWER' },
  food: { x: 560, y: 1140, w: 390, h: 220, label: 'FOOD' },
  water: { x: 130, y: 1410, w: 400, h: 220, label: 'WATER' },
  farm: { x: 560, y: 1410, w: 390, h: 220, label: 'UNDERGROUND FARM' },
};

// Camera framings: [centerX, centerY, zoom]
export const FOCUS = {
  surface: [540, 620, 1.2],
  basement: [540, 850, 1.25],
  bunker: [540, 960, 1.05],
  power: [540, 1180, 1.1],
  food: [600, 1200, 1.15],
  water: [400, 1450, 1.15],
  farm: [640, 1450, 1.15],
  solar: [500, 700, 1.15],
  overview: [540, 1120, 0.86],
};

const k = (st, name, t, dur = 0.8) => {
  const tb = st.features[name];
  if (tb == null) return 0;
  return clamp((t - tb) / dur);
};

function roomShell(ctx, r, appear, lit, shielded) {
  if (appear <= 0) return;
  const s = backOut(appear);
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.scale(s, s);
  ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
  fillRR(ctx, r.x - 14, r.y - 14, r.w + 28, r.h + 28, 18, shielded ? '#4b5470' : '#6c625a');
  if (shielded) {
    ctx.strokeStyle = '#8b95a8'; ctx.lineWidth = 4;
    for (let x = r.x - 6; x < r.x + r.w + 10; x += 26) { ctx.beginPath(); ctx.moveTo(x, r.y - 12); ctx.lineTo(x, r.y - 4); ctx.moveTo(x, r.y + r.h + 4); ctx.lineTo(x, r.y + r.h + 12); ctx.stroke(); }
  }
  fillRR(ctx, r.x, r.y, r.w, r.h, 10, lit ? C.roomLit : '#1a1e2e');
  // ceiling lamp
  if (lit) {
    const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + 10, 5, r.x + r.w / 2, r.y + 60, r.h);
    g.addColorStop(0, 'rgba(255,230,160,0.35)'); g.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
    fillRR(ctx, r.x + r.w / 2 - 30, r.y + 4, 60, 10, 5, '#ffe9a8');
  }
  ctx.restore();
}

function label(ctx, r, s, appear, color = '#ffffff') {
  if (appear <= 0.3) return;
  ctx.globalAlpha = clamp((appear - 0.3) / 0.4);
  ctx.font = '900 26px "Nunito"';
  const w = ctx.measureText(s).width + 28;
  fillRR(ctx, r.x + 12, r.y + 12, w, 40, 12, 'rgba(0,0,0,0.45)');
  text(ctx, s, r.x + 12 + w / 2, r.y + 33, 26, color);
  ctx.globalAlpha = 1;
}

const pop = (a, i, n) => backOut(clamp(a * (n + 2) / 2 - i * 0.5));

export function drawProperty(ctx, st, t, { night = 0, hero = null, family = 0 } = {}) {
  // sky & landscape
  sky(ctx, night > 0.5 ? C.skyNight : C.skyDay, G);
  if (night > 0.5) stars(ctx, t, 60); else sun(ctx, 850, 220, 70);
  mountains(ctx, G - 60, night > 0.5 ? '#2c3558' : '#9fb4cf', night > 0.5 ? '#4a5680' : '#eef4fb', 4);
  ctx.fillStyle = night > 0.5 ? '#2f5a3a' : C.grass; ctx.fillRect(-300, G - 70, 1680, 80);
  for (const [x, s] of [[70, 1.2], [160, 0.9], [960, 1.1], [1030, 0.8]]) tree(ctx, x, G - 40, s, night > 0.5 ? '#2a5a36' : '#3f8f4a');

  // dirt layers
  const layers = C.dirt;
  for (let i = 0; i < layers.length; i++) { ctx.fillStyle = layers[i]; ctx.fillRect(-300, G + i * 300 - (i ? 0 : 0), 1680, 320); }
  ctx.fillStyle = '#3d2516'; ctx.fillRect(-300, G + 1200, 1680, 800);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 90; i++) { const x = (i * 197) % 1100, y = G + 40 + ((i * 331) % 1100); circle(ctx, x, y, 6 + (i % 4) * 3, 'rgba(0,0,0,0.08)'); }

  const bunker = k(st, 'bunker', t, 1.0);
  const basement = st.features.basement != null ? 1 : 0;

  // shaft + ladder from house to bunker
  if (basement || bunker) {
    fillRR(ctx, 500, G - 10, 80, (bunker ? 1100 : 0) + 100, 6, '#2a2f44');
    ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 6;
    const bottom = bunker ? G + 800 * clamp(bunker * 1.3) + 10 : G + 90;
    ctx.beginPath(); ctx.moveTo(518, G); ctx.lineTo(518, bottom); ctx.moveTo(562, G); ctx.lineTo(562, bottom); ctx.stroke();
    for (let y = G + 10; y < bottom; y += 28) { ctx.beginPath(); ctx.moveTo(518, y); ctx.lineTo(562, y); ctx.stroke(); }
  }

  // basement (before upgrade)
  if (basement && bunker < 1) {
    ctx.globalAlpha = 1 - bunker;
    const r = ROOMS.basement;
    roomShell(ctx, r, 1, true, false);
    for (let i = 0; i < 3; i++) fillRR(ctx, r.x + 40 + i * 60, r.y + r.h - 60 - (i % 2) * 40, 54, 54 + (i % 2) * 40, 4, '#b98a4e', '#7a5530', 4);
    label(ctx, r, 'BASEMENT', 1);
    ctx.globalAlpha = 1;
  }

  // bunker level 1
  if (bunker > 0) {
    const L = ROOMS.living, D = ROOMS.door;
    roomShell(ctx, L, bunker, true, true);
    roomShell(ctx, D, clamp(bunker * 1.2 - 0.2), true, true);
    if (bunker > 0.5) {
      // bed, table
      fillRR(ctx, L.x + 30, L.y + L.h - 70, 150, 50, 10, '#e2e8f0');
      fillRR(ctx, L.x + 30, L.y + L.h - 82, 50, 22, 8, '#93c5fd');
      fillRR(ctx, L.x + 230, L.y + L.h - 90, 120, 14, 4, '#a16207');
      fillRR(ctx, L.x + 240, L.y + L.h - 76, 10, 56, 3, '#a16207'); fillRR(ctx, L.x + 330, L.y + L.h - 76, 10, 56, 3, '#a16207');
      // steel blast door with wheel
      const dx = D.x + D.w - 120, dy = D.y + D.h / 2 + 10;
      circle(ctx, dx, dy, 86, '#6b7488', '#c3cad6', 10);
      circle(ctx, dx, dy, 60, '#565f73');
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(t * 0.2);
      ctx.strokeStyle = '#d6dbe4'; ctx.lineWidth = 9;
      circle(ctx, 0, 0, 36, null, '#d6dbe4', 9);
      for (let a = 0; a < 4; a++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(48, 0); ctx.stroke(); }
      ctx.restore();
      // no-wifi sign
      fillRR(ctx, D.x + 30, D.y + 70, 120, 90, 12, '#11182b', C.red, 5);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6;
      for (const rad of [16, 30, 44]) { ctx.beginPath(); ctx.arc(D.x + 90, D.y + 140, rad, 1.25 * Math.PI, 1.75 * Math.PI); ctx.stroke(); }
      ctx.strokeStyle = C.red; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(D.x + 50, D.y + 90); ctx.lineTo(D.x + 130, D.y + 150); ctx.stroke();
    }
    label(ctx, L, 'OFFLINE BUNKER', bunker);
    label(ctx, D, 'MANUAL STEEL DOOR', clamp(bunker * 1.2 - 0.2));
  }

  // power room
  const pw = k(st, 'power', t);
  if (pw > 0) {
    const r = ROOMS.power;
    roomShell(ctx, r, pw, true, true);
    for (let i = 0; i < 2; i++) {
      const s = pop(pw, i, 5);
      ctx.save(); ctx.translate(r.x + 70 + i * 120, r.y + r.h - 20); ctx.scale(s, s);
      fillRR(ctx, -50, -100, 100, 100, 10, '#f59e0b', C.ink, 5);
      circle(ctx, 0, -55, 28, '#374151'); ctx.save(); ctx.translate(0, -55); ctx.rotate(t * 8); ctx.fillStyle = '#9ca3af'; ctx.fillRect(-24, -4, 48, 8); ctx.fillRect(-4, -24, 8, 48); ctx.restore();
      ctx.restore();
    }
    for (let i = 0; i < 2; i++) {
      const s = pop(pw, i + 2, 5);
      ctx.save(); ctx.translate(r.x + 280 + i * 44, r.y + r.h - 20); ctx.scale(s, s);
      fillRR(ctx, -18, -90, 36, 90, 6, '#3b82f6', C.ink, 4);
      ctx.fillStyle = '#facc15'; ctx.fillRect(-6, -70, 12, 30);
      ctx.restore();
    }
    const s = pop(pw, 4, 5);
    ctx.save(); ctx.translate(r.x + 370, r.y + r.h - 20); ctx.scale(s, s);
    fillRR(ctx, -22, -80, 44, 80, 8, '#dc2626', C.ink, 4); ctx.restore();
    label(ctx, r, 'POWER', pw);
  }

  // food
  const fd = k(st, 'food', t);
  if (fd > 0) {
    const r = ROOMS.food;
    roomShell(ctx, r, fd, true, true);
    const cols = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#f97316'];
    for (let sh = 0; sh < 2; sh++) {
      const sx = r.x + 40 + sh * 180;
      fillRR(ctx, sx, r.y + 60, 150, 140, 6, null, '#8b5e34', 6);
      for (let row = 0; row < 3; row++) {
        ctx.fillStyle = '#8b5e34'; ctx.fillRect(sx, r.y + 100 + row * 40, 150, 6);
        for (let c = 0; c < 5; c++) {
          const s = pop(fd, row + c * 0.3, 6);
          if (s <= 0.01) continue;
          ctx.fillStyle = cols[(sh * 7 + row * 3 + c) % cols.length];
          ctx.fillRect(sx + 8 + c * 28, r.y + 100 + row * 40 - 30 * s, 22, 30 * s);
        }
      }
    }
    label(ctx, r, 'FOOD', fd);
  }

  // water
  const wa = k(st, 'water', t);
  if (wa > 0) {
    const r = ROOMS.water;
    roomShell(ctx, r, wa, true, true);
    for (let i = 0; i < 3; i++) {
      const s = pop(wa, i, 3);
      ctx.save(); ctx.translate(r.x + 80 + i * 110, r.y + r.h - 20); ctx.scale(s, s);
      fillRR(ctx, -42, -140, 84, 140, 22, '#bfe3ff', C.ink, 5);
      const lvl = 0.75 + 0.03 * Math.sin(t * 2 + i);
      ctx.save(); rr(ctx, -42, -140, 84, 140, 22); ctx.clip();
      ctx.fillStyle = '#3b9cf0'; ctx.fillRect(-42, -140 * lvl, 84, 140 * lvl); ctx.restore();
      text(ctx, 'H₂O', 0, -60, 26, '#ffffff');
      ctx.restore();
    }
    label(ctx, r, 'WATER + FILTERS', wa);
  }

  // farm
  const fa = k(st, 'farm', t, 1.2);
  if (fa > 0) {
    const r = ROOMS.farm;
    roomShell(ctx, r, fa, true, true);
    ctx.fillStyle = 'rgba(190,120,255,0.18)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    for (let i = 0; i < 3; i++) fillRR(ctx, r.x + 30 + i * 120, r.y + 20, 100, 12, 6, '#d8b4fe');
    fillRR(ctx, r.x + 20, r.y + r.h - 40, r.w - 40, 30, 6, '#5b3a1e');
    const grow = clamp((t - st.features.farm - 0.4) / 2.5);
    for (let i = 0; i < 10; i++) {
      const px = r.x + 45 + i * 34, h = (30 + (i % 3) * 14) * easeOut(grow);
      ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(px, r.y + r.h - 40); ctx.lineTo(px, r.y + r.h - 40 - h); ctx.stroke();
      if (h > 10) { ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.ellipse(px - 10, r.y + r.h - 40 - h * 0.7, 12, 6, -0.5, 0, Math.PI * 2); ctx.ellipse(px + 10, r.y + r.h - 40 - h, 12, 6, 0.5, 0, Math.PI * 2); ctx.fill(); }
    }
    label(ctx, r, 'UNDERGROUND FARM', fa);
  }

  // surface: house (after purchase) + solar
  const bought = st.features.house != null;
  house(ctx, 540, G - 60, 420, t, { lights: night > 0.5 ? 1 : 0, sold: bought ? k(st, 'house', t, 0.6) : 0 });
  const so = k(st, 'solar', t);
  if (so > 0) {
    for (let i = 0; i < 3; i++) {
      const s = pop(so, i, 3);
      for (const side of [-1, 1]) {
        const x = side < 0 ? 120 + i * 70 : 800 + i * 70;
        ctx.save(); ctx.translate(x, G - 70); ctx.scale(s, s);
        ctx.fillStyle = '#4b5563'; ctx.fillRect(-4, -40, 8, 40);
        ctx.transform(1, 0, -0.35, 0.6, 0, 0);
        fillRR(ctx, -40, -150, 80, 110, 6, '#1e3a8a', '#cbd5e1', 5);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-40, -95); ctx.lineTo(40, -95); ctx.moveTo(0, -150); ctx.lineTo(0, -40); ctx.stroke();
        ctx.restore();
      }
    }
    // cable to the power room
    if (pw > 0 || so > 0.6) {
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 6; ctx.setLineDash([16, 12]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.moveTo(140, G - 60); ctx.lineTo(100, G + 40); ctx.lineTo(100, 1180); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // hero inside
  if (hero) {
    const r = ROOMS[hero] || ROOMS.living;
    const hx = r.x + r.w * 0.62, hy = r.y + r.h - 10;
    person(ctx, hx, hy, 0.55, t, { mood: 'neutral' });
  }
  if (family > 0) {
    // family waiting at the surface hatch
    ctx.globalAlpha = clamp(family);
    for (const [dx, s, o] of [[-60, 0.42, { top: '#4d7c5a', hat: '#b33a3a', skin: '#c98c64', mood: 'worried' }], [10, 0.4, { top: '#7a4fa0', hat: '#e2e8f0', mood: 'worried' }], [70, 0.24, { top: '#f2b705', hat: '#3b82f6', mood: 'worried', phone: true }]]) {
      person(ctx, 860 + dx, G - 60, s, t + dx, o);
    }
    ctx.globalAlpha = 1;
  }
}

export function focusLerp(a, b, u) {
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
}

export { glow };
