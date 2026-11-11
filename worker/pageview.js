/* Daily, first-party random browser identifiers; never IPs or cross-site IDs. */
(() => {
  'use strict';
  const qaExcluded = () => {
    const params = new URLSearchParams(location.search);
    try {
      if (params.get('site_qa') === '0') window.sessionStorage.removeItem('site_qa');
      else if (params.has('site_qa')) window.sessionStorage.setItem('site_qa', '1');
      if (params.has('site_qa')) return true;
      return window.sessionStorage.getItem('site_qa') === '1';
    } catch { return params.has('site_qa'); }
  };
  const bot = /bot|spider|crawler|headless|lighthouse|playwright|puppeteer|selenium|synthetic|sites-qa|siteqa|google-inspectiontool|facebookexternalhit|slurp/i;
  if (qaExcluded() || navigator.webdriver || navigator.globalPrivacyControl === true ||
      navigator.doNotTrack === '1' || window.doNotTrack === '1' ||
      bot.test(navigator.userAgent || '') ||
      new URLSearchParams(location.search).get('no_track') === '1' ||
      location.origin !== 'https://buy-house-king.eday06011984.chatgpt.site') return;
  const browserToken = () => {
    try {
      const day = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
      const key = 'house_daily_browser_v1';
      let saved;
      try { saved = JSON.parse(window.localStorage.getItem(key)); } catch {}
      if (!saved || saved.day !== day || !/^[a-f0-9]{32}$/.test(saved.id)) {
        const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
        saved = {day, id: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')};
        window.localStorage.setItem(key, JSON.stringify(saved));
      }
      if (window.localStorage.getItem(key) !== JSON.stringify(saved)) return {};
      return {browser_day: saved.day, browser_id: saved.id};
    } catch { return {}; }
  };
  let sent = false;
  const send = () => {
    if (qaExcluded() || sent || document.visibilityState !== 'visible' || document.prerendering) return;
    const canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) return;
    const page = new URL(canonical.href);
    if (page.origin !== location.origin || page.search || page.hash) return;
    sent = true;
    document.removeEventListener('visibilitychange', send);
    document.removeEventListener('prerenderingchange', send);
    fetch('/api/pageviews', {
      method: 'POST', mode: 'same-origin', credentials: 'omit',
      referrerPolicy: 'no-referrer', keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-Pageview': '1' },
      body: JSON.stringify({ path: page.pathname, ...browserToken() })
    }).catch(() => {});
  };
  document.addEventListener('visibilitychange', send);
  document.addEventListener('prerenderingchange', send);
  send();
})();
