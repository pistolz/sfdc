// "Money run" kit — LEO: 100 DAYS TO PAY RENT (original series).
// Messy-apartment background, money HUD (days left · bank · goal bar), everyday props drawn in code
// (final-notice letter, noodle cups, cracked phone, game console, cash, delivery bag…),
// price tags and a TOP COMMENT card. Cel-shaded to match the toon characters.
import { clamp, lerp, easeOut, backOut, rand, hash, text, fillRR } from './draw.js';
import { cel, ell, poly, smoothShape, OUT } from './toon.js';

const OS = 'Oswald';
const ease3 = (x) => 1 - Math.pow(1 - clamp(x), 3);
const money = (v) => '$' + Math.round(v).toLocaleString('en-US');
const keyT = (p, w, d = 0) => (w == null ? d : typeof w === 'number' ? w : p.key(w) ?? d);

// ------------------------------------------------------------------ apartment
export function leoRoom(ctx, t, { night = true, mess = 1, horizon = 1240 } = {}) {
  // wall
  const wg = ctx.createLinearGradient(0, 0, 0, horizon); wg.addColorStop(0, night ? '#2d3150' : '#6f7aa0'); wg.addColorStop(1, night ? '#424469' : '#8b93b6');
  ctx.fillStyle = wg; ctx.fillRect(0, 0, 1080, horizon);
  // wallpaper stripes + damp stain
  ctx.fillStyle = 'rgba(255,255,255,0.035)'; for (let x = 0; x < 1080; x += 90) ctx.fillRect(x, 0, 40, horizon);
  ctx.fillStyle = 'rgba(40,30,20,0.18)'; ctx.beginPath(); ctx.ellipse(170, 260, 120, 80, 0.3, 0, Math.PI * 2); ctx.fill();
  // window with city at night
  const wx = 600, wy = 330, ww = 380, wh = 420;
  cel(ctx, poly([[wx - 16, wy - 16], [wx + ww + 16, wy - 16], [wx + ww + 16, wy + wh + 16], [wx - 16, wy + wh + 16]]), '#c9c2b4', '#a59d8f', { dx: 8 });
  const sk = ctx.createLinearGradient(0, wy, 0, wy + wh); sk.addColorStop(0, night ? '#141a3a' : '#7cc0ef'); sk.addColorStop(1, night ? '#4a3a6a' : '#cfe8ff');
  ctx.fillStyle = sk; ctx.fillRect(wx, wy, ww, wh);
  ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  const R = rand(7);
  for (let i = 0; i < 9; i++) { const bx = wx + i * 46 - 10, bh = 120 + R() * 230; ctx.fillStyle = night ? '#1c2142' : '#8c9bb8'; ctx.fillRect(bx, wy + wh - bh, 44, bh);
    if (night) for (let k = 0; k < 14; k++) { if (R() < 0.45) { ctx.fillStyle = hash(i * 31 + k + Math.floor(t * 0.5)) > 0.1 ? '#ffd77a' : '#6a5a3a'; ctx.fillRect(bx + 6 + (k % 3) * 13, wy + wh - bh + 10 + Math.floor(k / 3) * 22, 8, 10); } } }
  if (night) { ctx.fillStyle = '#f4f0d8'; ctx.beginPath(); ctx.arc(wx + 300, wy + 80, 30, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle = '#a59d8f'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
  ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.strokeRect(wx - 16, wy - 16, ww + 32, wh + 32);
  // poster (original: a mountain + sun)
  cel(ctx, poly([[110, 470], [330, 470], [330, 760], [110, 760]]), '#e9c46a', '#d4ad52', { dx: 8 });
  ctx.fillStyle = '#e76f51'; ctx.beginPath(); ctx.arc(220, 560, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#264653'; ctx.beginPath(); ctx.moveTo(120, 750); ctx.lineTo(200, 620); ctx.lineTo(250, 690); ctx.lineTo(290, 640); ctx.lineTo(320, 750); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(320, 480); ctx.rotate(0.5); ctx.fillStyle = '#d9d2c2'; ctx.fillRect(-30, -10, 60, 20); ctx.restore();
  // floor
  const fg = ctx.createLinearGradient(0, horizon, 0, 1920); fg.addColorStop(0, '#6b4f3a'); fg.addColorStop(1, '#3e2c20');
  ctx.fillStyle = fg; ctx.fillRect(0, horizon, 1080, 1920 - horizon);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3;
  for (let k = 1; k < 9; k++) { const y = horizon + Math.pow(k / 9, 1.5) * (1920 - horizon); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke(); }
  ctx.fillStyle = '#2a2018'; ctx.fillRect(0, horizon - 14, 1080, 18);
  // mattress on the floor (left) + crumpled blanket
  cel(ctx, smoothShape([[-40, horizon + 20], [380, horizon + 10], [420, horizon + 120], [-40, horizon + 150]]), '#d8d4ca', '#b8b2a6', { dy: 14 });
  cel(ctx, smoothShape([[40, horizon + 30], [200, horizon - 10], [330, horizon + 40], [300, horizon + 110], [60, horizon + 120]]), '#5b7fa6', '#46668a', { dx: 12 });
  // light from the lamp
  const lg = ctx.createRadialGradient(780, horizon - 200, 30, 780, horizon - 200, 700); lg.addColorStop(0, 'rgba(255,210,140,0.25)'); lg.addColorStop(1, 'rgba(255,210,140,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, 1080, 1920);
  // scattered mess
  if (mess > 0) {
    const M = rand(11);
    for (let i = 0; i < 6 * mess; i++) { const x = 60 + M() * 960, y = horizon + 220 + M() * 420; prop(ctx, t, ['noodles', 'can', 'paper', 'sock', 'pizza', 'noodles'][i % 6], { x, y, s: 0.5 + (y - horizon) / 1200, rot: (M() - 0.5) * 0.8 }); }
  }
  // vignette
  const vg = ctx.createRadialGradient(540, 900, 500, 540, 960, 1300); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, 1080, 1920);
}

// ------------------------------------------------------------------ props
export function prop(ctx, t, kind, { x = 0, y = 0, s = 1, rot = 0, label = '' } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  switch (kind) {
    case 'noodles': // instant noodle cup
      cel(ctx, poly([[-38, -70], [38, -70], [28, 0], [-28, 0]]), '#f4efe6', '#d9d2c6', { dx: 8 });
      ctx.fillStyle = '#d9443b'; ctx.fillRect(-35, -52, 70, 20); ctx.fillStyle = '#ffffff'; ctx.font = `700 13px ${OS}`; ctx.textAlign = 'center'; ctx.fillText('NOODLE', 0, -37);
      cel(ctx, ell(0, -70, 40, 9), '#e9d9a8', '#cdb97f'); break;
    case 'can':
      cel(ctx, poly([[-20, -60], [20, -60], [20, 0], [-20, 0]]), '#4a9ad4', '#3a7ab0', { dx: 6 }); ctx.fillStyle = '#c9d3dc'; ctx.fillRect(-20, -60, 40, 8); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(-20, -60, 40, 60); break;
    case 'paper':
      cel(ctx, smoothShape([[-30, -18], [0, -30], [30, -16], [24, 14], [-4, 20], [-28, 10]]), '#f2f0ea', '#d4d0c6', { dx: 6 }); break;
    case 'sock':
      cel(ctx, smoothShape([[-30, -40], [0, -44], [6, -6], [40, 0], [36, 20], [-20, 18], [-26, -4]]), '#e8e4da', '#c6c0b4', { dx: 6 }); break;
    case 'pizza':
      cel(ctx, poly([[-70, -14], [70, -14], [74, 10], [-74, 10]]), '#c99a5e', '#a87c44', { dy: 6 }); cel(ctx, poly([[-70, -14], [70, -14], [50, -40], [-50, -40]]), '#d8ab6e', '#c19254', { dy: 4 }); break;
    case 'letter': { // FINAL NOTICE
      cel(ctx, poly([[-170, -220], [170, -220], [170, 220], [-170, 220]]), '#fbf7ee', '#e3dccd', { dx: 10 });
      ctx.fillStyle = '#2a2430'; ctx.font = `700 34px ${OS}`; ctx.textAlign = 'left'; ctx.fillText('NOTICE TO PAY RENT', -140, -160);
      ctx.fillStyle = '#9a94a0'; for (let k = 0; k < 7; k++) ctx.fillRect(-140, -120 + k * 30, 280 - (k % 3) * 50, 10);
      ctx.fillStyle = '#2a2430'; ctx.font = `700 30px ${OS}`; ctx.fillText('AMOUNT DUE: $3,000', -140, 120);
      ctx.save(); ctx.translate(40, 40); ctx.rotate(-0.22); ctx.strokeStyle = '#d6322e'; ctx.lineWidth = 8; ctx.strokeRect(-140, -40, 280, 80); ctx.fillStyle = '#d6322e'; ctx.font = `700 46px ${OS}`; ctx.textAlign = 'center'; ctx.fillText('FINAL NOTICE', 0, 20); ctx.restore();
      break; }
    case 'phone': // cracked phone, $12 balance on screen
      cel(ctx, poly([[-70, -140], [70, -140], [70, 140], [-70, 140]]), '#1e1e26', '#14141a', { dx: 6 });
      ctx.fillStyle = '#2b5c8a'; ctx.fillRect(-58, -120, 116, 230);
      ctx.fillStyle = '#ffffff'; ctx.font = `600 16px ${OS}`; ctx.textAlign = 'center'; ctx.fillText('BALANCE', 0, -50); ctx.font = `700 44px ${OS}`; ctx.fillText(label || '$12.00', 0, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(30, -120); ctx.lineTo(-6, -40); ctx.lineTo(20, 10); ctx.lineTo(-40, 110); ctx.moveTo(-6, -40); ctx.lineTo(-58, -20); ctx.stroke();
      break;
    case 'console': { // generic retro game console (original design)
      cel(ctx, smoothShape([[-150, -40], [150, -40], [160, 40], [-160, 40]]), '#e9e6ee', '#c8c4d0', { dy: 10 });
      ctx.fillStyle = '#4a4458'; ctx.fillRect(-120, -22, 150, 14); circle2(ctx, 100, 0, 14, '#d6322e'); circle2(ctx, 70, 10, 8, '#3a7ab0');
      // controller with cable
      ctx.strokeStyle = '#2a2430'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-150, 20); ctx.bezierCurveTo(-220, 40, -230, 120, -170, 140); ctx.stroke();
      cel(ctx, smoothShape([[-230, 120], [-110, 120], [-90, 170], [-140, 190], [-200, 190], [-250, 170]]), '#4a4458', '#36324a', { dy: 8 });
      circle2(ctx, -140, 150, 9, '#e9c46a'); circle2(ctx, -118, 160, 9, '#d6322e'); ctx.fillStyle = '#e9e6ee'; ctx.fillRect(-222, 146, 34, 10); ctx.fillRect(-210, 134, 10, 34);
      break; }
    case 'bag': // food delivery backpack (no brand)
      cel(ctx, poly([[-110, -120], [110, -120], [120, 110], [-120, 110]]), '#2aa36b', '#1f8656', { dx: 12 });
      cel(ctx, poly([[-110, -120], [110, -120], [90, -150], [-90, -150]]), '#34b97a', '#2aa36b');
      ctx.fillStyle = '#ffffff'; ctx.font = `700 36px ${OS}`; ctx.textAlign = 'center'; ctx.fillText('DELIVERY', 0, 0);
      break;
    case 'cash':
      cel(ctx, poly([[-90, -42], [90, -42], [90, 42], [-90, 42]]), '#8fd18a', '#6fb46a', { dy: 6 });
      ctx.strokeStyle = '#3e7a3a'; ctx.lineWidth = 3; ctx.strokeRect(-78, -30, 156, 60); circle2(ctx, 0, 0, 20, '#a8e0a2', '#3e7a3a'); ctx.fillStyle = '#3e7a3a'; ctx.font = `700 26px ${OS}`; ctx.textAlign = 'center'; ctx.fillText('$', 0, 9);
      break;
  }
  ctx.restore();
}
function circle2(ctx, x, y, r, fill, stroke) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); } }

// ------------------------------------------------------------------ HUD
export function moneyHud(ctx, t, { days = 100, bank = 12, goal = 3000, delta = 0, deltaK = 0, label = 'RENT DUE' } = {}) {
  const box = (x, w, title, val, col) => {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 16; fillRR(ctx, x, 0, w, 150, 18, 'rgba(14,16,30,0.9)'); ctx.restore();
    text(ctx, title, x + w / 2, 34, 28, '#b9c1d6', { font: OS, weight: 600 });
    text(ctx, val, x + w / 2, 96, 72, col, { font: 'Anton', weight: 400 });
  };
  box(0, 250, 'DAYS LEFT', String(days), '#ffd84a');
  box(270, 290, 'BANK', money(bank), bank < 100 ? '#ff5a4f' : '#5ee07a');
  box(580, 250, label, money(goal), '#ffffff');
  // progress bar bank → goal
  const k = clamp(bank / goal);
  fillRR(ctx, 0, 170, 830, 26, 13, 'rgba(14,16,30,0.85)'); fillRR(ctx, 4, 174, Math.max(18, 822 * k), 18, 9, '#5ee07a');
  text(ctx, `${Math.round(k * 100)}%`, 840, 184, 26, '#ffffff', { font: OS, weight: 700, align: 'left' });
  if (delta && deltaK > 0) { // floating "+$150"
    ctx.save(); ctx.globalAlpha = clamp(deltaK * 4) * (1 - clamp((deltaK - 0.7) / 0.3)); text(ctx, (delta > 0 ? '+' : '−') + money(Math.abs(delta)), 470, -20 - deltaK * 40, 54, delta > 0 ? '#5ee07a' : '#ff5a4f', { font: 'Anton', weight: 400, stroke: 'rgba(0,0,0,0.6)', lw: 8 }); ctx.restore();
  }
}
/** Price tag hanging off a prop. */
export function tag(ctx, price, k = 1, color = '#ffd84a') {
  const s = backOut(clamp(k)); ctx.save(); ctx.scale(s, s); ctx.rotate(-0.08);
  ctx.strokeStyle = '#2a2430'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, -20); ctx.stroke();
  cel(ctx, poly([[-90, -24], [70, -24], [100, 20], [70, 64], [-90, 64]]), color, '#d9b43a', { dy: 8 });
  circle2(ctx, 66, 20, 8, '#2a2430');
  text(ctx, price, -10, 22, 50, '#2a2430', { font: 'Anton', weight: 400 });
  ctx.restore();
}
/** "TOP COMMENT" card (the viewer's winning comment, shown on screen). */
export function topComment(ctx, { user = 'viewer', text: msg = '', likes = '' } = {}) {
  const w = 760, h = 190;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 20; fillRR(ctx, -w / 2, -h / 2, w, h, 26, '#ffffff', '#1e1a22', 5); ctx.restore();
  circle2(ctx, -w / 2 + 70, -20, 36, '#7aa7e8'); circle2(ctx, -w / 2 + 70, -32, 13, '#ffffff'); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-w / 2 + 70, -4, 22, 12, 0, Math.PI, 0); ctx.fill();
  text(ctx, '@' + user, -w / 2 + 130, -46, 30, '#6b6f80', { font: OS, weight: 600, align: 'left' });
  text(ctx, msg, -w / 2 + 130, 0, 40, '#1e1a22', { font: OS, weight: 700, align: 'left' });
  if (likes) { text(ctx, '♥ ' + likes, w / 2 - 30, 0, 40, '#e0453c', { font: OS, weight: 700, align: 'right' }); }
  text(ctx, 'TOP COMMENT', -w / 2 + 130, 56, 22, '#9a9eb0', { font: OS, weight: 700, align: 'left' });
}

// ------------------------------------------------------------------ compose layers
export const MONEY_LAYERS = {
  'leo-room'(ctx, L, p) { leoRoom(ctx, p.t, { night: L.night !== false, mess: L.mess ?? 1, horizon: L.horizon ?? 1240 }); },
  'money-hud'(ctx, L, p) {
    const t0 = keyT(p, L.changeAt, 1e9), k = ease3((p.lt - t0) / (L.dur ?? 0.9));
    const bank = L.bankTo != null && p.lt >= t0 ? lerp(L.bank ?? 12, L.bankTo, k) : L.bank ?? 12;
    moneyHud(ctx, p.t, { days: L.days ?? 100, bank, goal: L.goal ?? 3000, delta: L.bankTo != null ? L.bankTo - (L.bank ?? 12) : 0, deltaK: p.lt >= t0 ? clamp((p.lt - t0) / 1.6) : 0, label: L.label || 'RENT DUE' });
  },
  'prop'(ctx, L, p) {
    prop(ctx, p.t, L.kind || 'noodles', { s: L.s ?? 1, label: L.label || '' });
    if (L.price) { const tk = clamp((p.lt - keyT(p, L.priceAt ?? L.at)) / 0.45); if (tk > 0) { ctx.save(); ctx.translate(L.tagX ?? 120, L.tagY ?? -120); tag(ctx, L.price, tk, L.tagColor); ctx.restore(); } }
    if (L.cross != null) { const ck = clamp((p.lt - keyT(p, L.cross)) / 0.3); if (ck > 0) { ctx.strokeStyle = '#e0453c'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-140, -140); ctx.lineTo(-140 + 280 * ck, -140 + 280 * ck); ctx.stroke(); } }
  },
  'top-comment'(ctx, L) { topComment(ctx, { user: L.user, text: L.text, likes: L.likes }); },
  'day-badge'(ctx, L) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 14; fillRR(ctx, -170, -60, 340, 120, 20, 'rgba(14,16,30,0.92)', '#ffd84a', 5); ctx.restore();
    text(ctx, L.text || 'DAY 1', 0, 4, 76, '#ffd84a', { font: 'Anton', weight: 400 });
  },
};
