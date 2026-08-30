# scripts/screenshots

Two drivers, one shared library. They produce the same kinds of frame; what
differs is what is on the other end of the wire.

| | `capture.mjs` | `capture-live.mjs` |
|---|---|---|
| claude.ai is | `mock-claude.html` | the real site |
| model output is | canned | real |
| costs | nothing | real messages + 3–5 CONTEXA calls |
| needs auth | no | **yes** — a logged-in claude.ai session |
| needs a human | no | **yes**, for the first launch |
| reproducible | yes, near byte-for-byte | no, never |
| writes to | `publishing/screenshots/` | `publishing/screenshots/live/` |

```bash
xvfb-run -a node scripts/screenshots/capture.mjs        # mock, free, anywhere
node scripts/screenshots/capture-live.mjs --preflight    # live: session + selector check, spends nothing
node scripts/screenshots/capture-live.mjs                # live: the full run
```

`CX_OUT=<dir>` redirects either driver's output. Use it to verify a change
without overwriting frames someone has already approved:

```bash
CX_OUT=/tmp/shots xvfb-run -a node scripts/screenshots/capture.mjs
```

Needs Playwright and a Chromium (both already present in this repo's dev
image; otherwise `npm i -g playwright && npx playwright install chromium`).
Neither driver is part of `npm test` or `npm run build` — they drive a browser,
and nothing shipped depends on them.

- `lib.mjs` — the shared half: finding Playwright, the frame size, the mirror of
  `content.js`'s selectors, and the assertions. **The mock harness is what keeps
  this file honest** — it is deterministic and free, so after any change here,
  run it and confirm the seven frames still come out.
- `capture.mjs` — the mock driver. Launches Chromium with the real `extension/`
  loaded, walks the product through seven states, asserts the card's geometry
  and (where it matters) which branch it drew, and writes the PNGs.
- `capture-live.mjs` — the live driver. See "The live driver" below before
  running it; it is neither free nor unattended.
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

## The live driver

`capture-live.mjs` answers the standing ⚠️ in `PUBLISHING-CHECKLIST.md` Phase 5.
The mock frames are honest about the product's behaviour and layout; they are
not evidence that the pinned selectors still match claude.ai today, and a
reviewer compares screenshots against the real thing. Only a live run settles
either.

**Read this before running it. It is not free and not unattended.**

- It sends **real messages in your real claude.ai account**, in whatever
  conversation is open. Start it on a **new chat**.
- It spends **3 CONTEXA calls** on a clean run, up to **5** if the moves row
  needs its retries, out of the 40/device/day limit in `worker/src/index.js`.
- Model output is real, so **no two runs produce the same frames**. The
  assertions decide whether a frame is *honest*; only your eye decides whether
  it is *good*.
- Output goes to `publishing/screenshots/live/` (gitignored), never straight
  over the approved set. **Promote by hand, after looking.**

### Where it has to run, and why not here

The container this repo's agent sessions run in cannot do it, for two separate
reasons — both checked, August 2026:

1. **No claude.ai session exists there.** No cookie, no profile, no credential
   file. The Claude Code session tokens that *are* present authenticate that
   session to Anthropic's Claude Code backend, not the claude.ai web app, and an
   `ANTHROPIC_API_KEY` would not help either — it authenticates
   `api.anthropic.com`, and this needs a logged-in *web* session because
   `content.js` only injects on `https://claude.ai/`.
2. **Cloudflare challenges it.** Contrary to what `capture.mjs`'s comment used
   to claim, the egress proxy relays claude.ai fine — `CONNECT` succeeds with no
   policy denial. The 403 comes from claude.ai's own edge (`server: cloudflare`,
   `cf-mitigated: challenge`): bot mitigation answering an automated client on a
   datacenter IP.

So a session cookie alone would not be enough there. **There is no bypass in
this script and none should be added.** The legitimate way past that gate is to
be a person on their own machine — which is the setup the driver assumes, and
where none of it applies.

### Running it

1. Set your claude.ai appearance to **Dark**. The driver asserts
   `<html data-mode="dark">` and refuses otherwise, rather than forcing it —
   `content.js` treats `data-mode` as authoritative, so forcing it would
   photograph a dark card on a light page.
2. `node scripts/screenshots/capture-live.mjs --preflight` first. It opens the
   browser, waits for you to log in and clear any Cloudflare check, prints which
   selectors matched, and stops. **Sends nothing, spends nothing.** The login
   is stored in `.live-profile/`, so later runs skip it.
3. Open a **new chat**, then run without `--preflight`.

The selector report from step 2 is worth reading on its own — it is the half of
the ⚠️ that is about the extension breaking rather than about listing honesty,
and it costs nothing to check every release.

### What it captures, and the two live-only hazards

Five frames: `3-trigger`, `1-interview`, `2-composed`, `6-moves`, `7-pencil`.
Not `4-light` (a second full run with the account flipped to light) and not
`5-settings` (the real options page, no claude.ai involved — the mock harness
already captures it honestly).

**The moves row is the one frame the model controls.** You cannot tell whether a
reply settled things without clicking CONTEXA — that click *is* what produces
moves-or-questions — so each attempt costs a message and a call. If the reply
asks instead of settling, the driver nudges with *"Looks great, lock it in —
don't ask me anything else…"* and tries again, **three attempts maximum**. On
exhaustion it stops and reports rather than continuing to spend; every frame
captured before that point is written and good.

**The pencil frame is photographed empty**, placeholder showing — the reverse of
the mock set, because the placeholder is the instruction and a store frame
should carry it. That makes it fragile in a way it never was on the mock: an
empty rough-ask box collapses back to a chip on blur (`arm()` in
`appendOwnChip`), and the live site manages focus on its own composer. So the
driver clicks the pencil **last**, scrolls only by setting `scrollTop` (never
the keyboard, never a click), shoots with no settle delay, and asserts the box
is still open on both sides of the shutter. A collapse is a detectable retry,
and retrying is free — opening the box makes no call, only submitting does, and
it never submits.

## Why the mock driver works without touching the extension

Two hostnames are redirected at the network layer to one local HTTPS server.
**None of this exists in `capture-live.mjs`** — no redirect, no local server, no
self-signed cert, real DNS and real TLS — and that difference is the whole
reason there are two files:

```
claude.ai                            -> mock-claude.html
contexa-api.michu110899.workers.dev  -> canned questions / moves / composed prompt JSON
```

`--host-resolver-rules` does the redirect, a self-signed cert plus
`--ignore-certificate-errors` gets past TLS, and `--no-proxy-server` keeps any
egress proxy out of the path. Because the page genuinely *is*
`https://claude.ai/`, the content script injects on its own real match pattern,
and `background.js` fetches its own real baked `DEFAULT_PROXY_URL`. Nothing in
`extension/` is stubbed, patched, or copied.

What is *not* real: the page is a mock of the DOM contract, not claude.ai, and
the model output is canned. Retake against a live session before submitting —
the checklist says so and should keep saying so.

## The guards

These live in `lib.mjs` and run on **both** drivers — the live frames are the
ones nobody can re-render to check, so they need them more, not less.

`assertCardGeometry()` runs before every screenshot that contains a card, and
fails the whole capture rather than writing a misleading frame. It finds the
composer the way `content.js`'s `findComposer()` does — first selector in
`COMPOSER_SELECTORS` matching anything visible, largest match wins — rather than
by an id only the mock has, so it measures the card against the same element
`content.js` mounted it beside on either page. It checks the
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
- `assertGrounded()` (mock only — the live model's own output is already
  gated by the worker) runs before the browser even starts, and fails if any
  canned question or chip quotes text that is not in the canned reply it is
  supposed to be grounded in. The canned payloads are served past the worker and
  the hosted path does not re-validate them, so this is the only thing standing
  between an edited reply and a screenshot of a chip the product would have
  dropped.
- `assertOwnInputOpen()` brackets the pencil frame on both drivers. On the mock
  it is cheap insurance; live it is load-bearing, for the blur reason above.

`CX_DEBUG=1` surfaces page errors, though note that Playwright does not capture
content-script `console` output — inspect the DOM if the card never appears.
