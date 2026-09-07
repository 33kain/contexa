# CONTEXA — Chrome Web Store listing copy

**This file is the listing. Rewritten for 0.9.95 around the motto that replaced
"Every token earned": save tokens. The name and short description changed with
it, so the package changed too (both are manifest fields), and the detailed
description now leads with the measured number.** Earlier: written for 0.9.68,
detailed description repositioned on 2026-09-01.

It used to be a tombstone pointing at a project doc outside the repo, on the
argument that a file duplicating the listing drifts from it. That argument was
right and its conclusion was wrong. Keeping the copy outside meant nobody
working in the repo could check it, and at 0.9.68 nobody could say whether the
live listing still advertised suggestion chips — a mechanism deleted at 0.9.30.
The copy now lives here, versioned with the code that has to match it, for the
same reason `publishing/PRIVACY.md` is now the URL the listing points at.

**So there is one copy, and it is this one.** If you paste from anywhere else,
you are pasting from something nothing updates. The chip-era text is in git
history, which is all it was ever being kept for.

---

## Name — 45 char limit

```
CONTEXA for Claude - Save tokens
```

*32 characters, 13 under the limit.* Byte-identical to `name` in
`extension/manifest.json`. The line after the brand is the motto;
the thesis behind it is `docs/token-savings-thesis.md`, written under the older
wording "every token earned", which stays as the test, not the name; "Claude" stays in the name because it is the
single most obvious search term, and "for Claude" is the third-party form —
the product is not first-party and the description says so.

Do not put Anthropic's wordmark or logo on any store asset, and do not let the
name read as first-party. The reasoning is in `SUBMISSION.md` § "The name, and
the one policy call worth remembering".

---

## Short description — 132 char limit

```
Save tokens on claude.ai. One press writes up to four next messages; Start fresh turns a long thread into a brief. You send it.
```

*127 characters.* **This is the `description` field in `extension/manifest.json`,
verbatim.** Keep it that way — two copies of one sentence is how the last three
surfaces drifted.

---

## Detailed description — 16,000 char limit

```
Every message you send on claude.ai is processed with the whole conversation behind it. Forty messages in, each new one costs a forty-message read, and your usage limit goes with it. CONTEXA is a free Chrome extension that spends fewer tokens per thing done: it writes your next message so it lands the first time, and when a thread has grown heavy it hands you the exit.

MEASURED, NOT MODELLED

Five messages sent in a 689,000-token session used 9% of the five-hour usage limit. The same five, sent after Start fresh in the new conversation it opened, used 3%. Three times cheaper per message, on a live session, the same model on both sides, read off the usage page before and after. On five sessions from 14,000 to 689,000 tokens, the brief that replaced the thread was between 313 and 444 tokens every time. The measurement, and everything that could bias it, is in the open-source repository.

START FRESH WHEN THE THREAD GETS HEAVY

Past about 12,000 tokens, the CONTEXA card shows how much is re-read on every send and offers Start fresh. Press it and CONTEXA writes a brief from your side of the conversation: the goal, what is settled, what is open. It opens a new conversation (on Cowork, a new session in the same project) with the brief already in the message box. You read it, change it, and send it. The next thread starts at a few hundred tokens instead of a few hundred thousand. The brief is a summary and says so: what it does not carry stays behind, so on a thread where every detail still matters, stay.

ONE PRESS, THE NEXT MESSAGE WRITTEN IN FULL

When Claude finishes a reply, a small mascot appears above your message box. Press it and CONTEXA reads your own messages across the whole conversation, not just the last answer, and offers up to four next messages, each one complete: one ask, in your words, ready to send. Pick one and it lands in your box, whole. You edit it and send it yourself. A message that cannot draw a clarifying question is a round trip that never happens, and on a long thread the round trip is the expensive part.

Where a prompt needs something only you have, CONTEXA marks the spot as <paste here> instead of inventing it. Where the conversation already settled something, it may add a line starting "Assume:", so you change it before sending rather than discover it in the answer.

NOTHING HAPPENS UNTIL YOU ASK

The mascot is all that appears on its own. No request, no model call, nothing about your conversation leaves the page, and nothing counts against your daily allowance until you press. A reply you never ask about never leaves your browser.

WHEN IT HAS NOTHING TO SAY, IT SAYS NOTHING

Every message CONTEXA offers has to be earned by something actually said in the conversation, by you or by Claude, and that is checked before anything reaches your screen. Nothing earned, nothing offered. On a one-question chat that is the usual result, and the correct one.

WHAT IT WILL NOT DO

It will not send anything on your behalf, ever. It will not rewrite what you typed; there is nothing to type into. It will not grade your prompts, overlay your message box, or keep a conversation going on its own. When something goes wrong, a limit reached or a network failure, it tells you what happened instead of showing canned suggestions.

HOW TO USE IT

1. Install it and open a conversation on claude.ai.
2. When a reply finishes, press the CONTEXA mascot above your message box.
3. Pick one of the messages it offers. It lands in your box, whole. Edit if you want, send when you are ready.
4. On a long thread, press Start fresh, read the brief, click the chip. The new conversation opens with the brief in the box.

No account. No sign-up. No API key needed. 20 presses a day are free, and picking a message costs nothing extra. With your own Anthropic API key the daily limit goes away and requests go straight from your browser to Anthropic, so nothing passes through our server at all.

PRIVACY, PLAINLY

• CONTEXA runs only on claude.ai. It touches no other site.
• Nothing is sent anywhere until you press. A reply you never ask about never leaves your browser.
• When you press, CONTEXA sends your own messages from that conversation and the reply you just received. Claude's earlier replies are never sent. Start fresh sends the same two things and gets a brief back; the brief stays in your browser until the new conversation opens.
• To read your side of a long conversation whole, CONTEXA asks claude.ai's own API from your browser, with your existing login. That reading stays on your device.
• Hard limits: at most 40 of your messages, 12,000 characters in total, and 6,000 characters of the reply. The backend enforces these itself.
• Your conversation text is never stored. It is used to write the messages and then discarded.
• No accounts, no profiles, no tracking, no analytics, no advertising, and nothing sold or shared.
• Your API key, if you provide one, stays on your device and goes only to Anthropic.

Full policy:
https://github.com/33kain/contexa/blob/main/publishing/PRIVACY.md

CONTEXA is open source: https://github.com/33kain/contexa

CONTEXA is an independent project. It is not affiliated with, endorsed by, or sponsored by Anthropic.
```

**The last line is mandatory and must never be softened**, whatever else in
this file changes.

---

## Category

**Productivity.** Secondary, if offered: Workflow & Planning.

---

## Before you paste

- The four review-facing fields — single purpose, permission justifications,
  data usage, certifications — are **not** here. They are in `SUBMISSION.md`,
  and they are written to match this copy. If you change what the product reads
  or sends, all three files move in the same release.
- Screenshots: `publishing/screenshots/`, authored 2026-09-07 for 0.9.95 —
  designed illustrations rather than captures, each footed `Illustrative demo`.
  Upload in filename order: Start fresh leads, because this copy does.
- The live listing went to 0.9.68 on 2026-09-01. Check it against this file
  before pasting; this file is what it is supposed to say.
