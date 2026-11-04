// Timing engine: turns an episode file (+ optional voice timings) into a
// deterministic renderFrame(t). Beats last as long as their voice-over.
import { SCENES as BASE } from './scenes.js';
import { AI_SCENES } from './scenes-ai.js';
import { scanlines, glitch } from './ai.js';
import { drawLayers, preloadEmoji, preloadImages, collectAssets } from './layers.js';
const SCENES = {
  ...BASE, ...AI_SCENES,
  // generic data-driven scene (see layers.js)
  compose(ctx, p) {
    const cam = p.args.camera;
    ctx.save();
    if (cam) {
      const a = cam.from || [540, 960, 1], b = cam.to || a, u = p.u;
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const cx = a[0] + (b[0] - a[0]) * e, cy = a[1] + (b[1] - a[1]) * e, z = a[2] + (b[2] - a[2]) * e;
      let sx = 0, sy = 0;
      if (cam.shake) { const k = p.key(cam.shake); if (k != null && p.lt > k && p.lt < k + 0.5) { const f = 1 - (p.lt - k) / 0.5; sx = Math.sin(p.t * 70) * 14 * f; sy = Math.cos(p.t * 60) * 10 * f; } }
      ctx.translate(540 + sx, 960 + sy); ctx.scale(z, z); ctx.translate(-cx, -cy);
    }
    drawLayers(ctx, p, p.args.layers || []);
    ctx.restore();
  },
};
import { clamp, backOut, easeOut } from './draw.js';

const W = 1080, H = 1920;
const params = new URLSearchParams(location.search);
const RENDER = params.has('render');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

const WORDS_PER_SEC = 2.75; // used when no voice-over has been generated yet
const LEAD = 0.15;          // silence before the voice starts in each beat
const GAP = 0.3;            // silence after the voice ends

async function init() {
  const epPath = (params.get('episode') || 'episodes/part1.json').replace(/^\/+/, '');
  const ep = await (await fetch('/' + epPath)).json();
  const name = epPath.split('/').pop().replace(/\.json$/, '');
  let timings = {};
  try {
    const r = await fetch(`/out/voice/${name}/timings.json`, { cache: 'no-store' });
    if (r.ok) timings = await r.json();
  } catch { /* no voice yet */ }

  await Promise.all(['400 64px "Lilita One"', '900 64px Nunito', '800 64px Nunito', '700 64px "Chakra Petch"', '600 64px "Chakra Petch"', '900 64px Orbitron', '700 64px "Space Mono"', '400 64px Anton', '800 64px "Plus Jakarta Sans"', '700 64px "Plus Jakarta Sans"', 'italic 400 64px "Instrument Serif"', '400 64px "JetBrains Mono"', '700 64px "JetBrains Mono"'].map((f) => document.fonts.load(f)));
  { const { em, im } = collectAssets(ep); await Promise.all([preloadEmoji(em), preloadImages(im)]); }

  // ------------------------------------------------------------ timeline
  let t0 = 0;
  let lastFocus = null;
  const beats = ep.beats.map((b, i) => {
    const words = b.say.trim().split(/\s+/).length;
    const voice = timings[b.id]?.duration ?? words / WORDS_PER_SEC;
    const dur = Math.max(b.min ?? 1.6, LEAD + voice + GAP + (b.hold ?? 0));
    const beat = { ...b, index: i, start: t0, dur, voiceDur: voice, args: { ...(b.args || {}) } };
    if (b.scene === 'comments' && !beat.args.names) beat.args.names = ep.commenters || [];
    if (b.scene === 'wall' && !beat.args.names) beat.args.names = ep.start?.wall || [];
    if (b.scene === 'xsection' || b.scene === 'bunkerai') {
      if (beat.args.from == null) beat.args.from = lastFocus || beat.args.focus;
      lastFocus = beat.args.focus;
    }
    t0 += dur;
    return beat;
  });
  const END_HOLD = ep.endHold ?? 2.5;
  const duration = t0 + END_HOLD;

  // where (local time) a word/phrase is spoken inside a beat, proportional to text position
  function keyTime(beat, phrase) {
    if (phrase == null) return null;
    const i = beat.say.toLowerCase().indexOf(String(phrase).toLowerCase());
    if (i < 0) return null;
    return LEAD + (i / beat.say.length) * beat.voiceDur;
  }

  // ------------------------------------------------------------ story state
  const events = [];
  for (const b of beats) {
    for (const e of b.events || []) {
      const lt = e.at != null ? (keyTime(b, e.at) ?? 0) : 0;
      events.push({ ...e, t: b.start + lt });
    }
  }
  events.sort((a, b) => a.t - b.t);
  const start = ep.start || {};
  function stateAt(t) {
    const st = { days: start.days ?? 200, budget: start.budget ?? 1000000, budgetVisible: !!start.budgetVisible, features: {}, spends: [] };
    for (const f of start.features || []) st.features[f] = -100;
    let shownBudget = st.budget;
    for (const e of events) {
      if (e.t > t) break;
      if (e.days != null) st.days = e.days;
      if (e.showBudget) st.budgetVisible = true;
      if (e.build) st.features[e.build] = e.t;
      if (e.spend) {
        const before = st.budget;
        st.budget -= e.spend;
        const k = easeOut(clamp((t - e.t) / 0.9));
        shownBudget = before - e.spend * k;
        st.spends.push({ t: e.t, amount: e.spend, label: e.label });
      }
    }
    st.shownBudget = shownBudget;
    return st;
  }

  // ------------------------------------------------------------ audio cues
  const audio = [];
  const voice = [];
  const TYPERS = { 'ed-prompt': 22, 'ed-bubble': 18, 'ed-code': 40, 'ed-comment': 9 };
  beats.forEach((b, i) => {
    if (ep.style === 'editorial') {
      if (i > 0) audio.push({ t: b.start, type: 'swish' });
      for (const L of b.args?.layers || []) {
        const lt = L.at != null ? (keyTime(b, L.at) ?? 0) : (L.delay ?? 0);
        if (TYPERS[L.type]) {
          const chars = L.type === 'ed-code' ? (L.lines || []).join('').length : String(L.text || L.keyword || '').length;
          audio.push({ t: b.start + lt + 0.1, type: 'keys', dur: Math.min(2.5, chars / TYPERS[L.type]) });
        } else if (!['bg', 'ed-header', 'ed-headline', 'ed-paper', 'ed-qmarks'].includes(L.type)) audio.push({ t: b.start + lt, type: 'softpop' });
      }
    } else if (i > 0 && beats[i - 1].scene !== b.scene) audio.push({ t: b.start, type: 'whoosh' });
    voice.push({ id: b.id, t: b.start + LEAD });
    if (b.sfx) audio.push({ t: b.start, type: b.sfx });
    for (const k of b.keys || []) {
      const lt = keyTime(b, k.at) ?? 0;
      if (/stamp/.test(k.style || '')) audio.push({ t: b.start + lt, type: 'thud' });
      else if (k.style === 'big') audio.push({ t: b.start + lt, type: 'hit' });
    }
  });
  for (const e of events) {
    if (e.spend) audio.push({ t: e.t, type: 'cash' });
    if (e.build) audio.push({ t: e.t + 0.1, type: 'build' });
  }

  // ------------------------------------------------------------ overlay DOM
  const overlay = document.getElementById('overlay');
  if (ep.style) document.body.classList.add('style-' + ep.style);
  const HUD = ep.hud || {};
  overlay.innerHTML = `
    <div class="hud hud-days"><div class="hud-label">${esc(HUD.days?.label || ep.hudDaysLabel || 'DAYS LEFT')}</div><div class="hud-value" id="days"></div></div>
    <div class="hud hud-budget"><div class="hud-label">${esc(HUD.budget?.label || 'BUDGET')}</div><div class="hud-value money" id="budget"></div><div class="spend" id="spend"></div></div>
    <div class="hud-strip" id="strip"></div>
    <div class="series" id="series">${ep.style === 'editorial' ? '' : `${esc(ep.series || 'SERIES')} · PART ${ep.part || 1}`}</div>
    <div class="cta" id="cta"></div>`;
  const elDays = overlay.querySelector('#days');
  const elBudget = overlay.querySelector('#budget');
  const elSpend = overlay.querySelector('#spend');
  const elCta = overlay.querySelector('#cta');
  const hudDays = overlay.querySelector('.hud-days');
  const hudBudget = overlay.querySelector('.hud-budget');
  if (ep.choice) {
    elCta.innerHTML = `<div class="cta-title">COMMENT YOUR CHOICE</div>
      <div class="cta-opts">${ep.choice.options.map((o) => `<span class="opt ${o.color || ''}">${esc(o.short || o.label)}</span>`).join('<span class="or">or</span>')}</div>
      <div class="cta-next">${esc(ep.ctaNext || `PART ${(ep.part || 1) + 1} DEPENDS ON YOU`)}</div>`;
  }

  const keyEls = [];
  beats.forEach((b) => {
    (b.keys || []).forEach((k, j) => {
      const el = document.createElement('div');
      el.className = `key slot-${k.slot || 'lower'} style-${k.style || 'white'}`;
      el.innerHTML = `<span${k.speaker ? ` style="border-left: 12px solid ${esc(k.speaker)}; padding-left: 22px"` : ''}>${k.html || esc(k.show)}</span>`;
      overlay.appendChild(el);
      const lt = keyTime(b, k.at) ?? (k.offset ?? 0);
      keyEls.push({ el, beat: b, slot: k.slot || 'lower', tIn: b.start + lt, tOut: b.start + b.dur + (k.carry ?? 0), j, instant: !!k.instant });
    });
  });
  // a key is replaced by the next key in the same slot
  for (const a of keyEls) {
    const next = keyEls.filter((b) => b.slot === a.slot && b.tIn > a.tIn).sort((x, y) => x.tIn - y.tIn)[0];
    if (next && next.tIn < a.tOut) a.tOut = next.tIn;
  }

  // ------------------------------------------------------------ render
  const canvas = document.getElementById('gl');
  const ctx = canvas.getContext('2d');

  function beatAt(t) {
    let b = beats[0];
    for (const x of beats) if (x.start <= t) b = x;
    return b;
  }

  let coverEl = null;
  function renderFrame(t) {
    if (coverEl) { coverEl.remove(); coverEl = null; }
    const b = beatAt(t);
    const lt = t - b.start;
    const st = stateAt(t);
    const p = {
      t, lt, d: b.dur, u: clamp(lt / b.dur), st, args: b.args, beat: b, style: ep.style,
      key: (w) => keyTime(b, w),
    };
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    // punch-in transition when the scene type changes
    const prev = beats[b.index - 1];
    // a new cut: scene type changes, or a compose beat that is not marked "continue": true
    const changed = !prev || prev.scene !== b.scene || (b.scene === 'compose' && !b.continue);
    if (changed && ep.style !== 'editorial') {
      const k = clamp(lt / 0.32);
      const s = 1.07 - 0.07 * easeOut(k);
      ctx.translate(540, 960); ctx.scale(s, s); ctx.translate(-540, -960);
    }
    (SCENES[b.scene] || SCENES.ai)(ctx, p);
    ctx.restore();
    if (ep.style !== 'ai' && ep.style !== 'editorial' && changed && lt < 0.18) { ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - lt / 0.18)})`; ctx.fillRect(0, 0, W, H); }
    if (ep.style === 'editorial' && ep.mascot !== false) {
      if (b.mascot !== false) drawLayers(ctx, p, [{ type: 'ed-mascot', x: b.mascotX ?? ep.mascot?.x ?? 735, y: b.mascotY ?? ep.mascot?.y ?? 1360, anim: 'none', loop: 'bob', color: ep.mascot?.color, mood: b.mascotMood }]);
    }
    if (ep.style === 'ai') {
      // AI look: glitch on every cut (and on demand), scanlines + grain everywhere
      let g = changed && b.index > 0 ? clamp(1 - lt / 0.22) : 0;
      if (b.glitchAt) { const kt = keyTime(b, b.glitchAt); if (kt != null) g = Math.max(g, clamp(1 - Math.abs(lt - kt) / 0.25)); }
      glitch(ctx, canvas, t, g);
      scanlines(ctx, t);
    }
    // vignette (not on the clean editorial paper look)
    if (ep.style !== 'editorial' && ep.vignette !== false) {
      const g = ctx.createRadialGradient(540, 960, 500, 540, 960, 1200);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // HUD
    hudDays.style.display = HUD.days === false || ep.style === 'editorial' ? 'none' : '';
    if (HUD.budget === false || ep.style === 'editorial') hudBudget.style.display = 'none';
    elDays.textContent = st.days;
    hudDays.classList.toggle('danger', st.days <= 50);
    elBudget.textContent = money(st.shownBudget);
    hudBudget.style.opacity = st.budgetVisible ? '1' : '0';
    const last = st.spends[st.spends.length - 1];
    if (last && t - last.t < 1.6) {
      const k = clamp((t - last.t) / 0.25);
      elSpend.style.opacity = String(Math.min(k, clamp((last.t + 1.6 - t) / 0.3)));
      elSpend.style.transform = `translateY(${(1 - k) * -20}px) scale(${backOut(k)})`;
      elSpend.textContent = '-' + money(last.amount);
    } else elSpend.style.opacity = '0';

    for (const k of keyEls) {
      if (t < k.tIn || t > k.tOut + 0.2) { k.el.style.opacity = '0'; continue; }
      const a = k.instant ? 1 : clamp((t - k.tIn) / 0.3);
      const out = clamp((t - k.tOut) / 0.2);
      k.el.style.opacity = String(Math.min(1, a * 2) * (1 - out));
      const rot = k.el.classList.contains('style-stamp-red') || k.el.classList.contains('style-stamp-green') ? -6 : 0;
      k.el.style.transform = `scale(${(0.5 + 0.5 * backOut(a)) * (1 - 0.1 * out)}) rotate(${rot}deg)`;
    }
    const endT = t - (duration - END_HOLD - (beats[beats.length - 1].dur * 0.35));
    const c = clamp(endT / 0.4);
    elCta.style.opacity = ep.choice ? String(c) : '0';
    elCta.style.transform = `translateY(${(1 - c) * 40}px)`;
  }

  window.__ep = {
    ready: true, duration, name,
    audio: audio.sort((a, b) => a.t - b.t),
    voice,
    bed: ep.music ?? (ep.style === 'editorial' ? 'none' : 'drone'),
    beats: beats.map((b) => ({ id: b.id, start: b.start, dur: b.dur, say: b.say })),
    hasVoice: Object.keys(timings).length > 0,
    renderer: 'Canvas 2D',
    renderFrame,
    renderCover() {
      renderFrame(ep.coverTime ?? 1.2);
      if (ep.style === 'editorial') {
        // clean paper + mascot behind the cover title
        const p0 = { t: 0, lt: 0, d: 1, u: 0, st: stateAt(0), args: {}, beat: beats[0], key: () => null };
        ctx.clearRect(0, 0, W, H);
        drawLayers(ctx, p0, [{ type: 'bg', preset: 'paper' }]);
        if (ep.mascot !== false) drawLayers(ctx, p0, [{ type: 'ed-mascot', x: 800, y: 1400, s: 1.6, anim: 'none', color: ep.mascot?.color }]);
      }
      const c = document.createElement('div');
      coverEl = c;
      c.className = 'cover';
      c.innerHTML = ep.cover?.html || `<div class="cover-part">PART ${ep.part || 1}</div><div class="cover-title">${esc(ep.cover?.title || ep.series || 'AI TAKEOVER')}</div>`;
      overlay.appendChild(c);
      for (const k of keyEls) k.el.style.opacity = '0';
      elCta.style.opacity = '0';
    },
  };

  if (!RENDER) {
    const stage = document.getElementById('stage');
    const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / W, innerHeight / H)})`; };
    fit(); addEventListener('resize', fit);
    const fixed = params.get('t');
    if (fixed != null) { renderFrame(parseFloat(fixed)); return; }
    let s0 = performance.now();
    addEventListener('click', () => { s0 = performance.now(); });
    const loop = () => { renderFrame(((performance.now() - s0) / 1000) % duration); requestAnimationFrame(loop); };
    loop();
  }
}

init().catch((e) => { console.error(e); window.__ep = { ready: false, error: String(e && e.stack || e) }; });
