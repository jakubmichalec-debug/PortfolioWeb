/* "Sketch to showcase": the build as dated moments on a drafting ruler, 28 Feb -> 15 Jun.
   Scrolling slides the ruler sideways under a fixed cursor that reads out the day. Every moment
   is a picture, not a sentence:
     photos  - a photo, a clip (its first frame) or a fan of several taken that day; they develop
               from cyanotype into colour as the cursor reaches the day
     model   - the real 3D part from the files FreeCAD made that day, turning in place (click: the
               full-screen 3D viewer the chapters use)
     drawing - the playfield drawing, which draws itself when the cursor reaches its day
   The dates come from the phones' capture dates and from the FreeCAD files' own creation dates.
   A long stretch with nothing in it is drawn as a break in the ruler (the drafting sign for "not
   to scale"). Cards that would run into each other slide sideways on an elbow leader instead of
   stretching the ruler. Data: tools/make_pinball_media.py TIMELINE. */
(() => {
  'use strict';

  const all = (window.PINBALL_MEDIA || {}).timeline || [];
  const section = document.querySelector('[data-scene="days"]');
  if (!section || !all.length) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parts = window.PINBALL_PARTS || [];
  const partFor = (file) => parts.find((p) => p.kind === 'model' && p.model && p.model.split('/').pop() === file);

  // a model card whose model isn't in the parts manifest can't be shown: leave it out, keep the rest
  const kept = all.filter((e) => e.kind !== 'model' || partFor(e.model));
  if (!kept.length) return;
  const base = kept[0].day;
  const entries = kept.map((e) => ({ ...e, day: e.day - base }));

  const rail = section.querySelector('.days-rail');
  const list = section.querySelector('.days-cards');
  const ruler = section.querySelector('.days-ruler');
  const readDay = section.querySelector('.days-readout-day');
  const readDate = section.querySelector('.days-readout-date');
  const LAST = entries[entries.length - 1].day;
  const start = new Date(`${entries[0].iso}T12:00:00`);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateOf = (day) => {
    const d = new Date(start);
    d.setDate(d.getDate() + Math.round(day));
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };
  const pad2 = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------- the scale: day -> ruler units, a long empty gap squeezed into a break ----------
  const GAP = 14; // an empty stretch longer than this many days becomes a break...
  const BREAK = 6; // ...drawn this many days wide
  const knots = [[0, 0]]; // [day, unit]
  const breaks = []; // [fromDay, toDay, fromUnit, toUnit]
  entries.forEach((e, i) => {
    if (!i) return;
    const [d0, u0] = knots[knots.length - 1];
    const gap = e.day - d0;
    const u = u0 + (gap > GAP ? BREAK : gap);
    if (gap > GAP) breaks.push([d0, e.day, u0, u]);
    knots.push([e.day, u]);
  });
  const UNITS = knots[knots.length - 1][1];
  const interp = (v, a, b) => {
    if (v <= knots[0][a]) return knots[0][b];
    for (let i = 1; i < knots.length; i++) {
      if (v <= knots[i][a]) {
        const span = knots[i][a] - knots[i - 1][a];
        return span ? knots[i - 1][b] + ((v - knots[i - 1][a]) / span) * (knots[i][b] - knots[i - 1][b]) : knots[i][b];
      }
    }
    return knots[knots.length - 1][b];
  };
  const toUnit = (day) => interp(day, 0, 1);
  const toDay = (unit) => interp(unit, 1, 0);
  const inBreak = (day) => breaks.some(([a, b]) => day > a && day < b);

  // ---------- the pictures ----------
  const thumb = (it) => (it.kind === 'video' ? it.poster : it.thumb);

  function modelViewer(part) {
    const mv = document.createElement('model-viewer');
    mv.setAttribute('src', part.model);
    mv.setAttribute('loading', 'lazy'); // fetched when its card scrolls into the window, not before
    mv.setAttribute('reveal', 'auto');
    mv.setAttribute('shadow-intensity', '0.8');
    mv.setAttribute('environment-image', 'assets/env/studio.hdr'); // same lighting as the chapters
    mv.setAttribute('tone-mapping', 'aces');
    mv.setAttribute('exposure', '1.3');
    mv.setAttribute('interaction-prompt', 'none'); // no camera-controls: a card must never grab the scroll
    mv.setAttribute('alt', `3D model of ${part.label}`);
    if (!reduceMotion) {
      mv.setAttribute('auto-rotate', '');
      mv.setAttribute('rotation-per-second', '16deg');
    }
    return mv;
  }

  // the playfield outline, twice: a faint full copy, and the one that draws itself in (CSS)
  function drawing() {
    const frag = document.createDocumentFragment();
    ['day-pf day-pf--ghost', 'day-pf'].forEach((cls) => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', `pf ${cls}`);
      svg.setAttribute('aria-hidden', 'true');
      if (window.buildPlayfield) window.buildPlayfield(svg);
      frag.appendChild(svg);
    });
    return frag;
  }

  const cards = entries.map((e) => {
    const li = document.createElement('li');
    li.style.setProperty('--u', toUnit(e.day).toFixed(3));
    const meta = `<p class="day-meta"><time datetime="${e.iso}">${e.date}</time><span>Day ${e.day}</span></p>`;
    const cap = `<p class="day-cap"${e.source ? ` title="${esc(e.source)}"` : ''}>${esc(e.caption)}</p>`;

    if (e.kind === 'model') {
      const part = partFor(e.model);
      li.className = 'day-card day-card--model';
      li.innerHTML = `
        <i class="day-elbow" aria-hidden="true"></i>
        <div class="day-body">
          <button type="button" class="day-open" aria-label="Open the 3D model: ${esc(e.caption)}, ${e.date}">
            <span class="day-sheet day-sheet--lead day-sheet--model"></span>
            <span class="day-badge" aria-hidden="true">3D</span>
          </button>
          ${meta}${cap}
        </div>`;
      li.querySelector('.day-sheet').appendChild(modelViewer(part));
      li.querySelector('.day-open').addEventListener('click', () => window.openLightbox && window.openLightbox(part));
    } else if (e.kind === 'drawing') {
      li.className = 'day-card day-card--drawing';
      li.innerHTML = `
        <i class="day-elbow" aria-hidden="true"></i>
        <div class="day-body">
          <div class="day-open" role="img" aria-label="The playfield drawing: ${esc(e.caption)}, ${e.date}">
            <span class="day-sheet day-sheet--lead day-sheet--drawing"></span>
          </div>
          ${meta}${cap}
        </div>`;
      li.querySelector('.day-sheet').appendChild(drawing());
    } else {
      li.className = 'day-card day-card--photos';
      const [lead, ...more] = e.items;
      const label = more.length
        ? `Open ${e.items.length} photos: ${e.caption}, ${e.date}`
        : `${lead.kind === 'video' ? 'Play clip' : 'Open photo'}: ${e.caption}, ${e.date}`;
      li.innerHTML = `
        <i class="day-elbow" aria-hidden="true"></i>
        <div class="day-body">
          <button type="button" class="day-open" aria-label="${esc(label)}">
            ${more.slice(0, 2).map((it, k) => `<span class="day-sheet day-sheet--b${k + 1}"><img src="${thumb(it)}" alt="" loading="lazy" decoding="async"></span>`).join('')}
            <span class="day-sheet day-sheet--lead"><img src="${thumb(lead)}" alt="" loading="lazy" decoding="async"></span>
            ${more.length ? `<span class="day-badge">+${more.length}</span>` : ''}
            ${lead.kind === 'video' && !more.length ? '<span class="day-badge day-badge--play" aria-hidden="true">&#9654;</span>' : ''}
          </button>
          ${meta}${cap}
        </div>`;
      li.querySelector('.day-open').addEventListener('click', () => window.openMedia && window.openMedia(e.items, 0));
    }
    list.appendChild(li);
    return li;
  });

  // The models are small (0.1-1 MB) but a blank card on arrival looks broken: once any of the
  // section is on screen, fetch them all instead of waiting for each card to scroll into view.
  const viewers = Array.from(list.querySelectorAll('model-viewer'));
  if (viewers.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((hits) => {
      if (!hits.some((h) => h.isIntersecting)) return;
      viewers.forEach((mv) => mv.setAttribute('loading', 'eager'));
      io.disconnect();
    });
    io.observe(section);
  }

  // ---------- geometry ----------
  let dayW = 40;
  let cursorX = 0;
  function measure() {
    dayW = Math.min(52, Math.max(30, innerWidth * 0.04));
    cursorX = Math.max(16, innerWidth * (innerWidth < 700 ? 0.16 : 0.22)); // room to the right for what's coming
    section.style.setProperty('--day-w', `${dayW}px`);
    section.style.setProperty('--cursor-x', `${cursorX}px`);
    section.style.setProperty('--units', UNITS);
  }

  // Two rows, alternating. A card that would run into the previous one on its row takes the
  // other row; if both are busy (three moments within a few days) it slides right, just far
  // enough to clear, and an elbow leader keeps it tied to its own day.
  function rows() {
    const width = Math.max(...cards.map((c) => c.offsetWidth)) || 150;
    const need = (width + 14) / dayW; // a card's width, in ruler units
    const end = [-Infinity, -Infinity];
    let widest = 0;
    cards.forEach((c, i) => {
      const u = toUnit(entries[i].day);
      let row = i % 2;
      let place = u;
      if (u < end[row]) {
        if (u >= end[1 - row]) row = 1 - row;
        else {
          row = end[0] <= end[1] ? 0 : 1;
          place = end[row];
        }
      }
      const shift = (place - u) * dayW;
      c.style.setProperty('--shift', `${shift.toFixed(1)}px`);
      c.classList.toggle('is-shifted', shift > 0.5);
      c.classList.toggle('day-card--high', row === 0);
      c.classList.toggle('day-card--low', row === 1);
      end[row] = place + need;
      widest = Math.max(widest, shift);
    });
    section.style.setProperty('--shift-max', `${Math.ceil(widest)}px`);
  }

  // the ruler: a tick a day, a longer one and the date every week, and a break sign across each
  // squeezed stretch
  function drawRuler() {
    const W = Math.ceil(UNITS * dayW);
    const x = (day) => (toUnit(day) * dayW).toFixed(1);
    let minor = '';
    let major = '';
    let labels = '';
    for (let day = 0; day <= LAST; day++) {
      if (inBreak(day)) continue;
      if (day % 7 === 0) {
        major += `M${x(day)} -8v16`;
        const clear = !breaks.some(([, , ua, ub]) => Math.abs(toUnit(day) - (ua + ub) / 2) < 2.2);
        if (clear) labels += `<text x="${x(day)}" y="26">${dateOf(day)}</text>`;
      } else minor += `M${x(day)} -4v8`;
    }
    if (LAST % 7) labels += `<text x="${x(LAST)}" y="26">${dateOf(LAST)}</text>`;
    let gaps = '';
    breaks.forEach(([a, b, ua, ub]) => {
      const mid = ((ua + ub) / 2) * dayW;
      gaps += `<rect class="days-break-gap" x="${(mid - 7).toFixed(1)}" y="-3" width="14" height="6"/>`;
      gaps += `<path class="days-break" d="M${(mid - 9).toFixed(1)} 7l6 -14M${(mid + 3).toFixed(1)} 7l6 -14"/>`;
      gaps += `<text class="days-break-label" x="${mid.toFixed(1)}" y="26">≈ ${Math.round((b - a) / 7)} weeks</text>`;
    });
    ruler.innerHTML = `<svg width="${W}" height="44" viewBox="0 -12 ${W} 44" aria-hidden="true" focusable="false">
      <path class="days-line" d="M0 0H${W}"/>
      <path class="days-tick" d="${minor}"/>
      <path class="days-tick days-tick--week" d="${major}"/>
      ${gaps}
      <g class="days-labels">${labels}</g>
    </svg>`;
  }

  function at(progress) {
    // a short dwell on the first and the last day
    const p = window.clamp01((progress - 0.04) / 0.92);
    const unit = p * UNITS;
    const day = toDay(unit);
    rail.style.transform = `translate3d(${(-unit * dayW).toFixed(1)}px, 0, 0)`;
    const whole = Math.round(day);
    readDay.textContent = `Day ${pad2(whole)}`;
    readDate.textContent = dateOf(whole);
    cards.forEach((c, i) => {
      c.classList.toggle('is-past', entries[i].day <= day + 0.35);
      c.classList.toggle('is-now', Math.abs(toUnit(entries[i].day) - unit) < 1.2);
    });
  }

  function layout() {
    measure();
    rows();
    drawRuler();
  }
  layout();

  const animated = window.filmScene(section, at);
  if (!animated) {
    section.classList.add('is-still');
    cards.forEach((c) => c.classList.add('is-past'));
    readDay.textContent = `${LAST} days`;
    readDate.textContent = `${entries[0].date} → ${entries[entries.length - 1].date}`;
    return;
  }

  // the pinned stretch is exactly as long as the ruler, plus the two dwells
  const setHeight = () => {
    layout();
    section.style.height = `calc(100svh - var(--nav-h) + ${Math.round((UNITS * dayW) / 0.92)}px)`;
  };
  setHeight();
  at(0);
  let t;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      setHeight();
      ScrollTrigger.refresh();
    }, 150);
  });
})();
