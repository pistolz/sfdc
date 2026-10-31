import React from 'react';
import {AbsoluteFill, Img, interpolate, random, spring, staticFile, useCurrentFrame, Easing} from 'remotion';

// Layered "stage" animation: a still background plate + cut-out characters animated on top
// (the references move the characters, not the camera).

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const Bg: React.FC<{src: string; grade?: string; zoom?: [number, number, number, number]}> = ({src, grade, zoom}) => {
	const f = useCurrentFrame();
	// almost-still background; optional slow zoom [from, to, originX%, originY%]
	const s = zoom ? interpolate(f, [0, 90], [zoom[0], zoom[1]], clamp) : 1;
	return (
		<AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#05070c'}}>
			<Img
				src={staticFile(`layers/${src}`)}
				style={{width: '100%', height: '100%', objectFit: 'cover', filter: grade, transform: `scale(${s})`, transformOrigin: zoom ? `${zoom[2]}% ${zoom[3]}%` : 'center'}}
			/>
		</AbsoluteFill>
	);
};

export type Keys = [frame: number, value: number][];
const kf = (f: number, keys: Keys, easing = Easing.inOut(Easing.cubic)) =>
	keys.length === 1 ? keys[0][1] : interpolate(f, keys.map((k) => k[0]), keys.map((k) => k[1]), {...clamp, easing});

export type CharProps = {
	src: string;
	/** feet position (px) and height (px); keyframes allow walking/moving */
	x: Keys;
	y: Keys;
	h: Keys;
	flip?: boolean;
	/** walk cycle while x/y move: vertical bob + waddle */
	walk?: [from: number, to: number][];
	/** idle breathing */
	breathe?: boolean;
	/** frames where the character hops (pose-change accent) */
	hops?: number[];
	/** frames where the character trembles (scared) [from, to] */
	shake?: [number, number];
	/** spring pop-in at this frame */
	popAt?: number;
	/** fade/visibility window */
	show?: [number, number];
	grade?: string;
	shadow?: boolean;
	opacity?: number;
	seed?: string;
};

export const Char: React.FC<CharProps> = ({
	src, x, y, h, flip, walk = [], breathe = true, hops = [], shake, popAt, show, grade = 'brightness(0.86) saturate(0.95)', shadow = true, opacity = 1, seed = src,
}) => {
	const f = useCurrentFrame();
	if (show && (f < show[0] || f > show[1])) return null;
	const cx = kf(f, x);
	const cy = kf(f, y);
	const ch = kf(f, h);
	const walking = walk.some(([a, b]) => f >= a && f <= b);
	const phase = (f / 30) * Math.PI * 2 * 2.2; // ~2.2 steps per second
	const bob = walking ? -Math.abs(Math.sin(phase)) * ch * 0.035 : 0;
	const waddle = walking ? Math.sin(phase) * 3 : 0;
	const breath = breathe && !walking ? 1 + Math.sin((f / 30) * Math.PI * 2 * 0.45 + random(seed) * 6) * 0.012 : 1;
	let hop = 0;
	let squash = 1;
	for (const at of hops) {
		const t = f - at;
		if (t >= 0 && t < 12) {
			hop = -Math.sin((t / 12) * Math.PI) * ch * 0.06;
			squash = t < 2 ? 0.92 : t > 10 ? 0.95 : 1.03;
		}
	}
	const tremble = shake && f >= shake[0] && f <= shake[1] ? (random(`${seed}${f}`) - 0.5) * 6 : 0;
	const pop = popAt !== undefined ? spring({frame: f - popAt, fps: 30, config: {damping: 10, stiffness: 170}}) : 1;
	const fade = show ? interpolate(f, [show[0], show[0] + 4, show[1] - 4, show[1]], [0, 1, 1, 0], clamp) : 1;
	return (
		<>
			{shadow && (
				<div
					style={{
						position: 'absolute', left: cx - ch * 0.22, top: cy - ch * 0.03, width: ch * 0.44, height: ch * 0.06, borderRadius: '50%',
						background: 'radial-gradient(ellipse, rgba(0,0,0,0.55), rgba(0,0,0,0) 70%)', opacity: fade * opacity * pop,
						transform: `scaleX(${walking ? 1 - Math.abs(Math.sin(phase)) * 0.15 : 1})`,
					}}
				/>
			)}
			<Img
				src={staticFile(`layers/${src}`)}
				style={{
					position: 'absolute', left: cx, top: cy, height: ch, transformOrigin: '50% 100%', filter: grade, opacity: fade * opacity,
					transform: `translate(-50%, -100%) translate(${tremble}px, ${bob + hop}px) rotate(${waddle}deg) scale(${(flip ? -1 : 1) * pop}, ${breath * squash * pop})`,
				}}
			/>
		</>
	);
};

/** "!" alert mark popping above a head */
export const Alert: React.FC<{x: number; y: number; at: number; color?: string}> = ({x, y, at, color = '#FE421E'}) => {
	const f = useCurrentFrame();
	if (f < at) return null;
	const s = spring({frame: f - at, fps: 30, config: {damping: 8, stiffness: 220}});
	const wobble = Math.sin((f - at) / 3) * 6;
	return (
		<div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-100%) scale(${s}) rotate(${wobble}deg)`, fontFamily: 'Anton', fontSize: 230, color, textShadow: '0 0 0 #000, 6px 6px 0 #000, -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000'}}>
			!
		</div>
	);
};

/** glass wall that "packs" upward inside a rectangle (rain fusing into glass) */
export const GlassFill: React.FC<{rect: [number, number, number, number]; from: number; to: number}> = ({rect, from, to}) => {
	const f = useCurrentFrame();
	const p = interpolate(f, [from, to], [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
	const [x, y, w, hh] = rect;
	const top = y + hh * (1 - p);
	return (
		<div
			style={{
				position: 'absolute', left: x, top, width: w, height: hh * p, borderRadius: '50% 50% 0 0 / 18% 18% 0 0',
				background: 'linear-gradient(180deg, rgba(255,200,110,0.55), rgba(255,140,40,0.35))', boxShadow: '0 0 60px rgba(255,160,60,0.6)',
				mixBlendMode: 'screen',
			}}
		>
			<div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 10, background: 'rgba(255,240,200,0.9)', filter: 'blur(4px)', opacity: p < 1 ? 1 : 0}} />
		</div>
	);
};
