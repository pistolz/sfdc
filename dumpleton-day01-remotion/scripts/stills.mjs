// Usage: node scripts/stills.mjs Day02 0 300 1500  -> out/stills/<comp>_<frame>.png + contact sheet
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
const [id, ...fs_] = process.argv.slice(2);
const frames = fs_.map(Number);
const inputProps = JSON.parse(process.env.PROPS || '{"msaa":0,"renderScale":0.5}');
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id, inputProps });
fs.mkdirSync("out/stills", { recursive: true });
for (const f of frames) {
  const t0 = Date.now();
  await renderStill({ serveUrl, composition, frame: f, output: `out/stills/${id}_${f}.png`, overwrite: true, inputProps, timeoutInMilliseconds: 240000 });
  console.log("frame", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
const name = `out/stills/sheet_${id}_${frames.join("_")}.jpg`;
execFileSync("python3", ["-c", `
from PIL import Image
fr=${JSON.stringify(frames)}
S=Image.new('RGB',(432*len(fr),768))
for i,f in enumerate(fr): S.paste(Image.open(f'out/stills/${id}_{f}.png').convert('RGB').resize((432,768)),(i*432,0))
S.save('${name}',quality=85)`]);
console.log(name);
