# scripts

Developer and release tooling. None of it is part of the shipped product
(`extension/` and `worker/`) or the build entry point (`build.mjs` at the repo
root) — these are convenience scripts run by hand.

- `release-commit.ps1` — release ceremony: bump, build, tag, push.
- `dogfood-test.ps1` — drive a local reply through the pipeline for manual checks.
- `reproduce-test.ps1` — reproduce a reported failure against the backend.
- `prompt-ab-fork.mjs` + `ab-input.json` — offline A/B harness for
  QUESTIONS_SYSTEM prompt changes: fixed inputs through fixed prompt variants,
  N runs each, nothing but which branch (questions vs. moves) came back. Built
  2026-08-28 for the original questions-vs-moves fork question, un-archived
  and extended for the choose/risk/why-outrank-questions precedence rule
  (three fixed inputs, PRE/NOW/DROP variants). Reads `ANTHROPIC_API_KEY` from
  the environment; not part of the test suite. `ab-input.json` holds the U1
  input only — U2/U3 are fixed inside the script itself, not in an editable
  file, so a later casual edit can't move a pre-registered input.

## archive/

One-off scripts written for a single past investigation, kept only for
provenance — not meant to be re-run as part of the current workflow.

- `commit-0.9.*.ps1` — per-version release scripts; the current path is `release-commit.ps1`.
- `probe.js` — a browser-console DOM probe used once (2026-08-22) to locate
  where claude.ai's chrome text lived, for `content.js`'s `SKIP_SEL`.
