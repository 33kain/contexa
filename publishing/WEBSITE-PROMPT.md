# Website-creation prompt

**Written 2026-09-01. Updated 2026-09-02** (`publishing/website/index.html`
landed in PR #24 with an animated reproduction of the card as its proof).
**Rebuilt 2026-09-04:** the single page was replaced by a four-page site on
the argument that the old one looked like every generated landing page
(gradient button with a glow, sparkle eyebrows, pill chips, a drop-shadowed
mascot, a sticky demo with a control strip, a dark default). What ships now is
hand-written HTML in the register of an engineer's own site or a README:
black-ish on white, the system sans, one link colour (the mascot's ink), rules
between sections, tables for every number, `<pre>` for the pipeline, the
mascot at its natural size, the card reproduction as a captioned figure with
two text controls, dark only via `prefers-color-scheme`. The layout is

```
publishing/website/
  index.html                overview: what it is, the figure, quick start, what it does, install
  how-it-works/index.html   the pipeline, what is read and how much, the two gates, known limits
  privacy/index.html        what leaves the browser and when, retention, third parties
  notes/index.html          rules and the failure behind each, by version, not built, status
  site.css  demo.js         one stylesheet, one script (the card figure), nothing external
  _headers                  Cloudflare Pages headers: a CSP that allows only this origin
  404.html  robots.txt  sitemap.xml  icon.svg  favicon-32.png  apple-touch-icon.png  og.png
```

Cloudflare Pages serves `dir/index.html` at `/dir/`, so the pages link to
`/how-it-works/`, `/privacy/` and `/notes/`. The two PNGs are rendered by
`node scripts/website/render.mjs` from `scripts/website/assets.html`; edit the
HTML and re-run rather than retouching them. Numbers on the site are read from
`worker/src/index.js` and the version from `extension/manifest.json`; the
footer's version line is the one most likely to drift, so bump it with the
manifest. The prompt below still describes the intent and the sources; its
deliverable section was rewritten to match the four-page shape.

**Written 2026-09-01. Updated 2026-09-02:** `publishing/website/index.html` now
exists (PR #24) and its "proof" is an animated JavaScript reproduction of the
card, not screenshots — the draft that used four embedded PNGs was reviewed
and replaced before merge. Step 6 below and the deliverable's proof section
were rewritten to match what actually shipped; nothing else about the
prompt's intent changed. Paste the block below into a fresh Claude Code
session opened on this repo if the site ever needs rebuilding from scratch.
It is a prompt, not a plan: the session it starts is expected to build a
draft and show it before committing anything — not to guess at facts about
the product, and not to treat "build the site" as license to also commit it
unasked.

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
6. The product's visual proof is an animated reproduction of the card, not
   screenshots — do not embed the PNGs in `publishing/screenshots/` (they
   are the Chrome Web Store's own listing images, a separate asset with its
   own README). Build the animation from source instead:
   - `extension/content.js` — the card's real markup, classes and CSS
     (`.wrap`, `.label`, `.chips`, `.chip`, `.chip.busy`), the mascot SVG
     (`MASCOT_SVG`) and its animations (`ctxa-popin`, the idle wink/glance,
     `ctxa-peek`, `ctxa-hop`), `renderTrigger`/`renderMoves`/
     `appendIdeaChip` for what the DOM looks like in each state, and
     `insertPrompt` for how the chosen prompt lands in the composer (set in
     one assignment, never typed, no "picked" state on the chip).
   - `scripts/screenshots/mock-claude.html` — the claude.ai frame's own
     color tokens (dark and light), composer placeholder text, and send
     button, so the surrounding page reads as claude.ai rather than an
     invented chat UI.
   - Write a fresh, short conversation for the demo rather than reusing the
     screenshot harness's canned session — it only has to fit the animated
     frame, not match any existing capture. Keep the product's own rules
     for moves: each is a single complete ask, earned by something actually
     said in the conversation, and a label of up to six words naming the
     action and the thing it acts on.
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
  imposing one. If the site shows the card (animated or not), give it a
  way to show both light and dark, not just one — a toggle on the demo is
  simpler than showing two static states.

OPEN FOR YOUR WORK:
- Section order and how much of STORE-LISTING.md's detailed description to
  carry over verbatim versus compress for a page instead of a store listing.
- One long page versus a few distinct sections — the product is small and
  the copy is not long; don't pad it into more sections than it needs.
- The shape of the animation — how many scenes, how it loops, whether it
  autoplays or waits for interaction — as long as it reproduces the card
  faithfully (per step 6) and ends on the composed-prompt state, which is
  the one proof image the archived prompt got right: showing the click and
  its result, not just the row of moves, is the whole pitch. Respect
  `prefers-reduced-motion`: no autoplay, land on the result.
- Hosting target: no build step is required either way, but note if you're
  assuming static hosting (e.g. Cloudflare Pages, GitHub Pages) so the
  output stays deployable without one.

DELIVERABLE:
Four hand-written static pages under publishing/website/, sharing one
stylesheet (site.css) and one script (demo.js, the reproduction of the card),
with no build step and no external network requests of any kind: no web
fonts, no CDN, no analytics. The pages are index.html (overview), how-it-
works/index.html, privacy/index.html and notes/index.html; keep the
directory form so Cloudflare Pages serves them at /, /how-it-works/,
/privacy/ and /notes/ without redirects. Keep _headers (a CSP that allows
only this origin, which is what makes "loads nothing from anywhere else" a
checkable claim), 404.html, robots.txt and sitemap.xml. Responsive down to a
phone, semantic HTML (one h1 per page, landmarks, tables with captions and
scope, a skip link), keyboard navigable, AA contrast in both colour schemes,
prefers-reduced-motion honoured by the figure. The register is an engineer's
own site, not a launch page: no hero, no buttons outside the reproduced
card, no gradients, shadows, glows, pills, sparkle glyphs, tracked-uppercase
labels, card grids or toggles; the store call to action is a sentence with
an inline link. Every number is read from the code at the time of writing,
and the mandatory non-affiliation line closes every page.

BEFORE YOU COMMIT ANYTHING: build a draft, run `npm test` and `npm run build`
to confirm nothing under `extension/` or `worker/` was touched by mistake
(this is a static file, not a code change), and show the draft for review.
Do not `git add`, commit, or push until it's been looked at and approved —
"build the site" is not standing permission to also commit it. If anything
above still leaves a real ambiguity (how to shape the animation, how much
copy to carry over, hosting target), ask rather than guess; don't hold up a
draft over a small one.
```
