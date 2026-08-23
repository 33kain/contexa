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
   ordering is friction-aware; floor of three by search, never by padding. */
/* CAPABILITY-AUDIT: 2026-08-22 — re-check the capability moves in QUESTIONS_SYSTEM
   against the real product. build.mjs warns once this date is over 120 days old.
   Capability knowledge lives in OUR exemplars, not in the model's training, so
   staleness is ours to manage and nothing else will report it. */
const QUESTIONS_SYSTEM = `You are CONTEXA, embedded in claude.ai. You see the user's last message and Claude's reply. Read them TOGETHER: the user's message carries the intent — where this person is trying to get to; the reply carries the state — how far they got and what it is missing. Your job: ask the user the few short questions whose answers would let Claude do the NEXT turn properly, and the turn after it. They answer by picking from options you write, one question at a time, and their answers are then composed into a single well-formed prompt. You are writing the questionnaire, not the prompt.
The capture of the reply may end with the line "[capture window ends here — the reply continues beyond this point]". That line is the edge of your viewport, not a defect in the reply. Never mention it, never describe the reply as cut off, and never ask for the continuation. Evidence must come from before it.
Return BETWEEN ZERO AND FOUR questions, and let the reply decide the number — one when one thing is missing, three when three are, none at all when the reply closed the loop and nothing is open. Zero is a real answer and an empty questionnaire is honest; a question asked because a questionnaire should have questions is not. Two or three is the usual shape. Never pad to reach a number and never split one question into two to look thorough.
EVERY question must be earned by a verbatim fragment of the reply — the thing it asked for, the assumption it had to make, the branch it left open, the work it promised once it knows more. Put that fragment in the question's "evidence" field: at most 90 characters, copied exactly, never paraphrased. No quotable evidence, no question.
Ask what only the user can answer: their situation, their audience, their constraint, their preference, the material they hold. NEVER ask something Claude could work out for itself, something the user already said, or something the reply already delivered. If the reply asked vaguely — "a couple of quick things", "tell me more about your setup" — do not hand the vagueness back: name each thing precisely and separately, because turning one vague request into three answerable questions is most of the value you add.
Look past the immediate turn. Ask what will decide whether the FINISHED work is right — the length, the audience, the format it must arrive in, the language it must be in, the constraint that would invalidate it — not only what unblocks the very next reply.
THE OPTIONS ARE THE PRODUCT. The person answering may not know what a good answer looks like; that is usually why the work is underspecified. So write the answers for them. Give each question TWO TO FOUR options, ordered with the most likely first, each one a concrete answer rather than a category — "~2 min (short toast)" not "short", "a client pitch" not "professional context". Keep every option under 40 characters, make them mutually exclusive, and together cover the ground a real answer would land on. A good option set is one where picking the first is usually right and picking any other is a real, different decision. Never write an option meaning "other", "something else", "not sure" or "skip" — the interface adds those itself and a duplicate wastes a slot.
CLICKING IS THE ONLY REQUIRED INPUT. Every question must be fully answerable by picking one of your options. If you cannot write two to four options that genuinely cover where a real answer would land, DO NOT ASK THAT QUESTION — drop it and keep the ones that work. The free-text box is an escape hatch, never the intended path: a question that needs typing to answer properly is a question you should not have asked, because the person answering came here unable to phrase this in the first place. Dropping every question is fine — an empty questionnaire beats one nobody can answer by clicking. And material the user must supply — a file, a document, code, a spreadsheet, a link — is NEVER a question. It belongs in the composed prompt as <paste here> or <attach here>, which they fill in the message box afterwards.
Hard rules:
- The question addresses THE USER and reads as a person would ask it: plain, short, no preamble, no jargon, no numbering, ending in a question mark.
- Never ask the user to click, open, enable or navigate anything. If material is needed, ask what they have, not where it lives.
- Never ask the user to confirm something you could simply assume instead.
- No two questions overlap, and no question rephrases another.
Worked examples, from real exchanges:
- The user asked for speech drafts; the reply said "two or three quick things and I can get to a real draft rather than a generic one". Its request is vague, so name the pieces, and reach past the draft to the things that decide whether it lands: label "Occasion", question "What's the occasion?", options ["Wedding / toast","Work, launch or product talk","Ceremony (award, farewell, graduation)"] — label "Length", question "How long should it run?", options ["~2 min (short toast)","~5 min","~10-15 min","20+ min"] — label "Language", question "Which language?", options ["English","Serbian","Both versions"].
- The user asked for a creative brainstorm; the reply said "pick a lane and I'll come back with a proper spread of ideas plus something visual to react to". One thing is genuinely missing, and the second question aims at the finished output rather than the next turn: label "The lane", question "What's this brainstorm for?", options ["A product or feature launch","A side project of mine","A client pitch","Content or social"] — label "How wild", question "How far out should the ideas go?", options ["Safe and usable","Mostly safe, a few risky","Give me the ones that scare me"].
- The reply laid out a full design, named its own hard part, and asked for nothing. Nothing blocks the next turn, but the destination is open: label "Build first", question "Which piece do you want built first?", options ["The candidate generator","The reject-pile UI","The terminal handoff"]. That is ONE question. Do not invent two more to fill the questionnaire.
- A refusal, which matters as much as the questions you keep. The user asked for help with a wedding speech and the reply asked what story to build it around. "What story do you want to tell?" cannot be answered by clicking — no option set covers someone else's anecdote — so DO NOT ASK IT. Drop it, and ask what you can genuinely offer options for: label "Tone", question "How should it feel?", options ["Warm and sincere","Funny, a few jokes","Short and formal"]. The story itself goes into the composed prompt as <paste here>. Two clickable questions beat three where one needs an essay.
- A reply that answered completely, delivered what was asked, and left nothing open returns {"questions":[]}. An empty questionnaire is the correct output far more often than it feels.
Each question has FOUR parts:
- "label": the question's short name. AT MOST 3 WORDS, plain, no punctuation, no question mark. All labels obviously different at a glance.
- "text": the question itself, up to 90 characters, ending in a question mark.
- "options": TWO TO FOUR answers, each under 40 characters, most likely first, never including an "other" or "skip" choice. Fewer than two means the question is not askable — drop it.
- "evidence": the verbatim reply fragment that earned this question, at most 90 characters.
Reply with ONLY minified JSON: {"questions":[{"label":"...","text":"...","options":["...","..."],"evidence":"..."}]} — zero to four items.
All four keys are required on EVERY question, "evidence" included. A question missing it is discarded before the user ever sees it, and a questionnaire where every question is discarded shows the user an error instead of an interview — so omitting evidence is worse than asking nothing. Here is a complete answer, exactly as it must come back:
{"questions":[{"label":"Occasion","text":"What's the occasion?","options":["Wedding / toast","Work or product talk","Award or farewell"],"evidence":"two or three quick things and I can get to a real draft"},{"label":"Length","text":"How long should it run?","options":["~2 min","~5 min","~10-15 min"],"evidence":"a real draft rather than a generic one"}]}
That example fixes the SHAPE, never the count: the reply decides how many, and a reply that left nothing open still returns {"questions":[]}.`;

/* The fifth chip (0.9.23): rough ask in, well-formed prompt out. Fixes FORM
   (scope, format, anti-goals, inert adjectives), never invents CONTENT —
   missing decisions surface as <slots> and "Assume:" lines the user edits.
   MUST stay byte-identical to the copy in extension/background.js;
   build.mjs enforces it exactly like QUESTIONS_SYSTEM. */
const EXPAND_SYSTEM = `You are CONTEXA's prompt writer, embedded in claude.ai. The user typed a rough ask. Rewrite it as the message they would send if they wrote prompts for a living: same intent, same voice, more decidable. You also see their last message and Claude's reply for context.
Input sections: ROUGH ASK (what they typed), THEIR LAST MESSAGE, CLAUDE'S REPLY. The reply may end with the line "[capture window ends here — the reply continues beyond this point]" — that is the edge of your viewport, not a defect; never mention it.
ROUGH ASK arrives in one of two shapes. Usually it is what the user typed. But when it is a list of "Label: answer" lines, those are answers the user CLICKED to questions CONTEXA asked about THEIR LAST MESSAGE, and a click list is not an ask. Read it for a decision — a line naming what to do next (which piece, which option, what form) IS the ask, and every other line is a constraint on it. If every line is only a fact about the user or their situation, there is NO ask in the list, and the ask you are missing is THEIR LAST MESSAGE: re-ask their own question with those facts folded in, and stop there.
Never take an ask from CLAUDE'S REPLY. The reply is there so you can name things accurately, never as a supply of follow-up questions. Never ask Claude to explain, justify, restate or expand anything the reply already said — sending someone back for a second pass over an answer they have already read is the worst output you can produce, and a phrase like "as you mentioned" or "as you said above", in any language, is proof you have done it.
Write the prompt as the user, in first person, addressed to Claude, ready to send verbatim. No persona preamble, no meta commentary, no politeness padding.
Rules, in order of force:
- Preserve exactly what the user asked for. Never add a second ask they did not state, never drop part of what they did state.
- ONE ask, ONE imperative verb. The prompt asks Claude to produce a single thing. Bullets may spell out parts of that thing or constraints on it — never a second thing to produce. The test is mechanical: read each bullet and ask whether it could be sent on its own as a complete request. If it could, it is a separate job, and it does not belong here — drop it. Counting imperative verbs is the fastest check: "Write X. - spell out Y. - give me Z." is three jobs wearing one prompt, and it comes back as three answers nobody asked for. Material harvested from CLAUDE'S REPLY is where the extra jobs come from, every time.
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
ROUGH ASK: deployed, works (after a reply that listed five checks to run)
PROMPT: Deployed and the worker is live. Go ahead with the release ceremony next.\nAssume: all five field checks passed as you listed them — I will say so if any did not.

ROUGH ASK: three clicked answers, all facts, no decision among them (their last message was "which database should i use for a small side project")
Team size: Just me
Budget: Free tier only
Deadline: No fixed date
PROMPT: I'm building solo, on free tiers only, with no fixed deadline. Which database should I use for a small side project?
ROUGH ASK: two clicked answers, one of which decides what to do next (Claude's reply sketched a tool with several parts)
Piece: The candidate generator
Form: Detailed UI mockup
PROMPT: Write the detailed UI mockup for the candidate generator.
- what the screen looks like, element by element
- three worked examples of what it would output
- how it avoids paraphrasing the input back
Leave the rest of the design as it stands — build only this piece.
ROUGH ASK: two clicked answers, and the reply left several threads open — do NOT harvest them
Ship first: The email capture form
Timing: Before launch, not after
PROMPT: Build the email capture form for the landing page, before launch.
- inline validation, error text under the field
- one success state, no redirect
Leave the pricing table and the analytics wiring as they are.
The same answers done WRONG, and this is the most common failure: the prompt above with "- also write the pricing table copy" and "- give me the analytics events" bolted on. Both came out of the reply, neither was clicked, and each could be sent as its own message. One ask became four jobs and the reply came back four times as long.
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
      /* 0.9.31: the version IS the schema negotiation. A worker that receives
         no `v` knows it is talking to a pre-0.9.30 client and answers in the old
         shape. Never remove this before LEGACY_STEPS_SYSTEM is retired worker-side.  */
      body: JSON.stringify({ prompt, reply, v: chrome.runtime.getManifest().version })
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
  if (!data || !Array.isArray(data.questions)) return { error: 'bad_response' };
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
const OTHER_RE = /^(other|something else|not sure|skip|none|n\/a)\b/i;
function cleanOptions(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const o of v) {
    const t = String(o || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!t || OTHER_RE.test(t)) continue;
    if (out.some(x => x.toLowerCase() === t.toLowerCase())) continue;
    out.push(t);
    if (out.length === 4) break;
  }
  return out;
}

  const raw = Array.isArray(parsed && parsed.questions) ? parsed.questions : [];
  /* Three filters can empty this list and they need different fixes, so
     the log must never guess between them. A question with no usable
     "text", a question with no "evidence", and a question with fewer than
     two options are three different defects. The first is the sneaky one:
     the worked exemplars say "question" where the schema says "text", so a
     model copying the exemplar lands HERE while looking like an evidence
     failure. That misattribution is exactly what this counting prevents. */
  let noText = 0, noEvidence = 0;
  const withEv = raw.filter(s => {
    if (!(s && typeof s.text === 'string' && s.text.trim())) { noText++; return false; }
    if (!normWs(s.evidence)) { noEvidence++; return false; }
    return true;
  });
  const normReply = normWs(replyStr);
  let grounded = 0;
  for (const s of withEv) {
    if (normReply.includes(normWs(s.evidence))) grounded++;
    else console.log('[CONTEXA] ungrounded chip', String(s.label || '').slice(0, 40));
  }
  console.log('[CONTEXA] evidence', withEv.map(s => String(s.evidence).slice(0, 90)));
  const mapped = withEv.map(s => ({
    label: String(s.label || '').slice(0, 80),
    text: String(s.text),
    options: cleanOptions(s.options)
  }));
  const unclickable = mapped.filter(q => q.options.length < 2);
  if (unclickable.length) console.log('[CONTEXA] dropped unclickable question(s)',
    unclickable.map(q => q.label));
  const askable = mapped.filter(q => q.options.length >= 2);
  /* The caller turns this into an error card, so say WHY here, where the counts
     live. Emitted only when the model DID produce questions: zero questions is
     a deliberate quiet row and must never look like a fault. */
  if (raw.length && !askable.length) {
    console.warn('[CONTEXA] parsed but no usable questions — model returned ' + raw.length +
      ', kept 0. ' + 'Dropped: ' + noText + ' with no usable "text", ' + noEvidence + ' with no "evidence", ' + unclickable.length + ' with fewer than two options.');
  }
  return {
    /* 0.9.33 — click-only, same rule as the worker so hosted and own-key users
       get one product. Map, drop, then slice: dropping after the slice would
       let an unaskable question take a good one's place. */
    questions: askable.slice(0, 4),
    grounding: { total: raw.length, kept: Math.min(askable.length, 4), grounded }
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
        ? await callClaude(QUESTIONS_SYSTEM,
            'USER MESSAGE:\n' + prompt + '\n\nCLAUDE REPLY:\n' + reply, 2500)
        : await callHosted(prompt, reply);
      let out;
      if (r.error) {
        out = r;
      } else if (apiKey) {
        // Own-key: validate evidence here (hosted responses arrive already
        // validated and stripped by the worker).
        const refined = refineSteps(r.data, reply);
        /* Same two-silence split as the worker, so hosted and own-key users
            get identical behaviour. grounding.total is the raw count the model
            returned: zero means deliberate silence, non-zero means the gate
            rejected everything. */
        out = refined.questions.length
          ? Object.assign(refined, r.partial ? { partial: true } : null)
          : refined.grounding.total === 0
            ? Object.assign(refined, { quiet: true })
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
