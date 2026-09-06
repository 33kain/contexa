#!/usr/bin/env node
/* Plants a fixed set of faults in the working tree for the tokenbrake A/B
   debugging task (33kain/tokenbrake, AB-TASK.md). Each fault is one exact
   string replacement; the script refuses to run if any anchor is missing, so
   both arms of a run start from the same broken state or not at all.

   node scripts/ab/inject-faults.mjs          plant all faults and commit them
   node scripts/ab/inject-faults.mjs --list   name them without touching files
   node scripts/ab/inject-faults.mjs --only=3 plant one, uncommitted (for probing)
   node scripts/ab/inject-faults.mjs --no-commit   plant all, uncommitted

   The planted tree is committed on the current branch (message "ab: planted
   faults"), so `git diff` is clean and the faults have to be found by running
   tests and reading code, not by diffing: both Fable arms of the first run
   read every fault off `git diff` in one command. Compare fixes against the
   original with `git diff --stat HEAD~1`; undo everything with
   `git reset --hard HEAD~1`. Never merge a branch carrying that commit. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FAULTS = [
  { file: 'extension/content.js',    from: 'turns.splice(1, 1);',                      to: 'turns.splice(0, 1);' },
  { file: 'worker/src/index.js',     from: "const why = !ACTION_OPENERS.test(label) ? 'no production verb'", to: "const why = !ACTION_OPENERS.test(label.replace(/^\\w+\\s*/, '')) ? 'no production verb'" },
  { file: 'extension/background.js', from: 'Date.now() - Number(p.t || 0) > BRIEF_TTL_MS', to: 'Date.now() - Number(p.t || 0) < BRIEF_TTL_MS' },
  { file: 'worker/src/index.js',     from: 'const REPLIES_PER_DAY = 20;',                to: 'const REPLIES_PER_DAY = 25;' },
  { file: 'worker/src/index.js',     from: "const reply = String(body.reply || '').slice(0, MAX_REPLY_CHARS);", to: "const reply = String(body.reply || '').slice(0, MIN_REPLY_CHARS);" },
];

const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7);
if (args.includes('--list')) { FAULTS.forEach((f, i) => console.log(`${i + 1}. ${f.file}: ${f.from.slice(0, 60)}`)); process.exit(0); }
const chosen = only ? [FAULTS[Number(only) - 1]] : FAULTS;
for (const f of chosen) {
  const src = readFileSync(f.file, 'utf8');
  if (src.split(f.from).length !== 2) { console.error(`anchor not found exactly once in ${f.file}: ${f.from}`); process.exit(1); }
}
for (const f of chosen) writeFileSync(f.file, readFileSync(f.file, 'utf8').replace(f.from, f.to));
const files = [...new Set(chosen.map(f => f.file))];
if (only || args.includes('--no-commit')) {
  console.log(`planted ${chosen.length} fault(s) in ${files.join(', ')} (uncommitted)`);
} else {
  const git = (...a) => execFileSync('git', a, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
  git('add', '--', ...files);
  git('-c', 'user.name=ab', '-c', 'user.email=ab@local', 'commit', '-q', '--no-verify', '-m', 'ab: planted faults (do not merge)');
  console.log(`planted ${chosen.length} fault(s) in ${files.join(', ')} and committed as ${git('rev-parse', '--short', 'HEAD')}; the working tree is clean. Compare fixes with: git diff --stat HEAD~1`);
}
