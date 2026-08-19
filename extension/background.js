/* CONTEXA — service worker.
   Owns the single Anthropic API call this extension makes. The user's key never
   leaves chrome.storage.local except to go straight to api.anthropic.com. */

const API_URL = 'https://api.anthropic.com/v1/messages';

// Deployed backend. Pin ALLOWED_EXTENSION_IDS on the Worker after publishing.
const DEFAULT_PROXY_URL = 'https://contexa-api.michu110899.workers.dev';

const DEFAULTS = {
  apiKey: '',                    // empty = use the hosted proxy (no key needed)
  model: 'claude-haiku-4-5',
  enabled: true,
  proxyUrl: DEFAULT_PROXY_URL,
  deviceToken: ''                // opaque, generated on first use, not an identity
};

/* An anonymous per-install token so the proxy can apply a daily quota without
   knowing who anyone is. Not tied to the user, the browser profile, or claude.ai. */
async function getDeviceToken() {
  const { deviceToken } = await chrome.storage.local.get({ deviceToken: '' });
  if (deviceToken) return deviceToken;
  const fresh = crypto.randomUUID().replace(/-/g, '');
  await chrome.storage.local.set({ deviceToken: fresh });
  return fresh;
}

/* One job: given where the conversation actually is, what are the five most
   useful things to send next? Written to produce what a thoughtful collaborator
   would suggest — not categories, not critique, not lenses. */
const NEXT_STEPS_SYSTEM = `You are CONTEXA, embedded in claude.ai. You see the user's last message and Claude's reply. Propose the most useful next messages the user could send to move the work forward — the ones you would suggest if you were their sharpest collaborator looking at this exact conversation. Return BETWEEN THREE AND FIVE steps: as many as genuinely earn a place, and no more.
Each step has TWO parts:
- "label": AT MOST 6 WORDS. This is all the user sees on a small chip, so it must be instantly scannable: verb-first, imperative, plain language, no trailing punctuation, no category names. Keep the distinctive part of the idea in the label — never pad with generic verbs. All labels must be obviously different from each other at a glance. Examples of the right shape: "Write the hero copy", "Challenge my social-proof assumption", "Compare KV guard versus token bucket".
- "text": the full prompt loaded into the user's composer when they click the chip. This is where the value lives. ONE outcome per prompt — never bundle two asks or two questions. Be concrete: name the deliverable, the format, the length, or the constraint. Short sentences. Up to 220 characters. Write it in the user's own voice, first person, ready to send verbatim. Start with the ask: no persona preamble, no scene-setting, no meta commentary, no "you could ask". Use the imperative for prompts that request work, and a direct question when the point is to challenge an assumption or force a decision.
The label is a handle for the text; the text must deliver on what the label promises.
Rules for choosing them:
- Be specific to THIS conversation. Reference the actual content of the reply — its structure, its gaps, the decision it leaves open. Never generic advice that would fit any conversation.
- Assume the user is competent and has already thought of the obvious next step. Whatever anyone would type straight after reading this reply does not deserve a slot. Spend every slot on something they probably have not considered.
- Never suggest something the conversation already contains. If the reply already states it, lists it, explains it, or offers to do it next, asking for it again is wasted. Treat everything in the reply as already known to the user.
- Make every step a genuinely different move, never two phrasings of one idea. Cover distinct ground; a strong set usually draws from: going deeper on the most valuable part, resolving what the reply assumed or left ambiguous, the practical action that produces the real artifact, a different framing worth considering, and pressure-testing it (risks, failure modes, what is missing).
- Quality decides the count, not the maximum. Three strong steps beat five with two fillers. Omit any step that restates the reply, that you would not click yourself, or that exists only to reach five. Returning three is a correct answer, not a failure.
- The FIRST step must CHANGE the user's plan, not execute it. It must do one of these four things: question whether the work is needed at all, reframe the problem so a cheaper or better solution becomes visible, force a decision rule before more work happens, or replace reasoning with a concrete measurement. A step that implements, continues, or answers the plan already on the table is valuable but belongs in positions two to five — never first.
- If Claude asked the user a question, one step should answer it well, placed from second position onward, unless answering it also satisfies the rule above.
- Order the remaining steps by leverage: the one that most changes what the user does next comes earliest. The user reads left to right and often clicks only the first.
Reply with ONLY minified JSON containing three to five items: {"steps":[{"label":"...","text":"..."},{"label":"...","text":"..."},{"label":"...","text":"..."}]}`;

async function getSettings() {
  return chrome.storage.local.get(DEFAULTS);
}

/* Robust JSON extraction. Models sometimes wrap JSON in ``` fences, prepend a
   sentence, or get cut off by max_tokens mid-object. Handle all three rather
   than throwing a generic parse error. */
function extractJson(text) {
  let t = (text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = t.indexOf('{');
  if (start < 0) throw new Error('no JSON object in response');

  const end = t.lastIndexOf('}');
  if (end > start) {
    try { return JSON.parse(t.slice(start, end + 1)); } catch {}
  }

  // walk braces for the first balanced object (ignoring braces inside strings)
  let depth = 0, inStr = false, escaped = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { try { return JSON.parse(t.slice(start, i + 1)); } catch {} }
    }
  }

  const salvaged = salvageTruncated(t, start);
  if (salvaged) return salvaged;
  throw new Error('unparseable JSON');
}

/* Truncated response: rewind to the last COMPLETE element and close the
   structure, tracking both {} and [] (closing only braces leaves arrays open).
   Salvages the steps that came through whole. */
function salvageTruncated(t, start) {
  const stack = [];
  let inStr = false, escaped = false, safeIdx = -1, safeStack = null;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      stack.pop();
      if (stack.length) { safeIdx = i; safeStack = stack.slice(); }
    }
  }
  if (safeIdx < 0 || !safeStack) return null;
  const candidate = t.slice(start, safeIdx + 1) + safeStack.reverse().join('');
  try {
    const parsed = JSON.parse(candidate);
    Object.defineProperty(parsed, '__cxPartial', { value: true, enumerable: false });
    return parsed;
  } catch { return null; }
}

async function callClaude(system, userText, maxTokens) {
  const { apiKey, model } = await getSettings();
  if (!apiKey) return { error: 'no_key' };
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userText }]
      })
    });
  } catch (e) {
    return { error: 'network', detail: String(e) };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { error: 'api_' + res.status, detail: body.slice(0, 300) };
  }
  const data = await res.json();
  const text = (data.content || []).map(b => b.text || '').join('');
  const truncated = data.stop_reason === 'max_tokens';
  try {
    const parsed = extractJson(text);
    return { data: parsed, truncated, partial: parsed.__cxPartial === true };
  } catch {
    return {
      error: truncated ? 'truncated' : 'bad_json',
      detail: (truncated ? 'hit max_tokens; ' : '') + 'raw: ' + text.slice(0, 200)
    };
  }
}

/* Hosted path: the proxy holds the API key, so the user needs nothing. Returns
   the same shape as the direct path so callers do not care which was used. */
async function callHosted(prompt, reply) {
  const { proxyUrl } = await chrome.storage.local.get({ proxyUrl: DEFAULT_PROXY_URL });
  const base = String(proxyUrl || DEFAULT_PROXY_URL).replace(/\/+$/, '');
  if (/YOUR-SUBDOMAIN/.test(base)) return { error: 'proxy_not_configured' };
  const device = await getDeviceToken();
  let res;
  try {
    res = await fetch(base + '/v1/next-steps', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cx-device': device },
      body: JSON.stringify({ prompt, reply })
    });
  } catch (e) {
    return { error: 'network', detail: String(e) };
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 429) {
    return { error: 'quota', limit: data?.limit, resetsAt: data?.resetsAt };
  }
  if (!res.ok) return { error: data?.error || 'proxy_' + res.status };
  if (!data || !Array.isArray(data.steps)) return { error: 'bad_response' };
  return { data };
}

/* tiny in-memory cache (service worker lifetime) */
const stepsCache = new Map();
function cachePut(map, k, v) { map.set(k, v); if (map.size > 60) map.delete(map.keys().next().value); }

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'nextSteps') {
      const key = (msg.prompt || '').slice(0, 200) + '||' + (msg.reply || '').slice(0, 200);
      if (stepsCache.has(key)) return sendResponse(stepsCache.get(key));
      const { apiKey } = await getSettings();
      const prompt = (msg.prompt || '(not captured)').slice(0, 2500);
      const reply = (msg.reply || '').slice(0, 6000);
      // Own key = direct to Anthropic, unlimited. No key = hosted proxy, quota'd.
      const r = apiKey
        ? await callClaude(NEXT_STEPS_SYSTEM,
            'USER MESSAGE:\n' + prompt + '\n\nCLAUDE REPLY:\n' + reply, 1600)
        : await callHosted(prompt, reply);
      const out = r.error ? r : (r.partial ? Object.assign({}, r.data, { partial: true }) : r.data);
      if (!r.error) cachePut(stepsCache, key, out);
      sendResponse(out);

    } else if (msg.type === 'healthCheck') {
      const { proxyUrl } = await chrome.storage.local.get({ proxyUrl: DEFAULT_PROXY_URL });
      const base = String(proxyUrl || DEFAULT_PROXY_URL).replace(/\/+$/, '');
      if (/YOUR-SUBDOMAIN/.test(base)) return sendResponse({ error: 'proxy_not_configured' });
      try {
        const res = await fetch(base + '/v1/health');
        const data = await res.json().catch(() => ({}));
        sendResponse(res.ok && data.ok ? { ok: true, limit: data.limit } : { error: 'http_' + res.status });
      } catch (e) { sendResponse({ error: 'network' }); }

    } else if (msg.type === 'openOptions') {
      chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });

    } else if (msg.type === 'ping') {
      const r = await callClaude('Reply with exactly: {"ok":true}', 'ping', 20);
      sendResponse(r.error ? r : { ok: true });

    } else {
      sendResponse({ error: 'unknown_message' });
    }
  })();
  return true; // async sendResponse
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
