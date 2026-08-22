/* CONTEXA worker tests — no network, no Cloudflare account needed.
   Run from the worker/ directory:  node test.mjs
   Exercises the properties that protect your bill: nothing reaches Anthropic
   unless the request passed origin, token, size and quota checks. */

const w = (await import('./src/index.js')).default;

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
function post(body = { prompt: 'ship it', reply: 'r'.repeat(120) }) {
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
const t = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!cond) fails.push(name);
};

/* 1. health */
let r = await w.fetch(new Request('https://x/v1/health'), { ANTHROPIC_API_KEY: 'k', MODEL: 'claude-sonnet-5' });
let b = await r.json();
t('health reports version', /^\d+\.\d+\.\d+$/.test(b.version || ''), b.version);
t('health is uncacheable', r.headers.get('cache-control') === 'no-store', String(r.headers.get('cache-control')));
t('health reports model', b.model === 'claude-sonnet-5', b.model);
t('health reports configured', b.configured === true);

/* 2. device quota exhausted -> 429, valid ISO, no spend */
const day = new Date().toISOString().slice(0, 10);
const kv = makeKV({ ['q:' + DEV + ':' + day]: '20' });
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
    { name: 'JSON opened, first step never closed',
      content: [{ type: 'text', text: '{"steps":[{"label":"Question the retry bud' }], stop: 'max_tokens',
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


/* ---- 11. partial salvage carries the same evidence as a failure ---------- */
{
  const five = Array.from({length: 5}, (_, i) =>
    `{"label":"Step ${i+1} label","text":"Do thing ${i+1}.\\n- one constraint\\n- another","evidence":"rrrr"}`).join(',');
  const cutSixth = `{"steps":[${five},{"label":"Six`;   // ceiling hit mid-6th step
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    async json() { return {
      content: [{ type: 'text', text: cutSixth }],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 1100, output_tokens: 2500 }
    }; },
    async text() { return ''; }
  });
  const r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('partial salvage still returns 200', r.status === 200, String(r.status));
  // 0.9.29: salvage still keeps only COMPLETE steps, but the core ships one.
  t('partial salvage keeps one complete step', Array.isArray(b.steps) && b.steps.length === 1,
    'kept=' + (b.steps && b.steps.length));
  t('partial flag set', b.partial === true);
  t('partial carries diag', !!b.diag && b.diag.out === 2500 && b.diag.stop === 'max_tokens',
    JSON.stringify(b.diag));
  t('diag counts steps STARTED (6), not kept (5)', b.diag && b.diag.steps === 6,
    'started=' + (b.diag && b.diag.steps));
}


/* ---- 12. SPEC v0.9.17: evidence validation, hosted path ------------------- */
{
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    async json() { return {
      stop_reason: 'end_turn',
      usage: { input_tokens: 500, output_tokens: 300 },
      content: [{ type: 'text', text: JSON.stringify({ steps: [
        { label: 'Grounded', text: 'Do the thing.', evidence: 'rrrr' },
        { label: 'Dropped', text: 'No evidence.' },
        { label: 'Ungrounded', text: 'Renders anyway.', evidence: 'zzz not in reply' }
      ] }) }]
    }; },
    async text() { return ''; }
  });
  const r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('evidence-less step dropped, one chip kept (hosted)', b.steps && b.steps.length === 1,
    'kept=' + (b.steps && b.steps.length));
  t('the kept chip is the grounded one, not the ungrounded one',
    b.steps && b.steps[0] && b.steps[0].label === 'Grounded', JSON.stringify(b.steps && b.steps[0]));
  t('response steps carry no evidence key', b.steps && b.steps.every(s => !('evidence' in s)),
    JSON.stringify(b.steps && b.steps[0]));
  t('grounding counts returned', b.grounding &&
    b.grounding.total === 3 && b.grounding.kept === 1 && b.grounding.grounded === 1,
    JSON.stringify(b.grounding));
}


/* ---- v0.9.29: zero is an answer, and the two silences are not the same ----
   The one-chip core is only honest if the model is allowed to return nothing.
   But "I earned no step" and "I produced steps and the evidence gate ate every
   one" look identical at the end of the pipe and mean opposite things — one is
   the product working, the other is a defect. These pin the split. */
{
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    async json() { return {
      stop_reason: 'end_turn',
      usage: { input_tokens: 500, output_tokens: 30 },
      content: [{ type: 'text', text: JSON.stringify({ steps: [] }) }]
    }; },
    async text() { return ''; }
  });
  const r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('deliberate zero is a 200, not an error', r.status === 200, String(r.status));
  t('quiet row carries an empty steps array', Array.isArray(b.steps) && b.steps.length === 0,
    JSON.stringify(b.steps));
  t('quiet row is flagged as quiet', b.quiet === true);
  t('quiet row carries no error', !b.error, JSON.stringify(b.error));
  t('quiet row still reports grounding', b.grounding && b.grounding.total === 0 && b.grounding.kept === 0,
    JSON.stringify(b.grounding));
}

{
  // Steps WERE produced; every one failed the evidence contract. Not silence —
  // a failure, and it must keep its diagnostic rather than masquerade as quiet.
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    async json() { return {
      stop_reason: 'end_turn',
      usage: { input_tokens: 500, output_tokens: 200 },
      content: [{ type: 'text', text: JSON.stringify({ steps: [
        { label: 'No evidence', text: 'Do a thing.' }
      ] }) }]
    }; },
    async text() { return ''; }
  });
  const r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('gate-ate-everything is still an error, not a quiet row', r.status === 502, String(r.status));
  t('that error is no_steps with a diag', b.error === 'no_steps' && !!b.diag, JSON.stringify(b.error));
  t('a failure is never flagged quiet', b.quiet !== true);
}

{
  // The monster breathes: a 700-char step survives intact where the old 600
  // cap would have silently cut it.
  const long = 'Word '.repeat(130).trim().slice(0, 690) + '.';
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    async json() { return {
      stop_reason: 'end_turn',
      usage: { input_tokens: 500, output_tokens: 400 },
      content: [{ type: 'text', text: JSON.stringify({ steps: [
        { label: 'Long one', text: long, evidence: 'rrrr' }
      ] }) }]
    }; },
    async text() { return ''; }
  });
  const r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('a ~690-char step is not truncated at the old 600 cap',
    b.steps && b.steps[0] && b.steps[0].text.length > 600, 'len=' + (b.steps && b.steps[0] && b.steps[0].text.length));
}


/* ---- v0.9.20: thinking explicitly disabled on the hosted path ------------- */
{
  let sentBody = null;
  globalThis.fetch = async (url, opts) => {
    sentBody = JSON.parse(opts.body);
    return { ok: true, status: 200, async json() { return { stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{ type: 'text', text: JSON.stringify({ steps: [{ label: 'A', text: 'Do.', evidence: 'rrrr' }] }) }] }; },
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
      content: [{ type: 'text', text: JSON.stringify({ steps: [{ label: 'A', text: 'Do.', evidence: 'rrrr' }] }) }] }; },
      async text() { return ''; } };
  };
  const r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('worker retries thinking-400 without the field', calls === 2, 'calls=' + calls);
  t('worker retry returns steps', b.steps && b.steps.length === 1, JSON.stringify(b.steps));
}

/* ---- v0.9.23: /v1/expand — the fifth chip's endpoint ---------------------- */
function postExpand(body = { intent: 'optimize seo', prompt: 'p', reply: 'r'.repeat(120) }) {
  return new Request('https://x/v1/expand', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cx-device': DEV, origin: 'chrome-extension://abc' },
    body: JSON.stringify(body)
  });
}
{
  // success: labeled sections, the writer system, 1200 ceiling, thinking disabled,
  // and the spend lands on the SAME device counter next-steps uses.
  let sent = null;
  globalThis.fetch = async (url, opts) => {
    sent = JSON.parse(opts.body);
    return { ok: true, status: 200, async json() { return { stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{ type: 'text', text: JSON.stringify({ prompt: 'Drafted.' }) }] }; },
      async text() { return ''; } };
  };
  const kvE = makeKV();
  const r = await w.fetch(postExpand(), { ANTHROPIC_API_KEY: 'k', CX_KV: kvE, IP_SALT: 's' });
  const b = await r.json();
  t('expand returns the draft', b.prompt === 'Drafted.', JSON.stringify(b));
  t('expand uses the writer system', /prompt writer/.test(sent.system || ''), (sent.system || '').slice(0, 40));
  t('expand ceiling is 1200', sent.max_tokens === 1200, String(sent.max_tokens));
  t('expand disables thinking', sent.thinking && sent.thinking.type === 'disabled');
  t('expand sections labeled', /^ROUGH ASK:\n/.test(sent.messages[0].content) &&
    sent.messages[0].content.includes("CLAUDE'S REPLY:"), sent.messages[0].content.slice(0, 24));
  t('expand spends the SAME device counter', kvE.store.get('q:' + DEV + ':' + day) === '1',
    String(kvE.store.get('q:' + DEV + ':' + day)));
}
{
  // one pool: a device that exhausted next-steps cannot expand
  upstream = 0;
  globalThis.fetch = async () => { upstream++; throw new Error('no'); };
  const kvQ = makeKV({ ['q:' + DEV + ':' + day]: '20' });
  const r = await w.fetch(postExpand(), { ANTHROPIC_API_KEY: 'k', CX_KV: kvQ, IP_SALT: 's' });
  t('expand 429s from the shared pool', r.status === 429, String(r.status));
  t('shared-pool 429 costs nothing upstream', upstream === 0, 'calls=' + upstream);
}
{
  // gates: blank intent -> 400 before spend; originless -> 403; empty reply is FINE
  upstream = 0;
  globalThis.fetch = async () => { upstream++; throw new Error('no'); };
  let r = await w.fetch(postExpand({ intent: '   ', prompt: 'p', reply: 'r'.repeat(120) }),
    { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  t('blank intent rejected', r.status === 400, String(r.status));
  t('blank intent costs nothing', upstream === 0, 'calls=' + upstream);
  r = await w.fetch(new Request('https://x/v1/expand', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cx-device': DEV },
    body: JSON.stringify({ intent: 'x', reply: 'r'.repeat(120) }) }),
    { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  t('originless expand rejected', r.status === 403, String(r.status));
  globalThis.fetch = async () => ({ ok: true, status: 200, async json() { return { stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: 'text', text: '{"prompt":"Standalone."}' }] }; }, async text() { return ''; } });
  r = await w.fetch(postExpand({ intent: 'email to my landlord', prompt: '', reply: '' }),
    { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b2 = await r.json();
  t('expand works with no reply (topic switch)', r.status === 200 && b2.prompt === 'Standalone.',
    r.status + ' ' + JSON.stringify(b2));
}
{
  // thinking-400 retry works on the expand path too
  let calls = 0;
  globalThis.fetch = async (url, opts) => {
    calls++;
    const body = JSON.parse(opts.body);
    if (body.thinking) return { ok: false, status: 400,
      async text() { return '{"error":{"message":"thinking cannot be disabled"}}'; },
      async json() { return {}; } };
    return { ok: true, status: 200, async json() { return { stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{ type: 'text', text: '{"prompt":"Drafted."}' }] }; }, async text() { return ''; } };
  };
  const r = await w.fetch(postExpand(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('expand retries thinking-400', calls === 2 && b.prompt === 'Drafted.', 'calls=' + calls);
}
{
  // an overlong draft is trimmed at a clean boundary, hard cap 900
  const long = ('One clean sentence here. ').repeat(60);
  globalThis.fetch = async () => ({ ok: true, status: 200, async json() { return { stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: 'text', text: JSON.stringify({ prompt: long }) }] }; }, async text() { return ''; } });
  const r = await w.fetch(postExpand(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('overlong draft hard-capped at 900', typeof b.prompt === 'string' && b.prompt.length <= 900,
    'len=' + (b.prompt || '').length);
  t('trim ends at a clean boundary', /[.!?]$/.test(b.prompt || ''), JSON.stringify((b.prompt || '').slice(-20)));
}
{
  // an empty drafted prompt is an error with evidence, not an empty 200
  globalThis.fetch = async () => ({ ok: true, status: 200, async json() { return { stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: 'text', text: '{"prompt":"   "}' }] }; }, async text() { return ''; } });
  const r = await w.fetch(postExpand(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('empty draft becomes no_prompt with diag', r.status === 502 && b.error === 'no_prompt' && !!b.diag,
    JSON.stringify(b));
}

globalThis.fetch = realFetch;
console.log(fails.length ? '\nFAILED: ' + fails.join(', ') : '\nall worker checks passed');
process.exit(fails.length ? 1 : 0);
