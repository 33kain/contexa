# scripts/screenshots

Generates the seven Chrome Web Store screenshots in `publishing/screenshots/`.
(The store takes at most five of them; choosing which is a listing decision,
and it lives in `publishing/PUBLISHING-CHECKLIST.md` Phase 5.)

```bash
xvfb-run -a node scripts/screenshots/capture.mjs
```

Needs Playwright and a Chromium (both already present in this repo's dev
image; otherwise `npm i -g playwright && npx playwright install chromium`).
Not part of `npm test` or `npm run build` — it drives a browser, and nothing
shipped depends on it.

- `capture.mjs` — the driver. Launches Chromium with the real `extension/`
  loaded, walks the product through seven states, asserts the card's geometry
  and (where it matters) which branch it drew, and writes the PNGs.
- `mock-claude.html` — a mock of the DOM contract `content.js` reads. Read its
  header comment before editing: the nesting depth is load-bearing.

The seven states are walked in one continuous session, in the order they are
reached rather than in file-name order:

| # | State | File |
|---|---|---|
| 1 | the trigger, before any click | `3-trigger.png` |
| 2 | the click-only interview | `1-interview.png` |
| 3 | the composed prompt, in the message box | `2-composed.png` |
| 4 | the moves row | `6-moves.png` |
| 5 | the pencil, opened, with a rough ask typed in | `7-pencil.png` |
| 6 | the same interview, host in light mode | `4-light.png` |
| 7 | the settings page | `5-settings.png` |

## The two states that were unreachable

Both were unreachable for the same kind of reason — the harness never put the
product into the state that runs the code — and both are worth understanding
before editing the driver:

- **The moves row (`6-moves.png`).** `renderChips()` runs only when the backend
  answers with a `chips` array, and the canned worker reply was one fixed object
  with no `chips` key, so that branch had never executed under the camera. The
  canned answer is now switchable (`serve()`), and every phase states which
  answer it wants rather than inheriting the last one's — the extension caches
  suggestions per exchange in a service worker that can restart, so a phase
  relying on a cache hit for the right shape is a phase that writes the wrong
  frame the day the cache misses.

  The moves frame also needed a **new exchange**, not a re-answer of the old
  one. `background.js` keys its suggestion cache on prompt+reply, so the same
  reply can only ever produce the same card; and more to the point, moves and
  questions are answers to different kinds of reply. `__mock.addTurn()` appends
  a second exchange whose reply settles the trip instead of asking about it,
  which is what earns moves in the first place.

- **The pencil, opened (`7-pencil.png`).** `appendOwnChip()`'s `arm()` is
  reachable only by the user's own click. Nothing clicked it, so the expanded
  box had never been photographed. The driver now clicks it — checking the chip's
  label first, because the row's other `.chip.own` is the session-hide offer and
  photographing a click on that would be a quietly wrong frame — and types a
  rough ask into it. Text in the box hides the placeholder; `ROUGH_ASK = ''`
  photographs the empty box with the placeholder reading instead, and the
  placeholder is asserted either way.

## Why it works without touching the extension

Two hostnames are redirected at the network layer to one local HTTPS server:

```
claude.ai                            -> mock-claude.html
contexa-api.michu110899.workers.dev  -> canned questions / moves / composed prompt JSON
```

`--host-resolver-rules` does the redirect, a self-signed cert plus
`--ignore-certificate-errors` gets past TLS, and `--no-proxy-server` keeps this
container's egress proxy out of the path. Because the page genuinely *is*
`https://claude.ai/`, the content script injects on its own real match pattern,
and `background.js` fetches its own real baked `DEFAULT_PROXY_URL`. Nothing in
`extension/` is stubbed, patched, or copied.

What is *not* real: the page is a mock of the DOM contract, not claude.ai, and
the model output is canned. Retake against a live session before submitting —
the checklist says so and should keep saying so.

## The guard

`assertCardGeometry()` runs before every screenshot that contains a card, and
fails the whole capture rather than writing a misleading frame. It checks the
two things the layout can get wrong:

- the card is aligned with the message box (not flush against the viewport edge)
- the card sits directly above it (not adrift in dead space)

Both are the failure PR #13 shipped. To verify the guard still bites, delete
the `composer-rail` level from `mock-claude.html` and re-run: it should fail
with the card ~269px out of line.

Geometry is not the only way a frame can lie, though, and `6-moves.png` is the
frame that proves it: the moves row and the interview are two branches of one
endpoint drawn in the same card, so a dropped `chips` key or a stale suggestion
cache substitutes one for the other with nothing on screen looking broken. Two
more checks cover that class:

- `assertMoveRow()` runs before that frame and fails if the card drew the
  interview instead, naming what it found.
- `assertGrounded()` runs before the browser even starts, and fails if any
  canned question or chip quotes text that is not in the canned reply it is
  supposed to be grounded in. The canned payloads are served past the worker and
  the hosted path does not re-validate them, so this is the only thing standing
  between an edited reply and a screenshot of a chip the product would have
  dropped.

`CX_DEBUG=1` surfaces page errors, though note that Playwright does not capture
content-script `console` output — inspect the DOM if the card never appears.
