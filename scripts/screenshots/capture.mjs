/* CONTEXA — Chrome Web Store screenshot harness.
 *
 *   node scripts/screenshots/capture.mjs
 *
 * Writes the seven 1280x800 PNGs in publishing/screenshots/, and fails loudly
 * rather than writing a wrong one.
 *
 * TWO OF THE SEVEN WERE ADDED LATE, because for a long time the harness could
 * not reach them. Both were unreachable for the same kind of reason — the
 * harness never put the product in the state that runs the code:
 *
 *   the moves row     renderChips() draws it, and it only runs when the
 *                     backend answers with a `chips` array. The canned worker
 *                     reply was a single fixed object with no `chips` key, so
 *                     that branch had never executed under the camera. Fixed
 *                     by making the canned reply switchable (see `serve()`)
 *                     and adding a second exchange that genuinely earns moves.
 *   the pencil, open  appendOwnChip()'s arm() only runs on the user's own
 *                     click. Nothing clicked it, so the expanded box had never
 *                     been photographed. Fixed by clicking it.
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
 * capture-live.mjs, the sibling of this file, is what carries it out — real
 * claude.ai, real model output, real quota, and a human at the keyboard. This
 * file stays the one you run by reflex: free, deterministic, and the thing that
 * proves the shared code in lib.mjs still works.
 *
 * Requires a headed browser (extensions do not load in headless Chromium), so
 * it runs under Xvfb. Playwright and Chromium come from the image; see
 * scripts/screenshots/README.md.
 */

import { createServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  chromium, HERE, SHOT, CARD, MASCOT, MOVE, PENCIL, OWN_INPUT, PENCIL_GLYPH,
  assertMoveRow, assertOwnInputOpen, createShooter,
} from './lib.mjs';

const REPO = resolve(HERE, '../..');
const EXT = join(REPO, 'extension');
/* CX_OUT redirects the whole set to a scratch directory. The point is
   verification: after a change to lib.mjs or to this file, a run into a
   throwaway directory proves the harness still works without overwriting
   frames someone has already approved. Default is the real one. */
const OUT = process.env.CX_OUT || join(REPO, 'publishing', 'screenshots');
const MOCK = join(HERE, 'mock-claude.html');

const PORT = 8443;
const API_HOST = 'contexa-api.michu110899.workers.dev';

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

/* The second exchange's canned reply: MOVES, not questions.

   This is the other branch of the same endpoint, and it is a different product
   moment rather than a different skin on the same one. Questions appear when
   the reply is missing something only the user holds; moves appear when it
   left something worth doing that needs nothing from them. So the reply below
   had to be written to earn moves — it settles the trip rather than asking
   about it — and each chip's `evidence` is a verbatim slice of it, the way the
   grounding gate demands. Change the reply and the evidence has to move with
   it, or you are photographing a chip the product would have dropped.

   Shape note: `questions: []` is not decoration. callHosted() in
   background.js rejects any hosted response without a questions array as
   `bad_response`, and the worker's own moves reply carries the empty array for
   exactly that reason. `assume` does not render on this row by design (see
   renderChips) — it rides into whichever chip is clicked, including the
   pencil, so it belongs in the payload. */
const MOVES = {
  questions: [],
  assume: ['you would rather walk between stops than take taxis'],
  chips: [
    {
      id: 'deeper',
      text: 'Fill in the loose afternoons with a couple of options near each day\u2019s base.',
      evidence: 'left the afternoons loose enough',
    },
    {
      id: 'risk',
      text: 'What do I do if I turn up at Sal Grosso or Ramiro and they are full?',
      evidence: 'I have booked nothing and assumed you would rather keep it that way',
    },
    {
      id: 'choose',
      text: 'Pick between Sintra and Cascais for day 4 and carry on.',
      evidence: 'swap for Cascais if a beach afternoon sounds better',
    },
  ],
  quota: { used: 5, limit: 20 },
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

/* The second exchange, in full. The user's turn is COMPOSED.prompt verbatim —
   they send exactly what the previous frame composed for them, which is the
   only honest way to continue this conversation — and the reply below answers
   it completely.

   That completeness is the point. Every one of the three chips in MOVES is
   earned by a phrase in here, and the phrases are marked so a later edit does
   not quietly strand one:

     "left the afternoons loose enough"                       -> deeper
     "I have booked nothing and assumed ... keep it that way"  -> risk
     "swap for Cascais if a beach afternoon sounds better"    -> choose */
const MOVES_REPLY_HTML = `
<p>Here are the four days laid out. Mornings are unhurried, and I have
left the afternoons loose enough that you can drop something without the rest
of the day falling apart.</p>
<p><strong>Day 1 — Alfama.</strong> Out around 10 for coffee, up to S&atilde;o Jorge
Castle by midday, lunch at Ti-Nat&eacute;rcia. Afternoon free. Dinner at 8 at Taberna
Sal Grosso — this is the one nicer meal.</p>
<p><strong>Day 2 — Baixa &amp; Chiado.</strong> Pra&ccedil;a do Com&eacute;rcio by 11, then the
grid streets and Livraria Bertrand. Lunch at the Time Out Market around 1.
Dinner at Cervejaria Ramiro at 8:30.</p>
<p><strong>Day 3 — Bel&eacute;m.</strong> Tram 15E out at 10, the monastery, then
Past&eacute;is de Bel&eacute;m before noon or the queue eats an hour. Back mid-afternoon,
evening deliberately empty.</p>
<p><strong>Day 4 — Sintra.</strong> The 8:41 train from Rossio, Pena Palace first,
Quinta da Regaleira after lunch, home by six.</p>
<p>I have booked nothing and assumed you would rather keep it that way — both
dinners take walk-ins if you turn up early. Day 4 is the one you could
swap for Cascais if a beach afternoon sounds better than a second palace.</p>`;

/* What gets typed into the pencil for 7-pencil.png.

   Rough on purpose — lower case, no punctuation, the shape of a thought rather
   than of a prompt — because that is the whole promise of the box it sits in:
   "Type it rough — I'll write it properly". A neat sentence here would
   photograph a text field, not the offer.

   The trade-off, stated so the next person can reverse it in one line: text in
   the box hides the placeholder, so this frame shows the box IN USE rather
   than showing the instruction. Set this to '' to photograph the empty box with
   its placeholder reading instead. Either way the harness asserts the
   placeholder is there before it shoots — that is what proves the box is the
   armed input and not something else wearing its class. */
const ROUGH_ASK = 'rainy day backup for the sintra day';

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

/* Which canned answer /v1/next-steps gives, switchable mid-run.

   It used to be the QUESTIONS constant, hardcoded at the point of use, which
   is why the moves branch had never been photographed: there was no way to ask
   the endpoint for the other shape. Every phase below now states which answer
   it wants rather than inheriting whatever the last one left behind — the
   extension caches suggestions per exchange in a service worker that may
   restart, so a phase that relies on a cache hit to get the right shape is a
   phase that writes the wrong frame the day the cache misses. */
let nextSteps = QUESTIONS;
const serve = payload => { nextSteps = payload; };

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
        : req.url.startsWith('/v1/next-steps') ? nextSteps
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

const { shoot, shots } = createShooter(OUT);

/* The grounding rule, applied to the canned data itself.

   Every question and every chip in this product is earned by a verbatim quote
   from the reply — that is the gate cleanChips/refineSteps enforce, and a
   screenshot of a chip the gate would have dropped advertises behaviour the
   extension does not have. The canned payloads bypass that gate (they are
   served past the worker, and the hosted path does not re-validate), so it is
   checked here instead. It costs nothing and it catches the one edit that is
   easy to make and impossible to see: rewording the reply and leaving the
   evidence pointing at text that is no longer in it. */
function assertGrounded(items, html, what) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  for (const it of items) {
    if (!text.includes(it.evidence)) {
      throw new Error(
        `${what} ${JSON.stringify(it.label || it.id)} quotes ${JSON.stringify(it.evidence)}, ` +
        'which does not appear in the reply it is supposed to be grounded in — ' +
        'the reply was edited and its evidence was not');
    }
  }
}

async function main() {
  if (!existsSync(EXT)) throw new Error(`no extension/ at ${EXT}`);
  mkdirSync(OUT, { recursive: true });
  // Before the browser starts, so a stranded quote fails in a second rather
  // than after a minute of driving.
  assertGrounded(QUESTIONS.questions, REPLY_HTML, 'question');
  assertGrounded(MOVES.chips, MOVES_REPLY_HTML, 'chip');
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
      /* Some environments route egress through an agent proxy. The whole point
         here is to reach the LOCAL server instead, so take the proxy out of the
         path entirely — otherwise the redirect above never gets a chance to
         apply.

         This comment used to say the proxy "correctly refuses claude.ai". That
         was never measured and it is not what happens: checked Aug 2026, the
         proxy relays claude.ai fine (CONNECT succeeds, no policy denial) and
         the 403 comes from claude.ai's own edge — `server: cloudflare`,
         `cf-mitigated: challenge` — which is bot mitigation answering an
         automated client on a datacenter IP. It matters because it is the
         reason capture-live.mjs has to run on a machine a human is logged in
         on, rather than anywhere with a session cookie. */
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
    serve(QUESTIONS);            // frames 3, 1, 2 — the reply asked for something
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

    /* ---- 6-moves: the other branch of the same endpoint ---------------------
       They send the prompt CONTEXA just composed, and this time the reply
       settles the trip instead of asking about it — so there is nothing to
       interview them about and the row is moves: one click each, nothing to
       answer. A NEW exchange is required, not a re-answer of the old one:
       background.js caches suggestions against prompt+reply, so the same reply
       could only ever produce the same card. */
    serve(MOVES);
    await page.evaluate(text => window.__mock.addTurn(text), COMPOSED.prompt);
    await page.waitForTimeout(300);
    await page.evaluate(html => window.__mock.streamReply(html), MOVES_REPLY_HTML);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__mock.finishStream());
    await page.waitForSelector(MASCOT, { timeout: 15000 });
    await page.click(MASCOT);
    await page.waitForSelector(MOVE, { timeout: 15000 });
    await assertMoveRow(page, MOVES.chips.length);
    await page.evaluate(() => window.__mock.bottom());
    await page.waitForTimeout(600);
    await shoot(page, '6-moves.png', 'the moves row — one click, nothing to answer', { card: true });

    /* ---- 7-pencil: the fifth chip, opened ----------------------------------
       arm() is reachable only by the user's own click, which is why this state
       had never been captured: nothing here had ever clicked the pencil. Same
       row as the frame above, one click later. */
    const pencil = page.locator(PENCIL).first();
    await pencil.waitFor({ timeout: 10000 });
    const label = ((await pencil.textContent()) || '').trim();
    // The row's other .chip.own is the session-hide offer, and photographing a
    // click on THAT would be a quietly wrong frame. Check before clicking.
    if (!label.startsWith(PENCIL_GLYPH)) {
      throw new Error(`expected the pencil chip, found a chip reading "${label}"`);
    }
    await pencil.click();
    const box = page.locator(OWN_INPUT);
    await box.waitFor({ timeout: 10000 });
    const placeholder = await box.getAttribute('placeholder');
    if (!placeholder) throw new Error('the box opened with no placeholder — that is not arm()\'s input');
    if (ROUGH_ASK) await box.fill(ROUGH_ASK);
    await page.evaluate(() => window.__mock.bottom());
    await page.waitForTimeout(500);
    /* Nothing steals focus on the mock, so this is cheap insurance here — but
       it is the same check capture-live.mjs leans on hard, where claude.ai's
       own focus management really can collapse an empty box mid-frame. Keeping
       it on both paths means the mock exercises it. */
    await assertOwnInputOpen(page, 'before the shutter');
    await shoot(page, '7-pencil.png',
      ROUGH_ASK ? 'the pencil, opened, with a rough ask typed in'
                : 'the pencil, opened, showing its placeholder', { card: true });
    await assertOwnInputOpen(page, 'after the shutter');

    /* ---- 4-light: the same interview, host in light mode -------------------
       serve() is reset, not left on MOVES. The reload puts the page back to the
       first exchange, whose suggestions are normally still cached from
       1-interview — but a service worker that restarted in between would send
       this frame to the network, and it must not come back with chips. */
    serve(QUESTIONS);
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

    console.log(`\nwrote ${shots.length} screenshots to ${OUT}`);
  } finally {
    await ctx.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch(e => { console.error('\nCAPTURE FAILED:', e.message); process.exit(1); });
