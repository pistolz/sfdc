import { Composition } from "remotion";
import { Day01 } from "./Day01";
import { Day02 } from "./day02/Day02";
import { DURATION2 } from "./day02/timeline02";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "./timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="Day01"
      component={Day01}
      durationInFrames={DURATION_FRAMES} // 2568 = 85.6 s
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ msaa: 4, renderScale: 1 }}
    />
    <Composition
      id="Day02"
      component={Day02}
      durationInFrames={DURATION2} // 3377 = 112.55 s (day02_mix.wav)
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ msaa: 4, renderScale: 1 }}
    />
    </>
  );
};
