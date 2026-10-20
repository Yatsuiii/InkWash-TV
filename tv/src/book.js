// A painter's world as a picture book, paged through on the TV: a title page and who and what keeps
// coming back; then a night to a spread, the first first: the painting on the left; on the right,
// its title, the night and the day, and its story as it was last told (without the lines they
// turned down), with what they painted next, how it felt and the things that came in it; and what
// the storyteller remembered for it: the chapters it was given as told, the recaps of older ones
// and why, and what it looked up.
//
// Built from the world kept on the TV (world.js); nothing here leaves it. Pure.
import { journalOf, wordsFor } from './journal.js';

const mean = (xs) => xs.reduce((a, x) => a + x, 0) / xs.length;

// `world`: a dream world (world.js); `young`: a child's, in a child's words. { total: nights there
// have been, things: [{ name, says, nights }] (what keeps coming back, most often first), nights:
// [{ n, at, title, lines: [{ text, next }], things: [names], felt, next, remembered }] (those with a
// story) }
// `felt`: the word they gave how it felt, or, from the marks they made as it came back, how it felt
// in the dial's words (a stroke left even was not marked); null if neither
export function bookOf(world, { young = false } = {}) {
  const S = world.toJSON(), W = wordsFor(young);
  const named = new Map(S.entities.filter((e) => e.status !== 'rejected').map((e) => [e.id, e.name]));
  const nights = S.nights.map((N) => {
    // as it was last told: with what they painted next, if they did
    const E = N.ending && (N.ending.lines || []).length ? N.ending : null;
    const lines = (E ? E.lines : N.lines || []).filter((l) => l.reaction !== 'no' && l.text).map((l) => ({ text: l.text, next: !!l.ending }));
    const things = [...new Set((N.cast || []).map((id) => named.get(id)).filter(Boolean))];
    const marked = (N.line || []).filter(([v, a]) => v || a);
    const marks = marked.length ? W.felt(mean(marked.map(([v]) => v)), mean(marked.map(([, a]) => a || 0))) : null;
    const felt = typeof N.felt === 'string' && N.felt ? N.felt : marks && marks !== 'even' ? marks : null;
    return { n: N.n, at: N.at || null, title: (E && E.title) || N.title || 'Untitled', lines, things, felt, next: !!E, remembered: rememberedSays((E && E.remembered) || N.remembered, { young }) };
  }).filter((x) => x.lines.length);
  const j = journalOf(world, { things: 6, young });
  return { total: j.nights, things: j.things.map((t) => ({ name: t.name, says: t.says, nights: t.dreams.length + t.inEndings.length })), nights };
}

// What the storyteller had of earlier chapters for a chapter, said plainly: the chapters it was
// given as they were told, the recaps of older ones and what each was for, and what it looked up
// and read. Null if it had nothing (a first chapter, or one kept before it was kept).
export function rememberedSays(m, { young = false } = {}) {
  if (!m || typeof m !== 'object') return null;
  const list = (xs) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
  const recent = (m.recent || []).map(String), recaps = m.recaps || [];
  const read = [...new Set([...(m.read || []), ...(m.nights || []).filter((n) => !(m.recent || []).includes(n)).map((n) => `chapter ${n}`)])];
  const parts = [
    ...(recent.length ? [`${recent.length > 1 ? 'chapters' : 'chapter'} ${list(recent)} as ${young ? 'it was' : 'they were'} told`] : []),
    ...recaps.map((r) => `${young ? 'a little about ' : 'a recap of '}${r.chapters}${(r.because || []).length ? `, for ${list(r.because)}` : ''}`),
    ...((m.looked_up || []).length ? [`it looked for ${list(m.looked_up.map((q) => `“${q}”`))}`] : []),
    ...(read.length ? [`it read about ${list(read)}`] : []),
  ];
  return parts.length ? `${young ? 'The storyteller remembered' : 'What the storyteller remembered'}: ${parts.join('; ')}.` : null;
}

// The spreads, in the order they are paged: the title spread, then a night to each
export const spreadsOf = (book) => [{ cover: true }, ...book.nights.map((night) => ({ night }))];
