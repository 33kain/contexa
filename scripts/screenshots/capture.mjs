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
/* CX_FORK drives the 0.9.73 fork end to end: the cost line on a long thread,
   the brief card off a canned /v1/fork, and the hand-off into a NEW tab's
   composer. A verification pass like CX_ZERO — it writes to build-ready/ and
   never into the listing set. It is the only place the hand-off is exercised
   by a real browser: the source assertions can see that stageBrief is called
   and that /new collects it, but not that a second tab actually receives it. */
const FORK = process.env.CX_FORK === '1';
/* CX_NUDGE (0.9.74) renders the two brake-5 lines — a run of short turns on a
   mid-weight thread, and a short question sent on Opus — and checks that the
   long-thread cost line outranks both. Verification only, like the others. */
const NUDGE = process.env.CX_NUDGE === '1';
const OUT = ZERO
  ? join(REPO, 'build-ready', 'zero-check')
  : FORK ? join(REPO, 'build-ready', 'fork-check')
  : NUDGE ? join(REPO, 'build-ready', 'nudge-check')
  : join(REPO, 'publishing', 'screenshots');
const MOCK = join(HERE, 'mock-claude.html');

const PORT = 8443;
const API_HOST = 'contexa-api.michu110899.workers.dev';
const SHOT = { width: 1280, height: 800 };

/* The canned model output. It has to be the shape the CURRENT prompt asks for,
   and keeping that true is most of the work of retaking these.

   The first version of this block was written at 0.9.58 and shipped labels of
   two and three words — "Build the itinerary", "Add day trips", "Book the
   flights". Commit 3267e4c then changed the label rule to "up to six words,
   naming the action AND the thing it acts on", and named the old shape as the
   defect: "Add a form" is an action with its object missing. Nothing here
   noticed, because the model output is canned and a re-run reproduces whatever
   this constant says. The screenshots went on advertising a weakness the
   product had fixed.

   So: when the label rule, the move count or the card changes, THIS BLOCK is
   the thing to bring with it. A capture harness with canned output cannot
   discover that on its own.

   Three moves, not four. The product offers UP TO four and live rows commonly
   land on two or three; padding the frame to four to look generous is exactly
   the overselling the "never fake output" rule exists to stop.

   Each `evidence` is a verbatim fragment of REPLY_HTML below. Nothing checks
   that here — the worker is redirected to this JSON and the hosted path does
   not re-ground client-side — which is precisely why it is done by hand. */
const MOVES = {
  moves: [
    {
      /* Earned by turn 2, which the reply on screen never mentions. This is
         the chip that shows history mining without a caption: a visitor can
         see the itinerary the reply just wrote and a move about a birthday
         card it did not. It is also the one the composed frame clicks, because
         it carries both devices the listing describes — a <paste here> slot
         and an "Assume:" line. */
      label: 'Write the birthday card revealing Lisbon',
      text:
        'Write the birthday card that gives my dad the Lisbon trip.\n' +
        '- four days at the end of May, just the two of us\n' +
        "- hint at what's planned without giving the days away\n" +
        '- short and warm, nothing about his age\n' +
        '- work in one memory of ours: <paste here>\n' +
        "Assume: he still doesn't know.",
      evidence: "I'm giving him the plan as a birthday present on the 12th",
    },
    {
      /* Earned by turn 1. The reply forgot the heat limit; the move remembers
         it. That is the pitch in one label. */
      label: 'Move the walking into the mornings',
      text:
        'Reorder each day of the Lisbon plan so the walking happens before noon.\n' +
        '- climbs and long walks in the morning\n' +
        '- something indoors or shaded after lunch\n' +
        '- keep the four days and the slow day as they are; only move things within each day\n' +
        "He can't do heat, so this matters more than the order of the sights.",
      evidence: "can't do heat",
    },
    {
      /* Earned by the reply — by what now EXISTS (a plan with open evenings),
         not by an offer the reply made. The reply must never end on a
         question or an "I can also…", or the row becomes a transcript of it. */
      label: 'Pick one dinner for each night',
      text:
        'Pick one dinner for each of the four nights in Lisbon, near wherever ' +
        'that day ends. One place per night, a line on why it fits, and how ' +
        "far ahead it needs booking. Nothing formal — he'd hate that.",
      evidence: "Evenings I've left open",
    },
  ],
  grounding: { total: 3, kept: 3, grounded: 3, fromTurns: 2, fromReply: 1,
    droppedByAction: 0, emptiedBy: null },
  quota: { used: 3, limit: 20 },
};

/* The reply under the camera. Two rules it has to obey, both learned from the
   previous set (2026-08-31 → 2026-09-01), which ended "Let me know your budget
   range … and I'll turn this into a proper day-by-day" and then showed a row
   whose every move quoted the reply — two of them the reply's own offer handed
   back, which MOVES_SYSTEM names as the worst thing it can produce, and one
   composed prompt that invented a budget and an arrival day the session never
   stated. So: the reply does NOT end on a question or an offer, and it does
   NOT mention the heat, so that the second chip visibly reaches back into
   turn 1 for something the reply forgot. The session it answers is in
   mock-claude.html; the evidence strings above are verbatim from there or
   from here. */
/* The canned brief the mock worker returns on /v1/fork. Four labelled blocks,
   the session's own facts, one paste slot — the shape FORK_SYSTEM asks for,
   and like MOVES above it has to be kept in step with the prompt by hand. */
const BRIEF = 'Goal: a four-day trip to Lisbon at the end of May for my dad, 72, who walks a lot but can\'t do heat.\n'
  + 'Settled:\n- Lisbon, four days, late May\n- he doesn\'t know yet; it\'s his birthday present on the 12th\n- one slow day\n'
  + 'Exists now:\n- a day-by-day plan (Alfama, Baixa and Chiado, Belém, Sintra) <paste here>\n'
  + 'Next: move the walking into the mornings, because of the heat.';

const REPLY_HTML = `
<p>Four days in Lisbon in late May works well for him — mild, walkable, and the
hills are real but they come with trams and lifts. Here's the shape:</p>
<p><strong>Day 1 — Alfama and the castle.</strong> The old quarter first, while
it's quiet, then up to S&atilde;o Jorge Castle for the view. Tram 28 back down
rather than the stairs.</p>
<p><strong>Day 2 — Baixa and Chiado.</strong> The grid streets downtown, Pra&ccedil;a
do Com&eacute;rcio by the river, the Santa Justa lift, and the bookshops and
caf&eacute;s of Chiado. Ends at the river for sunset.</p>
<p><strong>Day 3 — Bel&eacute;m, and the slow day you asked for.</strong> The tower
and the monastery in the morning, the original pastel de nata bakery for lunch,
and nothing scheduled after that.</p>
<p><strong>Day 4 — Sintra.</strong> Forty minutes by train, an early start, the
palaces, back by late afternoon so the last evening is in the city.</p>
<p>Evenings I've left open. Nothing here needs booking except Sintra, which
sells out on weekends.</p>`;

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
        : req.url.startsWith('/v1/fork')
          ? { brief: BRIEF, quota: { used: 5, limit: 20 } }
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
    /* CX_FORK pads the thread BEFORE the reply lands, so the trigger card is
       born on a long page and the cost line is measured at the moment the
       product measures it — on render, not on a later re-read. */
    if (FORK) {
      const chars = await page.evaluate(() => window.__mock.padLong(30, 1700));
      console.log('  long thread: page holds', chars, 'chars ≈', Math.round(chars / 4), 'tokens');
    }
    if (NUDGE) {
      const chars = await page.evaluate(() => { window.__mock.padLong(12, 1700); window.__mock.appendShort(['Ok.', 'And the tram?', 'Do that.']); return document.body.textContent.length; });
      console.log('  mid thread with three short turns: page holds', chars, 'chars ≈', Math.round(chars / 4), 'tokens');
    }
    await page.evaluate(html => window.__mock.streamReply(html), REPLY_HTML);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__mock.finishStream());

    // ---- 3-trigger: the mascot as it arrives, before anything is asked ------
    await page.waitForSelector(MASCOT, { timeout: 15000 });
    await page.evaluate(() => window.__mock.bottom());
    await page.waitForTimeout(900);              // let the entrance settle
    await shoot(page, '3-trigger.png', 'the trigger, before any click', { card: true });

    /* ---- CX_TURNS: does captureTurns() actually see a long conversation?
       The question the field test could not answer and no assertion could
       reach. fitTurns is unit-tested on synthetic arrays; the DOM walk that
       feeds it had no coverage at all, and this mock carried two user turns (three
       since 2026-09-01), so a twenty-turn session had never been read by the real code in a real
       browser.

       This does not screenshot anything. It pads the thread to twenty turns,
       runs the SHIPPED captureTurns() against it, and checks the count and the
       i range. A complete DOM must yield 1..20 — if it does not, the bug is in
       capture and nothing about the prompt matters. */
    if (TURNS_CHECK) {
      const total = await page.evaluate(() => window.__mock.padTurns(17));
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

    /* ---- CX_NUDGE: the two brake-5 lines, and their precedence. */
    if (NUDGE) {
      const readLine = async (p) => p.evaluate(() => {
        const host = document.querySelector('[data-contexa]');
        const el = host && host.shadowRoot.querySelector('.ctxa-cost');
        return el ? { text: el.textContent.trim(), button: !!el.querySelector('button') } : null;
      });
      const nudges = [];
      page.on('console', m => { if (m.text().includes('[CONTEXA] nudge')) nudges.push(m.text()); });
      let line = await readLine(page);
      console.log('  fragments:', JSON.stringify(line));
      if (!line || !/Three short messages in a row, each re-reading the thread \(≈ \d+k tokens\)/.test(line.text)) throw new Error('fragments nudge did not render');
      if (line.button) throw new Error('a nudge must carry no button');
      await shoot(page, 'nudge-1-fragments.png', 'three short turns on a mid-weight thread', { card: true });

      /* The model note: a fresh page, Opus in the selector, the mock's own last
         turn (82 chars, no code) as the short question. */
      const again = async (prep) => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);
        await page.evaluate(prep);
        await page.evaluate(html => window.__mock.streamReply(html), REPLY_HTML);
        await page.waitForTimeout(400);
        await page.evaluate(() => window.__mock.finishStream());
        await page.waitForSelector(MASCOT, { timeout: 15000 });
        await page.evaluate(() => window.__mock.bottom());
        await page.waitForTimeout(700);
      };
      await again(() => window.__mock.setModel('Opus 4.1'));
      line = await readLine(page);
      console.log('  model:', JSON.stringify(line));
      if (!line || !/Sent on Opus, about 2\.5× Sonnet/.test(line.text)) throw new Error('model nudge did not render on Opus');
      await shoot(page, 'nudge-2-model.png', 'a short question, sent on Opus', { card: true });

      /* 0.9.78 — the probe and the diagnostic card. The page makes one call to
         its own /api/ path (the mock answers it with the page; the path is
         what matters), three clicks land on the wordmark, and the card must
         name the version and list that path. This is the only place the
         main-world -> isolated-world hand-off is exercised in a browser. */
      await page.evaluate(() => fetch('/api/organizations/probe-check/whatever').catch(() => {}));
      await page.waitForTimeout(300);
      const LABEL = '[data-contexa] .label';
      for (let i = 0; i < 3; i++) { await page.click(LABEL); await page.waitForTimeout(80); }
      await page.waitForSelector('[data-contexa] .quiet.diag', { timeout: 5000 });
      const diag = await page.evaluate(() => document.querySelector('[data-contexa]').shadowRoot.querySelector('.quiet.diag').textContent);
      console.log('  diag card:\n    ' + diag.split('\n').join('\n    '));
      if (!/^CONTEXA v\d+\.\d+\.\d+/.test(diag)) throw new Error('diag card does not open with the version');
      if (!/\/api\/organizations\/probe-check\/whatever/.test(diag)) throw new Error('the probe did not report the page\'s API path');
      if (!/page API: no conversation id in \//.test(diag)) throw new Error('the diag did not name the API state');
      await shoot(page, 'nudge-3-diag.png', 'the three-tap diagnostic card');

      await again(() => window.__mock.setModel('Sonnet 4.5'));
      line = await readLine(page);
      if (line) throw new Error('a line rendered on Sonnet with a plain short thread: ' + line.text);
      console.log('  sonnet, short thread: no line (correct)');

      await again(() => { window.__mock.setModel('Opus 4.1'); window.__mock.padLong(30, 1700); });
      line = await readLine(page);
      console.log('  opus + long thread:', JSON.stringify(line));
      if (!line || !/re-read per send/.test(line.text) || !line.button) throw new Error('the cost line did not outrank the model note');
      if (nudges.some(n => /model opus/.test(n) && nudges.indexOf(n) > 0) && nudges.filter(n => /model opus/.test(n)).length !== 1) throw new Error('model nudge logged more than once: ' + nudges.join(' | '));
      console.log(`\nnudges verified, shots written to ${OUT}`);
      return;
    }

    /* ---- CX_FORK: the cost line, the brief, and the hand-off into a new tab. */
    if (FORK) {
      const COST = '[data-contexa] .ctxa-cost';
      await page.waitForSelector(COST, { timeout: 15000 });
      const cost = await page.evaluate(() => {
        const host = document.querySelector('[data-contexa]');
        const el = host && host.shadowRoot.querySelector('.ctxa-cost');
        const btn = el && el.querySelector('button');
        return el ? { text: el.textContent.trim(), button: btn ? btn.textContent.trim() : null } : null;
      });
      console.log('  cost line:', JSON.stringify(cost));
      if (!cost || !/≈ \d+k tokens re-read per send/.test(cost.text)) throw new Error('cost line did not render with a token estimate');
      if (cost.button !== 'Start fresh') throw new Error('fork control missing from the cost line');
      await shoot(page, 'fork-1-cost.png', 'a long thread: the cost line and the fork control', { card: true });

      const logs = [];
      page.on('console', m => { if (m.text().includes('[CONTEXA] fork')) logs.push(m.text()); });
      await page.click(`${COST} button`);
      await page.waitForSelector(`${CARD} .brief .chip.move`, { timeout: 15000 });
      const card = await page.evaluate(() => {
        const host = document.querySelector('[data-contexa]');
        const chip = host.shadowRoot.querySelector('.brief .chip.move');
        const said = host.shadowRoot.querySelector('.brief span');
        return { said: said.textContent.trim(), chip: chip.textContent.trim(), title: chip.title };
      });
      console.log('  brief card:', JSON.stringify({ said: card.said, chip: card.chip, titleChars: card.title.length }));
      if (card.title !== BRIEF) throw new Error('the chip\'s title is not the brief the worker returned');
      if (!/Brief ready: ≈ \d+ tokens instead of ≈ \d+k per send\./.test(card.said)) throw new Error('brief sentence is off: ' + card.said);
      const measured = logs.find(l => /thread ≈ \d+ tokens, brief ≈ \d+ tokens/.test(l));
      if (!measured) throw new Error('no before/after measurement was logged');
      console.log(' ', measured.replace(/^\S+\s/, ''));
      await page.evaluate(() => window.__mock.bottom());
      await page.waitForTimeout(400);
      await shoot(page, 'fork-2-brief.png', 'the brief, ready — its text is the chip\'s title', { card: true });

      /* The hand-off. The click opens https://claude.ai/new in a NEW tab; the
         mock serves the same page there, content.js loads at /new, asks the
         service worker for the parked brief, and lands it in that composer.
         What is asserted is the composer's text in the SECOND page — the one
         thing no source regex can reach. */
      const [fresh] = await Promise.all([
        ctx.waitForEvent('page', { timeout: 15000 }),
        page.click(`${CARD} .brief .chip.move`)
      ]);
      await fresh.waitForLoadState('domcontentloaded');
      console.log('  new tab:', fresh.url());
      if (!/^https:\/\/claude\.ai\/new/.test(fresh.url())) throw new Error('the fork opened ' + fresh.url() + ', not /new');
      await fresh.waitForFunction(
        () => (document.querySelector('#composer')?.innerText || '').includes('Goal:'),
        null, { timeout: 15000 },
      );
      const landed = await fresh.evaluate(() => document.querySelector('#composer').innerText.trim());
      if (landed.replace(/\s+/g, ' ') !== BRIEF.replace(/\s+/g, ' ')) throw new Error('the composer holds something other than the brief: ' + landed.slice(0, 120));
      await fresh.waitForTimeout(400);
      await shoot(fresh, 'fork-3-landed.png', 'the new chat, with the brief in its message box');
      /* And only once: a reload of /new must find nothing waiting. */
      await fresh.reload({ waitUntil: 'domcontentloaded' });
      await fresh.waitForTimeout(1500);
      const again = await fresh.evaluate(() => (document.querySelector('#composer')?.innerText || '').trim());
      if (again) throw new Error('the brief landed twice — takeBrief did not consume it');
      console.log(`\nfork verified end to end, shots written to ${OUT}`);
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

    /* The frames are numbered in LISTING order, not capture order: the composed
       frame is shot second but ships first. The row alone reads as smart-reply
       stubs, which is the category the product is not in; a full prompt in the
       box under a highlighted chip is the proof of "without the writing", so
       that is what a visitor sees first. */
    // ---- 2-moves: click it, the mined row arrives --------------------------
    await page.click(MASCOT);
    await page.waitForSelector(`${CARD} .chip.move`, { timeout: 15000 });
    await page.evaluate(() => window.__mock.bottom());
    await page.waitForTimeout(600);
    await shoot(page, '2-moves.png', 'the mined row of next moves', { card: true });

    // ---- 1-composed: one click, the whole prompt lands in the box -----------
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
    await shoot(page, '1-composed.png', 'the prompt, landed in the message box', { card: true });

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
