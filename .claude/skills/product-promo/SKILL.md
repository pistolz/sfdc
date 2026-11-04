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

Read `reference/layers.md` (editorial section) and copy the pattern of `examples/promo-example.json` exactly — it reproduces the measured layout of pro "tech creator" reels:
- `"style": "editorial"`, `"mascot": { "color": "#c55a40" }`, every beat `scene: "compose"`, beats are not cut (paper, header and mascot stay; content settles in).
- Every beat: `bg` paper → `ed-header` (`// 0N · section` + right label + red value that changes: OBJECTION 1/3, BUILD 4/5, VIEWS 2.04M…) → `ed-headline` (= the spoken sentence, `*accent*` on 1–3 words) → **one visual group** centred between y 520 and 1240: `ed-sticker` + `ed-folder`, `ed-code` → `ed-arrow` → `ed-phone`, `ed-prompt` + `ed-build` + `ed-phone`, `ed-qmarks` + `ed-bubble` (objections), `ed-big` + `ed-pill` + `ed-stat` (proof), `ed-steps` (APPROVED stamps), `ed-comment` + `ed-dm` (CTA).
- Nothing below y 1240 except the mascot (735, 1360). Set `"mascotMood": "shock"` on objection beats, `"happy"` on the CTA.
- Time each element to the word that names it (`"at"`), typing to `"typeAt"`; a beat that continues the previous visual can set `"continue": true` and repeat the same layer with `"anim": "none"`.
- `cover.html`: `<div class="cover-part">PRODUCT</div><div class="t">Promise with <i>italic accent.</i></div>`.
- For a product with an app or a website, put real screenshots in `assets/` and show them with `ed-phone` (`src`) or `ed-image`.

## 4. Check, voice, render, deliver

1. Stills: `npm run render -- --episode promos/<slug>/promo.json --still 1,5,9,…` → Read them, fix overlaps.
2. Voice: the voice is half of the "pro" feel. Best: record it or generate it with ElevenLabs, one file per beat in `voice/<episode>/<id>.mp3`. Free fallback: `pip install edge-tts`, `npm run voice -- --episode promos/<slug>/promo.json` (`en-US-AndrewNeural`, rate +6%).
3. Render: `npm run render -- --episode promos/<slug>/promo.json` (`--encoder nvenc` on NVIDIA; sandbox draft `--scale 0.5 --fps 15`).
4. Deliver the MP4 + cover, the commands for the user's machine, and **captions** for Instagram/TikTok/Shorts/Facebook: hook line, 2–4 short lines of value, "Comment KEYWORD and I'll DM you …", 3–6 hashtags. Remind them to set up the auto-DM for the keyword (e.g. ManyChat) before posting.
