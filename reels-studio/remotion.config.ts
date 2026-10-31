import {Config} from '@remotion/cli/config';
// Pre-installed Chromium in this environment; override with REMOTION_BROWSER if needed.
Config.setBrowserExecutable(process.env.REMOTION_BROWSER ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome');
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
