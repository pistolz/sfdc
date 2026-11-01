#!/usr/bin/env node
/**
 * Import browser-playable demos from the ads-creator repo (pistolz/playables) into the studio site.
 *
 *   node scripts/import-playables.mjs /path/to/playables/ads-creator
 *
 * For each game below it unzips the chosen build, takes the "meta" network page (it has no ad-network SDK, so in a
 * browser the PLAY button falls back to window.install), injects a hook so that button asks the host page to open
 * the right store (see src/pages/games/[slug]/play.astro), and writes public/playables/<slug>/<lang>.html.
 * Then add `playable: [en, fr]` to the game's Markdown file.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('usage: node scripts/import-playables.mjs /path/to/playables/ads-creator');
  process.exit(1);
}
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/playables');

/** slug → { lang: zip inside ads-creator }. Pick the best-performing variant here. */
const PLAYABLES = {
  'pollen-path': {
    en: 'pollenpath/v2/out/pollenpath_v2_asmr_A_all_networks.zip',
    fr: 'pollenpath/v2/out/pollenpath_v2_asmr_A_FR_all_networks.zip',
  },
  'call-it': { en: 'callit/v1/out/callit_v1_A_all_networks.zip' },
  'honey-trails': { en: 'honeytrails/creatives/playables_hybrid/HT_H2_asmr_meta.zip' },
};

const HOOK =
  '<script>/* WhiskerWorks web demo: the PLAY / INSTALL button asks the host page to open the right store. */' +
  'window.install=function(){try{parent.postMessage({type:"ww-install"},"*")}catch(e){}};' +
  'window.addEventListener("load",function(){try{parent.postMessage({type:"ww-playable-ready"},"*")}catch(e){}});</script>';

for (const [slug, langs] of Object.entries(PLAYABLES)) {
  for (const [lang, zip] of Object.entries(langs)) {
    const zipPath = path.join(src, zip);
    if (!fs.existsSync(zipPath)) { console.warn(`  skip ${slug}/${lang}: ${zip} not found`); continue; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-'));
    execFileSync('unzip', ['-q', '-o', zipPath, '-d', tmp]);
    const page = [path.join(tmp, 'meta/index.html'), path.join(tmp, 'index.html')].find((p) => fs.existsSync(p));
    if (!page) { console.warn(`  skip ${slug}/${lang}: no meta/index.html in ${zip}`); continue; }
    let html = fs.readFileSync(page, 'utf8');
    html = html.replace(/<head>/i, `<head>${HOOK}`);
    fs.mkdirSync(path.join(out, slug), { recursive: true });
    fs.writeFileSync(path.join(out, slug, `${lang}.html`), html);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`  ✔ ${slug}/${lang}.html (${Math.round(html.length / 1024)} KB)`);
  }
}
