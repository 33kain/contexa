# CONTEXA — store video: RETIRED as a CONTEXA asset (2026-08-26)
 
**Do not build from this document. The video it specifies is not CONTEXA.**
 
The live spec for CONTEXA's store video is **§3 of
`claude/CONTEXA-store-listing.md`**. Go there.
 
This file is kept because the decisions inside it were good ones and two of them
still bind — see the bottom.
 
---
 
## Why it was retired
 
Written 2026-08-22 for a v0-era product, it specifies an animated explainer
whose narrative is: *a vague prompt is caught **in the composer before sending**
(red 38 + critique panel) → sharpened → 91 green → sent → one strong reply →
Contexa suggests the next prompt → click Explore.*
 
Three things in there never existed in CONTEXA and never will:
 
1. **A prompt score** (38 → 89, red/green badge). Never built, never specced
   beyond v0, and it is a number a user would ask us to justify.
2. **A critique panel** — *vague goal / missing context / no output format*.
3. **Sharpen · Explore · Constrain** chips. The v0 chip vocabulary, replaced at
   0.9.30 and gone through sixteen releases; the closed list since 0.9.54 is
   `deeper · choose · risk · why`.
And the deeper problem is not that the details drifted. **The narrative belongs
to a different product.** Catching a vague prompt in the composer before it is
sent, marking what is wrong with it, and rewriting it on a click — that is
**SQUIGGLE**, which since 2026-08-25 is its own extension with its own repo and
its own store listing. CONTEXA has never worked before send and does not work on
what you type; it works after Claude replies, on a press, on the reply.
 
A video showing composer-side critique under the CONTEXA name would advertise
the wrong extension. If it is ever built, it belongs to Squiggle — and Squiggle
would need it rebuilt anyway, because Squiggle has no score and no critique
panel either: it has amber squiggles, teal dots, and one rewrite per click.
 
**The asset itself:** `contexa-explainer.html`, 1280×720, ~28s, self-contained,
built to be screen-recorded. Not published to a public URL. Leave it that way —
it renders a claude.ai-style window, and hosting a look-alike page needs a
sign-off nobody has given.
 
---
 
## The two decisions that still bind, whatever gets built
 
These were Mili's calls on 2026-08-22 and they outlived the video.
 
**1. No hard numbers in public copy.** The original brief was "stressed worker
on 5% of Claude → happy worker on 100% with Contexa". Dropped, because the
project's own figure was ~20%, that figure is rhetorical and never measured
(n=1), and a percentage in a public listing is a deceptive-claims risk that
invites *prove it*. The qualitative version — *"most people barely scratch the
surface of Claude"* — carries the same feeling and claims nothing.
 
**2. Never show a feature that has not shipped.** The v0 "100% of Claude"
capability moves (Projects, Artifacts, styles) were drafted, not built, and were
kept off screen for that reason. The aspiration was carried by the
stuck→bright arc instead of by unbuilt features. **This is the rule the rest of
this document went on to break by sitting unrevised for four days**, which is
the argument for it rather than against it.
 
Also still true, and now covering two products: the persistent non-affiliation
disclaimer on every scene and the end card is **mandatory and must never be
softened**, and how hard to lean on the claude.ai look is Mili's call, not a
default.
 
The approved tagline **"Create magic in Claude"** survives — it is the website
footer and the settings page. *"Prompt like a PRO"* and *"make bad prompts
good"* do not; see `claude/CONTEXA-store-listing.md` §4.