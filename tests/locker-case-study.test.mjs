import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const site = new URL('../site/', import.meta.url);
const read = path => readFileSync(new URL(path, site), 'utf8');
const manifest = JSON.parse(read('assets/media/lost-and-found/manifest.json'));

test('main case study exposes every planned section and the reusable locker island', () => {
  const page = read('lost-and-found.html');
  for (const id of ['try','build','inside','watch','reflection','locker-lab','lf-lightbox']) assert.match(page,new RegExp(`id="${id}"`));
  assert.doesNotMatch(page,/class="stub"/);
  assert.match(read('js/locker-story.js'),/import\('\.\/locker-demo\.js'(?: \+ version)?\)/);
  assert.match(read('js/locker-demo.js'),/new URL\('\.\.\/assets\/media\/lost-and-found\/code-excerpts\.json', import\.meta\.url\)/);
});
test('all local case-study HTML assets resolve', () => {
  for (const match of read('lost-and-found.html').matchAll(/(?:src|href|poster)="([^"#]+)"/g)) {
    const path = match[1].split('?')[0].split('#')[0];
    if (/^(https?:|data:)/.test(path)) continue;
    // Existing CV/footer is out of this case-study's asset scope.
    if (path === 'assets/Jakub-Michalec-CV.pdf') continue;
    assert.ok(existsSync(new URL(path,site)), `Missing asset: ${path}`);
  }
});
test('video chapters cover the clean edit contiguously without duplicate IDs', () => {
  const shots=manifest.walkthrough.shots;
  assert.equal(shots.length,9); assert.equal(new Set(shots.map(shot=>shot.id)).size,shots.length);
  let end=0;
  for (const shot of shots) { assert.equal(shot.timelineIn,end); assert.ok(shot.timelineOut>shot.timelineIn); assert.ok(shot.lines.length); end=shot.timelineOut; }
  assert.equal(end,manifest.walkthrough.duration);
  const closure=shots.find(shot=>shot.id==='closure');
  assert.equal(closure.in,61); assert.match(closure.lines.join(' '),/keys take/i);
});
test('the Arduino archive is unchanged and every displayed excerpt is authentic', () => {
  const sketch=read('assets/code/lost-and-found.ino');
  assert.equal(createHash('sha256').update(readFileSync(new URL('assets/code/lost-and-found.ino',site))).digest('hex'),manifest.code.sha256);
  const lines=sketch.split(/\r?\n/);
  for (const excerpt of JSON.parse(read('assets/media/lost-and-found/code-excerpts.json'))) assert.equal(excerpt.code.trim(),lines.slice(excerpt.startLine-1,excerpt.endLine).join('\n').trim());
});
test('shared demo CSS is scoped rather than changing the main page navigation and typography', () => {
  const scoped=read('css/locker-lab.css');
  assert.match(scoped,/:where\(\.locker-lab\) \.door/);
  assert.doesNotMatch(scoped,/(?:^|\})\s*(?:body|main|h1|button|footer)\s*\{/);
});
test('Home links to the implemented case study and real finished-prototype media', () => {
  const home=read('index.html');
  assert.match(home,/href="lost-and-found\.html"/);
  assert.match(home,/assets\/media\/lost-and-found\/locker-finished-front\.webp/);
  assert.match(home,/Try the locker <svg/);
});
test('quick feedback is on by default and the demo can link to the real prototype', () => {
  const demo = read('previews/locker-demo.html');
  assert.match(demo, /<input id="quick" type="checkbox" checked>/);
  assert.match(demo, /id="watch-real"[^>]*href="#watch"[^>]*hidden/);
  assert.match(read('js/locker-demo.js'), /command === 'skip'/);
});
test('every real-prototype link in the demo names an existing video chapter', () => {
  const chapters = new Set(manifest.walkthrough.shots.map(shot => shot.id));
  const block = read('js/locker-demo.js').match(/const footage = \{([^}]*)\}/)[1];
  const used = [...block.matchAll(/(\w+):\s*'/g)].map(match => match[1]);
  assert.deepEqual(used.sort(), ['claim', 'denied', 'master']);
  for (const id of used) assert.ok(chapters.has(id), `chapter ${id}`);
});
test('the locker story versions the markup and modules it loads from its own script URL, so one cache bump covers them', () => {
  const story = read('js/locker-story.js');
  assert.match(story, /const version = new URL\(import\.meta\.url\)\.search/);
  assert.match(story, /fetch\('previews\/locker-demo\.html' \+ version\)/);
  assert.match(story, /import\('\.\/locker-demo\.js' \+ version\)/);
  assert.match(read('lost-and-found.html'), /<script type="module" src="js\/locker-story\.js\?v=\d+">/);
});
test('the section nav has a short label for every section so it fits a phone without hidden scrolling', () => {
  const page = read('lost-and-found.html');
  const links = [...page.match(/<nav class="lf-section-nav"[\s\S]*?<\/nav>/)[0].matchAll(/<a href="#(\w+)">([\s\S]*?)<\/a>/g)];
  assert.equal(links.length, 5);
  for (const [, id, inner] of links) {
    assert.match(inner, /lf-n-long/); assert.match(inner, /lf-n-short/);
    assert.ok(page.includes(`id="${id}"`), `section ${id} exists`);
  }
});
test('every element id the demo script uses exists exactly once in the demo markup', () => {
  const html = read('previews/locker-demo.html'), script = read('js/locker-demo.js');
  const ids = [...html.matchAll(/\sid="([\w-]+)"/g)].map(match => match[1]);
  const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(duplicated, [], 'duplicate ids');
  const used = new Set([...script.matchAll(/\$\('([\w-]+)'\)/g)].map(match => match[1]));
  assert.deepEqual([...used].filter(id => !ids.includes(id)), [], 'ids used by locker-demo.js but missing from the markup');
});
test('the demo shows one task switch, one guide and one main button; everything else sits in disclosures', () => {
  const html = read('previews/locker-demo.html');
  assert.equal((html.match(/class="next-action"/g) || []).length, 1, 'exactly one main button');
  assert.equal((html.match(/data-scenario="/g) || []).length, 2, 'two tasks');
  for (const name of ['card-drawer', 'under-the-hood', 'honesty-note']) assert.match(html, new RegExp(`<details class="${name}"`), `${name} is collapsed by default`);
  assert.doesNotMatch(html, /<details[^>]* open/, 'no disclosure starts open');
  for (const removed of ['model-next-action', 'model-guide', 'latch-closeup', 'view-controls', 'detail-controls', 'skip-delay', 'transfer-item', 'door-toggle', 'lock-badge', 'phase-label']) assert.doesNotMatch(html, new RegExp(removed), `${removed} was folded into the guide or the machine`);
  assert.match(html, /<p id="status" class="sr-only" role="status" aria-live="polite">/, 'status messages stay available to screen readers');
});
test('the simulation caveat stays on the page and mentions the shortened waits', () => {
  const note = read('previews/locker-demo.html').match(/<details class="honesty-note">[\s\S]*?<\/details>/)[0];
  assert.match(note, /not a secure production system/i);
  assert.match(note, /Quick feedback/);
  assert.match(note, /no door or item sensor/i);
});
