# The Temple of Records (v9)

[![CI](https://github.com/Mina-Maxx/temple-of-records/actions/workflows/ci.yml/badge.svg)](https://github.com/Mina-Maxx/temple-of-records/actions/workflows/ci.yml)

A zero-dependency, bilingual (Arabic RTL / English LTR) Digital Forensics & Incident Response (DFIR) and CTF platform built with Node.js built-ins only, static HTML/CSS/JS, a JSON-file backend, and a built-in CMS under `/admin`.

---

## Quick Start

```bash
# 1. Start the server (Node >= 18)
npm start
# -> http://127.0.0.1:8000

# 2. Run all tests
npm test
# Windows PowerShell (if npm.ps1 execution policy is restricted):
cmd /c npm test
# Or run individual test suites:
node tests/public-boundaries.cjs
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` / `TOR_PORT` | `8000` | HTTP port (`PORT` binds to `0.0.0.0`, otherwise `127.0.0.1`) |
| `TOR_HOST` | `127.0.0.1` / `0.0.0.0` | Bind address override |
| `TOR_HTTPS` | `0` (`1` in prod) | Enable `Secure` cookies and HSTS (`Strict-Transport-Security`) |
| `TOR_TRUST_PROXY` | `0` (`1` when `PORT` set) | Trust `X-Real-IP` / `X-Forwarded-For` from reverse proxy |
| `TOR_DEV_CORS` | `0` | Enable `Access-Control-Allow-Origin: *` for local `file://` dev |
| `TOR_SHOW_SAMPLES` | `0` | Set to `1` to display `sample: true` demo challenges |
| `TOR_DATA_DIR` | `server/data` | Persistent directory for JSON/JSONL runtime data |
| `TOR_FLAGS_FILE` | `server/flags.json` | Path to salted SHA-256 flag hashes |
| `ADMIN_USER` / `ADMIN_PASSWORD` | — | Optional headless first-run admin setup (password >= 10 chars) |

---

## Data & Architecture Layout

- `server/server.js` — Static file server (strict allowlist), public API (`/api/state`, `/api/solvers`, `/api/submit`, `/health`, `/sitemap.xml`, `/feed.xml`, `/robots.txt`), and server-side meta/JSON-LD injection.
- `server/admin.js` — Authenticated CMS API under `/admin/api/*` (scrypt passwords, HMAC/token sessions, CSRF protection).
- `server/visibility.js` — Strict server-side filtering before `/content.js` or meta serialization (`challenges`, `articles`, opt-in `investigations` only).
- `server/data/` — Runtime JSON persistence (`store.json`, `site-settings.json`, `solves.json`, `players_names.json`, `players_state.json`, `submissions.jsonl`, `sessions.json`, `audit.jsonl`).
- `script.js` / `style.css` — Bilingual client rendering, flag submission, solvers hall-of-fame, mobile drawer.
- `admin/` — 18 CMS pages protected by session cookie.

---

## Deployment Options

- **Recommended (Production):** Small VPS with `nginx` + `systemd` (see [deploy/DEPLOY.md](deploy/DEPLOY.md)), or any PaaS with a **persistent disk** mounted at `TOR_DATA_DIR`.
- **Demo only:** Free ephemeral tiers (e.g., Render Free) wipe runtime data (`solves.json`, `submissions.jsonl`, admin edits) on every restart/redeploy. See [deploy/FREE_HOSTING.md](deploy/FREE_HOSTING.md).

---

## Known Limits

- Single-admin CMS model; no multi-user OAuth accounts for players (players use browser-generated 32-hex anonymous tokens).
- Local JSON/JSONL persistence (suitable for small-to-medium traffic, not high-concurrency multi-instance scaling).
- License: currently `UNLICENSED` (pending owner selection).

---

## Pre-Launch Checklist

1. Set `base_url` in `/admin/settings.html` (e.g. `https://mina-max.website`).
2. Replace sample/draft content in `/admin` (never ship demo placeholders).
3. Verify `default_language` (`en` or `ar`) in `/admin/settings.html`.
4. Set strong, random `ADMIN_USER` & `ADMIN_PASSWORD` env vars (or run first-run local setup).
5. Mount persistent storage at `TOR_DATA_DIR` and schedule `node scripts/backup.cjs 7`.
6. Verify `/sitemap.xml`, `/robots.txt`, `/feed.xml`, and `/health` return `200`.
7. Run `npm test` and confirm all assertions pass.

---

## النسخة العربية — معبد السجلات (v9)

منصة ثنائية اللغة (عربي RTL / إنجليزي LTR) للتحقيق الجنائي الرقمي (DFIR) وتحديات الـ CTF، مبنية بالكامل باستخدام Node.js القياسي بدون أي مكتبات خارجية.

- **التشغيل المحلي:** `npm start` على `http://127.0.0.1:8000`
- **الاختبارات:** `npm test` (أو `cmd /c npm test` في PowerShell على ويندوز)
- **لوحة التحكم:** `/admin/` (محمية بكلمة مرور مشفرة بـ `scrypt` و CSRF وتحديد معدل المحاولات).
- **النشر الإنتاجي:** يُنصح بخادم VPS أو استضافة تدعم قرصاً دائماً (Persistent Volume) عبر `TOR_DATA_DIR` للحفاظ على الحلول وتعديلات الأدمن.
