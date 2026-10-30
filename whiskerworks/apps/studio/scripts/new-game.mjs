#!/usr/bin/env node
/**
 * Scaffold a new game page.
 *   npm run new-game -- "Game Title" [--mood relax|think|action] [--genre Puzzle] [--status live|beta|soon]
 * Creates src/content/games/<slug>.md with every field documented. Edit it, then build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : def;
};
const mood = flag('mood', 'relax');
const genre = flag('genre', 'Puzzle');
const status = flag('status', 'soon');
const title = args.join(' ').trim();
if (!title) {
  console.error('Usage: npm run new-game -- "Game Title" [--mood relax|think|action] [--genre Puzzle] [--status live|beta|soon]');
  process.exit(1);
}
if (!['relax', 'think', 'action'].includes(mood) || !['live', 'beta', 'soon'].includes(status)) {
  console.error('mood must be relax|think|action and status live|beta|soon');
  process.exit(1);
}
const slug = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/content/games');
const file = path.join(dir, `${slug}.md`);
if (fs.existsSync(file)) {
  console.error(`Already exists: ${path.relative(process.cwd(), file)}`);
  process.exit(1);
}
const palette = [['#ff7a2f', '#ffc93c'], ['#6c5ce7', '#22b07a'], ['#ff4f7b', '#6c5ce7'], ['#22b07a', '#ffc93c'], ['#4fc3c9', '#ff7a2f']];
const [c1, c2] = palette[Math.floor(Math.random() * palette.length)];
const q = (s) => JSON.stringify(s);

fs.writeFileSync(
  file,
  `---
title: ${q(title)}
tagline: ${q(`One punchy line about ${title}.`)}
description: ${q(`Two sentences for Google and social previews: what ${title} is and why it is fun.`)}
status: ${status}            # live | beta | soon
genre: ${q(genre)}
mood: ${mood}              # relax | think | action  (home page picker)
platforms: [ios, android]  # ios, android, web, steam, switch
# releaseDate: 2026-12-01
price: Free to play
colors: ['${c1}', '${c2}']
motif: spark               # stack | orbit | hex | word | paw | wave | grid | spark (generated art until you add an icon)
# icon: ./images/${slug}/icon.png          # 1024×1024 PNG next to this file
# screenshots:
#   - { src: ./images/${slug}/1.png, alt: "Describe the screenshot" }
featured: false
order: 100
links:
  appStore: ''
  googlePlay: ''
  web: ''
  steam: ''
  trailer: ''
loop:
  - First thing you do
  - Then this
  - Then that
features:
  - title: Feature one
    body: Explain it in one or two sentences.
faq:
  - q: ${q(`Is ${title} free?`)}
    a: Yes. It is free to play.
keywords: []               # what people type in Google: "word puzzle offline", …
---

Long-form "About this game" text goes here (Markdown).
`,
);
console.log(`Created ${path.relative(process.cwd(), file)}\nEdit it, then run: npm run build`);
