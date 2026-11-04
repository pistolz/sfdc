---
name: product-promo
description: Turn a product, app, service or offer into a short vertical sales video (Reels / TikTok / Shorts) in a clean "editorial tech" style — off-white paper, bold sans headline with a red italic serif keyword, mono labels, dark UI cards, a small mascot — ending with a "Comment KEYWORD" call to action. Use when the user says "here is my product, make me a video to sell it", "promo video", "pub pour mon produit", "vidéo pour vendre". Writes the script (hook → objections → how it works → proof → CTA), builds it with code-drawn layers, adds voice-over, renders 1080×1920 MP4 + cover and writes the captions.
---

# Product promo video: product → sales Reel

You make a 30–45 s vertical video that sells one product, in the **editorial tech** look: paper background `#EEEEE9` with a faint grid, black bold sans headline (Plus Jakarta Sans) with one *red italic serif* accent (Instrument Serif, `#F03828`), monospace labels (`// 03 · the proof`), dark rounded UI cards, a red mascot bottom-right. Everything is drawn by code with the engine bundled in this skill (`engine/`, see `reference/layers.md`).

**Honesty rules**: use only facts the user gives you. Never invent numbers, testimonials, reviews, user counts or results. If a proof number is missing, use a non-numeric proof (a demo, a feature) or a clearly marked placeholder and tell the user. No fake "as seen on" logos.

## 0. Set up the engine (once per working folder)

1. If `./reel-engine/package.json` does not exist, copy this skill's `engine/` folder to `./reel-engine`.
2. `cd reel-engine && npm install` (sandbox without Chrome download: `PUPPETEER_SKIP_DOWNLOAD=true`, then render with `--chrome <path>`).
3. Put the user's screenshots / logo in `reel-engine/assets/` and work in `reel-engine/promos/<slug>/`.

## 1. Product brief (ask only what is missing, in one short message)

- What it is and **who it is for** (one sentence).
- **The one big promise** (time saved, money made, pain removed).
- **3 key features** or steps of how it works.
- **Real proof** if any: numbers, results, screenshots, demo.
- **2–3 objections** buyers have ("too expensive", "another app", "looks AI").
- **CTA**: comment keyword (one word, e.g. PLAYBOOK, FOCUS) + what they receive in DM, or "link in bio". Language (default English).

## 2. Script (show it before building unless the user said "just do it")

Structure, one sentence per beat, 80–120 words:
1. **Hook (0–3 s)** — the promise in one line, keyword in italics: "This one app finishes your to-do list in *half the time.*"
2. **Proof teaser** (optional, only real numbers).
3. **Objections, numbered**: "First, you might think *it's just another app.*" → answer in one line with a visual (demo card, checklist, number).
4. **How it works**: 3 steps / checklist / terminal / phone screen.
5. **CTA**: "Comment *KEYWORD,* and I'll send you …" + "or tap the link in bio."

Each beat's headline uses `*…*` around the 1–3 words to stress (red italic).

## 3. Build → `promos/<slug>/promo.json`

Read `reference/layers.md` and copy the pattern of `examples/promo-example.json`:
- `"style": "editorial"`, `"mascot": { "color": "#f03828" }`, every beat `scene: "compose"`.
- Every beat: `bg` paper → `ed-header` (`// 0N · section`, right label + red value) → `ed-headline` (the spoken sentence, revealed word by word) → **one** visual in the middle (y 950–1400): `ed-sticker`, `ed-bubble`(+`ed-qmarks`), `ed-check`, `ed-steps`, `ed-terminal`, `ed-stat`, `ed-phone`/`ed-image` (user screenshots), `number`+`ed-pill`, `emoji`.
- Last beat: `ed-comment` with the keyword (+ optional `ed-pill` "LINK IN BIO").
- Keep lots of empty space; one idea per screen; keep y > 1540 free (mascot only).
- `cover.html`: `<div class="cover-part">PRODUCT</div><div class="t">Promise with <i>italic accent.</i></div>`.

## 4. Check, voice, render, deliver

1. Stills: `npm run render -- --episode promos/<slug>/promo.json --still 1,5,9,…` → Read them, fix overlaps.
2. Voice: `pip install edge-tts`, `npm run voice -- --episode promos/<slug>/promo.json` (a calm, confident voice; `en-US-AndrewNeural` or `en-US-EmmaNeural`; own recordings in `voice/promo/<id>.mp3`).
3. Render: `npm run render -- --episode promos/<slug>/promo.json` (`--encoder nvenc` on NVIDIA; sandbox draft `--scale 0.5 --fps 15`).
4. Deliver the MP4 + cover, the commands for the user's machine, and **captions** for Instagram/TikTok/Shorts/Facebook: hook line, 2–4 short lines of value, "Comment KEYWORD and I'll DM you …", 3–6 hashtags. Remind them to set up the auto-DM for the keyword (e.g. ManyChat) before posting.
