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
