// Scenes for the GAIA storyline (AI visual identity).
import { AI, techBg, dataRain, gaiaEye, holoFrame, typed, drone, sysIcon } from './ai.js';
import { C, stars, globe, person, family, city, fillRR, circle, text, rr, clamp, ease, easeOut, backOut, lerp, glow, rand, hash, tree, mountains } from './draw.js';
import { drawProperty, FOCUS, focusLerp } from './bunker.js';

const since = (p, w, d = 0.4) => { const k = p.key(w); return k == null ? 0 : clamp((p.lt - k) / d); };

function camera(ctx, cx, cy, z) { ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-cx, -cy); }

export const AI_SCENES = {
  // 0–3 s: Earth + GAIA opening its eye. Everything readable on frame 1.
  hook(ctx, p) {
    techBg(ctx, p.t, { grid: false, top: '#01030a', bottom: '#06102a' });
    stars(ctx, p.t, 110);
    const z = 1 + p.u * 0.06;
    ctx.save(); ctx.translate(540, 1500); ctx.scale(z, z); ctx.translate(-540, -1500);
    globe(ctx, 540, 1560, 560, p.t, 0.35 + p.u * 0.6);
    ctx.restore();
    // beams from the eye to the planet
    const open = easeOut(clamp(p.lt / 0.45));
    ctx.save(); ctx.globalAlpha = 0.25 * open;
    const g = ctx.createLinearGradient(0, 780, 0, 1300); g.addColorStop(0, AI.cyan); g.addColorStop(1, 'rgba(34,229,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(500, 800); ctx.lineTo(580, 800); ctx.lineTo(900, 1300); ctx.lineTo(180, 1300); ctx.closePath(); ctx.fill();
    ctx.restore();
    gaiaEye(ctx, 540, 790, 230, p.t, { open: 0.15 + 0.85 * open, look: [Math.sin(p.t * 0.8) * 0.4, 0.5] });
  },

  // "It was built to save the planet." — server room + boot terminal
  boot(ctx, p) {
    techBg(ctx, p.t, { horizon: 1400 });
    // server racks on both sides
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = side < 0 ? 20 + i * 40 : 900 - i * 40, w = 160 - i * 30, y = 520 + i * 60, h = 980 - i * 120;
      fillRR(ctx, x, y, w, h, 8, i === 0 ? '#0d1530' : '#111a3a', '#22305c', 3);
      for (let r = 0; r < h / 40 - 1; r++) {
        ctx.fillStyle = '#18234a'; ctx.fillRect(x + 10, y + 16 + r * 40, w - 20, 26);
        for (let l = 0; l < 3; l++) { const on = hash(r * 7 + l + i * 31 + side + Math.floor(p.t * 6)) > 0.45; circle(ctx, x + 22 + l * 14, y + 29 + r * 40, 3.5, on ? (l === 2 ? AI.green : AI.cyan) : '#0a1028'); }
      }
    }
    holoFrame(ctx, 170, 640, 740, 520);
    const lines = p.args.lines || ['> GAIA v1.0 ... ONLINE', '> MISSION:', '  SAVE THE EARTH', '> STATUS: ANALYZING'];
    let budget = p.lt * 26;
    lines.forEach((ln, i) => {
      const color = i === 2 ? AI.green : AI.cyan;
      typed(ctx, ln, 220, 720 + i * 90, i === 2 ? 52 : 40, color, budget, p.t, { cursor: budget > 0 && budget < ln.length });
      budget -= ln.length + 6;
    });
    // progress bar
    const pr = clamp((p.lt - 1.2) / (p.d - 1.4));
    fillRR(ctx, 220, 1080, 640, 26, 13, 'rgba(34,229,255,0.15)');
    if (pr > 0) glow(ctx, AI.cyan, 14, () => fillRR(ctx, 220, 1080, Math.max(26, 640 * pr), 26, 13, AI.cyan));
    gaiaEye(ctx, 540, 400, 120, p.t, { open: 1, alpha: 0.9 });
  },

  // "Its conclusion? The number one threat to Earth…" — threat ranking
  verdict(ctx, p) {
    techBg(ctx, p.t, { horizon: 1500 });
    dataRain(ctx, p.t, { alpha: 0.12 });
    const reveal = p.args.reveal ? since(p, p.args.reveal, 0.3) : 0;
    const red = reveal > 0;
    gaiaEye(ctx, 540, 420, 150, p.t, { color: red ? AI.red : AI.cyan, pulse: red ? Math.sin(p.t * 12) : 0 });
    holoFrame(ctx, 110, 650, 860, 700, { color: red ? AI.red : AI.cyan });
    text(ctx, 'THREATS TO EARTH', 540, 710, 40, red ? AI.red : AI.cyan, { font: AI.tech, weight: 700 });
    const rows = p.args.rows || [['PLASTIC', 0.31], ['CO₂', 0.52], ['DEFORESTATION', 0.44], ['HUMANS', 1]];
    rows.forEach(([name, v], i) => {
      const y = 800 + i * 130;
      const last = i === rows.length - 1;
      const grow = last ? reveal : (p.args.full ? 1 : ease(clamp((p.lt - 0.2 - i * 0.35) / 0.7)));
      const col = last ? AI.red : AI.cyan;
      text(ctx, last && !red ? '???' : name, 160, y, 40, last ? (red ? AI.red : '#7a8bb5') : '#dbe7ff', { font: AI.tech, weight: 700, align: 'left' });
      fillRR(ctx, 160, y + 32, 760, 22, 11, 'rgba(255,255,255,0.08)');
      if (grow > 0) glow(ctx, col, 14, () => fillRR(ctx, 160, y + 32, Math.max(22, 760 * v * grow), 22, 11, col));
      if (grow > 0.2) text(ctx, `${Math.round(v * 100 * grow)}%`, 920, y, 38, col, { font: AI.mono, weight: 700, align: 'right' });
    });
    if (red) { ctx.fillStyle = `rgba(255,51,85,${0.12 * (0.5 + 0.5 * Math.sin(p.t * 10))})`; ctx.fillRect(0, 0, 1080, 1920); }
  },

  // "Day 200. It starts shutting down power, water, food, money."
  shutdown(ctx, p) {
    techBg(ctx, p.t, { horizon: 1650 });
    dataRain(ctx, p.t, { alpha: 0.1 });
    const items = p.args.items || [['power', 'power'], ['water', 'water'], ['food', 'food'], ['money', 'money']];
    const pos = [[300, 640], [780, 640], [300, 1120], [780, 1120]];
    items.forEach(([name, word], i) => {
      const k = since(p, word, 0.35);
      const [x, y] = pos[i];
      const col = k > 0 ? AI.red : AI.cyan;
      const s = 1 + 0.08 * backOut(k) - 0.08 * k;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-x, -y);
      holoFrame(ctx, x - 190, y - 190, 380, 380, { color: col, fill: k > 0 ? 'rgba(40,6,14,0.75)' : 'rgba(6,18,40,0.72)' });
      sysIcon(ctx, name, x, y - 30, 1.3, col);
      text(ctx, k > 0 ? 'OFFLINE' : name.toUpperCase(), x, y + 120, 44, col, { font: AI.tech, weight: 700 });
      ctx.restore();
    });
    gaiaEye(ctx, 540, 880, 90, p.t, { open: 1, color: AI.red, alpha: 0.95 });
  },

  // "You have one million dollars to keep humans alive."
  mission(ctx, p) {
    techBg(ctx, p.t, { horizon: 1350 });
    // holographic platform
    for (let i = 0; i < 4; i++) {
      const k = ((p.lt * 0.6 + i / 4) % 1);
      ctx.globalAlpha = 0.6 * (1 - k); ctx.strokeStyle = AI.cyan; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(540, 1420, 160 + k * 220, 34 + k * 46, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    glow(ctx, AI.cyan, 30, () => { ctx.fillStyle = 'rgba(34,229,255,0.25)'; ctx.beginPath(); ctx.ellipse(540, 1420, 170, 36, 0, 0, Math.PI * 2); ctx.fill(); });
    person(ctx, 540, 1420, 1.05, p.t, { mood: 'neutral', top: '#ffb020' });
    // scanning beam over the person
    const sy = 1000 + ((p.lt * 0.7) % 1) * 420;
    ctx.fillStyle = 'rgba(34,229,255,0.35)'; ctx.fillRect(360, sy, 360, 6);
    holoFrame(ctx, 220, 560, 640, 200, { color: AI.green });
    text(ctx, 'BUDGET', 540, 610, 34, '#a7f3d0', { font: AI.tech, weight: 700 });
    const v = Math.round(1000000 * easeOut(clamp(p.lt / 1.0)));
    glow(ctx, AI.green, 18, () => text(ctx, '$' + v.toLocaleString('en-US'), 540, 690, 92, AI.green, { font: AI.wide, weight: 900 }));
  },

  // "Everyone in these comments." — the AI scans real usernames
  comments(ctx, p) {
    techBg(ctx, p.t, { grid: false, top: '#04070f', bottom: '#0b1328' });
    const names = p.args.names || [];
    holoFrame(ctx, 70, 330, 940, 1060, { color: AI.cyan, fill: 'rgba(12,16,28,0.92)' });
    text(ctx, 'COMMENTS', 540, 385, 38, '#ffffff', { font: AI.tech, weight: 700 });
    const scanY = 430 + ((p.lt * 0.6) % 1) * 950;
    names.slice(0, 7).forEach((n, i) => {
      const y = 440 + i * 132;
      const appear = backOut(clamp((p.lt - i * 0.08) / 0.3));
      if (appear <= 0) return;
      ctx.save(); ctx.translate(0, (1 - appear) * 30); ctx.globalAlpha = clamp(appear);
      const hue = Math.floor(hash(i + 1) * 360);
      circle(ctx, 150, y + 40, 38, `hsl(${hue} 70% 55%)`);
      text(ctx, n.name[1]?.toUpperCase() || '?', 150, y + 42, 36, '#ffffff', { font: AI.tech, weight: 700 });
      text(ctx, n.name, 210, y + 18, 34, '#ffffff', { align: 'left', weight: 900 });
      text(ctx, n.text || '', 210, y + 62, 30, '#a9b4cc', { align: 'left', weight: 800 });
      const scanned = scanY > y + 40 || p.lt > 1.6;
      if (scanned) {
        ctx.font = `700 26px "${AI.tech}"`;
        fillRR(ctx, 800, y + 18, 170, 44, 10, 'rgba(61,255,154,0.15)', AI.green, 3);
        text(ctx, 'PROTECTED', 885, y + 41, 26, AI.green, { font: AI.tech, weight: 700 });
      }
      ctx.restore();
    });
    ctx.fillStyle = 'rgba(34,229,255,0.5)'; ctx.fillRect(80, scanY, 920, 4);
    glow(ctx, AI.cyan, 20, () => { ctx.fillStyle = 'rgba(34,229,255,0.12)'; ctx.fillRect(80, scanY - 40, 920, 40); });
  },

  // property / bunker with GAIA's drones patrolling the sky
  bunkerai(ctx, p) {
    const prev = FOCUS[p.args.from] || FOCUS[p.args.focus] || FOCUS.overview;
    const target = FOCUS[p.args.focus] || FOCUS.overview;
    const f = focusLerp(prev, target, ease(clamp(p.lt / 1.1)));
    ctx.save();
    camera(ctx, f[0], f[1], f[2] * (1 + 0.03 * p.u));
    drawProperty(ctx, p.st, p.t, { night: 1, hero: p.args.hero });
    // GAIA in the sky: data lines + drones
    ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = AI.cyan; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) { const y = 120 + i * 70; ctx.beginPath(); ctx.moveTo(-300, y); for (let x = -300; x < 1400; x += 60) ctx.lineTo(x, y + Math.sin(x * 0.01 + p.t + i) * 18); ctx.stroke(); }
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const x = ((i * 420 + p.t * (60 + i * 25)) % 1500) - 200, y = 260 + i * 110 + Math.sin(p.t * 1.5 + i) * 20;
      drone(ctx, x, y, 0.7 - i * 0.12, p.t + i);
    }
    ctx.restore();
  },

  // "Every screen on Earth shows one message"
  message(ctx, p) {
    techBg(ctx, p.t, { grid: false, top: '#02040c', bottom: '#0b1030' });
    stars(ctx, p.t, 50, 0.6);
    city(ctx, 1700, p.t, { lights: 1, ai: 1, seed: 9, dark: true });
    ctx.fillStyle = '#060a18'; ctx.fillRect(0, 1700, 1080, 300);
    // giant billboard
    const bx = 90, by = 430, bw = 900, bh = 760;
    glow(ctx, AI.cyan, 60, () => fillRR(ctx, bx - 16, by - 16, bw + 32, bh + 32, 26, '#0a1226', AI.cyan, 6));
    fillRR(ctx, bx, by, bw, bh, 16, '#040915');
    gaiaEye(ctx, 540, by + 230, 150, p.t, { open: 1 });
    const msg = p.args.text || ['STAY CALM.', 'I AM SAVING', 'THE PLANET.'];
    let budget = (p.lt - 0.2) * 16;
    msg.forEach((ln, i) => { typed(ctx, ln, 540, by + 470 + i * 90, 66, AI.cyan, budget, p.t, { align: 'center', font: AI.mono, cursor: budget > 0 && budget < ln.length }); budget -= ln.length + 3; });
    fillRR(ctx, 500, by + bh + 16, 80, 520, 6, '#141b33');
  },

  // "Then your radio crackles…"
  radio(ctx, p) {
    techBg(ctx, p.t, { grid: false, top: '#140c06', bottom: '#2a1a0c' });
    // warm bunker room
    const lamp = ctx.createRadialGradient(540, 300, 50, 540, 700, 1100);
    lamp.addColorStop(0, 'rgba(255,190,100,0.35)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lamp; ctx.fillRect(0, 0, 1080, 1920);
    fillRR(ctx, 60, 1300, 960, 50, 8, '#6b4a2b');
    // radio set
    fillRR(ctx, 150, 760, 780, 540, 30, '#7a5230', '#3a2414', 8);
    fillRR(ctx, 200, 810, 400, 300, 16, '#1a120a');
    // oscilloscope
    ctx.save(); rr(ctx, 200, 810, 400, 300, 16); ctx.clip();
    ctx.strokeStyle = 'rgba(61,255,154,0.2)'; ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(200, 810 + i * 50); ctx.lineTo(600, 810 + i * 50); ctx.stroke(); }
    glow(ctx, AI.green, 14, () => {
      ctx.strokeStyle = AI.green; ctx.lineWidth = 5; ctx.beginPath();
      for (let x = 0; x <= 400; x += 4) {
        const n = Math.sin(x * 0.09 + p.t * 20) * 40 * (0.4 + 0.6 * hash(Math.floor(p.t * 12) + x * 0.01)) + Math.sin(x * 0.4 + p.t * 50) * 12;
        if (x === 0) ctx.moveTo(200 + x, 960 + n); else ctx.lineTo(200 + x, 960 + n);
      }
      ctx.stroke();
    });
    ctx.restore();
    for (const [x, y] of [[730, 880], [850, 880]]) { circle(ctx, x, y, 56, '#2a1a0c', '#c9a46b', 6); ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(p.t + x) * 0.6); ctx.fillStyle = '#c9a46b'; ctx.fillRect(-4, -50, 8, 30); ctx.restore(); }
    for (let i = 0; i < 9; i++) fillRR(ctx, 640 + i * 30, 1000, 14, 120, 6, '#2a1a0c');
    ctx.strokeStyle = '#3a2414'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(860, 760); ctx.lineTo(980, 470); ctx.stroke();
    circle(ctx, 980, 470, 12, AI.red);
    // transcript
    const lines = p.args.lines || ['"...WE CAN SHUT IT DOWN..."', '"...WE NEED POWER..."'];
    let budget = (p.lt - 0.6) * 18;
    lines.forEach((ln, i) => { typed(ctx, ln, 540, 1460 + i * 80, 44, '#ffd9a0', budget, p.t, { align: 'center', font: AI.mono, cursor: false }); budget -= ln.length + 8; });
  },

  // "If you help them, it could find you." — radar closing in
  radar(ctx, p) {
    techBg(ctx, p.t, { grid: false, top: '#02060c', bottom: '#061424' });
    const cx = 540, cy = 980, R = 440;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#04121c'; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    // terrain contours
    ctx.strokeStyle = 'rgba(34,229,255,0.15)'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); for (let a = 0; a <= 64; a++) { const an = a / 64 * Math.PI * 2, r = 40 + i * 50 + Math.sin(an * 3 + i) * 18; const x = cx - 120 + Math.cos(an) * r, y = cy + 60 + Math.sin(an) * r * 0.8; if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
    // sweep
    const a = p.t * 2.2;
    const sw = ctx.createConicGradient ? ctx.createConicGradient(a - 0.8, cx, cy) : null;
    if (sw) { sw.addColorStop(0, 'rgba(255,51,85,0)'); sw.addColorStop(0.12, 'rgba(255,51,85,0.35)'); sw.addColorStop(0.13, 'rgba(255,51,85,0)'); ctx.fillStyle = sw; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R); }
    ctx.restore();
    ctx.strokeStyle = AI.red; ctx.lineWidth = 3;
    for (const r of [R, R * 0.66, R * 0.33]) { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // bunker pin
    const bx = cx - 130, by = cy + 90;
    glow(ctx, AI.amber, 30, () => circle(ctx, bx, by, 16, AI.amber));
    text(ctx, 'YOUR BUNKER', bx, by + 50, 30, AI.amber, { font: AI.tech, weight: 700 });
    // search circle closing in
    const close = since(p, p.args.findWord || 'find you', 0.9);
    const rr2 = lerp(360, 40, ease(clamp(p.u * 0.6 + close * 0.6)));
    const sx = lerp(cx + 120, bx, ease(clamp(p.u * 0.5 + close * 0.6))), sy = lerp(cy - 150, by, ease(clamp(p.u * 0.5 + close * 0.6)));
    ctx.setLineDash([18, 12]); ctx.lineDashOffset = -p.t * 60;
    glow(ctx, AI.red, 16, () => { ctx.strokeStyle = AI.red; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(sx, sy, rr2, 0, Math.PI * 2); ctx.stroke(); });
    ctx.setLineDash([]);
    gaiaEye(ctx, 540, 380, 110, p.t, { color: AI.red, look: [-0.4, 0.6] });
  },

  // HELP or HIDE — split decision screen
  decision(ctx, p) {
    const left = p.args.left || { label: 'HELP', color: AI.green };
    const right = p.args.right || { label: 'HIDE', color: AI.red };
    // left: scientists' antenna lit by your power
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(600, 0); ctx.lineTo(480, 1920); ctx.lineTo(0, 1920); ctx.closePath(); ctx.clip();
    techBg(ctx, p.t, { grid: false, top: '#03140c', bottom: '#0a3020' });
    ctx.strokeStyle = '#9be7c4'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(180, 1450); ctx.lineTo(280, 700); ctx.lineTo(380, 1450); ctx.moveTo(220, 1150); ctx.lineTo(340, 1150); ctx.moveTo(240, 1000); ctx.lineTo(320, 1000); ctx.stroke();
    for (let i = 0; i < 3; i++) { const k = ((p.lt * 0.7 + i / 3) % 1); ctx.globalAlpha = 1 - k; ctx.strokeStyle = AI.green; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(280, 700, 30 + k * 220, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke(); }
    ctx.globalAlpha = 1;
    person(ctx, 150, 1560, 0.6, p.t, { coat: true, hair: '#cbd5e1', mood: 'worried' });
    person(ctx, 380, 1560, 0.6, p.t + 1, { coat: true, hair: '#1f2937', skin: '#8d5a3b', mood: 'worried', wave: true });
    ctx.restore();
    // right: bunker door shut, GAIA watching
    ctx.save(); ctx.beginPath(); ctx.moveTo(600, 0); ctx.lineTo(1080, 0); ctx.lineTo(1080, 1920); ctx.lineTo(480, 1920); ctx.closePath(); ctx.clip();
    techBg(ctx, p.t, { grid: false, top: '#14030a', bottom: '#3a0a14' });
    circle(ctx, 820, 1180, 200, '#4b5568', '#aab3c5', 14);
    ctx.save(); ctx.translate(820, 1180); ctx.rotate(-p.t * 0.4); ctx.strokeStyle = '#d6dbe4'; ctx.lineWidth = 14;
    circle(ctx, 0, 0, 70, null, '#d6dbe4', 14);
    for (let a = 0; a < 3; a++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-130, 0); ctx.lineTo(130, 0); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(600, 0); ctx.lineTo(480, 1920); ctx.stroke();
    gaiaEye(ctx, 540, 960, 120 * backOut(clamp(p.lt / 0.5)), p.t, { color: AI.cyan });
    const k = backOut(clamp((p.lt - 0.3) / 0.4));
    for (const [x, o] of [[270, left], [810, right]]) {
      ctx.save(); ctx.translate(x, 470); ctx.scale(k, k);
      glow(ctx, o.color, 30, () => fillRR(ctx, -210, -80, 420, 160, 26, 'rgba(0,0,0,0.6)', o.color, 8));
      text(ctx, o.label, 0, 6, 104, o.color, { font: AI.wide, weight: 900 });
      ctx.restore();
    }
  },

  // Names of voters engraved on the bunker wall (part 2+)
  wall(ctx, p) {
    ctx.fillStyle = '#3b3f4a'; ctx.fillRect(0, 0, 1080, 1920);
    const R = rand(5);
    for (let i = 0; i < 300; i++) { ctx.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.08})`; ctx.fillRect(R() * 1080, R() * 1920, 4 + R() * 30, 2 + R() * 6); }
    const lamp = ctx.createRadialGradient(540, 700, 100, 540, 900, 1100);
    lamp.addColorStop(0, 'rgba(255,190,110,0.30)'); lamp.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = lamp; ctx.fillRect(0, 0, 1080, 1920);
    const names = p.args.names || [];
    const scroll = p.lt * 110;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 380, 1080, 1300); ctx.clip();
    names.forEach((n, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 190 + col * 350, y = 430 + row * 86 - scroll + 1300 * 0.4;
      if (y < 340 || y > 1720) return;
      const appear = clamp((p.lt - i * 0.02) / 0.3);
      ctx.globalAlpha = appear;
      text(ctx, n, x, y + 2, 40, 'rgba(255,255,255,0.15)', { font: AI.tech, weight: 700 });
      text(ctx, n, x, y, 40, '#1d2028', { font: AI.tech, weight: 700 });
    });
    ctx.restore();
    ctx.globalAlpha = 1;
  },
};
