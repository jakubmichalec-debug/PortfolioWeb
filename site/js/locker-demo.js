import { LockerEngine, TAGS } from './locker-engine.js';
import { feedbackSpeed, isFeedbackWait, skipFeedback, realFootageFor } from './locker-pacing.js';

const root = document;
const engine = new LockerEngine();
const $ = id => root.getElementById(id);
let excerpts = [], lastCode = '', inspectedPart = 'rfid', audio = null, lastTime = performance.now(), reading = false, scanDelay = null;
let renderedState = '';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// On the case-study page each outcome links to the matching chapter of the real-prototype video (manifest ids). The standalone preview has no video section.
const embedded = !!$('scene').closest('.locker-lab');
const footage = { denied: 'Watch an unknown card get rejected on the real prototype', claim: 'Watch a matching card release the real locker', master: 'Watch staff register an item on the real prototype' };
const quickFeedback = () => Boolean($('quick')?.checked);
const parts = {
  arduino: { title: 'One board. One decision loop.', text: 'The Arduino compares the RFID identifier with the staff card and stored owners, then coordinates the LCD, LEDs, buzzer and servo. This exploded view illustrates where the electronics sit; the real wiring photos below show what was actually built.', spec: 'Arduino Uno · SPI reader · I²C display · pins 2 / 3 / 4 / 5 / 9 / 10', code: 'setup' },
  rfid: { title: 'A card becomes a string.', text: 'The MFRC522 reads the UID. getRFIDTag() adds leading zeroes and converts it to uppercase. That string is compared with the master card and personal tags.', spec: 'MFRC522 · chip select 10 · reset 9', code: 'read-tag' },
  lcd: { title: 'The machine talks back.', text: 'A 16 × 2 LCD shows readiness, registration, item IDs and denied access. Stored descriptions rotate every 3 seconds. The browser wraps long messages for legibility; the real display has only 16 columns.', spec: 'LiquidCrystal_I2C · 0x27 · 16 × 2', code: 'display-cycle' },
  servo: { title: 'The latch, made visible.', text: 'The yellow arm crosses the door keeper when locked and rotates clear when released. Your original handleLocker() uses an eight-second window. This guided walkthrough holds it released until you move the item and close the door, so you can learn without rushing.', spec: 'Servo → pin 2 · original: 0° / 90° · exposed teaching view', code: 'servo-and-feedback' },
  feedback: { title: 'See it. Hear it.', text: 'An accepted action uses green and a 1000 Hz beep. An unknown card uses a 500 Hz beep and three red flashes. A recognised card with no matching item beeps, but does not flash red.', spec: 'Red → 3 · green → 4 · buzzer → 5', code: 'red-feedback' },
  memory: { title: 'Records are not physical items.', text: 'The original arrays hold an item tag, description and owner. Registration assigns owner A. The original code removes the first match after eight seconds, without sensing collection. This guided demo instead waits for you to take the item and close the door.', spec: '10 array slots · volatile storage · hardcoded owner', code: 'owner-match' }
};
const labels = { setup: 'Hardware and pin configuration', 'read-tag': 'getRFIDTag()', registration: 'Staff registration', 'owner-match': 'Personal tag → owner match', 'access-denied': 'Unknown tag → access denied', 'servo-and-feedback': 'handleLocker()', 'red-feedback': 'flashRedLed()', 'display-cycle': 'autoListDescriptions()' };

function showCode(id) {
  if (id === lastCode) return;
  const excerpt = excerpts.find(item => item.id === id);
  if (!excerpt) return;
  lastCode = id; $('code').textContent = excerpt.code; $('code-label').textContent = labels[id];
  $('code-location').textContent = `fusion_project_final.ino · lines ${excerpt.startLine}–${excerpt.endLine} · unmodified source`;
}
function inspect(part) {
  inspectedPart = part; const info = parts[part];
  $('part-title').textContent = info.title; $('part-description').textContent = info.text; $('hardware-spec').textContent = info.spec;
  root.querySelectorAll('.part-tabs button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.part === part)));
  showCode(info.code);
}
function followSignal() {
  const mapped = { 'read-tag': 'rfid', 'owner-match': 'memory', registration: 'memory', 'access-denied': 'feedback', 'servo-and-feedback': 'servo', 'display-cycle': 'lcd' };
  inspect(mapped[engine.code] || 'rfid'); showCode(engine.code);
}
function buzzer(frequency) {
  if (!$('sound').checked || !audio || !frequency) return;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.type = 'square'; oscillator.frequency.value = frequency; gain.gain.value = .025;
  oscillator.connect(gain); gain.connect(audio.destination); oscillator.start();
  gain.gain.setTargetAtTime(0, audio.currentTime + .45, .015); oscillator.stop(audio.currentTime + .5);
}
const itemIcons = {
  wallet: '<svg viewBox="0 0 110 90" aria-hidden="true"><rect x="8" y="20" width="92" height="62" rx="8" fill="#946d47" stroke="#e3bc89" stroke-width="2"/><rect x="14" y="26" width="80" height="50" rx="4" fill="none" stroke="#d6b388" stroke-dasharray="3 3"/><rect x="77" y="42" width="26" height="18" rx="4" fill="#ac835a" stroke="#edc898"/><circle cx="88" cy="51" r="3" fill="#efcf9f"/></svg>',
  keys: '<svg viewBox="0 0 110 90" aria-hidden="true"><circle cx="38" cy="29" r="20" fill="none" stroke="#d6e4f4" stroke-width="6"/><path d="M51 44l28 32m-9-10l8-7m-3 12l8-7" stroke="#d6e4f4" stroke-width="9" fill="none"/></svg>',
  object: '<svg viewBox="0 0 110 90" aria-hidden="true"><path d="M24 22h61l8 59H16z" fill="#194b8c" stroke="#b4d0f5" stroke-width="2"/><path d="M40 24v-8a15 15 0 0 1 30 0v8" fill="none" stroke="#b4d0f5" stroke-width="3"/><rect x="39" y="39" width="32" height="23" fill="#ffd60a"/><path d="M44 45h22m-22 6h15" stroke="#08205a" stroke-width="2"/></svg>'
};
function iconFor(item) { return itemIcons[/wallet/i.test(item.description) ? 'wallet' : /keys?/i.test(item.description) ? 'keys' : 'object']; }
function flyGraphic(markup, from, to, duration = 650, className = 'item-flight') {
  if (reducedMotion || !from || !to || !from.width || !to.width) return;
  const ghost = root.createElement('div'); ghost.className = className; ghost.innerHTML = markup;
  ghost.style.left = `${from.left}px`; ghost.style.top = `${from.top}px`; ghost.style.width = `${Math.min(100, from.width)}px`;
  ($('scene').closest('.locker-lab') || root.body).append(ghost);
  const dx = to.left + to.width / 2 - from.left - Math.min(100, from.width) / 2;
  const dy = to.top + to.height / 2 - from.top - 40;
  const flight = ghost.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx * .45}px,${dy * .45 - 45}px) scale(1.12) rotate(-8deg)`,offset:.45,opacity:1},{transform:`translate(${dx}px,${dy}px) scale(.8)`,opacity:.2}], {duration,easing:'cubic-bezier(.2,.75,.25,1)',fill:'forwards'});
  flight.finished.then(() => ghost.remove()).catch(() => ghost.remove());
}
function moveItem() {
  const item = engine.pendingItem;
  const source = engine.action === 'claim' ? root.querySelector(`[data-item-id="${item?.id}"]`) : root.querySelector('.hand-item');
  const target = engine.action === 'claim' ? $('hand-items') : $('physical-items');
  const from = source?.getBoundingClientRect(), to = target?.getBoundingClientRect();
  if (engine.transferItem()) { flyGraphic(iconFor(item), from, to); followSignal(); }
  render(); $('next-action').focus();
}
function guideInfo() {
  const store = engine.scenario === 'store';
  const steps = store ? ['Staff card', 'Item tag', 'Description', 'Open', 'Put inside', 'Close'] : ['Personal card', 'Open', 'Take item', 'Close'];
  const index = store ? ({'await-tag':1,'await-description':2,unlocked:3,opening:3,transfer:4,'moving-item':4,'close-door':5,closing:5,complete:6}[engine.phase] || 0) : ({unlocked:1,opening:1,transfer:2,'moving-item':2,'close-door':3,closing:3,complete:4}[engine.phase] || 0);
  const name = engine.pendingItem?.description || (engine.items[0]?.description || 'your item');
  let title, instruction, action, command;
  if (reading) {
    title = 'Reading the card'; instruction = 'The RFID reader extracts the identifier. The Arduino then checks which action that card is allowed to perform.';
    action = 'Reading RFID…'; command = 'wait';
  } else if (engine.phase === 'opening' || engine.phase === 'moving-item') {
    title = engine.phase === 'opening' ? 'Opening the door' : store ? `Placing ${name} inside` : `Taking ${name} out`;
    instruction = engine.phase === 'opening' ? 'The latch stays clear while the door swings open. The item step unlocks once it is fully open.' : 'Wait for the item to reach its new position. Then you can close and secure the door.';
    action = engine.phase === 'opening' ? 'Opening…' : 'Moving the item…'; command = 'wait';
  } else if (engine.phase === 'closing') {
    title = 'Closing, then locking'; instruction = 'The item step is complete. The latch waits for the door to close, then rotates into the keeper.';
    action = 'Closing the door…'; command = 'wait';
  } else if (engine.phase === 'complete') {
    title = 'Done. The door is secured.'; instruction = engine.message;
    command = !store && engine.items.length ? 'continue' : 'restart'; action = command === 'continue' ? 'Collect the next item →' : 'Try this task again ↻';
  } else if (engine.phase === 'unlocked') {
    title = 'Open the door'; instruction = 'The yellow latch is clear of the keeper. Click the door itself, or use the button below.'; action = 'Open the locker door →'; command = 'door';
  } else if (engine.phase === 'transfer') {
    title = store ? `Put ${name} inside` : `Take ${name} out`;
    instruction = store ? 'The item is still in your hand. Place it in the open box before you close the door.' : 'Click the highlighted item inside the box, or take it using the button below. Closing is blocked until you do.';
    action = store ? `Put ${name} inside →` : `Take ${name} out →`; command = 'transfer';
  } else if (engine.phase === 'close-door') {
    title = 'Close the door'; instruction = store ? `${name} is safely inside. Close the door; then the latch will rotate into the locked position.` : `${name} is now outside, in your hand. Close the door to finish returning it.`;
    action = 'Close and lock the door →'; command = 'door';
  } else if (engine.phase === 'await-tag') {
    title = 'Scan the found item’s tag'; instruction = 'A visitor card identifies a person. An item tag identifies the object. Choose Wallet or Keys below.';
    const key = engine.items.some(item => item.tag === TAGS.wallet) ? 'keys' : 'wallet'; command = key; action = `Use the ${key === 'wallet' ? 'Wallet' : 'Keys'} item tag →`;
  } else if (engine.phase === 'await-description') {
    title = 'Give the item a name'; instruction = 'Edit the description below, then save it. Staff type this into the Arduino Serial Monitor on the real prototype.';
    action = 'Save description →'; command = 'description';
  } else {
    title = store ? 'Scan the staff card' : 'Scan your personal card';
    instruction = store ? 'You are festival staff with a found item. The staff card starts registration; it is not a visitor’s claim card.' : 'The sample wallet and keys belong to visitor A. Their personal card proves the ownership match.';
    command = store ? 'staff' : 'owner'; action = store ? 'Scan the staff card →' : 'Scan my personal card →';
    if (engine.duration) {
      const skippable = isFeedbackWait(engine);
      title = 'This card cannot collect an item'; instruction = engine.message;
      action = skippable ? 'Skip the wait →' : 'Waiting for card feedback…'; command = skippable ? 'skip' : 'wait';
    }
  }
  return {steps,index,title,instruction,action,command};
}
function renderGuide() {
  const guide = guideInfo(); const finished = engine.phase === 'complete';
  $('guide-position').textContent = finished ? 'TASK COMPLETE' : `STEP ${guide.index + 1} OF ${guide.steps.length}`;
  $('guide-title').textContent = guide.title; $('guide-instruction').textContent = guide.instruction;
  $('next-action').textContent = guide.action; $('next-action').dataset.command = guide.command; $('next-action').disabled = guide.command === 'wait';
  const clip = embedded ? realFootageFor(engine) : null, watch = $('watch-real');
  if (watch) {
    watch.hidden = !clip;
    if (clip && watch.dataset.watch !== clip) { watch.dataset.watch = clip; watch.textContent = `▶ ${footage[clip]} ↗`; }
  }
  const signature = `${engine.scenario}|${guide.index}`;
  if ($('guide-steps').dataset.value !== signature) {
    $('guide-steps').dataset.value = signature;
    $('guide-steps').replaceChildren(...guide.steps.map((label, index) => {
      const step = root.createElement('li'); step.textContent = `${index < guide.index ? '✓' : index + 1} ${label}`;
      if (index < guide.index) step.className = 'done';
      if (index === guide.index) { step.className = 'current'; step.setAttribute('aria-current', 'step'); }
      return step;
    }));
  }
  // The task switch is never locked: switching simply starts that task fresh.
  root.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === engine.scenario)));
}
function render() {
  // Idle ticks should not replace text nodes or repeatedly announce unchanged UI.
  const state = JSON.stringify([reading,engine.scenario,engine.phase,engine.servo,engine.doorOpen,engine.action,engine.transferred,engine.pendingItem,engine.duration,engine.duration ? Math.floor(engine.elapsed * 10) : null,engine.red,engine.green,engine.beep,engine.lcd,engine.items,engine.physicalItems,engine.heldItems,engine.events,engine.message]);
  if (state === renderedState) return;
  renderedState = state;
  const first = reading ? 'Reading card...' : engine.lcd[0];
  // The sketch prints 17-character Item ID text into a 16-column display.
  // Preserve the full UID legibly on row 2 rather than emulating its spill.
  $('lcd-line1').textContent = first.slice(0, 16) || '\u00a0';
  $('lcd-line2').textContent = (engine.lcd[1] || (first.length > 16 ? first.slice(16, 32) : '')) || '\u00a0';
  $('led-red').classList.toggle('on', engine.red); $('led-green').classList.toggle('on', engine.green);
  $('feedback-text').textContent = engine.green ? 'MATCH / 1000 Hz' : engine.red ? 'DENIED / 500 Hz' : 'STANDBY';
  $('servo-arm').style.setProperty('--servo-angle', `${engine.servo === 0 ? 270 : 180}deg`);
  $('model-latch-label').textContent = engine.servo === 0 ? 'CLEAR' : 'LOCKED';
  $('door').classList.toggle('open', engine.doorOpen); $('door').setAttribute('aria-expanded', String(engine.doorOpen));
  $('door').setAttribute('aria-label', engine.doorOpen ? 'Close locker door' : 'Open locker door');
  const canDoor = engine.doorOpen ? engine.canCloseDoor : engine.canOpenDoor;
  $('door').disabled = !canDoor;
  if ($('status').textContent !== engine.message) $('status').textContent = engine.message;
  const waiting = !!engine.duration;
  // Show real seconds: in quick mode the engine clock runs faster than the wall clock.
  const speed = feedbackSpeed(engine, quickFeedback());
  $('timer').textContent = waiting ? `${Math.max(0, (engine.duration - engine.elapsed) / speed).toFixed(1)}s remaining` : '';
  $('wait').hidden = !waiting;
  $('timer-fill').style.width = waiting ? `${100 * (1 - engine.elapsed / engine.duration)}%` : '0%';
  $('item-tags').hidden = engine.phase !== 'await-tag'; $('registration').hidden = engine.phase !== 'await-description';
  root.querySelectorAll('[data-tag]').forEach(button => {
    const key = button.dataset.tag;
    button.disabled = reading || !engine.canScan || (engine.phase === 'await-tag' ? !['wallet','keys'].includes(key) || engine.items.some(item => item.tag === TAGS[key]) : ['wallet','keys'].includes(key) || key === 'staff' && engine.scenario !== 'store');
  });
  $('count').textContent = String(engine.physicalItems.length).padStart(2, '0');
  $('memory-count').textContent = `Arduino records: ${engine.items.length}. Physical placement is tracked separately in this guided demo.`;
  const inventoryText = engine.physicalItems.map(item => `${item.description || '(blank)'} · A`).join('|');
  if ($('inventory-list').dataset.value !== inventoryText) {
    $('inventory-list').dataset.value = inventoryText;
    $('inventory-list').replaceChildren(...(engine.physicalItems.length ? engine.physicalItems.map(item => { const chip = root.createElement('span'); chip.textContent = item.description; return chip; }) : [Object.assign(root.createElement('span'), { textContent: 'The box is empty' })]));
  }
  const physicalSignature = engine.physicalItems.map(item => `${item.id}:${item.description}`).join('|') + `:${engine.pendingItem?.id}:${engine.canTransfer}:${engine.action}:${engine.phase}`;
  if ($('physical-items').dataset.value !== physicalSignature) {
    $('physical-items').dataset.value = physicalSignature;
    $('physical-items').replaceChildren(...engine.physicalItems.map(item => {
      const button = root.createElement('button'); button.className = 'physical-item'; button.innerHTML = iconFor(item); button.dataset.itemId = String(item.id);
      button.classList.toggle('is-moving', engine.phase === 'moving-item' && engine.action === 'claim' && item.id === engine.pendingItem.id);
      const label = root.createElement('span'); label.textContent = item.description; button.append(label);
      const selected = engine.canTransfer && engine.action === 'claim' && item.id === engine.pendingItem.id;
      button.disabled = !selected; button.classList.toggle('takeable', selected); button.setAttribute('aria-label', selected ? `Take ${item.description} out of the locker` : `${item.description} inside the locker`);
      button.addEventListener('click', moveItem); return button;
    }));
  }
  root.querySelector('.hand-item')?.classList.toggle('is-moving', engine.phase === 'moving-item' && engine.action === 'register');
  const handSignature = engine.heldItems.map(item => `${item.id}:${item.description}`).join('|');
  if ($('hand-items').dataset.value !== handSignature) {
    $('hand-items').dataset.value = handSignature;
    $('hand-items').replaceChildren(...(engine.heldItems.length ? engine.heldItems.map(item => { const chip = root.createElement('span'); chip.className = 'hand-item'; chip.innerHTML = iconFor(item); const text = root.createElement('span'); text.textContent = item.description; chip.append(text); return chip; }) : [root.createTextNode('Your hands are empty.')]));
  }
  // The tray only shows while it matters: as the landing spot for a taken item, and while something is in hand.
  $('hand-tray').hidden = !(engine.heldItems.length || engine.canTransfer);
  renderGuide();
  if ($('events').dataset.value !== engine.events.join('|')) {
    $('events').dataset.value = engine.events.join('|');
    $('events').replaceChildren(...engine.events.map(event => Object.assign(root.createElement('li'), { textContent: event })));
  }
  root.querySelectorAll('.signal-path li').forEach((item, index) => item.classList.toggle('active', engine.code === 'servo-and-feedback' ? index >= 2 : engine.code === 'owner-match' ? index === 1 : index === 0));
  if (engine.beep) { buzzer(engine.beep); engine.beep = null; }
}
function scan(key) {
  if (reading || !engine.canScan) return;
  const previous = engine.phase;
  reading = true; inspect('rfid');
  $('reader').classList.remove('scan-pulse'); requestAnimationFrame(() => $('reader').classList.add('scan-pulse'));
  const source = root.activeElement?.getBoundingClientRect(), target = $('reader').getBoundingClientRect();
  if (target.top >= 0 && target.bottom <= innerHeight) flyGraphic('<span class="scan-card-chip">▦</span><span>RFID TAG</span>', source, target, 350, 'scan-flight');
  render();
  scanDelay = setTimeout(() => {
    reading = false; scanDelay = null; engine.scan(TAGS[key]); followSignal(); render();
    if (previous === 'await-tag' && engine.phase === 'await-description') { $('description').value = key === 'keys' ? 'Keys' : 'Wallet'; $('description').focus(); }
  }, reducedMotion ? 0 : 350);
}
root.querySelectorAll('[data-tag]').forEach(button => {
  // Pointer dragging also works in browsers that suppress native button drags.
  button.draggable = false;
  let start = null, ghost = null, suppressClick = false;
  function overReader(event) {
    const bounds = $('reader').getBoundingClientRect();
    return event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
  }
  function cleanup() { ghost?.remove(); ghost = null; start = null; $('reader').classList.remove('drag-over'); }
  button.addEventListener('click', () => { if (suppressClick) { suppressClick = false; return; } scan(button.dataset.tag); });
  button.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !engine.canScan) return;
    suppressClick = false; start = { x: event.clientX, y: event.clientY }; button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', event => {
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8 && !ghost) return;
    if (!ghost) { ghost = root.createElement('div'); ghost.className = 'card-ghost'; ghost.textContent = `${button.querySelector('strong')?.textContent || 'Item tag'} / RFID`; ($('scene').closest('.locker-lab') || root.body).append(ghost); }
    ghost.style.left = `${event.clientX}px`; ghost.style.top = `${event.clientY}px`;
    $('reader').classList.toggle('drag-over', overReader(event));
  });
  button.addEventListener('pointerup', event => {
    if (!start) return;
    if (ghost) { suppressClick = true; if (overReader(event)) scan(button.dataset.tag); }
    cleanup();
  });
  button.addEventListener('pointercancel', cleanup);
});
$('reader').addEventListener('dragover', event => { if (engine.canScan) { event.preventDefault(); $('reader').classList.add('drag-over'); } });
$('reader').addEventListener('dragleave', () => $('reader').classList.remove('drag-over'));
$('reader').addEventListener('drop', event => { event.preventDefault(); $('reader').classList.remove('drag-over'); const key = event.dataTransfer.getData('text/plain'); if (Object.hasOwn(TAGS, key)) scan(key); });
// Hardware and code sit in a collapsed panel; a click on a part of the machine opens it, so the click has a visible result.
function revealHood() {
  const hood = root.querySelector('.under-the-hood'); if (!hood) return;
  hood.open = true;
  if (window.lenis) window.lenis.scrollTo(hood, { offset: -140 });
  else hood.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
}
root.querySelectorAll('[data-part]').forEach(button => button.addEventListener('click', () => { inspect(button.dataset.part); if (!button.closest('.under-the-hood')) revealHood(); }));
// Drag the scene sideways to turn the box. The Rotate slider under "Other cards & options" does the same without a pointer.
{
  const scene = $('scene'); let drag = null;
  scene.style.touchAction = 'pan-y';
  scene.addEventListener('pointerdown', event => {
    if (event.target.closest('button, a') || (event.pointerType === 'mouse' && event.button !== 0)) return;
    drag = { x: event.clientX, from: Number($('rotation').value) }; scene.setPointerCapture(event.pointerId);
  });
  scene.addEventListener('pointermove', event => {
    if (!drag) return;
    const value = Math.max(-28, Math.min(28, Math.round(drag.from + (event.clientX - drag.x) * .18)));
    $('rotation').value = String(value); $('machine').style.setProperty('--rotation', `${value}deg`);
  });
  for (const type of ['pointerup', 'pointercancel']) scene.addEventListener(type, () => { drag = null; });
}
$('registration').addEventListener('submit', event => { event.preventDefault(); if (engine.register($('description').value)) { followSignal(); render(); $('next-action').focus(); } else render(); });
function toggleDoor() { engine.toggleDoor(); render(); }
$('door').addEventListener('click', toggleDoor);
$('next-action').addEventListener('click', () => {
  const command = $('next-action').dataset.command;
  if (command === 'door') toggleDoor();
  else if (command === 'transfer') moveItem();
  else if (command === 'description') $('registration').requestSubmit();
  else if (command === 'continue') { engine.continueCollection(); followSignal(); render(); }
  else if (command === 'restart') restart(engine.scenario);
  else if (command === 'skip') skipWait();
  else if (Object.hasOwn(TAGS, command)) scan(command);
});
$('rotation').addEventListener('input', event => $('machine').style.setProperty('--rotation', `${event.target.value}deg`));
// Feedback waits only (see locker-engine.js): the door, item and latch steps are physical and never skipped.
function skipWait() { if (skipFeedback(engine)) { followSignal(); render(); } }
function restart(scenario) { clearTimeout(scanDelay); reading = false; scanDelay = null; engine.reset(scenario); $('registration').reset(); $('rotation').value = '-15'; $('machine').style.setProperty('--rotation', '-15deg'); inspect('rfid'); render(); }
$('reset').addEventListener('click', () => restart(engine.scenario));
root.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => restart(button.dataset.scenario)));
$('sound').addEventListener('change', async () => { if ($('sound').checked) { audio ||= new (window.AudioContext || window.webkitAudioContext)(); await audio.resume(); buzzer(1000); } });
$('electronics-toggle').addEventListener('click', () => {
  const show = $('electronics-toggle').getAttribute('aria-pressed') !== 'true';
  $('electronics-toggle').setAttribute('aria-pressed', String(show)); $('electronics-toggle').textContent = show ? 'Close electronics view ↙' : 'Show electronics ↗';
  $('scene').classList.toggle('is-exploded', show); $('machine').classList.toggle('is-exploded', show);
  if (show) inspect('arduino');
});
setInterval(() => {
  const now = performance.now(), oldPhase = engine.phase; engine.tick((now - lastTime) / 1000 * feedbackSpeed(engine, quickFeedback())); lastTime = now;
  if (oldPhase !== engine.phase) followSignal(); render();
}, 100);
fetch(new URL('../assets/media/lost-and-found/code-excerpts.json', import.meta.url)).then(response => { if (!response.ok) throw new Error('Source unavailable'); return response.json(); }).then(data => { excerpts = data; inspect(inspectedPart); }).catch(() => { $('code').textContent = 'The excerpt could not load. Download the original sketch above to inspect it.'; });
render();
