import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
const source = readFileSync(new URL('../dist/server/index.js', import.meta.url), 'utf8');
const { default: worker, dateWindow } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const origin = 'https://buy-house-king.eday06011984.chatgpt.site';
function fakeDB() {
  const batches = [], reads = [];
  return { batches, reads, prepare(sql) { return { bind(...values) { return { sql, values, async all() { reads.push({sql,values}); return {results: []}; } }; } }; }, async batch(items) { batches.push(items); return items.map(() => ({success:true})); } };
}
function request(path = '/', options = {}) {
  const { headers = {}, body, url = '/api/pageviews', method = 'POST' } = options;
  return new Request(origin + url, { method, headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', 'X-Pageview': '1', 'User-Agent': 'Mozilla/5.0', ...headers }, body: method === 'GET' || method === 'HEAD' ? undefined : (body ?? JSON.stringify({path})) });
}
test('Taipei midnight and 90-calendar-day boundary', () => {
  assert.deepEqual(dateWindow(new Date('2026-10-11T15:59:59Z')), {day:'2026-10-11',cutoff:'2026-07-14'});
  assert.deepEqual(dateWindow(new Date('2026-10-11T16:00:00Z')), {day:'2026-10-12',cutoff:'2026-07-15'});
});
test('valid pageview writes only day/path/integer aggregate in one batch', async () => {
  const DB = fakeDB();
  assert.equal((await worker.fetch(request('/'),{DB})).status,204);
  assert.equal(DB.batches.length,1); const [purge,add] = DB.batches[0];
  assert.match(purge.sql,/DELETE FROM daily_pageviews/); assert.match(add.sql,/ON CONFLICT\(day, path\)/);
  assert.deepEqual(add.values,[dateWindow().day,'/']);
  assert.equal(purge.values[0],dateWindow().cutoff);
});
test('excluded QA, bots, privacy and owner produce no writes', async () => {
  for (const headers of [{DNT:'1'},{'Sec-GPC':'1'},{'X-Site-Analytics-QA':'1'},{'X-Site-QA':'1'},{'Signature-Agent':'https://web-bot-auth.cloudflare-browser-rendering-085.workers.dev'},{'User-Agent':'Sites-QA'},{'User-Agent':'SiteQA'},{'User-Agent':'HeadlessChrome'},{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'eday06011984@gmail.com'}]) {
    const DB=fakeDB(); assert.equal((await worker.fetch(request('/',{headers}),{DB})).status,204); assert.equal(DB.batches.length,0);
  }
});
test('invalid/cross-origin/private paths fail without writing', async () => {
  const bad = [
    request('/',{headers:{Origin:'https://other.example'}}), request('/',{headers:{'Sec-Fetch-Site':'cross-site'}}),
    request('/',{headers:{'X-Pageview':'0'}}), request('/',{headers:{'Content-Type':'text/plain'}}),
    request('/stats/'), request('/api/pageview-report'), request('/?email=private'), request('/#fragment'), request('/unknown/'),
    request('/',{body:JSON.stringify({path:'/',visitor:'not-allowed'})}), request('/',{body:'null'}), request('/',{body:'{bad'}),
    request('/',{body:'x'.repeat(513)}), request('/',{url:'/api/pageviews?x=1'}), request('/',{method:'GET'})
  ];
  for (const req of bad) { const DB=fakeDB(); assert.ok((await worker.fetch(req,{DB})).status>=400); assert.equal(DB.batches.length,0); }
});
test('report access is owner-only and bounded; no collection on GET or HEAD',async()=>{
  const DB=fakeDB();
  for(const path of ['/','/robots.txt','/sitemap.xml','/pageview.js']) for(const method of ['GET','HEAD']) assert.equal((await worker.fetch(new Request(origin+path,{method}),{DB})).status,200);
  assert.equal(DB.batches.length,0);
  assert.equal((await worker.fetch(new Request(origin+'/api/pageview-report'),{DB})).status,403);
  assert.equal((await worker.fetch(new Request(origin+'/stats/'),{DB})).status,302);
  assert.equal((await worker.fetch(new Request(origin+'/stats/',{headers:{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.com'}}),{DB})).status,403);
  const res=await worker.fetch(new Request(origin+'/api/pageview-report',{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'eday06011984@gmail.com'}}),{DB});
  assert.equal(res.status,200);assert.equal(res.headers.get('Cache-Control'),'no-store');
  assert.deepEqual(DB.reads[0].values,[dateWindow().cutoff,dateWindow().day]);assert.equal(DB.batches.length,0);
});
test('HTML preserves canonical and all prior markup; public data files unchanged', async()=>{
  const home=readFileSync(new URL('../site-static/index.html',import.meta.url),'utf8');
  const html=await (await worker.fetch(new Request(origin+'/'),{})).text();
  assert.equal(html.replace('<script src="/pageview.js" defer></script>','').replace(/<aside aria-label="隱私與瀏覽次數統計"[^]*?<\/aside>/,''),home);
  for(const path of ['robots.txt','sitemap.xml']) assert.equal(await (await worker.fetch(new Request(origin+'/'+path),{})).text(),readFileSync(new URL('../site-static/'+path,import.meta.url),'utf8'));
  assert.equal((await worker.fetch(new Request(origin+'/missing/'),{})).status,404);
});
function runClient({visible=true,webdriver=false,gpc=false,dnt='0',ua='Mozilla/5.0',search='',prerender=false}={}) {
  const calls=[], listeners=new Map();
  const document={visibilityState:visible?'visible':'hidden',prerendering:prerender,
    querySelector:()=>({href:origin+'/first-home-down-payment/'}),
    addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const context={navigator:{webdriver,globalPrivacyControl:gpc,doNotTrack:dnt,userAgent:ua},window:{},document,location:{origin,search},URL,URLSearchParams,fetch:(...a)=>{calls.push(a);return Promise.resolve();}};
  vm.runInNewContext(readFileSync(new URL('../worker/pageview.js',import.meta.url),'utf8'),context);
  return {calls,document,listeners};
}
test('client waits for visibility and sends once without browser credentials or referrer',()=>{
  const r=runClient({visible:false});assert.equal(r.calls.length,0);
  r.document.visibilityState='visible';r.listeners.get('visibilitychange')();assert.equal(r.calls.length,1);
  assert.equal(r.listeners.has('visibilitychange'),false);
  const [,options]=r.calls[0];assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.keepalive,true);
  assert.deepEqual(JSON.parse(options.body),{path:'/first-home-down-payment/'});
  assert.equal(runClient().calls.length,1);
});
test('client honors privacy, webdriver, query opt-out and prerender',()=>{
  for(const settings of [{webdriver:true},{gpc:true},{dnt:'1'},{ua:'Googlebot'},{ua:'Sites-QA'},{ua:'SiteQA'},{search:'?no_track=1'},{prerender:true}]) assert.equal(runClient(settings).calls.length,0);
});
test('real SQLite migration, atomic upsert and retention boundary',()=>{
  const py=String.raw`
import sqlite3,pathlib
root=pathlib.Path.cwd(); db=sqlite3.connect(':memory:')
for file in sorted((root/'drizzle').glob('*.sql')):db.executescript(file.read_text())
assert [r[1] for r in db.execute('PRAGMA table_info(daily_pageviews)')]==['day','path','views']
db.executemany('INSERT INTO daily_pageviews VALUES(?,?,?)',[('2026-07-14','/',7),('2026-07-15','/',8),('2026-10-12','/',9)])
with db:
 db.execute('DELETE FROM daily_pageviews WHERE day < ?',('2026-07-15',))
 for _ in range(2):db.execute('INSERT INTO daily_pageviews(day,path,views) VALUES(?,?,1) ON CONFLICT(day,path) DO UPDATE SET views=views+1',('2026-10-12','/'))
assert db.execute('SELECT * FROM daily_pageviews ORDER BY day').fetchall()==[('2026-07-15','/',8),('2026-10-12','/',11)]
try:db.execute('INSERT INTO daily_pageviews VALUES(?,?,?)',('2026-10-12','/bad/',-1))
except sqlite3.IntegrityError:pass
else:raise AssertionError('negative views accepted')
`;
  const res=spawnSync('python3',['-c',py],{encoding:'utf8'});assert.equal(res.status,0,res.stderr);
});
