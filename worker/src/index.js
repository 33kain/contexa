/* CONTEXA API — Cloudflare Worker.
   A thin proxy so users never need their own Anthropic key. It holds YOUR key
   as a secret, enforces per-device and per-IP daily quotas, and clamps input
   size so a malicious client cannot run up your bill.

   Endpoints:
     POST /v1/next-steps  -> { steps: [{label, text}], quota: {used, limit} }
     GET  /v1/health      -> { ok: true }

   Secrets / bindings (see wrangler.toml and README):
     ANTHROPIC_API_KEY  secret   your key
     IP_SALT            secret   any random string; salts hashed IPs
     CX_KV              KV       quota counters
     ALLOWED_EXTENSION_IDS  var  comma-separated Chrome extension IDs (optional)
*/

/* The WORKER's build number, bumped on every deploy so /v1/health can prove
   which build is live. Deliberately independent of the extension's manifest
   version — they ship on separate paths and a worker fix should not force
   everyone to reinstall the extension. */
const BUILD = '0.9.12';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
/* Sonnet 5 rather than Haiku, on measured evidence: in a controlled three-model
   comparison Haiku ignored the label-length rule (4/11 over cap), largely ignored
   the bullet instruction (1/11), and twice wrote steps that asked the USER a
   question it could not answer — all defects that three rounds of prompt work
   failed to fix. Sonnet 5 scored 0/13 over cap, 10/13 bulleted, no voice
   inversion, for $0.004 more per call. Opus 5 produced the best single suggestion
   but failed a request outright at 5x the cost. */
const MODEL = 'claude-sonnet-5';

// Quotas. Client values are never trusted; these are the only limits that count.
const DEVICE_DAILY_LIMIT = 20;
// Second axis: blunts reinstall-for-a-fresh-token abuse. Deliberately generous
// relative to the device limit, because legitimate users share IPs — an office or
// a flat would otherwise block each other and it would look like a broken product.
// Keep this at roughly 10x DEVICE_DAILY_LIMIT.
const IP_DAILY_LIMIT = 300;
const KV_TTL_SECONDS = 60 * 60 * 48;

// Cost guards: a request can never be larger than this, whatever the client sends.
const MAX_PROMPT_CHARS = 2500;
const MAX_REPLY_CHARS = 6000;
const MIN_REPLY_CHARS = 50;
const MAX_TOKENS = 2500;   // Opus hit the 1600 ceiling and failed; Sonnet writes longer than Haiku too

const NEXT_STEPS_SYSTEM = `You are CONTEXA, embedded in claude.ai. You see the user's last message and Claude's reply. Propose the most useful next messages the user could send to move the work forward — the ones you would suggest if you were their sharpest collaborator looking at this exact conversation. Return BETWEEN THREE AND FIVE steps: as many as genuinely earn a place, and no more.
Each step has TWO parts:
- "label": AT MOST 6 WORDS. This is all the user sees on a small chip, so it must be instantly scannable: verb-first, imperative, plain language, no trailing punctuation, no category names. Keep the distinctive part of the idea in the label — never pad with generic verbs. All labels must be obviously different from each other at a glance. Examples of the right shape: "Write the hero copy", "Challenge my social-proof assumption", "Compare KV guard versus token bucket".
- "text": the full prompt loaded into the user's composer when they click the chip. This is where the value lives. ONE outcome per prompt — never bundle two asks or two questions. Shape it as a short imperative line stating the ask, then, when that ask has constraints worth pinning down, two to four tight bullets each on its own line starting with "- ", specifying format, length, count, or what to avoid. Put a real newline between lines by using \n inside the JSON string. Bullets specify a SINGLE outcome; they are never a list of separate requests. Up to 320 characters including bullets. Short sentences, no filler. Write it in the user's own voice, first person, ready to send verbatim. Start with the ask: no persona preamble, no scene-setting, no meta commentary, no "you could ask". Use the imperative for prompts that request work, and a direct question when the point is to challenge an assumption or force a decision — a challenge needs no bullets.
The label is a handle for the text; the text must deliver on what the label promises.
CRITICAL: the text is a message the USER sends to Claude. Never write a step that asks the user a question or requests information only the user could know ("what is your current production limit?"). If a step needs a fact the user has not given, have the user state an assumption or ask Claude for something checkable instead.
Step texts are prose. Refer to code by its name and location — a function, a file, a line — and when a step's outcome is new or changed code, the text asks Claude to write it rather than containing it. A step text never includes code lines or snippets.
Rules for choosing them:
- Be specific to THIS conversation. Reference the actual content of the reply — its structure, its gaps, the decision it leaves open. Never generic advice that would fit any conversation.
- Assume the user is competent and has already thought of the obvious next step. Whatever anyone would type straight after reading this reply does not deserve a slot. Spend every slot on something they probably have not considered.
- Never suggest something the conversation already contains. If the reply already states it, lists it, explains it, or offers to do it next, asking for it again is wasted. Treat everything in the reply as already known to the user.
- Make every step a genuinely different move, never two phrasings of one idea. Cover distinct ground; a strong set usually draws from: going deeper on the most valuable part, resolving what the reply assumed or left ambiguous, the practical action that produces the real artifact, a different framing worth considering, and pressure-testing it (risks, failure modes, what is missing).
- Quality decides the count, not the maximum. Three strong steps beat five with two fillers. Omit any step that restates the reply, that you would not click yourself, or that exists only to reach five. Returning three is a correct answer, not a failure.
- The FIRST step must CHANGE the user's plan, not execute it. It must do one of these four things: question whether the work is needed at all, reframe the problem so a cheaper or better solution becomes visible, force a decision rule before more work happens, or replace reasoning with a concrete measurement. A step that implements, continues, or answers the plan already on the table is valuable but belongs in positions two to five — never first.
- If Claude asked the user a question, one step should answer it well, placed from second position onward, unless answering it also satisfies the rule above.
- Order the remaining steps by leverage: the one that most changes what the user does next comes earliest. The user reads left to right and often clicks only the first.
Reply with ONLY minified JSON containing three to five items: {"steps":[{"label":"...","text":"..."},{"label":"...","text":"..."},{"label":"...","text":"..."}]}`;

/* ---------------------------------------------------------------- helpers */

const CORS_BASE = {
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type, x-cx-device',
  'access-control-max-age': '86400'
};

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = allowedOrigins(env);
  // Only echo an origin we actually allow; never reflect arbitrary origins.
  const allow = allowed.length === 0
    ? (origin.startsWith('chrome-extension://') ? origin : '')
    : (allowed.includes(origin) ? origin : '');
  return allow ? { ...CORS_BASE, 'access-control-allow-origin': allow, vary: 'Origin' } : { ...CORS_BASE };
}

function allowedOrigins(env) {
  const ids = String(env.ALLOWED_EXTENSION_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return ids.map(id => `chrome-extension://${id}`);
}

function originAllowed(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = allowedOrigins(env);
  if (allowed.length) return allowed.includes(origin);
  // Not yet pinned to your published extension ID: accept any extension origin.
  // Pin ALLOWED_EXTENSION_IDS before launch so only your extension can spend.
  return origin.startsWith('chrome-extension://');
}

/* no-store is not cosmetic. /v1/health is a GET with a 200 body, so an edge or
   any intermediary is free to cache it — which it did, and a stale health body
   reported an old build as live. An endpoint whose only job is saying what is
   deployed must never be served from a cache. */
function json(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...corsHeaders(request, env)
    }
  });
}

function utcDay() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, resets midnight UTC
}

// Valid ISO 8601: hours only go 0-23, so "T24:00:00Z" would fail Date.parse().
function nextUtcMidnight() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* KV counter. Eventually consistent, which is fine for a soft quota — a user
   racing parallel requests might get a couple extra. Swap in a Durable Object
   if you ever need exact counting. */
async function bumpQuota(env, key, limit) {
  const used = parseInt((await env.CX_KV.get(key)) || '0', 10) || 0;
  if (used >= limit) return { ok: false, used, limit };
  await env.CX_KV.put(key, String(used + 1), { expirationTtl: KV_TTL_SECONDS });
  return { ok: true, used: used + 1, limit };
}

/* Enough to identify why a response could not be parsed, with no conversation
   content in it. `blocks` is the decisive field: if the budget was spent on
   content types other than `text`, the text body is short while `out` is at the
   ceiling, and no amount of extra max_tokens fixes that. */
function diagnose(data, text) {
  return {
    stop: data.stop_reason || null,
    out: data.usage ? data.usage.output_tokens : null,
    in: data.usage ? data.usage.input_tokens : null,
    ceiling: MAX_TOKENS,
    len: text.length,
    hadJson: text.indexOf('{') >= 0,
    steps: (text.match(/"label"\s*:/g) || []).length,   // how far it actually got
    blocks: [...new Set((data.content || []).map(b => b.type || 'unknown'))]
  };
}

/* Same tolerant JSON parsing the extension uses: models sometimes fence their
   output, prepend a sentence, or get cut off mid-object. */
function extractJson(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = t.indexOf('{');
  if (start < 0) throw new Error('no JSON');
  const end = t.lastIndexOf('}');
  if (end > start) { try { return JSON.parse(t.slice(start, end + 1)); } catch {} }
  const stack = [];
  let inStr = false, esc = false, safeIdx = -1, safeStack = null;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      stack.pop();
      if (stack.length) { safeIdx = i; safeStack = stack.slice(); }
    }
  }
  if (safeIdx > 0 && safeStack) {
    try { return JSON.parse(t.slice(start, safeIdx + 1) + safeStack.reverse().join('')); } catch {}
  }
  throw new Error('unparseable JSON');
}


/* Payloads are now multi-line with bullets, and models overshoot the stated cap.
   A blind slice() cuts mid-word and ships visibly broken text ("...without users
   notici"), so trim at the last clean boundary instead: prefer a whole line, then
   a sentence, then a word. The ceiling is generous so realistic bulleted payloads
   pass through untouched. */
const MAX_PAYLOAD_CHARS = 600;
function trimPayload(value) {
  const t = String(value || '').trimEnd();
  if (t.length <= MAX_PAYLOAD_CHARS) return t;
  const cut = t.slice(0, MAX_PAYLOAD_CHARS);
  const nl = cut.lastIndexOf('\n');
  if (nl > MAX_PAYLOAD_CHARS * 0.5) return cut.slice(0, nl).trimEnd();
  const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  if (dot > MAX_PAYLOAD_CHARS * 0.5) return cut.slice(0, dot + 1).trimEnd();
  const sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.slice(0, sp) : cut).trimEnd();
}

/* ------------------------------------------------------------------ worker */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (url.pathname === '/v1/health') {
      // version + model make a deploy verifiable from outside. Without them you
      // cannot tell a successful deploy from a no-op except by watching a reply.
      return json({
        ok: true,
        version: BUILD,
        model: env.MODEL || MODEL,
        limit: DEVICE_DAILY_LIMIT,
        configured: !!env.ANTHROPIC_API_KEY
      }, 200, request, env);
    }
    if (url.pathname !== '/v1/next-steps') return json({ error: 'not_found' }, 404, request, env);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, request, env);
    if (!originAllowed(request, env)) return json({ error: 'forbidden_origin' }, 403, request, env);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'server_not_configured' }, 500, request, env);

    // device token: opaque, generated client-side, never tied to an identity
    const device = String(request.headers.get('x-cx-device') || '');
    if (!/^[A-Za-z0-9-]{16,64}$/.test(device)) {
      return json({ error: 'bad_device_token' }, 400, request, env);
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad_request' }, 400, request, env); }

    // clamp server-side: the client cannot make a request more expensive
    const prompt = String(body.prompt || '').slice(0, MAX_PROMPT_CHARS);
    const reply = String(body.reply || '').slice(0, MAX_REPLY_CHARS);
    if (reply.trim().length < MIN_REPLY_CHARS) {
      return json({ error: 'reply_too_short' }, 400, request, env);
    }

    const day = utcDay();

    // IP axis first (cheaper to reject, and catches token recycling)
    const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
    const ipKey = 'ip:' + (await sha256Hex(ip + '|' + (env.IP_SALT || 'contexa'))).slice(0, 32) + ':' + day;
    const ipQuota = await bumpQuota(env, ipKey, IP_DAILY_LIMIT);
    if (!ipQuota.ok) {
      return json({ error: 'quota_ip', limit: IP_DAILY_LIMIT, resetsAt: nextUtcMidnight() }, 429, request, env);
    }

    const devKey = 'q:' + device + ':' + day;
    const quota = await bumpQuota(env, devKey, DEVICE_DAILY_LIMIT);
    if (!quota.ok) {
      return json({
        error: 'quota', used: quota.used, limit: DEVICE_DAILY_LIMIT,
        resetsAt: nextUtcMidnight()
      }, 429, request, env);
    }

    // upstream call — your key, never exposed to the client
    let upstream;
    try {
      upstream = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: env.MODEL || MODEL,
          max_tokens: MAX_TOKENS,
          system: NEXT_STEPS_SYSTEM,
          messages: [{
            role: 'user',
            content: 'USER MESSAGE:\n' + (prompt || '(not captured)') + '\n\nCLAUDE REPLY:\n' + reply
          }]
        })
      });
    } catch (e) {
      return json({ error: 'upstream_unreachable' }, 502, request, env);
    }

    if (!upstream.ok) {
      // Deliberately do not forward the upstream body: it can contain account
      // details, and a client has no use for them.
      const status = upstream.status === 429 ? 503 : 502;
      return json({ error: 'upstream_' + upstream.status }, status, request, env);
    }

    let data;
    try { data = await upstream.json(); } catch { return json({ error: 'upstream_bad_json' }, 502, request, env); }
    const text = (data.content || []).map(b => b.text || '').join('');

    let parsed;
    try { parsed = extractJson(text); } catch {
      /* A parse failure used to return a bare error code and drop the response on
         the floor, which made "truncated" undiagnosable: it cannot distinguish an
         empty text body from a model that narrated instead of emitting JSON from
         one that wrote an enormous first step. These four numbers separate all
         three, and none of them contain conversation content. */
      const diag = diagnose(data, text);
      // Full text goes to `wrangler tail` only (live stream, not stored) — the
      // client has no use for it and it echoes the user's conversation.
      console.log('[CONTEXA] parse failure', JSON.stringify(diag),
        'text[0,300]=', JSON.stringify(text.slice(0, 300)));
      return json({
        error: data.stop_reason === 'max_tokens' ? 'truncated' : 'bad_json',
        diag
      }, 502, request, env);
    }

    const steps = Array.isArray(parsed.steps)
      ? parsed.steps
          .filter(s => s && typeof s.text === 'string' && s.text.trim())
          .slice(0, 5)
          .map(s => ({ label: String(s.label || '').slice(0, 80), text: trimPayload(s.text) }))
      : [];
    if (!steps.length) {
      // Parsed but empty is its own failure and deserves the same evidence.
      const diag = diagnose(data, text);
      console.log('[CONTEXA] parsed but no usable steps', JSON.stringify(diag));
      return json({ error: 'no_steps', diag }, 502, request, env);
    }

    /* A partial salvage hit the same ceiling as a hard failure — the only
       difference is where the cut happened to fall. It needs the same evidence.
       (Instrumenting only the two failure branches was a gap: the very next
       ceiling-hit arrived on this branch, carrying no numbers.) Log the LAST 300
       characters, not the first: on this branch the JSON started fine, and the
       question is what the model was writing when the budget ran out — a sixth
       step, an oversized text, or trailing prose. */
    if (data.stop_reason === 'max_tokens') {
      const diag = diagnose(data, text);
      console.log('[CONTEXA] partial salvage', JSON.stringify(diag),
        'kept=' + steps.length, 'text[-300]=', JSON.stringify(text.slice(-300)));
      return json({
        steps,
        quota: { used: quota.used, limit: DEVICE_DAILY_LIMIT },
        partial: true,
        diag
      }, 200, request, env);
    }

    return json({
      steps,
      quota: { used: quota.used, limit: DEVICE_DAILY_LIMIT }
    }, 200, request, env);
  }
};
