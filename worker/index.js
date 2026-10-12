const SITE_ORIGIN = 'https://buy-house-king.eday06011984.chatgpt.site';
// Owner email is checked only against identity supplied by Sites dispatch.
const OWNER_EMAIL = 'eday06011984@gmail.com';
const ASSETS = __SITE_ASSETS__;
const PUBLIC_PATHS = new Set(__PAGE_PATHS__);
const TRACKER = __TRACKING_SCRIPT__;
const STATS_HTML = __STATS_HTML__;
const BOT = /bot|spider|crawler|headless|lighthouse|playwright|puppeteer|selenium|synthetic|sites-qa|siteqa|google-inspectiontool|facebookexternalhit|slurp/i;
const PRIVACY_NOTICE = '<aside aria-label="隱私與瀏覽次數統計" style="max-width:1160px;margin:auto;padding:16px 24px;font-size:0.8rem;line-height:1.7"><details><summary>隱私與瀏覽次數統計</summary><p>本站從 2026-10-12 起僅彙總台灣日期、公開頁面路徑與瀏覽次數，不設 cookie 或訪客識別碼，不儲存 IP、來源、網址參數或瀏覽器資訊。統計不是人數；同一人重開頁面會再次計數。報表只顯示最近 90 天；較早的彙總於下一次成功計數時清除，因此無流量期間可能延後刪除。網站主機仍可能保有必要的營運紀錄。</p><p>啟用瀏覽器 Do Not Track / Global Privacy Control、停用 JavaScript，或以加上 ?no_track=1 的網址開啟本頁，可停止本次瀏覽計數；機器人排除並非百分之百準確。</p></details></aside>';
const reply = (status, text = '', headers = {}) => new Response(status === 204 ? null : text, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
});
export function dateWindow(now = new Date()) {
  const day = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const cutoff = new Date(Date.parse(day + 'T00:00:00Z') - 89 * 86400000).toISOString().slice(0, 10);
  return { day, cutoff };
}
function isOwner(request) {
  return Boolean(request.headers.get('oai-authenticated-user-id')) &&
    request.headers.get('oai-authenticated-user-email')?.toLowerCase() === OWNER_EMAIL;
}
export async function pageview(request, env) {
  if (request.method !== 'POST') return reply(405, 'Method not allowed', { Allow: 'POST' });
  const url = new URL(request.url);
  if (url.origin !== SITE_ORIGIN || request.headers.get('Origin') !== SITE_ORIGIN ||
      (request.headers.has('Sec-Fetch-Site') && request.headers.get('Sec-Fetch-Site') !== 'same-origin')) return reply(403, 'Forbidden');
  if (url.search || request.headers.get('X-Pageview') !== '1' ||
      request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return reply(400, 'Invalid request');
  // Read headers only to honor privacy/QA exclusions. None are stored or logged.
  if (request.headers.get('DNT') === '1' || request.headers.get('Sec-GPC') === '1' ||
      request.headers.has('X-Site-Analytics-QA') || request.headers.has('X-Site-QA') ||
      /cloudflare-browser-rendering/i.test(request.headers.get('Signature-Agent') || '') || BOT.test(request.headers.get('User-Agent') || '') ||
      isOwner(request)) return reply(204);
  if (Number(request.headers.get('Content-Length') || 0) > 512) return reply(413, 'Request too large');
  let text;
  try { text = await request.text(); } catch { return reply(400, 'Invalid request'); }
  if (text.length > 512) return reply(413, 'Request too large');
  let data;
  try { data = JSON.parse(text); } catch { return reply(400, 'Invalid JSON'); }
  if (!data || Array.isArray(data) || typeof data !== 'object' || Object.keys(data).length !== 1 ||
      typeof data.path !== 'string' || !PUBLIC_PATHS.has(data.path)) return reply(400, 'Invalid public page');
  if (!env.DB) return reply(503, 'Statistics unavailable');
  const { day, cutoff } = dateWindow();
  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM daily_pageviews WHERE day < ?').bind(cutoff),
      env.DB.prepare('INSERT INTO daily_pageviews (day, path, views) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET views = views + 1').bind(day, data.path),
    ]);
    return reply(204);
  } catch { return reply(503, 'Statistics unavailable'); }
}
async function report(request, env) {
  if (request.method !== 'GET') return reply(405, 'Method not allowed', { Allow: 'GET' });
  if (!isOwner(request)) return reply(403, 'Owner access required');
  if (!env.DB) return reply(503, 'Statistics unavailable');
  const { day, cutoff } = dateWindow();
  try {
    const result = await env.DB.prepare('SELECT day, path, views FROM daily_pageviews WHERE day >= ? AND day <= ? ORDER BY day DESC, path ASC').bind(cutoff, day).all();
    return reply(200, JSON.stringify({ metric: 'pageviews', timezone: 'Asia/Taipei', from: cutoff, to: day, retention: '90 calendar days; older rows pruned on next accepted pageview', rows: result.results ?? [] }), { 'Content-Type': 'application/json; charset=utf-8' });
  } catch { return reply(503, 'Statistics unavailable'); }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/pageviews') return pageview(request, env);
    if (url.pathname === '/api/pageview-report') return report(request, env);
    if (request.method !== 'GET' && request.method !== 'HEAD') return reply(405, 'Method not allowed', { Allow: 'GET, HEAD' });
    if (url.pathname === '/stats/' || url.pathname === '/stats') {
      if (!request.headers.get('oai-authenticated-user-id')) return reply(302, '', { Location: '/signin-with-chatgpt?return_to=%2Fstats%2F' });
      if (!isOwner(request)) return reply(403, 'Owner access required');
      return reply(200, request.method === 'HEAD' ? null : STATS_HTML, { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' });
    }
    if (url.pathname === '/pageview.js') return reply(200, request.method === 'HEAD' ? null : TRACKER, { 'Content-Type': 'text/javascript; charset=utf-8' });
    let path = url.pathname;
    if (path.endsWith('/')) path += 'index.html';
    else if (!path.split('/').pop().includes('.') && ASSETS[path + '/index.html']) {
      return reply(308, '', { Location: path + '/' + url.search });
    }
    const asset = Object.hasOwn(ASSETS, path) ? ASSETS[path] : null;
    if (!asset) return reply(404, 'Page not found');
    let body = asset[1];
    if (asset[0].startsWith('text/html')) {
      body = body.replace('</head>', '<script src="/pageview.js" defer></script></head>')
        .replace('</body>', PRIVACY_NOTICE + '</body>');
    }
    return new Response(request.method === 'HEAD' ? null : body, { headers: {
      'Content-Type': asset[0], 'Cache-Control': 'public, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin'
    } });
  }
};
