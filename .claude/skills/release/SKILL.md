---
name: release
description: Cut a new CONTEXA generation — bump the version (manifest + worker BUILD), write the CHANGELOG entry, update the store fields and the website footer, and verify with the tests and build. Use when a change ships to users (extension, worker, or both), when the user says "bump", "release", "cut 0.9.x", or after an edit-prompt change.
---

# Releasing a CONTEXA generation

One product per generation: the extension and the worker carry **one version
number**, even though they deploy separately (a worker fix must not force a
Chrome Web Store resubmission). `build.mjs` enforces the core of this. The rest
of this checklist covers what no check catches.

## 1. Pick the number

Read the current version from `extension/manifest.json` (its single home) and
add 1 to the last segment: `0.9.98` → `0.9.99`. Then **ask the user** whether
the next one after `0.9.99` is `0.9.100` or `1.0.0`. Don't decide that yourself.
Never compare versions as strings (`"0.9.9" > "0.9.54"` as text). Note that
Chrome takes at most four dot-separated integers.

## 2. Move the number, everywhere it lives

| Where | What |
|---|---|
| `extension/manifest.json` | `"version"`: the source of truth. `build.mjs` reads it from here, never from a literal |
| `worker/src/index.js` | `const BUILD = '…'`. Change **only the version string**, not the long comment after it. `/v1/health` reports this, and the settings page shows it as "backend v…" |
| `publishing/website/index.html` | the footer `Version …`. No check covers it and it has drifted before, so grep `publishing/website/` for the old number |
| `CHANGELOG.md` | a new entry at the top (step 3) |

Bump the worker's `BUILD` even when no worker code changed ("worker build number
only"), because the build fails otherwise.

## 3. The CHANGELOG entry

The newest entry goes first, just under the header's `---`, in this format:

```
## 0.9.99 — Extension (what changed, in a few words; worker build number only)

*One italic line: what the user sees now.*

Prose: what changed, why, what it replaced, and anything left undone
(for example "The website still says X and follows separately").
```

The heading says **which artifacts actually shipped**: `Extension`, `Worker`,
or `Extension + Worker`, with `worker build number only` when the worker only got
the number. Write for someone reading this a year from now: describe the
failure or reason behind the change, not just the diff. Look at the last two
or three entries and match their tone.

## 4. What else to check, depending on what changed

- **Store fields** (`name`, max 45 characters, and `description`, max 132, in
  `manifest.json`): changing either is by itself a reason for a release. Count
  the characters (`node -e` with `.length`), then copy the new text
  **verbatim** into `publishing/STORE-LISTING.md` and give the count the way
  earlier entries do ("127 of 132").
- **What leaves the browser** (new fields in the request, a new endpoint, new
  permissions or host permissions): re-read the four reviewer-facing fields in
  `SUBMISSION.md`, plus `publishing/PRIVACY.md`, and correct them in the same
  release. This file has gone stale behind a pivot twice.
- **Numbers the website states** (`REPLIES_PER_DAY`, `MAX_TURNS`,
  `MAX_TURN_CHARS`, `MAX_TURNS_TOTAL_CHARS`, `MAX_REPLY_CHARS` in the worker,
  and `LONG_THREAD_TOKENS` and `FRAGMENT_MIN_THREAD_TOKENS` in `content.js`): if
  one changed, update `publishing/website/`. Read the new value from the code;
  never copy it from another document.
- **Wording users see on the card** (a button label, the cost line, the mascot's
  bubble): check the store listing, the website, and
  `scripts/screenshots/slides.html` / `scripts/promo/` for the old wording.
  If the images need re-rendering, say so. Don't re-render them without being asked.
- **The shipped model** (`SHIPPED_MODEL` in `background.js`, `MODEL` in the
  worker and in `worker/wrangler.toml`): all three must agree, and the old model
  is appended to `SUPERSEDED_MODEL_DEFAULTS` (never removed, never the new one).
  The build checks both.

## 5. Verify

```bash
npm test && npm run build
git log --all -G 'sk-ant-[A-Za-z0-9_-]{20,}' --oneline   # must print nothing
git diff | grep -E 'sk-ant-[A-Za-z0-9_-]{20,}'            # must print nothing
```

The build must end with `contexa-v<new version>.zip — … manifest at root ✓`.
`build-ready/` is git-ignored, so never commit it.
(`scripts/release-commit.ps1` runs the same checks on the maintainer's Windows
machine. It commits and tags on `main`, so don't run it from a cloud session.)

## 6. Commit

Title it `0.9.99: <what changed>` like earlier releases (`git log --oneline`),
with a body that explains the change.
In a cloud session, commit to the assigned `claude/…` branch and push that. Do
**not** create the `v0.9.99` tag, push to `main`, deploy the worker, or upload
to the store. Those are the maintainer's steps. End by telling the user what is
still to do, in order:

1. merge;
2. `cd worker && npx wrangler deploy` if the worker changed (hosted users only
   get a prompt change after this);
3. upload `build-ready/contexa-v<version>.zip` to the Chrome Web Store;
4. record the submission in `SUBMISSION.md`.
