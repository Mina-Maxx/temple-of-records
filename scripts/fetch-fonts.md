# Self-Hosting Fonts (`assets/fonts/`)

Currently, the site loads Google Fonts with per-language subsets (Latin-only on `*-en.html`, Arabic + display on `*-ar.html`). To eliminate external font requests and tighten CSP to `font-src 'self'`:

## 1. Download `.woff2` subsets into `assets/fonts/`

Run the following commands (e.g. using `curl` with a modern Chrome `User-Agent` so Google returns `.woff2`, or `google-webfonts-helper`):

```bash
mkdir -p assets/fonts
# Example: fetch CSS with woff2 User-Agent and download each url(...) into assets/fonts/
# Families needed:
# - Cinzel (400, 500, 600, 700) -> cinzel-400.woff2 ...
# - Inter (400, 600) -> inter-400.woff2, inter-600.woff2
# - JetBrains Mono (400) -> jetbrains-mono-400.woff2
# - IBM Plex Sans Arabic (400, 600, 700) -> ibm-plex-sans-arabic-400.woff2 ...
# - Aref Ruqaa (400, 700) -> aref-ruqaa-400.woff2, aref-ruqaa-700.woff2
# - Tajawal (400, 700) -> tajawal-400.woff2, tajawal-700.woff2 (loaded only when font_ar=Tajawal)
```

## 2. Activate `@font-face` & Tighten CSP
1. Uncomment the `@font-face` rules in `style.css` (with `font-display: swap`).
2. Remove `<link href="https://fonts.googleapis.com...">` from all HTML pages (`*.html`, `404.html`, `admin/*.html`).
3. Update `Content-Security-Policy` in `server/server.js` to:
   `style-src 'self' 'unsafe-inline'; font-src 'self';`
