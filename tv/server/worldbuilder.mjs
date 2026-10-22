// The Worldbuilder, one of the TV's agents, beside the storyteller: between paintings it helps a
// world grow. Shown what is in the world (engine/dreams/wonder.mjs wonderBrief), it asks one
// question about one thing in it that opens it up, with a few answers to choose from; what they
// choose is kept as true of that thing. The answers are held to the world in code (checkWonder):
// about a thing that is there, not asked before, and for a child nothing frightening.
//
// `claude.messages.create(params)` is the Messages API, as for the storyteller; `standInWonder`
// answers in its place for the dev server and the tests.

import { checkWonder, WONDER } from './engine/dreams/index.mjs';
import { BadRequest } from './errors.mjs';

export const WONDER_SYSTEM = `You are the Worldbuilder of one person's imagined world, kept on their TV in Inkwash. They paint their world a piece at a time with the TV remote, and a storyteller tells each painting back. Between paintings, you help their world grow.

You are shown what is in their world: its things (each with an id, what it is, how many nights it has come, what is true of it, and what is still unresolved), the titles of the last nights, and the questions asked before.

Ask ONE question about ONE thing already in their world that opens it up: where it leads, who lives there, what it is for, what is beyond it, what it is waiting for. Give three answers they might choose, each a different direction the world could go, each building on what is already true. They may choose one, paint their own answer instead, or let it be.

- Ask about a thing they made, by its id. Prefer something unresolved, or something that keeps coming back.
- Never contradict what is already true, and never decide for them: the answers are possibilities.
- Never ask a question that was asked before.
- Plain, vivid words. The question under 12 words. Each answer's "say" under 7 words; its "fact" one sentence to keep as true of that thing, naming it, said as it would be to them: you and your, never I, my, we or our.
- Nothing cruel or gruesome.

Reply with JSON only: {"about": "<thing id>", "question": "...", "choices": [{"say": "...", "fact": "..."}, {"say": "...", "fact": "..."}, {"say": "...", "fact": "..."}]}`;

// for a child, said to the Worldbuilder as well
const YOUNG = 'They are a child. Use words a six-year-old knows. Keep it gentle and friendly: nothing frightening, nothing sad, no one hurt or lost.';

const LIMITS = { things: 12, text: 240, list: 6 };
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// What the TV sends: the brief, bounded (it is shown to the model as data)
export function checkBrief(body) {
  if (!body || typeof body !== 'object' || !body.brief || typeof body.brief !== 'object') throw new BadRequest('expected { brief, young }');
  const b = body.brief;
  const list = (xs, n) => (Array.isArray(xs) ? xs.slice(-LIMITS.list).map((x) => clean(x, n)).filter(Boolean) : []);
  const things = (Array.isArray(b.things) ? b.things : []).slice(0, LIMITS.things).map((t) => ({
    id: clean(t && t.id, 12), name: clean(t && t.name, 60), kind: clean(t && t.kind, 16) || 'thing',
    nights: Math.max(0, Math.min(9999, Math.round(Number(t && t.nights) || 0))), last: Math.max(0, Math.round(Number(t && t.last) || 0)),
    facts: list(t && t.facts, LIMITS.text), open: list(t && t.open, LIMITS.text),
  })).filter((t) => /^e\d+$/.test(t.id) && t.name);
  if (!things.length) throw new BadRequest('their world has nothing in it to wonder about');
  const nights = (Array.isArray(b.nights) ? b.nights : []).slice(-WONDER.nights).map((n) => ({ night: Math.round(Number(n && n.night) || 0), title: clean(n && n.title, 80) || null }));
  return { brief: { things, nights, asked: list(b.asked, WONDER.question + 20) }, young: body.young === true };
}

export function wonderRequest(brief, { model, young = false }) {
  return {
    model, max_tokens: 500,
    system: young ? `${WONDER_SYSTEM}\n\n${YOUNG}` : WONDER_SYSTEM,
    messages: [{ role: 'user', content: `THEIR WORLD\n${JSON.stringify(brief)}\n\nAsk one question about it.` }],
  };
}

const jsonOf = (text) => { const m = /\{[\s\S]*\}/.exec(String(text || '')); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };
const textOf = (r) => (r && Array.isArray(r.content) ? r.content.filter((b) => b.type === 'text').map((b) => b.text).join('') : '');

// Returns { status, json }: { about, name, question, choices } held to their world, asked again
// once with why if the first answer wasn't; or 502
export async function wonder(body, { claude, model, log = () => {} }) {
  const { brief, young } = checkBrief(body);
  const params = wonderRequest(brief, { model, young });
  let r = checkWonder(jsonOf(textOf(await claude.messages.create(params))), brief, { young });
  if (!r.ok) {
    // sent back once, with why
    log(`the Worldbuilder, sent back: ${r.why}`);
    const again = { ...params, messages: [{ role: 'user', content: `${params.messages[0].content}\n\n(An earlier answer couldn't be shown: ${r.why}.)` }] };
    r = checkWonder(jsonOf(textOf(await claude.messages.create(again))), brief, { young });
  }
  if (!r.ok) return { status: 502, json: { error: 'the Worldbuilder had nothing to ask' } };
  return { status: 200, json: r.wonder };
}

// A stand-in for the model, for the dev server and the tests: about the thing most often there,
// what it might lead to, three ways
export function standInWonder(params) {
  const text = params.messages[params.messages.length - 1].content;
  const brief = jsonOf(String(text).replace(/^THEIR WORLD\n/, '').split('\n\n')[0]) || { things: [] };
  const asked = new Set((brief.asked || []).map((q) => q.toLowerCase()));
  const things = [...(brief.things || [])].sort((a, b) => b.nights - a.nights);
  for (const t of things) {
    const name = t.name, Name = name.charAt(0).toUpperCase() + name.slice(1);
    // two questions a thing, each asked once
    const asks = t.kind === 'place'
      ? [[`Who lives in ${name}?`, [['A family of lanterns', `${Name} is home to a family of lanterns.`], ['An old ferryman', `An old ferryman lives in ${name}.`], ['No one, yet', `No one lives in ${name} yet.`]]],
        [`What grows in ${name}?`, [['Silver reeds', `Silver reeds grow in ${name}.`], ['Moss that glows', `Moss that glows grows in ${name}.`], ['Nothing, yet', `Nothing grows in ${name} yet.`]]]]
      : [[`Where does ${name} go?`, [['To an island of lanterns', `${Name} goes to an island of lanterns.`], ['Under the sea', `${Name} goes down under the sea.`], ['Up to the moon', `${Name} goes all the way up to the moon.`]]],
        [`Who rides ${name}?`, [['A girl with a lantern', `A girl with a lantern rides ${name}.`], ['A sleepy cat', `A sleepy cat rides ${name}.`], ['No one at all', `No one rides ${name}.`]]]];
    const ask = asks.find(([q]) => !asked.has(q.toLowerCase()));
    if (!ask) continue;
    return { content: [{ type: 'text', text: JSON.stringify({ about: t.id, question: ask[0], choices: ask[1].map(([say, fact]) => ({ say, fact })) }) }], stop_reason: 'end_turn' };
  }
  return { content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn' };
}
