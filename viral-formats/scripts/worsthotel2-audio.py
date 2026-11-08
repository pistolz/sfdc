#!/usr/bin/env python3
"""Sound design for Worst Hotel Day 1 — reuses the synth SFX/music from hotel-audio.py, cues on VO word times."""
import json, os, importlib.util, sys
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINES = ['w01','w02','w03','w04','w05','w06','w07','w08','w09','w10','w11']
VOD = os.path.join(ROOT, 'web/assets/worsthotel/vo')
W = {k: json.load(open(f'{VOD}/{k}.json')) for k in LINES}
st = {}; t = 0.35
for k in LINES: st[k] = t; t += W[k][-1]['e'] + (1.25 if k == 'w08' else 0.15 if k == 'w10' else 0.28)
DUR = t + 1.4
for k in LINES:
    for x in W[k]: x['t'] += st[k]; x['e'] += st[k]; x['w'] = x['w'].strip('.?!,').lower()
def at(k, w, n=0): return [x for x in W[k] if x['w'].startswith(w)][n]['t']
# load SFX library from hotel-audio.py without running its mix
src = open(os.path.join(ROOT, 'scripts/hotel-audio.py')).read()
lib = src[:src.index('# ---------- music')]
lib = lib.replace("VO = {'l1': 0.25, 'l2': 3.1, 'l3': 5.5, 'l4': 7.8}", "VO = {}").replace("SR = 48000; DUR = 12.7", f"SR = 48000; DUR = {DUR}")
lib = lib.replace("W = {k: words(k) for k in VO}", "W = {}").replace("SLAM = W['l4'][-1]['e'] + 0.05", "")
g = {'__file__': os.path.join(ROOT, 'scripts/hotel-audio.py')}; exec(lib, g)
music_src = src[src.index('def music():'):src.index('mus = music()')]
exec(music_src, g)
N, SR = g['N'], g['SR']; add, tt = g['add'], g['tt']
mus = g['music'](); tarr = np.arange(N) / SR
gate = (tarr >= 0.5).astype(float)
for a, b in [(at('w02','in') - 0.3, at('w02','america')), (at('w08','days') + 0.3, st['w09'] + 0.6), (at('w10','roaches') - 0.3, at('w10','roaches') + 0.1)]:
    gate[(tarr >= a) & (tarr < b)] = 0
gate = np.convolve(gate, np.ones(2400) / 2400, mode='same')
vom = np.zeros(N)
for k in LINES:
    for x in W[k]: vom[(tarr >= x['t'] - 0.05) & (tarr < x['e'] + 0.1)] = 1
vom = np.convolve(vom, np.ones(4800) / 4800, mode='same')
mus = mus * gate * (1 - 0.55 * vom) * 0.85
g['L'] += mus; g['R'] += mus
cut = lambda k: st[k] - 0.18
CIG = st['w08'] + W['w08'][-1]['e'] - st['w08'] + 0.08
add(g['bell'](), 0.0, 0.9)
for k in ['w02','w03','w04','w05','w06','w09','w10']: add(g['whoosh'](0.35, 400, 4500), cut(k) - 0.15, 0.7)
add(g['flybuzz'](st['w06'], 220), 0.3, 0.35, -0.4); add(g['flybuzz'](st['w06'], 180), 0.4, 0.3, 0.4)
add(g['pop'](700), at('w01','gus'), 0.7)
add(g['shutter'](), at('w03','2019'), 0.6); add(g['pop'](900), at('w03','2019'), 0.6)
sq = g['lp'](g['noise'](0.5), 600) * np.exp(-tt(0.5) * 6) * 2; add(sq, at('w05','sticky'), 0.9)
ph = cut('w06') + 0.1; vib = np.sin(2*np.pi*170*tt(0.6)) * (np.sin(2*np.pi*12*tt(0.6)) > 0) * 0.35; add(vib, ph, 0.9)
for w,n in [('got',0),('his',0),('five',0),('checks',0),('thirty',0)]: add(g['pop'](1300), at('w0'+('6' if w=='got' else '7' if w in ('his','five') else '8'), w, n), 0.6)
add(g['sub'](1.2), CIG, 0.8); add(g['cigar_plip'](), CIG + 0.45, 1.0)
eng = g['lp'](g['noise'](3.2), 160) * 3 + np.sin(2*np.pi*45*tt(3.2)) * 0.3; add(eng * np.minimum(1, tt(3.2) * 2), cut('w09') + 0.2, 0.8)
add(g['slam'](), at('w09','bulldozed'), 1.0); add(g['sub'](1.2), at('w09','bulldozed'), 0.8)
add(g['pop'](900), at('w10','roaches'), 0.6); add(g['pop'](1100), at('w10','toilet'), 0.6); add(g['pop'](1300), st['w11'], 0.6)
add(g['bell'](), DUR - 0.25, 0.5)
SFX_L, SFX_R = g['L'].copy(), g['R'].copy()
g['L'][:] = 0; g['R'][:] = 0
import subprocess, wave
FF = os.path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg')
for k in LINES:
    raw = subprocess.run([FF, '-loglevel', 'error', '-i', f'{VOD}/{k}.mp3', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    add(np.frombuffer(raw, np.float32).astype(float), st[k], 1.0)
VO_L, VO_R = g['L'], g['R']
vpk = max(1e-6, np.abs(VO_L).max())
def bus(x):  # tame transients: soft-clip, then sit ~15 dB under the voice peak
    x = x / max(1e-6, np.abs(x).max())
    x = np.tanh(x * 2.5) / np.tanh(2.5)
    return x * vpk * 0.18
# duck SFX/music a bit more while the narrator talks
vm = np.convolve((np.abs(VO_L) > vpk * 0.02).astype(float), np.ones(4800) / 4800, mode='same')
duck = 1 - 0.5 * np.clip(vm * 3, 0, 1)
L = VO_L + bus(SFX_L) * duck; R = VO_R + bus(SFX_R) * duck
mix = np.stack([L, R], 1); mix /= max(1e-6, np.abs(mix).max()) / 0.9
with wave.open(os.path.join(ROOT, 'out/worsthotel2-raw.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('duration', round(DUR, 2))
