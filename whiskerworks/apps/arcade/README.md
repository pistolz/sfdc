# Insert Coin Club · live hall (`arcade.whiskerworks.games`)

The live "state of the series" page for **Insert Coin Club** (Instagram / TikTok / YouTube):
**1 follower = 1 arcade machine**. Every follower gets a numbered cabinet with their @handle on the marquee,
in a neon arcade hall that grows every day. Search your @handle: the camera rises over the rows, glides down the
aisle and swoops in front of your machine, which powers on with a flash. Vite + TypeScript + three.js, no framework.
Static output in `dist/`.

```bash
npm run dev -w @whiskerworks/arcade      # http://localhost:5175
npm run build -w @whiskerworks/arcade    # prebuild: arc build + og/icons, then vite build
npm run typecheck -w @whiskerworks/arcade
```

## Daily workflow

```bash
# 1. export your new followers (CSV: handle[,followed_at], a JSON array of handles,
#    or the Instagram "Download your information" followers JSON) and preview the import
npm run arc -w @whiskerworks/arcade -- import ~/Downloads/followers.csv --dry-run
npm run arc -w @whiskerworks/arcade -- import ~/Downloads/followers.csv

# 2. move the series forward and register the episode
npm run arc -w @whiskerworks/arcade -- next-day
npm run arc -w @whiskerworks/arcade -- episode --day 6 --title "Second hall" \
  --summary "…" --instagram https://www.instagram.com/reel/… --latest

# 3. build + deploy (state.json and og.png are regenerated on build)
npm run build -w @whiskerworks/arcade
```

Re-importing the full follower list every day is safe: known handles are skipped, and only new followers get
machines, in `followed_at` order (else file order).

| command (`node scripts/arc.mjs …`) | what it does |
| --- | --- |
| `build` | ledger + series → `public/data/state.json` |
| `add <@handle> [--day d] [--at ISO]` | give one follower the next machine |
| `import <file> [--day d] [--dry-run]` | add new followers from CSV/JSON |
| `optout <@handle>` | the machine stays, the marquee reads PLAYER |
| `day <n>` / `next-day` | set the current day |
| `episode --day --title [--summary] [--date] [--instagram] [--tiktok] [--youtube] [--latest]` | add/replace an episode; `--latest` points the CTA at it |
| `stats` | machines per day |
| `seed-demo` | replace the ledger with demo data (312 machines over 5 days, `source: "demo"`) |
| `reset --yes` | empty the ledger before Day 1 goes live |

**Before launch run `reset --yes`.** The repo ships with demo data so the hall looks alive.
Demo handles to try: `@mia_runs`, `@leo.taps`, `@ruby.lvl9`, `@finn.lvl9` (row 28, long flight), `#12`.

## Data

- `data/ledger.json` is the source of truth: one entry per follower `{handle, day, ts, source}`, in follow
  order. Machine number = position + 1, so #0001 is the founder. It is not published.
- `data/series.json` holds the name, tagline, account, day, links (an empty link is hidden in the UI) and episodes.
- `data/optout.json` lists hidden handles.
- `public/data/state.json` is derived from the above, public and CORS-open. The studio site reads `version`,
  `day`, `series`, `links`, `episodes`, `totals` and `preview`. `machines` is a compact array of
  `[handle, joinDay, gameIndex, neonIndex]`.

Each cabinet's mini-game (`games[gameIndex]`: Pyramid Climb, Stripe Bounce, Night Drive, Block Drop, Neon Pong,
Rock Blaster) is picked from a hash of the handle, so it never changes. Neon colours alternate so that neighbours differ.

## Deep links

- `/?u=handle` flies to that follower's machine. If they have no machine yet, a "Followed recently?" panel
  shows instead, with "Did you mean".
- `/?m=42` opens machine #0042.
- `/?q=text` is free text (handle, typo or `#number`) and jumps to the best match. The studio site uses it.

Share buttons use the Web Share API and fall back to copying the link.

## Rendering notes

- Instanced cabinets: body, neon trims, screens, marquees, coin doors, controls and floor light pools, about
  8 draw calls for any hall size. Unreal bloom runs at half resolution. DPR is capped at 2, and rendering pauses
  when the tab is hidden.
- Marquee names use a 2048² canvas atlas holding 128 names. Only the 128 machines nearest the view get text;
  the rest show a plain neon bar, unreadable at that distance anyway. The atlas is re-assigned as you move.
- The six mini-games are drawn into one shared canvas texture at about 30 fps.
- `prefers-reduced-motion` turns flights into cuts and freezes the screens. Without WebGL, the full machine list
  becomes the page.

## Deploy

Static hosting. On Cloudflare Pages / Netlify, `public/_headers` sets security headers, caching and CORS on
`/data/*`. `vercel.json` does the same on Vercel. Build command: `npm run build -w @whiskerworks/arcade`.
Output: `apps/arcade/dist`. The domain is hardcoded in `index.html`, `public/robots.txt`, `public/sitemap.xml`
and `scripts/generate-assets.mjs`.
