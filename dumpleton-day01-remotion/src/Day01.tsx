import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { Overlay } from "./hud/HUD";
import { Scene3D } from "./scene/Scene3D";
import { HEIGHT, WIDTH } from "./timeline";

// Fonts from assets/fonts (SIL OFL) – block rendering until they are ready so text metrics are exact.
const FONTS: [string, string, string][] = [
  ["Anton", "fonts/Anton-Regular.ttf", "400"],
  ["Barlow Condensed", "fonts/BarlowCondensed-SemiBold.ttf", "600"],
  ["Barlow Condensed", "fonts/BarlowCondensed-Bold.ttf", "700"],
  ["Barlow Condensed", "fonts/BarlowCondensed-ExtraBold.ttf", "800"],
];
let fontsPromise: Promise<void> | null = null;
export const loadFonts = () =>
  (fontsPromise ??= Promise.all(
    FONTS.map(async ([family, file, weight]) => {
      const f = new FontFace(family, `url(${staticFile(file)})`, { weight });
      await f.load();
      document.fonts.add(f);
    }),
  ).then(() => undefined));

/** msaa: 3D anti-aliasing samples; renderScale: internal 3D resolution (1 = 1080x1920, 0.5 = fast preview). */
export type Day01Props = { msaa?: number; renderScale?: number };

export const Day01: React.FC<Day01Props> = ({ msaa = 4, renderScale = 1 }) => {
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
        <Scene3D frame={frame} msaa={msaa} renderScale={renderScale} />
      </ThreeCanvas>
      {ready ? <Overlay frame={frame} /> : null}
      <Audio src={staticFile("final_mix.wav")} />
    </AbsoluteFill>
  );
};
