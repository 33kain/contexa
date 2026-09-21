# CONTEXA — pre-launch audit (2026-08-23)
 
**HISTORICAL, 2026-09-01.** Pre-dates the 0.9.58 history-mining pivot; the
0.9.46-era product this audited no longer exists in this shape. Kept as a
record of the audit method, not as current state — for current state read
`NEXT-SUBMISSION.md` and `STORELISTING.md`.
 
Run before the 0.9.46 store submission. **Two blockers, three defects, all
found by looking at surfaces rather than at code.**
 
The pattern is the same one that ran through the whole day: **the product moved
and its descriptions didn't.** Chips were replaced by the interview in 0.9.30.
Sixteen releases later, three separate surfaces still describe chips.
 
---
 
# BLOCKERS — fix before submitting
 
## B1. The settings page describes a product that no longer exists
 
`extension/options.html`, the first thing a new user reads after install:
 
> *"When the answer finishes, **a row of suggestions appears under it**."*
> *"Each one is a good next thing to ask."*
> *"Click one and the full message is written into your message box."*
 
Every sentence is chip-era. And **"under it" was wrong from 0.9.30**, when the
card moved above the composer.
 
The current product asks **one question at a time**, with the answers written
for you, and composes the prompt only at the end. Someone reading this page will
look for a row of suggestions and not find one.
 
**Severity: highest of anything found.** It ships inside the package, it is the
onboarding surface, and no test covers its prose — the existing options tests
check ids, save behaviour and the quota number, never the description.
 
## B2. The only screenshots in the repo are chip-era
 
`publishing/screenshots/` contains `1-chips.png`, `2-inserted.png`, `3-dark.png`,
`4-settings.png`. `1-chips.png` shows five chips in a row under `✦ CONTEXA`.
 
The ten current 1280×800 screenshots built on 2026-08-22 are **not in
`C:\Users\Q\contexa`** — they were delivered into the conversation and live
somewhere else on the owner's disk.
 
**Owner said "I have added screenshots" but not which ones.** If they were taken
from the repo, the store now advertises a mechanism that was removed sixteen
releases ago. **Verify what is live in the dashboard before submitting.**
 
Fixed on 2026-08-23: the **promo tiles** had exactly this defect — the 440×280
said *"Next-step prompts, right where you type"* over three chips, and the
1400×560 had a literal `SUGGESTED NEXT STEPS` header over five. Both rebuilt to
show the interview.
 
---
 
# DEFECTS — real, none urgent
 
## D1. A hidden card still takes keyboard focus
 
`.wrap.away` sets `opacity:0`, `pointer-events:none`, `max-height:0`,
`overflow:hidden` — and **no `visibility`**. Clipped content stays focusable, so
Tab can land on a button inside a card the reader cannot see.
 
Worse, it self-amplifies: focus inside the shadow root makes `busy()` true, which
**forces the card visible again**. So tabbing through the page can make a hidden
card pop open.
 
Fix is one declaration — `visibility:hidden` on `.away`, with a transition delay
so it does not cut the fade short.
 
## D2. Theme is decided once, at mount
 
`wrap.dataset.theme = isDark() ? 'dark' : 'light'` runs in `shell()` and never
again. Switch claude.ai between light and dark while a card is open and the card
keeps the old palette until the next reply.
 
Cosmetic, and the fix is a `matchMedia` listener — but worth knowing before
someone reports it as a rendering bug.
 
## D3. The collapse animation does not animate
 
`.wrap` has no base `max-height`, so it computes to `none`. **`none → 0` is not
interpolable**, so the height snaps while `opacity` and `transform` spend 0.22s
fading an element that already has zero height.
 
The card therefore hard-cuts in both directions. Under the 0.9.46 rule that is
arguably fine — it hides for long stretches now, not per-scroll — but the CSS
claims a fold it never performs. Either give `.wrap` an explicit `max-height`
large enough for a four-option card, or drop `max-height` from the transition
list and stop implying it.
 
---
 
# WHAT IS CORRECT
 
- **No dead code from four watcher rewrites.** `SETTLE_MS`, `SELF_QUIET_MS`,
  `quietUntil` are gone. The `settleTimer` that remains is the streaming-settle
  debounce in the mutation observer, unrelated and still in use.
- **No timers in the watcher**, as the 0.9.46 invariant requires.
- **The quota story is consistent**: worker `DEVICE_DAILY_LIMIT = 20`, every
  surface says 10 a day, because one interview spends two calls.
- **Promo tiles, store description and the listing doc** all now describe the
  interview.
- **`hiddenForSession` leaks nothing durable** — the orphaned scroll listener
  unbinds itself on the next scroll via the `isConnected` check.
---
 
# ORDER OF WORK
 
1. **Check the dashboard**: which screenshots are live? (B2)
2. **Rewrite the settings-page copy** (B1) — it ships in the package, so it must
   go in before the submission, not after.
3. Submit, upload the two rebuilt tiles, wait for approval, then paste the
   description.
4. D1 whenever convenient; D2 and D3 are polish.
**And add a test for B1's class.** The options tests check ids and numbers and
never read the prose, which is why a sentence describing a dead mechanism
survived sixteen releases. `LISTING.md` has the same problem and is already
queued.