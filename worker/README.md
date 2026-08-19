# CONTEXA API — deploy guide

A thin Cloudflare Worker that proxies suggestion requests to Anthropic using
**your** API key, so users of the extension never need one of their own.

You run these commands — I never see or handle your key.

## 1. Prerequisites

- A Cloudflare account (the free plan is enough: 100,000 requests/day).
- Node 18+ installed locally.
- An Anthropic API key.

## 2. Create the quota store

```bash
cd worker
npx wrangler login
npx wrangler kv namespace create CX_KV
```

Copy the printed `id` into `wrangler.toml`, replacing
`PASTE_YOUR_KV_NAMESPACE_ID_HERE`.

## 3. Set your secrets

```bash
npx wrangler secret put ANTHROPIC_API_KEY   # paste your key at the prompt
npx wrangler secret put IP_SALT             # any random string, e.g. `openssl rand -hex 16`
```

`IP_SALT` means IP addresses are only ever stored as salted hashes, never in the
clear — worth stating in your privacy policy.

## 4. Deploy

```bash
npx wrangler deploy
```

Wrangler prints your URL, e.g. `https://contexa-api.your-subdomain.workers.dev`.

Verify it:

```bash
curl https://contexa-api.your-subdomain.workers.dev/v1/health
# {"ok":true,"version":"0.9.8","model":"claude-sonnet-5","limit":20,"configured":true}
```

Read that response as four separate checks:

| Field | Means |
|---|---|
| `version` | which build is live — bump `BUILD` in `src/index.js` each deploy, and this is how you prove the deploy landed rather than no-opped |
| `model` | the tier that will actually serve requests (`env.MODEL` from `wrangler.toml`, falling back to the constant) |
| `configured` | `false` means `ANTHROPIC_API_KEY` is missing and every suggestion request will fail with `server_not_configured` |
| `limit` | the per-device daily quota the client will be held to |

## 5. Point the extension at it

In `extension/background.js`, set:

```js
const DEFAULT_PROXY_URL = 'https://contexa-api.your-subdomain.workers.dev';
```

And in `extension/manifest.json`, replace the placeholder host permission with
your exact host (pinning the exact domain reads far better in review than a
wildcard):

```json
"host_permissions": [
  "https://claude.ai/*",
  "https://api.anthropic.com/*",
  "https://contexa-api.your-subdomain.workers.dev/*"
]
```

## 6. Lock it to your extension before launch

Until you do this, anyone who finds the URL can spend your quota. After you
publish and Chrome assigns your extension its permanent ID:

```bash
npx wrangler deploy --var ALLOWED_EXTENSION_IDS:your32characterextensionid
```

The Worker then rejects every other origin with `403 forbidden_origin`.

## What it costs you

Each suggestion set is roughly **$0.008** (≈2,000 input tokens of conversation,
≈400 output tokens at Sonnet 5 pricing of $2/$10 per MTok).

| Active users | Replies/user/day | Rough monthly cost |
|---|---|---|
| 50 | 10 | ~$120 |
| 100 | 20 | ~$480 |
| 500 | 20 | ~$2,400 |

**Why Sonnet 5 rather than Haiku 4.5**, which is half the price: in a controlled
three-model comparison on identical inputs, Haiku ignored the label-length limit
(4 of 11 labels over cap), largely ignored the bullet-formatting instruction
(1 of 11), and twice produced steps that asked the *user* a question the model
could not answer — a step that cannot be sent. Sonnet 5 scored 0 of 13 over cap,
10 of 13 bulleted, and no voice inversion. Three rounds of prompt engineering had
failed to fix those defects on Haiku. Opus 5 gave the single best suggestion of any
run but failed a request outright by exceeding `max_tokens`, at 5x the cost.

Set `MODEL` in `wrangler.toml` to change tier. `claude-haiku-4-5` halves the bill
if you are cost-constrained and can tolerate the formatting defects.

The Worker itself is free at these volumes; essentially all cost is inference.

## Cost protections already in place

- **20 requests/day per device** and **300/day per IP** (the second axis blunts
  reinstall-for-a-fresh-token abuse; keep it at roughly 10× the device limit so
  co-located users — an office, a campus, a household behind one NAT — don't
  block each other).
- **Server-side input clamping**: prompt ≤2,500 chars, reply ≤6,000 chars,
  `max_tokens` fixed at 2,500. A modified client cannot make a request cost more.
- **Replies under 50 chars are rejected** before any upstream call.
- Upstream error bodies are never forwarded to clients.

Raise or lower the limits at the top of `src/index.js`.

## Known limitation

KV counters are eventually consistent, so a user firing several requests in the
same instant might slip a couple past the limit. That is fine for a soft quota.
If you ever need exact enforcement, move the counter to a Durable Object — the
call sites in `bumpQuota()` are the only thing that changes.

## Monitoring

```bash
npx wrangler tail          # live logs
```

Cloudflare's dashboard shows request counts; your Anthropic console shows spend.
Set a spend limit there too — it is the only hard backstop.
