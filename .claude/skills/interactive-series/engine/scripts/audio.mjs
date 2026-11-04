// Soundtrack: voice-over clips + procedural sound effects + a low tension drone.
// (Add trending music in Instagram on top if you want.)
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const SR = 48000;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function lowpass(cut) { const a = Math.exp(-2 * Math.PI * cut / SR); let y = 0; return (x) => (y = (1 - a) * x + a * y); }
function bandpass() {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, f, q) => {
    const w = 2 * Math.PI * f / SR, al = Math.sin(w) / (2 * q), cw = Math.cos(w);
    const y = (al * x - al * x2 + 2 * cw * y1 - (1 - al) * y2) / (1 + al);
    x2 = x1; x1 = x; y2 = y1; y1 = y; return y;
  };
}
const add = (L, R, i, l, r = l) => { if (i >= 0 && i < L.length) { L[i] += l; R[i] += r; } };

const SFX = {
  // ---- fighter kit
  rumble(L, R, s, rand, e) { // power-up: low rumble + rising noise, e.dur seconds
    const dur = e?.dur ?? 2.5, n = dur * SR, lp = lowpass(180), bp = bandpass();
    for (let i = 0; i < n; i++) { const u = i / n, t = i / SR, env = Math.min(1, u * 4) * Math.min(1, (1 - u) * 8);
      const v = lp(rand() * 2 - 1) * 2.2 * (0.4 + 0.6 * u) + Math.sin(2 * Math.PI * (38 + 20 * u) * t) * 0.35 + bp(rand() * 2 - 1, 300 + 2600 * u * u, 2) * 0.12 * u;
      add(L, R, s + i, v * env * 0.5); }
  },
  boom(L, R, s, rand) { // big impact / transformation burst
    const lp = lowpass(900);
    for (let i = 0; i < 1.8 * SR; i++) { const t = i / SR; const v = Math.sin(2 * Math.PI * (40 + 90 * Math.exp(-t * 9)) * t) * Math.exp(-t * 2.6) * 0.8 + lp(rand() * 2 - 1) * Math.exp(-t * 3.5) * 0.7 + (rand() * 2 - 1) * Math.exp(-t * 30) * 0.3; add(L, R, s + i, v); }
  },
  charge(L, R, s, rand, e) { // energy gathering: rising whine + crackle
    const dur = e?.dur ?? 1.2;
    for (let i = 0; i < dur * SR; i++) { const t = i / SR, u = t / dur, f = 220 + 1400 * u * u; const v = (Math.sin(2 * Math.PI * f * t) * 0.10 + Math.sin(2 * Math.PI * f * 1.5 * t) * 0.05) * u + (rand() < 0.004 ? (rand() * 2 - 1) * 0.5 : 0); add(L, R, s + i, v, v * 0.9); }
  },
  blast(L, R, s, rand) { // beam fired: roaring noise
    const lp = lowpass(1400), bp = bandpass();
    for (let i = 0; i < 2.2 * SR; i++) { const t = i / SR, env = Math.min(1, t * 30) * Math.exp(-t * 1.3); const v = lp(rand() * 2 - 1) * 1.4 + bp(rand() * 2 - 1, 700, 0.8) * 0.6 + Math.sin(2 * Math.PI * 55 * t) * 0.4; add(L, R, s + i, v * env * 0.55); }
  },
  whoosh(L, R, s, rand) {
    const n = 0.5 * SR, bp = bandpass(), bp2 = bandpass();
    for (let i = 0; i < n; i++) { const u = i / n, env = Math.sin(Math.PI * Math.pow(u, 0.6)) ** 2, f = 400 + 3000 * u; add(L, R, s + i, bp(rand() * 2 - 1, f, 1) * env * 0.35, bp2(rand() * 2 - 1, f * 1.1, 1) * env * 0.35); }
  },
  hit(L, R, s, rand) {
    for (let i = 0; i < 0.9 * SR; i++) { const t = i / SR; const v = Math.sin(2 * Math.PI * (55 + 60 * Math.exp(-t * 18)) * t) * Math.exp(-t * 5) * 0.7 + (rand() * 2 - 1) * Math.exp(-t * 40) * 0.25; add(L, R, s + i, v); }
  },
  thud(L, R, s, rand) {
    for (let i = 0; i < 0.5 * SR; i++) { const t = i / SR; const v = Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 12) * 0.7 + (rand() * 2 - 1) * Math.exp(-t * 60) * 0.4; add(L, R, s + i, v); }
  },
  cash(L, R, s, rand) {
    // "ka-ching": click + two bright bells
    for (let i = 0; i < 1.0 * SR; i++) {
      const t = i / SR;
      let v = (rand() * 2 - 1) * Math.exp(-t * 90) * 0.4;
      const t2 = t - 0.08;
      if (t2 > 0) v += (Math.sin(2 * Math.PI * 2093 * t2) * 0.18 + Math.sin(2 * Math.PI * 2637 * t2) * 0.14 + Math.sin(2 * Math.PI * 4186 * t2) * 0.05) * Math.exp(-t2 * 5);
      add(L, R, s + i, v);
    }
  },
  build(L, R, s) {
    for (let i = 0; i < 0.35 * SR; i++) { const t = i / SR; const f = 300 + 700 * t / 0.35; add(L, R, s + i, Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 6) * 0.18); }
  },
  alarm(L, R, s) {
    for (let i = 0; i < 1.6 * SR; i++) { const t = i / SR; const f = (Math.floor(t * 4) % 2) ? 880 : 660; const sq = Math.sign(Math.sin(2 * Math.PI * f * t)); add(L, R, s + i, sq * 0.07 * Math.min(1, (1.6 - t) * 4)); }
  },
  glitch(L, R, s, rand) {
    for (let k = 0; k < 6; k++) {
      const st = s + Math.floor(rand() * 0.6 * SR), n = Math.floor((0.03 + rand() * 0.07) * SR), f = 200 + rand() * 1800;
      for (let i = 0; i < n; i++) { const v = Math.sign(Math.sin(2 * Math.PI * f * i / SR)) * 0.08 + (rand() * 2 - 1) * 0.06; add(L, R, st + i, v, -v); }
    }
  },
  beep(L, R, s) {
    for (let b = 0; b < 3; b++) for (let i = 0; i < 0.1 * SR; i++) add(L, R, s + b * 0.25 * SR + i, Math.sin(2 * Math.PI * 1200 * i / SR) * 0.15);
  },
  keys(L, R, s, rand, e) {
    // keyboard typing: short filtered clicks for e.dur seconds
    const dur = e?.dur ?? 1.0; let t = 0;
    while (t < dur) {
      const st = s + Math.floor(t * SR), n = Math.floor(0.018 * SR), f = 1800 + rand() * 1500, g = 0.10 + rand() * 0.06;
      for (let i = 0; i < n; i++) { const env = Math.exp(-i / (0.004 * SR)); add(L, R, st + i, (rand() * 2 - 1) * env * g + Math.sin(2 * Math.PI * f * i / SR) * env * g * 0.4); }
      t += 0.055 + rand() * 0.06;
    }
  },
  softpop(L, R, s) {
    for (let i = 0; i < 0.12 * SR; i++) { const t = i / SR; const f = 700 * Math.exp(-t * 18) + 260; add(L, R, s + i, Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 32) * 0.22); }
  },
  swish(L, R, s, rand) {
    const n = 0.28 * SR, bp = bandpass();
    for (let i = 0; i < n; i++) { const u = i / n, env = Math.sin(Math.PI * u) ** 2; add(L, R, s + i, bp(rand() * 2 - 1, 1200 + 2500 * u, 1.2) * env * 0.12); }
  },
  heartbeat(L, R, s) {
    for (let b = 0; b < 4; b++) for (const off of [0, 0.22]) {
      const st = s + Math.floor((b * 0.9 + off) * SR);
      for (let i = 0; i < 0.25 * SR; i++) { const t = i / SR; add(L, R, st + i, Math.sin(2 * Math.PI * 50 * t) * Math.exp(-t * 18) * (off ? 0.45 : 0.6)); }
    }
  },
};

// ------------------------------------------------------------------ original music bed (made in code)
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const PROGS = {
  tech: { root: 57, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]] },      // Am F C G
  warm: { root: 60, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]] },     // C Am F G
  tense: { root: 52, chords: [[0, 3, 7], [0, 3, 7], [-4, -1, 3], [-2, 1, 5]] },
  epic: { root: 50, chords: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]] },
};
export function musicBed(N, { style = 'tech', bpm = 104, gain = 1 } = {}, rand) {
  const L = new Float32Array(N), R = new Float32Array(N);
  const prog = PROGS[style] || PROGS.tech;
  const beat = 60 / bpm, bar = beat * 4;
  const lp = lowpass(2400), lp2 = lowpass(900);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const ci = Math.floor(t / bar) % prog.chords.length, ch = prog.chords[ci];
    const tb = t % beat, t8 = t % (beat / 2), tBar = t % bar;
    let pad = 0;
    for (const n of ch) { const f = NOTE(prog.root + n); pad += Math.sin(2 * Math.PI * f * t) * 0.05 + Math.sin(2 * Math.PI * f * 2.003 * t) * 0.015; }
    pad *= 0.7 + 0.3 * Math.sin(2 * Math.PI * t / bar);
    // plucked arpeggio on eighths
    const step = Math.floor(t / (beat / 2)) % 8, an = ch[step % 3] + (step >= 4 ? 12 : 0);
    const pf = NOTE(prog.root + 12 + an);
    const pluck = (Math.sin(2 * Math.PI * pf * t8) + 0.3 * Math.sin(4 * Math.PI * pf * t8)) * Math.exp(-t8 * 9) * 0.08;
    // bass on beats 1 and 3
    const bt = tBar % (beat * 2), bass = Math.sin(2 * Math.PI * NOTE(prog.root - 12 + ch[0]) * bt) * Math.exp(-bt * 2.2) * 0.14;
    // soft kick + hats (not for 'warm')
    let drum = 0;
    if (style !== 'warm') {
      drum += Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-tb * 30)) * tb) * Math.exp(-tb * 12) * 0.22;
      drum += lp2(rand() * 2 - 1) * 0 + (rand() * 2 - 1) * Math.exp(-t8 * 60) * 0.03 * (Math.floor(t / (beat / 2)) % 2 ? 1 : 0.5);
    }
    const intro = Math.min(1, t / 1.2);
    const v = lp(pad + pluck + bass + drum) * gain * intro;
    L[i] = v * (1 + 0.15 * Math.sin(t * 0.7)); R[i] = v * (1 - 0.15 * Math.sin(t * 0.7));
  }
  return [L, R];
}

function decode(file) {
  const r = spawnSync(ffmpegPath, ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`Cannot decode ${file}: ${r.stderr}`);
  const buf = r.stdout;
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

/** voice: [{t, file}] (absolute paths), sfx: [{t, type}] */
export function renderAudio({ voice = [], sfx = [], duration, bed = 'drone' }) {
  const N = Math.ceil((duration + 0.5) * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  const VL = new Float32Array(N), VR = new Float32Array(N);
  const rand = rng(7);

  for (const v of voice) {
    const pcm = decode(v.file);
    const s = Math.floor(v.t * SR);
    for (let i = 0; i < pcm.length / 2; i++) { const j = s + i; if (j >= 0 && j < N) { VL[j] += pcm[2 * i]; VR[j] += pcm[2 * i + 1]; } }
  }
  for (const e of sfx) { const f = SFX[e.type]; if (f) f(L, R, Math.floor(e.t * SR), rand, e); }

  // music bed (object = original track) ducked under the voice
  const music = bed && typeof bed === 'object' ? musicBed(N, bed, rand) : null;
  // tension drone, ducked under the voice
  const lp = lowpass(140);
  let env = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const vAmp = Math.abs(VL[i]) + Math.abs(VR[i]);
    env = Math.max(vAmp, env * 0.9995);
    const duck = 1 - Math.min(0.6, env * 2);
    const drone = (Math.sin(2 * Math.PI * 55 * t) * 0.5 + Math.sin(2 * Math.PI * 82.4 * t) * 0.3 + lp(rand() * 2 - 1) * 2) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.12 * t));
    const d = (bed === 'none' || music) ? 0 : drone * 0.06 * duck * Math.min(1, t / 1.5);
    if (music) { const md = 1 - Math.min(0.55, env * 2.2); L[i] += music[0][i] * md; R[i] += music[1][i] * md; }
    L[i] = L[i] * 0.8 * duck + d + VL[i] * 1.0;
    R[i] = R[i] * 0.8 * duck + d + VR[i] * 1.0;
  }

  const out = Buffer.alloc(44 + N * 4);
  out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28);
  out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    out.writeInt16LE(Math.round(Math.tanh(L[i]) * 0.95 * 32767), 44 + i * 4);
    out.writeInt16LE(Math.round(Math.tanh(R[i]) * 0.95 * 32767), 46 + i * 4);
  }
  return out;
}
