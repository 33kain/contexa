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
| **The privacy URL the listing points at** | **repo file** | **done 2026-09-01 — see step 1** |
| Store screenshots | moves-era | need retaking against a live session |

`npm test` and `npm run build` are green; the zip's internal manifest reads
0.9.68 (checked, not assumed).

---

## 1. Repoint the privacy policy URL — done 2026-09-01

Privacy tab → *Privacy policy URL* now points at the repo file instead of the
stale pre-0.9.53 gist:

```
https://github.com/33kain/contexa/blob/main/publishing/PRIVACY.md
```

The repo is public, that URL renders the policy as formatted markdown, and it
is serving the corrected 0.9.68 text. This makes `publishing/PRIVACY.md` the
single source: it updates when you push, so the policy and the code cannot
describe different products again — the trade is that the published policy is
whatever is on `main` at that moment, which is the point. See `SUBMISSION.md`
for the full history of why the gist was wrong in both directions.

**Nothing further to do here.** The remaining outstanding item in this file is
the screenshots (§2) and verifying the live listing copy (§3).

---

## 2. Screenshots

**Regenerated 2026-08-31 against 0.9.68 — they are current.** Five PNGs,
1280×800, in `publishing/screenshots/`: `1-moves`, `2-composed`, `3-trigger`,
`4-light`, `5-settings`.

Two things were wrong before that run, worth knowing since both are invisible
from the images themselves:

- **The store has never had these.** `publishing/screenshots/` was first created
  at 0.9.58, *after* 0.9.57 shipped. Whatever the live listing shows predates
  the directory, which puts it in the chip/interview era — a product that no
  longer exists. Uploading this set is the single biggest correction available
  to the listing.
- **The old set showed the old label rule.** Captured at 0.9.58, before commit
  `3267e4c` widened labels from "two to four words" to "up to six words, naming
  the action and the thing it acts on". The frames read "Build the itinerary",
  "Add day trips" — the exact shape that rule calls a defect.

The harness's canned `MOVES` constant was rewritten to match, which is the part
a plain re-run would have missed.

The harness itself:

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

**So what to actually do.** The set in the repo is accurate to 0.9.68 and is a
large improvement on chip-era frames advertising a deleted mechanism — upload it
rather than let the current listing stand while waiting for something better.
Retaking against a live claude.ai is the upgrade, not the prerequisite: it is
the only thing that proves the selectors still match the real site, and the only
frames with real model output. Do it when you have a browser and a conversation
worth photographing.

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
