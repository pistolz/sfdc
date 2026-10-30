import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { GameState } from "./types";
import { slot, hallDepth, rowsFor, ROW_GAP, COLS, SPACING, pad } from "./layout";
import { drawGame, GAMES } from "./games";

/** Must match scripts/arc.mjs NEONS. */
export const NEONS = ["#3df5ff", "#ffd23f", "#4dff88", "#ff3df0", "#ff8a3d", "#a07bff"];

const BG = new THREE.Color("#07040f");
const FOG_NEAR = 14, FOG_FAR = 46;
const ATLAS = 2048, CELL_W = 256, CELL_H = 128, CELLS = (ATLAS / CELL_W) * (ATLAS / CELL_H);
const SCREEN_W = 160, SCREEN_H = 128;

interface Options { reducedMotion: boolean; onPick: (index: number | null) => void; onArrive: (index: number) => void; onFrame: () => void }

const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOut = (u: number) => 1 - Math.pow(1 - Math.min(1, u), 3);

/* ------------------------------------------------------------------ shaders */
const FOG_GLSL = /* glsl */ `
  uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
  vec3 applyFog(vec3 c, float d) { return mix(c, uFogColor, smoothstep(uFogNear, uFogFar, d)); }`;
const POWER_GLSL = /* glsl */ `
  uniform float uSel; uniform float uFlash; uniform float uDim;
  float power(float idx) {
    float isSel = (uSel >= 0.0 && abs(idx - uSel) < 0.5) ? 1.0 : 0.0;
    return mix(1.0 - 0.62 * uDim, 1.25 + 2.2 * uFlash, isSel);
  }`;
const INST_VERT = /* glsl */ `
  attribute float aIdx;
  varying vec2 vUv; varying float vIdx; varying float vFog; varying vec3 vNeon;
  void main() {
    vUv = uv; vIdx = aIdx;
    #ifdef USE_INSTANCING_COLOR
      vNeon = instanceColor;
    #else
      vNeon = vec3(1.0);
    #endif
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vFog = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

function sharedUniforms() {
  return {
    uFogColor: { value: BG.clone() }, uFogNear: { value: FOG_NEAR }, uFogFar: { value: FOG_FAR },
    uSel: { value: -1 }, uFlash: { value: 0 }, uDim: { value: 0 }, uTime: { value: 0 },
  };
}

/* ------------------------------------------------------------------ geometry */
function box(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return g;
}
function cabinetBody() {
  return mergeGeometries([
    box(1.0, 2.3, 0.86, 0, 1.15, 0),          // body
    box(1.06, 0.46, 0.98, 0, 2.12, 0.06),     // marquee hood
    box(1.08, 0.14, 0.5, 0, 1.13, 0.56, -0.38), // control panel
    box(1.04, 0.1, 0.92, 0, 0.05, 0.02),      // plinth
  ].map((g) => g.toNonIndexed()));
}
function cabinetTrims() {
  const t = 0.045;
  return mergeGeometries([
    box(t, 2.32, t, -0.52, 1.16, 0.44), box(t, 2.32, t, 0.52, 1.16, 0.44),             // front verticals
    box(1.1, t, t, 0, 2.36, 0.56), box(1.1, t, t, 0, 1.88, 0.56),                       // marquee top / bottom
    box(t, 0.48, t, -0.54, 2.12, 0.56), box(t, 0.48, t, 0.54, 2.12, 0.56),              // marquee sides
    box(1.1, t, t, 0, 1.0, 0.82),                                                       // control panel lip
    box(1.08, t, t, 0, 0.1, 0.49),                                                      // plinth
    box(t, 2.32, t, -0.52, 1.16, -0.43), box(t, 2.32, t, 0.52, 1.16, -0.43),            // back verticals
    box(t, t, 0.86, -0.52, 2.34, 0), box(t, t, 0.86, 0.52, 2.34, 0),                    // roof sides
  ].map((g) => g.toNonIndexed()));
}
function cabinetControls() {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, hex: string) => {
    const c = new THREE.Color(hex), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    return g.toNonIndexed();
  };
  const stick = new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8); stick.translate(-0.2, 1.3, 0.6);
  const knob = new THREE.SphereGeometry(0.05, 12, 8); knob.translate(-0.2, 1.39, 0.6);
  const b1 = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 14); b1.rotateX(-0.38); b1.translate(0.12, 1.21, 0.63);
  const b2 = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 14); b2.rotateX(-0.38); b2.translate(0.26, 1.2, 0.6);
  parts.push(paint(stick, "#1a1a22"), paint(knob, "#ff3348"), paint(b1, "#ffd23f"), paint(b2, "#3df5ff"));
  for (const g of parts) for (const k of Object.keys(g.attributes)) if (!["position", "normal", "color"].includes(k)) g.deleteAttribute(k);
  return mergeGeometries(parts);
}
function radialTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function coinDoorTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d")!;
  x.fillStyle = "#5b5866"; x.fillRect(0, 0, 64, 64);
  x.fillStyle = "#3d3a47"; x.fillRect(4, 4, 56, 56);
  x.fillStyle = "#ffd23f"; x.fillRect(29, 12, 6, 20);
  x.fillStyle = "#ff3348"; x.fillRect(18, 42, 28, 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ scene */
export class Arcade {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private uniforms = sharedUniforms();
  private hall = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  private body?: THREE.InstancedMesh;
  private marquee?: THREE.InstancedMesh;
  private cellAttr?: THREE.InstancedBufferAttribute;
  private ghost: THREE.Group;
  private floor: THREE.Mesh;
  private state?: GameState;
  private count = 0;

  private screenCanvas = document.createElement("canvas");
  private screenCtx: CanvasRenderingContext2D;
  private screenTex: THREE.CanvasTexture;
  private atlasCanvas = document.createElement("canvas");
  private atlasCtx: CanvasRenderingContext2D;
  private atlasTex: THREE.CanvasTexture;
  private cellOf = new Map<number, number>(); // machine index -> atlas cell
  private cellOwner: number[] = new Array(CELLS).fill(-1);
  private atlasCenter = new THREE.Vector3(1e9, 0, 0);
  private fontReady = false;

  private raf = 0;
  private running = false;
  private clock = new THREE.Clock();
  private lastScreenDraw = 0;
  private fly: null | { curve: THREE.CatmullRomCurve3; t0: THREE.Vector3; t1: THREE.Vector3; start: number; dur: number; index: number; resolve: () => void } = null;
  private pan: null | { from: THREE.Vector3; to: THREE.Vector3; cam: THREE.Vector3; start: number; dur: number } = null;
  private selected = -1;
  private flashAt = -10;
  private dimTarget = 0;
  private inset = { r: 0, b: 0 };
  private down: { x: number; y: number } | null = null;
  private tmp = new THREE.Vector3();
  private lastInteract = performance.now();

  constructor(private canvas: HTMLCanvasElement, private opts: Options) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(BG);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene.background = BG;
    this.scene.fog = new THREE.Fog(BG, FOG_NEAR, FOG_FAR);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.08, screenSpacePanning: false, minDistance: 2.6, maxDistance: 30,
      minPolarAngle: 0.35, maxPolarAngle: 1.36, rotateSpeed: 0.5, panSpeed: 1.1, zoomSpeed: 0.9,
    });
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls.addEventListener("start", () => { this.lastInteract = performance.now(); this.pan = null; });

    // lights: purple sky, deep floor bounce, a cool key light from the entrance
    this.scene.add(new THREE.HemisphereLight("#7b6bff", "#160a26", 1.5));
    const key = new THREE.DirectionalLight("#bfc8ff", 0.9); key.position.set(3, 8, 10); this.scene.add(key);
    this.scene.add(this.hall);

    this.screenCanvas.width = SCREEN_W * 3; this.screenCanvas.height = SCREEN_H * 2;
    this.screenCtx = this.screenCanvas.getContext("2d")!;
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.atlasCanvas.width = this.atlasCanvas.height = ATLAS;
    this.atlasCtx = this.atlasCanvas.getContext("2d")!;
    this.atlasTex = new THREE.CanvasTexture(this.atlasCanvas);
    this.atlasTex.anisotropy = 4;
    this.atlasTex.generateMipmaps = true;
    this.atlasTex.minFilter = THREE.LinearMipmapLinearFilter;

    this.floor = this.makeFloor();
    this.scene.add(this.floor);
    this.scene.add(this.makeStars());
    this.ghost = this.makeGhost();
    this.scene.add(this.ghost);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.95, 0.55, 0.62);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    canvas.addEventListener("pointerdown", (e) => { this.down = { x: e.clientX, y: e.clientY }; this.lastInteract = performance.now(); });
    canvas.addEventListener("pointerup", (e) => {
      if (!this.down || Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) { this.down = null; return; }
      this.down = null;
      this.opts.onPick(this.pick(e.clientX, e.clientY));
    });
    addEventListener("resize", () => this.resize());
    this.resize();
    document.fonts?.load('800 40px "Unbounded Variable"').then(() => { this.fontReady = true; this.redrawAllCells(); }).catch(() => { this.fontReady = true; });
  }

  /* ---------------------------------------------------------------- building */
  private makeFloor() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, uSpacing: { value: new THREE.Vector2(SPACING, ROW_GAP / 2) } },
      vertexShader: /* glsl */ `varying vec2 vW; varying float vFog;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; vec4 mv = viewMatrix * w; vFog = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `${FOG_GLSL}
        uniform vec2 uSpacing; varying vec2 vW; varying float vFog;
        float line(float v, float s, float w) { float f = abs(fract(v / s + 0.5) - 0.5) * s; return 1.0 - smoothstep(0.0, w, f); }
        void main() {
          float g = max(line(vW.x + ${(SPACING / 2).toFixed(3)}, uSpacing.x, 0.025), line(vW.y + 1.2, uSpacing.y, 0.025));
          vec3 c = vec3(0.022, 0.014, 0.05) + vec3(0.23, 0.15, 0.55) * g * 0.55;
          gl_FragColor = vec4(applyFog(c, vFog), 1.0);
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(80, 400), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0, -170);
    return m;
  }
  private makeStars() {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 60;
      pos.set([Math.cos(a) * r, 6 + Math.random() * 60, -Math.abs(Math.sin(a)) * r - 20], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: "#c9c3ff", size: 0.35, fog: false, transparent: true, opacity: 0.6 }));
  }
  private makeGhost() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, depthWrite: false });
    g.add(new THREE.Mesh(cabinetTrims(), mat));
    const body = new THREE.Mesh(cabinetBody(), new THREE.MeshBasicMaterial({ color: "#2a2045", transparent: true, opacity: 0.25, depthWrite: false }));
    g.add(body);
    g.userData.mat = mat;
    return g;
  }

  setState(state: GameState) {
    this.state = state;
    const n = state.machines.length;
    if (n !== this.count || !this.body) this.build(n);
    this.applyInstances();
    const s = slot(n);
    this.ghost.position.set(s.x, 0, s.z);
    this.ghost.rotation.y = s.rot;
    this.cellOf.clear(); this.cellOwner.fill(-1); this.atlasCenter.set(1e9, 0, 0);
    this.refreshAtlas(true);
  }

  private build(n: number) {
    for (const m of this.meshes) { this.hall.remove(m); m.dispose(); (m.material as THREE.Material).dispose(); }
    this.meshes = [];
    this.count = n;
    if (!n) return;
    const idx = new THREE.InstancedBufferAttribute(new Float32Array(n).map((_, i) => i), 1);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, withIdx = false) => {
      if (withIdx) geo.setAttribute("aIdx", idx);
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.frustumCulled = false;
      this.hall.add(m); this.meshes.push(m);
      return m;
    };
    this.body = add(cabinetBody(), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6, metalness: 0.15 }));

    add(cabinetTrims(), new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: INST_VERT,
      fragmentShader: /* glsl */ `${FOG_GLSL}${POWER_GLSL} varying vec2 vUv; varying float vIdx; varying float vFog; varying vec3 vNeon;
        void main() { vec3 c = vNeon * 1.35 * power(vIdx); gl_FragColor = vec4(applyFog(c, vFog), 1.0); }`,
    }), true).name = "trims";

    const screenGeo = new THREE.PlaneGeometry(0.8, 0.64);
    screenGeo.rotateX(-0.14); screenGeo.translate(0, 1.6, 0.436);
    const game = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    screenGeo.setAttribute("aGame", game);
    add(screenGeo, new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, uMap: { value: this.screenTex } },
      vertexShader: INST_VERT.replace("attribute float aIdx;", "attribute float aIdx; attribute float aGame; varying float vGame;").replace("vUv = uv;", "vUv = uv; vGame = aGame;"),
      fragmentShader: /* glsl */ `${FOG_GLSL}${POWER_GLSL} uniform sampler2D uMap; varying vec2 vUv; varying float vIdx; varying float vFog; varying vec3 vNeon; varying float vGame;
        void main() {
          float col = mod(vGame, 3.0), row = floor(vGame / 3.0);
          vec2 inset = vUv * 0.96 + 0.02;
          vec2 uv = vec2((col + inset.x) / 3.0, 1.0 - (row + 1.0 - inset.y) / 2.0);
          vec3 c = texture2D(uMap, uv).rgb;
          vec2 e = min(vUv, 1.0 - vUv);
          float vig = smoothstep(0.0, 0.12, min(e.x, e.y));
          float p = power(vIdx);
          c = c * vig * (0.75 + 0.45 * p) + vNeon * 0.05;
          gl_FragColor = vec4(applyFog(c, vFog), 1.0);
        }`,
    }), true).name = "screens";

    const mqGeo = new THREE.PlaneGeometry(0.98, 0.4);
    mqGeo.translate(0, 2.12, 0.555);
    this.cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(-1), 1);
    this.cellAttr.setUsage(THREE.DynamicDrawUsage);
    mqGeo.setAttribute("aCell", this.cellAttr);
    this.marquee = add(mqGeo, new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, uAtlas: { value: this.atlasTex }, uGrid: { value: new THREE.Vector2(ATLAS / CELL_W, ATLAS / CELL_H) } },
      vertexShader: INST_VERT.replace("attribute float aIdx;", "attribute float aIdx; attribute float aCell; varying float vCell;").replace("vUv = uv;", "vUv = uv; vCell = aCell;"),
      fragmentShader: /* glsl */ `${FOG_GLSL}${POWER_GLSL} uniform sampler2D uAtlas; uniform vec2 uGrid; varying vec2 vUv; varying float vIdx; varying float vFog; varying vec3 vNeon; varying float vCell;
        void main() {
          float p = power(vIdx);
          vec3 bg = mix(vec3(0.03, 0.02, 0.08), vNeon, 0.16 + 0.1 * smoothstep(1.0, 0.0, vUv.y));
          vec3 c = bg;
          if (vCell >= 0.0) {
            float cx = mod(vCell, uGrid.x), cy = floor(vCell / uGrid.x);
            vec2 uv = vec2((cx + vUv.x) / uGrid.x, 1.0 - (cy + 1.0 - vUv.y) / uGrid.y);
            vec4 t = texture2D(uAtlas, uv);
            c += t.rgb * mix(vNeon, vec3(1.0), 0.72) * (0.85 + 0.35 * p);
          } else {
            float bar = smoothstep(0.03, 0.0, abs(vUv.y - 0.42)) * step(0.22, vUv.x) * step(vUv.x, 0.78);
            c += vNeon * bar * 0.5;
          }
          c *= mix(0.55, 1.0, min(p, 1.0));
          gl_FragColor = vec4(applyFog(c, vFog), 1.0);
        }`,
    }), true);

    const doorGeo = new THREE.PlaneGeometry(0.3, 0.3); doorGeo.translate(0, 0.6, 0.432);
    add(doorGeo, new THREE.MeshBasicMaterial({ map: coinDoorTexture() })).userData.plain = true;
    add(cabinetControls(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1 })).userData.plain = true;

    const poolGeo = new THREE.PlaneGeometry(2.6, 2.6); poolGeo.rotateX(-Math.PI / 2); poolGeo.translate(0, 0.012, 1.25);
    add(poolGeo, new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, uMap: { value: radialTexture() } }, vertexShader: INST_VERT,
      fragmentShader: /* glsl */ `${FOG_GLSL}${POWER_GLSL} uniform sampler2D uMap; uniform float uTime; varying vec2 vUv; varying float vIdx; varying float vFog; varying vec3 vNeon;
        void main() {
          float a = texture2D(uMap, vUv).r * (0.42 + 0.06 * sin(uTime * 1.7 + vIdx * 1.3)) * power(vIdx);
          float f = 1.0 - smoothstep(uFogNear, uFogFar, vFog);
          gl_FragColor = vec4(vNeon * a * f, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }), true);
  }

  private applyInstances() {
    if (!this.state || !this.count) return;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    const neon = new THREE.Color(), body = new THREE.Color(), base = new THREE.Color("#2a2163");
    const games = this.meshes.find((m) => m.name === "screens")!.geometry.getAttribute("aGame") as THREE.InstancedBufferAttribute;
    this.state.machines.forEach((mc, i) => {
      const s = slot(i);
      m4.compose(this.tmp.set(s.x, 0, s.z), q.setFromAxisAngle(up, s.rot), one);
      neon.set(NEONS[mc[3] % NEONS.length]);
      body.copy(base).lerp(neon, 0.1);
      for (const m of this.meshes) {
        m.setMatrixAt(i, m4);
        if (!m.userData.plain) m.setColorAt(i, m === this.body ? body : neon);
      }
      games.setX(i, mc[2] % GAMES.length);
    });
    for (const m of this.meshes) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    games.needsUpdate = true;
  }

  /* ---------------------------------------------------------------- marquee atlas (LOD: only the nearest CELLS machines get text) */
  private refreshAtlas(force = false) {
    if (!this.state || !this.cellAttr || !this.count) return;
    const c = this.controls.target;
    if (!force && c.distanceToSquared(this.atlasCenter) < 16) return;
    this.atlasCenter.copy(c);
    const want = Array.from({ length: this.count }, (_, i) => i);
    if (this.count > CELLS) {
      const d = want.map((i) => { const s = slot(i); return (s.x - c.x) ** 2 + (s.z - c.z) ** 2 * 0.6; });
      want.sort((a, b) => d[a] - d[b]);
      want.length = CELLS;
      if (this.selected >= 0 && !want.includes(this.selected)) want[CELLS - 1] = this.selected;
    }
    const keep = new Set(want);
    for (const [i, cell] of this.cellOf) if (!keep.has(i)) { this.cellOf.delete(i); this.cellOwner[cell] = -1; this.cellAttr.setX(i, -1); }
    let free = 0, dirty = false;
    for (const i of want) {
      if (this.cellOf.has(i)) continue;
      while (this.cellOwner[free] !== -1) free++;
      this.cellOwner[free] = i; this.cellOf.set(i, free);
      this.drawCell(free, i);
      this.cellAttr.setX(i, free);
      dirty = true;
    }
    if (dirty || force) { this.atlasTex.needsUpdate = true; this.cellAttr.needsUpdate = true; }
  }
  private redrawAllCells() {
    for (const [i, cell] of this.cellOf) this.drawCell(cell, i);
    this.atlasTex.needsUpdate = true;
  }
  private drawCell(cell: number, i: number) {
    const x = this.atlasCtx, cols = ATLAS / CELL_W;
    const ox = (cell % cols) * CELL_W, oy = Math.floor(cell / cols) * CELL_H;
    x.clearRect(ox, oy, CELL_W, CELL_H);
    const h = this.state!.machines[i][0];
    const display = this.fontReady ? '"Unbounded Variable", "Arial Black", sans-serif' : '"Arial Black", sans-serif';
    x.save();
    x.beginPath(); x.rect(ox, oy, CELL_W, CELL_H); x.clip();
    x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
    x.shadowColor = "rgba(255,255,255,.9)"; x.shadowBlur = 10;
    x.font = `600 17px ui-monospace, Menlo, monospace`;
    x.globalAlpha = 0.8;
    x.fillText(pad(i + 1), ox + CELL_W / 2, oy + 26);
    x.globalAlpha = 1;
    const label = i === 0 ? "FOUNDER" : h ? `@${h}` : "PLAYER";
    let size = 44;
    do { x.font = `800 ${size}px ${display}`; size -= 2; } while (x.measureText(label).width > CELL_W - 22 && size > 16);
    x.fillText(label, ox + CELL_W / 2, oy + 78);
    x.restore();
  }

  /* ---------------------------------------------------------------- camera */
  private dist() { const a = this.camera.aspect; return a < 0.7 ? 15 : a < 1.1 ? 12 : 10; }
  home(instant = false) {
    const t = new THREE.Vector3(0, 1.4, -3.5);
    const p = t.clone().add(new THREE.Vector3(0, 0.42, 1).normalize().multiplyScalar(this.dist()));
    this.animateCamera(p, t, instant ? 0 : 1.4);
  }
  private animateCamera(pos: THREE.Vector3, target: THREE.Vector3, dur: number) {
    if (dur <= 0 || this.opts.reducedMotion) {
      this.camera.position.copy(pos); this.controls.target.copy(target); this.controls.update(); return;
    }
    const curve = new THREE.CatmullRomCurve3([this.camera.position.clone(), pos.clone()]);
    this.fly = { curve, t0: this.controls.target.clone(), t1: target.clone(), start: performance.now(), dur: dur * 1000, index: -1, resolve: () => {} };
  }

  /** Cinematic flight down the aisles to a machine. */
  flyTo(index: number, opts: { instant?: boolean } = {}): Promise<void> {
    if (!this.state || index < 0 || index >= this.count) return Promise.resolve();
    this.selected = index;
    this.uniforms.uSel.value = index;
    this.dimTarget = 1;
    this.refreshAtlasFor(index);
    const s = slot(index);
    const f = new THREE.Vector3(Math.sin(s.rot), 0, Math.cos(s.rot));
    const portrait = this.camera.aspect < 0.8;
    const t1 = new THREE.Vector3(s.x, 1.72, s.z).addScaledVector(f, 0.4);
    const p1 = new THREE.Vector3(s.x, 0, s.z).addScaledVector(f, portrait ? 5.2 : 3.9).add(new THREE.Vector3(0, portrait ? 2.5 : 2.2, 0));
    const p0 = this.camera.position.clone();
    const d = p0.distanceTo(p1);
    if (opts.instant || this.opts.reducedMotion || d < 0.05) {
      this.fly = null;
      this.camera.position.copy(p1); this.controls.target.copy(t1); this.controls.update();
      this.arrive(index);
      return Promise.resolve();
    }
    const lift = Math.min(9, 2.5 + d * 0.09);
    const mid = p0.clone().lerp(p1, 0.45); mid.y = Math.max(p0.y, p1.y) + lift;
    const approach = p1.clone().addScaledVector(f, 2.8); approach.y = p1.y + 1.1;
    const pts = d > 6 ? [p0, mid, approach, p1] : [p0, approach.lerp(p0, 0.3), p1];
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    this.controls.enabled = false;
    return new Promise((resolve) => {
      this.fly = { curve, t0: this.controls.target.clone(), t1, start: performance.now(), dur: Math.min(4200, Math.max(1500, 1100 + d * 55)), index, resolve };
    });
  }
  private refreshAtlasFor(index: number) {
    if (!this.cellOf.has(index) && this.count > CELLS) { const s = slot(index); this.controls.target.set(s.x, 1.4, s.z); this.refreshAtlas(true); }
  }
  private arrive(index: number) {
    this.flashAt = performance.now();
    this.controls.enabled = true;
    this.refreshAtlas(true);
    this.opts.onArrive(index);
  }
  clearSelection() {
    this.selected = -1;
    this.uniforms.uSel.value = -1;
    this.dimTarget = 0;
  }
  /** Smoothly pan the hall to a row (used by the ruler). */
  goToRow(row: number, instant = false) {
    const z = -Math.max(0, Math.min(rowsFor(this.count) - 1, row)) * ROW_GAP;
    const to = new THREE.Vector3(this.controls.target.x, this.controls.target.y, z - 0.5);
    const delta = to.clone().sub(this.controls.target);
    if (instant || this.opts.reducedMotion) {
      this.controls.target.add(delta); this.camera.position.add(delta); this.controls.update(); return;
    }
    this.fly = null;
    this.pan = { from: this.controls.target.clone(), to, cam: this.camera.position.clone(), start: performance.now(), dur: 550 };
  }
  viewRow() { return Math.max(0, Math.round(-this.controls.target.z / ROW_GAP)); }
  rows() { return rowsFor(this.count); }
  isSelected(i: number) { return this.selected === i; }

  setInset(right: number, bottom: number) {
    this.inset = { r: Math.round(right), b: Math.round(bottom) };
    this.resize();
  }

  project(index: number): { x: number; y: number; visible: boolean } | null {
    if (index < 0 || index > this.count) return null;
    const s = slot(index);
    const f = new THREE.Vector3(Math.sin(s.rot), 0, Math.cos(s.rot));
    const v = new THREE.Vector3(s.x, 2.48, s.z).addScaledVector(f, 0.55);
    const depth = v.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
    v.project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    const fullW = r.width + this.inset.r, fullH = r.height + this.inset.b;
    const x = ((v.x + 1) / 2) * fullW - this.inset.r, y = ((1 - v.y) / 2) * fullH - this.inset.b;
    return { x, y, visible: depth < -0.5 && -depth < FOG_FAR * 0.8 && x > -40 && x < r.width + 40 && y > -40 && y < r.height + 40 };
  }

  private pick(cx: number, cy: number): number | null {
    if (!this.body) return null;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObject(this.body, false)[0];
    return hit?.instanceId ?? null;
  }

  /* ---------------------------------------------------------------- loop */
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 58 : 48;
    if (this.inset.r || this.inset.b) this.camera.setViewOffset(w + this.inset.r, h + this.inset.b, this.inset.r, this.inset.b, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    const loop = () => { if (!this.running) return; this.raf = requestAnimationFrame(loop); this.frame(); };
    loop();
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  private frame() {
    const now = performance.now();
    const t = this.clock.getElapsedTime();
    this.uniforms.uTime.value = t;

    // screens: redraw the six shared mini-games at ~30 fps
    if (now - this.lastScreenDraw > (this.opts.reducedMotion ? 400 : 33)) {
      this.lastScreenDraw = now;
      const tt = this.opts.reducedMotion ? 1.5 : t;
      for (let g = 0; g < 6; g++) {
        const c = this.screenCtx;
        c.save(); c.translate((g % 3) * SCREEN_W, Math.floor(g / 3) * SCREEN_H);
        c.beginPath(); c.rect(0, 0, SCREEN_W, SCREEN_H); c.clip();
        drawGame(g, c, SCREEN_W, SCREEN_H, tt + g * 0.7);
        c.restore();
      }
      this.screenTex.needsUpdate = true;
    }

    if (this.fly) {
      const u = Math.min(1, (now - this.fly.start) / this.fly.dur);
      this.camera.position.copy(this.fly.curve.getPoint(ease(u)));
      this.controls.target.lerpVectors(this.fly.t0, this.fly.t1, easeOut(u * 1.15));
      this.camera.lookAt(this.controls.target);
      if (u > 0.55) this.refreshAtlas();
      if (u >= 1) {
        const f = this.fly; this.fly = null;
        this.controls.update();
        if (f.index >= 0) { this.arrive(f.index); f.resolve(); } else this.controls.enabled = true;
      }
    } else if (this.pan) {
      const u = Math.min(1, (now - this.pan.start) / this.pan.dur), e = ease(u);
      const p = this.pan.from.clone().lerp(this.pan.to, e);
      this.camera.position.copy(this.pan.cam).add(p.clone().sub(this.pan.from));
      this.controls.target.copy(p);
      this.controls.update();
      if (u >= 1) this.pan = null;
    } else {
      this.controls.update();
      // keep the view inside the hall
      const tg = this.controls.target, minZ = -hallDepth(this.count) + 1;
      const cx = Math.max(-(COLS / 2) * SPACING, Math.min((COLS / 2) * SPACING, tg.x)), cz = Math.max(minZ, Math.min(6, tg.z));
      if (cx !== tg.x || cz !== tg.z || Math.abs(tg.y - 1.4) > 1.2) {
        const d = this.tmp.set(cx - tg.x, Math.max(0.4, Math.min(2.6, tg.y)) - tg.y, cz - tg.z);
        tg.add(d); this.camera.position.add(d);
      }
      if (this.camera.position.y < 0.7) this.camera.position.y = 0.7;
      this.refreshAtlas();
    }

    // selection flash + dimming of the rest of the hall
    const since = (now - this.flashAt) / 1000;
    this.uniforms.uFlash.value = this.selected >= 0 && since >= 0 ? Math.exp(-since * 2.4) * (1 + 0.3 * Math.sin(since * 30) * Math.exp(-since * 4)) + 0.12 * (0.5 + 0.5 * Math.sin(t * 3.2)) : 0;
    this.uniforms.uDim.value += (this.dimTarget - this.uniforms.uDim.value) * 0.06;
    (this.ghost.userData.mat as THREE.MeshBasicMaterial).opacity = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(t * 2.2));

    this.composer.render();
    this.opts.onFrame();
  }

  dispose() {
    this.stop();
    for (const m of this.meshes) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    this.renderer.dispose();
  }
}
