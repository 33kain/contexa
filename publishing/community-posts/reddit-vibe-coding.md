# Reddit post — r/vibecoding

Rule 3 there: "Here's the project; here's how I made it." Tools, process,
build insights, or it gets removed as promo. Rule 1: written by a human, AI
only to shape thoughts. The draft below is in your voice and every number
comes from the repo. Read it once and change anything that is not how you
would say it before posting.

Post it **after** the X community approves the tool (Rule 2 on Reddit points
at the same X process), and use the Reddit flair for Claude Code if one
exists by then.

---

## Title

```
I built a Chrome extension that writes your next Claude prompt from your own messages. Here's how, and the rule that fixed most of the bugs.
```

## Body

```
**What it is**

CONTEXA is a Chrome extension for claude.ai. When Claude finishes a reply, a small chip appears above the message box. Nothing happens until you click it. Click it, and it reads your own messages from the whole conversation, works out what you have been building toward, and offers up to four next prompts. Each one is already a complete message. Click one and it lands in the box. You read it, edit it, send it yourself. It never sends anything for you.

Free, no account, no API key. Open source under MIT.

**Tools**

- Claude Code for nearly all of the code. I write the rules and the changelog, it writes the JavaScript.
- Plain Manifest V3 JavaScript. No bundler, no node_modules anywhere in the repo.
- Cloudflare Worker as the backend. It holds the real Anthropic key as a secret and enforces 20 replies a day per device. If you set your own key in the options page, the extension calls Anthropic directly and skips the worker.
- Claude Sonnet 5 is the model behind it.
- Two flat Node test scripts, 313 checks total, no test framework. GitHub Actions runs them plus the build on every push.
- Chromium driven by a script to take the store screenshots against a mock of claude.ai's DOM, so they always show the current build.

**How I work with Claude Code**

The repo has a CLAUDE.md that states the invariants: what must stay byte-identical, what the product must never do, which DOM selectors are load-bearing. Every session starts from that file instead of from my memory. The CHANGELOG is written like a lab notebook, what was measured, what changed, what is still open, because that is the context the next session gets.

Prompts I expect to reuse live in the repo too. There is a brand prompt and a website prompt in publishing/ that I paste into a fresh session when I need that job done again.

**Three things I would not have guessed going in**

1. Zero is a valid outcome. Earlier builds fell back to canned suggestions when the API failed, and later I added a fifth chip so a click never came back empty. Every failure class I logged came from something that guaranteed a non-empty result. Both are gone. If the session has nothing open, no row is drawn at all, and that is it working.

2. Two copies of the same prompt drift. The extension and the worker each hold the system prompt, because own-key users and hosted users must get the same product. The build script extracts both by regex and fails the build if they differ by a byte. Same for the three functions that police the model's output. A check that lives only in the worker is a check half the users do not have.

3. An allowlist fails closed, and you cannot be generous from memory. Every move has to open with an action verb from a list, in English or Serbian. I streamed the live worker log across ten sessions: 36 moves returned, 14 dropped. Nine of the 14 were good clicks the list simply did not know. The comment above the list already said "be generous". The missing words are by definition the ones that did not occur to you, so now the list carries the numbers and a note to re-read the log when results look thin.

**One design detail**

Long conversations do not fit in the request, so something has to be dropped. The obvious window, keep the last N messages, passes every test and silently cuts off the first message, which is usually where you said what you were trying to do. So turn one is pinned, the oldest middle turns go first, and the floor is two.

Everything the model returns is rendered with createElement and textContent, never innerHTML. It is AI text going into a third-party page.

**What I still do not know**

How often a click returns nothing on real conversations. Ten invented sessions gave me the verbs. Only real use gives the rate. If you try it, that is the number I want to hear about.

Repo: https://github.com/33kain/contexa
Chrome Web Store: https://chromewebstore.google.com/detail/phhamigkjeeabbjncpmhkppkjccfglhb
```

---

## Before you post, confirm two claims

Both are true of the repo as written. Change the wording if they are not
true of how you actually work:

- "Claude Code for nearly all of the code. I write the rules and the changelog, it writes the JavaScript."
- "I paste into a fresh session when I need that job done again." (from `publishing/BRAND-PROMPT.md` and `WEBSITE-PROMPT.md`)

Attach `contexa-social-1200x675.png` (in this folder) as the post image.
