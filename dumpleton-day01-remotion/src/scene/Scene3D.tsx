import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { CAM_FAR, CAM_FOV, CAM_NEAR, cameraAt, cameraGroundTarget, cameraMatrix } from "../camera";
import { FPS, M, SHAKE_WINDOWS } from "../timeline";
import { PostFX, PostParams, rgbSplitOn, stepEnv } from "../post/PostFX";
import { Aurora, Lights, Sky, lightAt } from "./Environment";
import { Clutter, Forest } from "./Forest";
import { Clearing, Mountains, River, Rocks, Terrain, makeSkyEnv } from "./Landscape";
import { Village } from "./Village";
import { patchFogChunks } from "./materials";

patchFogChunks();

const CameraRig: React.FC<{ t: number }> = ({ t }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    const s = cameraAt(t);
    camera.fov = CAM_FOV;
    camera.near = CAM_NEAR;
    camera.far = CAM_FAR;
    camera.aspect = 1080 / 1920;
    camera.updateProjectionMatrix();
    camera.matrixAutoUpdate = false;
    camera.matrix.copy(cameraMatrix(s));
    camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
    camera.updateMatrixWorld(true);
  }, [t, camera]);
  return null;
};

const FogCtl: React.FC<{ density: number; color: THREE.Color }> = ({ density, color }) => {
  const scene = useThree((s) => s.scene);
  const fog = useMemo(() => new THREE.FogExp2(0xffffff, 0.004), []);
  useLayoutEffect(() => {
    scene.fog = fog;
  }, [scene, fog]);
  fog.density = density;
  fog.color.copy(color);
  return null;
};

/** shake envelope for the inner ring trees (scene.py shake(o, fl_shake, 0.2, scale=2)) */
const treeShake = (t: number) => {
  let a = 0;
  for (const [s, e] of SHAKE_WINDOWS) {
    if (t < s || t > e) continue;
    const bi = (e - s) * 0.3;
    const bo = (e - s) * 0.4;
    let w = 1;
    if (t < s + bi) w = (t - s) / bi;
    if (t > e - bo) w = Math.min(w, (e - t) / bo);
    a = Math.max(a, w);
  }
  return a * 0.1; // ±0.1 rad (strength 0.2 peak-to-peak)
};

export const Scene3D: React.FC<{ frame: number; msaa?: number; renderScale?: number }> = ({ frame, msaa, renderScale }) => {
  const t = frame / FPS;
  const L = lightAt(t);
  const cam = cameraAt(t);
  const target = cameraGroundTarget(cam);
  const camDist = cam.loc.distanceTo(target);
  const shadowHalf = THREE.MathUtils.clamp(camDist * Math.tan((CAM_FOV / 2) * (Math.PI / 180)) * 1.25, 14, 170);
  const env = useMemo(() => makeSkyEnv(), []);

  // fog in-scatter colour: lit by sun/moon + sky
  const fogColor = new THREE.Color(0.85, 0.9, 1.0).multiply(
    new THREE.Color()
      .copy(L.sunColor)
      .multiplyScalar(0.07 * L.sunEnergy)
      .add(new THREE.Color(0.35, 0.5, 1.0).multiplyScalar(0.05 * L.moonEnergy))
      .add(new THREE.Color(0.25, 0.3, 0.4).multiplyScalar(L.bgStrength * (1 - 0.8 * L.night))),
  );

  const env6 = stepEnv(t, 6);
  const params: PostParams = {
    exposure: Math.pow(2, -1.35),
    look: 0.35,
    bloomStrength: 0.4,
    bloomRadius: 0.15,
    bloomThreshold: 0.8,
    rot: 0.012 * env6 * Math.sin(t * 37),
    off: [30 + 24 * env6 * Math.sin(t * 53), 52 + 24 * env6 * Math.sin(t * 41 + 1)],
    split: rgbSplitOn(t),
    vigAngle: Math.PI / 4 + 0.25 * env6,
  };
  const night = L.night;

  return (
    <>
      <CameraRig t={t} />
      <FogCtl density={L.fog} color={fogColor} />
      <Lights L={L} target={target} shadowHalf={shadowHalf} />
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <Sky L={L} />
        <Aurora strength={L.aurora} />
        <Mountains glow={3.0 * L.bgStrength * (1 - 0.85 * night)} />
        <Terrain />
        <Clearing />
        <River env={env} envIntensity={THREE.MathUtils.lerp(1.0, 0.12, night) * (L.bgStrength / 0.36)} />
        <Rocks />
        <Forest shakeAmp={treeShake(t)} time={t} />
        <Clutter />
        <Village t={t} night={night} />
      </group>
      <PostFX params={params} msaa={msaa} renderScale={renderScale} />
    </>
  );
};

export const SECTION_MARKS = M;
