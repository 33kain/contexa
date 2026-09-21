# CONTEXA v1 — four chips, one call, one shape
 
**DOUBLY SUPERSEDED, 2026-09-01.** This spec described the interview/moves-chip
fork that shipped as 0.9.54 — itself now retired. The 0.9.58 history-mining
pivot replaced that entire mechanism with a single call returning up to four
complete send-ready messages, no chips, no interview, no click-to-answer shape.
**For current state, read `NEXT-SUBMISSION.md` and `STORELISTING.md`.** Kept
for historical record only.
 
**Status: SPEC. Nothing built.** Written 2026-08-24 after the design was settled
in conversation. Shipped product is 0.9.53 (trigger + interview). This describes
what replaces it.
 
**Read `CONTEXA-pattern-file.md` Part Two before touching either prompt.**
 
---
 
## 1. What this is
 
Today the trigger always produces an interview: up to four questions, answered by
clicking, composed into a prompt. That is the right output when the reply left
something only the user can decide. It is the wrong output — expensive, slow,
four clicks — when the reply just left a **move** on the table.
 
v1 adds the second branch. One call decides which:
 
| the reply… | CONTEXA… | clicks | calls |
|---|---|---|---|
| left something only she can decide | **asks** — the interview, unchanged | 1 + n | 2 |
| left a move on the table | **offers** — one to four chips | 1 | 1 or 2 |
| settled something worth stating | **states** it — `Assume:`, unchanged | — | — |
| left nothing | **says nothing** | — | 0 |
 
**Never both.** A row is questions, or chips, or neither. Owner's decision,
2026-08-24. A card and a chip row on screen together is two products, and it is
the exact shape claude.ai's own Cowork widget already produces by accident.
 
This completes a heuristic that has been building since 0.9.48: *would a
different answer change what happens next?* 0.9.48 answered **don't ask**. 0.9.49
answered **state it instead**. v1 adds **offer a move instead**.
 
---
 
## 2. The four chips
 
`Make it simpler` was designed and **cut from v1** — see §8.
 
| id | label | composes | earned when the reply… |
|---|---|---|---|
| `deeper` | **Take it further** | the fuller, more specific version of what she already asked | left the ask open — the current behaviour |
| `choose` | **You choose** | *"Pick between those and carry on."* | put a fork in front of her |
| `risk` | **What could go wrong?** | *"What are you assuming, and what breaks if you're wrong?"* | stated an assumption or hedged a risk |
| `why` | **Why this way?** | *"Why X rather than Y?"* | visibly chose between named alternatives |
 
**Chip text is written per reply and names the reply's own things.** *"Why Vite
rather than Webpack?"* — never *"Why that approach?"* This is 0.9.40's
named-candidates rule, and it applies to chips exactly as it applies to options.
 
**`deeper` is the odd one and it costs a second call.** Its text is an *intent*
sent to `EXPAND_SYSTEM`, not a finished message — that is what slots, `Assume:`
lines and the one-verb rule are for. `choose`, `risk` and `why` compose one or
two sentences that go straight into the message box.
 
> **Do not move `EXPAND_SYSTEM`'s rules into the new prompt to save that call.**
> 0.9.36 added 1,336 characters and brought a fixed bug straight back. Short
> chips need three composition rules, not thirty.
 
---
 
## 3. Wire
 
Response carries both arrays. **At most one is non-empty.**
 
`{"questions":[…],"chips":[…],"assume":[…]}`
 
Chip entry: `{"id":"why","text":"Why Vite rather than Webpack?","evidence":"…"}`
 
- `id` — one of the four. Anything else is dropped client-side and server-side.
- `text` — the message. For `deeper`, the intent for `EXPAND_SYSTEM`.
- `evidence` — verbatim fragment of the reply, ≤90 chars, **never paraphrased.**
  **No quotable evidence, no chip.** Same gate as questions, same `cleanX`
  treatment, same counting in `grounding`.
`questions` keeps its exact current shape. `assume` keeps its exact current
behaviour and rides with either branch — 0.9.49 is resolved and does not move.
 
**Validation, both sides, byte-identical, like `cleanAssume`:** cap at 4, drop
unknown ids, drop empty text, drop missing evidence, **deduplicate by id**, and
if `questions` is non-empty force `chips` to `[]`. The client must not be the
only thing enforcing mutual exclusion.
 
---
 
## 4. Compatibility — the part that can cause an outage
 
Three artifacts, two clocks, and the store is **twenty versions behind**. A
pre-chip extension asking a chip-aware worker gets a response with no
`questions`, reads it as an empty array, and renders a **quiet row forever**:
working product, permanent silence, nothing in the console looking wrong. That is
instance 3 of the theme, it is exactly how 0.9.30 broke, and the affected
population is real, not hypothetical.
 
**Rules:**
 
1. The worker serves chips **only** to a client that announces chip support. The
   negotiation already handles two generations (legacy `steps`, modern
   `questions`); this makes three.
2. A client that does not announce it gets `questions` — always, never an empty
   response.
3. A chip-aware client must render correctly against a worker that only ever
   sends `questions`. Missing `chips` key → `[]` → interview. No error path.
4. **Write the negotiation and its tests before the prompt.** Both directions get
   an assertion. This is the one failure here that reaches users who never asked
   for any of it.
Mili is on own-key and will never see this break. **Establish the code path
before believing a clean field test means the wire is fine.**
 
---
 
## 5. What survives from `QUESTIONS_SYSTEM`
 
It is **25,483 characters** and roughly forty assertions pin its contents. The
rewrite is a re-scoping, not a replacement.
 
**Product-wide — now covers chips too, reword to cover both:**
 
- Zero is a real answer; the reply decides; **no floor language anywhere**
- Evidence verbatim from the reply; no evidence, no output
- Scoped to **this** conversation — two messages, nothing earlier
- Never ask or offer what Claude could work out itself
- Reach past the immediate turn
- *Asking is priced* → **acting is priced.** A chip that changes nothing is
  decoration, exactly as a question that changes nothing is.
**Question-branch only — keep, scope to the interview:**
 
- zero to four questions; two to four options each
- options concrete, never categories; never an other/skip option; most likely
  option first
- label clamp at three words
- ordering as a test of comprehension
- the decidability refusal and the ordering refusal, both worked through
- click-only: an uncoverable question is dropped, free text is an escape hatch,
  material is never a question
**New, chip-branch only:**
 
- the four ids and the evidence condition for each
- one-or-other, stated in the schema line as well as the prose
- chip text is one or two sentences and names the reply's own things
- `deeper` carries an intent, not a finished message
**Position is behaviour (Defect B).** The last thing in the prompt stays the zero
restatement, extended to cover both arrays. `chips` exemplars sit **above** it,
never after. The 0.9.29 final-position assertion already catches this and caught
it once in 0.9.49 — do not weaken it.
 
**Demonstration counts (Defect A / A′).** Every one of the four ids must be
demonstrated at least once or it will never fire. Chip exemplars are one line
each, so four of them cost less than one question exemplar. `assume` stays a
minority, unchanged at 2 of N.
 
---
 
## 6. `content.js`
 
- Render one to four chips in the row instead of the card when `chips` is
  non-empty. The row already renders chips; this is not new machinery.
- Click: `deeper` → `expandPrompt` with `text` as intent, plus `assume`.
  Everything else → `insertPrompt(text)` directly, **no second call.**
- `usedIt()` on any chip click — a chip is engagement.
- The chip row and the interview card are the same slot. One replaces the other.
- **The trigger keeps its own class** and the other controls stay dashed and
  muted. `.chip.own` is currently shared by four controls; adding four more to it
  makes criterion P worse. Give the new chips their own class from the start.
---
 
## 7. Tests, written before the code
 
- both directions of the wire negotiation (§4) — **the outage-shaped ones**
- `questions` non-empty forces `chips` empty, server-side and client-side
- an unknown `id` is dropped
- a chip with no evidence is dropped, and it is counted in `grounding`
- each of the four ids is demonstrated in the prompt at least once
- zero still holds the final position, covering both arrays
- `deeper` reaches `expandPrompt`; the other three do not call anything
- no floor language survives anywhere in the prompt
- the new chips do not carry `.chip.own`
---
 
## 8. Deliberately excluded from v1
 
**`Make it simpler`.** The fifth chip, cut on 2026-08-24. Every reply ever
written can be made shorter, so it cannot be earned — ship it and the row is
never empty again, and zero stops being a product outcome. It is also the chip a
beginner would probably reach for most, which is what makes it dangerous rather
than what makes it worth having. **Revisit with field data, not with a guess.**
One line to add later.
 
**Gating it on reply length or jargon.** Considered and rejected — a rule with no
evidence behind it is Defect E.
 
---
 
## 9. Order of work
 
1. Wire negotiation + its tests (§4). Nothing else until this is green.
2. `cleanChips` in both artifacts, byte-identical.
3. Prompt rewrite (§5), byte-identical across both artifacts.
4. `content.js` render + click (§6).
5. Field test: **the tell is a chip row appearing where an interview used to.**
   Source assertions cannot see a click.
**This is a wire + prompt + `content.js` change at once.** It ships as one
release and it needs store review. It is not a `wrangler deploy` away.
 
---
 
## 10. Open
 
- **Does the interview ever fire?** The model chooses between two shapes and will
  be biased toward whichever the exemplars demonstrate more. It cannot be tuned
  by exemplar count — 0.9.50 proved that. **Gate on the condition, never a rate:**
  *ask only when you cannot write a good next message without an answer only they
  can give.* Watch the split in the field; if the interview never fires, the
  condition is wrong, not the count.
- **The empty row gets rarer.** Four earned chips plus four possible questions
  means something usually sticks. Still not a floor — chips are gated — but
  rarer is the direction a floor arrives from. **Criterion A is now the one to
  watch.**
- **Chip text is a guess again.** The interview's composed prompt contains
  answers she actually clicked, which is why it is her statement and not a
  specimen. A chip has no answers. The messages are short and predictable, so
  there is less room to invent — but the specimen rule applies to them.