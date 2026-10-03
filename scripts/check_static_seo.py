#!/usr/bin/env python3
"""Offline repository consistency checks; no assertion about a live deployment."""
import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET

SITE = 'https://buy-house-king.eday06011984.chatgpt.site'
NS = '{http://www.sitemaps.org/schemas/sitemap/0.9}'


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.links, self.canonicals, self.robots, self.blocks = [], [], [], []
        self.ids = set()
        self.article = False
        self.base = False
        self.script = None
        self.feed(text)
        self.close()
        if self.script is not None:
            self.blocks.append(self.script)  # Unclosed JSON-LD must also be checked.

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.add(a['id'])
        if tag == 'a' and a.get('name'):
            self.ids.add(a['name'])
        if tag == 'a' and a.get('href'):
            self.links.append(a['href'])
        if tag == 'base':
            self.base = True
        if tag == 'link' and 'canonical' in a.get('rel', '').lower().split():
            self.canonicals.append(a.get('href', ''))
        if tag == 'meta':
            if a.get('name', '').lower() in ('robots', 'googlebot', 'bingbot'):
                self.robots.append(a.get('content', '').lower())
            if a.get('property', '').lower() == 'og:type' and a.get('content') == 'article':
                self.article = True
        if tag == 'article':
            self.article = True
        if tag == 'script' and a.get('type', '').lower().strip() == 'application/ld+json':
            self.script = ''

    handle_startendtag = handle_starttag

    def handle_data(self, data):
        if self.script is not None:
            self.script += data

    def handle_endtag(self, tag):
        if tag == 'script' and self.script is not None:
            self.blocks.append(self.script)
            self.script = None


def page_url(path, root):
    rel = path.relative_to(root).as_posix()
    return SITE + '/' + (rel[:-10] if rel.endswith('index.html') else rel)


def target_file(url, root):
    path = unquote(urlsplit(url).path)
    target = (root / path.lstrip('/')).resolve()
    if not target.is_relative_to(root):
        return None
    if path.endswith('/') or target.is_dir():
        target /= 'index.html'
    return target if target.is_file() else None


def nodes(value):
    if isinstance(value, list):
        for item in value:
            yield from nodes(item)
    elif isinstance(value, dict):
        yield value
        yield from nodes(value.get('@graph', []))


def has_type(node, name):
    value = node.get('@type', [])
    return name in (value if isinstance(value, list) else [value])


def check(root):
    root = Path(root).resolve()
    errors = []

    def require(ok, where, message):
        if not ok:
            errors.append(f'{where}: {message}')

    robots = root / 'robots.txt'
    sitemap = root / 'sitemap.xml'
    require((root / 'index.html').is_file(), 'index.html', 'missing homepage')
    for file in (robots, sitemap):
        require(file.is_file(), file.name, 'required file missing')
    if errors:
        return errors
    robot_text = robots.read_text(encoding='utf-8')
    rp = RobotFileParser()
    rp.parse(robot_text.splitlines())
    require(bool(re.search(r'^\s*User-agent\s*:', robot_text, re.I | re.M)), 'robots.txt', 'missing User-agent')
    require(SITE + '/sitemap.xml' in (rp.site_maps() or []), 'robots.txt', 'missing expected Sitemap directive')
    urls = set()
    try:
        tree = ET.parse(sitemap).getroot()
        require(tree.tag == NS + 'urlset', 'sitemap.xml', 'expected namespaced urlset')
        entries = tree.findall(NS + 'url')
        require(bool(entries), 'sitemap.xml', 'empty urlset')
        for entry in entries:
            locs = entry.findall(NS + 'loc')
            loc = (locs[0].text or '').strip() if locs else ''
            require(len(locs) == 1 and bool(loc), 'sitemap.xml', 'each URL needs one nonempty loc')
            parsed = urlsplit(loc)
            require(parsed.scheme == 'https' and parsed.netloc == urlsplit(SITE).netloc and not parsed.query and not parsed.fragment, 'sitemap.xml', f'not a clean site URL: {loc}')
            require(loc not in urls, 'sitemap.xml', f'duplicate URL: {loc}')
            urls.add(loc)
            target = target_file(loc, root)
            require(target is not None and target.suffix == '.html', 'sitemap.xml', f'URL has no HTML file: {loc}')
            require(rp.can_fetch('*', loc) and rp.can_fetch('Googlebot', loc), 'robots.txt', f'sitemap URL blocked: {loc}')
    except ET.ParseError as exc:
        errors.append(f'sitemap.xml: invalid XML: {exc}')

    pages = {p.resolve(): Page(p.read_text(encoding='utf-8')) for p in root.rglob('*.html')}
    for file, page in pages.items():
        where = file.relative_to(root).as_posix()
        expected = page_url(file, root)
        require(not page.base, where, 'base element unsupported; use ordinary relative/root-relative links')
        require(page.canonicals == [expected], where, f'expected exactly one canonical: {expected}')
        crawlable = rp.can_fetch('*', expected) and rp.can_fetch('Googlebot', expected)
        if expected in urls or crawlable:
            require(not any({'noindex', 'none'} & set(re.split(r'[\s,;]+', value)) for value in page.robots), where, 'indexable page has noindex/none')
        article = file != root / 'index.html' and (page.article or file.name == 'index.html')
        if article:
            require(expected in urls, where, 'article missing from sitemap')
        for link in page.links:
            resolved = urljoin(expected, link)
            parsed = urlsplit(resolved)
            if parsed.scheme not in ('http', 'https') or parsed.netloc != urlsplit(SITE).netloc:
                continue
            target = target_file(resolved, root)
            require(target is not None, where, f'broken internal link: {link}')
            if target in pages and parsed.fragment and not parsed.fragment.startswith(':~:text='):
                require(unquote(parsed.fragment) in pages[target].ids, where, f'missing anchor: {link}')
        parsed_nodes = []
        for block in page.blocks:
            try:
                value = json.loads(block, parse_constant=lambda s: (_ for _ in ()).throw(ValueError(s)))
                require(isinstance(value, (dict, list)), where, 'JSON-LD must be object or array')
                parsed_nodes.extend(nodes(value))
            except ValueError as exc:
                errors.append(f'{where}: invalid JSON-LD: {exc}')
        articles = [n for n in parsed_nodes if any(has_type(n, t) for t in ('Article', 'NewsArticle', 'BlogPosting'))]
        crumbs = [n for n in parsed_nodes if has_type(n, 'BreadcrumbList')]
        if article:
            require(bool(articles), where, 'missing Article JSON-LD')
            require(bool(crumbs), where, 'missing BreadcrumbList JSON-LD')
        for node in articles:
            for field in ('headline', 'datePublished', 'dateModified', 'author', 'publisher', 'mainEntityOfPage'):
                require(bool(node.get(field)), where, f'Article missing {field}')
            for field in ('author', 'publisher'):
                people = node.get(field)
                people = people if isinstance(people, list) else [people]
                require(bool(people) and all(isinstance(p, dict) and p.get('name') for p in people), where, f'Article {field} requires name')
            entity = node.get('mainEntityOfPage')
            entity = entity.get('@id') if isinstance(entity, dict) else entity
            require(entity == expected, where, 'Article mainEntityOfPage differs from path')
        for node in crumbs:
            items = node.get('itemListElement')
            require(isinstance(items, list) and bool(items), where, 'BreadcrumbList missing itemListElement')
            if not isinstance(items, list):
                continue
            for index, item in enumerate(items, 1):
                valid = isinstance(item, dict) and has_type(item, 'ListItem') and type(item.get('position')) is int and item['position'] == index and bool(item.get('name')) and isinstance(item.get('item'), str)
                require(valid, where, f'Breadcrumb item {index} needs ListItem, sequential position, name, item URL')
                if valid:
                    url = item['item']
                    require(url.startswith(SITE + '/') and target_file(url, root) is not None, where, f'Breadcrumb target missing or external: {url}')
            if items and isinstance(items[-1], dict):
                require(items[-1].get('item') == expected, where, 'last breadcrumb differs from path')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', type=Path, default=Path(__file__).resolve().parents[1] / 'dist')
    args = parser.parse_args()
    try:
        errors = check(args.dist)
    except (OSError, UnicodeError, ValueError) as exc:
        errors = [f'Cannot validate repository: {exc}']
    if errors:
        print('\n'.join('ERROR: ' + e for e in errors))
        return 1
    print('PASS: repository static SEO consistency only; live hosting/deployment NOT verified.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
