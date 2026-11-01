/**
 * "Play our games" promotion shown on every live-series site.
 *
 *  - A slim pinned bar at the very top with the icons of the games that are out (featured game first).
 *  - A one-a-day popup featuring the featured game, shown at the best moment: right after the visitor finds
 *    their name (the URL gains ?u=…), or after 40 s on the page. Never on arrival.
 *  - Smart store links: Android → Google Play, iPhone → App Store. When the visitor's store has no version yet
 *    (e.g. an Android-only game on an iPhone) or on desktop, the link opens the game's page on the studio site,
 *    which shows every store button and a QR code. Sending an iPhone to Google Play would be a dead end.
 *
 * Data: the studio publishes https://whiskerworks.games/api/games.json, so a game going live is one edit in the
 * studio repo and every series picks it up without being rebuilt. If the feed can't be fetched, nothing is shown.
 */
const FEED = "https://whiskerworks.games/api/games.json";
const POPUP_KEY = "ww-promo-popup";
const DAY = 24 * 3600 * 1000;

interface PromoGame {
  id: string; title: string; short: string; tagline: string; genre: string; featured: boolean;
  icon: string | null; page: string; appStore: string | null; googlePlay: string | null;
}

type Device = "ios" | "android" | "desktop";
const device = (): Device => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "desktop";
};

function withUtm(url: string, source: string, placement: string, id: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "play.google.com") u.searchParams.set("referrer", `utm_source=${source}&utm_medium=${placement}&utm_campaign=cross_promo&utm_content=${id}`);
    else if (u.hostname === "apps.apple.com") u.searchParams.set("ct", `${source}-${placement}`);
    else { u.searchParams.set("utm_source", source); u.searchParams.set("utm_medium", placement); u.searchParams.set("utm_campaign", "cross_promo"); }
    return u.toString();
  } catch { return url; }
}

/** Where a tap should go for this visitor, and what to say on the button. */
function target(g: PromoGame, d: Device): { url: string; store: "google_play" | "app_store" | "page"; cta: string } {
  if (d === "android" && g.googlePlay) return { url: g.googlePlay, store: "google_play", cta: "Get it free on Google Play" };
  if (d === "ios" && g.appStore) return { url: g.appStore, store: "app_store", cta: "Get it free on the App Store" };
  if (d === "ios" && !g.appStore) return { url: g.page, store: "page", cta: "Android now · iPhone soon" };
  return { url: g.page, store: "page", cta: "Play free" };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function initPromo(series: string): Promise<void> {
  let games: PromoGame[] = [];
  try {
    const r = await fetch(FEED, { cache: "no-cache" });
    if (!r.ok) return;
    games = ((await r.json()).games ?? []).filter((g: PromoGame) => g.appStore || g.googlePlay);
  } catch { return; }
  if (!games.length) return;
  const d = device();
  const featured = games.find((g) => g.featured) ?? games[0];
  injectStyle();

  const track = (g: PromoGame, placement: string, store: string) => window.wwTrack?.("promo_click", { game: g.id, placement, store, device: d });
  const link = (g: PromoGame, placement: string) => {
    const t = target(g, d);
    return { href: withUtm(t.url, series, placement, g.id), ...t };
  };

  /* ---------- pinned bar ---------- */
  const bar = document.createElement("nav");
  bar.className = "ww-promo-bar";
  bar.setAttribute("aria-label", "Play WhiskerWorks games");
  bar.innerHTML = `
    <span class="ww-pb-label"><b>🎮 Play our games</b><small>free</small></span>
    <ul class="ww-pb-list">${games
      .map((g) => {
        const l = link(g, "promo_bar");
        return `<li><a href="${esc(l.href)}" data-id="${esc(g.id)}" data-store="${l.store}" rel="noopener" title="${esc(g.title)}: ${esc(l.cta)}"${g.featured ? ' class="is-featured"' : ""}>
          ${g.icon ? `<img src="${esc(g.icon)}" alt="" width="34" height="34" loading="eager" decoding="async">` : ""}<span>${esc(g.short)}</span></a></li>`;
      })
      .join("")}</ul>`;
  bar.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-id]");
    const g = a && games.find((x) => x.id === a.dataset.id);
    if (g && a) track(g, "promo_bar", a.dataset.store!);
  });
  document.body.prepend(bar);
  document.documentElement.classList.add("ww-has-promo");
  // The 3D scenes size themselves from their canvas: tell them the viewport changed.
  requestAnimationFrame(() => dispatchEvent(new Event("resize")));

  /* ---------- popup ---------- */
  let shown = false;
  let last = 0;
  try { last = Number(localStorage.getItem(POPUP_KEY) || 0); } catch { /* private mode */ }
  const eligible = () => !shown && Date.now() - last > DAY;
  const open = (reason: string) => {
    if (!eligible()) return;
    shown = true;
    try { localStorage.setItem(POPUP_KEY, String(Date.now())); } catch { /* ignore */ }
    const l = link(featured, "promo_popup");
    const others = games.filter((g) => g.id !== featured.id).slice(0, 4);
    const dlg = document.createElement("div");
    dlg.className = "ww-pp";
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-labelledby", "ww-pp-title");
    dlg.innerHTML = `
      <div class="ww-pp-card">
        <button type="button" class="ww-pp-x" aria-label="Close">✕</button>
        <p class="ww-pp-kicker">${reason === "found" ? "Nice! While you’re here…" : "Made by the same team"}</p>
        <h2 id="ww-pp-title">Try our games, free</h2>
        <a class="ww-pp-hero" href="${esc(l.href)}" data-id="${esc(featured.id)}" data-store="${l.store}" rel="noopener">
          ${featured.icon ? `<img src="${esc(featured.icon)}" alt="" width="88" height="88">` : ""}
          <span><b>${esc(featured.title)}</b><small>${esc(featured.tagline)}</small></span>
        </a>
        <a class="ww-pp-cta" href="${esc(l.href)}" data-id="${esc(featured.id)}" data-store="${l.store}" rel="noopener">${esc(l.cta)}</a>
        ${others.length ? `<ul class="ww-pp-more">${others.map((g) => { const o = link(g, "promo_popup"); return `<li><a href="${esc(o.href)}" data-id="${esc(g.id)}" data-store="${o.store}" rel="noopener">${g.icon ? `<img src="${esc(g.icon)}" alt="" width="44" height="44">` : ""}<span>${esc(g.short)}</span></a></li>`; }).join("")}</ul>` : ""}
        <button type="button" class="ww-pp-later">Maybe later</button>
      </div>`;
    const close = () => { dlg.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    dlg.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t === dlg || t.closest(".ww-pp-x, .ww-pp-later")) { close(); return; }
      const a = t.closest<HTMLAnchorElement>("a[data-id]");
      const g = a && games.find((x) => x.id === a.dataset.id);
      if (g && a) track(g, "promo_popup", a.dataset.store!);
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(dlg);
    dlg.querySelector<HTMLAnchorElement>(".ww-pp-cta")?.focus();
    window.wwTrack?.("promo_popup_view", { game: featured.id, reason });
  };

  // Best moment: a few seconds after someone finds their name (every series puts ?u= in the URL then).
  let foundTimer = 0;
  const watch = () => {
    if (new URLSearchParams(location.search).get("u") && eligible() && !foundTimer) foundTimer = window.setTimeout(() => open("found"), 5000);
  };
  for (const m of ["pushState", "replaceState"] as const) {
    const orig = history[m].bind(history);
    history[m] = (...args: Parameters<History["pushState"]>) => { orig(...args); watch(); };
  }
  watch();
  window.setTimeout(() => open("time"), 40000);
}

function injectStyle(): void {
  const s = document.createElement("style");
  s.textContent = `
  :root{--ww-promo-h:46px}
  .ww-has-promo #app.app{top:var(--ww-promo-h)!important}
  .ww-promo-bar{position:fixed;z-index:8000;top:0;left:0;right:0;height:var(--ww-promo-h);display:flex;align-items:center;gap:10px;padding:0 max(10px,env(safe-area-inset-left));
    background:#fff8ee;color:#1a1424;border-bottom:2px solid #1a1424;font-family:"Figtree Variable",Figtree,system-ui,sans-serif}
  .ww-pb-label{display:flex;flex-direction:column;line-height:1.05;white-space:nowrap}
  .ww-pb-label b{font:800 12px/1.1 "Unbounded Variable",Unbounded,system-ui,sans-serif;letter-spacing:-.01em}
  .ww-pb-label small{font-weight:800;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#a43d00}
  .ww-pb-list{display:flex;gap:6px;list-style:none;margin:0;padding:0;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}
  .ww-pb-list::-webkit-scrollbar{display:none}
  .ww-pb-list a{display:flex;align-items:center;gap:6px;height:36px;padding:0 10px 0 2px;border-radius:999px;border:1.5px solid #1a1424;background:#fff;color:#1a1424;text-decoration:none;font-weight:800;font-size:13px;white-space:nowrap}
  .ww-pb-list a.is-featured{background:#ff7a2f;box-shadow:0 2px 0 #1a1424}
  .ww-pb-list img{width:30px;height:30px;border-radius:8px}
  @media (max-width:420px){.ww-pb-list a span{display:none}.ww-pb-list a{padding:0 2px}.ww-pb-list a.is-featured span{display:inline}.ww-pb-list a.is-featured{padding-right:10px}}
  .ww-pp{position:fixed;inset:0;z-index:9500;display:grid;place-items:center;padding:16px;background:rgb(10 8 16/.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);animation:wwppf .25s ease-out}
  @keyframes wwppf{from{opacity:0}}
  .ww-pp-card{position:relative;width:min(380px,100%);padding:22px 18px 14px;border-radius:24px;background:#fff8ee;color:#1a1424;border:2px solid #1a1424;box-shadow:7px 7px 0 #1a1424;
    font-family:"Figtree Variable",Figtree,system-ui,sans-serif;text-align:center;animation:wwppc .35s cubic-bezier(.34,1.56,.64,1)}
  @keyframes wwppc{from{transform:translateY(18px) scale(.96);opacity:0}}
  .ww-pp-x{position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:50%;border:2px solid #1a1424;background:#fff8ee;cursor:pointer;font-size:14px;color:#1a1424}
  .ww-pp-kicker{margin:0;font-weight:800;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a43d00}
  .ww-pp h2{margin:6px 0 14px;font:800 22px/1.1 "Unbounded Variable",Unbounded,system-ui,sans-serif;letter-spacing:-.03em}
  .ww-pp-hero{display:flex;align-items:center;gap:12px;padding:10px;border-radius:18px;border:2px solid #1a1424;background:#fff;text-align:left;text-decoration:none;color:#1a1424}
  .ww-pp-hero img{width:76px;height:76px;border-radius:18px;flex:none}
  .ww-pp-hero b{display:block;font:800 17px/1.15 "Unbounded Variable",Unbounded,system-ui,sans-serif;letter-spacing:-.02em}
  .ww-pp-hero small{display:block;margin-top:4px;font-size:13px;line-height:1.35;color:#3b3346}
  .ww-pp-cta{display:flex;align-items:center;justify-content:center;min-height:50px;margin-top:12px;border-radius:999px;border:2px solid #1a1424;background:#ff7a2f;color:#1a1424;font-weight:800;font-size:16px;text-decoration:none;box-shadow:0 4px 0 #1a1424}
  .ww-pp-more{display:flex;justify-content:center;gap:10px;list-style:none;margin:16px 0 4px;padding:0}
  .ww-pp-more a{display:flex;flex-direction:column;align-items:center;gap:4px;width:64px;color:#1a1424;text-decoration:none;font-size:11px;font-weight:700}
  .ww-pp-more img{width:44px;height:44px;border-radius:12px;border:1.5px solid #1a1424}
  .ww-pp-more span{max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ww-pp-later{margin-top:6px;min-height:40px;border:0;background:none;color:#6a6176;font-weight:700;cursor:pointer}
  @media (prefers-reduced-motion:reduce){.ww-pp,.ww-pp-card{animation:none}}`;
  document.head.appendChild(s);
}
