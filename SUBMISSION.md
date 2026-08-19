# CONTEXA — unlisted submission, field by field

Everything below is paste-ready. Placeholders are already filled with your real
values. Work top to bottom.

**What you're doing:** publishing **Unlisted**. The listing is not searchable or
browsable — only people with your link can install it. Same review process and
same trust as a public listing, so the "Chrome can't verify this extension"
warning disappears. Switching to public later needs no new review.

---

## Step 1 — host the privacy policy (5 minutes)

Chrome requires a public privacy policy URL because this extension transmits
message text.

1. Go to https://gist.github.com
2. Filename: `contexa-privacy.md`
3. Paste the entire contents of `PRIVACY.md` (in this folder)
4. Click **Create public gist**
5. Copy the URL from your browser's address bar — that's your policy URL

The contact address is already set to michu110899@gmail.com. If you would rather
not have a personal address publicly attached, swap it before you paste — the
store also shows a developer contact email on listings, so this address becomes
visible either way.

## Step 2 — developer account ($5, one time)

1. https://chrome.google.com/webstore/devconsole
2. Sign in, accept the developer agreement
3. Pay the **$5 one-time** registration fee
4. Set a publisher display name you're happy to have shown publicly

## Step 3 — upload

1. **Add new item**
2. Upload `contexa-submit.zip` from this folder
3. It should parse with no manifest errors

## Step 4 — store listing tab

**Name**
```
CONTEXA — Next-Step Prompt Suggestions
```

**Short description** (132 char limit; this is 118)
```
Get smart next-step prompts after every Claude reply. Click one to load it, edit it, send it. No API key required.
```

**Detailed description**
```
CONTEXA suggests what to ask next.

When a Claude reply finishes, a few short chips appear beneath it — each one a
concrete next step for the work you're actually doing. Click a chip and the full,
specific prompt loads into the composer, where you can read it, edit it, or send
it as-is.

It's the moment you didn't know what to ask, solved.

WHY IT HELPS

Most of us send vague prompts and get vague answers back. The fix isn't a longer
prompt, it's a more specific one — and writing specific prompts is a skill.
CONTEXA reads the conversation you're already in and proposes the moves a sharp
collaborator would suggest: going deeper on the valuable part, resolving what the
reply assumed, producing the actual artifact, trying a different framing, or
pressure-testing the result.

The chips stay short so you can scan them in a second. The prompt behind each one
is detailed — it names the deliverable, the format, the length, the constraint.
You always see the full text in the composer before anything is sent.

HOW IT WORKS

• Install it, open claude.ai, and send a message.
• When the reply finishes, the chips appear underneath.
• Click one. The full prompt lands in your composer. Edit or send.

No setup, no account, no sign-in. A fair-use daily allowance is included free. If
you have an Anthropic API key, you can add it in settings to remove the limit —
requests then go straight from your browser to Anthropic.

PRIVACY

• CONTEXA runs only on claude.ai. It touches no other site.
• It sends only your latest message and the reply you just received — never your
  history, your other conversations, or your account details.
• Your conversation text is never stored.
• No accounts, no profiles, no tracking, no analytics, no ads, no data selling.
• Your API key, if you provide one, stays on your device and goes only to
  Anthropic.

WHAT IT DOESN'T DO

It doesn't score your writing, nag you, or interrupt your typing. Nothing
overlays the composer. If it can't generate real suggestions, it says so plainly
instead of showing filler.

CONTEXA is an independent project. It is not affiliated with, endorsed by, or
sponsored by Anthropic.
```

**Category:** Productivity

**Language:** English

**Icon:** upload `extension/icons/icon128.png`

**Screenshots:** upload the four PNGs from `publishing/screenshots/` in this
order — `1-chips`, `2-inserted`, `3-dark`, `4-settings`.

These were captured from the real extension running against a local mock page.
For an unlisted listing that only your friends will open by link, that is fine —
nobody browses to it. **Retake them on real claude.ai before you ever switch to
public**, when screenshots start doing marketing work.

## Step 5 — privacy tab

**Single purpose**
```
CONTEXA has one purpose: to suggest follow-up prompts inside conversations on
claude.ai. After a Claude reply finishes, it generates suggested next messages and
displays them beneath the reply; clicking one inserts that prompt into the page's
message composer.
```

**Permission justifications** — one per permission, all required.

`storage`
```
Stores the user's own settings on their device: whether the extension is enabled,
their optional Anthropic API key, the backend URL, and a randomly generated
anonymous token used solely to apply a fair-use daily limit. No browsing data is
stored, and none of this is transmitted to us.
```

`https://claude.ai/*`
```
This is the only site the extension operates on and is essential to its single
purpose. The content script detects when a Claude reply has finished rendering,
reads the text of that reply and the user's preceding message in order to generate
relevant suggestions, and inserts the user's chosen prompt into the page's message
composer when they click a suggestion.
```

`https://api.anthropic.com/*`
```
Used only when the user has chosen to supply their own Anthropic API key. In that
mode the extension calls the Anthropic Messages API directly from the browser to
generate suggestions, so the user's key and conversation text never pass through
any server of ours.
```

`https://contexa-api.michu110899.workers.dev/*`
```
The extension's own backend, which generates suggestions for users who have not
supplied an API key. It receives only the user's latest message and the reply just
received, forwards them to Anthropic's API, returns the suggestions, and stores
nothing.
```

**Data usage** — declare these three, and only these three:

- **Authentication information** — the user's optional API key, stored locally
- **Personal communications** — the message and reply text sent for processing
- **Website content** — the text of the current reply, read from the page

Leave unchecked: personally identifiable information, health, financial, location,
web history, user activity.

**Certifications** — tick all three; all are true of this build:

- I do not sell or transfer user data to third parties outside of approved use cases
- I do not use or transfer user data for purposes unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending

**Privacy policy URL:** the gist URL from Step 1

## Step 6 — distribution tab

- **Visibility: Unlisted**
- Regions: all
- Not for families / no ads / no in-app purchases

## Step 7 — submit

Click **Submit for review**. Expect a few days; first submissions and anything
declaring personal communications take longer. If it's rejected, read the exact
policy clause cited, fix only that, and resubmit noting what changed.

---

## After it goes live — three things, in order

**1. Pin the extension to your backend.** The store assigns a permanent extension
ID. Until you pin it, anyone who finds your Worker URL can spend your inference
budget.

```powershell
cd "$env:USERPROFILE\contexa\worker"
npx.cmd wrangler deploy --var ALLOWED_EXTENSION_IDS:THE_STORE_EXTENSION_ID
```

Then confirm the extension still works — if it breaks, the ID was wrong, and a
plain `npx.cmd wrangler deploy` puts you back to unpinned.

**2. Remove your unpacked copy** and install from the store link instead.
Otherwise two copies run at once and you get duplicate chips.

**3. Decide the daily limit before you send the link.** You hit 20/day yourself in
a single day of use. Friends who like it will too, and their reaction won't be
"fair enough" — it'll be "it stopped working." The limit lives at the top of
`worker/src/index.js`:

```js
const DEVICE_DAILY_LIMIT = 20;
```

| Limit | Worst case per user/day | 10 friends, worst case |
|---|---|---|
| 20 | $0.08 | ~$24/month |
| 50 | $0.20 | ~$60/month |

Real usage lands well under worst case. 50 is the difference between a limit
nobody notices and one they hit weekly.

## What to ask your friends

Not "do you like it." Ask:

1. Of the chips you clicked, how many were things you wouldn't have thought of?
2. Did you click the first one, or further along?
3. Are you still clicking them in week two?

Question 1 is the product. Question 3 decides whether it has a future.
