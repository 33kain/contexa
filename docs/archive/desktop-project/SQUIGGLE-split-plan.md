# Squiggle — the split, and what it cost
 
**Decided 2026-08-24, executed 2026-08-25/26.** This document records the
decisions, the order of work, and how it actually went. The technical spec is
`claude/SQUIGGLE-spec.md`; live product state lives in the Squiggle project and
its repo, not here. This is now a record, not a plan.
 
---
 
## 1. The decisions
 
| | decided |
|---|---|
| **Name** | **Squiggle** |
| **Tagline** | *see where Claude will misread you* (shipped in the manifest name) |
| **Architecture** | **A** — own repo, own extension, own store listing |
| **Console prefix** | `[SQUIGGLE]` — shipped, and enforced by build.mjs |
| **CSS prefix** | `.squiggle-*` — shipped, `contexa-*` identifiers fail the build |
| **Version** | **0.1.0**, not a continuation of 0.9.x |
| **Infrastructure** | **Own worker** — decided 2026-08-26, see §5 |
 
Two were technical decisions dressed as cosmetic ones. **The console prefix is
load-bearing:** two separate extensions logging `[CONTEXA]` into the same page
console is Contaminant 1 with the volume turned up. Both prefix rules are now
build failures, not instructions — the strongest form we have.
 
**"Linter" is an internal word and must never reach a user.** The audience is
beginners; they do not know it.
 
---
 
## 2. Naming — what was checked and killed
 
Recorded so nobody re-litigates it. Five candidates died, and the pattern is
the argument for the survivor.
 
| candidate | verdict |
|---|---|
| **Squint** | taken — Chrome Web Store *and* Google Play. First choice, gone. |
| **Readback** | Chrome Web Store collision (*ReadBack – Save Reading Position*). Best on the merits: in aviation a readback is the receiver repeating the instruction to prove they understood, which is exactly this product. |
| **Legible** | **Legible Inc.**, a publicly traded browser-based reading platform, plus a registered Canadian trademark (CIPO 2122632). Same category. Not survivable. |
| **Readthrough** | `readthrough.com` live, existing product. |
| **Prompt-anything** | free but invisible. Promptly, PrettyPrompt, Gud Prompt, PromptKeeper, Prompter, SpacePrompts. Fortieth entry in a mush. |
| **Squiggle** | **clear.** Nearest hits are *Chromie Squiggle New Tab* (a different name) and a VS Code language extension. |
 
**The test that produced the shortlist, worth keeping:** a good name here
describes *what the user does to check*, not *what the model gets wrong*. Squint
and Readback pass. Hunch, Misread and Blur fail — naming the failure makes the
product sound like it commits it. Squiggle sidesteps the test entirely by naming
the **mark**, and for this product the mark IS the value: a squiggle under a word
is one of the most universally understood symbols in software.
 
**A caveat that was raised and then retracted.** Claude warned that a cute name
caps team adoption. That does not survive contact with evidence — Slack,
Mailchimp, Grammarly, Figma, Loom, Notion, Asana, Trello and Zapier are all
playful or meaningless and all sell to teams. What gates team adoption is an
admin console, SSO, seat billing and a security story, not the name. The warning
was stated with more confidence than it deserved and it cost a decision Mili had
already made and liked. **Recorded because the retraction is the useful half.**
 
---
 
## 3. Order of work — ALL STEPS DONE
 
1. ~~Field test on 0.9.55~~ **DONE 2026-08-25** — §7. Both halves passed; the
   test found the slot-lints-itself defect.
2. ~~Untangle git in the CONTEXA repo~~ **DONE** — v0.9.54 committed clean.
3. ~~CONTEXA gives the linter back~~ **DONE at v0.9.54** — verified 2026-08-26
   by grepping every shipped file and build.mjs: zero residue.
4. ~~New repo, new extension~~ **DONE** — `github.com/33kain/squiggle`
   (private), v0.1.0 tagged on the release commit `2f425a7`, suite
   93+82+148, own background/content/options/build, pattern file repo-local.
5. **Left:** the visual (Mili directs), the worker (§5), the listing, the
   screenshots.
## 4. What Squiggle borrowed vs owns — resolved
 
Standalone it now owns all of it: `background.js` (~300 lines vs CONTEXA's
694), `content.js` (~200 vs 1364 — about 60 lines of CONTEXA's were actually
used, the strongest evidence these were always two products), options page,
build.mjs with its own guard set, icons, README, three suites.
 
---
 
## 5. Infrastructure — DECIDED 2026-08-26: OWN WORKER
 
Chosen over shared-worker and own-key-only, by Mili, with the tradeoffs on the
table.
 
**The shape:** clone CONTEXA's worker and gut it to one endpoint —
`/v1/rewrite` plus `/v1/health` and the quota machinery. The pattern is proven
as of the 0.9.54 deploy: KV quota, pinned extension ID, workspace-scoped key
with a hard spend limit, error translation, thinking-400 retry.
 
**Why it wins:** marks are free and local; **only a click spends**, so a hosted
Squiggle user costs at most CONTEXA's ~$0.16/day figure and likely well under
half (rewrite output is a sentence with slots, not a questionnaire). Beginners
become reachable in 0.2 without re-welding the products through a shared pool
or schema — the coupling the split exists to avoid.
 
**Rejected:** shared worker (re-welds), own-key-only-forever (a dev build, not
a product, for this audience — and a store listing over a keyless install shows
a beginner nothing, which reads as broken).
 
**Order:** own-key 0.1.x stays the dev/unlisted track; the worker gates any
public listing. The asset to protect in the listing and the code alike:
**the marks are drawn locally and nothing leaves the page until someone
clicks.** That sentence passes a security review and it is true today.
 
Not yet decided inside this: same Anthropic workspace as CONTEXA (one shared
spend cap) or its own (separate cap, separate revocation). Small stakes at
current scale; decide when the worker exists.
 
---
 
## 6. Housekeeping the split triggered — status
 
- `claude/CONTEXA-lint-spec.md` → `claude/SQUIGGLE-spec.md` — **done.**
- Project instructions (CONTEXA side) — **rewritten 2026-08-26** exactly as
  this section predicted they'd need to be; paste-ready copy in
  `claude/CONTEXA-project-instructions.md`.
- Pattern file — **repo-local as `PATTERN-FILE.md`, tracked, referenced by
  README/background/lint-rewrite, asserted by the suite** (README is now fully
  CONTEXA-free and test.mjs checks it).
- **CONTEXA's store listing** — 0.9.54 published; listing copy and manifest
  description still describe auto-fire. Tracked in CONTEXA build-notes §3.
- **CONTEXA: frozen or finished?** — still unanswered. Different answers
  produce different repos.
---
 
## 7. FIELD TEST PASSED — 2026-08-25, and one defect it found
 
**The click works.** `execCommand('insertText')` is accepted by claude.ai's
ProseMirror. Fallback B is dead. Four clean `rewrite -> applied` across two
tabs, zero rejections. This was the one unknown that could have changed the
product's shape, and it is now closed.
 
**§9 holds in the field.** In a chat with a reply above the composer:
one mark, nothing on `this`. The gate that took the owner-corpus
false-positive rate from 9-in-23 to zero behaves the same way live.
 
**The model generalises, and it beat its own exemplar.** Given
`write me something for the store listing` — an input with a demonstration in
the prompt — it chose `sentence` scope and returned three slots rather than the
exemplar's answer.
 
### The exemplar was wrong, and the model was right
 
The demonstration answered with a length and a voice the draft never named,
breaking the prompt's own hard rule. The model ignored the exemplar and obeyed
the rule. That is luck, not design — Defect A says exemplars beat rules. Fixed
to use slots, pinned by a structural assertion: **an exemplar answer may carry
a digit only if the draft it answers carries one too.**
 
### The defect: clicking a fix made the draft worse
 
`make this better` went 2 marks → 3 after one click — the third sat **inside
the slot we had just inserted**. We were linting our own suggestion. And the
near-invisible half: a draft that went 1 → 0 did so only because the model's
wording happened to hit the SHAPE list. **Sometimes-clears is worse than always
or never**, because the user cannot learn what the product does.
 
### The fix: a slot is the answer, not part of the ask
 
1. **`<…>` regions are masked from rule matching.** A slot must contain a space
   — `<div>` is markup, `<name the file>` is ours. Structural, not a word list.
2. **Slots are kept SEPARATE from the paste mask** — merged, they'd trip the
   prose floor and kill legitimate marks. That interaction is its own
   regression test and one of the four verified mutations.
3. **An open slot holds the SOFT rules.** A draft with an unfilled blank is a
   draft in progress. HARD rules keep firing.
Result: `make this better` goes **2 → 1**. Accepting a fix always lowers the
count and never raises it — an assertion, not an observation.
 
### Verified by mutation, again
 
Four breakages, four named failures, no silence. And the crash reporter reached
all three suites — a lesson learned in one file is not learned.
 
### Post-test additions, committed `2f425a7` (2026-08-26)
 
- **Trim the range, not the text** — a replacement's range sheds boundary
  whitespace so `cleanRewrite`'s normalisation can never weld two words
  (field specimen: `youand`). Applies to every scope.
- **Select the slot after it lands** — typing over is the natural next action,
  not backspacing through. Explicitly recorded as NOT a fix for Ctrl+Z, which
  remains outside our reach from outside the editor.
- Suite: 93 + 82 + 148.
### Still not measured
 
- **Ctrl+Z after a click** — mitigation shipped (slot selection), grouping
  still ProseMirror's.
- **`lint layer attached` fires four-plus times per tab.** SPA churn or
  needless rebuilding — unknown.
- **Whether ProseMirror preserves leading spaces** (§10's open item).