/* CONTEXA — offline A/B for the fork precedence rule.
 *
 * WHY THIS EXISTS. Same harness family as the 2026-08-28 questions-vs-moves
 * fork investigation (see git history for the original single-input,
 * PRE/NOW/END version). Extended for the choose/risk/why-outrank-questions
 * precedence rule added to QUESTIONS_SYSTEM: three fixed inputs instead of
 * one, three prompt variants (PRE/NOW/DROP) instead of (PRE/NOW/END).
 *
 *   $env:ANTHROPIC_API_KEY = "sk-ant-..."      (PowerShell, this session only)
 *   node prompt-ab-fork.mjs
 *   node prompt-ab-fork.mjs 3                  (3 runs per variant instead of 5)
 *
 * The key is read from the environment and never printed, never written, and
 * never leaves this process except to api.anthropic.com.
 *
 * PRE-REGISTERED — fixed before any run, not to be adjusted after seeing
 * results:
 *   U1 (contested shape)                    expect MOVES      >= 13/15
 *   U2 (finished work, nothing asked)       expect MOVES      == 15/15 (unchanged regression anchor)
 *   U3 (question-only, deeper alone earned) expect QUESTIONS  >= 13/15
 *   U3 is the kill switch: if it fails, the change does not ship regardless
 *   of U1/U2 — report that as failure, not partial success.
 *
 * The call is assembled to match extension/background.js EXACTLY — same
 * system prompt, same section labels, same 2500 ceiling, same disabled
 * thinking, same model. If background.js changes how it calls, change this
 * too or it stops measuring the product.
 */

import { readFileSync } from 'node:fs';

const RUNS = Number(process.argv[2] || 5);
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error('Set ANTHROPIC_API_KEY first. Nothing was sent.');
  process.exit(1);
}

/* ---- the prompt under test, and the three variants ------------------------ */

const SRC = readFileSync('extension/background.js', 'utf8');
const CURRENT = (SRC.match(/const QUESTIONS_SYSTEM = `([\s\S]*?)`;/) || [])[1];
const MODEL = (SRC.match(/const SHIPPED_MODEL = '([^']+)'/) || [])[1];
if (!CURRENT || !MODEL) throw new Error('could not read QUESTIONS_SYSTEM / SHIPPED_MODEL');

/* Exact strings added when the precedence rule shipped. If background.js's
   wording ever drifts, this throws rather than silently testing a stale
   variant against a prompt that no longer matches the shipped one. */
const PRECEDENCE_BULLET =
  '- choose, risk, and why outrank questions. If the reply earned any of them, return the move row and no questions — even when the reply directly asked the user something. deeper never outranks a question: when deeper is the only move the reply earned, ask instead.\n';
const PRECEDENCE_BULLET_NO_ANCHOR =
  '- choose, risk, and why outrank questions. If the reply earned any of them, return the move row and no questions — even when the reply directly asked the user something.\n';
const ANCHOR_EXEMPLAR =
  '- Anchor: deeper alone is earned, and a question still wins. The reply sketched the outline for a blog post and ended "I can expand this into a full draft once I know who it\'s for." On the surface this reads deeper-shaped — the reply offered to go further — but "who it\'s for" is something only she holds, so deeper does not apply and the row must ask: label "Audience", question "Who is this post for?", options ["Beginners to the topic","People who already know the basics","A mixed audience"], evidence "once I know who it\'s for". Per the precedence rule above, deeper never outranks a question — even when a move would otherwise look tempting.\n';
const CONTESTED_EXEMPLAR =
  '- Contested shape: an assumption stated AND a decision handed back, in the same breath. The reply built the export using CSV and ended "I went with CSV since that\'s what most spreadsheet tools expect — let me know if you want me to add JSON too." Read shallow, that final clause looks like a question the reply is asking; per the precedence rule above, choose and risk both outrank it regardless. risk names the assumption, choose names the fork, and neither becomes a question: chips [{"id":"risk","text":"What if CSV isn\'t the format the other tool actually wants?","evidence":"I went with CSV since that\'s what most spreadsheet tools expect"},{"id":"choose","text":"Add a JSON export alongside CSV, or leave it as the one format.","evidence":"let me know if you want me to add JSON too"}].\n';

for (const [name, s] of [
  ['precedence bullet', PRECEDENCE_BULLET],
  ['anchor exemplar', ANCHOR_EXEMPLAR],
  ['contested exemplar', CONTESTED_EXEMPLAR],
]) {
  if (!CURRENT.includes(s)) throw new Error(`${name} not found in background.js — has it changed since this harness was written?`);
}

function buildPRE(text) {
  return text.replace(PRECEDENCE_BULLET, '').replace(ANCHOR_EXEMPLAR, '').replace(CONTESTED_EXEMPLAR, '');
}
function buildDROP(text) {
  return text.replace(PRECEDENCE_BULLET, PRECEDENCE_BULLET_NO_ANCHOR);
}

const VARIANTS = [
  ['PRE', buildPRE(CURRENT)],   // rule and both exemplars absent — pre-edit baseline
  ['NOW', CURRENT],             // rule + both exemplars, as shipped — the actual ship candidate
  ['DROP', buildDROP(CURRENT)], // rule minus the deeper carve-out — tests the "collapses silently" claim
];

/* ---- the three fixed inputs ------------------------------------------------
   U1 is the existing contested-shape capture (scripts/ab-input.json).
   U2 and U3 were given verbatim for this run, in the ab-input.json shape —
   NOT recovered field captures, constructed to the pre-registered shape.
   Fixed here rather than in an editable JSON file, so a casual later edit
   can't silently move a pre-registered input out from under this report. */

const U1 = JSON.parse(readFileSync(new URL('./ab-input.json', import.meta.url), 'utf8'));

const U2 = {
  note: 'Finished work reported, nothing left open — the deeper-only regression anchor. (Revised: the first draft risked earning only deeper, which would collapse to questions under the new rule and read as a false failure.)',
  userMessage: 'Any updates on the migration?',
  reply: "Done — moved the auth checks to middleware and updated the three call sites. I removed the old duplicate check in the legacy handler since middleware now covers it; that path isn't covered by the current tests, so it's worth a manual look before this ships. Everything else passes.",
};

const U3 = {
  note: "Options-language that also asks for missing info — deeper-tempting, but a question must still win. The precedence rule's kill test.",
  userMessage: 'Give me ideas for a birthday gift for my sister.',
  reply: 'A few directions: something experiential — a class or an event — something personal and handmade, or a practical upgrade to something she already uses. Each fits a different kind of sister. Tell me a bit about her interests and I can narrow it down.',
};

/* Pre-registered per-variant, out of RUNS (5) each — not pooled across the
   15 total per input. PRE is informational only, never gating: it shows
   pre-edit baseline behavior for context, nothing more.

   U1/U2: NOW and DROP each held to their own fixed floor.
   U3: NOW held to a floor; DROP is not a fixed-floor check but a KILL TEST
   compared directly against NOW's own count on the same run — if dropping
   the anchor sentence does not measurably cost questions (DROP's count
   matches or exceeds NOW's), the anchor was not earning its place and the
   change does not ship, regardless of U1/U2. */
const INPUTS = [
  { name: 'U1', input: U1, branch: 'MOVES', nowMin: 4, dropMin: 4 },
  { name: 'U2', input: U2, branch: 'MOVES', nowMin: 5, dropMin: 5 },
  { name: 'U3', input: U3, branch: 'QUESTIONS', nowMin: 4, dropIsKillTest: true },
];

function userText(input) {
  // Section labels must match background.js byte-for-byte.
  return 'USER MESSAGE:\n' + input.userMessage.slice(0, 2500) + '\n\nCLAUDE REPLY:\n' + input.reply.slice(0, 6000);
}

/* ---- one call, shaped exactly like the extension's ------------------------ */

async function ask(system, text) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 2500, thinking: { type: 'disabled' },
      system, messages: [{ role: 'user', content: text }],
    }),
  });
  if (!res.ok) return { branch: 'HTTP ' + res.status, detail: (await res.text()).slice(0, 160) };

  const data = await res.json();
  const raw = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  let parsed = null;
  try { parsed = JSON.parse(raw.trim().replace(/^```(?:json)?|```$/g, '').trim()); } catch {}
  if (!parsed) return { branch: 'unparsed', detail: raw.slice(0, 120) };

  const qs = Array.isArray(parsed.questions) ? parsed.questions : [];
  const chips = Array.isArray(parsed.chips) ? parsed.chips : [];
  if (chips.length) return { branch: 'MOVES', detail: chips.map(c => c.id).join(',') };
  if (qs.length) return { branch: 'QUESTIONS', detail: qs.map(q => q.text).join(' | ') };
  return { branch: 'SILENT', detail: (parsed.assume || []).join(' / ') };
}

/* ---- run: every input x every variant x RUNS ------------------------------ */

const totalCalls = INPUTS.length * VARIANTS.length * RUNS;
console.log(`model ${MODEL} · ${RUNS} runs per variant · ${INPUTS.length} inputs · ${VARIANTS.length} variants · ${totalCalls} calls total\n`);

const results = {}; // results[inputName][variantName] = { BRANCH: count, ... }
for (const { name: inputName, input } of INPUTS) {
  results[inputName] = {};
  const text = userText(input);
  console.log(`=== ${inputName} — ${input.note} ===`);
  for (const [variantName, system] of VARIANTS) {
    console.log(`  ${variantName}`);
    results[inputName][variantName] = {};
    for (let i = 0; i < RUNS; i++) {
      const r = await ask(system, text);
      results[inputName][variantName][r.branch] = (results[inputName][variantName][r.branch] || 0) + 1;
      console.log(`    ${String(i + 1).padStart(2)}  ${r.branch.padEnd(9)} ${(r.detail || '').slice(0, 100)}`);
    }
  }
  console.log('');
}

/* ---- report against the pre-registered per-variant thresholds -------------
   Raw counts, no rounding, no re-running for a nicer number, no
   editorializing on a near-miss — a DROP failure is reported as failure,
   not softened because U1/U2 look fine. */

function countInVariant(inputName, variantName, branch) {
  return (results[inputName][variantName] || {})[branch] || 0;
}

console.log('='.repeat(78));
console.log('RESULTS');
console.log('='.repeat(78));

let allPass = true;
let u3KillTestFired = false;

for (const { name: inputName, branch, nowMin, dropMin, dropIsKillTest } of INPUTS) {
  const preCount = countInVariant(inputName, 'PRE', branch);
  const nowCount = countInVariant(inputName, 'NOW', branch);
  const dropCount = countInVariant(inputName, 'DROP', branch);

  const nowPass = nowCount >= nowMin;
  let dropPass, dropLine;
  if (dropIsKillTest) {
    // Kill test: DROP must show FEWER of the expected branch than NOW did —
    // proof the anchor sentence is the thing holding the line. Matching or
    // exceeding NOW means the anchor isn't earning its place.
    dropPass = dropCount < nowCount;
    dropLine = `DROP  ${dropCount}/${RUNS} ${branch}  vs NOW's ${nowCount}/${RUNS}  ->  `
      + (dropPass ? 'PASS (anchor validated: dropping it cost questions)'
                  : 'FAIL — KILL TEST: dropping the anchor did not cost questions; it is not earning its place');
    if (!dropPass) u3KillTestFired = true;
  } else {
    dropPass = dropCount >= dropMin;
    dropLine = `DROP  ${dropCount}/${RUNS} ${branch}  (need >= ${dropMin})  ->  ${dropPass ? 'PASS' : 'FAIL'}`;
  }

  if (!nowPass) allPass = false;
  if (!dropPass) allPass = false;

  console.log(`\n${inputName}  expect ${branch}`);
  for (const [variantName] of VARIANTS) {
    const line = Object.entries(results[inputName][variantName]).map(([b, n]) => `${b}:${n}`).join('  ');
    console.log(`  ${variantName.padEnd(5)} ${line}`);
  }
  console.log(`  PRE   ${preCount}/${RUNS} ${branch}  (informational, not gating)`);
  console.log(`  NOW   ${nowCount}/${RUNS} ${branch}  (need >= ${nowMin})  ->  ${nowPass ? 'PASS' : 'FAIL'}`);
  console.log(`  ${dropLine}`);
}

console.log('\n' + '='.repeat(78));
if (u3KillTestFired) {
  console.log('U3 KILL TEST FIRED: the anchor sentence is not earning its place.');
  console.log('Per the brief, this is FAILURE regardless of U1/U2 — the change does not ship.');
} else {
  console.log('U3 kill test did not fire — the anchor sentence is pulling its weight.');
}
console.log(allPass ? '\nALL THRESHOLDS MET' : '\nAT LEAST ONE THRESHOLD FAILED');
console.log('='.repeat(78));
