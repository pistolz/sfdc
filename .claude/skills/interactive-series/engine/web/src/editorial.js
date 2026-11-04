// Editorial "tech creator" look, measured on the reference videos (scaled ×1.5 from 720p):
//   off-white grid paper · mono header at y≈290 · headline x=132 y≈404 size≈66 (words fade grey→ink)
//   content block centred around y≈930 · mascot centre-right around (735, 1360)
//   neo-brutalist accents: thick ink outlines + hard black offset shadows on bubbles / pills / stickers
import { text, fillRR, rr, circle, clamp, lerp, ease, easeOut, backOut, rand } from './draw.js';

export const ED = {
  bg: '#eeeee9', grid: 'rgba(20,20,20,0.055)', gridBig: 'rgba(20,20,20,0.035)',
  ink: '#151315', ghost: '#c4c4be', muted: '#8b8b86', red: '#ef3b2c', redSoft: '#f7b7ae',
  card: '#1b1b1d', cardLine: '#2b2b2f', yellow: '#f2c230', yellowDark: '#d9a91c', green: '#3fbf6a', white: '#ffffff',
  mascot: '#c55a40', mascotDark: '#6e2a1a',
};
export const F = { sans: 'Plus Jakarta Sans', serif: 'Instrument Serif', mono: 'JetBrains Mono', display: 'Anton' };
export const MARGIN = 132;

// ------------------------------------------------------------------ primitives
export function paper(ctx) {
  ctx.fillStyle = ED.bg; ctx.fillRect(0, 0, 1080, 1920);
  // soft light falloff like printed paper
  const g = ctx.createRadialGradient(540, 700, 100, 540, 900, 1400);
  g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  ctx.lineWidth = 2;
  for (let x = 30; x <= 1080; x += 72) { ctx.strokeStyle = (x - 30) % 288 === 0 ? ED.gridBig : ED.grid; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1920); ctx.stroke(); }
  for (let y = 24; y <= 1920; y += 72) { ctx.strokeStyle = ED.grid; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke(); }
}

/** Neo-brutalist box: hard offset ink shadow + ink outline. */
export function brutal(ctx, x, y, w, h, r, fill, { off = 9, lw = 5, ink = ED.ink } = {}) {
  fillRR(ctx, x + off, y + off, w, h, r, ink);
  fillRR(ctx, x, y, w, h, r, fill, ink, lw);
}
/** Soft card (dark UI windows). */
export function softCard(ctx, x, y, w, h, r = 26, fill = ED.card) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 16;
  fillRR(ctx, x, y, w, h, r, fill); ctx.restore();
}
function lights(ctx, x, y) { [['#ff5f57'], ['#febc2e'], ['#28c840']].forEach(([c], i) => circle(ctx, x + i * 26, y, 8, c)); }

function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (sh) => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, clamp(t)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

// ------------------------------------------------------------------ headline (spoken, word by word)
export function headline(ctx, p, L) {
  const size = L.size ?? 66, x0 = L.x ?? MARGIN, y0 = L.y ?? 404, maxW = L.w ?? (1080 - 2 * MARGIN), lh = size * 1.18;
  const tokens = [];
  (L.text || '').split(/(\*[^*]+\*)/).forEach((seg) => {
    if (!seg) return;
    const it = seg.startsWith('*') && seg.endsWith('*');
    (it ? seg.slice(1, -1) : seg).split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ w, it }));
  });
  const t0 = L.at != null ? (p.key(L.at) ?? 0) : 0.12;
  const t1 = L.until != null ? (p.key(L.until) ?? p.beat.voiceDur) : (p.beat.voiceDur * (L.pace ?? 0.92) + 0.12);
  const per = Math.max(0.05, (t1 - t0) / Math.max(1, tokens.length));
  let x = x0, y = y0;
  tokens.forEach((tk, i) => {
    const font = tk.it ? `italic 400 ${size * 1.16}px "${F.serif}"` : `700 ${size}px "${F.sans}"`;
    ctx.font = font;
    const w = ctx.measureText(tk.w).width, sp = ctx.measureText(' ').width;
    if (x + w - x0 > maxW && x > x0) { x = x0; y += lh; }
    const k = L.instant ? 1 : clamp((p.lt - (t0 + i * per)) / 0.28);
    if (k > 0) {
      ctx.globalAlpha = clamp(k * 1.6);
      ctx.fillStyle = tk.it ? lerpColor(ED.redSoft, L.accent || ED.red, k) : lerpColor(ED.ghost, L.color || ED.ink, k);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(tk.w, x, y + (1 - easeOut(k)) * 10);
      ctx.globalAlpha = 1;
    }
    x += w + sp;
  });
}

// ------------------------------------------------------------------ mascot: a little round creature with arms
export function mascot(ctx, t, { mood = 'happy', color = ED.mascot, look = 0 } = {}) {
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(0, 108, 70, 12, 0, 0, Math.PI * 2); ctx.fill();
  const dark = ED.mascotDark;
  // arms / spikes: rounded tentacles with a small knob
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + Math.sin(t * 2 + i) * 0.05;
    const len = 88 + Math.sin(t * 3 + i * 1.7) * 5;
    const bend = Math.sin(t * 2.2 + i) * 0.12;
    const x1 = Math.cos(a + bend) * len, y1 = Math.sin(a + bend) * len;
    const mx = Math.cos(a) * len * 0.55, my = Math.sin(a) * len * 0.55;
    ctx.lineCap = 'round';
    ctx.strokeStyle = dark; ctx.lineWidth = 19; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
    circle(ctx, x1, y1, 9, color, dark, 3);
  }
  circle(ctx, 0, 0, 52, color, dark, 3.5);
  // face
  const blink = (t % 3.6) < 0.11;
  const ex = 20, ey = -8;
  for (const sx of [-1, 1]) {
    if (blink || mood === 'wink' && sx > 0) { ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx * ex - 9, ey); ctx.quadraticCurveTo(sx * ex, ey + 6, sx * ex + 9, ey); ctx.stroke(); continue; }
    const r = mood === 'shock' ? 13 : 11;
    circle(ctx, sx * ex, ey, r, '#ffffff', dark, 3);
    circle(ctx, sx * ex + look * 3, ey + 1, mood === 'shock' ? 5 : 6, '#1a1a1a');
    circle(ctx, sx * ex + look * 3 + 2, ey - 2, 2, '#ffffff');
  }
  // blush
  ctx.fillStyle = 'rgba(255,140,150,0.75)';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 34, 10, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); }
  // mouth
  ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.lineCap = 'round';
  if (mood === 'shock') { circle(ctx, 0, 22, 10, '#5a1810', dark, 3); }
  else if (mood === 'sad') { ctx.beginPath(); ctx.arc(0, 30, 11, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
  else {
    ctx.fillStyle = '#5a1810'; ctx.beginPath(); ctx.moveTo(-14, 14); ctx.quadraticCurveTo(0, 38, 14, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff8a8a'; ctx.beginPath(); ctx.ellipse(0, 26, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// ------------------------------------------------------------------ syntax highlight for code cards
function codeTokens(line) {
  const out = []; const re = /('[^']*'|"[^"]*")|(\b[a-zA-Z_]\w*)(?=\()|(\/\/.*$)|([^'"/\w]+|\w+|\/)/g; let m;
  while ((m = re.exec(line))) {
    if (m[1]) out.push([m[1], '#ff6b5e']);
    else if (m[2]) out.push([m[2], '#f2c230']);
    else if (m[3]) out.push([m[3], '#6f6f76']);
    else out.push([m[4], '#e9e9ec']);
  }
  return out;
}

// ------------------------------------------------------------------ layers
export const ED_LAYERS = {
  'ed-paper'(ctx) { paper(ctx); },
  'ed-header'(ctx, L) {
    const y = L.y ?? 290;
    text(ctx, L.left || '', MARGIN, y, 24, ED.muted, { font: F.mono, weight: 400, align: 'left' });
    if (L.right || L.value) {
      ctx.font = `400 24px "${F.mono}"`;
      const vw = ctx.measureText(L.value || '').width;
      text(ctx, L.value || '', 1080 - MARGIN, y, 24, ED.red, { font: F.mono, weight: 400, align: 'right' });
      text(ctx, L.right || '', 1080 - MARGIN - vw - 22, y, 24, ED.muted, { font: F.mono, weight: 400, align: 'right' });
    }
  },
  'ed-headline'(ctx, L, p) { headline(ctx, p, L); },
  'ed-caption'(ctx, L) { text(ctx, L.text || '', 0, 0, L.size ?? 24, ED.muted, { font: F.mono, weight: 400, align: L.align || 'center' }); },

  'ed-sticker'(ctx, L) {
    // chunky condensed title: hard shadow, thick ink outline, thin white inner line; words after "|" are red
    const size = L.size ?? 150;
    const parts = String(L.text || '').split('|');
    ctx.save(); ctx.rotate(L.rot ?? -0.035);
    ctx.font = `400 ${size}px "${F.display}"`; ctx.lineJoin = 'round'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const widths = parts.map((s) => ctx.measureText(s).width);
    const gap = size * 0.14, total = widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
    const pass = (fn) => { let x = -total / 2; parts.forEach((s, i) => { fn(s, x, i); x += widths[i] + gap; }); };
    const o = size * 0.06;
    pass((s, x) => { ctx.strokeStyle = ED.ink; ctx.lineWidth = size * 0.12; ctx.strokeText(s, x + o, o * 1.3); ctx.fillStyle = ED.ink; ctx.fillText(s, x + o, o * 1.3); });
    pass((s, x) => { ctx.strokeStyle = ED.ink; ctx.lineWidth = size * 0.12; ctx.strokeText(s, x, 0); });
    pass((s, x) => { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = size * 0.05; ctx.strokeText(s, x, 0); });
    pass((s, x, i) => { ctx.fillStyle = i === 0 ? (L.color || ED.ink) : (L.accent || ED.red); ctx.fillText(s, x, 0); });
    ctx.restore();
  },
  'ed-folder'(ctx, L, p) {
    const w = L.w ?? 520, h = w * 0.66;
    const open = clamp((p.lt - (L.openAt != null ? (p.key(L.openAt) ?? 999) : 999)) / 0.5);
    // back panel + tab
    fillRR(ctx, -w / 2, -h / 2 - 40, w * 0.38, 70, 18, ED.yellowDark);
    fillRR(ctx, -w / 2, -h / 2, w, h, 22, ED.yellowDark);
    // cards popping out of the folder
    (L.cards || []).forEach((c, i) => {
      const k = backOut(clamp((open - i * 0.15) * 1.6));
      if (k <= 0) return;
      ctx.save(); ctx.translate((i - (L.cards.length - 1) / 2) * w * 0.24, -h * 0.25 - k * h * 0.35); ctx.rotate((i - 1) * 0.12);
      fillRR(ctx, -w * 0.13, -h * 0.3, w * 0.26, h * 0.6, 12, '#2a2a2e', '#ffffff', 5);
      if (c.emoji && p.emoji) p.emoji(ctx, c.emoji, w * 0.14);
      if (c.text) text(ctx, c.text, 0, h * 0.18, 22, '#ffffff', { font: F.display, weight: 400 });
      ctx.restore();
    });
    // front panel
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
    fillRR(ctx, -w / 2 - 6, -h / 2 + 50, w + 12, h - 40, 24, ED.yellow); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 4; rr(ctx, -w / 2 + 6, -h / 2 + 58, w - 12, h - 56, 20); ctx.stroke();
    // label
    ctx.font = `400 34px "${F.mono}"`; const lw = ctx.measureText(L.label || 'folder').width + 70;
    fillRR(ctx, -lw / 2, h * 0.12 - 34, lw, 68, 10, '#fbf6e8');
    text(ctx, L.label || 'folder', 0, h * 0.12, 34, ED.ink, { font: F.mono, weight: 400 });
    // asterisk
    ctx.save(); ctx.translate(w / 2 - 50, -h / 2 + 110); ctx.rotate(p.t * 0.8); ctx.strokeStyle = ED.red; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke(); }
    ctx.restore();
  },
  'ed-code'(ctx, L, p) {
    const w = L.w ?? 420, lines = L.lines || [], h = L.h ?? (80 + lines.length * 44 + 20);
    softCard(ctx, -w / 2, -h / 2, w, h, 22);
    lights(ctx, -w / 2 + 30, -h / 2 + 28);
    if (L.title) text(ctx, L.title, 0, -h / 2 + 28, 20, '#7d7d84', { font: F.mono, weight: 400 });
    if (L.label) text(ctx, L.label, 0, -h / 2 - 44, 44, ED.ink, { font: F.display, weight: 400 });
    let budget = (p.lt - (L.at != null ? (p.key(L.at) ?? 0) : 0.1)) * (L.speed ?? 40);
    lines.forEach((ln, i) => {
      let x = -w / 2 + 26; const y = -h / 2 + 82 + i * 44;
      for (const [s, col] of codeTokens(ln)) {
        const n = Math.max(0, Math.min(s.length, Math.floor(budget)));
        if (n > 0) text(ctx, s.slice(0, n), x, y, L.size ?? 22, col, { font: F.mono, weight: 400, align: 'left' });
        ctx.font = `400 ${L.size ?? 22}px "${F.mono}"`; x += ctx.measureText(s).width; budget -= s.length;
        if (budget <= 0) break;
      }
      budget -= 4;
    });
  },
  'ed-prompt'(ctx, L, p) {
    // single-line terminal: "> idea typed" + small "sent"
    const w = L.w ?? 720, h = 120;
    softCard(ctx, -w / 2, -h / 2, w, h, 20);
    lights(ctx, -w / 2 + 30, -h / 2 + 26);
    if (L.title) text(ctx, L.title, 0, -h / 2 + 26, 18, '#7d7d84', { font: F.mono, weight: 400 });
    const tA = L.typeAt ?? L.at; const s = L.text || ''; const n = Math.floor((p.lt - (tA != null ? (p.key(tA) ?? 0) : 0.1)) * (L.speed ?? 22));
    text(ctx, '>', -w / 2 + 30, 20, 30, ED.red, { font: F.mono, weight: 700, align: 'left' });
    text(ctx, s.slice(0, Math.max(0, n)), -w / 2 + 62, 20, 30, '#f2f2f2', { font: F.mono, weight: 400, align: 'left' });
    if (n >= s.length + 8) { ctx.font = `400 30px "${F.mono}"`; text(ctx, 'sent', -w / 2 + 70 + ctx.measureText(s).width, 24, 18, ED.green, { font: F.mono, weight: 400, align: 'left' }); }
    else if (Math.floor(p.t * 3) % 2 === 0 && n >= 0) { ctx.font = `400 30px "${F.mono}"`; ctx.fillStyle = '#f2f2f2'; ctx.fillRect(-w / 2 + 64 + ctx.measureText(s.slice(0, Math.max(0, n))).width, 4, 14, 32); }
  },
  'ed-build'(ctx, L, p) {
    // progress card: "✳ building 4/5" + checklist that ticks on words + red progress bar
    const items = L.items || []; const w = L.w ?? 400, h = 110 + items.length * 54 + 40;
    softCard(ctx, -w / 2, -h / 2, w, h, 22);
    const done = items.map((it) => clamp((p.lt - (it.at != null ? (p.key(it.at) ?? 0) : 0)) / 0.25));
    const count = done.filter((d) => d >= 1).length;
    ctx.save(); ctx.translate(-w / 2 + 34, -h / 2 + 42); ctx.rotate(p.t); ctx.strokeStyle = ED.red; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke(); } ctx.restore();
    text(ctx, L.title || 'building', -w / 2 + 60, -h / 2 + 42, 24, '#e9e9ec', { font: F.mono, weight: 400, align: 'left' });
    text(ctx, `${count}/${items.length}`, w / 2 - 30, -h / 2 + 42, 22, ED.red, { font: F.mono, weight: 400, align: 'right' });
    ctx.fillStyle = ED.cardLine; ctx.fillRect(-w / 2 + 20, -h / 2 + 72, w - 40, 2);
    items.forEach((it, i) => {
      const y = -h / 2 + 116 + i * 54, d = done[i];
      if (d >= 1) { circle(ctx, -w / 2 + 40, y, 15, ED.yellow); ctx.strokeStyle = ED.card; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(-w / 2 + 32, y); ctx.lineTo(-w / 2 + 38, y + 6); ctx.lineTo(-w / 2 + 49, y - 6); ctx.stroke(); }
      else { ctx.save(); ctx.translate(-w / 2 + 40, y); ctx.rotate(p.t * 6); ctx.strokeStyle = ED.red; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 1.4); ctx.stroke(); ctx.restore(); }
      text(ctx, it.text || it, -w / 2 + 72, y + 1, 26, d >= 1 ? '#ffffff' : '#bdbdc3', { font: F.sans, weight: 700, align: 'left' });
    });
    const prog = items.length ? done.reduce((a, b) => a + b, 0) / items.length : 0;
    fillRR(ctx, -w / 2 + 20, h / 2 - 34, w - 40, 10, 5, ED.cardLine);
    if (prog > 0) fillRR(ctx, -w / 2 + 20, h / 2 - 34, (w - 40) * prog, 10, 5, ED.red);
  },
  'ed-phone'(ctx, L, p) {
    const w = L.w ?? 230, h = w * 2.1;
    softCard(ctx, -w / 2, -h / 2, w, h, 34, '#0c0c0e');
    fillRR(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 30, null, '#3a3a40', 3);
    ctx.save(); rr(ctx, -w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 26); ctx.clip();
    const img = L.src && p.image ? p.image(L.src) : null;
    if (img) { const s = Math.max((w - 24) / img.width, (h - 24) / img.height); ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s); }
    else {
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, L.top || '#1d2b4a'); g.addColorStop(1, L.bottom || '#0d0f1a');
      ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
      if (L.emoji && p.emoji) p.emoji(ctx, L.emoji, w * 0.55);
      if (L.title) text(ctx, L.title, 0, -h * 0.32, 30, '#ffffff', { font: F.display, weight: 400, stroke: '#000', lw: 6 });
      (L.buttons || []).forEach((b, i, arr) => { const bx = (i - (arr.length - 1) / 2) * 80; fillRR(ctx, bx - 36, -h * 0.22, 72, 34, 17, b.color || ED.red, '#fff', 2); text(ctx, b.text, bx, -h * 0.22 + 18, 18, '#fff', { font: F.display, weight: 400 }); });
      if (L.bars) { const R = rand(4); for (let i = 0; i < 18; i++) { const bh = 10 + Math.abs(Math.sin(p.t * 6 + i)) * 40 * R(); fillRR(ctx, -w / 2 + 20 + i * ((w - 40) / 18), h / 2 - 30 - bh, (w - 40) / 18 - 4, bh, 2, ED.yellow); } }
    }
    ctx.restore();
    fillRR(ctx, -w * 0.18, -h / 2 + 16, w * 0.36, 18, 9, '#000');
    if (L.label) text(ctx, L.label, 0, -h / 2 - 44, 44, ED.ink, { font: F.display, weight: 400 });
  },
  'ed-arrow'(ctx, L, p) {
    const len = L.len ?? 60; ctx.strokeStyle = ED.ink; ctx.lineWidth = 4; ctx.setLineDash([8, 7]); ctx.lineDashOffset = -p.t * 30;
    ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2 - 8, 0); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ED.ink; ctx.beginPath(); ctx.moveTo(len / 2, 0); ctx.lineTo(len / 2 - 14, -8); ctx.lineTo(len / 2 - 14, 8); ctx.closePath(); ctx.fill();
  },
  'ed-pill'(ctx, L, p) {
    // brutal pill (white or red); optional crossed icon text e.g. "📷 camera"
    ctx.font = `${L.mono === false ? 700 : 400} ${L.size ?? 30}px "${L.mono === false ? F.sans : F.mono}"`;
    const w = ctx.measureText(L.text || '').width + (L.icon ? 110 : 60), h = (L.size ?? 30) * 2.1;
    brutal(ctx, -w / 2, -h / 2, w, h, h / 2.4, L.fill || (L.red ? ED.red : '#ffffff'), { off: 6, lw: 4 });
    let tx = 0;
    if (L.icon && p.emoji) { ctx.save(); ctx.translate(-w / 2 + 50, 0); p.emoji(ctx, L.icon, h * 0.62); if (L.crossed) { ctx.strokeStyle = ED.red; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-24, 18); ctx.lineTo(24, -18); ctx.stroke(); } ctx.restore(); tx = 28; }
    text(ctx, L.text || '', tx, 2, L.size ?? 30, L.red ? '#ffffff' : ED.ink, { font: L.mono === false ? F.sans : F.mono, weight: L.mono === false ? 700 : 400 });
  },
  'ed-bubble'(ctx, L, p) {
    const w = L.w ?? 640, h = L.h ?? 220;
    // tail (bottom right) + body with hard shadow
    ctx.fillStyle = ED.ink; ctx.beginPath(); ctx.moveTo(w * 0.22 + 8, h / 2 - 2 + 8); ctx.lineTo(w * 0.34 + 8, h / 2 + 64 + 8); ctx.lineTo(w * 0.36 + 8, h / 2 - 2 + 8); ctx.fill();
    brutal(ctx, -w / 2, -h / 2, w, h, 30, '#ffffff', { off: 9, lw: 5 });
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = ED.ink; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(w * 0.22, h / 2 - 3); ctx.lineTo(w * 0.34, h / 2 + 64); ctx.lineTo(w * 0.36, h / 2 - 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(w * 0.22 + 3, h / 2 - 8, w * 0.14 - 6, 8);
    // numbered tab
    if (L.badge) {
      ctx.font = `700 26px "${F.mono}"`; const bw = ctx.measureText(L.badge).width + 40;
      fillRR(ctx, -w / 2 + 14, -h / 2 - 26, 52, 52, 8, ED.red); text(ctx, String(L.n ?? 1), -w / 2 + 40, -h / 2 + 1, 32, '#ffffff', { font: F.display, weight: 400 });
      fillRR(ctx, -w / 2 + 66, -h / 2 - 22, bw, 44, 6, ED.ink); text(ctx, L.badge, -w / 2 + 66 + bw / 2, -h / 2 + 1, 24, '#ffffff', { font: F.mono, weight: 700 });
    }
    text(ctx, L.small ?? 'you might think', -w / 2 + 34, -h / 2 + 62, 24, ED.muted, { font: F.mono, weight: 400, align: 'left' });
    const tA = L.typeAt ?? L.at; const t0 = tA != null ? (p.key(tA) ?? 0) : 0.2;
    const s = L.text || ''; const n = Math.max(0, Math.floor((p.lt - t0) * (L.speed ?? 18)));
    const shown = s.slice(0, n);
    text(ctx, shown, -w / 2 + 34, 30, L.size ?? 46, ED.ink, { font: F.sans, weight: 700, align: 'left' });
    if (n < s.length + 10 && Math.floor(p.t * 2.5) % 2 === 0) { ctx.font = `700 ${L.size ?? 46}px "${F.sans}"`; ctx.fillStyle = ED.red; ctx.fillRect(-w / 2 + 38 + ctx.measureText(shown).width, 4, 4, 52); }
  },
  'ed-qmarks'(ctx, L, p) {
    const pts = L.points || [[-330, -130, 70], [140, -190, 52], [300, -130, 64], [300, 190, 56], [-260, 170, 0]];
    pts.forEach(([x, y, s], i) => { if (!s) return; ctx.save(); ctx.translate(x, y + Math.sin(p.t * 1.4 + i) * 8); ctx.rotate(Math.sin(p.t + i) * 0.12); text(ctx, '?', 0, 0, s * 2.0, '#c6c6bf', { font: F.sans, weight: 800 }); ctx.restore(); });
  },
  'ed-check'(ctx, L, p) { ED_LAYERS['ed-build'](ctx, { ...L, title: L.title || 'checklist' }, p); },
  'ed-stat'(ctx, L, p) {
    const w = L.w ?? 560, h = L.h ?? 520;
    softCard(ctx, -w / 2, -h / 2, w, h, 34, '#0f0f10');
    text(ctx, L.title || 'Account', -w / 2 + 34, -h / 2 + 46, 26, '#ffffff', { font: F.sans, weight: 700, align: 'left' });
    text(ctx, (L.period || '30 days') + ' ⌄', w / 2 - 34, -h / 2 + 46, 22, '#c9c9cf', { font: F.sans, weight: 700, align: 'right' });
    const t0 = L.at != null ? (p.key(L.at) ?? 0) : 0;
    const k = easeOut(clamp((p.lt - t0) / 1.3));
    const tiles = L.tiles || [{ label: L.label || 'Views', value: L.to ?? 1000 }];
    tiles.slice(0, 3).forEach((tl, i) => {
      const tx = -w / 2 + 24 + i * ((w - 48) / Math.min(3, tiles.length)), tw = (w - 48) / Math.min(3, tiles.length) - 12;
      fillRR(ctx, tx, -h / 2 + 82, tw, 100, 16, '#1d1d20', i === 0 ? '#ffffff' : null, 3);
      text(ctx, tl.label, tx + 18, -h / 2 + 114, 18, '#a9a9b0', { font: F.sans, weight: 700, align: 'left' });
      const v = typeof tl.value === 'number' ? (tl.prefix || '') + Math.round(tl.value * k).toLocaleString('en-US') + (tl.suffix || '') : tl.value;
      text(ctx, v, tx + 18, -h / 2 + 152, 30, '#ffffff', { font: F.sans, weight: 700, align: 'left' });
    });
    // chart
    const cx = -w / 2 + 40, cy = -h / 2 + 220, cw = w - 80, ch = h - 290;
    ctx.strokeStyle = '#2a2a2e'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx, cy + i * ch / 2); ctx.lineTo(cx + cw, cy + i * ch / 2); ctx.stroke(); }
    const R = rand(L.seed ?? 5); const pts = [];
    for (let i = 0; i <= 30; i++) { const u = i / 30; const spike = Math.exp(-Math.pow((u - 0.78) * 9, 2)) + 0.6 * Math.exp(-Math.pow((u - 0.66) * 12, 2)); pts.push([cx + u * cw, cy + ch - ch * (0.02 + 0.05 * R() + spike * 0.9)]); }
    const n = Math.max(2, Math.floor(pts.length * clamp((p.lt - t0) / 1.6)));
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); pts.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    if (L.dates) L.dates.forEach((d, i) => text(ctx, d, cx + (i / (L.dates.length - 1)) * cw, cy + ch + 26, 16, '#8a8a90', { font: F.sans, weight: 700 }));
  },
  'ed-big'(ctx, L, p) {
    const t0 = L.at != null ? (p.key(L.at) ?? 0) : 0;
    const v = lerp(L.from ?? 0, L.to ?? 100, easeOut(clamp((p.lt - t0) / (L.count ?? 1.3))));
    text(ctx, (L.prefix || '') + Math.round(v).toLocaleString('en-US') + (L.suffix || ''), 0, 0, L.size ?? 150, ED.ink, { font: F.sans, weight: 800 });
  },
  'ed-steps'(ctx, L, p) {
    const items = L.items || []; const n = items.length; const w = L.w ?? 220, gap = 22, h = L.h ?? 300;
    items.forEach((it, i) => {
      const x = (i - (n - 1) / 2) * (w + gap);
      const k = backOut(clamp((p.lt - (it.at != null ? (p.key(it.at) ?? 0) : i * 0.25)) / 0.4));
      if (k <= 0) return;
      ctx.save(); ctx.translate(x, 0); ctx.scale(k, k);
      brutal(ctx, -w / 2, -h / 2, w, h, 18, '#ffffff', { off: 7, lw: 4 });
      circle(ctx, -w / 2 + 34, -h / 2 + 36, 16, ED.ink); text(ctx, String(i + 1), -w / 2 + 34, -h / 2 + 37, 20, '#ffffff', { font: F.mono, weight: 700 });
      text(ctx, it.label || '', -w / 2 + 60, -h / 2 + 38, 28, ED.ink, { font: F.sans, weight: 800, align: 'left' });
      if (it.emoji && p.emoji) { ctx.save(); ctx.translate(0, 26); p.emoji(ctx, it.emoji, w * 0.42); ctx.restore(); }
      const st = it.stamp != null ? clamp((p.lt - (p.key(it.stamp) ?? 999)) / 0.3) : 0;
      if (st > 0) { ctx.save(); ctx.translate(0, h / 2 - 54); ctx.rotate(-0.2); const s = 1.7 - 0.7 * backOut(st); ctx.scale(s, s); ctx.globalAlpha = clamp(st * 2); ctx.strokeStyle = ED.red; ctx.lineWidth = 5; ctx.strokeRect(-96, -26, 192, 52); text(ctx, it.stampText || 'APPROVED', 0, 2, 28, ED.red, { font: F.mono, weight: 700 }); ctx.restore(); }
      ctx.restore();
    });
  },
  'ed-stamp'(ctx, L, p) {
    const k = clamp((p.lt - (p.key(L.at) ?? 0)) / 0.3); const s = 1.8 - 0.8 * backOut(k);
    ctx.rotate(-0.14); ctx.scale(s, s); ctx.globalAlpha *= clamp(k * 2);
    ctx.font = `700 ${L.size ?? 56}px "${F.mono}"`; const w = ctx.measureText(L.text || 'APPROVED').width + 60;
    ctx.strokeStyle = L.color || ED.red; ctx.lineWidth = 7; ctx.strokeRect(-w / 2, -46, w, 92);
    text(ctx, L.text || 'APPROVED', 0, 4, L.size ?? 56, L.color || ED.red, { font: F.mono, weight: 700 });
  },
  'ed-comment'(ctx, L, p) {
    const w = L.w ?? 720;
    fillRR(ctx, -w / 2, -44, w, 88, 44, '#ffffff', '#cfcfc8', 3);
    circle(ctx, -w / 2 + 48, 0, 24, '#dededa');
    const tA = L.typeAt ?? L.at; const t0 = tA != null ? (p.key(tA) ?? 0) : 0.2;
    const s = L.keyword || 'PLAYBOOK'; const n = Math.floor((p.lt - t0) * 9);
    text(ctx, n > 0 ? s.slice(0, n) : 'Add a comment…', -w / 2 + 92, 2, 32, n > 0 ? ED.ink : '#a4a49e', { font: F.sans, weight: 700, align: 'left' });
    const k = backOut(clamp((p.lt - t0 - s.length / 9 - 0.25) / 0.4));
    if (k > 0) {
      ctx.save(); ctx.translate(0, 170); ctx.scale(k, k);
      ctx.font = `400 92px "${F.display}"`; const lw = ctx.measureText(s.split('').join(' ')).width + 140;
      brutal(ctx, -lw / 2, -66, lw, 132, 66, ED.red, { off: 9, lw: 6 });
      circle(ctx, -lw / 2 + 50, 0, 16, '#ffffff'); circle(ctx, lw / 2 - 50, 0, 16, '#ffffff');
      text(ctx, s.split('').join(' '), 0, 4, 92, '#ffffff', { font: F.display, weight: 400 });
      ctx.restore();
    }
  },
  'ed-dm'(ctx, L, p) {
    // a DM card: avatar + handle + "Here you go:" + link
    const w = L.w ?? 600, h = 300;
    softCard(ctx, -w / 2, -h / 2, w, h, 26, '#121214');
    circle(ctx, -w / 2 + 56, -h / 2 + 56, 28, '#e6b98a');
    text(ctx, L.handle || 'yourpage', -w / 2 + 100, -h / 2 + 46, 26, '#ffffff', { font: F.sans, weight: 700, align: 'left' });
    text(ctx, 'Instagram · Active now', -w / 2 + 100, -h / 2 + 76, 18, '#8d8d94', { font: F.sans, weight: 700, align: 'left' });
    fillRR(ctx, -w / 2 + 34, -h / 2 + 120, w * 0.72, 130, 22, '#2b2b30');
    text(ctx, L.message || 'Here you go:', -w / 2 + 60, -h / 2 + 160, 24, '#ffffff', { font: F.sans, weight: 700, align: 'left' });
    text(ctx, L.link || 'yoursite.com', -w / 2 + 60, -h / 2 + 206, 24, '#7fb2ff', { font: F.sans, weight: 700, align: 'left' });
  },
  'ed-mascot'(ctx, L, p) { if (L.s) ctx.scale(L.s, L.s); mascot(ctx, p.t, { mood: L.mood || 'happy', color: L.color || ED.mascot, look: Math.sin(p.t * 0.7) }); },
};
