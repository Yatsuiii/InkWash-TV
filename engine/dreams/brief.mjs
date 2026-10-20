// Tonight's telling, made from their world and their own words: what the writer is told, and what
// is checked once it has written.
//
// - attachTonight: which of their words, and which things from their world, belong to each part of
//   the telling: by the mark they were said over, or the mark that looks like the thing;
// - worldBrief: their dream world as it stands tonight, for the writer;
// - wordsBrief: what they said that belongs to no one part;
// - wordsUsed: whether the telling was made from what they said (by their key words), and calls
//   what they named at the turn by their name for it;
// - retellNote: what to tell the writer when a telling doesn't follow their line, leaves out their
//   words, or goes against their world.
import { tokenize, STOP, stem } from '../text.mjs';
import { rewriteNote } from '../personal/arc.mjs';

const quote = (t) => `"${String(t).replace(/"/g, "'")}"`;

// words that carry no image: talk about the dream itself, filler, and the names of feelings (the
// telling never names the feeling, so it isn't asked to use them)
const FILLER = new Set(('dream dreams dreamt dreamed dreaming think thought remember remembered something someone somewhere anything '
  + 'thing things kind sort really maybe actually basically stuff part bit felt feel feeling feels look looked looks seemed seems '
  + 'went came going coming know knew want wanted made make got get yeah yes okay lot lots ').split(' ').filter(Boolean));
const FEELS = new Set(('scared afraid frightened terrified fear happy sad sadness anxious nervous worried angry upset lonely calm '
  + 'peaceful joyful joy uneasy glad excited tense numb').split(' '));

// The words of what they said that the telling should carry: not stop words, filler or feelings;
// stemmed, once each.
export function keyWords(text) {
  const seen = new Set(), out = [];
  for (const t of tokenize(text)) {
    const w = t.lower;
    if (w.length < 3 || STOP.has(w) || FILLER.has(w) || FEELS.has(w) || /^\d+$/.test(w)) continue;
    const s = stem(w);
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}
// "stop" and "stopped" are one word here; "sea" and "seat" are not
const same = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
const has = (keys, k) => keys.some((x) => same(x, k));

// Which part of the telling each of their words belongs to (the part painted as they said it),
// and which things from their world a part's marks look like. Sets `heard` and `known` on the
// beats; returns what belongs to no part.
//   words:  [{ n, text }], n the stroke being painted when they said it, or null
//   things: their world's things in play tonight, [{ name, nights, n }] (n: the mark like it)
export function attachTonight(beats, { words = [], things = [] } = {}) {
  const partOf = (n) => (n == null ? -1 : beats.findIndex((b) => !b.whole && b.strokes.includes(n)));
  const general = [];
  for (const b of beats) { b.heard = []; b.known = []; }
  for (const w of words) {
    const i = partOf(w.n);
    if (i >= 0) beats[i].heard.push(w.text); else general.push(w.text);
  }
  for (const t of things) {
    if (t.n == null) continue;
    const i = partOf(t.n);
    if (i >= 0 && !beats[i].known.some((k) => k.name === t.name)) beats[i].known.push({ n: t.n, name: t.name, nights: t.nights || 1 });
  }
  return { beats, general };
}

export function wordsBrief(general = []) {
  if (!general.length) return '';
  return `Before they painted, or about the whole of it, they said: ${general.map(quote).join(' / ')}. Use their words where they belong.`;
}

const KIND = { person: 'a person', place: 'a place', thing: 'a thing', creature: 'a creature', presence: 'a presence' };
const SHAPE_SAYS = {
  even: 'it held one feeling', rise: 'it grew lighter', fall: 'it grew heavier', dip: 'it sank, then lifted', peak: 'it lifted, then sank',
  'wave-up': 'it came in waves', 'wave-down': 'it came in waves', 'stir-peak': 'a storm that passed', 'stir-rise': 'it grew stirred', 'stir-fall': 'it settled',
};

// Their dream world as it stands tonight (world.mjs slice, with what the TV recognised in tonight's
// painting: a thing's `n`, the mark like it, and `said`, if their words named it), for the
// writer. Empty on a first night.
export function worldBrief(world) {
  if (!world) return '';
  const things = world.things || [], facts = world.facts || [], threads = world.threads || [], recent = world.recent || [];
  const learned = world.learned || [], avoid = world.avoid || [], told = (world.lastTold && world.lastTold.lines) || [];
  if (!things.length && !facts.length && !threads.length && !recent.length && !learned.length && !avoid.length && !told.length) return '';
  const out = [];
  out.push(`Their world: what it has held in the nights before, kept on their TV.${world.night > 1 ? ` Tonight is night ${world.night}.` : ''}`);
  if (things.length) {
    out.push('What of it may be in tonight\'s painting, and how it felt to them each time it came (from their own marks: these feeling words are for you, never for the telling):');
    for (const t of things) {
      const when = t.nights ? `${t.nights === 1 ? 'one earlier night' : `${t.nights} earlier nights`}${t.first ? `, first on night ${t.first}` : ''}` : null;
      const tonight = `${t.n != null ? ` Tonight, mark ${t.n} is shaped and placed like it.` : ''}${t.said ? ' They spoke of it tonight.' : ''}`;
      out.push(`- ${t.name} (${[KIND[t.kind] || 'a thing', when, t.own ? 'they named it themselves' : null].filter(Boolean).join('; ')})${t.felt ? `: ${t.felt}` : ''}.${tonight}`);
    }
  }
  if (facts.length) { out.push('How things stand in their world:'); for (const f of facts) out.push(`- ${f}`); }
  if (threads.length) {
    out.push('Still unresolved from earlier nights. Tonight\'s painting may return to one of these, if a mark or their words call for it; never force it:');
    for (const t of threads) out.push(`- ${t.text}`);
  }
  if (recent.length) out.push(`Their last nights: ${recent.map((r) => `night ${r.night}, ${r.title || 'untitled'}${SHAPE_SAYS[r.shape] ? ` (${SHAPE_SAYS[r.shape]})` : ''}`).join('; ')}. Don't retell those.`);
  if (things.length || threads.length) out.push('Where something from their world is in tonight\'s painting, tell it as the same thing: by its name where they need it to know it again, then as anyone would go on (the lake, the page, she), carrying how it has felt to them. A long name is said once a night at most. Don\'t explain it, and say "again" at most once. Bring in nothing from earlier nights that no mark or word of theirs tonight calls for. Never contradict how things stand; a thing may change tonight, if the dream changes it.');
  if (told.length) out.push(`How you told night ${world.lastTold.night}: ${told.join(' / ')}. Tonight's is new: find new words for it, never reuse your own turns of phrase from that night, and begin differently (their own words may come back).`);
  if (avoid.length) out.push(`They turned these readings down before; don't use them: ${avoid.join(', ')}.`);
  if (learned.length) { out.push('What their reactions to past tellings have taught:'); for (const l of learned) out.push(`- ${l}`); }
  return out.join('\n');
}

// Did the telling use what they said? An utterance is used when one of its key words is in the
// telling (two, if it had four or more); what they named at the turn must be in its own line.
//   words: [{ n, text }]; lines: the telling's lines (strings), one per beat
// -> { asked, used, share, missing: [{ text, part }], named: true | false | null }
export function wordsUsed({ words = [], lines = [], beats = [] }) {
  const lineKeys = lines.map((l) => keyWords(typeof l === 'string' ? l : (l && l.text) || ''));
  const told = lineKeys.flat();
  const partOf = (n) => { const i = n == null ? -1 : beats.findIndex((b) => !b.whole && b.strokes.includes(n)); return i >= 0 ? i : null; };
  const out = { asked: 0, used: 0, share: null, missing: [], named: null };
  for (const w of words) {
    const keys = keyWords(w.text);
    if (!keys.length) continue;
    out.asked++;
    const hit = keys.filter((k) => has(told, k)).length;
    if (hit >= (keys.length >= 4 ? 2 : 1)) out.used++;
    else out.missing.push({ text: w.text, part: partOf(w.n) });
  }
  out.share = out.asked ? out.used / out.asked : null;
  const b = beats.findIndex((x) => x.named && x.said);
  if (b >= 0 && lineKeys[b]) {
    const keys = keyWords(beats[b].said);
    if (keys.length) out.named = keys.filter((k) => has(lineKeys[b], k)).length >= (keys.length >= 3 ? 2 : 1);
  }
  return out;
}

// What to tell the writer when the telling needs another go: where it doesn't follow their line
// (`check`, from checkTelling), which of their words it left out (`used`, from wordsUsed), where it
// goes against their world (`conflicts`: [{ line, why }], from the guide service's archivist).
export function retellNote({ check = null, used = null, conflicts = [], beats }) {
  const out = [];
  const feeling = !!check && !check.ok && !check.unread;
  if (feeling) out.push(rewriteNote(check, beats, { close: false }));
  const fewWords = used && used.share != null && used.share < 0.5 && used.missing.length;
  if (fewWords) {
    out.push('Your telling leaves out what they said. It should be made from their words:');
    for (const m of used.missing.slice(0, 5)) out.push(`- ${m.part != null ? `Line ${m.part + 1} should carry what they said as they painted it` : 'They also said'}: ${quote(m.text)}.`);
  }
  if (used && used.named === false) {
    const i = beats.findIndex((x) => x.named && x.said);
    out.push(`- Line ${i + 1} must call it what they called it: ${beats[i].said}.`);
  }
  if (conflicts.length) {
    out.push('Some lines go against their world as it stands:');
    for (const c of conflicts.slice(0, 4)) out.push(`- Line ${c.line + 1}: ${c.why}`);
  }
  out.push(`Rewrite those lines${feeling ? ' so the feeling follows their line' : ''}. Keep the same number of lines, the same parts, and anything they named.${feeling ? ' Change the images and rhythm, not the feeling words: never name the feeling.' : ' Never name the feeling.'}`);
  return out.join('\n');
}
// whether a telling needs another go, and how good one is against another
export function needsRetelling({ check, used, conflicts = [] }) {
  return (!!check && !check.ok && !check.unread) || conflicts.length > 0 || (!!used && ((used.share != null && used.share < 0.5) || used.named === false));
}
export function tellingScore({ check, used, conflicts = [] }) {
  return (check && Number.isFinite(check.score) ? check.score : 0) + (used && used.share != null ? used.share : 0)
    + (used && used.named === false ? -0.5 : 0) - 0.5 * conflicts.length;
}
