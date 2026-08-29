# scripts

Developer and release tooling. None of it is part of the shipped product
(`extension/` and `worker/`) or the build entry point (`build.mjs` at the repo
root) — these are convenience scripts run by hand.

- `release-commit.ps1` — release ceremony: bump, build, tag, push.
- `dogfood-test.ps1` — drive a local reply through the pipeline for manual checks.
- `reproduce-test.ps1` — reproduce a reported failure against the backend.

## archive/

Per-version, one-off commit scripts (`commit-0.9.*.ps1`) kept only for
provenance. They were written for a single release each and are not meant to be
re-run; the current release path is `release-commit.ps1`.
