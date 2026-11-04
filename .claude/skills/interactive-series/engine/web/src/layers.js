// Generic, data-driven scene composer. A beat with  "scene": "compose"  draws
// args.layers in order. Every layer can appear on a spoken word ("at"), leave on
// another ("out"), enter with an animation, loop an idle motion and move.
//
// Common fields:  x, y (centre, px in 1080×1920), s (scale), at, out, anim, loop, move, alpha, rot, z
//   anim: pop | fade | up | down | left | right | drop | grow | none      (entrance, default pop)
//   loop: bob | float | shake | pulse | spin | sway | breathe | blink | flicker
//   move: { "to": [x, y], "at": "word", "dur": 1.2 }
import {
  C, sky, sun, stars, mountains, tree, person, family, house, city, icon, priceTag, globe, aiEye,
  tvFrame, noise, particles as snowParticles, fillRR, circle, text, rr, clamp, ease, easeOut, backOut, lerp, glow, rand, hash,
} from './draw.js';
import { AI, techBg, dataRain, gaiaEye, holoFrame, typed, drone, sysIcon } from './ai.js';

// ------------------------------------------------------------------ emoji (Twemoji SVG, CC-BY 4.0)
const emojiCache = new Map();
export function emojiCode(ch) {
  const cps = [...ch].map((c) => c.codePointAt(0).toString(16));
  const hasZwj = cps.includes('200d');
  return (hasZwj ? cps : cps.filter((c) => c !== 'fe0f')).join('-');
}
export async function preloadEmoji(chars) {
  await Promise.all([...new Set(chars)].map(async (ch) => {
    if (emojiCache.has(ch)) return;
    const img = new Image();
    img.src = `/node_modules/@twemoji/svg/${emojiCode(ch)}.svg`;
    try { await img.decode(); emojiCache.set(ch, img); } catch { emojiCache.set(ch, null); }
  }));
}
const imgCache = new Map();
export async function preloadImages(srcs) {
  await Promise.all([...new Set(srcs)].map(async (src) => {
    const img = new Image(); img.src = '/' + src.replace(/^\/+/, '');
    try { await img.decode(); imgCache.set(src, img); } catch { imgCache.set(src, null); }
  }));
}
/** Collect the emoji / images used by an episode so they can be preloaded. */
export function collectAssets(ep) {
  const em = [], im = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (typeof o.char === 'string') em.push(o.char);
    if (typeof o.emoji === 'string') em.push(o.emoji);
    if (typeof o.src === 'string') im.push(o.src);
    if (Array.isArray(o.items)) o.items.forEach((it) => { if (typeof it === 'object' && it?.emoji) em.push(it.emoji); });
    Object.values(o).forEach(walk);
  };
  walk(ep.beats);
  if (ep.mascot?.emoji) em.push(ep.mascot.emoji);
  return { em, im };
}
function drawEmoji(ctx, ch, size) {
  const img = emojiCache.get(ch);
  if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
  else text(ctx, ch, 0, 0, size * 0.85, '#000');
}

// ------------------------------------------------------------------ backgrounds
export const BG = {
  day: ['#7cc8f2', '#d6f0ff'], dusk: ['#3b3f78', '#f29e7a'], sunset: ['#2a1c4f', '#ff9a62'], night: ['#0b1028', '#24305e'],
  space: ['#02030a', '#0a1030'], indoor: ['#e9dcc9', '#c9b79f'], underground: ['#2a1a10', '#140c08'], ocean: ['#0b3a66', '#36a3d9'],
  forest: ['#1f3b2a', '#6aa36a'], desert: ['#f2c27a', '#ffe5b0'], snow: ['#9fb8d6', '#eef4fb'], tech: ['#03060f', '#0a1430'],
  storm: ['#1b1f2b', '#4a5568'], paper: ['#efefe9', '#e7e7e0'], blood: ['#1a0408', '#4a0a14'],
};

// ------------------------------------------------------------------ timing helpers
function timing(p, L) {
  const tIn = L.at != null ? (p.key(L.at) ?? 0) : (L.delay ?? 0);
  const dur = L.dur ?? 0.45;
  const k = clamp((p.lt - tIn) / dur);
  let outK = 0;
  if (L.out != null) { const to = typeof L.out === 'number' ? L.out : p.key(L.out); if (to != null) outK = clamp((p.lt - to) / 0.3); }
  return { k, outK, tIn, visible: p.lt >= tIn && outK < 1 };
}
function enter(ctx, L, k) {
  const a = L.anim || 'pop';
  const e = easeOut(k);
  switch (a) {
    case 'fade': ctx.globalAlpha *= e; break;
    case 'up': ctx.translate(0, (1 - e) * 80); ctx.globalAlpha *= e; break;
    case 'down': ctx.translate(0, -(1 - e) * 80); ctx.globalAlpha *= e; break;
    case 'left': ctx.translate(-(1 - e) * 1200, 0); break;
    case 'right': ctx.translate((1 - e) * 1200, 0); break;
    case 'drop': ctx.translate(0, -(1 - backOut(k, 1.6)) * 600); break;
    case 'grow': { const s = Math.max(0.001, e); ctx.scale(s, s); break; }
    case 'none': break;
    default: { const s = Math.max(0.001, backOut(k)); ctx.scale(s, s); ctx.globalAlpha *= clamp(k * 3); }
  }
}
function idle(ctx, L, t) {
  const ph = L.phase ?? (L.x || 0) * 0.013;
  switch (L.loop) {
    case 'bob': ctx.translate(0, Math.sin(t * 3 + ph) * 8); break;
    case 'float': ctx.translate(Math.sin(t * 0.8 + ph) * 10, Math.sin(t * 1.3 + ph) * 14); break;
    case 'shake': ctx.translate(Math.sin(t * 47 + ph) * 5, Math.cos(t * 39 + ph) * 4); break;
    case 'pulse': { const s = 1 + 0.06 * Math.sin(t * 5 + ph); ctx.scale(s, s); break; }
    case 'spin': ctx.rotate(t * 1.5 + ph); break;
    case 'sway': ctx.rotate(Math.sin(t * 1.6 + ph) * 0.08); break;
    case 'breathe': { const s = 1 + 0.025 * Math.sin(t * 2 + ph); ctx.scale(1, s); break; }
    case 'blink': ctx.globalAlpha *= 0.55 + 0.45 * Math.sin(t * 6 + ph); break;
    case 'flicker': ctx.globalAlpha *= hash(Math.floor(t * 12) + ph) > 0.15 ? 1 : 0.3; break;
    default: break;
  }
}
function position(p, L) {
  let x = L.x ?? 540, y = L.y ?? 960;
  if (L.move) {
    const t0 = L.move.at != null ? (p.key(L.move.at) ?? 0) : (L.move.delay ?? 0);
    const u = ease(clamp((p.lt - t0) / (L.move.dur ?? 1.2)));
    x = lerp(x, L.move.to[0], u); y = lerp(y, L.move.to[1], u);
  }
  return [x, y];
}

// ------------------------------------------------------------------ editorial palette (product promo)
export const ED = { bg: '#eeeee9', ink: '#151315', red: '#f03828', card: '#0f0f10', muted: '#8a8a86', grid: 'rgba(0,0,0,0.045)', mustard: '#cca14a' };
const SANS = 'Plus Jakarta Sans', SERIF = 'Instrument Serif', MONO = 'JetBrains Mono';

/** Headline with *italic accent* segments, revealed word by word while it is spoken. */
function headline(ctx, p, L) {
  const size = L.size ?? 66, x0 = L.x ?? 90, y0 = L.y ?? 300, maxW = L.w ?? 900, lh = size * 1.12;
  const raw = L.text || '';
  const tokens = [];
  raw.split(/(\*[^*]+\*)/).forEach((seg) => {
    if (!seg) return;
    const it = seg.startsWith('*') && seg.endsWith('*');
    (it ? seg.slice(1, -1) : seg).split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ w, it }));
  });
  // reveal: from the start of the beat's voice to its end (or "at"/"until")
  const t0 = L.at != null ? (p.key(L.at) ?? 0) : 0.1;
  const t1 = L.until != null ? (p.key(L.until) ?? p.beat.voiceDur) : (p.beat.voiceDur * (L.pace ?? 0.85) + 0.15);
  const shown = L.instant ? tokens.length : Math.floor(lerp(0, tokens.length + 0.999, clamp((p.lt - t0) / Math.max(0.3, t1 - t0))));
  let x = x0, y = y0;
  tokens.forEach((tk, i) => {
    ctx.font = tk.it ? `italic 400 ${size * 1.12}px "${SERIF}"` : `800 ${size}px "${SANS}"`;
    const w = ctx.measureText(tk.w + ' ').width;
    if (x + w - x0 > maxW && x > x0) { x = x0; y += lh; }
    if (i < shown) {
      ctx.fillStyle = tk.it ? (L.accent || ED.red) : (L.color || ED.ink);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const fresh = clamp((p.lt - t0) / Math.max(0.3, t1 - t0) * (tokens.length + 1) - i);
      ctx.globalAlpha = clamp(fresh * 2);
      ctx.fillText(tk.w, x, y);
      ctx.globalAlpha = 1;
    }
    x += w;
  });
}

function edCard(ctx, x, y, w, h, fill = ED.card) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  fillRR(ctx, x, y, w, h, 28, fill); ctx.restore();
}

function sparkline(ctx, x, y, w, h, k, color = '#ffffff', seed = 3) {
  const R = rand(seed); const pts = [];
  for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push([x + u * w, y + h - h * (0.1 + 0.15 * R() + Math.pow(u, 3) * 0.75 * (0.8 + 0.4 * R()))]); }
  const n = Math.floor(pts.length * clamp(k));
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath();
  pts.slice(0, Math.max(2, n)).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
}

function mascot(ctx, t, color = ED.red, mood = 'happy') {
  // spiky blob with a face
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 46 : 70 + Math.sin(t * 3 + i) * 3; const px = Math.cos(a) * r, py = Math.sin(a) * r; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fill();
  circle(ctx, 0, 0, 50, color);
  const blink = (t % 3.3) < 0.12;
  ctx.fillStyle = '#151315';
  for (const ex of [-16, 16]) { if (blink) ctx.fillRect(ex - 7, -6, 14, 3); else { ctx.beginPath(); ctx.ellipse(ex, -6, 6, 8, 0, 0, Math.PI * 2); ctx.fill(); } }
  ctx.strokeStyle = '#151315'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath();
  if (mood === 'sad') ctx.arc(0, 20, 10, 1.15 * Math.PI, 1.85 * Math.PI); else ctx.arc(0, 8, 12, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

// ------------------------------------------------------------------ the layer types
const LAYERS = {
  // ---------- story / world
  bg(ctx, L, p) {
    const cols = L.colors || BG[L.preset] || BG.day;
    if (L.preset === 'tech') techBg(ctx, p.t, { grid: L.grid !== false });
    else sky(ctx, cols);
    if (L.preset === 'paper' || L.grid) { ctx.strokeStyle = ED.grid; ctx.lineWidth = 2; for (let x = 0; x <= 1080; x += 72) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1920); ctx.stroke(); } for (let y = 0; y <= 1920; y += 72) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke(); } }
    if (['night', 'space', 'sunset'].includes(L.preset) && L.stars !== false) stars(ctx, p.t, L.preset === 'space' ? 140 : 70);
  },
  sun(ctx, L) { sun(ctx, L.x ?? 820, L.y ?? 300, L.r ?? 80, L.color || '#fff3b0'); },
  moon(ctx, L) { glow(ctx, 'rgba(255,248,220,0.6)', 60, () => circle(ctx, L.x ?? 820, L.y ?? 320, L.r ?? 70, '#efe9cf')); circle(ctx, (L.x ?? 820) - 20, (L.y ?? 320) - 10, (L.r ?? 70) * 0.22, '#d8d0b0'); },
  mountains(ctx, L) { mountains(ctx, L.y ?? 1300, L.color || '#9fb4cf', L.snow || '#eef4fb', L.seed ?? 3); },
  ground(ctx, L) {
    const cols = { grass: C.grass, sand: '#e8c98f', snow: '#f4f8fc', street: '#3a3f4f', floor: '#b08a62', water: '#2f86c9', dirt: '#7a5232', stone: '#8a8f9c' };
    ctx.fillStyle = L.color || cols[L.preset] || C.grass; ctx.fillRect(-100, L.y ?? 1500, 1280, 600);
    if (L.preset === 'water') for (let i = 0; i < 18; i++) { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3; const y = (L.y ?? 1500) + 30 + i * 26, off = Math.sin(p_t + i) * 30; ctx.beginPath(); ctx.moveTo(100 + off + (i % 3) * 200, y); ctx.lineTo(260 + off + (i % 3) * 200, y); ctx.stroke(); }
  },
  trees(ctx, L) { const R = rand(L.seed ?? 4); const n = L.n ?? 7; for (let i = 0; i < n; i++) tree(ctx, (i + 0.5) * (1080 / n) + (R() - 0.5) * 60, (L.y ?? 1500) - R() * 30, (L.s ?? 1.2) * (0.8 + R() * 0.5), L.color || '#3f8f4a'); },
  city(ctx, L, p) { city(ctx, L.y ?? 1500, p.t, { lights: L.lights ?? 1, ai: L.ai ?? 0, seed: L.seed ?? 5, dark: L.dark !== false }); },
  house(ctx, L, p) { house(ctx, 0, 0, L.w ?? 420, p.t, { lights: L.lights ?? 0, smoke: L.smoke !== false, sold: L.sold ? clamp(p.lt) : 0 }); },
  particles(ctx, L, p) {
    const pr = { snow: { color: '#ffffff', n: 90, speed: 70, size: 4 }, rain: { color: 'rgba(180,200,255,0.8)', n: 140, speed: 900, size: 2 }, fireflies: { color: '#ffe68a', n: 40, speed: 20, size: 4 }, embers: { color: '#ff9a3c', n: 50, speed: -80, size: 3 }, ash: { color: '#9aa0a6', n: 70, speed: 40, size: 3 }, bubbles: { color: 'rgba(255,255,255,0.6)', n: 40, speed: -90, size: 6 }, petals: { color: '#ffc9dc', n: 40, speed: 60, size: 6 }, stars: { color: '#ffffff', n: 60, speed: 8, size: 2 } }[L.preset || 'snow'];
    if (L.preset === 'data') { dataRain(ctx, p.t, { alpha: L.alpha ?? 0.25, color: L.color || AI.cyan }); return; }
    if (L.preset === 'rain') { ctx.strokeStyle = pr.color; ctx.lineWidth = 2; const R = rand(5); for (let i = 0; i < pr.n; i++) { const x = R() * 1100, y = ((R() * 2000 + p.t * pr.speed) % 2000) - 40; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 34); ctx.stroke(); } return; }
    snowParticles(ctx, pr.speed < 0 ? -p.t : p.t, { ...pr, speed: Math.abs(pr.speed), alpha: L.alpha ?? 0.8 });
  },
  vignette(ctx, L) { const g = ctx.createRadialGradient(540, 960, 400, 540, 960, 1200); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${L.amount ?? 0.5})`); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); },
  tint(ctx, L, p) { ctx.fillStyle = L.color || 'rgba(255,0,0,0.15)'; if (L.pulse) ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(p.t * 8); ctx.fillRect(0, 0, 1080, 1920); },

  // ---------- characters & props
  person(ctx, L, p) { person(ctx, 0, 0, L.s ?? 1, p.t + (L.x || 0), { ...(L.look || {}), mood: L.mood, wave: L.wave, walk: L.walk, phone: L.phone, facing: L.facing ?? 1, coat: L.coat, hat: L.hat ?? L.look?.hat }); },
  family(ctx, L, p) { family(ctx, 0, 0, L.s ?? 1, p.t); },
  emoji(ctx, L) { drawEmoji(ctx, L.char || '❓', L.size ?? 180); },
  icon(ctx, L, p) { icon(ctx, L.name || 'question', 0, 0, L.s ?? 1, p.t, { infected: L.infected ? 1 : 0, crossed: L.crossed ? clamp((p.lt - (p.key(L.crossed) ?? 0)) / 0.4) : 0 }); },
  globe(ctx, L, p) { globe(ctx, 0, 0, L.r ?? 360, p.t, L.infection ?? 0); },
  eye(ctx, L, p) { gaiaEye(ctx, 0, 0, L.r ?? 200, p.t, { color: L.color === 'red' ? AI.red : (L.color || AI.cyan), open: L.open ?? 1 }); },
  robot(ctx, L, p) { aiEye(ctx, 0, 0, L.size ?? 260, p.t, { mood: L.mood || 'calm' }); },
  drone(ctx, L, p) { drone(ctx, 0, 0, L.s ?? 1, p.t, L.color === 'red' ? AI.red : AI.cyan); },
  price(ctx, L, p) { priceTag(ctx, 0, 0, L.label || '', L.price || '', clamp((p.lt - (p.key(L.at) ?? 0)) / 0.5)); },

  // ---------- text & UI (story)
  label(ctx, L) { text(ctx, L.text || '', 0, 0, L.size ?? 48, L.color || '#ffffff', { font: L.font || 'Anton', weight: L.weight ?? 400, stroke: L.stroke ?? '#0b0d1a', lw: L.lw ?? 10, align: L.align || 'center' }); },
  number(ctx, L, p) {
    const t0 = L.at != null ? (p.key(L.at) ?? 0) : 0;
    const v = lerp(L.from ?? 0, L.to ?? 100, easeOut(clamp((p.lt - t0) / (L.count ?? 1.2))));
    const s = (L.prefix || '') + Math.round(v).toLocaleString('en-US') + (L.suffix || '');
    const st = L.style === 'editorial';
    text(ctx, s, 0, 0, L.size ?? 170, L.color || (st ? ED.ink : '#ffffff'), { font: st ? SANS : 'Anton', weight: st ? 800 : 400, stroke: st ? null : '#0b0d1a', lw: 14 });
  },
  bar(ctx, L, p) {
    const w = L.w ?? 760, h = L.h ?? 44, t0 = L.at != null ? (p.key(L.at) ?? 0) : 0;
    const v = lerp(L.from ?? 0, L.to ?? 1, ease(clamp((p.lt - t0) / (L.dur2 ?? 1.2))));
    fillRR(ctx, -w / 2, -h / 2, w, h, h / 2, 'rgba(0,0,0,0.35)', '#ffffff', 4);
    if (v > 0.01) fillRR(ctx, -w / 2 + 6, -h / 2 + 6, Math.max(h - 12, (w - 12) * v), h - 12, (h - 12) / 2, L.color || C.green);
    if (L.text) text(ctx, L.text, 0, -h, 36, '#ffffff', { font: 'Anton', weight: 400, stroke: '#0b0d1a', lw: 8 });
  },
  bubble(ctx, L, p) {
    const w = L.w ?? 640, h = L.h ?? 170;
    const dark = L.dark;
    fillRR(ctx, -w / 2, -h / 2, w, h, 40, dark ? '#151a2e' : '#ffffff', dark ? '#ffffff' : '#151a2e', 7);
    ctx.fillStyle = dark ? '#151a2e' : '#ffffff'; ctx.beginPath(); const tx = L.tail === 'right' ? w * 0.25 : -w * 0.25; ctx.moveTo(tx - 24, h / 2 - 4); ctx.lineTo(tx + (L.tail === 'right' ? 30 : -30), h / 2 + 60); ctx.lineTo(tx + 24, h / 2 - 4); ctx.fill();
    const t0 = L.at != null ? (p.key(L.at) ?? 0) : 0;
    const s = L.text || '';
    const n = L.typed === false ? s.length : Math.floor((p.lt - t0) * 26);
    text(ctx, s.slice(0, Math.max(0, n)), 0, 4, L.size ?? 54, dark ? '#ffffff' : '#151a2e', { font: 'Anton', weight: 400 });
  },
  screen(ctx, L, p) {
    // a phone / TV style screen with typed lines (messages, warnings, news)
    const w = L.w ?? 780, h = L.h ?? 520, col = L.color || AI.cyan;
    holoFrame(ctx, -w / 2, -h / 2, w, h, { color: col, fill: L.fill || 'rgba(6,12,28,0.9)' });
    let budget = (p.lt - (L.at != null ? (p.key(L.at) ?? 0) : 0)) * 22;
    (L.lines || []).forEach((ln, i) => { typed(ctx, ln, -w / 2 + 50, -h / 2 + 80 + i * 70, L.size ?? 40, col, budget, p.t, { cursor: budget > 0 && budget < ln.length, font: 'Space Mono' }); budget -= ln.length + 4; });
  },
  choices(ctx, L, p) {
    // 2–3 numbered options that light up in turn (end of episode)
    const opts = L.options || [];
    const cols = { green: '#22c55e', yellow: '#f5c542', red: '#ef4444', blue: '#3b82f6', purple: '#a855f7' };
    const w = L.w ?? 860, h = 110, gap = 34;
    opts.forEach((o, i) => {
      const y = i * (h + gap) - ((opts.length - 1) * (h + gap)) / 2;
      const k = backOut(clamp((p.lt - (L.delay ?? 0) - i * 0.25) / 0.4));
      if (k <= 0) return;
      const lit = Math.floor(p.t * 1.5) % opts.length === i;
      ctx.save(); ctx.translate(0, y); ctx.scale(k, k);
      const c = cols[o.color] || o.color || cols.green;
      fillRR(ctx, -w / 2, -h / 2, w, h, 26, lit ? c : 'rgba(10,12,24,0.85)', c, 6);
      circle(ctx, -w / 2 + 70, 0, 38, lit ? '#ffffff' : c);
      text(ctx, String(i + 1), -w / 2 + 70, 3, 50, lit ? c : '#ffffff', { font: 'Anton', weight: 400 });
      text(ctx, o.label || '', -w / 2 + 130, 4, 56, '#ffffff', { font: 'Anton', weight: 400, align: 'left' });
      ctx.restore();
    });
  },
  clock(ctx, L) {
    // game-style clock stamp: DAY 2 · 6:42 PM · ROUTE 22
    text(ctx, L.day || '', 0, -60, 30, '#ffffff', { font: 'Anton', weight: 400, align: 'left' });
    text(ctx, L.time || '', 0, 0, 74, '#ffffff', { font: 'Anton', weight: 400, align: 'left', stroke: 'rgba(0,0,0,0.4)', lw: 6 });
    text(ctx, L.place || '', 0, 52, 26, '#ffffff', { font: 'Anton', weight: 400, align: 'left' });
  },

  // ---------- editorial (product promo)
  'ed-header'(ctx, L) {
    ctx.translate(0, L.y ?? 190);
    text(ctx, L.left || '', 90, 0, 30, ED.muted, { font: MONO, weight: 400, align: 'left' });
    if (L.right) {
      ctx.font = `400 30px "${MONO}"`; const rv = L.value || '';
      const vw = ctx.measureText(rv).width;
      text(ctx, rv, 990, 0, 30, ED.red, { font: MONO, weight: 400, align: 'right' });
      text(ctx, L.right, 990 - vw - 20, 0, 30, ED.muted, { font: MONO, weight: 400, align: 'right' });
    }
  },
  'ed-headline'(ctx, L, p) { headline(ctx, p, L); },
  'ed-caption'(ctx, L) { text(ctx, L.text || '', L.align === 'center' ? 0 : -450, 0, L.size ?? 30, ED.muted, { font: MONO, weight: 400, align: L.align || 'left' }); },
  'ed-pill'(ctx, L) {
    ctx.font = `700 ${L.size ?? 38}px "${MONO}"`; const w = ctx.measureText(L.text || '').width + 50;
    fillRR(ctx, -w / 2, -34, w, 68, 34, L.color || ED.red); text(ctx, L.text || '', 0, 2, L.size ?? 38, '#ffffff', { font: MONO, weight: 700 });
  },
  'ed-terminal'(ctx, L, p) {
    const w = L.w ?? 800, h = L.h ?? 420;
    edCard(ctx, -w / 2, -h / 2, w, h);
    for (const [i, c] of ['#ff5f57', '#febc2e', '#28c840'].entries()) circle(ctx, -w / 2 + 40 + i * 30, -h / 2 + 36, 9, c);
    if (L.title) text(ctx, L.title, 0, -h / 2 + 36, 24, '#8a8a8a', { font: MONO, weight: 400 });
    let budget = (p.lt - (L.at != null ? (p.key(L.at) ?? 0) : 0.2)) * (L.speed ?? 30);
    (L.lines || []).forEach((ln, i) => {
      const s = typeof ln === 'string' ? ln : ln.text; const col = typeof ln === 'string' ? '#e8e8e8' : (ln.color || '#e8e8e8');
      const n = Math.max(0, Math.min(s.length, Math.floor(budget)));
      text(ctx, s.slice(0, n), -w / 2 + 40, -h / 2 + 100 + i * 52, L.size ?? 32, col, { font: MONO, weight: 400, align: 'left' });
      if (budget > 0 && budget < s.length && Math.floor(p.t * 3) % 2 === 0) { ctx.font = `400 ${L.size ?? 32}px "${MONO}"`; ctx.fillStyle = '#e8e8e8'; ctx.fillRect(-w / 2 + 40 + ctx.measureText(s.slice(0, n)).width + 4, -h / 2 + 100 + i * 52 - 16, 16, 32); }
      budget -= s.length + 6;
    });
  },
  'ed-stat'(ctx, L, p) {
    const w = L.w ?? 600, h = L.h ?? 420;
    edCard(ctx, -w / 2, -h / 2, w, h);
    text(ctx, L.title || 'Insights', -w / 2 + 36, -h / 2 + 50, 30, '#ffffff', { font: SANS, weight: 700, align: 'left' });
    text(ctx, L.period || '30 days', w / 2 - 36, -h / 2 + 50, 26, '#a0a0a0', { font: SANS, weight: 700, align: 'right' });
    const t0 = L.at != null ? (p.key(L.at) ?? 0) : 0;
    const v = lerp(L.from ?? 0, L.to ?? 1000, easeOut(clamp((p.lt - t0) / 1.2)));
    text(ctx, (L.prefix || '') + Math.round(v).toLocaleString('en-US') + (L.suffix || ''), -w / 2 + 36, -h / 2 + 130, 64, '#ffffff', { font: SANS, weight: 800, align: 'left' });
    if (L.delta) text(ctx, L.delta, -w / 2 + 36, -h / 2 + 182, 24, '#3ddc84', { font: SANS, weight: 700, align: 'left' });
    sparkline(ctx, -w / 2 + 36, -h / 2 + 210, w - 72, h - 250, clamp((p.lt - t0) / 1.4), '#ffffff', L.seed ?? 3);
  },
  'ed-phone'(ctx, L, p) {
    const w = L.w ?? 380, h = w * 2.05;
    edCard(ctx, -w / 2, -h / 2, w, h, '#111');
    ctx.save(); rr(ctx, -w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 30); ctx.clip();
    const img = L.src ? imgCache.get(L.src) : null;
    if (img) { const s = Math.max((w - 28) / img.width, (h - 28) / img.height); ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s); }
    else { ctx.fillStyle = L.screen || '#f4f4f0'; ctx.fillRect(-w / 2, -h / 2, w, h); if (L.emoji) drawEmoji(ctx, L.emoji, w * 0.5); if (L.text) text(ctx, L.text, 0, h * 0.3, 34, ED.ink, { font: SANS, weight: 800 }); }
    ctx.restore();
    fillRR(ctx, -50, -h / 2 + 22, 100, 24, 12, '#000');
  },
  'ed-image'(ctx, L) {
    const img = L.src ? imgCache.get(L.src) : null; const w = L.w ?? 760; if (!img) return;
    const h = L.h ?? w * img.height / img.width;
    edCard(ctx, -w / 2 - 10, -h / 2 - 10, w + 20, h + 20, '#ffffff');
    ctx.save(); rr(ctx, -w / 2, -h / 2, w, h, 20); ctx.clip(); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
  },
  'ed-bubble'(ctx, L, p) {
    const w = L.w ?? 720, h = L.h ?? 190;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    fillRR(ctx, -w / 2, -h / 2, w, h, 26, '#ffffff', ED.ink, 5); ctx.restore();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = ED.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-w / 2 + 90, h / 2 - 2); ctx.lineTo(-w / 2 + 70, h / 2 + 50); ctx.lineTo(-w / 2 + 140, h / 2 - 2); ctx.fill(); ctx.stroke();
    if (L.badge) { ctx.font = `700 26px "${MONO}"`; const bw = ctx.measureText(L.badge).width + 60; fillRR(ctx, -w / 2 - 10, -h / 2 - 30, bw, 52, 12, ED.red); circle(ctx, -w / 2 + 16, -h / 2 - 4, 14, '#ffffff'); text(ctx, String(L.n ?? 1), -w / 2 + 16, -h / 2 - 3, 22, ED.red, { font: MONO, weight: 700 }); text(ctx, L.badge, -w / 2 + 40, -h / 2 - 3, 26, '#ffffff', { font: MONO, weight: 700, align: 'left' }); }
    text(ctx, L.small || 'you might think', -w / 2 + 40, -h / 2 + 50, 24, ED.muted, { font: MONO, weight: 400, align: 'left' });
    const t0 = L.at != null ? (p.key(L.at) ?? 0) : 0;
    const s = L.text || ''; const n = Math.floor((p.lt - t0) * 22);
    text(ctx, s.slice(0, Math.max(0, n)) + ((Math.floor(p.t * 3) % 2 && n < s.length + 6) ? '|' : ''), -w / 2 + 40, 20, L.size ?? 50, ED.ink, { font: SANS, weight: 700, align: 'left' });
  },
  'ed-steps'(ctx, L, p) {
    const items = L.items || []; const n = items.length; const w = L.w ?? 260, gap = 24, h = L.h ?? 320;
    items.forEach((it, i) => {
      const x = (i - (n - 1) / 2) * (w + gap);
      const k = backOut(clamp((p.lt - (it.at != null ? (p.key(it.at) ?? 0) : i * 0.3)) / 0.4));
      if (k <= 0) return;
      ctx.save(); ctx.translate(x, 0); ctx.scale(k, k); ctx.rotate((i - 1) * 0.03);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8; fillRR(ctx, -w / 2, -h / 2, w, h, 22, '#ffffff', ED.ink, 4); ctx.restore();
      circle(ctx, -w / 2 + 36, -h / 2 + 38, 18, ED.ink); text(ctx, String(i + 1), -w / 2 + 36, -h / 2 + 39, 22, '#ffffff', { font: MONO, weight: 700 });
      text(ctx, it.label || '', -w / 2 + 66, -h / 2 + 40, 30, ED.ink, { font: SANS, weight: 800, align: 'left' });
      if (it.emoji) { ctx.save(); ctx.translate(0, 20); drawEmoji(ctx, it.emoji, w * 0.45); ctx.restore(); }
      const st = it.stamp != null ? clamp((p.lt - (p.key(it.stamp) ?? 999)) / 0.3) : 0;
      if (st > 0) { ctx.save(); ctx.translate(0, h / 2 - 60); ctx.rotate(-0.18); const s = 1.6 - 0.6 * backOut(st); ctx.scale(s, s); ctx.globalAlpha = clamp(st * 2); ctx.strokeStyle = ED.red; ctx.lineWidth = 5; ctx.strokeRect(-100, -30, 200, 60); text(ctx, it.stampText || 'APPROVED', 0, 2, 30, ED.red, { font: MONO, weight: 700 }); ctx.restore(); }
      ctx.restore();
    });
  },
  'ed-check'(ctx, L, p) {
    // checklist that ticks items on spoken words
    const items = L.items || []; const w = L.w ?? 760;
    edCard(ctx, -w / 2, -40, w, items.length * 84 + 50);
    items.forEach((it, i) => {
      const s = typeof it === 'string' ? it : it.text; const at = typeof it === 'string' ? null : it.at;
      const done = clamp((p.lt - (at != null ? (p.key(at) ?? 0) : 0.3 + i * 0.5)) / 0.3);
      const y = 20 + i * 84;
      circle(ctx, -w / 2 + 56, y, 22, done > 0 ? '#3ddc84' : null, done > 0 ? '#3ddc84' : '#666', 4);
      if (done > 0) { ctx.strokeStyle = '#0f0f10'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-w / 2 + 45, y); ctx.lineTo(-w / 2 + 54, y + 9); ctx.lineTo(-w / 2 + 68, y - 9); ctx.stroke(); }
      text(ctx, s, -w / 2 + 100, y + 2, 34, done > 0 ? '#ffffff' : '#8a8a8a', { font: SANS, weight: 700, align: 'left' });
    });
  },
  'ed-sticker'(ctx, L) {
    // big chunky outlined title, like a sticker
    const s = L.text || ''; const size = L.size ?? 120;
    ctx.save(); ctx.rotate(L.rot ?? -0.04);
    text(ctx, s, 6, 10, size, ED.ink, { font: 'Anton', weight: 400 });
    text(ctx, s, 0, 0, size, '#ffffff', { font: 'Anton', weight: 400, stroke: ED.ink, lw: 12 });
    ctx.restore();
  },
  'ed-stamp'(ctx, L, p) {
    const k = clamp((p.lt - (p.key(L.at) ?? 0)) / 0.3); const s = 1.8 - 0.8 * backOut(k);
    ctx.rotate(-0.14); ctx.scale(s, s); ctx.globalAlpha *= clamp(k * 2);
    ctx.strokeStyle = L.color || ED.red; ctx.lineWidth = 8; ctx.font = `700 ${L.size ?? 64}px "${MONO}"`;
    const w = ctx.measureText(L.text || '').width + 60; ctx.strokeRect(-w / 2, -50, w, 100);
    text(ctx, L.text || 'APPROVED', 0, 4, L.size ?? 64, L.color || ED.red, { font: MONO, weight: 700 });
  },
  'ed-comment'(ctx, L, p) {
    // Instagram-like comment field that types the keyword, then a red keyword pill pops
    const w = L.w ?? 860;
    fillRR(ctx, -w / 2, -45, w, 90, 45, '#ffffff', '#d8d8d2', 3);
    circle(ctx, -w / 2 + 50, 0, 26, '#e3e3dd');
    const t0 = L.at != null ? (p.key(L.at) ?? 0) : 0.2;
    const s = L.keyword || 'PLAYBOOK'; const n = Math.floor((p.lt - t0) * 10);
    text(ctx, n > 0 ? s.slice(0, n) : 'Add a comment…', -w / 2 + 96, 2, 36, n > 0 ? ED.ink : '#9a9a96', { font: SANS, weight: 700, align: 'left' });
    const k = backOut(clamp((p.lt - t0 - s.length / 10 - 0.2) / 0.4));
    if (k > 0) { ctx.save(); ctx.translate(0, 140); ctx.scale(k, k); ctx.font = `700 64px "${MONO}"`; const pw = ctx.measureText(s).width + 80; fillRR(ctx, -pw / 2, -50, pw, 100, 50, ED.red, '#ffffff', 6); text(ctx, s, 0, 4, 64, '#ffffff', { font: MONO, weight: 700 }); ctx.restore(); }
  },
  'ed-mascot'(ctx, L, p) { if (L.s) ctx.scale(L.s, L.s); mascot(ctx, p.t, L.color || ED.red, L.mood); },
  'ed-qmarks'(ctx, L, p) { const R = rand(L.seed ?? 2); for (let i = 0; i < (L.n ?? 7); i++) { const x = (R() - 0.5) * 760, y = (R() - 0.5) * 460; ctx.globalAlpha = 0.25; text(ctx, '?', x + Math.sin(p.t * 1.3 + i) * 10, y + Math.cos(p.t + i) * 10, 48 + R() * 40, ED.muted, { font: SANS, weight: 800 }); } ctx.globalAlpha = 1; },
};
let p_t = 0;

/** Draw every layer of a compose beat. */
export function drawLayers(ctx, p, layers = []) {
  p_t = p.t;
  for (const L of layers) {
    const fn = LAYERS[L.type];
    if (!fn) continue;
    const full = ['bg', 'particles', 'vignette', 'tint', 'mountains', 'ground', 'trees', 'city', 'ed-header', 'ed-headline'].includes(L.type);
    if (full) {
      const { visible, k, outK } = timing(p, L);
      if (!visible && (L.at != null || L.delay)) continue;
      ctx.save(); ctx.globalAlpha = (L.alpha ?? 1) * (L.at != null || L.delay ? easeOut(k) : 1) * (1 - outK); fn(ctx, L, p); ctx.restore();
      continue;
    }
    const { k, outK, visible } = timing(p, L);
    if (!visible) continue;
    const [x, y] = position(p, L);
    ctx.save();
    ctx.globalAlpha = (L.alpha ?? 1) * (1 - outK);
    ctx.translate(x, y);
    enter(ctx, L, k);
    idle(ctx, L, p.t);
    if (L.rot) ctx.rotate(L.rot);
    if (L.flip) ctx.scale(-1, 1);
    fn(ctx, L, p);
    ctx.restore();
  }
}

export const LAYER_TYPES = Object.keys(LAYERS);
