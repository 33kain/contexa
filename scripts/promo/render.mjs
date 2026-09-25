/* CONTEXA — Chrome Web Store promo tile renderer.
 *
 *   node scripts/promo/render.mjs
 *
 * Renders the two boards in scripts/promo/tiles.html to
 *
 *   store-assets/promo-tile-440x280.png
 *   store-assets/promo-marquee-1400x560.png
 *
 * and fails rather than writing a wrong one: each PNG is checked for exact
 * dimensions and re-encoded as 24-bit RGB (no alpha), which is what the
 * store asks for and what a headless Chromium screenshot does not give you.
 *
 * WHY THIS FILE IS COMMITTED. The first tiles (0.9.5x) were one-off PNGs
 * with nothing behind them. When the product changed under them — the
 * interview card they showed was deleted at 0.9.58 — there was nothing to
 * edit and re-run, so they went on advertising a mechanism that no longer
 * existed for a month. The images are an output; this is the source.
 *
 * Runs headless; nothing here loads the extension, it is a picture of the
 * product's own markup and tokens, drawn from content.js by hand. Playwright
 * and Chromium come from the dev image, the same way scripts/screenshots/
 * finds them.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findChromium, launchOptions, toRgb24 } from '../lib/render-png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const OUT = join(ROOT, 'store-assets');

const TILES = [
  { id: 'tile',    file: 'promo-tile-440x280.png',     w: 440,  h: 280 },
  { id: 'marquee', file: 'promo-marquee-1400x560.png', w: 1400, h: 560 },
];

/* ---- render ---------------------------------------------------------------- */

const chromium = await findChromium();
const browser = await chromium.launch(launchOptions());
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(HERE, 'tiles.html')).href);
  await page.evaluate(() => document.fonts.ready);
  for (const t of TILES) {
    const el = page.locator(`#${t.id}`);
    const box = await el.boundingBox();
    if (!box || Math.round(box.width) !== t.w || Math.round(box.height) !== t.h)
      throw new Error(`#${t.id} laid out at ${box?.width}x${box?.height}, want ${t.w}x${t.h}`);
    /* Nothing may spill past its board: text that wraps one line too far is
       silently clipped by overflow:hidden, which is exactly the wrong failure. */
    const spill = await el.evaluate((b) => {
      const r = b.getBoundingClientRect();
      const bad = [];
      for (const n of b.querySelectorAll('*')) {
        if (n.closest('.frame')) continue; // the marquee's mock deliberately runs off the bottom edge
        const q = n.getBoundingClientRect();
        if (q.width && (q.right > r.right + .5 || q.bottom > r.bottom + .5))
          bad.push(`${n.className || n.tagName} ${Math.round(q.right - r.right)}/${Math.round(q.bottom - r.bottom)}`);
      }
      return bad;
    });
    if (spill.length) throw new Error(`#${t.id}: content past the board edge: ${spill.join('; ')}`);
    /* And the footer must sit clear of the row above it — the first render
       of the small tile had the third chip printed over the footer, inside
       the board, where the edge check cannot see it. */
    const overlap = await el.evaluate((b) => {
      const foot = b.querySelector(':scope > .foot, .brand > .foot');
      if (!foot) return 0;
      const ft = foot.getBoundingClientRect().top;
      let worst = 0;
      for (const n of b.querySelectorAll('.chip, .tag, .lead, .box'))
        if (!n.closest('.frame')) worst = Math.max(worst, n.getBoundingClientRect().bottom - ft);
      return worst;
    });
    if (overlap > 0) throw new Error(`#${t.id}: content runs ${Math.round(overlap)}px into the footer`);
    const shot = await el.screenshot({ type: 'png' });
    const { buf, width, height } = toRgb24(shot);
    if (width !== t.w || height !== t.h) throw new Error(`${t.file}: got ${width}x${height}`);
    const path = join(OUT, t.file);
    writeFileSync(path, buf);
    console.log(`ok  ${t.file}  ${width}x${height}  ${buf.length} bytes`);
  }
} finally {
  await browser.close();
}
