// Usage: node scripts/compare.mjs 0 300 1500 2300   -> out/cmp_<frames>.jpg (reference left, ours right)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
const frames = process.argv.slice(2).map(Number);
const REF = process.env.REF_VIDEO || "../../dumpleton-day01-remotion-test/reference/Day01_share.mp4";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "Day01" });
fs.mkdirSync("out/cmp", { recursive: true });
for (const f of frames) {
  const t0 = Date.now();
  await renderStill({ serveUrl, composition, frame: f, output: `out/cmp/ours_${f}.png`, overwrite: true });
  console.log("frame", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
  if (fs.existsSync(REF)) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", REF, "-vf", `select=eq(n\\,${f})`, "-frames:v", "1", `out/cmp/ref_${f}.png`]);
}
execFileSync("python3", ["-c", `
from PIL import Image
fr=${JSON.stringify(frames)}
S=Image.new('RGB',(540*len(fr),960*2 if True else 960))
for i,f in enumerate(fr):
  try: S.paste(Image.open(f'out/cmp/ref_{f}.png').convert('RGB').resize((540,960)),(i*540,0))
  except Exception as e: print(e)
  S.paste(Image.open(f'out/cmp/ours_{f}.png').convert('RGB').resize((540,960)),(i*540,960))
S.save('out/cmp/cmp_${frames.join("_")}.jpg',quality=85)
`]);
console.log(`out/cmp/cmp_${frames.join("_")}.jpg`);
