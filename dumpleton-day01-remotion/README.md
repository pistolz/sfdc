# Dumpleton — Day 01 · Remotion + Three.js recreation

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
