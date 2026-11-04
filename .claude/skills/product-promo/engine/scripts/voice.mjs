#!/usr/bin/env node
// Generates the voice-over, one clip per beat, and measures each clip so the
// video timing follows the narration exactly.
//
//   npm run voice -- --episode episodes/part1.json
//
// Two ways to get the voice:
//  1. Your own recordings (ElevenLabs, your mic…): put one file per beat in
//     voice/<episode>/<beat id>.mp3 (or .wav / .m4a), e.g. voice/part1/01.mp3.
//     They are always used first.
//  2. Otherwise the free Microsoft neural voice via edge-tts (needs Python):
//        pip install edge-tts
//     Options: --voice en-US-AndrewNeural  --rate +6%   (list voices: edge-tts --list-voices)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { ROOT } from './serve.mjs';

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const n = argv[i + 1];
    if (n === undefined || (n.startsWith('--') && !/^--?\d/.test(n))) o[a.slice(2)] = true; else { o[a.slice(2)] = n; i++; }
  }
  return o;
}

export function mediaDuration(file) {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr || '');
  if (!m) throw new Error(`Cannot read duration of ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function findPython() {
  for (const cmd of ['python3', 'python', 'py']) { const r = spawnSync(cmd, ['-c', 'import edge_tts'], { encoding: 'utf8' }); if (r.status === 0) return cmd; }
  return null;
}

/** ElevenLabs with exact word timings (needs ELEVENLABS_API_KEY + a voice id). */
async function eleven(text, v, file) {
  const key = process.env.ELEVENLABS_API_KEY;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.id}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: v.model || 'eleven_multilingual_v2', voice_settings: { stability: v.stability ?? 0.45, similarity_boost: v.similarity ?? 0.8, style: v.style ?? 0.2, speed: v.speed ?? 1.0 } }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  fs.writeFileSync(file, Buffer.from(j.audio_base64, 'base64'));
  const al = j.alignment || j.normalized_alignment; const words = [];
  if (al) { let cur = null; al.characters.forEach((c, i) => { if (/\s/.test(c)) { if (cur) { words.push(cur); cur = null; } return; } if (!cur) cur = { w: '', t: al.character_start_times_seconds[i] }; cur.w += c; cur.d = al.character_end_times_seconds[i] - cur.t; }); if (cur) words.push(cur); }
  return words;
}

function findTts() {
  const candidates = [['edge-tts', []], ['python', ['-m', 'edge_tts']], ['python3', ['-m', 'edge_tts']], ['py', ['-m', 'edge_tts']]];
  for (const [cmd, pre] of candidates) {
    const r = spawnSync(cmd, [...pre, '--help'], { encoding: 'utf8', shell: process.platform === 'win32' });
    if (r.status === 0) return [cmd, pre];
  }
  return null;
}

const args = parseArgs(process.argv.slice(2));
const epPath = args.episode || 'episodes/part1.json';
const ep = JSON.parse(fs.readFileSync(path.join(ROOT, epPath), 'utf8'));
const name = path.basename(epPath, '.json');
const outDir = path.join(ROOT, 'out', 'voice', name);
const ownDir = path.join(ROOT, 'voice', name);
fs.mkdirSync(outDir, { recursive: true });
const voiceName = args.voice || ep.voice?.name || 'en-US-AndrewNeural';
const rate = args.rate || ep.voice?.rate || '+0%';
const timingsPath = path.join(outDir, 'timings.json');
const old = fs.existsSync(timingsPath) ? JSON.parse(fs.readFileSync(timingsPath, 'utf8')) : {};
const timings = {};
let tts = null;

for (const b of ep.beats) {
  const own = ['mp3', 'wav', 'm4a'].map((e) => path.join(ownDir, `${b.id}.${e}`)).find((f) => fs.existsSync(f));
  let file;
  if (own) {
    file = own;
    console.log(`[${b.id}] your recording: ${path.relative(ROOT, own)}`);
  } else {
    const vName = b.voice?.name || voiceName, vRate = b.voice?.rate || rate, vPitch = b.voice?.pitch || ep.voice?.pitch || '+0Hz';
    const el = b.voice?.eleven || ep.voice?.eleven; // { id, model, stability, similarity, style, speed }
    const useEleven = el?.id && process.env.ELEVENLABS_API_KEY && args.engine !== 'edge';
    const hash = crypto.createHash('sha1').update(`${useEleven ? 'el:' + JSON.stringify(el) : vName}|${vRate}|${vPitch}|${b.say}`).digest('hex').slice(0, 12);
    file = path.join(outDir, `${b.id}.mp3`);
    if (old[b.id]?.hash === hash && fs.existsSync(file) && fs.statSync(file).size > 0) {
      timings[b.id] = old[b.id];
      console.log(`[${b.id}] unchanged`);
      continue;
    }
    let words = null;
    if (useEleven) {
      try { words = await eleven(b.say, el, file); } catch (e) { console.error(`[${b.id}] ${e.message}`); process.exit(1); }
    } else {
      const py = findPython();
      if (py) {
        const r = spawnSync(py, [path.join(ROOT, 'scripts', 'tts_words.py'), '--voice', vName, '--rate', vRate, '--pitch', vPitch, '--text', b.say, '--out', file, '--words', file + '.words.json'], { encoding: 'utf8' });
        if (r.status !== 0) { console.error(`[${b.id}] edge-tts failed:\n${r.stderr || r.stdout}`); process.exit(1); }
        try { words = JSON.parse(fs.readFileSync(file + '.words.json', 'utf8')); } catch { words = null; }
      } else {
        tts = tts || findTts();
        if (!tts) { console.error('\nedge-tts not found. Install it with:  pip install edge-tts'); console.error(`…or record your own voice files in voice/${name}/<beat id>.mp3\n`); process.exit(1); }
        const [cmd, pre] = tts;
        const r = spawnSync(cmd, [...pre, '--voice', vName, `--rate=${vRate}`, `--pitch=${vPitch}`, '--text', b.say, '--write-media', file], { encoding: 'utf8' });
        if (r.status !== 0) { console.error(`[${b.id}] edge-tts failed:\n${r.stderr || r.stdout}`); process.exit(1); }
      }
    }
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) { console.error(`[${b.id}] no audio produced`); process.exit(1); }
    timings[b.id] = { hash, ...(words?.length ? { words } : {}) };
    console.log(`[${b.id}] ${b.say.slice(0, 60)}${b.say.length > 60 ? '…' : ''}`);
  }
  timings[b.id] = { ...(timings[b.id] || {}), file: path.relative(ROOT, file).replace(/\\/g, '/'), duration: mediaDuration(file) };
}
fs.writeFileSync(timingsPath, JSON.stringify(timings, null, 2));
const total = Object.values(timings).reduce((s, x) => s + x.duration, 0);
console.log(`\nVoice ready: ${ep.beats.length} clips, ${total.toFixed(1)}s of narration → ${path.relative(process.cwd(), timingsPath)}`);
console.log(`Next: npm run render -- --episode ${epPath}\n`);
