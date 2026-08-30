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
 *   node prompt-ab-fork.mjs --only=U3          (one input only, still 5 runs/variant)
 *
 * The key is read from the environment and never printed, never written, and
 * never leaves this process except to api.anthropic.com.
 *
 * RUN HISTORY, each input run exactly once, not to be re-run once reported:
 *   U1, U2 — run [date of the 45-call run], thresholds per-variant out of 5:
 *     U1 NOW >=4/5 moves (FAILED 3/5), DROP >=4/5 moves (passed 5/5)
 *     U2 NOW ==5/5 moves (FAILED 4/5), DROP ==5/5 moves (passed 5/5)
 *   Those two results are final regardless of what else this file's U3
 *   fixture or scoring goes through afterward.
 *   U3 v1 (question-only, "deeper alone earned") was INVALID as a test: its
 *   own PRE already scored 5/5 questions, meaning nothing was ever pulling it
 *   toward moves, so it could not have detected the anchor sentence's
 *   absence. Replaced with U3 v2, designed to actually tempt deeper — also
 *   inert (its own PRE scored 5/5 too). Replaced with U3 v3 (rate-limiter),
 *   the third and pre-committed-final attempt.
 *
 * U3 v3 — run 2026-08-30, PRE 5/5, NOW 5/5, DROP 5/5 questions: DROP matched
 *   NOW exactly, same as v1 and v2 before it. Kill test fired as pre-committed
 *   above. Per the standing pre-commitment ("if DROP matches NOW again, ship
 *   DROP instead of NOW and stop this line of testing"), QUESTIONS_SYSTEM
 *   shipped with the anchor sentence removed (PR #14) — the shorter bullet is
 *   now what CURRENT actually contains, so PRECEDENCE_BULLET below reads as
 *   the one-sentence form and DROP is byte-identical to NOW. This U3 line is
 *   closed; not to be re-run.
 *
 * PRE-REGISTERED for U3 v2/v3 — fixed before any run, not adjusted after
 * seeing results:
 *   NOW  >= 4/5 questions
 *   DROP <= 3/5 questions  -> anchor sentence confirmed necessary
 *   DROP == 4/5            -> INCONCLUSIVE, report as inconclusive, not a near-pass
 *   DROP == 5/5            -> kill test fires: anchor not earning its place,
 *                              change does not ship regardless of U1/U2
 *
 * The call is assembled to match extension/background.js EXACTLY — same
 * system prompt, same section labels, same 2500 ceiling, same disabled
 * thinking, same model. If background.js changes how it calls, change this
 * too or it stops measuring the product.
 */

import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const onlyArg = argv.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length) : null;
const RUNS = Number(argv.find(a => /^\d+$/.test(a)) || 5);
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
  '- choose, risk, and why outrank questions. If the reply earned any of them, return the move row and no questions — even when the reply directly asked the user something.\n';
const PRECEDENCE_BULLET_NO_ANCHOR =
  '- choose, risk, and why outrank questions. If the reply earned any of them, return the move row and no questions — even when the reply directly asked the user something.\n';
const ANCHOR_EXEMPLAR =
  '- Deeper\'s own gate, not precedence: the reply sketched the outline for a blog post and ended "I can expand this into a full draft once I know who it\'s for." On the surface this reads deeper-shaped — the reply offered to go further — but "who it\'s for" is something only she holds, so deeper does not apply at all and the row must ask: label "Audience", question "Who is this post for?", options ["Beginners to the topic","People who already know the basics","A mixed audience"], evidence "once I know who it\'s for".\n';
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
/* DROP is now byte-identical to NOW: the sentence it tested for removal
   already shipped removed in PR #14. Kept as-is for the historical record,
   not refactored away. */
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

/* U3 v1 (options-language birthday-gift reply) was INVALID: its own PRE
   already scored 5/5 questions, so nothing was ever pulling it toward moves
   and it could not have detected the anchor sentence's absence.
   U3 v2 (compound-interest explanation, "I could walk through X or Y") was
   VALID but inert: PRE also scored 5/5 - the model treated the offer as
   needing to know which branch regardless of any rule, so DROP matching NOW
   there was uninformative rather than a real anchor failure.
   v3, THIRD AND FINAL ATTEMPT, pre-committed: if DROP matches NOW again
   (5/5 questions), we ship DROP instead of NOW and this line of testing
   stops - not chasing a fourth fixture regardless of outcome. A working
   code answer + a plain yes/no offer to wire it in, closer to deeper's
   actual shape than v2's "which of two things" framing. */
const U3 = {
  note: "v3 (FINAL) — a working code answer plus a plain offer to wire it in ('let me know if you'd like it wired into your existing routes'). Pre-committed: if DROP matches NOW again, ship DROP instead of NOW and stop this line of testing.",
  userMessage: 'Set up a rate limiter for my API.',
  reply: "Here's a basic rate limiter:\n```\nfrom time import time\n\nclass RateLimiter:\n    def __init__(self, max_calls=100, window=60):\n        self.max_calls = max_calls\n        self.window = window\n        self.calls = []\n\n    def allow(self):\n        now = time()\n        self.calls = [t for t in self.calls if now - t < self.window]\n        if len(self.calls) < self.max_calls:\n            self.calls.append(now)\n            return True\n        return False\n```\nThis allows up to 100 requests per 60-second window. Let me know if you'd like it wired into your existing routes.",
};

/* Pre-registered per-variant, out of RUNS (5) each — not pooled. PRE is
   informational only, never gating: pre-edit baseline for context.

   Each input's evalDrop() decides pass/fail/inconclusive for its DROP
   variant; NOW is always a simple floor (nowMin). U1/U2 results are FINAL
   (see the run-history comment at the top) and are not re-run — their
   entries stay here only so a future full run has a complete, correct
   definition to work from. */
const INPUTS = [
  {
    name: 'U1', input: U1, branch: 'MOVES', nowMin: 4,
    evalDrop: d => ({ pass: d >= 4, label: d >= 4 ? 'PASS' : 'FAIL', need: '>= 4/5' }),
  },
  {
    name: 'U2', input: U2, branch: 'MOVES', nowMin: 5,
    evalDrop: d => ({ pass: d >= 5, label: d >= 5 ? 'PASS' : 'FAIL', need: '== 5/5' }),
  },
  {
    name: 'U3', input: U3, branch: 'QUESTIONS', nowMin: 4,
    evalDrop: d => {
      if (d <= 3) return { pass: true, label: 'PASS — anchor sentence confirmed necessary', need: '<= 3/5' };
      if (d === 4) return { pass: null, label: 'INCONCLUSIVE — not a near-pass, needs judgment', need: '== 4/5 is inconclusive' };
      return { pass: false, label: 'FAIL — KILL TEST FIRED: anchor not earning its place', need: '== 5/5 fires the kill test' };
    },
  },
];

const RUN_INPUTS = ONLY ? INPUTS.filter(i => i.name === ONLY) : INPUTS;
if (ONLY && !RUN_INPUTS.length) throw new Error(`--only=${ONLY} matched no input (have: ${INPUTS.map(i => i.name).join(', ')})`);

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

/* ---- run: every (selected) input x every variant x RUNS -------------------- */

const totalCalls = RUN_INPUTS.length * VARIANTS.length * RUNS;
console.log(`model ${MODEL} · ${RUNS} runs per variant · ${RUN_INPUTS.length} input(s)${ONLY ? ` (--only=${ONLY})` : ''} · ${VARIANTS.length} variants · ${totalCalls} calls total\n`);

const results = {}; // results[inputName][variantName] = { BRANCH: count, ... }
for (const { name: inputName, input } of RUN_INPUTS) {
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

// A variant where every single run errored (HTTP failure, unparsed response)
// produced no model behavior at all. Scoring its 0-count against the real
// thresholds would report "0 <= 3 -> PASS" or similar — a false signal
// indistinguishable from a genuine result. Flag it as invalid instead of
// scoring it.
const REAL_BRANCHES = new Set(['MOVES', 'QUESTIONS', 'SILENT']);
function variantIsAllErrors(inputName, variantName) {
  const counts = results[inputName][variantName] || {};
  const real = Object.entries(counts).filter(([b]) => REAL_BRANCHES.has(b)).reduce((s, [, n]) => s + n, 0);
  return real === 0 && Object.values(counts).reduce((s, n) => s + n, 0) > 0;
}

let allPass = true;
let anyInconclusive = false;
let anyInvalid = false;
let u3Failed = false;

for (const { name: inputName, branch, nowMin, evalDrop } of RUN_INPUTS) {
  const preInvalid = variantIsAllErrors(inputName, 'PRE');
  const nowInvalid = variantIsAllErrors(inputName, 'NOW');
  const dropInvalid = variantIsAllErrors(inputName, 'DROP');
  if (preInvalid || nowInvalid || dropInvalid) {
    anyInvalid = true;
    console.log(`\n${inputName}  expect ${branch}`);
    for (const [variantName] of VARIANTS) {
      const line = Object.entries(results[inputName][variantName]).map(([b, n]) => `${b}:${n}`).join('  ');
      console.log(`  ${variantName.padEnd(5)} ${line}${variantIsAllErrors(inputName, variantName) ? '  <-- ALL ERRORS, NOT A RESULT' : ''}`);
    }
    console.log(`  INVALID RUN: at least one variant produced zero real branch data (HTTP/parse errors only).`);
    console.log(`  Not scored against thresholds — this is an infrastructure failure, not a model result.`);
    continue;
  }

  const preCount = countInVariant(inputName, 'PRE', branch);
  const nowCount = countInVariant(inputName, 'NOW', branch);
  const dropCount = countInVariant(inputName, 'DROP', branch);

  const nowPass = nowCount >= nowMin;
  const drop = evalDrop(dropCount, nowCount);
  // pass: true -> PASS, false -> FAIL, null -> INCONCLUSIVE (counts as neither pass nor fail)
  if (!nowPass) allPass = false;
  if (drop.pass === false) { allPass = false; if (inputName === 'U3') u3Failed = true; }
  if (drop.pass === null) anyInconclusive = true;

  console.log(`\n${inputName}  expect ${branch}`);
  for (const [variantName] of VARIANTS) {
    const line = Object.entries(results[inputName][variantName]).map(([b, n]) => `${b}:${n}`).join('  ');
    console.log(`  ${variantName.padEnd(5)} ${line}`);
  }
  console.log(`  PRE   ${preCount}/${RUNS} ${branch}  (informational, not gating)`);
  console.log(`  NOW   ${nowCount}/${RUNS} ${branch}  (need >= ${nowMin})  ->  ${nowPass ? 'PASS' : 'FAIL'}`);
  console.log(`  DROP  ${dropCount}/${RUNS} ${branch}  (${drop.need})  ->  ${drop.label}`);
}

console.log('\n' + '='.repeat(78));
if (anyInvalid) {
  console.log('RUN INVALID: at least one input produced no real branch data (see above).');
  console.log('Nothing here is scored against any threshold. Re-run once the underlying');
  console.log('failure (rate limit, spend cap, etc.) is resolved — this run proves nothing.');
} else if (u3Failed) {
  console.log('U3 KILL TEST FIRED: the anchor sentence is not earning its place.');
  console.log('Per the brief, this is FAILURE regardless of U1/U2 — the change does not ship.');
} else if (anyInconclusive) {
  console.log('At least one DROP result is INCONCLUSIVE — reported as inconclusive, not as a near-pass.');
}
console.log(anyInvalid ? '\nINVALID RUN — NOT SCORED'
  : allPass && !anyInconclusive ? '\nALL THRESHOLDS MET'
  : allPass ? '\nNO FAILURES, BUT AT LEAST ONE RESULT IS INCONCLUSIVE'
  : '\nAT LEAST ONE THRESHOLD FAILED');
console.log('='.repeat(78));
