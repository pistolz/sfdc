/**
 * "The WhiskerWorks network": turns the "by WhiskerWorks" button of every live-series site into a sheet that
 * cross-links the other series, the games and the studio, so a visitor arriving on one show discovers all of them.
 * Every link carries UTM tags (utm_source=<current series>, utm_medium=network) so GA4 shows the traffic between sites.
 */
const STUDIO = 'https://whiskerworks.games';

export const SERIES = [
  { id: 'flagwars', name: 'Flag Wars', rule: '1 comment = 1 flag', emoji: '🌍', url: 'https://flagwars.whiskerworks.games', bg: 'linear-gradient(150deg,#0f1640,#2a6f8f)' },
  { id: 'stadium', name: 'Stadium Builder', rule: '1 club = 1 stand', emoji: '⚽', url: 'https://stadium.whiskerworks.games', bg: 'linear-gradient(150deg,#1f6e2b,#7cc84d)' },
  { id: 'arcade', name: 'Insert Coin Club', rule: '1 follower = 1 arcade machine', emoji: '🕹️', url: 'https://arcade.whiskerworks.games', bg: 'linear-gradient(150deg,#12081f,#8a2fb0)' },
  { id: 'noobbee', name: 'Noob Bee', rule: '1 comment = 1 level up', emoji: '🐝', url: 'https://noobbee.whiskerworks.games', bg: 'linear-gradient(150deg,#a86a08,#e9b52e)' },
  { id: 'leveltower', name: 'Level Tower', rule: '1 like = 1 floor', emoji: '🏰', url: 'https://tower.whiskerworks.games', bg: 'linear-gradient(150deg,#2b5fb8,#7fb8f0)' },
] as const;

export function initNetwork(current: (typeof SERIES)[number]['id']): void {
  const brand = document.querySelector<HTMLAnchorElement>('a.brand');
  if (!brand) return;
  const utm = (url: string, content: string) =>
    `${url}${url.includes('?') ? '&' : '?'}utm_source=${current}&utm_medium=network&utm_campaign=cross_series&utm_content=${content}`;
  const others = SERIES.filter((s) => s.id !== current);

  const sheet = document.createElement('div');
  sheet.className = 'ww-net';
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'More from WhiskerWorks');
  sheet.innerHTML = `
    <div class="ww-net__panel">
      <div class="ww-net__head">
        <img src="/mark.svg" alt="" width="36" height="36" />
        <div><p class="ww-net__kicker">WhiskerWorks</p><p class="ww-net__title">More shows you play from your phone</p></div>
        <button type="button" class="ww-net__close" aria-label="Close">✕</button>
      </div>
      <ul class="ww-net__list">
        ${others
          .map(
            (s) => `<li><a href="${utm(s.url, s.id)}" style="background:${s.bg}">
              <span class="ww-net__emoji" aria-hidden="true">${s.emoji}</span>
              <span class="ww-net__txt"><b>${s.name}</b><small>${s.rule}</small></span>
              <span aria-hidden="true">→</span></a></li>`,
          )
          .join('')}
      </ul>
      <div class="ww-net__links">
        <a href="${utm(`${STUDIO}/games/`, 'games')}">🎮 Our mobile games</a>
        <a href="${utm(`${STUDIO}/series/`, 'all_series')}">📺 All live series</a>
        <a href="${utm(`${STUDIO}/`, 'studio')}">🐱 WhiskerWorks studio</a>
      </div>
    </div>`;
  const style = document.createElement('style');
  style.textContent = `
    a.brand[aria-haspopup]::after{content:"▾";margin-left:4px;font-size:.8em;opacity:.8}
    .ww-net{position:fixed;inset:0;z-index:9000;display:grid;align-items:end;justify-items:center;background:rgb(10 8 16/.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
    .ww-net[hidden]{display:none}
    .ww-net__panel{width:min(460px,100%);max-height:88dvh;overflow:auto;margin:0;padding:18px 16px max(18px,env(safe-area-inset-bottom));background:#fff8ee;color:#1a1424;border:2px solid #1a1424;border-radius:22px 22px 0 0;font-family:"Figtree Variable",Figtree,system-ui,sans-serif;animation:wwnet .28s cubic-bezier(.16,1,.3,1)}
    @media (min-width:720px){.ww-net{align-items:center}.ww-net__panel{border-radius:22px;box-shadow:8px 8px 0 #1a1424}}
    @keyframes wwnet{from{transform:translateY(24px);opacity:0}}
    .ww-net__head{display:flex;align-items:center;gap:12px;margin-bottom:14px}
    .ww-net__head img{border-radius:9px}
    .ww-net__head div{flex:1}
    .ww-net__kicker{margin:0;font:700 11px/1 "Unbounded Variable",Unbounded,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#a43d00}
    .ww-net__title{margin:4px 0 0;font:800 18px/1.15 "Unbounded Variable",Unbounded,sans-serif;letter-spacing:-.02em}
    .ww-net__close{width:40px;height:40px;border-radius:50%;border:2px solid #1a1424;background:#fff8ee;font-size:16px;cursor:pointer;color:#1a1424}
    .ww-net__list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
    .ww-net__list a{display:flex;align-items:center;gap:12px;min-height:64px;padding:10px 14px;border-radius:16px;border:2px solid #1a1424;color:#fff;text-decoration:none;font-weight:800;transition:transform .15s}
    .ww-net__list a:hover,.ww-net__list a:focus-visible{transform:translateY(-2px)}
    .ww-net__emoji{font-size:28px;line-height:1}
    .ww-net__txt{flex:1;display:flex;flex-direction:column;gap:2px}
    .ww-net__txt b{font:800 16px/1.1 "Unbounded Variable",Unbounded,sans-serif;letter-spacing:-.02em;text-shadow:0 2px 0 rgb(0 0 0/.3)}
    .ww-net__txt small{font-weight:700;opacity:.92;text-transform:uppercase;font-size:11px;letter-spacing:.06em}
    .ww-net__links{display:grid;gap:4px;margin-top:14px}
    .ww-net__links a{display:flex;align-items:center;min-height:44px;padding:0 6px;border-top:1.5px solid #e2d2bb;color:#1a1424;font-weight:700;text-decoration:none}
    .ww-net__links a:hover{color:#a43d00}`;
  document.head.appendChild(style);
  document.body.appendChild(sheet);

  let lastFocus: Element | null = null;
  const open = () => {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    sheet.querySelector<HTMLAnchorElement>('.ww-net__list a')?.focus();
    window.wwTrack?.('open_network', { from: current });
  };
  const close = () => {
    sheet.hidden = true;
    (lastFocus as HTMLElement | null)?.focus?.();
  };
  brand.setAttribute('aria-haspopup', 'dialog');
  brand.setAttribute('aria-label', 'More from WhiskerWorks: other live series, games and studio');
  brand.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return; // let power users open the studio in a new tab
    e.preventDefault();
    open();
  });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
  sheet.querySelector('.ww-net__close')!.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) close(); });
}
