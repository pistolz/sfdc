// GUS (reference illustration) — the final art is the illustration; code makes it ALIVE:
// WebGL warp regions (head tilt, breathing belly, cigar bob, stink-line waves, fly jitter, toe wiggle,
// bell squash, brow raise) + 2D overlays (blinks, smoke, walking roach, HUD, captions, stamp),
// camera moves timed to the VO words.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const eo = (k) => 1 - Math.pow(1 - clamp(k), 3);
const eio = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const back = (k) => { k = clamp(k); const s = 1.7; return 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2); };
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const INK = '#1d1712', CREAM = '#f3ead2';

const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; v.y = 1.0 - v.y; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision highp float; varying vec2 v; uniform sampler2D img; uniform vec3 cam; uniform int n;
uniform vec4 A[16]; uniform vec4 B[16];
// A: pivot.x pivot.y radius type ; B: params  (types: 1 rotate(angle) 2 scale(sx,sy) 3 translate(dx,dy) 4 waveX(amp,freqY,phase))
vec2 warp(vec2 q){ vec2 s = q;
  for (int i = 0; i < 16; i++) { if (i >= n) break; vec2 c = A[i].xy; float r = A[i].z; float ty = A[i].w;
    float d = length(q - c); float w = 1.0 - smoothstep(r * 0.55, r, d);
    if (w <= 0.0) continue; vec2 o = q - c; vec2 src = q;
    if (ty < 1.5) { float a = -B[i].x * w; src = c + mat2(cos(a), sin(a), -sin(a), cos(a)) * o; }
    else if (ty < 2.5) { src = c + o / mix(vec2(1.0), B[i].xy, w); }
    else if (ty < 3.5) { src = q - B[i].xy * w; }
    else { src = q - vec2(sin(q.y * B[i].y + B[i].z) * B[i].x * w, 0.0); }
    s += src - q; }
  return s; }
void main(){ vec2 px = vec2(v.x * 1080.0, v.y * 1920.0); vec2 q = cam.xy + (px - vec2(540.0, 960.0)) / cam.z;
  vec2 s = warp(q); vec2 uv = s / vec2(1080.0, 1920.0);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { gl_FragColor = vec4(0.30,0.40,0.58,1.0); return; }
  gl_FragColor = texture2D(img, uv); }`;

export const VO = { g1: 0.3, g2: 3.35, g3: 5.75, g4: 8.45 };
const SH = [0, 3.2, 5.6, 8.3, 11.8];

export async function create(stage) {
  const gc = document.createElement('canvas'); gc.width = 1080; gc.height = 1920; stage.appendChild(gc);
  const oc = document.createElement('canvas'); oc.width = 1080; oc.height = 1920; stage.appendChild(oc);
  const ctx = oc.getContext('2d');
  const gl = gc.getContext('webgl', { preserveDrawingBuffer: true, antialias: true });
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const lp = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
  const U = (nm) => gl.getUniformLocation(pr, nm);
  async function tex(src) { const im = await load(src); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  const TX = { wide: await tex('/assets/gusref/wide.png'), face: await tex('/assets/gusref/face.png') };
  const W = {}; for (const k of Object.keys(VO)) W[k] = (await (await fetch(`/assets/hotel/vo/${k}.json`)).json()).map((w) => ({ ...w, t: w.t + VO[k], e: w.e + VO[k], w: w.w.replace(/[.?!,]+$/, '') }));
  const word = (k, w) => W[k].find((x) => x.w.toLowerCase().startsWith(w)).t;

  function draw(which, cam, regions) {
    gl.bindTexture(gl.TEXTURE_2D, TX[which]); gl.uniform3f(U('cam'), cam[0], cam[1], cam[2]);
    const A = new Float32Array(64), B = new Float32Array(64); regions.slice(0, 16).forEach((r, i) => { A.set(r[0], i * 4); B.set(r[1], i * 4); });
    gl.uniform1i(U('n'), Math.min(16, regions.length)); gl.uniform4fv(U('A'), A); gl.uniform4fv(U('B'), B);
    gl.viewport(0, 0, 1080, 1920); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  // ---- rigs (image px). type: 1 rot(angle), 2 scale(sx,sy), 3 move(dx,dy), 4 wave(amp,freq,phase)
  function rigWide(t, o = {}) {
    const br = Math.sin(t * 2.3), fj = (s) => [Math.sin(t * 31 + s) * 6, Math.cos(t * 27 + s) * 5];
    return [
      [[565, 540, 270, 1], [Math.sin(t * 1.1) * 0.035 + (o.nod || 0), 0, 0, 0]],                  // head tilt around neck
      [[575, 880, 260, 2], [1 + br * 0.018, 1 + br * 0.028, 0, 0]],                                 // breathing belly
      [[612, 448, 120, 1], [Math.sin(t * 3.2) * 0.09, 0, 0, 0]],                                    // cigar bob (pivot = mouth)
      [[320, 280, 110, 4], [7, 0.045, t * 4, 0]], [[740, 300, 110, 4], [7, 0.05, t * 4 + 2, 0]], [[570, 60, 90, 4], [6, 0.06, t * 4 + 4, 0]], // stink
      [[380, 92, 55, 3], fj(1)], [[722, 126, 55, 3], fj(2)], [[304, 220, 55, 3], fj(3)],             // flies jitter
      [[700, 1040, 70, 2], [1 + (o.ding || 0) * 0.12, 1 - (o.ding || 0) * 0.16, 0, 0]],            // bell squash
      [[862, 1092, 60, 4], [4 * (o.roach ?? 1), 0.4, t * 30, 0]],                                    // roach legs twitch
      [[380, 1835, 120, 4], [(o.toe || 0) * 6, 0.12, t * 14, 0]], [[712, 1835, 120, 4], [(o.toe || 0) * 6, 0.12, t * 14 + 1, 0]], // toes
      [[1030, 590, 90, 2], [1, 1 + Math.sin(t * 7) * 0.006, 0, 0]],
    ];
  }
  function rigFace(t, o = {}) {
    const fj = (s) => [Math.sin(t * 31 + s) * 8, Math.cos(t * 27 + s) * 7];
    return [
      [[540, 1500, 1100, 1], [Math.sin(t * 1.0) * 0.02, 0, 0, 0]],                                  // whole head sway
      [[690, 1120, 230, 1], [Math.sin(t * 3.0) * 0.08, 0, 0, 0]],                                   // cigar
      [[600, 560, 300, 3], [0, -(o.brow || 0) * 22]],                                                // brow raise
      [[150, 130, 70, 3], fj(1)], [[1030, 1060, 70, 3], fj(2)],
      [[300, 150, 120, 4], [8, 0.035, t * 4, 0]], [[940, 260, 140, 4], [9, 0.03, t * 4 + 2, 0]], [[1010, 400, 120, 4], [7, 0.04, t * 4 + 3, 0]],
      [[560, 1350, 380, 2], [1 + Math.sin(t * 2.3) * 0.01, 1 + Math.sin(t * 2.3) * 0.014, 0, 0]],   // chin/breath
    ];
  }
  // ---- 2D overlay helpers (drawn in image px under the same camera)
  function camT(cam) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(540, 960); ctx.scale(cam[2], cam[2]); ctx.translate(-cam[0], -cam[1]); }
  function lid(x, y, rx, ry, k, skin) { // eyelid closing over an eye: k 0..1
    if (k <= 0) return; ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = skin; ctx.fillRect(x - rx - 2, y - ry - 2, rx * 2 + 4, (ry * 2 + 4) * k);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(4, rx * 0.12); ctx.beginPath(); ctx.moveTo(x - rx, y - ry + ry * 2 * k); ctx.quadraticCurveTo(x, y - ry + ry * 2 * k + ry * 0.25, x + rx, y - ry + ry * 2 * k); ctx.stroke(); ctx.restore();
  }
  function smoke(x, y, t, s = 1) { ctx.save(); ctx.lineCap = 'round'; for (let k = 0; k < 3; k++) { const u = ((t * 0.5 + k / 3) % 1); ctx.globalAlpha = Math.sin(Math.PI * u) * 0.55; ctx.strokeStyle = '#d9d4c8'; ctx.lineWidth = 7 * s; ctx.beginPath(); for (let i = 0; i <= 10; i++) { const yy = y - u * 160 * s - i * 9 * s; const xx = x + Math.sin(i * 0.7 + t * 3 + k) * 10 * s + u * 20 * s; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); } ctx.restore(); }
  function roach(x, y, s, t, dir = 1) { ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s); ctx.lineCap = 'round'; ctx.strokeStyle = INK;
    for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) { const ph = Math.sin(t * 30 + i * 2 + (sd > 0 ? 3 : 0)) * 6; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12 + i * 12, sd * 4); ctx.lineTo(-16 + i * 12 + ph, sd * 16); ctx.lineTo(-22 + i * 12 + ph, sd * 21); ctx.stroke(); }
    ctx.fillStyle = '#6b3d22'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 26, 13, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#4a2a18'; ctx.beginPath(); ctx.ellipse(22, 0, 9, 9, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2.5; const a = Math.sin(t * 9) * 4; ctx.beginPath(); ctx.moveTo(28, -4); ctx.quadraticCurveTo(44, -14 + a, 58, -10 + a); ctx.moveTo(28, 4); ctx.quadraticCurveTo(46, 10 - a, 60, 6 - a); ctx.stroke(); ctx.restore(); }
  function hud() { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    ctx.font = '900 34px Nunito'; ctx.lineWidth = 8; ctx.fillStyle = CREAM; ctx.strokeText('DAY', 100, 300); ctx.fillText('DAY', 100, 300);
    ctx.font = '900 120px Nunito'; const g = ctx.createLinearGradient(0, 300, 0, 410); g.addColorStop(0, '#ffe08a'); g.addColorStop(1, '#d39a2c'); ctx.lineWidth = 14; ctx.strokeText('01', 92, 410); ctx.fillStyle = g; ctx.fillText('01', 92, 410);
    ctx.font = '900 132px Nunito'; ctx.textAlign = 'right'; ctx.strokeText('30', 800, 400); ctx.fillStyle = CREAM; ctx.fillText('30', 800, 400);
    ctx.textAlign = 'left'; ctx.font = '900 36px Nunito'; ctx.lineWidth = 7; for (const [s, yy] of [['DAYS', 335], ['LEFT', 375]]) { ctx.strokeText(s, 815, yy); ctx.fillText(s, 815, yy); } ctx.restore(); }
  function caption(txt, t0, t) { const k = t - t0; if (k < 0) return; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.save(); ctx.translate(540, 1340); const s = back(k / 0.22); ctx.scale(s, s);
    ctx.font = '900 72px Nunito'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowOffsetY = 7; ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.strokeText(txt, 0, 0); ctx.shadowColor = 'transparent'; ctx.fillStyle = CREAM; ctx.fillText(txt, 0, 0); ctx.restore(); }

  function renderFrame(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 1080, 1920);
    const blinkK = (period, off) => { const u = (t + off) % period; return u < 0.16 ? Math.sin(Math.PI * u / 0.16) : 0; };
    let cam;
    if (t < SH[1]) { // A: ECU bell + roach → pull out to wide
      const k = eio((t - 0.15) / 1.2); cam = [lerp(760, 540, k), lerp(1060, 960, k), lerp(1.9, 1.0, k) + t * 0.008];
      const shake = t < 0.2 ? (1 - t / 0.2) * 6 : 0; cam[0] += Math.sin(t * 90) * shake;
      draw('wide', cam, rigWide(t, { ding: t < 0.25 ? Math.sin(Math.PI * t / 0.25) : 0 }));
      camT(cam); lid(524, 322, 30, 20, blinkK(3.6, 0.3), '#de8a60'); lid(636, 322, 30, 20, blinkK(3.6, 0.3), '#de8a60'); smoke(742, 436, t, 0.7);
    } else if (t < SH[2]) { // B: face close-up (second illustration), brow raise + slow blink on "owner"
      const lt = t - SH[1]; const ow = word('g2', 'owner'); cam = [540, 980, 1.0 + lt * 0.035];
      const brow = t > ow ? eo((t - ow) / 0.2) * (1 - clamp((t - ow - 0.7) / 0.3)) : 0;
      draw('face', cam, rigFace(t, { brow }));
      camT(cam); const bl = Math.max(blinkK(2.9, 0.4), t > ow + 0.35 && t < ow + 0.75 ? 0.55 : 0);
      lid(430, 712, 72, 50, bl, '#e48c62'); lid(770, 722, 72, 50, bl, '#e38d64'); smoke(885, 1190, t, 1.3);
    } else if (t < SH[3]) { // C: feet close-up, toes wiggle on "socks", roach scurries by
      const lt = t - SH[2]; cam = [545, 1360 - lt * 4, 1.72 + lt * 0.02];
      const toe = t > word('g3', 'socks') ? 1 : 0.2;
      draw('wide', cam, rigWide(t, { toe }));
      camT(cam); roach(lerp(880, 180, clamp((lt - 0.5) / 1.5)), 1880, 0.8, t, -1);
    } else { // D: medium on Gus, slow push, nod on "nineteen", 2019 stamp
      const lt = t - SH[3]; cam = [560, 640, 1.45 + lt * 0.03];
      const nod = t > word('g4', 'nineteen') ? Math.sin(clamp((t - word('g4', 'nineteen')) / 0.5) * Math.PI) * 0.05 : 0;
      draw('wide', cam, rigWide(t, { nod }));
      camT(cam); lid(524, 322, 30, 20, blinkK(3.1, 1.1), '#de8a60'); lid(636, 322, 30, 20, blinkK(3.1, 1.1), '#de8a60'); smoke(742, 436, t, 0.7);
    }
    hud();
    const all = Object.values(W); for (const ln of all) { const cur = ln.filter((w) => t >= w.t - 0.03 && t < w.e + 0.25); if (!cur.length) continue; const w = cur[cur.length - 1]; const i = ln.indexOf(w); const g0 = Math.floor(i / 3) * 3; caption(ln.slice(g0, i + 1).map((x) => x.w).join(' '), ln[g0].t - 0.03, t); }
    const nt = word('g4', 'twenty'); if (t > nt) { const k = t - nt; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.save(); ctx.translate(760, 1050); ctx.rotate(-0.15); const s = back(k / 0.25); ctx.scale(s, s);
      ctx.font = '900 130px Nunito'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.strokeText('2019', 0, 0); ctx.fillStyle = '#9fd36a'; ctx.fillText('2019', 0, 0); ctx.restore(); }
  }
  renderFrame(0);
  return { duration: SH[4], renderFrame };
}
