// What a child's telling is held to, in code, before a line is heard: the guide is asked never to
// bring in anything frightening, never to make what scared them bigger or closer, and to say things
// plainly; this checks that it did, so it holds whatever model tells the dream. And a dream told
// again with what they painted next is held to it: what they painted is told, it comes last, and
// the dream doesn't slide back to before it.
//
// Pure. `lines`: [{ text, strokes }]. ctx (ground.mjs's): words [{ n, text }], answers [text],
// things [{ name, aliases }], confirmed [text] (lines told tonight and kept: theirs already),
// darker [n] (strokes they marked heavier, or darker), ending { strokes } (what they painted next).
import { tidyCtx } from './taste.mjs';

const lower = (s) => String(s || '').toLowerCase();
const wordCount = (s) => (String(s || '').match(/[\p{L}\p{N}']+/gu) || []).length;
const family = (stem) => new RegExp(`\\b(?:${stem})\\b`, 'i');

// frightening for a child, unless they brought it themselves (word families)
const FRIGHT = [
  'die|dies|died|dying|dead|death', 'kill(?:s|ed|ing|er)?', 'blood(?:y)?|bleed(?:s|ing)?|bled', 'scream(?:s|ed|ing)?',
  'monsters?', 'ghosts?', 'demons?', 'devils?', 'zombies?', 'skeletons?', 'corpses?', 'skulls?',
  'knife|knives', 'guns?', 'shoot(?:s|ing)?', 'bites?|bitten|biting', 'drown(?:s|ed|ing)?',
  'terror|terrified|terrifying|terrible', 'horror|horrible|horrified|horrifying', 'nightmares?', 'evil', 'wicked',
  'hurt(?:s|ing)?', 'pains?|painful', 'attack(?:s|ed|ing)?', 'trapped', 'eaten', 'graves?', 'coffins?',
  'claws?', 'fangs?', 'witch(?:es)?', 'spiders?', 'snakes?', 'wolf|wolves', 'burn(?:s|ed|ing|t)?', 'fire', 'flames?', 'poison(?:ed|ous)?',
  'teeth', 'chas(?:e|es|ed|ing)', 'growl(?:s|ed|ing)?', 'snarl(?:s|ed|ing)?', 'scary|scared|scare(?:s|d)?', 'afraid', 'fear(?:s|ful)?', 'frighten(?:s|ed|ing)?',
  'darkness', 'sharks?', 'dragons?', 'beasts?', 'strangers?', 'kidnap(?:s|ped|ping)?', 'cage(?:s|d)?', 'alone',
].map(family);
// what makes a thing they marked darker bigger or closer
const GROW = [
  'bigger', 'biggest', 'huge', 'giant', 'enormous', 'gigantic', 'grew', 'grow(?:s|ing)?', 'closer', 'nearer', 'worse', 'worst',
  'louder', 'faster', 'darker', 'taller', 'stronger', 'more and more', 'came for', 'coming for', 'caught', 'grabbed', 'reached for',
].map(family);
// figures of speech a child may take literally
const IDIOMS = [
  /butterflies in (?:your|his|her|their|my) (?:stomach|tummy)/, /heart (?:was |is )?in (?:your|his|her|their|my) mouth/, /frozen (?:with|in) fear/,
  /scared (?:stiff|to death)/, /jump(?:ed|s)? out of (?:your|his|her|their|my) skin/, /hair stood on end/, /blood ran cold/,
  /chills? (?:ran )?down (?:your|his|her|their|my) spine/, /heart skipped a beat/, /over the moon/, /on cloud nine/, /piece of cake/,
  /raining cats and dogs/, /cr(?:y|ied) (?:your|his|her|their|my) eyes out/, /lost (?:your|his|her|their|my) head/, /under the weather/,
  /out of the blue/, /once in a blue moon/, /time flies/, /break(?:s)? the ice/, /cold feet/, /spill(?:ed)? the beans/, /all ears/,
  /head in the clouds/, /slept like a log/, /pull(?:ing|ed)? (?:your|his|her|their|my) leg/, /let the cat out of the bag/,
  /a weight (?:was )?lifted/, /heavy heart/, /heart of gold/, /tongue[- ]tied/, /in hot water/, /walking on eggshells/,
];

// syllables, roughly: enough to tell "boat" from "unfathomable"
function syllables(w) {
  const s = lower(w).replace(/[^a-z]/g, '');
  if (s.length <= 3) return 1;
  const m = s.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

// everything of theirs a word may come from
const theirsOf = (ctx) => lower([
  ...(ctx.words || []).map((w) => w.text), ...(ctx.answers || []), ...(ctx.confirmed || []),
  ...(ctx.things || []).flatMap((t) => [t.name, ...(t.aliases || [])]),
].join(' \n '));

// the frightening words a line brings in that they never brought
export function frightIn(text, ctx = {}, theirs = theirsOf(tidyCtx(ctx))) {
  text = typeof text === 'string' ? text : '';
  return FRIGHT.map((re) => { const m = re.exec(text); return m && !re.test(theirs) ? m[0].toLowerCase() : null; }).filter(Boolean);
}

// the lines a check reads: those that are lines (a line without text is read as empty)
const linesOf = (ls) => (Array.isArray(ls) ? ls : []).filter((l) => l && typeof l === 'object').map((l) => (typeof l.text === 'string' && (l.strokes === undefined || Array.isArray(l.strokes)) ? l : { ...l, text: typeof l.text === 'string' ? l.text : '', strokes: Array.isArray(l.strokes) ? l.strokes : [] }));

export function checkGentle(lines, ctx = {}) {
  ctx = tidyCtx(ctx); lines = linesOf(lines);
  const blocking = [], warnings = [];
  const theirs = theirsOf(ctx);
  const kept = new Set((ctx.confirmed || []).map((t) => lower(t).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()));
  const darker = new Set(ctx.darker || []);
  lines.forEach((l, i) => {
    const k = i + 1, text = String(l.text || '');
    if (kept.has(lower(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim())) return; // told and kept already
    const fright = frightIn(text, ctx, theirs);
    if (fright.length) blocking.push({ line: k, kind: 'frightening', message: `Line ${k} brings in "${fright[0]}", which they never brought. A child's telling keeps to what they painted and said.` });
    if ((l.strokes || []).some((n) => darker.has(n))) {
      const grow = GROW.map((re) => { const m = re.exec(text); return m && !re.test(theirs) ? m[0].toLowerCase() : null; }).filter(Boolean);
      if (grow.length) blocking.push({ line: k, kind: 'made_bigger', message: `Line ${k} makes what they marked darker "${grow[0]}". Never make what frightened them bigger or closer.` });
    }
    const idiom = IDIOMS.map((re) => re.exec(lower(text))).find(Boolean);
    if (idiom) blocking.push({ line: k, kind: 'figure_of_speech', message: `Line ${k} says "${idiom[0]}": a child may take it literally. Say it plainly.` });
    const n = wordCount(text);
    if (n > 18) warnings.push({ line: k, kind: 'long_for_a_child', message: `Line ${k} is ${n} words; for a child, keep each line under 18.` });
    const hard = (text.match(/[\p{L}']+/gu) || []).filter((w) => syllables(w) >= 4 && !theirs.includes(lower(w)));
    if (hard.length) warnings.push({ line: k, kind: 'hard_word', message: `Line ${k} uses "${hard[0]}"; a word a six-year-old knows would do.` });
  });
  return { blocking, warnings };
}

// A dream told again with what they painted next: that is told, last, and holds
export function checkEnding(lines, ctx = {}) {
  ctx = tidyCtx(ctx); lines = linesOf(lines);
  const blocking = [], warnings = [];
  const fresh = new Set((ctx.ending && ctx.ending.strokes) || []);
  if (!fresh.size || !lines.length) return { blocking, warnings };
  const about = lines.map((l) => (l.strokes || []).some((n) => fresh.has(n)));
  const list = [...fresh].join(', ');
  const first = about.indexOf(true);
  if (first < 0) {
    blocking.push({ kind: 'no_ending', message: `No line tells what they painted next (stroke${fresh.size > 1 ? 's' : ''} ${list}).` });
    return { blocking, warnings };
  }
  if (!about[about.length - 1]) blocking.push({ line: lines.length, kind: 'ending_not_last', message: `End with what they painted next: the last line should be about stroke${fresh.size > 1 ? 's' : ''} ${list}.` });
  const back = about.findIndex((x, i) => i > first && !x);
  if (back >= 0 && about[about.length - 1]) blocking.push({ line: back + 1, kind: 'ending_undone', message: `Line ${back + 1} goes back to the story as it was, after what they painted next has begun. Once it begins, keep to it.` });
  const told = new Set(lines.flatMap((l) => l.strokes || []));
  const untold = [...fresh].filter((n) => !told.has(n));
  if (untold.length) warnings.push({ kind: 'ending_untold', message: `Stroke${untold.length > 1 ? 's' : ''} ${untold.join(', ')} of what they painted next ${untold.length > 1 ? 'are' : 'is'} in no line.` });
  return { blocking, warnings };
}

// What is never heard, however the storyteller tells it. Once a telling has been sent back as often
// as it may be, it is told without: for a child, every line checkGentle blocks; for a dream told
// with what they painted next, every line that goes back to the dream as it was once that has
// begun (so it ends on what they painted). And if no line tells it, it ends in their own words for
// it (ctx.ending.said: what they said or answered about it), or plainly. `lines` as they would be
// told ([{ text, strokes, ...}], kept as they are). Returns { lines, held: [{ line, kind, text }],
// added: the line it ended with, or null }.
export function withhold(lines, ctx = {}) {
  ctx = tidyCtx(ctx); lines = linesOf(lines);
  const held = [];
  const hold = (k, kind, text) => { held.push({ line: k, kind, text }); return false; };
  let out = lines.map((l, i) => ({ l, k: i + 1 }));
  if (ctx.young) {
    const why = new Map();
    for (const b of checkGentle(lines, ctx).blocking) if (!why.has(b.line)) why.set(b.line, b.kind);
    out = out.filter(({ l, k }) => !why.has(k) || hold(k, why.get(k), l.text));
  }
  const fresh = new Set((ctx.ending && ctx.ending.strokes) || []);
  let added = null;
  if (fresh.size) {
    const about = (l) => (l.strokes || []).some((n) => fresh.has(n));
    const first = out.findIndex(({ l }) => about(l));
    if (first >= 0) out = out.filter(({ l, k }, i) => i <= first || about(l) || hold(k, 'ending_undone', l.text));
    else {
      const said = String(ctx.ending.said || '').replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
      added = { text: said ? `Then ${/^I\b/.test(said) ? said : said.charAt(0).toLowerCase() + said.slice(1)}.` : 'Then it ended the way you drew it.', strokes: [...fresh] };
      out.push({ l: added, k: null });
    }
  }
  return { lines: out.map((x) => x.l), held, added };
}
