#!/usr/bin/env python3
"""Sound design + music + VO mix for the Worst Hotel Day 1 animatic.
Cues are placed on the same word timestamps as web/src/hotel.js. Output: out/hotel-mix.wav (48 kHz stereo)."""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = os.path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg')
SR = 48000; DUR = 11.8; N = int(SR * DUR)
VO = {'g1': 0.3, 'g2': 3.35, 'g3': 5.75, 'g4': 8.45}
SHOT2, SHOT3, SHOT4, END = 3.2, 5.6, 8.3, 11.8
rng = np.random.default_rng(3)
L = np.zeros(N); R = np.zeros(N)

def words(k):
    w = json.load(open(os.path.join(ROOT, f'web/assets/hotel/vo/{k}.json')))
    for x in w: x['t'] += VO[k]; x['e'] += VO[k]; x['w'] = x['w'].strip('.').lower()
    return w
W = {k: words(k) for k in VO}
def at(k, word, n=0): return [x for x in W[k] if x['w'].strip("'?").startswith(word)][n]['t']
SLAM = 99

def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR); sig = np.asarray(sig)[: max(0, N - i)]
    if i < 0 or len(sig) == 0: return
    L[i:i + len(sig)] += sig * gain * (1 - max(0, pan)); R[i:i + len(sig)] += sig * gain * (1 + min(0, pan))
def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, cut):
    a = np.exp(-2 * np.pi * cut / SR); y = np.zeros_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a) * x[i] + a * s; y[i] = s
    return y
def hp(x, cut): return x - lp(x, cut)
def noise(d): return rng.uniform(-1, 1, int(d * SR))

# ---------- SFX (modern, crisp)
def bell():  # brass desk bell: inharmonic partials, long shimmer
    t = tt(2.2); f = 2280
    s = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * dcy) for m, a, dcy in [(1, .5, 2.2), (2.76, .25, 3.5), (5.4, .12, 6), (8.9, .06, 9)])
    s += noise(2.2) * np.exp(-t * 300) * .4
    return s
def whoosh(d=0.45, f0=300, f1=4000):
    t = tt(d); n = noise(d); env = np.sin(np.pi * (t / d) ** 0.7) ** 2
    out = np.zeros_like(n); st = 0; seg = 400
    for i in range(0, len(n), seg):
        u = i / len(n); c = f0 + (f1 - f0) * u
        out[i:i + seg] = hp(lp(n[i:i + seg], c * 1.4), c * 0.5)
    return out * env * 1.6
def neon(d):  # 60 Hz hum + harmonics + crackles
    t = tt(d); s = sum(np.sin(2 * np.pi * 60 * h * t) / h for h in (1, 2, 3, 5)) * 0.05
    c = (rng.random(len(t)) < 0.0015) * rng.uniform(-1, 1, len(t)); s += lp(c, 3000) * 2
    return s
def zap():
    t = tt(0.12); return (np.sign(np.sin(2 * np.pi * 120 * t)) * 0.3 + noise(0.12) * 0.5) * np.exp(-t * 30)
def flybuzz(d, f=210):
    t = tt(d); vib = 1 + 0.06 * np.sin(2 * np.pi * 7 * t) + 0.03 * np.sin(2 * np.pi * 3.1 * t)
    ph = 2 * np.cumsum(f * vib) / SR; saw = 2 * (ph % 1) - 1
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 0.8 * t)
    return lp(saw, 1800) * am * 0.25
def pop(f=900):
    t = tt(0.09); return np.sin(2 * np.pi * (f + 900 * t / 0.09) * t) * np.exp(-t * 45) * 0.5
def sub(d=1.2):
    t = tt(d); f = 80 * np.exp(-t * 1.4) + 30; return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.8)
def riser(d=0.9):
    t = tt(d); f = 200 + 1800 * (t / d) ** 2; s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.15 + hp(noise(d), 2000) * 0.2
    return s * (t / d) ** 2
def slam():
    t = tt(1.4); thump = np.sin(2 * np.pi * (55 + 90 * np.exp(-t * 25)) * t) * np.exp(-t * 7)
    crack = lp(noise(1.4), 2500) * np.exp(-t * 22); tail = lp(noise(1.4), 900) * np.exp(-t * 3.5) * 0.25
    return thump * 1.1 + crack * 0.9 + tail
def cigar_plip():
    t = tt(0.15); return np.sin(2 * np.pi * (500 - 1500 * t) * t) * np.exp(-t * 35) * 0.4
def shutter():
    t = tt(0.2); return lp(noise(0.2), 4000) * (np.exp(-t * 80) + 0.6 * np.exp(-((t - 0.06) * 80) ** 2)) * 0.6

# ---------- music: funky lo-fi groove, 96 BPM (bass + Rhodes-ish chords + soft kit), ducked
def music():
    bpm = 96; beat = 60 / bpm; t = np.arange(N) / SR; m = np.zeros(N)
    note = lambda n: 440 * 2 ** ((n - 69) / 12)
    chords = [[57, 60, 64, 67], [55, 59, 62, 65], [53, 57, 60, 64], [52, 55, 59, 62]]  # Am7 G7 Fmaj7 Em7
    bar = beat * 4
    for i in range(0, N, SR // 100):
        pass
    ci = (t // bar).astype(int) % 4
    for k in range(4):
        sel = ci == k
        for n in chords[k]:
            tb = t % (beat * 2)
            m[sel] += (np.sin(2 * np.pi * note(n) * t[sel]) * (0.5 + 0.5 * np.sin(2 * np.pi * 4.5 * t[sel])) * np.exp(-tb[sel] * 1.2)) * 0.025
    # bass: syncopated
    bass_pat = [0, 0.75, 1.5, 2.5, 3.25]
    for b in range(int(DUR / bar) + 1):
        root = [45, 43, 41, 40][b % 4]
        for off in bass_pat:
            st = b * bar + off * beat
            if st >= DUR: continue
            tl = tt(0.35); s = (np.sin(2 * np.pi * note(root) * tl) + 0.3 * np.sin(4 * np.pi * note(root) * tl)) * np.exp(-tl * 6) * 0.22
            i = int(st * SR); m[i:i + len(s)] += s[: N - i]
    # kit
    for b in np.arange(0, DUR, beat):
        i = int(b * SR); n_ = int(round(b / beat)) % 4
        kt = tt(0.3); k = np.sin(2 * np.pi * (50 + 90 * np.exp(-kt * 35)) * kt) * np.exp(-kt * 10) * 0.35
        if n_ in (0, 2): m[i:i + len(k)] += k[: N - i]
        if n_ in (1, 3): sn = hp(noise(0.2), 1500) * np.exp(-tt(0.2) * 22) * 0.18; m[i:i + len(sn)] += sn[: N - i]
        for h in (0, 0.5):
            j = int((b + h * beat) * SR); hh = hp(noise(0.05), 7000) * np.exp(-tt(0.05) * 90) * 0.06; m[j:j + len(hh)] += hh[: max(0, N - j)]
    return m
mus = music()
# arrangement: silence on shot 1 (only bell), groove from shot 2, drop out before punchlines
gate = np.zeros(N); t = np.arange(N) / SR
gate[(t >= 0.6)] = 1
for a, b in [(at('g2', 'owner') - 0.1, at('g2', 'owner') + 0.45), (at('g4', 'twenty') - 0.3, at('g4', 'twenty') + 0.05)]:
    gate[(t >= a) & (t < b)] = 0
gate[(t >= END + 0.2)] = 1
gate = np.convolve(gate, np.ones(2400) / 2400, mode='same')
# duck under VO
vo_mask = np.zeros(N)
for k in W:
    for x in W[k]: vo_mask[(t >= x['t'] - 0.05) & (t < x['e'] + 0.1)] = 1
vo_mask = np.convolve(vo_mask, np.ones(4800) / 4800, mode='same')
mus = mus * gate * (1 - 0.6 * vo_mask) * 0.9
L += mus; R += mus * 0.98

# ---------- cue sheet
add(bell(), 0.0, 0.9)
add(whoosh(0.7, 200, 2500), 0.15, 0.5)
add(flybuzz(DUR, 230), 0.4, 0.35, -0.5); add(flybuzz(DUR, 185), 0.5, 0.3, 0.5)
add(whoosh(0.35, 400, 5000), SHOT2 - 0.15, 0.8)
add(pop(800), at('g2', 'gus'), 0.6); add(shutter(), at('g2', 'owner'), 0.5)
add(whoosh(0.35, 300, 4000), SHOT3 - 0.15, 0.8)
for k in range(6): add(pop(500 + 120 * k), at('g3', 'socks') + 0.12 * k, 0.25, (-1) ** k * 0.4)
add(riser(0.5), at('g3', 'flip') - 0.5, 0.4)
add(whoosh(0.35, 300, 4000), SHOT4 - 0.15, 0.8)
add(sub(0.9), at('g4', 'twenty'), 0.7); add(slam() * 0.5, at('g4', 'twenty'), 0.6)
# ---------- VO (decode mp3 via ffmpeg)
for k, off in VO.items():
    raw = subprocess.run([FF, '-loglevel', 'error', '-i', os.path.join(ROOT, f'web/assets/hotel/vo/{k}.mp3'), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    v = np.frombuffer(raw, np.float32).astype(float); add(v, off, 1.0)

mix = np.stack([L, R], 1); mix /= max(1e-6, np.abs(mix).max()) / 0.9
out = os.path.join(ROOT, 'out/gus-raw.wav')
import wave
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('raw mix →', out, 'slam at', round(SLAM, 2))
