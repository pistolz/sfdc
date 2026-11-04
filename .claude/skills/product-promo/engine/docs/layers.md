# Episode file & layer reference (reel-engine)

An episode is one JSON file. The video is a list of **beats**; each beat is **one sentence of voice-over** and lasts as long as that sentence (plus `hold`). Everything on screen is timed to words of that sentence with `"at": "<word or phrase from say>"`.

## Episode

```json
{
  "series": "LAST ISLAND",            // shown at the top (story styles)
  "part": 1,
  "style": "story",                   // story | ai | editorial
  "voice": { "name": "en-US-AndrewNeural", "rate": "+4%", "pitch": "+0Hz" },
  "hud": { "days": { "label": "DAYS UNTIL ERUPTION" }, "budget": { "label": "SUPPLIES" } },   // or false to hide one
  "start": { "days": 30, "budget": 5000, "budgetVisible": false, "features": [] },
  "cover": { "html": "<div class=\"cover-part\">PART 1</div><div class=\"t\">TITLE <span class=\"y\">KEY</span></div>" },
  "coverTime": 0.5,                   // frame used behind the cover title
  "mascot": { "color": "#f03828" },   // editorial only (false = none)
  "commenters": [ { "name": "@user", "text": "comment" } ],   // for the "comments" scene
  "beats": [ ... ],
  "choice": { "question": "...", "options": [ { "id": "a", "label": "OPTION A", "short": "A", "color": "green", "match": ["a", "option a"] } ] },
  "ctaNext": "PART 2 DEPENDS ON YOU",
  "endHold": 2.5
}
```

## Beat

```json
{
  "id": "07",                          // unique, 2 digits; voice file = voice/<episode>/07.mp3
  "scene": "compose",                  // compose (generic) | recap | comments | wall | ai-style scenes
  "say": "Exact voice-over sentence.",
  "voice": { "name": "en-US-AvaNeural", "rate": "-10%", "pitch": "-8Hz" },   // optional: another character
  "min": 1.6, "hold": 0,               // min duration / extra seconds after the voice
  "continue": true,                    // compose: no cut transition from the previous beat
  "sfx": "alarm",                      // whoosh is automatic on cuts; also: alarm glitch beep heartbeat hit thud cash build
  "glitchAt": "word",                  // style ai: glitch on that word
  "events": [
    { "at": "word", "days": 150 },               // HUD days counter
    { "at": "word", "showBudget": true },
    { "at": "$65,000", "spend": 65000, "label": "SOLAR" }   // budget goes down + "ka-ching"
  ],
  "keys": [                            // on-screen captions (DOM text, timed to words)
    { "at": "word", "slot": "lower", "style": "white", "html": "STAY OR <span class='y'>RUN?</span>", "speaker": "#f5c542" }
  ],
  "args": { "camera": { "from": [540, 960, 1], "to": [540, 1000, 1.08], "shake": "word" }, "layers": [ ... ] }
}
```

- **keys**: `slot` top (y≈300) | upper (470) | center (860) | lower (1290) | bottom (1440). `style` big | white | yellow | cyan | red | green | small | tag | stamp-red | stamp-green. In `html`, `<span class='y'>` yellow, `'c'` cyan, `'r'` red, `'g'` green. `offset` (seconds) instead of `at`; `"instant": true` = visible on frame 1 (use for the hook). `speaker` = coloured bar showing who talks.
- Keep the **bottom 20 % (y > 1540)** and the right edge free of text: Instagram's UI covers it.

## Layers (`scene: "compose"`)

Drawn in order (first = back). Canvas is 1080×1920. Common fields:

| field | meaning |
|---|---|
| `x`, `y` | centre in px (default 540, 960) |
| `s` / `size` / `w`,`h` | scale or size depending on the type |
| `at` / `delay` | appear on that spoken word / after N seconds |
| `out` | disappear on that word (or a number of seconds) |
| `anim` | entrance: pop (default) · fade · up · down · left · right · drop · grow · none |
| `loop` | idle: bob · float · shake · pulse · spin · sway · breathe · blink · flicker |
| `move` | `{ "to": [x, y], "at": "word", "dur": 1.2 }` |
| `alpha`, `rot`, `flip` | opacity, rotation (rad), mirror |

### World / story
| type | fields |
|---|---|
| `bg` | `preset`: day dusk sunset night space indoor underground ocean forest desert snow tech storm paper blood · or `colors: [top, bottom]` · `grid: true` |
| `sun`, `moon` | x, y, r |
| `mountains` | y, color, snow, seed |
| `ground` | y, `preset`: grass sand snow street floor water dirt stone · or color |
| `trees` | y, n, s, color, seed |
| `city` | y, lights 0..1, ai 0..1 (screens show an AI eye), dark |
| `house` | x, y (ground line), w, lights, smoke, sold |
| `particles` | `preset`: snow rain fireflies embers ash bubbles petals stars data |
| `vignette` | amount · `tint`: color, pulse |
| `person` | x, y (feet), s, `look: { top, pants, hair, skin, hat, coat }`, `mood`: neutral happy worried shock, `wave`, `walk`, `phone`, `facing` (-1 = left) |
| `family` | x, y, s (3 worried people, one with a glowing phone) |
| `emoji` | `char` (any emoji: 🌋 ⛵ 🧟 🐉 🏰 🚀 💰 📱 …), size (px). **The main prop library.** |
| `icon` | `name`: phone car camera bank grid food water home power solar plant question money · `infected`, `crossed: "word"` |
| `globe` | r, infection 0..1 · `eye`: r, color "red" · `robot`: size, mood · `drone`: s, color |
| `price` | label, price, at (price tag pop) |
| `label` | text, size, color, font (Anton), stroke |
| `number` | from, to, prefix, suffix, size, at, count (s) · `style: "editorial"` for black serif-less digits |
| `bar` | from, to (0..1), w, h, color, text, at |
| `bubble` | text (typed), w, h, tail left/right, dark, size, at |
| `screen` | lines[] (typed, monospace), w, h, color, at — phones/TVs/warnings |
| `choices` | `options: [{ label, color: green yellow red blue purple }]` — numbered options that light up in turn (episode ending) |
| `clock` | day, time, place — game-style clock stamp (place it top-left below the HUD, e.g. x 70, y 360) |

### Editorial (product promo) — measured on pro "tech creator" reels

Layout rules (1080×1920): mono header at y≈290 · headline at x=132, y≈404 (2–3 lines max) · **one** visual group centred between y 520 and 1240 · the mascot sits centre-right at (735, 1360) on every beat · nothing below y 1500. Beats are **not cut**: paper, header and mascot stay, content swaps with a quick "settle" (slightly bigger → normal). Words fade from grey to ink while spoken.

| type | fields |
|---|---|
| `bg` | `preset: "paper"` (off-white, faint 72 px grid) |
| `ed-header` | left (`// 03 · made with code`), right (`CAMERAS`), value (`0`, red) |
| `ed-headline` | text with `*italic red accent*`; revealed word by word over the voice (`pace` 0.92, `at`, `until`, `instant`) |
| `ed-sticker` | text with `|` before the red word(s) (`ONE|SKILL`), size, rot, color — chunky outlined title with hard shadow |
| `ed-folder` | label, w, `openAt` + `cards: [{ emoji, text }]` (cards fly out of the folder) |
| `ed-code` | title (filename), label (`CODE` above), lines[] — syntax-highlighted, typed |
| `ed-prompt` | title, text, `typeAt` — one-line terminal "> idea … sent" |
| `ed-build` | title (`building`), items [{ text, at }] — progress card that ticks items on words + red bar |
| `ed-check` | same as ed-build with title `checklist` |
| `ed-phone` | w, label (`REEL` above), `src` screenshot or title/emoji/top/bottom colours, `buttons: [{text, color}]`, `bars: true` |
| `ed-arrow` | len — dashed animated arrow (between code → phone) |
| `ed-image` | src, w, h — screenshot in a white card |
| `ed-pill` | text, `icon` (emoji), `crossed`, `red`, `mono: false` — neo-brutalist pill with hard shadow |
| `ed-bubble` | badge (`FIRST`), n, small (`you might think`), text, `typeAt` — objection bubble, appears empty with a red cursor then types |
| `ed-qmarks` | floating grey question marks (put it before ed-bubble, same x/y) |
| `ed-stat` | title, period, `tiles: [{ label, value, prefix, suffix }]`, dates[], at — dark insights card with a spike chart |
| `ed-big` | from, to, prefix, suffix, size, at — big ink number counting up |
| `ed-steps` | items [{ label, emoji, at, stamp: "word", stampText }] — 2–3 brutal cards with APPROVED stamps |
| `ed-stamp` | text, at, color |
| `ed-comment` | keyword, `typeAt` — comment field typing the keyword + big red keyword pill (CTA) |
| `ed-dm` | handle, message, link, at — Instagram DM card |
| `ed-mascot` | automatic; per beat `"mascotMood": "happy" | "shock" | "sad" | "wink"`, `"mascot": false` to hide |

Sound in editorial: soft pops on appear, keyboard clicks while typing, a swish between beats, no music bed (add a trending sound in the app) — `"music": "drone"` to force the tension bed.

Images (`src`) are paths relative to the engine folder, e.g. `assets/screenshot.png`.

## Other scenes
- `recap` — `args.results: [{ label, percent, votes, winner }]` (generated by `next-part`).
- `wall` — names of voters (from `start.wall`).
- `comments` — the AI scanning `commenters` and marking them PROTECTED (style ai).
- `ai` style scenes (GAIA): hook boot verdict shutdown mission bunkerai message radio radar decision.
