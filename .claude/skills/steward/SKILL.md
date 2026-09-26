---
name: steward
description: Repo conventions for driving a CONTEXA pull request to green — what to run before every push, how to read a CI failure here, how to answer review comments, and what never to do on a PR. Read before acting on CI or review events on a PR you opened or were asked to drive.
---

# Driving a CONTEXA PR

The repo is small, has no dependencies, and runs a single CI job. Most failures are
invariant checks, not flaky tests, and each check exists because the thing it
guards once broke in production. Treat a red check as a real report.

## Before every push

```bash
npm test && npm run build
```

Run **both**. CI (`.github/workflows/ci.yml`, Node 20) runs extension tests,
worker tests and the build as three separate steps, and the build carries most of
the invariants (prompt identity, helper-block identity, model agreement,
`BUILD` = manifest version, cost-parity helpers, the model-default guard,
the zip layout). A green `npm test` with a red build is the usual way a PR
fails here.

Also check the diff yourself for:
- a change to one of the duplicated request-path functions made on only one
  side (use the `parity-fix` skill; `node .claude/skills/parity-fix/parity.mjs`);
- model output or page text reaching `innerHTML` (it must go through
  `textContent`/`title`, or `esc()` for the one error card);
- a key-shaped string: `git diff origin/main | grep -E 'sk-ant-[A-Za-z0-9_-]{20,}'`
  must print nothing;
- `build-ready/`, `*.zip`, `.dev.vars` or `scripts/contexa-test-*.txt` staged.
  They're git-ignored and must stay out.

## Reading a CI failure

Tests print one `ok`/`FAIL <name>` line per assertion, with no framework and no
filter. Find the `FAIL` line in the job log and run the same suite locally
(`npm run test:extension` or `npm run test:worker`). Build failures print
their reason directly:

| Build message | Fix |
|---|---|
| `PROMPT DRIFT: …` | `edit-prompt` skill: re-inject one version into both files |
| `DRIFT: cleanTurns/…` or `DRIFT: cachedSystem`/`usageOf` | `parity-fix` skill: copy the whole block across |
| `version mismatch: extension manifest=… worker BUILD=…` | `release` skill: bump both |
| `model mismatch: …` | `SHIPPED_MODEL`, the worker's `MODEL` and `wrangler.toml` must agree |
| `DEFAULTS seeds a concrete model` | `DEFAULTS.model` must be `''` in `options.js` and `background.js` |

Nothing here needs network or a browser, so a failure that doesn't reproduce
locally with Node 20 is the thing to investigate. Don't call it a flake and re-run.

Some test assertions match source text by regex (for example
`/callUpstream\(env, MOVES_SYSTEM,/`). When one fails after a refactor, decide
whether the invariant still holds. If it does, update the regex and say so in
the commit. If it doesn't, the refactor broke something. Never delete the
assertion or weaken it to `true`.

## Review comments

- The CLAUDE.md "Design principles" section is the default answer on product
  behaviour: zero is a valid outcome, never fake output, clicking is the only
  input, every move is grounded, moves are independent. A suggestion to add a
  fallback move, a minimum count or a free-text box goes against a decision that
  was already made. Reply citing the principle rather than implementing it.
- Behaviour changes on the request path need tests in **both** suites.
- A comment that asks for different user-facing wording touches the store
  listing, the website and the images too (see the `release` and `screenshots`
  skills). Mention anything left over rather than widening the PR.

## Conventions

- PRs are squash-merged with the PR number in the title (`… (#80)`). Commit
  titles: `0.9.x: what changed` for releases, and `area: what changed` otherwise
  (`site:`, `CHANGELOG:`, `skills:`, `docs:`).
- A PR that changes shipped behaviour carries its version bump and CHANGELOG
  entry (the `release` skill). A docs-only, site-only or tooling-only PR doesn't.
- `publishing/website/` deploys to Cloudflare Pages automatically when it
  changes on `main`. A website edit is live when it merges, so check it as
  carefully as a release.
- Never run `scripts/release-commit.ps1`, deploy the worker
  (`npx wrangler deploy`), create a version tag or push to `main` from a
  session. Those are the maintainer's steps.
- Anything under an `archive/` folder is history. Don't "fix" it to match the
  present.
