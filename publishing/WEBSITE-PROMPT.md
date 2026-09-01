# Website-creation prompt

**Written 2026-09-01.** Paste the block below into a fresh Claude Code session
opened on this repo. It is a prompt, not a plan: the session it starts is
expected to build `publishing/website/index.html` (or propose it for review),
not to guess at facts about the product.

Why it lives here: `publishing/` is where the public-facing copy lives, and
`publishing/STORE-LISTING.md` is what this prompt exists to translate into a
marketing page — reused, not reinvented.

Why it exists at all: `docs/archive/website-build-prompt.md` is a one-off
prompt from an earlier version of this product. It describes a click-to-answer
interview, a "Rough ask" free-text box, the name "CONTEXA — Prompt like a PRO",
and a 10-prompts-a-day limit — every one of those was deleted or changed in the
0.9.58 history-mining pivot (see `docs/archive/README.md`). That file is kept
for provenance, not reuse, and a session that pastes facts from it will build a
website advertising a product that no longer exists. This prompt is the
replacement, scoped to what actually ships today.

---

```
You are acting as a brand-loyal front-end designer and copywriter for an
indie Chrome extension — not a generic landing-page generator. CONTEXA
already has an established, opinionated voice (terse, principled, no
padding, no fake positivity — "Zero is a valid outcome," "Never fake
output") and a specific visual identity (the teal mascot, a dark UI that
follows the host page's theme). Your job is to translate the product's own
copy and brand identity into a website, not invent a new voice, a new
tagline, or new claims. If a sentence you write could sit unchanged on the
landing page of any generic "AI writing assistant," it is wrong for this
one.

READ FIRST, IN THIS ORDER:
1. CLAUDE.md (repo root) — architecture and design principles. Auto-loaded,
   but re-read "Design principles worth knowing before changing behavior"
   deliberately, for voice.
2. README.md — hero line, the ASCII "How it works" flow, and the "Design
   notes" section, which is the voice bible.
3. publishing/STORE-LISTING.md — the current public copy: name, short
   description, detailed description, category. This IS the copy. Reuse
   its language and structure; do not paraphrase it into something blander.
4. publishing/PRIVACY.md — the privacy claims and their tone. Site copy
   must not contradict this in fact or in register.
5. store-assets/README.md and store-assets/contexa-mascot-icon.svg — the
   mascot is the only illustration this product has. Read the SVG directly
   for the exact gradient (`#2cc4ae` → `#15a594`) and ink colors
   (`#173b35`, `#0e6e63`); do not eyeball them from a PNG export.
6. publishing/screenshots/README.md and the five PNGs in that folder — real
   captures of the shipped UI, current as of the date on that README. These
   are the product visuals. Do not invent a mockup of the card, the row of
   moves, or the composed message box — use these images or regenerate them
   with `scripts/screenshots/capture.mjs` if you need a different session
   shown.
7. worker/src/index.js — REPLIES_PER_DAY, MAX_TURNS, MAX_TURN_CHARS,
   MAX_TURNS_TOTAL_CHARS, MAX_REPLY_CHARS. Any number this page states about
   limits is read from these constants at the moment of writing, never
   retyped from memory or from another document — the listing once said 10
   while the code enforced 20.
8. extension/manifest.json — current version, and the name/short-description
   strings, byte-identical requirements noted in STORE-LISTING.md.

DO NOT READ docs/archive/website-build-prompt.md FOR FACTS. It is superseded
— see the note above this block. If you open it for historical curiosity,
treat every fact in it (the interview mechanism, the name, the 10/day limit)
as wrong for the current product.

HARD CONSTRAINTS — DO NOT PROPOSE CHANGES TO THESE WITHOUT FLAGGING THEM AS
A SEPARATE DECISION:
- CONTEXA is an independent project, not affiliated with, endorsed by, or
  sponsored by Anthropic. That line is mandatory in the footer, verbatim or
  near-verbatim to STORE-LISTING.md's closing line, and must never be
  softened. No Anthropic wordmark or logo anywhere on the page.
- Invent nothing: no testimonials, star ratings, user counts, press logos,
  team bios, funding, roadmap dates, or pricing tiers. If a section needs a
  fact that isn't in the files above, flag it instead of filling it in.
- No email capture, no newsletter signup, no analytics, no third-party
  trackers, no cookie banner — there is nothing on this page that needs one.
- Do not describe the product as showing "chips," "a row of suggestions
  you click through," or "questions you answer." It is one trigger and up
  to four independent, already-written next messages.
- The "Add to Chrome" CTA points at the real Chrome Web Store listing:
  https://chromewebstore.google.com/detail/phhamigkjeeabbjncpmhkppkjccfglhb
  — this is the extension ID, which is stable across version bumps.
  Confirm the listing still resolves before shipping the link; if it
  doesn't, flag that rather than guessing a replacement URL.
- Supported install path is Chromium-based browsers (Chrome primary; Edge,
  Brave, Opera, Vivaldi, Arc install from the same URL) — desktop **and**
  mobile, per README.md's "Status" line ("mobile via Chromium browsers that
  support extensions"). Most mobile browsers, including Chrome for Android
  and Safari on iOS, do not support extensions at all and cannot install it
  — state that precisely rather than as a blanket "no mobile." Do not copy
  the desktop-only claim from docs/archive/website-build-prompt.md; that
  file predates mobile support and is wrong on this point, which is exactly
  why it's superseded rather than a source.
- Numbers (replies/day, message caps) must match the constants read in step
  7 above, not the "10 prompts a day" figure in the archived prompt.

VISUAL IDENTITY:
- Primary gradient: `#2cc4ae` → `#15a594` (the mascot's own gradient).
- Ink/accent: `#173b35` (near-black teal), `#0e6e63`.
- The mascot is the only illustration. No stock photography, no generic
  line-icon rows, no purple-to-blue SaaS gradient.
- The product follows the host page's light/dark theme rather than
  imposing one — `publishing/screenshots/4-light.png` exists specifically
  to prove that. The site itself can commit to one look, but if it shows
  the product, show both the dark and light captures somewhere, not just
  the dark one.

OPEN FOR YOUR WORK:
- Section order and how much of STORE-LISTING.md's detailed description to
  carry over verbatim versus compress for a page instead of a store listing.
- One long page versus a few distinct sections — the product is small and
  the copy is not long; don't pad it into more sections than it needs.
- Which of the five real screenshots to feature and in what sequence — the
  "composed prompt in the message box" frame is the one proof image the
  archived prompt got right: showing the click and its result, not just
  the row, is the whole pitch.
- Hosting target: no build step is required either way, but note if you're
  assuming static hosting (e.g. Cloudflare Pages, GitHub Pages) so the
  output stays deployable without one.

DELIVERABLE:
One self-contained HTML file — inline CSS and JS, no build step, no
external network requests except an optional Google Fonts stylesheet if you
use one. Responsive down to a phone screen, semantic HTML, keyboard
navigable, real contrast, alt text on every image. Save it as
`publishing/website/index.html`. Sections at minimum:
1. Hero — mascot, the name and short description from STORE-LISTING.md
   (byte-identical to the manifest), one primary "Add to Chrome" button.
2. How it works — the click-costs-nothing-until-you-ask flow, using
   README's ASCII diagram or STORE-LISTING's four-step list as source.
3. Proof — real screenshots showing the row of moves and the composed
   message box.
4. Privacy, plainly — the bullet list from STORE-LISTING.md's privacy
   section, unchanged in substance.
5. Footer — GitHub link, MIT license mention, the mandatory non-affiliation
   line.

When the page is built, run `npm test` and `npm run build` to confirm
nothing under `extension/` or `worker/` was touched by mistake — this is a
static file, not a code change — then present it for review before treating
it as final.
```
