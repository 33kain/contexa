# CONTEXA prompt A/B — measured on live Haiku

**Date:** 2026-08-19 · **Model:** `claude-haiku-4-5` via the deployed Worker
**Change under test:** three rules added — assume the obvious step is already
known, never suggest what the reply already contains, never rank the obvious
follow-up first (plus: answer Claude's question by value, not automatically first).

Scoring rule: a suggestion counts as **novel** only if it falls outside the
next-steps I pre-registered in `usefulness-test.md` *before* seeing any chips, and
is not already stated in the reply it follows.

---

## Headline

| Metric | Baseline | Improved | Delta |
|---|---|---|---|
| **Novel suggestions** | 4 / 15 (27%) | **10 / 15 (67%)** | **+40pp (2.5×)** |
| Suggestions echoing the reply | ~8 | 2 | **−6** |
| Turns where best chip ranked #1 | 0 / 3 | 0 / 3 | **no change** |
| Labels over the 5-word limit | 2 / 15 | 7 / 15 | **regression** |

Two of the three changes worked. The ordering rule did not. And a side effect
appeared that neither of us predicted.

---

## Per-suggestion scoring

### Turn 1 — "KV quota race, what's the right fix?"

Pre-registered: (a) show the DO implementation, (b) latency/cost per request,
(c) hybrid — KV fast path, DO near the limit, (d) migration without losing counters.

| # | Baseline | Verdict | Improved | Verdict |
|---|---|---|---|---|
| 1 | Build Durable Object quota enforcer | = (a) | Sketch the Durable Object implementation | = (a) |
| 2 | Compare cost: DO vs Rate Limiting API | = (b) | Test concurrent writes against each option | **novel** |
| 3 | Test race condition fix | **novel** (weak) | Calculate true cost of Durable Objects | = (b) |
| 4 | Implement drift-absorbing fallback | reply already said "accept the drift" | Map Rate Limiting API constraints to quota | **novel** |
| 5 | Plan daily reset mechanism | **novel** (timezone angle only) | Decide on acceptable drift tolerance | **novel** |

Baseline 2/5 → Improved 3/5. The improved set's #5 is the standout: it reframes a
consistency bug as a **product decision** ("is 18/day so low it creates
complaints, or will the business eat the burn?"). Nothing in the baseline set
approached that.

### Turn 2 — "give me the arithmetic and the dollar cost"

Pre-registered: (a) the cheap burst guard, (b) IP rotation, (c) global spend
circuit breaker.

| # | Baseline | Verdict | Improved | Verdict |
|---|---|---|---|---|
| 1 | Calculate worst-case burst window | reply already gave it | Model the worst-case burst window | partial echo |
| 2 | Map that to my actual rate limit | reply already did this | Price this against your margin | **novel** |
| 3 | Quote the dollar impact | reply already said 24¢/day | Pressure-test the per-IP limit | = (b) |
| 4 | Show me the cheap fix | = (a), and the reply offered it | Compare KV guard vs token bucket | **novel** |
| 5 | Pressure-test the per-IP limit | = (b) | Reframe around user experience | **novel** |

**Baseline 0/5 → Improved 3/5.** This turn is the clearest evidence. The baseline
set asked for three things the reply had *just answered* — the arithmetic, the
per-IP bound, the 24¢ figure. Five slots, zero new information.

The improved set produced the two best suggestions of the whole experiment:

> **Price this against your margin** — "…is there a damage threshold below which
> you'd just accept it and not fix anything?"

> **Reframe around user experience** — "At what point does the guard cost you more
> in conversion/retention than the race condition costs in compute?"

Both invert the question from *how do I fix this* to *should I*. That's the senior
reviewer instinct, and it emerged without me naming it in the prompt.

### Turn 3 — "write a script to measure the real overshoot"

Pre-registered: (a) run it and interpret, (b) does colo variance invalidate it.

| # | Baseline | Verdict | Improved | Verdict |
|---|---|---|---|---|
| 1 | Build the burst script | reply already provided it | Run it now against staging | partial echo |
| 2 | Test against staging first | **novel** | Map which colo served each request | **novel** |
| 3 | Run three times, log worst | reply already said this verbatim | Test with staggered waves instead | **novel** |
| 4 | Check KV state between runs | reply already said this | Pull the actual KV write logs | **novel** but not feasible |
| 5 | Compare reasoning vs measured | **novel** | Stress-test with 200 requests | **novel** |

Baseline 2/5 → Improved 4/5. Note the improved set proposes genuinely different
*experimental designs* (staggered waves, 4× saturation, colo attribution) rather
than restating the test it was handed.

---

## What did not work: ordering

**Neither run put the highest-leverage suggestion first — 0/3 in both.**

In every turn, slot 1 was the obedient continuation of the current plan:

- Turn 1: "Sketch the Durable Object implementation" — executes the plan the reply
  proposed, when the better move was questioning whether to build it at all
- Turn 2: "Model the worst-case burst window" — continues the arithmetic
- Turn 3: "Run it now against staging" — runs the script just written

The rule I added ("the most obvious follow-up must never take first position") was
simply ignored. My read: "what comes next chronologically" is a very strong prior,
and a negative instruction is too weak to override it. Negative constraints
generally underperform positive ones.

**Proposed fix — constrain slot 1 by *type* instead of forbidding a type:**

> The FIRST step must be one that changes the user's plan rather than executes it:
> question whether the work is needed, reframe the problem, force a decision rule,
> or replace reasoning with a measurement. A step that implements, continues, or
> answers the plan already on the table may appear anywhere from second onward, but
> never first.

That converts a prohibition into a positive requirement, which models follow far
more reliably. It's a one-rule change and directly testable with another run.

## The unexpected regression: label overflow

Labels over five words went from **2/15 to 7/15**.

Word counts per set — baseline: `5,7,4,3,4` / `4,7,4,5,4` / `4,4,5,5,4`.
Improved: `5,6,6,7,5` / `5,5,4,7,4` / `5,6,6,6,5`.

The cause is a real tension, not sloppiness. Reframes and decision rules need more
words than "Build the burst script" does. Better ideas produced longer labels.

This matters because `shortLabel()` truncates client-side at five words with an
ellipsis, so **7 of 15 improved chips would display truncated** — "Test concurrent
writes against…", "Map Rate Limiting API constraints…". The truncation protects
layout but hides exactly the distinctive part of the best suggestions.

Two options:

1. **Raise the cap to 6 words** in the prompt and in `shortLabel()`. Recovers 5 of
   the 7 overflows; chips grow by roughly one word.
2. **Keep 5 and demand a sharper framing**: *if the idea needs more than five
   words, find a five-word phrasing that keeps the distinctive part — never pad
   with generic verbs.*

I'd do (1). The evidence says the good ideas want a sixth word, and fighting that
costs more than the extra ~30px.

## One quality caveat

Novel is not the same as correct. Improved turn 3 #4 asks to "export the raw KV
transaction log for that device token" — **Cloudflare KV has no such feature.**
The suggestion is plausible, specific, and impossible.

Both runs also assume a staging environment that doesn't exist.

At 67% novelty the hit rate is good, but roughly one suggestion per session may be
confidently wrong. That's tolerable when the user reads the prompt in the composer
before sending — which is exactly why the label/payload split matters — but it is
an argument against ever auto-sending a suggestion.

## Verdict

The change is a clear win: **novelty 27% → 67%**, and reply-echo nearly eliminated.
Ship it.

Two follow-ups, in order of value:

1. **Reframe the ordering rule as a positive type constraint on slot 1.** This is
   the biggest remaining defect — the first chip is the one users click, and it's
   currently the least valuable one.
2. **Raise the label cap to 6 words** in both the prompt and `shortLabel()`.

Deferred from the original test and still unused: naming the winning move-types
explicitly in the prompt. The improved run surfaced them on its own (decision
rules, cost-benefit reframes, alternative designs), so this may now be unnecessary
— worth leaving out unless a later run regresses.

---

# Round 3 — the two follow-up fixes, measured

**Change under test:** (1) the ordering rule rewritten as a *positive type
constraint* on slot 1 — it must question the need, reframe, force a decision rule,
or replace reasoning with measurement; (2) label cap raised 5 → 6 words in the
prompt and in `shortLabel()`.

## Three-run comparison

| Metric | Baseline | Improved | **Round 3** |
|---|---|---|---|
| Novel suggestions | 4/15 (27%) | 10/15 (67%) | **11/15 (73%)** |
| Slot 1 = highest-leverage move | 0/3 | 0/3 | **3/3** |
| Labels over the cap | 2/15 | 7/15 | **3/15** |
| Suggestions echoing the reply | ~8 | 2 | **2** |

**The positive constraint worked where the prohibition failed.** Same intent, same
model, opposite result — telling the model what slot 1 *must be* succeeded where
telling it what slot 1 *must not be* was ignored three times out of three.

## Slot 1, across all three runs

| Turn | Baseline | Improved | Round 3 |
|---|---|---|---|
| 1 | Build Durable Object quota enforcer | Sketch the Durable Object implementation | **Measure actual overshoot across production** |
| 2 | Calculate worst-case burst window | Model the worst-case burst window | **Test the race window empirically** |
| 3 | Build the burst script | Run it now against staging | **Test against production traffic pattern** |

The first two runs opened by executing the plan already on the table. Round 3 opens
by checking whether the plan is warranted. Turn 1's payload makes it explicit:

> "…how many requests exceeded 20 per device token when concurrency was >1? What's
> the p50, p95, p99 overshoot? This tells us whether we actually need perfect
> enforcement or if accepting 10% drift (lower limit to 18) solves the problem for $0."

Turn 3's is the sharpest thing produced across all three runs — it attacks the
validity of the experiment it was handed:

> "…log real request timestamps from your production traffic for one hour and feed
> that distribution into the test harness so we're measuring overshoot under
> realistic arrival patterns, not worst-case artificial sync."

That is a reviewer catching a methodological flaw, not a chatbot continuing a
thread.

## Notable new suggestions

- **Audit whether this even needs guarding** — "What happens to your business when
  one user eats $100 of inference in stolen quota? That answer changes whether 24
  cents a day of leakage is actually a problem."
- **Check Durable Objects behaviour as baseline** — run the same burst against a DO
  as a control, to isolate whether KV is actually the cause. A proper experimental
  control; neither earlier run proposed one.
- **Vary request spacing and report curve** — 0/10/50/100/200 ms, plot overshoot vs
  spacing, "whether a small artificial delay kills overshoot cheaply." Turns the
  measurement into a search for the cheap fix.
- **Design the reset timing edge case** — off-by-one "gifting" at the reset
  boundary. A real bug class in the current code that nobody had named.

## Two things to watch

**Slot 1 chose "measure" all three times.** The rule permits four types — question
the need, reframe, decision rule, measurement — and it picked measurement in every
turn. All three turns concerned a measurable engineering problem, so it was apt
each time, but if the first chip is always "measure something" it becomes
predictable and users stop reading it. Worth re-testing on a non-empirical
conversation (writing, planning, design) before deciding whether to force variety
across the four types.

**Fabricated observability, again.** Round 3 turn 3 #5 asks to inspect "raw KV
logs" for "conditional-write failures (CAS rejections)". Cloudflare KV has no
compare-and-swap and exposes no per-key write log — the same class of error as the
previous round's "export the raw KV transaction log". When asked to measure
infrastructure internals, the model invents observability that doesn't exist. Twice
in the same area is a pattern, not a fluke.

This is the strongest argument for the label/payload split: because the full prompt
lands in the composer where you read it before sending, a confidently wrong
suggestion costs you three seconds rather than a wasted afternoon. It is also a
firm argument against ever auto-sending a chip.

## Where the prompt stands

Three of four defects from the original test are fixed:

- ~~Reply echo~~ — fixed in round 2 (8 → 2)
- ~~Obvious-first ordering~~ — fixed in round 3 (0/3 → 3/3)
- ~~Label overflow~~ — largely fixed by raising the cap (7 → 3)
- **Factual reliability** — unresolved, and probably not a prompt problem. Roughly
  one suggestion per session invents a capability. Mitigated by design rather than
  by instruction.

Novelty gain overall: **27% → 73%**, a 2.7× improvement, from three added rules and
one rewritten one. No code changes to the extension beyond a truncation constant.
