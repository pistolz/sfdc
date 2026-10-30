/**
 * Shared Google Analytics 4 for the live-series microsites (Consent Mode v2, Law 25 / GDPR friendly).
 * Enabled only when VITE_GA4_ID is set at build time. Nothing is stored until the visitor accepts.
 *
 * Automatic events:
 *  - page_view (GA4 default)
 *  - find_name    when the URL gains ?u= (a handle was searched / opened)
 *  - select_item  when the URL gains another deep-link param (?c= ?q= ?m= ?l=)
 *  - outbound_click on links to other sites (Instagram, TikTok…)
 * Apps can also call window.wwTrack(name, params).
 */
type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window { dataLayer: unknown[]; gtag?: Gtag; wwTrack?: (name: string, params?: Record<string, unknown>) => void }
}

const KEY = 'ww-consent';

export function initAnalytics(series: string): void {
  const id = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_GA4_ID;
  if (!id || typeof window === 'undefined') return;

  let stored: string | null = null;
  try { stored = localStorage.getItem(KEY); } catch { /* private mode */ }

  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  const gtag: Gtag = function () { window.dataLayer.push(arguments); };
  window.gtag = gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: stored === 'granted' ? 'granted' : 'denied', wait_for_update: 500,
  });
  gtag('js', new Date());
  gtag('config', id, { anonymize_ip: true, series });
  window.wwTrack = (name, params = {}) => gtag('event', name, { series, ...params });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);

  if (!stored) showBanner(gtag);

  // Deep-link changes → events (every app updates the URL when something is selected).
  let last = '';
  const onUrl = () => {
    const p = new URLSearchParams(location.search);
    const key = ['u', 'c', 'q', 'm', 'l'].map((k) => `${k}=${p.get(k) ?? ''}`).join('&');
    if (key === last) return;
    last = key;
    if (p.get('u')) window.wwTrack?.('find_name', { handle: p.get('u') });
    else for (const k of ['c', 'q', 'm', 'l']) if (p.get(k)) { window.wwTrack?.('select_item', { item_type: k, item_id: p.get(k) }); break; }
  };
  for (const m of ['pushState', 'replaceState'] as const) {
    const orig = history[m].bind(history);
    history[m] = (...args: Parameters<History['pushState']>) => { orig(...args); onUrl(); };
  }
  onUrl();
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest?.('a');
    if (a && a.host && a.host !== location.host) window.wwTrack?.('outbound_click', { link_url: a.href, link_domain: a.host });
  });
}

function showBanner(gtag: Gtag): void {
  const box = document.createElement('div');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Cookie preferences');
  box.style.cssText =
    'position:fixed;z-index:9999;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));max-width:420px;margin:0 auto;padding:14px 16px;' +
    'background:#fff8ee;color:#1a1424;border:2px solid #1a1424;border-radius:16px;box-shadow:5px 5px 0 #1a1424;font:500 14px/1.45 Figtree,system-ui,sans-serif;';
  box.innerHTML =
    '<p style="margin:0 0 10px"><b>Cookies?</b> We’d like to count visits with Google Analytics. Nothing is stored unless you say yes. ' +
    '<a href="https://whiskerworks.games/privacy/" style="color:#a43d00;font-weight:700">Privacy</a></p>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
    '<button data-c="denied" style="min-height:40px;padding:0 14px;border-radius:999px;border:2px solid #1a1424;background:#fff8ee;font-weight:700;cursor:pointer">No thanks</button>' +
    '<button data-c="granted" style="min-height:40px;padding:0 14px;border-radius:999px;border:2px solid #1a1424;background:#ff7a2f;font-weight:800;cursor:pointer">Accept</button></div>';
  box.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest('button')?.dataset.c;
    if (!c) return;
    try { localStorage.setItem(KEY, c); } catch { /* ignore */ }
    gtag('consent', 'update', { analytics_storage: c });
    box.remove();
  });
  document.body.appendChild(box);
}
