---
name: screenshots
description: Render or verify CONTEXA's visual assets — the five Chrome Web Store screenshots (scripts/screenshots/slides.html), the two promo tiles (scripts/promo/tiles.html), the website's social/touch images (scripts/website/assets.html) — and run the real-extension browser checks in scripts/screenshots/capture.mjs. Use when user-visible wording or the card's look changes, when the user asks for new store images, or to see the real card render in a browser.
---

# Store images and browser checks

Three renderers take HTML to PNG, and one harness runs the real extension:

| Command | Source you edit | Writes |
|---|---|---|
| `node scripts/screenshots/render-slides.mjs` | `scripts/screenshots/slides.html` | `publishing/screenshots/1-new-chat … 5-trigger.png` (1280×800, the shipped store set) |
| `node scripts/promo/render.mjs` | `scripts/promo/tiles.html` | `store-assets/promo-tile-440x280.png`, `promo-marquee-1400x560.png` |
| `node scripts/website/render.mjs` | `scripts/website/assets.html` | `publishing/website/` social preview + `apple-touch-icon.png` |
| `xvfb-run -a node scripts/screenshots/capture.mjs` | `mock-claude.html` + the real `extension/` | depends on the mode (see below) |

**Edit the HTML and re-render. Never retouch a PNG.** The shipped screenshots are
designed illustrations marked `Illustrative demo`, not captures.

## Warnings

1. **The fonts are different in the cloud.** `slides.html` asks for `"Segoe UI"`,
   which exists only on Windows. The shipped set was rendered on the
   maintainer's Windows machine (`CX_CHANNEL=msedge`), and here the text falls
   back to DejaVu Sans. A cloud re-render gives different bytes and different
   typography in every frame, even with no change to the source. Unless the user
   has agreed to cloud-rendered images, render to check the layout, look at the
   result, and then `git checkout publishing/screenshots store-assets publishing/website`
   (these renderers have no `build-ready/` mode). Leave
   the final render to the maintainer and say so.
2. **Only `CX_SHIP=1` writes into the shipped set.** `capture.mjs` writes to
   `build-ready/` (git-ignored) by default:

   | Mode | Writes to |
   |---|---|
   | default | `build-ready/capture/` (3-moves, 4-composed, 5-trigger) |
   | `CX_FORK=1` | `build-ready/capture/` (1-new-chat, 2-brief) |
   | `CX_TURNS=1` | `build-ready/turns-check/` |
   | `CX_ZERO=1` | `build-ready/zero-check/` |
   | `CX_NUDGE=1` | `build-ready/nudge-check/` |
   | `CX_SHIP=1` + default or `CX_FORK=1` | `publishing/screenshots/`, **over the shipped set** |

   Use `CX_SHIP=1` only when the user wants captured frames to replace the
   illustrations. Before 2026-09-26 the default, `CX_FORK` and `CX_TURNS` runs
   all wrote into `publishing/screenshots/`. On an older branch, check
   `git status` after a run.

## Running in this container

Chromium is at `/opt/pw-browsers/chromium` and Playwright is installed globally
(`/opt/node22/lib/node_modules`). The renderers find both on their own and run
headless. `capture.mjs` loads the extension, so it needs Xvfb and the path:

```bash
CX_ZERO=1  CX_CHROME=/opt/pw-browsers/chromium xvfb-run -a node scripts/screenshots/capture.mjs
CX_NUDGE=1 CX_CHROME=/opt/pw-browsers/chromium xvfb-run -a node scripts/screenshots/capture.mjs
CX_TURNS=1 CX_CHROME=/opt/pw-browsers/chromium xvfb-run -a node scripts/screenshots/capture.mjs
CX_FORK=1  CX_CHROME=/opt/pw-browsers/chromium xvfb-run -a node scripts/screenshots/capture.mjs
```

`CX_TURNS` checks that `captureTurns()` reads all 20 turns of a full page (`i=1..20`).
`CX_FORK` is the only check that runs the fork handoff across two tabs in a
real browser. Run it after touching `stageBrief`, `collectBrief`,
`takeBrief` or `insertPrompt`.

Look at every PNG you render (with the Read tool) before you report it as good.
`capture.mjs`'s `assertCardGeometry()` only catches a card that is misaligned
or floating.

## When wording changes

User-visible wording (the button, the cost line, the mascot's bubble) appears
in `slides.html`, `tiles.html`, the capture harness's assertions (`capture.mjs`
matches on the text), `publishing/STORE-LISTING.md` and the website. Grep all of
them for the old string. The screenshots' example session and moves are shared
with the promo tiles, so change them together. `publishing/screenshots/README.md`
records which frame shows what and when it was rendered: update it with any
re-render you commit.

Mock and illustrated frames aren't proof that the extension works on claude.ai.
Before a store submission, the checklist still asks for a check against a live
session (see the `selector-check` skill).
