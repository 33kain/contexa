# CONTEXA — Chrome Web Store listing copy

Paste-ready text for each field in the developer dashboard. Fill the two
bracketed placeholders before submitting.

---

## Name (45 char limit)

```
CONTEXA — Next-Step Prompt Suggestions
```

*38 characters.*

**Note on naming:** I deliberately kept "Claude" out of the extension **name**.
Chrome Web Store policy prohibits listings that imply affiliation with another
company, and a name like "… for Claude" is a common trigger for that review.
Describing the integration in the description is fine and normal; putting it in
the name invites scrutiny. The disclaimer at the end of the description covers
the rest.

---

## Short description (132 char limit)

```
Get five smart next-step prompts after every Claude reply. Click one to load it, edit it, send it. No API key required.
```

*118 characters.*

---

## Detailed description

```
CONTEXA suggests what to ask next.

When a Claude reply finishes, five short chips appear beneath it — each one a
concrete next step for the work you're actually doing. Click a chip and the full,
specific prompt loads into the composer, where you can read it, edit it, or send
it as-is.

It's the moment you didn't know what to ask, solved.

WHY IT HELPS

Most of us send vague prompts and get vague answers back. The fix isn't a longer
prompt, it's a more specific one — and writing specific prompts is a skill.
CONTEXA reads the conversation you're already in and proposes the five moves a
sharp collaborator would suggest: going deeper on the valuable part, resolving
what the reply assumed, producing the actual artifact, trying a different framing,
or pressure-testing the result.

The chips stay short so you can scan them in a second. The prompt behind each one
is detailed — it names the deliverable, the format, the length, the constraint.
You always see the full text in the composer before anything is sent.

HOW IT WORKS

• Install it, open claude.ai, and send a message.
• When the reply finishes, five chips appear underneath.
• Click one. The full prompt lands in your composer. Edit or send.

No setup, no account, no sign-in. 20 replies per day are included free. If you
have an Anthropic API key, you can add it in settings to remove the limit
entirely — requests then go straight from your browser to Anthropic.

PRIVACY

• CONTEXA runs only on claude.ai. It touches no other site.
• It sends only your latest message and the reply you just received — never your
  history, your other conversations, or your account details.
• Your conversation text is never stored.
• No accounts, no profiles, no tracking, no analytics, no ads, no data selling.
• Your API key, if you provide one, stays on your device and goes only to
  Anthropic.

Full policy: [YOUR_PRIVACY_POLICY_URL]

WHAT IT DOESN'T DO

It doesn't score your writing, nag you, or interrupt your typing. Nothing
overlays the composer. If it can't generate real suggestions, it says so plainly
instead of showing filler.

CONTEXA is an independent project. It is not affiliated with, endorsed by, or
sponsored by Anthropic.
```

---

## Category

**Productivity** (secondary, if offered: Workflow & Planning)

---

## Single purpose description

Required field. Reviewers reject vague answers here.

```
CONTEXA has one purpose: to suggest follow-up prompts inside conversations on
claude.ai. After a Claude reply finishes, it generates five suggested next
messages and displays them beneath the reply; clicking one inserts that prompt
into the page's message composer.
```

---

## Permission justifications

Each permission must be justified individually and specifically.

### `storage`

```
Stores the user's own settings on their device: whether the extension is enabled,
their optional Anthropic API key, the backend URL, and a randomly generated
anonymous token used solely to apply a fair-use daily limit. No browsing data is
stored, and none of this is transmitted to us.
```

### Host permission: `https://claude.ai/*`

```
This is the only site the extension operates on and is essential to its single
purpose. The content script detects when a Claude reply has finished rendering,
reads the text of that reply and the user's preceding message in order to generate
relevant suggestions, and inserts the user's chosen prompt into the page's message
composer when they click a suggestion.
```

### Host permission: `https://api.anthropic.com/*`

```
Used only when the user has chosen to supply their own Anthropic API key. In that
mode the extension calls the Anthropic Messages API directly from the browser to
generate suggestions, so the user's key and conversation text never pass through
any server of ours.
```

### Host permission: `[YOUR_WORKER_HOST]/*`

```
The extension's own backend, which generates suggestions for users who have not
supplied an API key. It receives only the user's latest message and the reply just
received, forwards them to Anthropic's API, returns the suggestions, and stores
nothing.
```

**Before you submit:** replace the `https://*.workers.dev/*` wildcard in
`manifest.json` with your exact deployed host. A wildcard across an entire
shared domain is a legitimate review flag; a single pinned host is not.

---

## Data usage disclosures (dashboard checkboxes)

Answer these exactly as follows, because they must match the code.

**Does your extension collect user data?** — Yes (conversation text is
transmitted for processing, which counts as collection even though it isn't
stored).

Data types to declare:

| Type | Declare? | Why |
|---|---|---|
| Personally identifiable information | No | No name, address, email, or ID is collected. |
| Health information | No | — |
| Financial and payment information | No | — |
| Authentication information | **Yes** | The user's optional API key is stored locally. |
| Personal communications | **Yes** | The message and reply text sent for processing. |
| Location | No | — |
| Web history | No | Only the active claude.ai reply is read; no history is accessed. |
| User activity | No | No clicks, analytics, or behavioural monitoring. |
| Website content | **Yes** | Text of the current reply is read from the page. |

Three certifications to check (all true of this build):

- I do not sell or transfer user data to third parties outside of approved use
  cases. ✔
- I do not use or transfer user data for purposes unrelated to my item's single
  purpose. ✔
- I do not use or transfer user data to determine creditworthiness or for lending
  purposes. ✔

---

## Placeholders to fill

| Placeholder | Where | What to put |
|---|---|---|
| `[YOUR_PRIVACY_POLICY_URL]` | Detailed description + dashboard privacy field | Public URL of `PRIVACY.md` (GitHub Pages or Gist works) |
| `[YOUR_WORKER_HOST]` | Permission justification | Your deployed Worker host |
| `[YOUR_CONTACT_EMAIL]` | Inside `PRIVACY.md` | A contact address — consider a dedicated one rather than your personal inbox, since it will be public |
