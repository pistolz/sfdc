export interface Links { latestEpisode?: string; instagram?: string; tiktok?: string; youtube?: string }
export interface Episode { day: number; date: string; title: string; summary?: string; links?: Partial<Links> }
export interface Theme { id: string; name: string; emoji: string; top: string; rim: string; rock: string; accent: string }
/** [themeIndex, handleIndex (-1 = nobody picked), dayBuilt, dayPicked] */
export type Floor = [number, number, number, number];
export interface TowerState {
  version: 1;
  updatedAt: string;
  day: number;
  series: { name: string; tagline: string; rule: string };
  links: Links;
  episodes: Episode[];
  totals: { floors: number; likes: number; picks: number; builders: number; queued: number; worlds: number; likesToday: number };
  rules: { base: string; floorsPerLike: number };
  themes: Theme[];
  floors: Floor[];
  handles: string[];
  queue: { handle: string; theme: string; floor: number; day: number }[];
  builders: { rank: number; handle: string; floors: number }[];
  likesByDay: { day: number; likes: number }[];
  themeCounts: Record<string, number>;
  preview: { headline: string; stat: number; statLabel: string; top: { label: string; sub: string }[] };
}
