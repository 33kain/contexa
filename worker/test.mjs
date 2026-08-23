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
/* post() deliberately sends NO version: it simulates a pre-0.9.30 client, the
   generation the dual-schema shim exists for. postV() is a modern client. Every
   assertion below therefore declares which generation it is testing, which is
   the whole point — a single default would have hidden the break that shipped. */
function postV(body = { prompt: 'ship it', reply: 'r'.repeat(120) }) {
  return post(Object.assign({ v: '0.9.31' }, body));
}

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
const BUILD_SEEN = b.version;
t('health reports version', /^\d+\.\d+\.\d+$/.test(b.version || ''), b.version);
t('health is uncacheable', r.headers.get('cache-control') === 'no-store', String(r.headers.get('cache-control')));
t('health reports model', b.model === 'claude-sonnet-5', b.model);
t('health reports configured', b.configured === true);

/* 2. device quota exhausted -> 429, valid ISO, no spend */
const day = new Date().toISOString().slice(0, 10);
const kv = makeKV({ ['q:' + DEV + ':' + day]: '20' });
upstream = 0;
r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: kv, IP_SALT: 's' });
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
      content: [{ type: 'text', text: '{"questions":[{"label":"Question the retry bud' }], stop: 'max_tokens',
      usage: { input_tokens: 900, output_tokens: 2500 },
      expect: d => d.hadJson === true && d.steps === 1 },
  ];
  for (const c of cases) {
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      async json() { return { content: c.content, stop_reason: c.stop, usage: c.usage }; },
      async text() { return ''; }
    });
    const r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
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
  const r2 = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const body = JSON.stringify(await r2.json());
  t('diag carries no response text', !body.includes('SECRET-CONVERSATION-TEXT'), body);
}


/* ---- 11. partial salvage carries the same evidence as a failure ---------- */
{
  const five = Array.from({length: 5}, (_, i) =>
    `{"label":"Step ${i+1} label","options":["A","B"],"text":"Do thing ${i+1}.\\n- one constraint\\n- another","evidence":"rrrr"}`).join(',');
  const cutSixth = `{"questions":[${five},{"label":"Six`;   // ceiling hit mid-6th step
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    async json() { return {
      content: [{ type: 'text', text: cutSixth }],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 1100, output_tokens: 2500 }
    }; },
    async text() { return ''; }
  });
  const r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('partial salvage still returns 200', r.status === 200, String(r.status));
  // 0.9.29: salvage still keeps only COMPLETE steps, but the core ships one.
  // 0.9.30: salvage keeps only COMPLETE items, now up to the four-question cap.
  t('partial salvage keeps the complete questions', Array.isArray(b.questions) && b.questions.length === 4,
    'kept=' + (b.questions && b.questions.length));
  t('partial flag set', b.partial === true);
  t('partial carries diag', !!b.diag && b.diag.out === 2500 && b.diag.stop === 'max_tokens',
    JSON.stringify(b.diag));
  t('diag counts items STARTED (6), not kept (4)', b.diag && b.diag.steps === 6,
    'started=' + (b.diag && b.diag.steps));
}


/* ---- 12. SPEC v0.9.17: evidence validation, hosted path ------------------- */
{
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    async json() { return {
      stop_reason: 'end_turn',
      usage: { input_tokens: 500, output_tokens: 300 },
      content: [{ type: 'text', text: JSON.stringify({ questions: [
        { label: 'Grounded', text: 'Do the thing.', options: ['A', 'B'], evidence: 'rrrr' },
        { label: 'Dropped', text: 'No evidence.', options: ['A', 'B'] },
        { label: 'Ungrounded', text: 'Renders anyway.', options: ['A', 'B'], evidence: 'zzz not in reply' }
      ] }) }]
    }; },
    async text() { return ''; }
  });
  const r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('evidence-less question dropped (hosted)', b.questions && b.questions.length === 2,
    'kept=' + (b.questions && b.questions.length));
  t('the first kept question is the grounded one',
    b.questions && b.questions[0] && b.questions[0].label === 'Grounded', JSON.stringify(b.questions && b.questions[0]));
  t('response steps carry no evidence key', b.questions && b.questions.every(s => !('evidence' in s)),
    JSON.stringify(b.questions && b.questions[0]));
  t('grounding counts returned', b.grounding &&
    b.grounding.total === 3 && b.grounding.kept === 2 && b.grounding.grounded === 1,
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
      content: [{ type: 'text', text: JSON.stringify({ questions: [] }) }]
    }; },
    async text() { return ''; }
  });
  const r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('deliberate zero is a 200, not an error', r.status === 200, String(r.status));
  t('quiet row carries an empty steps array', Array.isArray(b.questions) && b.questions.length === 0,
    JSON.stringify(b.questions));
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
      content: [{ type: 'text', text: JSON.stringify({ questions: [
        { label: 'No evidence', text: 'Do a thing.' }
      ] }) }]
    }; },
    async text() { return ''; }
  });
  const r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
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
      content: [{ type: 'text', text: JSON.stringify({ questions: [
        { label: 'Long one', text: long, options: ['A', 'B'], evidence: 'rrrr' }
      ] }) }]
    }; },
    async text() { return ''; }
  });
  const r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('a ~690-char step is not truncated at the old 600 cap',
    b.questions && b.questions[0] && b.questions[0].text.length > 600, 'len=' + (b.questions && b.questions[0] && b.questions[0].text.length));
}


/* ---- v0.9.31: dual schema, both directions --------------------------------
   The bug this exists to prevent already shipped once. 0.9.30 renamed the wire
   field and changed what a row IS, and it broke in BOTH directions: an old
   client asking a new worker for `steps`, and a new client asking an old worker
   for `questions`. Both render "Couldn't write suggestions" — an error message
   describing neither cause. Only ONE of those directions is fixable from the
   server, and this is it. */
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

  const THREE = { questions: [
    { label: 'Occasion', text: 'What is the occasion?', options: ['Wedding', 'Work talk'], evidence: 'rrrr' },
    { label: 'Length', text: 'How long should it run?', options: ['~2 min', '~5 min'], evidence: 'rrrr' },
    { label: 'Language', text: 'Which language?', options: ['English', 'Serbian'], evidence: 'rrrr' }
  ] };

  // A client that sends no version is, by definition, older than the field.
  globalThis.fetch = modelJson(THREE);
  let r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  let b = await r.json();
  t('legacy client gets steps, never questions',
    Array.isArray(b.steps) && !('questions' in b), Object.keys(b).join(','));
  t('legacy client is capped at one chip', b.steps && b.steps.length === 1, 'kept=' + (b.steps && b.steps.length));
  t('legacy chip carries no options key it cannot render',
    b.steps && b.steps[0] && !('options' in b.steps[0]), JSON.stringify(b.steps && b.steps[0]));

  /* The legacy PROMPT emits {"steps":[...]}, not {"questions":[...]}. A parser
     reading only the new key turns every legacy call into a quiet row — an
     outage that looks exactly like the product working correctly. */
  globalThis.fetch = modelJson({ steps: [
    { label: 'Upload and decide', text: 'Here is the file. Run the checklist.', evidence: 'rrrr' }
  ] });
  r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('a legacy-shaped model response is parsed, not silently quieted',
    b.steps && b.steps.length === 1 && b.steps[0].label === 'Upload and decide', JSON.stringify(b.steps));
  t('that legacy response is not flagged quiet', b.quiet !== true);

  // A client that sends one understands the questionnaire.
  globalThis.fetch = modelJson(THREE);
  r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('modern client gets questions, never steps',
    Array.isArray(b.questions) && !('steps' in b), Object.keys(b).join(','));
  t('modern client gets all three questions', b.questions && b.questions.length === 3,
    'kept=' + (b.questions && b.questions.length));
  t('modern client gets options', b.questions && Array.isArray(b.questions[0].options)
    && b.questions[0].options[0] === 'Wedding', JSON.stringify(b.questions && b.questions[0]));

  // An empty version string is not a version. Whitespace is not a version.
  globalThis.fetch = modelJson(THREE);
  r = await w.fetch(post({ prompt: 'p', reply: 'r'.repeat(120), v: '   ' }),
    { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('a blank version is treated as a legacy client', Array.isArray(b.steps) && !('questions' in b));

  // The two prompts must actually differ, or the shim is decorative.
  globalThis.fetch = async (url, opts) => {
    sent = JSON.parse(opts.body).system;
    return (await modelJson(THREE)())
  };
  let sent = null;
  await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const legacySystem = sent;
  await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const modernSystem = sent;
  t('legacy clients get the 0.9.29 trajectory prompt',
    typeof legacySystem === 'string' && legacySystem.includes('Return AT MOST ONE step.'));
  t('modern clients get the questionnaire prompt',
    typeof modernSystem === 'string' && modernSystem.includes('BETWEEN ZERO AND FOUR questions'));
  t('the two prompts are genuinely different', legacySystem !== modernSystem);

  // Zero must stay reachable on BOTH sides, in each side's own vocabulary.
  globalThis.fetch = modelJson({ questions: [] });
  r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('legacy quiet row is an empty steps array, 200',
    r.status === 200 && Array.isArray(b.steps) && b.steps.length === 0 && b.quiet === true);
  globalThis.fetch = modelJson({ questions: [] });
  r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('modern quiet row is an empty questions array, 200',
    r.status === 200 && Array.isArray(b.questions) && b.questions.length === 0 && b.quiet === true);
}


/* ---- v0.9.33: the interview is CLICK-ONLY ---------------------------------
   Owner's invariant. A question the user cannot answer by clicking is not
   asked — the audience is people who know roughly what they want but not how
   to say it, so a bare text field asks them to do the exact thing they came
   here unable to do.

   Three things these pin, and each is a way the rule could be quietly lost:
   (a) the drop happens at all — a question with no usable options used to
       render as a lone text field, which is precisely the banned case;
   (b) the drop is PER-QUESTION, never the whole interview, because material
       the user must supply belongs in the composed prompt as a slot;
   (c) map, drop, THEN slice — dropping after slicing would let an unaskable
       question take a good one's place in the four. */
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

  // One clickable, one with a single option, one with none.
  globalThis.fetch = modelJson({ questions: [
    { label: 'Occasion', text: 'What is the occasion?', options: ['Wedding', 'Work talk'], evidence: 'rrrr' },
    { label: 'The story', text: 'What story do you want to tell?', options: ['Anything'], evidence: 'rrrr' },
    { label: 'Details', text: 'Anything else I should know?', evidence: 'rrrr' }
  ] });
  let r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  let b = await r.json();
  t('a question with one option is dropped', b.questions && b.questions.length === 1,
    'kept=' + (b.questions && b.questions.length));
  t('the clickable question is the one that survives',
    b.questions && b.questions[0] && b.questions[0].label === 'Occasion',
    JSON.stringify(b.questions && b.questions[0]));
  t('dropping some questions does NOT abort the interview', r.status === 200 && !b.error);

  // Every question unclickable => nothing survives => this is a real failure of
  // the model, not a quiet row: it produced steps and none were usable.
  globalThis.fetch = modelJson({ questions: [
    { label: 'Story', text: 'What story?', evidence: 'rrrr' },
    { label: 'Details', text: 'What details?', options: ['Just one'], evidence: 'rrrr' }
  ] });
  r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('all-unclickable yields no questions', r.status === 502 && b.error === 'no_steps',
    r.status + ' ' + JSON.stringify(b.error));
  t('that is a failure, not flagged as a quiet row', b.quiet !== true);

  /* Deliberate silence still reads as silence — the model returning {"questions":[]}
     is the product working, and must not be confused with everything being dropped. */
  globalThis.fetch = modelJson({ questions: [] });
  r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('deliberate zero is still a quiet 200', r.status === 200 && b.quiet === true);

  // Order: five questions, the second unaskable. All four survivors must appear.
  globalThis.fetch = modelJson({ questions: [
    { label: 'One',   text: 'q1?', options: ['a', 'b'], evidence: 'rrrr' },
    { label: 'Bad',   text: 'q2?', options: [],         evidence: 'rrrr' },
    { label: 'Three', text: 'q3?', options: ['a', 'b'], evidence: 'rrrr' },
    { label: 'Four',  text: 'q4?', options: ['a', 'b'], evidence: 'rrrr' },
    { label: 'Five',  text: 'q5?', options: ['a', 'b'], evidence: 'rrrr' }
  ] });
  r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('drop happens before the cap, so a bad question costs nobody a slot',
    b.questions && b.questions.length === 4, 'kept=' + (b.questions && b.questions.length));
  t('the dropped one is gone and the rest keep their order',
    b.questions && b.questions.map(q => q.label).join(',') === 'One,Three,Four,Five',
    b.questions && b.questions.map(q => q.label).join(','));

  // Legacy clients never had options and must be untouched by any of this.
  globalThis.fetch = modelJson({ steps: [
    { label: 'Upload and decide', text: 'Here is the file.', evidence: 'rrrr' }
  ] });
  r = await w.fetch(post(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('the legacy path is untouched by the option guard',
    b.steps && b.steps.length === 1 && !('options' in b.steps[0]), JSON.stringify(b.steps));
}


/* ---- v0.9.20: thinking explicitly disabled on the hosted path ------------- */
{
  let sentBody = null;
  globalThis.fetch = async (url, opts) => {
    sentBody = JSON.parse(opts.body);
    return { ok: true, status: 200, async json() { return { stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{ type: 'text', text: JSON.stringify({ questions: [{ label: 'A', text: 'Do.', options: ['x', 'y'], evidence: 'rrrr' }] }) }] }; },
      async text() { return ''; } };
  };
  await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
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
      content: [{ type: 'text', text: JSON.stringify({ questions: [{ label: 'A', text: 'Do.', options: ['x', 'y'], evidence: 'rrrr' }] }) }] }; },
      async text() { return ''; } };
  };
  const r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  const b = await r.json();
  t('worker retries thinking-400 without the field', calls === 2, 'calls=' + calls);
  t('worker retry returns steps', b.questions && b.questions.length === 1, JSON.stringify(b.questions));
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
  let r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  let b = await r.json();
  t('an empty balance is not reported as a network problem', b.error === 'server_not_configured', b.error);
  t('and it is 503, not 502', r.status === 503, String(r.status));
  t('the upstream body still never reaches the client',
    !/credit balance/i.test(JSON.stringify(b)), JSON.stringify(b));

  globalThis.fetch = async () => ({ ok: false, status: 401,
    async text() { return '{"error":{"message":"invalid x-api-key"}}'; },
    async json() { return {}; } });
  r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('a revoked service key is also nothing the user can fix', b.error === 'server_not_configured', b.error);

  // The narrowing matters: a genuine bad request is still a bad request, and
  // calling it "not configured" would send the next debugger to the wrong file.
  globalThis.fetch = dead('max_tokens is too large');
  r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
  b = await r.json();
  t('an ordinary 400 is untouched', b.error === 'upstream_400', b.error);
  t('and stays a 502', r.status === 502, String(r.status));

  // Rate limiting IS transient, so "try again in a moment" is true there.
  globalThis.fetch = async () => ({ ok: false, status: 429,
    async text() { return '{"error":{"message":"rate_limit_error"}}'; },
    async json() { return {}; } });
  r = await w.fetch(postV(), { ANTHROPIC_API_KEY: 'k', CX_KV: makeKV(), IP_SALT: 's' });
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

  // 0.9.34 ships both artifacts together — EXPAND_SYSTEM is byte-identical
  // across them by build guard, so a prompt fix cannot be worker-only.
  const mv = JSON.parse(readFileSync(rel('../extension/manifest.json'), 'utf8')).version;
  t('worker and extension ship the same number this release', BUILD_SEEN === mv,
    'worker ' + BUILD_SEEN + ' vs extension ' + mv);
}


globalThis.fetch = realFetch;
console.log(fails.length ? '\nFAILED: ' + fails.join(', ') : '\nall worker checks passed');
process.exit(fails.length ? 1 : 0);
