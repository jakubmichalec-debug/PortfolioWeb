/* Shared pieces for the Pinball page's scroll scenes (pinball-hero.js, timeline.js, finale.js,
   brain.js):
   - ScrollFilm: a frame sequence (tools/make_pinball_media.py FILMS) drawn to a <canvas> at
     whatever point the scroll has reached. A scrubbed <video> stutters on iPhones; decoded
     WebP frames don't. Frames load coarse-to-fine, so a fast scroller always sees the nearest
     frame that has arrived instead of a blank.
   - DotMatrix: the machine's own score display - two FC16 strips of four 8x8 MAX7219 modules
     (32 x 8 LEDs each), centred text like MD_Parola's PA_CENTER, in a 5x7 font.
   - scene(): scroll progress through a tall "track" whose child is CSS-sticky - the pinning is
     plain CSS, ScrollTrigger only reports how far through it the visitor is. */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  // ---------------- ScrollFilm ----------------
  function ScrollFilm(canvas, film, { focusY = 0.5 } = {}) {
    const ctx = canvas.getContext('2d');
    const n = film.count;
    const frames = new Array(n);
    const url = (i) => `${film.dir}${String(i + 1).padStart(4, '0')}.${film.ext}`;
    let want = 0;
    let shown = -1;
    let started = false;

    function nearest(i) {
      for (let d = 0; d < n; d++) {
        if (frames[i - d]) return i - d;
        if (frames[i + d]) return i + d;
      }
      return -1;
    }

    function paint() {
      const k = nearest(want);
      if (k < 0) return;
      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) return;
      const img = frames[k];
      // cover-fit, cropping top/bottom around focusY
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const sw = w / scale;
      const sh = h / scale;
      const sx = (img.naturalWidth - sw) / 2;
      const sy = (img.naturalHeight - sh) * focusY;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      shown = k;
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (w === canvas.width && h === canvas.height) return;
      canvas.width = w;
      canvas.height = h;
      shown = -1;
      paint();
    }

    function load() {
      if (started) return;
      started = true;
      // 0 and the last frame first (start and end states), then every 16th, 8th ... every frame
      const queue = [0, n - 1];
      [16, 8, 4, 2, 1].forEach((step) => {
        for (let i = 0; i < n; i += step) if (!queue.includes(i)) queue.push(i);
      });
      let active = 0;
      const next = () => {
        while (active < 4 && queue.length) {
          const i = queue.shift();
          const img = new Image();
          img.decoding = 'async';
          img.src = url(i);
          active++;
          const done = img.decode ? img.decode() : new Promise((ok, fail) => ((img.onload = ok), (img.onerror = fail)));
          done
            .then(() => {
              frames[i] = img;
              // a closer frame to the one wanted just arrived
              if (shown < 0 || Math.abs(i - want) < Math.abs(shown - want)) paint();
            })
            .catch(() => {})
            .finally(() => {
              active--;
              next();
            });
        }
      };
      next();
    }

    function seek(p) {
      want = Math.round(clamp01(p) * (n - 1));
      if (want !== shown) paint();
    }

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    else addEventListener('resize', resize);
    resize();

    return {
      load,
      seek,
      get frame() {
        return want;
      },
      count: n,
    };
  }

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
  const MODULE_GAP = 3;
  const STRIP_GAP = 16;
  const PAD = 8;
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

  const cx = (c) => PAD + c * PITCH + Math.floor(c / 8) * MODULE_GAP + PITCH / 2;
  const cy = (strip, r) => PAD + strip * (ROWS * PITCH + STRIP_GAP) + r * PITCH + PITCH / 2;

  function DotMatrix(el) {
    const NS = 'http://www.w3.org/2000/svg';
    const id = `dm-${++uid}`;
    const W = PAD * 2 + COLS * PITCH + 3 * MODULE_GAP;
    const H = PAD * 2 + 2 * ROWS * PITCH + STRIP_GAP;
    const modules = [];
    for (let s = 0; s < 2; s++) {
      for (let m = 0; m < 4; m++) {
        modules.push(`<rect x="${PAD + m * (8 * PITCH + MODULE_GAP)}" y="${PAD + s * (ROWS * PITCH + STRIP_GAP)}" width="${8 * PITCH}" height="${ROWS * PITCH}" fill="url(#${id})"/>`);
      }
    }
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
      <defs><pattern id="${id}" width="${PITCH}" height="${PITCH}" patternUnits="userSpaceOnUse">
        <circle class="dm-off" cx="${PITCH / 2}" cy="${PITCH / 2}" r="${PITCH * 0.34}"/></pattern></defs>
      <rect class="dm-body" width="${W}" height="${H}" rx="4"/>
      ${modules.join('')}
      <path class="dm-on"/>
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

  window.ScrollFilm = ScrollFilm;
  window.DotMatrix = DotMatrix;
  window.filmScene = scene;
  window.clamp01 = clamp01;
})();
