# CONTEXA on Claude Code — prototype

Answers the question "is Contexa feasible on Claude Code?" with a working
sketch, not just an opinion. **This is not a third shipped artifact** next to
`extension/` and `worker/` — it is not versioned, not covered by `build.mjs`'s
byte-identity checks, and not run by `npm test` or CI. Treat it as a spike.

## What ported cleanly

The deterministic parts — the actual product logic — are copied verbatim from
`extension/background.js` into `lib.mjs`:

- `MOVES_SYSTEM`, the history-mining prompt, unchanged.
- `cleanTurns` / `cleanMoves` / `groundMoves` / `enforceAction`, the four
  gates that turn a model's raw JSON into a safe row of moves.

These don't care whether the model call came from a browser extension or a
CLI agent — they're pure functions over turns/moves/text — so they needed no
adaptation at all. `test.mjs` checks them against the same kind of cases the
extension's own tests use.

## What had to be rebuilt

`extension/content.js`'s job — noticing a reply finished, reading
`[data-testid="user-message"]` out of the DOM, keeping a `fitTurns()` budget —
has no DOM to read here. `extractFromTranscript()` in `lib.mjs` does the
equivalent read against a Claude Code session transcript
(`~/.claude/projects/<project>/<session>.jsonl`) instead: it pulls out the
user's own prior text turns and Claude's latest reply, and applies the same
pin-turn-one / drop-oldest-middle policy.

`background.js`'s `callClaude()` — the actual Anthropic API call — is not
reproduced here. Inside Claude Code, the model generating the moves already
*is* the same conversation, so the `.claude/skills/contexa-moves/SKILL.md`
skill has Claude apply `MOVES_SYSTEM` to its own context directly rather than
paying for a second round-trip call. That is a genuine product difference,
not a shortcut: it means moves generation is not usage-metered the way the
hosted worker path is, and it also means there's no clean separation between
"the assistant" and "the thing grading the assistant" the way there is when a
browser extension calls a fresh, stateless completion.

There is no composer to click a move into, either. `content.js` never had to
solve this — the click *is* the send. The skill instead prints each move's
full text in a code block for the user to copy, which is strictly worse UX:
it turns "one click" into "select, copy, paste, send." That gap is the honest
answer to "is it feasible" — the mining and grounding logic transfers with
zero loss, the one-click delivery does not.

## Try it

```bash
node claude-code-moves/test.mjs                       # ported-logic self-test
node claude-code-moves/cli.mjs extract <transcript.jsonl>
```

Or, inside a Claude Code session on this repo, type `/contexa-moves` and let
the skill drive both scripts.

## Open questions this spike does not answer

- Whether copy/paste delivery is worth shipping at all, given the product's
  own design principle is "clicking is the only input" (`README.md`, Design
  notes) — a copy/paste flow adds exactly the free-text-adjacent friction that
  principle exists to avoid.
- Whether grounding evidence should be checked against the transcript's raw
  text or against what the model *reports* seeing, since here both are
  produced by the same model in the same context window rather than by two
  independent calls.
- Whether this belongs as a Claude Code skill at all, or as a `Stop` hook that
  runs unprompted the way `content.js`'s capture is eager — CLAUDE.md's whole
  cost/privacy argument for capturing eagerly but asking on click (0.9.53)
  needs re-deriving for a CLI where "asking" has no chip to click.
