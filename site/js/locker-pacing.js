// Presentation pacing for the guided walkthrough. This is not sketch behaviour, so it lives apart from the engine.
// Only feedback waits (rejected card, empty box) may be shortened or skipped. Physical steps
// (door opening, item moving, door closing) always run in real time so the machine never jumps ahead.
import { TAGS } from './locker-engine.js';

export const FEEDBACK_PHASES = Object.freeze(['denied', 'no-match', 'empty', 'empty-ready']);
export const QUICK_FEEDBACK = 2.4;
export const isFeedbackWait = engine => engine.duration > 0 && FEEDBACK_PHASES.includes(engine.phase);
// Clock multiplier for the current wait: quick mode plays feedback faster, everything else runs 1x.
export const feedbackSpeed = (engine, quick) => quick && isFeedbackWait(engine) ? QUICK_FEEDBACK : 1;
// "empty" has two stages (3 s + 2 s), so keep skipping until the reader accepts cards again.
export function skipFeedback(engine) {
  let skipped = false;
  for (let stage = 0; stage < FEEDBACK_PHASES.length && isFeedbackWait(engine); stage++) skipped = engine.skipDelay() || skipped;
  return skipped;
}
// Which chapter of the real-prototype video (manifest walkthrough.shots[].id) shows what the visitor just did?
export function realFootageFor(engine) {
  if (engine.lastTag === TAGS.unknown && (engine.phase === 'denied' || engine.phase === 'ready')) return 'denied';
  if (engine.phase === 'complete') return engine.action === 'claim' ? 'claim' : 'master';
  return null;
}
