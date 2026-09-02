# X post — Vibe Coding community (tool submission)

Rule 2 of the community says every tool has to be posted inside the X
community first and approved by the mods before it can be posted anywhere
else. This is that post. Post it **inside** the community
(https://x.com/i/communities/1898129646782497027), not on your timeline,
and attach `store-assets/contexa-demo.gif` as the media.

Rule 1 says keep it human and Rule 3 says a link alone is low-effort promo, so
the post names the stack and one real build lesson. Everything below is a fact
from the repo; nothing is invented.

---

## The post (279 characters as X counts them, fits a free account)

```
CONTEXA: a Chrome extension for claude.ai.

Claude replies. Press one button and it reads your side of the chat, then writes up to 4 complete next prompts. Pick one, it lands in the box.

Plain JS, no deps, Cloudflare Worker, built with Claude Code. MIT.

github.com/33kain/contexa
```

---

## Reply 1 — how it was built (post as a reply to your own post)

```
How it's built:

- extension/: plain MV3 JS, no bundler, no node_modules
- worker/: Cloudflare Worker, holds the API key, 20 replies/day per device
- 313 tests in two flat Node scripts
- Claude Code writes the code, I write the rules. CLAUDE.md is the contract.
```

## Reply 2 — the one lesson (post as a second reply)

```
The rule that fixed the most bugs: if it finds nothing, it shows nothing.

Every failure I logged came from something that guaranteed a non-empty result. A canned fallback when the API failed. A fifth chip "just in case". Both gone. Zero is a valid outcome.
```

---

## After it is approved

The mods DM you on X. Once that lands you get one intro post (this was it)
and, after that, only major feature updates. Then post the Reddit version in
`reddit-vibe-coding.md`.
