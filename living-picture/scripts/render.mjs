#!/usr/bin/env node
// Renders a looping "living picture" video from a still image.
//
//   npm run render -- --image images/puppy-garden.png
//   npm run render -- --image images/my-art.png --loop 15 --repeat 2 --music song.mp3 --encoder nvenc
//
// Options
//   --image <file>     the illustration (put it in images/). Any size; it is cover-fitted to 9:16.
//   --out <file.mp4>   default out/<image name>.mp4
//   --loop <s>         loop length in seconds (default 12) — the video loops seamlessly
//   --repeat <n>       repeat the loop n times in the file (default 1)
//   --fps <n>          default 30
//   --water <k>        water flow strength 0..2 (default 1; 0 = off)
//   --petals <n>       number of falling petals (default 46; 0 = off)
//   --butterflies <n>  default 4
//   --zoom <k>         camera breathing amount (default 0.035)
//   --music <file>     optional audio to add (otherwise no audio: add a trending sound in the app)
//   --encoder x264|nvenc|amf|qsv|videotoolbox
//   --headed / --chrome <path> / --gl <angle backend>
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import { startServer, ROOT } from './serve.mjs';

const a = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) { if (!argv[i].startsWith('--')) continue; const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) a[argv[i].slice(2)] = true; else { a[argv[i].slice(2)] = n; i++; } }

const image = String(a.image || 'images/puppy-garden.png').replace(/\\/g, '/');
if (!fs.existsSync(path.join(ROOT, image))) { console.error(`Image not found: ${image} (put it inside the living-picture folder, e.g. images/)`); process.exit(1); }
const name = path.basename(image).replace(/\.[^.]+$/, '');
const out = path.resolve(ROOT, a.out || `out/${name}.mp4`);
const fps = Number(a.fps || 30), loop = Number(a.loop || 12), repeat = Math.max(1, Number(a.repeat || 1));
const ENC = {
  x264: ['-c:v', 'libx264', '-preset', 'slow', '-crf', '15'],
  nvenc: ['-c:v', 'h264_nvenc', '-preset', 'p7', '-tune', 'hq', '-rc', 'vbr', '-cq', '16', '-b:v', '0'],
  amf: ['-c:v', 'h264_amf', '-quality', 'quality', '-rc', 'cqp', '-qp_i', '16', '-qp_p', '18'],
  qsv: ['-c:v', 'h264_qsv', '-global_quality', '17'],
  videotoolbox: ['-c:v', 'h264_videotoolbox', '-q:v', '75'],
}[String(a.encoder || 'x264')];
if (!ENC) { console.error('Unknown encoder'); process.exit(1); }
fs.mkdirSync(path.dirname(out), { recursive: true });

const q = new URLSearchParams({ render: '1', image, loop: String(loop) });
for (const k of ['water', 'petals', 'butterflies', 'zoom']) if (a[k] !== undefined) q.set(k, String(a[k]));

const server = await startServer(0);
const args = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1100,2060'];
if (a.gl) args.push(`--use-angle=${a.gl}`);
if (os.platform() === 'linux') args.push('--no-sandbox');
const browser = await puppeteer.launch({ headless: a.headed ? false : true, executablePath: a.chrome || process.env.CHROME_PATH || undefined, args, defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 }, protocolTimeout: 0 });
const done = async (c) => { try { await browser.close(); } catch {} server.close(); process.exit(c); };
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/web/index.html?${q}`);
  await page.waitForFunction(() => window.__lp?.ready, { timeout: 0 });
  console.log('GPU renderer:', await page.evaluate(() => window.__lp.renderer));
  const cdp = await page.createCDPSession();
  const grab = async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })).data, 'base64');

  if (a.still !== undefined) {
    for (const ts of String(a.still).split(',')) { await page.evaluate((t) => window.__lp.renderFrame(t), Number(ts)); const p = out.replace(/\.mp4$/, `_t${ts}.png`); fs.writeFileSync(p, await grab()); console.log('Still →', path.relative(process.cwd(), p)); }
    await done(0);
  }

  const total = Math.round(loop * fps);
  const ffArgs = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-'];
  const loopFile = repeat > 1 ? out.replace(/\.mp4$/, '_loop.mp4') : out;
  const musicNow = a.music && repeat === 1;
  if (musicNow) ffArgs.push('-stream_loop', '-1', '-i', path.resolve(a.music));
  ffArgs.push(...ENC, '-pix_fmt', 'yuv420p', '-r', String(fps));
  if (musicNow) ffArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  else ffArgs.push('-an');
  ffArgs.push('-movflags', '+faststart', loopFile);
  const ff = spawn(ffmpegPath, ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg failed')))));
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.__lp.renderFrame(t), i / fps);
    const png = await grab();
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 30 === 0 || i === total - 1) process.stdout.write(`\rFrame ${i + 1}/${total}  ETA ${(((Date.now() - t0) / (i + 1)) * (total - i - 1) / 1000).toFixed(0)}s   `);
  }
  ff.stdin.end(); await ffDone;
  if (repeat > 1) {
    // repeat the seamless loop n times (no re-encode), optionally add music
    const list = loopFile.replace(/\.mp4$/, '.txt');
    fs.writeFileSync(list, Array.from({ length: repeat }, () => `file '${path.basename(loopFile)}'`).join('\n'));
    const cat = [ '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list ];
    if (a.music) cat.push('-i', path.resolve(a.music), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest'); else cat.push('-c', 'copy');
    cat.push('-movflags', '+faststart', out);
    await new Promise((res, rej) => spawn(ffmpegPath, cat, { stdio: 'inherit', cwd: path.dirname(loopFile) }).on('close', (c) => (c === 0 ? res() : rej(new Error('concat failed')))));
    fs.unlinkSync(list); fs.unlinkSync(loopFile);
  }
  console.log(`\n\nVideo → ${path.relative(process.cwd(), out)}  (${(loop * repeat).toFixed(0)}s, loops seamlessly)\n`);
  await done(0);
} catch (e) { console.error('Render failed:', e.message); await done(1); }
