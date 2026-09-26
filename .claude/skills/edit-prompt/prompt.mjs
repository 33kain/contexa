#!/usr/bin/env node
/* Extract or inject MOVES_SYSTEM / FORK_SYSTEM in both copies at once, so the
   two are byte-identical by construction, not by discipline.

     node .claude/skills/edit-prompt/prompt.mjs extract MOVES_SYSTEM out.txt
     node .claude/skills/edit-prompt/prompt.mjs inject  MOVES_SYSTEM out.txt

   extract refuses if the two copies already differ. inject refuses text that
   would break the template literal or build.mjs's extraction regex (a backtick,
   or `${`), and writes both files or neither. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FILES = ['extension/background.js', 'worker/src/index.js'].map(f => join(ROOT, f));
const NAMES = ['MOVES_SYSTEM', 'FORK_SYSTEM'];
const [mode, name, path] = process.argv.slice(2);
const die = msg => { console.error('prompt.mjs: ' + msg); process.exit(1); };

if (!['extract', 'inject'].includes(mode) || !NAMES.includes(name) || !path)
  die('usage: prompt.mjs extract|inject MOVES_SYSTEM|FORK_SYSTEM <file>');

// Same pattern build.mjs uses: from `NAME = \`` to the first "`;".
const re = new RegExp('(const ' + name + ' = `)([\\s\\S]*?)(`;)');
const srcs = FILES.map(f => readFileSync(f, 'utf8'));
const found = srcs.map((s, i) => {
  const m = s.match(re);
  if (!m) die(`${name} not found in ${FILES[i]}`);
  return m[2];
});

if (mode === 'extract') {
  if (found[0] !== found[1]) die(`${name} already differs between the two files; fix that first (git diff / npm run build)`);
  writeFileSync(path, found[0]);
  console.log(`extracted ${name} (${found[0].length} chars) -> ${path}`);
} else {
  let text = readFileSync(path, 'utf8');
  if (text.includes('`')) die('text contains a backtick; it would end the template literal');
  if (text.includes('${')) die('text contains "${"; it would interpolate');
  if (text.includes('\r')) die('text contains CR line endings; save it with LF');
  if (text === found[0] && text === found[1]) { console.log(`${name} unchanged`); process.exit(0); }
  // Function replacer: a "$&" or "$1" in the prompt must stay literal.
  srcs.forEach((s, i) => writeFileSync(FILES[i], s.replace(re, (_, a, _b, c) => a + text + c)));
  console.log(`injected ${name} (${text.length} chars) into both files; now run npm run build`);
}
