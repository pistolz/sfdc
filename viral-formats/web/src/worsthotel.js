// 30 DAYS TO SAVE THE WORST HOTEL — Day 1, full episode.
// Art = the original hotel-clerk SVG (unchanged) split into puppet parts + new sets in the same ink style.
// Every shot is timed to the narrator's word timestamps; HUD + captions in the reference style.
import { ART } from '../assets/worsthotel/art.js';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const eo = (k) => 1 - Math.pow(1 - clamp(k), 3);
const eio = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const back = (k) => { k = clamp(k); const s = 1.7; return 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2); };
const INK = '#171510', CREAM = '#f3ead2';

export const LINES = ['v01', 'v02', 'v03', 'v04', 'v05', 'v06', 'v07', 'v08', 'v09', 'v10'];
export function timeline(durs) { // start time of each VO line
  const st = {}; let t = 0.35;
  LINES.forEach((k) => { st[k] = t; t += durs[k] + (k === 'v05' ? 1.0 : 0.32); });
  return { st, end: t + 0.9 };
}

export async function create(stage) {
  // ---- words / timing
  const W = {}, D = {};
  for (const k of LINES) { const w = await (await fetch(`/assets/worsthotel/vo/${k}.json`)).json(); D[k] = w[w.length - 1].e; W[k] = w; }
  const { st, end } = timeline(D);
  for (const k of LINES) W[k] = W[k].map((w) => ({ ...w, t: w.t + st[k], e: w.e + st[k], w: w.w.replace(/[.?!,…]+$/g, '').replace(/^\.+$/, '') })).filter((w) => w.w);
  const at = (k, word, n = 0) => (W[k].filter((x) => x.w.toLowerCase().startsWith(word))[n] || W[k][0]).t;
  window.__TL = { st, end };
  const DUR = end;

  // ---- DOM: svg (art) + canvas (HUD/captions)
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 1080 1920'); svg.setAttribute('width', 1080); svg.setAttribute('height', 1920);
  svg.style.cssText = 'position:absolute;inset:0;stroke-linecap:round;stroke-linejoin:round';
  svg.innerHTML = `<defs>${ART.defs}</defs><g id="cam"><g id="set"></g></g>`;
  stage.appendChild(svg);
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; cv.style.cssText = 'position:absolute;inset:0'; stage.appendChild(cv);
  const ctx = cv.getContext('2d');
  const cam = svg.querySelector('#cam'), set = svg.querySelector('#set');

  const gusMarkup = `<g class="gus"><g class="gbody">${ART.body}</g><g class="ghead">${ART.head}</g></g>`;
  const lobby = (blur = false) => `<g transform="scale(1.8)" ${blur ? 'filter="url(#soft)"' : ''}>${ART.lobby.replace('<!--GUS-->', `<g transform="translate(128 99) scale(1.38)">${gusMarkup}</g>`)}</g>`;
  const close = () => `<g transform="scale(1.812) translate(-604 0)">${ART.closeBg.replace('<!--HEAD-->', `<g transform="translate(554 82) scale(2.55 3.25)"><g class="ghead">${ART.head}</g></g>`)}</g>`;
  const flies = (n) => Array.from({ length: n }, (_, i) => `<use class="fly f${i}" href="#fly"/>`).join('');
  const SETS = {
    lobby: () => lobby() + `<g class="walker"><g class="r1">${ART.roach}</g></g>` + flies(3),
    motelNight: () => ART.motelNight + ART.neonDim,
    phone: () => lobby(true) + '<rect width="1080" height="1920" fill="#000" opacity=".35"/>' + `<g class="ph">${ART.phone}</g>`,
    dawn: () => ART.motelDawn + ART.neonDim + `<g class="dozer">${ART.bulldozer}</g>` + `<g class="stamp" opacity="0"><g transform="translate(540 760) rotate(-12)"><rect x="-330" y="-90" width="660" height="180" fill="#f7efd8" stroke="#c73b2d" stroke-width="12" rx="10"/><text x="0" y="40" font-family="Nunito" font-weight="900" font-size="110" text-anchor="middle" fill="#c73b2d">DEMOLITION</text></g></g>`,
    close: () => close() + flies(2) + `<g class="smoke"></g>`,
    floor: () => ART.floor + `<g class="army">${Array.from({ length: 34 }, (_, i) => `<g class="ar a${i}">${ART.roach}</g>`).join('')}</g>`,
    bath: () => ART.bathroom + flies(14),
    vote: () => lobby() + '<rect width="1080" height="1920" fill="#10141f" opacity=".55"/>' + `<g class="cR">${ART.cardRoach}</g><g class="cT">${ART.cardToilet}</g>`,
  };
  // shots: [setName, startLine]
  const SHOTS = [
    ['lobby', 'v01'], ['motelNight', 'v02'], ['lobby', 'v03'], ['phone', 'v04'], ['dawn', 'v05'],
    ['close', 'v06'], ['floor', 'v07'], ['bath', 'v08'], ['vote', 'v09'], ['vote', 'v10'],
  ].map(([s, k], i, a) => ({ set: s, k, i, t0: i === 0 ? 0 : st[k] - 0.18, t1: i < a.length - 1 ? st[a[i + 1][1]] - 0.18 : DUR }));
  let curShot = -1;
  const q = (sel) => set.querySelector(sel), qa = (sel) => set.querySelectorAll(sel);
  const T = (el, tr) => { if (el) el.setAttribute('transform', tr); };

  // ---- puppet driver (head local coords: neck ≈ (130,236), cigar pivot (164,196))
  function puppet(root, t, o = {}) {
    if (!root) return;
    const head = root.querySelector('.ghead'), bodyG = root.querySelector('.gbody');
    const tilt = Math.sin(t * 1.1) * 1.6 + (o.tilt || 0), bob = Math.sin(t * 2.2) * 1.5;
    T(head, `translate(0 ${bob}) rotate(${tilt} 130 236)`);
    if (bodyG) { const b = 1 + Math.sin(t * 2.2) * 0.012; T(bodyG, `translate(140 470) scale(${1 + (b - 1) * 0.6} ${b}) translate(-140 -470)`); }
    const pu = head.querySelector('.h_pupils'); T(pu, `translate(${(o.lookX || 0) * 6} ${(o.lookY || 0) * 5})`);
    const br = head.querySelector('.h_brows'); T(br, `translate(0 ${-(o.brow || 0) * 9})`);
    const blinkOn = o.blink ?? (((t + (o.ph || 0)) % 3.4) < 0.12);
    head.querySelector('.h_blink').style.display = blinkOn ? '' : 'none';
    const cg = head.querySelector('.h_cigar');
    if (o.cigarDrop != null) { const k = clamp(o.cigarDrop); T(cg, `translate(${k * 10} ${k * k * 260}) rotate(${k * 70} 164 196)`); cg.style.opacity = k > 0.95 ? 0 : 1; }
    else T(cg, `rotate(${Math.sin(t * 3.1) * 4} 164 196)`);
    T(head.querySelector('.h_mouth'), `translate(0 ${Math.max(0, Math.sin(t * 3.1)) * 1.6 + (o.jaw || 0)})`);
  }
  function flyAnim(t, list, cx, cy, r, s = 1) {
    list.forEach((f, i) => { const a = t * (2 + i * 0.4) + i * 2.1; T(f, `translate(${cx + Math.cos(a) * r * (1 + i * 0.15)} ${cy + Math.sin(a * 1.3) * r * 0.45}) scale(${s * (1 + Math.sin(t * 40 + i) * 0.04)})`); });
  }
  function roachWalk(el, x, y, s, rot, t) {
    T(el, `translate(${x} ${y}) rotate(${rot}) scale(${s})`);
    el.querySelectorAll('.leg').forEach((l, j) => { l.setAttribute('transform', `rotate(${Math.sin(t * 28 + j * 1.7) * 14} ${-12 + (j >> 1) * 12} 0)`); });
  }

  // ---- canvas overlay: HUD + captions + stamps
  function hud(t) {
    ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    ctx.font = '900 34px Nunito'; ctx.lineWidth = 8; ctx.fillStyle = CREAM; ctx.strokeText('DAY', 100, 300); ctx.fillText('DAY', 100, 300);
    ctx.font = '900 120px Nunito'; const g = ctx.createLinearGradient(0, 300, 0, 410); g.addColorStop(0, '#ffe08a'); g.addColorStop(1, '#d39a2c'); ctx.lineWidth = 14; ctx.strokeText('01', 92, 410); ctx.fillStyle = g; ctx.fillText('01', 92, 410);
    const pulse = 1 + (t > at('v04', 'thirty') && t < at('v04', 'thirty') + 0.5 ? Math.sin(Math.PI * (t - at('v04', 'thirty')) / 0.5) * 0.25 : 0);
    ctx.save(); ctx.translate(800, 360); ctx.scale(pulse, pulse); ctx.font = '900 132px Nunito'; ctx.textAlign = 'right'; ctx.strokeText('30', 0, 40); ctx.fillStyle = CREAM; ctx.fillText('30', 0, 40); ctx.restore();
    ctx.textAlign = 'left'; ctx.font = '900 36px Nunito'; ctx.lineWidth = 7; ctx.fillStyle = CREAM; for (const [s, yy] of [['DAYS', 335], ['LEFT', 375]]) { ctx.strokeText(s, 815, yy); ctx.fillText(s, 815, yy); }
    ctx.restore();
  }
  function pop(txt, x, y, size, t0, t, fill = CREAM, rot = 0) {
    const k = t - t0; if (k < 0) return; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); const s = back(k / 0.22); ctx.scale(s, s);
    ctx.font = `900 ${size}px Nunito`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowOffsetY = 7; ctx.lineWidth = Math.max(10, size * 0.2); ctx.strokeStyle = INK; ctx.strokeText(txt, 0, 0);
    ctx.shadowColor = 'transparent'; ctx.fillStyle = fill; ctx.fillText(txt, 0, 0); ctx.restore();
  }
  function captions(t, y) {
    for (const k of LINES) { const ln = W[k]; const cur = ln.filter((w) => t >= w.t - 0.03 && t < w.e + 0.08 && t < (st[LINES[LINES.indexOf(k) + 1]] ?? 1e9) - 0.2); if (!cur.length) continue;
      const w = cur[cur.length - 1]; const i = ln.indexOf(w); const g0 = Math.floor(i / 3) * 3; pop(ln.slice(g0, i + 1).map((x) => x.w).join(' '), 540, y, 74, ln[g0].t - 0.03, t); }
  }

  function renderFrame(t) {
    const si = SHOTS.findIndex((s) => t >= s.t0 && t < s.t1); const S = SHOTS[si < 0 ? SHOTS.length - 1 : si];
    if (S.i !== curShot) { set.innerHTML = SETS[S.set](); curShot = S.i; }
    const lt = t - S.t0; let cx = 540, cy = 960, z = 1, shake = 0, capY = 1360;
    switch (S.i) {
      case 0: { // ECU bell+roach → pull-out to the lobby
        const k = eio((t - 0.2) / 1.3); z = lerp(2.1, 1.0, k); cx = lerp(700, 540, k); cy = lerp(1130, 960, k); shake = t < 0.22 ? (1 - t / 0.22) * 10 : 0;
        puppet(q('.gus'), t, { lookX: -0.4 }); roachWalk(q('.r1'), lerp(900, 760, clamp(t / 1.2)), 1188, 1.5, 180, t);
        flyAnim(t, [...qa('.fly')], 560, 420, 160, 1.6); break; }
      case 1: { z = lerp(1.0, 1.45, eio(lt / 2.2)); cx = lerp(540, 420, eio(lt / 2.2)); cy = lerp(960, 760, eio(lt / 2.2)); // neon flicker
        const off = (Math.floor(t * 12) % 7 === 0); qa('.ltr1, .ltr4').forEach((e) => e.style.opacity = off ? 1 : 0.15); qa('.ltr0, .ltr2, .ltr3').forEach((e) => e.style.opacity = (Math.floor(t * 17) % 23 === 0) ? 0.3 : 1); break; }
      case 2: { const ow = at('v03', 'owner'); z = 2.0 + lt * 0.05; cx = 552; cy = 640;
        puppet(q('.gus'), t, { lookX: t > ow ? 0.2 : -0.6, lookY: t > ow ? 0.6 : 0, brow: t > ow ? eo((t - ow) / 0.2) : 0 });
        flyAnim(t, [...qa('.fly')], 560, 430, 160, 1.6); capY = 1420; break; }
      case 3: { z = 1.0; const k = eo(lt / 0.5); T(q('.ph'), `translate(0 ${(1 - k) * 1300}) rotate(${(1 - k) * 8} 540 960)`); capY = 1700; break; }
      case 4: { const k = eio(clamp((lt - 0.3) / 2.6)); T(q('.dozer'), `translate(${lerp(1400, 700, k)} 1560) scale(1.5)`);
        const bz = at('v05', 'bulldozed'); if (t > bz) { const s = q('.stamp'); s.style.opacity = 1; const kk = back((t - bz) / 0.25); T(s, `translate(540 760) scale(${kk}) translate(-540 -760)`); shake = t < bz + 0.4 ? (1 - (t - bz) / 0.4) * 22 : 0; }
        z = 1.0 + lt * 0.02; break; }
      case 5: { // face ECU: cigar drops in the silence, then "Your help" → looks at camera
        const yh = at('v06', 'your'); z = 1.04 + lt * 0.02;
        puppet(q('.gus') || set, t, { cigarDrop: clamp((lt - 0.15) / 0.55), lookX: t > yh ? 0 : -0.8, lookY: t > yh ? 0.4 : 0.2, brow: t > yh ? eo((t - yh) / 0.2) : 0.3, jaw: 3 });
        flyAnim(t, [...qa('.fly')], 540, 380, 380, 2.2); capY = 1500; break; }
      case 6: { // roach army marching
        qa('.ar').forEach((r, i) => { const row = i % 6, col = Math.floor(i / 6); const x = 120 + row * 170 + (col % 2) * 60; const y = ((col * 260 + lt * 420) % 1900) + 250; roachWalk(r, x, y, 1.7, 90, t + i); });
        const n = Math.round(lerp(12, 1247, eo(lt / 1.6))); pop(`ROACHES: ${n.toLocaleString('en-US')}`, 540, 600, 72, S.t0 + 0.1, t, '#ffd36a'); break; }
      case 7: { // bathroom door creaks open, flies burst, slam on the 2nd "bathroom"
        const b2 = at('v08', 'bathroom', 1); const open = t < b2 ? eo((lt - 0.2) / 0.6) * 0.12 : Math.max(0, 0.12 - (t - b2) * 1.2);
        T(q('.door'), `translate(270 0) scale(${1 - open} 1) translate(-270 0)`); q('.glow').style.opacity = 0.6 + 0.4 * Math.sin(t * 7);
        qa('.fly').forEach((f, i) => { const u = clamp((lt - 0.3 - i * 0.05) / 2.2); const ox = 790 + u * (200 + i * 30) * (i % 2 ? 1 : 1.4), oy = 500 + i * 70 + Math.sin(t * 6 + i) * 40 - u * 150; T(f, `translate(${ox} ${oy}) scale(2)`); f.style.opacity = t < b2 + 0.1 ? (u > 0 ? 1 : 0) : 0; });
        shake = t > b2 + 0.1 && t < b2 + 0.5 ? (1 - (t - b2 - 0.1) / 0.4) * 24 : 0; break; }
      case 8: case 9: { // vote cards
        const k1 = back((t - SHOTS[8].t0 - 0.1) / 0.35), k2 = back((t - SHOTS[8].t0 - 0.3) / 0.35);
        const hiR = S.i === 9 && t >= at('v10', 'roaches') && t < at('v10', 'or'), hiT = S.i === 9 && t >= at('v10', 'toilet') && t < at('v10', 'comment');
        const wob = (p) => Math.sin(t * 3 + p) * 3, bobY = (p) => Math.sin(t * 2.4 + p) * 12;
        T(q('.cR'), `translate(290 ${1060 + bobY(0)}) scale(${Math.max(0.001, k1) * (hiR ? 1.14 : 1)}) rotate(${-4 + wob(0)})`); T(q('.cT'), `translate(790 ${1060 + bobY(2)}) scale(${Math.max(0.001, k2) * (hiT ? 1.14 : 1)}) rotate(${4 + wob(2)})`);
        z = 1 + (t - SHOTS[8].t0) * 0.012;
        puppet(q('.gus'), t, {}); capY = 1560; break; }
    }
    if (shake) { cx += Math.sin(t * 93) * shake; cy += Math.cos(t * 81) * shake; }
    cam.setAttribute('transform', `translate(540 960) scale(${z}) translate(${-cx} ${-cy})`);
    // overlay
    ctx.clearRect(0, 0, 1080, 1920);
    hud(t);
    if (S.i === 2) { pop('GUS', 300, 1180, 110, at('v03', 'gus'), t, '#ffd36a', -0.08); pop('OWNER · LAST SHOWER: 2019', 540, 1290, 44, at('v03', 'owner'), t); }
    if (S.i === 8 || S.i === 9) pop('DAY 1 · YOU CHOOSE', 540, 640, 76, SHOTS[8].t0 + 0.1, t);
    if (S.i === 9) { pop('COMMENT ONE WORD', 540, 1440, 70, at('v10', 'comment'), t, '#ffd36a'); if (t > at('v10', 'comment')) pop('\u2193', 540, 1560 + Math.abs(Math.sin(t * 5)) * 30, 120, at('v10', 'comment') + 0.2, t, '#ffd36a'); }
    if (!(S.i === 9 && t > at('v10', 'comment'))) captions(t, capY);
  }
  renderFrame(0);
  return { duration: DUR, renderFrame };
}
