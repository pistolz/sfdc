#!/usr/bin/env python3
"""Shorten silences between words in a TTS take and retime words.json/captions.json accordingly.

usage: tighten_pauses.py <tts_out_dir> <dest_dir> [--max 0.26] [--keep word=seconds ...]
--keep lets dramatic beats keep a longer pause after a given word (matched case-insensitively, first occurrence).
"""
import argparse, json, os, subprocess
import numpy as np, soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--max", type=float, default=0.26)
ap.add_argument("--keep", nargs="*", default=[])
a = ap.parse_args()
keep = {k.split("=")[0].lower(): float(k.split("=")[1]) for k in a.keep}
audio, sr = sf.read(os.path.join(a.src, "voice.wav"))
words = json.load(open(os.path.join(a.src, "words.json")))
pad = 0.06  # keep a little room before/after words so consonants aren't clipped
segs, out_words, t_out, cursor = [], [], 0.0, 0.0
for i, w in enumerate(words):
    s, e = w["s"], w["e"]
    if i == 0:
        start = max(0.0, s - pad)
        segs.append((start, s)); t_out += s - start
    else:
        prev_e = words[i - 1]["e"]
        gap = s - prev_e
        limit = keep.pop(words[i - 1]["w"].lower(), a.max)
        if gap > limit:
            # keep head and tail of the gap (breath/decay), drop the middle
            head = min(gap, limit / 2); tail = limit - head
            segs.append((prev_e, prev_e + head)); segs.append((s - tail, s)); t_out += limit
        else:
            segs.append((prev_e, s)); t_out += gap
    out_words.append({"w": w["w"], "s": round(t_out, 3), "e": round(t_out + (e - s), 3)})
    segs.append((s, e)); t_out += e - s
segs.append((words[-1]["e"], min(len(audio) / sr, words[-1]["e"] + 0.4)))
fade = int(0.004 * sr)
parts = []
for s, e in segs:
    x = audio[int(s * sr):int(e * sr)].copy()
    if len(x) > 2 * fade:
        x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
    parts.append(x)
y = np.concatenate(parts)
os.makedirs(a.dst, exist_ok=True)
sf.write(os.path.join(a.dst, "voice.wav"), y, sr, subtype="PCM_24")
json.dump(out_words, open(os.path.join(a.dst, "words.json"), "w"), indent=0)
caps = [{"text": ("" if i == 0 else " ") + w["w"], "startMs": int(w["s"] * 1000), "endMs": int(w["e"] * 1000),
         "timestampMs": int((w["s"] + w["e"]) * 500), "confidence": None} for i, w in enumerate(out_words)]
json.dump(caps, open(os.path.join(a.dst, "captions.json"), "w"), indent=0)
print(json.dumps({"duration_s": round(len(y) / sr, 2), "words": len(out_words)}))
