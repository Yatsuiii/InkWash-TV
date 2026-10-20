// What their reactions teach. While a dream is told, they can say "that's it" (▲) or "not quite"
// (▼) to each line. Across every line they have reacted to, the harness looks at which kinds of
// line they keep and which they turn down, and says so in the next brief when the evidence is
// clear (three reactions at least, and a clear difference from how they react on the whole).
// Readings they turned down are kept apart, so they aren't offered again.

const EXPLAINS = /\b(because|meant|means|realiz|understood|knew that|as if to say|the reason|symbol)/i;

// what can be said of a line, plainly
export function lineTraits(line, night, entitiesSeenBefore) {
  const text = String(line.text || '');
  const own = (night.said || []).concat(night.pinned && night.pinned.said ? [night.pinned.said] : [])
    .some((w) => w && w.length >= 4 && text.toLowerCase().includes(String(w).toLowerCase().replace(/^(the|a|an|my) /, '').split(' ').slice(0, 3).join(' ')));
  return {
    own, // it used their own words
    recurring: (line.entities || []).some((id) => entitiesSeenBefore.has(id)), // it brought back something from an earlier night
    explains: EXPLAINS.test(text), // it explained the dream instead of telling it
    long: text.split(/\s+/).length > 22,
    dark: Number.isFinite(line.v) && line.v <= -0.5,
  };
}

const SAY = {
  own: ['lines that use their own words', 'Use their own words where they gave them.', 'Their own words have not landed as told; keep them, but plainly.'],
  recurring: ['lines that bring back something from an earlier night', 'Bring back things from earlier nights where a mark invites it.', 'Be sparing with bringing back earlier nights.'],
  explains: ['lines that explain what it meant', 'Explaining has landed with them.', 'Never explain what it meant; tell it.'],
  long: ['long lines', 'Longer lines suit them.', 'Keep lines short.'],
  dark: ['the heaviest lines', 'They take heavy images well, where they marked it heavy.', 'Where it was heaviest, carry it in rhythm and silence more than in dark images.'],
};

export function preferences(S) {
  const seenBefore = new Map(); // night -> entities that appeared on an earlier night
  const firstNight = new Map();
  for (const e of S.entities || []) firstNight.set(e.id, e.first);
  const rows = [];
  for (const night of S.nights || []) {
    const before = new Set([...firstNight].filter(([, n]) => n < night.n).map(([id]) => id));
    seenBefore.set(night.n, before);
    for (const line of night.lines || []) if (line.reaction === 'yes' || line.reaction === 'no') rows.push({ yes: line.reaction === 'yes', t: lineTraits(line, night, before) });
  }
  const all = rows.length, yes = rows.filter((r) => r.yes).length;
  const base = all ? yes / all : 0;
  const notes = [], counts = { all, yes };
  for (const k of Object.keys(SAY)) {
    const with_ = rows.filter((r) => r.t[k]);
    if (with_.length < 3) continue;
    const kept = with_.filter((r) => r.yes).length, rate = kept / with_.length;
    counts[k] = { kept, of: with_.length };
    if (rate - base >= 0.3 || (rate >= 0.8 && base < 0.8)) notes.push(`${SAY[k][1]} (They kept ${kept} of ${with_.length} ${SAY[k][0]}.)`);
    else if (base - rate >= 0.3 || (rate <= 0.34 && base > 0.5)) notes.push(`${SAY[k][2]} (They kept ${kept} of ${with_.length} ${SAY[k][0]}.)`);
  }
  return { notes, counts };
}

// A note from preferences(), exactly as it writes them, or null. The guide service passes on only
// these: what reaches the writer from the TV is the harness's own advice, never free text.
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LESSON = new RegExp(`^(${Object.values(SAY).flatMap((x) => [x[1], x[2]]).map(esc).join('|')}) \\(They kept \\d{1,5} of \\d{1,5} (${Object.values(SAY).map((x) => esc(x[0])).join('|')})\\.\\)$`);
export const knownLesson = (note) => (typeof note === 'string' && LESSON.test(note) ? note : null);
