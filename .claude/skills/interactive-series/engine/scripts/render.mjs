#!/usr/bin/env node
// Offline renderer: draws the episode in Chrome frame by frame and pipes
// every frame into ffmpeg → 1080×1920 MP4 (voice + sound effects) + cover PNG.
//
//   npm run voice  -- --episode episodes/part1.json     (once, makes the voice-over)
//   npm run render -- --episode episodes/part1.json
//
// Options
//   --episode <file>    episode JSON (default episodes/part1.json)
//   --out <file.mp4>    output path (default out/<episode>.mp4)
//   --fps <n>           frames per second (default 30)
//   --encoder <name>    x264 (default, CPU) | nvenc (NVIDIA) | amf (AMD) | qsv (Intel) | videotoolbox (Mac)
//   --gl <backend>      force Chrome's ANGLE backend: d3d11 | vulkan | gl | metal (default: Chrome decides)
//   --headed            open a visible Chrome window (use if headless falls back to software rendering)
//   --chrome <path>     use this Chrome/Chromium binary instead of Puppeteer's
//   --from <s> --to <s> render only part of the episode (quick tests)
//   --still <t,t,...>   only save still frames at these seconds (no video)
//   --workers <n>       parallel render pages (default: min(4, CPU cores - 1))
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
const episode = (args.episode || 'episodes/part1.json').replace(/\\/g, '/');
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
  await page.waitForFunction(() => window.__ep, { timeout: 0 });
  const info = await page.evaluate(() => ({ ready: window.__ep.ready, error: window.__ep.error, duration: window.__ep.duration, renderer: window.__ep.renderer, audio: window.__ep.audio, voice: window.__ep.voice, bed: window.__ep.bed, hasVoice: window.__ep.hasVoice }));
  if (!info.ready) throw new Error(info.error);
  if (!info.hasVoice) console.warn('\n⚠  No voice-over found: the video will be timed on an estimate and have no narration.\n   Run first:  npm run voice -- --episode ' + episode + '\n');


  const from = Number(args.from || 0);
  const to = Math.min(Number(args.to || info.duration), info.duration);
  const frames = Math.round((to - from) * fps);
  console.log(`Episode ${episode}: ${(to - from).toFixed(1)}s → ${frames} frames @ ${fps}fps, ${Math.round(1080 * scale)}×${Math.round(1920 * scale)}, encoder ${encoder}`);

  // Soundtrack
  const wavPath = out.replace(/\.mp4$/i, '') + '.wav';
  const timingsFile = path.join(ROOT, 'out', 'voice', base, 'timings.json');
  const timings = fs.existsSync(timingsFile) ? JSON.parse(fs.readFileSync(timingsFile, 'utf8')) : {};
  const voice = info.voice.filter((v) => timings[v.id]).map((v) => ({ t: v.t - from, file: path.join(ROOT, timings[v.id].file) })).filter((v) => v.t > -60);
  const sfx = info.audio.map((e) => ({ ...e, t: e.t - from })).filter((e) => e.t > -2.5);
  fs.writeFileSync(wavPath, renderAudio({ voice, sfx, duration: to - from, bed: info.bed }));
  // loudness: two-pass EBU R128 normalisation to -14 LUFS / -1.5 dBTP (the social-media standard)
  try {
    const { spawnSync } = await import('node:child_process');
    const m = spawnSync(ffmpegPath, ['-hide_banner', '-i', wavPath, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
    const js = JSON.parse((m.stderr || '').slice((m.stderr || '').lastIndexOf('{')));
    if (Number.isFinite(Number(js.input_i))) {
      const normPath = wavPath.replace(/\.wav$/, '_norm.wav');
      const r = spawnSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-i', wavPath, '-af', `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${js.input_i}:measured_TP=${js.input_tp}:measured_LRA=${js.input_lra}:measured_thresh=${js.input_thresh}:offset=${js.target_offset}:linear=true`, '-ar', '48000', normPath]);
      if (r.status === 0) { fs.renameSync(normPath, wavPath); console.log(`Audio  → normalised from ${js.input_i} LUFS to -14 LUFS`); }
    }
  } catch (e) { console.warn('loudness normalisation skipped:', e.message); }

  const cdp = await page.createCDPSession();
  const grab = async () => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, fromSurface: true });
    return Buffer.from(data, 'base64');
  };

  // Cover image (thumbnail) for the Reel
  await page.evaluate(() => window.__ep.renderCover());
  const coverPath = out.replace(/\.mp4$/i, '') + '_cover.png';
  fs.writeFileSync(coverPath, await grab());
  console.log(`Cover  → ${path.relative(process.cwd(), coverPath)}`);

  if (args.still !== undefined) {
    // Debug / preview: save single frames, e.g. --still 2,7.5,12
    for (const ts of String(args.still).split(',')) {
      await page.evaluate((tt) => window.__ep.renderFrame(tt), Number(ts));
      const p = out.replace(/\.mp4$/i, '') + `_t${ts}.png`;
      fs.writeFileSync(p, await grab());
      console.log(`Still  → ${path.relative(process.cwd(), p)}`);
    }
    fs.unlinkSync(wavPath);
    await cleanup(0);
  }

  // ---- parallel render: N browser pages each encode a contiguous chunk, then the chunks are joined losslessly
  const workers = Math.max(1, Math.min(Number(args.workers || Math.min(4, Math.max(1, os.cpus().length - 1))), Math.ceil(frames / 30)));
  const vf = scale !== 1 ? ['-vf', `scale=${Math.round(1080 * scale / 2) * 2}:${Math.round(1920 * scale / 2) * 2}`] : [];
  const url = page.url();
  const chunks = [];
  for (let w = 0; w < workers; w++) chunks.push([Math.floor((frames * w) / workers), Math.floor((frames * (w + 1)) / workers)]);
  const partFiles = chunks.map((_, w) => out.replace(/\.mp4$/i, '') + `.part${w}.mp4`);
  let done = 0; const t0 = Date.now();
  const progress = () => { const el = (Date.now() - t0) / 1000; const eta = (el / Math.max(1, done)) * (frames - done); process.stdout.write(`\rFrame ${done}/${frames}  ${((done / frames) * 100).toFixed(0)}%  ${workers} worker(s)  ETA ${eta.toFixed(0)}s   `); };
  await Promise.all(chunks.map(async ([fa, fb], w) => {
    // one browser process per worker: background tabs of a single browser stop painting
    let pg = page, cd = cdp, br = null;
    if (w > 0) {
      br = await puppeteer.launch({ headless: true, executablePath: args.chrome || process.env.CHROME_PATH || undefined, args: chromeArgs, defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: scale }, protocolTimeout: 0 });
      pg = await br.newPage();
      await pg.goto(url); await pg.waitForFunction(() => window.__ep?.ready, { timeout: 0 });
      cd = await pg.createCDPSession();
    }
    const ff = spawn(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', ...vf, ...ENCODERS[encoder], '-pix_fmt', 'yuv420p', '-r', String(fps), '-an', partFiles[w]], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ffDone = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited with code ${c}${encoder !== 'x264' ? ' (is your GPU encoder available? try --encoder x264)' : ''}`)))));
    for (let i = fa; i < fb; i++) {
      await pg.evaluate((tt) => window.__ep.renderFrame(tt), from + i / fps);
      const { data } = await cd.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, fromSurface: true });
      if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
      done++; if (done % 15 === 0 || done === frames) progress();
    }
    ff.stdin.end(); await ffDone;
    if (br) await br.close();
  }));
  const list = out.replace(/\.mp4$/i, '') + '.parts.txt';
  fs.writeFileSync(list, partFiles.map((f) => `file '${path.basename(f)}'`).join('\n'));
  await new Promise((res, rej) => spawn(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.basename(list), '-i', wavPath, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit', cwd: path.dirname(out) }).on('close', (c) => (c === 0 ? res() : rej(new Error('joining the chunks failed')))));
  for (const f of [...partFiles, list]) fs.rmSync(f, { force: true });
  fs.unlinkSync(wavPath);
  console.log(`\n\nVideo  → ${path.relative(process.cwd(), out)}\n`);
  await cleanup(0);
} catch (e) {
  console.error('\nRender failed:', e.message);
  await cleanup(1);
}
