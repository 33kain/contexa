# CONTEXA

CONTEXA reads Claude's reply and writes your next message — by asking you a few short questions you answer by clicking.

CONTEXA is a Chrome extension for claude.ai. When Claude finishes a reply, a single chip appears above your message box. Nothing happens until you click it — no model call, and nothing about your conversation leaves the page. Click it and CONTEXA reads the exchange and asks up to four short questions, one at a time, with the answers already written for you. Pick one, or skip it. When you're done it composes the whole prompt into your message box. You read it, change anything, and send it yourself. Nothing is ever sent for you.

The questions aren't a survey. They're the decisions the reply actually left open — the branch it hedged, the format it guessed at, the thing it asked you for. Every question must be earned by something the reply said; no quotable evidence, no question. A reply that left nothing worth asking earns nothing, and the row stays quiet. That is a correct outcome, not a failure.

When the reply left something worth doing that needs nothing from you, CONTEXA offers up to four one-click moves instead — take it further, hand back a fork it left open, probe what could go wrong, or ask why it chose one path over another.

No account, no API key, free to use. Nothing overlays your composer, nothing scores your writing, and nothing appears unless it's real.

## Install (unpacked, for development)

1. Unzip this folder somewhere permanent.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select this `extension` folder.
5. Open **claude.ai** and send a message. When Claude's reply finishes, a single
   chip appears beneath it.

## Two modes

**Hosted (default).** Nothing to set up — suggestions come from CONTEXA's
backend, with a fair-use limit of 20 prompts a day. No account, no key.

**Your own API key (optional).** Removes the daily limit. Requests then go
straight from your browser to the Anthropic API, and CONTEXA's backend is not
involved at all. To set it up:

1. Click the CONTEXA icon in the toolbar (or right-click → Options).
2. Open **Advanced**.
3. Paste your **Anthropic API key** (`sk-ant-…`).
4. Optionally change the model (default `claude-sonnet-5`, chosen because it
   follows the formatting rules that cheaper tiers ignore).
5. Click **Test connection**. Advanced fields save on their own when you leave
   them — there's no separate Save button.

Your key is stored in `chrome.storage.local` and is sent only to
`api.anthropic.com` — never to CONTEXA's backend.

If you reach the daily limit in hosted mode, CONTEXA says so plainly and tells
you when it resets — never filler suggestions.

## How it decides what to do

Clicking the chip sends your last message and Claude's reply to the model,
which answers in one of two shapes:

- **Ask** — when the next message needs something only you can supply. Up to
  four questions, one at a time, each answerable by picking one of 2–4 options
  CONTEXA wrote for you. No typing required.
- **Offer** — when the reply left something worth doing that needs nothing
  from you. Up to four ready moves you send with one click.

Never both at once. And whenever there's nothing to click through — a quiet
row, or the row of moves — a small "Rough ask" control is still there: type a
few words yourself and CONTEXA writes the properly formed prompt from it, with
anything it can't know marked as an editable slot or an `Assume:` line rather
than invented.

There are no categories, personas, or lenses — earlier versions had them and
they made the output feel like a taxonomy exercise rather than a colleague
talking.

## Honest states

CONTEXA never dresses up generic text as a real suggestion. Under a reply you
get exactly one of:

- **An interview card** — up to four click-only questions.
- **A row of moves** — up to four one-click sends.
- **A quiet row** — nothing was worth asking or offering, said plainly, with
  the "Rough ask" control still available.
- **"That's all N free prompts for today"** — with when it resets, and a path
  to add your own key for unlimited use.
- **A plain-language error** — with the actual cause in the browser console for
  anyone debugging.

If a response gets cut off by the token limit, whatever completed is kept and
used, and the shortfall is logged rather than shown on the card.

## Behaviour notes

- The chip appears only after streaming finishes, detected from claude.ai's
  own `[data-is-streaming]` flag flipping to `false`.
- Replies under 120 characters are skipped — short acknowledgements don't need
  next steps.
- Light/dark follows claude.ai's `data-mode`, live.
- Your last message is read from the DOM, so nothing intercepts your typing.

## Known limits

- Selectors are pinned to claude.ai's Aug-2026 structure (`SELECTORS`,
  `RESPONSE_SEL`, `STREAM_SEL`, `USER_MSG_SEL` in `content.js`). A redesign may
  need them refreshed; until then the extension goes quiet rather than breaking
  the page.
- No prompt library or cross-device sync yet.

## Files

- `manifest.json` — MV3, permissions: `storage` + host access to claude.ai and
  api.anthropic.com only.
- `content.js` — composer locator, reply watcher, the trigger chip, the
  interview and moves cards, insert.
- `background.js` — service worker; hosted and own-key calls, schema
  negotiation with the worker, JSON recovery.
- `options.html` / `options.js` — settings: a beginner on/off switch, plus an
  Advanced section for the API key, model, and backend URL.
