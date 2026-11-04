// OVERTHINKER vs DOER — 3D silhouette loop (original format study, 100% code).
// Left: the overthinker kneels and keeps levelling ONE domino. Right: the doer lines up 15 dominoes,
// walks back, taps the last one… the chain runs all the way and knocks over the overthinker's
// perfect domino. Matte black stick figures, glossy reflective floor, seamless studio horizon.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => { k = clamp(k); return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; };
const easeIn = (k) => clamp(k) ** 2;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp2 = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];

// ------------------------------------------------------------------ stick figure (2D rig in the x-y plane, rendered in 3D)
const L = { thigh: 0.45, shin: 0.45, torso: 0.5, neck: 0.1, head: 0.14, up: 0.29, fore: 0.27 };
function ik(a, t, l1, l2, bend) {
  const dx = t[0] - a[0], dy = t[1] - a[1]; let d = Math.hypot(dx, dy); d = Math.min(d, l1 + l2 - 1e-4); d = Math.max(d, Math.abs(l1 - l2) + 1e-4);
  const ang = Math.atan2(dy, dx), cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), alpha = Math.acos(clamp(cos, -1, 1));
  const j = ang + bend * alpha; return [a[0] + Math.cos(j) * l1, a[1] + Math.sin(j) * l1];
}
class Figure {
  constructor(scene, z = 0) {
    this.z = z;
    const mat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.42, metalness: 0.05 });
    const cap = (r, len) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat); m.castShadow = true; scene.add(m); m.userData.len = len; return m; };
    const sph = (r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat); m.castShadow = true; scene.add(m); return m; };
    this.head = sph(L.head); this.pelvis = sph(0.085); this.chestB = sph(0.1);
    this.torso = cap(0.085, L.torso - 0.06); this.neck = cap(0.04, L.neck);
    this.limbs = {}; for (const s of ['L', 'R']) {
      this.limbs['up' + s] = cap(0.042, L.up); this.limbs['fore' + s] = cap(0.038, L.fore); this.limbs['hand' + s] = sph(0.05);
      this.limbs['thigh' + s] = cap(0.052, L.thigh); this.limbs['shin' + s] = cap(0.046, L.shin);
      const foot = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.07, 0.1, 3, 0.03), mat); foot.castShadow = true; scene.add(foot); this.limbs['foot' + s] = foot;
    }
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.eyes = [0, 1].map(() => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 12), eyeM); scene.add(e); return e; });
  }
  place(m, p, q, z) { // capsule from p to q (world 2D) at depth z
    const a = new THREE.Vector3(p[0], p[1], z), b = new THREE.Vector3(q[0], q[1], z);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
  /** P: { x, f (facing −1..1), hip:[u,y], lean (rad, forward), headTilt, hands:{L,R}:[u,y], feet:{L,R}:[u,y], eyes, look } — u is along the facing direction */
  set(P) {
    const f = Math.abs(P.f) < 0.08 ? Math.sign(P.f || 1) * 0.08 : P.f;
    const W = (p) => [P.x + f * p[0], p[1]];
    const hip = P.hip, lean = P.lean || 0;
    const chest = [hip[0] + Math.sin(lean) * L.torso, hip[1] + Math.cos(lean) * L.torso];
    const nl = lean * 0.6 + (P.headTilt || 0);
    const neckTop = [chest[0] + Math.sin(nl) * L.neck, chest[1] + Math.cos(nl) * L.neck];
    const headC = [neckTop[0] + Math.sin(nl) * L.head * 0.95, neckTop[1] + Math.cos(nl) * L.head * 0.95];
    const z = this.z;
    this.pelvis.position.set(...W(hip), z); this.chestB.position.set(...W(lerp2(hip, chest, 0.82)), z);
    this.place(this.torso, W(hip), W(chest), z); this.place(this.neck, W(chest), W(neckTop), z);
    this.head.position.set(...W(headC), z);
    const shoulder = lerp2(hip, chest, 0.9);
    for (const s of ['L', 'R']) {
      const dz = (s === 'R' ? 1 : -1) * 0.1 * Math.sign(f) * (Math.abs(f) * 0.7 + 0.3) + (1 - Math.abs(f)) * (s === 'R' ? 0.14 : -0.14);
      const hand = P.hands[s], foot = P.feet[s];
      const elbow = ik(shoulder, hand, L.up, L.fore, -1), hipJ = [hip[0], hip[1] - 0.02], ankle = [foot[0], foot[1] + 0.06];
      const knee = ik(hipJ, ankle, L.thigh, L.shin, 1);
      this.place(this.limbs['up' + s], W(shoulder), W(elbow), z + dz); this.place(this.limbs['fore' + s], W(elbow), W(hand), z + dz);
      this.limbs['hand' + s].position.set(...W(hand), z + dz);
      this.place(this.limbs['thigh' + s], W(hipJ), W(knee), z + dz * 0.6); this.place(this.limbs['shin' + s], W(knee), W(ankle), z + dz * 0.6);
      const fo = this.limbs['foot' + s]; fo.position.set(...W([foot[0] + 0.05, foot[1] + 0.035]), z + dz * 0.6);
      fo.rotation.set(0, (1 - Math.abs(f)) * Math.PI / 2 * Math.sign(f), P.footRot?.[s] ? -P.footRot[s] * Math.sign(f) : 0);
    }
    // eyes: on the camera side of the head, slightly towards the facing direction
    const hc = this.head.position, look = P.look ?? 0;
    const shape = { narrow: [1, 0.42], focus: [1, 0.22], wide: [1, 1.1], open: [1, 0.75] }[P.eyes || 'narrow'];
    this.eyes.forEach((e, i) => {
      const side = i ? 1 : -1, ox = f * 0.045 + side * 0.048 * (0.35 + 0.65 * (1 - Math.abs(f) * 0.5)) + look * 0.02, oy = 0.012 + (P.eyeY || 0);
      const oz = Math.sqrt(Math.max(0, L.head * L.head - ox * ox - oy * oy)) * 0.97;
      e.position.set(hc.x + ox, hc.y + oy, hc.z + oz);
      e.lookAt(hc.x + ox * 3, hc.y + oy * 3, hc.z + oz * 3);
      e.scale.set(shape[0], shape[1], 0.35);
    });
  }
}

// ------------------------------------------------------------------ scene
export async function create(stage, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(1080, 1920, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.style.background = 'linear-gradient(180deg, #1d222e 0%, #30374a 30%, #4b546a 45%, #3c4356 55%, #262b37 100%)';
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(25, 1080 / 1920, 0.1, 200);
  camera.position.set(0.25, 1.25, 13.5); camera.lookAt(0.25, 0.95, 0);

  scene.add(new THREE.HemisphereLight(0xc9d2e6, 0x1d212b, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 7, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2, near: 1, far: 20 }); key.shadow.radius = 6; key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb4ff, 1.6); rim.position.set(-4, 3, -5); scene.add(rim);

  // glossy floor: mirror + tinted veil + contact shadows
  const mirror = new Reflector(new THREE.PlaneGeometry(40, 40), { textureWidth: 1080, textureHeight: 1920, color: 0x8890a0 });
  mirror.rotation.x = -Math.PI / 2; scene.add(mirror);
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x394052, transparent: true, opacity: 0.6 }));
  veil.rotation.x = -Math.PI / 2; veil.position.y = 0.002; scene.add(veil);
  const shadowP = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.45 }));
  shadowP.rotation.x = -Math.PI / 2; shadowP.position.y = 0.004; shadowP.receiveShadow = true; scene.add(shadowP);
  // horizon fade (floor melts into the backdrop)
  const fade = new THREE.Mesh(new THREE.PlaneGeometry(200, 6), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { c: { value: new THREE.Color(0x4b546a) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 c; varying vec2 vUv; void main(){ gl_FragColor = vec4(c, smoothstep(0.0, 0.55, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y)) ); }' }));
  fade.position.set(0, 0.0, -40); scene.add(fade);

  // dominoes
  const N = 15, SP = 0.105, X0 = -0.36, DZ = 0.14;
  const dGeo = new RoundedBoxGeometry(0.045, 0.24, 0.13, 3, 0.008);
  const dMat = new THREE.MeshStandardMaterial({ color: 0xe9e0cb, roughness: 0.5 });
  const dots = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const mkDomino = () => {
    const pivot = new THREE.Group(); const m = new THREE.Mesh(dGeo, dMat); m.castShadow = true; m.position.set(0.0225, 0.12, 0); pivot.add(m);
    for (const [y, zz] of [[0.18, 0.03], [0.18, -0.03], [0.06, 0]]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), dots); d.position.set(0.0235 + 0.0225, y, zz); d.scale.set(0.3, 1, 1); pivot.add(d); }
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.0461, 0.004, 0.11), dots); line.position.set(0.0225, 0.12, 0); pivot.add(line);
    scene.add(pivot); return pivot;
  };
  const xs = Array.from({ length: N }, (_, i) => X0 + i * SP);
  const dom = xs.map(() => mkDomino());
  const perfX = X0 - SP; const perfDom = mkDomino();
  // the overthinker's level
  const level = new THREE.Group();
  const lv = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.035, 0.05, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0xd02a2a, roughness: 0.35 })); lv.castShadow = true; level.add(lv);
  const vial = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.052), new THREE.MeshStandardMaterial({ color: 0xf2d64a, emissive: 0x6a5a10, roughness: 0.2 })); level.add(vial);
  scene.add(level);

  const over = new Figure(scene, 0.02), doer = new Figure(scene, 0.0);

  // ---------------- timeline
  const D = Array.from({ length: N }, (_, j) => lerp(0.95, 0.5, j / (N - 1)));
  const T0 = 0.3; const starts = []; { let t = T0; for (const d of D) { starts.push(t); t += d; } }
  const tPlaced = starts[N - 1] + D[N - 1];
  const tWalk0 = tPlaced + 0.15, tWalk1 = tWalk0 + 1.35, tTurn1 = tWalk1 + 0.3, tPush = tTurn1 + 0.35;
  const V = 1.7; const fallT = (x) => tPush + 0.08 + (xs[N - 1] - x) / V;
  const tPerf = fallT(perfX);
  const duration = Math.max(16.5, tPerf + 2.4);

  // positions where the doer stands while placing domino i (placement order: right → left, i = N-1-j)
  const standX = (i) => xs[i] + 0.42;

  function doerPose(t) {
    // default standing
    let P = { x: standX(N - 1), f: -1, hip: [0, 0.9], lean: 0.08, hands: { L: [-0.06, 0.62], R: [0.02, 0.6] }, feet: { L: [-0.1, 0], R: [0.12, 0] }, eyes: 'narrow' };
    if (t < tPlaced) {
      let j = starts.findIndex((s, k) => t >= s && t < s + D[k]); if (j < 0) j = 0;
      const u = clamp((t - starts[j]) / D[j]), i = N - 1 - j;
      const bx = standX(i), nx = i > 0 ? standX(i - 1) : bx;
      const grab = ease(seg(u, 0, 0.28)), reach = ease(seg(u, 0.3, 0.78)), back = ease(seg(u, 0.8, 1));
      const crouch = Math.sin(Math.PI * seg(u, 0.25, 0.95));
      const x = lerp(bx, nx, back);
      const target = [x - xs[i] - 0.0, 0.14]; // local u (forward) = x - xs[i] since f = -1
      const pocket = [-0.08, 0.86];
      let hR = u < 0.3 ? lerp2([0.12, 0.65], pocket, grab) : u < 0.8 ? lerp2(pocket, [bx - xs[i], 0.14], reach) : lerp2([bx - xs[i], 0.14], [0.12, 0.65], back);
      const stepK = seg(u, 0.8, 1), lift = Math.sin(Math.PI * stepK) * 0.07;
      P = { x, f: -1, hip: [-0.04 * crouch, 0.9 - 0.3 * crouch], lean: 0.12 + 0.75 * crouch, headTilt: 0.15 * crouch,
        hands: { R: hR, L: [0.16 + 0.1 * crouch, 0.7 - 0.25 * crouch] },
        feet: { L: [-0.14 + (u > 0.8 ? 0 : 0), lift * (stepK < 0.5 ? 1 : 0)], R: [0.14, lift * (stepK >= 0.5 ? 1 : 0)] }, eyes: 'narrow' };
      P.carry = u > 0.26 && u < 0.8 ? i : -1; P.placedUpTo = u >= 0.8 ? j : j - 1; P.handWorld = hR; P.targetI = i;
      return P;
    }
    P.placedUpTo = N - 1; P.carry = -1;
    if (t < tWalk0 + 0.25) { // turn around (−1 → +1)
      const k = ease(seg(t, tPlaced, tWalk0 + 0.25)); P.x = standX(0); P.f = lerp(-1, 1, k); return P;
    }
    if (t < tWalk1) { // walk back to the right end
      const k = ease(seg(t, tWalk0 + 0.25, tWalk1)), ph = (t - tWalk0) * 7.5;
      P.x = lerp(standX(0), standX(N - 1) + 0.12, k); P.f = 1;
      const sw = Math.sin(ph) * 0.2 * Math.sin(Math.PI * k);
      P.hip = [0.02, 0.9 + Math.abs(Math.cos(ph)) * 0.025]; P.lean = 0.12;
      P.feet = { L: [sw, Math.max(0, Math.sin(ph)) * 0.08], R: [-sw, Math.max(0, -Math.sin(ph)) * 0.08] };
      P.hands = { L: [-sw * 0.9, 0.55], R: [sw * 0.9, 0.55] };
      return P;
    }
    if (t < tTurn1) { const k = ease(seg(t, tWalk1, tTurn1)); P.x = standX(N - 1) + 0.12; P.f = lerp(1, -1, k); return P; }
    // push the last domino, then stand and watch
    const k = ease(seg(t, tTurn1, tPush)), r = ease(seg(t, tPush + 0.15, tPush + 0.8));
    P.x = standX(N - 1) + 0.12; P.f = -1;
    const tip = [P.x - xs[N - 1] - 0.03, 0.23];
    P.hip = [-0.03 * (k - r), 0.9 - 0.2 * (k - r)]; P.lean = 0.12 + 0.55 * (k - r);
    P.hands = { R: lerp2(lerp2([0.12, 0.62], tip, k), [0.05, 0.62], r), L: [0.1, 0.66 - 0.08 * (k - r)] };
    const watch = ease(seg(t, tPush + 0.8, tPush + 1.4));
    if (watch > 0) { P.hands = { R: lerp2(P.hands.R, [-0.08, 0.92], watch), L: lerp2(P.hands.L, [-0.1, 0.9], watch) }; P.look = -0.4 * watch; } // hands on hips
    if (t > tPerf + 0.3) P.eyes = 'open';
    return P;
  }

  function overPose(t) {
    // kneeling, levelling the same domino forever
    const cyc = 2.4, u = (t % cyc) / cyc, lift = Math.sin(Math.PI * seg(u, 0.1, 0.45)) * 0.07, tap = Math.sin(Math.PI * seg(u, 0.6, 0.72)) * 0.012;
    const ox = -1.0;
    const domTop = perfX + 0.0225 - ox;
    let P = { x: ox, f: 1, hip: [0.02, 0.52], lean: 0.62 + Math.sin(t * 1.3) * 0.03, headTilt: 0.35 + Math.sin(u * Math.PI * 2) * 0.06,
      hands: { R: [domTop - 0.1, 0.285 + lift], L: [domTop - 0.035 - tap, 0.14] },
      feet: { L: [-0.34, 0.0], R: [0.36, 0] }, footRot: { L: 0.9 }, eyes: 'focus' };
    if (t > tPerf) { // shock: his domino falls into his hands, he leans back
      const k = ease(seg(t, tPerf + 0.05, tPerf + 0.5));
      P.lean = lerp(P.lean, 0.05, k); P.headTilt = lerp(P.headTilt, -0.1, k); P.eyes = 'wide'; P.look = 0.6 * k;
      P.hands = { R: lerp2(P.hands.R, [0.25, 0.75], k), L: lerp2(P.hands.L, [0.18, 0.7], k) };
      P.hip = [0.02 - 0.06 * k, 0.52 + 0.04 * k];
    }
    P.levelLift = lift; P.tap = tap;
    return P;
  }

  const labels = [['OVERTHINKER', new THREE.Vector3(-1.0, 1.75, 0)], ['DOER', new THREE.Vector3(1.05, 2.3, 0)]].map(([txt, v]) => {
    const el = document.createElement('div'); el.className = 'label'; el.textContent = txt; stage.appendChild(el);
    const p = v.clone().project(camera); el.style.left = `${((p.x + 1) / 2) * 1080 - txt.length * 9.5}px`; el.style.top = `${((1 - p.y) / 2) * 1920}px`; return el;
  });

  function renderFrame(t) {
    const pd = doerPose(t), po = overPose(t);
    doer.set(pd); over.set(po);
    // dominoes: placed / carried / falling
    dom.forEach((d, i) => {
      const j = N - 1 - i; // placement order index
      const placed = pd.placedUpTo >= j, carried = pd.carry === i;
      d.visible = placed || carried;
      if (carried) { // in the doer's right hand
        const hw = [pd.x + pd.f * pd.handWorld[0], pd.handWorld[1]];
        d.position.set(hw[0] - 0.0225, hw[1] - 0.06, DZ * 0.6); d.rotation.set(0, 0, 0);
      } else {
        d.position.set(xs[i] - 0.0225, 0, DZ);
        const ft = fallT(xs[i]); const k = easeIn(seg(t, ft, ft + 0.22));
        d.rotation.set(0, 0, k * 1.2); // tips over towards −x (left)
        d.position.x = xs[i] - 0.0225 + 0.045 * 0; // pivot at the left bottom edge
      }
    });
    // overthinker's perfect domino + level
    {
      const k = easeIn(seg(t, tPerf, tPerf + 0.26));
      perfDom.position.set(perfX - 0.0225, 0, DZ); perfDom.rotation.set(0, 0, po.tap * 2 + k * 1.45);
      if (t < tPerf) { level.position.set(perfX + 0.0, 0.26 + po.levelLift, DZ); level.rotation.set(0, 0, Math.sin(t * 2.6) * 0.012); }
      else { const kk = easeIn(seg(t, tPerf, tPerf + 0.35)); level.position.set(perfX + 0.06 * kk, lerp(0.26 + po.levelLift, 0.018, kk), DZ + 0.05 * kk); level.rotation.set(0, 0.2 * kk, -0.3 * kk); }
      vial.position.set(Math.sin(t * 3.1) * 0.01, 0.0, 0);
    }
    renderer.render(scene, camera);
  }
  renderFrame(0);
  return { duration, renderFrame, canvas: renderer.domElement };
}
