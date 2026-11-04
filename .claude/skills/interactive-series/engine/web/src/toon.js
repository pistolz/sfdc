// "Toon" art kit: cel-shaded characters with a rig, original creatures and illustrated
// backgrounds (sunset sky, perspective grass field with depth of field, interiors, gym).
import { circle, rand, clamp, lerp, easeOut } from './draw.js';

const OUT = '#2a1f23';            // outline colour
const LW = 4;                      // outline width at scale 1

// ------------------------------------------------------------------ cel shading helpers
/** Fill a path with a base colour, a shade band (path minus a shifted copy) and an outline. */
function cel(ctx, path, base, shade, { dx = 10, dy = 0, line = true, rim = null } = {}) {
  ctx.fillStyle = base; ctx.fill(path);
  if (shade) {
    ctx.save(); ctx.clip(path);
    ctx.fillStyle = shade; ctx.fill(path);
    ctx.translate(dx, dy); ctx.fillStyle = base; ctx.fill(path);
    ctx.restore();
  }
  if (rim) { ctx.save(); ctx.clip(path); ctx.translate(-dx * 0.6, -dy * 0.6 - 3); ctx.strokeStyle = rim; ctx.lineWidth = 4; ctx.stroke(path); ctx.restore(); }
  if (line) { ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.lineJoin = 'round'; ctx.stroke(path); }
}
function capsule(x1, y1, x2, y2, r1, r2 = r1) {
  const p = new Path2D(); const a = Math.atan2(y2 - y1, x2 - x1), n = a + Math.PI / 2;
  p.moveTo(x1 + Math.cos(n) * r1, y1 + Math.sin(n) * r1);
  p.lineTo(x2 + Math.cos(n) * r2, y2 + Math.sin(n) * r2);
  p.arc(x2, y2, r2, n, n + Math.PI, true);
  p.lineTo(x1 - Math.cos(n) * r1, y1 - Math.sin(n) * r1);
  p.arc(x1, y1, r1, n + Math.PI, n, true);
  p.closePath(); return p;
}
function ell(x, y, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; }
function roundRect(x, y, w, h, r) { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; }
function poly(pts, close = true) { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); if (close) p.closePath(); return p; }
function smoothShape(pts) {
  // closed Catmull-Rom → Bézier through points
  const p = new Path2D(); const n = pts.length;
  p.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
  p.closePath(); return p;
}

// ------------------------------------------------------------------ palettes
export const LOOKS = {
  leo: { skin: '#e9b896', skinS: '#cf9473', hair: '#5a3a26', hairS: '#3e2718', top: '#8a8f9c', topS: '#6e7380', pants: '#2f3442', pantsS: '#222632', shoe: '#e8e4dc', shoeS: '#bdb8ae', band: '#6e7380', strings: '#d8dbe2', stain: 'rgba(120,80,40,0.55)' },
  hero: { skin: '#f6caa8', skinS: '#e3a684', hair: '#4a3026', hairS: '#33201a', top: '#26324f', topS: '#1a2440', pants: '#3e5174', pantsS: '#2c3a58', shoe: '#f2f2f2', shoeS: '#c9ccd4', band: '#d8443b', strings: '#e9e9ee' },
  girl: { skin: '#f7cfb0', skinS: '#e6ab8a', hair: '#7a4528', hairS: '#5a3019', top: '#4f7a3b', topS: '#3b5e2b', pants: '#4a3a33', pantsS: '#382b25', shoe: '#7a4b2a', shoeS: '#5a361d', band: '#c9a35a', strings: '#efe6d4', long: true },
  stranger: { skin: '#e9b896', skinS: '#cf9473', hair: '#1f1b22', hairS: '#121014', top: '#8a5530', topS: '#6a3f22', pants: '#3a3030', pantsS: '#2a2222', shoe: '#2a2222', shoeS: '#1a1515', band: '#5a4632', strings: '#c9d2e6', coat: true, hat: '#4a3528' },
};

// ------------------------------------------------------------------ the rigged character
/**
 * opts: { look, view: 'front'|'back', mood: neutral|happy|angry|sad|shock|smirk, talk (0..1 mouth open),
 *         blink (bool), armL/armR: [shoulder°, elbow°] (0 = hanging), lookX, headTilt (rad), breathe }
 * Origin = between the feet. Height ≈ 640 at scale 1.
 */
export function toonPerson(ctx, t, o = {}) {
  const c = { ...LOOKS.hero, ...(typeof o.look === 'string' ? LOOKS[o.look] : o.look || {}) };
  const back = o.view === 'back';
  const br = Math.sin(t * 2.1 + (o.phase || 0)) * 3 * (o.breathe ?? 1);
  ctx.save();
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(0, 4, 120, 18, 0, 0, Math.PI * 2); ctx.fill();

  // --- legs
  const hipY = -210;
  for (const s of [-1, 1]) {
    cel(ctx, roundRect(s * 44 - 30, hipY, 60, 200, 22), c.pants, c.pantsS, { dx: s * 8 });
    cel(ctx, smoothShape([[s * 44 - 40, -14], [s * 44 + 40 + s * 10, -14], [s * 44 + 46 + s * 10, 6], [s * 44 - 44, 8]]), c.shoe, c.shoeS, { dy: 6 });
  }
  // --- coat tails (stranger)
  if (c.coat) cel(ctx, poly([[-110, -370], [110, -370], [128, -110], [-128, -110]]), c.top, c.topS, { dx: 14 });

  // --- torso (hoodie) with breathing
  ctx.save(); ctx.translate(0, br);
  const torso = smoothShape([[-104, -395], [104, -395], [116, -330], [102, -200], [-102, -200], [-116, -330]]);
  // arms behind torso when hanging on the far side? draw arms after torso for simplicity
  cel(ctx, torso, c.top, c.topS, { dx: 14, rim: 'rgba(255,255,255,0.12)' });
  if (!back) {
    // hood collar + zip / strings / pocket
    cel(ctx, smoothShape([[-70, -398], [70, -398], [56, -360], [0, -342], [-56, -360]]), c.topS, null);
    if (c.coat) {
      cel(ctx, poly([[-40, -392], [40, -392], [26, -210], [-26, -210]]), '#9fb1cf', '#7e8fae', { dx: 8 });
      cel(ctx, poly([[-104, -395], [-36, -392], [-20, -300], [-70, -250]]), c.top, c.topS, { dx: 6 });
      cel(ctx, poly([[104, -395], [36, -392], [20, -300], [70, -250]]), c.top, c.topS, { dx: -6 });
      ctx.fillStyle = '#2a1f1a'; ctx.fillRect(-104, -232, 208, 22);
      ctx.strokeStyle = '#c9a35a'; ctx.lineWidth = 4; ctx.strokeRect(-16, -236, 32, 30);
    } else {
      ctx.strokeStyle = c.strings; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 20, -362); ctx.lineTo(s * 24, -300); ctx.stroke(); circle(ctx, s * 24, -296, 5, c.strings); }
      cel(ctx, roundRect(-70, -275, 140, 58, 18), c.topS, null, { line: true });
      if (c.stain) { ctx.fillStyle = c.stain; for (const [sx2, sy2, r2] of [[-50, -330, 16], [40, -250, 12], [62, -360, 9], [-20, -228, 8]]) { ctx.beginPath(); ctx.ellipse(sx2, sy2, r2 * 1.3, r2, 0.4, 0, Math.PI * 2); ctx.fill(); } }
    }
  } else {
    cel(ctx, smoothShape([[-80, -400], [80, -400], [70, -330], [0, -300], [-70, -330]]), c.topS, null); // hood on the back
  }
  ctx.restore();

  // --- arms (shoulder → elbow → hand), angles in degrees, 0 = hanging down
  const arm = (s, ang) => {
    const [a1, a2] = ang || [0, 0];
    const sx = s * 100, sy = -372 + br;
    const r1 = ((a1 * s) + 90) * Math.PI / 180, ex = sx + Math.cos(r1) * 92 * 1 + s * 6, ey = sy + Math.sin(r1) * 92;
    const r2 = r1 + (a2 * s) * Math.PI / 180, hx = ex + Math.cos(r2) * 86, hy = ey + Math.sin(r2) * 86;
    cel(ctx, capsule(sx, sy, ex, ey, 30, 26), c.top, c.topS, { dx: s * 6 });
    cel(ctx, capsule(ex, ey, hx, hy, 26, 22), c.top, c.topS, { dx: s * 6 });
    if (!c.coat) { ctx.save(); ctx.translate(hx, hy); ctx.rotate(r2 - Math.PI / 2); cel(ctx, roundRect(-24, -14, 48, 16, 6), c.band, null); ctx.restore(); }
    cel(ctx, ell(hx + Math.cos(r2) * 14, hy + Math.sin(r2) * 14, 22, 24), c.skin, c.skinS, { dx: s * 4 });
  };
  arm(-1, o.armL); arm(1, o.armR);

  // --- head
  ctx.save(); ctx.translate(0, -400 + br); ctx.rotate(o.headTilt || 0);
  const lx = (o.lookX || 0) * 8;
  // neck
  cel(ctx, roundRect(-26, -30, 52, 40, 12), c.skin, c.skinS, { dx: 6 });
  // back hair (long hair / back view)
  if (c.long) for (const sd of [-1, 1]) cel(ctx, smoothShape([[sd * 70, -230], [sd * 128, -170], [sd * 138, -40], [sd * 128, 70], [sd * 92, 80], [sd * 96, -60], [sd * 80, -170]]), c.hair, c.hairS, { dx: sd * 10 });
  if (back) {
    for (const s2 of [-1, 1]) cel(ctx, ell(s2 * 104, -120, 18, 26), c.skin, c.skinS, { dx: s2 * 4 });
    cel(ctx, smoothShape([[-100, -228], [100, -228], [106, -120], [84, -46], [40, -22], [-40, -22], [-84, -46], [-106, -120]]), c.skin, c.skinS, { dx: 12 });
  }
  if (!back) {
    // ears
    for (const s of [-1, 1]) cel(ctx, ell(s * 104, -120, 18, 26), c.skin, c.skinS, { dx: s * 4 });
    // face
    const face = smoothShape([[-100, -228], [100, -228], [106, -120], [84, -46], [40, -18], [-40, -18], [-84, -46], [-106, -120]]);
    cel(ctx, face, c.skin, c.skinS, { dx: 14, rim: 'rgba(255,255,255,0.18)' });
    // blush
    ctx.fillStyle = 'rgba(255,120,120,0.28)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 58, -76, 20, 11, 0, 0, Math.PI * 2); ctx.fill(); }
    // eyes
    const blink = o.blink !== false && ((t + (o.phase || 0)) % 3.9) < 0.12;
    const mood = o.mood || 'neutral';
    for (const s of [-1, 1]) {
      const x = s * 40 + lx, y = -112;
      ctx.strokeStyle = OUT; ctx.lineCap = 'round';
      if (blink || mood === 'happy') { ctx.lineWidth = 6; ctx.beginPath(); if (mood === 'happy' && !blink) ctx.arc(x, y + 6, 13, Math.PI * 1.15, Math.PI * 1.85); else { ctx.moveTo(x - 13, y); ctx.lineTo(x + 13, y); } ctx.stroke(); }
      else {
        const ry = mood === 'shock' ? 17 : mood === 'smirk' ? 9 : 14;
        ctx.fillStyle = '#1e1a22'; ctx.beginPath(); ctx.ellipse(x, y, 10, ry, 0, 0, Math.PI * 2); ctx.fill();
        circle(ctx, x + 3, y - ry * 0.4, 3.6, '#ffffff');
        if (mood === 'smirk') { ctx.fillStyle = c.skin; ctx.fillRect(x - 14, y - ry - 4, 28, 8); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 13, y - 5); ctx.lineTo(x + 13, y - 5); ctx.stroke(); }
      }
      // brows
      ctx.strokeStyle = c.hairS; ctx.lineWidth = 8; ctx.beginPath();
      const by = y - 32; const tilt = mood === 'angry' ? 10 : mood === 'sad' ? -9 : mood === 'shock' ? -4 : mood === 'smirk' ? (s > 0 ? -6 : 4) : 0;
      ctx.moveTo(x - 18, by - (s > 0 ? -tilt : tilt) * 0.6 + (mood === 'shock' ? -8 : 0)); ctx.lineTo(x + 18, by + (s > 0 ? -tilt : tilt) * 0.6 + (mood === 'shock' ? -8 : 0)); ctx.stroke();
    }
    // nose
    ctx.strokeStyle = c.skinS; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(lx + 2, -86); ctx.lineTo(lx - 4, -72); ctx.lineTo(lx + 4, -70); ctx.stroke();
    // mouth (talk = 0..1 opening)
    const talk = clamp(o.talk || 0);
    ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const my = -48;
    if (talk > 0.08 || mood === 'shock') { const oh = mood === 'shock' ? 14 : 4 + talk * 12; ctx.fillStyle = '#6a2a2a'; ctx.beginPath(); ctx.ellipse(lx, my, 11 + talk * 3, oh, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e57373'; ctx.beginPath(); ctx.ellipse(lx, my + oh * 0.45, 7, oh * 0.35, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (mood === 'happy') { ctx.beginPath(); ctx.arc(lx, my - 10, 16, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    else if (mood === 'sad' || mood === 'angry') { ctx.beginPath(); ctx.arc(lx, my + 12, 13, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); }
    else if (mood === 'smirk') { ctx.beginPath(); ctx.moveTo(lx - 14, my); ctx.quadraticCurveTo(lx + 4, my + 6, lx + 18, my - 8); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(lx - 10, my); ctx.lineTo(lx + 10, my); ctx.stroke(); }
  }
  // front hair: messy spikes
  const R = rand(c.long ? 11 : 7);
  const hairPts = [];
  const nSp = 9;
  for (let i = 0; i <= nSp; i++) {
    const a = Math.PI + (i / nSp) * Math.PI;
    const r = 118 + (i % 2 ? 26 + R() * 18 : -6);
    hairPts.push([Math.cos(a) * r * 1.0, -138 + Math.sin(a) * r * 0.95]);
  }
  if (!back) { hairPts.push([96, -150], [60, -168], [40, -150], [12, -178], [-14, -150], [-46, -172], [-70, -146], [-100, -150]); }
  else hairPts.push([104, -96], [70, -58], [40, -78], [10, -50], [-22, -76], [-56, -52], [-88, -80], [-106, -100]);
  cel(ctx, smoothShape(hairPts), c.hair, c.hairS, { dx: 12, rim: 'rgba(255,255,255,0.14)' });
  // hair shine
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(-30, -200, 40, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
  // hat
  if (c.hat && !o.noHat) {
    cel(ctx, ell(0, -214, 150, 30), c.hat, '#2f2219', { dy: 6 });
    cel(ctx, smoothShape([[-86, -214], [86, -214], [72, -300], [0, -312], [-72, -300]]), c.hat, '#2f2219', { dx: 10 });
    ctx.fillStyle = '#1e1612'; ctx.fillRect(-84, -240, 168, 18);
    if (o.shadowFace) {
      // hat shadow over the whole face, fading out at the chin
      const sg = ctx.createLinearGradient(0, -210, 0, -20); sg.addColorStop(0, 'rgba(12,6,10,0.95)'); sg.addColorStop(0.7, 'rgba(12,6,10,0.88)'); sg.addColorStop(1, 'rgba(12,6,10,0.35)');
      ctx.fillStyle = sg; ctx.fill(smoothShape([[-104, -214], [104, -214], [108, -120], [86, -44], [40, -16], [-40, -16], [-86, -44], [-108, -120]]));
    }
  }
  ctx.restore();
  ctx.restore();
}

// ------------------------------------------------------------------ original creatures
/** kind: 'emberkit' (fire fox), 'bubbit' (water blob), 'stinger' (wasp), 'woolly' (fluffy sheep-ape) */
export function toonCreature(ctx, t, kind = 'emberkit', o = {}) {
  const ph = o.phase || 0;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.ellipse(0, 4, 90, 14, 0, 0, Math.PI * 2); ctx.fill();
  const hop = o.idle === false ? 0 : Math.abs(Math.sin(t * 3 + ph)) * -10;
  ctx.translate(0, hop);
  const eye = (x, y, r, dir = 0) => { cel(ctx, ell(x, y, r * 0.8, r), '#1e1a22', null, { line: false }); circle(ctx, x + r * 0.25 + dir, y - r * 0.35, r * 0.32, '#ffffff'); circle(ctx, x - r * 0.2, y + r * 0.35, r * 0.14, '#ffffff'); };
  const blink = ((t + ph) % 4.3) < 0.12;
  if (kind === 'emberkit') {
    // tail (flame) wagging
    ctx.save(); ctx.translate(-60, -60); ctx.rotate(Math.sin(t * 5 + ph) * 0.25);
    cel(ctx, smoothShape([[0, 0], [-40, -30], [-70, -100], [-40, -80], [-30, -130], [-10, -70], [10, -20]]), '#ff8a2a', '#e0611a', { dx: 8 });
    cel(ctx, smoothShape([[-30, -60], [-50, -100], [-28, -84], [-22, -110], [-12, -66]]), '#ffd34a', null, { line: false });
    ctx.restore();
    cel(ctx, ell(0, -70, 70, 62), '#f58a34', '#d96a20', { dx: 10 });                     // body
    cel(ctx, ell(8, -52, 40, 34), '#fff1d6', '#f0d9b4', { dx: 6 });                      // belly
    for (const s of [-1, 1]) cel(ctx, ell(s * 34, -14, 18, 14), '#f58a34', '#d96a20', { dy: 4 });  // feet
    ctx.save(); ctx.translate(10, -150);                                                  // head
    for (const s of [-1, 1]) { cel(ctx, poly([[s * 30, -40], [s * 70, -110], [s * 76, -30]]), '#f58a34', '#d96a20', { dx: s * 6 }); cel(ctx, poly([[s * 50, -70], [s * 68, -100], [s * 70, -60]]), '#3a2620', null, { line: false }); }
    cel(ctx, smoothShape([[-78, -10], [-60, -60], [0, -78], [60, -60], [78, -10], [50, 40], [0, 50], [-50, 40]]), '#f58a34', '#d96a20', { dx: 10, rim: 'rgba(255,255,255,0.2)' });
    cel(ctx, smoothShape([[-40, 20], [0, 0], [40, 20], [20, 46], [-20, 46]]), '#fff1d6', null, { line: false });
    if (blink) { ctx.strokeStyle = OUT; ctx.lineWidth = 5; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 30 - 10, -10); ctx.lineTo(s * 30 + 10, -10); ctx.stroke(); } }
    else for (const s of [-1, 1]) eye(s * 30, -10, 15);
    circle(ctx, 0, 14, 6, '#3a2620'); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(-7, 22, 7, 0.1 * Math.PI, 0.9 * Math.PI); ctx.arc(7, 22, 7, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255,110,110,0.35)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 52, 14, 12, 7, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  } else if (kind === 'bubbit') {
    cel(ctx, smoothShape([[-90, -60], [-70, -150], [0, -190], [70, -150], [90, -60], [60, -6], [-60, -6]]), '#4aa3ef', '#2f7fcf', { dx: 12, rim: 'rgba(255,255,255,0.35)' });
    ctx.save(); ctx.translate(86, -110); ctx.rotate(Math.sin(t * 4 + ph) * 0.3); cel(ctx, smoothShape([[0, 0], [60, -30], [70, 20], [20, 26]]), '#9fd4ff', '#6fb2ea', { dx: 6 }); ctx.restore();
    cel(ctx, ell(0, -70, 52, 40), '#d8f0ff', '#b6dcf7', { dx: 6, line: false });
    if (blink) { ctx.strokeStyle = OUT; ctx.lineWidth = 5; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 34 - 12, -130); ctx.lineTo(s * 34 + 12, -130); ctx.stroke(); } }
    else for (const s of [-1, 1]) { cel(ctx, ell(s * 34, -130, 22, 24), '#ffffff', null); eye(s * 34 + 4, -128, 12); }
    ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -98, 12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    for (let i = 0; i < 3; i++) { const k = ((t * 0.6 + i / 3 + ph) % 1); ctx.globalAlpha = 1 - k; circle(ctx, 60 + i * 18, -200 - k * 120, 10 + i * 4, null, '#bfe6ff', 3); }
    ctx.globalAlpha = 1;
  } else if (kind === 'stinger') {
    ctx.translate(0, -160 + Math.sin(t * 2 + ph) * 16);
    for (const s of [-1, 1]) { ctx.save(); ctx.rotate(s * (0.4 + Math.sin(t * 40) * 0.25)); ctx.fillStyle = 'rgba(235,240,255,0.55)'; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(s * 70, -50, 70, 30, s * -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
    cel(ctx, smoothShape([[-30, 0], [30, 0], [44, 80], [0, 150], [-44, 80]]), '#f2c230', '#d29e17', { dx: 8 });
    ctx.save(); ctx.clip(smoothShape([[-30, 0], [30, 0], [44, 80], [0, 150], [-44, 80]])); ctx.fillStyle = '#2a2230'; for (let i = 0; i < 3; i++) ctx.fillRect(-60, 30 + i * 36, 120, 16); ctx.restore();
    cel(ctx, poly([[-8, 146], [8, 146], [0, 190]]), '#e9e9ee', null);
    cel(ctx, ell(0, -30, 38, 30), '#5a3d7a', '#43295e', { dx: 6 });
    cel(ctx, ell(0, -90, 44, 40), '#f2c230', '#d29e17', { dx: 8 });
    for (const s of [-1, 1]) { cel(ctx, ell(s * 20, -96, 15, 13), '#e8433a', '#b5291f', { line: true }); circle(ctx, s * 20 + 4, -100, 4, '#fff'); }
    ctx.strokeStyle = OUT; ctx.lineWidth = 4; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 12, -126); ctx.quadraticCurveTo(s * 30, -180, s * 50, -190); ctx.stroke(); }
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { cel(ctx, capsule(s * 30, -10 + i * 30, s * 70, 30 + i * 40, 7, 5), '#2a2230', null); }
  } else if (kind === 'woolly') {
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; cel(ctx, ell(Math.cos(a) * 62, -100 + Math.sin(a) * 66, 34, 34), '#f4ead8', '#d9cbb1', { dx: 6 }); }
    cel(ctx, ell(0, -100, 70, 74), '#f4ead8', '#d9cbb1', { dx: 8, line: false });
    cel(ctx, ell(0, -92, 34, 26), '#f0b8a8', '#d99a88', { dx: 4 });
    for (const s of [-1, 1]) circle(ctx, s * 10, -90, 5, '#7a3b33');
    if (!blink) for (const s of [-1, 1]) eye(s * 32, -128, 10); else { ctx.strokeStyle = OUT; ctx.lineWidth = 4; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 32 - 9, -128); ctx.lineTo(s * 32 + 9, -128); ctx.stroke(); } }
    for (const s of [-1, 1]) cel(ctx, capsule(s * 26, -30, s * 30, 0, 12, 10), '#b98a6a', '#9a6e50', {});
  }
  ctx.restore();
}

// ------------------------------------------------------------------ backgrounds
export function toonSky(ctx, t, preset = 'sunset', horizon = 820) {
  const P = {
    sunset: ['#2b1a52', '#5b2f73', '#c2506a', '#f08a4b', '#ffc36b'],
    dusk: ['#1d1f4a', '#3b3576', '#7a4a86', '#c46e7a', '#e9a079'],
    day: ['#4b8fe0', '#6fb0ef', '#a9d4f7', '#d9ecfb', '#f2f8fd'],
    night: ['#060818', '#0d1230', '#172050', '#22306a', '#2c3b78'],
  }[preset] || ['#2b1a52', '#5b2f73', '#c2506a', '#f08a4b', '#ffc36b'];
  const g = ctx.createLinearGradient(0, 0, 0, horizon + 40);
  P.forEach((c, i) => g.addColorStop(i / (P.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, horizon + 60);
  if (preset === 'night' || preset === 'sunset' || preset === 'dusk') {
    const R = rand(3); for (let i = 0; i < 70; i++) { const y = R() * horizon * 0.55; ctx.globalAlpha = (1 - y / (horizon * 0.55)) * (0.4 + 0.6 * Math.abs(Math.sin(t + i))); circle(ctx, R() * 1080, y, 1.2 + R() * 1.8, '#ffffff'); } ctx.globalAlpha = 1;
  }
  if (preset === 'sunset' || preset === 'dusk') {
    const sg = ctx.createRadialGradient(400, horizon, 10, 400, horizon, 420);
    sg.addColorStop(0, 'rgba(255,230,160,0.95)'); sg.addColorStop(0.15, 'rgba(255,190,110,0.6)'); sg.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, horizon - 420, 1080, 480);
    circle(ctx, 400, horizon + 6, 46, '#fff1c4');
    // long flat cloud strips
    const R = rand(8);
    for (let i = 0; i < 7; i++) {
      const y = 120 + i * 85 + R() * 30, w = 260 + R() * 420, x = ((R() * 1400 - t * (6 + i)) % 1500 + 1500) % 1500 - 300;
      ctx.fillStyle = i < 3 ? 'rgba(70,40,100,0.55)' : 'rgba(150,70,110,0.45)';
      ctx.beginPath(); ctx.roundRect(x, y, w, 26 + R() * 18, 20); ctx.fill();
    }
  }
}
export function toonHills(ctx, horizon = 820, color = '#3a2350', seed = 2) {
  const R = rand(seed); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-20, horizon + 4);
  let x = -20; while (x < 1100) { const w = 220 + R() * 260, h = 40 + R() * 70; ctx.lineTo(x + w * 0.5, horizon - h); ctx.lineTo(x + w, horizon + 4); x += w * 0.85; }
  ctx.lineTo(1100, horizon + 8); ctx.lineTo(-20, horizon + 8); ctx.closePath(); ctx.fill();
}
export function toonHedge(ctx, y, color = '#2c2440', seed = 4) {
  const R = rand(seed); ctx.fillStyle = color;
  for (let x = -40; x < 1120; x += 70 + R() * 30) { ctx.beginPath(); ctx.arc(x, y, 56 + R() * 20, Math.PI, 0); ctx.fill(); }
  ctx.fillRect(-20, y - 4, 1120, 60);
}

/** Perspective grass field with tufts and depth-of-field blur on the closest band. */
export function toonField(ctx, t, { horizon = 820, colors = ['#7a9a52', '#4f7a3a', '#2f5a2a'], path = null, tall = false, seed = 5, blur = true } = {}) {
  const g = ctx.createLinearGradient(0, horizon, 0, 1920);
  g.addColorStop(0, colors[0]); g.addColorStop(0.4, colors[1]); g.addColorStop(1, colors[2]);
  ctx.fillStyle = g; ctx.fillRect(0, horizon, 1080, 1920 - horizon);
  // haze at the horizon
  const hz = ctx.createLinearGradient(0, horizon - 10, 0, horizon + 140); hz.addColorStop(0, 'rgba(255,200,150,0.45)'); hz.addColorStop(1, 'rgba(255,200,150,0)');
  ctx.fillStyle = hz; ctx.fillRect(0, horizon - 10, 1080, 150);
  if (path) {
    // dirt path narrowing to the vanishing point
    const vx = path.vx ?? 540, wTop = path.top ?? 30, wBot = path.bottom ?? 520;
    const pg = ctx.createLinearGradient(0, horizon, 0, 1920); pg.addColorStop(0, '#9c7a5c'); pg.addColorStop(1, '#6e5038');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(vx - wTop / 2, horizon); ctx.lineTo(vx + wTop / 2, horizon); ctx.lineTo((path.bx ?? 540) + wBot / 2, 1920); ctx.lineTo((path.bx ?? 540) - wBot / 2, 1920); ctx.closePath(); ctx.fill();
  }
  // tufts: rows from far to near, scaled by perspective
  const R = rand(seed);
  const rows = tall ? 60 : 34;
  for (let r = 0; r < rows; r++) {
    const z = r / rows; const y = horizon + Math.pow(z, 1.8) * (1920 - horizon);
    const s = 0.15 + z * 1.6; const n = Math.floor(tall ? 30 : 7 + R() * 5);
    for (let i = 0; i < n; i++) {
      const x = R() * 1100 - 10;
      if (path) { const vx = path.vx ?? 540, half = lerp(path.top ?? 30, path.bottom ?? 520, Math.pow(z, 1)) / 2 + 10; const cx = lerp(vx, path.bx ?? 540, z); if (Math.abs(x - cx) < half) continue; }
      const sway = Math.sin(t * 1.8 + x * 0.02 + r) * 3 * s;
      const col = R() < 0.5 ? '#2f5226' : '#3d6a2e';
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, 2.4 * s); ctx.lineCap = 'round';
      const blades = tall ? 3 : 5, h = (tall ? 70 : 30 + R() * 20) * s;
      for (let b = 0; b < blades; b++) { const bx = x + (b - blades / 2) * 5 * s; ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + sway * 0.5, y - h * 0.6, bx + sway + (b - blades / 2) * 3 * s, y - h); ctx.stroke(); }
    }
  }
  if (blur) {
    // depth of field: soften the closest band
    const band = ctx.createLinearGradient(0, 1500, 0, 1920); band.addColorStop(0, 'rgba(40,70,35,0)'); band.addColorStop(1, 'rgba(40,70,35,0.55)');
    ctx.fillStyle = band; ctx.fillRect(0, 1500, 1080, 420);
  }
}
export function toonRoom(ctx, { wall = '#8d8a92', wallS = '#76737c', floor = '#b9b4ad', floorS = '#a29d96', horizon = 1180 } = {}) {
  ctx.fillStyle = wall; ctx.fillRect(0, 0, 1080, horizon);
  const g = ctx.createLinearGradient(0, 0, 0, horizon); g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, horizon);
  ctx.fillStyle = wallS; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(180, 140); ctx.lineTo(180, horizon - 120); ctx.lineTo(0, horizon); ctx.closePath(); ctx.fill();
  ctx.fillStyle = floor; ctx.fillRect(0, horizon, 1080, 1920 - horizon);
  ctx.strokeStyle = floorS; ctx.lineWidth = 3;
  for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(540 + i * 90, horizon); ctx.lineTo(540 + i * 330, 1920); ctx.stroke(); }
  for (let k = 1; k < 8; k++) { const y = horizon + Math.pow(k / 8, 1.6) * (1920 - horizon); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke(); }
  const lg = ctx.createRadialGradient(700, horizon - 300, 40, 700, horizon - 300, 600); lg.addColorStop(0, 'rgba(255,230,180,0.35)'); lg.addColorStop(1, 'rgba(255,230,180,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, 1080, 1920);
}
export function toonGym(ctx, horizon = 980) {
  ctx.fillStyle = '#cdbfa6'; ctx.fillRect(0, 0, 1080, horizon);
  ctx.strokeStyle = '#a8987c'; ctx.lineWidth = 4;
  for (let y = 120; y < horizon; y += 70) { const off = (y / 70) % 2 ? 0 : 60; for (let x = -off; x < 1080; x += 120) ctx.strokeRect(x, y, 120, 70); }
  ctx.fillStyle = '#2e2b33'; ctx.fillRect(0, 0, 1080, 130);
  for (const x of [220, 540, 860]) { ctx.fillStyle = '#a23a2e'; ctx.beginPath(); ctx.moveTo(x - 60, 170); ctx.lineTo(x + 60, 170); ctx.lineTo(x + 60, 420); ctx.lineTo(x, 470); ctx.lineTo(x - 60, 420); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#e0b04a'; ctx.lineWidth = 6; ctx.stroke(); }
  for (const x of [100, 380, 700, 980]) { ctx.fillStyle = '#e2d6bf'; ctx.fillRect(x - 30, 130, 60, horizon - 130); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + 10, 130, 20, horizon - 130); }
  const fg = ctx.createLinearGradient(0, horizon, 0, 1920); fg.addColorStop(0, '#9e978d'); fg.addColorStop(1, '#6d675f'); ctx.fillStyle = fg; ctx.fillRect(0, horizon, 1080, 1920 - horizon);
  const R = rand(9); ctx.strokeStyle = 'rgba(40,36,32,0.45)'; ctx.lineWidth = 4;
  for (let i = 0; i < 40; i++) { const z = R(); const y = horizon + Math.pow(z, 1.5) * (1920 - horizon); const x = R() * 1080, s = 0.3 + z * 1.6; ctx.beginPath(); ctx.roundRect(x - 80 * s, y - 30 * s, 160 * s, 60 * s, 20 * s); ctx.stroke(); }
}

// shared with fighter.js
export { cel, capsule, ell, roundRect, poly, smoothShape, OUT };
