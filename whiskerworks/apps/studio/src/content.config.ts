import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * One Markdown file per game in src/content/games/.
 * Add a game:   npm run new-game -- "Game Title"
 * The body of the file is the long-form "About this game" copy.
 */
const games = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/games' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** One line, shown on cards. Keep it under ~90 characters. */
      tagline: z.string().max(140),
      /** 1–2 sentences for search engines and social previews. */
      description: z.string().max(300),
      status: z.enum(['live', 'beta', 'soon', 'dev']).default('soon'),
      /** Puzzle, Arcade, Word, Strategy, Idle… free text, shown as kicker. */
      genre: z.string(),
      /** Drives the "Find your next game" picker on the home page. */
      mood: z.enum(['relax', 'think', 'action']),
      platforms: z.array(z.enum(['ios', 'android', 'web', 'steam', 'switch'])).default(['ios', 'android']),
      releaseDate: z.coerce.date().optional(),
      links: z
        .object({
          appStore: z.string().url().or(z.literal('')).default(''),
          googlePlay: z.string().url().or(z.literal('')).default(''),
          web: z.string().url().or(z.literal('')).default(''),
          steam: z.string().url().or(z.literal('')).default(''),
          trailer: z.string().url().or(z.literal('')).default(''),
        })
        .default({}),
      price: z.string().default('Free to play'),
      /** Short business-model note shown on the product page. */
      monetization: z.string().default('In-app purchases'),
      /** Folder of this game's legal pages in /public (privacy.html, terms.html, support.html + -fr). */
      legal: z.string().optional(),
      languages: z.array(z.string()).default([]),
      /** Brand colours of the game: [main, secondary]. */
      colors: z.tuple([z.string(), z.string()]),
      /** Generated artwork motif, used until a real icon is added. */
      motif: z.enum(['stack', 'orbit', 'hex', 'word', 'paw', 'wave', 'grid', 'spark']).default('spark'),
      icon: image().optional(),
      screenshots: z.array(z.object({ src: image(), alt: z.string() })).default([]),
      /** "The loop": 3–5 short steps describing a run. */
      loop: z.array(z.string()).default([]),
      features: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
      faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
      /** Search phrases people actually type: "word ladder game", "cat puzzle game"… */
      keywords: z.array(z.string()).default([]),
      featured: z.boolean().default(false),
      /** Lower comes first. */
      order: z.number().default(100),
      /** Sample entry shipped with the template. Set SHOW_SAMPLES=false to hide all of them. */
      sample: z.boolean().default(false),
      draft: z.boolean().default(false),
    }),
});

export const collections = { games };
