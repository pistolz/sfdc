// 2D flat-vector drawing primitives (Canvas 2D). Everything is drawn in a
// 1080×1920 coordinate space. All animation is a pure function of time.

export const C = {
  ink: '#151a2e',
  skyDay: ['#7cc8f2', '#cfeeff'],
  skyDusk: ['#3b3f78', '#f29e7a'],
  skyNight: ['#0b1028', '#1f2a55'],
  ai: '#22d3ee',
  aiGlow: 'rgba(34,211,238,0.55)',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#ffd23f',
  grass: '#6bbf59',
  grassDark: '#4f9a45',
  dirt: ['#8a5a36', '#74482a', '#5f3a22', '#4c2e1b'],
  wall: '#3a4058',
  room: '#262c42',
  roomLit: '#323a58',
  steel: '#8b95a8',
  hero: { skin: '#f3c39d', hair: '#3b2416', top: '#ffb020', pants: '#2b3a67' },
};

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ease = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const backOut = (t) => { t = clamp(t); const s = 2.2; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
export const lerp = (a, b, t) => a + (b - a) * t;

export function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function fillRR(ctx, x, y, w, h, r, fill, stroke, lw = 6) {
  rr(ctx, x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
export function circle(ctx, x, y, r, fill, stroke, lw = 6) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
export function text(ctx, s, x, y, size, color, { font = 'Nunito', weight = 900, align = 'center', base = 'middle', stroke = null, lw = 0 } = {}) {
  ctx.font = `${weight} ${size}px "${font}"`;
  ctx.textAlign = align; ctx.textBaseline = base;
  if (stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
export function glow(ctx, color, blur, fn) {
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); ctx.restore();
}

// ------------------------------------------------------------------ backdrop
export function sky(ctx, [top, bottom], h = 1920) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(-200, -200, 1480, h + 400);
}
export function sun(ctx, x, y, r, color = '#fff3b0') {
  glow(ctx, color, 60, () => circle(ctx, x, y, r, color));
}
export function stars(ctx, t, n = 70, alpha = 1) {
  const R = rand(9);
  for (let i = 0; i < n; i++) {
    const x = R() * 1080, y = R() * 900, s = 1.5 + R() * 2.5;
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
    ctx.globalAlpha = alpha * (0.3 + 0.7 * tw);
    circle(ctx, x, y, s, '#ffffff');
  }
  ctx.globalAlpha = 1;
}
export function mountains(ctx, y, color = '#9fb4cf', snow = '#eef4fb', seed = 3) {
  const R = rand(seed);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-50, y);
  const peaks = [];
  for (let x = -50; x <= 1150; x += 180 + R() * 80) {
    const h = 160 + R() * 200;
    ctx.lineTo(x + 90, y - h); ctx.lineTo(x + 180, y);
    peaks.push([x + 90, y - h]);
  }
  ctx.lineTo(1150, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = snow;
  for (const [px, py] of peaks) {
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 38, py + 60); ctx.lineTo(px - 12, py + 50); ctx.lineTo(px + 8, py + 66); ctx.lineTo(px + 38, py + 60); ctx.closePath(); ctx.fill();
  }
}
export function tree(ctx, x, y, s = 1, color = '#3f8f4a') {
  fillRR(ctx, x - 7 * s, y - 40 * s, 14 * s, 40 * s, 4, '#6b4429');
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    const w = (70 - i * 16) * s, ty = y - (40 + i * 34) * s;
    ctx.beginPath(); ctx.moveTo(x - w / 2, ty); ctx.lineTo(x, ty - 60 * s); ctx.lineTo(x + w / 2, ty); ctx.closePath(); ctx.fill();
  }
}

// ------------------------------------------------------------------ AI villain
/** The AI: a dark screen with two glowing eyes. mood: 'calm' | 'smile' | 'angry' */
export function aiEye(ctx, x, y, size, t, { mood = 'calm', look = 0, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  const w = size, h = size * 0.72;
  glow(ctx, C.aiGlow, size * 0.25, () => fillRR(ctx, -w / 2, -h / 2, w, h, size * 0.14, '#0d1424', C.ai, Math.max(3, size * 0.04)));
  const blink = (t % 3.7) < 0.12 ? 0.15 : 1;
  const ex = size * 0.2, ey = -size * 0.04, ew = size * 0.12, eh = size * 0.16 * blink;
  const lx = look * size * 0.05;
  glow(ctx, C.ai, size * 0.2, () => {
    ctx.fillStyle = C.ai;
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(sx * ex + lx, ey, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (mood === 'angry') {
      ctx.strokeStyle = C.ai; ctx.lineWidth = size * 0.04; ctx.lineCap = 'round';
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * (ex + ew), ey - eh - size * 0.06); ctx.lineTo(sx * (ex - ew * 0.6), ey - eh - size * 0.01); ctx.stroke(); }
    }
    if (mood === 'smile') {
      ctx.strokeStyle = C.ai; ctx.lineWidth = size * 0.035; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(lx, size * 0.08, size * 0.12, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    }
  });
  // scanline
  const sy = ((t * 0.6) % 1) * h - h / 2;
  ctx.fillStyle = 'rgba(34,211,238,0.12)';
  ctx.fillRect(-w / 2 + 6, sy, w - 12, size * 0.04);
  ctx.restore();
}

// ------------------------------------------------------------------ people
/**
 * Flat character standing with feet at (x, y). s = scale (1 ≈ 300px tall).
 * o: { skin, hair, top, pants, hat, coat, kid, mood:'neutral'|'worried'|'happy'|'shock', phone, wave, walk, facing }
 */
export function person(ctx, x, y, s, t, o = {}) {
  const p = { ...C.hero, mood: 'neutral', facing: 1, ...o };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * p.facing, s);
  const bob = Math.sin(t * (p.walk ? 9 : 2.2)) * (p.walk ? 4 : 2.5);
  const step = p.walk ? Math.sin(t * 9) * 14 : 0;
  // legs
  fillRR(ctx, -34 + step * 0.5, -120, 30, 120, 12, p.pants);
  fillRR(ctx, 4 - step * 0.5, -120, 30, 120, 12, p.pants);
  fillRR(ctx, -40 + step * 0.5, -14, 40, 18, 9, '#1a1d2b');
  fillRR(ctx, 2 - step * 0.5, -14, 40, 18, 9, '#1a1d2b');
  ctx.translate(0, bob);
  // body
  const top = p.coat ? '#f4f6fb' : p.top;
  fillRR(ctx, -58, -250, 116, 150, 40, top);
  if (p.coat) { ctx.fillStyle = '#d5dbe8'; ctx.fillRect(-4, -240, 8, 130); }
  else { fillRR(ctx, -20, -246, 40, 24, 12, 'rgba(0,0,0,0.12)'); }
  // arms
  ctx.lineCap = 'round'; ctx.strokeStyle = top; ctx.lineWidth = 30;
  const wave = p.wave ? Math.sin(t * 10) * 0.35 : 0;
  ctx.beginPath(); ctx.moveTo(-52, -225); ctx.lineTo(-74, -150); ctx.stroke();
  if (p.wave) { ctx.beginPath(); ctx.moveTo(52, -225); ctx.lineTo(90 + wave * 40, -300); ctx.stroke(); circle(ctx, 92 + wave * 40, -312, 17, p.skin); }
  else { ctx.beginPath(); ctx.moveTo(52, -225); ctx.lineTo(74, -150); ctx.stroke(); circle(ctx, 76, -142, 16, p.skin); }
  circle(ctx, -76, -142, 16, p.skin);
  if (p.phone) {
    glow(ctx, C.ai, 30, () => fillRR(ctx, 64, -190, 26, 44, 6, '#0d1424', C.ai, 4));
  }
  // head
  circle(ctx, 0, -305, 62, p.skin);
  if (p.hat) {
    ctx.fillStyle = p.hat; ctx.beginPath(); ctx.arc(0, -318, 64, Math.PI, 0); ctx.fill();
    fillRR(ctx, -68, -330, 136, 24, 10, p.hat);
    circle(ctx, 0, -388, 14, '#ffffff');
  } else {
    ctx.fillStyle = p.hair; ctx.beginPath(); ctx.arc(0, -318, 64, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-30, -350, 40, 22, -0.4, 0, Math.PI * 2); ctx.fill();
  }
  // face
  const blink = (t % 4.1) < 0.12;
  ctx.fillStyle = C.ink;
  for (const ex of [-22, 22]) {
    if (blink) ctx.fillRect(ex - 9, -305, 18, 4);
    else { ctx.beginPath(); ctx.ellipse(ex, -302, 7, p.mood === 'shock' ? 11 : 9, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath();
  if (p.mood === 'happy') ctx.arc(0, -282, 18, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (p.mood === 'worried') { ctx.arc(0, -262, 16, 1.2 * Math.PI, 1.8 * Math.PI); }
  else if (p.mood === 'shock') { ctx.stroke(); circle(ctx, 0, -272, 11, C.ink); ctx.beginPath(); }
  else { ctx.moveTo(-12, -274); ctx.lineTo(12, -274); }
  ctx.stroke();
  if (p.mood === 'worried' || p.mood === 'shock') {
    ctx.beginPath(); ctx.moveTo(-32, -330); ctx.lineTo(-12, -324); ctx.moveTo(32, -330); ctx.lineTo(12, -324); ctx.stroke();
  }
  ctx.restore();
}

export const FAMILY = [
  { dx: -120, s: 0.9, o: { top: '#4d7c5a', pants: '#3a3f55', hair: '#2a1a10', hat: '#b33a3a', skin: '#c98c64', mood: 'worried' } },
  { dx: 30, s: 0.85, o: { top: '#7a4fa0', pants: '#2b3a67', hair: '#5a3418', hat: '#e2e8f0', skin: '#f0c19a', mood: 'worried', wave: true } },
  { dx: 150, s: 0.5, o: { top: '#f2b705', pants: '#2b3a67', hair: '#5a3418', hat: '#3b82f6', skin: '#f0c19a', mood: 'worried', phone: true } },
];
export function family(ctx, x, y, s, t) {
  for (const m of FAMILY) person(ctx, x + m.dx * s, y, m.s * s, t + m.dx, m.o);
}

// ------------------------------------------------------------------ buildings
export function house(ctx, x, y, w, t, { lights = 1, smoke = true, sold = 0 } = {}) {
  const h = w * 0.55;
  // chimney + smoke
  fillRR(ctx, x + w * 0.22, y - h - w * 0.3, w * 0.1, w * 0.25, 4, '#7a3b2e');
  if (smoke) {
    for (let i = 0; i < 4; i++) {
      const k = ((t * 0.5 + i / 4) % 1);
      ctx.globalAlpha = 0.5 * (1 - k);
      circle(ctx, x + w * 0.27 + Math.sin(k * 6 + i) * 10, y - h - w * 0.32 - k * 120, 14 + k * 26, '#e8edf5');
    }
    ctx.globalAlpha = 1;
  }
  // walls (wood)
  fillRR(ctx, x - w / 2, y - h, w, h, 8, '#b5683b');
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 3;
  for (let yy = y - h + 18; yy < y; yy += 22) { ctx.beginPath(); ctx.moveTo(x - w / 2 + 6, yy); ctx.lineTo(x + w / 2 - 6, yy); ctx.stroke(); }
  // roof
  ctx.fillStyle = '#3f4a63';
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 30, y - h + 4); ctx.lineTo(x, y - h - w * 0.36); ctx.lineTo(x + w / 2 + 30, y - h + 4); ctx.closePath(); ctx.fill();
  // door & windows
  fillRR(ctx, x - w * 0.08, y - h * 0.55, w * 0.16, h * 0.55, 6, '#2f6b4f');
  circle(ctx, x + w * 0.05, y - h * 0.28, 4, '#f5d76e');
  const lit = lights > 0.5 ? '#ffe28a' : '#2b3350';
  for (const sx of [-1, 1]) {
    fillRR(ctx, x + sx * w * 0.3 - w * 0.09, y - h * 0.75, w * 0.18, h * 0.32, 6, lit, '#5a3520', 6);
    ctx.fillStyle = '#5a3520'; ctx.fillRect(x + sx * w * 0.3 - 2, y - h * 0.75, 4, h * 0.32);
  }
  if (sold > 0) {
    ctx.save(); ctx.translate(x + w * 0.62, y - 20);
    fillRR(ctx, -6, -120, 12, 120, 4, '#6b4429');
    ctx.rotate(-0.12 * backOut(sold));
    ctx.scale(backOut(sold), backOut(sold));
    fillRR(ctx, -80, -170, 160, 64, 12, C.green, '#ffffff', 6);
    text(ctx, 'SOLD', 0, -137, 44, '#ffffff', { font: 'Lilita One', weight: 400 });
    ctx.restore();
  }
}

export function city(ctx, baseY, t, { lights = 1, ai = 0, seed = 5, scale = 1, dark = false } = {}) {
  const R = rand(seed);
  let x = -40;
  const bs = [];
  while (x < 1120) {
    const w = (90 + R() * 90) * scale, h = (260 + R() * 520) * scale;
    bs.push({ x, w, h, c: R() < 0.5 ? (dark ? '#1c2340' : '#4a5578') : (dark ? '#232b4d' : '#5b6790'), seed: R() * 1000, screen: R() < 0.35 });
    x += w + 8 * scale;
  }
  for (const b of bs) {
    fillRR(ctx, b.x, baseY - b.h, b.w, b.h + 10, 6, b.c);
    const r2 = rand(Math.floor(b.seed));
    const cols = Math.max(2, Math.floor(b.w / (30 * scale)));
    for (let yy = baseY - b.h + 24 * scale; yy < baseY - 30 * scale; yy += 36 * scale) {
      for (let c = 0; c < cols; c++) {
        const wx = b.x + 12 * scale + c * ((b.w - 24 * scale) / cols);
        const on = r2() < 0.7;
        const flick = hash(b.seed + yy + c) ;
        const isOn = on && flick < lights;
        ctx.fillStyle = isOn ? (ai > hash(c + yy * 0.1 + b.seed) ? C.ai : '#ffd98a') : 'rgba(10,14,30,0.55)';
        ctx.fillRect(wx, yy, 16 * scale, 20 * scale);
      }
    }
    if (b.screen && ai > 0.05 && lights > 0.2) {
      const sw = b.w * 0.7, sh = sw * 0.6, sx = b.x + b.w / 2, sy = baseY - b.h * 0.6;
      aiEye(ctx, sx, sy, sw, t + b.seed, { mood: 'calm', alpha: clamp(ai * 1.5) });
    }
  }
}

// ------------------------------------------------------------------ icons
export function icon(ctx, name, x, y, s, t = 0, { infected = 0, crossed = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  fillRR(ctx, -80, -80, 160, 160, 40, '#ffffff', C.ink, 7);
  const col = infected > 0.5 ? C.ai : C.ink;
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (name) {
    case 'phone': fillRR(ctx, -30, -52, 60, 104, 12, null, col, 8); ctx.fillRect(-8, 34, 16, 6); break;
    case 'car':
      ctx.beginPath(); ctx.moveTo(-52, 16); ctx.lineTo(-52, -4); ctx.lineTo(-30, -30); ctx.lineTo(30, -30); ctx.lineTo(52, -4); ctx.lineTo(52, 16); ctx.closePath(); ctx.stroke();
      circle(ctx, -28, 20, 12, col); circle(ctx, 28, 20, 12, col); break;
    case 'camera':
      fillRR(ctx, -50, -24, 74, 40, 8, null, col, 8); ctx.beginPath(); ctx.moveTo(24, -10); ctx.lineTo(48, -24); ctx.lineTo(48, 14); ctx.lineTo(24, 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-14, 16); ctx.lineTo(-14, 46); ctx.stroke(); break;
    case 'bank':
      ctx.beginPath(); ctx.moveTo(-54, -18); ctx.lineTo(0, -50); ctx.lineTo(54, -18); ctx.closePath(); ctx.stroke();
      for (const cx of [-34, -11, 12, 35]) { ctx.beginPath(); ctx.moveTo(cx, -8); ctx.lineTo(cx, 34); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-56, 46); ctx.lineTo(56, 46); ctx.stroke(); break;
    case 'grid':
      ctx.beginPath(); ctx.moveTo(-30, 54); ctx.lineTo(0, -54); ctx.lineTo(30, 54); ctx.moveTo(-44, -22); ctx.lineTo(44, -22); ctx.moveTo(-36, 6); ctx.lineTo(36, 6); ctx.moveTo(-18, 6); ctx.lineTo(18, 40); ctx.moveTo(18, 6); ctx.lineTo(-18, 40); ctx.stroke(); break;
    case 'food':
      fillRR(ctx, -36, -40, 72, 86, 10, null, col, 8); ctx.beginPath(); ctx.moveTo(-36, -14); ctx.lineTo(36, -14); ctx.moveTo(-36, 20); ctx.lineTo(36, 20); ctx.stroke(); break;
    case 'water':
      ctx.beginPath(); ctx.moveTo(0, -54); ctx.bezierCurveTo(30, -10, 44, 10, 44, 22); ctx.arc(0, 22, 44, 0, Math.PI); ctx.bezierCurveTo(-44, 10, -30, -10, 0, -54); ctx.stroke(); break;
    case 'home':
      ctx.beginPath(); ctx.moveTo(-50, -4); ctx.lineTo(0, -48); ctx.lineTo(50, -4); ctx.moveTo(-36, -14); ctx.lineTo(-36, 46); ctx.lineTo(36, 46); ctx.lineTo(36, -14); ctx.stroke(); break;
    case 'power':
      ctx.beginPath(); ctx.moveTo(10, -56); ctx.lineTo(-28, 6); ctx.lineTo(4, 6); ctx.lineTo(-10, 56); ctx.lineTo(30, -10); ctx.lineTo(-2, -10); ctx.closePath(); ctx.fill(); break;
    case 'solar':
      ctx.save(); ctx.transform(1, 0, -0.3, 1, 0, 0);
      fillRR(ctx, -40, -40, 80, 60, 4, null, col, 7);
      ctx.beginPath(); ctx.moveTo(-40, -10); ctx.lineTo(40, -10); ctx.moveTo(-13, -40); ctx.lineTo(-13, 20); ctx.moveTo(13, -40); ctx.lineTo(13, 20); ctx.stroke(); ctx.restore();
      ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, 50); ctx.stroke(); break;
    case 'plant':
      ctx.beginPath(); ctx.moveTo(0, 50); ctx.lineTo(0, -10); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-22, -18, 24, 12, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(22, -34, 24, 12, 0.6, 0, Math.PI * 2); ctx.fill(); break;
    case 'question':
      text(ctx, '?', 0, 4, 120, C.yellow, { font: 'Lilita One', weight: 400, stroke: C.ink, lw: 10 }); break;
    case 'money':
      text(ctx, '$', 0, 4, 120, C.green, { font: 'Lilita One', weight: 400, stroke: C.ink, lw: 10 }); break;
    default: break;
  }
  if (infected > 0) {
    ctx.globalAlpha = clamp(infected);
    aiEye(ctx, 56, -56, 64, t, { mood: 'calm' });
    ctx.globalAlpha = 1;
  }
  if (crossed > 0) {
    const k = clamp(crossed);
    ctx.strokeStyle = C.red; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(-70, -70); ctx.lineTo(-70 + 140 * k, -70 + 140 * k); ctx.stroke();
    circle(ctx, 0, 0, 96, null, C.red, 14);
  }
  ctx.restore();
}

export function priceTag(ctx, x, y, label, price, k = 1) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.06); const s = backOut(k); ctx.scale(s, s);
  ctx.font = '900 38px "Nunito"';
  const w = Math.max(ctx.measureText(price).width + 70, 230);
  fillRR(ctx, -w / 2, -64, w, 128, 26, '#ffffff', C.ink, 7);
  text(ctx, label, 0, -28, 26, '#5b6478');
  text(ctx, price, 0, 18, 56, '#16a34a', { font: 'Lilita One', weight: 400 });
  ctx.restore();
}

// ------------------------------------------------------------------ globe
const CONTINENTS = [
  [[-0.62, -0.42], [-0.3, -0.55], [-0.12, -0.3], [-0.3, -0.05], [-0.42, 0.02], [-0.6, -0.15]],
  [[-0.32, 0.08], [-0.14, 0.12], [-0.12, 0.38], [-0.24, 0.66], [-0.34, 0.4]],
  [[0.02, -0.48], [0.3, -0.56], [0.62, -0.38], [0.58, -0.08], [0.32, -0.04], [0.12, -0.2]],
  [[0.04, -0.06], [0.28, 0.0], [0.32, 0.3], [0.16, 0.56], [0.04, 0.26]],
  [[0.52, 0.3], [0.7, 0.26], [0.72, 0.46], [0.54, 0.5]],
];
export function globe(ctx, cx, cy, r, t, infection = 0) {
  glow(ctx, 'rgba(120,200,255,0.6)', 60, () => circle(ctx, cx, cy, r, '#2a6fd6'));
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#4aa3ff'); g.addColorStop(1, '#1d4fa8');
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  for (const poly of CONTINENTS) {
    ctx.fillStyle = '#5cc16a';
    ctx.beginPath();
    poly.forEach(([px, py], i) => { const xx = cx + px * r, yy = cy + py * r; if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); });
    ctx.closePath(); ctx.fill();
  }
  // network of nodes
  const R = rand(21);
  const nodes = [];
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r * 0.92;
    nodes.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, R()]);
  }
  ctx.lineWidth = 3;
  for (let i = 0; i < nodes.length; i++) {
    const [x1, y1, k1] = nodes[i];
    const [x2, y2, k2] = nodes[(i * 7 + 3) % nodes.length];
    const on = Math.max(k1, k2) < infection;
    ctx.strokeStyle = on ? 'rgba(34,211,238,0.85)' : 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  for (const [x, y, k] of nodes) {
    const on = k < infection;
    if (on) glow(ctx, C.ai, 18, () => circle(ctx, x, y, 7, C.ai));
    else circle(ctx, x, y, 5, 'rgba(255,255,255,0.6)');
  }
  // terminator shading
  const sh = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,20,0.35)');
  ctx.fillStyle = sh; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.restore();
  circle(ctx, cx, cy, r, null, 'rgba(255,255,255,0.35)', 6);
}

// ------------------------------------------------------------------ TV / screens
export function tvFrame(ctx, x, y, w, h, fn) {
  fillRR(ctx, x - 14, y - 14, w + 28, h + 28, 28, '#1b2033');
  ctx.save(); rr(ctx, x, y, w, h, 16); ctx.clip();
  fn();
  ctx.restore();
  fillRR(ctx, x + w / 2 - 70, y + h + 14, 140, 60, 10, '#1b2033');
  fillRR(ctx, x + w / 2 - 160, y + h + 66, 320, 22, 10, '#1b2033');
}

export function noise(ctx, x, y, w, h, t, a = 0.08) {
  const R = rand(Math.floor(t * 30) + 1);
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  for (let i = 0; i < 260; i++) ctx.fillRect(x + R() * w, y + R() * h, 3, 3);
}

// ------------------------------------------------------------------ snow / particles
export function particles(ctx, t, { color = '#ffffff', n = 80, speed = 60, size = 4, seed = 2, alpha = 0.8 } = {}) {
  const R = rand(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x0 = R() * 1180 - 50, y0 = R() * 2000, sp = speed * (0.6 + R() * 0.8), sz = size * (0.5 + R());
    const y = (y0 + t * sp) % 2000 - 40;
    const x = x0 + Math.sin(t + i) * 20;
    ctx.globalAlpha = alpha * (0.4 + 0.6 * R());
    ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
