/* CONTEXA probe v3 — locate the chrome, 2026-08-22
   Read-only. BROWSER CONSOLE (F12) on a claude.ai tab. Never PowerShell.

   v2 proved chrome survives captureText on both surfaces. It could not say
   WHICH element holds it, and SKIP_TAGS is tag-based so "skip the div" is not
   a fix — it needs a selector.

   Method: for each chrome string, find the DEEPEST element containing it (the
   one whose children do not), then print its ancestor chain. That chain is the
   selector. Also reports whether each copy sits inside a BUTTON, which is how
   the same text can appear twice with only one copy surviving. */
(() => {
  const SKIP_TAGS = new Set(['BUTTON', 'SVG', 'STYLE', 'SCRIPT', 'NOSCRIPT']);
  const L = (...a) => console.log('[CX PROBE3]', ...a);
  const desc = el => {
    if (!el || !el.tagName) return '(none)';
    const id = el.getAttribute('data-testid');
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + cls + (id ? `[data-testid=${id}]` : '');
  };

  const target = document.querySelector('.font-claude-response:last-of-type')
    || [...document.querySelectorAll('.font-claude-response')].pop();
  if (!target) { L('no capture target here'); return; }
  L('================ path:', location.pathname);
  L('target:', desc(target));

  /* Every chrome string seen across both surfaces in v2, plus the two the v2
     detector was missing — its "none" for chat was a gap in the patterns, not a
     clean page, and a v3 that repeated the gap would repeat the wrong answer. */
  const NEEDLES = [
    'Ran ', 'used ', 'created a file', 'Thought for',
    'Searched the web', 'visualize', 'Connecting to', 'Download'
  ];

  for (const needle of NEEDLES) {
    const all = [...target.querySelectorAll('*')]
      .filter(el => (el.textContent || '').includes(needle));
    // Deepest holder = contains it, none of its children do.
    const holders = all.filter(el => ![...el.children].some(c => (c.textContent || '').includes(needle)));
    if (!holders.length) continue;

    L('--------------------------------');
    L('needle:', JSON.stringify(needle), '| holders:', holders.length);
    holders.slice(0, 4).forEach((el, i) => {
      const chain = [];
      let n = el, skipped = false;
      for (let d = 0; d < 5 && n && n !== target; d++) {
        if (SKIP_TAGS.has(n.tagName)) skipped = true;
        chain.push(desc(n));
        n = n.parentElement;
      }
      L(`  [${i}] ${skipped ? 'SKIPPED by SKIP_TAGS' : '>>> SURVIVES into the capture'}`);
      L('      chain:', chain.join('  <  '));
      L('      text :', JSON.stringify((el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90)));
    });
  }

  /* The candidate fix, evaluated against this page rather than assumed. If the
     count of surviving holders drops to zero under this selector, it is the
     fix; if not, the chain printed above names what it is still missing. */
  const CANDIDATE = '[data-testid^="tool-status"], [class*="artifact-block"], [class*="tool-status"]';
  const covered = [...target.querySelectorAll(CANDIDATE)];
  L('================');
  L('candidate SKIP_SEL:', CANDIDATE);
  L('elements it would remove:', covered.length,
    covered.length ? '| ' + [...new Set(covered.map(desc))].slice(0, 8).join('  ') : '');
  let stillThere = 0;
  for (const needle of NEEDLES) {
    const all = [...target.querySelectorAll('*')].filter(el => (el.textContent || '').includes(needle));
    const holders = all.filter(el => ![...el.children].some(c => (c.textContent || '').includes(needle)));
    for (const el of holders) {
      let n = el, skipped = false;
      while (n && n !== target) {
        if (SKIP_TAGS.has(n.tagName) || n.matches(CANDIDATE)) { skipped = true; break; }
        n = n.parentElement;
      }
      if (!skipped) { stillThere++; L('STILL SURVIVES:', JSON.stringify(needle), 'in', desc(el)); }
    }
  }
  L(stillThere === 0
    ? 'candidate selector covers every chrome string on this page'
    : `candidate selector leaves ${stillThere} holder(s) — see the chains above`);
  L('================ end');
})();
