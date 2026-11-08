// GUS — code-drawn, rigged adult-cartoon character (thick ink outlines, flat muted colours)
// in a code-drawn motel lobby. Pure vector → crisp at any camera zoom (face / feet close-ups).
// Look test: 4 shots timed to the VO words, real character motion (blink, breathe, scratch,
// eye-roll, toe wiggle, cigar, flies, stink lines, walking roach), reference-style HUD + captions.
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const eo = (k) => 1 - Math.pow(1 - clamp(k), 3);
const eio = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const back = (k) => { k = clamp(k); const s = 1.7; return 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2); };

const INK = '#1d1712';
const C = {
  wall: '#7f8ea3', wallS: '#6c7a8e', floor: '#8e8476', floorS: '#7a7064', tileLine: '#6a6157',
  skin: '#eab48e', skinS: '#d29572', blush: '#e48b78', nose: '#e8836f', noseS: '#cf6b58',
  tank: '#ebe4d2', tankS: '#d3cab3', stain: '#c2a568', stain2: '#a98c55',
  shirt: '#6f97a3', shirtS: '#5b808b', flower: '#e3b08a', flower2: '#f0dcb0',
  shorts: '#8b8269', shortsS: '#756d57', sock: '#ece7da', sockS: '#cfc7b4', dirt: '#a69373',
  sandal: '#3b332c', hair: '#4a3a2e', hairS: '#382b21', teeth: '#e7cf6a', bag: '#a689b0',
  wood: '#8a5f3e', woodS: '#714c30', woodT: '#a07250', brass: '#d9a53b', brassS: '#a97a24',
  cream: '#f3ead2', gold1: '#ffe08a', gold2: '#d39a2c',
};

// ---------- ink helpers
function P(pts, close = true) { // smooth closed/open path through points (quadratic midpoints)
  const p = new Path2D(); const n = pts.length;
  if (close) { p.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2); for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } p.closePath(); }
  else { p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n - 1; i++) { const a = pts[i], b = pts[i + 1]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } p.lineTo(pts[n - 1][0], pts[n - 1][1]); }
  return p;
}
const E = (x, y, rx, ry, r = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, r, 0, TAU); return p; };
const RR = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
function ink(ctx, path, fill, { shade = null, sx = 14, sy = 0, lw = 7 } = {}) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(path); }
  if (shade) { ctx.save(); ctx.clip(path); ctx.translate(sx, sy); ctx.fillStyle = shade; ctx.fill(path, 'evenodd'); ctx.restore(); ctx.save(); ctx.clip(path); ctx.fillStyle = shade; ctx.globalCompositeOperation = 'source-atop'; ctx.translate(-sx * 0, 0); ctx.restore(); }
  if (lw) { ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(path); }
}
// cel shade: fill, then darker band = path minus a shifted copy
function cel(ctx, path, fill, shade, dx = 16, dy = 0, lw = 7) {
  ctx.fillStyle = fill; ctx.fill(path);
  if (shade) { ctx.save(); ctx.clip(path); ctx.fillStyle = shade; ctx.fill(path); ctx.translate(-dx, -dy); ctx.fillStyle = fill; ctx.fill(path); ctx.restore(); }
  if (lw) { ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(path); }
}
function line(ctx, pts, w = 5, col = INK) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(P(pts, false)); }
function dot(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- props
function fly(ctx, x, y, s, t, ph) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const w = Math.sin(t * 70 + ph);
  for (const sd of [-1, 1]) { ctx.save(); ctx.rotate(sd * (0.5 + 0.25 * w)); ink(ctx, E(sd * 9, -13, 9, 13), '#ffffff', { lw: 3 }); ctx.restore(); }
  ink(ctx, E(0, 0, 11, 9), '#2b2622', { lw: 3 }); dot(ctx, -4, -2, 2.5, '#fff');
  ctx.restore();
}
function stink(ctx, x, y, h, t, ph, a = 0.75) {
  ctx.save(); ctx.globalAlpha = a; const pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([x + Math.sin(u * 7 + t * 3 + ph) * 16, y - u * h]); }
  line(ctx, pts, 9, '#93a86a'); ctx.restore();
}
function roach(ctx, x, y, s, t, walk = 1, dir = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
  for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) { const ph = Math.sin(t * 28 * walk + i * 2 + (sd > 0 ? Math.PI : 0)) * 6 * walk; line(ctx, [[-12 + i * 12, sd * 4], [-16 + i * 12 + ph, sd * 16], [-22 + i * 12 + ph, sd * 20]], 3); }
  ink(ctx, E(0, 0, 26, 13), '#6b3d22', { lw: 4 }); ink(ctx, E(22, 0, 9, 9), '#4a2a18', { lw: 4 });
  ctx.strokeStyle = 'rgba(255,220,180,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(-4, -4, 14, 4, 0, Math.PI, TAU); ctx.stroke();
  const an = Math.sin(t * 9) * 4; line(ctx, [[28, -4], [44, -14 + an], [58, -10 + an]], 2.5); line(ctx, [[28, 4], [46, 10 - an], [60, 6 - an]], 2.5);
  ctx.restore();
}

// ---------- the lobby (world = 1080×1920 wide shot)
function lobby(ctx, t, R) {
  // wall + wainscot + stains
  ctx.fillStyle = C.wall; ctx.fillRect(-400, -400, 1880, 1700);
  ctx.fillStyle = C.wallS; ctx.fillRect(-400, 1060, 1880, 240);
  line(ctx, [[-400, 1060], [1480, 1060]], 6);
  for (const [x, y, r] of [[160, 300, 70], [930, 560, 50], [60, 900, 40]]) { ctx.fillStyle = 'rgba(90,80,50,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.4, r, 0.4, 0, TAU); ctx.fill(); }
  // floor tiles
  ctx.fillStyle = C.floor; ctx.fillRect(-400, 1300, 1880, 1000);
  ctx.strokeStyle = C.tileLine; ctx.lineWidth = 4;
  for (let y = 1300; y < 2300; y += 110) { ctx.beginPath(); ctx.moveTo(-400, y); ctx.lineTo(1480, y); ctx.stroke(); }
  for (let x = -400; x < 1480; x += 150) { ctx.beginPath(); ctx.moveTo(x, 1300); ctx.lineTo(x + (x - 540) * 0.4, 2300); ctx.stroke(); }
  line(ctx, [[160, 1520], [200, 1560], [190, 1610], [240, 1640]], 4); line(ctx, [[820, 1700], [860, 1690], [880, 1740]], 4);
  // key board (back wall, left)
  cel(ctx, RR(40, 250, 300, 360, 10), C.wood, C.woodS, 14);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const x = 80 + c * 66, y = 300 + r * 78; dot(ctx, x, y, 5, INK); if ((r * 4 + c) % 3) { line(ctx, [[x, y], [x, y + 24]], 3); ink(ctx, RR(x - 9, y + 22, 18, 26, 4), C.brass, { lw: 3 }); } }
  // framed picture (crooked)
  ctx.save(); ctx.translate(820, 330); ctx.rotate(0.08); cel(ctx, RR(-110, -80, 220, 160, 6), '#b48a5a', '#9a7448', 10); ink(ctx, RR(-88, -60, 176, 120, 4), '#9fb7a6', { lw: 4 }); line(ctx, [[-80, 40], [-30, -10], [10, 25], [50, -20], [85, 40]], 4); ctx.restore();
  // wall clock (stopped)
  ink(ctx, E(560, 200, 70, 70), C.cream, { lw: 7 }); line(ctx, [[560, 200], [560, 155]], 6); line(ctx, [[560, 200], [598, 214]], 6); dot(ctx, 560, 200, 7, INK);
  // counter (right)
  cel(ctx, P([[620, 1150], [1140, 1150], [1140, 1520], [620, 1520]]), C.wood, C.woodS, 18);
  for (const x of [700, 820, 940, 1060]) line(ctx, [[x, 1190], [x, 1500]], 4, C.woodS);
  cel(ctx, RR(600, 1110, 560, 54, 10), C.woodT, C.wood, 0, -10);
  // lamp
  cel(ctx, P([[960, 1110], [990, 1110], [985, 940], [965, 940]]), C.brass, C.brassS, 6);
  const fl = (Math.floor(t * 9) % 11 === 0) ? 0.4 : 1;
  ctx.save(); ctx.globalAlpha = 0.28 * fl; const g = ctx.createRadialGradient(975, 900, 10, 975, 900, 340); g.addColorStop(0, '#ffe7a8'); g.addColorStop(1, 'rgba(255,231,168,0)'); ctx.fillStyle = g; ctx.fillRect(600, 560, 760, 700); ctx.restore();
  cel(ctx, P([[900, 950], [1050, 950], [1020, 830], [930, 830]]), fl > 0.5 ? '#f4dc9a' : '#cdb57c', '#dcc07a', 10);
  // ashtray + butts, mug, pizza box
  ink(ctx, E(700, 1112, 54, 16), '#9aa1a8', { lw: 5 }); for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(670 + i * 14, 1100); ctx.rotate(-0.6 + i * 0.3); ink(ctx, RR(-3, -18, 7, 22, 2), i % 2 ? '#e8d9b8' : '#d9a463', { lw: 2.5 }); ctx.restore(); }
  stink(ctx, 700, 1090, 120, t, 1.1, 0.45);
  cel(ctx, RR(1050, 1040, 56, 72, 8), C.cream, '#ddd2b6', 8); ctx.fillStyle = C.stain2; ctx.fillRect(1054, 1056, 48, 10); line(ctx, [[1106, 1060], [1124, 1066], [1124, 1090], [1106, 1094]], 6);
  ctx.save(); ctx.translate(1000, 1490); ctx.rotate(-0.04); cel(ctx, RR(-130, -40, 260, 40, 6), '#d8c39c', '#c2ab82', 0, -8); ctx.fillStyle = '#c0703c'; ctx.beginPath(); ctx.ellipse(-30, -38, 40, 9, 0, 0, TAU); ctx.fill(); ctx.restore();
  // trash + crumpled paper on the floor
  cel(ctx, P([[40, 1480], [180, 1480], [165, 1680], [55, 1680]]), '#7d858c', '#68707a', 12);
  for (const [x, y] of [[90, 1460], [140, 1455], [230, 1690], [900, 1760]]) cel(ctx, P([[x - 22, y], [x - 8, y - 20], [x + 16, y - 16], [x + 24, y + 6], [x + 4, y + 18], [x - 18, y + 14]]), '#ece6d6', '#d4ccb8', 6, 0, 4);
}
function bell(ctx, x, y, s, ding) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(0, ding * 3);
  cel(ctx, RR(-48, -10, 96, 18, 6), '#3a332c', '#2a241f', 0, -6, 5);
  cel(ctx, P([[-40, -10], [-36, -42], [-18, -60], [18, -60], [36, -42], [40, -10]]), C.brass, C.brassS, 12, 0, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-16, -42, 6, 12, 0.4, 0, TAU); ctx.fill();
  cel(ctx, RR(-6, -78 + ding * 6, 12, 20, 4), C.brass, C.brassS, 4, 0, 4);
  ctx.restore();
}

// ---------- GUS (origin = between the feet, ~1300 px tall at s = 1)
function gus(ctx, x, y, s, t, o = {}) {
  const br = Math.sin(t * 2.2) * 6;            // breathing
  const blink = o.blink ?? (((t + 0.7) % 3.7) < 0.13);
  const look = o.look ?? 0;                    // −1 left … 1 right (eyes)
  const roll = o.roll ?? 0;                    // 0..1 eye-roll up
  const scratch = o.scratch ?? 1;              // right hand scratching belly
  const toe = o.toe ?? 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(0, 6, 300, 38, 0, 0, TAU); ctx.fill();
  // legs
  for (const sd of [-1, 1]) {
    cel(ctx, P([[sd * 150 - 55, -330], [sd * 150 + 55, -330], [sd * 140 + 48, -150], [sd * 140 - 48, -150]]), C.skin, C.skinS, sd * 14);
    for (let i = 0; i < 7; i++) line(ctx, [[sd * 150 - 30 + i * 9, -300 + (i % 3) * 30], [sd * 150 - 26 + i * 9, -282 + (i % 3) * 30]], 3);
    // sock
    cel(ctx, P([[sd * 140 - 52, -175], [sd * 140 + 52, -175], [sd * 142 + 54, -40], [sd * 138 - 54, -40]]), C.sock, C.sockS, sd * 10);
    for (let i = 0; i < 3; i++) line(ctx, [[sd * 140 - 46, -150 + i * 18], [sd * 140 + 44, -146 + i * 18]], 3, C.sockS);
    ctx.fillStyle = C.dirt; for (const [dx, dy, r] of [[-20, -90, 12], [18, -70, 9], [0, -120, 7]]) { ctx.beginPath(); ctx.ellipse(sd * 140 + dx, dy, r * 1.3, r, 0.3, 0, TAU); ctx.fill(); }
    // flip-flop + toes (wiggle)
    cel(ctx, RR(sd * 140 - 78, -26, 156, 30, 14), C.sandal, '#2a241f', 0, -6, 6);
    ctx.save(); ctx.translate(sd * 140, -34); for (let i = 0; i < 4; i++) { const w = Math.sin(t * 10 + i * 0.9) * 5 * toe; ink(ctx, E(-36 + i * 22 * 1, -6 + w * (i % 2 ? 1 : -1) * 0.6, 12, 10), C.sock, { lw: 4 }); } ctx.restore();
    line(ctx, [[sd * 140 - 40, -24], [sd * 140, -44], [sd * 140 + 40, -24]], 7, '#5a4d40');
  }
  // shorts
  cel(ctx, P([[-250, -470], [250, -470], [260, -300], [30, -290], [0, -330], [-30, -290], [-260, -300]]), C.shorts, C.shortsS, 18);
  line(ctx, [[-180, -440], [-150, -330]], 4, C.shortsS); line(ctx, [[180, -440], [150, -330]], 4, C.shortsS);
  ctx.save(); ctx.translate(0, br * 0.4);
  // open Hawaiian shirt (back panels)
  cel(ctx, P([[-290, -900], [290, -900], [330, -620], [300, -420], [-300, -420], [-330, -620]]), C.shirt, C.shirtS, 20);
  // tank top + belly
  const belly = P([[-200, -900], [200, -900], [255, -720], [275, -560], [240, -440], [120, -395], [-120, -395], [-240, -440], [-275, -560], [-255, -720]]);
  cel(ctx, belly, C.tank, C.tankS, 22, 0, 7);
  // belly skin showing below the tank top
  ctx.save(); ctx.clip(belly); cel(ctx, E(0, -425, 230, 70), C.skin, C.skinS, 14, 0, 6); dot(ctx, 0, -440, 9, C.skinS); line(ctx, [[-8, -446], [0, -436], [8, -446]], 3);
  for (let i = 0; i < 9; i++) line(ctx, [[-60 + i * 15, -470 + (i % 2) * 8], [-56 + i * 15, -458 + (i % 2) * 8]], 3); ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(belly);
  // stains + holes
  ctx.fillStyle = C.stain; for (const [sx2, sy2, r] of [[-90, -720, 34], [60, -640, 26], [-30, -560, 40], [110, -800, 18]]) { ctx.beginPath(); ctx.ellipse(sx2, sy2, r * 1.3, r, 0.5, 0, TAU); ctx.fill(); }
  ctx.fillStyle = C.stain2; ctx.beginPath(); ctx.ellipse(-30, -560, 18, 12, 0.3, 0, TAU); ctx.fill();
  ink(ctx, P([[150, -760], [168, -740], [158, -715], [138, -730]]), C.skin, { lw: 4 });
  // shirt front panels with flowers
  for (const sd of [-1, 1]) {
    const pnl = P([[sd * 200, -905], [sd * 300, -900], [sd * 330, -620], [sd * 305, -420], [sd * 255, -420], [sd * 270, -600], [sd * 230, -760]]);
    cel(ctx, pnl, C.shirt, C.shirtS, sd * 12);
    ctx.save(); ctx.clip(pnl); for (const [fx, fy] of [[260, -820], [295, -660], [272, -500]]) { for (let k = 0; k < 5; k++) { const a = k * TAU / 5; ink(ctx, E(sd * fx + Math.cos(a) * 16, fy + Math.sin(a) * 16, 12, 9, a), C.flower, { lw: 3 }); } dot(ctx, sd * fx, fy, 7, C.flower2); } ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(pnl);
  }
  // arms
  // left arm hanging, slight sway
  const sw = Math.sin(t * 1.3) * 0.04;
  ctx.save(); ctx.translate(-300, -860); ctx.rotate(0.12 + sw);
  cel(ctx, P([[-60, -20], [60, -20], [64, 120], [-62, 120]]), C.shirt, C.shirtS, -10);
  cel(ctx, P([[-44, 110], [44, 110], [38, 380], [-36, 380]]), C.skin, C.skinS, -10);
  for (let i = 0; i < 6; i++) line(ctx, [[-20 + i * 8, 180 + (i % 2) * 40], [-17 + i * 8, 194 + (i % 2) * 40]], 3);
  cel(ctx, E(0, 410, 46, 52), C.skin, C.skinS, -8); line(ctx, [[-20, 430], [-22, 456]], 4); line(ctx, [[0, 438], [0, 462]], 4); line(ctx, [[20, 430], [22, 456]], 4);
  ctx.restore();
  // right arm: shoulder → elbow fixed-ish, hand scratching the belly in small circles
  const sa = t * 11, sc = scratch;
  const hx = 150 + Math.cos(sa) * 26 * sc, hy = -600 + Math.sin(sa) * 18 * sc;
  const shx = 300, shy = -860, ex = 360, ey = -660;
  cel(ctx, P([[shx - 60, shy - 20], [shx + 62, shy - 10], [ex + 50, ey + 10], [ex - 50, ey + 20]]), C.shirt, C.shirtS, 10);
  const fa = Math.atan2(hy - ey, hx - ex), nx = Math.cos(fa + Math.PI / 2) * 40, ny = Math.sin(fa + Math.PI / 2) * 40;
  cel(ctx, P([[ex + nx, ey + ny], [hx + nx * 0.8, hy + ny * 0.8], [hx - nx * 0.8, hy - ny * 0.8], [ex - nx, ey - ny]]), C.skin, C.skinS, 8);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(fa); cel(ctx, E(14, 0, 48, 40), C.skin, C.skinS, 6);
  for (const k of [-20, -4, 12]) line(ctx, [[30, k], [58 + Math.sin(sa * 2) * 6 * sc, k + 4]], 6); ctx.restore();
  ctx.restore();
  // ---------- head
  const hb = br * 0.6;
  ctx.save(); ctx.translate(0, -1095 + hb); ctx.rotate(Math.sin(t * 0.9) * 0.03 + (o.tilt || 0));
  cel(ctx, P([[-120, 120], [120, 120], [140, 210], [-140, 210]]), C.skin, C.skinS, 12); // neck/chins
  // ears
  for (const sd of [-1, 1]) { cel(ctx, E(sd * 195, 20, 36, 50), C.skin, C.skinS, sd * 8); line(ctx, [[sd * 190, 0], [sd * 205, 20], [sd * 192, 42]], 4); }
  const head = P([[-180, -150], [-90, -215], [0, -228], [90, -215], [180, -150], [205, -20], [195, 90], [150, 175], [60, 215], [0, 222], [-60, 215], [-150, 175], [-195, 90], [-205, -20]]);
  cel(ctx, head, C.skin, C.skinS, 22, 0, 8);
  // stubble
  ctx.save(); ctx.clip(head); const Rr = rnd(5); for (let i = 0; i < 120; i++) { const a = Math.PI * (0.1 + 0.8 * Rr()), r = 120 + Rr() * 95; const x = Math.cos(a) * r, y = 60 + Math.sin(a) * r * 0.75; if (Math.abs(x) < 70 && y < 95) continue; line(ctx, [[x, y], [x + 3, y + 11]], 3); } ctx.restore();
  // comb-over + side hair
  for (const sd of [-1, 1]) cel(ctx, P([[sd * 205, -60], [sd * 215, -140], [sd * 175, -170], [sd * 160, -80], [sd * 185, 10]]), C.hair, C.hairS, sd * 6, 0, 6);
  cel(ctx, P([[-185, -130], [-110, -205], [10, -232], [130, -215], [190, -150], [120, -180], [20, -195], [-90, -170]]), C.hair, C.hairS, 8, 0, 6);
  for (let i = 0; i < 4; i++) line(ctx, [[-150 + i * 70, -170 + i * -8], [-40 + i * 70, -205 + i * 2]], 3, C.hairS);
  // pimples
  for (const [px, py, r] of [[-120, -60, 11], [130, -90, 9], [150, 60, 12], [-140, 90, 10], [80, -150, 8], [-60, 140, 9], [100, 130, 8]]) { ink(ctx, E(px, py, r, r), '#e05a4c', { lw: 3 }); dot(ctx, px - r * 0.3, py - r * 0.35, r * 0.3, '#ffd2c2'); }
  // eyes: droopy, bags, lids
  for (const sd of [-1, 1]) {
    const ex2 = sd * 78, ey2 = -20;
    ink(ctx, E(ex2, ey2 + 36, 58, 26), C.bag, { lw: 0 });
    const eye = E(ex2, ey2, 56, 42);
    ink(ctx, eye, '#fbf6e8', { lw: 6 });
    ctx.save(); ctx.clip(eye);
    const px2 = ex2 + look * 18, py2 = ey2 + 10 - roll * 40;
    dot(ctx, px2, py2, 17, INK); dot(ctx, px2 - 5, py2 - 6, 5, '#fff');
    // heavy upper lid (droopy); full close on blink
    const lid = blink ? 1 : 0.52 - roll * 0.25;
    ctx.fillStyle = C.skin; ctx.fillRect(ex2 - 70, ey2 - 60, 140, 60 + 84 * lid - 42);
    ctx.restore();
    line(ctx, [[ex2 - 58, ey2 - 42 + 84 * (blink ? 1 : 0.52 - roll * 0.25) - 42 + 20], [ex2, ey2 - 42 + 84 * (blink ? 1 : 0.52 - roll * 0.25) - 42 + 16], [ex2 + 58, ey2 - 42 + 84 * (blink ? 1 : 0.52 - roll * 0.25) - 42 + 20]], 8);
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(eye);
    // brows
    line(ctx, [[ex2 - sd * 50, ey2 - 70 - roll * 8], [ex2 + sd * 10, ey2 - 82 - roll * 10], [ex2 + sd * 62, ey2 - 66 - roll * 8]], 13, C.hairS);
  }
  // nose
  cel(ctx, P([[-30, 20], [30, 20], [62, 70], [40, 110], [0, 118], [-40, 110], [-62, 70]]), C.nose, C.noseS, 12, 0, 7);
  for (const [nx2, ny2] of [[-20, 70], [14, 60], [26, 90], [-6, 96]]) dot(ctx, nx2, ny2, 4, C.noseS);
  dot(ctx, -22, 50, 9, 'rgba(255,255,255,0.5)');
  // mouth: crooked, yellow teeth with a gap, cigar
  const chew = Math.sin(t * 3.1) * 4;
  const mouth = P([[-80, 150 + chew * 0.3], [-10, 140], [70, 146], [84, 165], [10, 182 + chew], [-70, 176]]);
  ink(ctx, mouth, '#5a2626', { lw: 6 });
  ctx.save(); ctx.clip(mouth); ctx.fillStyle = C.teeth; for (const tx of [-58, -30, 2, 42]) { ctx.fillRect(tx, 140, 24, 22); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(tx, 140, 24, 22); } ctx.restore();
  // cigar (bobs with chewing)
  ctx.save(); ctx.translate(70, 162 + chew); ctx.rotate(0.22 + Math.sin(t * 1.7) * 0.05);
  cel(ctx, RR(0, -14, 150, 28, 12), '#8a5a35', '#6e4527', 0, -6, 6); ctx.fillStyle = '#c8b9a4'; ctx.fillRect(138, -12, 12, 24); line(ctx, [[30, -14], [30, 14]], 3, '#e3b24a');
  ctx.restore();
  ctx.restore();
  ctx.restore();
}

// ---------- reference-style HUD + captions
function hud(ctx, day = '01', left = '30') {
  ctx.save(); ctx.textBaseline = 'alphabetic';
  ctx.font = '900 34px Nunito'; ctx.fillStyle = C.cream; ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  ctx.strokeText('DAY', 100, 300); ctx.fillText('DAY', 100, 300);
  ctx.font = '900 120px Nunito'; const g = ctx.createLinearGradient(0, 300, 0, 410); g.addColorStop(0, C.gold1); g.addColorStop(1, C.gold2);
  ctx.lineWidth = 14; ctx.strokeText(day, 92, 410); ctx.fillStyle = g; ctx.fillText(day, 92, 410);
  ctx.font = '900 132px Nunito'; ctx.textAlign = 'right'; ctx.lineWidth = 14; ctx.strokeText(left, 800, 400); ctx.fillStyle = C.cream; ctx.fillText(left, 800, 400);
  ctx.textAlign = 'left'; ctx.font = '900 36px Nunito'; ctx.lineWidth = 7; for (const [s, yy] of [['DAYS', 335], ['LEFT', 375]]) { ctx.strokeText(s, 815, yy); ctx.fillText(s, 815, yy); }
  ctx.restore();
}
function caption(ctx, txt, y, t0, t, size = 70) {
  const k = t - t0; if (k < 0) return; const s = back(k / 0.22);
  ctx.save(); ctx.translate(540, y); ctx.scale(s, s); ctx.font = `900 ${size}px Nunito`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowOffsetY = 7; ctx.shadowBlur = 0; ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.strokeText(txt, 0, 0);
  ctx.shadowColor = 'transparent'; ctx.fillStyle = C.cream; ctx.fillText(txt, 0, 0); ctx.restore();
}

// ---------- the look-test edit
export const VO = { g1: 0.3, g2: 3.35, g3: 5.75, g4: 8.45 };
const SH = [0, 3.2, 5.6, 8.3, 11.8];
export async function create(stage) {
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; stage.appendChild(cv);
  const ctx = cv.getContext('2d');
  const W = {}; for (const k of Object.keys(VO)) W[k] = (await (await fetch(`/assets/hotel/vo/${k}.json`)).json()).map((w) => ({ ...w, t: w.t + VO[k], e: w.e + VO[k], w: w.w.replace(/[.?!,]+$/, '') }));
  const R = rnd(3);
  const flies = Array.from({ length: 4 }, (_, i) => ({ r: 230 + R() * 60, sp: 1.6 + R(), p: i * 1.57, h: R() * 120 }));
  const GX = 400, GY = 1820, GS = 0.98; // Gus placement in the wide shot (world coords)

  function world(t, o) {
    lobby(ctx, t, R);
    // roach: on the bell at 0 (presses it), then walks along the counter
    const rk = clamp((t - 0.35) / 2.6);
    const rx = lerp(860, 1040, rk), ry = 1060 - (t < 0.35 ? 28 : 0);
    bell(ctx, 860, 1110, 1.1, t < 0.2 ? 1 - t / 0.2 : 0);
    roach(ctx, t < 0.35 ? 860 : rx, t < 0.35 ? 1028 : 1100, 1.1, t, t < 0.35 ? 0 : 1, 1);
    gus(ctx, GX, GY, GS, t, o);
    for (const f of flies) { const a = t * f.sp + f.p; fly(ctx, GX + Math.cos(a) * f.r, GY - 1150 - f.h + Math.sin(a * 1.3) * 90, 1.3, t, f.p); }
    for (const [dx, ph] of [[-260, 0], [270, 1.7], [-300, 3.1]]) stink(ctx, GX + dx, GY - 950, 220, t, ph);
  }
  function cam(z, cx, cy) { ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-cx, -cy); }

  function renderFrame(t) {
    ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1080, 1920);
    let o = { scratch: 1, toe: 0, roll: 0, look: 0 };
    let shake = t < 0.2 ? (1 - t / 0.2) * 8 : 0;
    ctx.save(); if (shake) ctx.translate(Math.sin(t * 90) * shake, 0);
    if (t < SH[1]) { // A: ECU bell+roach → pull out to the wide lobby
      const k = eio((t - 0.15) / 1.1); cam(lerp(3.2, 1.0, k) + t * 0.01, lerp(870, 560, k), lerp(1060, 1000, k));
      o.scratch = t > 1.4 ? 1 : 0; world(t, o);
    } else if (t < SH[2]) { // B: punch-in on Gus' face; eye-roll to camera on "owner"
      const lt = t - SH[1]; const owner = W.g2.find((w) => w.w === 'owner').t;
      o.roll = t > owner ? eo((t - owner) / 0.25) * 0.9 : 0; o.look = t > owner - 0.4 ? 0.6 : -0.3; o.scratch = 0.6;
      cam(2.35 + lt * 0.06, GX + 10, GY - 1090 * GS + 40); world(t, o);
    } else if (t < SH[3]) { // C: feet close-up, toes wiggle on "socks", roach scurries past
      const lt = t - SH[2]; o.toe = t > W.g3[2].t ? 1 : 0.2;
      cam(2.2 + lt * 0.05, GX, GY - 140); world(t, o);
      roach(ctx, lerp(820, 120, clamp((lt - 0.6) / 1.4)), GY - 30, 1.0, t, 1, -1);
    } else { // D: medium shot, big scratch, flies, "2019" stamp
      const lt = t - SH[3]; o.scratch = 1.4;
      cam(1.35 - lt * 0.02, GX + 60, GY - 700); world(t, o);
    }
    ctx.restore();
    hud(ctx);
    // captions (2–3 words, synced)
    const all = Object.values(W).flat(); const cur = all.filter((w) => t >= w.t - 0.03 && t < w.e + 0.25); if (cur.length) {
      const w = cur[cur.length - 1]; const line2 = Object.values(W).find((l) => l.includes(w)); const i = line2.indexOf(w); const g0 = Math.floor(i / 3) * 3;
      caption(ctx, line2.slice(g0, i + 1).map((x) => x.w).join(' '), 1340, line2[g0].t - 0.03, t);
    }
    if (t > W.g4[2].t) { // "2019" stamp
      const k = t - W.g4[2].t; ctx.save(); ctx.translate(760, 1000); ctx.rotate(-0.15); const s = back(k / 0.25); ctx.scale(s, s);
      ctx.font = '900 120px Nunito'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.strokeText('2019', 0, 0); ctx.fillStyle = '#9fd36a'; ctx.fillText('2019', 0, 0); ctx.restore();
    }
    ctx.restore();
  }
  renderFrame(0);
  return { duration: SH[4], renderFrame };
}
