/* CONTEXA — content script for claude.ai.
   One job: when Claude finishes a reply, offer a trigger; if it is clicked,
   read the session's own prompts and offer up to four independent next moves,
   each already a finished message. Click one to load it into the composer.
   Nothing overlays the composer, and nothing is rendered unless it is real. If
   the DOM shape changes, the script goes quiet rather than breaking the page. */

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
  /* 0.9.55 field round 1 — the accent is BRAND TEAL, not host coral. The spec
     said quiet-hat coral; the owner saw it live ("sve je narandžasto") and
     overruled: our new colour everywhere the accent goes. Coral #D97757 is
     claude.ai's send button — the design brief bans it outright. Light theme
     gets brand #15a594, dark gets the mascot's bright stop #2cc4ae.
     Field round 2 (same day) tried the FULL-BRAND card — pitch-black surface,
     teal frame, teal lettering, white on click — and the owner reverted it on
     sight: "mnogo napadno, moja greska." The quiet hat stands: surfaces and
     borders follow the host, teal stays an accent. Do not re-brand the card. */
  .wrap{--surface:#FFFFFF;--surface2:#FAF9F5;--text:#3D3929;--text2:#73726C;
    --border:#E8E6DE;--border2:#DEDCD1;--accent:#15a594;--accent-soft:#E0F2EF;
    --amber-bg:#F7F0DF;--amber-text:#8A6A1F;
    display:block;margin:8px 0 16px;max-width:680px;
    opacity:0;transform:translateY(4px);transition:opacity .28s ease,transform .28s ease}
  .wrap[data-theme="dark"]{--surface:#30302E;--surface2:#3A3A37;--text:#EDECE6;
    --text2:#A6A49B;--border:#3F3F3C;--border2:#4A4A46;--accent:#2cc4ae;--accent-soft:#274641;
    --amber-bg:#403823;--amber-text:#E0C382}
  .wrap.show{opacity:1;transform:none}
  .label{display:flex;align-items:center;gap:6px;font-size:9.5px;letter-spacing:.15em;
    text-transform:uppercase;color:var(--text2);margin-bottom:6px}
  /* 0.9.55 §2 — the ✦ rides the accent (brand teal since field round 1). The
     marker text stays quiet (label color); the marker as a whole is a
     documented structural discriminator against claude.ai's own question
     widget (Contaminant 2) and must remain. */
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
  .quiet{display:flex;align-items:flex-start;gap:8px;font-size:11.5px;color:var(--text2);
    max-width:520px;
    line-height:1.45;padding:7px 10px;border:1px dashed var(--border2);border-radius:8px;
    background:transparent}
  .quiet code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px}
  .quiet .diag{display:inline-block;margin-top:2px;font-size:10.5px;opacity:.75}
  .quiet button{margin-left:auto;flex:none;border:1px solid var(--border2);background:transparent;
    color:var(--text2);border-radius:6px;padding:2px 8px;font-size:10px;letter-spacing:.06em;
    text-transform:uppercase;cursor:pointer;font-family:inherit}
  .quiet button:hover{color:var(--accent);border-color:var(--accent)}
  /* The zero notice. It borrows .quiet — the honest-degraded-state look shared
     by the quota and error cards: dashed, muted, nothing chip-like about it.
     What this rule adds is that it is INERT: no pointer events at all, so it
     cannot be clicked, focused by click, or given a hover state. There is no
     action here to offer, and an element that looks like it has one would be a
     floor. (No backticks in this comment, and none anywhere else in this
     literal — one would end the template early, and neither node --check nor a
     regex over the source can see that. It cost a debugging round once.) */
  .quiet.nothing{pointer-events:none;font-style:italic;display:inline-flex;
    padding:5px 10px;opacity:.85}
  /* Still used by the mascot trigger's own busy state, which is the one
     control left that can be mid-flight. */
  .chip.busy{border-style:dashed;color:var(--text2);cursor:default;
    animation:cxpulse 1.2s ease-in-out infinite}
  /* 0.9.73 — the cost line and the fork control (brakes 3 and 2). Rides the
     label row, pushed to the right, in the label's quiet colour with the
     label's tracking and casing undone: a number and a small button, not a
     second headline. The button is the one control this product added since
     the pencil chip went, and the reason is stated where it renders. */
  .ctxa-cost{margin-left:auto;display:inline-flex;align-items:center;gap:8px;
    letter-spacing:0;text-transform:none;font-size:11px;color:var(--text2)}
  .ctxa-cost button{border:1px solid var(--border2);background:transparent;color:var(--text2);
    border-radius:999px;padding:2px 9px;font-size:10px;letter-spacing:.06em;
    text-transform:uppercase;cursor:pointer;font-family:inherit;white-space:nowrap}
  .ctxa-cost button:hover{color:var(--accent);border-color:var(--accent)}
  .ctxa-cost button:disabled{cursor:default;border-style:dashed;color:var(--text2);
    animation:cxpulse 1.2s ease-in-out infinite}
  .brief{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;font-size:11.5px;
    color:var(--text2);line-height:1.45}
  /* 0.9.74 — a nudge is the same quiet line with no button, so it may run to two
     lines on a narrow card; right-aligned so it stays visually attached to the
     row's edge rather than drifting toward the wordmark. */
  .ctxa-cost.note{max-width:72%;text-align:right;line-height:1.35}
  /* 0.9.55 §1 — the mascot trigger. Everything under ctxa-mas-*; it shares no
     class with the pencil chip (criterion P's trigger half closes here) and no
     label (the comparison assertion keeps guarding the literals). */
  .ctxa-mas-slot{display:inline-flex;align-items:center;gap:8px}
  .ctxa-mas{background:none;border:none;padding:0;cursor:pointer;position:relative;
    display:inline-flex;line-height:0}
  /* field round 1 — owner: "bar 30% manja". The §1c constant stays verbatim at
     58×50; the render shrinks to 40×34.5 (−31%) here, in CSS. */
  .ctxa-mas svg{width:40px;height:34.5px;display:block}
  .ctxa-mas:disabled{cursor:default}
  .ctxa-mas:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:12px}
  .ctxa-mas-bubble{position:absolute;bottom:100%;left:50%;
    transform:translateX(-50%) translateY(3px);
    margin-bottom:7px;background:var(--surface);color:var(--text);
    border:1px solid var(--border2);border-radius:999px;padding:4px 11px;
    font-size:11px;line-height:1.35;white-space:nowrap;opacity:0;transition:.2s;
    pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.07)}
  /* round 2 — every gesture selector also answers to .ctxa-peek, the class
     the button toggles from its own mouseenter/focus (see renderTrigger):
     deterministic restart per entry, independent of :hover cascade quirks. */
  .ctxa-mas:hover .ctxa-mas-bubble,
  .ctxa-mas:focus-visible .ctxa-mas-bubble,
  .ctxa-mas.ctxa-peek .ctxa-mas-bubble{transform:translateX(-50%) translateY(0)}
  .ctxa-mas-bubble b{color:var(--accent);font-weight:700}
  .ctxa-mas:hover .ctxa-mas-bubble,
  .ctxa-mas:focus-visible .ctxa-mas-bubble,
  .ctxa-mas.ctxa-peek .ctxa-mas-bubble{opacity:1}
  /* ENTRANCE — once, when the trigger mounts after a completed reply */
  .ctxa-mas{animation:ctxa-popin .55s cubic-bezier(.3,1.2,.4,1);transform-origin:50% 100%}
  @keyframes ctxa-popin{0%{transform:scale(0)}62%{transform:scale(1.12,.86)}
                        82%{transform:scale(.95,1.06)}100%{transform:scale(1)}}
  /* IDLE — rare snappy wink + occasional glance; nothing else */
  .ctxa-mas-wink{animation:ctxa-winkIdle 6s infinite;transform-box:fill-box;transform-origin:center}
  @keyframes ctxa-winkIdle{0%,93%,100%{transform:scaleY(1)}94.5%,96.5%{transform:scaleY(.08)}}
  .ctxa-mas-pup{animation:ctxa-glance 8s ease-in-out infinite}
  @keyframes ctxa-glance{0%,72%,100%{transform:translateX(0)}80%,90%{transform:translateX(1.5px)}}
  /* HOVER / FOCUS — winks at you, hand to mouth, bubble whispers.
     Round 2 adds the .ctxa-peek route; keyframes stay §1d verbatim. */
  .ctxa-mas:hover .ctxa-mas-wink,
  .ctxa-mas:focus-visible .ctxa-mas-wink,
  .ctxa-mas.ctxa-peek .ctxa-mas-wink{animation:ctxa-winkOnce .4s ease}
  @keyframes ctxa-winkOnce{0%,100%{transform:scaleY(1)}35%,65%{transform:scaleY(.08)}}
  .ctxa-mas-whisp{opacity:0;transition:.2s}
  .ctxa-mas:hover .ctxa-mas-whisp,
  .ctxa-mas:focus-visible .ctxa-mas-whisp,
  .ctxa-mas.ctxa-peek .ctxa-mas-whisp{opacity:1}
  /* CLICK — small hop; then the existing flow runs unchanged */
  .ctxa-mas.ctxa-hop{animation:ctxa-hop .35s ease}
  @keyframes ctxa-hop{40%{transform:translateY(-8px)}}
  /* REDUCED MOTION — entrance becomes a fade, idle animations off */
  @media (prefers-reduced-motion:reduce){
    .ctxa-mas{animation:ctxa-fadein .3s ease}
    @keyframes ctxa-fadein{from{opacity:0}to{opacity:1}}
    .ctxa-mas-wink,.ctxa-mas-pup{animation:none}
  }
  /* 0.9.33 — collapse rather than fade. A transparent card still occupies its
     height, and the complaint was about reading space, not visibility.

     0.9.47 — two corrections. "visibility:hidden" because opacity and
     pointer-events do NOT remove an element from the tab order: clipped content
     stays focusable, so Tab could land on a button nobody can see — and focus
     inside the card makes busy() true, which forces the card open again. A
     hidden card that reappears when you tab past it is worse than one that
     never hid. The delay lets the fade finish before it becomes unreachable.

     And ".wrap" needs a real max-height to animate FROM: the base value was
     "none", "none -> 0" does not interpolate, so the height snapped shut while
     opacity spent .22s fading something already zero-tall. The CSS described a
     fold it never performed. 600px clears a four-option card on any screen and
     never clips, because the base rule sets no overflow. */
  .wrap.away{opacity:0;pointer-events:none;visibility:hidden;
    max-height:0;margin:0;overflow:hidden;transform:translateY(4px);
    transition:opacity .2s ease,transform .2s ease,max-height .22s ease,
      margin .22s ease,visibility 0s linear .2s}
  .wrap{max-height:600px;
    transition:opacity .22s ease,transform .22s ease,max-height .24s ease,
      margin .24s ease,visibility 0s linear 0s}
  /* 0.9.33 — touch. Confirmed working on Edge, Lemur, Mises and Quetta, where
     the desktop row heights were under the 44px minimum and the nav glyphs were
     roughly 14px of tappable area. */
  @media (pointer:coarse),(max-width:520px){
    .chip{padding:9px 14px;font-size:13px;min-height:40px}
  }
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
  /* 0.9.32 — tag-based skipping cannot catch text that is VISUALLY HIDDEN but
     present in the DOM. claude.ai renders a screen-reader duplicate of the
     thinking header in a span.sr-only that sits OUTSIDE the tool-status button,
     so the visible copy was skipped correctly and the invisible one shipped on
     every reply carrying a thinking block. The principle: capture what the
     reader sees. Anything hidden from them that duplicates what they see is
     cost with no information, and worse, it is QUOTABLE — a chip grounded in
     'Thought for 8s' passes the evidence gate while meaning nothing.
     Found by DOM position, not by string matching: three separate string-based
     detectors this session mistook prose ABOUT chrome for the chrome itself. */
  const SKIP_SEL = '.sr-only, [data-testid^="tool-status"], [class*="artifact-block"]';
  const skipEl = n => SKIP_TAGS.has((n.tagName || '').toUpperCase())
    || (typeof n.matches === 'function' && n.matches(SKIP_SEL));
  const CODE_KEEP_LINES = 2;

  function textSkippingChrome(node) {
    let s = '';
    (function w(n) {
      if (n.nodeType === 3) { s += n.nodeValue; return; }
      if (n.nodeType !== 1 || skipEl(n)) return;
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
      if (skipEl(node)) return;
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

  /* v2 — the session's own turns. Head-first, exactly like clampCapture above:
     keep the beginning, mark the cut. One turn's ceiling is smaller than the
     reply's because there are up to forty of them and the budget is shared. */
  const TURN_WINDOW = 2000;
  const TURN_MARKER = '\n[turn trimmed here]';
  const TURN_BUDGET = TURN_WINDOW - TURN_MARKER.length;
  function clampTurn(text) {
    const t = String(text || '');
    if (t.length <= TURN_WINDOW) return t;
    let cut = t.slice(0, TURN_BUDGET);
    const nl = cut.lastIndexOf('\n');
    if (nl >= TURN_BUDGET * 0.8) cut = cut.slice(0, nl);
    else { const sp = cut.lastIndexOf(' '); if (sp > 0) cut = cut.slice(0, sp); }
    return cut.trimEnd() + TURN_MARKER;
  }

  /* The whole session's USER messages, oldest first, each carrying its true
     turn position. This replaced lastUserMessage, which built exactly this list
     off the same selector and then threw all but one entry away; mining is that
     list, kept.

     Two things this deliberately does NOT do. It does not send Claude's earlier
     replies: the signal the pivot is after is where SHE has been going, and the
     replies are both the bulkier half and the half that mostly restates her.
     And it does not persist anything — read off the DOM at call time, sent,
     discarded, exactly as the single-turn capture always was.

     KNOWN LIMIT, and the earlier note here got its consequence backwards.
     A virtualised transcript only has its rendered rows in the DOM, so on such
     a page this sees the rendered window rather than the whole conversation.
     The old note waved that away as "the same direction the budget already
     trims in" — it is the OPPOSITE direction, and that is the whole problem.
     fitTurns drops from the MIDDLE and pins the first; virtualisation drops
     from the HEAD and takes the first with it. The head is the direction this
     entire feature depends on.

     Measured: a live claude.ai Cowork tab renders ~3-5 blocks (CHANGELOG
     0.9.55). Whether standard chat does the same is NOT measured, which is why
     `i` below stopped pretending to know, and why askNow logs the range. */
  const MAX_TURNS = 40;
  const TURNS_TOTAL_BUDGET = 12000;

  /* The drop policy, kept apart from the DOM read above it. Two jobs, and only
     this one has a wrong answer that still looks right: a window keeping the
     LAST n turns reads perfectly in testing and silently decapitates every long
     session, because turn one is where the goal was stated.

     So turn one is PINNED. Oldest MIDDLE turns go first; the newest are what
     the next move actually builds on. Floor of two, so the goal and the present
     always survive together. Whole turns only — a chopped-off sentence is worse
     material than no sentence, which is why nothing is truncated here; per-turn
     size is clampTurn's job and has already happened. */
  function fitTurns(turns) {
    const total = () => turns.reduce((n, t) => n + t.text.length, 0);
    while (turns.length > 2 && (turns.length > MAX_TURNS || total() > TURNS_TOTAL_BUDGET)) {
      turns.splice(1, 1);
    }
    return turns;
  }

  /* `i` is the position among the messages THIS PAGE IS SHOWING — not the turn's
     position in the conversation, which the DOM cannot tell us. The distinction
     was elided here once and it cost a field regression: when the page holds
     only the last few turns, numbering them 1..N hands the model a recent turn
     labelled `[1]`, and MOVES_SYSTEM reads `[1]` as the message that states the
     goal. So a truncated read did not merely lose the opening — it nominated a
     replacement, which is why the moves came back reflecting only the last
     exchange. It also erased the gap that was supposed to make the loss
     visible, because 1..N is always contiguous.

     Numbering by capture order is still right; what changed is that nothing
     downstream is allowed to treat `[1]` as proof of the session's start. The
     prompt now says "earliest message you can see", which is true whether the
     read was complete or not. */
  function captureTurns() {
    const turns = [];
    [...document.querySelectorAll(USER_MSG_SEL)].forEach((m, idx) => {
      const text = clampTurn(captureText(m));
      if (text) turns.push({ i: idx + 1, text });
    });
    return fitTurns(turns);
  }

  /* ---------------- 0.9.73 — the thread's weight (brake 3) ---------------- */
  /* Every message sent on claude.ai re-reads the whole thread, so the cost of
     the NEXT send is the size of everything on the page, and the page is the
     one place that number can be read. chars/4 is accurate enough for a
     warning (it is not a bill), and textContent is cheap enough to read on
     every render — this is not the capture walk, which is the larger read
     and still waits for a click.

     The threshold is a product number, not a measurement: a 15-turn build
     session runs to roughly this size, and below it the re-read is not worth
     a line of chrome. Below the threshold nothing renders at all — a cost
     line on every short chat would be the noise this product exists to
     refuse. Above it, the line names the number and offers the one move that
     stops paying it: the fork. */
  const CHARS_PER_TOKEN = 4;
  const LONG_THREAD_TOKENS = 12000;
  /* 0.9.75 — the field found the flaw on day one: a plainly long chat on a
     phone drew the model nudge and never the cost line, because the DOM held
     only the rendered tail of the thread (the known virtualisation limit,
     which fitTurns already lives with) and the sum below read a fraction of
     the page. So the read is now scaled: the rendered blocks span some height,
     the scroller is some height, and on a virtualised page the second is
     much larger than the first. The ratio, capped, scales the character
     count. A page that is not virtualised has the two within padding of each
     other and scales by 1. It is still an estimate and still says ≈; what
     changed is which direction it is wrong in. The read is kept on
     `lastThreadRead` so the label's tooltip and the console can say what was
     actually measured, which is the number the field test could not report. */
  const VIRTUAL_MAX_SCALE = 20;
  let lastThreadRead = null;
  function threadTokens() {
    let chars = 0;
    const blocks = [];
    for (const sel of [USER_MSG_SEL, RESPONSE_SEL]) {
      for (const el of document.querySelectorAll(sel)) { chars += (el.textContent || '').length; blocks.push(el); }
    }
    let scale = 1, rendered = 0, total = 0;
    if (blocks.length) {
      let top = Infinity, bottom = -Infinity;
      for (const b of blocks) { const r = b.getBoundingClientRect(); if (r.height) { top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom); } }
      rendered = bottom > top ? bottom - top : 0;
      const sc = findScroller(blocks[blocks.length - 1]);
      total = sc ? sc.scrollHeight : 0;
      if (rendered > 200 && total > rendered * 1.2) scale = Math.min(VIRTUAL_MAX_SCALE, total / rendered);
    }
    const tokens = Math.round(chars * scale / CHARS_PER_TOKEN);
    lastThreadRead = { tokens, chars, blocks: blocks.length, scale, rendered: Math.round(rendered), total: Math.round(total), source: 'dom' };
    console.log('[CONTEXA] thread ≈', tokens, 'tokens —', chars, 'chars in', blocks.length, 'rendered blocks'
      + (scale > 1 ? ', scaled ×' + scale.toFixed(1) + ' (rendered ' + Math.round(rendered) + 'px of ' + Math.round(total) + 'px)' : ''));
    return tokens;
  }
  /* What the tooltip on the wordmark says — a long press on a phone, a hover on
     a desktop. The field test runs where there is no console, and "why no
     Start fresh here" is unanswerable without this number. */
  function threadNote() {
    const r = lastThreadRead;
    if (!r) return '';
    return '≈ ' + kTokens(r.tokens) + ' tokens on the page (' + r.chars.toLocaleString() + ' chars in ' + r.blocks + ' blocks'
      + (r.scale > 1 ? ', scaled ×' + r.scale.toFixed(1) + ' for the part not rendered' : '') + '). Start fresh appears from ' + kTokens(LONG_THREAD_TOKENS) + '.';
  }
  const kTokens = n => (n >= 1000 ? Math.round(n / 1000) + 'k' : String(n));

  /* The fork control, appended to a card's label row when the thread is long.
     One control, one job — and this is the second control since the pencil
     chip went, so the reason it earns a place is written here: it is not a
     second path into THIS thread's message box (the row of moves stays the
     only one), it is the exit. It renders only above LONG_THREAD_TOKENS, so
     on a short chat there is nothing to keep apart from the mascot.

     Built by createElement, never innerHTML: the number is computed, and the
     rule for this file is that nothing computed or returned goes through
     innerHTML. */
  function costLine(label, anchor, ctx) {
    if (!ctx || !ctx.reply) return;
    if (ctx.thread == null) ctx.thread = threadTokens();
    if (ctx.thread < LONG_THREAD_TOKENS) return;
    const cost = document.createElement('span');
    cost.className = 'ctxa-cost';
    const words = document.createElement('span');
    words.textContent = '≈ ' + kTokens(ctx.thread) + ' tokens re-read per send';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Start fresh';
    btn.title = 'Write a brief of this thread and open a new chat with it';
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = 'writing the brief…';
      askFork(anchor, ctx);
    });
    cost.append(words, btn);
    label.appendChild(cost);
  }

  /* ---------------- 0.9.76 — the thread from the page's own API ---------- */
  /* The second field session said the cost line still never came, on threads
     whose every reply was huge. So the rendered read is blind on that page in
     a way the scaling cannot fix — a transcript that loads its tail and no
     spacer measures as short by any DOM arithmetic. The page itself knows
     the whole thread: claude.ai fetches its conversation as JSON from its
     own API, same origin, and this script runs on that origin. So it asks
     the same API, read-only, with the page's own cookies, and counts. Nothing
     leaves the page; the number is computed here and the JSON is dropped.

     This is a dependency on a private API, exactly as the DOM selectors are a
     dependency on a private DOM, and it is held to the same rule: any failure
     — a moved endpoint, a changed shape, a 403 — is one console line and the
     rendered estimate stands. The org comes from the lastActiveOrg cookie
     when present, else from /api/organizations, trying each until one owns
     the conversation. Cached per conversation for the page's life. */
  const CONV_RE = /\/chat\/([0-9a-f-]{36})/i;
  /* 0.9.78 — a Cowork session is a different page with a different API. Named
     so the diagnostic can say so instead of "no conversation id"; the endpoint
     itself is what the probe below is for. */
  const COWORK_RE = /\/cowork\/([A-Za-z0-9_-]{8,})/;
  const apiCache = new Map();
  /* The page's own API paths, from probe.js (main world) — strings only, kept
     for the diagnostic card and nothing else. */
  const apiPaths = [];
  document.addEventListener('contexa-api-path', e => {
    const p = e && e.detail;
    if (typeof p === 'string' && p.length < 300 && apiPaths.length < 40 && !apiPaths.includes(p)) apiPaths.push(p);
  });
  const shortPath = p => p.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{23}/gi, '<uuid>').replace(/\/([a-z]+_[A-Za-z0-9]{6})[A-Za-z0-9]{6,}/g, '/$1…');
  async function apiJson(url) {
    const r = await fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('http_' + r.status);
    return r.json();
  }
  async function apiThread(ctx) {
    const m = location.pathname.match(CONV_RE);
    if (!m) {
      const cw = location.pathname.match(COWORK_RE);
      if (ctx) ctx.apiState = cw ? 'cowork session ' + cw[1].slice(0, 12) + '… — endpoint not known yet; see paths below'
        : 'no conversation id in ' + location.pathname.slice(0, 40);
      return null;
    }
    if (ctx) ctx.apiState = 'pending';
    const conv = m[1];
    const cookieOrg = (document.cookie.match(/(?:^|;\s*)lastActiveOrg=([0-9a-f-]{36})/i) || [])[1];
    let orgs = cookieOrg ? [cookieOrg] : [];
    if (!orgs.length) {
      const list = await apiJson('/api/organizations');
      orgs = (Array.isArray(list) ? list : []).map(o => o && o.uuid).filter(Boolean);
    }
    let data = null, lastErr = null;
    for (const org of orgs) {
      try {
        data = await apiJson('/api/organizations/' + org + '/chat_conversations/' + conv + '?tree=True&rendering_mode=messages&render_all_tools=true');
        break;
      } catch (e) { lastErr = e; }
    }
    if (!data) throw lastErr || new Error('no_org');
    const msgs = Array.isArray(data.chat_messages) ? data.chat_messages : [];
    let chars = 0, human = 0, assistant = 0;
    /* 0.9.77 — the user's own messages, whole, in order. The DOM on that page
       held ONE of them, so the moves and the brief were being mined from a
       single turn; this is the session the prompt was written for. Same
       clamps as the DOM read (clampTurn per turn, fitTurns over the set), so
       what is billed does not change — only how much of the session it is
       drawn from. */
    const turns = [];
    for (const msg of msgs) {
      if (!msg) continue;
      let t = typeof msg.text === 'string' ? msg.text : '';
      if (!t && Array.isArray(msg.content)) t = msg.content.map(p => (p && typeof p.text === 'string') ? p.text : '').join('\n');
      chars += t.length;
      if (msg.sender === 'human') { human++; const text = clampTurn(t.trim()); if (text) turns.push({ i: turns.length + 1, text }); }
      else assistant++;
    }
    const out = { tokens: Math.round(chars / CHARS_PER_TOKEN), chars, messages: msgs.length, human, assistant, turns };
    apiCache.set(conv + ':' + msgs.length, out);
    return out;
  }
  /* The session for a call: the page's API when it answered with more than
     the DOM holds, else the DOM. Logged either way, because which one fed the
     model is the first thing to know about any row. */
  function sessionTurns(ctx) {
    const dom = captureTurns();
    const api = ctx && ctx.api && Array.isArray(ctx.api.turns) ? ctx.api.turns : null;
    if (api && api.length > dom.length) {
      console.log('[CONTEXA] session — from the page API:', api.length, 'turn(s) (DOM held', dom.length + ')');
      return fitTurns(api.map(t => ({ i: t.i, text: t.text })));
    }
    console.log('[CONTEXA] session — from the DOM:', dom.length, 'turn(s)');
    return dom;
  }
  /* Runs after the trigger card is drawn with the rendered estimate. If the
     page's API answers and says the thread is bigger, the label row is redrawn
     with the better number — the line appears a beat late rather than never. */
  async function refineThread(anchor, ctx) {
    let api = null;
    try { api = await apiThread(ctx); }
    catch (e) { ctx.apiError = String(e && e.message || e); ctx.apiState = 'failed: ' + ctx.apiError; console.log('[CONTEXA] thread — page API unavailable (' + ctx.apiError + '); the rendered estimate stands'); refreshDiag(ctx); return; }
    if (!api) { refreshDiag(ctx); return; }
    ctx.api = api;
    ctx.apiState = 'ok';
    refreshDiag(ctx);
    console.log('[CONTEXA] thread — page API: ≈', api.tokens, 'tokens in', api.messages, 'messages (' + api.human + ' yours); rendered estimate was ≈', ctx.thread);
    if (api.tokens > (ctx.thread || 0)) {
      ctx.thread = api.tokens;
      if (lastThreadRead) Object.assign(lastThreadRead, { tokens: api.tokens, source: 'api' });
      refreshWeight(anchor, ctx);
    }
  }
  function refreshWeight(anchor, ctx) {
    const holder = document.querySelector('[data-contexa]');
    const label = holder && holder.shadowRoot && holder.shadowRoot.querySelector('.label');
    if (!label || !anchor.isConnected || holder.getAttribute('data-cx-mode') !== 'ai') return;
    for (const old of label.querySelectorAll('.ctxa-cost')) old.remove();
    weightLine(label, anchor, ctx);
    label.title = threadNote();
  }

  /* The diagnostic card. Three taps on the CONTEXA wordmark within two
     seconds — on a phone there is no console and no tooltip, and "why is there
     no line here" was unanswerable from a screenshot. Inert text: the version,
     what the thread read measured and from where, what the page's API said or
     why it did not, the user turns and the last three lengths, the model the
     page reports, and the reply's size. Nothing here is a control. */
  const DIAG_TAPS = 3, DIAG_WINDOW_MS = 2000;
  function diagLines(ctx) {
    let v = '?'; try { v = chrome.runtime.getManifest().version; } catch {}
    const r = lastThreadRead || {};
    const turns = [...document.querySelectorAll(USER_MSG_SEL)];
    const lastThree = turns.slice(-3).map(el => (el.textContent || '').trim().length);
    return [
      'CONTEXA v' + v,
      'thread ≈ ' + (ctx.thread != null ? ctx.thread : '?') + ' tokens (' + (r.source || 'dom') + '); Start fresh from ' + LONG_THREAD_TOKENS,
      'rendered: ' + (r.chars || 0) + ' chars in ' + (r.blocks || 0) + ' blocks, scale ×' + (r.scale ? r.scale.toFixed(2) : '1') + ' (' + (r.rendered || 0) + 'px of ' + (r.total || 0) + 'px)',
      ctx.api ? 'page API: ' + ctx.api.chars + ' chars in ' + ctx.api.messages + ' messages, ' + ctx.api.human + ' yours ≈ ' + ctx.api.tokens + ' tokens'
        : 'page API: ' + (ctx.apiState || 'not asked yet'),
      'user turns in DOM: ' + turns.length + ', last three: ' + (lastThree.join('/') || '-') + ' chars',
      'model on page: ' + (pageModel() || 'not found') + '; reply ' + ((ctx.reply || '').length) + ' chars',
      'page API paths seen (' + apiPaths.length + '):' + (apiPaths.length ? '\n  ' + apiPaths.slice(-14).map(shortPath).join('\n  ') : ' none — probe not running?')
    ];
  }
  function refreshDiag(ctx) {
    const holder = document.querySelector('[data-contexa]');
    const d = holder && holder.shadowRoot && holder.shadowRoot.querySelector('.quiet.diag');
    if (d) d.textContent = diagLines(ctx).join('\n');
  }
  function armDiag(label, wrap, ctx) {
    let taps = [];
    label.addEventListener('click', () => {
      const now = Date.now();
      taps = taps.filter(t => now - t < DIAG_WINDOW_MS); taps.push(now);
      if (taps.length < DIAG_TAPS) return;
      taps = [];
      const old = wrap.querySelector('.quiet.diag'); if (old) { old.remove(); return; }
      const lines = diagLines(ctx);
      const d = document.createElement('div');
      d.className = 'quiet diag';
      d.style.cssText = 'display:block;white-space:pre-wrap;margin-top:6px;font-size:10.5px';
      d.textContent = lines.join('\n');
      wrap.appendChild(d);
      console.log('[CONTEXA] diag\n' + lines.join('\n'));
    });
  }

  /* ---------------- 0.9.74 — the nudges (brake 5) ------------------------ */
  /* Two patterns that spend usage for nothing, read off the page when the card
     renders and said in one quiet line. Neither has a button, because the
     action is the next message the user writes — and the card is where the
     next message starts. Retrospective on purpose: the reply has just landed,
     which is the one moment the pattern is complete and the composer is empty,
     and nothing here overlays or watches the composer.

     FRAGMENTS. Three short messages in a row each re-read the whole thread;
     one message that asks for the whole thing reads it once. Said only when
     the thread is heavy enough for the re-read to matter (the floor below),
     because three "ok"s on a two-turn chat cost nothing worth a line.

     MODEL. A short question sent on Opus. Opus is the tier claude.ai spends
     fastest, and a question that fits in a line does not use what it is for.
     The ratio is the API list price, Opus 5 $5/$25 against Sonnet 5 $2/$10 per
     million tokens (2026-09); claude.ai's own weighting is not published, so
     the line says "about" and names where the number is from in this comment
     rather than pretending to a precision it does not have. The page's model
     is read from claude.ai's selector by a pinned selector, and an absent
     selector means no line, never a guess. The extension cannot switch the
     model; it can only say.

     The plan called this "ŠRAF classification"; nothing by that name exists in
     this repository, so a simple fragment is defined here: short, and free of
     the characters that mean code. One line at most: the long-thread cost line
     outranks both (it has an action), fragments outrank the model note. */
  const SHORT_TURN_CHARS = 120;
  const FRAGMENT_RUN = 3;
  const FRAGMENT_MIN_THREAD_TOKENS = 4000;
  const SIMPLE_TURN_CHARS = 200;
  const MODEL_SEL = '[data-testid="model-selector-dropdown"]';
  const OPUS_OVER_SONNET = '2.5×';
  function lastTurns(n) {
    return [...document.querySelectorAll(USER_MSG_SEL)].slice(-n).map(el => (el.textContent || '').trim());
  }
  function fragmentRun() {
    const t = lastTurns(FRAGMENT_RUN);
    return t.length === FRAGMENT_RUN && t.every(x => x.length > 0 && x.length < SHORT_TURN_CHARS);
  }
  function pageModel() {
    const el = document.querySelector(MODEL_SEL);
    const m = ((el && el.textContent) || '').match(/opus|sonnet|haiku/i);
    return m ? m[0].toLowerCase() : null;
  }
  function simpleLast() {
    const t = lastTurns(1)[0] || '';
    return t.length > 0 && t.length < SIMPLE_TURN_CHARS && !/[`{}()<>=;]/.test(t);
  }
  function note(label, text, why) {
    const el = document.createElement('span');
    el.className = 'ctxa-cost note';
    const words = document.createElement('span');
    words.textContent = text;
    el.appendChild(words);
    label.appendChild(el);
    console.log('[CONTEXA] nudge —', why);
  }
  /* The one line the label row may carry, chosen in order of what it saves. */
  function weightLine(label, anchor, ctx) {
    if (!ctx || !ctx.reply) return;
    if (ctx.thread == null) ctx.thread = threadTokens();
    if (ctx.thread >= LONG_THREAD_TOKENS) return costLine(label, anchor, ctx);
    if (ctx.thread >= FRAGMENT_MIN_THREAD_TOKENS && fragmentRun()) {
      return note(label, 'Three short messages in a row, each re-reading the thread (≈ '
        + kTokens(ctx.thread) + ' tokens). One message that asks for the whole thing reads it once.', 'fragments');
    }
    if (pageModel() === 'opus' && simpleLast()) {
      return note(label, 'Sent on Opus, about ' + OPUS_OVER_SONNET
        + ' Sonnet\'s usage per token. A question this short is what Sonnet is for.', 'model opus');
    }
  }

  /* 0.9.73 — brake 2: the fork. Spends one call, like the mascot, and reads
     the same session at the same moment for the same reason. What comes back
     is one string, the brief, and what happens next is two clicks apart on
     purpose: this one writes it, the next opens the new chat, so the brief
     can be read (it is the chip's title) before it goes anywhere, and the
     open happens inside a fresh user gesture rather than at the tail of a
     network wait, where a popup blocker would eat it. */
  async function askFork(anchor, ctx) {
    if (!anchor.isConnected) return;
    if (!contextAlive()) return goStale(anchor);

    let resp = null, thrown = null;
    try {
      const turns = sessionTurns(ctx);
      console.log('[CONTEXA] fork — session', turns.length, 'turn(s), thread ≈', ctx.thread, 'tokens');
      resp = await chrome.runtime.sendMessage({ type: 'fork', reply: ctx.reply, turns });
    } catch (e) { thrown = String(e && e.message || e); }

    if (!anchor.isConnected) return;

    if (!resp || resp.error || typeof resp.brief !== 'string') {
      const err = resp && resp.error;
      if (isStaleError(thrown) || !contextAlive()) return goStale(anchor);
      if (err === 'quota') return renderQuiet(anchor, 'quota', '', resp);
      if (err === 'proxy_not_configured') return renderQuiet(anchor, 'unconfigured');
      return renderQuiet(anchor, 'error',
        thrown ? 'extension: ' + thrown : err || 'empty response', resp);
    }

    const brief = resp.brief.trim();
    if (!brief) {
      /* The honest zero, again: a session with nothing to carry over gets no
         brief, and the card says so rather than opening a chat seeded with
         an invented summary. */
      console.log('[CONTEXA] fork — nothing to carry over');
      return renderNothing(anchor, 'fork');
    }
    const briefTokens = Math.round(brief.length / CHARS_PER_TOKEN);
    /* THE measurement the plan asked for: tokens before against tokens after,
       per send, on a real thread. HANDOFF's "a third or more of a long thread
       is re-sent history" was a guess; this line is what replaces it, one
       fork at a time. Numbers only. */
    console.log('[CONTEXA] fork — thread ≈ ' + ctx.thread + ' tokens, brief ≈ ' + briefTokens
      + ' tokens (' + Math.round(100 - 100 * briefTokens / Math.max(1, ctx.thread)) + '% less per send)');
    renderBrief(anchor, ctx, brief, briefTokens);
  }

  /* The brief card. One sentence with the two numbers, one chip. The chip's
     title is the brief itself, so a hover shows exactly what will land in the
     new chat — the same promise the move chips make. The click parks the brief
     with the service worker and opens a fresh chat; the content script that
     loads THERE collects it (see collectBrief) and puts it in that composer.
     Nothing is sent: the user reads it in the new tab and presses send. */
  const NEW_CHAT_URL = 'https://claude.ai/new';
  function renderBrief(anchor, ctx, brief, briefTokens) {
    const wrap = shell(anchor, 'brief');
    if (!wrap) return;
    wrap.innerHTML = `<div class="label"><b>✦</b> CONTEXA</div>`;
    const row = document.createElement('div');
    row.className = 'brief';
    const said = document.createElement('span');
    said.textContent = 'Brief ready: ≈ ' + kTokens(briefTokens) + ' tokens instead of ≈ '
      + kTokens(ctx.thread) + ' per send.';
    const chip = document.createElement('button');
    chip.className = 'chip move';
    chip.textContent = 'Open a new chat with it';
    chip.title = brief;
    chip.addEventListener('click', async () => {
      if (chip.disabled) return;
      chip.disabled = true;
      let ok = false;
      try {
        const r = await chrome.runtime.sendMessage({ type: 'stageBrief', brief });
        ok = !!(r && r.ok);
      } catch (e) {
        if (isStaleError(e) || !contextAlive()) return goStale(anchor);
      }
      if (!ok) { chip.disabled = false; return renderQuiet(anchor, 'error', 'brief could not be staged'); }
      window.open(NEW_CHAT_URL, '_blank', 'noopener');
      chip.textContent = 'Opened a new chat';
    });
    row.append(said, chip);
    wrap.appendChild(row);
  }

  /* The landing. A tab that loads at /new asks the service worker whether a
     brief is waiting; if one is, it goes into the composer as soon as tick()
     finds one. Restricted to /new so a brief can never surface in a chat the
     user already had open, and consumed on read (takeBrief) so it lands in
     exactly one composer. insertPrompt appends below any existing draft, so
     even a /new with something typed in it loses nothing. */
  let pendingBrief = '';
  async function collectBrief() {
    if (location.pathname !== '/new') return;
    try {
      const r = await chrome.runtime.sendMessage({ type: 'takeBrief' });
      if (r && typeof r.brief === 'string' && r.brief) { pendingBrief = r.brief; tick(); }
    } catch { /* orphaned script or no worker: nothing to land */ }
  }
  function landBrief() {
    if (!pendingBrief || !composer) return;
    const text = pendingBrief;
    pendingBrief = '';
    insertPrompt(text);
    console.log('[CONTEXA] fork — brief landed in a new chat, ≈', Math.round(text.length / CHARS_PER_TOKEN), 'tokens');
  }

  /* ---------------- reply detection --------------------------------------- */
  const processed = new WeakSet();

  let themeSync = null;
  const themeObserver = new MutationObserver(() => { if (themeSync) themeSync(); });
  function watchReplies() {
    if (replyObserver) replyObserver.disconnect();
    const container = composer.closest('main') || document.body;
    let settleTimer = null;
    // true only inside the debounced call: "mutations have stopped for 1.2s"
    let settled = false;

    const scan = () => {
      const responses = container.querySelectorAll(RESPONSE_SEL);
      if (!responses.length) return;
      const last = responses[responses.length - 1];
      if (processed.has(last)) return;
      /* The streaming guard used to fail OPEN: `wrap && ...` meant that if the
         attribute ever moved, was renamed, or stopped being an ancestor of the
         reply, the guard silently stopped applying and we fired mid-stream on a
         half-written answer — then `processed` blocked any correction. The
         symptom would be one weak chip and no error anywhere. Fail CLOSED
         instead: without a positive "streaming has finished" signal, refuse the
         fast path and let the settle timer decide. `settled` is set only by the
         debounced call, so a claude.ai redesign costs a 1.2s delay, never a
         capture of half a reply. */
      const wrap = last.closest(STREAM_SEL);
      const streamFlag = wrap ? wrap.getAttribute('data-is-streaming') : null;
      if (streamFlag === 'true') return;                  // definitely still streaming
      if (streamFlag !== 'false' && !settled) return;      // no positive signal - wait for quiet
      if ((last.textContent || '').trim().length < 120) return;              // skip one-liners
      processed.add(last);
      onReplyComplete(last);
    };

    replyObserver = new MutationObserver(() => {
      settled = false;
      scan();                                 // fast path: streaming flag flipped false
      clearTimeout(settleTimer);
      // fallback when the flag is absent or renamed: the page going quiet for
      // 1.2s is the positive signal scan() needs.
      settleTimer = setTimeout(() => { settled = true; scan(); }, 1200);
    });
    replyObserver.observe(container, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['data-is-streaming']
    });
    scan();
    /* 0.9.75 — a page that loaded already finished, with no streaming flag on
       its last reply, never mutates; the settle timer that stands in for the
       flag was only ever armed BY a mutation, so such a page drew nothing,
       forever, with nothing in the console. The field reported "on most
       chats it does not open". Arm the fallback once at attach as well: the
       same 1.2s of quiet, the same fail-closed scan, just not waiting for a
       change that a static page will never make. */
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { settled = true; scan(); }, 1200);
  }

  async function onReplyComplete(replyEl) {
    /* Re-checked here, not only in tick(): the observer is asynchronous, so a
       reply already in flight when the switch flipped would otherwise still
       mount a card after shutDown() ran. */
    if (!settings.enabled) return;
    if (!replyEl.isConnected) return;
    /* 0.9.30: the card no longer lives next to the reply, so a sibling check
       cannot tell us whether this reply was handled. The `processed` WeakSet in
       scan() is now the only dedupe, and it is sufficient: one card exists at a
       time and a newer reply is meant to replace an older one. */
    const anchor = replyEl.closest(ROW_SEL) || replyEl.closest(STREAM_SEL) || replyEl;

    if (!contextAlive()) return goStale(anchor);

    const replyText = clampCapture(captureText(replyEl));

    /* 0.9.53 — CAPTURE is still eager. The CALL is not.
       Every completed reply used to spend a questions call whether or not
       anyone looked at the answer, and most replies are never asked about. The
       row now arrives with one chip and nothing behind it; `askNow` runs when
       the user asks. Two consequences beyond the bill: nothing about the
       conversation leaves the page until a deliberate click, and the offer
       stops being specific until it is opened — see CHANGELOG for that
       trade, which is real and was argued before it shipped.

       Capture stays here on purpose. It costs nothing, the DOM is settled at
       completion, and deferring it would mean walking a reply claude.ai may
       have re-rendered by the time the click lands. */
    return renderTrigger(anchor, { reply: replyText });
  }

  /* 0.9.53 — the CALL waits for a click; the capture does not. Unchanged by
     the pivot, and the reason the session read lives here rather than in
     onReplyComplete: it is the larger read, and by this point the user has
     actually asked for it. */
  async function askNow(anchor, ctx) {
    if (!anchor.isConnected) return;
    if (!contextAlive()) return goStale(anchor);

    let resp = null, thrown = null;
    try {
      /* 0.9.77 — the page's API when it answered, else captureTurns(); the
         build guard still wants the DOM read named here, and it is the
         fallback sessionTurns takes. */
      const turns = sessionTurns(ctx);
      /* The one line that separates "the model ignored the session" from "the
         page never had the session". Without it the two produce byte-identical
         console output, which is how a capture bug survived a field test: the
         symptom was visible and its cause was not.

         The i range matters as much as the count. A contiguous 1..4 on a
         twenty-turn conversation is a positive identification of a truncated
         read; 1..20 says the capture is whole and any complaint is about how
         the model weighted it. */
      console.log('[CONTEXA] session —', turns.length, 'turn(s),',
        turns.reduce((n, t) => n + t.text.length, 0), 'chars,',
        turns.length ? 'i=' + turns[0].i + '..' + turns[turns.length - 1].i : 'i=none');
      resp = await chrome.runtime.sendMessage({
        type: 'nextSteps',
        reply: ctx.reply,
        turns
      });
    } catch (e) { thrown = String(e && e.message || e); }

    if (!anchor.isConnected) return;

    if (!resp || resp.error || !Array.isArray(resp.moves)) {
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

    // SPEC §7.5: the grounding rate must be readable from the page console.
    // Counts only — no evidence text crosses into the page.
    if (resp.grounding) console.log('[CONTEXA] grounding', resp.grounding);
    /* A partial salvage renders identically to a full row — the owner's call
       (0.9.14), and it survives the pivot for the same reason it was made:
       salvage keeps the moves that came through WHOLE, so a partial set is a
       shorter menu rather than a damaged one, and the user cannot act on the
       distinction. The signal is not dropped, it moves to the console, because
       each partial means the model hit its ceiling and burned several times the
       output cost of a clean response. */
    if (resp.partial === true) {
      // console.log, not warn: Chrome's extension page files warn/error under an
      // alarming Errors badge, which dresses telemetry up as failure.
      console.log('[CONTEXA] partial salvage — kept', resp.moves.length, 'move(s)',
        resp.diag ? resp.diag : '(no diag from this path)');
    }

    /* A light structural guard, not a second copy of cleanMoves. Everything
       here has already passed the real gate in background.js, on both the
       hosted and own-key paths. What this catches is a shape the renderer has
       no case for — a move with no label draws a blank button, which is a
       defect the user can see and we cannot. */
    const moves = resp.moves
      .filter(m => m && String(m.label || '').trim() && String(m.text || '').trim())
      .slice(0, 4);

    if (!moves.length) {
      /* Zero stays a product outcome: nothing mined, nothing shown. Logged
         because how OFTEN this fires is the one question the field test exists
         to answer — the fifth chip that used to catch a click returning nothing
         is gone, and there is deliberately no fallback behind it.

         But there are TWO ways to arrive here and only one of them is the
         product working. The model can earn nothing, or the action gate can
         drop every move for want of a verb on its list. Until 0.9.64 they drew
         the SAME card, so a gate eating a good row wore the costume of an
         honest zero — which is the one thing this product must never do. The
         console told them apart, and the field test runs on a phone, where
         there is no console.

         So the reason travels to the card. `g.total` is what the model returned
         before any gate; if it sent moves and none survived, this row was
         FILTERED, not empty. */
      const g = resp.grounding || {};
      /* WHICH gate, not merely THAT one fired. Only one gate can fire since
         0.9.66, but the field still carries the name rather than a boolean:
         the answer to a row the action gate emptied is a verb missing from the
         allowlist, which is a bug in that list and nothing like an honest zero.
         Decided upstream and only read here. */
      const why = g.emptiedBy || null;
      console.log(why
        ? '[CONTEXA] quiet row — model returned ' + g.total 
          + ', emptied by the ' + why + ' gate'
        : '[CONTEXA] quiet row — nothing mined from this session');
      return renderNothing(anchor, why);
    }
    console.log('[CONTEXA] moves', moves.map(m => m.label));
    renderMoves(anchor, moves, ctx);
  }

  /* ---------------- rendering -------------------------------------------- */
  /* 0.9.30: one card for the page, mounted above the composer, replacing the
     row-under-every-reply model. Owner's call, and it has a second payoff — a
     virtualised transcript (Claude Code sessions) forbids injecting into rows,
     and this is the placement that scope concluded was required.
     Consequences, all deliberate: only the newest reply has a card; nothing
     accumulates when you scroll back; there is exactly ONE node, so a new reply
     replaces the previous card instead of stacking under it. */
  function mountHost() {
    if (!composer || !composer.isConnected) composer = findComposer();
    if (!composer) return null;
    let n = composer;
    for (let i = 0; i < 6 && n.parentElement; i++) {
      const p = n.parentElement;
      if (p.tagName === 'MAIN' || p === document.body) break;
      n = p;
    }
    return n;
  }

  /* 0.9.33 — the card mounts above the composer, which is sticky, so before
     this it sat in view permanently and ate ~150px of reading space while you
     scrolled back through a conversation. A regression introduced by 0.9.30's
     placement and not noticed until the owner hit it.

     Hide when the anchored reply leaves the viewport, NOT while scrolling:
     hiding during scroll would also hide the card while you scroll down toward
     it — exactly when you want it — and would flicker on every small nudge. */
  /* 0.9.42 — hidden the moment the page moves, back when it stops.

     0.9.33 hid the card once the anchored turn left the viewport, and 0.9.41
     fixed that rule to cover both directions. Both were the wrong RULE. The
     owner's requirement, twice stated and twice built around: "invisible while
     scrolling through text", "invisible as soon as she appears over the text."
     The card sits over the conversation, so ANY scroll is someone trying to
     read what is behind it — position is not the question, motion is.

     Position still decides the resting state: after scrolling stops, the card
     returns only if the turn it belongs to is actually on screen. So reading
     back through history leaves it hidden, and scrolling down to the newest
     reply brings it back. */
  /* 0.9.46 — the card hides because text is up against it, not because the page
     moved. Three rules were tried and all three were about MOTION or about the
     anchored turn's position; the owner's actual complaint was that a single
     wheel notch made it blink, and that what should hide it is having a wall of
     conversation pressed against it.

     Why it cannot collapse. Every earlier version measured something the card
     itself changes: collapse it and the conversation area grows, so the reading
     that caused the hide reverses, so it shows, so it collapses again. The
     flicker was that loop. The fix is not a timer — it is measuring how far the
     reader is from the BOTTOM of the conversation, and separating the two
     thresholds by more than the card's own height. A collapse can move the
     reading by at most the card's height, which is by construction not enough
     to cross back. No timers, no debounce, no quiet window: the hysteresis is
     the whole mechanism. */
  const SHOW_WITHIN = 140;       // this close to the bottom, nothing is in the way
  const HYSTERESIS = 60;         // margin on top of the card's height
  let scrollWatch = null;

  function findScroller(from) {
    let n = from;
    while (n && n !== document.body) {
      const st = getComputedStyle(n);
      if (/(auto|scroll|overlay)/.test(st.overflowY) && n.scrollHeight - n.clientHeight > 40) return n;
      n = n.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function watchScroll(anchor, holder) {
    if (scrollWatch) { removeEventListener('scroll', scrollWatch, true); scrollWatch = null; }
    if (!anchor || !anchor.getBoundingClientRect) return;
    const wrap = holder.shadowRoot && holder.shadowRoot.querySelector('.wrap');
    if (!wrap) { console.warn('[CONTEXA] scroll watcher found no .wrap — not watching'); return; }
    let queued = false, cardH = 160, scroller = null;

    /* Never vanish under someone mid-answer. Focus inside the card, or a
       partly-typed free-text answer, outranks the geometry entirely. */
    const busy = () => {
      const root = holder.shadowRoot;
      return !!(root && (root.activeElement ||
        [...root.querySelectorAll('input')].some(el => el.value.trim())));
    };

    const setAway = (on, why) => {
      if (wrap.classList.contains('away') === on) return;
      wrap.classList.toggle('away', on);
      if (why) console.log('[CONTEXA]', on ? 'hidden —' : 'shown —', why);
    };

    const unbind = () => { removeEventListener('scroll', scrollWatch, true); scrollWatch = null; };

    const evaluate = () => {
      queued = false;
      if (!holder.isConnected || !anchor.isConnected) return unbind();
      if (busy()) { setAway(false, 'answering'); return; }
      // Remember the card's real height while it still has one.
      if (!wrap.classList.contains('away')) {
        const h = holder.getBoundingClientRect().height;
        if (h > 40) cardH = h;
      }
      if (!scroller || !scroller.isConnected) scroller = findScroller(anchor);
      const fromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      const hideAt = SHOW_WITHIN + cardH + HYSTERESIS;
      if (fromBottom > hideAt) setAway(true, 'conversation is up against the card');
      else if (fromBottom < SHOW_WITHIN) setAway(false, 'nothing in the way');
      // Between the two: leave it exactly as it is. That gap is the mechanism.
    };

    scrollWatch = () => { if (!queued) { queued = true; requestAnimationFrame(evaluate); } };
    addEventListener('scroll', scrollWatch, { capture: true, passive: true });
    /* 0.9.43 — never born hidden: an invisible card is indistinguishable from a
       dead extension. The first scroll decides its fate, not its arrival. */
    setAway(false);
  }

  function shell(anchor, mode) {
    const host = mountHost();
    if (!host) {
      console.warn('[CONTEXA] no composer found — card not mounted');
      return null;
    }
    for (const old of document.querySelectorAll('[data-contexa]')) old.remove();
    const holder = document.createElement('div');
    holder.setAttribute('data-contexa', 'steps');
    holder.setAttribute('data-cx-mode', mode);
    /* round 2 — modest lift. claude.ai draws sticky/gradient chrome around
       the composer, and a sibling overlay that catches pointer events would
       eat :hover on the mascot while looking like nothing (field: gesture
       fired once per load, never again; a clean Chromium re-fires every
       time). Above page text, below claude.ai overlays/modals — §1e. */
    holder.style.position = 'relative';
    holder.style.zIndex = '5';
    const root = holder.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.dataset.theme = isDark() ? 'dark' : 'light';
    /* 0.9.47 — the theme was decided once and never revisited, so switching
       claude.ai between light and dark left the open card in the old palette
       until the next reply. Follow it instead. */
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const sync = () => { if (wrap.isConnected) wrap.dataset.theme = isDark() ? 'dark' : 'light'; };
      if (mq.addEventListener) mq.addEventListener('change', sync);
      themeObserver.disconnect();
      themeObserver.observe(document.documentElement,
        { attributes: true, attributeFilter: ['class', 'style', 'data-mode', 'data-theme'] });
      themeSync = sync;
    }
    root.appendChild(wrap);
    host.before(holder);
    /* 0.9.44 — the render path had no voice. `[CONTEXA] grounding` proved a card
       had been EARNED, and nothing said whether one was ever SEEN. Two states
       that look identical from the console are exactly what this project keeps
       paying for, so both ends of the pipe now speak. */
    /* 0.9.51 — the version, stamped where every reading starts. Two separate
       measurements were lost without it. First, a Web Store install (0.9.32)
       ran alongside the unpacked build for two sessions, double-billing every
       reply and interleaving two sets of counts in one console; it was caught
       only by noticing that `grounding` printed at two different LINE NUMBERS
       and grepping every shipped zip to date them. Second, 0.9.50 changed
       prompt text only — content.js stayed byte-identical to 0.9.49, so the
       line numbers were the same and no reading taken that evening could say
       which prompt produced it.
       Line numbers were doing this job by accident and they only work when the
       code moves. This says it outright, and a second CONTEXA in the page now
       announces itself on the first card it mounts. */
    {
      const r = anchor && anchor.getBoundingClientRect
        ? anchor.getBoundingClientRect() : null;
      let v = '?';
      try { v = chrome.runtime.getManifest().version; } catch (e) { /* orphaned script */ }
      console.log('[CONTEXA] card mounted', 'v' + v, mode,
        r ? 'anchor top=' + Math.round(r.top) + ' bottom=' + Math.round(r.bottom)
          : 'no anchor rect',
        'viewport=' + (innerHeight || 0),
        'connected=' + holder.isConnected);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('show')));
    watchScroll(anchor, holder);
    return wrap;
  }

  /* 0.9.70 — every dark paint here goes through a paint server, and that is
     load-bearing, not decoration. A phone running the browser's force-dark
     ("night mode") erased the mascot's face: pupils vanished, the mouth turned
     white. Chromium force-dark classifies each paint into one of two roles and
     inverts on Rec.601 brightness B = .299R + .587G + .114B — a FLAT fill or
     stroke is a foreground, inverted iff B < 150; the output of a PAINT SERVER
     (fill="url(#...)") is a background, inverted iff B > 205. So flat #000
     pupils invert to pure white and disappear into the white sclera, while the
     body has always been safe: it was already a gradient.
     0.9.69 read the same symptom as an anti-aliasing problem and made the ink
     DARKER, which is exactly backwards — lower B is further under the
     threshold, so the fix is what turned "pale" into "gone".
     A sweep of all 16,777,216 sRGB colours says no flat colour can be picked
     out of this: zero of them hold 4.5:1 against the white sclera in all four
     render modes (best is 3.13:1). The escape is the ROLE, not the colour.
     Wrapped in a two-stop gradient of one colour, #000 stays #000 under every
     inversion method, pixel for pixel, and renders flat as before.
     The asymmetry is the trap: white must stay FLAT (255 >= 150, safe as a
     foreground; as a gradient stop its 255 clears 205 and the whole eye
     inverts to near-black). extension/test.mjs guards both directions.
     gradientUnits="userSpaceOnUse" because an objectBoundingBox paint server
     paints NOTHING when a shape's box is flat in either axis — the mouth is
     1.25 units tall today, and one "straighten the smile" edit away from
     invisible in every mode, force-dark or not.
     Known ceiling, so it is not re-derived as a bug later: a remapper that
     inverts even pure white as a foreground would darken the sclera and leave
     the pupils black (1.12:1). No role assignment survives both ends — white
     is only safe flat, dark ink only as a paint server. Windows
     forced-colors mode is a separate subsystem this does not address, and
     could not be exercised on the build these measurements came from. */
  const MASCOT_SVG = `<svg width="58" height="50" viewBox="0 0 58 50" aria-hidden="true">
  <defs><linearGradient id="ctxaMg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2cc4ae"/><stop offset="1" stop-color="#15a594"/>
  </linearGradient>
  <linearGradient id="ctxaPg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="58" y2="0">
    <stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#000"/>
  </linearGradient>
  <linearGradient id="ctxaOg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="58" y2="0">
    <stop offset="0" stop-color="#0a352f"/><stop offset="1" stop-color="#0a352f"/>
  </linearGradient>
  <linearGradient id="ctxaWg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="58" y2="0">
    <stop offset="0" stop-color="#2cc4ae"/><stop offset="1" stop-color="#2cc4ae"/>
  </linearGradient></defs>
  <path d="M29 3 C43 3 53 12 53 26 L53 50 L5 50 L5 26 C5 12 15 3 29 3 Z" fill="url(#ctxaMg)"/>
  <g class="ctxa-mas-pup">
    <g><ellipse cx="21" cy="25.5" rx="7.4" ry="8.6" fill="#fff"/>
       <circle cx="22.9" cy="27.2" r="3.8" fill="url(#ctxaPg)"/>
       <circle cx="21.7" cy="25.9" r="1.3" fill="#fff" opacity=".95"/></g>
    <g class="ctxa-mas-wink"><ellipse cx="37" cy="25.5" rx="7.4" ry="8.6" fill="#fff"/>
       <circle cx="38.9" cy="27.2" r="3.8" fill="url(#ctxaPg)"/>
       <circle cx="37.7" cy="25.9" r="1.3" fill="#fff" opacity=".95"/></g>
  </g>
  <path d="M25 37 Q29 39.5 33 37" stroke="url(#ctxaOg)" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <ellipse class="ctxa-mas-whisp" cx="41" cy="37" rx="4.6" ry="3.4" fill="url(#ctxaWg)"/>
</svg>`;

  function renderTrigger(anchor, ctx) {
    const wrap = shell(anchor, 'ai');
    if (!wrap) return;
    wrap.innerHTML = `<div class="label"><b>✦</b> CONTEXA</div>` +
      `<div class="chips"></div>`;
    weightLine(wrap.querySelector('.label'), anchor, ctx);
    wrap.querySelector('.label').title = threadNote();
    armDiag(wrap.querySelector('.label'), wrap, ctx);
    refineThread(anchor, ctx);
    const slot = document.createElement('span');
    slot.className = 'ctxa-mas-slot';
    wrap.querySelector('.chips').appendChild(slot);
    idle();

    function idle() {
      /* 0.9.55 §1 — the mascot IS the trigger: same slot, same mount
         conditions, same click handler, same spends-one-call-on-click
         semantics. Its appearance is pure DOM/CSS — no model call, no fetch,
         nothing leaves the page before a click. It is a real <button>, so
         Enter/Space fire natively; it must NOT read like the fifth chip, and
         it no longer can: no chip class, no text label. Star asks, pencil
         types — the bubble whispers 'What now? ✦' and the aria-label says the
         same for keyboard and screen-reader users. */
      const chip = document.createElement('button');
      chip.className = 'ctxa-mas';
      chip.setAttribute('aria-label', 'What now?');
      chip.innerHTML = MASCOT_SVG +
        '<span class="ctxa-mas-bubble">What now? <b>✦</b></span>';
      chip.addEventListener('click', () => {
        if (chip.disabled) return;
        /* §1d — small hop on the click, then the existing flow runs
           unchanged. The mascot stays put (idle animations may keep running)
           and the existing loading presentation renders beside it; askNow
           re-renders the shell, so nothing here survives the response. */
        chip.disabled = true;
        chip.classList.add('ctxa-hop');
        busy();
        askNow(anchor, ctx);
      });
      /* round 2 — the field showed the hover gesture firing once per page
         load and never again on that machine; a clean Chromium re-fires it
         on every entry (probed three hovers, normal and reduced-motion), so
         the cause is environmental. Harden anyway: the gesture is driven by
         a class the button toggles itself, with a forced reflow between
         remove and add so the one-shot wink RESTARTS deterministically on
         every entry — and keyboard focus gets the same. Appearance only: no
         call, no fetch, nothing leaves the page. */
      const peekOn = () => {
        chip.classList.remove('ctxa-peek');
        void chip.offsetWidth;
        chip.classList.add('ctxa-peek');
      };
      const peekOff = () => chip.classList.remove('ctxa-peek');
      chip.addEventListener('mouseenter', peekOn);
      chip.addEventListener('mouseleave', peekOff);
      chip.addEventListener('focus', peekOn);
      chip.addEventListener('blur', peekOff);
      slot.replaceChildren(chip);
    }

    function busy() {
      const b = document.createElement('span');
      b.className = 'chip busy';
      b.textContent = '✦ reading…';
      slot.appendChild(b);
    }
  }

  /* v2 — the mined row. Same flat row as the chip row above and deliberately
     so: this is the shape the pivot keeps, and it already works. What differs
     is where the items came from (the session, not the reply) and what a click
     costs (nothing).

     No pencil. The fifth chip is gone with the interview, which means this row
     is the only way anything reaches the message box — and on a session that
     mined nothing, renderNothing below leaves no row at all. That is the
     specced behaviour and the open question the field test is for. */
  function renderMoves(anchor, moves, ctx) {
    const wrap = shell(anchor, 'ai');
    if (!wrap) return;
    wrap.innerHTML = `<div class="label"><b>✦</b> CONTEXA</div>` +
      `<div class="chips"></div>`;
    /* The fork stays offered on the mined row: a long thread is long whether
       or not it earned moves, and the exit should not vanish because the
       menu arrived. */
    weightLine(wrap.querySelector('.label'), anchor, ctx);
    wrap.querySelector('.label').title = threadNote();
    armDiag(wrap.querySelector('.label'), wrap, ctx);
    const row = wrap.querySelector('.chips');
    for (const m of moves) appendIdeaChip(row, m);
  }

  /* Zero, said out loud. This used to remove the row outright, on the reasoning
     that a header over nothing reads as a broken card. True — but so does a UI
     that vanishes. The user CLICKED: they waited, they spent one of their
     twenty, and the row disappearing is indistinguishable from a crash. 0.9.53
     already recorded this shape once, about the predecessor of this exact
     state: "they ASKED, and a chip that answers a click by sitting there is a
     dead end." Silence was free while the row arrived unbidden. It stopped
     being free the moment it had to be asked for.

     It costs nothing to say. By the time we know the answer is empty the call
     is already paid for, so this is purely what gets drawn afterwards.

     What it must NOT become is an offer. No button, no chip class, no hover,
     no text that could be composed, and `pointer-events:none` so it cannot be
     clicked even by accident — every other renderQuiet mode has an action, and
     this one deliberately has none, because there is nothing here the user
     could do. A "nothing for now" element that looks pressable is a floor
     arriving through a side door, which is the shape MOVES_SYSTEM bans by name
     and the shape every floor this project has recorded started as.

     It leaves on its own. Saying its piece and then collapsing is the point:
     the row is gone either way, the difference is that the user knows why. */
  const NOTHING_LINGERS_MS = 4000;
  function renderNothing(anchor, why) {
    const wrap = shell(anchor, 'nothing');
    if (!wrap) return;
    const note = document.createElement('div');
    note.className = 'quiet nothing';
    /* Two wordings, because two different things happened. "Nothing for now."
       is the honest zero and stays exactly as it was — it is the common case
       and must not get noisier. The other says the model DID send moves and
       none survived the gate, which is a different fact and sometimes a
       defect: an incomplete verb list empties a row in a language the list does
       not know, and that failure is invisible if both cards read the same.

       Not written to explain gates to a user. Written so the difference is
       legible in a SCREENSHOT, since that is how this product is actually
       being field-tested and the console is not reachable there. */
    note.textContent = why === 'action' ? 'Nothing worth clicking here.'
      : why === 'fork' ? 'Nothing to carry over.'
      : 'Nothing for now.';
    wrap.appendChild(note);
    /* Reuses the scroll watcher's own fade rather than a second mechanism:
       `.away` already collapses height and hides from the tab order, which is
       what an element with nothing in it should do. */
    setTimeout(() => {
      if (!wrap.isConnected) return;
      wrap.classList.add('away');
      setTimeout(() => {
        for (const old of document.querySelectorAll('[data-contexa]')) {
          if (old.getAttribute('data-cx-mode') === 'nothing') old.remove();
        }
      }, 400);
    }, NOTHING_LINGERS_MS);
  }

  /* One mined idea. The whole prompt is already written, so the click composes
     and stops — no second call, no busy state, and no failure state, because
     there is nothing left that can fail. Three of the four earned move chips
     already behaved exactly this way before the pivot, inserting their text
     directly; this is that path, generalised to every item.

     `title` carries the full prompt, so hovering shows precisely what is about
     to land in the box. */
  function appendIdeaChip(row, m) {
    const chip = document.createElement('button');
    chip.className = 'chip move';
    chip.textContent = m.label;
    chip.title = m.text;
    chip.addEventListener('click', () => insertPrompt(m.text));
    row.appendChild(chip);
  }

  function renderQuiet(anchor, mode, reason, resp) {
    const wrap = shell(anchor, mode);
    if (!wrap) return;
    let body, btn = 'Settings', openUrl = null, doReload = false;
    if (mode === 'stale') {
      body = `CONTEXA was updated — reload this page to continue.`;
      btn = 'Reload';
    } else if (mode === 'quota') {
      /* This card is on the beginner surface, so it no longer pitches an API
         key — that is expert vocabulary, and the audience decision put it
         behind Advanced. Anyone who wants unlimited use finds it there. */
      /* The raw limit IS the headline number now. It was halved here because an
         interview spent two calls from the pool — one to write the questions,
         one to write the prompt — so the counter counted twice what the user
         experienced. Mining spends one call per reply and composes on the
         client, so the two numbers converged and the division became a lie in
         the user's favour's opposite direction: it would have told someone with
         20 replies left that they had 10.

         The unit changed with it. A call buys a look at one REPLY and returns
         up to four prompts the user may or may not take, so counting prompts
         would over-promise as badly as halving under-promised.

         And when the worker did not report a limit, no number is named. The
         old code fell back to a hard-coded 20, which is a second copy of a
         figure that lives in one place on purpose — the whole reason
         REPLIES_PER_DAY is derived rather than retyped. A vaguer true sentence
         beats a precise one this file cannot keep honest. */
      const limit = resp && resp.limit;
      body = limit
        ? `That’s all ${limit} free replies for today. They come back ${resetWording(resp && resp.resetsAt)}.`
        : `That’s all your free replies for today. They come back ${resetWording(resp && resp.resetsAt)}.`;
      btn = 'Settings';
    } else if (mode === 'unconfigured') {
      body = `CONTEXA isn’t connected to a backend yet. Add your own API key to use it now.`;
      btn = 'Add key';
    } else {
      /* The diagnostics stay — they have paid for themselves repeatedly — but
         they belong in the console, not in a card a beginner is reading. The
         first outside user this product ever had met the bare string
         "forbidden_origin" and had no idea he was simply running a dev copy.
         An error the reader cannot act on is worse than no error at all. */
      const d = resp && resp.diag;
      if (d) console.warn('[CONTEXA]', reason, d);
      const det = resp && resp.detail ? String(resp.detail).slice(0, 220) : '';
      if (det) console.warn('[CONTEXA] detail:', det);
      console.warn('[CONTEXA] error', reason);

      const said = humanError(reason);
      body = esc(said.text);
      btn = said.btn;
      if (said.reload) doReload = true;
      // Only this one has a fix the user can act on right now, so it gets a
      // real destination instead of the settings page.
      if (said.url) openUrl = said.url;
    }
    wrap.innerHTML = `<div class="quiet"><span><b style="color:var(--accent)">✦</b> ${body}</span>
      <button>${btn}</button></div>`;
    wrap.querySelector('button').addEventListener('click', () => {
      // no chrome.* on these two paths: they must work when the context is dead
      if (mode === 'stale' || doReload) return location.reload();
      if (openUrl) return window.open(openUrl, '_blank', 'noopener');
      try { chrome.runtime.sendMessage({ type: 'openOptions' }).catch(() => {}); } catch {}
    });
  }

  /* One plain sentence per failure, written for someone who has never seen an
     error code, plus the most useful button for that specific cause. Codes
     still go to the console for us. Anything unmapped falls back to a sentence
     that is at least honest and actionable. */
  const STORE_URL = 'https://chromewebstore.google.com/detail/phhamigkjeeabbjncpmhkppkjccfglhb';
  function humanError(code) {
    const c = String(code || '');
    if (/^forbidden_origin$/.test(c)) return {
      text: 'This copy of CONTEXA wasn’t installed from the Chrome Web Store, so it can’t use the free service. Install the store version and remove this one.',
      btn: 'Get CONTEXA', url: STORE_URL
    };
    if (/^(truncated|bad_json|no_steps|no_prompt|bad_response)$/.test(c)) return {
      text: 'Couldn’t write suggestions for this reply. Send another message and it’ll try again.',
      btn: 'Settings'
    };
    if (/^network$/.test(c) || /^proxy_5\d\d$/.test(c) || /^upstream_/.test(c)) return {
      text: 'Couldn’t reach the CONTEXA service. Check your connection and try again in a moment.',
      btn: 'Settings'
    };
    if (/^server_not_configured$/.test(c)) return {
      text: 'The CONTEXA service isn’t set up correctly right now. Nothing you can fix — try again later.',
      btn: 'Settings'
    };
    if (/^api_401$/.test(c) || /^no_key$/.test(c)) return {
      text: 'Your Anthropic API key was rejected. Check it in settings, or clear it to use the free service.',
      btn: 'Settings'
    };
    if (/^api_429$/.test(c)) return {
      text: 'Anthropic is rate-limiting your API key. Wait a moment and try again.',
      btn: 'Settings'
    };
    if (/^api_/.test(c)) return {
      text: 'Anthropic refused that request. If you set a model name in settings, check it’s spelled right.',
      btn: 'Settings'
    };
    if (/extension:/.test(c) || /^unknown_message$/.test(c)) return {
      // The sentence named the fix and the button did something else. Offer the
      // fix itself.
      text: 'CONTEXA lost its connection to this page. Reload the page to reconnect it.',
      btn: 'Reload', reload: true
    };
    return {
      text: 'Something went wrong generating suggestions. Send another message to try again.',
      btn: 'Settings'
    };
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
    if (composer && pendingBrief) landBrief();
  }

  /* The switch has to take effect in tabs that are ALREADY OPEN, in both
     directions, and before this it did neither.

     Only tick() consulted settings.enabled — and tick() is not what draws
     anything. watchReplies' MutationObserver is, and switching off left it
     attached, so a disabled CONTEXA went on capturing every completed reply
     and mounting a card until the tab was reloaded. The settings page says
     "Suggestions will not appear until you turn it back on"; it was not true
     of any tab already open when you flipped it.

     Switching back ON had the mirror defect: a tab that LOADED while disabled
     returned before ever starting the interval, so it stayed dead for that
     tab's life no matter what the switch said afterwards.

     Both directions now run through one pair of functions, and onReplyComplete
     re-checks the flag itself — the observer is asynchronous, so a reply that
     was already in flight when the switch flipped must not slip through. */
  function startUp() {
    if (tickTimer) return;                // already running; nothing to restart
    tickTimer = setInterval(tick, 900);   // re-finds the composer across SPA navigation
    tick();
  }

  function shutDown() {
    standDown();                 // stops the loop AND disconnects the reply observer
    composer = null;             // the next startUp re-finds it and re-attaches
    for (const old of document.querySelectorAll('[data-contexa]')) old.remove();
  }

  chrome.storage.local.get({ enabled: true, apiKey: '', model: 'claude-sonnet-5' }, s => {
    settings = s;
    if (settings.enabled) { startUp(); collectBrief(); }
  });

  chrome.storage.onChanged.addListener(ch => {
    if (ch.apiKey) settings.apiKey = ch.apiKey.newValue;
    if (ch.model) settings.model = ch.model.newValue;
    if (ch.enabled) {
      settings.enabled = ch.enabled.newValue;
      if (settings.enabled) startUp(); else shutDown();
    }
  });
})();
