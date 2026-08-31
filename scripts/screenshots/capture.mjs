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
import { readFileSync, mkdtempSync, existsSync, rmSync, mkdirSync } from 'node:fs';
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
/* CX_ZERO drives the empty result instead of the listing set. It is a
   VERIFICATION pass, not an asset: a rendered element is the one thing source
   assertions cannot check, and the zero notice is exactly the kind of thing
   that can be perfectly correct in the source and invisible on screen. It
   writes somewhere else on purpose — the listing set stays five, and a
   verification shot must never be able to leak into a store submission. */
const ZERO = process.env.CX_ZERO === '1';
const TURNS_CHECK = process.env.CX_TURNS === '1';
const OUT = ZERO
  ? join(REPO, 'build-ready', 'zero-check')
  : join(REPO, 'publishing', 'screenshots');
const MOCK = join(HERE, 'mock-claude.html');

const PORT = 8443;
const API_HOST = 'contexa-api.michu110899.workers.dev';
const SHOT = { width: 1280, height: 800 };

/* The canned model output. Deliberately the shape the prompt actually asks for:
   two questions, each with concrete options rather than categories, in the
   user's own inner voice. A screenshot that showed four vague questions would
   be advertising a product the prompt spends most of its length forbidding. */
const MOVES = {
  moves: [
    {
      label: 'Build the itinerary',
      text:
        'Turn the Lisbon plan into a full day-by-day itinerary.\n' +
        '- mid-range budget, a mix of casual spots and one nicer dinner\n' +
        '- four days, arriving Thursday evening\n' +
        'Keep the neighbourhoods you already suggested; just sequence them.',
      evidence: 'a packed itinerary or a slower pace',
    },
    {
      label: 'Add day trips',
      text:
        'Add two day trips to the Lisbon plan — one coastal, one inland.\n' +
        'For each: how to get there without a car, how long it really takes, ' +
        'and what to skip.',
      evidence: 'Let me know your budget range',
    },
    {
      label: 'Book the flights',
      text:
        'Write the search I should run for flights to Lisbon. <paste here> is ' +
        'my rough date range. Tell me which days are cheapest to fly and how ' +
        'far ahead to book.',
      evidence: 'Lisbon',
    },
  ],
  grounding: { total: 3, kept: 3, grounded: 3 },
  quota: { used: 3, limit: 20 },
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
      const body = req.url.startsWith('/v1/next-steps')
          ? (ZERO ? { moves: [], grounding: { total: 0, kept: 0, grounded: 0 }, quota: { used: 4, limit: 20 } } : MOVES)
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
  mkdirSync(OUT, { recursive: true });
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
    /* CX_CHROME lets a machine point this at a Chromium it already has. Left
       unset, Playwright resolves its own download as before — this is an
       override, never a hard-coded path, because a path baked in here would be
       right on exactly one machine. Needed wherever the installed Playwright
       and the available browser build do not match, which is the usual state
       of a CI image. */
    ...(process.env.CX_CHROME ? { executablePath: process.env.CX_CHROME } : {}),
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

    /* ---- CX_TURNS: does captureTurns() actually see a long conversation?
       The question the field test could not answer and no assertion could
       reach. fitTurns is unit-tested on synthetic arrays; the DOM walk that
       feeds it had no coverage at all, and this mock carried two user turns, so
       a twenty-turn session had never been read by the real code in a real
       browser.

       This does not screenshot anything. It pads the thread to twenty turns,
       runs the SHIPPED captureTurns() against it, and checks the count and the
       i range. A complete DOM must yield 1..20 — if it does not, the bug is in
       capture and nothing about the prompt matters. */
    if (TURNS_CHECK) {
      const total = await page.evaluate(() => window.__mock.padTurns(18));
      await page.waitForTimeout(200);
      const got = await page.evaluate(() => {
        /* Reach the shipped function through the page's own copy of content.js
           rather than reimplementing the walk here — a reimplementation would
           test this file instead of the product. content.js runs in an isolated
           world, so it is re-derived from the same selector and clamp the
           extension uses, and cross-checked against the raw node count. */
        const nodes = [...document.querySelectorAll('[data-testid="user-message"]')];
        return { nodes: nodes.length, first: (nodes[0] || {}).textContent };
      });
      console.log('  DOM holds', total, 'user turns;', got.nodes, 'match the selector');
      if (got.nodes !== 20) throw new Error(`expected 20 user turns in the DOM, got ${got.nodes}`);

      /* Now the product's own read, observed through what it SENDS. The
         extension logs the range at call time, so the console line is the
         measurement — the same line the field test will read. */
      const seen = [];
      page.on('console', m => { if (m.text().includes('[CONTEXA] session')) seen.push(m.text()); });
      await page.click(MASCOT);
      await page.waitForTimeout(2500);
      if (!seen.length) throw new Error('no [CONTEXA] session line — the diagnostic did not fire');
      console.log(' ', seen[0].replace(/^\S+\s/, ''));
      const m = seen[0].match(/i=(\d+)\.\.(\d+)/);
      if (!m) throw new Error(`session line carried no i range: ${seen[0]}`);
      if (m[1] !== '1' || m[2] !== '20') {
        throw new Error(`captureTurns read i=${m[1]}..${m[2]} from a complete 20-turn DOM`);
      }
      console.log('\ncapture verified: a complete DOM yields all 20 turns, i=1..20');
      return;
    }

    /* ---- CX_ZERO: the empty result, which is the only state a source
       assertion cannot see. Click, get nothing back, and photograph what the
       user is actually left looking at. Returns early: the listing shots are
       not taken on this pass and must not be. */
    if (ZERO) {
      await page.click(MASCOT);
      await page.waitForSelector(`${CARD} .quiet.nothing`, { timeout: 15000 });
      await page.evaluate(() => window.__mock.bottom());
      await page.waitForTimeout(400);
      await shoot(page, 'zero.png', 'nothing mined — what the user is left with');
      /* Inert, checked in the live DOM rather than in the source. computed
         pointer-events is the property that decides whether a click can land,
         and it is the one thing a regex over content.js genuinely cannot know. */
      const inert = await page.evaluate(() => {
        const host = document.querySelector('[data-contexa]');
        const el = host && host.shadowRoot.querySelector('.quiet.nothing');
        if (!el) return null;
        return {
          text: el.textContent.trim(),
          pointerEvents: getComputedStyle(el).pointerEvents,
          buttons: el.querySelectorAll('button, a, [role="button"]').length
        };
      });
      console.log('  zero-state:', JSON.stringify(inert));
      if (!inert) throw new Error('zero notice did not render');
      if (inert.pointerEvents !== 'none') throw new Error(`zero notice is clickable: ${inert.pointerEvents}`);
      if (inert.buttons !== 0) throw new Error(`zero notice has ${inert.buttons} clickable child(ren)`);
      console.log(`\nzero-state verified, shot written to ${OUT}`);
      return;
    }

    // ---- 1-moves: click it, the mined row arrives --------------------------
    await page.click(MASCOT);
    await page.waitForSelector(`${CARD} .chip.move`, { timeout: 15000 });
    await page.evaluate(() => window.__mock.bottom());
    await page.waitForTimeout(600);
    await shoot(page, '1-moves.png', 'the mined row of next moves', { card: true });

    // ---- 2-composed: one click, the whole prompt lands in the box -----------
    /* One click, not a walk through four. That is the shot: the old sequence
       clicked a pill per question because the prompt was assembled from the
       answers, and this one exists to show that it no longer is. */
    await page.locator(`${CARD} .chip.move`).first().click();
    await page.waitForFunction(
      () => (document.querySelector('#composer')?.innerText || '').trim().length > 40,
      null, { timeout: 15000 },
    );
    await page.evaluate(() => window.__mock.bottom());
    await page.waitForTimeout(600);
    await shoot(page, '2-composed.png', 'the prompt, landed in the message box', { card: true });

    // ---- 4-light: the same row, host in light mode -------------------------
    await page.evaluate(() => window.__mock.setTheme('light'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.__mock.setTheme('light'));
    await page.waitForTimeout(1200);
    await page.evaluate(html => window.__mock.streamReply(html), REPLY_HTML);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__mock.finishStream());
    await page.waitForSelector(MASCOT, { timeout: 15000 });
    await page.click(MASCOT);
    await page.waitForSelector(`${CARD} .chip.move`, { timeout: 15000 });
    await page.evaluate(() => window.__mock.bottom());
    await page.waitForTimeout(600);
    await shoot(page, '4-light.png', 'the same row, light mode', { card: true });

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
