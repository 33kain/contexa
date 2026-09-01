# CONTEXA — Chrome Web Store listing copy

**This file is the listing. Written for 0.9.68, 2026-08-31.**

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
CONTEXA - Claude prompts, without the writing
```

*45 characters — exactly on the limit, so any addition overflows.* Unchanged,
and byte-identical to `name` in `extension/manifest.json`.

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
CONTEXA writes your next message, so you don't have to.

You are already deep in a conversation with Claude. You know roughly where you
want it to go. The hard part is turning that into a message specific enough to
get a good answer back — and that is a skill, not a mood.

CONTEXA reads where the conversation has been going and offers you the messages
you could send next. Each one is already written, in full. You pick one, read
it, change anything you like, and send it yourself.

NOTHING HAPPENS UNTIL YOU ASK

When a Claude reply finishes, one small trigger appears above your message box.
That is all. No model call, no request, nothing about your conversation leaves
the page, and nothing counts against your daily allowance.

Press it and CONTEXA reads your own messages from the conversation — what you
have been building toward across the whole thread, not just the last thing you
typed — and offers up to four next moves.

FOUR MESSAGES, NOT FOUR TOPICS

Each move is a complete message on its own. They do not run in order, they do
not build on each other, and picking one throws the rest away. It is a menu,
not a checklist — you only need one.

Click the one you want and the whole message lands in your box. You can edit
it. Nothing is ever sent without you pressing send.

Where a message needs something only you have — a file, a link, a detail only
you could know — CONTEXA marks the spot instead of inventing it. It may also
add a line starting "Assume:" for anything the conversation already settled, so
you can change it before you send rather than discovering it in the answer.

WHEN IT HAS NOTHING TO SAY, IT SAYS NOTHING

If the conversation has nothing worth taking further, CONTEXA shows you
nothing at all. No filler, no padded row, no suggestion whose only virtue is
that it could be shown.

That is deliberate, and it is the part most of these tools get wrong. Every
move has to be earned by something actually said in the conversation. Nothing
earned, nothing offered.

WHAT IT WILL NOT DO

It does not grade your prompts or tell you how to write. It does not overlay
your message box or interrupt your typing. It does not send anything on your
behalf, ever. And when something goes wrong — a limit reached, a network
failure — it tells you what actually happened instead of quietly showing you
canned suggestions.

HOW TO USE IT

1. Install it and open a conversation on claude.ai.
2. When a reply finishes, press the CONTEXA trigger above your message box.
3. Pick one of the messages it offers. It lands in your box, whole.
4. Edit if you want. Send when you are ready.

No account. No sign-up. No API key needed. 20 replies a day are free — that is
how many answers you can ask about, and picking a message costs nothing extra.

If you have your own Anthropic API key you can add it in settings, which
removes the daily limit — and in that mode requests go straight from your
browser to Anthropic, so nothing passes through our server at all.

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
- Screenshots: `publishing/screenshots/`, regenerated for 0.9.68.
- Check the live listing against this file before pasting. It has been on
  0.9.57 for eleven versions and nobody in the repo can see what it currently
  says.
