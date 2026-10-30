# Noob Bee · live hive (`noobbee.whiskerworks.games`)

The live "state of the game" page for the **Noob Bee** video series (Instagram / TikTok / YouTube):
**1 comment = 1 level up**. Every counted comment teaches the clumsy bee one skill and becomes one ledge of a
honeycomb tower, with the commenter's @handle on it. Vite + TypeScript + three.js, no framework. Static output in `dist/`.

What the page does:

- A 3D honeycomb tower with one ledge per level and a "comment wall" card on each ledge (`LV 42 · @handle · moonwalk 🕺`).
- The bee is built from primitives (glossy head, stripes, big eyes, blush, antennae, iridescent wings). It has three
  expressions and unlocks a headband, a cape and a crown as it climbs.
- **Search `@handle`, a skill or a level number.** The camera pulls back and flies along the tower, then zooms in on that level.
  The bee zips over and celebrates with a star burst, and the card glows. A panel shows the level and its teacher, or every
  skill that handle taught. Misspelled searches get a "Did you mean". Every handle has its own share link (`?u=`).
- A level ruler on the right edge: drag it or tap it to scroll. Day boundaries are marked, and so are the selected
  handle's levels. Drag the scene or use the mouse wheel to scroll freely.
- A **Skill book** drawer (every level, filterable, top teachers) and an **Episodes** drawer (with "how it works").
- Opening shot: the noob stands on the floor next to his dropped skateboard, then the camera climbs the whole hive to today's level.
- If WebGL isn't available, the Skill book becomes the page. Reduced motion is respected. Rendering pauses when the tab is hidden.

## Daily workflow

```bash
# 1. export the comments of the latest episode (CSV: id,handle,text,timestamp — or a JSON array)
npm run nb -w @whiskerworks/noobbee -- import ~/Downloads/day4.csv --day 4 --dry-run    # preview
npm run nb -w @whiskerworks/noobbee -- import ~/Downloads/day4.csv --day 4

# 2. move the series forward and register the episode
npm run nb -w @whiskerworks/noobbee -- next-day
npm run nb -w @whiskerworks/noobbee -- episode --day 4 --title "He can fly now" \
  --summary "…" --instagram https://www.instagram.com/reel/… --latest

# 3. build + deploy (state.json and og.png are regenerated on build)
npm run build -w @whiskerworks/noobbee
```

All commands (`node scripts/nb.mjs <cmd>`):

| command | what it does |
| --- | --- |
| `build` | ledger + series → `public/data/state.json` |
| `add <@handle> "<skill>" [--day d]` | teach one skill by hand |
| `import <file.csv\|json> [--day d] [--dedupe] [--dry-run]` | 1 comment = 1 level; the comment text **is** the skill |
| `clean "<comment>"` | test the cleaner/filter on one comment |
| `day <n>` / `next-day` | set the current day |
| `episode --day --title --summary --instagram --tiktok --youtube --latest` | add or replace an episode |
| `optout <@handle>` | show a handle as "anonymous" everywhere |
| `remove <level>` | moderation: drop one level (later levels shift down) |
| `stats` | summary + top teachers in the terminal |
| `seed-demo` | replace the ledger with demo data (this is how the repo ships) |
| `reset --yes` | empty the ledger before Day 1 goes live |

**Before launch, run `reset --yes`.** The repo ships with demo data (`source: "demo"` in the ledger).

### How a comment becomes a skill

The cleaner works through these steps in order:

1. Strip URLs, `@mentions` and `#` signs.
2. Drop prefixes like "teach him to" and "learn how to", and collapse whitespace.
3. Reject comments with fewer than 2 letters (emoji-only comments are skipped).
4. Reject comments that hit a small built-in EN/FR/ES blocklist.
5. Truncate to `rules.maxSkillLength` (40) characters on a word boundary, and lowercase all-caps shouting.

An emoji is picked from keywords: 🛹 skate, 🕺 moonwalk, 🧱 wall, 🪽 fly, and so on, with ⭐ as the default.
`--dedupe` (or `rules.dedupeSkills: true` in `data/series.json`) skips skills the bee already knows.

## Data

- `data/ledger.json` is the source of truth: one entry per counted comment `{id, handle, skill, day, ts, source}`. It is not published.
- `data/series.json` holds the day, links (an empty link is hidden in the UI), episodes and rules.
- `data/optout.json` lists hidden handles.
- `public/data/state.json` is derived from the above, public and CORS-open. The studio site reads its `preview` block.

Levels are ordered by day, then timestamp. Bee ranks by level: Noob 1, Rookie 10, Apprentice 25, Pro 50, Expert 100,
Master 200, Legend 500, Queen Bee 1000.

## Deep links

| link | opens |
| --- | --- |
| `/?u=handle` | that teacher: the camera flies to their latest level |
| `/?l=42` | level 42 |
| `/?q=moonwalk` | free text: the best match among handles, skills and level numbers, with typos tolerated |

The Share button uses the Web Share API, with copy-link as the fallback.

## Deploy

Static hosting with `public/_headers` (Cloudflare Pages / Netlify) or `vercel.json`. Set the build command to
`npm run build -w @whiskerworks/noobbee` from the monorepo root and the output directory to `apps/noobbee/dist`.
Point `noobbee.whiskerworks.games` at it. To change the domain, search for `whiskerworks.games` in `index.html`,
`public/robots.txt`, `public/sitemap.xml` and `scripts/generate-assets.mjs`.
