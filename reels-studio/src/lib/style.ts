import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Measured from the reference reels (see harvest reports): Anton captions, cap height 96 px,
// 8 px black outline + soft drop shadow; yellow = goal/resource, red = threat.
export const COLORS = {
	white: '#FAF9F9',
	yellow: '#F5D65B',
	red: '#DC5F52',
	hudRed: '#FE421E',
	navy: '#0E1626',
	pill: '#0D0F10',
	green: '#32D360',
	blue: '#3A8DFF',
};

export const FONT = 'Anton';
export const FONT_UI = 'Oswald';

loadFont({family: FONT, url: staticFile('fonts/Anton.ttf'), format: 'truetype'});
for (const w of ['500', '600', '700']) {
	loadFont({family: FONT_UI, url: staticFile(`fonts/Oswald-${w}.ttf`), weight: w, format: 'truetype'});
}

// Outline via layered text-shadows renders crisply at any scale (unlike -webkit-text-stroke on Anton).
export const outline = (px: number, shadow = true) => {
	const s: string[] = [];
	const steps = 16;
	for (let i = 0; i < steps; i++) {
		const a = (i / steps) * Math.PI * 2;
		s.push(`${(Math.cos(a) * px).toFixed(1)}px ${(Math.sin(a) * px).toFixed(1)}px 0 #000`);
	}
	if (shadow) s.push(`3px ${px + 2}px ${px + 2}px rgba(0,0,0,0.55)`);
	return s.join(',');
};

export const sec = (s: number, fps = 30) => Math.round(s * fps);
