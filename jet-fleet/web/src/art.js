// Flat 2D art: night sky, moon, clouds, city far below, private jets.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const backOut = (t, s = 2) => { t = clamp(t); return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
export function rand(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ------------------------------------------------------------------ sky (screen space)
export function skyGradient(ctx, night = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, 1920);
  g.addColorStop(0, night ? '#0e1230' : '#3a6fd8');
  g.addColorStop(0.55, night ? '#1a1f4a' : '#7fb2f0');
  g.addColorStop(1, night ? '#3a2a55' : '#f2c9a0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
}

export function starfield(ctx, t, camY) {
  const R = rand(11);
  for (let i = 0; i < 160; i++) {
    const x = R() * 1080, y0 = R() * 2600, s = 1.2 + R() * 2.4;
    const y = ((y0 - camY * 0.08) % 2600 + 2600) % 2600 - 300;
    const tw = 0.45 + 0.55 * Math.sin(t * (1 + R() * 2) + i);
    ctx.globalAlpha = 0.35 + 0.6 * tw * R();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function moon(ctx, x, y, r) {
  const halo = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 3);
  halo.addColorStop(0, 'rgba(255,248,220,0.22)'); halo.addColorStop(1, 'rgba(255,248,220,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e9e4cf'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cfc8ae';
  for (const [dx, dy, cr] of [[-0.35, -0.2, 0.22], [0.25, 0.3, 0.16], [0.2, -0.38, 0.1], [-0.1, 0.42, 0.09]]) {
    ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, cr * r, 0, Math.PI * 2); ctx.fill();
  }
}

/** Soft flat clouds drifting left (speed in px/s); y in screen space. */
export function clouds(ctx, t, y, { speed = 40, alpha = 0.18, seed = 3, scale = 1, color = '#c9cdf0' } = {}) {
  const R = rand(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < 6; i++) {
    const w = (220 + R() * 260) * scale, base = R() * 1600;
    const x = ((base - t * speed) % 1600 + 1600) % 1600 - 300;
    const yy = y + (R() - 0.5) * 220;
    ctx.globalAlpha = alpha;
    rr(ctx, x, yy, w, 56 * scale, 28 * scale); ctx.fill();
    rr(ctx, x + w * 0.2, yy - 30 * scale, w * 0.45, 60 * scale, 30 * scale); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Night city skyline, its base at screen y (scrolls slowly left). */
export function cityline(ctx, t, baseY, { seed = 5, speed = 14, dark = '#1b1838', glowY = true } = {}) {
  if (baseY > 2100) return;
  if (glowY) {
    const g = ctx.createLinearGradient(0, baseY - 500, 0, baseY);
    g.addColorStop(0, 'rgba(255,150,80,0)'); g.addColorStop(1, 'rgba(255,150,80,0.28)');
    ctx.fillStyle = g; ctx.fillRect(0, baseY - 500, 1080, 500);
  }
  const R = rand(seed);
  const off = (t * speed) % 1400;
  const bs = [];
  let x = -200;
  while (x < 1400 + 200) { const w = 70 + R() * 110, h = 90 + R() * 230; bs.push([x, w, h, R() * 1000]); x += w + 6; }
  for (const [bx, w, h, sd] of bs) {
    const X = ((bx - off) % 1600 + 1600) % 1600 - 260;
    ctx.fillStyle = dark; ctx.fillRect(X, baseY - h, w, h + 400);
    const r2 = rand(Math.floor(sd));
    for (let yy = baseY - h + 20; yy < baseY - 20; yy += 34) for (let xx = X + 12; xx < X + w - 16; xx += 26) {
      if (r2() < 0.35) { ctx.fillStyle = r2() < 0.8 ? '#f5c542' : '#ffe9a8'; ctx.fillRect(xx, yy, 10, 14); }
    }
  }
}

// ------------------------------------------------------------------ private jet (nose → +x)
export const JET_LEN = 520;

const tintCache = new Map();
function lum(hex) { const n = parseInt(hex.slice(1), 16); return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; }

/**
 * spec: { name, body, tail, stripe, flag (HTMLImageElement|null), vip, lights }
 * (x, y) = centre of the fuselage. s = scale (1 → 520 px long).
 */
export function jet(ctx, x, y, s, t, spec = {}) {
  const body = spec.body || '#f3f5fa', tail = spec.tail || '#2f6fe0', stripe = spec.stripe || tail;
  const vip = !!spec.vip;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.rotate(Math.sin(t * 1.3 + (spec.phase || 0)) * 0.012);
  const L = JET_LEN, H = 64;
  // far wing (behind)
  ctx.fillStyle = shade(body, -0.28);
  ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(70, -6); ctx.lineTo(10, -62); ctx.lineTo(-30, -62); ctx.closePath(); ctx.fill();
  // tail fin
  ctx.fillStyle = tail;
  ctx.beginPath(); ctx.moveTo(-L / 2 + 40, -H / 2 + 6); ctx.lineTo(-L / 2 + 120, -H / 2 + 6); ctx.lineTo(-L / 2 + 60, -H / 2 - 120); ctx.lineTo(-L / 2 + 6, -H / 2 - 120); ctx.closePath(); ctx.fill();
  if (spec.flag) { ctx.save(); ctx.beginPath(); ctx.moveTo(-L / 2 + 44, -H / 2 - 6); ctx.lineTo(-L / 2 + 96, -H / 2 - 6); ctx.lineTo(-L / 2 + 62, -H / 2 - 104); ctx.lineTo(-L / 2 + 16, -H / 2 - 104); ctx.closePath(); ctx.clip(); ctx.drawImage(spec.flag, -L / 2 + 4, -H / 2 - 108, 100, 104); ctx.restore(); }
  // horizontal stabiliser
  ctx.fillStyle = shade(tail, -0.15);
  ctx.beginPath(); ctx.moveTo(-L / 2 + 10, -H / 2 - 112); ctx.lineTo(-L / 2 + 70, -H / 2 - 112); ctx.lineTo(-L / 2 + 40, -H / 2 - 100); ctx.lineTo(-L / 2 - 4, -H / 2 - 100); ctx.closePath(); ctx.fill();
  // fuselage
  const g = ctx.createLinearGradient(0, -H / 2, 0, H / 2);
  g.addColorStop(0, shade(body, 0.08)); g.addColorStop(0.6, body); g.addColorStop(1, shade(body, -0.2));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-L / 2 + 20, -H / 2 + 8);
  ctx.lineTo(L / 2 - 110, -H / 2);
  ctx.bezierCurveTo(L / 2 - 30, -H / 2, L / 2, -6, L / 2, 6);
  ctx.bezierCurveTo(L / 2 - 10, H / 2, L / 2 - 60, H / 2, L / 2 - 120, H / 2);
  ctx.lineTo(-L / 2 + 50, H / 2 - 6);
  ctx.quadraticCurveTo(-L / 2 - 4, H / 2 - 20, -L / 2 - 6, -H / 2 + 22);
  ctx.closePath(); ctx.fill();
  // cheatline stripe
  ctx.fillStyle = stripe;
  ctx.beginPath(); ctx.moveTo(-L / 2 + 6, 10); ctx.lineTo(L / 2 - 30, 10); ctx.lineTo(L / 2 - 36, 18); ctx.lineTo(-L / 2 + 12, 18); ctx.closePath(); ctx.fill();
  if (vip) { ctx.fillStyle = '#7a5a12'; ctx.fillRect(-L / 2 + 10, 20, L - 50, 4); }
  // windows
  const lit = spec.lights ? '#fff1a8' : '#f5c542';
  for (let i = 0; i < 9; i++) {
    const wx = -L / 2 + 150 + i * 28;
    ctx.fillStyle = lit;
    rr(ctx, wx, -12, 14, 18, 7); ctx.fill();
  }
  // cockpit
  ctx.fillStyle = '#1b2340';
  ctx.beginPath(); ctx.moveTo(L / 2 - 92, -H / 2 + 8); ctx.lineTo(L / 2 - 46, -H / 2 + 8); ctx.quadraticCurveTo(L / 2 - 24, -H / 2 + 14, L / 2 - 20, -8); ctx.lineTo(L / 2 - 84, -8); ctx.closePath(); ctx.fill();
  // door outline
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 3; rr(ctx, L / 2 - 150, -18, 26, 40, 8); ctx.stroke();
  // engine pod
  ctx.fillStyle = shade(body, -0.12);
  rr(ctx, -L / 2 + 70, -H / 2 - 20, 120, 44, 22); ctx.fill();
  ctx.fillStyle = '#2a3150'; rr(ctx, -L / 2 + 64, -H / 2 - 16, 16, 36, 8); ctx.fill();
  ctx.fillStyle = shade(body, -0.3); ctx.fillRect(-L / 2 + 120, -H / 2 + 2, 30, 10);
  // near wing
  ctx.fillStyle = shade(body, -0.06);
  ctx.beginPath(); ctx.moveTo(-40, 14); ctx.lineTo(80, 14); ctx.lineTo(-10, 120); ctx.lineTo(-70, 120); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tail; ctx.beginPath(); ctx.moveTo(-70, 120); ctx.lineTo(-10, 120); ctx.lineTo(-16, 100); ctx.lineTo(-84, 96); ctx.closePath(); ctx.fill();
  // nav light (blinking)
  const on = (t + (spec.phase || 0)) % 1.2 < 0.12;
  const nav = ctx.createRadialGradient(-50, 120, 0, -50, 120, on ? 40 : 18);
  nav.addColorStop(0, on ? 'rgba(80,255,140,1)' : 'rgba(80,255,140,0.55)'); nav.addColorStop(1, 'rgba(80,255,140,0)');
  ctx.fillStyle = nav; ctx.beginPath(); ctx.arc(-50, 120, on ? 40 : 18, 0, Math.PI * 2); ctx.fill();
  // name on the fuselage
  if (spec.name) {
    ctx.font = '700 34px "Oswald"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let size = 34; while (ctx.measureText(spec.name).width > 230 && size > 18) { size -= 2; ctx.font = `700 ${size}px "Oswald"`; }
    ctx.fillStyle = lum(body) < 0.35 ? (vip ? '#ffe7a3' : '#ffffff') : '#1b2340';
    ctx.fillText(spec.name, -L / 2 + 170 + 120, 34);
  }
  ctx.restore();
}

/** Contrails: array of past centre points [{x,y,a}] in screen space. */
export function contrail(ctx, pts, s) {
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * p1.a})`; ctx.lineWidth = (10 + i * 0.6) * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }
}

export function sparkles(ctx, x, y, r, t, n = 16, color = '#ffd76a') {
  const R = rand(7);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = r * (0.4 + R() * 0.8), k = (t * (0.6 + R()) + R()) % 1;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.5 - k * 60;
    ctx.globalAlpha = 1 - k; ctx.fillStyle = color;
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8); ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function shade(hex, k) {
  if (!hex.startsWith('#')) return hex;
  const key = hex + k; if (tintCache.has(key)) return tintCache.get(key);
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(clamp(k >= 0 ? c + (255 - c) * k : c * (1 + k), 0, 255));
  const out = `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
  tintCache.set(key, out); return out;
}
