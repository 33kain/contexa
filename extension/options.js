const $ = id => document.getElementById(id);

/* model: '' means "follow whatever this build ships as the default". It is
   deliberately NOT seeded with a model name — writing a default into storage is
   what froze early installs on an old model, because a new default could never
   win once a concrete value was persisted. */
const DEFAULTS = {
  enabled: true, apiKey: '', model: '',
  proxyUrl: '', deviceToken: ''
};

let shippedModel = '';

(async () => {
  // The extension's own version, so it is never confused with the backend's.
  $('extVersion').textContent = 'v' + chrome.runtime.getManifest().version;

  // Ask the service worker rather than keeping a second copy that could drift.
  try {
    const cfg = await chrome.runtime.sendMessage({ type: 'getConfig' });
    shippedModel = (cfg && cfg.shippedModel) || '';
  } catch { /* worker asleep or mid-reload; placeholder just stays generic */ }
  $('model').placeholder = shippedModel ? `${shippedModel}  (current default)` : 'current default';

  const s = await chrome.storage.local.get(DEFAULTS);
  $('enabled').checked = s.enabled;
  $('apiKey').value = s.apiKey;
  $('model').value = s.model;      // empty shows the placeholder, which is the point
  $('proxyUrl').value = s.proxyUrl;
  paintMode(s.apiKey);
})();

// The mode box reflects reality rather than making the user infer it.
function paintMode(apiKey) {
  const own = !!(apiKey && apiKey.trim());
  $('modeName').textContent = own ? 'Your own API key' : 'Hosted';
  $('modePill').textContent = own ? 'unlimited' : 'free';
  $('modeDesc').textContent = own
    ? 'Requests go straight from your browser to the Anthropic API with your key. No daily limit, and you pay Anthropic directly for usage. The hosted backend is not used at all.'
    : "Suggestions come from CONTEXA's service — no setup needed. Fair-use limit of 20 replies per day.";
}
$('apiKey').addEventListener('input', () => paintMode($('apiKey').value));

/* Store the field exactly as typed. An empty field stays empty — it must not be
   backfilled with the current default, or this install stops tracking future ones. */
function fieldValues() {
  return {
    apiKey: $('apiKey').value.trim(),
    model: $('model').value.trim(),
    proxyUrl: $('proxyUrl').value.trim()
  };
}

$('save').addEventListener('click', () => {
  chrome.storage.local.set({ enabled: $('enabled').checked, ...fieldValues() }, () => {
    paintMode($('apiKey').value);
    flash('Saved.', true);
  });
});

$('test').addEventListener('click', () => {
  flash('Testing…');
  chrome.storage.local.set(fieldValues(), async () => {
    // Test what will actually be used. These are two different services, so the
    // result always names which one answered — reporting a bare check mark is how
    // an own-key install looked like a verified backend.
    if ($('apiKey').value.trim()) {
      const r = await chrome.runtime.sendMessage({ type: 'ping' });
      if (r && r.ok) flash(`Your key works ✓ — direct to Anthropic, ${r.model}`, true);
      else flash('Your key failed: ' + ((r && r.error) || 'unknown'), false);
    } else {
      const r = await chrome.runtime.sendMessage({ type: 'healthCheck' });
      if (!r || !r.ok) {
        flash('Hosted backend unreachable: ' + ((r && r.error) || 'unknown'), false);
      } else if (r.configured === false) {
        // Reachable but keyless still fails every request. Not a green check.
        flash('Hosted backend is reachable but has no API key set', false);
      } else {
        const bits = [`${r.limit || 20}/day`];
        if (r.model) bits.push(r.model);
        if (r.version) bits.push('backend v' + r.version);
        flash(`Hosted backend ✓ — ${bits.join(', ')}`, true);
      }
    }
  });
});

function flash(msg, ok) {
  const el = $('status');
  el.textContent = msg;
  el.className = ok === undefined ? '' : ok ? 'ok' : 'err';
}
