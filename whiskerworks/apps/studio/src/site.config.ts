/**
 * Everything brand- and business-specific lives here.
 * Change the domain, socials or contact email in ONE place.
 * Empty strings hide the matching UI (a social icon, a store button…).
 */
function env(key: string, fallback: string): string {
  return ((import.meta.env as Record<string, string | undefined>)[key] ?? fallback).replace(/\/$/, '');
}

export const site = {
  name: 'WhiskerWorks',
  legalName: '9506-6320 Québec inc.',
  /** Shown next to the legal name: "WhiskerWorks, a 9506-6320 Québec inc. studio". */
  location: 'Québec, Canada',
  tagline: 'Games with nine lives.',
  description:
    'WhiskerWorks is an independent game studio from Québec making free, snackable games for iPhone and Android, plus live video series you play from the comments.',
  /** Production origin, no trailing slash. Also set SITE_URL in your host to override. */
  url: (import.meta.env.SITE_URL as string | undefined) ?? 'https://whiskerworks.games',
  email: 'bonjour@tazgo.ca',
  pressEmail: 'bonjour@tazgo.ca',
  locale: 'en',
  themeColor: '#1a1424',
  socials: {
    instagram: 'https://www.instagram.com/ads_noads/',
    tiktok: '',
    youtube: '',
    x: '',
    discord: '',
  },
  /**
   * Live series microsites. Each one is its own app in apps/<app> deployed to its own subdomain.
   * Order = display order. Set `live: false` to hide a series everywhere.
   */
  series: [
    { id: 'flagwars', app: 'flagwars', name: 'Flag Wars', rule: '1 comment = 1 flag', verb: 'Comment a country', blurb: 'Comment a country, plant its flag and watch it level up and take over the world map.', colors: ['#0f1640', '#4fc3c9'], accent: '#ffc93c', emoji: '🌍', url: env('FLAGWARS_URL', 'https://flagwars.whiskerworks.games'), live: true },
    { id: 'stadium', app: 'stadium', name: 'Stadium Builder', rule: '1 club = 1 stand', verb: 'Comment your club', blurb: 'Comment your football club: it gets its own stand, and every comment adds seats on the way to 100,000.', colors: ['#2f8f3a', '#9be15d'], accent: '#ffc93c', emoji: '⚽', url: env('STADIUM_URL', 'https://stadium.whiskerworks.games'), live: true },
    { id: 'arcade', app: 'arcade', name: 'Insert Coin Club', rule: '1 follower = 1 arcade machine', verb: 'Follow the account', blurb: 'Every follower gets a numbered arcade cabinet with their name on it, in a neon hall that grows every day.', colors: ['#12081f', '#ff3fd2'], accent: '#3ff2ff', emoji: '🕹️', url: env('ARCADE_URL', 'https://arcade.whiskerworks.games'), live: true },
    { id: 'noobbee', app: 'noobbee', name: 'Noob Bee', rule: '1 comment = 1 level up', verb: 'Teach the bee a skill', blurb: 'A very clumsy bee learns one new skill per comment. Your comment becomes a level, with your name on it.', colors: ['#f5b82e', '#9ed98a'], accent: '#5a3410', emoji: '🐝', url: env('NOOBBEE_URL', 'https://noobbee.whiskerworks.games'), live: true },
    { id: 'leveltower', app: 'leveltower', name: 'Level Tower', rule: '1 like = 1 floor', verb: 'Like and pick a world', blurb: 'Every like adds a floor to a tower of floating islands. Comment to pick the next world and sign the floor.', colors: ['#3d7be0', '#bfe3ff'], accent: '#ffd23f', emoji: '🏰', url: env('LEVELTOWER_URL', 'https://tower.whiskerworks.games'), live: true },
  ],
  /** Optional, privacy-friendly analytics. Leave empty to ship no analytics at all. */
  analytics: {
    plausibleDomain: (import.meta.env.PUBLIC_PLAUSIBLE_DOMAIN as string | undefined) ?? '',
  },
} as const;

export type Site = typeof site;
