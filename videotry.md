# videotry — Complete kit for the "STUCK AT 5:58" series

> Everything is in this repo: code, images, characters, voice, sounds, script, method.
> Someone who has never seen the project should be able to produce the next episode by following this file.
> Code: `reels-studio/` · Episode 1: composition `StuckAt558-Day1` (45 s, 1080×1920, 30 fps).

**⚠️ Current method = "LAYERED" (stage-set).** The first version (one big picture that the camera zooms over) is **abandoned**: it looked like a slideshow. Now the **backgrounds are still** and the **characters are cut out and move** on top, like in the reference reels. Everything below describes the current method.

---

## 1. Video type (the format)

**"Day N" series of the "survival + HUD + rules" type**, inspired by two reference reels ("Forest of Infinite Wood" and "Pokémon World Day 1") but with **100% original IP**.

| Format element | Why it works |
|---|---|
| **HUD on top of the image** (day, clock, counters, countdown) | "Systems to watch": you keep watching to see the numbers move |
| **Numbered rules** ("RULE #1…") pinned in the HUD | The series' memory, a checklist for the viewer |
| **Long countdown** (100 nights) | A reason to follow the series |
| **2–3 word captions**, keyword in yellow or red | Readable without sound, rhythm |
| **Fast, concrete voice-over** | Credibility + tension |
| **Hook < 3 s** | Stops the scroll |
| **Characters that move on a fixed background** | Feels like a cartoon, not a slideshow |
| **Cliffhanger + double participation** | Follow = your name in the story; comment = you choose what comes next |
| **Duration 35–50 s** | 90 s is too long for a Reel |

---

## 2. Theme and universe: STUCK AT 5:58

**Pitch:** *Time stopped at 5:58 in a town of 4,012 people. Every time you sleep, the world moves forward exactly one second. The 6:00 alarm is 100 nights away. And something else is awake.*

### The world: Dunmoor
- A small rainy British-style town, clock frozen at **5:58:20 AM**, **rain hanging in the air**, lightning frozen above the clock tower.
- **4,012 inhabitants frozen** mid-stride, eyes closed, sleepwalking, phone in hand. Every phone: **ALARM 6:00 AM**.
- Only **you** move: the **hero in the yellow raincoat** (instantly recognizable).

### The physics (never break it)
1. **The tick:** each sleep = **+1 second**. 5:58:20 → 6:00:00 = **100 nights**.
2. **What you push stays pushed:** walking through the rain leaves a **tunnel**.
3. **Packed rain = glass** that glows orange: it's the building material.
4. **Sleepers take 1 step per tick.**
5. **Something else is awake.** It only moves **while you sleep**; its tunnels are 2 m tall.
6. **At night 100 the alarm rings**: the town wakes up.

### Rules (max 3 visible in the HUD)
- Rule #1: **Never walk inside its tunnel.** (Day 1)
- Upcoming: "Photograph the room before you sleep", "Take nothing from a sleeper's hand", "Never sleep facing the glass", "Count the steps every morning".

---

## 3. Episode 1 script (116 words, 40 s of voice)

File: `reels-studio/episodes/stuck-at-558/narration.txt`

| Time | Voice-over | Scene (background + characters) | HUD / event |
|---|---|---|---|
| 0.0 | *Time stopped at five fifty-eight. Something didn't.* | **b1** square. Frozen pigeon (trembles in place), 2 frozen sleepwalkers, **the hero walks in** from the bottom of the frame | "STUCK AT 5:58 / DAY 1" title card (0–1.4 s) |
| 3.1 | *Day one. Four thousand people, frozen mid-stride. Eyes closed.* | **b2** street. Sleepwalkers **breathe but don't step**, the hero **walks off into the depth** between them | HUD appears at 1.5 s |
| 7.2 | *Every phone, the same alarm. Six A.M.* | Animated phone: 5:58, 3% battery, "ALARM 6:00 AM, in 1 min 40 s" | Alarm beep |
| 9.9 | *And every time you sleep, the world moves one second. That's one hundred nights. Survive until it rings.* | **b1** square, hero facing camera (proud pose), switches to the **scared pose + jump + trembling** on "Survive" | **ALARM IN 100 NIGHTS** card in the center, then docks top right |
| 15.2 | *Push the rain, it stays pushed. Every path leaves a tunnel. But this one isn't yours. Two metres tall. And it ends at your door.* | **b3** tunnel. The hero **walks in from the left**, **jumps** on "But", red **"!"** above the head, trembles | Sub-bass hit |
| 22.4 | *Rule one. Never walk inside its tunnel.* | Same shot | **RULE #1** card: slides in, words light up, docks into the HUD |
| 25.0 | *So you build. Rain packs into glass. A wall by midnight. Three sleepers inside.* | **b4** shelter. The hero walks in, **the glass rises** from bottom to top, **the 3 sleepers pop in** one by one behind the glass, the hero jumps each time | SAFE 0→1→2→3, the "YOU" watch speeds up |
| 30.1 | *You sleep.* | Black eyelids close | Riser + sub |
| 32.0 | *Five fifty-eight, and twenty-one.* | Flash, zoom on the lightning (b1) | Clock **20 → 21 in red**, countdown **100 → 99** |
| 33.2 | *The woman at your glass took three steps. She's facing you.* | **b5** window. The woman **jerks closer 3 times** (no walking: she is just closer each time), heartbeat, red vignette | |
| 36.5 | *Follow, and tomorrow a sleeper gets your name. Day two starts now.* | b4 shelter (final state) + **SAVE THE SLEEPERS! / 1 FOLLOW = 1 SLEEPER SAVED** + "YOUR NAME?" tags above the sleepers | HUD hidden |
| 40.3 | (silence) | **OPEN THE GLASS / OR STAY INSIDE?**, OPEN / STAY buttons, COMMENT BELOW | |
| 42.6 → 45 | (silence) | **STUCK AT 5:58 / DAY 2 / FOLLOW FOR DAY 2** | |

**Writing rules:**
- 105–125 words for about 45 s. Short sentences, fragments, present tense, "you".
- Concrete numbers everywhere, written the way the voice should say them ("five fifty-eight", "six A.M.").
- Every number spoken = **visible in the HUD**.
- Structure: hook → setup → countdown → mystery → rule → build → sleep + tick → twist → CTA.
- **Every sentence must give a character something to do** (walk, jump, get scared, appear). If nothing moves, rewrite.

---

## 4. Visual style and animation: the LAYERED method

### Principle
```
[ STILL background (no characters) ]  +  [ cut-out characters (transparent PNG) ]  +  [ effects ]  +  [ HUD + captions ]
          layers/bX.jpg                           layers/cX.png, animated in code         rain, glass, flash
```
- The background **does not move** (except one exception for an intended effect: the zoom on the lightning at the tick).
- The characters **move**: they walk, breathe, jump, tremble, change pose, appear.

### Image style
- **2D cartoon / indie game**: simple shapes, flat colors, soft shading, thick outlines, **big-head (chibi)** characters.
- Palette: **night blue + orange/amber**. Red = danger only.
- Hero: **small kid in a bright yellow raincoat with the hood up, yellow boots, short dark hair**.
- No realism (rejected: it doesn't match the references).

### Episode 1 assets (in git: `reels-studio/public/layers/`)

| File | Content | Used in |
|---|---|---|
| `b1.jpg` | Empty square, clock tower, frozen lightning, street lamps | hook, rules, tick |
| `b2.jpg` | Empty wet street at dawn, street lamps | sleepwalkers |
| `b3.jpg` | Dark street, tall silhouette tunnel through the rain, pharmacy at the end | tunnel |
| `b4.jpg` | Pharmacy doorway sealed by glowing orange glass, empty inside | shelter, CTA |
| `b5.jpg` | Window with orange frame seen from inside, night street | the woman, ending |
| `c1.png` | Hero **from behind** | walks into the scenes |
| `c2.png` | Hero **facing camera, proud** (hands on hips) | listens, builds |
| `c3.png` | Hero **scared** (raised hands, sweat) | "Survive" |
| `c4.png` | Sleepwalker man, dark coat, phone | street, shelter |
| `c5.png` | Sleepwalker woman, beige trench coat, phone | street, shelter |
| `c6.png` | Pale woman, long hair, grey raincoat, hand on the glass | cliffhanger |
| `c7.png` | Pigeon frozen mid-flap | square |

### Image prompts (copy them word for word, only change the scene)

**Style sentence (never change it):**
> *2D cartoon illustration in the style of an animated YouTube story channel / cozy indie game: clean simple shapes, flat colors with soft cel shading, thick soft outlines, chibi proportions with big heads.*

**BACKGROUND (format 9:16):** style sentence + `Vertical background scene with NO people and NO animals: <the place>, raindrops frozen in mid-air as shiny beads, warm yellow street lamps, <empty foreground ground>. No text, no letters.`
- Always say **NO people** and leave the **bottom half empty** (that's where the characters go).

**CHARACTER (format 1:1):** style sentence + `<the character + the pose>, full body. Centered, completely isolated on a plain pure white background, no ground, no shadow, no text.`
- Hero: *A small kid hero with short dark hair in a bright yellow raincoat with the hood up and yellow rubber boots, <facing the viewer / seen from BEHIND>, <pose / expression>*.
- **One pose = one image.** To animate a pose change, generate 2–3 poses of the same character.

### Animations available in the code (`src/lib/Layers.tsx`)

| Component / option | Effect |
|---|---|
| `<Bg src="b1.jpg" />` | Still background (optional `zoom={[from, to, x%, y%]}` for a deliberate zoom) |
| `<Char src x y h />` | Character placed **by the feet** (x, y in px) with a height h in px. x, y, h accept keyframes `[[frame, value], …]` → move, approach, walk away |
| `walk={[[from, to]]}` | Walk cycle (bounce + waddle) between those frames |
| `breathe` (on by default) | Idle breathing |
| `hops={[frame,…]}` | Little jump (pose change, reaction, joy) |
| `shake={[from, to]}` | Trembling (fear; frozen pigeon) |
| `popAt={frame}` | Spring pop-in appearance |
| `show={[from, to]}` | Visible only during that window (useful for **swapping poses**: c2 then c3) |
| `flip`, `grade`, `opacity`, `shadow` | Mirror, color filter (night, behind glass), transparency, shadow under the feet |
| `<Alert x y at />` | A red "!" that pops above a head |
| `<GlassFill rect from to />` | Glass wall rising from bottom to top |
| `FrozenRain` (Episode.tsx) | Drops that **don't fall**, they only glint |
| `Eyelids`, `Flash`, `HeartbeatVignette` | Sleep, tick, tension |

**Animation rules:**
- Sleepwalkers: `breathe`, but **never** `walk` (time is frozen; only the hero moves).
- The "thing" / the woman: **never walk smoothly**. They **jump** from one position to another between two shots (creepier).
- Characters behind glass: `grade="sepia(0.55) saturate(1.4) brightness(0.92)"`, `opacity 0.88`, `shadow={false}`.
- At night, every character: `grade="brightness(0.86) saturate(0.95)"` (the default) so they don't stand out from the background.
- Keep faces between y = 420 and 1100 when possible (between the HUD and the captions).

### Captions (measured on the references)
- **Anton** font 112 px, centered at **y = 1291**, 8 px black outline + drop shadow.
- White `#FAF9F9`, **yellow `#F5D65B`** = positive/goal, **red `#DC5F52`** = threat. In the code: `[Y]word[/Y]`, `[R]word[/R]`.
- Pop-in: 1st frame at 50%, scale 0.92 → 1 over 3 frames, hard cut on exit.

### HUD
- Top left (x 64, y 262): red dot **17 frames on / 13 off**, "DAY 1", big frozen clock (the seconds twitch), "TOWN OF DUNMOOR · YOU: 6:14 AM".
- Top right: **SAFE x / 4012**, then the 7-segment **ALARM IN … NIGHTS** card.
- Rules: red tag + text, under the clock.
- **Safe zones**: nothing important at y < 250 or y > 1500.

---

## 5. Technologies

| Need | Tool |
|---|---|
| Editing / animation | **Remotion 4** (React + TypeScript), everything is code |
| Images | **AI generation via Canva** (backgrounds 9:16, characters 1:1 on a white background), exported at full resolution (`tools/IMAGE_PIPELINE.md`) |
| Character cut-out | **`tools/cutout.py`** (local, free): removes the white background → transparent PNG trimmed to the character |
| Voice | **edge-tts**, voice `en-US-GuyNeural`, speed +22% (alternatives: Kokoro locally, ElevenLabs for paid quality) |
| Word timing | native edge-tts → `words.json` |
| Pauses | `tools/tighten_pauses.py` (max 0.24 s between sentences) |
| Sounds | `tools/sfx/synth.py` (27 synthesized sounds) + Kenney CC0 sounds |
| Mastering | ffmpeg `loudnorm` → **-14 LUFS**, peak -1.5 dB |
| Fonts | Anton + Oswald (`public/fonts/`) |

### Folder layout
```
reels-studio/
  src/
    Root.tsx                 ← list of episodes (compositions)
    lib/style.ts             ← colors, fonts, outline
    lib/Caption.tsx          ← captions (chunks + pop)
    lib/Layers.tsx           ← LAYERED ANIMATION: Bg, Char, Alert, GlassFill
    lib/SevenSeg.tsx         ← 7-segment digits
    stuck558/Episode.tsx     ← Episode 1: timeline T, CHUNKS, scenes, HUD, cards, sounds
  public/
    layers/b1..b5.jpg        ← backgrounds (no characters)
    layers/c1..c7.png        ← cut-out characters
    audio/ep1/               ← voice.wav, words.json, captions.json
    audio/sfx/               ← generated sounds (python3 tools/sfx/render_bank.py)
    fonts/
  episodes/stuck-at-558/narration.txt
  tools/tts_pipeline.py · tools/tighten_pauses.py · tools/cutout.py · tools/sfx/ · tools/IMAGE_PIPELINE.md
```

---

## 6. Making the next episode, step by step

### 0. Install (once)
```bash
cd reels-studio
npm install
pip install edge-tts soundfile numpy scipy pillow faster-whisper
python3 tools/sfx/render_bank.py      # regenerates the sounds (wav files are not in git)
```
On your machine, delete the `Config.setBrowserExecutable(...)` line in `remotion.config.ts` (it points to a Chrome specific to my environment).

### 1. Script
`episodes/stuck-at-558/day2.txt`, 105–125 words (section 3). In the margin, note **what each character does** in each sentence.
Check: clock **5:58:21 → 22**, countdown **99 → 98**, SAFE, rules already established.

### 2. Voice
```bash
python3 tools/tts_pipeline.py --text episodes/stuck-at-558/day2.txt --out /tmp/vo2 \
  --engine edge --voice en-US-GuyNeural --rate +22%
python3 tools/tighten_pauses.py /tmp/vo2 public/audio/ep2 --max 0.24 --keep "twenty-two.=0.7"
python3 -c "import json;[print(w['w'],w['s']) for w in json.load(open('public/audio/ep2/words.json'))]"
```
Target 38–42 s. The last command prints the time of every word (you'll need it for the animations).

### 3. Images
1. List the **places** (backgrounds) and **characters + poses** needed. **Reuse** b1–b5 / c1–c7 as much as possible (consistency + savings).
2. Generate the new ones with the prompts in section 4 (backgrounds 9:16, characters 1:1 on white).
3. Export them at full resolution (`tools/IMAGE_PIPELINE.md`): backgrounds 1080×1920 → `public/layers/bX.jpg`, characters 1024×1024 → temporary file.
4. Cut out each character: `python3 tools/cutout.py raw.png public/layers/cX.png`
5. Look at the result: if the edges are white or a piece is missing, regenerate with "plain pure white background, thick dark outline".

### 4. Animate (code)
- Copy `src/stuck558/Episode.tsx` → `src/stuck558/Day2.tsx`, change the `words.json` import.
- **`T`**: the key moments in seconds (read from words.json).
- **`CHUNKS`**: the captions (text shown + number of spoken words; the total must equal the voice's word count, otherwise you get a clear error).
- **Scenes**: in each `<Shot from to>`, one `<Bg>` + the `<Char>` with their animations (section 4 table). Example:
  ```tsx
  <Shot from={T.shot3} to={T.shot4}>
    <Bg src="b3.jpg" />
    <Char src="c1.png" x={[[0, -160], [50, 360]]} y={[[0, 1790]]} h={[[0, 600]]}
          walk={[[0, 50]]} hops={[r(T.tunnelHit, T.shot3)]} />
    <Alert x={360} y={1150} at={r(T.tunnelHit, T.shot3)} />
  </Shot>
  ```
  (`r(time, shotStart)` converts an absolute time into a frame inside the shot.)
- **HUD**: DAY 2, seconds, SAFE, countdown, rules.
- **Sounds**: `SFX` list `[file, time, volume]`.
- Add `<Composition id="StuckAt558-Day2" …>` in `Root.tsx`.

### 5. Preview, render, mastering
```bash
npx remotion studio src/index.ts                                   # live preview
npx remotion still src/index.ts StuckAt558-Day2 out/test.jpg --frame=300   # one frame to check
npx remotion render src/index.ts StuckAt558-Day2 out/day2.mp4      # ~10-15 min
ffmpeg -i out/day2.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=7" -c:a aac -b:a 192k out/day2_final.mp4
```

### 6. Publishing
- Caption: the question + choice ("OPEN or STAY? 👇") + `#StuckAt558 #Day2 #story`.
- **Pin a comment** that restates the vote.
- Note the answers + new followers → they feed the next episode.

---

## 7. What comes next in the story

### Participation (it has to be visible on screen)
- **Follow = saved sleeper**: in the next episode, show the **real names** on the wrists ("comment WRIST to get your name") + a **NAMED** counter in the HUD.
- **Comment = decision**: every episode ends with a binary choice; the next one **opens on the result** ("61% said STAY. So we stayed.").

### Day 2 (draft)
- **Hook:** *"Look at the glass. Five fingerprints. Her hands never left her phone."*
- Vote result, real names on 3 wrists, NAMED counter.
- Rule #2: **"Photograph the room before you sleep."**
- Action: widen the wall, +2 sleepers (SAFE 3 → 5). The hero carries them (c1/c2 walking + sleepers sliding along).
- Sleep → **5:58:22**, countdown **98**.
- Twist: in the morning's photo, a **4th sleeper** is standing inside the glass… and you never brought her in.
- Choice: "WAKE HER or LOCK HER OUT?"
- **New assets**: b6 (shelter interior), c8 (hero carrying a sleeper), c9 (phone screen with photo), c10 (the 4th sleeper).

### Arc over 100 nights
| Nights | Phase | What happens |
|---|---|---|
| 1–10 | **Shelter** | Glass house, first rules, the tunnels get closer |
| 11–25 | **Map** | Exploring Dunmoor; the tunnels draw a pattern on the map |
| 26–40 | **The other** | A silhouette in a photo; it **copies your rules** |
| 41–60 | **Survivors** | Another awake person: ally or the thing? (big vote) |
| 61–80 | **The lightning** | The bolt gets closer to the tower with every tick; it strikes at night 90 |
| 81–99 | **Countdown** | Saving as many sleepers as possible, the tunnels surround the glass |
| 100 | **6:00:00** | The alarm rings… the thing was **the 4,013th inhabitant**, the one nobody counted ("POP. 4,012" seeded from Day 1) |

### Recurring hooks
- Open on **a detail that changed** since the last tick.
- One new number per episode.
- Always end with: **tick + twist + choice + "DAY N+1"**.

---

## 8. Checklist before publishing
- [ ] Hook < 3 s, with a question in the viewer's head
- [ ] 35–50 s
- [ ] **Still backgrounds, characters that move** (at least one action per sentence)
- [ ] Every number spoken = visible in the HUD
- [ ] Clock and countdown consistent (+1 second, −1 night)
- [ ] Max 3 rules
- [ ] Captions 2–4 words, 1 colored keyword max
- [ ] Nothing important at y < 250 or y > 1500
- [ ] Follow CTA + comment CTA + "DAY N+1" card
- [ ] Sound at -14 LUFS, voice clearly audible
