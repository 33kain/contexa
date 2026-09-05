/* tokenbrake tests — no Claude Code, no network.
   Run from the tokenbrake/ directory:  node test.mjs

   Spawns guard.js and cli.js as real child processes against a throwaway
   CLAUDE_CONFIG_DIR, feeding them the same stdin shapes Claude Code 2.1.261 was
   observed to send. Written after the first live run: the shipped guard emitted
   a string where Claude Code's per-tool schema wanted the Bash response object,
   the rejection was logged only at debug level, and every transcript stayed
   full-size while `status` said "installed". Nothing in a sandbox could see
   that; this file pins the shape so it cannot regress unnoticed. */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fails = [];
const t = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!cond) fails.push(name);
};

const CFG = mkdtempSync(join(tmpdir(), 'tokenbrake-test-'));
const PROJ = join(CFG, 'proj');
mkdirSync(PROJ, { recursive: true });
const env = { ...process.env, CLAUDE_CONFIG_DIR: CFG };

const guard = (mode, input) => spawnSync(process.execPath, ['./guard.js', mode], {
  input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8', env
});
const cli = (args, cwd = PROJ) => spawnSync(process.execPath, [join(process.cwd(), 'cli.js'), ...args], { encoding: 'utf8', env, cwd });
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

/* The Bash response shape as Claude Code sends it (five keys; the fifth was not in
   the docs and was learned from the raw stdin). Preserving all of it is the point. */
const bashResp = (stdout, stderr = '') => ({ stdout, stderr, interrupted: false, isImage: false, noOutputExpected: false });
const noisy = Array.from({ length: 400 }, (_, i) => {
  const n = i + 1;
  if (n === 150) return 'ERROR: seeded failure alpha at line 150';
  if (n === 220) return 'warning: seeded warning beta at line 220';
  if (n === 301) return 'Exception: seeded gamma at line 301';
  return `line ${n} filler text to make the output long enough to trip the guard`;
}).join('\n');

{
  console.log('\n-- PostToolUse: oversized Bash output');
  const r = guard('post', { session_id: 'sess-1', tool_use_id: 'toolu_01TESTTESTTEST', tool_name: 'Bash',
    tool_input: { command: 'cat noisy.txt' }, tool_response: bashResp(noisy) });
  t('exits 0', r.status === 0, `status=${r.status}`);
  const out = parse(r.stdout);
  const u = out && out.hookSpecificOutput && out.hookSpecificOutput.updatedToolOutput;
  t('emits hookSpecificOutput.updatedToolOutput with hookEventName', !!u && out.hookSpecificOutput.hookEventName === 'PostToolUse');
  /* The regression. Claude Code validates updatedToolOutput against the tool's own
     response schema; for Bash that is an object, and a string is dropped silently. */
  t('updatedToolOutput is an object, not a string', u !== null && typeof u === 'object');
  t('every key of the incoming tool_response survives',
    !!u && ['stdout', 'stderr', 'interrupted', 'isImage', 'noOutputExpected'].every(k => k in u));
  t('trimmed text is in stdout and is much shorter', !!u && u.stdout.length < noisy.length / 3, u && `${noisy.length} -> ${u.stdout.length}`);
  t('stdout carries the tokenbrake marker with the omitted count', !!u && /\[tokenbrake\] 320 lines omitted here/.test(u.stdout));
  t('head and tail are the real first and last lines', !!u && u.stdout.startsWith('line 1 filler') && u.stdout.trimEnd().endsWith('line 400 filler text to make the output long enough to trip the guard'));
  t('all three seeded lines from the omitted middle are kept, numbered',
    !!u && /L150: ERROR: seeded failure alpha/.test(u.stdout) && /L220: warning: seeded warning beta/.test(u.stdout) && /L301: Exception: seeded gamma/.test(u.stdout));
  t('stays under the 10,000-char hook output cap', !!u && JSON.stringify(out).length < 10000);
  const saved = u && (u.stdout.match(/Full output saved to (\S+\.txt)/) || [])[1];
  t('names the saved full-output file and it holds the full text', !!saved && existsSync(saved) && readFileSync(saved, 'utf8') === noisy);
  const ledger = readFileSync(join(CFG, 'tokenbrake', 'ledger.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const rec = ledger[ledger.length - 1];
  t('ledger row records chars, kept and saved', rec.ev === 'post' && rec.tool === 'Bash' && rec.chars === noisy.length && rec.kept === u.stdout.length && rec.saved === saved);
}

{
  console.log('\n-- PostToolUse: stderr is folded into the trimmed stdout, not lost');
  const r = guard('post', { tool_name: 'Bash', tool_input: { command: 'x' }, tool_response: bashResp('y\n'.repeat(4000), 'npm ERR! the real problem') });
  const u = parse(r.stdout).hookSpecificOutput.updatedToolOutput;
  t('stderr text appears in stdout', u.stdout.includes('npm ERR! the real problem'));
  t('and stderr itself is blanked so it is not counted twice', u.stderr === '');
}

{
  console.log('\n-- PostToolUse: leaves everything else alone');
  let r = guard('post', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: bashResp('a\nb') });
  t('small Bash output: exit 0, no stdout', r.status === 0 && r.stdout === '');
  r = guard('post', { tool_name: 'Read', tool_input: { file_path: '/x' }, tool_response: { type: 'text', file: { content: 'z'.repeat(50000) } } });
  t('large non-shell result: exit 0, no stdout (only logged)', r.status === 0 && r.stdout === '');
  r = guard('post', { tool_name: 'Bash', tool_input: { command: 'x' }, tool_response: 'y\n'.repeat(5000) });
  const u = parse(r.stdout).hookSpecificOutput.updatedToolOutput;
  t('a string-typed tool_response still gets a string back', typeof u === 'string' && u.includes('[tokenbrake]'));
  r = guard('post', 'this is not json');
  t('garbage stdin: exit 0, no stdout (fails open)', r.status === 0 && r.stdout === '');
  r = guard('post', '');
  t('empty stdin: exit 0, no stdout', r.status === 0 && r.stdout === '');
}

{
  console.log('\n-- PreToolUse Read cap');
  const big = join(PROJ, 'big.txt');
  writeFileSync(big, Array.from({ length: 12000 }, (_, i) => `bigline ${i + 1}`).join('\n') + '\n');
  let r = guard('read-pre', { tool_name: 'Read', tool_input: { file_path: big } });
  const out = parse(r.stdout);
  const h = out && out.hookSpecificOutput;
  t('unbounded Read of a large file: exit 0 with PreToolUse output', r.status === 0 && !!h && h.hookEventName === 'PreToolUse');
  t('updatedInput keeps file_path and adds limit 300', !!h && h.updatedInput.file_path === big && h.updatedInput.limit === 300);
  t('additionalContext states the real size as a fact', !!h && /12,000 lines/.test(h.additionalContext) && /KB/.test(h.additionalContext));
  r = guard('read-pre', { tool_name: 'Read', tool_input: { file_path: big, limit: 50 } });
  t('bounded Read: no output', r.status === 0 && r.stdout === '');
  r = guard('read-pre', { tool_name: 'Read', tool_input: { file_path: big, offset: 4000 } });
  t('Read with an offset: no output', r.status === 0 && r.stdout === '');
  r = guard('read-pre', { tool_name: 'Read', tool_input: { file_path: join(PROJ, 'nope.txt') } });
  t('missing file: no output (Read reports it)', r.status === 0 && r.stdout === '');
  r = guard('read-pre', { tool_name: 'Read', tool_input: { file_path: big.replace(/\.txt$/, '.pdf') } });
  t('paged formats are skipped by extension', r.status === 0 && r.stdout === '');
}

{
  console.log('\n-- cli: init / status / uninstall');
  writeFileSync(join(CFG, 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(ls)'] }, hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo theirs' }] }] } }));
  let r = cli(['init']);
  t('init exits 0', r.status === 0, r.stderr);
  const s = JSON.parse(readFileSync(join(CFG, 'settings.json'), 'utf8'));
  const ours = (ev) => (s.hooks[ev] || []).filter(g => g.hooks.some(h => (h.args || []).some(a => a.includes('tokenbrake'))));
  t('one PostToolUse group with matcher *', ours('PostToolUse').length === 1 && ours('PostToolUse')[0].matcher === '*');
  t('one PreToolUse group with matcher Read', ours('PreToolUse').length === 1 && ours('PreToolUse')[0].matcher === 'Read');
  const post = ours('PostToolUse')[0].hooks[0];
  t('exec form: args present, guard path absolute, mode is the second arg', Array.isArray(post.args) && post.args[0] === join(CFG, 'hooks', 'tokenbrake', 'guard.js') && post.args[1] === 'post');
  /* Exec form spawns the command without a shell, so a bare 'node' depends on the
     PATH Claude Code itself was started with. User scope records this node's path. */
  t('user scope records the absolute path of the installing node', post.command === process.execPath);
  t('guard.js was copied next to settings', existsSync(join(CFG, 'hooks', 'tokenbrake', 'guard.js')));
  t('pre-existing hook group and permissions untouched',
    s.permissions.allow[0] === 'Bash(ls)' && s.hooks.PostToolUse.some(g => g.hooks[0].command === 'echo theirs'));
  r = cli(['init']);
  t('init is idempotent (re-run does not duplicate groups)', JSON.parse(readFileSync(join(CFG, 'settings.json'), 'utf8')).hooks.PostToolUse.length === 2);

  r = cli(['status']);
  t('status exits 0', r.status === 0, r.stderr);
  t('status reports both hooks installed', /PostToolUse guard: installed/.test(r.stdout) && /PreToolUse Read cap: installed/.test(r.stdout));
  /* The spawn test is the check the Windows node-resolution risk needed: it starts
     the recorded command with the recorded args and no shell, as Claude Code will. */
  t('status spawns the PostToolUse hook and sees an object-shaped trim', /PostToolUse spawn test \(.*\): ok \(/.test(r.stdout), r.stdout.split('\n').find(l => /PostToolUse spawn/.test(l)));
  t('status spawns the PreToolUse hook', /PreToolUse spawn test \(.*\): ok/.test(r.stdout));
  const ledgerLines = readFileSync(join(CFG, 'tokenbrake', 'ledger.jsonl'), 'utf8').trim().split('\n').length;
  r = cli(['status']);
  t('status does not write to the ledger', readFileSync(join(CFG, 'tokenbrake', 'ledger.jsonl'), 'utf8').trim().split('\n').length === ledgerLines);

  r = cli(['init', '--node=/definitely/not/a/node']);
  r = cli(['status']);
  t('a command that cannot be spawned is reported as FAILED to start, not as installed-and-fine', /spawn test .*: FAILED to start: ENOENT/.test(r.stdout));

  r = cli(['init', '--project']);
  const ps = JSON.parse(readFileSync(join(PROJ, '.claude', 'settings.json'), 'utf8'));
  const ph = ps.hooks.PostToolUse[0].hooks[0];
  t('--project writes .claude/settings.json with the ${CLAUDE_PROJECT_DIR} placeholder and plain node',
    ph.args[0] === '${CLAUDE_PROJECT_DIR}/.claude/hooks/tokenbrake/guard.js' && ph.command === 'node');
  t('--project copies guard.js under .claude/hooks', existsSync(join(PROJ, '.claude', 'hooks', 'tokenbrake', 'guard.js')));
  r = cli(['status', '--project']);
  t('status --project resolves the placeholder and spawns', /PostToolUse spawn test \(node\): ok \(/.test(r.stdout), r.stdout.split('\n').find(l => /PostToolUse spawn/.test(l)));

  r = cli(['uninstall']);
  const after = JSON.parse(readFileSync(join(CFG, 'settings.json'), 'utf8'));
  t('uninstall removes only our groups', after.hooks.PostToolUse.length === 1 && after.hooks.PostToolUse[0].hooks[0].command === 'echo theirs' && !after.hooks.PreToolUse);
  t('uninstall leaves permissions and the ledger', after.permissions.allow[0] === 'Bash(ls)' && existsSync(join(CFG, 'tokenbrake', 'ledger.jsonl')));
  t('uninstall removes the guard copy', !existsSync(join(CFG, 'hooks', 'tokenbrake', 'guard.js')));
}

{
  console.log('\n-- report');
  const r = cli(['report', '--all']);
  t('report exits 0 and shows the trimmed session', r.status === 0 && /Trimmed by tokenbrake: [1-9]/.test(r.stdout) && /cat noisy\.txt/.test(r.stdout));
}

rmSync(CFG, { recursive: true, force: true });
console.log(fails.length ? '\nFAILED: ' + fails.join(', ') : '\nall tokenbrake checks passed');
process.exit(fails.length ? 1 : 0);
