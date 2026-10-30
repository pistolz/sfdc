export interface Links { latestEpisode?: string; instagram?: string; tiktok?: string; youtube?: string }
export interface Episode { day: number; date: string; title: string; summary?: string; links?: Partial<Links> }
export interface Level { level: number; seats: number; name: string }
export interface Rules { foundingSeats: number; seatsPerComment: number; goal: number; levels: Level[] }
export interface Totals {
  seats: number; clubs: number; fans: number; comments: number; goal: number;
  level: number; levelName: string; levelSeats: number; nextLevelSeats: number | null;
}
export interface LeaderRow { id: string; name: string; banner: string; colors: [string, string]; seats: number; comments: number; fans: number; founder: string; rank: number }
export interface ClubState {
  name: string; banner: string; colors: [string, string]; custom: boolean; seats: number; comments: number; fans: number;
  founder: string; foundedDay: number; rank: number; topFans: { handle: string; comments: number; fan: number }[];
}
export interface HandleState { total: number; clubs: Record<string, { comments: number; fan: number; day: number }>; founderOf: string[] }
export interface GameState {
  version: 1; updatedAt: string; day: number;
  series: { name: string; tagline: string; rule: string };
  links: Links; rules: Rules; totals: Totals;
  preview: { headline: string; stat: number; statLabel: string; top: { label: string; sub: string }[] };
  episodes: Episode[]; leaderboard: LeaderRow[]; clubs: Record<string, ClubState>; handles: Record<string, HandleState>;
}
