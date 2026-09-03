---
name: contexa-release
description: Cut a CONTEXA release — pick the version, bump both version homes, write the CHANGELOG entry in the house voice, run the verification gates, commit, tag, and push a PR branch. Use this whenever the user talks about releasing, shipping, cutting, publishing, or tagging a version of CONTEXA, bumping the version, or writing a CHANGELOG entry, and also when a change is finished and shipping it is the obvious next step even if the word "release" is never said. Also use it before hand-editing the version in extension/manifest.json or the BUILD constant in worker/src/index.js — those two must move together or build.mjs fails the build.
---

# Cutting a CONTEXA release

## The one fact that catches people out

Two artifacts ship from this repo, `extension/` and `worker/`, and they deploy on
separate paths so that a worker fix never forces a Chrome Web Store
resubmission. They still carry **one version number**, and it has two homes:

| home | the line |
|---|---|
| `extension/manifest.json` | `"version": "0.9.70",` |
| `worker/src/index.js` | `const BUILD = '0.9.70';` |

`build.mjs` compares them and fails on disagreement, so "bump the version"
always means both files. Bumping only the manifest is the single most common way
to arrive at a red build here.

The CHANGELOG header is a separate question. `## 0.9.69 — Extension` sits above a
release where `BUILD` moved too, and that is correct: the *numbers* move in
lockstep, the *header* names what materially changed. Recent entries use
`— Extension` or `— Extension + Worker`. Older forms like
`— Extension only (Backend stays 0.9.41)` are historical and can no longer be
true; don't copy them.

## Step 1 — read the change before you name it

The changelog entry is the real deliverable of a release, and it is written from
evidence, not from a diff summary. Before touching a version number, read what
actually happened:

```bash
git status --short
git --no-pager diff --stat
git --no-pager log --oneline main..HEAD
git --no-pager diff main...HEAD --stat
```

Read all four. The ceremony below stages with `git add -A`, so work sitting
uncommitted in the tree is part of this release just as much as work already
committed on the branch — and an entry written only from `main..HEAD` will
silently omit it.

Then answer three questions. What was believed before this change? What is true
now? What evidence moved you from one to the other — a measurement, a field
report, a failing run, a count?

If the third has no answer, you are not ready to write the entry. Go find the
evidence, or say plainly in the entry that there isn't any. Both are fine; a
confident-sounding entry with no evidence behind it is not, and this changelog
is read later as a record of what was actually established.

Versions are sequential `0.9.N`. Unless the user names one, the next release is
N+1 on the current manifest version.

## Step 2 — bump both homes

```bash
V=0.9.71   # the version you are cutting
sed -i "s/\"version\": \"[0-9.]*\"/\"version\": \"$V\"/" extension/manifest.json
sed -i "s/^const BUILD = '[0-9.]*';/const BUILD = '$V';/" worker/src/index.js
grep -n '"version"' extension/manifest.json && grep -n '^const BUILD' worker/src/index.js
```

The trailing comment on the `BUILD` line is a running note of which bumps let one
deploy be told from another. It is not a per-release log — extend it only when
this release changes what the worker actually speaks, which is rare. Leave it
alone otherwise.

## Step 3 — write the CHANGELOG entry

New section at the very top of the body, directly under the `---` that closes the
preamble. The shape:

```markdown
## 0.9.71 — Extension + Worker

*One line: the finding, not the change.*

<prose — evidence first, then what it forced>

---
```

**Read `references/changelog-voice.md` before writing the prose.** This changelog
has a strong and unusual voice, and the default a model reaches for — a tidy
bullet list of changes — is wrong in a way that is obvious next to any real
entry. The reference has the rules and two full worked examples.

The one rule worth stating twice, here and there: **never write a number you did
not measure.** The voice is dense with contrast ratios, drop counts and token
traces, which makes fabricated ones very easy to produce and very hard to catch
later. If you didn't run it, don't cite it.

## Step 4 — verify

```bash
npm test && npm run build
```

`npm test` runs both suites. `npm run build` is the interesting one: it rebuilds
`build-ready/` and enforces the invariants that have each caused a real
regression. When it fails, the message tells you exactly which one:

| failure | what it means |
|---|---|
| `version mismatch: extension manifest=… worker BUILD=…` | Step 2 only landed in one file. |
| `PROMPT DRIFT: MOVES_SYSTEM differs between extension and worker` | The system prompt was edited in one copy. The two must be byte-identical — a hosted request and an own-key request have to produce the same product. |
| `DRIFT: cleanTurns/cleanMoves/groundMoves differ…` | Same, for the injected helper block. A gate living in only one file is a gate half the users don't have. |
| `mining section labels missing or drifted…` | The `SESSION SO FAR:` label diverged between the two request builders. |
| `model mismatch: extension=… worker=… wrangler.toml=…` | The three places naming the model disagree. |
| `askNow no longer captures the session` | `content.js` stopped sending `turns`, which makes every request refusable before it is charged. |

None of these are lint warnings to work around. Fix the cause, then re-run.

## Step 5 — the gates before committing

`scripts/release-commit.ps1` is the Windows original of this ceremony; these are
its portable equivalents, and they carry the same guarantees. Run them in order.

**Has a key ever been committed, in any version?**

```bash
KEY_RE='sk-ant-[A-Za-z0-9_-]{20,}'
git --no-pager log --all --oneline -G "$KEY_RE"
```

Any output means a commit adds or removes a key-shaped string. Stop. Deleting the
file does not fix pushed history — the key has to be revoked in the Anthropic
console first.

The pattern is deliberately tight. Bare `sk-ant-` matches the options page's own
placeholder text and cries wolf; the long random suffix is what makes it a real
key.

**Then stage, and check what git would actually commit:**

```bash
git add -A
git diff --cached --name-only
git diff --cached -U0 | grep -nE "$KEY_RE"
git diff --cached --name-only | grep -E '(^|/)\.wrangler/|\.zip$|(^|/)key\.txt$|\.dev\.vars$|contexa-test-.*\.txt$'
```

Both `grep`s must find nothing. If either hits, `git reset` and stop — staging
everything is what makes this the last line of defence rather than the first.

Every entry on that blocklist is also in `.gitignore`. The duplication is the
point: `git add -A` sweeps whatever is on disk, and `.gitignore` has been edited
before.

## Step 6 — commit

The message is a header line plus the top CHANGELOG section, written to a file
and passed with `-F`. Quoting a Chrome error string or a chip payload inside
`-m` is what the file indirection exists to survive.

```bash
V=$(node -p "require('./extension/manifest.json').version")
{
  echo "CONTEXA v$V. Full changelog in CHANGELOG.md."
  echo
  awk '/^## /{f=1} f && /^---[[:space:]]*$/{exit} f' CHANGELOG.md
} > /tmp/contexa-commit-msg.txt
git commit -F /tmp/contexa-commit-msg.txt
```

The `awk` prints from the first `## ` heading to just before the `---` that
closes it. Append any trailers your session requires after that body. If the
extraction comes out empty, the header line alone is still an honest complete
message — `CHANGELOG.md` is one of the staged files, so the full story ships
inside the commit either way.

## Step 7 — push the branch, open the PR

```bash
git push -u origin "$(git branch --show-current)"
```

Never push to `main` directly; every release in recent history landed through a
PR. Title the PR the way the merged commits read — the version, an em dash, and
the thesis in a few words:

> `0.9.70 — the mascot survives force-dark`

**Do not tag on the branch.** `release-commit.ps1` tags because it runs on a tree
that goes straight to `main`. PRs here land squashed, so the branch commit is not
the commit that ships, and a tag pointing at it would name a commit `main` never
sees. Tag after the merge, on `main`:

```bash
git checkout main && git pull origin main
git tag -a "v$V" -m "CONTEXA v$V"
git push origin "v$V"
```

## Where this stops

Two things stay outside this skill because they need credentials and judgment
this session doesn't have:

- **Deploying the worker** — `npx wrangler deploy` from `worker/`, then confirm
  `/v1/health` reports the new `BUILD`. See `worker/README.md`.
- **The Chrome Web Store upload** — `npm run build` already produced
  `contexa-v$V.zip` with `manifest.json` at the archive root, which is the form
  Chrome accepts. The rest is `publishing/PUBLISHING-CHECKLIST.md`.

One item from that checklist belongs *inside* the release rather than after it:
if this release changes what data leaves the page, `publishing/PRIVACY.md` has to
change in the same push. That is not housekeeping — a policy that describes an
older build than the one shipping is the fastest route to removal, and it has
already been missed once here, for nine versions.
