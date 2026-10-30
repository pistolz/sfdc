# WhiskerWorks

Studio website and live-series microsites for **WhiskerWorks**, *Games with nine lives.*

| App | Domain | Stack | What it is |
| --- | --- | --- | --- |
| `apps/studio` | `whiskerworks.games` | Astro 5, static | Studio site: games catalogue, search, a page per game, live series, about, press, support, legal pages |
| `apps/flagwars` | `flagwars.whiskerworks.games` | Vite + TypeScript + three.js, static | Live 3D map of the **Flag Wars** series (1 comment = 1 flag) |
| `packages/brand` | (none) | CSS + SVG | Shared brand tokens and logo |
| `brand/` | (none) | Docs | Brand guidelines (logo, colours, type, voice) |

Both sites are fully static: no server, no database. Host them anywhere (Cloudflare Pages, Netlify or Vercel) for free.

## Quick start

```bash
npm install          # Node 20.10+ (see .nvmrc)
npm run dev          # studio      → http://localhost:4321
npm run dev:flagwars # Flag Wars   → http://localhost:5173
npm run check        # type-check both apps
npm run build        # builds apps/flagwars/dist and apps/studio/dist
```

## Adding a game (the studio catalogue)

Every game is one Markdown file in `apps/studio/src/content/games/`.

```bash
npm run new-game -- "Game Title" --mood think --genre "Word puzzle" --status live
```

Open the created file and fill it in: tagline, store links, loop, features, FAQ and search keywords. The schema is
validated at build time (`apps/studio/src/content.config.ts`), so a typo fails the build instead of shipping.

- **Artwork:** until you add `icon: ./images/<slug>/icon.png`, a branded icon is generated from `colors` + `motif`.
- **Store links:** empty links are hidden. A game without links shows "Coming soon · iPhone & Android".
- **Placement:** set `featured: true` for the home hero and use `order` to sort. `status: live` games come first.
- **The six games shipped here are samples** (`sample: true`). Delete their files, or build with
  `SHOW_SAMPLES=false` to hide them all at once.

Each game automatically gets its page, a share image (`/og/game-<slug>.png`), a place in search, in the sitemap and in the
home mood picker, schema.org `VideoGame` + `FAQPage` data, and QR codes when it has store links.

## Running Flag Wars day to day

See [`apps/flagwars/README.md`](apps/flagwars/README.md). In short:

```bash
npm run fw -- import day4-comments.csv --day 4 --dry-run   # preview what gets counted
npm run fw -- import day4-comments.csv --day 4
npm run fw -- next-day
npm run fw -- episode --day 4 --title "Japan takes the lead" --instagram https://… --latest
npm run build    # then deploy; the studio home page shows the new numbers too
```

**Before Day 1 goes live:** `npm run fw -- reset --yes`, because the repo ships with demo data so the map looks alive.

## Configuration (domain, socials, email)

The domain is not bought yet; everything assumes `whiskerworks.games`. When you buy the domain:

1. `apps/studio/src/site.config.ts` holds the domain, email, socials and analytics. You can also set the
   `SITE_URL` and `FLAGWARS_URL` environment variables in your host.
2. `apps/studio/public/_headers` contains the CSP (`*.whiskerworks.games`).
3. In `apps/flagwars`, search and replace `whiskerworks.games` in `index.html`, `src/main.ts`,
   `public/robots.txt` and `public/sitemap.xml`. Socials are in `data/series.json`.

Analytics are off by default. Set `PUBLIC_PLAUSIBLE_DOMAIN` to enable cookieless Plausible.

## Deploying (Cloudflare Pages, recommended)

Create **two Pages projects** from this repository, both with root directory `whiskerworks`:

| Project | Build command | Output directory | Custom domain |
| --- | --- | --- | --- |
| studio | `npm run build` | `apps/studio/dist` | `whiskerworks.games` |
| flagwars | `npm run build -w @whiskerworks/flagwars` | `apps/flagwars/dist` | `flagwars.whiskerworks.games` |

Set `NODE_VERSION=22`. The `_headers` files (security headers, caching, CORS on Flag Wars `/data/*`) are picked up
automatically. On Vercel, the `vercel.json` in `apps/flagwars` does the same job.

The studio `build` also builds Flag Wars first, so the home page snapshot (day, flags, top 3) is current. In the browser
it then refreshes from `https://flagwars.<domain>/data/state.json`.

CI (`.github/workflows/whiskerworks.yml`) type-checks and builds both apps on every push.

## Launch checklist

- [ ] Buy the domain and update the config (see above)
- [ ] Replace the sample games with the real catalogue (`npm run new-game`)
- [ ] Add real icons and screenshots per game
- [ ] Fill `site.socials` (TikTok, YouTube…) and Flag Wars `data/series.json` links
- [ ] Create `hello@` and `press@` mailboxes
- [ ] Have the privacy policy and terms reviewed for your country and company
- [ ] `npm run fw -- reset --yes` before Flag Wars Day 1
- [ ] Optional: enable Plausible analytics
