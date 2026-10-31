import React from 'react';
import {Composition} from 'remotion';
import {Episode, EPISODE_FRAMES} from './stuck558/Episode';

export const Root: React.FC = () => (
	<Composition
		id="StuckAt558-Day1"
		component={Episode}
		durationInFrames={EPISODE_FRAMES}
		fps={30}
		width={1080}
		height={1920}
	/>
);
