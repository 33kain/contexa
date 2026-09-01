# CONTEXA — store listing

**The listing copy is `publishing/STORE-LISTING.md`.** Paste from there.

## Why this file is now three lines

It used to be a tombstone arguing that the copy belonged *outside* the repo, in
a `claude/` project doc, because "a file that duplicates the listing will drift
from it, and a drifted listing is worse than no file at all."

The premise was right. The conclusion was backwards, and 2026-08-31 showed how:
with the copy outside, nobody working in the repo could read it. At 0.9.68 — with
the store still on 0.9.57, eleven versions behind — nobody could say whether the
live listing was still advertising suggestion chips, a mechanism deleted at
0.9.30. An unverifiable copy is not protection from drift; it is drift you
cannot see.

So the copy moved in, next to the code that has to match it, on the same
reasoning that moved the privacy policy URL to `publishing/PRIVACY.md` the same
day: **one copy, versioned with the release that changes it.** The rule was never
"keep it elsewhere". It was "keep one".

The naming and trademark analysis this file used to carry lives in
`SUBMISSION.md` § "The name, and the one policy call worth remembering", where
it was already duplicated.
