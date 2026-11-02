#!/usr/bin/env node
// Offline renderer: drives the Three.js scene in Chrome frame by frame
// and pipes every frame into ffmpeg → 1080×1920 MP4 + cover PNG.
//
//   npm run render -- --episode episodes/day01.json
//   npm run render -- --episode episodes/day02.json --encoder nvenc
//
// Options
//   --episode <file>    episode JSON (default episodes/day01.json)
//   --out <file.mp4>    output path (default out/<episode>.mp4)
//   --fps <n>           frames per second (default 30)
//   --encoder <name>    x264 (default, CPU) | nvenc (NVIDIA) | amf (AMD) | qsv (Intel) | videotoolbox (Mac)
//   --gl <backend>      force Chrome's ANGLE backend: d3d11 | vulkan | gl | metal (default: Chrome decides)
//   --headed            open a visible Chrome window (use if headless falls back to software rendering)
//   --chrome <path>     use this Chrome/Chromium binary instead of Puppeteer's
//   --from <s> --to <s> render only part of the episode (quick tests)
//   --still <t,t,...>   only save still frames at these seconds (no video)
//   --scale <k>         render at k × 1080p (e.g. 0.5 for fast drafts)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import { startServer, ROOT } from './serve.mjs';
import { renderAudio } from './audio.mjs';

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) o[k] = true;
    else { o[k] = next; i++; }
  }
  return o;
}

const args = parseArgs(process.argv.slice(2));
const episode = (args.episode || 'episodes/day01.json').replace(/\\/g, '/');
const base = path.basename(episode, '.json');
const out = path.resolve(ROOT, args.out || `out/${base}.mp4`);
const fps = Number(args.fps || 30);
const scale = Number(args.scale || 1);
const encoder = String(args.encoder || 'x264').toLowerCase();
fs.mkdirSync(path.dirname(out), { recursive: true });

if (!fs.existsSync(path.join(ROOT, episode))) {
  console.error(`Episode not found: ${episode}`);
  process.exit(1);
}

const ENCODERS = {
  x264: ['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high'],
  nvenc: ['-c:v', 'h264_nvenc', '-preset', 'p7', '-tune', 'hq', '-rc', 'vbr', '-cq', '17', '-b:v', '0', '-profile:v', 'high'],
  amf: ['-c:v', 'h264_amf', '-quality', 'quality', '-rc', 'cqp', '-qp_i', '17', '-qp_p', '19'],
  qsv: ['-c:v', 'h264_qsv', '-preset', 'veryslow', '-global_quality', '18'],
  videotoolbox: ['-c:v', 'h264_videotoolbox', '-q:v', '70'],
};
if (!ENCODERS[encoder]) {
  console.error(`Unknown encoder "${encoder}". Use one of: ${Object.keys(ENCODERS).join(', ')}`);
  process.exit(1);
}

const server = await startServer(0);
const port = server.address().port;

const chromeArgs = [
  '--ignore-gpu-blocklist',
  '--enable-gpu-rasterization',
  '--enable-zero-copy',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  `--window-size=${1080 + 20},${1920 + 140}`,
];
if (args.gl) chromeArgs.push(`--use-angle=${args.gl}`);
if (os.platform() === 'linux') chromeArgs.push('--no-sandbox');

const browser = await puppeteer.launch({
  headless: args.headed ? false : true,
  executablePath: args.chrome || process.env.CHROME_PATH || undefined,
  args: chromeArgs,
  defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: scale },
  protocolTimeout: 0,
});

async function cleanup(code) {
  try { await browser.close(); } catch {}
  server.close();
  process.exit(code);
}

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  const camQ = args.cam ? `&cam=${encodeURIComponent(args.cam)}` : '';
  await page.goto(`http://127.0.0.1:${port}/?render=1&episode=${encodeURIComponent(episode)}${camQ}`);
  await page.waitForFunction(() => window.__marina, { timeout: 0 });
  const info = await page.evaluate(() => ({ ready: window.__marina.ready, error: window.__marina.error, duration: window.__marina.duration, renderer: window.__marina.renderer, audio: window.__marina.audio }));
  if (!info.ready) throw new Error(info.error);

  console.log(`\nGPU renderer: ${info.renderer}`);
  if (/swiftshader|llvmpipe|software|basic render/i.test(info.renderer)) {
    console.warn('⚠  Chrome is rendering on the CPU (software). It will work, but slowly.');
    console.warn('   Try: --headed   or   --gl d3d11 (Windows) / --gl vulkan (Linux) / --gl metal (Mac)\n');
  }

  const from = Number(args.from || 0);
  const to = Math.min(Number(args.to || info.duration), info.duration);
  const frames = Math.round((to - from) * fps);
  console.log(`Episode ${episode}: ${(to - from).toFixed(1)}s → ${frames} frames @ ${fps}fps, ${Math.round(1080 * scale)}×${Math.round(1920 * scale)}, encoder ${encoder}`);

  // Soundtrack
  const wavPath = out.replace(/\.mp4$/i, '') + '.wav';
  const shifted = info.audio.map((e) => ({ ...e, t: e.t - from })).filter((e) => e.t > -2.5);
  fs.writeFileSync(wavPath, renderAudio(shifted, to - from));

  const cdp = await page.createCDPSession();
  const grab = async () => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, fromSurface: true });
    return Buffer.from(data, 'base64');
  };

  // Cover image (thumbnail) for the Reel
  await page.evaluate(() => window.__marina.renderCover());
  const coverPath = out.replace(/\.mp4$/i, '') + '_cover.png';
  fs.writeFileSync(coverPath, await grab());
  console.log(`Cover  → ${path.relative(process.cwd(), coverPath)}`);

  if (args.still !== undefined) {
    // Debug / preview: save single frames, e.g. --still 2,7.5,12
    for (const ts of String(args.still).split(',')) {
      await page.evaluate((tt) => window.__marina.renderFrame(tt), Number(ts));
      const p = out.replace(/\.mp4$/i, '') + `_t${ts}.png`;
      fs.writeFileSync(p, await grab());
      console.log(`Still  → ${path.relative(process.cwd(), p)}`);
    }
    fs.unlinkSync(wavPath);
    await cleanup(0);
  }

  const ff = spawn(ffmpegPath, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-i', wavPath,
    ...(scale !== 1 ? ['-vf', `scale=${Math.round(1080 * scale / 2) * 2}:${Math.round(1920 * scale / 2) * 2}`] : []),
    ...ENCODERS[encoder],
    '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
    out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited with code ${c}${encoder !== 'x264' ? ` (is your GPU encoder available? try --encoder x264)` : ''}`)))));

  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const t = from + i / fps;
    await page.evaluate((tt) => window.__marina.renderFrame(tt), t);
    const png = await grab();
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 15 === 0 || i === frames - 1) {
      const el = (Date.now() - t0) / 1000;
      const eta = (el / (i + 1)) * (frames - i - 1);
      process.stdout.write(`\rFrame ${i + 1}/${frames}  ${(((i + 1) / frames) * 100).toFixed(0)}%  ${(el / (i + 1) * 1000).toFixed(0)} ms/frame  ETA ${eta.toFixed(0)}s   `);
    }
  }
  ff.stdin.end();
  await ffDone;
  fs.unlinkSync(wavPath);
  console.log(`\n\nVideo  → ${path.relative(process.cwd(), out)}\n`);
  await cleanup(0);
} catch (e) {
  console.error('\nRender failed:', e.message);
  await cleanup(1);
}
