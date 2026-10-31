#!/usr/bin/env python3
"""
TTS pipeline: narration text -> voice audio (wav, 48 kHz) + word-level timestamps (json).

Usage:
  python3 tts_pipeline.py --text narration.txt --out outdir --engine edge --voice en-US-ChristopherNeural --rate +6%
  python3 tts_pipeline.py --text narration.txt --out outdir --engine kokoro --voice am_michael --speed 1.05

Outputs in outdir:
  voice.wav          48 kHz mono PCM, peak-normalized to -1 dBTP (final loudness is handled in the mix)
  words.json         [{"w": "Look", "s": 0.10, "e": 0.36}, ...]   (seconds)
  captions.json      Remotion @remotion/captions Caption[] (ms) — text with leading spaces
  meta.json          engine, voice, duration, wpm

Alignment: edge-tts gives WordBoundary offsets natively. Kokoro output is aligned with faster-whisper
(word_timestamps=True), then snapped to the script words by order (robust to small ASR errors).
Markers like [Y]word[/Y] / [R]word[/R] in the script are stripped before synthesis and ignored here;
caption coloring is handled by the caption builder from the original marked script.
"""
import argparse, asyncio, json, os, re, subprocess, sys
import numpy as np

def strip_marks(t: str) -> str:
    t = re.sub(r"\[/?[YRW]\]", "", t)
    return re.sub(r"[ \t]+", " ", t).strip()

def tokenize(t: str):
    # words as the TTS will say them; keep punctuation attached for caption rendering
    return [w for w in re.split(r"\s+", t.strip()) if w]

def norm(w: str) -> str:
    return re.sub(r"[^a-z0-9']", "", w.lower())

# ---------------- edge-tts ----------------
async def edge_synth(text, voice, rate, pitch, out_mp3):
    import edge_tts
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    words = []
    with open(out_mp3, "wb") as f:
        async for ch in comm.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"w": ch["text"], "s": ch["offset"] / 1e7, "e": (ch["offset"] + ch["duration"]) / 1e7})
    return words

# ---------------- kokoro ----------------
def kokoro_synth(text, voice, speed, out_wav):
    import soundfile as sf
    from kokoro import KPipeline
    p = KPipeline(lang_code="a" if not voice.startswith("b") else "b")
    chunks = []
    for _gs, _ps, audio in p(text, voice=voice, speed=speed):
        chunks.append(audio.numpy() if hasattr(audio, "numpy") else np.asarray(audio))
    a = np.concatenate(chunks).astype(np.float32)
    sf.write(out_wav, a, 24000)
    return len(a) / 24000

def whisper_words(wav_path):
    import wave
    from faster_whisper import WhisperModel
    # resample to 16k mono for whisper
    tmp = wav_path + ".16k.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav_path, "-ac", "1", "-ar", "16000", tmp], check=True)
    w = wave.open(tmp)
    a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    m = WhisperModel("small", compute_type="int8")
    segs, _ = m.transcribe(a, word_timestamps=True, language="en")
    out = []
    for s in segs:
        for wd in s.words:
            out.append({"w": wd.word.strip(), "s": float(wd.start), "e": float(wd.end)})
    os.remove(tmp)
    return out

def snap_to_script(script_words, asr_words):
    """Assign a start/end to each script word using ASR words in order (greedy fuzzy match, with
    interpolation for unmatched words)."""
    n = len(script_words)
    res = [None] * n
    j = 0
    for i, sw in enumerate(script_words):
        target = norm(sw)
        if not target:
            continue
        # look ahead a few ASR words for a match
        for k in range(j, min(j + 4, len(asr_words))):
            if norm(asr_words[k]["w"]) == target or (len(target) > 3 and norm(asr_words[k]["w"]).startswith(target[:4])):
                res[i] = (asr_words[k]["s"], asr_words[k]["e"])
                j = k + 1
                break
    # interpolate gaps
    idx = [i for i, r in enumerate(res) if r]
    if not idx:
        raise SystemExit("alignment failed: no words matched")
    for i in range(n):
        if res[i] is None:
            prev = max([k for k in idx if k < i], default=None)
            nxt = min([k for k in idx if k > i], default=None)
            if prev is None:
                s0, e0 = 0.0, res[nxt][0]
                span = (nxt - 0)
                pos = i
            elif nxt is None:
                s0 = res[prev][1]
                e0 = s0 + 0.3 * (i - prev)
                span = (i - prev)
                pos = i - prev - 1
            else:
                s0, e0 = res[prev][1], res[nxt][0]
                span = nxt - prev
                pos = i - prev - 1
            step = (e0 - s0) / max(span, 1)
            res[i] = (s0 + pos * step, s0 + (pos + 1) * step)
    return [{"w": sw, "s": round(r[0], 3), "e": round(r[1], 3)} for sw, r in zip(script_words, res)]

def to_captions(words):
    caps = []
    for i, w in enumerate(words):
        caps.append({
            "text": ("" if i == 0 else " ") + w["w"],
            "startMs": int(round(w["s"] * 1000)),
            "endMs": int(round(w["e"] * 1000)),
            "timestampMs": int(round((w["s"] + w["e"]) / 2 * 1000)),
            "confidence": None,
        })
    return caps

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--engine", choices=["edge", "kokoro"], default="edge")
    ap.add_argument("--voice", default="en-US-ChristopherNeural")
    ap.add_argument("--rate", default="+6%")      # edge
    ap.add_argument("--pitch", default="+0Hz")    # edge
    ap.add_argument("--speed", type=float, default=1.05)  # kokoro
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    raw = open(a.text, encoding="utf-8").read()
    text = strip_marks(raw)
    script_words = tokenize(text)
    wav = os.path.join(a.out, "voice.wav")

    if a.engine == "edge":
        mp3 = os.path.join(a.out, "voice_raw.mp3")
        words = asyncio.run(edge_synth(text, a.voice, a.rate, a.pitch, mp3))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-ac", "1", "-ar", "48000", "-af", "volume=0dB", wav], check=True)
        # edge word list may split/merge tokens differently from the script → snap by order
        asr_like = [{"w": w["w"], "s": w["s"], "e": w["e"]} for w in words]
        words = snap_to_script(script_words, asr_like)
    else:
        raw_wav = os.path.join(a.out, "voice_raw.wav")
        kokoro_synth(text, a.voice, a.speed, raw_wav)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw_wav, "-ac", "1", "-ar", "48000", wav], check=True)
        words = snap_to_script(script_words, whisper_words(wav))

    # peak normalize to -1 dBTP
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-af", "alimiter=limit=0.89:level=false,volume=0dB", wav + ".tmp.wav"], check=True)
    os.replace(wav + ".tmp.wav", wav)
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]).decode().strip())
    json.dump(words, open(os.path.join(a.out, "words.json"), "w"), indent=0)
    json.dump(to_captions(words), open(os.path.join(a.out, "captions.json"), "w"), indent=0)
    meta = {"engine": a.engine, "voice": a.voice, "duration_s": round(dur, 2), "words": len(script_words), "wpm": round(len(script_words) / dur * 60, 1)}
    json.dump(meta, open(os.path.join(a.out, "meta.json"), "w"), indent=2)
    print(json.dumps(meta))

if __name__ == "__main__":
    main()
