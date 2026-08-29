/* CONTEXA — offline A/B for the questions-vs-moves fork.
 *
 * WHY THIS EXISTS. On 2026-08-28 a reply that offers to do something and asks
 * whether to ("javi ako hoćeš da to ubacim") started coming back as a MOVES row
 * instead of an interview. One field run before a prompt edit said questions,
 * three after said moves — but the edit and the runs were never a controlled
 * comparison, and a fourth attempt was voided when an accidental message
 * changed the conversation underneath it.
 *
 * The UI cannot give a clean A/B: every reload is a new page, every reply is a
 * new input, and the console is shared. This sends ONE FIXED PAIR through
 * several prompt variants, N times each, and prints only which branch came
 * back. Same input, one variable, repeatable.
 *
 *   $env:ANTHROPIC_API_KEY = "sk-ant-..."      (PowerShell, this session only)
 *   node prompt-ab-fork.mjs
 *   node prompt-ab-fork.mjs 3                  (3 runs per variant instead of 5)
 *
 * The key is read from the environment and never printed, never written, and
 * never leaves this process except to api.anthropic.com.
 *
 * The call is assembled to match extension/background.js EXACTLY — same system
 * prompt, same section labels, same 2500 ceiling, same disabled thinking, same
 * model. If background.js changes how it calls, change this too or it stops
 * measuring the product.
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const RUNS = Number(process.argv[2] || 5);
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error('Set ANTHROPIC_API_KEY first. Nothing was sent.');
  process.exit(1);
}

/* ---- the prompt under test, and the variants ----------------------------- */

const SRC = readFileSync('extension/background.js', 'utf8');
const CURRENT = (SRC.match(/const QUESTIONS_SYSTEM = `([\s\S]*?)`;/) || [])[1];
const MODEL = (SRC.match(/const SHIPPED_MODEL = '([^']+)'/) || [])[1];
if (!CURRENT || !MODEL) throw new Error('could not read QUESTIONS_SYSTEM / SHIPPED_MODEL');

/* The two things 0.9.56 added after the register itself, isolated so each can
   be removed independently. Both strings must match background.js verbatim; if
   an edit there changes them, this file throws rather than silently testing
   variants that no longer differ. */
const BORROW_RULE = ' A reply that offers in ITS OWN first person — "shall I add it?", "want me to write it?" — is the sharpest form of that trap: that "I" is CLAUDE\'S and is never borrowed. Turn the offer into what they want ("Do I want image scaling before upload?"), never into what Claude should do ("Should I add image scaling?").';

const EXEMPLAR_START = '- The reply\'s own "I" is not hers to borrow.';

function withoutExemplar(text) {
  const i = text.indexOf(EXEMPLAR_START);
  if (i < 0) throw new Error('exemplar not found — has background.js changed?');
  const j = text.indexOf('\n', i) + 1;
  return { text: text.slice(0, i) + text.slice(j), bullet: text.slice(i, j) };
}

function exemplarAtEnd(text) {
  const { text: without, bullet } = withoutExemplar(text);
  const k = without.indexOf('Each question has FOUR parts:');
  if (k < 0) throw new Error('schema anchor not found');
  return without.slice(0, k) + bullet + without.slice(k);
}

if (!CURRENT.includes(BORROW_RULE)) throw new Error('borrow rule not found — has background.js changed?');

const V_PRE = withoutExemplar(CURRENT.replace(BORROW_RULE, '')).text; // before the want-anchor fix
const V_NOW = CURRENT;                                                // shipped: exemplar in the question block
const V_END = exemplarAtEnd(CURRENT);                                 // exemplar after the move examples

const VARIANTS = [
  ['PRE  (no borrow rule, no exemplar)', V_PRE],
  ['NOW  (rule + exemplar, question block)', V_NOW],
  ['END  (rule + exemplar, after moves)', V_END],
];

/* ---- the fixed input ------------------------------------------------------
   Transcribed from the 2026-08-28 field capture. The user message was not
   visible in the recording and is a stand-in — which is fine, because every
   variant gets the SAME pair; it only means this reproduces the field shape,
   not the field bytes. Edit ab-input.json to test a different pair. */

const DEFAULT_INPUT = {
  note: 'Field shape from 2026-08-28: a reply that proposes a fix and asks whether to add it.',
  userMessage: 'Napravi mi aplikaciju za oglase polovnih delova, sa Supabase bekendom i slikama koje korisnici dodaju sa telefona.',
  reply: [
    'Dok CONFIG na vrhu skripte nije popunjen, aplikacija radi u demo režimu sa žutim banerom — tako možeš da je otvoriš i pre nego što napraviš projekat.',
    '',
    'UPUTSTVO-supabase.md — koraci od pravljenja projekta do objave, sa napomenom oko anon ključa (sme da stoji u kodu, service_role nikako) i podešavanja potvrde emaila.',
    '',
    'Jedna stvar koju bih sredio rano: slike sa telefona su često 3–5 MB i brzo pojedu besplatnu kvotu od 1 GB. Skaliranje na ~1200 px kroz canvas pre slanja je dvadesetak linija koda — javi ako hoćeš da to ubacim.',
  ].join('\n'),
};

const INPUT_FILE = 'ab-input.json';
if (!existsSync(INPUT_FILE)) {
  writeFileSync(INPUT_FILE, JSON.stringify(DEFAULT_INPUT, null, 2) + '\n');
  console.log(`wrote ${INPUT_FILE} — edit it to change the pair under test\n`);
}
const INPUT = JSON.parse(readFileSync(INPUT_FILE, 'utf8'));

// Section labels must match background.js byte-for-byte.
const USER_TEXT = 'USER MESSAGE:\n' + INPUT.userMessage.slice(0, 2500)
  + '\n\nCLAUDE REPLY:\n' + INPUT.reply.slice(0, 6000);

/* ---- one call, shaped exactly like the extension's ----------------------- */

async function ask(system) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2500,
      thinking: { type: 'disabled' },
      system,
      messages: [{ role: 'user', content: USER_TEXT }],
    }),
  });
  if (!res.ok) return { branch: 'HTTP ' + res.status, detail: (await res.text()).slice(0, 160) };

  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  let parsed = null;
  try { parsed = JSON.parse(text.trim().replace(/^```(?:json)?|```$/g, '').trim()); } catch {}
  if (!parsed) return { branch: 'unparsed', detail: text.slice(0, 120) };

  const qs = Array.isArray(parsed.questions) ? parsed.questions : [];
  const chips = Array.isArray(parsed.chips) ? parsed.chips : [];
  if (chips.length) return { branch: 'MOVES', detail: chips.map(c => c.id).join(',') };
  if (qs.length) {
    return {
      branch: 'QUESTIONS',
      detail: qs.map(q => q.text).join(' | '),
      // the want-anchor is only observable when questions actually come back
      secondPerson: qs.some(q => /\b(you|your|hoćeš|želiš)\b/i.test(q.text || '')),
    };
  }
  return { branch: 'SILENT', detail: (parsed.assume || []).join(' / ') };
}

/* ---- run ----------------------------------------------------------------- */

console.log(`model ${MODEL} · ${RUNS} runs per variant · same pair throughout\n`);

const tally = {};
for (const [name, system] of VARIANTS) {
  console.log(name);
  tally[name] = {};
  for (let i = 0; i < RUNS; i++) {
    const r = await ask(system);
    tally[name][r.branch] = (tally[name][r.branch] || 0) + 1;
    const flag = r.secondPerson ? '  <-- SECOND PERSON' : '';
    console.log(`  ${String(i + 1).padStart(2)}  ${r.branch.padEnd(9)} ${(r.detail || '').slice(0, 100)}${flag}`);
  }
  console.log('');
}

console.log('summary');
for (const [name, counts] of Object.entries(tally)) {
  const line = Object.entries(counts).map(([b, n]) => `${b}:${n}`).join('  ');
  console.log(`  ${name.padEnd(40)} ${line}`);
}
console.log('\nRead it as: does the branch change between PRE and NOW on the SAME input?');
console.log('If PRE asks and NOW moves, the 0.9.56 voice edit moved the fork.');
console.log('If all three move, the fork was already wrong and the edit is innocent.');
