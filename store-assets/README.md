# store-assets

Brand, marketing, and store-listing images. Nothing here is loaded by the
extension or the worker at runtime — the shipped extension icons live in
`extension/icons/`.

- `store-icon-128.png`, `promo-tile-440x280.png`, `promo-marquee-1400x560.png` —
  Chrome Web Store listing images.
- `contexa-mascot-icon-{16,32,48,128,512}.png`, `contexa-mascot-icon.svg` — the
  mascot's master export set (added 0.9.55). `contexa-mascot-icon-128.png` is
  byte-identical to `extension/icons/icon128.png`; this set is the source the
  shipped extension icons were exported from, kept here for future exports
  (listing updates, social previews, sizes the extension itself doesn't need).
- `contexa-demo.gif` — the root README's hero. **Stale as of 2026-08-31:** it
  shows the interview card answering three questions and composing a prompt one
  click at a time, and the interview no longer exists. It was a faithful
  recreation of the UI when made (same markup, CSS and animation timings as
  `content.js`) and is no longer one. Needs remaking against the mined row before
  it is used anywhere public; `publishing/screenshots/2-moves.png` is the current
  shape, not a literal screen recording of the extension running on
  claude.ai — good for the README and social use, but it is **not** a
  substitute for real Chrome Web Store screenshots. See
  `publishing/screenshots/README.md` for what those actually require.
