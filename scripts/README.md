# scripts

Developer and release tooling. None of it is part of the shipped product
(`extension/` and `worker/`) or the build entry point (`build.mjs` at the repo
root) — these are convenience scripts run by hand.

- `screenshots/` — captures the card by driving the real unpacked extension in
  a real Chromium against a mock of claude.ai's DOM, into
  `publishing/screenshots/`. Needs Playwright and Xvfb; not part of the test
  suite. It produced every store set up to 0.9.68; the set shipping since
  2026-09-07 is designed illustrations under different filenames, so a re-run
  now *adds a second set beside* the shipping one rather than refreshing it —
  delete or rename deliberately. See `scripts/screenshots/README.md`.
- `promo/` — generates the two Chrome Web Store promo tiles into
  `store-assets/` from an HTML source, headless. See `scripts/promo/README.md`.
- `release-commit.ps1` — release ceremony: bump, build, tag, push.
- `dogfood-test.ps1` — drive three real sessions through the live backend for
  manual scoring. The session accumulates across the run, so the last turn is
  mined against the whole thing; a run that sent only the current turn would
  test the old single-turn product wearing the new wire.
- `reproduce-test.ps1` — reproduce a reported failure against the backend.

## archive/

One-off scripts written for a single past investigation, kept only for
provenance — not meant to be re-run as part of the current workflow.

- `commit-0.9.*.ps1` — per-version release scripts; the current path is `release-commit.ps1`.
- `probe.js` — a browser-console DOM probe used once (2026-08-22) to locate
  where claude.ai's chrome text lived, for `content.js`'s `SKIP_SEL`.
- `prompt-ab-fork.mjs` + `ab-input.json` — offline A/B harness for
  QUESTIONS_SYSTEM prompt changes, archived 2026-08-31 when the history-mining
  pivot deleted that prompt. Does not run as written. Kept because the METHOD
  transfers to `MOVES_SYSTEM` — fixed inputs, prompt variants, N runs each, and
  a threshold committed to before the runs — and because its own history
  records two dead ends worth not repeating: fixtures whose PRE variant already
  scored full marks, and which therefore could not have detected the change
  being tested even in principle.
