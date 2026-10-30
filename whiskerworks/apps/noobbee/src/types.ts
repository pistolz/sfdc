export interface Level { n: number; handle: string; skill: string; emoji: string; day: number }
export interface Handle { total: number; levels: number[]; first: number; firstDay: number }
export interface Episode { day: number; date?: string; title: string; summary?: string; links?: Partial<Record<"instagram" | "tiktok" | "youtube", string>> }
export interface Links { latestEpisode?: string; instagram?: string; tiktok?: string; youtube?: string }
export interface GameState {
  version: number;
  updatedAt: string;
  day: number;
  series: { name: string; tagline: string; rule: string };
  links: Links;
  episodes: Episode[];
  totals: { levels: number; players: number; uniqueSkills: number; today: number };
  bee: { level: number; rank: string; nextRank: string | null; nextRankAt: number | null };
  preview: { headline: string; stat: string; statLabel: string; top: { label: string; sub: string }[] };
  topTeachers: { handle: string; levels: number }[];
  levels: Level[];
  handles: Record<string, Handle>;
}
