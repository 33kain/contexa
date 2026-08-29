# scripts

Developer and release tooling. None of it is part of the shipped product
(`extension/` and `worker/`) or the build entry point (`build.mjs` at the repo
root) — these are convenience scripts run by hand.

- `release-commit.ps1` — release ceremony: bump, build, tag, push.
- `dogfood-test.ps1` — drive a local reply through the pipeline for manual checks.
- `reproduce-test.ps1` — reproduce a reported failure against the backend.

## archive/

One-off scripts written for a single past investigation, kept only for
provenance — not meant to be re-run as part of the current workflow.

- `commit-0.9.*.ps1` — per-version release scripts; the current path is `release-commit.ps1`.
- `probe.js` — a browser-console DOM probe used once (2026-08-22) to locate
  where claude.ai's chrome text lived, for `content.js`'s `SKIP_SEL`.
- `prompt-ab-fork.mjs` + `ab-input.json` — an offline A/B harness built to
  settle one specific prompt-tuning question (2026-08-28, the questions-vs-moves
  fork); `ab-input.json` is its fixed test input. Still runnable (reads
  `ANTHROPIC_API_KEY` from the environment) if a similar A/B is ever needed
  again, but it is not part of the test suite — see `../../docs/archive/test-runs/`
  for its output.
