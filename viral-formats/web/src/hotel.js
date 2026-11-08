// WORST HOTEL — Day 1 animatic of 4 key shots (style test / gate 2).
// AI style frames + code: camera moves timed to VO words, neon flicker, dust, flies,
// glossy HUD, word-synced captions, transitions (whip-pan, flash match cut, hard cut + slam).
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const eo = (k) => 1 - Math.pow(1 - clamp(k), 3);
const eio = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const back = (k) => { k = clamp(k); const s = 1.9; return 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2); };
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// timeline (s) — VO clip offsets must match scripts/hotel-audio.py
export const VO = { l1: 0.25, l2: 3.1, l3: 5.5, l4: 7.8 };
const SHOTS = [ // [start, end, image]
  [0.0, 2.95, 's1'], [2.95, 5.35, 's2'], [5.35, 7.6, 's3'], [7.6, 11.35, 's4'],
];
const DUR = 12.7;

export async function create(stage) {
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; stage.appendChild(cv);
  const ctx = cv.getContext('2d');
  const base = '/assets/hotel/';
  const img = { s1: await load(base + 's1-hook.png'), s2: await load(base + 's2-exterior.png'), s3: await load(base + 's3-gus.png'), s4: await load(base + 's4-bathroom.png') };
  const words = {}; for (const k of Object.keys(VO)) { const w = await (await fetch(base + 'vo/' + k + '.json')).json(); words[k] = w.map((x) => ({ ...x, t: x.t + VO[k], e: x.e + VO[k], w: x.w.replace(/\.+$/, '') })); }
  const at = (line, word, n = 0) => { const m = words[line].filter((x) => x.w.toLowerCase().replace(/[^a-z']/g, '') === word); return (m[n] || m[0]).t; };
  const T = {
    worst: at('l1', 'worst'), america: at('l1', 'america'), one: at('l2', 'one'), good: at('l2', 'good'),
    gus: at('l3', 'gus'), owner: at('l3', 'owner'), bath1: at('l4', 'bathroom', 0), talk: at('l4', 'talk'), bath2: at('l4', 'bathroom', 1),
  };
  T.slam = words.l4[words.l4.length - 1].e + 0.05;
  window.__T = T;
  const R = rng(7);
  const dust = Array.from({ length: 70 }, () => ({ x: R() * 1080, y: R() * 1920, r: 1 + R() * 3, s: 6 + R() * 18, p: R() * 6.28 }));
  const flies = Array.from({ length: 4 }, (_, i) => ({ r: 70 + R() * 50, sp: 2.5 + R() * 2, p: i * 1.6, z: R() }));
  const swarm = Array.from({ length: 26 }, () => ({ x: 430 + R() * 120, y: 300 + R() * 1150, vx: -40 - R() * 160, vy: -30 + R() * 60, p: R() * 6.28, s: 0.6 + R() * 0.7 }));

  // ---------- drawing helpers
  function plate(im, cam, blurX = 0) { // cam: {x,y,z} focus point in image px, zoom
    const z = cam.z, ox = 540 - cam.x * z, oy = 960 - cam.y * z;
    if (blurX) { ctx.globalAlpha = 1 / 7; for (let k = -3; k <= 3; k++) ctx.drawImage(im, ox + k * blurX, oy, 1080 * z, 1920 * z); ctx.globalAlpha = 1; }
    else ctx.drawImage(im, ox, oy, 1080 * z, 1920 * z);
    return (x, y) => [ox + x * z, oy + y * z];
  }
  function fly(x, y, s, t, ph) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(15,12,10,0.95)'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 4, 0, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(6, -1, 3, 0, 6.28); ctx.fill();
    const w = Math.sin(t * 90 + ph) * 0.5 + 0.5; ctx.fillStyle = `rgba(230,240,255,${0.35 + 0.3 * w})`;
    ctx.beginPath(); ctx.ellipse(-1, -5 - w * 2, 6, 3, -0.5, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.ellipse(2, -5 - w * 2, 5, 2.6, 0.4, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  function motes(t, color, alpha = 1) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of dust) { const y = ((m.y - t * m.s) % 1920 + 1920) % 1920, x = m.x + Math.sin(t * 0.7 + m.p) * 12, a = (0.25 + 0.25 * Math.sin(t * 1.7 + m.p)) * alpha; const g = ctx.createRadialGradient(x, y, 0, x, y, m.r * 3); g.addColorStop(0, `rgba(${color},${a})`); g.addColorStop(1, `rgba(${color},0)`); ctx.fillStyle = g; ctx.fillRect(x - m.r * 3, y - m.r * 3, m.r * 6, m.r * 6); }
    ctx.restore();
  }
  function grade(t) {
    const v = ctx.createRadialGradient(540, 900, 480, 540, 960, 1250); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = v; ctx.fillRect(0, 0, 1080, 1920);
    const n = (Math.floor(t * 24) * 9301 + 49297) % 233280; ctx.globalAlpha = 0.045; ctx.fillStyle = '#fff';
    for (let i = 0; i < 260; i++) { const x = ((n + i * 7919) % 1080), y = ((n * 3 + i * 104729) % 1920); ctx.fillRect(x, y, 2, 2); }
    ctx.globalAlpha = 1;
  }
  function textPop(str, x, y, size, t0, t, { color = '#ffffff', grad = null, align = 'center', stroke = 10 } = {}) {
    const k = t - t0; if (k < 0) return; const s = back(k / 0.28), a = clamp(k / 0.08);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a; ctx.font = `900 ${size}px Nunito`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
    ctx.lineWidth = stroke; ctx.strokeStyle = '#1a0d08'; ctx.strokeText(str, 0, 0); ctx.shadowColor = 'transparent';
    if (grad) { const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, grad[0]); g.addColorStop(1, grad[1]); ctx.fillStyle = g; } else ctx.fillStyle = color;
    ctx.fillText(str, 0, 0);
    ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#fff'; ctx.save(); ctx.beginPath(); ctx.rect(-2000, -size / 2, 4000, size * 0.32); ctx.clip(); ctx.fillText(str, 0, 0); ctx.restore();
    ctx.restore();
  }
  function captions(t) { // word-by-word: current phrase of ≤3 words, active word in gradient yellow
    let all = []; for (const k of Object.keys(words)) all = all.concat(words[k].map((w) => ({ ...w, line: k })));
    const cur = all.filter((w) => t >= w.t - 0.02 && t < w.e + 0.35); if (!cur.length) return;
    const w = cur[cur.length - 1]; const line = all.filter((x) => x.line === w.line); const i = line.indexOf(line.find((x) => x.t === w.t));
    const g0 = Math.floor(i / 3) * 3, grp = line.slice(g0, g0 + 3);
    ctx.font = '900 64px Nunito'; const sp = 18; const widths = grp.map((x) => ctx.measureText(x.w.toUpperCase()).width); const total = widths.reduce((a, b) => a + b, 0) + sp * (grp.length - 1);
    let x = 540 - total / 2;
    grp.forEach((g, j) => { if (t >= g.t - 0.02) textPop(g.w.toUpperCase(), x + widths[j] / 2, 1330, 64, g.t - 0.02, t, g === w ? { grad: ['#fff3a0', '#ffb81c'] } : {}); x += widths[j] + sp; });
  }
  function pill(x, y, label, value, t0, t, accent) {
    const k = eo((t - t0) / 0.35); if (k <= 0) return; ctx.save(); ctx.translate(x, y - (1 - k) * 40); ctx.globalAlpha = k;
    ctx.font = '900 30px Nunito'; const w = ctx.measureText(label).width + ctx.measureText(value).width + 70, h = 66;
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(40,24,18,0.92)'); g.addColorStop(1, 'rgba(15,9,7,0.92)'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, 0, w, h, 33); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,220,150,0.45)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.roundRect(4, 3, w - 8, h * 0.42, 28); ctx.fill();
    ctx.textBaseline = 'middle'; ctx.fillStyle = '#d9c3a8'; ctx.textAlign = 'left'; ctx.fillText(label, 26, h / 2 + 2);
    ctx.fillStyle = accent; ctx.fillText(value, 26 + ctx.measureText(label + ' ').width, h / 2 + 2); ctx.restore();
  }
  function hud(t, t0) { pill(90, 250, 'DAYS LEFT', '30', t0, t, '#ffd84a'); pill(430, 250, '', '★☆☆☆☆', t0 + 0.12, t, '#ffcf3a'); }
  function nameCard(t, t0) {
    const k = eo((t - t0) / 0.3); if (k <= 0) return; ctx.save(); ctx.translate(90 - (1 - k) * 400, 1060);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; const g = ctx.createLinearGradient(0, 0, 640, 0); g.addColorStop(0, '#ffcf3a'); g.addColorStop(1, '#ff9a1f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, 0, 420, 96, 18); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#1a0d08'; ctx.font = '900 64px Nunito'; ctx.textBaseline = 'middle'; ctx.fillText('GUS', 26, 52);
    ctx.font = '900 30px Nunito'; ctx.fillText('· OWNER', 200, 52);
    ctx.fillStyle = 'rgba(20,12,8,0.88)'; ctx.beginPath(); ctx.roundRect(0, 106, 520, 58, 14); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 30px Nunito'; ctx.fillText('LAST SHOWER: ', 22, 136); ctx.fillStyle = '#7dff8a'; ctx.fillText('2019', 22 + ctx.measureText('LAST SHOWER: ').width, 136);
    ctx.restore();
  }

  function renderFrame(t) {
    ctx.save();
    // global shake (bell ding, slam)
    let sh = 0; if (t < 0.25) sh = (1 - t / 0.25) * 10; if (t > T.slam && t < T.slam + 0.4) sh = (1 - (t - T.slam) / 0.4) * 28;
    if (sh) ctx.translate(Math.sin(t * 90) * sh, Math.cos(t * 77) * sh);
    ctx.fillStyle = '#000'; ctx.fillRect(-50, -50, 1180, 2020);
    const sIdx = SHOTS.findIndex(([a, b]) => t >= a && t < b);
    if (t < SHOTS[0][1]) { // SHOT 1 — ECU bell, snap pull-out, slow push
      const k = eo(t / 0.55); const z = lerp(1.75, 1.05, k) + t * 0.025;
      plate(img.s1, { x: lerp(650, 560, k), y: lerp(1260, 1050, k), z });
      motes(t, '255,210,140', 0.9);
      textPop('WORST', 540, 560, 150, T.worst, t, { grad: ['#fff3a0', '#ffb81c'], stroke: 16 });
      textPop('HOTEL IN AMERICA', 540, 690, 70, T.america, t, { stroke: 12 });
    } else if (t < SHOTS[1][1]) { // SHOT 2 — whip-pan in, slow push on neon
      const lt = t - SHOTS[1][0]; const whip = clamp(1 - lt / 0.22); const z = 1.08 + lt * 0.03;
      plate(img.s2, { x: 540 - whip * 260, y: 900, z }, whip * 40);
      // neon flicker over the sign
      const fl = (Math.floor(t * 14) % 9 === 0 || Math.floor(t * 23) % 13 === 0) ? 1 : 0;
      if (fl) { ctx.fillStyle = 'rgba(10,0,20,0.45)'; ctx.fillRect(0, 280, 600, 380); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(300, 400, 20, 300, 400, 520); gl.addColorStop(0, `rgba(255,60,180,${fl ? 0 : 0.10 + 0.05 * Math.sin(t * 9)})`); gl.addColorStop(1, 'rgba(255,60,180,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, 1080, 1200); ctx.restore();
      hud(t, T.one);
    } else if (t < SHOTS[2][1]) { // SHOT 3 — match cut (flash), push-in on Gus, micro-freeze on "owner"
      const lt = t - SHOTS[2][0]; const frz = t > T.owner && t < T.owner + 0.35;
      const z = frz ? 1.16 + (T.owner - SHOTS[2][0]) * 0.07 : 1.05 + lt * 0.07;
      const map = plate(img.s3, { x: 560, y: lerp(820, 700, eo(lt / 2)), z });
      // flies orbiting his head
      for (const f of flies) { const a = t * f.sp + f.p; const [hx, hy] = map(545, 300); fly(hx + Math.cos(a) * f.r * 1.3, hy - 40 + Math.sin(a) * f.r * 0.45, 1.6 + f.z, t, f.p); }
      motes(t, '255,200,130', 0.6);
      if (lt < 0.12) { ctx.fillStyle = `rgba(255,240,220,${1 - lt / 0.12})`; ctx.fillRect(0, 0, 1080, 1920); }
      if (frz) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, 0, 1080, 1920); }
      hud(t, -1); nameCard(t, T.gus);
    } else if (t < SHOTS[3][1]) { // SHOT 4 — hard cut, creeping push, swarm, green pulse, SLAM
      const lt = t - SHOTS[3][0]; const slam = t > T.slam;
      const z = slam ? 1.22 : 1.04 + lt * 0.05;
      plate(img.s4, { x: 520, y: 980, z });
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const p = slam ? 0 : 0.18 + 0.12 * Math.sin(t * 6); const g = ctx.createRadialGradient(470, 900, 40, 470, 900, 700); g.addColorStop(0, `rgba(80,255,60,${p})`); g.addColorStop(1, 'rgba(80,255,60,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
      if (!slam) for (const s of swarm) { const x = s.x + s.vx * lt + Math.sin(t * 5 + s.p) * 18, y = s.y + s.vy * lt + Math.cos(t * 4 + s.p) * 14; fly(x, y, 1.4 * s.s + 0.6, t, s.p); }
      if (slam) { const k = clamp((t - T.slam) / 0.5); ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.55 * k})`; ctx.fillRect(0, 0, 1080, 1920); if (t - T.slam < 0.07) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(0, 0, 1080, 1920); } }
      hud(t, -1);
      textPop('WE DON’T TALK', 540, 640, 92, T.talk, t, { stroke: 14 });
      textPop('ABOUT IT.', 540, 750, 92, T.bath2, t, { grad: ['#c8ff9a', '#3fd83a'], stroke: 14 });
    } else { // END TAG — the vote tease (style test card)
      const lt = t - SHOTS[3][1];
      plate(img.s1, { x: 560, y: 1050, z: 1.05 }); ctx.fillStyle = 'rgba(10,5,3,0.62)'; ctx.fillRect(0, 0, 1080, 1920);
      hud(t, -1);
      textPop('DAY 1 · YOU DECIDE', 540, 700, 74, SHOTS[3][1] + 0.05, t, { stroke: 12 });
      textPop('ROACHES', 540, 860, 130, SHOTS[3][1] + 0.3, t, { grad: ['#fff3a0', '#ffb81c'], stroke: 16 });
      textPop('or', 540, 975, 60, SHOTS[3][1] + 0.5, t, { stroke: 10 });
      textPop('TOILET', 540, 1090, 130, SHOTS[3][1] + 0.65, t, { grad: ['#c8ff9a', '#3fd83a'], stroke: 16 });
    }
    captions(t);
    grade(t);
    ctx.restore();
  }
  renderFrame(0);
  return { duration: DUR, renderFrame };
}
