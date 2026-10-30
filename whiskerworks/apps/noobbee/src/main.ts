import "@fontsource-variable/unbounded";
import "@fontsource-variable/figtree";
import "../../../packages/brand/tokens.css";
import "./styles.css";
import type { GameState, Level } from "./types";
import { search, normalize, type SearchItem } from "./search";
import { Shaft } from "./scene";
import { initAnalytics } from "../../../packages/brand/analytics";

initAnalytics("Noob Bee");

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (n: number) => n.toLocaleString("en-US");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const CONTACT = "bonjour@tazgo.ca";

const app = $("app");
let state: GameState;
let shaft: Shaft | null = null;
let items: SearchItem[] = [];
type Sel = { kind: "level"; key: number } | { kind: "handle"; key: string; at?: number };
let selected: Sel | null = null;

/* ------------------------------------------------------------------ boot */
async function loadJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}
function webglAvailable() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

async function boot() {
  try {
    state = await loadJSON<GameState>("/data/state.json");
  } catch (e) {
    console.error(e);
    $("loader").innerHTML = `<span>Couldn't load the hive. <a href="">Try again</a></span>`;
    return;
  }
  buildIndex();
  renderStatic();

  if (webglAvailable()) {
    try {
      shaft = new Shaft($<HTMLCanvasElement>("stage"), {
        reducedMotion,
        onPick: (n) => (n ? select({ kind: "level", key: n }) : undefined),
        onFrame,
        onArrive: (n) => { if (selected && n > 0) popCard(n); },
      });
      shaft.setState(state);
      shaft.start();
      document.addEventListener("visibilitychange", () => (document.hidden ? shaft?.stop() : shaft?.start()));
    } catch (e) {
      console.warn("WebGL failed, using list view", e);
      shaft = null;
    }
  }
  if (!shaft) { app.classList.add("no-webgl"); openDrawer("drawer-book", false); }
  app.dataset.state = "ready";
  $("loader").classList.add("gone");
  setTimeout(() => $("loader").remove(), 500);

  // deep links: ?u=handle, ?l=42, ?q=free text
  const q = new URLSearchParams(location.search);
  const u = q.get("u") && normalize(q.get("u")!);
  const l = Number(q.get("l"));
  if (u) select({ kind: "handle", key: u }, { instant: false });
  else if (l && state.levels[l - 1]) select({ kind: "level", key: l });
  else if (q.get("q")?.trim()) {
    const text = q.get("q")!.trim();
    const { results, didYouMean } = search(items, text, 1);
    const best = results[0] ?? didYouMean;
    if (best) choose(best);
    else { input.value = text; showSuggestions(); shaft?.intro(); }
  } else shaft?.intro();

  setInterval(refresh, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}

async function refresh() {
  try {
    const next = await loadJSON<GameState>("/data/state.json");
    if (next.updatedAt === state.updatedAt) return;
    const grew = next.totals.levels > state.totals.levels;
    state = next;
    buildIndex();
    renderStatic();
    shaft?.setState(state);
    if (selected) renderPanel();
    toast(grew ? `New levels! The bee is level ${state.totals.levels}` : "The hive just updated");
  } catch { /* offline: keep current */ }
}

/* ------------------------------------------------------------------ static UI */
function buildIndex() {
  items = [
    ...Object.entries(state.handles).map(([h, v]) => ({ kind: "handle" as const, key: h, label: `@${h}`, sub: `${v.total} level${v.total === 1 ? "" : "s"} taught`, terms: [h] })),
    ...state.levels.map((l) => ({ kind: "level" as const, key: String(l.n), label: `${l.emoji} ${l.skill}`, sub: `LV ${l.n} · @${l.handle}`, terms: [normalize(l.skill)] })),
  ];
}
const levelOf = (n: number): Level | undefined => state.levels[n - 1];

function renderStatic() {
  $("stat-day").textContent = fmt(state.day);
  $("stat-level").textContent = fmt(state.totals.levels);
  $("stat-rank").textContent = state.bee.rank;

  const latest = state.links.latestEpisode || state.links.instagram || state.links.tiktok || state.links.youtube;
  const cta = $<HTMLAnchorElement>("cta-episode");
  if (latest) { cta.href = latest; cta.hidden = false; } else cta.hidden = true;
  $("cta-episode-text").textContent = `Teach me on Day ${state.day}`;
  $("socials").innerHTML = socialLinks(state.links, "Noob Bee on ", true);
  $("updated").textContent = `Updated ${timeAgo(state.updatedAt)}. Commented recently?`;

  // skill book
  $("book-lede").textContent = state.totals.levels
    ? `${fmt(state.totals.levels)} levels, ${fmt(state.totals.uniqueSkills)} different skills, taught by ${fmt(state.totals.players)} players.`
    : "The bee hasn't learned anything yet. Be the first teacher!";
  $("teachers").innerHTML = state.topTeachers.length
    ? `<h3>Top teachers</h3><ol>${state.topTeachers.slice(0, 5).map((t, i) => `<li><button type="button" data-handle="${esc(t.handle)}"><span class="rank r${i + 1}">${i + 1}</span><span class="name">@${esc(t.handle)}</span><span class="cnt">${t.levels} LV</span></button></li>`).join("")}</ol>`
    : "";
  renderBook("");

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

  $("sr-levels").innerHTML = state.levels.slice(-30).reverse().map((l) => `<li>Level ${l.n}: ${esc(l.skill)}, taught by @${esc(l.handle)} on day ${l.day}</li>`).join("");
  renderRulerMarks();
}

function renderBook(filter: string) {
  const f = normalize(filter);
  const rows = state.levels.filter((l) => !f || normalize(l.skill).includes(f) || l.handle.includes(f) || String(l.n) === f).slice().reverse();
  const shown = rows.slice(0, 400);
  $("book-list").innerHTML = shown.map((l) => `
    <li><button type="button" data-level="${l.n}">
      <span class="lvl">LV ${l.n}</span><span class="emo" aria-hidden="true">${l.emoji}</span>
      <span class="b-main"><span class="skill">${esc(l.skill)}</span><span class="by">@${esc(l.handle)} · day ${l.day}</span></span>
    </button></li>`).join("")
    + (rows.length > shown.length ? `<li class="empty">${fmt(rows.length - shown.length)} more — refine the filter.</li>` : "")
    || `<li class="empty">${f ? "Nothing matches." : "No skills yet."}</li>`;
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

/* ------------------------------------------------------------------ comment-wall cards over the ledges */
const cardEls = new Map<number, HTMLElement>();
const layer = $("labels");
function cardHTML(n: number) {
  if (n === 0) return `<span class="c-top"><span class="c-lv">LV 0</span><span class="c-h">where it all began</span></span><span class="c-skill">total noob 🥲</span>`;
  if (n > state.levels.length) return `<span class="c-top"><span class="c-lv">LV ${n}</span><span class="c-h">next level…</span></span><span class="c-skill">your comment here ✍️</span>`;
  const l = levelOf(n)!;
  return `<span class="c-top"><span class="c-lv">LV ${l.n}</span><span class="c-h">@${esc(l.handle)}</span></span><span class="c-skill">${esc(l.skill)} <span class="c-emo">${l.emoji}</span></span>`;
}
function highlightSet(): Set<number> {
  if (!selected) return new Set();
  if (selected.kind === "level") return new Set([selected.key]);
  return new Set(state.handles[selected.key]?.levels ?? []);
}
function onFrame() {
  if (!shaft) return;
  const [lo, hi] = shaft.visibleRange();
  const minY = $("hud-anchor").getBoundingClientRect().bottom + 2;
  const maxY = (!$("panel").hidden && innerWidth < 760 ? $("panel").getBoundingClientRect().top : $("search-form").getBoundingClientRect().top) - 4;
  const W = layer.clientWidth;
  const hl = highlightSet();
  const focus = selected?.kind === "level" ? selected.key : selected?.kind === "handle" ? selected.at ?? -1 : -1;
  const seen = new Set<number>();
  for (let n = lo; n <= hi; n++) {
    const p = shaft.project(n);
    if (!p || !p.visible) continue;
    let el = cardEls.get(n);
    if (!el) {
      const b = document.createElement("button");
      b.type = "button";
      el = b;
      el.className = "card";
      el.dataset.level = String(n);
      el.innerHTML = cardHTML(n);
      el.tabIndex = -1;
      el.setAttribute("aria-hidden", "true");
      layer.appendChild(el);
      cardEls.set(n, el);
    }
    seen.add(n);
    const w = el.offsetWidth || 160, h = el.offsetHeight || 50;
    // left-wall ledges get their card to the right of the anchor and vice versa
    let x = p.side < 0 ? p.x : p.x - w;
    x = Math.min(W - w - (innerWidth < 760 ? 46 : 70), Math.max(8, x));
    const y = p.y - h / 2;
    const off = y < minY || y + h > maxY;
    el.classList.toggle("on", !off);
    el.classList.toggle("is-hl", hl.has(n));
    el.classList.toggle("is-focus", n === focus);
    el.classList.toggle("is-ghost", n > state.levels.length || n === 0);
    if (!off) el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }
  for (const [n, el] of cardEls) if (!seen.has(n)) { if (Math.abs(n - (lo + hi) / 2) > 40) { el.remove(); cardEls.delete(n); } else el.classList.remove("on"); }
  updateRuler();
  updateSky();
}
function popCard(n: number) {
  const el = cardEls.get(n);
  if (!el) return;
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
}
layer.addEventListener("click", (e) => {
  const c = (e.target as HTMLElement).closest<HTMLElement>(".card");
  if (!c) return;
  const n = Number(c.dataset.level);
  if (n >= 1 && n <= state.levels.length) select({ kind: "level", key: n });
  else if (n > state.levels.length) $<HTMLAnchorElement>("cta-episode").click();
});

/* ------------------------------------------------------------------ sky + ruler */
let lastSky = -1;
function updateSky() {
  if (!shaft) return;
  const lv = shaft.cameraLevel;
  const k = Math.min(1, lv / Math.max(40, state.totals.levels * 1.1));
  const r = Math.round(k * 100) / 100;
  if (r === lastSky) return;
  lastSky = r;
  app.style.setProperty("--alt", String(r));
  app.style.setProperty("--hills", `${Math.min(600, lv * 70)}px`);
}
const track = $("ruler-track");
function renderRulerMarks() {
  const top = Math.max(1, state.totals.levels);
  $("ruler-top").textContent = `LV ${fmt(state.totals.levels)}`;
  track.setAttribute("aria-valuemax", String(top));
  // day boundaries
  const firsts = new Map<number, number>();
  for (const l of state.levels) if (!firsts.has(l.day)) firsts.set(l.day, l.n);
  const hl = [...highlightSet()];
  $("ruler-marks").innerHTML = [...firsts.entries()].map(([d, n]) => `<span class="mark-day" style="--p:${(n / top) * 100}%">D${d}</span>`).join("")
    + hl.map((n) => `<i class="mark-hl" style="--p:${(n / top) * 100}%"></i>`).join("");
}
function updateRuler() {
  if (!shaft) return;
  const top = Math.max(1, state.totals.levels);
  const lv = shaft.cameraLevel;
  const p = Math.min(100, (lv / top) * 100);
  $("ruler-thumb").style.setProperty("--p", `${p}%`);
  $("ruler-fill").style.setProperty("--p", `${p}%`);
  const shown = Math.round(lv);
  if ($("ruler-thumb-label").textContent !== String(shown)) {
    $("ruler-thumb-label").textContent = String(shown);
    track.setAttribute("aria-valuenow", String(shown));
  }
}
function rulerLevel(e: PointerEvent) {
  const r = track.getBoundingClientRect();
  return Math.round((1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))) * state.totals.levels);
}
let rulerDrag = false;
track.addEventListener("pointerdown", (e) => { rulerDrag = true; track.setPointerCapture(e.pointerId); shaft?.scrollToLevel(rulerLevel(e)); });
track.addEventListener("pointermove", (e) => { if (rulerDrag) shaft?.scrollToLevel(rulerLevel(e), true); });
track.addEventListener("pointerup", () => (rulerDrag = false));
track.addEventListener("keydown", (e) => {
  if (!shaft) return;
  const cur = Math.round(shaft.cameraLevel);
  const step = e.shiftKey ? 10 : 1;
  if (e.key === "ArrowUp" || e.key === "PageUp") shaft.scrollToLevel(Math.min(state.totals.levels, cur + (e.key === "PageUp" ? 10 : step)));
  else if (e.key === "ArrowDown" || e.key === "PageDown") shaft.scrollToLevel(Math.max(0, cur - (e.key === "PageDown" ? 10 : step)));
  else if (e.key === "Home") shaft.scrollToLevel(0);
  else if (e.key === "End") shaft.scrollToLevel(state.totals.levels);
  else return;
  e.preventDefault();
});

/* ------------------------------------------------------------------ selection & panel */
function select(sel: Sel | null, opts: { instant?: boolean } = {}) {
  selected = sel;
  const url = new URL(location.href);
  for (const k of ["u", "l", "q"]) url.searchParams.delete(k);
  if (sel) url.searchParams.set(sel.kind === "level" ? "l" : "u", String(sel.key));
  history.replaceState(null, "", url);
  renderRulerMarks();
  if (!sel) {
    $("panel").hidden = true; app.classList.remove("has-panel"); shaft?.setInset(0, 0); shaft?.clearFocus();
    return;
  }
  if (sel.kind === "handle") {
    const h = state.handles[sel.key];
    if (h && sel.at === undefined) sel.at = h.levels[h.levels.length - 1];
  }
  renderPanel();
  $("panel").hidden = false;
  app.classList.add("has-panel");
  syncInset();
  const target = sel.kind === "level" ? sel.key : sel.at;
  if (target) shaft?.focusLevel(target, { instant: opts.instant });
  $("panel-close").focus({ preventScroll: true });
}
function syncInset() {
  if (!shaft || $("panel").hidden) return;
  const r = $("panel").getBoundingClientRect();
  if (innerWidth >= 760) shaft.setInset(innerWidth - r.left, 0);
  else shaft.setInset(0, Math.max(0, innerHeight - r.top - $("hud-anchor").getBoundingClientRect().bottom));
}
addEventListener("resize", syncInset);

function renderPanel() {
  if (!selected) return;
  const body = $("panel-body");
  const latest = state.links.latestEpisode;
  if (selected.kind === "level") {
    const l = levelOf(selected.key);
    if (!l) { body.innerHTML = `<p class="p-empty">Level ${selected.key} doesn't exist yet.</p>`; return; }
    const by = state.handles[l.handle];
    say(`Level ${l.n}: ${l.skill}, taught by @${l.handle} on day ${l.day}.`);
    body.innerHTML = `
      <div class="p-head">
        <div class="p-emo" aria-hidden="true">${l.emoji}</div>
        <div><p class="p-kicker">Level ${fmt(l.n)} · Day ${l.day}</p><h2 id="panel-title">${esc(l.skill)}</h2></div>
      </div>
      <button type="button" class="teacher" data-handle="${esc(l.handle)}" ${l.handle === "anonymous" ? "disabled" : ""}>
        <span class="teacher-tag">Taught by</span><span class="teacher-handle">@${esc(l.handle)}</span>
        ${by && by.total > 1 ? `<span class="teacher-more">${by.total} levels taught →</span>` : ""}
      </button>
      <div class="p-nav">
        <button type="button" class="btn btn-ghost" data-level="${Math.max(1, l.n - 1)}" ${l.n <= 1 ? "disabled" : ""} aria-label="Previous level">← LV ${Math.max(1, l.n - 1)}</button>
        <button type="button" class="btn btn-ghost" data-level="${Math.min(state.levels.length, l.n + 1)}" ${l.n >= state.levels.length ? "disabled" : ""} aria-label="Next level">LV ${Math.min(state.levels.length, l.n + 1)} →</button>
      </div>
      <div class="p-actions">
        ${latest ? `<a class="btn btn-cta" href="${esc(latest)}" target="_blank" rel="noopener">Teach the next skill ↗</a>` : ""}
        <button type="button" class="btn btn-ghost" data-share>Share</button>
      </div>`;
    return;
  }
  const h = selected.key;
  const u = state.handles[h];
  if (!u) {
    const { didYouMean } = search(items.filter((i) => i.kind === "handle"), h);
    say(`No levels for @${h} yet.`);
    body.innerHTML = `
      <div class="p-head"><div class="avatar" aria-hidden="true">@</div><div><p class="p-kicker">Teacher</p><h2 id="panel-title">@${esc(h)}</h2></div></div>
      <p class="p-empty">No level for <b>@${esc(h)}</b> yet. Commented recently? New levels are added at the next daily update.</p>
      ${didYouMean ? `<p class="dym">Did you mean <button type="button" class="link-btn" data-handle="${esc(didYouMean.key)}">${esc(didYouMean.label)}</button>?</p>` : ""}
      <div class="p-actions">${latest ? `<a class="btn btn-cta" href="${esc(latest)}" target="_blank" rel="noopener">Teach me on Day ${state.day} ↗</a>` : ""}</div>`;
    return;
  }
  const rank = state.topTeachers.findIndex((t) => t.handle === h) + 1;
  say(`@${h} taught ${u.total} levels. First one: level ${u.first}.`);
  const at = selected.at;
  body.innerHTML = `
    <div class="p-head"><div class="avatar" aria-hidden="true">${esc(h[0]?.toUpperCase() || "@")}</div>
      <div><p class="p-kicker">Teacher${rank ? ` · #${rank} in the hive` : ""}</p><h2 id="panel-title">@${esc(h)}</h2></div></div>
    <dl class="p-stats">
      <div><dt>Levels</dt><dd>${fmt(u.total)}</dd></div>
      <div><dt>First</dt><dd>LV ${fmt(u.first)}</dd></div>
      <div><dt>Since</dt><dd>Day ${u.firstDay}</dd></div>
    </dl>
    <h3 class="p-h3">Skills you taught</h3>
    <ol class="taught">${u.levels.slice().reverse().map((n) => { const l = levelOf(n)!; return `
      <li><button type="button" data-goto="${n}" ${n === at ? 'aria-current="true"' : ""}><span class="lvl">LV ${n}</span><span class="emo" aria-hidden="true">${l.emoji}</span><span class="skill">${esc(l.skill)}</span></button></li>`; }).join("")}</ol>
    <div class="p-actions">
      ${latest ? `<a class="btn btn-cta" href="${esc(latest)}" target="_blank" rel="noopener">Teach another skill ↗</a>` : ""}
      <button type="button" class="btn btn-ghost" data-share>Share</button>
    </div>
    <p class="fine">Not you, or want your name off? <a href="mailto:${CONTACT}?subject=Noob%20Bee%20opt-out">Message us</a>.</p>`;
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
        ${it.kind === "handle" ? `<span class="avatar sm" aria-hidden="true">@</span>` : `<span class="lv-chip" aria-hidden="true">LV</span>`}
        <span class="o-main">${esc(it.label)}</span><span class="o-sub">${esc(it.sub)}</span>
      </li>`).join("")
    : `<li class="none" role="presentation">No match. Commented recently? New levels are added daily.</li>`;
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
  if (it.kind === "handle") select({ kind: "handle", key: it.key });
  else select({ kind: "level", key: Number(it.key) });
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
  if (app.classList.contains("no-webgl") && d.id === "drawer-book") return;
  d.classList.remove("open");
  setTimeout(() => (d.hidden = true), reducedMotion ? 0 : 260);
  lastFocus?.focus({ preventScroll: true });
}
$("btn-book").addEventListener("click", () => openDrawer("drawer-book"));
$("btn-episodes").addEventListener("click", () => openDrawer("drawer-episodes"));
$("btn-home").addEventListener("click", () => { select(null); shaft?.focusTop(); });
$("book-filter").addEventListener("input", (e) => renderBook((e.target as HTMLInputElement).value));
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
  const l = selected?.kind === "level" ? levelOf(selected.key) : null;
  const title = l ? `Noob Bee level ${l.n}: ${l.skill}` : selected?.kind === "handle" ? `@${selected.key} taught Noob Bee` : "Noob Bee · 1 comment = 1 level up";
  if (navigator.share) {
    try { await navigator.share({ title, text: "1 comment = 1 level up. Teach the noob bee something 🐝", url }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { toast("Press and hold the address bar to copy"); }
}
$("btn-share").addEventListener("click", share);

document.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-level],[data-handle],[data-goto],[data-share]");
  if (!t || t.closest("#search-list") || t.closest("#labels")) return;
  const d = t.closest<HTMLElement>(".drawer");
  if (t.dataset.level) {
    if (d && !app.classList.contains("no-webgl")) closeDrawer(d);
    select({ kind: "level", key: Number(t.dataset.level) });
  } else if (t.dataset.handle) {
    if (d && !app.classList.contains("no-webgl")) closeDrawer(d);
    select({ kind: "handle", key: t.dataset.handle });
  } else if (t.dataset.goto && selected?.kind === "handle") {
    selected.at = Number(t.dataset.goto);
    shaft?.focusLevel(selected.at);
    renderPanel();
  } else if (t.hasAttribute("data-share")) share();
});

let toastTimer = 0;
function toast(msg: string) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 2400);
}
function say(msg: string) { $("sr-live").textContent = msg; }

boot();
