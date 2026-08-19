# CONTEXA — Privacy Policy

**Last updated: 19 August 2026**

CONTEXA is a browser extension that suggests next-step prompts inside
conversations on claude.ai. This policy describes exactly what data the
extension handles, where it goes, and how long it is kept.

CONTEXA is an independent project. It is not affiliated with, endorsed by, or
sponsored by Anthropic.

---

## The short version

- To suggest next steps, CONTEXA sends **your most recent message and Claude's
  reply for that one exchange** to be processed by Anthropic's API.
- Your conversation text is **never stored** — it is used to generate the
  suggestions in that moment and then discarded.
- There are **no accounts, no profiles, no tracking, no analytics, and no
  advertising**. Nothing is sold or shared for marketing.
- If you supply your own Anthropic API key, the text goes **directly** from your
  browser to Anthropic and never touches our server at all.

---

## What data is processed

### Conversation content

When a Claude reply finishes, CONTEXA sends two pieces of text:

1. Your most recent message in that conversation (up to 2,500 characters).
2. Claude's reply you just received (up to 6,000 characters).

This is the minimum needed to suggest what to ask next. CONTEXA does **not**
read your conversation history, your other conversations, your account details,
or any other page. It sends nothing until a reply has finished, and nothing at
all in a conversation where you have not sent a message.

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

Your message and Claude's reply are sent to the CONTEXA backend, which runs on
Cloudflare Workers. The backend forwards that text to Anthropic's API to generate
suggestions, returns the suggestions to your browser, and discards the text.
The backend does not write your conversation content to any database, log, or
file.

### If you supply your own API key

The text goes directly from your browser to `https://api.anthropic.com`. The
CONTEXA backend is not involved and receives nothing.

### Third parties

- **Anthropic PBC** — processes the text to generate suggestions, under
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
| Conversation text (your message, Claude's reply) | Not stored. Held in memory only for the duration of the request. |
| Suggestions generated | Not stored server-side. Cached in memory briefly so re-reading a reply does not repeat a request. |
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
