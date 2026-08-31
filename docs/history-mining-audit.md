# The history-mining pivot — repo audit, and the wire contract

> **Status: SHIPPED, and two of the decisions below were overruled afterwards.**
> Read this as the reasoning that was available before the code existed, not as
> a description of what was built. Corrected here rather than rewritten in
> place, because an audit edited to match the outcome stops being evidence of
> anything.
>
> **What changed after this was written:**
>
> 1. **Finding A's recommendation was reversed.** This argues for keeping the
>    `accepts: ['chips','turns']` opt-in so old clients keep working — correct
>    reasoning, wrong premise. The owner then confirmed there is no installed
>    base at all, which removes the thing the opt-in protects. The whole
>    negotiation (`v`, `accepts`, `wantsQuestions`, `wantsChips`,
>    `LEGACY_STEPS_SYSTEM`, `QUESTIONS_SYSTEM`) was deleted instead. The
>    argument in §A still stands on its own terms and is the one to re-read if
>    the product ever has users on versions it cannot update.
> 2. **Finding E was half right.** `EXPAND_SYSTEM`'s composer rules did have to
>    survive — the `<paste here>` obligation, `Assume:`, one-ask-one-verb, the
>    700-char cap, the filler ban — but they were ported *into* `MOVES_SYSTEM`
>    rather than kept as a second prompt. `EXPAND_SYSTEM` itself is gone.
> 3. **The wire contract below is not what shipped.** The request is
>    `{ reply, turns }` — no `prompt`, no `v`, no `accepts` — and the negotiation
>    matrix at the end describes branches that no longer exist.
>
> Finding B (the quota arithmetic) was correct and was fixed at 0.9.58. Finding
> G (zero renders no row) shipped as specced and remains the open field-test
> question. See `CHANGELOG.md` 0.9.58.

This is step 1 and step 2 of the pivot doc's build order, done together because
step 2 depends on what step 1 found. It audits the pivot doc's retirement list and
sequencing rule against the actual repo, and then states the new wire contract on
paper — as the doc requires — before either side is coded.

The pivot doc is the product decision and this file does not overrule it. What this
file does is correct four factual premises in it, resolve its two flagged open
items, and surface three consequences it did not reach. Where the two disagree on
sequencing, the reasoning is set out in §A and was confirmed with the owner.

---

## Summary

| # | Finding | Doc said | Repo says |
|---|---|---|---|
| A | Deploy sequencing | Hard cutover, worker deploys on approval; waiting is free | No deploy order is safe; approval is the *worst* moment to flip. **Reversed** — use the existing `accepts:` opt-in |
| B | Quota arithmetic | not mentioned | `DEVICE_DAILY_LIMIT = PROMPTS_PER_DAY * 2` assumes two calls per prompt; send-ready makes it one |
| C | Capture budget | one deferred number | Two numbers. Client budget defers; the server clamp is bill protection and ships day one |
| D | Truncation convention | "tail-first" | Head-first. Policy is right, rationale is wrong |
| E | Does `EXPAND_SYSTEM` survive? (open item 1) | unresolved | **Yes** — the `<paste here>` rule and the composer rules are shape-agnostic and must be ported |
| F | Is Register C moot? (open item 2) | "likely moot, confirm" | **Register yes, voice spec no.** §2 label discipline and §3's bans survive |
| G | Zero after the pencil dies | "Zero. Unchanged invariant." | Collides with a shipped 0.9.53 decision. Flagged as field-test question #1 |
| H | Evidence grounding | not mentioned | Filter greps the reply only; must widen to turns + reply |
| I | Retirement targets | two named docs | Neither exists here; but §2c/§2d are **live `README.md` copy** |

---

## A. The sequencing rule, reversed

The doc chose a hard cutover with one rule: *worker deploy happens on approval
confirmation, not on submit.* The repo has already run this experiment.

`CHANGELOG.md`, Extension 0.9.31 — "The problem 0.9.30 created":

> 0.9.30 renamed the wire field from `steps` to `questions` … That breaks in **both**
> directions across a boundary the server cannot upgrade … And because Google
> approves on its own clock, **no deploy order avoids a window of breakage**: hold
> the worker back and newly approved clients break; deploy it early and existing
> installs break.

`CLAUDE.md` carries the same as settled architecture.

**Deploying on approval fixes only half of it.** It protects the new-client →
old-worker direction — which is already free, because during review nobody has the
new client. It does nothing about old-client → new-worker. Store approval is not an
install event: approval makes the version *available*, and each install picks it up
on Chrome's own update check, not at all while that browser is closed. Approval is
therefore the moment when ~100% of installs are still old — the worst possible time
to flip the worker.

And the break is silent. An unrecognised response shape reads as *nothing earned*
and renders a permanently quiet row. `CHANGELOG.md` names this shape three times:
"a total outage wearing the mask of correct behaviour", "…of a transient blip",
"instance 3 of the theme". The affected population is documented, not hypothetical —
"with the store twenty versions behind the affected population is real rather than
hypothetical"; `SUBMISSION.md` records 0.9.47 clearing review while 0.9.54 was live.

The doc's supporting data point measures the wrong variable: "0.9.57 submitted
overnight, approved the next morning" is *review latency*, and the risk here is
*post-approval install lag*, which review speed does not touch.
(`publishing/PUBLISHING-CHECKLIST.md` separately says "Expect a few days".)

**The rejected alternative already ships.** `worker/src/index.js:152-166`:

```js
function wantsChips(body) {
  return Array.isArray(body.accepts) && body.accepts.includes('chips');
}
```

> *A list rather than another boolean because there will be a fourth generation, and
> this is the mechanism that survives it without growing a field each time.*

`CLAUDE.md` makes it the standing instruction: *"When adding a new capability that
changes the wire shape, follow this pattern (an explicit opt-in field the client
sends) rather than a version-string comparison."* Adding `'turns'` is one more
branch in a function that already has two — not permanent dual-format complexity.

**Decision: use `accepts: ['chips','turns']`.** Deploy order stops mattering; ship
each artifact when it is ready. The `v` field then lets the worker *measure* when
pre-`turns` traffic reaches zero, which is when the old branch can be deleted — the
same retirement discipline `LEGACY_STEPS_SYSTEM` already documents.

## B. The quota arithmetic breaks, and it is public copy

`worker/src/index.js:42-44`:

```js
const PROMPTS_PER_DAY = 20;
const DEVICE_DAILY_LIMIT = PROMPTS_PER_DAY * 2;
```

> *A finished prompt costs TWO upstream calls — the questions call and the compose
> call — and both charge this same device counter, so the call ceiling is twice the
> prompt ceiling.*

Send-ready click removes the compose call, so a finished prompt costs one and the
`* 2` silently doubles the real allowance. The same comment records the precedent:
*"the store listing advertised '10 prompts a day' while the code enforced 20 calls,
which was simultaneously double and half the truth."*

Stale on ship: `publishing/STORE-LISTING.md:66`, `README.md:78`, `README.md:146`.

The drift has already begun independently — three of four move chips cost zero calls
today (`content.js:1147` inserts `c.text` directly), so `* 2` is already an
over-estimate on that path. The pivot makes it universal.

## C. Two budgets, two owners

The doc defers "the actual capture budget" to field testing. Correct for the client
number. But `worker/src/index.js` has a separate clamp whose job is stated in the
file header — *"clamps input size so a malicious client cannot run up your bill"*:

```js
const MAX_PROMPT_CHARS = 2500;
const MAX_REPLY_CHARS  = 6000;
// clamp server-side: the client cannot make a request more expensive
```

`turns[]` needs its own server clamp on day one. It is bill protection, not tuning,
and cannot wait for field results.

Cost note: prompt caching covers the *system* prefix only (`QUESTIONS_SYSTEM` is
~4.7k tokens, cached since 2026-08-27). Turns ride in the user message and are
billed uncached every call.

## D. The capture convention is head-first, not tail-first

`content.js:350-369` keeps the **beginning** and marks the cut:

```js
let cut = t.slice(0, CONTENT_BUDGET);
...
return cut.trimEnd() + CAPTURE_MARKER;
```

The doc's drop policy — pin turn one, drop oldest middles — is right, and in fact
matches the real convention better than the one it cites. Only the rationale needs
fixing.

## E. Open item 1, resolved: the composer rules survive

`background.js:133` / `worker/src/index.js:241`, inside `EXPAND_SYSTEM`'s
shape-agnostic `Rules, in order of force:` block — not in the click-list clause:

> When a material fact only the user knows is missing, put a slot in angle brackets,
> like `<main keyword>` — at most 2 slots. Material they must supply rather than
> state … takes the same form, as `<paste here>` or `<attach here>` … **CONTEXA
> never asked them for it, so this is the only place it can appear.**

Nothing in it depends on answer count. `CHANGELOG.md` (0.9.49, "An inert instruction,
found while checking") explains why it lives there: it was moved out of
`QUESTIONS_SYSTEM` because that prompt "emits JSON questions and has no channel to
the composer" — an instruction with no mechanism behind it — and the move is pinned
by a test (`extension/test.mjs:2052-2055`).

Under one-call/send-ready the new prompt *is* the composer, so it inherits this
obligation. Deleting `EXPAND_SYSTEM` wholesale would recreate the exact 0.9.49 bug.

**Port:** the slot rule, the `Assume:` mechanism, one-ask/one-imperative-verb, the
700-character cap, the filler-word ban.
**Genuinely dead with folding:** the "click list is not an ask" contract
(`EXPAND_SYSTEM:123`), the tail of the `ASSUMED` bullet, and the three click-list
exemplars at `background.js:166-186`.

## F. Open item 2, resolved: the register is moot, the voice spec is not

`docs/archive/CONTEXA-voice-spec.md` has three layers and only the first goes:

- **§0–§1, Register C proper** — the inner-voice "I", want-anchors, no second
  person. Scoped in its own words to *"questions and labels only … `EXPAND_SYSTEM`
  is out of scope entirely."* Every pivot output is prompt text addressed to Claude,
  which the spec already exempts. **The doc's "likely moot" is correct.**
- **§2 label discipline** — "labels carry payload she could stand behind"; BAD:
  `Option A`, `Proceed`, `No, different wording`. Form law, not register — and it
  matters *more* now, because pill labels become model-written for the first time
  (today's `CHIP_LABELS` at `content.js:1083` are hardcoded). **Port it.**
- **§3 "Banned in every register"** — explicitly *"pattern-file law, not taste"*:
  confirmation yes/no (*"a floor through a side door"*, Class 6b), payload-free
  options, jargon, service voice, and the closing "zero stays a product outcome."
  None are register-dependent. **All survive** — and the floor ban matters most in a
  menu shape, which is exactly where a floor would creep back in.

## G. The zero case collides with a shipped decision

The doc keeps "Zero. Unchanged invariant." while deleting the pencil.
`content.js:572-580` records why 0.9.53 added that pencil:

> A quiet row used to be free — it arrived unbidden, so silence cost the reader
> nothing. **Now they ASKED, and a chip that answers a click by sitting there is a
> dead end.**

Post-pivot the user clicks, spends a call, waits, and gets an empty labelled shell:
`renderSteps` (`content.js:1046-1078`) would draw the `✦ CONTEXA` label over an
empty `.chips` div. The doc senses the adjacent risk — *"Confirm the mechanism is
good enough before shipping, because there is nowhere left to type around it"* — but
does not connect it to zero.

Mitigating: history-mining should reach zero far less often than reply-mining, since
almost every session has prompt history to mine. **Decision: build as specced,
measure in the field before designing a fallback.** This is field-test question #1.

## H. The evidence filter reads the reply only

`worker/src/index.js:825` — `if (normReply.includes(normWs(s.evidence))) grounded++;`
— duplicated in `background.js` for the own-key path. Both prompts say every item
must be *"earned by a verbatim fragment of the reply."*

Under the pivot, ideas are mined from history, so the corpus must widen to
turns + reply or every history-earned pill fails its own grounding check. This is a
load-bearing invariant (named in both `CLAUDE.md` and `README.md`) and one of the
functions `CLAUDE.md` flags as needing to stay behaviorally identical across both
files.

Preserve both tiers: missing evidence → **dropped** (`:819`); present but ungrounded
→ **renders, counted, logged** (`:825`).

## I. What is actually deletable

`CONTEXA-v1-chips-spec.md` and the §2a–§2k build notes are **not in this repo**
(verified by `find` and `grep`). Their retirement cannot be executed as file
deletions.

But §2c/§2d are **live `README.md` copy**, under "Design notes" — including *"One
prompt, one verb. If a bullet could be sent on its own as a complete request, it's a
second job and it doesn't belong,"* which the pivot directly inverts, since pills are
defined as standing alone as their own prompt. Also dying there: "The interview is
click-only" and "Two controls must never share a label … Star asks, pencil types."
`CLAUDE.md` repeats the same principles. Both files need editing in the same change,
or the repo ships doctrine that contradicts the product.

**Privacy policy is more specific than expected.** `publishing/PRIVACY.md` does not
merely describe collection in general terms — it enumerates it: *"it sends **two
pieces of text**: 1. Your most recent message in that conversation (up to 2,500
characters). 2. Claude's reply you just received (up to 6,000 characters)."* That
itemised claim becomes false with `turns[]`, and it recurs at lines 22-27, 42-51, 93
and 123. This is a rewrite in four places, not one added line.

---

## The wire contract

Additive only. Every existing field stays, so a new client against an old worker
degrades to today's product instead of erroring.

### Request — `POST /v1/next-steps`

```jsonc
{
  "turns":  [ { "i": 1, "text": "..." } ],   // user prompts, oldest→newest; i = position among CAPTURED turns
                                             // (drafted as "true turn index"; the DOM cannot supply that,
                                             //  and the mismatch caused the 0.9.58 field regression)
  "prompt": "...",                            // KEEP — last user message (old-worker compat)
  "reply":  "...",                            // KEEP — latest reply; material now, not the trigger
  "v":      "0.9.58",
  "accepts": ["chips", "turns"]               // 'turns' is the new opt-in
}
```

**Pin/drop policy** (client): turn one is always kept — it states the goal, and
losing it decapitates the session. Oldest *middle* turns drop first. No mid-turn
truncation: dropping a whole turn beats a chopped-off sentence, and this is
head-first, consistent with `clampCapture`. Elision carries a marker in the spirit of
`CAPTURE_MARKER`.

**Server clamps, day one:** `MAX_TURNS`, `MAX_TURN_CHARS`, `MAX_TURNS_TOTAL_CHARS`.
The client-side capture budget stays deferred, per the pivot doc §7.

### Response

A third top-level shape beside `questions` and `chips`, gated on `wantsTurns()` and
mutually exclusive with both:

```jsonc
{
  "moves": [
    {
      "label":    "Add a contact form",       // 2–4 words, payload-carrying (voice spec §2)
      "text":     "<full send-ready prompt>", // composed here — click does not call again
      "evidence": "<verbatim quote from any turn, or the reply>"
    }
  ],
  "grounding": { "total": 0, "kept": 0, "grounded": 0 },
  "quota":     { "used": 0, "limit": 0 }
}
```

Zero to four items. Nothing mined → `{"moves":[]}`.

### Negotiation matrix

| Client sends | Worker serves |
|---|---|
| no `v` | `LEGACY_STEPS_SYSTEM` → `{"steps":[…]}` — untouched |
| `v` only | `QUESTIONS_SYSTEM` → `{"questions":[…],"assume":[…]}` — untouched |
| `v` + `accepts:['chips']` | may add `{"chips":[…]}` — untouched |
| `v` + `accepts:[…,'turns']` | `{"moves":[…]}` — new |

`moves` must never appear for a client that did not ask for it. An unknown key reads
to that client as nothing earned and renders a permanently quiet row — precisely how
0.9.30 broke.
