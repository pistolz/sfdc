import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { loadFonts, Day01Props } from "../Day01";
import { HEIGHT, WIDTH } from "../timeline";
import { Overlay02 } from "./HUD02";
import { Scene02 } from "./Scene02";

export const Day02: React.FC<Day01Props> = ({ msaa = 4, renderScale = 1 }) => {
  const frame = useCurrentFrame();
  const [handle] = useState(() => delayRender("Loading fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadFonts()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        continueRender(handle);
      });
  }, [handle]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={WIDTH}
        height={HEIGHT}
        dpr={1}
        flat
        shadows="soft"
        gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: 58.7, near: 0.5, far: 6000, position: [0, 170, 60] }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.LinearSRGBColorSpace;
          gl.toneMapping = THREE.NoToneMapping;
        }}
      >
        <Scene02 frame={frame} msaa={msaa} renderScale={renderScale} />
      </ThreeCanvas>
      {ready ? <Overlay02 frame={frame} /> : null}
      <Audio src={staticFile("day02_mix.wav")} />
    </AbsoluteFill>
  );
};
