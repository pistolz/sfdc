import { getCollection, type CollectionEntry } from 'astro:content';

export type Game = CollectionEntry<'games'>;
export type Mood = Game['data']['mood'];
export type Platform = Game['data']['platforms'][number];

const SHOW_SAMPLES = (process.env.SHOW_SAMPLES ?? 'true') !== 'false';

const statusRank = { live: 0, beta: 1, soon: 2, dev: 3 } as const;

/** All published games, live first, then by `order`, then title. */
export async function getGames(): Promise<Game[]> {
  const all = await getCollection('games', ({ data }) => !data.draft && (SHOW_SAMPLES || !data.sample));
  return all.sort(
    (a, b) =>
      statusRank[a.data.status] - statusRank[b.data.status] ||
      a.data.order - b.data.order ||
      a.data.title.localeCompare(b.data.title),
  );
}

export function getFeatured(games: Game[]): Game | undefined {
  return games.find((g) => g.data.featured) ?? games.find((g) => g.data.status === 'live') ?? games[0];
}

export const moods: Record<Mood, { label: string; blurb: string }> = {
  relax: { label: 'Relax', blurb: 'Unhurried games. Make your next move in your own time.' },
  think: { label: 'Think', blurb: 'Words, numbers and a satisfying answer to work toward.' },
  action: { label: 'Action', blurb: 'Quick reflexes, rising pressure and one more run.' },
};

export const platformLabels: Record<Platform, string> = {
  ios: 'iPhone',
  android: 'Android',
  web: 'Browser',
  steam: 'PC',
  switch: 'Switch',
};

export const statusLabels = { live: 'Out now', beta: 'Beta', soon: 'Launching soon', dev: 'In the workshop' } as const;

export function platformLine(platforms: readonly Platform[]): string {
  const names = platforms.map((p) => platformLabels[p]);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}

export const gameUrl = (g: Game) => `/games/${g.id}/`;

/** Compact record for client-side search and filtering. */
export function toSearchRecord(g: Game) {
  return {
    id: g.id,
    t: g.data.title,
    d: g.data.tagline,
    g: g.data.genre,
    m: g.data.mood,
    p: g.data.platforms,
    s: g.data.status,
    k: g.data.keywords,
    c: g.data.colors,
    u: gameUrl(g),
  };
}
export type SearchRecord = ReturnType<typeof toSearchRecord>;

export const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Numeric App Store id from an apps.apple.com URL (for the iOS Smart App Banner). */
export function appStoreId(url: string): string | null {
  return url.match(/id(\d{6,})/)?.[1] ?? null;
}

/** URL of a game's in-browser demo page, or null. */
export const playUrl = (g: Game) => (g.data.playable.length ? `/games/${g.id}/play/` : null);
