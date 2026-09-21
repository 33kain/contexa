# CONTEXA — build notes (2026-08-28: 0.9.56 live on the worker; 0.9.55 in store review)
 
**SUPERSEDED, 2026-09-01.** This entire file describes the pre-pivot state —
the interview/moves-chip fork at 0.9.54–0.9.56. The 0.9.58 history-mining pivot
replaced that mechanism entirely; current state is 0.9.68. **For live state,
read `NEXT-SUBMISSION.md` and `STORELISTING.md` instead.** Kept here as a
historical record only — do not treat any "live state" claim below as current,
and do not edit a prompt file named here without first checking it still exists
under that name in the current codebase.
 
**Store ID:** `phhamigkjeeabbjncpmhkppkjccfglhb` ·
https://chromewebstore.google.com/detail/phhamigkjeeabbjncpmhkppkjccfglhb
Repo: `github.com/33kain/contexa` (private — anonymous clone prompts for auth)
 
**Live state and next actions only.** Release history is in `CHANGELOG.md`.
Failure classes are in `claude/CONTEXA-pattern-file.md` — **read Part Two before
editing either system prompt, Part Three before trusting any console number, and
§2g before touching `watchScroll`.**
 
**The specs from the design phase live at the REPO ROOT** —
`CONTEXA-content-spec.md` and `CONTEXA-voice-spec.md`, beside
`CONTEXA-card-spec.md` and `CONTEXA-design-brief.md`. Their internal "Suggested
repo home: claude/..." is wrong for this repo: there is no `claude/` folder on
disk and none is to be created (owner, 2026-08-27). The `claude/` prefix remains
correct for PROJECT doc paths only. **Both specs are now implemented and
committed.**
 
**⚠️ THE HOME-DIRECTORY CHECKOUT IS DISABLED as of 2026-08-29** — `C:\Users\Q\.git`
is now `.git.disabled`, so a git command run from home fails loudly instead of
quietly operating on the wrong tree. The 63 stale duplicate files it left behind
are **parked, not deleted** — see §8.
 
**Squiggle is a separate product since 2026-08-25** — own repo
(`C:\Users\Q\squiggle`), own extension, own Claude project. CONTEXA contains no
lint code; any reappearing is a regression. **But the two share a composer AND a
colour — see §9 and §9a.**
 
---
 
# 1. STATE
 
| artifact | version | evidence |
|---|---|---|
| Extension on disk / git | **0.9.56** — commit `873e54e`, tag `v0.9.56`, both on origin 2026-08-28 (`b308c1a..873e54e`, tag object `dc04283…`). **Published tags: never move them.** | ceremony clean: history key scan, both suites, build, staged-diff scan; 8 files, +477/−20 |
| Worker **deployed** | ✅ **0.9.56 — LIVE.** Two deploys in order, deliberately: caching alone first (`3e1c94d0`), then the voice (`9814779d`). `/v1/health` reports `version 0.9.56` | health checked after propagation; upload grew 52.65 → 54.37 KiB, matching the prompt's +1.7 KiB exactly |
| Chrome Web Store | **0.9.54 public · 0.9.55 SUBMITTED, in review · 0.9.56 not submitted** | two packages cannot be in review at once — 0.9.56 waits for 0.9.55 to clear |
| Store description | §1 of `claude/CONTEXA-store-listing.md`, revised 2026-08-28 (typing-box sentence deleted); manifest short description shipped in the 0.9.55 package | safe to paste at any time — see listing §0 |
 
**What 0.9.55 carries** (in review): mascot trigger with the class-driven hover
gesture, interview card skin (pills · dots · collapse), mascot manifest icons
16/32/48/128, the corrected 125-char short description, and the interview's
free-text input removed with Skip in the options row.
 
**What 0.9.56 carries** (live on the worker, waiting on the store for the
own-key path): Register C in `QUESTIONS_SYSTEM`, the want-anchor including the
borrow rule, and the removal of the prompt's description of the deleted
free-text box.
 
**⚠️ THE SETTINGS PAGE STILL UNDERSTATES THE FREE ALLOWANCE BY HALF, AND THE
WINDOW TO FIX IT FREE IS OPEN NOW.** The worker gives `PROMPTS_PER_DAY = 20`
(`DEVICE_DAILY_LIMIT = 40` calls); the quota card derives 20 live and the store
description says 20; `options.html` and `options.js` hardcode **"Fair use is 10
prompts a day"** in three places, stale since the caching commit doubled the
ceiling. Deferred by the owner 2026-08-28 (the direction is safe — users get
more than promised).
 
**The window:** `options.html` ships only in a store package, and everything
after 0.9.56 is prompt-only on the wrangler clock. **0.9.56 is committed but not
yet submitted**, so the fix can ride it if it lands before the submit — after
that, it waits for an unplanned store release. The fix is three strings to 20,
plus converting the assertion `options page states 10 prompts a day`, which
**pins the value where the requirement is a rule** and is currently keeping the
wrong number looking correct; it should read `PROMPTS_PER_DAY` out of
`worker/src/index.js`, which the extension suite already reads across into. Also
`options.js`'s Advanced "Connected ✓" flash prints `r.limit || 20` — the raw
call ceiling dressed as a per-day number. The sibling assertion `no surface
still claims 20` only forbids old phrasings, so writing "20 prompts a day" does
not trip it.
 
**PROMPT CACHING is live as of 2026-08-28.** ~7,100 tokens of fixed system
prefix per finished prompt were re-sent and re-billed on every call; now wrapped
in a `cache_control: ephemeral` block by `cachedSystem()` on both payload paths,
with a plain-string fallback so an unsupported cache can never be why a user
gets nothing. **Deployed but the cache HIT is still unproven** — that needs a
hosted call, and the owner's own-key path never touches the worker (and her
unpacked build cannot, since `ALLOWED_EXTENSION_IDS` is pinned to the store ID).
The proof will come from the first real hosted user, or from her store install
with no key configured: `cache_creation_input_tokens` on the first call,
`cache_read_input_tokens` on the second, in `wrangler tail`.
 
**Two caching facts written into the code rather than assumed:** there is a
minimum cacheable length and a prompt below it is silently not cached — if a
system prompt is ever trimmed, check `usage` on a live call instead of trusting
the comment. And a cache *hit* needs a byte-identical prefix, so nothing may be
interpolated into that text; a build stamp spliced in there would miss on every
call while looking correct. An assertion pins that the cached text contains no
date-shaped string.
 
**Mili tests on the own-key path** (unpacked build + saved API key), which never
touches the worker — **and the own-key path is still uncached**, same prompts,
same waste, her own bill. Not done; her call. Establish the path before
explaining any symptom, and read the version off the mount line:
`[CONTEXA] card mounted v0.9.56 ai anchor top=…`. **But note the mount line's
blind spot**, found 2026-08-28: it only moves when someone moves it, and two
different prompts shipped as 0.9.56 within two hours during one development
cycle. When the version cannot discriminate, the build artifact can — read
`build-ready/background.js` for the string in question and compare its mtime.
 
**Credits: $4.56** as of 2026-08-22. Top-up owed; the listing is public so the
pool can be spent by strangers.
 
---
 
# 2. PRODUCT INVARIANTS
 
## 2a. Zero is a product outcome
Nothing earned, nothing said. **Never a floor, a fallback chip, or a minimum
count — and never a ceiling either.** 0.9.53 changed how zero LOOKS without
changing what it is: the input opens because the user *asked*, gated on
`assume.length === 0`, never `true`.
 
## 2b. The interview is CLICK-ONLY *(0.9.33; literal since 0.9.55)*
A question that cannot be reduced to options is **dropped**, not softened.
**Order in code is load-bearing: map → drop → slice.** Material the user must
supply belongs in the composed prompt as `<paste here>` — **that obligation
lives in `EXPAND_SYSTEM`, not `QUESTIONS_SYSTEM`** (0.9.49).
 
**0.9.55 removed the interview's free-text input entirely** — options as PILLS
(≤4-word `shortLabel` handle, full sentence on the hover title, the click
answers with the full sentence) plus **Skip at the end of the options row**.
The owner's reason is structural: the typing affordance lives downstream — skip
everything and you land on the fifth chip, and a click that earns nothing opens
the box — so the per-question input was a duplicate. **0.9.56 removed the
prompt's description of it too**, which had gone false and which two assertions
were quietly preserving (pattern file, Defect G).
 
## 2c. An interview payload is not a rough ask *(0.9.34)*
A click list has **no verb in it**. A decision among the answers IS the ask; if
every answer is a fact, the missing ask is the user's own last message, re-asked
with the facts folded in. **Field-confirmed 2026-08-28**: a standalone assume
click produced exactly that re-ask, correctly.
 
## 2d. One prompt, one verb *(0.9.36)*
> **Could this bullet be sent on its own as a complete request? Then drop it.**
 
**Count structure, not verbs.** Criterion J as written is a string-matching
detector; the send-alone test is the structural one.
 
## 2e. Every required output part must be DEMONSTRATED *(0.9.35–0.9.40)*
> **For each field the schema requires, count the exemplars that show it.**
 
**A demonstration count is a floor on capability, not a dial on frequency.**
And its limit, found 2026-08-28: an exemplar matching the input almost verbatim
still did not decide which BRANCH the model took. Exemplars beat rules; they do
not beat everything, and a defect that crosses a branch boundary may not be
fixable inside one branch.
 
## 2f. The composer answers in text *(0.9.39)*
It returns one string, so nothing parses it. `readDraft` unwraps a wrapper or a
fence out of habit — but **a prompt may begin with a brace**, and there is a test.
 
## 2g. Scroll-away is geometric, never motion *(0.9.46)* — CLOSED
Show within 140px, hide past `140 + cardHeight + 60`. **No timer in the watcher.
Do not add one. Do not tune the constants.** Retirement proposed and REJECTED.
Field-confirmed 2026-08-28 (`hidden — conversation is up against the card` /
`shown — nothing in the way`).
 
## 2h. Say what you picked *(0.9.49)*
> **`assume` and the composer body are two routes for the same obligation, and
> only ONE fires per fact. The question is never "did `assume` fire" — it is
> "did the fact reach the message box."**
 
**And now the failure that invariant predicted has a capture** (2026-08-28): a
composed prompt carried the fact in its body AND repeated it on an `Assume:`
line. Criterion B with a recording. Filed in the pattern file under THE MIRROR,
as its unexamined direction. `EXPAND_SYSTEM` is untouched by 0.9.56 — **get a
second specimen before editing it.**
 
## 2i. The call is ON DEMAND *(0.9.53)*; the doorknob is the MASCOT *(0.9.55)*
Reply completion renders **one control and makes no model call.** Clicking runs
`askNow`. **Capture stays EAGER — only the call moved.**
 
The trigger is the mascot: bubble/aria copy **`What now? ✦`**, no text label,
classes `ctxa-mas-*` only; fifth chip `✎ Type & create magic`, untouched.
**Star asks, pencil types.** **Criterion P's trigger half is CLOSED by
construction**; what remains: `chip own` still covers the compose chip, the
fifth chip and *Hide for this session*.
 
**The hover gesture is CLASS-DRIVEN, and that is load-bearing.** The pure-CSS
`:hover` gesture fired once per page load in live claude.ai and never re-fired,
while a clean Chromium re-fired it every time (`elementFromPoint` at the
mascot's centre returned our holder, killing the overlay theory; root cause in
the live SPA never identified). The fix the field confirmed — *"namignula je"* —
is `.ctxa-peek`, toggled by the button's own mouseenter/focus with a
forced-reflow restart. **Do not simplify the gesture back to CSS-only.**
 
## 2j. v1 moves — BOTH ARMS NOW FIELD-PROVEN, and the fork has a measured gap
Spec: `claude/CONTEXA-v1-chips-spec.md`. One call, two output shapes, **never
both**. Four chips, closed list: `deeper` · `choose` · `risk` · `why`.
 
**The moves arm fired in the field for the first time on 2026-08-28**, off a
reply that listed finished work and asked nothing — the exact shape this section
said a real test needed. The row came back `Take it further · What could go
wrong?` and `deeper` composed into the box. Criterion Q now has data on both
arms.
 
**And the fork has a quantified defect.** On a reply that asks the user
directly — *"tell me if you want me to add it"* — the fork takes the MOVES
branch **20–40% of the time** (offline A/B, 5 runs × 3 prompt variants). That is
wrong by the prompt's own rule, since the decision is hers to supply. **The gap
is readable in the text, not inferred from runs:** the prompt says what to ask,
and says moves never accompany questions, but never says **which wins when both
are earned** — and that reply earns both (it names a quota assumption, which is
`risk`, and it asks her to decide, which is a question).
 
**Pre-existing, NOT a 0.9.56 regression** — the pre-voice prompt takes the moves
branch too. Left deliberately for its own change with its own before/after on
the same harness (§8).
 
## 2k. Register C — the interview speaks in the user's inner voice *(0.9.56)*
Spec: `CONTEXA-voice-spec.md`. Questions and option labels are the words the
user would use thinking to herself, never a form addressing her. Scope is
questions and labels only: `EXPAND_SYSTEM` is untouched, because the composed
prompt's voice is a function, not a style — it speaks as her because it *is*
her draft. **Chip texts are also out of scope**: a chip is a message she sends
*to Claude*, where "you" means Claude and is correct.
 
**Measured, not asserted** (offline A/B, 2026-08-28):
 
| variant | whose "I" |
|---|---|
| before the fix | *"Da ubacim skaliranje…"* — Claude's, **0 of 4** |
| after | *"Da li mi treba…"*, *"Da li hoću…"* — hers, **5 of 6** |
 
The pre-fix prompt reproduced the field's exact defective question 4/4, so the
field capture was reproducible rather than a one-off. **This register's named
failure mode is I-drift** — a question whose "I" reads as the tool — and the
mitigation is the want-anchor, including the rule that a reply offering in its
own first person is the sharpest trap and that "I" is never borrowed. Guarded
structurally: every demonstrated question and option set is checked for second
person, and the want-anchor exemplar is pinned.
 
If I-drift returns in the field, the spec's fallback is Register A — a register
change, not a form change, one prompt edit.
 
---
 
# 3. NEXT
 
**⚠️ NO DESKTOP 2026-08-29 → ~09-08 — the owner is away, phone only.** Nothing
below that needs git, wrangler, node, a package upload, a screenshot capture or
a field test can move in that window. What CAN move is in
`claude/CONTEXA-away-10-days.md`; what accumulates goes into
`claude/CONTEXA-return-queue.md`, in execution order. **The store clock is not
lost:** 0.9.56 could not be submitted until 0.9.55 clears anyway, so the
settings `10 → 20` window (§1) is still open on her return.
 
1. **Watch 0.9.55 through review.** When it clears: submit 0.9.56 — and
   **first** decide whether the settings "10 → 20" fix rides it (§1). That
   window closes at the submit.
2. **Prove the cache hit.** Needs a hosted call: `wrangler tail`, then
   `cache_creation_input_tokens` on the first and `cache_read_input_tokens` on
   the second. **Set the Anthropic Workspace spend cap** if not already done —
   it is the only hard ceiling. (Owner confirmed 2026-08-28 that a workspace
   limit exists.)
3. **The fork precedence rule** — §2j, with `prompt-ab-fork.mjs` before and
   after. Prompt-only, wrangler clock, independent of the store. **The rule
   itself can be decided and drafted away from the desk; the A/B and the deploy
   cannot.**
4. **Retake the screenshots AFTER 0.9.55 is live** — listing §2, step 0 first
   (the mascot alone). Stale twice over; `store-assets/store-icon-128.png`
   still carries the coral star. **The shot list can be written away from the
   desk; the capture cannot.**
5. **Replace the hosted privacy-policy gist** with the on-demand rewrite — URL
   is in the dashboard's Privacy tab. Owner deferred 2026-08-26.
6. **A second specimen for the `Assume:` duplication** before touching
   `EXPAND_SYSTEM` — §2h.
7. **The Errors badge** in `chrome://extensions` — may be stale history.
8. **Top up credits.** The listing is public and nobody watches the pool while
   she is away.
9. **The home repo is neutralised** — `C:\Users\Q\.git` renamed to
   `.git.disabled` 2026-08-29, verified: git from home now reports no
   repository, and `contexa` still reads `873e54e` / `v0.9.56`. What remains is
   the 63 stale duplicate files, **parked by the owner** — §8.
10. **Caching for the own-key path** in `extension/background.js` — same
    prompts, same waste, her own bill. Her call.
11. **All visual design lives in its own chat**, which owns
    `CONTEXA-design-brief.md`. Locked: teal `#15a594`; ✦ in-page only; mascot =
    manifest icons; ring = brand-only. Open there: site colour, click-word
    accent. **Carry the rejection: the full-brand pitch-black card — built,
    seen live, reverted the same hour. Do not re-brand the card.**
12. **0.9.48 is still unproven.** The real test is a thin reply.
13. Residual: `grounded < kept` a few times a session. Count before dropping.
---
 
# 4. MOBILE
 
**Android works today** — Edge, Lemur, Mises, Quetta. Chrome for Android never
has. **The gotcha:** claude.ai's *"Log in with Google"* fails after the
password; email sign-in works. In `SETUP-FOR-FRIENDS.md` and the store
description. *(0.9.55 helps mobile: the interview needs no keyboard at all.)*
 
**This is also the only field-test route while she is away from the desk** —
a mobile install can capture a specimen (criterion B, §2h) that a laptopless
week otherwise cannot. It runs the STORE build, i.e. the hosted path and
whatever version is public, not her unpacked 0.9.56 — say which build a phone
capture came from before reading anything into it.
 
---
 
# 5. WEBSITE
 
Built by Fable 5, Ink & Highlighter (`#FFFDF4` / `#141414` / `#FFD84D`),
**not deployed**. **The file is not in `C:\Users\Q\contexa` — first job is
finding where it lives.** Cloudflare Pages, not the Worker. A separate
`Contexa - chrome store website` Claude project holds the build prompt; it is
**not** reachable from this project's sessions.
 
**The demo is structurally wrong**: it opens on the card, and the first thing
that exists is now the mascot. Full plan in
`claude/CONTEXA-on-demand-review-and-next.md`.
 
Copy: `Prompt like a PRO` → **CONTEXA — Claude prompts, without the writing**;
footer keeps *"Create magic in Claude."*, delete the second sentence.
 
---
 
# 6. WATCH CRITERIA
 
**Check the version on the mount line and that only one build is logging** — and
remember the mount line cannot tell two prompts apart inside one version (§1).
claude.ai is an SPA; the console does not clear between chats, so discriminate
on `top=` geometry. **Three writers share that console: Grammarly, CONTEXA,
Squiggle.** Check the extension id and the `[CONTEXA]`/`[SQUIGGLE]` prefix.
 
- **A — quiet NEVER happens** → a floor is back in spirit.
- **B — an `Assume:` line restating something the user typed.** **Specimen
  captured 2026-08-28** — pattern file, THE MIRROR.
- **C — the obvious question, handed back from the reply.** Defect only when
  **the reply supplied the answer**; NOT when the reply *asked* and CONTEXA made
  it clickable. The test is whether the ANSWER was already on screen.
- **D — `grounded < kept`** → measure first.
- **F — bad options.** Buckets instead of names. Pills add a sub-case: a
  `shortLabel` handle that misleads about the sentence it composes. With no
  free-text box, options and Skip are the whole answer space.
- **G — abandonment.** · **H — `dropped unclickable` on most calls.**
- **I — a composed prompt sending the reader back over an answer they read.**
- **J — more than one imperative verb.** Send-alone test first. §2d.
- **K — raw JSON in the message box** · **L — the card blinking** (a timer is
  back) · **M — `v?` on the mount line.**
- **N — `grounding` firing at reply completion** → the lazy split came undone.
- **O — the trigger going unclicked.** 0.9.55 changed the doorknob — readings
  before and after are not one series.
- **P — two controls sharing a label OR a class.** Trigger half CLOSED.
- **Q — a moves row that should have been an interview.** **Now quantified:
  20–40% on a decision-shaped reply** (§2j). Both arms have fired in the field.
- **R — a Squiggle mark on a CONTEXA composed prompt** *(§9)*.
- **S — teal INSIDE the page: RESOLVED BY DESIGN (mascot).** Watch for teal
  creeping anywhere else in-page; the black-card episode is the specimen.
- **T — a public number not computed from the code.** Wrong in BOTH directions
  now: the listing once said 10 while the worker enforced 20, and the settings
  page says 10 while the worker gives 20.
- **U — I-drift** *(new, 0.9.56)*: an interview question whose "I" reads as the
  tool rather than the user, especially where the reply offered in its own first
  person. This register's named failure mode; measured at 0/4 before the fix
  and 1/6 after.
**Record which model wrote the REPLY.** Reply shape is an input to every
criterion above.
 
## Still open — is CONTEXA simple enough for a beginner?
Three theories died 2026-08-23: not the question count, not the questions, not
prompt length. It was the composer, three times. Joined by: whether a trigger
they must click first reads as an offer at all — **0.9.55 and 0.9.56 pull three
levers at that question: a character where a text chip stood, an interview that
asks literally nothing but clicks, and questions written in her own voice.**
 
---
 
# 7. QUEUED
 
`LISTING.md` — a self-marked tombstone. Leave or delete.
`"Searched the web"` — unexplained, not fixed on one observation.
Worker test label still reads *"not kept (5)"*.
build.mjs manifest-vs-LISTING assertion.
build.mjs comments carry pre-existing mojibake (UTF-8 read as cp1252) in
comments and console strings only. Cosmetic; owner's call.
`LEGACY_STEPS_SYSTEM` retirement — only once no older install is plausibly
calling.
Friends cohort check · `FRIEND-MESSAGE.md` · Reddit / TinyLaunch / website
deploy. Standalone-app brief.
 
**`dismissStreak` — CLOSED 2026-08-24.** Criterion O is the real signal.
 
**MONETISATION — decided 2026-08-26: option 5, the ceiling IS the product.** No
account, no sign-up, no API-key upsell; hitting the cap means come back
tomorrow. Sign-up rejected: a registration wall between install and first value
would cost more users than any daily limit, and it contradicts published store
declarations plus the privacy policy. **The measurement actually needed is
free:** whether people send the composed prompt as-is or edit it first
(`claude/CONTEXA-monetization-split.md`) — five people and a conversation. The
friends cohort has been queued since the beginning and never run. **It needs no
desktop, which makes it the one piece of real evidence obtainable while she is
away.**
**Where the paid idea goes instead:** the standalone app. The doc's central
argument — *you cannot sell inference to someone who can buy inference
directly* — was about developers; CONTEXA's audience cannot practically buy
inference, so for *them* more calls is a sellable good.
**Rejected on sight:** using the user's own logged-in claude.ai session to
generate for free.
 
**Cancelled:** `/code/` support.
**Rejected deliberately:** salvaging an unwrapped prompt · a floor or fallback
chip · a question-count cap · tuning the scroll thresholds · yielding to
claude.ai's question widget · retiring `watchScroll` · loosening the `assume`
gate · the thirteen trigger-design directions · sign-up and telemetry ·
special-casing expand to bypass the quota counter · **the full-brand
pitch-black card**.
**Retired vocabulary:** *"make bad prompts good"*, *"Prompt like a PRO"*,
*"Rough ask"* — the copy says *type it rough* instead.
**Never add:** temperature/top_p/top_k, assistant prefill, echo-your-reasoning.
 
---
 
# 8. PLAYBOOK
 
## The offline A/B harness — `prompt-ab-fork.mjs` *(new 2026-08-28)*
 
**The UI cannot give a clean A/B and three attempts proved it.** Every reload is
a new page, every reply is a new input, the console is shared between chats, and
the fourth attempt was voided outright when an accidental message changed the
conversation underneath the test. The harness sends **one fixed pair through
several prompt variants, N runs each**, and prints only which branch came back
and what the question said.
 
It assembles the call exactly as `background.js` does — same system prompt, same
section labels, same 2500 ceiling, same disabled thinking, same model — and
**rebuilds the previous prompt by removing the current release's additions**,
which is what makes it an A/B rather than a demo. Its self-check is length: the
reconstructed pre-fix prompt came to 19,464 characters, the exact size the
prompt had before the edit.
 
The key is read from `ANTHROPIC_API_KEY` and never printed or written.
`ab-input.json` holds the pair and is committed, so a measurement can be
repeated rather than described. **Its limits, stated in the file:** the pair is
a transcription plus a stand-in user message, so it reproduces the field's
*shape*, not its bytes — it measures the difference between variants, never the
absolute rate. And its parser is stricter than the pipeline, so a partial that
the product would salvage reads as `unparsed`.
 
**Fifteen calls settled in minutes what half a day of clicking could not**, and
it corrected two of the session's own conclusions (below). Use it before any
further prompt edit.
 
## Two conclusions this session got wrong, and what corrected them
 
**"The voice edit moved the fork."** One field run before the edit said
questions and three after said moves. On a fixed input: 4/5, 3/5, 3/5 — one run
of difference. **The fork is stochastic on that input and always was.** A
before/after with n=1 on one side is not evidence, however clean the story.
 
**"The exemplar's position caused it."** Placement after the moves block was
named as prime suspect and filed as Defect B's third instance. The A/B split the
branch identically in both positions, and the "bad" position worded its
questions best. **The move back is hygiene and is pinned by a grouping
assertion; it explains nothing.** Both corrections are recorded in the pattern
file and the changelog — a suspicion recorded without its refutation is worse
than one never raised.
 
## The home repo — two checkouts of this repository existed *(2026-08-28/29)*
 
`C:\Users\Q\.git` was a **second clone of the CONTEXA repo whose worktree was the
entire home directory** — which is why `extension`, `worker`, `build-ready`,
`publishing`, `icons` and `store-assets` also sit at the top of her home folder
(almost certainly a leftover from before the project moved into `contexa\`,
hence very stale).
 
- **Every git command run from `C:\Users\Q` silently operated on the wrong
  repo** — and her shell usually starts there. A `git log` taken there was used
  as a pre-ceremony baseline; it happened to show the same commits, but tags are
  per-clone and the check was worthless.
- A bare `git add -A` there staged **the whole home directory** into the CONTEXA
  repo — Downloads, `.codex`, `.openclaw`, `.wrangler` (Cloudflare
  credentials). This happened and was stopped only by luck: git refused the
  nested repo at `.openclaw\workspace\` and aborted. Verified afterwards: 0
  files staged, nothing committed, `contexa\.git\index` untouched.
**Mitigation:** always `cd` into `contexa` first — `release-commit.ps1` does it
for itself via `Set-Location $PSScriptRoot`, so the ceremony is safe wherever it
is invoked.
 
**CLOSED 2026-08-29:** `C:\Users\Q\.git` renamed to `.git.disabled`. Verified
after the rename — git from home reports no repository, `contexa` still reads
`873e54e` with tag `v0.9.56`. **The diagnosis flip-flopped once before it was
settled**, and the lesson is the durable part: `git rev-parse --show-toplevel`
answers "which repo am I in" in one line and should be the FIRST command run,
not `git remote -v`, whose output is identical for two clones of one repo.
 
### Parked: the 63 stale files in `C:\Users\Q` *(owner's call, 2026-08-29)*
 
The disabled clone tracked **63 files** — `extension\`, `worker\`,
`build-ready\`, `publishing\`, `icons\`, `store-assets\` plus loose root files —
all duplicated at the top of the home folder. **Verified before parking:** every
one of the 63 also exists under `contexa\`, every home copy is OLDER than its
`contexa\` counterpart, and nothing exists only in home — the safety check
printed `ukupno za pregled: 0`. `.git.disabled` itself is redundant on that
evidence (HEAD == origin/main, no local commits, empty stash), but it is the
safety net and it stays.
 
**The owner declined the deletion 2026-08-29** — *"mnogo imam da izgubim"* — so
this is a NOTE, not a task, and nothing should re-propose it unprompted. If it
is ever picked up: delete **by the 63-file list, never by pattern** (the home
folder holds unrelated work), and remember `device_bash` cannot delete — it can
only move files into a `_to_delete\` folder for her to remove herself.
 
## Handing over commands
 
**One executable block per message, and never format anything else as one —
including INLINE code inside prose.** Extended 2026-08-28 after a real cost: a
sentence explaining what the ceremony script does internally contained
`git add -A` as inline code; it was copied out of the prose and run, in the
wrong directory, against the home repo. **If a command must be mentioned but not
run, describe it in words.** Sample output, log excerpts, browser-console JS and
git logs are output, not commands: test messages go in blockquotes,
browser-console probes go in blockquotes labelled as such.
 
**Run `git log --oneline -3` BEFORE handing over a ceremony command** — in the
repo directory. **An unpushed tag is not a published tag; verify with
`git ls-remote --tags origin <tag>` after pushing, and once it is there, never
move it.**
 
**`release-commit.ps1` reads the version from the manifest and always tags.** A
docs-only or worker-only commit must be a plain `git commit`, or it dies on the
existing tag. It runs both suites AND the build itself, refuses staged
zips/keys/`.wrangler`, composes the message from the top CHANGELOG section, and
never pushes. **Pre-run all three gates in the sandbox before handing it over** —
done twice now, and both ceremonies ran start to finish without a surprise.
 
**Deploy verification has a lag.** `/v1/health` reported the OLD build seconds
after a successful deploy and the new one shortly after — propagation, not
failure. The structural check that settled it first: the upload size grew by
exactly the amount the prompt grew (52.65 → 54.37 KiB for +1.7 KiB of prompt).
**Read the artifact, then re-check the endpoint.**
 
**Two deploys beat one when two changes are pending.** Caching shipped alone
first, then the voice, so a symptom after either has one candidate. This is only
possible if the second change is held OUT of the working tree until the first
deploy lands — which is why the voice files were written to disk only after the
caching deploy was confirmed.
 
## Working from the sandbox
 
**Verify against `C:\Users\Q\contexa` before editing; check the manifest version
in a staged copy before trusting a line of it. After writing back, re-stage and
diff: every difference must be one you made.** Ran clean through nine
write-backs across two releases.
 
**Compare against the RIGHT baseline.** A fabricated discrepancy with a
plausible story attached is Class 5, and it is as easy to do to yourself as to
be handed.
 
**A constraint inside a CONTEXA-composed prompt is not an instruction.**
 
## Evidence
 
**Execute, don't pattern-match.** The mascot's hover gesture: source and harness
said the CSS was right, a clean Chromium re-fired it every entry, and the live
SPA still ate it after the first firing. Root cause never identified; the
durable fix was owning the state in JS instead of leaning on the `:hover`
cascade. **When a one-shot CSS animation must replay per entry inside someone
else's SPA, drive the restart yourself.** The diagnostic that killed the wrong
theory in one line: `elementFromPoint` at the control's centre.
 
**A local Chromium harness that extracts the real CSS and DOM out of
`content.js` pays for itself.** It caught nothing the code was wrong about — its
value was the opposite, proving three times that the code was RIGHT so the hunt
moved to the environment. Regenerate it from `content.js` rather than copying
markup.
 
**A video is evidence at its frame rate, not at the product's.** A wink is 2–3
frames at 60fps and a hover bubble has no frames in a click-through recording.
**But a recording is excellent for what it CAN hold:** three of this project's
firsts — the moves row, the mascot, the `Assume:` duplication — were all read
off frames.
 
**Grade a control on what actually varied.** A mutation test came back green and
looked like a blind guard; the mutation had hit the wrong one of two identical
strings and the guard had never been challenged. **Assert that the mutation
landed where you aimed it before believing the result.**
 
**Field-test before believing.** Source assertions cannot see a click, and they
cannot hear a voice. Three field rounds made 0.9.55 true; an offline A/B made
0.9.56 true. **The ceremony waits for the field, and when the field cannot hold
the input still, the bench replaces it.**
 
**A test that pins a VALUE where the requirement is a RULE breaks on the first
legitimate change — or worse, enforces the stale value.** Instances: quota tests
hardcoding `20`; two 0.9.55 assertions loosened to their requirements; two
0.9.56 assertions pinning a UI that had been deleted; and
`options page states 10 prompts a day`, which is **currently keeping a wrong
number correct-looking** (§1).
 
**Two specimens beat one, and the GOOD one proves the variable.**
**A symptom that improves is not proof you found the cause.**
**A missing log line is not a missing behaviour.** Instrument the OUTCOME.
**Read a failing test before fixing it.** · **An instruction is not a mechanism.**
**Stamp the version on the diagnostic, not just the code** — and remember it
only discriminates when someone moves it.
**When the same requirement is missed twice, stop coding and restate it.**
**Do not confuse technical savvy with prompt savvy.**
 
## Environment
 
**The extension suite reads across into `../worker/src/index.js`** for the
`cleanChips` identity check — and that same bridge is how a public number should
be read rather than retyped (§1). A working copy needs both trees.
 
**Reloading an unpacked extension does not update open tabs.** Reload, then
Ctrl+R every claude.ai tab. **An unpacked copy pointed at `build-ready/` shows
the OLD version until `node build.mjs` runs.**
 
**PS 5.1: `&&` is not valid — use `;`, which does NOT short-circuit.** `-F` for
any message quoting text. **`npx wrangler`, not `wrangler`.**
 
**`build.mjs` owns `VERSION`.** It verifies prompt byte-identity but does not
copy. **A prompt change is never worker-only** — it changes `background.js` too,
so it reaches hosted users on the wrangler clock and own-key users on the store
clock, and the two will disagree until the package ships.
 
**Public copy is a surface that goes stale silently — and so is a system
prompt.** When a mechanism changes, sweep everything that describes it in the
same session: manifest, listing doc, privacy policy, settings page,
`SUBMISSION.md`, promo tiles, screenshots, website **and both system prompts**
(pattern file, Defect G). The settings page is the surface that keeps being
forgotten, and it is wrong right now.
 
---
 
# 9. THE TWO PRODUCTS SHARE A COMPOSER — Squiggle owns the fix
 
**Field, 2026-08-26.** With CONTEXA 0.9.54 and Squiggle 0.1.2 both installed,
CONTEXA composed a prompt into the message box and **Squiggle marked it.** Teal
dotted mark under *"Give me"*, tooltip *"Asks for something made, without saying
what form it takes."* Confirmed in code: feeding the exact composed string to
`lint.js` returns `no-output-shape`, soft, span *"Give me"*.
 
**On the merits a marginal false positive** (the prompt asked for *the hex
value*, and a hex value **is** a format). **But the interaction matters more:**
CONTEXA's promise is *we write the prompt for you*, and Squiggle underlining
that prompt reads as two tools disagreeing inside her own message box.
 
**DECIDED by Mili: tighten `no-output-shape` so a named concrete artifact counts
as naming its form.** The work is Squiggle's, in the Squiggle project. What
stays here is criterion R and this record.
 
## 9a. And they share a COLOUR — the collision is real, Squiggle moved
 
Measured, not eyeballed: CONTEXA brand `#15a594` (~173°), Squiggle soft light
`#0D9488` (174.7°), Squiggle soft dark `#2DD4BF` (172.5°). **Within ~2 degrees
of hue; brand-vs-Squiggle-light is CIE76 dE 7.8 — the eye reads them as one
colour.**
 
**Not a coincidence, and that is the transferable part.** Both products picked
teal by elimination from the same constraint space. **When two of our products
pick a colour by elimination, expect them to collide.**
 
0.9.55 ships the teal mascot in-page as the one loud element, so teal now means
"CONTEXA" (mascot above the box) and "Claude will guess here" (soft marks in the
text) in one composer. **Squiggle yielded** — its SOFT mark is graphite
(`#57534E` light / `#A8A29E` dark) as of 2026-08-28, guarded by a structural
build assertion that reads the declared custom-property values only. **Blue
remains at risk** — `#4F77C5` sits in CONTEXA's icon swatch row and, since
0.9.55, in the interview progress dots.