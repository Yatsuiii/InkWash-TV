// Angles a telling can take. Each feeling has several, so two people who felt the same thing
// don't get the same story, and each angle leans toward certain marks (a heavy, low, lingering
// painting suits "carrying something heavy, then setting it down" more than "flying").
//
// For one telling the harness picks a few angles that fit, writes a candidate from each, and keeps
// the one that fits this person best (select.mjs). A person's recent angles are left out, so
// their next dream isn't told the same way.
import { FEELINGS } from './feelings.mjs';

export const LENSES = {
  peaceful: [
    { id: 'way-home', text: 'a long way home, nearly over', tags: ['slow', 'low', 'straight'] },
    { id: 'looked-after', text: 'being looked after by someone unseen', tags: ['light', 'pale', 'lingering'] },
    { id: 'after-storm', text: 'the hour after a storm', tags: ['wet', 'sparse', 'slow'] },
    { id: 'ritual', text: 'a small ritual done carefully', tags: ['sure', 'straight', 'lingering'] },
    { id: 'place-waits', text: 'a place that has been waiting for you', tags: ['sparse', 'high', 'pale'] },
  ],
  joyful: [
    { id: 'reunion', text: 'a reunion', tags: ['crowded', 'quick', 'sure'] },
    { id: 'door-better', text: 'a door that opens onto somewhere better', tags: ['straight', 'high', 'light'] },
    { id: 'flight', text: 'flying, or floating free', tags: ['quick', 'high', 'restless'] },
    { id: 'gift', text: 'a gift found where you did not look', tags: ['lingering', 'sparse', 'pale'] },
    { id: 'celebration', text: 'a celebration only you were invited to', tags: ['crowded', 'dark', 'quick'] },
  ],
  strange: [
    { id: 'one-thing-wrong', text: 'a familiar place with one thing wrong', tags: ['straight', 'sure', 'sparse'] },
    { id: 'object-remembers', text: 'an object that remembers', tags: ['lingering', 'heavy', 'low'] },
    { id: 'time-out-of-order', text: 'time running out of order', tags: ['restless', 'quick', 'crowded'] },
    { id: 'stranger-knows', text: 'a stranger who knows your name', tags: ['dark', 'hesitant', 'sparse'] },
    { id: 'map-changes', text: 'a map that changes as you walk it', tags: ['restless', 'wet', 'high'] },
  ],
  longing: [
    { id: 'not-there', text: 'someone who is not there', tags: ['sparse', 'lingering', 'pale'] },
    { id: 'cant-return', text: 'a place you cannot go back to', tags: ['low', 'heavy', 'straight'] },
    { id: 'message', text: 'a message that never arrived', tags: ['hesitant', 'light', 'high'] },
    { id: 'before', text: 'who you were before', tags: ['wet', 'pale', 'slow'] },
    { id: 'far-light', text: 'a light on the far side', tags: ['dark', 'sparse', 'high'] },
  ],
  uneasy: [
    { id: 'follower-kind', text: 'something following you that turns out to be kind', tags: ['quick', 'dark', 'restless'] },
    { id: 'path-folds', text: 'a path that keeps folding back', tags: ['restless', 'crowded', 'hesitant'] },
    { id: 'sound-no-source', text: 'a sound with no source', tags: ['sparse', 'light', 'hesitant'] },
    { id: 'extra-room', text: 'a house with one more room than it should have', tags: ['straight', 'crowded', 'dark'] },
    { id: 'crossing', text: 'a crossing that has to be made', tags: ['low', 'wet', 'sure'] },
  ],
  sad: [
    { id: 'empty-chair', text: 'an empty chair', tags: ['sparse', 'low', 'slow'] },
    { id: 'given-away', text: 'something given away', tags: ['light', 'pale', 'hesitant'] },
    { id: 'last-day', text: 'the last day of a season', tags: ['wet', 'slow', 'high'] },
    { id: 'almost-hear', text: 'a voice you can almost hear', tags: ['lingering', 'sparse', 'light'] },
    { id: 'set-down', text: 'carrying something heavy, then setting it down', tags: ['heavy', 'low', 'dark'] },
  ],
};

// A small seeded generator: the same person and session pick the same way, different people don't.
function seeded(seed) {
  let a = 2166136261 >>> 0;
  for (const ch of String(seed)) a = Math.imul(a ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// The angles for one telling: `k` of them, fitting the feeling and the marks, none the person
// had in their last few dreams. With no feeling, the two feelings nearest the marks' mood.
export function chooseLenses({ feeling = null, marks = null, used = new Set(), k = 3, seed = 'x' } = {}) {
  const r = seeded(seed);
  let pool;
  if (feeling && LENSES[feeling]) pool = LENSES[feeling].map((l) => ({ ...l, feeling }));
  else {
    const at = marks?.affect || { v: 0, a: 0 };
    const near = Object.entries(FEELINGS).sort((x, y) => Math.hypot(x[1].v - at.v, x[1].a - at.a) - Math.hypot(y[1].v - at.v, y[1].a - at.a)).slice(0, 2).map(([f]) => f);
    pool = near.flatMap((f) => LENSES[f].map((l) => ({ ...l, feeling: f })));
  }
  const words = new Set(marks?.words || []);
  const scored = pool.map((l) => ({ l, s: l.tags.filter((t) => words.has(t)).length - (used.has(l.id) ? 3 : 0) + r() * 0.9 }));
  return scored.sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.l);
}
