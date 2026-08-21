# SPEC 0.9.23 — the fifth chip ("make bad prompts good")

Owner decisions locked 2026-08-21: build and ship ASAP · expansion sees
intent + last exchange · open blanks become visible slots + Assume lines.
Prompt text: TRAIN-EXPAND-0.9.23.md §1 (final draft).

## 0. Ship plan — one review cycle, clean friend week

1. Code lands against real v0.9.22 sources (see §7 Blockers), both suites
   green, build.mjs → 0.9.23.
2. **Deploy the worker first.** Adding `/v1/expand` is backward-compatible —
   0.9.22 clients never call it, so the worker can go live days early.
3. Chrome Web Store: **Cancel the pending 0.9.22 review** (three-dot → Cancel
   review; its manifest copy changes ride along in 0.9.23), upload
   contexa-v0.9.23.zip, submit once.
4. When it clears: install store copy, disable unpacked, send FRIEND-MESSAGE
   (with the third feedback question added). Friends test the full product
   from day one — no mid-week migration, no contaminated data.
5. CHANGELOG gets its owed 0.9.22 entry plus 0.9.23 in the same touch.

## 1. UI (content.js, shadow DOM)

- Idle: one extra chip at the END of the row, visually distinct (dashed
  border, pencil glyph). Copy draft: `✎ Rough ask…` (≤4 words rule).
  v1 renders it whenever the row renders; standalone-on-error is a later
  decision.
- Click → chip becomes an inline input (min-width ~220px), placeholder
  draft: `Type it rough — I'll write it properly`. Cap input at 300 chars.
- **Keyboard isolation (trap #1):** stopPropagation on keydown/keyup/
  keypress/input inside the shadow input so claude.ai hotkeys and the
  composer never see the keystrokes.
- Enter → submit; Esc or blur-empty → collapse to idle chip.
- In-flight: input swaps to a small spinner + "writing…" (honest 2–4s
  state; no fake progress).
- Success: expansion loads the composer via the SAME insertion path the
  other chips use, composer focused, chip collapses to idle. Never sends.
- Failure: existing renderQuiet path with resp + detail (unchanged voice).
- No cache for expansions (typed intents don't repeat; skip stepsCache).

## 2. Extension backend (background.js)

- New message type `expandPrompt` {intent, prompt, reply}.
- Own-key path: callClaude(EXPAND_SYSTEM, sections, EXPAND_MAX_TOKENS) with
  the SAME thinking-disable + model-agnostic 400-retry loop as next-steps.
- Hosted path: POST {proxy}/v1/expand, same device token header.
- `refineExpansion(parsed)`: object with string `prompt` → trim, strip
  accidental code fences, hard cap 900 chars (700 is the prompt-side soft
  target), reject empty → `bad_response`. Mirror in worker.
- Message sections (must match worker byte-for-byte):
  `ROUGH ASK:\n…\n\nTHEIR LAST MESSAGE:\n…\n\nCLAUDE'S REPLY:\n…`
  using the existing slices (prompt 2500, reply 6000 incl. capture marker).

## 3. Worker (worker/src/index.js)

- `EXPAND_SYSTEM` constant, byte-identical to background's (build.mjs
  enforcement extended to BOTH prompts — trap #2).
- Route `POST /v1/expand`: same gate order as next-steps — origin pin →
  body validation (intent required, 1–300 chars; prompt/reply optional
  strings) → device quota (SAME 20/day counter, one pool) → IP cap →
  upstream. **No spend before gates.**
- `EXPAND_MAX_TOKENS = 1200` (one prompt, fat Sonnet-5 tokenizer headroom).
- Same upstream retry-without-thinking on 400, same tail-only error logging,
  same 429 shape {limit, resetsAt}, same CORS echo.
- Response: `{prompt, build}`; errors identical in shape to next-steps.

## 4. Tests (both suites grow — test the joints)

Worker: route exists · forbidden_origin on /v1/expand · intent length
rejects (0, 301) · quota pool SHARED (next-steps then expand → counter 2) ·
no-spend-before-gates on the new route · thinking-400 retry fires ·
upstream JSON validated · 700/900 caps.
Extension (vm harness + fake DOM): expandPrompt routing both paths ·
refineExpansion cases (fences, empty, overlong) · keyboard isolation (event
dispatched in input does not reach document) · Enter→request→insert joint ·
Esc collapse · error path renders detail · idle chip renders at row end.
build.mjs: dual prompt identity; version tri-agreement unchanged.

## 5. Copy & listing (later touch)

LISTING.md gains the motto ("Make bad prompts good") and one privacy line:
typed rough asks travel the same path captured conversation already does.
No new permissions, no manifest change beyond version.

## 6. Pre-ship verification (design-review item #4, now blocking)

Before 0.9.23 ships: confirm what the shared insertion path does when the
composer already holds text. If it replaces, change insertion to refuse or
append for BOTH chip kinds — this feature ends in an insert, so a data-loss
insert would ship twice as often. Answered by reading real content.js.

## 7. Blockers (everything above §5 is written, not placed)

ONE hard blocker: current v0.9.22 sources. The sandbox rolled back to
pre-0.9.15 code. Channels, in preference order: bridge staging when the
desktop app is next open · paste-block · a git URL I can clone. The moment
sources land, code + tests + build land same-day.
