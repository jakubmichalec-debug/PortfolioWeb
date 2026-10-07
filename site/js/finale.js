/* "It works": the finished machine playing one real take (the 4K Shortshowcase footage, cut
   to four steady shots - tools/make_pinball_media.py). The video plays on its own while the
   section is on screen, and everything else follows its clock: the LED display mirrors what the
   machine's own display shows at that moment (read off the footage), the callouts open as their
   moments arrive with the code behind them, and a serial monitor prints what pinball.ino prints.
   The bar under it is a real seek bar: click or drag it, or use the arrow keys. */
(() => {
  'use strict';

  const media = window.PINBALL_MEDIA || {};
  const show = media.showcase;
  const section = document.querySelector('#it-works');
  const video = section && section.querySelector('.finale-video');
  if (!show || !video || !window.DotMatrix) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const matrices = Array.from(section.querySelectorAll('.dotmatrix')).map((el) => window.DotMatrix(el));
  const list = section.querySelector('.finale-events');
  const serial = section.querySelector('.serial-lines');
  const bar = section.querySelector('.finale-bar');
  const timeEl = section.querySelector('.finale-time');
  const playBtn = section.querySelector('.finale-play');
  const DURATION = show.duration;

  // ---------- what each moment is (the times come from the footage, the words from here) ----------
  const NOTES = {
    start: {
      title: 'A game starts',
      text: 'The display reads START GAME. startGame() sets the score to 0 and three balls, then shows TAKE BALL while the reload solenoid on pin 8 feeds the first one.',
      code: 'showMatrixText("START", "GAME");\ndelay(1500);\nshowMatrixText("TAKE", "BALL");\npulseOutput(reloadOut, reloadPulseMs);',
      serial: ['Starting new game...', 'DISPLAY -> TOP: START | BOTTOM: GAME'],
    },
    play: {
      title: 'Ball in play',
      text: '0 points, 3 balls left. The two buttons are under the player’s hands; every press reaches a flipper through the Arduino.',
      code: 'sprintf(bottomBuffer, "%d B:%d", score, ballsLeft);\nshowMatrixText("SCORE", bottomBuffer);',
      serial: ['DISPLAY -> TOP: TAKE | BOTTOM: BALL', 'Reload solenoid pulse', 'PULSE pin 8 for 300 ms', 'DISPLAY -> TOP: SCORE | BOTTOM: 0 B:3', 'GAME SCREEN -> Score: 0 | Balls left: 3', 'Game active'],
    },
    flip: {
      title: 'Flipper',
      text: 'The ball meets the left flipper. Left button on D4: the solenoid on D6 kicks at full power for 80 ms, then holds at PWM 120 while the button stays down.',
      code: 'analogWrite(leftFlipperOut, 255);\ndelay(flipperFullPulseMs);   // 80 ms\nanalogWrite(leftFlipperOut, flipperHoldPWM);',
      serial: ['LEFT FLIPPER PRESSED'],
    },
    hit: {
      title: '+10 points',
      text: 'The display goes from 0 to 10: a target closed its contact. It is edge-triggered, so a ball resting on it only scores once.',
      code: 'score += lowTargetPoints;   // 10\nshowMatrixText("+10", "POINTS");',
      serial: ['LOW TARGET HIT +10', 'DISPLAY -> TOP: +10 | BOTTOM: POINTS', 'DISPLAY -> TOP: SCORE | BOTTOM: 10 B:3', 'GAME SCREEN -> Score: 10 | Balls left: 3'],
    },
    close: {
      title: 'Up close',
      text: 'The flippers, the ball and the display from the player’s side. The score holds at 10 with all three balls still to play.',
      code: 'if (millis() - holdStart >= maxHoldTimeMs) {   // 1500 ms\n  analogWrite(leftFlipperOut, 0);\n}',
      serial: [],
    },
    open: {
      title: 'The brain',
      text: 'A hand lifts the back panel: the wiring, the display modules and the Arduino that runs all of this are in here (chapter 07 draws it).',
      code: '',
      serial: [],
    },
  };

  const events = show.events.filter((e) => NOTES[e.kind]).map((e) => ({ ...e, ...NOTES[e.kind] }));

  // ---------- build the callouts, the serial log and the bar ----------
  const fmt = (s) => {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
  };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const items = events.map((e) => {
    const li = document.createElement('li');
    li.className = 'fe';
    li.innerHTML = `
      <p class="fe-row"><time>${fmt(e.t)}</time><b>${e.title}</b></p>
      <div class="fe-body"><div class="fe-inner"><p>${e.text}</p>${e.code ? `<pre><code>${esc(e.code)}</code></pre>` : ''}</div></div>`;
    li.addEventListener('click', () => seek(e.t)); // a callout is a chapter marker: click it to go there
    list.appendChild(li);
    return li;
  });
  const serialLines = events.flatMap((e) => e.serial.map((text) => ({ t: e.t, text })));
  events.forEach((e) => {
    const tick = document.createElement('i');
    tick.className = 'finale-mark';
    tick.style.left = `${((e.t / DURATION) * 100).toFixed(2)}%`;
    bar.appendChild(tick);
  });
  (show.cuts || []).forEach((t) => {
    const cut = document.createElement('i');
    cut.className = 'finale-cut';
    cut.style.left = `${((t / DURATION) * 100).toFixed(2)}%`;
    bar.appendChild(cut);
  });
  const marks = Array.from(bar.querySelectorAll('.finale-mark'));
  section.querySelector('.finale-total').textContent = fmt(DURATION);
  const SERIAL_ROWS = 9;

  // ---------- follow the video's clock ----------
  let shownLines = -1;
  let shownState = '';
  let shownActive = -2;
  let shownTenth = -1;

  function render(t) {
    const f = Math.min(1, Math.max(0, t / DURATION));
    bar.style.setProperty('--played', f.toFixed(4));
    const tenth = Math.floor(t * 10); // the readout only changes ten times a second
    if (tenth !== shownTenth) {
      shownTenth = tenth;
      bar.setAttribute('aria-valuenow', String(Math.round(f * 100)));
      bar.setAttribute('aria-valuetext', `${fmt(t)} of ${fmt(DURATION)}`);
      timeEl.textContent = fmt(t);
    }

    let d = show.display[0];
    show.display.forEach((s) => {
      if (s.t <= t + 1e-3) d = s;
    });
    const state = `${d.top}|${d.bottom}`;
    if (state !== shownState) {
      shownState = state;
      matrices.forEach((m) => m.show(d.top, d.bottom));
    }

    let active = -1;
    events.forEach((e, i) => {
      if (e.t <= t + 1e-3) active = i;
    });
    if (active !== shownActive) {
      shownActive = active;
      items.forEach((li, i) => {
        li.classList.toggle('is-active', i === active);
        li.classList.toggle('is-past', i < active);
      });
      marks.forEach((m, i) => m.classList.toggle('is-on', i <= active));
    }

    let n = 0;
    while (n < serialLines.length && serialLines[n].t <= t + 1e-3) n++;
    if (n !== shownLines && serial) {
      shownLines = n;
      serial.innerHTML = serialLines
        .slice(Math.max(0, n - SERIAL_ROWS), n)
        .map((l) => `<li>${esc(l.text)}</li>`)
        .join('');
    }
  }

  // a requestAnimationFrame loop reads the clock while it plays: exact, and the same in every browser
  let raf = 0;
  const loop = () => {
    render(video.currentTime);
    raf = video.paused ? 0 : requestAnimationFrame(loop);
  };
  const start = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };

  function seek(t) {
    video.currentTime = Math.min(DURATION - 0.05, Math.max(0, t));
    render(video.currentTime);
  }

  // ---------- play / pause ----------
  let userPaused = reduceMotion; // reduced motion: nothing plays until it is asked to
  const sync = () => {
    playBtn.setAttribute('aria-pressed', String(video.paused));
    playBtn.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
  };
  video.addEventListener('play', () => {
    sync();
    start();
  });
  video.addEventListener('pause', sync);
  video.addEventListener('seeked', () => render(video.currentTime));
  playBtn.addEventListener('click', () => {
    userPaused = !video.paused;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });

  // plays while on screen (unless it was paused on purpose), stops while it is not
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!userPaused) video.play().catch(() => {});
      } else video.pause();
    }, { threshold: 0.35 }).observe(section);
  } else if (!reduceMotion) video.play().catch(() => {});

  // ---------- the bar: click / drag / arrows ----------
  const at = (ev) => {
    const r = bar.getBoundingClientRect();
    return Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) * DURATION;
  };
  let dragging = false;
  bar.addEventListener('pointerdown', (ev) => {
    dragging = true;
    bar.setPointerCapture(ev.pointerId);
    seek(at(ev));
  });
  bar.addEventListener('pointermove', (ev) => dragging && seek(at(ev)));
  bar.addEventListener('pointerup', () => (dragging = false));
  bar.addEventListener('pointercancel', () => (dragging = false));
  bar.addEventListener('keydown', (ev) => {
    const step = ev.key === 'ArrowRight' ? 2 : ev.key === 'ArrowLeft' ? -2 : 0;
    if (ev.key === 'Home') seek(0);
    else if (ev.key === 'End') seek(DURATION - 0.1);
    else if (step) seek(video.currentTime + step);
    else return;
    ev.preventDefault();
  });

  sync();
  render(0);
  if (reduceMotion) {
    // no autoplay: every callout open, on the frame after the +10
    section.classList.add('is-still');
    items.forEach((li) => li.classList.add('is-open'));
    const hit = events.find((e) => e.kind === 'hit');
    if (hit) seek(hit.t + 0.4);
  }
})();
