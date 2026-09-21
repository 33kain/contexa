# CONTEXA 0.9.49 — The `assume` feature
 
**Shipped:** 2026-08-23
**Rate question resolved:** 2026-08-24
**Status:** Working as designed. The observed rate is correct behaviour, not
under-firing. Nothing to loosen.
 
---
 
## The feature: half a heuristic
 
0.9.48 borrowed a heuristic: *would a different answer change what happens next?*
 
0.9.48 implemented the first half — **No → don't ask.** Questions the reply had
already settled get dropped.
 
0.9.49 implements the second half — **No → pick, and say what you picked.**
Instead of staying silent, CONTEXA writes the settled fact down as an editable
`Assume:` line in the composed prompt.
 
---
 
## What shipped
 
### Wire
 
The questions response carries an optional top-level `assume` array — zero to two
plain statements:
 
```json
{"questions": [], "assume": ["I'm on Windows using PowerShell"]}
```
 
It travels through `content.js` into the expand call and lands as `Assume:` lines
in the composed prompt.
 
**Backward compatibility is order-independent by construction:**
 
- New worker + old extension → the extra key is ignored.
- New extension + old worker → the chip sends the facts **twice**, in `assume`
  and in the intent as `Assumed:` lines, so a pre-0.9.49 worker reads a click
  list holding no decision instead of rejecting an empty intent.
**That duplication is load-bearing. Do not clean it up.**
 
### UI
 
**`assume` > 0 and questions = 0** → a standalone chip: `→ Write my next
message`. One click composes with nothing typed and nothing clicked.
 
**`assume` > 0 and questions > 0** → the interview runs normally; the
assumptions ride along into the composed prompt.
 
**`assume` = 0** → unchanged from 0.9.48.
 
The chip appears **only** on the zero-questions render, never after a dismissal —
a closed card returning as a one-click button reads as the card refusing to
leave. Dismissing does not clear `assume`: it is a fact about the user, not a
suggestion they rejected.
 
### Prompts
 
`QUESTIONS_SYSTEM` gained the `assume` section. `EXPAND_SYSTEM` gained an
`ASSUMED` input block: copy each statement verbatim onto a line starting
`Assume:`, they fill the cap of 2 before any inference of its own, never turn one
back into a question, and nothing in the body may contradict one.
 
### Code
 
- `cleanAssume()` in **both** `extension/background.js` and `worker/src/index.js`,
  byte-identical (build.mjs enforces). Max 2, non-empty, under 160 chars, strips
  a trailing `?`, deduplicates.
- `expandPrompt` guard relaxed to `!intent && !assume.length`.
- `appendAssumeChip()` in `content.js` — ~50 lines, renders the standalone chip.
- Mount log stamped with the manifest version (added 0.9.51) so every firing
  self-identifies its build.
### Guards, all tested
 
1. Never invented — no assumption without grounding in the reply.
2. A statement ending in `?` is discarded.
3. Hard cap of 2.
4. The primary complete-answer JSON example carries **no** `assume`.
5. `{"questions":[]}` alone holds the **final position** of `QUESTIONS_SYSTEM`.
   The first draft displaced it and would have taught *"no questions, therefore
   add an assumption"* — a floor written into the highest-leverage position in
   the prompt, by a change whose whole purpose was to avoid building one. Caught
   in under a minute by the 0.9.29 final-position assertion, written four
   releases earlier for a different reason.
6. Demonstrated in a **minority** of exemplars — at least one, no more than a
   third. Currently 2 of 10. `assume` fails asymmetrically: under-firing lands on
   shipped behaviour, over-firing puts a fabricated line in a message the user
   sends.
---
 
## The rate question — RESOLVED 2026-08-24
 
`assume` fired roughly **once in nine** interviews, and 0.9.50's exemplar bump
(1 of 9 → 2 of 10) moved that not at all. Two explanations were recorded on
2026-08-23 with neither tested, and the release shipped documented as
*"unresolved."*
 
**Both were the wrong frame.**
 
> **The gate fires on facts it INFERRED and declines facts the user STATED.**
 
A stated fact does not need an `Assume:` line, because `EXPAND_SYSTEM` carries it
in the **body** of the composed prompt. Two routes, same obligation, only one
fires per fact. The low rate is that behaviour meeting real conversation, where
most settled facts are typed in words.
 
### The five-arm test
 
One build — `v0.9.51` on every mount line, one mount per reply. Clean.
 
| # | fact placement | grounding | `assumed` | outcome |
|---|---|---|---|---|
| 1 | **explicit** — "PowerShell 5.1 only, no WSL, no git bash" | 1/1/1 | — | 1 question |
| 2 | **implicit** — `PS C:\>` prompt shown, never stated | 0/0/0 | **fired** | standalone chip |
| 3 | **explicit** — "not developers, my mum's the test case" | 2/2/**1** | — | 2 questions |
| 4 | **explicit** — "Postgres, raw SQL, not reopening it" | 2/2/2 | — | 2 questions |
| 5 | nothing settled (negative control) | 1/1/1 | — | 1 question ✓ |
 
Both fires ever recorded were implicit. All four explicit facts declined, across
three unrelated domains. Arm 5 correctly silent.
 
### The decisive evidence was the composed prompt, not the log
 
Arm 1's card was answered, and produced:
 
> Give me the same one-liner, confirming last-one-wins is fine for filename
> collisions. Keep it PowerShell 5.1 only, copying flattened .js files from
> dist\ into release\ as before.
 
**`Keep it PowerShell 5.1 only`.** The stated fact reached the message box, in
the body, with no `Assume:` line and none needed. Same mechanism as the earlier
Serbian refusal, where a fully Serbian exchange produced a fully Serbian composed
prompt and no `assume` — it carried the fact by *using* it.
 
Explanation 2 (*the gate is too tight*) is refuted: the fact was never lost.
Explanation 1 (*the refusals are correct*) reached the right verdict for the
wrong reason — it credited the reply hedging both branches, when the live
variable was whether the user had said the fact out loud.
 
### Method note
 
The five arms were designed to vary **reply hedging**. They did not: arms 1 and 2
both drew unhedged pure-PowerShell replies, so hedging was held constant and what
actually varied was **explicit vs implicit**, which nobody set out to test. The
designed control was never run and is now retired — hedging was not the variable.
 
**A confounded control can still be decisive. You learn which question it
answered by reading what differed between the arms, never by trusting the
design.**
 
---
 
## What this changes
 
**Retired:** the §2h control. Hedging was not the variable.
 
**Rejected outright** (previously "pending a control"): loosening the `assume`
gate. It would produce `Assume:` lines duplicating text already in the prompt —
watch criterion B, the over-fire tell.
 
**Watch criterion B rewritten.** The tell is **an `Assume:` line restating
something the user typed in words**, not the rate. A low `assumed` count is not
criterion B and never was.
 
**Defect A′ sharpened.** A demonstration count is a floor on capability, not a
dial on frequency. Once a field has fired once, adding exemplars is a guess.
 
**New pattern-file entry — Defect D′.** A log can be truthful and still mislead
when the behaviour it reports has a second route it cannot see. `assumed []` says
the array was empty; it says nothing about whether the fact reached the user.
 
**New pattern-file entry — The Mirror.** Six recorded instances of *a failure
wearing the mask of correct behaviour* trained a reflex to distrust healthy
output. This is the first instance running the other way: **correct behaviour
wearing the mask of a failure**, and it cost a session because nobody thought to
check the good reading.
 
---
 
## Reading evidence — both directions
 
**An `Assume:` line in a composed prompt proves nothing.** `EXPAND_SYSTEM` has
written those since 0.9.23. Only `[CONTEXA] assumed [...]` in the page console
distinguishes the 0.9.49 path from the old one.
 
**The absence of one proves nothing either.** The fact may be in the body.
`assumed []` plus no `Assume:` line is not a miss until you have read the prompt
and confirmed the fact is gone.
 
The measurement gap between those two — *body carried it* vs *dropped* — is
**deliberately not closed.** Reading the composed prompt is cheap, and the
composed prompt is the product.
 
---
 
## Open, n=1, not a class
 
Arm 1's question was legitimately earned: two of its three answers changed the
command. She clicked the third — *"last one wins is fine"* — which changes
nothing, and the composer manufactured a message out of a no-op, asking Claude to
re-emit a one-liner it had already given.
 
**0.9.48's heuristic runs at question-selection time, never at answer time.**
Nothing says *you picked the null branch, so there is nothing to send*. Whether
that deserves a mechanism is unknown on one specimen. Get a second one before
building.
 
---
 
## Also logged from this run
 
- **Arm 3 hit watch criterion D** — `{total: 2, kept: 2, grounded: 1}`, a kept
  question whose quote did not match. Known residual, a few per session. Count
  before closing it.
- **Every reply came from Haiku 4.5.** CONTEXA reads the reply, so reply shape is
  an input to every criterion. Record the replying model on every test set.
- **Contaminant 3 found** — claude.ai is an SPA and the console does not clear
  between chats. A `quiet row` from arm 2 was nearly attributed to arm 3.
  Discriminate on the mount line's `top=` geometry.
---
 
## Version history
 
| version | change |
|---|---|
| 0.9.48 | first half of the heuristic — drop questions the reply settled |
| 0.9.49 | second half — state what was settled. Field-proven, shipped with the rate unexplained |
| 0.9.50 | exemplar count 1→2 of 10. Prompt-only. Moved nothing, and §2h now explains why |
| 0.9.51 | manifest version stamped on the mount line. Paid for itself on the first clean measurement |