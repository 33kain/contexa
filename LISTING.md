# CONTEXA — store listing

**This file is NOT the listing.** It described the chip-era product and went
stale for sixteen releases, at which point it was still recommending a name the
product had already stopped using.

**Source of truth:** the `claude/CONTEXA-store-listing.md` project doc. It has
the paste-ready description, the submission checklist, the asset specs and the
timing rule for when the description may be published.

Copy is kept there, not here, for one reason: **a file that duplicates the
listing will drift from it, and a drifted listing is worse than no file at all.**
Three surfaces proved that on 2026-08-23 — this file, the settings page, and both
promo tiles were all still advertising suggestion chips.

It proved it again on 2026-08-31. The settings page had drifted a second time,
now to interview copy, and had to be rewritten with the history-mining pivot.
The lesson did not need relearning; the surface just had no guard on it.

---

## The one thing worth preserving from the old version

It argued that **"Claude" should be absent from the extension name**, on the
grounds that Chrome Web Store policy prohibits listings implying affiliation.

**That was over-cautious, and the shipped name is
`CONTEXA - Claude prompts, without the writing`.** Reasoning, checked against
the policy on 2026-08-23:

- The rule is about **impersonation and false endorsement** — *"don't represent
  that your product is authorized by, endorsed by, or produced by another company
  … if that is not the case."* It does not prohibit naming the service an
  extension works with.
- The name **leads with our own brand**, and describes a function rather than
  claiming to be a first-party product.
- The description carries an explicit non-affiliation line, which is mandatory
  and must never be softened.
- Omitting "Claude" cost the single most obvious search term for this extension,
  which is a certain loss against a speculative risk.

**What WOULD move this into real risk**, and is worth re-checking if any of it
ever changes: a name that reads as first-party (`Claude Prompts`, `Claude
Assistant`); Anthropic's wordmark or logo on any store asset; or copy that
implies review, partnership or endorsement.

Source: [Impersonation & Intellectual Property](https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property)
