# store-assets

Brand and store-listing images. Nothing here is loaded by the extension or the
worker at runtime — the shipped extension icons live in `extension/icons/`.

- `store-icon-128.png`, `promo-tile-440x280.png`, `promo-marquee-1400x560.png` —
  Chrome Web Store listing images.
- `contexa-mascot-icon-{16,32,48,128,512}.png`, `contexa-mascot-icon.svg` — the
  mascot's master export set (added 0.9.55). `contexa-mascot-icon-128.png` is
  byte-identical to `extension/icons/icon128.png`; this set is the source the
  shipped extension icons were exported from, kept here for future exports
  (listing updates, social previews, sizes the extension itself doesn't need).
