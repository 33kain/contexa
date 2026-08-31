# The 0.9.68 store push — handover

**Written 2026-08-31, at the end of the session that produced 0.9.58 → 0.9.68.**
The code work is finished and deployed. What remains is the store, and it was
deliberately left for a fresh session with a person at a browser.

Read this first, then `SUBMISSION.md` for the four fields a reviewer reads.

---

## Where things actually stand

| | version | state |
|---|---|---|
| Chrome Web Store listing | **0.9.57** | live, public, eleven versions behind |
| Package built and ready | **0.9.68** | `contexa-v0.9.68.zip` at the repo root |
| Cloudflare Worker | **0.9.68** | deployed and verified on `/v1/health` |
| `SUBMISSION.md` declarations | 0.9.68 | corrected 2026-08-31 |
| `publishing/PRIVACY.md` | 0.9.68 | corrected 2026-08-31 |
| **The published privacy gist** | **pre-0.9.53** | **stale — see below** |
| Store screenshots | moves-era | need retaking against a live session |

`npm test` and `npm run build` are green; the zip's internal manifest reads
0.9.68 (checked, not assumed).

---

## 1. The privacy gist — do this first

**Editing `publishing/PRIVACY.md` changed nothing that a user can see.** The
policy the listing points at is a **gist**, and it still holds pre-0.9.53 text.
Find the URL in the Privacy tab of the developer dashboard, edit that gist, paste
the current `publishing/PRIVACY.md`.

This is not housekeeping. The old text was stale in a way that was in our favour
(it claimed data was sent when a reply finished, when in fact nothing is sent
until the button is pressed). **It is now also stale in the other direction**, and
that is the direction that matters: it said

> *"CONTEXA does not read your conversation history"*

which is precisely what the product has done since the history-mining pivot. The
corrected file says what actually happens, states the bounds, and carries a dated
note explaining the change — because the policy's own "Changes to this policy"
section promises exactly that for a material change, and widening what leaves the
browser is material.

**Until the gist is replaced, the published policy contradicts the extension.**

---

## 2. Screenshots

Five PNGs, 1280×800, in `publishing/screenshots/`. The current set is already
moves-era — `1-moves`, `2-composed`, `3-trigger`, `4-light`, `5-settings` — so
this is a refresh, not a first take.

There is a working harness:

```bash
xvfb-run -a node scripts/screenshots/capture.mjs
```

It loads the **real, unmodified** `extension/` into Chromium, redirects
`claude.ai` and the worker hostname at the network layer to a local server,
asserts the card's geometry before every shutter, and writes the five frames. It
is committed precisely so the next person can re-run it rather than guess.

**But read `scripts/screenshots/README.md` before relying on it.** Its own words:
the page is a mock of the DOM contract, not claude.ai, and the model output is
canned — so the frames are honest about layout and behaviour but are *not*
evidence that the selectors still match the real site today. Both READMEs say to
retake against a live session before submitting.

That is the reason this half is a person's job and not a script's. Run the
harness if you want a clean baseline; take the submitted frames from a real
conversation.

---

## 3. The listing copy — verify before pasting anything

The public description lives in `claude/CONTEXA-store-listing.md`, **outside this
repo**. Nobody in this session could see it, so nobody can tell you whether it is
current.

Two files in this repo look like listing copy and are **tombstones**:

- `LISTING.md` — chip-era, marked "This file is NOT the listing"
- `publishing/STORE-LISTING.md` — chip-era, marked superseded

`publishing/PUBLISHING-CHECKLIST.md` says explicitly: do not paste from either.

**What to check on the live listing:** that it does not still describe five
auto-firing chips, an interview, or questions the user answers by clicking. All
three mechanisms are gone. The product is one button and up to four send-ready
messages.

---

## 4. What to say in the update notes

Eleven versions. The CHANGELOG is the source; the short version of what a user
would notice:

- **0.9.58** — the pivot: reads your side of the whole conversation instead of
  the last exchange, and returns up to four complete messages instead of an
  interview.
- **0.9.59–0.9.62** — move quality; grounding split so a row that merely
  transcribes the reply can be told from one that read the session.
- **0.9.63** — every move must be a doable click. Anything that only talks
  *about* the material is dropped rather than shown.
- **0.9.64–0.9.65** — an empty row says *why* it is empty instead of looking like
  a failure.
- **0.9.66** — removed a filter that was measured to be deleting good rows.
- **0.9.67–0.9.68** — read the filter's log and found it silently eating Serbian
  verbs it did not know; added them.

---

## Still outstanding, unrelated to the store

- **Rotate the Cloudflare API token.** It was pasted into a chat transcript on
  2026-08-31 and is therefore compromised. It was never written to any file in
  this repo (verified), but it needs rotating regardless.
- Git tags `v0.9.58` … `v0.9.68` were never pushed — the session's credentials
  were refused on `refs/tags/*`. The commits are all on `main`.
- **The field rate of the action gate is still unmeasured.** 0.9.67 found which
  verbs it drops using ten invented sessions; how often it bites on real threads
  needs real clicks with `wrangler tail` attached. See CHANGELOG 0.9.67 "Still
  open".
