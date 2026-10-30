import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { GameState } from "./types";

/*
 * The stadium is an elliptical bowl around a 105×68 pitch. Each level adds a tier of 8 rows.
 * Seats are instanced; a club's stand is an angular wedge sized by its share of the current
 * structure's capacity, so the bowl visibly fills up and grows tiers as the series goes on.
 */
const A0 = 66, B0 = 48;            // inner ellipse semi-axes (m)
const ROWS = 8, DR = 1.75;         // rows per tier, row depth
const SEAT_GAP = 1.08;             // seat spacing along a row
const AISLES = 40;                 // radial aisles around the bowl
const EMPTY = new THREE.Color("#d9dee6");
const EMPTY_ALT = new THREE.Color("#c9cfd9");
const TAU = Math.PI * 2;

export interface Projected { x: number; y: number; visible: boolean }
export interface SeatRef { club: string; tier: number; row: number; seatInRow: number; pos: THREE.Vector3; inward: THREE.Vector3; instance: number }
export interface StadiumOptions { reducedMotion: boolean; onPick?: (pick: { club: string; handle?: string } | null) => void; onFrame?: () => void }

interface Row { tier: number; row: number; s: number; y: number; a: number; b: number }
interface SeatInfo { u: number; tier: number; row: number; x: number; y: number; z: number; rot: number; inX: number; inZ: number; idxInRow: number }

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rand = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function tierLayout(tiers: number) {
  const rows: Row[] = [];
  const tierInfo: { s0: number; s1: number; y0: number; y1: number }[] = [];
  let s = 0, y = 1.3;
  for (let t = 0; t < tiers; t++) {
    const dy = 0.78 + t * 0.16; // upper tiers are steeper
    const s0 = s, y0 = y;
    for (let r = 0; r < ROWS; r++) { rows.push({ tier: t, row: r, s, y, a: A0 + s, b: B0 + s }); s += DR; y += dy; }
    tierInfo.push({ s0, s1: s - DR, y0, y1: y - dy });
    s += 3.4; y += 4.2; // concourse + fascia between tiers
  }
  return { rows, tierInfo };
}

/** Closed band between two offset ellipses, as a triangle strip-like indexed geometry. */
function ringStrip(s0: number, y0: number, s1: number, y1: number, seg = 220, uRepeat = 1): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [], uv: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * TAU, c = Math.cos(t), sn = Math.sin(t);
    pos.push((A0 + s0) * c, y0, (B0 + s0) * sn, (A0 + s1) * c, y1, (B0 + s1) * sn);
    uv.push((i / seg) * uRepeat, 0, (i / seg) * uRepeat, 1);
    if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function pitchTexture(): THREE.CanvasTexture {
  const W = 1050, H = 680, M = 40;
  const c = document.createElement("canvas");
  c.width = W + M * 2; c.height = H + M * 2;
  const x = c.getContext("2d")!;
  for (let i = 0; i < 14; i++) { x.fillStyle = i % 2 ? "#5fb847" : "#6cc552"; x.fillRect((i * c.width) / 14, 0, c.width / 14 + 1, c.height); }
  x.strokeStyle = "rgba(255,255,255,0.95)"; x.lineWidth = 6; x.translate(M, M);
  x.strokeRect(0, 0, W, H);
  x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.stroke();
  x.beginPath(); x.arc(W / 2, H / 2, 91.5, 0, TAU); x.stroke();
  x.fillStyle = "#fff"; x.beginPath(); x.arc(W / 2, H / 2, 6, 0, TAU); x.fill();
  for (const side of [0, 1]) {
    const sx = side ? W : 0, dir = side ? -1 : 1;
    x.strokeRect(side ? W - 165 : 0, H / 2 - 201.5, 165, 403);
    x.strokeRect(side ? W - 55 : 0, H / 2 - 91.5, 55, 183);
    x.beginPath(); x.arc(sx + dir * 110, H / 2, 6, 0, TAU); x.fill();
    x.beginPath(); x.arc(sx + dir * 110, H / 2, 91.5, side ? Math.PI - 0.93 : -0.93, side ? Math.PI + 0.93 : 0.93); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Outer facade: light concrete panels, pillars, a navy crown band with a gold LED line. */
function facadeTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#f4f6f9"); g.addColorStop(1, "#cfd5de");
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.fillStyle = "#1d2654"; x.fillRect(0, 0, 256, 46);
  x.fillStyle = "#ffc93c"; x.fillRect(0, 46, 256, 7);
  x.fillStyle = "rgba(29,38,84,0.18)";
  for (let i = 0; i < 2; i++) x.fillRect(i * 128 + 60, 53, 8, 203);
  x.fillStyle = "rgba(29,38,84,0.35)";
  for (let i = 0; i < 4; i++) for (let r = 0; r < 3; r++) x.fillRect(i * 64 + 14, 84 + r * 56, 22, 28);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function luminance(hex: string) { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }

function bannerTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 160;
  const x = c.getContext("2d")!;
  x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = fg; x.fillRect(0, c.height - 14, c.width, 14); x.fillRect(0, 0, c.width, 8);
  let size = 92;
  x.font = `800 ${size}px "Unbounded Variable", "Unbounded", "Arial Black", sans-serif`;
  while (x.measureText(text).width > c.width - 80 && size > 30) { size -= 4; x.font = `800 ${size}px "Unbounded Variable", "Unbounded", "Arial Black", sans-serif`; }
  x.fillStyle = luminance(bg) > 0.6 ? "#151a3a" : "#ffffff";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Stadium {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2500);
  readonly controls: OrbitControls;
  private opts: StadiumOptions;
  private dynamic = new THREE.Group();   // rebuilt when the level / clubs change
  private seatMesh: THREE.InstancedMesh | null = null;
  private seats: SeatInfo[] = [];
  private seatClub: (string | null)[] = [];
  private clubSeats = new Map<string, number[]>();     // club → instance ids, best seat first
  private seatOwner = new Map<number, string>();       // instance → handle
  private clubAnchor = new Map<string, { pos: THREE.Vector3; inward: THREE.Vector3; label: THREE.Vector3 }>();
  private state: GameState | null = null;
  private tiers = 1;
  private outerS = 0;
  private topY = 0;
  private running = false;
  private clock = new THREE.Clock();
  private flight: { p0: THREE.Vector3; p1: THREE.Vector3; p2: THREE.Vector3; p3: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; start: number; dur: number; done?: () => void } | null = null;
  private intro: { start: number; dur: number } | null = null;
  private highlight: THREE.Group;
  private highlightSeat: THREE.Mesh;
  private beam: THREE.Mesh;
  private ring: THREE.Mesh;
  private highlightAt: number | null = null;
  private idleSince = performance.now();
  private down: { x: number; y: number; t: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private seatGeo: THREE.BufferGeometry;
  private static = new THREE.Group();
  private inset = { right: 0, bottom: 0, top: 0 };

  constructor(private canvas: HTMLCanvasElement, opts: StadiumOptions) {
    this.opts = opts;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.fog = new THREE.Fog("#cfe9f7", 520, 1300);

    this.scene.add(new THREE.HemisphereLight("#eaf6ff", "#5f8f3a", 1.6));
    const sun = new THREE.DirectionalLight("#fff4e0", 2.1);
    sun.position.set(-160, 260, 120);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight("#cfe1ff", 0.55);
    fill.position.set(200, 120, -180);
    this.scene.add(fill);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 14;
    this.controls.maxDistance = 520;
    this.controls.maxPolarAngle = 1.42;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.autoRotate = !opts.reducedMotion;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.addEventListener("start", () => { this.flight = null; this.idleSince = Infinity; this.controls.autoRotate = false; });
    this.controls.addEventListener("end", () => { this.idleSince = performance.now(); });

    // seat: base + back, facing +z
    const base = new THREE.BoxGeometry(0.96, 0.2, 0.86).translate(0, 0.36, 0.04);
    const back = new THREE.BoxGeometry(0.96, 0.82, 0.16).translate(0, 0.72, -0.38);
    const leg = new THREE.BoxGeometry(0.6, 0.3, 0.5).translate(0, 0.14, 0);
    this.seatGeo = mergeGeometries([base, back, leg])!;

    this.buildStatic();
    this.scene.add(this.static, this.dynamic);

    // highlight (seat glow + light beam + ground ring)
    this.highlight = new THREE.Group();
    this.highlightSeat = new THREE.Mesh(this.seatGeo, new THREE.MeshStandardMaterial({ color: "#ffd84a", emissive: "#ffb000", emissiveIntensity: 1.4, roughness: 0.4 }));
    this.highlightSeat.scale.setScalar(1.35);
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.9, 40, 24, 1, true).translate(0, 20, 0),
      new THREE.MeshBasicMaterial({ color: "#ffe27a", transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.25, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: "#ffd84a", transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.ring.position.y = 0.12;
    this.highlight.add(this.highlightSeat, this.beam, this.ring);
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this.camera.position.set(0, 150, 235);
    this.controls.target.set(0, 4, -12);

    const onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const onUp = (e: PointerEvent) => {
      const d = this.down; this.down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 450) return;
      this.pick(e.clientX, e.clientY);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    addEventListener("resize", () => this.resize());
    this.resize();
  }

  /* ---------------------------------------------------------------- static scenery */
  private buildStatic() {
    const g = this.static;
    // grass
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#79c257", roughness: 1 }));
    ground.position.y = -0.05;
    g.add(ground);
    const apron = new THREE.Mesh(new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#5cad45", roughness: 1 }));
    apron.scale.set(A0 + 2, 1, B0 + 2);
    apron.position.y = 0.0;
    g.add(apron);
    // pitch
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(113, 76).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95 }));
    pitch.position.y = 0.05;
    g.add(pitch);
    // goals
    const postMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 });
    for (const side of [-1, 1]) {
      const goal = new THREE.Group();
      const p = new THREE.CylinderGeometry(0.12, 0.12, 2.44, 8);
      const l = new THREE.Mesh(p, postMat); l.position.set(0, 1.22, -3.66);
      const r = new THREE.Mesh(p, postMat); r.position.set(0, 1.22, 3.66);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7.32, 8).rotateX(Math.PI / 2), postMat); bar.position.set(0, 2.44, 0);
      const net = new THREE.Mesh(new THREE.BoxGeometry(2, 2.44, 7.32), new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.28, roughness: 1 }));
      net.position.set(side * 1, 1.22, 0);
      goal.add(l, r, bar, net);
      goal.position.x = side * 52.5;
      g.add(goal);
    }
  }

  /* ---------------------------------------------------------------- dynamic build from state */
  setState(state: GameState) {
    this.state = state;
    this.tiers = Math.max(1, Math.min(5, state.totals.level));
    this.disposeDynamic();
    this.buildBowl(state);
    if (!this.opts.reducedMotion) this.intro = { start: performance.now(), dur: 1800 };
  }

  private disposeDynamic() {
    this.dynamic.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && m.geometry !== this.seatGeo) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      for (const mm of Array.isArray(mat) ? mat : mat ? [mat] : []) { (mm as THREE.MeshStandardMaterial).map?.dispose(); mm.dispose(); }
    });
    this.dynamic.clear();
    this.seatMesh = null;
  }

  private capacity(state: GameState) {
    const t = state.totals;
    return Math.max(t.seats, t.nextLevelSeats ?? t.goal, 1);
  }

  private buildBowl(state: GameState) {
    const { rows, tierInfo } = tierLayout(this.tiers);
    const last = tierInfo[tierInfo.length - 1];
    this.outerS = last.s1 + 1.2;
    this.topY = last.y1;

    /* concrete ------------------------------------------------------------ */
    const concrete = new THREE.MeshStandardMaterial({ color: "#eef0f3", roughness: 0.92, side: THREE.DoubleSide });
    const darker = new THREE.MeshStandardMaterial({ color: "#c7ccd5", roughness: 0.95, side: THREE.DoubleSide });
    const fascia = new THREE.MeshStandardMaterial({ color: "#1d2654", roughness: 0.6, side: THREE.DoubleSide, emissive: "#0b1030" });
    const gold = new THREE.MeshStandardMaterial({ color: "#ffc93c", emissive: "#a86b00", emissiveIntensity: 0.6, roughness: 0.4, side: THREE.DoubleSide });
    const parts: [THREE.BufferGeometry, THREE.Material][] = [];
    // pitch-side wall
    parts.push([ringStrip(-1.4, 0, -1.4, 1.1), fascia]);
    parts.push([ringStrip(-1.4, 1.1, -0.9, 1.1), gold]);
    tierInfo.forEach((ti, t) => {
      parts.push([ringStrip(ti.s0 - 0.9, ti.y0 - 0.3, ti.s1 + 1.0, ti.y1 + 0.05), concrete]);  // terrace slope
      if (t > 0) {
        const prev = tierInfo[t - 1];
        parts.push([ringStrip(prev.s1 + 1.0, prev.y1 + 0.05, ti.s0 - 1.0, prev.y1 + 0.05), darker]); // concourse
        parts.push([ringStrip(ti.s0 - 1.0, prev.y1 + 0.05, ti.s0 - 0.9, ti.y0 - 0.3), fascia]);       // fascia
        parts.push([ringStrip(ti.s0 - 1.05, ti.y0 - 0.65, ti.s0 - 1.05, ti.y0 - 0.45), gold]);       // LED ribbon
      }
    });
    // back wall + outer facade down to the ground
    parts.push([ringStrip(this.outerS, last.y1 + 0.05, this.outerS, last.y1 + 8.4), concrete]);
    const facadeMat = new THREE.MeshStandardMaterial({ map: facadeTexture(), roughness: 0.85, side: THREE.DoubleSide });
    parts.push([ringStrip(this.outerS + 0.3, 0, this.outerS + 0.3, last.y1 + 8.4, 360, 40), facadeMat]);
    parts.push([ringStrip(this.outerS, last.y1 + 8.4, this.outerS + 0.3, last.y1 + 8.4), concrete]);
    // roof ring from the third tier on
    if (this.tiers >= 3) {
      const roofY = last.y1 + 13;
      const roofIn = this.outerS - 7 - this.tiers * 1.5;
      const roofMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
      parts.push([ringStrip(roofIn, roofY - 1.2, this.outerS + 1.5, roofY), roofMat]);
      parts.push([ringStrip(roofIn, roofY - 1.2, roofIn, roofY - 2.4), fascia]);
      // supports
      const sup = new THREE.CylinderGeometry(0.5, 0.5, roofY - last.y1, 6);
      const supMat = new THREE.MeshStandardMaterial({ color: "#dfe3ea", roughness: 0.6 });
      const n = 28;
      const inst = new THREE.InstancedMesh(sup, supMat, n);
      const m = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        const t = (i / n) * TAU;
        m.makeTranslation((A0 + this.outerS) * Math.cos(t), last.y1 + (roofY - last.y1) / 2, (B0 + this.outerS) * Math.sin(t));
        inst.setMatrixAt(i, m);
      }
      this.dynamic.add(inst);
    }
    for (const [geo, mat] of parts) this.dynamic.add(new THREE.Mesh(geo, mat));

    /* seats ---------------------------------------------------------------- */
    const cap = this.capacity(state);
    const fill = Math.min(1, state.totals.seats / cap);
    const clubs = state.leaderboard;
    // biggest club in the middle of the far stand, then alternate left / right
    const arranged: typeof clubs = [];
    clubs.forEach((c, i) => (i % 2 ? arranged.push(c) : arranged.unshift(c)));
    const ranges: { id: string; u0: number; u1: number }[] = [];
    let cum = 0;
    for (const c of arranged) { const w = c.seats / cap; ranges.push({ id: c.id, u0: cum, u1: cum + w }); cum += w; }
    // u = 0 sits so that the filled block is centred on the far side (z < 0, t = -π/2)
    const tStart = -Math.PI / 2 - Math.PI * fill;

    this.seats = [];
    this.seatClub = [];
    for (const r of rows) {
      const per = Math.PI * (3 * (r.a + r.b) - Math.sqrt((3 * r.a + r.b) * (r.a + 3 * r.b)));
      const n = Math.floor(per / SEAT_GAP);
      // arc-length table for even spacing
      const K = 720, cumArc = new Float32Array(K + 1);
      for (let k = 1; k <= K; k++) {
        const t0 = tStart + ((k - 1) / K) * TAU, t1 = tStart + (k / K) * TAU;
        cumArc[k] = cumArc[k - 1] + Math.hypot(r.a * (Math.cos(t1) - Math.cos(t0)), r.b * (Math.sin(t1) - Math.sin(t0)));
      }
      const total = cumArc[K];
      let k = 0, idxInRow = 0;
      for (let i = 0; i < n; i++) {
        const target = ((i + 0.5) / n) * total;
        while (k < K && cumArc[k + 1] < target) k++;
        const f = (target - cumArc[k]) / Math.max(1e-6, cumArc[k + 1] - cumArc[k]);
        const u = (k + f) / K;
        const ua = (u * AISLES) % 1;
        if (ua < 0.9 / (total / AISLES) || ua > 1 - 0.9 / (total / AISLES)) continue; // aisle
        const t = tStart + u * TAU;
        const x = r.a * Math.cos(t), z = r.b * Math.sin(t);
        let inX = -Math.cos(t) / r.a, inZ = -Math.sin(t) / r.b;
        const l = Math.hypot(inX, inZ); inX /= l; inZ /= l;
        this.seats.push({ u, tier: r.tier, row: r.tier * ROWS + r.row, x, y: r.y, z, rot: Math.atan2(inX, inZ), inX, inZ, idxInRow: idxInRow++ });
        let club: string | null = null;
        if (u < fill) for (const rg of ranges) if (u >= rg.u0 && u < rg.u1) { club = rg.id; break; }
        this.seatClub.push(club);
      }
    }

    const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });
    const mesh = new THREE.InstancedMesh(this.seatGeo, mat, this.seats.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const colorOf = new Map(clubs.map((c) => [c.id, c.colors.map((h) => new THREE.Color(h)) as [THREE.Color, THREE.Color]]));
    this.seats.forEach((s, i) => {
      e.set(0, s.rot, 0); q.setFromEuler(e); p.set(s.x, s.y, s.z);
      m4.compose(p, q, one);
      mesh.setMatrixAt(i, m4);
      const club = this.seatClub[i];
      if (club) {
        const [c1, c2] = colorOf.get(club)!;
        // vertical bands of the two club colours, like a painted stand
        const band = Math.floor(s.u * 2 * Math.PI * (A0 + 20) / 3.3) % 2;
        mesh.setColorAt(i, band ? c2 : c1);
      } else mesh.setColorAt(i, (s.row + Math.floor(s.u * 400)) % 2 ? EMPTY : EMPTY_ALT);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.seatMesh = mesh;
    this.dynamic.add(mesh);

    /* club stands: best seats first, anchors, banners ------------------------ */
    this.clubSeats.clear();
    this.clubAnchor.clear();
    this.seatOwner.clear();
    const lastTier = tierInfo.length - 1;
    for (const rg of ranges) {
      const ids: number[] = [];
      this.seatClub.forEach((c, i) => { if (c === rg.id) ids.push(i); });
      const mid = (rg.u0 + rg.u1) / 2;
      ids.sort((a, b) => this.seats[a].row - this.seats[b].row || Math.abs(this.seats[a].u - mid) - Math.abs(this.seats[b].u - mid));
      this.clubSeats.set(rg.id, ids);
      const t = tStart + mid * TAU;
      const midTier = tierInfo[Math.floor(lastTier / 2)];
      const sMid = (midTier.s0 + midTier.s1) / 2, yMid = (midTier.y0 + midTier.y1) / 2;
      const inward = new THREE.Vector3(-Math.cos(t) / (A0 + sMid), 0, -Math.sin(t) / (B0 + sMid)).normalize();
      this.clubAnchor.set(rg.id, {
        pos: new THREE.Vector3((A0 + sMid) * Math.cos(t), yMid, (B0 + sMid) * Math.sin(t)),
        inward,
        label: new THREE.Vector3((A0 + sMid) * Math.cos(t), yMid + 3, (B0 + sMid) * Math.sin(t)),
      });
    }
    // seat owners: fan k of a club sits at best-seat index k*3 (spaced so names never stack)
    for (const [h, u] of Object.entries(state.handles)) {
      for (const [club, f] of Object.entries(u.clubs)) {
        const ids = this.clubSeats.get(club);
        if (!ids?.length) continue;
        const inst = ids[(f.fan * 3) % ids.length];
        if (!this.seatOwner.has(inst)) this.seatOwner.set(inst, h);
      }
    }

    // banners on the back wall of each stand wide enough to carry a name
    const bannerY = this.topY + 2.6;
    for (const rg of ranges.slice().sort((a, b) => (b.u1 - b.u0) - (a.u1 - a.u0)).slice(0, 26)) {
      const c = state.clubs[rg.id];
      const arcLen = (rg.u1 - rg.u0) * TAU * ((A0 + B0) / 2 + this.outerS);
      if (!c || arcLen < 9) continue;
      const w = Math.min(arcLen * 0.86, 52), h = Math.max(2.6, Math.min(5.6, w / 5.6));
      const t = tStart + ((rg.u0 + rg.u1) / 2) * TAU;
      const pos = new THREE.Vector3((A0 + this.outerS - 0.2) * Math.cos(t), bannerY + h / 2, (B0 + this.outerS - 0.2) * Math.sin(t));
      const tex = bannerTexture(c.banner, c.colors[0], c.colors[1]);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.35 }));
      plane.position.copy(pos);
      plane.lookAt(pos.x * 0.2, pos.y, pos.z * 0.2);
      this.dynamic.add(plane);
    }

    this.buildSurroundings();
  }

  private buildSurroundings() {
    const R = (A0 + this.outerS), Rz = (B0 + this.outerS);
    // floodlights
    const mastMat = new THREE.MeshStandardMaterial({ color: "#c5cad4", roughness: 0.5, metalness: 0.3 });
    const lampMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff6c8", emissiveIntensity: 1.6 });
    const H = this.topY + 34;
    for (const a of [0.62, Math.PI - 0.62, Math.PI + 0.62, -0.62]) {
      const x = (R + 14) * Math.cos(a), z = (Rz + 14) * Math.sin(a);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.2, H, 8).translate(0, H / 2, 0), mastMat);
      mast.position.set(x, 0, z);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(9, 5.5, 1.2), lampMat);
      lamp.position.set(x, H + 2, z);
      lamp.lookAt(0, 0, 0);
      this.dynamic.add(mast, lamp);
    }
    // little houses + trees around the ground
    const n = 46;
    const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 }), n);
    const roof = new THREE.InstancedMesh(new THREE.ConeGeometry(0.85, 0.8, 4).rotateY(Math.PI / 4).translate(0, 1.4, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
    const roofCols = ["#e4573d", "#3d7be4", "#e4a23d", "#8a5a44", "#5b6b8c"].map((c) => new THREE.Color(c));
    const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(2.4, 7, 7).translate(0, 4.6, 0), new THREE.MeshStandardMaterial({ color: "#3f9a46", roughness: 1 }), 60);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = rand(i) * TAU, d = 1.35 + rand(i + 99) * 1.1;
      p.set(R * d * Math.cos(a), 0, Rz * d * Math.sin(a) * 1.25);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(i + 7) * TAU);
      const k = 7 + rand(i + 3) * 6;
      s.set(k * (1 + rand(i + 5) * 0.6), k * 0.8, k);
      m.compose(p, q, s); wall.setMatrixAt(i, m); roof.setMatrixAt(i, m);
      roof.setColorAt(i, roofCols[i % roofCols.length]);
    }
    for (let i = 0; i < 60; i++) {
      const a = rand(i + 500) * TAU, d = 1.25 + rand(i + 600) * 1.4;
      p.set(R * d * Math.cos(a), 0, Rz * d * Math.sin(a) * 1.3);
      const k = 0.8 + rand(i + 700) * 0.7;
      m.compose(p, q.identity(), s.set(k, k, k)); trees.setMatrixAt(i, m);
    }
    this.dynamic.add(wall, roof, trees);
  }

  /* ---------------------------------------------------------------- queries */
  seatOf(handle: string, club?: string): SeatRef | null {
    const u = this.state?.handles[handle];
    if (!u) return null;
    const entries = Object.entries(u.clubs);
    const pick = club ? entries.find(([c]) => c === club) : entries.sort((a, b) => b[1].comments - a[1].comments)[0];
    if (!pick) return null;
    const ids = this.clubSeats.get(pick[0]);
    if (!ids?.length) return null;
    const inst = ids[(pick[1].fan * 3) % ids.length];
    return this.seatRef(inst, pick[0]);
  }
  private seatRef(inst: number, club: string): SeatRef {
    const s = this.seats[inst];
    // seat number counted inside this club's part of the row
    const ids = this.clubSeats.get(club) ?? [];
    const sameRow = ids.filter((i) => this.seats[i].row === s.row).map((i) => this.seats[i].idxInRow).sort((a, b) => a - b);
    return {
      club, tier: s.tier, row: s.row + 1, seatInRow: sameRow.indexOf(s.idxInRow) + 1, instance: inst,
      pos: new THREE.Vector3(s.x, s.y, s.z), inward: new THREE.Vector3(s.inX, 0, s.inZ),
    };
  }
  clubLabelPos(id: string) { return this.clubAnchor.get(id)?.label ?? null; }

  project(v: THREE.Vector3): Projected {
    const p = v.clone().project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    const toCam = this.camera.position.clone().sub(v);
    const visible = p.z < 1 && p.z > -1 && Math.abs(p.x) < 1.15 && Math.abs(p.y) < 1.15 && toCam.length() < 900;
    return { x: (p.x * 0.5 + 0.5) * r.width, y: (-p.y * 0.5 + 0.5) * r.height, visible };
  }

  /* ---------------------------------------------------------------- camera moves */
  private fly(endPos: THREE.Vector3, endTarget: THREE.Vector3, opts: { instant?: boolean; high?: number; dur?: number } = {}, done?: () => void) {
    this.controls.autoRotate = false;
    this.idleSince = Infinity;
    if (opts.instant || this.opts.reducedMotion) {
      this.camera.position.copy(endPos); this.controls.target.copy(endTarget); this.controls.update();
      this.idleSince = performance.now();
      done?.();
      return;
    }
    const p0 = this.camera.position.clone();
    const high = opts.high ?? 90;
    const dir = endPos.clone().sub(endTarget).setY(0).normalize();
    const p1 = p0.clone().add(new THREE.Vector3(0, high * 0.6, 0));
    const p2 = endPos.clone().add(dir.multiplyScalar(70)).add(new THREE.Vector3(0, high, 0));
    const dist = p0.distanceTo(endPos);
    this.flight = { p0, p1, p2, p3: endPos.clone(), t0: this.controls.target.clone(), t1: endTarget.clone(), start: performance.now(), dur: opts.dur ?? Math.min(4200, 2600 + dist * 5), done };
  }

  focusSeat(ref: SeatRef, opts: { instant?: boolean } = {}) {
    const target = ref.pos.clone().add(new THREE.Vector3(0, 0.6, 0));
    const near = this.camera.aspect < 0.8 ? 1.35 : 1.75;
    const camPos = ref.pos.clone().add(ref.inward.clone().multiplyScalar(17 * near)).add(new THREE.Vector3(0, 7 * near, 0));
    this.highlight.visible = false;
    this.fly(camPos, target, { instant: opts.instant, high: 110 }, () => this.showHighlight(ref));
  }

  focusClub(id: string, opts: { instant?: boolean } = {}) {
    const a = this.clubAnchor.get(id);
    if (!a) return;
    this.highlight.visible = false;
    const camPos = a.pos.clone().add(a.inward.clone().multiplyScalar(58 + this.tiers * 6)).add(new THREE.Vector3(0, 10 + this.tiers * 3, 0));
    this.fly(camPos, a.pos.clone(), { instant: opts.instant, high: 70 });
  }

  overview(opts: { instant?: boolean } = {}) {
    this.highlight.visible = false;
    const portrait = this.camera.aspect < 0.8;
    const d = (200 + this.tiers * 26) * (portrait ? 1.42 : 1);
    this.fly(new THREE.Vector3(0, d * (portrait ? 0.8 : 0.62), d), new THREE.Vector3(0, 0, portrait ? -62 : -12), { instant: opts.instant, high: 30 }, () => { this.controls.autoRotate = !this.opts.reducedMotion; });
  }

  private showHighlight(ref: SeatRef) {
    const s = this.seats[ref.instance];
    this.highlight.position.set(s.x, s.y, s.z);
    this.highlight.rotation.set(0, s.rot, 0);
    this.highlight.visible = true;
    this.highlightAt = performance.now();
  }
  clearHighlight() { this.highlight.visible = false; this.highlightAt = null; }
  get isFlying() { return !!this.flight; }
  get highlightVisible() { return this.highlight.visible; }

  setInset(right: number, bottom: number, top = 0) {
    this.inset = { right, bottom, top };
    this.resize();
  }

  private pick(cx: number, cy: number) {
    if (!this.seatMesh) return;
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(v, this.camera);
    const hit = this.raycaster.intersectObject(this.seatMesh, false)[0];
    if (hit?.instanceId == null) return;
    const club = this.seatClub[hit.instanceId];
    if (!club) return;
    this.opts.onPick?.({ club, handle: this.seatOwner.get(hit.instanceId) });
  }

  /* ---------------------------------------------------------------- loop */
  private resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the subject centred in the visible area when a side panel / bottom sheet covers part of the canvas
    const vw = Math.max(1, w - this.inset.right), vh = Math.max(1, h - this.inset.bottom - this.inset.top);
    if (this.inset.right || this.inset.bottom || this.inset.top) this.camera.setViewOffset(w, h, this.inset.right / 2, (this.inset.bottom - this.inset.top) / 2, w, h);
    else this.camera.clearViewOffset();
    this.camera.fov = vw / vh < 0.75 ? 56 : 42;
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());
  }
  stop() { this.running = false; this.renderer.setAnimationLoop(null); }

  private frame() {
    const now = performance.now();
    if (this.flight) {
      const f = this.flight;
      const k = Math.min(1, (now - f.start) / f.dur), e = easeInOut(k);
      const a = f.p0, b = f.p1, c = f.p2, d = f.p3, mt = 1 - e;
      this.camera.position.set(
        mt ** 3 * a.x + 3 * mt * mt * e * b.x + 3 * mt * e * e * c.x + e ** 3 * d.x,
        mt ** 3 * a.y + 3 * mt * mt * e * b.y + 3 * mt * e * e * c.y + e ** 3 * d.y,
        mt ** 3 * a.z + 3 * mt * mt * e * b.z + 3 * mt * e * e * c.z + e ** 3 * d.z,
      );
      this.controls.target.lerpVectors(f.t0, f.t1, easeInOut(Math.min(1, k * 1.25)));
      this.camera.lookAt(this.controls.target);
      if (k >= 1) { this.flight = null; this.controls.update(); this.idleSince = now; f.done?.(); }
    } else {
      if (!this.opts.reducedMotion && !this.highlight.visible && now - this.idleSince > 9000) this.controls.autoRotate = true;
      this.controls.update();
    }
    if (this.intro && this.seatMesh) this.animateIntro(now);
    if (this.highlight.visible && this.highlightAt != null) {
      const t = (now - this.highlightAt) / 1000;
      const pop = Math.min(1, t * 2.5);
      const s = 1.35 + 0.18 * Math.sin(t * 5) * (this.opts.reducedMotion ? 0 : 1);
      this.highlightSeat.scale.setScalar(s * (0.4 + 0.6 * easeInOut(pop)));
      (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.22 + 0.12 * Math.sin(t * 3);
      this.beam.scale.set(1, Math.min(1, t * 1.6), 1);
      this.ring.scale.setScalar(1 + ((t * 0.9) % 1) * 1.3);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - ((t * 0.9) % 1));
    }
    this.renderer.render(this.scene, this.camera);
    this.opts.onFrame?.();
  }

  private animateIntro(now: number) {
    const mesh = this.seatMesh!, I = this.intro!;
    const k = (now - I.start) / I.dur;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i];
      // a wave sweeping out from the far stand, front rows first
      const delay = (Math.abs(s.u - 0.5) * 0.7 + s.row / 60) ;
      const v = Math.max(0, Math.min(1, (k - delay * 0.6) * 3));
      const g = v < 1 ? 1 - Math.pow(1 - v, 3) * (1 + 1.6 * v) : 1;
      e.set(0, s.rot, 0); q.setFromEuler(e); p.set(s.x, s.y - (1 - Math.min(1, v * 1.4)) * 1.5, s.z); sc.setScalar(Math.max(0.0001, g));
      m4.compose(p, q, sc);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (k > 1.8) this.intro = null;
  }

  dispose() { this.stop(); this.disposeDynamic(); this.renderer.dispose(); }
}
