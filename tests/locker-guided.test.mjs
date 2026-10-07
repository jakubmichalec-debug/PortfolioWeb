import test from 'node:test';
import assert from 'node:assert/strict';
import { LockerEngine, TAGS } from '../site/js/locker-engine.js';

function openClaim() { const locker = new LockerEngine(); locker.scan(TAGS.owner); locker.toggleDoor(); locker.tick(1); return locker; }
function move(locker) { const result = locker.transferItem(); if (result) locker.tick(.7); return result; }
function registered() { const locker = new LockerEngine(); locker.reset('store'); locker.scan(TAGS.staff); locker.scan(TAGS.wallet); locker.register('Wallet'); return locker; }
test('guided mode is the default, starts closed and blocks opening before a match', () => {
  const locker = new LockerEngine(); assert.equal(locker.guided, true); assert.equal(locker.canOpenDoor, false);
  assert.equal(locker.toggleDoor(), false); assert.equal(locker.doorOpen, false);
});
test('a matching card releases the latch without moving the door or item', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.owner);
  assert.equal(locker.servo, 0); assert.equal(locker.canOpenDoor, true); assert.equal(locker.doorOpen, false);
  assert.equal(locker.physicalItems.length, 2); assert.equal(locker.items.length, 2);
});
test('time and skip cannot silently finish a guided collection', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.owner); locker.tick(60);
  assert.equal(locker.skipDelay(), false); assert.equal(locker.phase, 'unlocked'); assert.equal(locker.items.length, 2);
  locker.toggleDoor(); locker.tick(100); assert.equal(locker.phase, 'transfer'); assert.equal(locker.servo, 0);
});
test('cannot take an item before opening the door', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.owner); assert.equal(locker.transferItem(), false);
  assert.equal(locker.physicalItems.length, 2); assert.equal(locker.heldItems.length, 0);
});
test('cannot close a collection door until the matching item is taken out', () => {
  const locker = openClaim(); assert.equal(locker.canCloseDoor, false); assert.equal(locker.toggleDoor(), false);
  assert.equal(locker.doorOpen, true); assert.equal(locker.servo, 0); assert.match(locker.message, /Take Wallet out/);
});
test('taking the item changes physical location, not the memory record yet', () => {
  const locker = openClaim(); assert.equal(move(locker), true);
  assert.equal(locker.physicalItems.length, 1); assert.equal(locker.heldItems[0].description, 'Wallet');
  assert.equal(locker.items.length, 2); assert.equal(locker.canCloseDoor, true); assert.equal(locker.servo, 0);
});
test('a taken item cannot be taken twice', () => {
  const locker = openClaim(); move(locker); assert.equal(locker.transferItem(), false);
  assert.equal(locker.physicalItems.length, 1); assert.equal(locker.heldItems.length, 1);
});
test('closing after collection locks and removes only the matching record', () => {
  const locker = openClaim(); move(locker); assert.equal(locker.toggleDoor(), true);
  assert.equal(locker.phase, 'closing'); assert.equal(locker.servo, 0); locker.tick(1);
  assert.equal(locker.phase, 'complete'); assert.equal(locker.servo, 90); assert.equal(locker.doorOpen, false);
  assert.equal(locker.green, false); assert.equal(locker.items.length, 1); assert.equal(locker.items[0].tag, TAGS.keys);
});
test('cannot reopen a completed door without a new scan', () => {
  const locker = openClaim(); move(locker); locker.toggleDoor(); locker.tick(1); assert.equal(locker.toggleDoor(), false);
  assert.equal(locker.doorOpen, false); assert.equal(locker.servo, 90);
});
test('the next item must complete all four steps independently', () => {
  const locker = openClaim(); move(locker); locker.toggleDoor(); locker.tick(1); assert.equal(locker.continueCollection(), true);
  assert.equal(locker.transferItem(), false); locker.scan(TAGS.owner); locker.toggleDoor(); locker.tick(1); assert.equal(locker.toggleDoor(), false);
  move(locker); locker.toggleDoor(); locker.tick(1); assert.equal(locker.items.length, 0); assert.equal(locker.physicalItems.length, 0);
  assert.equal(locker.continueCollection(), false);
});
test('storage starts with an empty physical box and requires staff registration', () => {
  const locker = new LockerEngine(); locker.reset('store'); assert.equal(locker.items.length, 0);
  assert.equal(locker.physicalItems.length, 0); assert.equal(locker.register('Wallet'), false);
  locker.scan(TAGS.staff); assert.equal(locker.phase, 'await-tag'); assert.equal(locker.servo, 90);
});
test('personal and unknown cards cannot substitute for the item tag in guided registration', () => {
  const locker = new LockerEngine(); locker.reset('store'); locker.scan(TAGS.staff);
  assert.equal(locker.scan(TAGS.owner), false); assert.equal(locker.scan(TAGS.unknown), false);
  assert.equal(locker.phase, 'await-tag'); assert.equal(locker.pendingTag, null);
});
test('a blank description is rejected without creating a record or releasing the latch', () => {
  const locker = new LockerEngine(); locker.reset('store'); locker.scan(TAGS.staff); locker.scan(TAGS.wallet);
  assert.equal(locker.register('  '), false); assert.equal(locker.items.length, 0); assert.equal(locker.servo, 90);
});
test('registration does not pretend the physical item is already inside', () => {
  const locker = registered(); assert.equal(locker.items.length, 1); assert.equal(locker.physicalItems.length, 0);
  assert.equal(locker.heldItems[0].description, 'Wallet'); assert.equal(locker.items[0].owner, TAGS.owner);
  assert.equal(locker.transferItem(), false); assert.equal(locker.doorOpen, false);
});
test('cannot close a storage door before putting the item inside', () => {
  const locker = registered(); locker.toggleDoor(); locker.tick(1); assert.equal(locker.toggleDoor(), false);
  assert.match(locker.message, /Put Wallet inside/); assert.equal(locker.doorOpen, true); assert.equal(locker.canCloseDoor, false);
});
test('deposit is explicit and cannot happen twice', () => {
  const locker = registered(); locker.toggleDoor(); locker.tick(1); assert.equal(move(locker), true);
  assert.equal(locker.transferItem(), false); assert.equal(locker.physicalItems.length, 1); assert.equal(locker.heldItems.length, 0);
  assert.equal(locker.canCloseDoor, true); assert.equal(locker.servo, 0);
});
test('storage finishes only after the item is inside and the door closes', () => {
  const locker = registered(); locker.toggleDoor(); locker.tick(1); move(locker); locker.toggleDoor();
  locker.tick(1);
  assert.equal(locker.phase, 'complete'); assert.equal(locker.doorOpen, false); assert.equal(locker.servo, 90);
  assert.equal(locker.items.length, 1); assert.equal(locker.physicalItems.length, 1);
});
test('other scans are blocked during an unfinished physical transaction', () => {
  const locker = openClaim(); assert.equal(locker.scan(TAGS.staff), false); assert.equal(locker.scan(TAGS.owner), false);
  assert.equal(locker.phase, 'transfer'); assert.equal(locker.physicalItems.length, 2);
});
test('unknown and recognised non-owner cards never release the latch', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.unknown); locker.tick(6);
  assert.equal(locker.servo, 90); assert.equal(locker.items.length, 2); locker.scan(TAGS.other); locker.tick(3);
  assert.equal(locker.servo, 90); assert.equal(locker.physicalItems.length, 2);
});
test('restart discards the sample transaction and restores consistent physical and memory state', () => {
  const locker = openClaim(); locker.transferItem(); locker.reset();
  assert.equal(locker.physicalItems.length, 2); assert.equal(locker.items.length, 2);
  assert.equal(locker.heldItems.length, 0); assert.equal(locker.doorOpen, false); assert.equal(locker.servo, 90);
});
test('the latch cannot lock, scan or skip ahead while the door is closing', () => {
  const locker = openClaim(); move(locker); locker.toggleDoor(); locker.tick(.5);
  assert.equal(locker.servo, 0); assert.equal(locker.scan(TAGS.owner), false); assert.equal(locker.skipDelay(), false);
  assert.equal(locker.items.length, 2); assert.equal(locker.continueCollection(), false);
  locker.tick(.5); assert.equal(locker.servo, 90); assert.equal(locker.phase, 'complete');
});
test('opening and item flight cannot be bypassed by rapid clicks or skip', () => {
  const locker = new LockerEngine(); locker.scan(TAGS.owner); locker.toggleDoor();
  assert.equal(locker.phase, 'opening'); assert.equal(locker.transferItem(), false); assert.equal(locker.skipDelay(), false);
  locker.tick(1); assert.equal(locker.transferItem(), true); assert.equal(locker.phase, 'moving-item');
  assert.equal(locker.canCloseDoor, false); assert.equal(locker.toggleDoor(), false); assert.equal(locker.skipDelay(), false);
  assert.equal(locker.physicalItems.length, 2); locker.tick(.7); assert.equal(locker.physicalItems.length, 1); assert.equal(locker.canCloseDoor, true);
});
