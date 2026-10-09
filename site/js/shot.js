import { Dispenser, PRICE, duration, pumpTime } from './shot-engine.js';

const $ = id => document.getElementById(id);
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const media = 'assets/media/shot-dispenser/';
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const ease = t => t * t * (3 - 2 * t);

/* ---------- the dispenser drawing: one component, driven by a plain state object ---------- */
const RIG = `
<svg viewBox="0 0 440 560" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="@@cup"><path d="M186 404h68l-8 66h-52z"/></clipPath>
    <clipPath id="@@tank"><rect x="22" y="342" width="76" height="126" rx="4"/></clipPath>
    <pattern id="@@hex" width="34" height="58" patternUnits="userSpaceOnUse"><path d="M17 0l17 10v19L17 39 0 29V10zM17 39v19M0 29l-17 10M34 29l17 10" fill="none" stroke="currentColor" stroke-width=".7" opacity=".22"/></pattern>
  </defs>
  <g data-part="tank">
    <rect class="rig-line" x="22" y="342" width="76" height="126" rx="4"/>
    <g clip-path="url(#@@tank)"><rect class="rig-liquid js-tank" x="22" y="342" width="76" height="126"/></g>
    <text class="rig-label" x="60" y="486" text-anchor="middle">TANK (INSIDE)</text>
  </g>
  <g data-part="sensor"><rect class="rig-sensor" x="82" y="352" width="10" height="34" rx="2"/><circle class="rig-sensor js-float" cx="87" cy="392" r="6"/><text class="rig-label" x="66" y="334">SENSOR</text></g>
  <g data-part="pump">
    <path class="rig-hose" d="M48 446V250q0-22 22-22h118q22 0 22 22v124"/>
    <path class="rig-hose-flow js-flow" d="M48 446V250q0-22 22-22h118q22 0 22 22v124"/>
    <rect class="rig-pump" x="32" y="430" width="32" height="30" rx="4"/><text class="rig-label rig-label--in" x="48" y="449" text-anchor="middle">PUMP</text>
  </g>
  <g data-part="box"><rect class="rig-box" x="120" y="34" width="200" height="446" rx="3"/><rect x="120" y="34" width="200" height="446" rx="3" fill="url(#@@hex)"/></g>
  <g data-part="lcd">
    <rect class="rig-lcd-frame" x="140" y="60" width="160" height="62" rx="3"/><rect class="rig-lcd" x="147" y="67" width="146" height="48" rx="2"/>
    <text class="rig-lcd-text js-l1" x="154" y="87">Welcome! Please</text><text class="rig-lcd-text js-l2" x="154" y="106">scan bracelet</text>
  </g>
  <g data-part="leds"><circle class="rig-led rig-led--red js-red" cx="296" cy="146" r="6"/><circle class="rig-led rig-led--green js-green" cx="296" cy="166" r="6"/></g>
  <g data-part="buzzer"><circle class="rig-buzzer js-buzzer" cx="296" cy="196" r="9"/><circle class="rig-buzzer-dot" cx="296" cy="196" r="2.5"/></g>
  <g data-part="reader">
    <rect class="rig-reader" x="166" y="140" width="88" height="110" rx="4"/>
    <g class="rig-rings js-rings"><circle cx="210" cy="206" r="9"/><circle cx="210" cy="206" r="18"/><circle cx="210" cy="206" r="27"/></g>
    <rect class="rig-chip" x="196" y="150" width="28" height="14" rx="2"/><text class="rig-label rig-label--in" x="210" y="244" text-anchor="middle">RFID-RC522</text>
  </g>
  <g data-part="pump"><rect class="rig-spout" x="176" y="274" width="68" height="100" rx="3"/><rect class="rig-stream js-stream" x="207" y="374" width="6" height="92" rx="3"/></g>
  <g data-part="cup">
    <g clip-path="url(#@@cup)"><rect class="rig-drink js-drink" x="180" y="400" width="80" height="74"/></g>
    <path class="rig-cup" d="M186 404h68l-8 66h-52z"/><rect class="rig-base" x="150" y="470" width="140" height="12" rx="2"/>
  </g>
  <g class="rig-tag js-tag" data-part="reader">
    <path class="rig-band" d="M0 -12h150v24H0z"/><circle class="rig-fob" cx="6" cy="0" r="23"/><circle class="rig-fob-hole" cx="-6" cy="0" r="5"/>
    <text class="rig-balance js-balance" x="92" y="5" text-anchor="middle"></text>
  </g>
</svg>`;
let rigCount = 0;
function createRig(host) {
  const id = `rig${rigCount++}`;
  host.innerHTML = RIG.replaceAll('@@', `${id}-`);
  const q = name => host.querySelector(`.js-${name}`);
  const parts = { l1: q('l1'), l2: q('l2'), red: q('red'), green: q('green'), buzzer: q('buzzer'), rings: q('rings'), stream: q('stream'), drink: q('drink'), tank: q('tank'), float: q('float'), flow: q('flow'), tag: q('tag'), balance: q('balance') };
  const state = {};
  return {
    host,
    set(next) {
      Object.assign(state, next);
      const { lcd = ['', ''], red = false, green = false, pump = false, tone = 0, fill = 0, tank = 1, tag = 0, balance = '' } = state;
      if (parts.l1.textContent !== lcd[0]) parts.l1.textContent = lcd[0];
      if (parts.l2.textContent !== lcd[1]) parts.l2.textContent = lcd[1];
      parts.red.classList.toggle('on', red); parts.green.classList.toggle('on', green);
      parts.buzzer.classList.toggle('on', !!tone);
      parts.stream.classList.toggle('on', pump); parts.flow.classList.toggle('on', pump);
      parts.rings.classList.toggle('on', tag > .92);
      parts.drink.setAttribute('y', String(474 - 62 * clamp(fill)));
      const level = 126 * clamp(tank);
      parts.tank.setAttribute('y', String(468 - level)); parts.float.setAttribute('cy', String(clamp(468 - level, 392, 458)));
      parts.tag.setAttribute('transform', `translate(${430 - 190 * ease(clamp(tag))} 196) rotate(${-8 + 8 * ease(clamp(tag))})`);
      parts.tag.style.opacity = String(clamp(tag * 4));
      if (parts.balance.textContent !== balance) parts.balance.textContent = balance;
    },
    highlight(part) { host.dataset.highlight = part || ''; }
  };
}

/* ---------- one drink, as a function of progress 0..1 (the scroll story and the hero loop share it) ---------- */
function story(p) {
  const welcome = ['Welcome! Please', 'scan bracelet'], pouring = ['Pouring...', 'New balance: 9'];
  const tagIn = clamp((p - .14) / .12), tagOut = clamp((p - .56) / .1);
  const base = { red: false, green: true, pump: false, tone: 0, fill: 0, tank: 1, tag: tagIn * (1 - tagOut), balance: p < .34 ? '15 credits' : '9 credits', lcd: welcome };
  if (p < .34) return { beat: p < .14 ? 0 : 1, ...base };
  if (p < .5) return { beat: 2, ...base, lcd: pouring };
  if (p < .84) {
    const t = (p - .5) / .34;
    return { beat: 3, ...base, lcd: pouring, pump: true, green: Math.floor(t * 10) % 2 === 0, fill: t, tank: 1 - .18 * t };
  }
  return { beat: 4, ...base, lcd: p < .9 ? pouring : ['Enjoy!', ''], green: false, fill: 1, tank: .82 };
}

/* hero: the same story on a gentle loop, only while it is on screen */
{
  const rig = createRig(document.querySelector('[data-rig="hero"]'));
  rig.set(story(motion ? 0 : .95));
  if (motion) {
    let visible = false, start = 0;
    const frame = now => {
      if (!visible) return;
      const t = ((now - start) / 11000) % 1;
      rig.set(story(clamp(t * 1.12)));
      requestAnimationFrame(frame);
    };
    new IntersectionObserver(([entry]) => { const was = visible; visible = entry.isIntersecting && !document.hidden; if (visible && !was) { start = performance.now(); requestAnimationFrame(frame); } }, { threshold: .2 }).observe(rig.host);
  }
}

/* scroll story: the page's scroll position is the clock */
{
  const section = $('flow'), rig = createRig(document.querySelector('[data-rig="flow"]')), beats = [...document.querySelectorAll('[data-beat]')];
  let queued = false;
  const update = () => {
    queued = false;
    const rect = section.getBoundingClientRect();
    const p = clamp(-rect.top / Math.max(1, rect.height - innerHeight));
    const now = story(p);
    rig.set(now);
    beats.forEach((beat, index) => { beat.classList.toggle('current', index === now.beat); beat.classList.toggle('done', index < now.beat); });
    $('flow-bar').style.transform = `scaleX(${p})`;
  };
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', request, { passive: true }); addEventListener('resize', request);
  update();
}

/* ---------- the simulator ---------- */
{
  const engine = new Dispenser(), rig = createRig(document.querySelector('[data-rig="lab"]'));
  const tags = [...document.querySelectorAll('[data-tag]')];
  let frame = 0, audio = null, oscillator = null, fill = 0, tank = 1, playing = null;
  const speed = () => $('lab-real').checked ? 1 : 2.5;
  const titles = {
    poured: ['POURING', 'Paid. One shot coming up.', `${PRICE} credits left the bracelet first, then the pump ran for five seconds.`],
    declined: ['DECLINED', 'Not enough credits.', `A shot costs ${PRICE}. Three beeps, four red blinks, and the pump stays off.`],
    unknown: ['DENIED', 'This tag is not registered.', 'Only the two bracelets written into the sketch can pay.'],
    'water-low': ['WATER LOW', 'The tank is empty.', 'The sketch stops reading bracelets until the level sensor sees liquid again.']
  };
  function tone(frequency) {
    if (!$('lab-sound').checked || !audio) return;
    if (frequency && !oscillator) {
      oscillator = audio.createOscillator(); const gain = audio.createGain();
      oscillator.type = 'square'; oscillator.frequency.value = frequency; gain.gain.value = .03;
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start();
    } else if (!frequency && oscillator) { oscillator.stop(); oscillator = null; }
  }
  function show(step, extra = {}) { rig.set({ ...step, fill, tank, tag: 0, balance: '', ...extra }); tone(step.tone); }
  function renderPanel(state, title, text) {
    $('lab-state').textContent = state; $('lab-title').textContent = title; $('lab-text').textContent = text;
    $('bal-a').textContent = String(engine.balance.a); $('bal-b').textContent = String(engine.balance.b);
    tags.forEach(button => { button.disabled = !!playing; });
    $('lab-tank').textContent = engine.water ? 'Empty the tank' : 'Refill the tank'; $('lab-tank').setAttribute('aria-pressed', String(!engine.water));
    $('lab-tank').disabled = !!playing; $('lab-wait').hidden = !playing;
    $('lab-log').replaceChildren(...engine.log.slice(-7).map(line => Object.assign(document.createElement('li'), { textContent: line })));
  }
  function rest() {
    const idle = engine.idle();
    renderPanel(engine.water ? 'READY' : 'WATER LOW', engine.water ? 'Pick a bracelet' : 'Refill to continue', engine.water ? 'Green light on. The dispenser is waiting for a tap.' : 'Red light on. Taps are ignored until the tank is refilled.');
    show(idle);
  }
  function stop() { cancelAnimationFrame(frame); tone(0); }
  function finish() {
    if (!playing) return;
    stop();
    const { steps, outcome, tankTo } = playing; playing = null;
    if (outcome === 'poured') { fill = 1; tank = tankTo; }
    const [state, title, text] = titles[outcome];
    renderPanel(outcome === 'poured' ? 'ENJOY' : state, outcome === 'poured' ? 'Enjoy!' : title, text);
    show(steps[steps.length - 1]);
    document.dispatchEvent(new CustomEvent('shot:outcome', { detail: outcome }));
  }
  // One clock drives everything: sketch time = real time x speed, and the current step is looked up from it.
  function play(key) {
    if (playing) return;
    const result = engine.scan(key), steps = result.steps, total = duration(steps), pumpTotal = pumpTime(steps) || 1;
    const poured = result.outcome === 'poured', tankFrom = tank, tankTo = poured ? Math.max(.1, tank - .18) : tank;
    const balance = key in engine.balance ? `${engine.balance[key]} credits` : '';
    if (poured) fill = 0;
    playing = { ...result, tankTo };
    renderPanel(...titles[result.outcome]);
    const began = performance.now(), rate = speed();
    const tick = now => {
      if (!playing) return;
      const t = (now - began) * rate;
      if (t >= total) { finish(); return; }
      let start = 0, pumped = 0, step = steps[0];
      for (step of steps) {
        if (t < start + step.ms) { if (step.pump) pumped += t - start; break; }
        start += step.ms; if (step.pump) pumped += step.ms;
      }
      if (poured) { fill = pumped / pumpTotal; tank = tankFrom + (tankTo - tankFrom) * fill; }
      show(step, { tag: clamp(1.5 - t / 800), balance });
      $('lab-wait-fill').style.transform = `scaleX(${clamp(1 - t / total)})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }
  tags.forEach(button => button.addEventListener('click', () => play(button.dataset.tag)));
  $('lab-skip').addEventListener('click', finish);
  $('lab-tank').addEventListener('click', () => { engine.water = !engine.water; tank = engine.water ? 1 : .04; if (!engine.water) engine.log.push('Water Low! Refill required'); rest(); document.dispatchEvent(new CustomEvent('shot:outcome', { detail: 'water-low' })); });
  $('lab-reset').addEventListener('click', () => { stop(); playing = null; engine.reset(); fill = 0; tank = 1; rest(); });
  $('lab-sound').addEventListener('change', async () => { if ($('lab-sound').checked) { audio ||= new (window.AudioContext || window.webkitAudioContext)(); await audio.resume(); } else tone(0); });
  rest();
}

/* ---------- signals: point at a part ---------- */
{
  const host = document.querySelector('[data-rig="signals"]');
  if (host) {
    const rig = createRig(host); rig.set({ lcd: ['Welcome! Please', 'scan bracelet'], green: true, tank: .8, fill: .6, tag: 0 });
    const map = { sensor: 'sensor', reader: 'reader', lcd: 'lcd', leds: 'leds', pump: 'pump', buzzer: 'buzzer' };
    const signals = [...document.querySelectorAll('[data-signal]')];
    const pick = button => { signals.forEach(other => other.setAttribute('aria-pressed', String(other === button))); rig.highlight(button ? map[button.dataset.signal] : ''); };
    signals.forEach(button => { button.addEventListener('click', () => pick(button)); button.addEventListener('pointerenter', () => pick(button)); button.addEventListener('focus', () => pick(button)); });
    pick(signals[0]);
  }
}

/* ---------- build steps ---------- */
{
  const steps = [
    ['sketch', 'The idea', 'Concept sketch', 'The first drawing already has every part: reader, LEDs, buzzer, display, pump, level sensor and a cup under the spout.'],
    ['test-leds', 'Test 1', 'LEDs', 'Blinking LEDs from three pins in Tinkercad: the simplest possible output, and the first proof the board listens.'],
    ['test-lcd', 'Test 2', 'LCD over I²C', 'The 16 × 2 display on two data wires, printing its first messages.'],
    ['test-pump', 'Test 3', 'Pump through a transistor', 'A motor needs more current than a pin can give, so an NMOS transistor switches a separate battery. A button stood in for the tap.'],
    ['test-water-sensor', 'Test 4', 'Water level', 'Reading the tank. In this test the value was analog; the final sketch reads the sensor as a simple on/off pin.'],
    ['test-buzzer', 'Test 5', 'Buzzer', 'One pin, one tone: the sound for “something is wrong”.'],
    ['test-reader', 'Test 6', 'RFID reader', 'The MFRC522 on the SPI pins, printing each tag’s unique ID to the serial monitor.'],
    ['setup', 'All together', 'The full circuit', 'Every tested part on one Arduino Uno: reader, display, LEDs, buzzer, level sensor, and the pump on its own battery.'],
    ['inside', 'The real one', 'Inside the box', 'The Arduino on a cardboard shelf, the tank below it, and the yellow hose that carries the drink to the spout.'],
    ['front-finished', 'The real one', 'Finished prototype', 'Display on top, reader below it, and the spout over the cup. The pattern on the cardboard is drawn by hand.']
  ];
  const sizes = { sketch: [788, 823], 'test-leds': [693, 799], 'test-lcd': [1101, 720], 'test-pump': [992, 744], 'test-water-sensor': [961, 642], 'test-buzzer': [366, 323], 'test-reader': [608, 619], setup: [1324, 866], inside: [1235, 927], 'front-finished': [963, 1284] };
  let current = 0, fade;
  const image = $('sd-build-img');
  function select(index, scroll = false) {
    current = index; const [file, kicker, title, text] = steps[index];
    fade?.cancel(); image.src = `${media}${file}.webp`; image.alt = `${title}: ${text}`; [image.width, image.height] = sizes[file];
    if (motion) fade = image.animate([{ opacity: .25, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
    $('sd-build-count').textContent = `${String(index + 1).padStart(2, '0')} / ${steps.length}`; $('sd-build-cap').textContent = text;
    document.querySelectorAll('[data-step]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.step) === index)));
    if (scroll && innerWidth <= 800) $('sd-enlarge').scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'center' });
  }
  $('sd-steps').append(...steps.map(([, kicker, title], index) => {
    const button = document.createElement('button'); button.dataset.step = String(index);
    button.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><div><small></small><strong></strong></div>`;
    button.querySelector('small').textContent = kicker; button.querySelector('strong').textContent = title;
    button.addEventListener('click', () => select(index, true)); return button;
  }));
  select(0);
  const box = $('sd-lightbox'); let opener;
  $('sd-enlarge').addEventListener('click', event => { opener = event.currentTarget; $('sd-lightbox-img').src = image.src; $('sd-lightbox-img').alt = image.alt; $('sd-lightbox-cap').textContent = steps[current][3]; box.showModal(); $('sd-lightbox-close').focus(); });
  $('sd-lightbox-close').addEventListener('click', () => box.close());
  box.addEventListener('click', event => { if (event.target === box) box.close(); });
  box.addEventListener('close', () => opener?.focus());
}

/* ---------- the sketch, by function ---------- */
{
  const tabs = {
    setup: ['Pins and loop', 'setup() and loop()', 1, 36, 'Thirteen lines of pins, two balances, and a loop that does one thing: check the water every five seconds.'],
    water: ['Water check', 'WaterLevelCheck()', 101, 124, 'With water: green light, welcome message, read a tag. Without: red light, three beeps, and no reading at all.'],
    rfid: ['Read the tag', 'handleRFID()', 126, 159, 'The tag’s bytes become an uppercase string, which is compared with the two known bracelets.'],
    pay: ['Pay and pour', 'processTransaction()', 161, 194, 'Enough credits: subtract six, pump for five seconds, say Enjoy. Not enough: beep and blink red.'],
    helpers: ['Helpers', 'One job each', 38, 99, 'Small methods for the pins, display, LEDs, buzzer and pump keep the logic above readable.']
  };
  let lines = null, active = 'pay';
  function show(key) {
    active = key; const [, label, from, to, note] = tabs[key];
    $('sd-code-label').textContent = label; $('sd-code-note').textContent = `shot-dispenser.ino · lines ${from}–${to} · ${note}`;
    if (lines) $('sd-code-text').textContent = lines.slice(from - 1, to).join('\n');
    document.querySelectorAll('[data-code]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.code === key)));
  }
  $('sd-code-tabs').append(...Object.entries(tabs).map(([key, [name]]) => { const button = document.createElement('button'); button.dataset.code = key; button.textContent = name; button.addEventListener('click', () => show(key)); return button; }));
  show(active);
  fetch(new URL('../assets/code/shot-dispenser.ino', import.meta.url)).then(response => { if (!response.ok) throw new Error('unavailable'); return response.text(); })
    .then(text => { lines = text.split(/\r?\n/); show(active); })
    .catch(() => { $('sd-code-text').textContent = 'The sketch could not load. Use the download link above.'; });
  document.addEventListener('shot:outcome', event => show({ poured: 'pay', declined: 'pay', unknown: 'rfid', 'water-low': 'water' }[event.detail]));
}

/* ---------- the video and what its display says ---------- */
{
  const video = $('sd-video');
  const moments = [[0, 'Start-up', 'System Ready!', ''], [2, 'Waiting for a tap', 'Welcome! Please', 'scan bracelet'], [7, 'Paid, pouring', 'Pouring...', 'New balance: 9'], [15.2, 'Done', 'Enjoy!', ''], [18.3, 'Ready again', 'Welcome!', 'Scan bracelet']];
  let shown = -1;
  const update = () => {
    const index = moments.findLastIndex(([time]) => video.currentTime >= time);
    if (index === shown || index < 0) return;
    shown = index; $('sd-v1').textContent = moments[index][2]; $('sd-v2').textContent = moments[index][3] || ' ';
    document.querySelectorAll('[data-moment]').forEach(button => button.setAttribute('aria-current', String(Number(button.dataset.moment) === index)));
  };
  $('sd-moments').append(...moments.map(([time, name], index) => {
    const button = document.createElement('button'); button.dataset.moment = String(index); button.setAttribute('aria-label', `Play from: ${name}`);
    button.innerHTML = `<time>00:${String(Math.floor(time)).padStart(2, '0')}</time><strong></strong><span aria-hidden="true">↗</span>`; button.querySelector('strong').textContent = name;
    button.addEventListener('click', () => { video.currentTime = time; update(); video.play().catch(() => {}); }); return button;
  }));
  video.addEventListener('timeupdate', update); video.addEventListener('seeked', update); update();
  new IntersectionObserver(entries => entries.forEach(entry => { if (!entry.isIntersecting) video.pause(); }), { threshold: .05 }).observe(video);
}

/* ---------- section nav: mark where we are ---------- */
{
  const links = [...document.querySelectorAll('.sd-section-nav a')];
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    links.forEach(link => { if (link.hash === `#${visible.target.id}`) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
  }, { rootMargin: '-130px 0px -60% 0px' });
  links.forEach(link => observer.observe(document.querySelector(link.hash)));
}
