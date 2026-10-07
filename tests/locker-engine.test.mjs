import test from 'node:test';
import assert from 'node:assert/strict';
import { LockerEngine as Engine, TAGS } from '../site/js/locker-engine.js';
// Keep testing the original firmware interpretation independently of the guided UX.
class LockerEngine extends Engine { constructor() { super({ guided: false }); } }

test('sample data mirrors seeded tags and owners, with labelled illustrative descriptions', () => {
  const locker = new LockerEngine(); assert.equal(locker.items.length, 2);
  assert.deepEqual(locker.items.map(item => item.tag), [TAGS.wallet, TAGS.keys]);
  assert.ok(locker.items.every(item => item.owner === TAGS.owner));
});
test('a locked door cannot be opened; matching card releases latch but not door', () => {
  const locker = new LockerEngine(); assert.equal(locker.toggleDoor(), false);
  locker.scan(TAGS.owner); assert.equal(locker.servo, 0); assert.equal(locker.green, true);
  assert.equal(locker.doorOpen, false); assert.equal(locker.duration, 8); assert.equal(locker.beep, 1000);
  assert.equal(locker.toggleDoor(), true); assert.equal(locker.doorOpen, true);
});
test('claim deletes only the first matching record after eight seconds', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.owner); locker.tick(7.999);
  assert.equal(locker.items.length, 2); assert.equal(locker.servo, 0);
  locker.tick(.001); assert.equal(locker.items.length, 1); assert.equal(locker.items[0].tag, TAGS.keys);
  assert.equal(locker.servo, 90); assert.equal(locker.green, false); assert.equal(locker.phase, 'listing');
});
test('timer does not pretend a physical door or collection sensor exists', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.owner); locker.toggleDoor(); locker.tick(8);
  assert.equal(locker.doorOpen, true); assert.match(locker.message, /no door sensor/);
  assert.equal(locker.toggleDoor(), true); assert.equal(locker.doorOpen, false);
});
test('recognised personal B has no matching item, no red flashes, no unlock', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.other);
  assert.equal(locker.lcd[0], 'No Items Found'); assert.equal(locker.red, false); assert.equal(locker.servo, 90);
  assert.equal(locker.beep, 500); locker.tick(3); assert.equal(locker.items.length, 2); assert.equal(locker.phase, 'listing');
});
test('unknown card flashes red three times, then waits three seconds', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.unknown);
  assert.equal(locker.lcd[0], 'Access Denied'); assert.equal(locker.beep, 500);
  for (let i = 0; i < 6; i++) { assert.equal(locker.red, i % 2 === 0); locker.tick(.5); }
  assert.equal(locker.red, false); assert.equal(locker.phase, 'denied'); locker.tick(3);
  assert.equal(locker.phase, 'ready'); assert.equal(locker.items.length, 2); assert.equal(locker.servo, 90);
});
test('blocking delays ignore further scans', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.owner);
  assert.equal(locker.scan(TAGS.staff), false); assert.equal(locker.phase, 'unlocked');
});
test('staff registration waits for a tag and a serial description', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.staff); assert.equal(locker.lcd[0], 'Master Mode On');
  locker.tick(2); assert.equal(locker.phase, 'await-tag'); assert.deepEqual(locker.lcd, ['', '']);
  locker.scan(TAGS.wallet); assert.equal(locker.phase, 'await-description'); assert.equal(locker.items.length, 2);
  locker.register('  Sunglasses  '); assert.equal(locker.items.length, 3);
  assert.equal(locker.items[2].description, 'Sunglasses'); assert.equal(locker.items[2].owner, TAGS.owner);
  assert.equal(locker.servo, 0); assert.equal(locker.phase, 'unlocked');
  locker.tick(8); assert.equal(locker.servo, 90); assert.equal(locker.lcd[1], 'Sunglasses');
  locker.tick(3); assert.equal(locker.lcd[0], 'Master Mode Off');
  locker.tick(2); assert.equal(locker.phase, 'listing'); assert.equal(locker.items.length, 3);
});
test('registration accepts any next tag, including a duplicate, like the sketch', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.staff); locker.skipDelay(); locker.scan(TAGS.other);
  locker.register(''); assert.equal(locker.items[2].tag, TAGS.other); assert.equal(locker.items[2].owner, TAGS.owner);
  assert.equal(locker.items[2].description, '');
});
test('description list rotates every three seconds', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.other); locker.tick(3);
  assert.equal(locker.lcd[0], 'Wallet'); locker.tick(3); assert.equal(locker.lcd[0], 'Keys');
  locker.tick(3); assert.equal(locker.lcd[0], 'Wallet');
});
test('two claims reach an empty list and recognised cards get No Items', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.owner); locker.tick(8); locker.scan(TAGS.owner); locker.tick(8);
  assert.equal(locker.items.length, 0); assert.equal(locker.phase, 'ready'); locker.scan(TAGS.owner);
  assert.equal(locker.lcd[0], 'No Items'); assert.equal(locker.servo, 90); locker.tick(3);
  assert.equal(locker.beep, 500); assert.equal(locker.lcd[0], 'Locker Ready'); locker.tick(2); assert.equal(locker.phase, 'ready');
});
test('skip advances one waiting phase; oversized elapsed time safely crosses phases', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.owner); locker.skipDelay(); assert.equal(locker.items.length, 1);
  locker.scan(TAGS.staff); locker.skipDelay(); locker.scan(TAGS.keys); locker.register('Keys'); locker.tick(20);
  assert.equal(locker.phase, 'listing'); assert.equal(locker.servo, 90); assert.equal(locker.items.length, 2);
});
test('preview capacity protection is explicit rather than attributed to original sketch', () => {
  const locker = new LockerEngine(); while (locker.items.length < 10) locker.items.push({...locker.items[0]});
  locker.scan(TAGS.staff); locker.tick(2); locker.scan(TAGS.wallet);
  assert.equal(locker.register('Overflow'), false); assert.equal(locker.items.length, 10);
  assert.match(locker.message, /original sketch has no array-capacity guard/);
});
test('reset restores all state including an open door and registration', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.owner); locker.toggleDoor(); locker.tick(8); locker.reset();
  assert.equal(locker.items.length, 2); assert.equal(locker.doorOpen, false); assert.equal(locker.servo, 90);
  assert.equal(locker.phase, 'ready'); assert.equal(locker.green, false); assert.equal(locker.red, false);
});
