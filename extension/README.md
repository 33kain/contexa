# CONTEXA

CONTEXA reads where your conversation has been going and writes the messages you
could send next — as a menu you pick from with one click.

CONTEXA is a Chrome extension for claude.ai. When Claude finishes a reply, a
single chip appears above your message box. Nothing happens until you click it —
no model call, and nothing about your conversation leaves the page. Click it and
CONTEXA reads your own messages from this session, mines them for what you have
been building toward, and offers up to four next moves. Each one is already a
complete message. Click the one you want and it lands in your message box, whole.
You read it, change anything, and send it yourself. Nothing is ever sent for you.

The moves are independent. Each stands on its own as a full request, none of them
depends on the others, and picking one discards the rest — it is a menu, not a
sequence and not a questionnaire. Every move must be earned by something actually
said in the session: no quotable evidence, no move. A session with nothing open
earns nothing, and no row appears at all. That is a correct outcome, not a
failure.

Claude's latest reply is read too, but as material rather than as the subject —
what it just built is what makes a new move possible. CONTEXA never sends you
back over an answer you have already read.

No account, no API key, free to use. Nothing overlays your composer, nothing
scores your writing, and nothing appears unless it's real.

## Install (unpacked, for development)

1. Unzip this folder somewhere permanent.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select this `extension` folder.
5. Open **claude.ai** and send a message. When Claude's reply finishes, a single
   chip appears above your message box.

## Two modes

**Hosted (default).** Nothing to set up — moves come from CONTEXA's backend, with
a fair-use limit of 20 replies a day. One click on the chip spends one; picking a
move costs nothing, because the message is already written. No account, no key.

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

## How it decides what to offer

Clicking the chip sends your own messages from this session, plus Claude's latest
reply, to the model. It answers in one shape: up to four moves, each with a short
label you read and a full message behind it.

The session is the signal. The earliest message CONTEXA can see is usually where
you stated the goal; the ones after it show how it developed and what you keep
returning to. If the session runs long, whole turns are dropped to fit — the
earliest is always kept and the oldest middle ones go first, because a
conversation read without its opening has lost the point of itself.

Where a move needs something only you have — a file, a document, a link, a story
only you can tell — it writes an editable slot into the message rather than
inventing it. Where the session already settled something, it may add a final
`Assume:` line you can change or delete before sending.

There are no categories, personas, or lenses — earlier versions had them and they
made the output feel like a taxonomy exercise rather than a colleague talking.

## Honest states

CONTEXA never dresses up generic text as a real suggestion. After you click the
chip you get exactly one of:

- **A row of moves** — up to four, each one click from your message box.
- **Nothing at all** — the session had nothing open worth doing next, so no row
  is drawn rather than an empty one.
- **"That's all N free replies for today"** — with when it resets, and a path to
  add your own key for unlimited use.
- **A plain-language error** — with the actual cause in the browser console for
  anyone debugging.

If a response gets cut off by the token limit, the moves that came through whole
are kept and used, and the shortfall is logged rather than shown on the card.

## Behaviour notes

- The chip appears only after streaming finishes, detected from claude.ai's own
  `[data-is-streaming]` flag flipping to `false`.
- Replies under 120 characters are skipped — short acknowledgements don't need
  next steps.
- Light/dark follows claude.ai's `data-mode`, live.
- Your messages are read from the DOM at the moment you click, so nothing
  intercepts your typing and nothing is read for a reply you never ask about.

## Known limits

- Selectors are pinned to claude.ai's Aug-2026 structure (`SELECTORS`,
  `RESPONSE_SEL`, `STREAM_SEL`, `USER_MSG_SEL`, `ROW_SEL` in `content.js`). A
  redesign may need them refreshed; until then the extension goes quiet rather
  than breaking the page.
- On some pages the browser only keeps the visible part of a long conversation
  loaded, and CONTEXA can only read what is actually there. Measured on Cowork
  sessions, which render a handful of blocks at a time; not measured on ordinary
  claude.ai chats, where it may not happen at all. Where it does, CONTEXA reads
  the visible window rather than every turn ever sent.
- No prompt library or cross-device sync yet.

## Files

- `manifest.json` — MV3, permissions: `storage` + host access to claude.ai and
  api.anthropic.com only.
- `content.js` — composer locator, reply watcher, session capture, the trigger
  chip, the row of moves, insert.
- `background.js` — service worker; hosted and own-key calls, the move gate and
  evidence grounding, JSON recovery.
- `options.html` / `options.js` — settings: a beginner on/off switch, plus an
  Advanced section for the API key, model, and backend URL.
