"""Mutate temporary site copies: prove regressions cannot silently pass."""
import json
from pathlib import Path
import re
import shutil
import tempfile
import unittest

from check_static_seo import SITE, check


class StaticSEOTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'dist'
        shutil.copytree(Path(__file__).resolve().parents[1] / 'dist', self.root)
        self.article = 'used-house-title-age-check/index.html'

    def edit(self, path, old, new):
        file = self.root / path
        text = file.read_text(encoding='utf-8')
        self.assertIn(old, text)
        file.write_text(text.replace(old, new, 1), encoding='utf-8')

    def fails(self, message):
        self.assertTrue(any(message in e for e in check(self.root)), check(self.root))

    def test_current_repository(self):
        self.assertEqual(check(self.root), [])

    def test_missing_required_files(self):
        for name in ('robots.txt', 'sitemap.xml', 'index.html'):
            with self.subTest(name=name):
                file = self.root / name
                original = file.read_bytes()
                file.unlink()
                self.assertTrue(check(self.root))
                file.write_bytes(original)

    def test_invalid_xml(self):
        self.edit('sitemap.xml', '</urlset>', '')
        self.fails('invalid XML')

    def test_sitemap_missing_page(self):
        (self.root / self.article).unlink()
        self.fails('URL has no HTML file')

    def test_missing_article_sitemap_entry(self):
        file = self.root / 'sitemap.xml'
        file.write_text(re.sub(r'<url><loc>[^<]+/used-house-title-age-check/</loc>.*?</url>', '', file.read_text()), encoding='utf-8')
        self.fails('article missing from sitemap')

    def test_broken_home_link(self):
        self.edit('index.html', 'href="/used-house-title-age-check/"', 'href="/missing/?ref=test"')
        self.fails('broken internal link')

    def test_broken_article_link(self):
        self.edit(self.article, 'href="/home-buying-taxes-fees/"', 'href="../missing/"')
        self.fails('broken internal link')

    def test_broken_anchor(self):
        self.edit(self.article, 'href="#order"', 'href="#not-present"')
        self.fails('missing anchor')

    def test_valid_link_forms(self):
        self.edit(self.article, '</body>', '<a href="../home-buying-taxes-fees/?x=1">relative</a><a href="' + SITE + '/#articles">absolute</a><a href="mailto:a@example.test">mail</a><a href="https://example.test/missing/">external</a></body>')
        self.assertEqual(check(self.root), [])

    def test_wrong_canonical(self):
        self.edit(self.article, 'rel="canonical" href="' + SITE + '/used-house-title-age-check/"', 'rel="canonical" href="' + SITE + '/"')
        self.fails('expected exactly one canonical')

    def test_noindex_and_none(self):
        for directive in ('NOINDEX,follow', 'none', 'index, noindex'):
            with self.subTest(directive=directive):
                self.edit(self.article, 'content="index,follow"', 'content="' + directive + '"')
                self.fails('indexable page has noindex/none')
                self.edit(self.article, 'content="' + directive + '"', 'content="index,follow"')

    def test_robot_block(self):
        self.edit('robots.txt', 'Allow: /', 'Disallow: /')
        self.fails('sitemap URL blocked')

    def test_invalid_json_ld(self):
        self.edit(self.article, '"@type":"Article"', '"@type":INVALID')
        self.fails('invalid JSON-LD')

    def test_missing_article_fields(self):
        self.edit(self.article, '"datePublished":', '"removedDate":')
        self.fails('Article missing datePublished')

    def test_missing_breadcrumb_fields(self):
        self.edit(self.article, '"position":1', '"removedPosition":1')
        self.fails('sequential position')

    def test_missing_schema_blocks(self):
        file = self.root / self.article
        file.write_text(re.sub(r'<script type="application/ld\+json">.*?</script>', '', file.read_text()), encoding='utf-8')
        self.fails('missing Article JSON-LD')
        self.fails('missing BreadcrumbList JSON-LD')

    def test_graph_and_array(self):
        file = self.root / self.article
        text = file.read_text()
        pattern = r'<script type="application/ld\+json">(.*?)</script>'
        blocks = [json.loads(s) for s in re.findall(pattern, text)]
        text = re.sub(pattern, '', text)
        text = text.replace('</head>', '<script type="application/ld+json">' + json.dumps([{'@context': 'https://schema.org', '@graph': blocks}]) + '</script></head>')
        file.write_text(text, encoding='utf-8')
        self.assertEqual(check(self.root), [])


if __name__ == '__main__':
    unittest.main()
