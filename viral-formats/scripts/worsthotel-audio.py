#!/usr/bin/env python3
"""Sound design for Worst Hotel Day 1 — reuses the synth SFX/music from hotel-audio.py, cues on VO word times."""
import json, os, importlib.util, sys
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINES = ['v01','v02','v03','v04','v05','v06','v07','v08','v09','v10']
VOD = os.path.join(ROOT, 'web/assets/worsthotel/vo')
W = {k: json.load(open(f'{VOD}/{k}.json')) for k in LINES}
st = {}; t = 0.35
for k in LINES: st[k] = t; t += W[k][-1]['e'] + (1.0 if k == 'v05' else 0.32)
DUR = t + 0.9
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
for a, b in [(at('v02','on') - 0.3, at('v02','good')), (at('v05','it') - 0.35, st['v06'] + 0.9), (at('v08','we') - 0.2, at('v08','bathroom',1) + 0.6)]:
    gate[(tarr >= a) & (tarr < b)] = 0
gate = np.convolve(gate, np.ones(2400) / 2400, mode='same')
vom = np.zeros(N)
for k in LINES:
    for x in W[k]: vom[(tarr >= x['t'] - 0.05) & (tarr < x['e'] + 0.1)] = 1
vom = np.convolve(vom, np.ones(4800) / 4800, mode='same')
mus = mus * gate * (1 - 0.55 * vom) * 0.85
g['L'] += mus; g['R'] += mus
cut = lambda k: st[k] - 0.18
add(g['bell'](), 0.0, 0.9)
for k in ['v02','v03','v04','v05','v06','v07','v08','v09']: add(g['whoosh'](0.35, 400, 4500), cut(k) - 0.15, 0.7)
add(g['neon'](st['v03'] - st['v02']), cut('v02'), 1.0)
for z in (0.3, 0.9, 1.5): add(g['zap'](), cut('v02') + z, 0.5, 0.3)
add(g['pop'](700), at('v03','gus'), 0.6); add(g['shutter'](), at('v03','owner'), 0.5)
ph = cut('v04') + 0.1; vib = np.sin(2*np.pi*170*tt(0.6)) * (np.sin(2*np.pi*12*tt(0.6)) > 0) * 0.35; add(vib, ph, 0.9); add(vib, ph + 0.8, 0.7)
add(g['pop'](1200), at('v04','thirty'), 0.5)
eng = g['lp'](g['noise'](3.2), 160) * 3 + np.sin(2*np.pi*45*tt(3.2)) * 0.3; add(eng * np.minimum(1, tt(3.2) * 2), cut('v05') + 0.2, 0.8)
add(g['slam'](), at('v05','bulldozed'), 1.0); add(g['sub'](1.2), at('v05','bulldozed'), 0.8)
add(g['cigar_plip'](), cut('v06') + 0.7, 1.0)
add(g['flybuzz'](st['v07'] - st['v06'], 220), cut('v06'), 0.5, -0.4)
sk = g['noise'](2.4) * (np.random.default_rng(2).random(int(2.4 * SR)) < 0.02) ; add(g['lp'](sk, 3500) * 2, cut('v07'), 0.8)
for i in range(8): add(g['pop'](500 + 60 * i), cut('v07') + 0.1 + i * 0.18, 0.18)
add(g['flybuzz'](2.4, 250) * 2.2, cut('v08') + 0.3, 0.9, -0.2); add(g['flybuzz'](2.4, 180) * 2, cut('v08') + 0.35, 0.8, 0.3)
add(g['riser'](0.6), at('v08','bathroom',1) - 0.5, 0.7); add(g['slam'](), at('v08','bathroom',1) + 0.1, 1.0)
add(g['pop'](800), cut('v09') + 0.1, 0.7); add(g['pop'](1000), cut('v09') + 0.3, 0.7)
add(g['pop'](900), at('v10','roaches'), 0.5); add(g['pop'](1100), at('v10','toilet'), 0.5); add(g['pop'](1300), at('v10','comment'), 0.6)
add(g['bell'](), DUR - 0.25, 0.5)
import subprocess, wave
FF = os.path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg')
for k in LINES:
    raw = subprocess.run([FF, '-loglevel', 'error', '-i', f'{VOD}/{k}.mp3', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    add(np.frombuffer(raw, np.float32).astype(float), st[k], 1.0)
mix = np.stack([g['L'], g['R']], 1); mix /= max(1e-6, np.abs(mix).max()) / 0.9
with wave.open(os.path.join(ROOT, 'out/worsthotel-raw.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('duration', round(DUR, 2))
