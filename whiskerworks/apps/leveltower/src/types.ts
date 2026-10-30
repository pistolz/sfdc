export interface Links { latestEpisode?: string; instagram?: string; tiktok?: string; youtube?: string }
export interface Episode { day: number; date: string; title: string; summary?: string; links?: Partial<Links> }
/** One generic prop recipe, so a new world can be described in JSON without code (see README "Custom worlds"). */
export interface KitItem { shape: "pine" | "tree" | "rock" | "house" | "crystal" | "pillar" | "orb" | "ring" | "pyramid" | "cone" | "cube" | "pool" | "dots" | "arch" | "star" | "waterfall"; color: string; color2?: string; count?: number; size?: number; glow?: number }
export interface Theme { id: string; name: string; emoji: string; top: string; rim: string; rock: string; accent: string; base?: string; kit?: KitItem[] }
/** Option 1 "custom label": the requested theme name shown on a floor that borrows an existing world's look. */
export interface FloorLabel { name: string; emoji: string }
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
  /** floor number → custom label (option 1). */
  labels?: Record<string, FloorLabel>;
  floors: Floor[];
  handles: string[];
  queue: { handle: string; theme: string; label?: string; floor: number; day: number }[];
  builders: { rank: number; handle: string; floors: number }[];
  likesByDay: { day: number; likes: number }[];
  themeCounts: Record<string, number>;
  preview: { headline: string; stat: number; statLabel: string; top: { label: string; sub: string }[] };
}
