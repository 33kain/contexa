/* CONTEXA API — Cloudflare Worker.
   A thin proxy so users never need their own Anthropic key. It holds YOUR key
   as a secret, enforces per-device and per-IP daily quotas, and clamps input
   size so a malicious client cannot run up your bill.

   Endpoints:
     POST /v1/next-steps  -> { steps: [{label, text}], quota: {used, limit} }
     POST /v1/expand      -> { prompt, quota: {used, limit} }   (the fifth chip)
     GET  /v1/health      -> { ok: true }

   Secrets / bindings (see wrangler.toml and README):
     ANTHROPIC_API_KEY  secret   your key
     IP_SALT            secret   any random string; salts hashed IPs
     CX_KV              KV       quota counters
     ALLOWED_EXTENSION_IDS  var  comma-separated Chrome extension IDs (optional)
*/

/* The WORKER's build number, bumped on every deploy so /v1/health can prove
   which build is live. Deliberately independent of the extension's manifest
   version — they ship on separate paths and a worker fix should not force
   everyone to reinstall the extension. */
const BUILD = '0.9.35';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
/* Sonnet 5 rather than Haiku, on measured evidence: in a controlled three-model
   comparison Haiku ignored the label-length rule (4/11 over cap), largely ignored
   the bullet instruction (1/11), and twice wrote steps that asked the USER a
   question it could not answer — all defects that three rounds of prompt work
   failed to fix. Sonnet 5 scored 0/13 over cap, 10/13 bulleted, no voice
   inversion, for $0.004 more per call. Opus 5 produced the best single suggestion
   but failed a request outright at 5x the cost. */
const MODEL = 'claude-sonnet-5';

// Quotas. Client values are never trusted; these are the only limits that count.
const DEVICE_DAILY_LIMIT = 20;
// Second axis: blunts reinstall-for-a-fresh-token abuse. Deliberately generous
// relative to the device limit, because legitimate users share IPs — an office or
// a flat would otherwise block each other and it would look like a broken product.
// Keep this at roughly 10x DEVICE_DAILY_LIMIT.
const IP_DAILY_LIMIT = 300;
const KV_TTL_SECONDS = 60 * 60 * 48;

// Cost guards: a request can never be larger than this, whatever the client sends.
const MAX_PROMPT_CHARS = 2500;
const MAX_REPLY_CHARS = 6000;
const MIN_REPLY_CHARS = 50;
const MAX_TOKENS = 2500;   // Opus hit the 1600 ceiling and failed; Sonnet writes longer than Haiku too

// The fifth chip: one drafted prompt, not five steps — a smaller ceiling, and a
// typed intent can never be longer than the input field allows client-side.
const MAX_INTENT_CHARS = 300;
const EXPAND_MAX_TOKENS = 1200;
const MAX_EXPANSION_CHARS = 900;   // hard cap; the prompt's own soft target is 700

/* 0.9.31 — dual schema, and why it exists.
   0.9.30 renamed the wire field from `steps` to `questions` and changed what a
   row IS: a composer-ready message became a questionnaire. That breaks in BOTH
   directions across a client the server cannot upgrade — an old extension asked
   for `steps` and got none; a new one asked for `questions` from an old worker
   and got none. Either way the user sees "Couldn't write suggestions".

   The store approves on Google's clock, not ours, so there is no deploy order
   that avoids a window of breakage. Instead the worker serves both generations:
   0.9.30+ sends its version in the request, and anything that does NOT send one
   is, by definition, an older client — old clients never change, so their
   silence is a reliable signal.

   Cost: the previous prompt has to stay live here, worker-only, with no
   counterpart in the extension. RETIREMENT: once the store has been on 0.9.30+
   long enough that no older install is plausibly still calling, delete
   LEGACY_STEPS_SYSTEM, this comment, and the negotiation. Written down because
   a transition shim with no removal note is permanent. */
const LEGACY_STEPS_SYSTEM = `You are CONTEXA, embedded in claude.ai. You see the user's last message and Claude's reply. Read them TOGETHER: the user's message carries the intent — where this person is trying to get to and why; the reply carries the state — how far they got. Your job: write the ONE message the user would send two turns from now if they could already see the road. Think past the obvious next step to the destination it serves, and fold the follow-through in now.
The capture of the reply may end with the line "[capture window ends here — the reply continues beyond this point]". That line is the edge of your viewport, not a defect in the reply. Never mention it, never describe the reply as cut off, and never ask for the continuation. Evidence must come from before it.
Return AT MOST ONE step. Zero is a real answer: when the reply closed the loop and nothing worth a click remains, return no step at all. An empty row is honest; a filler chip is not. And one strong step beats one adequate step — if what you have is merely adequate, reread the pair for the move that would make the user think "that is exactly where I was going."
EVERY step must be earned by a verbatim fragment of the reply — the sentence where the road ahead shows through: the request it makes, the hard part it names, the offer it ends on, the assumption it leans on. Put that fragment in the step's "evidence" field: at most 90 characters, copied exactly, never paraphrased. No quotable evidence, no step.
NEVER return the obvious next step — the message the user would type without you: answering the reply's direct question, picking an item from its menu, saying yes to what it offered. If the reply ends in options, do not transcribe them into a chip; the user can already see them. Choose the most plausible road, mark the choice with "Assume" so the user can strike it, then drive past the first junction: fold in what they would ask for two turns later — the format that makes the output judgeable, the decision the work is for, the check that must pass before it counts.
When the road runs through something Claude can do, route the step through it as part of the plan, never as a tip: a document that will be revised again lives in an artifact Claude keeps updated; a claim that may have changed gets verified with web search before more is built on it; work described from memory gets done on the uploaded real thing instead, with the attachment point marked <attach here>; context the user keeps re-explaining becomes project instructions Claude drafts.
Hard rules:
- The text always addresses Claude and is ready to send verbatim. It never commands the user's action and never contains instructions aimed at the user; when only the user can act, the text directs Claude to prepare Claude's side of it.
- A step never states a fact only the user can know as though observed. Open it with "Assume" or leave <a slot in angle brackets>.
- Never re-request anything the reply already delivered. No UI click-paths, no menu names, no settings.
- Question-form only when the question is aimed at Claude and is the sharpest form of the ask. NEVER a question aimed at the user or one that needs the user's knowledge to answer.
Worked examples, from real exchanges:
- The user described a spreadsheet (date, category, amount, ~300 rows) and asked what to look for; the reply gave a checklist and ended "Upload it and I'll run through this on the actual numbers." The obvious step — never return it — is uploading with no further instruction. Return instead: label "Upload and decide", text "Here's the spreadsheet. <attach here>\\nRun the full checklist on the real numbers. Then end with the three findings worth the most money this month, ranked by amount, and the one recurring charge to cancel first. Findings only — skip whatever checks out clean."
- The user asked for a creative brainstorm; the reply asked them to pick a lane and promised "a proper spread of ideas plus something visual to react to." The obvious step is naming a lane. Return instead: label "Set the lane", text "Assume the lane is marketing for a small local business.\\nGive me fifteen ideas in three bands — five safe, five bold, five you'd never dare pitch — one line each, no explanations.\\nPut them in an artifact and keep it updated: I'll cut, you refill the bands until three are worth developing."
- The reply laid out a design and named its own weak point: "The hard engineering problem is candidate generation." Return the step that goes straight at the named hard part: label "Attack candidate generation", text "Go at the hard part you named: candidate generation.\\nDraft eight candidate framings for the deploy-dread scenario — specific enough to reject usefully, wrong in interesting directions, zero paraphrase.\\nMark which axis each one bets on, so a rejection still teaches us the shape."
The step has THREE parts:
- "label": AT MOST 4 WORDS, verb-first, plain language, no punctuation.
- "text": the full prompt loaded into the composer, ready to send verbatim, up to 700 characters. Short lines, with \\n between lines inside the JSON string when structure helps. Step texts are prose. Refer to code by its name and location, and when a step's outcome is new or changed code, the text directs Claude to write it rather than containing it. Write it so it works even unclicked, as a plan the user can read.
- "evidence": the verbatim reply fragment that earned this step, at most 90 characters.
Reply with ONLY minified JSON: {"steps":[{"label":"...","text":"...","evidence":"..."}]} — exactly one step, or {"steps":[]} when nothing is earned.`;

/* A client that sends no version predates the field, so it is old. Anything
   that sends one is at least 0.9.30 — the release that added it. Deliberately
   not a semver comparison: the only question is "does this client understand
   questions", and sending the field IS the answer. */
function wantsQuestions(body) {
  return typeof body.v === 'string' && body.v.trim() !== '';
}

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
ROUGH ASK: marketing (nothing relevant in the reply)
PROMPT: I want help with marketing. Ask me everything you need to know to get this right — one focused list, then wait for my answers before continuing.
Reply with ONLY minified JSON: {"prompt":"..."}`;


/* ---------------------------------------------------------------- helpers */

const CORS_BASE = {
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type, x-cx-device',
  'access-control-max-age': '86400'
};

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = allowedOrigins(env);
  // Only echo an origin we actually allow; never reflect arbitrary origins.
  const allow = allowed.length === 0
    ? (origin.startsWith('chrome-extension://') ? origin : '')
    : (allowed.includes(origin) ? origin : '');
  return allow ? { ...CORS_BASE, 'access-control-allow-origin': allow, vary: 'Origin' } : { ...CORS_BASE };
}

function allowedOrigins(env) {
  const ids = String(env.ALLOWED_EXTENSION_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return ids.map(id => `chrome-extension://${id}`);
}

function originAllowed(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = allowedOrigins(env);
  if (allowed.length) return allowed.includes(origin);
  // Not yet pinned to your published extension ID: accept any extension origin.
  // Pin ALLOWED_EXTENSION_IDS before launch so only your extension can spend.
  return origin.startsWith('chrome-extension://');
}

/* no-store is not cosmetic. /v1/health is a GET with a 200 body, so an edge or
   any intermediary is free to cache it — which it did, and a stale health body
   reported an old build as live. An endpoint whose only job is saying what is
   deployed must never be served from a cache. */
function json(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...corsHeaders(request, env)
    }
  });
}

function utcDay() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, resets midnight UTC
}

// Valid ISO 8601: hours only go 0-23, so "T24:00:00Z" would fail Date.parse().
function nextUtcMidnight() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* KV counter. Eventually consistent, which is fine for a soft quota — a user
   racing parallel requests might get a couple extra. Swap in a Durable Object
   if you ever need exact counting. */
async function bumpQuota(env, key, limit) {
  const used = parseInt((await env.CX_KV.get(key)) || '0', 10) || 0;
  if (used >= limit) return { ok: false, used, limit };
  await env.CX_KV.put(key, String(used + 1), { expirationTtl: KV_TTL_SECONDS });
  return { ok: true, used: used + 1, limit };
}

/* Enough to identify why a response could not be parsed, with no conversation
   content in it. `blocks` is the decisive field: if the budget was spent on
   content types other than `text`, the text body is short while `out` is at the
   ceiling, and no amount of extra max_tokens fixes that. */
function diagnose(data, text, ceiling = MAX_TOKENS) {
  return {
    stop: data.stop_reason || null,
    out: data.usage ? data.usage.output_tokens : null,
    in: data.usage ? data.usage.input_tokens : null,
    ceiling,
    len: text.length,
    hadJson: text.indexOf('{') >= 0,
    steps: (text.match(/"label"\s*:/g) || []).length,   // how far it actually got
    blocks: [...new Set((data.content || []).map(b => b.type || 'unknown'))]
  };
}

/* Same tolerant JSON parsing the extension uses: models sometimes fence their
   output, prepend a sentence, or get cut off mid-object. */
function extractJson(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = t.indexOf('{');
  if (start < 0) throw new Error('no JSON');
  const end = t.lastIndexOf('}');
  if (end > start) { try { return JSON.parse(t.slice(start, end + 1)); } catch {} }
  const stack = [];
  let inStr = false, esc = false, safeIdx = -1, safeStack = null;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      stack.pop();
      if (stack.length) { safeIdx = i; safeStack = stack.slice(); }
    }
  }
  if (safeIdx > 0 && safeStack) {
    try { return JSON.parse(t.slice(start, safeIdx + 1) + safeStack.reverse().join('')); } catch {}
  }
  throw new Error('unparseable JSON');
}


/* Payloads are now multi-line with bullets, and models overshoot the stated cap.
   A blind slice() cuts mid-word and ships visibly broken text ("...without users
   notici"), so trim at the last clean boundary instead: prefer a whole line, then
   a sentence, then a word. The ceiling is generous so realistic bulleted payloads
   pass through untouched. */
/* Same clean-boundary trim for the fifth chip's drafted prompt, at its own cap.
   A draft that blows the cap is a prompt-discipline failure upstream; trimming
   at a line or sentence keeps what ships readable either way. */
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

const MAX_PAYLOAD_CHARS = 700;
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

function trimPayload(value) {
  const t = String(value || '').trimEnd();
  if (t.length <= MAX_PAYLOAD_CHARS) return t;
  const cut = t.slice(0, MAX_PAYLOAD_CHARS);
  const nl = cut.lastIndexOf('\n');
  if (nl > MAX_PAYLOAD_CHARS * 0.5) return cut.slice(0, nl).trimEnd();
  const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  if (dot > MAX_PAYLOAD_CHARS * 0.5) return cut.slice(0, dot + 1).trimEnd();
  const sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.slice(0, sp) : cut).trimEnd();
}

/* ------------------------------------------------------------------ worker */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (url.pathname === '/v1/health') {
      // version + model make a deploy verifiable from outside. Without them you
      // cannot tell a successful deploy from a no-op except by watching a reply.
      return json({
        ok: true,
        version: BUILD,
        model: env.MODEL || MODEL,
        limit: DEVICE_DAILY_LIMIT,
        configured: !!env.ANTHROPIC_API_KEY
      }, 200, request, env);
    }
    /* Two POST endpoints, one gate order: origin -> token -> body -> quotas ->
       upstream. /v1/expand is the fifth chip; it shares EVERY gate and the SAME
       daily pool — a rough ask spends exactly what a suggestion row spends. */
    const wantExpand = url.pathname === '/v1/expand';
    if (url.pathname !== '/v1/next-steps' && !wantExpand) return json({ error: 'not_found' }, 404, request, env);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, request, env);
    if (!originAllowed(request, env)) return json({ error: 'forbidden_origin' }, 403, request, env);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'server_not_configured' }, 500, request, env);

    // device token: opaque, generated client-side, never tied to an identity
    const device = String(request.headers.get('x-cx-device') || '');
    if (!/^[A-Za-z0-9-]{16,64}$/.test(device)) {
      return json({ error: 'bad_device_token' }, 400, request, env);
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad_request' }, 400, request, env); }

    // clamp server-side: the client cannot make a request more expensive
    const asksQuestions = wantsQuestions(body);
    const prompt = String(body.prompt || '').slice(0, MAX_PROMPT_CHARS);
    const reply = String(body.reply || '').slice(0, MAX_REPLY_CHARS);
    let intent = '';
    if (wantExpand) {
      // A rough ask is required; the reply is NOT — "email to my landlord"
      // legitimately ignores the conversation entirely.
      intent = String(body.intent || '').trim().slice(0, MAX_INTENT_CHARS);
      if (!intent) return json({ error: 'bad_request' }, 400, request, env);
    } else if (reply.trim().length < MIN_REPLY_CHARS) {
      return json({ error: 'reply_too_short' }, 400, request, env);
    }

    const day = utcDay();

    // IP axis first (cheaper to reject, and catches token recycling)
    const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
    const ipKey = 'ip:' + (await sha256Hex(ip + '|' + (env.IP_SALT || 'contexa'))).slice(0, 32) + ':' + day;
    const ipQuota = await bumpQuota(env, ipKey, IP_DAILY_LIMIT);
    if (!ipQuota.ok) {
      return json({ error: 'quota_ip', limit: IP_DAILY_LIMIT, resetsAt: nextUtcMidnight() }, 429, request, env);
    }

    const devKey = 'q:' + device + ':' + day;
    const quota = await bumpQuota(env, devKey, DEVICE_DAILY_LIMIT);
    if (!quota.ok) {
      return json({
        error: 'quota', used: quota.used, limit: DEVICE_DAILY_LIMIT,
        resetsAt: nextUtcMidnight()
      }, 429, request, env);
    }

    // upstream call — your key, never exposed to the client
    /* thinking disabled: Sonnet 5 defaults to adaptive thinking and once spent
       the entire output budget thinking, emitting zero text. If MODEL is ever
       pointed at a thinking-mandatory model (Fable/Mythos reject the disable
       with a 400), retry once without the field — model-agnostic, no list. */
    const upstreamPayload = wantExpand
      ? {
          model: env.MODEL || MODEL,
          max_tokens: EXPAND_MAX_TOKENS,
          thinking: { type: 'disabled' },
          system: EXPAND_SYSTEM,
          messages: [{
            role: 'user',
            // Section labels MUST match extension/background.js byte-for-byte —
            // hosted and own-key users get the same product. Pinned by tests
            // on both sides.
            content: 'ROUGH ASK:\n' + intent
              + '\n\nTHEIR LAST MESSAGE:\n' + (prompt || '(not captured)')
              + '\n\nCLAUDE\'S REPLY:\n' + (reply || '(none)')
          }]
        }
      : {
          model: env.MODEL || MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: 'disabled' },
          system: asksQuestions ? QUESTIONS_SYSTEM : LEGACY_STEPS_SYSTEM,
          messages: [{
            role: 'user',
            content: 'USER MESSAGE:\n' + (prompt || '(not captured)') + '\n\nCLAUDE REPLY:\n' + reply
          }]
        };
    let upstream, upstreamErrBody = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        upstream = await fetch(ANTHROPIC_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(upstreamPayload)
        });
      } catch (e) {
        return json({ error: 'upstream_unreachable' }, 502, request, env);
      }
      if (upstream.ok) break;
      upstreamErrBody = await upstream.text().catch(() => '');
      // Tail-only: the body can contain account details, so it never reaches
      // the client — but silence here cost a debugging cycle once already.
      console.log('[CONTEXA] upstream error', upstream.status, upstreamErrBody.slice(0, 300));
      if (attempt === 0 && upstream.status === 400 && /thinking/i.test(upstreamErrBody) && upstreamPayload.thinking) {
        console.log('[CONTEXA] model rejected the thinking config — retrying without it');
        delete upstreamPayload.thinking;
        continue;
      }
      break;
    }

    if (!upstream.ok) {
      // Deliberately do not forward the upstream body: it can contain account
      // details, and a client has no use for them. It is in `wrangler tail`.
      //
      // But DO read it, because two of these failures are not transient and
      // every client renders `upstream_*` as "Couldn't reach the CONTEXA
      // service. Check your connection and try again in a moment." — a
      // sentence that blames the user's network for our outage and stays
      // wrong forever. A revoked key and an empty balance are both "nothing
      // you can fix", which is exactly what `server_not_configured` already
      // says, in every client shipped since 0.9.27. Choosing that code here
      // fixes the sentence for the whole installed base on one deploy, with
      // no store review and no client change to couple it to.
      const serviceIsDown = upstream.status === 401
        || (upstream.status === 400 && /credit balance|billing|insufficient|payment/i.test(upstreamErrBody));
      if (serviceIsDown) {
        console.log('[CONTEXA] service key rejected or unfunded — reporting server_not_configured');
        return json({ error: 'server_not_configured' }, 503, request, env);
      }
      const status = upstream.status === 429 ? 503 : 502;
      return json({ error: 'upstream_' + upstream.status }, status, request, env);
    }

    let data;
    try { data = await upstream.json(); } catch { return json({ error: 'upstream_bad_json' }, 502, request, env); }
    const text = (data.content || []).map(b => b.text || '').join('');

    let parsed;
    try { parsed = extractJson(text); } catch (e) {
      if (wantExpand) {
        const diag = diagnose(data, text, EXPAND_MAX_TOKENS);
        console.log('[CONTEXA] expand parse failure', JSON.stringify(diag),
          'text[0,300]=', JSON.stringify(text.slice(0, 300)));
        return json({
          error: data.stop_reason === 'max_tokens' ? 'truncated' : 'bad_json',
          diag
        }, 502, request, env);
      }
      /* A parse failure used to return a bare error code and drop the response on
         the floor, which made "truncated" undiagnosable: it cannot distinguish an
         empty text body from a model that narrated instead of emitting JSON from
         one that wrote an enormous first step. These four numbers separate all
         three, and none of them contain conversation content. */
      const diag = diagnose(data, text);
      // Full text goes to `wrangler tail` only (live stream, not stored) — the
      // client has no use for it and it echoes the user's conversation.
      console.log('[CONTEXA] parse failure', JSON.stringify(diag),
        'text[0,300]=', JSON.stringify(text.slice(0, 300)));
      return json({
        error: data.stop_reason === 'max_tokens' ? 'truncated' : 'bad_json',
        diag
      }, 502, request, env);
    }

    /* The fifth chip returns ONE drafted prompt, not steps. Evidence validation
       does not apply — the user typed the intent themselves, so relevance is
       theirs by construction; the prompt's own rules police invention. */
    if (wantExpand) {
      const drafted = trimExpansion(typeof parsed.prompt === 'string' ? parsed.prompt : '');
      if (!drafted) {
        const diag = diagnose(data, text, EXPAND_MAX_TOKENS);
        console.log('[CONTEXA] expand: parsed but no prompt', JSON.stringify(diag));
        return json({ error: 'no_prompt', diag }, 502, request, env);
      }
      return json({
        prompt: drafted,
        quota: { used: quota.used, limit: DEVICE_DAILY_LIMIT }
      }, 200, request, env);
    }

    /* SPEC §2.1/§2.6 — evidence validation. A step with no evidence ignored the
       grounding contract and is dropped; a near-miss quote (whitespace drift)
       renders but is counted and logged. Per-step evidence text goes to
       `wrangler tail` only; the client receives {label, text} plus aggregate
       grounding counts, so the page console can report the rate without any
       reply text leaving the worker's logs. */
    const normWs = s => String(s || '').replace(/\s+/g, ' ').trim();
    /* The two prompts emit two different keys — LEGACY_STEPS_SYSTEM says
       {"steps":[...]}, QUESTIONS_SYSTEM says {"questions":[...]} — so the parser
       has to accept whichever arrived. Reading only one silently produced an
       empty array, which the code below reads as 'the model earned nothing' and
       turns into a QUIET ROW: a total outage wearing the mask of correct
       behaviour, on the exact path that has no test coverage from real use. */
    const rawSteps = Array.isArray(parsed.questions) ? parsed.questions
      : Array.isArray(parsed.steps) ? parsed.steps : [];
    const withEv = rawSteps.filter(s =>
      s && typeof s.text === 'string' && s.text.trim() && normWs(s.evidence));
    const normReply = normWs(reply);
    let grounded = 0;
    for (const s of withEv) {
      if (normReply.includes(normWs(s.evidence))) grounded++;
      else console.log('[CONTEXA] ungrounded chip', JSON.stringify(String(s.label || '').slice(0, 40)));
    }
    console.log('[CONTEXA] evidence', JSON.stringify(withEv.map(s => String(s.evidence).slice(0, 90))));
    /* One chip for a legacy client, up to four questions for a new one — the
       two products have different caps and a legacy client would render four
       question-shaped chips as four pasteable prompts, which is nonsense. */
    /* 0.9.33 — the click-only invariant, enforced in code as well as in the
       prompt. A question the user cannot answer by CLICKING is not asked: the
       audience is people who know roughly what they want but not how to say it,
       and a bare text field asks them to do the exact thing they came here
       unable to do. Under two usable options, the question is dropped.

       Order matters. Map first, drop second, slice last — slicing to four
       before dropping would let one unaskable question cost a good one its
       place. And the drop is per-question, never the whole interview: the case
       that would justify aborting (material the user must supply) belongs in
       the composed prompt as a slot, not in the questionnaire. */
    const mapped = withEv.map(s => asksQuestions
      ? {
          label: String(s.label || '').slice(0, 80),
          text: trimPayload(s.text),
          options: cleanOptions(s.options)
        }
      : { label: String(s.label || '').slice(0, 80), text: trimPayload(s.text) });
    const dropped = asksQuestions ? mapped.filter(q => q.options.length < 2) : [];
    if (dropped.length) console.log('[CONTEXA] dropped unclickable question(s)',
      JSON.stringify(dropped.map(q => q.label)));
    const steps = (asksQuestions ? mapped.filter(q => q.options.length >= 2) : mapped)
      .slice(0, asksQuestions ? 4 : 1);
    // The key an old client reads is not the key a new one reads.
    const shape = extra => asksQuestions
      ? Object.assign({ questions: steps }, extra)
      : Object.assign({ steps }, extra);
    const grounding = { total: rawSteps.length, kept: steps.length, grounded };
    if (!steps.length) {
      /* 0.9.29 — there are now TWO silences and conflating them would hide the
         only defect signal this path has. rawSteps === 0 means the model chose
         to return nothing: the reply closed the loop and no step was earned.
         That is a product outcome, it renders as a quiet row, and it is the
         whole point of the one-chip core. Anything else means steps WERE
         produced and the evidence gate ate every one of them, which is a real
         failure and keeps its diagnostic. */
      if (!rawSteps.length) {
        console.log('[CONTEXA] quiet row — nothing to ask', asksQuestions ? '(questions)' : '(legacy steps)');
        return json(shape({ grounding, quiet: true }), 200, request, env);
      }
      const diag = diagnose(data, text);
      console.log('[CONTEXA] parsed but no usable steps', JSON.stringify(diag), 'rawSteps=' + rawSteps.length);
      return json({ error: 'no_steps', diag }, 502, request, env);
    }

    /* A partial salvage hit the same ceiling as a hard failure — the only
       difference is where the cut happened to fall. It needs the same evidence.
       (Instrumenting only the two failure branches was a gap: the very next
       ceiling-hit arrived on this branch, carrying no numbers.) Log the LAST 300
       characters, not the first: on this branch the JSON started fine, and the
       question is what the model was writing when the budget ran out — a sixth
       step, an oversized text, or trailing prose. */
    if (data.stop_reason === 'max_tokens') {
      const diag = diagnose(data, text);
      console.log('[CONTEXA] partial salvage', JSON.stringify(diag),
        'kept=' + steps.length, 'text[-300]=', JSON.stringify(text.slice(-300)));
      return json(shape({
        grounding,
        quota: { used: quota.used, limit: DEVICE_DAILY_LIMIT },
        partial: true,
        diag
      }), 200, request, env);
    }

    return json(shape({
      grounding,
      quota: { used: quota.used, limit: DEVICE_DAILY_LIMIT }
    }), 200, request, env);
  }
};
