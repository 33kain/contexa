# The interactive demo (private preview)

One self-contained HTML file: `index.html`, reproducing both of the product's
controls. In the first stage a visitor types a rough message, presses the
CONTEXA trigger, picks one of the complete messages it composes, edits it, and
ends with something send-ready. In the second, a thread that has grown heavy
carries the cost line and **Start fresh**: one press writes the brief, the next
opens a new conversation with it in the message box, unsent. No network, no
model, no storage.

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

Real in the second stage: `cleanBrief`, copied verbatim the same way; the
12,000-token gate, which runs and renders nothing below the line (drop the
example thread under it and the cost line disappears entirely, number and all);
the cost line's wording and `kTokens`; the four labelled blocks; and the two
clicks, one to write the brief and one to open the chat.

**And the number.** The example conversation is invented, like the one in the
figure on the site — but its weight is counted, not claimed. All 58 messages are
held in `THREAD`, the page sums their characters and divides by four (the
extension's own estimate), and that is what puts it at ≈ 12.7k tokens, over the
product's unmodified threshold. The fold hides messages from the screen, never
from the count. If you edit the thread, keep it over 48,000 characters, and
never hardcode the number: a demo that fakes the measurement is doing the thing
the product exists to refuse.

Not real: no model is called, in either stage. The moves come from templates
chosen by keyword (one family for a bug, one for a message to write, one for a
plan, and so on) and filled with the visitor's own words. The brief is cut from
the clauses of the example thread's own user turns: a clause naming a choice, a
number or an absolute becomes a settled fact, one naming something built becomes
what exists now, material to bring along ends in `<paste here>`, and the last
turn's open item becomes `Next:` — with `Pick up from here.` when there is none,
since a next step is never invented. A thread that settled nothing and built
nothing earns an empty brief and the inert `Nothing to carry over.` card. The
page says all of this, under each stage; it also says so when the visitor writes
in a language the templates are not written in.

The look is `publishing/website/site.css` and the card is the one
`extension/content.js` draws, with the same tokens and the same gestures.

## Changing it

Open `index.html` and edit. The template families are in `SETS`, the keyword
routing is `DOMAINS`, the three worked examples are `SEEDS`, the heavy example
conversation is `THREAD`, and the brief's classifiers are the regexes above
`buildBrief`. To view it as it
will be published, wrap the file in a minimal `<!doctype html><html><head>…`
skeleton — the Artifact runtime supplies that, so the file itself has no
`<html>`, `<head>` or `<body>` tags. To republish, publish the same file path
to the same Artifact URL.
