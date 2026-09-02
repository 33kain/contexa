/* CONTEXA on Claude Code — prototype tests. Run:  node claude-code-moves/test.mjs
   Not wired into `npm test`: this directory is a prototype, not one of the two
   shipped artifacts npm test covers (see README.md). Checks the ported gate
   functions behave the same as their extension/background.js originals, plus
   the new transcript extraction. */

import {
  extractFromTranscript, cleanTurns, cleanMoves, groundMoves, enforceAction, turnsSection
} from './lib.mjs';

const fails = [];
const t = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!cond) fails.push(name);
};

// ---- cleanMoves -------------------------------------------------------
{
  const out = cleanMoves([
    { label: 'Add a contact form', text: 'Add a contact form.', evidence: 'contact form' },
    { label: '  ', text: 'x', evidence: 'y' },                       // blank label dropped
    { label: 'Add a contact form', text: 'dup', evidence: 'dup' },   // case-insensitive dup dropped
    { label: 'A', text: '', evidence: 'y' },                         // empty text dropped
    { label: 'B', text: 'x', evidence: '' }                          // empty evidence dropped
  ]);
  t('cleanMoves keeps only the valid, deduped move', out.length === 1 && out[0].label === 'Add a contact form');
}

// ---- groundMoves + enforceAction --------------------------------------
{
  const moves = cleanMoves([
    { label: 'Write the menu page', text: 'Write the menu page.', evidence: 'the menu page' },
    { label: 'Explain what you just said', text: 'Explain that again.', evidence: 'the menu page' }, // no production verb
    { label: 'Nonsense evidence', text: 'x', evidence: 'not in either source' }
  ]);
  const turns = 'turn one text mentioning the menu page and other things';
  const reply = 'the reply text';
  const g0 = groundMoves(moves, turns, reply);
  t('groundMoves finds the turn-earned quote', g0.sources[0] === 'turns');
  t('groundMoves marks the unfound quote ungrounded', g0.sources[2] === '');

  const { moves: kept, ground, droppedByAction } = enforceAction(moves, g0);
  // "Nonsense evidence" also opens with no production verb, so it is dropped
  // for the same reason as "Explain..." — only the "Write" move survives.
  t('enforceAction drops the no-verb labels', kept.length === 1 && kept[0].label === 'Write the menu page');
  t('enforceAction re-tallies grounded count', ground.grounded === 1);
  t('enforceAction reports two drops', droppedByAction === 2);
}

// ---- enforceAction: Serbian verbs survive ------------------------------
{
  const moves = cleanMoves([
    { label: 'Napravi kontakt formu', text: 'Napravi kontakt formu za sajt.', evidence: 'kontakt formu' },
    { label: 'Dodaj pitanje o stagingu', text: 'x', evidence: 'staging' } // production verb, meta object
  ]);
  const g0 = groundMoves(moves, 'session pominje kontakt formu i staging', '');
  const { moves: kept } = enforceAction(moves, g0);
  t('enforceAction keeps a Serbian production verb', kept.some(m => m.label === 'Napravi kontakt formu'));
  t('enforceAction still drops a question-producing move', !kept.some(m => m.label.startsWith('Dodaj pitanje')));
}

// ---- cleanTurns: pin-and-drop matches the extension's floor of two -----
{
  const many = Array.from({ length: 50 }, (_, i) => ({ i: i + 1, text: 'turn ' + (i + 1) }));
  const out = cleanTurns(many);
  t('cleanTurns caps at MAX_TURNS', out.length === 40);
  t('cleanTurns keeps turn one', out[0].i === 1);
}

// ---- extractFromTranscript: JSONL -> turns + reply ---------------------
{
  const lines = [
    { type: 'user', message: { role: 'user', content: 'make me a website for my bakery' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'built the landing page' }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'ignored' }] } }, // not a real turn
    { type: 'user', message: { role: 'user', content: 'write the menu page too' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'skip' }] } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'wrote the menu page' }] } },
    { type: 'user', message: { role: 'user', content: '/contexa-moves' } } // this invocation itself, dropped
  ];
  const jsonl = lines.map(l => JSON.stringify(l)).join('\n');
  const { turns, reply } = extractFromTranscript(jsonl);
  t('extractFromTranscript ignores tool_result entries', turns.length === 2);
  t('extractFromTranscript drops the invoking turn', turns[turns.length - 1].text === 'write the menu page too');
  t('extractFromTranscript numbers turns from 1', turns[0].i === 1 && turns[0].text === 'make me a website for my bakery');
  t('extractFromTranscript takes the latest assistant text reply', reply === 'wrote the menu page');
  t('turnsSection renders numbered turns', turnsSection(turns).startsWith('[1] make me a website for my bakery'));
}

console.log('');
if (fails.length) {
  console.log(fails.length + ' FAILED: ' + fails.join(', '));
  process.exit(1);
} else {
  console.log('all ok');
}
