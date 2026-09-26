#!/usr/bin/env node
/* Print a snippet to paste into the DevTools console on a live claude.ai
   conversation. It is generated from extension/content.js's CURRENT selector
   constants, so it cannot drift from what the extension ships.

     node .claude/skills/selector-check/probe.mjs

   The snippet only reads the page (querySelectorAll, getAttribute) and prints
   one table: each selector, how many elements match, and a sample. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const src = readFileSync(join(ROOT, 'extension/content.js'), 'utf8');
const die = m => { console.error('probe.mjs: ' + m); process.exit(1); };

const one = name => {
  const m = src.match(new RegExp(`const ${name} = ('(?:[^'\\\\]|\\\\.)*')`));
  if (!m) die(`${name} not found in content.js — did its declaration change shape?`);
  return eval(m[1]);   // a single-quoted string literal from our own source
};
const list = src.match(/const SELECTORS = \[([\s\S]*?)\];/);
if (!list) die('SELECTORS not found in content.js');
const composer = [...list[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]);

const checks = {
  RESPONSE_SEL: one('RESPONSE_SEL'),
  STREAM_SEL: one('STREAM_SEL'),
  USER_MSG_SEL: one('USER_MSG_SEL'),
  ROW_SEL: one('ROW_SEL'),
  SKIP_SEL: one('SKIP_SEL'),
  MODEL_SEL: one('MODEL_SEL'),
};

const snippet = `/* CONTEXA selector probe — generated from content.js; read-only */
(() => {
  const composer = ${JSON.stringify(composer)};
  const checks = ${JSON.stringify(checks, null, 2)};
  const sample = el => el ? (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60) : '';
  const rows = [];
  composer.forEach((s, i) => {
    const els = document.querySelectorAll(s);
    rows.push({ name: 'SELECTORS[' + i + ']', selector: s, count: els.length, sample: sample(els[0]) });
  });
  for (const [name, s] of Object.entries(checks)) {
    const els = document.querySelectorAll(s);
    rows.push({ name, selector: s, count: els.length,
      sample: name === 'STREAM_SEL' ? [...els].map(e => e.getAttribute('data-is-streaming')).join(',') : sample(els[els.length - 1]) });
  }
  rows.push({ name: 'html[data-mode]', selector: 'html', count: 1, sample: document.documentElement.getAttribute('data-mode') });
  console.table(rows);
  const none = rows.filter(r => !r.count).map(r => r.name);
  return 'CONTEXA probe: ' + (none.length ? none.join(', ') + ' matched nothing' : 'every selector matched');
})();`;
console.log(snippet);
