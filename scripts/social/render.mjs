// Renders scripts/social/social-card.html to a 2x PNG for social posts.
//
//   node scripts/social/render.mjs
//
// Writes publishing/community-posts/contexa-social-1200x675.png (2400x1350
// pixels, 1200x675 CSS px at deviceScaleFactor 2). Headless Chromium via
// Playwright; no extension is loaded, so no Xvfb is needed. Edit the HTML,
// never the PNG.

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SRC = join(HERE, 'social-card.html');
const OUT_DIR = join(ROOT, 'publishing', 'community-posts');
const OUT = join(OUT_DIR, 'contexa-social-1200x675.png');
const SIZE = { width: 1200, height: 675 };

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
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(SRC).href);
  await page.evaluate(() => document.fonts.ready);
  mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, ...SIZE } });
  console.log('wrote', OUT);
} finally {
  await browser.close();
}
