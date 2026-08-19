# Changelog

Versions are per-artifact. The **extension** version is `manifest.json`; the
**backend** version is `BUILD` in `worker/src/index.js`. They deploy on separate
paths — a worker fix must not force a Chrome Web Store resubmission — so they are
free to diverge, and the settings page labels them separately for that reason.

---

## Extension 0.9.9 — Backend 0.9.9

### Fixed: a shipped default could only ever reach a user once

The settings page backfilled an empty Model field with the current default and
persisted it. From that moment the install was frozen: `chrome.storage.local`
held a concrete model, and `DEFAULTS` only fills keys that are *missing*, so
every later default change was silently ignored.

Consequence: an install configured during the Haiku era kept calling
`claude-haiku-4-5` after the default moved to Sonnet 5 — through nine versions,
undetected. It surfaced only because a user read the field aloud.

- An untouched Model field now stores `''`, and the model resolves at call time as
  `stored || SHIPPED_MODEL`, so future default changes reach existing installs.
- A one-time migration clears any stored value matching a former default
  (`SUPERSEDED_MODEL_DEFAULTS`), while a deliberately chosen model survives.
  Storage cannot distinguish "typed haiku on purpose" from "left it blank and we
  saved the default" — the information was never recorded — so the migration
  matches only exact former defaults, on the reasoning that nobody types the value
  that was already the default.
- `build.mjs` fails the build if either `DEFAULTS` seeds a concrete model or the
  save handler backfills an empty field. Verified by reintroducing the bug and
  confirming the build refuses.

### Fixed: /v1/health was cacheable, so it could report a stale build as live

A successful deploy read as a failed one because an intermediary served a cached
health body. An endpoint whose only job is reporting what is deployed must never
come from a cache. All JSON responses now send `cache-control: no-store`.

### Added: both versions and the active path are now stated, not inferred

- `/v1/health` returns `version` and `model`. Previously a deploy could only be
  confirmed by triggering a real reply and reading the output.
- Settings shows the extension version next to the title.
- **Test connection** names which service answered. It has always had two
  branches — own key straight to Anthropic, or the hosted backend — and reported
  a bare check mark for both. An own-key install therefore looked like a verified
  backend while never having contacted it.
- A backend that is reachable but has no API key configured now reports that,
  rather than showing a green check for something that fails every request.

### Added: build and test tooling

- `build.mjs` turns `extension/` into `build-ready/` plus a store-ready zip:
  bakes the backend URL, pins the exact host instead of a `*.workers.dev`
  wildcard, sets the version, and writes the archive with `manifest.json` at the
  root — the wrapper-folder mistake Chrome rejects. The zip is written in pure
  Node with a fixed timestamp: Windows ships neither `zip` nor `unzip`, and the
  archive is verified by reading it back rather than trusting the writer.
  Byte-reproducible across builds.
- It also fails on **prompt drift** between the extension and worker copies of
  `NEXT_STEPS_SYSTEM`. Those had been kept identical by hand across nine
  versions; if they diverge, hosted and own-key users get different products.
- `worker/test.mjs` — 14 checks, no network, no Cloudflare account. Asserts that
  quota-exhausted, oversized, short-reply, bad-token, originless and unconfigured
  requests all reject with **zero** upstream calls.
- `extension/test.mjs` — 12 checks. Loads `background.js` in a sandbox with a
  fake `chrome` and `fetch` to prove the migration actually runs, that a
  deliberate override survives it, and that a Haiku-frozen install now calls
  Sonnet.

---

## Backend 0.9.8 — Extension 0.9.8

### Changed: default model is now Sonnet 5

From a controlled three-model comparison on identical inputs:

| | labels over 6-word cap | bulleted as instructed | voice inversion |
|---|---|---|---|
| Haiku 4.5 | 4/11 | 1/11 | 2, both in slot 1 |
| Sonnet 5 | 0/13 | 10/13 | 0 |
| Opus 5 | 0 | yes | 0, but failed a request at `max_tokens` |

Model tier fixed compliance defects that three rounds of prompt engineering could
not. The label cap, bullet format and voice rule were all stated plainly and
Haiku ignored them regardless. Cost: $0.004 → $0.008 per call. Opus produced the
single best suggestion of any run at 5× the price, and hit the token ceiling.

`MODEL` must match in `wrangler.toml` `[vars]` and the `MODEL` constant in
`src/index.js` — a plain `wrangler deploy` reads the former, so changing only the
constant silently reverts. `build.mjs` now enforces the match.

- `max_tokens` 1600 → 2500. Opus proved the ceiling was reachable; Sonnet also
  writes longer than Haiku.
- Per-IP daily limit 60 → 300. Co-located users behind one NAT were blocking each
  other, which reads as a broken product rather than a quota. Keep it near 10× the
  device limit.

---

## 0.9.7

- Boundary-aware payload trimming. A hard `slice(0, 400)` cut mid-word, producing
  chips like "without users notici" and "5–10% overshoo".
- `salvageTruncated()` tracks `[` as well as `{`. Closing only braces left arrays
  open, so a truncated response was unrecoverable.
- `resetsAt` no longer emits `T24:00:00Z`, which is not valid ISO 8601 and fails
  `Date.parse`.

---

## 0.9.0 – 0.9.5

- Hosted Cloudflare Worker backend, so users need no API key of their own — the
  adoption wall this project exists to clear.
- Two-axis quotas (per-device-token, per-hashed-IP) with salted SHA-256 IP
  hashing, server-side input clamping, and rejection before any spend.
- Chrome Web Store submission assets, privacy policy, icon set.
- Honest degraded states throughout. An earlier build hid failures behind canned
  suggestion cards via an empty `catch {}`, which read as "the same three
  sentences every time". Never fake it.
