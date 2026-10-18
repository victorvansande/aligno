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

Serve the folder over HTTP (the camera and IndexedDB need a real origin, not `file://`). On Windows: `powershell -ExecutionPolicy Bypass -File serve.ps1` (port 5200). Elsewhere:

```bash
python3 -m http.server 5200
```

Then open http://localhost:5200/. The service worker is deliberately not registered on `localhost`, so you always see fresh files. The camera only works over https or localhost.

Check the browser console for errors after changes. For layout or overflow issues, measure with `getBoundingClientRect()` rather than trusting scaled screenshots.

## Checks (run before every commit, locally and in the cloud)

```bash
python3 tools/check.py        # version sync, BOM, em dashes, $('id') vs markup
node tools/smoke.cjs shot.png # headless Chromium: loads the app, fails on console errors or horizontal overflow
```

`smoke.cjs` serves the repo itself on port 5200, uses a fake camera, and takes `WIDTH`/`HEIGHT` env vars (default 390x844). It needs Playwright, which cloud sessions have preinstalled; locally run `npm i -g playwright` once if you want it. `tools/` and `.claude/` are dev-only: they are not in the service worker's `ASSETS`, so they don't affect the app.

## Deploying

Commit and push to `main`. GitHub Pages publishes in about 30 seconds. Confirm by fetching `https://victorvansande.github.io/aligno/app.js` and checking the `APP_VERSION` line.

Commits that only touch dev files (`CLAUDE.md`, `tools/`, `.claude/`) don't need a version bump, since the app files are unchanged.

## Cloud sessions (Claude Code on the web)

- `.claude/settings.json` runs a SessionStart hook that prints the branch and runs `tools/check.py`.
- Cloud sessions get a working branch (like `main-xxxx`). The site only updates from `main`, so when Victor asks for a deploy, push to `main` (or merge the working branch into it).
- `victorvansande.github.io` is blocked by the default cloud network policy. Verify a deploy through the GitHub MCP instead: `actions_list` → `list_workflow_runs` and check that the newest "pages build and deployment" run has the pushed commit's SHA and `conclusion: success`. Or add `victorvansande.github.io` under Allowed domains in the environment's network settings to fetch `app.js` directly.
