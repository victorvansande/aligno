#!/usr/bin/env node
// Headless browser smoke test: serves the repo, opens the app in Chromium with
// a fake camera, and fails on console errors or uncaught exceptions.
//
//   node tools/smoke.cjs                 # check only
//   node tools/smoke.cjs shot.png        # also save a full-page screenshot
//   WIDTH=390 HEIGHT=844 node tools/smoke.cjs shot.png
//
// Needs Playwright (preinstalled globally in Claude Code cloud sessions).
const { spawn } = require('child_process');
const path = require('path');

function loadPlaywright() {
  const tries = ['playwright', '/opt/node22/lib/node_modules/playwright'];
  for (const t of tries) {
    try { return require(t); } catch {}
  }
  console.error('smoke: Playwright not found (npm i -g playwright)');
  process.exit(2);
}

const { chromium } = loadPlaywright();
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 5200);
// localhost on purpose: app.js skips service worker registration there.
const URL = `http://localhost:${PORT}/`;

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(URL)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  const problems = [];
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    });
    const page = await browser.newPage({
      viewport: { width: Number(process.env.WIDTH || 390), height: Number(process.env.HEIGHT || 844) },
    });
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`exception: ${e.message}`));
    page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const version = await page.evaluate(() => typeof APP_VERSION === 'string' ? APP_VERSION : null);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) problems.push(`layout: page is ${overflow}px wider than the viewport`);
    if (process.argv[2]) await page.screenshot({ path: process.argv[2], fullPage: true });
    if (problems.length) {
      console.log('smoke failed:');
      for (const p of problems) console.log('  ' + p);
      process.exitCode = 1;
    } else {
      console.log(`smoke ok: ${version || 'unknown version'} loaded, no console errors`);
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => { console.error('smoke: ' + e.message); process.exit(1); });
