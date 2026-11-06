// AI-ILLUSTRATION SEEK & FIND — high-end illustration (from an image generator) + code on top:
// target characters cut out of a plain background and hidden at exact spots (solution guaranteed),
// gentle camera drift, living motion on the hidden characters, floating light particles,
// title sticker, optional solution circles.
//   --bg assets/x.png --sprite assets/bee.png --spots '[[x,y,size,rot],…]' --title "Only 1% can find 5 royal bees" --emoji 👑
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const emojiRe = /\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu;
const code = (e) => [...e].map((c) => c.codePointAt(0).toString(16)).filter((c) => c !== 'fe0f').join('-');

/** Remove a plain (white-ish) background by flood fill from the borders, keep inner whites (eyes). Returns a trimmed canvas. */
function cutout(img, tol = 38) {
  const w = img.naturalWidth, h = img.naturalHeight; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h), px = d.data;
  const bgc = [px[0], px[1], px[2]]; const seen = new Uint8Array(w * h); const q = [];
  const near = (i) => Math.abs(px[i * 4] - bgc[0]) + Math.abs(px[i * 4 + 1] - bgc[1]) + Math.abs(px[i * 4 + 2] - bgc[2]) < tol * 3;
  for (let x = 0; x < w; x++) { q.push(x, (h - 1) * w + x); } for (let y = 0; y < h; y++) { q.push(y * w, y * w + w - 1); }
  while (q.length) { const i = q.pop(); if (seen[i] || !near(i)) continue; seen[i] = 1; px[i * 4 + 3] = 0; const x = i % w, y = (i / w) | 0; if (x > 0) q.push(i - 1); if (x < w - 1) q.push(i + 1); if (y > 0) q.push(i - w); if (y < h - 1) q.push(i + w); }
  // soften the edge: pixels next to removed ones get partial alpha
  for (let i = 0; i < w * h; i++) if (!seen[i]) { const x = i % w, y = (i / w) | 0; let n = 0; for (const j of [i - 1, i + 1, i - w, i + w]) if (j >= 0 && j < w * h && seen[j]) n++; if (n) px[i * 4 + 3] = 255 - n * 50; }
  g.putImageData(d, 0, 0);
  // trim
  let x0 = w, y0 = h, x1 = 0, y1 = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const t = document.createElement('canvas'); t.width = x1 - x0 + 1; t.height = y1 - y0 + 1; t.getContext('2d').drawImage(c, -x0, -y0); return t;
}

export async function create(stage, opts = {}) {
  const R = rng(Number(opts.seed || 1));
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; stage.appendChild(cv);
  const ctx = cv.getContext('2d');
  const bg = await load(opts.bg);
  let sprite = opts.sprite ? cutout(await load(opts.sprite), Number(opts.tol || 38)) : null;
  if (sprite && opts.grade !== '0') { // match the scene's light: warm tone, softer contrast, tiny blur
    const g = document.createElement('canvas'); g.width = sprite.width; g.height = sprite.height; const c = g.getContext('2d');
    c.filter = opts.filter || 'sepia(0.28) saturate(1.2) brightness(0.93) contrast(0.92) blur(1.2px)'; c.drawImage(sprite, 0, 0); c.filter = 'none';
    c.globalCompositeOperation = 'source-atop'; c.fillStyle = opts.tint || 'rgba(255,150,40,0.16)'; c.fillRect(0, 0, g.width, g.height);
    const rg = c.createLinearGradient(0, 0, 0, g.height); rg.addColorStop(0, 'rgba(255,220,150,0.12)'); rg.addColorStop(1, 'rgba(60,25,0,0.22)'); c.fillStyle = rg; c.fillRect(0, 0, g.width, g.height);
    sprite = g;
  }
  const spots = JSON.parse(opts.spots || '[]'); // [x, y, size(px height), rot(rad), flip]
  const title = opts.title || 'Only 1% can find 5 royal bees';
  const emoji = opts.emoji || '👑';
  const emImg = await load(`/node_modules/@twemoji/svg/${code(emoji)}.svg`).catch(() => null);
  const motes = Array.from({ length: 46 }, () => ({ x: R() * 1080, y: R() * 1920, r: 2 + R() * 5, sp: 8 + R() * 22, ph: R() * TAU }));
  // cover-fit the background into 1080×1920 (no stretching)
  const sc = Math.max(1080 / bg.naturalWidth, 1920 / bg.naturalHeight);
  const bw = bg.naturalWidth * sc, bh = bg.naturalHeight * sc;
  const duration = Number(opts.dur || 13);

  function sticker() {
    ctx.save(); ctx.font = '900 58px Nunito'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(title).width, w = Math.min(1010, tw + 70 + (emImg ? 70 : 0)), x0 = 540 - w / 2, y = 300;
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#ffe04a'; ctx.beginPath(); ctx.roundRect(x0, y - 50, w, 100, 30); ctx.fill(); ctx.shadowColor = 'transparent';
    let fs = 58; while (ctx.measureText(title).width > w - 70 - (emImg ? 70 : 0) && fs > 36) { fs -= 2; ctx.font = `900 ${fs}px Nunito`; }
    ctx.fillStyle = '#1a1208'; ctx.textAlign = 'left'; ctx.fillText(title, x0 + 35, y + 3);
    if (emImg) ctx.drawImage(emImg, x0 + w - 35 - 58, y - 29, 58, 58);
    ctx.restore();
  }

  function renderFrame(t) {
    // slow drift: zoom 1.00 → 1.05 and a gentle pan, so the frame never looks frozen
    const k = t / duration, z = 1 + 0.05 * k, px = Math.sin(t * 0.25) * 10, py = -k * 18;
    ctx.save(); ctx.translate(540 + px, 960 + py); ctx.scale(z, z); ctx.translate(-540, -960);
    ctx.drawImage(bg, (1080 - bw) / 2, (1920 - bh) / 2, bw, bh);
    // hidden characters with living motion
    if (sprite) spots.forEach(([x, y, size, rot = 0, flip = 0], i) => {
      const s = size / sprite.height, ph = i * 1.7;
      const bob = Math.sin(t * 2.3 + ph) * size * 0.04, tilt = Math.sin(t * 1.6 + ph) * 0.07, sq = 1 + Math.sin(t * 4.6 + ph) * 0.025;
      ctx.save(); ctx.translate(x, y + bob); ctx.rotate(rot + tilt); ctx.scale((flip ? -s : s) / Math.sqrt(sq), s * sq);
      ctx.shadowColor = 'rgba(40,20,0,0.35)'; ctx.shadowBlur = 10 / s; ctx.shadowOffsetY = 5 / s;
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2); ctx.restore();
    });
    ctx.restore();
    // floating warm light motes
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of motes) { const yy = ((m.y - t * m.sp) % 1920 + 1920) % 1920, xx = m.x + Math.sin(t * 0.8 + m.ph) * 14, a = 0.25 + 0.25 * Math.sin(t * 2 + m.ph); const g = ctx.createRadialGradient(xx, yy, 0, xx, yy, m.r * 3); g.addColorStop(0, `rgba(255,220,140,${a})`); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g; ctx.fillRect(xx - m.r * 3, yy - m.r * 3, m.r * 6, m.r * 6); }
    ctx.restore();
    sticker();
    if (opts.reveal) { ctx.strokeStyle = '#ff2d4a'; ctx.lineWidth = 8; spots.forEach(([x, y, size]) => { ctx.beginPath(); ctx.arc(540 + (x - 540) * z + px, 960 + (y - 960) * z + py, size * 0.75, 0, TAU); ctx.stroke(); }); }
  }
  renderFrame(0);
  return { duration, renderFrame };
}
