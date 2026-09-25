/* CONTEXA — Chrome Web Store screenshot renderer (the designed set).
 *
 *   node scripts/screenshots/render-slides.mjs
 *   CX_CHANNEL=msedge NODE_PATH=<dir with playwright-core> node scripts/screenshots/render-slides.mjs
 *
 * Renders each <section data-file> in slides.html to publishing/screenshots/
 * at exactly 1280x800, 24-bit RGB. Fails rather than writing a wrong frame:
 * wrong size, or any element spilling past the frame's own box or the board.
 *
 * WHY THIS FILE IS COMMITTED. The 0.9.95 set (2026-09-07) was authored
 * elsewhere and only its PNGs landed here, so when the button was renamed
 * there was nothing to edit. slides.html is the source; the PNGs are output.
 * capture.mjs is the other camera — the real extension against a mock page —
 * and is kept for checking the card, not for the listing.
 */

import { writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findChromium, launchOptions, toRgb24 } from '../lib/render-png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', '..', 'publishing', 'screenshots');
const W = 1280, H = 800;

const chromium = await findChromium();
const browser = await chromium.launch(launchOptions());
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(HERE, 'slides.html')).href);
  await page.evaluate(() => document.fonts.ready);
  const files = await page.$$eval('section[data-file]', (s) => s.map((n) => [n.id, n.dataset.file]));
  if (files.length !== 5) throw new Error(`want 5 frames, found ${files.length}`);
  for (const [id, file] of files) {
    const el = page.locator(`#${id}`);
    const spill = await el.evaluate((b) => {
      const bad = [];
      const inside = (q, r) => q.right <= r.right + .5 && q.bottom <= r.bottom + .5 && q.left >= r.left - .5;
      const board = b.getBoundingClientRect();
      for (const n of b.querySelectorAll('*')) {
        const q = n.getBoundingClientRect();
        if (!q.width) continue;
        const frame = n.parentElement && n.parentElement.closest('.frame');
        const box = frame ? frame.getBoundingClientRect() : board;
        if (!inside(q, box)) bad.push(`${n.className || n.tagName}`);
      }
      return bad;
    });
    if (spill.length) throw new Error(`#${id}: content past its box: ${spill.join('; ')}`);
    const { buf, width, height } = toRgb24(await el.screenshot({ type: 'png' }));
    if (width !== W || height !== H) throw new Error(`${file}: got ${width}x${height}`);
    writeFileSync(join(OUT, file), buf);
    console.log(`ok  ${file}  ${width}x${height}  ${buf.length} bytes`);
  }
} finally {
  await browser.close();
}
