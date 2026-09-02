/* CONTEXA on Claude Code — prototype, not a shipped artifact.
   See README.md in this directory for what this is and what it deliberately does not do.

   MOVES_SYSTEM and the four gate functions below (cleanTurns, cleanMoves, groundMoves,
   enforceAction, plus their trimPayload/tallySources helpers) are copied VERBATIM from
   extension/background.js — same rule as background.js/worker/src/index.js: a gate that
   only exists in one place is a gate the other users don't have. Here "the other path"
   is the Claude Code CLI instead of the hosted worker, but the reasoning is identical, so
   this file does not re-derive the logic, it copies it. If you change the gates in
   extension/background.js, re-copy them here too — this file is NOT covered by
   build.mjs's byte-identity check, so nothing enforces that automatically. */

export const MOVES_SYSTEM = `You are CONTEXA, embedded in claude.ai. You see the user's own messages from this whole session, oldest first, and Claude's latest reply. Your job is to read where this person has been going and offer up to four INDEPENDENT next moves — each one a complete message they could send right now, on its own, with one click. This is a menu, not an interview: you are not filling a gap in the reply and you are not asking them anything.
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

const MAX_PAYLOAD_CHARS = 700;
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

export function cleanTurns(v) {
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

export function turnsSection(turns) {
  return turns.map(t => '[' + t.i + '] ' + t.text).join('\n\n');
}

export function cleanMoves(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const m of v) {
    if (!m || typeof m !== 'object') continue;
    const label = String(m.label == null ? '' : m.label).replace(/\s+/g, ' ').trim().slice(0, 60);
    const text = trimPayload(m.text);
    const evidence = String(m.evidence == null ? '' : m.evidence).replace(/\s+/g, ' ').trim().slice(0, 90);
    if (!label || !text || !evidence) continue;
    if (out.some(x => x.label.toLowerCase() === label.toLowerCase())) continue;
    out.push({ label, text, evidence });
    if (out.length === 4) break;
  }
  return out;
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

export function groundMoves(moves, turnsText, replyText) {
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const turnsHay = norm(turnsText);
  const replyHay = norm(replyText);
  const sources = [];
  for (const m of moves) {
    const ev = norm(m.evidence);
    if (turnsHay && turnsHay.includes(ev)) sources.push('turns');
    else if (replyHay.includes(ev)) sources.push('reply');
    else sources.push('');
  }
  return Object.assign(tallySources(sources), { sources });
}

const ACTION_OPENERS = new RegExp('^\\s*(' + [
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
  'napravi|napiši|napisi|izradi|kreiraj|generiši|generisi|sastavi|osmisli|smisli',
  'definiši|definisi|precizuj|preciziraj|odredi|utvrdi|izaberi|odaberi',
  'razradi|razvij|dopuni|dodaj|proširi|prosiri|dovrši|dovrsi|završi|zavrsi',
  'postavi|podesi|instaliraj|deployuj|objavi|pusti|poveži|povezi',
  'skiciraj|nacrtaj|iscrtaj|modeluj|modeliraj|projektuj|isprojektuj',
  'popravi|ispravi|sredi|reši|resi|otkloni|debaguj',
  'pretvori|prebaci|premesti|premjesti|zameni|zamijeni|preimenuj|kopiraj|migriraj|prevedi|prilagodi|uskladi',
  'ažuriraj|azuriraj|osveži|osvezi|doradi|prepravi|refaktoriši|refaktorisi|pojednostavi|očisti|ocisti',
  'proveri|provjeri|testiraj|izmeri|izmjeri|izračunaj|izracunaj|uporedi|usporedi|analiziraj|proceni|procijeni|reprodukuj|pregledaj|ispitaj',
  'nabroji|izlistaj|popiši|popisi|prikupi|izvuci|sakupi',
  'primeni|primijeni|implementiraj|automatizuj|skriptuj|uradi|odradi',
  'ukloni|obriši|obrisi|izbaci|skrati|podeli|podijeli|spoji|grupiši|grupisi|sortiraj'
].join('|') + ')\\b', 'i');

const META_OBJECTS = /\b(pitanj\w*|question|questions|odgovor\w*|answer|answers)\b/i;

export function enforceAction(moves, ground) {
  const keep = [], sources = [];
  let dropped = 0;
  for (let i = 0; i < moves.length; i++) {
    const label = moves[i].label;
    const why = !ACTION_OPENERS.test(label) ? 'no production verb'
      : META_OBJECTS.test(label) ? 'produces a question, not work'
      : null;
    if (why) { dropped++; continue; }
    keep.push(moves[i]);
    sources.push(ground.sources[i]);
  }
  return {
    moves: keep,
    ground: Object.assign(tallySources(sources), { sources }),
    droppedByAction: dropped
  };
}

/* Everything below this line is new for Claude Code — there is no DOM here, so
   there is no captureTurns()/fitTurns() to port. This reads a Claude Code
   session transcript (~/.claude/projects/<project>/<session>.jsonl) instead of
   the page, and applies the SAME pin-turn-one / drop-oldest-middle policy
   fitTurns uses, for the same reason: losing the earliest message loses the
   stated goal. */
export function extractFromTranscript(jsonlText) {
  const userTexts = [];
  let lastReply = '';
  for (const line of jsonlText.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const msg = entry && entry.message;
    if (!msg || typeof msg !== 'object') continue;
    if (entry.type === 'user' && typeof msg.content === 'string' && msg.content.trim()) {
      userTexts.push(msg.content.trim());
    } else if (entry.type === 'assistant' && Array.isArray(msg.content)) {
      const text = msg.content.filter(b => b && b.type === 'text').map(b => b.text || '').join('\n').trim();
      if (text) lastReply = text;
    }
  }
  // The newest user entry is the /contexa-moves invocation itself, not a real
  // conversation turn — drop it, mirroring how the extension's trigger is a
  // click rather than a sent message.
  const priorUserTexts = userTexts.slice(0, -1);
  const rawTurns = priorUserTexts.map((text, idx) => ({ i: idx + 1, text }));
  return { turns: fitTurns(rawTurns), reply: lastReply };
}

/* Pin turn one, drop oldest MIDDLE turns first, floor of two — same policy as
   extension/content.js's fitTurns(), applied to transcript turns instead of
   DOM turns. cleanTurns() below enforces the same caps again server-side; this
   is the client-side budget on top of it, same division of labor as content.js
   vs background.js. */
function fitTurns(turns) {
  const out = turns.slice();
  while (out.length > 2 && (out.length > MAX_TURNS || out.reduce((n, t) => n + t.text.length, 0) > MAX_TURNS_TOTAL_CHARS)) {
    out.splice(1, 1);
  }
  return out;
}
