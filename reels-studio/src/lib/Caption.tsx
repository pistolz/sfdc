import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, Easing} from 'remotion';
import {COLORS, FONT, outline} from './style';

export type Word = {w: string; s: number; e: number};
// Chunk = displayed text (with [Y]..[/Y] / [R]..[/R] marks) + number of spoken words it covers.
// text === null hides captions for those words (e.g. while a rule card speaks for itself).
export type Chunk = [text: string | null, words: number];

type Timed = {text: string; from: number; to: number};

export const buildCaptions = (chunks: Chunk[], words: Word[], fps: number, endFrame: number): Timed[] => {
	const total = chunks.reduce((a, c) => a + c[1], 0);
	if (total !== words.length) {
		throw new Error(`caption chunks cover ${total} words, voice has ${words.length}`);
	}
	const out: {text: string | null; from: number}[] = [];
	let i = 0;
	for (const [text, n] of chunks) {
		// Captions trail the voice by ~2 frames in the references; never ahead.
		out.push({text, from: Math.round(words[i].s * fps) + 1});
		i += n;
	}
	const timed: Timed[] = [];
	out.forEach((c, k) => {
		if (c.text === null) return;
		const next = out[k + 1];
		// Holds until the next caption, with a 1-frame gap (measured 51/93 cases).
		const to = next ? next.from - 1 : endFrame;
		timed.push({text: c.text, from: c.from, to});
	});
	return timed;
};

const renderMarked = (t: string) => {
	const parts = t.split(/(\[[YR]\].*?\[\/[YR]\])/g).filter(Boolean);
	return parts.map((p, i) => {
		const m = p.match(/^\[([YR])\](.*)\[\/[YR]\]$/);
		if (!m) return <span key={i}>{p}</span>;
		return (
			<span key={i} style={{color: m[1] === 'Y' ? COLORS.yellow : COLORS.red}}>
				{m[2]}
			</span>
		);
	});
};

export const Captions: React.FC<{items: Timed[]}> = ({items}) => {
	const f = useCurrentFrame();
	const cur = items.find((c) => f >= c.from && f <= c.to);
	if (!cur) return null;
	const local = f - cur.from;
	// Pop-in: 50% pre-frame, scale .92 -> .94 -> .966 -> 1 over 3 frames, hard out.
	const scale = interpolate(local, [0, 1, 2, 3], [0.92, 0.94, 0.966, 1], {
		extrapolateRight: 'clamp',
		easing: Easing.out(Easing.quad),
	});
	const opacity = local === 0 ? 0.5 : 1;
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<div
				style={{
					position: 'absolute',
					left: 70,
					right: 70,
					top: 1291,
					transform: `translateY(-50%) scale(${scale})`,
					opacity,
					textAlign: 'center',
					fontFamily: FONT,
					fontSize: 112,
					lineHeight: 1.02,
					color: COLORS.white,
					textTransform: 'uppercase',
					textShadow: outline(8),
				}}
			>
				{renderMarked(cur.text)}
			</div>
		</AbsoluteFill>
	);
};

export {renderMarked};
