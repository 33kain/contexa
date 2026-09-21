# CONTEXA — store assets: two briefs to paste into a new chat
 
**CHECK BEFORE USING, 2026-09-01.** Written pre-pivot (0.9.55-era). Screenshot
content built from this brief may still show the retired interview/moves-chip
UI — NEXT-SUBMISSION.md confirms the current screenshot set is "moves-era" and
needs retaking against a live 0.9.68 session. Verify any shot list or brief
content against the current product before using it.
 
Written 2026-08-28, after the keyword-spam rejection. Two separate jobs with
different clocks:
 
- **Brief A — promo tiles.** Can be done NOW. Pure brand art, depends on no
  build. Natural home: the design chat.
- **Brief B — screenshots.** Must WAIT until 0.9.55 is live in the store,
  because they have to show the product people will actually install. Shooting
  is manual; a chat can only prepare, review and reject.
Both briefs are self-contained — paste one, whole, into a fresh chat. If that
chat is inside the CONTEXA project, tell it to read
`claude/CONTEXA-store-listing.md` §2 and §5 and `CONTEXA-design-brief.md` first
and the brief gets shorter and better.
 
---
 
## The rule that now governs BOTH
 
The 2026-08-28 rejection cited *Keyword Spam*, and the policy it quoted covers
*"the extension's description, developer name, title, icon, **screenshots, and
promotional images**"*. **Text baked into an image is metadata too.**
 
What went wrong in the description was a run of third-party brand names —
accurate, useful, written for the reader, and flagged anyway. **Accuracy is not
a defence against a metadata policy.** So in the images:
 
- No lists of browser names, no lists of competitor or tool names.
- No keyword strings — not *"AI prompt generator, prompt engineering, ChatGPT
  alternative, prompt builder"*, not in any corner, not in small type.
- No feature nouns stacked to fill space. One idea per image.
- Nothing implying Anthropic built or endorses it. No Claude or Anthropic
  logo, wordmark or brand colour used as a badge. *"Works on claude.ai"* is the
  safe formulation. Screenshots will inevitably contain claude.ai's own
  interface — that is the product surface and is fine — but do not crop or
  frame so it reads as an Anthropic product.
---
 
# BRIEF A — promo tiles *(paste this into a new chat now)*
 
---
 
I need promotional images for a published Chrome extension called CONTEXA. You
are doing brand art only — no code, no product changes.
 
**What the product is, in one sentence:** after Claude finishes a reply on
claude.ai, CONTEXA puts one small button above the message box; press it and it
asks a few short questions you answer by clicking, then writes the whole prompt
into your message box for you to read, edit and send yourself.
 
**Audience:** beginners and intermediate users of Claude — people who know
roughly what they want but not how to ask for it. Not developers.
 
**Brand, locked, do not renegotiate:**
 
- Brand colour is teal `#15a594`. A darker mint `#2E8B77` is available as a
  secondary accent.
- The mascot is the brand: a small rounded teal blob with two large friendly
  eyes and a small smile. It winks with one eye. Its source is
  `contexa-mascot-icon.svg` and PNG exports at 16/32/48/128/512 in the repo
  root — use the 512 as the reference for shape and colour.
- Coral `#D97757` is banned. It is claude.ai's own send-button colour and using
  it made an earlier icon read as a Claude sub-brand with no identity.
- No Anthropic or Claude logos, wordmarks, or brand colours as ownership.
- A non-affiliation line is required somewhere in the listing; it does not have
  to be on the tile.
**Copy you may use, and nothing longer:**
 
- Name: `CONTEXA`
- Tagline: `Create magic in Claude`
- Working line for the marquee: `One button. A few clicks. The prompt writes
  itself.`
- Retired, do not use: *"Prompt like a PRO"*, *"make bad prompts good"*,
  *"Rough ask"*, *"It asks. You click."*
**Hard constraint on text — read this twice.** These images are store metadata
under the same policy that just got this listing rejected for keyword spam. Put
**at most one short line** of text on the small tile and at most two on the
marquee. No lists. No keyword strings. No browser names, no competitor names,
no stacked feature nouns.
 
**What to produce:**
 
| asset | size | notes |
|---|---|---|
| Small promo tile | 440 × 280 px | Required. **Displayed at roughly 220 px wide** — design at that size first, then scale up. If the idea does not survive being 220 px, it is the wrong idea. |
| Marquee | 1400 × 560 px | Optional, shown only if the store features the extension. Do it second. |
 
Confirm both sizes in the Developer Dashboard before final export; treat the
dashboard as the source of truth, not this brief.
 
**Two findings from earlier attempts, so you do not repeat them:**
 
1. A cream/off-white tile **disappeared into the store's white grid**. Contrast
   against white is the whole job of a tile. Dark backgrounds pop, and this
   product lives in dark mode.
2. The previous tile described a product that no longer exists. The extension
   does nothing until a button is pressed — never depict or imply something
   appearing on its own.
**Deliverable:** a self-contained HTML file per asset at the exact pixel
dimensions with everything inlined, so it can be rendered to PNG and checked at
100%. Show me the design before exporting, and show the small tile scaled to
220 px wide in the same view — that is the size that decides it.
 
Start by proposing three distinct directions for the small tile in words, one
sentence each, before drawing anything.
 
---
 
# BRIEF B — screenshots *(paste this AFTER 0.9.55 is live)*
 
---
 
I need to shoot up to five screenshots for a published Chrome extension called
CONTEXA, for its Chrome Web Store listing. I will do the shooting; your job is
to prepare me, then review what I bring back and reject anything that fails.
 
**What the product is:** after Claude finishes a reply on claude.ai, CONTEXA
shows one small mascot button above the message box. Pressing it either asks a
few short questions answered by clicking, or offers up to four ready moves —
never both. Either way it writes a full prompt into the message box, which I
read, edit and send myself. It never sends anything on its own and does nothing
until the button is pressed.
 
**Format:** PNG or JPEG, 1280 × 800 (or 640 × 400), under 5 MB, maximum five.
Confirm in the Developer Dashboard.
 
**The five shots, in this order:**
 
1. **The offer.** The mascot alone above the message box, with the tail of
   Claude's reply above it. This is the first thing that exists in the product,
   and a first screenshot that skips it advertises different behaviour from
   what people install.
2. **The hero.** The question card open on the first of three questions, the
   answer pills visible, the progress dots showing position, Skip at the end of
   the row.
3. **The payoff.** The same conversation after answering: the composed prompt
   sitting in the message box, specific and unsent. This is what people are
   actually buying.
4. **The other answer.** A moves row — take it further / you choose / what
   could go wrong / why this way — from a different point in the conversation.
   It proves the extension reads the conversation instead of running a
   template.
5. **Type it rough.** The second button expanded with something rough typed
   into it.
Shoot all five in **one continuous conversation** so they read as a sequence.
 
**Topic.** Not a developer topic. Every test conversation so far has been
PowerShell, git and spreadsheets, which advertises to exactly the wrong
audience. Use something an ordinary person brings to Claude — a speech for an
occasion, an email to a landlord, a school assignment, a trip plan.
 
**Leak checklist — go through every item before the first shot:**
 
- Collapse the sidebar completely. It lists chat titles, and those titles are
  personal and sometimes reveal other projects.
- Hide the bookmarks bar. It shows other accounts and services by name.
- Close DevTools.
- Dismiss any usage or subscription banner.
- The account name and plan sit at the bottom of the sidebar — collapsing it
  handles that, but check the exported image anyway.
- **Turn Grammarly off.** It draws its own underlines inside the message box
  and they will read as part of this product.
- Turn off any other extension that draws in the page.
- Same theme in all five, same zoom, text legible at 1280 × 800 because the
  store scales the images down.
**Do not shoot:** a quiet row (a real feature and a terrible picture), a hidden
card (correct behaviour, empty strip), or the settings page.
 
**Critical constraint on annotations.** These images are store metadata under
the same policy that recently got this listing rejected for keyword spam. If
you propose captions or callouts on the images, keep them to a few words each,
never lists, never keyword strings, never browser or competitor names.
 
**After I bring the shots back:** check each one against the list above,
including the leak checklist, and tell me plainly which ones to reshoot and
why. Assume I have missed something.
 
---
 
# Sequencing, and why it matters
 
**Tiles now, screenshots after 0.9.55 is live.** The screenshots must show the
mascot, the pill answers and the progress dots — all of which are in 0.9.55,
which was rejected once for the description, fixed, and resubmitted. Shooting
before it is approved risks shooting a build that never ships.
 
**The currently uploaded screenshots are stale twice over**: they show a card
that appears on its own, which stopped being true at 0.9.53, and the
pre-mascot look. `store-assets/store-icon-128.png` also still carries the old
coral star while the manifest now ships the mascot — worth replacing in the
same pass.
 
**If the resubmission is rejected again on the same reference**, the next cut
to the description is to name no browsers at all — the replacement paragraph is
written out in `claude/CONTEXA-store-listing.md` §5. That is a description fix,
not an asset fix, and it publishes instantly.