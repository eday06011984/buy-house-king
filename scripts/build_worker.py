"""Embed unchanged static content and the first-party collector in one Worker ESM."""
import json
from pathlib import Path
P = Path(__file__).resolve().parents[1]
source = P / 'site-static'
assets = {}
paths = []
for file in sorted(source.rglob('*')):
    if not file.is_file():
        continue
    path = '/' + file.relative_to(source).as_posix()
    text = file.read_text(encoding='utf-8')
    mime = {'.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8'}[file.suffix]
    assets[path] = [mime, text]
    if path.endswith('/index.html'):
        paths.append(path[:-10])
worker = (P / 'worker/index.js').read_text(encoding='utf-8')
worker = worker.replace('__SITE_ASSETS__', json.dumps(assets, ensure_ascii=False))
worker = worker.replace('__PAGE_PATHS__', json.dumps(paths))
worker = worker.replace('__TRACKING_SCRIPT__', json.dumps((P / 'worker/pageview.js').read_text(), ensure_ascii=False))
worker = worker.replace('__STATS_HTML__', json.dumps((P / 'worker/stats.html').read_text(), ensure_ascii=False))
output = P / 'dist'
(output / 'server').mkdir(parents=True, exist_ok=True)
(output / '.openai').mkdir(parents=True, exist_ok=True)
(output / 'server/index.js').write_text(worker, encoding='utf-8')
(output / '.openai/hosting.json').write_bytes((P / '.openai/hosting.json').read_bytes())
print(f'Embedded {len(assets)} unchanged static files; {len(paths)} canonical public pages.')
