const $ = id => document.getElementById(id);

/* model is '' on purpose — it means "follow whatever this build ships".
   Storing a concrete model here is the bug that froze early installs on Haiku:
   chrome.storage.local only fills MISSING keys, so once a real value was
   written, every later default change could never reach that install again.
   build.mjs fails the build if a concrete model reappears in this object, or if
   the save path ever backfills an empty field with a default. */
const DEFAULTS = {
  enabled: true, apiKey: '', model: '',
  proxyUrl: '', deviceToken: ''
};

/* The beginner path is the whole page: a switch, four steps, done.
   Everything technical lives inside <details id="advanced"> and is never
   opened for them. */
chrome.storage.local.get(DEFAULTS, s => {
  $('enabled').checked = s.enabled !== false;
  $('apiKey').value = s.apiKey || '';
  $('model').value = s.model || '';
  $('proxyUrl').value = s.proxyUrl || '';
  paintState();
  paintMode();
});

/* The extension's own version, straight from the manifest — never a copy that
   could drift. */
try { $('ver').textContent = 'v' + chrome.runtime.getManifest().version; } catch {}

/* SHIPPED_MODEL has one home (background.js). Asking for it keeps this page
   from holding a second copy that could disagree with the one actually used. */
chrome.runtime.sendMessage({ type: 'getConfig' }).then(cfg => {
  if (cfg && cfg.shippedModel) $('shippedModel').textContent = cfg.shippedModel;
}).catch(() => {});

/* ---------- the on/off card, in plain language ---------- */
function paintState() {
  const on = $('enabled').checked;
  $('statusCard').classList.toggle('off', !on);
  $('stateTitle').textContent = on ? 'CONTEXA is on' : 'CONTEXA is off';
  $('stateNote').textContent = on
    ? 'Nothing else to set up.'
    : 'Suggestions will not appear until you turn it back on.';
}

/* Toggling is the one control a beginner touches, so it saves itself. A Save
   button for a switch is a small trap: people flip it, close the tab, and it
   silently did nothing. */
$('enabled').addEventListener('change', () => {
  paintState();
  chrome.storage.local.set({ enabled: $('enabled').checked });
});

/* ---------- advanced: say which mode is actually in effect ---------- */
function paintMode() {
  const own = !!$('apiKey').value.trim();
  $('modeName').textContent = own ? 'Your own API key' : 'Free service';
  $('modePill').textContent = own ? 'unlimited' : 'no key needed';
  $('modeDesc').textContent = own
    ? 'Requests go straight from this browser to Anthropic using your key. No daily limit, and Anthropic bills you directly for usage.'
    : 'Suggestions come from the CONTEXA service. Nothing to set up, and a fair-use limit of 20 sets a day.';
  $('quotaLine').innerHTML = own
    ? '<b>Using your own key.</b> No daily limit — Anthropic bills you for what you use.'
    : '<b>Free.</b> No account, no sign-up. Fair use is 20 suggestion sets a day.';
}
$('apiKey').addEventListener('input', paintMode);

$('save').addEventListener('click', () => {
  chrome.storage.local.set({
    enabled: $('enabled').checked,
    apiKey: $('apiKey').value.trim(),
    // No fallback to a default here, deliberately: an empty field must STAY
    // empty so the shipped default keeps applying to this install forever.
    model: $('model').value.trim(),
    proxyUrl: $('proxyUrl').value.trim()
  }, () => {
    paintMode();
    flash('Saved.', true);
  });
});

/* Test whatever will actually be used — the key path, or the backend. */
$('test').addEventListener('click', () => {
  flash('Testing…');
  chrome.storage.local.set({
    apiKey: $('apiKey').value.trim(),
    model: $('model').value.trim(),
    proxyUrl: $('proxyUrl').value.trim()
  }, async () => {
    paintMode();
    const own = !!$('apiKey').value.trim();
    try {
      if (own) {
        const r = await chrome.runtime.sendMessage({ type: 'ping' });
        if (r && r.ok) flash('Key works ✓' + (r.model ? ' — ' + r.model : ''), true);
        else flash('Failed: ' + friendly(r && r.error), false);
      } else {
        const r = await chrome.runtime.sendMessage({ type: 'healthCheck' });
        if (r && r.ok) {
          // version/model make this a real answer about which backend is live,
          // not just a reachability ping.
          $('backendVer').textContent = r.version ? ' · backend v' + r.version : '';
          flash(`Connected ✓ (${r.limit || 20}/day` + (r.model ? ', ' + r.model : '') + ')', true);
        } else {
          flash('Not reachable: ' + friendly(r && r.error), false);
        }
      }
    } catch (e) {
      flash('Not reachable: ' + friendly('network'), false);
    }
  });
});

/* Error codes are for the console, not for a person reading a settings page. */
function friendly(code) {
  const map = {
    no_key: 'no API key saved',
    network: 'no connection',
    quota: 'daily limit reached',
    proxy_not_configured: 'backend URL is not set',
    forbidden_origin: 'this copy was not installed from the Chrome Web Store',
    server_not_configured: 'the backend is missing its key',
    api_401: 'that key was rejected',
    api_400: 'the request was rejected — check the model name',
    api_429: 'Anthropic is rate-limiting this key'
  };
  const c = String(code || 'unknown');
  return map[c] || c;
}

function flash(msg, ok) {
  const el = $('status');
  el.textContent = msg;
  el.className = ok === undefined ? '' : ok ? 'ok' : 'err';
}
