# WhiskerWorks: handoff for deployment

Context for the next session (or a teammate) to deploy everything to Cloudflare.

## What exists

The repo `pistolz/sfdc` has a branch `whiskerworks-site` with a folder `whiskerworks/`: an npm-workspaces monorepo of
6 static sites. It is fully built and tested; nothing is deployed yet.

| App | Package | Target domain | Stack |
| --- | --- | --- | --- |
| `apps/studio` | `@whiskerworks/studio` | `whiskerworks.games` (+ `www`) | Astro 5 |
| `apps/flagwars` | `@whiskerworks/flagwars` | `flagwars.whiskerworks.games` | Vite + TS + three.js |
| `apps/stadium` | `@whiskerworks/stadium` | `stadium.whiskerworks.games` | Vite + TS + three.js |
| `apps/arcade` | `@whiskerworks/arcade` | `arcade.whiskerworks.games` | Vite + TS + three.js |
| `apps/noobbee` | `@whiskerworks/noobbee` | `noobbee.whiskerworks.games` | Vite + TS + three.js |
| `apps/leveltower` | `@whiskerworks/leveltower` | `tower.whiskerworks.games` | Vite + TS + three.js |

- **Studio:** the WhiskerWorks game studio site, owned by 9506-6320 Québec inc., contact `bonjour@tazgo.ca`.
  - 17 real games are in `apps/studio/src/content/games/*.md`. None is live on a store yet, so the store badges show
    "Coming soon".
  - It also serves `app-ads.txt` (owner domain `whiskerworks.games`) and the per-game legal pages at
    `/<game>/privacy.html` and similar paths.
- **Series:** the 5 others are "live map" pages for Instagram/TikTok video series, where searching `@handle` flies the
  3D camera to that person's flag, seat, machine, level or floor.
  - They currently hold **demo data** (`source: "demo"` in each `data/ledger.json`).
  - Each one publishes `public/data/state.json`, with CORS open on `/data/*`. The studio reads those files at build
    time and refreshes them from the subdomains in the browser.
- **Tooling:** Node 22 (`.nvmrc`).
  - `npm ci && npm run check && npm run build` from `whiskerworks/` builds everything in about 20s.
  - Each output is in `apps/<app>/dist`.
  - The root `npm run build` builds the 5 series and then the studio.
- **Headers:** every app has `public/_headers` (security headers, CSP including Google Analytics, caching, CORS), which
  Cloudflare Pages applies automatically.
- **Google Analytics 4** is wired but off until an ID is set: `PUBLIC_GA4_ID` for the studio and `VITE_GA4_ID` for each
  series, both at build time. Consent Mode v2 is enabled and a banner is included.
- **Domain:** the user bought `whiskerworks.games` on Cloudflare (Cloudflare Registrar, so the zone is already on
  Cloudflare). All code already uses this domain; no code change is needed for it.
- **Docs:** `whiskerworks/README.md` has full details: daily CLI workflow, test handles and the launch checklist.

## Deployment plan (Cloudflare Pages)

Create 6 Cloudflare **Pages** projects, one per app, with these settings:

| Pages project | Build command (root dir `whiskerworks`) | Output dir | Custom domain(s) |
| --- | --- | --- | --- |
| `whiskerworks-studio` | `npm run build` | `apps/studio/dist` | `whiskerworks.games`, `www.whiskerworks.games` |
| `whiskerworks-flagwars` | `npm run build -w @whiskerworks/flagwars` | `apps/flagwars/dist` | `flagwars.whiskerworks.games` |
| `whiskerworks-stadium` | `npm run build -w @whiskerworks/stadium` | `apps/stadium/dist` | `stadium.whiskerworks.games` |
| `whiskerworks-arcade` | `npm run build -w @whiskerworks/arcade` | `apps/arcade/dist` | `arcade.whiskerworks.games` |
| `whiskerworks-noobbee` | `npm run build -w @whiskerworks/noobbee` | `apps/noobbee/dist` | `noobbee.whiskerworks.games` |
| `whiskerworks-leveltower` | `npm run build -w @whiskerworks/leveltower` | `apps/leveltower/dist` | `tower.whiskerworks.games` |

Settings shared by all 6 projects:
- Repo: `pistolz/sfdc`
- Production branch: `whiskerworks-site`
- Root directory: `whiskerworks`
- Environment variable: `NODE_VERSION=22`

`www.whiskerworks.games` should redirect 301 to the apex, via a Cloudflare Redirect Rule or a Bulk Redirect.

### Two ways to do it

1. **Git-connected Pages projects (preferred)**, so every push auto-deploys. This needs the Cloudflare GitHub app to
   have access to `pistolz/sfdc`, which is a one-time click by the user in the dashboard. After that the projects can be
   created through the dashboard or through the API (`POST /accounts/{account_id}/pages/projects` with a `source` of
   type github).
2. **Direct upload with Wrangler**, if Git integration is not possible:
   - Build locally, then run `npx wrangler pages project create <name> --production-branch whiskerworks-site` and
     `npx wrangler pages deploy apps/<app>/dist --project-name <name> --branch whiskerworks-site`.
   - Add the custom domains with the API: `POST /accounts/{account_id}/pages/projects/{name}/domains`, body
     `{"name":"flagwars.whiskerworks.games"}`.
   - For auto-deploys, add a GitHub Actions workflow that runs the same `wrangler pages deploy` commands. It needs the
     repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, which the user adds in GitHub settings.

Required API token permissions: **Account › Cloudflare Pages: Edit**, **Zone › DNS: Edit** and
**Zone › Zone: Read** for `whiskerworks.games`. Add **Zone › Single Redirect / Dynamic Redirect: Edit** for the www
redirect.

### Verify after deploying

- `https://whiskerworks.games/`, `/games/`, `/games/honey-trails/`, `/series/`, `/app-ads.txt`, `/sitemap-index.xml`
  and `/honeybar/privacy.html` all return 200.
- Each subdomain loads, and `https://<sub>.whiskerworks.games/data/state.json` returns JSON with
  `access-control-allow-origin: *`.
- The search works on each series:
  - Flag Wars: `?u=moose.noah`
  - Stadium Builder: `?u=hala.nora`
  - Insert Coin Club: `?u=mia_runs`
  - Noob Bee: `?u=honey.mira`
  - Level Tower: `?u=lava.queen`
- The studio home page series cards show live numbers, with no CORS error in the console.
- Security headers are present (`curl -I`).

### Optional follow-ups

- **Email Routing:** create `hello@whiskerworks.games` that forwards to `bonjour@tazgo.ca`, then ask the user whether
  the sites should display it.
- **Google Analytics:** once the user gives a GA4 ID, set `PUBLIC_GA4_ID` on the studio project and `VITE_GA4_ID` on
  the 5 series projects, then redeploy.
- **Before each series' real Day 1:** run `npm run <cli> -- reset --yes` (the CLIs are `fw`, `sb`, `arc`, `nb`,
  `tower`), then commit and push. Only do this when the user says so.
