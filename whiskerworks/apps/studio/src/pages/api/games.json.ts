import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { getGames, gameUrl, playUrl } from '../../lib/games';
import { site } from '../../site.config';

/**
 * Public games feed read by every live-series site (packages/brand/promo.ts) for the "Play our games" bar and popup.
 * Edit a game's Markdown file (store links, featured, status) and every series updates after the studio deploys.
 */
export const GET: APIRoute = async () => {
  const games = await getGames();
  const abs = (p: string) => new URL(p, site.url).href;
  const items = await Promise.all(
    games
      .filter((g) => g.data.links.appStore || g.data.links.googlePlay)
      .map(async (g) => ({
        id: g.id,
        title: g.data.title,
        short: g.data.title.split(':')[0],
        tagline: g.data.tagline,
        genre: g.data.genre,
        featured: g.data.featured,
        icon: g.data.icon ? abs((await getImage({ src: g.data.icon, width: 128, height: 128, format: 'webp' })).src) : null,
        page: abs(gameUrl(g)),
        play: playUrl(g) ? abs(playUrl(g)!) : null,
        appStore: g.data.links.appStore || null,
        googlePlay: g.data.links.googlePlay || null,
      })),
  );
  items.sort((a, b) => Number(b.featured) - Number(a.featured));
  return new Response(JSON.stringify({ version: 1, studio: site.url, games: items }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
