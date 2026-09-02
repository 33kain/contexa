#!/usr/bin/env node
/* CONTEXA on Claude Code — prototype CLI. See README.md.

   Two subcommands, both plain stdin/stdout JSON so the calling skill (or a
   human) can pipe into and out of them without this file knowing anything
   about how it is invoked:

     node cli.mjs extract <transcript.jsonl>
       -> { turns: [{i,text}], reply } read from a Claude Code session transcript.

     node cli.mjs gate <turns.json> <reply.txt>  (raw moves JSON on stdin)
       -> { moves, grounding } after cleanMoves / groundMoves / enforceAction. */

import { readFileSync } from 'node:fs';
import {
  extractFromTranscript, cleanTurns, cleanMoves, groundMoves, enforceAction, turnsSection
} from './lib.mjs';

const [, , cmd, ...args] = process.argv;

function readStdin() {
  return readFileSync(0, 'utf8');
}

if (cmd === 'extract') {
  const [transcriptPath] = args;
  if (!transcriptPath) { console.error('usage: cli.mjs extract <transcript.jsonl>'); process.exit(2); }
  const { turns, reply } = extractFromTranscript(readFileSync(transcriptPath, 'utf8'));
  process.stdout.write(JSON.stringify({ turns, reply }, null, 2) + '\n');

} else if (cmd === 'gate') {
  const [turnsPath, replyPath] = args;
  if (!turnsPath || !replyPath) { console.error('usage: cli.mjs gate <turns.json> <reply.txt>  (raw moves JSON on stdin)'); process.exit(2); }
  const rawTurns = JSON.parse(readFileSync(turnsPath, 'utf8'));
  const reply = readFileSync(replyPath, 'utf8');
  const turns = cleanTurns(rawTurns);
  let rawMoves;
  try { rawMoves = JSON.parse(readStdin()).moves; }
  catch (e) { console.error('stdin was not {"moves":[...]} JSON: ' + e.message); process.exit(2); }

  const cleaned = cleanMoves(rawMoves);
  const g0 = groundMoves(cleaned, turnsSection(turns), reply);
  const { moves, ground, droppedByAction } = enforceAction(cleaned, g0);
  const emptiedBy = (Array.isArray(rawMoves) ? rawMoves.length : 0) > 0 && moves.length === 0 ? 'action' : null;

  process.stdout.write(JSON.stringify({
    moves,
    grounding: {
      total: Array.isArray(rawMoves) ? rawMoves.length : 0,
      kept: moves.length,
      grounded: ground.grounded,
      fromTurns: ground.fromTurns,
      fromReply: ground.fromReply,
      droppedByAction,
      emptiedBy
    }
  }, null, 2) + '\n');

} else {
  console.error('usage:\n  cli.mjs extract <transcript.jsonl>\n  cli.mjs gate <turns.json> <reply.txt>  (raw moves JSON on stdin)');
  process.exit(2);
}
