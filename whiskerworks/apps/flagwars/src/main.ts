import "@fontsource-variable/unbounded";
import "@fontsource-variable/figtree";
import "../../../packages/brand/tokens.css";
import "./styles.css";
import type { GameState, GeoData, CountryState } from "./types";
import { decodeWorld, flagEmoji, type World } from "./geo";
import { search, normalize, type SearchItem } from "./search";
import { Globe } from "./globe";
import { initAnalytics } from "../../../packages/brand/analytics";
import { initNetwork } from "../../../packages/brand/network";

initNetwork("flagwars");
initAnalytics("Flag Wars");

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (n: number) => n.toLocaleString("en-US");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const app = $("app");
let state: GameState;
let world: World;
let globe: Globe | null = null;
let items: SearchItem[] = [];
let selected: { kind: "country" | "handle"; key: string } | null = null;

/* ------------------------------------------------------------------ boot */
async function loadJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

async function boot() {
  try {
    const [s, g] = await Promise.all([loadJSON<GameState>("/data/state.json"), loadJSON<GeoData>("/geo/world-hex.json")]);
    state = s;
    world = decodeWorld(g);
  } catch (e) {
    console.error(e);
    $("loader").innerHTML = `<span>Couldn't load the map. <a href="">Try again</a></span>`;
    return;
  }
  buildIndex();
  renderStatic();

  if (webglAvailable()) {
    try {
      globe = new Globe($<HTMLCanvasElement>("globe"), world, {
        reducedMotion,
        onPick: (code) => (code ? select({ kind: "country", key: code }) : undefined),
        onFrame: placeLabels,
      });
      globe.setState(state, true);
      globe.start();
      document.addEventListener("visibilitychange", () => (document.hidden ? globe?.stop() : globe?.start()));
    } catch (e) {
      console.warn("WebGL failed, using list view", e);
      globe = null;
    }
  }
  if (!globe) {
    app.classList.add("no-webgl");
    openDrawer("drawer-board", false);
  }
  app.dataset.state = "ready";
  $("loader").remove();

  // deep links
  const q = new URLSearchParams(location.search);
  const c = q.get("c")?.toUpperCase();
  const u = q.get("u") && normalize(q.get("u")!);
  if (c && world.byCode.has(c)) select({ kind: "country", key: c }, { instant: true });
  else if (u) select({ kind: "handle", key: u }, { instant: true });
  else if (q.get("q")?.trim()) {
    // Free text from the studio site ("Canada", "@name"): jump to the best match or show suggestions.
    const text = q.get("q")!.trim();
    const { results, didYouMean } = search(items, text, 1);
    const best = results[0] ?? didYouMean;
    if (best) select({ kind: best.kind, key: best.key }, { instant: true });
    else { input.value = text; showSuggestions(); }
  }
  else if (globe && state.leaderboard[0]) globe.focus(state.leaderboard[0].code, { close: false, instant: true });

  setInterval(refresh, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}

async function refresh() {
  try {
    const next = await loadJSON<GameState>("/data/state.json");
    if (next.updatedAt === state.updatedAt) return;
    state = next;
    buildIndex();
    renderStatic();
    globe?.setState(state, true);
    if (selected) renderPanel();
    toast("The map just updated");
  } catch { /* offline: keep current */ }
}

/* ------------------------------------------------------------------ static UI */
function buildIndex() {
  items = [
    ...world.countries.map((c) => ({ kind: "country" as const, key: c.code, label: c.name, sub: subFor(c.code), terms: [normalize(c.name), c.code.toLowerCase()] })),
    ...Object.entries(state.handles).map(([h, v]) => ({ kind: "handle" as const, key: h, label: `@${h}`, sub: `${fmt(v.total)} flag${v.total === 1 ? "" : "s"}`, terms: [h] })),
  ];
}
function subFor(code: string) {
  const c = state.countries[code];
  return c ? `LV${c.level} · ${fmt(c.flags)} flags · #${state.leaderboard.findIndex((r) => r.code === code) + 1}` : "No flags yet";
}
const flagImg = (code: string, cls = "flag") => `<img class="${cls}" src="/flags/${esc(code)}.svg" alt="" width="28" height="21" loading="lazy" />`;

function renderStatic() {
  $("stat-day").textContent = fmt(state.day);
  $("stat-flags").textContent = fmt(state.totalFlags);
  $("stat-countries").textContent = fmt(state.totalCountries);

  $("top3-list").innerHTML = state.leaderboard.slice(0, 3).map((r) => `
    <li><button type="button" data-country="${esc(r.code)}"><span class="rank r${r.rank}">${r.rank}</span>${flagImg(r.code)}<span class="name">${esc(r.name)}</span><span class="lv">LV ${r.level}</span></button></li>`).join("")
    || `<li class="empty">No flags yet — be the first!</li>`;

  renderBoard("");
  $("sr-board").innerHTML = state.leaderboard.map((r) => `<li>${esc(r.name)}: level ${r.level}, ${r.flags} flags, founded by ${esc(r.founder)}</li>`).join("");

  // episodes
  $("episode-list").innerHTML = state.episodes.map((e) => `
    <li class="episode">
      <div class="ep-day">Day ${e.day}</div>
      <div class="ep-body">
        <h3>${esc(e.title)}</h3>
        ${e.date ? `<time datetime="${esc(e.date)}">${new Date(e.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>` : ""}
        ${e.summary ? `<p>${esc(e.summary)}</p>` : ""}
        <div class="ep-links">${socialLinks(e.links || {}, "Watch on ")}</div>
      </div>
    </li>`).join("") || `<li class="empty">Day 1 drops soon.</li>`;

  // CTA + socials
  const latest = state.links.latestEpisode || state.links.instagram || state.links.tiktok || state.links.youtube;
  const cta = $<HTMLAnchorElement>("cta-episode");
  if (latest) { cta.href = latest; cta.hidden = false; } else cta.hidden = true;
  $("cta-episode-text").textContent = `Comment on Day ${state.day}`;
  $("socials").innerHTML = socialLinks(state.links, "Flag Wars on ", true);

  const ago = timeAgo(state.updatedAt);
  $("updated").textContent = `Updated ${ago}. Commented recently?`;
}

const ICONS: Record<string, string> = {
  instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM21 8.1c-.1-1.5-.4-2.8-1.5-3.9S17 2.8 15.5 2.7C14 2.6 10 2.6 8.5 2.7 7 2.8 5.6 3.1 4.5 4.2S3 6.6 3 8.1c-.1 1.5-.1 6.3 0 7.8.1 1.5.4 2.8 1.5 3.9s2.4 1.4 3.9 1.5c1.5.1 6.4.1 7.9 0 1.5-.1 2.8-.4 3.9-1.5s1.4-2.4 1.5-3.9c.1-1.5.1-6.3 0-7.8Zm-2 9.5a3 3 0 0 1-1.7 1.7c-1.2.5-4 .4-5.3.4s-4.1.1-5.3-.4a3 3 0 0 1-1.7-1.7c-.5-1.2-.4-4-.4-5.3s-.1-4.1.4-5.3A3 3 0 0 1 6.7 5.3c1.2-.5 4-.4 5.3-.4s4.1-.1 5.3.4a3 3 0 0 1 1.7 1.7c.5 1.2.4 4 .4 5.3s.1 4.1-.4 5.3Z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.4 7.4 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6Z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3Z"/></svg>`,
};
const NAMES: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
function socialLinks(links: Partial<Record<"instagram" | "tiktok" | "youtube" | "latestEpisode", string>>, prefix: string, iconOnly = false) {
  return (["instagram", "tiktok", "youtube"] as const).filter((k) => links[k]).map((k) =>
    `<a class="social ${iconOnly ? "icon-only" : ""}" href="${esc(links[k])}" target="_blank" rel="noopener" aria-label="${prefix}${NAMES[k]}">${ICONS[k]}${iconOnly ? "" : `<span>${NAMES[k]}</span>`}</a>`).join("");
}

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function renderBoard(filter: string) {
  const f = normalize(filter);
  const rows = state.leaderboard.filter((r) => !f || normalize(r.name).includes(f) || r.code.toLowerCase() === f);
  $("board-list").innerHTML = rows.map((r) => `
    <li><button type="button" data-country="${esc(r.code)}">
      <span class="rank r${r.rank}">${r.rank}</span>${flagImg(r.code)}
      <span class="b-main"><span class="name">${esc(r.name)}</span><span class="bar" style="--p:${(r.progress / r.next) * 100}%;--c:${esc(r.color)}"><i></i></span></span>
      <span class="b-side"><span class="lv">LV ${r.level}</span><span class="flags">${fmt(r.flags)} <small>flags</small></span></span>
    </button></li>`).join("") || `<li class="empty">${f ? "No country matches." : "No flags yet — the first comment founds a country."}</li>`;
}

/* ------------------------------------------------------------------ labels over the globe */
const labelEls = new Map<string, HTMLElement>();
function placeLabels() {
  if (!globe) return;
  const want = state.leaderboard.slice(0, innerWidth < 700 ? 5 : 8).map((r) => r.code);
  if (selected?.kind === "country" && !want.includes(selected.key)) want.unshift(selected.key);
  else if (selected?.kind === "country") { want.splice(want.indexOf(selected.key), 1); want.unshift(selected.key); }
  const layer = $("labels");
  // keep labels inside the free band between the HUD and the dock/panel, and off the top-3 card
  const minY = $("hud-top-anchor").getBoundingClientRect().bottom + 4;
  const panel = $("panel");
  const maxY = !panel.hidden && innerWidth < 760 ? panel.getBoundingClientRect().top - 4 : $("search-form").getBoundingClientRect().top - 4;
  const top3 = $("top3");
  const placed: DOMRect[] = app.classList.contains("has-panel") ? [] : [top3.getBoundingClientRect()];
  const seen = new Set<string>();
  for (const code of want) {
    const p = globe.project(code);
    let el = labelEls.get(code);
    if (!el) {
      el = document.createElement("div");
      el.className = "label";
      layer.appendChild(el);
      labelEls.set(code, el);
    }
    const c = state.countries[code];
    const isSel = selected?.kind === "country" && selected.key === code;
    const html = c
      ? `<b>${esc(c.name)} · LV${c.level}</b><span>★ @${esc(c.founder)}</span>`
      : `<b>${esc(world.byCode.get(code)!.country.name)}</b><span>Unclaimed</span>`;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
    el.classList.toggle("is-selected", isSel);
    seen.add(code);
    if (!p || !p.visible) { el.classList.remove("on"); continue; }
    const w = el.offsetWidth || 120, h = el.offsetHeight || 40;
    const W = layer.clientWidth;
    p.x = Math.min(W - w / 2 - 6, Math.max(w / 2 + 6, p.x));
    const r = new DOMRect(p.x - w / 2, p.y - h - 8, w, h);
    if (r.top < minY || r.bottom + 8 > maxY) { el.classList.remove("on"); continue; }
    const hit = !isSel && placed.some((q) => !(r.right < q.left || r.left > q.right || r.bottom < q.top || r.top > q.bottom));
    if (hit) { el.classList.remove("on"); continue; }
    placed.push(r);
    el.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0) translate(-50%, -100%) translate(0, -8px)`;
    el.style.opacity = String(Math.min(1, (p.facing - 0.18) * 5));
    el.classList.add("on");
  }
  for (const [code, el] of labelEls) if (!seen.has(code)) el.classList.remove("on");
}

/* ------------------------------------------------------------------ selection & panels */
function select(sel: { kind: "country" | "handle"; key: string } | null, opts: { instant?: boolean } = {}) {
  selected = sel;
  const url = new URL(location.href);
  url.searchParams.delete("c"); url.searchParams.delete("u");
  if (sel) url.searchParams.set(sel.kind === "country" ? "c" : "u", sel.key);
  history.replaceState(null, "", url);
  if (!sel) { $("panel").hidden = true; app.classList.remove("has-panel"); globe?.setInset(0, 0); globe?.focus(null); return; }
  renderPanel();
  $("panel").hidden = false;
  app.classList.add("has-panel");
  syncInset();
  if (sel.kind === "country") globe?.focus(sel.key, { instant: opts.instant });
  else {
    const h = state.handles[sel.key];
    const top = h && Object.entries(h.countries).sort((a, b) => b[1] - a[1])[0];
    if (top) globe?.focus(top[0], { instant: opts.instant });
  }
  $("panel-close").focus({ preventScroll: true });
}

function syncInset() {
  if (!globe || $("panel").hidden) return;
  const r = $("panel").getBoundingClientRect();
  if (innerWidth >= 760) globe.setInset(innerWidth - r.left, 0);
  else globe.setInset(0, Math.max(0, innerHeight - r.top - 90)); // the header area above the globe absorbs ~90px
}
addEventListener("resize", syncInset);

function renderPanel() {
  if (!selected) return;
  const body = $("panel-body");
  if (selected.kind === "country") {
    const code = selected.key;
    const geo = world.byCode.get(code)!;
    const c: CountryState | undefined = state.countries[code];
    const name = geo.country.name;
    const commentText = `${flagEmoji(code)} ${name}`;
    const rank = state.leaderboard.findIndex((r) => r.code === code) + 1;
    say(c ? `${name}, rank ${rank}, level ${c.level}, ${c.flags} flags.` : `${name} has no flags yet.`);
    body.innerHTML = `
      <div class="p-head">
        <img class="p-flag" src="/flags/${esc(code)}.svg" alt="Flag of ${esc(name)}" width="64" height="48" />
        <div>
          <p class="p-kicker">${c ? `Rank #${rank} · Founded day ${c.foundedDay}` : "Unclaimed territory"}</p>
          <h2 id="panel-title">${esc(name)} ${c ? `<span class="lv-badge">LV${c.level}</span>` : ""}</h2>
        </div>
      </div>
      ${c ? `
        <div class="progress" role="progressbar" aria-label="Progress to level ${c.level + 1}" aria-valuemin="0" aria-valuemax="${c.next}" aria-valuenow="${c.progress}">
          <div class="progress-bar" style="--p:${(c.progress / c.next) * 100}%;--c:${esc(c.color)}"><i></i></div>
          <span><b>${fmt(c.progress)}</b>/${fmt(c.next)} to LV${c.level + 1}</span>
        </div>
        <dl class="p-stats">
          <div><dt>Flags</dt><dd>${fmt(c.flags)}</dd></div>
          <div><dt>Commanders</dt><dd>${fmt(c.commanderCount)}</dd></div>
          <div><dt>Day</dt><dd>${fmt(state.day)}</dd></div>
        </dl>
        <button type="button" class="founder" data-handle="${esc(c.founder)}" ${c.founder === "anonymous" ? "disabled" : ""}>
          <span class="founder-tag">${esc(name)} · Founder</span><span class="founder-handle">@${esc(c.founder)}</span>
        </button>
        ${c.topCommanders.length ? `<h3 class="p-h3">Top commanders</h3><ol class="commanders">${c.topCommanders.map((t, i) => `
          <li><button type="button" data-handle="${esc(t.handle)}"><span class="rank">${i + 1}</span><span class="name">@${esc(t.handle)}</span><span class="flags">${fmt(t.flags)} 🚩</span></button></li>`).join("")}</ol>` : ""}
      ` : `<p class="p-empty">No flags yet. The first comment for ${esc(name)} makes you its <b>founder</b> — your name goes on the map.</p>`}
      <div class="p-cta">
        <p>Plant a flag for ${esc(name)}: comment this on the latest episode.</p>
        <div class="copy-row">
          <code>${esc(commentText)}</code>
          <button type="button" class="btn btn-gold" data-copy="${esc(commentText)}">Copy</button>
        </div>
        <div class="p-actions">
          ${state.links.latestEpisode ? `<a class="btn btn-cta" href="${esc(state.links.latestEpisode)}" target="_blank" rel="noopener">Open Day ${state.day} ↗</a>` : ""}
          <button type="button" class="btn btn-ghost" data-share>Share</button>
        </div>
      </div>`;
  } else {
    const h = selected.key;
    const u = state.handles[h];
    if (!u) {
      const { didYouMean } = search(items.filter((i) => i.kind === "handle"), h);
      say(`No flags for @${h} yet.`);
      body.innerHTML = `
        <div class="p-head"><div class="avatar" aria-hidden="true">@</div><div><p class="p-kicker">Commander</p><h2 id="panel-title">@${esc(h)}</h2></div></div>
        <p class="p-empty">No flags for <b>@${esc(h)}</b> yet. Commented recently? Your flag is added at the next daily update.</p>
        ${didYouMean ? `<p class="dym">Did you mean <button type="button" class="link-btn" data-handle="${esc(didYouMean.key)}">${esc(didYouMean.label)}</button>?</p>` : ""}
        <div class="p-actions">${state.links.latestEpisode ? `<a class="btn btn-cta" href="${esc(state.links.latestEpisode)}" target="_blank" rel="noopener">Comment on Day ${state.day} ↗</a>` : ""}</div>`;
      return;
    }
    const rows = Object.entries(u.countries).sort((a, b) => b[1] - a[1]);
    say(`@${h}: ${u.total} flags in ${rows.length} countries.`);
    body.innerHTML = `
      <div class="p-head"><div class="avatar" aria-hidden="true">${esc(h[0]?.toUpperCase() || "@")}</div>
        <div><p class="p-kicker">Commander · ${fmt(u.total)} flag${u.total === 1 ? "" : "s"}</p><h2 id="panel-title">@${esc(h)}</h2></div></div>
      ${u.founderOf.length ? `<div class="badges">${u.founderOf.map((c) => `<span class="badge">${flagImg(c, "flag sm")} Founder of ${esc(world.byCode.get(c)?.country.name ?? c)}</span>`).join("")}</div>` : ""}
      <h3 class="p-h3">Flags planted</h3>
      <ol class="commanders">${rows.map(([c, n]) => `
        <li><button type="button" data-country="${esc(c)}">${flagImg(c)}<span class="name">${esc(world.byCode.get(c)?.country.name ?? c)}</span><span class="flags">${fmt(n)} 🚩</span></button></li>`).join("")}</ol>
      <div class="p-actions">
        ${state.links.latestEpisode ? `<a class="btn btn-cta" href="${esc(state.links.latestEpisode)}" target="_blank" rel="noopener">Plant another flag ↗</a>` : ""}
        <button type="button" class="btn btn-ghost" data-share>Share</button>
      </div>
      <p class="fine">Not you, or want your name off? <a href="mailto:bonjour@tazgo.ca?subject=Flag%20Wars%20opt-out">Message us</a>.</p>`;
  }
}

/* ------------------------------------------------------------------ search combobox */
const input = $<HTMLInputElement>("search-input");
const list = $<HTMLUListElement>("search-list");
let active = -1;
let current: SearchItem[] = [];

function showSuggestions() {
  const q = input.value;
  const { results, didYouMean } = search(items, q, 7);
  current = results.length ? results : didYouMean ? [didYouMean] : [];
  active = current.length ? 0 : -1;
  if (!q.trim()) { closeList(); return; }
  list.innerHTML = current.length
    ? (results.length ? "" : `<li class="dym-head" role="presentation">Did you mean</li>`) + current.map((it, i) => `
      <li role="option" id="opt-${i}" aria-selected="${i === active}" data-i="${i}">
        ${it.kind === "country" ? flagImg(it.key) : `<span class="avatar sm" aria-hidden="true">@</span>`}
        <span class="o-main">${esc(it.label)}</span><span class="o-sub">${esc(it.sub)}</span>
      </li>`).join("")
    : `<li class="none" role="presentation">${q.trim().startsWith("@") || !/\s/.test(q) ? `No match. Commented recently? The map updates daily.` : "No match."}</li>`;
  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-activedescendant", active >= 0 ? `opt-${active}` : "");
}
function closeList() { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); }
function choose(it: SearchItem | undefined) {
  if (!it) {
    const q = normalize(input.value);
    if (q) select({ kind: "handle", key: q });
    closeList();
    return;
  }
  select({ kind: it.kind, key: it.key });
  input.value = "";
  input.blur();
  closeList();
}
input.addEventListener("input", showSuggestions);
input.addEventListener("focus", () => input.value && showSuggestions());
input.addEventListener("keydown", (e) => {
  if (list.hidden) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!current.length) return;
    active = (active + (e.key === "ArrowDown" ? 1 : -1) + current.length) % current.length;
    list.querySelectorAll("[role=option]").forEach((o, i) => o.setAttribute("aria-selected", String(i === active)));
    input.setAttribute("aria-activedescendant", `opt-${active}`);
  } else if (e.key === "Escape") closeList();
});
list.addEventListener("pointerdown", (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
  if (li) { e.preventDefault(); choose(current[Number(li.dataset.i)]); }
});
$("search-form").addEventListener("submit", (e) => { e.preventDefault(); if (input.value.trim()) choose(current[active]); });
document.addEventListener("click", (e) => { if (!(e.target as HTMLElement).closest(".search")) closeList(); });

/* ------------------------------------------------------------------ drawers, share, copy */
let lastFocus: HTMLElement | null = null;
function openDrawer(id: string, modal = true) {
  lastFocus = document.activeElement as HTMLElement;
  const d = $(id);
  d.hidden = false;
  d.dataset.modal = String(modal);
  requestAnimationFrame(() => d.classList.add("open"));
  if (modal) (d.querySelector("input, button") as HTMLElement | null)?.focus();
}
function closeDrawer(d: HTMLElement) {
  if (app.classList.contains("no-webgl") && d.id === "drawer-board") return;
  d.classList.remove("open");
  setTimeout(() => (d.hidden = true), reducedMotion ? 0 : 260);
  lastFocus?.focus({ preventScroll: true });
}
$("btn-board").addEventListener("click", () => openDrawer("drawer-board"));
$("btn-episodes").addEventListener("click", () => openDrawer("drawer-episodes"));
$("board-filter").addEventListener("input", (e) => renderBoard((e.target as HTMLInputElement).value));
document.querySelectorAll<HTMLElement>(".drawer").forEach((d) => {
  d.addEventListener("click", (e) => { if (e.target === d || (e.target as HTMLElement).closest("[data-close]")) closeDrawer(d); });
});
$("panel-close").addEventListener("click", () => select(null));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const open = [...document.querySelectorAll<HTMLElement>(".drawer.open")].pop();
  if (open) closeDrawer(open);
  else if (selected) select(null);
});

async function share() {
  const url = location.href;
  const c = selected?.kind === "country" ? state.countries[selected.key] : null;
  const title = c ? `${c.name} is LV${c.level} in Flag Wars` : selected?.kind === "handle" ? `@${selected.key} in Flag Wars` : "Flag Wars · Who conquers the world?";
  if (navigator.share) {
    try { await navigator.share({ title, text: "1 comment = 1 flag. Help us conquer the world 🌍", url }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
  }
  await copy(url, "Link copied");
}
async function copy(text: string, msg = "Copied") {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { toast("Press and hold to copy"); }
}
$("btn-share").addEventListener("click", share);

// delegated actions inside panels / lists
document.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-country],[data-handle],[data-copy],[data-share]");
  if (!t || t.closest("#search-list")) return;
  if (t.dataset.country) {
    const d = t.closest<HTMLElement>(".drawer");
    if (d && !app.classList.contains("no-webgl")) closeDrawer(d);
    select({ kind: "country", key: t.dataset.country });
  } else if (t.dataset.handle) select({ kind: "handle", key: t.dataset.handle });
  else if (t.dataset.copy) copy(t.dataset.copy, "Copied — paste it in the comments");
  else if (t.hasAttribute("data-share")) share();
});

let toastTimer = 0;
function toast(msg: string) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 2200);
}
function say(msg: string) { $("sr-live").textContent = msg; }

boot();
