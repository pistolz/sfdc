#!/usr/bin/env python3
"""Microsoft neural voice (edge-tts) with exact word timings.
usage: tts_words.py --voice V --rate +4% --pitch +0Hz --text "..." --out clip.mp3 --words clip.words.json"""
import argparse, asyncio, json

async def main(a):
    import edge_tts
    try:
        comm = edge_tts.Communicate(a.text, a.voice, rate=a.rate, pitch=a.pitch, boundary="WordBoundary")
    except TypeError:  # older edge-tts: word boundaries are the default
        comm = edge_tts.Communicate(a.text, a.voice, rate=a.rate, pitch=a.pitch)
    words = []
    with open(a.out, "wb") as f:
        async for ch in comm.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"w": ch["text"], "t": ch["offset"] / 1e7, "d": ch["duration"] / 1e7})
    with open(a.words, "w", encoding="utf-8") as f:
        json.dump(words, f)

p = argparse.ArgumentParser()
for k in ("voice", "rate", "pitch", "text", "out", "words"):
    p.add_argument("--" + k, required=True)
asyncio.run(main(p.parse_args()))
