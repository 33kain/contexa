# Website-creation prompt

**Updated 2026-09-13, for 0.9.95.** This replaces the prompt written 2026-09-07
(in git history), which built the site that shipped from 2026-09-07 to 2026-09-13
and committed to an anti-landing-page register — "no hero, no buttons, black-ish
on white, the system sans; if it looks like a generated landing page, it is
wrong." On 2026-09-13 the maintainer chose a different direction: a polished
product landing page, ported from an external design draft into framework-free
static HTML/CSS/JS. That is a deliberate change of register, not a drift; this
prompt now describes the landing-page design, and the earlier one is kept only
in history. What did **not** change is everything below the register: the
product facts, the numbers-from-code rule, the single-origin CSP, the
non-affiliation line, and "invent nothing".

This is the prompt to paste into a fresh Claude Code session on this repo if the
site ever needs rebuilding. It is a prompt, not a plan: the session it starts is
expected to build a draft and show it before committing anything, not to guess
at facts about the product, and not to treat "build the site" as licence to
commit it unasked.

**What is there now**, so the prompt can be read against it:

```
publishing/website/
  index.html                landing: hero + two animated faux-browser demos (the row of moves, and Start fresh), how it works (3 steps), features (bento), benefits, Measured (the real token tables), final CTA
  how-it-works/index.html   the pipeline, what is read and how much, the request and the two paths, the two gates, an empty row, what lands in the box, Start fresh, known limits
  privacy/index.html        in the order it happens, where it goes, what is kept, the two stored things, third parties, permissions, choices, this site
  notes/index.html          rules and the failure behind each, by version, not built, status
  site.css                  one stylesheet: design tokens, layout, components, demo styles, scroll-reveal, prose styles for the sub-pages
  demo.js                   one script: adds .js, nav scroll state + mobile drawer, IntersectionObserver reveals, footer year, and the two faux-browser demo state machines
  fonts/                    self-hosted woff2: figtree-latin, figtree-latin-ext, spacegrotesk-latin, spacegrotesk-latin-ext (variable, one file per subset)
  _headers                  Cloudflare Pages headers: a CSP that allows only this origin (default-src 'none' … font-src 'self')
  404.html  robots.txt  sitemap.xml  icon.svg  favicon-32.png  apple-touch-icon.png  og.png
```

Cloudflare Pages serves `dir/index.html` at `/dir/`, so pages link to
`/how-it-works/`, `/privacy/`, `/notes/`. `.github/workflows/deploy-pages.yml`
deploys whatever lands under `publishing/website/` on `main`; it needs a live
`CLOUDFLARE_API_TOKEN` in the repo's Actions secrets, and a `9109 Invalid access
token` in its log means the secret, not the site. `og.png` and
`apple-touch-icon.png` are rendered by `node scripts/website/render.mjs` from
`scripts/website/assets.html`; edit the HTML and re-run, never retouch. Numbers
on the site are copies of constants in `worker/src/index.js` and
`extension/content.js`, and the footer carries the manifest version, so all of
them move with a release.

Why it lives here: `publishing/` is where the public copy lives, and
`publishing/STORE-LISTING.md` is what this prompt translates into pages —
reused, not reinvented. `docs/archive/website-build-prompt.md` is an older
one-off for a product that no longer exists (an interview, a free-text box, a
10-a-day limit); it is kept for provenance and is not a source.

---

```
You are acting as a brand-loyal front-end designer and copywriter for an
indie Chrome extension. CONTEXA has an established voice (terse, principled,
no padding, no fake positivity: "Zero is a valid outcome", "Never fake
output", "measured, not modelled") and a specific identity (the teal mascot;
a product that reads the page and hands the user the next move). Your job is
to carry the product's own copy and identity onto the web, not to invent a
voice, a tagline or a claim. If a sentence you write could sit unchanged on
the site of any "AI writing assistant", it is wrong for this one. If a number
you write cannot be traced to a file below, it does not go on the page.

THE PRODUCT, IN ONE PARAGRAPH — the thing every page is about:
Every message on claude.ai is processed with the whole conversation behind
it, so on a long thread each send re-reads the thread, and the usage limit
goes with it. CONTEXA spends fewer tokens per thing done, two ways. One
press writes the next message in full — up to four independent, complete
next messages mined from the user's own side of the whole conversation;
picking one lands it in the message box, whole, unsent. And when a thread
has grown heavy, Start fresh hands the user the exit: a brief of the thread
(goal, what is settled, what is open, a <paste here> slot for what the new
chat will not have), landed in a new conversation's message box, unsent.
Nothing is sent for the user, ever. Nothing leaves the page until the press.

READ FIRST, IN THIS ORDER:
1. CLAUDE.md (repo root) — architecture and the design principles. Re-read
   "Design principles worth knowing before changing behavior" for voice,
   and "The fork and the cost line (0.9.73)" for what Start fresh actually
   does, including on Cowork.
2. README.md — the hero, the ASCII pipeline, "The weight of the thread",
   and "Design notes", which is the voice bible.
3. publishing/STORE-LISTING.md — the 0.9.95 public copy: the name
   (CONTEXA for Claude - Save tokens), the short description, the detailed
   description in its three parts (measured, Start fresh, one press). This
   IS the copy. Reuse its language and its order; do not paraphrase it into
   something blander, and do not reorder it so the writing leads again.
4. docs/token-savings-thesis.md — the test behind the motto: "every token
   earned". The Measured section closes on the relation between the two,
   and this file is where that relation is argued.
5. publishing/PRIVACY.md — the privacy claims, including the Cowork read and
   the one cookie value. Site copy must not contradict it in fact or tone.
6. CHANGELOG.md, the entries from 0.9.73 up — the fork and the cost line
   (0.9.73), the nudges (0.9.74), the clipboard floor on Cowork (0.9.85),
   the Cowork exit and the base58 project id (0.9.88–0.9.94), the motto
   (0.9.95). Every positioning claim describes the product as it is.
7. worker/src/index.js — REPLIES_PER_DAY, MAX_TURNS, MAX_TURN_CHARS,
   MAX_TURNS_TOTAL_CHARS, MAX_REPLY_CHARS. And extension/content.js —
   LONG_THREAD_TOKENS (the threshold the cost line appears at) and
   FRAGMENT_MIN_THREAD_TOKENS. Any number the site states about limits or
   thresholds is read from these at the moment of writing, never retyped
   from another document — the listing once said 10 while the code
   enforced 20.
8. extension/manifest.json — the version, and the name and description
   strings the listing requires byte-identical.
9. store-assets/README.md and store-assets/contexa-mascot-icon.svg — the
   mascot. Read the SVG for the gradient (#2cc4ae → #15a594) and the inks.
   The favicon/icon.svg on the site is the mascot; keep it.
10. site.css itself — the current design tokens (below, under VISUAL
    IDENTITY) are defined at the top of it as CSS custom properties; a
    rebuild reads them from there rather than re-deriving a palette.

FACTS THE SITE MUST GET RIGHT, AND KEEP APART:
- Measured is measured; modelled is modelled; the page says which every
  time. Measured, from STORE-LISTING.md and the tables now on the landing's
  Measured section: five messages in a 689k-token session spent 9% of the
  five-hour usage limit; the same five after Start fresh spent 3%; on five
  sessions from 14k to 689k tokens the brief was between 313 and 444 tokens
  every time, Cowork counts exact from the session record, chat counts
  estimated at four characters a token. The modelled table (asks ×
  messages-per-ask) is a model and must keep saying so in its caption.
- The cost line appears above LONG_THREAD_TOKENS (about 12,000, read the
  constant), says how much is re-read per send, and offers Start fresh.
  A fork spends one of the same daily REPLIES_PER_DAY. The brief lands
  unsent; the user reads, edits and sends. On a chat it opens a new
  conversation; on a Cowork session it opens a new session in the same
  project, and the brief is on the clipboard first regardless. The brief
  is a summary and says so — on a thread where every detail still matters,
  the honest advice is to stay, and the site gives it.
- Moves are independent: a menu, not a sequence; picking one discards the
  rest. Each is one ask, one verb, complete. Every move is earned by a
  verbatim quote from the session or the reply, checked before it is
  drawn; an empty row is a valid outcome and has two causes the card tells
  apart. Nothing is padded to a minimum, and nothing is capped by a floor.
- Hosted and own-key paths are the same product: the same system prompt,
  the same gates, the same caching. The only difference is who holds the
  key and whether the daily limit applies.
- Nothing is sent, read or spent until the press. The reply is copied from
  the page when it finishes; the conversation is read only on the press.

HARD CONSTRAINTS — DO NOT PROPOSE CHANGES TO THESE WITHOUT FLAGGING THEM
AS A SEPARATE DECISION:
- CONTEXA is an independent project, not affiliated with, endorsed by, or
  sponsored by Anthropic. That line closes every page, verbatim or near-
  verbatim to STORE-LISTING.md's closing line, never softened. No
  Anthropic wordmark or logo anywhere.
- Invent nothing: no testimonials, ratings, user counts, press logos, team,
  funding, roadmap dates, pricing tiers, or a measurement that is not in
  the files above. A section that needs a missing fact flags it.
- No email capture, newsletter, analytics, trackers or cookie banner. No
  external network request of any kind: no CDN, no embeds, and no web-font
  host — the two typefaces are self-hosted as woff2 under fonts/ and loaded
  by an @font-face in site.css, so nothing is fetched off-origin. _headers
  carries the CSP that makes "loads nothing from anywhere else" a checkable
  claim (default-src 'none'; script-src 'self'; style-src 'self'; img-src
  'self'; font-src 'self'; …); keep it, and keep the site passing it. The
  footer states the single-origin claim; do not weaken it.
- Language: the product is one trigger and up to four independent,
  already-written next messages, plus Start fresh. Never "questions you
  answer" or "smart replies". Never "summarise your chat" or "compress the
  context" for Start fresh — it writes a brief you read and send yourself,
  into a new conversation. Never present a modelled figure as measured.
- The "Add to Chrome" call to action links to
  https://chromewebstore.google.com/detail/phhamigkjeeabbjncpmhkppkjccfglhb
  (the extension ID, stable across versions). Every "Add to Chrome" control
  on the page carries it; confirm it resolves; if it does not, flag it
  rather than guess. (The 2026-09-13 draft shipped with dead buttons before
  this was caught — every CTA must actually link.)
- Install path: Chromium-based browsers (Chrome primary; Edge, Brave,
  Opera, Vivaldi, Arc from the same URL), desktop and mobile where the
  browser supports extensions. Chrome for Android and Safari on iOS do not
  and cannot install it — say that precisely, not as "no mobile". (The
  landing does not carry the full install table; how-it-works does.)
- Numbers match the constants in step 7. The footer's version matches the
  manifest.
- Do not embed publishing/screenshots/. Those are designed illustrations
  for the store. The site's demos are its own illustrated mockups (see THE
  FIGURE), not store frames and not byte-faithful captures of the card.

THE FIGURE (demo.js) — what it now shows:
- Two faux-browser demos, not one, each a small "claude.ai" window with a
  traffic-light chrome bar and an animated cursor. They are illustrative
  mockups — clean, on-brand, readable — not a byte-faithful reproduction of
  the extension's real card. (This is a change from the previous site,
  whose figure rebuilt the card from content.js; the landing design uses
  designed mockups instead, in the same spirit as the store illustrations.)
  Scene one (hero): Start fresh, and it is CLICK-DRIVEN, not autoplayed. It
  rests on a long, heavy conversation (the shipped one is a words-first math-
  tutoring thread — factoring, completing the square, the quadratic formula,
  heading toward derivatives) with the cost line ("≈ 689k tokens re-read per
  send") and a prominent, filled Start fresh button that pulses to invite the
  press. Only when the visitor actually clicks does the new chat open and the
  brief type into the composer with a <paste here> slot, unsent; a small
  "Watch again" control returns it to the thread. No cursor, no autoplay — the
  first frame is the thread and the control, so a thumbnail shows the choice,
  not the result.
  Scene two (Next moves section): a heavy thread's row of moves appears, an
  animated cursor picks one, and the whole prompt types into the composer,
  unsent. This one autoplays and loops (the shipped conversation is a 3-day
  Lisbon trip).
- Both run as plain state machines in demo.js — no framer-motion, no library.
  The auto-playing moves demo starts only when it scrolls into view
  (IntersectionObserver) and then loops; the hero Start fresh demo waits for a
  real click. Section content reveals on scroll. The headline animates
  word-by-word on load.
- Progressive enhancement: the page is complete and readable with JavaScript
  off (the hero rests on the thread; the moves demo renders its final "filled"
  frame). Every animation is gated so prefers-reduced-motion gets a static
  result and no motion — the "js" class demo.js adds is what enables the
  keyframes and the Start fresh button's pulse, and the reduced-motion media
  query overrides them; the click still works, it just fills the brief without
  the typing effect.
- Write short, self-contained demo conversations. For the moves, keep the
  product's rules: one complete ask each, earned by something actually said, a
  label of up to six words. For a Start fresh thread, favour words over
  numbers so it reads as a real conversation, not an equation dump.

THE TWO RENDERED IMAGES:
- og.png (1200×630) and apple-touch-icon.png (180×180) come from
  scripts/website/assets.html via node scripts/website/render.mjs. The og
  board reads "CONTEXA / Save tokens" under the mascot, matching the pages'
  og:image:alt. Change the board only in assets.html and re-render (set
  PLAYWRIGHT_CHROMIUM_EXECUTABLE to the dev image's Chromium if the default
  is not found); the script fails rather than write a wrong size, and if the
  bytes come back identical the board already said what the source says.
  Whenever the board's wording changes, update every page's og:image:alt to
  match, since the alt describes the image that exists.

VISUAL IDENTITY, AND THE REGISTER:
- The register is a polished product landing page, executed cleanly — not
  the earlier editorial document. It is allowed a hero, buttons, cards,
  soft gradients and motion, spent with restraint. The bar is "does it read
  as considered and specific to CONTEXA", not "does it avoid looking like a
  landing page".
- Palette (defined as CSS custom properties at the top of site.css):
  ground #FBFCFD, white surfaces, a second surface #F4F7F8; text #0B1220 /
  #334155, muted #64748B, border #E6EDF2. The one brand hue is teal:
  --primary #0EA5A4, with #0B8F8E / #087A79 for hover and ink and a soft
  #D7F5F2 for fills; a warm amber accent --accent #FFB86B (soft #FFF1E2)
  used sparingly (the mascot avatar, the <paste here> chip). Spend the
  boldness on the teal; keep everything else quiet.
- Type: Space Grotesk for display and headings, Figtree for body — both
  self-hosted (variable woff2, latin + latin-ext subsets, font-display
  swap), with a real system fallback stack. Set a type scale and stay on it.
- Single light theme, deliberately (color-scheme: light). The design does
  not ship a dark mode; if you add one, do it as a real second palette on
  tokens, not a naive invert, and treat it as a separate decision.
- Layout vocabulary: a sticky translucent nav that gains a border/shadow on
  scroll and collapses to a mobile drawer; a two-column hero (copy + demo)
  over a faint radial gradient; a Start fresh split (demo + copy +
  tick-list); a three-step "how it works" with a connector line and
  numbered icon tiles; a bento of feature cards (one wide privacy card plus
  smaller ones); three benefit cards; the Measured section as data cards
  holding the real tables; a gradient CTA band; a footer. Rounded corners
  (~12–16px), soft shadows spent by role (not one shadow on every block),
  pill badges and tracked-uppercase eyebrows, a gradient "squircle"
  brandmark.
- Icons are hand-inlined SVG symbols in a sprite (lucide-style strokes),
  owned by the page — not an icon font or a library. The mascot gradient
  (#2cc4ae → #15a594) lives in icon.svg / the favicon.
- Still true from before: the mascot is the only character mark; no stock
  photography, no purple-to-blue SaaS gradient, no invented social proof.
  If a flourish is there only because landing pages have it, cut it.

OPEN FOR YOUR WORK:
- How much of STORE-LISTING.md's detailed description to carry verbatim
  versus compress for a page — but its order (measured, Start fresh, one
  press) is the site's order.
- Whether the measured tables live on the landing's Measured section or move
  to how-it-works, as long as the landing states the 9% against 3% and the
  brief's size somewhere.
- The exact choreography of the two demos: how the row and the composer
  hand over, how the heavy thread is suggested without a forty-message DOM,
  timings and whether they loop.
- Whether notes/ stays a full by-version list or keeps only the entries a
  visitor needs, with the changelog linked for the rest.

DELIVERABLE:
Four hand-written static pages under publishing/website/, sharing one
stylesheet (site.css) and one script (demo.js), no build step, no external
request. index.html (landing), how-it-works/index.html, privacy/index.html,
notes/index.html, in directory form so Cloudflare Pages serves them at /,
/how-it-works/, /privacy/ and /notes/. Keep _headers (with font-src 'self'),
404.html, robots.txt, sitemap.xml, and the self-hosted fonts under fonts/;
re-render og.png and apple-touch-icon.png from assets.html if you touch them.
Responsive to a phone (~390px, no horizontal scroll), semantic HTML (one h1
per page, landmarks, tables with captions and scope, a skip link), keyboard
navigable with visible focus, prefers-reduced-motion honoured, and complete
with JavaScript disabled. Every number read from the code at the time of
writing; the version in the footer read from the manifest; the
non-affiliation line closing every page.

BEFORE YOU COMMIT ANYTHING: build the draft, run npm test and npm run build
to confirm nothing under extension/ or worker/ was touched by mistake, and
show the draft for review. Verify in a browser that the page makes no
off-origin request and passes its own CSP. Do not git add, commit or push
until it has been looked at and approved — "build the site" is not standing
permission to commit it. Where something above still leaves a real
ambiguity, ask; do not hold up a draft over a small one.
```
