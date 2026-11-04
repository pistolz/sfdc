# Promo playbook — how to make a sales Reel that performs

The goal of every promo: **stop the scroll in 1 s, make one promise, prove it, remove the doubt, ask for one action.** 25–45 s, one sentence per beat, a new picture every 2–5 s.

## 1. The brief (ask once, only what's missing)

| Need | Why | If missing |
|---|---|---|
| Product + who it's for | the promise must name the person | ask |
| The ONE result it gives (time, money, pain, status, taste…) | the hook | ask |
| 3 features or steps | "how it works" beats | infer from the site / photos, confirm |
| Real proof (numbers, reviews, before/after, demo, press) | proof beat | use a demo instead — **never invent** |
| Price / offer / deadline (real) | urgency | skip the price beat |
| 2–3 objections buyers have | the objection beats | use the category defaults below |
| CTA: one comment keyword + what they get in DM, or link in bio | the end | default `Comment <PRODUCT>` + link |
| Brand: accent colour, logo, product photos (transparent PNG), screenshots | the look | pick an accent that matches the product, emoji props |
| Language, voice gender/tone | voice | English, calm confident male or female |

## 2. Hook formulas (beat 1, ≤ 14 words, the visual is on frame 1)

1. **This one X does Y** — "This one app finishes your to-do list in *half the time.*"
2. **Stop doing X** — "Stop paying for *five apps* that do one thing each."
3. **The number** — "*3,214* people switched to this last month." (real number)
4. **The before/after** — "From *messy desk* to this, in ten minutes."
5. **The secret** — "Hotels don't want you to know about *this pillow.*"
6. **The challenge** — "Bet you can't *tell this apart* from the $300 one."
7. **Point at the viewer** — "If you *forget to drink water,* watch this."

Rules: one promise, a concrete word in `*italics*`, no brand name before the promise, no "Hey guys".

## 3. Structures by product type

Each line is one beat. Pick the scene from the right column.

### App / SaaS / AI tool
| Beat | Line pattern | Scene |
|---|---|---|
| Hook | This one app does Y | `ed-sticker` (NAME|APP) + `ed-phone` (screenshot) |
| Objection 1 | First, you might think *it's just another app.* | `ed-qmarks` + `ed-bubble` |
| Answer | You type one line… it plans everything | `ed-prompt` + `ed-build` + `ed-phone` |
| Objection 2 | Second, you might think *setup takes hours.* | `ed-bubble` |
| Answer | Two minutes. You approve, done. | `ed-steps` (APPROVED stamps) |
| Proof | (real) users went from X to Y | `ed-big` / `ed-stat` / `ed-bars` |
| CTA | Comment KEYWORD and I'll send you… | `ed-comment` + `ed-dm` |

### Physical product (gadget, beauty, home, food, fashion)
| Beat | Line pattern | Scene |
|---|---|---|
| Hook | This bottle *glows* when you forget to drink | `ed-product` (PNG, glow) |
| Features | A sensor… a ring… | `ed-product` + 2–3 `ed-callout` (same product, `continue: true`) |
| Difference | Without it… with it… | `ed-compare` or `ed-beforeafter` (real photos) |
| Proof | (real) review / rating / sold count | `ed-review` / `ed-fact` |
| Price | $39 this week instead of $59 (real) | `ed-price` (+ `ed-offer` if there is a real deadline) |
| CTA | Comment KEYWORD for the link | `ed-comment` + `ed-dm` |

### Service / coaching / agency / local business
| Beat | Line pattern | Scene |
|---|---|---|
| Hook | If your *X* looks like this, watch | `ed-beforeafter` or `ed-image` |
| Pain | You've tried A, B and C | `ed-compare` (left column) |
| Method | We do 3 things | `ed-steps` |
| Proof | (real) client result | `ed-big` + `ed-pill` / `ed-review` |
| Objection | You might think it's expensive | `ed-bubble` → `ed-price` or `ed-fact` |
| CTA | Comment KEYWORD for a free audit | `ed-comment` + `ed-dm` |

### Course / ebook / template / info product
| Beat | Line pattern | Scene |
|---|---|---|
| Hook | I got *2 million views* in 12 days (real) | `ed-big` + `ed-stat` |
| Promise | Here's the system | `ed-folder` (label = product, cards fly out) |
| Steps | Step 1… 2… 3… | `ed-check` / `ed-steps` / `ed-terminal` |
| Objections ×2–3 | You might think… | `ed-bubble` (numbered FIRST/SECOND/THIRD, header `OBJECTION n/3`) |
| CTA | Comment KEYWORD and I'll DM you the free part | `ed-comment` + `ed-dm` |

## 4. Craft rules (what makes it look "agency")

- **One idea per screen.** Header label + headline + ONE visual group. Lots of empty paper.
- **The header changes every beat** (`// 03 · how it works` · `STEPS 3`), the right value counts what matters (OBJECTION 1/3, BUILD 4/5, PRICE −34%).
- **Time everything to a word.** `at` = the word that names the thing. Typing starts on `typeAt`.
- **Objections are the engine**: name the doubt in the viewer's words, then kill it with a visual, not a claim.
- **Proof > adjectives.** Replace "amazing" with a number, a screenshot or a demo.
- **Brand theme**: `"theme": { "accent": "<brand colour>", "mascot": false | "<colour>", "paper": "#f4f1ea" }`. The accent replaces the red everywhere (italic words, pills, bars, CTA).
- **Music**: an original bed is made in code (`"music": { "style": "tech" | "warm" | "tense" | "epic", "bpm": 96-120, "gain": 0.9 }`), ducked under the voice, mastered to −14 LUFS. `"music": "none"` if the user will add a trending sound.
- **Voice**: ElevenLabs (exact word timings) or edge-tts (word timings too). Calm, confident, a little fast (+4–8 %).
- **Cover**: the promise in 2 lines with the italic accent word, product name in the pill.

## 5. Approvals (stop and wait for the user)

1. **Script** — the brief recap + the beat table (line · scene · on-screen proof). Fix wording before building.
2. **Look** — `npm run render -- --episode … --still …` on 4–5 key beats + the cover, sent as a contact sheet. Confirm brand colour, product images, layout.
3. **Draft** — `npm run qa` (must show 0 errors, warnings explained), then a draft (`--scale 0.5 --fps 15`) or the final if the user is in a hurry.

## 6. Never

- Invent numbers, reviews, testimonials, "as seen on" logos, fake scarcity or fake deadlines.
- Use competitors' logos or someone else's characters/music.
- Put text below y 1500 or on the right rail (x > 960, y > 900): QA flags it.
