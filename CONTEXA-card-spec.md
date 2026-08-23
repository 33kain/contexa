# CONTEXA interview card — exact spec for the website mock

Extracted 2026-08-22 directly from the shipped `extension/content.js` (v0.9.32),
not from screenshots. This is source truth: build the mock from this and it IS
the real card. Screenshots are no longer needed for the website build.

Use the card's **own palette verbatim** inside the page, whatever the site's
direction is. The product's card should look like the product, not a re-skin —
that is the honest version of "show it working", and the real light palette
(warm white, terracotta accent) sits comfortably on `#FFFDF4`.

---

## 1. Palette and type (the card's own tokens, light theme)

```
surface        #FFFFFF     card background
surface2       #FAF9F5     hover fills
text           #3D3929     primary text
text2          #73726C     secondary text, placeholders, nav
border         #E8E6DE     inner hairlines (between options)
border2        #DEDCD1     outer card border
accent         #D97757     terracotta — hover states, the ✦, focus border
accent-soft    #F5E9E4     number-chip hover fill
```

Font: the system stack — `ui-sans-serif, -apple-system, "Segoe UI", Roboto,
Helvetica, Arial, sans-serif`. The card never uses a webfont, and the mock
shouldn't either; that contrast against the site's Archivo is authentic.

## 2. Structure, exactly as rendered

```
✦ CONTEXA                                ← label above the card, OUTSIDE it
┌─────────────────────────────────────────────┐
│ What's the occasion?        ‹ 1 of 3 › ×    │  ← header row, bottom hairline
├─────────────────────────────────────────────┤
│ [1]  Wedding / toast                     →  │  ← option rows, hairline between
├─────────────────────────────────────────────┤
│ [2]  Work, launch or product talk        →  │
├─────────────────────────────────────────────┤
│ [3]  Ceremony (award, farewell)          →  │
├─────────────────────────────────────────────┤
│ [ Something else…            ]      [Skip]  │  ← footer row
└─────────────────────────────────────────────┘
```

- **Label**: `✦ CONTEXA` — 9.5px, uppercase, letter-spacing .15em; the word is
  bold in accent (#D97757), the ✦ included. Sits above the card with 6px gap.
- **Card**: white, 1px solid #DEDCD1, **border-radius 12px**, overflow hidden,
  max-width 680px.
- **Header**: 10–12px padding; question at 13px weight 600; nav cluster right —
  `‹` `1 of 3` `›` `×` in 11px #73726C, arrow buttons 14px, prev disabled at
  30% opacity on the first question.
- **Option row**: full-width button, 9–12px padding, 13px text, 1px #E8E6DE
  hairline below. Leading **number chip**: 18×18px, radius 4, #FAF9F5 fill,
  10px #73726C digit. Trailing `→` in accent, **hidden until hover**.
- **Hover**: row fills #FAF9F5; number chip flips to #F5E9E4 fill with accent
  digit; the `→` fades in. Transitions ~140ms.
- **Footer**: text input (pill, 1px accent border when focused, placeholder
  "Something else…" in #73726C) + a `Skip` button — small, #FAF9F5 fill, 1px
  #DEDCD1, radius 6, 11px, hover turns accent.

## 3. Behaviour to reproduce

1. One question at a time. Answering — click, or **number key 1–4**, or typing
   in the field and Enter — advances the counter. `‹` goes back; a previous
   answer shows its row highlighted (`.opt.on` = #FAF9F5 fill).
2. **Skip** records a blank and advances. Skipping everything produces nothing
   — the real card refuses to compose from zero answers.
3. After the last answer, the card body swaps to a **busy line**: the text
   `Writing your prompt…` at 12px #73726C, pulsing (opacity .55→1→.55, ~1.4s
   loop). Keep this beat in the mock — a beat of honest latency reads as real.
4. Then the composed prompt appears in the **message box below the card**. The
   real product inserts it complete; the mock may type it on for drama, but it
   must end with the visitor clicking the send button themselves. **Nothing
   ever sends itself** — that is a product guarantee, not a styling choice.
5. The card entrance: fades in and rises 4px over ~280ms (`opacity 0→1`,
   `translateY(4px)→0`). It appears above the message box, not under the reply.
6. `×` dismisses. In the real product this falls back to a small dashed chip
   reading `✎ Rough ask…`; the mock can simply restart instead.

## 4. The message box in the mock

Generic on purpose: a rounded rectangle with placeholder text and a send
button. **It must not imitate claude.ai's actual composer** — no Claude
branding, no model picker, no Anthropic styling. The card is CONTEXA's own UI
and is copied exactly; the surface it sits on is deliberately anonymous.

## 5. A good demo script (real shapes, safe content)

Q1 `What's the occasion?` — Wedding / toast · Work, launch or product talk ·
Ceremony (award, farewell, graduation)
Q2 `How long should it run?` — ~2 min (short toast) · ~5 min · ~10–15 min
Q3 `Anything to include?` — A story about the couple · A thank-you list ·
Keep it simple

Composed prompt (types into the box):
`Write a best-man toast, about 2 minutes spoken. Build it around one story
about the couple — warm, a little funny, never embarrassing. Assume: English.
End on a toast everyone can raise a glass to.`

Note the `Assume:` line — the real product marks what it guessed so the user
can strike it. Keeping one in the demo is honest and quietly shows the safety
feature.
