# The interactive demo (private preview)

One self-contained HTML file: `index.html`. A visitor types a rough message,
presses the CONTEXA trigger, picks one of the complete messages it composes,
edits it, and ends with something send-ready. No network, no model, no storage.

**It is not the website.** `publishing/website/` is the live site, deployed to
Cloudflare Pages by `.github/workflows/deploy-pages.yml` on any change to that
path. This file lives outside it on purpose, so nothing here can deploy by
accident. It is published as a private Artifact instead, and is not linked from
the site.

## What is real in it and what is not

Real: `ACTION_OPENERS` and `META_OBJECTS` are copied verbatim from
`extension/background.js` and run on the labels this page builds, so a label
without a production verb is dropped exactly as it would be in the product. The
evidence check is real too — a move survives only if it carries a fragment that
occurs verbatim in what the visitor typed, and the row can come back empty,
because zero is a valid outcome here as well as there.

Not real: no model is called. The moves come from templates chosen by keyword
(one family for a bug, one for a message to write, one for a plan, and so on)
and filled with the visitor's own words. The page says so, under the stage and
in the closing note; it also says so when the visitor writes in a language the
templates are not written in.

The look is `publishing/website/site.css` and the card is the one
`extension/content.js` draws, with the same tokens and the same gestures.

## Changing it

Open `index.html` and edit. The template families are in `SETS`, the keyword
routing is `DOMAINS`, the three worked examples are `SEEDS`. To view it as it
will be published, wrap the file in a minimal `<!doctype html><html><head>…`
skeleton — the Artifact runtime supplies that, so the file itself has no
`<html>`, `<head>` or `<body>` tags. To republish, publish the same file path
to the same Artifact URL.
