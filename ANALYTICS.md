# First-party pageview totals

Added 2026-10-12. This is pageview counting, never a count of people, visits, or unique browsers. No historic values are reconstructed.

## What is saved

D1 `daily_pageviews` has exactly three columns: Taiwan calendar `day` (Asia/Taipei), an allowlisted canonical public `path`, and an integer `views`. `(day,path)` is the primary key. Each accepted request atomically increments one daily page aggregate; no individual events, visitor IDs, cookies, browser storage, IPs, user agents, referrers, full URLs, or query strings are stored by this code. Hosting infrastructure can retain its own necessary operational records.

The same-origin browser script sends `{path}` once per visible document. Hidden prerenders wait; visibility toggles do not count twice. Reloads or new documents do count again. Browser back-forward-cache restores keep the same in-memory flag. Failed writes are not retried. JS blockers, privacy preferences, network failures and exclusions can undercount. The filter cannot distinguish every bot or scripted request from a human.

DNT, GPC, `navigator.webdriver`, known automation/bot agents, and `?no_track=1` suppress browser counting. Fetch uses `credentials: omit` and `referrerPolicy: no-referrer`. Server rejects cross-origin requests, malformed/oversized bodies, query-bearing collector URLs, non-public paths, and extra JSON fields. `X-Site-Analytics-QA`, `X-Site-QA`, a Cloudflare browser-rendering `Signature-Agent`, or a `Sites-QA` user agent suppresses collector writes. The UA is inspected transiently for exclusion, never saved. QA must not send ordinary production events.

## Retention and access

Reports return only today and the prior 89 Taiwan calendar days. Expired aggregate rows are physically pruned in the same D1 transaction as the next accepted pageview. If there are no accepted pageviews, physical deletion may occur later. This is not a strict wall-clock TTL and no scheduled cleanup or paid service is configured.

`/stats/` and `/api/pageview-report` require Sites-supplied authenticated identity whose email matches the verified Site owner. They use no-store responses and do not collect events. Stats pages are noindex and are omitted from sitemap. Reporting only reads data. Existing hosting access remains public for content.

## Source/build and future maintenance

Existing static files were moved byte-for-byte from `dist/` to `site-static/`. Edit content there. Never overwrite Worker output manually with a static deployment. `scripts/build_worker.py` embeds every static file, injects the tracking script and privacy notice in HTML responses, and generates `dist/server/index.js`. It preserves all canonical URLs, metadata, robots and sitemap content. Maintain the public canonical path allowlist through this build, not by editing generated output.

Run `npm install` for schema tooling, then `npm run db:generate` only after changes to `db/schema.ts`. Applied SQL and Drizzle metadata are immutable. Build/package using the Sites source helper. Hosted migration runs before Worker upload; tables are never created during requests.

Validation:
- `python3 -m unittest discover -s scripts -p 'test_*.py' -v`
- `python3 scripts/check_static_seo.py`
- `python3 scripts/build_worker.py`
- `node scripts/validate-artifact.mjs`
- `node --test scripts/test_pageviews.mjs`

No production synthetic events are part of validation. Production GETs do not execute JavaScript or increment counts. Owner report login and real post-publication writes require future authorized/organic use to verify end to end.
