/* CONTEXA extension tests — no browser, no network.
   Run from the extension/ directory:  node test.mjs

   Loads background.js in a sandbox with a fake `chrome` and a fake `fetch`, so the
   model-resolution and migration logic can be checked without clicking through
   Chrome. Written because the storage-freeze bug shipped nine times undetected:
   a stored default silently overrode every later shipped default, and nothing in
   the codebase could have told us. */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync('./background.js', 'utf8');

/* ---- harness ------------------------------------------------------------- */
function load({ storage = {} } = {}) {
  const store = { ...storage };
  const writes = [];
  const listeners = { message: [], installed: [], startup: [] };
  const requests = [];

  const chrome = {
    storage: {
      local: {
        async get(defaults) {
          if (typeof defaults === 'string') return { [defaults]: store[defaults] };
          const out = {};
          for (const [k, d] of Object.entries(defaults || {})) {
            out[k] = k in store ? store[k] : d;
          }
          return out;
        },
        async set(obj, cb) {
          Object.assign(store, obj);
          writes.push(obj);
          if (cb) cb();
        }
      }
    },
    runtime: {
      onMessage: { addListener: f => listeners.message.push(f) },
      onInstalled: { addListener: f => listeners.installed.push(f) },
      onStartup: { addListener: f => listeners.startup.push(f) },
      openOptionsPage() {}
    },
    action: { onClicked: { addListener() {} } }
  };

  // Fake upstream: records the request and returns a well-formed Anthropic reply.
  const fetchStub = async (url, opts) => {
    requests.push({ url, body: JSON.parse(opts?.body || '{}'), headers: opts?.headers || {} });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          stop_reason: 'end_turn',
          content: [{ text: JSON.stringify({ questions: [{ label: 'Do the thing', text: 'Do it.', evidence: 'rrrr' }] }) }]
        };
      },
      async text() { return ''; }
    };
  };

  const sandbox = {
    chrome, fetch: fetchStub, console: { log() {}, warn() {}, error() {} },
    crypto: { randomUUID: () => '11111111-2222-3333-4444-555555555555' },
    setTimeout, clearTimeout, URL, TextEncoder, JSON, Object, Array, String, Number,
    Math, Date, Promise, Error, RegExp, Set, Map, isNaN, parseInt, parseFloat
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);

  const send = (msg) => new Promise(resolve => {
    listeners.message[0](msg, {}, resolve);
  });
  const fire = async (kind) => { for (const f of listeners[kind]) await f(); };

  return { store, writes, requests, send, fire, sandbox };
}

const fails = [];
const t = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!cond) fails.push(name);
};
const settle = () => new Promise(r => setTimeout(r, 0));

/* ---- 1. migration clears a superseded default ---------------------------- */
{
  const h = load({ storage: { model: 'claude-haiku-4-5', apiKey: 'sk-x' } });
  await settle();   // top-level migrateStoredModel() is a floating promise
  t('superseded stored model is cleared', h.store.model === '', JSON.stringify(h.store.model));
}

/* ---- 2. a deliberate override survives ----------------------------------- */
{
  const h = load({ storage: { model: 'claude-opus-5', apiKey: 'sk-x' } });
  await settle();
  t('deliberate override is preserved', h.store.model === 'claude-opus-5', h.store.model);
  t('preserving costs no write', h.writes.length === 0, 'writes=' + h.writes.length);
}

/* ---- 3. already-empty storage is left alone ------------------------------ */
{
  const h = load({ storage: { model: '', apiKey: 'sk-x' } });
  await settle();
  t('empty stored model needs no write', h.writes.length === 0, 'writes=' + h.writes.length);
}

/* ---- 4. empty stored model resolves to the shipped default --------------- */
{
  const h = load({ storage: { model: '', apiKey: 'sk-x' } });
  await settle();
  await h.send({ type: 'nextSteps', prompt: 'p', reply: 'r'.repeat(80) });
  const used = h.requests[0]?.body?.model;
  t('empty model resolves to shipped default', used === 'claude-sonnet-5', String(used));
}

/* ---- 5. a stored override still wins ------------------------------------- */
{
  const h = load({ storage: { model: 'claude-opus-5', apiKey: 'sk-x' } });
  await settle();
  await h.send({ type: 'nextSteps', prompt: 'p', reply: 'r'.repeat(80) });
  t('stored override is used', h.requests[0]?.body?.model === 'claude-opus-5',
    String(h.requests[0]?.body?.model));
}

/* ---- 6. the migrated case ends up on Sonnet, end to end ------------------ */
{
  const h = load({ storage: { model: 'claude-haiku-4-5', apiKey: 'sk-x' } });
  await settle();
  await h.send({ type: 'nextSteps', prompt: 'p', reply: 'r'.repeat(80) });
  t('a frozen-on-Haiku install now calls Sonnet',
    h.requests[0]?.body?.model === 'claude-sonnet-5', String(h.requests[0]?.body?.model));
}

/* ---- 7. migration is registered on install AND startup ------------------- */
{
  const h = load({ storage: { model: 'claude-haiku-4-5' } });
  await settle();
  h.store.model = 'claude-haiku-4-5';   // simulate a re-freeze
  await h.fire('installed');
  t('onInstalled runs the migration', h.store.model === '', h.store.model);
  h.store.model = 'claude-haiku-4-5';
  await h.fire('startup');
  t('onStartup runs the migration', h.store.model === '', h.store.model);
}

/* ---- 8. ping and getConfig name the model -------------------------------- */
{
  const h = load({ storage: { model: '', apiKey: 'sk-x' } });
  await settle();
  const cfg = await h.send({ type: 'getConfig' });
  t('getConfig exposes the shipped model', cfg?.shippedModel === 'claude-sonnet-5',
    JSON.stringify(cfg));
  const ping = await h.send({ type: 'ping' });
  t('ping reports which model answered', ping?.model === 'claude-sonnet-5', JSON.stringify(ping));
}

/* ---- 9. no key = nothing goes to Anthropic ------------------------------- */
{
  const h = load({ storage: { model: '', apiKey: '' } });
  await settle();
  await h.send({ type: 'nextSteps', prompt: 'p', reply: 'r'.repeat(80) });
  const anthropic = h.requests.filter(r => String(r.url).includes('api.anthropic.com'));
  t('keyless install never calls Anthropic directly', anthropic.length === 0,
    'calls=' + anthropic.length);
}


/* ---- 10. capture: the DOM walker that feeds the model -------------------- */
/* Extracted from content.js and run against a hand-rolled DOM, because the two
   capture defects (glued paragraphs, whole code blocks) shipped invisibly for
   ten versions: nothing ever looked at what the model actually receives. */
{
  /* Source-matching regexes below use \r?\n: git checks content.js out with
     CRLF on Windows (core.autocrlf), so a bare \n after a literal character
     never matches there. */
  const csrc = readFileSync('./content.js', 'utf8');
  const m = csrc.match(/const BLOCK_TAGS[\s\S]*?\.trim\(\);\r?\n  \}/);
  if (!m) { t('captureText found in content.js', false); }
  else {
    const { captureText, summarizeCode } =
      new Function(m[0] + '; return { captureText, summarizeCode };')();
    const T = s => ({ nodeType: 3, nodeValue: s });
    const E = (tag, ...children) => ({ nodeType: 1, tagName: tag, childNodes: children });

    // Paragraphs get real line breaks (textContent glued them: "one.Two")
    const para = captureText(E('DIV', E('P', T('First paragraph.')), E('P', T('Second one.'))));
    t('paragraphs are separated by a newline', para === 'First paragraph.\nSecond one.',
      JSON.stringify(para));

    // Code collapses to first lines + marker; the bulk never ships
    const code = 'function trimPayload(value) {\n  const t = String(value);\n  mid1;\n  mid2;\n  mid3;\n}';
    const doc = E('DIV',
      E('P', T('Here is the fix:')),
      E('DIV', T('javascript'), E('BUTTON', T('Copy'))),
      E('PRE', E('CODE', T(code))));
    const out = captureText(doc);
    t('code keeps its first lines as anchors', out.includes('function trimPayload(value) {'), out);
    t('code bulk is replaced by a count marker', out.includes('[+4 more lines of code]'), out);
    t('code bulk itself never ships', !out.includes('mid3'));
    t('copy-button chrome is skipped', !out.includes('Copy'), out);

    // Short snippets ship whole — collapsing them would cost more than it saves
    const short = captureText(E('PRE', E('CODE', T('const a = 1;\nconst b = 2;'))));
    t('short code ships whole', short === 'const a = 1;\nconst b = 2;', JSON.stringify(short));
    t('short code has no marker', !short.includes('more lines'));

    // BR produces a break
    const br = captureText(E('P', T('line one'), E('BR'), T('line two')));
    t('BR becomes a newline', br === 'line one\nline two', JSON.stringify(br));

    // Size: a code-heavy reply shrinks to a fraction
    const bigCode = Array.from({length: 80}, (_, i) => '  statement_' + i + '();').join('\n');
    const heavy = E('DIV', E('P', T('Analysis of the bug follows.')), E('PRE', E('CODE', T(bigCode))));
    const captured = captureText(heavy);
    const rawLen = ('Analysis of the bug follows.' + bigCode).length;
    t('code-heavy reply shrinks by >80%', captured.length < rawLen * 0.2,
      rawLen + ' -> ' + captured.length);
  }
}

/* ---- 11. the prompt carries the no-code rule ------------------------------ */
{
  t('prompt rule: questions end in a question mark', SRC.includes('ending in a question mark'));
}


/* ---- 12. the error call site actually passes resp ------------------------ */
/* The diag pipeline was built across three versions — worker computes it,
   background forwards it, renderQuiet renders it — and the single call site
   joining the last two links dropped it: renderQuiet(anchor,'error',reason)
   with no resp. Every truncation card ever shown was bare because of four
   missing characters. Each LINK had a test; the JOINT had none. */
{
  const csrc2 = readFileSync('./content.js', 'utf8');
  const site = csrc2.match(/renderQuiet\(anchor, 'error',[\s\S]{0,180}?\);/);
  t('error render call passes resp through', !!site && /,\s*resp\s*\)/.test(site[0]),
    site ? site[0].replace(/\s+/g, ' ').slice(0, 90) : 'call site not found');
}


/* ---- 13. partial salvage is invisible in UI but loud in the console ------ */
/* Owner's decision (0.9.14): a salvaged set renders identically to a full one
   (best-prefix argument), but the ceiling-hit signal must not vanish - it
   moves to the console where remote debugging can still count it. */
{
  const csrc3 = readFileSync('./content.js', 'utf8');
  t('no partial banner markup remains', !csrc3.includes('cut short'));
  t('renderSteps no longer takes a partial flag', /function renderSteps\(anchor, steps, ctx\)/.test(csrc3));
  t('partial still logs to the console at log level', /resp\.partial === true[\s\S]{0,700}console\.log\('\[CONTEXA\] partial salvage/.test(csrc3));
  t('partial logger is not warn (Errors-badge fix)', !/console\.warn\('\[CONTEXA\] partial salvage/.test(csrc3));
}


/* ---- 16. SPEC §3.2: the capture marker ------------------------------------- */
{
  const csrc5 = readFileSync('./content.js', 'utf8');
  const m = csrc5.match(/const CAPTURE_WINDOW[\s\S]*?return cut\.trimEnd\(\) \+ CAPTURE_MARKER;\r?\n  \}/);
  if (!m) { t('clampCapture found in content.js', false); }
  else {
    const { clampCapture, CAPTURE_MARKER } =
      new Function(m[0] + '; return { clampCapture, CAPTURE_MARKER };')();
    const short = 'a'.repeat(500);
    t('under-window capture is untouched, no marker', clampCapture(short) === short);

    const lines = Array.from({ length: 400 }, (_, i) => 'line ' + i + ' of the very long reply body').join('\n');
    const out = clampCapture(lines);
    t('over-window output <= 6000 incl marker', out.length <= 6000, 'len=' + out.length);
    t('marker is the final line', out.endsWith(CAPTURE_MARKER));
    t('cut falls at a clean boundary', /reply body\n\[capture window ends here/.test(out));

    // THE JOINT TEST (spec 3.2 rule 3): the worker independently slices at
    // 6000; client output must pass through that slice byte-identical.
    t('marker survives the server slice', out.slice(0, 6000) === out);

    const noNewlines = 'w'.repeat(9000);
    const out2 = clampCapture(noNewlines);
    t('no-boundary input still fits with marker', out2.length <= 6000 && out2.endsWith(CAPTURE_MARKER));
  }
}

/* ---- 17. SPEC §2.1/§2.6: evidence validation, own-key path ----------------- */
{
  const REPLY = 'alpha beta gamma delta '.repeat(6);
  const h = load({ storage: { model: '', apiKey: 'sk-x' } });
  await settle();
  h.sandbox.fetch = async (url, opts) => ({
    ok: true, status: 200,
    async json() { return { stop_reason: 'end_turn', content: [{ text: JSON.stringify({ questions: [
      { label: 'Grounded step', text: 'Do the grounded thing.', evidence: 'beta gamma' },
      { label: 'No evidence step', text: 'Should be dropped.' },
      { label: 'Ungrounded step', text: 'Renders but logged.', evidence: 'zzz never said' }
    ] }) }] }; },
    async text() { return ''; }
  });
  const out = await h.send({ type: 'nextSteps', prompt: 'p', reply: REPLY });
  t('evidence-less question is dropped', out.questions && out.questions.length === 2,
    'kept=' + (out.questions && out.questions.length));
  t('no question carries an evidence key', out.questions && out.questions.every(s => !('evidence' in s)));
  t('grounding counts are right', out.grounding &&
    out.grounding.total === 3 && out.grounding.kept === 2 && out.grounding.grounded === 1,
    JSON.stringify(out.grounding));
}
{
  // all steps evidence-less => no_steps, and nothing cached
  const h = load({ storage: { model: '', apiKey: 'sk-x' } });
  await settle();
  h.sandbox.fetch = async () => ({
    ok: true, status: 200,
    async json() { return { stop_reason: 'end_turn', content: [{ text: JSON.stringify({ questions: [
      { label: 'A', text: 'no evidence here' } ] }) }] }; },
    async text() { return ''; }
  });
  const out = await h.send({ type: 'nextSteps', prompt: 'p2', reply: 'r'.repeat(80) });
  t('all-evidence-less becomes no_steps', out.error === 'no_steps', JSON.stringify(out));
}


/* ---- 18. stale-error classifier knows every Chrome phrasing --------------- */
/* Field event: an extension reload mid-generation closed the message channel,
   and Chrome's actual wording ("message channel closed") missed the regex
   ("message port closed"), rendering raw plumbing text instead of the friendly
   reload notice. Pin the classifier against the exact strings Chrome emits. */
{
  const csrc6 = readFileSync('./content.js', 'utf8');
  const m = csrc6.match(/const isStaleError = e =>\n?\s*(\/.*\/i)\.test/);
  if (!m) { t('isStaleError found', false); }
  else {
    const re = new Function('return ' + m[1])();
    const mustMatch = [
      'Error: Extension context invalidated.',
      'Error: Could not establish connection. Receiving end does not exist.',
      'Error: The message port closed before a response was received.',
      'Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received',
    ];
    for (const msg of mustMatch) t('stale classifier matches: ' + msg.slice(7, 47) + '…', re.test(msg));
    t('stale classifier ignores unrelated errors', !re.test('Error: network timeout') && !re.test('api_529'));
  }
}


/* ---- v0.9.20: thinking explicitly disabled -------------------------------- */
/* Sonnet 5 turned adaptive thinking ON by default for requests without a
   thinking field; the field-observed failure was 2,500 tokens of thinking and
   zero text. Pin the disable on the wire, not just in intent. */
{
  const h = load({ storage: { model: '', apiKey: 'sk-x' } });
  await settle();
  await h.send({ type: 'nextSteps', prompt: 'p', reply: 'r'.repeat(80) });
  t('own-key request disables thinking', h.requests[0].body.thinking && h.requests[0].body.thinking.type === 'disabled',
    JSON.stringify(h.requests[0].body.thinking));
}


/* ---- v0.9.21: thinking-rejection retry + error observability -------------- */
{
  // A model that rejects the thinking config gets one retry without it.
  const h = load({ storage: { model: 'claude-fable-5', apiKey: 'sk-x' } });
  await settle();
  let call = 0;
  h.sandbox.fetch = async (url, opts) => {
    call++;
    const body = JSON.parse(opts.body);
    if (body.thinking) return { ok: false, status: 400,
      async text() { return '{"error":{"message":"thinking cannot be disabled on this model"}}'; },
      async json() { return {}; } };
    return { ok: true, status: 200,
      async json() { return { stop_reason: 'end_turn', content: [{ text: JSON.stringify({ questions: [{ label: 'A', text: 'Do.', evidence: 'rrrr' }] }) }] }; },
      async text() { return ''; } };
  };
  const out = await h.send({ type: 'nextSteps', prompt: 'p', reply: 'r'.repeat(80) });
  t('thinking-400 retried without the field', call === 2, 'calls=' + call);
  t('retry succeeds and returns steps', out.questions && out.questions.length === 1, JSON.stringify(out.questions));
}
{
  // A non-thinking 400 is NOT retried, and its detail survives to the caller.
  const h = load({ storage: { model: '', apiKey: 'sk-x' } });
  await settle();
  let call = 0;
  h.sandbox.fetch = async () => { call++; return { ok: false, status: 400,
    async text() { return '{"error":{"message":"max_tokens is too large"}}'; },
    async json() { return {}; } }; };
  const out = await h.send({ type: 'nextSteps', prompt: 'p2', reply: 'r'.repeat(80) });
  t('unrelated 400 not retried', call === 1, 'calls=' + call);
  t('error detail reaches the response', out.error === 'api_400' && /max_tokens/.test(out.detail || ''),
    JSON.stringify(out));
}
{
  const csrc7 = readFileSync('./content.js', 'utf8');
  t('card renders the API detail', /resp && resp\.detail/.test(csrc7) && csrc7.includes('detail:'));
}

/* ---- v0.9.23: the fifth chip — expandPrompt handler ----------------------- */
{
  // own-key path: the writer system on the wire, 1200 ceiling, thinking disabled,
  // labeled sections — pinned so hosted and own-key stay the same product.
  const h = load({ storage: { model: '', apiKey: 'sk-x' } });
  await settle();
  let sent = null;
  h.sandbox.fetch = async (url, opts) => {
    sent = JSON.parse(opts.body);
    return { ok: true, status: 200,
      async json() { return { stop_reason: 'end_turn',
        content: [{ text: JSON.stringify({ prompt: 'Do the specific thing.\n- one constraint' }) }] }; },
      async text() { return ''; } };
  };
  const out = await h.send({ type: 'expandPrompt', intent: 'do thing', prompt: 'p', reply: 'r'.repeat(80) });
  t('expand returns the drafted prompt', out.prompt === 'Do the specific thing.\n- one constraint',
    JSON.stringify(out));
  t('expand uses the writer system', /prompt writer/.test(sent.system || ''), (sent.system || '').slice(0, 40));
  t('expand ceiling is 1200', sent.max_tokens === 1200, String(sent.max_tokens));
  t('expand disables thinking', sent.thinking && sent.thinking.type === 'disabled');
  t('expand sections are labeled', /^ROUGH ASK:\n/.test(sent.messages[0].content) &&
    sent.messages[0].content.includes("CLAUDE'S REPLY:"), sent.messages[0].content.slice(0, 24));
}
{
  // blank intent is rejected before any call is made
  const h = load({ storage: { model: '', apiKey: 'sk-x' } });
  await settle();
  const out = await h.send({ type: 'expandPrompt', intent: '   ', prompt: 'p', reply: 'r'.repeat(80) });
  t('blank intent rejected without spend', out.error === 'bad_request' && h.requests.length === 0,
    JSON.stringify(out) + ' calls=' + h.requests.length);
}
{
  // hosted path posts to /v1/expand and passes the draft through
  const h = load({ storage: { model: '', apiKey: '' } });
  await settle();
  let hostedUrl = '';
  h.sandbox.fetch = async (url) => {
    hostedUrl = String(url);
    return { ok: true, status: 200, async json() { return { prompt: 'Hosted draft.' }; },
      async text() { return ''; } };
  };
  const out = await h.send({ type: 'expandPrompt', intent: 'x', prompt: 'p', reply: 'r'.repeat(80) });
  t('hosted expand hits /v1/expand', /\/v1\/expand$/.test(hostedUrl), hostedUrl);
  t('hosted expand returns the draft', out.prompt === 'Hosted draft.', JSON.stringify(out));
}
{
  // hosted 429 surfaces as quota — the same word the row's card already knows
  const h = load({ storage: { model: '', apiKey: '' } });
  await settle();
  h.sandbox.fetch = async () => ({ ok: false, status: 429,
    async json() { return { error: 'quota', limit: 20, resetsAt: new Date(Date.now() + 3600e3).toISOString() }; },
    async text() { return ''; } });
  const out = await h.send({ type: 'expandPrompt', intent: 'x', prompt: 'p', reply: 'r'.repeat(80) });
  t('hosted expand quota maps to quota', out.error === 'quota' && out.limit === 20, JSON.stringify(out));
}
{
  // an empty draft is an error, never an empty insert
  const h = load({ storage: { model: '', apiKey: 'sk-x' } });
  await settle();
  h.sandbox.fetch = async () => ({ ok: true, status: 200,
    async json() { return { stop_reason: 'end_turn', content: [{ text: '{"prompt":"   "}' }] }; },
    async text() { return ''; } });
  const out = await h.send({ type: 'expandPrompt', intent: 'x', prompt: 'p', reply: 'r'.repeat(80) });
  t('empty draft becomes no_prompt', out.error === 'no_prompt', JSON.stringify(out));
}
{
  // overlong drafts trim at a clean boundary, hard cap 900
  const h = load({ storage: { model: '', apiKey: 'sk-x' } });
  await settle();
  const long = ('Sentence one goes here. ').repeat(60);
  h.sandbox.fetch = async () => ({ ok: true, status: 200,
    async json() { return { stop_reason: 'end_turn', content: [{ text: JSON.stringify({ prompt: long }) }] }; },
    async text() { return ''; } });
  const out = await h.send({ type: 'expandPrompt', intent: 'x', prompt: 'p', reply: 'r'.repeat(80) });
  t('overlong draft trimmed under 900', typeof out.prompt === 'string' && out.prompt.length <= 900,
    'len=' + (out.prompt || '').length);
  t('trim ends at a clean boundary', /[.!?]$/.test(out.prompt || ''), JSON.stringify((out.prompt || '').slice(-20)));
}

/* ---- v0.9.23: fifth-chip UI + the insert guard (source assertions) --------- */
{
  const c = readFileSync('./content.js', 'utf8');
  t('rough-ask chip present', c.includes('Rough ask'));
  t('input keystrokes stopped at the shadow boundary',
    /\['keydown', 'keyup', 'keypress', 'input', 'paste'\][\s\S]{0,120}stopPropagation/.test(c));
  t('Enter submits, Escape collapses', /key === 'Enter'/.test(c) && /key === 'Escape'/.test(c));
  t('the interview carries capture context', /renderInterview\(anchor, questions\.slice\(0, 4\), ctx\)/.test(c) && /const ctx = \{ prompt: promptText, reply: replyText \}/.test(c));
  t('expand failure stays inline (no second card)', /cxerr/.test(c) && /daily limit reached/.test(c));
  /* Design-review #4, verified real in 0.9.22: insertPrompt selected all and
     typed over the user's draft. The guard and the append branch must exist —
     CONTEXA must never destroy the user's own words. */
  const ins = c.match(/function insertPrompt[\s\S]*?\n  \}/);
  t('insertPrompt guards a non-empty draft', !!ins && /existing/.test(ins[0]) && /collapse\(false\)/.test(ins[0]),
    ins ? 'guard found' : 'insertPrompt not found');
  t('empty composer still gets a clean insert', !!ins && /selectAllChildren/.test(ins[0]));
}
{
  // the EXPAND prompt carries its load-bearing rules (source assertions on SRC)
  t('expand prompt: banned filler adjectives', SRC.includes('filler quality words'));
  t('expand prompt: slot cap', SRC.includes('at most 2 slots'));
  t('expand prompt: assume-line convention', SRC.includes('"Assume:"'));
  t('expand prompt: near-verbatim on good input', SRC.includes('nearly verbatim'));
  t('expand prompt: elicit degenerate case', SRC.includes('not expandable'));
  t('expand prompt: 700-char soft cap', SRC.includes('At most 700 characters'));
  t('expand prompt: viewport marker rule present', (SRC.match(/edge of your viewport/g) || []).length >= 2);
}

/* ---- v0.9.26: the beginner release ---------------------------------------- */
{
  const c = readFileSync('./content.js', 'utf8');

  /* Streaming guard used to fail OPEN — `wrap && attr === 'true'` meant a
     renamed or relocated attribute silently disabled the guard and CONTEXA
     captured half a reply, with `processed` blocking any correction. */
  t('guard requires a positive end-of-stream signal',
    /streamFlag !== 'false' && !settled/.test(c));
  t('guard still short-circuits while streaming', /streamFlag === 'true'\) return/.test(c));
  t('settled is set only by the debounced path',
    /settleTimer = setTimeout\(\(\) => \{ settled = true; scan\(\); \}, 1200\)/.test(c));
  t('settled resets on every mutation burst', /settled = false;\r?\n      scan\(\);/.test(c));

  /* The first outside user met the bare string "forbidden_origin". */
  t('error codes are translated for humans', c.includes('function humanError'));
  t('forbidden_origin names the real cause',
    c.includes('wasn’t installed from the Chrome Web Store'));
  t('forbidden_origin offers the store, not settings',
    /btn: 'Get CONTEXA', url: STORE_URL/.test(c));
  t('store URL is the pinned extension id',
    c.includes('chromewebstore.google.com/detail/phhamigkjeeabbjncpmhkppkjccfglhb'));
  t('raw code no longer rendered in the card', !/Couldn’t generate next steps \(<code>/.test(c));
  t('diagnostics still reach the console', /console\.warn\('\[CONTEXA\] error', reason\)/.test(c));
  t('button can open a url without chrome.*', /if \(openUrl\) return window\.open/.test(c));

  // every branch of humanError must return both a sentence and a button label
  const hm = c.match(/function humanError\(code\)[\s\S]*?\n  \}/);
  if (!hm) { t('humanError body found', false); }
  else {
    const returns = hm[0].match(/return \{[\s\S]*?\}/g) || [];
    t('humanError has a fallback plus mapped causes', returns.length >= 8, 'branches=' + returns.length);
    t('every branch has text and btn', returns.every(r => /text:/.test(r) && /btn:/.test(r)));
    t('no raw error codes leak into sentences', !/\btext: '[^']*_[a-z]+/.test(hm[0]));
  }
}

/* ---- v0.9.26: options page — expert surface hidden ------------------------ */
{
  const html = readFileSync('./options.html', 'utf8');
  const js = readFileSync('./options.js', 'utf8');
  const det = html.indexOf('<details');
  t('options page has an Advanced disclosure', det > 0);

  // the freeze bug: a concrete model must never be seeded or backfilled
  const defs = js.match(/const DEFAULTS = \{[\s\S]*?\};/);
  t('options DEFAULTS still uses the empty-model convention',
    !!defs && !/model: '[^']+'/.test(defs[0]));
  t('options never backfills an empty model field',
    !/\.value\.trim\(\)\s*\|\|\s*DEFAULTS\.model/.test(js));

  for (const id of ['apiKey', 'model', 'proxyUrl', 'test']) {
    const at = html.indexOf('id="' + id + '"');
    t('expert control hidden behind Advanced: ' + id, at > det, 'at=' + at);
  }
  for (const id of ['enabled', 'stateTitle', 'quotaLine']) {
    const at = html.indexOf('id="' + id + '"');
    t('beginner control on the default view: ' + id, at > 0 && at < det, 'at=' + at);
  }
  // every id the script reaches for must exist, or the page dies silently
  const used = [...js.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]);
  const missing = [...new Set(used)].filter(id => !html.includes('id="' + id + '"'));
  t('every id used by options.js exists in the html', missing.length === 0, missing.join(','));

  t('the switch saves itself (no lost toggle)',
    /\$\('enabled'\)\.addEventListener\('change'[\s\S]{0,200}chrome\.storage\.local\.set/.test(js));
  t('shipped model is asked for, not copied', /type: 'getConfig'/.test(js));
  t('options translates codes too', /forbidden_origin/.test(js));
  t('page states it is not affiliated', /not affiliated with Anthropic/i.test(html));
}

/* ---- v0.9.27: one save rule, and copy that doesn't overclaim ------------- */
{
  const js = readFileSync('./options.js', 'utf8');
  const html = readFileSync('./options.html', 'utf8');

  /* 0.9.26 taught two rules — switch self-saved, fields waited for Save — and
     the author of the requirements still lost a change to it. */
  t('advanced fields save on blur', /addEventListener\('blur', \(\) => saveField/.test(js));
  t('Enter commits the field too', /e\.key === 'Enter'[\s\S]{0,60}el\.blur\(\)/.test(js));
  t('the Save button is gone', !html.includes('id="save"') && !js.includes("$('save')"));
  t('the page states the rule', /save on their own/i.test(html));
  t('saveField never backfills a default',
    !/\.value\.trim\(\)\s*\|\|\s*DEFAULTS\./.test(js));
  t('every field is wired to saveField',
    ["'apiKey'", "'model'", "'proxyUrl'"].every(k => js.includes(k)) && js.includes('function saveField'));
  t('Test no longer writes before testing',
    !/\$\('test'\)[\s\S]{0,200}chrome\.storage\.local\.set/.test(js));

  const c = readFileSync('./content.js', 'utf8');
  t('no invented recovery time', !/usually back within a minute/.test(c));
  t('network error names the user connection too',
    c.includes('Check your connection and try again in a moment'));
  t('lost-connection card offers Reload, not Settings',
    /btn: 'Reload', reload: true/.test(c));
  t('reload flag is actually honoured', /mode === 'stale' \|\| doReload/.test(c));
  t('quota card no longer pitches an API key on the beginner surface',
    !/add your own API key for unlimited use/.test(c));
  t('quota card says what happened in plain words',
    /free prompts for today/.test(c));

  // nothing user-facing may name a raw error code
  const humanTexts = [...c.matchAll(/text: '([^']*)'/g)].map(m => m[1]);
  t('no user-facing sentence contains an error code',
    humanTexts.every(x => !/\b[a-z]+_[a-z0-9]+\b/.test(x)), humanTexts.find(x => /\b[a-z]+_[a-z0-9]+\b/.test(x)) || '');
  t('every user-facing sentence ends in a full stop',
    humanTexts.every(x => /[.!?]$/.test(x)));
}

/* ---- v0.9.30: the interview ----------------------------------------------
   The core changed again, this time in shape rather than degree: CONTEXA no
   longer writes the user's next message, it asks the user the questions whose
   answers become that message. Three things these assertions exist to protect:

   (a) Zero. Silence stayed reachable through two rewrites and every padding
       defect in the pattern file traces back to a floor. Nothing may put one
       back, in the prompt or in code.
   (b) The options. Someone who cannot specify the work usually cannot fill an
       empty box either — they recognise a good answer without being able to
       produce one. Options ARE the product, and an "other"/"skip" option is a
       wasted slot because the interface supplies both itself.
   (c) The evidence contract, declared untouchable and now guarding questions
       instead of steps. A question with nothing to quote is an invented one. */
{
  t('prompt: zero to four questions', SRC.includes('BETWEEN ZERO AND FOUR questions'));
  t('prompt: zero is a real answer', SRC.includes('Zero is a real answer'));
  t('prompt: the reply decides the number', SRC.includes('let the reply decide the number'));
  t('prompt: no floor language anywhere',
    !/BETWEEN THREE AND FIVE|three to five|Three is the floor|AT MOST ONE step/.test(SRC));
  t('prompt: schema is questions, zero to four', SRC.includes('zero to four items'));

  // The options, and the reason they exist.
  t('prompt: options are named as the product', SRC.includes('THE OPTIONS ARE THE PRODUCT'));
  t('prompt: two to four options each', SRC.includes('TWO TO FOUR options'));
  t('prompt: options are concrete, not categories', SRC.includes('a concrete answer rather than a category'));
  t('prompt: never an other/skip option', SRC.includes('Never write an option meaning "other"'));
  t('prompt: most likely option first', SRC.includes('most likely first'));

  // Aimed at the user, and past the immediate turn.
  t('prompt: asks only what the user can answer', SRC.includes('Ask what only the user can answer'));
  t('prompt: never asks what Claude could work out', SRC.includes('something Claude could work out for itself'));
  t('prompt: refuses to hand vagueness back', SRC.includes('do not hand the vagueness back'));
  t('prompt: reaches past the immediate turn', SRC.includes('Look past the immediate turn'));
  t('prompt: no click-paths at the user', SRC.includes('Never ask the user to click, open, enable or navigate'));

  // The untouchable rule, now guarding questions.
  t('prompt: evidence verbatim from the reply', SRC.includes('earned by a verbatim fragment of the reply'));
  t('prompt: no evidence, no question', SRC.includes('No quotable evidence, no question.'));
  t('prompt: label clamp stated at 3 words', SRC.includes('AT MOST 3 WORDS'));

  /* Exemplars over rules — the 0.9.25 lesson, and all four are real: three
     captured exchanges plus the empty case, which is the one most likely to be
     forgotten precisely because it produces nothing to look at. */
  t('prompt: worked exemplars present', SRC.includes('Worked examples, from real exchanges'));
  t('prompt: speech exemplar with real options', SRC.includes('"~2 min (short toast)"'));
  t('prompt: brainstorm exemplar present', SRC.includes('How far out should the ideas go?'));
  t('prompt: single-question exemplar refuses to pad', SRC.includes('Do not invent two more to fill the questionnaire'));
  t('prompt: the empty questionnaire is exemplified', SRC.includes('returns {"questions":[]}'));

  /* The sanitiser must live in BOTH copies: hosted and own-key users cannot be
     handed different option sets. */
  const bsrc = readFileSync('./background.js', 'utf8');
  t('option sanitiser present in background', bsrc.includes('function cleanOptions'));
  t('sanitiser strips an other/skip choice', /OTHER_RE = \/\^\(other\|something else/.test(bsrc));
  t('sanitiser caps options at four', /out\.length === 4/.test(bsrc));
  t('background returns questions, not steps', bsrc.includes('questions: withEv.slice(0, 4)'));
  t('background still splits the two silences', /grounding\.total === 0[\s\S]{0,80}quiet: true/.test(bsrc));

  /* The card mounts above the composer as ONE node for the page. A regression
     here is invisible in a screenshot but stacks a card per reply. */
  const csrc7 = readFileSync('./content.js', 'utf8');
  t('interview renderer exists', csrc7.includes('function renderInterview'));
  t('card mounts above the composer, not after the reply',
    csrc7.includes('host.before(holder)') && !csrc7.includes('anchor.after(holder)'));
  t('exactly one card survives at a time',
    /for \(const old of document\.querySelectorAll\('\[data-contexa\]'\)\) old\.remove\(\)/.test(csrc7));
  t('a missing composer is survived, not thrown', /const host = mountHost\(\);\n\s*if \(!host\) return null;/.test(csrc7));
  t('the stale sibling dedupe is gone', !csrc7.includes("nextElementSibling?.getAttribute?.('data-contexa')"));

  // Interaction: numbers pick, skip answers blank, dismiss loses nothing.
  t('number keys pick an option', /const n = parseInt\(e\.key, 10\)/.test(csrc7));
  t('skip records a blank answer', /skip\.addEventListener\('click', \(\) => answer\(''\)\)/.test(csrc7));
  t('dismiss falls back to the Rough ask chip', /function dismiss\(\) \{[\s\S]{0,220}renderSteps\(anchor, \[\], ctx\)/.test(csrc7));
  t('everything skipped composes nothing', csrc7.includes('if (!parts.length) return dismiss();'));
  t('interview keystrokes stopped at the shadow boundary',
    /for \(const evt of \['keydown', 'keyup', 'keypress', 'input', 'paste'\]\)/.test(csrc7));
  t('focus is not stolen from someone mid-sentence', csrc7.includes('const typing = active &&'));

  // Zero, end to end.
  t('zero questions renders the Rough ask chip alone',
    /if \(!questions\.length\) \{[\s\S]{0,220}renderSteps\(anchor, \[\], ctx\)/.test(csrc7));
  t('the quiet row is logged', csrc7.includes('[CONTEXA] quiet row'));

  /* An interview spends two calls, so the honest headline is half the counter.
     Three surfaces state the allowance and they must not disagree. */
  t('quota card halves the raw limit', csrc7.includes('Math.floor(limit / 2)'));
  const oh = readFileSync('./options.html', 'utf8'), oj = readFileSync('./options.js', 'utf8');
  t('options page states 10 prompts a day', /10 prompts a day/.test(oh) && /10 prompts a day/.test(oj));
  t('no surface still claims 20', !/20 suggestion sets|20 sets a day|20 free suggestions/.test(oh + oj + csrc7));

  // Capability knowledge still lives in the prompt, so its staleness marker must too.
  t('audit marker survives', /CAPABILITY-AUDIT: \d{4}-\d{2}-\d{2}/.test(bsrc));
  const promptOnly = (bsrc.match(/QUESTIONS_SYSTEM = `([\s\S]*?)`;/) || [])[1] || '';
  t('audit marker stays outside the prompt string', promptOnly.length > 0 && !promptOnly.includes('CAPABILITY-AUDIT'));
}

{
  /* Functional: an "Other" option coming back from the model is stripped rather
     than rendered, and options survive the own-key path intact. */
  const REPLY = 'alpha beta gamma delta '.repeat(6);
  const h = load({ storage: { model: '', apiKey: 'sk-x' } });
  await settle();
  h.sandbox.fetch = async () => ({
    ok: true, status: 200,
    async json() { return { stop_reason: 'end_turn', content: [{ text: JSON.stringify({ questions: [
      { label: 'Length', text: 'How long should it run?',
        options: ['~2 min', '~5 min', 'Something else', '~2 min', '~10 min', '20+ min'],
        evidence: 'beta gamma' }
    ] }) }] }; },
    async text() { return ''; }
  });
  const out = await h.send({ type: 'nextSteps', prompt: 'p', reply: REPLY });
  const opts = out.questions && out.questions[0] && out.questions[0].options;
  t('options survive the own-key path', Array.isArray(opts) && opts[0] === '~2 min', JSON.stringify(opts));
  t('an "other" option is stripped', Array.isArray(opts) && !opts.includes('Something else'), JSON.stringify(opts));
  t('a duplicate option is stripped', Array.isArray(opts) && opts.filter(o => o === '~2 min').length === 1);
  t('options are capped at four', Array.isArray(opts) && opts.length <= 4, 'len=' + (opts && opts.length));
}

console.log(fails.length ? '\nFAILED: ' + fails.join(', ') : '\nall extension checks passed');
process.exit(fails.length ? 1 : 0);
