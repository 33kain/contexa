# The CHANGELOG voice

`CHANGELOG.md` is not a list of changes. It is the project's record of what was
*established* — what was believed, what turned out to be true, and what evidence
moved one to the other. Entries get re-read years later to answer "why is it like
this", which is why they carry measurements, name the wrong turns, and are honest
about what is still unknown.

The default a language model reaches for — a tidy bullet list under headings like
"Fixed" and "Improved" — is wrong here in a way that is obvious the moment it sits
next to a real entry. This file exists to make the target concrete.

---

## Shape

```markdown
## 0.9.71 — Extension + Worker

*One line, italic: the finding, not the change.*

<prose>

---
```

- The header names the artifacts that **materially changed**: `Extension`,
  `Extension + Worker`, or `Worker`. Both version numbers move regardless.
- The italic line is a thesis, not a summary. It states what was found.
- `###` subheads only when the entry is long enough to need them. Ones that recur
  and earn their place: `What 0.9.NN got wrong`, `Also in this release`,
  `Also seen, not fixed`.
- Every entry closes with `---` on its own line.

## The seven habits that make the voice

**1. The thesis is a claim, usually a correction.** Not "fixed the mascot
contrast" but:

> *The mascot's face was not too small. It was being inverted — and 0.9.69 made
> it worse by making the ink darker.*

> *The action gate was read for the first time. It was eating nine good clicks
> out of fourteen drops.*

**2. Evidence before conclusion.** Give the reader what you saw, then what it
forced. The 0.9.70 entry explains Chromium's force-dark brightness threshold, in
a table, before it says a single word about the fix — because the fix is
uninteresting once you know the threshold, and incomprehensible before.

**3. Numbers with provenance.** `14 drops in 36 moves`. `21.00:1` becoming
`1.00:1`. `1 failure in the 13 live requests`. Say where each came from — a
sweep, a scan, a field screenshot, a token trace.

**Never write a number you did not measure.** This is the failure mode this voice
invites: it *reads* as authoritative and quantitative, so imitating it produces
fabricated contrast ratios and invented counts that no one can distinguish from
real ones later. If you did not run it, either run it or write the sentence
without the number.

**4. Name the wrong turn.** Releases that correct an earlier release say so
directly, and treat the shape of the earlier failure as evidence:

> 0.9.69 read a field screenshot of washed-out pupils as an anti-aliasing problem
> at 40×34.5 px and darkened the ink […] The next screenshot from the same phone
> had **no pupils at all** […] That is not a fix decaying, it is a fix pointed
> the wrong way, and the direction of the failure was the diagnosis: darker in,
> lighter out.

**5. Record what was seen and not fixed.** A defect noticed during a release and
deliberately left alone belongs in the entry, with the reasoning and enough
diagnostics for the next occurrence to have a data point to sit beside. This is
what `### Also seen, not fixed` is for.

**6. Generalise, and name the trap.** Say what the rule is now, especially where
it is counter-intuitive:

> The rule is **asymmetric**, which is the trap worth naming: white is safe only
> as a flat fill (255 ≥ 150), and as a gradient stop its 255 clears 205 and
> inverts the whole eye to near-black.

**7. Honest reads, never victory laps.** Claim exactly what the evidence supports:

> Thinner, not empty — so the honest read is that this list has a long tail and
> the tail is worth re-reading occasionally, not that it is now complete.

## Register

Em dashes and bold for emphasis. Precise names for things — `extension/content.js`'s
inline trigger SVG, `gradientUnits="userSpaceOnUse"`, `SUPERSEDED_MODEL_DEFAULTS`
— never "the config" or "the relevant file". Tables when there are numbers to
compare. Code fences for real captured output. No marketing adjectives, no
"we're excited to", no exclamation marks.

A number that lives somewhere else stays there. Costs are derived in
`worker/README.md`; restating them in a second place is how two of them went
stale.

---

## Worked example — a short entry

The whole of 0.9.69. Note that it is entirely prose, has no bullet list, and
spends most of its length on how the defect was made reproducible at the desk:

```markdown
## 0.9.69 — Extension

*The mascot's face was disappearing at small sizes — reported from a real phone.*

The pupil circles (r=3.3, `#173b35`) and the mouth stroke (2px, `#0e6e63`) held
up fine at the 128px reference size, but a field screenshot of the in-page
trigger chip on mobile showed both washed toward the background — pupils
essentially gone, mouth barely a line. Rendering the 16px manifest icon next to
the 128px one made the same defect reproducible at the desk: the 16px face was
already close to featureless before any phone-specific compression touched it.

Pupils enlarged (3.3 → 3.8) and switched to pure black; the mouth stroke
widened (2 → 2.6) and darkened. Changed in both places the geometry is
duplicated — `extension/content.js`'s inline trigger SVG and
`store-assets/contexa-mascot-icon.svg` — then the manifest and store PNG
exports (16/32/48/128, plus the 512 store asset) were regenerated from the
updated source so all three stay pixel-identical, as before.

---
```

## Worked example — a defect left alone

From 0.9.68. This is the pattern for something you noticed but are not fixing:

```markdown
### Also seen, not fixed

One of the three verification runs returned **`bad_json`**:

    stop=end_turn  out=952  in=425  ceiling=2500  len=1963  hadJson=true  steps=5

Not truncation — the model stopped on its own, well inside the token ceiling,
and the payload opened as valid JSON. That is a **different defect** from
anything in this release and is left alone rather than folded in: 1 failure in
the 13 live requests across 0.9.67's sweep and verification. Recorded here so
the next occurrence has a first data point to sit beside, with the diagnostics
the worker already logs.
```

---

## What to avoid

- Bullet lists of changes (`- Fixed X`, `- Improved Y`). Almost no real entry
  uses them for the substance of a release.
- Restating the diff. The diff is in the commit; the entry says what it *means*.
- Fabricated or unsourced measurements. See habit 3.
- Claiming completeness — "now fully fixed", "all cases handled" — unless the
  evidence actually covers all cases, which it rarely does.
- Pastiche. These examples are here to calibrate register, not to be refilled
  with new nouns. If this release found nothing measurable and corrected no
  earlier belief, the entry is short and says so. A two-sentence honest entry
  beats a long one performing rigour it doesn't have.
