import { initConsent } from "./consent";
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

  initConsent();

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
