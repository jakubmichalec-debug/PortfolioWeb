/* Chapter 07, "the brain": a wiring diagram drawn from the real sketch's pin assignments
   (site/assets/code/pinball.ino), not a generic Arduino picture. It draws itself in as it
   scrolls into view, then plays the game's real events on a loop - a pulse runs down each
   wire involved and the machine's display shows the sketch's own text. The RFID reader is
   the one part not in that sketch (it's the earlier, pre-RFID version): its wires are dashed
   and it says "pins assumed", and the step it drives is marked as a reconstruction.
   story.js calls window.buildBrain() for the Electronics chapter. */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // [arduino pin, what it is at the device end]
  const IN = [
    { id: 'btn', name: 'Flipper buttons', note: 'INPUT_PULLUP', pins: [['D4', 'left'], ['D3', 'right']] },
    { id: 'tgt', name: 'Targets', note: 'INPUT_PULLUP', pins: [['A1', 'low +10'], ['A4', 'high +50']] },
    { id: 'sonar', name: 'HC-SR04', note: 'in the drain', pins: [['D2', 'trig'], ['A5', 'echo']] },
    { id: 'rfid', name: 'RFID reader', note: 'pins assumed', pins: [['D10', 'SS'], ['D9', 'RST']], assumed: true },
  ];
  const OUT = [
    { id: 'flipL', name: 'Left flipper', note: 'solenoid', pins: [['D6', 'PWM']] },
    { id: 'flipR', name: 'Right flipper', note: 'solenoid', pins: [['D5', 'PWM']] },
    { id: 'reload', name: 'Reload', note: 'solenoid', pins: [['D8', 'pulse']] },
    { id: 'disp', name: 'Score displays', note: '2 × 4 MAX7219', pins: [['D7', 'CS top'], ['A0', 'CS bottom'], ['D11', 'DIN'], ['D13', 'CLK']] },
  ];
  const DISPLAY_BUS = ['D11', 'D13', 'D7', 'A0'];

  // The loop. Each beat: [ms, pins to pulse, display text?]. Text and numbers are the sketch's.
  const STEPS = [
    {
      k: 'Tap the card: startGame()',
      t: 'Score back to 0 and three balls. START GAME, TAKE BALL, and the reload solenoid feeds the first ball. The card reader is the reconstructed part.',
      assumed: true,
      beats: [[0, ['D10']], [500, DISPLAY_BUS, ['START', 'GAME']], [1500, [...DISPLAY_BUS, 'D8'], ['TAKE', 'BALL']], [2600, DISPLAY_BUS, ['SCORE', '0 B:3']]],
      ms: 3700,
    },
    {
      k: 'Left button, D4: left flipper, D6',
      t: '80 ms at full power to kick, then held at PWM 120 so the solenoid doesn’t overheat, cut after 1.5 s at most.',
      beats: [[0, ['D4']], [420, ['D6'], null, 900]],
      ms: 2300,
    },
    {
      k: 'Low target, A1: +10',
      t: 'Edge-triggered, so a ball resting on the contact scores once. +10 POINTS for 300 ms, then the score.',
      beats: [[0, ['A1']], [420, DISPLAY_BUS, ['+10', 'POINTS']], [1200, DISPLAY_BUS, ['SCORE', '10 B:3']]],
      ms: 2600,
    },
    {
      k: 'Right button, D3: right flipper, D5',
      t: 'The same kick and hold, on its own PWM pin.',
      beats: [[0, ['D3']], [420, ['D5'], null, 900]],
      ms: 2300,
    },
    {
      k: 'HC-SR04 reads under 26 mm: ball lost',
      t: 'One ball fewer. BALL LOST, a 3 s wait, RE LOAD while pin 8 pulses the reload solenoid for 300 ms, then the score.',
      beats: [[0, ['D2']], [320, ['A5']], [800, DISPLAY_BUS, ['BALL', 'LOST']], [2000, [...DISPLAY_BUS, 'D8'], ['RE', 'LOAD']], [2900, DISPLAY_BUS, ['SCORE', '10 B:2']]],
      ms: 4000,
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
    const devW = wide ? 212 : 200;
    const unoW = wide ? 196 : 82;
    const unoX = wide ? (W - unoW) / 2 : W - unoW - 6;
    const PIN = 26;
    const HEAD = 52;
    const FOOT = 18;
    const GAP = 16;
    const TOP = 26;
    const boxH = (d) => HEAD + (d.pins.length - 1) * PIN + FOOT;
    const stack = (devs, x, y0, dir) => {
      let y = y0;
      return devs.map((d) => {
        const b = { d, x, y, w: devW, h: boxH(d), dir };
        y += b.h + GAP;
        return b;
      });
    };
    const height = (devs) => devs.reduce((s, d) => s + boxH(d), 0) + GAP * (devs.length - 1);
    let boxes;
    let groupLabels = [];
    if (wide) {
      const hIn = height(IN);
      const hOut = height(OUT);
      const h = Math.max(hIn, hOut);
      boxes = [...stack(IN, 28, TOP + (h - hIn) / 2, 'in'), ...stack(OUT, W - 28 - devW, TOP + (h - hOut) / 2, 'out')];
      groupLabels = [[28, TOP - 10, 'In'], [W - 28 - devW, TOP - 10, 'Out']];
    } else {
      const inTop = TOP + 12;
      const outTop = inTop + height(IN) + 44;
      boxes = [...stack(IN, 6, inTop, 'in'), ...stack(OUT, 6, outTop, 'out')];
      groupLabels = [[6, inTop - 10, 'In'], [6, outTop - 10, 'Out']];
    }
    const top = Math.min(...boxes.map((b) => b.y)) - 10;
    const bottom = Math.max(...boxes.map((b) => b.y + b.h)) + 10;
    const wires = [];
    boxes.forEach((b) => {
      b.d.pins.forEach(([pin, what], k) => {
        const y = b.y + HEAD + k * PIN;
        const devEdge = wide && b.dir === 'out' ? b.x : b.x + b.w;
        const unoEdge = wide && b.dir === 'out' ? unoX + unoW : unoX;
        // signal direction: into the board for inputs (except HC-SR04's trigger, which the board fires)
        const toBoard = b.dir === 'in' && what !== 'trig';
        wires.push({ pin, what, y, box: b, assumed: !!b.d.assumed, x1: toBoard ? devEdge : unoEdge, x2: toBoard ? unoEdge : devEdge, devEdge, unoEdge });
      });
    });
    return { wide, W, H: bottom + 16, unoX, unoW, top, bottom, boxes, wires, groupLabels };
  }

  function render(svg, L) {
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);
    const draw = [];
    const fade = [];
    const g = el('g', {}, svg);

    L.groupLabels.forEach(([x, y, t]) => fade.push(el('text', { x, y, class: 'brain-group' }, g)));
    L.groupLabels.forEach(([, , t], i) => (fade[i].textContent = t));

    // the board
    const uno = el('path', { d: rectPath(L.unoX, L.top, L.unoW, L.bottom - L.top), class: 'brain-uno', pathLength: 1 }, g);
    draw.push(uno);
    const cx = L.unoX + L.unoW / 2;
    const title = el('text', { x: cx, y: L.top + 26, class: 'brain-uno-name', 'text-anchor': 'middle' }, g);
    title.textContent = L.wide ? 'Arduino UNO' : 'UNO';
    fade.push(title);
    const chipW = L.wide ? 64 : 34;
    const chipH = L.wide ? 150 : 110;
    const chipY = (L.top + L.bottom) / 2 - chipH / 2;
    const chip = el('path', { d: rectPath(cx - chipW / 2, chipY, chipW, chipH), class: 'brain-chip', pathLength: 1 }, g);
    draw.push(chip);
    for (let i = 0; i < 7; i++) {
      const y = chipY + 14 + i * ((chipH - 28) / 6);
      draw.push(el('path', { d: `M${cx - chipW / 2 - 7} ${y}h7M${cx + chipW / 2} ${y}h7`, class: 'brain-chip-leg', pathLength: 1 }, g));
    }
    if (L.wide) {
      const sketch = el('text', { x: cx, y: L.bottom - 16, class: 'brain-uno-file', 'text-anchor': 'middle' }, g);
      sketch.textContent = 'pinball.ino';
      fade.push(sketch);
    }

    // devices
    L.boxes.forEach((b) => {
      const box = el('path', { d: rectPath(b.x, b.y, b.w, b.h), class: `brain-dev${b.d.assumed ? ' brain-dev--assumed' : ''}`, pathLength: 1 }, g);
      (b.d.assumed ? fade : draw).push(box);
      const name = el('text', { x: b.x + 14, y: b.y + 23, class: 'brain-dev-name' }, g);
      name.textContent = b.d.name;
      const note = el('text', { x: b.x + 14, y: b.y + 40, class: `brain-dev-note${b.d.assumed ? ' brain-dev-note--assumed' : ''}` }, g);
      note.textContent = b.d.note;
      fade.push(name, note);
    });

    // wires, with the Arduino pin at the board end and the device's own name for it at the other
    const wires = L.wires.map((w) => {
      const line = el('path', { d: `M${w.devEdge} ${w.y}H${w.unoEdge}`, class: `brain-wire${w.assumed ? ' brain-wire--assumed' : ''}`, pathLength: 1 }, g);
      (w.assumed ? fade : draw).push(line);
      const outward = w.unoEdge > w.devEdge; // board to the right of this device
      const pinLabel = el('text', { x: w.unoEdge + (outward ? 8 : -8), y: w.y + 4, class: 'brain-pin', 'text-anchor': outward ? 'start' : 'end' }, g);
      pinLabel.textContent = w.pin;
      const what = el('text', { x: w.devEdge + (outward ? -10 : 10), y: w.y + 4, class: 'brain-what', 'text-anchor': outward ? 'end' : 'start' }, g);
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
          Inputs: flipper buttons on D4 and D3, targets on A1 (+10) and A4 (+50), the HC-SR04 drain sensor on D2 (trigger) and A5 (echo), and an RFID reader on D10 and D9 (pins assumed).
          Outputs: left flipper solenoid on D6 and right on D5 (PWM), the reload solenoid on D8, and two MAX7219 dot-matrix displays with chip-selects on D7 and A0, sharing data on D11 and clock on D13.</desc></svg>
      </div>
      <div class="brain-live">
        <div class="dotmatrix brain-matrix" role="img" aria-label="Score display"></div>
        <div class="brain-step" aria-live="off">
          <p class="brain-step-k"></p>
          <p class="brain-step-t"></p>
        </div>
      </div>
      <ol class="brain-steps">${STEPS.map((s) => `<li${s.assumed ? ' class="is-assumed"' : ''}><b>${s.k}</b> ${s.t}</li>`).join('')}</ol>`;

    const board = root.querySelector('.brain-board');
    const svg = root.querySelector('.brain-svg');
    const desc = svg.querySelector('desc');
    const matrix = window.DotMatrix(root.querySelector('.brain-matrix'));
    const stepK = root.querySelector('.brain-step-k');
    const stepT = root.querySelector('.brain-step-t');
    const live = root.querySelector('.brain-step');
    matrix.show('SCORE', '0 B:3');

    let parts = null;
    let mode = null;
    let drawTl = null;
    let drawn = reduceMotion || !(window.gsap && window.ScrollTrigger);
    const animate = !drawn;

    function build() {
      const next = board.clientWidth >= 700 ? 'wide' : 'tall';
      if (next === mode) return;
      mode = next;
      stop();
      parts = render(svg, layout(mode));
      svg.prepend(desc);
      if (!animate) return;
      if (drawTl) {
        drawTl.scrollTrigger && drawTl.scrollTrigger.kill();
        drawTl.kill();
      }
      gsap.set(parts.draw, { strokeDashoffset: 1 });
      gsap.set(parts.fade, { opacity: 0 });
      drawTl = gsap
        .timeline({
          scrollTrigger: {
            trigger: board,
            start: 'top 82%',
            end: 'top 30%',
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

    // ---------- the event loop: pulses along the wires, text on the display ----------
    let timers = [];
    let running = false;
    let visible = false;
    let at = 0;

    function pulse(pin, hold = 160) {
      parts.wires
        .filter((w) => w.pin === pin)
        .forEach((w) => {
          const dot = el('circle', { r: mode === 'wide' ? 5.5 : 5, class: `brain-pulse${w.assumed ? ' brain-pulse--assumed' : ''}`, cx: w.x1, cy: w.y }, parts.pulses);
          w.line.classList.add('is-hot');
          const t0 = performance.now();
          const ms = 460;
          const tick = (now) => {
            if (!running) return dot.remove();
            const k = Math.min(1, (now - t0) / ms);
            const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
            dot.setAttribute('cx', (w.x1 + (w.x2 - w.x1) * e).toFixed(1));
            if (k < 1) requestAnimationFrame(tick);
            else {
              dot.remove();
              timers.push(setTimeout(() => w.line.classList.remove('is-hot'), hold));
            }
          };
          requestAnimationFrame(tick);
        });
    }

    function runStep() {
      if (!running) return;
      const s = STEPS[at];
      stepK.textContent = s.k;
      stepT.textContent = s.t;
      live.classList.toggle('is-assumed', !!s.assumed);
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
      timers.push(setTimeout(() => {
        at = (at + 1) % STEPS.length;
        runStep();
      }, s.ms));
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

    // built once it's in the page and has a width
    requestAnimationFrame(build);
    if ('ResizeObserver' in window) new ResizeObserver(() => build()).observe(board);
    return root;
  };
})();
