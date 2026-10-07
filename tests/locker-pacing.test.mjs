import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LockerEngine, TAGS } from '../site/js/locker-engine.js';
import { FEEDBACK_PHASES, QUICK_FEEDBACK, isFeedbackWait, feedbackSpeed, skipFeedback, realFootageFor } from '../site/js/locker-pacing.js';
const manifest = JSON.parse(readFileSync(new URL('../site/assets/media/lost-and-found/manifest.json', import.meta.url), 'utf8'));

const openAndFinish = locker => { // open → move the item → close → complete, in real engine time
  assert.ok(locker.toggleDoor()); locker.tick(1);
  assert.ok(locker.transferItem()); locker.tick(.7);
  assert.ok(locker.toggleDoor()); locker.tick(1);
};

test('an unknown card starts a skippable feedback wait that one skip ends', () => {
  const locker = new LockerEngine();
  assert.equal(isFeedbackWait(locker), false);
  locker.scan(TAGS.unknown);
  assert.equal(locker.phase, 'denied'); assert.equal(isFeedbackWait(locker), true);
  assert.equal(skipFeedback(locker), true);
  assert.equal(locker.phase, 'ready'); assert.equal(locker.canScan, true); assert.equal(locker.red, false); assert.equal(locker.servo, 90);
});

test('a recognised card with no item skips its single wait; nothing is released', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.other);
  assert.equal(locker.phase, 'no-match'); assert.equal(skipFeedback(locker), true);
  assert.equal(locker.canScan, true); assert.equal(locker.servo, 90); assert.equal(locker.items.length, 2);
});

test('the empty-box wait has two stages and one call skips both', () => {
  const locker = new LockerEngine(); locker.reset('store'); locker.scan(TAGS.owner);
  assert.equal(locker.phase, 'empty');
  assert.equal(skipFeedback(locker), true);
  assert.equal(locker.phase, 'ready'); assert.equal(locker.canScan, true);
});

test('physical steps are never skipped or sped up', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.owner); locker.toggleDoor();
  assert.equal(locker.phase, 'opening');
  assert.equal(isFeedbackWait(locker), false); assert.equal(feedbackSpeed(locker, true), 1);
  assert.equal(skipFeedback(locker), false); assert.equal(locker.phase, 'opening'); assert.equal(locker.elapsed, 0);
  locker.tick(1); locker.transferItem();
  assert.equal(locker.phase, 'moving-item'); assert.equal(feedbackSpeed(locker, true), 1); assert.equal(skipFeedback(locker), false);
  locker.tick(.7); locker.toggleDoor();
  assert.equal(locker.phase, 'closing'); assert.equal(feedbackSpeed(locker, true), 1); assert.equal(skipFeedback(locker), false);
});

test('nothing to skip while idle, listing or waiting for the staff steps', () => {
  const locker = new LockerEngine(); assert.equal(skipFeedback(locker), false);
  locker.reset('store'); locker.scan(TAGS.staff);
  assert.equal(locker.phase, 'await-tag'); assert.equal(skipFeedback(locker), false); assert.equal(feedbackSpeed(locker, true), 1);
});

test('quick feedback speeds up only the feedback phases, and only when switched on', () => {
  assert.deepEqual([...FEEDBACK_PHASES], ['denied', 'no-match', 'empty', 'empty-ready']);
  const locker = new LockerEngine(); locker.scan(TAGS.unknown);
  assert.equal(feedbackSpeed(locker, true), QUICK_FEEDBACK); assert.equal(feedbackSpeed(locker, false), 1);
});

test('at the sped-up clock the 100 ms UI ticker still shows three distinct red flashes', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.unknown);
  let flashes = locker.red ? 1 : 0, previous = locker.red, lights = [];
  while (locker.phase === 'denied') {
    locker.tick(.1 * feedbackSpeed(locker, true));
    if (locker.red && !previous) flashes++;
    previous = locker.red; lights.push(locker.red);
  }
  assert.equal(flashes, 3);
  assert.ok(lights.filter(Boolean).length >= 6, 'each flash is on for at least two ticks, long enough to see');
  assert.equal(locker.red, false);
});

test('the quick wait is about 2.5 s instead of 6 s', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.unknown);
  let seconds = 0;
  while (locker.phase === 'denied') { locker.tick(.1 * feedbackSpeed(locker, true)); seconds += .1; }
  assert.ok(seconds > 2.3 && seconds < 2.8, `took ${seconds.toFixed(1)} s`);
});

test('each finished task and the rejected card point at a real chapter of the prototype video', () => {
  const chapters = new Set(manifest.walkthrough.shots.map(shot => shot.id));
  const seen = [];

  const locker = new LockerEngine();
  assert.equal(realFootageFor(locker), null);
  locker.scan(TAGS.unknown); seen.push(realFootageFor(locker)); assert.equal(seen[0], 'denied');
  locker.tick(7); assert.equal(locker.phase, 'ready'); assert.equal(realFootageFor(locker), 'denied', 'stays after the wait');
  locker.scan(TAGS.owner); assert.equal(realFootageFor(locker), null, 'the next card clears it');
  openAndFinish(locker); assert.equal(locker.phase, 'complete');
  seen.push(realFootageFor(locker)); assert.equal(seen[1], 'claim');
  locker.reset(); assert.equal(realFootageFor(locker), null, 'restart clears it');

  locker.reset('store'); locker.scan(TAGS.staff); locker.scan(TAGS.wallet); assert.ok(locker.register('Wallet'));
  assert.equal(realFootageFor(locker), null, 'not before the task is finished');
  openAndFinish(locker); assert.equal(locker.phase, 'complete');
  seen.push(realFootageFor(locker)); assert.equal(seen[2], 'master');

  for (const id of seen) assert.ok(chapters.has(id), `manifest has a "${id}" chapter`);
});
