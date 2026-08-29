# CONTEXA — Chrome Web Store: the review-facing declarations

**This is no longer a submission walkthrough.** The account exists, the item is
uploaded, 0.9.54 is approved and **Public**. Steps 1–7 of the old version
described a first-time unlisted launch and every one of them is done.

**What this file is now:** the four fields a *reviewer* reads, kept accurate, so
that an update or a rejection reply never has to be improvised. Rewritten
2026-08-26, because every word of the previous version described the chip-era
product — including the permission justifications, which is the dangerous half.

**What this file deliberately does NOT contain: the store description.** That
lives in `claude/CONTEXA-store-listing.md` §1 and nowhere else. `LISTING.md`
became a tombstone precisely because it duplicated the listing and drifted from
it; this file will not repeat that. Public-facing copy → listing doc.
Review-facing declarations → here. No overlap, nothing to drift.

---

## Already done — do not redo

- **Developer account**, $5 paid, publisher name set.
- **Item uploaded and approved.** 0.9.47 cleared review; 0.9.54 is the live
  package.
- **Visibility: PUBLIC** as of 2026-08-26. The control was greyed out for days
  and finally unlocked.
- **`ALLOWED_EXTENSION_IDS` pinned to `phhamigkjeeabbjncpmhkppkjccfglhb`** —
  visible in the deploy bindings. The worker now refuses every other origin, so
  the "anyone with the Worker URL can spend your budget" hole is closed.
- **Privacy policy URL** — see the warning below.

### ⚠️ The privacy policy URL is almost certainly stale

The listing declares **Personal communications**, and Chrome requires a policy
URL when you declare data collection — so a URL exists and review accepted it.
It points at a gist created from the **pre-0.9.53** `PRIVACY.md`, which said
conversation text is sent *when a Claude reply finishes*. That is no longer true:
nothing is sent until the button is pressed.

`publishing/PRIVACY.md` was rewritten 2026-08-26. **The hosted gist still needs
replacing with it** — check the Privacy tab for the exact URL, edit that gist,
paste the new text. The error is in our favour (we transmit *less* than the
policy claims) which is why it is a correction and not an emergency, but a
privacy policy that misstates when data leaves the browser is the one document
where accuracy is not cosmetic.

---

## Privacy tab — single purpose

```
CONTEXA has one purpose: to help the user write their next message inside
conversations on claude.ai. After a Claude reply finishes, the extension shows a
single button above the message box. If the user presses it, CONTEXA reads that
reply and either offers a few short questions the user answers by clicking, or
offers up to four suggested next moves; it then composes the resulting prompt
into the page's message box for the user to read, edit and send themselves. The
extension never sends a message on the user's behalf.
```

## Permission justifications — one per permission, all required

**These were the most dangerous stale text in the repo.** The previous version
told reviewers the content script *"detects when a Claude reply has finished
rendering, reads the text … and inserts the user's chosen prompt"* — describing
an extension that acts on a reply automatically. Ours acts on a **press**. A
justification that overstates what an extension does invites exactly the
scrutiny it was written to avoid.

`storage`
```
Stores the user's own settings on their device: whether the extension is enabled,
their optional Anthropic API key, and a randomly generated anonymous token used
solely to apply a fair-use daily limit. No browsing data is stored, and none of
this is transmitted to us.
```

`https://claude.ai/*`
```
This is the only site the extension operates on and is essential to its single
purpose. The content script detects when a Claude reply has finished rendering
and reads the text of that reply and the user's preceding message, so that it
knows what the button it displays would be about. Nothing is transmitted at that
point. Only if the user presses the button is that text used to generate
questions or suggested next moves, and only the prompt the user then chooses is
inserted into the page's message box. The extension never submits a message.
```

`https://api.anthropic.com/*`
```
Used only when the user has chosen to supply their own Anthropic API key. In that
mode the extension calls the Anthropic Messages API directly from the browser, so
the user's key and conversation text never pass through any server of ours.
```

`https://contexa-api.michu110899.workers.dev/*`
```
The extension's own backend, for users who have not supplied their own API key.
It is contacted only when the user presses the button. It receives only the
user's latest message and the reply just received, forwards them to Anthropic's
API, returns the result, and stores none of it.
```

## Data usage — declare these three, and only these three

- **Authentication information** — the user's optional API key, stored locally.
- **Personal communications** — the message and reply text, sent for processing
  **only when the user presses the button.**
- **Website content** — the text of the current reply, read from the page.

Leave unchecked: personally identifiable information, health, financial,
location, web history, user activity.

**Why "Website content" stays declared even though nothing auto-sends.** Reading
is still eager: the content script reads the exchange at reply completion so it
knows what the button refers to. Only *transmission* moved behind the press. We
declare the reading and the sending separately and the sending is narrower than
the declaration — which is the right direction for a declaration to be wrong in,
and the reason not to quietly drop a category that is still technically accurate.

## Certifications — tick all three; all are true of this build

- I do not sell or transfer user data to third parties outside of approved use cases
- I do not use or transfer user data for purposes unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending

---

## If a reviewer pushes back

**Read the exact policy clause cited, fix only that, and resubmit noting what
changed.** Do not volunteer changes to anything they did not raise.

**Never re-paste from an old copy of this file, or from `LISTING.md`.** Both
described suggestion chips, a mechanism gone since 0.9.30, and the auto-firing
card, gone since 0.9.53. If a field needs text, take it from this document (for
review-facing fields) or `claude/CONTEXA-store-listing.md` (for public-facing
copy).

**The two questions most likely to come up, and the honest answers:**

*Why does it need a remote server?* Because the audience is people without an
Anthropic API key. Users who supply their own key never touch our backend at all
— that path is in the product, not a promise.

*What does it do with the conversation?* Reads one exchange in the page; sends it
only on a press; the backend forwards it to Anthropic and stores nothing. There
is no database. This is checkable in the source, which is why it is safe to say
plainly.

---

## The name, and the one policy call worth remembering

Shipped name: **`CONTEXA - Claude prompts, without the writing`**.

An earlier version of this file argued "Claude" must be absent from the name.
**That was over-cautious.** The impersonation policy is about false endorsement —
*don't represent that your product is authorized by, endorsed by, or produced by
another company* — not about naming the service an extension works with. The name
leads with our own brand, describes a function, and the description carries an
explicit non-affiliation line, which is **mandatory and must never be softened**.

**What WOULD be real risk:** a name that reads as first-party (`Claude Prompts`,
`Claude Assistant`), Anthropic's wordmark or logo on any store asset, or copy
implying review, partnership or endorsement.

---

## Two operational notes that changed meaning

**Do not install from the store on the development profile.** The old version
said to remove the unpacked copy after going live. That advice assumed one
install. Mili deliberately keeps the unpacked build for own-key testing — so on
that profile, the store copy must NOT also be installed: two installs means two
cards and two `card mounted` lines at different versions, which is watch
criterion M and has already caused contaminated readings once.

**The cost table in the old version was Haiku-era arithmetic and understated by
half.** With Sonnet 5, a user at the 20/day cap costs roughly **$0.16/day**, not
$0.08; at 50/day roughly **$0.40**. Ten friends at the cap is nearer $48/month
than the $24 previously written.

But the cap is no longer the number that matters. **The old claim that "you hit
20/day yourself in a single day of use" was true under auto-fire, where every
reply spent one call whether or not anyone looked at it.** Since 0.9.53 nothing
is spent until a press, so typical use sits far below the cap and the worst case
is the only case the cap describes. **Do not raise the limit on the old
reasoning** — the reasoning was retired by the mechanism. If it is ever raised,
raise it on observed usage.

**And whatever number is quoted anywhere public, take it from
`DEVICE_DAILY_LIMIT` in `worker/src/index.js`.** The store listing said 10 for
three days while the code enforced 20.

---

## What to ask real users

Not "do you like it." Ask:

1. Did you press the button, or ignore it? *(This is now the first question —
   watch criterion O. If nobody presses it, the unbidden card was the product.)*
2. Of the prompts it wrote, how many said something you wouldn't have written?
3. Are you still pressing it in week two?

Question 1 is the one the on-demand release put at risk. Question 3 decides
whether it has a future.
