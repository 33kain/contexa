/* CONTEXA extension tests — no browser, no network.
   Run from the extension/ directory:  node test.mjs

   Loads background.js in a sandbox with a fake `chrome` and a fake `fetch`, so the
   model-resolution and migration logic can be checked without clicking through
   Chrome. Written because the storage-freeze bug shipped nine times undetected:
   a stored default silently overrode every later shipped default, and nothing in
   the codebase could have told us. */

import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync('./background.js', 'utf8');

/* ---- harness ------------------------------------------------------------- */
function load({ storage = {}, session = {} } = {}) {
  const store = { ...storage };
  /* storage.session is passed BY REFERENCE, not copied. That is the whole point:
     handing the same object to a second load() is an MV3 service-worker teardown
     with the browser session still alive, which is the case the row cache exists
     to survive. */
  const sess = session;
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
      },
      session: {
        async get(defaults) {
          const out = {};
          for (const [k, v] of Object.entries(defaults || {})) out[k] = k in sess ? sess[k] : v;
          return out;
        },
        async set(obj) { Object.assign(sess, obj); },
        async remove(k) { for (const key of [].concat(k)) delete sess[key]; }
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
          content: [{ text: JSON.stringify({ moves: [{ label: 'Do the thing', text: 'Do it.', evidence: 'rrrr' }] }) }]
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

  return { store, sess, writes, requests, send, fire, sandbox };
}

const fails = [];
const t = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!cond) fails.push(name);
};
const settle = () => new Promise(r => setTimeout(r, 0));

/* The session every harness send carries. `nextSteps` refuses a request with no
   turns before it does anything else, so this is not decoration — a send
   without it exercises the guard rather than the path under test. */
const TURNS = [
  { i: 1, text: 'make me a website for my bakery' },
  { i: 2, text: 'can you add the opening hours' },
  { i: 3, text: 'now the menu page' }
];

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
  await h.send({ type: 'nextSteps', reply: 'r'.repeat(80), turns: TURNS });
  const used = h.requests[0]?.body?.model;
  t('empty model resolves to shipped default', used === 'claude-sonnet-5', String(used));
}

/* ---- 5. a stored override still wins ------------------------------------- */
{
  const h = load({ storage: { model: 'claude-opus-5', apiKey: 'sk-x' } });
  await settle();
  await h.send({ type: 'nextSteps', reply: 'r'.repeat(80), turns: TURNS });
  t('stored override is used', h.requests[0]?.body?.model === 'claude-opus-5',
    String(h.requests[0]?.body?.model));
}

/* ---- 6. the migrated case ends up on Sonnet, end to end ------------------ */
{
  const h = load({ storage: { model: 'claude-haiku-4-5', apiKey: 'sk-x' } });
  await settle();
  await h.send({ type: 'nextSteps', reply: 'r'.repeat(80), turns: TURNS });
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
  await h.send({ type: 'nextSteps', reply: 'r'.repeat(80), turns: TURNS });
  const anthropic = h.requests.filter(r => String(r.url).includes('api.anthropic.com'));
  t('keyless install never calls Anthropic directly', anthropic.length === 0,
    'calls=' + anthropic.length);
}


/* ---- 9b. the row cache survives an MV3 teardown -------------------------- */
/* The symptom this fixes was invisible for weeks: the same reply gave four good
   moves on one click and "Nothing for now." on the next, an hour apart, on the
   same thread. The cache was a plain Map in the service worker, MV3 tore the
   worker down between clicks, and the second click was a fresh call and a fresh
   sample. A row the user had already seen simply evaporated, and it cost quota
   to re-roll. Handing the SAME session object to a second load() is that
   teardown. */
{
  const session = {};
  const first = load({ storage: { model: '', apiKey: 'sk-x' }, session });
  await settle();
  /* A move that actually SURVIVES the gate. Written after a version of this
     test cached a fixture the gates dropped and sat there comparing [] with [],
     proving nothing — so the fixture is turn-earned AND opens on a production
     verb, and stays that way whatever the gates become. */
  first.sandbox.fetch = async (url, opts) => {
    first.requests.push({ url, body: JSON.parse(opts?.body || '{}') });
    return { ok: true, status: 200, async text() { return ''; },
      async json() { return { stop_reason: 'end_turn', content: [{ text: JSON.stringify({ moves: [
        { label: 'Write the menu page', text: 'Write the menu page.', evidence: 'now the menu page' }
      ] }) }] }; } };
  };
  const a = await first.send({ type: 'nextSteps', reply: 'r'.repeat(80), turns: TURNS });
  t('a successful row is cached', first.requests.length === 1 && a.moves.length === 1,
    'calls=' + first.requests.length + ' moves=' + JSON.stringify(a.moves.map(m => m.label)));

  // The worker dies; the browser session does not.
  const second = load({ storage: { model: '', apiKey: 'sk-x' }, session });
  await settle();
  const b = await second.send({ type: 'nextSteps', reply: 'r'.repeat(80), turns: TURNS });
  t('and survives the worker being torn down',
    JSON.stringify(b.moves) === JSON.stringify(a.moves), JSON.stringify(b.moves));
  t('and the re-click costs no second model call',
    second.requests.length === 0, 'calls=' + second.requests.length);
}
{
  /* An error is never cached: a gate can empty a call that itself succeeded, and
     a cached failure would outlive the thing that caused it. */
  const session = {};
  const h = load({ storage: { model: '', apiKey: 'sk-x' }, session });
  await settle();
  h.sandbox.fetch = async () => ({ ok: false, status: 500,
    async text() { return 'boom'; }, async json() { return {}; } });
  const bad = await h.send({ type: 'nextSteps', reply: 'r'.repeat(80), turns: TURNS });
  t('an error response is not cached', !!bad.error && !JSON.stringify(session).includes('error'),
    JSON.stringify(session).slice(0, 80));
}

/* ---- 9c. the own-key path caches the system prompt ----------------------- */
/* Until 0.9.72 only the worker sent the ~2.4k-token prefix as a cacheable block;
   callClaude sent a bare string, so an own-key press paid full input price for
   the same bytes on every click. The product was identical either way, which is
   exactly why nothing here caught it. These are the worker's caching tests,
   run against this path: the block reaches the wire, nothing is interpolated
   into it, a cache-rejecting 400 falls back to a plain string, the two
   degradations are independent, and an unrelated 400 is not mistaken for one. */
{
  const sysText = (v) => Array.isArray(v) ? v.map(b => b && b.text || '').join('') : String(v || '');
  const okOnce = () => ({ ok: true, status: 200, async text() { return ''; },
    async json() { return { stop_reason: 'end_turn',
      usage: { input_tokens: 500, output_tokens: 200, cache_read_input_tokens: 2400, cache_creation_input_tokens: 0 },
      content: [{ type: 'text', text: JSON.stringify({ moves: [
        { label: 'Write the menu page', text: 'Write the menu page.', evidence: 'now the menu page' }
      ] }) }] }; } });
  const fresh = async () => { const h = load({ storage: { model: '', apiKey: 'sk-x' } }); await settle(); return h; };
  const ask = (h, reply) => h.send({ type: 'nextSteps', reply, turns: TURNS });

  // --- the prompt travels as a cached block, not a bare string ---
  {
    const h = await fresh();
    const logs = [];
    h.sandbox.console = { log: (...a) => logs.push(a), warn() {}, error() {} };
    h.sandbox.fetch = async (_u, o) => { h.requests.push({ body: JSON.parse(o.body) }); return okOnce(); };
    const r = await ask(h, 'a'.repeat(80));
    const sys = h.requests[0] && h.requests[0].body.system;
    t('own key: the system prompt travels as content blocks', Array.isArray(sys), typeof sys);
    t('own key: exactly one text block, marked cacheable',
      Array.isArray(sys) && sys.length === 1 && sys[0].type === 'text'
        && !!sys[0].cache_control && sys[0].cache_control.type === 'ephemeral',
      JSON.stringify(sys && sys[0] && sys[0].cache_control));
    /* A cache HIT needs a byte-identical prefix. Anything interpolated into the
       system text — a build stamp, a date, the user's own words — would miss on
       every call while looking perfectly correct in the logs. */
    t('own key: nothing is interpolated into the cached text',
      sysText(sys).length > 1000 && !/\d{4}-\d{2}-\d{2}/.test(sysText(sys)) && !sysText(sys).includes('a'.repeat(80)),
      String(sysText(sys).length));
    t('own key: and the row still arrives', Array.isArray(r.moves) && r.moves.length === 1, JSON.stringify(r).slice(0, 120));
    /* Whether caching WORKS is readable only from usage, so a success logs it.
       Without this line the cache was visible nowhere but the bill. */
    const usage = logs.find(a => a[0] === '[CONTEXA] usage');
    t('own key: a successful call logs the cache counters',
      !!usage && usage[1].cacheRead === 2400 && usage[1].cacheWrite === 0 && usage[1].in === 500,
      JSON.stringify(usage && usage[1]));
  }

  // --- the fallback: caching must never be why a user gets nothing ---
  {
    const h = await fresh();
    let calls = 0; const systems = [];
    h.sandbox.fetch = async (_u, o) => {
      calls++; systems.push(JSON.parse(o.body).system);
      if (calls === 1) return { ok: false, status: 400,
        async text() { return '{"error":{"message":"cache_control: unsupported"}}'; } };
      return okOnce();
    };
    const r = await ask(h, 'b'.repeat(80));
    t('own key: a cache-rejecting 400 is retried', calls === 2, 'calls=' + calls);
    t('own key: the retry drops the block and sends a byte-identical plain string',
      typeof systems[1] === 'string' && systems[1] === sysText(systems[0]), typeof systems[1]);
    t('own key: and the user still gets a row', Array.isArray(r.moves) && r.moves.length === 1, JSON.stringify(r).slice(0, 120));
  }

  // --- the two degradations are independent, and order must not matter ---
  {
    const h = await fresh();
    let calls = 0; const payloads = [];
    h.sandbox.fetch = async (_u, o) => {
      calls++; const b = JSON.parse(o.body); payloads.push(b);
      if (calls === 1) return { ok: false, status: 400, async text() { return 'thinking cannot be disabled'; } };
      if (calls === 2) return { ok: false, status: 400, async text() { return 'cache_control not supported for this model'; } };
      return okOnce();
    };
    const r = await ask(h, 'c'.repeat(80));
    t('own key: thinking then cache — both degradations fire on one request', calls === 3, 'calls=' + calls);
    t('own key: thinking is gone by the second attempt', !payloads[1].thinking);
    t('own key: caching is gone by the third', typeof payloads[2].system === 'string');
    t('own key: and the request still succeeds', Array.isArray(r.moves) && r.moves.length === 1, JSON.stringify(r).slice(0, 120));
  }

  // --- an unrelated 400 must NOT be mistaken for a cache problem ---
  {
    const h = await fresh();
    let calls = 0;
    h.sandbox.fetch = async () => { calls++; return { ok: false, status: 400,
      async text() { return 'max_tokens is too large'; } }; };
    const r = await ask(h, 'd'.repeat(80));
    t('own key: an ordinary 400 is not retried as a cache failure', calls === 1, 'calls=' + calls);
    t('own key: and it still surfaces as api_400', r.error === 'api_400', String(r.error));
  }

  // --- diag carries the cache counters, so a silently-off cache is visible ---
  {
    const h = await fresh();
    h.sandbox.fetch = async () => ({ ok: true, status: 200, async text() { return ''; },
      async json() { return { stop_reason: 'max_tokens',
        usage: { input_tokens: 3000, output_tokens: 2500, cache_read_input_tokens: 2400, cache_creation_input_tokens: 0 },
        content: [{ type: 'text', text: 'Let me think about the best next steps here.' }] }; } });
    const r = await ask(h, 'e'.repeat(80));
    t('own key: diag carries cacheRead and cacheWrite',
      r.error === 'truncated' && !!r.diag && r.diag.cacheRead === 2400 && r.diag.cacheWrite === 0
        && r.diag.in === 3000 && r.diag.out === 2500,
      JSON.stringify(r.diag));
  }
  {
    /* An API that does not report the cache is a different fact from a cache
       that read nothing: absent counters are null, never 0. */
    const h = await fresh();
    h.sandbox.fetch = async () => ({ ok: true, status: 200, async text() { return ''; },
      async json() { return { stop_reason: 'max_tokens', usage: { input_tokens: 900, output_tokens: 2500 },
        content: [{ type: 'text', text: 'prose' }] }; } });
    const r = await ask(h, 'f'.repeat(80));
    t('own key: absent cache counters read as null, not 0',
      !!r.diag && r.diag.cacheRead === null && r.diag.cacheWrite === null, JSON.stringify(r.diag));
  }
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
    /* 0.9.32: the stub needs matches() because skipping is no longer tag-only.
       H() is an element the SKIP_SEL catches — a visually hidden duplicate. */
    const H = (tag, ...children) => ({ nodeType: 1, tagName: tag, childNodes: children,
      matches: sel => /sr-only|tool-status|artifact-block/.test(sel) });

    // Paragraphs get real line breaks (textContent glued them: "one.Two")
    const para = captureText(E('DIV', E('P', T('First paragraph.')), E('P', T('Second one.'))));
    t('paragraphs are separated by a newline', para === 'First paragraph.\nSecond one.',
      JSON.stringify(para));

    /* 0.9.32 — the screen-reader duplicate. claude.ai renders the thinking
       header twice: once inside the tool-status BUTTON (skipped by tag) and
       once in a span.sr-only outside it, which shipped on every reply. Text
       the reader cannot see is cost with no information — and quotable, so a
       chip could ground itself in it and pass the evidence gate. */
    const withSr = captureText(E('DIV',
      H('SPAN', T('Thought for 8s')),
      E('P', T('The actual reply.'))));
    t('visually hidden duplicates are not captured', withSr === 'The actual reply.',
      JSON.stringify(withSr));
    t('the visible reply survives alongside it', withSr.includes('The actual reply.'));

    const nested = captureText(E('DIV',
      E('DIV', H('DIV', E('SPAN', T('Ran 2 commands, used 2 tools')))),
      E('P', T('Real prose.'))));
    t('hidden containers are skipped with their children', nested === 'Real prose.',
      JSON.stringify(nested));

    /* The confound that fooled three detectors tonight: prose ABOUT chrome is
       not chrome. An em/code inside the reply body must survive. */
    const quoting = captureText(E('DIV',
      E('P', T('The string '), E('EM', T('Ran 2 commands')), T(' survives the walk.'))));
    t('prose quoting a chrome string is NOT skipped',
      quoting === 'The string Ran 2 commands survives the walk.', JSON.stringify(quoting));

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
  /* 0.9.49 — this used to pin the exact signature `(anchor, steps, ctx)`, which
     is the seventh source-shape assertion to break on a refactor without ever
     catching a behaviour change: adding a fourth argument for something
     unrelated to salvage failed it. The requirement was never the arity. It is
     that NOTHING about a partial salvage reaches the renderer — no flag passed
     in, no branch on one inside. Assert that instead, and it survives any
     signature while still failing the day someone reintroduces the banner. */
  const rsBody = csrc3.slice(csrc3.indexOf('function renderSteps('));
  t('renderSteps takes no salvage flag',
    !/function renderSteps\([^)]*partial/i.test(csrc3));
  t('and never branches on one',
    !/partial/i.test(rsBody.slice(0, rsBody.indexOf('\n  }\n'))));
  t('and no call site passes one',
    (csrc3.match(/renderSteps\([^)]*\)/g) || []).every(c => !/partial/i.test(c)));
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
  await h.send({ type: 'nextSteps', reply: 'r'.repeat(80), turns: TURNS });
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
      /* Evidence quotes a TURN, and the label opens on a production verb. This
         test is about the retry: a fixture the gates drop comes back empty and
         the retry looks broken for a reason that has nothing to do with it. */
      async json() { return { stop_reason: 'end_turn', content: [{ text: JSON.stringify({ moves: [{ label: 'Write the menu page', text: 'Write it.', evidence: 'my bakery' }] }) }] }; },
      async text() { return ''; } };
  };
  const out = await h.send({ type: 'nextSteps', reply: 'r'.repeat(80), turns: TURNS });
  t('thinking-400 retried without the field', call === 2, 'calls=' + call);
  t('retry succeeds and returns moves', out.moves && out.moves.length === 1, JSON.stringify(out.moves));
}
{
  // A non-thinking 400 is NOT retried, and its detail survives to the caller.
  const h = load({ storage: { model: '', apiKey: 'sk-x' } });
  await settle();
  let call = 0;
  h.sandbox.fetch = async () => { call++; return { ok: false, status: 400,
    async text() { return '{"error":{"message":"max_tokens is too large"}}'; },
    async json() { return {}; } }; };
  const out = await h.send({ type: 'nextSteps', reply: 'r'.repeat(80), turns: TURNS.slice(0, 2) });
  t('unrelated 400 not retried', call === 1, 'calls=' + call);
  t('error detail reaches the response', out.error === 'api_400' && /max_tokens/.test(out.detail || ''),
    JSON.stringify(out));
}
{
  const csrc7 = readFileSync('./content.js', 'utf8');
  t('card renders the API detail', /resp && resp\.detail/.test(csrc7) && csrc7.includes('detail:'));
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
    /free replies for today/.test(c));
  /* The card must not name a number this file cannot keep honest. It used to
     halve the worker's limit (two calls per finished prompt) and fall back to a
     hard-coded 20 — both were copies of a figure that lives in one place, and
     both would have lied the moment that place changed. */
  t('and never halves the limit it was given', !/limit \/ 2/.test(c));
  t('and names no number when the worker reported none',
    /That’s all your free replies for today/.test(c));

  // nothing user-facing may name a raw error code
  const humanTexts = [...c.matchAll(/text: '([^']*)'/g)].map(m => m[1]);
  t('no user-facing sentence contains an error code',
    humanTexts.every(x => !/\b[a-z]+_[a-z0-9]+\b/.test(x)), humanTexts.find(x => /\b[a-z]+_[a-z0-9]+\b/.test(x)) || '');
  t('every user-facing sentence ends in a full stop',
    humanTexts.every(x => /[.!?]$/.test(x)));
}

/* ---- v0.9.70: the mascot survives force-dark ----------------------------
   A phone running the browser's night mode erased the mascot's face, and 0.9.69
   made it worse by darkening the ink. Chromium force-dark inverts a FLAT fill or
   stroke when its Rec.601 brightness is under 150, and inverts the output of a
   PAINT SERVER only when it is over 205 — so dark ink is safe only as
   `url(#...)`, and white is safe only as a flat fill. Both directions are
   asserted because the rule is asymmetric: turning the sclera into a gradient
   inverts the whole eye to near-black, which is the same bug wearing the
   opposite costume. Nothing checked the mascot before this; the earlier
   structural set went with 0.9.55's card. */
{
  const c = readFileSync('./content.js', 'utf8');
  const svg = (c.match(/const MASCOT_SVG = `([\s\S]*?)`;/) || [])[1] || '';
  const b601 = hex => {
    const n = hex.length === 4
      ? [...hex.slice(1)].map(ch => parseInt(ch + ch, 16))
      : [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return 0.299 * n[0] + 0.587 * n[1] + 0.114 * n[2];
  };
  const flat = [...svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{3,6})"/g)].map(m => m[1]);
  const stops = [...svg.matchAll(/stop-color="(#[0-9a-fA-F]{3,6})"/g)].map(m => m[1]);
  const tooDark = flat.filter(h => b601(h) < 150);
  const tooLight = stops.filter(h => b601(h) > 205);
  /* `.length` guards because [].every() is true — deleting all the ink would
     otherwise pass both assertions in silence. */
  t('every flat mascot paint is light enough that force-dark leaves it alone',
    flat.length > 0 && tooDark.length === 0, tooDark.join(' '));
  t('and every gradient stop is dark enough that force-dark leaves it alone',
    stops.length > 0 && tooLight.length === 0, tooLight.join(' '));
  t('so the dark ink reaches the page through a paint server, never a flat paint',
    (svg.match(/fill="url\(#ctxaPg\)"/g) || []).length === 2 &&
    svg.includes('stroke="url(#ctxaOg)"') && svg.includes('fill="url(#ctxaWg)"'));
  /* An objectBoundingBox paint server paints nothing when a shape's box is flat
     in either axis, and the mouth is 1.25 units tall. */
  t('and those gradients are anchored in user space, not the shape bounding box',
    (svg.match(/gradientUnits="userSpaceOnUse"/g) || []).length === 3);
}

/* ---- v0.9.46: the scroll watcher, actually run --------------------------
   Fourth rewrite of this fixture, and the first one whose model matches the
   requirement instead of the implementation. No clock: the rule has no timers.
   The fixture drives a fake scroller, and the case that matters most is the one
   that used to flicker — collapsing the card changes the reading, and the two
   thresholds must be far enough apart that it cannot cross back. */
{
  const cw = readFileSync('./content.js', 'utf8');
  const grab = name => {
    const start = cw.indexOf('function ' + name);
    let depth = 0, end = -1;
    for (let i = cw.indexOf('{', start); i < cw.length; i++) {
      if (cw[i] === '{') depth++;
      else if (cw[i] === '}' && --depth === 0) { end = i + 1; break; }
    }
    return cw.slice(start, end);
  };
  const fnsrc = 'let scrollWatch = null;\nconst SHOW_WITHIN = 140, HYSTERESIS = 60;\n'
    + grab('findScroller') + '\n' + grab('watchScroll')
    + '\nout.watchScroll = watchScroll;\nout.peek = () => scrollWatch;';

  const bound = [];
  const ctx = {
    out: {},
    addEventListener: (type, fn, opts) => bound.push({ type, fn, opts, live: true }),
    removeEventListener: (type, fn) => { for (const b of bound) if (b.fn === fn) b.live = false; },
    requestAnimationFrame: fn => fn(),
    getComputedStyle: () => ({ overflowY: 'auto' }),
    document: { body: {}, scrollingElement: null, documentElement: {} }
  };
  vm.createContext(ctx);
  vm.runInContext(fnsrc, ctx);

  const cls = new Set();
  const wrap = { classList: {
    add: c => cls.add(c), remove: c => cls.delete(c),
    toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); },
    contains: c => cls.has(c)
  } };
  const CARD_H = 160;
  let inputs = [];
  const holder = {
    isConnected: true,
    getBoundingClientRect: () => ({ height: cls.has('away') ? 0 : CARD_H }),
    shadowRoot: {
      activeElement: null,
      querySelector: s => (s === '.wrap' ? wrap : null),
      querySelectorAll: () => inputs
    }
  };

  /* A scroller whose visible height GROWS when the card collapses — the exact
     coupling that made every previous version oscillate. */
  const scroller = {
    isConnected: true, scrollHeight: 10000, scrollTop: 0,
    get clientHeight() { return 800 + (cls.has('away') ? CARD_H : 0); },
    parentElement: null
  };
  const anchor = { isConnected: true, getBoundingClientRect: () => ({ top: 0, bottom: 100 }),
    parentElement: scroller };
  // findScroller walks up from the anchor; give it something to find.
  scroller.scrollHeight = 10000;

  const fromBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
  const scrollTo = d => { scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight - d; };
  const away = () => cls.has('away');
  const scroll = () => { const b = bound.filter(x => x.live).pop(); if (b) b.fn(); };
  const live = () => bound.filter(x => x.live).length;

  scrollTo(0);
  ctx.out.watchScroll(anchor, holder);
  t('run: one scroll listener, passive and capture-phase',
    live() === 1 && bound[0].opts.passive === true && bound[0].opts.capture === true);
  t('run: a card is never born hidden', !away());

  /* The complaint, as an assertion: one notch of the wheel near the bottom must
     do nothing at all. */
  scrollTo(60); scroll();
  t('run: a single small scroll does NOT hide it', !away());
  scrollTo(120); scroll();
  t('run: nor does a second one, while still near the bottom', !away());

  scrollTo(500); scroll();
  t('run: scrolling up into the conversation hides it', away());
  scroll(); scroll();
  t('run: and it STAYS hidden — no blink, no timer bringing it back', away());

  /* The flicker, reproduced deliberately: the card collapsing gives the scroller
     160px more height, so fromBottom drops by 160. Every earlier rule crossed
     back on exactly that and oscillated. */
  t('run: collapsing changed the reading, as it always did', fromBottom() === 340);
  scroll();
  t('run: but the reading is still past the hide threshold, so nothing flips', away());

  scrollTo(200); scroll();
  t('run: partway back is inside the dead band, so it holds its state', away());
  scrollTo(100); scroll();
  t('run: returning to the bottom brings it back', !away());
  /* The other direction of the same loop: showing the card takes 160px of
     height back, so the reading jumps from 100 to 260. hideAt is 360, so it
     cannot cross back — which is the whole reason the gap is wider than the
     card. Assert the number, not the vibe. */
  t('run: showing it moved the reading by exactly the card height', fromBottom() === 260);
  scroll();
  t('run: and 260 is still short of the hide threshold, so it holds', !away());

  scrollTo(500); scroll();
  t('run: hides again', away());
  holder.shadowRoot.activeElement = {};
  scroll();
  t('run: focus in the card outranks the geometry', !away());
  holder.shadowRoot.activeElement = null;

  scrollTo(500); scroll();
  inputs = [{ value: '   ' }]; scroll();
  t('run: whitespace typed is not answering', away());
  inputs = [{ value: ' a rough ask ' }]; scroll();
  t('run: real typed text outranks the geometry too', !away());
  inputs = [];

  holder.isConnected = false;
  scroll();
  t('run: it unbinds itself when the card is gone', live() === 0);
  t('run: and clears its own handle', ctx.out.peek() === null);

  holder.isConnected = true;
  cls.clear(); scrollTo(2000);
  ctx.out.watchScroll(anchor, holder);
  t('run: even mounted deep in history it arrives visible', !away());
  scroll();
  t('run: and the first scroll is what hides it', away());
  ctx.out.watchScroll(anchor, holder);
  t('run: rebinding never leaves two listeners', live() === 1, String(live()));
}

/* ---- v0.9.47: does the product still describe itself? --------------------
   The gap that let a dead mechanism survive sixteen releases: nothing in this
   suite had ever read a user-facing SENTENCE. Ids, counts, selectors, storage,
   behaviour — all covered. Prose, never. So options.html went on telling every
   new install that "a row of suggestions appears under it" for four months
   after the suggestions became an interview and moved above the composer.

   These assertions are cheap and they are the only thing standing between a
   mechanism change and a lying onboarding page. */
{
  const opts = readFileSync('./options.html', 'utf8');
  /* This list only ever grows. Every entry is copy that was true once and then
     outlived its mechanism, and the settings page has now drifted TWICE — to
     chip copy by 2026-08-23, to interview copy by 2026-08-31 — which is why the
     guard is a list of corpses rather than a single check. LISTING.md records
     both. */
  const DEAD = [
    [/row of suggestions/i, 'the chip row'],
    [/next thing to ask/i, 'chip framing'],
    [/appears under it/i, 'the card moved ABOVE the composer in 0.9.30'],
    [/prompt like a pro/i, 'retired title'],
    [/make bad prompts good|bad prompts/i, 'retired framing'],
    // Retired 2026-08-31 with the interview and the fifth chip.
    [/asks you a short question|answers already written/i, 'the interview'],
    [/one at a time|pick one, or skip/i, 'interview pagination and skip'],
    [/opens the box|type roughly what you want/i, 'the fifth chip’s free-text box'],
    [/instead of asking you about it/i, 'the standalone Assume: mechanism'],
    [/what do i say next/i, 'the pre-mascot trigger label'],
    [/\d+ prompts a day/i, 'the retired quota unit — it meters replies now']
  ];
  for (const [re, why] of DEAD) {
    t('settings page has no dead copy: ' + why, !re.test(opts));
  }
  t('settings page describes the row it actually renders',
    /offers you a few things you could ask for next/i.test(opts));
  t('and puts the card where it really is',
    /above your message box/i.test(opts));
  t('and says each one is a whole message, which is the product',
    /complete message on its own/i.test(opts));
  t('and that silence is a real outcome, not a failure',
    /shows nothing at all/i.test(opts));
  t('and does not overstate the count', /never more than four/i.test(opts));
  /* The trigger's name lives in content.js. A settings page naming a control
     the product does not have is how a first-time user concludes it is broken,
     and this page did exactly that until 0.9.58. */
  t('and names the trigger the way content.js actually labels it',
    /What now\? ✦/.test(opts) && readFileSync('./content.js', 'utf8').includes("'What now?'"));
  t('and states the quota in the unit the worker enforces',
    /20 replies a day/i.test(opts));

  /* README.md SHIPS. build.mjs copies it into the zip beside options.html, so
     it is a user-facing surface with exactly the same drift risk — and it had
     no guard at all, which is why it ended up the stalest prose in the repo:
     still describing the interview, the Ask/Offer fork, the chip taxonomy and
     the Rough-ask control, all at once. Same treatment as the settings page. */
  const rdme = readFileSync('./README.md', 'utf8');
  const SHIPPED_DEAD = [
    [/short questions you answer by clicking/i, 'the interview pitch'],
    [/one at a time|pick one, or skip/i, 'interview pagination and skip'],
    [/interview card/i, 'the interview card'],
    [/rough ask/i, 'the fifth chip'],
    [/\*\*Ask\*\*|\*\*Offer\*\*/, 'the ask-or-offer fork'],
    [/take it further, hand back a fork/i, 'the four earned move ids'],
    [/schema\s*\n?\s*negotiation/i, 'the retired v/accepts negotiation'],
    [/\d+ prompts a day/i, 'the retired quota unit — it meters replies now']
  ];

  /* manifest.json's description ships too, and is read FAR more than README.md:
     it is the Chrome Web Store listing line and the text under the name in
     chrome://extensions. It carried the interview pitch until 0.9.58 — the
     FIRST entry in this very list, matching it word for word — because the list
     was only ever pointed at README.md. The guard already knew the phrase was
     dead; nothing asked it about the file that sells the product.

     So the list is shared rather than copied. A third copy would drift from the
     first two, which is the failure this repo keeps paying for: it is why the
     prompt is injected into both files instead of pasted, and why the per-call
     cost now lives in exactly one place. Retire a phrase once, and it is
     retired everywhere that ships. */
  const desc = JSON.parse(readFileSync('./manifest.json', 'utf8')).description;
  for (const [file, text] of [['README', rdme], ['manifest description', desc]]) {
    for (const [re, why] of SHIPPED_DEAD) {
      t('shipped ' + file + ' has no dead copy: ' + why, !re.test(text));
    }
  }
  t('shipped README describes the row it actually renders',
    /up to four next moves/i.test(rdme));
  t('and says the moves are independent, which is the whole shape',
    /independent/i.test(rdme) && /stands (alone|on its own)/i.test(rdme));
  t('and says zero means no row, not an empty one',
    /no row appears at all/i.test(rdme));
  t('and states the quota in the unit the worker enforces',
    /20 replies a day/i.test(rdme));

  t('manifest description names the row it renders, not the interview',
    /next messages/i.test(desc) && !/question/i.test(desc));
  /* "up to" is load-bearing in the one sentence most people read. Zero is a
     valid outcome, so a description promising four would be the floor this
     product spent three versions removing, printed on the storefront. */
  t('and says "up to", so the storefront promises no floor',
    /up to four/i.test(desc));
  /* Click COMPOSES; it never sends. The first draft of this line ended "Click
     one to send it", which fit the limit and inverted the product's central
     promise. Worth an assertion: it is the claim a reviewer checks first. */
  t('and never claims CONTEXA sends anything for the user',
    /you send it/i.test(desc) && !/\bsends? (it|the message) for you\b/i.test(desc));
  /* 132 is the Chrome Web Store's hard cap on this field — over it the
     dashboard rejects the upload, which is a submission-day failure no other
     check in this repo would catch. */
  t('and fits the store\'s 132-character limit  len=' + desc.length,
    desc.length > 0 && desc.length <= 132);

  /* options.js OVERWRITES the settings page at runtime — #quotaLine and the
     mode description are both written from JS, so the HTML can be perfectly
     correct and the rendered page still wrong. That is exactly what happened:
     the HTML was corrected at 0.9.58 and the page still said "20 prompts a day"
     because this file put it back. A screenshot caught it; no assertion here
     could have, because none of them read this file. Now one does. */
  const ojs = readFileSync('./options.js', 'utf8');
  for (const [re, why] of [
    [/prompts a day/i, 'the retired quota unit'],
    [/Questions and prompts come from/i, 'the ask-or-offer framing'],
    [/Suggestions will not appear/i, 'chip-era wording'],
    [/r\.limit \|\| \d+/, 'a hard-coded copy of the daily limit']
  ]) {
    t('options.js has no dead copy: ' + why, !re.test(ojs));
  }
  t('and the runtime quota line agrees with the HTML it overwrites',
    /20 replies a day/.test(ojs) && /20 replies a day/.test(opts));
}

/* ---- v2: history mining, client side --------------------------------------
   The capture, the drop policy, and the click. What these pin is mostly the
   drop policy, because it is the part with a wrong answer that still looks
   right: a window that keeps the LAST n turns reads perfectly in testing and
   silently decapitates every long session, since turn one is where the goal
   is stated. */
{
  const csrcM = readFileSync('./content.js', 'utf8');
  const bsrcM = readFileSync('./background.js', 'utf8');

  const m = csrcM.match(/const TURN_WINDOW[\s\S]*?return cut\.trimEnd\(\) \+ TURN_MARKER;\r?\n  \}/);
  if (!m) { t('clampTurn found in content.js', false); }
  else {
    const { clampTurn, TURN_MARKER, TURN_WINDOW } =
      new Function(m[0] + '; return { clampTurn, TURN_MARKER, TURN_WINDOW };')();
    const short = 'a'.repeat(300);
    t('a short turn is untouched, no marker', clampTurn(short) === short);
    const long = Array.from({ length: 300 }, (_, i) => 'line ' + i + ' of a very long turn').join('\n');
    const out = clampTurn(long);
    t('an over-window turn fits its budget incl marker', out.length <= TURN_WINDOW, 'len=' + out.length);
    t('and the marker is the final line', out.endsWith(TURN_MARKER));
    /* Head-first, exactly like clampCapture. The pivot doc called the
       convention tail-first; the code keeps the BEGINNING, and the drop policy
       that was derived from it (pin turn one) is right for that reason. */
    t('a trimmed turn keeps its beginning, not its end', out.startsWith('line 0 of a very long turn'));
  }

  const c = csrcM.match(/const MAX_TURNS = 40;[\s\S]*?function fitTurns[\s\S]*?return turns;\r?\n  \}/);
  if (!c) { t('fitTurns found in content.js', false); }
  else {
    /* fitTurns is lifted and run for real. It is deliberately separate from the
       DOM read this suite has no copy of, because it is the half with the
       silent failure mode; the querySelectorAll half is pinned by source below. */
    const policy = new Function(c[0] + '; return { fitTurns, MAX_TURNS, TURNS_TOTAL_BUDGET };')();
    const mk = n => Array.from({ length: n }, (_, i) => ({ i: i + 1, text: 'turn ' + (i + 1) }));

    const few = policy.fitTurns(mk(5));
    t('a short session is sent whole', few.length === 5 && few[0].i === 1 && few[4].i === 5);

    const many = policy.fitTurns(mk(120));
    t('a long session is trimmed to the turn ceiling', many.length === policy.MAX_TURNS, 'kept=' + many.length);
    /* The two that must never be lost: the goal and the present. */
    t('turn one is pinned through the trim', many[0].i === 1, 'first=' + many[0].i);
    t('and the newest turn survives it', many[many.length - 1].i === 120, 'last=' + many[many.length - 1].i);
    t('the oldest MIDDLE turns are what go', !many.some(x => x.i === 2));

    const fat = policy.fitTurns(
      Array.from({ length: 30 }, (_, i) => ({ i: i + 1, text: 'x'.repeat(1000) })));
    const total = fat.reduce((n, x) => n + x.text.length, 0);
    t('a session over the character budget is trimmed too',
      total <= policy.TURNS_TOTAL_BUDGET, 'chars=' + total);
    t('and turn one still survives that trim', fat[0].i === 1);

    /* No mid-turn truncation in the drop policy: whole turns only, because a
       chopped-off sentence is worse material than no sentence. Per-turn size is
       clampTurn's job and happens before this. */
    t('the drop policy never truncates a turn', fat.every(x => x.text.length === 1000));
  }

  t('capture enumerates every user turn, not just the last',
    /querySelectorAll\(USER_MSG_SEL\)[\s\S]{0,200}forEach/.test(csrcM));
  /* The property is WHERE it is called, not how the call site is punctuated.
     The old form matched the literal `turns: captureTurns()` inside the
     sendMessage argument, and broke the moment the call was hoisted to log its
     result — a true refactor failing a test that had pinned the typography.
     Assert the real thing: captureTurns runs inside askNow (the click), and
     never inside onReplyComplete (the reply landing). */
  const askBody = (csrcM.match(/async function askNow\([\s\S]*?\n  \}/) || [''])[0];
  const replyBody = (csrcM.match(/async function onReplyComplete\([\s\S]*?\n  \}/) || [''])[0];
  t('the session is read at call time', /captureTurns\(\)/.test(askBody));
  t('and never at reply-completion time', !!replyBody && !/captureTurns\(\)/.test(replyBody));
  /* The diagnostic that separates "the model ignored the session" from "the
     page never had the session". Without it both produce identical console
     output, which is how a capture bug survived a whole field test. */
  t('and the captured range is logged, so a truncated read is identifiable',
    /\[CONTEXA\] session —/.test(askBody) && /turns\[0\]\.i/.test(askBody));
  /* Claude's earlier replies are deliberately not sent: the signal is where the
     USER has been going, and the replies are the bulkier half. */
  t('only user messages are mined, never past replies',
    !/querySelectorAll\(RESPONSE_SEL\)[\s\S]{0,200}forEach/.test(csrcM));

  /* The shape check is the error check. A response with no `moves` array is a
     worker answering something this client cannot read, and the one thing it
     must never do is treat that as "nothing earned" — that renders a working
     product as a permanently quiet row, which is how 0.9.30 broke. */
  t('an unreadable response is an error, never silence',
    /if \(!resp \|\| resp\.error \|\| !Array\.isArray\(resp\.moves\)\) \{/.test(csrcM));
  t('and the error card is what it lands on',
    /!Array\.isArray\(resp\.moves\)\)[\s\S]*?renderQuiet\(anchor, 'error'/.test(csrcM));
  /* Silence has exactly one cause: an empty moves array from a call that
     succeeded. Any other route to a quiet row would be an outage wearing
     correct behaviour's face. */
  /* Asserted as a PROPERTY, not as a distance. This check used to span the gap
     with a {0,500} window and broke when the branch grew a comment — the same
     typography-over-property mistake this file has now made four times. What
     matters is that the notice has exactly ONE caller and that it sits inside
     the earned-nothing branch, with no row rendered in between. */
  /* 0.9.73 gave the notice a second caller: the fork's honest zero, a brief
     that came back empty from a call that succeeded. Same property, so the
     check is the same for both — each caller sits inside its own earned-
     nothing branch with nothing rendered in between, and there are exactly
     the two. A third would be a new silence and needs a new argument. */
  {
    const calls = csrcM.split('renderNothing(').length - 1;   // declaration + callers
    const at = csrcM.indexOf('if (!moves.length) {');
    const call = csrcM.indexOf('renderNothing(anchor', at);
    const between = at >= 0 && call > at ? csrcM.slice(at, call) : 'x';
    t('one path to the notice is a mining call that earned nothing',
      at >= 0 && call > at && !/renderMoves\(/.test(between));
    const fat = csrcM.indexOf('if (!brief) {');
    const fcall = csrcM.indexOf("renderNothing(anchor, 'fork')", fat);
    const fbetween = fat >= 0 && fcall > fat ? csrcM.slice(fat, fcall) : 'x';
    t('the other is a fork call that had nothing to carry over',
      fat >= 0 && fcall > fat && !/renderBrief\(/.test(fbetween));
    t('and there is no third', calls === 3, 'callsites=' + (calls - 1));
  }

  /* The click is send-ready: composes and stops. A call here would reintroduce
     the spinner, the failure state and the second charge the pivot removed. */
  const idea = (csrcM.match(/function appendIdeaChip\([\s\S]*?\n  \}/) || [''])[0];
  t('appendIdeaChip exists', !!idea);
  t('clicking a mined move makes no model call', !/sendMessage/.test(idea), idea.slice(0, 200));
  t('it composes the prompt straight into the box', /insertPrompt\(m\.text\)/.test(idea));
  t('and carries the full prompt as its hover title', /chip\.title = m\.text/.test(idea));

  /* Zero says so, and then leaves. It used to remove the row outright, which is
     indistinguishable from a crash to someone who just clicked and waited. */
  const nothing = (csrcM.match(/function renderNothing\([^)]*\)[\s\S]*?\n  \}/) || [''])[0];
  t('nothing mined renders a notice rather than deleting the row', !!nothing && /Nothing for now\./.test(nothing));
  /* TWO things can empty a row and only one is the product working: the model
     earning nothing, or the action gate finding no production verb. Until
     0.9.64 they drew the same card, so a gate eating a good row wore an honest
     zero's face — and the field test runs on a phone, where the console that
     told them apart is unreachable.

     A third card existed for the spread gate and left with it in 0.9.66. It is
     asserted GONE below rather than quietly forgotten: a card for a mechanism
     that cannot fire is dead UI that reads as live. */
  t('a row the action gate emptied says something different from an honest zero',
    /Nothing worth clicking here\./.test(nothing));
  t('and the retired spread-gate card is gone with its gate',
    !/Nothing new beyond the reply\./.test(csrcM));
  t('and both surviving wordings are distinct strings',
    new Set(['Nothing worth clicking here.', 'Nothing for now.']
      .filter(w => nothing.includes(w))).size === 2);
  /* Read, not re-derived. droppedByAction is non-zero on plenty of rows that
     render fine, so inferring the cause here from it would put the gate's card
     on a row that has moves in it. Decided upstream; only read here. */
  t('and the caller READS the cause rather than guessing it downstream',
    /const why = g\.emptiedBy \|\| null/.test(csrcM) && !/g\.droppedByAction/.test(csrcM));
  t('and the console names which gate, not merely that one fired',
    /emptied by the ' \+ why \+ ' gate/.test(csrcM) && /nothing mined from this session/.test(csrcM));
  t('and nothing is fabricated to fill it', !/moves = \[\s*\{/.test(csrcM));

  /* INERT, and pinned three ways because this is the shape a floor comes back
     in. Every other renderQuiet mode has an action; this one must not acquire
     one, because there is nothing here the user could do. */
  t('the notice has no click handler', !/addEventListener/.test(nothing));
  t('and no button of its own', !/createElement\('button'\)/.test(nothing));
  t('and is not styled as a chip', !/\bchip\b/.test(nothing));
  t('and cannot be clicked at all', /\.quiet\.nothing\{pointer-events:none/.test(csrcM));
  /* It leaves on its own, reusing the scroll watcher's collapse rather than a
     second fade mechanism. A permanent element saying nothing is the clutter
     the quiet row was deleted to avoid. */
  t('and it collapses itself afterwards', /classList\.add\('away'\)/.test(nothing));

  /* The stylesheet is a template literal, so ONE stray backtick anywhere inside
     it — including inside a comment — silently ends it early and takes the rest
     of content.js with it. Neither `node --check` nor a regex over the source
     catches that: both still parse, and the file is simply wrong at runtime.
     This cost a debugging round when a comment quoted a class name in backticks.
     Evaluate the literal for real and check it reaches its last rule. */
  {
    const at = csrcM.indexOf('const CSS = `') + 'const CSS = `'.length;
    const body = csrcM.slice(at, csrcM.indexOf('`;', at));
    t('the stylesheet literal contains no stray backtick', !body.includes('`'),
      body.includes('`') ? JSON.stringify(body.slice(body.indexOf('`') - 40, body.indexOf('`') + 10)) : '');
    t('and it reaches its final rule', /@keyframes cxpulse/.test(body));
    t('and it carries the zero notice rule', /\.quiet\.nothing\{/.test(body));
  }
  /* The rate is the open field-test question — the pencil that used to catch
     this case is going, and there is no fallback behind it. Unmeasurable would
     mean shipping the decision blind. */
  t('and the quiet case is logged so its rate is measurable',
    /quiet row — nothing mined from this session/.test(csrcM));

  /* The own-key path never touches the worker, so a gate that lives only there
     is a gate half the users do not have. Same pipeline, same order. */
  t('the own-key path mines with the mining prompt',
    /callClaude\(MOVES_SYSTEM,/.test(bsrcM));
  t('and cleans the turns it was handed', /const turns = cleanTurns\(msg\.turns\)/.test(bsrcM));
  /* Pins the ARGUMENT SHAPE, not the punctuation. Turns and reply must arrive
     as two separate arguments — concatenating them back into one string is the
     exact regression that made a reply transcript indistinguishable from a
     mined row. Two earlier guards in this file pinned literal call text and
     broke on a harmless refactor; this one asks the real question. */
  /* The IDENTIFIER is wildcarded on purpose. This guard pinned the literal name
     `kept` and broke the moment a variable was renamed to make room for the
     explain gate — the third time in this file a check has failed on a correct
     refactor because it pinned typography instead of the property. What matters
     is that turns and reply arrive as two separate arguments; concatenating them
     is the regression that made a reply transcript indistinguishable from a
     mined row. */
  t('and grounds turns and reply as SEPARATE corpora, never concatenated',
    /groundMoves\(\s*\w+\s*,\s*turns\.map\(t => t\.text\)\.join\([^)]*\)\s*,\s*reply\s*\)/.test(bsrcM));
  t('and runs the action gate before judging the row',
    /enforceAction\(\s*\w+\s*,\s*\w+\s*\)/.test(bsrcM));
  /* The spread gate was the second gate here until 0.9.66 and a source guard
     pinned the call. It is gone, so the guard is gone with it: a test that
     outlives its mechanism is the inert instruction this repo keeps rediscovering.
     What survives is the assertion below that ONE gate decides the row. */
  t('and no second gate runs behind it', !/enforceSpread/.test(bsrcM));

  /* ---- provenance + the action gate, lifted and RUN ----------------------
     Source assertions cannot tell a working gate from a plausible-looking one,
     and this gate decides whether a row is shown at all. So the real functions
     come out of background.js and are executed against the case the field
     screenshots caught: a reply that ends in a numbered list, returned as the
     row, on a session long enough to have offered something else. */
  {
    const blk = bsrcM.slice(bsrcM.indexOf('function groundMoves'),
      bsrcM.indexOf('/* end of the injected helper block'));
    const g = new Function('console', blk +
      '; return { groundMoves, enforceAction, tallySources };')({ log() {} });

    const TURNTEXT = 'make me a website for my bakery\ncan you add the opening hours';
    const REPLYTEXT = 'try these: 1. check the asset 2. inspect in DevTools 3. describe what you see';
    const mv = (label, evidence) => ({ label, text: 'x', evidence });

    const allReply = [mv('a', 'check the asset'), mv('b', 'inspect in DevTools')];
    const gr1 = g.groundMoves(allReply, TURNTEXT, REPLYTEXT);
    t('grounding splits provenance: reply-earned moves count as reply',
      gr1.grounded === 2 && gr1.fromTurns === 0 && gr1.fromReply === 2, JSON.stringify(gr1));

    const mixed = [mv('a', 'check the asset'), mv('b', 'my bakery')];
    const gr2 = g.groundMoves(mixed, TURNTEXT, REPLYTEXT);
    t('and a turn-earned move is credited to the turns',
      gr2.fromTurns === 1 && gr2.fromReply === 1, JSON.stringify(gr2));

    /* A phrase the user wrote and Claude quoted back belongs to the user.
       Crediting the reply would count the session's own material as an echo and
       fire the gate on a row that HAD read the history. */
    const echoed = [mv('a', 'my bakery')];
    const gr3 = g.groundMoves(echoed, TURNTEXT, 'as you said, my bakery needs a menu');
    t('and a phrase in BOTH is credited to the turns, not the reply',
      gr3.fromTurns === 1 && gr3.fromReply === 0, JSON.stringify(gr3));

    const gr4 = g.groundMoves([mv('a', 'nothing said this anywhere')], TURNTEXT, REPLYTEXT);
    t('and an ungrounded move counts in neither', gr4.grounded === 0 &&
      gr4.fromTurns === 0 && gr4.fromReply === 0, JSON.stringify(gr4));

    /* Provenance still ships in the response after the spread gate's removal,
       and it is no longer decorative: it is the only reading anyone has of
       whether a row read the session or transcribed the last reply. The
       0.9.66 measurement was possible only because these counts existed. */
    t('and provenance survives the gate that used to consume it',
      /fromTurns: ground\.fromTurns, fromReply: ground\.fromReply/.test(bsrcM));

    /* ---- the action gate -------------------------------------------------
       "Klikneš, i Claude odradi. Ako to ne može — ni ne otvaraj."

       This is an ALLOWLIST, so it fails CLOSED: a verb missing from the list
       does not degrade a row, it empties one. That makes the MUST-SURVIVE half
       of this corpus the load-bearing half, and every label in it is a real one
       from the field rows the owner kept — nine of them, most Serbian, because
       an incomplete Serbian list is the failure that lands on him directly. */
    const A_TURNS = 'napravi sajt za decije igrice\nsetup CI\nthe menu page';
    const A_REPLY = 'evo prioriteta i strukture, plus a YAML example and the SKILL.md draft';
    const act = labels => {
      const row = labels.map(l => mv(l, 'napravi sajt za decije igrice'));
      return g.enforceAction(row, g.groundMoves(row, A_TURNS, A_REPLY));
    };

    const MUST_SURVIVE = [
      'Napravi listu od 20-30 igrica',
      'Definiši finalnu strukturu podataka',
      'Razradi wireframe glavnih stranica',
      'Precizuj listu kategorija igrica',
      'Postavi CI za ŠRAF web app',
      'Pretvori skicu u SKILL.md',
      'Draft app concept doc',
      'Test inbox-triage skill on real emails',
      'Write the menu page',
      /* Harvested 0.9.67 by tailing the live worker across ten sessions. Every
         one of these was DROPPED before that sweep — nine of the fourteen drops
         were doable clicks the allowlist did not know. They are the corpus that
         proves generosity was asserted rather than achieved. */
      'Popiši listu od 20-30 igrica',
      'Osmisli filtere za katalog',
      'Osmisli temu prvog izdanja',
      'Smisli rečenicu za prosleđivanje',
      'Skiciraj logotip sa mesecom',
      'Prilagodi CV opis ostalim projektima',
      'Model hourly line items',
      'Estimate weekly payout breakeven',
      /* Caught by the VERIFICATION run of 0.9.67, on the deployed fix — the
         tail was still attached and named one more. Same family as skiciraj
         and osmisli, which is the point worth noticing: the Serbian
         conceive/design family was where this list was thinnest, and one sweep
         did not exhaust it. */
      'Isprojektuj katalog sa filterima'
    ];
    for (const label of MUST_SURVIVE) {
      t('action gate keeps a real field move: ' + label,
        act([label]).moves.length === 1);
    }

    const MUST_DROP = [
      'Objasni staging environment opcije',
      'Detaljnije rollback korake',
      'Pokaži cijeli YAML primjer',
      'Show full inbox-triage SKILL.md',
      'Answer the fork definition question',
      'Explain the notes skill rules',
      /* From the same sweep, and kept dropped on purpose: three "Explain …"
         labels the gate was right about. Pinned here so a later round of
         generosity cannot quietly swallow the verb the gate exists for. */
      'Explain frozen account handling',
      'Explain range queries breaking order',
      'Explain choosing column order',
      /* Not a verb problem at all — a bare noun phrase, no imperative anywhere.
         The label rule already forbids it; the gate catching it is a second
         line, and it must keep catching it. */
      'Uputstvo za generisanje SSH ključa',
      /* The one drop in the sweep I would not decide alone, and the owner ruled
         it a correct drop: opiši/describe stays out of the allowlist. The case
         FOR it was real — "describe the project for the CV" produces copy — but
         opiši sits in the same family as objasni and pokaži, which is the family
         the gate exists for, and a session that genuinely wants that copy has
         napiši and sastavi already surviving. Pinned so the decision is not
         quietly reversed by the next round of generosity. */
      'Opiši projekat za CV'
    ];
    for (const label of MUST_DROP) {
      t('and drops a move that is not a doable click: ' + label,
        act([label]).moves.length === 0);
    }

    /* The offender a verb list structurally cannot catch: it OPENS with a
       production verb that has to stay on the list, and the defect is its
       object. Matched separately, and worth its own assertion because deleting
       the object rule would leave every other test here passing. */
    t('and drops "Dodaj pitanje…" even though it opens with a production verb',
      act(['Dodaj pitanje o staging environment']).moves.length === 0 &&
      act(['Dodaj rollback korake za wrangler']).moves.length === 1);

    /* Provenance deliberately does NOT gate this one. 0.9.62's explain gate
       required reply-earned; "Detaljnije rollback korake" was turn-earned and
       was still rejected in the field. */
    {
      const turnEarned = [mv('Objasni staging environment opcije', 'napravi sajt za decije igrice')];
      const gg = g.groundMoves(turnEarned, A_TURNS, A_REPLY);
      t('and a turn-earned talk-about move is dropped too, unlike 0.9.62',
        gg.sources[0] === 'turns' && g.enforceAction(turnEarned, gg).moves.length === 0);
    }

    /* Counts must reflect the survivors, since they ARE the numbers reported to
       the console and the hosted client — a stale tally hides the drop in the
       one place built to show it. */
    {
      const mixed = act(['Write the menu page', 'Pokaži cijeli YAML primjer']);
      t('and re-tallies after dropping, rather than carrying stale counts',
        mixed.moves.length === 1 && mixed.ground.sources.length === 1 &&
        mixed.droppedByAction === 1, JSON.stringify(mixed.ground));
    }

    /* An emptied row is reported as such. Silence here would be identical to a
       session that earned nothing, and the two need opposite responses: one is
       the product working, the other is this list missing a word. */
    t('and an emptied row is announced separately from an honest zero',
      /action gate emptied the row/.test(bsrcM) &&
      /verb list is the likely cause/.test(bsrcM));
  }

  /* The prompt half of the same rule. The gate catches the total case; only the
     prompt can stop a row that is three-quarters transcript, and exemplars are
     what the model actually follows — the abstract ban was already there and
     shipped the defect anyway. */
  t('the prompt forbids returning the reply\'s own list as the row',
    /THAT LIST IS NOT YOUR ROW/.test(bsrcM));
  t('and says why that failure is seductive, not just that it is banned',
    /evidence quote is perfect every time/.test(bsrcM));
  t('and carries a worked transcription example, not only the rule',
    /Transcription, which is the failure that ships most often/.test(bsrcM));
  t('and requires spread, since four echoes also have four distinct labels',
    /SPREAD THE ROW ACROSS THE SESSION/.test(bsrcM));
  t('and states what a move is FOR, not only what the reply is not',
    /A move earns its place by ADVANCING/.test(bsrcM));

  /* Two weak-move shapes seen in the 0.9.59 field rows. Source assertions only —
     they prove the words are present and byte-identical, and cannot prove the
     model obeys them. That distinction is not pedantry here: the label rule
     ALREADY said "Proceed" is a command into the void, and the field still
     produced "Just start building something". Hence the worked negative rather
     than another abstract clause, and hence a live check as the real gate. */
  t('the label rule names the objectless-shrug miss by example',
    /Just start building something/.test(bsrcM));
  t('and says how to repair it, not only that it is wrong',
    /put the session's own subject in the label/.test(bsrcM));
  /* "Explain" is the verb the second-pass ban arrives through: the ban lists
     "explain that again" and "expand on your answer", so a bare "Explain X"
     slips past it while doing the same thing. */
  t('and the second-pass ban names the verb it actually arrives through',
    /Watch the verb EXPLAIN especially/.test(bsrcM));
  t('and still allows an explain that opens new ground',
    /opens ground the reply did not cover/.test(bsrcM));

  /* 0.9.61's answer-shape ban and its four assertions were REVERTED in 0.9.62.
     The ban opened "When the reply ends by asking them something" and the field
     read it as licence to return nothing at all: a thread that gave three good
     moves on 0.9.60 gave "Nothing for now." on 0.9.61, on the same reply, which
     ended with a question to the user. The repair sat in a worked example far
     below the prohibition, so the prohibition is what got followed.

     The shape is left unfixed on purpose. It was already halving on its own
     between 0.9.59 and 0.9.60 without any rule, and the tally on prompt-only
     rules is now four failures in five. What replaced it is the mechanical
     explain gate below. */
  /* Two sessions sharing a final turn would otherwise serve each other's moves,
     and mining makes that likelier: the moves depend on everything BUT the
     last turn. */
  t('the cache key carries the session, not just the last exchange',
    /const key = turns\.map\(t => t\.i \+ ':' \+ t\.text\.slice/.test(bsrcM));
  /* One shape, so one check — and it stays a real one rather than becoming a
     formality. A body with no `moves` key is a worker answering something this
     client cannot read, and saying so beats rendering it as silence. */
  t('the hosted response guard still rejects an unreadable body',
    /if \(!data \|\| !Array\.isArray\(data\.moves\)\) return \{ error: 'bad_response' \}/.test(bsrcM));

  /* Two fields, no handshake. `prompt` went with the negotiation: the last user
     message is simply the last entry in `turns`, and sending it twice made the
     larger payload bigger for nothing. */
  t('the wire carries the session and the reply, and nothing else',
    /body: JSON\.stringify\(\{ reply, turns \}\)/.test(bsrcM));
  t('and no longer negotiates a schema',
    !/accepts:/.test(bsrcM) && !/getManifest\(\)\.version/.test(bsrcM));
}

/* ---- 0.9.73 — brake 2: the fork, on both paths, and the hand-off ----------
   The brief is one string that goes into the composer of a NEW tab, which
   makes it the second thing this product can put in front of Claude. So it
   takes every rule the moves take: same session read, same cleaning on both
   paths, a cache so a seen brief is never re-rolled for quota, and a hand-off
   that lands it in exactly one composer or nowhere. */
{
  const BRIEF = 'Goal: a website for my bakery.\nSettled:\n- opening hours on the front page\nExists now:\n- the landing page HTML <paste here>\nNext: write the menu page.';
  const briefOk = (brief) => ({ ok: true, status: 200, async text() { return ''; },
    async json() { return { stop_reason: 'end_turn', usage: { input_tokens: 400, output_tokens: 120 },
      content: [{ type: 'text', text: JSON.stringify({ brief }) }] }; } });

  // --- own key ---
  {
    const h = load({ storage: { model: '', apiKey: 'sk-x' } }); await settle();
    h.sandbox.fetch = async (_u, o) => { h.requests.push({ body: JSON.parse(o.body) }); return briefOk(BRIEF); };
    const r = await h.send({ type: 'fork', reply: 'r'.repeat(80), turns: TURNS });
    const body = h.requests[0] && h.requests[0].body;
    t('own key: the fork sends FORK_SYSTEM as one cached block',
      !!body && Array.isArray(body.system) && body.system.length === 1 && /the BRIEF/.test(body.system[0].text)
        && body.system[0].cache_control && body.system[0].cache_control.type === 'ephemeral');
    t('own key: it is not the mining prompt', !!body && !/INDEPENDENT next moves/.test(body.system[0].text));
    t('own key: the fork reads the same session sections as mining',
      !!body && /^SESSION SO FAR:\n\[1\] make me a website/.test(body.messages[0].content)
        && /\n\nCLAUDE'S LATEST REPLY:\n/.test(body.messages[0].content));
    t('own key: the fork ceiling is 2,000 output tokens', !!body && body.max_tokens === 2000, String(body && body.max_tokens));
    t('own key: the brief comes back as one string', r.brief === BRIEF, JSON.stringify(r).slice(0, 100));
    const n = h.requests.length;
    const again = await h.send({ type: 'fork', reply: 'r'.repeat(80), turns: TURNS });
    t('own key: a second fork of the same session is a cache hit, not a call', again.brief === BRIEF && h.requests.length === n);
    const none = await h.send({ type: 'fork', reply: 'r'.repeat(80), turns: [] });
    t('own key: no turns is refused before any call', none.error === 'no_turns' && h.requests.length === n);
    h.sandbox.fetch = async (_u, o) => { h.requests.push({ body: JSON.parse(o.body) }); return briefOk(''); };
    const zero = await h.send({ type: 'fork', reply: 'z'.repeat(80), turns: TURNS });
    t('own key: an empty brief is an honest empty string, not an error', zero.brief === '' && !zero.error);
  }

  // --- hosted ---
  {
    const h = load(); await settle();
    h.sandbox.fetch = async (u, o) => { h.requests.push({ url: u, body: JSON.parse(o.body), headers: o.headers });
      return { ok: true, status: 200, async text() { return ''; },
        async json() { return { brief: BRIEF + '\n\n\n\nextra', quota: { used: 1, limit: 20 } }; } }; };
    const r = await h.send({ type: 'fork', reply: 'r'.repeat(80), turns: TURNS });
    t('hosted: the fork posts to /v1/fork with the device token',
      /\/v1\/fork$/.test(h.requests[0].url) && !!h.requests[0].headers['x-cx-device']);
    t('hosted: the wire carries reply and turns, and nothing else',
      JSON.stringify(Object.keys(h.requests[0].body)) === '["reply","turns"]');
    t('hosted: the brief is cleaned on this side too', r.brief === BRIEF + '\n\nextra', JSON.stringify(r.brief).slice(-30));
    h.sandbox.fetch = async () => ({ ok: true, status: 200, async text() { return ''; }, async json() { return { moves: [] }; } });
    const bad = await h.send({ type: 'fork', reply: 'x'.repeat(80), turns: TURNS });
    t('hosted: a body with no brief is bad_response, never silence', bad.error === 'bad_response');
    h.sandbox.fetch = async () => ({ ok: false, status: 429, async text() { return ''; },
      async json() { return { error: 'quota', limit: 20, resetsAt: new Date(Date.now() + 3600e3).toISOString() }; } });
    const q = await h.send({ type: 'fork', reply: 'y'.repeat(80), turns: TURNS });
    t('hosted: quota on the fork reads as quota, with the limit', q.error === 'quota' && q.limit === 20);
  }

  // --- the hand-off ---
  {
    const h = load(); await settle();
    const staged = await h.send({ type: 'stageBrief', brief: '  ' + BRIEF + '\r\n' });
    t('stageBrief parks a cleaned brief in session storage',
      staged.ok === true && !!h.sess.pendingBrief && h.sess.pendingBrief.text === BRIEF);
    const took = await h.send({ type: 'takeBrief' });
    t('takeBrief hands it back', took.brief === BRIEF);
    const again = await h.send({ type: 'takeBrief' });
    t('and a second take finds nothing — one brief, one composer', again.brief === '' && !h.sess.pendingBrief);
    const empty = await h.send({ type: 'stageBrief', brief: '   ' });
    t('an empty brief is refused at staging', empty.ok === false);
    await h.send({ type: 'stageBrief', brief: BRIEF });
    h.sess.pendingBrief.t = Date.now() - 3 * 60 * 1000;
    const stale = await h.send({ type: 'takeBrief' });
    t('a stale brief is dropped rather than landing in some later chat', stale.brief === '' && !h.sess.pendingBrief);
  }

  // --- cleanBrief, the gate both paths share ---
  {
    const h = load(); await settle();
    const cleanBrief = h.sandbox.cleanBrief;
    t('cleanBrief is exposed by the injected block', typeof cleanBrief === 'function');
    if (typeof cleanBrief === 'function') {
      t('cleanBrief: null and undefined are the empty brief', cleanBrief(null) === '' && cleanBrief(undefined) === '');
      t('cleanBrief: an object or array is the empty brief, never its toString', cleanBrief({ a: 1 }) === '' && cleanBrief(['x']) === '' && cleanBrief(42) === '');
      t('cleanBrief: CRLF and trailing spaces are normalised', cleanBrief('a  \r\nb\r\n') === 'a\nb');
      t('cleanBrief: blank runs collapse to one blank line', cleanBrief('a\n\n\n\n\nb') === 'a\n\nb');
      const long = 'Goal: x.\n' + Array.from({ length: 100 }, (_, i) => '- fact ' + (i + 1) + ' about the site').join('\n');
      const cut = cleanBrief(long);
      t('cleanBrief: cuts under 1,800 at a whole line', cut.length <= 1800 && /about the site$/.test(cut) && cut.length > 1500, String(cut.length));
      const oneLine = 'w'.repeat(3000);
      t('cleanBrief: a single giant word is cut hard rather than kept whole', cleanBrief(oneLine).length <= 1800);
    }
  }

  // --- content.js: the control, the card, the landing ---
  {
    const c = readFileSync('./content.js', 'utf8');
    t('the thread estimate reads the page, not the capture', /function threadTokens\(\)[\s\S]{0,300}textContent/.test(c));
    t('the cost line renders only above the threshold', /const LONG_THREAD_TOKENS = \d+;/.test(c) && /ctx\.thread < LONG_THREAD_TOKENS\) return;/.test(c));
    t('and never through innerHTML', !/innerHTML[^\n]*(kTokens|thread|brief)/.test(c));
    const fork = (c.match(/async function askFork\([\s\S]*?\n  \}/) || [''])[0];
    t('askFork reads the session at click time, like askNow', /sessionTurns\(ctx\)/.test(fork));
    t('askFork sends the fork message with the reply and the turns', /type: 'fork', reply: ctx\.reply, turns/.test(fork));
    t('askFork treats an empty brief as the honest zero, with its own wording', /renderNothing\(anchor, 'fork'\)/.test(fork) && /'Nothing to carry over\.'/.test(c));
    t('askFork logs before against after, per send', /thread ≈ ' \+ ctx\.thread \+ ' tokens, brief ≈ '/.test(fork));
    const card = (c.match(/function renderBrief\([\s\S]*?\n  \}/) || [''])[0];
    t('the brief is the chip\'s title, set as a property', /chip\.title = brief;/.test(card));
    t('the click stages the brief, then opens a fresh chat', /type: 'stageBrief', brief/.test(card) && /window\.open\(NEW_CHAT_URL, '_blank', 'noopener'\)/.test(card) && /NEW_CHAT_URL = 'https:\/\/claude\.ai\/new'/.test(c));
    t('the landing refuses an existing conversation and needs an empty page with a composer', /EXISTING_RE\.test\(location\.pathname\)\) return;/.test(c) && /!surelyNew && \(document\.querySelector\(USER_MSG_SEL\) \|\| document\.querySelector\(RESPONSE_SEL\)\)\) \{ wantBrief = false; return; \}/.test(c) && /surelyNew = \/\^\\\/new\\\/\?\$\/\.test\(location\.pathname\)/.test(c));
    t('and goes through insertPrompt, which never overwrites a draft', /function landBrief\(\)[\s\S]{0,300}insertPrompt\(text\)/.test(c));
    t('the fork control stays on the mined row', /function renderMoves\(anchor, moves, ctx\)[\s\S]{0,600}weightLine\(/.test(c));
  }
}

/* ---- 0.9.74 — brake 5: the nudges --------------------------------------- */
{
  const c = readFileSync('./content.js', 'utf8');
  t('the model selector is a pinned constant, like every other host selector', /const MODEL_SEL = '\[data-testid="model-selector-dropdown"\]';/.test(c));
  t('an absent selector means no model, never a guess', /function pageModel\(\)[\s\S]{0,250}return m \? m\[0\]\.toLowerCase\(\) : null;/.test(c));
  t('a simple fragment is short and free of code characters', /function simpleLast\(\)[\s\S]{0,250}t\.length < SIMPLE_TURN_CHARS && !\/\[/.test(c));
  t('the fragments run is the last three user turns, all short', /function fragmentRun\(\)[\s\S]{0,250}t\.length === FRAGMENT_RUN && t\.every\(x => x\.length > 0 && x\.length < SHORT_TURN_CHARS\)/.test(c));
  const w = (c.match(/function weightLine\([\s\S]*?\n  \}/) || [''])[0];
  t('weightLine exists and gates on a real reply', /if \(!ctx \|\| !ctx\.reply\) return;/.test(w));
  t('the long-thread line outranks both nudges', /ctx\.thread >= LONG_THREAD_TOKENS\) return costLine\(/.test(w));
  t('fragments need a thread heavy enough to matter', /ctx\.thread >= FRAGMENT_MIN_THREAD_TOKENS && fragmentRun\(\)/.test(w));
  t('the model note needs Opus on the page and a simple last turn', /pageModel\(\) === 'opus' && simpleLast\(\)/.test(w));
  t('fragments outrank the model note', w.indexOf('fragmentRun()') < w.indexOf("pageModel() === 'opus'"));
  t('a nudge renders through textContent and carries no button', /function note\(label, text, why\)[\s\S]{0,300}words\.textContent = text;/.test(c) && !/function note\([\s\S]{0,400}createElement\('button'\)/.test(c));
  t('every nudge logs its cause for the field test', /console\.log\('\[CONTEXA\] nudge —', why\);/.test(c));
  t('the ratio names its source', /OPUS_OVER_SONNET = '2\.5×'/.test(c) && /\$5\/\$25 against Sonnet 5 \$2\/\$10/.test(c));
  t('both cards go through weightLine, and none still call costLine directly', (c.match(/weightLine\(wrap\.querySelector\('\.label'\), anchor, ctx\)/g) || []).length === 2 && (c.match(/costLine\(/g) || []).length === 2);
}

/* ---- 0.9.75 — the thread read on a virtualised page, and the static page ---- */
{
  const c = readFileSync('./content.js', 'utf8');
  const fn = (c.match(/function threadTokens\(\)[\s\S]*?\n  \}/) || [''])[0];
  t('the thread read scales by scroller height over rendered height', /scale = Math\.min\(VIRTUAL_MAX_SCALE, total \/ rendered\)/.test(fn));
  t('and only when the page is clearly taller than what is rendered', /rendered > 200 && total > rendered \* 1\.2/.test(fn));
  t('the scale is capped', /const VIRTUAL_MAX_SCALE = \d+;/.test(c));
  t('every read is logged with what was measured', /console\.log\('\[CONTEXA\] thread ≈', tokens/.test(fn));
  t('the wordmark carries the number as its tooltip on both cards and on the refresh', (c.match(/\.title = threadNote\(\);/g) || []).length === 3);
  t('the tooltip names the threshold so "why not here" has an answer', /Start fresh appears from ' \+ kTokens\(LONG_THREAD_TOKENS\)/.test(c));
  const wr = (c.match(/function watchReplies\(\)[\s\S]*?\n  \}/) || [''])[0];
  t('the settle fallback is armed at attach, not only by a mutation', /scan\(\);\s*\/\*[\s\S]*?\*\/\s*clearTimeout\(settleTimer\);\s*settleTimer = setTimeout\(\(\) => \{ settled = true; scan\(\); \}, 1200\);\s*\}$/.test(wr));
}

/* ---- 0.9.76 — the thread from the page's API, and the diag card --------- */
{
  const c = readFileSync('./content.js', 'utf8');
  const api = (c.match(/async function apiThread\(ctx\)[\s\S]*?\n  \}/) || [''])[0];
  t('the API read is same-origin, read-only, with the page\'s own cookies', /credentials: 'same-origin'/.test(c) && !/method: 'POST'/.test(api));
  t('the conversation id comes from the URL', /CONV_RE = \/\\\/chat\\\/\(\[0-9a-f-\]\{36\}\)\/i/.test(c) && /location\.pathname\.match\(CONV_RE\)/.test(api));
  t('the org comes from the cookie first, then the org list', api.indexOf('lastActiveOrg') < api.indexOf('/api/organizations\''));
  t('it counts characters and drops the JSON', /chars \+= t\.length/.test(api) && !/sendMessage/.test(api));
  const ref = (c.match(/async function refineThread\([\s\S]*?\n  \}/) || [''])[0];
  t('a failed API read is one console line and the rendered estimate stands', /page API unavailable/.test(ref) && /return; \}/.test(ref));
  t('the label is redrawn only when the API says the thread is bigger', /if \(api\.tokens > \(ctx\.thread \|\| 0\)\)[\s\S]{0,200}refreshWeight\(anchor, ctx\)/.test(ref));
  t('the redraw touches only the trigger card', /data-cx-mode'\) !== 'ai'\) return;/.test(c));
  t('the trigger card kicks off the refinement', /lastCtx = ctx;[\s\S]{0,400}refineThread\(anchor, ctx\);/.test(c));
  const diag = (c.match(/function armDiag\([\s\S]*?\n  \}/) || [''])[0];
  t('three taps on the wordmark draw the diag card', /taps\.length < DIAG_TAPS\) return;/.test(diag) && /const DIAG_TAPS = 3/.test(c));
  t('the diag card names the version and the thread source', /'CONTEXA v' \+ v/.test(c) && /r\.source \|\| 'dom'/.test(c));
  t('the diag card is text, not controls', /d\.textContent = lines\.join/.test(diag) && !/createElement\('button'\)/.test(diag));
}

/* ---- 0.9.77 — the session from the page's API, and diag states -------- */
{
  const c = readFileSync('./content.js', 'utf8');
  const api = (c.match(/async function apiThread\(ctx\)[\s\S]*?\n  \}/) || [''])[0];
  t('the API read keeps the user\'s own messages, clamped like the DOM read', /msg\.sender === 'human'[\s\S]{0,120}clampTurn\(t\.trim\(\)\)/.test(api));
  t('and only those — replies are counted, never kept', !/assistant\+\+; [^\n]*turns\.push/.test(api) && /else assistant\+\+;/.test(api));
  const st = (c.match(/async function sessionTurns\(ctx\)[\s\S]*?\n  \}/) || [''])[0];
  t('sessionTurns prefers the API only when it holds more than the DOM', /api\.length > dom\.length/.test(st) && /return fitTurns\(api\.map/.test(st));
  t('sessionTurns is awaited at both call sites', (c.match(/const turns = await sessionTurns\(ctx\);/g) || []).length === 2);
  t('and falls back to the DOM read', /const dom = captureTurns\(\);/.test(st) && /return dom;/.test(st));
  t('both calls read the session through it', (c.match(/const turns = await sessionTurns\(ctx\);/g) || []).length === 2);
  const ask = (c.match(/async function askNow\([\s\S]*?\n  \}/) || [''])[0];
  t('askNow still names captureTurns for the build guard', /captureTurns\(\)/.test(ask));
  t('the diag card tells pending, no id, failed and ok apart', /ctx\.apiState = 'pending'/.test(c) && /'no conversation id in '/.test(c) && /ctx\.apiState = 'failed: '/.test(c) && /ctx\.apiState = 'ok'/.test(c));
  t('and is refreshed when the API answers', (c.match(/refreshDiag\(ctx\);/g) || []).length >= 3);
}

/* ---- 0.9.80 — the Cowork session, from /v1/code/sessions ---------------- */
{
  const c = readFileSync('./content.js', 'utf8');
  const cr = (c.match(/async function coworkRead\(anchor, ctx\)[\s\S]*?\n  \}/) || [''])[0];
  t('coworkRead runs only on a Cowork page and reads the session record the page itself fetches',
    /location\.pathname\.match\(COWORK_RE\);\s*if \(!cw\) return;/.test(cr) && /'\/v1\/code\/sessions\/' \+ cw\[1\]/.test(cr));
  t('the exact context count comes from context_usage.used_tokens', /context_usage/.test(cr) && /Number\(usage\.used_tokens\)/.test(cr));
  t('an exact count outranks the rendered estimate and redraws the row', /if \(Number\.isFinite\(used\) && used > \(ctx\.thread \|\| 0\)\)[\s\S]{0,300}refreshWeight\(anchor, ctx\)/.test(cr));
  t('the user turns come from the events, user entries with text only', /if \(!isUserEvent\(ev\)\) continue;/.test(cr) && /clampTurn\(eventText\(ev\)\.trim\(\)\)/.test(cr));
  t('tool results are never a turn', /\/tool_result\|tool_use\|attachment\|meta\/i\.test\(t\)\) return false;/.test(c));
  t('a failed record read is one line and the estimate stands', /failed \(cowork record\)/.test(cr) && /console\.log\('\[CONTEXA\] cowork — session record unavailable/.test(cr));
  t('the diag carries the record and events key names, never text', /shapeOf\(record, 2\)/.test(cr) && /Object\.keys\(first\)/.test(cr) && !/JSON\.stringify\(record/.test(cr));
  t('refineThread hands a Cowork page to coworkRead', /if \(COWORK_RE\.test\(location\.pathname\)\) return coworkRead\(anchor, ctx\);/.test(c));
  const card = (c.match(/function renderBrief\([\s\S]*?\n  \}/) || [''])[0];
  t('on Cowork the fork chip copies the brief instead of opening /new', /onCowork \? 'Copy the brief for a new session'/.test(card) && /navigator\.clipboard\.writeText\(brief\)/.test(card));
  t('and still opens a new chat everywhere else', /window\.open\(NEW_CHAT_URL, '_blank', 'noopener'\)/.test(card));
}

/* ---- 0.9.82 — the Cowork event stream's real shape ----------------------- */
{
  const c = readFileSync('./content.js', 'utf8');
  t('a user event is named by its type or its payload role, never a tool event', /function isUserEvent\(ev\)[\s\S]{0,400}tool_result\|tool_use/.test(c) && /\/user\/i\.test\(t\) \|\| role === 'user'/.test(c));
  t('event text is read from the payload', /const p = ev && ev\.payload && typeof ev\.payload === 'object' \? ev\.payload : ev;/.test(c));
  t('the token count is found anywhere in the first levels of the record', /function findUsage\(o\)/.test(c) && /v\.context_usage\.used_tokens != null/.test(c));
  t('the Cowork walk is on demand and bounded', /COWORK_MAX_PAGES = 12;/.test(c) && /pages < COWORK_MAX_PAGES/.test(c));
  t('the diag names the event types and a user payload\'s shape', /'event types: '/.test(c) && /'user event payload: '/.test(c));
}

/* ---- 0.9.83 — reading a Cowork session from its end --------------------- */
{
  const c = readFileSync('./content.js', 'utf8');
  t('the diag names the goal event and the turn summary by shape only', /'active_goal payload: '/.test(c) && /'post_turn_summary: '/.test(c) && /string\(' \+ pts\.length/.test(c));
  t('and the walk reports what it saw', /'event types over the walk: '/.test(c));
}

/* ---- 0.9.84 — the diag on every card ------------------------------------ */
{
  const c = readFileSync('./content.js', 'utf8');
  t('every card arms the diag on its whole surface, from shell', /host\.before\(holder\);\s*armDiag\(wrap, wrap, null\);/.test(c));
  t('a tap on a button or chip does not count', /e\.target\.closest\('button'\)\) return;/.test(c));
  t('and no renderer arms it a second time', !/armDiag\(wrap\.querySelector/.test(c));
}

/* ---- 0.9.85 — head and tail of a Cowork session, and its fresh start ---- */
{
  const c = readFileSync('./content.js', 'utf8');
  const w = (c.match(/async function coworkTurns\(ctx\)[\s\S]*?\n  \}/) || [''])[0];
  t('the walk reads one page of 500 from the start, for the goal', /base \+ '\?limit=' \+ COWORK_PAGE, codeHeaders\(\)/.test(w));
  t('then the tail from resume_cursor back, where the work is', /resume - COWORK_TAIL_EVENTS/.test(w) && /'&cursor=' \+ encodeURIComponent\(cursor\)/.test(w));
  t('falls back to the forward walk without a numeric head', /note = 'forward walk';/.test(w));
  t('dedupes by event id and orders by sequence', /seen\.has\(id\)/.test(w) && /\.sort\(\(x, y\) => \(x\.seq \|\| 0\) - \(y\.seq \|\| 0\)\)/.test(w));
  t('and keeps the goal end small so fitTurns keeps the present', /head\.slice\(0, 4\)\.concat\(tail\)/.test(w));
  t('on Cowork the fork copies, stages and opens the project page (0.9.88)', /navigator\.clipboard\.writeText\(brief\)/.test(c) && /window\.open\(projectUrl, '_blank', 'noopener'\)/.test(c));
}

/* ---- 0.9.86 — the brief out of a broken answer ------------------------- */
{
  const BRIEF = 'Goal: a website for my bakery.\nSettled:\n- opening hours on the front page\nExists now:\n- the landing page HTML <paste here>\nNext: write the menu page.';
  const h = load({ storage: { model: '', apiKey: 'sk-x' } }); await settle();
  const rawBrief = h.sandbox.rawBrief;
  t('rawBrief is exposed by the injected block', typeof rawBrief === 'function');
  if (typeof rawBrief === 'function') {
    t('rawBrief takes the text after "brief":" out of a cut answer, unescaped, minus the fragment line', rawBrief('{"brief":"Goal: x.\\nSettled:\\n- y\\n- z') === 'Goal: x.\nSettled:\n- y');
    t('a cut answer with one line keeps that line rather than nothing', rawBrief('{"brief":"Goal: x and more') === 'Goal: x and more');
    t('rawBrief strips a closing quote and brace when they made it', rawBrief('{"brief":"Goal: x.\\nNext: y."}') === 'Goal: x.\nNext: y.');
    t('rawBrief is empty when there is no brief field', rawBrief('Let me think about it') === '' && rawBrief('') === '');
    t('rawBrief unescapes quotes and backslashes', rawBrief('{"brief":"He said \\"go\\" \\\\ now') === 'He said "go" \\ now');
  }
  // own key: a truncated answer becomes a partial brief, not an error
  h.sandbox.fetch = async () => ({ ok: true, status: 200, async text() { return ''; },
    async json() { return { stop_reason: 'max_tokens', usage: { input_tokens: 400, output_tokens: 2000 },
      content: [{ type: 'text', text: '{"brief":"' + BRIEF.replace(/\n/g, '\\n') + '\\nAnd one more line that got cu' }] }; } });
  const r = await h.send({ type: 'fork', reply: 'r'.repeat(80), turns: TURNS });
  t('own key: a cut brief is salvaged, cut at a clean line, and flagged partial', r.partial === true && r.brief === BRIEF, JSON.stringify(r).slice(0, 160));
  const c = readFileSync('./content.js', 'utf8');
  t('the diag card carries the last error with its diag', /ctx\.lastError = \{ call: 'fork'/.test(c) && /ctx\.lastError = \{ call: 'moves'/.test(c) && /'last error \(' \+ ctx\.lastError\.call/.test(c));
}

/* ---- 0.9.87 — the landing without an address ---------------------------- */
{
  const c = readFileSync('./content.js', 'utf8');
  t('the take is consuming, so it waits for a composer on an empty page', /if \(!wantBrief \|\| askedBrief \|\| !composer\) return;/.test(c) && /askedBrief = true;/.test(c));
  t('tick asks once the composer is found', /if \(composer && wantBrief && !askedBrief\) takeBriefIfLanding\(\);/.test(c));
  t('an existing conversation is never a landing', /EXISTING_RE = \/\^\\\/\(chat\\\/\[0-9a-f-\]\{36\}\|cowork\\\/cse_\[A-Za-z0-9\]\+\|code\\\/session_\[A-Za-z0-9\]\+\)\//.test(c));
}

/* ---- 0.9.88 — the Cowork exit, closed; the probe, retired ---------------- */
{
  const c = readFileSync('./content.js', 'utf8');
  const mf = JSON.parse(readFileSync('./manifest.json', 'utf8'));
  t('no main-world script ships any more', !mf.content_scripts.some(cs => cs.world) && !existsSync('./probe.js'));
  t('nothing listens for the probe', !/contexa-api-path|apiPaths|probeEventParams/.test(c));
  t('the project id is read from the session record', /ctx\.coworkProject = /.test(c) && /chat_project_id/.test(c));
  t('on Cowork the chip opens the project page, where a new session starts', /COWORK_PROJECT_URL = 'https:\/\/claude\.ai\/cowork\/project\/'/.test(c) && /window\.open\(projectUrl, '_blank', 'noopener'\)/.test(c));
  t('and copies only when the project is unknown', /'Copied — start a new Cowork session; the brief drops in'/.test(c));
  t('a project page is not an existing conversation', /EXISTING_RE = \/\^\\\/\(chat\\\/\[0-9a-f-\]\{36\}\|cowork\\\/cse_/.test(c));
}

/* ---- 0.9.89 – 0.9.93 — the project page's address ------------------------- */
{
  const c = readFileSync('./content.js', 'utf8');
  const f = (c.match(/function coworkProjectUrl\(ctx\)[\s\S]*?\n  \}/) || [''])[0];
  t('the chip opens the address the lookup resolved, else a uuid-shaped record id, else nothing', /ctx\.coworkProjectUrl\) return ctx\.coworkProjectUrl;/.test(f) && /: null;/.test(f));
  t('the page\'s links are not a source any more (the first one was the wrong project)', !/a\[href\]/.test(f) && !/querySelectorAll/.test(f));
  const l = (c.match(/async function coworkProjectLookup\(ctx\)[\s\S]*?\n  \}/) || [''])[0];
  t('the lookup asks the org\'s project list and matches the entry carrying the record id', /\/api\/organizations\/' \+ org \+ '\/projects'/.test(l) && /JSON\.stringify\(p\)\.includes\(id\)/.test(l));
  t('a match is used only through a uuid-shaped field', /const uuidOf = o => o && \[o\.uuid, o\.id\]\.find\(v => typeof v === 'string' && UUID_RE\.test\(v\)\);/.test(l) && /const uuid = uuidOf\(hit\);/.test(l));
  t('each listed project\'s detail is searched the same way, at most twelve, failures counted', /listed\.slice\(0, 12\)/.test(l) && /\/projects\/' \+ u\)/.test(l) && /catch \{ failed\+\+; \}/.test(l));
  t('the code API\'s project list is asked with the page\'s headers only when nothing else answered', /if \(!ctx\.coworkProjectUrl\) \{[\s\S]*?\/v1\/code\/projects', codeHeaders\(\)/.test(l));
  t('a uuid from that list is taken only from a field named for the project or a uuid', /\/project\/i\.test\(f\.split\('='\)\[0\]\)\) \|\| found\.find\(f => \/uuid\/i/.test(l));
  const pf = (c.match(/function pageProjectFetches\(org\)[\s\S]*?\n  \}/) || [''])[0];
  t('the page\'s own project fetch is read from resource timing, org-checked, by exact path', /getEntriesByType\('resource'\)/.test(pf) && /api\\\/organizations\\\/\(\[0-9a-f-\]\{36\}\)\\\/projects\\\/\(\[0-9a-f-\]\{36\}\)\(\?=\[\/\?#\]\|\$\)/.test(pf) && /m\[1\]\.toLowerCase\(\) === org\.toLowerCase\(\)/.test(pf));
  t('and it is a source only when exactly one project uuid was fetched, after every exact match', /if \(!ctx\.coworkProjectUrl && pf\.uuids\.length === 1\) ctx\.coworkProjectUrl = COWORK_PROJECT_URL \+ pf\.uuids\[0\]\[0\];/.test(l));
  t('a resource timing that cannot be read is an empty answer, not a throw', /catch \{ return \{ uuids: \[\], other, sample, n: 0 \}; \}/.test(pf));
  t('0.9.93: the record itself is searched first, for a uuid under a path naming a project, and all its keys are said', /const r = projUuidIn\(recBody\);/.test(l) && /'record keys: ' \+ Object\.keys\(recBody\)\.join\(','\)/.test(l) && /if \(r\.pick\) ctx\.coworkProjectUrl = COWORK_PROJECT_URL \+ r\.pick;/.test(l));
  t('the record is kept on the context for it, and the list is asked only after it', /ctx\.coworkRecord = record;\n    await coworkProjectLookup\(ctx\);/.test(c) && /if \(!ctx\.coworkProjectUrl\) try \{\n      const list = await apiJson\('\/api\/organizations\/' \+ org \+ '\/projects'\);/.test(l));
  const pu = (c.match(/function projUuidIn\(o\)[\s\S]*?\n  \}/) || [''])[0];
  t('the uuid walk is three levels deep and picks only a path naming a project', /d > 3\) return;/.test(pu) && /found\.find\(\(\[k\]\) => \/project\/i\.test\(k\)\)/.test(pu));
  t('0.9.92: the org\'s conversations are searched for the session\'s cse_ id, a project uuid taken only from a field named for it', /\/chat_conversations'\)/.test(l) && /JSON\.stringify\(c\)\.includes\(cse\)/.test(l) && /projUuidIn\(hit\)/.test(l));
  t('then each project\'s conversations, stopping at the first project holding the session', /\/projects\/' \+ u \+ '\/conversations'\)/.test(l) && /if \(!u \|\| match\) continue;/.test(l));
  t('then the code API\'s session list, with the page\'s headers', /\/v1\/code\/sessions\?limit=50', codeHeaders\(\)/.test(l));
  t('each of the three is asked only while nothing has answered and only on a session page', (l.match(/if \(!ctx\.coworkProjectUrl && cse/g) || []).length === 3);
  t('every step of the lookup is caught and leaves a diag line', (l.match(/catch \(e\) \{ lines\.push\(/g) || []).length === 4 && (l.match(/lines\.push\(/g) || []).length >= 9 && /ctx\.coworkLookup = lines;/.test(l));
  t('the lookup runs inside the session read, before any chip', /await coworkProjectLookup\(ctx\);\n    const used = usage/.test(c));
  t('the chip resolves the address at click time', /const projectUrl = onCowork \? coworkProjectUrl\(ctx\) : null;/.test(c));
  t('the diag says what would open, what the lookup found, and what the page links (diag only)', /'project page to open: '/.test(c) && /\.\.\.\(ctx\.coworkLookup \|\| \[\]\)/.test(c) && /'project links on page: ' \+ \(pageProjectLinks\(\)/.test(c));
  const pl = (c.match(/function pageProjectLinks\(\)[\s\S]*?\n  \}/) || [''])[0];
  t('the page-link list is same-origin, exact path shape, distinct, and capped', /u\.origin !== location\.origin/.test(pl) && /cowork\\\/project\\\/\[A-Za-z0-9_-\]\{8,\}/.test(pl) && /new Map\(\)/.test(pl) && /\.slice\(0, 6\)/.test(pl));
}

console.log(fails.length ? '\nFAILED: ' + fails.join(', ') : '\nall extension checks passed');
process.exit(fails.length ? 1 : 0);
