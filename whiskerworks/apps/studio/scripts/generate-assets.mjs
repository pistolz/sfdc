#!/usr/bin/env node
/**
 * Build-time asset generation for the studio site. Runs automatically before `astro build`
 * (npm "prebuild"), and can be run by hand: `node scripts/generate-assets.mjs`.
 *
 *  1. Brand files      → public/brand/*, favicons, PWA icons
 *  2. Land dot globe   → src/data/land-dots.json (home + series page animation)
 *  3. Social images    → public/og/*.png (1200×630) for every page and game
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import YAML from 'yaml';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pub = path.join(root, 'public');
const brandSrc = path.resolve(root, '../../packages/brand');
const force = process.argv.includes('--force');

const ensure = (p) => fs.mkdirSync(p, { recursive: true });
const log = (...a) => console.log('  [assets]', ...a);

/* ───────── 1. Brand files ───────── */
ensure(path.join(pub, 'brand'));
const markSvg = fs.readFileSync(path.join(brandSrc, 'mark.svg'), 'utf8');
fs.copyFileSync(path.join(brandSrc, 'mark.svg'), path.join(pub, 'favicon.svg'));
fs.copyFileSync(path.join(brandSrc, 'mark.svg'), path.join(pub, 'brand/whiskerworks-mark.svg'));
fs.copyFileSync(path.join(brandSrc, 'mark-mono.svg'), path.join(pub, 'brand/whiskerworks-mark-mono.svg'));

function svgToPng(svg, width, out) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
  fs.writeFileSync(out, png);
}
const pngTargets = [
  ['favicon-32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['brand/whiskerworks-mark-512.png', 512],
  ['brand/whiskerworks-mark-1024.png', 1024],
];
for (const [file, w] of pngTargets) {
  const out = path.join(pub, file);
  if (force || !fs.existsSync(out)) svgToPng(markSvg, w, out);
}
// Maskable icon: mark inside the safe zone on an ink background.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1A1424"/><g transform="translate(9.6 9.6) scale(0.7)">${markSvg.replace(/<\/?svg[^>]*>/g, '')}</g></svg>`;
if (force || !fs.existsSync(path.join(pub, 'icon-maskable-512.png'))) svgToPng(maskable, 512, path.join(pub, 'icon-maskable-512.png'));
log('brand + icons ok');

/* ───────── 2. Land dots for the animated globe ───────── */
const dotsOut = path.join(root, 'src/data/land-dots.json');
if (force || !fs.existsSync(dotsOut)) {
  const countries = require('i18n-iso-countries');
  const topo = require('world-atlas/countries-110m.json');
  const fc = feature(topo, topo.objects.countries);
  const feats = fc.features.map((f) => ({ f, code: countries.numericToAlpha2(String(f.id).padStart(3, '0')) ?? '' }));
  const dots = [];
  const step = 2.4;
  for (let lat = -58; lat <= 82; lat += step) {
    const lonStep = step / Math.max(0.25, Math.cos((lat * Math.PI) / 180));
    for (let lon = -180; lon < 180; lon += lonStep) {
      const hit = feats.find(({ f }) => geoContains(f, [lon, lat]));
      if (hit) dots.push([Math.round(lon * 10) / 10, Math.round(lat * 10) / 10, hit.code]);
    }
  }
  ensure(path.dirname(dotsOut));
  fs.writeFileSync(dotsOut, JSON.stringify(dots));
  log(`land dots: ${dots.length}`);
}

/* ───────── 3. Open Graph images ───────── */
const fontDir = (pkg) => path.dirname(require.resolve(`@fontsource/${pkg}/package.json`)) + '/files';
const fonts = [
  { name: 'Unbounded', weight: 800, data: fs.readFileSync(`${fontDir('unbounded')}/unbounded-latin-800-normal.woff`) },
  { name: 'Unbounded', weight: 600, data: fs.readFileSync(`${fontDir('unbounded')}/unbounded-latin-600-normal.woff`) },
  { name: 'Figtree', weight: 600, data: fs.readFileSync(`${fontDir('figtree')}/figtree-latin-600-normal.woff`) },
];
const h = (type, style, children) => ({ type, props: { style: { display: 'flex', ...style }, children } });
const markUri = `data:image/svg+xml;base64,${Buffer.from(markSvg).toString('base64')}`;

function ogCard({ kicker, title, sub, colors = ['#FF7A2F', '#FFC93C'], dark = false }) {
  const bg = dark ? '#120E1A' : '#FFF8EE';
  const fg = dark ? '#F4ECFF' : '#1A1424';
  return h('div', { width: 1200, height: 630, background: bg, padding: 64, flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'Figtree', position: 'relative' }, [
    h('div', { position: 'absolute', right: -120, top: -120, width: 560, height: 560, borderRadius: 280, background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`, opacity: dark ? 0.55 : 0.9 }),
    h('div', { position: 'absolute', right: 120, bottom: -160, width: 360, height: 360, borderRadius: 180, border: `6px solid ${fg}`, opacity: 0.12 }),
    h('div', { alignItems: 'center', gap: 18 }, [
      { type: 'img', props: { src: markUri, width: 72, height: 72, style: { borderRadius: 16 } } },
      h('div', { fontFamily: 'Unbounded', fontWeight: 600, fontSize: 34, color: fg, letterSpacing: -1 }, 'WhiskerWorks'),
    ]),
    h('div', { flexDirection: 'column', gap: 18, maxWidth: 900 }, [
      h('div', { fontFamily: 'Unbounded', fontWeight: 600, fontSize: 22, letterSpacing: 4, color: dark ? '#FFC93C' : '#A43D00', textTransform: 'uppercase' }, kicker),
      h('div', { fontFamily: 'Unbounded', fontWeight: 800, fontSize: title.length > 26 ? 66 : 84, lineHeight: 1.0, letterSpacing: -3, color: fg }, title),
      sub ? h('div', { fontSize: 32, lineHeight: 1.3, color: dark ? '#B4A8C4' : '#3B3346', maxWidth: 860 }, sub) : null,
    ].filter(Boolean)),
  ]);
}

async function writeOg(name, opts) {
  const out = path.join(pub, 'og', `${name}.png`);
  const svg = await satori(ogCard(opts), { width: 1200, height: 630, fonts });
  fs.writeFileSync(out, new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng());
}

ensure(path.join(pub, 'og'));
await writeOg('default', { kicker: 'Independent game studio', title: 'Small games with nine lives.', sub: 'Replayable games for iPhone, Android and the web. No ads, ever.' });
await writeOg('games', { kicker: 'The catalogue', title: 'Every WhiskerWorks game', sub: 'Find your next game: relax, think or go fast.' });
await writeOg('series', { kicker: 'Live series', title: 'Shows you play from the comments.', sub: 'Comment on Instagram, TikTok or YouTube and change what happens next.', colors: ['#6C5CE7', '#4FC3C9'], dark: true });
await writeOg('about', { kicker: 'The studio', title: 'Made by humans who love cats and good games.', colors: ['#22B07A', '#FFC93C'] });

const gamesDir = path.join(root, 'src/content/games');
for (const file of fs.readdirSync(gamesDir).filter((f) => f.endsWith('.md') && !f.startsWith('_'))) {
  const src = fs.readFileSync(path.join(gamesDir, file), 'utf8');
  const fm = YAML.parse(src.split(/^---$/m)[1] ?? '') ?? {};
  if (fm.draft) continue;
  const status = { live: 'Out now', beta: 'In beta', soon: 'Coming soon' }[fm.status ?? 'soon'];
  await writeOg(`game-${file.replace(/\.md$/, '')}`, { kicker: `${fm.genre ?? 'Game'} · ${status}`, title: fm.title, sub: fm.tagline, colors: fm.colors ?? undefined });
}
log('og images ok');
