const $ = id => document.getElementById(id);
const DEFAULTS = {
  enabled: true, apiKey: '', model: 'claude-haiku-4-5',
  proxyUrl: '', deviceToken: ''
};

chrome.storage.local.get(DEFAULTS, s => {
  $('enabled').checked = s.enabled;
  $('apiKey').value = s.apiKey;
  $('model').value = s.model;
  $('proxyUrl').value = s.proxyUrl;
  paintMode(s.apiKey);
});

// The mode box reflects reality rather than making the user infer it.
function paintMode(apiKey) {
  const own = !!(apiKey && apiKey.trim());
  $('modeName').textContent = own ? 'Your own API key' : 'Hosted';
  $('modePill').textContent = own ? 'unlimited' : 'free';
  $('modeDesc').textContent = own
    ? 'Requests go straight from your browser to the Anthropic API with your key. No daily limit, and you pay Anthropic directly for usage.'
    : "Suggestions come from CONTEXA's service — no setup needed. Fair-use limit of 20 replies per day.";
}
$('apiKey').addEventListener('input', () => paintMode($('apiKey').value));

$('save').addEventListener('click', () => {
  chrome.storage.local.set({
    enabled: $('enabled').checked,
    apiKey: $('apiKey').value.trim(),
    model: $('model').value.trim() || DEFAULTS.model,
    proxyUrl: $('proxyUrl').value.trim()
  }, () => {
    paintMode($('apiKey').value);
    flash('Saved.', true);
  });
});

$('test').addEventListener('click', async () => {
  flash('Testing…');
  chrome.storage.local.set({
    apiKey: $('apiKey').value.trim(),
    model: $('model').value.trim() || DEFAULTS.model,
    proxyUrl: $('proxyUrl').value.trim()
  }, async () => {
    const own = !!$('apiKey').value.trim();
    // Test what will actually be used: the key path, or the backend.
    if (own) {
      const r = await chrome.runtime.sendMessage({ type: 'ping' });
      if (r && r.ok) flash('Key works ✓', true);
      else flash('Failed: ' + ((r && r.error) || 'unknown'), false);
    } else {
      const r = await chrome.runtime.sendMessage({ type: 'healthCheck' });
      if (r && r.ok) flash(`Backend reachable ✓ (${r.limit || 20}/day)`, true);
      else flash('Backend unreachable: ' + ((r && r.error) || 'unknown'), false);
    }
  });
});

function flash(msg, ok) {
  const el = $('status');
  el.textContent = msg;
  el.className = ok === undefined ? '' : ok ? 'ok' : 'err';
}
