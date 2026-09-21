# CONTEXA — direction: audience, move classes, and how the core got replaced
 
**Status 2026-08-22: capability moves as a separate class are CLOSED.** Shipped
in 0.9.28, field-tested the same evening, found mostly inert, and absorbed into
the 0.9.29 trajectory core rather than rebuilt or pulled. The reasoning below is
kept because the *diagnosis* is the durable part — the moves were a symptom.
 
---
 
## AUDIENCE DECISION (2026-08-21) — still governs
 
**Target: beginners and intermediate users. Explicitly NOT senior developers.**
 
The strongest argument is not market size: for someone whose prompts are already
good, "make bad prompts good" is worth **zero**. Senior devs are not a smaller
market — they are a market where the mechanism has no value. Reach confirms it:
they work in IDEs and Claude Code, not claude.ai in a browser tab.
 
**Open risk:** the friends' cohort. At least one is a senior programmer. If most
of the ten are developers, the week measures the audience just declined.
 
---
 
# WHY CAPABILITY MOVES FAILED — the durable lesson
 
Three moves shipped in 0.9.28: *Set up a project*, *Lock in my style*, *Work
from real data*. **Zero fired across four field rows.** Two had identified
structural causes within the hour:
 
**Lock in my style could not fire at all.** Its evidence was "the reply
acknowledges a repeated correction." Two problems, either fatal. CONTEXA sees
exactly one user message and one reply — "**repeated**" is a multi-turn pattern
it never receives. And a well-behaved Claude *complies silently*: told "drop the
headers," it drops the headers and says nothing, so there is no quotable
fragment in the reply. The symptom lived in the user's messages; the contract
required evidence from Claude's.
 
**Work from real data was dominated by Supply.** Its symptom is "reasons from a
described file." But a good reply then says *"upload it and I'll run through
this"* — which is Supply's evidence verbatim, and Supply fires first by the
ordering rule. The capability move only had a window when Claude reasoned from
a description **and failed to ask**.
 
**Set up a project** was never observed. Its only live path is a reply that
self-marks the repetition ("as I mentioned", "just to confirm again").
 
## The sorting error — this is the part worth keeping
 
Claude picked the three by sorting moves into **durable** (the gap is on the
user's side of the wire, no model update fixes it) versus **decaying** (the gap
is Claude misbehaving, and Anthropic keeps fixing those). *Make it an artifact*
and *Check it live* were deferred as decaying.
 
**That was the wrong axis.** Durability and observability are in tension:
 
> A gap on the user's side does not appear in Claude's reply **precisely
> because it is on the user's side**. The symptoms that ARE visible in a reply
> are Claude's own behaviours — exactly the ones being deferred as decay-prone.
 
Observability is binary and required today. Decay is gradual and a year out.
The analysis traded a hard present constraint for a soft future risk. Worse, the
test was applied inconsistently: *Work from real data* depends on Claude failing
to ask, which is the same "Claude misbehaves" pattern used to reject the other
two.
 
## How 0.9.29 resolved it
 
Not rebuilt, not pulled — **absorbed**. The trajectory core routes a capability
**as part of the plan** when the road ahead runs through it, never as a tip:
 
> When the road runs through something Claude can do, route the step through it
> as part of the plan, never as a tip: a document that will be revised again
> lives in an artifact Claude keeps updated; a claim that may have changed gets
> verified with web search before more is built on it; work described from
> memory gets done on the uploaded real thing instead, with the attachment point
> marked `<attach here>`; context the user keeps re-explaining becomes project
> instructions Claude drafts.
 
With one slot, a capability has to *be* the best move to exist at all — a far
higher bar than "at most one per set", and it disappears when it is not.
 
**The `CAPABILITY-AUDIT` staleness guard in build.mjs survives.** Capability
knowledge moved into that routing sentence; it did not leave. Missing or drifted
between the two prompt copies fails the build; older than 120 days warns.
 
---
 
# THE THREE MOVE CLASSES — historical
 
1. **Requisition moves** — shipped 0.9.17→0.9.28, retired by 0.9.29. Supply,
   Collapse a fork, Invite Claude's questions, Grant commitment, Redirect the
   angle, Recast. The taxonomy is gone; the *behaviours* survive inside the one
   chip, unnamed.
2. **Capability moves** — 0.9.28, closed. Above.
3. **Verification moves** — PARKED, never shipped. Below.
---
 
# VERIFICATION MOVES — PARKED (audience declined 2026-08-21)
 
**The market evidence is real** (Sonar, 1,100+ devs, Jan 2026): 96% don't fully
trust AI-generated code is functionally correct, but only **48% consistently
verify before committing** — AWS's CTO calls the residue "verification debt."
53% say AI produces "code that looks correct but isn't reliable"; 38% say
reviewing AI code takes MORE effort than reviewing human code; 40% report
unnecessary/duplicative code. AI is 42% of committed code, heading to 65%.
 
**Why the fit was tempting:** the survey gap is friction, not knowledge — people
know they should verify but formulating the check is work, and that is exactly
what a chip removes.
 
**Why parked:** reach. Perfect chips in a room senior devs don't visit are worth
nothing. Reopens instantly if field data says the audience call was wrong.
 
Draft moves if revived: **Name the failing input** · **What did you assume** ·
**Cite where** · **Diff, not the file**.
 
---
 
# MARKETING
 
"CREATE MAGIC IN CLAUDE WITH CONTEXA" — approved as **tagline, not product**.
Feeling in the marketing, mechanism in the product ("make bad prompts good").
 
Rejected 2026-08-21: abandoning CONTEXA to rebuild it under that banner. The one
genuinely new idea in that vision — "use 100% of Claude" — became the capability
class, and now lives in the trajectory core's routing sentence. **Decision
checkpoint stands: re-ask the abandonment question honestly after the friends'
week, with data on the table.**
 
---
 
# METHOD NOTES — what actually worked
 
- **Field-test before believing.** The capability class survived a full design
  review, a written spec, 19 assertions and a clean deploy. One evening of real
  use killed it. Nothing before that evening would have.
- **No counter catches uselessness.** Every failed chip scored perfectly
  grounded. `{total, kept, grounded}` measures honesty, never usefulness. The
  only detector is a human reading the row.
- **Exemplars beat rules** (0.9.25, reapplied in 0.9.29). Every rule that has
  been ignored was ignored while written down.
- **The owner's instinct beat the analysis twice** — the hard floor of three in
  0.9.24, and the one-chip core in 0.9.29, which was proposed against a
  recommendation to hold.