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

export const LINES = ['w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w07', 'w08', 'w09', 'w10', 'w11'];
export function timeline(durs) { // start time of each VO line
  const st = {}; let t = 0.35;
  LINES.forEach((k) => { st[k] = t; t += durs[k] + (k === 'w08' ? 1.25 : k === 'w10' ? 0.15 : 0.28); });
  return { st, end: t + 1.4 };
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
    phone: () => lobby(true) + '<rect width="1080" height="1920" fill="#000" opacity=".35"/>' + `<g class="ph">${ART.phoneChat}<g class="bub"></g></g>`,
    dawn: () => ART.motelDawn + ART.neonDim + `<g class="dozer">${ART.bulldozer}</g>` + `<g class="stamp" opacity="0"><g transform="translate(540 760) rotate(-12)"><rect x="-330" y="-90" width="660" height="180" fill="#f7efd8" stroke="#c73b2d" stroke-width="12" rx="10"/><text x="0" y="40" font-family="Nunito" font-weight="900" font-size="110" text-anchor="middle" fill="#c73b2d">DEMOLITION</text></g></g>`,
    close: () => close() + flies(2) + `<g class="smoke"></g>`,
    floor: () => ART.floor + `<g class="army">${Array.from({ length: 34 }, (_, i) => `<g class="ar a${i}">${ART.roach}</g>`).join('')}</g>`,
    bath: () => ART.bathroom + flies(14),
    vote: () => lobby() + '<rect width="1080" height="1920" fill="#10141f" opacity=".55"/>' + `<g class="cR">${ART.cardRoach}</g><g class="cT">${ART.cardToilet}</g>`,
  };
  // shots: [setName, startLine]
  const SHOTS = [
    ['lobby', 'w01'], ['lobby', 'w02'], ['close', 'w03'], ['lobby', 'w04'], ['lobby', 'w05'],
    ['phone', 'w06'], ['close', 'cig'], ['dawn', 'w09'], ['vote', 'w10'],
  ].map(([s, k], i) => ({ set: s, k, i }));
  st.cig = st.w08 + D.w08 + 0.08;
  SHOTS.forEach((S, i) => { S.t0 = i === 0 ? 0 : st[S.k] - 0.18; });
  SHOTS.forEach((S, i) => { S.t1 = i < SHOTS.length - 1 ? SHOTS[i + 1].t0 : DUR; });
  SHOTS[6].t0 = st.cig; SHOTS[5].t1 = st.cig;
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
    const tp = at('w08', 'thirty'); const pulse = 1 + (t > tp && t < tp + 0.5 ? Math.sin(Math.PI * (t - tp) / 0.5) * 0.25 : 0);
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
    const si = SHOTS.findIndex((s2) => t >= s2.t0 && t < s2.t1); const S = SHOTS[si < 0 ? SHOTS.length - 1 : si];
    if (S.i !== curShot) { set.innerHTML = SETS[S.set](); curShot = S.i; }
    const lt = t - S.t0; let cx = 540, cy = 960, z = 1, shake = 0, capY = 1360;
    const bubble = (y, txt, t0, me = false) => { if (t < t0) return ''; const k = back((t - t0) / 0.25); const w = 40 + txt.length * 23;
      const x = me ? 820 - w : 260; return `<g transform="translate(${x + w / 2} ${y}) scale(${k}) translate(${-w / 2} -40)"><rect width="${w}" height="80" rx="28" fill="${me ? '#3c82c0' : '#fffaf0'}" stroke="#171510" stroke-width="5"/><text x="26" y="54" font-family="Nunito" font-weight="900" font-size="38" fill="${me ? '#fff' : '#171510'}">${txt}</text></g>`; };
    switch (S.i) {
      case 0: { // "This is Gus." — snap from the bell to Gus, medium
        const k = eio((t - 0.15) / 0.5); z = lerp(2.2, 1.55, k); cx = lerp(700, 552, k); cy = lerp(1150, 700, k); shake = t < 0.2 ? (1 - t / 0.2) * 10 : 0;
        puppet(q('.gus'), t, { lookX: 0.2, lookY: 0.5 }); roachWalk(q('.r1'), lerp(900, 760, clamp(t / 1.2)), 1188, 1.5, 180, t);
        flyAnim(t, [...qa('.fly')], 560, 420, 160, 1.6); capY = 1420; break; }
      case 1: { const k = eio(lt / 1.2); z = lerp(1.55, 1.0, k); cx = lerp(552, 540, k); cy = lerp(700, 960, k);
        puppet(q('.gus'), t, { lookX: -0.5 }); roachWalk(q('.r1'), lerp(760, 560, clamp(lt / 2.4)), 1188, 1.5, 180, t);
        flyAnim(t, [...qa('.fly')], 560, 420, 160, 1.6); break; }
      case 2: { z = 1.04 + lt * 0.025; puppet(set, t, { lookX: -0.6, brow: 0.2 }); flyAnim(t, [...qa('.fly')], 540, 380, 380, 2.2); capY = 1500; break; }
      case 3: { z = 2.1 + lt * 0.04; cx = 548; cy = 1440; puppet(q('.gus'), t, {}); capY = 1150; break; }               // feet detail
      case 4: { const k = eio(lt / 2.2); z = 2.3; cx = lerp(260, 860, k); cy = 1150; puppet(q('.gus'), t, {}); roachWalk(q('.r1'), lerp(980, 820, clamp(lt / 2)), 1188, 1.5, 180, t); capY = 1450; break; } // counter pan
      case 5: { // phone: buzz, then chat bubbles on the words
        const k = eo(lt / 0.45); const buzz = lt < 0.9 ? Math.sin(t * 80) * 6 * (1 - lt / 0.9) : 0;
        T(q('.ph'), `translate(${buzz} ${(1 - k) * 1300}) rotate(${(1 - k) * 8} 540 960)`);
        q('.bub').innerHTML = bubble(700, 'Hi Gus \u{1F642}', at('w06', 'got')) + bubble(820, "It's Margot.", at('w07', 'his')) + bubble(940, "I'm a 5\u2605 hotel critic now", at('w07', 'five')) + bubble(1060, 'Booked your hotel.', at('w08', 'checks')) + bubble(1180, 'See you in 30 days \u{1F618}', at('w08', 'thirty')) + bubble(1320, '...', at('w08', 'days') + 0.5, true);
        { const ys = [[at('w06','got'),700],[at('w07','his'),820],[at('w07','five'),940],[at('w08','checks'),1060],[at('w08','thirty'),1180],[at('w08','days')+0.5,1320]]; let fy = 760; for (const [tt2, yy] of ys) if (t > tt2) fy = yy;
          const zz = lt < 0.6 ? 1 : lerp(1, 1.55, eio((lt - 0.6) / 0.6)); z = zz; cx = 540; cy = lerp(960, fy, eio((lt - 0.6) / 0.6)); window.__fy = (window.__fy ?? cy) + (cy - (window.__fy ?? cy)) * 0.15; cy = window.__fy; }
        capY = 1700; break; }
      case 6: { z = 1.06; puppet(set, t, { cigarDrop: clamp((lt - 0.1) / 0.5), lookX: 0, lookY: 0.5, brow: 1, blink: false, jaw: 4 }); flyAnim(t, [...qa('.fly')], 540, 380, 380, 2.2); capY = 1500; break; }
      case 7: { const k = eio(clamp((lt - 0.2) / 2.2)); T(q('.dozer'), `translate(${lerp(1400, 700, k)} 1560) scale(1.5)`);
        const bz = at('w09', 'bulldozed'); if (t > bz) { const s2 = q('.stamp'); s2.style.opacity = 1; const kk = back((t - bz) / 0.25); T(s2, `translate(540 760) scale(${kk}) translate(-540 -760)`); shake = t < bz + 0.4 ? (1 - (t - bz) / 0.4) * 22 : 0; }
        z = 1.0 + lt * 0.02; break; }
      case 8: { const t8 = SHOTS[8].t0; const k1 = back((at('w10', 'roaches') - 0.2 - t8 < 0 ? t - t8 : t - at('w10', 'roaches') + 0.2) / 0.35), k2 = back((t - at('w10', 'toilet') + 0.2) / 0.35);
        const hiR = t >= at('w10', 'roaches') && t < at('w10', 'or'), hiT = t >= at('w10', 'toilet') && t < st.w11;
        const wob = (p) => Math.sin(t * 3 + p) * 3, bobY = (p) => Math.sin(t * 2.4 + p) * 12;
        T(q('.cR'), `translate(290 ${1080 + bobY(0)}) scale(${Math.max(0.001, k1) * (hiR ? 1.14 : 1)}) rotate(${-4 + wob(0)})`); T(q('.cT'), `translate(790 ${1080 + bobY(2)}) scale(${Math.max(0.001, k2) * (hiT ? 1.14 : 1)}) rotate(${4 + wob(2)})`);
        z = 1 + lt * 0.01; puppet(q('.gus'), t, {}); capY = 1580; break; }
    }
    if (shake) { cx += Math.sin(t * 93) * shake; cy += Math.cos(t * 81) * shake; }
    cam.setAttribute('transform', `translate(540 960) scale(${z}) translate(${-cx} ${-cy})`);
    // overlay
    ctx.clearRect(0, 0, 1080, 1920);
    hud(t);
    if (S.i === 0) pop('GUS', 290, 1220, 130, at('w01', 'gus'), t, '#ffd36a', -0.08);
    if (S.i === 2) pop('2019', 760, 560, 150, at('w03', '2019'), t, '#9fd36a', -0.14);
    if (S.i === 4) pop('STICKY.', 540, 760, 120, at('w05', 'sticky'), t, '#9fd36a', 0.06);
    if (S.i === 8) { pop('WHAT DOES GUS', 540, 590, 84, S.t0 + 0.05, t); pop('FIX FIRST?', 540, 690, 96, S.t0 + 0.15, t, '#ffd36a'); }
    if (S.i === 8 && t > st.w11) { pop('COMMENT ONE WORD', 540, 1440, 70, st.w11, t, '#ffd36a'); pop('\u2193', 540, 1560 + Math.abs(Math.sin(t * 5)) * 30, 120, st.w11 + 0.2, t, '#ffd36a'); }
    if (!(S.i === 8 && t > st.w11) && S.i !== 6) captions(t, capY);
  }
  renderFrame(0);
  return { duration: DUR, renderFrame };
}
