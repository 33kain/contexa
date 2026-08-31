/* CONTEXA worker tests — no network, no Cloudflare account needed.
   Run from the worker/ directory:  node test.mjs
   Exercises the properties that protect your bill: nothing reaches Anthropic
   unless the request passed origin, token, size and quota checks. */

const w = (await import('./src/index.js')).default;
const { readFileSync } = await import('node:fs');
/* Resolve sibling files against THIS FILE, never the cwd: release-commit.ps1
   runs `node worker\\test.mjs` from the repo root while the header above says
   to run it from worker/. A bare '../extension/...' is correct in exactly one
   of those and silently wrong in the other. */
const rel = p => new URL(p, import.meta.url);

/* fake KV: enough of the interface for bumpQuota */
function makeKV(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    store: m,
    get: async k => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => { m.set(k, String(v)); },
  };
}
const DEV = 'a'.repeat(32);
/* The default session every request carries unless a test overrides it. There
   used to be three post helpers here, one per client generation, and each
   assertion had to declare which one it was testing — a single default would
   have hidden the 0.9.30 break. The pivot left one shape, so there is one
   helper; what a test declares now is the SESSION, which is the input that
   actually varies. */
const TURNS = [
  { i: 1, text: 'make me a website for my bakery' },
  { i: 2, text: 'can you add the opening hours' },
  { i: 3, text: 'now the menu page' }
];

function post(body = {}) {
  body = Object.assign({ reply: 'r'.repeat(120), turns: TURNS }, body);
  return new Request('https://x/v1/next-steps', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cx-device': DEV, origin: 'chrome-extension://abc' },
    body: JSON.stringify(body)
  });
}

let upstream = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { upstream++; throw new Error('upstream should not be reached in these tests'); };

const fails = [];
/* The system prompt travels as either a plain string or an array of cached
   content blocks (see cachedSystem in the worker). Assertions about what the
   prompt SAYS must not care which — otherwise every content test doubles as an
   accidental transport test and breaks the day the transport changes, which is
   exactly what happened on 2026-08-27. Shape is asserted separately and
   explicitly below, so removing caching still fails loudly. */
const sysText = (v) => Array.isArray(v) ? v.map(b => b && b.text || '').join('') : String(v || '');

const t = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!cond) fails.push(name);
};

/* 1. health */
let r = await w.fetch(new Request('https://x/v1/health'), { ANTHROPIC_API_KEY: 'k', MODEL: 'claude-sonnet-5' });
let b = await r.json();
const BUILD_SEEN = b.version;
/* The device ceiling is READ FROM THE PRODUCT, never retyped here. It used to be
   the literal 20 in three places; when PROMPTS_PER_DAY arrived and the call
   ceiling became 40, all three failed — not because behaviour broke but because
   the tests had pinned a VALUE where the requirement was a RULE. `/v1/health`
   already reports the limit, so the suite asks rather than assumes, and the
   next change to the allowance will not touch this file at all. */
const LIMIT = b.limit;
t('health reports the device limit as a positive number',
  Number.isInteger(LIMIT) && LIMIT > 0, String(LIMIT));
t('the call ceiling is an even number of calls — a finished prompt costs two',
  LIMIT % 2 === 0, String(LIMIT));
t('health reports version', /^\d+\.\d+\.\d+$/.test(b.version || ''), b.version);
t('health is uncacheable', r.headers.get('cache-control') === 'no-store', String(r.headers.get('cache-control')));
t('health reports model', b.model === 'claude-sonnet-5', b.model);
t('health reports configured', b.configured === true);

/* 2. device quota exhausted -> 429, valid ISO, no spend */
const day = new Date().toISOString().slice(0, 10);
const kv = makeKV({ ['q:' + DEV + ':' + day]: String(LIMIT) });
upstream = 0;
r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: kv, IP_SALT: 's' });
b = await r.json();
t('device quota returns 429', r.status === 429, String(r.status));
t('resetsAt parses as a date', Number.isFinite(Date.parse(b.resetsAt || '')), String(b.resetsAt));
t('resetsAt is in the future', Date.parse(b.resetsAt) > Date.now());
t('no upstream call when quota gone', upstream === 0, 'calls=' + upstream);

/* 3. reply too short -> rejected before spend */
upstream = 0;
r = await w.fetch(post({ prompt: 'p', reply: 'tiny' }), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
t('short reply rejected', r.status >= 400, String(r.status));
t('short reply costs nothing', upstream === 0, 'calls=' + upstream);

/* 4. bad device token -> 400 */
r = await w.fetch(new Request('https://x/v1/next-steps', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-cx-device': 'short', origin: 'chrome-extension://abc' },
  body: JSON.stringify({ prompt: 'p', reply: 'r'.repeat(120) })
}), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
t('bad device token rejected', r.status === 400, String(r.status));

/* 5. missing key -> 500 server_not_configured, no spend */
upstream = 0;
r = await w.fetch(post(), { CX_KV: makeKV(), IP_SALT: 's' });
b = await r.json();
t('no server key -> server_not_configured', b.error === 'server_not_configured', String(b.error));
t('no server key costs nothing', upstream === 0);

/* 5b. no Origin header at all -> 403 (only the extension may call this) */
r = await w.fetch(new Request('https://x/v1/next-steps', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-cx-device': DEV },
  body: JSON.stringify({ prompt: 'p', reply: 'r'.repeat(120) })
}), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
t('originless request rejected', r.status === 403, String(r.status));

/* 6. unknown route */
r = await w.fetch(new Request('https://x/nope'), {});
t('unknown route 404', r.status === 404, String(r.status));


/* ---- 10. parse failures now carry evidence ------------------------------- */
{
  const cases = [
    { name: 'empty text body (budget spent on non-text)',
      content: [{ type: 'thinking', thinking: 'x'.repeat(50) }], stop: 'max_tokens',
      usage: { input_tokens: 900, output_tokens: 2500 },
      expect: d => d.len === 0 && d.hadJson === false && d.out === 2500 && !d.blocks.includes('text') },
    { name: 'prose, never started JSON',
      content: [{ type: 'text', text: 'Let me think about the best next steps here.' }], stop: 'max_tokens',
      usage: { input_tokens: 900, output_tokens: 2500 },
      expect: d => d.hadJson === false && d.len > 0 && d.steps === 0 },
    { name: 'JSON opened, first move never closed',
      content: [{ type: 'text', text: '{"moves":[{"label":"Add a contact for' }], stop: 'max_tokens',
      usage: { input_tokens: 900, output_tokens: 2500 },
      expect: d => d.hadJson === true && d.steps === 1 },
  ];
  for (const c of cases) {
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      async json() { return { content: c.content, stop_reason: c.stop, usage: c.usage }; },
      async text() { return ''; }
    });
    const r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
    const b = await r.json();
    t(`diag: ${c.name}`, b.error === 'truncated' && b.diag && c.expect(b.diag),
      JSON.stringify(b.diag));
  }
  // diag must never leak conversation text to the client
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    async json() { return { content: [{ type: 'text', text: 'SECRET-CONVERSATION-TEXT' }], stop_reason: 'max_tokens', usage: { output_tokens: 9 } }; },
    async text() { return ''; }
  });
  const r2 = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const body = JSON.stringify(await r2.json());
  t('diag carries no response text', !body.includes('SECRET-CONVERSATION-TEXT'), body);
}


/* ---- 11. partial salvage carries the same evidence as a failure ----------
   A ceiling hit mid-response is not an error: extractJson rewinds to the last
   COMPLETE move and the row ships shorter rather than not at all. It still
   carries diag, because a partial burns several times the output cost of a
   clean response and that rate has to stay measurable. */
{
  const whole = ['One', 'Two', 'Three', 'Four', 'Five']
    .map(n => `{"label":"${n}","text":"Do the ${n} thing.","evidence":"now the menu page"}`)
    .join(',');
  const cutSixth = `{"moves":[${whole},{"label":"Six`;   // ceiling hit mid-6th move
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    async json() { return {
      stop_reason: 'max_tokens',
      usage: { input_tokens: 900, output_tokens: 2500 },
      content: [{ type: 'text', text: cutSixth }]
    }; },
    async text() { return ''; }
  });
  const r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('partial salvage still returns 200', r.status === 200, String(r.status));
  /* Five came through whole; the cap keeps four. Salvage never ships a move
     that was cut mid-write — a half-written prompt in the message box is worse
     than one fewer button. */
  t('partial salvage keeps only the complete moves, capped at four',
    Array.isArray(b.moves) && b.moves.length === 4, 'kept=' + (b.moves && b.moves.length));
  t('every salvaged move is whole', b.moves.every(m => m.label && m.text && m.evidence));
  t('partial flag set', b.partial === true);
  t('partial carries diag', !!b.diag && b.diag.out === 2500 && b.diag.stop === 'max_tokens',
    JSON.stringify(b.diag));
  t('diag counts items STARTED (6), not kept (4)', b.diag && b.diag.steps === 6,
    'started=' + (b.diag && b.diag.steps));
}


/* ---- v0.9.20: thinking explicitly disabled on the hosted path ------------- */
{
  let sentBody = null;
  globalThis.fetch = async (url, opts) => {
    sentBody = JSON.parse(opts.body);
    return { ok: true, status: 200, async json() { return { stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{ type: 'text', text: JSON.stringify({ moves: [{ label: 'A move', text: 'Do the thing.', evidence: 'rrrr' }] }) }] }; },
      async text() { return ''; } };
  };
  await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  t('hosted request disables thinking', sentBody.thinking && sentBody.thinking.type === 'disabled',
    JSON.stringify(sentBody.thinking));
}


/* ---- v0.9.21: thinking-rejection retry on the hosted path ----------------- */
{
  let calls = 0;
  globalThis.fetch = async (url, opts) => {
    calls++;
    const body = JSON.parse(opts.body);
    if (body.thinking) return { ok: false, status: 400,
      async text() { return '{"error":{"message":"thinking cannot be disabled"}}'; },
      async json() { return {}; } };
    return { ok: true, status: 200, async json() { return { stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{ type: 'text', text: JSON.stringify({ moves: [{ label: 'A move', text: 'Do the thing.', evidence: 'rrrr' }] }) }] }; },
      async text() { return ''; } };
  };
  const r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('worker retries thinking-400 without the field', calls === 2, 'calls=' + calls);
  t('worker retry returns moves', b.moves && b.moves.length === 1, JSON.stringify(b.moves));
}

/* ---- v0.9.34: a dead service must not blame the user's network -----------
   Every client renders 'upstream_*' as "Couldn't reach the CONTEXA service.
   Check your connection and try again in a moment." When the service key is
   revoked or the balance hits zero, that sentence is false in both halves and
   false forever — a total outage wearing the mask of a transient blip, which
   is this project's most expensive recurring failure shape.

   'server_not_configured' is the honest code and every client back to 0.9.27
   already renders it as "Nothing you can fix — try again later." Choosing it
   here fixes the sentence for the entire installed base on ONE deploy, with
   no store review and nothing to couple across the client boundary. */
{
  const dead = msg => async () => ({ ok: false, status: 400,
    async text() { return JSON.stringify({ error: { message: msg } }); },
    async json() { return {}; } });

  globalThis.fetch = dead('Your credit balance is too low to access the Anthropic API.');
  let r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  let b = await r.json();
  t('an empty balance is not reported as a network problem', b.error === 'server_not_configured', b.error);
  t('and it is 503, not 502', r.status === 503, String(r.status));
  t('the upstream body still never reaches the client',
    !/credit balance/i.test(JSON.stringify(b)), JSON.stringify(b));

  globalThis.fetch = async () => ({ ok: false, status: 401,
    async text() { return '{"error":{"message":"invalid x-api-key"}}'; },
    async json() { return {}; } });
  r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('a revoked service key is also nothing the user can fix', b.error === 'server_not_configured', b.error);

  // The narrowing matters: a genuine bad request is still a bad request, and
  // calling it "not configured" would send the next debugger to the wrong file.
  globalThis.fetch = dead('max_tokens is too large');
  r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('an ordinary 400 is untouched', b.error === 'upstream_400', b.error);
  t('and stays a 502', r.status === 502, String(r.status));

  // Rate limiting IS transient, so "try again in a moment" is true there.
  globalThis.fetch = async () => ({ ok: false, status: 429,
    async text() { return '{"error":{"message":"rate_limit_error"}}'; },
    async json() { return {}; } });
  r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('a rate limit stays transient, not a misconfiguration', b.error === 'upstream_429', b.error);

  // The code is only honest if the clients actually render it that way. This
  // reaches across into the extension deliberately: the worker picking a code
  // no client maps would be a silent regression on the far side of the wire.
  const ce = readFileSync(rel('../extension/content.js'), 'utf8');
  const branch = ce.indexOf("server_not_configured");
  t('the shipped client renders this code as an honest sentence',
    branch > 0 && /nothing you can fix/i.test(ce.slice(branch, branch + 300)));
  t('and does not tell the reader to check their connection',
    branch > 0 && !/check your connection/i.test(ce.slice(branch, branch + 300)));

  /* 0.9.42 RETIRES the equality check added in 0.9.34. It asserted that the
     worker and the extension ship the same number, which was true that day and
     was never the requirement — BUILD's own comment says it is "deliberately
     independent of the extension's manifest version", because a worker fix must
     not force a store resubmission and a content.js fix must not force a deploy.
     The check blocked exactly that second case the first time it arose.

     What actually matters is that both are well-formed and that /v1/health
     reports the worker's own build, so a deploy can always be proven to have
     landed. Byte-identity of the two prompts is enforced by build.mjs, which is
     the coupling that genuinely exists. */
  const mv = JSON.parse(readFileSync(rel('../extension/manifest.json'), 'utf8')).version;
  t('both artifacts carry a well-formed version, independently',
    /^\d+\.\d+\.\d+$/.test(BUILD_SEEN) && /^\d+\.\d+\.\d+$/.test(mv),
    'worker ' + BUILD_SEEN + ' vs extension ' + mv);
}


/* ---- v2: history mining, and the generation boundary around it -------------
   The FOURTH client generation. What these guard is not the happy path — it is
   the leak. A client that did not announce 'turns' must never receive `moves`,
   because an unknown key reads to it as nothing earned and it renders a quiet
   row forever: a working product, permanently silent, nothing in the console.
   That is exactly how 0.9.30 broke, and it is why `accepts` was built as a
   list. The first assertions below are the outage-shaped ones. */
{
  const modelJson = obj => async () => ({
    ok: true, status: 200,
    async json() { return {
      stop_reason: 'end_turn',
      usage: { input_tokens: 500, output_tokens: 200 },
      content: [{ type: 'text', text: JSON.stringify(obj) }]
    }; },
    async text() { return ''; }
  });

  const MOVES = { moves: [
    { label: 'Add a contact form', text: 'Add a contact form to the bakery site.', evidence: 'make me a website for my bakery' },
    { label: 'Make it mobile-first', text: 'Rework the page to be mobile-first.', evidence: 'r'.repeat(20) }
  ] };

  /* (a) A request with nothing to mine is refused BEFORE it costs anything.
     This is what replaced the leak tests. Under the three-generation
     negotiation the danger was serving a shape a client could not read, which
     it rendered as a permanently quiet row; with one shape there is no wrong
     shape to send, and the remaining way to waste a call is to mine a session
     that is not there. Rejected at the gate, so it charges neither quota. */
  upstream = 0;
  let r = await w.fetch(post({ turns: [] }), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  let b = await r.json();
  t('a request with no turns is refused', r.status === 400 && b.error === 'no_turns',
    r.status + ' ' + b.error);
  t('and costs nothing upstream', upstream === 0, 'calls=' + upstream);

  upstream = 0;
  r = await w.fetch(post({ turns: undefined }), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('a request with no turns field at all is refused too', b.error === 'no_turns', String(b.error));
  t('and costs nothing either', upstream === 0, 'calls=' + upstream);

  /* Malformed turns are dropped by cleanTurns, and a payload of nothing BUT
     malformed turns lands in the same place as sending none — the gate reads
     what survived, never what was sent. */
  upstream = 0;
  r = await w.fetch(post({ turns: [{ i: 0, text: 'bad index' }, { text: 'no index' }, { i: 2, text: '' }] }),
    { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('turns that are all malformed are refused as none', b.error === 'no_turns', String(b.error));
  t('and cost nothing', upstream === 0, 'calls=' + upstream);

  /* Fields the worker no longer reads must be ignored, not fatal. Nothing sends
     them today, but a body is parsed before it is trusted and an unknown key is
     never a reason to fail a request that is otherwise complete. */
  globalThis.fetch = modelJson(MOVES);
  r = await w.fetch(post({ v: '0.9.54', accepts: ['chips'], prompt: 'ship it', intent: 'x' }),
    { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('retired fields on the wire are ignored, not fatal',
    r.status === 200 && Array.isArray(b.moves) && b.moves.length === 2, r.status + ' ' + JSON.stringify(Object.keys(b)));

  /* (b) The happy path. */
  globalThis.fetch = modelJson(MOVES);
  r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('moves reach a mining client', r.status === 200 && b.moves && b.moves.length === 2, JSON.stringify(b.moves));
  t('and carry label, text and evidence',
    b.moves[0].label === 'Add a contact form' && !!b.moves[0].text && !!b.moves[0].evidence);
  t('a mining row carries no questions or chips key',
    b.questions === undefined && b.chips === undefined, JSON.stringify(Object.keys(b)));

  /* (c) Grounding over the WHOLE corpus — the regression the audit predicted.
     The first move's evidence quotes TURN ONE and appears nowhere in the reply.
     Against the old reply-only corpus it would count as ungrounded, and every
     history-earned move would have been reported as such. */
  t('evidence quoted from an early turn counts as grounded',
    b.grounding && b.grounding.grounded === 2,
    JSON.stringify(b.grounding));

  globalThis.fetch = modelJson({ moves: [
    { label: 'Invented', text: 'do a thing', evidence: 'nothing anyone ever said here' }
  ] });
  r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('and an ungrounded quote still renders, counted rather than dropped',
    b.moves.length === 1 && b.grounding.grounded === 0, JSON.stringify(b.grounding));

  /* (d) The gate. Each part is required for a different visible failure: no
     label is a blank button, no text composes nothing, no evidence is a move
     the session never earned. */
  globalThis.fetch = modelJson({ moves: [
    { label: '', text: 'x', evidence: 'y' },
    { label: 'No text', text: '', evidence: 'y' },
    { label: 'No evidence', text: 'x', evidence: '' },
    { label: 'Good one', text: 'Write the menu page.', evidence: 'now the menu page' }
  ] });
  r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('a move missing label, text or evidence is dropped',
    b.moves.length === 1 && b.moves[0].label === 'Good one', JSON.stringify(b.moves));

  globalThis.fetch = modelJson({ moves: Array.from({ length: 9 }, (_, n) =>
    ({ label: 'Move ' + n, text: 'do thing ' + n, evidence: 'now the menu page' })) });
  r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('never more than four moves reach the client', b.moves.length === 4, String(b.moves.length));

  globalThis.fetch = modelJson({ moves: [
    { label: 'Add a form', text: 'one', evidence: 'now the menu page' },
    { label: 'add a FORM', text: 'two', evidence: 'now the menu page' }
  ] });
  r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('two labels reading the same collapse to one', b.moves.length === 1, String(b.moves.length));

  /* (e) Zero is a product outcome and reaches the client as an empty array,
     not as an error. The client renders no row at all for this. */
  globalThis.fetch = modelJson({ moves: [] });
  r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('a session that earned nothing returns moves: [], status 200',
    r.status === 200 && Array.isArray(b.moves) && b.moves.length === 0);

  /* (f) The clamps. These are the bill, not the product: a client can send
     anything, and only what survives here is ever paid for. Asserted on what
     actually went upstream, because a clamp that trims the response instead of
     the request has already cost the money. */
  let sent = null;
  globalThis.fetch = async (_u, init) => {
    sent = JSON.parse(init.body);
    return { ok: true, status: 200,
      async json() { return { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: '{"moves":[]}' }] }; },
      async text() { return ''; } };
  };
  const huge = Array.from({ length: 200 }, (_, n) => ({ i: n + 1, text: 'x'.repeat(5000) }));
  r = await w.fetch(post({ turns: huge }), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const body = sent.messages[0].content;
  t('an oversized session is clamped before it is billed',
    body.length < 20000, 'chars=' + body.length);
  /* Turn one is pinned and the newest survives: the goal and the present are
     the two the drop policy must never lose. */
  t('turn one survives the clamp', body.includes('[1] '), body.slice(0, 40));
  t('and so does the newest turn', body.includes('[200] '));
  t('the middle is what was dropped', !body.includes('[100] '));

  /* Numbers are true turn positions, so a gap IS the elision marker — nothing
     extra is invented to say "some were dropped", and the prompt reads it. */
  sent = null;
  r = await w.fetch(post({ turns: [{ i: 1, text: 'first' }, { i: 7, text: 'seventh' }] }),
    { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  t('turns are labelled with their true positions, gaps included',
    /\[1\] first[\s\S]*\[7\] seventh/.test(sent.messages[0].content), sent.messages[0].content.slice(0, 80));

  /* A malformed turn is dropped, never coerced into a plausible-looking one. */
  sent = null;
  r = await w.fetch(post({ turns: [{ i: 1, text: 'kept' }, { i: 0, text: 'bad index' }, { text: 'no index' }, { i: 2, text: '' }] }),
    { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  t('turns with a bad index or no text are dropped',
    sent.messages[0].content.includes('[1] kept') && !sent.messages[0].content.includes('bad index'));

  /* The mining call must use the mining prompt. Sending the questions prompt
     with a turns payload would produce the old shape and read as an outage. */
  t('the mining call is sent the mining prompt',
    sysText(sent.system).includes('INDEPENDENT IS THE WHOLE POINT'));
  t('and the mining prompt is still cached like the others',
    Array.isArray(sent.system) && sent.system[0].cache_control);

  /* The composer rules had to come WITH it. EXPAND_SYSTEM was the only prompt
     with a channel to the composer; now this one is, so dropping these would
     recreate 0.9.49's inert instruction — a rule pointing at a mechanism that
     no longer exists. */
  const moveSys = sysText(sent.system);
  t('the mining prompt carries the <paste here> obligation',
    moveSys.includes('<paste here>') && moveSys.includes('<attach here>'));
  t('and the Assume: mechanism', moveSys.includes('"Assume:"'));
  t('and the one-ask-one-verb rule', /ONE ask, ONE imperative verb/.test(moveSys));
  t('and the 700-character cap', /At most 700 characters/.test(moveSys));
  t('and the filler-word ban', /Never use filler quality words/.test(moveSys));
  /* Voice-spec §3 is banned-in-every-register law, not register styling, and it
     survives Register C's retirement. The floor ban matters most here: a menu
     is exactly the shape a floor creeps back into. */
  t('and the ban on a confirmation floor', /Use that label\? Yes \/ No/.test(moveSys));
  t('and the ban on service voice', /Would you like me to/.test(moveSys));
  t('and it never asks the user anything', /you are not asking them anything/.test(moveSys));
}

globalThis.fetch = realFetch;
console.log(fails.length ? '\nFAILED: ' + fails.join(', ') : '\nall worker checks passed');
process.exit(fails.length ? 1 : 0);
