import React from 'react';
import {
	AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, random,
} from 'remotion';
import {Audio} from '@remotion/media';
import words from '../../public/audio/ep1/words.json';
import {Captions, buildCaptions, Chunk, renderMarked} from '../lib/Caption';
import {SevenSeg} from '../lib/SevenSeg';
import {COLORS, FONT, FONT_UI, outline, sec} from '../lib/style';
import {Alert, Bg, Char, GlassFill} from '../lib/Layers';

// ---------------------------------------------------------------- timeline (seconds, from voice word timings)
const T = {
	hudIn: 1.55,
	shot2: 3.12,
	phone: 7.15,
	shot1b: 9.85,
	cdIn: 12.38,
	cdDock: 14.95,
	shot3: 15.22,
	tunnelHit: 18.55,
	rule: 22.42,
	ruleDock: 24.72,
	shot4: 24.95,
	safe: [28.72, 29.0, 29.44],
	sleep: 30.12,
	tick: 31.95,
	shot5: 33.18,
	cta: 36.45,
	choice: 40.25,
	end: 42.6,
	total: 45.0,
};
export const EPISODE_FRAMES = sec(T.total);

const CHUNKS: Chunk[] = [
	['TIME STOPPED', 2], ['AT [Y]5:58[/Y].', 3], ['[R]SOMETHING[/R]', 1], ["DIDN'T.", 1],
	['DAY [Y]ONE[/Y].', 2], ['FOUR THOUSAND PEOPLE', 3], ['[Y]FROZEN[/Y] MID-STRIDE.', 2], ['EYES [R]CLOSED[/R].', 2],
	['EVERY PHONE', 2], ['THE SAME [R]ALARM[/R].', 3], ['[Y]6 A.M.[/Y]', 2],
	['AND EVERY TIME', 3], ['YOU [Y]SLEEP[/Y]', 2], ['THE WORLD MOVES', 3], ['[Y]ONE SECOND[/Y].', 2],
	["THAT'S [Y]100[/Y] NIGHTS.", 4], ['[R]SURVIVE[/R]', 1], ['UNTIL IT RINGS.', 3],
	['PUSH THE RAIN', 3], ['IT STAYS PUSHED.', 3], ['EVERY PATH', 2], ['LEAVES A [Y]TUNNEL[/Y].', 3],
	['BUT THIS ONE', 3], ["[R]ISN'T YOURS[/R].", 2], ['[R]TWO METRES[/R] TALL.', 3], ['AND IT ENDS', 3], ['AT YOUR [R]DOOR[/R].', 3],
	[null, 7], // rule card speaks for itself
	['SO YOU [Y]BUILD[/Y].', 3], ['RAIN PACKS', 2], ['INTO [Y]GLASS[/Y].', 2], ['A WALL', 2], ['BY [Y]MIDNIGHT[/Y].', 2],
	['[Y]THREE[/Y] SLEEPERS', 2], ['[Y]INSIDE[/Y].', 1],
	['YOU [R]SLEEP[/R].', 2], ['5:58', 2], ['AND [Y]21[/Y].', 2],
	['THE WOMAN', 2], ['AT YOUR GLASS', 3], ['TOOK [R]THREE STEPS[/R].', 3], ["SHE'S [R]FACING YOU[/R].", 3],
	['[Y]FOLLOW[/Y]', 1], ['AND TOMORROW', 2], ['A SLEEPER GETS', 3], ['[Y]YOUR NAME[/Y].', 2], ['DAY 2', 2], ['STARTS [R]NOW![/R]', 2],
];

const clampOpts = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ---------------------------------------------------------------- shots
// Rain that does NOT fall (time is frozen): beads hang in place and only glint.
const FrozenRain: React.FC<{seed: string}> = ({seed}) => {
	const f = useCurrentFrame();
	const drops = React.useMemo(
		() => new Array(70).fill(0).map((_, i) => ({
			x: random(`${seed}x${i}`) * 1080, y: random(`${seed}y${i}`) * 1920,
			r: 3 + random(`${seed}r${i}`) * 7, ph: random(`${seed}p${i}`) * 60, sp: 40 + random(`${seed}s${i}`) * 50,
		})),
		[seed],
	);
	return (
		<svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
			{drops.map((d, i) => {
				const glint = Math.max(0, Math.sin(((f + d.ph) / d.sp) * Math.PI * 2)) ** 6;
				return (
					<g key={i} opacity={0.25 + glint * 0.6}>
						<ellipse cx={d.x} cy={d.y} rx={d.r * 0.7} ry={d.r} fill="rgba(200,225,255,0.18)" stroke="rgba(230,245,255,0.55)" strokeWidth={1.2} />
						<circle cx={d.x - d.r * 0.25} cy={d.y - d.r * 0.35} r={d.r * 0.22 + glint * 2} fill="rgba(255,255,255,0.9)" />
					</g>
				);
			})}
		</svg>
	);
};

const Phone: React.FC = () => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const up = spring({frame: f, fps, config: {damping: 14, mass: 0.8}});
	const ring = f > sec(8.93 - T.phone) ? Math.sin(f * 1.6) * 2.5 : 0;
	const notif = spring({frame: f - sec(1.0), fps, config: {damping: 12}});
	return (
		<AbsoluteFill>
			<Img src={staticFile('layers/b2.jpg')} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(14px) brightness(0.45)'}} />
			<div
				style={{
					position: 'absolute', left: 250, top: 330, width: 580, height: 900, borderRadius: 70,
					background: '#0b0d12', border: '10px solid #22252c', boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
					transform: `translateY(${(1 - up) * 900}px) rotate(${ring}deg)`, overflow: 'hidden',
				}}
			>
				<div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#1b2a4a 0%,#0b1020 100%)'}} />
				<div style={{position: 'absolute', top: 34, left: 44, right: 44, display: 'flex', justifyContent: 'space-between', fontFamily: FONT_UI, fontWeight: 600, fontSize: 26, color: '#cfd6e6'}}>
					<span>No Service</span>
					<span style={{color: '#ff4d4d'}}>▮ 3%</span>
				</div>
				<div style={{position: 'absolute', top: 150, width: '100%', textAlign: 'center', fontFamily: FONT_UI, fontWeight: 500, fontSize: 170, color: 'white', letterSpacing: -4}}>5:58</div>
				<div style={{position: 'absolute', top: 360, width: '100%', textAlign: 'center', fontFamily: FONT_UI, fontWeight: 500, fontSize: 30, color: '#aab4c8'}}>Friday, rain</div>
				<div
					style={{
						position: 'absolute', left: 34, right: 34, top: 470, padding: '26px 30px', borderRadius: 34,
						background: 'rgba(255,255,255,0.14)', transform: `scale(${notif})`, fontFamily: FONT_UI, color: 'white',
					}}
				>
					<div style={{fontSize: 24, fontWeight: 600, color: '#ffb84d', letterSpacing: 2}}>ALARM</div>
					<div style={{fontSize: 64, fontWeight: 700}}>6:00 AM</div>
					<div style={{fontSize: 28, fontWeight: 500, color: '#cfd6e6'}}>in 1 min 40 s</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ---------------------------------------------------------------- HUD
const Blink: React.FC = () => {
	const f = useCurrentFrame();
	// measured: hard square blink, 17 frames on / 13 off, on at integer seconds
	return <div style={{width: 18, height: 18, borderRadius: 9, background: COLORS.hudRed, opacity: f % 30 < 17 ? 1 : 0}} />;
};

const Hud: React.FC = () => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t = f / fps + T.hudIn;
	const ticked = t >= T.tick;
	// the stuck second twitches but never advances
	const jitter = !ticked && f % 4 === 0 ? (random(`j${Math.floor(f / 4)}`) - 0.5) * 3 : 0;
	const pulse = ticked ? interpolate(t, [T.tick, T.tick + 0.15, T.tick + 0.9], [1, 1.35, 1], clampOpts) : 1;
	const secColor = ticked && t < T.tick + 1.6 ? COLORS.red : 'white';
	// your own watch keeps running: 6:12 AM, spins through the build, crosses midnight in your sleep
	const mins = interpolate(t, [0, 25, 30, 31.9, 32.4, 45], [372, 384, 1438, 1440 + 400, 1440 + 451, 1440 + 465], clampOpts);
	const hh = Math.floor(mins / 60) % 24;
	const mm = Math.floor(mins % 60);
	const yourTime = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
	const safe = T.safe.filter((s) => t >= s).length;
	const lastSafe = [...T.safe].reverse().find((s) => t >= s);
	const safePop = lastSafe ? interpolate(t, [lastSafe, lastSafe + 0.1, lastSafe + 0.25], [1, 1.3, 1], clampOpts) : 1;
	const fadeIn = interpolate(f, [0, 3], [0, 1], clampOpts);
	const txt: React.CSSProperties = {fontFamily: FONT, color: 'white', textShadow: outline(4)};
	return (
		<AbsoluteFill style={{opacity: fadeIn}}>
			<div style={{position: 'absolute', left: 64, top: 262}}>
				<div style={{display: 'flex', alignItems: 'center', gap: 14}}>
					<Blink />
					<span style={{...txt, fontSize: 34}}>DAY 1</span>
				</div>
				<div style={{display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: -4}}>
					<span style={{...txt, fontSize: 92, lineHeight: 1}}>5:58:</span>
					<span style={{...txt, fontSize: 92, lineHeight: 1, color: secColor, display: 'inline-block', transform: `translateX(${jitter}px) scale(${pulse})`, transformOrigin: '50% 80%'}}>
						{ticked ? '21' : '20'}
					</span>
					<span style={{...txt, fontSize: 32, marginBottom: 10}}>AM</span>
				</div>
				<div style={{...txt, fontFamily: FONT_UI, fontWeight: 600, fontSize: 24, letterSpacing: 1.5, textShadow: outline(3, false), opacity: 0.92}}>
					TOWN OF DUNMOOR · YOU: {yourTime}
				</div>
			</div>
			<div style={{position: 'absolute', right: 64, top: 268, textAlign: 'right'}}>
				<div style={{...txt, fontSize: 30, letterSpacing: 1}}>SAFE</div>
				<div style={{...txt, fontSize: 76, lineHeight: 1, color: safe ? COLORS.yellow : 'white', transform: `scale(${safePop})`, transformOrigin: '100% 50%'}}>
					{safe}<span style={{fontSize: 34, color: 'white'}}> / 4012</span>
				</div>
			</div>
			<RulePill t={t} />
			<CountdownMini t={t} />
		</AbsoluteFill>
	);
};

const RulePill: React.FC<{t: number}> = ({t}) => {
	if (t < T.ruleDock + 13 / 30) return null;
	const lit = t < T.ruleDock + 1.4;
	return (
		<div style={{position: 'absolute', left: 64, top: 470, display: 'flex', alignItems: 'center', height: 50, borderRadius: 25, background: 'rgba(13,15,16,0.92)', paddingRight: 22, boxShadow: '0 4px 8px rgba(0,0,0,0.5)'}}>
			<div style={{height: 46, margin: 2, padding: '0 16px', borderRadius: 23, background: lit ? COLORS.red : '#b8483d', display: 'flex', alignItems: 'center', fontFamily: FONT, fontSize: 24, color: 'white'}}>RULE #1</div>
			<span style={{marginLeft: 16, fontFamily: FONT, fontSize: 26, color: 'white'}}>NEVER WALK IN ITS TUNNEL</span>
		</div>
	);
};

// countdown card: big in the centre, then docks under SAFE (top-right)
const CD_BIG = {x: 310, y: 640, w: 460, h: 316};
const CD_SLOT = {x: 836, y: 400, scale: 0.4};
const CountdownCard: React.FC<{t: number; value: string}> = ({t, value}) => {
	const appear = interpolate(t, [T.cdIn, T.cdIn + 4 / 30], [0.8, 1], {...clampOpts, easing: Easing.out(Easing.cubic)});
	const dock = interpolate(t, [T.cdDock, T.cdDock + 7 / 30], [0, 1], {...clampOpts, easing: Easing.out(Easing.cubic)});
	const scale = appear * (1 - dock) + CD_SLOT.scale * dock;
	const x = CD_BIG.x + (CD_SLOT.x - CD_BIG.x - (CD_BIG.w * (1 - CD_SLOT.scale)) / 2) * dock;
	const y = CD_BIG.y + (CD_SLOT.y - CD_BIG.y - (CD_BIG.h * (1 - CD_SLOT.scale)) / 2) * dock;
	const breathe = 0.85 + 0.15 * Math.sin((t / 2.1) * Math.PI * 2);
	return (
		<div
			style={{
				position: 'absolute', left: x, top: y, width: CD_BIG.w, height: CD_BIG.h, transform: `scale(${scale})`,
				borderRadius: 40, border: '6px solid #fe6543', background: 'rgba(29,13,7,0.88)',
				boxShadow: `0 0 ${28 * breathe}px rgba(254,101,67,${0.7 * breathe})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
			}}
		>
			<div style={{fontFamily: FONT, fontSize: 34, color: '#f66644', letterSpacing: 2}}>ALARM IN</div>
			<SevenSeg value={value} h={145} />
			<div style={{fontFamily: FONT, fontSize: 28, color: '#d0c8c5', letterSpacing: 3}}>NIGHTS</div>
		</div>
	);
};

const CountdownMini: React.FC<{t: number}> = ({t}) => {
	if (t < T.cdIn) return null;
	const value = t >= T.tick + 0.25 ? ' 99' : '100';
	const dim = t < T.cdDock ? interpolate(t, [T.cdIn, T.cdIn + 0.15], [0, 0.5], clampOpts) : interpolate(t, [T.cdDock, T.cdDock + 0.25], [0.5, 0], clampOpts);
	return (
		<>
			<AbsoluteFill style={{background: `rgba(0,0,0,${dim})`}} />
			<CountdownCard t={t} value={value} />
		</>
	);
};

// ---------------------------------------------------------------- rule card (slides in, karaoke fill, docks into the HUD)
const RULE_WORDS = ['NEVER', 'WALK', 'INSIDE', 'ITS', 'TUNNEL'];
const RuleCard: React.FC = () => {
	const f = useCurrentFrame();
	const t = f / 30 + T.rule;
	const slide = interpolate(f, [0, 8, 11], [1080, -60, 0], {...clampOpts, easing: Easing.out(Easing.cubic)});
	const dock = interpolate(t, [T.ruleDock, T.ruleDock + 13 / 30], [0, 1], {...clampOpts, easing: Easing.inOut(Easing.cubic)});
	const ws = (words as {w: string; s: number}[]).slice(68, 73);
	return (
		<AbsoluteFill style={{opacity: 1 - dock * 0.9}}>
			<AbsoluteFill style={{background: `rgba(0,0,0,${0.35 * (1 - dock)})`}} />
			<div
				style={{
					position: 'absolute', left: 80, top: 980, width: 920, transform: `translate(${slide + dock * -330}px, ${dock * -540}px) scale(${1 - dock * 0.62})`,
					transformOrigin: '0 0',
				}}
			>
				<div style={{display: 'flex', justifyContent: 'center', marginBottom: -18, position: 'relative', zIndex: 2}}>
					<div style={{background: COLORS.hudRed, color: 'white', fontFamily: FONT, fontSize: 34, padding: '4px 24px', borderRadius: 22}}>RULE #1</div>
				</div>
				<div style={{background: 'rgba(14,22,38,0.94)', borderRadius: 24, borderBottom: `8px solid ${COLORS.hudRed}`, padding: '44px 40px 30px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.6)'}}>
					<div style={{fontFamily: FONT, fontSize: 88, lineHeight: 1.05}}>
						{RULE_WORDS.map((w, i) => (
							<span key={w} style={{color: t >= ws[i].s ? (i >= 3 ? COLORS.red : 'white') : 'rgba(255,255,255,0.35)'}}>
								{w}{' '}
							</span>
						))}
					</div>
					<div style={{marginTop: 14, fontFamily: FONT_UI, fontWeight: 600, fontSize: 30, color: '#9aa3b2', letterSpacing: 1.5}}>IT ONLY MOVES WHILE YOU SLEEP</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ---------------------------------------------------------------- sleep / tick
const Eyelids: React.FC<{dur: number}> = ({dur}) => {
	const f = useCurrentFrame();
	const close = interpolate(f, [0, 14], [0, 1], {...clampOpts, easing: Easing.in(Easing.quad)});
	const open = interpolate(f, [dur - 10, dur], [0, 1], {...clampOpts, easing: Easing.out(Easing.quad)});
	const k = close * (1 - open);
	return (
		<AbsoluteFill>
			<div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 960 * k, background: '#000', borderBottomLeftRadius: '50% 40px', borderBottomRightRadius: '50% 40px'}} />
			<div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 960 * k, background: '#000', borderTopLeftRadius: '50% 40px', borderTopRightRadius: '50% 40px'}} />
		</AbsoluteFill>
	);
};

const Flash: React.FC = () => {
	const f = useCurrentFrame();
	const o = interpolate(f, [0, 2, 12], [0, 1, 0], clampOpts);
	return <AbsoluteFill style={{background: '#eaf3ff', opacity: o, mixBlendMode: 'screen'}} />;
};

const HeartbeatVignette: React.FC = () => {
	const f = useCurrentFrame();
	const beat = (f % 24) < 4 ? 1 : (f % 24) < 8 ? 0.4 : 0;
	return <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(120,0,0,${0.25 + beat * 0.25}) 100%)`}} />;
};

// ---------------------------------------------------------------- CTA / choice / end card
const pop = (f: number, at: number, fps: number) => spring({frame: f - at, fps, config: {damping: 11, stiffness: 180}});

const NameTag: React.FC<{x: number; y: number; delay: number}> = ({x, y, delay}) => {
	const f = useCurrentFrame();
	const s = pop(f, delay, 30);
	return (
		<div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${s})`, padding: '6px 16px', borderRadius: 14, border: '3px solid #7fe0ff', background: 'rgba(10,40,60,0.75)', fontFamily: FONT, fontSize: 30, color: '#bff0ff'}}>
			YOUR NAME?
		</div>
	);
};

const FollowCta: React.FC = () => {
	const f = useCurrentFrame();
	const a = pop(f, 0, 30);
	const b = pop(f, 6, 30);
	return (
		<AbsoluteFill>
			<div style={{position: 'absolute', top: 300, width: '100%', textAlign: 'center', transform: `scale(${a})`}}>
				<div style={{fontFamily: FONT, fontSize: 96, color: COLORS.yellow, textShadow: outline(8)}}>SAVE THE SLEEPERS!</div>
			</div>
			<div style={{position: 'absolute', top: 440, left: 150, right: 150, transform: `scale(${b})`, background: COLORS.green, borderRadius: 60, padding: '14px 0 10px', textAlign: 'center', border: '4px solid #0b3d1a', boxShadow: '0 8px 20px rgba(0,0,0,0.5)'}}>
				<div style={{fontFamily: FONT, fontSize: 52, color: 'white', textShadow: outline(3, false)}}>1 FOLLOW = 1 SLEEPER SAVED</div>
				<div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 26, color: '#0b3d1a', letterSpacing: 1}}>YOUR NAME WRITTEN ON THEIR WRIST · DAY 2</div>
			</div>
			<NameTag x={570} y={830} delay={14} />
			<NameTag x={722} y={770} delay={20} />
			<NameTag x={870} y={850} delay={26} />
		</AbsoluteFill>
	);
};

const Choice: React.FC = () => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t1 = interpolate(f, [0, 5], [1.43, 1], {...clampOpts, easing: Easing.out(Easing.cubic)});
	const t2 = interpolate(f, [5, 9], [1.15, 1], {...clampOpts, easing: Easing.out(Easing.cubic)});
	const btn = pop(f, 13, fps);
	const chevron = Math.sin(f / 5) * 8;
	return (
		<AbsoluteFill style={{background: 'rgba(0,0,0,0.45)'}}>
			<div style={{position: 'absolute', top: 560, width: '100%', textAlign: 'center', fontFamily: FONT, lineHeight: 1.0, textShadow: outline(9)}}>
				<div style={{fontSize: 118, color: COLORS.yellow, transform: `scale(${t1})`}}>OPEN THE GLASS</div>
				<div style={{fontSize: 118, color: COLORS.red, opacity: f >= 5 ? 1 : 0, transform: `scale(${t2})`}}>OR STAY INSIDE?</div>
			</div>
			<div style={{position: 'absolute', top: 880, width: '100%', display: 'flex', justifyContent: 'center', gap: 36, transform: `scale(${btn})`}}>
				<div style={{background: COLORS.green, borderRadius: 50, padding: '12px 44px', fontFamily: FONT, fontSize: 52, color: 'white', boxShadow: '0 6px 0 #0b3d1a'}}>OPEN</div>
				<div style={{background: '#EB3941', borderRadius: 50, padding: '12px 44px', fontFamily: FONT, fontSize: 52, color: 'white', boxShadow: '0 6px 0 #5a0c10'}}>STAY</div>
			</div>
			<div style={{position: 'absolute', top: 1010, width: '100%', textAlign: 'center', fontFamily: FONT, fontSize: 40, color: 'white', textShadow: outline(4), opacity: btn}}>
				COMMENT BELOW
				<div style={{fontSize: 44, transform: `translateY(${chevron}px)`}}>⌄</div>
			</div>
		</AbsoluteFill>
	);
};

const EndCard: React.FC = () => {
	const f = useCurrentFrame();
	const s = interpolate(f, [0, 9], [1.1, 1], {...clampOpts, easing: Easing.out(Easing.cubic)});
	const pill = interpolate(f, [12, 14], [0.96, 1], clampOpts);
	return (
		<AbsoluteFill style={{background: 'rgba(0,0,0,0.6)'}}>
			<div style={{position: 'absolute', top: 470, width: '100%', textAlign: 'center', transform: `scale(${s})`, fontFamily: FONT, textShadow: outline(11)}}>
				<div style={{fontSize: 76, color: 'white', lineHeight: 1}}>
					{renderMarked('STUCK AT [Y]5:58[/Y]')}
				</div>
				<div style={{fontSize: 278, color: '#EB5B4A', lineHeight: 0.95}}>DAY 2</div>
			</div>
			<div style={{position: 'absolute', top: 900, left: 249, width: 582, height: 96, borderRadius: 48, background: '#EB5B4A', opacity: f >= 12 ? 1 : 0, transform: `scale(${pill})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontSize: 50, color: 'white'}}>
				FOLLOW FOR DAY 2
			</div>
		</AbsoluteFill>
	);
};

const TitleCard: React.FC = () => {
	const f = useCurrentFrame();
	const s = interpolate(f, [0, 9], [1.1, 1], {...clampOpts, easing: Easing.out(Easing.cubic)});
	return (
		<AbsoluteFill style={{opacity: f >= 42 ? 0.8 : 1}}>
			<div style={{position: 'absolute', top: 360, width: '100%', textAlign: 'center', transform: `scale(${s})`, fontFamily: FONT, textShadow: outline(11)}}>
				<div style={{fontSize: 70, color: 'white', lineHeight: 1}}>{renderMarked('STUCK AT [Y]5:58[/Y]')}</div>
				<div style={{fontSize: 270, color: 'white', lineHeight: 0.95}}>DAY 1</div>
			</div>
		</AbsoluteFill>
	);
};

// ---------------------------------------------------------------- sound
type Sfx = [file: string, at: number, vol: number];
const SFX: Sfx[] = [
	['ui_pop', T.hudIn, 0.3], ['impact_thud', 2.28, 0.6], ['whoosh_down', T.shot2 - 0.15, 0.3],
	['ui_slide', T.phone, 0.35], ['alarm_beep', 8.93, 0.35], ['alarm_beep', 9.2, 0.3], ['whoosh_down', T.shot1b - 0.15, 0.3],
	['ui_pop', T.cdIn, 0.45], ['ui_slide', T.cdDock, 0.35], ['whoosh_down', T.shot3 - 0.15, 0.3], ['sub_drop', T.tunnelHit, 0.6],
	['ui_slide', T.rule, 0.4], ['ui_pop', T.ruleDock + 0.3, 0.35], ['whoosh_down', T.shot4 - 0.15, 0.3],
	['counter_tick', T.safe[0], 0.6], ['counter_tick', T.safe[1], 0.6], ['counter_tick', T.safe[2], 0.6],
	['riser', T.sleep - 1.2, 0.25], ['sub_drop', T.sleep + 0.4, 0.4], ['digit_flip', T.tick, 0.6], ['impact_metal', T.tick, 0.55],
	['heartbeat', T.shot5, 0.65], ['ui_pop', T.cta, 0.4], ['ui_pop', T.choice, 0.45], ['ui_pop', T.end, 0.45],
];

const Sound: React.FC = () => {
	const {fps} = useVideoConfig();
	return (
		<>
			<Audio src={staticFile('audio/ep1/voice.wav')} />
			<Audio src={staticFile('audio/sfx/drone_dread.wav')} loop volume={(f) => interpolate(f, [0, 15, sec(T.total) - 30, sec(T.total)], [0, 0.17, 0.17, 0], clampOpts)} />
			<Audio src={staticFile('audio/sfx/night_ambience.wav')} loop volume={(f) => interpolate(f, [0, 15, sec(T.total) - 30, sec(T.total)], [0, 0.22, 0.22, 0], clampOpts)} />
			{SFX.map(([file, at, vol], i) => (
				<Sequence key={i} from={Math.max(0, Math.round(at * fps))} layout="none">
					<Audio src={staticFile(`audio/sfx/${file}.wav`)} volume={vol} />
				</Sequence>
			))}
		</>
	);
};


const r = (t: number, base: number) => sec(t) - sec(base);

const Shelter: React.FC<{base: number; dim?: boolean; settled?: boolean}> = ({base, dim, settled}) => {
	const inside = 'sepia(0.55) saturate(1.4) brightness(0.92)';
	return (
		<AbsoluteFill>
			<Bg src="b4.jpg" grade={dim ? 'brightness(0.72)' : undefined} />
			<GlassFill rect={[500, 372, 425, 986]} from={r(26.0, base)} to={r(28.0, base)} />
			<Char src="c5.png" x={[[0, 610]]} y={[[0, 1352]]} h={[[0, 470]]} popAt={r(T.safe[0], base)} grade={inside} opacity={0.88} shadow={false} />
			<Char src="c4.png" x={[[0, 722]]} y={[[0, 1352]]} h={[[0, 450]]} popAt={r(T.safe[1], base)} grade={inside} opacity={0.88} shadow={false} />
			<Char src="c5.png" x={[[0, 835]]} y={[[0, 1352]]} h={[[0, 430]]} popAt={r(T.safe[2], base)} grade={inside} opacity={0.88} shadow={false} flip />
			<Char src="c2.png" x={settled ? [[0, 280]] : [[0, -200], [40, 280]]} y={[[0, 1720]]} h={[[0, 620]]} walk={settled ? [] : [[0, 40]]} hops={settled ? [] : T.safe.map((s) => r(s, base))} />
			<FrozenRain seed="s6" />
		</AbsoluteFill>
	);
};

const Woman: React.FC<{base: number; dim?: boolean}> = ({base, dim}) => {
	const a = r(34.16, base);
	const b = r(34.34, base);
	const c = r(34.55, base);
	// three snapping steps closer: she never "walks", she is just nearer each time you look
	const h: [number, number][] = [[0, 640], [a, 640], [a + 1, 780], [b, 780], [b + 1, 920], [c, 920], [c + 1, 1080]];
	return (
		<div style={{position: 'absolute', left: 145, top: 128, width: 815, height: 1442, overflow: 'hidden'}}>
			<div style={{position: 'absolute', left: -145, top: -128, width: 1080, height: 1920}}>
				<Char src="c6.png" x={[[0, 540]]} y={[[0, 1600]]} h={h} breathe={false} shadow={false} grade={dim ? 'brightness(0.35)' : 'brightness(0.72) sepia(0.25)'} />
			</div>
			<AbsoluteFill style={{background: 'rgba(255,120,40,0.16)', mixBlendMode: 'screen'}} />
			<FrozenRain seed="s8" />
		</div>
	);
};

// ---------------------------------------------------------------- episode
const Shot: React.FC<{from: number; to: number; children: React.ReactNode}> = ({from, to, children}) => (
	<Sequence from={sec(from)} durationInFrames={sec(to) - sec(from)}>{children}</Sequence>
);

export const Episode: React.FC = () => {
	const {fps} = useVideoConfig();
	const captions = React.useMemo(() => buildCaptions(CHUNKS, words, fps, sec(T.choice) - 1), [fps]);
	const d = (a: number, b: number) => sec(b) - sec(a);
	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			{/* S1 hook: frozen square, the hero is the only thing moving */}
			<Shot from={0} to={T.shot2}>
				<Bg src="b1.jpg" />
				<Char src="c7.png" x={[[0, 800]]} y={[[0, 820]]} h={[[0, 230]]} breathe={false} shadow={false} shake={[0, 999]} />
				<Char src="c5.png" x={[[0, 230]]} y={[[0, 1720]]} h={[[0, 600]]} breathe={false} />
				<Char src="c4.png" x={[[0, 870]]} y={[[0, 1660]]} h={[[0, 560]]} breathe={false} flip />
				<Char src="c1.png" x={[[0, 540]]} y={[[0, 2150], [75, 1790]]} h={[[0, 720], [75, 600]]} walk={[[0, 75]]} />
				<FrozenRain seed="s1" />
			</Shot>
			{/* S2 sleepwalkers: they breathe but never step; the hero walks past them */}
			<Shot from={T.shot2} to={T.phone}>
				<Bg src="b2.jpg" />
				<Char src="c4.png" x={[[0, 430]]} y={[[0, 1190]]} h={[[0, 300]]} grade="brightness(0.6)" flip />
				<Char src="c5.png" x={[[0, 640]]} y={[[0, 1260]]} h={[[0, 380]]} grade="brightness(0.68)" />
				<Char src="c4.png" x={[[0, 280]]} y={[[0, 1700]]} h={[[0, 760]]} />
				<Char src="c5.png" x={[[0, 820]]} y={[[0, 1640]]} h={[[0, 720]]} flip />
				<Char src="c1.png" x={[[0, 560], [120, 600]]} y={[[0, 2050], [120, 1420]]} h={[[0, 640], [120, 300]]} walk={[[0, 120]]} />
				<FrozenRain seed="s2" />
			</Shot>
			<Shot from={T.phone} to={T.shot1b}><Phone /></Shot>
			{/* S4 the rules of time: hero listens, panics on "survive" */}
			<Shot from={T.shot1b} to={T.shot3}>
				<Bg src="b1.jpg" />
				<Char src="c7.png" x={[[0, 800]]} y={[[0, 820]]} h={[[0, 230]]} breathe={false} shadow={false} shake={[0, 999]} />
				<Char src="c2.png" x={[[0, 540]]} y={[[0, 1700]]} h={[[0, 640]]} show={[0, r(13.84, T.shot1b) - 1]} />
				<Char src="c3.png" x={[[0, 540]]} y={[[0, 1700]]} h={[[0, 640]]} show={[r(13.84, T.shot1b), 999]} hops={[r(13.84, T.shot1b)]} shake={[r(13.84, T.shot1b), 999]} />
				<FrozenRain seed="s4" />
			</Shot>
			{/* S5 the tunnel: hero walks in, startles at "But" */}
			<Shot from={T.shot3} to={T.shot4}>
				<Bg src="b3.jpg" />
				<Char src="c1.png" x={[[0, -160], [50, 360]]} y={[[0, 1790]]} h={[[0, 600]]} walk={[[0, 50]]} hops={[r(T.tunnelHit, T.shot3)]} shake={[r(T.tunnelHit, T.shot3), r(T.tunnelHit, T.shot3) + 60]} />
				<Alert x={360} y={1150} at={r(T.tunnelHit, T.shot3)} />
				<FrozenRain seed="s5" />
			</Shot>
			{/* S6 build: glass packs up, sleepers carried in one by one */}
			<Shot from={T.shot4} to={T.tick}>
				<Shelter base={T.shot4} />
				<Sequence from={sec(T.sleep - T.shot4)}><Eyelids dur={d(T.sleep, T.tick)} /></Sequence>
			</Shot>
			<Shot from={T.tick} to={T.shot5}>
				<Bg src="b1.jpg" zoom={[1.9, 2.05, 52, 4]} />
				<Flash />
			</Shot>
			{/* S8 the woman: three jerky steps toward the glass */}
			<Shot from={T.shot5} to={T.cta}>
				<Bg src="b5.jpg" />
				<Woman base={T.shot5} />
				<HeartbeatVignette />
			</Shot>
			<Shot from={T.cta} to={T.choice}>
				<Shelter base={T.cta} dim settled />
				<FollowCta />
			</Shot>
			<Shot from={T.choice} to={T.total}>
				<Bg src="b5.jpg" grade="brightness(0.55) blur(2px)" />
				<Woman base={T.choice - 10} dim />
			</Shot>
			<Shot from={T.choice} to={T.end}><Choice /></Shot>
			<Shot from={T.end} to={T.total}><EndCard /></Shot>

			<Sequence from={sec(T.hudIn)} durationInFrames={sec(T.cta) - sec(T.hudIn)}><Hud /></Sequence>
			<Sequence from={0} durationInFrames={44}><TitleCard /></Sequence>
			<Sequence from={sec(T.rule)} durationInFrames={sec(T.ruleDock) + 14 - sec(T.rule)}><RuleCard /></Sequence>
			<Captions items={captions} />
			<Sound />
		</AbsoluteFill>
	);
};
