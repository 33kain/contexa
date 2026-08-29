# CONTEXA — interview voice spec: Register C ("the mirror")

Decided 2026-08-27 in the design chat, by the owner, from three registers rendered
on the same interview (`contexa-voice-registers.html`). This document is the
handover to the build chat. **The design chat does not edit prompts**; whoever
edits `QUESTIONS_SYSTEM` reads the pattern file first, then this.

Suggested repo home: `claude/CONTEXA-voice-spec.md`.

---

## §0 — The decision and why

Interview questions and option labels speak in **the user's inner monologue** —
first person, as if reading her own head while the whisperer tidies it.

Why C won: the trigger already speaks it. **"What now? ✦" is a thought, not an
offer.** Register C makes the whole system one voice — mascot whisper, trigger,
questions, labels, composed prompt (which was always first-person). B ("warm
ally") was rejected as double sugar: the mascot already carries the warmth, text
that also coos delivers less of both. A ("plain-direct") was the runner-up and
is the fallback if C's known risk (see §1) shows up in the field.

**Scope: questions and labels only.** The composed prompt's voice is a function,
not a style — it speaks as the user because it *is* her draft — and is not
touched by this spec. `EXPAND_SYSTEM` is out of scope entirely.

---

## §1 — The register, defined by a test

> **A line passes Register C if it would be at home in the user's own head.**

Rules that fall out of the test:

- **"I" is always the user.** Never the tool, never Claude. If a reader could
  parse the "I" as the assistant, the line fails even if it sounds natural.
- **Pronoun-free lines are still C.** Inner monologue is not "every sentence
  contains I" — *"When did the problem start?"* is a thought. Do not force a
  pronoun into a question that doesn't need one.
- **Prefer want/need anchors over task verbs** where a pronoun appears.
  *"What do I want back?"* anchors the I as the wanter — unambiguous.
  *"What should I write?"* lets the I drift toward the tool — see §2, pair 2.
- **No service voice.** "Would you like me to…" is an offer from a waiter, not
  a thought in her head. It is also banned independently of register (§3).
- **Labels are fragments of her eventual message.** 2–4 words, each carrying
  payload (form law from the interview-form spec: pill labels, label ≠
  composed). In Register C this is not just style — a label like
  *"Write it for me"* reads natively both as the answer to *"What do I want
  back?"* and as material the composer folds into her draft. The register and
  the mechanism point the same way.

Known risk, stated at decision time: first person in a question can momentarily
confuse ("who is I?"). The mitigation is the want/need-anchor rule above. If
field use shows the confusion anyway, the fallback is Register A — that is a
*register* change, not a form change, and costs one prompt edit.

---

## §2 — Worked exemplars (this section is the mechanism)

Pattern file, Defect A: **rules lose to exemplars — voice ships as demonstrated
questions, not as adjectives.** Whoever edits the prompt lifts from here.
Domains are deliberately beginner-shaped (audience law: beginners and
intermediates, not senior developers).

**Pair 1 — decision question**

- GOOD · Q: `What do I want back?`
  pills: `Write it for me` · `Explain it to me` · `Help me decide`
- BAD · Q: `Would you like me to write it?` — service voice; an offer, not a
  thought. (Also banned by §3 regardless of register.)

**Pair 2 — the I-drift trap**

- GOOD · Q: `What do I want this to say?`
- BAD · Q: `What should I write?` — the I can be read as the tool asking about
  its own job. Want-anchor removes the ambiguity.

**Pair 3 — tone**

- GOOD · Q: `How do I want to sound?`
  pills: `Friendly` · `Firm` · `Formal`
- BAD · Q: `Select preferred tone:` — form-speak; at home in no one's head.

**Pair 4 — fact question, pronoun-free**

- GOOD · Q: `When did the problem start?`
  pills: `Today` · `This week` · `Longer ago`
- BAD · Q: `Please specify when the issue began.` — "please specify" is a form
  talking; and it swaps her head for a clerk's.

**Pair 5 — fact question, with pronoun**

- GOOD · Q: `Which phone do I have?`
  pills: `iPhone` · `Android` · `Not sure`
- BAD · Q: `What is your device model?` — "your" breaks the mirror; second
  person belongs to no one in this register.

**Pair 6 — deliverable shape, jargon-free**

- GOOD · Q: `What should this end up as?`
  pills: `An email` · `A list` · `A table`
- BAD · Q: `What output format do I need?` — "output format" is our word, not
  hers. Jargon fails the audience before it fails the register.

**Pair 7 — length**

- GOOD · Q: `How long should it be?`
  pills: `One line` · `Short` · `Detailed`

**Label discipline (applies across all pairs)**

- GOOD labels carry payload she could stand behind: `Firm but polite`,
  `Just the steps`, `By tomorrow`.
- BAD: `Option A` (no payload) · `Proceed` (a command into the void) ·
  `No, different wording` (names no alternative — composes an empty demand;
  real captured specimen, Class 6b).

---

## §3 — Banned in every register (pattern-file law, not taste)

The voice must not make these shapes *more natural*. They are defect classes,
already captured in the field:

1. **Confirmation yes/no on the reply's own proposal** — *"Use that label?
   Yes / No."* A floor through a side door (Class 6b): generable off any reply,
   forever, guaranteeing a non-empty row. No register phrasing makes it legal.
2. **Payload-free options** — an option that changes nothing in the composed
   prompt, or changes something but names nothing (Class 6b, specimen B).
3. **Jargon** — schema, output format, parameters, prompt. Her words or no words.
4. **Service voice** — "Would you like me to…". The label is part of *her*
   message; it is never an offer of ours.

And one that this spec must not erode by omission: **zero stays a product
outcome.** Nothing in the voice work adds a floor, a fallback question, or a
minimum count. A reply that settles everything still earns silence, a compose,
or moves — the register changes how questions sound, never whether they exist.

---

## §4 — Placement constraints for the prompt edit (Defects B, E, F)

- **Artifact: `QUESTIONS_SYSTEM` only.** Question voice lives where questions
  are made (Defect E: an instruction must sit in the artifact that can honour
  it). `EXPAND_SYSTEM` is untouched — the composed prompt already speaks as the
  user, and its tail (**the filled JSON answer, last**) must not move.
- **Re-voice the existing worked exemplars in place** rather than appending new
  blocks. Position is behaviour (Defect B): the smallest diff that changes the
  demonstrations' wording is the right shape of change.
- **The zero-count disclaimer stays final** in `QUESTIONS_SYSTEM` — *"fixes the
  SHAPE, never the count"* — and `assume` examples stay **above** that line.
  Position assertions guard both tails; if one fires, read it (Defect C: it may
  be right), don't loosen it.
- **Exemplar-count tests exist.** `assume` demonstrations are pinned to
  ≥1 and ≤⅓ of exemplar lines. Re-voicing must not change how many exemplar
  lines carry `assume`.
- **Defect F warning, written down because one-voice invites it:** the trigger
  (`✦ What do I say next?`) and the fifth chip (`✎ Type & create magic`) must
  stay *distinguishable* — star asks, pencil types, and an assertion compares
  the two labels. One-voice pressure to harmonize all copy stops at that pair;
  their difference is load-bearing. Do not restyle either label as part of the
  voice edit.

---

## §5 — Ship discipline

- A prompt-only change reaches **every hosted user through one wrangler
  deploy**, no store review. Treat the voice edit with deploy-grade care.
- **Field test before deploy, own-key first.** A green suite proves the prompt
  says the right things, never that the model speaks them (source assertions
  cannot hear a voice). Protocol:
  - unpacked build + saved key; read the version off the **mount line**;
    confirm **one** build logging; discriminate chats on mount `top=` geometry.
  - Three scenarios, read the actual cards and composed prompts:
    (a) a decision-shaped beginner reply → expect C-voiced decision question;
    (b) a fact-gathering reply → expect C-voiced fact questions, pronoun rules
    holding;
    (c) a reply that settles everything → **expect silence/compose/moves as
    before** — the voice edit must not disturb zero.
- Any defect the voice produces gets captured into the pattern file with the
  specimen, per house habit. Watch specifically for I-drift (a question whose
  "I" reads as the tool) — that is this register's native failure mode, named
  at decision time.
