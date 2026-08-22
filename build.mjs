/* CONTEXA build Ã¢â‚¬â€ extension/ (canonical, placeholder-carrying) -> build-ready/ (shippable).
   Exists because every hand-rebuild is a chance to forget the URL bake, the host
   pin, or the version bump. Run: node build.mjs
   Fails loudly rather than shipping a half-baked bundle. */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync, crc32 as zlibCrc32 } from 'node:zlib';

const VERSION = '0.9.27';
const BACKEND = 'https://contexa-api.michu110899.workers.dev';

const SRC = 'extension';
const OUT = 'build-ready';
const HOST = BACKEND.replace(/\/+$/, '') + '/*';

mkdirSync(join(OUT, 'icons'), { recursive: true });

/* --- background.js: bake the real backend URL ------------------------------ */
/* Must be idempotent. The git repo tracks the BUILT extension, so SRC often
   already contains the real URL Ã¢â‚¬â€ in which case the replace is a no-op and that
   is success, not failure. An earlier version of this guard compared the string
   before and after and threw whenever nothing changed, which broke the build on
   the only machine that runs it. Assert the pattern MATCHED, not that it changed. */
let bg = readFileSync(join(SRC, 'background.js'), 'utf8');
const proxyRe = /const DEFAULT_PROXY_URL = '[^']*';/;
if (!proxyRe.test(bg)) throw new Error('DEFAULT_PROXY_URL not found Ã¢â‚¬â€ did background.js change shape?');
bg = bg.replace(proxyRe, `const DEFAULT_PROXY_URL = '${BACKEND}';`);
// Drop the now-answered TODO so the shipped file does not tell a reviewer it is unfinished.
bg = bg.replace(
  /\/\/ TODO before publishing:[\s\S]*?See worker\/README\.md\.\n/,
  '// Baked by build.mjs. Users can override this in Advanced settings.\n'
);
writeFileSync(join(OUT, 'background.js'), bg);

/* --- manifest.json: version + exact host pin ------------------------------- */
const mf = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));
mf.version = VERSION;
// An exact host reads far better in store review than a *.workers.dev wildcard.
mf.host_permissions = mf.host_permissions.map(h =>
  h.includes('workers.dev') ? HOST : h
);
if (!mf.host_permissions.includes(HOST)) mf.host_permissions.push(HOST);
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(mf, null, 2) + '\n');

/* --- everything else copies verbatim -------------------------------------- */
for (const f of ['content.js', 'options.html', 'options.js', 'README.md']) {
  copyFileSync(join(SRC, f), join(OUT, f));
}
for (const f of readdirSync(join(SRC, 'icons'))) {
  copyFileSync(join(SRC, 'icons', f), join(OUT, 'icons', f));
}

/* --- verify: the checks that have actually bitten before ------------------ */
const fails = [];
const outBg = readFileSync(join(OUT, 'background.js'), 'utf8');
const outMf = readFileSync(join(OUT, 'manifest.json'), 'utf8');
const outOpts = readFileSync(join(OUT, 'options.js'), 'utf8');

if (!outBg.includes(`'${BACKEND}'`)) fails.push('backend URL not baked into background.js');
if (/YOUR-SUBDOMAIN/.test(outBg.replace(/\/YOUR-SUBDOMAIN\/\.test/g, '')))
  fails.push('placeholder host left in background.js outside the guard regex');
if (!outMf.includes(HOST)) fails.push('exact host not pinned in manifest');
if (/workers\.dev\/\*"/.test(outMf) && !outMf.includes(HOST))
  fails.push('wildcard workers.dev host still present');
if (JSON.parse(outMf).version !== VERSION) fails.push('manifest version wrong');

// BOTH prompts live in two places (extension + worker) and MUST be byte-identical,
// or hosted and own-key users get different products. 0.9.23 adds EXPAND_SYSTEM
// (the fifth chip) to the same contract.
const wrkForPrompts = readFileSync('worker/src/index.js', 'utf8');
const grab = (s, name) => {
  const m = s.match(new RegExp(name + ' = `([\\s\\S]*?)`;'));
  return m && m[1];
};
for (const name of ['NEXT_STEPS_SYSTEM', 'EXPAND_SYSTEM']) {
  const pExt = grab(outBg, name);
  const pWrk = grab(wrkForPrompts, name);
  if (!pExt || !pWrk) fails.push(`could not locate ${name} in one of the two copies`);
  else if (pExt !== pWrk) fails.push(`PROMPT DRIFT: ${name} differs between extension and worker`);
}
// The expand request's section labels are code, not prompt — pin them the same way.
const sectionRe = /'ROUGH ASK:\\n' \+ intent/;
if (!sectionRe.test(outBg) || !sectionRe.test(wrkForPrompts))
  fails.push('expand section labels missing or drifted between extension and worker');

// The shipped model must agree across all three places that name one.
const workerSrc = readFileSync('worker/src/index.js', 'utf8');
const modelExt = (outBg.match(/const SHIPPED_MODEL = '([^']+)'/) || [])[1];
const modelWrk = (workerSrc.match(/const MODEL = '([^']+)'/) || [])[1];
const modelToml = (readFileSync('worker/wrangler.toml', 'utf8').match(/MODEL = "([^"]+)"/) || [])[1];
if (!modelExt) fails.push('SHIPPED_MODEL not found in background.js');
else if (new Set([modelExt, modelWrk, modelToml]).size !== 1)
  fails.push(`model mismatch: extension=${modelExt} worker=${modelWrk} wrangler.toml=${modelToml}`);

/* A superseded default must never also be the current one, or the migration would
   clear the very value it is meant to install. */
const superseded = (outBg.match(/const SUPERSEDED_MODEL_DEFAULTS = \[([^\]]*)\]/) || [])[1] || '';
if (superseded.includes(`'${modelExt}'`))
  fails.push(`${modelExt} is listed in SUPERSEDED_MODEL_DEFAULTS while also being the shipped default`);

/* Storing a concrete model as the default is the bug that froze installs on Haiku.
   Guard both files against it coming back. */
if (/model: '[^']+'/.test(outOpts.match(/const DEFAULTS = \{[\s\S]*?\};/)?.[0] || ''))
  fails.push("options.js DEFAULTS seeds a concrete model Ã¢â‚¬â€ must be '' so shipped defaults can change");
if (/model: '[^']+'/.test(outBg.match(/const DEFAULTS = \{[\s\S]*?\};/)?.[0] || ''))
  fails.push("background.js DEFAULTS seeds a concrete model Ã¢â‚¬â€ must be '' so shipped defaults can change");
if (/\.value\.trim\(\)\s*\|\|\s*DEFAULTS\.model/.test(outOpts))
  fails.push('options.js backfills an empty model field with the default Ã¢â‚¬â€ that is the freeze bug');

if (fails.length) {
  console.error('BUILD FAILED');
  for (const f of fails) console.error('  Ã¢Å“â€” ' + f);
  process.exit(1);
}

console.log(`built ${OUT}/ Ã¢â‚¬â€ v${VERSION}, model ${modelExt}, backend ${BACKEND}`);
console.log('  prompt identical across extension and worker Ã¢Å“â€œ');

/* --- zip, with manifest.json at the ARCHIVE ROOT --------------------------- */
/* Chrome rejects an upload whose manifest sits inside a wrapper folder, which is
   exactly what you get from right-click-zipping the directory. Building the archive
   here makes it correct every time and keeps dev files like test.mjs out.

   Written by hand rather than shelling out to `zip`: this repo's only development
   machine is Windows, which ships neither `zip` nor `unzip`. A build step that
   works on my machine and not yours is worse than no build step. Pure Node, no
   dependencies, and a fixed timestamp so identical input yields an identical
   archive. */

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();
function crc32(buf) {
  // zlib.crc32 exists on Node 22 but not on 18; fall back rather than crash.
  if (typeof zlibCrc32 === 'function') return zlibCrc32(buf) >>> 0;
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// Fixed DOS timestamp (2026-01-01 00:00:00) keeps the archive byte-reproducible.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function zipEntries(entries) {
  const locals = [], central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = deflateRawSync(data, { level: 9 });
    // Only use deflate if it actually helps; tiny PNGs can grow.
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const sum = crc32(data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(method, 8); lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12);
    lh.writeUInt32LE(sum, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8); cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(DOS_TIME, 12); cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(sum, 16); cd.writeUInt32LE(body.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += lh.length + nameBuf.length + body.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cdBuf, eocd]);
}

const zipName = `contexa-v${VERSION}.zip`;
const shipFiles = ['manifest.json', 'background.js', 'content.js', 'options.html', 'options.js', 'README.md'];
const iconFiles = readdirSync(join(OUT, 'icons')).sort().map(f => 'icons/' + f);
const entries = [...shipFiles, ...iconFiles].map(name => ({
  name, data: readFileSync(join(OUT, ...name.split('/')))
}));

if (existsSync(zipName)) rmSync(zipName);
writeFileSync(zipName, zipEntries(entries));

/* Verify by reading the archive back, not by trusting the writer. A hand-rolled
   zip that Chrome silently rejects would be a worse failure than no zip at all. */
const zipBuf = readFileSync(zipName);
const readBack = [];
{
  const eocdAt = zipBuf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdAt < 0) { console.error('ZIP INVALID: no end-of-central-directory record'); process.exit(1); }
  const count = zipBuf.readUInt16LE(eocdAt + 10);
  let p = zipBuf.readUInt32LE(eocdAt + 16);
  for (let i = 0; i < count; i++) {
    if (zipBuf.readUInt32LE(p) !== 0x02014b50) { console.error('ZIP INVALID: bad central header'); process.exit(1); }
    const nameLen = zipBuf.readUInt16LE(p + 28);
    readBack.push(zipBuf.subarray(p + 46, p + 46 + nameLen).toString('utf8'));
    p += 46 + nameLen + zipBuf.readUInt16LE(p + 30) + zipBuf.readUInt16LE(p + 32);
  }
}
const missing = [...shipFiles, 'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png']
  .filter(f => !readBack.includes(f));
const stray = readBack.filter(f => /test\.mjs|\.map$|^__MACOSX|\.DS_Store|^[^/]*\/$/.test(f));
if (missing.length) { console.error('ZIP INCOMPLETE Ã¢â‚¬â€ missing: ' + missing.join(', ')); process.exit(1); }
if (stray.length) { console.error('ZIP HAS STRAY ENTRIES: ' + stray.join(', ')); process.exit(1); }
if (readBack[0] !== 'manifest.json') { console.error('manifest.json is not the first root entry'); process.exit(1); }
console.log(`  ${zipName} Ã¢â‚¬â€ ${readBack.length} entries, manifest at root Ã¢Å“â€œ`);
