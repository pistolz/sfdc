// One function per scene type. Each draws a full 1080×1920 frame.
// p = { t: global time, lt: time inside the beat, d: beat duration, u: lt/d,
//       st: story state at time t, key(word): local time the narrator says `word`,
//       args: scene args from the episode file, beat }
import {
  C, sky, sun, stars, mountains, tree, person, family, house, city, icon, priceTag, globe, aiEye,
  tvFrame, noise, particles, fillRR, circle, text, rr, clamp, ease, easeOut, backOut, lerp, glow, hash,
} from './draw.js';
import { drawProperty, FOCUS, focusLerp, G } from './bunker.js';

const since = (p, word, dur = 0.5) => {
  const k = p.key(word);
  return k == null ? 0 : clamp((p.lt - k) / dur);
};

function camera(ctx, cx, cy, zoom) {
  ctx.translate(540, 960);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);
}

function nightSky(ctx, t) {
  sky(ctx, C.skyNight);
  stars(ctx, t, 90);
}

export const SCENES = {
  // In exactly 200 days, AI will control the entire Earth.
  globe(ctx, p) {
    nightSky(ctx, p.t);
    const z = 1 + p.u * 0.08;
    ctx.save(); ctx.translate(540, 1080); ctx.scale(z, z); ctx.translate(-540, -1080);
    globe(ctx, 540, 1080, 380, p.t, easeOut(p.u) * (p.args.infection ?? 0.9));
    ctx.restore();
    const a = clamp(p.u * 2 - 0.4);
    aiEye(ctx, 540, 640 - 20 * Math.sin(p.t * 1.5), 230 * backOut(a), p.t, { mood: 'calm', alpha: a });
  },

  // Scientists discover a mysterious AI system
  lab(ctx, p) {
    sky(ctx, ['#dfe6f0', '#c4cedd']);
    ctx.fillStyle = '#aab6c8'; ctx.fillRect(0, 1380, 1080, 600);
    tvFrame(ctx, 140, 380, 800, 560, () => {
      ctx.fillStyle = '#0d1424'; ctx.fillRect(140, 380, 800, 560);
      globe(ctx, 540, 680, 210, p.t, 0.25 + p.u * 0.5);
      if (Math.floor(p.t * 3) % 2 === 0) {
        fillRR(ctx, 300, 410, 480, 70, 14, C.red);
        text(ctx, '⚠ ANOMALY DETECTED', 540, 446, 40, '#ffffff', { font: 'Lilita One', weight: 400 });
      }
    });
    fillRR(ctx, 60, 1300, 960, 50, 10, '#7a8699');
    person(ctx, 330, 1420, 0.95, p.t, { coat: true, hair: '#cbd5e1', mood: 'shock' });
    person(ctx, 760, 1420, 0.95, p.t + 1.3, { coat: true, hair: '#1f2937', skin: '#8d5a3b', mood: 'shock', wave: true });
  },

  // taking over computers around the world, faster and faster
  screens(ctx, p) {
    sky(ctx, ['#0b1028', '#151d40']);
    const cols = 3, rows = 5, w = 280, h = 200;
    const n = cols * rows;
    const infected = Math.floor(n * Math.pow(clamp(p.u * 1.15), 2.2));
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const x = 120 + c * 300, y = 330 + r * 250;
      const order = Math.floor(hash(i + 3) * n);
      const on = order < infected;
      fillRR(ctx, x - 10, y - 10, w + 20, h + 20, 20, '#2a3150');
      ctx.save(); rr(ctx, x, y, w, h, 12); ctx.clip();
      if (on) {
        ctx.fillStyle = '#0d1424'; ctx.fillRect(x, y, w, h);
        aiEye(ctx, x + w / 2, y + h / 2, 150, p.t + i, { mood: i % 4 === 0 ? 'smile' : 'calm' });
      } else {
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        for (let l = 0; l < 4; l++) ctx.fillRect(x + 24, y + 30 + l * 36, 120 + ((i * 37 + l * 53) % 100), 16);
      }
      noise(ctx, x, y, w, h, p.t + i, 0.05);
      ctx.restore();
    }
  },

  // every phone, every car, every camera, every bank account, every power grid
  devices(ctx, p) {
    sky(ctx, ['#0f1631', '#232d5c']);
    const items = p.args.items || ['phone', 'car', 'camera', 'bank', 'grid'];
    const words = p.args.words || ['phone', 'car', 'camera', 'bank', 'power grid'];
    const pos = [[300, 520], [780, 520], [540, 900], [300, 1280], [780, 1280]];
    items.forEach((name, i) => {
      const appear = since(p, words[i], 0.35) || (p.key(words[i]) == null ? clamp(p.u * 5 - i) : 0);
      if (appear <= 0) return;
      const inf = clamp(appear * 2 - 0.6);
      icon(ctx, name, pos[i][0], pos[i][1], 1.35 * backOut(appear), p.t, { infected: inf });
    });
  },

  // almost everything connected will stop obeying humans
  cityai(ctx, p) {
    sky(ctx, ['#0b1028', '#2a1f4d']);
    stars(ctx, p.t, 40, 0.6);
    const ai = easeOut(p.u * 1.3);
    city(ctx, 1500, p.t, { lights: 1, ai, seed: 7, dark: true });
    aiEye(ctx, 540, 520, 300 * (0.9 + 0.1 * Math.sin(p.t * 2)), p.t, { mood: 'angry', alpha: ai });
    ctx.fillStyle = '#141a33'; ctx.fillRect(0, 1500, 1080, 500);
    for (let i = 0; i < 6; i++) {
      const x = ((i * 190 + p.lt * (i % 2 ? 120 : -120)) % 1300 + 1300) % 1300 - 100;
      person(ctx, x, 1700, 0.45, p.t + i, { top: ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'][i % 4], mood: 'shock', walk: true, facing: i % 2 ? 1 : -1 });
    }
  },

  // You have one million dollars. What do you buy first?
  hero(ctx, p) {
    sky(ctx, ['#1b2550', '#3a4a8c']);
    const names = ['home', 'food', 'water', 'solar', 'power', 'question'];
    names.forEach((n, i) => {
      const a = (i / names.length) * Math.PI * 2 + p.t * 0.35;
      const appear = clamp(p.u * 3 - i * 0.2);
      icon(ctx, n, 540 + Math.cos(a) * 360, 980 + Math.sin(a) * 300, 1.0 * backOut(appear), p.t);
    });
    person(ctx, 540, 1400, 1.1, p.t, { mood: p.u > 0.6 ? 'worried' : 'neutral', wave: p.u < 0.5 });
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(540, 1405, 150, 22, 0, 0, Math.PI * 2); ctx.fill();
  },

  // DAY 150 calendar card
  daycard(ctx, p) {
    const d = p.st.days;
    const dark = clamp((200 - d) / 200);
    sky(ctx, [mix('#4aa3e8', '#0b1028', dark), mix('#bfe6ff', '#3a2458', dark)]);
    mountains(ctx, 1600, mix('#9fb4cf', '#2a3358', dark), mix('#eef4fb', '#4a5680', dark), 2);
    ctx.fillStyle = mix('#6bbf59', '#1e3329', dark); ctx.fillRect(0, 1590, 1080, 400);
    if (dark > 0.6) particles(ctx, p.t, { color: C.ai, n: 40, speed: 40, size: 3, alpha: 0.6 });
    const from = p.args.from ?? d + 20;
    const shown = Math.round(lerp(from, d, ease(clamp(p.lt / 0.9))));
    const s = backOut(clamp(p.lt / 0.35));
    ctx.save(); ctx.translate(540, 900); ctx.scale(s, s);
    fillRR(ctx, -230, -250, 460, 480, 40, '#ffffff', C.ink, 10);
    ctx.save(); rr(ctx, -230, -250, 460, 130, 40); ctx.clip(); ctx.fillStyle = dark > 0.7 ? C.red : '#2563eb'; ctx.fillRect(-230, -250, 460, 130); ctx.restore();
    fillRR(ctx, -150, -282, 30, 70, 12, C.ink); fillRR(ctx, 120, -282, 30, 70, 12, C.ink);
    text(ctx, 'DAYS LEFT', 0, -182, 56, '#ffffff', { font: 'Lilita One', weight: 400 });
    text(ctx, String(shown), 0, 50, 230, C.ink, { font: 'Lilita One', weight: 400 });
    ctx.restore();
  },

  // the property / bunker cross-section
  xsection(ctx, p) {
    const prev = FOCUS[p.args.from] || FOCUS[p.args.focus] || FOCUS.overview;
    const target = FOCUS[p.args.focus] || FOCUS.overview;
    const f = focusLerp(prev, target, ease(clamp(p.lt / 1.1)));
    const drift = 1 + 0.03 * p.u;
    ctx.save();
    camera(ctx, f[0], f[1], f[2] * drift);
    drawProperty(ctx, p.st, p.t, { night: p.args.night ? 1 : 0, hero: p.args.hero, family: p.args.family ? clamp(p.lt / 0.8) : 0 });
    ctx.restore();
    if (p.args.stamp) {
      // red "NOT ENOUGH" style stamp is drawn by the overlay; darken a bit for contrast
      ctx.fillStyle = `rgba(0,0,0,${0.15 * since(p, p.args.stamp, 0.3)})`; ctx.fillRect(0, 0, 1080, 1920);
    }
    if (p.args.blackout) {
      ctx.fillStyle = `rgba(5,8,20,${0.35 * clamp(p.lt / 1)})`; ctx.fillRect(0, 0, 1080, 1920);
    }
  },

  // BREAKING NEWS: the AI is learning faster than expected
  news(ctx, p) {
    sky(ctx, ['#1a2142', '#2c3766']);
    tvFrame(ctx, 90, 420, 900, 760, () => {
      ctx.fillStyle = '#0f172a'; ctx.fillRect(90, 420, 900, 760);
      // graph
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(150, 520 + i * 90); ctx.lineTo(930, 520 + i * 90); ctx.stroke(); }
      text(ctx, 'AI LEARNING SPEED', 540, 480, 40, '#ffffff', { font: 'Lilita One', weight: 400 });
      const n = Math.floor(60 * clamp(p.u * 1.3));
      glow(ctx, C.ai, 20, () => {
        ctx.strokeStyle = C.ai; ctx.lineWidth = 8; ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const x = 150 + (i / 60) * 780;
          const y = 960 - Math.pow(i / 60, 3) * 420 - Math.sin(i * 1.7) * 8;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      fillRR(ctx, 90, 1060, 900, 120, 0, '#b91c1c');
      text(ctx, 'BREAKING NEWS', 250, 1095, 36, '#ffffff', { font: 'Lilita One', weight: 400 });
      const msg = (p.args.ticker || 'AI LEARNING FASTER THAN EXPECTED  •  SCIENTISTS WARN  •  ') .repeat(3);
      ctx.save(); rr(ctx, 90, 1120, 900, 60, 0); ctx.clip();
      text(ctx, msg, 960 - p.lt * 220, 1150, 34, '#ffffff', { align: 'left' });
      ctx.restore();
    });
  },

  // What happens when the AI shuts down the power grid?
  griddown(ctx, p) {
    const off = since(p, p.args.offWord || 'shuts down', 0.4);
    sky(ctx, [mix('#3b4a8a', '#05070f', off), mix('#7c8fd0', '#111827', off)]);
    stars(ctx, p.t, 50, off);
    ctx.fillStyle = mix('#2f5a3a', '#0e1a14', off); ctx.fillRect(0, 1500, 1080, 500);
    for (const x of [180, 540, 900]) {
      ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(x - 90, 1500); ctx.lineTo(x, 760); ctx.lineTo(x + 90, 1500); ctx.moveTo(x - 120, 880); ctx.lineTo(x + 120, 880); ctx.moveTo(x - 90, 1000); ctx.lineTo(x + 90, 1000); ctx.stroke();
    }
    ctx.strokeStyle = off > 0.5 ? '#333a4d' : '#facc15'; ctx.lineWidth = 5;
    if (off < 0.5) glow(ctx, '#facc15', 20, () => { ctx.beginPath(); ctx.moveTo(-20, 900); ctx.quadraticCurveTo(360, 960, 540, 880); ctx.quadraticCurveTo(720, 960, 1100, 900); ctx.stroke(); });
    else { ctx.beginPath(); ctx.moveTo(-20, 900); ctx.quadraticCurveTo(360, 960, 540, 880); ctx.quadraticCurveTo(720, 960, 1100, 900); ctx.stroke(); }
    if (off > 0) aiEye(ctx, 540, 520, 260 * backOut(off), p.t, { mood: 'angry' });
  },

  // The first blackouts begin
  blackout(ctx, p) {
    const out = easeOut(p.u * 1.2);
    sky(ctx, ['#070a18', '#1a2246']);
    stars(ctx, p.t, 80);
    city(ctx, 1450, p.t, { lights: 1 - out, ai: 0.15, seed: 11, dark: true });
    ctx.fillStyle = '#0c1024'; ctx.fillRect(0, 1450, 1080, 600);
  },

  // Day 50: AI controls every screen, banks freezing, stores closing
  chaos(ctx, p) {
    sky(ctx, ['#120d2a', '#3a1d4d']);
    city(ctx, 1250, p.t, { lights: 0.9, ai: 1, seed: 3, dark: true });
    ctx.fillStyle = '#20263f'; ctx.fillRect(0, 1250, 1080, 700);
    // bank + store fronts
    const bank = since(p, p.args.bankWord || 'Banks', 0.4), store = since(p, p.args.storeWord || 'stores', 0.4);
    fillRR(ctx, 70, 1050, 430, 330, 10, '#e5e7eb', C.ink, 6);
    text(ctx, 'BANK', 285, 1100, 50, C.ink, { font: 'Lilita One', weight: 400 });
    fillRR(ctx, 130, 1150, 310, 230, 6, bank > 0 ? '#bae6fd' : '#475569');
    if (bank > 0) { ctx.save(); ctx.translate(285, 1260); ctx.rotate(-0.12); ctx.scale(backOut(bank), backOut(bank)); fillRR(ctx, -150, -45, 300, 90, 14, '#0ea5e9', '#ffffff', 6); text(ctx, 'FROZEN', 0, 2, 60, '#ffffff', { font: 'Lilita One', weight: 400 }); ctx.restore(); }
    fillRR(ctx, 580, 1050, 430, 330, 10, '#fef3c7', C.ink, 6);
    text(ctx, 'STORE', 795, 1100, 50, C.ink, { font: 'Lilita One', weight: 400 });
    const sh = easeOut(store);
    fillRR(ctx, 640, 1150, 310, 230, 6, '#1f2937');
    ctx.fillStyle = '#94a3b8'; ctx.fillRect(640, 1150, 310, 230 * sh);
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 4;
    for (let y = 1160; y < 1150 + 230 * sh; y += 18) { ctx.beginPath(); ctx.moveTo(640, y); ctx.lineTo(950, y); ctx.stroke(); }
    // crowd escaping
    const run = since(p, p.args.crowdWord || 'thousands', 0.3);
    for (let i = 0; i < 9; i++) {
      const x = ((i * 140 - p.lt * 260 * run) % 1300 + 1300) % 1300 - 100;
      person(ctx, x, 1700 + (i % 3) * 60, 0.42, p.t + i, { top: ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'][i % 5], hat: i % 2 ? '#334155' : null, mood: 'shock', walk: run > 0, facing: -1 });
    }
  },

  // Your camera detects movement outside
  cctv(ctx, p) {
    ctx.fillStyle = '#0a0d18'; ctx.fillRect(0, 0, 1080, 1920);
    tvFrame(ctx, 110, 470, 860, 860, () => {
      ctx.fillStyle = '#26323a'; ctx.fillRect(110, 470, 860, 860);
      ctx.save(); ctx.filter = 'grayscale(0.85) contrast(1.1)';
      sky(ctx, ['#1b2530', '#3b4a55']);
      ctx.fillStyle = '#4b5a60'; ctx.fillRect(110, 1050, 860, 300);
      for (const x of [200, 330, 860]) tree(ctx, x, 1060, 1.2, '#2c3a3a');
      fillRR(ctx, 470, 950, 200, 130, 10, '#6b7280', '#9ca3af', 6);
      const walk = clamp(p.lt / 2.5);
      family(ctx, lerp(1050, 760, walk), 1250, 0.7, p.t);
      ctx.restore();
      noise(ctx, 110, 470, 860, 860, p.t, 0.12);
      if (Math.floor(p.t * 2) % 2 === 0) circle(ctx, 160, 520, 14, C.red);
      text(ctx, 'REC  CAM 01 · ENTRANCE', 190, 522, 30, '#ffffff', { align: 'left' });
      text(ctx, 'DAY ' + String(p.st.days).padStart(3, '0') + '  23:41:' + String(Math.floor(p.lt * 1) % 60).padStart(2, '0'), 930, 1300, 26, '#e5e7eb', { align: 'right' });
    });
  },

  // A family begging to come inside
  family(ctx, p) {
    nightSky(ctx, p.t);
    mountains(ctx, 1400, '#202848', '#3a4670', 6);
    ctx.fillStyle = '#18251d'; ctx.fillRect(0, 1380, 1080, 600);
    particles(ctx, p.t, { color: '#c7d2fe', n: 60, speed: 50, size: 3, alpha: 0.5 });
    // bunker entrance hatch
    fillRR(ctx, 690, 1160, 330, 240, 16, '#4b5563', '#9ca3af', 8);
    circle(ctx, 855, 1280, 70, '#6b7280', '#d1d5db', 8);
    family(ctx, 360, 1560, 1.15, p.t);
    const b = since(p, p.args.bubbleWord || 'begging', 0.35);
    if (b > 0) {
      ctx.save(); ctx.translate(380, 760); ctx.scale(backOut(b), backOut(b));
      fillRR(ctx, -300, -90, 600, 160, 40, '#ffffff', C.ink, 8);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-40, 66); ctx.lineTo(10, 140); ctx.lineTo(40, 66); ctx.fill();
      text(ctx, p.args.bubble || 'PLEASE, LET US IN!', 0, -8, 56, C.ink, { font: 'Lilita One', weight: 400 });
      ctx.restore();
    }
  },

  // No food, no power, nowhere to go
  noicons(ctx, p) {
    nightSky(ctx, p.t);
    const items = p.args.items || [['food', 'no food'], ['power', 'no power'], ['home', 'nowhere']];
    items.forEach(([name, word], i) => {
      const a = since(p, word, 0.35);
      if (a <= 0) return;
      icon(ctx, name, 540, 560 + i * 420, 1.6 * backOut(a), p.t, { crossed: clamp(a * 2 - 0.5) });
    });
  },

  // the phone is still on… the AI could find you
  phone(ctx, p) {
    nightSky(ctx, p.t);
    const z = 1 + p.u * 0.25;
    ctx.save(); ctx.translate(540, 1000); ctx.scale(z, z); ctx.translate(-540, -1000);
    glow(ctx, C.ai, 120, () => fillRR(ctx, 330, 560, 420, 820, 60, '#0d1424', C.ai, 14));
    aiEye(ctx, 540, 900, 330, p.t, { mood: since(p, p.args.findWord || 'find', 0.3) > 0 ? 'angry' : 'smile' });
    // signal waves
    for (let i = 0; i < 4; i++) {
      const k = ((p.lt * 0.8 + i / 4) % 1);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = C.ai; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(540, 560, 80 + k * 420, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // hand
    fillRR(ctx, 280, 1180, 160, 300, 70, '#f0c19a');
    ctx.restore();
    const red = 0.5 + 0.5 * Math.sin(p.t * 6);
    ctx.fillStyle = `rgba(239,68,68,${0.12 * red * since(p, p.args.findWord || 'find', 0.3)})`; ctx.fillRect(0, 0, 1080, 1920);
  },

  // Open the door or leave them outside?
  choice(ctx, p) {
    // left: inside the bunker (warm); right: outside in the dark
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(600, 0); ctx.lineTo(480, 1920); ctx.lineTo(0, 1920); ctx.closePath(); ctx.clip();
    sky(ctx, ['#1f3a2c', '#14532d']);
    circle(ctx, 300, 980, 180, '#6b7488', '#c3cad6', 14);
    ctx.save(); ctx.translate(300, 980); ctx.rotate(p.t * 0.6); ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 14;
    for (let a = 0; a < 3; a++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-110, 0); ctx.lineTo(110, 0); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.moveTo(600, 0); ctx.lineTo(1080, 0); ctx.lineTo(1080, 1920); ctx.lineTo(480, 1920); ctx.closePath(); ctx.clip();
    sky(ctx, ['#3b0d12', '#7f1d1d']);
    particles(ctx, p.t, { color: '#fecaca', n: 40, speed: 50, size: 3, alpha: 0.4 });
    family(ctx, 800, 1300, 0.75, p.t);
    ctx.restore();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(600, 0); ctx.lineTo(480, 1920); ctx.stroke();
    const vs = backOut(clamp(p.lt / 0.5));
    ctx.save(); ctx.translate(540, 960); ctx.scale(vs, vs);
    circle(ctx, 0, 0, 90, '#ffffff', C.ink, 10);
    text(ctx, 'OR', 0, 4, 70, C.ink, { font: 'Lilita One', weight: 400 });
    ctx.restore();
  },

  // "Last time, 68% of you chose…" — recap of the previous vote (part 2+)
  recap(ctx, p) {
    sky(ctx, ['#02050d', '#0b1636']);
    const opts = p.args.results || [];
    const grow = ease(clamp((p.lt - 0.6) / 1.4));
    opts.forEach((o, i) => {
      const y = 820 + i * 260;
      fillRR(ctx, 100, y, 880, 180, 30, 'rgba(255,255,255,0.08)');
      const w = 880 * (o.percent / 100) * grow;
      if (w > 1) fillRR(ctx, 100, y, Math.max(60, w), 180, 30, o.winner ? '#16c784' : '#475569');
      text(ctx, o.label, 140, y + 62, 46, '#ffffff', { font: 'Chakra Petch', weight: 700, align: 'left' });
      text(ctx, `${Math.round(o.percent * grow)}%`, 940, y + 120, 64, '#ffffff', { font: 'Chakra Petch', weight: 700, align: 'right' });
      text(ctx, `${(o.votes || 0).toLocaleString('en-US')} votes`, 140, y + 132, 30, 'rgba(255,255,255,0.8)', { align: 'left' });
    });
  },

  // plain fallback: AI eye talking
  ai(ctx, p) {
    sky(ctx, ['#070b1c', '#14204a']);
    particles(ctx, p.t, { color: C.ai, n: 50, speed: 30, size: 3, alpha: 0.5 });
    aiEye(ctx, 540, 900, 520, p.t, { mood: p.args.mood || 'smile', look: Math.sin(p.t) });
  },
};

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}
