/* CONTEXA — Chrome Web Store screenshot harness.
 *
 *   node scripts/screenshots/capture.mjs
 *
 * Writes the five 1280x800 PNGs in publishing/screenshots/, and fails loudly
 * rather than writing a wrong one.
 *
 * WHY THIS FILE IS COMMITTED. The first attempt at these screenshots (PR #13)
 * committed only the PNGs — so when the card turned out to be mispositioned in
 * two of the five, there was nothing to inspect, diff, or re-run. The images
 * are an output; this is the thing that produces them, and it is the part worth
 * keeping.
 *
 * WHAT MAKES THESE REAL. The extension is loaded UNMODIFIED, from extension/,
 * into a real Chromium. Nothing is stubbed inside it. Two hostnames are
 * redirected at the network layer to a local HTTPS server:
 *
 *   claude.ai                            -> mock-claude.html (the DOM contract)
 *   contexa-api.michu110899.workers.dev  -> canned suggestion + prompt JSON
 *
 * That redirect is the whole trick, and it is why nothing in the extension has
 * to be touched: content.js still only runs because the page really is
 * https://claude.ai/, and background.js still fetches its real baked
 * DEFAULT_PROXY_URL. The code path under the camera is the shipped one.
 *
 * What is NOT real, stated plainly so nobody over-claims these: the page is a
 * mock of claude.ai's DOM contract, not claude.ai, and the model output is
 * canned rather than generated. The checklist's instruction to retake against a
 * live session before submitting therefore still stands, and is left in place.
 *
 * Requires a headed browser (extensions do not load in headless Chromium), so
 * it runs under Xvfb. Playwright and Chromium come from the image; see
 * scripts/screenshots/README.md.
 */

import { createServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* Playwright is a developer dependency of this script alone — the repo itself
   has no node_modules and nothing shipped needs it. Accept it wherever it is:
   installed locally, or global (which ESM will not find via NODE_PATH, hence
   the explicit second attempt). */
const chromium = await (async () => {
  const tries = ['playwright', 'playwright-core'];
  for (const root of [null, process.env.NODE_PATH, '/opt/node22/lib/node_modules', '/usr/lib/node_modules']) {
    for (const name of tries) {
      const spec = root ? pathToFileURL(join(root, name, 'index.js')).href : name;
      try {
        // playwright ships CJS, so the browser types may sit on `default`.
        const m = await import(spec);
        const c = m.chromium || (m.default && m.default.chromium);
        if (c) return c;
      } catch { /* keep looking */ }
    }
  }
  throw new Error('playwright not found — npm i -g playwright, or npm i playwright');
})();

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const EXT = join(REPO, 'extension');
const OUT = join(REPO, 'publishing', 'screenshots');
const MOCK = join(HERE, 'mock-claude.html');

const PORT = 8443;
const API_HOST = 'contexa-api.michu110899.workers.dev';
const SHOT = { width: 1280, height: 800 };

/* The canned model output. Deliberately the shape the prompt actually asks for:
   two questions, each with concrete options rather than categories, in the
   user's own inner voice. A screenshot that showed four vague questions would
   be advertising a product the prompt spends most of its length forbidding. */
const QUESTIONS = {
  questions: [
    {
      label: 'Budget',
      text: "What's my budget range?",
      options: ['Budget (hostels, street food)', 'Mid-range', 'Splurge a bit'],
      evidence: 'Let me know your budget range',
    },
    {
      label: 'Pace',
      text: 'How packed do I want the days?',
      options: ['Packed — see everything', 'Slower, with real downtime', 'Somewhere in between'],
      evidence: 'a packed itinerary or a slower pace with more downtime',
    },
  ],
  assume: [],
  quota: { used: 3, limit: 20 },
};

const COMPOSED = {
  prompt:
    'Turn the Lisbon plan into a full day-by-day itinerary.\n' +
    '- Mid-range budget, a mix of casual spots and one nicer dinner\n' +
    '- Slower pace, real downtime between things, nothing back-to-back\n' +
    'Give specific restaurant picks and a rough time for each stop.',
  quota: { used: 4, limit: 20 },
};

const REPLY_HTML = `
<p>Lisbon's a great pick for a first visit — walkable, and four days is enough to
see the main neighbourhoods without rushing. Rough shape for the trip:</p>
<p><strong>Day 1 — Alfama &amp; the castle.</strong> Wander the old quarter, climb
up to S&atilde;o Jorge Castle for the view, and catch a fado show in the evening
if you're up for it.</p>
<p><strong>Day 2 — Baixa &amp; Chiado.</strong> The grid streets downtown, Pra&ccedil;a
do Com&eacute;rcio by the river, and the Elevador de Santa Justa. Good area for
shopping and caf&eacute;s.</p>
<p><strong>Day 3 — Bel&eacute;m.</strong> The tower, the monastery, and the original
pastel de nata bakery — worth the queue.</p>
<p><strong>Day 4 — a day trip to Sintra</strong>, if you don't mind an early start —
the palaces there are worth it and it's 40 minutes by train.</p>
<p>Let me know your budget range and whether you want a packed itinerary or a
slower pace with more downtime, and I'll turn this into a proper day-by-day with
times and specific restaurant picks.</p>`;

/* ---------------------------------------------------------------- local TLS */

function makeCert(dir) {
  const key = join(dir, 'key.pem');
  const crt = join(dir, 'cert.pem');
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', key, '-out', crt, '-days', '2', '-subj', '/CN=claude.ai',
    '-addext', `subjectAltName=DNS:claude.ai,DNS:${API_HOST}`,
  ], { stdio: 'pipe' });
  return { key: readFileSync(key), cert: readFileSync(crt) };
}

function startServer(tls) {
  const page = readFileSync(MOCK, 'utf8');
  const server = createServer(tls, (req, res) => {
    const host = String(req.headers.host || '').split(':')[0];
    const send = (code, type, body) => {
      res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(body);
    };

    if (host === API_HOST) {
      // CORS preflight from the extension's service worker.
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'content-type,x-cx-device',
          'access-control-allow-methods': 'POST,GET,OPTIONS',
        });
        return res.end();
      }
      const body = req.url.startsWith('/v1/expand') ? COMPOSED
        : req.url.startsWith('/v1/next-steps') ? QUESTIONS
        : { ok: true, version: 'mock', model: 'mock', limit: 20, configured: true };
      res.writeHead(200, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      });
      return res.end(JSON.stringify(body));
    }

    return send(200, 'text/html; charset=utf-8', page);
  });
  return new Promise(ok => server.listen(PORT, '127.0.0.1', () => ok(server)));
}

/* -------------------------------------------------------------------- drive */

const shots = [];

/* PR #13 shipped two screenshots with the card stranded in dead space, and
   nothing caught it but a human eye on the final PNG. A screenshot harness that
   cannot tell a good frame from a libellous one is not much of a harness, so
   the geometry is asserted before the shutter, on every frame that has a card.
   These are the two things the layout can get wrong (see mock-claude.html):
   the card escaping its column, and the card detaching from the composer. */
async function assertCardGeometry(page) {
  const g = await page.evaluate(() => {
    const holder = document.querySelector('[data-contexa]');
    const composer = document.querySelector('#composer');
    if (!holder || !composer) return null;
    const c = holder.getBoundingClientRect();
    const m = composer.getBoundingClientRect();
    return { cardLeft: c.left, cardBottom: c.bottom, cardWidth: c.width,
             boxLeft: m.left, boxTop: m.top };
  });
  if (!g) throw new Error('no card or composer on the page to measure');

  // Aligned with the message box it belongs to, not flush against the viewport.
  const drift = Math.abs(g.cardLeft - g.boxLeft);
  if (drift > 40) {
    throw new Error(
      `card is ${drift.toFixed(0)}px out of line with the message box ` +
      `(card left ${g.cardLeft.toFixed(0)}, box left ${g.boxLeft.toFixed(0)}) — ` +
      'the walk-up escaped its column; check the nesting depth in mock-claude.html');
  }
  if (g.cardLeft < 60) {
    throw new Error(`card is flush against the viewport edge (left ${g.cardLeft.toFixed(0)}px)`);
  }
  // "Just above your message box" — what the settings page promises users.
  const gap = g.boxTop - g.cardBottom;
  if (gap > 90) {
    throw new Error(`card is ${gap.toFixed(0)}px adrift above the message box — not "just above" anything`);
  }
  return g;
}

async function shoot(page, name, note, { card = false } = {}) {
  if (card) await assertCardGeometry(page);
  const file = join(OUT, name);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, ...SHOT } });
  shots.push({ name, note });
  console.log(`  ${name}  ${note}`);
}

/* The card lives in an open shadow root; Playwright's CSS engine pierces it. */
const CARD = '[data-contexa] .wrap';
const MASCOT = '[data-contexa] .ctxa-mas';

async function main() {
  if (!existsSync(EXT)) throw new Error(`no extension/ at ${EXT}`);
  const dir = mkdtempSync(join(tmpdir(), 'contexa-shots-'));
  const server = await startServer(makeCert(dir));
  const profile = join(dir, 'profile');

  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,               // extensions do not load headless
    viewport: SHOT,                // exact store size, no browser chrome in the shot
    ignoreHTTPSErrors: true,
    /* The listing set is dark. This is what carries options.html (which follows
       prefers-color-scheme) into dark with the rest; the conversation shots do
       NOT rely on it, because the mock sets data-mode, which content.js treats
       as authoritative — so 4-light.png stays light regardless of this. */
    colorScheme: 'dark',
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      `--host-resolver-rules=MAP claude.ai 127.0.0.1:${PORT},MAP ${API_HOST} 127.0.0.1:${PORT}`,
      '--ignore-certificate-errors',
      /* This container routes egress through an agent proxy that (correctly)
         refuses claude.ai. The whole point here is to reach the LOCAL server
         instead, so take the proxy out of the path entirely — otherwise the
         redirect above never gets a chance to apply. */
      '--no-proxy-server',
      '--no-first-run',
      '--disable-features=Translate,MediaRouter',
      `--window-size=${SHOT.width},${SHOT.height}`,
    ],
  });

  try {
    const page = await ctx.newPage();
    // content.js narrates its own decisions; surfacing them turns a silent
    // "no card appeared" into an actual reason.
    if (process.env.CX_DEBUG) {
      page.on('console', m => console.log('    [page]', m.text()));
      page.on('pageerror', e => console.log('    [pageerror]', e.message));
    }
    await page.goto('https://claude.ai/', { waitUntil: 'domcontentloaded' });

    // Let content.js install itself before the reply lands, so the observer
    // sees the stream the way it does in life.
    await page.waitForTimeout(1200);
    await page.evaluate(html => window.__mock.streamReply(html), REPLY_HTML);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__mock.finishStream());

    // ---- 3-trigger: the row as it arrives, before anything is asked ---------
    await page.waitForSelector(MASCOT, { timeout: 15000 });
    await page.evaluate(() => window.__mock.bottom());
    await page.waitForTimeout(900);              // let the entrance settle
    await shoot(page, '3-trigger.png', 'the trigger, before any click', { card: true });

    // ---- 1-interview: click it, the questions arrive -----------------------
    await page.click(MASCOT);
    await page.waitForSelector(`${CARD} .pill`, { timeout: 15000 });
    await page.evaluate(() => window.__mock.bottom());
    await page.waitForTimeout(600);
    await shoot(page, '1-interview.png', 'the click-only interview', { card: true });

    // ---- 2-composed: answer through, the prompt lands in the box -----------
    for (let i = 0; i < QUESTIONS.questions.length; i++) {
      const pill = page.locator(`${CARD} .pills .pill`).first();
      await pill.waitFor({ timeout: 10000 });
      await pill.click();
      await page.waitForTimeout(500);
    }
    await page.waitForFunction(
      () => (document.querySelector('#composer')?.innerText || '').trim().length > 40,
      null, { timeout: 15000 },
    );
    await page.evaluate(() => window.__mock.bottom());
    await page.waitForTimeout(600);
    await shoot(page, '2-composed.png', 'the composed prompt, in the message box', { card: true });

    // ---- 4-light: the same interview, host in light mode -------------------
    await page.evaluate(() => window.__mock.setTheme('light'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.__mock.setTheme('light'));
    await page.waitForTimeout(1200);
    await page.evaluate(html => window.__mock.streamReply(html), REPLY_HTML);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__mock.finishStream());
    await page.waitForSelector(MASCOT, { timeout: 15000 });
    await page.click(MASCOT);
    await page.waitForSelector(`${CARD} .pill`, { timeout: 15000 });
    await page.evaluate(() => window.__mock.bottom());
    await page.waitForTimeout(600);
    await shoot(page, '4-light.png', 'the same interview, light mode', { card: true });

    // ---- 5-settings: the real options page ---------------------------------
    const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
    const id = new URL(sw.url()).host;
    const opts = await ctx.newPage();
    await opts.goto(`chrome-extension://${id}/options.html`, { waitUntil: 'load' });
    await opts.waitForTimeout(700);
    await shoot(opts, '5-settings.png', 'the settings page');

    console.log('\nwrote 5 screenshots to publishing/screenshots/');
  } finally {
    await ctx.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch(e => { console.error('\nCAPTURE FAILED:', e.message); process.exit(1); });
