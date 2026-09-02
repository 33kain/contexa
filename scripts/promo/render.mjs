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
import { inflateSync, deflateSync } from 'node:zlib';

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
const OUT = join(ROOT, 'store-assets');

const TILES = [
  { id: 'tile',    file: 'promo-tile-440x280.png',     w: 440,  h: 280 },
  { id: 'marquee', file: 'promo-marquee-1400x560.png', w: 1400, h: 560 },
];

/* ---- PNG: strip the alpha channel Chromium always writes ----------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decode a Chromium screenshot PNG (8-bit RGBA or RGB, non-interlaced) and
 *  re-encode it as 8-bit RGB. Returns { buf, width, height }. */
function toRgb24(png) {
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8, width = 0, height = 0, colorType = 0, bitDepth = 0, interlace = 0;
  const idat = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos);
    const type = png.toString('latin1', pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2))
    throw new Error(`unexpected PNG layout: depth=${bitDepth} type=${colorType} interlace=${interlace}`);
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  const out = Buffer.alloc((width * 3 + 1) * height);
  let ip = 0, op = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[ip++];
    for (let x = 0; x < stride; x++) {
      const v = raw[ip++];
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let r;
      switch (filter) {
        case 0: r = v; break;
        case 1: r = v + a; break;
        case 2: r = v + b; break;
        case 3: r = v + ((a + b) >> 1); break;
        case 4: r = v + paeth(a, b, c); break;
        default: throw new Error(`bad filter ${filter}`);
      }
      cur[x] = r & 0xff;
    }
    out[op++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const s = x * bpp;
      if (bpp === 4 && cur[s + 3] !== 255) throw new Error(`transparent pixel at ${x},${y}`);
      out[op++] = cur[s]; out[op++] = cur[s + 1]; out[op++] = cur[s + 2];
    }
    cur.copy(prev);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const buf = Buffer.concat([
    png.subarray(0, 8),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(out, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return { buf, width, height };
}

/* ---- render ---------------------------------------------------------------- */

const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
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
