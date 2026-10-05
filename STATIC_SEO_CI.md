# Repository static SEO acceptance

Run with Python 3.12 (standard library only; no installation or network calls):

```sh
python -m unittest discover -s scripts -p 'test_*.py' -v
python scripts/check_static_seo.py
```

The workflow runs on pull requests targeting `main`, pushes to `main` and
`codex/static-seo-ci-*`, and manual dispatch. It has read-only repository
permissions and no deployment steps or secrets. Checks apply to the entire
`dist` tree rather than only changed files.

## Contract

- `dist/index.html`, `robots.txt`, and `sitemap.xml` must exist. The sitemap
  must parse as a nonempty namespaced `urlset`; each unique, absolute HTTPS
  site URL must resolve to an HTML file. `robots.txt` must declare the sitemap
  and allow its URLs for generic crawlers and Googlebot.
- All HTML canonical links must exactly match their physical route and the
  fixed site origin. `index.html` maps to its directory URL with trailing slash.
- Every non-home directory index is treated as an article, even if someone
  accidentally removes its article/schema markers. Other HTML files with
  `<article>` or `og:type=article` are also articles. Articles must be in sitemap.
- All HTML anchor links to the same host are checked, including relative,
  root-relative, absolute and protocol-relative links. Queries do not change
  the file mapping; HTML fragments must exist. Non-HTTP links and external
  hosts are skipped. Direct files and directory indexes are supported;
  extensionless rewrite routes and `<base>` are not inferred.
- Sitemap pages, and pages crawlable under the local robots rules, must not
  contain `noindex` or `none` in robots/googlebot/bingbot meta directives.
  This site's current policy is that its public guides are indexable.
- Every JSON-LD block must parse. Objects, arrays and `@graph` are supported.
  Articles require Article (also NewsArticle/BlogPosting) and BreadcrumbList.
  Required Article fields: headline, datePublished, dateModified, author,
  publisher, mainEntityOfPage; author/publisher require names and
  mainEntityOfPage must equal the route. Breadcrumbs require a nonempty list
  of ListItem entries, sequential integer positions, names and existing local
  item URLs; the last item must equal the route.

These are project minimum consistency requirements, not full schema.org or
Google rich-result validation. Stdlib robotparser covers the current simple
robots policy; this is not a complete simulation of every crawler's rules.
There is no HTTP request, JavaScript execution, HTTP-header inspection,
external-link verification, content fact checking, ranking/indexing measurement,
or validation of live redirects/hosting behavior. Passing **does not prove
that chatgpt.site is synchronized, deployed, indexable in production, or indexed**.

The unittest suite modifies disposable copies of the current site to exercise
missing files, broken links/anchors, canonical errors, robots blocking,
noindex, invalid XML/JSON-LD and missing schema fields. It never edits `dist`.
