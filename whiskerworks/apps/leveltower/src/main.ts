import "@fontsource-variable/unbounded";
import "@fontsource-variable/figtree";
import "../../../packages/brand/tokens.css";
import "./styles.css";
import type { TowerState, Theme } from "./types";
import { search, normalize, type SearchItem, type Kind } from "./search";
import { Tower } from "./tower";
import { initAnalytics } from "../../../packages/brand/analytics";
import { initNetwork } from "../../../packages/brand/network";

initNetwork("leveltower");
initAnalytics("Level Tower");

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (n: number) => n.toLocaleString("en-US");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const app = $("app");
let state: TowerState;
let tower: Tower | null = null;
let items: SearchItem[] = [];
let selected: { kind: Kind; key: string } | null = null;
/** handle → floor numbers (1-based) */
let byHandle = new Map<string, number[]>();
let byTheme = new Map<string, number[]>();

/* ------------------------------------------------------------------ boot */
async function loadJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}
function webglAvailable() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

const themeOf = (floor: number): Theme => {
  const t = state.themes[state.floors[floor - 1]?.[0] ?? 0];
  const c = state.labels?.[String(floor)];
  return c ? { ...t, name: c.name, emoji: c.emoji || t.emoji } : t;
};
const pickerOf = (floor: number): string | null => { const h = state.floors[floor - 1]?.[1] ?? -1; return h >= 0 ? state.handles[h] : null; };

async function boot() {
  try { state = await loadJSON<TowerState>("/data/state.json"); }
  catch (e) {
    console.error(e);
    $("loader").innerHTML = `<span>Couldn't load the tower. <a href="">Try again</a></span>`;
    return;
  }
  index();
  renderStatic();

  if (webglAvailable()) {
    try {
      tower = new Tower($<HTMLCanvasElement>("scene"), {
        reducedMotion,
        onPick: (f) => select({ kind: "floor", key: String(f) }),
        onFrame: frame,
        onFloorChange: floorChanged,
      });
      tower.setState(state);
      tower.start();
      document.addEventListener("visibilitychange", () => (document.hidden ? tower?.stop() : tower?.start()));
    } catch (e) {
      console.warn("WebGL failed, using list view", e);
      tower = null;
    }
  }
  if (!tower) { app.classList.add("no-webgl"); openDrawer("drawer-board", false); }
  app.dataset.state = "ready";
  $("loader").remove();

  // deep links: ?u=handle · ?f=floor · ?w=world · ?q=free text
  const q = new URLSearchParams(location.search);
  const u = q.get("u") && normalize(q.get("u")!);
  const f = Number(q.get("f"));
  const w = q.get("w");
  const text = q.get("q")?.trim();
  if (u) { intro(); select({ kind: "handle", key: u }); }
  else if (f >= 1) { intro(); select({ kind: "floor", key: String(Math.min(f, state.floors.length)) }); }
  else if (w && byTheme.has(w)) { intro(); select({ kind: "theme", key: w }); }
  else if (text) {
    const best = bestMatch(text);
    if (best) { intro(); select({ kind: best.kind, key: best.key }); }
    else { input.value = text; showSuggestions(); }
  } else if (tower) {
    // opening shot: start at the base and rise to the newest floor
    tower.flyTo(1, { instant: true, select: false });
    setTimeout(() => tower?.flyTo(Math.max(1, state.floors.length - 2.5), { select: false }), 700);
  }

  setInterval(refresh, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}
/** Deep links start from the top of the tower so the flight to the floor reads as a dive. */
function intro() { tower?.flyTo(state.floors.length, { instant: true, select: false }); }

async function refresh() {
  try {
    const next = await loadJSON<TowerState>("/data/state.json");
    if (next.updatedAt === state.updatedAt) return;
    const grew = next.floors.length - state.floors.length;
    state = next;
    index();
    renderStatic();
    tower?.setState(state);
    if (selected) renderPanel();
    toast(grew > 0 ? `+${fmt(grew)} new floor${grew === 1 ? "" : "s"}!` : "The tower just updated");
  } catch { /* offline: keep current */ }
}

function bestMatch(text: string): SearchItem | null {
  const fl = floorQuery(text);
  if (fl) return fl;
  const { results, didYouMean } = search(items, text, 1);
  return results[0] ?? didYouMean;
}

/* ------------------------------------------------------------------ indexes */
function index() {
  byHandle = new Map(); byTheme = new Map();
  state.floors.forEach(([t, h], i) => {
    const th = state.themes[t].id;
    (byTheme.get(th) ?? byTheme.set(th, []).get(th)!).push(i + 1);
    if (h >= 0) { const name = state.handles[h]; (byHandle.get(name) ?? byHandle.set(name, []).get(name)!).push(i + 1); }
  });
  for (const qd of state.queue) if (!byHandle.has(qd.handle)) byHandle.set(qd.handle, []);
  items = [
    ...state.themes.map((t) => ({ kind: "theme" as const, key: t.id, label: `${t.emoji} ${t.name}`, sub: `${fmt(byTheme.get(t.id)?.length ?? 0)} floors`, terms: [normalize(t.name), t.id] })),
    ...Object.entries(state.labels ?? {}).map(([f, c]) => ({ kind: "floor" as const, key: f, label: `${c.emoji} ${c.name}`, sub: `Floor ${fmt(Number(f))}${pickerOf(Number(f)) ? ` · @${pickerOf(Number(f))}` : ""}`, terms: [normalize(c.name)] })),
    ...[...byHandle].filter(([h]) => h !== "anonymous").map(([h, fl]) => ({ kind: "handle" as const, key: h, label: `@${h}`, sub: fl.length ? `${fl.length} floor${fl.length === 1 ? "" : "s"} · top #${Math.max(...fl)}` : "In the queue", terms: [h] })),
  ];
}
function floorQuery(q: string): SearchItem | null {
  const m = /^\s*(?:floor|f|#|étage|etage|piso)?\s*#?\s*(\d{1,6})\s*$/i.exec(q);
  if (!m) return null;
  const n = Math.max(1, Math.min(Number(m[1]), state.floors.length));
  return { kind: "floor", key: String(n), label: `Floor ${n}`, sub: `${themeOf(n).emoji} ${themeOf(n).name}${pickerOf(n) ? ` · @${pickerOf(n)}` : ""}`, terms: [] };
}

/* ------------------------------------------------------------------ static UI */
function renderStatic() {
  const n = state.floors.length;
  $("stat-day").textContent = fmt(state.day);
  $("stat-floors").textContent = fmt(n);
  $("ruler-top").textContent = fmt(n);
  const track = $("ruler-track");
  track.setAttribute("aria-valuemax", String(n));
  // milestone ticks
  const step = n > 2000 ? 500 : n > 600 ? 100 : n > 150 ? 50 : 10;
  let ticks = "";
  for (let k = step; k < n; k += step) ticks += `<i style="--p:${(k - 1) / Math.max(1, n - 1)}"><span>${fmt(k)}</span></i>`;
  $("ruler-ticks").innerHTML = ticks;

  // builders + worlds
  $("board-list").innerHTML = state.builders.map((b) => `
    <li><button type="button" data-handle="${esc(b.handle)}">
      <span class="rank r${b.rank}">${b.rank}</span><span class="avatar sm" aria-hidden="true">${esc(b.handle[0]?.toUpperCase() ?? "@")}</span>
      <span class="name">@${esc(b.handle)}</span><span class="count">${fmt(b.floors)} <small>floor${b.floors === 1 ? "" : "s"}</small></span>
    </button></li>`).join("") || `<li class="empty">No worlds picked yet — the first comment builds floor 2.</li>`;
  $("world-list").innerHTML = [...state.themes].filter((t) => !t.plain && (state.themeCounts[t.id] ?? 0) > 0).sort((a, b) => (state.themeCounts[b.id] ?? 0) - (state.themeCounts[a.id] ?? 0)).map((t) => `
    <button type="button" class="world" data-theme="${esc(t.id)}" style="--c:${esc(t.top)};--a:${esc(t.accent)}">
      <span class="w-emoji" aria-hidden="true">${t.emoji}</span><span class="w-name">${esc(t.name)}</span><span class="w-n">${fmt(state.themeCounts[t.id] ?? 0)}</span>
    </button>`).join("");

  $("sr-list").innerHTML = state.floors.map((f, i) => ({ f, n: i + 1 })).filter(({ f }) => f[1] >= 0).slice(-30).reverse()
    .map(({ f, n }) => `<li>Floor ${n}: ${esc(themeOf(n).name)}, picked by @${esc(state.handles[f[1]])}</li>`).join("");

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

  const latest = state.links.latestEpisode || state.links.instagram || state.links.tiktok || state.links.youtube;
  const cta = $<HTMLAnchorElement>("cta-episode");
  if (latest) { cta.href = latest; cta.hidden = false; } else cta.hidden = true;
  $("cta-episode-text").textContent = `Like Day ${state.day} to add a floor`;
  $("socials").innerHTML = socialLinks(state.links, "Level Tower on ", true);
  $("updated").textContent = `Updated ${timeAgo(state.updatedAt)}. Liked or commented recently?`;
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

/* ------------------------------------------------------------------ per-frame: labels + ruler */
const labelEls = new Map<number, HTMLElement>();
function frame() {
  if (!tower) return;
  placeLabels();
  // ruler thumb
  const n = state.floors.length;
  const p = (Math.min(tower.floorPos, n) - 1) / Math.max(1, n - 1);
  $("ruler-thumb").style.setProperty("--p", String(p));
  $("ruler-fill").style.setProperty("--p", String(p));
}
function floorChanged(f: number) {
  const n = state.floors.length;
  const fl = Math.min(f, n);
  const th = f > n ? null : themeOf(fl);
  $("now-text").textContent = th ? `Floor ${fmt(fl)} · ${th.name}` : `Floor ${fmt(n + 1)} · Your pick?`;
  $("ruler-val").textContent = fmt(Math.min(f, n + 1));
  $("ruler-track").setAttribute("aria-valuenow", String(fl));
}

function placeLabels() {
  if (!tower) return;
  const layer = $("labels");
  const [lo, hi] = tower.visibleRange();
  const n = state.floors.length;
  const sel = selectedFloor();
  const want: number[] = [];
  for (let f = hi; f >= lo; f--) want.push(f);
  if (sel && !want.includes(sel)) want.unshift(sel);
  const minY = $("now").getBoundingClientRect().bottom + 4;
  const panel = $("panel");
  const maxY = !panel.hidden && innerWidth < 760 ? panel.getBoundingClientRect().top - 4 : $("search-form").getBoundingClientRect().top - 6;
  const maxX = innerWidth < 760 ? $("ruler").getBoundingClientRect().left - 4 : !panel.hidden ? panel.getBoundingClientRect().left - 6 : layer.clientWidth - 64;
  const placed: DOMRect[] = [];
  const seen = new Set<number>();
  // selected first so it always wins
  want.sort((a, b) => (b === sel ? 1 : 0) - (a === sel ? 1 : 0));
  for (const f of want.slice(0, 9)) {
    const p = tower.project(f);
    let el = labelEls.get(f);
    if (!el) { el = document.createElement("div"); el.className = "label"; layer.appendChild(el); labelEls.set(f, el); }
    const isSel = f === sel && !tower.isFlying;
    const ghost = f === n + 1;
    const th = ghost ? null : themeOf(f);
    const who = ghost ? "like to build it" : pickerOf(f) ? `@${pickerOf(f)}` : f === 1 ? "the base" : th?.plain ? "one like" : "open world";
    const next = ghost ? state.queue[0] : undefined;
    const nextTheme = next && state.themes.find((t) => t.id === next.theme);
    const html = ghost
      ? `<b>Floor ${fmt(f)} · ${next?.label ? esc(next.label) : nextTheme ? esc(nextTheme.name) : "Your pick?"}</b><span>${next ? `next up: @${esc(next.handle)}` : esc(who)}</span>`
      : `<b>Floor ${fmt(f)} · ${esc(th!.name)}</b><span>${esc(who)}</span>`;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
    el.classList.toggle("is-selected", isSel);
    el.classList.toggle("is-ghost", ghost);
    if (th) el.style.setProperty("--accent", th.accent);
    seen.add(f);
    if (!p || !p.visible) { el.classList.remove("on"); continue; }
    const w = el.offsetWidth || 140, h = el.offsetHeight || 40;
    // labels sit outside the island edge, like the signs in the video
    let x = p.side > 0 ? p.x + 6 : p.x - w - 6;
    x = Math.max(6, Math.min(maxX - w, x));
    let y = p.y - h / 2;
    // the searched floor's sign is always shown: clamp it into the free band instead of hiding it
    if (isSel) y = Math.max(minY + 4, Math.min(maxY - h - 4, y));
    const r = new DOMRect(x, y, w, h);
    if (r.top < minY || r.bottom > maxY) { el.classList.remove("on"); continue; }
    if (!isSel && placed.some((q) => !(r.right < q.left || r.left > q.right || r.bottom < q.top - 4 || r.top > q.bottom + 4))) { el.classList.remove("on"); continue; }
    placed.push(r);
    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    el.classList.add("on");
  }
  for (const [f, el] of labelEls) if (!seen.has(f)) { el.classList.remove("on"); if (Math.abs(f - (tower.floorPos)) > 40) { el.remove(); labelEls.delete(f); } }
}

/* ------------------------------------------------------------------ ruler interaction */
{
  const track = $("ruler-track");
  let dragging = false;
  const floorAt = (clientY: number) => {
    const r = track.getBoundingClientRect();
    const p = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    return Math.round(1 + p * (state.floors.length - 1));
  };
  track.addEventListener("pointerdown", (e) => { dragging = true; track.setPointerCapture(e.pointerId); tower?.flyTo(floorAt(e.clientY), { select: false }); });
  track.addEventListener("pointermove", (e) => { if (dragging) tower?.flyTo(floorAt(e.clientY), { instant: true, select: false }); });
  track.addEventListener("pointerup", () => (dragging = false));
  track.addEventListener("keydown", (e) => {
    if (!tower) return;
    const cur = Math.round(tower.floorPos);
    const step = e.shiftKey ? 50 : 10;
    if (e.key === "ArrowUp") { e.preventDefault(); tower.flyTo(cur + step, { select: false }); }
    if (e.key === "ArrowDown") { e.preventDefault(); tower.flyTo(cur - step, { select: false }); }
    if (e.key === "Home") tower.flyTo(1, { select: false });
    if (e.key === "End") tower.flyTo(state.floors.length, { select: false });
  });
}

/* ------------------------------------------------------------------ selection & panels */
function selectedFloor(): number {
  if (!selected) return 0;
  if (selected.kind === "floor") return Number(selected.key);
  if (selected.kind === "handle") { const fl = byHandle.get(selected.key) ?? []; return fl.length ? Math.max(...fl) : 0; }
  const fl = byTheme.get(selected.key) ?? []; return fl.length ? Math.max(...fl) : 0;
}

function select(sel: { kind: Kind; key: string } | null, opts: { instant?: boolean } = {}) {
  selected = sel;
  const url = new URL(location.href);
  for (const k of ["u", "f", "w", "q"]) url.searchParams.delete(k);
  if (sel) url.searchParams.set(sel.kind === "handle" ? "u" : sel.kind === "floor" ? "f" : "w", sel.key);
  history.replaceState(null, "", url);
  const rs = $("ruler-sel");
  if (!sel) {
    $("panel").hidden = true; app.classList.remove("has-panel"); tower?.setInset(0, 0); tower?.clearSelection(); rs.hidden = true;
    return;
  }
  renderPanel();
  $("panel").hidden = false;
  app.classList.add("has-panel");
  syncInset();
  const f = selectedFloor();
  if (f) {
    tower?.flyTo(f, { instant: opts.instant });
    rs.hidden = false;
    rs.style.setProperty("--p", String((f - 1) / Math.max(1, state.floors.length - 1)));
  } else { tower?.clearSelection(); rs.hidden = true; }
  $("panel-close").focus({ preventScroll: true });
}

function syncInset() {
  if (!tower || $("panel").hidden) return;
  const r = $("panel").getBoundingClientRect();
  if (innerWidth >= 760) tower.setInset(innerWidth - r.left, 0);
  else tower.setInset(0, Math.max(0, innerHeight - r.top - 120));
}
addEventListener("resize", syncInset);

function floorButtons(floors: number[], max = 60) {
  const list = [...floors].sort((a, b) => b - a);
  return `<ol class="floor-list">${list.slice(0, max).map((f) => {
    const th = themeOf(f);
    return `<li><button type="button" data-floor="${f}" style="--c:${esc(th.top)}"><span class="fl-n">${fmt(f)}</span><span class="fl-e" aria-hidden="true">${th.emoji}</span><span class="fl-t">${esc(th.name)}</span>${pickerOf(f) && selected?.kind !== "handle" ? `<span class="fl-h">@${esc(pickerOf(f))}</span>` : ""}</button></li>`;
  }).join("")}</ol>${list.length > max ? `<p class="fine">+ ${fmt(list.length - max)} more floors</p>` : ""}`;
}
function commentBox(th: Theme) {
  const text = `${th.emoji} ${th.name.toLowerCase()}`;
  return `<div class="p-cta">
      <p>Want the next floor in ${esc(th.name)}? Comment this on the latest episode:</p>
      <div class="copy-row"><code>${esc(text)}</code><button type="button" class="btn btn-gold" data-copy="${esc(text)}">Copy</button></div>
      <div class="p-actions">
        ${state.links.latestEpisode ? `<a class="btn btn-cta" href="${esc(state.links.latestEpisode)}" target="_blank" rel="noopener">Open Day ${state.day} ↗</a>` : ""}
        <button type="button" class="btn btn-ghost" data-share>Share</button>
      </div>
    </div>`;
}

function renderPanel() {
  if (!selected) return;
  const body = $("panel-body");
  const n = state.floors.length;
  if (selected.kind === "floor") {
    const f = Number(selected.key);
    const [, , dayBuilt, dayPicked] = state.floors[f - 1];
    const th = themeOf(f), who = pickerOf(f);
    const theirs = who ? byHandle.get(who) ?? [] : [];
    say(`Floor ${f}, ${th.name}${who ? `, picked by @${who}` : ""}.`);
    body.innerHTML = `
      <div class="p-head">
        <div class="p-world" style="--c:${esc(th.top)};--r:${esc(th.rock)};--a:${esc(th.accent)}" aria-hidden="true">${th.emoji}</div>
        <div><p class="p-kicker">Floor ${fmt(f)} of ${fmt(n)}</p><h2 id="panel-title">${esc(th.name)}</h2></div>
      </div>
      <dl class="p-stats">
        <div><dt>Floor</dt><dd>${fmt(f)}</dd></div>
        <div><dt>Built</dt><dd>Day ${dayBuilt}</dd></div>
        <div><dt>Altitude</dt><dd>${fmt((f - 1) * 12)} m</dd></div>
      </dl>
      ${who ? `<button type="button" class="founder" data-handle="${esc(who)}" ${who === "anonymous" ? "disabled" : ""}>
          <span class="founder-tag">Floor ${fmt(f)} · ${esc(th.name)}</span><span class="founder-handle">@${esc(who)}</span>
          ${state.comments?.[String(f)] ? `<span class="founder-quote">“${esc(state.comments[String(f)])}”</span>` : ""}
          <span class="founder-sub">picked this world${dayPicked ? ` on day ${dayPicked}` : ""}${theirs.length > 1 ? ` · ${theirs.length} floors in total` : ""}</span>
        </button>`
        : `<p class="p-empty">${f === 1 ? "The base of the tower. Every floor above it was added by a like." : th.plain ? "A plain floor: one like, no world picked yet." + " Comment a world on the next episode to put your name on a floor." : "Nobody picked this floor's world, so the tower chose one. Comment a world on the next episode to put your name on a floor."}</p>`}
      <div class="nav-row">
        <button type="button" class="btn btn-ghost" data-floor="${Math.max(1, f - 1)}" ${f <= 1 ? "disabled" : ""}>↓ Floor ${fmt(Math.max(1, f - 1))}</button>
        <button type="button" class="btn btn-ghost" data-floor="${Math.min(n, f + 1)}" ${f >= n ? "disabled" : ""}>Floor ${fmt(Math.min(n, f + 1))} ↑</button>
      </div>
      ${commentBox(state.themes[state.floors[f - 1][0]])}`;
  } else if (selected.kind === "handle") {
    const h = selected.key;
    const floors = byHandle.get(h);
    const queued = state.queue.filter((q) => q.handle === h);
    if (!floors) {
      const { didYouMean } = search(items.filter((i) => i.kind === "handle"), h);
      say(`No floor for @${h} yet.`);
      body.innerHTML = `
        <div class="p-head"><div class="avatar" aria-hidden="true">@</div><div><p class="p-kicker">Builder</p><h2 id="panel-title">@${esc(h)}</h2></div></div>
        <p class="p-empty">No floor for <b>@${esc(h)}</b> yet. Commented a world recently? Your floor is added at the next daily update.</p>
        ${didYouMean ? `<p class="dym">Did you mean <button type="button" class="link-btn" data-handle="${esc(didYouMean.key)}">${esc(didYouMean.label)}</button>?</p>` : ""}
        ${commentBox(state.themes.find((t) => t.id === "lava") ?? state.themes[0])}`;
      return;
    }
    const top = floors.length ? Math.max(...floors) : 0;
    say(`@${h} found: ${floors.length} floor${floors.length === 1 ? "" : "s"}${top ? `, highest is floor ${top}` : ""}.`);
    const rank = state.builders.find((b) => b.handle === h)?.rank;
    body.innerHTML = `
      <div class="p-head">
        <div class="avatar" aria-hidden="true">${esc(h[0]?.toUpperCase() || "@")}</div>
        <div><p class="p-kicker">Builder${rank ? ` · #${rank}` : ""} · ${fmt(floors.length)} floor${floors.length === 1 ? "" : "s"}</p><h2 id="panel-title">@${esc(h)}</h2></div>
      </div>
      ${top ? `<button type="button" class="founder" data-floor="${top}">
          <span class="founder-tag">Floor ${fmt(top)} · ${esc(themeOf(top).name)}</span><span class="founder-handle">@${esc(h)}</span><span class="founder-sub">your highest floor</span>
        </button>` : ""}
      ${queued.length ? `<div class="queue">${queued.map((q) => `<p>⏳ <b>${esc(q.label ?? state.themes.find((t) => t.id === q.theme)?.name ?? q.theme)}</b> is in the queue for floor ${fmt(q.floor)} — ${fmt(q.floor - n)} more like${q.floor - n === 1 ? "" : "s"} to go.</p>`).join("")}</div>` : ""}
      ${floors.length ? `<h3 class="p-h3">Your floors</h3>${floorButtons(floors)}` : ""}
      ${commentBox(state.themes[state.floors[(top || 1) - 1][0]])}
      <p class="fine">Not you, or want your name off? <a href="mailto:bonjour@tazgo.ca?subject=Level%20Tower%20opt-out">Message us</a>.</p>`;
  } else {
    const th = state.themes.find((t) => t.id === selected!.key)!;
    const floors = byTheme.get(th.id) ?? [];
    say(`${th.name}: ${floors.length} floors.`);
    body.innerHTML = `
      <div class="p-head">
        <div class="p-world" style="--c:${esc(th.top)};--r:${esc(th.rock)};--a:${esc(th.accent)}" aria-hidden="true">${th.emoji}</div>
        <div><p class="p-kicker">World · ${fmt(floors.length)} floor${floors.length === 1 ? "" : "s"}</p><h2 id="panel-title">${esc(th.name)}</h2></div>
      </div>
      ${floors.length ? `<h3 class="p-h3">${esc(th.name)} floors</h3>${floorButtons(floors, 40)}` : `<p class="p-empty">No ${esc(th.name)} floor yet. Be the first to pick it!</p>`}
      ${commentBox(th)}`;
  }
}

/* ------------------------------------------------------------------ search combobox */
const input = $<HTMLInputElement>("search-input");
const list = $<HTMLUListElement>("search-list");
let active = -1;
let current: SearchItem[] = [];

function showSuggestions() {
  const q = input.value;
  const fl = floorQuery(q);
  const { results, didYouMean } = search(items, q, 7);
  current = fl ? [fl, ...results] : results.length ? results : didYouMean ? [didYouMean] : [];
  active = current.length ? 0 : -1;
  if (!q.trim()) { closeList(); return; }
  const icon = (it: SearchItem) => it.kind === "theme" ? `<span class="avatar sm theme" aria-hidden="true">${esc(it.label.split(" ")[0])}</span>`
    : it.kind === "floor" ? `<span class="avatar sm floor" aria-hidden="true">#</span>` : `<span class="avatar sm" aria-hidden="true">@</span>`;
  list.innerHTML = current.length
    ? (results.length || fl ? "" : `<li class="dym-head" role="presentation">Did you mean</li>`) + current.map((it, i) => `
      <li role="option" id="opt-${i}" aria-selected="${i === active}" data-i="${i}">
        ${icon(it)}<span class="o-main">${esc(it.kind === "theme" ? it.label.split(" ").slice(1).join(" ") : it.label)}</span><span class="o-sub">${esc(it.sub)}</span>
      </li>`).join("")
    : `<li class="none" role="presentation">No match. Commented recently? The tower updates daily.</li>`;
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
  if (modal) (d.querySelector("button, input") as HTMLElement | null)?.focus();
}
function closeDrawer(d: HTMLElement) {
  if (app.classList.contains("no-webgl") && d.id === "drawer-board") return;
  d.classList.remove("open");
  setTimeout(() => (d.hidden = true), reducedMotion ? 0 : 260);
  lastFocus?.focus({ preventScroll: true });
}
$("btn-board").addEventListener("click", () => openDrawer("drawer-board"));
$("btn-episodes").addEventListener("click", () => openDrawer("drawer-episodes"));
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
  const f = selectedFloor();
  const title = selected?.kind === "handle" ? `@${selected.key} built floor ${f} of the Level Tower` : f ? `Floor ${f} · ${themeOf(f).name} · Level Tower` : "Level Tower · 1 like = 1 floor";
  if (navigator.share) {
    try { await navigator.share({ title, text: "1 like = 1 floor. Pick the next world 🏰", url }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
  }
  await copy(url, "Link copied");
}
async function copy(text: string, msg = "Copied") {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast("Press and hold to copy"); }
}
$("btn-share").addEventListener("click", share);

document.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-floor],[data-handle],[data-theme],[data-copy],[data-share]");
  if (!t || t.closest("#search-list")) return;
  const d = t.closest<HTMLElement>(".drawer");
  if (d && !app.classList.contains("no-webgl") && !t.dataset.copy) closeDrawer(d);
  if (t.dataset.floor) select({ kind: "floor", key: t.dataset.floor });
  else if (t.dataset.handle) select({ kind: "handle", key: t.dataset.handle });
  else if (t.dataset.theme) select({ kind: "theme", key: t.dataset.theme });
  else if (t.dataset.copy) copy(t.dataset.copy, "Copied — paste it in the comments");
  else if (t.hasAttribute("data-share")) share();
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
