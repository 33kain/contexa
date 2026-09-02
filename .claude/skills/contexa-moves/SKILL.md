---
name: contexa-moves
description: Prototype of CONTEXA's "next moves" for Claude Code. Reads the user's own messages from this session and offers up to four independent, send-ready next prompts. Use when the user invokes /contexa-moves.
---

# contexa-moves

This is CONTEXA's history-mining prompt (`MOVES_SYSTEM` in `extension/background.js` /
`worker/src/index.js`) ported to run inside a Claude Code session instead of a
browser extension. It is a prototype living in `claude-code-moves/` — see that
directory's `README.md` for what is genuinely equivalent and what is not.

There is no DOM and no clickable composer here, so this skill does the two
jobs the extension splits across `content.js` and `background.js` itself:

## 1. Get the turns and the reply

Run the extractor against the CURRENT session's transcript:

```
node claude-code-moves/cli.mjs extract <path-to-this-session's-transcript.jsonl>
```

The transcript lives at `~/.claude/projects/<project-slug>/<session-id>.jsonl`.
`<project-slug>` is the working directory with `/` replaced by `-`. If you
cannot resolve the exact session id, find the most recently modified `.jsonl`
file under that project's directory.

This prints `{"turns": [...], "reply": "..."}` — the user's own prior messages
(oldest first, the invoking `/contexa-moves` message already excluded) and
Claude's latest reply before that invocation.

Do not skip this step and reconstruct turns from memory: the ported gates
downstream expect the exact `{i, text}` shape the extractor produces, and the
point of the prototype is testing this pipeline, not eyeballing it.

## 2. Generate candidate moves yourself

You (the model) now play the role `MOVES_SYSTEM` describes — read it from
`claude-code-moves/lib.mjs` (`export const MOVES_SYSTEM`) — over the `turns`
and `reply` you just extracted. Do not send a second API call: you already
have full context of this conversation, so generate the JSON
`{"moves":[{"label":"...","text":"...","evidence":"..."}]}` (zero to four
items) directly, following that prompt's rules exactly, including the
independence rule, the verbatim-evidence rule, and "zero is a valid answer."

Write the raw JSON to a scratch file, e.g. `/tmp/contexa-moves-raw.json`.

## 3. Run it through the same gates the extension runs

```
node claude-code-moves/cli.mjs gate <turns.json> <reply.txt> < /tmp/contexa-moves-raw.json
```

(`<turns.json>` and `<reply.txt>` are the `turns` array and `reply` string
from step 1, each saved to its own file — the gate command takes the reply as
a whole file rather than a shell argument so multi-line replies survive
intact.)

This applies `cleanMoves` → `groundMoves` → `enforceAction`, the same three
gates `extension/background.js` runs, so a move that only "looks" grounded or
that isn't a doable click gets dropped here exactly as it would in the
extension.

## 4. Show the result

Print the final `moves` array as a numbered list: label as a heading, then the
full `text` in a code block so the user can copy it verbatim into their next
message. If `moves` is empty, say so plainly — "nothing open in this session
right now" — and stop. Do not pad the row and do not apologize for it; per
`CLAUDE.md`, zero is a valid outcome, not a failure.

Never claim this composed anything for the user or "sent" anything — nothing
is sent until they paste a move themselves and hit enter.
