// Game-style UI for the "toon" series look (measured on pro reference episodes, 720p ×1.5).
import { fillRR, rr, circle, text, clamp, lerp, ease, easeOut, backOut } from './draw.js';

const OS = 'Oswald', UI = 'Nunito';
const INK = '#23222b';

function shadowText(ctx, s, x, y, size, color, { weight = 700, align = 'left', font = OS } = {}) {
  ctx.font = `${weight} ${size}px "${font}"`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(10,12,20,0.55)'; ctx.fillText(s, x, y + 3);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function pin(ctx, x, y, s, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y - s * 0.55, s * 0.42, Math.PI, 0); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
  circle(ctx, x, y - s * 0.55, s * 0.16, '#3a3d4a');
}

export const UI_LAYERS = {
  // DAY 2 / 6:42 PM / ROUTE 22 — big stacked clock (top-left) or one-line compact (top-right, battles)
  'ui-clock'(ctx, L, p) {
    if (L.compact) {
      const s = `${L.day || 'DAY 1'} · ${L.time || '6:00'} ${L.ampm || 'PM'} · ${L.place || ''}`.toUpperCase();
      shadowText(ctx, s, 0, 0, 34, '#ffffff', { weight: 600, align: 'right' });
      return;
    }
    const blink = 0.55 + 0.45 * Math.sin(p.t * 4);
    ctx.globalAlpha *= 1; circle(ctx, 8, -36, 9, `rgba(255,59,59,${blink})`);
    shadowText(ctx, (L.day || 'DAY 1').toUpperCase(), 26, -22, 34, '#ffffff', { weight: 600 });
    shadowText(ctx, L.time || '6:00', 0, 52, 72, '#ffffff', { weight: 700 });
    ctx.font = `700 72px "${OS}"`; const tw = ctx.measureText(L.time || '6:00').width;
    shadowText(ctx, (L.ampm || 'PM').toUpperCase(), tw + 10, 50, 32, '#ffffff', { weight: 600 });
    pin(ctx, 9, 98, 26, '#c9ccd6');
    shadowText(ctx, (L.place || '').toUpperCase(), 28, 98, 30, '#ffffff', { weight: 600 });
  },

  // name tag badge on a character's chest ("SILAS")
  'ui-speaker'(ctx, L) {
    ctx.font = `800 26px "${UI}"`; const w = ctx.measureText(L.text || '').width + 34;
    fillRR(ctx, -w / 2, -21, w, 42, 21, 'rgba(25,30,48,0.92)', '#9fb1d6', 2);
    text(ctx, (L.text || '').toUpperCase(), 0, 1, 26, '#e8eefc', { font: UI, weight: 800 });
  },

  // battle status box: name, level, HP bar (can drop on a word), type pills, EXP
  'ui-hpbox'(ctx, L, p) {
    const w = L.w ?? 440, h = L.player ? 160 : 150, side = L.player ? -1 : 1;
    // speech-style tail pointing at the creature
    ctx.fillStyle = '#ece6d2'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath(); const tx = side > 0 ? w / 2 - 30 : -w / 2 + 30;
    ctx.moveTo(tx - 22, h / 2 - 4); ctx.lineTo(tx + side * 24, h / 2 + 28); ctx.lineTo(tx + 22 * side * -1 + side * 0, h / 2 - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
    fillRR(ctx, -w / 2, -h / 2, w, h, 18, '#ece6d2'); ctx.restore();
    fillRR(ctx, -w / 2, -h / 2, w, h, 18, null, INK, 4);
    ctx.fillStyle = '#ece6d2'; ctx.fillRect(tx - 18, h / 2 - 8, 36, 8);
    text(ctx, (L.name || '').toUpperCase(), -w / 2 + 34, -h / 2 + 40, 34, INK, { font: UI, weight: 900, align: 'left' });
    text(ctx, `Lv${L.level ?? 5}`, w / 2 - 30, -h / 2 + 40, 32, INK, { font: UI, weight: 900, align: 'right' });
    // HP bar
    const hp = L.hp ?? [20, 20];
    let ratio = hp[0] / hp[1];
    if (L.hpTo != null) { const k = ease(clamp((p.lt - (p.key(L.hpAt) ?? 0)) / 0.8)); ratio = lerp(ratio, L.hpTo / hp[1], k); }
    const bx = -w / 2 + 34, by = -h / 2 + 64, bw = w - 68;
    fillRR(ctx, bx, by, bw, 26, 13, '#3a3f4b');
    fillRR(ctx, bx + 4, by + 4, 44, 18, 9, '#f2c94c'); text(ctx, 'HP', bx + 26, by + 14, 14, INK, { font: UI, weight: 900 });
    const fc = ratio > 0.5 ? '#43c46a' : ratio > 0.2 ? '#f2b33d' : '#e8483f';
    if (ratio > 0.01) { fillRR(ctx, bx + 54, by + 5, (bw - 60) * clamp(ratio), 16, 8, fc); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx + 58, by + 7, (bw - 68) * clamp(ratio), 4); }
    if (L.player) {
      const cur = Math.round(ratio * hp[1]);
      text(ctx, `${cur}/ ${hp[1]}`, w / 2 - 34, by + 54, 30, INK, { font: UI, weight: 900, align: 'right' });
      text(ctx, 'EXP', bx, by + 92, 14, '#555', { font: UI, weight: 900, align: 'left' });
      fillRR(ctx, bx + 46, by + 84, bw - 46, 14, 7, '#3a3f4b'); fillRR(ctx, bx + 48, by + 86, (bw - 50) * (L.exp ?? 0.4), 10, 5, '#3f9be8');
    } else {
      let x = bx;
      for (const ty of L.types || []) {
        ctx.font = `900 18px "${UI}"`; const tw = ctx.measureText(ty.text).width + 32;
        fillRR(ctx, x, by + 42, tw, 32, 16, ty.color || '#9aaa2a', INK, 2.5);
        text(ctx, ty.text.toUpperCase(), x + tw / 2, by + 59, 18, '#ffffff', { font: UI, weight: 900 });
        x += tw + 10;
      }
    }
    if (L.status) { ctx.font = `900 20px "${UI}"`; const sw = ctx.measureText(L.status).width + 30; fillRR(ctx, w / 2 - sw - 10, h / 2 + 6, sw, 34, 17, '#8f3fa6', INK, 2.5); text(ctx, L.status.toUpperCase(), w / 2 - sw / 2 - 10, h / 2 + 24, 20, '#fff', { font: UI, weight: 900 }); }
  },

  // battle message box: navy with light frame, typed text, blinking red arrow
  'ui-dialog'(ctx, L, p) {
    const w = L.w ?? 740, h = L.h ?? 180;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
    fillRR(ctx, -w / 2, -h / 2, w, h, 22, '#d5dbe3'); ctx.restore();
    fillRR(ctx, -w / 2, -h / 2, w, h, 22, null, INK, 3);
    fillRR(ctx, -w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 16, '#1e2c44', '#11192a', 3);
    const tA = L.typeAt ?? L.at; const t0 = tA != null ? (p.key(tA) ?? 0) : 0.05;
    const lines = String(L.text || '').split('\n');
    let budget = (p.lt - t0) * (L.speed ?? 32); let lastX = 0, lastY = 0;
    lines.forEach((ln, i) => {
      const n = Math.max(0, Math.min(ln.length, Math.floor(budget)));
      const y = -h / 2 + 64 + i * 52;
      text(ctx, ln.slice(0, n), -w / 2 + 44, y, 38, '#ffffff', { font: UI, weight: 900, align: 'left' });
      if (n > 0) { ctx.font = `900 38px "${UI}"`; lastX = -w / 2 + 44 + ctx.measureText(ln.slice(0, n)).width; lastY = y; }
      budget -= ln.length + 3;
    });
    if (budget > 0 && Math.floor(p.t * 2.5) % 2 === 0) { ctx.fillStyle = '#e8483f'; ctx.beginPath(); ctx.moveTo(lastX + 14, lastY - 8); ctx.lineTo(lastX + 32, lastY - 8); ctx.lineTo(lastX + 23, lastY + 4); ctx.closePath(); ctx.fill(); }
  },

  // "TRAINER TIP #1" style info card (any label)
  'ui-tip'(ctx, L) {
    const w = L.w ?? 640, h = L.h ?? 225;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#1d2742'); g.addColorStop(1, '#141b30');
    fillRR(ctx, -w / 2, -h / 2, w, h, 14, g); ctx.restore();
    fillRR(ctx, -w / 2, -h / 2, w, h, 14, null, 'rgba(255,255,255,0.12)', 2);
    ctx.fillStyle = '#f5c542'; ctx.fillRect(-w / 2, -h / 2 + 8, 8, h - 16);
    // emblem watermark
    ctx.save(); ctx.globalAlpha *= 0.12; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(w / 2 - 80, 10, 70, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(w / 2 - 150, 10); ctx.lineTo(w / 2 - 10, 10); ctx.stroke(); circle(ctx, w / 2 - 80, 10, 20, null, '#ffffff', 6); ctx.restore();
    // tag
    ctx.font = `600 24px "${OS}"`; const label = (L.label || 'TIP').toUpperCase() + (L.n != null ? ` #${L.n}` : '');
    const tw = ctx.measureText(label).width + 52;
    fillRR(ctx, -w / 2 + 18, -h / 2 - 18, tw, 38, 19, '#f5c542');
    circle(ctx, -w / 2 + 38, -h / 2 + 1, 9, '#e8483f', INK, 2);
    text(ctx, label, -w / 2 + 52, -h / 2 + 2, 24, INK, { font: OS, weight: 600, align: 'left' });
    // title with *yellow* parts, then subtitle
    let hl = false; // *highlight* may span several lines
    const drawRich = (s, x, y, size, base) => {
      let cx = x;
      s.split(/(\*)/).forEach((seg) => {
        if (seg === '*') { hl = !hl; return; } if (!seg) return;
        ctx.font = `700 ${size}px "${OS}"`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = hl ? '#ffd84a' : base; ctx.fillText(seg.toUpperCase(), cx, y); cx += ctx.measureText(seg.toUpperCase()).width;
      });
    };
    const tl = String(L.title || '').split('\n');
    tl.forEach((ln, i) => drawRich(ln, -w / 2 + 34, -h / 2 + 76 + i * 56, 52, '#ffffff'));
    hl = false;
    String(L.sub || '').split('\n').forEach((ln, i) => drawRich(ln, -w / 2 + 34, -h / 2 + 76 + tl.length * 56 + i * 38 + 2, 34, '#e9edf7'));
  },

  // creature name tag: "FIST  Lv11 / MANKEY"
  'ui-nametag'(ctx, L) {
    ctx.font = `700 46px "${OS}"`; const nw = ctx.measureText((L.name || '').toUpperCase()).width;
    const w = nw + 120, h = 86;
    fillRR(ctx, -w / 2, -h / 2, w, h, 14, L.color || '#f08a3c', INK, 3);
    text(ctx, (L.name || '').toUpperCase(), -w / 2 + 18, 2, 46, '#ffffff', { font: OS, weight: 700, align: 'left', stroke: INK, lw: 5 });
    fillRR(ctx, w / 2 - 88, -24, 70, 30, 8, INK); text(ctx, `Lv${L.level ?? 5}`, w / 2 - 53, -9, 20, '#ffffff', { font: OS, weight: 600 });
    text(ctx, (L.species || '').toUpperCase(), -w / 2 + 18, 32, 18, '#ffffff', { font: OS, weight: 600, align: 'left' });
  },

  // vote results card: "PART 14 · INSTAGRAM VOTE / 71% SAID / options"
  'ui-vote'(ctx, L, p) {
    const w = L.w ?? 600, opts = L.options || [], h = 150 + opts.length * 46;
    const k = ease(clamp((p.lt - (L.countAt != null ? (p.key(L.countAt) ?? 0) : 0.2)) / 1.2));
    const win = opts.reduce((a, o, i) => (o.percent > opts[a].percent ? i : a), 0);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 18; fillRR(ctx, -w / 2, -h / 2, w, h, 14, 'rgba(18,22,36,0.94)'); ctx.restore();
    text(ctx, (L.title || 'LAST PART · VOTE').toUpperCase(), -w / 2 + 28, -h / 2 + 30, 20, '#b9c1d6', { font: OS, weight: 600, align: 'left' });
    const pct = Math.round((opts[win]?.percent ?? 0) * k);
    text(ctx, `${pct}%`, -w / 2 + 28, -h / 2 + 92, 70, '#ffd84a', { font: OS, weight: 700, align: 'left' });
    ctx.font = `700 70px "${OS}"`; const pw = ctx.measureText(`${pct}%`).width;
    text(ctx, 'SAID', -w / 2 + 40 + pw, -h / 2 + 90, 28, '#ffffff', { font: OS, weight: 600, align: 'left' });
    opts.forEach((o, i) => {
      const y = -h / 2 + 136 + i * 46; const isWin = i === win && k > 0.95;
      if (isWin) fillRR(ctx, -w / 2 + 20, y - 18, (w - 40) * 0.7 * (o.percent / 100) + 140, 36, 6, '#ffd84a');
      text(ctx, `${i + 1}  ${(o.label || '').toUpperCase()}`, -w / 2 + 30, y + 8, 24, isWin ? '#14161f' : '#ffffff', { font: OS, weight: 600, align: 'left' });
      text(ctx, `${Math.round(o.percent * k)}%`, w / 2 - 28, y + 8, 24, isWin ? '#14161f' : '#cfd5e6', { font: OS, weight: 600, align: 'right' });
    });
  },

  // numbered choices that light up in turn + "COMMENT 1·2·3"
  'ui-choices'(ctx, L, p) {
    const opts = L.options || []; const cols = { green: '#3fbf5a', yellow: '#e9c22e', red: '#e0453c', blue: '#3d8be8' };
    const w = L.w ?? 620, h = 64, gap = 14;
    if (L.header) shadowText(ctx, L.header, 0, -((opts.length) * (h + gap)) / 2 - 30, 52, '#ffffff', { align: 'center' });
    opts.forEach((o, i) => {
      const y = i * (h + gap) - ((opts.length - 1) * (h + gap)) / 2;
      const k = backOut(clamp((p.lt - (L.delay ?? 0) - i * 0.18) / 0.35)); if (k <= 0) return;
      const lit = Math.floor(p.t * 1.6) % opts.length === i;
      const c = cols[o.color] || o.color || cols.green;
      ctx.save(); ctx.translate(0, y); ctx.scale(k, k);
      fillRR(ctx, -w / 2, -h / 2, w, h, 10, c, lit ? '#ffffff' : 'rgba(0,0,0,0.25)', lit ? 5 : 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-w / 2 + 6, -h / 2 + 5, w - 12, h * 0.35);
      circle(ctx, -w / 2 + 40, 0, 22, '#ffffff'); text(ctx, String(i + 1), -w / 2 + 40, 2, 28, c, { font: OS, weight: 700 });
      text(ctx, (o.label || '').toUpperCase(), -w / 2 + 78, 12, 34, '#ffffff', { font: OS, weight: 700, align: 'left' });
      ctx.restore();
    });
    if (L.comment !== false) {
      const y = ((opts.length) * (h + gap)) / 2 + 40;
      ctx.font = `700 40px "${OS}"`; const parts = [['COMMENT ', '#ffffff'], ...opts.flatMap((o, i) => [[String(i + 1), cols[o.color] || '#fff'], [i < opts.length - 1 ? ' · ' : '', '#ffffff']])];
      const total = parts.reduce((a, [s]) => a + ctx.measureText(s).width, 0); let x = -total / 2;
      for (const [s, c] of parts) { shadowText(ctx, s, x, y, 40, c); ctx.font = `700 40px "${OS}"`; x += ctx.measureText(s).width; }
    }
  },

  // end card: "SERIES · DAY 3" / big "DAY 3" or "PART 16" / "FOLLOW FOR PART 16"
  'ui-daycard'(ctx, L) {
    if (L.kicker) {
      ctx.font = `700 40px "${OS}"`; const parts = String(L.kicker).split(/(\*[^*]+\*)/).filter(Boolean);
      const total = parts.reduce((a, s) => a + ctx.measureText(s.replace(/\*/g, '')).width, 0); let x = -total / 2;
      for (const s of parts) { const y = s.startsWith('*'); const t = s.replace(/\*/g, ''); shadowText(ctx, t, x, -110, 40, y ? '#ffd84a' : '#ffffff'); ctx.font = `700 40px "${OS}"`; x += ctx.measureText(t).width; }
    }
    shadowText(ctx, (L.big || 'DAY 1').toUpperCase(), 0, 30, 140, L.red ? '#ff4b43' : '#ffffff', { align: 'center' });
    if (L.sub) { ctx.font = `600 26px "${OS}"`; const w = ctx.measureText(L.sub).width + 40; fillRR(ctx, -w / 2, 52, w, 42, 21, '#14161f', 'rgba(255,255,255,0.6)', 2); text(ctx, L.sub.toUpperCase(), 0, 74, 26, '#ffffff', { font: OS, weight: 600 }); }
  },

  // battle platform ellipse under a creature
  'ui-platform'(ctx, L) {
    const w = L.w ?? 380, h = w * 0.24;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(0, 10, w / 2 + 8, h / 2 + 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.color || '#b7c26a'; ctx.strokeStyle = '#6f7a33'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, -2, w / 2 - 22, h / 2 - 10, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  },

  // hit flash burst (on a word)
  'ui-hit'(ctx, L, p) {
    const k = clamp((p.lt - (p.key(L.at) ?? 0)) / 0.45); if (k <= 0 || k >= 1) return;
    ctx.globalAlpha *= 1 - k;
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10 * (1 - k); ctx.beginPath(); ctx.moveTo(Math.cos(a) * 40 * (1 + k), Math.sin(a) * 40 * (1 + k)); ctx.lineTo(Math.cos(a) * 140 * (0.5 + k), Math.sin(a) * 140 * (0.5 + k)); ctx.stroke(); }
    circle(ctx, 0, 0, 60 * (1 + k), `rgba(255,255,255,${0.7 * (1 - k)})`);
  },
};
