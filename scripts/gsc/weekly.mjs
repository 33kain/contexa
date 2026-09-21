#!/usr/bin/env node
/* Weekly Search Console report for the CONTEXA site.

   Pulls the last complete week and the week before it from the Search
   Console API and writes one Markdown file: totals with deltas, top queries,
   new and lost queries, pages, and position movers. No dependencies, no model
   call — the numbers are the report; reading them is a person's job.

   Auth is a Google service account whose e-mail has been added as a user on
   the Search Console property (see README.md). The key file never lives in
   this repository.

     node scripts/gsc/weekly.mjs                       # live, writes seo/reports/<end>.md
     node scripts/gsc/weekly.mjs --stdout              # live, prints instead
     node scripts/gsc/weekly.mjs --fixture f.json      # offline render, for checking the format

   Options: --site <property>  (default https://contexa-website.pages.dev/)
            --key <path>       (default $GSC_KEY, else ~/.config/contexa/gsc-key.json)
            --out <dir>        (default seo/reports)
            --lag <days>       (default 3; Search Console's final data trails by 2-3 days)
*/

import { createSign } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const SITE = opt('site', 'https://contexa-website.pages.dev/');
const KEY = opt('key', process.env.GSC_KEY || join(homedir(), '.config', 'contexa', 'gsc-key.json'));
const OUT = opt('out', 'seo/reports');
const LAG = Number(opt('lag', '3'));
const FIXTURE = opt('fixture', null);

/* Below this many impressions in a week, movement is noise: the report still
   lists the numbers but says so instead of flagging anything. */
const MIN_IMPRESSIONS = 100;
/* A query counts as a mover only with this many impressions in both weeks
   and a position change of at least MOVE_POSITIONS. */
const MOVER_IMPRESSIONS = 20;
const MOVE_POSITIONS = 3;

/* ---------- dates (UTC, YYYY-MM-DD) ---------- */

const day = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

function weeks(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = addDays(today, -LAG);
  const start = addDays(end, -6);
  return {
    current: { start: day(start), end: day(end) },
    previous: { start: day(addDays(start, -7)), end: day(addDays(start, -1)) },
  };
}

/* ---------- Search Console API ---------- */

const b64url = (s) => Buffer.from(s).toString('base64url');

async function accessToken(keyPath) {
  const key = JSON.parse(readFileSync(keyPath, 'utf8'));
  const iat = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  }));
  const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${head}.${claims}.${sig}`,
    }),
  });
  if (!res.ok) throw new Error(`token: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function query(token, range, dimensions) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ startDate: range.start, endDate: range.end, dimensions, rowLimit: 250, dataState: 'final' }),
  });
  if (!res.ok) throw new Error(`searchAnalytics ${dimensions.join(',') || 'totals'}: ${res.status} ${await res.text()}`);
  const rows = (await res.json()).rows || [];
  return rows.map((r) => ({ key: r.keys ? r.keys[0] : '', clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
}

async function week(token, range) {
  const [totals] = await query(token, range, []);
  return {
    ...range,
    totals: totals || { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    queries: await query(token, range, ['query']),
    pages: await query(token, range, ['page']),
  };
}

/* ---------- report ---------- */

const n = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const pos = (x) => (x ? x.toFixed(1) : '-');
const signed = (x, f = n) => (x > 0 ? `+${f(x)}` : x < 0 ? `-${f(-x)}` : '0');
const esc = (s) => s.replace(/\|/g, '\\|');
const path = (u) => u.replace(/^https?:\/\/[^/]+/, '') || '/';

function table(head, rows) {
  if (!rows.length) return '_none_\n';
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n') + '\n';
}

function render(cur, prev) {
  const byKey = (rows) => new Map(rows.map((r) => [r.key, r]));
  const pq = byKey(prev.queries);
  const cq = byKey(cur.queries);
  const pp = byKey(prev.pages);
  const byImpr = (a, b) => b.impressions - a.impressions;
  const t = cur.totals, u = prev.totals;
  // Lower position is better, so a negative delta is an improvement.
  const posDelta = (c, p) => (c && p && c.position && p.position ? c.position - p.position : null);

  const out = [];
  out.push(`# Search Console — ${cur.start} to ${cur.end}`, '');
  out.push(`Site: ${SITE}. Compared with ${prev.start} to ${prev.end}. Position: lower is better.`, '');
  if (t.impressions < MIN_IMPRESSIONS) {
    out.push(`> **Too little data to read movement** (${t.impressions} impressions this week, threshold ${MIN_IMPRESSIONS}). The numbers are listed; none of them is a trend.`, '');
  }

  out.push('## Totals', '');
  out.push(table(['', 'this week', 'previous', 'change'], [
    ['Clicks', n(t.clicks), n(u.clicks), signed(t.clicks - u.clicks)],
    ['Impressions', n(t.impressions), n(u.impressions), signed(t.impressions - u.impressions)],
    ['CTR', pct(t.ctr), pct(u.ctr), signed(t.ctr - u.ctr, (x) => `${(x * 100).toFixed(1)} pp`)],
    ['Avg position', pos(t.position), pos(u.position), t.position && u.position ? signed(t.position - u.position) : '-'],
  ]));

  out.push('## Top queries', '');
  out.push(table(['query', 'clicks', 'impr.', 'CTR', 'pos.', 'pos. change'],
    [...cur.queries].sort(byImpr).slice(0, 15).map((r) => {
      const d = posDelta(r, pq.get(r.key));
      return [esc(r.key), n(r.clicks), n(r.impressions), pct(r.ctr), pos(r.position), d === null ? 'new' : signed(d)];
    })));

  out.push('## New queries', '', 'Seen this week, not the week before.', '');
  out.push(table(['query', 'impr.', 'pos.'],
    cur.queries.filter((r) => !pq.has(r.key)).sort(byImpr).slice(0, 10).map((r) => [esc(r.key), n(r.impressions), pos(r.position)])));

  out.push('## Lost queries', '', 'Seen the week before, not this week.', '');
  out.push(table(['query', 'impr. before', 'pos. before'],
    prev.queries.filter((r) => !cq.has(r.key)).sort(byImpr).slice(0, 10).map((r) => [esc(r.key), n(r.impressions), pos(r.position)])));

  out.push('## Movers', '', `At least ${MOVER_IMPRESSIONS} impressions in both weeks and a position change of ${MOVE_POSITIONS} or more.`, '');
  out.push(table(['query', 'pos. before', 'pos. now', 'change'],
    cur.queries
      .map((r) => ({ r, p: pq.get(r.key) }))
      .filter(({ r, p }) => p && r.impressions >= MOVER_IMPRESSIONS && p.impressions >= MOVER_IMPRESSIONS && Math.abs(r.position - p.position) >= MOVE_POSITIONS)
      .sort((a, b) => Math.abs(b.r.position - b.p.position) - Math.abs(a.r.position - a.p.position))
      .map(({ r, p }) => [esc(r.key), pos(p.position), pos(r.position), signed(r.position - p.position)])));

  out.push('## Pages', '');
  out.push(table(['page', 'clicks', 'impr.', 'pos.', 'clicks change', 'impr. change'],
    [...cur.pages].sort(byImpr).map((r) => {
      const p = pp.get(r.key);
      return [path(r.key), n(r.clicks), n(r.impressions), pos(r.position),
        p ? signed(r.clicks - p.clicks) : 'new', p ? signed(r.impressions - p.impressions) : 'new'];
    })));

  return out.join('\n');
}

/* ---------- main ---------- */

let cur, prev;
if (FIXTURE) {
  ({ current: cur, previous: prev } = JSON.parse(readFileSync(FIXTURE, 'utf8')));
} else {
  const w = weeks();
  const token = await accessToken(KEY);
  cur = await week(token, w.current);
  prev = await week(token, w.previous);
}

const md = render(cur, prev);
if (flag('stdout')) {
  process.stdout.write(md);
} else {
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `${cur.end}.md`);
  writeFileSync(file, md);
  console.log(file);
}
