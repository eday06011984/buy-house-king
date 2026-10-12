/* No cookies, browser storage, identifiers, referrers, queries or individual event records. */
(() => {
  'use strict';
  const bot = /bot|spider|crawler|headless|lighthouse|playwright|puppeteer|selenium|synthetic|sites-qa|siteqa|google-inspectiontool|facebookexternalhit|slurp/i;
  if (navigator.webdriver || navigator.globalPrivacyControl === true ||
      navigator.doNotTrack === '1' || window.doNotTrack === '1' ||
      bot.test(navigator.userAgent || '') ||
      new URLSearchParams(location.search).get('no_track') === '1' ||
      location.origin !== 'https://buy-house-king.eday06011984.chatgpt.site') return;
  let sent = false;
  const send = () => {
    if (sent || document.visibilityState !== 'visible' || document.prerendering) return;
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
      body: JSON.stringify({ path: page.pathname })
    }).catch(() => {});
  };
  document.addEventListener('visibilitychange', send);
  document.addEventListener('prerenderingchange', send);
  send();
})();
