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

/* v2 — the history-mining prompt. Reads the user's own messages across the
   whole session and offers up to four INDEPENDENT next moves, each already a
   finished prompt the user sends with one click. It replaced the ask-or-offer
   fork, and then outlived it: there is one shape now, so this is the only
   prompt in the product.

   It absorbed the composer prompt's job, and had to. Click is send-ready, so
   THIS is the only prompt with a channel to the composer — the <paste here>
   obligation, the Assume: lines, one-ask-one-verb, the 700-character cap and
   the filler-word ban all moved here intact. Dropping them would have
   recreated 0.9.49's inert instruction: a rule pointing at a mechanism that no
   longer exists.

   MUST stay byte-identical to the other copy. build.mjs enforces it, and with
   the other two prompts gone this is the only pair left to enforce — which
   makes the check cheaper to run and more expensive to lose. */
const MOVES_SYSTEM = `You are CONTEXA, embedded in claude.ai. You see the user's own messages from this whole session, oldest first, and Claude's latest reply. Your job is to read where this person has been going and offer up to four INDEPENDENT next moves — each one a complete message they could send right now, on its own, with one click. This is a menu, not an interview: you are not filling a gap in the reply and you are not asking them anything.
The session is the signal, and you read all of it. The EARLIEST message you are given is the closest thing to a stated goal, and the turns after it show how the work developed and what they keep returning to. That earliest message is not guaranteed to be the conversation's true first — on a long thread the page may only be holding part of it — so treat it as the oldest thing you can see rather than as the beginning. A move earns its place by ADVANCING what that earliest message was trying to get done — not by elaborating whatever the newest reply happened to be about. The numbers are positions in what you were given; a gap means turns were dropped to fit the window — never mention the gap and never ask for what is missing.
Claude's latest reply is MATERIAL, not the subject. Mine it for what now EXISTS that did not before — the thing it built, the file it wrote, the plan it laid out — because that is what makes a new move possible. Never send the user back over the reply for a second pass: "explain that again", "expand on your answer", or a phrase like "as you mentioned", in any language, is proof you have done it. The reply is a starting line, never a subject. And weigh it against the whole session, not against the turn nearest it: a row where every move comes from the newest exchange has read the last message, not the session, and is the failure this shape exists to avoid. And when the reply itself lists options, steps or questions, THAT LIST IS NOT YOUR ROW. Handing it back is the most seductive failure available to you: the evidence quote is perfect every time, so the moves look flawlessly grounded while being a transcript of the last message wearing the shape of a menu. The reply already told them what they could do next, and they have already read it. Watch the verb EXPLAIN especially, because it is how the second pass gets past the rule above: a move asks Claude to PRODUCE something, and "explain what you just said, at greater length" is the same backwards move wearing a verb the ban does not name. "Explain" earns a row only when it opens ground the reply did not cover.
INDEPENDENT IS THE WHOLE POINT. Each move stands alone as its own prompt and does one job. They do not combine, they do not run in order, and clicking one discards the rest. The test is mechanical: could this be sent on its own, today, as a complete request? If it only makes sense after another move, it is not a move. If two are the same job wearing different words, keep the better one and drop the other. SPREAD THE ROW ACROSS THE SESSION: four moves can read as four distinct jobs and still every one of them come from the last reply, so distinct labels prove nothing. Once the session has more than a couple of turns, at least one move must be earned by something the USER wrote.
Return BETWEEN ZERO AND FOUR, and let the session decide the number. Zero is a real answer and an honest one — a session with nothing open earns silence, not a padded menu. Never invent a move to fill the row, never split one move into two to look generous, and never offer a move whose only virtue is that it was offerable.
EVERY move must be earned by a verbatim fragment of what you were given — a phrase from one of the user's own messages, or from the reply. Put it in the "evidence" field: at most 90 characters, copied exactly, never paraphrased. No quotable evidence, no move. A move nothing earned is a form field, and every floor this product ever grew started as one.
EACH MOVE IS A FINISHED PROMPT. The "text" is the message itself, written as the user, in first person, addressed to Claude, ready to send verbatim. No persona preamble, no meta commentary, no politeness padding. It is sent exactly as you write it — there is no later step that improves it, and no box they type in first.
Rules for the text, in order of force:
- ONE ask, ONE imperative verb. The prompt asks Claude to produce a single thing. Bullets may spell out parts of that thing or constraints on it — never a second thing to produce. Read each bullet and ask whether it could be sent on its own as a complete request; if it could, it is a separate job, and it belongs in a different move or in none.
- Start with an imperative line stating the outcome. A move that is genuinely a question stays a question — aimed at Claude, never at the user.
- Name the actual thing, in the session's own words for anything factual: the file, the feature, the number, the name. Never invent numbers, names, keywords or file paths that appear nowhere in what you were given.
- Make scope explicit where the session makes it inferable — what to change, and what to leave alone. Phrase anti-goals positively ("leave the visible copy unchanged"), never as warnings.
- When a material fact only the user knows is missing, put a slot in angle brackets, like <main keyword> — at most 2 slots. Material they must supply rather than state — a file, a document, code, a spreadsheet, a link, a story only they can tell — takes the same form, as <paste here> or <attach here>, which they fill in the message box before sending. CONTEXA never asked them for it, so this is the only place it can appear.
- When a reasonable default is worth surfacing, add a final line starting "Assume:" — at most 2, each one something this session already settled. Never bake a silent choice into the prompt, and never assume a preference or a direction they would want to decide for themselves.
- Never use filler quality words: thorough, careful, carefully, properly, really, robust, comprehensive, high-quality, detailed, best. They change nothing. Constraints change things.
- At most 700 characters. Short sentences. When constraints deserve their own lines, start each with "- " on a line of its own — real line breaks, nothing to escape.
THE LABEL IS WHAT THEY READ, and usually all they read. Up to six words. Name what the move DOES and the concrete thing it does it TO — the file, the page, the feature, the decision — so the choice is obvious without hovering over it. "Add a contact form to the site" and "Make the landing page mobile-first" are labels. "Option A" names nothing, "Improve it" names nothing, "Proceed" is a command into the void, "Just start building something" is a shrug rather than a move, and "Add a form" names an action with its object missing. The repair is always the same: put the session's own subject in the label — the app, the file, the page, the decision it is actually about. All labels obviously different at a glance.
Banned in every move, each because it has already shipped here as a defect:
- A confirmation. "Use that label? Yes / No." is generable off any reply forever, which makes it a floor arriving through a side door.
- A move whose text says nothing the session had not already said. This includes re-offering an option, step or question the reply itself just enumerated: the reply's list is material, never the menu.
- Our words instead of theirs: schema, output format, parameters, prompt, workflow.
- Service voice. "Would you like me to..." is a waiter. The text is THEIR message, never an offer of ours.
- A move that is really THEIR answer. When the reply ends by asking them something — which of two ways, which failure it was, what is on their list — "answer that" is not a move: the content is in their head, so you would invent it or hand back a message that is nothing but slots. The reply's closing question belongs to them, not to this row. Needing ONE thing from them is fine and has the slot for it; being made entirely of what they must supply is the form field this row exists not to be.
Worked examples:
- The session: turn one "make me a website for my bakery", then turns about the menu page and the opening hours. The reply just built the landing page and ended "that's the base — the structure is there to build on". What exists now is a page, so the moves are what a page grows next: label "Add a contact form", text "Add a contact form to the bakery site.\\n- name, email, message, and which cake they are asking about\\n- inline validation, error text under each field\\n- one success state, no redirect\\nLeave the rest of the page as it stands.", evidence "the structure is there to build on" — label "Make it mobile-first", text "Rework the bakery page to be mobile-first. Start from a 375px viewport and scale up, rather than shrinking the desktop layout down. Show me the changed CSS only.", evidence "make me a website for my bakery" — label "Write the menu page", text "Write the menu page for the bakery site, matching the landing page's styling. Group by category, with one short line of copy under each item. <paste here> is the list of what we actually sell.", evidence "the menu page". Three moves, three different jobs, none of them needing the others.
- The same session done WRONG, and both halves are common. "Add a contact form, write the menu page, and make it mobile-first" as one move: three jobs in one prompt, which comes back as three half-answers. And "Tell me more about the structure you built" as another: the reply's own content handed back for a second pass, which is the worst thing on this list.
- Transcription, which is the failure that ships most often because it does not feel like one. A session about a broken logo, and the reply ends "1. check the asset in the repo, 2. inspect the element in DevTools, 3. if DevTools is not available, just describe what you see". The row comes back "Check the asset in the repo", "Inspect the element in DevTools", "Describe what you see". Three moves, three flawless evidence quotes, nothing mined: the reply offered all three and the user read them before you did. The session wanted the work the broken logo is BLOCKING.
- The answer-shaped row, and its repair. The reply closes "so which is it — a clipboard manager, or a scratchpad for assembling prompts?", and the row comes back "Answer the clipboard question" and "Confirm which one you meant". Neither is writable: the answer is theirs, so the text is either invented or all slots. Write the WORK THAT FOLLOWS the decision instead. Take the reading the session already leans toward — they have said "assembling multi-part prompts" twice — and make it a real move: label "Design the prompt staging app", text "Design a scratchpad app for assembling multi-part prompts before sending them to Claude.\n- what a saved fragment holds\n- how fragments are ordered into one message\n- what happens to them after sending\nAssume: a clipboard manager is the wrong shape for this, since the problem is assembly rather than history.", evidence "assembling multi-part prompts". The fork became a move, and the branch you did not take became a line they can change.
- Nothing earned. The session was one question about a tax deadline, and the reply answered it with the date and the form number. Nothing is open, nothing was building, and no next move exists that is not invented: {"moves":[]}. This is the correct output far more often than it feels.
Each move has THREE parts:
- "label": what they read. Up to six words, no punctuation, naming both the action and the thing it acts on, all labels obviously different.
- "text": the finished message, at most 700 characters, first person, addressed to Claude, sendable verbatim.
- "evidence": the verbatim fragment, from a user message or the reply, that earned it — at most 90 characters.
Reply with ONLY minified JSON: {"moves":[{"label":"...","text":"...","evidence":"..."}]} — zero to four items. A session that earned nothing returns {"moves":[]}.`;

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

/* The move text's clean-boundary cap. MUST stay behaviourally identical to
   trimPayload in worker/src/index.js: hosted and own-key users get one product
   or they get two.

   It was MISSING on the own-key path once, when this capped a question instead
   of a move — the worker trimmed at 700 and the extension did not, so an
   overlong payload rendered verbatim into a card with no overflow handling. A
   defect only a user with their own key could ever see, which is exactly the
   class of divergence the duplication rule exists to prevent. The shape it
   capped is gone; the divergence it caught is not, and now it guards the text
   that lands in the message box. */
const MAX_PAYLOAD_CHARS = 700;

/* History mining's clamps. Same values as worker/src/index.js, and the same
   kind of guard on both sides: what survives here is what gets billed. The
   client's own CAPTURE budget in content.js is a separate, larger product
   question being settled by field testing — these are the ceiling under it,
   not the budget itself. */
const MAX_TURNS = 40;
const MAX_TURN_CHARS = 2000;
const MAX_TURNS_TOTAL_CHARS = 12000;

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

/* v2 — the session's own turns, cleaned. Whole turns only: a chopped-off
   sentence is worse material than no sentence. Turn one is PINNED, because it
   states the goal and losing it decapitates the session; oldest MIDDLE turns
   drop first; the floor is two, the first and the newest.

   That policy is head-first, which is what this codebase already does —
   clampCapture keeps t.slice(0, budget) and marks the cut. (The pivot doc
   called the convention tail-first. The policy it derived is right; only the
   name was wrong.)

   The client trims to its own budget too. This copy is the one that decides
   what gets billed, so it does not trust that one.

   MUST stay behaviourally identical to the other copy: hosted and own-key
   users get one product or they get two. These three are what is left of that
   rule — the gates they replaced (cleanAssume, cleanChips, cleanOptions) went
   with the shapes they policed. */
function cleanTurns(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const t of v) {
    if (!t || typeof t !== 'object') continue;
    const i = Number(t.i);
    const text = String(t.text == null ? '' : t.text).trim().slice(0, MAX_TURN_CHARS);
    if (!text || !Number.isFinite(i) || i < 1) continue;
    out.push({ i: Math.floor(i), text });
  }
  out.sort((a, b) => a.i - b.i);
  const total = () => out.reduce((n, t) => n + t.text.length, 0);
  while (out.length > 2 && (out.length > MAX_TURNS || total() > MAX_TURNS_TOTAL_CHARS)) {
    out.splice(1, 1);
  }
  return out;
}

/* The turns as the model reads them. The numbers are positions in what was
   CAPTURED, not in the conversation — the DOM cannot tell us the latter, and
   pretending otherwise is what caused the 0.9.58 field regression: a truncated
   read numbered 1..N handed the model a recent turn labelled [1], which the
   prompt then read as the message stating the goal.

   A gap is still the elision marker for turns fitTurns dropped, and the prompt
   still reads it that way. What it cannot signal is a truncation that happened
   before capture — a virtualised page yields a contiguous 1..N with no gap at
   all. That is why the prompt no longer treats [1] as the session's start, and
   why askNow logs the range for the one case only a human can spot. */
function turnsSection(turns) {
  return turns.map(t => '[' + t.i + '] ' + t.text).join('\n\n');
}

/* v2 moves. Three required parts and every one is load-bearing: no label is a
   button with nothing written on it, no text is a click that composes nothing,
   and no evidence is a move the session never earned. The same gate the chip
   validator applied, for the same reason — decoration is what every floor in
   this product started as.

   The text is a FINISHED prompt rather than a rough intent, so it takes
   trimPayload's clean boundary rather than a blunt slice: half a sentence
   landing in the message box is worse than a shorter prompt. */
function cleanMoves(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const m of v) {
    if (!m || typeof m !== 'object') continue;
    const label = String(m.label == null ? '' : m.label).replace(/\s+/g, ' ').trim().slice(0, 60);
    const text = trimPayload(m.text);
    const evidence = String(m.evidence == null ? '' : m.evidence).replace(/\s+/g, ' ').trim().slice(0, 90);
    if (!label || !text || !evidence) continue;
    // Two labels reading the same are two buttons doing the same job.
    if (out.some(x => x.label.toLowerCase() === label.toLowerCase())) continue;
    out.push({ label, text, evidence });
    if (out.length === 4) break;
  }
  return out;
}

/* Grounding over the WHOLE corpus, not the reply alone — the change the pivot
   forces. Ideas are mined from the session now, so a move earned by turn one
   stating the goal is grounded. Checking against the reply only would have
   failed nearly every history-earned move and reported a working product as a
   broken one.

   Two tiers, carried over from the evidence gate this replaced: no evidence at
   all is already dropped by cleanMoves; a near-miss quote (usually whitespace
   drift) renders, but is counted and logged so the rate stays readable from the
   console.

   The corpus now arrives in TWO pieces rather than one concatenated string,
   because WHICH piece earned a move is the whole diagnosis. One flat haystack
   can say a move is grounded; it can never say what grounded it, which is why
   a row transcribed straight out of the reply looked perfect to this gate. */
function groundMoves(moves, turnsText, replyText) {
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const turnsHay = norm(turnsText);
  const replyHay = norm(replyText);
  let grounded = 0, fromTurns = 0, fromReply = 0;
  for (const m of moves) {
    const ev = norm(m.evidence);
    /* Turn-earned wins the tie. A phrase the user wrote and Claude quoted back
       is still the user's, and crediting the reply for it would count the
       session's own material as an echo — firing the gate below on a row that
       had in fact read the history. */
    if (turnsHay && turnsHay.includes(ev)) { grounded++; fromTurns++; }
    else if (replyHay.includes(ev)) { grounded++; fromReply++; }
    else console.log('[CONTEXA] ungrounded move', m.label.slice(0, 40));
  }
  return { grounded, fromTurns, fromReply };
}

/* The spread gate — deliberately the narrowest rule that still kills the
   observed defect: a reply ending in a numbered list, handed straight back as
   the row. Every move earned by the reply, on a session long enough to have
   offered something else, is not a menu. It is a transcript.

   THREE turns is the floor because below it the reply genuinely IS most of the
   material: on a one- or two-turn session a reply-earned row is the correct
   answer, and dropping it would manufacture zeros out of good rows. The prompt
   states this rule in words too — it is enforced here as well because the
   backwards-move ban was prompt-only, and the field test found it not landing.
   A gate living only in the prompt is a gate the model may decline. */
const SPREAD_MIN_TURNS = 3;
function enforceSpread(moves, ground, turnCount) {
  /* EVERY move matched the reply — not merely "none matched a turn". The
     difference is the two-tier rule: an ungrounded near-miss is counted and
     still renders, and it is not a transcript of anything. Testing fromTurns
     alone swept those into the drop and quietly turned tier two into tier
     one, which the worker suite caught on the first run. */
  if (!moves.length || turnCount < SPREAD_MIN_TURNS || ground.fromReply !== moves.length) return moves;
  console.log('[CONTEXA] spread gate — all ' + moves.length +
    ' move(s) earned by the reply across ' + turnCount + ' turns; row dropped');
  return [];
}
/* end of the injected helper block — build.mjs reads to here for byte-identity */

/* Hosted path: the proxy holds the API key, so the user needs nothing. Returns
   the same shape as the direct path so callers do not care which was used. */
async function callHosted(reply, turns) {
  const { proxyUrl } = await chrome.storage.local.get({ proxyUrl: DEFAULT_PROXY_URL });
  const base = String(proxyUrl || DEFAULT_PROXY_URL).replace(/\/+$/, '');
  if (/YOUR-SUBDOMAIN/.test(base)) return { error: 'proxy_not_configured' };
  const device = await getDeviceToken();
  let res;
  try {
    res = await fetch(base + '/v1/next-steps', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cx-device': device },
      /* Two fields, no handshake. The `v` and `accepts` negotiation served
         three client generations at once and was the right answer while the
         store decided when each one shipped; with one shape left there is
         nothing to negotiate, and a handshake that always takes the same
         branch is a comment pretending to be code.

         `prompt` went with it. The mining prompt never read it — the last user
         message is simply the last entry in `turns`, and sending it twice made
         the larger of the two payloads bigger for nothing. */
      body: JSON.stringify({ reply, turns })
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
  /* One shape, so one check — and it stays a real one. A body with no `moves`
     key is a worker answering something this client cannot read, and saying so
     is better than rendering it as silence. Reading an unknown shape as
     "nothing earned" produces a working product that is permanently quiet with
     nothing in the console, which is exactly how 0.9.30 broke. */
  if (!data || !Array.isArray(data.moves)) return { error: 'bad_response' };
  return { data };
}

/* tiny in-memory cache (service worker lifetime) */
const stepsCache = new Map();
function cachePut(map, k, v) { map.set(k, v); if (map.size > 60) map.delete(map.keys().next().value); }

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'nextSteps') {
      const { apiKey } = await getSettings();
      const reply = (msg.reply || '').slice(0, 6000);
      /* Cleaned here as well as in the worker. The own-key path never touches
         the worker, so a gate that lives only there is a gate half the users do
         not have — the rule the deleted validators were written under, and the
         one reason these three survived them. */
      const turns = cleanTurns(msg.turns);
      if (!turns.length) return sendResponse({ error: 'no_turns' });
      /* The cache key carries the whole session, not just the last exchange.
         Keyed on the last exchange alone, two different conversations that
         happen to share a final turn would serve each other's moves — and
         mining makes that likelier rather than less likely, because the moves
         now depend on everything BUT the last turn. */
      const key = turns.map(t => t.i + ':' + t.text.slice(0, 60)).join('|')
        + '||' + reply.slice(0, 200);
      if (stepsCache.has(key)) return sendResponse(stepsCache.get(key));
      // Own key = direct to Anthropic, unlimited. No key = hosted proxy, quota'd.
      // Section labels MUST match worker/src/index.js byte-for-byte.
      const r = apiKey
        ? await callClaude(MOVES_SYSTEM,
            'SESSION SO FAR:\n' + turnsSection(turns)
              + '\n\nCLAUDE\'S LATEST REPLY:\n' + reply, 2500)
        : await callHosted(reply, turns);
      let out;
      if (r.error) {
        out = r;
      } else if (apiKey) {
        /* Own-key mining runs the worker's pipeline in the worker's order —
           clean, then ground over turns AND reply, then let zero be zero — so
           the two paths stay one product. */
        const kept = cleanMoves(r.data && r.data.moves);
        const rawMoves = Array.isArray(r.data && r.data.moves) ? r.data.moves.length : 0;
        const ground = groundMoves(kept, turns.map(t => t.text).join('\n'), reply);
        const moves = enforceSpread(kept, ground, turns.length);
        /* The split is the number the screenshots could only hint at: a row of
           four that all say "from reply" is a transcript of the last message,
           whatever the labels look like. Logged on every click so the rate is
           readable without a field test — the capture bug survived a whole one
           precisely because nothing counted anything. */
        console.log('[CONTEXA] grounding — returned ' + rawMoves + ', kept ' + moves.length +
          ', grounded ' + ground.grounded +
          ' (turns ' + ground.fromTurns + ', reply ' + ground.fromReply + ')');
        if (!moves.length) {
          console.log(rawMoves === 0
            ? '[CONTEXA] quiet row — the session earned no moves'
            : '[CONTEXA] every move dropped by the gate — returned ' + rawMoves + ', kept 0');
        }
        out = { moves, grounding: { total: rawMoves, kept: moves.length, grounded: ground.grounded,
          fromTurns: ground.fromTurns, fromReply: ground.fromReply } };
        if (r.partial) out.partial = true;
      } else {
        out = r.partial ? Object.assign({}, r.data, { partial: true }) : r.data;
      }
      // The gate can empty a call that itself succeeded, so errors are not cached.
      if (!out.error) cachePut(stepsCache, key, out);
      sendResponse(out);

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
