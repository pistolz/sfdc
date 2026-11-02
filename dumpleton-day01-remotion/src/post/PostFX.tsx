import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { HEIGHT, STEPS, WIDTH } from "../timeline";

// ---------------------------------------------------------------------------------------------
// ffmpeg `curves` (natural cubic spline through 0/0 .25/.18 .5/.45 .8/.82 1/1) baked into a LUT
// ---------------------------------------------------------------------------------------------
const naturalSpline = (xs: number[], ys: number[]) => {
  const n = xs.length - 1;
  const h = xs.slice(0, n).map((x, i) => xs[i + 1] - x);
  const al = new Array(n + 1).fill(0);
  for (let i = 1; i < n; i++) al[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
  const l = new Array(n + 1).fill(1);
  const mu = new Array(n + 1).fill(0);
  const z = new Array(n + 1).fill(0);
  for (let i = 1; i < n; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (al[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  const c = new Array(n + 1).fill(0);
  const b = new Array(n).fill(0);
  const d = new Array(n).fill(0);
  for (let j = n - 1; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  return (x: number) => {
    let j = n - 1;
    for (let i = 0; i < n; i++)
      if (x <= xs[i + 1]) {
        j = i;
        break;
      }
    const dx = x - xs[j];
    return ys[j] + b[j] * dx + c[j] * dx * dx + d[j] * dx * dx * dx;
  };
};
const makeLUT = () => {
  const curve = naturalSpline([0, 0.25, 0.5, 0.8, 1], [0, 0.18, 0.45, 0.82, 1]);
  const glow = naturalSpline([0, 0.72, 1], [0, 0, 1]);
  const N = 1024;
  const data = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);
    data[i * 4] = THREE.MathUtils.clamp(curve(x), 0, 1);
    data[i * 4 + 1] = THREE.MathUtils.clamp(x <= 0.72 ? 0 : glow(x), 0, 1);
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 1;
  }
  const t = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};
// tilt-shift mask profile (blender/post/tsmask.png sampled at 40 rows, top -> bottom; constant across x)
const TS_PROFILE = [255, 255, 255, 255, 227, 193, 161, 129, 98, 70, 43, 18, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 37, 64, 93, 123, 154, 187, 220, 254, 255, 255, 255];
const makeMask = () => {
  const data = new Float32Array(TS_PROFILE.length * 4);
  // texture row 0 = bottom in GL -> reverse
  TS_PROFILE.slice()
    .reverse()
    .forEach((v, i) => data.set([v / 255, v / 255, v / 255, 1], i * 4));
  const t = new THREE.DataTexture(data, 1, TS_PROFILE.length, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};

/** ffmpeg shake envelope: sum of exp(-(t-ts)*6) over the giant steps */
export const stepEnv = (t: number, k = 6) => STEPS.reduce((a, ts) => a + (t >= ts ? Math.exp(-(t - ts) * k) : 0), 0);
export const rgbSplitOn = (t: number) => STEPS.some((ts) => t >= ts && t <= ts + 0.35);

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const GRADE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene; uniform sampler2D tLut;
uniform vec2 uRes; uniform float uExposure; uniform float uRot; uniform vec2 uOff; uniform float uSplit;
uniform float uLook;
vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
vec3 sampleScene(vec2 pTop){
  // pTop: output pixel (top-left origin). ffmpeg: scale to 1140x2024, rotate, crop 1080x1920 @ off
  vec2 q = pTop + uOff;             // pixel in 1140x2024 image
  vec2 c = vec2(570.0, 1012.0);
  vec2 d = q - c; float cs = cos(uRot), sn = sin(uRot);
  q = c + vec2(cs*d.x + sn*d.y, -sn*d.x + cs*d.y);
  vec2 uv = q / vec2(1140.0, 2024.0);
  uv.y = 1.0 - uv.y;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec3(0.0);
  return texture2D(tScene, uv).rgb;
}
vec3 look(vec3 x){ // Blender "Medium High Contrast" (approx. S-curve in display space)
  vec3 s = x*x*(3.0-2.0*x);
  return mix(x, s, uLook);
}
float lut(float x){ return texture2D(tLut, vec2(clamp(x,0.0,1.0)*(1023.0/1024.0)+0.5/1024.0, 0.5)).r; }
vec3 grade(vec3 lin){
  vec3 c = toSRGB(lin * uExposure);
  c = clamp(look(clamp(c,0.0,1.0)), 0.0, 1.0);
  c = vec3(lut(c.r), lut(c.g), lut(c.b));                      // curves
  float y = dot(c, vec3(0.299, 0.587, 0.114));
  c = clamp(y + (c - y) * 1.15, 0.0, 1.0);                       // eq saturation=1.15
  // colorbalance rs=-.04 gs=.04 bs=-.03 rm=-.03 gm=.03 (ffmpeg float path)
  float l = max(max(c.r,c.g),c.b) + min(min(c.r,c.g),c.b);
  float a = 4.0, b = 0.333, sc = 0.7;
  float ws = clamp((b - l) * a + 0.5, 0.0, 1.0) * sc;
  float wm = clamp((l - b) * a + 0.5, 0.0, 1.0) * clamp((1.0 - l - b) * a + 0.5, 0.0, 1.0) * sc;
  c += vec3(-0.04, 0.04, -0.03) * ws + vec3(-0.03, 0.03, 0.0) * wm;
  return clamp(c, 0.0, 1.0);
}
void main(){
  vec2 pTop = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 g = grade(sampleScene(pTop));
  if (uSplit > 0.5) { // rgbashift rh=7 bh=-7
    g.r = grade(sampleScene(pTop - vec2(7.0, 0.0))).r;
    g.b = grade(sampleScene(pTop + vec2(7.0, 0.0))).b;
  }
  gl_FragColor = vec4(g, 1.0);
}`;

const DOWN_FRAG = /* glsl */ `
precision highp float; varying vec2 vUv; uniform sampler2D tIn; uniform vec2 uTexel; uniform sampler2D tLut; uniform float uMode;
void main(){
  vec3 c = 0.25*(texture2D(tIn, vUv + uTexel*vec2(-0.5,-0.5)).rgb + texture2D(tIn, vUv + uTexel*vec2(0.5,-0.5)).rgb
               + texture2D(tIn, vUv + uTexel*vec2(-0.5,0.5)).rgb + texture2D(tIn, vUv + uTexel*vec2(0.5,0.5)).rgb);
  if (uMode > 0.5) { // glow threshold curve 0/0 .72/0 1/1
    c = vec3(texture2D(tLut, vec2(c.r,0.5)).g, texture2D(tLut, vec2(c.g,0.5)).g, texture2D(tLut, vec2(c.b,0.5)).g);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const BLUR_FRAG = /* glsl */ `
precision highp float; varying vec2 vUv; uniform sampler2D tIn; uniform vec2 uDir; uniform float uSigma;
void main(){
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int i = -24; i <= 24; i++) {
    float x = float(i);
    if (abs(x) > uSigma * 3.0) continue;
    float w = exp(-0.5 * x * x / (uSigma * uSigma));
    acc += texture2D(tIn, vUv + uDir * x).rgb * w; wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}`;

const FINAL_FRAG = /* glsl */ `
precision highp float; varying vec2 vUv;
uniform sampler2D tA; uniform sampler2D tTS; uniform sampler2D tGlow; uniform sampler2D tMask;
uniform vec2 uTexel; uniform float uVigAngle; uniform float uSharp; uniform float uGlow;
void main(){
  vec3 c = texture2D(tA, vUv).rgb;
  // unsharp 5x5, amount .6
  vec3 bl = vec3(0.0);
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) bl += texture2D(tA, vUv + uTexel * vec2(float(x), float(y))).rgb;
  bl /= 25.0;
  c = clamp(c + uSharp * (c - bl), 0.0, 1.0);
  // glow: screen at 12 %
  vec3 g = texture2D(tGlow, vUv).rgb * uGlow;
  c = 1.0 - (1.0 - c) * (1.0 - g);
  // tilt-shift through mask
  float m = texture2D(tMask, vec2(0.5, vUv.y)).r;
  c = mix(c, texture2D(tTS, vUv).rgb, m);
  // ffmpeg vignette (natural): cos(angle*d)^4, d = dist / half-diagonal
  vec2 p = (vUv - 0.5) * vec2(1080.0, 1920.0);
  float d = length(p) / length(vec2(540.0, 960.0));
  float cv = cos(uVigAngle * d);
  float v = d > 1.0 ? 0.0 : cv*cv*cv*cv;
  c *= v;
  gl_FragColor = vec4(c, 1.0);
}`;

export type PostParams = {
  exposure: number; // 2^-1.35
  look: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  rot: number;
  off: [number, number];
  split: boolean;
  vigAngle: number;
};

export const PostFX: React.FC<{ params: PostParams; msaa?: number; renderScale?: number }> = ({ params, msaa = 4, renderScale = 1 }) => {
  const { gl, scene, camera } = useThree();
  const P = useMemo(() => {
    const W = WIDTH;
    const H = HEIGHT;
    const rtScene = new THREE.WebGLRenderTarget(Math.round(W * renderScale), Math.round(H * renderScale), { type: THREE.HalfFloatType, samples: msaa, colorSpace: THREE.LinearSRGBColorSpace });
    const ldr = (w: number, h: number) =>
      new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    const rtA = ldr(W, H);
    const h1 = ldr(W / 2, H / 2);
    const h2 = ldr(W / 2, H / 2);
    const q1 = ldr(W / 4, H / 4);
    const q2 = ldr(W / 4, H / 4);
    const lutT = makeLUT();
    const maskT = makeMask();
    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    const grade = mk(GRADE_FRAG, {
      tScene: { value: rtScene.texture },
      tLut: { value: lutT },
      uRes: { value: new THREE.Vector2(W, H) },
      uExposure: { value: 1 },
      uRot: { value: 0 },
      uOff: { value: new THREE.Vector2(30, 52) },
      uSplit: { value: 0 },
      uLook: { value: 0.35 },
    });
    const down = mk(DOWN_FRAG, { tIn: { value: null }, uTexel: { value: new THREE.Vector2() }, tLut: { value: lutT }, uMode: { value: 0 } });
    const blur = mk(BLUR_FRAG, { tIn: { value: null }, uDir: { value: new THREE.Vector2() }, uSigma: { value: 6.5 } });
    const fin = mk(FINAL_FRAG, {
      tA: { value: rtA.texture },
      tTS: { value: h1.texture },
      tGlow: { value: q1.texture },
      tMask: { value: maskT },
      uTexel: { value: new THREE.Vector2(1 / W, 1 / H) },
      uVigAngle: { value: Math.PI / 4 },
      uSharp: { value: 0.6 },
      uGlow: { value: 0.12 },
    });
    const quad = new FullScreenQuad(grade);
    const bloom = new UnrealBloomPass(new THREE.Vector2(W * renderScale, H * renderScale), 0.6, 0.5, 0.8);
    return { rtScene, rtA, h1, h2, q1, q2, grade, down, blur, fin, quad, bloom };
  }, [msaa, renderScale]);

  useEffect(
    () => () => {
      [P.rtScene, P.rtA, P.h1, P.h2, P.q1, P.q2].forEach((r) => r.dispose());
      P.bloom.dispose();
    },
    [P],
  );

  // uniforms from the current frame (deterministic, set during render)
  P.grade.uniforms.uExposure.value = params.exposure;
  P.grade.uniforms.uLook.value = params.look;
  P.grade.uniforms.uRot.value = params.rot;
  P.grade.uniforms.uOff.value.set(params.off[0], params.off[1]);
  P.grade.uniforms.uSplit.value = params.split ? 1 : 0;
  P.fin.uniforms.uVigAngle.value = params.vigAngle;
  P.bloom.strength = params.bloomStrength;
  P.bloom.radius = params.bloomRadius;
  P.bloom.threshold = params.bloomThreshold;

  useFrame(() => {
    const r = gl;
    r.autoClear = true;
    // 1) scene -> HDR linear target (MSAA)
    r.setRenderTarget(P.rtScene);
    r.clear();
    r.render(scene, camera);
    // 2) Blender-style bloom on scene-linear (threshold 0.8)
    P.bloom.render(r, P.rtScene, P.rtScene, 0, false);
    // 3) shake/crop + exposure + look + curves + saturation + colour balance + RGB split
    P.quad.material = P.grade;
    r.setRenderTarget(P.rtA);
    P.quad.render(r);
    // 4) tilt-shift blur (σ13 full-res ≈ σ6.5 at half-res)
    P.quad.material = P.down;
    P.down.uniforms.tIn.value = P.rtA.texture;
    P.down.uniforms.uTexel.value.set(1 / WIDTH, 1 / HEIGHT);
    P.down.uniforms.uMode.value = 0;
    r.setRenderTarget(P.h1);
    P.quad.render(r);
    P.quad.material = P.blur;
    P.blur.uniforms.uSigma.value = 6.5;
    P.blur.uniforms.tIn.value = P.h1.texture;
    P.blur.uniforms.uDir.value.set(2 / WIDTH, 0);
    r.setRenderTarget(P.h2);
    P.quad.render(r);
    P.blur.uniforms.tIn.value = P.h2.texture;
    P.blur.uniforms.uDir.value.set(0, 2 / HEIGHT);
    r.setRenderTarget(P.h1);
    P.quad.render(r);
    // 5) glow: highlights > .72, σ24 (σ6 at quarter-res), screened at 12 %
    P.quad.material = P.down;
    P.down.uniforms.tIn.value = P.h1.texture; // use pre-blurred half-res as source (cheap)
    P.down.uniforms.uTexel.value.set(2 / WIDTH, 2 / HEIGHT);
    P.down.uniforms.uMode.value = 1;
    r.setRenderTarget(P.q1);
    P.quad.render(r);
    P.quad.material = P.blur;
    P.blur.uniforms.uSigma.value = 6;
    P.blur.uniforms.tIn.value = P.q1.texture;
    P.blur.uniforms.uDir.value.set(4 / WIDTH, 0);
    r.setRenderTarget(P.q2);
    P.quad.render(r);
    P.blur.uniforms.tIn.value = P.q2.texture;
    P.blur.uniforms.uDir.value.set(0, 4 / HEIGHT);
    r.setRenderTarget(P.q1);
    P.quad.render(r);
    // 6) final: unsharp + glow + tilt-shift + vignette -> screen
    P.quad.material = P.fin;
    r.setRenderTarget(null);
    P.quad.render(r);
  }, 1);
  return null;
};
