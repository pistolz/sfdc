import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Bee } from "./bee";
import type { GameState } from "./types";

/* Shaft geometry (world units). Level n's ledge top sits at y = n * SPACING; the floor is level 0. */
export const SPACING = 2.4;
const INNER = 2.75; // inner wall faces at x = ±INNER
const WALL_W = 2.6;
const DEPTH = 5.2; // ledges / shaft core span z ∈ [-DEPTH/2, DEPTH/2]
const WALL_FRONT = 7.5; // walls extend toward the camera up to this z
const LEDGE_W = 2.1;
const LEDGE_D = 2.3;
const LEDGE_H = 0.38;
const STAND_X = INNER - 1.05; // bee x on a ledge (sign = side)

export const sideOf = (n: number) => (n % 2 === 1 ? -1 : 1); // odd levels on the left wall
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export interface Projected { x: number; y: number; visible: boolean; side: number }
interface Opts { reducedMotion: boolean; onPick: (level: number | null) => void; onFrame: () => void; onArrive?: (level: number) => void }

function honeycombTexture(): THREE.CanvasTexture {
  const r = 30, w = Math.sqrt(3) * r; // pointy-top hexes
  const cols = 4, rows = 4;
  const W = Math.round(w * cols), H = Math.round(1.5 * r * rows);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c98618";
  g.fillRect(0, 0, W, H);
  for (let j = -1; j <= rows; j++) for (let i = -1; i <= cols; i++) {
    const cx = i * w + (j % 2 ? w / 2 : 0), cy = j * 1.5 * r;
    const grad = g.createLinearGradient(cx, cy - r, cx, cy + r);
    grad.addColorStop(0, "#ffe07a"); grad.addColorStop(0.55, "#f6bf3b"); grad.addColorStop(1, "#e8a21f");
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(cx + Math.cos(a) * (r - 3.5), cy + Math.sin(a) * (r - 3.5)); }
    g.closePath();
    g.fillStyle = grad; g.fill();
    g.strokeStyle = "rgba(255,246,200,0.55)"; g.lineWidth = 2; g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function starTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.translate(32, 32);
  g.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 11 : 28; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath();
  g.fillStyle = "#fff3a6"; g.shadowColor = "#ffd23f"; g.shadowBlur = 8; g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Shaft {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
  private bee = new Bee();
  private hex = honeycombTexture();
  private wallGroup = new THREE.Group();
  private ledges!: THREE.InstancedMesh;
  private trims!: THREE.InstancedMesh;
  private coins!: THREE.InstancedMesh;
  private coinLevels: number[] = [];
  private ghost = new THREE.Group();
  private glow: THREE.Mesh;
  private beam: THREE.Mesh;
  private stars: { s: THREE.Sprite; v: THREE.Vector3; life: number }[] = [];
  private starTex = starTexture();
  private raf = 0;
  private clock = new THREE.Clock();
  private t = 0;
  private top = 0;
  private dpr = 1;
  private size = new THREE.Vector2();
  private inset = { right: 0, bottom: 0 };

  /** Camera rig: looks at (lookX, camY), from distance `dist`. */
  private camY = SPACING;
  private dist = 13;
  private lookX = 0;
  private baseDist = 13;
  private vel = 0;
  private tween: null | { from: { y: number; d: number; x: number }; to: { y: number; d: number; x: number }; t: number; dur: number; pull: number; done?: () => void } = null;
  private beeTween: null | { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; level: number } = null;
  private beeLevel = 0;
  private focused: number | null = null;
  private drag: { y: number; t: number; moved: number; id: number } | null = null;

  constructor(private canvas: HTMLCanvasElement, private opts: Opts) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
    // light: warm sun + sky fill
    this.scene.add(new THREE.HemisphereLight(0xdff3ff, 0xf3c46a, 1.25));
    const sun = new THREE.DirectionalLight(0xfff1d0, 2.1);
    sun.position.set(4, 9, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
    sun.shadow.bias = -0.0008;
    this.sun = sun;
    this.scene.add(sun, sun.target);
    const rim = new THREE.DirectionalLight(0xbfe6ff, 0.6);
    rim.position.set(-5, 3, -6);
    this.scene.add(rim);

    this.scene.add(this.wallGroup);
    this.bee.root.scale.setScalar(0.84);
    this.scene.add(this.bee.root);

    // selection glow (hex ring on the ledge) + soft light beam
    const ringShape = new THREE.Shape();
    const hexPts = (rr: number) => Array.from({ length: 6 }, (_, k) => new THREE.Vector2(Math.cos((k * Math.PI) / 3) * rr, Math.sin((k * Math.PI) / 3) * rr));
    ringShape.setFromPoints(hexPts(1.02));
    ringShape.holes.push(new THREE.Path(hexPts(0.82).reverse()));
    this.glow = new THREE.Mesh(new THREE.ShapeGeometry(ringShape), new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.visible = false;
    this.scene.add(this.glow);
    const beamGeo = new THREE.CylinderGeometry(0.75, 1.05, 4.2, 6, 1, true);
    beamGeo.translate(0, 2.1, 0);
    this.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xfff5b0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.visible = false;
    this.scene.add(this.beam);

    this.buildFloor();
    this.bindInput();
    this.resize();
    addEventListener("resize", () => this.resize());
  }
  private sun: THREE.DirectionalLight;

  /* ------------------------------------------------------------ world */
  private buildFloor() {
    const sand = new THREE.Mesh(new THREE.BoxGeometry(INNER * 2 + WALL_W * 2 + 8, 1, DEPTH + 10), new THREE.MeshStandardMaterial({ color: 0xf1c46b, roughness: 0.95 }));
    sand.position.set(0, -0.5, 0);
    sand.receiveShadow = true;
    this.scene.add(sand);
    // the noob's dropped skateboard
    const board = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 6, 16), new THREE.MeshStandardMaterial({ color: 0x4a5482, roughness: 0.5 }));
    deck.rotation.z = Math.PI / 2;
    deck.scale.set(0.35, 1, 1);
    board.add(deck);
    for (const x of [-0.42, 0.42]) for (const z of [-0.14, 0.14]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 14), new THREE.MeshStandardMaterial({ color: x > 0 && z > 0 ? 0xff4f6b : 0x3a3f5c }));
      w.rotation.x = Math.PI / 2;
      w.position.set(x, -0.1, z);
      board.add(w);
    }
    board.position.set(1.3, 0.17, 1.0);
    board.rotation.set(0, -0.5, 0.08);
    board.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    this.scene.add(board);
  }

  private buildWorld() {
    // dispose previous
    this.wallGroup.clear();
    for (const m of [this.ledges, this.trims, this.coins]) if (m) { this.scene.remove(m); m.geometry.dispose(); m.dispose(); }
    const H = (this.top + 3.2) * SPACING;
    const wallMat = (repX: number, repY: number) => {
      const t = this.hex.clone();
      t.needsUpdate = true;
      t.repeat.set(repX, repY);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.05 });
    };
    for (const side of [-1, 1]) {
      const WD = WALL_FRONT + DEPTH / 2;
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(WD, H), wallMat(WD / 2.2, H / 2.2));
      inner.position.set(side * INNER, H / 2, (WALL_FRONT - DEPTH / 2) / 2);
      inner.rotation.y = -side * Math.PI / 2;
      inner.receiveShadow = true;
      const front = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, H), wallMat(WALL_W / 2.2, H / 2.2));
      front.position.set(side * (INNER + WALL_W / 2), H / 2, WALL_FRONT);
      const back = new THREE.Mesh(new THREE.BoxGeometry(WALL_W, H, WD), new THREE.MeshStandardMaterial({ color: 0xd9971f, roughness: 0.8 }));
      back.position.set(side * (INNER + WALL_W / 2), H / 2, (WALL_FRONT - DEPTH / 2) / 2 - 0.01);
      back.scale.set(0.999, 1, 0.999);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(WALL_W + 0.35, 0.55, WD + 0.35), new THREE.MeshStandardMaterial({ color: 0x45b04a, roughness: 0.6 }));
      cap.position.set(side * (INNER + WALL_W / 2), H + 0.27, (WALL_FRONT - DEPTH / 2) / 2);
      cap.castShadow = true;
      this.wallGroup.add(back, inner, front, cap);
    }

    // ledges (instanced) — honey slab + green lip
    const n = this.top;
    const slabGeo = new THREE.BoxGeometry(LEDGE_W, LEDGE_H, LEDGE_D);
    const slabTex = this.hex.clone();
    slabTex.needsUpdate = true;
    slabTex.repeat.set(1.1, 1.1);
    this.ledges = new THREE.InstancedMesh(slabGeo, new THREE.MeshStandardMaterial({ map: slabTex, roughness: 0.5 }), Math.max(1, n));
    this.trims = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, LEDGE_H + 0.1, LEDGE_D + 0.1), new THREE.MeshStandardMaterial({ color: 0x4cb84f, roughness: 0.55 }), Math.max(1, n));
    const m = new THREE.Matrix4();
    for (let i = 1; i <= n; i++) {
      const s = sideOf(i);
      const y = i * SPACING - LEDGE_H / 2;
      m.makeTranslation(s * (INNER - LEDGE_W / 2), y, 0);
      this.ledges.setMatrixAt(i - 1, m);
      m.makeTranslation(s * (INNER - LEDGE_W) + -s * 0.06, y + 0.02, 0);
      this.trims.setMatrixAt(i - 1, m);
    }
    this.ledges.count = this.trims.count = n;
    this.ledges.castShadow = this.ledges.receiveShadow = true;
    this.trims.castShadow = true;
    this.ledges.instanceMatrix.needsUpdate = this.trims.instanceMatrix.needsUpdate = true;
    this.ledges.computeBoundingSphere();
    this.scene.add(this.ledges, this.trims);

    // spinning coins: one hovering on every 3rd ledge + a few on the floor
    this.coinLevels = [0, 0, 0];
    for (let i = 3; i <= n; i += 3) this.coinLevels.push(i);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 0.6, roughness: 0.28, emissive: 0xb07400, emissiveIntensity: 0.45 });
    const coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.07, 28);
    coinGeo.rotateX(Math.PI / 2);
    this.coins = new THREE.InstancedMesh(coinGeo, coinMat, this.coinLevels.length);
    this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.coins);

    // "next level" ghost ledge with a pulsing question mark
    this.ghost.clear();
    const g = new THREE.Mesh(slabGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false }));
    this.ghost.add(g);
    const s = sideOf(n + 1);
    this.ghost.position.set(s * (INNER - LEDGE_W / 2), (n + 1) * SPACING - LEDGE_H / 2, 0);
    this.scene.add(this.ghost);
  }

  setState(state: GameState) {
    const changed = state.levels.length !== this.top;
    this.top = state.levels.length;
    if (changed || !this.ledges) this.buildWorld();
    this.bee.setLevel(this.top);
    if (!this.beeTween && this.focused === null) this.placeBee(this.top);
  }

  /* ------------------------------------------------------------ bee */
  private standPos(level: number) {
    if (level <= 0) return new THREE.Vector3(-0.6, 0, 0.8);
    const s = sideOf(level);
    return new THREE.Vector3(s * STAND_X, level * SPACING, 0.25);
  }
  private placeBee(level: number) {
    this.beeLevel = level;
    this.bee.root.position.copy(this.standPos(level));
    this.bee.root.rotation.y = level <= 0 ? 0.25 : -sideOf(level) * 0.35;
    this.bee.setExpression(level <= 0 ? "confused" : "happy");
  }
  private flyBee(level: number, dur: number) {
    if (this.opts.reducedMotion || dur <= 0) { this.placeBee(level); this.arrive(level); return; }
    this.beeTween = { from: this.bee.root.position.clone(), to: this.standPos(level), t: 0, dur, level };
    this.bee.setFlying(true);
    this.bee.setExpression("determined");
  }
  private arrive(level: number) {
    this.beeLevel = level;
    this.bee.setFlying(false);
    this.bee.root.rotation.y = level <= 0 ? 0.25 : -sideOf(level) * 0.35;
    if (level > 0) { this.bee.celebrate(); this.burst(this.standPos(level).add(new THREE.Vector3(0, 1.4, 0))); }
    else this.bee.setExpression("confused");
    this.opts.onArrive?.(level);
  }
  private burst(at: THREE.Vector3) {
    if (this.opts.reducedMotion) return;
    for (let k = 0; k < 16; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.starTex, transparent: true, depthWrite: false }));
      s.position.copy(at);
      s.scale.setScalar(0.35 + Math.random() * 0.25);
      const a = (k / 16) * Math.PI * 2;
      this.stars.push({ s, v: new THREE.Vector3(Math.cos(a) * 2.6, 2.2 + Math.random() * 2.4, Math.sin(a) * 1.4 + 0.8), life: 1 });
      this.scene.add(s);
    }
  }

  /* ------------------------------------------------------------ camera */
  private levelView(level: number, close: boolean) {
    const y = level * SPACING + (close ? 1.15 : 1.0);
    const x = level > 0 && close ? sideOf(level) * 0.7 : 0;
    return { y, d: close ? this.baseDist * (this.size.x < 760 ? 0.8 : 0.62) : this.baseDist, x };
  }
  private clampY(y: number) { return Math.min(Math.max(y, 1.2), (this.top + 1.6) * SPACING); }

  /** Cinematic: pull back, fly along the shaft, zoom in on the level; the bee zips there too. */
  focusLevel(level: number, opts: { instant?: boolean; moveBee?: boolean } = {}) {
    this.focused = level;
    const to = this.levelView(level, true);
    const distLevels = Math.abs(this.camY - to.y) / SPACING;
    const dur = this.opts.reducedMotion || opts.instant ? 0 : Math.min(3.2, 0.9 + Math.sqrt(distLevels) * 0.22);
    this.startTween(to, dur, Math.min(9, 2 + distLevels * 0.06));
    if (opts.moveBee !== false && level !== this.beeLevel) this.flyBee(level, dur * 0.92);
    else if (opts.moveBee !== false && dur === 0) this.arrive(level);
    else if (dur > 0) setTimeout(() => this.bee.celebrate(), dur * 1000);
    this.showGlow(level);
  }
  /** Back to the bee's home: the latest level. */
  focusTop(opts: { instant?: boolean } = {}) {
    this.focused = null;
    this.glow.visible = this.beam.visible = false;
    const to = this.levelView(this.top, false);
    const d = Math.abs(this.camY - to.y) / SPACING;
    const dur = this.opts.reducedMotion || opts.instant ? 0 : Math.min(2.8, 0.8 + Math.sqrt(d) * 0.2);
    this.startTween(to, dur, 2);
    if (this.beeLevel !== this.top) this.flyBee(this.top, dur * 0.9);
  }
  /** Opening shot: start on the noob at the bottom, then climb the whole shaft to today's level. */
  intro() {
    this.placeBee(0);
    this.camY = 1.6; this.dist = this.baseDist * 0.75; this.lookX = 0;
    if (this.opts.reducedMotion) { this.placeBee(this.top); this.focusTop({ instant: true }); return; }
    setTimeout(() => {
      const to = this.levelView(this.top, false);
      const dur = Math.min(4.2, 1.6 + Math.sqrt(this.top) * 0.16);
      this.startTween(to, dur, 3);
      this.flyBee(this.top, dur * 0.95);
    }, 900);
  }
  /** Scroll the camera only (ruler, wheel). */
  scrollToLevel(level: number, instant = false) {
    const to = { ...this.levelView(level, false), d: this.dist, x: this.lookX };
    this.startTween(to, instant || this.opts.reducedMotion ? 0 : 0.6, 0);
  }
  private startTween(to: { y: number; d: number; x: number }, dur: number, pull: number) {
    to.y = this.clampY(to.y);
    if (dur <= 0) { this.camY = to.y; this.dist = to.d; this.lookX = to.x; this.tween = null; return; }
    this.vel = 0;
    this.tween = { from: { y: this.camY, d: this.dist, x: this.lookX }, to, t: 0, dur, pull };
  }
  private showGlow(level: number) {
    if (level <= 0) { this.glow.visible = this.beam.visible = false; return; }
    const s = sideOf(level);
    this.glow.position.set(s * (INNER - LEDGE_W / 2), level * SPACING + 0.02, 0);
    this.beam.position.set(s * (INNER - LEDGE_W / 2), level * SPACING, 0);
    this.glow.visible = this.beam.visible = true;
  }
  clearFocus() { this.focused = null; this.glow.visible = this.beam.visible = false; this.startTween({ y: this.camY, d: this.baseDist, x: 0 }, this.opts.reducedMotion ? 0 : 0.6, 0); }

  setInset(right: number, bottom: number) { this.inset = { right, bottom }; this.applyView(); }

  /** Level currently centred in view (for the ruler). */
  get cameraLevel() { return Math.max(0, Math.min(this.top, (this.camY - 1) / SPACING)); }
  get topLevel() { return this.top; }

  project(level: number): Projected | null {
    if (level < 0 || level > this.top + 1) return null;
    const s = level <= 0 ? -1 : sideOf(level);
    const p = level <= 0 ? new THREE.Vector3(0.2, 1.9, 0.6) : new THREE.Vector3(s * (INNER - LEDGE_W - 0.05), level * SPACING + 1.55, LEDGE_D / 2 - 0.3);
    const v = p.project(this.camera);
    const W = this.size.x, H = this.size.y;
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, visible: v.z < 1 && v.y > -1.3 && v.y < 1.3, side: s };
  }
  visibleRange(): [number, number] {
    const half = Math.tan((this.camera.fov * Math.PI) / 360) * this.dist;
    const lo = Math.floor((this.camY - half - 2) / SPACING), hi = Math.ceil((this.camY + half) / SPACING);
    return [Math.max(0, lo), Math.min(this.top + 1, hi)];
  }

  /* ------------------------------------------------------------ input */
  private bindInput() {
    const c = this.canvas;
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.tween = null;
      const k = e.deltaMode === 1 ? 0.45 : 0.012;
      this.camY = this.clampY(this.camY - e.deltaY * k);
      this.vel = 0;
    }, { passive: false });
    c.addEventListener("pointerdown", (e) => {
      this.drag = { y: e.clientY, t: performance.now(), moved: 0, id: e.pointerId };
      this.vel = 0;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener("pointermove", (e) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      const dy = e.clientY - this.drag.y;
      this.drag.y = e.clientY;
      this.drag.moved += Math.abs(dy);
      if (this.drag.moved > 6) this.tween = null;
      const unitsPerPx = (2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.dist) / this.size.y;
      const now = performance.now();
      const dt = Math.max(1, now - this.drag.t) / 1000;
      this.drag.t = now;
      this.camY = this.clampY(this.camY + dy * unitsPerPx);
      this.vel = (dy * unitsPerPx) / dt;
    });
    const up = (e: PointerEvent) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      const tap = this.drag.moved < 6;
      this.drag = null;
      if (tap) { this.vel = 0; this.pick(e); }
    };
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
  }
  private pick(e: PointerEvent) {
    if (!this.ledges) return;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hitBee = ray.intersectObject(this.bee.root, true)[0];
    if (hitBee) { this.bee.celebrate(); this.opts.onPick(this.beeLevel || null); return; }
    const hit = ray.intersectObject(this.ledges)[0];
    this.opts.onPick(hit && hit.instanceId !== undefined ? hit.instanceId + 1 : null);
  }

  /* ------------------------------------------------------------ loop */
  private resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.size.set(w, h);
    this.camera.aspect = w / h;
    // fit the shaft width on portrait screens, keep ~5 levels visible on landscape
    const hfov = 2 * Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect);
    const fit = (INNER + 0.25) / Math.tan(hfov / 2);
    const prev = this.baseDist;
    this.baseDist = Math.min(16, Math.max(11, fit));
    this.dist *= this.baseDist / prev;
    this.applyView();
  }
  private applyView() {
    const { x: w, y: h } = this.size;
    const { right, bottom } = this.inset;
    if (right || bottom) this.camera.setViewOffset(w, h, right / 2, bottom / 2, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  start() { if (!this.raf) { this.clock.getDelta(); this.raf = requestAnimationFrame(this.frame); } }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  private frame = () => {
    this.raf = requestAnimationFrame(this.frame);
    const raw = Math.min(0.25, this.clock.getDelta());
    const dt = Math.min(0.05, raw); // physics-ish motion; tweens use wall time so slow devices don't drag

    this.t += dt;
    const reduced = this.opts.reducedMotion;

    // camera tween / inertia
    if (this.tween) {
      const tw = this.tween;
      tw.t += raw / tw.dur;
      const k = ease(Math.min(1, tw.t));
      this.camY = tw.from.y + (tw.to.y - tw.from.y) * k;
      this.dist = tw.from.d + (tw.to.d - tw.from.d) * k + Math.sin(Math.min(1, tw.t) * Math.PI) * tw.pull;
      this.lookX = tw.from.x + (tw.to.x - tw.from.x) * k;
      if (tw.t >= 1) { this.tween = null; tw.done?.(); }
    } else if (!this.drag && Math.abs(this.vel) > 0.01) {
      this.camY = this.clampY(this.camY + this.vel * dt);
      this.vel *= Math.pow(0.04, dt);
    }
    this.camera.position.set(this.lookX * 0.55, this.camY + 1.1, this.dist);
    this.camera.lookAt(this.lookX, this.camY, 0);
    this.sun.position.set(4, this.camY + 8, 8);
    this.sun.target.position.set(0, this.camY - 1, 0);

    // bee flight along an arc that swings out of the shaft towards the camera
    if (this.beeTween) {
      const b = this.beeTween;
      b.t += raw / b.dur;
      const k = ease(Math.min(1, b.t));
      const p = b.from.clone().lerp(b.to, k);
      p.z += Math.sin(k * Math.PI) * 1.6;
      p.x *= 1 - Math.sin(k * Math.PI) * 0.7;
      this.bee.root.position.copy(p);
      this.bee.root.rotation.y = Math.sin(k * Math.PI) * 0.4 * Math.sign(b.to.x - b.from.x || 1);
      if (b.t >= 1) { this.beeTween = null; this.arrive(b.level); }
    }
    this.bee.setLevel(Math.round(this.bee.root.position.y / SPACING));
    this.bee.update(this.t, dt, reduced);

    // coins spin and bob
    if (this.coins) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      this.coinLevels.forEach((lv, i) => {
        const x = lv === 0 ? [-2.4, 0.4, 2.5][i] : sideOf(lv) * (INNER - 0.55);
        const y = lv === 0 ? 0.55 + i * 0.05 : lv * SPACING + 0.65;
        e.set(0, this.t * 2.4 + i, 0);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(x, y + (reduced ? 0 : Math.sin(this.t * 2 + i) * 0.08), lv === 0 ? -1.2 + i * 0.3 : -0.6), q, new THREE.Vector3(1, 1, 1));
        this.coins.setMatrixAt(i, m);
      });
      this.coins.instanceMatrix.needsUpdate = true;
    }
    // glow pulse
    if (this.glow.visible) {
      const p = reduced ? 0.8 : 0.6 + Math.sin(this.t * 5) * 0.35;
      (this.glow.material as THREE.MeshBasicMaterial).opacity = p;
      this.glow.scale.setScalar(1 + (reduced ? 0 : Math.sin(this.t * 5) * 0.05));
      (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.1 + p * 0.08;
    }
    (this.ghost.children[0] as THREE.Mesh | undefined)?.material && (((this.ghost.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.2 + Math.sin(this.t * 3) * 0.08);
    // stars
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const st = this.stars[i];
      st.life -= dt * 0.9;
      st.v.y -= dt * 6;
      st.s.position.addScaledVector(st.v, dt);
      st.s.material.opacity = Math.max(0, st.life);
      st.s.material.rotation += dt * 4;
      if (st.life <= 0) { this.scene.remove(st.s); st.s.material.dispose(); this.stars.splice(i, 1); }
    }

    this.renderer.render(this.scene, this.camera);
    this.opts.onFrame();
  };
}
