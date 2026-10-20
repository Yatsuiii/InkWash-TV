// The guide's loop, on the TV. Claude, through the guide service's /agent, decides what to do;
// the TV carries out each tool it calls (its senses, memory and screen are here) and sends back
// what came of it, until the dream is told and remembered.
//
// Bounded, so a TV never waits on a loop: at most `rounds` turns, `asks` questions and `tells`
// tellings (the second only to tell again what was not quite). Every tool call gets an answer: a
// tool that fails, or a call past a limit, answers with an error the guide can work with. If the
// guide stops without telling, or without remembering, it is reminded once.
//
// `tools[name](input)` returns: a string; a plain object (sent as JSON); { image, text } (a
// picture, as a data URL, and a caption); or throws. `onTurn(content)` hears each of the guide's
// turns (for the screen: what it is doing).
//
// A head start: the guide can begin while the painting is still coming back to be marked, so its
// first look happens while they mark, not after. Then `later` is a promise of what they marked, as
// text (null if they went back to the paper): the first turn goes at once, and the next waits for
// it and carries it after the first turn's results. A telling before it has come is sent back once
// with it, so nothing is told without how it felt to them; a question waits for it, then is asked.

const REMIND_TELL = 'Tell it now, with tell.';
// the guide's tools, and only these: anything else on `tools` (what it keeps of the night, how it
// is briefed) is the TV's own, never the guide's to call
export const TOOL_NAMES = ['look', 'strokes', 'recall', 'thing', 'night', 'ask', 'tell', 'remember'];
const REMIND_REMEMBER = 'Now keep what this painting added, with remember.';
const FELT_FIRST = 'How it felt to them has just come in (below): tell it with that.';
const LEFT = 'They went back to the paper before it was told.';

function asResult(id, out) {
  if (out && typeof out === 'object' && typeof out.image === 'string') {
    const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(out.image);
    const content = [];
    if (m) content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
    if (out.text) content.push({ type: 'text', text: String(out.text) });
    return { type: 'tool_result', tool_use_id: id, content: content.length ? content : 'nothing to see' };
  }
  return { type: 'tool_result', tool_use_id: id, content: typeof out === 'string' ? out : JSON.stringify(out ?? null) };
}
const failed = (id, message) => ({ type: 'tool_result', tool_use_id: id, content: String(message).slice(0, 500), is_error: true });

// Its closing line, shown in their world as they come back to it: never a goodnight, whatever the
// model says (they may be painting at any time of day), so a sentence that says one is left out
const BEDTIME = /\b(good ?night|night night|sleep (well|tight)|sweet dreams|time for bed|off to bed)\b/i;
export function closingOf(text) {
  const kept = (String(text).match(/[^.!?]+[.!?]*/g) || []).map((x) => x.trim()).filter((x) => x && !BEDTIME.test(x)).join(' ');
  return kept ? kept.slice(0, 200) : null;
}
// `stop()` ends the loop between turns (when they have gone back to the paper before it was told).
export async function runGuide({ ai, first, tools, limits = {}, onTurn = () => {}, stop = () => false, later = null }) {
  const L = { rounds: 14, asks: 2, tells: 2, ...limits };
  const messages = [{ role: 'user', content: first }];
  const used = { ask: 0, tell: 0 };
  let told = false, kept = null, goodnight = null, reminded = { tell: false, remember: false };
  // the head start: what they marked, once it has come (`owed`: still to be sent; `heard`: sent to
  // the guide), and how many of the guide's turns were asked for before it had (`early`)
  let felt = later ? undefined : null, owed = null, heard = !later, early = 0, gone = false, landed = !later;
  if (later) later.then(() => { landed = true; }, () => { landed = true; });
  const arrived = async () => {
    if (felt === undefined) { felt = await later; owed = felt; if (felt == null) gone = true; }
    return felt;
  };
  // what they marked goes with the next turn of the TV's: after the results it answers
  const carry = () => {
    if (!owed) return;
    const m = messages[messages.length - 1];
    m.content = [...(typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content), { type: 'text', text: owed }];
    owed = null;
    heard = true;
  };
  for (let round = 0; round < L.rounds; round++) {
    if (stop() || gone) break;
    if (round > 0) {
      if ((await arrived()) == null && later) break;
      if (stop()) break;
      carry();
    }
    if (!landed) early++;
    const r = await ai.agent({ messages });
    if (!r || !Array.isArray(r.content) || !r.content.length) throw new Error('the guide sent nothing');
    if (r.stop_reason === 'refusal') throw new Error('the guide would not tell this one');
    messages.push({ role: 'assistant', content: r.content });
    onTurn(r.content);
    const calls = r.content.filter((b) => b.type === 'tool_use');
    if (!calls.length) {
      const text = r.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
      if (!told && !reminded.tell) { reminded.tell = true; messages.push({ role: 'user', content: REMIND_TELL }); continue; }
      if (told && !kept && !reminded.remember) { reminded.remember = true; messages.push({ role: 'user', content: REMIND_REMEMBER }); continue; }
      goodnight = kept && text ? closingOf(text) : null;
      break;
    }
    if (r.stop_reason === 'max_tokens') {
      // a call cut short is never carried out
      messages.push({ role: 'user', content: calls.map((c) => failed(c.id, 'Your turn was cut short; make that call again, more briefly.')) });
      continue;
    }
    const results = [];
    for (const c of calls) {
      const tool = TOOL_NAMES.includes(c.name) && typeof tools[c.name] === 'function' ? tools[c.name] : null;
      if (!tool) { results.push(failed(c.id, `There is no ${c.name} tool.`)); continue; }
      if (c.name === 'ask' && used.ask >= L.asks) { results.push(failed(c.id, 'You have asked enough: tell it.')); continue; }
      if (c.name === 'tell' && used.tell >= L.tells) { results.push(failed(c.id, 'It has been told, and told again: remember what they kept.')); continue; }
      if (c.name === 'remember' && !told) { results.push(failed(c.id, 'Tell it first; remember after.')); continue; }
      // asked for before the guide heard how it felt: a question waits for it; a telling goes back with it
      if ((c.name === 'ask' || c.name === 'tell') && !heard) {
        if ((await arrived()) == null) { results.push(failed(c.id, LEFT)); continue; }
        if (c.name === 'tell') { results.push(failed(c.id, FELT_FIRST)); continue; }
      }
      if (gone) { results.push(failed(c.id, LEFT)); continue; }
      try {
        const out = await tool(c.input || {});
        if (c.name === 'ask') used.ask++;
        if (c.name === 'tell') { used.tell++; told = true; }
        if (c.name === 'remember') kept = out;
        results.push(asResult(c.id, out));
      } catch (err) {
        results.push(failed(c.id, err && err.message ? err.message : 'That did not work.'));
      }
    }
    messages.push({ role: 'user', content: results });
  }
  return { told, kept, goodnight, early, rounds: messages.filter((m) => m.role === 'assistant').length, messages };
}

// what the guide is doing, for the screen, from its tool calls
export function stepOf(content) {
  const c = (content || []).find((b) => b.type === 'tool_use');
  if (!c) return null;
  const i = c.input || {};
  const marks = (ns) => (Array.isArray(ns) && ns.length ? (ns.length === 1 ? `mark ${ns[0]}` : `marks ${ns.slice(0, 3).join(', ')}`) : 'the painting');
  switch (c.name) {
    case 'look': return i.night ? `Looking at chapter ${i.night}'s painting` : i.after ? `Looking at how it began, up to mark ${i.after}` : `Looking closer at ${marks(i.strokes)}`;
    case 'strokes': return `Reading how you painted ${marks(i.strokes)}`;
    case 'recall': return 'Remembering your world so far';
    case 'thing': return 'Remembering something from before';
    case 'night': return `Remembering chapter ${i.night}`;
    case 'remember': return 'Keeping it in your world';
    default: return null;
  }
}
