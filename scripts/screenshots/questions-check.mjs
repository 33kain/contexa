/* CONTEXA — real-browser check of the questions card.
 *
 *   node scripts/screenshots/questions-check.mjs
 *
 * Loads extension/ unmodified into Chromium against mock-claude.html (served as
 * https://claude.ai/ through a host-resolver rule, the same trick capture.mjs
 * uses), streams a reply with a numbered list, a code block and a closing
 * question, and walks the card twice: desktop in English, and a phone viewport
 * with touch where the user writes Serbian without diacritics. It asserts the
 * doors, the step row, the composed message in the composer, the confirm line
 * and the selection quote, and writes screenshots to build-ready/questions-check/.
 * Verification only; nothing here is a listing frame.
 *
 * Needs Playwright with Chromium (npm i playwright && npx playwright install
 * chromium, anywhere on the resolution path) and openssl. Extensions need a
 * headed browser: on Linux run it under Xvfb.
 */
import { createServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const chromium = await (async () => {
  for (const root of [null, process.env.NODE_PATH]) {
    for (const name of ['playwright', 'playwright-core']) {
      const spec = root ? pathToFileURL(join(root, name, 'index.js')).href : name;
      try { const m = await import(spec); const c = m.chromium || (m.default && m.default.chromium); if (c) return c; } catch {}
    }
  }
  throw new Error('playwright not found — npm i playwright, then npx playwright install chromium');
})();

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXT = join(REPO, 'extension');
const MOCK = join(REPO, 'scripts/screenshots/mock-claude.html');
const OUT = join(REPO, 'build-ready', 'questions-check');
mkdirSync(OUT, { recursive: true });
const PORT = 8443;
const dir = mkdtempSync(join(tmpdir(), 'qc-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem'),
  '-days', '2', '-subj', '/CN=claude.ai', '-addext', 'subjectAltName=DNS:claude.ai'], { stdio: 'pipe' });
const page0 = readFileSync(MOCK, 'utf8');
const server = createServer({ key: readFileSync(join(dir, 'k.pem')), cert: readFileSync(join(dir, 'c.pem')) }, (req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(page0);
});
await new Promise(r => server.listen(PORT, r));

const REPLY = `<p>Here is how to pair the headphones:</p>
<ol><li>Open Settings and go to Bluetooth &amp; devices</li><li>Turn Bluetooth on and choose Add device from the list at the top</li><li>Hold the button on the headphones for five seconds</li></ol>
<pre><code>ms-settings:bluetooth</code></pre>
<p>Which version of Windows are you using?</p>`;

let failures = 0;
const ok = (name, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) failures++; };

async function run(label, { mobile, serbian }) {
  const profile = join(dir, 'p-' + label);
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: mobile ? { width: 390, height: 800 } : { width: 1280, height: 800 },
    hasTouch: !!mobile, isMobile: !!mobile, deviceScaleFactor: mobile ? 2 : 1,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`,
      `--host-resolver-rules=MAP claude.ai 127.0.0.1:${PORT}`, '--ignore-certificate-errors'],
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (/CONTEXA/.test(m.text())) logs.push(m.text()); });
  page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
  await page.goto('https://claude.ai/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  if (serbian) await page.evaluate(() => window.__mock.appendShort(['nesto ne radi sa slusalicama', 'sta da uradim da ih povezem', 'moze, probacu to sada']));
  await page.evaluate(h => window.__mock.streamReply(h), REPLY);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__mock.finishStream());
  const mascot = page.locator('.ctxa-mas');
  await mascot.waitFor({ timeout: 15000 });
  await page.evaluate(() => window.__mock.bottom());
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, label + '-1-trigger.png') });
  const aria = await mascot.getAttribute('aria-label');
  ok(label + ': mascot named in the user\'s language', serbian ? aria === 'Sta sad?' : aria === 'What now?', aria);

  if (mobile) await mascot.tap(); else await mascot.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, label + '-2-doors.png') });
  const doors = await page.locator('.qc-opt').allTextContents();
  ok(label + ': five doors, the fifth because the reply ends with a question', doors.length === 5, JSON.stringify(doors));
  const title = await page.locator('.qc-q').textContent();
  ok(label + ': title', serbian ? title === 'Sta mi sad treba?' : title === 'What do I need now?', title);

  const tapText = async t => { const l = page.locator('.qc-opt', { hasText: t }).first(); if (mobile) await l.tap(); else await l.click(); await page.waitForTimeout(250); };
  await tapText(serbian ? 'Ne radi mi' : 'It didn’t work');
  const nums = await page.locator('.qc-num').allTextContents();
  ok(label + ': step row offers All + 3 steps', nums.length === 4, JSON.stringify(nums));
  const n2 = page.locator('.qc-num', { hasText: '2' });
  if (mobile) await n2.tap(); else await n2.click();
  await page.waitForTimeout(200);
  const cap = await page.locator('.qc-cap').textContent();
  ok(label + ': picked step shows Claude\'s first words', /^2 — Turn Bluetooth on/.test(cap), cap);
  await page.screenshot({ path: join(OUT, label + '-3-step.png') });
  await tapText(serbian ? 'Ne mogu da nadjem' : 'I can’t find it');
  const text = await page.evaluate(() => document.getElementById('composer').innerText);
  console.log('    composer:\n      ' + text.split('\n').join('\n      '));
  ok(label + ': message landed with the step quoted', serbian
    ? /^Korak 2 iz tvog odgovora \(„Turn Bluetooth on/.test(text) && /nadjem/.test(text)
    : /^Step 2 of your answer \(“Turn Bluetooth on/.test(text));
  const done = await page.locator('.qc-done').textContent().catch(() => '');
  ok(label + ': confirm line names the slot', /<…>/.test(done), done);
  await page.screenshot({ path: join(OUT, label + '-4-done.png') });

  // Selection: a short word asks what it means.
  await page.evaluate(() => { document.getElementById('composer').innerHTML = ''; });
  await page.evaluate(() => {
    const p = document.querySelector('#reply li');
    const node = p.firstChild; const r = document.createRange();
    const s = node.textContent.indexOf('Bluetooth'); r.setStart(node, s); r.setEnd(node, s + 'Bluetooth'.length);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  });
  await page.waitForTimeout(150);
  const m2 = page.locator('.ctxa-mas');
  if (mobile) await m2.tap(); else await m2.click();
  await page.waitForTimeout(250);
  const quote = await page.locator('.qc-quote span').textContent().catch(() => '');
  ok(label + ': the selection shows as a quote chip', /Bluetooth/.test(quote), quote);
  await tapText(serbian ? 'Ne razumem' : 'I don’t get it');
  const wordLabel = await page.locator('.qc-opt').allTextContents();
  ok(label + ': short selection becomes "what does X mean"', wordLabel.some(l => /Bluetooth/.test(l)), JSON.stringify(wordLabel));
  await page.screenshot({ path: join(OUT, label + '-5-word.png') });
  await tapText('Bluetooth');
  const t2 = await page.evaluate(() => document.getElementById('composer').innerText);
  ok(label + ': word message landed', serbian ? /^Sta znaci „Bluetooth“/.test(t2) : /^What does “Bluetooth” mean/.test(t2), t2);
  ok(label + ': no page errors', !logs.some(l => /PAGEERROR/.test(l)), logs.filter(l => /PAGEERROR/.test(l)).join(' | '));
  console.log('    logs: ' + logs.filter(l => /questions|card mounted/.test(l)).join('\n          '));
  await ctx.close();
}

try {
  await run('desktop-en', { mobile: false, serbian: false });
  await run('phone-sr', { mobile: true, serbian: true });
} finally { server.close(); }
console.log(failures ? `\n${failures} FAILED` : '\nall browser checks passed');
process.exit(failures ? 1 : 0);
