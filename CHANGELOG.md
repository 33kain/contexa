# Changelog

Versions are per-artifact. The **extension** version is `manifest.json`; the
**backend** version is `BUILD` in `worker/src/index.js`. They deploy on separate
paths — a worker fix must not force a Chrome Web Store resubmission — so they are
free to diverge, and the settings page labels them separately for that reason.

---

## Extension 0.9.27 — Backend unchanged (0.9.25)

*Copy and consistency pass on the beginner release.*

### Changed: one save rule for the whole settings page

0.9.26 shipped two rules — the on/off switch saved itself, the Advanced text
fields waited for a Save button — and within an hour the person who wrote the
requirements typed a value into a field, walked away, and assumed it had
applied. If the author falls for it, every beginner will.

Advanced fields now save when you leave them, and Enter commits too. The Save
button is gone, because leaving one beside self-saving fields recreates the
same ambiguity in reverse. The page states the rule in one line.

The reasoning behind auto-saving a field that could hold a half-pasted API key:
a silent no-op is the worst failure available here, because nothing on screen
contradicts the user's belief. A wrong value that *does* save is visible and
recoverable — the mode box moves, Test reports it. Invisible beats visible only
when the invisible thing is correct.

### Changed: three beginner-facing sentences that overclaimed or misdirected

The network error said "It's usually back within a minute" — a recovery time
never measured, and one that blames the service when the cause may be the
reader's own connection. It now reads "Couldn't reach the CONTEXA service.
Check your connection and try again in a moment."

The lost-connection card told the reader that reloading fixes it and then
offered a Settings button. It now offers Reload.

The quota card pitched an API key on the beginner surface — expert vocabulary
the audience decision had just moved behind Advanced. It now reads "That's all
20 free suggestions for today. They come back in about 3 hours." Anyone who
wants unlimited use still finds the key field where it belongs.

Two new invariants are now tested: no user-facing sentence may contain a raw
error code, and every one must end in a full stop.

---

## Extension 0.9.26 — Backend unchanged (0.9.25)

*The beginner release. Audience decision of 2026-08-21: CONTEXA targets
beginners and intermediate users, not senior developers — "make bad prompts
good" is worth nothing to someone whose prompts are already good.*

### Changed: the settings page now hides everything a beginner doesn't need

The old page opened on an API key field. For the audience this product is for,
that is a wall: it implies setup is required, implies a cost, and implies you
need to know what an API is. None of that is true — the free service needs
nothing at all.

The default view is now a single card reading **CONTEXA is on** with a switch,
four plain steps ending with "click one and the full message is written into
your message box — you can edit it, nothing is ever sent without you pressing
send", and one line saying it's free with no sign-up. That is the whole page.
API key, model, backend URL and Test collapse behind an **Advanced**
disclosure that opens with "You don't need any of this."

The switch saves on flip rather than waiting for Save — a Save button attached
to a toggle is a quiet trap: people flip it, close the tab, and nothing
happened. Version comes from the manifest and the shipped model from
`getConfig`, so neither can drift into a stale second copy.

### Fixed: error cards spoke in codes to people who can't read them

The first outside user this product ever had opened claude.ai and met the
string `forbidden_origin`. He was simply running an unpacked dev copy instead
of the store build — a thirty-second fix — but nothing on screen said so. An
error the reader cannot act on is worse than no error at all.

Every failure now renders one plain sentence with the most useful button for
that cause. `forbidden_origin` reads "This copy of CONTEXA wasn't installed
from the Chrome Web Store, so it can't use the free service. Install the store
version and remove this one." — with a **Get CONTEXA** button going to the
listing rather than to settings. Truncations, network failures, rejected keys
and rate limits each get their own sentence; anything unmapped falls back to
one that is at least honest and actionable. Diagnostics are untouched and still
go to the console, where they were always the useful thing.

### Fixed: the streaming guard failed open

`scan()` read `if (wrap && wrap.getAttribute('data-is-streaming') === 'true')`.
If claude.ai ever moved, renamed, or relocated that attribute, `wrap` would be
null, the guard would silently stop applying, and CONTEXA would fire mid-stream
on a half-written reply — after which the `processed` WeakSet blocked any
correction. The only symptom would have been one weak chip and no error
anywhere, which is precisely the failure mode hardest to notice.

It now fails closed: `'true'` still short-circuits, but without a positive
`'false'` the fast path is refused and the decision waits for the debounced
settle timer, which sets its own signal after 1.2 seconds of quiet. A future
claude.ai redesign now costs a small delay instead of a bad capture.

---

## Extension 0.9.25 — Backend 0.9.25

### Fixed: drafts stated facts only the user could know as though observed

Field defect, three instances across both prompts before it was named. The
model would answer a question only the user could answer — what they did,
when they did it, what happened on their machine — and write it as plain
fact instead of a marked assumption. Instances: "Deployed, succes" became a
flat assertion that all five field checks had passed; a clean release run
produced "confirm which gate it stopped at", presupposing a failure that
never happened; and a chip asserted "The egg-and-chicken test was run before
I called wrangler deploy for 0.9.24" — something CONTEXA cannot see, since
it receives only the last message and reply.

Not blindness but inconsistency: a chip in a neighbouring fire from the same
prompt wrote "Assume it rendered exactly one chip again", applying the
convention correctly.

Both prompts already carried rules requiring the marking and ignored them
three times, so the fix is worked exemplars rather than another instruction —
the platform prompting docs are explicit that positive examples outperform
added rules, and this prompt had already proved immune to the rule.
NEXT_STEPS_SYSTEM gains a decree exemplar showing the right form and the
wrong one side by side, plus the one marking clause its hard rules genuinely
lacked. EXPAND_SYSTEM gains an exemplar built from the real defect: the
"deployed, works" case, rendered correctly with an `Assume:` line the user
can strike. Five new prompt assertions pin all of it.

Harmless in every observed instance because the user ratifies before sending —
but the whole product rests on never asserting what it cannot see.

---

## Extension 0.9.24 — Backend 0.9.24

*Backend deployed and measured in the field on 2026-08-21; the extension half
shipped alongside 0.9.25 rather than reaching the store on its own.*

### Changed: the prompt was teaching scarcity, so rows arrived nearly empty

Single-chip rows read as broken. The cause was not the evidence rule but
three sentences written in 0.9.16 when the enemy was padding to five: "the
most common correct count is one or two", "deserves ONE dominant step", and
"returning a single step is a correct answer". The model was not failing to
find material; it was being told that finding little was success.

Replaced with a floor of three framed as a search obligation — "before
settling for fewer, reread it for what it assumed without saying so, what it
left open, what it finished that could be pressure-tested, and what it never
considered" — plus the anti-padding line "a restatement in slot three is
worse than no slot three". The where-to-look clause carries most of the
weight. A regression test now fails if any scarcity prior returns.

### Added: "Recast the problem", the first generative move

The five existing moves are all reactive. The sixth is anchored to a quote of
the goal, artifact or constraint rather than a defect, then free to propose
what the conversation has not tried: solve it cheaper, borrow a pattern from
another domain, invert the constraint, or ask what would make the task
unnecessary. It holds the only licence in the prompt to name something the
reply never mentioned, capped at one per set, and must aim at the work.

First field measurement: `{total: 4, kept: 4, grounded: 4}` — nothing dropped
by the evidence gate, no fabricated quotes, floor held on a short
conversational reply.

---

## Extension 0.9.23 — Backend 0.9.23

### Added: the fifth chip — type a rough ask, CONTEXA writes the prompt

Motto made mechanism: **make bad prompts good.** A dashed "✎ Rough ask…" chip
now sits at the end of every suggestion row. Click it, type a rough intent
("optimize seo & meta", "make it shorter"), press Enter — the drafted prompt
loads into the composer, ready to edit and send. Never auto-sends.

The draft is produced by a second system prompt, `EXPAND_SYSTEM`, built from
the platform docs' catalog of transformations that measurably change output:
imperative first line, explicit scope, positive-form anti-goals, constraints
only when implied, banned filler adjectives. It fixes FORM, never invents
CONTENT — missing decisions surface as `<slots>` (max 2) and `Assume:` lines
(max 2) the user edits before sending. Already-good input comes back nearly
verbatim; a hopeless one-worder degrades into the shipped elicit move. The
expansion sees the typed ask plus the same capture the suggestions saw, so
"make it shorter" means *this* reply — and a topic-switch ask ignores the
reply entirely.

Wiring: new `POST /v1/expand` on the worker sharing every existing gate —
origin pin, device token, IP cap, and the SAME 20/day pool (a rough ask
spends exactly what a suggestion row spends); `expandPrompt` message type in
the background with own-key and hosted paths, the same thinking-disable +
model-agnostic 400-retry, ceiling 1200, clean-boundary hard cap at 900 chars
(soft target 700 in the prompt). build.mjs now enforces byte-identity for
BOTH prompts and pins the shared section labels. Failures render inline on
the chip ("daily limit reached" / "couldn't write it — retry") — never a
second card; detail goes to the console. Keystrokes in the chip's input are
stopped at the shadow boundary so claude.ai's document-level listeners never
see them.

### Fixed: clicking a chip could type over a draft already in the composer

Design-review item #4, verified real: `insertPrompt` selected all and typed
over whatever the composer held — the one path where CONTEXA could destroy
the user's own words, and the fifth chip would have doubled how often it ran.
Now a non-empty draft is never replaced: the drafted prompt is appended below
it, and the user deletes what they don't want. Nothing is ever lost. Pinned
by source-assertion tests.

---

## Extension 0.9.22 — store copy release (no code changes)

### Changed: store-facing copy moved off the affiliation trigger

The Chrome Web Store "Summary from package" is the manifest `description` —
not editable in the dashboard — so the rename shipped as a version: name
**"CONTEXA - Prompt like a PRO"** (the old name's "for Claude" phrasing read
as an affiliation claim), summary "Reads the reply and hands you your next
prompt, tailored in AI language, ready to send. No API key, no account, no
setup." (121/132 chars). Extension behavior unchanged; backend stayed 0.9.21.

---

## Extension 0.9.21 — Backend 0.9.21

### Fixed: thinking-mandatory models rejected the thinking disable with a 400

0.9.20 disabled thinking explicitly — correct for the pinned Sonnet 5, but
Fable 5 and Mythos 5 REJECT `thinking: {type: "disabled"}` (thinking cannot
be turned off there), so an own-key user with such a model override got a
hard `api_400` on every fire. Model-agnostic fix on both paths: attempt with
the disable; if the API's 400 names the thinking config, retry once without
the field and let that model's default stand. No model list to maintain.

### Fixed: the API's error text was captured and shown nowhere — again

The card said `api_400`; the API's actual explanation sat in a `detail` field
that nothing rendered, costing a debugging cycle — the same class of gap as
the 0.9.13 diag bug. Now: the card renders `detail` in the grey line, the
background logs every non-ok API body at capture time, and the worker
tail-logs upstream error bodies (tail-only; they can contain account details
and still never reach clients). Every error path logs its full evidence at
the moment of capture — now a standing rule with tests.

---

## Extension 0.9.20 — Backend 0.9.20

### Fixed: Sonnet 5's adaptive-thinking default could spend the whole budget thinking

Upstream behavior change, caught by the diagnostic pipeline on its first
occurrence: Sonnet 5 runs ADAPTIVE thinking for requests without a `thinking`
field (4.6 and earlier ran without thinking). On the 0.9.19 prompt — the
richest yet — the model chose to think and consumed all 2,500 output tokens
as a thinking block, emitting zero text. The error card named the cause in
one grey sentence: "output was thinking, not text; 2500 output tokens — at
the 2500 ceiling." Three versions of instrumentation paid for themselves in
one line.

Both call sites now send `thinking: { type: "disabled" }` explicitly — for a
fast structured-JSON generator under a hard cap, thinking is pure cost.
Pinned by wire-level tests on both paths. Note for own-key users overriding
the model in settings: `disabled` is the no-op state on older models.

---

## Extension 0.9.19 — Backend 0.9.19

### Changed: the elicitation release — CONTEXA learns to flip the question burden

Owner's decisions after holding the product against Lovable's prompting
playbook (the original inspiration, returned nineteen versions later):

- **Question ban lifted, half-way and on purpose**: a chip may be
  question-form when aimed at Claude and the question is the sharpest form
  of the ask. Questions aimed at the user stay banned forever — that half of
  the old rule was always the correct half, and the action-ownership voice
  line (earned by field pattern n=3) now guards it explicitly in Hard rules.
- **New move: Invite Claude's questions** — for young or underspecified work
  where the forks are invisible, the chip flips the question burden: "Ask me
  everything you need to know to get this right — one focused list, then
  wait." Division of labor: visible fork → decree; invisible forks → elicit.
  Rationed at one per set.
- **Foundation-first rule**: when the exchange reads like a task's opening
  resting on guessed scope, the set pins what/who/why/key-action before
  continuation. Shape-triggered, prompt-only, no wire.
- **Docs**: the requisition identity lands in both READMEs and the store
  listing (store copy kept brand-safe per the listing's own doctrine), plus
  the method sentence: the playbook good prompt engineers use, applied for
  you, one message at a time.
- Model adaptation was designed, built as a kit, and killed by its own
  designer's argument: the reply already encodes the model, so the evidence
  rule adapts transitively; the metadata channel is lie-prone and
  invisible-by-design. Kit preserved for reopening only on field evidence of
  tier-specific failure. Pattern library deferred pending click data.

---

## Extension 0.9.18 — backend stays 0.9.17

### Fixed: an extension reload mid-generation rendered raw plumbing text

Field event, seconds old: a request was in flight when the extension was
reloaded (the user was running the deploy-and-reload sequence). Chrome reports
that as "the message channel closed before a response was received" — and the
stale-context classifier only knew "message PORT closed", so instead of the
friendly "CONTEXA was updated — reload this page" notice, the card showed the
raw error verbatim. One vocabulary miss; the same event in a tab checked
after the reload rendered correctly.

The classifier now covers port/channel/is-closed variants and is pinned by a
test against Chrome's exact emitted strings, including the full
listener-indicated-asynchronous-response phrasing. No behavior change on any
other path; extension-only, worker untouched.

---

## Extension 0.9.17 — Backend 0.9.17

### Built to SPEC-v0.9.17.md — evidence-grounded requisitions

The corrected requisition design, per the commissioned spec (see that document
for full rationale and the verbatim prompt):

- **Evidence rule**: every step must quote the reply fragment that earned it
  (`evidence` field, ≤90 chars, verbatim). Steps without evidence are dropped;
  near-miss quotes render but are counted and logged. Evidence never reaches
  the composer — the worker and the own-key background both validate, strip,
  and return `{label, text}` plus aggregate `grounding` counts, which the page
  console logs for the field check.
- **Principle over taxonomy**: the four moves (supply / collapse-a-fork /
  grant-commitment / redirect) are worked examples tied to the evidence that
  earns them, not categories; the prompt states a one-of-each set is almost
  certainly padded. Redirects capped at one; decrees at two; heavy paste-work
  steps at one per set.
- **Friction-aware ordering**: supply steps first only on visible starvation,
  otherwise slot 1 goes to the highest-leverage step sendable within seconds;
  heavy steps sink to last.
- **Viewport marker (§3.2)**: captures longer than 6,000 chars are trimmed at
  a clean boundary and end with "[capture window ends here — the reply
  continues beyond this point]", sized so the worker's own 6,000-char slice
  cannot eat the marker (trim then append — the joint has a dedicated test).
  The prompt forbids mentioning the marker or requisitioning the continuation.
  Fixes the observed phantom-truncation chips on long replies.
- **Logging levels (§4)**: partial salvage downgraded warn→log so Chrome's
  extension-page Errors badge stays quiet; true failure diagnostics remain
  warn. Evidence and grounding logs at log level.

Tests: +9 extension (prompt shape, marker mechanics incl. the server-slice
joint test, evidence drop/strip/count, all-dropped→no_steps, log-level
asserts), +3 worker (hosted evidence pipeline). 47 extension / 27 worker checks, all green. Field acceptance criteria are §7 of the spec and run post-deploy.

---

## Extension 0.9.16 — Backend 0.9.16

### Changed: the requisition-form design (owner-delegated to Claude)

Owner's brief, verbatim intent: "think about what would make your job easier
and define the next prompts — whatever YOU think would be the RIGHT fit for
YOU. The point is to multiply your power by having more sides to think of
outside the box."

The steps are now the messages the assistant itself would most benefit from
receiving — its own requests, rendered as ready-to-send user messages. Four
families as a palette, never a quota:

- **FEED** — supply the artifact the reply had to infer around (code, error,
  config, observed output), named and format-pinned, with `<paste here>`.
  When the reply is starved, this comes first and outranks everything.
- **DECREE** — resolve a hedged fork by decree: "Assume X. Redo under exactly
  that." The user edits the assumption before sending. Max two per set.
- **UNLEASH** — grant commitment permission: pick the option you'd choose and
  produce the complete version, nothing left as an option.
- **FLIP** — redirect the angle: opposite assumption, argue-against-and-keep-
  what-survives, different optimization target. Aimed at the work, never at
  quizzing the user.

Count is 1–5 decided by the reply's need — a starved reply gets one dominant
chip, not fillers. Labels ≤4 words (client clamp follows). Retained from
prior designs: no questions ever, exemplar payload shape ("name the thing,
pin scope and format"), 280-char cap, grounding, no re-requesting, one move
per step, no code in payloads, never auto-send. Metric remains click-through.

Supersedes 0.9.15's exactly-five/3-word/obvious-only design same-day, by the
owner's explicit delegation. Three hand-authored sample sets against real
session replies were approved before this was built.

---

## Extension 0.9.15 — Backend 0.9.15

### Changed: CONTEXA becomes a guide, not a critic (owner's redesign)

The prompt is rewritten around a new core, the owner's chosen exemplar:
"The current prompts — system prompt, any instruction files, tool/function
definitions. The actual text, not a summary." Name the thing, pin scope and
format, no question mark.

- **Always exactly five steps** (variable 3–5 retired).
- **Labels: max 3 words** (was 6); client clamp in `shortLabel` follows.
- **No questions, ever** — not to the user, not to Claude. Directives and
  specifications only.
- **Obvious next steps by design**: continue the thread, produce the next
  artifact, implement what the reply describes, supply missing input (with a
  <placeholder>), extend to the adjacent piece. If the reply is blocked on
  missing input, step one supplies exactly that.
- Retired deliberately: the slot-1 plan-changer rule, the ban on obvious
  steps, challenge/verification/reframing moves. This supersedes the round-3
  A/B tuning (novelty 73%, slot-1 3/3) by explicit product decision — the
  loveable.dev pattern this product was inspired by is obvious-next-steps
  done well. The old measurements remain in docs/archive/test-runs/prompt-ab-results.md
  for the record; the new success metric is click-through, not novelty.
- Kept: grounding in the actual reply, no re-requesting delivered content,
  one move per step, the no-code rule for texts, 280-char text cap.

Prompt is byte-identical in both copies (extension own-key path, worker hosted
path) — enforced by the build. Both artifacts ship: worker deploy + extension
reload required together, or the two paths serve different products.

---

## Extension 0.9.14 — backend stays 0.9.12

### Changed: partial salvages render identically to full results

Owner's decision. The "Response was cut short — showing the N that came
through complete" banner is gone. Rationale: salvage keeps the FIRST N complete
steps and the prompt orders steps by leverage, so a partial set is the best
prefix of the intended set; every chip shown is whole; and 3–5 chips is the
spec either way, so the user cannot act on the distinction. Hiding the banner
fakes nothing — it stops narrating engine internals.

The signal is not dropped: every partial now logs `[CONTEXA] partial salvage`
with the diagnostic (when the path provides one) to the page console, because
each partial means the model hit its token ceiling and burned 3–5× the output
cost of a clean response. Ceiling-hit frequency stays measurable during
validation; it just stops being the user's problem.

---

## Extension 0.9.13 — backend stays 0.9.12

### Fixed: the diagnostic was computed, forwarded, delivered — and dropped at the last call

Every truncation card ever shown was bare. Three versions of instrumentation
(0.9.10–0.9.12) built the diag pipeline: the worker computes it, the background
forwards it, `renderQuiet` renders it as the grey cause-sentence. The single
call site joining the last two links read
`renderQuiet(anchor, 'error', reason)` — no `resp`. The renderer's diag logic
reads the fourth argument, which was always `undefined` there. Four missing
characters (`, resp`) silently disabled both the grey sentence and the page
console warning, on every version that had them.

Each *link* had a test — the sentence generator, the worker's diag object, the
background pass-through. The *joint* had none. A source assertion in
`extension/test.mjs` now pins the call site.

Found not by reading the code but by the field: a truncation on a verified
0.9.12 worker + 0.9.12 extension still produced a bare card, which the version
matrix said was impossible.

Also learned in the same investigation, via remote browser inspection of a live
Cowork tab: CONTEXA runs on claude.ai **Cowork sessions** too — same composer,
working streaming attribute, virtualized DOM (~3–5 response blocks), and reply
blocks that include tool-widget labels ("Used Claude in Chrome (6 actions)").
Cowork work-turns are dense multi-part input, and a background tab silently
spends quota on every reply. Scope decision (fire only on visible tabs? skip
/cowork/?) deliberately deferred.

---

## Extension 0.9.12 — Backend 0.9.12

### Fixed: the model was reading degraded input, expensively

Root cause of the code-conversation truncations, found by following the capture
path. The reply was sent as raw `textContent`, which has two defects:

- **Block elements contribute no line break**, so adjacent paragraphs arrived
  glued together ("…each failure.The counter increments…"). Every conversation,
  every version since 0.6 — verified against a real Chromium DOM.
- **Code blocks shipped whole.** On a code-heavy reply, raw code filled most of
  the 6,000-char budget, and it is exactly the material the model then echoed
  into oversized step texts until it hit the token ceiling. Field data: three
  ceiling-hits in one code-heavy conversation, zero elsewhere; a spec-compliant
  response is ~600 tokens against a 2,500 ceiling.

Capture now walks the DOM: real line breaks at block boundaries, UI chrome
(copy buttons) skipped, and each code block collapsed to its first two lines
plus a `[+N more lines of code]` marker — signatures survive as anchors ("fix
`trimPayload`"), the bulk stays out. Applied to both the reply and the user
message; both the hosted and own-key paths benefit since capture happens before
either. A mock code-heavy reply shrinks 82%, which also cuts input cost on what
were the most expensive calls.

The worker cannot do this fix: it receives flat text with no fences (claude.ai
renders code as `<pre>`, so the markers never existed in the captured string).
Capture-side is the only place that still knows what is code.

Plus one prompt line as insurance, framed positively per the round-3 A/B finding
(positive requirements outperform prohibitions): "Step texts are prose. Refer to
code by its name and location…" — byte-identical in both prompt copies,
enforced by the build.

Acceptance test: reproduce in the conversation that produced three ceiling-hits,
with `wrangler tail` open. Expect no yellow banner, no `[CONTEXA]` ceiling log,
and chip payloads free of code fragments.

---

## Backend 0.9.11 — extension stays 0.9.10

First deliberate version divergence: this is a worker-only change, which is
exactly why the two artifacts version independently.

### Fixed: partial salvages carried no evidence

0.9.10 instrumented the two failure branches (unparseable, no usable steps). The
very next ceiling-hit in the field arrived on the third branch — a successful
partial salvage ("Response was cut short — showing the 5 that came through
complete") — which hit the same `max_tokens` ceiling but logged nothing.

A partial salvage is the same event as a hard truncation with luckier cut
placement, so it now logs and returns the same diagnostic. One asymmetry, on
purpose: failures log the **first** 300 characters (the question is how the
output started — prose? JSON at all?), partials log the **last** 300 (the JSON
started fine; the question is what the model was writing when the budget ran
out — a sixth step, an oversized text, or trailing prose). `diag.steps` counts
steps *started*, the response's `steps` array counts steps *kept*; the gap
between them is over-generation made visible.

Field observation that motivated this: three ceiling-hits in one conversation
(two hard failures, then a partial keeping 5). A spec-compliant response is
roughly 600 tokens; hitting 2500 means ~4× overshoot, content-triggered by
something in that conversation.

---

## Extension 0.9.10 — Backend 0.9.10

### Fixed: failure states reported a symptom and destroyed the evidence

A user hit `Couldn't generate next steps (truncated)`. That code means the API
stopped at the `max_tokens` ceiling *and* not one complete step could be salvaged
from the response — which has three possible causes needing three different
fixes: the text body came back empty (budget spent on non-text content), the model
narrated instead of emitting JSON, or it wrote one enormous step that never
closed.

None of them could be distinguished, because both paths discarded the response.
The worker's catch dropped the text entirely; the extension built a `detail`
string that nothing ever read. The one decisive measurement — `usage.output_tokens`
— was never looked at on either path.

- Both paths now compute a diagnostic: `stop_reason`, input and output tokens, the
  ceiling, text length, whether any JSON appeared, how many steps got named, and
  the set of content block types returned. `blocks` is the decisive field: budget
  spent on non-`text` types leaves a short body with output at the ceiling, and no
  increase in `max_tokens` fixes that.
- The worker logs it to `wrangler tail` along with the first 300 characters of the
  response. Only the counts go to the client — asserted by a test that plants a
  marker string in the model's output and fails if it reaches the response body.
- The page states the cause in one sentence beneath the error, rather than
  requiring a console. Full detail also goes to the console.
- `no_steps` (parsed, but nothing usable) carries the same evidence.

Deliberately **not** done: raising `max_tokens` or adding a retry. Both are
guesses at which of the three causes is real, and one of them is not fixable by
either.

---

## Extension 0.9.9 — Backend 0.9.9

### Fixed: a shipped default could only ever reach a user once

The settings page backfilled an empty Model field with the current default and
persisted it. From that moment the install was frozen: `chrome.storage.local`
held a concrete model, and `DEFAULTS` only fills keys that are *missing*, so
every later default change was silently ignored.

Consequence: an install configured during the Haiku era kept calling
`claude-haiku-4-5` after the default moved to Sonnet 5 — through nine versions,
undetected. It surfaced only because a user read the field aloud.

- An untouched Model field now stores `''`, and the model resolves at call time as
  `stored || SHIPPED_MODEL`, so future default changes reach existing installs.
- A one-time migration clears any stored value matching a former default
  (`SUPERSEDED_MODEL_DEFAULTS`), while a deliberately chosen model survives.
  Storage cannot distinguish "typed haiku on purpose" from "left it blank and we
  saved the default" — the information was never recorded — so the migration
  matches only exact former defaults, on the reasoning that nobody types the value
  that was already the default.
- `build.mjs` fails the build if either `DEFAULTS` seeds a concrete model or the
  save handler backfills an empty field. Verified by reintroducing the bug and
  confirming the build refuses.

### Fixed: /v1/health was cacheable, so it could report a stale build as live

A successful deploy read as a failed one because an intermediary served a cached
health body. An endpoint whose only job is reporting what is deployed must never
come from a cache. All JSON responses now send `cache-control: no-store`.

### Added: both versions and the active path are now stated, not inferred

- `/v1/health` returns `version` and `model`. Previously a deploy could only be
  confirmed by triggering a real reply and reading the output.
- Settings shows the extension version next to the title.
- **Test connection** names which service answered. It has always had two
  branches — own key straight to Anthropic, or the hosted backend — and reported
  a bare check mark for both. An own-key install therefore looked like a verified
  backend while never having contacted it.
- A backend that is reachable but has no API key configured now reports that,
  rather than showing a green check for something that fails every request.

### Added: build and test tooling

- `build.mjs` turns `extension/` into `build-ready/` plus a store-ready zip:
  bakes the backend URL, pins the exact host instead of a `*.workers.dev`
  wildcard, sets the version, and writes the archive with `manifest.json` at the
  root — the wrapper-folder mistake Chrome rejects. The zip is written in pure
  Node with a fixed timestamp: Windows ships neither `zip` nor `unzip`, and the
  archive is verified by reading it back rather than trusting the writer.
  Byte-reproducible across builds.
- It also fails on **prompt drift** between the extension and worker copies of
  `NEXT_STEPS_SYSTEM`. Those had been kept identical by hand across nine
  versions; if they diverge, hosted and own-key users get different products.
- `worker/test.mjs` — 14 checks, no network, no Cloudflare account. Asserts that
  quota-exhausted, oversized, short-reply, bad-token, originless and unconfigured
  requests all reject with **zero** upstream calls.
- `extension/test.mjs` — 12 checks. Loads `background.js` in a sandbox with a
  fake `chrome` and `fetch` to prove the migration actually runs, that a
  deliberate override survives it, and that a Haiku-frozen install now calls
  Sonnet.

---

## Backend 0.9.8 — Extension 0.9.8

### Changed: default model is now Sonnet 5

From a controlled three-model comparison on identical inputs:

| | labels over 6-word cap | bulleted as instructed | voice inversion |
|---|---|---|---|
| Haiku 4.5 | 4/11 | 1/11 | 2, both in slot 1 |
| Sonnet 5 | 0/13 | 10/13 | 0 |
| Opus 5 | 0 | yes | 0, but failed a request at `max_tokens` |

Model tier fixed compliance defects that three rounds of prompt engineering could
not. The label cap, bullet format and voice rule were all stated plainly and
Haiku ignored them regardless. Cost: $0.004 → $0.008 per call. Opus produced the
single best suggestion of any run at 5× the price, and hit the token ceiling.

`MODEL` must match in `wrangler.toml` `[vars]` and the `MODEL` constant in
`src/index.js` — a plain `wrangler deploy` reads the former, so changing only the
constant silently reverts. `build.mjs` now enforces the match.

- `max_tokens` 1600 → 2500. Opus proved the ceiling was reachable; Sonnet also
  writes longer than Haiku.
- Per-IP daily limit 60 → 300. Co-located users behind one NAT were blocking each
  other, which reads as a broken product rather than a quota. Keep it near 10× the
  device limit.

---

## 0.9.7

- Boundary-aware payload trimming. A hard `slice(0, 400)` cut mid-word, producing
  chips like "without users notici" and "5–10% overshoo".
- `salvageTruncated()` tracks `[` as well as `{`. Closing only braces left arrays
  open, so a truncated response was unrecoverable.
- `resetsAt` no longer emits `T24:00:00Z`, which is not valid ISO 8601 and fails
  `Date.parse`.

---

## 0.9.0 – 0.9.5

- Hosted Cloudflare Worker backend, so users need no API key of their own — the
  adoption wall this project exists to clear.
- Two-axis quotas (per-device-token, per-hashed-IP) with salted SHA-256 IP
  hashing, server-side input clamping, and rejection before any spend.
- Chrome Web Store submission assets, privacy policy, icon set.
- Honest degraded states throughout. An earlier build hid failures behind canned
  suggestion cards via an empty `catch {}`, which read as "the same three
  sentences every time". Never fake it.
