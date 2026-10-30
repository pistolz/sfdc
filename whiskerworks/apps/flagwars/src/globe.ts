import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { World } from "./geo";
import type { GameState } from "./types";

const LAND = new THREE.Color("#45bcc6");
const LAND_DARK = new THREE.Color("#2f97a6");
const BASE_H = 0.011;
const MAX_FLAGS = 40;
const MAX_BUILDINGS = 600;
const FULL_LEVEL = 6; // territory covers the whole country at this level

export interface Projected { x: number; y: number; visible: boolean; facing: number }
export interface GlobeOptions { reducedMotion: boolean; onPick?: (code: string | null) => void; onFrame?: () => void }

const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();

function rand(i: number) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface FlagObj { code: string; group: THREE.Group; holder: THREE.Group; mat: THREE.ShaderMaterial; normal: THREE.Vector3; tex?: THREE.Texture }

export class Globe {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private world: World;
  private opts: GlobeOptions;
  private hexMesh: THREE.InstancedMesh;
  private towerMesh: THREE.InstancedMesh;
  private roofMesh: THREE.InstancedMesh;
  private flagGroup = new THREE.Group();
  private flags = new Map<string, FlagObj>();
  private poleGeo = new THREE.CylinderGeometry(0.0017, 0.0017, 1, 6).translate(0, 0.5, 0);
  private knobGeo = new THREE.SphereGeometry(0.0042, 10, 8);
  private flagGeo = new THREE.PlaneGeometry(1, 1, 18, 8).translate(0.5, 0, 0);
  private poleMat = new THREE.MeshStandardMaterial({ color: "#2a2238", roughness: 0.6 });
  private knobMat = new THREE.MeshStandardMaterial({ color: "#ffc93c", roughness: 0.3, metalness: 0.6, emissive: "#6b4a00" });
  private heightsFrom: Float32Array;
  private heightsTo: Float32Array;
  private colorsFrom: Float32Array;
  private colorsTo: Float32Array;
  private animStart: Float32Array;
  private animating = false;
  private hexQuat: THREE.Quaternion[] = [];
  private raf = 0;
  private running = false;
  private clock = new THREE.Clock();
  private flight: { from: THREE.Vector3; to: THREE.Vector3; d0: number; d1: number; t0: number; dur: number } | null = null;
  private idleTimer = 0;
  private fitDistance = 3;
  private inset = { x: 0, y: 0, tx: 0, ty: 0, base: 0 };
  private down: { x: number; y: number; t: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private disposers: (() => void)[] = [];

  constructor(private canvas: HTMLCanvasElement, world: World, opts: GlobeOptions) {
    this.world = world;
    this.opts = opts;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
    this.scene.add(this.camera);

    // lights: a key light that follows the camera keeps the visible face lit like the video
    this.scene.add(new THREE.HemisphereLight("#cdeeff", "#221a4a", 1.15));
    const key = new THREE.DirectionalLight("#ffffff", 1.9);
    key.position.set(1.6, 2.2, 3);
    this.camera.add(key);
    const rim = new THREE.DirectionalLight("#8a7bff", 0.7);
    rim.position.set(-3, -1, -2);
    this.camera.add(rim);

    this.buildOcean();
    this.buildStars();

    // land hexes
    const n = world.hexes.length;
    const r = Math.sqrt((4 * Math.PI) / world.N) * 0.54;
    const hexGeo = new THREE.CylinderGeometry(r, r, 1, 6, 1).translate(0, 0.5, 0);
    const hexMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, flatShading: true });
    this.hexMesh = new THREE.InstancedMesh(hexGeo, hexMat, n);
    this.hexMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.heightsFrom = new Float32Array(n);
    this.heightsTo = new Float32Array(n);
    this.colorsFrom = new Float32Array(n * 3);
    this.colorsTo = new Float32Array(n * 3);
    this.animStart = new Float32Array(n);
    world.hexes.forEach((h, i) => {
      tmpV.set(...h.v);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, tmpV);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rand(i) * Math.PI));
      this.hexQuat.push(q);
      const base = BASE_H + rand(i + 7) * 0.004;
      this.heightsFrom[i] = this.heightsTo[i] = base;
      tmpC.copy(LAND).lerp(LAND_DARK, rand(i + 3) * 0.55);
      tmpC.toArray(this.colorsFrom, i * 3);
      tmpC.toArray(this.colorsTo, i * 3);
      this.writeHex(i, base, tmpC);
    });
    this.hexMesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.hexMesh);

    // buildings (towers + roofs) for countries at LV2+
    const towerGeo = new THREE.CylinderGeometry(r * 0.42, r * 0.5, 1, 8).translate(0, 0.5, 0);
    const roofGeo = new THREE.ConeGeometry(r * 0.62, 1, 8).translate(0, 0.5, 0);
    this.towerMesh = new THREE.InstancedMesh(towerGeo, new THREE.MeshStandardMaterial({ color: "#fff3e6", roughness: 0.7 }), MAX_BUILDINGS);
    this.roofMesh = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ roughness: 0.5 }), MAX_BUILDINGS);
    this.towerMesh.count = this.roofMesh.count = 0;
    this.scene.add(this.towerMesh, this.roofMesh, this.flagGroup);

    // controls
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.55, zoomSpeed: 0.7,
      minDistance: 1.45, autoRotate: !opts.reducedMotion, autoRotateSpeed: -0.45,
    });
    const onStart = () => { this.controls.autoRotate = false; this.flight = null; window.clearTimeout(this.idleTimer); };
    const onEnd = () => { this.scheduleIdle(); };
    this.controls.addEventListener("start", onStart);
    this.controls.addEventListener("end", onEnd);

    const pd = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const pu = (e: PointerEvent) => {
      if (!this.down) return;
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
      if (moved < 6 && performance.now() - this.down.t < 500) this.pick(e.clientX, e.clientY);
      this.down = null;
    };
    canvas.addEventListener("pointerdown", pd);
    canvas.addEventListener("pointerup", pu);
    this.disposers.push(() => { canvas.removeEventListener("pointerdown", pd); canvas.removeEventListener("pointerup", pu); });

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
    this.disposers.push(() => ro.disconnect());
    this.resize(true);
  }

  /* ------------------------------------------------------------ scene */
  private buildOcean() {
    const ocean = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 64),
      new THREE.MeshStandardMaterial({ color: "#1a3a8c", roughness: 0.42, metalness: 0.15, emissive: "#0b1446", emissiveIntensity: 0.9 }),
    );
    this.scene.add(ocean);

    // lat/long grid
    const pts: number[] = [];
    const R = 1.0015;
    for (let lat = -75; lat <= 75; lat += 15) {
      const y = Math.sin((lat * Math.PI) / 180), rr = Math.cos((lat * Math.PI) / 180);
      for (let k = 0; k < 128; k++) {
        const a0 = (k / 128) * Math.PI * 2, a1 = ((k + 1) / 128) * Math.PI * 2;
        pts.push(Math.cos(a0) * rr * R, y * R, Math.sin(a0) * rr * R, Math.cos(a1) * rr * R, y * R, Math.sin(a1) * rr * R);
      }
    }
    for (let lon = 0; lon < 360; lon += 15) {
      const a = (lon * Math.PI) / 180;
      for (let k = 0; k < 64; k++) {
        const p0 = -Math.PI / 2 + (k / 64) * Math.PI, p1 = -Math.PI / 2 + ((k + 1) / 64) * Math.PI;
        pts.push(Math.cos(p0) * Math.cos(a) * R, Math.sin(p0) * R, Math.cos(p0) * Math.sin(a) * R, Math.cos(p1) * Math.cos(a) * R, Math.sin(p1) * R, Math.cos(p1) * Math.sin(a) * R);
      }
    }
    const grid = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)),
      new THREE.LineBasicMaterial({ color: "#6f9bff", transparent: true, opacity: 0.2, depthWrite: false }),
    );
    this.scene.add(grid);

    const fresnel = (color: string, power: number, intensity: number, side: THREE.Side, inner: boolean) =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uIntensity: { value: intensity } },
        vertexShader: `varying vec3 vN; varying vec3 vV;
          void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: inner
          ? `uniform vec3 uColor; uniform float uPower; uniform float uIntensity; varying vec3 vN; varying vec3 vV;
             void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), uPower); gl_FragColor = vec4(uColor, f*uIntensity); }`
          : `uniform vec3 uColor; uniform float uPower; uniform float uIntensity; varying vec3 vN; varying vec3 vV;
             void main(){ float f = pow(max(0.0, 0.72 + dot(vN, vV)), uPower); gl_FragColor = vec4(uColor, f*uIntensity); }`,
        side, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.003, 96, 64), fresnel("#66d9ff", 3.2, 1.0, THREE.FrontSide, true)));
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.14, 96, 64), fresnel("#3fa8ff", 5.0, 1.6, THREE.BackSide, false)));
  }

  private buildStars() {
    const n = 1800, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rand(i * 3.1) * 2 - 1, t = rand(i * 7.7) * Math.PI * 2, rr = 30 + rand(i * 1.3) * 40, s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(t) * s * rr, u * rr, Math.sin(t) * s * rr], i * 3);
      tmpC.set(rand(i) > 0.85 ? "#ffd9a8" : rand(i + 1) > 0.8 ? "#bcd2ff" : "#ffffff").multiplyScalar(0.5 + rand(i * 9) * 0.5);
      tmpC.toArray(col, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })));
  }

  private writeHex(i: number, h: number, c: THREE.Color) {
    const v = this.world.hexes[i].v;
    tmpV.set(v[0], v[1], v[2]).multiplyScalar(0.996);
    tmpS.set(1, h + 0.004, 1);
    tmpM.compose(tmpV, this.hexQuat[i], tmpS);
    this.hexMesh.setMatrixAt(i, tmpM);
    this.hexMesh.setColorAt(i, c);
  }

  /* ------------------------------------------------------------ state */
  /** Territory share of a country: a patch at LV1 that grows to the whole country at FULL_LEVEL. */
  static fraction(level: number, progress: number, next: number) {
    if (level <= 0) return 0;
    const lv = level - 1 + (next ? Math.min(1, progress / next) : 0);
    return Math.min(1, 0.07 + 0.93 * Math.pow(lv / (FULL_LEVEL - 1), 0.85));
  }

  setState(state: GameState, animate = true) {
    const now = this.clock.getElapsedTime();
    const owned = new Map<number, { color: THREE.Color; level: number; order: number; total: number }>();
    for (const [code, c] of Object.entries(state.countries)) {
      const geo = this.world.byCode.get(code);
      if (!geo) continue;
      const take = Math.max(1, Math.round(geo.hexIds.length * Globe.fraction(c.level, c.progress, c.next)));
      const col = new THREE.Color(c.color).lerp(new THREE.Color("#ffffff"), 0.16);
      geo.hexIds.slice(0, take).forEach((hi, k) => owned.set(hi, { color: col, level: c.level, order: k, total: take }));
    }
    const n = this.world.hexes.length;
    for (let i = 0; i < n; i++) {
      // freeze current interpolated value as the new start
      const cur = this.currentHex(i, now);
      this.heightsFrom[i] = cur.h;
      cur.c.toArray(this.colorsFrom, i * 3);
      const o = owned.get(i);
      if (o) {
        this.heightsTo[i] = 0.021 + o.level * 0.0032 + rand(i + 11) * 0.006;
        tmpC.copy(o.color).offsetHSL(0, 0, (rand(i + 5) - 0.5) * 0.08);
        tmpC.toArray(this.colorsTo, i * 3);
        this.animStart[i] = animate && !this.opts.reducedMotion ? now + 0.25 + (o.order / Math.max(1, o.total)) * 1.4 : -10;
      } else {
        this.heightsTo[i] = BASE_H + rand(i + 7) * 0.004;
        tmpC.copy(LAND).lerp(LAND_DARK, rand(i + 3) * 0.55);
        tmpC.toArray(this.colorsTo, i * 3);
        this.animStart[i] = animate && !this.opts.reducedMotion ? now : -10;
      }
    }
    this.animating = true;
    this.buildBuildings(state);
    this.buildFlags(state);
  }

  private currentHex(i: number, now: number) {
    const t = Math.min(1, Math.max(0, (now - this.animStart[i]) / 0.7));
    const e = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
    const overshoot = t > 0 && t < 1 ? Math.sin(t * Math.PI) * 0.25 : 0;
    const h = this.heightsFrom[i] + (this.heightsTo[i] - this.heightsFrom[i]) * (e + overshoot);
    const c = new THREE.Color(
      this.colorsFrom[i * 3] + (this.colorsTo[i * 3] - this.colorsFrom[i * 3]) * e,
      this.colorsFrom[i * 3 + 1] + (this.colorsTo[i * 3 + 1] - this.colorsFrom[i * 3 + 1]) * e,
      this.colorsFrom[i * 3 + 2] + (this.colorsTo[i * 3 + 2] - this.colorsFrom[i * 3 + 2]) * e,
    );
    return { h, c, done: t >= 1 };
  }

  private stepHexes(now: number) {
    if (!this.animating) return;
    let pending = false;
    for (let i = 0; i < this.world.hexes.length; i++) {
      const st = this.animStart[i];
      if (st <= -20) continue; // settled
      if (st < -5) {
        // instant change (reduced motion / first paint)
        tmpC.fromArray(this.colorsTo, i * 3);
        this.writeHex(i, this.heightsTo[i], tmpC);
        this.animStart[i] = -20;
        continue;
      }
      const cur = this.currentHex(i, now);
      this.writeHex(i, cur.h, cur.c);
      if (!cur.done) pending = true;
      else this.animStart[i] = -20;
    }
    this.hexMesh.instanceMatrix.needsUpdate = true;
    this.hexMesh.instanceColor!.needsUpdate = true;
    this.animating = pending;
  }

  private surface(code: string): { p: THREE.Vector3; n: THREE.Vector3 } | null {
    const geo = this.world.byCode.get(code);
    if (!geo) return null;
    const n = new THREE.Vector3(...geo.anchor);
    const hi = geo.hexIds[0];
    const h = hi !== undefined ? this.heightsTo[hi] : BASE_H;
    return { n, p: n.clone().multiplyScalar(0.996 + h + 0.004) };
  }

  private buildBuildings(state: GameState) {
    let k = 0;
    const roofColor = new THREE.Color();
    for (const row of state.leaderboard) {
      if (row.level < 2) continue;
      const geo = this.world.byCode.get(row.code);
      if (!geo) continue;
      const take = Math.max(1, Math.round(geo.hexIds.length * Globe.fraction(row.level, row.progress, row.next)));
      const want = Math.min(take - 1, (row.level - 1) * 3 + Math.floor((row.progress / row.next) * 3), 14);
      if (want <= 0) continue;
      roofColor.set(row.color);
      const stride = Math.max(1, Math.floor((take - 1) / want));
      for (let j = 0; j < want && k < MAX_BUILDINGS; j++) {
        const hi = geo.hexIds[1 + j * stride];
        if (hi === undefined) break;
        const v = this.world.hexes[hi].v;
        const n = tmpV.set(v[0], v[1], v[2]);
        const top = 0.996 + this.heightsTo[hi] + 0.004;
        const bodyH = 0.014 + rand(hi) * 0.012 + row.level * 0.002;
        const q = this.hexQuat[hi];
        tmpM.compose(n.clone().multiplyScalar(top), q, tmpS.set(1, bodyH, 1));
        this.towerMesh.setMatrixAt(k, tmpM);
        tmpM.compose(n.clone().multiplyScalar(top + bodyH), q, tmpS.set(1, 0.013, 1));
        this.roofMesh.setMatrixAt(k, tmpM);
        this.roofMesh.setColorAt(k, roofColor);
        k++;
      }
    }
    this.towerMesh.count = this.roofMesh.count = k;
    this.towerMesh.instanceMatrix.needsUpdate = this.roofMesh.instanceMatrix.needsUpdate = true;
    if (this.roofMesh.instanceColor) this.roofMesh.instanceColor.needsUpdate = true;
  }

  private buildFlags(state: GameState) {
    const keep = new Set(state.leaderboard.slice(0, MAX_FLAGS).map((r) => r.code));
    for (const [code, f] of this.flags) if (!keep.has(code)) { this.flagGroup.remove(f.group); f.mat.dispose(); f.tex?.dispose(); this.flags.delete(code); }
    for (const row of state.leaderboard.slice(0, MAX_FLAGS)) {
      const s = this.surface(row.code);
      if (!s) continue;
      let f = this.flags.get(row.code);
      if (!f) {
        f = this.makeFlag(row.code);
        this.flags.set(row.code, f);
        this.flagGroup.add(f.group);
      }
      const scale = (row.rank === 1 ? 2.1 : row.rank <= 3 ? 1.75 : row.rank <= 10 ? 1.3 : 0.95) + Math.min(row.level, 6) * 0.06;
      f.group.position.copy(s.p);
      f.normal.copy(s.n);
      f.group.quaternion.setFromUnitVectors(UP, s.n);
      f.group.scale.setScalar(scale);
    }
  }

  private makeFlag(code: string): FlagObj {
    const group = new THREE.Group();
    const poleH = 0.095;
    const pole = new THREE.Mesh(this.poleGeo, this.poleMat);
    pole.scale.set(1, poleH, 1);
    const knob = new THREE.Mesh(this.knobGeo, this.knobMat);
    knob.position.y = poleH + 0.002;
    const holder = new THREE.Group();
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, uTime: { value: 0 }, uAmp: { value: this.opts.reducedMotion ? 0 : 1 }, uReady: { value: 0 } },
      vertexShader: `uniform float uTime; uniform float uAmp; varying vec2 vUv; varying float vShade;
        void main(){ vUv = uv; vec3 p = position;
          float w = sin(p.x*7.0 - uTime*4.2) * 0.09 * p.x * uAmp + sin(p.x*13.0 - uTime*6.1 + p.y*3.0) * 0.025 * p.x * uAmp;
          p.z += w; p.y -= p.x*p.x*0.06;
          vShade = 0.82 + 0.35 * cos(p.x*7.0 - uTime*4.2) * p.x * uAmp;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
      fragmentShader: `uniform sampler2D map; uniform float uReady; varying vec2 vUv; varying float vShade;
        void main(){ vec3 c = mix(vec3(0.9), texture2D(map, vUv).rgb, uReady); gl_FragColor = vec4(c * clamp(vShade, 0.6, 1.15), 1.0); }`,
      side: THREE.DoubleSide,
    });
    mat.toneMapped = false;
    const cloth = new THREE.Mesh(this.flagGeo, mat);
    cloth.scale.set(0.066, 0.046, 0.066);
    cloth.position.y = poleH - 0.025;
    holder.add(cloth);
    group.add(pole, knob, holder);
    const obj: FlagObj = { code, group, holder, mat, normal: new THREE.Vector3(0, 1, 0) };
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = 256; cv.height = 176;
      const ctx = cv.getContext("2d")!;
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      obj.tex = tex;
      mat.uniforms.map.value = tex;
      mat.uniforms.uReady.value = 1;
    };
    img.src = `/flags/${code}.svg`;
    return obj;
  }

  /* ------------------------------------------------------------ camera */
  private resize(initial = false) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    const portrait = aspect < 0.9;
    const half = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const fw = portrait ? 1.02 : 0.6, fh = portrait ? 0.6 : 0.66;
    const dw = 1 / Math.sin(Math.atan(fw * half * aspect));
    const dh = 1 / Math.sin(Math.atan(fh * half));
    this.fitDistance = Math.max(dw, dh);
    // push the globe slightly down in portrait, like the episodes
    this.inset.base = portrait ? -h * 0.05 : -h * 0.07;
    this.applyOffset();
    this.controls.maxDistance = this.fitDistance * 1.6;
    if (initial) this.camera.position.set(0, 0.5, 1).normalize().multiplyScalar(this.fitDistance);
    else if (this.camera.position.length() > this.controls.maxDistance) this.camera.position.setLength(this.controls.maxDistance);
  }

  /** Keep the globe centred in the area not covered by a panel (bottom sheet on mobile, side panel on desktop). */
  setInset(right: number, bottom: number) {
    this.inset.tx = right / 2;
    this.inset.ty = bottom / 2;
    if (this.opts.reducedMotion) { this.inset.x = this.inset.tx; this.inset.y = this.inset.ty; this.applyOffset(); }
  }

  private applyOffset() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.camera.setViewOffset(w, h, this.inset.x, this.inset.base + this.inset.y, w, h);
    this.camera.updateProjectionMatrix();
  }

  private stepInset() {
    const i = this.inset;
    if (Math.abs(i.tx - i.x) < 0.5 && Math.abs(i.ty - i.y) < 0.5) return;
    i.x += (i.tx - i.x) * 0.12;
    i.y += (i.ty - i.y) * 0.12;
    this.applyOffset();
  }

  private scheduleIdle() {
    window.clearTimeout(this.idleTimer);
    if (this.opts.reducedMotion) return;
    this.idleTimer = window.setTimeout(() => { if (!this.flight) this.controls.autoRotate = true; }, 9000);
  }

  /** Point the camera at a country (or the whole globe when code is null). */
  focus(code: string | null, opts: { close?: boolean; instant?: boolean } = {}) {
    const geo = code ? this.world.byCode.get(code) : null;
    const from = this.camera.position.clone().normalize();
    let to: THREE.Vector3, d1: number;
    if (geo) {
      to = new THREE.Vector3(...geo.anchor).add(new THREE.Vector3(0, 0.05, 0)).normalize();
      const big = geo.hexIds.length > 600;
      d1 = opts.close === false ? this.fitDistance : Math.max(this.controls.minDistance + 0.2, this.fitDistance * (big ? 0.82 : 0.68));
    } else {
      to = from.clone();
      d1 = this.fitDistance;
    }
    this.controls.autoRotate = false;
    window.clearTimeout(this.idleTimer);
    if (opts.instant || this.opts.reducedMotion) {
      this.camera.position.copy(to.multiplyScalar(d1));
      this.controls.update();
      this.scheduleIdle();
      return;
    }
    this.flight = { from, to, d0: this.camera.position.length(), d1, t0: this.clock.getElapsedTime(), dur: 1.5 };
  }

  private stepFlight(now: number) {
    if (!this.flight) return;
    const f = this.flight;
    const t = Math.min(1, (now - f.t0) / f.dur);
    const e = easeInOut(t);
    tmpQ.setFromUnitVectors(f.from, f.to);
    const dir = f.from.clone().applyQuaternion(new THREE.Quaternion().slerp(tmpQ, e));
    const arc = Math.sin(e * Math.PI) * 0.18 * f.from.angleTo(f.to);
    this.camera.position.copy(dir.multiplyScalar(f.d0 + (f.d1 - f.d0) * e + arc));
    this.camera.lookAt(0, 0, 0);
    if (t >= 1) { this.flight = null; this.scheduleIdle(); }
  }

  /* ------------------------------------------------------------ picking & projection */
  private pick(cx: number, cy: number) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.hexMesh, false)[0];
    let code: string | null = null;
    if (hit && hit.instanceId !== undefined) {
      const owner = this.world.hexes[hit.instanceId].owner;
      code = owner >= 0 ? this.world.countries[owner].code : null;
    }
    this.opts.onPick?.(code);
  }

  /** Screen position of a country's flag top (CSS pixels relative to the canvas). */
  project(code: string, lift = 0.11): Projected | null {
    const s = this.surface(code);
    if (!s) return null;
    const f = this.flags.get(code);
    const p = f ? f.group.localToWorld(new THREE.Vector3(0, lift, 0)) : s.p.clone().addScaledVector(s.n, lift);
    const toCam = this.camera.position.clone().sub(s.p).normalize();
    const facing = s.n.dot(toCam);
    p.project(this.camera);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: facing > 0.18 && p.z < 1, facing };
  }

  /* ------------------------------------------------------------ loop */
  private frame = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const now = this.clock.getElapsedTime();
    this.stepInset();
    this.stepFlight(now);
    if (!this.flight) this.controls.update();
    this.stepHexes(now);
    // flags wave, lean "screen-up" like the episodes (a pole pointing at the viewer reads as nothing)
    // and turn their cloth toward the viewer
    const camLocal = new THREE.Vector3();
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const camDir = this.camera.position.clone().normalize();
    const lean = new THREE.Vector3();
    for (const f of this.flags.values()) {
      f.mat.uniforms.uTime.value = now + f.code.charCodeAt(0) * 0.37;
      const n = f.normal;
      const toward = Math.max(0, n.dot(camDir)); // 1 when the pole points straight at us
      lean.copy(n).addScaledVector(camUp, 0.35 + toward * 1.1).normalize();
      f.group.quaternion.setFromUnitVectors(UP, lean);
      camLocal.copy(this.camera.position);
      f.group.worldToLocal(camLocal);
      f.holder.rotation.y = Math.atan2(camLocal.x, camLocal.z) - 0.45;
    }
    this.renderer.render(this.scene, this.camera);
    this.opts.onFrame?.();
  };

  start() { if (this.running) return; this.running = true; this.frame(); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  dispose() {
    this.stop();
    this.disposers.forEach((d) => d());
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    for (const f of this.flags.values()) f.tex?.dispose();
    this.renderer.dispose();
  }
}
