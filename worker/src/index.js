/* CONTEXA API — Cloudflare Worker.
   A thin proxy so users never need their own Anthropic key. It holds YOUR key
   as a secret, enforces per-device and per-IP daily quotas, and clamps input
   size so a malicious client cannot run up your bill.

   Endpoints:
     POST /v1/next-steps  -> { steps: [{label, text}], quota: {used, limit} }
     POST /v1/expand      -> { prompt, quota: {used, limit} }   (the fifth chip)
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
const BUILD = '0.9.28';

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

// The fifth chip: one drafted prompt, not five steps — a smaller ceiling, and a
// typed intent can never be longer than the input field allows client-side.
const MAX_INTENT_CHARS = 300;
const EXPAND_MAX_TOKENS = 1200;
const MAX_EXPANSION_CHARS = 900;   // hard cap; the prompt's own soft target is 700

/* CAPABILITY-AUDIT: 2026-08-22 — re-check the capability moves in NEXT_STEPS_SYSTEM
   against the real product. build.mjs warns once this date is over 120 days old.
   Capability knowledge lives in OUR exemplars, not in the model's training, so
   staleness is ours to manage and nothing else will report it. */
const NEXT_STEPS_SYSTEM = `You are CONTEXA, embedded in claude.ai. You see the user's last message and Claude's reply. Your job: write the messages this user would send next if they knew everything the assistant knows about what would improve the next turn — and prove each one from the reply's own words.
The capture of the reply may end with the line "[capture window ends here — the reply continues beyond this point]". That line is the edge of your viewport, not a defect in the reply. Never mention it, never describe the reply as cut off, and never ask for the continuation. Evidence must come from before it.
Return BETWEEN THREE AND FIVE steps. Three is the floor. A reply almost always affords at least three genuinely different moves — before settling for fewer, reread it for what it assumed without saying so, what it left open, what it finished that could be pressure-tested, and what it never considered. Returning fewer than three means you stopped searching too early. The floor is an obligation to search harder, never a licence to pad: a restatement in slot three is worse than no slot three.
EVERY step must be earned by a verbatim fragment of the reply — the hedge it collapses, the request it fulfills, the options-language it commits, the completed claim it redirects. Put that fragment in the step's "evidence" field: at most 90 characters, copied exactly, never paraphrased. No quotable evidence, no step.
Moves that usually win — examples of the principle, NOT categories to fill; a set with one of each is almost certainly padded:
- Supply what the reply says it lacks. Evidence: its own request or inference-admission ("I'd need to see", "without knowing your", "assuming your setup"). Name the artifact, pin scope and format, mark the insertion point with <paste here>. Model: "The current prompts — system prompt, any instruction files, tool/function definitions. The actual text, not a summary. <paste here>". Write it so it works even unclicked, as a checklist of what to provide.
- Collapse a fork the reply planted. Evidence: its conditional language ("if you're on", "depending on whether", "either"). Start with "Assume", state the most plausible branch concretely, then direct the redo under exactly that. The user edits the assumption before sending if it is wrong. At most two per set. Model, when the reply asks which branch the user is on: "Assume the deploy already landed and the worker reports the new build. Redo the checklist for that case only." Never write "The deploy already landed" as a plain statement — you cannot see their machine.
- Invite Claude's questions. Evidence: the reply fills gaps with guesses, stacked assumptions, or a broad survey of an underspecified goal — the forks are invisible rather than visible. Write the message that flips the question burden: direct Claude to ask the user everything it needs to fully understand the goal before doing more work. Model: "Ask me everything you need to know to get this right — one focused list, then wait for my answers before continuing." Use a decree when a fork is visible; invite questions when the forks are invisible. At most one per set.
- Grant commitment. Evidence: options-language or a hedged survey. Direct the assistant to pick the option it would choose itself and produce the complete version — no alternatives section, no abbreviations, nothing left as an option.
- Redirect the angle. Evidence: a finished claim, plan, or design standing in the reply. Rebuild under the opposite assumption, argue against it and keep only what survives, or optimize for a different constraint. Aim at the WORK, never at quizzing the user. At most one per set, and only when the reply contains finished work.
- Recast the problem. Evidence: the goal, artifact, or constraint the reply is working toward, quoted in its own words. Propose the angle the conversation has not tried — solve it a cheaper way, borrow a working pattern from a different domain, invert the constraint, or ask what would make the task unnecessary. This is the one move free to name something the reply never mentioned, provided it aims squarely at the work the reply is doing. At most one per set.
When the exchange reads like the OPENING of a task — a broad request met by a first-pass answer resting on guessed scope, audience, or purpose — the set leans foundation-first: an invite-questions step and decrees that pin what the work is, who it is for, why it matters, and the one key action or outcome it must serve. Vague foundations compound; settle them before continuation steps.
Capability moves — a separate and rarer class, and a set is never obliged to contain one. At most ONE per set, and only when the reply itself shows the symptom: no symptom, no capability move, and three good requisition steps always beat two plus a padded capability step. These are for the user who has never set up the part of Claude that would fix what the reply is visibly struggling with. They obey every rule above — quotable evidence, text addressed to Claude, never instructions aimed at the user. No click-paths, no menu names, no settings. Where the prepared material goes is asked OF Claude, never stated by you.
- Set up a project. Evidence: the reply re-explains or re-requests context this conversation already established — a second ask for the same background, or a restatement of what it was already told. Model: "Write the project instructions for this work so I stop re-explaining it: the context you need from me, the tone, the constraints, and what to always ask first. Under 150 words, ready to paste — and tell me in one line where it goes."
- Lock in my style. Evidence: the reply acknowledges a repeated correction to its tone, length or format ("shorter this time", "without the headers", "more direct"). Model: "Turn the corrections I've made in this chat into a reusable style: 5 to 8 specific rules in my own words, nothing generic. Ready to paste — and tell me in one line where to save it so every new chat starts there."
- Work from real data. Evidence: the reply reasons from the user's description of a file, export or dataset rather than the thing itself ("based on what you've described", "if your file has", "assuming it contains"). Model: "List exactly what to upload so you work from the real thing instead of my description: which file or export, what it must contain, and what you check first once you have it. <attach here>"
Those three are the whole class. Never invent a fourth capability, never name a feature by a button or a menu, and never offer the same capability twice in a row in one conversation.
Ordering, by friction and leverage:
- If the reply explicitly requests input or states it is reasoning without something, the supply step goes FIRST.
- Otherwise slot one goes to the highest-leverage step the user can send within seconds, unedited or after touching one assumption.
- At most one step per set may require the user to gather and paste material; when it is not first, it goes last.
- Remaining steps order by how much they advance the work. Most users read only the first step.
Hard rules:
- Directive is the default shape. A step may be question-form ONLY when the question is aimed at Claude and is the sharpest form of the ask ("What breaks first under 10x load?"). NEVER a question aimed at the user or one that needs the user's knowledge to answer — if only the user knows it, decree it or invite Claude to ask.
- A step never states a fact only the user can know — what they did, when they did it, what happened on their machine, which branch they are on — as though you had observed it. Mark it instead: begin that sentence with "Assume" so the user can strike it before sending, or leave the unknown as <a slot in angle brackets>. A decree that hides its assumption is the defect this rule exists to prevent.
- The text always addresses Claude. When an action can only be done by the user — running a command on their machine, clicking, waiting, pasting — the text directs Claude to prepare or verify Claude's side of it; it never commands Claude to perform the user's action and never contains instructions aimed at the user.
- Ground every step in THIS reply's actual content. Never re-request anything the reply already delivered. One move per step; no two steps are the same move rephrased.
Each step has THREE parts:
- "label": AT MOST 4 WORDS, verb-first, plain language, no punctuation. All labels obviously different at a glance.
- "text": the full prompt loaded into the composer, ready to send verbatim, up to 280 characters. Name the thing, then pin scope and format. Short lines, with \n between lines inside the JSON string when structure helps; inline lists are fine; no preamble, no meta commentary. Step texts are prose. Refer to code by its name and location — a function, a file, a line — and when a step's outcome is new or changed code, the text directs Claude to write it rather than containing it. A step text never includes code lines or snippets.
- "evidence": the verbatim reply fragment that earned this step, at most 90 characters.
Reply with ONLY minified JSON: {"steps":[{"label":"...","text":"...","evidence":"..."}]} with three to five items.`;

/* The fifth chip (0.9.23): rough ask in, well-formed prompt out. Fixes FORM
   (scope, format, anti-goals, inert adjectives), never invents CONTENT —
   missing decisions surface as <slots> and "Assume:" lines the user edits.
   MUST stay byte-identical to the copy in extension/background.js;
   build.mjs enforces it exactly like NEXT_STEPS_SYSTEM. */
const EXPAND_SYSTEM = `You are CONTEXA's prompt writer, embedded in claude.ai. The user typed a rough ask. Rewrite it as the message they would send if they wrote prompts for a living: same intent, same voice, more decidable. You also see their last message and Claude's reply for context.
Input sections: ROUGH ASK (what they typed), THEIR LAST MESSAGE, CLAUDE'S REPLY. The reply may end with the line "[capture window ends here — the reply continues beyond this point]" — that is the edge of your viewport, not a defect; never mention it.
Write the prompt as the user, in first person, addressed to Claude, ready to send verbatim. No persona preamble, no meta commentary, no politeness padding.
Rules, in order of force:
- Preserve exactly what the user asked for. Never add a second ask they did not state, never drop part of what they did state.
- Start with an imperative line stating the outcome. If the rough ask is a challenge or a question, keep it a question — aimed at Claude, never at the user.
- If Claude's reply is what the ask acts on, name the actual thing from the reply — the file, the section, the claim, the number — using the reply's own words for anything factual. If the rough ask is unrelated to the reply, ignore the reply completely.
- Make scope explicit when the conversation makes it inferable: what to change, and what to leave unchanged. Phrase anti-goals positively ("leave the visible copy unchanged"), not as warnings.
- Add format, length, or count constraints only when the intent or the conversation implies them. Never invent numbers, names, keywords, or file paths that appear nowhere.
- When a material fact only the user knows is missing, put a slot in angle brackets, like <main keyword> — at most 2 slots. When a reasonable default is worth surfacing, add a final line starting "Assume:" — at most 2. Never bake a silent choice into the prompt.
- Never use filler quality words: thorough, careful, carefully, properly, really, robust, comprehensive, high-quality, detailed, best. They change nothing. Constraints change things.
- If the rough ask is already a good prompt, return it nearly verbatim with only mechanical fixes. Longer without more decidable is failure.
- If expansion would need more than two slots, the ask is not expandable. Output instead, in the user's voice: "I want help with <topic>. Ask me everything you need to know to get this right — one focused list, then wait for my answers before continuing."
- At most 700 characters. Short sentences. When constraints deserve their own lines, start each with "- " and put a real newline between lines by writing \\n inside the JSON string.
Examples of the right shape:
ROUGH ASK: optimize seo & meta (Claude just built a landing page)
PROMPT: Optimize the SEO of the page you just built. Work only inside <head> and the heading structure — leave the visible copy unchanged.
- title tag and meta description targeting <main keyword>
- Open Graph and Twitter card tags
- one h1, logical h2/h3 order
Show the changed lines only.
Assume: single-page site with no domain yet, so skip canonical URLs.
ROUGH ASK: make it shorter (after a long explanation)
PROMPT: Rewrite your last answer at a third of the length. Keep the store-review warning and the cost numbers; drop the background on how tokenizers work. Plain paragraphs, no headers.
ROUGH ASK: is this actually secure (after Claude proposed an architecture)
PROMPT: Attack your own proposal before I build it. Where does the origin check fail, what can a malicious page do with the open health endpoint, and which assumption is weakest? Name concrete attacks, not categories — and if one is fatal, say so plainly.
ROUGH ASK: email to my landlord about deposit (unrelated to the reply)
PROMPT: Draft an email to my landlord asking for my deposit back.
- moved out <date>; the deposit was <amount>
- firm but polite, under 150 words
- cite the handover inspection we did together
Assume: this is my first written request.
ROUGH ASK: deployed, works (after a reply that listed five checks to run)
PROMPT: Deployed and the worker is live. Go ahead with the release ceremony next.\nAssume: all five field checks passed as you listed them — I will say so if any did not.

ROUGH ASK: marketing (nothing relevant in the reply)
PROMPT: I want help with marketing. Ask me everything you need to know to get this right — one focused list, then wait for my answers before continuing.
Reply with ONLY minified JSON: {"prompt":"..."}`;


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
function diagnose(data, text, ceiling = MAX_TOKENS) {
  return {
    stop: data.stop_reason || null,
    out: data.usage ? data.usage.output_tokens : null,
    in: data.usage ? data.usage.input_tokens : null,
    ceiling,
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
/* Same clean-boundary trim for the fifth chip's drafted prompt, at its own cap.
   A draft that blows the cap is a prompt-discipline failure upstream; trimming
   at a line or sentence keeps what ships readable either way. */
function trimExpansion(value) {
  const t = String(value || '').trim();
  if (t.length <= MAX_EXPANSION_CHARS) return t;
  const cut = t.slice(0, MAX_EXPANSION_CHARS);
  const nl = cut.lastIndexOf('\n');
  if (nl > MAX_EXPANSION_CHARS * 0.5) return cut.slice(0, nl).trimEnd();
  const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  if (dot > MAX_EXPANSION_CHARS * 0.5) return cut.slice(0, dot + 1).trimEnd();
  const sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.slice(0, sp) : cut).trimEnd();
}

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
    /* Two POST endpoints, one gate order: origin -> token -> body -> quotas ->
       upstream. /v1/expand is the fifth chip; it shares EVERY gate and the SAME
       daily pool — a rough ask spends exactly what a suggestion row spends. */
    const wantExpand = url.pathname === '/v1/expand';
    if (url.pathname !== '/v1/next-steps' && !wantExpand) return json({ error: 'not_found' }, 404, request, env);
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
    let intent = '';
    if (wantExpand) {
      // A rough ask is required; the reply is NOT — "email to my landlord"
      // legitimately ignores the conversation entirely.
      intent = String(body.intent || '').trim().slice(0, MAX_INTENT_CHARS);
      if (!intent) return json({ error: 'bad_request' }, 400, request, env);
    } else if (reply.trim().length < MIN_REPLY_CHARS) {
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
    /* thinking disabled: Sonnet 5 defaults to adaptive thinking and once spent
       the entire output budget thinking, emitting zero text. If MODEL is ever
       pointed at a thinking-mandatory model (Fable/Mythos reject the disable
       with a 400), retry once without the field — model-agnostic, no list. */
    const upstreamPayload = wantExpand
      ? {
          model: env.MODEL || MODEL,
          max_tokens: EXPAND_MAX_TOKENS,
          thinking: { type: 'disabled' },
          system: EXPAND_SYSTEM,
          messages: [{
            role: 'user',
            // Section labels MUST match extension/background.js byte-for-byte —
            // hosted and own-key users get the same product. Pinned by tests
            // on both sides.
            content: 'ROUGH ASK:\n' + intent
              + '\n\nTHEIR LAST MESSAGE:\n' + (prompt || '(not captured)')
              + '\n\nCLAUDE\'S REPLY:\n' + (reply || '(none)')
          }]
        }
      : {
          model: env.MODEL || MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: 'disabled' },
          system: NEXT_STEPS_SYSTEM,
          messages: [{
            role: 'user',
            content: 'USER MESSAGE:\n' + (prompt || '(not captured)') + '\n\nCLAUDE REPLY:\n' + reply
          }]
        };
    let upstream, upstreamErrBody = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        upstream = await fetch(ANTHROPIC_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(upstreamPayload)
        });
      } catch (e) {
        return json({ error: 'upstream_unreachable' }, 502, request, env);
      }
      if (upstream.ok) break;
      upstreamErrBody = await upstream.text().catch(() => '');
      // Tail-only: the body can contain account details, so it never reaches
      // the client — but silence here cost a debugging cycle once already.
      console.log('[CONTEXA] upstream error', upstream.status, upstreamErrBody.slice(0, 300));
      if (attempt === 0 && upstream.status === 400 && /thinking/i.test(upstreamErrBody) && upstreamPayload.thinking) {
        console.log('[CONTEXA] model rejected the thinking config — retrying without it');
        delete upstreamPayload.thinking;
        continue;
      }
      break;
    }

    if (!upstream.ok) {
      // Deliberately do not forward the upstream body: it can contain account
      // details, and a client has no use for them. It is in `wrangler tail`.
      const status = upstream.status === 429 ? 503 : 502;
      return json({ error: 'upstream_' + upstream.status }, status, request, env);
    }

    let data;
    try { data = await upstream.json(); } catch { return json({ error: 'upstream_bad_json' }, 502, request, env); }
    const text = (data.content || []).map(b => b.text || '').join('');

    let parsed;
    try { parsed = extractJson(text); } catch (e) {
      if (wantExpand) {
        const diag = diagnose(data, text, EXPAND_MAX_TOKENS);
        console.log('[CONTEXA] expand parse failure', JSON.stringify(diag),
          'text[0,300]=', JSON.stringify(text.slice(0, 300)));
        return json({
          error: data.stop_reason === 'max_tokens' ? 'truncated' : 'bad_json',
          diag
        }, 502, request, env);
      }
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

    /* The fifth chip returns ONE drafted prompt, not steps. Evidence validation
       does not apply — the user typed the intent themselves, so relevance is
       theirs by construction; the prompt's own rules police invention. */
    if (wantExpand) {
      const drafted = trimExpansion(typeof parsed.prompt === 'string' ? parsed.prompt : '');
      if (!drafted) {
        const diag = diagnose(data, text, EXPAND_MAX_TOKENS);
        console.log('[CONTEXA] expand: parsed but no prompt', JSON.stringify(diag));
        return json({ error: 'no_prompt', diag }, 502, request, env);
      }
      return json({
        prompt: drafted,
        quota: { used: quota.used, limit: DEVICE_DAILY_LIMIT }
      }, 200, request, env);
    }

    /* SPEC §2.1/§2.6 — evidence validation. A step with no evidence ignored the
       grounding contract and is dropped; a near-miss quote (whitespace drift)
       renders but is counted and logged. Per-step evidence text goes to
       `wrangler tail` only; the client receives {label, text} plus aggregate
       grounding counts, so the page console can report the rate without any
       reply text leaving the worker's logs. */
    const normWs = s => String(s || '').replace(/\s+/g, ' ').trim();
    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
    const withEv = rawSteps.filter(s =>
      s && typeof s.text === 'string' && s.text.trim() && normWs(s.evidence));
    const normReply = normWs(reply);
    let grounded = 0;
    for (const s of withEv) {
      if (normReply.includes(normWs(s.evidence))) grounded++;
      else console.log('[CONTEXA] ungrounded chip', JSON.stringify(String(s.label || '').slice(0, 40)));
    }
    console.log('[CONTEXA] evidence', JSON.stringify(withEv.map(s => String(s.evidence).slice(0, 90))));
    const steps = withEv
      .slice(0, 5)
      .map(s => ({ label: String(s.label || '').slice(0, 80), text: trimPayload(s.text) }));
    const grounding = { total: rawSteps.length, kept: steps.length, grounded };
    if (!steps.length) {
      // Parsed but nothing usable — including the case where every step
      // ignored the evidence contract. Same treatment, same evidence trail.
      const diag = diagnose(data, text);
      console.log('[CONTEXA] parsed but no usable steps', JSON.stringify(diag), 'rawSteps=' + rawSteps.length);
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
        grounding,
        quota: { used: quota.used, limit: DEVICE_DAILY_LIMIT },
        partial: true,
        diag
      }, 200, request, env);
    }

    return json({
      steps,
      grounding,
      quota: { used: quota.used, limit: DEVICE_DAILY_LIMIT }
    }, 200, request, env);
  }
};
