# CONTEXA — on-demand: honest review, website plan, chip options
 
**HISTORICAL, 2026-09-01.** Written pre-pivot; "chip options" refers to the
interview/moves-chip mechanism retired by the 0.9.58 history-mining pivot. Any
proposal below built on that mechanism no longer applies. For current state
read `NEXT-SUBMISSION.md` and `STORELISTING.md`.
 
*Written 2026-08-24, unattended, after the 0.9.53 doc sweep. Everything below is
opinion and proposal — **nothing here has been built.** Decisions are Mili's.*
 
---
 
# PART ONE — What the on-demand change actually bought
 
## The headline is not the one we set out to get
 
The stated goal was cost. What it actually fixed is bigger.
 
**The free tier was broken by design and nobody had noticed.** `bumpQuota` sits
in the shared gate before the endpoint split, so writing the questions charges
the pool exactly like composing does. Every completed reply spent one of twenty —
**whether or not anyone looked at it.** A twenty-turn conversation exhausted the
day with zero user intent. *"Fair use is 10 prompts a day"* was only ever true
for someone who used every single card CONTEXA drew.
 
Now twenty calls means twenty *asks*, which means ten real prompts. **The number
on the options page went from optimistic to honest**, and it did so without
changing the number.
 
## The five real gains
 
**1. The free tier works.** Above. This is the one that changes whether a hosted
tier is viable at all.
 
**2. Privacy stopped being a hedge and became a claim.** Before: every reply's
text left the page, unconditionally. The policy line — *"sends only your latest
message and the reply"* — was true and still described unconditional
transmission. Now **a reply you never ask about never leaves the page.** That is
categorical, not incremental, and almost no extension in this category can say
it. It is the strongest sentence available for the store listing and the website,
and it arrived as a side effect.
 
**3. Spend tracks engagement instead of traffic.** Any future pricing —
own-key or hosted — now has a cost curve that follows value. It also makes
own-key mode meaningfully cheaper for the user, which matters because own-key is
the stated direction.
 
**4. Silence became legible.** A quiet row used to be indistinguishable from
"CONTEXA is off" or "CONTEXA is broken" — it was invisible either way. Now you
click, it looks, and it hands you a box. **You can tell the difference between
nothing-to-say and nothing-happening**, which is the theme this project has paid
for six times.
 
**5. The product's health became measurable.** Click-rate on the trigger is now a
direct read on whether anyone wants this. Before, the card just appeared and
there was no moment of intent to count. Watch criterion O exists for exactly this.
 
## The one real cost, stated plainly
 
**The offer stopped being specific, and specificity was the product.**
 
The audience is people who do not know what to ask next. Seeing *"If two .js
files share the same name in different subfolders, what should happen?"* teaches
a beginner that a decision exists — it does the work before they have clicked
anything. A button reading *"What do I say next?"* teaches them nothing about
**this** reply. It asks them to already know they need help, which is precisely
the knowledge they lack.
 
Two smaller costs that follow from it:
 
- **Every successful use now costs one extra click and 2–4 seconds.**
- **Discovery became a one-time gamble.** If a new user does not click in their
  first few conversations, they never learn what the product does, and they
  uninstall. Before, the value demonstrated itself unbidden.
## The verdict
 
**Ship it, and be honest that it traded a product problem for a business
problem.**
 
The business problem was real and unfixable any other way: an unsustainable free
tier and unconditional data transmission. The product problem — *does anyone
click?* — is now **measurable and reversible in one `content.js` change.**
 
**And the two are not symmetric.** Going back to auto-fire is a revert. Fixing
the free tier while auto-firing was impossible. **So even if activation suffers,
this was the right order to do things in** — which is the strongest argument for
the change and it is not the argument that was used to make it.
 
**The honest limit: it is unproven on anyone who is not Mili.** Every observation
so far is the founder, on her own key, on a build she wrote. Nobody who does not
already know what CONTEXA does has clicked that button.
 
## One idea that might recover the specificity — needs a §2a ruling
 
**First-run auto-fire.** The very first reply after install fires automatically,
once, so the user sees the card do its thing. On-demand forever after.
 
- Cost: **one call per install**, ever.
- It recovers the demonstration that on-demand gives up, at the exact moment it
  matters most.
- **Is it a floor?** §2a bans a floor, a fallback chip, or a minimum count.
  This guarantees none of those — the first-run call can still earn zero and
  render a quiet row. It changes *when* one call happens, once.
- **But it is adjacent enough that it needs Mili's ruling, not mine.** The
  pattern file's whole history is things that became floors by accident.
---
 
# PART TWO — Website plan
 
Current state: built by Fable 5, *Ink & Highlighter* (`#FFFDF4` / `#141414` /
`#FFD84D`), verified against every hard rule, **not deployed**, target is
Cloudflare Pages. The file is not in `C:\Users\Q\contexa` — **first job is
finding out where it lives.**
 
## The structural problem, and why it is actually good news
 
The site's demo opens on the card. **Under 0.9.53 the first thing that exists is
a button**, so as built the site advertises a product that no longer ships.
`CONTEXA-card-spec.md` has been updated with a step 0 describing this.
 
But here is the part worth sitting with:
 
> **A landing page's hardest problem is getting the visitor to interact.
> On-demand hands you the solution for free: the product's own first gesture IS
> a call to action.**
 
With auto-fire the demo played *at* the visitor — passive, scrollable-past. With
on-demand, the visitor clicks `✦ What do I say next?` and the card appears
**because they asked**. They perform the product's core gesture within three
seconds of arriving, and it works. That is the best thing you can put above the
fold, and the old structure could not have produced it.
 
## Proposed structure
 
**1 — Hero: the click.** A Claude-shaped reply already on screen, the trigger
chip below it with a gentle pulse, and one line of copy: *"Click it."* No
autoplay, no video, no scroll-triggered animation. The chip is the hero.
 
**2 — What just happened.** Reveals only *after* they click. Three short panels
for the three outcomes: questions earned → the card; something settled → the
one-click compose with its `Assume:` line; nothing earned → the box opens.
Progressive disclosure that mirrors the product's own shape.
 
**3 — "Nothing leaves the page until you click."** Its own section, and I would
give it the yellow. This is the strongest claim on the site and it is newly true.
Visual: the same reply, no click, and an explicit *nothing sent* state.
 
**4 — Who it is for.** Say it plainly: people who use Claude every day and are
not developers. This also filters out the wrong installs, which protects the
review average.
 
**5 — What it never does.** Never sends for you. Never scores your writing.
Never overlays the composer. **Says nothing when there is nothing to say.** That
last one is unusual enough to be memorable and it is a real differentiator.
 
**6 — Install.** One button to the store, plus the Android note (Edge / Lemur /
Mises / Quetta work; Chrome for Android never has; sign in with email, not
Google).
 
## Non-negotiables
 
- **Kill every chip-era screenshot.** `publishing/screenshots/` shows a product
  that has not existed since 0.9.33.
- **`Prompt like a PRO`** → *CONTEXA — Claude prompts, without the writing*
  (title, mocked store card, footer).
- Footer keeps *"Create magic in Claude."* — **delete the second sentence.**
- Copy the mock card's CSS **from `content.js`'s `CSS` const** so it is
  pixel-identical, per the card spec.
- **The mock must not fake latency dishonestly.** Keep the `✦ reading…` beat as
  a real beat; the card spec already calls this "honest latency" and it is right.
- Single self-contained HTML file. Cloudflare Pages, not the Worker.
---
 
# PART THREE — Chip options
 
`✦ What do I say next?` was chosen at 4am and deserves a second look. **The
trigger's label is now the single highest-leverage string in the product** —
activation is the whole game, and it is the only text a new user sees before
deciding whether this thing does anything.
 
## The critique of the current label
 
**A question on a button is ambiguous.** At the moment the user most needs
clarity, the control asks *them* something — is clicking it answering the
question, or asking it? It reads beautifully in prose and less well as an
affordance.
 
## The options, ranked for activation
 
**1. `✦ Help me reply`** — plainest possible. Zero vocabulary to learn,
unmistakable to someone who has never seen the product, and it names the thing
the user actually wants. **This is what I would bet on** now that activation is
the metric that matters. Costs the brand voice.
 
**2. `✦ Ask me a few questions`** — the most *honest* about the mechanic and the
most distinctive on a busy page. A beginner reads it and knows exactly what
happens next, which is the objection to every other option. Risk: it sounds like
work rather than help.
 
**3. `✦ What do I say next?`** (current) — best voice match, genuinely the
sentence in a beginner's head. Held back by the button-as-question ambiguity.
 
**4. `✦ Create magic`** — shortest, keeps the vocabulary, tightest row. Says
nothing about what happens, which is fine once learned and bad for a first-time
user. Good *second* label — see below.
 
**Dismissed:** `✦` alone (maximum mystery, worst possible activation);
`Prompt me` (too clever for the audience); anything reusing *"Write my next
message"* (already the standalone assume chip's label — Defect F).
 
## The structural idea, which beats any single label
 
**Teach first, then get out of the way.**
 
- **First few uses:** `✦ Help me reply` — explicit, instructional.
- **After they have used it (say, three times):** `✦ Create magic` — short, keeps
  the voice, stops repeating a lesson they have learned.
One control, two labels, chosen by familiarity. Costs one counter in
`chrome.storage`. **Not a floor** — it changes what a button says, never whether
a row is empty.
 
Two objections to weigh:
 
- The product currently keeps hidden state **in memory, never persisted**, on
  purpose. This would be the first persisted preference. That is a real
  precedent, though `storage` is already in the manifest.
- **A control that changes its name is a control the user has to re-learn.**
  Mitigated by both labels sharing the `✦`, which is the actual identifier.
## What would settle it properly
 
The click-rate on the trigger (criterion O) is measurable per label. **This is
the first thing in CONTEXA's history that could be A/B tested honestly** — same
product, one string different, one number to read. Not worth building
infrastructure for at this scale, but worth knowing that the option exists once
the store is caught up and there is real traffic.
 
---
 
# What was swept, and what was deliberately left
 
**Updated for on-demand:**
 
- `README.md` — rewritten. It described the **chip era**, not just pre-0.9.53:
  "up to five chips," a flow diagram ending in `five {label, text} pairs`, and a
  cost section quoting Haiku. Now describes the trigger, the interview, the three
  outcomes, the eager-capture/lazy-call split, and the corrected quota maths.
- `SETUP-FOR-FRIENDS.md` — rewritten. It told a friend to expect "five suggestion
  chips," which would have read as broken. Now walks the click, and gained the
  Android section that was owed to the friend message.
- `CONTEXA-card-spec.md` — step 0 added (the trigger, and that the mock **must**
  reproduce it), and the retired `✎ Rough ask…` label corrected with the
  star-asks-pencil-types rule.
**Left alone, deliberately:**
 
- `SUBMISSION.md` — **store submission copy**, which Mili excluded. It is badly
  stale (chips throughout) and needs rewriting before the next submission.
- `manifest.json` description — **store-facing and pinned by tests.** Reads
  *"Claude replies. CONTEXA asks a few short questions you answer by clicking…"*;
  there is a click in between now. Not false, but incomplete.
- `LISTING.md` — already self-marked as *"NOT the listing… described the chip-era
  product."* A tombstone. Leave or delete.
- `next-release-train.md`, `SPEC-*.md`, `prompt-ab-results.md` — historical
  records that quote the README as it was. **Editing history to match the present
  is how a project loses its evidence.**
## ⚠ The one thing only Mili can fix
 
**The CONTEXA project instructions are now wrong**, in the line their own notes
call the highest-value one:
 
> *"How it works now: after Claude replies, CONTEXA asks one to four short
> questions with the answers already written, one at a time."*
 
Since 0.9.53 it asks **nothing** until the trigger is clicked. Instructions load
into every session; documents only load when read. **A fresh session will assume
auto-fire and be wrong about the product's shape** — exactly the failure that
line was written to prevent, now caused by it. Suggested replacement:
 
> How it works now: after Claude replies, CONTEXA shows one chip and does
> nothing else — no model call, nothing sent. Clicking it earns one to four short
> questions with the answers already written, one at a time; Mili picks, it
> composes the full prompt into the message box, she sends it. Zero questions is
> a correct outcome. Do not assume chips, and do not assume anything happens
> before a click.