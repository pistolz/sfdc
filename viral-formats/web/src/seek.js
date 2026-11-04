// SEEK & FIND — "Only 1% can find Pumpkin Kitty" (original format study, 100% code).
// A dense storybook village around a giant pumpkin house: cottages, trees, river, paths, lanterns,
// hundreds of tiny objects and critters — including decoy cats — and ONE target: the orange kitten
// wearing a tiny pumpkin hat. Every seed gives a new scene and a new hiding spot.
const TAU = Math.PI * 2;
function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const INK = '#3b2418';
function shape(ctx, path, fill, { line = 2.2, ink = INK, shade = null, sdx = 0.25 } = {}) {
  ctx.fillStyle = fill; ctx.fill(path);
  if (shade) { ctx.save(); ctx.clip(path); ctx.fillStyle = shade; ctx.globalAlpha = 0.9; ctx.translate(0, 0); ctx.fill(path); ctx.restore(); }
  if (line) { ctx.strokeStyle = ink; ctx.lineWidth = line; ctx.lineJoin = 'round'; ctx.stroke(path); }
}
const P = () => new Path2D();
function ellP(x, y, rx, ry, r = 0) { const p = P(); p.ellipse(x, y, rx, ry, r, 0, TAU); return p; }
function rrP(x, y, w, h, r) { const p = P(); p.roundRect(x, y, w, h, r); return p; }
function polyP(pts) { const p = P(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; }
function dot(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

// ------------------------------------------------------------------ critters
const CAT_COLORS = { grey: ['#9aa0aa', '#7d838e'], black: ['#3a3640', '#2a2630'], white: ['#f4f1ea', '#d8d3c8'], cream: ['#f1d9a8', '#d9bd86'], tabby: ['#b8865a', '#94683f'], orange: ['#f08a32', '#d06c1c'] };
export function cat(ctx, x, y, s, color = 'grey', { hat = false, sit = true, flip = false } = {}) {
  const [c, cs] = CAT_COLORS[color] || CAT_COLORS.grey;
  ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s);
  // tail
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(8, -4); ctx.quadraticCurveTo(22, -6, 18, -20); ctx.stroke();
  ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.stroke();
  shape(ctx, ellP(0, -8, 11, 9), c, { line: 1.8 });                          // body
  shape(ctx, ellP(0, -20, 10, 8.5), c, { line: 1.8 });                       // head
  for (const sd of [-1, 1]) shape(ctx, polyP([[sd * 9, -24], [sd * 7, -33], [sd * 2, -27]]), c, { line: 1.6 });
  if (color === 'tabby' || color === 'orange') { ctx.strokeStyle = cs; ctx.lineWidth = 1.6; for (const xx of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(xx, -28); ctx.lineTo(xx, -24); ctx.stroke(); } }
  dot(ctx, -3.6, -20, 1.5, '#1c1418'); dot(ctx, 3.6, -20, 1.5, '#1c1418'); dot(ctx, 0, -17.4, 1, '#e88a9a');
  ctx.fillStyle = 'rgba(255,140,150,0.45)'; ctx.beginPath(); ctx.ellipse(-6, -17, 2, 1.2, 0, 0, TAU); ctx.ellipse(6, -17, 2, 1.2, 0, 0, TAU); ctx.fill();
  if (hat) { // tiny pumpkin hat
    shape(ctx, ellP(0, -30, 7, 4.6), '#f6a12e', { line: 1.4 }); ctx.strokeStyle = '#c96f12'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, -26); ctx.moveTo(-3.5, -33.5); ctx.quadraticCurveTo(-5, -30, -3.5, -26.5); ctx.moveTo(3.5, -33.5); ctx.quadraticCurveTo(5, -30, 3.5, -26.5); ctx.stroke();
    ctx.strokeStyle = '#4f7a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(1.5, -37.5); ctx.stroke();
  }
  ctx.restore();
}
function bunny(ctx, x, y, s, c = '#f6f3ee', hat = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shape(ctx, ellP(0, -8, 10, 9), c, { line: 1.8 }); shape(ctx, ellP(0, -20, 8.5, 7.5), c, { line: 1.8 });
  for (const sd of [-1, 1]) { shape(ctx, ellP(sd * 4, -32, 2.8, 8, sd * 0.15), c, { line: 1.6 }); dot(ctx, sd * 4, -31, 1.2, '#f3b8c0'); }
  dot(ctx, -3, -20, 1.4, '#1c1418'); dot(ctx, 3, -20, 1.4, '#1c1418'); dot(ctx, 0, -17.5, 1, '#e88a9a');
  if (hat) { shape(ctx, ellP(0, -27, 6, 4), '#f6a12e', { line: 1.3 }); }
  ctx.restore();
}
function mouse(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = '#b38b8b'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(8, -3); ctx.quadraticCurveTo(18, 0, 16, -10); ctx.stroke();
  shape(ctx, ellP(0, -7, 9, 7), '#b9b3b8', { line: 1.6 }); shape(ctx, ellP(-6, -14, 6.5, 5.5), '#b9b3b8', { line: 1.6 });
  for (const sd of [-1, 1]) { shape(ctx, ellP(-6 + sd * 5, -20, 3.6, 3.6), '#b9b3b8', { line: 1.4 }); dot(ctx, -6 + sd * 5, -20, 1.8, '#f0b8c0'); }
  dot(ctx, -8, -15, 1.1, '#1c1418'); dot(ctx, -12, -13, 1, '#e88a9a'); ctx.restore();
}
function frog(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shape(ctx, ellP(0, -7, 11, 8), '#7cc35a', { line: 1.8 });
  for (const sd of [-1, 1]) { shape(ctx, ellP(sd * 5, -15, 4, 4), '#7cc35a', { line: 1.5 }); dot(ctx, sd * 5, -15, 1.8, '#1c1418'); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -8, 4, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.restore();
}
function owl(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shape(ctx, ellP(0, -12, 9, 12), '#9a6a42', { line: 1.8 }); shape(ctx, ellP(0, -8, 6, 6), '#e6cfa6', { line: 0 });
  for (const sd of [-1, 1]) { dot(ctx, sd * 3.8, -16, 3.4, '#fff7e0'); dot(ctx, sd * 3.8, -16, 1.6, '#1c1418'); shape(ctx, polyP([[sd * 8, -22], [sd * 6, -27], [sd * 3, -22]]), '#9a6a42', { line: 1.2 }); }
  shape(ctx, polyP([[-1.5, -13], [1.5, -13], [0, -10]]), '#f0a830', { line: 0 }); ctx.restore();
}
function chick(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shape(ctx, ellP(0, -8, 8, 7.5), '#ffd84a', { line: 1.6 }); dot(ctx, -2.5, -10, 1.2, '#1c1418'); dot(ctx, 2.5, -10, 1.2, '#1c1418');
  shape(ctx, polyP([[-1.6, -7.5], [1.6, -7.5], [0, -5]]), '#f08a32', { line: 0 }); ctx.restore();
}
function fox(ctx, x, y, s) { // orange decoy (no hat, pointy snout)
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(8, -4); ctx.quadraticCurveTo(24, -2, 20, -16); ctx.stroke(); ctx.strokeStyle = '#e8762a'; ctx.lineWidth = 5.5; ctx.stroke(); dot(ctx, 20, -16, 3, '#fff7ee');
  shape(ctx, ellP(0, -8, 11, 9), '#e8762a', { line: 1.8 }); shape(ctx, polyP([[-11, -22], [11, -22], [0, -11]]), '#e8762a', { line: 1.8 });
  for (const sd of [-1, 1]) shape(ctx, polyP([[sd * 10, -21], [sd * 9, -31], [sd * 3, -22]]), '#e8762a', { line: 1.5 });
  shape(ctx, polyP([[-5, -16], [5, -16], [0, -11]]), '#fff7ee', { line: 0 }); dot(ctx, 0, -11.5, 1.3, '#1c1418'); dot(ctx, -4, -19, 1.3, '#1c1418'); dot(ctx, 4, -19, 1.3, '#1c1418');
  ctx.restore();
}
function hedgehog(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const p = P(); for (let i = 0; i <= 14; i++) { const a = Math.PI + (i / 14) * Math.PI, r = i % 2 ? 14 : 10; p.lineTo(Math.cos(a) * r, -4 + Math.sin(a) * r); } p.closePath();
  shape(ctx, p, '#7a5a40', { line: 1.6 }); shape(ctx, ellP(-10, -5, 6, 5), '#e6cfa6', { line: 1.4 }); dot(ctx, -11, -6, 1.1, '#1c1418'); dot(ctx, -16, -5, 1.2, '#1c1418'); ctx.restore();
}

// ------------------------------------------------------------------ objects
function item(ctx, kind, x, y, s, R) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  switch (kind) {
    case 'jar': shape(ctx, rrP(-7, -18, 14, 18, 4), ['#f4c430', '#e86a5a', '#8fbf6a', '#c58ad8'][Math.floor(R() * 4)], { line: 1.5 }); shape(ctx, rrP(-8, -21, 16, 5, 2), '#c98a4a', { line: 1.3 }); break;
    case 'books': for (let k = 0; k < 3; k++) shape(ctx, rrP(-10 + k, -6 - k * 6, 20 - k * 2, 6, 1.5), ['#c84a3a', '#3a6ab0', '#e0b040', '#4a9a6a'][Math.floor(R() * 4)], { line: 1.2 }); break;
    case 'mug': shape(ctx, rrP(-6, -12, 12, 12, 3), ['#ffffff', '#f0c0c8', '#bfe0f0'][Math.floor(R() * 3)], { line: 1.4 }); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(7, -6, 3.4, -1.3, 1.3); ctx.stroke(); break;
    case 'apple': shape(ctx, ellP(0, -6, 6.5, 6), '#e0453c', { line: 1.4 }); ctx.strokeStyle = '#4f7a2a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(1.5, -15); ctx.stroke(); break;
    case 'bread': shape(ctx, ellP(0, -6, 12, 6.5), '#d99a52', { line: 1.4 }); ctx.strokeStyle = '#a86a2a'; ctx.lineWidth = 1.3; for (const xx of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(xx - 2, -9); ctx.lineTo(xx + 2, -4); ctx.stroke(); } break;
    case 'mushroom': shape(ctx, rrP(-3, -10, 6, 10, 2), '#f4ecd8', { line: 1.3 }); shape(ctx, polyP([[-11, -9], [11, -9], [7, -16], [0, -19], [-7, -16]]), '#d8402e', { line: 1.4 }); dot(ctx, -4, -13, 1.6, '#fff'); dot(ctx, 4, -14, 1.4, '#fff'); break;
    case 'candle': shape(ctx, rrP(-3, -14, 6, 14, 1.5), '#f6efd8', { line: 1.3 }); dot(ctx, 0, -18, 3, 'rgba(255,200,80,0.9)'); dot(ctx, 0, -18, 1.4, '#fff7c0'); break;
    case 'basket': shape(ctx, polyP([[-12, -10], [12, -10], [9, 0], [-9, 0]]), '#b9824a', { line: 1.4 }); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, -10, 9, Math.PI, 0); ctx.stroke(); for (let k = 0; k < 3; k++) dot(ctx, -6 + k * 6, -12, 3.2, ['#e0453c', '#f4c430', '#8fbf6a'][k]); break;
    case 'pot': shape(ctx, polyP([[-8, -12], [8, -12], [6, 0], [-6, 0]]), '#c8643a', { line: 1.4 }); for (let k = 0; k < 4; k++) dot(ctx, -6 + k * 4, -16 - (k % 2) * 3, 3.2, ['#f06a8a', '#ffd84a', '#c58ad8', '#ffffff'][k]); break;
    case 'pumpkin': shape(ctx, ellP(0, -8, 11, 8), '#f08a32', { line: 1.5 }); ctx.strokeStyle = '#c96f12'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 0); ctx.moveTo(-5, -15); ctx.quadraticCurveTo(-8, -8, -5, -1); ctx.moveTo(5, -15); ctx.quadraticCurveTo(8, -8, 5, -1); ctx.stroke(); ctx.strokeStyle = '#4f7a2a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(2, -20); ctx.stroke(); break;
    case 'lantern': ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, -18); ctx.stroke(); shape(ctx, rrP(-6, -18, 12, 16, 3), '#ffd46a', { line: 1.5 }); break;
    case 'teacup': shape(ctx, polyP([[-8, -9], [8, -9], [5, 0], [-5, 0]]), '#9ad0e8', { line: 1.4 }); shape(ctx, ellP(0, 0.5, 10, 2.4), '#ffffff', { line: 1.2 }); break;
    case 'yarn': shape(ctx, ellP(0, -7, 7, 7), ['#e86a8a', '#6aa0e0', '#f4c430'][Math.floor(R() * 3)], { line: 1.4 }); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -7, 4, 0.3, 2.8); ctx.stroke(); break;
  }
  ctx.restore();
}
function flowers(ctx, x, y, s, R, n = 9) {
  for (let k = 0; k < n; k++) {
    const fx = x + (R() - 0.5) * 50 * s, fy = y + (R() - 0.5) * 22 * s, c = ['#f06a8a', '#ffd84a', '#ffffff', '#c58ad8', '#ff9a4a', '#7ab8f0'][Math.floor(R() * 6)], r = (2.2 + R() * 2) * s;
    for (let p = 0; p < 5; p++) dot(ctx, fx + Math.cos(p * 1.256) * r, fy + Math.sin(p * 1.256) * r, r * 0.8, c);
    dot(ctx, fx, fy, r * 0.6, '#f4b030');
  }
}
function tree(ctx, x, y, s, R) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shape(ctx, rrP(-7, -40, 14, 42, 4), '#8a5a36', { line: 2 });
  const g = ['#4f9a4a', '#3f8a40', '#5fae54', '#6dbd5e'];
  for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU, r = 22 + R() * 6; shape(ctx, ellP(Math.cos(a) * 20, -62 + Math.sin(a) * 16, r, r * 0.85), g[k % 4], { line: 1.8 }); }
  shape(ctx, ellP(0, -64, 30, 26), g[2], { line: 0 });
  for (let k = 0; k < 7; k++) dot(ctx, (R() - 0.5) * 50, -64 + (R() - 0.5) * 36, 3.2, ['#e0453c', '#ffd84a', '#f6f1e6'][k % 3]);
  ctx.restore();
}
function cottage(ctx, x, y, s, R) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const wall = ['#f2e2c4', '#e8d3b0', '#f6ead6', '#d9e6f0'][Math.floor(R() * 4)], roof = ['#c8503a', '#4f7ab0', '#7a5ab0', '#4f9a6a', '#d88a2a'][Math.floor(R() * 5)];
  shape(ctx, rrP(-34, -48, 68, 48, 4), wall, { line: 2 });
  ctx.strokeStyle = 'rgba(120,80,50,0.5)'; ctx.lineWidth = 2; for (const xx of [-20, 0, 20]) { ctx.beginPath(); ctx.moveTo(xx, -48); ctx.lineTo(xx, 0); ctx.stroke(); }
  shape(ctx, polyP([[-44, -44], [0, -86], [44, -44]]), roof, { line: 2.2 });
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-44 + k * 8, -44 - k * 8); ctx.lineTo(44 - k * 8, -44 - k * 8); ctx.stroke(); }
  shape(ctx, rrP(-8, -26, 16, 26, 7), '#8a5a36', { line: 1.8 });
  for (const sd of [-1, 1]) { shape(ctx, rrP(sd * 22 - 7, -38, 14, 14, 2), '#ffd77a', { line: 1.6 }); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sd * 22, -38); ctx.lineTo(sd * 22, -24); ctx.moveTo(sd * 22 - 7, -31); ctx.lineTo(sd * 22 + 7, -31); ctx.stroke(); }
  shape(ctx, rrP(18, -96, 10, 22, 2), '#a8734a', { line: 1.6 });
  ctx.restore();
}
function mushroomHouse(ctx, x, y, s, R) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shape(ctx, rrP(-20, -46, 40, 46, 10), '#f4ecd8', { line: 2 });
  shape(ctx, P2cap(), ['#d8402e', '#e07a2a', '#8a5ab0'][Math.floor(R() * 3)], { line: 2.2 });
  for (let k = 0; k < 6; k++) dot(ctx, (R() - 0.5) * 70, -62 - R() * 18, 3 + R() * 3, '#fff7ea');
  shape(ctx, rrP(-7, -22, 14, 22, 7), '#8a5a36', { line: 1.6 }); shape(ctx, ellP(12, -32, 5, 5), '#ffd77a', { line: 1.4 });
  ctx.restore();
  function P2cap() { const p = P(); p.moveTo(-48, -44); p.quadraticCurveTo(-46, -92, 0, -96); p.quadraticCurveTo(46, -92, 48, -44); p.quadraticCurveTo(0, -36, -48, -44); p.closePath(); return p; }
}

// ------------------------------------------------------------------ the scene
export async function create(stage, opts = {}) {
  const seed = Number(opts.seed || 7), R = rng(seed);
  const name = opts.name || 'Pumpkin Kitty';
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; stage.appendChild(cv);
  const ctx = cv.getContext('2d');
  const base = document.createElement('canvas'); base.width = 1080; base.height = 1920; const b = base.getContext('2d');
  const twinkles = [];

  // ground
  const gg = b.createLinearGradient(0, 0, 0, 1920); gg.addColorStop(0, '#3f7a3a'); gg.addColorStop(0.5, '#5a9a46'); gg.addColorStop(1, '#4a8a3c');
  b.fillStyle = gg; b.fillRect(0, 0, 1080, 1920);
  for (let k = 0; k < 2600; k++) { b.fillStyle = ['rgba(30,70,30,0.35)', 'rgba(120,180,80,0.35)', 'rgba(80,140,60,0.4)'][k % 3]; const x = R() * 1080, y = R() * 1920; b.fillRect(x, y, 2, 6); }
  // river: winding from top-left to bottom-right
  const river = P(); { const pts = []; for (let i = 0; i <= 24; i++) { const y = -40 + i * 85; const x = 160 + Math.sin(i * 0.55 + seed) * 120 + i * 26; pts.push([x, y]); }
    river.moveTo(pts[0][0] - 50, pts[0][1]); pts.forEach(([x, y]) => river.lineTo(x - 48, y)); for (let i = pts.length - 1; i >= 0; i--) river.lineTo(pts[i][0] + 48, pts[i][1]); river.closePath();
    b.save(); b.fillStyle = '#3cc0c8'; b.fill(river); b.clip(river); b.strokeStyle = 'rgba(255,255,255,0.6)'; b.lineWidth = 3; for (let k = 0; k < 120; k++) { const [x, y] = pts[Math.floor(R() * pts.length)]; b.beginPath(); b.moveTo(x - 30 + R() * 40, y + R() * 60); b.lineTo(x - 10 + R() * 40, y + R() * 60); b.stroke(); } b.restore();
    b.strokeStyle = '#2a7a6a'; b.lineWidth = 5; b.stroke(river);
    for (let k = 0; k < 60; k++) { const [x, y] = pts[Math.floor(R() * pts.length)]; twinkles.push({ x: x + (R() - 0.5) * 70, y: y + R() * 80, c: '255,255,255', r: 2.5, ph: R() * TAU, sp: 2 + R() * 2 }); } }
  // cobblestone paths
  const path = (pts, w) => { b.save(); b.lineCap = 'round'; b.lineJoin = 'round'; b.strokeStyle = '#6a5040'; b.lineWidth = w + 8; b.beginPath(); pts.forEach(([x, y], i) => (i ? b.lineTo(x, y) : b.moveTo(x, y))); b.stroke(); b.strokeStyle = '#d8c09a'; b.lineWidth = w; b.stroke();
    b.strokeStyle = 'rgba(120,90,60,0.45)'; b.lineWidth = 2; for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; for (let k = 0; k < 8; k++) { const u = k / 8, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u; b.beginPath(); b.ellipse(x + (R() - 0.5) * w * 0.6, y + (R() - 0.5) * w * 0.3, w * 0.16, w * 0.1, 0, 0, TAU); b.stroke(); } } b.restore(); };
  path([[0, 1540], [260, 1460], [540, 1330], [800, 1420], [1080, 1380]], 60);
  path([[540, 1330], [520, 1600], [600, 1920]], 54);
  path([[0, 640], [300, 700], [540, 620], [820, 680], [1080, 600]], 46);

  // back row: cottages, trees, mushroom houses (top of the frame, smaller)
  const placed = [];
  const free = (x, y, r) => placed.every((q) => Math.hypot(q[0] - x, q[1] - y) > r + q[2]);
  const big = [];
  for (let row = 0; row < 4; row++) for (let k = 0; k < 10; k++) {
    const x = 30 + k * 115 + (R() - 0.5) * 50, y = 90 + row * 140 + (R() - 0.5) * 40, s = 0.62 + row * 0.12;
    if (Math.hypot(x - 540, y - 940) < 420) continue; big.push([x, y, s, R()]);
  }
  for (let k = 0; k < 16; k++) { const side = k % 2 ? 1 : -1; big.push([540 + side * (420 + R() * 120), 1000 + R() * 820, 1.1 + R() * 0.3, R()]); }
  big.sort((p, q) => p[1] - q[1]);
  for (const [x, y, s, t] of big) { if (!free(x, y, 46 * s)) continue; placed.push([x, y, 46 * s]); if (t < 0.4) cottage(b, x, y, s, R); else if (t < 0.7) tree(b, x, y, s, R); else mushroomHouse(b, x, y, s, R);
    twinkles.push({ x: x + (R() - 0.5) * 40 * s, y: y - 30 * s, c: '255,215,120', r: 4, ph: R() * TAU, sp: 1 + R() }); }

  // giant pumpkin house (centre) with a cut-away interior
  const PX = 540, PY = 960, RX = 360, RY = 300;
  b.save();
  b.fillStyle = 'rgba(0,0,0,0.25)'; b.beginPath(); b.ellipse(PX, PY + RY - 10, RX * 0.95, 40, 0, 0, TAU); b.fill();
  const ribs = 7; for (let k = 0; k < ribs; k++) { const off = (k - (ribs - 1) / 2) / ((ribs - 1) / 2); shape(b, ellP(PX + off * RX * 0.62, PY, RX * (0.42 + 0.1 * (1 - Math.abs(off))), RY), k % 2 ? '#ee8a30' : '#f49a3a', { line: 3 }); }
  b.strokeStyle = 'rgba(160,80,10,0.35)'; b.lineWidth = 6; for (let k = 0; k < 40; k++) { const a = R() * TAU, r = R(); b.beginPath(); b.arc(PX + Math.cos(a) * RX * 0.9 * r, PY + Math.sin(a) * RY * 0.9 * r, 3, 0, TAU); b.stroke(); }
  // stem tower with a little lookout
  shape(b, polyP([[PX - 40, PY - RY + 20], [PX + 40, PY - RY + 20], [PX + 30, PY - RY - 120], [PX - 26, PY - RY - 110]]), '#5f8a3a', { line: 3 });
  shape(b, rrP(PX - 60, PY - RY - 200, 120, 90, 12), '#f2e2c4', { line: 3 }); shape(b, polyP([[PX - 76, PY - RY - 196], [PX, PY - RY - 270], [PX + 76, PY - RY - 196]]), '#c8503a', { line: 3 });
  for (const sd of [-1, 1]) { shape(b, rrP(PX + sd * 28 - 14, PY - RY - 180, 28, 30, 4), '#ffd77a', { line: 2 }); }
  // leaves and vines
  for (let k = 0; k < 14; k++) { const a = Math.PI * (1.05 + R() * 0.9), x = PX + Math.cos(a) * RX * 0.92, y = PY + Math.sin(a) * RY * 0.95; shape(b, ellP(x, y, 34, 18, a + 1.4), k % 2 ? '#4f9a4a' : '#5fae54', { line: 2 }); }
  b.strokeStyle = '#3f7a2a'; b.lineWidth = 5; b.beginPath(); b.moveTo(PX - RX, PY - 40); b.bezierCurveTo(PX - RX - 60, PY - 200, PX - 120, PY - RY - 80, PX - 30, PY - RY + 10); b.stroke();
  // cut-away: 3 floors full of tiny things
  const win = ellP(PX, PY + 20, RX * 0.72, RY * 0.72);
  shape(b, win, '#7a4a2a', { line: 4 });
  b.save(); b.clip(win);
  const wallG = b.createLinearGradient(0, PY - RY, 0, PY + RY); wallG.addColorStop(0, '#f6d9a0'); wallG.addColorStop(1, '#e0b070'); b.fillStyle = wallG; b.fillRect(PX - RX, PY - RY, RX * 2, RY * 2);
  b.strokeStyle = 'rgba(150,100,50,0.25)'; b.lineWidth = 3; for (let xx = PX - RX; xx < PX + RX; xx += 26) { b.beginPath(); b.moveTo(xx, PY - RY); b.lineTo(xx, PY + RY); b.stroke(); }
  const floors = [PY - 85, PY + 25, PY + 140];
  for (const fy of floors) { b.fillStyle = '#8a5a36'; b.fillRect(PX - RX, fy, RX * 2, 14); b.strokeStyle = INK; b.lineWidth = 2.5; b.strokeRect(PX - RX, fy, RX * 2, 14); }
  // fireplace + staircase
  shape(b, rrP(PX + 60, floors[2] - 90, 110, 90, 8), '#b8a090', { line: 2.5 }); shape(b, rrP(PX + 82, floors[2] - 60, 66, 60, 30), '#3a2418', { line: 2 });
  for (let k = 0; k < 3; k++) { b.fillStyle = ['#ffb030', '#ff7a2a', '#ffe080'][k]; b.beginPath(); b.ellipse(PX + 115, floors[2] - 18 - k * 8, 18 - k * 5, 16 - k * 3, 0, 0, TAU); b.fill(); twinkles.push({ x: PX + 115, y: floors[2] - 30, c: '255,190,90', r: 10, ph: k, sp: 7 }); }
  for (let k = 0; k < 7; k++) { shape(b, rrP(PX - 200 + k * 18, floors[2] - 16 - k * 15, 40, 12, 2), '#a8734a', { line: 1.6 }); }
  // shelves of objects + critters on every floor
  const kinds = ['jar', 'books', 'mug', 'apple', 'bread', 'candle', 'basket', 'pot', 'teacup', 'yarn', 'pumpkin', 'jar', 'books'];
  const spots = [];
  for (const [fi, fy] of floors.entries()) { const half = Math.sqrt(Math.max(0, 1 - ((fy - PY - 20) / (RY * 0.72)) ** 2)) * RX * 0.72; for (let xx = PX - half + 20; xx < PX + half - 16; xx += 22 + R() * 10) spots.push([xx, fy, 1.15 - fi * 0.05]); }
  // upper shelf strip
  for (let xx = PX - 170; xx < PX + 170; xx += 20) spots.push([xx, PY - 160, 1]);
  b.fillStyle = '#8a5a36'; b.fillRect(PX - 180, PY - 160, 360, 8);
  b.restore(); b.restore();
  b.strokeStyle = INK; b.lineWidth = 4; b.stroke(win);

  // scatter: objects + critters on the grass, paths and around the pumpkin
  const ground = [];
  for (let y = 40; y < 1900; y += 31) for (let x = 18; x < 1066; x += 31) {
    const jx = x + (R() - 0.5) * 20, jy = y + (R() - 0.5) * 16;
    if (((jx - PX) / (RX + 20)) ** 2 + ((jy - PY) / (RY + 30)) ** 2 < 1) continue;
    if (jy < PY - RY - 280 && Math.abs(jx - PX) < 110) continue;
    if (b.isPointInPath(river, jx, jy)) continue;
    if (!free(jx, jy, 12)) continue;
    ground.push([jx, jy, 0.72 + (jy / 1920) * 0.42]);
  }
  const all = [...spots.map((s) => [...s, true]), ...ground.map((s) => [...s, false])];
  // choose the hiding spot: never dead centre, never at the very edge
  const candidates = all.map((s, i) => [s, i]).filter(([s]) => s[0] > 110 && s[0] < 940 && s[1] > 470 && s[1] < 1480 && Math.hypot(s[0] - 540, s[1] - 960) > 180);
  const [tgt, tIdx] = candidates[Math.floor(R() * candidates.length)];
  const critters = ['bunny', 'mouse', 'frog', 'owl', 'chick', 'hedgehog', 'cat', 'cat', 'fox', 'bunnyHat'];
  all.forEach(([x, y, s, inside], i) => {
    if (i === tIdx) return;
    const r = R();
    if (!inside && r < 0.22) flowers(b, x, y, s, R, 6);
    if (r < 0.5) item(b, kinds[Math.floor(R() * kinds.length)], x, y, s, R);
    else {
      const c = critters[Math.floor(R() * critters.length)];
      if (c === 'cat') cat(b, x, y, s, ['grey', 'black', 'white', 'cream', 'tabby', 'orange'][Math.floor(R() * 6)], { flip: R() < 0.5 });
      else if (c === 'bunny') bunny(b, x, y, s); else if (c === 'bunnyHat') bunny(b, x, y, s, '#f6f3ee', true);
      else if (c === 'mouse') mouse(b, x, y, s); else if (c === 'frog') frog(b, x, y, s); else if (c === 'owl') owl(b, x, y, s);
      else if (c === 'chick') chick(b, x, y, s); else if (c === 'fox') fox(b, x, y, s); else hedgehog(b, x, y, s);
    }
  });
  // decoys that look close: orange cats WITHOUT hat, other cats WITH hat
  // (already mixed in above); the target:
  cat(b, tgt[0], tgt[1], tgt[2], 'orange', { hat: true, flip: R() < 0.5 });
  // string lights across the top
  for (const yy of [200, 1210]) { b.strokeStyle = '#3b2418'; b.lineWidth = 2; b.beginPath(); for (let x = 0; x <= 1080; x += 20) b.lineTo(x, yy + Math.sin(x / 1080 * Math.PI * 3) * 26); b.stroke();
    for (let x = 10; x < 1080; x += 36) { const y = yy + Math.sin(x / 1080 * Math.PI * 3) * 26 + 8; dot(b, x, y, 6, ['#ffd46a', '#ff8a8a', '#8ad0ff', '#b8f08a'][Math.floor(x / 36) % 4]); twinkles.push({ x, y, c: '255,230,160', r: 9, ph: x, sp: 2.4 }); } }
  // soft vignette
  const vg = b.createRadialGradient(540, 960, 600, 540, 960, 1250); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,10,0,0.35)'); b.fillStyle = vg; b.fillRect(0, 0, 1080, 1920);

  // sticker: "Only 1% can find / Pumpkin Kitty → [icon]"
  function sticker(c) {
    c.save(); c.font = '900 50px Nunito'; c.textBaseline = 'middle';
    const l1 = 'Only 1% can find', l2 = `${name} →`;
    const w1 = c.measureText(l1).width, w2 = c.measureText(l2).width + 70;
    const box = (w, y) => { c.fillStyle = '#ffffff'; c.strokeStyle = '#1e1a22'; c.lineWidth = 4; c.beginPath(); c.roundRect(540 - w / 2 - 24, y - 38, w + 48, 76, 18); c.fill(); c.stroke(); };
    box(w1, 280); box(w2, 360);
    c.fillStyle = '#1e1a22'; c.textAlign = 'center'; c.fillText(l1, 540, 283); c.textAlign = 'left'; c.fillText(l2, 540 - w2 / 2, 363);
    cat(c, 540 + w2 / 2 - 28, 386, 1.45, 'orange', { hat: true });
    c.restore();
  }

  const duration = Number(opts.dur || 12);
  function renderFrame(t) {
    ctx.drawImage(base, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const w of twinkles) { const a = 0.25 + 0.25 * Math.sin(t * w.sp + w.ph); if (a <= 0) continue; const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r * 2.4); g.addColorStop(0, `rgba(${w.c},${a})`); g.addColorStop(1, `rgba(${w.c},0)`); ctx.fillStyle = g; ctx.fillRect(w.x - w.r * 2.4, w.y - w.r * 2.4, w.r * 4.8, w.r * 4.8); }
    ctx.restore();
    sticker(ctx);
    if (opts.reveal) { ctx.strokeStyle = '#ff2d4a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(tgt[0], tgt[1] - 18 * tgt[2], 46, 0, TAU); ctx.stroke(); }
  }
  renderFrame(0);
  window.__target = { x: tgt[0], y: tgt[1] };
  return { duration, renderFrame };
}
