/* "52 days": the build as dated moments on a drafting ruler, 24 Apr -> 15 Jun. Scrolling
   slides the ruler sideways under a fixed cursor that reads out the day it's on; each photo
   develops from cyanotype into colour as the cursor reaches the day it was taken. Dates are
   the phones' own capture dates (tools/make_pinball_media.py TIMELINE). */
(() => {
  'use strict';

  const items = (window.PINBALL_MEDIA || {}).timeline || [];
  const section = document.querySelector('[data-scene="days"]');
  if (!section || !items.length) return;

  const pin = section.querySelector('.days-pin');
  const rail = section.querySelector('.days-rail');
  const list = section.querySelector('.days-cards');
  const ruler = section.querySelector('.days-ruler');
  const readDay = section.querySelector('.days-readout-day');
  const readDate = section.querySelector('.days-readout-date');
  const LAST = items[items.length - 1].day;
  const start = new Date(`${items[0].iso}T12:00:00`);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateOf = (day) => {
    const d = new Date(start);
    d.setDate(d.getDate() + day);
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };
  const pad2 = (n) => String(n).padStart(2, '0');

  // ---------- cards: alternate above / below the ruler so neighbouring days never collide ----------
  const cards = items.map((item, i) => {
    const li = document.createElement('li');
    li.className = `day-card day-card--${i % 2 ? 'low' : 'high'}`;
    li.style.setProperty('--day', item.day);
    const clip = item.kind === 'video';
    li.innerHTML = `
      <button type="button" class="day-open" aria-label="${clip ? 'Play clip' : 'Open photo'}: ${item.caption}, ${item.date}">
        <img src="${clip ? item.poster : item.thumb}" alt="" loading="lazy" decoding="async">
      </button>
      <p class="day-meta"><time datetime="${item.iso}">${item.date}</time><span>Day ${item.day}</span></p>
      <p class="day-cap">${item.caption}</p>`;
    li.querySelector('.day-open').addEventListener('click', () => window.openMedia && window.openMedia(items, i));
    list.appendChild(li);
    return li;
  });

  // ---------- ruler labels: every week, plus the last day ----------
  const marks = [];
  for (let d = 0; d <= LAST; d += 7) marks.push(d);
  if (marks[marks.length - 1] !== LAST) marks.push(LAST);
  ruler.innerHTML = marks.map((d) => `<span class="days-mark" style="--day:${d}">${dateOf(d)}</span>`).join('');

  // ---------- geometry ----------
  let dayW = 40;
  let cursorX = 0;
  function measure() {
    dayW = Math.min(46, Math.max(30, innerWidth * 0.036));
    cursorX = Math.max(parseFloat(getComputedStyle(pin).paddingLeft) || 16, innerWidth * (innerWidth < 700 ? 0.08 : 0.24));
    section.style.setProperty('--day-w', `${dayW}px`);
    section.style.setProperty('--cursor-x', `${cursorX}px`);
    section.style.setProperty('--span', LAST);
  }
  measure();

  function at(progress) {
    // a short dwell on the first and the last day
    const p = window.clamp01((progress - 0.04) / 0.92);
    const day = p * LAST;
    rail.style.transform = `translate3d(${(-day * dayW).toFixed(1)}px, 0, 0)`;
    const whole = Math.round(day);
    readDay.textContent = `Day ${pad2(whole)}`;
    readDate.textContent = dateOf(whole);
    cards.forEach((c, i) => c.classList.toggle('is-past', items[i].day <= day + 0.35));
  }

  const animated = window.filmScene(section, at);
  if (!animated) {
    section.classList.add('is-still');
    cards.forEach((c) => c.classList.add('is-past'));
    readDay.textContent = `${LAST} days`;
    readDate.textContent = `${items[0].date} → ${items[items.length - 1].date}`;
    return;
  }

  // the pinned stretch is exactly as long as the ruler, plus the two dwells
  const setHeight = () => {
    measure();
    section.style.height = `calc(100svh - var(--nav-h) + ${Math.round((LAST * dayW) / 0.92)}px)`;
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
