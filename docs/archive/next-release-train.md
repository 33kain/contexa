# Next release train (v0.9.19) — prepared content, full text

Nothing here is applied yet. The voice patch changes the prompt, and prompt
changes ship in both artifacts together (worker deploy + extension reload).
The copy changes are text-only and ride the same train to keep one commit.

---

## 1. The voice patch — one line added to the prompt's Hard rules

Earned by three field sightings (fires #1–#3), sharpened by fire #4's
counter-example, where a chip addressed Claude and was *right* to — proving
the defect is action-ownership, not voice. Add this line to `Hard rules:` in
`NEXT_STEPS_SYSTEM`, byte-identically in `worker/src/index.js` and
`extension/background.js`:

```
- The text always addresses Claude. When an action can only be done by the user — running a command on their machine, clicking, waiting, pasting — the text directs Claude to prepare or verify Claude's side of it; it never commands Claude to perform the user's action and never contains instructions aimed at the user.
```

Build note for the train: add a source assertion in `extension/test.mjs`
that the prompt contains "always addresses Claude", per the joint-testing
rule.

---

## 2. README copy — replaces the description in `extension/README.md` and the root `README.md`

One-liner (for the top of either file, and anywhere a single sentence is
needed):

> CONTEXA reads Claude's reply and hands you your next message — the one
> Claude itself would ask you to send.

Full description:

> CONTEXA is a Chrome extension for claude.ai. When Claude finishes a reply,
> CONTEXA reads it and offers up to five chips — each one a complete next
> message, written and ready to send. Click a chip and it lands in your
> composer; you read it, change anything, and send it yourself. Nothing is
> ever sent for you.
>
> The chips aren't topic suggestions. They're the messages Claude would
> request if it could: paste the file it's been guessing about, settle the
> fork it hedged — "Assume X. Redo under exactly that." — give it permission
> to stop listing options and build the full version, or turn the problem
> around entirely. Every chip must be earned by something the reply actually
> said; no quotable evidence, no chip. A reply blocked on one missing thing
> gets one chip, not five fillers.
>
> No account, no API key, free for up to twenty replies a day. Nothing
> overlays your composer, nothing scores your writing, and nothing appears
> unless it's real.

---

## 3. Chrome Web Store listing — replaces the stale copy in `LISTING.md`

**Short description** (122 characters, under the 132 limit):

> Reads Claude's reply and hands you your next message, ready to send — next
> steps grounded in what the reply actually said.

**Full description** (store body; 250+ words; non-affiliation and privacy
kept from the approved submission):

> CONTEXA is a Chrome extension for claude.ai. When Claude finishes a reply,
> CONTEXA reads it and offers up to five chips — each one a complete next
> message, written and ready to send. Click a chip and it lands in your
> composer. You read it, edit anything you like, and send it yourself.
> Nothing is ever sent on your behalf.
>
> These are not generic topic suggestions. Each chip is the message the
> assistant would ask you to send if it could: paste the exact file or error
> it has been reasoning about blindly; settle a fork its reply hedged
> ("Assume X. Redo under exactly that."); give it permission to stop
> surveying options and produce the complete version; or turn the problem
> around and attack it from the opposite side. Every chip has to be earned
> by something the reply actually said — if there is no quotable evidence
> for a suggestion, it is not shown. A reply that is blocked on one missing
> input gets one strong chip, not five fillers, so the number of chips tells
> you something true about where your conversation stands.
>
> CONTEXA works out of the box: no account, no API key, no setup, free for
> up to twenty replies per day. If you have your own Anthropic API key, you
> can add it in settings to remove the daily limit — your key is stored
> locally in your browser and used only to call the Anthropic API directly.
>
> Privacy, plainly: to generate suggestions, CONTEXA sends your last message
> and Claude's reply for that one exchange, and nothing else. The text is
> not stored, and there is no account or profile attached to it. Nothing is
> sent until a reply finishes, and never from a conversation you don't send
> a message in. Nothing overlays your composer, nothing scores your writing,
> and nothing appears unless it is real.
>
> CONTEXA is an independent project and is not affiliated with, endorsed by,
> or sponsored by Anthropic. Claude is a trademark of Anthropic, PBC.

---

## Train manifest (when this ships as 0.9.19)

1. Prompt: add the voice line to both copies; bump worker BUILD and extension
   version to 0.9.19; `build.mjs` VERSION likewise; new source assertion.
2. Docs: place §2 into both READMEs, §3 into LISTING.md.
3. Ship: `node build.mjs` → `wrangler deploy` → reload extension →
   `release-commit.ps1` → push.
4. Store: if the listing is approved by then, the §3 copy goes into the
   dashboard as an update alongside the 0.9.19 zip.
