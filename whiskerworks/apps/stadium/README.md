# Stadium Builder · live stadium (`stadium.whiskerworks.games`)

The live "state of the game" page for the **Stadium Builder** video series (Instagram / TikTok / YouTube):
**1 club = 1 stand**. Viewers comment a football club; every club gets its own stand in one giant stadium,
painted in its colours, and every commenter gets a seat with their name on it. Vite + TypeScript + three.js,
no framework. Static output in `dist/`.

## Rules

- The first comment naming a club **founds its stand** (500 seats) and makes the commenter its **founder**.
- Every further comment for that club adds **100 seats** (`rules.foundingSeats` / `rules.seatsPerComment` in `data/series.json`).
- Every commenter owns **one seat per club** they commented (block = club rank, row, seat).
- Total seats level the stadium up — each level adds a tier, the roof arrives at LV3:

| Level | Seats | Name |
| --- | --- | --- |
| LV1 | 0 | Local ground |
| LV2 | 5,000 | Town stadium |
| LV3 | 20,000 | City arena |
| LV4 | 60,000 | Big stadium |
| LV5 | 100,000 | The biggest stadium in the world (goal) |

## Daily workflow

```bash
# 1. export the comments of the latest episode (CSV: id,handle,text,timestamp — or a JSON array)
npm run sb -w @whiskerworks/stadium -- import ~/Downloads/day4-comments.csv --day 4 --dry-run   # preview
npm run sb -w @whiskerworks/stadium -- import ~/Downloads/day4-comments.csv --day 4

# 2. move the series forward and register the episode
npm run sb -w @whiskerworks/stadium -- next-day
npm run sb -w @whiskerworks/stadium -- episode --day 4 --title "Wydad takes the corner" \
  --summary "…" --instagram https://www.instagram.com/reel/… --latest

# 3. build + deploy (state.json and og.png are regenerated on build)
npm run build -w @whiskerworks/stadium
```

All commands (`node scripts/sb.mjs <cmd>`):

| command | what it does |
| --- | --- |
| `build` | ledger + series → `public/data/state.json` |
| `add "<club>" <@handle> [--count n] [--day d]` | manual comment(s). Club = any name/alias from `scripts/clubs.mjs`, or a new club name (gets generated colours) |
| `import <file.csv\|json> [--day d] [--dry-run]` | import comments, dedupe by `id`, find the club in the text |
| `match "<comment>"` | test the parser (`Hala Madrid` → Real Madrid, `visca barça` → FC Barcelona, `Go Sion FC` → new club) |
| `day <n>` / `next-day` | set the current day |
| `episode --day --title [--summary] [--date] [--instagram] [--tiktok] [--youtube] [--latest]` | add / update an episode |
| `optout <@handle>` | show a handle as "anonymous" everywhere |
| `stats` | top 10 in the terminal |
| `seed-demo` | replace the ledger with demo data (ships this way) |
| `reset --yes` | empty the ledger before Day 1 goes live |

**Before launch run `reset --yes`** — the repo ships with demo data (`source: "demo"` in the ledger).

### Clubs

`scripts/clubs.mjs` holds ~180 clubs (Europe, Africa, Middle East, Asia, the Americas) with their two colours,
banner name and aliases/nicknames (`hala madrid`, `dima wydad`, `ggmu`, `mengao`…). Aliases are matched as whole
words, longest first, so `inter miami` beats `inter`. Comments like `Example FC` / `FC Example` / `Example United`
create a new club automatically. Add a line to give a club proper colours.

## Data

- `data/ledger.json` — source of truth, one entry per counted comment `{id, handle, club, clubName?, day, ts, source}`. Not published.
- `data/series.json` — day, links (empty link = hidden in the UI), episodes, rules.
- `data/optout.json` — hidden handles.
- `public/data/state.json` — derived, public, CORS-open (`version: 1`). Also read by the studio site
  (`series`, `totals`, `preview` are the fields the series card uses).

## Deep links

- `/?u=handle` — flies the camera to that fan's seat, lights it up and shows their ticket.
- `/?c=<club-id>` — flies to a club's stand (ids in `scripts/clubs.mjs`, e.g. `real-madrid`, `wydad`).
- `/?q=<text>` — free text (handle or club, typo-tolerant), used by the studio site.

Tapping a seat in the stadium opens its owner (or its club).

## Deploy

Static site: `dist/`. Cloudflare Pages / Netlify read `public/_headers` (security headers, caching, CORS on `/data/*`);
Vercel reads `vercel.json`. Set the custom domain `stadium.<your domain>` and update the canonical/OG URLs in
`index.html`, `public/robots.txt`, `public/sitemap.xml` and `scripts/generate-assets.mjs` if the domain changes.
