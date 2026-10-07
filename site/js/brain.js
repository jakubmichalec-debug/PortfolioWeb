/* Chapter 07, "the brain": a wiring diagram drawn from the real sketch's pin assignments
   (site/assets/code/pinball.ino), not a generic Arduino picture. It draws itself in as it
   scrolls into view, then plays the game's events on a loop - a pulse runs along each wire
   involved, in the direction the signal actually goes, and the machine's display shows the
   sketch's own text. The RFID reader went in after the sketch on this site was written, so its
   pins are the one thing not read from it: see the note on the IN list. story.js calls
   window.buildBrain() for the Electronics chapter. */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // [arduino pin, what it is at the device end, 'in' = device -> board | 'out' = board -> device]
  const IN = [
    { name: 'Flipper buttons', note: 'INPUT_PULLUP', pins: [['D4', 'left', 'in'], ['D3', 'right', 'in']] },
    { name: 'Targets', note: 'INPUT_PULLUP', pins: [['A1', 'low +10', 'in'], ['A4', 'high +50', 'in']] },
    { name: 'HC-SR04', note: 'at the drain', pins: [['D2', 'trig', 'out'], ['A5', 'echo', 'in']] },
    // NOT from pinball.ino (that is the version before the reader went in): SS/RST match the
    // Lost & Found locker's reader and are free in the sketch, MISO is the UNO's SPI pin, and the
    // reader shares MOSI/SCK (D11/D13) with the displays. Replace with the real wiring if it differs.
    { name: 'RFID reader', note: 'card reader · SPI', pins: [['D10', 'SS', 'out'], ['D12', 'MISO', 'in'], ['D9', 'RST', 'out']] },
  ];
  const OUT = [
    { name: 'Left flipper', note: 'solenoid + driver', pins: [['D6', 'PWM', 'out']] },
    { name: 'Right flipper', note: 'solenoid + driver', pins: [['D5', 'PWM', 'out']] },
    { name: 'Reload', note: 'solenoid + driver', pins: [['D8', 'pulse', 'out']] },
    { name: 'Score displays', note: '2 × 4 MAX7219', pins: [['D7', 'CS top', 'out'], ['A0', 'CS bottom', 'out'], ['D11', 'DIN', 'out'], ['D13', 'CLK', 'out']] },
  ];
  const DISPLAY_BUS = ['D11', 'D13', 'D7', 'A0'];

  // The loop. Each beat: [ms, pins to pulse, display text?, how long the wire stays lit].
  // Text and numbers are the sketch's; the loop itself runs faster than a real game.
  const STEPS = [
    {
      k: 'Tap the card: startGame()',
      t: 'The reader sends back the card’s ID. startGame() sets the score to 0 with three balls, shows START GAME and TAKE BALL, and the reload solenoid feeds the first ball.',
      beats: [[0, ['D10']], [260, ['D12']], [700, DISPLAY_BUS, ['START', 'GAME']], [1700, [...DISPLAY_BUS, 'D8'], ['TAKE', 'BALL']], [2800, DISPLAY_BUS, ['SCORE', '0 B:3']]],
      ms: 4000,
    },
    {
      k: 'Left button, D4: left flipper, D6',
      t: '80 ms at full power to kick, then held at PWM 120 while the button stays down, and cut after 1.5 s at most so the solenoid can’t overheat.',
      beats: [[0, ['D4']], [420, ['D6'], null, 900]],
      ms: 2400,
    },
    {
      k: 'Low target, A1: +10',
      t: 'Edge-triggered, so a ball resting on the contact scores once. +10 POINTS for 300 ms, then the score.',
      beats: [[0, ['A1']], [420, DISPLAY_BUS, ['+10', 'POINTS']], [1200, DISPLAY_BUS, ['SCORE', '10 B:3']]],
      ms: 2700,
    },
    {
      k: 'Right button, D3: right flipper, D5',
      t: 'The same kick and hold, on its own PWM pin.',
      beats: [[0, ['D3']], [420, ['D5'], null, 900]],
      ms: 2400,
    },
    {
      k: 'HC-SR04 reads under 26 mm: ball lost',
      t: 'A ball in the drain. One ball fewer, BALL LOST, a 3 s wait, then RE LOAD while pin 8 fires the reload solenoid for 300 ms, and back to the score.',
      beats: [[0, ['D2']], [320, ['A5']], [800, DISPLAY_BUS, ['BALL', 'LOST']], [2000, [...DISPLAY_BUS, 'D8'], ['RE', 'LOAD']], [2900, DISPLAY_BUS, ['SCORE', '10 B:2']]],
      ms: 4100,
    },
  ];

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (parent) parent.appendChild(n);
    return n;
  };
  const rectPath = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}Z`;

  // ---------- geometry: "wide" = inputs left, outputs right; "tall" = one column, board on the right ----------
  function layout(mode) {
    const wide = mode === 'wide';
    const W = wide ? 1000 : 400;
    const devW = wide ? 212 : 196;
    const unoW = wide ? 196 : 92;
    const unoX = wide ? (W - unoW) / 2 : W - unoW - 4;
    const PIN = 26;
    const HEAD = 52;
    const FOOT = 18;
    const GAP = 16;
    const TOP = 30;
    const boxH = (d) => HEAD + (d.pins.length - 1) * PIN + FOOT;
    const stack = (devs, x, y0, side) => {
      let y = y0;
      return devs.map((d) => {
        const b = { d, x, y, w: devW, h: boxH(d), side };
        y += b.h + GAP;
        return b;
      });
    };
    const height = (devs) => devs.reduce((s, d) => s + boxH(d), 0) + GAP * (devs.length - 1);
    let boxes;
    let groupLabels;
    if (wide) {
      const hIn = height(IN);
      const hOut = height(OUT);
      const h = Math.max(hIn, hOut);
      boxes = [...stack(IN, 28, TOP + (h - hIn) / 2, 'left'), ...stack(OUT, W - 28 - devW, TOP + (h - hOut) / 2, 'right')];
      groupLabels = [[28, TOP - 12, 'Inputs'], [W - 28 - devW, TOP - 12, 'Outputs']];
    } else {
      const outTop = TOP + height(IN) + 46;
      boxes = [...stack(IN, 4, TOP, 'left'), ...stack(OUT, 4, outTop, 'left')];
      groupLabels = [[4, TOP - 12, 'Inputs'], [4, outTop - 12, 'Outputs']];
    }
    const top = Math.min(...boxes.map((b) => b.y)) - 12;
    const bottom = Math.max(...boxes.map((b) => b.y + b.h)) + 12;
    const wires = [];
    boxes.forEach((b) => {
      b.d.pins.forEach(([pin, what, flow], k) => {
        const y = b.y + HEAD + k * PIN;
        const devEdge = b.side === 'right' ? b.x : b.x + b.w;
        const unoEdge = b.side === 'right' ? unoX + unoW : unoX;
        const toBoard = flow === 'in';
        wires.push({ pin, what, y, x1: toBoard ? devEdge : unoEdge, x2: toBoard ? unoEdge : devEdge, devEdge, unoEdge });
      });
    });
    return { wide, W, H: bottom + 8, unoX, unoW, top, bottom, boxes, wires, groupLabels };
  }

  function render(svg, L) {
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);
    const draw = []; // stroked in as it scrolls into view
    const fade = []; // faded in after the strokes
    const g = el('g', {}, svg);

    L.groupLabels.forEach(([x, y, t]) => {
      const label = el('text', { x, y, class: 'brain-group' }, g);
      label.textContent = t;
      fade.push(label);
    });

    // every box is a fill that fades in behind an outline that draws itself
    const box = (d, cls, drawn = true) => {
      fade.push(el('path', { d, class: `${cls.split(' ').pop()}-bg` }, g)); // fill only, never a stroke
      const outline = el('path', { d, class: cls, ...(drawn ? { pathLength: 1 } : {}) }, g);
      (drawn ? draw : fade).push(outline);
    };

    // the board
    box(rectPath(L.unoX, L.top, L.unoW, L.bottom - L.top), 'brain-uno');
    const cx = L.unoX + L.unoW / 2;
    const title = el('text', { x: cx, y: L.top + 26, class: 'brain-uno-name', 'text-anchor': 'middle' }, g);
    title.textContent = L.wide ? 'Arduino UNO' : 'UNO';
    fade.push(title);
    if (L.wide) {
      const chipW = 64;
      const chipH = 150;
      const chipY = (L.top + L.bottom) / 2 - chipH / 2;
      box(rectPath(cx - chipW / 2, chipY, chipW, chipH), 'brain-chip');
      for (let i = 0; i < 7; i++) {
        const y = chipY + 14 + i * ((chipH - 28) / 6);
        draw.push(el('path', { d: `M${cx - chipW / 2 - 7} ${y}h7M${cx + chipW / 2} ${y}h7`, class: 'brain-chip-leg', pathLength: 1 }, g));
      }
      const sketch = el('text', { x: cx, y: L.bottom - 16, class: 'brain-uno-file', 'text-anchor': 'middle' }, g);
      sketch.textContent = 'pinball.ino';
      fade.push(sketch);
    }

    // devices
    L.boxes.forEach((b) => {
      box(rectPath(b.x, b.y, b.w, b.h), 'brain-dev');
      const name = el('text', { x: b.x + 14, y: b.y + 23, class: 'brain-dev-name' }, g);
      name.textContent = b.d.name;
      const note = el('text', { x: b.x + 14, y: b.y + 40, class: 'brain-dev-note' }, g);
      note.textContent = b.d.note;
      fade.push(name, note);
    });

    // wires: the Arduino pin at the board end, the device's own name for it at the other
    const wires = L.wires.map((w) => {
      const line = el('path', { d: `M${w.devEdge} ${w.y}H${w.unoEdge}`, class: 'brain-wire', pathLength: 1 }, g);
      draw.push(line);
      const inward = w.unoEdge > w.devEdge; // board to the right of this device
      const pinLabel = el('text', { x: w.unoEdge + (inward ? 8 : -8), y: w.y + 4, class: 'brain-pin', 'text-anchor': inward ? 'start' : 'end' }, g);
      pinLabel.textContent = w.pin;
      const what = el('text', { x: w.devEdge + (inward ? -10 : 10), y: w.y + 4, class: 'brain-what', 'text-anchor': inward ? 'end' : 'start' }, g);
      what.textContent = w.what;
      const term = el('circle', { cx: w.devEdge, cy: w.y, r: 3, class: 'brain-term' }, g);
      fade.push(pinLabel, what, term);
      return { ...w, line };
    });
    const pulses = el('g', { class: 'brain-pulses' }, svg);
    return { draw, fade, wires, pulses };
  }

  window.buildBrain = () => {
    const root = document.createElement('div');
    root.className = 'brain';
    root.dataset.connector = '';
    root.innerHTML = `
      <div class="brain-board">
        <svg class="brain-svg" role="img" aria-labelledby="brain-desc"><desc id="brain-desc">Wiring diagram of the pinball machine's Arduino UNO.
          Inputs: flipper buttons on D4 and D3, targets on A1 (+10) and A4 (+50), the HC-SR04 drain sensor on D2 (trigger) and A5 (echo), and an RFID reader on D10, D12 and D9.
          Outputs: the left flipper solenoid on D6 and the right one on D5 (PWM), the reload solenoid on D8, and two MAX7219 dot-matrix displays with chip-selects on D7 and A0, sharing data on D11 and clock on D13.</desc></svg>
      </div>
      <div class="brain-live">
        <figure class="brain-display">
          <div class="dotmatrix brain-matrix" role="img" aria-label="Score display"></div>
          <figcaption>Score display</figcaption>
        </figure>
        <div class="brain-step" aria-live="off">
          <p class="brain-step-k"></p>
          <p class="brain-step-t"></p>
        </div>
      </div>
      <ol class="brain-steps">${STEPS.map((s) => `<li><b>${s.k}.</b> ${s.t}</li>`).join('')}</ol>`;

    const board = root.querySelector('.brain-board');
    const svg = root.querySelector('.brain-svg');
    const desc = svg.querySelector('desc');
    const matrix = window.DotMatrix(root.querySelector('.brain-matrix'));
    const stepK = root.querySelector('.brain-step-k');
    const stepT = root.querySelector('.brain-step-t');
    const live = root.querySelector('.brain-step');
    matrix.show('SCORE', '0 B:3');
    stepK.textContent = STEPS[0].k;
    stepT.textContent = STEPS[0].t;

    let parts = null;
    let mode = null;
    let drawTl = null;
    const animate = !reduceMotion && !!(window.gsap && window.ScrollTrigger);
    let drawn = !animate;

    // ---------- the event loop: pulses along the wires, text on the display ----------
    let timers = [];
    let running = false;
    let visible = false;
    let at = 0;

    // the dot travels with the Web Animations API, and everything is cleaned up by timers: a
    // paused rAF (a background tab) can leave a dot mid-wire, never a wire stuck lit
    const TRAVEL = 460;
    function pulse(pin, hold = 160) {
      parts.wires
        .filter((w) => w.pin === pin)
        .forEach((w) => {
          const dot = el('circle', { r: mode === 'wide' ? 5.5 : 5, class: 'brain-pulse', cx: w.x1, cy: w.y }, parts.pulses);
          w.line.classList.add('is-hot');
          if (dot.animate) {
            dot.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${w.x2 - w.x1}px)` }], { duration: TRAVEL, easing: 'ease-in-out', fill: 'forwards' });
          }
          timers.push(setTimeout(() => dot.remove(), TRAVEL));
          timers.push(setTimeout(() => w.line.classList.remove('is-hot'), TRAVEL + hold));
        });
    }

    function runStep() {
      if (!running) return;
      const s = STEPS[at];
      stepK.textContent = s.k;
      stepT.textContent = s.t;
      live.classList.remove('is-in');
      void live.offsetWidth; // restart the fade-in
      live.classList.add('is-in');
      s.beats.forEach(([ms, pins, text, hold]) => {
        timers.push(
          setTimeout(() => {
            pins.forEach((p) => pulse(p, hold));
            if (text) matrix.show(text[0], text[1]);
          }, ms)
        );
      });
      timers.push(
        setTimeout(() => {
          at = (at + 1) % STEPS.length;
          runStep();
        }, s.ms)
      );
    }

    function play() {
      if (running || !drawn || !parts) return;
      running = true;
      runStep();
    }

    function stop() {
      running = false;
      timers.forEach(clearTimeout);
      timers = [];
      if (parts) {
        parts.pulses.innerHTML = '';
        parts.wires.forEach((w) => w.line.classList.remove('is-hot'));
      }
    }

    function build() {
      const width = board.clientWidth;
      if (!width) return;
      const next = width >= 700 ? 'wide' : 'tall';
      if (next === mode) return;
      mode = next;
      stop();
      parts = render(svg, layout(mode));
      svg.prepend(desc);
      if (!animate) return;
      if (drawTl) {
        if (drawTl.scrollTrigger) drawTl.scrollTrigger.kill();
        drawTl.kill();
      }
      gsap.set(parts.draw, { strokeDashoffset: 1 });
      gsap.set(parts.fade, { opacity: 0 });
      drawTl = gsap
        .timeline({
          scrollTrigger: {
            trigger: board,
            start: 'top 85%',
            end: 'top 35%',
            scrub: 0.5,
            onUpdate: (self) => {
              drawn = self.progress > 0.97;
              if (drawn && visible) play();
            },
          },
        })
        .to(parts.draw, { strokeDashoffset: 0, duration: 1, stagger: 0.03, ease: 'none' }, 0)
        .to(parts.fade, { opacity: 1, duration: 0.4, stagger: 0.01, ease: 'none' }, 0.35);
      if (visible) play();
    }

    if (animate) {
      root.classList.add('is-live');
      new IntersectionObserver(
        ([e]) => {
          visible = e.isIntersecting;
          if (visible) play();
          else stop();
        },
        { threshold: 0.25 }
      ).observe(board);
    }

    // built once it's in the page and has a width, and again if that width crosses 700px
    requestAnimationFrame(build);
    if ('ResizeObserver' in window) new ResizeObserver(build).observe(board);
    else addEventListener('resize', build);
    return root;
  };
})();
