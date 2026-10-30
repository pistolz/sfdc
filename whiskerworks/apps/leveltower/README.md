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

**Before launch run `reset --yes`.** The repo ships with demo data (`source: "demo"` in the ledger).

### Rules

- Floors = total likes (minimum 1). Floor 1 is the Grassland base.
- Picks are handed out in comment order: the first pick builds floor 2, the next floor 3, and so on.
  Picks beyond the current floor count wait in the **queue** (shown on the builder's panel and on the ghost floor above the top).
- Floors nobody picked get a rotating world ("open world").
- Worlds live in `src/themes.json` (id, colours, aliases, emoji). Add aliases there to teach the parser new words.

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
