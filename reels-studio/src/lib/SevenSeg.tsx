import React from 'react';

// Classic 7-segment digit with ghost (unlit) segments, as in the reference countdown cards.
const SEGS: Record<string, string> = {
	'0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc',
	'5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', ' ': '',
};

const Digit: React.FC<{ch: string; h: number; on: string; off: string}> = ({ch, h, on, off}) => {
	const w = h * 0.56;
	const t = h * 0.12;
	const lit = SEGS[ch] ?? '';
	const seg = (id: string, x: number, y: number, horiz: boolean) => {
		const len = horiz ? w - t * 1.2 : h / 2 - t * 1.0;
		const pts = horiz
			? `${x},${y} ${x + t / 2},${y - t / 2} ${x + len - t / 2},${y - t / 2} ${x + len},${y} ${x + len - t / 2},${y + t / 2} ${x + t / 2},${y + t / 2}`
			: `${x},${y} ${x + t / 2},${y + t / 2} ${x + t / 2},${y + len - t / 2} ${x},${y + len} ${x - t / 2},${y + len - t / 2} ${x - t / 2},${y + t / 2}`;
		return <polygon key={id} points={pts} fill={lit.includes(id) ? on : off} />;
	};
	const x0 = t * 0.6;
	const x1 = w - t * 0.6;
	return (
		<svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{overflow: 'visible'}}>
			{seg('a', x0, t * 0.6, true)}
			{seg('g', x0, h / 2, true)}
			{seg('d', x0, h - t * 0.6, true)}
			{seg('f', x0, t * 0.6, false)}
			{seg('b', x1, t * 0.6, false)}
			{seg('e', x0, h / 2, false)}
			{seg('c', x1, h / 2, false)}
		</svg>
	);
};

export const SevenSeg: React.FC<{value: string; h: number; on?: string; off?: string; gap?: number}> = ({
	value, h, on = '#FE5934', off = 'rgba(80,25,15,0.55)', gap = 0.14,
}) => (
	<div style={{display: 'flex', gap: h * gap, filter: `drop-shadow(0 0 ${h * 0.08}px ${on})`}}>
		{value.split('').map((c, i) => (
			<Digit key={i} ch={c} h={h} on={on} off={off} />
		))}
	</div>
);
