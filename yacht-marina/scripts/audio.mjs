// Procedural sound design (no audio files needed): sea ambience, whooshes,
// pops when yachts dock, a yacht horn, a VIP shimmer and chimes.
// Music is NOT included on purpose: add a trending sound inside Instagram
// (it helps reach) and keep these effects underneath.

const SR = 48000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// one-pole low-pass helper
function lowpass(cut) {
  const a = Math.exp(-2 * Math.PI * cut / SR);
  let y = 0;
  return (x) => (y = (1 - a) * x + a * y);
}

// RBJ band-pass biquad with variable centre frequency
function bandpass() {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, f, q) => {
    const w = 2 * Math.PI * f / SR, al = Math.sin(w) / (2 * q), cw = Math.cos(w);
    const b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

function addSample(L, R, i, l, r) {
  if (i >= 0 && i < L.length) { L[i] += l; R[i] += r; }
}

const SOUNDS = {
  whoosh(L, R, start, { gain = 1 }, rand) {
    const n = Math.floor(0.7 * SR);
    const bpL = bandpass(), bpR = bandpass();
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const env = Math.sin(Math.PI * Math.pow(u, 0.7)) ** 2;
      const f = 300 + 2600 * Math.pow(u, 1.5);
      const nl = rand() * 2 - 1, nr = rand() * 2 - 1;
      addSample(L, R, start + i, bpL(nl, f, 0.9) * env * 0.55 * gain, bpR(nr, f * 1.05, 0.9) * env * 0.55 * gain);
    }
  },
  sting(L, R, start, { gain = 1 }) {
    // bright major chord, bell-like, plus a soft low thump
    const freqs = [523.25, 659.25, 783.99, 1046.5, 1174.66];
    const n = Math.floor(1.9 * SR);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let s = 0;
      freqs.forEach((f, k) => {
        const d = Math.max(0, t - k * 0.035);
        s += Math.sin(2 * Math.PI * f * d) * Math.exp(-d * (2.2 + k * 0.3)) * (d > 0 ? 1 : 0) * 0.12;
        s += Math.sin(2 * Math.PI * f * 2.01 * d) * Math.exp(-d * 5) * 0.03;
      });
      s += Math.sin(2 * Math.PI * 70 * t * (1 - t * 0.4)) * Math.exp(-t * 9) * 0.45;
      addSample(L, R, start + i, s * gain, s * gain);
    }
  },
  pop(L, R, start, { gain = 1, pitch = 1 }, rand) {
    const n = Math.floor(0.14 * SR);
    let ph = 0;
    const pan = (rand() - 0.5) * 0.6;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f = (520 + 900 * Math.exp(-t * 45)) * pitch;
      ph += 2 * Math.PI * f / SR;
      const env = Math.min(1, t * 900) * Math.exp(-t * 30);
      const s = Math.sin(ph) * env * 0.42 * gain;
      addSample(L, R, start + i, s * (1 - pan), s * (1 + pan));
    }
  },
  horn(L, R, start, { gain = 1 }) {
    // two-tone ship horn: sawtooth through a low-pass
    const n = Math.floor(1.25 * SR);
    const lpA = lowpass(700), lpB = lowpass(700);
    let pa = 0, pb = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      pa = (pa + 110 / SR) % 1; pb = (pb + 164.8 / SR) % 1;
      const env = Math.min(1, t / 0.06) * (t > 0.95 ? Math.max(0, 1 - (t - 0.95) / 0.3) : 1);
      const vib = 1 + 0.003 * Math.sin(2 * Math.PI * 5 * t);
      const s = (lpA((pa * 2 - 1) * vib) + lpB(pb * 2 - 1)) * env * 0.42 * gain;
      addSample(L, R, start + i, s, s);
    }
  },
  shimmer(L, R, start, { gain = 1 }) {
    const notes = [1318.5, 1661.2, 1975.5, 2637, 3322.4, 3951];
    const n = Math.floor(2.4 * SR);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let l = 0, r = 0;
      notes.forEach((f, k) => {
        const d = t - k * 0.07;
        if (d <= 0) return;
        const s = Math.sin(2 * Math.PI * f * d) * Math.exp(-d * 2.4) * 0.07;
        if (k % 2) l += s; else r += s;
        l += s * 0.4; r += s * 0.4;
      });
      addSample(L, R, start + i, l * gain, r * gain);
    }
  },
  chime(L, R, start, { gain = 1 }) {
    const n = Math.floor(1.4 * SR);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const s = (Math.sin(2 * Math.PI * 1567.98 * t) * 0.16 + Math.sin(2 * Math.PI * 1567.98 * 2.76 * t) * 0.05 + Math.sin(2 * Math.PI * 2093 * t) * 0.08 * (t > 0.09 ? 1 : 0)) * Math.exp(-t * 3.5);
      addSample(L, R, start + i, s * gain, s * gain);
    }
  },
};

/** Render the episode soundtrack. events: [{t, type, gain?, pitch?, dense?}] */
export function renderAudio(events, duration) {
  const N = Math.ceil((duration + 0.5) * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  const rand = mulberry32(12345);

  // Sea ambience: filtered noise with slow swells + occasional wave wash
  const lpL = lowpass(380), lpR = lowpass(420), hpL = lowpass(40), hpR = lowpass(40);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const swell = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.11 * t) * Math.sin(2 * Math.PI * 0.047 * t + 1);
    const nl = lpL(rand() * 2 - 1), nr = lpR(rand() * 2 - 1);
    L[i] += (nl - hpL(nl)) * 0.55 * swell;
    R[i] += (nr - hpR(nr)) * 0.55 * swell;
  }
  // Limit dense pop streams (hundreds of yachts docking) to ~14 pops per second
  let lastDense = -1;
  for (const e of events) {
    if (e.dense) { if (e.t - lastDense < 0.07) continue; lastDense = e.t; }
    const fn = SOUNDS[e.type];
    if (fn) fn(L, R, Math.floor(e.t * SR), e, rand);
  }
  // Light stereo "room": two short feedback delays
  const d1 = Math.floor(0.043 * SR), d2 = Math.floor(0.067 * SR);
  for (let i = Math.max(d1, d2); i < N; i++) {
    L[i] += R[i - d1] * 0.18 + L[i - d2] * 0.1;
    R[i] += L[i - d2] * 0.18 + R[i - d1] * 0.1;
  }
  // Soft limiter + fades
  const out = Buffer.alloc(44 + N * 4);
  out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8);
  out.write('fmt ', 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
  out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
  out.write('data', 36); out.writeUInt32LE(N * 4, 40);
  const fade = Math.floor(0.25 * SR);
  for (let i = 0; i < N; i++) {
    const f = Math.min(1, i / fade, (N - 1 - i) / fade);
    const l = Math.tanh(L[i] * 0.9) * 0.89 * f, r = Math.tanh(R[i] * 0.9) * 0.89 * f;
    out.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    out.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  }
  return out;
}
