// The Worldbuilder: between paintings, it helps a world grow. It is shown what is in the world (the
// things in it, what is true of them, what is still unresolved) and asks one question about one of
// those things that opens it up (where it leads, who lives there, what it is for, what is beyond
// it), with a few answers to choose from, each a different way the world could go. They choose one,
// paint their own answer, or let it be. What they choose is kept as true of that thing (world.mjs
// wondered), and the storyteller tells their world with it from then on.
//
// Here: what the Worldbuilder is shown (wonderBrief), and what it may answer (checkWonder). The
// model call itself is the guide service's (server/worldbuilder.mjs). Pure.

import { frightIn } from './gentle.mjs';
import { toSecondPerson } from './ground.mjs';

export const WONDER = { things: 10, facts: 3, open: 2, nights: 3, asked: 8, choices: [2, 4], question: 110, say: 60, fact: 180 };

const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const words = (s) => (String(s || '').match(/[\p{L}\p{N}']+/gu) || []).length;

// What the Worldbuilder is shown: the things in their world, the latest and the most often there
// first, each with what is true of it and what is still unresolved; the last nights' titles; and
// the questions asked before, so it doesn't ask them again. `S`: a world's JSON.
export function wonderBrief(S, { now = Date.now() } = {}) {
  const facts = (Array.isArray(S.facts) ? S.facts : []).filter((f) => f && typeof f === 'object');
  const live = (Array.isArray(S.entities) ? S.entities : []).filter((e) => e && typeof e === 'object' && typeof e.name === 'string' && e.status !== 'rejected');
  const seen = (e) => [...(e.appearances || []), ...(e.endings || [])].map((a) => a.night).filter(Number.isFinite);
  const things = live.map((e) => {
    const ns = seen(e);
    const mine = facts.filter((f) => f.entity === e.id && f.to == null);
    return {
      id: e.id, name: e.name, kind: e.kind || 'thing',
      nights: new Set(ns).size, last: ns.length ? Math.max(...ns) : 0,
      facts: mine.filter((f) => !f.thread).slice(-WONDER.facts).map((f) => f.text),
      open: mine.filter((f) => f.thread).slice(-WONDER.open).map((f) => f.text),
    };
  }).filter((t) => t.last).sort((a, b) => b.last - a.last || b.nights - a.nights).slice(0, WONDER.things);
  return {
    things,
    nights: (Array.isArray(S.nights) ? S.nights : []).filter((n) => n && typeof n === 'object').slice(-WONDER.nights).map((n) => ({ night: n.n, title: n.title || null })),
    asked: (Array.isArray(S.wonders) ? S.wonders : []).filter((w) => w && typeof w.question === 'string').slice(-WONDER.asked).map((w) => w.question),
    at: new Date(now).toISOString().slice(0, 10),
  };
}

// What the Worldbuilder may answer, made safe to show: a question about a thing that is in the
// brief, short and plain, ending with a question mark, not one asked before; two to four answers,
// each a few words to show and the sentence to keep if chosen (told to them, as "you"), none
// repeated. For a child, nothing frightening they never brought: an answer that brings it in is
// dropped, and a question that does is turned down. Returns { ok, wonder: { about, name, question, choices: [{ say, fact }] } } or
// { ok: false, why }.
export function checkWonder(reply, brief, { young = false } = {}) {
  const r = reply && typeof reply === 'object' ? reply : {};
  const thing = (brief.things || []).find((t) => t.id === r.about);
  if (!thing) return { ok: false, why: 'about must be one of the things in their world, by its id' };
  const question = clip(r.question, WONDER.question);
  if (words(question) < 3 || !question.endsWith('?')) return { ok: false, why: 'the question must be a short question' };
  const before = new Set((brief.asked || []).map((q) => clip(q, WONDER.question).toLowerCase()));
  if (before.has(question.toLowerCase())) return { ok: false, why: 'that question was asked before' };
  // what is theirs already: a frightening word they brought themselves may come back
  const ctx = { things: (brief.things || []).map((t) => ({ name: t.name, aliases: [] })), confirmed: (brief.things || []).flatMap((t) => [...t.facts, ...t.open]) };
  const fright = young ? frightIn(question, ctx) : [];
  if (fright.length) return { ok: false, why: `the question brings in something frightening ("${fright[0]}"), which they never brought` };
  const seen = new Set();
  // what is kept is kept as it is said to them: "your grandmother", never "my grandmother"
  const choices = (Array.isArray(r.choices) ? r.choices : []).map((c) => ({ say: clip(c && c.say, WONDER.say), fact: clip(toSecondPerson(c && c.fact, ctx), WONDER.fact) }))
    .filter((c) => words(c.say) >= 1 && words(c.fact) >= 3)
    .filter((c) => !young || (!frightIn(c.say, ctx).length && !frightIn(c.fact, ctx).length))
    .filter((c) => { const k = c.say.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, WONDER.choices[1]);
  if (choices.length < WONDER.choices[0]) return { ok: false, why: `two to four answers, each with a short "say" and a "fact" to keep` };
  return { ok: true, wonder: { about: thing.id, name: thing.name, question, choices } };
}
