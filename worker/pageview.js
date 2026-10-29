/* No analytics identifiers or individual event records. sessionStorage holds only an optional QA exclusion preference. */
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
      body: JSON.stringify({ path: page.pathname })
    }).catch(() => {});
  };
  document.addEventListener('visibilitychange', send);
  document.addEventListener('prerenderingchange', send);
  send();
})();
