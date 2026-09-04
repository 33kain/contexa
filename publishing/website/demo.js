/* The reproduced card on the overview page. The card's markup and classes are
   the ones extension/content.js renders (renderTrigger, renderMoves,
   appendIdeaChip); the prompt is placed in the box in one assignment, as
   insertPrompt does. The conversation is invented; the mechanism is not.
   No network, no storage, nothing measured. The frame follows the visitor's
   colour scheme; the only controls are Replay and Pause. */
(function () {
  'use strict';
  var demo = document.getElementById('demo');
  if (!demo) return;

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

  // scene name, time offset from the start of the loop, caption
  var SCENES = [
    ['idle',     0,    'A reply has just finished. Nothing has been read from the session, sent, or spent.'],
    ['trigger',  500,  'One trigger appears above the message box. That is all that happens.'],
    ['peek',     2300, 'One trigger appears above the message box. That is all that happens.'],
    ['busy',     3100, 'On the press, and only now, it reads your own messages from this conversation.'],
    ['moves',    4400, 'Three moves came back, each a complete message. You need only one.'],
    ['hover',    5700, 'The first move is earned by your first message, which the reply on screen never mentions.'],
    ['composed', 6500, 'One click: the whole prompt is in the box, with an Assume: line you can change. Nothing sent.']
  ];
  var LOOP_AT = 11000;

  var slot = document.getElementById('slot');
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

  function newWrap() {
    var w = document.createElement('div');
    w.className = 'wrap';
    w.setAttribute('data-theme', mode);
    w.innerHTML = '<div class="label"><b>✦</b> CONTEXA</div><div class="chips"></div>';
    slot.replaceChildren(w);
    if (demo.classList.contains('noanim')) { w.classList.add('show'); }
    else { requestAnimationFrame(function () { requestAnimationFrame(function () { w.classList.add('show'); }); }); }
    return w;
  }
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
    idle: function () {
      slot.replaceChildren();
      box.textContent = '';
      composer.classList.remove('filled');
      turn1.classList.remove('lit');
      pointerOff();
    },
    trigger: function () {
      var w = newWrap();
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
      box.textContent = MOVES[0].text;   // one assignment, as insertPrompt does
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
    live.textContent = SCENES[i][2];
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
    toggle.setAttribute('aria-pressed', 'false');
    if (current >= SCENES.length - 1 || current < 0) { current = -1; setScene(0); }
    scheduleNext();
  }
  function pause() {
    playing = false;
    clearTimers();
    toggle.textContent = 'Play';
    toggle.setAttribute('aria-pressed', 'true');
  }
  toggle.addEventListener('click', function () {
    if (playing) { userPaused = true; pause(); }
    else { userPaused = false; play(); }
  });
  replay.addEventListener('click', function () {
    userPaused = false;
    pause();
    current = -1;
    setScene(0);
    play();
  });

  // Start. Reduced motion: no autoplay, land on the result.
  if (reduced) {
    setScene(SCENES.length - 1);
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
    else if (name === 'hover') pointerTo(firstChip());
  });
})();
