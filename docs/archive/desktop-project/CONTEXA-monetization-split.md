# Standalone app — the free/paid split
 
Written 2026-08-22. The app does not exist yet; this is deliberate, because the
conclusion below **changes what has to be built on day one**. The architecture
brief (`new-app-brief.md`) currently says nothing about accounts or storage. If
this design is right, it must.
 
---
 
## 1. Why the key bypassed CONTEXA, precisely
 
CONTEXA's free tier is 20 suggestion sets a day. Anyone who wants more pastes
an Anthropic API key and gets unlimited, forever, free.
 
That isn't a leak someone found. It's a structural fact: **CONTEXA's entire
value-add over "the model" is a system prompt**, and the system prompt is in a
public GitHub repo. A user with a key can reproduce the whole product in an
afternoon. There is nothing left to charge for.
 
Generalised: **you cannot sell inference to someone who can buy inference
directly.** Any paid tier whose benefit is "more calls" or "better prompt text"
is defeated by a $5 API key.
 
## 2. The principle this forces
 
The paid tier must be built on something a local key cannot produce. There are
only a few such things:
 
- **Accumulated state** — history the user's machine never had.
- **Cross-device continuity** — sync needs a server by definition.
- **Multi-user coordination** — shared libraries, shared style, team rules.
Everything else — better prompts, more calls, faster models — is inference, and
inference is a commodity your user can buy at cost.
 
So: **sell state, not inference.**
 
---
 
## 3. The split
 
### FREE — no account, no key, anonymous
 
- The whole core loop: rough ask in, well-formed prompt out, anywhere it runs.
- A daily ceiling on rewrites (start at CONTEXA's 20; tune on real data).
- **Nothing is stored.** No history, no library, no profile. Anonymous device
  token for quota only, as CONTEXA already does.
- **Own-key option stays**: paste a key, get unlimited rewrites, still stored
  nothing.
The free tier must be genuinely good, not crippled. The rewrite is the thing
people tell each other about, and a hobbled version gets no word of mouth.
 
### PAID — account required, subscription
 
Everything above, plus the things that require a server:
 
1. **It learns you.** Every time the user edits a draft before sending, that
   edit is signal — it says what the writer got wrong about their voice, their
   defaults, their constraints. After enough of them the app stops making those
   mistakes. This is the product. Not "better prompts" in general — *your*
   prompts.
2. **Your library.** Prompts worth keeping, searchable, reusable.
3. **Your style profile.** Derived from corrections, applied automatically,
   editable by hand.
4. **Sync.** The same accumulated brain on laptop, desktop, work machine.
5. **No key needed for unlimited use** — convenience, not the value.
Shape of the price: monthly, not one-time. Costs recur per call, so a lifetime
price means paying for that person indefinitely. Anchor in the range indie
tools of this kind sit at; validate against what people actually say when
asked, not against a spreadsheet.
 
---
 
## 4. Why a pasted key cannot bypass this
 
Because the key and the subscription sell **different goods.**
 
A key buys inference. It produces a competent generic prompt writer, forever,
for the price of tokens. That is exactly what the free tier already gives away.
 
The subscription sells a writer shaped by the user's own history — and that
history **does not exist on their machine.** It was never captured there,
because the free tier deliberately stores nothing. A key cannot reconstruct
what was never recorded. Nor can it sync anything, because there is nothing to
sync from.
 
**The elegant consequence:** own-key stops being a leak and becomes an asset.
Heavy users who don't want memory get unlimited rewrites and cost nothing to
serve. The valve that protected CONTEXA's bill now also protects margin,
because volume is no longer what's being sold.
 
**What it does not defend against:** a technical user self-hosting the whole
thing, including the memory layer. Which leads to a decision that must be made
deliberately rather than by default —
 
> **Open-source question.** CONTEXA's repo is public and that was right: it was
> a free tool and the transparency was worth more than the secrecy. If the
> learning layer of the new app is also public, self-hosting is a weekend for
> a competent developer. The rewrite engine can stay open; **the memory layer
> is the asset and probably should not be.** Decide before the first commit,
> because reversing it later is impossible.
 
---
 
## 5. The four risks, honestly
 
**Cold start — the one most likely to kill it.** A new subscriber's memory is
empty, so the paid tier is at its weakest precisely when they are deciding
whether to keep paying. Month one delivers almost nothing month zero didn't.
Mitigations worth designing in from the start: ask four or five sharp questions
at signup and seed a style from the answers; let the user paste two or three
things they've written and derive the profile from those; make the first week
visibly show what it has learned, so progress is felt rather than promised.
 
**Unproven value.** "It learns you" is a claim, not a fact. It has to survive a
real test: does output measurably improve after fifty uses, in a way a user
notices without being told? If it doesn't, there is no paid product here and
better to find out with a prototype than a pricing page.
 
**Privacy inversion.** The free product's promise is no account, no tracking,
nothing stored. The paid tier's entire mechanism is storing what you write.
That is not a contradiction, but it must be stated plainly rather than buried:
free stays anonymous; paid stores your history *because the history is the
product*, with export and delete as first-class features, not settings-page
afterthoughts.
 
**Memory costs money.** Retrieval means longer prompts, so a paid call costs
more to serve than a free one. Paid users are not just more valuable, they are
more expensive. Price has to cover that, and the cost grows with tenure.
 
---
 
## 6. What must be true
 
Before any of this is worth building:
 
1. Someone wants the free rewrite enough to use it repeatedly. **No evidence
   yet** — CONTEXA has one outside user.
2. Users edit the drafts often enough that edits are meaningful signal. If they
   send drafts unchanged, there is nothing to learn from.
3. The improvement from memory is noticeable within one billing cycle.
Point 2 is measurable *now*, cheaply, on CONTEXA: the friends' week can reveal
whether people send chips as-is or rewrite them first. That single observation
is the strongest available evidence for or against this entire design, and it
costs nothing extra to collect.
 
---
 
## 7. Consequence for the architecture
 
The standalone brief asks for four architectures and recommends a
selection-anchored extension. That recommendation stands. But if monetization
rests on accumulated state, then accounts, storage and sync are **not a later
phase** — they are load-bearing from the first version, and the architecture
has to be chosen knowing that. Add to the brief before it is answered:
 
> Paid value comes from accumulated per-user state (edit history, style
> profile, library, sync), never from inference volume or prompt quality.
> Assume an account and a server-side store exist from day one. Free stays
> anonymous and stores nothing.