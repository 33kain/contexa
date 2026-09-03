# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CONTEXA is a Chrome extension (Manifest V3) for claude.ai. When Claude finishes a reply, it offers a single trigger; clicking it reads the user's own messages from the whole session and offers up to four **independent** next moves, each already a complete, send-ready prompt. Clicking one composes it into the message box. Nothing is sent anywhere until the user clicks, and clicking a move costs no further model call.

Two artifacts ship from this repo:

- `extension/` — the Chrome extension. The version number's single home is `extension/manifest.json`.
- `worker/` — a Cloudflare Worker that proxies to Anthropic for users without their own API key (enforces daily quotas, holds the real API key as a secret). It carries the same number in the `BUILD` constant in `worker/src/index.js`, which `/v1/health` reports so a deploy can be told from a no-op.

They deploy on separate paths on purpose (a worker fix shouldn't force a Chrome Web Store resubmission), but they ship **one product per generation**: `build.mjs` fails if `BUILD` and the manifest version disagree, and they **share a byte-identical system prompt** — see Architecture below. (`CHANGELOG.md`'s header still says the two numbers are "free to diverge"; the build guard is the current rule.)

A third, unrelated deploy exists: `publishing/website/` is a static product site pushed to Cloudflare Pages by `.github/workflows/deploy-pages.yml` whenever it changes on `main`. It touches neither `extension/` nor `worker/`.

## Commands

No dependencies to install anywhere in this repo (no `node_modules`, no bundler) — everything runs on plain Node.

```bash
npm test                 # both test suites (extension + worker)
npm run test:extension   # extension/test.mjs only
npm run test:worker      # worker/test.mjs only
npm run build            # node build.mjs — see below
```

Each `test.mjs` is a single flat script (no test framework, no per-test filtering) that prints `ok`/`FAIL` per assertion and exits non-zero on any failure. To run just one check while iterating, open the relevant `test.mjs` and comment out the surrounding block, or grep the console output — there's no `--filter` flag.

`npm run build` (`build.mjs`) takes `extension/` (the canonical source) and produces `build-ready/` (git-ignored) — a shippable copy with the real backend URL and version baked in, plus a `.zip` for the Chrome Web Store. It also **fails the build** (not just a lint warning) on several invariant violations that have each caused a real regression before — see Architecture. Run it after touching anything the checks below depend on.

The Cloudflare Worker has no build step; deployment is `npx wrangler deploy` from `worker/` (needs Cloudflare credentials — see `worker/README.md`). CI (`.github/workflows/ci.yml`) runs all three `npm` scripts above on every push to `main` and every PR.

## Architecture

### The shared prompt is the load-bearing contract

`extension/background.js` and `worker/src/index.js` each define their own copy of `MOVES_SYSTEM` — the one system prompt sent to Claude. **These two copies must be byte-identical**, because a user's own-key request (extension calls Anthropic directly) and a hosted request (extension → Worker → Anthropic) must produce the same product. `build.mjs` extracts both by regex and fails the build if they differ, along with several related checks:

- the request's `SESSION SO FAR:` section labels must match on both sides;
- the injected helper block — from `function cleanTurns` through `groundMoves`, `tallySources`, `ACTION_OPENERS` and `enforceAction`, up to the `/* end of the injected helper block` sentinel comment — must be byte-identical (do not delete that sentinel; it is the end anchor);
- the extension must still capture the session (`captureTurns()` inside `askNow`), without which every request is refused;
- the shipped model name must agree across `background.js`, `worker/src/index.js`, and `worker/wrangler.toml`, and the worker's `BUILD` must equal the manifest version;
- the model-default freeze guards: `DEFAULTS.model` in `options.js` and `background.js` must be `''` (a stored concrete model once froze installs on Haiku), the options page must not backfill an empty model field with the default, and the shipped model must not also appear in `SUPERSEDED_MODEL_DEFAULTS`.

If you edit the system prompt, edit both files identically and run `npm run build` to verify before committing. The prompt is written once in a scratch file and injected into both, which is why they are byte-identical by construction rather than by discipline.

### One shape, and what that replaced

There is one request shape and one response shape. The worker takes `{ reply, turns[] }` and returns `{ moves: [{label, text, evidence}], grounding, quota }`. A request with no turns is refused before either quota is charged.

This was not always so. Until 0.9.58 the worker served three extension generations from one endpoint, negotiated by a `v` field and an `accepts: [...]` capability list, because the Chrome Web Store approves updates on its own schedule and no deploy order avoids a window where old and new clients hit the same worker. That machinery — `LEGACY_STEPS_SYSTEM`, `QUESTIONS_SYSTEM`, `EXPAND_SYSTEM`, `wantsQuestions()`, `wantsChips()`, `/v1/expand` — was deleted in the history-mining pivot, on the explicit basis that there is no installed base to protect.

**If that ever stops being true, the `accepts: [...]` opt-in is the pattern to bring back** — an explicit capability field the client announces, never a version-string comparison, which puts `"0.9.9"` above `"0.9.54"`. `CHANGELOG.md` 0.9.31 records what the alternative cost.

### Hosted vs. own-key paths must behave identically

Every request path exists twice — once in `extension/background.js` (calls Anthropic directly when the user has set their own API key) and once in `worker/src/index.js` (hosted/proxied, quota-enforced). The functions that police model output — `cleanTurns`, `cleanMoves`, `groundMoves`, `enforceAction`, plus `trimPayload` — are duplicated across both files and **must stay behaviorally identical**. All but `trimPayload` live in the injected helper block that `build.mjs` asserts byte-identical; the rule they inherit is that a gate living only in the worker is a gate half the users do not have. When fixing a bug in one, check the other.

Two gates run on every row, in order:

1. **Evidence grounding** (`groundMoves`) runs over **the turns and the reply as two separate haystacks**, not one concatenated corpus, and records per move which one earned it (`sources`, tallied as `fromTurns` / `fromReply`). Ideas are mined from the session, so a move earned by the earliest turn is grounded; the turns are checked first so the session's own material is never credited to the reply. Two tiers: no evidence at all is dropped, a near-miss quote renders but is counted and logged.
2. **Action gate** (`enforceAction`) drops any move whose label does not open with a doable imperative verb from the `ACTION_OPENERS` allowlist (English and Serbian). It fails **closed** — an unknown verb is a drop — so a row of non-English labels can be emptied by the verb list rather than by the model. The content script tells these two causes of an empty row apart (see below).

### Content script flow (`extension/content.js`)

Reply capture is eager; the session read and the model call are not. On every completed reply (detected via claude.ai's `[data-is-streaming]` attribute flipping to `false`, with a 1.2s settle-timer fallback if that attribute ever moves), the content script captures Claude's reply from the DOM — cheap, and the DOM is settled at that moment — but renders only a single inert trigger chip (the mascot). Nothing is sent until the user clicks it (`askNow`), and the session itself (`captureTurns()`) is read at that point rather than earlier: it is the larger read, and by then the user has asked for it. This is a deliberate cost/privacy trade (see `CHANGELOG.md`, 0.9.53): a reply nobody asks about costs nothing and never leaves the page.

`captureTurns()` enumerates every `[data-testid="user-message"]` in the page. The drop policy is in `fitTurns()`, kept separate because it is the half with a wrong answer that still looks right: the first captured turn is **pinned** (it is the closest thing to a stated goal), oldest *middle* turns go first, and the floor is two. A window that kept the last *n* turns would test perfectly and silently decapitate every long session.

**Known limit, and its direction matters.** A virtualised transcript only has its rendered rows in the DOM, so on such a page the capture sees the tail, not the whole conversation — truncation from the *head*, the opposite direction from `fitTurns`, and the one this feature depends on. The turn numbers `[i]` are capture positions, not conversation positions; nothing downstream may treat `[1]` as proof of the session's start (0.9.58 shipped that assumption and the moves came back reflecting only the last exchange). `MOVES_SYSTEM` therefore says "the earliest message you can see", and `askNow` logs the turn count and `i` range so a contiguous `1..4` on a long conversation can be recognised as a truncated read.

**An empty row has two causes and they must not look alike.** The model can honestly earn nothing, or the action gate can drop every move it returned. Until 0.9.64 both drew the same card. Now the grounding result carries `total` (moves before any gate), and `renderNothing` is told which gate emptied the row, so a gate eating a good row never wears the costume of an honest zero. The "nothing" card is inert — no pointer events — because an element that looks clickable would be a floor.

DOM selectors for claude.ai's own elements (composer, response body, streaming flag, user message, per-turn row, chrome text to skip) are pinned constants near the top of the file (`SELECTORS`, `RESPONSE_SEL`, `STREAM_SEL`, `USER_MSG_SEL`, `ROW_SEL`, `SKIP_SEL`). If claude.ai's structure changes, the extension is designed to go quiet rather than break the host page — it never assumes a positive match.

Everything the model returns (labels, texts, evidence) renders through `document.createElement` + `.textContent`/`.title`. The few `innerHTML` writes in the file carry only static markup owned by the extension (the row shell, the mascot SVG, the quiet card), and the one interpolated value there, the error card's text, goes through the `esc()` helper first. Keep it that way: never interpolate model output or page text into `innerHTML` — this is AI-generated text rendered into a third-party page.

### Repo layout

```
extension/            the product (Chrome extension, MV3)
worker/               the hosted backend (Cloudflare Worker)
build.mjs             extension/ -> build-ready/ + store zip, plus the invariant checks above
publishing/           Chrome Web Store listing copy, privacy policy, screenshots, submission notes
publishing/website/   the static product site (deployed to Cloudflare Pages by deploy-pages.yml)
store-assets/         store listing images, promo tiles, mascot brand source assets
scripts/              dev/release tooling (release-commit, dogfood-test, reproduce-test)
scripts/screenshots/  regenerates publishing/screenshots/ by driving the real extension against a mock claude.ai DOM (Playwright + Xvfb; not part of the test suite)
scripts/promo/        renders the store promo tiles into store-assets/ from an HTML source
scripts/archive/      one-off scripts from closed investigations — not part of the workflow
docs/history-mining-audit.md   the pre-pivot audit, annotated with what was overruled afterwards
docs/archive/         shipped planning docs and specs, kept for provenance only
```

Root-level `LISTING.md`, `SUBMISSION.md` and `SETUP-FOR-FRIENDS.md` are thin pointers or user-facing install notes; the live listing copy is `publishing/STORE-LISTING.md`.

Anything under an `archive/` folder describes finished work, not pending work — treat its content as history, not as a to-do list (each has its own `README.md` explaining what it holds).

## Design principles worth knowing before changing behavior

From `README.md`'s "Design notes" — these are deliberate, not oversights:

- **Zero is a valid outcome.** No floor, no fallback move, no minimum count, and no ceiling either. A session with nothing open gets no row at all, not a padded one. Note this is stronger than it used to be: the old quiet row still drew a labelled shell, and the fifth chip caught the case where a click returned nothing. Both are gone, so a click that mines nothing now shows nothing — **the open question the field test exists to answer is how often that fires**, which is why the empty card must say *which* of the two causes above produced it.
- **Never fake output.** Degraded states (quota hit, parse failure, network error) say what actually happened; there is no canned-suggestion fallback.
- **Clicking is the only input.** There is no free-text box anywhere in the product — the row of moves is the only path into the message box. Material the user must supply becomes a `<paste here>` slot inside the written prompt.
- **Every move must be evidence-grounded** — earned by a verbatim quote from the session or the reply, checked server-side (and client-side on the own-key path) before it ever reaches the UI. A perfect quote is not proof of a good row: a row transcribed from the reply's own list of options grounds flawlessly, and `MOVES_SYSTEM` names that as the most seductive failure — the reply is material, never the subject, and once a session has more than a couple of turns at least one move must be earned by something the user wrote.
- **Moves are independent by definition.** Each stands alone as a complete request; clicking one discards the rest. Within one move the opposite rule holds — one ask, one imperative verb — and the two are not in tension: the row is a menu, each item is a single job.
