# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CONTEXA is a Chrome extension (Manifest V3) for claude.ai. When Claude finishes a reply, it offers a single trigger; clicking it reads the exchange and asks up to four short click-only questions (or offers up to four one-click "moves"), then composes a full prompt into the user's message box. Nothing is sent anywhere until the user clicks.

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

`extension/background.js` and `worker/src/index.js` each define their own copy of `QUESTIONS_SYSTEM` and `EXPAND_SYSTEM` (the two system prompts sent to Claude — one writes the questions/moves, one composes the final prompt from clicked answers). **These two copies must be byte-identical**, because a user's own-key request (extension calls Anthropic directly) and a hosted request (extension → Worker → Anthropic) must produce the same product. `build.mjs` extracts both copies by regex and fails the build if they differ, along with several related checks: the `CAPABILITY-AUDIT` date comment must match between both files (a staleness marker for prompt exemplars describing product capabilities); the shipped model name must agree across `background.js`, `worker/src/index.js`, and `worker/wrangler.toml`; and `LEGACY_STEPS_SYSTEM` (see below) must exist *only* in the worker, never copied into the extension.

If you edit either system prompt, edit both files identically and run `npm run build` to verify before committing.

### Client/worker schema negotiation (three generations)

The worker serves three extension generations from one endpoint, because the Chrome Web Store approves updates on its own schedule — there's no deploy order that avoids a window where old and new clients hit the same worker simultaneously:

- **Pre-0.9.30 clients** send no `v` field. The worker answers with `LEGACY_STEPS_SYSTEM` (worker-only, frozen, one step, old `{"steps":[...]}` wire shape). Never touch this prompt for new work — it exists solely to not break installs that can't update themselves.
- **0.9.30+ clients** send `v: <extension version>` and get the current `QUESTIONS_SYSTEM` (`{"questions":[...],"assume":[...]}`).
- **0.9.52+ clients** additionally send `accepts: ['chips']` and may get `{"chips":[...]}` back instead of questions, when the reply left something worth doing that needs nothing from the user.

`wantsQuestions()` and `wantsChips()` in `worker/src/index.js` implement this. When adding a new capability that changes the wire shape, follow this pattern (an explicit opt-in field the client sends) rather than a version-string comparison.

### Hosted vs. own-key paths must behave identically

Every request path exists twice — once in `extension/background.js` (calls Anthropic directly when the user has set their own API key) and once in `worker/src/index.js` (hosted/proxied, quota-enforced). The cleaning/validation functions that police model output (`cleanAssume`, `cleanChips`, `cleanOptions`, the evidence-grounding filter that drops any step/question without a verbatim quote from the reply) are duplicated across both files and **must stay behaviorally identical** — comments in the code call this out explicitly at each duplication. When fixing a bug in one, check the other.

### Content script flow (`extension/content.js`)

Capture is eager; the model call is not. On every completed reply (detected via claude.ai's `[data-is-streaming]` attribute flipping to `false`, with a 1.2s settle-timer fallback if that attribute ever moves), the content script captures the user's last message and Claude's reply from the DOM — cheap, and the DOM is settled at that moment — but renders only a single inert trigger chip. Nothing is sent until the user clicks it (`askNow`). This is a deliberate cost/privacy trade (see `CHANGELOG.md`, 0.9.53): a reply nobody asks about costs nothing and never leaves the page.

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

- **Zero is a valid outcome.** No floor, no fallback suggestion, no minimum question/chip count. A reply that settles everything gets a quiet row, not a padded one.
- **Never fake output.** Degraded states (quota hit, parse failure, network error) say what actually happened; there is no canned-suggestion fallback.
- **The interview is click-only.** A question that can't be reduced to 2–4 concrete options is dropped, not turned into a free-text field.
- **Every question/chip/step must be evidence-grounded** — earned by a verbatim quote from Claude's reply, checked server-side (and client-side on the own-key path) before it ever reaches the UI.
