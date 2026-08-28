# CONTEXA — content.js spec: mascot trigger + interview card skin

Written 2026-08-27 in the design chat, from decisions the owner locked there.
This is the handover to the build chat. Suggested repo home:
`claude/CONTEXA-content-spec.md`.

**Self-contained on purpose:** every SVG path, keyframe and copy string is
embedded verbatim below. The design sandbox rolls back without warning; this
document must not depend on it. The visual source of truth mirrored here is
`contexa-mascot-blob.html` (final character, owner-confirmed) and
`contexa-interview-form.html` (locked card form, owner: "Bože savršeno je").

---

## §0 — What this is, and is not

**Is:** a visual-only change to `content.js`/CSS — the trigger chip becomes the
mascot, and the response card is skinned to the locked form. Same handlers,
same call semantics, same conditions, same wire, same prompts.

**Is not:** a behavior change. Nothing here touches when the call fires (click
only, nothing automatic — 0.9.53 law), what comes back (interview / moves row /
compose / text box), the wire schema, or either system prompt. Because it is
content-only, it ships **alone on the store clock** with no wrangler coupling —
and it must stay that way: if during implementation anything here seems to
require a wire or prompt edit, stop and re-scope, because that couples two
release clocks.

**No linter, no marking, no rewriting** appears anywhere in this work — that is
Squiggle, a different extension. Lint-anything in this tree is a regression.

---

## §1 — The mascot trigger

### 1a. Role

The mascot **is the trigger** (the star role): it renders exactly where and
exactly when the current trigger chip renders today — same slot, same mount
conditions, same click handler, same "spends one call on click" semantics. No
new visibility conditions in either direction. Its appearance is pure DOM/CSS;
**no model call, no fetch, nothing leaves the page before a click.**

Locate the current trigger **structurally** (the control in the row whose click
starts the questions call), not by matching its label text — the label is about
to change, and text-matching detectors have a three-strikes record in this
project.

### 1b. Copy — a deliberate label change, with the Defect F check done

- Trigger (mascot) hover/focus bubble: **`What now? ✦`** — owner-approved.
  This *replaces* the shipped `✦ What do I say next?`.
- Fifth chip (pencil): **`✎ Type & create magic`** — **unchanged. Do not touch.**

Defect F check: the two labels remain clearly distinct in words and glyph
(star asks, pencil types). Expected test behavior:

- The assertion that **compares** the two labels (inequality) must keep
  passing untouched. It is the load-bearing one.
- Any assertion pinning the trigger label **verbatim** to
  `✦ What do I say next?` will fire. Read it (Defect C), then update it to the
  new string. Do not loosen the comparison assertion to make a verbatim one
  pass.

### 1c. The character — final SVG, verbatim

Ship inline (a single JS/HTML string constant); no external asset, no
`web_accessible_resources` entry needed for it. One source constant — the icon
files in the manifest are a separate export task and are out of scope here.

```html
<svg width="58" height="50" viewBox="0 0 58 50" aria-hidden="true">
  <defs><linearGradient id="ctxaMg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2cc4ae"/><stop offset="1" stop-color="#15a594"/>
  </linearGradient></defs>
  <path d="M29 3 C43 3 53 12 53 26 L53 50 L5 50 L5 26 C5 12 15 3 29 3 Z" fill="url(#ctxaMg)"/>
  <g class="ctxa-mas-pup">
    <g><ellipse cx="21" cy="25.5" rx="7.4" ry="8.6" fill="#fff"/>
       <circle cx="22.9" cy="27.2" r="3.3" fill="#173b35"/>
       <circle cx="21.9" cy="26.1" r="1.2" fill="#fff" opacity=".95"/></g>
    <g class="ctxa-mas-wink"><ellipse cx="37" cy="25.5" rx="7.4" ry="8.6" fill="#fff"/>
       <circle cx="38.9" cy="27.2" r="3.3" fill="#173b35"/>
       <circle cx="37.9" cy="26.1" r="1.2" fill="#fff" opacity=".95"/></g>
  </g>
  <path d="M25 37 Q29 39.5 33 37" stroke="#0e6e63" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse class="ctxa-mas-whisp" cx="41" cy="37" rx="4.6" ry="3.4" fill="#2cc4ae"/>
</svg>
```

Character law (from the brief, encoded so nobody "improves" it): body shape is
locked; eyes are baby-schema with catchlights; **winks, never blinks** — one
eye (viewer-right), rare and snappy; no idle breathing; no lean-in on hover
(offered, rejected); teal is the mascot's color and the mascot is **the one
loud element in the page** — everything else follows claude.ai (§2).

### 1d. States — keyframes verbatim

```css
/* ENTRANCE — once, when the trigger mounts after a completed reply */
.ctxa-mas{animation:ctxa-popin .55s cubic-bezier(.3,1.2,.4,1);transform-origin:50% 100%}
@keyframes ctxa-popin{0%{transform:scale(0)}62%{transform:scale(1.12,.86)}
                      82%{transform:scale(.95,1.06)}100%{transform:scale(1)}}

/* IDLE — rare snappy wink + occasional glance; nothing else */
.ctxa-mas-wink{animation:ctxa-winkIdle 6s infinite;transform-box:fill-box;transform-origin:center}
@keyframes ctxa-winkIdle{0%,93%,100%{transform:scaleY(1)}94.5%,96.5%{transform:scaleY(.08)}}
.ctxa-mas-pup{animation:ctxa-glance 8s ease-in-out infinite}
@keyframes ctxa-glance{0%,72%,100%{transform:translateX(0)}80%,90%{transform:translateX(1.5px)}}

/* HOVER / FOCUS — winks at you, hand to mouth, bubble whispers */
.ctxa-mas:hover .ctxa-mas-wink,
.ctxa-mas:focus-visible .ctxa-mas-wink{animation:ctxa-winkOnce .4s ease}
@keyframes ctxa-winkOnce{0%,100%{transform:scaleY(1)}35%,65%{transform:scaleY(.08)}}
.ctxa-mas-whisp{opacity:0;transition:.2s}
.ctxa-mas:hover .ctxa-mas-whisp,
.ctxa-mas:focus-visible .ctxa-mas-whisp{opacity:1}

/* CLICK — small hop; then the existing flow runs unchanged */
.ctxa-mas.ctxa-hop{animation:ctxa-hop .35s ease}
@keyframes ctxa-hop{40%{transform:translateY(-8px)}}

/* REDUCED MOTION — entrance becomes a fade, idle animations off */
@media (prefers-reduced-motion:reduce){
  .ctxa-mas{animation:ctxa-fadein .3s ease}
  @keyframes ctxa-fadein{from{opacity:0}to{opacity:1}}
  .ctxa-mas-wink,.ctxa-mas-pup{animation:none}
}
```

Bubble: appears on hover **and** `:focus-visible` (keyboard users get the
whisper too); `pointer-events:none` so it never intercepts clicks; neutral
claude.ai-matching surface with the `✦` in teal `#2cc4ae` as the only accent.

During the in-flight call after a click: the mascot stays put and static (idle
animations may keep running); the existing loading presentation is unchanged.

### 1e. Semantics and hygiene

- The mascot is a **button**: `role`/element `button`, `aria-label="What now?"`,
  focusable, Enter/Space fire the same handler as click, visible focus ring
  (teal, 2px, offset — the one other place page teal is allowed).
- **Class discipline:** everything under a `ctxa-mas-*` prefix. The mascot and
  the pencil chip share **no class and no label** — that pair has cost two
  releases; treat it as law, and keep the label-comparison assertion green.
- **Logging:** no new mount log. The existing mount line (version + `top=`
  geometry) must remain the single mount record — Contaminants 1 and 3 depend
  on it. Any genuinely new line uses the `[CONTEXA]` prefix.
- **Neighbors:** Grammarly and Squiggle draw into the same page. The mascot
  anchors to the reply/trigger row, never inside the composer; keep z-index
  modest (above page text, below claude.ai overlays/modals); no global styles —
  everything scoped to `ctxa-` selectors.
- claude.ai markup can shift under the SPA; the mascot rides the same
  mount/unmount logic as the current chip, including the existing
  `[data-contexa]` cleanup path.

---

## §2 — The interview card skin (locked form; behavior byte-identical)

The card's **behavior does not change**: one question at a time, click an
answer, composed prompt lands in the message box visible before send, CONTEXA
never sends. This section only skins it to the locked mockup.

Form law from the mockup:

- **Pills, not sentences:** options are short labels (2–4 words), horizontal
  with wrap. **Label ≠ composed** — clicking a short label composes the full
  sentence into the box; the card never shows the long form.
- **Progress dots** (`•• ∘`), one per question, current filled; no `N of M`
  text. (Also a cheap visual discriminator against claude.ai's own Cowork
  question widget, which uses `N of M`.)
- **One question visible at a time**; answered questions collapse.
- **Quiet hat:** the card follows claude.ai — neutral surfaces, borders,
  serif/sans exactly as the host; **no teal on the card** except the small `✦`
  in the `✦ CONTEXA` marker above it. Sample live claude.ai values at build
  time rather than trusting mockup hexes; the mockup's palette is an
  approximation of the host, and the host is the truth (Karpathy test: a
  screenshot of the card should read as claude.ai).
- The `✦ CONTEXA` marker above the card stays — it is a documented structural
  discriminator (Contaminant 2), not decoration.

The other three response shapes — **moves row** (up to four earned chips),
**one-click compose**, **text box** — take the same skin tokens (pill style,
surfaces) with zero behavior change. The pencil chip keeps its label, its
classes, and its box.

---

## §3 — Tests and field protocol

Source assertions cannot see a click, and this change is *entirely* about
interaction surface — so the suite going green is necessary and nowhere near
sufficient.

**Assertions:**
- Update any verbatim trigger-label assertion to `What now? ✦`.
- Keep the trigger≠pencil comparison assertion untouched and green.
- Position/behavior assertions on prompts must not be touched at all — if one
  fires from this change, the change has left its scope.
- New assertions, if any, pin **structure** (mascot button exists in the
  trigger slot; bubble not pointer-interactive), not text.

**Field test, own-key, before store submit:**
1. Unpacked build + saved key. Read the **version off the mount line**; confirm
   **one** build logging; discriminate chats by mount `top=` geometry.
2. Fresh reply → mascot pops once (entrance), idles with rare wink; hover →
   wink + bubble `What now? ✦`; keyboard focus → same bubble; Enter fires.
3. Click spends **exactly one** call (network/log), and each response shape is
   reached on suitable replies: interview, moves row, compose, text box. A
   reply that earns nothing still earns nothing — the mascot must not change
   any outcome, only the doorknob.
4. Coexistence: Grammarly ON, Squiggle installed — no visual fights in or near
   the composer; check the extension id + `[CONTEXA]` prefix before attributing
   any console line.
5. `prefers-reduced-motion` → fade entrance, no idle animation.
6. Cowork sanity: the manifest matches `claude.ai/*`, so the mascot renders
   there too; confirm nothing overlaps claude.ai's own question widget beyond
   what the card already does today (known, deliberately unfixed).

**Store follow-through (separate task, flagged so it isn't lost):** every store
screenshot currently shows the old chip/card; after this ships, the listing
assets are stale until the mascot store package lands
(`claude/CONTEXA-store-listing.md` checklist applies).

---

## §4 — Out of scope, by name

Icon export (manifest icons from the blob face), store assets, website, any
prompt edit (`QUESTIONS_SYSTEM` voice work has its own spec:
`claude/CONTEXA-voice-spec.md`), wire schema, worker, Squiggle.
