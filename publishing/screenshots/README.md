# Store screenshots

Seven PNGs, each exactly 1280×800. The set is dark apart from `4-light.png`,
which exists to show that the card follows the host's theme rather than
imposing its own.

| File | Shows |
|---|---|
| `1-interview.png` | the click-only interview — a question with its options written for you |
| `2-composed.png` | the composed prompt, landed in the message box, nothing sent |
| `3-trigger.png` | the trigger as it arrives, before anything is asked or spent |
| `4-light.png` | the same interview with claude.ai in light mode |
| `5-settings.png` | the settings page |
| `6-moves.png` | the moves row — the reply left something worth doing that needs nothing from you, so there is nothing to answer |
| `7-pencil.png` | the pencil, opened, with a rough ask typed into it |

**The numbers are file names, not listing order.** `6` and `7` were added after
the first five, and the existing files were deliberately not renumbered to make
room: renaming them would have churned every reference to them across the repo
and the store draft to buy nothing. Pick the upload order in the checklist, not
from these names.

**The store takes at most five**, so seven frames is a set to choose from
rather than a set to upload. Which five go up is a listing decision and lives
in `PUBLISHING-CHECKLIST.md` Phase 5, unmade.

The capture order is not the file order either — `capture.mjs` walks the
product forward through one continuous session (`3 → 1 → 2 → 6 → 7`, then the
light reload and the options page), because each state is reached from the one
before it.

## What 6 and 7 are, and why they arrived late

Both were states the harness could not reach, rather than states nobody wanted:

- **`6-moves.png`** is the other branch of the same endpoint. When a reply is
  missing something only you hold, CONTEXA interviews you; when it left
  something worth doing that needs nothing from you, it offers moves instead —
  one click each, nothing to answer. The harness served a single fixed canned
  answer with no `chips` key, so `renderChips()` had never run under the camera.
  It now serves a second exchange whose reply genuinely earns moves, and each
  chip is grounded in a verbatim quote from that reply, exactly as the product's
  own gate requires.
- **`7-pencil.png`** is the fifth chip opened. `arm()` runs only on the user's
  own click, and nothing in the harness had ever clicked it, so the expanded box
  had never been photographed. It is now clicked, and a rough ask is typed in —
  which is the point of the box, but does mean the frame shows it in use rather
  than showing its placeholder. `ROUGH_ASK` in `capture.mjs` is a one-line
  switch: set it to `''` to photograph the empty box with the placeholder
  reading instead.

## How they are made

`node scripts/screenshots/capture.mjs` — see `scripts/screenshots/README.md`
for what it does and how to run it. Do not retouch these by hand; change the
harness and re-run, or the next person cannot reproduce what they are looking
at.

The extension is loaded **unmodified** into a real Chromium, and two hostnames
are redirected at the network layer to a local server: `claude.ai` serves a mock
page carrying the DOM contract `content.js` reads, and the worker hostname
serves canned JSON. So the code under the camera is the shipped code — but the
page is a mock and the model output is canned.

**That is why the checklist still says to retake these against a live
claude.ai session before submitting.** These are honest about the product's
behaviour and layout; they are not evidence that the selectors still match the
real site today.

## The bug this set exists to correct

The first attempt (PR #13) shipped two frames with the card stranded in dead
space, far from the message box it is supposed to sit against. The cause was in
the mock, not the product: `content.js` mounts the card as an ordinary sibling
above the composer's container, so it inherits whatever the host page's layout
does — and the mock's layout was wrong in two ways at once (a fixed-position
composer, and a DOM too shallow for `mountHost()`'s six-level walk-up, which let
the card escape to full width).

Two things changed as a result, both worth keeping:

- **The harness is committed.** PR #13 committed only the PNGs, so there was
  nothing to inspect or re-run when they turned out wrong.
- **The geometry is asserted before the shutter**, on every frame that has a
  card: it must be aligned with the message box and directly above it, or the
  capture fails instead of writing a misleading image. That check is
  mutation-verified — removing a nesting level from the mock reproduces PR #13's
  bug and the harness refuses to write the frame.

`6-moves.png` added a second class of assertion for the same reason. Geometry is
not the only way a frame can lie: the moves row and the interview are two
branches of one endpoint drawn in the same card, so a dropped `chips` key or a
stale suggestion cache turns one into the other with nothing on screen looking
broken. That frame therefore asserts it is looking at the right branch before
the shutter, and the canned chips are checked against the canned reply for the
verbatim quote that earns them.
