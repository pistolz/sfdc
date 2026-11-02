// Post-processing: MSAA render → bloom → tilt-shift (miniature look) → tone map → colour grade.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const TiltShift = {
  uniforms: {
    tDiffuse: { value: null },
    uStep: { value: new THREE.Vector2() },
    uFocus: { value: 0.5 },
    uBand: { value: 0.16 },
    uStrength: { value: 3.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 uStep;
    uniform float uFocus, uBand, uStrength;
    varying vec2 vUv;
    void main() {
      float d = abs(vUv.y - uFocus);
      float amt = smoothstep(uBand, uBand + 0.32, d) * uStrength;
      vec4 sum = vec4(0.0);
      float wsum = 0.0;
      for (int i = -6; i <= 6; i++) {
        float fi = float(i);
        float w = exp(-fi * fi / 18.0);
        sum += texture2D(tDiffuse, vUv + uStep * fi * amt) * w;
        wsum += w;
      }
      gl_FragColor = sum / wsum;
    }`,
};

const Grade = {
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1.1 },
    uVignette: { value: 0.28 },
  },
  vertexShader: TiltShift.vertexShader,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uSaturation, uVignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSaturation);
      vec2 q = vUv - 0.5;
      float v = 1.0 - dot(q, q) * uVignette * 2.2;
      c.rgb *= v;
      gl_FragColor = c;
    }`,
};

export function createPost(renderer, scene, camera, theme, width, height) {
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  if (theme.bloom > 0) {
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), theme.bloom, 0.6, 0.86));
  }
  const tsH = new ShaderPass(TiltShift);
  const tsV = new ShaderPass(TiltShift);
  tsH.uniforms.uStep.value.set(1 / width, 0);
  tsV.uniforms.uStep.value.set(0, 1 / height);
  composer.addPass(tsH);
  composer.addPass(tsV);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(Grade);
  grade.uniforms.uSaturation.value = theme.saturation;
  composer.addPass(grade);

  return {
    composer,
    setTilt(strength, focus = 0.5, band = 0.16) {
      for (const p of [tsH, tsV]) {
        p.uniforms.uStrength.value = strength;
        p.uniforms.uFocus.value = focus;
        p.uniforms.uBand.value = band;
      }
    },
    render() { composer.render(); },
  };
}
