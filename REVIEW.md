# Local implementation review

Reviewed 23 November 2026. This is a local source build, not a deployed service or a production-security sign-off. The original v3 was not overwritten. No hosting, paid service or external account was created.

## Coverage against the 20-section admin brief

| Section | Current result | Limit or distinction |
|---|---|---|
| 1. Product | Bilingual DFIR public site, private CMS, CTF submissions | Local Node/JSON service, not a hosted platform |
| 2. Art direction | Basalt surfaces, sand/gold/teal accents, Egyptian public imagery and separators; clean data forms | Admin is more restrained than the public site. No separate illustrated admin mockup was provided |
| 3. Layout | Responsive sidebar, breadcrumbs, search, language, recent audit menu, profile menu, quick create | Activity menu uses real audit records, not a separate notification-delivery system |
| 4. Dashboard | Challenge/article/player/submission/solve totals, published/preparation counts, evidence count and zero hosted-evidence bytes; 14-day charts, result/per-challenge charts, audit table | Charts reflect local data only; no invented traffic. Evidence sizes are supplied metadata, not measured remote storage usage |
| 5. Challenge management | Search, category/difficulty/status/date/performance filters; ID/title/category/difficulty/points/evidence/solves/status/updated; edit/preview/duplicate/archive/delete | ID is beneath title rather than a separate column. Archive restore publishes as available |
| 6. Challenge editor | Bilingual titles/slugs/brief fields, Featured, points, estimated time, external evidence metadata, salted flags, ordered draft/published hints, solution-zone blocks, saved-content preview, publication states | Structured block editor, not Markdown/WYSIWYG. Draft via status plus Save. No optional scheduling or hint penalty. Evidence upload superseded by external-link-only policy. Flag regex/case policy is global, not independent per challenge |
| 7. Submissions | Masked flags, challenge/result/player/date filters, pagination, details modal, hashed IP values | Most recent 500 submissions; audit most recent 200. No full historical query service. In-memory rate limits are not a durable abuse system |
| 8. Players | Anonymous tokens, points, first/last activity, solved IDs, submission history, search/state filter and disable/enable | No registered users, usernames, achievement history, account login or recovery. Token disable is not a ban on a person. No unnecessary personal data collected |
| 9. Evidence repository | Central search/type/challenge filter, size/hash/link metadata, challenge-editor management | External HTTPS only. No forensic hosting/upload/private storage/signed URLs. Hash format validation is not remote checksum verification; remote bytes were not downloaded |
| 10. Articles | Bilingual title/slug/excerpt/content/category/tags/SEO fields, dates/status/updated listing, image, structured headings/code/links/callouts/tables | Standalone inline-code/link blocks, not inline text-range formatting. References use link/text blocks. Independent AR/EN text fields share a block structure |
| 11. Knowledge base | Bilingual title/body/category, tags, related article/challenge IDs, status | Relation IDs are not foreign-key checked. No separate public KB page in the supplied public design |
| 12. Investigations/projects | Bilingual overview/body, case ID as item ID, evidence links, timeline/findings/analysis/root cause/lessons, tech/repository/screenshots/documentation/status | No invented investigations or achievements. Managed internally, no separate public archive/project pages added |
| 13. Taxonomy | Challenge/article/KB/project category types, bilingual names/slugs; bilingual tag-definition CRUD, used-tag counts and cross-content rename | Categories remain text on items with suggestions, not a strict relational taxonomy. Tag definition archive leaves existing content uses intact |
| 14. Media | Site image upload/progress/search/preview/replace/delete and reference guard | JPG/PNG/GIF/WebP, 4 MB. Browser decode plus server structure/magic checks, not full server image decoding. Not forensic evidence storage |
| 15. Settings | Identity/description/logo/favicon/default language, gold/font/theme, fixed contact texts, other HTTPS link, SEO/default sharing image and sitemap origin | RTL follows selected language; no arbitrary direction override. Sitemap requires real HTTPS origin. No automatic external-link health check |
| 16. Auth/security | Local first-run admin, login, local recovery guide/script, current-password change, fixed 12-hour session, expiry warning, logout confirm, server route/session/CSRF checks, audit and basic limits | No email reset or recovery service. No TLS/secure-cookie/proxy/production rollout assurance. See hardening limits below |
| 17. Bilingual | EN LTR and AR RTL across admin shell/forms; LTR-isolated hashes/URLs/code/numbers | Some technical identifiers, status tokens and validation codes deliberately remain English |
| 18. Components | Shared shell, cards/tables/filters/modal/forms/block helpers/badges/toasts/pagination/skeletons; media dropzone | Not an exported Figma component library. Forensic dropzone intentionally absent |
| 19. States | Defaults, hover/focus/selected, empty/loading, confirmation, save/error/validation, unsaved guard, upload progress/failure, auth denial/expiry | Not every transient state has a separate screenshot frame; no exhaustive accessibility or browser compatibility certification |
| 20. Deliverables | Working local source and responsive EN/AR site/CMS, shared CSS/JS components, tests and this review | Not a Figma file, not hosting, not a production backend |

## Design comparison

Compared the public screens with the supplied Figma PDF: home, challenge list/detail, article list/detail, About, in Arabic and English. Inspected actual browser captures at desktop and mobile sizes, with admin tablet checks at 1024 px.

Aligned: stone header/footer textures, gold top line, active-nav pill, frieze, full-width title/banner treatment, wide challenge rows, papyrus article cards, taller hero/CTA placement, scribe section and scarab footer. Palette sampled from the design sheet: background #0B1414, stone #162322, paper #E7D6AF, gold #D7B776, ink #251F15, muted #B4BEB4, teal #89CFC3 and line #65583B.

Typography is not an exact font-for-font match to the PDF: Cinzel/Inter/JetBrains Mono remain for English; Arabic display uses Aref Ruqaa and technical/body text uses IBM Plex Sans Arabic per the later typography direction rather than the PDF's Amiri/Cairo pairing. Fonts depend on network-loaded Google Fonts, with fallbacks. Tajawal is loaded when chosen as a body option.

Not pixel-identical: real placeholder/demo text affects height and wrapping; About retains labelled photograph/credential placeholders, not a fabricated personal photo or achievements; ornament assets are adapted, not a promise of identical illustration geometry. Public mobile layouts are responsive adaptations, not fixed Figma frames. Admin dense tables scroll within their own containers on smaller screens.

## Verification performed

- `node tests/public-boundaries.cjs`: 36 assertions. Hidden/draft/private/archived records, hidden artifacts, draft hints and draft sections excluded from public serialization. Public revealable walkthrough retained. Closed challenges reject submission. Solve persistence and restricted static routes checked.
- `node tests/admin-regression.cjs`: 17 assertions. Setup/login, protected preview HTML and content, persisted solve counts/charts, malformed JSON, slug collision, safe duplication, archive/restore, fixed session storage, no invented sitemap origin, guarded local reset preserving content and solves.
- `python3 tests/ui-smoke.py`: Arabic submission-result filter shows one matching wrong-result row.
- Local Chrome UI workflow: article/challenge save and public reflection; media upload; incorrect/correct flag flow; hints, reveal button and solve badge; create/archive article; About fixed fields and SEO; search/activity/collapse/logout; external-evidence metadata save, hidden-item exclusion, unavailable download state and HTTP rejection.
- Additional local Chrome workflow: KB/investigation/project create/edit/persist/hide; category CRUD and type/slugs; list/image/table/code block save/render; metadata/slug routing and language link; draft publication; identity/theme/sitemap; password wrong-current rejection/change/new login; private draft preview; bilingual tag create/edit/archive; separate unsaved scopes for settings and content. Player/date filters, disabled-state persistence, English LTR and English mobile evidence editor were also exercised.
- Responsive admin: 390 px and 1024 px captures had document scroll width equal to viewport. Full-site sweep covered 58 page/width cases, with no unhandled runtime or local-resource errors after adding the missing favicon. Authenticated login redirects to dashboard are expected.
- Public full-page captures: 12 pages at desktop and mobile. Actual pixels inspected for hierarchy, banners/cards, Arabic mirroring and readable layouts. These are inspection evidence, not a claim of pixel-perfect equivalence.

Tests use disposable copies. Delivered `server/data/` contains only the clean content store, no test admin, sessions, submissions, solve history, modified test settings or uploaded test media. Example HTTPS URLs used in tests were synthetic fixtures in disposable copies, not real verified download targets.

## Before any public launch

Choose a hosting/backend route under separate approval. Review TLS/secure cookies, persistent abuse controls, proxy-safe IP handling, strict CSP/inline script strategy, input handling, recovery and backups, image decoding and storage. Test deployment, restore and access boundaries on the actual target. Replace or hide sample content and configure real domain/contact/evidence URLs. Raw `content.js` contains the content store and must not be exposed as a static deployment: use the filtered server route.

## v7 changes (23 November 2026)

Fixes from the security read-through of v6:

| Finding | Change |
|---|---|
| Old editor `admin.html`/`admin.js` reachable without a session | Removed from the static allowlist; tests assert 404 |
| Behind nginx every visitor shared IP 127.0.0.1 (shared rate limits; localhost-only setup check bypassable) | `TOR_TRUST_PROXY=1` uses `X-Real-IP` only from a loopback peer; setup refused if any proxy header is present |
| Cookie without `Secure`, no HSTS | `TOR_HTTPS=1` adds both |
| Wildcard CORS on the API | Off by default; `TOR_DEV_CORS=1` only for the file:// preview |
| No CSP | Baseline CSP (self + Google Fonts, inline allowed), Permissions-Policy |
| "Design preview, edit content" footer on all public pages | Removed |

Tests: `public-boundaries` 41 assertions, `admin-regression` 17, all passing. An HTTPS-mode smoke run confirmed Secure cookie, HSTS, direct setup 200 / proxied setup 403, and per-client login throttling.

Not changed (still true): single salted SHA-256 for flags (use long random flags), inline scripts remain so the CSP is a baseline not a strict policy, local JSON persistence, anonymous player tokens. Sample challenge/article and About placeholders are content, not code, and must be replaced by the owner.

## v8 changes

1. **Leak fix (important).** `publicCollections()` used to serialize *every* collection into the public `/content.js`, so any `kb`, `projects` or `investigations` record whose status was not draft/private/archived (for example `closed`, `published`, `active`) was readable by anyone. It now publishes only `challenges`, `articles` and opt-in `investigations`; everything else is never serialized.
2. **Public investigations pages** (`investigations-{en,ar}.html`, `investigation-{en,ar}.html`). Opt-in: admin sets Visibility = Public and Status != Draft. Existing records default to private. Only whitelisted fields are published. The nav link appears only when at least one case file is public. Sitemap includes them.
3. **No more "to be added" filler on the public site.** Empty date/tags/difficulty lines are omitted, empty Repository/Evidence regions are hidden, and the home page hides the Articles register when there are no public articles. (Placeholder *content* in store.json, such as the sample article titled "Article title, to be added", must still be replaced or removed by the owner.)

Tests: `tests/visibility-collections.cjs` (9 assertions) added to `npm test`.

Still open from the v7 review: `clientIp()` trusts the first `X-Forwarded-For` entry (login throttle can be bypassed), Render free-tier storage is ephemeral, and the repository is public.

## v9 changes

- Branch `v9-cleanup`: hidden placeholder/sample content by default (`TOR_SHOW_SAMPLES=1` opt-in, `isPlaceholder()` helper), unified `README.md` + `package.json` v9.0.0, server-side SEO/OpenGraph/JSON-LD injection, HTTP caching + zlib compression, optimized WebP/responsive images, bugfixes (`404.html` `<base href="/">`, `clientIp()` last-XFF fix, `aria-current`, duplicate `pill-lang` cleanup), architecture cleanup (`server/validators.js`, `store.json` single source of truth, `TOR_DATA_DIR` + atomic writes + backups), CI workflow, and new features (scoreboard, inline Markdown, MITRE ATT&CK tags, scheduled publication, hint penalties, global search, gated solutions, lab Docker packaging).
