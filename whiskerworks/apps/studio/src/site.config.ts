/**
 * Everything brand- and business-specific lives here.
 * Change the domain, socials or contact email in ONE place.
 * Empty strings hide the matching UI (a social icon, a store button…).
 */
export const site = {
  name: 'WhiskerWorks',
  legalName: 'WhiskerWorks Studio',
  tagline: 'Games with nine lives.',
  description:
    'WhiskerWorks is an independent game studio making small, replayable games for iPhone, Android and the web, plus live video series you play from the comments.',
  /** Production origin, no trailing slash. Also set SITE_URL in your host to override. */
  url: (import.meta.env.SITE_URL as string | undefined) ?? 'https://whiskerworks.games',
  email: 'hello@whiskerworks.games',
  pressEmail: 'press@whiskerworks.games',
  locale: 'en',
  themeColor: '#1a1424',
  socials: {
    instagram: 'https://www.instagram.com/ads_noads/',
    tiktok: '',
    youtube: '',
    x: '',
    discord: '',
  },
  /** Live series microsites (subdomains). */
  series: {
    flagWars: {
      url: (import.meta.env.FLAGWARS_URL as string | undefined) ?? 'https://flagwars.whiskerworks.games',
    },
  },
  /** Optional, privacy-friendly analytics. Leave empty to ship no analytics at all. */
  analytics: {
    plausibleDomain: (import.meta.env.PUBLIC_PLAUSIBLE_DOMAIN as string | undefined) ?? '',
  },
} as const;

export type Site = typeof site;
