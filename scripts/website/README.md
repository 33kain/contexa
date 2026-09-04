# scripts/website

Source for the two rendered images the product site ships, so they can be
edited and re-run rather than retouched:

- `assets.html` — the boards: the 1200×630 social preview and the 180×180
  touch icon, drawn with the site's own tokens and the mascot SVG.
- `render.mjs` — `node scripts/website/render.mjs` renders them to
  `publishing/website/og.png` and `publishing/website/apple-touch-icon.png`,
  and fails on a wrong size instead of writing it.

Needs Playwright and a Chromium, found the same way `scripts/promo/render.mjs`
finds them (`NODE_PATH` or a global install; set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to point at a specific browser binary).
Everything else on the site is hand-written HTML and CSS with no build step;
see `publishing/website/`.
