# scripts/social

Renders the social-post image for `publishing/community-posts/` from
`social-card.html` (mascot, the shipped `What now? ✦` bubble, the row of
moves and a composed prompt, rebuilt in HTML with the product's own chip
styles rather than retouched from a screenshot).

```
node scripts/social/render.mjs
```

Writes `publishing/community-posts/contexa-social-1200x675.png` at 2× (2400×1350).
Needs Playwright (global install is fine, same resolver as `screenshots/`);
headless, no Xvfb. Edit the HTML, not the PNG. Coral `#D97757` is claude.ai's
send button and stays out of it.
