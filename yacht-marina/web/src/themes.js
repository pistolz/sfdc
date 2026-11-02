// Lighting / colour presets. Pick one per episode with "theme" in the episode JSON.
export const THEMES = {
  day: {
    sky: '#9fd8f5', fog: '#bfe6f7', fogNear: 260, fogFar: 900,
    sun: '#fff1d6', sunIntensity: 3.2, sunDir: [-0.45, 1.0, 0.55],
    hemiSky: '#cdeeff', hemiGround: '#e8d2a6', hemiIntensity: 1.25,
    shallow: '#2fd3d0', deep: '#1677b8', seaSky: '#bfe9ff', foam: '#ffffff', sand: '#e9d3a3',
    exposure: 1.0, bloom: 0.12, lampGlow: 0.0, windowGlow: 0.0,
    saturation: 1.12,
  },
  sunset: {
    sky: '#ffb38a', fog: '#ffc9a3', fogNear: 220, fogFar: 800,
    sun: '#ffc08a', sunIntensity: 3.0, sunDir: [-0.85, 0.42, 0.25],
    hemiSky: '#ffd2b0', hemiGround: '#8a6a8f', hemiIntensity: 1.0,
    shallow: '#3fc2c9', deep: '#2a5f9a', seaSky: '#ffc49a', foam: '#fff2e6', sand: '#e7c79a',
    exposure: 1.0, bloom: 0.35, lampGlow: 1.2, windowGlow: 0.9,
    saturation: 1.15,
  },
  night: {
    sky: '#1b2346', fog: '#1d2650', fogNear: 200, fogFar: 700,
    sun: '#9fb4ff', sunIntensity: 0.9, sunDir: [0.4, 0.9, 0.3],
    hemiSky: '#3a4a8c', hemiGround: '#1a1a2a', hemiIntensity: 0.7,
    shallow: '#1f6f8f', deep: '#0f2a52', seaSky: '#3b4f8f', foam: '#9fc8ff', sand: '#6b6a7a',
    exposure: 1.1, bloom: 0.9, lampGlow: 3.0, windowGlow: 2.4,
    saturation: 1.1,
  },
};
