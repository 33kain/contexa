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
          content: [{ text: JSON.stringify({ steps: [{ label: 'Do the thing', text: 'Do it.' }] }) }]
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

console.log(fails.length ? '\nFAILED: ' + fails.join(', ') : '\nall extension checks passed');
process.exit(fails.length ? 1 : 0);
