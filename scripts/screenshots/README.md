# scripts/screenshots

Generates the five Chrome Web Store screenshots in `publishing/screenshots/`.

```bash
xvfb-run -a node scripts/screenshots/capture.mjs
```

Needs Playwright and a Chromium (both already present in this repo's dev
image; otherwise `npm i -g playwright && npx playwright install chromium`).
Not part of `npm test` or `npm run build` — it drives a browser, and nothing
shipped depends on it.

- `capture.mjs` — the driver. Launches Chromium with the real `extension/`
  loaded, walks the product through five states, asserts the card's geometry,
  and writes the PNGs.
- `mock-claude.html` — a mock of the DOM contract `content.js` reads. Read its
  header comment before editing: the nesting depth is load-bearing.

## Why it works without touching the extension

Two hostnames are redirected at the network layer to one local HTTPS server:

```
claude.ai                            -> mock-claude.html
contexa-api.michu110899.workers.dev  -> a canned {moves:[...]} response
```

`--host-resolver-rules` does the redirect, a self-signed cert plus
`--ignore-certificate-errors` gets past TLS, and `--no-proxy-server` keeps this
container's egress proxy out of the path. Because the page genuinely *is*
`https://claude.ai/`, the content script injects on its own real match pattern,
and `background.js` fetches its own real baked `DEFAULT_PROXY_URL`. Nothing in
`extension/` is stubbed, patched, or copied.

What is *not* real: the page is a mock of the DOM contract, not claude.ai, and
the model output is canned. Retake against a live session before submitting —
the checklist says so and should keep saying so.

## The guard

`assertCardGeometry()` runs before every screenshot that contains a card, and
fails the whole capture rather than writing a misleading frame. It checks the
two things the layout can get wrong:

- the card is aligned with the message box (not flush against the viewport edge)
- the card sits directly above it (not adrift in dead space)

Both are the failure PR #13 shipped. To verify the guard still bites, delete
the `composer-rail` level from `mock-claude.html` and re-run: it should fail
with the card ~269px out of line.

`CX_DEBUG=1` surfaces page errors, though note that Playwright does not capture
content-script `console` output — inspect the DOM if the card never appears.
