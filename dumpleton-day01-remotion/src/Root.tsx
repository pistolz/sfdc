import { Composition } from "remotion";
import { Day01 } from "./Day01";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "./timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Day01"
      component={Day01}
      durationInFrames={DURATION_FRAMES} // 2568 = 85.6 s
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ msaa: 4, renderScale: 1 }}
    />
  );
};
