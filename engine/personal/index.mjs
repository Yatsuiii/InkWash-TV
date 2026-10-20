// The personal layer: so the same theme doesn't give everyone the same story.
//
// The telling follows the person's own feeling line (arc.mjs): marked by them, stroke by stroke,
// as their painting came back; cut into parts where their feeling changed; written part by part;
// checked by a reader who doesn't know the line, and rewritten if it doesn't follow it; spoken
// slower and softer where it was heavier. Around it: the commons (what everyone's tellings use,
// counts only) and their own history (what their past dreams had, and what they named).
//
// planTelling and finishTelling are the earlier way (one feeling word, angles from a bank, three
// candidates, the best chosen), kept so the eval can compare the two.
export { FEELINGS, FEELING_WORDS, target, readText, readWords, fit } from './feelings.mjs';
export { readMarks, describeMarks } from './marks.mjs';
export { motifs, tellingMotifs, jaccard } from './motifs.mjs';
export { createCommons, imageKey } from './commons.mjs';
export { createHistory } from './history.mjs';
export { LENSES, chooseLenses } from './lenses.mjs';
export { personalBrief } from './brief.mjs';
export { SELECT, scoreTelling, choose } from './select.mjs';
export { readLine, shapeOf, compileBeats, arcBrief, checkTelling, rewriteNote, voiceOf, ssml, weightOf, shapeKind, readingsFor, plainTelling } from './arc.mjs';

import { target } from './feelings.mjs';
import { readMarks } from './marks.mjs';
import { chooseLenses } from './lenses.mjs';
import { personalBrief } from './brief.mjs';
import { choose } from './select.mjs';

// Plan one telling: what to aim for, and a brief for each candidate.
export function planTelling({ strokes, session = {}, felt = null, history, commons, k = 3, seed = 'x' }) {
  const marks = readMarks(strokes, session);
  const aim = target(felt, marks);
  const lenses = chooseLenses({ feeling: aim.feeling, marks, used: history ? history.lensesUsed() : new Set(), k, seed });
  const shared = { aim, marks, cliches: commons ? commons.cliches() : [], recent: history ? history.recent() : [], symbols: history ? history.symbols() : [] };
  return {
    aim, marks,
    candidates: (lenses.length ? lenses : [null]).map((lens) => ({ lens, brief: personalBrief({ ...shared, lens }) })),
  };
}

// After the candidates are written: keep the best, and remember it.
export function finishTelling({ plan, written, strokes, history, commons }) {
  const { best, all } = choose(written.map((w, i) => (w ? { telling: w, lens: plan.candidates[i]?.lens || null } : null)), { strokes, aim: plan.aim, commons, history });
  if (!best) return null;
  if (commons) commons.add(best.motifs);
  if (history) history.add({ feeling: plan.aim.feeling, lens: best.lens?.id || null, motifs: best.motifs });
  return { telling: best.telling, lens: best.lens, motifs: best.motifs, scores: all.map((c) => ({ lens: c.lens?.id || null, score: +c.score.toFixed(3), parts: Object.fromEntries(Object.entries(c.parts).map(([k, v]) => [k, +v.toFixed(2)])) })) };
}
