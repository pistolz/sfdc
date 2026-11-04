---
name: interactive-series
description: Turn a series idea into a ready-to-post vertical episode (Instagram Reels / TikTok / YouTube Shorts) where viewers vote in the comments to decide the next part. Use when the user says things like "here is my new series idea, make me episode 1", "make part 2 from these votes", "new interactive story series", "série interactive", "fais-moi l'épisode 1". Writes the hook-first script, builds a code-drawn 2D episode (no AI images), voice-over, sound, captions, renders 1080×1920 MP4 + cover, and prepares the next part from the comment votes.
---

# Interactive series: idea → episode 1 (and the next parts)

You produce short vertical episodes of a **live, audience-driven story series**. Every episode ends on a choice; viewers vote in the comments; the votes decide the next part, and voters see their names in the video.

Everything is drawn by code with the engine bundled in this skill (`engine/`, see `reference/layers.md`). Never invent statistics about real accounts; never use copyrighted characters (no Pokémon, Marvel, Disney, anime heroes…) — invent original ones.

## 0. Set up the engine (once per working folder)

1. If `./reel-engine/package.json` does not exist in the current working directory, copy this skill's `engine/` folder there (`cp -r <skill folder>/engine ./reel-engine`).
2. `cd reel-engine && npm install` (if Chrome cannot be downloaded in a sandbox, set `PUPPETEER_SKIP_DOWNLOAD=true` and pass `--chrome <path to an installed Chrome/Chromium>` when rendering).
3. Series live in `reel-engine/series/<slug>/` (bible, episodes, votes).

## 1. Understand the idea (ask only what is missing)

From the user's message, get: the premise, the audience language (default English), the platform (default Instagram + TikTok + Shorts). If the idea is one line, that is enough — fill the gaps yourself and state your choices.

## 2. Write the series bible → `series/<slug>/bible.md`

- **Title** (2–3 words, all caps on screen) and **one-line premise with a countdown or a clear stake** ("In 200 days…", "The last boat leaves tonight").
- **The irony / twist** that makes the first sentence unexpected (the AI "saves the planet" by ending humanity).
- **Point of view: "you"** — the viewer is the hero. Give the hero a simple look (`person` look: top/pants/hair/hat colours).
- **HUD counters** (max 2): a countdown (`days`) and a resource (`budget`: money, food, fuel, battery, followers…) with their labels.
- **Visual identity**: style `story` (Anton captions, yellow keywords) or `ai` (cyan tech look); 2–3 background presets; 5–10 recurring emoji props; one signature visual for the hook.
- **Episode plan**: 4–6 parts, each ending on a dilemma. Keep each part 45–60 s.

## 3. Write the episode script (show it to the user before building, unless they said "just do it")

Rules that make these videos get pushed by the algorithm (retention first):
- **0–3 s hook**: one sentence with *what*, *when* (a number) and a twist. The first frame must already show the full title text (`"instant": true` keys) and the big number. Voice starts at 0.0 s. No intro, no logo.
- **One sentence = one beat** (≈ 2–6 s). 120–160 words total (≈ 50–60 s).
- **A re-hook every 8–10 s**: a number that drops, a stamp, a reveal, a short punch line alone ("…is us.").
- Use **"you"**, concrete numbers, prices and days; the HUD changes during the episode.
- **End on a dilemma** with 2 or 3 short options and a comment keyword: "Comment HELP or HIDE" / "Comment 1, 2 or 3". Add a reason to comment: "Everyone who votes gets their name on the bunker wall".
- No conclusion: the last frame freezes on the choice.

## 4. Build the episode → `series/<slug>/part1.json`

Read `reference/layers.md` (episode format, then the **Toon series look** section) and start from `examples/toon-example.json` — it reproduces the measured layout of pro interactive-series episodes.
- `"style": "toon"`; every beat `scene: "compose"`.
- **Shot vocabulary** (alternate them, a new shot every 2–5 s):
  1. *Vote recap* (part 2+): field background + `ui-vote` with last part's results.
  2. *Establishing / wide*: `toon-sky` + `toon-hills` + `toon-field` (`path`, `tall`) with a small character far away and the hero from behind in the foreground (`view: "back"`, s≈2.1) + `ui-clock`.
  3. *Dramatic close-up*: one character at s≈2.6–3 (y≈2150–2500), `shadowFace` / `raise` / `mood`, `talk: true` when they speak, `ui-speaker` name badge.
  4. *Battle / action*: `toon-hedge` + field + `ui-platform`s + creatures + hero from behind + `ui-hpbox` ×2 + `ui-dialog` + `ui-hit` + compact `ui-clock`; `hpTo`/`hpAt` to drain HP on a word.
  5. *Explainer*: `ui-tip` card with a real rule/fact of your world (viewers learn → they watch longer).
  6. *Ending*: `toon-gym`/`toon-room` + `blur` + characters + `ui-daycard` (`PART N+1`) + `ui-choices` (2–3 options) + the `choice` block.
- Captions (`keys`): 2 lines, keyword in `<span class='y'>`, `slot: "lower"`; a coloured `speaker` bar when a character talks.
- Characters: build the cast from `look` presets or custom colours; creatures are original (`emberkit`, `bubbit`, `stinger`, `woolly`) — never use existing franchise characters. Give creatures **viewers' names** with `ui-nametag` (pick them from the comments).
- Second character voice: `"voice": {...}` on their beats.
- `cover.html`: `<div class="cover-part">PART N</div><div class="t">LINE 1<br><span class="y">KEY LINE</span></div>` over a dramatic close-up (`coverTime`).
- The older generic styles (`story` with emoji props, `ai`) still work for other genres.

## 5. Check before rendering

1. `npm run render -- --episode series/<slug>/part1.json --still 0.3,<t2>,<t3>…` → look at every PNG (Read them). Fix overlaps, empty frames, text outside the safe zone (keep y > 1540 and the right edge free).
2. Show the user 3–4 stills (cover + key moments) as a second approval if they want to validate the look.
3. Be honest about quality: the UI and backgrounds match pro episodes closely; drawn characters are simpler than hand-illustrated ones. For a hero shot, the user can supply a PNG illustration (`ed-image`/`src`) to place in a beat.

## 6. Voice, render, deliver

1. `pip install edge-tts` then `npm run voice -- --episode series/<slug>/part1.json` (Microsoft neural voices; own recordings in `voice/<episode>/<id>.mp3` take priority). If the network blocks it, say so and give the user the command.
2. Final: `npm run render -- --episode series/<slug>/part1.json` (add `--encoder nvenc` on NVIDIA). Draft in a sandbox: `--scale 0.5 --fps 15`.
3. Deliver: `out/part1.mp4` + `out/part1_cover.png`, the exact commands for the user's own GPU machine, and **captions ready to paste** for Instagram, TikTok, YouTube Shorts (title ≤ 100 chars + description) and Facebook: first line = the hook, then the dilemma, "Comment X or Y", "The majority decides part 2", follow/subscribe, 4–8 hashtags. Suggest pinning a comment "X or Y? Vote closes in 24h 👇".

## 7. Next part (after the vote)

1. The user exports comments to CSV (`username,comment,likes`, all platforms in one file).
2. `npm run next-part -- --from series/<slug>/part1.json --comments votes.csv --out series/<slug>/part2.json` → counts one vote per username, carries the story state (days, budget, built features), adds the **results beat** ("62% of you chose…") and the **names wall** beat.
3. Replace the TODO beat with the new script following the winning choice (same rules, new dilemma), then steps 5–6.
