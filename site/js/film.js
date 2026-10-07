/* Shared pieces for the Pinball page's scenes (finale.js, brain.js, timeline.js):
   - DotMatrix: the machine's own score display - two FC16 strips of four 8x8 MAX7219 modules
     (32 x 8 LEDs each), centred text like MD_Parola's PA_CENTER, in a 5x7 font.
   - filmScene(): scroll progress through a tall "track" whose child is CSS-sticky - the pinning
     is plain CSS, ScrollTrigger only reports how far through it the visitor is (timeline.js). */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  // ---------------- DotMatrix ----------------
  // 5x7 glyphs, rows top to bottom. Narrow glyphs are narrower, as in MD_MAX72XX's own font
  // (it's why "POINTS" fits on 32 columns).
  const FONT = {
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    D: ['###..', '#..#.', '#...#', '#...#', '#...#', '#..#.', '###..'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
    H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['#', '#', '#', '#', '#', '#', '#'],
    J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
    X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
    2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
    4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    ':': ['.', '#', '#', '.', '#', '#', '.'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
    '!': ['#', '#', '#', '#', '#', '.', '#'],
    ' ': ['..', '..', '..', '..', '..', '..', '..'],
  };
  const COLS = 32;
  const ROWS = 8;
  const PITCH = 10;
  const STRIP_GAP = PITCH; // the two strips: one LED pitch apart, so one pattern lines up with both
  const PAD = PITCH;
  let uid = 0;

  // lit [col, row] pairs for one 32x8 strip, centred
  function lit(text) {
    const glyphs = String(text || '').toUpperCase().split('').map((c) => FONT[c] || FONT[' ']);
    const width = glyphs.reduce((s, g) => s + g[0].length, 0) + Math.max(0, glyphs.length - 1);
    let col = Math.floor((COLS - width) / 2);
    const dots = [];
    glyphs.forEach((g) => {
      g.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) if (row[c] === '#') dots.push([col + c, r]);
      });
      col += g[0].length + 1;
    });
    return dots.filter(([c]) => c >= 0 && c < COLS);
  }

  const cx = (c) => PAD + c * PITCH + PITCH / 2;
  const cy = (strip, r) => PAD + strip * (ROWS * PITCH + STRIP_GAP) + r * PITCH + PITCH / 2;

  function DotMatrix(el) {
    const id = `dm-${++uid}`;
    const W = PAD * 2 + COLS * PITCH;
    const H = PAD * 2 + 2 * ROWS * PITCH + STRIP_GAP;
    let strips = '';
    let seams = '';
    for (let s = 0; s < 2; s++) {
      const y = PAD + s * (ROWS * PITCH + STRIP_GAP);
      strips += `<rect x="${PAD}" y="${y}" width="${COLS * PITCH}" height="${ROWS * PITCH}" fill="url(#${id})"/>`;
      for (let m = 1; m < 4; m++) seams += `M${PAD + m * 8 * PITCH} ${y}v${ROWS * PITCH}`; // the four 8x8 modules
    }
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
      <defs><pattern id="${id}" width="${PITCH}" height="${PITCH}" patternUnits="userSpaceOnUse">
        <circle class="dm-off" cx="${PITCH / 2}" cy="${PITCH / 2}" r="${PITCH * 0.34}"/></pattern>
        <filter id="${id}-glow" x="-5%" y="-10%" width="110%" height="120%">
          <feGaussianBlur stdDeviation="2.4" result="glow"/>
          <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter></defs>
      <rect class="dm-body" width="${W}" height="${H}" rx="5"/>
      ${strips}
      <path class="dm-seam" d="${seams}"/>
      <path class="dm-on" filter="url(#${id}-glow)"/>
    </svg>`;
    const on = el.querySelector('.dm-on');
    const r = PITCH * 0.36;
    let current = null;

    function show(top, bottom) {
      const key = `${top}|${bottom}`;
      if (key === current) return;
      current = key;
      let d = '';
      [top, bottom].forEach((text, s) => {
        lit(text).forEach(([c, row]) => {
          const x = cx(c);
          const y = cy(s, row);
          d += `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
        });
      });
      on.setAttribute('d', d);
      if (el.hasAttribute('role')) el.setAttribute('aria-label', `Score display: ${top} ${bottom}`.trim());
    }

    return {
      show,
      clear: () => show('', ''),
    };
  }

  // ---------------- scene(): progress through a sticky track ----------------
  // `track` is the tall element; its first child is position: sticky (see story.css .scene-pin).
  // Returns false when there's no scrolling scene (reduced motion / no GSAP) so the caller can
  // lay out its still version instead.
  function scene(track, onProgress) {
    if (reduceMotion || !(window.gsap && window.ScrollTrigger)) return false;
    const pin = track.firstElementChild;
    const stick = () => parseFloat(getComputedStyle(pin).top) || 0;
    ScrollTrigger.create({
      trigger: track,
      // from the moment the pin sticks to the moment it lets go
      start: () => `top ${stick()}px`,
      end: () => `bottom ${stick() + pin.offsetHeight}px`,
      onUpdate: (self) => onProgress(self.progress),
      onRefresh: (self) => onProgress(self.progress),
    });
    return true;
  }

  window.DotMatrix = DotMatrix;
  window.filmScene = scene;
  window.clamp01 = clamp01;
})();
