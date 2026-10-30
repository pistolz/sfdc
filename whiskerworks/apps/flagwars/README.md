# Flag Wars · live map (`flagwars.whiskerworks.games`)

The live "state of the game" page for the **Flag Wars** video series (Instagram / TikTok / YouTube):
**1 comment = 1 flag**. Vite + TypeScript + three.js, no framework. Static output in `dist/`.

## Daily workflow

```bash
# 1. export the comments of the latest episode (CSV: id,handle,text,timestamp — or JSON array)
npm run fw -w @whiskerworks/flagwars -- import ~/Downloads/day4-comments.csv --day 4 --dry-run   # preview
npm run fw -w @whiskerworks/flagwars -- import ~/Downloads/day4-comments.csv --day 4

# 2. move the series forward and register the episode
npm run fw -w @whiskerworks/flagwars -- next-day
npm run fw -w @whiskerworks/flagwars -- episode --day 4 --title "Japan takes the lead" \
  --summary "…" --instagram https://www.instagram.com/reel/… --tiktok https://… --latest

# 3. build + deploy (state.json and og.png are regenerated on build)
npm run build -w @whiskerworks/flagwars
```

Other commands (`node scripts/fw.mjs <cmd>`):

| command | what it does |
| --- | --- |
| `build` | ledger + series → `public/data/state.json` |
| `add <country> <@handle> [--count n] [--day d]` | manual flag(s) (country = code or any name) |
| `match "<comment>"` | test the comment parser (flag emoji, names in en/fr/es/pt/de/it, nicknames, ISO codes) |
| `optout <@handle>` | show a handle as "anonymous" everywhere |
| `day <n>` / `next-day` | set the current day |
| `stats` | top 10 in the terminal |
| `seed-demo` | replace the ledger with demo data (ships this way) |
| `reset --yes` | empty the ledger before Day 1 goes live |

**Before launch run `reset --yes`** — the repo ships with demo data (`source: "demo"` in the ledger).

## Data

- `data/ledger.json` — source of truth, one entry per counted comment `{id, handle, country, day, ts, source}`. Not published.
- `data/series.json` — day, links (empty link = hidden in the UI), episodes, `rules.levelSteps`.
- `data/optout.json` — hidden handles.
- `public/data/state.json` — derived, public, CORS-open. Also read by the studio site (`version: 1` contract).

Rules: the first comment for a country makes its **founder**. LV1 at the first flag; each next level needs
`levelSteps[level-1]` more flags (`[10, 50, 100, 250, 500, 1000]`, last value repeats). Territory starts as a patch
around the flag and covers the whole country at LV6; towers appear from LV2.

## Geography

`npm run geo -w @whiskerworks/flagwars` regenerates `public/geo/world-hex.json` (60k-point Fibonacci sphere,
countries from Natural Earth 1:50m via `world-atlas`) and copies flag SVGs (`flag-icons`, MIT) to `public/flags/`.
Generated files are committed; builds only rebuild them when missing. Territory colours come from the flag,
with hand-picked overrides in `COLOR_OVERRIDES` (scripts/build-geo.mjs).

## Deep links

`/?c=CA` opens a country, `/?u=handle` opens a commander. Both are shareable (Share button uses the Web Share API).

## Deploy

Any static host. `public/_headers` (Cloudflare Pages / Netlify) and `vercel.json` set security headers, caching and
CORS on `/data/*`. Point the `flagwars` CNAME at the project.
