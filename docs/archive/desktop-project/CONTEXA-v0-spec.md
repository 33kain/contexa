# CONTEXA — v0 Design Spec
 
*AI prompt emphasizer for Claude. Grammarly-like overlay in the claude.ai composer.*
 
**Version:** 0.1 · **Date:** 2026-08-18 · **Status:** agreed scope, pre-build
 
---
 
## 1. What v0 is
 
Two surfaces of one loop, end to end, in the real claude.ai page:
 
**Before send — Score + critique.** As the user drafts a prompt in Claude's
composer, CONTEXA shows a small score badge near the input. The score updates
as they type (debounced). Clicking the badge opens a critique panel listing
concrete issues — *vague goal*, *missing context*, *no output format*, *no
examples* — each with a one-line fix hint.
 
**After Claude replies — suggested next prompts.** When Claude's answer
finishes streaming, CONTEXA renders a small block under the reply with up to 3
ready-to-send follow-up prompts, generated from (user's prompt + Claude's
reply). Each is tagged by lens: **Sharpen** (tighten/redo the weak part),
**Explore** (an angle you wouldn't think of), **Constrain** (add format/scope
boundaries). Clicking one loads it into the composer — where it immediately
gets scored, closing the loop. This is the loveable.dev moment: guidance
mid-task, when you don't know what to ask next.
 
No rewrite button, no library, no login. Those are v1/v2 lenses on top of the
same plumbing.
 
**Why this feature first:** it's the most ambient of the four. It's visible on
every prompt without the user asking for anything, so it proves the core bet —
that an overlay can feel native inside claude.ai — with the least surface area.
 
**Design principle (the Karpathy test):** if you screenshot claude.ai with
CONTEXA active and show it to someone, they should assume Anthropic shipped it.
Same type scale, same border radii, same warm neutrals, dark-mode aware.
Nothing animated for its own sake. The badge is quiet at high scores and only
gets assertive when the prompt genuinely needs help.
 
## 2. Architecture
 
Chrome extension, Manifest V3. Three parts:
 
**Content script** (the hard part) — attaches to claude.ai, finds the composer
(a ProseMirror `contenteditable` div), observes text changes via a
`MutationObserver` + input events, and renders the overlay into a **Shadow DOM
root** appended to `document.body` (never inside Claude's own DOM tree, so
Claude's React re-renders can't eat our UI and our CSS can't leak in).
Positioning is done by measuring the composer's bounding rect and anchoring the
badge to its bottom-right corner, re-measured on resize/scroll.
 
*Selector strategy (defensive, self-healing):* never rely on one selector.
Ordered fallback chain — `div[contenteditable="true"].ProseMirror` →
`div[contenteditable="true"][aria-label]` inside the main form → largest
visible contenteditable in viewport. If all fail, the extension stays silent
(never breaks the page) and retries on DOM mutations. Composer detection is
isolated in one module (`composer-locator.ts`) so a claude.ai redesign is a
one-file fix.
 
**Service worker** — owns the Anthropic API call. Content script sends the
draft over `chrome.runtime.sendMessage`; worker calls
`POST https://api.anthropic.com/v1/messages` with the user's key (Haiku-class
model — scoring is cheap and needs to be fast), returns structured JSON.
Key lives in `chrome.storage.local`, never touches any server of ours.
 
**Options page** — paste API key, test-connection button, on/off toggle,
score-threshold slider ("only bother me below 70").
 
### Scoring pipeline: two tiers
 
Tier 1, **local heuristics, 0 ms, free** — runs on every keystroke (debounced
300 ms). Catches the objective stuff: prompt length, presence of an explicit
output format ("as a table", "in JSON"), presence of context markers ("I'm
building…", "for an audience of…"), vague-verb detection ("improve", "make
better", "fix" with no object), question-only prompts. Produces a provisional
score instantly.
 
Tier 2, **LLM critique** — fires only when typing pauses ≥ 1.5 s **and** the
draft changed materially (>15% token diff) **and** the draft is >8 words.
Refines the score and produces the human-quality issue list. Cached by draft
hash so re-opening the panel is free. This two-tier design is what keeps it
feeling like Grammarly (instant) rather than like a chatbot (laggy).
 
### LLM contract
 
One call, structured output:
 
```json
{
  "score": 0-100,
  "issues": [
    {
      "type": "vague | missing_context | no_format | no_examples | scope_creep | ambiguous_referent",
      "severity": "low | med | high",
      "excerpt": "the offending fragment, verbatim",
      "hint": "one-line, imperative fix suggestion"
    }
  ],
  "one_line_summary": "e.g. 'Clear goal, but Claude will have to guess the output format.'"
}
```
 
System prompt scores against the rubric below and is forbidden from rewriting
the prompt (that's v1's job) — critique only, ≤4 issues, most severe first.
 
### Scoring rubric (100 pts)
 
| Dimension | Pts | What it measures |
|---|---|---|
| Goal clarity | 30 | Is there one unambiguous task? |
| Context sufficiency | 25 | Does Claude know the who/what/why it needs? |
| Output spec | 20 | Format, length, structure stated? |
| Constraints & examples | 15 | Boundaries, tone, examples given where they'd help |
| Economy | 10 | No contradictions, no filler that dilutes the ask |
 
Bands: **80–100 green** (badge stays quiet), **50–79 amber**, **0–49 red**.
Short conversational messages ("thanks!", "yes do that") are detected and
**not scored at all** — badge hides. Scoring chit-chat is how you get uninstalled.
 
## 3. UI spec
 
**Score badge** — 30 px pill anchored just *below* the composer's bottom-right
corner, so it never collides with Claude's send button or the draft text. Shows the number, tinted by band. Idle opacity
0.85; fades to 0.3 while typing (never blocks reading your own draft); Tier-2
in-flight shows a subtle pulse, no spinner. Hidden entirely on empty/chit-chat
input.
 
**Critique panel** — opens on badge click, anchored *above the composer* (it
must never cover the draft the user is reading), ~340 px wide, max 40%
viewport height. Contents: score + one-line summary, then issue
rows (severity dot · type label · excerpt in quotes · hint). Hovering an issue
row highlights the matching excerpt in the composer via a positioned
underline overlay (Grammarly-style). Footer: "CONTEXA" wordmark + settings
gear. Esc or outside-click closes. No badges, no confetti, no streaks.
 
**Suggestions block** — appears under Claude's completed reply (detected via
DOM mutation: streaming stopped + response container settled), indented to the
reply's text column. Label row ("✦ CONTEXA · suggested next prompts"), then up
to 3 cards: lens tag + one-line prompt + insert arrow on hover. Click inserts
into the composer and focuses it; the badge scores it immediately. Cards fade
in ~300 ms after the reply completes — never during streaming. Only rendered
for substantive replies (skip refusals, one-liners, clarifying questions where
Claude itself asked the user something specific). One LLM call generates all
three suggestions; cached per reply.
 
**Visual language** — inherits claude.ai's feel: system font stack it uses,
10 px radii, warm neutral surfaces, detects dark mode from the page and swaps
palette. Band colors are muted (sage green / warm amber / soft red), not
traffic-light neon.
 
## 4. Privacy posture
 
Draft text goes to exactly one place: the Anthropic API, with the user's own
key. No CONTEXA server, no analytics, no draft retention. This is a feature —
say it on the options page in one sentence.
 
## 5. Non-goals for v0
 
Rewrite/improve (v1, same panel gains an "Improve" action) · Creative
suggestions (v1.5) · Library/templates, login, sync (v2, needs backend) ·
Firefox/Safari (later) · Claude desktop app (extension can't reach it; revisit
as an MCP/skill angle later).
 
## 6. Milestones
 
1. **M0 — mockup** (this session): interactive HTML mockup of composer + badge
   + panel; lock the design.
2. **M1 — skeleton**: MV3 extension loads on claude.ai, locates composer,
   shows static badge. Survives navigation between chats.
3. **M2 — heuristic scoring**: Tier 1 live, badge updates while typing.
4. **M3 — LLM critique**: options page + key storage, Tier 2 wired, panel
   shows real issues, excerpt highlighting.
5. **M4 — polish**: dark mode, edge cases (long prompts, paste, chat switch),
   then load it on real claude.ai and dogfood for a week.
## 7. Risks
 
*claude.ai DOM changes* — mitigated by the locator fallback chain + silent
degradation. *API key friction* — v0 is for us and early adopters; hosted
backend solves this in v2. *Perceived latency* — two-tier scoring; Tier 1 makes
it feel instant even when Tier 2 takes 1–2 s. *Extension review* — MV3,
minimal permissions: `storage`, host permissions for `claude.ai` and
`api.anthropic.com` only.