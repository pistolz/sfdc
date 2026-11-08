---
name: studio-production
description: Produce a short vertical video (Reels / TikTok / Shorts) like a professional animation studio — brief, bible, script with performance marks, storyboard and shot list (every shot timed to the voice-over word), animatic, style frames, production, QA — with approval gates and no shortcuts. Use whenever the user asks for a new episode, a new series pilot, "make me the video", "go", or complains that a video looks cheap. Works with the engines in this repo (reel-engine, viral-formats) and with AI-generated illustrations for premium art.
---

# Studio production — never render blind

The user wants agency-level videos: every shot pre-planned, the image follows the word, premium "shine", modern sound, a narrator who performs (pauses, rises, falls, punchlines). Follow every stage, show each gate, wait for approval.

## Stages and gates
1. **Brief** — logline, audience, promise of the episode, KPI (average watch > 50 %, sends, follows / 1k views), the one-sentence summary we want Meta's "About this reel" to write.
2. **Bible** (once per series) — characters (look, quirks, 4 expressions), world/sets, art direction (the shine recipe below), type, HUD, sound palette, voice direction.
3. **Script** — the hook is the first 2 seconds (first word AND first sound at 0.00 s). Mark performance: `/` short pause, `//` long pause, **bold** stress, ↑ ↓ pitch. Punchlines are preceded by silence. Lists are fast, stakes are slow and low.
4. **Storyboard + shot list** — table with: #, time in/out, VO sync word, image + set dressing, pose/expression, camera (framing + move), transition, on-screen text/HUD, SFX, music. Rule: every noun the voice says is on screen at that word. No shot > 3.5 s without motion. **→ GATE 1 (script + shot list)**
5. **Animatic** — boards cut to scratch VO with word timestamps; fix timing before any final art.
6. **Look dev** — 3 style frames at final quality (hook shot, character shot, CTA shot). Character reference sheet first; every later image uses it as reference for consistency. **→ GATE 2**
7. **Production** — assets (AI illustration via image generator + code layers for motion, text, HUD), animation (parallax, camera moves, secondary motion: blinks, flies, flicker, dust), final VO (ElevenLabs with timestamps), SFX on exact frames, music ducked, grade, captions word by word.
8. **QA + delivery** — checklist below, cover, post caption, pinned comment. **→ GATE 3**

## The shine recipe (premium, never cheap)
2-tone cel shading + soft gradients · rim light on characters/props · specular highlights on glossy things · bloom on every light source + light shafts with dust · contact shadows / AO · depth of field (blurred background) · hand-drawn variable-width outline + subtle grain · cinematic grade (warm vs teal), vignette · render 2× and downscale · chunky rounded display type with dark stroke + soft shadow, keyword in gradient colour, overshoot pop · glossy HUD pills with inner highlight.

## Sound
Modern foley, airy whooshes on cuts, short risers into reveals, sub drop on stakes, soft UI pops, max one comic sting per episode, no dated cartoon clichés. Music bed ducked −12 dB under VO, cut to silence before punchlines. Master −14 LUFS / −1 dBTP.

## QA checklist
- First frame understandable in 0.5 s; sound at 0.00 s
- Every VO noun visible at its word; no dead frame > 1.5 s; no static shot > 3.5 s
- Text inside safe zone (y 230–1500, x 90–960), readable size, no typo
- Silence before punchlines; music ducked; −14 LUFS
- Loop: last frame matches the first
- Cover + post text + pinned comment ready

## Example
`productions/worst-hotel/01-preproduction-day01.md` — full pre-production pack for "30 Days to Save the Worst Hotel", Day 1.
