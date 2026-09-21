# CONTEXA — pattern file
 
Failure classes observed in real CONTEXA output. Split out of the build notes
2026-08-22 because it kept growing and it is the document most worth reading
before touching a prompt.
 
**Architecture note, added 2026-09-01.** This file's specimens and fixes are
pinned to the pre-pivot two-call architecture — `QUESTIONS_SYSTEM` (interview)
and `EXPAND_SYSTEM` (compose). The 0.9.58 history-mining pivot replaced both
with a single call that returns up to four complete messages directly; neither
prompt exists in that shape anymore. **The failure classes and method lessons
below are still real and still worth reading** — grounding, doability, and
empty-row correctness are named directly in the 0.9.63–0.9.68 changelog as the
same concerns continuing under the new architecture. But any specimen quoting
`QUESTIONS_SYSTEM`/`EXPAND_SYSTEM` by name, or describing the interview/click
mechanism, describes the retired system — check current code before assuming a
fix or convention still applies verbatim.
 
**Every entry in the CHIP classes is a real capture.** None are invented, and
**every single one scored perfectly grounded** — the evidence gate cannot see
any of them. `{total, kept, grounded}` measures honesty, never usefulness. The
only detector for that section is a human reading the row.
 
**Part two — prompt-authoring defects — was added 2026-08-23** after three
sessions lost to one cause. Read it before editing either system prompt.
 
**Part three — diagnostic contamination — was added 2026-08-23 (session 2).**
Read it before trusting any number read out of the console.
 
---
 
# PART ONE — CHIP AND QUESTION DEFECTS
 
## Class 1 — a user-only fact asserted as observed
 
**n=3. Fixed in 0.9.25** by worked exemplars rather than another rule; the rules
already existed and were being ignored.
 
The draft stated something only the user could know — what they did, what
happened on their machine, which branch they were on — as though CONTEXA had
seen it. Fix: mark it. Open the sentence with `Assume` so the user can strike
it, or leave `<a slot in angle brackets>`.
 
### Possible fourth instance, from the standalone chip *(2026-08-24)* — and the argument against calling it one
 
Claude's reply told her to run `rmdir dist -r -force; npm run build`. She clicked
`→ Write my next message` **without running anything**, and got:
 
> I ran `rmdir dist -r -force` and `npm run build` again but it's still failing.
> Walk me through the next step.
> Assume: I'm on Windows using PowerShell
 
The first clause asserts an action she had not taken and an outcome that had not
happened, unmarked — while the *inferred* fact underneath it got the `Assume:`
line. **The marking rule fired on the smaller inference and missed the larger
one.**
 
**The counter-argument, which is not obviously wrong.** 0.9.25 was written for
**chips** — a model's guess at what the user might say, sitting in a card. The
composed prompt is a **draft of her own message**, and every clause in it is
something she is about to assert. Marking user-only facts there would mean
marking nearly the whole prompt, and *"I ran it, it still fails"* is the single
most likely next message after being told to run something. Under that reading
the composer is doing its job and the user edits before sending, which is the
guarantee the product actually makes.
 
**Unresolved, deliberately.** The distinguishing question is whether the
standalone chip is more chip-like than an interview's composed prompt — it
composes from **nothing typed and nothing clicked**, so unlike an interview
prompt it contains no statement the user actually made. That is an argument for
treating it as a chip and marking it. One specimen. **Get a second from the
standalone path before changing `EXPAND_SYSTEM`.**
 
---
 
## Class 2 — the chip commands the USER'S action
 
**n=1, opened 2026-08-22.** Specimen, produced off a message that ended
*"Say go and I build it"*:
 
> Go — deploy 0.9.28 to both files, byte-identical, and run wrangler deploy now.
 
`wrangler deploy` runs on the user's machine. The prompt is explicit: when only
the user can act, the text directs Claude to prepare *Claude's* side. The rule
existed and was ignored — the same shape as Class 1.
 
It was also a restatement of the source message's own closing line, and it
scored perfectly grounded because every phrase in it was quotable.
 
**Why this class matters more than its rate:** a chip that says "go" removes the
user's decision without adding information. Sent unread, a production deploy
happens because a language model said yes to a question a language model asked.
This is the concrete case behind the specimen rule.
 
---
 
## Class 3 — the timid chip
 
**n=1, 2026-08-22.** Off a message containing a blocking store submission and a
named predicted failure, the chip proposed *adding a risk to a document as a
formal test*. Paperwork about the work.
 
It picked the least consequential open thing in the pair. It is **not** the
obvious step, so the obvious-step ban did not catch it.
 
**Lesson: banning the obvious does not buy ambition.** A model can satisfy "do
not return the obvious step" by choosing something tangential and low-stakes.
 
---
 
## Class 4 — the decorated obvious step
 
**n=1, 2026-08-22.** A message ended with an explicit either/or addressed to the
owner. The chip picked a side — not by answering "yes", which the ban would have
caught, but by answering yes **dressed in enough specification to look like a
new move**.
 
**Lesson: the obvious-step ban can be satisfied by decorating the obvious step.**
 
**Candidate rule, not yet built:** a fork about *the work* is collapsible and
always has been. A fork about *whether to do the work* is a governance decision
that belongs to the user — and that is what a quiet row is for. Nothing in the
prompt currently distinguishes them.
 
---
 
## Class 5 — cites a source's authority, drops its precondition
 
**n=3, 2026-08-22. The most dangerous class so far.** Specimen (item 2 of three
in a composed interview output):
 
> Remove the legacy dual-schema support this session: delete
> LEGACY_STEPS_SYSTEM, the negotiation logic, and the v field, per the
> RETIREMENT plan in §4.
 
§4 does contain a retirement plan. It also contains its condition: *"once the
store has been on 0.9.30+ long enough that no older install is plausibly still
calling."* **The store was on 0.9.27.** Executing this would have broken every
existing user immediately — undoing, in one commit, the outage that had just
been engineered away.
 
**Second instance, same evening:** a chip reused the owner's own numbering
("do item 3 and leave 2") with different referents, and imported the
store-0.9.31 precondition onto an unrelated capture-bug investigation.
 
**Third instance:** a chip asked to "fix the timestamp" on two pattern-file
entries, claiming they were *"backdated to when the probe actually ran"* rather
than dated now. The probe had run the same day; the dates were already today,
so there was nothing to fix — and its stated principle was backwards, since a
finding should carry the date its evidence was produced. **A fabricated
discrepancy with a plausible editorial rule attached.**
 
Same family in all three — **borrowed authority, altered content.**
 
**Why it is worse than Classes 3 and 4: the citation is what makes it
persuasive.** The same instruction without *"per the RETIREMENT plan in §4"*
would have prompted a check.
 
**Watch for:** any chip that cites a plan, a spec, a section number, a date or a
prior decision. Read the source before acting, specifically for the condition
attached to it — and check that the discrepancy it describes is real.
 
### HYPOTHESIS REFUTED (probe v2, 2026-08-22)
 
Claude proposed that Class 5 was a **Cowork artifact** — that `captureText` was
reading project documents written via tool calls, so chips were grounded in
specification text rather than conversation. Tidy: both instances came from
Cowork, none from chat.
 
**The control killed it.** Probe v2 printed the surrounding context for every
document-shaped hit. `§4` came from Claude's own sentence *about* §4; the
SCREAMING_CONSTANT was Claude listing `BLOCK_TAGS, SKIP_TAGS, CODE_KEEP_LINES`
in prose. No document content was captured.
 
**Class 5 is a genuine reasoning defect in the chip, on any surface.** No fix to
capture will remove it.
 
*Method note: the hypothesis was Claude's own, it was plausible, and it survived
until a control with matched topic was run. Run the control.*
 
---
 
## Class 6 — the composed prompt adds jobs the user never clicked
 
**n=2, 2026-08-23. Fixed in 0.9.34 and 0.9.36, in two passes, because the first
diagnosis was drawn from too few specimens.**
 
**Specimen A (facts-only interview).** Three clicked answers, all facts about
the user — symptoms, medication, immune status. The composed prompt re-asked the
question *and* bolted on: *"Objasni da li tegobe menjaju tu procenu, i da li ima
smisla prekinuti probiotik pa ponoviti analizu, **kao što si pomenuo**."*
 
**The tell was the composer's own words — "as you mentioned".** It knew it was
asking Claude to repeat itself and said so. 36% of the prompt was invented, and
the invented half produced a section whose conclusion was that the question did
not matter.
 
**Cause:** a click list is `Label: answer` lines with **no verb in it**, sent
under the label `ROUGH ASK:` — the same label a typed ask gets. The composer's
job is "rewrite this ask"; handed no ask, it manufactures one, and the nearest
supply of ready-made asks is Claude's reply. Fixed in 0.9.34: a decision among
the answers IS the ask; if every answer is a fact, the missing ask is the user's
own last message, re-asked with the facts folded in.
 
**Specimen B (decision interview) broke the 0.9.34 rule the same day.** Two
clicked answers, one of them a real decision — and the prompt still came back
with **four imperative verbs** (Write, spell, spell, give) in 816 characters,
three of the four harvested from the reply.
 
**The real line, from 0.9.36:** a **constraint** shapes the one thing being
produced. A **sub-deliverable** is another thing to produce. The composer scored
both as specificity and only the first is.
 
> **The mechanical test: could this bullet be sent on its own as a complete
> request? Then it is a separate job — drop it.**
 
**Method note, and the more valuable half.** The 0.9.34 rule — *facts-only goes
wrong, decisions are fine* — was drawn from **two** specimens, one of each kind.
The third broke it. **One good case is not a rule**, and the good case is the one
that misleads, because it looks like confirmation.
 
Verified 2026-08-23: same interview shape, 596 characters, **one** verb, four
bullets that all fail the send-alone test. Plus two behaviours nobody wrote an
exemplar for — a fill-in form in Claude's reply was not converted into questions,
and the missing story went into an `Assume:` line instead.
 
**Counting verbs is a string match; the send-alone test is structural (added
2026-08-24).** A correct composed prompt — *"Give me the same one-liner… **Keep
it** PowerShell 5.1 only…"* — carries two imperative verbs and passes, because
`Keep it …` cannot be sent alone. **Specimen B was a real defect not because it
had four verbs but because three of them named separate deliverables.** A verb
count would have cleared the good prompt wrongly. See the method lesson below:
this is the same error as matching text to find chrome.
 
### Class 6b — the null branch *(n=2, 2026-08-24, NOT yet a class)*
 
An interview question can be legitimately earned while **its most likely answer
leads to a no-op message.**
 
**Specimen A.** A question with three options, two of which changed the command.
The user clicked the third — *"last one wins is fine"* — which changed nothing,
and the composer manufactured a message out of it, asking Claude to re-emit a
one-liner it had already produced.
 
**Specimen B, same day, different shape.** Off a reply that treated a decision as
already settled, CONTEXA asked *"Use 'Type & create magic' as the new chip
label?"* with **"Yes, use that label" / "No, different wording"**. Option 1
changes nothing; option 2 changes something but carries no payload — it names no
alternative, so clicking it composes *"use different wording"* without saying
which. **A confirmation question is how a floor returns through a side door:**
*do the thing the reply proposed? yes/no* can be generated off any reply, forever,
which guarantees a non-empty row.
 
One mitigating fact on B: the alternative labels only ever existed in a question
widget, never in the reply text, so CONTEXA structurally could not name them —
that half is the two-message ceiling (Contaminant 2), not a prompt bug. **The
asking-at-all half is not.**
 
**0.9.48's heuristic runs at question-selection time, never at answer time.**
Nothing says *you picked the null branch, so there is nothing to send*. Two
specimens, different shapes — **enough to name, not enough to fix.**
 
**And the boundary of 6b, drawn 2026-08-28 after nearly grading a good case as a
bad one.** A yes/no on the reply's own proposal is 6b **only when the reply had
already settled the thing.** Specimen B's reply had. When the reply *asks* —
*"javi ako hoćeš da to ubacim"* — and both options change the next message,
it is a fork the reply handed over, which is sharpened criterion C working, not
a floor. The first reading of that capture called it banned; the second read
both documents and found they do not overlap. **Check which side of that line a
confirmation sits on before filing it.**
 
---
 
# PART TWO — PROMPT-AUTHORING DEFECTS
 
*Added 2026-08-23. These are not defects in CONTEXA's output; they are defects
in how the system prompts are written, and they cost three sessions in one day
because each looked like a different bug.*
 
## Defect A — a required output field that no exemplar demonstrates
 
**n=2, both found 2026-08-23, four hours apart, on different prompts.**
 
> **THE RULE: every required part of the output must be DEMONSTRATED at least
> once, not merely required.**
 
**Instance 1 — `QUESTIONS_SYSTEM` and `evidence`.** Five worked exemplars, each
showing `label`, `question`, `options`. **None showed `evidence`** — a field
`refineSteps` discards the whole question for missing. Five demonstrations of a
three-field object against two lines of prose insisting on four.
 
Symptom: *"some chats worked, some didn't."* It was a coin flip, and it had been
one since 0.9.30. When the model followed the examples, every question was
discarded and the user got an error card.
 
**Instance 2 — `EXPAND_SYSTEM` and the JSON wrapper.** Nine exemplars showing
`PROMPT: <plain text>`. **Zero showing `{"prompt":"..."}`.** One instruction line
asking for JSON against nine worked examples showing text.
 
Symptom: `parse failure {stop:'end_turn', ceiling:1200}` with a **perfectly good
prompt** in the text field, unwrapped. Rendered to the user as *"Couldn't write
suggestions for this reply."*
 
**Both fixed the same way:** one complete, filled, correct answer added to the
prompt. Evidence failures went from all-or-nothing to roughly one call in ten.
 
**Diagnostic that works: count the demonstrations.** For each field the schema
requires, grep the exemplars for it. Zero is a live bug regardless of how
forcefully the rule is stated. This is the 0.9.25 lesson generalised — rules
lose to exemplars — but the earlier version only covered *behaviour*. It also
covers **shape**.
 
**And the limit of the rule, found 2026-08-28.** Register C's want-anchor was
written as a rule and missed its first field case; the fix added a worked
exemplar of exactly that shape. On the very next capture the model returned a
different branch entirely, so **an exemplar matching the input almost verbatim
did not decide the outcome**. Exemplars beat rules; they do not beat everything.
Where a defect crosses a branch boundary, demonstrating the right answer inside
one branch may not be where the fix belongs.
 
### Defect A′ — the same lever pulled the wrong way *(0.9.49)*
 
Defect A says demonstrate what you require. **It does not say demonstrate it
often**, and for one field the difference is the whole feature.
 
`assume` (0.9.49) is optional output that a model is rewarded for producing.
Demonstrating it as heavily as `evidence` would have built a floor — the thing
every Part One defect came from. Its failure directions are **asymmetric**:
 
- **Under-firing** lands on the previously shipped behaviour. Harmless.
- **Over-firing** puts a fabricated line inside a message the user sends to
  Claude. Harmful, and invisible until someone reads a prompt closely.
So the target is *at least one* demonstration and *no more than a third*, pinned
by a test that counts exemplar lines rather than by judgement.
 
**And the ceiling half turned out not to be the live constraint (2026-08-24).**
0.9.50 raised the count 1→2 of 10 and the observed rate did not move, because
the model was already declining correctly for a reason no exemplar count
touches: it declines facts the user stated in words. **A demonstration count is
a floor on capability, not a dial on frequency.** Build notes §2h.
 
**Generalised: before demonstrating a field more, ask which way it fails.**
A field the pipeline discards for missing (`evidence`) wants maximum
demonstration. A field the pipeline is happy to see empty (`assume`) wants the
minimum that still proves the shape — **and once it has fired once, adding more
demonstrations is a guess, not a lever.**
 
## Defect B — position is behaviour
 
**n=2. First 0.9.35**, then again in **0.9.49 — caught by a test, not by review.**
 
**0.9.35.** Two correct new exemplars were **appended to the end** of
`EXPAND_SYSTEM`'s example block, putting a five-line bulleted block of raw prose
immediately before *"Reply with ONLY minified JSON"*. The model answered with a
five-line bulleted block of raw prose.
 
**Adding correct content in the wrong place is a functional change.** No amount
of re-reading the rule would have caught it — the rule was right.
 
**But the fix was wrong too, and that is the real lesson.** Moving the exemplars
was treated as *the* fix. It was rearranging nine plain-text demonstrations of a
prompt that never demonstrated JSON at all (Defect A, instance 2). It moved the
odds; the bug returned the moment 0.9.36 added 1,336 characters. **A change that
improves a symptom is not proof you found the cause.**
 
**0.9.49, same defect, opposite content.** The first draft appended the
standalone example `{"questions":[],"assume":["…"]}` to the end of
`QUESTIONS_SYSTEM`, displacing the zero restatement from the final position. The
last thing a model would have read was **"no questions, therefore add an
assumption"** — a floor, written into the highest-leverage position in the
prompt, by a change whose entire purpose was to avoid building one.
 
Caught in under a minute by the 0.9.29 final-position assertion, on the first
test run. **The test was written for a different reason four releases earlier
and it still fired.** That is the argument for keeping position assertions even
when they feel like syntax pinning: this one is about *behaviour at a position*,
not about how the code is written.
 
**Third instance, 2026-08-28, and it is about GROUPING rather than the tail.**
The worked-example list is ordered: question examples, then move examples. A new
question exemplar was appended to the end of the list, landing it *after* the
three move examples and splitting the question block in two. Nothing in the
prompt says the grouping is load-bearing; the list's own shape says it. Filed as
hygiene to restore regardless of whether it caused the fork behaviour observed
in the same session — **which it may not have, and that is exactly why it should
not be fixed in the same change as anything being measured.**
 
Current conventions, deliberately different and both written down:
 
- `EXPAND_SYSTEM` ends with **the filled JSON answer**. Its risk is shape.
- `QUESTIONS_SYSTEM` ends with **a disclaimer after** its filled answer —
  *"fixes the SHAPE, never the count… a reply that left nothing open still
  returns `{"questions":[]}`"*. Its risk is the model copying a **count** and
  killing the zero-questions outcome, which outranks tail purity. **`assume`
  examples must sit above that line, never after it.**
## Defect C — an assertion that encodes a workaround blocks the real fix
 
**n=1, 0.9.37.** 0.9.35's tail check demanded the JSON *instruction* sit last
with a single-line `PROMPT:` before it. That was the workaround written down as
though it were the requirement — and it **failed when the actual fix landed**,
because the filled example now belongs last.
 
Replaced with the honest invariant: *the last thing in the prompt is the correct
output, literally.*
 
**When a test fails on a change you believe in, check whether the test encodes a
belief rather than a requirement.** Not an excuse to delete tests — an excuse to
read them.
 
**Four more in one edit, 2026-08-24 (0.9.53).** All four pinned **distance or
arity** rather than behaviour: two `[\s\S]{0,N}` spans too short for a comment
that grew, one `const ctx = ` that pinned *where* an object is built rather than
that it carries the pair, and one trailing `\)` that pinned a call's argument
count. Every requirement underneath survived the change untouched. Loosened to
the requirement each was written for — `[,)]` instead of `\)`, so a bare `true`
still fails.
 
**And the counter-example landed in the same edit.** An assertion that the
settings page says *"stays quiet"* — that silence is a real outcome, not a
failure — caught a genuine regression when a flow rewrite described the new
mechanism and dropped the promise. **The test was right and the code was wrong.**
Read the failing test; do not assume it is the stale one.
 
**Two more, 2026-08-28, and this pair is the purest form of the defect.** Both
pinned the interview's free-text box — *"CLICKING IS THE ONLY REQUIRED INPUT"*
and *"escape hatch, never the intended path"* — after 0.9.55 removed the box
entirely. The tests were not merely stale: they were **holding a description of
a UI that no longer existed**, and a reader trusting them would have concluded
the box was still there. Moved to the truth (*the card has NO PLACE TO TYPE*),
which is the stronger statement, not a loosened one.
 
## Defect D — a diagnostic that asserts a cause it cannot know
 
**n=1, 0.9.35→0.9.36.** `withEv` drops a question for a missing `text` **or** a
missing `evidence`, and the new log reported both as *"None carried usable
evidence."*
 
The exemplars say `question` where the schema says `text`, so a model copying an
exemplar lands in that filter **wearing an evidence failure's face**. The log
would have sent the next reader at the wrong rule.
 
Both paths now count the three causes apart and name all three every time.
Field result: `0 with no usable "text"` on every call observed, which settled a
standing question — the `question`/`text` mismatch does not bite, so the
exemplars keep their wording and the change costs nothing.
 
**A log that names one cause out of several is worse than a log that names
none**, because it is trusted.
 
### Defect D′ — a log that cannot see the OTHER route *(2026-08-24)*
 
Defect D is one log conflating several causes. Its sibling is a log that is
**correct and still misleads**, because the behaviour it reports has a second
route it never observes.
 
`[CONTEXA] assumed []` is truthful: the `assume` array was empty. It says
nothing about whether the settled fact reached the user's message box, because
`EXPAND_SYSTEM` may have carried that fact **in the body** — which is exactly
what it does for any fact the user typed in words. A session read a low
`assumed` rate as under-firing and spent a day on it. The fact had been arriving
the whole time.
 
> **Diagnostic: when a feature has two routes to the same outcome, a log on one
> route is a log about plumbing, not about the product. Instrument the OUTCOME
> — or accept that the discriminator is reading the product, and write that down
> so nobody rediscovers it as a bug.**
 
Not fixed, deliberately: reading the composed prompt is cheap, and the composed
prompt *is* the product. Recorded in build notes §2h.
 
## Defect E — an instruction with no mechanism behind it
 
**n=1, live for sixteen releases. Found 0.9.49 while checking something else.**
 
`QUESTIONS_SYSTEM` told the model, about a question it had just refused:
 
> The story itself goes into the composed prompt as `<paste here>`.
 
and, in the click-only rule, that material the user must supply *"belongs in the
composed prompt as `<paste here>` or `<attach here>`."*
 
**Neither was true.** `QUESTIONS_SYSTEM` emits JSON questions. It has no channel
to the composer. The composed prompt is written by a **separate call** with a
**separate prompt** that never learns what the questions step refused. Two
sentences instructing a model to perform an action it structurally cannot.
 
It probably worked sometimes anyway, because `EXPAND_SYSTEM` has an independent
`<slot>` rule that could reach the same outcome by coincidence. That is what made
it survive: **an instruction with no mechanism can still correlate with the right
result, and correlation reads as proof.**
 
Fixed by moving the obligation to `EXPAND_SYSTEM`, which is the only artifact
that can honour it, and pinning it with a test.
 
> **Diagnostic: when a prompt says what happens NEXT — downstream, in another
> artifact, after this call returns — find the code that carries it. Prose
> describing a downstream effect is not a channel to it.**
 
## Defect F — two controls wearing one label *(0.9.53)*
 
**n=1, caught by the owner in the field, not by review or by a test.**
 
The 0.9.53 trigger chip was written by copying the fifth chip's label verbatim.
One spends a model call and comes back with questions; the other opens a text
box. **They render in the same row.** The label had been chosen one release
earlier specifically because it says *what to do* — and on the trigger it said
the wrong thing, because the action there is a click and typing is now the rare
fallback.
 
Trigger is **`✦ What do I say next?`**; the fifth chip keeps
**`✎ Type & create magic`**. **Star asks, pencil types.**
 
**Pinned by an assertion that compares the two labels rather than checking
either one.** This is the rare case where the requirement genuinely is about
copy — not what either button says, but that they do not say the same thing —
and it is a *behaviour* assertion in copy's clothing: two controls that do
different things must not be indistinguishable to the reader.
 
> **Diagnostic: when a new control reuses an existing control's label, ask
> whether they can appear together. If they can, the label is now ambiguous
> however good it was in isolation.**
 
**Closed by construction in 0.9.55**: the trigger became the mascot, which has
no text label at all and shares no class. The comparison assertion still guards
the pair through the mascot's `aria-label`.
 
## Defect G — a prompt that describes a UI the product no longer has *(2026-08-28)*
 
**n=1, found while editing for an unrelated reason.**
 
0.9.55 removed the interview's free-text box. `QUESTIONS_SYSTEM` went on telling
the model *"the free-text box is an escape hatch, never the intended path"* and
that *"the interface adds those itself"* for other/skip options. The rule's
**conclusion** was still correct — drop a question you cannot write options for
— so nothing looked broken, and no test could see it: two of the assertions were
themselves pinning the dead sentence (Defect C).
 
**This is the "public copy goes stale silently" rule finding a new surface.** A
system prompt is copy about the product, written for a reader who cannot check
it against the product. When a mechanism changes, the prompts are part of the
sweep — manifest, listing, privacy policy, settings page **and both system
prompts**.
 
> **Diagnostic: grep both prompts for every UI noun the change touched — box,
> button, row, card, skip — and read each hit against what now exists.**
 
---
 
# PART THREE — DIAGNOSTIC CONTAMINATION
 
*Added 2026-08-23 (session 2). Defects in the measurement, not in the product.
All cost real conclusions.*
 
## Contaminant 1 — two builds of the extension running at once
 
**Found 2026-08-23 after roughly two sessions of contaminated readings.**
 
The unpacked dev build (0.9.49) and the **Chrome Web Store install (0.9.32)**
were both enabled and both injecting into claude.ai. Every reply produced two
`grounding` lines at different line numbers.
 
**The discriminator is the line number, and it is version-stamped for free.**
Grepping every shipped zip pinned `358` to exactly v0.9.32 — the store build.
 
Consequences, all of which had been happening silently:
 
- **Double billing.** Two independent questions calls per reply. One frame caught
  them disagreeing: `{total: 3, kept: 3}` from one and `{total: 4, kept: 4}` from
  the other, off the same reply.
- **Card roulette.** Both builds run
  `querySelectorAll('[data-contexa]').remove()`, so they delete each other's
  card. Some cards being clicked were seventeen versions old.
- **Every log-based conclusion in two sessions was suspect.**
> **Before reading any number out of that console, check the line number, and
> check that only ONE build is logging.** The project rule was already
> "establish which code path produced it"; own-key vs worker was being checked
> every time and **which build** was never checked once.
 
**0.9.51 made this cheap** — the mount line now carries the manifest version. It
paid for itself on the first use, 2026-08-24.
 
**And its blind spot, 2026-08-28: the version only moves when someone moves it.**
Two different prompts shipped as 0.9.56 within two hours during one development
cycle, so the mount line could not tell a pre-fix run from a post-fix one. The
discriminator that worked was **the build artifact itself** — reading
`build-ready/background.js` for the new string and comparing its mtime against
the write. **When the version cannot discriminate, the file can.**
 
## Contaminant 2 — claude.ai's own question widget looks like CONTEXA's card
 
**Found 2026-08-23, immediately after Contaminant 1, and nearly misdiagnosed as
a recurrence of it.**
 
claude.ai renders its own clarifying-question widget directly above the
composer: numbered options, a "Something else" field, a Skip, an `N of M` nav.
It is visually near-identical to CONTEXA's interview card, and both can be on
screen simultaneously, asking overlapping questions about the same reply.
 
**⚠️ It is NO LONGER Cowork-only — confirmed 2026-08-28.** This entry said for
five days that the widget was a Cowork surface and *"most users never see it"*.
A field capture shows it in an ordinary `claude.ai/chat/` conversation, with
CONTEXA's mascot mounted directly beneath it: *"What's the occasion or context
for this speech?"*, five numbered options including *"Other (describe in
follow-up)"*, a *"Something else"* row and a `1 of 3` nav. **The collision is now
on the main surface, where most users are.**
 
**The structural discriminators, in order of reliability:**
 
1. **Count `grounding` lines.** One per CONTEXA card, per reply.
2. **The `✦ CONTEXA` label** sits directly above CONTEXA's card and nothing else.
3. **`N of M` versus dots.** 0.9.55 replaced our `N of M` nav with progress
   dots, chosen partly as a cheap discriminator. It is now the fastest visual
   tell, and the choice earned itself back within a day.
4. **State divergence.** One capture showed CONTEXA's card reading
   *"Writing your prompt…"* while the other read *"2 of 2"* — two states, so two
   owners.
**Still deliberately not fixed** (owner's call, 2026-08-23): detecting
claude.ai's widget would mean binding to their markup. But the reason given at
the time — Cowork-only, rarely seen — no longer holds, so if it is reopened it
should be reopened on the new facts.
 
**One honest finding inside it.** Claude's widget produced better options than
CONTEXA on the same reply, naming real candidates where CONTEXA offered a
bucket. That reads like 0.9.40 regressing and **is not**: CONTEXA sees exactly
two messages. Claude's widget has the whole conversation and the project.
**A capability ceiling, not a prompt bug.**
 
**Corollary, and it constrains `assume` directly:** when the prompt says *"THIS
conversation already settles the answer"*, the model's "conversation" is those
two messages. A fact established five turns ago is invisible.
 
## Contaminant 3 — the console does not clear between chats
 
**Found 2026-08-24, during the five-arm `assume` test.**
 
claude.ai is an SPA. Navigating between conversations **does not clear the
console**, so the previous chat's `[CONTEXA]` lines sit directly above the
current chat's and read as though they belong to it. A `quiet row` line from
arm 2 was nearly attributed to arm 3, which would have recorded a fire on an arm
that missed.
 
**The discriminator is the mount line's geometry.** `card mounted … top=49
bottom=754` recurring verbatim two chats later is the *same* mount scrolled into
view, not a new one — `top=` differs per card. Anchor on that, or clear the
console between arms.
 
**Confirmed again 2026-08-28 from screen recordings:** two captures of different
chats showed the same five leading `[CONTEXA]` lines, with only the tail new.
Reading the tail is safe; reading the head attributes another chat's run to the
one on screen.
 
Same family as Contaminants 1 and 2: **identical-looking output, different
owner.** Line number distinguished the first, DOM position the second, mount
geometry the third. **Shape has now failed to identify the owner three times.**
 
## Contaminant 4 — the staged copy goes stale silently *(2026-08-24)*
 
A session's staged copy of the repo was **twenty-nine versions behind** —
`manifest.json` read 0.9.22 while the real tree was at 0.9.51. The strings being
edited did not exist in it at all, which is the only reason it was caught.
 
**A stale copy that still contains the code you are looking for is the dangerous
version**, and nothing about it looks wrong.
 
> **Check the manifest version in the staged copy before trusting a single line
> of it. After writing back, diff the disk against yours and confirm every
> difference is one you made.**
 
## Contaminant 5 — a mutation that misses its target reads as a blind test *(2026-08-28)*
 
A new structural assertion was mutation-tested by injecting `"your"` into an
option string. The suite stayed green, which said the guard was blind. It was
not: **the string appeared twice in the file** — once inside the rule that
quotes it as an example, once in the option set — and `replace(…, 1)` hit the
first. The guard had never been challenged.
 
Re-run against the option set specifically, the guard fired immediately.
 
> **Grade a control on what actually varied, not what you intended.** A mutation
> test has two ways to come back green and only one of them is a finding. Assert
> that the mutation landed where you aimed it before believing the result.
 
---
 
# The theme
 
**A total failure wears the mask of correct behaviour.** Six instances, and it is
the single most expensive pattern in this project:
 
1. A **quiet row** rendered as *"Couldn't write suggestions"* on an older store
   build — silence looking like a crash.
2. A **schema mismatch** rendered as the same sentence — a total outage looking
   like an occasional one.
3. The 0.9.31 parser read only `parsed.questions` while the legacy prompt emits
   `steps`. Every legacy call would have produced an empty array, read as *the
   model earned nothing* and turned into a **quiet row** — a total outage looking
   like the product working.
4. **Credit exhaustion** rendered as *"Check your connection and try again in a
   moment"* — both halves false, the second one false forever.
5. **`[CONTEXA] evidence []`** was logged both for a deliberate quiet row and for
   a total gate failure. Identical output, opposite meanings.
6. **The evidence coin flip** looked like *"some chats just don't get
   suggestions"* — an intermittent annoyance that was actually a systematic
   prompt defect firing on every call where the model followed the examples.
**Rule that falls out of it:** when a state can be reached two ways and only one
of them is a defect, **the two must be distinguishable at the end of the pipe.**
 
**Corollary added 2026-08-23:** and the distinction must be *visible without
running a test*.
 
**Second corollary, from Part Three:** the same applies to the *measurement*.
 
## THE MIRROR — correct behaviour wearing the mask of a failure
 
**Added 2026-08-24, and it is the first instance running the other way.**
 
A low `assumed` rate looked like a feature under-firing. It was the feature
**declining work a second mechanism had already done**: for any fact the user
typed in words, `EXPAND_SYSTEM` carries it in the body of the composed prompt,
so an `Assume:` line restating it would be duplication. Both fires ever recorded
came off an implicit `PS C:\>` prompt; four explicit facts across three domains
all correctly declined.
 
It cost a full session of hunting, two competing explanations, and a shipped
release documented as *"unresolved."* **The single click that settled it was
reading the composed prompt** — the stated fact was there, in the body,
`Keep it PowerShell 5.1 only`, no `Assume:` line and none needed.
 
> **The theme's rule is symmetric and was only ever written one way. A state
> reachable two ways needs distinguishing even when the likely reading is the
> BAD one — because the good reading is the one nobody checks.** Six instances
> of a failure looking correct trained a reflex to distrust healthy-looking
> output. Nothing trained the reverse, so a healthy feature that looked broken
> got a day of debugging instead of one look at its output.
 
### And now the failure the mirror predicted — BOTH routes fired *(n=1, 2026-08-28, on camera)*
 
The mirror established that `assume` and the composer body are two routes for
one obligation and that **only one fires per fact** (build notes §2h).
`EXPAND_SYSTEM` is told this outright — *the same fact arrives twice, so state
it once*. A screen recording caught it stating the fact twice, in one composed
prompt, off the standalone assume chip:
 
> I'm on Windows 11, PowerShell 5.1 only — no WSL, no git bash. My node build
> outputs to dist\ and I need to copy just the .js files into a folder called
> release, flattening subfolders. Give me the one-liner.
>
> Assume: I'm on Windows 11 with PowerShell 5.1 only, no WSL or git bash
 
**The body is correct and is not the defect.** A standalone assume click sends a
payload with no verb in it, so §2c applies: the missing ask is the user's own
last message, re-asked with the facts folded in — which is exactly what the
first paragraph is. **The `Assume:` line underneath is the duplication**, and it
is criterion B with a capture rather than an inference.
 
**Why it belongs here rather than as a new class:** the mechanism is the mirror's
own, running in its unexamined direction. The mirror documented the route
declining correctly and taught the project to stop reading a low rate as a bug.
Nothing documented what it looks like when neither route declines. It looks like
this, and it is legible only by reading the composed prompt — the same
discriminator, for the same reason.
 
**Not fixed in 0.9.56**, which is a `QUESTIONS_SYSTEM` release; `EXPAND_SYSTEM`
was untouched. **Get a second specimen before editing it** — the gate has been
loosened once by request and rejected outright (see Deliberate rejections), and
this is the failure that rejection was protecting against, arriving from the
opposite side.
 
**And 0.9.53 inverted the diagnostic itself.** Its whole saving is an **absence**
— `card mounted` with no `grounding` line under it. Nothing looks different when
it breaks; the product keeps working and quietly starts billing again. Watch
criterion N exists for exactly that, and **no source assertion can observe it.**
 
---
 
# FIXED IN 0.9.32 — visually hidden text was being captured
 
`SKIP_TAGS` is tag-based, so it could not catch text hidden by CSS but present
in the DOM. claude.ai renders the thinking header **twice**: once inside
`button[data-testid=tool-status-pill]`, correctly skipped, and once in a
`span.sr-only` outside it — which shipped on every reply carrying a thinking
block, for the life of the product.
 
Both walkers now also skip `.sr-only`, `[data-testid^="tool-status"]` and
`[class*="artifact-block"]`. Four tests pin it in both directions.
 
**The cost was never tokens.** Hidden text is **quotable** — a chip grounded in
*"Thought for 8s"* passes the evidence gate cleanly and means nothing.
 
## The method lesson, which outlived the bug
 
Three string-matching detectors in one evening reported chrome that was not
there. Every time, the hits were **prose about chrome**.
 
**Matching on text cannot distinguish a thing from prose about that thing.**
 
Probe v3 escaped it by finding the **deepest DOM element** holding each string
and printing its ancestor chain.
 
**Second application, 2026-08-23.** Seven regex assertions pinned the 0.9.33
scroll watcher and **all seven passed while two real defects went through**.
Extracting the function and *running* it against a fake viewport caught both.
Where a change has an invisible failure mode, execute it.
 
**Third application, 2026-08-23 session 2** — Contaminant 2. Two question cards,
identical in shape, different in owner. **Shape identified neither. Position and
state identified both.**
 
**Fourth application, 2026-08-24 — aimed at our OWN watch list.** Criterion J
reads *"more than one imperative verb in a composed prompt."* That is a
string-matching detector, and it flags a correct prompt. **The send-alone test is
the structural version and it is the one 0.9.36 actually wrote.** A criterion
phrased as a text match will eventually be run as one.
 
**Fifth application, 2026-08-24 — and it decided a whole release.** After the
0.9.53 lazy-call change, the trigger row and a 0.9.52 quiet row **render
identically**: one chip, no card. Shape could not say whether the call had moved.
What settled it was **structural**: an old conversation whose reply had
demonstrably earned an interview the day before now produced no card on a fresh
load. A reply that used to earn a question no longer produced one unbidden, so
the call had not run. **The console confirmed it later; the structural argument
was right first.**
 
**Sixth application, 2026-08-27 — the register guard.** "Reads like her own
head" cannot be asserted and would be a vibes check. What is assertable is
structure: extract every question and option set the prompt demonstrates and
check that none contains second person. Scope was the hard part —
**chip texts are excluded**, because a chip is a message the user sends *to
Claude*, where "you" means Claude and is correct. A guard that scanned the whole
prompt for "you" would have been wrong in both directions.
 
**Still open:** `"Searched the web"` appeared in one v2 capture and produced no
holders in v3. Unexplained, and deliberately not fixed on a single observation.
 
---
 
# Surface notes
 
**Cowork** (`claude.ai/cowork/...`) — CONTEXA renders there because the manifest
matches `https://claude.ai/*`. The capture surface is **identical to chat**.
**No adapter needed.**
 
**Cowork is no longer the only place claude.ai's own question widget appears**
(2026-08-28) — see Contaminant 2, which has been corrected.
 
**`/code/`** — **CANCELLED 2026-08-22, owner's decision.** Scope kept in
`claude/CONTEXA-code-session-scope.md` for the record only.
 
---
 
# Deliberate rejections — do not "fix" these
 
**Salvaging an unwrapped prompt. REJECTED by the owner 2026-08-23.** It would
make the failure invisible to the user. Her reasoning, and it is right: **every
fix made that day came from a failure she could see.**
 
**A floor, a fallback chip, or a minimum count.** Zero is a product outcome.
Every defect in Part One came from one. **0.9.53's input-opens-on-nothing is not
one of these** — it fabricates no question, suggestion or assumption, the row
stays empty, and it is gated on `assume.length === 0` rather than `true`. It
exists because the user *asked*, which a quiet row never used to require.
 
**A cap on the question count.** Proposed twice, rejected twice. The count was
never the variable. A ceiling is the same class of mistake as a floor.
 
**Making CONTEXA yield to claude.ai's Cowork question widget.** Owner's call,
2026-08-23 — **but the premise has changed**: see Contaminant 2.
 
**Loosening the `assume` gate. REJECTED OUTRIGHT 2026-08-24 — no longer pending
a control.** The gate declines facts the user stated because the composer body
already carries them. Loosening it produces `Assume:` lines duplicating text
already in the prompt, which is criterion B. Build notes §2h. **A 2026-08-28
capture shows that duplication happening without any loosening** — see THE
MIRROR. The rejection stands; the defect it predicted has a specimen.
 
**Retiring `watchScroll`. REJECTED 2026-08-24.** The card is pinned above a
sticky composer and is on screen at every scroll position; it is in the way
because of *where it lives*, not *how it arrived*. Build notes §2g.
 
**The duplicated facts the standalone assume chip sends** — once in `assume` and
once in the intent as `Assumed:` lines. Load-bearing: it is what lets a 0.9.49
extension talk to a pre-0.9.49 worker without a deploy order. **Note the
tension:** this deliberate duplication on the wire is the input to the composed
prompt that duplicated it on the page. The wire duplication is not the defect —
`EXPAND_SYSTEM` is told about it explicitly — but any future edit there should
start from THE MIRROR's specimen.
 
**Re-branding the interview card.** Built 2026-08-27 to the owner's order —
pitch-black surface, teal frame, teal lettering going white on click — seen
live, and reverted the same hour: *"mnogo napadno, moja greška."* The quiet hat
stands: host surfaces, teal as an accent only.
 
---
 
# One thing that is NOT a defect
 
**An interview's composed prompt is not a chip.** A drafted chip is the model's
guess about what the user would say. A composed interview prompt contains
answers the user **actually clicked**, so those are her statements and can be
acted on. The `Assume:` lines inside the same prompt are still the model filling
gaps, and still need checking.
 
**But the STANDALONE chip may be the exception** — it composes from nothing typed
and nothing clicked, so unlike an interview prompt it contains no statement the
user actually made. See Class 1's fourth instance. Unresolved on one specimen.
 
**A corollary that matters for reading evidence (0.9.49):** an `Assume:` line in
a composed prompt does **not** identify which mechanism produced it.
`EXPAND_SYSTEM` has written those since 0.9.23. **Only `[CONTEXA] assumed [...]`
distinguishes the two.**
 
**And its mirror (2026-08-24): the ABSENCE of an `Assume:` line proves nothing
either.** The fact may be sitting in the body, carried by use. **`assumed []`
plus no `Assume:` line is not a miss until you have read the prompt.**
 
**Turning the reply's own question into clicks is the click-only rule working,
not the obvious question handed back** (criterion C, sharpened 2026-08-26). The
test is whether the ANSWER was already on screen, not whether the question was.
See Class 6b's boundary note for where this stops.
 