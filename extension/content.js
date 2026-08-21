/* CONTEXA — content script for claude.ai.
   One job: when Claude finishes a reply, offer five logical next steps.
   Click one to load it into the composer. Nothing overlays the composer, and
   nothing is rendered unless it is real. If the DOM shape changes, the script
   goes quiet rather than breaking the page. */

(() => {
  if (window.__contexaLoaded) return;
  window.__contexaLoaded = true;

  let settings = { enabled: true, apiKey: '', model: 'claude-sonnet-5' };
  let composer = null;
  let replyObserver = null;
  let tickTimer = null;

  /* Chrome auto-updates extensions silently. When that happens, THIS script keeps
     running in the page but its link to the extension is severed — chrome.runtime.id
     goes undefined and every chrome.* call throws "Extension context invalidated".
     Detect it and tell the user to reload, rather than surfacing a raw error. */
  const contextAlive = () => {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; }
  };
  /* Every phrasing Chrome uses when the extension side of a conversation dies —
     context torn down, no receiver, port closed, or (the one that slipped
     through in the field) "message CHANNEL closed", which is what an in-flight
     request reports when the extension is reloaded mid-generation. All of them
     mean the same thing to the user: the page's copy of CONTEXA is orphaned and
     a refresh reconnects it. A phrasing this regex misses renders as raw
     plumbing text, so it is pinned by a test with Chrome's exact strings. */
  const isStaleError = e =>
    /context invalidated|Receiving end does not exist|message (port|channel) (is )?closed/i.test(String(e || ''));

  // Once orphaned, stop the polling loop (it would throw every 900ms) but KEEP
  // the reply observer alive, otherwise the next reply renders nothing at all and
  // the user gets silence instead of being told to reload. Fully stand down only
  // after the notice has actually been delivered.
  let staleNotified = false;
  function standDown(keepObserver) {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (!keepObserver && replyObserver) { replyObserver.disconnect(); replyObserver = null; }
  }

  /* ---------------- claude.ai DOM (verified Aug 2026) --------------------- */
  // composer: div.ProseMirror.tiptap[contenteditable][aria-label="Write your prompt to Claude"]
  const SELECTORS = [
    'div[contenteditable="true"].ProseMirror',
    'div[contenteditable="true"].tiptap',
    'div[contenteditable="true"][aria-label*="prompt" i]',
    'fieldset div[contenteditable="true"]',
    'div[contenteditable="true"][aria-label]',
    'div[contenteditable="true"]'
  ];
  const RESPONSE_SEL = '.font-claude-response';   // assistant reply body
  const STREAM_SEL = '[data-is-streaming]';      // wraps reply; "true" -> "false" when done
  const USER_MSG_SEL = '[data-testid="user-message"]';
  const ROW_SEL = '[class*="group/message-row"]'; // per-turn boundary

  const area = el => { const r = el.getBoundingClientRect(); return r.width * r.height; };
  const visible = el => {
    const r = el.getBoundingClientRect();
    return r.width > 120 && r.height > 12 && el.offsetParent !== null; // empty composer is ~20px
  };
  function findComposer() {
    for (const sel of SELECTORS) {
      const els = [...document.querySelectorAll(sel)].filter(visible);
      if (els.length) return els.sort((a, b) => area(b) - area(a))[0];
    }
    return null;
  }

  // claude.ai sets data-mode on <html>; it is authoritative (the page can be
  // light while the OS prefers dark), so only fall back when it is absent.
  const isDark = () => {
    const mode = document.documentElement.getAttribute('data-mode');
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return document.documentElement.classList.contains('dark') ||
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  /* ---------------- styles (compact chips, Shadow DOM) -------------------- */
  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box;margin:0;padding:0;
    font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .wrap{--surface:#FFFFFF;--surface2:#FAF9F5;--text:#3D3929;--text2:#73726C;
    --border:#E8E6DE;--border2:#DEDCD1;--accent:#D97757;--accent-soft:#F5E9E4;
    --amber-bg:#F7F0DF;--amber-text:#8A6A1F;
    display:block;margin:8px 0 16px;max-width:680px;
    opacity:0;transform:translateY(4px);transition:opacity .28s ease,transform .28s ease}
  .wrap[data-theme="dark"]{--surface:#30302E;--surface2:#3A3A37;--text:#EDECE6;
    --text2:#A6A49B;--border:#3F3F3C;--border2:#4A4A46;--accent:#D97757;--accent-soft:#453832;
    --amber-bg:#403823;--amber-text:#E0C382}
  .wrap.show{opacity:1;transform:none}
  .label{display:flex;align-items:center;gap:6px;font-size:9.5px;letter-spacing:.15em;
    text-transform:uppercase;color:var(--text2);margin-bottom:6px}
  .label b{color:var(--accent);font-weight:700;letter-spacing:.17em}
  .chips{display:flex;flex-wrap:wrap;gap:6px}
  .chip{display:inline-flex;align-items:center;background:var(--surface);
    border:1px solid var(--border2);border-radius:999px;padding:5px 12px;cursor:pointer;
    font-size:12px;line-height:1.35;color:var(--text);font-family:inherit;white-space:nowrap;
    max-width:100%;overflow:hidden;text-overflow:ellipsis;
    transition:border-color .14s,color .14s,transform .1s,background .14s}
  .chip:hover{border-color:var(--accent);color:var(--accent);background:var(--surface2);
    transform:translateY(-1px)}
  /* honest states — never fake output */
  .quiet{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--text2);
    line-height:1.45;padding:7px 10px;border:1px dashed var(--border2);border-radius:8px;
    background:transparent}
  .quiet code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px}
  .quiet .diag{display:inline-block;margin-top:2px;font-size:10.5px;opacity:.75}
  .quiet button{margin-left:auto;flex:none;border:1px solid var(--border2);background:transparent;
    color:var(--text2);border-radius:6px;padding:2px 8px;font-size:10px;letter-spacing:.06em;
    text-transform:uppercase;cursor:pointer;font-family:inherit}
  .quiet button:hover{color:var(--accent);border-color:var(--accent)}
  .note{font-size:10.5px;color:var(--amber-text);background:var(--amber-bg);
    border-radius:6px;padding:4px 8px;margin-bottom:5px;line-height:1.4}
  /* the fifth chip: rough ask in, drafted prompt out */
  .chip.own{border-style:dashed;color:var(--text2)}
  .chip.own:hover{color:var(--accent);background:var(--surface2)}
  .chip.busy{border-style:dashed;color:var(--text2);cursor:default;
    animation:cxpulse 1.2s ease-in-out infinite}
  .chip.cxerr{border-style:dashed;color:var(--amber-text);background:var(--amber-bg);
    border-color:transparent}
  .own-input{background:var(--surface);border:1px solid var(--accent);border-radius:999px;
    padding:5px 12px;font-size:12px;line-height:1.35;color:var(--text);width:250px;
    outline:none;font-family:inherit}
  .own-input::placeholder{color:var(--text2)}
  @keyframes cxpulse{0%,100%{opacity:.55}50%{opacity:1}}`;

  const esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };

  /* ---------------- capture ------------------------------------------------ */
  /* What we send to the suggestion model used to be raw textContent, which has
     two defects. Block elements contribute no line break, so adjacent paragraphs
     arrived glued together ("…end of one.Start of next") — degraded input on
     every conversation. And code blocks shipped whole: on a code-heavy reply the
     entire 6,000-char budget filled with raw code, which is exactly the material
     the model then echoed back into oversized steps until it hit the token
     ceiling (measured: three ceiling-hits in one code-heavy conversation, zero
     elsewhere). Walk the DOM instead: real line breaks at block boundaries, code
     collapsed to its first lines — signatures survive as anchors ("fix
     trimPayload") while the bulk stays out — and UI chrome (copy buttons,
     language labels) skipped. Suggestions operate on the shape of the
     conversation, not on every line of code in it. */
  const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'PRE', 'BLOCKQUOTE',
    'TABLE', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BR', 'HR']);
  const SKIP_TAGS = new Set(['BUTTON', 'SVG', 'STYLE', 'SCRIPT', 'NOSCRIPT']);
  const CODE_KEEP_LINES = 2;

  function textSkippingChrome(node) {
    let s = '';
    (function w(n) {
      if (n.nodeType === 3) { s += n.nodeValue; return; }
      if (n.nodeType !== 1 || SKIP_TAGS.has((n.tagName || '').toUpperCase())) return;
      for (const c of n.childNodes) w(c);
    })(node);
    return s;
  }

  function summarizeCode(text) {
    const lines = text.replace(/^\n+|\n+$/g, '').split('\n');
    // Only collapse when it actually saves something; a 3-line snippet is cheaper
    // shipped whole than replaced by two lines plus a marker.
    if (lines.length <= CODE_KEEP_LINES + 1) return lines.join('\n');
    return lines.slice(0, CODE_KEEP_LINES).join('\n')
      + '\n[+' + (lines.length - CODE_KEEP_LINES) + ' more lines of code]';
  }

  function captureText(root) {
    let out = '';
    (function walk(node) {
      if (node.nodeType === 3) { out += node.nodeValue; return; }
      if (node.nodeType !== 1) return;
      const tag = (node.tagName || '').toUpperCase();
      if (SKIP_TAGS.has(tag)) return;
      if (tag === 'PRE') { out += summarizeCode(textSkippingChrome(node)) + '\n'; return; }
      for (const child of node.childNodes) walk(child);
      if (BLOCK_TAGS.has(tag)) out += '\n';
    })(root);
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* SPEC §3.2 — the viewport marker. The suggestion model cannot distinguish
     this clamp from a truncated reply, and its correct response to perceived
     truncation is to requisition the missing text — producing confident chips
     about a defect that does not exist (observed in the field). Mark the edge
     explicitly. Trim THEN append, never append then slice: the worker
     independently slices at 6,000 chars, and a marker riding on top of a
     6,000-char payload would be eaten by that slice, leaving a bare cut again.
     Total output including the marker never exceeds CAPTURE_WINDOW. */
  const CAPTURE_WINDOW = 6000;
  const CAPTURE_MARKER = '\n[capture window ends here — the reply continues beyond this point]';
  const CONTENT_BUDGET = CAPTURE_WINDOW - CAPTURE_MARKER.length;
  function clampCapture(text) {
    const t = String(text || '');
    if (t.length <= CAPTURE_WINDOW) return t;   // no marker when nothing was cut
    let cut = t.slice(0, CONTENT_BUDGET);
    const nl = cut.lastIndexOf('\n');
    if (nl >= CONTENT_BUDGET * 0.8) cut = cut.slice(0, nl);
    else { const sp = cut.lastIndexOf(' '); if (sp > 0) cut = cut.slice(0, sp); }
    return cut.trimEnd() + CAPTURE_MARKER;
  }

  /* ---------------- reply detection --------------------------------------- */
  const processed = new WeakSet();

  function watchReplies() {
    if (replyObserver) replyObserver.disconnect();
    const container = composer.closest('main') || document.body;
    let settleTimer = null;

    const scan = () => {
      const responses = container.querySelectorAll(RESPONSE_SEL);
      if (!responses.length) return;
      const last = responses[responses.length - 1];
      if (processed.has(last)) return;
      const wrap = last.closest(STREAM_SEL);
      if (wrap && wrap.getAttribute('data-is-streaming') === 'true') return; // still streaming
      if ((last.textContent || '').trim().length < 120) return;              // skip one-liners
      processed.add(last);
      onReplyComplete(last);
    };

    replyObserver = new MutationObserver(() => {
      scan();                                 // fast path: streaming flag flipped false
      clearTimeout(settleTimer);
      settleTimer = setTimeout(scan, 1200);   // fallback if the flag is ever absent
    });
    replyObserver.observe(container, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['data-is-streaming']
    });
    scan();
  }

  // Read the user's last message straight from the DOM rather than intercepting
  // keystrokes to guess what was sent.
  function lastUserMessage(replyEl) {
    const msgs = [...document.querySelectorAll(USER_MSG_SEL)];
    if (!msgs.length) return '';
    const row = replyEl.closest(ROW_SEL);
    if (row) {
      // prefer the nearest user message *above* this reply
      const above = msgs.filter(m => m.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (above.length) return captureText(above[above.length - 1]);
    }
    return captureText(msgs[msgs.length - 1]);
  }

  async function onReplyComplete(replyEl) {
    if (!replyEl.isConnected) return;
    const anchor = replyEl.closest(ROW_SEL) || replyEl.closest(STREAM_SEL) || replyEl;
    if (anchor.nextElementSibling?.getAttribute?.('data-contexa') === 'steps') return;

    if (!contextAlive()) return goStale(anchor);

    // Captured once, used twice: the suggestion request now, the fifth chip's
    // expand request whenever the user types into it later.
    const promptText = lastUserMessage(replyEl);
    const replyText = clampCapture(captureText(replyEl));

    let resp = null, thrown = null;
    try {
      resp = await chrome.runtime.sendMessage({
        type: 'nextSteps',
        prompt: promptText,
        reply: replyText
      });
    } catch (e) { thrown = String(e && e.message || e); }

    if (!anchor.isConnected) return;
    const steps = resp && !resp.error && Array.isArray(resp.steps)
      ? resp.steps.filter(s => s && typeof s.text === 'string' && s.text.trim())
      : null;

    if (!steps || !steps.length) {
      const err = resp && resp.error;
      if (isStaleError(thrown) || !contextAlive()) return goStale(anchor);
      if (err === 'quota') return renderQuiet(anchor, 'quota', '', resp);
      if (err === 'proxy_not_configured') return renderQuiet(anchor, 'unconfigured');
      /* resp MUST be passed through: the diagnostic lives on it. This call site
         omitted it through three rounds of instrumentation, which silently
         disabled both the grey cause-sentence and the console warn for every
         truncation ever shown — the renderer's diag logic read the fourth
         argument, and the fourth argument was never there. Tested by a source
         assertion in test.mjs so it cannot quietly regress. */
      return renderQuiet(anchor, 'error',
        thrown ? 'extension: ' + thrown : err || 'empty response', resp);
    }
    /* Partial salvage renders identically to a full result — a deliberate
       product decision (owner's call, 0.9.14). Rationale: salvage keeps the
       FIRST N complete steps and the prompt orders by leverage, so a partial
       set is the best prefix, every chip is whole, and 3–5 is the spec either
       way — the user cannot act on the distinction. The signal is NOT dropped:
       it moves to the console, because each partial means the model hit its
       token ceiling and burned 3–5x the output cost of a clean response.
       Ceiling-hit frequency stays measurable; the user stops being alarmed
       by internals. */
    // SPEC §7.5: the grounding rate must be readable from the page console.
    // Counts only — no evidence text crosses into the page.
    if (resp.grounding) console.log('[CONTEXA] grounding', resp.grounding);
    if (resp.partial === true) {
      // console.log, not warn: Chrome's extension page surfaces warn/error
      // under an alarming Errors badge (observed in the field). log stays
      // readable in the page console and the remote loop without dressing
      // telemetry as failure.
      console.log('[CONTEXA] partial salvage — kept', steps.length, 'step(s)',
        resp.diag ? resp.diag : '(no diag from this path)');
    }
    renderSteps(anchor, steps.slice(0, 5), { prompt: promptText, reply: replyText });
  }

  /* ---------------- rendering -------------------------------------------- */
  function shell(anchor, mode) {
    const holder = document.createElement('div');
    holder.setAttribute('data-contexa', 'steps');
    holder.setAttribute('data-cx-mode', mode);
    const root = holder.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.dataset.theme = isDark() ? 'dark' : 'light';
    root.appendChild(wrap);
    anchor.after(holder);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('show')));
    return wrap;
  }

  // Chip text is a <=6 word handle; the payload is the full prompt. Enforced
  // here too, so a chatty model can never blow up the row's layout.
  function shortLabel(s, max = 4) {
    const words = String(s || '').trim().replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    return words.length <= max ? words.join(' ') : words.slice(0, max).join(' ') + '…';
  }

  function renderSteps(anchor, steps, ctx) {
    const wrap = shell(anchor, 'ai');
    wrap.innerHTML = `<div class="label"><b>✦ CONTEXA</b></div>` +
      `<div class="chips"></div>`;
    const row = wrap.querySelector('.chips');
    for (const s of steps) {
      const full = String(s.text || '').trim();
      const label = shortLabel(s.label || full);
      if (!full || !label) continue;
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = label;
      chip.title = full;                       // hover shows what will be sent
      chip.addEventListener('click', () => insertPrompt(full));
      row.appendChild(chip);
    }
    appendOwnChip(row, ctx || {}, anchor);
  }

  /* The fifth chip (0.9.23): an empty slot at the end of the row. The user
     types a rough ask; CONTEXA drafts the full prompt into the composer.
     Suggestions cover what we guessed they want — this covers everything we
     didn't. One small state machine in one <span>: idle -> input -> busy ->
     idle | inline error. Never a second card, never an auto-send. */
  function appendOwnChip(row, ctx, anchor) {
    const slot = document.createElement('span');
    row.appendChild(slot);
    idle();

    function idle() {
      const chip = document.createElement('button');
      chip.className = 'chip own';
      chip.textContent = '✎ Rough ask…';
      chip.title = 'Type it rough — CONTEXA writes it properly';
      chip.addEventListener('click', arm);
      slot.replaceChildren(chip);
    }

    function arm() {
      const input = document.createElement('input');
      input.className = 'own-input';
      input.type = 'text';
      input.maxLength = 300;
      input.placeholder = 'Type it rough — I’ll write it properly';
      /* Typing must stay ours. Keyboard events are composed, so they cross the
         shadow boundary and reach claude.ai's document-level listeners — which
         is how a keystroke here could scroll the page or pull focus into the
         composer. Stop everything at the boundary. */
      for (const evt of ['keydown', 'keyup', 'keypress', 'input', 'paste']) {
        input.addEventListener(evt, e => e.stopPropagation());
      }
      input.addEventListener('keydown', e => {
        if (e.key === 'Escape') return idle();
        if (e.key === 'Enter') submit(input.value.trim());
      });
      // Clicking away with nothing typed collapses; typed text stays armed.
      input.addEventListener('blur', () => { if (!input.value.trim()) idle(); });
      slot.replaceChildren(input);
      setTimeout(() => input.focus(), 0);
    }

    function fail(err) {
      const chip = document.createElement('button');
      chip.className = 'chip cxerr';
      chip.textContent = err === 'quota' ? '✎ daily limit reached' : '✎ couldn’t write it — retry';
      chip.title = 'Click to try again';
      chip.addEventListener('click', arm);
      slot.replaceChildren(chip);
    }

    async function submit(intent) {
      if (!intent) return;
      if (!contextAlive()) return goStale(anchor);
      const busy = document.createElement('span');
      busy.className = 'chip busy';
      busy.textContent = '✎ writing…';
      slot.replaceChildren(busy);
      let resp = null, thrown = null;
      try {
        resp = await chrome.runtime.sendMessage({
          type: 'expandPrompt', intent, prompt: ctx.prompt || '', reply: ctx.reply || ''
        });
      } catch (e) { thrown = String(e && e.message || e); }
      if (!slot.isConnected) return;
      if (isStaleError(thrown) || (!resp && !contextAlive())) return goStale(anchor);
      if (resp && typeof resp.prompt === 'string' && resp.prompt.trim()) {
        insertPrompt(resp.prompt);
        idle();               // ready for the next rough ask
        return;
      }
      const err = (resp && resp.error) || thrown || 'empty response';
      // Detail to the console, one plain phrase on the chip — the row keeps
      // its suggestions either way.
      console.warn('[CONTEXA] expand failed', err, (resp && (resp.detail || JSON.stringify(resp.diag || ''))) || '');
      fail(err);
    }
  }

  // No canned tiles, ever: a degraded state says what happened instead of
  // dressing up generic text as real suggestions.
  function renderQuiet(anchor, mode, reason, resp) {
    const wrap = shell(anchor, mode);
    let body, btn = 'Settings';
    if (mode === 'stale') {
      body = `CONTEXA was updated — reload this page to continue.`;
      btn = 'Reload';
    } else if (mode === 'quota') {
      const limit = resp && resp.limit ? resp.limit : 20;
      body = `Daily limit reached (${limit} replies). Resets ${resetWording(resp && resp.resetsAt)}
        — or add your own API key for unlimited use.`;
      btn = 'Add key';
    } else if (mode === 'unconfigured') {
      body = `CONTEXA isn’t connected to a backend yet. Add your own API key to use it now.`;
      btn = 'Add key';
    } else {
      /* Show the cause in the page, not just the symptom. A bare "truncated"
         sent us hunting through three competing theories with no way to choose;
         one glance at these numbers picks the right one. Full detail also goes
         to the console. */
      const d = resp && resp.diag;
      if (d) console.warn('[CONTEXA]', reason, d);
      // detail = the API's own error text (own-key path). Captured since 0.9.0,
      // rendered never — until an api_400 cost a debugging cycle. Show it.
      const det = resp && resp.detail ? String(resp.detail).slice(0, 220) : '';
      if (det) console.warn('[CONTEXA] detail:', det);
      body = `Couldn’t generate next steps (<code>${esc(reason)}</code>).`
        + (d ? `<br><span class="diag">${esc(explainDiag(d))}</span>` : '')
        + (det ? `<br><span class="diag">${esc(det)}</span>` : '');
    }
    wrap.innerHTML = `<div class="quiet"><span><b style="color:var(--accent)">✦</b> ${body}</span>
      <button>${btn}</button></div>`;
    wrap.querySelector('button').addEventListener('click', () => {
      // no chrome.* here: this path must work when the context is already dead
      if (mode === 'stale') return location.reload();
      try { chrome.runtime.sendMessage({ type: 'openOptions' }).catch(() => {}); } catch {}
    });
  }

  /* Turn the diagnostic into the one sentence that identifies the cause, rather
     than dumping fields and leaving the reader to infer it. The three causes of a
     truncation need different fixes, so naming which one occurred is the whole
     point of collecting this. */
  function explainDiag(d) {
    const at = d.out != null && d.ceiling != null && d.out >= d.ceiling;
    const bits = [];
    if (!d.hadJson && d.len === 0) {
      bits.push('the model returned no text at all');
      if (d.blocks && d.blocks.length && !d.blocks.includes('text')) {
        bits.push(`output was ${d.blocks.join(' + ')}, not text`);
      }
    } else if (!d.hadJson) {
      bits.push(`the model wrote ${d.len} characters of prose without starting any JSON`);
    } else if (d.steps === 0) {
      bits.push(`JSON started but no step was named in ${d.len} characters`);
    } else {
      bits.push(`${d.steps} step(s) started, none completed, in ${d.len} characters`);
    }
    if (d.out != null) bits.push(`${d.out} output tokens${at ? ` — at the ${d.ceiling} ceiling` : ''}`);
    return bits.join('; ') + '.';
  }

  // "in 3 hours" reads better than a raw UTC timestamp.
  function resetWording(iso) {
    const t = iso ? Date.parse(iso) : NaN;
    if (isNaN(t)) return 'at midnight UTC';
    const mins = Math.max(1, Math.round((t - Date.now()) / 60000));
    if (mins < 60) return `in ${mins} min`;
    const hrs = Math.round(mins / 60);
    return `in ${hrs} hour${hrs === 1 ? '' : 's'}`;
  }

  // Say it once, then go quiet for the rest of the page's life.
  function goStale(anchor) {
    if (staleNotified) return standDown();
    staleNotified = true;
    renderQuiet(anchor, 'stale');
    standDown();
  }

  function insertPrompt(text) {
    if (!composer) composer = findComposer();
    if (!composer) return;
    composer.focus();
    const sel = window.getSelection();
    const existing = (composer.textContent || '').trim();
    /* Design-review item #4, verified real in 0.9.22: this used to select-all
       and type over whatever was in the composer — the one path where CONTEXA
       could destroy the user's own words. Never replace a non-empty draft:
       append below it instead. The user deletes what they don't want; nothing
       is ever lost. */
    if (existing) {
      const range = document.createRange();
      range.selectNodeContents(composer);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      text = '\n\n' + text;
    } else {
      sel.selectAllChildren(composer);
    }
    // execCommand cooperates with ProseMirror; fall back to textContent
    if (!document.execCommand('insertText', false, text)) {
      composer.textContent = existing ? composer.textContent + text : text;
    }
    composer.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  /* ---------------- lifecycle -------------------------------------------- */
  function tick() {
    if (!contextAlive()) return standDown(true);   // keep observing to deliver the notice
    if (!settings.enabled) return;
    const el = findComposer();
    if (el && el !== composer) { composer = el; watchReplies(); }
    if (composer && !composer.isConnected) composer = null;
  }

  chrome.storage.local.get({ enabled: true, apiKey: '', model: 'claude-sonnet-5' }, s => {
    settings = s;
    if (!settings.enabled) return;
    tickTimer = setInterval(tick, 900);   // re-finds the composer across SPA navigation
    tick();
  });

  chrome.storage.onChanged.addListener(ch => {
    if (ch.apiKey) settings.apiKey = ch.apiKey.newValue;
    if (ch.model) settings.model = ch.model.newValue;
    if (ch.enabled) settings.enabled = ch.enabled.newValue;
  });
})();
