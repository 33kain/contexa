/* Shared by scripts/promo/render.mjs and scripts/screenshots/render-slides.mjs:
 * finding a Playwright Chromium, and re-encoding its screenshot as the 24-bit
 * RGB PNG the Chrome Web Store asks for.
 *
 * CX_CHANNEL=msedge (or chrome) launches an installed browser through
 * playwright-core instead of a downloaded Chromium — the way to render on a
 * machine with Edge and no Playwright browsers.
 */

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';

export async function findChromium() {
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
}

export function launchOptions() {
  const o = { headless: true, args: ['--no-proxy-server'] };
  if (process.env.CX_CHANNEL) o.channel = process.env.CX_CHANNEL;
  return o;
}

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
export function toRgb24(png) {
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
