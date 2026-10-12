# Preserve the deployed first-party statistics

Read `ANALYTICS.md` before any content or deployment update. This Site uses a Worker and the existing `DB` D1 binding; it is no longer a buildless static deployment.

- Edit content in `site-static/`. Do not recreate the old `dist/` source tree or replace `.openai/hosting.json` with a static manifest.
- Preserve the project ID, `d1: DB`, schema-only migrations, owner report access, anonymous pageview-only fields, QA exclusions, and approved retention behavior.
- Run the SEO tests, `scripts/build_worker.py`, artifact validation, and pageview regression tests described in `ANALYTICS.md` before publication.
- Keep GitHub `eday06011984/buy-house-king` and the Sites source repository on the same complete tracked file tree. Read both current heads first and preserve newer content; their commit IDs differ because their histories differ. Never copy an older mirror over the current Site.
- Use the Sites source workflow to package the Worker output. Never publish the `site-static/` source directory as a static replacement.
- Never commit node_modules, local dependency symlinks, credentials, runtime data, or synthetic production traffic.
