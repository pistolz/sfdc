import "@fontsource-variable/unbounded";
import "@fontsource-variable/figtree";
import "../../../packages/brand/tokens.css";
import "./styles.css";
import type { GameState } from "./types";
import { search, normalize, type SearchItem } from "./search";
import { Arcade, NEONS } from "./arcade";
import { drawGame, GAMES } from "./games";
import { pad, COLS } from "./layout";
import { initAnalytics } from "../../../packages/brand/analytics";
import { initNetwork } from "../../../packages/brand/network";
import { initPromo } from "../../../packages/brand/promo";

initNetwork("arcade");
void initPromo("arcade");
initAnalytics("Insert Coin Club");

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (n: number) => n.toLocaleString("en-US");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const app = $("app");
let state: GameState;
let arcade: Arcade | null = null;
let items: SearchItem[] = [];
let byHandle = new Map<string, number>();
let selected: number | null = null; // machine index
let missing: string | null = null;  // searched handle with no machine yet
let arrived = false;

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
  try { state = await loadJSON<GameState>("/data/state.json"); }
  catch (e) {
    console.error(e);
    $("loader").innerHTML = `<span>Couldn't load the hall. <a href="">Try again</a></span>`;
    return;
  }
  buildIndex();
  renderStatic();

  if (webglAvailable()) {
    try {
      arcade = new Arcade($<HTMLCanvasElement>("hall"), {
        reducedMotion,
        onPick: (i) => (i == null ? undefined : select(i)),
        onArrive: (i) => { arrived = true; popTag(i); },
        onFrame: placeLabels,
      });
      arcade.setState(state);
      arcade.home(true);
      arcade.start();
      document.addEventListener("visibilitychange", () => (document.hidden ? arcade?.stop() : arcade?.start()));
    } catch (e) {
      console.warn("WebGL failed, using list view", e);
      arcade = null;
    }
  }
  if (!arcade) { app.classList.add("no-webgl"); openDrawer("drawer-list", false); }
  app.dataset.state = "ready";
  $("loader").remove();

  // deep links: ?u=handle  ?m=12  ?q=free text (handle or number, fuzzy)
  const q = new URLSearchParams(location.search);
  const u = q.get("u") && normalize(q.get("u")!);
  const m = Number(q.get("m"));
  if (u) findHandle(u, { instant: false });
  else if (m >= 1 && m <= state.machines.length) select(m - 1);
  else if (q.get("q")?.trim()) {
    const text = q.get("q")!.trim();
    const { results, didYouMean } = search(items, text, 1);
    const best = results[0] ?? didYouMean;
    if (best) select(best.key - 1);
    else if (/^@?[\w.]+$/.test(text)) findHandle(normalize(text));
    else { input.value = text; showSuggestions(); }
  }

  setInterval(refresh, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}

async function refresh() {
  try {
    const next = await loadJSON<GameState>("/data/state.json");
    if (next.updatedAt === state.updatedAt) return;
    const grew = next.machines.length - state.machines.length;
    state = next;
    buildIndex();
    renderStatic();
    arcade?.setState(state);
    if (selected != null) renderPanel();
    toast(grew > 0 ? `${grew} new machine${grew === 1 ? "" : "s"} just plugged in` : "The hall just updated");
  } catch { /* offline: keep current */ }
}

/* ------------------------------------------------------------------ static UI */
const labelFor = (i: number) => (i === 0 ? `@${state.series.account} · Founder` : state.machines[i][0] ? `@${state.machines[i][0]}` : "FOLLOWER");
function buildIndex() {
  byHandle = new Map();
  items = state.machines.map((m, i) => {
    if (m[0]) byHandle.set(m[0], i);
    return { kind: "machine" as const, key: i + 1, label: m[0] ? `@${m[0]}` : `Machine ${pad(i + 1)}`, sub: `${pad(i + 1)} · Day ${m[1]}`, terms: [m[0], pad(i + 1).toLowerCase()].filter(Boolean) };
  });
  if (!byHandle.has(state.series.account)) byHandle.set(state.series.account, 0);
}

function renderStatic() {
  $("stat-day").textContent = fmt(state.day);
  $("stat-machines").textContent = fmt(state.totals.machines);
  const newest = state.machines.map((m, i) => ({ m, i })).filter(({ m }) => m[0]).slice(-3).reverse();
  $("newest-list").innerHTML = newest.map(({ m, i }) => `
    <li><button type="button" data-machine="${i}"><span class="num" style="--n:${NEONS[m[3]]}">${pad(i + 1)}</span><span class="name">@${esc(m[0])}</span></button></li>`).join("")
    || `<li class="empty">The hall is empty. Follow to plug in #0001!</li>`;
  $("sr-list").innerHTML = newest.map(({ m, i }) => `<li>Machine ${i + 1}: @${esc(m[0])}, joined day ${m[1]}</li>`).join("");
  renderList("");

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

  const follow = state.links.instagram || state.links.tiktok || state.links.youtube || state.links.latestEpisode;
  const cta = $<HTMLAnchorElement>("cta-follow");
  if (follow) { cta.href = follow; cta.hidden = false; } else cta.hidden = true;
  $("cta-follow-text").textContent = `Follow to get machine ${pad(state.machines.length + 1)}`;
  $("socials").innerHTML = socialLinks(state.links, "Insert Coin Club on ", true);
  $("updated").textContent = `Updated ${timeAgo(state.updatedAt)}. Followed recently?`;
  $("ghost-num").textContent = pad(state.machines.length + 1);
  $("ruler-bottom").textContent = pad(Math.max(1, state.machines.length));
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

function renderList(filter: string) {
  const f = normalize(filter).replace(/^#0*/, "");
  const rows: number[] = [];
  for (let i = 0; i < state.machines.length && rows.length < 200; i++) {
    const h = state.machines[i][0];
    if (!f || h.includes(f) || String(i + 1).startsWith(f)) rows.push(i);
  }
  $("machine-list").innerHTML = rows.map((i) => {
    const m = state.machines[i];
    return `<li><button type="button" data-machine="${i}">
      <span class="num" style="--n:${NEONS[m[3]]}">${pad(i + 1)}</span>
      <span class="b-main"><span class="name">${i === 0 ? "FOUNDER" : m[0] ? `@${esc(m[0])}` : "FOLLOWER"}</span><span class="b-sub">${esc(GAMES[m[2]])}</span></span>
      <span class="b-side">Day ${m[1]}</span></button></li>`;
  }).join("") || `<li class="empty">${f ? "No machine matches. Followed recently? It appears at the next update." : "The hall is empty."}</li>`;
  const total = f ? null : state.machines.length;
  const more = $("list-more");
  more.hidden = !(total && total > 200);
  if (total) more.textContent = `Showing the first 200 of ${fmt(total)}. Type a handle or number to find any machine.`;
}

/* ------------------------------------------------------------------ labels + ruler (per frame) */
function placeLabels() {
  if (!arcade) return;
  const minY = $("hud-top-anchor").getBoundingClientRect().bottom - 6;
  const tag = $("tag-selected");
  if (selected != null && arrived) {
    const p = arcade.project(selected);
    if (p && p.visible && p.y > minY) { tag.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0) translate(-50%, -100%)`; tag.classList.add("on"); }
    else tag.classList.remove("on");
  } else tag.classList.remove("on");
  const ghost = $("tag-ghost");
  const g = selected == null ? arcade.project(state.machines.length) : null;
  if (g && g.visible && g.y > minY + 20) { ghost.style.transform = `translate3d(${Math.round(g.x)}px, ${Math.round(g.y)}px, 0) translate(-50%, -100%)`; ghost.classList.add("on"); }
  else ghost.classList.remove("on");

  // ruler
  const rows = arcade.rows(), row = arcade.viewRow();
  const p = rows > 1 ? Math.min(1, row / (rows - 1)) : 0;
  const thumb = $("ruler-thumb");
  thumb.style.top = `${p * 100}%`;
  const first = Math.min(state.machines.length, row * COLS + 1);
  const lbl = pad(Math.max(1, first));
  if ($("ruler-label").textContent !== lbl) { $("ruler-label").textContent = lbl; $("ruler-track").setAttribute("aria-valuenow", String(row + 1)); $("ruler-track").setAttribute("aria-valuemax", String(rows)); }
  const you = $("ruler-you");
  if (selected != null && rows > 1) { you.hidden = false; you.style.top = `${(Math.floor(selected / COLS) / (rows - 1)) * 100}%`; } else you.hidden = true;
}
function popTag(i: number) {
  const tag = $("tag-selected");
  $("tag-num").textContent = `${pad(i + 1)}${i === 0 ? " · Founder" : ""}`;
  $("tag-handle").textContent = labelFor(i).replace(" · Founder", "");
  tag.style.setProperty("--n", NEONS[state.machines[i][3]]);
  tag.classList.remove("pop"); void tag.offsetWidth; tag.classList.add("pop");
  toast(i === 0 ? "The founder's machine" : `Found it: machine ${pad(i + 1)}`);
}

// ruler interaction
{
  const track = $("ruler-track");
  let dragging = false;
  const go = (clientY: number, instant: boolean) => {
    if (!arcade) return;
    const r = track.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    arcade.goToRow(Math.round(p * (arcade.rows() - 1)), instant);
  };
  track.addEventListener("pointerdown", (e) => { dragging = true; track.setPointerCapture(e.pointerId); go(e.clientY, false); });
  track.addEventListener("pointermove", (e) => { if (dragging) go(e.clientY, true); });
  track.addEventListener("pointerup", () => (dragging = false));
  track.addEventListener("keydown", (e) => {
    if (!arcade) return;
    const d = e.key === "ArrowDown" || e.key === "PageDown" ? 1 : e.key === "ArrowUp" || e.key === "PageUp" ? -1 : 0;
    if (e.key === "Home") arcade.goToRow(0); else if (e.key === "End") arcade.goToRow(arcade.rows() - 1);
    else if (d) arcade.goToRow(arcade.viewRow() + d * (e.key.startsWith("Page") ? 5 : 1));
    else return;
    e.preventDefault();
  });
}

/* ------------------------------------------------------------------ selection & panel */
function findHandle(h: string, opts: { instant?: boolean } = {}) {
  const i = byHandle.get(h);
  if (i != null) { select(i, opts); return; }
  // no machine yet: show the not-found panel
  selected = null; missing = h; arrived = false;
  arcade?.clearSelection();
  setUrl({ u: h });
  renderPanel();
  openPanel();
}

function select(i: number | null, opts: { instant?: boolean } = {}) {
  selected = i; missing = null; arrived = false;
  if (i == null) {
    setUrl({});
    $("panel").hidden = true; app.classList.remove("has-panel");
    arcade?.clearSelection(); arcade?.setInset(0, 0);
    stopPreview();
    return;
  }
  const h = state.machines[i][0];
  setUrl(h ? { u: h } : { m: String(i + 1) });
  renderPanel();
  openPanel();
  say(`Machine ${i + 1}${h ? `, @${h}` : ""}. ${arcade ? "Flying to it." : ""}`);
  if (arcade) arcade.flyTo(i, opts); else arrived = true;
}
function openPanel() {
  $("panel").hidden = false;
  app.classList.add("has-panel");
  syncInset();
  $("panel-close").focus({ preventScroll: true });
}
function setUrl(params: Record<string, string>) {
  const url = new URL(location.href);
  for (const k of ["u", "m", "q"]) url.searchParams.delete(k);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  history.replaceState(null, "", url);
}
function syncInset() {
  if (!arcade || $("panel").hidden) return;
  const r = $("panel").getBoundingClientRect();
  if (innerWidth >= 760) { arcade.setInset(innerWidth - r.left, 0); return; }
  // centre the machine in the free band between the HUD and the bottom sheet
  const hudB = $("hud-top-anchor").getBoundingClientRect().bottom;
  arcade.setInset(0, innerHeight - (hudB + r.top));
}
addEventListener("resize", syncInset);

let previewRaf = 0;
function stopPreview() { cancelAnimationFrame(previewRaf); previewRaf = 0; }
function startPreview(game: number) {
  stopPreview();
  const cv = document.getElementById("preview") as HTMLCanvasElement | null;
  if (!cv) return;
  const c = cv.getContext("2d")!;
  const t0 = performance.now();
  const tick = () => {
    drawGame(game, c, cv.width, cv.height, reducedMotion ? 1.5 : (performance.now() - t0) / 1000);
    if (!reducedMotion) previewRaf = requestAnimationFrame(tick);
  };
  tick();
}

function renderPanel() {
  const body = $("panel-body");
  const follow = state.links.instagram || state.links.latestEpisode || "";
  if (selected == null) {
    const h = missing ?? "";
    const { didYouMean } = search(items, h);
    say(`No machine for @${h} yet.`);
    body.innerHTML = `
      <div class="p-head"><div class="avatar" aria-hidden="true">?</div><div><p class="p-kicker">Not plugged in yet</p><h2 id="panel-title">@${esc(h)}</h2></div></div>
      <p class="p-empty">No machine for <b>@${esc(h)}</b> yet. <b>Followed recently?</b> Your machine appears at the next daily update. Not following yet? Follow and machine <b>${pad(state.machines.length + 1)}</b> could be yours.</p>
      ${didYouMean ? `<p class="dym">Did you mean <button type="button" class="link-btn" data-machine="${didYouMean.key - 1}">${esc(didYouMean.label)}</button>?</p>` : ""}
      <div class="p-actions">${follow ? `<a class="btn btn-gold" href="${esc(follow)}" target="_blank" rel="noopener">Follow @${esc(state.series.account)} ↗</a>` : ""}</div>`;
    stopPreview();
    return;
  }
  const i = selected, m = state.machines[i];
  const neon = NEONS[m[3]];
  const handle = m[0];
  const joinedBefore = i, ahead = state.machines.length - i - 1;
  body.innerHTML = `
    <div class="p-head" style="--n:${neon}">
      <div class="p-num"><small>Machine</small><b>${pad(i + 1)}</b></div>
      <div>
        <p class="p-kicker">${i === 0 ? "Founder · " : ""}Plugged in on day ${m[1]}</p>
        <h2 id="panel-title">${i === 0 ? `@${esc(state.series.account)}` : handle ? `@${esc(handle)}` : "FOLLOWER"}</h2>
      </div>
    </div>
    <div class="p-game" style="--n:${neon}">
      <canvas id="preview" width="240" height="192" aria-hidden="true"></canvas>
      <div>
        <p class="p-kicker">Your game</p>
        <p class="p-game-name">${esc(GAMES[m[2]])}</p>
        <p class="p-game-sub">Playing on loop on your cabinet's screen, all day, every day.</p>
      </div>
    </div>
    <dl class="p-stats">
      <div><dt>Joined</dt><dd>Day ${m[1]}</dd></div>
      <div><dt>Before you</dt><dd>${fmt(joinedBefore)}</dd></div>
      <div><dt>After you</dt><dd>${fmt(ahead)}</dd></div>
    </dl>
    <div class="p-actions">
      <button type="button" class="btn btn-gold" data-share>Share my machine</button>
      ${follow ? `<a class="btn btn-ghost" href="${esc(follow)}" target="_blank" rel="noopener">Watch the series ↗</a>` : ""}
    </div>
    <p class="fine">${handle && i !== 0 ? `Not you, or want your name off? <a href="mailto:bonjour@tazgo.ca?subject=Insert%20Coin%20Club%20opt-out">Message us</a>.` : "Invite a friend: every follow plugs in a new machine."}</p>`;
  startPreview(m[2]);
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
    ? (results.length ? "" : `<li class="dym-head" role="presentation">Did you mean</li>`) + current.map((it, k) => {
      const m = state.machines[it.key - 1];
      return `<li role="option" id="opt-${k}" aria-selected="${k === active}" data-i="${k}">
        <span class="num" style="--n:${NEONS[m[3]]}">${pad(it.key)}</span>
        <span class="o-main">${esc(it.label)}</span><span class="o-sub">Day ${m[1]}</span></li>`;
    }).join("")
    : `<li class="none" role="presentation">No machine found. Followed recently? It appears at the next update.</li>`;
  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-activedescendant", active >= 0 ? `opt-${active}` : "");
}
function closeList() { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); }
function choose(it: SearchItem | undefined) {
  if (!it) {
    const q = normalize(input.value);
    if (q) findHandle(q);
  } else select(it.key - 1);
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
    list.querySelectorAll("[role=option]").forEach((o, k) => o.setAttribute("aria-selected", String(k === active)));
    input.setAttribute("aria-activedescendant", `opt-${active}`);
  } else if (e.key === "Escape") closeList();
});
list.addEventListener("pointerdown", (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
  if (li) { e.preventDefault(); choose(current[Number(li.dataset.i)]); }
});
$("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!input.value.trim()) { input.focus(); return; }
  const exact = byHandle.get(normalize(input.value));
  choose(exact != null ? items[exact] : current[active]);
});
document.addEventListener("click", (e) => { if (!(e.target as HTMLElement).closest(".search")) closeList(); });

/* ------------------------------------------------------------------ drawers, share */
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
  if (app.classList.contains("no-webgl") && d.id === "drawer-list") return;
  d.classList.remove("open");
  setTimeout(() => (d.hidden = true), reducedMotion ? 0 : 260);
  lastFocus?.focus({ preventScroll: true });
}
$("btn-list").addEventListener("click", () => openDrawer("drawer-list"));
$("btn-episodes").addEventListener("click", () => openDrawer("drawer-episodes"));
$("list-filter").addEventListener("input", (e) => renderList((e.target as HTMLInputElement).value));
document.querySelectorAll<HTMLElement>(".drawer").forEach((d) => {
  d.addEventListener("click", (e) => { if (e.target === d || (e.target as HTMLElement).closest("[data-close]")) closeDrawer(d); });
});
$("panel-close").addEventListener("click", () => select(null));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const open = [...document.querySelectorAll<HTMLElement>(".drawer.open")].pop();
  if (open) closeDrawer(open);
  else if (selected != null || missing) select(null);
});

async function share() {
  const url = location.href;
  const title = selected != null ? `Machine ${pad(selected + 1)} in the Insert Coin Club` : "Insert Coin Club · 1 follower = 1 arcade machine";
  if (navigator.share) {
    try { await navigator.share({ title, text: "Every follower gets their own arcade machine 🕹️ Find yours:", url }); return; }
    catch (e) { if ((e as Error).name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { toast("Press and hold the address bar to copy"); }
}
$("btn-share").addEventListener("click", share);

document.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-machine],[data-share]");
  if (!t || t.closest("#search-list")) return;
  if (t.dataset.machine != null) {
    const d = t.closest<HTMLElement>(".drawer");
    if (d && !app.classList.contains("no-webgl")) closeDrawer(d);
    select(Number(t.dataset.machine));
  } else if (t.hasAttribute("data-share")) share();
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
