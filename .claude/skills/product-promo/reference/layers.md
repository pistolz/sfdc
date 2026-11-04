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

### Editorial (product promo)
| type | fields |
|---|---|
| `bg` | `preset: "paper"` (off-white with faint grid) |
| `ed-header` | left (`// 01 · the problem`), right (`VIEWS`), value (`2.04M`, red) — mono labels at the top |
| `ed-headline` | text with `*italic red accent*`, revealed word by word while spoken. x 90, y 300, size 66, w 900, `pace` 0.85 |
| `ed-caption` | text (mono, grey) |
| `ed-pill` | text (red rounded label) |
| `ed-sticker` | text (big chunky outlined title), size, rot |
| `ed-terminal` | title, lines[] (string or `{text, color}`) typed, w, h, speed |
| `ed-stat` | title, period, from, to, prefix, suffix, delta, at — dark insights card with a sparkline |
| `ed-phone` | src (image path) or emoji/text/screen — phone mockup |
| `ed-image` | src, w, h — screenshot in a white card |
| `ed-bubble` | badge (`FIRST`), n, small, text (typed) — "you might think…" objection bubble |
| `ed-qmarks` | floating question marks around a bubble |
| `ed-check` | items [{ text, at }] — checklist that ticks on words |
| `ed-steps` | items [{ label, emoji, at, stamp: "word", stampText }] — 2–3 cards (e.g. Story / Look / Draft + APPROVED) |
| `ed-stamp` | text, at, color |
| `ed-comment` | keyword, at — comment field typing the keyword + big red keyword pill (CTA) |
| `ed-mascot` | color, mood (added automatically bottom-right in editorial episodes) |

Images (`src`) are paths relative to the engine folder, e.g. `assets/screenshot.png`.

## Other scenes
- `recap` — `args.results: [{ label, percent, votes, winner }]` (generated by `next-part`).
- `wall` — names of voters (from `start.wall`).
- `comments` — the AI scanning `commenters` and marking them PROTECTED (style ai).
- `ai` style scenes (GAIA): hook boot verdict shutdown mission bunkerai message radio radar decision.
