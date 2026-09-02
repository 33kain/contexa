# scripts/promo

Generates the two Chrome Web Store promo tiles in `store-assets/`:

```bash
node scripts/promo/render.mjs
```

| File | Size | Store slot |
|---|---|---|
| `store-assets/promo-tile-440x280.png` | 440×280 | small promo tile |
| `store-assets/promo-marquee-1400x560.png` | 1400×560 | marquee promo tile |

Needs Playwright and a Chromium (present in this repo's dev image; otherwise
`npm i -g playwright && npx playwright install chromium`). Runs headless — no
Xvfb, unlike the screenshot harness, because nothing here loads the extension.
Not part of `npm test` or `npm run build`.

- `tiles.html` — the two boards, as HTML. The product parts (the mascot, the
  `✦ CONTEXA` label, the row of moves, the composed prompt) are drawn with
  the tokens `content.js` uses, and the session and moves are the same canned
  Lisbon thread the screenshots show (`MOVES` in
  `scripts/screenshots/capture.mjs`), so the tiles and the screenshots
  describe one product. Copy comes from `publishing/STORE-LISTING.md`.
- `render.mjs` — screenshots each board, checks the exact dimensions, checks
  that nothing spilled past an edge or onto the footer, and re-encodes the
  PNG as 24-bit RGB with no alpha channel (what the store asks for, and not
  what Chromium writes on its own).

## Why this exists

The first tiles were hand-made PNGs with nothing behind them. The product
changed under them — the interview card they showed was deleted at 0.9.58 —
and with no source to edit they went on advertising a mechanism that no
longer existed until 2026-09-02. Do not retouch the PNGs; change
`tiles.html` and re-run, and update the "Rebuilt" line in
`store-assets/README.md`.

When the label rule, the move count, the card or the listing copy changes,
this file has to change with it. A re-run alone reproduces whatever the HTML
says.
