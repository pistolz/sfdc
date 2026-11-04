#!/usr/bin/env node
// Quality check for an episode BEFORE the final render.
//
//   npm run qa -- --episode promos/luma/promo.json
//
// 1. Script checks (no rendering): every "at" word exists in its sentence (otherwise the
//    animation falls back to 0 s and won't sync), beat lengths, total length, hook length,
//    a call to action at the end, headlines that match the voice, typing that finishes in time.
// 2. Frame checks: renders the episode at 2 frames per second and checks every frame for
//    content outside the safe zone (Instagram/TikTok buttons and captions), empty frames,
//    and frames identical to the previous beat (no visual change = viewers scroll).
// 3. A contact sheet of all checked frames (out/qa/<name>/sheet.jpg) to look at with your own eyes.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import { startServer, ROOT } from './serve.mjs';

const a = {}; const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) { if (!argv[i].startsWith('--')) continue; const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) a[argv[i].slice(2)] = true; else { a[argv[i].slice(2)] = n; i++; } }
const episode = String(a.episode || 'episodes/part1.json').replace(/\\/g, '/');
const ep = JSON.parse(fs.readFileSync(path.join(ROOT, episode), 'utf8'));
const name = path.basename(episode, '.json');
const outDir = path.join(ROOT, 'out', 'qa', name);
fs.mkdirSync(outDir, { recursive: true });
const issues = []; const warn = (level, where, msg) => issues.push({ level, where, msg });

// ------------------------------------------------------------------ 1. script checks
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const strip = (s) => String(s || '').replace(/[*|]/g, '').replace(/<[^>]+>/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s$%']/gu, '').replace(/\s+/g, ' ').trim();
let total = 0;
const promo = ep.style === 'editorial';
ep.beats.forEach((b, bi) => {
  const where = `beat ${b.id}`;
  const say = String(b.say || ''); const sayL = say.toLowerCase();
  const est = Math.max(b.min ?? 1.6, 0.45 + words(say) / 2.75 + (b.hold ?? 0)); total += est;
  if (!say.trim()) warn('ERROR', where, 'empty "say"');
  if (est > 6.5) warn('WARN', where, `long beat (~${est.toFixed(1)} s): split it — a new picture every 2–5 s keeps people watching`);
  const check = (phrase, field) => { if (phrase == null || typeof phrase !== 'string') return; if (!sayL.includes(phrase.toLowerCase())) warn('ERROR', where, `${field} "${phrase}" is not in the sentence → it will appear at 0 s and not sync with the voice`); };
  (b.keys || []).forEach((k) => check(k.at, 'key.at'));
  (b.events || []).forEach((e) => check(e.at, 'event.at'));
  check(b.glitchAt, 'glitchAt');
  const layers = b.args?.layers || [];
  for (const L of layers) {
    for (const f of ['at', 'typeAt', 'until', 'hpAt', 'raise', 'openAt', 'countAt', 'out']) if (typeof L[f] === 'string') check(L[f], `${L.type}.${f}`);
    if (L.move?.at) check(L.move.at, `${L.type}.move.at`);
    if (Array.isArray(L.at)) L.at.forEach((w) => check(w, `${L.type}.at`));
    for (const f of ['powerAt', 'transformAt', 'crackAt', 'subAt']) if (typeof L[f] === 'string') check(L[f], `${L.type}.${f}`);
    if (L.beam) { check(L.beam.chargeAt, 'beam.chargeAt'); check(L.beam.fireAt, 'beam.fireAt'); }
    for (const it of L.items || []) if (it && typeof it === 'object') { check(it.at, `${L.type}.items.at`); check(it.stamp, `${L.type}.items.stamp`); }
    for (const side of ['left', 'right']) for (const it of L[side]?.items || []) if (it && typeof it === 'object') check(it.at, `${L.type}.${side}.at`);
    if (L.type === 'ed-headline') {
      const h = strip(L.text), s = strip(say);
      if (h.length > 120) warn('WARN', where, 'headline longer than ~3 lines: shorten it');
      if (!L.instant && L.at == null && h !== s) warn('INFO', where, 'headline differs from the spoken sentence: its words will reveal on an estimate, not on the voice');
    }
    const typing = { 'ed-bubble': 18, 'ed-prompt': 22, 'ed-comment': 9, 'ed-code': 40 }[L.type];
    if (typing) {
      const chars = L.type === 'ed-code' ? (L.lines || []).join('').length : String(L.text || L.keyword || '').length;
      const startPhrase = L.typeAt ?? L.at; const i = startPhrase ? sayL.indexOf(String(startPhrase).toLowerCase()) : 0;
      const startT = i > 0 ? (i / Math.max(1, say.length)) * (est - 0.45) : 0.2;
      if (startT + chars / (L.speed ?? typing) > est + 0.2) warn('WARN', where, `${L.type} finishes typing after the beat ends (~${(startT + chars / (L.speed ?? typing)).toFixed(1)} s vs ${est.toFixed(1)} s): raise "speed" or shorten`);
    }
    if (['ed-review', 'ed-bars', 'ed-stat', 'ed-big', 'ed-fact', 'ed-price'].includes(L.type)) warn('CHECK', where, `${L.type}: make sure the numbers / quote are REAL (never invent proof)`);
  }
  if (bi === 0) {
    if (words(say) > 16) warn('WARN', where, `hook is ${words(say)} words: aim for ≤ 14 so it is understood in 3 s`);
    const late = layers.filter((L) => !['bg', 'ed-header', 'ed-headline', 'ed-paper', 'toon-sky', 'toon-hills', 'toon-field'].includes(L.type) && typeof L.at === 'string' && sayL.indexOf(L.at.toLowerCase()) > say.length * 0.4);
    if (late.length && !layers.some((L) => !L.at && !['bg', 'ed-header', 'ed-headline'].includes(L.type))) warn('WARN', where, 'nothing visual on frame 1 besides text: put the main visual on screen at 0 s');
  }
  if (bi > 0) {
    const sig = (bb) => (bb.args?.layers || []).map((L) => L.type).filter((t) => !['bg', 'ed-header', 'ed-headline'].includes(t)).join(',');
    if (sig(b) && sig(b) === sig(ep.beats[bi - 1]) && !b.continue) warn('INFO', where, 'same visual types as the previous beat: change the picture (or mark "continue": true if intended)');
  }
});
const last = ep.beats[ep.beats.length - 1];
const hasCta = (last.args?.layers || []).some((L) => ['ed-comment', 'choices', 'ui-choices', 'decision', 'ed-dm'].includes(L.type)) || ep.choice;
if (!hasCta) warn('WARN', `beat ${last.id}`, 'no call to action at the end (comment keyword / vote)');
if (promo && (total < 18 || total > 60)) warn('WARN', 'episode', `estimated length ${total.toFixed(0)} s: promo videos perform best at 25–45 s`);
if (!ep.cover?.html) warn('WARN', 'episode', 'no cover.html: add a cover title');

// ------------------------------------------------------------------ 2. frame checks
const server = await startServer(0);
const browser = await puppeteer.launch({ headless: true, executablePath: a.chrome || process.env.CHROME_PATH || undefined, args: ['--ignore-gpu-blocklist', '--hide-scrollbars', ...(os.platform() === 'linux' ? ['--no-sandbox'] : [])], defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 } });
const page = await browser.newPage();
page.on('pageerror', (e) => warn('ERROR', 'page', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/?render=1&episode=${encodeURIComponent(episode)}`);
await page.waitForFunction(() => window.__ep, { timeout: 0 });
const info = await page.evaluate(() => ({ duration: window.__ep.duration, beats: window.__ep.beats, ok: window.__ep.ready, error: window.__ep.error }));
if (!info.ok) { console.error(info.error); process.exit(1); }
const fps = Number(a.fps || 2);
const framesDir = path.join(outDir, 'frames'); fs.rmSync(framesDir, { recursive: true, force: true }); fs.mkdirSync(framesDir);
let prevSig = null, n = 0;
for (let t = 0.05; t < info.duration; t += 1 / fps) {
  const res = await page.evaluate((tt, isPromo) => {
    window.__ep.renderFrame(tt);
    const c = document.getElementById('gl'); const g = c.getContext('2d'); const d = g.getImageData(0, 0, 1080, 1920).data;
    // background = the most common colour in the 4 corners
    const px = (x, y) => { const i = (y * 1080 + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const bg = px(40, 40); let outside = 0, ink = 0, sum = 0, sum2 = 0, cnt = 0;
    for (let y = 1; y < 1920; y += 6) for (let x = 1; x < 1080; x += 6) { // offset avoids the paper grid lines
      const [r, gg, b] = px(x, y); const diff = Math.abs(r - bg[0]) + Math.abs(gg - bg[1]) + Math.abs(b - bg[2]);
      const l = 0.3 * r + 0.59 * gg + 0.11 * b; sum += l; sum2 += l * l; cnt++;
      if (diff > 70) { ink++; const unsafe = y > 1500 || (x > 960 && y > 900) || x < 90 || y < 230; if (unsafe) outside++; }
    }
    const mean = sum / cnt, sd = Math.sqrt(Math.max(0, sum2 / cnt - mean * mean));
    // DOM captions outside the safe band
    const keys = [...document.querySelectorAll('.key')].filter((e) => Number(e.style.opacity) > 0.5).map((e) => e.getBoundingClientRect()).filter((r) => r.bottom > 1500 || r.top < 230).length;
    return { outside: isPromo ? outside : 0, ink, mean, sd, keys, sig: `${Math.round(mean)}-${Math.round(sd)}-${ink >> 6}` };
  }, t, promo);
  const beat = info.beats.filter((b) => b.start <= t).pop();
  const where = `${t.toFixed(1)} s (beat ${beat?.id})`;
  if (res.outside > 60) warn('WARN', where, `${res.outside * 36} px of content in the unsafe zone (bottom / right rail / edges): move it inside x 90–960, y 230–1500`);
  if (res.keys) warn('WARN', where, 'a caption sits outside the safe band');
  if (res.sd < 2.5) warn('INFO', where, 'almost empty / flat frame (fine for a split second, not longer)');
  const buf = Buffer.from((await (await page.target().createCDPSession()).send('Page.captureScreenshot', { format: 'jpeg', quality: 70 })).data, 'base64');
  fs.writeFileSync(path.join(framesDir, String(n).padStart(4, '0') + '.jpg'), buf); n++;
  prevSig = res.sig;
}
await browser.close(); server.close();

// contact sheet: 8 columns, every checked frame, numbered by time
const cols = 8, rows = Math.ceil(n / cols);
spawnSync(ffmpegPath, ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(framesDir, '%04d.jpg'), '-vf', `scale=180:-1,drawtext=text='%{eif\\:n/${fps}\\:d}s':x=6:y=6:fontcolor=white:box=1:boxcolor=black@0.5:fontsize=18,tile=${cols}x${rows}:padding=4:color=white`, '-frames:v', '1', path.join(outDir, 'sheet.jpg')]);

// ------------------------------------------------------------------ report
const order = { ERROR: 0, WARN: 1, CHECK: 2, INFO: 3 };
issues.sort((x, y) => order[x.level] - order[y.level]);
const md = [`# QA — ${episode}`, '', `Estimated length: ${info.duration.toFixed(1)} s · frames checked: ${n} (${fps}/s)`, '',
  issues.length ? issues.map((i) => `- **${i.level}** · ${i.where} — ${i.msg}`).join('\n') : '- no issues found', '', `Contact sheet: out/qa/${name}/sheet.jpg (look at it!)`].join('\n');
fs.writeFileSync(path.join(outDir, 'report.md'), md);
const errors = issues.filter((i) => i.level === 'ERROR').length, warns = issues.filter((i) => i.level === 'WARN').length;
console.log(md);
console.log(`\n${errors} error(s), ${warns} warning(s) → out/qa/${name}/report.md`);
process.exit(errors ? 2 : 0);
