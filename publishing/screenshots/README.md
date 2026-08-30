# Screenshots — current as of v0.9.56

These five PNGs, all exactly 1280×800, show the actual product: the on-demand
trigger, the click-only interview, the composed prompt, dark mode, and the
settings page. Order for the listing: `1-interview` → `2-composed` →
`3-trigger` → `4-dark` → `5-settings`; the first is what most people judge the
listing by.

**How they were made.** The real extension, unpacked and loaded into a real
Chromium instance (Playwright + a persistent context with `--load-extension`),
driven against a hand-built mock claude.ai page — same method the project's
own `PUBLISHING-CHECKLIST.md` describes for the original (now-lost) set: "the
real extension running, but on a local mock page built for the purpose." The
hosted backend call was pointed at a small local server returning realistic
questions/prompt text instead of the real worker, so no API key or network
call to Anthropic was needed to produce them.

**What that means for submission.** These are honest screenshots of the real
UI — not a mockup, not hand-drawn — but the surrounding page is a stand-in for
claude.ai, not claude.ai itself. The checklist's own caution still applies:
compare against a real claude.ai session before submitting, in case anything
about the live site's layout has since changed in a way that affects how
CONTEXA mounts. If it still matches, these are good to upload as-is.

The previous four (`1-chips.png` etc., chip-era, explicitly marked
"DO NOT UPLOAD") were removed — they showed a product that stopped existing
in 0.9.30. Their history is still in git if anyone ever needs to see them.
