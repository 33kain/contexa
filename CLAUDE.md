# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CONTEXA is a Chrome extension (Manifest V3) for claude.ai. When Claude finishes a reply, it offers a single trigger; clicking it reads the user's own messages from the whole session and offers up to four **independent** next moves, each already a complete, send-ready prompt. Clicking one composes it into the message box. Nothing is sent anywhere until the user clicks, and clicking a move costs no further model call.

Two independently versioned artifacts ship from this repo:

- `extension/` — the Chrome extension. Version lives in `extension/manifest.json`.
- `worker/` — a Cloudflare Worker that proxies to Anthropic for users without their own API key (enforces daily quotas, holds the real API key as a secret). Version is the `BUILD` constant in `worker/src/index.js`.

They deploy on separate paths on purpose (a worker fix shouldn't force a Chrome Web Store resubmission), but **share a byte-identical system prompt** — see Architecture below.

## Commands

No dependencies to install anywhere in this repo (no `node_modules`, no bundler) — everything runs on plain Node.

```bash
npm test                 # both test suites (extension + worker)
npm run test:extension   # extension/test.mjs only
npm run test:worker      # worker/test.mjs only
npm run build            # node build.mjs — see below
```

Each `test.mjs` is a single flat script (no test framework, no per-test filtering) that prints `ok`/`FAIL` per assertion and exits non-zero on any failure. To run just one check while iterating, open the relevant `test.mjs` and comment out the surrounding block, or grep the console output — there's no `--filter` flag.

`npm run build` (`build.mjs`) takes `extension/` (the canonical source) and produces `build-ready/` — a shippable copy with the real backend URL and version baked in, plus a `.zip` for the Chrome Web Store. It also **fails the build** (not just a lint warning) on several invariant violations that have each caused a real regression before — see Architecture. Run it after touching anything the checks below depend on.

The Cloudflare Worker has no build step; deployment is `npx wrangler deploy` from `worker/` (needs Cloudflare credentials — see `worker/README.md`). CI (`.github/workflows/ci.yml`) runs all three `npm` scripts above on every push to `main` and every PR.

## Architecture

### The shared prompt is the load-bearing contract

`extension/background.js` and `worker/src/index.js` each define their own copy of `MOVES_SYSTEM` — the one system prompt sent to Claude. **These two copies must be byte-identical**, because a user's own-key request (extension calls Anthropic directly) and a hosted request (extension → Worker → Anthropic) must produce the same product. `build.mjs` extracts both by regex and fails the build if they differ, along with several related checks: the request's `SESSION SO FAR:` section labels must match on both sides; the `cleanTurns` / `cleanMoves` / `groundMoves` helper block must be byte-identical; the extension must still capture the session (`turns: captureTurns()`), without which every request is refused; and the shipped model name must agree across `background.js`, `worker/src/index.js`, and `worker/wrangler.toml`.

If you edit the system prompt, edit both files identically and run `npm run build` to verify before committing. The prompt is written once in a scratch file and injected into both, which is why they are byte-identical by construction rather than by discipline.

### One shape, and what that replaced

There is one request shape and one response shape. The worker takes `{ reply, turns[] }` and returns `{ moves: [{label, text, evidence}], grounding, quota }`. A request with no turns is refused before either quota is charged.

This was not always so. Until 0.9.58 the worker served three extension generations from one endpoint, negotiated by a `v` field and an `accepts: [...]` capability list, because the Chrome Web Store approves updates on its own schedule and no deploy order avoids a window where old and new clients hit the same worker. That machinery — `LEGACY_STEPS_SYSTEM`, `QUESTIONS_SYSTEM`, `EXPAND_SYSTEM`, `wantsQuestions()`, `wantsChips()`, `/v1/expand` — was deleted in the history-mining pivot, on the explicit basis that there is no installed base to protect.

**If that ever stops being true, the `accepts: [...]` opt-in is the pattern to bring back** — an explicit capability field the client announces, never a version-string comparison, which puts `"0.9.9"` above `"0.9.54"`. `CHANGELOG.md` 0.9.31 records what the alternative cost.

### Hosted vs. own-key paths must behave identically

Every request path exists twice — once in `extension/background.js` (calls Anthropic directly when the user has set their own API key) and once in `worker/src/index.js` (hosted/proxied, quota-enforced). The functions that police model output — `cleanTurns`, `cleanMoves`, `groundMoves`, plus `trimPayload` — are duplicated across both files and **must stay behaviorally identical**. The first three are written once and injected into both, and `build.mjs` asserts byte-identity; the rule they inherit is that a gate living only in the worker is a gate half the users do not have. When fixing a bug in one, check the other.

Evidence grounding runs over **the turns and the reply together**, not the reply alone. Ideas are mined from the session, so a move earned by the first turn stating the goal is grounded. Two tiers: no evidence at all is dropped, a near-miss quote renders but is counted and logged.

### Content script flow (`extension/content.js`)

Reply capture is eager; the session read and the model call are not. On every completed reply (detected via claude.ai's `[data-is-streaming]` attribute flipping to `false`, with a 1.2s settle-timer fallback if that attribute ever moves), the content script captures Claude's reply from the DOM — cheap, and the DOM is settled at that moment — but renders only a single inert trigger chip. Nothing is sent until the user clicks it (`askNow`), and the session itself (`captureTurns()`) is read at that point rather than earlier: it is the larger read, and by then the user has asked for it. This is a deliberate cost/privacy trade (see `CHANGELOG.md`, 0.9.53): a reply nobody asks about costs nothing and never leaves the page.

`captureTurns()` enumerates every `[data-testid="user-message"]` in the page. The drop policy is in `fitTurns()`, kept separate because it is the half with a wrong answer that still looks right: turn one is **pinned** (it states the goal), oldest *middle* turns go first, and the floor is two. A window that kept the last *n* turns would test perfectly and silently decapitate every long session.

DOM selectors for claude.ai's own elements (composer, response body, streaming flag, user message) are pinned constants at the top of the file (`SELECTORS`, `RESPONSE_SEL`, `STREAM_SEL`, `USER_MSG_SEL`, `ROW_SEL`). If claude.ai's structure changes, the extension is designed to go quiet rather than break the host page — it never assumes a positive match.

Everything the model returns renders through `document.createElement` + `.textContent`/`.title` (never `innerHTML` with interpolated data) — this is deliberate given the content is AI-generated text rendered into a third-party page.

### Repo layout

```
extension/        the product (Chrome extension, MV3)
worker/            the hosted backend (Cloudflare Worker)
publishing/        Chrome Web Store listing copy, privacy policy, screenshots
store-assets/      store listing images + mascot brand source assets
scripts/           dev/release tooling (release-commit, dogfood-test, reproduce-test)
scripts/archive/   one-off scripts from closed investigations — not part of the workflow
docs/archive/      shipped planning docs and specs, kept for provenance only
```

Anything under an `archive/` folder describes finished work, not pending work — treat its content as history, not as a to-do list (each has its own `README.md` explaining what it holds).

## Design principles worth knowing before changing behavior

From `README.md`'s "Design notes" — these are deliberate, not oversights:

- **Zero is a valid outcome.** No floor, no fallback move, no minimum count. A session with nothing open gets no row at all, not a padded one. Note this is stronger than it used to be: the old quiet row still drew a labelled shell, and the fifth chip caught the case where a click returned nothing. Both are gone, so a click that mines nothing now shows nothing — **the open question the field test exists to answer is how often that fires.**
- **Never fake output.** Degraded states (quota hit, parse failure, network error) say what actually happened; there is no canned-suggestion fallback.
- **Clicking is the only input.** There is no free-text box anywhere in the product — the row of moves is the only path into the message box. Material the user must supply becomes a `<paste here>` slot inside the written prompt.
- **Every move must be evidence-grounded** — earned by a verbatim quote from the session or the reply, checked server-side (and client-side on the own-key path) before it ever reaches the UI.
- **Moves are independent by definition.** Each stands alone as a complete request; clicking one discards the rest. Within one move the opposite rule holds — one ask, one imperative verb — and the two are not in tension: the row is a menu, each item is a single job.
