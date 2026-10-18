# Aligno

Progress camera PWA: take the same photo over time, lined up with a ghost overlay of the previous one, then compare or export the series as a GIF or video. Live at https://victorvansande.github.io/aligno/ (GitHub Pages, `main` branch, repo root).

## Stack

- Plain HTML, CSS and vanilla JS. No framework, no build step, no npm. Keep it that way.
- `index.html`: all markup and CSS (design tokens on `:root`, dark theme via `@media (prefers-color-scheme: dark)` and `[data-theme]`).
- `app.js`: all logic. Data lives in IndexedDB (`projects` and `photos` stores, photos as Blobs plus a thumbnail).
- `sw.js`: service worker (cache-first app shell, share target, periodic reminder check).
- `gifenc.js`: vendored GIF encoder (gifenc 1.0.3), loaded with `import('./gifenc.js')`.
- `manifest.webmanifest`, `icons/`, `.nojekyll` (keeps Pages from running Jekyll).

## Rules for every change

1. **Bump the version on every deploy, in both places**: `APP_VERSION = 'vNN'` at the top of `app.js` and `CACHE = 'aligno-vNN'` at the top of `sw.js`. They must match. Without the bump, installed apps keep serving the old cached files.
2. **Element IDs**: `wire()` in `app.js` attaches listeners with `$('id')`. If you rename or remove an element in `index.html`, update `app.js` too, or one null `addEventListener` stops the whole app.
3. **Copy**: English UI text, plain and direct. Never use em dashes or typical AI phrasing ("seamless", "elevate", "delve" and the like). Use commas, periods or colons instead.
4. **Encoding**: files are UTF-8 without BOM. Don't round-trip them through tools that re-encode (for example Windows PowerShell 5.1 `Get-Content`/`Set-Content`).
5. **Commit messages**: start with the version, e.g. `v26: short description of what changed`.

## Testing locally

Serve the folder over HTTP (the camera and IndexedDB need a real origin, not `file://`):

```bash
python3 -m http.server 5200
```

Then open http://localhost:5200/. The service worker is deliberately not registered on `localhost`, so you always see fresh files. The camera only works over https or localhost.

Check the browser console for errors after changes. For layout or overflow issues, measure with `getBoundingClientRect()` rather than trusting scaled screenshots.

## Deploying

Commit and push to `main`. GitHub Pages publishes in about 30 seconds. Confirm by fetching `https://victorvansande.github.io/aligno/app.js` and checking the `APP_VERSION` line.
