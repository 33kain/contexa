# CONTEXA — Privacy Policy

**Last updated: 31 August 2026**

CONTEXA is a browser extension that helps you write your next prompt inside
conversations on claude.ai. When Claude finishes replying, CONTEXA offers you a
button. If you press it, it reads that reply together with your own earlier
messages in the same conversation, and offers you up to four next messages —
each one already written. Clicking one puts it in your message box.

**Nothing about your conversation leaves your browser unless you press that
button.** This policy describes exactly what data the extension handles, where
it goes, and how long it is kept.

CONTEXA is an independent project. It is not affiliated with, endorsed by, or
sponsored by Anthropic.

---

## The short version

- **Nothing is sent anywhere until you click.** After a reply, CONTEXA shows a
  button and makes no request of any kind until you press it.
- When you do, it sends **your own messages from that conversation, plus the
  reply you just received**, to be processed by Anthropic's API. One click, one
  request.
- **Claude's earlier replies are never sent** — only your own messages and the
  single reply you pressed the button under.
- **There are hard limits on how much that can be**: at most 40 of your
  messages, 2,000 characters each, 12,000 characters in total, and 6,000
  characters of the reply. The backend enforces these itself, so they hold
  whatever the extension sends.
- Your conversation text is **never stored** — it is used to write the suggested
  messages in that moment and then discarded.
- There are **no accounts, no profiles, no tracking, no analytics, and no
  advertising**. Nothing is sold or shared for marketing.
- If you supply your own Anthropic API key, the text goes **directly** from your
  browser to Anthropic and never touches our server at all.

---

## What data is processed

### Conversation content

When a reply finishes, CONTEXA reads **that reply and nothing else**, so that it
knows what the button it shows you would be about. **That reading never leaves
your device**, and if you never press the button, nothing else is read at all.

When you press the button, CONTEXA then reads and sends two things:

1. **Your own messages in that conversation** — at most 40 of them, up to 2,000
   characters each and 12,000 characters in total. If the conversation is longer
   than that, your first message is always kept, because it is usually where you
   said what you were trying to do; the oldest middle ones are dropped.
2. **Claude's reply you just received** (up to 6,000 characters).

These limits are applied twice: by the extension before it sends, and again by
the backend before anything is forwarded to Anthropic. The second one is what
actually binds.

**What is deliberately not included: Claude's earlier replies.** Only your own
messages travel, plus the single reply you pressed the button under. CONTEXA also
does not read your other conversations, your account details, or any other page.
It sends nothing unless you press the button, nothing before a reply has
finished, and nothing at all in a conversation where you have not sent a
message. A reply you never press the button under is never transmitted anywhere.

*This section changed on 31 August 2026 and the change is worth stating plainly:
earlier versions of CONTEXA sent only your latest message and the reply, and this
policy said so. The product now reads your side of the whole conversation,
because suggestions drawn from one exchange were mostly about that exchange. More
of your text leaves the browser than before — bounded as described above, and
still only when you press the button.*

### Settings stored on your device

Stored locally in your browser (`chrome.storage.local`) and never transmitted to
us:

- Whether CONTEXA is on or off.
- Your Anthropic API key, if you choose to provide one.
- The backend URL (advanced setting).
- An anonymous device token (see below).

Your API key is only ever sent to `api.anthropic.com`, to authenticate your own
requests. We never receive it, and it is never sent to our server.

### Anonymous device token

If you use the hosted service (the default, no key required), the extension
generates a random identifier on first use and stores it locally. Its only
purpose is to apply a fair-use daily limit.

This token is **not an identity**. It is not derived from you, your browser
profile, your hardware, or your claude.ai account. It is not linked to any email
address or name, and it cannot be used to contact or recognise you anywhere else.
Clearing the extension's storage or reinstalling generates a new one.

### IP addresses

When you use the hosted service, our server necessarily receives your IP address,
as any web server does. It is used only to apply a second layer of rate limiting
that prevents abuse of the free service.

Your IP address is **never stored in readable form**. It is combined with a
secret salt and cryptographically hashed (SHA-256), and only the hash is kept as
a counter key. The original IP address cannot be recovered from it.

---

## Where the data goes

### If you use the hosted service (default)

When you press the button, your own messages from that conversation and the reply
you just received are sent to the CONTEXA backend, which runs on Cloudflare
Workers. The backend applies the size limits described above, forwards the text
to Anthropic's API to write the suggested messages, returns them to your browser,
and discards the text.
The backend does not write your conversation content to any database, log, or
file.

### If you supply your own API key

The text goes directly from your browser to `https://api.anthropic.com`. The
CONTEXA backend is not involved and receives nothing.

### Third parties

- **Anthropic PBC** — processes the text to write the suggested messages, under
  Anthropic's own API terms and privacy policy. When you use your own key, this
  usage falls under your own agreement with Anthropic.
- **Cloudflare, Inc.** — provides the hosting for the backend and handles the
  network request, under its own terms.

No other third party receives any data. There are no analytics providers, no
advertising networks, and no data brokers involved.

---

## Retention

| Data | Retention |
|---|---|
| Conversation text (your own messages, and the reply you pressed the button under) | Not stored. Held in memory only for the duration of the request. |
| The suggested messages | Not stored server-side. Cached in your own browser briefly so pressing the button twice on the same reply does not repeat the request. |
| Anonymous device token | Stored on your device until you clear storage or uninstall. |
| Daily usage counters (token and hashed IP) | Automatically deleted after 48 hours. |
| Your API key and settings | Stored on your device only, until you remove them. |

---

## What CONTEXA does not do

- Does not run on any website other than claude.ai.
- Does not read, collect, or transmit your browsing history, bookmarks,
  passwords, cookies, or form data.
- Does not use tracking pixels, fingerprinting, or cross-site identifiers.
- Does not sell, rent, or share personal information with anyone.
- Does not use your conversation content to train any model.
- Does not require an account, an email address, or a name.

---

## Your choices

- **Turn it off** at any time in the extension's settings; nothing is sent while
  it is off.
- **Use your own API key** to bypass our backend entirely, so no third party
  besides Anthropic is involved.
- **Delete everything** by removing the extension. All locally stored settings,
  including your key and device token, are removed with it. Usage counters expire
  on their own within 48 hours.

## Children

CONTEXA is not directed at children and is not intended for use by anyone under
the age required to hold an account on the services it works with.

## Changes to this policy

If this policy changes materially, the updated version will be published at this
URL with a new "last updated" date, and the extension's listing will reflect the
change.

## Contact

Questions or requests about this policy: **michu110899@gmail.com**
