THE TEMPLE OF RECORDS | v7 deployment-hardened build, 23 November 2026
================================================================
Private source preview. Nothing is deployed. No hosting account was created.
v7 CHANGES: old offline editor (admin.html / admin.js) no longer served; first-run
  setup refused for any request carrying proxy headers; proxy-aware client IP
  (TOR_TRUST_PROXY=1); Secure cookie + HSTS (TOR_HTTPS=1); wildcard CORS off unless
  TOR_DEV_CORS=1; CSP and Permissions-Policy headers; "design preview" footer notes
  removed from public pages; deploy/ kit (nginx, systemd, DEPLOY.md). Sample content
  and About placeholders are still present and must be replaced before launch.

RUN
  Requires Node.js 18+; built-in modules only, no npm install.
  node server/server.js
  Public site: http://127.0.0.1:8000/
  Admin:       http://127.0.0.1:8000/admin/
  First run offers a one-time LOCAL admin setup. Choose your own credentials.
  No admin credential or session is included in this archive.
  Keep the server bound to 127.0.0.1 and put nginx+TLS in front: see deploy/DEPLOY.md.

CONTENT AND SAFETY
  Use /admin/ for durable server-side changes. admin.html is an older offline
  browser-only editor. It stays in the source (admin.js is still used by the
  server for validation) but the server no longer serves either file.
  Server data lives in server/data/. Back up this directory AND content.js,
  server/flags.json, assets/ and the source before changing or upgrading.
  Do not delete server/data to reset a password. That would delete content
  and progress. Stop the server, take a private backup, then use:
    node server/reset-admin.cjs --confirm-local-reset
  This removes admin credentials and sessions only. No recovery email is sent.
  Start again, open /admin/ and create a new local admin.

PUBLIC SITE
  Twelve bilingual pages: home, challenge list/detail, article list/detail,
  About. Lists include search/filters. Challenge hints, spoiler-reveal solution,
  flag submission, saved anonymous solves and badges are connected.
  The solution reveal is a spoiler cover, NOT a solve gate or secret storage.
  Sample challenge is fabricated training data, not a claimed investigation.
  Sample flag: TOR{198.51.100.44}. Local fixture files are not served by HTTP.
  Personal photograph, achievements, credentials, articles, contacts and real
  evidence URLs remain labelled placeholders where Mina has not supplied them.

CMS
  Shell: search, quick-create, activity menu, profile menu, sidebar collapse,
  Arabic RTL/English LTR, logout confirmation and session expiry handling.
  Dashboard: live local totals, 14-day submissions/solves, per-challenge solves,
  results and audit activity. Empty charts stay empty, no fabricated traffic.
  Challenges/articles: bilingual fields and slugs, metadata, draft/publication
  state, structured blocks, private saved-content preview, archive and updates.
  Challenges: duplicate, hard-delete, Featured, scenario/objectives/skills/tools,
  instructions, hints/reorder/draft state, external evidence metadata and flags.
  Blocks: headings, paragraphs, code, inline-code blocks, links, quotes, lists,
  callouts, images, tables and timeline. Table editing uses validated JSON.
  Per-block publication is enforced before public serialization.
  Structured blocks are NOT a WYSIWYG or Markdown editor. Inline-code and link
  blocks are standalone blocks, not text selections within a paragraph.
  Knowledge base, investigations and projects: schema-driven bilingual editors.
  Categories: challenge/article/KB/project types, bilingual names and slugs.
  Tags: bilingual definition library plus content usage and bulk rename.
  Media: site-image upload/search/preview/replace/delete. Max 4 MB, JPG/PNG/GIF/
  WebP, magic bytes plus structural validation and browser decoding. SVG upload
  rejected. The server does NOT fully decode every image format.
  Settings: fixed texts, logo/favicon, gold/theme/font, default language, default
  metadata, sharing image, existing contact fields, other link and site origin.
  Sitemap is absent until an actual HTTPS origin is configured, then includes
  visible article/challenge detail URLs and the eight index/list/About pages.
  Password change requires current password and invalidates all sessions.
  Sessions have a fixed 12-hour lifetime, HttpOnly/SameSite cookie and CSRF.

EVIDENCE POLICY
  External HTTPS download and mirror URLs only. No forensic upload, storage,
  evidence dropzone, remote checksum download, or signed private-download system.
  Name/type/size/SHA-256/descriptions/visibility/availability are editable.
  SHA-256 has format validation, not independent verification of remote bytes.
  Size/hash are author-supplied. Hidden entries are excluded server-side.
  Planned/unavailable entries have no public download button. Hosted evidence
  usage is zero by design; media-library bytes are a different category.

LIMITS AND REVIEW
  See REVIEW.md for requirement coverage, tests and known omissions.
  Anonymous player tokens only. No registered-user service, password recovery
  email, achievement service or cross-device account login. Disabling a token
  does not prevent someone from creating another anonymous token.
  No scheduled publication or hint penalty (both optional in the brief).
  Preview shows saved content only, not unsaved edits.
  Local JSON persistence, in-memory abuse limits, no TLS, no strict CSP,
  no production backup/restore or reverse-proxy validation. No security guarantee.
  Raw file:// is only an offline preview. Never publish raw content.js or this
  source directory on a static-only host, it bypasses server visibility rules.
  Font delivery needs Google Fonts; fallbacks apply without network access.
  The old cloud/ deployment experiment is intentionally NOT included.

TESTS (disposable copies, never the delivered data)
  node tests/public-boundaries.cjs
  node tests/admin-regression.cjs
  python3 tests/ui-smoke.py   (requires local Chrome)
  Review was also exercised in local Chrome at desktop/tablet/mobile widths.
  Previous v3 is preserved separately and was not overwritten.
