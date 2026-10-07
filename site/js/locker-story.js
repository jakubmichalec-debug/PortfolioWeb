const $ = id => document.getElementById(id);
const media = 'assets/media/lost-and-found/';
const version = new URL(import.meta.url).search; // "?v=N" from this script's own tag, so one cache bump covers the markup and modules it loads
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;

// "Try the locker" lands on the machine, not on the section heading above it. Lenis (when active) does the scrolling,
// otherwise the browser; reduced motion never animates.
const navHeight = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 64;
function scrollToY(y, instant = false) {
  y = Math.max(0, Math.round(y));
  if (window.lenis) window.lenis.scrollTo(y, { immediate: instant });
  else scrollTo({ top: y, behavior: motion && !instant ? 'smooth' : 'auto' });
}
// Centre an element in the space below the sticky bars (a plain scrollIntoView would tuck its top edge under them).
function showElement(element) {
  const bars = navHeight() + (document.querySelector('.lf-section-nav')?.offsetHeight || 0), rect = element.getBoundingClientRect();
  scrollToY(rect.top + scrollY - bars - Math.max(8, (innerHeight - bars - rect.height) / 2));
}
function goToLocker(instant = false) {
  const lab = $('locker-lab'), bench = lab.querySelector('.workbench'), scene = $('scene');
  const docTop = element => element.getBoundingClientRect().top + scrollY;
  const top = navHeight() + (document.querySelector('.lf-section-nav')?.offsetHeight || 0) + 12; // below the sticky bars
  if (!bench || !scene) { scrollToY(docTop(lab) - top, instant); return; } // still loading: the lab fills this space
  // Start as high as possible while the whole machine still fits: the task switch, then the workbench, then the guide text.
  // If even that is too tall (a short phone), start just above the main button so it stays visible with as much machine as fits.
  const machineBottom = $('machine').getBoundingClientRect().bottom + scrollY + 16, room = innerHeight - top - 8;
  const anchor = [lab.querySelector('.scenario-controls'), bench, lab.querySelector('.guide-current')].find(element => element && machineBottom - docTop(element) <= room);
  scrollToY((anchor ? docTop(anchor) : docTop($('next-action')) - 24) - top, instant);
  bench.focus({ preventScroll: true }); // keyboard users continue from the machine, as with a native anchor jump
}
document.addEventListener('click', event => {
  const link = event.target instanceof Element && event.target.closest('a[href="#try"]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); event.stopPropagation(); // capture phase: replaces main.js's generic anchor scroll
  goToLocker();
}, true);

// Reuse the exact tested demo markup and engine, not a second divergent simulation.
async function mountLocker() {
  const lab = $('locker-lab');
  try {
    const response = await fetch('previews/locker-demo.html' + version);
    if (!response.ok) throw new Error('Locker markup unavailable');
    const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
    const fragment = document.createDocumentFragment();
    for (const selector of ['.scenario-controls', '.workbench', '.under-the-hood', '.honesty-note']) {
      const section = parsed.querySelector(selector);
      if (!section) throw new Error('Incomplete locker markup');
      section.querySelectorAll('[href]:not([href^="#"])').forEach(link => link.href = new URL(link.getAttribute('href'), response.url).href); // in-page links such as #watch stay in-page
      fragment.append(document.importNode(section, true));
    }
    lab.replaceChildren(fragment);
    await import('./locker-demo.js' + version);
  } catch (error) {
    lab.replaceChildren();
    const message = document.createElement('p'); message.className = 'lf-loading';
    message.textContent = 'The interactive locker could not load. ';
    const link = document.createElement('a'); link.href = 'previews/locker-demo.html'; link.textContent = 'Open the standalone demo ↗';
    message.append(link); lab.append(message);
    console.error('Locker case study:', error);
  } finally {
    lab.setAttribute('aria-busy', 'false');
    window.ScrollTrigger?.refresh();
    if (location.hash === '#try') goToLocker(true);
  }
}
mountLocker();

const stages = [
  { file:'concept-sketch', alt:'Early concept sketch for the festival Lost and Found locker', text:'An early sketch connects the enclosure, RFID access and a place for found objects.' },
  { file:'early-lcd-test', alt:'Early breadboard experiment with the LCD display', text:'An early component experiment: getting the display to respond before integrating it into the locker. This is not the final wiring schematic.' },
  { file:'locker-rfid-reader', alt:'RFID reader and card on the workbench', text:'The MFRC522 reader turns a card into an identifier the program can compare. A small input becomes the beginning of the interaction.' },
  { file:'locker-wiring-lcd-rfid', alt:'Jumper wiring between the display, RFID reader and controller', text:'The individual tests come together: reader input, LCD messages and the wiring that connects them to the Arduino.' },
  { file:'locker-cardboard-front', alt:'Unpainted cardboard locker enclosure with its electronics mounted', text:'A cardboard enclosure gives the circuit a physical interface: a reader to scan, a display to read and a door to open.' },
  { file:'locker-finished-front', alt:'Finished black-painted Lost and Found locker prototype', text:'Painted and assembled into the demonstrated prototype. The shot dispenser visible in the background is a separate project.' }
];
let stageIndex = 0, imageAnimation;
function changeImage(image, src, alt) {
  imageAnimation?.cancel();
  image.src = media + src + '.webp'; image.alt = alt;
  if (motion) imageAnimation = image.animate([{opacity:.3,transform:'scale(.985)'},{opacity:1,transform:'scale(1)'}], {duration:420,easing:'cubic-bezier(.22,1,.36,1)'});
}
function selectStage(index) {
  stageIndex = index; const stage = stages[index];
  changeImage($('lf-stage-image'), stage.file, stage.alt);
  $('lf-stage-count').textContent = `${String(index+1).padStart(2,'0')} / 06`;
  $('lf-stage-caption').textContent = stage.text;
  document.querySelectorAll('[data-stage]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.stage) === index)));
  $('lf-stage-next').textContent = index === stages.length-1 ? 'Back to the first idea ↻' : 'Next build stage →';
  if (innerWidth <= 700) $('lf-stage-enlarge').scrollIntoView({behavior:motion?'smooth':'auto',block:'start'});
}
document.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => selectStage(Number(button.dataset.stage))));
$('lf-stage-next').addEventListener('click', () => selectStage((stageIndex+1)%stages.length));

const hardware = {
  arduino:{file:'locker-arduino-wiring',title:'The decision-maker.',text:'An Arduino Uno coordinates the reader, stored records and outputs. Item records live in RAM, rather than persistent storage. This photo shows the controller and jumper wiring before enclosure assembly.',spec:'Arduino Uno · SPI + I²C · volatile memory',alt:'Arduino Uno and jumper wiring before enclosure assembly'},
  rfid:{file:'locker-rfid-reader',title:'A card becomes an identifier.',text:'The MFRC522 supplies a UID. The program formats it as an uppercase string and compares it with the staff card and known personal cards. Item tags and owner cards have different roles.',spec:'MFRC522 · SPI · chip select 10 · reset 9',alt:'MFRC522 RFID reader on the workbench'},
  lcd:{file:'locker-wiring-lcd-rfid',title:'The state, in sixteen columns.',text:'A 16 × 2 display communicates readiness, registration, item records and access responses. The original program cycles through stored descriptions every three seconds.',spec:'I²C LCD · address 0x27 · 16 × 2 characters',alt:'LCD display, RFID reader and their jumper wiring'},
  servo:{file:'locker-inside',title:'Release the latch, not the door.',text:'The servo moves the locking mechanism. The visitor still opens the door by hand. The original handleLocker() gives an eight-second access window, then changes the servo position again.',spec:'Servo → pin 2 · handleLocker(): 0° then 90°',alt:'Interior of the actual enclosure and its latch mechanism'},
  feedback:{file:'early-led-buzzer-test',title:'Make the response unmistakable.',text:'An accepted action combines green light and a 1000 Hz beep. An unknown card triggers three red flashes and a 500 Hz beep. This early component-test diagram is process evidence, not the final circuit.',spec:'Red LED → 3 · green LED → 4 · buzzer → 5',alt:'Early LED and buzzer component-test diagram'}
};
let hardwareKey = 'arduino';
function selectHardware(key) {
  hardwareKey = key; const part = hardware[key];
  changeImage($('lf-hardware-image'), part.file, part.alt);
  $('lf-hardware-title').textContent = part.title; $('lf-hardware-description').textContent = part.text;
  $('lf-hardware-spec').textContent = part.spec; $('lf-hardware-caption').textContent = part.alt + '. Pin assignments are taken from the archived sketch.';
  document.querySelectorAll('[data-hardware]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.hardware === key)));
}
selectHardware('arduino');
document.querySelectorAll('[data-hardware]').forEach(button => button.addEventListener('click', () => selectHardware(button.dataset.hardware)));

const lightbox = $('lf-lightbox');
let lightboxTrigger;
function enlarge(image, caption, trigger) {
  lightboxTrigger = trigger;
  $('lf-lightbox-image').src = image.src; $('lf-lightbox-image').alt = image.alt;
  $('lf-lightbox-caption').textContent = caption;
  lightbox.showModal(); $('lf-lightbox-close').focus();
}
$('lf-stage-enlarge').addEventListener('click', event => enlarge($('lf-stage-image'), stages[stageIndex].text, event.currentTarget));
$('lf-hardware-enlarge').addEventListener('click', event => enlarge($('lf-hardware-image'), hardware[hardwareKey].text, event.currentTarget));
$('lf-lightbox-close').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => { if (event.target === lightbox && (event.clientX < lightbox.getBoundingClientRect().left || event.clientX > lightbox.getBoundingClientRect().right || event.clientY < lightbox.getBoundingClientRect().top || event.clientY > lightbox.getBoundingClientRect().bottom)) lightbox.close(); });
lightbox.addEventListener('close', () => lightboxTrigger?.focus());

const heroFilm = $('lf-hero-video'), filmToggle = $('lf-film-toggle');
let filmUserPaused = !motion;
function updateFilmButton() { filmToggle.textContent = heroFilm.paused ? 'Play ↗' : 'Pause Ⅱ'; filmToggle.setAttribute('aria-label', heroFilm.paused ? 'Play prototype preview' : 'Pause prototype preview'); }
filmToggle.addEventListener('click', () => { filmUserPaused = !heroFilm.paused; if (heroFilm.paused) heroFilm.play().catch(()=>{}); else heroFilm.pause(); });
heroFilm.addEventListener('play', updateFilmButton); heroFilm.addEventListener('pause', updateFilmButton);
const filmObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting && !filmUserPaused && !document.hidden) heroFilm.play().catch(()=>{}); else heroFilm.pause(); }), {threshold:.25});
filmObserver.observe(heroFilm);

const walkthrough = $('lf-walkthrough');
let shots = [], activeShot = -1;
const chapterNames = {ready:'Prototype ready',master:'Staff access',item:'Register an item',description:'Add a description',placement:'Put the wallet inside',closure:'Close the door · keys take',claim:'Scan the matching owner',denied:'Reject an unknown tag',inside:'Inside the build'};
function updateChapter() {
  const index = shots.findIndex(shot => walkthrough.currentTime >= shot.timelineIn && walkthrough.currentTime < shot.timelineOut);
  if (index < 0 || index === activeShot) return;
  activeShot = index;
  document.querySelectorAll('[data-chapter]').forEach(button => button.setAttribute('aria-current', String(Number(button.dataset.chapter) === index)));
  $('lf-chapter-caption').textContent = shots[index].lines.join(' ');
}
function playChapter(index) {
  const shot = shots[index]; if (!shot) return;
  walkthrough.currentTime = shot.timelineIn; updateChapter();
  const rect = walkthrough.getBoundingClientRect();
  if (innerWidth <= 700 || rect.bottom < 150 || rect.top > innerHeight-100) showElement(walkthrough);
  walkthrough.play().catch(()=>{});
}
// The demo's "watch it on the real prototype" links play the matching chapter. Before the chapters load, their #watch anchor still works.
$('locker-lab').addEventListener('click', event => {
  const link = event.target instanceof Element && event.target.closest('[data-watch]');
  const index = link ? shots.findIndex(shot => shot.id === link.dataset.watch) : -1;
  if (index < 0) return;
  event.preventDefault(); playChapter(index);
});
async function loadChapters() {
  try {
    const response = await fetch(media+'manifest.json');
    if (!response.ok) throw new Error('Chapters unavailable');
    const manifest = await response.json();
    shots = manifest.walkthrough.shots;
    for (const [index, shot] of shots.entries()) {
      const button = document.createElement('button'); button.type='button'; button.dataset.chapter=String(index);
      const time = document.createElement('time'); time.textContent=`00:${String(Math.floor(shot.timelineIn)).padStart(2,'0')}`;
      const name = chapterNames[shot.id] || shot.title;
      const title = document.createElement('strong'); title.textContent=name;
      const arrow = document.createElement('span'); arrow.textContent='↗'; arrow.setAttribute('aria-hidden','true');
      button.append(time,title,arrow); button.setAttribute('aria-label', `Play chapter: ${name}`);
      button.addEventListener('click', () => playChapter(index));
      $('lf-chapters').append(button);
    }
    updateChapter();
  } catch (error) { $('lf-chapters').textContent='Use the video controls to explore the demonstration.'; console.error('Video chapters:',error); }
}
loadChapters(); walkthrough.addEventListener('timeupdate',updateChapter);
new IntersectionObserver(entries => entries.forEach(entry => { if (!entry.isIntersecting) walkthrough.pause(); }),{threshold:.05}).observe(walkthrough);
document.addEventListener('visibilitychange', () => { if (document.hidden) { heroFilm.pause(); walkthrough.pause(); } });

const sectionLinks = [...document.querySelectorAll('.lf-section-nav a')];
const sectionObserver = new IntersectionObserver(entries => {
  const visible = entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
  if (!visible) return;
  sectionLinks.forEach(link => { if (link.hash === '#'+visible.target.id) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current'); });
  const active = sectionLinks.find(link => link.hash === '#'+visible.target.id), strip = active?.parentElement;
  if (strip && strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: active.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft - (strip.clientWidth - active.offsetWidth) / 2, behavior: motion ? 'smooth' : 'auto' });
}, {rootMargin:'-130px 0px -60% 0px'});
sectionLinks.forEach(link=>sectionObserver.observe(document.querySelector(link.hash)));

// One-time editorial motion; never transform the lab (its item ghosts use viewport coordinates).
if (motion) {
  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.animate([{opacity:0,transform:'translateY(22px)'},{opacity:1,transform:'translateY(0)'}], {duration:700,easing:'cubic-bezier(.22,1,.36,1)'});
    revealObserver.unobserve(entry.target);
  }),{threshold:.15});
  document.querySelectorAll('.lf-section-heading,.lf-context h2').forEach(element=>revealObserver.observe(element));
  document.querySelectorAll('.lf-hero-copy > *').forEach((element,index)=>element.animate([{opacity:0,transform:'translateY(15px)'},{opacity:1,transform:'translateY(0)'}],{duration:700,delay:index*70,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'}));
}
