# Store screenshots

Five PNGs, each exactly 1280×800, in listing order. The set is dark apart from
`4-light.png`, which exists to show that the card follows the host's theme
rather than imposing its own.

| File | Shows |
|---|---|
| `1-moves.png` | the mined row — up to four next moves, each a whole message |
| `2-composed.png` | one click later: the whole prompt in the message box, nothing sent |
| `3-trigger.png` | the trigger as it arrives, before anything is asked or spent |
| `4-light.png` | the same row with claude.ai in light mode |
| `5-settings.png` | the settings page |

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
