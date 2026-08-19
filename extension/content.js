/* CONTEXA — content script for claude.ai.
   One job: when Claude finishes a reply, offer five logical next steps.
   Click one to load it into the composer. Nothing overlays the composer, and
   nothing is rendered unless it is real. If the DOM shape changes, the script
   goes quiet rather than breaking the page. */

(() => {
  if (window.__contexaLoaded) return;
  window.__contexaLoaded = true;

  let settings = { enabled: true, apiKey: '', model: 'claude-haiku-4-5' };
  let composer = null;
  let replyObserver = null;

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
  .quiet button{margin-left:auto;flex:none;border:1px solid var(--border2);background:transparent;
    color:var(--text2);border-radius:6px;padding:2px 8px;font-size:10px;letter-spacing:.06em;
    text-transform:uppercase;cursor:pointer;font-family:inherit}
  .quiet button:hover{color:var(--accent);border-color:var(--accent)}
  .note{font-size:10.5px;color:var(--amber-text);background:var(--amber-bg);
    border-radius:6px;padding:4px 8px;margin-bottom:5px;line-height:1.4}`;

  const esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };

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
      if (above.length) return (above[above.length - 1].textContent || '').trim();
    }
    return (msgs[msgs.length - 1].textContent || '').trim();
  }

  async function onReplyComplete(replyEl) {
    if (!replyEl.isConnected) return;
    const anchor = replyEl.closest(ROW_SEL) || replyEl.closest(STREAM_SEL) || replyEl;
    if (anchor.nextElementSibling?.getAttribute?.('data-contexa') === 'steps') return;

    let resp = null, thrown = null;
    try {
      resp = await chrome.runtime.sendMessage({
        type: 'nextSteps',
        prompt: lastUserMessage(replyEl),
        reply: (replyEl.textContent || '').trim().slice(0, 6000)
      });
    } catch (e) { thrown = String(e && e.message || e); }

    if (!anchor.isConnected) return;
    const steps = resp && !resp.error && Array.isArray(resp.steps)
      ? resp.steps.filter(s => s && typeof s.text === 'string' && s.text.trim())
      : null;

    if (!steps || !steps.length) {
      const err = resp && resp.error;
      if (err === 'quota') return renderQuiet(anchor, 'quota', '', resp);
      if (err === 'proxy_not_configured') return renderQuiet(anchor, 'unconfigured');
      return renderQuiet(anchor, 'error',
        thrown ? 'extension: ' + thrown : err || 'empty response');
    }
    renderSteps(anchor, steps.slice(0, 5), resp.partial === true);
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

  // Chip text is a <=5 word handle; the payload is the full prompt. Enforced
  // here too, so a chatty model can never blow up the row's layout.
  function shortLabel(s, max = 5) {
    const words = String(s || '').trim().replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    return words.length <= max ? words.join(' ') : words.slice(0, max).join(' ') + '…';
  }

  function renderSteps(anchor, steps, partial) {
    const wrap = shell(anchor, 'ai');
    wrap.innerHTML = `<div class="label"><b>✦ CONTEXA</b></div>` +
      (partial ? `<div class="note">Response was cut short — showing the ${steps.length} that came through complete.</div>` : '') +
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
  }

  // No canned tiles, ever: a degraded state says what happened instead of
  // dressing up generic text as real suggestions.
  function renderQuiet(anchor, mode, reason, resp) {
    const wrap = shell(anchor, mode);
    let body, btn = 'Settings';
    if (mode === 'quota') {
      const limit = resp && resp.limit ? resp.limit : 20;
      body = `Daily limit reached (${limit} replies). Resets ${resetWording(resp && resp.resetsAt)}
        — or add your own API key for unlimited use.`;
      btn = 'Add key';
    } else if (mode === 'unconfigured') {
      body = `CONTEXA isn’t connected to a backend yet. Add your own API key to use it now.`;
      btn = 'Add key';
    } else {
      body = `Couldn’t generate next steps (<code>${esc(reason)}</code>).`;
    }
    wrap.innerHTML = `<div class="quiet"><span><b style="color:var(--accent)">✦</b> ${body}</span>
      <button>${btn}</button></div>`;
    wrap.querySelector('button').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'openOptions' }).catch(() => {});
    });
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

  function insertPrompt(text) {
    if (!composer) composer = findComposer();
    if (!composer) return;
    composer.focus();
    window.getSelection().selectAllChildren(composer);
    // execCommand cooperates with ProseMirror; fall back to textContent
    if (!document.execCommand('insertText', false, text)) composer.textContent = text;
    composer.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  /* ---------------- lifecycle -------------------------------------------- */
  function tick() {
    if (!settings.enabled) return;
    const el = findComposer();
    if (el && el !== composer) { composer = el; watchReplies(); }
    if (composer && !composer.isConnected) composer = null;
  }

  chrome.storage.local.get({ enabled: true, apiKey: '', model: 'claude-haiku-4-5' }, s => {
    settings = s;
    if (!settings.enabled) return;
    setInterval(tick, 900);   // re-finds the composer across SPA navigation
    tick();
  });

  chrome.storage.onChanged.addListener(ch => {
    if (ch.apiKey) settings.apiKey = ch.apiKey.newValue;
    if (ch.model) settings.model = ch.model.newValue;
    if (ch.enabled) settings.enabled = ch.enabled.newValue;
  });
})();
