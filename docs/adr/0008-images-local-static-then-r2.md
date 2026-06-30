# ADR 0008 — Images: local `/static` now, Cloudflare R2 for production

**Status:** Accepted · 2026-06

## Context
~9.8 GB of original product images live on the Magento server (paths are in the
DB, files are not). They were `rsync`'d locally. They must be served in dev and,
eventually, from a CDN in production.

## Decision
For dev: symlink `media/catalog` into `apps/backend/static/catalog` and serve via
the Medusa **local file module** at `/static`; `attach-images.ts` sets each
product's `thumbnail`/`images` to `…/static/...` URLs. For production: upload
`media/` to **Cloudflare R2** and switch URLs to `media.sansan.ee` (R2 env vars
are already stubbed).

## Consequences
**Positive**
- No 9.8 GB copy — one source of truth via symlink; 4,094 products get images.
- Clean dev/prod split; R2 is cheap, S3-compatible, CDN-fronted.

**Negative / risks**
- Image URLs are currently **absolute `localhost:9000`** values baked into product
  data — the R2 cutover must rewrite them (script needed).
- The symlink + `media/` are local-only (gitignored); a fresh clone has no images
  until rsync + attach are re-run.

## Alternatives considered
- **Point at live `sansan.ee` URLs.** Zero hosting now, but couples to the old
  site and its uptime. Rejected for local correctness.
- **Store images in Medusa uploads dir (copied).** Wastes 9.8 GB; symlink is leaner.
