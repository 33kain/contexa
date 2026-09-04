/* CONTEXA — website asset renderer.
 *
 *   node scripts/website/render.mjs
 *
 * Renders the two boards in scripts/website/assets.html to
 *
 *   publishing/website/og.png               1200×630, the social preview
 *   publishing/website/apple-touch-icon.png  180×180
 *
 * and fails rather than writing a wrong one: each PNG is checked for exact
 * dimensions. The images are an output; this file and assets.html are the
 * source, for the same reason scripts/promo/ exists — a PNG with nothing
 * behind it cannot be edited when the product changes under it.
 *
 * Runs headless. Playwright and Chromium come from the dev image, found the
 * same way scripts/promo/render.mjs finds them.
 */

import { writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const chromium = await (async () => {
  for (const root of [null, process.env.NODE_PATH, '/opt/node22/lib/node_modules', '/usr/lib/node_modules']) {
    for (const name of ['playwright', 'playwright-core']) {
      const spec = root ? pathToFileURL(join(root, name, 'index.js')).href : name;
      try {
        const m = await import(spec);
        const c = m.chromium || (m.default && m.default.chromium);
        if (c) return c;
      } catch {}
    }
  }
  throw new Error('playwright not found — npm i -g playwright && npx playwright install chromium');
})();

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const OUT = join(ROOT, 'publishing', 'website');

const BOARDS = [
  { id: 'og',    file: 'og.png',               w: 1200, h: 630 },
  { id: 'touch', file: 'apple-touch-icon.png', w: 180,  h: 180 },
];

function pngSize(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const launch = { headless: true };
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch(launch);
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(HERE, 'assets.html')).href, { waitUntil: 'load' });
  for (const b of BOARDS) {
    const el = page.locator('#' + b.id);
    const png = await el.screenshot({ type: 'png' });
    const { w, h } = pngSize(png);
    if (w !== b.w || h !== b.h) throw new Error(`${b.file}: rendered ${w}×${h}, expected ${b.w}×${b.h}`);
    writeFileSync(join(OUT, b.file), png);
    console.log(`wrote publishing/website/${b.file} (${w}×${h}, ${png.length} bytes)`);
  }
} finally {
  await browser.close();
}
