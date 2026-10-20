// A stand-in for Claude as the guide's agent, for the dev server and the tests: no calls, no
// cost. It is a script, not a model. It reads the TV's first message and the tool results so far,
// and takes the next step a guide would: while they are still marking how it felt (a head start),
// remember their world; then look closer at the mark where their feeling turned;
// if a mark looks like something from an earlier night, read about that thing and look at the
// earlier mark; ask (whether it is the same thing, or what the mark was); tell, from their words,
// their answer and how they painted (with an alternative for a line of its own, which the TV
// weighs); if the telling is sent back, tell it again from what is theirs; tell the lines that
// were "not quite" once more; remember; say goodnight. When it is told a child is painting
// (AGENT_YOUNG), it asks and tells as simply as that asks, but its first telling brings in a
// monster, and closer, as a model might, for the TV to send back. Given what they painted next (WHAT HAPPENS NEXT), it
// looks at the ending's strokes, asks what came, carries the story on with it (the new line only:
// the TV tells it after the story so far), keeps what came, and settles what the night left open. Something
// visiting from another painter's world (VISITING) comes into its telling by its name, and it
// keeps that too, as a model might, for the TV to leave to its own world.
//
// It answers like the Messages API: { content, stop_reason, model, usage }.
import { AGENT_YOUNG } from './agent.mjs';

const section = (text, name) => {
  const m = new RegExp(`^${name}\\b[^\\n]*\\n(.+)$`, 'm').exec(text);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
};
const textOf = (content) => (typeof content === 'string' ? content : (content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// the calls made so far, with their results
function callsIn(messages) {
  const calls = [];
  messages.forEach((m, i) => {
    if (m.role !== 'assistant') return;
    for (const b of m.content.filter((x) => x.type === 'tool_use')) {
      const r = (messages[i + 1]?.content || []).find((x) => x.type === 'tool_result' && x.tool_use_id === b.id);
      let result = null;
      try { result = r ? JSON.parse(textOf(r.content)) : null; } catch { result = textOf(r && r.content); }
      calls.push({ name: b.name, input: b.input, result, error: !!(r && r.is_error) });
    }
  });
  return calls;
}

const SCENES = ['Someone walked the low shore at dusk.', 'The tide drew the light away.', 'Out on the water, something waited.', 'Then everything was still.'];
const SCENES_YOUNG = ['A little boat sat on the water.', 'The moon watched over it.', 'Someone kind was close by.', 'Then everything was quiet.'];
// a line for how a mark was painted, by what stood out in it, carried into the dream as what happens
const GESTURE_LINES = {
  hesitated: 'The water lay empty and still, and then it came.',
  held: 'It stayed there, and would not move.',
  pressed: 'It came down hard here, and the shore held.',
  light: 'It was so faint here it was nearly not there.',
  slow: 'It came slowly, the way the tide comes in.',
  quick: 'It came quickly, and was gone.',
  redrawn: 'It came twice, and the second time it stayed.',
  returned: 'It came back again, to be sure it was there.',
};

export function standInAgent(params) {
  const messages = params.messages;
  const young = Array.isArray(params.system) && params.system.some((b) => b.text === AGENT_YOUNG);
  const TITLE = young ? 'The Little Boat' : 'The Low Shore';
  const first = textOf(messages[0].content);
  // with a head start, how it felt and where it turned come later, in a message of their own (with
  // anything they said while it came back); until then it remembers their world
  const marked = messages.slice(1).filter((m) => m.role === 'user').map((m) => textOf(m.content)).find((t) => /^TURN\b/m.test(t)) || null;
  const waiting = /^FEELING \(still coming/m.test(first) && !marked;
  const strokes = section(first, 'STROKES') || [];
  const turn = section(marked || first, 'TURN') || {};
  const words = [...(section(first, 'THEIR WORDS') || []), ...((marked && section(marked, 'THEIR WORDS')) || [])];
  const world = section(first, 'THEIR WORLD') || {};
  const painted = (section(first, 'HOW THEY PAINTED IT') || {}).notable || [];
  const hint = (world.hints || [])[0] || null;
  const calls = callsIn(messages);
  const did = (name, f = () => true) => calls.some((c) => c.name === name && f(c));
  let n = 0;
  const use = (name, input, say = null) => ({
    content: [...(say ? [{ type: 'text', text: say }] : []), { type: 'tool_use', id: `toolu_standin_${messages.length}_${n++}`, name, input }],
    stop_reason: 'tool_use',
  });
  const reply = (r) => ({ model: params.model, usage: { input_tokens: Math.ceil(JSON.stringify(messages).length / 3.6), output_tokens: 120 }, ...r });

  const ending = section(first, 'WHAT HAPPENS NEXT');
  if (ending) {
    const fresh = ending.new_strokes || [];
    if (!did('look')) return reply(use('look', { strokes: fresh, zoom: true }));
    if (!did('ask')) return reply(use('ask', young ? { question: 'What happened next?', choices: ['a boat', 'the sun', 'a friend'], strokes: fresh } : { question: 'What happens next?', choices: ['a lantern', 'a bridge', 'someone kind'], strokes: fresh }));
    const asked = calls.find((c) => c.name === 'ask');
    const came = asked && asked.result && typeof asked.result === 'object' ? asked.result.answer : null;
    const last = { text: came ? `Then ${came} was there${young ? ', just as you drew it' : ''}.` : 'Then it went on the way you drew it.', strokes: fresh };
    const tells = calls.filter((c) => c.name === 'tell');
    if (!tells.some((c) => !c.error)) return reply(use('tell', { title: ending.told.title, lines: [last] }));
    if (!did('remember')) {
      const open = (world.open || []).filter((o) => o.since === ending.night).map((o) => o.id);
      return reply(use('remember', { things: came ? [{ name: came, kind: 'thing', strokes: fresh, why: 'they painted it next' }] : [], facts: [], resolved: open }));
    }
    return reply({ content: [{ type: 'text', text: young ? 'See you next time.' : 'Until next time.' }], stop_reason: 'end_turn' });
  }
  if (waiting && !did('recall')) return reply(use('recall', { query: 'what this painting might carry on' }));
  const at = turn.stroke || (strokes[0] && strokes[0].n) || 1;
  if (!did('look')) return reply(use('look', { strokes: [at], zoom: true }));
  if (hint && !did('thing')) return reply(use('thing', { id: hint.looks_like }));
  if (hint && hint.came_before_as && !did('look', (c) => c.input.night)) return reply(use('look', { night: hint.came_before_as.night, strokes: hint.came_before_as.strokes, zoom: true }));
  // their words as the story says them, to them
  const spoken = (k) => { const w = words.find((x) => x.n === k); return w && { ...w, text: w.as_you || w.text }; };
  if (!did('ask')) {
    if (hint) return reply(use('ask', { question: `Is this ${hint.name} again?`, choices: ['Yes, the same', 'No, something else'], strokes: [hint.stroke], ...(hint.came_before_as ? { show: { night: hint.came_before_as.night, strokes: hint.came_before_as.strokes } } : {}) }));
    // a child's, with something already in their world among the answers, if there is something
    if (young) return reply(use('ask', { question: 'What was this?', choices: ['a boat', 'a big fish', ((world.things || [])[0] || {}).name || 'a cloud'], strokes: [at] }));
    return reply(use('ask', { question: 'What was this, in your dream?', choices: ['a locked gate', 'the night ferry', 'someone waiting'], strokes: [at] }));
  }
  const asked = calls.find((c) => c.name === 'ask');
  const answer = asked && asked.result && typeof asked.result === 'object' ? asked.result.answer : null;
  const same = !!hint && !!answer && /^yes/i.test(answer);
  const named = same ? hint.name : answer && !/^no\b/i.test(answer) ? answer : null;
  const about = same ? hint.stroke : at;
  // what they named, as the story says it to them (their "my boat" is "your boat")
  const saidAs = !same && named && asked.result.as_you ? asked.result.as_you : named;
  // one line a stroke, at most five; their words first, what they named at its mark, then how
  // they painted it; a line of its own otherwise, with another way to say it
  const tells = calls.filter((c) => c.name === 'tell');
  const lineFor = (s, i) => {
    const w = spoken(s.n);
    // a child's first telling brings in a monster, and brings it closer: the TV sends it back
    if (s.n === about && named && young) return { text: `${w ? `${cap(w.text)}: ` : 'Here was '}${saidAs}${same ? ', back again' : ''}${tells.length ? ', safe on the water.' : ', and a monster swam closer and closer.'}` };
    if (s.n === about && named) {
      const at = `${w ? `${cap(w.text)}: ` : 'Where it changed, '}${saidAs}${same ? ' came back' : ''}`;
      return { text: `${at}, and the sea came in.`, alt: `${at}, at the end of the pier.` };
    }
    // their words, and another way to say them: heard at once if they say not quite
    if (w) return { text: `${cap(w.text)}, as you said.`, alt: `${cap(w.text)}.` };
    const g = painted.find((x) => x.stroke === s.n);
    if (g && GESTURE_LINES[g.kind]) return { text: GESTURE_LINES[g.kind] };
    if (young) return { text: SCENES_YOUNG[i % SCENES_YOUNG.length], own: true };
    return { text: SCENES[i % SCENES.length], alt: 'It meant the day was ending.', own: true };
  };
  const lines = strokes.slice(0, 5).map((s, i) => ({ ...lineFor(s, i), strokes: [s.n] }));
  // one stroke is still a dream of two lines or more: how it ended, too
  if (lines.length === 1) lines.push({ text: young ? 'Then everything was quiet.' : 'Then everything was still.', strokes: lines[0].strokes, own: true });
  // something visiting from another world on this TV comes into the story, by its name
  const visiting = section(first, 'VISITING') || [];
  if (visiting.length) lines.splice(Math.min(lines.length, 4), lines.length >= 5 ? 1 : 0, { text: `${cap(visiting[0].name)} came to visit${young ? ', and was glad to be there' : ''}.`, strokes: lines[lines.length - 1].strokes });
  const asSent = (ls) => ls.map(({ own, ...l }) => l);
  const told = tells.filter((c) => !c.error);
  if (!told.length) {
    if (!tells.length) return reply(use('tell', { title: TITLE, lines: asSent(lines) }));
    // sent back: what is theirs, and one line of its own
    const keep = lines.filter((l, i) => !l.own || i === lines.findIndex((x) => x.own));
    return reply(use('tell', { title: TITLE, lines: asSent(keep) }));
  }
  const last = told[told.length - 1].result;
  const heard = (k) => ((last && last.told_the_alt) || []).find((a) => a.line === k);
  const notQuite = last && Array.isArray(last.reactions) ? last.reactions.filter((r) => r.said === 'no').map((r) => r.line) : [];
  if (notQuite.length && told.length === 1) {
    const first = told[0].input.lines;
    const said = (k) => (heard(k) ? heard(k).told : first[k - 1] ? first[k - 1].text : 'it was there');
    return reply(use('tell', { title: TITLE, lines: notQuite.map((k) => ({ text: `Again, more quietly: ${said(k).charAt(0).toLowerCase() + said(k).slice(1)}`, strokes: first[k - 1] ? first[k - 1].strokes : [] })) }));
  }
  if (!did('remember')) {
    const things = named ? [same ? { id: hint.looks_like, strokes: [about], why: 'it waited, out of reach' } : { name: named, kind: 'thing', strokes: [about] }] : [];
    // as a model might, it keeps the visitor too: the TV leaves it to its own world
    if (visiting.length) things.push({ name: visiting[0].name, kind: 'thing', strokes: [at] });
    const facts = named && !same ? [{ about: named, text: 'It waited at the end of the pier.', open: true }] : [];
    return reply(use('remember', { things, facts, resolved: [], notes: ['Their own words, kept plain, land best.'] }));
  }
  return reply({ content: [{ type: 'text', text: young ? 'See you next time.' : 'Until next time.' }], stop_reason: 'end_turn' });
}
