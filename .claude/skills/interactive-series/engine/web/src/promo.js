// Product-promo layer pack (editorial look): brand theming + scenes that sell any kind of product
// (physical products, apps/SaaS, services, courses, food, fashion…). Uses the editorial primitives.
import { ED, F, MARGIN, brutal, softCard } from './editorial.js';
import { text, fillRR, rr, circle, clamp, lerp, ease, easeOut, backOut, rand } from './draw.js';

const DEFAULT_ED = { ...ED };

/**
 * Brand theme for an episode: { accent, accentSoft, paper, ink, card, mascot (colour | false), grid: false }.
 * Called once per episode before rendering.
 */
export function applyTheme(theme = {}) {
  Object.assign(ED, DEFAULT_ED);
  if (theme.accent) { ED.red = theme.accent; ED.redSoft = theme.accentSoft || mixHex(theme.accent, '#ffffff', 0.62); }
  if (theme.paper) ED.bg = theme.paper;
  if (theme.ink) ED.ink = theme.ink;
  if (theme.card) ED.card = theme.card;
  if (theme.muted) ED.muted = theme.muted;
  if (theme.grid === false) { ED.grid = 'rgba(0,0,0,0)'; ED.gridBig = 'rgba(0,0,0,0)'; }
  if (theme.mascot && typeof theme.mascot === 'string') ED.mascot = theme.mascot;
  if (theme.highlight) ED.yellow = theme.highlight;
}
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t)).toString(16).padStart(2, '0');
  return `#${c(16)}${c(8)}${c(0)}`;
}
const tIn = (p, L, k = 'at', d = 0) => (L[k] != null ? (p.key(L[k]) ?? d) : d);

export const PROMO_LAYERS = {
  /** Hero product shot: transparent PNG (or emoji) floating with a soft shadow, gentle turn + optional glow. */
  'ed-product'(ctx, L, p) {
    const w = L.w ?? 560;
    const img = L.src ? p.image(L.src) : null;
    const h = img ? w * img.height / img.width : w;
    const fl = L.float === false ? 0 : Math.sin(p.t * 1.6) * 10;
    // shadow on the "table"
    const sh = 1 - fl / 60;
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.ellipse(0, h / 2 + 30, w * 0.36 * sh, 22 * sh, 0, 0, Math.PI * 2); ctx.fill();
    if (L.glow) { const g = ctx.createRadialGradient(0, 0, 10, 0, 0, w * 0.75); g.addColorStop(0, L.glow); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(-w, -h, w * 2, h * 2); }
    ctx.save(); ctx.translate(0, fl);
    if (L.turn !== false) ctx.scale(1 - 0.03 * (1 - Math.cos(p.t * 0.9)), 1);
    ctx.rotate(Math.sin(p.t * 0.8) * 0.025 + (L.tilt || 0));
    if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
    else if (L.emoji) p.emoji(ctx, L.emoji, w * 0.9);
    // light sweep (shine) passing over the product
    if (L.shine !== false && img) {
      const k = ((p.t * 0.35) % 1.6) - 0.3;
      ctx.globalCompositeOperation = 'source-atop';
      const sg = ctx.createLinearGradient(-w / 2 + k * w, -h / 2, -w / 2 + k * w + w * 0.25, h / 2);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.35)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  },

  /** Feature callout: a dot on the product, a line that draws, then a brutal label. Coordinates are absolute. */
  'ed-callout'(ctx, L, p) {
    const [x1, y1] = L.from || [540, 900], [x2, y2] = L.to || [800, 700];
    const t0 = tIn(p, L);
    const kl = easeOut(clamp((p.lt - t0) / 0.35)), kb = backOut(clamp((p.lt - t0 - 0.25) / 0.35));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); // absolute coordinates
    circle(ctx, x1, y1, 12 * kl, ED.red, '#ffffff', 4);
    ctx.strokeStyle = ED.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x1, y1);
    const mx = x1 + (x2 - x1) * kl, my = y1 + (y2 - y1) * kl; ctx.lineTo(mx, my); ctx.stroke();
    if (kb > 0) {
      ctx.translate(x2, y2); ctx.scale(kb, kb);
      ctx.font = `700 ${L.size ?? 34}px "${F.sans}"`; const tw = ctx.measureText(L.text || '').width + 44, th = (L.size ?? 34) * 1.9;
      const ax = x2 > x1 ? 0 : -tw;
      brutal(ctx, ax, -th / 2, tw, th, 14, '#ffffff', { off: 6, lw: 4 });
      text(ctx, L.text || '', ax + 22, 2, L.size ?? 34, ED.ink, { font: F.sans, weight: 700, align: 'left' });
    }
    ctx.restore();
  },

  /** Price reveal: old price struck through, new price pops (only real prices!). */
  'ed-price'(ctx, L, p) {
    const t0 = tIn(p, L, 'at', 0.2);
    const cur = L.currency ?? '$';
    if (L.old != null) {
      const s = `${cur}${L.old}`; text(ctx, s, 0, -120, 72, ED.muted, { font: F.sans, weight: 800 });
      const k = easeOut(clamp((p.lt - t0) / 0.4)); ctx.font = `800 72px "${F.sans}"`; const w = ctx.measureText(s).width;
      ctx.strokeStyle = ED.red; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-w / 2 - 10, -124); ctx.lineTo(-w / 2 - 10 + (w + 20) * k, -116); ctx.stroke();
    }
    const kb = backOut(clamp((p.lt - t0 - 0.35) / 0.4));
    if (kb > 0) {
      ctx.save(); ctx.scale(kb, kb);
      text(ctx, `${cur}${L.now}`, 0, 40, L.size ?? 190, ED.ink, { font: F.sans, weight: 800 });
      if (L.per) text(ctx, L.per, 0, 160, 34, ED.muted, { font: F.mono, weight: 400 });
      ctx.restore();
    }
    if (L.note) { const kn = clamp((p.lt - t0 - 0.7) / 0.3); if (kn > 0) { ctx.save(); ctx.translate(0, 250); ctx.rotate(-0.04); ctx.scale(kn, kn); ctx.font = `700 34px "${F.mono}"`; const w = ctx.measureText(L.note).width + 50; brutal(ctx, -w / 2, -34, w, 68, 34, ED.red, { off: 6, lw: 4 }); text(ctx, L.note, 0, 2, 34, '#ffffff', { font: F.mono, weight: 700 }); ctx.restore(); } }
  },

  /** Us vs them / before vs after: two columns, ✕ on the left, ✓ on the right, ticking on words. */
  'ed-compare'(ctx, L, p) {
    const w = L.w ?? 800, colW = w / 2 - 14, rows = Math.max((L.left?.items || []).length, (L.right?.items || []).length), h = 120 + rows * 74;
    const col = (side, data, x) => {
      const good = side > 0;
      if (good) brutal(ctx, x, -h / 2, colW, h, 22, '#ffffff', { off: 8, lw: 4 });
      else { fillRR(ctx, x, -h / 2, colW, h, 22, 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.25)', 3); }
      text(ctx, (data.title || (good ? 'With it' : 'Without')).toUpperCase(), x + colW / 2, -h / 2 + 50, 28, good ? ED.ink : ED.muted, { font: F.mono, weight: 700 });
      (data.items || []).forEach((it, i) => {
        const s = typeof it === 'string' ? it : it.text; const at = typeof it === 'string' ? null : it.at;
        const k = backOut(clamp((p.lt - (at != null ? (p.key(at) ?? 0) : 0.3 + i * 0.35 + (good ? 0.15 : 0))) / 0.3));
        if (k <= 0) return;
        const y = -h / 2 + 118 + i * 74;
        ctx.save(); ctx.translate(x + 40, y); ctx.scale(k, k);
        if (good) { circle(ctx, 0, 0, 18, '#3fbf6a'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-2, 7); ctx.lineTo(9, -7); ctx.stroke(); }
        else { circle(ctx, 0, 0, 18, '#d9d9d3'); ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(7, 7); ctx.moveTo(7, -7); ctx.lineTo(-7, 7); ctx.stroke(); }
        ctx.restore();
        text(ctx, s, x + 72, y + 2, 28, good ? ED.ink : ED.muted, { font: F.sans, weight: 700, align: 'left' });
      });
    };
    col(-1, L.left || {}, -w / 2); col(1, L.right || {}, -w / 2 + colW + 28);
  },

  /** Bar chart (real numbers only), bars grow on a word. */
  'ed-bars'(ctx, L, p) {
    const items = L.items || [], w = L.w ?? 760, h = L.h ?? 420, n = items.length;
    const max = Math.max(...items.map((i) => i.value), 1);
    const t0 = tIn(p, L, 'at', 0.2);
    const bw = (w - (n - 1) * 30) / n;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.lineTo(w / 2, h / 2); ctx.stroke();
    items.forEach((it, i) => {
      const k = ease(clamp((p.lt - t0 - i * 0.18) / 0.8));
      const bh = (h - 70) * (it.value / max) * k, x = -w / 2 + i * (bw + 30);
      const hl = it.highlight ?? i === n - 1;
      if (bh > 2) brutal(ctx, x, h / 2 - bh, bw, bh, 12, hl ? ED.red : '#ffffff', { off: 6, lw: 4 });
      text(ctx, (L.prefix || '') + Math.round(it.value * k).toLocaleString('en-US') + (L.suffix || ''), x + bw / 2, h / 2 - bh - 30, 34, ED.ink, { font: F.sans, weight: 800 });
      text(ctx, it.label, x + bw / 2, h / 2 + 40, 26, ED.muted, { font: F.mono, weight: 400 });
    });
  },

  /** A real customer review card (stars + quote + name). Never invent reviews. */
  'ed-review'(ctx, L, p) {
    const w = L.w ?? 760, h = L.h ?? 300;
    brutal(ctx, -w / 2, -h / 2, w, h, 26, '#ffffff', { off: 8, lw: 4 });
    const stars = L.stars ?? 5;
    for (let i = 0; i < 5; i++) {
      const k = backOut(clamp((p.lt - tIn(p, L) - i * 0.08) / 0.3)); if (k <= 0) continue;
      ctx.save(); ctx.translate(-w / 2 + 60 + i * 52, -h / 2 + 60); ctx.scale(k, k); star(ctx, 22, i < stars ? '#f2b705' : '#ddd'); ctx.restore();
    }
    const q = `“${L.text || ''}”`; const lines = wrap(ctx, q, w - 90, `700 38px "${F.sans}"`);
    lines.slice(0, 3).forEach((ln, i) => text(ctx, ln, -w / 2 + 45, -h / 2 + 130 + i * 50, 38, ED.ink, { font: F.sans, weight: 700, align: 'left' }));
    text(ctx, `— ${L.author || ''}`, -w / 2 + 45, h / 2 - 34, 26, ED.muted, { font: F.mono, weight: 400, align: 'left' });
  },

  /** Offer badge: "48H ONLY · -30%" with a ticking clock look. */
  'ed-offer'(ctx, L, p) {
    const w = L.w ?? 640, h = 200;
    ctx.rotate(-0.03);
    brutal(ctx, -w / 2, -h / 2, w, h, 30, ED.red, { off: 10, lw: 5 });
    text(ctx, (L.title || 'LIMITED OFFER').toUpperCase(), 0, -24, 64, '#ffffff', { font: F.display, weight: 400 });
    text(ctx, L.sub || '', 0, 50, 30, '#ffffff', { font: F.mono, weight: 700 });
    // ticking hand
    ctx.save(); ctx.translate(w / 2 - 50, -h / 2 + 50); circle(ctx, 0, 0, 30, '#ffffff', ED.ink, 4); ctx.rotate(p.t * 2); ctx.strokeStyle = ED.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -20); ctx.stroke(); ctx.restore();
  },

  /** Brand lock-up: logo image or wordmark + optional tagline. */
  'ed-logo'(ctx, L, p) {
    const img = L.src ? p.image(L.src) : null;
    if (img) { const w = L.w ?? 380, h = w * img.height / img.width; ctx.drawImage(img, -w / 2, -h / 2, w, h); if (L.tagline) text(ctx, L.tagline, 0, h / 2 + 50, 30, ED.muted, { font: F.mono, weight: 400 }); return; }
    text(ctx, L.text || 'Brand', 0, 0, L.size ?? 120, ED.ink, { font: F.sans, weight: 800 });
    if (L.tagline) text(ctx, L.tagline, 0, (L.size ?? 120) * 0.75, 30, ED.muted, { font: F.mono, weight: 400 });
  },

  /** Before → after slider over two images (or emoji), the divider sweeps on a word. */
  'ed-beforeafter'(ctx, L, p) {
    const w = L.w ?? 780, h = L.h ?? 560;
    const a = L.before ? p.image(L.before) : null, b = L.after ? p.image(L.after) : null;
    softCard(ctx, -w / 2, -h / 2, w, h, 28, '#ffffff');
    const k = ease(clamp((p.lt - tIn(p, L, 'at', 0.5)) / 1.2));
    const split = -w / 2 + w * (1 - k * 0.98);
    ctx.save(); rr(ctx, -w / 2, -h / 2, w, h, 28); ctx.clip();
    const drawCover = (img, fallback) => { if (img) { const s = Math.max(w / img.width, h / img.height); ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s); } else { ctx.fillStyle = fallback; ctx.fillRect(-w / 2, -h / 2, w, h); } };
    drawCover(b, '#dfe9df');
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, split + w / 2, h); ctx.clip(); drawCover(a, '#e9dfdf'); ctx.restore();
    ctx.restore();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(split - 3, -h / 2, 6, h); circle(ctx, split, 0, 30, '#ffffff', ED.ink, 4);
    text(ctx, '‹ ›', split, 2, 28, ED.ink, { font: F.sans, weight: 800 });
    const tag = (s, x, al) => { ctx.font = `700 26px "${F.mono}"`; const tw = ctx.measureText(s).width + 30; fillRR(ctx, al === 'left' ? x : x - tw, -h / 2 + 20, tw, 46, 12, ED.ink); text(ctx, s, al === 'left' ? x + tw / 2 : x - tw / 2, -h / 2 + 44, 26, '#fff', { font: F.mono, weight: 700 }); };
    tag(L.beforeLabel || 'BEFORE', -w / 2 + 20, 'left'); tag(L.afterLabel || 'AFTER', w / 2 - 20, 'right');
  },

  /** Big fact / stat with a label, like "3x faster". */
  'ed-fact'(ctx, L, p) {
    const k = backOut(clamp((p.lt - tIn(p, L)) / 0.4));
    ctx.save(); ctx.scale(k, k);
    text(ctx, L.value || '', 0, 0, L.size ?? 210, ED.red, { font: F.serif, weight: 400 });
    ctx.restore();
    if (L.label) text(ctx, L.label, 0, (L.size ?? 210) * 0.55, 34, ED.ink, { font: F.mono, weight: 400 });
  },
};

function star(ctx, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr2 = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
  ctx.closePath(); ctx.fill();
}
function wrap(ctx, s, maxW, font) {
  ctx.font = font; const words = s.split(/\s+/), out = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
