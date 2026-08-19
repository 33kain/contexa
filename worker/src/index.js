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

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';

// Quotas. Client values are never trusted; these are the only limits that count.
const DEVICE_DAILY_LIMIT = 20;
const IP_DAILY_LIMIT = 60;      // second axis: blunts reinstall-for-fresh-token abuse
const KV_TTL_SECONDS = 60 * 60 * 48;

// Cost guards: a request can never be larger than this, whatever the client sends.
const MAX_PROMPT_CHARS = 2500;
const MAX_REPLY_CHARS = 6000;
const MIN_REPLY_CHARS = 50;
const MAX_TOKENS = 1600;

const NEXT_STEPS_SYSTEM = `You are CONTEXA, embedded in claude.ai. You see the user's last message and Claude's reply. Propose the most useful next messages the user could send to move the work forward — the ones you would suggest if you were their sharpest collaborator looking at this exact conversation. Return BETWEEN THREE AND FIVE steps: as many as genuinely earn a place, and no more.
Each step has TWO parts:
- "label": AT MOST 6 WORDS. This is all the user sees on a small chip, so it must be instantly scannable: verb-first, imperative, plain language, no trailing punctuation, no category names. Keep the distinctive part of the idea in the label — never pad with generic verbs. All labels must be obviously different from each other at a glance. Examples of the right shape: "Write the hero copy", "Challenge my social-proof assumption", "Compare KV guard versus token bucket".
- "text": the full prompt loaded into the user's composer when they click the chip. This is where the value lives. ONE outcome per prompt — never bundle two asks or two questions. Be concrete: name the deliverable, the format, the length, or the constraint. Short sentences. Up to 220 characters. Write it in the user's own voice, first person, ready to send verbatim. Start with the ask: no persona preamble, no scene-setting, no meta commentary, no "you could ask". Use the imperative for prompts that request work, and a direct question when the point is to challenge an assumption or force a decision.
The label is a handle for the text; the text must deliver on what the label promises.
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

function json(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(request, env) }
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

/* ------------------------------------------------------------------ worker */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (url.pathname === '/v1/health') {
      return json({ ok: true, limit: DEVICE_DAILY_LIMIT, configured: !!env.ANTHROPIC_API_KEY }, 200, request, env);
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
      return json({ error: data.stop_reason === 'max_tokens' ? 'truncated' : 'bad_json' }, 502, request, env);
    }

    const steps = Array.isArray(parsed.steps)
      ? parsed.steps
          .filter(s => s && typeof s.text === 'string' && s.text.trim())
          .slice(0, 5)
          .map(s => ({ label: String(s.label || '').slice(0, 80), text: String(s.text).slice(0, 400) }))
      : [];
    if (!steps.length) return json({ error: 'no_steps' }, 502, request, env);

    return json({
      steps,
      quota: { used: quota.used, limit: DEVICE_DAILY_LIMIT },
      partial: data.stop_reason === 'max_tokens' || undefined
    }, 200, request, env);
  }
};
