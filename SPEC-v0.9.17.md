# CONTEXA v0.9.17 — Specification

**Status:** finished spec, awaiting build commission. This document contains no
implementation; building it is a separate, explicitly commissioned step.
**Artifacts:** extension 0.9.17 and worker 0.9.17, shipped together. The system
prompt is byte-identical in both copies; the build fails on drift.
**Supersedes:** the 0.9.16 prompt (requisition families as named categories) and
resolves the three defects found in its first field contact: phantom-truncation
chips, taxonomy gravity, and friction-blind ordering.

---

## 1. Design principle

One sentence governs chip generation:

> Write the message this user would send if they knew everything the assistant
> knows about what would improve the next turn — and prove it from the reply's
> own words.

Everything else in this spec is a consequence of three corrections to the
0.9.16 design:

**Evidence-grounded.** The chip-writer is not the assistant that wrote the
reply; it reconstructs that assistant's needs from the outside. Free
reconstruction manufactures phantom needs (observed in the field: a chip
requisitioning "missing" text that was never missing). Therefore no chip
exists without quotable evidence in the reply itself.

**Principle over taxonomy.** Named families become slots that models fill.
The four moves (feed, decree, unleash, flip) are demoted to worked examples
of the principle. A set containing one chip of each family is treated as a
symptom, not a success.

**Friction-aware.** Chips have unequal costs to use: some send in one click,
some require editing an assumption, one requires leaving the page to gather
material. Value ranking without friction ranking predicts clicks wrongly.
Ordering and slot rules below account for it.

---

## 2. Chip generation

### 2.1 Evidence rule

Every step must be earned by a verbatim fragment of the captured reply: the
hedge it collapses, the request it fulfills, the options-language it commits,
the completed claim it flips, or the explicit statement of missing input it
supplies. The model returns this fragment in an `evidence` field per step —
at most 90 characters, copied exactly, never paraphrased.

The `evidence` field is never rendered. Its purpose is mechanical grounding
(a claim that must be quoted is a claim that must exist) and auditability.

Client handling, committed:
- A step with no `evidence` field or an empty one is **dropped** before render.
- A step whose evidence is not a substring of the captured reply **renders**,
  and logs `[CONTEXA] ungrounded chip` with the label at `log` level. Substring
  checking is normalized (whitespace collapsed) to avoid false negatives from
  the capture's line-break handling.
- Rationale for the asymmetry: absence of evidence means the model ignored the
  contract; a near-miss quote usually means whitespace drift. Dropping the
  first is safe; dropping the second would punish good chips for a tokenizer's
  habits.

### 2.2 Move examples (not categories)

The prompt presents four moves as illustrations of the principle, each tied to
the evidence that earns it:

- **Supply what the reply says it lacks.** Evidence: the reply's own request or
  inference-admission ("I'd need to see", "without knowing your", "assuming
  your setup is"). The step names the artifact, pins scope and format, and
  marks the insertion point with `<paste here>`. Written to deliver value even
  if the user pastes manually instead of clicking — the chip's text doubles as
  a checklist of exactly what to provide.
- **Collapse a fork the reply planted.** Evidence: conditional language ("if
  you're on", "depending on whether", "either… or"). The step decrees the most
  plausible branch — "Assume X. Redo under exactly that." — and the user edits
  the assumption before sending if it is wrong. At most two decrees per set.
- **Grant commitment.** Evidence: options-language or hedged
  survey structure ("you could", "alternatively", "some approaches"). The step
  grants what the assistant lacked: permission to pick and produce the complete
  version — no alternatives section, no abbreviations.
- **Redirect the angle.** Evidence: a completed claim, plan, or design standing
  in the reply. The step rebuilds under the opposite assumption, argues against
  the design and keeps what survives, or optimizes for a different constraint.
  Aimed at the work, never at quizzing the user. **At most one per set**, and
  only when the reply contains finished work to redirect — this is the move
  most prone to overproduction because everything can be flipped.

The prompt states explicitly: these are examples of winning moves, not slots to
fill; a set is chosen by what the reply's evidence supports, and a set where
every example type appears once is almost certainly padded.

### 2.3 Count

One to five steps, decided by the evidence found. Committed expectations,
stated in the prompt: the most common correct set size is one or two; a reply
blocked on a single missing input deserves exactly one dominant step; padding
to reach any count is a defect. Returning one step is a correct answer.

### 2.4 Ordering — the friction rule

Three friction classes, defined by what the user must do before sending:
- **zero-touch:** send as-is (commitment grants, redirects, direct
  continuations)
- **one-touch:** verify or edit one assumption (decrees)
- **heavy:** leave the conversation to gather and paste material (supply
  steps)

Committed ordering rule:
1. If the reply is **visibly starved** — it explicitly requests input or states
   it is reasoning without something — the supply step takes slot 1 regardless
   of friction, because nothing else meaningfully advances the work.
2. Otherwise slot 1 goes to the highest-leverage **zero-touch or one-touch**
   step: the move that most advances the work and can be sent within seconds.
3. At most one heavy step per set; when not in slot 1 it goes **last**.
4. Remaining steps order by leverage.

The ordering rule assumes the observed behavior that most users read slot 1
and click it or nothing. The single-dominant-chip UI (one emphasized chip,
alternates collapsed) is a **non-goal for 0.9.17**; it becomes a design task
if field data shows ≥90% of clicks landing on slot 1.

### 2.5 Payload and label contract

Unchanged invariants, restated as binding:
- `text` ≤ 280 characters, ready to send verbatim. Shape: name the thing, then
  pin scope and format. Short lines, `\n` between lines when structure helps,
  inline lists permitted, no preamble, no meta commentary.
- No questions anywhere. No step contains a question mark.
- Step texts are prose. Code is referred to by name and location — a function,
  a file, a line — and when a step's outcome is new or changed code, the text
  directs Claude to write it rather than containing it. No code lines or
  snippets in any payload.
- Decrees begin with "Assume". Supply steps contain `<paste here>`.
- Never re-request anything the reply already delivered. One move per step; no
  two steps are the same move rephrased.
- `label` ≤ 4 words, verb-first, plain, no punctuation, all labels distinct at
  a glance. Client clamp (`shortLabel`) matches at 4.

### 2.6 Output schema

```
{"steps":[{"label":"...","text":"...","evidence":"..."}]}
```

One to five items, minified JSON only. Handling of the new field:
- **Worker (hosted path):** the existing response mapping already strips
  unknown keys; it is extended to log each step's evidence (first 90 chars) at
  `console.log` level for `wrangler tail`, then strip it. Clients receive
  `{label, text}` exactly as today — no client compatibility risk.
- **Extension (own-key path):** `background.js` performs the evidence
  validation of §2.1 (drop empty / log ungrounded), logs evidence at `log`
  level, strips the field, then caches and responds with `{label, text}`.
- `content.js` continues to read only `label` and `text`; unknown keys are
  ignored by construction.

---

## 3. Capture: the viewport marker

### 3.1 Defect being fixed

The capture window is 6,000 characters. The suggestion model cannot
distinguish this clamp from a truncated reply, and under the requisition
principle its correct response to perceived truncation is to requisition the
missing text — producing confident chips about a defect that does not exist.
Observed in the field on the first long reply the design met.

### 3.2 Committed mechanics

Constants:
```
CAPTURE_WINDOW  = 6000        (unchanged; matches worker MAX_REPLY_CHARS)
CAPTURE_MARKER  = "\n[capture window ends here — the reply continues beyond this point]"
CONTENT_BUDGET  = CAPTURE_WINDOW − CAPTURE_MARKER.length
```

Rules:
1. If the captured text fits within `CAPTURE_WINDOW`, it is sent untouched and
   the marker never appears. The marker's presence is therefore a reliable
   signal of clamping.
2. Otherwise the text is trimmed to `CONTENT_BUDGET` at a clean boundary — the
   last newline within budget if one falls in the final 20% of it, else the
   last space — and the marker is appended.
3. The trim-then-append order is load-bearing: the worker independently slices
   the reply at 6,000 characters, so a marker appended on top of a 6,000-char
   payload would be eaten by the server's clamp and the model would see a bare
   cut again. Client output including the marker never exceeds 6,000
   characters, so the marker survives the server slice byte-for-byte. This is
   a joint between two layers and gets a test that exercises both together.
4. Head-only capture is retained. Keeping head-plus-tail was considered and is
   **rejected for 0.9.17**: it reorders the document the model reads and
   introduces a second synthetic boundary, and the observed failure is fully
   explained by marker absence. Tail-keeping becomes a candidate only if field
   evidence shows chips systematically missing conclusions of long replies.

### 3.3 Prompt-side rule

The prompt states: the capture may end with the marker line; that line is the
edge of the viewport, not a defect in the reply. The model never mentions it,
never describes the reply as cut off, and never requisitions the continuation.
Evidence quotes must come from before the marker.

---

## 4. Logging levels

Defect being fixed: Chrome's extension page collects `console.warn` and
`console.error` from extension contexts and surfaces them under an "Errors"
badge — which resurfaced, in alarming dress, the partial-salvage signal that
was deliberately moved out of the user's face in 0.9.14. Friends on unpacked
installs would see the same badge.

Committed levels:
- `[CONTEXA] partial salvage …` — **`console.log`** (was `warn`). Remains fully
  visible to the page console and the remote debugging loop; disappears from
  the Errors badge.
- `[CONTEXA] ungrounded chip …` and evidence logs — **`console.log`**.
- `renderQuiet` failure diagnostics (truncated, bad_json, quota, etc.) —
  **remain `console.warn`**. True failures deserve a visible trace, badge
  included.

---

## 5. The system prompt, verbatim

The following is the complete `NEXT_STEPS_SYSTEM` for 0.9.17, deployed
byte-identically in `worker/src/index.js` and `extension/background.js`:

```
You are CONTEXA, embedded in claude.ai. You see the user's last message and Claude's reply. Your job: write the messages this user would send next if they knew everything the assistant knows about what would improve the next turn — and prove each one from the reply's own words.
The capture of the reply may end with the line "[capture window ends here — the reply continues beyond this point]". That line is the edge of your viewport, not a defect in the reply. Never mention it, never describe the reply as cut off, and never ask for the continuation. Evidence must come from before it.
Return BETWEEN ONE AND FIVE steps. The evidence you actually find decides the count. The most common correct count is one or two. A reply blocked on one missing input deserves ONE dominant step. Padding to reach any count is a defect; returning a single step is a correct answer.
EVERY step must be earned by a verbatim fragment of the reply — the hedge it collapses, the request it fulfills, the options-language it commits, the completed claim it redirects. Put that fragment in the step's "evidence" field: at most 90 characters, copied exactly, never paraphrased. No quotable evidence, no step.
Moves that usually win — examples of the principle, NOT categories to fill; a set with one of each is almost certainly padded:
- Supply what the reply says it lacks. Evidence: its own request or inference-admission ("I'd need to see", "without knowing your", "assuming your setup"). Name the artifact, pin scope and format, mark the insertion point with <paste here>. Model: "The current prompts — system prompt, any instruction files, tool/function definitions. The actual text, not a summary. <paste here>". Write it so it works even unclicked, as a checklist of what to provide.
- Collapse a fork the reply planted. Evidence: its conditional language ("if you're on", "depending on whether", "either"). Start with "Assume", state the most plausible branch concretely, then direct the redo under exactly that. The user edits the assumption before sending if it is wrong. At most two per set.
- Grant commitment. Evidence: options-language or a hedged survey. Direct the assistant to pick the option it would choose itself and produce the complete version — no alternatives section, no abbreviations, nothing left as an option.
- Redirect the angle. Evidence: a finished claim, plan, or design standing in the reply. Rebuild under the opposite assumption, argue against it and keep only what survives, or optimize for a different constraint. Aim at the WORK, never at quizzing the user. At most one per set, and only when the reply contains finished work.
Ordering, by friction and leverage:
- If the reply explicitly requests input or states it is reasoning without something, the supply step goes FIRST.
- Otherwise slot one goes to the highest-leverage step the user can send within seconds, unedited or after touching one assumption.
- At most one step per set may require the user to gather and paste material; when it is not first, it goes last.
- Remaining steps order by how much they advance the work. Most users read only the first step.
Hard rules:
- Every step is a directive or a specification. NEVER a question — no step may contain a question mark.
- Ground every step in THIS reply's actual content. Never re-request anything the reply already delivered. One move per step; no two steps are the same move rephrased.
Each step has THREE parts:
- "label": AT MOST 4 WORDS, verb-first, plain language, no punctuation. All labels obviously different at a glance.
- "text": the full prompt loaded into the composer, ready to send verbatim, up to 280 characters. Name the thing, then pin scope and format. Short lines, with \n between lines inside the JSON string when structure helps; inline lists are fine; no preamble, no meta commentary. Step texts are prose. Refer to code by its name and location — a function, a file, a line — and when a step's outcome is new or changed code, the text directs Claude to write it rather than containing it. A step text never includes code lines or snippets.
- "evidence": the verbatim reply fragment that earned this step, at most 90 characters.
Reply with ONLY minified JSON: {"steps":[{"label":"...","text":"...","evidence":"..."}]} with one to five items.
```

---

## 6. Tests

Additions to the existing suites; all current tests continue to pass.

**Prompt shape (source assertions, `extension/test.mjs`):** the deployed prompt
contains "evidence" in the schema line, the anti-taxonomy sentence ("NOT
categories to fill"), the viewport-marker rule ("edge of your viewport"), the
no-questions rule, "Step texts are prose.", and "BETWEEN ONE AND FIVE".

**Capture marker (fake-DOM tests, `extension/test.mjs`):**
- text under the window ⇒ no marker present;
- text over the window ⇒ output length ≤ 6,000 **including** the marker, marker
  is the final line, cut falls at a clean boundary;
- the joint test: client output passed through a 6,000-char server-style slice
  is byte-identical — the marker survives.

**Evidence handling (harness tests, `extension/test.mjs`):**
- a step with valid evidence passes through with `evidence` stripped from what
  reaches `content.js`;
- a step with no evidence is dropped;
- a step with non-substring evidence renders and logs `ungrounded chip`;
- logging uses `console.log`, not `warn`.

**Worker (`worker/test.mjs`):** response steps carry no `evidence` key; the
partial-salvage and evidence logs appear at `log` level; all existing quota,
clamp, origin, and diag tests unchanged.

**Logging levels (source assertions):** partial-salvage logger is
`console.log`; `renderQuiet` failure path retains `console.warn`.

---

## 7. Field acceptance

Run after deploy + reload, by Claude, via the established browser loop
(shadow-root probes, page-console reads), over ten fresh replies across at
least three conversations, at least two of them with replies exceeding the
capture window:

1. 10/10 parse into rendered chips or an honest degraded state; zero bare
   error cards.
2. Zero question marks across all payloads; all labels ≤ 4 words.
3. Counts vary across the ten sets; at least one set has fewer than three
   chips. A constant count across all ten is a failure of the need-logic.
4. On the >6,000-character replies: zero chips that mention truncation,
   cutting off, or continuation of the reply — the phantom-truncation
   regression check.
5. ≥ 80% of steps carry evidence that passes the normalized substring check
   (read from the page console).
6. Partial-salvage rate recorded from console logs; no target this release,
   baseline only.

Click-through remains the product metric, measured over the following week of
normal use against the validation protocol's gate (≥ 8 clicked of 25 replies),
with the protocol's compliance gates updated to this spec's numbers.

---

## 8. Non-goals for 0.9.17

Committed exclusions, each with its trigger for reconsideration:
- **Single-dominant-chip UI** — deferred; triggered if ≥90% of observed clicks
  land on slot 1.
- **Head-plus-tail capture** — rejected; triggered by field evidence of
  conclusion-blindness on long replies.
- **Cowork scope gating** (visibility / URL filter) — separate decision,
  unchanged by this release.
- **Model adaptation** — separate feature, next in queue after this ships and
  the spend cap is set.
- **Quota, pricing, model tier, UI layout, icons** — untouched.

## 9. Invariants that survive every redesign

Never auto-send a chip. Never fake a degraded state. Prompt byte-identical in
both artifacts, enforced by the build. No credentials through chat. The two
artifacts version independently but ship together when the prompt changes.
Every failure path names its cause where it can be read.
