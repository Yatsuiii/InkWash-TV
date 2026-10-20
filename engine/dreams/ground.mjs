// A telling held to what is theirs. Any model can write a beautiful dream; the harness makes sure
// this one could only be theirs. Each line must come from something of theirs: their words as they
// painted, their answers, the things of their dreams by their names, or how they painted the
// strokes it is about. A line with none of that could be anyone's, and only a few may be the
// guide's own. Some things are never let through: explaining what the dream meant, a reading they
// turned down, leaving out everything they said, leaving out what they answered, or telling it as
// "I" when it is told to them, as "you" (toSecondPerson says it to them, where the guide doesn't).
//
// The guide may offer another way to say a line (`alt`); their taste (taste.mjs) chooses which one
// they hear, and the check decides what may not be heard at all.
//
// Pure. ctx is traitsOf's context, and: { turn: stroke n where their feeling turned, or null;
// turnedDown: [text]; asked: [{ question, answer }] tonight; strokeCount; confirmed: [text], lines
// told tonight and kept, which a dream told again with a new ending can keep: theirs already;
// young: a child is listening, so gentle.mjs holds the telling to what a child's must be (darker:
// the strokes they marked darker); ending: { strokes }, the new ending's, held to it (gentle.mjs) }.
import { traitsOf, keepChance, keyTerms, tidyCtx } from './taste.mjs';
import { checkGentle, checkEnding, frightIn } from './gentle.mjs';

const MAX_WORDS = 28;
const wordCount = (s) => (String(s || '').match(/[\p{L}\p{N}']+/gu) || []).length;
const list = (ns) => (ns.length === 1 ? `${ns[0]}` : `${ns.slice(0, -1).join(', ')} and ${ns.at(-1)}`);
const YES = /^\s*(yes|yeah|yep|it is|it was|the same)\b/i;
const nameKeys = (t) => [t.name, ...(t.aliases || [])].map((k) => String(k || '').toLowerCase().replace(/^(the|a|an|my) /, '')).filter((k) => k.length >= 3);

// does a text bring back a reading they turned down?
function turnedDownIn(text, ctx) {
  const have = new Set(keyTerms(text));
  return (ctx.turnedDown || []).find((t) => { const k = keyTerms(t); return k.length && k.every((x) => have.has(x)); }) || null;
}

// What tonight's answers require of the telling: a thing they said yes to, by its name; anything
// they answered in their own words, carried.
function answered(ctx) {
  const out = [];
  for (const a of ctx.asked || []) {
    if (!a || !a.answer) continue;
    if (YES.test(a.answer)) {
      const q = String(a.question || '').toLowerCase();
      const thing = (ctx.things || []).find((t) => nameKeys(t).some((k) => q.includes(k)));
      if (thing) out.push({ kind: 'name', thing, answer: a.answer });
    } else if (keyTerms(a.answer).length) out.push({ kind: 'words', terms: keyTerms(a.answer), answer: a.answer });
  }
  return out;
}

const norm = (t) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// The painting told instead of the dream: the paper, the brush, the ink, strokes, seconds, or them
// painting it ("you pressed it", "you drew"). How they painted belongs in the dream as what happens
// (a long wait there, something heavy); these are the TV's words, not the dream's, unless they are
// theirs: a paper boat they named on their phone, or a thing of their dreams, stays what it is.
const MEDIUM = /\b(paper|papers|brush|brushes|brushstrokes?|strokes?|ink|inks|inked|canvas|(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty) seconds?|you (?:painted|paint|drew|draw|pressed|press|brushed))\b/gi;
const NOT_THEIRS = new Set(['you', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'fifteen', 'twenty', 'thirty']);
export function paintingIn(text, ctx = {}) {
  const theirs = new Set(words([...(ctx.words || []).map((w) => w && w.text), ...(ctx.answers || []), ...(ctx.things || []).flatMap((t) => [t.name, ...(t.aliases || [])])].join(' ')).map(stem));
  return [...String(text || '').matchAll(MEDIUM)].map((m) => m[0].toLowerCase())
    .filter((m) => !words(m).some((w) => !NOT_THEIRS.has(w) && !/^\d/.test(w) && theirs.has(stem(w))));
}
const words = (t) => String(t || '').toLowerCase().match(/[\p{L}\p{N}.']+/gu) || [];
const stem = (w) => w.replace(/(?<=..)(es|s|ed)$/, '');

// Told to them, as "you". They speak of their world as "I" and "my" (I found my boat), and the story
// tells it to them (you found your boat), the way a story told to someone does. A line that tells
// it as "I" or "we" has the storyteller speaking as them. Outside quotation marks, and not where a
// thing of theirs has it in its name (Me and the Moon stays Me and the Moon).
const EDGE = "[\\p{L}\\p{N}'’]";
const ME = new RegExp(`(?<!${EDGE})(?:(am|was)(\\s+))?(i['’](?:m|ve|ll|d)|i|me|my|mine|myself|we['’](?:re|ve|ll|d)|we|us|our|ours|ourselves)(?:(\\s+)(am|was)(?!${EDGE}))?(?!${EDGE})`, 'giu');
const YOU = { i: 'you', "i'm": "you're", "i've": "you've", "i'll": "you'll", "i'd": "you'd", me: 'you', my: 'your', mine: 'yours', myself: 'yourself', we: 'you', "we're": "you're", "we've": "you've", "we'll": "you'll", "we'd": "you'd", us: 'you', our: 'your', ours: 'yours', ourselves: 'yourselves' };
const VERB = { am: 'are', was: 'were' };
// a mine is somewhere, not something of theirs
const A_MINE = /(?:^|[^\p{L}])(the|a|an|this|that|its|their|his|her|your|old|deep|gold|coal|silver|salt)\s+$/iu;
// the text with what is not narration blanked out, the same length so places hold: what is in
// quotation marks, and the names of their things that have "I", "my" or "we" in them
function narration(text, ctx = {}) {
  const blank = (m) => '\u0001'.repeat(m.length);
  let t = String(text || '').replace(/["“”][^"“”]*["“”]/g, blank);
  const names = (ctx.things || []).flatMap((x) => [x && x.name, ...((x && x.aliases) || [])]).filter((k) => typeof k === 'string' && k.length >= 2 && new RegExp(ME.source, 'iu').test(k));
  for (const k of names) t = t.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu'), blank);
  return t;
}
// Not "I" or "we", though it looks it: I-5 and I.I.; a numeral after a name or a chapter (King
// George I, Chapter I); the US; "oh my!" (a "my" that owns nothing); "let us" (the teller and the
// listener together).
const NUMBERED = /\b(?:chapter|part|book|act|scene|volume|vol\.?|phase|level|stage|round|class|type|grade|world war)\s+$/iu;
const NAMED = /(?<![.!?…:;—–]\s*|^\s*)\b\p{Lu}\p{Ll}+\s+$/u;
function notMe(t, m) {
  const at = m.index + (m[1] ? m[1].length + m[2].length : 0), me = m[3], key = me.toLowerCase(), prefix = t.slice(0, at), next = t.slice(at + me.length);
  if (key === 'mine' && A_MINE.test(prefix)) return true;
  if (key === 'i' && (/^[-‐–]\p{N}/u.test(next) || /^\.\p{L}/u.test(next) || /\p{L}\.$/u.test(prefix))) return true;
  if (me === 'I' && (NUMBERED.test(prefix) || (NAMED.test(prefix) && /^\s*(?:[,.;:!?)]|$|of\b|and\b)/u.test(next)))) return true;
  if (me === 'US') return true;
  if (key === 'my' && /^\s*(?:[!?.,;:)]|$)/u.test(next)) return true;
  if (key === 'us' && /\blet\s+$/i.test(prefix)) return true;
  return false;
}
const meIn = (text, ctx) => {
  const t = narration(text, ctx);
  return [...t.matchAll(ME)].filter((m) => !notMe(t, m));
};
// the words of a text that tell it as "I" or "we"
export const firstPersonIn = (text, ctx = {}) => meIn(text, tidyCtx(ctx)).map((m) => m[3]);
const asCase = (to, from) => (/^\p{Lu}/u.test(from) ? to.charAt(0).toUpperCase() + to.slice(1) : to);
// The same text, told to them: "I found my boat" is "you found your boat", "was I" is "were you".
export function toSecondPerson(text, ctx = {}) {
  ctx = tidyCtx(ctx);
  const s = typeof text === 'string' ? text : '';
  let out = '', at = 0;
  for (const m of meIn(s, ctx)) {
    const [whole, before, gap, me, gap2, after] = m;
    const key = me.toLowerCase().replace('’', "'");
    const isI = key === 'i' || key.startsWith("i'");
    const verb = (v) => (isI ? asCase(VERB[v.toLowerCase()], v) : v);
    // "I" is always written large: "You" only where a sentence begins
    const starts = !before && /(?:^|[.!?…]["”’)]*\s+)$/u.test(s.slice(0, m.index));
    // the apostrophe they wrote, and capitals where the word was all capitals (MY BOAT: YOUR BOAT)
    const curl = (w) => (me.includes('’') ? w.replace("'", '’') : w);
    const loud = me.length > 1 && me === me.toUpperCase();
    const you = curl(loud ? YOU[key].toUpperCase() : isI ? (starts ? asCase(YOU[key], 'Y') : YOU[key]) : asCase(YOU[key], me));
    out += s.slice(at, m.index) + (before ? verb(before) + gap : '') + you + (after ? gap2 + verb(after) : '');
    at = m.index + whole.length;
  }
  return out + s.slice(at);
}

export function checkGrounded(telling, ctx = {}) {
  ctx = tidyCtx(ctx);
  const lines = ((telling && Array.isArray(telling.lines) && telling.lines) || []).filter((l) => l && typeof l.text === 'string' && l.text);
  const kept = new Set((ctx.confirmed || []).map(norm).filter(Boolean));
  const read = lines.map((l) => {
    const r = traitsOf(l.text, l.strokes || [], ctx);
    return kept.has(norm(l.text)) ? { ...r, anchored: true, kept: true } : r;
  });
  const blocking = [], warnings = [];
  const say = (to, line, kind, message) => to.push({ ...(line ? { line } : {}), kind, message });

  read.forEach((r, i) => { if (r.traits.explains) say(blocking, i + 1, 'explains', `Line ${i + 1} explains what it meant. Tell what happened instead.`); });
  lines.forEach((l, i) => { const t = turnedDownIn(l.text, ctx); if (t) say(blocking, i + 1, 'turned_down', `Line ${i + 1} brings back "${t}", which they turned down before.`); });
  const free = read.map((r, i) => (r.anchored ? null : i + 1)).filter(Boolean);
  const allowed = Math.max(1, Math.floor(lines.length / 3));
  if (free.length > allowed) {
    say(blocking, null, 'anyone', `Line${free.length > 1 ? 's' : ''} ${list(free)} could be anyone's: none of their words or answers, no thing of their world by its name, nothing of how they painted ${free.length > 1 ? 'those strokes' : 'that stroke'}. At most ${allowed} line${allowed > 1 ? 's' : ''} may be the guide's own.`);
  }
  // the painting told, not the dream: one line is let by with a word, more is sent back
  const said = lines.map((l, i) => (read[i].kept ? [] : paintingIn(l.text, ctx)));
  const painting = said.map((p, i) => (p.length ? i + 1 : null)).filter(Boolean);
  if (painting.length > 1) say(blocking, null, 'the_painting', `Lines ${list(painting)} tell the painting, not the story ("${said[painting[0] - 1][0]}", "${said[painting[1] - 1][0]}"). Tell what happens in their world, and let how they painted come through it: a long wait there, something heavy, something that came back.`);
  else if (painting.length) say(warnings, painting[0], 'the_painting', `Line ${painting[0]} tells the painting ("${said[painting[0] - 1][0]}"), not the story.`);
  // told as "I": the story is told to them
  lines.forEach((l, i) => {
    const me = read[i].kept ? [] : firstPersonIn(l.text, ctx);
    if (me.length) say(blocking, i + 1, 'first_person', `Line ${i + 1} tells it as "${me[0]}", as if you were them. Tell it to them, as you: their "I" is "you", their "my" is "your".`);
  });
  const spoken = (ctx.words || []).filter((w) => keyTerms(w.text).length);
  if (spoken.length && !read.some((r) => r.traits.own_words)) {
    say(blocking, null, 'words_unused', `They said "${spoken[0].text}"${spoken.length > 1 ? ' and more' : ''} as they painted, and no line uses their words.`);
  }
  for (const need of answered(ctx)) {
    if (need.kind === 'name' && !read.some((r) => r.named.includes(need.thing.name))) say(blocking, null, 'unnamed', `They said yes, it was ${need.thing.name}, and no line calls it by that name.`);
    if (need.kind === 'words' && !lines.some((l) => { const have = new Set(keyTerms(l.text)); return need.terms.some((t) => have.has(t)); })) say(blocking, null, 'answer_dropped', `They answered "${need.answer}", and no line carries it.`);
  }

  read.forEach((r, i) => {
    if (r.feeling.length) say(warnings, i + 1, 'names_feeling', `Line ${i + 1} names a feeling ("${r.feeling[0]}"); let it come through what happens.`);
    if (r.stock.length) say(warnings, i + 1, 'stock_image', `Line ${i + 1} reaches for "${r.stock[0]}", which is not in their painting, their words or their world.`);
    if (wordCount(lines[i].text) > MAX_WORDS) say(warnings, i + 1, 'long', `Line ${i + 1} is over ${MAX_WORDS} words.`);
  });
  if (ctx.turn != null && lines.length && !lines.some((l) => (l.strokes || []).includes(ctx.turn))) say(warnings, null, 'no_turn', `No line is about stroke ${ctx.turn}, where their feeling turned.`);
  // a child listening; a dream told again with its new ending
  for (const g of [ctx.young ? checkGentle(lines, ctx) : null, ctx.ending ? checkEnding(lines, ctx) : null].filter(Boolean)) {
    blocking.push(...g.blocking);
    warnings.push(...g.warnings);
  }

  const anchored = read.filter((r) => r.anchored).length;
  return {
    ok: blocking.length === 0,
    blocking, warnings, free, allowed, anchored,
    lines: read.map((r) => ({ anchored: r.anchored, from: [...(r.kept ? ['they kept it'] : []), ...(r.traits.own_words ? ['their words'] : []), ...(r.traits.their_answer ? ['their answer'] : []), ...r.named, ...r.painted.map((k) => `how they painted (${k})`)] })),
    score: (lines.length ? anchored / lines.length : 0) - 0.5 * blocking.length - 0.1 * warnings.length,
  };
}

// What rules a line out on its own, before it is heard: what is never let through (explaining, a
// reading they turned down, and for a child what checkGentle holds back), the painting told, a line
// told as "I", and a line that could be anyone's. The other way to say a line is heard at once,
// when they say "not quite", only if none of this holds of it.
export function heldAgainst(text, strokes = [], ctx = {}) {
  ctx = tidyCtx(ctx);
  const r = traitsOf(text, strokes, ctx);
  return [
    r.traits.explains && 'explains', turnedDownIn(text, ctx) && 'turned_down', paintingIn(text, ctx).length && 'the_painting',
    firstPersonIn(text, ctx).length && 'first_person', !r.anchored && 'anyone',
    ...(ctx.young ? checkGentle([{ text, strokes }], ctx).blocking.map((b) => b.kind) : []),
  ].filter(Boolean);
}

// The telling they hear: for each line, the line or its alternative, whichever their taste says
// they are likelier to keep, less what the check would hold against it. `model` is fitTaste's;
// without one, the line as written unless the check prefers its alternative.
export function composeTelling(telling, ctx = {}, { model = null } = {}) {
  ctx = tidyCtx(ctx);
  const lines = ((telling && Array.isArray(telling.lines) && telling.lines) || []).filter((l) => l && typeof l === 'object').map((l) => {
    const strokes = Array.isArray(l.strokes) ? l.strokes : [];
    const options = [l.text, l.alt].filter((x) => typeof x === 'string' && x.trim());
    if (!options.length) return null;
    const scored = options.map((text, k) => {
      const r = traitsOf(text, strokes, ctx);
      // never let through, and could be anyone's; the rest (a named feeling, a moon) is their
      // taste's to weigh, which starts against them
      const held = (r.traits.explains ? 1 : 0) + (turnedDownIn(text, ctx) ? 1 : 0) + (r.anchored ? 0 : 0.3) + (ctx.young && frightIn(text, ctx).length ? 1 : 0) + (paintingIn(text, ctx).length ? 0.3 : 0) + (firstPersonIn(text, ctx).length ? 0.3 : 0);
      return { text, k, x: r.x, score: (model ? keepChance(model, r.x) : 0.5 - k * 0.01) - held };
    });
    const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
    return { text: best.text, strokes, chose: best.k === 0 ? 'line' : 'alt', ...(options.length > 1 ? { other: scored.find((s) => s !== best).text } : {}), keep: model ? Math.round(keepChance(model, best.x) * 100) / 100 : null };
  }).filter(Boolean);
  return { title: telling && telling.title, lines };
}
