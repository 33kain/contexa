---
name: selector-check
description: Diagnose and fix CONTEXA going quiet on claude.ai — no mascot after a reply, an empty or wrong session read, the card mounted in the wrong place, a prompt not landing in the composer — by checking content.js's pinned claude.ai DOM selectors against the live site and the mock. Use when the user reports the extension stopped working, "claude.ai changed", or before trusting new store screenshots.
---

# Checking the claude.ai DOM contract

`extension/content.js` reads claude.ai through a few selectors pinned near the
top of the file:

| Constant | What it finds | What breaks when it stops matching |
|---|---|---|
| `SELECTORS` (a list; the first match wins) | the composer | nothing mounts, and a click composes nowhere |
| `RESPONSE_SEL` | the reply body | no reply captured, so no mascot |
| `STREAM_SEL` (`data-is-streaming` going `true`→`false`) | the moment a reply finishes | falls back to the 1.2 s settle timer, so the mascot is late |
| `USER_MSG_SEL` | each of the user's turns | empty session, and every request is refused |
| `ROW_SEL` | the boundary between turns | reply and turns mixed up |
| `SKIP_SEL` | page chrome text to skip ("Thought for 8s") | moves get grounded in chrome text |
| `MODEL_SEL` | the model picker | the Opus nudge never fires (harmless) |
| `html[data-mode]` | the theme | the card uses the wrong theme |

By design, a broken selector makes the extension **go quiet, not throw**. So
"nothing happens" is the symptom, and the console (filtered on `[CONTEXA]`) is
the evidence.

## 1. Get evidence from the live site

A cloud session can't log in to claude.ai. The user has to run the check:

```bash
node .claude/skills/selector-check/probe.mjs
```

This prints a read-only console snippet built from the selectors currently in
`content.js`. Give it to the user in a code block and ask them to paste it into
DevTools on a claude.ai conversation (after a reply has finished), then send
back the table, plus any `[CONTEXA]` console lines.

What the table means:
- `SELECTORS[*]`: at least one has to match. Most of the list is fallbacks.
- `USER_MSG_SEL` should match the user's visible turn count. On a long,
  virtualised conversation it matches fewer turns, because only the rows on
  screen are in the page. That's the known limit: `[CONTEXA] session — DOM read
  on a virtualised page` is expected, not a bug.
- `STREAM_SEL` should show `false` for a finished reply.
- `SKIP_SEL` and `MODEL_SEL` can legitimately be 0.

A `count` of 0 on anything else is the break. Ask the user for the
`outerHTML` of the element that should have matched (right-click → Copy →
Copy outerHTML). Never guess new selectors from memory of claude.ai.

## 2. Fix

- Prefer stable hooks: `data-testid`, `aria-*`, semantic attributes. Avoid
  generated class names. Add to a fallback list rather than replacing entries
  that may still match for other users (claude.ai rolls changes out gradually).
- Keep the "never assume a positive match" stance: every lookup must handle null.
- Update the `(verified <month year>)` note above the constants.
- Anything the page yields still renders through `textContent`, never `innerHTML`.

## 3. Update the mock and verify

`scripts/screenshots/mock-claude.html` copies the DOM contract. Change it to
match the fix. Read its header comment first: the nesting depth (7+ levels
above the composer) matters because `mountHost()` climbs six levels.

```bash
npm test && npm run build
# real browser, real extension, against the mock; all write only to build-ready/:
xvfb-run -a env CX_CHROME=/opt/pw-browsers/chromium node scripts/screenshots/capture.mjs
for m in CX_TURNS CX_ZERO CX_NUDGE CX_FORK; do
  env $m=1 CX_CHROME=/opt/pw-browsers/chromium xvfb-run -a node scripts/screenshots/capture.mjs || break
done
```

Never add `CX_SHIP=1` here: it writes over the shipped store images (see the
`screenshots` skill). The mock proves only that the code
matches the mock. Only the user's re-run of the probe on claude.ai proves the fix.

A selector fix changes the extension only, so it ships through the `release`
skill with `worker build number only`.
