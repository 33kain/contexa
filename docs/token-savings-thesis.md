# Every token earned — the CONTEXA token-savings thesis

*Status: adopted as the product's standing rule and its motto. This document
states the claim, ties each part of it to the code that enforces it, does the
arithmetic, names what the claim forbids, and lists where it is not yet true.*

---

## The motto

**Every token earned.**

A token is *earned* when the message it belongs to could not have been shorter,
could not have been skipped, and will not need a follow-up to fix. Every design
rule in this repository is a way of refusing to spend a token that was not
earned — on the user's side, in their claude.ai usage, and on ours, in the
inference bill behind the hosted path. The rest of this document is the
argument for why that is one rule and not two.

---

## 1. The claim

CONTEXA reduces what a Claude session costs in two places at once:

1. **The user's claude.ai usage.** Every message a user sends on claude.ai
   re-reads the whole conversation as context. The expensive thing in a
   session is therefore not the length of any one message but the **number of
   turns**, and the cheapest turn is the one that never has to be sent. CONTEXA
   exists to make the next turn a finished, single-job request, so that the
   clarifying round, the "explain that again" round and the half-answered
   multi-ask round do not happen.
2. **The inference behind the product.** The one model call CONTEXA makes is
   made only when asked, once per reply asked about, on a payload clamped from
   every side, against a cached system prompt, and never repeated for a row the
   user has already seen.

The two halves share one mechanism. A move that was not earned by the session
is a form field, and a form field becomes a turn the user did not need. Refusing
to generate it is what saves the user's tokens; refusing to *call* for it is
what saves ours.

---

## 2. Where tokens go in an ordinary session

Four turn shapes account for most of the waste in a long claude.ai session.
None of them is a bad answer from Claude; each is a message the user sent that
bought less than it cost.

| Turn shape | Why it costs | What it buys |
|---|---|---|
| **The vague follow-up** ("ok now do the next part") | Claude re-reads the whole context, then asks *which* part | A clarifying question, i.e. another turn |
| **The multi-ask** ("add the form, write the menu page and make it mobile-first") | Three jobs in one prompt | Three half-answers and three re-asks |
| **The second pass** ("expand on that", "explain what you just said") | A full context re-read to restate material already on screen | Nothing the user had not already read |
| **The re-explained context** (pasting the goal again because the thread got long) | Tokens spent on what the model already had | Position, not progress |

Every one of these carries the full session as context, so a wasted turn on a
twenty-turn thread costs twenty turns' worth of reading. That multiplier is
the whole reason the number of turns, and not the size of any one message, is
the quantity worth defending.

---

## 3. The six mechanisms, and where each lives

### 3.1 One click is one finished prompt, and one prompt is one job

`MOVES_SYSTEM` (the single system prompt, byte-identical in
`extension/background.js` and `worker/src/index.js`) makes every move a
message "ready to send verbatim", with **one ask and one imperative verb**. A
bullet that could be sent on its own as a complete request is a separate job
and is not allowed in the same move. This is the rule that removes the
multi-ask turn: a move that asks for one thing comes back as one answer, not
three halves.

Two devices inside the prompt pre-empt the clarifying round:

- **Slots.** Material only the user has — a file, a keyword, a link — appears
  as `<paste here>` or `<main keyword>`, at most two per move, filled in the
  message box before sending. The question Claude would have asked is answered
  before it is sent.
- **`Assume:` lines.** Up to two, each one a default the session has already
  settled. A silent choice baked into a prompt is a future correction turn; an
  `Assume:` line is that correction made in advance, for free.

The text is capped at 700 characters (`trimPayload`, identical on both
paths), and the filler-word ban ("thorough", "robust", "comprehensive") strips
the words that cost tokens and change nothing. Constraints change things.

### 3.2 The reply is material, never the subject

The prompt bans the second pass by name: "explain that again", "expand on your
answer", "as you mentioned", in any language, and the verb *explain* when it
opens no new ground. It also names transcription as the most seductive failure
— handing the user back the reply's own list of options with a perfect evidence
quote under each. Both produce the single most wasteful turn there is: a full
context re-read that yields nothing the user had not already read. The prompt
further requires that, once a session has more than a couple of turns, at
least one move be earned by something the **user** wrote, and `groundMoves`
tallies `fromTurns` against `fromReply` so a row that only read the last
message is visible in the log rather than invisible in the product.

### 3.3 Zero is a valid outcome

There is no floor, no fallback move, no minimum count and no ceiling
(`README.md`, Design notes). A session with nothing open earns `{"moves":[]}`
and an inert card, not a padded menu. Every padded move is an invitation to
send a turn the session did not need, and every failure class this project has
recorded came from something that guaranteed a non-empty row. The action gate
(`enforceAction`) fails closed for the same reason: an unknown verb is a drop,
never a pass.

### 3.4 Pay only when asked

Reply capture is eager because it is free; the model call is lazy because it
is not. Until 0.9.53 every completed reply spent a call, and the changelog
records what that bought: "the free tier's twenty were being eaten by replies
nobody ever looked at." Now nothing is sent until the user clicks the trigger
(`askNow` in `extension/content.js`), and the session itself is only read at
that moment. A reply nobody asks about costs nothing and never leaves the page.

The history-mining pivot (0.9.58) then removed the second call. A finished
prompt used to cost two upstream calls — questions, then compose. It now costs
one, and that one returns up to four send-ready prompts. The quota's unit moved
with it: `REPLIES_PER_DAY` in the worker meters how many replies a user can
ask about, and clicking a move costs no further model call. Cost per row rose
roughly 2.5x because a session is a bigger read than one exchange; cost per
prompt the user actually sends fell (`worker/README.md`, "What it costs you").

### 3.5 The one call is engineered small

Every byte that reaches the model has survived a clamp, and most clamps exist
because a real regression paid for them:

| Clamp | Where | Why it earns its place |
|---|---|---|
| Reply capped at 6,000 chars with an explicit end marker | `clampCapture`, `MAX_REPLY_CHARS` | A blind cut reads as truncation and the model requisitions the missing text; the marker prevents the phantom-defect move |
| Code blocks collapsed to their first 2 lines | `summarizeCode`, `CODE_KEEP_LINES` | Whole code blocks filled the budget and were echoed back until the token ceiling hit — three ceiling hits in one code-heavy session, zero elsewhere |
| Screen-reader duplicates and UI chrome skipped | `SKIP_SEL` | Hidden text is cost with no information, and worse, it is quotable |
| Session window: 40 turns, 2,000 chars each, 12,000 total, first turn pinned | `fitTurns`, `MAX_TURNS*` | Oldest *middle* turns go first, so the closest thing to a stated goal is never the thing dropped to save tokens |
| 2,500 output tokens, thinking disabled | `MAX_TOKENS`, `callClaude` | Adaptive thinking was observed spending the whole budget with zero text out |
| System prompt marked cacheable | `cachedSystem` (worker) | The ~2.4k-token fixed prefix was re-billed at full input price on every call until 2026-08-27; caching it is the largest cost lever available and changes nothing a user sees |
| Per-session result cache, keyed on the whole session | `stepsCache` in `chrome.storage.session` | A second click on a row already seen is a hit, not a re-roll that costs quota |

The cache key deliberately covers every turn, not the last exchange: mining
makes moves depend on everything *but* the last turn, so a narrower key would
serve one conversation another's moves.

### 3.6 Moves are independent, so a row is a menu, not a checklist

Each move stands alone and clicking one discards the rest. Four moves never
become four turns by design; the user picks the one job that advances the
earliest goal they can see. A row that could be "run in order" would be a
four-turn plan disguised as a choice, and the prompt rules it out explicitly.

---

## 4. The arithmetic

### 4.1 The user's side, illustrated

Take a twenty-turn build session where the user wants a contact form next.
Costs are in turns, because on claude.ai the turn is what re-reads the
context.

| | Without CONTEXA | With CONTEXA |
|---|---|---|
| User sends | "ok add a form" | "Add a contact form to the bakery site. - name, email, message… Leave the rest of the page as it stands." |
| Claude replies | "Which fields, and should it post anywhere?" | The form |
| User sends | "name email message, no backend" | — |
| Claude replies | The form | — |
| **Turns spent** | **4** | **2** |
| Context re-read | ~2× the session | ~1× the session |

This is illustrative, not measured; the field test's job is to measure it.
The direction is not in doubt: a single-job prompt with its defaults stated
cannot produce a clarifying round, and the 0.9.58 prompt's own worked
examples show exactly the three-half-answers case it removes.

### 4.2 Our side, derived from the worker's constants

From `worker/README.md`, a row at the clamp ceiling is roughly $0.02: up to
~4,500 input tokens and ≈600 output tokens at Sonnet 5's $2 / $10 per million.
The system prompt is ~2.4k of those input tokens on every call, and it is the
same bytes every time.

| Component (ceiling row) | Full price | With prompt caching |
|---|---|---|
| System prompt, ~2,400 tokens | ~$0.0048 | ~$0.0005 on a cache read (10% of input price) |
| Session + reply, ~2,100 tokens | ~$0.0042 | unchanged |
| Output, ~600 tokens | ~$0.0060 | unchanged |
| **Row** | **~$0.015** | **~$0.011** |

Caching alone removes roughly a fifth of a ceiling row and a larger share of a
short one, where the fixed prefix is most of the input. The first call in a
cache window pays a write premium; every call after it pays a tenth. These are
derivations from published prices and the constants in the worker, not
measurements: the worker comment says to trust `usage` on a live call
(`cache_creation` / `cache_read` tokens) over any comment, and that includes
this table.

The lazy call is the larger lever and it does not show up in a per-row table
at all, because its saving is the rows that never happen. Before 0.9.53 a
twenty-turn conversation could spend the whole daily pool with nothing
clicked. After it, spend tracks clicks.

---

## 5. What the thesis forbids

These are the rules that follow from "every token earned". Each has already
been tried the other way and paid for.

- **No floor, no fallback move, no minimum count.** A guaranteed row is a
  guaranteed unearned turn.
- **No per-reply model call.** Capture eagerly, call on click. Never restore
  an "auto" mode that spends the pool on replies nobody asked about.
- **No second pass.** No "tell me more", no "expand on that", no transcription
  of the reply's own list.
- **No free-text box.** Material the user must supply becomes a slot inside the
  written prompt, so the prompt ships complete on the first send.
- **No decoration in the system prefix.** A version stamp or timestamp
  interpolated into `MOVES_SYSTEM` would invalidate the cache on every call
  while looking correct. The prefix is the constant, and nothing else.
- **No unbounded input.** A client can send anything; only what survives the
  worker's clamps is billed, and the own-key path applies the same clamps so
  both halves of the user base get one product.
- **No shortening the system prompt below the cacheable minimum.** A prompt
  that is too short to cache is not an error, just a bill. Check `usage`
  after any trim.

---

## 6. Where it is not yet true

A thesis that only lists its successes is marketing. These are the gaps.

1. **The own-key path does not cache the system prompt.** `callClaude` in
   `extension/background.js` sends `system` as a plain string; only the
   worker wraps it in `cachedSystem` with `cache_control`. A user on their own
   key pays full input price for the ~2.4k-token prefix on every click. The
   product is identical either way, so `build.mjs` does not catch it, and the
   "hosted and own-key must behave identically" rule has not so far been read
   as covering cost. It should be. This is the first follow-up.
2. **The user-side saving is argued, not measured.** Nothing in the product
   records whether a sent move produced a clarifying question, or how many
   turns a session took to reach an outcome. The field test asks how often the
   row comes back empty; it should also ask how often a clicked move is sent
   unchanged and how often the next reply is a question back.
3. **A virtualised transcript is read from the tail.** On a long page the
   capture sees rendered rows only, so the "earliest turn" is the oldest
   *visible* one. The moves may then advance the wrong goal, and a wrong-goal
   move is an unearned turn with a perfect evidence quote. `askNow` logs the
   `i` range so this is diagnosable; it is not yet solved.
4. **The zero rate is unknown.** Zero is the honest answer more often than it
   feels, and every zero is a click that bought nothing. If the rate is high,
   the trigger itself becomes the unearned spend, and the fix is upstream of
   the prompt (showing the trigger less, or later), not a floor.

---

## 7. How to measure it

The instrumentation for most of this already exists; what is missing is the
habit of reading it.

- **`in` / `out` per call** — already returned by `diagnose` on both paths.
  **`cache_read` is not**: `diagnose` reads `usage.input_tokens` and
  `usage.output_tokens` only, so whether the prefix was served from cache is
  currently visible nowhere but the bill. Adding the two cache fields to
  `diagnose` is a one-line change on each path, and the number to watch is the
  share of input tokens served from cache; if it is not close to the system
  prompt's share, caching has silently stopped.
- **Rows per click and moves per row** — `total` before the gates and the
  count after, already in the grounding result. Track the drop rate per gate.
- **`fromTurns` vs `fromReply`** — already tallied. A row earned only by the
  reply is a row that read the last message, which is the failure the session
  read exists to avoid.
- **Sent-unchanged rate** — not yet recorded. Whether the composed text was
  edited before sending is the closest available proxy for "no clarifying
  round needed", and it can be observed in the content script without any
  server call.
- **Turns to outcome** — the number that would settle section 4.1. It needs a
  definition of "outcome" the field test can agree on before it needs code.

---

## 8. Why this is the motto and not a feature

"Claude prompts, without the writing", the tagline the site carried until
this document, describes what CONTEXA does. "Every token earned" describes why every decision in the repository went the way it
did: the empty card, the single trigger, the lazy call, the pinned first turn,
the collapsed code block, the byte-identical prefix, the refusal to add a text
box. None of those was chosen to save tokens in the first instance; each was
chosen because the alternative produced a turn the user did not need, and a
turn the user did not need is the same thing as a token that was not earned.
The motto is the rule that was already being followed, written down so it can
be enforced.
