---
name: edit-prompt
description: Change CONTEXA's system prompts — MOVES_SYSTEM (the row of moves) or FORK_SYSTEM (the "Same session, new chat" brief) — in extension/background.js and worker/src/index.js together, byte-identical by construction. Use for any edit to either prompt's wording, rules, exemplars or output format, however small.
---

# Editing MOVES_SYSTEM / FORK_SYSTEM

Each prompt exists twice: `extension/background.js` (own-key path) and
`worker/src/index.js` (hosted path). The two copies must be **byte-identical** or
own-key and hosted users get different products, and no product test can see
it. `build.mjs` fails on drift. Don't edit the two files by hand one after the
other. Write the prompt once and inject it into both with `prompt.mjs`, which
sits next to this file.

## 1. Read before writing

- `docs/archive/desktop-project/claude_CONTEXA-pattern-file.md`, **Part Two**
  (prompt-authoring defects A–F). Each defect shipped once. The ones people
  repeat most:
  - **A**: a required output field that no exemplar shows.
  - **B**: position is behaviour. Where a rule sits changes what the model does.
  - **E**: an instruction with no mechanism behind it. Check whether a gate in
    code (`groundMoves`, `enforceAction`, `cleanBrief`) already enforces the rule.
- The audience is beginners and intermediate users, not senior developers
  (`docs/archive/desktop-project/CONTEXA-0.9.27-capability-moves.md`).
- Design rules the prompt must keep (CLAUDE.md, "Design principles"): zero is a
  valid outcome (no minimum count), every move is grounded by a verbatim quote,
  the reply is material and never the subject, moves are independent, each move
  is one ask with one imperative verb, and missing material becomes a
  `<paste here>` slot. Also keep "the earliest message you can see", never
  "turn 1": the capture can be missing the start of the conversation.

## 2. Extract, edit, inject

```bash
S=<your scratchpad dir>
node .claude/skills/edit-prompt/prompt.mjs extract MOVES_SYSTEM $S/moves.txt
# edit $S/moves.txt
node .claude/skills/edit-prompt/prompt.mjs inject  MOVES_SYSTEM $S/moves.txt
```

(`FORK_SYSTEM` works the same way.)

- `extract` refuses if the two copies already differ. If it does, find out which
  one is right from `git log -p` before going on.
- The file holds the prompt **as it appears in the JavaScript source**, not as
  the model reads it. A backslash is an escape: FORK_SYSTEM's `\\n` reaches the
  model as `\n`. Keep that in mind when adding one.
- `inject` refuses a backtick (it would end the template literal and break
  `build.mjs`'s extraction regex), `${` (it would interpolate) and CR line
  endings. It writes both files or neither.

## 3. Change the code that reads the output, if you changed the output

If the edit changes the JSON shape or a field's meaning (`moves[].label/text/evidence`,
`brief`), the parsers and gates have to change too, identically on both sides:
`cleanMoves`, `groundMoves`, `enforceAction`, `ACTION_OPENERS` and `cleanBrief`
live in the injected helper block (from `function cleanTurns` to the
`/* end of the injected helper block` sentinel; never delete that sentinel).
A new opening verb in the prompt's exemplars has to be in `ACTION_OPENERS`
too, or the action gate will drop the move, because it fails closed.

## 4. Verify

```bash
npm test && npm run build
```

The build must print `prompt identical across extension and worker ✓`. The tests
pin some prompt text (grep `extension/test.mjs` and `worker/test.mjs` for the
phrase you changed). If one fails, decide whether the test or the edit is wrong.
Don't just change the test so it matches the new text.

## 5. Ship it as a release

A prompt change changes the product on both paths, so it ships as a new
generation: use the `release` skill (version bump, CHANGELOG entry saying what
the model now does differently and why). The worker has to be deployed for
hosted users to get the new prompt. Say so in the CHANGELOG entry.
