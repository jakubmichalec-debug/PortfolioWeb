import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Dispenser, PRICE, TAGS, START_BALANCE, duration, pumpTime } from '../site/js/shot-engine.js';

const site = new URL('../site/', import.meta.url);
const read = path => readFileSync(new URL(path, site), 'utf8');
const sketch = read('assets/code/shot-dispenser.ino');
const lcdTexts = steps => [...new Set(steps.map(step => step.lcd.join(' | ')))];

test('the engine uses the price, tags and balances written in the sketch', () => {
  assert.match(sketch, new RegExp(`\\*balance >= ${PRICE}\\b`)); assert.match(sketch, new RegExp(`\\*balance -= ${PRICE};`));
  assert.match(sketch, new RegExp(`uid\\.equals\\("${TAGS.a.uid}"\\)`)); assert.match(sketch, new RegExp(`uid\\.equals\\("${TAGS.b.uid}"\\)`));
  assert.match(sketch, new RegExp(`int balance1 = ${START_BALANCE.a};`)); assert.match(sketch, new RegExp(`int balance2 = ${START_BALANCE.b};`));
  assert.doesNotMatch(sketch, new RegExp(TAGS.unknown.uid));
});

test('every message the engine shows is a message the sketch can print, and fits 16 columns', () => {
  const machine = new Dispenser();
  const all = [machine.idle(), ...machine.scan('a').steps, ...machine.scan('b').steps, ...machine.scan('unknown').steps];
  machine.water = false; all.push(machine.idle(), ...machine.scan('a').steps);
  for (const step of all) for (const line of step.lcd) {
    assert.ok(line.length <= 16, `"${line}" fits the display`);
    const fixed = line.replace(/\d+$/, '');
    if (fixed) assert.ok(sketch.includes(`"${fixed}`), `"${fixed}" comes from the sketch`);
  }
});

test('a paid shot: balance drops by six first, the pump runs five seconds, then Enjoy', () => {
  const machine = new Dispenser(), { outcome, steps } = machine.scan('a');
  assert.equal(outcome, 'poured'); assert.equal(machine.balance.a, 9);
  assert.equal(pumpTime(steps), 5000); assert.equal(duration(steps), 1000 + 5000 + 2000 + 3000);
  assert.deepEqual(lcdTexts(steps), ['Pouring... | New balance: 9', 'Enjoy! | ', 'Welcome! | Scan bracelet']);
  assert.equal(steps[0].pump, false, 'one second passes before the pump starts');
  assert.equal(steps.filter(step => step.pump && step.green).length, 5, 'green blinks five times while pouring');
  assert.ok(steps.every(step => !step.red && !step.tone));
  assert.equal(steps.at(-1).pump, false);
});

test('bracelet A buys two shots, then is declined with three beeps and four red blinks', () => {
  const machine = new Dispenser();
  assert.equal(machine.scan('a').outcome, 'poured'); assert.equal(machine.scan('a').outcome, 'poured'); assert.equal(machine.balance.a, 3);
  const { outcome, steps } = machine.scan('a');
  assert.equal(outcome, 'declined'); assert.equal(machine.balance.a, 3, 'a declined tap costs nothing');
  assert.equal(pumpTime(steps), 0);
  assert.equal(steps.filter(step => step.tone === 1000).length, 3); assert.equal(steps.filter(step => step.red).length, 4);
  assert.equal(steps[0].lcd.join('|'), 'Not enough funds|Balance: 3');
});

test('bracelet B never has enough, and an unknown tag is denied for five seconds', () => {
  const machine = new Dispenser();
  assert.equal(machine.scan('b').outcome, 'declined'); assert.equal(machine.balance.b, 5);
  const { outcome, steps } = machine.scan('unknown');
  assert.equal(outcome, 'unknown'); assert.equal(steps[0].lcd.join('|'), 'Unknown Tag|Access Denied'); assert.equal(steps[0].ms, 5000);
  assert.equal(pumpTime(steps), 0); assert.deepEqual(machine.balance, { a: 15, b: 5 });
});

test('with an empty tank no bracelet is read: red light, three beeps, no pump, no charge', () => {
  const machine = new Dispenser(); machine.water = false;
  assert.deepEqual(machine.idle().lcd, ['Water Low!', 'Refill required']); assert.equal(machine.idle().red, true);
  const { outcome, steps } = machine.scan('a');
  assert.equal(outcome, 'water-low'); assert.equal(machine.balance.a, 15);
  assert.equal(pumpTime(steps), 0); assert.equal(steps.filter(step => step.tone).length, 3); assert.ok(steps.every(step => step.red));
  machine.water = true; assert.equal(machine.scan('a').outcome, 'poured');
});

test('reset restores both balances and the tank', () => {
  const machine = new Dispenser(); machine.scan('a'); machine.water = false; machine.reset();
  assert.deepEqual(machine.balance, { a: 15, b: 5 }); assert.equal(machine.water, true);
});

test('the page ships what it references and every id its script uses', () => {
  const page = read('shot-dispenser.html'), script = read('js/shot.js');
  for (const match of page.matchAll(/(?:src|href|poster)="([^"#]+)"/g)) {
    const path = match[1].split('?')[0];
    if (/^(https?:|data:)/.test(path) || path === 'assets/Jakub-Michalec-CV.pdf') continue;
    assert.ok(existsSync(new URL(path, site)), `Missing asset: ${path}`);
  }
  const ids = [...page.matchAll(/\sid="([\w-]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), [], 'duplicate ids');
  for (const [, id] of script.matchAll(/\$\('([\w-]+)'\)/g)) assert.ok(ids.includes(id), `#${id} exists in the page`);
  for (const [, file] of script.matchAll(/\['([\w-]+)', '[^']+', '[^']+', '/g)) assert.ok(existsSync(new URL(`assets/media/shot-dispenser/${file}.webp`, site)), `build picture ${file}`);
  for (const [, from, to] of script.matchAll(/', (\d+), (\d+), '/g)) assert.ok(Number(from) >= 1 && Number(to) <= sketch.split('\n').length && Number(from) < Number(to));
  assert.match(read('index.html'), /href="shot-dispenser\.html"/);
});
