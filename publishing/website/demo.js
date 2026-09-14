/* CONTEXA website — the only script, same-origin, no dependencies.
   Progressive enhancement: with JS off the page shows complete static frames;
   this file adds the nav behaviour, scroll reveals, and the two faux-browser
   demos. All animation honours prefers-reduced-motion. Nothing is loaded from
   or sent to any other origin. */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  root.classList.add("js");

  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }

  /* ---------------- Footer year ---------------- */
  var yr = $("#year");
  if (yr) yr.textContent = String(new Date().getFullYear());

  /* ---------------- Nav: scrolled state ---------------- */
  var nav = $("#nav");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------------- Mobile drawer ---------------- */
  (function () {
    var toggle = $("#navToggle");
    var drawer = $("#drawer");
    var scrim = $("#drawerScrim");
    var closeBtn = $("#drawerClose");
    if (!toggle || !drawer || !scrim) return;

    function open() {
      drawer.hidden = false; scrim.hidden = false;
      // allow the display change to apply before transitioning
      requestAnimationFrame(function () { doc.body.classList.add("drawer-open"); });
      toggle.setAttribute("aria-expanded", "true");
    }
    function close() {
      doc.body.classList.remove("drawer-open");
      toggle.setAttribute("aria-expanded", "false");
      window.setTimeout(function () {
        if (!doc.body.classList.contains("drawer-open")) { drawer.hidden = true; scrim.hidden = true; }
      }, 300);
    }
    toggle.addEventListener("click", open);
    scrim.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);
    drawer.addEventListener("click", function (e) {
      if (e.target.closest("a")) close();
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && doc.body.classList.contains("drawer-open")) close();
    });
  })();

  /* ---------------- Opening intro (landing only) ---------------- */
  (function () {
    var intro = $("#intro");
    if (!intro) return; // sub-pages have no intro
    var enter = $("#introEnter");
    doc.body.classList.add("intro-open");

    var gone = false;
    function dismiss() {
      if (gone) return;
      gone = true;
      intro.classList.add("intro--leaving");
      doc.body.classList.remove("intro-open");
      var settled = false;
      var finish = function () {
        if (settled) return;
        settled = true;
        intro.classList.add("intro--gone");
      };
      if (reduce) { finish(); return; }
      intro.addEventListener("transitionend", function h(e) {
        if (e.target === intro && e.propertyName === "opacity") { intro.removeEventListener("transitionend", h); finish(); }
      });
      window.setTimeout(finish, 900); // fallback if transitionend never fires
    }

    if (enter) enter.addEventListener("click", dismiss);
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") dismiss(); });

    // move keyboard focus to the primary control once it has animated in
    window.setTimeout(function () {
      if (gone || !enter) return;
      try { enter.focus({ preventScroll: true }); } catch (e) { try { enter.focus(); } catch (e2) {} }
    }, reduce ? 0 : 1350);
  })();

  /* ---------------- Reveal on scroll ---------------- */
  (function () {
    var els = Array.prototype.slice.call(doc.querySelectorAll(".reveal"));
    if (!els.length) return;
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.18 });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ---------------- Shared demo helpers ---------------- */
  function pointAt(wrap, cursor, el, down) {
    if (!wrap || !cursor || !el) return;
    var w = wrap.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    cursor.style.left = (r.left - w.left + r.width * 0.5) + "px";
    cursor.style.top = (r.top - w.top + r.height * 0.5) + "px";
    cursor.classList.add("visible");
    cursor.classList.toggle("down", !!down);
  }
  function hideCursor(cursor) { if (cursor) { cursor.classList.remove("visible", "down"); } }

  // A cancellable timeline. Push timeouts; clear() cancels them all.
  function Timeline() { this.ids = []; }
  Timeline.prototype.after = function (ms, fn) { this.ids.push(window.setTimeout(fn, ms)); };
  Timeline.prototype.clear = function () { this.ids.forEach(clearTimeout); this.ids = []; };

  // Type a string into `field` char by char; calls done() when finished.
  function typeInto(field, text, speed, done, keepCaret) {
    var i = 0;
    field.classList.remove("empty");
    field.textContent = "";
    var caret = doc.createElement("span");
    caret.className = "caret";
    field.appendChild(caret);
    var id = window.setInterval(function () {
      i += 1;
      field.textContent = text.slice(0, i);
      if (!keepCaret || i < text.length) { field.appendChild(caret); }
      if (i >= text.length) {
        window.clearInterval(id);
        caret.remove();
        if (done) done();
      }
    }, speed);
    return function cancel() { window.clearInterval(id); };
  }

  // Start a loop only once its element scrolls into view (saves work off-screen).
  function whenVisible(el, start) {
    if (!("IntersectionObserver" in window)) { start(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { io.disconnect(); start(); } });
    }, { threshold: 0.35 });
    io.observe(el);
  }

  /* ---------------- Next-moves demo ---------------- */
  (function () {
    var win = $("#moves-window");
    if (!win) return;
    var wrap = win.closest(".demo-wrap");
    var typing = $("#moves-typing", win);
    var reply = $("#moves-reply", win);
    var chips = Array.prototype.slice.call(win.querySelectorAll("#moves-chips .chip"));
    var field = $("#moves-field", win);
    var composer = $("#moves-composer", win);
    var cursor = $("#moves-cursor", win);
    var CHOSEN = "Add food stops for each day — one lunch and one dinner near the places you listed.";

    function setFilled() {
      typing.hidden = true; reply.hidden = false;
      win.setAttribute("data-menu", "on");
      chips.forEach(function (c, i) {
        c.classList.toggle("is-selected", i === 0);
        c.classList.toggle("is-dim", i !== 0);
      });
      field.classList.remove("empty"); field.textContent = CHOSEN;
      composer.classList.add("armed");
    }

    if (reduce) { setFilled(); return; }

    var tl = new Timeline();
    var cancelType = null;

    function reset() {
      tl.clear();
      if (cancelType) { cancelType(); cancelType = null; }
      typing.hidden = false; reply.hidden = true;
      win.setAttribute("data-menu", "off");
      chips.forEach(function (c) { c.classList.remove("is-selected", "is-dim"); });
      field.textContent = "Reply to Claude…"; field.classList.add("empty");
      composer.classList.remove("armed");
      hideCursor(cursor);
    }

    function cycle() {
      reset();
      tl.after(1500, function () { typing.hidden = true; reply.hidden = false; });
      tl.after(2400, function () { win.setAttribute("data-menu", "on"); });
      tl.after(3900, function () { requestAnimationFrame(function () { pointAt(wrap, cursor, chips[0]); }); });
      tl.after(4500, function () { pointAt(wrap, cursor, chips[0], true); });
      tl.after(4700, function () {
        pointAt(wrap, cursor, chips[0], false);
        chips[0].classList.add("is-selected");
      });
      tl.after(4950, function () {
        hideCursor(cursor);
        chips.forEach(function (c, i) { if (i !== 0) c.classList.add("is-dim"); });
        composer.classList.add("armed");
        cancelType = typeInto(field, CHOSEN, 24, null, true);
      });
      tl.after(9200, cycle);
    }

    whenVisible(win, cycle);
  })();

  /* ---------------- Start-fresh demo (hero) — click-driven ----------------
     Rests on the heavy thread and only opens the new chat when the visitor
     presses Start fresh. No autoplay, so the first frame shows the thread
     and the control, not the result. */
  (function () {
    var win = $("#sf-window");
    if (!win) return;
    var field = $("#sf-field", win);
    var composer = $("#sf-composer", win);
    var btn = $("#sf-btn", win);
    var resetBtn = $("#sf-reset", win);
    var BRIEF = "Carry over: working through quadratics — factoring when the number in front isn't one, completing the square, and where the quadratic formula comes from. Keep it intuitive, not just formulas. Next: how derivatives connect to the vertex.";
    var cancelType = null;

    function addSlot() {
      var slot = doc.createElement("span");
      slot.className = "paste-slot";
      slot.textContent = "<paste here>";
      field.appendChild(slot);
    }

    function toThread() {
      if (cancelType) { cancelType(); cancelType = null; }
      win.setAttribute("data-view", "thread");
      field.textContent = "Message Claude…";
      field.classList.add("empty");
      composer.classList.remove("armed");
    }

    function toBrief() {
      if (win.getAttribute("data-view") === "new") return;
      win.setAttribute("data-view", "new");
      composer.classList.add("armed");
      if (reduce) {
        field.classList.remove("empty");
        field.textContent = BRIEF;
        addSlot();
      } else {
        cancelType = typeInto(field, BRIEF, 18, addSlot, true);
      }
    }

    toThread(); // always start at rest on the thread
    btn.addEventListener("click", toBrief);
    if (resetBtn) resetBtn.addEventListener("click", toThread);
  })();
})();
