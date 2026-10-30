import "@fontsource-variable/unbounded";
import "@fontsource-variable/figtree";
import "../../../packages/brand/tokens.css";
import "./styles.css";
import type { GameState, ClubState } from "./types";
import { search, normalize, type SearchItem } from "./search";
import { Stadium, type SeatRef } from "./stadium";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (n: number) => n.toLocaleString("en-US");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const CONTACT = "bonjour@tazgo.ca";

const app = $("app");
let state: GameState;
let stadium: Stadium | null = null;
let items: SearchItem[] = [];
let selected: { kind: "club" | "handle"; key: string; club?: string } | null = null;
let seat: SeatRef | null = null;

/* ------------------------------------------------------------------ crest (club badge) */
function initials(name: string) {
  const w = name.replace(/\b(FC|CF|SC|AC|AS|CD|FK|SK|SV|AFC|Club|de|of|the|da|du)\b/gi, " ").trim().split(/\s+/).filter(Boolean);
  return (w.length >= 2 ? w[0][0] + w[1][0] : (w[0] || name).slice(0, 2)).toUpperCase();
}
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function crest(colors: [string, string], name: string, size = 28) {
  const [a, b] = colors;
  const fg = lum(a) > 0.62 ? "#151a3a" : "#fff";
  return `<svg class="crest" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
    <path d="M16 1.5 29 5.6v9.2c0 7.6-5.4 13.3-13 15.7C8.4 28.1 3 22.4 3 14.8V5.6Z" fill="${esc(a)}" stroke="#151a3a" stroke-width="1.4"/>
    <path d="M16 1.5V30.5C8.4 28.1 3 22.4 3 14.8V5.6Z" fill="${esc(b)}" opacity=".9"/>
    <rect x="3.5" y="11.5" width="25" height="8" fill="${esc(a)}"/>
    <text x="16" y="17.9" text-anchor="middle" font-family="Unbounded Variable, Arial Black, sans-serif" font-weight="800" font-size="6.6" fill="${fg}">${esc(initials(name))}</text>
  </svg>`;
}

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
    $("loader").innerHTML = `<span>Couldn't open the stadium. <a href="">Try again</a></span>`;
    return;
  }
  buildIndex();
  renderStatic();
  // banners are drawn on canvas: make sure the display font is ready first
  try { await Promise.race([document.fonts.load('800 64px "Unbounded Variable"'), new Promise((r) => setTimeout(r, 1500))]); } catch { /* fallback font */ }

  if (webglAvailable()) {
    try {
      stadium = new Stadium($<HTMLCanvasElement>("scene"), {
        reducedMotion,
        onPick: (p) => { if (!p) return; if (p.handle) select({ kind: "handle", key: p.handle, club: p.club }); else select({ kind: "club", key: p.club }); },
        onFrame: placeLabels,
      });
      stadium.setState(state);
      stadium.start();
      document.addEventListener("visibilitychange", () => (document.hidden ? stadium?.stop() : stadium?.start()));
    } catch (e) {
      console.warn("WebGL failed, using list view", e);
      stadium = null;
    }
  }
  if (!stadium) { app.classList.add("no-webgl"); openDrawer("drawer-board", false); }
  app.dataset.state = "ready";
  $("loader").remove();

  // deep links: ?u=handle, ?c=club-id, ?q=free text
  const q = new URLSearchParams(location.search);
  const u = q.get("u") && normalize(q.get("u")!);
  const c = q.get("c");
  if (u) select({ kind: "handle", key: u }, { instant: false });
  else if (c && state.clubs[c]) select({ kind: "club", key: c });
  else if (q.get("q")?.trim()) {
    const text = q.get("q")!.trim();
    const { results, didYouMean } = search(items, text, 1);
    const best = results[0] ?? didYouMean;
    if (best) select({ kind: best.kind, key: best.key });
    else { input.value = text; showSuggestions(); }
  } else stadium?.overview({ instant: true });

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
    stadium?.setState(state);
    if (selected) select(selected, { instant: true });
    toast("The stadium just grew");
  } catch { /* offline: keep current */ }
}

/* ------------------------------------------------------------------ static UI */
function buildIndex() {
  items = [
    ...state.leaderboard.map((r) => ({ kind: "club" as const, key: r.id, label: r.name, sub: `#${r.rank} · ${fmt(r.seats)} seats`, terms: [normalize(r.name), normalize(r.banner)] })),
    ...Object.entries(state.handles).map(([h, v]) => {
      const n = Object.keys(v.clubs).length;
      return { kind: "handle" as const, key: h, label: `@${h}`, sub: v.founderOf.length ? `Founder · ${n} seat${n > 1 ? "s" : ""}` : `${n} seat${n > 1 ? "s" : ""}`, terms: [h] };
    }),
  ];
}

function renderStatic() {
  const t = state.totals;
  $("stat-day").textContent = fmt(state.day);
  $("stat-clubs").textContent = fmt(t.clubs);
  $("goal-lv").textContent = `LV${t.level}`;
  $("goal-seats").textContent = fmt(t.seats);
  $("goal-max").textContent = fmt(t.goal);
  $("goal-name").textContent = t.nextLevelSeats ? `${t.levelName} · next level at ${fmt(t.nextLevelSeats)}` : t.levelName;
  const bar = $("goal-bar");
  bar.style.setProperty("--p", `${Math.min(100, (t.seats / t.goal) * 100)}%`);
  bar.setAttribute("aria-valuenow", String(t.seats));
  bar.setAttribute("aria-valuemax", String(t.goal));
  bar.innerHTML = `<i></i>${state.rules.levels.filter((l) => l.seats > 0 && l.seats < t.goal).map((l) => `<b class="tick ${t.seats >= l.seats ? "on" : ""}" style="left:${(l.seats / t.goal) * 100}%" title="LV${l.level} ${esc(l.name)}"></b>`).join("")}`;

  $("top3-list").innerHTML = state.leaderboard.slice(0, 3).map((r) => `
    <li><button type="button" data-club="${esc(r.id)}"><span class="rank r${r.rank}">${r.rank}</span>${crest(r.colors, r.name, 24)}<span class="name">${esc(r.name)}</span><span class="lv">${fmt(r.seats)}</span></button></li>`).join("")
    || `<li class="empty">No stands yet — be the first!</li>`;

  renderBoard("");
  $("sr-board").innerHTML = state.leaderboard.map((r) => `<li>${esc(r.name)}: ${r.seats} seats, ${r.fans} fans, founded by ${esc(r.founder)}</li>`).join("");

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
  $("cta-episode-text").textContent = `Comment your club · Day ${state.day}`;
  $("socials").innerHTML = socialLinks(state.links, "Stadium Builder on ", true);
  $("updated").textContent = `Updated ${timeAgo(state.updatedAt)}. Commented recently?`;
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
  const max = state.leaderboard[0]?.seats || 1;
  const rows = state.leaderboard.filter((r) => !f || normalize(r.name).includes(f) || normalize(r.banner).includes(f));
  $("board-list").innerHTML = rows.map((r) => `
    <li><button type="button" data-club="${esc(r.id)}">
      <span class="rank r${r.rank}">${r.rank}</span>${crest(r.colors, r.name, 30)}
      <span class="b-main"><span class="name">${esc(r.name)}</span><span class="bar" style="--p:${(r.seats / max) * 100}%;--c:${esc(r.colors[0])};--c2:${esc(r.colors[1])}"><i></i></span></span>
      <span class="b-side"><span class="lv">${fmt(r.fans)} fans</span><span class="flags">${fmt(r.seats)} <small>seats</small></span></span>
    </button></li>`).join("") || `<li class="empty">${f ? "No club matches." : "No stands yet — the first comment founds a club's stand."}</li>`;
}

/* ------------------------------------------------------------------ labels over the stadium */
const labelEls = new Map<string, HTMLElement>();
function placeLabels() {
  if (!stadium) return;
  const layer = $("labels");
  const showClubs = !(selected?.kind === "handle" && stadium.highlightVisible) && !stadium.isFlying;
  const want = showClubs ? state.leaderboard.slice(0, innerWidth < 700 ? 5 : 9).map((r) => r.id) : [];
  if (showClubs && selected?.kind === "club") { const i = want.indexOf(selected.key); if (i >= 0) want.splice(i, 1); want.unshift(selected.key); }
  const minY = $("hud-top-anchor").getBoundingClientRect().bottom + 4;
  const panel = $("panel");
  const maxY = !panel.hidden && innerWidth < 760 ? panel.getBoundingClientRect().top - 4 : $("search-form").getBoundingClientRect().top - 4;
  const placed: DOMRect[] = app.classList.contains("has-panel") ? [] : [$("top3").getBoundingClientRect()];
  const seen = new Set<string>();
  for (const id of want) {
    const pos = stadium.clubLabelPos(id);
    const c = state.clubs[id];
    if (!pos || !c) continue;
    let el = labelEls.get(id);
    if (!el) { el = document.createElement("div"); el.className = "label"; layer.appendChild(el); labelEls.set(id, el); }
    const html = `<b>${esc(c.name)} · ${fmt(c.seats)}</b><span>★ Founder @${esc(c.founder)}</span>`;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
    el.style.setProperty("--c", c.colors[0]);
    el.classList.toggle("is-selected", selected?.kind === "club" && selected.key === id);
    seen.add(id);
    const p = stadium.project(pos);
    if (!p.visible) { el.classList.remove("on"); continue; }
    const w = el.offsetWidth || 140, h = el.offsetHeight || 40;
    const W = layer.clientWidth;
    p.x = Math.min(W - w / 2 - 6, Math.max(w / 2 + 6, p.x));
    const r = new DOMRect(p.x - w / 2, p.y - h - 8, w, h);
    const isSel = el.classList.contains("is-selected");
    if (r.top < minY || r.bottom + 8 > maxY) { el.classList.remove("on"); continue; }
    if (!isSel && placed.some((q) => !(r.right < q.left || r.left > q.right || r.bottom < q.top || r.top > q.bottom))) { el.classList.remove("on"); continue; }
    placed.push(r);
    el.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0) translate(-50%, -100%) translate(0, -8px)`;
    el.classList.add("on");
  }
  for (const [id, el] of labelEls) if (!seen.has(id)) el.classList.remove("on");

  // the floating name tag over a fan's seat
  const tag = $("seat-tag");
  if (seat && selected?.kind === "handle" && stadium.highlightVisible) {
    const p = stadium.project(seat.pos.clone().setY(seat.pos.y + 1.6));
    if (p.visible) {
      if (tag.hidden) { tag.hidden = false; tag.classList.remove("pop"); void tag.offsetWidth; tag.classList.add("pop"); }
      tag.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`;
    } else tag.hidden = true;
  } else tag.hidden = true;
}

/* ------------------------------------------------------------------ selection & panels */
function select(sel: { kind: "club" | "handle"; key: string; club?: string } | null, opts: { instant?: boolean } = {}) {
  selected = sel;
  seat = null;
  const url = new URL(location.href);
  for (const k of ["c", "u", "q"]) url.searchParams.delete(k);
  if (sel) url.searchParams.set(sel.kind === "club" ? "c" : "u", sel.key);
  history.replaceState(null, "", url);
  $("seat-tag").hidden = true;
  if (!sel) {
    $("panel").hidden = true; app.classList.remove("has-panel");
    stadium?.setInset(0, 0); stadium?.clearHighlight(); stadium?.overview();
    return;
  }
  renderPanel();
  $("panel").hidden = false;
  app.classList.add("has-panel");
  syncInset();
  if (sel.kind === "club") stadium?.focusClub(sel.key, opts);
  else if (stadium) {
    seat = stadium.seatOf(sel.key, sel.club);
    if (seat) {
      const c = state.clubs[seat.club];
      $("seat-tag").innerHTML = `<div class="tag-card" style="--c:${esc(c.colors[0])};--c2:${esc(c.colors[1])}"><span class="tag-club">${crest(c.colors, c.name, 18)}${esc(c.banner)}</span><b>@${esc(sel.key)}</b><span class="tag-seat">Block ${c.rank} · Row ${seat.row} · Seat ${seat.seatInRow}</span></div>`;
      if (!opts.instant && !reducedMotion) toast(`Finding @${sel.key}'s seat…`);
      stadium.focusSeat(seat, opts);
    }
  }
  $("panel-close").focus({ preventScroll: true });
}

function syncInset() {
  if (!stadium || $("panel").hidden) return;
  const r = $("panel").getBoundingClientRect();
  if (innerWidth >= 760) stadium.setInset(innerWidth - r.left, 0);
  else stadium.setInset(0, Math.max(0, innerHeight - r.top - 40));
}
addEventListener("resize", syncInset);

function ticket(handle: string, clubId: string, f: { comments: number; fan: number; day: number }) {
  const c = state.clubs[clubId];
  const ref = stadium?.seatOf(handle, clubId);
  return `<button type="button" class="ticket" data-handle="${esc(handle)}" data-seat-club="${esc(clubId)}" style="--c:${esc(c.colors[0])};--c2:${esc(c.colors[1])}">
    <span class="t-left">${crest(c.colors, c.name, 34)}<span><b>${esc(c.name)}</b><small>${c.founder === handle ? "★ Founder · " : ""}${fmt(f.comments)} comment${f.comments > 1 ? "s" : ""} · since day ${f.day}</small></span></span>
    <span class="t-right">${ref ? `<span><small>Block</small><b>${c.rank}</b></span><span><small>Row</small><b>${ref.row}</b></span><span><small>Seat</small><b>${ref.seatInRow}</b></span>` : `<span><small>Seat</small><b>—</b></span>`}</span>
  </button>`;
}

function renderPanel() {
  if (!selected) return;
  const body = $("panel-body");
  const latest = state.links.latestEpisode;
  if (selected.kind === "club") {
    const id = selected.key;
    const c: ClubState | undefined = state.clubs[id];
    if (!c) return;
    const commentText = `⚽ ${c.name}`;
    say(`${c.name}: rank ${c.rank}, ${c.seats} seats, ${c.fans} fans, founded by ${c.founder}.`);
    body.innerHTML = `
      <div class="p-head">
        ${crest(c.colors, c.name, 60)}
        <div>
          <p class="p-kicker">Block ${c.rank} · Founded day ${c.foundedDay}</p>
          <h2 id="panel-title">${esc(c.name)}</h2>
        </div>
      </div>
      <div class="stand-strip" style="--c:${esc(c.colors[0])};--c2:${esc(c.colors[1])}" aria-hidden="true"></div>
      <dl class="p-stats">
        <div><dt>Seats</dt><dd>${fmt(c.seats)}</dd></div>
        <div><dt>Fans</dt><dd>${fmt(c.fans)}</dd></div>
        <div><dt>Comments</dt><dd>${fmt(c.comments)}</dd></div>
      </dl>
      <button type="button" class="founder" data-handle="${esc(c.founder)}" data-seat-club="${esc(id)}" ${c.founder === "anonymous" ? "disabled" : ""}>
        <span class="founder-tag">${esc(c.banner)} · Founder</span><span class="founder-handle">@${esc(c.founder)}</span>
      </button>
      ${c.topFans.length ? `<h3 class="p-h3">Loudest fans</h3><ol class="commanders">${c.topFans.map((t, i) => `
        <li><button type="button" data-handle="${esc(t.handle)}" data-seat-club="${esc(id)}"><span class="rank">${i + 1}</span><span class="name">@${esc(t.handle)}</span><span class="flags">${fmt(t.comments)} 💬</span></button></li>`).join("")}</ol>` : ""}
      <div class="p-cta">
        <p>Add 100 seats to the ${esc(c.name)} stand: comment this on the latest episode.</p>
        <div class="copy-row"><code>${esc(commentText)}</code><button type="button" class="btn btn-gold" data-copy="${esc(commentText)}">Copy</button></div>
        <div class="p-actions">
          ${latest ? `<a class="btn btn-cta" href="${esc(latest)}" target="_blank" rel="noopener">Open Day ${state.day} ↗</a>` : ""}
          <button type="button" class="btn btn-ghost" data-share>Share</button>
        </div>
      </div>`;
    return;
  }
  const h = selected.key;
  const u = state.handles[h];
  if (!u) {
    const { didYouMean } = search(items.filter((i) => i.kind === "handle"), h);
    say(`No seat for @${h} yet.`);
    body.innerHTML = `
      <div class="p-head"><div class="avatar" aria-hidden="true">@</div><div><p class="p-kicker">Fan</p><h2 id="panel-title">@${esc(h)}</h2></div></div>
      <p class="p-empty">No seat for <b>@${esc(h)}</b> yet. Commented recently? Your seat is added at the next daily update.</p>
      ${didYouMean ? `<p class="dym">Did you mean <button type="button" class="link-btn" data-handle="${esc(didYouMean.key)}">${esc(didYouMean.label)}</button>?</p>` : ""}
      <div class="p-actions">${latest ? `<a class="btn btn-cta" href="${esc(latest)}" target="_blank" rel="noopener">Comment your club · Day ${state.day} ↗</a>` : ""}</div>`;
    return;
  }
  const rows = Object.entries(u.clubs).sort((a, b) => (a[0] === seat?.club ? -1 : b[0] === seat?.club ? 1 : b[1].comments - a[1].comments));
  say(`Found @${h}: ${rows.length} seat${rows.length > 1 ? "s" : ""}${seat ? `, block ${state.clubs[seat.club].rank}, row ${seat.row}, seat ${seat.seatInRow}` : ""}.`);
  body.innerHTML = `
    <div class="p-head"><div class="avatar" aria-hidden="true">${esc(h[0]?.toUpperCase() || "@")}</div>
      <div><p class="p-kicker">Fan · ${fmt(u.total)} comment${u.total === 1 ? "" : "s"}</p><h2 id="panel-title">@${esc(h)}</h2></div></div>
    ${u.founderOf.length ? `<div class="badges">${u.founderOf.map((c) => `<span class="badge">★ Founder of ${esc(state.clubs[c]?.name ?? c)}</span>`).join("")}</div>` : ""}
    <h3 class="p-h3">${rows.length > 1 ? "Your seats" : "Your seat"}</h3>
    <div class="tickets">${rows.map(([c, f]) => ticket(h, c, f)).join("")}</div>
    <div class="p-actions">
      ${latest ? `<a class="btn btn-cta" href="${esc(latest)}" target="_blank" rel="noopener">Add seats to your stand ↗</a>` : ""}
      <button type="button" class="btn btn-ghost" data-share>Share my seat</button>
    </div>
    <p class="fine">Not you, or want your name off? <a href="mailto:${CONTACT}?subject=Stadium%20Builder%20opt-out">Message us</a>.</p>`;
}

/* ------------------------------------------------------------------ search combobox */
const input = $<HTMLInputElement>("search-input");
const list = $<HTMLUListElement>("search-list");
let active = -1;
let current: SearchItem[] = [];

function itemIcon(it: SearchItem) {
  if (it.kind === "club") { const c = state.clubs[it.key]; return c ? crest(c.colors, c.name, 26) : ""; }
  return `<span class="avatar sm" aria-hidden="true">@</span>`;
}
function showSuggestions() {
  const q = input.value;
  const { results, didYouMean } = search(items, q, 7);
  current = results.length ? results : didYouMean ? [didYouMean] : [];
  active = current.length ? 0 : -1;
  if (!q.trim()) { closeList(); return; }
  list.innerHTML = current.length
    ? (results.length ? "" : `<li class="dym-head" role="presentation">Did you mean</li>`) + current.map((it, i) => `
      <li role="option" id="opt-${i}" aria-selected="${i === active}" data-i="${i}">
        ${itemIcon(it)}<span class="o-main">${esc(it.label)}</span><span class="o-sub">${esc(it.sub)}</span>
      </li>`).join("")
    : `<li class="none" role="presentation">No match. Commented recently? The stadium updates daily.</li>`;
  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-activedescendant", active >= 0 ? `opt-${active}` : "");
}
function closeList() { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); }
function choose(it: SearchItem | undefined) {
  if (!it) { const q = normalize(input.value); if (q) select({ kind: "handle", key: q }); closeList(); return; }
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
$("btn-overview").addEventListener("click", () => select(null));
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
  const c = selected?.kind === "club" ? state.clubs[selected.key] : null;
  const title = c ? `${c.name} has ${fmt(c.seats)} seats in Stadium Builder` : selected?.kind === "handle" ? `Find @${selected.key}'s seat in Stadium Builder` : "Stadium Builder · 1 club = 1 stand";
  if (navigator.share) {
    try { await navigator.share({ title, text: "1 club = 1 stand. Comment your club and get your seat ⚽", url }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
  }
  await copy(url, "Link copied");
}
async function copy(text: string, msg = "Copied") {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast("Press and hold to copy"); }
}
$("btn-share").addEventListener("click", share);

document.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-club],[data-handle],[data-copy],[data-share]");
  if (!t || t.closest("#search-list")) return;
  if (t.dataset.club) {
    const d = t.closest<HTMLElement>(".drawer");
    if (d && !app.classList.contains("no-webgl")) closeDrawer(d);
    select({ kind: "club", key: t.dataset.club });
  } else if (t.dataset.handle) select({ kind: "handle", key: t.dataset.handle, club: t.dataset.seatClub });
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
