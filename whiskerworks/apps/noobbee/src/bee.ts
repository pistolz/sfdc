import * as THREE from "three";

export type Expression = "happy" | "determined" | "confused";

const YELLOW = 0xffd23f;
const BROWN = 0x5b3417;
const EYE = 0x3b1d0e;

/**
 * The Noob Bee, built from primitives: round glossy head, striped body, big shiny eyes,
 * blush, ball-tipped antennae, iridescent wings and stubby arms/feet.
 * Origin is at the feet; the bee is ~2.1 units tall (antennae included) and faces +Z.
 */
export class Bee {
  readonly root = new THREE.Group();
  private body = new THREE.Group(); // everything that bobs / spins
  private head = new THREE.Group();
  private eyes: THREE.Group[] = [];
  private brows: THREE.Mesh[] = [];
  private mouths: Record<Expression, THREE.Object3D>;
  private wings: { pivot: THREE.Object3D; side: number }[] = [];
  private antennae: THREE.Group[] = [];
  private accessories: { headband: THREE.Object3D; cape: THREE.Mesh; crown: THREE.Object3D };
  private expression: Expression = "happy";
  private blinkAt = 2;
  private celebrateT = -1;
  private flying = 0; // 0..1 blend
  private flyTarget = 0;
  private readonly R = 0.62; // head radius
  private readonly headCenter = new THREE.Vector3(0, 1.08, 0);

  constructor() {
    const gloss = (color: number, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
      new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.18, ...extra });
    const yellow = gloss(YELLOW, { sheen: 0.4, sheenColor: new THREE.Color(0xfff2b0) });
    const brown = gloss(BROWN, { roughness: 0.5 });

    // ---- body + stripes
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.44, 40, 28), yellow);
    torso.scale.set(1, 0.95, 0.92);
    torso.position.y = 0.46;
    torso.castShadow = true;
    this.body.add(torso);
    for (const [y, s] of [[0.56, 1], [0.34, 0.98]] as const) {
      const dy = y - 0.46;
      const r = Math.sqrt(Math.max(0.01, 0.44 * 0.44 - (dy / 0.95) ** 2)) * 0.99;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.055, 14, 48), brown);
      ring.rotation.x = Math.PI / 2;
      ring.scale.set(s, 0.92, 1);
      ring.position.y = y;
      this.body.add(ring);
    }
    // stinger
    const sting = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 16), brown);
    sting.position.set(0, 0.4, -0.44);
    sting.rotation.x = -Math.PI / 2 - 0.3;
    this.body.add(sting);

    // ---- arms & feet
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), yellow);
      arm.position.set(side * 0.42, 0.58, 0.16);
      arm.castShadow = true;
      arm.name = side < 0 ? "armL" : "armR";
      this.body.add(arm);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), brown);
      foot.scale.set(1.05, 0.7, 1.35);
      foot.position.set(side * 0.18, 0.07, 0.06);
      foot.castShadow = true;
      this.body.add(foot);
    }

    // ---- head
    const skull = new THREE.Mesh(new THREE.SphereGeometry(this.R, 48, 36), yellow);
    skull.castShadow = true;
    this.head.add(skull);
    this.head.position.copy(this.headCenter);
    this.body.add(this.head);

    // eyes: big glossy brown with two highlights
    const eyeMat = gloss(EYE, { roughness: 0.15, clearcoatRoughness: 0.05 });
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.165, 28, 20), eyeMat);
      ball.scale.set(0.82, 1, 0.42);
      g.add(ball);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0x7a3f17, roughness: 0.2, clearcoat: 1 }));
      iris.scale.set(0.9, 1, 0.3);
      iris.position.set(0, -0.04, 0.045);
      g.add(iris);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), white);
      hi.position.set(side * 0.03 + 0.04, 0.06, 0.075);
      g.add(hi);
      const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), white);
      hi2.position.set(-0.045, -0.07, 0.07);
      g.add(hi2);
      this.onHead(g, side * 0.235, 0.02, 0.0);
      this.head.add(g);
      this.eyes.push(g);

      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.12, 4, 8), brown);
      brow.rotation.z = Math.PI / 2;
      const browHolder = new THREE.Group();
      browHolder.add(brow);
      this.onHead(browHolder, side * 0.23, 0.25, 0.01);
      this.head.add(browHolder);
      this.brows.push(brow);

      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ color: 0xff9a8a, transparent: true, opacity: 0.55 }));
      blush.scale.set(1, 0.62, 1);
      this.onHead(blush, side * 0.4, -0.13, 0.004);
      this.head.add(blush);
    }

    // mouths (one per expression, toggled)
    const red = new THREE.MeshBasicMaterial({ color: 0xc8283c, side: THREE.DoubleSide });
    const happy = new THREE.Group();
    const open = new THREE.Mesh(new THREE.CircleGeometry(0.085, 24, Math.PI, Math.PI), red);
    const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16, Math.PI, Math.PI), new THREE.MeshBasicMaterial({ color: 0xff7d93 }));
    tongue.position.set(0, -0.035, 0.002);
    happy.add(open, tongue);
    this.onHead(happy, 0, -0.17, 0.003);
    const frown = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.017, 8, 20, Math.PI), red);
    const frownG = new THREE.Group();
    frownG.add(frown);
    frown.position.y = -0.04;
    this.onHead(frownG, 0, -0.2, 0.004);
    const flat = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.08, 4, 8), red);
    flat.rotation.z = Math.PI / 2 + 0.12;
    const flatG = new THREE.Group();
    flatG.add(flat);
    this.onHead(flatG, 0.02, -0.19, 0.004);
    this.mouths = { happy, confused: frownG, determined: flatG };
    this.head.add(happy, frownG, flatG);

    // antennae
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.05, 0.35, 0.02), new THREE.Vector3(side * 0.2, 0.58, 0.05));
      const stalk = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.025, 8, false), brown);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), yellow);
      tip.position.copy(curve.getPoint(1));
      g.add(stalk, tip);
      g.position.set(side * 0.2, this.R * 0.88, 0);
      g.rotation.z = -side * 0.15;
      this.head.add(g);
      this.antennae.push(g);
    }

    // wings: iridescent ellipses behind the body
    const wingMat = new THREE.MeshPhysicalMaterial({
      color: 0xd6fbff, transparent: true, opacity: 0.55, roughness: 0.1, side: THREE.DoubleSide,
      iridescence: 1, iridescenceIOR: 1.6, emissive: 0x9ef0d6, emissiveIntensity: 0.15, depthWrite: false,
    });
    const ellipse = (rx: number, ry: number) => {
      const s = new THREE.Shape();
      s.absellipse(rx, 0, rx, ry, 0, Math.PI * 2, false, 0);
      return new THREE.ShapeGeometry(s, 32);
    };
    for (const side of [-1, 1]) {
      for (const [rx, ry, y, tilt] of [[0.36, 0.22, 0.78, 0.35], [0.26, 0.15, 0.6, -0.25]] as const) {
        const m = new THREE.Mesh(ellipse(rx, ry), wingMat);
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.18, y, -0.3);
        m.rotation.z = tilt;
        if (side < 0) m.scale.x = -1;
        pivot.add(m);
        this.body.add(pivot);
        this.wings.push({ pivot, side });
      }
    }

    // ---- accessories (unlocked by rank)
    const headband = new THREE.Mesh(new THREE.TorusGeometry(this.R * 0.98, 0.05, 12, 64), new THREE.MeshStandardMaterial({ color: 0xff3b4e, roughness: 0.6 }));
    headband.rotation.x = Math.PI / 2 - 0.25;
    headband.position.y = 0.22;
    this.head.add(headband);
    const crown = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc93c, metalness: 0.85, roughness: 0.25, emissive: 0x6b4500, emissiveIntensity: 0.25 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.14, 24, 1, true), gold);
    crown.add(band);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), gold);
      spike.position.set(Math.cos(a) * 0.25, 0.14, Math.sin(a) * 0.25);
      crown.add(spike);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x46d6ff : 0xff3b8d, emissive: i % 2 ? 0x1580a8 : 0xa0155a }));
      gem.position.set(Math.cos(a) * 0.27, 0.02, Math.sin(a) * 0.27);
      crown.add(gem);
    }
    crown.position.y = this.R * 0.93;
    crown.rotation.z = 0.12;
    this.head.add(crown);
    const capeGeo = new THREE.PlaneGeometry(0.8, 0.95, 6, 8);
    capeGeo.translate(0, -0.47, 0);
    const cape = new THREE.Mesh(capeGeo, new THREE.MeshStandardMaterial({ color: 0x7b2cbf, roughness: 0.7, side: THREE.DoubleSide }));
    cape.position.set(0, 0.86, -0.36);
    cape.rotation.x = 0.18;
    this.body.add(cape);
    this.accessories = { headband, cape, crown };

    this.root.add(this.body);
    this.setExpression("happy");
    this.setLevel(0);
  }

  /** Place an object on the head surface at (x, y) relative to head centre, facing outwards. */
  private onHead(obj: THREE.Object3D, x: number, y: number, lift: number) {
    const z = Math.sqrt(Math.max(0, this.R * this.R - x * x - y * y));
    const n = new THREE.Vector3(x, y, z).normalize();
    obj.position.copy(n.clone().multiplyScalar(this.R + lift));
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  }

  setExpression(e: Expression) {
    this.expression = e;
    for (const [k, m] of Object.entries(this.mouths)) m.visible = k === e;
    this.brows.forEach((b, i) => {
      const side = i === 0 ? -1 : 1;
      b.rotation.x = 0;
      b.parent!.rotation.z = e === "determined" ? side * 0.45 : e === "confused" ? (side < 0 ? -0.35 : 0.1) : side * -0.1;
    });
  }

  /** Unlock accessories with the bee's level. */
  setLevel(level: number) {
    this.accessories.headband.visible = level >= 10 && level < 200;
    this.accessories.cape.visible = level >= 50;
    this.accessories.crown.visible = level >= 200;
  }

  setFlying(on: boolean) { this.flyTarget = on ? 1 : 0; }

  celebrate() { this.celebrateT = 0; this.setExpression("happy"); }

  get busy() { return this.celebrateT >= 0; }

  update(t: number, dt: number, reduced: boolean) {
    this.flying += (this.flyTarget - this.flying) * Math.min(1, dt * 6);
    const f = this.flying;
    // idle bob + breathing
    const bob = reduced ? 0 : Math.sin(t * 2.2) * 0.03 * (1 - f) + Math.sin(t * 9) * 0.04 * f;
    this.body.position.y = bob + f * 0.25;
    this.body.rotation.x = f * 0.35;
    this.head.rotation.z = reduced ? 0 : Math.sin(t * 1.3) * 0.05;
    // wings
    const speed = reduced ? 3 : 18 + f * 34;
    const amp = 0.35 + f * 0.35;
    for (const w of this.wings) w.pivot.rotation.y = w.side * (0.55 + Math.sin(t * speed) * amp);
    // antennae wobble
    this.antennae.forEach((a, i) => (a.rotation.x = reduced ? 0 : Math.sin(t * 3 + i) * 0.12 + f * 0.4));
    // arms
    const armL = this.body.getObjectByName("armL")!, armR = this.body.getObjectByName("armR")!;
    const wave = this.celebrateT >= 0 ? Math.sin(t * 16) * 0.12 : 0;
    armL.position.y = 0.58 + wave + f * 0.1;
    armR.position.y = 0.58 - wave + f * 0.1;
    // cape flutter
    const cape = this.accessories.cape;
    cape.rotation.x = 0.18 + f * 0.9 + (reduced ? 0 : Math.sin(t * 5) * 0.06);
    // blink
    if (t > this.blinkAt) {
      const k = (t - this.blinkAt) / 0.14;
      const s = k < 1 ? 1 - Math.sin(k * Math.PI) * 0.92 : 1;
      this.eyes.forEach((e) => (e.scale.y = s));
      if (k >= 1) this.blinkAt = t + 2.5 + Math.random() * 3.5;
    }
    // celebration: two hops + a spin
    if (this.celebrateT >= 0) {
      this.celebrateT += dt;
      const c = this.celebrateT;
      if (reduced) { if (c > 0.6) this.celebrateT = -1; }
      else {
        const hop = c < 1.3 ? Math.abs(Math.sin((c / 1.3) * Math.PI * 2)) * 0.55 : 0;
        this.body.position.y += hop;
        this.body.rotation.y = c < 1.3 ? (c / 1.3) * Math.PI * 2 : 0;
        const squash = c < 1.3 ? 1 + Math.sin((c / 1.3) * Math.PI * 4) * 0.06 : 1;
        this.body.scale.set(1 / squash, squash, 1 / squash);
        if (c > 1.4) { this.celebrateT = -1; this.body.rotation.y = 0; this.body.scale.set(1, 1, 1); }
      }
    }
  }

  get currentExpression() { return this.expression; }
}
