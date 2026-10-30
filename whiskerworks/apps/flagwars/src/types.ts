export interface Links { latestEpisode?: string; instagram?: string; tiktok?: string; youtube?: string }
export interface Episode { day: number; date: string; title: string; summary?: string; links?: Partial<Links> }
export interface LeaderRow { code: string; name: string; flags: number; level: number; progress: number; next: number; founder: string; rank: number; color: string }
export interface CountryState {
  name: string; flags: number; level: number; progress: number; next: number; founder: string; foundedDay: number; color: string;
  commanderCount: number; topCommanders: { handle: string; flags: number }[];
}
export interface HandleState { total: number; countries: Record<string, number>; founderOf: string[] }
export interface GameState {
  version: 1; updatedAt: string; day: number; totalFlags: number; totalCountries: number; totalCommanders: number;
  rules: { levelSteps: number[] }; links: Links; series: { name: string; tagline: string }; episodes: Episode[];
  leaderboard: LeaderRow[]; countries: Record<string, CountryState>; handles: Record<string, HandleState>;
}
export interface GeoCountry { code: string; name: string; color: string; anchor: number; hexes: number }
export interface GeoData { version: 1; N: number; countries: GeoCountry[]; points: number[]; owner: number[] }
