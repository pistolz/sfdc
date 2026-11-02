import * as THREE from "three";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { FCurve, FCurveN } from "../fcurve";
import { M, TOTAL } from "../timeline";
import { lin } from "./world";

// ---------------------------------------------------------------------------------------------
// Lighting arc (scene.py SUNK / moon / world keys) — Bezier auto-clamped like Blender
// ---------------------------------------------------------------------------------------------
const ts_ = M.sunset[0];
const tn = M.eyes[0];
const tm = M.morning[0];
const SUNK: [number, number, number, number, [number, number, number]][] = [
  [0, 14, 150, 3.0, [1.0, 0.78, 0.6]],
  [5, 38, 150, 5.2, [1.0, 0.86, 0.66]],
  [ts_ - 3, 30, 170, 5.0, [1.0, 0.82, 0.6]],
  [ts_ + 1.5, 7, 205, 3.5, [1.0, 0.55, 0.3]],
  [tn - 0.8, 1, 215, 0.0, [1.0, 0.4, 0.25]],
  [M.steps[1] - 0.3, -2, 120, 0.0, [1, 0.6, 0.4]],
  [tm, 14, 125, 3.8, [1.0, 0.78, 0.5]],
  [TOTAL, 22, 132, 4.4, [1.0, 0.85, 0.62]],
];
const D2R = Math.PI / 180;
const sunCurve = new FCurveN(SUNK.map(([t, el, az, en, c]) => [t, [(90 - el) * D2R, az * D2R, en * 0.72, c[0], c[1], c[2]]]));
const moonEnergy = new FCurve([
  [0, 0.25],
  [5, 0.0],
  [tn - 1.5, 0.0],
  [tn, 1.3],
  [M.steps[1], 1.3],
  [tm, 0.3],
  [TOTAL, 0.0],
]);
const worldCurve = new FCurveN(
  (
    [
      [0, 0.35, 0.35],
      [5, 0.0, 0.45],
      [ts_, 0.0, 0.42],
      [ts_ + 3, 0.35, 0.35],
      [tn, 1.0, 0.9],
      [M.steps[1], 1.0, 0.9],
      [tm, 0.1, 0.45],
      [TOTAL, 0.0, 0.5],
    ] as [number, number, number][]
  ).map(([t, n, s]) => [t, [n, s * 0.8]]),
);
const fogCurve = new FCurve([
  [0, 0.004],
  [M.sunset[0], 0.004],
  [M.eyes[0], 0.012],
  [M.steps[0], 0.02],
  [M.morning[0], 0.012],
  [M.cta[0], 0.004],
  [TOTAL, 0.004],
]);
const auroraCurve = new FCurve([
  [0, 0.45],
  [3.5, 0.1],
  [M.sunset[0], 0.0],
  [M.eyes[0], 1.0],
  [M.morning[0], 1.0],
  [M.cta[0], 0.3],
  [TOTAL, 0.45],
]);

/** direction the light travels (Blender space) for a sun lamp with rotation (rx, 0, rz) */
const lampDir = (rx: number, rz: number) => new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(rx, 0, rz, "ZYX"));
const MOON_DIR = lampDir(35 * D2R, -40 * D2R);
const MOON_COL = lin(0.35, 0.5, 1.0);
// Blender's Nishita world is a strong light source (EEVEE also extracts its sun disc). Tuned against the reference.
export const AMBIENT_K = 2.0;
export const SKY_SUN_K = 1.8;
export const MOON_K = 0.45;

export type LightState = {
  sunDir: THREE.Vector3; // direction light travels
  sunEnergy: number;
  sunColor: THREE.Color;
  moonEnergy: number;
  night: number; // world night mix factor
  bgStrength: number;
  fog: number;
  aurora: number;
  elevation: number;
};
export const lightAt = (t: number): LightState => {
  const s = sunCurve.evaluate(t);
  const w = worldCurve.evaluate(t);
  return {
    sunDir: lampDir(s[0], s[1]),
    sunEnergy: Math.max(0, s[2]),
    sunColor: lin(s[3], s[4], s[5]),
    moonEnergy: Math.max(0, moonEnergy.evaluate(t)),
    night: THREE.MathUtils.clamp(w[0], 0, 1),
    bgStrength: w[1],
    fog: fogCurve.evaluate(t),
    aurora: Math.max(0, auroraCurve.evaluate(t)),
    elevation: 90 - s[0] / D2R,
  };
};

// Simple analytic stand-in for the Nishita sky, mixed toward night blue (#304573 / linear .03,.06,.17)
const SKY_GLSL = /* glsl */ `
uniform vec3 uSunDir; uniform float uNight; uniform float uStrength; uniform float uElev;
vec3 skyColor(vec3 d) {
  // d in Blender space (z up)
  float up = d.z;
  vec3 sunTo = -uSunDir;
  float sunset = 1.0 - smoothstep(4.0, 22.0, uElev);
  vec3 zen = mix(vec3(0.10, 0.20, 0.48), vec3(0.16, 0.16, 0.34), sunset);
  vec3 hor = mix(vec3(0.62, 0.66, 0.72), vec3(1.10, 0.55, 0.30), sunset);
  float h = pow(clamp(up, 0.0, 1.0), 0.45);
  vec3 c = mix(hor, zen, h);
  // warm glow toward the sun
  float mu = max(dot(normalize(d), normalize(sunTo)), 0.0);
  c += vec3(1.0, 0.65, 0.35) * pow(mu, 8.0) * (0.35 + 0.8 * sunset) * smoothstep(-6.0, 4.0, uElev);
  // below horizon: dark ground haze
  c = mix(c, vec3(0.20, 0.17, 0.14), smoothstep(0.0, -0.06, up));
  float dayAmt = smoothstep(-3.0, 6.0, uElev);
  c *= mix(0.25, 1.0, dayAmt);
  c = mix(c, vec3(0.03, 0.06, 0.17) * 2.2, uNight);
  return c * uStrength * 2.6;
}`;

export const Sky: React.FC<{ L: LightState }> = ({ L }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uSunDir: { value: new THREE.Vector3() }, uNight: { value: 0 }, uStrength: { value: 1 }, uElev: { value: 10 } },
        vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w*0.99999; }`,
        fragmentShader: `${SKY_GLSL}
varying vec3 vDir; void main(){ gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0); }`,
      }),
    [],
  );
  mat.uniforms.uSunDir.value.copy(L.sunDir);
  mat.uniforms.uNight.value = L.night;
  mat.uniforms.uStrength.value = L.bgStrength;
  mat.uniforms.uElev.value = L.elevation;
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[5000, 32, 16]} />
    </mesh>
  );
};

/** JS mirror of the sky (zenith & horizon) for ambient light colours */
const skyJS = (L: LightState, up: number, nightPow = 1) => {
  const night = Math.pow(L.night, nightPow);
  const sunset = 1 - THREE.MathUtils.smoothstep(L.elevation, 4, 22);
  const zen = new THREE.Color(0.1, 0.2, 0.48).lerp(new THREE.Color(0.16, 0.16, 0.34), sunset);
  const hor = new THREE.Color(0.62, 0.66, 0.72).lerp(new THREE.Color(1.1, 0.55, 0.3), sunset);
  const c = hor.lerp(zen, Math.pow(up, 0.45));
  const dayAmt = THREE.MathUtils.smoothstep(L.elevation, -3, 6);
  c.multiplyScalar(THREE.MathUtils.lerp(0.25, 1, dayAmt));
  c.lerp(new THREE.Color(0.03 * 2.2, 0.06 * 2.2, 0.17 * 2.2), night);
  return c.multiplyScalar(L.bgStrength * 2.6);
};

export const Aurora: React.FC<{ strength: number }> = ({ strength }) => {
  const { geos, mat } = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      blending: THREE.NormalBlending,
      uniforms: { uStr: { value: 0 }, uEm: { value: 1.0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; varying float vX; void main(){ vUv = uv; vX = uv.x; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
uniform float uStr; uniform float uEm; varying vec2 vUv;
float hash(float n){ return fract(sin(n)*43758.5453); }
float vnoise(float x){ float i=floor(x); float f=fract(x); f=f*f*(3.0-2.0*f); return mix(hash(i),hash(i+1.0),f); }
void main(){
  float v = vUv.y;
  float rampA = v < 0.25 ? v/0.25 : 1.0 - (v-0.25)/0.75;
  // wave texture BANDS (scale 6, distortion 2) on generated coords -> ~21 soft vertical bands across the ribbon
  float n = vUv.x * 6.2831 * 21.0 + 2.0 * (vnoise(vUv.x * 9.0) * 2.0 - 1.0);
  float wave = 0.5 + 0.5 * sin(n);
  float fac = clamp(rampA * wave * uStr, 0.0, 1.0);
  vec3 col = mix(vec3(1.0,0.55,0.75), vec3(0.6,0.5,1.0), v) * uEm;
  gl_FragColor = vec4(col, fac);
}`,
    });
    const gs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      const segs = 40;
      for (let k = 0; k <= segs; k++) {
        const u = k / segs;
        const x = -900 + 1800 * u;
        const y = 700 + i * 120 + 160 * Math.sin(u * 5 + i);
        pos.push(x, y, 230 + i * 30, x, y + 30, 520 + i * 40);
        uv.push(u, 0, u, 1);
        if (k > 0) {
          const a = (k - 1) * 2;
          idx.push(a, a + 2, a + 3, a, a + 3, a + 1);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      gs.push(g);
    }
    return { geos: gs, mat: m };
  }, []);
  mat.uniforms.uStr.value = strength;
  if (strength <= 0.001) return null;
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={mat} renderOrder={-5} frustumCulled={false} />
      ))}
    </group>
  );
};

/**
 * Sun + moon + sky ambient. The shadow-casting "key" light is whichever of sun/moon is stronger
 * (at the crossover both are dim). Shadow frustum follows the camera's ground target.
 */
export const Lights: React.FC<{ L: LightState; target: THREE.Vector3; shadowHalf: number }> = ({ L, target, shadowHalf }) => {
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const tgt = useMemo(() => new THREE.Object3D(), []);
  const tgt2 = useMemo(() => new THREE.Object3D(), []);
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    // the shadow target objects must live in the (Blender-space) group – we add them to scene with B2T applied manually
    scene.add(tgt);
    scene.add(tgt2);
    return () => {
      scene.remove(tgt);
      scene.remove(tgt2);
    };
  }, [scene, tgt, tgt2]);
  useLayoutEffect(() => {
    const k = key.current!;
    const f = fill.current!;
    const sunIsKey = L.sunEnergy * 1.0 >= L.moonEnergy * 0.9;
    const kDir = sunIsKey ? L.sunDir : MOON_DIR;
    const fDir = sunIsKey ? MOON_DIR : L.sunDir;
    const kE = sunIsKey ? L.sunEnergy : L.moonEnergy * MOON_K;
    const fE = sunIsKey ? L.moonEnergy * MOON_K : L.sunEnergy;
    const kC = sunIsKey ? L.sunColor : MOON_COL;
    const fC = sunIsKey ? MOON_COL : L.sunColor;
    // three space: blender(x,y,z) -> (x, z, -y)
    const T3 = (v: THREE.Vector3) => new THREE.Vector3(v.x, v.z, -v.y);
    const tg = T3(target);
    tgt.position.copy(tg);
    tgt.updateMatrixWorld();
    k.target = tgt;
    k.position.copy(tg).addScaledVector(T3(kDir), -600);
    // world sun disc adds to the key light while the sun is up
    const dayAmt = THREE.MathUtils.smoothstep(L.elevation, -2, 8);
    k.intensity = kE + (sunIsKey ? SKY_SUN_K * L.bgStrength * 2.6 * dayAmt * (1 - L.night) : 0);
    k.color.copy(kC);
    const cam = k.shadow.camera as THREE.OrthographicCamera;
    cam.left = -shadowHalf;
    cam.right = shadowHalf;
    cam.top = shadowHalf;
    cam.bottom = -shadowHalf;
    cam.near = 300;
    cam.far = 900;
    cam.updateProjectionMatrix();
    k.shadow.normalBias = 0.04 * Math.max(1, shadowHalf / 30);
    k.shadow.bias = -0.0004;
    tgt2.position.copy(tg);
    tgt2.updateMatrixWorld();
    f.target = tgt2;
    f.position.copy(tg).addScaledVector(T3(fDir), -600);
    f.intensity = fE;
    f.color.copy(fC);
    // world lighting: hemisphere from the sky (Blender world strength), ground bounce
    const h = hemi.current!;
    const zen = skyJS(L, 0.9, 2);
    const n2 = L.night * L.night;
    // desaturate toward grey (Nishita sky light is less blue than the zenith colour) and keep nights dark
    const grey = (zen.r + zen.g + zen.b) / 3;
    zen.lerp(new THREE.Color(grey, grey, grey), 0.45 * (1 - n2));
    h.color.copy(zen).multiplyScalar(Math.PI * AMBIENT_K * (1 - 0.82 * n2));
    h.groundColor.copy(skyJS(L, 0.05, 2)).multiplyScalar(0.18 * Math.PI).multiply(new THREE.Color(0.35, 0.55, 0.25));
    h.intensity = 1;
  });
  return (
    <>
      <directionalLight ref={key} castShadow shadow-mapSize={[4096, 4096]} />
      <directionalLight ref={fill} />
      <hemisphereLight ref={hemi} position={[0, 1, 0]} />
    </>
  );
};
