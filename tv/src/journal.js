// A painter's dream journal, for the grown-ups who look after them: who and what keeps coming back
// in their dreams and how it has felt each night, as they marked it with the remote, and what came
// from what they painted next; and their nights, the latest first. A window into the world they are
// building.
//
// Built from the world kept on the TV (world.js); nothing here leaves it. Pure.
import { weightWord, stirWord } from './engine/dreams/emotion.mjs';

const mean = (xs) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null);
const r2 = (x) => Math.round(x * 100) / 100;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// a child's journal speaks the dial's words for a child: brighter and darker, calm and wild
const KID = { 'very light': 'very bright', lighter: 'brighter', even: 'even', heavier: 'darker', 'very heavy': 'very dark', 'very stirred': 'very wild', stirred: 'wild', calm: 'calm', 'very still': 'very calm' };
export const wordsFor = (young) => ({
  // "even" said only alone: "very stirred", not "even and very stirred"
  felt: (v, a = 0) => { const w = weightWord(v), s = stirWord(a); return [s && w === 'even' ? null : w, s].filter(Boolean).map((x) => (young ? KID[x] || x : x)).join(' and '); },
  // "even" alone, in a sentence: "Neither light nor heavy the first night", never "Even the first night"
  neither: young ? 'neither bright nor dark' : 'neither light nor heavy',
  Lighter: young ? 'Brighter' : 'Lighter', Heavier: young ? 'Darker' : 'Heavier',
  // a child's journal is read by the grown-ups who look after them; a grown-up reads their own
  they: young ? 'they' : 'you',
});

// How a thing has gone, in a sentence: how it felt the first night and the last; and, if it was in
// what they painted next after a telling, the night it was
function sayOf(t, W = wordsFor(false)) {
  const [first] = t.dreams;
  const felt = (v, a) => { const f = W.felt(v, a); return f === 'even' ? W.neither : f; };
  // something they first painted in what happened next, and that came back in a dream since (one
  // in a dream and then in what happened next that night was first in the dream)
  if (t.ended != null && t.ended < first.night) {
    const n = t.dreams.length, v = mean(t.dreams.map((d) => d.v)), a = mean(t.dreams.map((d) => d.a));
    return `First drawn in what happened next, in chapter ${t.ended}. Came back ${n === 1 ? 'once' : `${n} times`} since, ${felt(v, a)}.`;
  }
  const once = felt(first.v, first.a);
  const out = [`${cap(once)} the first time.`];
  if (t.dreams.length >= 2) {
    const last = t.dreams[t.dreams.length - 1], before = t.dreams.slice(0, -1);
    const earlier = mean(before.map((d) => d.v));
    // lighter each time: every night lighter than the one before it
    const each = t.dreams.length > 2 && t.dreams.every((d, i) => !i || d.v > t.dreams[i - 1].v);
    const now = felt(last.v, last.a);
    // the same the last time as the first is said once: "Very light the first night and the last"
    if (last.v - earlier >= 0.3) out.push(`${W.Lighter} ${each ? 'each time since' : 'the last time'}.`);
    else if (earlier - last.v >= 0.3) out.push(`${W.Heavier} the last time.`);
    else if (now === once) out[0] = `${cap(once)} the first time and the last.`;
    else out.push(`${cap(now)} the last time.`);
  }
  if (t.ended != null) out.push(`It was in what ${W.they} drew next, in chapter ${t.ended}.`);
  return out.join(' ');
}

// `world`: a dream world (world.js). The things that came in two dreams or more, or that were in
// what they painted next after a telling, most often first; and the last `nights` nights. `young`:
// a child's, told in a child's words.
export function journalOf(world, { nights: few = 6, things: many = 4, young = false } = {}) {
  const W = wordsFor(young);
  const S = world.toJSON();
  const ended = S.nights.filter((n) => n.ending);
  const latest = (t) => Math.max(...t.dreams.map((d) => d.night), ...t.inEndings);
  const things = S.entities.filter((e) => e.status !== 'rejected').map((e) => {
    const dreams = (e.appearances || []).filter((a) => Number.isFinite(a.v)).map((a) => ({ night: a.night, v: r2(a.v), a: r2(a.a ?? 0) })).sort((x, y) => x.night - y.night);
    const inEndings = (e.endings || []).map((x) => x.night);
    return { id: e.id, name: e.name, dreams, ended: inEndings.length ? Math.min(...inEndings) : null, inEndings };
  }).filter((t) => t.dreams.length >= 2 || (t.dreams.length >= 1 && t.ended != null))
    .sort((a, b) => (b.dreams.length + b.inEndings.length) - (a.dreams.length + a.inEndings.length) || latest(b) - latest(a))
    .slice(0, many)
    .map((t) => ({ ...t, says: sayOf(t, W) }));
  const nights = S.nights.slice(-few).reverse().map((n) => ({
    n: n.n, at: n.at || null, title: n.title || 'Untitled', line: n.line || [],
    things: (n.cast || []).map((id) => S.entities.find((e) => e.id === id)).filter((e) => e && e.status !== 'rejected').map((e) => e.name),
    ending: n.ending ? { line: n.ending.line || [], said: n.ending.lines.filter((l) => l.ending && l.reaction !== 'no').map((l) => l.text).slice(-1)[0] || null, felt: n.ending.felt } : null,
    heard: (n.heard || []).length,
  }));
  // every night there has been, not only those the world still holds
  return { nights: world.tonight() - 1, endings: ended.length, things, recent: nights };
}
