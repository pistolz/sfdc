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

  // tension drone, ducked under the voice
  const lp = lowpass(140);
  let env = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const vAmp = Math.abs(VL[i]) + Math.abs(VR[i]);
    env = Math.max(vAmp, env * 0.9995);
    const duck = 1 - Math.min(0.6, env * 2);
    const drone = (Math.sin(2 * Math.PI * 55 * t) * 0.5 + Math.sin(2 * Math.PI * 82.4 * t) * 0.3 + lp(rand() * 2 - 1) * 2) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.12 * t));
    const d = bed === 'none' ? 0 : drone * 0.06 * duck * Math.min(1, t / 1.5);
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
