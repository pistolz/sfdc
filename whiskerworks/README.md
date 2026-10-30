# WhiskerWorks

Studio website and live-series microsites for **WhiskerWorks** (9506-6320 Québec inc.), *Games with nine lives.*

| App | Domain | What it is |
| --- | --- | --- |
| `apps/studio` | `whiskerworks.games` | Studio site: 17 games, search + filters, a page per game, genre pages, live series hub, about, press, support, legal, `app-ads.txt` |
| `apps/flagwars` | `flagwars.whiskerworks.games` | **Flag Wars**: 1 comment = 1 flag (3D hex globe) |
| `apps/stadium` | `stadium.whiskerworks.games` | **Stadium Builder**: 1 club = 1 stand (3D stadium, a seat per fan) |
| `apps/arcade` | `arcade.whiskerworks.games` | **Insert Coin Club**: 1 follower = 1 arcade machine (neon hall) |
| `apps/noobbee` | `noobbee.whiskerworks.games` | **Noob Bee**: 1 comment = 1 level up (3D bee in a hive shaft) |
| `apps/leveltower` | `tower.whiskerworks.games` | **Level Tower**: 1 like = 1 floor (tower of floating islands) |
| `packages/brand` | (none) | Shared tokens, logo, GA4 module |
| `brand/` | (none) | Brand guidelines |

Every site is fully static (no server, no database), so it can be hosted for free on Cloudflare Pages, Netlify or Vercel.
The studio is built with Astro 5; the series with Vite, TypeScript and three.js.

## Quick start

```bash
npm install            # Node 20.10+ (see .nvmrc)
npm run dev            # studio → http://localhost:4321
npm run dev:stadium    # or dev:flagwars, dev:arcade, dev:noobbee, dev:leveltower
npm run check          # type-check all 6 apps
npm run build          # build all 6 apps (each into apps/<app>/dist)
```

## Try the search on each series (demo data)

Each series ships with realistic **demo data** so you can test the search and the zoom animation. Type the handle in the
search bar, or open the deep link:

| Series | Handles to try | Also try |
| --- | --- | --- |
| Flag Wars | `@moose.noah`, `@atlas.lou`, `@lyon_xkai`, `@nyc.nora39` | `Canada`, typo `Brazll`, `?c=JP` |
| Stadium Builder | `@hala.nora`, `@culer.leo`, `@dima.wydad.aya`, `@stadium_fan`, `@example` | `madrd`, `?c=` club |
| Insert Coin Club | `@mia_runs`, `@leo.taps`, `@ruby.lvl9`, `@finn.lvl9`, `@kai_88` | `#12`, typo `mia_rns`, `@nobody_here` |
| Noob Bee | `@honey.mira`, `@buzz_kai`, `@pollen.pete`, `@skate_lina`, `@queenbee_aya` | `42`, typo `@hony.mra` |
| Level Tower | `@lava.queen`, `@skye.climbs`, `@nina.builds`, `@kai_up`, `@pixel_theo` | `lava`, `floor 1`, typo `@lava.quen` |

Deep links: `?u=handle` opens a person, `?q=free text` jumps to the best match, plus series-specific ones (`?c=`, `?m=`, `?l=`).
The studio's series cards also have a "Find me" box that sends people straight to these links.

**Before going live, reset each series:** `npm run fw -- reset --yes` (and the same with `sb`, `arc`, `nb`, `tower`).

## Running a series day to day

Each series has a small command-line tool. Export the comments, likes or followers of the latest episode, import them,
move the day forward, register the episode, then build and deploy.

| Series | CLI | Imports |
| --- | --- | --- |
| Flag Wars | `npm run fw -- …` | comments (CSV/JSON); the country is detected from names in 6 languages, flag emojis and codes |
| Stadium Builder | `npm run sb -- …` | comments; 179 clubs with colours and aliases are built in, and unknown "X FC" clubs are created |
| Insert Coin Club | `npm run arc -- …` | followers (CSV, JSON or the Instagram export) |
| Noob Bee | `npm run nb -- …` | comments; the text is the skill (filtered, max 40 characters) |
| Level Tower | `npm run tower -- …` | likes count + comments picking worlds |

Common commands: `import <file> --day N --dry-run` (preview), `import <file> --day N`, `next-day`,
`episode --day N --title "…" --instagram <url> --latest`, `optout @handle`, `stats`, `build`.
Each app's README (`apps/<app>/README.md`) has the details.

## Adding or updating a game

Every game is one Markdown file in `apps/studio/src/content/games/` with its icon and screenshots in `images/<slug>/`.

```bash
npm run new-game -- "Game Title" --mood think --genre "Logic puzzle" --status soon
```

- **Going live on a store:** paste the store URL into `links.appStore` / `links.googlePlay`. The exact URLs are already
  written as a comment at the top of each game file. The badges become real links, and the QR codes and the iOS Smart App
  Banner turn on automatically.
- `status`: `live` (Out now), `beta`, `soon` (Launching soon), `dev` (In the workshop). Live games are listed first.
- `featured: true` puts a game in the home page hero.
- Legal pages: each game's privacy, terms and support pages (EN + FR) are served at the same paths as before
  (`/honeybar/privacy.html`…). Update them in `apps/studio/public/<game>/`.

Every game automatically gets its page, a share image, schema.org data (`VideoGame`, `FAQPage`, breadcrumbs), a genre
landing page, a place in search, the sitemap and the home page picker.

## Google Analytics 4

GA4 is ready on all 6 sites but **off until you set an ID**:

| Site | Environment variable |
| --- | --- |
| Studio | `PUBLIC_GA4_ID=G-XXXXXXX` |
| Each series | `VITE_GA4_ID=G-XXXXXXX` |

Use one GA4 property with the same ID everywhere; each event carries the `series` name.

- Consent Mode v2: nothing is stored until the visitor clicks **Accept** on the banner (Québec Law 25 / GDPR).
  A "Cookie preferences" link in the studio footer reopens it.
- **Studio events:** `store_click` (store + game), `search`, `filter_games`, `series_find`, `share`, `outbound_click`.
- **Series events:** `find_name` (someone looked up a handle), `select_item`, `outbound_click`.
- Mark `store_click` and `find_name` as key events in GA4.

## Deploying (Cloudflare Pages)

Create one Pages project per site from this repository, all with root directory `whiskerworks` and `NODE_VERSION=22`:

| Project | Build command | Output directory | Domain |
| --- | --- | --- | --- |
| studio | `npm run build` | `apps/studio/dist` | `whiskerworks.games` |
| flagwars | `npm run build -w @whiskerworks/flagwars` | `apps/flagwars/dist` | `flagwars.whiskerworks.games` |
| stadium | `npm run build -w @whiskerworks/stadium` | `apps/stadium/dist` | `stadium.whiskerworks.games` |
| arcade | `npm run build -w @whiskerworks/arcade` | `apps/arcade/dist` | `arcade.whiskerworks.games` |
| noobbee | `npm run build -w @whiskerworks/noobbee` | `apps/noobbee/dist` | `noobbee.whiskerworks.games` |
| leveltower | `npm run build -w @whiskerworks/leveltower` | `apps/leveltower/dist` | `tower.whiskerworks.games` |

The `_headers` files (security headers, caching, CORS on `/data/*`) are applied automatically; `vercel.json` files do the
same on Vercel. The studio build also builds every series first, so its cards show current numbers, and in the browser it
refreshes them from each subdomain.

CI (`.github/workflows/whiskerworks.yml`) type-checks and builds everything on every push.

## When you buy the domain

Everything assumes `whiskerworks.games`. To change it:

1. `apps/studio/src/site.config.ts`: the domain, series URLs, email and socials (or set the `SITE_URL` / `<SERIES>_URL` env vars).
2. Search and replace `whiskerworks.games` in `apps/*/index.html`, `apps/*/public/{robots.txt,sitemap.xml}`,
   `apps/*/scripts/generate-assets.mjs`, `apps/*/public/_headers` and `packages/brand/analytics.ts`.
3. `apps/studio/public/app-ads.txt`: set `OWNERDOMAIN=` to the new domain, and put the new domain as the developer
   website in App Store Connect / Google Play Console so ad networks can find it.
4. Update the privacy, support and marketing URLs in App Store Connect / Google Play to the new domain (same paths).

## Launch checklist

- [ ] Buy the domain and update the config (above)
- [ ] Reset the demo data of the 5 series before their Day 1
- [ ] Paste store URLs into each game as it goes live
- [ ] Rename the Google Play developer account from "Gaufres et Glaces" to WhiskerWorks
- [ ] Set `PUBLIC_GA4_ID` / `VITE_GA4_ID`
- [ ] Add TikTok / YouTube links in `site.config.ts` and each series' `data/series.json` (empty links are hidden)
- [ ] Have the privacy policy and terms reviewed
