// Renders scripts/social/social-card.html to a 2x PNG for social posts.
//
//   node scripts/social/render.mjs
//
// Writes two PNGs into publishing/community-posts/, each at deviceScaleFactor 2:
//   contexa-social-1200x675.png   (2400x1350, 16:9 — X feed crop)
//   contexa-social-1080x1080.png  (2160x2160, square — Reddit)
// The square layout is the same HTML with data-format="square" on <html>.
// Headless Chromium via Playwright; no extension is loaded, so no Xvfb is
// needed. Edit the HTML, never the PNGs.

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SRC = join(HERE, 'social-card.html');
const OUT_DIR = join(ROOT, 'publishing', 'community-posts');
const FORMATS = [
  { name: 'contexa-social-1200x675.png',  width: 1200, height: 675,  format: 'wide' },
  { name: 'contexa-social-1080x1080.png', width: 1080, height: 1080, format: 'square' },
];

// Same tolerant resolver as scripts/screenshots/capture.mjs: a global
// playwright install works without a node_modules in this repo.
const chromium = await (async () => {
  const tries = ['playwright', 'playwright-core'];
  for (const root of [null, process.env.NODE_PATH, '/opt/node22/lib/node_modules', '/usr/lib/node_modules']) {
    for (const name of tries) {
      const spec = root ? pathToFileURL(join(root, name, 'index.js')).href : name;
      try {
        const m = await import(spec);
        const c = m.chromium || (m.default && m.default.chromium);
        if (c) return c;
      } catch { /* keep looking */ }
    }
  }
  throw new Error('playwright not found — npm i -g playwright, or npm i playwright');
})();

const browser = await chromium.launch({ headless: true, executablePath: process.env.CX_CHROME || undefined });
try {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const { name, width, height, format } of FORMATS) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(SRC).href);
    await page.evaluate((f) => { document.documentElement.dataset.format = f; return document.fonts.ready; }, format);
    const out = join(OUT_DIR, name);
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height } });
    console.log('wrote', out);
    await page.close();
  }
} finally {
  await browser.close();
}
