# Store screenshots

**Rendered 2026-09-26, for 0.9.98**, from `scripts/screenshots/slides.html` by
`node scripts/screenshots/render-slides.mjs`. Five PNGs, each exactly 1280×800,
the size the Chrome Web Store takes without rescaling. The 0.9.95 set
(2026-09-07) was authored elsewhere and only its PNGs landed here, so the rename
of the Start fresh button had nothing to edit; edit the HTML and re-render, never the PNGs.

**These are designed illustrations, not captures.** Every earlier set in this
folder was a photograph of the real extension running in a real Chromium against
a mock of claude.ai (see *The captured set this replaced*, below). This one is
not: each frame is a composed slide — a headline, a claude.ai-shaped frame, the
CONTEXA card in it — and every frame carries `Illustrative demo` in its footer,
which is the whole reason they can be honest. They show the product's behaviour
and its actual copy; they are not evidence of a session that happened.

That matters for one item on the checklist, and it makes it stronger rather than
weaker: **retaking these against a live claude.ai session before submitting still
stands.** A reviewer compares screenshots against what the extension does, and a
frame that says it is an illustration is a promise about the frame, not about the
selectors. Only a live session proves those still match the site.

| File | Headline | Shows |
|---|---|---|
| `1-new-chat.png` | Long session? Keep going. | the cost line on a long thread — `≈ 689k tokens re-read per send` — and the **Same session, new chat** button beside it |
| `2-brief.png` | Same work. A lighter thread. | the brief landed in a new chat, not sent, beside the measured pair (689k against 441, 9% against 3% of the five-hour limit), labelled as measured |
| `3-moves.png` | Deep in a session? Your next move. | the mined row — three independent moves, each a complete request |
| `4-composed.png` | One click. A complete prompt. | one click later: the whole prompt in the message box, still unsent |
| `5-trigger.png` | Ready when you ask. | the mascot as it arrives, before anything is asked or spent |

**0.9.98 moved the set onto long sessions.** Start fresh became Same session, new chat, the
example became a long working session on a quarterly sales report (a 689k-token
Lisbon itinerary was not believable), and the example texts carry no
`<paste here>` slot; frame 2 names it once, in the side note, and the one number on the set is the largest one
measured. Frame 2 is the only frame with a real figure on it, and says so.

**The order is the argument, and it changed with 0.9.95.** The name and the short
description now lead with saving tokens, so the set leads with the saving too:
the exit from a heavy thread first, the brief that makes it safe second, and only
then the row that most people would otherwise read as smart-reply stubs. The old
set opened on the composed prompt, which was the right lead when the motto was
about the writing.

Frames 1, 2 and 4 are light, frames 3 and 5 dark, so the set shows the card
following the host's theme without spending a frame on saying so — the previous
set spent one (`4-light.png`).

**Update the stamp above whenever this set is remade.** Its absence has cost
something before: the 0.9.58 set carried no date, so nobody noticed when commit
`3267e4c` changed the label rule from "two to four words" to "up to six words,
naming the action and the thing it acts on", and the frames went on showing
`Build the itinerary` and `Add day trips` — which that same rule names as the
defect it was written to fix. The screenshots were advertising a weakness the
product had already corrected. Illustrations go stale the same way captures do,
and faster, because no harness re-runs them.

## The captured set this replaced

`scripts/screenshots/capture.mjs` still exists and still works. It loads the
**unmodified** extension into a real Chromium and redirects two hostnames at the
network layer: `claude.ai` serves a mock page carrying the DOM contract
`content.js` reads, and the worker hostname serves canned JSON. So the code under
that camera is the shipped code, while the page is a mock and the model output is
canned (`MOVES`, at the top of the harness). It produced every set in this
folder's history, the 0.9.68 one of 2026-09-01 included; it no longer produces
what ships, but it writes the same five filenames (default run: `3-moves`,
`4-composed`, `5-trigger`; `CX_FORK=1`: `1-start-fresh`, `2-brief`), so a run
**overwrites the shipped frames in place** — a deliberate choice, so that the
next captured set slots in without a rename, and a warning for the same reason.
Keep it: it is the cheapest way to see the real card render.

Two things it does are worth knowing, because both came out of a failure. The
first attempt (PR #13) shipped two frames with the card stranded in dead space,
far from the message box it is supposed to sit against — the cause was in the
mock, not the product: `content.js` mounts the card as an ordinary sibling above
the composer's container, so it inherits the host page's layout, and the mock's
layout was wrong in two ways at once (a fixed-position composer, and a DOM too
shallow for `mountHost()`'s six-level walk-up, which let the card escape to full
width). So:

- **The harness is committed.** PR #13 committed only the PNGs, and there was
  nothing to inspect or re-run when they turned out wrong.
- **The geometry is asserted before the shutter**, on every frame with a card: it
  must be aligned with the message box and directly above it, or the capture
  fails instead of writing a misleading image. That check is mutation-verified —
  removing a nesting level from the mock reproduces PR #13's bug and the harness
  refuses to write the frame.
