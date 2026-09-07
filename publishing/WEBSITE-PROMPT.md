# Website-creation prompt

**Written 2026-09-07, for 0.9.95.** It replaces the prompt written 2026-09-01
for 0.9.68 and patched through 2026-09-04 (in git history, deleted the commit
before this one). That prompt built the site that ships, and it was right about
the register; it was wrong about the product it now describes. Its pitch was the
writing — the figure it asked for "ends on the composed prompt, which is the
whole pitch" — and it never named Start fresh, the brief, the cost line, Cowork
or the measured numbers the listing and the site now lead with. Its social
preview board still says *Every token earned*, and `publishing/website/og.png`
still shows it. This prompt is scoped to what ships at 0.9.95, and it is the
one to paste into a fresh Claude Code session on this repo if the site ever
needs rebuilding — or, sooner, if the figure and the preview image are to
catch up with the motto.

It is a prompt, not a plan: the session it starts is expected to build a draft
and show it before committing anything, not to guess at facts about the
product, and not to treat "build the site" as licence to commit it unasked.

**What is there now**, so the prompt can be read against it:

```
publishing/website/
  index.html                overview: what it is, the figure, save tokens (measured, then modelled), quick start, what it does, compared, install
  how-it-works/index.html   the pipeline, what is read and how much, the request and the two paths, the two gates, an empty row, what lands in the box, Start fresh, known limits
  privacy/index.html        in the order it happens, where it goes, what is kept, the two stored things, third parties, permissions, choices, this site
  notes/index.html          rules and the failure behind each, by version, not built, status
  site.css  demo.js         one stylesheet, one script (the card figure), nothing external
  _headers                  Cloudflare Pages headers: a CSP that allows only this origin
  404.html  robots.txt  sitemap.xml  icon.svg  favicon-32.png  apple-touch-icon.png  og.png
```

Cloudflare Pages serves `dir/index.html` at `/dir/`, so pages link to
`/how-it-works/`, `/privacy/`, `/notes/`. `.github/workflows/deploy-pages.yml`
deploys whatever lands under `publishing/website/` on `main`; it needs a live
`CLOUDFLARE_API_TOKEN` in the repo's Actions secrets, and a `9109 Invalid access
token` in its log means the secret, not the site. The two PNGs are rendered by
`node scripts/website/render.mjs` from `scripts/website/assets.html`; edit the
HTML and re-run, never retouch. Numbers on the site are copies of constants in
`worker/src/index.js` and `extension/content.js`, and the footer carries the
manifest version, so all of them move with a release.

Why it lives here: `publishing/` is where the public copy lives, and
`publishing/STORE-LISTING.md` is what this prompt translates into pages —
reused, not reinvented. `docs/archive/website-build-prompt.md` is an older
one-off for a product that no longer exists (an interview, a free-text box, a
10-a-day limit); it is kept for provenance and is not a source.

---

```
You are acting as a brand-loyal front-end designer and copywriter for an
indie Chrome extension — not a landing-page generator. CONTEXA has an
established voice (terse, principled, no padding, no fake positivity: "Zero
is a valid outcome", "Never fake output", "measured, not modelled") and a
specific identity (the teal mascot; a card that follows the host page's
theme; an engineer's own site, not a launch page). Your job is to carry the
product's own copy and identity onto the web, not to invent a voice, a
tagline or a claim. If a sentence you write could sit unchanged on the site
of any "AI writing assistant", it is wrong for this one. If a number you
write cannot be traced to a file below, it does not go on the page.

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
   earned". The site's "Save tokens" section closes on the relation between
   the two, and this file is where that relation is argued.
5. publishing/PRIVACY.md — the privacy claims, including the Cowork read and
   the one cookie value. Site copy must not contradict it in fact or tone.
6. CHANGELOG.md, the entries from 0.9.73 up — the fork and the cost line
   (0.9.73), the nudges (0.9.74), the clipboard floor on Cowork (0.9.85),
   the Cowork exit and the base58 project id (0.9.88–0.9.94), the motto
   (0.9.95). Every positioning claim describes the product as it is.
7. worker/src/index.js — REPLIES_PER_DAY, MAX_TURNS, MAX_TURN_CHARS,
   MAX_TURNS_TOTAL_CHARS, MAX_REPLY_CHARS, MAX_BRIEF_CHARS. And
   extension/content.js — LONG_THREAD_TOKENS (the threshold the cost line
   appears at) and FRAGMENT_MIN_THREAD_TOKENS. Any number the site states
   about limits or thresholds is read from these at the moment of writing,
   never retyped from another document — the listing once said 10 while the
   code enforced 20.
8. extension/manifest.json — the version, and the name and description
   strings the listing requires byte-identical.
9. store-assets/README.md and store-assets/contexa-mascot-icon.svg — the
   mascot is the only illustration. Read the SVG for the gradient
   (#2cc4ae → #15a594) and the inks (#173b35, #0e6e63).
10. The figure's sources, if you touch demo.js: extension/content.js for
    the card's real markup and CSS (.wrap, .label, .chips, .chip, the cost
    line .ctxa-cost with its Start fresh button, the brief card .brief), the
    mascot (MASCOT_SVG) and its animations, renderTrigger / renderMoves /
    renderBrief for each state, insertPrompt for how text lands (one
    assignment, never typed); scripts/screenshots/mock-claude.html for
    claude.ai's own frame tokens, dark and light.
11. scripts/website/assets.html and render.mjs — the source of og.png and
    apple-touch-icon.png.

FACTS THE SITE MUST GET RIGHT, AND KEEP APART:
- Measured is measured; modelled is modelled; the page says which every
  time. Measured, from STORE-LISTING.md and the current index.html: five
  messages in a 689k-token session spent 9% of the five-hour usage limit;
  the same five after Start fresh spent 3%; on five sessions from 14k to
  689k tokens the brief was between 313 and 444 tokens every time, Cowork
  counts exact from the session record, chat counts estimated at four
  characters a token. The modelled table (asks × messages-per-ask) is a
  model and must keep saying so in its caption.
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
  external network request of any kind: no web fonts, no CDN, no embeds.
  _headers carries the CSP that makes "loads nothing from anywhere else" a
  checkable claim; keep it, and keep the site passing it.
- Language: the product is one trigger and up to four independent,
  already-written next messages, plus Start fresh. Never "chips", "a row of
  suggestions you click through", "questions you answer", "smart replies".
  Never "summarise your chat" or "compress the context" for Start fresh —
  it writes a brief you read and send yourself, into a new conversation.
  Never present a modelled figure as measured.
- The "Add to Chrome" call to action is a sentence with an inline link to
  https://chromewebstore.google.com/detail/phhamigkjeeabbjncpmhkppkjccfglhb
  (the extension ID, stable across versions). Confirm it resolves; if it
  does not, flag it rather than guess.
- Install path: Chromium-based browsers (Chrome primary; Edge, Brave,
  Opera, Vivaldi, Arc from the same URL), desktop and mobile where the
  browser supports extensions. Chrome for Android and Safari on iOS do not
  and cannot install it — say that precisely, not as "no mobile".
- Numbers match the constants in step 7. The footer's version matches the
  manifest.
- Do not embed publishing/screenshots/. Since 2026-09-07 those are designed
  illustrations for the store, footed "Illustrative demo"; the site's proof
  is the reproduced card, built from content.js, running in the page.

THE FIGURE (demo.js) — what it must now show:
- Two scenes, not one. The row → one click → the whole prompt in the box
  (the proof that the writing is done), and the cost line on a heavy thread
  → Start fresh → the brief in a new conversation's box (the proof that the
  exit is one press). The 0.9.68 figure had only the first; the motto leads
  with the second, so the figure cannot stop before it.
- Reproduce the card from source, not from memory: the same classes, the
  cost line's exact wording ("≈ 14k tokens re-read per send", read the
  format from content.js), the brief card's sentence ("Brief ready: ≈ N
  tokens instead of ≈ Nk per send."). Text lands in one assignment.
- Write a fresh, short conversation for the demo; do not reuse the
  screenshot harness's canned session or the store frames' Lisbon one.
  Keep the product's rules for moves: one complete ask each, earned by
  something actually said, a label of up to six words naming the action
  and the thing it acts on.
- Two text controls (light/dark, and replay), no buttons styled as
  buttons. prefers-reduced-motion: no autoplay, land on the final state of
  the scene, which is the brief in the box.

THE TWO RENDERED IMAGES:
- og.png (1200×630) and apple-touch-icon.png (180×180) come from
  scripts/website/assets.html via node scripts/website/render.mjs. The og
  board must carry the current motto, "Save tokens", under the wordmark;
  it still reads "Every token earned" and is the one thing on the site
  that does. When you change it, change every page's og:image:alt to
  match, since the alt describes the image that exists.

VISUAL IDENTITY, AND THE REGISTER:
- Black-ish on white, the system sans, one link colour (the mascot's ink),
  rules between sections, tables with captions for every number, <pre> for
  the pipeline, the mascot at its natural size, dark only via
  prefers-color-scheme. The card figure is a captioned figure.
- No hero, no buttons outside the reproduced card, no gradients, shadows,
  glows, pills, sparkle glyphs, tracked-uppercase labels, card grids or
  toggles. If it looks like a generated landing page, it is wrong.
- The mascot is the only illustration. No stock photography, no icon rows,
  no purple-to-blue SaaS gradient. The product's gradient exists in the
  mascot and nowhere else on the page.

OPEN FOR YOUR WORK:
- How much of STORE-LISTING.md's detailed description to carry verbatim
  versus compress for a page — but its order (measured, Start fresh, one
  press) is the site's order.
- Whether the measured tables live on the overview or move to
  how-it-works, as long as the overview states the 9% against 3% and the
  brief's size.
- The shape of the figure's two scenes: how they hand over, whether they
  loop, how the heavy thread is suggested without a forty-message DOM.
- Whether notes/ stays a full by-version list or keeps only the entries a
  visitor needs, with the changelog linked for the rest.

DELIVERABLE:
Four hand-written static pages under publishing/website/, sharing one
stylesheet (site.css) and one script (demo.js), no build step, no external
request. index.html (overview), how-it-works/index.html, privacy/index.html,
notes/index.html, in directory form so Cloudflare Pages serves them at /,
/how-it-works/, /privacy/ and /notes/. Keep _headers, 404.html, robots.txt,
sitemap.xml; re-render og.png and apple-touch-icon.png from assets.html.
Responsive to a phone, semantic HTML (one h1 per page, landmarks, tables
with captions and scope, a skip link), keyboard navigable, AA contrast in
both schemes, prefers-reduced-motion honoured by the figure. Every number
read from the code at the time of writing; the version in the footer read
from the manifest; the non-affiliation line closing every page.

BEFORE YOU COMMIT ANYTHING: build the draft, run npm test and npm run build
to confirm nothing under extension/ or worker/ was touched by mistake, run
node scripts/website/render.mjs so the images match the page, and show the
draft for review. Do not git add, commit or push until it has been looked at
and approved — "build the site" is not standing permission to commit it.
Where something above still leaves a real ambiguity, ask; do not hold up a
draft over a small one.
```
