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

  return { store, writes, requests, send, fire, sandbox };
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
      /* Evidence quotes a TURN, not the reply. This test is about the retry, and
         a reply-earned move on this 3-turn fixture is exactly what the spread
         gate now drops — the row would come back empty and the retry would look
         broken. Keeping the fixture turn-earned keeps the test about its own
         subject. */
      async json() { return { stop_reason: 'end_turn', content: [{ text: JSON.stringify({ moves: [{ label: 'A move', text: 'Do the thing.', evidence: 'my bakery' }] }) }] }; },
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
  t('the only path to the notice is a successful call that earned nothing',
    /if \(!moves\.length\) \{[\s\S]{0,500}renderNothing\(anchor\)/.test(csrcM));

  /* The click is send-ready: composes and stops. A call here would reintroduce
     the spinner, the failure state and the second charge the pivot removed. */
  const idea = (csrcM.match(/function appendIdeaChip\([\s\S]*?\n  \}/) || [''])[0];
  t('appendIdeaChip exists', !!idea);
  t('clicking a mined move makes no model call', !/sendMessage/.test(idea), idea.slice(0, 200));
  t('it composes the prompt straight into the box', /insertPrompt\(m\.text\)/.test(idea));
  t('and carries the full prompt as its hover title', /chip\.title = m\.text/.test(idea));

  /* Zero says so, and then leaves. It used to remove the row outright, which is
     indistinguishable from a crash to someone who just clicked and waited. */
  const nothing = (csrcM.match(/function renderNothing\(anchor\)[\s\S]*?\n  \}/) || [''])[0];
  t('nothing mined renders a notice rather than deleting the row', !!nothing && /Nothing for now\./.test(nothing));
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
  t('and grounds turns and reply as SEPARATE corpora, never concatenated',
    /groundMoves\(\s*kept\s*,\s*turns\.map\(t => t\.text\)\.join\([^)]*\)\s*,\s*reply\s*\)/.test(bsrcM));
  t('and runs the spread gate over the result',
    /enforceSpread\(kept, ground, turns\.length\)/.test(bsrcM));

  /* ---- provenance + the spread gate, lifted and RUN ----------------------
     Source assertions cannot tell a working gate from a plausible-looking one,
     and this gate decides whether a row is shown at all. So the real functions
     come out of background.js and are executed against the case the field
     screenshots caught: a reply that ends in a numbered list, returned as the
     row, on a session long enough to have offered something else. */
  {
    const blk = bsrcM.slice(bsrcM.indexOf('function groundMoves'),
      bsrcM.indexOf('/* end of the injected helper block'));
    const g = new Function('console', blk +
      '; return { groundMoves, enforceSpread, SPREAD_MIN_TURNS };')({ log() {} });

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

    // The gate itself, across the boundary it is built around.
    t('spread gate drops an all-reply row once the session could offer more',
      g.enforceSpread(allReply, gr1, 5).length === 0);
    t('and the SAME row survives a short session, where the reply IS the material',
      g.enforceSpread(allReply, gr1, 2).length === 2);
    t('and the boundary is the floor itself, not one above it',
      g.enforceSpread(allReply, gr1, g.SPREAD_MIN_TURNS).length === 0 &&
      g.enforceSpread(allReply, gr1, g.SPREAD_MIN_TURNS - 1).length === 2);
    t('and one turn-earned move is enough to keep the whole row',
      g.enforceSpread(mixed, gr2, 20).length === 2);
    t('and an already-empty row is passed through, never "dropped" twice',
      g.enforceSpread([], gr1, 20).length === 0);
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

console.log(fails.length ? '\nFAILED: ' + fails.join(', ') : '\nall extension checks passed');
process.exit(fails.length ? 1 : 0);
