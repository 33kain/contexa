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
# {"ok":true,"limit":20}
```

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

Each suggestion set is roughly **$0.004** (≈2,000 input tokens of conversation,
≈400 output tokens at Haiku pricing).

| Active users | Replies/user/day | Rough monthly cost |
|---|---|---|
| 50 | 10 | ~$60 |
| 100 | 20 | ~$240 |
| 500 | 20 | ~$1,200 |

The Worker itself is free at these volumes; essentially all cost is inference.

## Cost protections already in place

- **20 requests/day per device** and **60/day per IP** (the second axis blunts
  reinstall-for-a-fresh-token abuse).
- **Server-side input clamping**: prompt ≤2,500 chars, reply ≤6,000 chars,
  `max_tokens` fixed at 1,600. A modified client cannot make a request cost more.
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
