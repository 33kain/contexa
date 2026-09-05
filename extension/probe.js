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
  const report = (u) => {
    try {
      const p = new URL(String(u && u.url ? u.url : u), location.href);
      if (p.origin !== location.origin || !p.pathname.startsWith('/api/')) return;
      if (seen.has(p.pathname)) return;
      seen.add(p.pathname);
      document.dispatchEvent(new CustomEvent('contexa-api-path', { detail: p.pathname }));
    } catch { /* not a URL; not ours */ }
  };
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input) { report(input); return origFetch.apply(this, arguments); };
  }
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) { report(url); return origOpen.apply(this, arguments); };
})();
