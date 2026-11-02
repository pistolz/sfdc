// White foam trail behind moving yachts, drawn as one instanced mesh.
import * as THREE from 'three';

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createWake(scene, capacity = 6000) {
  const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: '#ffffff', map: softDot(), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  let n = 0;
  return {
    begin() { n = 0; },
    /** Add a foam blob at (x, z), radius r (x along heading, z across), heading h, brightness a (0..1). */
    add(x, z, rx, rz, h, a) {
      if (n >= capacity || a <= 0.01) return;
      p.set(x, 0.06, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h);
      s.set(rx, 1, rz);
      m.compose(p, q, s);
      mesh.setMatrixAt(n, m);
      c.setRGB(a, a, a);
      mesh.setColorAt(n, c);
      n++;
    },
    end() {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
