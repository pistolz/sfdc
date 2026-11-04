// THE HIVE TREE — "Only 1% can find the 5 royal bees 👑" (original seek-and-find, 100% code, all bees).
// A cosy cut-away tree house at night with labelled rooms (HONEY BAR, DANCE FLOOR, STORY TIME,
// NAP CELLS, FLOWER SHOP, POND). ~55 cute bees, almost all animated: wings flap, some hover,
// spin on themselves, look up, lift their hat, turn left/right or drift a little.
const TAU = Math.PI * 2;
function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const INK = '#3a2214';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (k) => { k = clamp(k); return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; };
const P = () => new Path2D();
const ellP = (x, y, rx, ry, r = 0) => { const p = P(); p.ellipse(x, y, rx, ry, r, 0, TAU); return p; };
const rrP = (x, y, w, h, r) => { const p = P(); p.roundRect(x, y, w, h, r); return p; };
const polyP = (pts) => { const p = P(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
function shape(ctx, path, fill, line = 2.6) { ctx.fillStyle = fill; ctx.fill(path); if (line) { ctx.strokeStyle = INK; ctx.lineWidth = line; ctx.lineJoin = 'round'; ctx.stroke(path); } }
const dot = (ctx, x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
const hexP = (x, y, r) => { const p = P(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; i ? p.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : p.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } p.closePath(); return p; };

// ------------------------------------------------------------------ the bee
const HATS = ['none', 'none', 'none', 'top', 'beanie', 'flower', 'chef', 'cap', 'party', 'bow', 'none', 'flowercrown'];
function hat(ctx, kind) {
  switch (kind) {
    case 'crown': shape(ctx, polyP([[-14, 0], [-16, -18], [-8, -9], [0, -22], [8, -9], [16, -18], [14, 0]]), '#ffcf2e', 2.2); dot(ctx, 0, -8, 3, '#e8344a'); dot(ctx, -9, -5, 2, '#4aa0ff'); dot(ctx, 9, -5, 2, '#4aa0ff'); break;
    case 'top': shape(ctx, rrP(-18, -3, 36, 6, 3), '#2a2a36', 2); shape(ctx, rrP(-11, -24, 22, 22, 3), '#2a2a36', 2); ctx.fillStyle = '#d84a6a'; ctx.fillRect(-11, -9, 22, 5); break;
    case 'beanie': shape(ctx, P2beanie(), '#4a8ae0', 2.2); dot(ctx, 0, -20, 5, '#f4f0e6'); break;
    case 'flower': for (let i = 0; i < 5; i++) dot(ctx, Math.cos(i * 1.256) * 7, -8 + Math.sin(i * 1.256) * 7, 5.5, '#ff8ab0'); dot(ctx, 0, -8, 4.5, '#ffd84a'); break;
    case 'chef': shape(ctx, rrP(-12, -10, 24, 10, 2), '#ffffff', 2); for (const xx of [-8, 0, 8]) shape(ctx, ellP(xx, -16, 8, 8), '#ffffff', 2); break;
    case 'cap': shape(ctx, P2cap(), '#e8344a', 2.2); shape(ctx, ellP(13, -2, 11, 3.5), '#e8344a', 2); break;
    case 'party': shape(ctx, polyP([[-11, 0], [11, 0], [0, -28]]), '#ffd84a', 2.2); dot(ctx, 0, -29, 3.5, '#e8344a'); ctx.strokeStyle = '#e8344a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7, -9); ctx.lineTo(7, -13); ctx.stroke(); break; // decoy: yellow & pointy like a crown
    case 'bow': shape(ctx, polyP([[0, -6], [-14, -14], [-14, 2]]), '#ff6a9a', 2); shape(ctx, polyP([[0, -6], [14, -14], [14, 2]]), '#ff6a9a', 2); dot(ctx, 0, -6, 4, '#ff3a7a'); break;
    case 'flowercrown': for (let i = -2; i <= 2; i++) { dot(ctx, i * 7, -3 - Math.abs(i) * -1, 4.5, ['#ffd84a', '#ff8ab0', '#ffffff'][(i + 2) % 3]); dot(ctx, i * 7, -3, 1.8, '#ffb030'); } break; // decoy: yellow flowers ring
    case 'sleep': shape(ctx, polyP([[-14, 0], [14, 0], [6, -22], [20, -18]]), '#8a9ae8', 2.2); dot(ctx, 20, -18, 4, '#ffffff'); break;
  }
  function P2beanie() { const p = P(); p.moveTo(-16, 0); p.quadraticCurveTo(-16, -20, 0, -20); p.quadraticCurveTo(16, -20, 16, 0); p.closePath(); return p; }
  function P2cap() { const p = P(); p.moveTo(-15, 0); p.quadraticCurveTo(-15, -18, 0, -18); p.quadraticCurveTo(15, -18, 15, 0); p.closePath(); return p; }
}
function heldProp(ctx, kind) {
  switch (kind) {
    case 'jar': shape(ctx, rrP(-9, -14, 18, 18, 4), '#ffb81f', 2); shape(ctx, rrP(-10, -18, 20, 6, 2), '#c98a4a', 1.8); break;
    case 'book': shape(ctx, rrP(-12, -12, 24, 16, 2), '#4a8ae0', 2); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 4); ctx.stroke(); break;
    case 'mic': shape(ctx, rrP(-3, -4, 6, 14, 2), '#3a3a44', 1.6); shape(ctx, ellP(0, -8, 6, 6), '#c8ccd8', 1.8); break;
    case 'can': shape(ctx, rrP(-10, -12, 20, 14, 4), '#6ac0e8', 2); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(20, -16); ctx.stroke(); break;
    case 'flower': ctx.strokeStyle = '#4f9a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -12); ctx.stroke(); for (let i = 0; i < 5; i++) dot(ctx, Math.cos(i * 1.256) * 5, -16 + Math.sin(i * 1.256) * 5, 4, '#ff8ab0'); dot(ctx, 0, -16, 3, '#ffd84a'); break;
    case 'cup': shape(ctx, rrP(-7, -10, 14, 12, 3), '#ffffff', 1.8); break;
  }
}
/**
 * o: { f facing (+1/−1), hat, prop, sleep, t, ph, anims: Set('hover','spin','look','hatlift','turn','drift','dance') }
 * Origin = bottom of the bee (sitting point). Height ≈ 70 at s = 1.
 */
export function bee(ctx, x, y, s, o = {}) {
  const t = o.t ?? 0, ph = o.ph ?? 0, A = o.anims || new Set();
  let f = o.f ?? 1, dx = 0, dy = 0, rot = 0, sx = 1, look = 0, hatUp = 0, hatRot = 0, wings = 1;
  wings = o.sleep ? 0.55 : 0.45 + 0.55 * Math.abs(Math.sin(t * 34 + ph * 9));
  if (A.has('hover')) { dy = -14 - Math.sin(t * 3.2 + ph) * 9; }
  if (A.has('drift')) { dx = Math.sin(t * 0.9 + ph * 3) * 14; rot += Math.sin(t * 0.9 + ph * 3) * 0.08; }
  if (A.has('dance')) { dy += -Math.abs(Math.sin(t * 5 + ph)) * 8; rot += Math.sin(t * 5 + ph) * 0.12; }
  if (A.has('spin')) { const per = 3.6 + (ph % 1.5), u = ((t + ph * 2) % per) / per; if (u < 0.22) sx = Math.cos(ease(u / 0.22) * TAU); }
  if (A.has('turn')) { const per = 3 + (ph % 2), k = Math.floor((t + ph * 5) / per), u = ((t + ph * 5) % per) / per; const fa = k % 2 ? -1 : 1, fb = k % 2 ? 1 : -1; f *= u < 0.08 ? fb + (fa - fb) * ease(u / 0.08) : fa; }
  if (A.has('look')) { const per = 3.2 + (ph % 1.7), u = ((t + ph * 3) % per) / per; look = Math.sin(Math.PI * clamp(u / 0.35)) * (u < 0.35 ? 1 : 0); rot -= look * 0.25 * Math.sign(f || 1); }
  if (A.has('hatlift') && o.hat && o.hat !== 'none') { const per = 3.5 + (ph % 1.3), u = ((t + ph * 4) % per) / per; const k = u < 0.3 ? Math.sin(Math.PI * u / 0.3) : 0; hatUp = k * 16; hatRot = k * -0.35; }
  const sleeping = o.sleep;
  ctx.save(); ctx.translate(x + dx * s, y);
  if (dy < -2) { ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.ellipse(0, 0, 18 * s, 4 * s, 0, 0, TAU); ctx.fill(); }
  ctx.translate(0, dy * s); ctx.scale(s, s); ctx.rotate(rot);
  const ff = Math.abs(f) < 0.05 ? 0.05 : f;
  ctx.scale(sx * ff, 1);
  // wings (behind)
  ctx.save(); ctx.globalAlpha = 0.85;
  for (const [wx, wr] of [[-8, -0.5], [4, -0.2]]) { ctx.save(); ctx.translate(wx, -46); ctx.rotate(wr); ctx.scale(1, wings); shape(ctx, ellP(0, -10, 10, 15), 'rgba(220,240,255,0.9)', 2); ctx.restore(); }
  ctx.restore();
  // stinger
  shape(ctx, polyP([[-24, -22], [-33, -19], [-23, -15]]), '#3a2a20', 1.6);
  // body
  const body = ellP(0, -24, 26, 23);
  shape(ctx, body, '#ffcc33', 2.8);
  ctx.save(); ctx.clip(body);
  ctx.fillStyle = '#3a2a20'; for (const bx of [-17, -5]) { ctx.beginPath(); ctx.ellipse(bx, -24, 4.5, 30, 0.15, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(6, -38, 12, 6, -0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(200,120,0,0.25)'; ctx.beginPath(); ctx.ellipse(-4, -6, 26, 8, 0, 0, TAU); ctx.fill();
  ctx.restore(); ctx.strokeStyle = INK; ctx.lineWidth = 2.8; ctx.stroke(body);
  // face (front side)
  const ey = -26 - look * 4;
  if (sleeping) { ctx.strokeStyle = INK; ctx.lineWidth = 2; for (const ex of [6, 17]) { ctx.beginPath(); ctx.arc(ex, ey + 1, 3.2, 0.2, Math.PI - 0.2); ctx.stroke(); } }
  else { const blink = ((t + ph * 7) % 4.2) < 0.12; for (const ex of [6, 17]) { if (blink) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex - 3, ey); ctx.lineTo(ex + 3, ey); ctx.stroke(); } else { dot(ctx, ex, ey, 3.6, '#2a1a12'); dot(ctx, ex + 1.2, ey - 1.4, 1.3, '#ffffff'); } } }
  ctx.fillStyle = 'rgba(255,110,120,0.5)'; ctx.beginPath(); ctx.ellipse(3, ey + 7, 3.6, 2.2, 0, 0, TAU); ctx.ellipse(21, ey + 7, 3.2, 2.2, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(11.5, ey + 6, 3, 0.3, Math.PI - 0.3); ctx.stroke();
  // antennae
  ctx.strokeStyle = INK; ctx.lineWidth = 2; for (const [ax, bx] of [[4, 0], [13, 15]]) { ctx.beginPath(); ctx.moveTo(ax, -44); ctx.quadraticCurveTo(ax + 2, -54, bx, -58 - look * 3); ctx.stroke(); dot(ctx, bx, -58 - look * 3, 3.2, '#3a2a20'); }
  // little arms + held prop
  if (o.prop) { ctx.save(); ctx.translate(24, -14); heldProp(ctx, o.prop); ctx.restore(); dot(ctx, 22, -14, 4, '#ffcc33'); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(22, -14, 4, 0, TAU); ctx.stroke(); }
  // feet
  for (const fx of [-6, 8]) shape(ctx, ellP(fx, -1, 5, 3), '#3a2a20', 1.4);
  // hat
  if (o.hat && o.hat !== 'none') { ctx.save(); ctx.translate(4, -44 - hatUp); ctx.rotate(hatRot - 0.08); hat(ctx, o.hat); ctx.restore(); }
  ctx.restore();
  if (sleeping) { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '900 18px Nunito'; for (let k = 0; k < 2; k++) { const u = ((t * 0.5 + ph + k * 0.5) % 1); ctx.globalAlpha = Math.sin(Math.PI * u); ctx.fillText('z', x + (20 + u * 14) * s, y - (60 + u * 30) * s); } ctx.restore(); }
}

// ------------------------------------------------------------------ scenery
function sign(ctx, x, y, label, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.font = '900 34px Nunito'; const w = ctx.measureText(label).width + 40;
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w / 2 + 20, -40); ctx.lineTo(-w / 2 + 26, -22); ctx.moveTo(w / 2 - 20, -40); ctx.lineTo(w / 2 - 26, -22); ctx.stroke();
  shape(ctx, rrP(-w / 2, -24, w, 48, 8), '#8a5530', 3); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-w / 2 + 4, -20, w - 8, 10);
  ctx.fillStyle = '#ffe9b8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 2); ctx.restore();
}
function room(ctx, x, y, w, h, wall = '#e8b878') {
  // floor slab + back wall planks + railing posts
  shape(ctx, rrP(x, y, w, h, 14), wall, 3.5);
  ctx.save(); ctx.clip(rrP(x, y, w, h, 14));
  ctx.strokeStyle = 'rgba(120,70,30,0.28)'; ctx.lineWidth = 3; for (let xx = x + 30; xx < x + w; xx += 34) { ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); ctx.stroke(); }
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,220,140,0.0)'); g.addColorStop(1, 'rgba(120,60,20,0.25)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
  shape(ctx, rrP(x - 14, y + h - 6, w + 28, 26, 8), '#9a6236', 3.5);
  ctx.strokeStyle = 'rgba(60,30,10,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 10, y + h + 7); ctx.lineTo(x + w + 10, y + h + 7); ctx.stroke();
}
function lantern(ctx, x, y, glows) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x, y - 12); ctx.stroke(); shape(ctx, rrP(x - 10, y - 12, 20, 24, 5), '#ffd46a', 2.4); shape(ctx, rrP(x - 12, y - 15, 24, 5, 2), '#7a4a26', 1.8); glows.push({ x, y, r: 40, c: '255,200,110' }); }
function jarShelf(ctx, x, y, n) { shape(ctx, rrP(x, y, n * 34 + 10, 10, 3), '#7a4a26', 2.4); for (let i = 0; i < n; i++) { const jx = x + 10 + i * 34; shape(ctx, rrP(jx, y - 26, 24, 26, 5), ['#ffb81f', '#ffcf4a', '#f09a1a'][i % 3], 2.2); shape(ctx, rrP(jx - 1, y - 32, 26, 7, 2), '#c98a4a', 2); } }
function flowerPot(ctx, x, y, c) { shape(ctx, polyP([[x - 18, y - 30], [x + 18, y - 30], [x + 13, y], [x - 13, y]]), '#d06a3a', 2.4); ctx.strokeStyle = '#4f9a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x, y - 62); ctx.stroke(); shape(ctx, ellP(x - 10, y - 46, 9, 5, -0.5), '#5fae54', 2); for (let i = 0; i < 6; i++) shape(ctx, ellP(x + Math.cos(i * 1.047) * 11, y - 70 + Math.sin(i * 1.047) * 11, 8, 8), c, 2); dot(ctx, x, y - 70, 7, '#ffb030'); }

function flowerPot2(ctx, x, y, c) { ctx.strokeStyle = '#4f9a3a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 80); ctx.stroke(); shape(ctx, ellP(x + 12, y - 40, 12, 6, 0.5), '#5fae54', 2); for (let i = 0; i < 10; i++) shape(ctx, ellP(x + Math.cos(i * 0.628) * 16, y - 96 + Math.sin(i * 0.628) * 16, 9, 5, i * 0.628), c, 1.8); dot(ctx, x, y - 96, 11, '#8a5530'); }
export async function create(stage, opts = {}) {
  const seed = Number(opts.seed || 3), R = rng(seed);
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; stage.appendChild(cv);
  const ctx = cv.getContext('2d');
  const base = document.createElement('canvas'); base.width = 1080; base.height = 1920; const b = base.getContext('2d');
  const glows = [], twinkle = [];

  // night sky, stars, moon, distant forest
  const sky = b.createLinearGradient(0, 0, 0, 1920); sky.addColorStop(0, '#0c1436'); sky.addColorStop(0.5, '#1c2c66'); sky.addColorStop(1, '#2a3a70');
  b.fillStyle = sky; b.fillRect(0, 0, 1080, 1920);
  for (let i = 0; i < 160; i++) { const x = R() * 1080, y = R() * 1300, r = R() * 2 + 0.6; dot(b, x, y, r, 'rgba(255,255,240,0.85)'); if (R() < 0.3) twinkle.push({ x, y, r: r * 3, ph: R() * TAU }); }
  dot(b, 150, 210, 52, '#fff3c4'); dot(b, 172, 196, 46, '#1a2860');
  b.fillStyle = '#16244e'; for (let i = 0; i < 14; i++) { const x = i * 85 - 20; b.beginPath(); b.arc(x, 1380 + (i % 3) * 20, 90 + (i % 4) * 20, Math.PI, 0); b.fill(); }
  // ground + pond
  const gr = b.createLinearGradient(0, 1500, 0, 1920); gr.addColorStop(0, '#3f7a3a'); gr.addColorStop(1, '#2a5a2a'); b.fillStyle = gr; b.fillRect(0, 1500, 1080, 420);
  shape(b, ellP(250, 1700, 230, 90), '#3aa8c8', 3.5); b.save(); b.clip(ellP(250, 1700, 230, 90)); b.strokeStyle = 'rgba(255,255,255,0.4)'; b.lineWidth = 3; for (let k = 0; k < 12; k++) { b.beginPath(); b.ellipse(150 + R() * 200, 1660 + R() * 80, 20, 4, 0, 0, TAU); b.stroke(); } b.restore();
  for (const [x, y] of [[180, 1690], [330, 1730], [260, 1650]]) { shape(b, ellP(x, y, 34, 12), '#5fae54', 2.4); b.strokeStyle = INK; b.lineWidth = 2; b.beginPath(); b.moveTo(x, y); b.lineTo(x + 30, y - 6); b.stroke(); }
  // trunk + roots + canopy
  shape(b, polyP([[420, 1560], [470, 1200], [455, 700], [500, 380], [580, 380], [625, 700], [610, 1200], [660, 1560], [760, 1600], [320, 1600]]), '#8a5530', 4);
  b.strokeStyle = 'rgba(60,30,10,0.35)'; b.lineWidth = 4; for (let k = 0; k < 10; k++) { const x = 470 + R() * 140, y = 450 + R() * 1050; b.beginPath(); b.moveTo(x, y); b.quadraticCurveTo(x + 10, y + 40, x - 4, y + 90); b.stroke(); }
  shape(b, rrP(505, 1430, 70, 110, 35), '#5a3418', 3); shape(b, ellP(540, 1470, 14, 14), '#ffd46a', 2.4); glows.push({ x: 540, y: 1470, r: 50, c: '255,200,110' });
  for (let k = 0; k < 16; k++) { const a = Math.PI * (1.0 + (k / 15)), x = 540 + Math.cos(a) * 430, y = 360 + Math.sin(a) * 220; shape(b, ellP(x, y, 120, 85), ['#2f6a3a', '#3a7a40', '#2a5a34'][k % 3], 3); }
  shape(b, ellP(540, 300, 330, 170), '#3a7a40', 3);
  for (let k = 0; k < 40; k++) dot(b, 260 + R() * 560, 180 + R() * 300, 3, 'rgba(160,230,140,0.5)');
  // string lights through the canopy
  for (const [y0, amp] of [[420, 30], [780, 24]]) { b.strokeStyle = INK; b.lineWidth = 2; b.beginPath(); for (let x = 0; x <= 1080; x += 20) b.lineTo(x, y0 + Math.sin(x / 1080 * Math.PI * 2) * amp); b.stroke(); for (let x = 20; x < 1080; x += 44) { const y = y0 + Math.sin(x / 1080 * Math.PI * 2) * amp + 8; dot(b, x, y, 6, ['#ffd46a', '#ff9a8a', '#9ad0ff'][Math.floor(x / 44) % 3]); glows.push({ x, y, r: 22, c: '255,220,150', tw: R() * TAU }); } }

  sign(b, 470, 1640, 'POND', -0.06);
  // ground decor: sunflowers, mushrooms, flower patches, a little hive box
  for (const [x, y, c] of [[640, 1700, '#ffd84a'], [760, 1760, '#ff8ab0'], [900, 1700, '#ffd84a'], [1010, 1790, '#c58ad8'], [560, 1820, '#ffffff'], [80, 1560, '#ffd84a']]) flowerPot2(b, x, y, c);
  for (const [x, y] of [[700, 1860], [960, 1880], [440, 1880], [120, 1880]]) { shape(b, rrP(x - 6, y - 22, 12, 22, 4), '#f4ecd8', 2.2); shape(b, polyP([[x - 24, y - 20], [x + 24, y - 20], [x + 14, y - 36], [x, y - 40], [x - 14, y - 36]]), '#d8402e', 2.4); dot(b, x - 8, y - 29, 3.5, '#fff'); dot(b, x + 8, y - 31, 3, '#fff'); }
  shape(b, rrP(820, 1560, 120, 90, 12), '#e8b85a', 3); for (let k = 1; k < 4; k++) { b.strokeStyle = INK; b.lineWidth = 2.4; b.beginPath(); b.moveTo(820, 1560 + k * 22); b.lineTo(940, 1560 + k * 22); b.stroke(); } shape(b, rrP(810, 1546, 140, 20, 6), '#b0703a', 3); shape(b, ellP(880, 1630, 12, 8), '#5a3418', 2);
  for (let k = 0; k < 40; k++) { const x = R() * 1080, y = 1540 + R() * 380; if (((x - 250) / 240) ** 2 + ((y - 1700) / 100) ** 2 < 1) continue; for (let p = 0; p < 5; p++) dot(b, x + Math.cos(p * 1.256) * 5, y + Math.sin(p * 1.256) * 5, 4, ['#ff8ab0', '#ffffff', '#ffd84a', '#c58ad8'][k % 4]); dot(b, x, y, 3, '#ffb030'); }
  // hanging honeycomb lanterns in the canopy
  for (const [x, y] of [[180, 560], [900, 560], [70, 900], [1010, 880]]) { b.strokeStyle = INK; b.lineWidth = 2; b.beginPath(); b.moveTo(x, y - 60); b.lineTo(x, y - 30); b.stroke(); shape(b, hexP(x, y, 30), '#ffcf4a', 2.6); shape(b, hexP(x, y, 18), '#f09a1a', 0); glows.push({ x, y, r: 60, c: '255,200,90' }); }

  // ---------------- rooms
  // DANCE FLOOR (top, under the canopy)
  room(b, 250, 470, 580, 260, '#c9a070');
  b.save(); b.clip(rrP(250, 470, 580, 260, 14)); for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) { b.fillStyle = ['rgba(255,120,180,0.35)', 'rgba(120,200,255,0.35)', 'rgba(255,220,90,0.35)'][(i + j) % 3]; b.fillRect(260 + i * 64, 640 + j * 30, 62, 28); } b.restore();
  shape(b, ellP(540, 520, 26, 26), '#d8dde8', 2.6); for (let k = 0; k < 8; k++) { b.strokeStyle = 'rgba(80,90,110,0.5)'; b.lineWidth = 1.5; b.beginPath(); b.moveTo(540 - 26, 520 - 20 + k * 5.5); b.lineTo(540 + 26, 520 - 20 + k * 5.5); b.stroke(); }
  b.strokeStyle = INK; b.lineWidth = 2; b.beginPath(); b.moveTo(540, 470); b.lineTo(540, 494); b.stroke(); glows.push({ x: 540, y: 520, r: 70, c: '200,230,255' });
  for (const [x, y] of [[320, 560], [770, 580], [700, 540]]) { b.fillStyle = '#ffffff'; b.font = '900 34px Nunito'; b.fillText(['♪', '♫', '♪'][x % 3], x, y); }
  sign(b, 540, 448, 'DANCE FLOOR', 0.03);
  // HONEY BAR (left middle)
  room(b, 50, 830, 470, 290, '#e8b878');
  jarShelf(b, 80, 900, 5); jarShelf(b, 270, 900, 5);
  shape(b, rrP(80, 1010, 400, 80, 10), '#b0703a', 3); shape(b, rrP(70, 1000, 420, 22, 8), '#d08a4a', 3);
  for (const x of [130, 230, 330, 430]) { shape(b, rrP(x - 20, 1090, 40, 12, 4), '#7a4a26', 2.4); }
  shape(b, rrP(380, 940, 60, 50, 8), '#c98a4a', 2.6); shape(b, rrP(400, 985, 20, 20, 4), '#ffb81f', 2.2);
  sign(b, 285, 808, 'HONEY BAR', -0.05); lantern(b, 470, 870, glows);
  // STORY TIME (right middle)
  room(b, 560, 860, 470, 280, '#e4b07a');
  shape(b, rrP(590, 890, 120, 200, 6), '#7a4a26', 3); for (let k = 0; k < 4; k++) { shape(b, rrP(598, 905 + k * 46, 104, 6, 2), '#5a3418', 1.6); for (let m = 0; m < 6; m++) shape(b, rrP(602 + m * 16, 875 + k * 46 + 6, 13, 26, 2), ['#e8344a', '#4a8ae0', '#ffcf2e', '#5fae54', '#c58ad8'][(k + m) % 5], 1.4); }
  shape(b, ellP(860, 1100, 150, 26), '#c84a6a', 3); shape(b, ellP(860, 1100, 110, 16), '#e87a9a', 2);
  shape(b, rrP(900, 960, 100, 110, 30), '#6a5ab0', 3); shape(b, rrP(890, 1030, 120, 50, 18), '#7a6ac8', 3);
  lantern(b, 760, 920, glows); sign(b, 800, 838, 'STORY TIME', 0.05);
  // NAP CELLS (left low) — honeycomb beds
  room(b, 50, 1200, 450, 270, '#d8a868');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { const x = 100 + c * 66 + (r % 2) * 33, y = 1250 + r * 58; if (x > 470) continue; shape(b, hexP(x, y, 34), '#ffcf4a', 2.6); shape(b, hexP(x, y, 24), '#f09a1a', 0); }
  sign(b, 275, 1178, 'NAP CELLS', -0.04);
  // FLOWER SHOP (right low)
  room(b, 580, 1230, 440, 250, '#efc890');
  for (let k = 0; k < 7; k++) { const x = 600 + k * 62; shape(b, polyP([[x, 1240], [x + 62, 1240], [x + 52, 1290], [x + 10, 1290]]), k % 2 ? '#ff8ab0' : '#ffffff', 2.4); }
  flowerPot(b, 640, 1460, '#ff8ab0'); flowerPot(b, 980, 1460, '#ffd84a'); flowerPot(b, 900, 1460, '#c58ad8');
  shape(b, rrP(680, 1400, 160, 60, 8), '#b0703a', 3);
  sign(b, 800, 1208, 'FLOWER SHOP', 0.04);
  // ladders + rope bridge
  for (const [x, y0, y1] of [[520, 1120, 1200], [545, 1140, 1230], [520, 730, 830]]) { b.strokeStyle = '#6a3a1a'; b.lineWidth = 5; b.beginPath(); b.moveTo(x - 14, y0); b.lineTo(x - 14, y1); b.moveTo(x + 14, y0); b.lineTo(x + 14, y1); b.stroke(); for (let y = y0 + 12; y < y1; y += 18) { b.beginPath(); b.moveTo(x - 14, y); b.lineTo(x + 14, y); b.stroke(); } }
  b.strokeStyle = '#c8a070'; b.lineWidth = 3; b.beginPath(); b.moveTo(1030, 1140); b.quadraticCurveTo(1060, 1300, 1080, 1320); b.stroke();
  // fireflies
  for (let k = 0; k < 26; k++) twinkle.push({ x: R() * 1080, y: 400 + R() * 1400, r: 6, ph: R() * TAU, firefly: true });

  // ---------------- bees (≈55): positions per room
  const spots = [
    // dance floor (dancers)
    ...[[310, 700], [380, 690], [460, 705], [610, 700], [690, 690], [770, 705], [420, 640], [660, 640], [540, 690]].map(([x, y]) => ({ x, y, s: 0.95, room: 'dance' })),
    // honey bar: bartender + customers on stools + one on the shelf
    { x: 200, y: 1000, s: 1.0, room: 'bar', prop: 'jar', hat: 'chef' }, { x: 130, y: 1090, s: 0.95, room: 'bar', prop: 'cup' }, { x: 230, y: 1090, s: 0.95, room: 'bar' },
    { x: 330, y: 1090, s: 0.95, room: 'bar', prop: 'cup' }, { x: 430, y: 1090, s: 0.95, room: 'bar' }, { x: 120, y: 895, s: 0.7, room: 'bar' }, { x: 330, y: 895, s: 0.7, room: 'bar' },
    // story time: reader + listeners
    { x: 950, y: 1030, s: 1.05, room: 'story', prop: 'book', hat: 'top', f: -1 }, { x: 780, y: 1100, s: 0.85, room: 'story' }, { x: 840, y: 1110, s: 0.85, room: 'story' },
    { x: 900, y: 1120, s: 0.85, room: 'story' }, { x: 730, y: 1120, s: 0.85, room: 'story' }, { x: 650, y: 1110, s: 0.8, room: 'story', prop: 'book' },
    // nap cells: sleepers in the hexagons
    ...[[100, 1268], [232, 1268], [364, 1268], [166, 1326], [298, 1326], [430, 1326], [232, 1384], [100, 1384]].map(([x, y], i) => ({ x, y, s: 0.62, room: 'nap', sleep: i % 3 !== 2, hat: i % 3 !== 2 ? 'sleep' : undefined })),
    // flower shop
    { x: 740, y: 1400, s: 0.95, room: 'shop', prop: 'flower' }, { x: 810, y: 1400, s: 0.95, room: 'shop' }, { x: 640, y: 1385, s: 0.8, room: 'shop', prop: 'can' }, { x: 900, y: 1380, s: 0.8, room: 'shop', prop: 'flower' }, { x: 980, y: 1380, s: 0.8, room: 'shop' },
    // outside: canopy, branches, trunk, ladder, pond, sky
    { x: 300, y: 330, s: 0.8, room: 'out' }, { x: 780, y: 330, s: 0.8, room: 'out' }, { x: 120, y: 520, s: 0.75, room: 'out' }, { x: 960, y: 540, s: 0.75, room: 'out' },
    { x: 920, y: 760, s: 0.8, room: 'out' }, { x: 120, y: 760, s: 0.8, room: 'out' }, { x: 540, y: 820, s: 0.75, room: 'out' }, { x: 540, y: 1190, s: 0.75, room: 'out' },
    { x: 1010, y: 1180, s: 0.75, room: 'out' }, { x: 60, y: 1180, s: 0.7, room: 'out' }, { x: 180, y: 1690, s: 0.75, room: 'pond', prop: 'flower' }, { x: 330, y: 1728, s: 0.75, room: 'pond' },
    { x: 700, y: 1600, s: 0.8, room: 'out' }, { x: 850, y: 1620, s: 0.8, room: 'out', prop: 'jar' }, { x: 640, y: 420, s: 0.7, room: 'out' }, { x: 440, y: 420, s: 0.7, room: 'out' },
    { x: 560, y: 1000, s: 0.7, room: 'out' }, { x: 990, y: 1500, s: 0.75, room: 'out' }, { x: 420, y: 1540, s: 0.75, room: 'out' },
  ];
  // assign hats + animations; hide 5 crowns in the safe zone (not under the title / IG buttons)
  const BS = Number(opts.beeScale || 1.2);
  const bees = spots.map((p) => ({ ...p, s: p.s * BS, hat: p.hat ?? HATS[Math.floor(R() * HATS.length)], f: p.f ?? (R() < 0.5 ? 1 : -1), ph: R() * 10, anims: new Set() }));
  const NCROWN = Number(opts.crowns || 5);
  const pool = bees.map((bb, i) => [bb, i]).filter(([bb]) => !bb.sleep && bb.y > 470 && bb.y < 1480 && bb.x > 90 && bb.x < 950 && !(bb.x > 960 && bb.y > 900));
  const crowned = new Set(), usedRooms = new Map(); let guard = 0;
  while (crowned.size < NCROWN && guard++ < 500) { const [bb, i] = pool[Math.floor(R() * pool.length)]; const n = usedRooms.get(bb.room) || 0; if (crowned.has(i) || n >= (bb.room === 'out' ? 2 : 1)) continue; crowned.add(i); usedRooms.set(bb.room, n + 1); }
  bees.forEach((bb, i) => {
    if (crowned.has(i)) bb.hat = 'crown'; else if (bb.hat === 'crown') bb.hat = 'party';
    const A = bb.anims;
    if (bb.sleep) return;
    if (bb.room === 'dance') { A.add(R() < 0.5 ? 'spin' : 'dance'); A.add('dance'); }
    else if (bb.room === 'out' || bb.room === 'pond') { A.add('hover'); if (R() < 0.6) A.add('drift'); if (R() < 0.4) A.add('turn'); }
    else { const pick = ['look', 'hatlift', 'turn', 'spin', 'drift']; A.add(pick[Math.floor(R() * pick.length)]); if (R() < 0.5) A.add(pick[Math.floor(R() * pick.length)]); }
    if (bb.hat !== 'none' && R() < 0.35) A.add('hatlift');
  });
  bees.sort((p, q) => p.y - q.y);

  const title = opts.title || `Only 1% can find the ${NCROWN} royal bees`;
  function header(c) {
    c.save(); c.font = '900 54px Nunito'; c.textBaseline = 'middle'; c.textAlign = 'center';
    const w = Math.min(1000, c.measureText(title).width + 110);
    c.fillStyle = '#ffd84a'; c.strokeStyle = '#2a1a12'; c.lineWidth = 5; c.beginPath(); c.roundRect(540 - w / 2, 262, w, 92, 26); c.fill(); c.stroke();
    c.fillStyle = '#1e140e'; c.fillText(title, 540 - 30, 310);
    c.translate(540 + w / 2 - 52, 310); hat(c, 'crown'); c.restore();
  }

  const duration = Number(opts.dur || 14);
  function renderFrame(t) {
    ctx.drawImage(base, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const g of glows) { const a = 0.32 + (g.tw != null ? 0.14 * Math.sin(t * 2.2 + g.tw) : 0.06 * Math.sin(t * 3 + g.x)); const gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r); gr.addColorStop(0, `rgba(${g.c},${a})`); gr.addColorStop(1, `rgba(${g.c},0)`); ctx.fillStyle = gr; ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2); }
    for (const s of twinkle) { const a = 0.5 + 0.5 * Math.sin(t * (s.firefly ? 2.5 : 1.6) + s.ph); const x = s.x + (s.firefly ? Math.sin(t * 0.7 + s.ph) * 20 : 0), y = s.y + (s.firefly ? Math.cos(t * 0.5 + s.ph) * 14 : 0); const gr = ctx.createRadialGradient(x, y, 0, x, y, s.r * 2); gr.addColorStop(0, s.firefly ? `rgba(220,255,140,${a})` : `rgba(255,255,230,${a * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x - s.r * 2, y - s.r * 2, s.r * 4, s.r * 4); }
    ctx.restore();
    for (const bb of bees) bee(ctx, bb.x, bb.y, bb.s, { ...bb, t });
    header(ctx);
    if (opts.reveal) { ctx.strokeStyle = '#ff2d4a'; ctx.lineWidth = 7; for (const bb of bees) if (bb.hat === 'crown') { ctx.beginPath(); ctx.arc(bb.x, bb.y - 40 * bb.s, 52 * bb.s + 8, 0, TAU); ctx.stroke(); } }
  }
  renderFrame(0);
  return { duration, renderFrame };
}
