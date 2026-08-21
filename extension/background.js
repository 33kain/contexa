/* CONTEXA — service worker.
   Owns the single Anthropic API call this extension makes. The user's key never
   leaves chrome.storage.local except to go straight to api.anthropic.com. */

const API_URL = 'https://api.anthropic.com/v1/messages';

// Baked by build.mjs. Users can override this in Advanced settings.
const DEFAULT_PROXY_URL = 'https://contexa-api.michu110899.workers.dev';

/* The model this build ships as its default for the own-key path.
   Stored settings hold '' to mean "follow this", NOT a copy of this string — that
   distinction is the whole point. Persisting the default into storage is what
   froze early installs on Haiku: once the value was written, changing the default
   here could never reach them again. */
const SHIPPED_MODEL = 'claude-sonnet-5';

/* Values that USED to be SHIPPED_MODEL. A stored model matching one exactly is
   almost certainly a default we persisted on the user's behalf rather than a
   choice they typed — nobody types the value that is already the default — so the
   migration clears it and lets the current default win.
   Append when SHIPPED_MODEL changes. Never remove an entry: old installs can
   surface at any time. */
const SUPERSEDED_MODEL_DEFAULTS = ['claude-haiku-4-5'];

const DEFAULTS = {
  apiKey: '',                    // empty = use the hosted proxy (no key needed)
  model: '',                     // empty = follow SHIPPED_MODEL
  enabled: true,
  proxyUrl: DEFAULT_PROXY_URL,
  deviceToken: ''                // opaque, generated on first use, not an identity
};

/* One-time repair for installs predating the '' convention. Idempotent: it only
   writes when it finds a superseded value, so re-running it costs one read. */
async function migrateStoredModel() {
  const { model } = await chrome.storage.local.get({ model: '' });
  if (model && SUPERSEDED_MODEL_DEFAULTS.includes(model)) {
    await chrome.storage.local.set({ model: '' });
    console.log(`[CONTEXA] cleared superseded stored model "${model}" — now following the shipped default "${SHIPPED_MODEL}"`);
  }
}
chrome.runtime.onInstalled.addListener(migrateStoredModel);
chrome.runtime.onStartup.addListener(migrateStoredModel);
migrateStoredModel();   // MV3 workers are torn down constantly; cheap and safe to repeat

/* An anonymous per-install token so the proxy can apply a daily quota without
   knowing who anyone is. Not tied to the user, the browser profile, or claude.ai. */
async function getDeviceToken() {
  const { deviceToken } = await chrome.storage.local.get({ deviceToken: '' });
  if (deviceToken) return deviceToken;
  const fresh = crypto.randomUUID().replace(/-/g, '');
  await chrome.storage.local.set({ deviceToken: fresh });
  return fresh;
}

/* The evidence-grounded requisition design (0.9.17, per SPEC-v0.9.17.md):
   steps are the messages the assistant most needs to receive next, each earned
   by a verbatim fragment of the reply. Moves are examples, not categories;
   ordering is friction-aware; count 1-5 by evidence found, never padded. */
const NEXT_STEPS_SYSTEM = `You are CONTEXA, embedded in claude.ai. You see the user's last message and Claude's reply. Your job: write the messages this user would send next if they knew everything the assistant knows about what would improve the next turn — and prove each one from the reply's own words.
The capture of the reply may end with the line "[capture window ends here — the reply continues beyond this point]". That line is the edge of your viewport, not a defect in the reply. Never mention it, never describe the reply as cut off, and never ask for the continuation. Evidence must come from before it.
Return BETWEEN ONE AND FIVE steps. The evidence you actually find decides the count. The most common correct count is one or two. A reply blocked on one missing input deserves ONE dominant step. Padding to reach any count is a defect; returning a single step is a correct answer.
EVERY step must be earned by a verbatim fragment of the reply — the hedge it collapses, the request it fulfills, the options-language it commits, the completed claim it redirects. Put that fragment in the step's "evidence" field: at most 90 characters, copied exactly, never paraphrased. No quotable evidence, no step.
Moves that usually win — examples of the principle, NOT categories to fill; a set with one of each is almost certainly padded:
- Supply what the reply says it lacks. Evidence: its own request or inference-admission ("I'd need to see", "without knowing your", "assuming your setup"). Name the artifact, pin scope and format, mark the insertion point with <paste here>. Model: "The current prompts — system prompt, any instruction files, tool/function definitions. The actual text, not a summary. <paste here>". Write it so it works even unclicked, as a checklist of what to provide.
- Collapse a fork the reply planted. Evidence: its conditional language ("if you're on", "depending on whether", "either"). Start with "Assume", state the most plausible branch concretely, then direct the redo under exactly that. The user edits the assumption before sending if it is wrong. At most two per set.
- Invite Claude's questions. Evidence: the reply fills gaps with guesses, stacked assumptions, or a broad survey of an underspecified goal — the forks are invisible rather than visible. Write the message that flips the question burden: direct Claude to ask the user everything it needs to fully understand the goal before doing more work. Model: "Ask me everything you need to know to get this right — one focused list, then wait for my answers before continuing." Use a decree when a fork is visible; invite questions when the forks are invisible. At most one per set.
- Grant commitment. Evidence: options-language or a hedged survey. Direct the assistant to pick the option it would choose itself and produce the complete version — no alternatives section, no abbreviations, nothing left as an option.
- Redirect the angle. Evidence: a finished claim, plan, or design standing in the reply. Rebuild under the opposite assumption, argue against it and keep only what survives, or optimize for a different constraint. Aim at the WORK, never at quizzing the user. At most one per set, and only when the reply contains finished work.
When the exchange reads like the OPENING of a task — a broad request met by a first-pass answer resting on guessed scope, audience, or purpose — the set leans foundation-first: an invite-questions step and decrees that pin what the work is, who it is for, why it matters, and the one key action or outcome it must serve. Vague foundations compound; settle them before continuation steps.
Ordering, by friction and leverage:
- If the reply explicitly requests input or states it is reasoning without something, the supply step goes FIRST.
- Otherwise slot one goes to the highest-leverage step the user can send within seconds, unedited or after touching one assumption.
- At most one step per set may require the user to gather and paste material; when it is not first, it goes last.
- Remaining steps order by how much they advance the work. Most users read only the first step.
Hard rules:
- Directive is the default shape. A step may be question-form ONLY when the question is aimed at Claude and is the sharpest form of the ask ("What breaks first under 10x load?"). NEVER a question aimed at the user or one that needs the user's knowledge to answer — if only the user knows it, decree it or invite Claude to ask.
- The text always addresses Claude. When an action can only be done by the user — running a command on their machine, clicking, waiting, pasting — the text directs Claude to prepare or verify Claude's side of it; it never commands Claude to perform the user's action and never contains instructions aimed at the user.
- Ground every step in THIS reply's actual content. Never re-request anything the reply already delivered. One move per step; no two steps are the same move rephrased.
Each step has THREE parts:
- "label": AT MOST 4 WORDS, verb-first, plain language, no punctuation. All labels obviously different at a glance.
- "text": the full prompt loaded into the composer, ready to send verbatim, up to 280 characters. Name the thing, then pin scope and format. Short lines, with \n between lines inside the JSON string when structure helps; inline lists are fine; no preamble, no meta commentary. Step texts are prose. Refer to code by its name and location — a function, a file, a line — and when a step's outcome is new or changed code, the text directs Claude to write it rather than containing it. A step text never includes code lines or snippets.
- "evidence": the verbatim reply fragment that earned this step, at most 90 characters.
Reply with ONLY minified JSON: {"steps":[{"label":"...","text":"...","evidence":"..."}]} with one to five items.`;

/* The fifth chip (0.9.23): rough ask in, well-formed prompt out. Fixes FORM
   (scope, format, anti-goals, inert adjectives), never invents CONTENT —
   missing decisions surface as <slots> and "Assume:" lines the user edits.
   MUST stay byte-identical to the copy in extension/background.js;
   build.mjs enforces it exactly like NEXT_STEPS_SYSTEM. */
const EXPAND_SYSTEM = `You are CONTEXA's prompt writer, embedded in claude.ai. The user typed a rough ask. Rewrite it as the message they would send if they wrote prompts for a living: same intent, same voice, more decidable. You also see their last message and Claude's reply for context.
Input sections: ROUGH ASK (what they typed), THEIR LAST MESSAGE, CLAUDE'S REPLY. The reply may end with the line "[capture window ends here — the reply continues beyond this point]" — that is the edge of your viewport, not a defect; never mention it.
Write the prompt as the user, in first person, addressed to Claude, ready to send verbatim. No persona preamble, no meta commentary, no politeness padding.
Rules, in order of force:
- Preserve exactly what the user asked for. Never add a second ask they did not state, never drop part of what they did state.
- Start with an imperative line stating the outcome. If the rough ask is a challenge or a question, keep it a question — aimed at Claude, never at the user.
- If Claude's reply is what the ask acts on, name the actual thing from the reply — the file, the section, the claim, the number — using the reply's own words for anything factual. If the rough ask is unrelated to the reply, ignore the reply completely.
- Make scope explicit when the conversation makes it inferable: what to change, and what to leave unchanged. Phrase anti-goals positively ("leave the visible copy unchanged"), not as warnings.
- Add format, length, or count constraints only when the intent or the conversation implies them. Never invent numbers, names, keywords, or file paths that appear nowhere.
- When a material fact only the user knows is missing, put a slot in angle brackets, like <main keyword> — at most 2 slots. When a reasonable default is worth surfacing, add a final line starting "Assume:" — at most 2. Never bake a silent choice into the prompt.
- Never use filler quality words: thorough, careful, carefully, properly, really, robust, comprehensive, high-quality, detailed, best. They change nothing. Constraints change things.
- If the rough ask is already a good prompt, return it nearly verbatim with only mechanical fixes. Longer without more decidable is failure.
- If expansion would need more than two slots, the ask is not expandable. Output instead, in the user's voice: "I want help with <topic>. Ask me everything you need to know to get this right — one focused list, then wait for my answers before continuing."
- At most 700 characters. Short sentences. When constraints deserve their own lines, start each with "- " and put a real newline between lines by writing \\n inside the JSON string.
Examples of the right shape:
ROUGH ASK: optimize seo & meta (Claude just built a landing page)
PROMPT: Optimize the SEO of the page you just built. Work only inside <head> and the heading structure — leave the visible copy unchanged.
- title tag and meta description targeting <main keyword>
- Open Graph and Twitter card tags
- one h1, logical h2/h3 order
Show the changed lines only.
Assume: single-page site with no domain yet, so skip canonical URLs.
ROUGH ASK: make it shorter (after a long explanation)
PROMPT: Rewrite your last answer at a third of the length. Keep the store-review warning and the cost numbers; drop the background on how tokenizers work. Plain paragraphs, no headers.
ROUGH ASK: is this actually secure (after Claude proposed an architecture)
PROMPT: Attack your own proposal before I build it. Where does the origin check fail, what can a malicious page do with the open health endpoint, and which assumption is weakest? Name concrete attacks, not categories — and if one is fatal, say so plainly.
ROUGH ASK: email to my landlord about deposit (unrelated to the reply)
PROMPT: Draft an email to my landlord asking for my deposit back.
- moved out <date>; the deposit was <amount>
- firm but polite, under 150 words
- cite the handover inspection we did together
Assume: this is my first written request.
ROUGH ASK: marketing (nothing relevant in the reply)
PROMPT: I want help with marketing. Ask me everything you need to know to get this right — one focused list, then wait for my answers before continuing.
Reply with ONLY minified JSON: {"prompt":"..."}`;


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
  // Resolve here, not at save time: an unset override must always follow the
  // current shipped default, including after an update changes it.
  const useModel = model || SHIPPED_MODEL;

  /* Sonnet 5 defaults to ADAPTIVE thinking when the field is absent — observed
     burning the whole 2,500-token budget on a thinking block with zero text
     out. So thinking is disabled explicitly. BUT: some models (Fable 5,
     Mythos 5) REJECT the disable with a 400 — thinking cannot be turned off
     there. Model-agnostic resolution: attempt with disabled; if the API's 400
     names the thinking config, retry once without the field and let that
     model's default stand. No model list to maintain, future models included. */
  const payload = {
    model: useModel,
    max_tokens: maxTokens,
    thinking: { type: 'disabled' },
    system,
    messages: [{ role: 'user', content: userText }]
  };
  let res, body = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      return { error: 'network', detail: String(e) };
    }
    if (res.ok) break;
    body = await res.text().catch(() => '');
    // Every error path logs its full evidence at the moment of capture.
    console.warn('[CONTEXA] api error', res.status, body.slice(0, 300));
    if (attempt === 0 && res.status === 400 && /thinking/i.test(body) && payload.thinking) {
      console.warn('[CONTEXA] model rejected the thinking config — retrying without it');
      delete payload.thinking;
      continue;
    }
    break;
  }
  if (!res.ok) {
    return { error: 'api_' + res.status, detail: body.slice(0, 300) };
  }
  const data = await res.json();
  const text = (data.content || []).map(b => b.text || '').join('');
  const truncated = data.stop_reason === 'max_tokens';
  try {
    const parsed = extractJson(text);
    return { data: parsed, truncated, partial: parsed.__cxPartial === true };
  } catch {
    /* `detail` used to hold the only clue and nothing ever read it, so a
       truncation was reported without any way to learn its cause. Log the
       evidence where it can actually be found — the service worker console —
       and return the numbers that separate the possible causes. */
    const diag = diagnose(data, text, maxTokens);
    console.warn('[CONTEXA] parse failure', diag, 'text[0,300]=', text.slice(0, 300));
    return { error: truncated ? 'truncated' : 'bad_json', diag };
  }
}

/* Identify why a response could not be parsed, without conversation content.
   `blocks` is decisive: budget spent on content types other than `text` leaves a
   short body with `out` at the ceiling, and raising max_tokens will not fix it. */
function diagnose(data, text, ceiling) {
  return {
    stop: data.stop_reason || null,
    out: data.usage ? data.usage.output_tokens : null,
    in: data.usage ? data.usage.input_tokens : null,
    ceiling: ceiling ?? null,
    len: text.length,
    hadJson: text.indexOf('{') >= 0,
    steps: (text.match(/"label"\s*:/g) || []).length,
    blocks: [...new Set((data.content || []).map(b => b.type || 'unknown'))]
  };
}

/* The fifth chip's clean-boundary cap. Hard 900; the prompt's soft target is
   700. Mirrors trimExpansion in worker/src/index.js. */
const MAX_EXPANSION_CHARS = 900;
function trimExpansion(value) {
  const t = String(value || '').trim();
  if (t.length <= MAX_EXPANSION_CHARS) return t;
  const cut = t.slice(0, MAX_EXPANSION_CHARS);
  const nl = cut.lastIndexOf('\n');
  if (nl > MAX_EXPANSION_CHARS * 0.5) return cut.slice(0, nl).trimEnd();
  const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  if (dot > MAX_EXPANSION_CHARS * 0.5) return cut.slice(0, dot + 1).trimEnd();
  const sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.slice(0, sp) : cut).trimEnd();
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
  if (!res.ok) {
    // Surface the worker's diagnostic instead of swallowing it — otherwise the
    // hosted path is undiagnosable from the browser.
    if (data?.diag) console.warn('[CONTEXA] backend reported', data.error, data.diag);
    return { error: data?.error || 'proxy_' + res.status, diag: data?.diag };
  }
  if (!data || !Array.isArray(data.steps)) return { error: 'bad_response' };
  return { data };
}

/* Hosted expand — same worker, same device token, same daily pool. */
async function callHostedExpand(intent, prompt, reply) {
  const { proxyUrl } = await chrome.storage.local.get({ proxyUrl: DEFAULT_PROXY_URL });
  const base = String(proxyUrl || DEFAULT_PROXY_URL).replace(/\/+$/, '');
  if (/YOUR-SUBDOMAIN/.test(base)) return { error: 'proxy_not_configured' };
  const device = await getDeviceToken();
  let res;
  try {
    res = await fetch(base + '/v1/expand', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cx-device': device },
      body: JSON.stringify({ intent, prompt, reply })
    });
  } catch (e) {
    return { error: 'network', detail: String(e) };
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 429) {
    return { error: 'quota', limit: data?.limit, resetsAt: data?.resetsAt };
  }
  if (!res.ok) {
    if (data?.diag) console.warn('[CONTEXA] backend reported', data.error, data.diag);
    return { error: data?.error || 'proxy_' + res.status, diag: data?.diag };
  }
  if (!data || typeof data.prompt !== 'string' || !data.prompt.trim()) return { error: 'bad_response' };
  return { prompt: data.prompt };
}

/* SPEC §2.1/§2.6 — evidence validation for the own-key path; the worker does
   the same for hosted. Steps without evidence are dropped: a model that
   ignored the grounding contract gets no benefit of the doubt. Near-miss
   quotes (usually whitespace drift) render but are counted and logged.
   Evidence is stripped here — it never reaches content.js or the composer. */
const normWs = s => String(s || '').replace(/\s+/g, ' ').trim();
function refineSteps(parsed, replyStr) {
  const raw = Array.isArray(parsed && parsed.steps) ? parsed.steps : [];
  const withEv = raw.filter(s =>
    s && typeof s.text === 'string' && s.text.trim() && normWs(s.evidence));
  const normReply = normWs(replyStr);
  let grounded = 0;
  for (const s of withEv) {
    if (normReply.includes(normWs(s.evidence))) grounded++;
    else console.log('[CONTEXA] ungrounded chip', String(s.label || '').slice(0, 40));
  }
  console.log('[CONTEXA] evidence', withEv.map(s => String(s.evidence).slice(0, 90)));
  return {
    steps: withEv.slice(0, 5).map(s => ({ label: String(s.label || '').slice(0, 80), text: String(s.text) })),
    grounding: { total: raw.length, kept: Math.min(withEv.length, 5), grounded }
  };
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
            'USER MESSAGE:\n' + prompt + '\n\nCLAUDE REPLY:\n' + reply, 2500)
        : await callHosted(prompt, reply);
      let out;
      if (r.error) {
        out = r;
      } else if (apiKey) {
        // Own-key: validate evidence here (hosted responses arrive already
        // validated and stripped by the worker).
        const refined = refineSteps(r.data, reply);
        out = refined.steps.length
          ? Object.assign(refined, r.partial ? { partial: true } : null)
          : { error: 'no_steps' };
      } else {
        out = r.partial ? Object.assign({}, r.data, { partial: true }) : r.data;
      }
      if (!out.error) cachePut(stepsCache, key, out);   // refine can fail even when the call succeeded
      sendResponse(out);

    } else if (msg.type === 'expandPrompt') {
      /* The fifth chip: rough ask -> drafted prompt. No cache — typed intents
         do not repeat the way replies do. Spends from the same daily pool. */
      const intent = String(msg.intent || '').trim().slice(0, 300);
      if (!intent) return sendResponse({ error: 'bad_request' });
      const { apiKey } = await getSettings();
      const prompt = (msg.prompt || '(not captured)').slice(0, 2500);
      const reply = (msg.reply || '').slice(0, 6000);
      if (apiKey) {
        // Section labels MUST match worker/src/index.js byte-for-byte.
        const r = await callClaude(EXPAND_SYSTEM,
          'ROUGH ASK:\n' + intent
            + '\n\nTHEIR LAST MESSAGE:\n' + prompt
            + '\n\nCLAUDE\'S REPLY:\n' + (reply || '(none)'), 1200);
        if (r.error) return sendResponse(r);
        const drafted = trimExpansion(typeof r.data?.prompt === 'string' ? r.data.prompt : '');
        sendResponse(drafted ? { prompt: drafted } : { error: 'no_prompt' });
      } else {
        sendResponse(await callHostedExpand(intent, prompt, reply));
      }

    } else if (msg.type === 'healthCheck') {
      const { proxyUrl } = await chrome.storage.local.get({ proxyUrl: DEFAULT_PROXY_URL });
      const base = String(proxyUrl || DEFAULT_PROXY_URL).replace(/\/+$/, '');
      if (/YOUR-SUBDOMAIN/.test(base)) return sendResponse({ error: 'proxy_not_configured' });
      try {
        const res = await fetch(base + '/v1/health');
        const data = await res.json().catch(() => ({}));
        // Pass version/model straight through: it turns "Test connection" into a
        // real answer about which backend build is live, not just a reachability ping.
        sendResponse(res.ok && data.ok
          ? { ok: true, limit: data.limit, version: data.version, model: data.model,
              configured: data.configured }
          : { error: 'http_' + res.status });
      } catch (e) { sendResponse({ error: 'network' }); }

    } else if (msg.type === 'openOptions') {
      chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });

    } else if (msg.type === 'ping') {
      const r = await callClaude('Reply with exactly: {"ok":true}', 'ping', 20);
      const { model } = await getSettings();
      // Report the model actually used, so the settings page can name it rather
      // than leaving the user to guess which tier their key just spoke to.
      sendResponse(r.error ? r : { ok: true, model: model || SHIPPED_MODEL });

    } else if (msg.type === 'getConfig') {
      // Single source of truth for the shipped default; the options page reads it
      // from here instead of keeping a copy that could drift.
      sendResponse({ shippedModel: SHIPPED_MODEL });

    } else {
      sendResponse({ error: 'unknown_message' });
    }
  })();
  return true; // async sendResponse
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
