# CONTEXA — live state & launch record (updated 2026-08-19)
 
**Live: extension 0.9.9, backend 0.9.9.** Both deployed and verified. Git caught
up and pushed (`bf0063d`, tag `v0.9.9`).
 
## Deployed
- **Backend:** `https://contexa-api.michu110899.workers.dev` (Cloudflare Worker
  `contexa-api`, KV `CX_KV` id `68d9d130c21741e8a5450f38f2942df7`).
- Secrets set: `ANTHROPIC_API_KEY`, `IP_SALT`.
- `/v1/health` returns `{ok, version, model, limit, configured}` with
  `cache-control: no-store`. Four checks in one line: `version` proves the deploy
  landed rather than no-opped, `model` is the tier that will actually serve
  (`env.MODEL || MODEL`), `configured:false` means the key is missing and every
  request will fail, `limit` is the per-device quota.
- `ALLOWED_EXTENSION_IDS` = **empty (unpinned)** deliberately: unpacked extension
  IDs vary by folder path and pinning caused `forbidden_origin`. **Pin the
  store-assigned ID after publishing.**
- Quotas: 20/day per device token, 300/day per hashed IP (~10× the device limit so
  co-located users behind one NAT don't block each other). Input clamped
  server-side; rejection happens before any spend, asserted by test.
## Versioning: the two numbers are independent by design
Extension version = `manifest.json`. Backend version = `BUILD` in
`worker/src/index.js`. A worker hotfix must not require a Chrome Web Store
resubmission, so they are free to diverge. The settings page labels them
separately (`CONTEXA v0.9.9` vs `backend v0.9.9`) because the first time they
diverged, it read as a broken deploy.
 
## Model: Sonnet 5
`MODEL` lives in **two** places and both must agree: `wrangler.toml` `[vars]`
(what a plain `wrangler deploy` uses) and the `MODEL` constant in `src/index.js`
(the fallback). Changing only the constant silently reverts on the next deploy.
`build.mjs` now enforces the match.
 
Evidence, controlled three-model comparison on identical inputs:
 
| | labels over 6-word cap | bulleted as instructed | voice inversion |
|---|---|---|---|
| Haiku 4.5 | 4/11 | 1/11 | 2, both slot 1 |
| Sonnet 5 | 0/13 | 10/13 | 0 |
| Opus 5 | 0 | yes | 0, but failed a request at `max_tokens` |
 
**Transferable finding: model tier fixed compliance defects that three rounds of
prompt engineering could not.** The label cap, bullet format and voice rule were
all stated plainly and Haiku ignored them regardless. Cost $0.004 → $0.008/call.
`max_tokens` 1600 → 2500 (Opus proved the ceiling reachable; Sonnet writes longer
than Haiku too).
 
## The bug worth remembering: a default that could only apply once
The options page backfilled an empty Model field with the current default and
persisted it. From that moment the install was frozen — `chrome.storage.local`
held a concrete value and `DEFAULTS` only fills *missing* keys, so every later
default change was silently ignored.
 
Consequence: the developer's own install kept calling `claude-haiku-4-5` for nine
versions after the default moved to Sonnet 5. **All dogfooding and every quality
judgement up to that point measured the model measured as worst of the three**,
on the own-key path, never touching the hosted backend. It surfaced only because
a field value was read aloud.
 
Fix: an untouched field stores `''`; the model resolves at call time as
`stored || SHIPPED_MODEL`; a one-time migration clears stored values matching a
former default (`SUPERSEDED_MODEL_DEFAULTS`) while preserving deliberate choices.
Storage could never distinguish "typed haiku on purpose" from "left it blank and
we saved the default" — that information was never recorded — so the migration
matches exact former defaults only, reasoning that nobody types the value that
was already the default.
 
**Generalise: never persist a default. Store absence, resolve at read time.**
Anywhere a shipped default gets written into user storage, that default is frozen
for that user forever.
 
## Build & test tooling
- `node build.mjs` — `extension/` → `build-ready/` + a store-ready zip. Bakes the
  backend URL, pins the exact host (not a `*.workers.dev` wildcard), sets the
  version, writes the archive with `manifest.json` at the root. **Idempotent** —
  the repo tracks *built* output, so it must succeed whether the source has a
  placeholder or the finished URL. Zip is written in pure Node with a fixed
  timestamp (Windows has no `zip`/`unzip`), verified by reading it back, and
  byte-reproducible.
  Fails the build on: unbaked URL, wildcard host, version mismatch, model
  disagreement across the three files naming one, a concrete model seeded into
  either `DEFAULTS`, an empty model field being backfilled, and — most
  importantly — **prompt drift between the extension and worker copies of
  `NEXT_STEPS_SYSTEM`**, which had been kept identical by hand across nine
  versions.
- `cd worker; node test.mjs` — 14 checks, no network, no Cloudflare account.
  Asserts quota-exhausted, oversized, short-reply, bad-token, originless and
  unconfigured requests all reject with **zero** upstream calls.
- `cd extension; node test.mjs` — 12 checks. Loads `background.js` in a sandbox
  with a fake `chrome`/`fetch` to prove the migration runs, that a deliberate
  override survives it, and that a Haiku-frozen install now calls Sonnet.
- `commit-0.9.9.ps1` — runs all of the above, scans **all git history** for
  key-shaped strings (`sk-ant-` + 20 chars; bare `sk-ant-` matches the options
  page placeholder and cried wolf), commits and tags but never pushes.
**Process lesson, cost three consecutive failures on the user's machine:** every
piece of tooling was written against the shape of the *sandbox* tree rather than
the user's. `zip`/`unzip` don't exist on Windows; the secret pattern matched our
own placeholder; the URL-bake guard read "nothing changed" as "line missing"
because the user's `extension/` is built output while the sandbox's is source.
Verify tooling against the target environment's tree shape, not the authoring one.
 
## Before sharing the zip: cap the spend
The zip carries the backend URL in plaintext (`background.js`, `manifest.json`),
and `ALLOWED_EXTENSION_IDS` is empty, so anyone holding it can call the backend
from any origin. Device tokens are client-generated so trivially rotated; the
300/day per-IP cap (~$2.40/day) is the only real bound, and nothing bounds many
IPs. **There is no Anthropic spend limit set** — the actual ceiling is the card.
 
The answer is a **Workspace**, which has its own hard limit and its own keys:
1. Console → Settings → Workspaces → Add Workspace ("CONTEXA")
2. Open it → **Limits** tab → Change Limit
3. That workspace's **API Keys** tab → create a key there (keys are
   workspace-scoped and cannot be moved between workspaces)
4. Cloudflare dashboard → Worker → Settings → Variables → replace
   `ANTHROPIC_API_KEY` via the visible Secret field
Then abuse is capped at a chosen number and cannot reach anything else on the
account.
 
## Prompt evolution (measured on live Haiku, 3 turns/config)
| Round | Change | Novelty | Slot-1 best | Labels over cap |
|---|---|---|---|---|
| baseline | original | 27% | 0/3 | 2/15 |
| improved | ban obvious + ban reply-echo | 67% | 0/3 | 7/15 |
| round3 | slot-1 positive type constraint + 6-word cap | **73%** | **3/3** | 3/15 |
| round4 | style rules + variable 3–5 count | 55% | 3/3 | 5/11 |
 
- The *same rule* failed as a prohibition ("never first") and worked as a positive
  requirement ("must be one of these four types"): 0/3 → 3/3.
- Banning reply-echo was the biggest novelty lever (27→67%).
- Variable 3–5 counts worked mechanically but **cost novelty**: trimming pruned
  speculative suggestions and kept safe ones. The 5th slot is where outliers live.
- Not prompt-fixable: ~1 fabricated capability per session (invented "KV
  transaction logs", "CAS rejections"). Mitigated by design — the payload lands in
  the composer to be read before sending. **Never auto-send a chip.**
- All of the above is n=1 per config. Suggestive, not proven. And all of it
  measured Haiku, which is no longer what ships.
## Launch: unlisted Chrome Web Store (in progress)
`SUBMISSION.md` has every dashboard field paste-ready. `publishing/PRIVACY.md`
has the contact filled and needs hosting as a public gist. Rejection risks
handled: "Claude" absent from the extension **name**, non-affiliation disclaimer
present, minimal permissions, personal-communications data declared.
 
Post-publish, in order: pin `ALLOWED_EXTENSION_IDS` → remove the unpacked copy
(else duplicate chips) → decide the daily limit. **The limit decision changed with
the model switch:** 20/day is now ~$0.16/user/day, 50/day ~$0.40 — the "50
recommended" figure from the Haiku era is twice the bill it was.
 
## Open questions only real users can answer
1. Of the chips clicked, how many were things they wouldn't have thought of?
2. Do they click the first chip or scan further? (validates the ordering work)
3. Does usage survive week two? (banner blindness is the likeliest failure mode)
## Unresolved
- **The IP quota is a circular bound.** The 300/day per-IP counter is meant to
  backstop the racy per-device counter but uses the *same* eventually-consistent
  KV read-modify-write, so it shares the race. It reduces blast radius rather than
  capping it. A real cap needs a Durable Object; `bumpQuota()` is the only call
  site to change.
- Next feature chosen but not built: **adapt suggestions to the model the user is
  conversing with**. Selector verified: `button[data-testid="model-selector-dropdown"]`,
  `aria-label="Model: Haiku 4.5 Extended"` (label includes thinking mode). Premium
  generation models stay own-key only.
- Nobody has yet used the product as it now ships. Sonnet output is unevaluated.
## Known structural risk
Depends on claude.ai's internal DOM (`.font-claude-response`,
`[data-is-streaming]`, `.group/message-row`, the ProseMirror composer). A redesign
silences it — degrades quietly rather than breaking the page, but lifespan is
coupled to markup outside our control.
 
## Security note
Early in the project an API key was pasted into chat and also stored as a
Cloudflare secret *name*. Revoked and replaced. History scan confirms no
key-shaped string was ever committed (the one `sk-ant-` hit in `ac8aab5` is the
options page placeholder). Set secrets via the Cloudflare dashboard's visible
Secret field, never the CLI's hidden prompt — `secret put` takes the NAME as its
argument and the VALUE at the prompt, easy to invert. `.gitignore` keeps
`key.txt`, `*.key`, `.env*`, `.dev.vars`, `.wrangler/` (holds
`wrangler-account.json`) and `*.zip` out of git.