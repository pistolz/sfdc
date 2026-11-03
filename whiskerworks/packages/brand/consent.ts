/**
 * WhiskerWorks consent manager (OneTrust / Fandom-style), shared by the studio and every series site.
 *
 * Layer 1: a modal over a dimmed page with "I Accept" and "Show preferences".
 * Layer 2: full preferences screen with "Allow All", one row per cookie category (toggle + details),
 *          then "Reject All" and "Confirm my choices".
 * The choice is stored in localStorage ("ww-consent" = granted | denied) and pushed to Google Consent Mode v2.
 * Only categories the sites really use are listed: strictly necessary (always on) and analytics (Google Analytics 4).
 * Reopen from anywhere with window.wwConsent.open() (e.g. the footer "Cookie preferences" link).
 */
type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window { gtag?: Gtag; wwConsent?: { open: () => void; get: () => string | null } }
}

const KEY = "ww-consent";
const PRIVACY = "https://whiskerworks.games/privacy/";
const MARK = `<svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#1A1424"/><path stroke="#FF7A2F" stroke-width="2.4" stroke-linecap="round" d="M4.5 33.5 17 36M3.5 40h13.5M5 46.5 17 43.5M59.5 33.5 47 36M60.5 40H47M59 46.5 47 43.5"/><path fill="#FFF8EE" d="M32 54c-13.5 0-21.5-7.2-21.5-17 0-5.6 1.9-10.6 5-14.4L14.6 9.2l10.8 6.6A27 27 0 0 1 32 15c2.3 0 4.5.3 6.6.8l10.8-6.6-.9 13.4c3.1 3.8 5 8.8 5 14.4 0 9.8-8 17-21.5 17Z"/><ellipse cx="24.5" cy="31.5" rx="2.6" ry="3.4" fill="#1A1424"/><ellipse cx="39.5" cy="31.5" rx="2.6" ry="3.4" fill="#1A1424"/><path fill="#FF7A2F" d="M29.6 37.2h4.8L32 39.8Z"/><path fill="none" stroke="#1A1424" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M26.2 41.2q2.9 3.6 5.8 0 2.9 3.6 5.8 0"/></svg>`;

const read = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };

export function initConsent(): void {
  if (typeof document === "undefined" || document.querySelector(".wwc")) return;
  injectStyle();
  const root = document.createElement("div");
  root.className = "wwc";
  root.hidden = true;
  root.innerHTML = `
    <div class="wwc-l1" role="dialog" aria-modal="true" aria-labelledby="wwc-t1">
      <h2 id="wwc-t1">We care about your privacy</h2>
      <p>WhiskerWorks and our analytics partner (Google) use cookies and similar technologies on your device. They keep
      this site working and, with your permission, let us measure how it is used so we can make better games and live
      series. Selecting <b>I Accept</b> enables these analytics cookies. We never sell your data and never show ads on
      this site. You can change your choice at any time with <b>Cookie preferences</b> at the bottom of the page.
      <a href="${PRIVACY}" target="_blank" rel="noopener">Privacy Policy</a></p>
      <h3>We use your data to:</h3>
      <p>Measure audience and visits, understand which games and series you enjoy, count store clicks and demo plays,
      and improve the site.</p>
      <button type="button" class="wwc-primary" data-act="accept">I Accept</button>
      <button type="button" class="wwc-outline" data-act="prefs">Show preferences</button>
    </div>
    <div class="wwc-l2" role="dialog" aria-modal="true" aria-labelledby="wwc-t2" hidden>
      <div class="wwc-head">${MARK}<b>WhiskerWorks</b></div>
      <div class="wwc-scroll">
        <h2 id="wwc-t2">About your privacy</h2>
        <p>We use cookies to run this site and, if you agree, to measure its audience with Google Analytics. Analytics
        data is aggregated, IP addresses are anonymised, and it is kept for 14 months. Choose below which categories you
        allow. Your choice is saved on this device for up to 12 months and applies to all WhiskerWorks sites
        (studio and live series).</p>
        <a class="wwc-link" href="${PRIVACY}" target="_blank" rel="noopener">Privacy Policy</a>
        <button type="button" class="wwc-primary" data-act="accept">Allow All</button>
        <h3>Manage consent preferences</h3>
        <div class="wwc-rows">
          <details class="wwc-row">
            <summary><span>Strictly necessary cookies</span><em>Always active</em><i aria-hidden="true">›</i></summary>
            <p>Needed for the site to work: remembering your cookie choice, security and basic performance. They do not
            identify you and cannot be switched off.</p>
          </details>
          <details class="wwc-row">
            <summary><span>Analytics cookies</span>
              <label class="wwc-switch" onclick="event.stopPropagation()"><input type="checkbox" data-cat="analytics" aria-label="Allow analytics cookies"><span></span></label>
              <i aria-hidden="true">›</i></summary>
            <p>Google Analytics 4 counts visits, pages viewed and clicks (store buttons, demos, name searches) so we know
            what players like. No advertising, no selling, IP anonymised. Provider: Google LLC.</p>
          </details>
        </div>
      </div>
      <div class="wwc-foot">
        <button type="button" class="wwc-primary" data-act="reject">Reject All</button>
        <button type="button" class="wwc-primary" data-act="confirm">Confirm My Choices</button>
        <p class="wwc-by">Privacy by WhiskerWorks</p>
      </div>
    </div>`;
  document.body.appendChild(root);

  const l1 = root.querySelector<HTMLElement>(".wwc-l1")!;
  const l2 = root.querySelector<HTMLElement>(".wwc-l2")!;
  const box = root.querySelector<HTMLInputElement>('[data-cat="analytics"]')!;

  const show = (layer: 1 | 2) => {
    box.checked = read() === "granted";
    root.hidden = false;
    l1.hidden = layer !== 1;
    l2.hidden = layer !== 2;
    document.documentElement.classList.add("wwc-open");
    (layer === 1 ? l1 : l2).querySelector<HTMLElement>("button")?.focus();
  };
  const save = (v: "granted" | "denied") => {
    try { localStorage.setItem(KEY, v); } catch { /* private mode */ }
    window.gtag?.("consent", "update", { analytics_storage: v });
    root.hidden = true;
    document.documentElement.classList.remove("wwc-open");
  };
  root.addEventListener("click", (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>("[data-act]")?.dataset.act;
    if (act === "accept") save("granted");
    else if (act === "reject") save("denied");
    else if (act === "confirm") save(box.checked ? "granted" : "denied");
    else if (act === "prefs") show(2);
  });
  window.wwConsent = { open: () => show(2), get: read };
  document.querySelectorAll("[data-consent-open]").forEach((b) => b.addEventListener("click", () => show(2)));
  if (!read()) show(1);
}

function injectStyle(): void {
  const s = document.createElement("style");
  s.textContent = `
  html.wwc-open{overflow:hidden}
  .wwc{position:fixed;inset:0;z-index:2147483000;background:rgb(26 20 36/.55);font-family:"Figtree Variable",Figtree,system-ui,-apple-system,sans-serif;color:#3b3346}
  .wwc[hidden],.wwc [hidden]{display:none!important}
  .wwc h2{margin:0 0 14px;font:800 24px/1.15 "Unbounded Variable",Unbounded,system-ui,sans-serif;letter-spacing:-.02em;color:#1a1424}
  .wwc h3{margin:18px 0 8px;font:800 16px/1.25 "Unbounded Variable",Unbounded,system-ui,sans-serif;letter-spacing:-.01em;color:#1a1424}
  .wwc p{margin:0;font-size:15px;line-height:1.55}
  .wwc a{color:#a43d00;font-weight:700}
  .wwc b{color:#1a1424}
  .wwc-primary,.wwc-outline{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;margin-top:12px;border-radius:12px;font:800 16px/1 "Figtree Variable",Figtree,system-ui,sans-serif;cursor:pointer}
  .wwc-primary{background:#1a1424;color:#fff8ee;border:2px solid #1a1424}
  .wwc-primary:hover{background:#3b3346}
  .wwc-outline{background:#fff8ee;color:#1a1424;border:2px solid #1a1424}
  .wwc-outline:hover{background:#f7ecdc}
  .wwc-l1{position:absolute;left:0;right:0;bottom:0;max-height:88dvh;overflow:auto;padding:24px 20px max(20px,env(safe-area-inset-bottom));background:#fff8ee;border-top:3px solid #1a1424;box-shadow:0 -10px 40px rgb(0 0 0/.25);animation:wwcup .35s cubic-bezier(.16,1,.3,1)}
  .wwc-l1 .wwc-primary{margin-top:22px}
  .wwc-l2{position:absolute;inset:0;display:flex;flex-direction:column;background:#fff8ee;animation:wwcup .3s cubic-bezier(.16,1,.3,1)}
  @media (min-width:760px){
    .wwc-l1{left:50%;bottom:50%;transform:translate(-50%,50%);width:min(640px,92vw);border:3px solid #1a1424;border-radius:20px;box-shadow:10px 10px 0 #1a1424;animation:none}
    .wwc-l2{inset:4vh auto 4vh 50%;transform:translateX(-50%);width:min(640px,94vw);border:3px solid #1a1424;border-radius:20px;overflow:hidden;box-shadow:10px 10px 0 #1a1424;animation:none}
  }
  @keyframes wwcup{from{transform:translateY(30px);opacity:0}}
  .wwc-head{display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1.5px solid #e2d2bb}
  .wwc-head b{font:800 20px/1 "Unbounded Variable",Unbounded,system-ui,sans-serif;letter-spacing:-.03em}
  .wwc-scroll{flex:1;overflow:auto;padding:22px 20px 20px}
  .wwc-link{display:inline-block;margin-top:10px;padding:2px 4px;border:2px solid #1a1424;color:#1a1424!important;text-decoration:none}
  .wwc-scroll .wwc-primary{margin:22px 0 10px}
  .wwc-rows{border:1.5px solid #c9b498;border-radius:4px;background:#fff}
  .wwc-row+.wwc-row{border-top:1.5px solid #c9b498}
  .wwc-row summary{display:flex;align-items:center;gap:12px;min-height:64px;padding:12px 16px;list-style:none;cursor:pointer;font-weight:800;font-size:16px;color:#3b3346}
  .wwc-row summary::-webkit-details-marker{display:none}
  .wwc-row summary span{flex:1}
  .wwc-row summary em{font-style:normal;font-weight:800;color:#5546c9}
  .wwc-row summary i{font-style:normal;font-size:22px;color:#6a6176;transition:transform .2s}
  .wwc-row[open] summary i{transform:rotate(90deg)}
  .wwc-row>p{padding:0 16px 16px;font-size:14px}
  .wwc-switch{position:relative;display:inline-block;width:52px;height:30px;flex:none}
  .wwc-switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}
  .wwc-switch span{position:absolute;inset:0;border-radius:999px;background:#6a6176;transition:background .2s;pointer-events:none}
  .wwc-switch span::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgb(0 0 0/.3);transition:transform .2s}
  .wwc-switch input:checked+span{background:#22b07a}
  .wwc-switch input:checked+span::after{transform:translateX(22px)}
  .wwc-switch input:focus-visible+span{outline:3px solid #6c5ce7;outline-offset:2px}
  .wwc-foot{padding:12px 16px max(14px,env(safe-area-inset-bottom));border-top:1.5px solid #e2d2bb;background:#fff8ee}
  .wwc-foot .wwc-primary{margin-top:10px}
  .wwc-by{margin-top:10px!important;text-align:right;font-size:12px!important;font-weight:700;color:#6a6176}
  @media (prefers-reduced-motion:reduce){.wwc-l1,.wwc-l2{animation:none}}`;
  document.head.appendChild(s);
}
