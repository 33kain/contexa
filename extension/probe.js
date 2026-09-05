/* CONTEXA — page-world probe (0.9.78, a field diagnostic).
   Runs in the page's own JavaScript world, not the content script's isolated
   one, because the one thing it does cannot be done from there: see which of
   its own API paths the page calls. The second field session was on a Cowork
   session (/cowork/cse_…), whose conversation API this product does not know
   and will not guess; the page knows, and this records only the PATHS it
   uses — never a body, never a header, never a response — and hands each new
   one to the content script as a string. The content script shows them in the
   three-tap diagnostic card and nowhere else. Same-origin /api/ paths only.
   To be removed, or kept as the selector-drift diagnostic, once the endpoint
   is known. */
(() => {
  if (window.__contexaProbe) return;
  window.__contexaProbe = true;
  const seen = new Set();
  /* 0.9.79 — every transport, any host. The Cowork session's content was
     nowhere among the same-origin fetches, so it arrives another way: a
     WebSocket, an EventSource, or another origin. Recorded as
     "<transport> <host if not this one><path>", paths only; static assets and
     the page's own analytics are skipped as noise. */
  const report = (kind, u) => {
    try {
      const p = new URL(String(u && u.url ? u.url : u), location.href);
      if (/\.(js|css|png|jpg|svg|woff2?|ico|map)$/i.test(p.pathname)) return;
      if (/event_logging|\/api\/analytics/.test(p.pathname)) return;
      const key = kind + ' ' + (p.origin === location.origin ? '' : p.host) + p.pathname;
      if (seen.has(key)) return;
      seen.add(key);
      document.dispatchEvent(new CustomEvent('contexa-api-path', { detail: key }));
    } catch { /* not a URL; not ours */ }
  };
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input) { report('fetch', input); return origFetch.apply(this, arguments); };
  }
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) { report('xhr', url); return origOpen.apply(this, arguments); };
  const OrigWS = window.WebSocket;
  if (typeof OrigWS === 'function') {
    const WS = function (url, protocols) { report('ws', url); return protocols === undefined ? new OrigWS(url) : new OrigWS(url, protocols); };
    WS.prototype = OrigWS.prototype;
    for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) WS[k] = OrigWS[k];
    window.WebSocket = WS;
  }
  const OrigES = window.EventSource;
  if (typeof OrigES === 'function') {
    const ES = function (url, init) { report('sse', url); return init === undefined ? new OrigES(url) : new OrigES(url, init); };
    ES.prototype = OrigES.prototype;
    window.EventSource = ES;
  }
})();
