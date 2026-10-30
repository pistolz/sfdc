import fs from 'node:fs';
import path from 'node:path';
import { site } from '../site.config';

export type SeriesDef = (typeof site.series)[number];

/** The `preview` block every series app writes into its public/data/state.json. */
export interface SeriesPreview {
  headline?: string;
  stat?: number | string;
  statLabel?: string;
  top?: { label: string; sub?: string }[];
}
export interface SeriesSnapshot {
  def: SeriesDef;
  day: number;
  updatedAt?: string;
  preview: SeriesPreview;
  latestEpisode?: string;
  stateUrl: string;
}

function readState(app: string): Record<string, any> | null {
  for (const file of [
    path.resolve(process.cwd(), `../${app}/public/data/state.json`),
    path.resolve(process.cwd(), `apps/${app}/public/data/state.json`),
  ]) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      /* next */
    }
  }
  return null;
}

const nf = new Intl.NumberFormat('en');

/** Build-time snapshot of every live series (refreshed client-side from each subdomain). */
export function getSeries(): SeriesSnapshot[] {
  return site.series
    .filter((s) => s.live)
    .map((def) => {
      const st = readState(def.app) ?? {};
      let preview: SeriesPreview = st.preview ?? {};
      if (!st.preview && def.id === 'flagwars' && st.leaderboard) {
        preview = {
          stat: st.totalFlags,
          statLabel: 'flags planted',
          top: st.leaderboard.slice(0, 3).map((c: any) => ({ label: c.name, sub: `LV ${c.level}` })),
        };
      }
      if (typeof preview.stat === 'number') preview = { ...preview, stat: nf.format(preview.stat) };
      return {
        def,
        day: st.day ?? 1,
        updatedAt: st.updatedAt,
        preview,
        latestEpisode: st.links?.latestEpisode || st.links?.instagram || site.socials.instagram,
        stateUrl: `${def.url}/data/state.json`,
      };
    });
}
