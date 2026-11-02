# Dumpleton — Day 01 + Day 02 · Remotion + Three.js

Recreation of the Blender reel *Dumpleton — Day 01* with **Remotion 4 + React Three Fiber (`@remotion/three`)**.
Composition `Day01`: **1080×1920, 30 fps, 2568 frames (85.6 s)**, soundtrack `public/final_mix.wav`.

## Run it on Windows 11 (PowerShell, NVIDIA RTX)

```powershell
# 1. Node.js 22 LTS (once)
winget install OpenJS.NodeJS.LTS
# open a NEW PowerShell window, then check:
node -v   # v22.x

# 2. Get the code
git clone -b claude/dumpleton-day01-remotion-i93ffx https://github.com/pistolz/sfdc.git
cd sfdc\dumpleton-day01-remotion
npm install

# 3. Preview / scrub interactively
npx remotion studio

# 4. Stills to compare with reference/stills (t = frame / 30)
npx remotion still Day01 out/f0.png    --frame=0    --gl=angle
npx remotion still Day01 out/f300.png  --frame=300  --gl=angle
npx remotion still Day01 out/f1500.png --frame=1500 --gl=angle
npx remotion still Day01 out/f2300.png --frame=2300 --gl=angle

# 5. Full render on the GPU (final quality)
npx remotion render Day01 out/day01.mp4 --codec=h264 --crf=16 --gl=angle --concurrency=2 --timeout=240000
```

GPU notes:
- `--gl=angle` makes headless Chrome use your RTX through ANGLE/D3D11. This is the recommended option on Windows. `--gl=vulkan` also works on recent NVIDIA drivers; try it if ANGLE gives a black frame. Do **not** use `swiftshader`/`swangle`: they render on the CPU and are about 20× slower.
- `--concurrency`: each tab renders a full 1080×1920 WebGL scene with a 4096 shadow map and HDR post-processing. On an 8 GB RTX 5060, use **2** (try 3 and watch VRAM in Task Manager). Higher values only fight for the same GPU.
- `--timeout=240000`: the first frame in each tab compiles the shaders and builds about 48k trees, which can take longer than Remotion's default 30 s.
- Faster preview render (3D rendered at half resolution, no MSAA; HUD stays sharp):
  `npx remotion render Day01 out/preview.mp4 --codec=h264 --crf=20 --gl=angle --props='{"msaa":0,"renderScale":0.5}'`

## Day 02 (`Day02` composition — 1080×1920, 30 fps, 3377 frames = 112.55 s)

```powershell
npx remotion still Day02 out/d2_400.png --frame=400 --gl=angle
npx remotion render Day02 out/day02.mp4 --codec=h264 --crf=16 --gl=angle --concurrency=2 --timeout=240000
# fast preview: add  --props='{"msaa":0,"renderScale":0.5}'
```

The soundtrack is `public/day02_mix.wav` (your `day02_mix_v6.m4a`). Word timings in `src/data/timeline_day02.json` were measured on that mix with Whisper, and the text was replaced by the official script, so spellings are Lizz, Vip3r, Sea Sphinx, Iker, Counterpart, Avnish, Carly. Every Day 02 event is keyed to a word in `src/day02/timeline02.ts` (`B.*`).

Day 02 continues from the last frame of Day 01: it opens on the same sky shot, and the Day 01 cabin, campfire, steamer and bunting are all still there.
- **Opening:** tilt down to the river, where three bamboo-steamer **boats** come downstream with 50 dumplings each. The crowd (150 instanced dumplings) gets off at the dock and walks into the village. The trees on the dock side are cleared while the boats come in.
- **Characters:** Bao (top hat), **Lizz** (pink knight helmet), **Vip3r** (white armour + big white shield), **Sunny** (witch hat), and 6 knights for the charge.
- **HUD:** RULE #3 NOBODY WALKS ALONE. Counters go 1 → 273 dumplings and 273 → 250 houses. HUNGRY GIANT goes 099 → 098, then "HUNGRY GIANTS ×2".
- **Casino:** Sea Sphinx's most-liked comment card, the forest felled out to 40 m, the "build orders" panel (casino 150 / north wall 40), then the casino: red and gold, dome, neon sign, chasing bulbs, dice.
- **Builds:** north wall, Iker's turret, Counterpart's cannons, Jordan's lab (glowing flask), Avnish's telescope, and ~57 houses popping while the crowd arrives and during the sunset time-lapse.
- **Night:** red eyes in the south treeline, then 40 chili imps advance from the south. Torches light up and the 23 southern houses burn. Bao, Lizz, Vip3r and the knights push the imps back and they run. The burned houses collapse.
- **Morning:** smoking ruins, −23 houses, Carly's stone house still standing, 98 days left.
- **CTA:** ghost houses on the ruins, then the vote card with BAKERY? / BRIDGE? / SOUTH WALL? and matching ghost previews in 3D.
- **End:** back to the opening sky frame (loop). "…wait. There are two of them": two pairs of giant red eyes appear above the mountains.

Day 02 files are in `src/day02/` (timeline02, camera02, light02, Village02, Scene02, HUD02, Day02). They reuse the shared world/post/HUD modules. `node scripts/stills.mjs Day02 0 400 1500` renders a contact sheet.

## How it is built

| File | What |
|---|---|
| `src/timeline.ts` | Loads `audio/timeline_words.json`. **Every** event time comes from it (`wt()`, marks, build beats `T`), as in scene.py / overlay.py. |
| `src/fcurve.ts` | Port of Blender's Bezier **auto-clamped** F-curve evaluation, plus the pop curve (0→1.18→0.93→1). Camera, Mayor path, lights and pops follow Blender's own curves. |
| `src/camera.ts` | Camera keyframes copied verbatim from scene.py `CK()`, Blender Euler XYZ → three `ZYX`, Z-up → Y-up. Checked against `blender/proj.json`: within a few px on most frames (`scripts/camtest.ts`). |
| `src/scene/*` | Procedural world in Blender coordinates (inside one group rotated −90° on X): terrain/river/clearing/rocks/mountains, instanced puff-pine forest (LOD + chunk culling, shaking inner ring), clutter, Mayor Bao and citizens (hop, squash, blink), cabin piece by piece with pops and dust puffs, felled tree, campfire, steamer, steam and smoke, bunting, ghost houses, crowd, hungry eyes, invisible chopstick hand that only casts the giant's shadow, sky, aurora, day→sunset→night→dawn light curves, height fog. |
| `src/post/PostFX.tsx` | Custom pipeline: HDR scene → bloom (threshold 0.8) → port of the ffmpeg `fc.txt` chain (shake crop/rotate, exposure −1.35, contrast look, curves spline, sat 1.15, colour balance, RGB split on giant steps, unsharp, 12 % glow, tilt-shift through the `tsmask.png` profile, vignette π/4 + pulse). |
| `src/hud/HUD.tsx` | Line-by-line port of `overlay.py` to SVG: subtitles (≤3-word phrases, Anton 118, yellow/red keywords, pop), HUD, clock, rule pills, counters, WOOD odometer, HUNGRY GIANT panel 100→99, stats card, rule banners, name tags driven by `proj.json`, +24 WOOD / +1 HOUSE, CTA, MOST LIKED COMMENT card, petals/fireflies, debris, sparkles, jitter. |
| `scripts/compare.mjs` | `node scripts/compare.mjs 0 300 1500 2300` renders frames and puts them under the matching reference frames (needs the reference repo next to `sfdc`). |

Every animation is a pure function of `useCurrentFrame()`. `useFrame` is only used to run the post-processing render, so renders are deterministic.

## Known limitations vs the Blender/EEVEE version
- **Lighting**: Blender's Nishita sky lights the scene like a big sky dome plus a sun disc. Here a hemisphere light plus a boosted key light stand in for it, tuned by eye against the reference. Shadows in sunlit areas are a bit harder and darker, and backlit far trees and mountains are duller.
- **Shadows**: one 4096 PCF-soft shadow map that follows the camera target. Fire and eye point lights cast no shadows, and there is no ambient occlusion (EEVEE has GTAO).
- **Fog**: analytic height-slab fog plus distance haze instead of the noisy volumetric fog. No light shafts and no fog patches lit by the fire.
- **Trees**: same counts (about 48k), but with LOD: the inner ring is full detail, 40–150 m is lighter, and beyond 150 m only crowns are drawn. The noise pattern and random seeds differ from Blender's, so individual tree colours and positions do not match one for one.
- **Motion blur**: none. EEVEE used shutter 0.6, which is visible on the whip pans and the final tilt-up.
- **Camera**: the auto-clamped Bezier port is exact on held shots and within about 30 px during some long moves. The noise shake is similar but not identical.
- **Render time**: on a CPU-only server (software WebGL) it takes about 10 s per frame at full quality and about 2.5 s per frame in preview mode. With GPU and `--gl=angle` expect roughly 0.3–1 s per frame. Blender EEVEE took minutes per frame for the final.

To close the gap: bake a PMREM of an actual Nishita/Preetham sky each frame (`scene.environment`) instead of the hemisphere light, add N8AO/SSAO and a motion-blur pass (or render at 4× fps and frame-blend), use cascaded shadows, add point-light shadows for the fire, and use a raymarched fog pass.
