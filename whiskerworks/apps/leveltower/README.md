# Level Tower · live tower (`tower.whiskerworks.games`)

The live "state of the game" page for the **Level Tower** video series (Instagram / TikTok / YouTube):
**1 like = 1 floor, and your comments pick the world.** Vite + TypeScript + three.js, no framework. Static output in `dist/`.

Every like stacks one more floating island on the tower. People comment a world (`lava`, `ice`, `neon city`, `🍭`…),
and the next free floor is built in that world with their `@handle` on its sign. Anyone can search their handle:
the camera rides the spiral staircase to their floor, the island glows and its sign pops.

## Daily workflow

```bash
# 1. likes of the latest episode → floors (set the day's total, or --add to it)
npm run tower -w @whiskerworks/leveltower -- likes 154 --day 4

# 2. comments of the latest episode → world picks (CSV: id,handle,text,timestamp — or a JSON array)
npm run tower -w @whiskerworks/leveltower -- import ~/Downloads/day4-comments.csv --day 4 --dry-run   # preview
npm run tower -w @whiskerworks/leveltower -- import ~/Downloads/day4-comments.csv --day 4
#    (a CSV of likers — one row per like with a handle column — also works: --kind likes)

# 3. move the series forward and register the episode
npm run tower -w @whiskerworks/leveltower -- next-day
npm run tower -w @whiskerworks/leveltower -- episode --day 4 --title "Into space" --summary "…" \
  --instagram https://www.instagram.com/reel/… --latest

# 4. build + deploy (state.json and og.png are regenerated on build)
npm run build -w @whiskerworks/leveltower
```

| command | what it does |
| --- | --- |
| `build` | ledger + series → `public/data/state.json` |
| `likes <n> [--day d] [--add]` | set (or add to) a day's like count |
| `add <world> <@handle> [--day d]` | one manual world pick |
| `import <file> [--day d] [--kind comments\|likes] [--dry-run]` | import comments (world parsed from text) or likes |
| `match "<comment>"` | test the world parser (words in en/fr/es/de + emoji) |
| `optout <@handle>` | show a handle as "anonymous" everywhere |
| `day <n>` / `next-day` | set the current day |
| `stats` | totals, top builders and world counts |
| `seed-demo` | replace the ledger with demo data (ships this way) |
| `reset --yes` | empty the ledger before Day 1 goes live |

**Live data since 2026-10-30:** the ledger holds the real tower (67 floors from the Day 1 Instagram likes, 11 named floors).
The old demo data was replaced; `seed-demo` would bring it back, so don't run it.

### Add a real floor (example: floor 68)

```bash
T="npm run tower -w @whiskerworks/leveltower --"
$T likes 12 --day 2                                  # Day 2 got 12 likes → 67 + 12 = 79 floors
$T add lava @someone --floor 68 --day 2 --text "floor 68 lava pls"     # existing world, comment shown as typed
$T custom "Pizza Party" @other --like candy --emoji 🍕 --day 2 --text "pizza floor!"   # quick label on an existing look
$T world-new pizza "Pizza Party" --like candy --emoji 🍕 --colors "#ffd27a,#e0703a,#7a4a2c,#ff3a1a" --aliases "pizza"  # a real new world
$T next-day && $T episode --day 3 --title "…" --summary "…" --instagram https://www.instagram.com/ads_noads/
npm run build -w @whiskerworks/leveltower
```

`--text` is the comment exactly as typed (shown on the floor panel); `--ts` (ISO time) sets the comment order.
Floors nobody picked are plain coloured floors (`"openWorld": "plain"` in `data/series.json`).
Built-in prop sets ported from the Day 02 video: `blocks`, `obby`, `disco`, `battle`, `mystery`, `stage`, `bluetrees`,
`kitchen`, `football` (use with `world-new … --props <set>`). `node scripts/named-from-ledger.mjs` prints the video's `NAMED` array from the ledger.

### Rules

- Floors = total likes (minimum 1). Floor 1 is the Grassland base.
- Picks are handed out in comment order: the first pick builds floor 2, the next floor 3, and so on.
  Picks beyond the current floor count wait in the **queue** (shown on the builder's panel and on the ghost floor above the top).
- Floors nobody picked get a rotating world ("open world").
- Worlds live in `src/themes.json` (id, colours, aliases, emoji). Add aliases there to teach the parser new words.

## Custom requests: you choose the path each time

Comments that name no known world ("pac-man theme please", "minecraft floor"…) are not lost. `import` keeps them in
`data/requests.json`.

```bash
npm run tower -- requests        # list them, numbered
```

For each one, pick a path:

| Path | Command | Result | Time |
| --- | --- | --- | --- |
| **Option 1 · custom label** | `npm run tower -- custom --request 1 --like neon --label "Arcade Maze" --emoji 🟡` | The floor sign, panel and search show "Arcade Maze" and the commenter's name; the island borrows the look of an existing world (`--like`). | instant |
| **Option 2 · new world** | `npm run tower -- world-new arcade-maze "Arcade Maze" --like neon --emoji 🟡 --colors "#1b1b6b,#2a2aa0,#11113d,#ffd23f" --aliases "maze,arcade" --from-label "Arcade Maze"` | A real world with its own colours and aliases (future comments are recognised automatically). `--from-label` upgrades the option-1 floors that used that name. | 1 min |
| Option 2+ · unique props | add a `"kit"` to the world in `src/themes.json` (below) | Its own 3D props instead of the borrowed ones. | 5–15 min |
| Ignore | `npm run tower -- dismiss 1` | | |

Add `--floor 5` to `custom` or `add` to **reserve a specific floor** ("make floor 5 …"). The first request for a number
gets it, and the floor waits in the queue until the likes reach it. You can also type a label directly:
`custom "Block World" @zed --like grassland --emoji 🧱`.

### Kit: a world's 3D props in JSON (no code)

```json
{ "id": "arcade-maze", "name": "Arcade Maze", "emoji": "🟡", "top": "#1b1b6b", "rim": "#2a2aa0", "rock": "#11113d", "accent": "#ffd23f",
  "base": "neon", "aliases": ["arcade maze", "maze", "arcade"],
  "kit": [
    { "shape": "pillar", "color": "#1b1b6b", "color2": "#3d5bff", "count": 5, "glow": 1.3 },
    { "shape": "dots", "color": "#ffe9a8", "count": 2, "glow": 0.8 },
    { "shape": "orb", "color": "#ffd23f", "size": 1.3 },
    { "shape": "star", "color": "#fff3b0" }
  ] }
```

- **Shapes:** `pine`, `tree`, `rock`, `house`, `crystal`, `pillar`, `orb`, `ring`, `pyramid`, `cone`, `cube`, `pool`,
  `dots`, `arch`, `star`, `waterfall`.
- **Options:** `color`, `color2` (roof / cap / top), `count` (max 12), `size`, `glow` (0–2).
- **Ready-made example:** the `arcade-maze` world ships with a kit, and `@joey.arcade` has it on floor 5. `@zed` shows option 1 ("Block World").
- **Exact match with a video:** if a video floor is modelled in 3D, export it as `.glb` and ask for it to be loaded for that world.
  That is the only way to get a pixel-identical floor.
- **Trademarks:** keep custom worlds generic ("Arcade Maze", "Block World"), not brand names (Pac-Man, Minecraft…).

## Data

- `data/ledger.json`: the source of truth, `{ likes: [{day, count}], picks: [{id, handle, theme, text, day, ts, source}] }`. Not published.
- `data/series.json`: day, links (an empty link hides it in the UI) and episodes.
- `data/optout.json`: hidden handles.
- `public/data/state.json`: derived, public and CORS-open. The studio site reads `series`, `totals` and `preview`.
  `floors[i]` is floor `i+1` as `[themeIndex, handleIndex (-1 = nobody), dayBuilt, dayPicked]`.

## Deep links

| link | opens |
| --- | --- |
| `/?u=handle` | that builder's highest floor, plus all their floors |
| `/?f=123` | floor 123 |
| `/?w=lava` | a world and all its floors |
| `/?q=text` | best fuzzy match (handle, world or floor number) |

The Share button uses the Web Share API, with copy-link as the fallback.

## Rendering notes

- Every floor is drawn with three instanced meshes (top, rim, rocky underside), so thousands of floors cost three draw calls.
- Themed props (trees, crystals, neon pillars, lava…) are built only for the floors near the camera, plus the selected one.
- Stairs and clouds are re-instanced in a ±40-floor window as you climb.
- The sky darkens with altitude, and stars appear past floor ~1,100.
- DPR is capped at 2 and rendering pauses when the tab is hidden.
- Reduced motion turns off the auto-rotate and the flights.
- Without WebGL, the Builders list becomes the page.

## Deploy

Static hosting. Use Cloudflare Pages / Netlify (`public/_headers`) or Vercel (`vercel.json`): build command
`npm run build -w @whiskerworks/leveltower`, output `apps/leveltower/dist`, custom domain `tower.whiskerworks.games`.
After buying the real domain, replace `whiskerworks.games` in `index.html`, `public/robots.txt`, `public/sitemap.xml`
and `scripts/generate-assets.mjs`.

Local dev: `npm run dev -w @whiskerworks/leveltower` → http://localhost:5177
