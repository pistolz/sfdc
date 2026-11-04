#!/usr/bin/env node
// Render a format to a 1080×1920 MP4 (silent by default: add a trending sound in the app).
//   node scripts/render.mjs --scene dominoes [--fps 30] [--still 2,8] [--music] [--chrome PATH] [--out out/x.mp4] [--seed 3]
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const a = {}; const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) { if (!argv[i].startsWith('--')) continue; const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) a[argv[i].slice(2)] = true; else { a[argv[i].slice(2)] = n; i++; } }
const scene = a.scene || 'dominoes', fps = Number(a.fps || 30);
const extra = Object.entries(a).filter(([k]) => !['scene', 'fps', 'still', 'chrome', 'out', 'gl', 'headed'].includes(k)).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');
const out = path.resolve(ROOT, a.out || `out/${scene}${a.seed ? '-' + a.seed : ''}.mp4`);
fs.mkdirSync(path.dirname(out), { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(ROOT, u === '/' ? 'web/index.html' : u.startsWith('/node_modules/') ? u : path.join('web', u));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const chromeArgs = ['--hide-scrollbars', '--ignore-gpu-blocklist', '--enable-webgl', '--use-gl=angle', `--use-angle=${a.gl || 'swiftshader'}`, '--enable-unsafe-swiftshader', ...(os.platform() === 'linux' ? ['--no-sandbox'] : [])];
if (a.gl === 'gpu') chromeArgs.splice(chromeArgs.indexOf('--use-angle=gpu'), 1, '--use-angle=default');
const browser = await puppeteer.launch({ headless: !a.headed, executablePath: a.chrome || process.env.CHROME_PATH || undefined, args: chromeArgs, defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/?render=1&scene=${scene}${extra}`);
await page.waitForFunction(() => window.__v?.ready, { timeout: 120000 });
const duration = await page.evaluate(() => window.__v.duration);
const cdp = await page.target().createCDPSession();
const shot = async (t) => { await page.evaluate((tt) => window.__v.renderFrame(tt), t); return Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93 })).data, 'base64'); };

if (a.still) {
  for (const ts of String(a.still).split(',')) { const f = out.replace(/\.mp4$/, `_t${ts}.jpg`); fs.writeFileSync(f, await shot(Number(ts))); console.log('Still →', path.relative(ROOT, f)); }
} else {
  const N = Math.round(duration * fps);
  console.log(`${scene}: ${duration.toFixed(1)} s → ${N} frames`);
  const ff = spawn(ffmpegPath, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=r=48000:cl=stereo',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < N; i++) {
    const buf = await shot(i / fps);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 30 === 0) process.stdout.write(`\r${i}/${N}`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  fs.writeFileSync(out.replace(/\.mp4$/, '_cover.jpg'), await shot(Number(a.cover ?? duration * 0.8)));
  console.log(`\nVideo → ${path.relative(ROOT, out)}`);
}
await browser.close(); server.close();
