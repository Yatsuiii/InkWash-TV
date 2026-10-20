// What this person keeps, learned line by line. As a dream is told, they answer each line: "that's
// it" (▲) or "not quite" (▼). Every answer is a lesson about them: a line has traits (it used their
// own words, it named a thing of their dreams, it noticed how they painted, it explained what the
// dream meant, it reached for a moon they never painted...), and over nights a model learns how
// much each trait makes this person keep a line. It starts from what most people are likely to
// want (the prior below, a design guess), and moves to what they show.
//
// The model is Bayesian logistic regression with a Gaussian prior, fitted to the maximum a
// posteriori and given a diagonal Laplace precision (Chapelle & Li, 2011, "An empirical evaluation
// of Thompson sampling", algorithm 3). A line and its alternative are chosen between by the chance
// it gives each of being kept, its uncertainty folded in. (Thompson sampling, choosing by a taste
// drawn at random from what is known, did worse in simulation, sim.mjs: the lines vary enough
// to keep teaching it without deliberate exploration.)
import { terms } from '../text.mjs';
import { GESTURE_CUES } from './gesture.mjs';

export const TRAITS = ['own_words', 'their_thing', 'earlier_night', 'how_painted', 'their_answer', 'explains', 'names_feeling', 'stock_image', 'long', 'question', 'senses'];
const D = TRAITS.length + 1; // and a bias

// What a trait is, said plainly, for the brief.
export const SAYS = {
  own_words: 'lines in their own words',
  their_thing: 'lines that call the things of their world by their names',
  earlier_night: 'lines that bring back something from an earlier night',
  how_painted: 'lines that carry how they painted into what happens',
  their_answer: 'lines built on what they answered',
  explains: 'lines that explain what it meant',
  names_feeling: 'lines that name a feeling',
  stock_image: 'stock images they never gave (a moon, mist, a whisper)',
  long: 'long lines',
  question: 'lines that ask a question',
  senses: 'lines with a touch, a sound or a smell in them',
};

// Where every person starts: a guess at what most people keep, weak enough (sd 1) for a few
// nights of their answers to overturn.
export const PRIOR = {
  mean: { bias: 0.3, own_words: 0.8, their_thing: 0.5, earlier_night: 0.3, how_painted: 0.3, their_answer: 0.5, explains: -1, names_feeling: -0.4, stock_image: -0.6, long: -0.2, question: -0.2, senses: 0.2 },
  sd: 1,
};

// A line that says what the dream, or something in it, meant: talk about the dream and the one
// dreaming it, rather than of what happened. Not the words a dream is told in: in a dream you
// realize, you know, you understand, and things happen because of other things, and a story
// world has its own meanings (a bell that means the tide is coming).
const EXPLAINS = new RegExp([
  String.raw`\b(?:this|the|your|that) dream (?:(?:is|was) (?:about|telling|trying|showing|saying|a sign|a message|a way|your)|means|meant|says|said|shows|showed|tells|told)\b`,
  String.raw`\bdreams? (?:like this |like these )?(?:often |usually |always |can )?(?:mean|means|are about|is about)\b`,
  String.raw`\b(?:it|this|that|all this|all of it) (?:is|was) (?:really |actually |all |never )?about (?:you|your)\b`,
  String.raw`\b(?:it|this|that|which) (?:really |must |might )?(?:means|meant)(?: that)? (?:you|your)\b`,
  String.raw`\b(?:the meaning of|what it means|what it meant|what this means)\b`,
  String.raw`\bsymboli[sz]\w*|\bsymbol of\b|\brepresent\w*|\bstands? for\b|\bmetaphor\b`,
  String.raw`\b(?:part of you|deep down|perhaps you|maybe you|as if to say|you (?:must|might) have)\b`,
  String.raw`\byour (?:own )?(?:subconscious|unconscious|psyche)\b|\byour (?:own )?mind (?:is |was )?(?:telling|trying|working|processing|saying|showing)\b`,
  String.raw`\bbecause (?:deep down )?you (?:feel|felt|fear|feared|want|wanted|need|needed|miss|missed|long|longed|wish|wished|are afraid|were afraid)\b`,
].join('|'), 'i');
const FEELINGS = new Set('afraid fear feared fearful scared frightened terror terrified anxious anxiety worried worry dread panic sad sadness grief grieving sorrow sorrowful lonely loneliness alone happy happiness joy joyful glad calm peace peaceful serene serenity angry anger rage furious guilt guilty shame ashamed hope hopeful hopeless despair longing nostalgia nostalgic melancholy relief relieved content contentment love loved lost'.split(' '));
const STOCK = new Set('moon moonlight moonlit stars starlight starry lantern lanterns mist misty fog foggy whisper whispers whispered whispering ethereal shimmer shimmering shimmered silver silvery velvet tapestry echo echoes echoed dreamscape cosmos cosmic galaxy infinite eternity eternal abyss void veil glow glowing luminous twilight ripple ripples gossamer celestial ancient'.split(' '));
const SENSES = new Set('cold warm wet damp salt salty bitter sour sweet rough smooth sharp smell smelled scent taste tasted sound loud hum hummed creak creaked rust rusted wool stone iron ash smoke tar mud sand grit frost sweat breath dripping sticky splinter splintered soaked chalk ink paper glass rain wind knock knocked'.split(' '));
// words too common to show a line took them from someone: answers' yes and no, and the commonest
// verbs and words of any telling
const EMPTY = new Set(('yes yeah yep same else something skip nothing maybe know dont don not sure thing things again ' +
  'got get saw see say said way let put big new old far how why did came come went goe going gone tell told look seem seem felt feel ' +
  'like just really kind sort lot bit back even ever much many few made make where them they there then its was had').split(' '));

// the inks they chose, beside the black every brush starts with, called by their colour: a line
// about strokes painted in gold that says gold is told from how they painted them
const INK_WORDS = {
  gold: /\b(gold|golden|gilt|gilded)\b/,
  indigo: /\b(indigo|blue|bluer|navy)\b/,
  cinnabar: /\b(red|reds|cinnabar|scarlet|crimson|vermilion)\b/,
  light: /\b(pale|paler|grey|gray|faint|misty)\b/,
};
const words = (text) => String(text || '').toLowerCase().match(/[\p{L}']+/gu) || [];
// the words of a text that can show where a line came from: stems of three letters or more
// What a check is given of them, held to the shape it reads: their words (with the stroke each was
// said at), their answers, their things by name, what they turned down, what they kept. Whatever
// isn't one of these is let go, so no check can trip on it.
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const strings = (xs) => (Array.isArray(xs) ? xs.filter((x) => typeof x === 'string') : []);
export function tidyCtx(ctx) {
  const c = isObj(ctx) ? ctx : {};
  const fine = (k, ok) => c[k] === undefined || (Array.isArray(c[k]) && c[k].every(ok));
  const isWord = (w) => isObj(w) && typeof w.text === 'string';
  const isThing = (t) => isObj(t) && typeof t.name === 'string' && (t.aliases === undefined || (Array.isArray(t.aliases) && t.aliases.every((a) => typeof a === 'string')));
  const isAsk = (a) => isObj(a);
  if (fine('words', isWord) && fine('answers', (x) => typeof x === 'string') && fine('things', isThing) && fine('turnedDown', (x) => typeof x === 'string') && fine('asked', isAsk) && fine('confirmed', (x) => typeof x === 'string')) return c;
  return {
    ...c,
    ...(c.words !== undefined ? { words: (Array.isArray(c.words) ? c.words : []).filter(isWord) } : {}),
    ...(c.answers !== undefined ? { answers: strings(c.answers) } : {}),
    ...(c.things !== undefined ? { things: (Array.isArray(c.things) ? c.things : []).filter((t) => isObj(t) && typeof t.name === 'string').map((t) => ({ ...t, aliases: strings(t.aliases) })) } : {}),
    ...(c.turnedDown !== undefined ? { turnedDown: strings(c.turnedDown) } : {}),
    ...(c.asked !== undefined ? { asked: (Array.isArray(c.asked) ? c.asked : []).filter(isAsk) } : {}),
    ...(c.confirmed !== undefined ? { confirmed: strings(c.confirmed) } : {}),
  };
}

export const keyTerms = (text) => terms(String(text || '')).filter((t) => t.length >= 3 && !EMPTY.has(t));
const nameKeys = (t) => [t.name, ...(t.aliases || [])].map((k) => String(k || '').toLowerCase().replace(/^(the|a|an|my) /, '')).filter((k) => k.length >= 3);
const mentions = (lower, key) => new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower);

// The traits of a line, as 0 or 1 in the order of TRAITS, with what anchored it.
//   ctx: { words: [{ n, text }] tonight's words by phone; answers: [text] tonight's answers;
//          things: [{ name, aliases, first }] the things of their dreams (theirs: said, or kept);
//          night; notable: [{ stroke, kind }] from readHand; inks: { stroke n: ink } }
export function traitsOf(text, strokes = [], ctx = {}) {
  ctx = tidyCtx(ctx);
  if (!Array.isArray(strokes)) strokes = [];
  const lower = String(text || '').toLowerCase();
  const line = new Set(keyTerms(text));
  const at = (ctx.words || []).filter((w) => strokes.includes(w.n));
  const overlap = (xs) => xs.filter((t) => line.has(t)).length;
  const theirText = [...(ctx.words || []).map((w) => w.text), ...(ctx.answers || [])].join(' ').toLowerCase();
  const theirWords = new Set(words(theirText));
  const named = (ctx.things || []).filter((t) => nameKeys(t).some((k) => mentions(lower, k)));
  const own = overlap(keyTerms(at.map((w) => w.text).join(' '))) >= 1 || overlap([...new Set(keyTerms((ctx.words || []).map((w) => w.text).join(' ')))]) >= 2;
  const answered = overlap([...new Set(keyTerms((ctx.answers || []).join(' ')))]) >= 1;
  const painted = (ctx.notable || []).filter((g) => strokes.includes(g.stroke) && GESTURE_CUES[g.kind] && GESTURE_CUES[g.kind].test(lower));
  const inked = [...new Set(strokes.map((n) => ctx.inks && ctx.inks[n]).filter((k) => INK_WORDS[k] && INK_WORDS[k].test(lower)))];
  const ws = words(lower);
  const feeling = ws.filter((w) => FEELINGS.has(w) && !theirWords.has(w));
  const stock = ws.filter((w) => STOCK.has(w) && !theirWords.has(w) && !named.some((t) => nameKeys(t).some((k) => k.includes(w))));
  const t = {
    own_words: own,
    their_thing: named.length > 0,
    earlier_night: named.some((x) => Number.isFinite(x.first) && Number.isFinite(ctx.night) && x.first < ctx.night),
    how_painted: painted.length > 0 || inked.length > 0,
    their_answer: answered,
    explains: EXPLAINS.test(lower),
    names_feeling: feeling.length > 0,
    stock_image: stock.length > 0,
    long: ws.length > 18,
    question: /\?\s*$/.test(String(text || '')),
    senses: ws.some((w) => SENSES.has(w)),
  };
  return {
    x: TRAITS.map((k) => (t[k] ? 1 : 0)),
    traits: t,
    named: named.map((x) => x.name),
    painted: [...painted.map((g) => g.kind), ...inked.map((k) => `${k} ink`)],
    feeling, stock,
    anchored: t.own_words || t.their_thing || t.how_painted || t.their_answer,
  };
}

// ---------------------------------------------------------------- the model

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const withBias = (x) => [1, ...x];
const priorVec = (prior) => ['bias', ...TRAITS].map((k) => prior.mean[k] ?? 0);

// solve A d = b, A small and positive definite (Gaussian elimination, partial pivoting)
function solve(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const d = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * d[k];
    d[r] = s / M[r][r];
  }
  return d;
}

// The taste their answers show: rows [{ x (traits, as traitsOf gives), y: 1 kept, 0 not quite }].
// { mean, prec } over [bias, ...TRAITS], and how many rows it learned from.
export function fitTaste(rows = [], prior = PRIOR) {
  rows = (Array.isArray(rows) ? rows : []).filter((r) => r && Array.isArray(r.x) && r.x.every(Number.isFinite));
  const m0 = priorVec(prior), q0 = 1 / (prior.sd ** 2);
  const X = rows.map((r) => withBias(r.x)), y = rows.map((r) => (r.y ? 1 : 0));
  let w = m0.slice();
  for (let it = 0; it < 30; it++) {
    const g = w.map((wi, i) => q0 * (wi - m0[i]));
    const H = Array.from({ length: D }, (_, i) => Array.from({ length: D }, (_, j) => (i === j ? q0 : 0)));
    X.forEach((x, n) => {
      const p = sigmoid(x.reduce((a, xi, i) => a + xi * w[i], 0));
      for (let i = 0; i < D; i++) {
        if (!x[i]) continue;
        g[i] -= (y[n] - p) * x[i];
        for (let j = 0; j < D; j++) if (x[j]) H[i][j] += p * (1 - p) * x[i] * x[j];
      }
    });
    const d = solve(H, g);
    w = w.map((wi, i) => wi - d[i]);
    if (Math.max(...d.map(Math.abs)) < 1e-7) break;
  }
  const prec = new Array(D).fill(q0);
  X.forEach((x) => {
    const p = sigmoid(x.reduce((a, xi, i) => a + xi * w[i], 0));
    for (let i = 0; i < D; i++) prec[i] += p * (1 - p) * x[i] * x[i];
  });
  return { mean: w, prec, n: rows.length };
}

export const emptyTaste = (prior = PRIOR) => fitTaste([], prior);

// How likely they are to keep a line with these traits, its uncertainty folded in (MacKay's
// probit approximation).
export function keepChance(model, x) {
  const xb = withBias(x);
  const mu = xb.reduce((a, xi, i) => a + xi * model.mean[i], 0);
  const s2 = xb.reduce((a, xi, i) => a + (xi * xi) / model.prec[i], 0);
  return sigmoid(mu / Math.sqrt(1 + (Math.PI * s2) / 8));
}

// What their answers have shown, plainly, for the brief: only what at least three of their answers
// bear on, and where the model is sure of the leaning (its mean a standard deviation from even).
export function tasteNotes(model, rows = []) {
  const out = [];
  TRAITS.forEach((k, j) => {
    const i = j + 1;
    const with_ = rows.filter((r) => r.x[j]);
    if (with_.length < 3) return;
    const m = model.mean[i], sdv = 1 / Math.sqrt(model.prec[i]);
    if (Math.abs(m) < sdv) return;
    const kept = with_.filter((r) => r.y).length;
    out.push({ trait: k, leaning: m > 0 ? 'keep' : 'turn down', says: `They ${m > 0 ? 'keep' : 'turn down'} ${SAYS[k]} (kept ${kept} of ${with_.length}).`, sure: Math.abs(m) / sdv });
  });
  return out.sort((a, b) => b.sure - a.sure).slice(0, 6);
}
