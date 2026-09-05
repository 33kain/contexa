# Changelog

One version number per generation. Its home is `extension/manifest.json`; the
**backend** carries the same number as `BUILD` in `worker/src/index.js`, and
`build.mjs` fails if the two disagree. They still deploy on separate paths — a
worker fix must not force a Chrome Web Store resubmission — so an entry below
says which artifact(s) actually shipped, and the settings page reports the
backend's live version separately so a deploy can be told from a no-op.

---

## 0.9.91 — Extension (worker build number only)

*Sixteenth card: `projects API: n=4 … match by record id: none`,
`code project record: http_404`, and the page links two projects.* The
org's project list does not carry the `claude_proj_…` id and the code API
has no single project record. `coworkProjectLookup` gains three sources
behind the list: each listed project's detail (searched for the id, extra
keys recorded), `/v1/code/projects` as a list, and `pageProjectFetches` —
the session page shows its project's name, so it fetched
`/api/organizations/<org>/projects/<uuid>`, and that request is in the
page's resource timing; it is a source only when exactly one project uuid
was fetched. The diag names every step, any page request carrying
`claude_proj`, and each page project link with its ancestor path.

---

## 0.9.90 — Extension (worker build number only)

*Fifteenth card: the chip opened the Squiggle project.* The first
`/cowork/project/` link on a session page is the sidebar's first project,
not the session's own, so the page is not a source. `coworkProjectLookup`
(run inside `coworkRead`) asks `/api/organizations/<org>/projects` for the
entry that carries the record's `claude_proj_…` id anywhere and takes its
uuid; failing that it reads `/v1/code/projects/<id>` with the page's headers
and records the shape and any uuid-shaped field. With no answer the chip
copies the brief and opens nothing — a wrong project is worse than a copy.
The diag card carries the address that would open, each lookup step, and
every project link the page holds (informational only).

---

## 0.9.89 — Extension (worker build number only)

*Fourteenth card: "Couldn't load this project" at
`/cowork/project/claude_proj_011CeA…`.* The record's `chat_project_id` is a
`claude_proj_…` id; the project page's address is the project's uuid, which
the record does not carry. The session page links to its own project in the
breadcrumb, with the exact address, so `coworkProjectUrl` reads that link at
click time; the record's id is used only when no link exists and it already
looks like a uuid; otherwise the chip copies. The diag card says which it
found.

---

## 0.9.88 — Extension (worker build number only)

*Thirteenth card: the brief landed by itself in the composer of
`claude.ai/cowork/project/<id>`, the project page where a new Cowork
session starts. The id is `chat_project_id` in the session record the
extension already reads. The Cowork exit is one click, end to end.*

### The exit on Cowork

The fork chip on a Cowork session copies the brief, parks it, and opens the
session's project page; the content script loading there lands it. When the
record carries no project id, the chip copies and says the brief will drop
into the next new session. `EXISTING_RE` names an existing conversation
precisely — a chat, a Cowork session, a Code session — so a project page is
never mistaken for one.

### The probe, retired

`probe.js` did its job: every endpoint and header this product needed on
Cowork is now known and written down in `tokenbrake/HANDOFF.md`. A script
that wraps the page's own `fetch` has no place in a store build, so it is
gone from the manifest and the tree; the three-tap diagnostic card stays,
without the paths section.

### What ships

The extension, as the store candidate that 0.9.74 was going to be, with the
field's twelve rounds behind it. The worker's `BUILD` moves with the
manifest; behaviour unchanged from 0.9.86.

---

## 0.9.87 — Extension (worker build number only)

*Twelfth card, and the number the whole plan was for:*

```
Brief ready: ≈ 444 tokens instead of ≈ 124k per send.
```

The first brief off a live 123,813-token Cowork session. The next message in
a fresh session reads 444 tokens where this one reads 123,813 — 99.6% less
per send, measured, not estimated. The thesis's open question has its first
answer.

### The landing without an address

`claude.ai/cowork` redirects to a marketing page, and the screen a Cowork
session starts from has no known address. So the landing stopped needing
one: any claude.ai page that is not an existing conversation, has a composer
and holds no messages yet is where a parked brief may land, and the take —
which consumes — happens only once those three hold, so a page that is not
the one leaves the brief parked for the next, within the TTL. On Cowork the
fork copies and parks and opens nothing; the user starts the new session
their own way and the brief drops in.

---

## 0.9.86 — Extension + Worker

*Eleventh card: the tail read works (137 user turns in the last 3,000 events
of 23,435), the moves came from the present, and the first live fork on the
123k-token session came back "Couldn't write suggestions for this reply" —
an error the card could not tell apart from two others.*

### The brief out of a broken answer

The two likely causes are a brief cut at the output ceiling (the JSON never
closes) and raw line breaks inside the string (JSON that never parses). Both
leave the brief's text in the reply after `"brief":"`, so `rawBrief` — in
the injected block, byte-identical on both paths — takes it, unescapes it,
and lets `cleanBrief` cut it at a clean line. The result is flagged
`partial`, like a salvaged row of moves: the model's own words, shorter,
never invented. Nothing after `"brief":` is still the error it was. The
fork's ceiling moves from 1,200 to 2,000 output tokens on both paths.

### The card

The diagnostic card now carries the last error with its diag — stop reason,
tokens out against the ceiling, whether JSON started — so the next field
report of a failed call names its cause.

### What ships

Both. The worker, for the ceiling and the salvage on the hosted path.

---

## 0.9.85 — Extension (worker build number only)

*Ninth and tenth cards.* The stream takes `limit=500`; its cursor is a
sequence number (the page reads its own tail with `?limit=500&cursor=22857`);
every answer carries `resume_cursor`. And a click on the mascot on the live
Cowork session returned real moves — from the EARLIEST 26 user turns of a
23,000-event session, because the walk went forward from page one.

### Head and tail

`coworkTurns` now reads one page of 500 from the start, for the goal, then
the last 3,000 events back from `resume_cursor`, where the work is; four
head turns and every tail turn, ordered by sequence, deduplicated by event
id, and handed to `fitTurns` as before. Without a numeric head of stream the
forward walk stands, bounded at twelve pages.

### Start fresh on Cowork

The chip copies the brief (the floor that cannot fail), parks it, and opens
Cowork's new-session screen; the content script loading there lands it if it
finds a composer. `collectBrief` accepts `/cowork` as well as `/new`.

---

## 0.9.84 — Extension (worker build number only)

The three-tap diagnostic card now opens from any card, not only the ones
with a wordmark: the honest zero and the error card carried none, and after a
click those are the cards most likely to be up. A tap on a button or a chip
does not count toward the three.

---

## 0.9.83 — Extension (worker build number only)

*Eighth card, and the line: `≈ 124k tokens re-read per send · Start fresh`,
on a live Cowork session, from `context_usage.used_tokens: 123813` of
1,000,000. Exact, not estimated. The rendered read on the same page said
6,647 characters in three blocks.*

The brief is what is left. The first page of events is the session's birth
(control requests, environment logs, two `active_goal`s) and the session has
over 23,000 events, so a walk of fifty a page from the start is not the way
to the user's turns. This build asks the stream three questions whose answers
are a status and a count — is `limit` honoured, is `from_sequence_num`
accepted, both — and reports the shape of the two cheap sources a Cowork
brief could be built from: the `active_goal` event's payload and the
record's `post_turn_summary`. The walk, when a click runs it, now reports the
event types it saw.

---

## 0.9.82 — Extension (worker build number only)

*Seventh card: both reads answer 200 with `anthropic-version`.* The record
came back as one key, `response_shape`, with no count; the events came back
as `data[]` of `{ event_type, payload, … }`, fifty a page with
`next_cursor` — and the parser was looking for `type: 'user'`, so it found
none. The session reads now send the full set of headers the page sends
(read off the probe: an API version, a beta name, two client identifiers and
the organisation id), the token count is found anywhere in the record's first
levels, a user turn is an event whose type or payload role names the user,
and the pages are walked on a click — never at render — following
`next_cursor`, forty at most. The card says which event types the page holds
and what a user payload looks like, in case this is still wrong.

---

## 0.9.81 — Extension (worker build number only)

*Sixth card: `page API: failed (cowork record): http_400`.* The page reads the
same URL and gets its answer; the extension's read, with the same cookies, gets
a 400 — the shape of a missing request header on this API. The probe now
records, for `/v1/code/sessions/` calls only, the method, the query string,
the header names, the values of `anthropic-*` headers (API version strings,
never secrets), and the status the page received. The extension's own reads
send `anthropic-version` meanwhile, the likeliest missing piece.

---

## 0.9.80 — Extension (worker build number only)

*The fifth card from the field, and the number the whole plan was for.*

The card listed the page's own calls on a Cowork page: `/v1/code/sessions/
<id>` and `/v1/code/sessions/<id>/events`, same origin. A Cowork session is a
Claude Code session in Anthropic's cloud, and its record carries
`context_usage.used_tokens` — the context the next message will re-read,
exact. The session this was found on read **123,813 tokens** where the DOM
estimate read 6,324 and the scaled one 8,320. Its lifetime figures: 245M
tokens read from cache, $1,432. That is what "every send re-reads the whole
thread" costs on a long Cowork session, measured.

### The Cowork read

`coworkRead` fetches the record and takes the exact count; it fetches the
events and takes the user's own messages (entries whose type or role is
"user" with text content; tool results are never a turn), parsed defensively
because their shape has only been seen from one card. Both key sets go to the
diagnostic card. The exact count outranks any estimate and redraws the label
row; the moves and the brief are mined from the session's real turns.

### The fork, on Cowork

A fresh chat at `/new` is not the exit from a Cowork session: the work lives
in a session with its folders and tools, and a new one starts from Cowork's
own screen, which this script does not drive. On a Cowork page the chip reads
"Copy the brief for a new session", copies it, and says so. One paste — the
smallest honest step until a new session can be opened with the brief in it.

### What ships

The extension, as a field build. The worker's `BUILD` moves with the
manifest; not redeployed.

---

## 0.9.79 — Extension (worker build number only)

*The third and fourth cards from the field, one from a chat and one from
Cowork.*

The chat card said `page API: 8111 chars in 11 messages, 6 yours` against
three user turns in the DOM: the API read works on the phone, and the session
the moves are mined from is now the whole one. The Cowork card listed the
page's own calls and the session's base — `/cowork/sessions/<id>/mcp-servers`
— and no call that carries the content, so the content arrives by a transport
the probe did not wrap, or from another origin.

### The probe, widened

`probe.js` now records fetch, XHR, WebSocket and EventSource, on any host,
as "transport host/path" — paths only, still; assets and the page's own
analytics are skipped.

### The Cowork shape

On a Cowork page, four GETs under the session's base (the base itself,
`/events`, `/messages`, `/transcript`) report their status and, on a JSON
200, the top-level key names — names, never values — into the card. One round
of this replaces guessing.

### What ships

The extension, as a field build. The worker's `BUILD` moves with the
manifest; not redeployed.

---

## 0.9.78 — Extension (worker build number only)

*The second card from the field.*

```
page API: no conversation id in /cowork/cse_013wFjkSS8bv1KkAUfnc6VqW
```

A Cowork session, not a chat. Cowork keeps three to five blocks on the page
(the 0.9.55 measurement, met again) and fetches its session from an API this
product does not know. Guessing an endpoint would produce a "failed: http_404"
card and nothing learned.

### The probe

`probe.js` runs in the page's own world (`"world": "MAIN"`, `document_start`,
claude.ai only) and wraps `fetch` and `XMLHttpRequest.open` to record the
PATH of each same-origin `/api/` call the page makes — never a body, a header
or a response — handing each new path to the content script as a string. The
diagnostic card lists the last fourteen, ids shortened. A Cowork session is
named as such in the card. A field diagnostic: to be removed, or kept as the
selector-drift aid, once the endpoint is known and implemented.

### What ships

The extension. The worker's `BUILD` moves with the manifest; not redeployed.
Not for the store in this form.

---

## 0.9.77 — Extension (worker build number only)

*The first diagnostic card from the field, and what it said.*

```
thread ≈ 6324 tokens (dom); rendered: 6647 chars in 3 blocks, scale ×3.81
page API: not asked
user turns in DOM: 1
```

Three blocks and one user turn, on a long chat. The DOM read is not
approximately wrong on that page; it is reading a different, much smaller
conversation. And "not asked" was the card's own fault: it could not tell a
pending API read from one never made.

### The session from the page's API

`apiThread` now keeps the user's own messages, whole and in order, clamped by
`clampTurn` like the DOM read; `sessionTurns` hands `askNow` and `askFork`
those turns through `fitTurns` when the API answered with more than the DOM
holds, and the DOM read otherwise. What is billed does not change — the same
clamps, the same ceiling — only how much of the session it is drawn from. On
that phone it was one turn; the prompt was written for the whole session.

### The card

`apiState` tells pending, no conversation id (with the path it saw), failed
(with the error) and ok apart, and the card redraws itself when the answer
lands, so a tap taken during a slow read no longer reports a lie.

### What ships

The extension. The worker's `BUILD` moves with the manifest; not redeployed.

---

## 0.9.76 — Extension (worker build number only)

*The second field session, same phone, same hour: 0.9.75 changed nothing.*

### The thread, from the page's own API

The rendered read is blind on that page in a way the 0.9.75 scaling cannot
fix: a transcript that loads its tail and keeps no spacer measures as short by
any DOM arithmetic. The page itself knows the whole thread — claude.ai fetches
its conversation as JSON from its own API, same origin, and the content script
runs on that origin. `apiThread` asks the same API (`/api/organizations/<org>/
chat_conversations/<id>`), read-only, with the page's own cookies, and counts
characters; the org comes from the `lastActiveOrg` cookie, else from
`/api/organizations`. Nothing leaves the page and the JSON is dropped. It runs
after the trigger card is drawn (`refineThread`); if it says the thread is
bigger, the label row is redrawn with the better number, so the line appears a
beat late rather than never. A private API, held to the private DOM's rule:
any failure is one console line and the rendered estimate stands.

### The diagnostic card

A phone has no console and, it turns out, no tooltip on a long press. Three
taps on the CONTEXA wordmark within two seconds now draw an inert card: the
version, what the thread read measured and from where, what the page's API
said or why it did not, the user turns and the last three lengths, the model
the page reports, the reply's size. Text only, no control. It is how the next
field report carries numbers instead of "nothing shows".

### What ships

The extension. The worker's `BUILD` moves with the manifest; not redeployed.

---

## 0.9.75 — Extension (worker build number only)

*The first field session of 0.9.74, on a phone, in about an hour.*

### What the field verified

The model nudge rendered on real claude.ai — "Sent on Opus, about 2.5×
Sonnet's usage per token" — on a chat whose composer bar read Opus 5. So
`MODEL_SEL`, the one host selector that had only ever been matched against
the mock, matches the live page.

### What the field found

**The cost line never rendered on a plainly long chat.** The reason is the
known limit `captureTurns` already lives with: a virtualised transcript holds
only its rendered rows in the DOM, so `threadTokens` summed a fraction of the
thread and stayed under the threshold on exactly the pages the brake is for.
The read is now scaled: the rendered blocks span some height, the scroller is
some height, and on a virtualised page the second is much larger than the
first. The ratio, capped at `VIRTUAL_MAX_SCALE`, scales the character count; a
page that is not virtualised has the two within padding of each other and
scales by 1. Still an estimate, still ≈; what changed is which direction it is
wrong in. Every read logs what it measured, and the CONTEXA wordmark's tooltip
(a long press on a phone) now says the number and the threshold, so "why no
Start fresh here" has an answer where there is no console.

**"On most chats it does not open."** A page that loaded already finished,
whose last reply carries no `data-is-streaming` flag, never mutates — and the
settle timer that stands in for the flag was armed only BY a mutation. Such a
page drew nothing, forever, with nothing in the console. The fallback is now
armed once at attach as well: the same 1.2 seconds of quiet, the same
fail-closed scan. Whether this is the whole of the field report is not known;
it is the one cause the code could produce on its own.

### What ships

The extension. The worker's `BUILD` moves with the manifest; its behaviour is
unchanged and it was not redeployed for this number.

---

## 0.9.74 — Extension (worker build number only)

*Brake 5 of the token-savings plan: the two nudges. One quiet line on the card,
no button, because the action is the next message the user writes.*

### Fragments

Three short user messages in a row (`FRAGMENT_RUN` of them, each under
`SHORT_TURN_CHARS`) on a thread of at least `FRAGMENT_MIN_THREAD_TOKENS`
(4,000 estimated) and the label row says: "Three short messages in a row,
each re-reading the thread (≈ 6k tokens). One message that asks for the whole
thing reads it once." The floor exists because three "ok"s on a two-turn chat
cost nothing worth a line.

### Model

A short, code-free last message (`simpleLast`) sent while claude.ai's model
selector reads Opus, and the row says: "Sent on Opus, about 2.5× Sonnet's usage
per token. A question this short is what Sonnet is for." The ratio is the API
list price, Opus 5 $5/$25 against Sonnet 5 $2/$10 per million tokens; claude.ai's
own weighting is not published, so the line says "about" and the comment names
the source. The selector is a pinned constant (`MODEL_SEL`) like every other
host selector, and an absent selector means no line, never a guess. The
extension cannot switch the model; it can only say.

### Precedence

`weightLine` chooses at most one line for the label row, in order of what it
saves: the long-thread cost line with its Start fresh control, then fragments,
then the model note. Both cards (the trigger and the mined row) go through it.

### What this is not

Retrospective, on purpose: the lines describe the message just sent, at the
one moment the pattern is complete and the composer is empty, and nothing
watches or overlays the composer. The plan's "ŠRAF classification" does not
exist in this repository; a simple fragment is defined in `content.js` as
short and free of code characters, and the field test will say whether that
is the right line. Verified in a real Chromium against the mock page
(`CX_NUDGE=1`): both lines render, neither carries a button, Sonnet on a
plain short thread draws nothing, and Opus on a long thread draws the cost
line rather than the model note.

### What ships

The extension. The worker's `BUILD` moves to 0.9.74 with the manifest because
the build guard requires it; its behaviour is unchanged from 0.9.73.

---

## 0.9.73 — Extension + Worker

*Brakes 2 and 3 of the token-savings plan (`tokenbrake/HANDOFF.md`): the
thread's weight, said out loud, and the one move that stops paying it.*

### The cost line

Every message sent on claude.ai re-reads the whole thread, so the cost of the
next send is the size of everything on the page — and the page is the one place
that number can be read. `threadTokens` in `content.js` sums the text of every
user message and every reply in the DOM at chars/4 (accurate enough for a
warning; it is not a bill) and, above `LONG_THREAD_TOKENS` (12,000, a product
number: roughly a fifteen-turn build session), the card's label row carries
"≈ 14k tokens re-read per send" and a small control, **Start fresh**. Below the
threshold nothing renders at all: a cost line on every short chat would be the
noise this product exists to refuse. The line rides the trigger card and the
mined row alike, because a long thread is long whether or not it earned moves.

### The fork

**Start fresh** spends one call — the same session read as the mascot, at the
same moment, for the same reason — and gets back one string: the brief, the
first message of a fresh chat. `FORK_SYSTEM` is the second prompt in the
product and lives under the same rule as the first: byte-identical in
`background.js` and `worker/src/index.js`, `build.mjs` fails on drift. It
writes the brief as the user, in first person, in four labelled blocks — Goal,
Settled, Exists now, Next — with nothing the session did not say, the session's
own words for every fact, at most three `<paste here>` bullets for material
the new chat will not have, and "Pick up from here." rather than an invented
next step. A thread with nothing to carry over earns `{"brief":""}`, and the
card says "Nothing to carry over." with the same inert notice the mined row
uses for its honest zero.

The brief renders as one sentence with the two numbers and one chip, whose
hover title is the brief itself — the promise the move chips make, kept here.
Clicking it parks the brief with the service worker (`stageBrief`, in
`storage.session`, two-minute TTL, consumed on read) and opens
`https://claude.ai/new`. The content script that loads THERE asks for it
(`takeBrief`, only at `/new`) and puts it in the composer through
`insertPrompt`, which never overwrites a draft. No URL parameter is relied on:
the `?q=` prefill claude.ai used to honour has been reported removed, and a
mechanism this product owns end to end beats one it borrows. Two clicks on
purpose — one writes, one opens — so the brief can be read before it goes
anywhere, and the open happens inside a fresh gesture rather than at the tail
of a network wait where a popup blocker would eat it. Nothing is sent. The
user reads it in the new tab and presses send.

The worker grew `POST /v1/fork` for it. One `admit()` now holds the gate
order both endpoints share — origin, key, device token, body, turns, reply, IP
quota, device quota — and one `callUpstream()` holds the retry shape, so a
gate that changes changes for both. A fork is one reply asked about and spends
from the same twenty. `cleanBrief` is in the injected helper block, so the
own-key path cuts the brief exactly where the worker would (1,800 chars, at a
line, then a sentence, then a word), and it refuses anything that is not a
string — the first test of the gate produced `[object Object]` from an object,
and a gate that lets that into a composer is worse than none.

### The measurement

`askFork` logs, on every fork, the thread's estimated tokens against the
brief's — "thread ≈ 14,300 tokens, brief ≈ 420 tokens (97% less per send)".
The HANDOFF's "a third or more of a long thread's cost is re-sent history" was
a guess and said so; this line is what replaces it, one fork at a time, and
the marketing copy waits for it.

### What this is not

"One control, one job" is a design note for a reason, and this is the second
control since the pencil chip went. It earns its place by being the exit from a
thread rather than a second way into this one: the row of moves stays the only
path into this thread's message box, and the fork control renders only when
there is a thread worth leaving. The peak-window indicator the plan sketched
for brake 3 is not built — the "existing clock logic" it was to reuse does not
exist in this repository — and the native usage page is not read: the estimate
is of the thread, in tokens, not a percentage of a session.

### What ships

Both. The extension, for the line, the control and the landing; the worker,
for the endpoint. A `/v1/health` still reporting 0.9.72 is a worker that
returns 404 to every fork.

---

## 0.9.72 — Extension + Worker

*The first gap in the token-savings thesis, closed. Nothing a user sees is
different; what an own-key press costs is.*

### The own-key path caches the system prompt

Since 2026-08-27 the worker has sent `MOVES_SYSTEM` as one content block marked
`cache_control: ephemeral`, so a hosted press pays a tenth of the input price
for the ~2.4k-token prefix on every call after the first in a cache window.
`callClaude` in `background.js` sent the same prompt as a plain string. The
moves were identical, the grounding was identical, `build.mjs`'s prompt check
passed — and a user on their own key paid full price for the same bytes on
every press. The rule that hosted and own-key must behave identically had never
been read as covering cost; 0.9.71's thesis said it should be, and this is that.

`cachedSystem` now exists in both files, byte-identical, and `callClaude` sends
`system: cachedSystem(system)`. The retry loop takes the worker's shape with
it: two independent degradations, thinking and caching, each allowed once and
tracked by flags rather than by attempt index, three attempts because both can
fire on one request. A 400 that mentions the cache flattens the block back to a
plain string and tries again — a request that costs more beats a request that
fails — and an unrelated 400 is not mistaken for one. The extension's tests now
carry the worker's caching assertions for this path.

The settings page's ping (`healthCheck`) goes through the same function with a
one-line system prompt. That is below the minimum cacheable length and is
simply not cached — the documented silent behaviour, not an error.

### The cache is visible

The thesis's other one-line gap: `diagnose` reported `in` and `out` only, so
whether the prefix was being served from cache was visible nowhere but the
bill. A `usageOf` helper, byte-identical on both paths, reads the four usage
counters the API returns — `input_tokens`, `output_tokens`,
`cache_read_input_tokens`, `cache_creation_input_tokens` — as `in`, `out`,
`cacheRead`, `cacheWrite`. A counter the API does not report reads as `null`,
never `0`: an API that says nothing about the cache is a different fact from a
cache that read nothing. `diagnose` carries all four, and every call now logs
one `[CONTEXA] usage` line on success as well as failure — the service-worker
console on the own-key path, `wrangler tail` on the hosted one. The number to
watch is `cacheRead` against the prompt's share of `in`. The first call in a
window shows it as `cacheWrite`; zero in both, press after press, is caching
silently off.

### What the build now refuses

`build.mjs` asserts `cachedSystem` and `usageOf` are byte-identical across the
two files, and that both call sites still send the prompt through
`cachedSystem`. A drift here is invisible to every product test — the row is
the same either way — which is exactly the class of check the build exists for.

### What ships

Both. The extension, because `background.js` changed; the worker, because its
diagnostics changed, and a `/v1/health` still reporting 0.9.71 is a worker that
does not yet log its cache. `docs/token-savings-thesis.md` marks gap 1 closed
and rewrites the `cache_read` note in section 7; the remaining gaps stand. The
site's version stamps move with the manifest.

---

## 0.9.71 — Extension + Website

*A motto, and the name changes to carry it. Nothing the extension or the
worker does is different.*

### Every token earned

The design notes had a rule they never stated. Zero as an outcome, the lazy
call, the pinned first turn, the collapsed code block, one ask per move, the
`Assume:` lines, the byte-identical cached prefix: each was chosen because the
alternative produced a turn the user did not need, and on claude.ai every turn
re-reads the whole conversation, so the number of turns is the cost. A token is
*earned* when its message could not have been shorter, could not have been
skipped, and will not need a follow-up to fix. That is now the motto, and
`docs/token-savings-thesis.md` is the argument: which rule saves what, where
each lives in the code, the per-row arithmetic from the worker's constants, and
the gaps.

Two of those gaps are worth repeating here because they are the next work:

- **The own-key path does not cache the system prompt.** `callClaude` in
  `background.js` sends `system` as a plain string; only the worker wraps it
  with `cache_control`. Own-key users pay full input price for the ~2.4k-token
  prefix on every press. The product is identical, so `build.mjs` does not
  catch it.
- **`diagnose` does not log cache reads.** It reports `input_tokens` and
  `output_tokens` only, so whether caching is working is visible nowhere but
  the bill.

### The name

`CONTEXA - Claude prompts, without the writing` was exactly 45 characters, on
the store's limit. It becomes **`CONTEXA for Claude - Every token earned`**,
39 characters. "Claude" stays, per the publishing checklist: it is the single
most obvious search term, and "for Claude" is the third-party form. The
description's non-affiliation line is unchanged. The store listing, the
submission notes and the brand prompt's hard-constraint list record the new
name; the promo tiles' tag line is the motto, re-rendered from
`scripts/promo/tiles.html`.

### The site

The tagline on all four pages, the page titles, the Open Graph title and image
alt, and the re-rendered social preview all carry the motto. The old line
survives in this changelog, the archived design brief, and one comment in the
screenshot harness, which describe history.

### What ships

The extension, because its name changed and that is a store resubmission. The
site, because its copy changed. The worker's `BUILD` moves to 0.9.71 with the
manifest because the build guard requires the two to agree; there is no worker
change to deploy, and a `/v1/health` still reporting 0.9.70 is not a stale
deploy.

---

## 0.9.70 — Extension

*The mascot's face was not too small. It was being inverted — and 0.9.69 made
it worse by making the ink darker.*

### What 0.9.69 got wrong

0.9.69 read a field screenshot of washed-out pupils as an anti-aliasing problem
at 40×34.5 px and darkened the ink: pupils `#173b35` → `#000`, mouth `#0e6e63` →
`#0a352f`. The next screenshot from the same phone had **no pupils at all** and a
**white mouth**. That is not a fix decaying, it is a fix pointed the wrong way,
and the direction of the failure was the diagnosis: darker in, lighter out.

The phone runs the browser's force-dark ("night mode"). Chromium force-dark
sorts every paint into one of two roles and inverts on Rec.601 brightness
`B = .299R + .587G + .114B`:

| role | what counts | inverted when |
|---|---|---|
| foreground | a **flat** `fill="#hex"` / `stroke="#hex"`, and text | `B < 150` |
| background | CSS backgrounds, gradients, and **SVG paint servers** `fill="url(#…)"` | `B > 205` |

So flat `#000` pupils (B = 0) invert to pure white and vanish into the white
sclera — 21:1 contrast becomes **1.00:1**, mathematically erased. The body was
never affected because it was always a gradient. The same threshold caught a
second bug nobody had reported: the hover whisper puff, flat `#2cc4ae` at
B = 148.04, rendered **pink** under one inversion method.

### Why no palette could have worked

A scan of all 16,777,216 sRGB colours says the set of flat colours that hold
4.5:1 against the white sclera in all four render modes is **empty** — the best
possible is 3.13:1. A colour dark enough to read on white is dark enough to be
inverted; a colour light enough to survive inversion is too light to read. Every
further round of "pick a better colour" was going to fail the same way.

The escape is the **role, not the colour**. Wrapped in a two-stop gradient of a
single colour, the ink is classified as a background, sits far under the 205
threshold, and is never touched — while rasterising exactly as the flat colour
did. Pupils, mouth and whisper now paint through `url(#ctxaPg/Og/Wg)`.
Measured on the shipped constant, at the shipped size, in both themes:

| | no force-dark | cielab | hsl | rgb |
|---|---|---|---|---|
| 0.9.69 pupil/sclera | 21.00:1 | **1.00:1** | **1.00:1** | **1.00:1** |
| 0.9.70 pupil/sclera | 21.00:1 | 21.00:1 | 21.00:1 | 21.00:1 |
| 0.9.70 mouth/body | 4.48:1 | 4.48:1 | 4.48:1 | 4.48:1 |

Every pixel of ink is byte-identical across all four modes. Geometry, classes,
`viewBox` and all six gestures are untouched, so the wink, the glance, the
whisper puff and the bubble still fire; the render with force-dark off differs
from 0.9.69's by at most 3/255 on the anti-aliased rim of a pupil.

The rule is **asymmetric**, which is the trap worth naming: white is safe only
as a flat fill (255 ≥ 150), and as a gradient stop its 255 clears 205 and
inverts the whole eye to near-black. `extension/test.mjs` now asserts both
directions and names the offending colours on failure — it fails on 0.9.69's
source, so it would have caught this. There were no mascot assertions at all
before this; the 0.9.55 set went with the card it tested.

`gradientUnits="userSpaceOnUse"` on all three: an `objectBoundingBox` paint
server paints **nothing** when a shape's box is flat in either axis, and the
mouth is 1.25 units tall — one "straighten the smile" edit from invisible in
every mode, force-dark or not.

### Also in this release

The website's three mascot copies (hero, demo player, favicon) had drifted to
pre-0.9.69 ink and carried the same bug on the same phones; all three are now in
step with the extension. The favicon stays flat on purpose — it is browser
chrome, force-dark never reaches it. The icon PNGs did **not** need
regenerating: the patched master renders md5-identical at 16/32/48/128/512, so
`store-assets/README.md`'s byte-identity claim still holds.

### Known ceiling, stated so it is not re-derived as a bug

A remapper that inverted even pure white as a foreground would darken the sclera
and leave the pupils black (1.12:1). No role assignment survives both ends —
white is safe only flat, dark ink only as a paint server. Windows forced-colors
mode is a separate subsystem this does not address, and could not be exercised
on the build these measurements came from, so nothing was shipped claiming to.

---

## 0.9.69 — Extension

*The mascot's face was disappearing at small sizes — reported from a real phone.*

The pupil circles (r=3.3, `#173b35`) and the mouth stroke (2px, `#0e6e63`) held
up fine at the 128px reference size, but a field screenshot of the in-page
trigger chip on mobile showed both washed toward the background — pupils
essentially gone, mouth barely a line. Rendering the 16px manifest icon next to
the 128px one made the same defect reproducible at the desk: the 16px face was
already close to featureless before any phone-specific compression touched it.

Pupils enlarged (3.3 → 3.8) and switched to pure black; the mouth stroke
widened (2 → 2.6) and darkened. Changed in both places the geometry is
duplicated — `extension/content.js`'s inline trigger SVG and
`store-assets/contexa-mascot-icon.svg` — then the manifest and store PNG
exports (16/32/48/128, plus the 512 store asset) were regenerated from the
updated source so all three stay pixel-identical, as before.

---

## 0.9.68 — Extension + Worker

*One more verb, found by verifying the last release.*

`Isprojektuj katalog sa filterima` was dropped by the **deployed 0.9.67** during
its own end-to-end verification — the tail was still attached and named it.
Added `projektuj|isprojektuj` beside `skiciraj` and `osmisli`.

The interesting part is not the word, it is where it landed: the Serbian
conceive/design family, which is exactly where the 0.9.67 sweep had already
found the list thinnest. One sweep of ten sessions did not exhaust that family.
It found the common cases (14 drops in 36 moves); the three verification runs
that followed produced 1 drop in 7. Thinner, not empty — so the honest read is
that this list has a long tail and the tail is worth re-reading occasionally,
not that it is now complete.

### Also seen, not fixed

One of the three verification runs returned **`bad_json`**:

```
stop=end_turn  out=952  in=425  ceiling=2500  len=1963  hadJson=true  steps=5
```

Not truncation — the model stopped on its own, well inside the token ceiling,
and the payload opened as valid JSON. That is a **different defect** from
anything in this release and is left alone rather than folded in: 1 failure in
the 13 live requests across 0.9.67's sweep and verification. Recorded here so
the next occurrence has a first data point to sit beside, with the diagnostics
the worker already logs.

---

## 0.9.67 — Extension + Worker

*The action gate was read for the first time. It was eating nine good clicks out
of fourteen drops.*

### Why look

0.9.66 left one gate standing, and `droppedByAction` had been non-zero in 3 of
the 6 runs that retired the spread gate — but nobody had ever read **which**
labels it was taking. `ACTION_OPENERS` is an allowlist, so it fails closed: a
verb it does not know does not degrade a row, it **empties** one, and an emptied
row is indistinguishable from an honest zero to everyone except whoever is
reading the worker log.

### How

`wrangler tail` against the live worker — a live stream, nothing stored. Ten
sessions on deliberately different subjects (build, newsletter, schema,
debugging, roadmap, branding, payments research, CV, teaching, CI), roughly half
in Serbian. **36 moves returned, 14 dropped.** Every drop logged
`no production verb`; `META_OBJECTS` never fired once.

The turns were invented again, and that matters less here than it did last time:
the spread measurement asked for a *rate*, which invented inputs distort. This
asked *which verbs the model reaches for*, which is a property of the model and
`MOVES_SYSTEM` rather than of whose turns they are. It still cannot say how often
this bites in the field.

### The harvest, classified against a rule fixed before the runs

**Nine were doable clicks the list did not know:**

```
Popiši listu od 20-30 igrica            Osmisli filtere za katalog
Osmisli temu prvog izdanja              Osmisli plan organskog rasta
Smisli rečenicu za prosleđivanje        Skiciraj logotip sa mesecom
Prilagodi CV opis ostalim projektima    Model hourly line items
Estimate weekly payout breakeven
```

The newsletter session went 4 moves → 1 on three false drops alone. The payments
session 3 → 1.

**Four were correct** — three `Explain …` labels, and `Uputstvo za generisanje
SSH ključa`, which is a bare noun phrase with no imperative at all.

**One went to the owner** — `Opiši projekat za CV`, ruled a **correct drop**:
*opiši* belongs to the same family as *objasni* and *pokaži*, and a session that
genuinely wants CV copy has *napiši* and *sastavi* already surviving.

### What changed

Added to both allowlists (byte-identical, `build.mjs` enforces it):

| | verbs |
|---|---|
| Serbian | `osmisli` `smisli` `popiši/popisi` `skiciraj` `nacrtaj` `iscrtaj` `modeluj` `modeliraj` `prilagodi` `uskladi` `izračunaj/izracunaj` |
| English | `model` `estimate` `calculate` `compute` `forecast` `draw` |

Harvested verbs plus their close siblings — *skiciraj* had no Serbian drawing
counterpart at all, and *estimate* no quantitative one in English.

### The part worth keeping

Rule 1 above the gate already said **"Be generous. A verb that produces anything
at all belongs here."** It was written in 0.9.63, it was sincere, and the list
still missed a quarter of everything the model returned. Generosity is not
something you can be from memory: the missing words are by definition the ones
that did not occur to you. That paragraph now sits above `ACTION_OPENERS` with
the numbers attached, and says to re-read the log the same way when the field
looks thin.

All 14 labels are in the test corpora verbatim — the nine in `MUST_SURVIVE`, the
five in `MUST_DROP` — plus a live-shaped end-to-end assertion in the worker
suite. Proven by removing the additions and watching nine extension checks fail
and the worker row empty with `droppedByAction: 4`.

### Still open

How often this bites on **real** threads. Ten invented sessions name the verbs;
only the owner's own clicks give the rate.

---

## 0.9.66 — Extension + Worker

*The spread gate is removed. It was measured, and it was deleting good rows.*

### The measurement

0.9.65 shipped instrumentation and no behaviour change, on the rule that this
project had twice reasoned its way to a wrong cause. The instrument said the
games thread was **filtered, not empty** — but not which gate, so the gate was
run against a session shaped like that thread: the reply near-verbatim from the
screenshots, four Serbian turns written to carry real quotable material (age
groups, what the games develop, the data-structure question), six live runs
through the hosted worker.

```
run 1: 0 move(s)  turns=0 reply=1 droppedByAction=3 emptiedBy=spread
run 2: 3 move(s)  turns=1 reply=2 droppedByAction=0
run 3: 3 move(s)  turns=1 reply=2 droppedByAction=0
run 4: 2 move(s)  turns=1 reply=1 droppedByAction=1
run 5: 3 move(s)  turns=1 reply=2 droppedByAction=0
run 6: 3 move(s)  turns=1 reply=2 droppedByAction=1
```

**The turns were invented.** They were written generously — the rate below is
indicative of the shape, not a measurement of the owner's actual thread.

### What it showed

- **1 run in 6 was emptied by the spread gate, and every row it took was good.**
  Doable clicks, thrown away.
- **Four of the five survivors lived on exactly one turn-earned move.** One
  different evidence quote and they die too. The gate was a coin flip over good
  rows, which is what the field screenshots looked like from the outside: same
  thread, same reply, five clicks, three different outcomes.
- **Worst of all, in the run it killed the action gate had already taken 3 of 4
  moves**, leaving a single reply-earned move. "Every move is reply-earned" is
  trivially true of a row of one. The gate was built against a row of four
  transcribed moves and it was deleting a row of one.

That last point is the design error, not a tuning problem. `fromReply ===
moves.length` is a proportion, and a proportion over a row the previous gate has
already thinned means something different from what it meant over the raw row.
Ordering the gates could not fix it; the gate was asking a question that stops
being meaningful at small counts.

### What replaces it

Nothing, deliberately. What it was built for is covered twice over: the action
gate (0.9.63) drops anything that is not a doable click, and `MOVES_SYSTEM` says
outright that the reply's own list is not the row. If transcription returns, the
symptom to watch for is a row whose moves all quote the reply **and** read as its
numbered list — and the answer then is the prompt or a shape-aware check, not a
blunt count. That reasoning sits in both source files where the gate used to be,
so a future reader finds the measurement rather than an absence.

### Consequences

- `grounding.emptiedBy` is now `'action' | null`. The `'spread'` value cannot
  occur, so the **"Nothing new beyond the reply."** card is gone with it — a
  card for a mechanism that cannot fire is 0.9.49's inert instruction again.
  Two cards remain: **"Nothing worth clicking here."** (the action gate emptied
  it) and **"Nothing for now."** (an honest zero).
- Provenance stays. `fromTurns` / `fromReply` no longer gate anything, but they
  are the only reading of whether a row mined the session or transcribed the
  last reply — this measurement was only possible because they ship.
- The end-to-end test that asserted such a row is **dropped** now asserts it is
  **served**, and the same row is run on a two-turn and a three-turn session to
  prove the threshold is gone rather than merely unreferenced. Both were proven
  by restoring the gate and watching them fail.

### Still open

`droppedByAction` was non-zero in 3 of 6 runs and **which** labels the action
gate dropped has not been read. `wrangler tail` shows it — each drop logs its
label and reason. An allowlist fails closed, so that number is where the next
missing verb will surface.

---

## 0.9.65 — Extension + Worker

*The card names which gate ate the row. No behaviour changes — this release
exists to measure.*

### What 0.9.64 already answered

The split notice worked on the first field click. The games thread came back
**"Nothing worth clicking here."**, which proves the model **did** return moves
and the gates dropped every one. That thread is not an honest zero, and the
owner's instinct that it should not be empty was right.

### What it could not answer, and why that matters

The card could not say **which** gate, and the two want opposite responses:

- **Action gate** — a Serbian verb missing from the allowlist. A bug in that
  list, and a straightforward fix.
- **Spread gate** — every move was reply-earned on a session of three or more
  turns. Also plausible, and here it may be a **false positive**: that reply *is*
  the plan the user asked for, so a move advancing the plan legitimately quotes
  it. The gate reads "all reply-earned" as *transcript*; on this thread it may
  be reading *building on the deliverable*.

If the second is what happened, the fix is not a verb — it is that the gate is
now deleting exactly what the owner asked for. Four doable clicks, thrown away.

### Measured, not reasoned

**Nothing about the gates changes in this release.** That is deliberate. This
project has now twice reasoned its way to a wrong cause: 0.9.61 was blamed for a
zero that turned out to be sampling variance, and 0.9.64's notes claimed the gate
could be ruled out for one thread when it could not. Asked whether to guess or
measure, the owner chose measure.

The cause is computed **where both intermediate arrays exist** — `kept`, what
survived the action gate, and `moves`, what survived the spread gate. If the
model returned something and `moves` is empty, then `kept` being empty means
*action*, and otherwise *spread*.

That distinction is not pedantry. Inferring it downstream from
`droppedByAction > 0` gets the **both-gates-fired** row wrong: the action gate
takes some moves, the spread gate takes the rest, `droppedByAction` is non-zero,
and the naive answer is "action" when the spread gate is what emptied it. There
is a test for exactly that row.

Ships as `grounding.emptiedBy` (`'action' | 'spread' | null`) on both paths.

### Three cards

| cause | card |
|---|---|
| the model earned nothing | **"Nothing for now."** — unchanged |
| the action gate | **"Nothing worth clicking here."** — unchanged |
| the spread gate | **"Nothing new beyond the reply."** |

Each states what that gate *concluded*. If a conclusion is wrong, that is the
bug being hunted — and the card now names which gate to go and read.

### Versions

Extension **0.9.65**, worker **0.9.65**. 368 assertions green (253 extension,
115 worker). Each new guard proven by breaking it: the spread card removed, the
caller guessing from `droppedByAction` instead of reading the cause, and the
worker always blaming the action gate. Worker redeploy required — `grounding`
gained a field.

---

## 0.9.64 — Extension

*An empty row now says which kind of empty it is — and a good row stops
vanishing when you click twice.*

### A claim withdrawn

0.9.63's notes said a row emptied by the action gate would be the bug to watch
for. Then, asked about one specific empty thread, this project's own answer was
that the gate could be ruled out because that thread's four known labels are all
must-survive tests.

**Both cannot be true, and the second was wrong.** The tests rule out the gate
for labels that have been *seen*. If the model produced different ones on that
click — or four reply-earned ones — either gate could have emptied the row, and a
screenshot cannot tell. The owner spotted the contradiction: *"ali sam sad video
da si rekao da ako su prazni onda je bug"*.

### The defect underneath it

There are **three** ways to reach an empty row, three distinct console lines, and
until now **one identical card**:

| cause | what it means |
|---|---|
| the model earned nothing | the product working |
| the action gate found no production verb | possibly an incomplete verb list |
| the spread gate dropped an all-reply row | by design |

Only the first is honest. The other two were wearing its face — which is exactly
what **never fake output** forbids. The zero notice exists (0.9.59) so a click
that mined nothing says so instead of vanishing; it was saying the same thing
when the cause was entirely different.

And it was unfalsifiable in practice: the diagnostics are console-only, and this
product is field-tested on a phone, where there is no console.

So the card now carries the reason. An honest zero keeps **"Nothing for now."**
unchanged — it is the common case and must not get noisier. A row the gates
emptied says **"Nothing worth clicking here."** Not to explain gates to a user,
but so the difference is legible **in a screenshot**, which is how this is
actually being tested.

### The cache moves out of the service worker

`stepsCache` was a plain `Map` in an MV3 service worker. Chrome tears those down
whenever it likes, so a second click on the same reply was a fresh call and a
fresh sample — which is how four good moves became "Nothing for now." on the same
thread an hour apart, and how a row the user had already seen simply evaporated
while costing quota to re-roll.

It now lives in `chrome.storage.session`: survives the teardown, dies with the
browser session, which is the right lifetime for a cache of what someone was just
shown. Same key, same 60-entry oldest-first cap, and errors are still never
cached — a gate can empty a call that itself succeeded, and a cached failure
would outlive its cause. Reads and writes are async now; that is the whole cost,
paid inside a handler already awaiting the network.

### Two test lessons

The teardown test needed a fixture that **survives the gates**. The default
harness move is reply-earned, so the spread gate drops it, and the first version
of this test compared `[]` with `[]` — passing while proving nothing.

And a guard broke on the signature change from `renderNothing(anchor)` to
`renderNothing(anchor, filtered)` — **the fourth time** in this file a check has
failed on a correct refactor because it pinned typography. Its neighbour pinned a
character distance (`{0,500}`) between two strings and broke when a comment grew.
Both are now written as properties: the notice has exactly one caller, that
caller sits in the earned-nothing branch, and nothing renders a row in between.

### Versions

Extension **0.9.64**, worker **0.9.64**. 362 assertions green (251 extension,
111 worker). Each new guard proven by breaking it: both zeros drawing one card,
the caller ceasing to distinguish them, the cache never persisting, and the cache
never reading back. **No worker code changed** — the version moves only so the
two artifacts stay in step, which `build.mjs` enforces.

---

## 0.9.63 — Extension + Worker

*"Klikneš, i Claude odradi. Ako to ne može — ni ne otvaraj."*

### A correction to 0.9.62's entry, first

0.9.62 claimed the games thread's empty row was caused by 0.9.61's prompt rule.
**That was wrong.** The same thread, on 0.9.62, produced four good moves at 20:02
and "Nothing for now." at 20:04 — same version, same reply, two clicks. So the
zero was **sampling variance**, not a release. The caveat was stated at the time;
the conclusion drawn past it was not.

The revert still stands on its own — the rule was not landing, and its own
worked repair sat below its prohibition — but the causal claim is withdrawn.

The flip-flop has a mundane cause: `stepsCache` is an in-memory `Map` inside an
MV3 service worker, and Chrome tears those down freely, so a second click on the
same reply is a fresh model call rather than a cache hit. Moving it to
`chrome.storage.session` would make a re-click return what you already saw.
**Deliberately not built** — raised, declined for now, recorded here so it is not
rediscovered as a mystery.

### The rule: a move is a doable click

Every move must be something Claude *makes* when you press it. A move that only
talks **about** the material — *Objasni…*, *Detaljnije rollback korake*, *Pokaži
cijeli YAML primjer*, *Show full inbox-triage SKILL.md* — is a comment, not a
next move, and should not appear at all rather than appear and waste the click.

`enforceAction` replaces 0.9.62's `dropReplyExplains`, and inverts it: a move
survives only if its label opens with a verb that produces an artifact.

**Provenance no longer gates this, and that is the substantive change.** The
explain gate only fired on reply-earned moves; the field then rejected
*Detaljnije rollback korake*, which was turn-earned. The shape is the defect,
whatever earned it.

### The cost of an allowlist, named rather than discovered

A denylist fails **open**: an unknown verb still renders. An allowlist fails
**closed**: an unknown verb is dropped. This product answers in the session's own
language and half these rows are Serbian, so a missing verb does not degrade a
row — **it empties one**, and an empty row is indistinguishable from the honest
"nothing was open", which is the one outcome this product must never counterfeit.

Three consequences, all built:

- **The list is generous, and Serbian is first-class.** The eight verbs first
  sketched for this gate would have dropped three of the four moves in the row
  that prompted it. *Napravi / Definiši / Razradi / Precizuj / Postavi /
  Pretvori / Prebaci / Proveri* are all load-bearing, and each is a test.
- **An emptied row gets its own log line**, naming an incomplete verb list as the
  likely cause, so that failure can never hide inside an honest zero.
- **`grounding.droppedByAction`** ships in the worker response, so the rate is
  visible on the hosted path too — this is the number that will show whether the
  list is too narrow once it meets a language it does not know.

**One offender a verb list structurally cannot catch.** *"Dodaj pitanje o
staging environment"* opens with **Dodaj** — a production verb that has to stay
on the list — and is still not a doable click, because what it produces is
another question: the interview this product deleted, arriving through the one
door left open. Matched on its **object** instead, beside the verb check.

### The corpus is the field, not invention

Fifteen assertions built from labels these rows actually produced. Nine must
survive (*Napravi listu od 20-30 igrica*, *Definiši finalnu strukturu podataka*,
*Razradi wireframe glavnih stranica*, *Precizuj listu kategorija igrica*,
*Postavi CI za ŠRAF web app*, *Pretvori skicu u SKILL.md*, …) and six must drop.
Both halves matter, but the survive half is load-bearing: this gate's failure
mode is silence, not noise.

Eight test fixtures had to be relabelled — *A move*, *Short one*, *Good one*,
*One…Five* — placeholder labels with no verb, in tests about retry, salvage and
the clean gate. They were found by running every fixture label in both suites
through the gate rather than by waiting for failures, which turned up two the
suite would not have caught.

And a redundant `napravi listu` alternative was removed: subsumed by `napravi`,
dead, and it masked a probe — which is exactly how a list like this rots without
anyone noticing.

### Versions

Extension **0.9.63**, worker **0.9.63**. 355 assertions green (244 extension,
111 worker). Each new guard proven by breaking it: a Serbian verb off the list,
the question-object rule removed, the allowlist removed, and the emptied-row line
reworded. Worker redeploy required.

---

## 0.9.62 — Extension + Worker

*0.9.61 is reverted. It cost a row, and the thing it was trying to fix in words
is fixed in code instead.*

### The regression, and why it happened

**"Vebsajt za pametne dečije igrice"** — same thread, same reply — returned three
good moves on 0.9.60 and **"Nothing for now."** on 0.9.61.

The mechanism is legible in the shipped text. 0.9.61's ban opened *"When the
reply ends by asking them something…"* and asserted *"The reply's closing
question belongs to them, not to this row."* That reply ends with **"Šta misliš?
Trebalo bi da se nešto doda, ukloni ili promeni?"** — exactly that condition. The
repair was written, but it lived in a worked example far below the ban, so the
prohibition is what got followed. A rule that reads absolute at the top and
conditional at the bottom will be obeyed at the top.

One thread cannot fully separate a regression from sampling variance. It is the
same thread and the same reply, the change is the only variable, and the wording
predicts the failure — enough to revert on.

`MOVES_SYSTEM` is now **byte-identical to 0.9.60's**, verified by diffing the
extracted constant against `git show` rather than by reading it. The
answer-shaped move is left unfixed on purpose: it was already halving on its own
between 0.9.59 and 0.9.60 with no rule at all.

### The tally that decided this release

| | landed |
|---|---|
| Spread gate (0.9.59, mechanical) | **yes**, and measurably |
| Objectless label (0.9.60, prompt) | **yes** — the only one that put its repair *inline* |
| Backwards-move ban (prompt) | no |
| Explain rule (0.9.60, prompt) | no — the field produced two more after it |
| Answer-shape ban (0.9.61, prompt) | no, and cost a row |

Four failures in five for prompt-only rules, against one clean success for a
gate. So the explain shape stops being argued with and starts being dropped.

### The explain gate

`groundMoves` already worked out, per move, whether the turns or the reply earned
it — and then threw that away, returning only totals. It now keeps a `sources[]`
array alongside them. No new matching; it just stops discarding what it knew.

A move is dropped when it is **reply-earned AND its label opens with an
explain-family verb**. Both halves are required, and the second half is the one
that matters: an explain earned by a **user turn** is opening ground the reply did
not cover — which the prompt explicitly protects — and it survives untouched.
Over-firing is precisely how 0.9.61 turned a good row into silence, so the
must-not-fire case is guarded as hard as the must-fire one, on both paths.

Per-move rather than per-row, unlike the spread gate: this is a defect in one
chip, not a verdict on the row. No turn threshold either. And the counts are
**re-tallied** after a drop, because they feed the spread gate and the numbers
reported to the console and the hosted client — carrying stale ones would hide
the drop in the one field built to show it.

### The known limit, written down rather than discovered later

**A verb list cannot generalise, and this product answers in the session's own
language.** The Serbian entries (*objasni*, *razjasni*, *pojasni*, *opiši*) are
there because the field produced them. The next language a user brings will slip
through, and that is expected rather than surprising. It is accepted because the
alternative on the table was a sixth prompt-only rule.

Also guarded: a move merely *containing* the verb is not the shape. "Draft the
explainer page" is real work and survives; only a label that **opens** with the
verb is the defect.

### A guard that broke on a correct refactor, for the third time

The source assertion pinning the grounding call matched the literal variable name
`kept`, and broke the moment a variable was renamed to make room for the new
gate. Third occurrence in this file of a check failing on a correct refactor
because it pinned typography rather than the property. The identifier is now
wildcarded; what it asserts is what actually matters — that turns and reply
arrive as two separate arguments.

### Versions

Extension **0.9.62**, worker **0.9.62**. 342 assertions green (232 extension,
110 worker). Every new guard proven by breaking it: the gate firing without
regard to provenance, the verb removed from the list, the Serbian verb removed,
and the re-tally replaced by stale counts. Worker redeploy required.

---

## 0.9.61 — Extension + Worker

*The reply's closing question is theirs, not the row's — and this time the ban
comes with a repair.*

### 0.9.60 read from thirteen rows

The objectless-label fix landed, on the exact thread that produced it. "Creating
a new mobile app" had returned **"Just start building something"**; it now
returns *Design clipboard staging app / Draft app concept doc / List other mobile
Claude friction*. The shrug is gone, and so is *"Confirm the exact failure
mode"* — the answer-shaped move this release is about — replaced by one that
produces something.

Roughly **21 of 24 moves solid** across the batch, plus two correct "Nothing for
now." firings: a bare greeting, and a *"Let's learn new skill!"* thread where
nothing had been picked yet.

### The answer-shaped move

*Answer the fork definition question. Confirm the exact failure mode. Odgovori na
pitanje o staging environment-u. Nabroji neformalni checklist iz glave.*

Each is the reply's closing question turned into a chip, and none is writable:
the answer is in the user's head, so the text is either invented or nothing but
slots. This was flagged in 0.9.60 and left alone; 0.9.60 halved it on its own
(*Confirm the exact failure mode* vanished, *Odgovori na pitanje…* softened to
*Razjasni … pitanje*) but did not finish it.

The rule now names it, and draws the boundary where it actually falls: **needing
ONE thing from them is fine** — that is what the `<paste here>` slot has always
been for — but a move made *entirely* of what they must supply is the form field
this row exists not to be.

### Why this one got a repair, and the last two did not

Three prompt-only rules have now been partially declined: the backwards-move ban,
the objectless label, and 0.9.60's explain rule. The one that *did* land was the
label fix, and the difference is visible in the diff: it paired the negative with
what to do instead.

So this ban ships with a worked repair. When the reply asks "which of these two",
write **the work that follows the decision** — take the reading the session
already leans toward, make it a real move, and demote the branch you did not take
to an `Assume:` line the user can change. That reuses machinery the prompt
already has rather than inventing any: `Assume:` has been in the text rules since
the pivot.

### Still open, and now a standing candidate

**"Explain the agent flies blind risk."** The reply's own sentence — *"If you
only use Standard OAuth, the agent flies blind"* — handed back to be explained at
greater length. That is precisely the case 0.9.60's explain rule names, and the
rule did not stop it.

Not fixed here, because the scope was the answer-shaped move. Recorded with its
mechanical option, which is cheap because both halves already exist: **drop a
move that is reply-earned AND whose label opens with an explain-family verb.**
Provenance has been computed per move since 0.9.59. If the shape recurs after
this release, that is the change to make — on the evidence that a fourth
prompt-only rule would be the fourth to be declined.

### Versions

Extension **0.9.61**, worker **0.9.61**. 335 assertions green (228 extension,
107 worker), four of them new and each proven by breaking it. Worker redeploy
required — `MOVES_SYSTEM` is server-side too.

---

## 0.9.60 — Extension + Worker

*Two weak moves inside otherwise good rows — and one of them was already
banned.*

### What 0.9.59 actually did, read from sixteen real rows

The transcription fix landed. Rows now span the session instead of handing back
the last reply: one thread returned *Draft the 10-to-20 string fix / Swap the
store icon asset / Verify cache hit via wrangler tail / Set the Anthropic spend
cap* — four different strands of work, none of them the reply's own content. A
spec thread returned four separate jobs on the fork rule. Serbian sessions
returned Serbian moves without being asked. And **"Nothing for now."** fired
correctly on a *"How are you doing my friend"* thread: nothing open, nothing
offered, which is zero working as designed rather than a gap.

What remained was not transcription. It was individual weak moves inside rows
that were otherwise right — so this release touches the prompt only. No gate, no
threshold, no new mechanical check; the spread gate and its three-turn floor are
untouched, and the zero rate should not move.

### The label that names an action with no object

The field produced **"Just start building something"**. The uncomfortable part:
the label rule already banned it, in these words — *"Proceed" is a command into
the void*, and *"Add a form" names an action with its object missing*. The rule
was there and the model declined it, which is the same shape as the
backwards-move ban that 0.9.59 had to gate rather than argue with.

So the fix is a worked negative rather than another abstract clause, since the
list of examples is what actually gets followed, plus the repair stated
positively: put the session's own subject in the label — the app, the file, the
page, the decision it is about. **Whether that is enough is genuinely unknown**,
and this entry is the place that will say so if the next field read shows the
shrug again.

### "Explain" is how the second pass gets past its own ban

*Explain typical rejection reasons. Explain the token generation steps. Explain
local vs cloud MCP servers. Explain fetching Stripe transactions.*

The ban on sending the user back over the reply lists *"explain that again"* and
*"expand on your answer"* — so a bare **"Explain X"** walks straight past it
while doing the same job. `MOVES_SYSTEM` now names the verb: a move asks Claude
to PRODUCE something, and "explain what you just said, at greater length" is the
backwards move wearing a verb the ban did not name. Deliberately not an outright
ban — "Explain" earns a row when it opens ground the reply did not cover, and
several of the field's explain-moves did exactly that.

### A third shape, found and deliberately not fixed

The most common weak move in those sixteen rows was neither of the above:
**moves whose substance only the user can supply.** *Answer the fork definition
question. Confirm the exact failure mode. Odgovori na pitanje o staging
environment-u. Nabroji neformalni checklist iz glave.*

Each is the reply's own closing question turned into a chip, and CONTEXA cannot
write the message: the content is in the user's head, so the composed text is
either invented or mostly `<paste here>`. By this product's own line, *a move
nothing earned is a form field*.

Recorded rather than fixed, because the change was scoped to the two shapes
above and widening it unasked is how a prompt accumulates rules nobody decided.
It is the first candidate for the next pass.

### What the tests can and cannot say

Four new assertions, each proven by breaking it: the worked negative, its
repair clause, the explain rule, and the carve-out that keeps a genuinely new
"Explain" legal. A one-sided edit to either copy still fails the build as prompt
drift.

But they are source assertions. They prove the words are present and
byte-identical across both files; **they cannot prove the model obeys them** —
and the label rule is the standing proof that the difference is real, not
pedantic. The verification that counts is a live read of the same kind of thread
that produced these rows.

### Versions

Extension **0.9.60**, worker **0.9.60**. 331 assertions green (224 extension,
107 worker). Worker redeploy required — `MOVES_SYSTEM` is server-side too.

---

## 0.9.59 — Extension + Worker

*The row was reading the last message back to her, and every check said it was
working perfectly.*

### Mobile works, and that is the first thing the field test proved

0.9.58 sideloaded into Mises on Android, own-key, against real threads. The row
renders: the pinned selectors, the shadow-DOM card, the theme follow and the
click-to-compose all survive a mobile DOM they have never met. Nothing about
mobile needed fixing, which is worth recording because the selectors are the
part of this product most expected to break.

### The defect: the reply's own list, handed back as the menu

In a thread about a broken mascot, Claude's reply ended with three numbered
options — check the asset, inspect it in DevTools, or describe it if DevTools is
not available. CONTEXA returned exactly three moves: *Check mascot SVG source on
GitHub*, *Report mobile browser DevTools findings*, *Describe mascot render
without DevTools*. The reply's list, transcribed. A connectors thread did the
same: the reply printed a catalogue, and the row came back *List all available
connectors / Explain fetching Stripe transactions / Explain posting to Slack*.

A third thread in the same batch was correct — *Draft friends cohort message /
Design the five screenshot frames / Draft the fork precedence rule / Write the
standalone-app brief*, four separate strands of a long session. The split is not
random: **a long session gave the model something to mine; a short session with
a long enumerative reply gave it a list to copy.**

**And the evidence gate was rewarding it.** Every move must be earned by a
verbatim quote. An enumerated reply is a menu of pre-grounded moves sitting at
the end of the context — copying it scores perfectly, while a move opening a new
direction on the original goal is hard to ground. The gate built to prevent
invention was quietly selecting for transcription, and `grounding: 3 of 3
grounded` reported it as flawless.

This also answers field-test **#4** with live evidence. The 0.9.58 entry recorded
that the backwards-move ban was prompt-only, with no gate in `cleanMoves`, and
left it there. This is what that cost.

### Provenance, which turns a screenshot into a number

`groundMoves` now takes the turns and the reply as **two corpora instead of one
concatenated string**, and reports `fromTurns` / `fromReply` per row. One flat
haystack can say a move is grounded; it can never say what grounded it, which is
precisely why a transcript looked perfect. Turn-earned wins a tie — a phrase the
user wrote and Claude quoted back is still the user's, and crediting the reply
for it would count the session's own material as an echo.

Logged on every click on both paths, and returned in the worker's `grounding`
object, since a hosted user has no console. Same discipline as the `[CONTEXA]
session … i=A..B` line: the capture bug survived an entire field test because
nothing counted anything.

### The spread gate, and the line it will not cross

A row is dropped when **every** move matched the reply **and** the session had at
least three turns to offer instead.

Both halves are load-bearing. Below three turns the reply genuinely is most of
the material, so a reply-earned row is the right answer and dropping it would
manufacture zeros out of good rows. And the condition is "every move matched the
reply", not "none matched a turn" — the first version tested `fromTurns > 0` and
therefore also dropped rows whose moves were merely **ungrounded**, silently
collapsing the two-tier rule where a near-miss quote renders and is counted. The
worker suite caught that on the first run.

Expect the zero rate to rise from *rare*. That is the accepted cost, and the
provenance line makes it measurable rather than guessed.

### The prompt, which now names the failure and shows it

`MOVES_SYSTEM`, byte-identical in both copies: a move earns its place by
**advancing what the earliest message was trying to get done**; when the reply
lists options, steps or questions, **that list is not the row** — with the reason
it is seductive stated outright, that the evidence quote is perfect every time;
and the row must **spread across the session**, because four transcribed moves
also have four distinct labels, which is all the old diversity rule ever asked
for. Plus a worked example of transcription in the existing "done WRONG" style,
since the abstract ban was already there and shipped the defect anyway.

### Two guards that could not have failed correctly

`build.mjs` extracted the shared helper block from `function cleanTurns` to
`return grounded;` — a marker that **ceased to exist** the moment `groundMoves`
began returning an object. A byte-identity check whose end anchor can vanish
reports "could not locate" rather than "drift": it still fails, but for the
wrong reason. It now reads to an explicit sentinel comment.

Worse, and older: `build.mjs` declared **its own `VERSION` literal** and
overwrote whatever `manifest.json` said. Bumping the manifest to 0.9.59 produced
a `build-ready/` and a zip still stamped 0.9.58, with every check passing — and
`release-commit.ps1` reads the manifest, so it would have tagged **v0.9.59 over
an artifact containing 0.9.58**. The version now has one home, read from the
manifest, and the worker's `BUILD` must agree with it — the same treatment the
model name has had across three files since 0.9.52.

### Known behaviour on a dev copy, recorded because it reads as a break

Installing this build unpacked and clicking the trigger draws *"This copy of
CONTEXA wasn't installed from the Chrome Web Store, so it can't use the free
service."* Nothing is wrong. A sideloaded build gets an extension ID that is not
the published one, `ALLOWED_EXTENSION_IDS` is pinned to the published one, and
the worker answers `403 forbidden_origin` — which is the whole point of that
pin: a stranger with the URL cannot spend the quota.

What makes it read as a regression is the second half. A fresh unpacked install
starts with an empty `chrome.storage.local`, so an API key set on the *previous*
copy is gone, and `background.js` branches on exactly that
(`const r = apiKey ? direct : hosted`). No key means the hosted path, which means
the origin lock. So the same tester who was working an hour ago sees it fail in
every browser at once, and the error itself is the proof of the cause:
`forbidden_origin` can only come from the worker, so seeing it establishes that
no key was set.

**The remedy on a dev copy is an own key**, in Options → Advanced — that path
goes straight to `api.anthropic.com` and never meets the lock.

The card names only the store, and that was reconsidered and kept. It is written
for the person who was handed a zip and has no API key to add; "add your own API
key" is advice they cannot take. Recorded here so the next reader can see the
choice was made rather than missed.

### Versions

Extension **0.9.59**, worker **0.9.59**. 327 assertions green (220 extension,
107 worker). Worker redeploy required: `MOVES_SYSTEM`, `groundMoves` and the
gate all live server-side too.

---

## 0.9.58 — Extension + Worker

*It stopped reading the reply for a question, and started reading her own
history for an idea.*

### One shape, mined from the session

CONTEXA no longer looks at Claude's reply for a dangling question. It reads
**the user's own messages across the whole session** and offers up to four
**independent** next moves — each already a complete, send-ready message. Click
one and it lands in the composer whole. Nothing folds together, nothing runs in
order, and picking one discards the rest. A menu, not an interview.

The reply is still read, demoted to **material**: what it just built is what
makes a new move possible. It is never the subject, and a move that sends the
user back over an answer they have already read is the worst output the prompt
can produce — named as such, in those words, in `MOVES_SYSTEM`.

The session is trimmed to fit by a policy with a wrong answer that still looks
right. **Turn one is pinned** — it states the goal, and a conversation read
without its opening has lost the point of itself — and the oldest *middle* turns
drop first, with a floor of two. A window keeping the last *n* turns would have
tested perfectly and silently decapitated every long session. Whole turns only:
a chopped-off sentence is worse material than no sentence. This is head-first,
which is what `clampCapture` already did; the planning doc called that
convention tail-first, and the policy derived from it was right for a reason the
doc got backwards.

### What this retired, and what it cost to keep

Deleted, not deprecated: the click-only interview and its pagination, dots and
per-question skip; the fifth chip and its free-text box, which was the last
place anything could be typed; hide-for-session, whose dismissal streak only the
interview could increment, so it was already unreachable; the standalone
`Assume:` array; the four earned move ids; and `/v1/expand`.

And then, on the owner's confirmation that there is no installed base to
protect, the **three-generation schema negotiation** went too — `v`, `accepts`,
`wantsQuestions`, `wantsChips`, `LEGACY_STEPS_SYSTEM`, `QUESTIONS_SYSTEM`,
`EXPAND_SYSTEM`. A handshake that always takes the same branch is a comment
pretending to be code. 0.9.31 built that machinery because the store approves on
Google's clock and no deploy order avoids a window of breakage; **if this
product ever has users on versions it cannot update, the `accepts: [...]`
opt-in is the pattern to bring back**, and that is written into `CLAUDE.md` so
the reasoning outlives the code.

`EXPAND_SYSTEM`'s composer rules did not go with it. They could not: click is
send-ready now, so `MOVES_SYSTEM` is the only prompt with a channel to the
composer. The `<paste here>` obligation, the `Assume:` lines,
one-ask-one-verb, the 700-character cap and the filler-word ban all moved across
intact. Dropping them would have recreated 0.9.49's inert instruction — a rule
pointing at a mechanism that no longer exists — which is the exact defect that
put those rules where they were.

Net: **4,222 lines removed.**

### Grounding had to widen, or the product would have reported itself broken

Every move is still earned by a verbatim quote, but the corpus is now **the
turns and the reply together**. Ideas are mined from the session, so a move
earned by turn one stating the goal is grounded. Checked against the reply
alone — which is what the filter did — nearly every history-earned move would
have failed its own gate, and a working product would have logged itself as a
broken one. Both tiers survive: no evidence at all is dropped, a near-miss quote
renders and is counted.

### The quota was silently promising half

`DEVICE_DAILY_LIMIT = PROMPTS_PER_DAY * 2` existed because a finished prompt
cost two upstream calls — questions, then compose. Mining removed the second,
so the multiplier would have enforced twice what the listing promised. The
**unit** moved with it, which is why the constant is renamed rather than
re-derived: "prompts per day" counts nothing when one call returns up to four of
them and the user may take none. What the quota meters is **replies asked
about** — which is what the store listing already said, so that copy stays true
unedited.

`IP_DAILY_LIMIT` carries from 400 to 200. Written down rather than inherited,
because the comment there exists precisely to record a ratio that once narrowed
with nobody deciding it. Accepted on one ground — a call now returns up to four
send-ready prompts where it returned a fraction of one — and named as the first
number to revisit if that stops being true.

Both limits meter **pre-existing counters**, which makes the halving a
deploy-day event and not just a constant. The KV keys are byte-identical across
the pivot — `q:<device>:<day>` and `ip:<hash>:<day>`, same 48h TTL — so nothing
is orphaned and nothing double-counts; but the ceiling above them drops 40 → 20
and 400 → 200 the instant the worker goes live. Any device already between 20
and 39 uses today is immediately `429`, with `used` greater than `limit` in the
body, until midnight UTC. Deploying just after 00:00 UTC avoids it entirely;
purging the `q:` and `ip:` prefixes is the other option. Recorded because it is
invisible in testing — a fresh device never hits it — and reads like a bug to
the one user it lands on.

A live bug went with it: the quota card **halved** the worker's limit before
printing it, which under the new ceiling would have told someone with 20 replies
left that they had 10. It also fell back to a hard-coded 20 when the worker
reported nothing — a second copy of a figure that exists in one place on
purpose. The card now prints what the worker sent, and names no number when the
worker named none.

### Zero is stronger than it was, and it says so out loud

Nothing mined means **no row of moves** — not the labelled empty shell the quiet
row used to draw. 0.9.53 added the fifth chip precisely because "they ASKED, and
a chip that answers a click by sitting there is a dead end", and deleting it
reopened that dead end: a click that mined nothing left the card to vanish with
no account of itself.

So the silence got a voice. A click that earns nothing now renders **"Nothing
for now."** — inert, `pointer-events: none`, gone after four seconds. It costs
no second call, because the answer already came back; it is the same zero the
row would have drawn, said rather than swallowed. That keeps both rules intact
at once: never fake output (it reports the real result), and zero is a valid
outcome (there is still no padded row, no floor, no fallback move).

The prediction this entry recorded before shipping — *"history mining should
reach zero far less often than reply mining did — almost every session has
prompt history"* — **held.** The field test came back **rare**. Scored here
because this repo scores its predictions, and because the alternative result
would have meant the shape was wrong, not the copy.

### The field test, and the one answer that was a bug report

Six questions went out against a real own-key session. Three came back clean:
zero is **rare**; the moves read as **independent**, which is the whole claim of
the menu; and the written prompts are **right even when edited**, which is what
a send-ready message has to be to be worth clicking.

**Two answers were too short to read, and are recorded as unresolved rather
than as findings.** #4 asked for a *sighting* of a backwards move — an "explain
that again", which `MOVES_SYSTEM` bans by name and calls the worst output it can
produce — and came back "Ok ban it", which is either endorsement of the existing
ban or a report that it is not landing. Nothing was changed on it, so the ban
stays **prompt-only**: there is no gate for it in `cleanMoves` on either path,
unlike the evidence rule, which is stated *and* enforced. Noted because it
decides the fix: if a sighting is ever confirmed, more wording is the wrong
answer — that line is already the strongest-worded in the prompt — and a gate is
the right one.

#5 asked whether a label can be chosen **without hovering**, labels being
model-written for the first time; it came back "Need more explanation", which is
either a request to restate the question or the answer itself. The label rule
was strengthened regardless, on its own merits: `MOVES_SYSTEM` now requires a
label to name **both the action and the thing it acts on**, with four worked
negatives ("Option A" names nothing, "Add a form" names an action with its
object missing). The clamp moved 40 → 60 characters in the same commit, because
a rule demanding a verb *and* its object cannot be enforced by a cap that
truncates the object. **The change stands; a field-test result behind it does
not**, and the two are recorded separately on purpose — an entry claiming
evidence it does not have would corrupt the one record this project scores
itself against.

The sixth — **"only the last exchange"** — was not a taste report. It was the
product failing its own headline claim, and it took two eliminations to reach:

- **Budget was eliminated by arithmetic.** `fitTurns` splices from index 1, so
  it structurally cannot drop the first entry; no drop policy could have starved
  the opening.
- **The prompt was eliminated by counting.** Its exemplars run about 2:1
  session-derived over reply-derived, so it was not teaching the model to read
  the last message.

The cause was in capture. `captureTurns()` numbered turns by **NodeList index**,
so a page holding only the last five turns of a twenty-turn thread returned
`i: 1..5` instead of `i: 16..20` — and `MOVES_SYSTEM` read `[1]` as *"turn one
states the goal"*. Not capture loss: capture loss that **nominates a
replacement opening**, and confidently. It erased the elision gap too, since
`1..N` is always contiguous, so nothing downstream could tell a full read from a
truncated one.

Fixed on both sides of the same misunderstanding. `i` is now documented as
**position among captured turns**, never conversation position — the wire
contract drafted in the audit said "true turn index", and the DOM cannot supply
that. And the prompt stopped asserting what it cannot know: the earliest message
is now *"the closest thing to a stated goal"* and explicitly *"not guaranteed to
be the conversation's true first"*. A second line names the failure directly —
a row whose every move comes from the newest exchange **"has read the last
message, not the session, and is the failure this shape exists to avoid."**
`askNow` now logs turn count, character count and the `i` range on every click,
so the next occurrence is one console line rather than an investigation.

**What remains open:** whether claude.ai's **standard chat** virtualises its
transcript at all. The mislabelling is fixed, but that only means a truncated
read no longer lies about which turn is first — it does not make the read
complete. The only hard measurement in this repo is a **Cowork** tab at ~3–5
rendered blocks (0.9.55); standard chat is **assumed** to keep the whole
transcript in the DOM and has never been measured. This is **pre-existing, not
a 0.9.58 regression** — capture has always read the DOM and only ever could.
The `[CONTEXA] session` line answers it from any long thread: `i=1..20` on a
twenty-turn conversation closes it, `i=1..4` means capture is reading a window
and the fix is a scroll-to-capture pass before reading. That pass is invasive
enough — it moves the host page under the user — that it is not worth building
against an assumption, which is why the diagnostic shipped and the fix did not.

### What the teardown broke, and how it was caught

Deleting test blocks by section marker took assertions for code that still
runs: the quota derivation guards, the whole prompt-caching degradation path
(`droppedThinking` and `droppedCache` are untouched in the worker), and
`trimPayload`'s clean-boundary behaviour, which now guards the text landing
verbatim in the message box. All restored — first against the *old* constants,
so they were seen passing; then the quota changed and two failed on cue; then
they were updated. A deletion that removes a guard while leaving its subject
running is the failure this project keeps recording, and it happened here.

The screenshot harness was **runtime-broken**, not merely stale: it read
`QUESTIONS.questions.length` after the fixture was swapped. `node --check`
passed, which is why an earlier check called it fine — a syntax check cannot see
an undefined reference. The driver now walks the real flow and was run end to
end under a real Chromium against the unmodified extension, producing five fresh
screenshots that confirm the row renders and one click fills the composer.

### Prose

The settings page had drifted a **second** time — to interview copy, four months
after `LISTING.md` recorded it drifting to chip copy. Its drift guard is now a
growing list of dead phrases rather than a single check, and it was extended to
cover `extension/README.md`, which **ships in the zip** and had no guard at
all — which is why it ended up the stalest prose in the repo, describing the
interview, the Ask/Offer fork, the chip taxonomy and the Rough-ask control
simultaneously.

`README.md`'s design notes inverted one rule and retired another. **One prompt,
one verb** still holds *within* a move; *between* moves it reverses, because
every move is required to stand alone — that is the difference between a menu
and a checklist. **Two controls must never share a label** became one control,
one job: the rule existed because a second control did.

### Versions

Extension **0.9.58**, worker **0.9.58**. 296 assertions green (193 extension,
103 worker).

---

## 0.9.57 — Extension + Worker

*The extra sentence turned out to be protecting nothing.*

### choose, risk, and why now outrank a question, even one the reply asked out loud

`QUESTIONS_SYSTEM` never said which shape wins when a reply earns both a move
and a question in the same breath — a gap 0.9.56 named and deliberately left
for its own change (see that release's "what remains open" note). Found in
the field: a reply that names an assumption and hands back a decision in one
sentence (*"brzo pojedu besplatnu kvotu od 1 GB... javi ako hoćeš da to
ubacim"* — flags a quota risk, then hands the fork back) is exactly the case
the prompt had no ruling for.

Fixed with one new bullet in the Hard rules block: **choose, risk, and why
outrank questions — if the reply earned any of them, return the move row and
no questions, even when the reply directly asked the user something.** Two
new worked examples pin the boundary either side of it:

- **"Deeper's own gate, not precedence"** — a reply that offers to go deeper
  *("I can expand this into a full draft once I know who it's for")* still
  has to ask, because the missing fact is something only the user holds.
  `deeper` fails on its own terms here; the precedence rule never enters it.
- **"Contested shape"** — a reply that states an assumption and hands back a
  decision in the same clause reads shallow as a question, but `choose` and
  `risk` both outrank it regardless.

### The anchor sentence didn't survive its own test

The rule shipped first with a second sentence carving out an exception for
`deeper` specifically (*"deeper never outranks a question: when deeper is the
only move the reply earned, ask instead"*). Three fixed inputs, three prompt
variants (PRE / NOW / DROP — the full rule minus that sentence), 5 runs each,
via `scripts/prompt-ab-fork.mjs` (extended from the 0.9.56 harness):

| input | what it tests | NOW (threshold) | DROP (threshold) |
|---|---|---|---|
| U1 — quota risk + decision (real capture) | moves earned | 3/5 (need ≥4/5) — **missed** | 5/5 (need ≥4/5) — passed |
| U2 — finished migration, nothing open | moves earned | 4/5 (need 5/5) — **missed** | 5/5 (need 5/5) — passed |
| U3 — code answer + plain offer to wire it in | the anchor's own kill test | 5/5 questions | 5/5 questions — **matches NOW** |

DROP didn't just tie NOW — it beat it on both move inputs, and matched it
exactly on the one input built to catch the anchor sentence doing something.
U3 took three fixture attempts to get right (v1 and v2 were both inert: their
own PRE already scored 5/5 questions, so neither could have detected the
anchor's absence even in principle — recorded in the harness's own history so
the dead ends aren't repeated). The pre-committed rule for the final attempt
was explicit: if DROP matches NOW again, ship DROP and stop. It matched a
third time. The anchor sentence is gone; the rule now reads as one sentence.

### Versions

Extension **0.9.57**, worker `BUILD` **0.9.57** — bumped together because the
shared prompt changed, same reasoning as 0.9.56: without it, `/v1/health`
cannot tell a pre-precedence-fix deploy from a post-precedence-fix one.
Ships to the worker on the next `wrangler deploy`; the extension side ships
on the Chrome Web Store's own clock, as always.

---

## 0.9.56 — Extension + Worker

*The questions stopped talking to her and started sounding like her.*

### Register C — the interview speaks in the user's inner voice

Spec: `CONTEXA-voice-spec.md`, decided in the design chat from three registers
rendered on the same interview. The questions and the option labels are now
written as the words she would use **thinking to herself**, never as a form
addressing her. The trigger already spoke that way — *"What now? ✦"* is a
thought, not an offer — so this makes the whole surface one voice: whisper,
trigger, questions, labels, and the composed prompt, which was always first
person because it *is* her draft.

**Prompt-only, and `QUESTIONS_SYSTEM` only.** `EXPAND_SYSTEM` is untouched: the
composed prompt's voice is a function, not a style. No wire change, no
`content.js` change, no schema change.

The register ships as a **rule plus re-voiced demonstrations**, in that order
of importance — Defect A says rules lose to exemplars, so the four exemplar
questions still written in second person were the actual work:

- *"Which piece do you want built first?"* → *"Which piece do I want built first?"*
- *"What will you upload?"* → *"What am I uploading?"*
- *"What do you want back?"* → *"What do I want back?"* — which is the voice
  spec's own worked example, arriving in the prompt by the shortest path
- and the refused one, *"What story do you want to tell?"* → *"…do I want to
  tell?"*, so that its refusal stays about clickability rather than voice

The rule replaces the old *"the question addresses THE USER"* line and carries
the register **as a test rather than an adjective**: would this line be at home
in her own head? It names the two failure shapes (service voice — *"Would you
like me to…"* is a waiter, not a thought; and second person — *"your device"*
breaks the mirror), nails *"I"* to the user, and prescribes the want-anchor
(*"What do I want this to say?"* over *"What should I write?"*) because this
register's named failure mode is the I drifting onto the tool. It also states
outright that a pronoun-free question is still in register, so nobody forces an
*I* into *"When did the problem start?"*. Options were already largely hers
(*"Give me the ones that scare me"*, *"A fix I can paste"*) and the rule now
says so, quoting two of them.

### The prompt stopped describing a UI that no longer exists

Found while editing, not by a test: `QUESTIONS_SYSTEM` still told the model
*"the free-text box is an escape hatch"* and that *"the interface adds those
itself"* for other/skip options. **0.9.55 removed the interview's free-text box
entirely.** The rule's conclusion was still right — drop a question you cannot
write options for — but its premise had gone false, so the line was strengthened
rather than deleted: **the card has NO PLACE TO TYPE**, options and a Skip are
everything the person has, and a question needing typing cannot be answered at
all. The header follows: *CLICKING IS THE ONLY REQUIRED INPUT* → **THE ONLY
INPUT**. Same for the Skip note, which now credits the card instead of a
vanished text field.

This is the "public copy goes stale silently" rule finding a new surface: a
system prompt is copy about the product too, and nothing sweeps it.

### The register is now guarded structurally, not by adjective

Nothing pinned the old voice rule, which is why four second-person exemplars
survived it. A "reads like her head" assertion would be a vibes check, so the
load-bearing one is **structural**: pull every question and option set the
prompt demonstrates and assert none of them addresses the reader. It is scoped
deliberately — **chip texts are excluded**, because a chip is a message she
sends *to Claude*, where *"you"* means Claude and is correct.

Mutation-verified, and the first attempt was a lesson: injecting *"your"* into
an option appeared to leave the guard silent, and the guard was fine — the
mutation had hit the wrong one of two identical strings (the other lives in the
new rule, which quotes that very option). **Grade a control on what actually
varied.** With the mutation on target, the guard fires.

Two assertions that pinned the removed free-text box moved to the new truth
rather than being loosened (Defect C: the failing test was the stale half, not
the code).

### Versions

Extension **0.9.56**, worker `BUILD` **0.9.56**. The prompt lives byte-identical
in both artifacts and the build enforces that, so a prompt change is never
worker-only — but the two reach users on different clocks: hosted users get the
voice from one `wrangler deploy`, own-key users when the package clears store
review. The extension bumped rather than editing 0.9.55 in place because 0.9.55
is *in review*: two different packages wearing one version would blind the mount
line, which is the diagnostic that exists precisely because two builds once ran
side by side. The worker `BUILD` bumped for the same reason one clock down —
0.9.54 could not tell a pre-voice deploy from a post-voice one.

**Field test before deploy, own-key first** (voice spec §5): a green suite proves
the prompt says the right things, never that the model speaks them.

### Field round 1, and the register's named failure arrived on day one

Own-key, mount line `v0.9.56`, one build logging. Off a reply that ended
*"javi ako hoćeš da to ubacim"* — an offer in **Claude's** first person — the
interview asked **"Da ubacim skaliranje slika pre slanja?"**. The register was
applied and the want-anchor was not: that *I* is the tool's, borrowed
word-for-word from the reply, which is exactly **I-drift**, the failure this
register was known to risk and was named for at decision time.

The shape around it was fine and worth recording, because the first reading was
wrong: this looked like the banned confirmation-yes/no on the reply's own
proposal, and it is not. Voice spec §3.1 bans the *unprompted* confirmation —
its specimen is a reply that had already settled the thing. Here the reply
**asked**, both options changed the next message, and sharpened criterion C
says that is §2b working. Only the pronoun was wrong.

Fixed before commit, which is the whole reason it cost nothing: the want-anchor
now names the case that broke it — *a reply that offers in its own first person
is the sharpest form of the trap; that "I" is Claude's and is never borrowed* —
and, because a rule alone is what missed this, a worked exemplar demonstrates
the turn: *"tell me if you want me to add image scaling before upload"* becomes
**"Do I want image scaling before upload?"**, never *"Should I add image
scaling?"*. Both halves are pinned, and the exemplar pin is mutation-verified.

One thing this capture cannot settle: every exemplar is English and the
specimen is Serbian, so whether the drift is general or amplified by the
language is untested in both directions.

### The fix, measured — and two of my own suspicions killed with it

The field could not test the want-anchor: the next three attempts all took the
moves branch, and the fourth was voided when an accidental message changed the
conversation underneath it. So the measurement moved offline —
`prompt-ab-fork.mjs`, new in this release: one fixed pair, three prompt
variants, five runs each, printing only which branch came back. It assembles
the call exactly as `background.js` does (same system prompt, same section
labels, same 2500 ceiling, same disabled thinking, same model), and it rebuilds
the pre-fix prompt by removing this release's two additions — reconstructing to
**19,464 characters, the exact length the prompt had before the fix**, which is
the check that it is testing the real previous state rather than an
approximation.

**The register fix works, and the numbers are not close:**

| variant | question asked | whose "I" |
|---|---|---|
| PRE — no rule, no exemplar | *"**Da ubacim** skaliranje slika pre slanja?"* ×4 | Claude's, **0 of 4** in her voice |
| NOW — rule + exemplar in the question block | *"Da li **mi treba**…"* ×2, *"Da li da ubacim…"* ×1 | 2 of 3 |
| END — same, exemplar after the moves block | *"Da li **hoću** da skaliram…"*, *"Da li **hoću**…"*, *"Da li **mi treba**…"* | **3 of 3** |

PRE reproduced the field's exact defective question four times out of four, so
the field capture was reproducible rather than a one-off. After the fix,
**5 of 6**. This is the field test §5 asked for, run on a bench instead of in
a browser because the browser could not hold the input still.

**Two things I had asserted turned out to be wrong, and the A/B is what
corrected them.**

*The voice edit did not move the fork.* One field run before the edit said
questions and three after said moves, which looked like a regression I had
introduced. On a fixed input it is PRE 4/5 questions, NOW 3/5, END 3/5 — one
run of difference, no signal. **The fork is stochastic on this input and was
already stochastic before the edit** (PRE takes the moves branch too). The
field's 3/3 was a different input and a small sample, not an effect.

*And the position suspicion was wrong.* This release's own notes name the
exemplar's placement after the moves block as the prime suspect for that
apparent regression. NOW and END split the branch identically, and END — the
"bad" position — worded its questions best. **The move back into the question
block stands as hygiene and is pinned by a grouping assertion; it explains
nothing.** Filed in the pattern file as Defect B's third instance with that
correction attached, because a suspicion recorded without its refutation is
worse than one never raised.

**What remains open, now with a number on it:** on a reply that asks the user
directly, the fork takes the moves branch **20–40% of the time**. That is wrong
by the prompt's own rule — the decision is hers to supply — and the gap is
readable in the text rather than inferred from runs: the prompt says what to ask
and says moves never accompany questions, but never says **which wins when both
are earned**. Pre-existing, not a 0.9.56 regression, and deliberately left for
its own change with its own before/after on the same harness.

*Harness limitation, stated so nobody reads more into it than it holds:* the
fixed pair is a transcription of the captured reply plus a stand-in user
message, so it reproduces the field's shape, not its bytes — it measures the
difference between variants, never the absolute rate. And one END run came back
`unparsed` where the product would have salvaged a partial; the harness is
stricter than the pipeline.

### What else the same session confirmed

**The moves branch fired in the field for the first time.** §2j had half a
result since 2026-08-26 — the questions arm had chosen correctly once, the
moves arm had never been seen by a human outside a test harness. Off a reply
that listed finished work and asked nothing (the exact shape §2j said a real
test needed), the row came back `Take it further · What could go wrong?`, and
`deeper` composed into the box. **Criterion Q now has data on both arms.**

Also confirmed live, all first sightings: the mascot mounts and is small; the
hover bubble `What now? ✦` renders; the busy state keeps the mascot in place
with `✦ reading…` beside it; the round-3 card shows pills, dots, Skip at the
row's end and an answered question collapsed to one line; `<paste … here>`
slots reach the message box; the standalone assume chip fires
(`assumed Array(1)` → `quiet row — nothing to ask (something stated instead)`).

**And one pre-existing defect caught on camera, unrelated to the voice.** A
composed prompt carried the fact in its body — *"I'm on Windows 11, PowerShell
5.1 only — no WSL, no git bash"* — and then repeated it as
`Assume: I'm on Windows 11 with PowerShell 5.1 only, no WSL or git bash`. That
is **criterion B with a capture**: §2h says the two routes are exclusive and one
fact fires only one of them, and `EXPAND_SYSTEM` is told outright that the same
fact arrives twice and to state it once. It said it twice. `EXPAND_SYSTEM` is
untouched by this release, so the specimen belongs to the composer, not the
register — filed, not fixed here.

---

## 0.9.55 — Extension

*The doorknob got a face.*

### The mascot IS the trigger (content spec §1)

Same slot, same mount conditions, same click handler, same spends-one-call-on-
click semantics — `renderTrigger` still renders once per completed reply, and
nothing about the conversation leaves the page before a deliberate click. What
changed is what stands in the slot: the 58×50 teal blob (§1c SVG, inline, one
source constant), popping in once on mount, winking rarely with one eye, and
whispering `What now? ✦` in a hover/focus bubble that can never intercept a
click (`pointer-events:none`). Keyboard users get the same product: a real
`<button>`, aria-label "What now?", Enter/Space fire natively, teal focus ring.

**Criterion P's trigger half closes here, by construction.** The old trigger
chip shared `chip own` with the pencil, the compose chip and *Hide for this
session*, and 0.9.53 proved a shared label costs a release. The mascot carries
`ctxa-mas-*` classes only and no text label at all — star asks, pencil types,
and they no longer even share an alphabet. The pencil keeps its label, its
classes and its box, untouched.

During the in-flight call the mascot stays put (idle animations may keep
running) and the existing `✦ reading…` presentation renders beside it; the
double-click a replaced chip used to prevent is prevented by `disabled`.
Reduced motion: entrance becomes a fade, idle animations off.

### The card wears the locked form (content spec §2)

Behavior byte-identical — same questions, same clicks, same composed prompt
landing visibly in the message box, CONTEXA never sends. The skin:

- **Pills, not sentences.** The pill shows a ≤4-word handle (`shortLabel`, the
  clamp move chips already enforce); the full option sentence — written for
  the user, delivered by the wire unchanged — rides the hover title and is
  what a click actually answers with. Label ≠ composed, zero wire involvement.
- **Dots, not "N of M".** One per question, current at full strength and the
  rest dimmed — positional colours red → yellow → blue → white (owner's
  order, field round 1; yellow is the site highlighter `#FFD84D`, blue the
  swatch-row `#4F77C5`, white ringed so it survives light surfaces) — and a
  cheap structural discriminator against claude.ai's own Cowork question
  widget, which says "N of M" (Contaminant 2). The ✦ CONTEXA marker stays,
  same reason.
- **Answered questions collapse** to one quiet line each (label + clicked
  answer); a skip collapses to nothing.
- **Surfaces follow the host; accents are brand teal.** The spec's quiet hat
  said coral accents with teal only on the small ✦ — the owner saw it live in
  field round 1 (*"sve je narandžasto"*) and overruled: `--accent` is
  `#15a594` light / `#2cc4ae` dark everywhere an accent goes (pill hover, nav
  hover, input focus, the ✦s, the mascot focus ring). Coral `#D97757` is
  claude.ai's send button, and the design brief bans it outright — the quiet
  hat kept it only as "the host's own"; the owner chose identity over
  camouflage. Error/amber states keep their own colour: a warning must not
  wear the brand. The live-value sampling §2 asks for was blocked (browser
  pane approval never arrived), so surfaces keep the shipped host-matching
  values; the field eye carries the Karpathy check.

Moves row, compose and the text box inherit the same tokens with zero behavior
change.

### The mascot reaches the manifest

`contexa-mascot-icon-{16,32,48,128}.png` (exported in the design phase — blob
face, square, RGBA, verified byte-for-byte into the zip) replace the coral
star under the conventional `icons/iconNN.png` names, and **32 is new** — the
queued 32px-icon item closes. The ring stays a brand asset (store, site); the
manifest is the mascot's. `action.default_icon` picks up 16/32/48.

### The last stale public surface

The manifest short description now says the button exists: the 125-char
replacement written in the listing doc §0, verbatim. NEXT-3 done. Store
screenshots are now the remaining stale surface (NEXT-4, unchanged — every
uploaded shot shows the old chip and card).

### Tests

Seven new structural assertions: mascot button in the trigger slot and not a
chip; star/pencil disjoint classes; aria-vs-pencil words differ; bubble
non-interactive; reduced motion honoured; one-eye wink (winks, never blinks);
the mount line stays the single mount record. Two touch assertions moved
selector with their requirement intact (44px minimum, affordance without
hover). One 0.9.53 assertion pinned the trigger handler's one-line SHAPE and
fired on the disabled-guard + hop; loosened to the gate it was written for —
askNow fires from a click listener inside the trigger machine, never from
reply completion. Suite green; the label-comparison assertion passes
untouched.

**Store clock only.** No wire, no prompts, no worker, no linter. Source
assertions cannot see a click and this change is entirely interaction surface:
field test per content spec §3 before store submit.

### Field round 1 (2026-08-27, same day)

Four findings; three design deltas ordered on sight, one diagnosis. The
mascot renders **31% smaller** (40×34.5 by CSS; the §1c constant stays
verbatim at 58×50). Accents flipped **coral → brand teal** (above). Dots took
**positional colours** (above). And *"no hover animation"*: the mechanism was
**executed, not argued** — a clean Chromium mounting the real CSS and DOM out
of `content.js` reports `winkIdle → winkOnce`, whisper puff and bubble both
at opacity 1 the moment :hover matches, at the new size too. The concluded
gesture (wink + whisper + bubble; lean-in stays rejected from the tuning
round) fires in isolation, and the bubble additionally gained a 3px rise so
the hover response reads as motion, not appearance. If the live page still
shows nothing on hover, the cause is environmental — an overlay eating
:hover in that composer neighbourhood (Grammarly draws there) — and needs the
recording, not the code.

### Field round 2 (2026-08-27) — built, seen, REVERTED the same hour

The full-brand card was ordered, built, seen live and pulled by the owner on
sight (*"mnogo napadno, moja greška"*): pitch-black surface in both themes,
teal frame, teal lettering turning white on click, every dash removed. It
rendered exactly as ordered — and seeing it next to the conversation settled
what the quiet hat had been arguing all along: the card is furniture, not a
billboard. **Recorded as a deliberate rejection — do not re-brand the
card.** The revert restores the round-1 skin verbatim: host surfaces and
borders, teal accents, colored dots, 40px mascot, dashed fallback chips and
the amber warning states included.

What round 2 leaves behind is the hover work, which stays. The mystery was
narrowed by execution: Grammarly ruled out by the owner, and a clean
Chromium re-fires the gesture on every entry (three consecutive hovers
probed, normal AND reduced-motion emulation) — so "once per refresh, never
again" is environmental to that page. Two hardenings shipped and kept: the
gesture is class-driven (`.ctxa-peek`) from the button's own
mouseenter/focus with a forced-reflow restart — deterministic per entry,
keyboard focus gets the gesture too — and the holder carries
`position:relative; z-index:5`, the §1e-sanctioned modest lift. The owner
then ran the discriminator: `elementFromPoint` at the mascot's center
returns the CONTEXA holder — **nothing overlays the mascot; the overlay
theory is dead.** What remains to observe live: whether the peek-driven
gesture fires now; if not, Tab-focus vs mouse splits event delivery from
everything else.

### Field round 3 (2026-08-28) — the interview goes click-only, literally

The "Something else…" free-text input is gone and Skip moved up into the
options row, pushed to its right edge; the foot is no more. **This is the
release's one deliberate behavior change** — the content spec said
visual-only, and the owner re-scoped it in the field, which she can, because
nothing has shipped. Her reason is structural, not aesthetic: the typing
affordance already exists downstream — skipping everything lands on the
fifth chip, and a click that earned nothing opens the box (0.9.53) — so the
per-question input was a duplicate affordance wearing a different position.
§2b stops carrying an asterisk: answers are clicks, Skip is the out, and the
second button is where typing lives.

What it cost, swept the same day: the store description's sentence promising
the box ("There is a box for typing your own…") is deleted from the listing
doc §1 — safe to paste any time, since against live 0.9.54 the copy merely
under-promises and against 0.9.55 it is exact. In code, the dead
zero-options placeholder branch ("Type your answer…") died with the input it
decorated — the pipeline has guaranteed two-plus options per question since
0.9.33. The 16px mobile-input assertion moved to the input that survives
(the rough-ask box); a new structural assertion pins the interview
rendering no input at all, with Skip riding the options row.

---

## 0.9.54 — Extension

*The questionnaire stopped being the only answer.*

### One call, two shapes, never both

Until now every click produced an interview. That is the right output when the
reply left something **only the user can decide**. It was the wrong one — four
clicks and two calls — when the reply had simply left a **move** on the table.

`QUESTIONS_SYSTEM` now forks: needs something only they can supply → **ask**;
left a move → **offer** one to four, ids `deeper` `choose` `risk` `why`; settled
something → **state** it; left nothing → **silence**.

**Most of the fork was already written.** *"Ask what only the user can answer"*
had been a filter on questions since 0.9.30; promoting it makes it the branch,
and the model learns no new concept. Five more rules only needed rewording to
admit moves — the evidence gate, look-past-the-turn, must-change,
acting-is-priced, and named-candidates, which is exactly why a move says
*"Why Vite rather than Webpack?"* and never *"Why that approach?"*

**Cost: +3,298 characters, +21%.** More than the +1,336 that brought back a
fixed bug in 0.9.36. That is the number to remember if something misbehaves.

### Three of four moves spend nothing

`choose`, `risk` and `why` arrive as finished messages and go straight into the
composer — **no second call.** Only `deeper` carries an intent rather than a
message, and only `deeper` reaches `EXPAND_SYSTEM`, because slots, `Assume:`
lines and the one-verb rule are what that prompt is for.

Those rules were deliberately NOT copied across to save the call: 0.9.36 added
1,336 characters to a prompt and undid a fix. Short moves need three composition
rules, not thirty.

**An assumption survives either branch.** `deeper` hands it to the composer. A
direct insert has no composer, so `withAssume` appends the lines client-side —
plain text, same convention, nothing invented on the way.

### What the renderer refuses

Moves get **`.chip move`**, not `.chip.own` — that class belongs to the fallback
and already carries four controls. Left otherwise unstyled on purpose; the
visual direction is unresolved.

**No standalone assume chip beside them**: two mechanisms competing for one slot
would put five chips in a row. Moves are the offer; assumptions ride into
whichever is clicked. And a move whose id the renderer cannot label is dropped
before it draws — a dead button is a defect the user can see and we cannot.

### The client finally announces

`accepts: ['chips']` ships now, and only now: **a client that announces what it
cannot draw gets back buttons that do nothing.** The negotiation and the
validator have been live and dormant since worker 0.9.52 precisely so this could
be the only moving part.

### Two assertions failed and neither had found a bug

Both pinned wording that was deliberately broadened. Rewritten to assert the
**broadening** — the must-change rule is now two assertions where it was one.
Then twenty-two more, including one per id: **Defect A applied to a value rather
than a field.** An id with no worked demonstration will never be produced,
however clearly the list names it.

**The best result came from breaking it on purpose.** Moving the filled move
example below the zero restatement — exactly what 0.9.49 did by accident — was
caught by the **0.9.29 final-position assertion**, written six releases ago for
a different reason. That position now has two independent guards.

### The known risk, stated before shipping

Questions are demonstrated ten times in the prompt; moves three. **A
demonstration count is a floor on capability, not a dial on frequency** — 0.9.50
proved that. What those three buy is that moves *can* fire, not that they will at
any rate. **The branch condition is the only thing deciding the split.** If the
field shows moves never appearing, the condition is wrong, not the count.

---

## 0.9.52 — Backend

*A third client generation, negotiated and deliberately empty.*

### The trick that got us here does not stretch to three

`wantsQuestions` works by presence alone: a client that sends `v` understands
questions, and **sending the field IS the answer.** No parsing, nothing to get
wrong.

That does not extend. A 0.9.30 client and a chip-aware one both send `v`, so
separating them would mean comparing versions — and a naive string compare puts
`0.9.9` above `0.9.54`. Real bug class, zero benefit.

So: the same trick, one field further out.

```
accepts: ['chips']
```

A list rather than another boolean, because there will be a fourth generation and
this is the mechanism that survives it without growing a field each time. And
chips require the questions generation too — a client old enough to read only
`steps` cannot render a chip, so announcing one is never sufficient on its own.

### The key is empty on purpose

A chip-aware client now receives `chips: []`. The prompt does not earn any yet.

**The channel gets proved end to end before anything travels down it**, and the
worker can deploy today rather than waiting on a store review that has not
happened. Nothing announces chip support yet, so nothing receives them — this
ships dormant.

### What the eleven new assertions are actually guarding

Not the happy path. **A client that did not ask for chips must never see the
key.** An unknown shape reads to it as nothing earned, and it renders a quiet row
forever: working product, permanent silence, nothing wrong in the console. That
is instance 3 of the theme, it is precisely how 0.9.30 broke, and with the store
twenty versions behind the affected population is real rather than hypothetical.

Verified by breaking it — removing the gate so the key leaks to everyone fails
three assertions immediately, the outage-shaped one first.

Also pinned: `accepts` as a bare string, an empty list, a list naming something
else, an object, and absent — all ignored. And a legacy client announcing chips
still gets `steps`.

**Mili tests on own-key and would never have seen any of this.**

### `cleanChips`, and one honest flag

The validator lands in both artifacts at once, byte-identical, like `cleanAssume`
— **but unlike `cleanAssume` it is pinned by a test rather than by convention.**
A validator that drifts between artifacts is two products wearing one name, and
the assertion earned itself immediately: adding a fifth id to one copy failed it
on the first run.

The id list is **closed**: `deeper`, `choose`, `risk`, `why`. An id the renderer
has no case for is worse than no chip, because it draws a button that does
nothing — a defect the user can see and we cannot. `simpler` is cut from v1 and
is the likeliest improvisation, so it is the one the test names.

Same gate as questions: **no evidence, no chip.** One of each id at most. Text
capped at 300, evidence at 90.

**One or the other, enforced in the pipeline on both paths** — not in the
renderer. A row holding an interview card *and* a chip row is two products on
screen, which is the shape claude.ai's own Cowork widget already produces by
accident, and the client must not be the only thing between us and shipping it
deliberately.

**And `quiet` stopped lying.** The worker flagged `quiet: true` whenever no
questions were earned. A row with chips has earned something, so flagging it
quiet would collapse the 0.9.29 split between *nothing was earned* and
*something was* — in the one field whose entire job is telling the truth about
silence. Identical to before on every call where chips is empty, which is all of
them until the prompt earns one.

---

## 0.9.53 — Extension

*The questions call no longer happens for every reply. It happens when someone
asks for it.*

### What it was actually costing

Every completed reply spent a call. `bumpQuota` in the worker sits in the shared
gate **before** the endpoint split, so `/v1/next-steps` charges the pool exactly
like `/v1/expand` does — which means the free tier's twenty were being eaten by
replies nobody ever looked at. A twenty-turn conversation could exhaust the
whole day without a single chip being clicked. *"Fair use is 10 prompts a day"*
was only ever true for someone who used every card CONTEXA drew.

Lazy-calling does not trim that cost. It moves it onto the replies someone
actually asked about, which is the only place it was ever buying anything.

**And nothing about the conversation leaves the page until a deliberate click.**
That is the larger change and it was a side effect, not the goal.

### The shape

The row now arrives with one chip and no model call behind it. Clicking it runs
`askNow`, which is the old body of `onReplyComplete` with nothing altered but
where it reads the captured pair from.

- **questions earned** → the interview card, unchanged
- **nothing asked but something stated** → the standalone compose chip (0.9.49),
  unchanged
- **nothing at all** → the input opens

**Capture stays eager, deliberately.** It is free, the DOM is settled at reply
completion, and deferring it would mean walking a reply claude.ai may have
re-rendered by the time the click lands. Only the *call* moved.

### The quiet row had to change, and this is not a floor

A quiet row used to be free: it arrived unbidden, so silence cost the reader
nothing. Now they **asked**, and a chip that answers a click by sitting there is
a dead end.

Nothing is invented to fill it. No question, no suggestion and no assumption is
fabricated — the input simply opens, which is what their next click would have
done anyway, and the row is still empty. The gate is `assume.length === 0`, not
`true`: an assumption on offer is a better answer than a blank box, and stealing
focus from it would bury the one thing the call earned. Both halves are pinned,
and the floor version fails the suite.

`renderTrigger` is a separate three-line machine rather than `appendOwnChip`
with a second click handler. That state machine's whole job is idle → input →
busy, and giving its idle state a second meaning would make every assertion
about it ambiguous.

### Two buttons cannot share a label

The trigger's first draft copied the fifth chip's label verbatim —
`✎ Type & create magic` on both. One spends a call and comes back with
questions; the other opens a text box. They can appear in the same row, and
0.9.52's whole argument for that label was that it says *what to do*. On the
trigger it said the wrong thing: the action is a click, and typing is now the
rare fallback rather than the path.

The trigger is **`✦ What do I say next?`**. The fifth chip keeps
`✎ Type & create magic`, because you really do type there. **Star asks, pencil
types.**

Pinned by an assertion that compares the two labels rather than checking either
one — the rare case where the requirement genuinely is about copy: not what
either button says, but that they do not say the same thing. It fails when they
match.

### `watchScroll` and `dismissStreak` are untouched, on purpose

Both were proposed for retirement on the grounds that nothing appears unbidden
any more. **That reasoning is wrong and the code says so.** `shell()` mounts with
`host.before(holder)` where `host` is the composer — the card is pinned above a
sticky composer and is on screen at every scroll position. It is in the way
because of *where it lives*, not *how it arrived*, and on-demand changes only
the second. Delete the watcher and 0.9.46's problem returns; `cardH` is measured
live, so a short trigger row already gets a proportionally shorter hide zone
with no change at all.

`dismissStreak` keeps its mechanism and changes meaning: the trigger still
appears unbidden, so *"stays quiet in this tab"* still has something to silence.
A dismissal now means *I asked for this and it was useless*, which is a stronger
signal than closing something nobody requested — if the threshold moves it
should go up. **Open, not settled.**

### Four assertions failed and none of them had found a bug

All four pinned distance or arity: two `[\s\S]{0,N}` spans too short for a
comment that grew, one `const ctx = ` that pinned *where* an object is built
rather than that it carries the pair, and one trailing `\)` that pinned a call's
argument count. Every requirement underneath survived the change intact.

That is Defect C four times from one edit. Each was widened or loosened to the
requirement it was written for — `[,)]` instead of `\)`, so a bare `true` still
fails — and six assertions were added for the paths that are new, two of which
were verified by breaking the code and watching them fail.

---

## 0.9.52 — Extension

*Three words on a button, and one test that was lying about what it checked.*

### "Rough ask" was jargon

`✎ Rough ask…` → **`✎ Type & create magic`**. *Ask* as a noun is startup-speak,
and the audience is people who have never opened a terminal. The new label does
two jobs at once: it says what to do (type) and what comes back.

The tooltip that sat beside it — *"Type it rough — CONTEXA writes it properly"* —
is **gone, not reworded.** It restated the label in other words, it never fires
on touch, and a tooltip that repeats its own button is the interface version of
a floor. There is a comment where it used to be saying not to add one back.

**The input's placeholder is untouched, deliberately.** *"Type it rough — I'll
write it properly"* is the only line in the product that tells a beginner they
are allowed to write badly, and it appears at the one moment that matters:
staring at an empty box. The chip sells the outcome; the placeholder gives
permission. Matching them would have been consistency bought with the only
instruction doing real work.

`options.html` follows the label. `LISTING.md` never mentioned it.

### A string match wearing a structural check's clothes

```js
t('rough-ask chip present', c.includes('Rough ask'));      // before
```

That assertion claimed to check the chip exists. It checked its **copy** — so
renaming three words broke it, and it would have passed just as happily on a
build where the chip was deleted and the phrase survived in a comment.

```js
t('the fifth chip renders with its own class',              // after
  /function appendOwnChip\([\s\S]{0,400}chip\.className = 'chip own'/.test(c));
```

Same family as the chrome-detection probes and watch criterion J: **matching on
text cannot distinguish a thing from prose about that thing.** Two neighbouring
assertions had stale names for the same reason and were already structural
underneath — those got their labels corrected and nothing else.

---

## 0.9.51 — Extension

*One line. Every console reading now says which build produced it.*

### Two measurements were lost for the same reason

**The rogue install.** A Web Store copy (0.9.32) ran alongside the unpacked
build for two sessions — double-billing every reply and interleaving two sets
of counts in one console. It was caught only by noticing that `grounding`
printed at two different *line numbers* and grepping every shipped zip to date
`358` to v0.9.32.

**0.9.50.** A prompt-only change: `content.js` stayed byte-identical to 0.9.49,
so every line number was the same in both, and **no reading taken that evening
could say which prompt produced it.** Four runs, zero `assumed`, and no way to
rule out that all four were 0.9.49.

Line numbers were doing this job by accident. They only work when the code
moves, and the changes most worth measuring are exactly the ones that move no
code in the file you are watching.

```
[CONTEXA] card mounted v0.9.51 ai anchor top=208 bottom=687 viewport=1063 connected=true
```

A second CONTEXA in the page now announces itself on the first card it mounts.

### `v?` is a signal, not a fallback

An orphaned content script — one left behind by an extension reload without a
tab refresh — throws on `chrome.runtime.getManifest()`. Guarded, so the log
survives and prints `v?`, which is precisely the tab that needs a Ctrl+R. Pinned
by a test, because losing the guard in a refactor would silently kill the mount
log on exactly the tabs it exists to identify.

---

## 0.9.50 — Extension and Backend

*One exemplar. 0.9.49's `assume` fires on the case it was built for — but only
about half the time, measured on the same conversation twice.*

### What was measured

0.9.49 shipped and was field-proven the same day: a PowerShell prompt and a
build error in the user's message, a reply asking her to run two commands, and

```
[CONTEXA] grounding {total: 0, kept: 0, grounded: 0}
[CONTEXA] assumed ["I'm on Windows using PowerShell, not bash"]
[CONTEXA] quiet row — nothing to ask (something stated instead)
```

**Twenty minutes later the same exchange produced a plain quiet row.** Same
input, no `assumed`, no standalone chip.

A miss costs nothing — it lands exactly on pre-0.9.49 behaviour, and nothing is
fabricated. But a feature that fires half the time on its own best case is not
really shipped.

### The knob was the demonstration count, not a rule

`assume` was demonstrated in **1 of 9** worked exemplars. That was deliberate —
pattern-file Defect A′ — because it is optional output a model is rewarded for
producing, and over-demonstrating it builds the floor that §2a forbids. The
minimum was set too low.

Now **2 of 10**, and the test's ceiling of one third is untouched. No rule was
weakened; the guards that keep it from becoming a floor are all still in place.

The second exemplar is deliberately **not** another shell fact — two
demonstrations of the same subject would teach "assume is for operating
systems". It is a spreadsheet sample that settles a currency, and it demonstrates
the **standalone shape** (`{"questions":[],"assume":[…]}`), which is the shape
that actually missed: in both the hit and the miss the model returned zero
questions, so the only variable was whether it added the assumption.

### A test that measured a syntax

The exemplar counter matched only the prose form `assume ["…"]`. The new
exemplar is written in the literal output form `{"questions":[],"assume":[…]}`,
and the counter read the addition as **zero**.

Same defect as the three source-shape assertions retired in 0.9.49, one release
later, in a test written *by* that release. The requirement is "how many
exemplars show the model producing an assumption"; the shape it is written in is
not part of it. The counter now matches both forms.

### Also confirmed, and correct

The Serbian test **did not** fire `assume`, and should not have. The composed
prompt came back entirely in Serbian with slots. An `Assume: Serbian` line on a
prompt already written in Serbian changes nothing — which is the definition of
decoration the rule already refuses. It carried the fact by using it.

---

## 0.9.49 — Extension and Backend

*The other half of the heuristic 0.9.48 borrowed. 0.9.48 taught CONTEXA when
**not** to ask. This teaches it that a question dropped because the conversation
already answered it should be **stated**, not silently lost.*

### The gap was structural, not a missing rule

The heuristic is one sentence: *would a different answer change what happens
next? No → don't ask, pick, and say what you picked.* 0.9.48 shipped the first
clause. The second was not weakly implemented — it was **impossible**. The
questions call and the expand call are independent: `expandPrompt` receives the
click list, the last message, and the reply, and never learns a question existed
and was dropped. A dropped question did not become an assumption. It evaporated.

So this is a wire change, not a prompt change: the questions response gained a
top-level `assume` array, and it travels through `content.js` into the expand
call, where `EXPAND_SYSTEM` renders each entry verbatim as an `Assume:` line in
the composed prompt.

### Not every dropped question earns one

0.9.48 drops questions for two different reasons and they are **not**
equivalent:

- **No answer would change the outcome.** The assumption is worthless too.
  Writing it into the prompt relocates decoration from the card into the user's
  message. Silence stays correct.
- **Not clickable, or the options cannot be ranked.** Here the answer *would*
  have changed the outcome; CONTEXA simply could not write options for it. This
  is the one worth stating.

Before 0.9.49 both disappeared identically. The prompt now names the
distinction, and the enforcement is blunt on purpose: a statement ending in `?`
is discarded, because an `Assume:` line that is really a question puts CONTEXA's
question inside the message the user is about to send to Claude.

### The standalone case

An assumption can now ride with **zero** questions — a reply that left nothing
to ask but did settle something. That row already rendered (the 0.9.29 quiet
row draws the shell and the Rough ask chip); it gains **one** chip,
`→ Write my next message`, which composes with no typing and no clicking.

Two properties are deliberate. The chip is **mute about the assumption** — the
card stays one line, and the `Assume:` line lands in the message box, which is
the only place the user can edit it. And it appears only when the model actually
stated something: **there is no floor here.** A reply that settled nothing keeps
the 0.9.29 quiet row exactly as quiet as it was. Dismissing an interview does
not produce the chip either — a closed card coming back as a one-click button
reads as the card refusing to leave.

### Both directions, without a deploy order

A wire change couples two artifacts that ship on different clocks, and 0.9.30
broke in both directions for exactly this reason. Here neither direction
depends on ordering:

- **New worker, old extension** — the extra `assume` key is ignored. The worker
  can deploy the moment it is ready.
- **New extension, old worker** — the standalone chip sends the same facts
  *twice*: in `assume`, and in the intent as `Assumed:` lines. A pre-0.9.49
  worker drops the field it does not know and reads the intent as a click list
  holding no decision, which it already handles — so it composes a correct
  prompt with the facts folded into the body instead of rejecting an empty
  intent. `EXPAND_SYSTEM` is told the two are one fact arriving twice and to
  state it once.

The legacy `steps` shape is never sent an `assume` field: a pre-0.9.30 client
has no code that reads it.

### An inert instruction, found while checking

`QUESTIONS_SYSTEM` told the model, about a question it had just refused, that
*"the story itself goes into the composed prompt as `<paste here>`"* — and, in
the click-only rule, that material the user must supply *"belongs in the composed
prompt as `<paste here>` or `<attach here>`."* Neither was true. That prompt
emits JSON questions and has no channel to the composer. Two sentences
instructing a model to do something it structurally cannot.

`EXPAND_SYSTEM` is the only place that can, so the obligation moved there and is
now pinned by a test. Same family as *required but never demonstrated*: an
instruction that reads like a mechanism with no mechanism behind it.

### Tests

The whole risk of this release is one sentence: **it adds an array a model is
rewarded for filling, next to a product rule that says an empty row is correct.**
Every defect in the pattern file came from something that guaranteed a non-empty
row. So the new assertions are weighted toward absence — what keeps `assume`
empty, and what must never quietly make it non-empty — including the
demonstration count itself: at least one worked exemplar shows `assume`, but no
more than a third may, and the primary complete-answer example must **not**
carry it.

That count test earned itself immediately. The first draft appended the
standalone JSON example to the end of `QUESTIONS_SYSTEM`, displacing the
zero-questions restatement from the final position — so the last thing a model
read would have been *"no questions, therefore add an assumption."* The
final-position assertion from 0.9.29 caught it before it ran once.

Three source-shape assertions failed on this refactor and were rewritten to
assert the requirement instead of the syntax — the seventh, eighth and ninth of
that class. `renderSteps` no longer has its signature pinned; the requirement
was always that *nothing about a partial salvage reaches the renderer*, which is
now what is checked.

---

## 0.9.48 — Extension and Backend

*Three rules borrowed from how Claude decides to ask a clarifying question at
all. Two of them close pattern-file classes that have been open and unbuilt
since 2026-08-22.*

### Decidability — the gate nothing tested

Every existing check asks whether a question is **earned** (evidence) or
**answerable** (click-only). **None asked whether it matters.**

That is exactly the hole **Class 3 — the timid chip** fell through: a perfectly
grounded, perfectly clickable question about the least consequential open thing
passes every gate in the prompt.

> **EVERY QUESTION MUST CHANGE THE ANSWER.** Picture the composed prompt for
> each option. If every answer produces the same message, the question is
> decoration — drop it, however well earned and however clickable it is.

Worked through as a refusal built from the Class 3 specimen: a reply names a
blocking store submission and the failure it expects, and *"Add the predicted
failure to the release notes?"* is earned, clickable **and worthless**, because
a line in a document does not change the release. The exemplar shows the
question that does decide the outcome taking its place.

### Asking is priced

*"The reply decides the number"* never said a question has to be **worth a
click**, which made "I could ask this" and "I should ask this" the same
sentence. Now: each question spends the reader's attention before they get
anything, and **two questions that change the outcome beat four that are merely
answerable.**

### Ordering is a self-test, not a format

Most-likely-first existed only as a formatting instruction. It is a diagnostic:
if you cannot say which option is likeliest, you probably do not understand the
situation.

**Stated carefully, because the loose version does harm.** CONTEXA asks about
facts only the user knows, and sometimes no answer genuinely is likelier —
dropping on "I cannot rank these" would lose good questions. The tell is
narrower: **"this CONVERSATION gives me nothing to rank by"**, which means the
question is a form field the reply never earned.

The exemplar shows both sides of that line. After a reply about tidying a
spreadsheet, *"Where is this data from?"* with `["A database","An API",
"Somewhere else"]` cannot be ranked — nothing in the reply points anywhere.
When the reply ends *"upload it and I'll run these on the real numbers"*, the
same ground becomes rankable, and the question is earned.

### Notes

`QUESTIONS_SYSTEM` goes 10,163 → 12,080 characters. Ten assertions pin the three
rules and both refusals; the one-evidence-per-question invariant still holds
across all eight exemplars, and the zero-questions guard is still the last line.

**Backend jumps 0.9.41 → 0.9.48.** The prompt is byte-identical across both
copies, so this is not extension-only — it needs a deploy, and hosted users get
it the moment that lands.

---

## 0.9.47 — Extension only (Backend stays 0.9.41)

*A pre-launch audit of the surfaces, not the code. The product moved sixteen
releases ago and three of its descriptions never followed.*

### The settings page was advertising chips

`options.html`, the first thing a new install shows:

> *"When the answer finishes, **a row of suggestions appears under it**. Each one
> is a good next thing to ask. Click one and the full message is written into
> your message box."*

Every sentence is pre-0.9.30. **"Under it" was wrong from 0.9.30 too**, when the
card moved above the composer. It now describes what actually happens: one short
question at a time, above the message box, never more than four, answers already
written, quiet when the reply left nothing worth asking.

**The gap that let it live four months: nothing in this suite had ever read a
user-facing sentence.** Ids, counts, selectors, storage, behaviour — all
covered. Prose, never. Ten assertions now check it, including a dead-vocabulary
list; restoring the old sentence fails four of them.

Same defect, same day, three surfaces: this page, both promo tiles (rebuilt —
the marquee had a literal `SUGGESTED NEXT STEPS` header), and every screenshot
in `publishing/screenshots/`, which is now fronted by a README saying so.

### A hidden card could still be tabbed into

`.wrap.away` set `opacity:0` and `pointer-events:none` — **neither removes an
element from the tab order.** Clipped content stays focusable, so Tab could land
on a button nobody can see. And it self-amplified: focus inside the shadow root
makes `busy()` true, which **forces the card open again**. Tabbing past a hidden
card could pop it back.

`visibility:hidden`, delayed 0.2s so it lands after the fade rather than cutting
it.

### The fold never folded

`.wrap` had no base `max-height`, so it computed to `none`. **`none → 0` does
not interpolate**: the height snapped shut while opacity spent 0.22s fading
something already zero-tall. The CSS described an animation it never performed
for fourteen releases. A 600px base gives it something to animate from — clear
of a four-option card on any screen, and it cannot clip, since the base rule
sets no overflow.

### The theme froze at mount

Decided once in `shell()` and never revisited, so switching claude.ai between
light and dark left an open card in the old palette. Now follows both the media
query and a `MutationObserver` on the root element — because the app toggles
theme itself, which a media query alone would miss.

### LISTING.md

Replaced with a pointer to the project doc, **keeping the one argument worth
preserving**: it had reasoned that "Claude" should be absent from the extension
name on store-policy grounds. Checked against the policy — the rule targets
impersonation and false endorsement, not naming the service you work with — the
name leads with our own brand and the description carries the mandatory
non-affiliation line. Over-cautious, and the reasoning is recorded along with
what *would* make it a real risk.

---

## 0.9.46 — Extension only (Backend stays 0.9.41)

*Fourth rule, and the first one that is about the reader instead of the page.*

### What was actually wrong

Owner's words: *"everytime you do a single scroll it dissapears for a moment,
after every scroll it does it, looks stupid and like a bug"* and *"make her
invisible or transparent when she catches a lot of text."*

Three rules had been tried. 0.9.33 and 0.9.41 keyed off the **anchored turn's
position**; 0.9.42 keyed off **motion**. All three answered "is the page
moving/where is the turn", and the question was always **"is there a wall of
conversation pressed up against this card."**

Motion is gone. There is no timer anywhere in the watcher now. The rule is the
reader's distance from the bottom of the conversation: past it, hidden and
staying hidden; near it, visible. A single wheel notch near the bottom does
**nothing at all**, which was the complaint.

### The hysteresis is the mechanism, not a polish

Every earlier version measured a quantity **the card itself changes**. Collapse
it, the conversation area grows by the card's height, the reading that caused
the hide reverses, it shows, it collapses again. **That loop was the flicker**,
and 0.9.45 patched it with a 300ms deaf window.

The two thresholds are now separated by more than the card's own height:

```
show when  fromBottom < 140
hide when  fromBottom > 140 + cardHeight + 60
```

A collapse can move the reading by at most `cardHeight`, which is by
construction not enough to cross back. **The loop is impossible rather than
suppressed** — no debounce, no quiet window, no timers at all. `cardHeight` is
measured from the live card while it still has one, so a taller card on a phone
widens its own dead band.

### The fixture models the coupling on purpose

Its fake scroller **grows by 160px when the card collapses** — the exact
coupling that made three versions oscillate — and two assertions pin the
arithmetic in both directions: hiding drops the reading from 500 to 340 and 340
is still past `hideAt`; showing lifts it from 100 to 260 and 260 is still short
of it. Twenty-two cases, including the complaint itself: *a single small scroll
does NOT hide it.*

Fourth rewrite of this fixture, and the first whose model is the requirement
rather than the implementation.

---

## 0.9.45 — Extension only (Backend stays 0.9.41)

*The card was scrolling the page, and then reacting to it.*

### A feature whose effect was its own input

Owner-reported as flicker, and the frames confirm it: the conversation jumping
several times a second.

Collapsing the card changes the height of the composer stack. The conversation
re-anchors to the bottom. **That fires a scroll** — which hid the card again,
which reflowed again. 0.9.42 turned motion into the trigger without asking where
the motion came from, and the answer was: from the card.

Every scroll that follows a real change to the `away` class is now ignored for
300ms. The window opens **only on an actual change**, so a reader who keeps
scrolling while it is already hidden is never ignored — the loop is cut without
making the card deaf.

### The fixture had to learn that time passes

The behavioural tests fired scrolls with no time between them, which is a
perfect model of the bug and a useless model of a person. They now separate the
two: `userScroll()` advances past the quiet window first, and a deliberate raw
repeat asserts that a scroll **inside** the window changes nothing.

Twenty-four cases, three of them new and specifically about self-inflicted
motion.

### Five source-shape assertions rewritten

Moving three `classList` calls behind one `setAway()` broke five assertions that
matched the old inline shapes. They match behaviour-bearing lines now, but the
lesson is the count: **an assertion that pins how something is written breaks
every time it is written differently, and never once tells you the behaviour
changed.**

---

## 0.9.44 — Extension only (Backend stays 0.9.41)

*The render path had no voice.*

`[CONTEXA] grounding {total: 1, kept: 1, grounded: 1}` proved a card had been
**earned**. Nothing anywhere said whether one was ever **seen**. So a card that
was built and then hidden looked, from the console, exactly like no card at all
— and three rounds of diagnosis went into guessing which it was.

That is the worker's two-silences rule, unapplied on the client for eleven
releases: **if a state can be reached two ways and only one of them is a defect,
the two must be distinguishable at the end of the pipe.**

Now they are:

- `[CONTEXA] card mounted <mode> anchor top=… bottom=… viewport=… connected=…`
  — fires the moment a card is inserted, carrying the exact geometry that
  decides whether it will be hidden.
- `[CONTEXA] hidden — page moving` — the motion path, logged once per hide
  rather than once per scroll event.
- `[CONTEXA] settled — hidden, turn off screen | visible  top=… bottom=… vh=…`
  — the resting decision, with the numbers, not just the verdict.
- `[CONTEXA] no composer found — card not mounted` and
  `[CONTEXA] scroll watcher found no .wrap — not watching` — two silent early
  returns that could each have explained everything and said nothing.

Four assertions pin the logs, and two older ones were rewritten: the
missing-composer check matched the exact single-line `if (!host) return null;`
and broke the moment that gained a body — **a source-shape assertion again**,
the fifth of the day.

---

## 0.9.43 — Extension only (Backend stays 0.9.41)

*A card is never born hidden.*

0.9.42 judged a new card on **position** the moment it mounted. A card that
arrived while the reader was scrolled somewhere else was therefore created
already invisible — and it could not recover until a scroll-and-settle cycle,
because `.away` outranks the `.show` class added two frames later.

**An invisible card is indistinguishable from a dead extension.** That is the
single most expensive failure shape in this project — six instances of it are
catalogued in the pattern file — and 0.9.42 quietly added a seventh.

Motion hides the card. **Arrival never does.** The first scroll still hides it
immediately, and the settle that follows still puts it away if its turn is off
screen, so nothing about the intended behaviour changes: only the one state
where the product looked broken is gone.

The mount assertion is inverted to match: it used to require that a card
mounting off-screen starts hidden. It now requires the opposite, plus the two
follow-ons that prove the rest of the mechanic still works from that state.

---

## 0.9.42 — Extension only (Backend stays 0.9.41)

*Motion hides the card. Position only decides where it comes to rest.*

### Two fixes to the wrong rule

0.9.33 hid the card once the anchored turn left the viewport. 0.9.41 fixed that
rule to cover both directions — and it worked, confirmed in the field.

**It was still the wrong rule.** The request, twice: *"invisible while scrolling
through text"*, then *"invisible as soon as she appears over the text."* Both
times it was built as a **position** test, and 0.9.41's own success is what made
that visible: the card now hides correctly, after you have scrolled a long way.
Which is not what was asked for.

The card sits over the conversation. **Any scroll is someone trying to read what
is behind it.** Position is not the question; motion is.

- Any scroll → hidden immediately, whatever the position.
- 450ms of stillness → judged on position, and returns only if its turn is
  actually on screen.
- Focus in the card or typed text outranks both, in the motion path and the
  resting path.

So reading back through history leaves it hidden, scrolling down to the newest
reply brings it back, and a continuing gesture keeps resetting the delay rather
than flickering.

### Two assertions retired, and the pattern they share

The fixture had to be rebuilt around a **clock**, because the behaviour is now
time-dependent. Twenty behavioural cases drive it: hides with the reply fully on
screen, stays hidden mid-gesture, returns on settle, stays hidden when settling
mid-history, survives focus, unbinds cleanly.

And the worker's **version-equality check is gone.** Added in 0.9.34, it
asserted that both artifacts ship the same number — true that day, never the
requirement. `BUILD`'s own comment says it is *"deliberately independent"*,
because a worker fix must not force a store resubmission **and a `content.js`
fix must not force a deploy.** It blocked precisely that second case the first
time it arose. Replaced with what actually matters: both versions well-formed,
independently.

**That is the fourth assertion retired today for encoding a belief rather than a
requirement** — after 0.9.37's tail check and 0.9.41's single-direction rect.
The tests are the most reliable thing in this repo and they have been wrong four
times in one day, always in the same way: written from the implementation
instead of the ask.

### No deploy

`content.js` only. The backend stays on 0.9.41 and does not need redeploying —
which is the case the retired assertion would have refused.

---

## 0.9.41 — Extension (Backend: version bump only)

*Scroll-away has been inert since 0.9.33. Owner-reported, and the tests were
green the whole time.*

### The half that never happens

```js
wrap.classList.toggle('away', r.bottom < 0);      // 0.9.33
```

That hides the card when the anchored reply has scrolled off the **top**. The
anchor is the **newest** reply — the last thing in the conversation — so there
is nothing below it to scroll down into and `bottom < 0` is a state real use
hardly reaches. Reading back through history pushes it off the **bottom**, where
`bottom` is a large positive number.

**The direction that was implemented is the direction that almost never
happens.** The feature did nothing for eight releases.

```js
const vh = innerHeight || (document.documentElement || {}).clientHeight || 0;
wrap.classList.toggle('away', r.bottom < 0 || r.top > vh);   // 0.9.41
```

A reply taller than the viewport still counts as on-screen while you read
through it, and focus or typed text still outranks position — in the new
direction as well as the old.

### Why thirteen behavioural tests missed it

0.9.33 extracted the function and *ran* it, which was the right instinct and
caught two real defects at the time. But the fake rect it drove had **no `top`
and no viewport** — only `bottom`, poked to `-10` and `500`.

**It modelled the implementation instead of the requirement.** A test built from
the code can only ever confirm the code. The fixture now places a 400px reply in
an 800px viewport and moves it: above, below, straddling, and in view.

Putting the single-direction condition back now fails **two** assertions — the
source check and the behavioural one — where before it passed both.

That is the third time today a test encoded a belief rather than a requirement
(see 0.9.37's retired tail check). The pattern is worth more than any of the
three fixes.

### Backend

Unchanged apart from `BUILD`. Bumped and redeployed only so `/v1/health` and
`manifest.json` report the same number — after `v0.9.36` ended up tagged on the
wrong commit, matching version numbers are worth more than a saved deploy.

---

## 0.9.40 — Extension and Backend

*When the reply names the candidates, those names are the options.*

### The specimen

Claude's reply asked: *"Is this for **CONTEXA**, **ŠRAF**, something else, or a
new project?"*

The question shipped as:

> **What is this documentation for?**
> 1. A specific product/feature I have in mind
> 2. A new project I'm starting

**The names were right there and got paraphrased into buckets.** Clicking option
one conveys nothing — it is the purest possible category — so the subject stayed
unknown, so the composer had nothing to build on and emitted *"Ask me everything
you need to know to get this right."* **The interview asking for the clarifying
round it exists to replace.**

A second specimen in the same session is the same failure one step earlier: the
reply named the candidates, the interview didn't ask at all, and the composer
bolted the question on as a bullet aimed at the user.

### Why the existing rule wasn't enough

`QUESTIONS_SYSTEM` already said *"a concrete answer rather than a category"* and
a test already asserted the rule was present. **The rule was being ignored**, and
the reason is now familiar: three of its four exemplars demonstrate **invented
buckets** and only one lifts named things out of the reply.

**Third instance today of the same defect** — the prompt requires one thing and
demonstrates another. Evidence, the JSON wrapper, and now this.

Added: the rule, with a test the model can apply to its own output — *after the
user clicks, does anyone reading the answer know WHICH thing they meant?
"Ledger" passes; "An existing product" tells the next reader nothing* — and a
worked exemplar that shows the named version **and the bucket version being
refused beside it**.

**What is deliberately not changed:** the bucket options in the other exemplars.
A speech's occasion is named nowhere in the reply, so inventing the ground there
is correct. The rule is conditional, and what was missing was a demonstration of
the conditional case — not a correction of the unconditional ones.

### Why this one costs more than the other option defects

Every other question in an interview is a **modifier** — length, tone, audience,
format. A modifier on an unknown subject is worth nothing. Get the subject wrong
and the rest of the questionnaire cannot recover, however good it is.

---

## 0.9.39 — Extension and Backend

*The composer answers in text. There is no parse step, so there is no parse
failure.*

### Why this was never a prompt problem

The composer returns **one string**. It was wrapped in JSON for sixteen
releases, and the wrapper was the only part of that path that ever failed —
three separate sessions of `bad_json` where the model wrote a **perfectly good
prompt** and simply handed it over unescaped:

```
parse failure {stop:'end_turn', out:99, in:3278, ceiling:1200, len:288}
text= I want a line edit on my web/landing page copy — tighten sentences and
      improve flow. … Here it is: <paste the copy> …
```

`end_turn`, no truncation, correct content, slot and all. Rendered to the user
as *"Couldn't write suggestions for this reply."*

Two fixes were aimed at it. 0.9.35 moved the exemplars; 0.9.37 added a filled
JSON example. Both improved the odds and neither removed the cause, because the
cause was a required wrapper that the response never needed. The questionnaire
returns an array of objects and genuinely needs JSON. This returns a sentence.

### The exemplars change sides

Nine worked exemplars show `PROMPT: <plain text>`. Under the old contract those
were **nine demonstrations of the wrong shape** — which is exactly why one JSON
example could not outvote them, and why 0.9.38's five-exemplar fix worked next
door while this one kept slipping.

Under the new contract they are nine demonstrations of exactly the right shape.
**The vote is not won; it stops existing.** The prompt now ends: *reply with the
prompt text and NOTHING else — no JSON, no wrapper, no quotes, no code fence, no
preamble, no sign-off*, and points at the `PROMPT:` lines as whole answers.
The `\n`-escaping rule is gone; real line breaks need no escaping.

### `readDraft`, and what it deliberately does not do

Both copies gain the same three lines: strip a code fence if one is there,
unwrap `{"prompt":"…"}` if the model still wraps out of habit, otherwise the
text **is** the draft.

The shims are for habit, not for failure — and one case matters: **a prompt is
allowed to begin with a brace.** `{count} is the placeholder…` parses as
nothing and must survive untouched. There is a test for exactly that.

**Truncation is still refused.** `stop_reason: max_tokens` returns `truncated`
with its diag, because half a prompt sitting in someone's message box is worse
than an error they can retry. This is not the salvage that was rejected earlier
today: that would have hidden a broken contract. This removes a contract that
bought nothing.

**No client boundary is crossed.** The worker and `background.js` both parse
Anthropic's reply and hand `{prompt}` onward exactly as before.

### The suite had never seen the failing shape

Every previous expand test fed the stub JSON — which is precisely why three
sessions of real failures passed through a green suite. Twelve behavioural
cases now drive `readDraft` and the handler directly, hosted and own-key,
including a model answering in prose, a model still wrapping, a fenced answer,
a brace-leading prompt, a truncated draft, and an empty one.

---

## 0.9.38 — Extension and Backend

*Finishes what 0.9.35 started. Adding one demonstration was not the same as
removing five counter-demonstrations.*

### Five votes against, one for

0.9.35 added a single filled JSON answer showing `evidence`, and the failure
went from every-call to occasional. **It stayed all-or-nothing** — `3 of 3`,
`2 of 2`, never partial, which is what a model committing to a schema looks
like rather than a model being sloppy.

The reason was still sitting in the prompt. Five worked exemplars described a
question as `label`, `question`, `options` **and nothing else**. One filled
answer showed the fourth field. **Five demonstrations of the field's absence
against one of its presence** — the invariant from 0.9.37 violated five to one
inside the prompt that invariant was written for.

Every exemplar now carries `evidence` on every question. The strings were
already there, unlabelled: each exemplar quotes the reply fragment in its own
narrative, so the field only had to be attached to it.

Two things fell out of doing it properly:

- The three-question exemplar takes **three different slices of one sentence** —
  *"two or three quick things"*, *"I can get to a real draft"*, *"rather than a
  generic one"*. Evidence is a slice, not the reply, and two questions must not
  share a quote.
- The zero-questions exemplar keeps no evidence, and now **says why**: it is the
  only case with none, because it has no question to earn one. Left silent, it
  read as a sixth vote for the field being optional.

One exemplar referenced a quote it never showed — *"named its own hard part"* —
so it got the quote it was already implying.

### The assertion is about the vote, not the mention

`t('every worked exemplar carries one evidence per question')` counts
`question "` against `evidence "` per exemplar. Deleting evidence from a single
exemplar fails it by name. A test for whether the field is *mentioned* would
have passed throughout the entire bug.

**Not changed, deliberately:** the exemplars still say `question` where the
schema says `text`. The 0.9.36 log settled that — `0 with no usable "text"` on
every call observed — and changing two things in one release makes the next
regression unattributable.

---

## 0.9.37 — Extension and Backend

*The composer never showed its own output shape. Same defect as 0.9.35's
`evidence` bug, different prompt, and this one had been mistaken for three
separate bugs.*

### Nine demonstrations of plain text, zero of JSON

`EXPAND_SYSTEM` demonstrated its output nine times as `PROMPT: <plain text>` and
**not once** as `{"prompt":"..."}`. One instruction line asked for JSON against
nine worked examples showing text. The model periodically answered with text:

```
[CONTEXA] parse failure {stop:'end_turn', out:201, in:3255, ceiling:1200, len:658}
text[0,300]= Write my wedding toast draft. Someone else speaks right after me…
```

`end_turn`, not truncation. A **correct, one-verb, well-constrained prompt** —
just handed back naked.

**0.9.35 diagnosed this as a position problem and moved the exemplars.** That
was rearranging nine plain-text demonstrations. It moved the odds and the bug
came back the moment 0.9.36 added 1,336 characters. Three separate sessions of
symptom, one cause, never addressed.

The prompt now ends with a complete filled answer — one line, newlines encoded
as `\n`, nothing outside the braces — preceded by the sentence naming the gap:
*"not one of them shows the wrapper."*

### The invariant both bugs violated

> **Every required part of the output must be DEMONSTRATED at least once, not
> merely required.**

`QUESTIONS_SYSTEM` required `evidence` and never showed it. `EXPAND_SYSTEM`
required a JSON wrapper and never showed it. Same failure, different field,
found four hours apart. One assertion now checks **both** prompts carry a filled
answer, so the next person adding a required field is told where else it has to
appear.

### An assertion that had to be retired

0.9.35's tail check demanded the JSON *instruction* sit last with a single-line
`PROMPT:` before it. That was a workaround for a prompt that never demonstrated
its shape at all — and it **failed when the real fix was applied**, because the
filled example now sits last.

It is replaced by the honest version: **the last thing in the prompt is the
correct output, literally.** The test evaluates the template literal rather than
matching the source, because the exemplar's entire job is to carry `\n` as two
characters instead of a real newline, and a regex cannot tell those apart.

`QUESTIONS_SYSTEM` deliberately keeps its disclaimer after its example: its risk
is the model copying a **count** and killing the zero-questions outcome. The
composer's risk is shape, so its example goes last. Different tails, different
reasons, both written down.

---

## 0.9.36 — Extension and Backend

*A composer rule with a mechanical test, and a diagnostic that stops guessing.*

### One prompt, one verb

Owner's report: *"still makes it complicated."* The specimen —

> **Write** up the artifact-selection extension… · - **spell out** the anchor
> format… · - **spell out** the verb shortcuts… · - **give** the store-listing
> copy…

**Four imperative verbs. 816 characters, over its own 700 soft cap. Three of the
four were never clicked** — all harvested from Claude's reply.

Rule #1 has said *"never add a second ask they did not state"* since 0.9.23, and
the composer routes around it: it does not add another **ask**, it adds another
**deliverable**, and scores that as specificity. A constraint shapes the one
thing being produced — its length, its format, what to leave untouched. A
sub-deliverable is another thing to produce. Only the first makes an answer
better; the second makes it longer.

This also corrects a line drawn too early. 0.9.34's reasoning was *facts-only
interviews go wrong, decision interviews are fine* — drawn from two specimens.
**This one contained a decision and bloated anyway.** One good case is not a
rule.

So the force-ordered list gains, at position two:

> ONE ask, ONE imperative verb. Bullets may spell out parts of that thing or
> constraints on it — never a second thing to produce. **The test is mechanical:
> could this bullet be sent on its own as a complete request? Then it is a
> separate job — drop it.**

Plus a worked pair: a correct two-bullet prompt, and the **same answers done
wrong** with two harvested jobs bolted on. A prohibition was already present;
what was missing was a test and an example, which is the 0.9.25 lesson.

The exemplars go **before** the degenerate `marketing` case, so the block still
ends on a single-line `PROMPT:`. 0.9.35 shipped with a bulleted exemplar last
and the model answered in prose instead of JSON. Position is behaviour, and
three assertions now hold that slot.

### One filter, three ways to fail

`withEv` discards a question for a missing `text` **or** a missing `evidence`,
and 0.9.35's new line reported both as *"None carried usable evidence."*

That is not a rounding error, it is a wrong signpost. The worked exemplars in
`QUESTIONS_SYSTEM` say `question` where the schema says `text` — so a model
copying an exemplar lands in **exactly this filter while wearing an evidence
failure's face.** The next person to read that console would have gone straight
at the evidence rule, found it correct, and lost the afternoon.

Both paths now count the three causes apart and name all three every time:

> `parsed but no usable questions — model returned 3, kept 0. Dropped: 3 with no
> usable "text", 0 with no "evidence", 0 with fewer than two options.`

The worker's version rides on the existing `parsed but no usable steps` line, so
`wrangler tail` gets the same breakdown for hosted users. A stale comment there
claiming "the evidence gate ate every one of them" is corrected — it was the
same assumption, written down as fact.

### Tested by running it, not by reading it

Six fixtures drive `refineSteps` directly and assert what it says: questions
with no evidence, questions using the exemplars' `question` key, a
single-option question, and two cases that must produce **no failure line at
all** — a deliberate empty questionnaire, and a batch where one question
survives. That second pair guards the oldest invariant in the product: a
correct silence must never leave a fault in the log, or someone eventually
"fixes" it and the floor comes back.

### What this makes answerable

Whether the `question`/`text` mismatch ever actually bites is now an
observation rather than an argument. If `with no usable "text"` never appears in
the field, the exemplars can keep their wording and the change costs nothing. If
it does appear, the fix is obvious and we will have earned it.

---

## 0.9.35 — Extension and Backend

*Repairs a regression 0.9.34 shipped. The rule was right; its position was the
bug.*

### The composer stopped answering in JSON

0.9.34 added two click-list exemplars to `EXPAND_SYSTEM` by **appending them to
the end** of the examples block. That put a five-line bulleted block of raw
prose immediately before `Reply with ONLY minified JSON`.

The model answered with a five-line bulleted block of raw prose and no JSON
wrapper. `extractJson` failed, and every compose returned `bad_json` — rendered
in the card as *"Couldn't write suggestions for this reply."*

```
[CONTEXA] parse failure {stop:'end_turn', out:288, in:2880, ceiling:1200, len:808}
text[0,300]= Write the English versions of the three Reddit posts now — …
```

`stop_reason` was `end_turn`, not `max_tokens` — nothing truncated. The model
finished normally, produced a **perfectly good prompt**, and simply gave it the
shape of the last thing it had been shown.

The exemplars now sit before the degenerate `marketing` case, restoring the tail
the prompt had for eleven releases: a **single-line** `PROMPT:` followed by the
JSON instruction. Three assertions pin it, and putting the bulleted exemplar
back on the end fails two of them.

**The transferable lesson: in a prompt, position is behaviour.** Adding correct
content in the wrong place is a functional change, and no amount of reading the
rule would have caught it.

### The interview prompt never showed the field it requires

Found by the log added below, within a minute of it shipping — and it is the
**same defect in the other prompt**, which is the part worth remembering.

`QUESTIONS_SYSTEM` has five worked exemplars. Every one demonstrates
`label`, `question`, `options`. **Not one demonstrates `evidence`.** The field
existed only as a rule near the top and a schema line at the bottom — five
demonstrations of a three-field object against two lines of prose insisting
there are four.

`refineSteps` discards any question without evidence. So whenever the model
followed the examples rather than the schema, the entire questionnaire was
thrown away and the user got *"Couldn't write suggestions for this reply."*
That is why **some conversations worked and some didn't**: it was a coin flip,
and it always had been.

```
[CONTEXA] parsed but no usable questions — model returned 3, kept 0, grounded 0.
None carried usable evidence.
```

The schema tail now ends with a **complete, filled, correct answer** — two
questions, both carrying real evidence strings — plus what happens when the
field is missing: the question is discarded before the user sees it, so omitting
it is worse than asking nothing.

**And it is immediately disclaimed.** A filled example in the last position
teaches a *count* as readily as a shape, which would quietly kill the
zero-questions outcome — the oldest invariant in this product. The final line
says the example fixes the shape and never the count, and restates
`{"questions":[]}`. Two assertions pin exactly that.

0.9.33 added a fifth evidence-free exemplar and ~1,470 characters between the
evidence rule and the schema. Whether that tipped a marginal behaviour is not
provable from one afternoon — but it moved the odds the wrong way, and the
underlying weakness was there from the start.

### The own-key path now says why it gave up

`[CONTEXA] evidence []` was logged both when the model deliberately returned
nothing — a quiet row, correct — and when the gate ate everything — an error
card. **Identical output, opposite meanings**, and no way to tell them apart
from the console. The worker has logged the distinction since 0.9.29; the
extension never did, and the gap cost a diagnosis round trip.

`[CONTEXA] parsed but no usable questions — model returned N, kept 0, grounded
M` now names which filter emptied the list: no usable evidence, or the option
guard.

---

## 0.9.34 — Extension and Backend

*Two honesty fixes, found the same way: by following one real symptom back to
the line that produced it.*

### An interview payload is not a rough ask

Found by reading two real interviews side by side.

A finished interview sends the user's clicked answers to the composer as
`Tegobe: Da\nProbiotik: Da\nImunitet: Ne`, labelled **`ROUGH ASK:`** — the same
label a typed rough ask gets. But a list of facts has **no verb in it.** The
composer's whole job is "rewrite this ask", so handed something with no ask, it
manufactured one — and the only supply of ready-made asks nearby was Claude's
reply. It produced a prompt asking Claude to re-explain what Claude had just
said, and an answer that restated the one above it.

The tell was the composer's own words: *"kao što si pomenuo"* — "as you
mentioned". **It knew it was asking for a repeat and said so.** 36% of that
prompt was invented, and the invented half generated a section whose conclusion
was that the question didn't matter.

The second specimen is why this fix is narrow. Its answers contained a
**decision** — *"Which piece do you want built first?"* — so the identical
reply-mining behaviour produced legitimate specification instead of a re-run.
Length was never the defect. **Length is only a defect when the answer
restates.**

So `EXPAND_SYSTEM` now distinguishes the two input shapes. A decision among the
clicked answers **is** the ask, and the rest are constraints on it. If every
answer is only a fact, there is no ask in the list — and the missing ask is the
user's own last message, re-asked with the facts folded in. The reply is for
naming things accurately, never a source of follow-up questions.

Two exemplars carry it, because 0.9.25 established that rules alone get ignored:
one facts-only case that collapses to a short re-ask, and one decision case that
still expands into constraints — the contrast is the point. **The specimen that
produced this rule was a medical result and is deliberately not the exemplar:
this prompt ships on every call and lives in a public repo.**

### A dead service stops blaming the user's network

### What a hosted user saw when the key ran dry

Anthropic returns 400 → the worker sent `upstream_400` → every client back to
0.9.27 renders `upstream_*` as **"Couldn't reach the CONTEXA service. Check your
connection and try again in a moment."**

Both halves of that sentence are false. The connection is fine, and "in a
moment" will never arrive — the balance does not refill because someone waited.
This is the project's most expensive recurring shape: **a total outage wearing
the mask of a transient blip.** Third time it has appeared, first time it was
pointed at strangers rather than at us.

### The fix, and why it needs no store review

A revoked key and an empty balance are both *nothing the user can fix* — which
is exactly what the existing `server_not_configured` code already says, in every
client ever shipped: *"The CONTEXA service isn't set up correctly right now.
Nothing you can fix — try again later."*

So the worker now returns that code for an upstream 401, or an upstream 400
whose body names a billing problem. **No new wire code, no client change, no
coupling across the store-review clock** — one `wrangler deploy` repairs the
sentence for the entire installed base.

The upstream body is still never forwarded; it is read to pick a code and
nothing more. Account details stay in `wrangler tail`, where they were.

The narrowing is deliberate. An ordinary 400 stays `upstream_400`, and a 429
stays `upstream_429` — rate limiting **is** transient, so "try again in a
moment" is true there. Calling every failure a misconfiguration would send the
next debugger to the wrong file.

### Why both artifacts move together this time

The credit fix alone would have been worker-only — a free deploy, no store
review. The composer fix is not: `EXPAND_SYSTEM` is byte-identical across the
worker and the extension by build guard, and the own-key path reads the
extension's copy. A prompt change there cannot be worker-only without splitting
hosted and own-key behaviour silently, which is the exact failure the identity
guard exists to prevent.

So 0.9.34 ships as one number on both sides. **0.9.33 was tagged but never
submitted; 0.9.34 supersedes it before it ever reached the store.**

---

## Extension 0.9.33 — Backend 0.9.33

*One rule about what may be asked, and three changes to how the card behaves
when it is not being used.*

### The interview is click-only

**A question the user cannot answer by clicking is no longer asked.** Not
softened, not given a better text box — dropped, and the clickable questions
around it are kept. If none survive, the row goes quiet, which the product
already does correctly.

The audience is people who know roughly what they want but not how to say it.
An empty text field asks them to do the exact thing they came here unable to do,
so a question that *needs* typing is the product failing while appearing to
work. `Something else…` stays as an escape hatch; its necessity, not its
presence, was the defect.

Material the user must supply — a file, code, a spreadsheet, a link — was never
a question in the first place. It belongs in the composed prompt as
`<paste here>` / `<attach here>`, filled in the message box afterwards.

Enforced twice, because the 0.9.25 lesson is that a rule alone gets ignored:

- **Prompt** — a rule plus a worked exemplar of a question *being refused*
  (`QUESTIONS_SYSTEM`, byte-identical in both copies).
- **Code** — any question left with fewer than two valid options is dropped
  before the four-question slice, in both the worker and the own-key path, and
  logged as `[CONTEXA] dropped unclickable question(s)`.

Order matters: **map, drop, then slice.** Slicing first would spend the budget
on questions that are about to be thrown away.

### The card gets out of the way while you read

0.9.30 moved the card above the composer, where it held ~150px of reading space
permanently. It now collapses when the reply it belongs to scrolls off the top,
and comes back when you scroll back down.

It hides on the **anchor leaving the viewport**, not on scroll itself — hiding
during scroll would also hide the card while you are scrolling *toward* it. It
never hides anyone mid-answer: focus inside the card, or any typed text, pins it
open. The listener is passive and rAF-throttled, and unbinds itself when the
card goes.

### Two dismissals in a row earn a way out

Dismissing twice with nothing in between adds a muted `Hide for this session`
chip. Any real use — answering, a rough ask, composing — resets the streak, so
the offer only appears to someone who is actually being interrupted.

Scope is the tab and the state is in memory, never stored: a reload always
restores it. **There is no farewell message and no "reload to restore" hint.** A
goodbye note explaining how to bring it back contradicts the act of hiding. One
console line is kept for diagnosis.

### Touch

Confirmed working on Android in Edge, Lemur, Mises and Quetta, where the desktop
row heights were under the 44px minimum and the `‹ 1 of 3 › ×` glyphs were far
under. Option rows are now 46px, nav buttons 40×40, inputs 16px so mobile Safari
does not zoom the page, and the selection arrow is always visible where there is
no hover.

### Title

`CONTEXA - Claude prompts, without the writing`.

The old title said "Prompt like a PRO", which reads as a paid tier on a free
product, frames the user as deficient, and — worst — omitted **Claude**, the
most obvious thing anyone would search the store for.

---

## Extension 0.9.32 — Backend unchanged (0.9.31)

*One selector. Found by DOM position after three string-based detectors got it wrong.*

### Visually hidden text is no longer captured

`SKIP_TAGS` is tag-based, so it cannot catch text that is hidden by CSS but
present in the DOM. claude.ai renders the thinking header twice: once inside
`button[data-testid=tool-status-pill]`, correctly skipped, and once in a
`span.sr-only` outside it — which shipped on every reply carrying a thinking
block, for the whole life of the product.

Both capture walkers now also skip `.sr-only`, `[data-testid^="tool-status"]`
and `[class*="artifact-block"]`.

**The cost was never the tokens.** It is that hidden text is **quotable**: a chip
grounded in *"Thought for 8s"* passes the evidence gate cleanly and means
nothing. That is a new route to precisely the failure the gate exists to prevent.

### How it was found, and how it was nearly missed

Three string-matching detectors in one evening reported chrome that was not
there. Each time the hits turned out to be **prose about chrome** — Claude
writing `Ran 2 commands` in backticks while explaining the bug, or citing
`§4` while discussing §4. Text about a thing is indistinguishable from the
thing when you match on text.

Probe v3 escaped it by finding the **deepest DOM element** holding each string
and printing its ancestor chain. The difference between `span.sr-only` and
`em` inside `p.font-claude-response-body` is invisible to a regex and obvious
in a chain.

A test pins both directions: hidden duplicates are dropped, and an `em` quoting
a chrome string in the reply body still survives.

### Scope

An earlier reading claimed chrome leaked on both surfaces and that Cowork was
grounding chips in project documents. **Both were wrong**, and the controls that
disproved them are recorded in the pattern file. What remained after the
controls was one selector.

`Searched the web` appeared once in a v2 capture and produced no holders in v3.
**Unexplained, and deliberately not fixed on one observation.**

---

## Extension 0.9.31 — Backend 0.9.31

*The worker learns to speak to both generations of client at once.*

### The problem 0.9.30 created

0.9.30 renamed the wire field from `steps` to `questions` and changed what a row
IS — a composer-ready message became a questionnaire. That breaks in **both**
directions across a boundary the server cannot upgrade:

- an old extension asks a 0.9.30 worker for `steps` and gets none
- a 0.9.30 extension asks an older worker for `questions` and gets none

Both render *"Couldn't write suggestions for this reply."* — an error message
that describes neither cause. And because Google approves on its own clock,
**no deploy order avoids a window of breakage**: hold the worker back and newly
approved clients break; deploy it early and existing installs break.

### The fix

The extension sends its version with every hosted request. A client that sends
none predates the field, so its silence identifies it — old clients never
change, which makes absence a reliable signal rather than a guess.

The worker keeps **both prompts live** and picks by client: pre-0.9.30 gets the
0.9.29 trajectory prompt, one chip, the `steps` key, no `options`; 0.9.30+ gets
the questionnaire, up to four questions, the `questions` key, with options.

Deploy order stops mattering. Submit whenever, deploy whenever.

### One bug caught by its own test

The parser read `parsed.questions` only — but the legacy prompt emits
`{"steps":[...]}`. Every legacy call would have produced an empty array, which
this code reads as *the model earned nothing* and turns into a **quiet row**: a
total outage wearing the mask of correct behaviour, on the one path with no
coverage from real use. The parser now accepts whichever key arrived, and a
regression test pins it.

### Guards

`build.mjs` now fails if `LEGACY_STEPS_SYSTEM` goes missing from the worker, if
it is ever copied **into** the extension (the byte-identity rule invites exactly
that mistake, and it would ship the previous product to current users), or if
the extension stops sending its version. Worker tests declare which client
generation each one simulates — a single default is what hid the original break.

### Retirement

This is a transition shim. Once the store has been on 0.9.30+ long enough that
no older install is plausibly still calling, delete `LEGACY_STEPS_SYSTEM`, the
negotiation, and the version field. Written down in the code because a shim with
no removal note is permanent.

---

## Extension 0.9.30 — Backend 0.9.30

*CONTEXA stops writing your next message and starts asking you the questions
that become it.*

### The interview

Modelled directly on Claude's own clarifying-question card, which is what the
owner meant by "ask questions like Claude" — the reference was literal, and the
earlier reading of it (three empty text fields) was wrong.

One question at a time, `1 of 3` pagination, **numbered answer options written
for the user**, a per-question Skip, a free-text "Something else", and a × that
dismisses to the Rough ask chip so closing the card never leaves you with less
than you had. Number keys pick an option. Focus is taken only when you are not
already typing in the composer.

**The options are the product.** Someone who cannot specify the work usually
cannot fill an empty box either — but they can recognise the right answer when
they see it. That is the whole difference between this and a form, and it is
why the prompt spends more words on writing good options than on writing good
questions. An option meaning "other" or "skip" is stripped in both copies: the
interface supplies both, and a duplicate wastes one of only four slots.

### Above the composer, one card for the page

The row no longer sits under each reply. It mounts above the composer and there
is exactly one — a new reply replaces the previous card rather than stacking
under it, and nothing accumulates when you scroll back.

Owner's call, and it has a second payoff: the Code-session scope concluded that
a virtualised transcript forbids injecting into rows and requires exactly this
placement. That adapter's hard half is now solved as a side effect.

### Two calls, and the copy now says so

An interview spends two units from the daily pool — one to write the questions,
one to compose the prompt. No metering code changed, because both endpoints
already charge a unit each. What changed is the honesty: every surface that
said "20 suggestion sets a day" now says **10 prompts a day**, and the quota
card halves the raw limit rather than reporting the counter.

### What survived, and what is gone

`NEXT_STEPS_SYSTEM` is renamed `QUESTIONS_SYSTEM` — a constant called
NEXT_STEPS that generates questions is the kind of lie a future session reads
instead of the body. The wire schema is `{questions:[{label,text,options,evidence}]}`.

**Zero survived a second rewrite.** Nothing was earned, nothing is asked, and
the card falls back to the Rough ask chip. Every padding defect in the pattern
file traces to a floor, and there is still no floor.

**The evidence contract survived, now guarding questions.** A question with
nothing quotable in the reply is an invented question, and it is dropped.

### Field evidence behind this release

Four rows under 0.9.29 on 22 Aug. Zero fired on a reply that asked the user for
specifics — correctly, because answering the reply's own question is the banned
obvious step — and the store build rendered that silence as *"Couldn't write
suggestions for this reply."* That mislabel is what made the store submission
urgent rather than advisable, and it is fixed here.

---

## Extension 0.9.29 — Backend 0.9.29

*The core changes. One chip, or none.*

### What replaced what

CONTEXA was **reactive**: reread the reply for defects — hedges, forks, gaps —
and offer three to five chips, each repairing one. It is now **projective**:
read the user's message for the intent and the reply for the state, infer where
this is going, and return the single message the user would send **two turns
from now** if they could already see the road.

The floor of three is gone. So is the move taxonomy, the ordering rules, and
the capability-move class as a separate thing. `NEXT_STEPS_SYSTEM` went from
9,187 characters to 5,601 — 39% smaller on every request.

### Zero is an answer

The model may now return no step at all, and an empty row renders as the Rough
ask chip alone rather than an error card.

This is the point of the release, not a side effect. Every defect in the
pattern file — user-only facts stated as observed, the chip that said "go",
the row that read Claude's own three options back at the user — was a
**padding** defect: a chip that existed because a floor demanded a third one.
Remove the floor, permit silence, and that entire failure family stops being
possible rather than being mitigated.

**Two silences, deliberately not conflated.** A model that returns
`{"steps":[]}` earned nothing, and that is the product working — 200, quiet
row, no error. A model that produced steps which the evidence gate then
rejected entirely is a defect, and still returns `no_steps` with its
diagnostic. They look identical at the end of the pipe and mean opposite
things.

### The obvious step is now banned outright

The premise is that CONTEXA returns the message the user would *not* have
typed. Answering the reply's direct question, or picking an item from a list it
just offered, is the product failing at its own thesis — the user can already
see those. The 22 Aug field test caught exactly this: a row where three of four
chips were Claude's own "Your pick" menu, transcribed. Scored `{4,4,4}`,
perfectly grounded, and worth nothing.

### The monster breathes

Step texts go from 280 to **700 characters**, and `MAX_PAYLOAD_CHARS` rises
from 600 to 700 to match — otherwise every long step would have been silently
truncated by a cap the prompt didn't know about. Two moves ahead needs room:
the upload *and* the ranked findings *and* the decision the analysis was for.

### Exemplars from real rows, not invented ones

All three worked examples in the new prompt are exchanges captured in the field
on 22 Aug, and each one names the obvious step it is refusing before giving the
one worth clicking. Authored exemplars beat added rules — the 0.9.25 lesson,
applied to a rewrite rather than a patch.

### The capability class, resolved

Field testing found it mostly inert: *Lock in my style* could not fire at all
(a repeated correction is a multi-turn pattern, and CONTEXA sees one message
and one reply), and *Work from real data* was dominated by Supply whenever
Claude asked for the file. Rather than rebuild or pull it, the new core absorbs
it: a capability is routed **as part of the plan** when the road ahead runs
through it, never as a tip. The staleness guard stays — capability knowledge
moved into the routing sentence, it did not leave.

### Not prompt-only

Unlike 0.9.24, 0.9.25 and 0.9.28, this release changes `content.js`: a
successful response carrying an empty steps array used to fall into the error
branch and render *"Couldn't write suggestions for this reply."* Silence has to
be reachable. **Store clients below 0.9.29 will show that mislabeled card on
quiet rows until the submission lands.**

---

## Extension 0.9.28 — Backend 0.9.28

*Capability moves: the first chips that teach a feature instead of a next step.*

Prompt-only. Both copies of `NEXT_STEPS_SYSTEM` change together and the change
reaches every hosted user through one `wrangler deploy`, with no store review.
Own-key users get it when the store copy lands.

### Added: three capability moves

Most people use a fraction of Claude — no Projects, no saved styles, no
uploaded files — and nobody teaches them, because the moment the tip would
help is mid-conversation. That is exactly where CONTEXA already is.

- **Set up a project.** Fires when the reply re-explains or re-requests context
  the conversation already carried.
- **Lock in my style.** Fires when the reply acknowledges a repeated correction
  to tone, length or format.
- **Work from real data.** Fires when the reply reasons from a *description* of
  a file rather than the file.

Two further moves were drafted and deliberately left out. *Make it an artifact*
and *Check it live* fire when **Claude** behaves badly — re-pasting a whole
document instead of making an artifact, hedging about currency instead of
searching — and Anthropic is actively eliminating both defaults, so those chips
fire less with every model release. The three that shipped fire when the **user**
has not set something up, and no model update creates a saved style in someone's
account. The gap is on the user's side of the wire, so it stays.

### How they are constrained

The moves live in their own paragraph, subordinate to the "moves that usually
win" list rather than inside it. Appending three more bullets to a six-bullet
list of freely-pickable examples would have let a set of three come back with
two capability moves in it, breaking the one-per-set cap before it shipped. The
framing sentence is what teaches; that is the 0.9.24 lesson.

They obey the existing contract with no exceptions: quotable evidence or no
chip, text addressed to Claude, never instructions aimed at the user. No
click-paths, no menu names, no settings — the prompt cannot see the UI and
would go stale the moment it changed.

Where the prepared material *goes* is asked of Claude rather than stated by us.
A beginner handed 150 words of project instructions and no destination is stuck,
and our own rules forbid us from supplying the path. A stale sentence from
Claude is one conversation's error that gets fixed for free; a stale click-path
in our exemplar ships to every user until we redeploy.

### Added: a staleness instrument, because nothing else would report it

Capability knowledge lives in our exemplars, not in the model's training. If
Claude renames a feature, no test fails and no counter moves — the chips just
quietly start lying.

`build.mjs` now reads a dated `CAPABILITY-AUDIT` marker from both prompt files.
Missing or drifted between the two copies is a **build failure**. Merely old —
past 120 days — prints a **warning and builds anyway**, because a stale
capability list must never block an urgent fix.

### Note on what this release does not contain

No click telemetry, here or anywhere. Clicks happen in the browser and are never
transmitted; "no tracking, no analytics" is a promise on the listing and it
still holds. Whether these chips are useful will be answered by people saying
so, not by a number.

---

## Extension 0.9.27 — Backend unchanged (0.9.25)

*Copy and consistency pass on the beginner release.*

### Changed: one save rule for the whole settings page

0.9.26 shipped two rules — the on/off switch saved itself, the Advanced text
fields waited for a Save button — and within an hour the person who wrote the
requirements typed a value into a field, walked away, and assumed it had
applied. If the author falls for it, every beginner will.

Advanced fields now save when you leave them, and Enter commits too. The Save
button is gone, because leaving one beside self-saving fields recreates the
same ambiguity in reverse. The page states the rule in one line.

The reasoning behind auto-saving a field that could hold a half-pasted API key:
a silent no-op is the worst failure available here, because nothing on screen
contradicts the user's belief. A wrong value that *does* save is visible and
recoverable — the mode box moves, Test reports it. Invisible beats visible only
when the invisible thing is correct.

### Changed: three beginner-facing sentences that overclaimed or misdirected

The network error said "It's usually back within a minute" — a recovery time
never measured, and one that blames the service when the cause may be the
reader's own connection. It now reads "Couldn't reach the CONTEXA service.
Check your connection and try again in a moment."

The lost-connection card told the reader that reloading fixes it and then
offered a Settings button. It now offers Reload.

The quota card pitched an API key on the beginner surface — expert vocabulary
the audience decision had just moved behind Advanced. It now reads "That's all
20 free suggestions for today. They come back in about 3 hours." Anyone who
wants unlimited use still finds the key field where it belongs.

Two new invariants are now tested: no user-facing sentence may contain a raw
error code, and every one must end in a full stop.

---

## Extension 0.9.26 — Backend unchanged (0.9.25)

*The beginner release. Audience decision of 2026-08-21: CONTEXA targets
beginners and intermediate users, not senior developers — "make bad prompts
good" is worth nothing to someone whose prompts are already good.*

### Changed: the settings page now hides everything a beginner doesn't need

The old page opened on an API key field. For the audience this product is for,
that is a wall: it implies setup is required, implies a cost, and implies you
need to know what an API is. None of that is true — the free service needs
nothing at all.

The default view is now a single card reading **CONTEXA is on** with a switch,
four plain steps ending with "click one and the full message is written into
your message box — you can edit it, nothing is ever sent without you pressing
send", and one line saying it's free with no sign-up. That is the whole page.
API key, model, backend URL and Test collapse behind an **Advanced**
disclosure that opens with "You don't need any of this."

The switch saves on flip rather than waiting for Save — a Save button attached
to a toggle is a quiet trap: people flip it, close the tab, and nothing
happened. Version comes from the manifest and the shipped model from
`getConfig`, so neither can drift into a stale second copy.

### Fixed: error cards spoke in codes to people who can't read them

The first outside user this product ever had opened claude.ai and met the
string `forbidden_origin`. He was simply running an unpacked dev copy instead
of the store build — a thirty-second fix — but nothing on screen said so. An
error the reader cannot act on is worse than no error at all.

Every failure now renders one plain sentence with the most useful button for
that cause. `forbidden_origin` reads "This copy of CONTEXA wasn't installed
from the Chrome Web Store, so it can't use the free service. Install the store
version and remove this one." — with a **Get CONTEXA** button going to the
listing rather than to settings. Truncations, network failures, rejected keys
and rate limits each get their own sentence; anything unmapped falls back to
one that is at least honest and actionable. Diagnostics are untouched and still
go to the console, where they were always the useful thing.

### Fixed: the streaming guard failed open

`scan()` read `if (wrap && wrap.getAttribute('data-is-streaming') === 'true')`.
If claude.ai ever moved, renamed, or relocated that attribute, `wrap` would be
null, the guard would silently stop applying, and CONTEXA would fire mid-stream
on a half-written reply — after which the `processed` WeakSet blocked any
correction. The only symptom would have been one weak chip and no error
anywhere, which is precisely the failure mode hardest to notice.

It now fails closed: `'true'` still short-circuits, but without a positive
`'false'` the fast path is refused and the decision waits for the debounced
settle timer, which sets its own signal after 1.2 seconds of quiet. A future
claude.ai redesign now costs a small delay instead of a bad capture.

---

## Extension 0.9.25 — Backend 0.9.25

### Fixed: drafts stated facts only the user could know as though observed

Field defect, three instances across both prompts before it was named. The
model would answer a question only the user could answer — what they did,
when they did it, what happened on their machine — and write it as plain
fact instead of a marked assumption. Instances: "Deployed, succes" became a
flat assertion that all five field checks had passed; a clean release run
produced "confirm which gate it stopped at", presupposing a failure that
never happened; and a chip asserted "The egg-and-chicken test was run before
I called wrangler deploy for 0.9.24" — something CONTEXA cannot see, since
it receives only the last message and reply.

Not blindness but inconsistency: a chip in a neighbouring fire from the same
prompt wrote "Assume it rendered exactly one chip again", applying the
convention correctly.

Both prompts already carried rules requiring the marking and ignored them
three times, so the fix is worked exemplars rather than another instruction —
the platform prompting docs are explicit that positive examples outperform
added rules, and this prompt had already proved immune to the rule.
NEXT_STEPS_SYSTEM gains a decree exemplar showing the right form and the
wrong one side by side, plus the one marking clause its hard rules genuinely
lacked. EXPAND_SYSTEM gains an exemplar built from the real defect: the
"deployed, works" case, rendered correctly with an `Assume:` line the user
can strike. Five new prompt assertions pin all of it.

Harmless in every observed instance because the user ratifies before sending —
but the whole product rests on never asserting what it cannot see.

---

## Extension 0.9.24 — Backend 0.9.24

*Backend deployed and measured in the field on 2026-08-21; the extension half
shipped alongside 0.9.25 rather than reaching the store on its own.*

### Changed: the prompt was teaching scarcity, so rows arrived nearly empty

Single-chip rows read as broken. The cause was not the evidence rule but
three sentences written in 0.9.16 when the enemy was padding to five: "the
most common correct count is one or two", "deserves ONE dominant step", and
"returning a single step is a correct answer". The model was not failing to
find material; it was being told that finding little was success.

Replaced with a floor of three framed as a search obligation — "before
settling for fewer, reread it for what it assumed without saying so, what it
left open, what it finished that could be pressure-tested, and what it never
considered" — plus the anti-padding line "a restatement in slot three is
worse than no slot three". The where-to-look clause carries most of the
weight. A regression test now fails if any scarcity prior returns.

### Added: "Recast the problem", the first generative move

The five existing moves are all reactive. The sixth is anchored to a quote of
the goal, artifact or constraint rather than a defect, then free to propose
what the conversation has not tried: solve it cheaper, borrow a pattern from
another domain, invert the constraint, or ask what would make the task
unnecessary. It holds the only licence in the prompt to name something the
reply never mentioned, capped at one per set, and must aim at the work.

First field measurement: `{total: 4, kept: 4, grounded: 4}` — nothing dropped
by the evidence gate, no fabricated quotes, floor held on a short
conversational reply.

---

## Extension 0.9.23 — Backend 0.9.23

### Added: the fifth chip — type a rough ask, CONTEXA writes the prompt

Motto made mechanism: **make bad prompts good.** A dashed "✎ Rough ask…" chip
now sits at the end of every suggestion row. Click it, type a rough intent
("optimize seo & meta", "make it shorter"), press Enter — the drafted prompt
loads into the composer, ready to edit and send. Never auto-sends.

The draft is produced by a second system prompt, `EXPAND_SYSTEM`, built from
the platform docs' catalog of transformations that measurably change output:
imperative first line, explicit scope, positive-form anti-goals, constraints
only when implied, banned filler adjectives. It fixes FORM, never invents
CONTENT — missing decisions surface as `<slots>` (max 2) and `Assume:` lines
(max 2) the user edits before sending. Already-good input comes back nearly
verbatim; a hopeless one-worder degrades into the shipped elicit move. The
expansion sees the typed ask plus the same capture the suggestions saw, so
"make it shorter" means *this* reply — and a topic-switch ask ignores the
reply entirely.

Wiring: new `POST /v1/expand` on the worker sharing every existing gate —
origin pin, device token, IP cap, and the SAME 20/day pool (a rough ask
spends exactly what a suggestion row spends); `expandPrompt` message type in
the background with own-key and hosted paths, the same thinking-disable +
model-agnostic 400-retry, ceiling 1200, clean-boundary hard cap at 900 chars
(soft target 700 in the prompt). build.mjs now enforces byte-identity for
BOTH prompts and pins the shared section labels. Failures render inline on
the chip ("daily limit reached" / "couldn't write it — retry") — never a
second card; detail goes to the console. Keystrokes in the chip's input are
stopped at the shadow boundary so claude.ai's document-level listeners never
see them.

### Fixed: clicking a chip could type over a draft already in the composer

Design-review item #4, verified real: `insertPrompt` selected all and typed
over whatever the composer held — the one path where CONTEXA could destroy
the user's own words, and the fifth chip would have doubled how often it ran.
Now a non-empty draft is never replaced: the drafted prompt is appended below
it, and the user deletes what they don't want. Nothing is ever lost. Pinned
by source-assertion tests.

---

## Extension 0.9.22 — store copy release (no code changes)

### Changed: store-facing copy moved off the affiliation trigger

The Chrome Web Store "Summary from package" is the manifest `description` —
not editable in the dashboard — so the rename shipped as a version: name
**"CONTEXA - Prompt like a PRO"** (the old name's "for Claude" phrasing read
as an affiliation claim), summary "Reads the reply and hands you your next
prompt, tailored in AI language, ready to send. No API key, no account, no
setup." (121/132 chars). Extension behavior unchanged; backend stayed 0.9.21.

---

## Extension 0.9.21 — Backend 0.9.21

### Fixed: thinking-mandatory models rejected the thinking disable with a 400

0.9.20 disabled thinking explicitly — correct for the pinned Sonnet 5, but
Fable 5 and Mythos 5 REJECT `thinking: {type: "disabled"}` (thinking cannot
be turned off there), so an own-key user with such a model override got a
hard `api_400` on every fire. Model-agnostic fix on both paths: attempt with
the disable; if the API's 400 names the thinking config, retry once without
the field and let that model's default stand. No model list to maintain.

### Fixed: the API's error text was captured and shown nowhere — again

The card said `api_400`; the API's actual explanation sat in a `detail` field
that nothing rendered, costing a debugging cycle — the same class of gap as
the 0.9.13 diag bug. Now: the card renders `detail` in the grey line, the
background logs every non-ok API body at capture time, and the worker
tail-logs upstream error bodies (tail-only; they can contain account details
and still never reach clients). Every error path logs its full evidence at
the moment of capture — now a standing rule with tests.

---

## Extension 0.9.20 — Backend 0.9.20

### Fixed: Sonnet 5's adaptive-thinking default could spend the whole budget thinking

Upstream behavior change, caught by the diagnostic pipeline on its first
occurrence: Sonnet 5 runs ADAPTIVE thinking for requests without a `thinking`
field (4.6 and earlier ran without thinking). On the 0.9.19 prompt — the
richest yet — the model chose to think and consumed all 2,500 output tokens
as a thinking block, emitting zero text. The error card named the cause in
one grey sentence: "output was thinking, not text; 2500 output tokens — at
the 2500 ceiling." Three versions of instrumentation paid for themselves in
one line.

Both call sites now send `thinking: { type: "disabled" }` explicitly — for a
fast structured-JSON generator under a hard cap, thinking is pure cost.
Pinned by wire-level tests on both paths. Note for own-key users overriding
the model in settings: `disabled` is the no-op state on older models.

---

## Extension 0.9.19 — Backend 0.9.19

### Changed: the elicitation release — CONTEXA learns to flip the question burden

Owner's decisions after holding the product against Lovable's prompting
playbook (the original inspiration, returned nineteen versions later):

- **Question ban lifted, half-way and on purpose**: a chip may be
  question-form when aimed at Claude and the question is the sharpest form
  of the ask. Questions aimed at the user stay banned forever — that half of
  the old rule was always the correct half, and the action-ownership voice
  line (earned by field pattern n=3) now guards it explicitly in Hard rules.
- **New move: Invite Claude's questions** — for young or underspecified work
  where the forks are invisible, the chip flips the question burden: "Ask me
  everything you need to know to get this right — one focused list, then
  wait." Division of labor: visible fork → decree; invisible forks → elicit.
  Rationed at one per set.
- **Foundation-first rule**: when the exchange reads like a task's opening
  resting on guessed scope, the set pins what/who/why/key-action before
  continuation. Shape-triggered, prompt-only, no wire.
- **Docs**: the requisition identity lands in both READMEs and the store
  listing (store copy kept brand-safe per the listing's own doctrine), plus
  the method sentence: the playbook good prompt engineers use, applied for
  you, one message at a time.
- Model adaptation was designed, built as a kit, and killed by its own
  designer's argument: the reply already encodes the model, so the evidence
  rule adapts transitively; the metadata channel is lie-prone and
  invisible-by-design. Kit preserved for reopening only on field evidence of
  tier-specific failure. Pattern library deferred pending click data.

---

## Extension 0.9.18 — backend stays 0.9.17

### Fixed: an extension reload mid-generation rendered raw plumbing text

Field event, seconds old: a request was in flight when the extension was
reloaded (the user was running the deploy-and-reload sequence). Chrome reports
that as "the message channel closed before a response was received" — and the
stale-context classifier only knew "message PORT closed", so instead of the
friendly "CONTEXA was updated — reload this page" notice, the card showed the
raw error verbatim. One vocabulary miss; the same event in a tab checked
after the reload rendered correctly.

The classifier now covers port/channel/is-closed variants and is pinned by a
test against Chrome's exact emitted strings, including the full
listener-indicated-asynchronous-response phrasing. No behavior change on any
other path; extension-only, worker untouched.

---

## Extension 0.9.17 — Backend 0.9.17

### Built to SPEC-v0.9.17.md — evidence-grounded requisitions

The corrected requisition design, per the commissioned spec (see that document
for full rationale and the verbatim prompt):

- **Evidence rule**: every step must quote the reply fragment that earned it
  (`evidence` field, ≤90 chars, verbatim). Steps without evidence are dropped;
  near-miss quotes render but are counted and logged. Evidence never reaches
  the composer — the worker and the own-key background both validate, strip,
  and return `{label, text}` plus aggregate `grounding` counts, which the page
  console logs for the field check.
- **Principle over taxonomy**: the four moves (supply / collapse-a-fork /
  grant-commitment / redirect) are worked examples tied to the evidence that
  earns them, not categories; the prompt states a one-of-each set is almost
  certainly padded. Redirects capped at one; decrees at two; heavy paste-work
  steps at one per set.
- **Friction-aware ordering**: supply steps first only on visible starvation,
  otherwise slot 1 goes to the highest-leverage step sendable within seconds;
  heavy steps sink to last.
- **Viewport marker (§3.2)**: captures longer than 6,000 chars are trimmed at
  a clean boundary and end with "[capture window ends here — the reply
  continues beyond this point]", sized so the worker's own 6,000-char slice
  cannot eat the marker (trim then append — the joint has a dedicated test).
  The prompt forbids mentioning the marker or requisitioning the continuation.
  Fixes the observed phantom-truncation chips on long replies.
- **Logging levels (§4)**: partial salvage downgraded warn→log so Chrome's
  extension-page Errors badge stays quiet; true failure diagnostics remain
  warn. Evidence and grounding logs at log level.

Tests: +9 extension (prompt shape, marker mechanics incl. the server-slice
joint test, evidence drop/strip/count, all-dropped→no_steps, log-level
asserts), +3 worker (hosted evidence pipeline). 47 extension / 27 worker checks, all green. Field acceptance criteria are §7 of the spec and run post-deploy.

---

## Extension 0.9.16 — Backend 0.9.16

### Changed: the requisition-form design (owner-delegated to Claude)

Owner's brief, verbatim intent: "think about what would make your job easier
and define the next prompts — whatever YOU think would be the RIGHT fit for
YOU. The point is to multiply your power by having more sides to think of
outside the box."

The steps are now the messages the assistant itself would most benefit from
receiving — its own requests, rendered as ready-to-send user messages. Four
families as a palette, never a quota:

- **FEED** — supply the artifact the reply had to infer around (code, error,
  config, observed output), named and format-pinned, with `<paste here>`.
  When the reply is starved, this comes first and outranks everything.
- **DECREE** — resolve a hedged fork by decree: "Assume X. Redo under exactly
  that." The user edits the assumption before sending. Max two per set.
- **UNLEASH** — grant commitment permission: pick the option you'd choose and
  produce the complete version, nothing left as an option.
- **FLIP** — redirect the angle: opposite assumption, argue-against-and-keep-
  what-survives, different optimization target. Aimed at the work, never at
  quizzing the user.

Count is 1–5 decided by the reply's need — a starved reply gets one dominant
chip, not fillers. Labels ≤4 words (client clamp follows). Retained from
prior designs: no questions ever, exemplar payload shape ("name the thing,
pin scope and format"), 280-char cap, grounding, no re-requesting, one move
per step, no code in payloads, never auto-send. Metric remains click-through.

Supersedes 0.9.15's exactly-five/3-word/obvious-only design same-day, by the
owner's explicit delegation. Three hand-authored sample sets against real
session replies were approved before this was built.

---

## Extension 0.9.15 — Backend 0.9.15

### Changed: CONTEXA becomes a guide, not a critic (owner's redesign)

The prompt is rewritten around a new core, the owner's chosen exemplar:
"The current prompts — system prompt, any instruction files, tool/function
definitions. The actual text, not a summary." Name the thing, pin scope and
format, no question mark.

- **Always exactly five steps** (variable 3–5 retired).
- **Labels: max 3 words** (was 6); client clamp in `shortLabel` follows.
- **No questions, ever** — not to the user, not to Claude. Directives and
  specifications only.
- **Obvious next steps by design**: continue the thread, produce the next
  artifact, implement what the reply describes, supply missing input (with a
  <placeholder>), extend to the adjacent piece. If the reply is blocked on
  missing input, step one supplies exactly that.
- Retired deliberately: the slot-1 plan-changer rule, the ban on obvious
  steps, challenge/verification/reframing moves. This supersedes the round-3
  A/B tuning (novelty 73%, slot-1 3/3) by explicit product decision — the
  loveable.dev pattern this product was inspired by is obvious-next-steps
  done well. The old measurements remain in docs/archive/test-runs/prompt-ab-results.md
  for the record; the new success metric is click-through, not novelty.
- Kept: grounding in the actual reply, no re-requesting delivered content,
  one move per step, the no-code rule for texts, 280-char text cap.

Prompt is byte-identical in both copies (extension own-key path, worker hosted
path) — enforced by the build. Both artifacts ship: worker deploy + extension
reload required together, or the two paths serve different products.

---

## Extension 0.9.14 — backend stays 0.9.12

### Changed: partial salvages render identically to full results

Owner's decision. The "Response was cut short — showing the N that came
through complete" banner is gone. Rationale: salvage keeps the FIRST N complete
steps and the prompt orders steps by leverage, so a partial set is the best
prefix of the intended set; every chip shown is whole; and 3–5 chips is the
spec either way, so the user cannot act on the distinction. Hiding the banner
fakes nothing — it stops narrating engine internals.

The signal is not dropped: every partial now logs `[CONTEXA] partial salvage`
with the diagnostic (when the path provides one) to the page console, because
each partial means the model hit its token ceiling and burned 3–5× the output
cost of a clean response. Ceiling-hit frequency stays measurable during
validation; it just stops being the user's problem.

---

## Extension 0.9.13 — backend stays 0.9.12

### Fixed: the diagnostic was computed, forwarded, delivered — and dropped at the last call

Every truncation card ever shown was bare. Three versions of instrumentation
(0.9.10–0.9.12) built the diag pipeline: the worker computes it, the background
forwards it, `renderQuiet` renders it as the grey cause-sentence. The single
call site joining the last two links read
`renderQuiet(anchor, 'error', reason)` — no `resp`. The renderer's diag logic
reads the fourth argument, which was always `undefined` there. Four missing
characters (`, resp`) silently disabled both the grey sentence and the page
console warning, on every version that had them.

Each *link* had a test — the sentence generator, the worker's diag object, the
background pass-through. The *joint* had none. A source assertion in
`extension/test.mjs` now pins the call site.

Found not by reading the code but by the field: a truncation on a verified
0.9.12 worker + 0.9.12 extension still produced a bare card, which the version
matrix said was impossible.

Also learned in the same investigation, via remote browser inspection of a live
Cowork tab: CONTEXA runs on claude.ai **Cowork sessions** too — same composer,
working streaming attribute, virtualized DOM (~3–5 response blocks), and reply
blocks that include tool-widget labels ("Used Claude in Chrome (6 actions)").
Cowork work-turns are dense multi-part input, and a background tab silently
spends quota on every reply. Scope decision (fire only on visible tabs? skip
/cowork/?) deliberately deferred.

---

## Extension 0.9.12 — Backend 0.9.12

### Fixed: the model was reading degraded input, expensively

Root cause of the code-conversation truncations, found by following the capture
path. The reply was sent as raw `textContent`, which has two defects:

- **Block elements contribute no line break**, so adjacent paragraphs arrived
  glued together ("…each failure.The counter increments…"). Every conversation,
  every version since 0.6 — verified against a real Chromium DOM.
- **Code blocks shipped whole.** On a code-heavy reply, raw code filled most of
  the 6,000-char budget, and it is exactly the material the model then echoed
  into oversized step texts until it hit the token ceiling. Field data: three
  ceiling-hits in one code-heavy conversation, zero elsewhere; a spec-compliant
  response is ~600 tokens against a 2,500 ceiling.

Capture now walks the DOM: real line breaks at block boundaries, UI chrome
(copy buttons) skipped, and each code block collapsed to its first two lines
plus a `[+N more lines of code]` marker — signatures survive as anchors ("fix
`trimPayload`"), the bulk stays out. Applied to both the reply and the user
message; both the hosted and own-key paths benefit since capture happens before
either. A mock code-heavy reply shrinks 82%, which also cuts input cost on what
were the most expensive calls.

The worker cannot do this fix: it receives flat text with no fences (claude.ai
renders code as `<pre>`, so the markers never existed in the captured string).
Capture-side is the only place that still knows what is code.

Plus one prompt line as insurance, framed positively per the round-3 A/B finding
(positive requirements outperform prohibitions): "Step texts are prose. Refer to
code by its name and location…" — byte-identical in both prompt copies,
enforced by the build.

Acceptance test: reproduce in the conversation that produced three ceiling-hits,
with `wrangler tail` open. Expect no yellow banner, no `[CONTEXA]` ceiling log,
and chip payloads free of code fragments.

---

## Backend 0.9.11 — extension stays 0.9.10

First deliberate version divergence: this is a worker-only change, which is
exactly why the two artifacts version independently.

### Fixed: partial salvages carried no evidence

0.9.10 instrumented the two failure branches (unparseable, no usable steps). The
very next ceiling-hit in the field arrived on the third branch — a successful
partial salvage ("Response was cut short — showing the 5 that came through
complete") — which hit the same `max_tokens` ceiling but logged nothing.

A partial salvage is the same event as a hard truncation with luckier cut
placement, so it now logs and returns the same diagnostic. One asymmetry, on
purpose: failures log the **first** 300 characters (the question is how the
output started — prose? JSON at all?), partials log the **last** 300 (the JSON
started fine; the question is what the model was writing when the budget ran
out — a sixth step, an oversized text, or trailing prose). `diag.steps` counts
steps *started*, the response's `steps` array counts steps *kept*; the gap
between them is over-generation made visible.

Field observation that motivated this: three ceiling-hits in one conversation
(two hard failures, then a partial keeping 5). A spec-compliant response is
roughly 600 tokens; hitting 2500 means ~4× overshoot, content-triggered by
something in that conversation.

---

## Extension 0.9.10 — Backend 0.9.10

### Fixed: failure states reported a symptom and destroyed the evidence

A user hit `Couldn't generate next steps (truncated)`. That code means the API
stopped at the `max_tokens` ceiling *and* not one complete step could be salvaged
from the response — which has three possible causes needing three different
fixes: the text body came back empty (budget spent on non-text content), the model
narrated instead of emitting JSON, or it wrote one enormous step that never
closed.

None of them could be distinguished, because both paths discarded the response.
The worker's catch dropped the text entirely; the extension built a `detail`
string that nothing ever read. The one decisive measurement — `usage.output_tokens`
— was never looked at on either path.

- Both paths now compute a diagnostic: `stop_reason`, input and output tokens, the
  ceiling, text length, whether any JSON appeared, how many steps got named, and
  the set of content block types returned. `blocks` is the decisive field: budget
  spent on non-`text` types leaves a short body with output at the ceiling, and no
  increase in `max_tokens` fixes that.
- The worker logs it to `wrangler tail` along with the first 300 characters of the
  response. Only the counts go to the client — asserted by a test that plants a
  marker string in the model's output and fails if it reaches the response body.
- The page states the cause in one sentence beneath the error, rather than
  requiring a console. Full detail also goes to the console.
- `no_steps` (parsed, but nothing usable) carries the same evidence.

Deliberately **not** done: raising `max_tokens` or adding a retry. Both are
guesses at which of the three causes is real, and one of them is not fixable by
either.

---

## Extension 0.9.9 — Backend 0.9.9

### Fixed: a shipped default could only ever reach a user once

The settings page backfilled an empty Model field with the current default and
persisted it. From that moment the install was frozen: `chrome.storage.local`
held a concrete model, and `DEFAULTS` only fills keys that are *missing*, so
every later default change was silently ignored.

Consequence: an install configured during the Haiku era kept calling
`claude-haiku-4-5` after the default moved to Sonnet 5 — through nine versions,
undetected. It surfaced only because a user read the field aloud.

- An untouched Model field now stores `''`, and the model resolves at call time as
  `stored || SHIPPED_MODEL`, so future default changes reach existing installs.
- A one-time migration clears any stored value matching a former default
  (`SUPERSEDED_MODEL_DEFAULTS`), while a deliberately chosen model survives.
  Storage cannot distinguish "typed haiku on purpose" from "left it blank and we
  saved the default" — the information was never recorded — so the migration
  matches only exact former defaults, on the reasoning that nobody types the value
  that was already the default.
- `build.mjs` fails the build if either `DEFAULTS` seeds a concrete model or the
  save handler backfills an empty field. Verified by reintroducing the bug and
  confirming the build refuses.

### Fixed: /v1/health was cacheable, so it could report a stale build as live

A successful deploy read as a failed one because an intermediary served a cached
health body. An endpoint whose only job is reporting what is deployed must never
come from a cache. All JSON responses now send `cache-control: no-store`.

### Added: both versions and the active path are now stated, not inferred

- `/v1/health` returns `version` and `model`. Previously a deploy could only be
  confirmed by triggering a real reply and reading the output.
- Settings shows the extension version next to the title.
- **Test connection** names which service answered. It has always had two
  branches — own key straight to Anthropic, or the hosted backend — and reported
  a bare check mark for both. An own-key install therefore looked like a verified
  backend while never having contacted it.
- A backend that is reachable but has no API key configured now reports that,
  rather than showing a green check for something that fails every request.

### Added: build and test tooling

- `build.mjs` turns `extension/` into `build-ready/` plus a store-ready zip:
  bakes the backend URL, pins the exact host instead of a `*.workers.dev`
  wildcard, sets the version, and writes the archive with `manifest.json` at the
  root — the wrapper-folder mistake Chrome rejects. The zip is written in pure
  Node with a fixed timestamp: Windows ships neither `zip` nor `unzip`, and the
  archive is verified by reading it back rather than trusting the writer.
  Byte-reproducible across builds.
- It also fails on **prompt drift** between the extension and worker copies of
  `NEXT_STEPS_SYSTEM`. Those had been kept identical by hand across nine
  versions; if they diverge, hosted and own-key users get different products.
- `worker/test.mjs` — 14 checks, no network, no Cloudflare account. Asserts that
  quota-exhausted, oversized, short-reply, bad-token, originless and unconfigured
  requests all reject with **zero** upstream calls.
- `extension/test.mjs` — 12 checks. Loads `background.js` in a sandbox with a
  fake `chrome` and `fetch` to prove the migration actually runs, that a
  deliberate override survives it, and that a Haiku-frozen install now calls
  Sonnet.

---

## Backend 0.9.8 — Extension 0.9.8

### Changed: default model is now Sonnet 5

From a controlled three-model comparison on identical inputs:

| | labels over 6-word cap | bulleted as instructed | voice inversion |
|---|---|---|---|
| Haiku 4.5 | 4/11 | 1/11 | 2, both in slot 1 |
| Sonnet 5 | 0/13 | 10/13 | 0 |
| Opus 5 | 0 | yes | 0, but failed a request at `max_tokens` |

Model tier fixed compliance defects that three rounds of prompt engineering could
not. The label cap, bullet format and voice rule were all stated plainly and
Haiku ignored them regardless. Cost: $0.004 → $0.008 per call. Opus produced the
single best suggestion of any run at 5× the price, and hit the token ceiling.

`MODEL` must match in `wrangler.toml` `[vars]` and the `MODEL` constant in
`src/index.js` — a plain `wrangler deploy` reads the former, so changing only the
constant silently reverts. `build.mjs` now enforces the match.

- `max_tokens` 1600 → 2500. Opus proved the ceiling was reachable; Sonnet also
  writes longer than Haiku.
- Per-IP daily limit 60 → 300. Co-located users behind one NAT were blocking each
  other, which reads as a broken product rather than a quota. Keep it near 10× the
  device limit.

---

## 0.9.7

- Boundary-aware payload trimming. A hard `slice(0, 400)` cut mid-word, producing
  chips like "without users notici" and "5–10% overshoo".
- `salvageTruncated()` tracks `[` as well as `{`. Closing only braces left arrays
  open, so a truncated response was unrecoverable.
- `resetsAt` no longer emits `T24:00:00Z`, which is not valid ISO 8601 and fails
  `Date.parse`.

---

## 0.9.0 – 0.9.5

- Hosted Cloudflare Worker backend, so users need no API key of their own — the
  adoption wall this project exists to clear.
- Two-axis quotas (per-device-token, per-hashed-IP) with salted SHA-256 IP
  hashing, server-side input clamping, and rejection before any spend.
- Chrome Web Store submission assets, privacy policy, icon set.
- Honest degraded states throughout. An earlier build hid failures behind canned
  suggestion cards via an empty `catch {}`, which read as "the same three
  sentences every time". Never fake it.
