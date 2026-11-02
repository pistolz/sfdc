import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { CAM_FAR, CAM_FOV, CAM_NEAR, cameraGroundTarget, cameraMatrix } from "../camera";
import { PostFX, PostParams } from "../post/PostFX";
import { Aurora, Lights, Sky } from "../scene/Environment";
import { Clutter, Forest } from "../scene/Forest";
import { Clearing, Mountains, River, Rocks, Terrain, makeSkyEnv } from "../scene/Landscape";
import { Village } from "../scene/Village";
import { patchFogChunks } from "../scene/materials";
import { cameraAt2 } from "./camera02";
import { lightAt2 } from "./light02";
import { B, STEPS2 } from "./timeline02";
import { Village02, windowGlowAt } from "./Village02";

patchFogChunks();

const CameraRig2: React.FC<{ t: number }> = ({ t }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.fov = CAM_FOV;
    camera.near = CAM_NEAR;
    camera.far = CAM_FAR;
    camera.aspect = 1080 / 1920;
    camera.updateProjectionMatrix();
    camera.matrixAutoUpdate = false;
    camera.matrix.copy(cameraMatrix(cameraAt2(t)));
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

const stepEnv2 = (t: number, k = 6) => STEPS2.reduce((a, ts) => a + (t >= ts ? Math.exp(-(t - ts) * k) : 0), 0);
// the Day 01 village is shown in its finished state (Day 01 t = 85.5 s)
const DAY01_END = 85.5;
// "A casino! Build it!" -> the forest ring is felled out to 36 m to make room for the village
// (the dock side is cleared while the boats come in so the crowd can walk up from the river)
const CUT = {
  radius: 40,
  at: (x: number, y: number, rr: number, j: number) => {
    const k = (rr - 16) / 24;
    if (x > 6 && y > -30 && y < 8) return B.steamer + k * 1.2 + j * 0.15;
    return B.buildIt + k * (B.n150 + 0.6 - B.buildIt) + j * 0.15;
  },
};

export const Scene02: React.FC<{ frame: number; msaa?: number; renderScale?: number }> = ({ frame, msaa, renderScale }) => {
  const t = frame / 30;
  const L = lightAt2(t);
  const cam = cameraAt2(t);
  const target = cameraGroundTarget(cam);
  const camDist = cam.loc.distanceTo(target);
  const shadowHalf = THREE.MathUtils.clamp(camDist * Math.tan((CAM_FOV / 2) * (Math.PI / 180)) * 1.25, 14, 170);
  const env = useMemo(() => makeSkyEnv(), []);
  const fogColor = new THREE.Color(0.85, 0.9, 1.0).multiply(
    new THREE.Color()
      .copy(L.sunColor)
      .multiplyScalar(0.07 * L.sunEnergy)
      .add(new THREE.Color(0.35, 0.5, 1.0).multiplyScalar(0.05 * L.moonEnergy))
      .add(new THREE.Color(0.25, 0.3, 0.4).multiplyScalar(L.bgStrength * (1 - 0.8 * L.night))),
  );
  const env6 = stepEnv2(t);
  const params: PostParams = {
    exposure: Math.pow(2, -1.35),
    look: 0.35,
    bloomStrength: 0.4,
    bloomRadius: 0.15,
    bloomThreshold: 0.8,
    rot: 0.012 * env6 * Math.sin(t * 37),
    off: [30 + 24 * env6 * Math.sin(t * 53), 52 + 24 * env6 * Math.sin(t * 41 + 1)],
    split: STEPS2.some((ts) => t >= ts && t <= ts + 0.35),
    vigAngle: Math.PI / 4 + 0.25 * env6,
  };
  const night = L.night;
  return (
    <>
      <CameraRig2 t={t} />
      <FogCtl density={L.fog} color={fogColor} />
      <Lights L={L} target={target} shadowHalf={shadowHalf} />
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <Sky L={L} />
        <Aurora strength={L.aurora} />
        <Mountains glow={1.4 * L.bgStrength * (1 - 0.85 * night)} />
        <Terrain />
        <Clearing />
        <River env={env} envIntensity={THREE.MathUtils.lerp(1.0, 0.12, night) * (L.bgStrength / 0.36)} />
        <Rocks />
        <Forest shakeAmp={0} time={t} cut={CUT} />
        <Clutter />
        <Village t={DAY01_END} night={night} hideBao hideCrowd hideGhosts hideEyes hideGiant windowGlow={windowGlowAt(t)} fireT={DAY01_END + t} />
        <Village02 t={t} night={night} />
      </group>
      <PostFX params={params} msaa={msaa} renderScale={renderScale} />
    </>
  );
};
