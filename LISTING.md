# CONTEXA — Chrome Web Store listing

Paste-ready. Counts verified below.

---

## Name  (38 / 45 characters)

```
CONTEXA — Next-Step Prompt Suggestions
```

"Claude" is deliberately absent from the name. Chrome Web Store policy prohibits
listings that imply affiliation with another company, and a name in the form
"… for Claude" is a known trigger for that review. The integration is described in
the body copy instead, which is normal and permitted nominative use.

## Short description  (122 / 132 characters)

```
Reads the reply and hands you your next message, ready to send. No API key, no account, no setup - just better next steps.
```

Leads with the benefit, closes on the removed objection. "No API key, no account,
no setup" is the phrase that converts — it answers the question every reader of an
AI extension listing silently asks.

## Detailed description  (453 words)

```
CONTEXA reads the reply and hands you your next message.

When a reply finishes in your AI chat, up to five short chips appear beneath it — each one a complete next message, written and ready to send. Click a chip and the full text lands in your message box, where you read it, edit anything, and send it yourself. Nothing is ever sent for you.

These aren't topic suggestions. Each chip is the message the assistant would ask you to send if it could: paste the exact file or error it's been reasoning about blindly; settle a fork its reply hedged ("Assume X. Redo under exactly that."); invite its questions when the goal is still fuzzy; give it permission to stop listing options and produce the complete version; or turn the problem around and attack it from the opposite side. Every chip must be earned by something the reply actually said — no quotable evidence, no chip. A reply blocked on one missing input gets one strong chip, not five fillers, so the number of chips tells you something true about where your conversation stands.

Under the hood, every chip follows the playbook good prompt engineers use — one component at a time, real content, tight scope — applied for you, one message at a time.

NOTHING TO SET UP

No API key. No account. No sign-up, no credit card, no configuration screen. Install it, open your chat, send a message — the chips are there when the reply lands. A fair-use daily allowance is included at no cost.

If you already have an Anthropic API key and want to remove the daily limit, you can add it in settings. That's entirely optional, and most people never will.

HOW IT WORKS

1. Install the extension and open your AI chat.
2. Send a message. When the reply finishes, the chips appear underneath.
3. Click one. The full message lands in your message box. Edit it or send it.

PRIVACY

CONTEXA runs on one site and touches no others. It sends only your latest message and the reply you just received — never your history, your other conversations, or your account details. Your conversation text is never stored. There are no accounts, no profiles, no tracking, no analytics, and no advertising. Nothing is sold or shared. If you choose to add an API key, it stays on your device.

WHAT IT DOESN'T DO

It doesn't score your writing, nag you, or interrupt your typing. Nothing covers the message box. And if it can't produce real suggestions, it tells you why in plain language instead of showing filler.

CONTEXA is an independent project. It is not affiliated with, endorsed by, or sponsored by Anthropic.
```

---

## Notes on the copy

**The no-setup section sits second, not last.** It's the strongest differentiator
you have: nearly every comparable extension demands the user paste an API key,
and most installs die at that screen. Naming it early, with the specific
objections spelled out (no key, no account, no sign-up, no credit card, no config
screen), does more work than any feature description.

**The optional-key paragraph is honest but demoted.** It exists so power users
know the ceiling can be lifted, while the phrase "most people never will" keeps it
from reading as a hidden requirement.

**Product name usage.** The body says "your AI chat" rather than naming the
product repeatedly. Reviewers read repeated brand mentions as positioning; one
factual mention plus the disclaimer is the safer shape.

**The privacy section is specific, not reassuring.** "Never stored", "no
analytics", "runs on one site" are checkable claims that match the code and the
data disclosures. Vague privacy language invites scrutiny; precise language
survives it.

**The last line before the disclaimer is the honesty state.** Saying it tells you
why instead of showing filler is unusual for a listing and signals the product
won't waste the reader's time.

## Assets in `store-assets/`

| File | Size | Where it goes | Required |
|---|---|---|---|
| `store-icon-128.png` | 128×128 | Store listing icon | Yes |
| `promo-tile-440x280.png` | 440×280 | Small promotional tile | Yes |
| `promo-marquee-1400x560.png` | 1400×560 | Marquee (featured placement) | No |

**Do not swap the store icon for `extension/icons/icon128.png`.** They differ on
purpose. The Web Store requires the listing icon to hold 96×96 of artwork inside
the 128×128 canvas with 16 pixels of transparent padding on each side; the
toolbar icon in the extension is full-bleed, which is correct there and wrong
here.

The small promo tile is listed as required for prominent store display, and
extensions without one are ranked below extensions with one. The marquee is
optional but is the only route to featured placement, so it costs nothing to
include.

Screenshots remain the four 1280×800 PNGs in `publishing/screenshots/`, in the
order `1-chips`, `2-inserted`, `3-dark`, `4-settings`.
