#!/usr/bin/env node
/* List every top-level function and const defined in BOTH extension/background.js
   and worker/src/index.js, and say whether the two definitions are byte-identical.
   build.mjs checks the helper block, cachedSystem, usageOf and the prompts; this
   shows the rest (trimPayload, turnsSection, extractJson, ...) too.

     node .claude/skills/parity-fix/parity.mjs          # summary
     node .claude/skills/parity-fix/parity.mjs <name>   # diff of one definition */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = f => readFileSync(join(ROOT, f), 'utf8');
const ext = read('extension/background.js'), wrk = read('worker/src/index.js');

/* A top-level definition runs from its first line to the next line that starts
   in column 0 with something other than whitespace or a closing brace/paren. */
function defs(src) {
  const lines = src.split('\n'), out = new Map();
  const head = /^(?:async\s+)?(?:function\s+([A-Za-z0-9_$]+)|const\s+([A-Za-z0-9_$]+)\s*=)/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(head);
    if (!m) continue;
    // Inside a template literal (the prompts) every line belongs, whatever its indent.
    let tick = (lines[i].match(/`/g) || []).length % 2, j = i + 1;
    while (j < lines.length && (tick || lines[j] === '' || /^[\s})\]`]/.test(lines[j]))) {
      tick = (tick + (lines[j].match(/`/g) || []).length) % 2;
      j++;
    }
    out.set(m[1] || m[2], { line: i + 1, body: lines.slice(i, j).join('\n').trimEnd() });
  }
  return out;
}
const E = defs(ext), W = defs(wrk);
const shared = [...E.keys()].filter(k => W.has(k)).sort();
const only = process.argv[2];

if (only) {
  if (!E.has(only) || !W.has(only)) { console.error(`${only} is not defined in both files`); process.exit(1); }
  const d = mkdtempSync(join(tmpdir(), 'parity-'));
  writeFileSync(join(d, 'extension'), E.get(only).body + '\n');
  writeFileSync(join(d, 'worker'), W.get(only).body + '\n');
  try { execFileSync('diff', ['-u', join(d, 'extension'), join(d, 'worker')], { stdio: 'inherit' }); console.log('identical'); }
  catch { process.exit(1); }
} else {
  let differ = 0;
  for (const k of shared) {
    const same = E.get(k).body === W.get(k).body;
    if (!same) differ++;
    console.log(`${same ? 'same  ' : 'DIFFER'}  ${k.padEnd(28)} ext:${E.get(k).line}  wrk:${W.get(k).line}`);
  }
  console.log(`\n${shared.length} shared definitions, ${differ} differ`);
}
