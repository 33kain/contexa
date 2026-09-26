---
name: parity-fix
description: Fix or change request-path logic that exists twice — in extension/background.js (own-key path) and worker/src/index.js (hosted path) — so both paths keep behaving identically. Use for any change to cleanTurns, cleanMoves, groundMoves, tallySources, enforceAction, ACTION_OPENERS, cleanBrief, rawBrief, trimPayload, turnsSection, extractJson, cachedSystem, usageOf, diagnose or the MAX_* limits, or when a bug is reported on only one path.
---

# Keeping the own-key and hosted paths identical

Every request path exists twice. A user with their own API key runs
`extension/background.js` → Anthropic, and everyone else runs extension →
`worker/src/index.js` → Anthropic. The rule: **a gate that lives only in the
worker is a gate half the users don't have.** That applies to cost as well:
until 0.9.72 only the worker cached the system prompt, and only the bill showed it.

## 1. See where the two files stand

```bash
node .claude/skills/parity-fix/parity.mjs          # every shared definition: same / DIFFER
node .claude/skills/parity-fix/parity.mjs <name>   # unified diff of one of them
```

Run it **before** you start, so you know which differences were there already.

## 2. Know which copy the build checks

| Definition | How it is kept identical |
|---|---|
| `cleanTurns` … `cleanBrief` / `rawBrief` (the injected helper block: from `function cleanTurns` to the `/* end of the injected helper block` sentinel) | `build.mjs` fails on any byte difference |
| `cachedSystem`, `usageOf` | `build.mjs`, byte-identical, and both call sites must use `cachedSystem` |
| `MOVES_SYSTEM`, `FORK_SYSTEM` | `build.mjs`. Use the `edit-prompt` skill |
| `trimPayload`, the `MAX_*` limits | **nothing but discipline.** Currently identical: keep them that way |
| `extractJson`, `diagnose` | **nothing, and they already differ** (see below) |

Code that is only on one side on purpose, such as quotas, `admit()`,
`callUpstream`, origin and device checks (worker), or `callClaude` and storage
(extension), is not a parity concern.

## 3. Make the change once, then copy it

1. Edit the definition in one file.
2. Copy it **byte for byte** into the other: replace the whole definition, don't
   retype the change. For the helper block, copy the whole block from
   `function cleanTurns` to the sentinel comment. Never delete the sentinel,
   because the build uses it as the end marker.
3. `node .claude/skills/parity-fix/parity.mjs <name>` must say `identical`.

When the change is to the helper block, the new code can only use what exists
on **both** sides. The worker has no `chrome.*`, and the extension has no `env`.

## 4. Test both paths

```bash
npm test && npm run build
```

A behaviour fix needs a test **in both suites**: `extension/test.mjs` drives
the own-key path with a fake `chrome` and `fetch`, and `worker/test.mjs` drives
the endpoint. A test on only one side proves only half the product. Each file
is one flat script with no filter: add your `t('…', cond)` next to the existing
tests for the same function.

## Known differences (as of 0.9.98)

- **`extractJson`**: the two copies do different things with a response the model cut off
  at `max_tokens`. The extension walks braces and then calls
  `salvageTruncated()` (which tracks `[` as well as `{`). The worker has its own
  inline stack-based rewind and no `salvageTruncated`. On most responses they
  return the same thing, but a truncated response can come out differently on
  the two paths. Nothing has decided which one is right: settle that with the
  user before merging the two, then add a truncated-response test to both suites.
- **`diagnose`**: only cosmetic (a default parameter, `?? null`, a comment). It
  goes to logs only.

When you remove a difference, delete its bullet here. When you find a new one,
add it.
