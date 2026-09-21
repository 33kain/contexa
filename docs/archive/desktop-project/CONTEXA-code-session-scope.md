# Code-session support — scope, from real DOM evidence
 
Probe run 2026-08-22 on `https://claude.ai/code/session_01ChrBkRXEQfHdrHwvpHiFRn`.
Everything below rests on that output, not on assumption. One gap remains and
is named in §7.
 
---
 
## 1. What the probe proved
 
| finding | value | consequence |
|---|---|---|
| URL | `claude.ai/code/session_…` | **Same origin.** `"matches": ["https://claude.ai/*"]` already covers it. No manifest change, no new host permission, no permission-related review risk. |
| `.font-claude-response` | **0** | The reply selector does not exist here. This alone stops `scan()` at its first line. |
| `[data-is-streaming]` | **none** | The end-of-turn signal does not exist here. |
| composer | `tiptap ProseMirror`, `aria-label="Prompt"`, 313px | **Already found by the existing chain**, and 313 > the 120px visibility floor. |
| transcript | `epitaxy-virtual-transcript`, `transcript-sizer`, `transcript-spacer`, `transcript-row` | **Virtualised list.** This is the whole difficulty. |
| reply body | `epitaxy-markdown` | Candidate replacement for `RESPONSE_SEL`. |
| composer / send | `code-prompt-input`, `code-prompt-send` | Stable testids, outside the virtual list. |
 
**Also worth noting the 0.9.27 guard behaved correctly.** With no
`data-is-streaming` present, `streamFlag` is null, the fast path is refused, and
the settle timer decides — exactly the fail-closed behaviour just shipped. The
script then finds zero replies and goes quiet. Nothing is broken; it is
declining to act on a surface it does not understand.
 
## 2. Three things already work
 
`findComposer()` resolves the Code composer today, via
`div[contenteditable="true"].ProseMirror`. `insertPrompt` should work unchanged,
because it targets ProseMirror through `execCommand('insertText')` — the same
editor family. And the whole extension is already injected there.
 
So insertion, the hardest half of the original build, is free on this surface.
 
## 3. The real problem: the transcript is virtualised
 
`transcript-sizer` and `transcript-spacer` mean rows are mounted and unmounted
as you scroll, and the container computes row heights to fake a scrollbar. Three
consequences, and they rule out the current approach rather than complicate it:
 
1. **An injected chip row would be destroyed** when its row recycles, or left
   orphaned when the row unmounts.
2. **`processed` (a WeakSet keyed on elements) stops working.** Unmounted rows
   are garbage-collected, so scrolling back re-fires the same reply — spending
   quota and duplicating rows.
3. **Worst: injecting into a row changes its measured height**, desyncing the
   virtualiser from its own calculations. That produces scroll jump and jank in
   the host page. CONTEXA's standing rule is that it goes quiet rather than
   break the page; this would break the page.
**Therefore the chip row must not live inside the transcript.**
 
## 4. The design
 
Two changes, both forced by §3 rather than chosen.
 
**Placement: chips render above the composer, not under the reply.** The
composer region is outside the virtual list, stable, and always visible. On this
surface the user is always at the bottom of a running session anyway, so the
row is exactly where attention already is.
 
**Done-signal: watch the composer, not the transcript.** A Code session emits
many rows per turn — tool steps, intermediate output — and firing per row would
be noise and would drain 20/day inside one session. The turn is finished when
the composer returns to idle. `code-prompt-send` is the observable: its
enabled/disabled state (or the send↔stop swap) marks the boundary. That signal
lives outside the virtual list, so virtualisation never touches it.
 
This also replaces `processed`: instead of "have I seen this element", the rule
becomes "has a new turn completed since the last fire", which survives row
recycling.
 
## 5. Implementation
 
`content.js` gains an ordered adapter list. First match wins; no match means
silence, exactly as today.
 
```
ADAPTERS = [
  { id: 'chat',                       // adapter one: today's behaviour, unchanged
    matches: () => document.querySelector('.font-claude-response') !== null,
    replySel: '.font-claude-response',
    isDone: el => { const w = el.closest('[data-is-streaming]');
                    return w ? w.getAttribute('data-is-streaming') === 'false' : null; },
    anchor:  el => el.closest(ROW_SEL) || el,
    place:   'after-reply' },
 
  { id: 'code',                       // adapter two: this surface
    matches: () => document.querySelector('[data-testid="epitaxy-virtual-transcript"]') !== null,
    replySel: '.epitaxy-markdown',
    isDone: () => /* composer idle — see §7 */,
    anchor:  () => document.querySelector('[data-testid="code-prompt-input"]').closest(...),
    place:   'above-composer' }
]
```
 
Adapter one keeps today's exact values so nothing currently working can regress;
a test pins that.
 
**Capture.** `captureText` needs no change — it walks whatever node it is given.
But only *mounted* rows exist, so the capture is the mounted `.epitaxy-markdown`
blocks in document order, tail-first up to the 6000-char window. If the reply is
long and partly scrolled out, we capture what is visible. That is honest and
already has a convention: the existing `CAPTURE_MARKER` tells the model its view
ends somewhere, and the same treatment applies.
 
**Rendering.** `shell()` currently does `anchor.after(holder)`. It gains a
placement mode so `above-composer` inserts before the composer container instead.
Shadow DOM, CSS and chip behaviour are untouched.
 
**Quota.** One fire per completed turn, never per row. Worth measuring in the
first session whether even that is too often for this surface.
 
## 6. Tests
 
- Adapter one still resolves against today's claude.ai fake DOM (regression).
- Adapter two selects `.epitaxy-markdown` and ignores `transcript-spacer`.
- Only one fire per turn boundary; scrolling does not re-fire.
- `place: 'above-composer'` inserts outside `[data-testid="epitaxy-virtual-transcript"]` — the anti-jank invariant, asserted structurally.
- Nothing is ever inserted inside a `transcript-row`.
## 7. The one remaining unknown
 
**How to detect "turn finished" and "which rows are the assistant's."** The probe
shows `code-prompt-send` and `epitaxy-origin-label` exist but not their states or
values. Both are needed and both are one small probe away — run mid-turn and
again once idle, and compare.
 
Until that lands, §4's done-signal is specified but not implemented.
 
## 8. Cost, honestly
 
This is a second renderer, not a selector swap: new placement path, new
lifecycle rule, new capture assembly, plus tests. Call it a solid day's work,
and a permanent one — a virtualiser's internals are exactly the kind of thing
that changes without notice, and this adapter has no positive contract with it.
 
And it serves developers, on a developer surface, days after the audience was
set to beginners. That does not make it wrong — the pull was real and it came
from your own hands — but it should be weighed against the 0.9.28 capability
moves, which are prompt-only, ship without review, and aim at the audience
actually chosen.