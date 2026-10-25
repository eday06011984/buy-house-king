import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1] / 'site-static'

class NavigationTests(unittest.TestCase):
    def test_mobile_navigation_is_available(self):
        for relative in ('index.html', 'mortgage-grace-period/index.html'):
            html = (ROOT / relative).read_text()
            self.assertNotIn('.navlinks{display:none}', html)
            self.assertIn('.navlinks{display:flex;flex-wrap:wrap;', html)

    def test_journey_links_resolve(self):
        html = (ROOT / 'index.html').read_text()
        for slug in ('first-home-down-payment', 'first-home-real-price-registration', 'used-house-viewing-checklist', 'first-home-contract-checklist', 'used-house-handover-inspection'):
            self.assertIn(f'<strong><a href="/{slug}/">', html)
            self.assertTrue((ROOT / slug / 'index.html').is_file())

if __name__ == '__main__':
    unittest.main()
