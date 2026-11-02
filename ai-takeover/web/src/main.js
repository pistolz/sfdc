// Timing engine: turns an episode file (+ optional voice timings) into a
// deterministic renderFrame(t). Beats last as long as their voice-over.
import { SCENES } from './scenes.js';
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

  await Promise.all(['400 64px "Lilita One"', '900 64px Nunito', '800 64px Nunito'].map((f) => document.fonts.load(f)));

  // ------------------------------------------------------------ timeline
  let t0 = 0;
  let lastFocus = null;
  const beats = ep.beats.map((b, i) => {
    const words = b.say.trim().split(/\s+/).length;
    const voice = timings[b.id]?.duration ?? words / WORDS_PER_SEC;
    const dur = Math.max(b.min ?? 1.6, LEAD + voice + GAP + (b.hold ?? 0));
    const beat = { ...b, index: i, start: t0, dur, voiceDur: voice, args: { ...(b.args || {}) } };
    if (b.scene === 'xsection') {
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
  beats.forEach((b, i) => {
    if (i > 0 && beats[i - 1].scene !== b.scene) audio.push({ t: b.start, type: 'whoosh' });
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
  overlay.innerHTML = `
    <div class="hud hud-days"><div class="hud-label">${esc(ep.hudDaysLabel || 'DAYS UNTIL AI TAKEOVER')}</div><div class="hud-value" id="days"></div></div>
    <div class="hud hud-budget"><div class="hud-label">BUDGET</div><div class="hud-value money" id="budget"></div><div class="spend" id="spend"></div></div>
    <div class="series" id="series">${esc(ep.series || 'AI TAKEOVER')} · PART ${ep.part || 1}</div>
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
      <div class="cta-next">PART ${(ep.part || 1) + 1} DEPENDS ON YOU</div>`;
  }

  const keyEls = [];
  beats.forEach((b) => {
    (b.keys || []).forEach((k, j) => {
      const el = document.createElement('div');
      el.className = `key slot-${k.slot || 'lower'} style-${k.style || 'white'}`;
      el.innerHTML = `<span>${k.html || esc(k.show)}</span>`;
      overlay.appendChild(el);
      const lt = keyTime(b, k.at) ?? (k.offset ?? 0);
      keyEls.push({ el, beat: b, slot: k.slot || 'lower', tIn: b.start + lt, tOut: b.start + b.dur + (k.carry ?? 0), j });
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
      t, lt, d: b.dur, u: clamp(lt / b.dur), st, args: b.args, beat: b,
      key: (w) => keyTime(b, w),
    };
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    // punch-in transition when the scene type changes
    const prev = beats[b.index - 1];
    const changed = !prev || prev.scene !== b.scene;
    if (changed) {
      const k = clamp(lt / 0.32);
      const s = 1.07 - 0.07 * easeOut(k);
      ctx.translate(540, 960); ctx.scale(s, s); ctx.translate(-540, -960);
    }
    (SCENES[b.scene] || SCENES.ai)(ctx, p);
    ctx.restore();
    if (changed && lt < 0.18) { ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - lt / 0.18)})`; ctx.fillRect(0, 0, W, H); }
    // vignette
    const g = ctx.createRadialGradient(540, 960, 500, 540, 960, 1200);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // HUD
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
      const a = clamp((t - k.tIn) / 0.3);
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
    beats: beats.map((b) => ({ id: b.id, start: b.start, dur: b.dur, say: b.say })),
    hasVoice: Object.keys(timings).length > 0,
    renderer: 'Canvas 2D',
    renderFrame,
    renderCover() {
      renderFrame(ep.coverTime ?? 1.2);
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
