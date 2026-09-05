# Brand-optimization prompt

**Written 2026-09-01.** Paste the block below into a fresh Claude Code session
opened on this repo. It is a prompt, not a plan: the session it starts is
expected to produce a memo for review, not edits.

Why it lives here: `publishing/` is where the public-facing copy lives, and
this prompt exists to sharpen that copy. It sits beside `STORE-LISTING.md`
because that file is what it is most likely to propose changes to.

Why it exists at all: on 2026-09-01 a promoter cold-emailed offering "listing
optimization" bundled with "install velocity" and "review growth". The first is
legitimate and cheap to do ourselves; the other two are install/review
manipulation, which the Chrome Web Store removes extensions for. This prompt is
the do-it-ourselves version of the legitimate part, with the other two ruled
out in writing so a future session cannot be talked back into them.

---

```
You are acting as a brand strategist for an indie developer tool — not a
generic marketer. CONTEXA has a specific, opinionated voice already
established across its own docs: terse, principled, no padding, no fake
positivity. "Zero is a valid outcome." "Never fake output." Your job is to
sharpen that voice for discoverability and positioning, not replace it with
generic SaaS-speak. If a sentence you write could sit unchanged on the listing
of any "AI writing assistant" extension, it is wrong for this one.

READ FIRST, IN THIS ORDER:
1. CLAUDE.md (repo root) — architecture and design principles. It is
   auto-loaded, but re-read the "Design principles" section deliberately,
   for voice.
2. README.md — the "Design notes" section is the voice bible.
3. publishing/STORE-LISTING.md — the current public copy: name, short
   description, detailed description, category. This file IS the listing.
4. SUBMISSION.md (repo root) — § "The name, and the one policy call worth
   remembering" for what is safe to say about "Claude" in branding; the
   single-purpose and permission text for how plainly this product speaks
   to a reviewer.
5. publishing/PRIVACY.md — the privacy claims and their tone. Brand copy
   must not contradict this in fact or in register.
6. scripts/screenshots/capture.mjs — the canned session and the MOVES
   constant at the top. This is the example conversation the store
   screenshots show. It is brand material and it is editable.
7. CHANGELOG.md, recent entries only — for what actually shipped, so every
   positioning claim describes the product as it is.

HARD CONSTRAINTS — DO NOT PROPOSE CHANGES TO THESE WITHOUT FLAGGING THEM AS
A SEPARATE DECISION, IN THEIR OWN SECTION OF THE MEMO:
- The name ("CONTEXA for Claude - Every token earned") is 39 of the
  45-character Chrome Web Store limit and byte-identical to `name` in
  extension/manifest.json. The second half is the product motto. Changing it is a version bump and a rebuild — a
  product change, not a copy edit.
- The short description is at 125/132 characters and byte-identical to
  `description` in extension/manifest.json. Same constraint.
- "Claude" stays in the name and in the description. It was removed once on
  a speculative trademark worry and put back because it is the single most
  obvious search term; PUBLISHING-CHECKLIST.md says "do not fix this back".
  Brand independence is not a reason to strip it.
- Never imply Anthropic endorsement, partnership, review, or first-party
  status. No Anthropic wordmark or logo on any asset. The non-affiliation
  line at the end of the detailed description is mandatory and must never
  be softened.
- Any number quoted publicly (replies per day, message caps, character
  limits) is read from the code at the moment of writing — DEVICE_DAILY_LIMIT
  and the clamp constants in worker/src/index.js — never retyped from another
  document. The listing once said 10 while the code enforced 20.
- Never propose install-velocity, review-solicitation, or review-growth
  tactics of any kind. Manipulating install counts or reviews violates
  Chrome Web Store policy and has already been ruled out for this product.
  Discoverability work here means copy, category, and screenshots. Nothing
  else.

OPEN FOR YOUR WORK:
- The detailed description: structure, section order, headings, language.
- Category and secondary category.
- How the product's own design principles — clicking is the only input,
  moves are independent, nothing is shown when nothing is earned, nothing is
  sent until the user sends it — become positioning that separates CONTEXA
  from the "AI writing assistant" category rather than joining it.
- The example conversation in the screenshots: what session the frames
  should show, what the four moves should be, what the frames should let a
  visitor understand in two seconds. Propose the content; the harness in
  scripts/screenshots/ regenerates the images.
- The order of the five screenshots. The first is what most visitors judge
  the listing by.

DELIVERABLE — a brand and positioning memo, presented in chat for review.
Do not edit any file until the memo is approved. It must contain:
1. AUDIENCE — one paragraph. Who this is for, and who it is not for. Be
   specific enough that a wrong reader could recognise themselves.
2. WHAT WE ARE NOT — a short list. The product is defined by what it
   refuses to do; the brand should be too.
3. ONE SENTENCE, ONE PARAGRAPH, ONE PAGE — CONTEXA described at three
   lengths, in its own voice, each usable as-is.
4. PROPOSED EDITS to publishing/STORE-LISTING.md's detailed description,
   shown as before/after, each with one line on why.
5. SCREENSHOT CONTENT — the proposed session and moves for the frames.
6. FLAGGED SEPARATELY — anything that touches the name, the short
   description, or the manifest, if you believe it is worth the cost.

When the memo is approved: apply the STORE-LISTING.md edits on a branch,
update the "Written for" line at the top of that file, and leave the
manifest untouched. If screenshot content changes, update the MOVES constant
and the mock session in scripts/screenshots/, update the "Captured from" line
in publishing/screenshots/README.md, and re-run the harness rather than
editing PNGs by hand.
```
