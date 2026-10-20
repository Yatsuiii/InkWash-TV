// The personal part of a telling's prompt: how the dream felt, what the marks were like, the
// angle to take, the images everyone gets (to use only where a mark truly is one), and the
// person's own recent images (not to repeat; one recurring image may come back, once).
import { FEELINGS } from './feelings.mjs';
import { describeMarks } from './marks.mjs';

export function personalBrief({ aim, marks, lens, cliches = [], recent = [], symbols = [] }) {
  const lines = [];
  if (aim && aim.feeling && aim.source === 'said') lines.push(`How the dream felt, in their own word: ${aim.feeling}. ${FEELINGS[aim.feeling].arc}`);
  else if (aim && aim.feeling) lines.push(`They didn't say how it felt. Their marks suggest something ${aim.feeling}, so lean that way, lightly. ${FEELINGS[aim.feeling].arc}`);
  const m = describeMarks(marks);
  if (m) lines.push(`How they painted: ${m}. Let that be felt in the telling's pace and weight.`);
  if (lens) lines.push(`The angle for this telling: ${lens.text}. Find it in their marks; don't announce it.`);
  if (cliches.length) lines.push(`Many people's dreams lately are full of: ${cliches.join(', ')}. Use one of these only where a mark here clearly is that thing; otherwise find what these marks are instead.`);
  if (recent.length) lines.push(`Their own recent dreams already had: ${recent.slice(0, 8).join(', ')}. Don't retell those.`);
  if (symbols.length) lines.push(`An image that keeps coming back in their dreams: ${symbols[0]}. You may return to it once, if a mark invites it, as if they would recognise it.`);
  return lines.join('\n');
}
