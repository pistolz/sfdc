import fs from 'node:fs';
import path from 'node:path';
import { site } from '../site.config';

/** Subset of flagwars public/data/state.json used by the studio site. */
export interface FlagWarsSnapshot {
  updatedAt: string;
  day: number;
  totalFlags: number;
  totalCountries: number;
  totalCommanders: number;
  links: { latestEpisode?: string; instagram?: string; tiktok?: string; youtube?: string };
  leaderboard: { code: string; name: string; flags: number; level: number; founder?: string | null; color?: string }[];
  episodes: { day: number; date?: string; title: string; summary?: string }[];
}

const EMPTY: FlagWarsSnapshot = {
  updatedAt: new Date(0).toISOString(),
  day: 1,
  totalFlags: 0,
  totalCountries: 0,
  totalCommanders: 0,
  links: {},
  leaderboard: [],
  episodes: [],
};

/** Read at build time from the sibling app; refreshed client-side from the live subdomain. */
export function getFlagWarsSnapshot(): FlagWarsSnapshot {
  const candidates = [
    path.resolve(process.cwd(), '../flagwars/public/data/state.json'),
    path.resolve(process.cwd(), 'apps/flagwars/public/data/state.json'),
  ];
  for (const file of candidates) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { ...EMPTY, ...raw, leaderboard: (raw.leaderboard ?? []).slice(0, 10) };
    } catch {
      /* try next */
    }
  }
  return EMPTY;
}

const fwDef = site.series.find((s) => s.id === 'flagwars')!;
export const flagWarsUrl = fwDef.url;
export const flagWarsStateUrl = `${fwDef.url}/data/state.json`;

export function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
