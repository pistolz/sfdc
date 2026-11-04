---
name: product-promo
description: Turn a product, app, service or offer into a short vertical sales video (Reels / TikTok / Shorts) in a clean "editorial tech" style — off-white paper, bold sans headline with a red italic serif keyword, mono labels, dark UI cards, a small mascot — ending with a "Comment KEYWORD" call to action. Use when the user says "here is my product, make me a video to sell it", "promo video", "pub pour mon produit", "vidéo pour vendre". Writes the script (hook → objections → how it works → proof → CTA), builds it with code-drawn layers, adds voice-over, renders 1080×1920 MP4 + cover and writes the captions.
---

# Product promo video: product → sales Reel, agency quality

You make a 25–45 s vertical video that sells ONE product, in the editorial "tech creator" look measured on pro reels (paper + grid, bold headline with an accent italic word, mono labels, brutal cards, product shots, a mascot or none). Everything is drawn by code with the engine bundled in this skill (`engine/`). **Read `reference/playbook.md` first** (hooks, structures per product type, craft rules), then `reference/layers.md` (every layer, theme, music, QA).

**Honesty rules**: use only facts the user gives you. Never invent numbers, reviews, testimonials, user counts, press logos, scarcity or deadlines. Missing proof → show a demo or a feature instead and say so.

## 0. Engine (once per working folder)
1. If `./reel-engine/package.json` is missing, copy this skill's `engine/` folder to `./reel-engine`; `cd reel-engine && npm install` (sandbox without Chrome download: `PUPPETEER_SKIP_DOWNLOAD=true`, then `--chrome <path>` on every command).
2. `pip install edge-tts` for the free voice (or the user's ElevenLabs key in the environment as `ELEVENLABS_API_KEY`, never printed or committed).
3. Work in `reel-engine/promos/<slug>/`; put the user's assets (transparent product PNGs, screenshots, logo, before/after photos) in `reel-engine/assets/<slug>/`.

## 1. Brief → APPROVAL 1 (script)
1. Collect the brief (playbook §1) in ONE short message; infer the rest from links/photos and state your assumptions.
2. Pick the structure for the product type (playbook §3) and a hook formula (§2).
3. Write `promos/<slug>/SCRIPT.md`: the brief recap, the beat table (# · spoken line · on-screen headline with `*accent*` · scene/layers · proof source), the CTA, the cover title, the brand theme.
4. **Stop and show it.** Apply the user's changes. Skip the wait only if they said "just do it".

## 2. Build → APPROVAL 2 (look)
1. Write `promos/<slug>/promo.json` from `examples/promo-example.json` (app) or `examples/promo-product.json` (physical product): `"style": "editorial"`, `"theme"` (brand accent, mascot or not), `"music"`, `"voice"`, every beat `scene: "compose"` with `bg` paper → `ed-header` → `ed-headline` (= the spoken sentence) → ONE visual group between y 520 and 1240. Real product photos → `ed-product` / `ed-phone` (`src`) / `ed-image` / `ed-beforeafter`.
2. `npm run voice -- --episode promos/<slug>/promo.json` (word timings) — if the network blocks it, continue with estimated timing and tell the user.
3. `npm run qa -- --episode promos/<slug>/promo.json` → fix every ERROR and WARN; Read `out/qa/<name>/sheet.jpg` yourself (overlaps, empty moments, unreadable text).
4. Render 4–5 stills of the key beats + the cover (`npm run render -- --episode … --still t1,t2,…`), **show them as the look test and wait**.

## 3. Draft → APPROVAL 3 → final
1. Draft: `npm run render -- --episode … --scale 0.5 --fps 15` → send it.
2. After the OK: final `npm run render -- --episode …` (`--encoder nvenc` on NVIDIA; `--workers N` parallel pages). Output: MP4 (−14 LUFS) + cover PNG.
3. Deliver: the video, the cover, the exact commands for the user's own machine, and **captions** for Instagram, TikTok, YouTube Shorts (title ≤ 100 chars + description) and Facebook: hook line, 2–4 value lines, "Comment KEYWORD and I'll DM you…", 3–6 hashtags; remind them to set up the keyword auto-DM (e.g. ManyChat) and to pin a comment.
