# viral-formats — code-only reel formats

```
npm install
node scripts/render.mjs --scene dominoes                      # OVERTHINKER vs DOER, 3D silhouettes, 16.7 s loop
node scripts/render.mjs --scene seek --seed 7                 # "Only 1% can find Pumpkin Kitty", new scene per seed
node scripts/render.mjs --scene seek --seed 7 --reveal 1 --still 1   # solution image (red circle)
node scripts/render.mjs --scene beehive --seed 3                  # "Only 1% can find the 5 royal bees", all-bee hive tree (--crowns 7, --beeScale 1.2, --title "...")
```
Options: `--fps 30`, `--still 2,8` (frames only), `--chrome PATH`, `--gl gpu` (use your GPU on Windows: faster), `--name "Honey Kitty"` (seek).
Videos are exported with a silent track: add a trending sound in Instagram / TikTok when you post.

## AI illustration + code (premium look)
1. Generate the scene (9:16) and the target character (plain white background) with an image generator.
2. Put them in `web/assets/`, pick hiding spots, then:
```
node scripts/render.mjs --scene aiseek --bg /assets/bee-village.png --sprite /assets/bee-crown.png \
  --spots '[[300,690,98,0.05,0],[470,935,92,-0.08,1]]' --title "Only 1% can find 5 royal bees" --emoji 👑
```
`--spots` = [x, y, height px, rotation rad, flip]; the target is cut out, colour-graded to the scene and animated.
Add `--reveal 1 --still 1` for the solution image.
