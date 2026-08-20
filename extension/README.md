# CONTEXA

CONTEXA reads Claude's reply and hands you your next message — the one Claude itself would ask you to send.

CONTEXA is a Chrome extension for claude.ai. When Claude finishes a reply, CONTEXA reads it and offers up to five chips — each one a complete next message, written and ready to send. Click a chip and it lands in your composer; you read it, change anything, and send it yourself. Nothing is ever sent for you.

The chips aren't topic suggestions. They're the messages Claude would request if it could: paste the file it's been guessing about, settle the fork it hedged — "Assume X. Redo under exactly that." — invite its questions when the goal is still fuzzy, give it permission to stop listing options and build the full version, or turn the problem around entirely. Every chip must be earned by something the reply actually said; no quotable evidence, no chip. A reply blocked on one missing thing gets one chip, not five fillers. Under the hood, every chip follows the playbook good prompt engineers use — one component at a time, real content, tight scope — applied for you, one message at a time.

No account, no API key, free for up to twenty replies a day. Nothing overlays your composer, nothing scores your writing, and nothing appears unless it's real.

## Install (unpacked, for development)

1. Unzip this folder somewhere permanent.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select this `extension` folder.
5. Open **claude.ai** and send a message. When Claude's reply finishes, five
   short chips appear beneath it.

## Two modes

**Hosted (default).** Nothing to set up — suggestions come from CONTEXA's
backend, with a fair-use limit of 20 replies per day. No account, no key.

**Your own API key (optional).** Removes the daily limit. Requests then go
straight from your browser to the Anthropic API, and CONTEXA's backend is not
involved at all. To set it up:

1. Click the CONTEXA icon in the toolbar (or right-click → Options).
2. Paste your **Anthropic API key** (`sk-ant-…`).
3. Optionally change the model (default `claude-sonnet-5`, chosen because it
   follows the formatting rules that cheaper tiers ignore).
4. Click **Test connection**, then **Save**.

Your key is stored in `chrome.storage.local` and is sent only to
`api.anthropic.com` — never to CONTEXA's backend.

If you reach the daily limit in hosted mode, CONTEXA says so plainly and tells
you when it resets — never filler suggestions.

## How it decides what to suggest

One API call per completed reply, sending your last message plus Claude's reply.
The prompt asks for the five most useful next messages — the same five a sharp
collaborator would suggest looking at that exact conversation. Good sets tend to
mix going deeper on the valuable part, resolving what the reply assumed or left
ambiguous, and the practical action that produces the real artifact. If Claude
asked you a question, one suggestion answers it.

There are no categories, personas, or lenses — earlier versions had them and they
made the output feel like a taxonomy exercise rather than a colleague talking.

## Chips are handles, not the prompt

Each chip shows at most **6 words** so you can scan all five in about a second.
The chip is a handle: clicking it loads the *full, specific* prompt into your
composer, where you read it, edit it, or send it. Hovering shows the full text
too.

This split is deliberate. A 5-word prompt ("fix the pricing section") is one you
could have written yourself, and it makes Claude guess your intent. The value is
in the specificity, so the payload stays precise — it names the deliverable, the
format, the length, the constraint — while the chip stays tiny. You always see
what you're about to send before it sends.

A label longer than 6 words is truncated client-side, so a chatty model can't
break the layout.

## Honest states

CONTEXA never dresses up generic text as a real suggestion. You get exactly one
of three things under a reply (this list is the states, not the chip count):

- **Five chips** — real suggestions for that conversation.
- **"Daily limit reached (20 replies)"** — with when it resets, and an *Add key*
  button if you want unlimited use.
- **"Couldn't generate next steps (`reason`)"** — the actual error code
  (`api_401`, `truncated`, `network`, …) so a failure is diagnosable.

If a response gets cut off by the token limit, the complete suggestions are
salvaged and the shortfall is stated.

## Behaviour notes

- Suggestions appear only after streaming finishes, detected from claude.ai's
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
- `content.js` — composer locator, reply watcher, chips, insert.
- `background.js` — service worker; the one Anthropic call, JSON recovery.
- `options.html` / `options.js` — settings.
