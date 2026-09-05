# CONTEXA — Chrome Web Store listing copy

**This file is the listing. Written for 0.9.68; detailed description rewritten
for positioning on 2026-09-01 (history mining leads, the mascot is named, the
vocabulary matches the name). Name and short description unchanged.**

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
CONTEXA for Claude - Every token earned
```

*39 characters, six under the limit.* Byte-identical to `name` in
`extension/manifest.json`. The line after the brand is the motto
(`docs/token-savings-thesis.md`); "Claude" stays in the name because it is the
single most obvious search term, and "for Claude" is the third-party form —
the product is not first-party and the description says so.

Do not put Anthropic's wordmark or logo on any store asset, and do not let the
name read as first-party. The reasoning is in `SUBMISSION.md` § "The name, and
the one policy call worth remembering".

---

## Short description — 132 char limit

```
Claude replies. Press one button and CONTEXA reads your session, then writes up to four next messages. Pick one, you send it.
```

*125 characters.* **This is the `description` field in `extension/manifest.json`,
verbatim.** Keep it that way — two copies of one sentence is how the last three
surfaces drifted.

---

## Detailed description — 16,000 char limit

```
You are deep in a conversation on Claude.ai. You know where it should go next.
Turning that into a message precise enough to get a good answer back is the
part that costs you — and that is a skill, not a mood.

CONTEXA is a free Chrome extension that skips the writing. Press one button and
it reads your side of the conversation, then offers up to four next prompts,
each one already written in full. Pick one and it lands in your message box,
whole. You read it, change what you like, and send it yourself.

NOTHING HAPPENS UNTIL YOU ASK

When a Claude reply finishes, a small CONTEXA mascot appears above your message
box and asks one thing: What now? That is all it does. No request, no model
call, nothing about your conversation leaves the page, and nothing counts
against your daily allowance. A reply you never ask about never leaves your
browser.

IT READS WHAT YOU SAID, NOT JUST WHAT CLAUDE SAID

A follow-up written from the last answer alone is mostly about the last answer.
So when you press the button, CONTEXA reads your own messages across the whole
conversation — the first one, which is usually where you said what you were
trying to do, and everything you kept coming back to since — and mines the next
move from that. Claude's reply is material, not the subject: what it just built
is what makes a new move possible. A move that sends you back over an answer
you have already read is the one thing it is written never to offer.

A MENU, NOT A CHECKLIST

Each move is a complete prompt on its own: one ask, in your words, ready to
send. The moves do not run in order and do not build on each other. Picking
one throws the rest away. You only ever need one.

Where a prompt needs something only you have — a file, a link, a story only
you can tell — CONTEXA marks the spot as <paste here> instead of inventing it.
Where the conversation already settled something, it may add a line starting
"Assume:", so you can change it before you send rather than discover it in the
answer.

WHEN IT HAS NOTHING TO SAY, IT SAYS NOTHING

If the conversation has nothing worth taking further, CONTEXA shows you
nothing at all. No filler, no padded row, no suggestion whose only virtue is
that it could be shown.

Every move has to be earned by something actually said in the conversation —
by you or by Claude — and that is checked before anything reaches your screen.
Nothing earned, nothing offered. On a one-question chat that is the usual
result, and the correct one.

WHAT IT WILL NOT DO

It will not rewrite what you typed. There is nothing to type into. It will not
grade your prompts or tell you how to write. It will not overlay your message
box or interrupt you mid-sentence. It will not keep a conversation going on its
own, and it will not send anything on your behalf, ever. And when something
goes wrong — a limit reached, a network failure — it tells you what happened
instead of quietly showing you canned suggestions.

HOW TO USE IT

1. Install it and open a conversation on Claude.ai.
2. When a reply finishes, press the CONTEXA mascot above your message box.
3. Pick one of the prompts it offers. It lands in your box, whole.
4. Edit if you want. Send when you are ready.

No account. No sign-up. No API key needed. 20 replies a day are free — that is
how many answers you can ask about, and picking a prompt costs nothing extra.

If you have your own Anthropic API key you can add it in settings, which
removes the daily limit. In that mode requests go straight from your browser
to Anthropic, so nothing passes through our server at all.

PRIVACY, PLAINLY

• CONTEXA runs only on claude.ai. It touches no other site.
• Nothing is sent anywhere until you press the button. A reply you never ask
  about never leaves your browser.
• When you do press it, CONTEXA sends your own messages from that conversation
  and the reply you just received. Claude's earlier replies are never sent.
• There are hard limits on how much that can be: at most 40 of your messages,
  12,000 characters in total, and 6,000 characters of the reply. The backend
  enforces these itself.
• Your conversation text is never stored. It is used to write the suggestions
  and then discarded.
• No accounts, no profiles, no tracking, no analytics, no advertising, and
  nothing sold or shared.
• Your API key, if you provide one, stays on your device and goes only to
  Anthropic.

Full policy:
https://github.com/33kain/contexa/blob/main/publishing/PRIVACY.md

CONTEXA is open source: https://github.com/33kain/contexa

CONTEXA is an independent project. It is not affiliated with, endorsed by, or
sponsored by Anthropic.
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
- Screenshots: `publishing/screenshots/`, regenerated on 2026-09-01 against
  0.9.68 with the history-mining session. Upload in filename order — the
  composed frame goes first.
- The live listing went to 0.9.68 on 2026-09-01. Check it against this file
  before pasting; this file is what it is supposed to say.
