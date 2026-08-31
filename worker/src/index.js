/* CONTEXA API — Cloudflare Worker.
   A thin proxy so users never need their own Anthropic key. It holds YOUR key
   as a secret, enforces per-device and per-IP daily quotas, and clamps input
   size so a malicious client cannot run up your bill.

   Endpoints:
     POST /v1/next-steps  -> { moves: [{label, text, evidence}], grounding, quota }
     GET  /v1/health      -> { ok, version, model, limit, configured }

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
const BUILD = '0.9.67';   // matches the extension generation this serves; every bump here has paid for itself by telling one deploy from another — 0.9.52 could not tell a pre-fork deploy from a post-fork one, 0.9.54 a pre-voice from a post-voice, 0.9.56 a pre-precedence-fix from a post-precedence-fix, and 0.9.58 is the first that must distinguish a worker that speaks moves from one that still speaks questions

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
/* Sonnet 5 rather than Haiku, on measured evidence: in a controlled three-model
   comparison Haiku ignored the label-length rule (4/11 over cap), largely ignored
   the bullet instruction (1/11), and twice wrote suggestions that asked the USER
   a question it could not answer — all defects that three rounds of prompt work
   failed to fix. Sonnet 5 scored 0/13 over cap, 10/13 bulleted, no voice
   inversion. Opus 5 produced the best single suggestion but failed a request
   outright at 5x the cost.

   The per-call figure that used to close this comment was measured against
   Haiku and against the pre-pivot payload; the payload is a whole session now,
   so it was wrong twice over. Cost is derived in worker/README.md ("What it
   costs you") and lives only there — the model choice is what this comment is
   for. */
const MODEL = 'claude-sonnet-5';

// Quotas. Client values are never trusted; these are the only limits that count.
/* REPLIES_PER_DAY is the number a USER experiences, and the only one that may
   ever appear in public copy. One call = one reply asked about, so the call
   ceiling and the public number are now the SAME number.

   They used to differ. A finished prompt cost two upstream calls — the
   questions call, then the compose call — so the ceiling was twice the public
   figure. History mining removed the second call: the moves arrive already
   composed and clicking one spends nothing. The multiplier had to go with it,
   or the code would have enforced twice what the listing promised.

   The UNIT moved too, and that is why this constant is renamed rather than
   just re-derived. "Prompts per day" no longer counts anything: one call
   returns up to four send-ready prompts and the user may take one, several or
   none. What the quota actually meters is how many REPLIES they can ask about,
   which is also what the store listing already said.

   Derived rather than written as a literal because the alternative already
   failed twice. The listing once advertised "10 prompts a day" against 20
   enforced calls — simultaneously double and half the truth — and the IP
   ceiling below once halved its own ratio when this number moved, with nobody
   deciding it. A number in public copy has one source of truth and this is it. */
const REPLIES_PER_DAY = 20;
const DEVICE_DAILY_LIMIT = REPLIES_PER_DAY;
/* Second axis: blunts reinstall-for-a-fresh-token abuse. Deliberately generous
   relative to the device ceiling, because legitimate users share IPs — an
   office, a flat, a university, and above all mobile carriers, where CGNAT puts
   a great many phones behind one address. Blocking those looks like a broken
   product, not like a defence.

   DERIVED, for the same reason REPLIES_PER_DAY is: the RELATIONSHIP was the
   requirement and 300 was only ever the artifact of it. Left as a literal, the
   ratio silently halved from ~15x to ~7.5x the moment the device ceiling
   doubled — a real narrowing of headroom for shared addresses that nobody
   decided and nothing would have reported.

   Which is why this next part is written down rather than inherited. Dropping
   the device ceiling from 40 to 20 carries this one from 400 to 200, and that
   is a real halving of absolute headroom for a CGNAT'd carrier or an office.
   Decided, not drifted into, and accepted on one ground: a call now returns up
   to four send-ready prompts where it used to return a fraction of one, so a
   shared address gets more product per unit of quota than it did at 400. If
   that stops being true — if the row starts averaging one usable move — this
   is the first number to revisit, and the ratio is the thing to change.

   And note what this counter is NOT. It shares the eventually-consistent KV
   read-modify-write with the device counter, so it races and reduces blast
   radius rather than capping it. The real ceiling on spend is the Anthropic
   Workspace limit, which is a hard number set outside this file. Tuning this
   constant for cost protection is theatre; tuning it for legitimate-user
   headroom is the actual job, and that argues for generosity. */
const IP_DAILY_LIMIT = DEVICE_DAILY_LIMIT * 10;
const KV_TTL_SECONDS = 60 * 60 * 48;

/* PROMPT CACHING. The system prompt is a large fixed prefix on every single
   call — MOVES_SYSTEM is ~2.4k tokens — and until 2026-08-27 every byte of it
   was re-sent and re-billed at full input price on every request. Marking it cacheable is the largest cost lever
   available and it changes nothing a user can see.

   Two things about this that fail SILENTLY and so are written down rather than
   assumed:

   1. Caching has a minimum cacheable length. A prompt shorter than that
      threshold is simply not cached — no error, no warning, no field in the
      response saying so. MOVES_SYSTEM is comfortably above it today, but it is
      now the ONLY prompt, so a trim that drops it below the threshold takes the
      whole cost lever with it and the only symptom is the bill. If you shorten
      it, check `usage` on a live call for cache_creation / cache_read tokens
      rather than trusting this comment.
   2. A cache HIT requires the prefix to be byte-identical to the previous
      call's. That is why the block is built from the constant alone, with
      nothing interpolated into it — a version stamp or a timestamp spliced in
      here would invalidate the cache on every request while still looking
      correct.

   Kept as a function rather than an inline literal so the shape exists in
   exactly one place: the retry below has to be able to recognise and undo it. */
function cachedSystem(text) {
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
}

// Cost guards: a request can never be larger than this, whatever the client sends.
const MAX_REPLY_CHARS = 6000;
const MIN_REPLY_CHARS = 50;
const MAX_TOKENS = 2500;   // Opus hit the 1600 ceiling and failed; Sonnet writes longer than Haiku too

/* History mining sends a session's worth of turns instead of one message, which
   is a much larger read — so it gets its own clamps, and they are NOT the
   client's capture budget. That number is a product question (how much history
   makes better moves) and is being settled by field testing. THIS number is the
   line in the file header: "clamps input size so a malicious client cannot run
   up your bill." A client can send anything; only what survives here is billed,
   so this ships with the endpoint rather than waiting on field results.

   Sized against the reply's own ceiling: the total is 2x MAX_REPLY_CHARS, and
   a single turn gets a third of what one reply gets, because a turn buried
   mid-session has not earned as much room as the thing being replied to. */
const MAX_TURNS = 40;
const MAX_TURN_CHARS = 2000;
const MAX_TURNS_TOTAL_CHARS = 12000;

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
Worked examples:
- The session: turn one "make me a website for my bakery", then turns about the menu page and the opening hours. The reply just built the landing page and ended "that's the base — the structure is there to build on". What exists now is a page, so the moves are what a page grows next: label "Add a contact form", text "Add a contact form to the bakery site.\\n- name, email, message, and which cake they are asking about\\n- inline validation, error text under each field\\n- one success state, no redirect\\nLeave the rest of the page as it stands.", evidence "the structure is there to build on" — label "Make it mobile-first", text "Rework the bakery page to be mobile-first. Start from a 375px viewport and scale up, rather than shrinking the desktop layout down. Show me the changed CSS only.", evidence "make me a website for my bakery" — label "Write the menu page", text "Write the menu page for the bakery site, matching the landing page's styling. Group by category, with one short line of copy under each item. <paste here> is the list of what we actually sell.", evidence "the menu page". Three moves, three different jobs, none of them needing the others.
- The same session done WRONG, and both halves are common. "Add a contact form, write the menu page, and make it mobile-first" as one move: three jobs in one prompt, which comes back as three half-answers. And "Tell me more about the structure you built" as another: the reply's own content handed back for a second pass, which is the worst thing on this list.
- Transcription, which is the failure that ships most often because it does not feel like one. A session about a broken logo, and the reply ends "1. check the asset in the repo, 2. inspect the element in DevTools, 3. if DevTools is not available, just describe what you see". The row comes back "Check the asset in the repo", "Inspect the element in DevTools", "Describe what you see". Three moves, three flawless evidence quotes, nothing mined: the reply offered all three and the user read them before you did. The session wanted the work the broken logo is BLOCKING.
- Nothing earned. The session was one question about a tax deadline, and the reply answered it with the date and the form number. Nothing is open, nothing was building, and no next move exists that is not invented: {"moves":[]}. This is the correct output far more often than it feels.
Each move has THREE parts:
- "label": what they read. Up to six words, no punctuation, naming both the action and the thing it acts on, all labels obviously different.
- "text": the finished message, at most 700 characters, first person, addressed to Claude, sendable verbatim.
- "evidence": the verbatim fragment, from a user message or the reply, that earned it — at most 90 characters.
Reply with ONLY minified JSON: {"moves":[{"label":"...","text":"...","evidence":"..."}]} — zero to four items. A session that earned nothing returns {"moves":[]}.`;

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
const MAX_PAYLOAD_CHARS = 700;
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

   The corpus arrives in TWO pieces rather than one concatenated string,
   because WHICH piece earned a move is the whole diagnosis. One flat haystack
   can say a move is grounded; it can never say what grounded it, which is why
   a row transcribed straight out of the reply looked perfect to this gate.

   `sources` keeps PER-MOVE what the counts throw away. The work was already
   being done — this only stops discarding it — and the explain gate below
   cannot exist without it. */
function groundMoves(moves, turnsText, replyText) {
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const turnsHay = norm(turnsText);
  const replyHay = norm(replyText);
  const sources = [];
  for (const m of moves) {
    const ev = norm(m.evidence);
    /* Turn-earned wins the tie. A phrase the user wrote and Claude quoted back
       is still the user's, and crediting the reply for it would count the
       session's own material as an echo — firing the gates below on a row that
       had in fact read the history. */
    if (turnsHay && turnsHay.includes(ev)) sources.push('turns');
    else if (replyHay.includes(ev)) sources.push('reply');
    else { console.log('[CONTEXA] ungrounded move', m.label.slice(0, 40)); sources.push(''); }
  }
  return Object.assign(tallySources(sources), { sources });
}

function tallySources(sources) {
  let grounded = 0, fromTurns = 0, fromReply = 0;
  for (const s of sources) {
    if (s) grounded++;
    if (s === 'turns') fromTurns++;
    else if (s === 'reply') fromReply++;
  }
  return { grounded, fromTurns, fromReply };
}

/* THE ACTION GATE. Every move must be a doable click: you press it, Claude
   makes the thing. A move that only talks ABOUT the material — "explain this",
   "show me that", "in more detail" — is not a next move, it is a comment, and
   the owner's rule is that it should not appear at all rather than appear and
   waste the click.

   This is an ALLOWLIST, and that choice has a cost worth naming here rather
   than discovering in the field. A denylist fails OPEN: an unknown verb still
   renders. An allowlist fails CLOSED: an unknown verb is dropped. This product
   answers in the session's own language, so a verb missing from this list does
   not merely degrade a row — it EMPTIES one, and an empty row looks exactly
   like the honest "nothing was open", which is the outcome this product must
   never counterfeit. Hence two rules for maintaining it:

     1. Be generous. A verb that produces anything at all belongs here. The
        eight verbs first sketched for this gate would have dropped three of the
        four moves in the row that prompted it.
     2. Serbian is first-class, not an afterthought — half the field rows are
        Serbian, and Napravi/Definiši/Razradi/Precizuj all had to survive.

   When it empties a row, it says so in its own words (see below), so that "my
   list is incomplete" can never hide inside "the session earned nothing".

   0.9.67 read the log instead of trusting rule 1. Ten sessions across different
   subjects produced 36 moves and 14 drops, and NINE of the fourteen were doable
   clicks this list simply did not know: Popiši, Osmisli (three times), Smisli,
   Skiciraj, Prilagodi, plus English Model and Estimate. Rule 1 was already
   written down and the list still missed a quarter of everything the model
   returned — being generous is not something you can be from memory, because
   the missing words are by definition the ones that did not occur to you. The
   four correct drops were three "Explain …" and one label with no verb at all.
   Reread it the same way when the field looks thin: tail the worker, sweep,
   classify. */
const ACTION_OPENERS = new RegExp('^\\s*(' + [
  // English — anything that leaves an artifact behind
  'write|rewrite|draft|redraft|compose|author',
  'build|rebuild|make|create|generate|produce|assemble',
  'design|redesign|sketch|draw|wireframe|mock|model|prototype|storyboard',
  'plan|outline|map|spec|scope|schedule|structure|organi[sz]e',
  'add|extend|expand|fill|complete|finish',
  'fix|repair|patch|correct|resolve|debug|unblock',
  'set|setup|configure|install|deploy|publish|ship|release|wire',
  'update|revise|refine|tighten|polish|improve|rework|refactor|simplify|clean',
  'convert|port|migrate|translate|adapt|turn|swap|replace|rename|move|copy',
  'split|merge|combine|group|sort|order|rank|filter|trim|cut|remove|delete|drop',
  'list|enumerate|catalogue|catalog|tabulate|collect|gather|compile|extract|pull',
  'test|run|check|verify|validate|measure|estimate|calculate|compute|forecast|benchmark|profile|audit|review|compare|evaluate|assess|diagnose|reproduce|trace|inspect|examine|investigate',
  'define|specify|name|choose|pick|select|decide|settle',
  'apply|enforce|implement|automate|script|instrument|do',
  // Serbian / BCMS — the field produces these constantly
  'napravi|napiši|napisi|izradi|kreiraj|generiši|generisi|sastavi|osmisli|smisli',
  'definiši|definisi|precizuj|preciziraj|odredi|utvrdi|izaberi|odaberi',
  'razradi|razvij|dopuni|dodaj|proširi|prosiri|dovrši|dovrsi|završi|zavrsi',
  'postavi|podesi|instaliraj|deployuj|objavi|pusti|poveži|povezi',
  'skiciraj|nacrtaj|iscrtaj|modeluj|modeliraj',
  'popravi|ispravi|sredi|reši|resi|otkloni|debaguj',
  'pretvori|prebaci|premesti|premjesti|zameni|zamijeni|preimenuj|kopiraj|migriraj|prevedi|prilagodi|uskladi',
  'ažuriraj|azuriraj|osveži|osvezi|doradi|prepravi|refaktoriši|refaktorisi|pojednostavi|očisti|ocisti',
  'proveri|provjeri|testiraj|izmeri|izmjeri|izračunaj|izracunaj|uporedi|usporedi|analiziraj|proceni|procijeni|reprodukuj|pregledaj|ispitaj',
  'nabroji|izlistaj|popiši|popisi|prikupi|izvuci|sakupi',
  'primeni|primijeni|implementiraj|automatizuj|skriptuj|uradi|odradi',
  'ukloni|obriši|obrisi|izbaci|skrati|podeli|podijeli|spoji|grupiši|grupisi|sortiraj'
].join('|') + ')\\b', 'i');

/* The one offender a verb list structurally cannot catch. "Dodaj pitanje o
   staging environment" OPENS with a production verb — dodaj/add has to stay on
   the list — and is still not a doable click: what it produces is another
   question, which is the interview this product deleted, arriving through the
   one door left open. The defect is the OBJECT, so it is matched as one. */
const META_OBJECTS = /\b(pitanj\w*|question|questions|odgovor\w*|answer|answers)\b/i;

function enforceAction(moves, ground) {
  const keep = [], sources = [];
  let dropped = 0;
  for (let i = 0; i < moves.length; i++) {
    const label = moves[i].label;
    const why = !ACTION_OPENERS.test(label) ? 'no production verb'
      : META_OBJECTS.test(label) ? 'produces a question, not work'
      : null;
    if (why) {
      dropped++;
      console.log('[CONTEXA] action gate — dropped "' + label.slice(0, 40) + '" (' + why + ')');
      continue;
    }
    keep.push(moves[i]);
    sources.push(ground.sources[i]);
  }
  /* An emptied row gets its OWN line. Silence here would be indistinguishable
     from a session that earned nothing, and the two need opposite responses:
     one is the product working, the other is this list missing a word. */
  if (moves.length && !keep.length) {
    console.log('[CONTEXA] action gate emptied the row — ' + dropped +
      ' move(s) dropped. If these labels were not English or Serbian, the verb list is the likely cause.');
  }
  /* Re-tallied, not carried over: these counts are what the console and the
     hosted client report, so stale ones would hide a drop in the one place
     built to show it. */
  return {
    moves: keep,
    ground: Object.assign(tallySources(sources), { sources }),
    droppedByAction: dropped
  };
}

/* THE SPREAD GATE IS GONE, and this note is what stands in its place.

   It dropped a row when EVERY move was earned by the reply on a session of
   three or more turns, on the theory that such a row is a transcript of the
   last message rather than a menu. It was measured on the shape of a real
   thread — six live runs — and the result retired it:

     · 1 run in 6 was emptied by it, and every row it took was GOOD.
     · Four of the survivors lived on exactly ONE turn-earned move. One
       different evidence quote and they die too. A coin flip over good rows.
     · Worst of all, in the run it killed the action gate had already taken 3
       of 4 moves, leaving ONE reply-earned move — and "every move is
       reply-earned" is trivially true of a row of one. The gate was built
       against a row of four transcribed moves and was deleting a row of one.

   What it was built for is now covered twice over: the action gate (0.9.63)
   drops anything that is not a doable click, and MOVES_SYSTEM says outright
   that the reply's own list is not the row. If transcription returns, the
   symptom to watch for is a row whose moves all quote the reply AND read as
   its numbered list — and the answer then is the prompt or a shape-aware
   check, not this blunt count. */
/* end of the injected helper block — build.mjs reads to here for byte-identity */

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
    /* One POST endpoint now, one gate order: origin -> token -> body -> quotas
       -> upstream. /v1/expand went with the fifth chip, and the three-generation
       schema negotiation went with the interview: there is one shape, so there
       is nothing left to negotiate. */
    if (url.pathname !== '/v1/next-steps') return json({ error: 'not_found' }, 404, request, env);
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
    const reply = String(body.reply || '').slice(0, MAX_REPLY_CHARS);
    const turns = cleanTurns(body.turns);
    /* Both are required, and both are rejected BEFORE the quota is charged, so
       a malformed request costs the user nothing and us nothing. A session with
       no turns is not a quiet row — a quiet row is the model finding nothing to
       say, which needs a session to have found it in. This is a client that
       sent nothing to read. */
    if (!turns.length) return json({ error: 'no_turns' }, 400, request, env);
    if (reply.trim().length < MIN_REPLY_CHARS) {
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
    const upstreamPayload = {
      model: env.MODEL || MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'disabled' },
      system: cachedSystem(MOVES_SYSTEM),
      messages: [{
        role: 'user',
        /* Section labels MUST match extension/background.js byte-for-byte —
           hosted and own-key users get the same product, and build.mjs pins
           these two lines on both sides. */
        content: 'SESSION SO FAR:\n' + turnsSection(turns)
          + '\n\nCLAUDE\'S LATEST REPLY:\n' + reply
      }]
    };
    let upstream, upstreamErrBody = '';
    /* Two independent degradations, each allowed once, tracked by FLAGS rather
       than by attempt index. The old `attempt === 0` guard meant a thinking
       rejection could only ever be recovered from if it was the FIRST failure;
       with two possible degradations that is no longer a safe assumption, and
       the flags make the order irrelevant. Three attempts because both can
       legitimately fire on one request. */
    let droppedThinking = false, droppedCache = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      upstream = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(upstreamPayload)
      });
      if (upstream.ok) break;
      upstreamErrBody = await upstream.text().catch(() => '');
      console.log('[CONTEXA] upstream error', upstream.status, upstreamErrBody.slice(0, 300));
      if (!droppedThinking && upstream.status === 400 && /thinking/i.test(upstreamErrBody)
          && upstreamPayload.thinking) {
        console.log('[CONTEXA] model rejected the thinking config — retrying without it');
        delete upstreamPayload.thinking;
        droppedThinking = true;
        continue;
      }
      /* Prompt caching is an optimisation, never a requirement. If the upstream
         rejects the cache_control block for any reason, flatten it back to a
         plain string and try once more — a request that costs more is strictly
         better than a request that fails. The regex is deliberately broad
         — the wording of somebody else's 400 is not ours to predict, and a
         narrow regex here would turn a recoverable request into a dead one. */
      if (!droppedCache && upstream.status === 400 && /cache/i.test(upstreamErrBody)
          && Array.isArray(upstreamPayload.system)) {
        console.log('[CONTEXA] upstream rejected prompt caching — retrying uncached');
        upstreamPayload.system = upstreamPayload.system.map(b => b.text).join('');
        droppedCache = true;
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
      // says, in every client shipped since 0.9.27.
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
    try {
      parsed = extractJson(text);
    } catch {
      /* A parse failure used to return a bare error code and drop the response
         on the floor, which made "truncated" undiagnosable: it cannot
         distinguish an empty text body from a model that narrated instead of
         emitting JSON from one that wrote an enormous first move. These four
         numbers separate all three, and none of them contain conversation
         content. */
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

    /* One shape. The moves arrive already composed, so there is nothing to
       clean beyond the gate and nothing to fold afterwards.

       Grounding runs over the turns AND the reply. Ideas are mined from the
       session now, so a move earned by turn one stating the goal is grounded;
       a reply-only corpus would have failed nearly every one of them and
       reported a working product as broken. */
    const cleaned = cleanMoves(parsed.moves);
    const rawMoves = Array.isArray(parsed.moves) ? parsed.moves.length : 0;
    const g0 = groundMoves(cleaned, turns.map(t => t.text).join('\n'), reply);
    const { moves, ground, droppedByAction } = enforceAction(cleaned, g0);
    /* One gate left, so 'action' is now the only way a row that HAD moves
       arrives empty. Still a named field rather than something the client
       infers from droppedByAction, because that count is non-zero on plenty of
       rows that render fine — the card needs "the gate took everything", not
       "the gate took something". */
    const emptiedBy = rawMoves > 0 && moves.length === 0 ? 'action' : null;
    /* The split ships in the response, not just the log. The own-key path can
       read its console; a hosted user cannot, and this is the number that says
       whether a row read the session or transcribed the last reply. */
    const grounding = { total: rawMoves, kept: moves.length, grounded: ground.grounded,
      fromTurns: ground.fromTurns, fromReply: ground.fromReply, droppedByAction, emptiedBy };
    console.log('[CONTEXA] grounding — returned ' + rawMoves + ', kept ' + moves.length +
      ', grounded ' + ground.grounded +
      ' (turns ' + ground.fromTurns + ', reply ' + ground.fromReply + ')');

    if (!moves.length) {
      /* Zero is a product outcome and stays one — but the two silences have
         different causes and only one is a defect, so they are never conflated.
         The model earning nothing is the design working. The gate rejecting
         everything it sent is a prompt that needs looking at, and it would be
         invisible if both logged the same line. */
      if (rawMoves === 0) {
        console.log('[CONTEXA] quiet row — the session earned no moves');
      } else {
        const diag = diagnose(data, text);
        console.log('[CONTEXA] every move dropped by the gate', JSON.stringify(diag),
          'returned=' + rawMoves + ', kept 0 — each needs a label, a text and evidence.');
      }
    }

    /* A truncated response is still returned, not discarded: extractJson
       salvages the moves that came through whole, and a shorter row of complete
       moves is a better answer than an error. Flagged so the ceiling-hit rate
       stays measurable — each one burns several times the output cost. */
    if (data.stop_reason === 'max_tokens') {
      const diag = diagnose(data, text);
      console.log('[CONTEXA] partial salvage', JSON.stringify(diag),
        'kept=' + moves.length, 'text[-300]=', JSON.stringify(text.slice(-300)));
      return json({
        moves, grounding, partial: true, diag,
        quota: { used: quota.used, limit: DEVICE_DAILY_LIMIT }
      }, 200, request, env);
    }

    return json({
      moves, grounding,
      quota: { used: quota.used, limit: DEVICE_DAILY_LIMIT }
    }, 200, request, env);
  }
};
