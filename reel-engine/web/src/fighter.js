// "Fighter" art kit — original anime-battle universe (90s action-anime energy, original designs).
// Realistic shōnen proportions (~7 heads), cel shading, thick outlines, power auras,
// transformations, energy beams, focus lines, flash, shake, floating rocks and a power HUD.
import { clamp, lerp, easeOut, rand, hash, text } from './draw.js';
import { cel, capsule, ell, poly, smoothShape, OUT } from './toon.js';

const D = Math.PI / 180;
const LW2 = 5;
const mix = (a, b, k) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, k));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

// ------------------------------------------------------------------ cast (original characters)
export const FIGHTERS = {
  kairo: {
    skin: '#eab38c', skinS: '#c88a66', hair: '#1c2138', hairS: '#0f1224', streak: '#d0323c',
    vest: '#2a2e3a', vestS: '#181b24', pants: '#3b4766', pantsS: '#27304a', sash: '#d0323c', sashS: '#9a1f28',
    wrap: '#efe8da', wrapS: '#cfc5b2', boot: '#23262f', bootS: '#15171d', eye: '#e3a12e',
    // transformed form ("Ignition")
    fHair: '#fff4f2', fHairS: '#ff5a64', fEye: '#ff2d4a',
    aura: ['#4fb4ff', '#c9ecff'], fAura: ['#ff3446', '#fff0e8'],
    spikes: [[-196, 95], [-163, 165], [-128, 215], [-95, 240], [-60, 205], [-26, 160], [8, 100]],
  },
  vexa: {
    skin: '#f1c7a8', skinS: '#d19f80', hair: '#eceef6', hairS: '#b7bccf', streak: '#8a5cff',
    vest: '#4a2f78', vestS: '#321e55', pants: '#1f1b2c', pantsS: '#14111d', sash: '#c9a24a', sashS: '#9a7a2e',
    wrap: '#2b2540', wrapS: '#1c1830', boot: '#1c1828', bootS: '#100e18', eye: '#9b6bff',
    fHair: '#ffffff', fHairS: '#ff6a8a', fEye: '#ff3a6a',
    aura: ['#ff4a5a', '#ffd0d6'], fAura: ['#b04aff', '#f4e6ff'],
    female: true,
    spikes: [[-192, 70], [-150, 120], [-110, 150], [-72, 130], [-34, 100], [4, 70]],
  },
};

// ------------------------------------------------------------------ aura
/** Anime power aura: nested flame silhouettes with animated tips + rising streaks + sparks. */
export function aura(ctx, t, { color = '#4fb4ff', core = '#d9f2ff', power = 1, h = 1000, w = 250, front = false } = {}) {
  if (power <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const cy = -h * 0.5;
  if (!front) {
    const g = ctx.createRadialGradient(0, cy, 40, 0, cy, h * 0.85);
    g.addColorStop(0, hexA(color, 0.42 * power)); g.addColorStop(0.55, hexA(color, 0.16 * power)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.fillRect(-h, cy - h, h * 2, h * 2);
  }
  const layers = front ? [[0.82, core, 0.18]] : [[1.25, color, 0.30], [1.05, color, 0.42], [0.86, core, 0.40]];
  layers.forEach(([sc, col, al], li) => {
    const pts = []; const N = 34;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const sx = Math.sin(a), sy = -Math.cos(a);                   // sy=-1 top, +1 bottom
      const top = clamp(-sy);                                       // 1 at top
      let rx = w * sc * (0.75 + 0.35 * Math.pow(Math.abs(sx), 0.6)) * (1 + 0.12 * power);
      let ry = h * 0.6 * sc;
      let x = sx * rx, y = cy + sy * ry;
      if (y > 10) y = 10 + (y - 10) * 0.15;                          // flatten on the ground
      if (i % 2 === 0) {                                            // flame tips, licking upward
        const f = 0.5 + 0.5 * Math.sin(t * (11 + li * 2) + i * 1.9);
        const len = (40 + 110 * top + 50 * Math.abs(sx)) * f * power * sc;
        x += sx * len * 0.35 + Math.sin(t * 7 + i) * 10; y -= len * (0.5 + top);
      } else { x *= 0.92; y += 18; }
      pts.push([x, y]);
    }
    ctx.globalAlpha = al * clamp(power * 1.3);
    const grad = ctx.createLinearGradient(0, cy - h * 0.8, 0, 20);
    grad.addColorStop(0, hexA(col, 0.95)); grad.addColorStop(0.6, hexA(col, 0.75)); grad.addColorStop(1, hexA(col, 0.35));
    ctx.fillStyle = grad; ctx.fill(smoothShape(pts));
  });
  // rising energy streaks
  ctx.globalAlpha = 0.8 * power; ctx.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const u = (t * (0.9 + hash(i) * 0.8) + hash(i + 9)) % 1;
    const x = (hash(i * 3.1) - 0.5) * w * 2.2, y = 20 - u * h * 1.25;
    ctx.strokeStyle = hexA(i % 3 ? color : core, Math.sin(u * Math.PI));
    ctx.lineWidth = 4 + hash(i) * 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 60 - hash(i * 7) * 90); ctx.stroke();
  }
  // electric sparks at high power
  if (power > 0.75 && !front) {
    const R = rand(Math.floor(t * 14));
    ctx.strokeStyle = core; ctx.lineWidth = 4; ctx.shadowColor = color; ctx.shadowBlur = 18; ctx.globalAlpha = 1;
    for (let k = 0; k < 3; k++) {
      let x = (R() - 0.5) * w * 1.8, y = -R() * h * 1.05; ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += (R() - 0.5) * 70; y += (R() - 0.3) * 60; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  ctx.restore();
}
function hexA(hex, a) {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${clamp(a)})`;
}

// ------------------------------------------------------------------ the fighter
const POSES = {
  //            arm R [upper°, fore°]   arm L          stance  lean
  idle:   { R: [78, 118], L: [102, 62], st: 0.2, fist: true },
  ready:  { R: [60, -60], L: [125, 215], st: 0.7, fist: true },
  charge: { R: [52, 75], L: [128, 105], st: 1, fist: true, shout: true },
  beam:   { R: [4, -4], L: [8, -2], st: 0.9, fist: false, look: 1 },
  point:  { R: [-28, -30], L: [102, 62], st: 0.3, fist: false },
  cross:  { R: [150, 260], L: [30, -80], st: 0.5, fist: true },
};
/**
 * o: { who: 'kairo'|'vexa'|{palette}, pose, form (0..1 transformation), power (aura 0..1),
 *      mood: calm|angry|shout|smirk|shock, talk (0..1), lookX (-1..1), t }
 * Origin = between the feet. Height ≈ 1000 at scale 1. Returns the hands' position (local coords).
 */
export function fighter(ctx, t, o = {}) {
  const c = { ...FIGHTERS.kairo, ...(typeof o.who === 'string' ? FIGHTERS[o.who] : o.who || {}) };
  const P = { ...POSES.idle, ...(POSES[o.pose] || {}), ...(o.arms || {}) };
  const f = clamp(o.form || 0), pw = clamp(o.power || 0);
  const hair = f > 0 ? mix(c.hair, c.fHair, f) : c.hair, hairS = f > 0 ? mix(c.hairS, c.fHairS, f) : c.hairS;
  const auraC = f > 0.5 ? c.fAura : c.aura;
  const shake = pw > 0.6 ? Math.sin(t * 61) * 2.5 * pw : 0;
  const br = Math.sin(t * 2.2 + (o.phase || 0)) * 4;
  const st = P.st;
  ctx.save(); ctx.translate(shake, 0);

  // aura behind
  aura(ctx, t, { color: auraC[0], core: auraC[1], power: pw, h: 1040, w: 270 });
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 6, 170 + st * 60, 26, 0, 0, Math.PI * 2); ctx.fill();

  if (c.female) { // long hair falling down the back, flowing with the aura
    const fl = Math.sin(t * 3) * 10 + pw * Math.sin(t * 9) * 14;
    cel(ctx, smoothShape([[-96, -1046], [96, -1046], [150, -900], [170 + fl, -700], [140 + fl, -520], [60 + fl, -580], [0, -500 + fl], [-60 + fl, -580], [-140 + fl, -520], [-170 + fl, -700], [-150, -900]]), mix(c.hair, '#000000', 0.12), c.hairS, { dx: 14 });
  }
  // ---------------- legs: baggy combat pants gathered into boots, knees bent with the stance
  const fem = c.female, W = fem ? 0.86 : 1;
  const hipY = -500;
  for (const s of [-1, 1]) {
    const hx = s * 52 * W, kx = s * (86 + st * 60) * W, ky = -262 + st * 12, ax = s * (92 + st * 92) * W, ay = -66;
    const tw = (fem ? 52 : 70), kw = (fem ? 42 : 58), aw = 34;
    const leg = smoothShape([
      [hx - s * 66 * W, hipY - 10], [hx + s * (tw + 6), hipY - 6], [kx + s * (kw + 12), ky - 30], [kx + s * kw, ky + 20],
      [ax + s * (aw + 10), ay - 40], [ax + s * aw, ay + 6], [ax - s * aw, ay + 6], [ax - s * (aw + 6), ay - 50],
      [kx - s * (kw - 4), ky + 10], [kx - s * (kw + 4), ky - 40], [s * 10, hipY + 40]]);
    cel(ctx, leg, c.pants, c.pantsS, { dx: s * 16, rim: 'rgba(255,255,255,0.08)' });
    // fabric folds (the thing that sells "drawn by hand")
    ctx.strokeStyle = c.pantsS; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(kx - s * 36, ky - 50); ctx.quadraticCurveTo(kx, ky - 22, kx + s * 40, ky - 46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(kx - s * 20, ky + 26); ctx.quadraticCurveTo(kx + s * 6, ky + 40, kx + s * 30, ky + 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lerp(hx, kx, 0.4) + s * 30, lerp(hipY, ky, 0.4)); ctx.quadraticCurveTo(lerp(hx, kx, 0.55), lerp(hipY, ky, 0.6), lerp(hx, kx, 0.7) - s * 26, lerp(hipY, ky, 0.75)); ctx.stroke();
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(ax - s * 30, ay - 30 - k * 14); ctx.lineTo(ax + s * 30, ay - 24 - k * 14); ctx.stroke(); }
    // boot
    cel(ctx, smoothShape([[ax - 40, ay - 10], [ax + 40, ay - 10], [ax + 46 + s * 24, -6], [ax + s * 44, 8], [ax - s * 36, 8], [ax - 46, -6]]), c.boot, c.bootS, { dy: 8 });
    ctx.fillStyle = c.sash; ctx.fillRect(ax - 40, ay - 10, 80, 12); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(ax - 40, ay - 10, 80, 12);
  }

  // ---------------- torso
  ctx.save(); ctx.translate(0, br);
  if (!fem) {
    const T = smoothShape([[-150, -800], [-70, -826], [70, -826], [150, -800], [166, -730], [128, -640], [96, -560], [100, -500], [-100, -500], [-96, -560], [-128, -640], [-166, -730]]);
    cel(ctx, T, c.skin, c.skinS, { dx: 16, rim: 'rgba(255,255,255,0.16)' });
    ctx.strokeStyle = c.skinS; ctx.lineCap = 'round'; ctx.lineWidth = 6;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 8, -770); ctx.quadraticCurveTo(s * 70, -690, s * 132, -730); ctx.stroke();
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(s * 92, -650); ctx.quadraticCurveTo(s * 70, -590, s * 80, -520); ctx.stroke(); ctx.lineWidth = 6;
    }
    ctx.beginPath(); ctx.moveTo(0, -790); ctx.lineTo(0, -520); ctx.stroke();
    ctx.lineWidth = 5;
    for (const y of [-650, -605, -562]) for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 8, y); ctx.quadraticCurveTo(s * 32, y - 8, s * 52, y + 2); ctx.stroke(); }
    for (const s of [-1, 1]) {
      cel(ctx, poly([[s * 150, -800], [s * 60, -826], [s * 40, -790], [s * 72, -660], [s * 78, -540], [s * 102, -500], [s * 100, -560], [s * 128, -640], [s * 166, -730]]), c.vest, c.vestS, { dx: s * 10, rim: 'rgba(255,255,255,0.10)' });
      ctx.strokeStyle = c.streak; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(s * 44, -786); ctx.lineTo(s * 74, -662); ctx.lineTo(s * 80, -540); ctx.stroke();
    }
    cel(ctx, poly([[-74, -830], [74, -830], [58, -800], [-58, -800]]), c.vestS, null);
  } else {
    // armoured fitted top: narrow waist, shoulder guards, chest plate, no abs
    const T = smoothShape([[-122, -796], [-60, -822], [60, -822], [122, -796], [128, -720], [92, -640], [72, -570], [96, -500], [-96, -500], [-72, -570], [-92, -640], [-128, -720]]);
    cel(ctx, T, c.vest, c.vestS, { dx: 16, rim: 'rgba(255,255,255,0.14)' });
    cel(ctx, smoothShape([[-86, -760], [86, -760], [80, -690], [40, -654], [0, -664], [-40, -654], [-80, -690]]), c.sash, c.sashS, { dx: 10, rim: 'rgba(255,255,255,0.35)' });
    ctx.strokeStyle = c.vestS; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -650); ctx.lineTo(0, -540); ctx.stroke();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 70, -640); ctx.quadraticCurveTo(s * 52, -590, s * 66, -530); ctx.stroke(); }
    cel(ctx, poly([[-50, -838], [50, -838], [40, -806], [-40, -806]]), c.vestS, null);
  }
  // sash / belt with knot + tails
  cel(ctx, poly([[-104 * W, -530], [104 * W, -530], [108 * W, -486], [-108 * W, -486]]), c.sash, c.sashS, { dy: 10 });
  const wave = Math.sin(t * 6) * 14 * (0.3 + pw);
  for (const k of [0, 1]) cel(ctx, poly([[56, -500], [84 + k * 6, -500], [96 + k * 24 + wave, -380 + k * 30], [70 + k * 20 + wave * 0.8, -386 + k * 30]]), c.sash, c.sashS, { dx: 6 });
  cel(ctx, ell(66, -508, 22, 18), c.sash, c.sashS, { dx: 5 });
  ctx.restore();

  // ---------------- arms (absolute screen angles: 0 = right, 90 = down)
  const hands = {};
  const A = fem ? 0.82 : 1;
  const arm = (s, [a1, a2]) => {
    const sx = s * (fem ? 120 : 148), sy = -778 + br;
    const ex = sx + Math.cos(a1 * D) * 172, ey = sy + Math.sin(a1 * D) * 172;
    const hx = ex + Math.cos(a2 * D) * 152, hy = ey + Math.sin(a2 * D) * 152;
    // upper arm: bulging bicep (wider in the middle)
    const n1 = (a1 + 90) * D, mx1 = lerp(sx, ex, 0.45), my1 = lerp(sy, ey, 0.45);
    const up = smoothShape([[sx + Math.cos(n1) * 46 * A, sy + Math.sin(n1) * 46 * A], [mx1 + Math.cos(n1) * 50 * A, my1 + Math.sin(n1) * 50 * A], [ex + Math.cos(n1) * 32 * A, ey + Math.sin(n1) * 32 * A],
      [ex + Math.cos(a1 * D) * 30, ey + Math.sin(a1 * D) * 30], [ex - Math.cos(n1) * 32 * A, ey - Math.sin(n1) * 32 * A], [mx1 - Math.cos(n1) * 44 * A, my1 - Math.sin(n1) * 44 * A], [sx - Math.cos(n1) * 46 * A, sy - Math.sin(n1) * 46 * A], [sx - Math.cos(a1 * D) * 40, sy - Math.sin(a1 * D) * 40]]);
    const n2 = (a2 + 90) * D, mx2 = lerp(ex, hx, 0.3), my2 = lerp(ey, hy, 0.3);
    const fore = smoothShape([[ex + Math.cos(n2) * 34 * A, ey + Math.sin(n2) * 34 * A], [mx2 + Math.cos(n2) * 40 * A, my2 + Math.sin(n2) * 40 * A], [hx + Math.cos(n2) * 26 * A, hy + Math.sin(n2) * 26 * A],
      [hx - Math.cos(n2) * 26 * A, hy - Math.sin(n2) * 26 * A], [mx2 - Math.cos(n2) * 36 * A, my2 - Math.sin(n2) * 36 * A], [ex - Math.cos(n2) * 32 * A, ey - Math.sin(n2) * 32 * A], [ex - Math.cos(a2 * D) * 26, ey - Math.sin(a2 * D) * 26]]);
    const delt = ell(sx, sy + 4, 56, 50);
    ctx.strokeStyle = OUT; ctx.lineWidth = 10; ctx.lineJoin = 'round'; for (const q of [up, fore, ...(fem ? [] : [delt])]) ctx.stroke(q);
    cel(ctx, up, fem ? c.vest : c.skin, fem ? c.vestS : c.skinS, { dx: s * 9, rim: 'rgba(255,255,255,0.14)', line: false });
    // shoulder: deltoid (male) / guard (female)
    if (fem) cel(ctx, smoothShape([[sx - 60, sy - 10], [sx, sy - 52], [sx + 60, sy - 10], [sx + s * 50, sy + 46], [sx - s * 30, sy + 30]]), c.sash, c.sashS, { dx: s * 8, rim: 'rgba(255,255,255,0.35)' });
    else cel(ctx, delt, c.skin, c.skinS, { dx: s * 10, rim: 'rgba(255,255,255,0.12)', line: false });
    // forearm (path built above), wrist wrap only
    cel(ctx, fore, c.skin, c.skinS, { dx: s * 7, rim: 'rgba(255,255,255,0.12)', line: false });
    ctx.save(); ctx.clip(fore);
    const wx = lerp(ex, hx, 0.62), wy = lerp(ey, hy, 0.62);
    ctx.translate(wx, wy); ctx.rotate(a2 * D); cel(ctx, poly([[0, -60], [120, -60], [120, 60], [0, 60]]), c.wrap, c.wrapS, { dy: 10 });
    ctx.strokeStyle = c.wrapS; ctx.lineWidth = 3.5; for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(k * 18, -50); ctx.lineTo(k * 18 + 16, 50); ctx.stroke(); }
    ctx.restore();
    if (!fem) { ctx.strokeStyle = c.skinS; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(lerp(sx, ex, 0.35), lerp(sy, ey, 0.35) + 6); ctx.quadraticCurveTo(lerp(sx, ex, 0.6) + s * 12, lerp(sy, ey, 0.6), lerp(sx, ex, 0.85), lerp(sy, ey, 0.85)); ctx.stroke(); }
    // hand
    const hx2 = hx + Math.cos(a2 * D) * 26, hy2 = hy + Math.sin(a2 * D) * 26;
    ctx.save(); ctx.translate(hx2, hy2); ctx.rotate(a2 * D - Math.PI / 2); ctx.scale(A, A);
    if (P.fist) {
      cel(ctx, smoothShape([[-34, -22], [34, -22], [40, 8], [30, 36], [-28, 36], [-40, 8]]), c.skin, c.skinS, { dx: 6 });
      ctx.strokeStyle = c.skinS; ctx.lineWidth = 4; for (const kx of [-14, 2, 18]) { ctx.beginPath(); ctx.moveTo(kx, 14); ctx.lineTo(kx, 32); ctx.stroke(); }
      cel(ctx, ell(s * -30, 4, 12, 18), c.skin, c.skinS, { line: true });
    } else {
      cel(ctx, smoothShape([[-32, -20], [32, -20], [38, 22], [26, 60], [-26, 60], [-38, 22]]), c.skin, c.skinS, { dx: 6 });
      ctx.strokeStyle = c.skinS; ctx.lineWidth = 4; for (const kx of [-13, 2, 17]) { ctx.beginPath(); ctx.moveTo(kx, 24); ctx.lineTo(kx, 56); ctx.stroke(); }
    }
    ctx.restore();
    hands[s > 0 ? 'R' : 'L'] = [hx2 + Math.cos(a2 * D) * 40, hy2 + Math.sin(a2 * D) * 40];
  };
  arm(-1, P.L); arm(1, P.R);

  // ---------------- head
  const look = o.lookX ?? P.look ?? 0;
  ctx.save(); ctx.translate(look * 10, -846 + br); ctx.rotate((o.headTilt || 0) + (P.shout ? -0.06 : 0));
  cel(ctx, capsule(0, 10, 0, -40, 40, 38), c.skin, c.skinS, { dx: 8 });                                // neck
  ctx.strokeStyle = c.skinS; ctx.lineWidth = 4; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 16, -30); ctx.lineTo(s * 30, 4); ctx.stroke(); }
  const HY = -120;                                                                                       // head centre
  // back hair mass
  const spikes = c.spikes.map(([a, l]) => { const af = lerp(a, -90, 0.22 * f); return [af + look * 8, l * (1 + 0.3 * f + 0.06 * pw * Math.sin(t * 9 + a))]; });
  const hairPath = (scale, lift) => {
    const pth = new Path2D(); const r0 = 74 * scale, cy0 = HY - 30 - lift;
    const P0 = (a, r) => [Math.cos(a * D) * r, cy0 + Math.sin(a * D) * r];
    const first = spikes[0][0] - 20; let [x0, y0] = P0(first, r0); pth.moveTo(x0, y0 + 40);
    pth.lineTo(x0, y0);
    spikes.forEach(([a, l], i) => {
      const prev = i ? (spikes[i - 1][0] + a) / 2 : a - 20, next = i < spikes.length - 1 ? (spikes[i + 1][0] + a) / 2 : a + 20;
      const [bx, by] = P0(prev, r0), [nx, ny] = P0(next, r0);
      const ll = l * scale, [tx, ty] = P0(a, r0 + ll);
      const sw = 0.18 * ll; // tips sweep back/up
      const tipx = tx + sw * 0.6, tipy = ty - sw * 0.25;
      const [c1x, c1y] = P0((prev + a) / 2, r0 + ll * 0.55), [c2x, c2y] = P0((a + next) / 2, r0 + ll * 0.5);
      pth.lineTo(bx, by);
      pth.quadraticCurveTo(c1x + sw * 0.2, c1y, tipx, tipy);
      pth.quadraticCurveTo(c2x, c2y + sw * 0.1, nx, ny);
    });
    const [ex0, ey0] = P0(spikes[spikes.length - 1][0] + 20, r0); pth.lineTo(ex0, ey0 + 40); pth.closePath();
    return pth;
  };
  const back = hairPath(1.0, 0), backS = hairPath(0.82, -6);
  if (f > 0.05) { ctx.save(); ctx.shadowColor = c.fAura[0]; ctx.shadowBlur = 70 * f; ctx.fillStyle = hexA(c.fAura[0], 0.7 * f); ctx.fill(back); ctx.restore(); }
  cel(ctx, back, hair, hairS, { dx: 18, rim: f > 0.3 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.10)' });
  // inner volume: a second, smaller spike layer in shade + highlight streaks
  ctx.save(); ctx.clip(back); ctx.globalAlpha = 0.55; ctx.fillStyle = hairS; ctx.translate(-14, 10); ctx.fill(backS); ctx.restore();
  ctx.save(); ctx.clip(back); ctx.strokeStyle = f > 0.3 ? 'rgba(255,255,255,0.9)' : 'rgba(150,170,230,0.35)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  spikes.forEach(([a, l], i) => { if (i % 2) return; const r1 = 100, r2 = 74 + l * 0.7; ctx.beginPath(); ctx.moveTo(Math.cos((a + 6) * D) * r1, HY - 30 + Math.sin((a + 6) * D) * r1); ctx.lineTo(Math.cos((a + 3) * D) * r2, HY - 30 + Math.sin((a + 3) * D) * r2); ctx.stroke(); });
  ctx.restore();
  ctx.strokeStyle = OUT; ctx.lineWidth = LW2; ctx.stroke(back);
  // crimson streak
  if (f < 0.6) { const [a, l] = spikes[3]; ctx.save(); ctx.clip(back); ctx.strokeStyle = c.streak; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(Math.cos(a * D) * 70, HY - 30 + Math.sin(a * D) * 70); ctx.lineTo(Math.cos(a * D) * (60 + l), HY - 30 + Math.sin(a * D) * (60 + l)); ctx.stroke(); ctx.restore(); }
  // ears
  for (const s of [-1, 1]) cel(ctx, smoothShape([[s * 64, HY - 10], [s * 82, HY - 22], [s * 88, HY + 10], [s * 72, HY + 34]]), c.skin, c.skinS, { dx: s * 4 });
  // face: angular anime male (softer for female)
  const face = smoothShape(fem
    ? [[-68, HY - 70], [68, HY - 70], [74, HY - 10], [62, HY + 46], [30, HY + 86], [0, HY + 96], [-30, HY + 86], [-62, HY + 46], [-74, HY - 10]]
    : [[-70, HY - 72], [70, HY - 72], [76, HY - 12], [70, HY + 36], [50, HY + 76], [14, HY + 104], [-14, HY + 104], [-50, HY + 76], [-70, HY + 36], [-76, HY - 12]]);
  cel(ctx, face, c.skin, c.skinS, { dx: 14, rim: 'rgba(255,255,255,0.14)' });
  // cheek / jaw shadow
  ctx.strokeStyle = c.skinS; ctx.lineWidth = 4; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 58, HY + 24); ctx.lineTo(s * 44, HY + 52); ctx.stroke(); }
  // eyes
  const mood = o.mood || (P.shout ? 'shout' : 'calm');
  const eyeC = f > 0.5 ? c.fEye : c.eye;
  const blink = mood !== 'shout' && ((t + (o.phase || 0)) % 4.1) < 0.1;
  for (const s of [-1, 1]) {
    const ex = s * 32 + look * 8, ey = HY + 2;
    const narrow = mood === 'shout' ? 0.55 : mood === 'angry' ? 0.8 : mood === 'shock' ? 1.15 : 1;
    if (blink) { ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(ex - s * 18, ey + 2); ctx.lineTo(ex + s * 22, ey - 2); ctx.stroke(); continue; }
    // eye white (sharp almond)
    const eyeP = poly([[ex - s * 20, ey + 6 * narrow], [ex - s * 8, ey - 12 * narrow], [ex + s * 14, ey - 14 * narrow], [ex + s * 26, ey - 6 * narrow], [ex + s * 18, ey + 9 * narrow], [ex - s * 6, ey + 12 * narrow]]);
    ctx.fillStyle = '#fbf8f2'; ctx.fill(eyeP);
    ctx.save(); ctx.clip(eyeP);
    const ix = ex + s * 3 + look * 5, irs = mood === 'shout' || mood === 'shock' ? 0.62 : 1;
    if (f > 0.5) { ctx.shadowColor = eyeC; ctx.shadowBlur = 16; }
    ctx.fillStyle = eyeC; ctx.beginPath(); ctx.ellipse(ix, ey, 10 * irs, 13 * irs, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#16121a'; ctx.beginPath(); ctx.ellipse(ix, ey, 4.5 * irs, 7 * irs, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ix + 4, ey - 5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(ex - 40, ey - 20, 80, 8);
    ctx.restore();
    // upper lid (thick) + lower lash
    ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(ex - s * 22, ey + 6 * narrow); ctx.lineTo(ex - s * 8, ey - 12 * narrow); ctx.lineTo(ex + s * 14, ey - 15 * narrow); ctx.lineTo(ex + s * 30, ey - 8 * narrow); ctx.stroke();
    ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(ex - s * 4, ey + 12 * narrow); ctx.lineTo(ex + s * 18, ey + 9 * narrow); ctx.stroke();
    if (fem) { ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ex + s * 28, ey - 8); ctx.lineTo(ex + s * 38, ey - 16); ctx.stroke(); }
    // brow: thick, angled down to the centre
    const bt = mood === 'calm' ? 8 : mood === 'smirk' ? (s > 0 ? 2 : 10) : mood === 'shock' ? -6 : 18;
    ctx.fillStyle = hairS; ctx.beginPath();
    ctx.moveTo(ex - s * 26, ey - 24 + bt * 0.5); ctx.lineTo(ex + s * 30, ey - 34 - bt * 0.4); ctx.lineTo(ex + s * 28, ey - 24 - bt * 0.4); ctx.lineTo(ex - s * 22, ey - 14 + bt * 0.5); ctx.closePath(); ctx.fill();
  }
  if (mood === 'shout' || mood === 'angry') { ctx.strokeStyle = c.skinS; ctx.lineWidth = 4; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 8, HY - 30); ctx.lineTo(s * 14, HY - 46); ctx.stroke(); } }
  // nose
  ctx.strokeStyle = c.skinS; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(look * 8 + 4, HY + 14); ctx.lineTo(look * 8 + 8, HY + 40); ctx.lineTo(look * 8 - 4, HY + 44); ctx.stroke();
  // mouth
  const my = HY + 70, mx = look * 8, talk = clamp(o.talk || 0);
  ctx.strokeStyle = OUT; ctx.lineWidth = 5;
  if (mood === 'shout') {
    const m = poly([[mx - 30, my - 12], [mx + 30, my - 12], [mx + 22, my + 22], [mx - 22, my + 22]]);
    ctx.fillStyle = '#4a1418'; ctx.fill(m); ctx.save(); ctx.clip(m); ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - 32, my - 14, 64, 9); ctx.fillRect(mx - 32, my + 16, 64, 7); ctx.fillStyle = '#c4434f'; ctx.beginPath(); ctx.ellipse(mx, my + 18, 16, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.stroke(m);
  } else if (talk > 0.08 || mood === 'shock') {
    const oh = mood === 'shock' ? 12 : 3 + talk * 11;
    ctx.fillStyle = '#4a1418'; ctx.beginPath(); ctx.ellipse(mx, my, 12, oh, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (mood === 'smirk') { ctx.beginPath(); ctx.moveTo(mx - 16, my + 2); ctx.quadraticCurveTo(mx + 4, my + 6, mx + 20, my - 8); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(mx - 15, my); ctx.lineTo(mx + 13, my - (mood === 'angry' ? -3 : 1)); ctx.stroke(); }
  // front bangs over the forehead
  const bang = (x0, x1, tipX, tipY) => cel(ctx, poly([[x0, HY - 92], [x1, HY - 92], [tipX, tipY]]), hair, hairS, { dx: 6 });
  bang(-92, -10, -66 + look * 6, HY - 4); bang(-40, 40, -2 + look * 8, HY - 22); bang(18, 92, 66 + look * 6, HY - 8);
  if (fem) for (const s of [-1, 1]) cel(ctx, poly([[s * 70, HY - 80], [s * 92, HY - 60], [s * 84, HY + 120], [s * 66, HY + 60]]), hair, hairS, { dx: s * 6 });
  cel(ctx, poly([[-92, HY - 70], [92, HY - 70], [96, HY - 104], [-96, HY - 104]]), hair, hairS, { dx: 8 });   // hairline band
  ctx.restore();

  // aura veil in front (thin)
  aura(ctx, t, { color: auraC[0], core: auraC[1], power: pw * 0.8, h: 1040, w: 270, front: true });
  ctx.restore();
  return hands;
}

// ------------------------------------------------------------------ energy beam
/** Charge an orb at [x,y] then fire a beam toward `angle` (deg). k: 0..1 charge, f: 0..1 fire (0 = not fired). */
export function beam(ctx, t, { x = 0, y = 0, angle = 0, charge = 1, fire = 0, color = '#4fb4ff', core = '#ffffff', width = 150, length = 1800 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle * D); ctx.globalCompositeOperation = 'lighter';
  if (fire <= 0) {
    // converging particles
    for (let i = 0; i < 30; i++) {
      const u = (t * 1.6 + hash(i)) % 1; const a = hash(i * 7) * Math.PI * 2, r = (1 - u) * 260;
      ctx.fillStyle = hexA(i % 2 ? color : core, u * charge); ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 4 + u * 5, 0, Math.PI * 2); ctx.fill();
    }
    const r = 20 + 70 * charge + Math.sin(t * 40) * 6;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4); g.addColorStop(0, hexA(core, 1)); g.addColorStop(0.35, hexA(color, 0.9)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.fill();
  } else {
    const L = length * easeOut(clamp(fire * 3)), w = width * (1 + 0.08 * Math.sin(t * 50));
    const body = (ww, col, a) => {
      const p = new Path2D(); const n = 24;
      p.moveTo(0, -ww * 0.5);
      for (let i = 1; i <= n; i++) { const xx = (i / n) * L; p.lineTo(xx, -ww * 0.5 - Math.sin(xx * 0.03 - t * 40) * ww * 0.08); }
      for (let i = n; i >= 0; i--) { const xx = (i / n) * L; p.lineTo(xx, ww * 0.5 + Math.sin(xx * 0.03 + t * 37) * ww * 0.08); }
      p.closePath(); ctx.fillStyle = hexA(col, a); ctx.fill(p);
    };
    ctx.shadowColor = color; ctx.shadowBlur = 60;
    body(w * 1.6, color, 0.35); body(w, color, 0.85); body(w * 0.45, core, 1); ctx.shadowBlur = 0;
    // muzzle ball
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.4); g.addColorStop(0, hexA(core, 1)); g.addColorStop(0.4, hexA(color, 0.9)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w * 1.4, 0, Math.PI * 2); ctx.fill();
    // streak lines along the beam
    ctx.strokeStyle = hexA(core, 0.8); ctx.lineWidth = 4;
    for (let i = 0; i < 10; i++) { const yy = (hash(i) - 0.5) * w * 0.9, x0 = ((t * 2400 + hash(i * 3) * L) % L); ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(Math.min(L, x0 + 200), yy); ctx.stroke(); }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ backgrounds & fx
const SKIES = {
  dusk: ['#1b1238', '#5b2a5e', '#d8644a', '#f7b267'],
  storm: ['#0d0f1c', '#262a44', '#4f4566', '#8a6a7a'],
  day: ['#3a7fd0', '#6fb0ec', '#bfe3ff', '#f4f0d8'],
  void: ['#05040c', '#170c2a', '#3a1446', '#7a2048'],
};
/** Rocky wasteland arena with mesas, cel-shaded, original. */
export function fightBg(ctx, t, { sky = 'dusk', horizon = 1180, seed = 3, crack = 0 } = {}) {
  const S = SKIES[sky] || SKIES.dusk;
  const g = ctx.createLinearGradient(0, 0, 0, horizon); S.forEach((c, i) => g.addColorStop(i / (S.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, horizon + 2);
  // sun / glow
  const sg = ctx.createRadialGradient(760, horizon - 170, 10, 760, horizon - 170, 520); sg.addColorStop(0, 'rgba(255,230,180,0.85)'); sg.addColorStop(0.15, 'rgba(255,190,120,0.4)'); sg.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, 1080, horizon);
  // clouds (anime streaks)
  const R = rand(seed);
  for (let i = 0; i < 7; i++) {
    const y = 260 + R() * (horizon - 600), x = ((R() * 1400 + t * (8 + i * 3)) % 1500) - 300, w = 260 + R() * 360;
    ctx.fillStyle = `rgba(255,${190 + R() * 50 | 0},${170 + R() * 50 | 0},${0.18 + R() * 0.16})`;
    ctx.beginPath(); ctx.ellipse(x, y, w, 18 + R() * 14, 0, 0, Math.PI * 2); ctx.fill();
  }
  // far mesas (atmospheric), near mesas (cel shaded)
  const mesa = (x, w, h, col, colS, line) => {
    const top = horizon - h; const pp = poly([[x - w * 0.5, horizon + 4], [x - w * 0.42, top + h * 0.25], [x - w * 0.34, top + 6], [x + w * 0.3, top], [x + w * 0.38, top + h * 0.2], [x + w * 0.5, horizon + 4]]);
    if (line) cel(ctx, pp, col, colS, { dx: -w * 0.18 }); else { ctx.fillStyle = col; ctx.fill(pp); }
    if (line) { ctx.strokeStyle = colS; ctx.lineWidth = 4; for (let k = 1; k < 4; k++) { const yy = top + (h * k) / 4; ctx.beginPath(); ctx.moveTo(x - w * 0.4, yy); ctx.lineTo(x + w * 0.42, yy + 6); ctx.stroke(); } }
  };
  mesa(120, 260, 380, 'rgba(120,70,110,0.55)', null, false); mesa(470, 200, 300, 'rgba(120,70,110,0.5)', null, false); mesa(980, 300, 440, 'rgba(110,60,100,0.55)', null, false);
  mesa(-20, 320, 520, '#7a4a52', '#5a3240', true); mesa(1050, 280, 600, '#7a4a52', '#5a3240', true);
  // ground
  const gg = ctx.createLinearGradient(0, horizon, 0, 1920); gg.addColorStop(0, '#b97f57'); gg.addColorStop(0.4, '#8e5c40'); gg.addColorStop(1, '#5a3a2a');
  ctx.fillStyle = gg; ctx.fillRect(0, horizon, 1080, 1920 - horizon);
  ctx.strokeStyle = 'rgba(60,34,24,0.5)'; ctx.lineWidth = 4;
  for (let i = 0; i < 18; i++) { const z = R(); const y = horizon + 20 + z * z * (1920 - horizon); const x = R() * 1080, s = 0.4 + z * 1.8; ctx.beginPath(); ctx.moveTo(x - 60 * s, y); ctx.lineTo(x + 70 * s, y + 4 * s); ctx.stroke(); }
  for (let i = 0; i < 12; i++) { const z = R(); const y = horizon + 30 + z * (1920 - horizon) * 0.8; const x = R() * 1080, s = 0.3 + z * 1.4; cel(ctx, smoothShape([[x - 40 * s, y], [x - 30 * s, y - 34 * s], [x + 10 * s, y - 44 * s], [x + 44 * s, y - 18 * s], [x + 40 * s, y]]), '#9a6a4e', '#6e4632', { dx: 10 * s }); }
  // radial ground cracks from the centre (power)
  if (crack > 0) {
    ctx.strokeStyle = `rgba(30,14,10,${0.8 * crack})`; ctx.lineWidth = 7; const Rc = rand(seed + 9);
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.05 + 0.9 * (i / 8)); let x = 540, y = 1500; ctx.beginPath(); ctx.moveTo(x, y); for (let s = 0; s < 5; s++) { x += Math.cos(a) * 70 * crack * (0.6 + Rc()) * (i % 2 ? 1 : -1) * 0.3 + Math.cos(a) * 60 * crack; y += Math.sin(a) * 26 * crack; ctx.lineTo(x + (Rc() - 0.5) * 30, y); } ctx.stroke(); }
  }
}
/** Rocks lifting off the ground around a powering-up fighter. */
export function fxRocks(ctx, t, { n = 9, k = 1, spread = 420, seed = 4, y0 = 0 } = {}) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = (R() - 0.5) * spread * 2, sz = 18 + R() * 40, sp = 0.5 + R();
    const rise = k * (120 + R() * 500) + Math.sin(t * 2 * sp + i) * 14 * k;
    ctx.save(); ctx.translate(x, y0 - rise); ctx.rotate(t * sp * (i % 2 ? 1 : -1) * k);
    cel(ctx, smoothShape([[-sz, 0], [-sz * 0.6, -sz * 0.8], [sz * 0.3, -sz], [sz, -sz * 0.3], [sz * 0.7, sz * 0.6], [-sz * 0.4, sz * 0.7]]), '#9a6a4e', '#6e4632', { dx: sz * 0.3 });
    ctx.restore();
  }
}
/** Anime focus / speed lines around the edge of the frame. */
export function fxFocus(ctx, t, { color = '#ffffff', alpha = 0.7, inner = 420, n = 80, cx = 540, cy = 900 } = {}) {
  const R = rand(Math.floor(t * 16)); ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, r0 = inner + R() * 260, w = 0.004 + R() * 0.01;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a - w) * 2200, cy + Math.sin(a - w) * 2200); ctx.lineTo(cx + Math.cos(a + w) * 2200, cy + Math.sin(a + w) * 2200); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
/** Power-level HUD: slanted panel, counting digits, glow, "LIMIT BROKEN" stamp past `limit`. */
export function fxPower(ctx, t, { value = 0, label = 'POWER LEVEL', color = '#4fb4ff', limit = null, broke = 0, name = '', unit = '', sub = '', str = null } = {}) {
  ctx.save();
  const H2 = sub ? 70 + 64 : 70;
  ctx.fillStyle = 'rgba(8,8,18,0.84)'; ctx.beginPath(); ctx.moveTo(-20, -90); ctx.lineTo(760, -90); ctx.lineTo(800, H2); ctx.lineTo(20, H2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = color; ctx.fillRect(-20, -90, 14, 90 + H2);
  text(ctx, (name ? name + ' · ' : '') + label, 22, -56, 30, color, { font: 'Oswald', weight: 600, align: 'left' });
  const jitter = broke > 0 ? Math.sin(t * 70) * 4 : 0;
  const s0 = str ?? (Math.round(value).toLocaleString('en-US') + (unit ? ' ' + unit : ''));
  ctx.font = '400 104px Anton'; const tw = ctx.measureText(s0).width; const fs = Math.min(104, 104 * 730 / Math.max(1, tw));
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 26;
  text(ctx, s0, 22 + jitter, 14, fs, '#ffffff', { font: 'Anton', weight: 400, align: 'left' });
  ctx.restore();
  if (sub) { ctx.fillStyle = color; ctx.fillRect(22, 74, 6, 46); text(ctx, sub.toUpperCase(), 44, 98, 40, '#ffd84a', { font: 'Oswald', weight: 700, align: 'left' }); }
  if (broke > 0) {
    ctx.save(); ctx.translate(600, -100); ctx.rotate(-0.12); const s = 1 + 0.4 * (1 - easeOut(broke)); ctx.scale(s, s); ctx.globalAlpha = clamp(broke * 3);
    ctx.fillStyle = '#ff2d4a'; ctx.beginPath(); ctx.roundRect(-150, -34, 300, 68, 8); ctx.fill();
    text(ctx, 'LIMIT BROKEN', 0, 3, 42, '#ffffff', { font: 'Anton', weight: 400 });
    ctx.restore();
  }
  ctx.restore();
}
/** A huge glowing sun with a flickering corona (energy scale finale). */
export function fxSun(ctx, t, { r = 360 } = {}) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.6); g.addColorStop(0, 'rgba(255,240,200,0.9)'); g.addColorStop(0.35, 'rgba(255,170,60,0.55)'); g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2); ctx.fill();
  // corona flames
  const pts = []; const N = 48;
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, f = 0.5 + 0.5 * Math.sin(t * 5 + i * 2.3) * Math.sin(t * 2.1 + i); pts.push([Math.cos(a) * r * (i % 2 ? 1.02 : 1.08 + 0.12 * f), Math.sin(a) * r * (i % 2 ? 1.02 : 1.08 + 0.12 * f)]); }
  ctx.fillStyle = 'rgba(255,150,40,0.6)'; ctx.fill(smoothShape(pts));
  ctx.restore();
  const g2 = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r); g2.addColorStop(0, '#fffbe6'); g2.addColorStop(0.5, '#ffd25a'); g2.addColorStop(1, '#ff8a1f');
  ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  // granulation / sunspots
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip(); const R = rand(5);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,${120 + R() * 60 | 0},20,${0.12 + R() * 0.12})`; ctx.beginPath(); ctx.ellipse((R() - 0.5) * 2 * r, (R() - 0.5) * 2 * r, 30 + R() * 60, 14 + R() * 30, R() * 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ------------------------------------------------------------------ compose layers
const keyT = (p, w, d = 0) => (w == null ? d : typeof w === 'number' ? w : p.key(w) ?? d);
export const FIGHT_LAYERS = {
  'fight-bg'(ctx, L, p) {
    const crack = L.crackAt != null ? easeOut(clamp((p.lt - keyT(p, L.crackAt)) / 0.6)) : L.crack || 0;
    fightBg(ctx, p.t, { sky: L.sky, horizon: L.horizon ?? 1180, seed: L.seed ?? 3, crack });
  },
  /** { who, pose, mood, s, power | powerAt (ramp), form | transformAt, beam: { chargeAt, fireAt, angle, color } } */
  'fighter'(ctx, L, p) {
    if (L.s) ctx.scale(L.s, L.s);
    const ramp = (w, d = 0.8) => (w == null ? null : easeOut(clamp((p.lt - keyT(p, w)) / d)));
    const power = ramp(L.powerAt, 0.9) ?? L.power ?? 0;
    const form = ramp(L.transformAt, 0.5) ?? L.form ?? 0;
    let talk = 0;
    if (L.talk) { const s1 = 0.15 + p.beat.voiceDur; if (p.lt > 0.15 && p.lt < s1) talk = 0.35 + 0.65 * Math.abs(Math.sin(p.lt * 11.3) * Math.sin(p.lt * 4.1 + 1)); }
    const pose = L.poseAt && p.lt >= keyT(p, L.poseAt[0]) ? L.poseAt[1] : L.pose;
    const who = L.who || 'kairo';
    const hands = fighter(ctx, p.t, { who, pose, mood: L.mood, power: Math.max(power, form), form, talk, lookX: L.lookX, phase: (L.x || 0) * 0.01 });
    if (L.beam) {
      const B = L.beam, c = FIGHTERS[who] || FIGHTERS.kairo; const col = (form > 0.5 ? c.fAura : c.aura);
      const tc = keyT(p, B.chargeAt), tf = B.fireAt != null ? keyT(p, B.fireAt) : 1e9;
      if (p.lt >= tc) {
        const [hx, hy] = [(hands.R[0] + hands.L[0]) / 2, (hands.R[1] + hands.L[1]) / 2];
        beam(ctx, p.t, { x: hx, y: hy, angle: B.angle ?? 0, charge: easeOut(clamp((p.lt - tc) / 0.8)), fire: p.lt >= tf ? (p.lt - tf) : 0, color: B.color || col[0], core: '#ffffff', width: B.width ?? 170, length: B.length ?? 2000 });
      }
    }
  },
  'fx-rocks'(ctx, L, p) { const k = L.at != null ? easeOut(clamp((p.lt - keyT(p, L.at)) / 1.4)) : 1; fxRocks(ctx, p.t, { n: L.n ?? 9, k, spread: L.spread ?? 420, seed: L.seed ?? 4 }); },
  'fx-focus'(ctx, L, p) { fxFocus(ctx, p.t, { color: L.color || '#ffffff', alpha: L.alpha ?? 0.7, inner: L.inner ?? 420, cx: L.cx ?? 540, cy: L.cy ?? 900 }); },
  'fx-flash'(ctx, L, p) { const k = clamp((p.lt - keyT(p, L.at)) / (L.dur ?? 0.45)); if (k >= 1) return; ctx.fillStyle = L.color || '#ffffff'; ctx.globalAlpha = Math.pow(1 - k, 1.6); ctx.fillRect(0, 0, 1080, 1920); },
  'fx-impact'() { /* handled in drawLayers: whole-frame shake */ },
  'fx-power'(ctx, L, p) {
    const t0 = keyT(p, L.countAt ?? L.at), k = ease3(clamp((p.lt - t0) / (L.dur ?? 1.6)));
    const f0 = L.from ?? 0, f1 = L.to ?? 9000;
    // log counting for huge jumps (exponential feel), linear otherwise
    const v = L.log && f0 > 0 ? f0 * Math.pow(f1 / f0, k) : lerp(f0, f1, k) + (k < 1 ? hash(Math.floor(p.t * 30)) * f1 * 0.01 : 0);
    const broke = L.limit != null && v >= L.limit ? clamp((p.lt - t0 - (L.dur ?? 1.6) * (L.log ? Math.log(L.limit / f0) / Math.log(f1 / f0) : invE((L.limit - f0) / (f1 - f0)))) / 0.4) : 0;
    const subOn = L.sub && (L.subAt == null || p.lt >= keyT(p, L.subAt));
    fxPower(ctx, p.t, { value: v, label: L.label || 'POWER LEVEL', color: L.color || '#4fb4ff', limit: L.limit, broke, name: L.name || '', unit: L.unit || '', sub: subOn ? L.sub : '', str: L.text && k >= 1 ? L.text : null });
  },
  'fx-sun'(ctx, L, p) { if (L.s) ctx.scale(L.s, L.s); fxSun(ctx, p.t, { r: L.r ?? 360 }); },
};
const ease3 = (x) => 1 - Math.pow(1 - x, 3);
const invE = (y) => 1 - Math.cbrt(1 - clamp(y));
/** Sum of active impact shakes for the frame. */
export function frameShake(p, layers) {
  let sx = 0, sy = 0;
  for (const L of layers) {
    if (L.type !== 'fx-impact') continue;
    for (const w of [].concat(L.at)) {
      const d = p.lt - keyT(p, w); if (d < 0 || d > (L.dur ?? 0.5)) continue;
      const a = (L.power ?? 26) * (1 - d / (L.dur ?? 0.5)); sx += Math.sin(p.t * 83) * a; sy += Math.cos(p.t * 71) * a;
    }
  }
  return [sx, sy];
}
