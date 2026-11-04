// AI visual identity: GAIA's eye, holographic UI, data rain, drones, glitches.
import { C, fillRR, circle, text, rr, clamp, ease, easeOut, backOut, lerp, glow, rand, hash } from './draw.js';

export const AI = {
  cyan: '#22e5ff',
  cyanDim: 'rgba(34,229,255,0.35)',
  red: '#ff3355',
  redDim: 'rgba(255,51,85,0.35)',
  amber: '#ffb547',
  green: '#3dff9a',
  bg0: '#03060f',
  bg1: '#0a1430',
  mono: 'Space Mono',
  tech: 'Chakra Petch',
  wide: 'Orbitron',
};

/** Deep-space / data background with a perspective grid floor. */
export function techBg(ctx, t, { tint = AI.cyan, grid = true, horizon = 1250, top = AI.bg0, bottom = AI.bg1 } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, 1920);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(-200, -200, 1480, 2320);
  if (!grid) return;
  ctx.save();
  ctx.strokeStyle = tint; ctx.globalAlpha = 0.16; ctx.lineWidth = 2;
  for (let i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(540 + i * 30, horizon); ctx.lineTo(540 + i * 260, 2000); ctx.stroke(); }
  const off = (t * 0.4) % 1;
  for (let k = 0; k < 14; k++) {
    const z = (k + off) / 14, y = horizon + Math.pow(z, 2.2) * (2000 - horizon);
    ctx.globalAlpha = 0.18 * z; ctx.beginPath(); ctx.moveTo(-100, y); ctx.lineTo(1180, y); ctx.stroke();
  }
  ctx.restore();
  const hg = ctx.createLinearGradient(0, horizon - 120, 0, horizon + 40);
  hg.addColorStop(0, 'rgba(34,229,255,0)'); hg.addColorStop(1, 'rgba(34,229,255,0.18)');
  ctx.fillStyle = hg; ctx.fillRect(0, horizon - 120, 1080, 160);
}

/** Falling columns of code. */
export function dataRain(ctx, t, { alpha = 0.35, color = AI.cyan, cols = 22, seed = 4 } = {}) {
  const R = rand(seed);
  ctx.save();
  ctx.font = `700 26px "${AI.mono}"`; ctx.textAlign = 'center'; ctx.fillStyle = color;
  const chars = '01ABCDEF<>/#$%GAIA';
  for (let c = 0; c < cols; c++) {
    const x = (c + 0.5) * (1080 / cols), sp = 160 + R() * 260, len = 8 + Math.floor(R() * 14), y0 = R() * 2400;
    const head = ((y0 + t * sp) % 2400) - 300;
    for (let i = 0; i < len; i++) {
      const y = head - i * 30;
      if (y < -30 || y > 1950) continue;
      ctx.globalAlpha = alpha * (1 - i / len) * (i === 0 ? 1.6 : 1);
      ctx.fillText(chars[Math.floor(hash(c * 31 + i + Math.floor(t * 8)) * chars.length)], x, y);
    }
  }
  ctx.restore();
}

/** GAIA: concentric machine rings around a glowing iris with a slit pupil. */
export function gaiaEye(ctx, x, y, r, t, { open = 1, color = AI.cyan, alpha = 1, look = [0, 0], pulse = 0 } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  // halo
  const halo = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.7);
  halo.addColorStop(0, color === AI.red ? 'rgba(255,51,85,0.35)' : 'rgba(34,229,255,0.30)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineCap = 'butt';
  // ring 1: segmented, slow
  ctx.lineWidth = r * 0.05;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + t * 0.15;
    ctx.globalAlpha = alpha * (i % 3 === 0 ? 0.9 : 0.45);
    ctx.beginPath(); ctx.arc(0, 0, r, a, a + Math.PI * 2 / 24 * 0.7); ctx.stroke();
  }
  // ring 2: ticks, counter-rotating
  ctx.globalAlpha = alpha * 0.7; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - t * 0.3, l = i % 5 === 0 ? r * 0.07 : r * 0.035;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86); ctx.lineTo(Math.cos(a) * (r * 0.86 - l), Math.sin(a) * (r * 0.86 - l)); ctx.stroke();
  }
  // ring 3: three thick arcs, fast
  ctx.globalAlpha = alpha; ctx.lineWidth = r * 0.06;
  for (let i = 0; i < 3; i++) { const a = i * (Math.PI * 2 / 3) + t * 0.7; ctx.beginPath(); ctx.arc(0, 0, r * 0.7, a, a + 1.6); ctx.stroke(); }
  // eye (clipped by eyelids)
  const o = clamp(open);
  if (o > 0.01) {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.6, r * 0.6 * o, 0, 0, Math.PI * 2); ctx.clip();
    const ir = r * 0.52 * (1 + pulse * 0.06);
    const lx = look[0] * r * 0.12, ly = look[1] * r * 0.12;
    const g = ctx.createRadialGradient(lx, ly, ir * 0.05, lx, ly, ir);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, color === AI.red ? '#ff8aa0' : '#aaf6ff');
    g.addColorStop(0.6, color);
    g.addColorStop(1, color === AI.red ? '#3a0010' : '#022a3a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, ir, 0, Math.PI * 2); ctx.fill();
    // iris lines
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(lx + Math.cos(a) * ir * 0.3, ly + Math.sin(a) * ir * 0.3); ctx.lineTo(lx + Math.cos(a) * ir * 0.92, ly + Math.sin(a) * ir * 0.92); ctx.stroke(); }
    // slit pupil
    ctx.fillStyle = '#02040a';
    ctx.beginPath(); ctx.ellipse(lx, ly, ir * 0.13, ir * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    circle(ctx, lx + ir * 0.25, ly - ir * 0.3, ir * 0.07, 'rgba(255,255,255,0.9)');
    ctx.restore();
    // eyelid edges
    ctx.strokeStyle = color; ctx.lineWidth = r * 0.03; ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.6, r * 0.6 * o, 0, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.strokeStyle = color; ctx.lineWidth = r * 0.04;
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.stroke();
  }
  ctx.restore();
}

/** Corner-bracket hologram frame. */
export function holoFrame(ctx, x, y, w, h, { color = AI.cyan, fill = 'rgba(6,18,40,0.72)', corner = 40, lw = 5 } = {}) {
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  ctx.save();
  ctx.strokeStyle = color; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.globalAlpha = 1; ctx.lineWidth = lw;
  glow(ctx, color, 14, () => {
    ctx.beginPath();
    ctx.moveTo(x, y + corner); ctx.lineTo(x, y); ctx.lineTo(x + corner, y);
    ctx.moveTo(x + w - corner, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + corner);
    ctx.moveTo(x + w, y + h - corner); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - corner, y + h);
    ctx.moveTo(x + corner, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - corner);
    ctx.stroke();
  });
  ctx.restore();
}

/** Text typed character by character with a blinking cursor. */
export function typed(ctx, s, x, y, size, color, chars, t, { align = 'left', font = AI.mono, cursor = true } = {}) {
  const shown = s.slice(0, Math.max(0, Math.floor(chars)));
  ctx.font = `700 ${size}px "${font}"`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  glow(ctx, color, 10, () => { ctx.fillStyle = color; ctx.fillText(shown, x, y); });
  if (cursor && chars < s.length + 4 && Math.floor(t * 3) % 2 === 0) {
    const w = ctx.measureText(shown).width;
    const cx = align === 'center' ? x + w / 2 + 6 : x + w + 6;
    ctx.fillStyle = color; ctx.fillRect(cx, y - size * 0.45, size * 0.55, size * 0.9);
  }
}

/** Small quadcopter drone with a scanning light. */
export function drone(ctx, x, y, s, t, color = AI.cyan) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.rotate(Math.sin(t * 2) * 0.06);
  ctx.strokeStyle = '#8a95b0'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-60, -6); ctx.lineTo(60, -6); ctx.stroke();
  for (const sx of [-60, 60]) { ctx.fillStyle = 'rgba(200,210,230,0.5)'; ctx.beginPath(); ctx.ellipse(sx, -14, 34 * Math.abs(Math.sin(t * 40 + sx)), 5, 0, 0, Math.PI * 2); ctx.fill(); fillRR(ctx, sx - 4, -18, 8, 14, 3, '#5b6680'); }
  fillRR(ctx, -32, -12, 64, 28, 12, '#1b2238', '#8a95b0', 3);
  glow(ctx, color, 18, () => circle(ctx, 0, 6, 8, color));
  // scan cone
  const cone = ctx.createLinearGradient(0, 10, 0, 260);
  cone.addColorStop(0, color === AI.red ? 'rgba(255,51,85,0.35)' : 'rgba(34,229,255,0.3)'); cone.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(6, 10); ctx.lineTo(70, 260); ctx.lineTo(-70, 260); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Scanlines + light grain over the whole frame. */
let scan = null;
export function scanlines(ctx, t, alpha = 0.06) {
  if (!scan) {
    scan = document.createElement('canvas'); scan.width = 4; scan.height = 4;
    const s = scan.getContext('2d'); s.fillStyle = 'rgba(0,0,0,1)'; s.fillRect(0, 0, 4, 2);
  }
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = ctx.createPattern(scan, 'repeat'); ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
  const R = rand(Math.floor(t * 24) + 3);
  ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let i = 0; i < 400; i++) ctx.fillRect(R() * 1080, R() * 1920, 2, 2);
  ctx.restore();
}

/** Horizontal slice displacement + RGB tint: the "AI glitch". amount 0..1 */
export function glitch(ctx, canvas, t, amount) {
  if (amount <= 0.01) return;
  const R = rand(Math.floor(t * 30) * 7 + 1);
  const n = Math.floor(4 + amount * 10);
  for (let i = 0; i < n; i++) {
    const y = Math.floor(R() * 1920), h = Math.floor(10 + R() * 120 * amount), dx = Math.floor((R() - 0.5) * 140 * amount);
    ctx.drawImage(canvas, 0, y, 1080, h, dx, y, 1080, h);
    ctx.fillStyle = R() < 0.5 ? `rgba(34,229,255,${0.18 * amount})` : `rgba(255,51,85,${0.18 * amount})`;
    ctx.fillRect(0, y, 1080, h);
  }
}

/** Line icons for systems (drawn in the AI style). */
export function sysIcon(ctx, name, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  glow(ctx, color, 16, () => {
    switch (name) {
      case 'power': ctx.beginPath(); ctx.moveTo(10, -60); ctx.lineTo(-30, 8); ctx.lineTo(4, 8); ctx.lineTo(-10, 60); ctx.lineTo(32, -12); ctx.lineTo(-2, -12); ctx.closePath(); ctx.stroke(); break;
      case 'water': ctx.beginPath(); ctx.moveTo(0, -58); ctx.bezierCurveTo(30, -14, 46, 8, 46, 22); ctx.arc(0, 22, 46, 0, Math.PI); ctx.bezierCurveTo(-46, 8, -30, -14, 0, -58); ctx.stroke(); break;
      case 'food': ctx.beginPath(); ctx.arc(0, 8, 46, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -38); ctx.quadraticCurveTo(14, -64, 34, -60); ctx.stroke(); break;
      case 'money': ctx.font = '900 120px "Chakra Petch"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 6; ctx.strokeText('$', 0, 6); break;
      case 'screen': ctx.strokeRect(-56, -40, 112, 74); ctx.beginPath(); ctx.moveTo(-20, 56); ctx.lineTo(20, 56); ctx.moveTo(0, 34); ctx.lineTo(0, 56); ctx.stroke(); break;
      case 'car': ctx.beginPath(); ctx.moveTo(-56, 18); ctx.lineTo(-56, -2); ctx.lineTo(-32, -30); ctx.lineTo(32, -30); ctx.lineTo(56, -2); ctx.lineTo(56, 18); ctx.closePath(); ctx.stroke(); circle(ctx, -30, 22, 12, null, color, 8); circle(ctx, 30, 22, 12, null, color, 8); break;
      default: break;
    }
  });
  ctx.restore();
}

export { lerp, ease, easeOut, backOut, clamp, text, rr, fillRR, circle, glow };
