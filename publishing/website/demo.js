/* The reproduced card on the overview page. Two acts, in the order the saving
   matters: first the exit from a heavy thread (costLine and renderBrief, 0.9.73),
   then the row of moves (renderTrigger, renderMoves). The markup and classes are
   the ones extension/content.js renders; the prompt and the brief are placed in
   the box as one block of text, as insertPrompt does (which, in the extension,
   appends below any draft). The conversation is invented; the mechanism is not.
   No network, no storage, nothing measured — the brief's token figure is the
   chars/4 estimate of the brief actually shown, and is smaller than the briefs
   measured on real threads because this conversation is a simple one.
   The frame follows the visitor's colour scheme; the only controls are Replay
   and Pause. */
(function () {
  'use strict';
  var demo = document.getElementById('demo');
  if (!demo) return;
  var controls = document.querySelector('.figure-controls');
  if (controls) controls.hidden = false;

  var MOVES = [
    { label: 'Plan three weeks of rehearsal',
      text: 'Give me a three-week rehearsal plan for a five-minute wedding toast, for someone who has never spoken in public.\n' +
            '- week by week, ten minutes a day at most\n' +
            '- what to do about a shaking voice and losing my place\n' +
            '- when to stop editing the words and only practise saying them\n' +
            'Assume: the four-part structure is settled; this is about delivery, not writing.' },
    { label: 'Turn the structure into cue cards',
      text: 'Turn the four-part toast structure into cue cards.\n' +
            '- one card per part, five words or fewer on each\n' +
            '- the opening line and the closing toast written out in full\n' +
            '- nothing else on the cards\n' +
            'Keep the timings from the structure.' },
    { label: 'Write the closing toast line',
      text: 'Write five options for the closing line of the toast, the sentence I say as everyone raises a glass. ' +
            'Short and warm, not a joke. One sentence each, and say which one you would pick.' }
  ];

  /* The brief the fork writes: the same shape a move has to have — the goal,
     what the session settled, what is open, and a <paste here> slot for what
     the new conversation will not have. THREAD_K is what the cost line counts;
     BRIEF_TOKENS is chars/4 of the text below, the estimate the extension uses,
     so the card's sentence and its message box cannot disagree. */
  var THREAD_K = '14k';
  var BRIEF = 'Goal: write and deliver a five-minute toast at my sister\'s wedding in three weeks. I have never spoken in public.\n' +
    'Settled:\n' +
    '- four parts, in order: who I am to her (30s), one story told straight (2min), what changed when she met him (1min), the toast (30s)\n' +
    '- one story only, with a detail nobody else would know\n' +
    '- write it out in full first, cut it to cue cards later\n' +
    'Open: which story to use, and how to rehearse it.\n' +
    'Have: the four-part structure with its timings, in full <paste here>\n' +
    'Next: a three-week rehearsal plan, ten minutes a day at most.';
  var BRIEF_TOKENS = Math.round(BRIEF.length / 4);

  // Kept in step with extension/content.js MASCOT_SVG, paint servers included:
  // the figure shows the product, so it must not show a face the product fixed.
  var MASCOT_SVG = '<svg width="58" height="50" viewBox="0 0 58 50" aria-hidden="true">' +
    '<defs><linearGradient id="ctxaMg" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#2cc4ae"/><stop offset="1" stop-color="#15a594"/>' +
    '</linearGradient>' +
    '<linearGradient id="ctxaPg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="58" y2="0">' +
    '<stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#000"/></linearGradient>' +
    '<linearGradient id="ctxaOg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="58" y2="0">' +
    '<stop offset="0" stop-color="#0a352f"/><stop offset="1" stop-color="#0a352f"/></linearGradient>' +
    '<linearGradient id="ctxaWg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="58" y2="0">' +
    '<stop offset="0" stop-color="#2cc4ae"/><stop offset="1" stop-color="#2cc4ae"/></linearGradient>' +
    '</defs>' +
    '<path d="M29 3 C43 3 53 12 53 26 L53 50 L5 50 L5 26 C5 12 15 3 29 3 Z" fill="url(#ctxaMg)"/>' +
    '<g class="ctxa-mas-pup">' +
    '<g><ellipse cx="21" cy="25.5" rx="7.4" ry="8.6" fill="#fff"/>' +
    '<circle cx="22.9" cy="27.2" r="3.8" fill="url(#ctxaPg)"/>' +
    '<circle cx="21.7" cy="25.9" r="1.3" fill="#fff" opacity=".95"/></g>' +
    '<g class="ctxa-mas-wink"><ellipse cx="37" cy="25.5" rx="7.4" ry="8.6" fill="#fff"/>' +
    '<circle cx="38.9" cy="27.2" r="3.8" fill="url(#ctxaPg)"/>' +
    '<circle cx="37.7" cy="25.9" r="1.3" fill="#fff" opacity=".95"/></g>' +
    '</g>' +
    '<path d="M25 37 Q29 39.5 33 37" stroke="url(#ctxaOg)" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
    '<ellipse class="ctxa-mas-whisp" cx="41" cy="37" rx="4.6" ry="3.4" fill="url(#ctxaWg)"/>' +
    '</svg>';

  /* scene name, time offset from the start of the loop, caption. Act one is
     the exit, because that is what the name and the short description lead
     with; act two is the row. Scene 0 is a full reset, so a jump to any scene
     can replay the deltas from it. */
  var SCENES = [
    ['heavy',    0,     'Forty messages in, every send re-reads the whole thread. The card says how much, and offers the way out.'],
    ['fresh',    2100,  'One press. The brief is written from your own side of the conversation.'],
    ['brief',    3700,  'A hundred-odd tokens in place of fourteen thousand. The chip\'s hover text is the brief itself.'],
    ['landed',   5500,  'A new conversation, with the brief already in the message box. Nothing sent: you read it, change it, send it.'],
    ['back',     9000,  'The other half, back on the thread. The line and its button stay while the thread is heavy.'],
    ['peek',     10200, 'One trigger above the message box. Nothing has been read from the session, sent, or spent.'],
    ['busy',     11400, 'On the press, and only now, it reads your own messages from this conversation.'],
    ['moves',    12700, 'Three moves came back, each a complete message. You need only one.'],
    ['hover',    14000, 'The first move is earned by your first message, which the reply on screen never mentions.'],
    ['composed', 14800, 'One click: the whole prompt is in the box, with an Assume: line you can change. Nothing sent.']
  ];
  var LOOP_AT = 19300;

  var slot = document.getElementById('slot');
  var top = document.getElementById('top');
  var box = document.getElementById('box');
  var composer = document.getElementById('composer');
  var turn1 = document.getElementById('turn1');
  var pointer = document.getElementById('pointer');
  var cap = document.getElementById('cap');
  var live = document.getElementById('live');
  var toggle = document.getElementById('toggle');
  var replay = document.getElementById('replay');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var mode = darkQuery && darkQuery.matches ? 'dark' : 'light';
  var current = -1;
  var timers = [];
  var playing = false;
  var userPaused = false;

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function applyMode() {
    demo.setAttribute('data-mode', mode);
    Array.prototype.forEach.call(slot.querySelectorAll('.wrap'), function (w) { w.setAttribute('data-theme', mode); });
  }
  if (darkQuery) {
    var onChange = function (e) { mode = e.matches ? 'dark' : 'light'; applyMode(); };
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onChange);
    else if (darkQuery.addListener) darkQuery.addListener(onChange);
  }
  applyMode();

  function newWrap(noChips) {
    var w = document.createElement('div');
    w.className = 'wrap';
    w.setAttribute('data-theme', mode);
    w.innerHTML = '<div class="label"><b>✦</b> CONTEXA</div>' + (noChips ? '' : '<div class="chips"></div>');
    slot.replaceChildren(w);
    if (demo.classList.contains('noanim')) { w.classList.add('show'); }
    else { requestAnimationFrame(function () { requestAnimationFrame(function () { w.classList.add('show'); }); }); }
    return w;
  }
  /* costLine(): content.js appends this to the card's LABEL row, not the chips
     row — it is a number and a small button, not a second headline. Every card
     drawn while the thread is heavy carries it, which is why act two's cards
     have it too. */
  function costLine(w) {
    var cost = document.createElement('span');
    cost.className = 'ctxa-cost';
    var words = document.createElement('span');
    words.textContent = '≈ ' + THREAD_K + ' tokens re-read per send';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.tabIndex = -1;
    btn.textContent = 'Start fresh';
    btn.title = 'Write a brief of this thread and open a new chat with it';
    cost.appendChild(words);
    cost.appendChild(btn);
    w.querySelector('.label').appendChild(cost);
  }
  function addTrigger(w) {
    var s = document.createElement('span');
    s.className = 'ctxa-mas-slot';
    var b = document.createElement('button');
    b.className = 'ctxa-mas';
    b.type = 'button';
    b.tabIndex = -1;
    b.setAttribute('aria-label', 'What now?');
    b.innerHTML = MASCOT_SVG + '<span class="ctxa-mas-bubble">What now? <b>✦</b></span>';
    s.appendChild(b);
    w.querySelector('.chips').appendChild(s);
  }
  function thread(view) {
    demo.setAttribute('data-view', view);
    top.textContent = view === 'new' ? 'New chat' : 'Claude';
  }
  function forkButton() { return slot.querySelector('.ctxa-cost button'); }
  function mascot() { return slot.querySelector('.ctxa-mas'); }
  function firstChip() { return slot.querySelector('.chip.move'); }
  function pointerTo(el) {
    if (!el || reduced) return;
    var a = demo.getBoundingClientRect(), b = el.getBoundingClientRect();
    pointer.style.left = (b.left - a.left + b.width / 2) + 'px';
    pointer.style.top = (b.top - a.top + b.height / 2) + 'px';
    pointer.classList.add('on');
  }
  function pointerPress() {
    if (reduced) return;
    pointer.classList.add('press');
    later(function () { pointer.classList.remove('press'); }, 160);
  }
  function pointerOff() { pointer.classList.remove('on'); }

  // Each delta moves the frame forward by exactly one scene.
  var DELTA = {
    // Act one: the exit.
    heavy: function () {                 // scene 0, and the full reset
      thread('thread');
      slot.replaceChildren();
      box.textContent = '';
      composer.classList.remove('filled');
      turn1.classList.remove('lit');
      pointerOff();
      var w = newWrap();
      costLine(w);
      addTrigger(w);
    },
    fresh: function () {
      var b = forkButton();
      if (!b) return;
      pointerTo(b);
      pointerPress();
      b.classList.add('is-hover');
      later(function () {
        if (!b.isConnected) return;             // a jump may have replaced the card already
        b.classList.remove('is-hover');
        b.disabled = true;
        b.textContent = 'writing the brief…';   // content.js's own wording while the call is out
      }, 200);
    },
    brief: function () {
      pointerOff();
      var w = newWrap(true);               // renderBrief's card is the label and the brief row
      var row = document.createElement('div');
      row.className = 'brief';
      var said = document.createElement('span');
      said.textContent = 'Brief ready: ≈ ' + BRIEF_TOKENS + ' tokens instead of ≈ ' + THREAD_K + ' per send.';
      var chip = document.createElement('button');
      chip.className = 'chip move';
      chip.type = 'button';
      chip.tabIndex = -1;
      chip.textContent = 'Open a new chat with it';
      chip.title = BRIEF;                  // the chip's title IS the brief, as in the extension
      row.appendChild(said);
      row.appendChild(chip);
      w.appendChild(row);
      later(function () { if (!chip.isConnected) return; chip.classList.add('is-hover'); pointerTo(chip); }, 800);
    },
    landed: function () {
      pointerPress();
      slot.replaceChildren();
      thread('new');
      box.textContent = BRIEF;             // one assignment, as insertPrompt does
      composer.classList.add('filled');
      pointerOff();
    },
    // Act two: the row, on the thread the fork was offered from.
    back: function () {
      thread('thread');
      box.textContent = '';
      composer.classList.remove('filled');
      var w = newWrap();
      costLine(w);
      addTrigger(w);
    },
    peek: function () {
      var m = mascot();
      if (m) { m.classList.add('ctxa-peek'); pointerTo(m); }
    },
    busy: function () {
      var m = mascot();
      pointerPress();
      if (m) {
        m.disabled = true;
        m.classList.add('ctxa-hop');
        var b = document.createElement('span');
        b.className = 'chip busy';
        b.textContent = '✦ reading…';
        m.parentNode.appendChild(b);
      }
    },
    moves: function () {
      pointerOff();
      var w = newWrap();
      costLine(w);
      var row = w.querySelector('.chips');
      MOVES.forEach(function (m) {
        var chip = document.createElement('button');
        chip.className = 'chip move';
        chip.type = 'button';
        chip.tabIndex = -1;
        chip.textContent = m.label;
        chip.title = m.text;
        row.appendChild(chip);
      });
    },
    hover: function () {
      var c = firstChip();
      if (c) { c.classList.add('is-hover'); pointerTo(c); }
      turn1.classList.add('lit');
    },
    composed: function () {
      pointerPress();
      box.textContent = MOVES[0].text;   // one block of text; the extension's insertPrompt appends below any existing draft
      composer.classList.add('filled');
      var c = firstChip();
      later(function () { if (c) c.classList.remove('is-hover'); pointerOff(); }, 420);
    }
  };

  function setScene(i) {
    i = Math.max(0, Math.min(SCENES.length - 1, i));
    if (i === current + 1) {
      DELTA[SCENES[i][0]]();
    } else {
      demo.classList.add('noanim');
      for (var k = 0; k <= i; k++) DELTA[SCENES[k][0]]();
      void demo.offsetWidth;
      requestAnimationFrame(function () { demo.classList.remove('noanim'); });
    }
    current = i;
    cap.textContent = SCENES[i][2];
  }
  function scheduleNext() {
    clearTimers();
    if (!playing) return;
    var next = current + 1;
    if (next < SCENES.length) {
      later(function () { setScene(next); scheduleNext(); }, SCENES[next][1] - SCENES[current][1]);
    } else {
      later(function () {
        demo.classList.add('fade');
        later(function () {
          current = -1;
          setScene(0);
          demo.classList.remove('fade');
          scheduleNext();
        }, 320);
      }, LOOP_AT - SCENES[current][1]);
    }
  }
  function play() {
    if (playing) return;
    playing = true;
    toggle.textContent = 'Pause';
    if (current >= SCENES.length - 1 || current < 0) { current = -1; setScene(0); }
    scheduleNext();
  }
  function pause() {
    playing = false;
    clearTimers();
    toggle.textContent = 'Play';
  }
  // The live region speaks only for what the visitor did; the loop itself
  // stays silent, and the sr-only transcript tells the whole story once.
  toggle.addEventListener('click', function () {
    if (playing) { userPaused = true; pause(); live.textContent = 'Paused. ' + SCENES[current][2]; }
    else { userPaused = false; play(); live.textContent = 'Playing.'; }
  });
  replay.addEventListener('click', function () {
    userPaused = false;
    pause();
    current = -1;
    setScene(0);
    play();
    live.textContent = 'Replaying from the start.';
  });

  /* Start. Reduced motion: no autoplay, land on a result — the brief in the new
     conversation's message box, which is the half the name and the page lead
     with. The transcript below the figure carries both acts in full. */
  var RESTING = 3;
  if (reduced) {
    setScene(RESTING);
    pause();
  } else {
    setScene(0);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var inView = entries[0].isIntersecting;
        if (inView && !userPaused) play();
        else if (!inView && playing) { playing = false; clearTimers(); }
      }, { threshold: 0.25 }).observe(demo);
    } else {
      play();
    }
  }
  window.addEventListener('resize', function () {
    if (!pointer.classList.contains('on')) return;
    var name = SCENES[current][0];
    if (name === 'peek' || name === 'busy') pointerTo(mascot());
    else if (name === 'fresh') pointerTo(forkButton());
    else if (name === 'brief' || name === 'hover') pointerTo(firstChip());
  });
})();
