/* CONTEXA — shared screenshot-harness machinery.
 *
 * Two drivers import this:
 *
 *   capture.mjs       the mock harness. Deterministic, free, needs no auth,
 *                     runs anywhere. This is the one you run by reflex.
 *   capture-live.mjs  the live harness. Real claude.ai, real model output,
 *                     real quota, and a human at the keyboard.
 *
 * Everything in here is the part that does not care which of the two it is
 * driving: finding Playwright, the store's frame size, the shadow-DOM
 * selectors the card renders into, and the assertions that decide whether a
 * frame is honest enough to write.
 *
 * The mock harness is what keeps this file correct. It is deterministic and
 * costs nothing, so after any change here, run it — if the seven mock frames
 * still come out and both assertions still bite, the shared code is intact.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* Playwright is a developer dependency of these scripts alone — the repo itself
   has no node_modules and nothing shipped needs it. Accept it wherever it is:
   installed locally, or global (which ESM will not find via NODE_PATH, hence
   the explicit second attempt). */
export const chromium = await (async () => {
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

export const HERE = dirname(fileURLToPath(import.meta.url));

/* The Chrome Web Store's screenshot size. Both drivers shoot exactly this, so
   a live frame and a mock frame are directly comparable. */
export const SHOT = { width: 1280, height: 800 };

/* ------------------------------------------------- claude.ai's DOM contract */
/* A mirror of the constants at the top of extension/content.js. The harness
   cannot import them — content.js runs in the page's world, this runs in
   node — so this is a copy, and it is the second place that has to change if
   claude.ai's structure moves. That is precisely what the live driver exists
   to find out: it reports which of these actually matched. */
export const COMPOSER_SELECTORS = [
  'div[contenteditable="true"].ProseMirror',
  'div[contenteditable="true"].tiptap',
  'div[contenteditable="true"][aria-label*="prompt" i]',
  'fieldset div[contenteditable="true"]',
  'div[contenteditable="true"][aria-label]',
  'div[contenteditable="true"]',
];
export const RESPONSE_SEL = '.font-claude-response';
export const STREAM_SEL = '[data-is-streaming]';
export const USER_MSG_SEL = '[data-testid="user-message"]';
export const ROW_SEL = '[class*="group/message-row"]';

/* ------------------------------------------------------ CONTEXA's own card */
/* The card lives in an open shadow root; Playwright's CSS engine pierces it. */
export const HOLDER = '[data-contexa]';
export const CARD = '[data-contexa] .wrap';
export const MASCOT = '[data-contexa] .ctxa-mas';
export const MOVE = '[data-contexa] .chip.move';
export const PENCIL = '[data-contexa] .chip.own';
export const OWN_INPUT = '[data-contexa] .own-input';

/* The pencil chip's label, verbatim from content.js. The row's other .chip.own
   is the session-hide offer, and clicking THAT instead would produce a quietly
   wrong frame — so the drivers check the label before they click. */
export const PENCIL_GLYPH = '✎';

/* --------------------------------------------------------------- geometry */

/* Finds the composer the way content.js's findComposer() does, in the page's
   own world: first selector that matches anything visible, largest match wins.
   A deliberate third copy of that logic (content.js has it, this has it) and
   the reason is specific: the harness has to measure the card against the same
   element content.js mounted it next to. Measuring against anything else —
   an id that only the mock has, say — proves nothing about the real page.

   Returned as a handle rather than found again inside every evaluate: the live
   page's CSP has no `unsafe-eval`, so shipping this logic across as a string
   and reconstituting it with `new Function` would work on the mock and throw on
   claude.ai. Handles cross the boundary without eval.

   The caller disposes it. Resolves to a null-valued handle when nothing
   matched, which the callers check for. */
export function composerHandle(page) {
  return page.evaluateHandle(selectors => {
    const area = el => { const r = el.getBoundingClientRect(); return r.width * r.height; };
    const visible = el => {
      const r = el.getBoundingClientRect();
      return r.width > 120 && r.height > 12 && el.offsetParent !== null;
    };
    for (const sel of selectors) {
      const els = [...document.querySelectorAll(sel)].filter(visible);
      if (els.length) return els.sort((a, b) => area(b) - area(a))[0];
    }
    return null;
  }, COMPOSER_SELECTORS);
}

/* Which selector actually matched, and how many candidates it beat. The live
   driver prints this: a live run is the only thing that proves the pinned
   selectors still match claude.ai, so it should say what it found rather than
   just silently working. */
export function composerReport(page) {
  return page.evaluate(selectors => {
    const visible = el => {
      const r = el.getBoundingClientRect();
      return r.width > 120 && r.height > 12 && el.offsetParent !== null;
    };
    const rows = selectors.map(sel => ({
      sel,
      total: document.querySelectorAll(sel).length,
      visible: [...document.querySelectorAll(sel)].filter(visible).length,
    }));
    return {
      rows,
      matched: (rows.find(r => r.visible > 0) || {}).sel || null,
      responses: document.querySelectorAll('.font-claude-response').length,
      streamFlags: document.querySelectorAll('[data-is-streaming]').length,
      userMsgs: document.querySelectorAll('[data-testid="user-message"]').length,
      rows_: document.querySelectorAll('[class*="group/message-row"]').length,
      mode: document.documentElement.getAttribute('data-mode'),
    };
  }, COMPOSER_SELECTORS);
}

/* PR #13 shipped two screenshots with the card stranded in dead space, and
   nothing caught it but a human eye on the final PNG. A screenshot harness that
   cannot tell a good frame from a libellous one is not much of a harness, so
   the geometry is asserted before the shutter, on every frame that has a card.
   These are the two things the layout can get wrong (see mock-claude.html):
   the card escaping its column, and the card detaching from the composer. */
export async function assertCardGeometry(page) {
  const composer = await composerHandle(page);
  let g;
  try {
    g = await page.evaluate(comp => {
      const holder = document.querySelector('[data-contexa]');
      if (!holder || !comp) return null;
      const c = holder.getBoundingClientRect();
      const m = comp.getBoundingClientRect();
      return { cardLeft: c.left, cardBottom: c.bottom, cardWidth: c.width,
               boxLeft: m.left, boxTop: m.top };
    }, composer);
  } finally {
    await composer.dispose();
  }
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

/* --------------------------------------------------------------- branches */

/* Which of the card's mutually exclusive branches is currently drawn.
   Geometry is not the only way a frame can lie: the moves row and the
   interview are two branches of one endpoint rendered into the same card, so
   a dropped `chips` key or a stale suggestion cache substitutes one for the
   other with nothing on screen looking broken.

   The mock driver uses this as an assertion (it KNOWS which branch it asked
   for). The live driver uses it as a decision (it cannot know until it looks,
   because the model decides). Same reading, two jobs. */
export async function readBranch(page) {
  const [moves, pills, pencil] = await Promise.all([
    page.locator(MOVE).count(),
    page.locator(`${CARD} .pills .pill`).count(),
    page.locator(PENCIL).count(),
  ]);
  const kind = moves ? 'moves' : pills ? 'interview' : pencil ? 'quiet' : 'none';
  return { kind, moves, pills, pencil };
}

export async function assertMoveRow(page, want) {
  const b = await readBranch(page);
  if (b.moves !== want) {
    throw new Error(
      `expected ${want} move chip(s), found ${b.moves}` +
      (b.pills ? ` — the card drew the interview instead (${b.pills} option pills), ` +
                 'so the canned answer that reached it was not the chips one' : ''));
  }
  return b;
}

/* The rough-ask box, open. Worth its own check because it is the one element
   in the product that can vanish between the decision to shoot and the
   shutter: arm()'s input collapses back to a chip on blur when it is empty
   (content.js, appendOwnChip). Nothing stole focus under the mock; the live
   site manages focus on its own composer, so there it genuinely can. */
export async function assertOwnInputOpen(page, when) {
  const n = await page.locator(OWN_INPUT).count();
  if (n !== 1) {
    throw new Error(
      `the rough-ask box is not open ${when} (found ${n}) — ` +
      'an empty box collapses back to the chip on blur, so something took focus');
  }
}

/* ---------------------------------------------------------------- shutter */

/* Bound to an output directory rather than reading a module-level constant,
   because the two drivers write to different places and a verification run
   writes to a scratch dir — see CX_OUT in capture.mjs. */
export function createShooter(outDir) {
  const shots = [];
  async function shoot(page, name, note, { card = false } = {}) {
    if (card) await assertCardGeometry(page);
    await page.screenshot({ path: join(outDir, name), clip: { x: 0, y: 0, ...SHOT } });
    shots.push({ name, note });
    console.log(`  ${name}  ${note}`);
  }
  return { shoot, shots };
}
