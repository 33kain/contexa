# Archive — test runs

Historical output from prompt tuning and model comparisons. Kept for the record;
none of it is a live test (the live suites are `extension/test.mjs` and
`worker/test.mjs`).

- `contexa-test-*.txt` — captured suggestion sets from A/B and cross-model runs
  (baseline, haiku, sonnet5, opus5, improved, round3–6).
- `contexa-test-postdeploy.txt` — 2026-08-31, and the odd one out: not a
  comparison but an acceptance run, taken immediately after the 0.9.58 worker
  deploy. The first hosted run of the history-mining product, and therefore the
  first time `turns[]`, the server clamps and the quota were exercised against
  anything real — the field test before it ran own-key, which never touches the
  worker. 11 moves over three accumulating turns, all grounded; the quota
  climbing 1→2→3 is what proved the `CX_KV` binding resolves, which
  `/v1/health` cannot show. Kept because it is the only record of what the
  hosted path returned on the day it shipped.
- `prompt-ab-results.md` — the write-up of those measurements. Referenced from
  the root `CHANGELOG.md` as the record behind the novelty-vs-click-through
  metric decision.
