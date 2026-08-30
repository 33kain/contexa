/* CONTEXA — LIVE Chrome Web Store screenshot harness.
 *
 *   node scripts/screenshots/capture-live.mjs            full run
 *   node scripts/screenshots/capture-live.mjs --preflight   session + selectors only, spends nothing
 *
 * The sibling of capture.mjs, pointed at the real claude.ai instead of
 * mock-claude.html. It exists because of the standing ⚠️ in
 * publishing/PUBLISHING-CHECKLIST.md Phase 5: the mock frames are honest about
 * the product's behaviour and layout, but they are not evidence that the pinned
 * selectors still match claude.ai as it stands today, and a store reviewer
 * compares screenshots against the real thing.
 *
 * THIS ONE IS NOT FREE, AND NOT UNATTENDED. Read before running:
 *
 *   - It sends real messages in your real claude.ai account, in whatever
 *     conversation is open. Start it on a NEW chat.
 *   - It spends real CONTEXA quota: 3 calls on a clean run, up to 5 if the
 *     moves row needs its retries, out of a 40/device/day limit.
 *   - The model output is real, so no two runs produce the same frames. The
 *     assertions below decide whether a frame is *honest*; only your eye
 *     decides whether it is *good*. Look at every frame before promoting it.
 *   - It needs a human for the first launch: log in, and clear Cloudflare's
 *     check if it appears. After that the profile carries the session.
 *
 * WHAT IT WILL NOT DO. If Cloudflare challenges the browser mid-run, this
 * stops and says so. There is no bypass here and none should be added — the
 * legitimate way past that gate is to be a person on their own machine, which
 * is exactly the setup this script assumes.
 *
 * OUTPUT goes to publishing/screenshots/live/, never straight over the
 * approved set. Promote by hand, after looking.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  chromium, HERE, SHOT, CARD, MASCOT, PENCIL, OWN_INPUT, PENCIL_GLYPH,
  RESPONSE_SEL, STREAM_SEL, USER_MSG_SEL,
  composerHandle, composerReport, readBranch, assertOwnInputOpen, createShooter,
} from './lib.mjs';

const REPO = resolve(HERE, '../..');
const EXT = join(REPO, 'extension');
const OUT = process.env.CX_OUT || join(REPO, 'publishing', 'screenshots', 'live');
/* Persistent on purpose — this is what makes the claude.ai login and the
   Cloudflare clearance survive between runs, so only the first one needs a
   human. It therefore holds live session cookies: it is gitignored, and it
   should never be committed, copied, or pasted anywhere. */
const PROFILE = process.env.CX_PROFILE || join(HERE, '.live-profile');

const PREFLIGHT = process.argv.includes('--preflight');

/* The conversation, fixed so the live frames line up with the mock ones. The
   opening message is the same sentence the mock's thread shows. */
const OPENER = "Can you help me plan a 4-day trip to Lisbon? I've never been.";

/* Used only when the day-by-day reply comes back still asking things. It says
   "stop asking" in the user's own words, which is what turns the next reply
   into one the moves branch can act on. It is a nudge, not a script the model
   is obliged to follow — hence the retry cap. */
const SETTLE_NUDGE =
  "Looks great, lock it in — don't ask me anything else, just tell me if you " +
  'assumed anything or left something out.';

/* Real attempts at the one frame that depends on a reply the model controls.
   Each attempt costs one message and one CONTEXA call, so this is a spend cap
   as much as a patience cap: on exhaustion the run stops and reports rather
   than continuing to buy lottery tickets. */
const MAX_MOVES_ATTEMPTS = 3;

/* The rough-ask box is photographed EMPTY here, unlike the mock set: the
   placeholder is the instruction, and a store frame should carry it. Nothing
   is typed, which is also why this frame costs nothing to retry — the box only
   spends a call on submit, and it is never submitted. */
const PENCIL_RETRIES = 3;

const REPLY_TIMEOUT = 180_000;   // a real day-by-day itinerary is slow
const CARD_TIMEOUT = 30_000;

let quotaSpent = 0;              // CONTEXA calls this run has caused
const spend = why => { quotaSpent++; console.log(`    [spend] ${why} (${quotaSpent} so far)`); };

/* ------------------------------------------------------------------ page ops */

/* Scrolls the thread WITHOUT touching focus. Every keyboard route to the
   bottom (End, PageDown, Ctrl+End) types into whatever is focused, and every
   click route blurs it — either of which collapses the empty rough-ask box in
   the last frame. So: find the reply's scrollable ancestor and set scrollTop. */
function scrollToBottom(page) {
  return page.evaluate(sel => {
    const all = document.querySelectorAll(sel);
    const last = all[all.length - 1];
    let n = last && last.parentElement;
    while (n && n !== document.body) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 8) {
        n.scrollTop = n.scrollHeight;
        return true;
      }
      n = n.parentElement;
    }
    const doc = document.scrollingElement || document.documentElement;
    doc.scrollTop = doc.scrollHeight;
    return false;
  }, RESPONSE_SEL);
}

/* How many replies are finished right now. The live equivalent of the mock's
   finishStream(): content.js reads the LAST .font-claude-response and the
   data-is-streaming flag on its ancestor, so this reads exactly the same pair
   rather than inventing a second notion of "done". */
function replyState(page) {
  return page.evaluate(([resSel, streamSel]) => {
    const all = [...document.querySelectorAll(resSel)];
    const last = all[all.length - 1];
    if (!last) return { count: 0, done: false, len: 0 };
    const wrap = last.closest(streamSel);
    return {
      count: all.length,
      done: wrap ? wrap.getAttribute('data-is-streaming') === 'false' : false,
      len: (last.textContent || '').trim().length,
      hadFlag: !!wrap,
    };
  }, [RESPONSE_SEL, STREAM_SEL]);
}

async function waitForNewReply(page, previousCount) {
  const deadline = Date.now() + REPLY_TIMEOUT;
  let last = null;
  while (Date.now() < deadline) {
    const s = await replyState(page);
    last = s;
    /* content.js skips replies under 120 chars, so a frame is impossible until
       the reply clears that too — waiting for it here means we never click the
       mascot on a reply the extension has decided to ignore. */
    if (s.count > previousCount && s.done && s.len >= 120) return s;
    await page.waitForTimeout(750);
  }
  throw new Error(
    `no finished reply within ${REPLY_TIMEOUT / 1000}s (last seen: ` +
    `${JSON.stringify(last)}). If hadFlag is false, ${STREAM_SEL} no longer ` +
    'wraps the reply and content.js is running on its 1.2s settle fallback — ' +
    'that is a real finding, and the selector needs updating in content.js.');
}

/* Sends `text`, or sends whatever is already sitting in the composer when text
   is null (which is how the composed prompt goes out — CONTEXA put it there
   and we must not retype it). */
async function send(page, text) {
  const before = (await replyState(page)).count;
  const userBefore = await page.locator(USER_MSG_SEL).count();
  const composer = await composerHandle(page);
  try {
    const ok = await composer.evaluate(el => !!el);
    if (!ok) throw new Error('no composer found — none of COMPOSER_SELECTORS matched a visible element');
    await composer.asElement().click();
    if (text) await page.keyboard.type(text, { delay: 12 });
    await page.keyboard.press('Enter');
  } finally {
    await composer.dispose();
  }

  // Enter is how claude.ai sends; if that ever changes, say which selector to
  // look at rather than hanging on a message that was never sent.
  let sent = false;
  const sendDeadline = Date.now() + 5000;
  while (Date.now() < sendDeadline) {
    if ((await page.locator(USER_MSG_SEL).count()) > userBefore) { sent = true; break; }
    await page.waitForTimeout(250);
  }
  if (!sent) {
    throw new Error(
      'pressing Enter did not send — no new ' + USER_MSG_SEL + ' appeared. ' +
      'claude.ai may now require the send button; find its selector and add a ' +
      'fallback click here. This is exactly the kind of drift a live run exists to catch.');
  }
  return before;
}

/* Clicks the mascot and reports which branch the card drew. One CONTEXA call
   per click, always — hence the accounting. */
async function askContexa(page, why) {
  await page.waitForSelector(MASCOT, { timeout: CARD_TIMEOUT });
  await page.click(MASCOT);
  spend(why);
  /* No cleverer wait than this: readBranch() IS the readiness test, because
     "the answer landed" and "we can tell which branch it drew" are the same
     question. Polling it avoids a second, subtly different notion of ready. */
  const deadline = Date.now() + CARD_TIMEOUT;
  let b = await readBranch(page);
  while (b.kind === 'none' && Date.now() < deadline) {
    await page.waitForTimeout(500);
    b = await readBranch(page);
  }
  return b;
}

/* ---------------------------------------------------------------- preflight */

async function preflight(page) {
  const r = await composerReport(page);
  console.log('\n  selector report — this is the half of the ⚠️ a live run answers:');
  for (const row of r.rows) {
    console.log(`    ${row.visible ? 'MATCH' : '  -  '}  ${String(row.visible).padStart(2)} visible / ` +
                `${String(row.total).padStart(2)} total   ${row.sel}`);
  }
  console.log(`    composer resolved by:  ${r.matched || 'NOTHING — content.js cannot mount'}`);
  console.log(`    ${RESPONSE_SEL}  x${r.responses}`);
  console.log(`    ${STREAM_SEL}  x${r.streamFlags}`);
  console.log(`    ${USER_MSG_SEL}  x${r.userMsgs}`);
  console.log(`    [class*="group/message-row"]  x${r.rows_}`);
  console.log(`    <html data-mode>  ${r.mode === null ? 'ABSENT' : r.mode}`);

  if (!r.matched) {
    throw new Error('no composer selector matched — content.js would never mount. ' +
      'Update SELECTORS in extension/content.js (and the mirror in lib.mjs).');
  }
  /* Asserted, never forced. content.js reads data-mode via isDark() and treats
     it as authoritative, so forcing dark here would paint a dark card onto a
     light page — a screenshot of something the product never does. */
  if (r.mode !== 'dark') {
    throw new Error(
      `claude.ai is in ${r.mode === null ? 'an unknown' : `"${r.mode}"`} mode, not dark. ` +
      'Set your claude.ai appearance to Dark and re-run — the approved set is dark, ' +
      'and forcing it here would photograph a dark card on a light page.');
  }
  if (r.responses > 0 || r.userMsgs > 0) {
    console.log(`\n  NOTE: this conversation already has ${r.userMsgs} message(s). ` +
      'Start on a new chat if you want the thread to match the scripted exchange.');
  }
  return r;
}

/* --------------------------------------------------------------------- run */

async function main() {
  if (!existsSync(EXT)) throw new Error(`no extension/ at ${EXT}`);
  mkdirSync(OUT, { recursive: true });
  mkdirSync(PROFILE, { recursive: true });
  const { shoot, shots } = createShooter(OUT);

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,               // extensions do not load headless, and a human logs in here
    viewport: SHOT,
    colorScheme: 'dark',
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--no-first-run',
      '--disable-features=Translate,MediaRouter',
      `--window-size=${SHOT.width},${SHOT.height}`,
      /* Deliberately NOT here, and the difference from capture.mjs is the whole
         point of this file: no --host-resolver-rules, no --ignore-certificate-
         errors, no --no-proxy-server, no local server. Real DNS, real TLS, real
         claude.ai, real worker. */
    ],
  });

  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    page.on('pageerror', e => console.log('    [pageerror]', e.message));
    await page.goto('https://claude.ai/', { waitUntil: 'domcontentloaded' });

    /* Wait for a human. The composer appearing is the signal that login and
       any Cloudflare check are done — it is the same element content.js needs,
       so it proves the page is usable rather than merely loaded. */
    console.log('\n  waiting for a usable claude.ai session in the open window…');
    console.log('  log in if prompted, and clear any Cloudflare check. Ctrl-C to abort.');
    const loginDeadline = Date.now() + 10 * 60_000;
    for (;;) {
      const h = await composerHandle(page);
      const found = await h.evaluate(el => !!el).catch(() => false);
      await h.dispose();
      if (found) break;
      if (Date.now() > loginDeadline) {
        throw new Error('no composer after 10 minutes — not logged in, or Cloudflare is still challenging. ' +
          'Clear it by hand in the window and re-run; there is no bypass here by design.');
      }
      await page.waitForTimeout(2000);
    }
    console.log('  session is live.');

    await preflight(page);
    if (PREFLIGHT) {
      console.log('\n--preflight: session and selectors check out. Nothing sent, nothing spent.');
      return;
    }

    // ---- 1. the opening message ------------------------------------------
    console.log(`\n  sending: ${OPENER}`);
    let before = await send(page, OPENER);
    await waitForNewReply(page, before);

    // ---- 3-trigger: the card as it arrives, before anything is asked -------
    await page.waitForSelector(MASCOT, { timeout: CARD_TIMEOUT });
    await scrollToBottom(page);
    await page.waitForTimeout(900);
    await shoot(page, '3-trigger.png', 'the trigger, before any click', { card: true });

    // ---- 1-interview: click it, real questions arrive ----------------------
    let branch = await askContexa(page, 'next-steps on the opening reply');
    if (branch.kind !== 'interview') {
      throw new Error(
        `expected the interview on the opening reply, got "${branch.kind}". The reply ` +
        'did not leave a gap only you can fill, which is legitimate but is not the ' +
        'frame this script is scripted for — start a new chat and re-run.');
    }
    await scrollToBottom(page);
    await page.waitForTimeout(600);
    await shoot(page, '1-interview.png', 'the click-only interview', { card: true });

    /* Answer through. The mock knew it had exactly two questions; here the
       model decides (1–4), so loop on what is actually on screen. `.skip` is a
       separate class from `.pill`, so this can never accidentally skip one. */
    for (let n = 0; n < 4; n++) {
      const pill = page.locator(`${CARD} .pills .pill`).first();
      if (!(await pill.count())) break;
      await pill.click();
      await page.waitForTimeout(600);
    }

    // ---- 2-composed: the prompt lands in the real composer ------------------
    const composed = await (async () => {
      const deadline = Date.now() + CARD_TIMEOUT;
      while (Date.now() < deadline) {
        const h = await composerHandle(page);
        const text = await h.evaluate(el => (el && el.innerText || '').trim()).catch(() => '');
        await h.dispose();
        if (text.length > 40) return text;
        await page.waitForTimeout(500);
      }
      return '';
    })();
    if (!composed) throw new Error('the composed prompt never reached the composer');
    spend('expand composing the prompt');
    await scrollToBottom(page);
    await page.waitForTimeout(600);
    await shoot(page, '2-composed.png', 'the composed prompt, in the message box', { card: true });

    // ---- 6-moves: send it, then look for a reply that settles things --------
    console.log('\n  sending the composed prompt');
    before = await send(page, null);
    await waitForNewReply(page, before);

    let moves = null;
    for (let attempt = 1; attempt <= MAX_MOVES_ATTEMPTS; attempt++) {
      console.log(`  moves attempt ${attempt}/${MAX_MOVES_ATTEMPTS}`);
      const b = await askContexa(page, `next-steps, moves attempt ${attempt}`);
      console.log(`    card drew: ${b.kind} (${b.moves} moves, ${b.pills} pills)`);
      if (b.kind === 'moves') { moves = b; break; }
      if (attempt === MAX_MOVES_ATTEMPTS) break;
      /* It asked instead of settling. Nudge in the user's own words and let
         the next reply try again — that is a new exchange, so a new card. */
      console.log('  nudging toward a reply that settles rather than asks');
      before = await send(page, SETTLE_NUDGE);
      await waitForNewReply(page, before);
    }

    if (!moves) {
      throw new Error(
        `the moves row did not land in ${MAX_MOVES_ATTEMPTS} attempts. Stopping rather than ` +
        'spending more. Every frame captured before this point is written and good; ' +
        're-run later, or take 6-moves in a conversation that ends more decisively.');
    }
    await scrollToBottom(page);
    await page.waitForTimeout(600);
    await shoot(page, '6-moves.png', `the moves row — ${moves.moves} moves, nothing to answer`, { card: true });

    // ---- 7-pencil: open the rough-ask box, EMPTY ---------------------------
    /* Everything that could steal focus is done before the pencil is clicked.
       An empty box collapses back to a chip on blur (content.js, appendOwnChip),
       and on the live site claude.ai manages focus on its own composer — so the
       order here is load-bearing, not stylistic. */
    let shot7 = false;
    for (let attempt = 1; attempt <= PENCIL_RETRIES && !shot7; attempt++) {
      const pencil = page.locator(PENCIL).first();
      await pencil.waitFor({ timeout: 10_000 });
      const label = ((await pencil.textContent()) || '').trim();
      // The row's other .chip.own is the session-hide offer; clicking that
      // instead would be a quietly wrong frame.
      if (!label.startsWith(PENCIL_GLYPH)) {
        throw new Error(`expected the pencil chip, found a chip reading "${label}"`);
      }
      await pencil.click();
      const box = page.locator(OWN_INPUT);
      try {
        await box.waitFor({ timeout: 10_000 });
        const placeholder = await box.getAttribute('placeholder');
        if (!placeholder) throw new Error("the box opened with no placeholder — that is not arm()'s input");
        // No fill, no delay: the placeholder IS the subject of this frame, and
        // every idle millisecond is a chance for the site to take focus back.
        await assertOwnInputOpen(page, 'before the shutter');
        await shoot(page, '7-pencil.png',
          `the pencil, opened, showing its placeholder: "${placeholder}"`, { card: true });
        await assertOwnInputOpen(page, 'after the shutter');
        shot7 = true;
      } catch (e) {
        console.log(`    pencil attempt ${attempt}/${PENCIL_RETRIES} lost the box: ${e.message}`);
        if (attempt === PENCIL_RETRIES) throw e;
        await page.waitForTimeout(800);
      }
    }

    console.log(`\nwrote ${shots.length} live screenshots to ${OUT}`);
    console.log(`CONTEXA calls spent this run: ${quotaSpent}`);
    console.log('\nLook at every frame before promoting any of them over the approved set.');
  } finally {
    await ctx.close();
  }
}

main().catch(e => {
  console.error('\nLIVE CAPTURE FAILED:', e.message);
  console.error(`CONTEXA calls spent before the failure: ${quotaSpent}`);
  process.exit(1);
});
