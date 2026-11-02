import * as THREE from "three";
import { lin } from "./world";

// ---------------------------------------------------------------------------------------------
// Height-slab fog: emulates scene.py's low fog volume (700x700x14 m box, z −5..9 in Blender = three Y)
// plus a gentle aerial haze for very far geometry. Uses scene.fog = FogExp2 (fogColor, fogDensity uniforms).
// ---------------------------------------------------------------------------------------------
let patched = false;
export const patchFogChunks = () => {
  if (patched) return;
  patched = true;
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorldPos;
#endif`;
  THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vec4 fogWP = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    fogWP = instanceMatrix * fogWP;
  #endif
  fogWP = modelMatrix * fogWP;
  vFogWorldPos = fogWP.xyz;
  vFogDepth = - mvPosition.z;
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorldPos;
  uniform float fogDensity;
#endif`;
  THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  {
    vec3 ro = cameraPosition;
    vec3 fp = vFogWorldPos;
    float dist = length( fp - ro );
    float y0 = -5.0; float y1 = 9.0;
    float lo = min( ro.y, fp.y ); float hi = max( ro.y, fp.y );
    float ov = max( 0.0, min( hi, y1 ) - max( lo, y0 ) );
    float frac = ( hi - lo ) > 0.01 ? ov / ( hi - lo ) : ( ( ro.y > y0 && ro.y < y1 ) ? 1.0 : 0.0 );
    float L = min( dist * frac, 700.0 );
    // Blender noise density map 0.45..0.75 -> 0..max  => mean density ~0.35*max, patchy
    float fogPatch = 0.55 + 0.45 * sin( fp.x * 0.045 + fp.z * 0.031 ) * sin( fp.z * 0.052 - fp.x * 0.022 + 1.7 );
    float fogF = 1.0 - exp( - fogDensity * 0.35 * fogPatch * L );
    float haze = 1.0 - exp( - max( 0.0, dist - 220.0 ) * 0.0004 );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, clamp( max( fogF, haze * 0.85 ), 0.0, 1.0 ) );
  }
#endif`;
};

// ---------------------------------------------------------------------------------------------
// "snow=True" materials of scene.py: base colour (per object / per instance) mixed toward a `top`
// colour where (normal.z + 0.35*noise) > threshold. We bake that factor per vertex as attribute aTop.
// ---------------------------------------------------------------------------------------------
export const topMixMaterial = (top: THREE.Color, params: THREE.MeshStandardMaterialParameters, shake = false) => {
  const m = new THREE.MeshStandardMaterial(params);
  const uniforms = { uTop: { value: top }, uShake: { value: 0 }, uTime: { value: 0 } };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float aTop;
varying float vTop;
uniform float uShake; uniform float uTime;
${shake ? "attribute float aPhase;" : ""}`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vTop = aTop;
${
  shake
    ? `// giant beat: whole tree rocks around its base (noise on rotation x/y, strength 0.2)
  float sh = uShake;
  if (sh > 0.0) {
    float ph = aPhase;
    float ax = sh * (0.6*sin(uTime*7.1+ph) + 0.4*sin(uTime*12.7+ph*2.3));
    float ay = sh * (0.6*sin(uTime*6.3+ph*1.7) + 0.4*sin(uTime*11.3+ph*0.7));
    // geometry is authored in Blender space (Z up): tilt x/y proportionally to height
    transformed.x += ax * transformed.z;
    transformed.y += ay * transformed.z;
  }`
    : ""
}`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform vec3 uTop; varying float vTop;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, uTop, vTop);`,
      );
  };
  m.customProgramCacheKey = () => (shake ? "topmix-shake" : "topmix");
  return m;
};

/** compute aTop for a geometry: smoothstep(thr, thr+0.12, normal.y + 0.35*(noise-0.5)*2*0.5+...) */
export const bakeTop = (
  g: THREE.BufferGeometry,
  thr: number,
  noiseFn: (x: number, y: number, z: number) => number,
  scale = 1,
  upAxis: "y" | "z" = "z",
) => {
  const n = g.attributes.normal;
  const p = g.attributes.position;
  const a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const nz = upAxis === "y" ? n.getY(i) : n.getZ(i);
    const v = nz + 0.35 * noiseFn(p.getX(i) * scale, p.getY(i) * scale, p.getZ(i) * scale);
    a[i] = THREE.MathUtils.smoothstep(v, thr, thr + 0.12);
  }
  g.setAttribute("aTop", new THREE.BufferAttribute(a, 1));
  return g;
};

export const std = (c: [number, number, number], rough = 0.6, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: lin(...c), roughness: rough, metalness: 0, ...extra });
