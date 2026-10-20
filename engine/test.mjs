// Engine v1 tests, on a small world written by hand.
//
//   node --test inkwash/engine/test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from './index.mjs';
import { createNameIndex } from './names.mjs';
import { holdersAt, aliveAt } from './time.mjs';
import { createGateway, priceTable, costOf } from './gateway/gateway.mjs';
import { fakeProvider } from './gateway/providers.mjs';
import { memorySink, rollup, hasher } from './gateway/telemetry.mjs';
import { parseJSON } from './gateway/verify.mjs';

const world = {
  chapters: Array.from({ length: 10 }, (_, i) => ({ ordinal: i + 1 })),
  entities: [
    { id: 'mara', kind: 'character', name: 'Mara Vell', aliases: ['the Grey Widow'], pronoun: 'she' },
    { id: 'tomas', kind: 'character', name: 'Tomas Vell', aliases: [], pronoun: 'he' },
    { id: 'ilse', kind: 'character', name: 'Ilse Vell', aliases: [], pronoun: 'she' },
    { id: 'oren', kind: 'character', name: 'Oren Daal', aliases: [], pronoun: 'he' },
    { id: 'salt', kind: 'place', name: 'Salt Reach', aliases: [] },
    { id: 'harrow', kind: 'place', name: 'Harrow Gate', aliases: [] },
    { id: 'order', kind: 'faction', name: 'the Lantern Order', aliases: ['the Order'] },
    { id: 'key', kind: 'thing', name: 'the Brass Key', aliases: [] },
    { id: 'law', kind: 'rule', name: 'The tide-bell law of Salt Reach', aliases: [] },
  ],
  facts: [
    { id: 'f1', entity: 'mara', text: 'Mara Vell is a sworn member of the Lantern Order.' },
    { id: 'f2', entity: 'mara', text: 'Mara Vell keeps the seal of the Lantern Order.' },
    { id: 'f3', entity: 'mara', text: 'Mara Vell is the sister of Tomas Vell.' },
    { id: 'f4', entity: 'tomas', text: 'Tomas Vell cannot swim.' },
    { id: 'f5', entity: 'oren', text: 'Oren Daal rules Salt Reach.', to: 5 },
    { id: 'f6', entity: 'tomas', text: 'Tomas Vell rules Salt Reach.', from: 5 },
    { id: 'f7', entity: 'law', text: 'No lamp may burn in Salt Reach after the tide bell.' },
    { id: 'f8', entity: 'ilse', text: 'Ilse Vell drowned off the coast of Harrow Gate.', from: 3 },
    { id: 'f9', entity: 'mara', text: 'the Brass Key is carried by Mara Vell.' },
    { id: 'f10', entity: 'oren', text: 'Oren Daal burned the granary at Harrow Gate.', from: 2 },
    { id: 'f11', entity: 'oren', text: 'Oren Daal is left-handed.' },
    { id: 'f12', entity: 'mara', text: 'Mara Vell lives in Salt Reach.' },
  ].map((f) => ({ from: null, to: null, secretUntil: null, ...f })),
  passages: [
    { id: 'p1', chapter: 2, cast: ['mara'], text: 'Mara stayed on the jetty. Her brother waded out to the boat.', premises: [{ f: 'f3' }] },
    { id: 'p2', chapter: 6, cast: ['mara'], text: 'The lord of Salt Reach heard petitions in the great hall.', premises: [] },
    { id: 'p3', chapter: 4, cast: ['oren'], text: 'Oren had not been back to Harrow Gate since the granary burned.', premises: [{ f: 'f10' }] },
    { id: 'p4', chapter: 7, cast: ['mara', 'ilse'], text: 'Ilse laughed and poured the wine.', premises: [] },
    { id: 'p5', chapter: 3, cast: ['oren'], text: 'Oren drew the knife with his left hand. When the tide bell rang, Salt Reach went dark.', premises: [{ f: 'f11' }] },
    { id: 'p6', chapter: 4, cast: ['mara'], text: 'The lord of Salt Reach watched the Grey Widow pin the badge of the Lantern Order to her collar.', premises: [{ f: 'f1' }, { f: 'f5' }] },
  ],
};
const E = createEngine(world);

test('names: full names in any case, aliases and name parts only as written, longest first', () => {
  const N = createNameIndex(world.entities);
  const find = (t) => N.findText(t).mentions.map((m) => m.ids.join('|'));
  assert.deepEqual(find('salt reach was quiet'), ['salt']);
  assert.deepEqual(find('the Order met; his left order was ignored'), ['order']);
  assert.deepEqual(find("Mara's brother"), ['mara']);
  assert.ok(N.findText("Mara's brother").mentions[0].poss);
  assert.deepEqual(find('Vell'), ['mara|tomas|ilse'], 'a surname is everyone who has it');
});

test('the world model: who rules when, who has what, who died, who is kin', () => {
  const W = E.world;
  assert.deepEqual(holdersAt(W, 'salt', 'rule', 3).map((t) => t.person), ['oren']);
  assert.deepEqual(holdersAt(W, 'salt', 'rule', 6).map((t) => t.person), ['tomas']);
  assert.deepEqual(holdersAt(W, 'key', 'possess', 1).map((t) => t.person), ['mara']);
  assert.equal(aliveAt(W, 'ilse', 2), true);
  assert.equal(aliveAt(W, 'ilse', 3), false);
  assert.ok(W.kin.get('mara').get('tomas').stated);
  assert.ok(!W.kin.get('mara').get('ilse').stated, 'a shared surname is kin, but weaker');
});

test('a run of terms is found by story time even without a word for it', () => {
  const w = structuredClone(world);
  w.facts.find((f) => f.id === 'f5').text = 'Salt Reach answers to Oren Daal.';
  w.facts.find((f) => f.id === 'f6').text = 'Salt Reach answers to Tomas Vell.';
  const e = createEngine(w);
  assert.deepEqual(holdersAt(e.world, 'salt', 'rule', 6).map((t) => t.person), ['tomas']);
});

test('resolving: pronouns, relations and titles', () => {
  const r1 = E.resolve('Mara stayed on the jetty. Her brother waded out to the boat.', { chapter: 2, cast: ['mara'] });
  assert.ok(r1.ents.get('tomas').how.has('relation'));
  const at6 = E.resolve('The lord of Salt Reach heard petitions.', { chapter: 6 });
  assert.ok(at6.ents.get('tomas').how.has('title'));
  assert.ok(!at6.ents.has('oren'));
  const at3 = E.resolve('The lord of Salt Reach heard petitions.', { chapter: 3 });
  assert.ok(at3.ents.get('oren').how.has('title'));
  const gate = E.resolve('The gate of Salt Reach was shut.', { chapter: 3 });
  assert.ok(gate.ents.get('oren').w < 0.5, 'any other "the <noun> of <place>" counts only weakly');
  const p = E.resolve('Oren came in. He drew the knife with his left hand.', { chapter: 3 });
  assert.ok(p.ents.get('oren').how.has('pronoun'));
});

test('a check: the facts the passage relies on come first, the law of the place included', () => {
  const ws = E.workingSet({ type: 'check', passage: 'p5' });
  const top = ws.facts.slice(0, 5);
  assert.ok(top.includes('f11'), 'left-handed');
  assert.ok(top.includes('f7'), 'the law of the place');
  const p6 = E.workingSet({ type: 'check', passage: 'p6' }).facts.slice(0, 5);
  assert.ok(p6.includes('f5') && p6.includes('f1'), 'the lord then, and the membership');
});

test('a draft puts what is true now first, and what is not true then last', () => {
  const ws = E.workingSet({ type: 'draft', chapter: 6, cast: ['mara', 'tomas'], notes: 'Mara and Tomas meet in Salt Reach.' });
  assert.ok(ws.facts.indexOf('f6') < ws.facts.indexOf('f5'), 'the ruler in chapter 6 before the one before');
  assert.equal(ws.facts.at(-1) === 'f5' || ws.facts.indexOf('f5') > ws.facts.length - 4, true);
});

test('a budget cuts the working set and the manifest says what went', () => {
  const ws = E.workingSet({ type: 'check', passage: 'p6' }, { budget: 40 });
  assert.ok(ws.manifest.cut.tokens <= 40);
  assert.ok(ws.manifest.cut.dropped > 0);
  assert.equal(ws.lines.length, ws.facts.length);
  assert.ok(ws.manifest.entities.some((e) => e.id === 'oren' && e.how.includes('title')));
});

test('a draft keeps a secret back until its reveal, and carries only the author\'s hints for it', () => {
  const w = structuredClone(world);
  Object.assign(w.facts.find((f) => f.id === 'f3'), { secretUntil: 8, hints: ['Tomas Vell knows the lullaby Mara Vell hums.', 'Mara Vell and Tomas Vell are never romantic.'] });
  const e = createEngine(w);
  const op = (chapter) => ({ type: 'draft', chapter, cast: ['mara', 'tomas'], notes: 'Mara and Tomas meet in Salt Reach.' });
  const before = e.workingSet(op(6), { budget: 2000 });
  assert.ok(!before.facts.includes('f3'), 'the secret stays out of the draft');
  assert.ok(!before.lines.some((l) => /sister/.test(l)), 'and no line carries it');
  assert.deepEqual(before.hints, ['Mara Vell: Tomas Vell knows the lullaby Mara Vell hums.', 'Mara Vell: Mara Vell and Tomas Vell are never romantic.']);
  assert.deepEqual(before.manifest.withheld, [{ id: 'f3', until: 8, hints: 2 }]);
  assert.equal(before.manifest.cut.hintsKept, 2);
  const at = e.workingSet(op(8), { budget: 2000 });
  assert.ok(at.facts.includes('f3'), 'from its reveal chapter it is an ordinary fact');
  assert.deepEqual(at.hints, []);
  assert.equal(at.manifest.withheld, undefined);
  // a check still sees it: a passage that lets it slip is what the check is for
  assert.ok(e.workingSet({ type: 'check', passage: 'p1' }).facts.includes('f3'));
  delete w.facts.find((f) => f.id === 'f3').hints;
  const bare = createEngine(w).workingSet(op(6));
  assert.ok(!bare.facts.includes('f3') && bare.hints.length === 0, 'a secret with no hints is simply kept back');
});

test('impact: a membership edit reaches the role that depends on it', () => {
  const r = E.impact({ fact: 'f1', after: 'Mara Vell is a sworn member of the Salt Guild.' });
  assert.ok(r.facts.includes('f2'));
  assert.ok(!r.facts.includes('f12'), 'living in Salt Reach does not depend on the Order');
  assert.ok(r.passages.includes('p6'));
});

test('impact: moving an event later reaches only the passages that recall it too soon', () => {
  const r = E.impact({ fact: 'f10', after: 'Oren Daal burned the granary at Harrow Gate.', from: 5 });
  assert.deepEqual(r.passages, ['p3']);
  const later = E.impact({ fact: 'f10', after: 'Oren Daal burned the granary at Harrow Gate.', from: 3 });
  assert.deepEqual(later.passages, [], 'chapter 4 still comes after chapter 3');
});

test('impact: a reign cut short reaches the next reign and the passages past the new end', () => {
  const r = E.impact({ fact: 'f5', after: 'Oren Daal rules Salt Reach.', to: 3 });
  assert.ok(r.facts.includes('f6'));
  assert.deepEqual(r.passages, ['p6']);
});

test('impact: a new death reaches the dead one\'s holdings and every later passage they are in', () => {
  const r = E.impact({ add: { entity: 'tomas', text: 'Tomas Vell drowned in the flood.', from: 6 } });
  assert.ok(r.facts.includes('f6'));
  assert.deepEqual(r.passages, ['p2'], 'named only by title, in chapter 6');
});

// ---------------------------------------------------------------- the gateway

const prices = priceTable({ models: [
  { provider: 'fake', model: 'cheap', input: 1, output: 5, effective: '2026-01-01' },
  { provider: 'fake', model: 'big', input: 4, output: 20, effective: '2026-01-01' },
] });
const route = (model, extra = {}) => ({ provider: 'fake', model, maxTokens: 200, ...extra });
const jsonReq = (extra = {}) => ({
  op: 'check', user: 'u1', world: 'w1', system: 'Check the passage.', prompt: 'F1: Mara cannot swim. Passage: Mara swam.',
  expect: 'json', check: (d) => (Array.isArray(d.flags) ? [] : ['flags must be a list']),
  cites: (d) => d.flags.map((x) => x.ref), allowed: new Set(['F1']), drop: (d, bad) => ({ ...d, flags: d.flags.filter((x) => !bad.has(x.ref)) }),
  unsure: (d) => !!d.unsure, context: { lines: ['F1'], worldFacts: 12, worldTokens: 300 }, ...extra,
});

test('the gateway answers, prices the call from the table, and keeps no text in telemetry', async () => {
  const sink = memorySink();
  const seen = [];
  const gw = createGateway({
    providers: { fake: fakeProvider((req) => { seen.push(req); return { text: '```json\n{"flags":[{"ref":"F1"},{"ref":"F9"}]}\n```' }; }) },
    routes: { check: [route('cheap')] }, prices, sink, hash: hasher('salt'), redact: (s) => s.replace('Mara', '[name]'),
  });
  const r = await gw.run(jsonReq());
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.flags.map((x) => x.ref), ['F1'], 'a flag citing what it was not shown is dropped');
  assert.equal(sink.rows[0].verification.dropped, 1);
  assert.ok(r.costUsd > 0);
  assert.ok(seen[0].messages[0].content.includes('[name]'), 'redaction runs on what leaves');
  const row = JSON.stringify(sink.rows);
  assert.ok(!row.includes('swim') && !row.includes('u1') && !row.includes('w1'), 'no text, no raw ids');
  assert.equal(sink.rows[0].contextFacts, 1);
});

test('the gateway escalates when an answer fails or is unsure, and records why', async () => {
  const sink = memorySink();
  const gw = createGateway({
    providers: { fake: fakeProvider((req) => ({ text: req.model === 'cheap' ? 'I think it is fine.' : '{"flags":[]}' })) },
    routes: { check: [route('cheap'), route('big')] }, prices, sink,
  });
  const r = await gw.run(jsonReq());
  assert.equal(r.ok, true);
  assert.deepEqual(sink.rows.map((x) => x.outcome), ['schema', 'ok']);
  assert.equal(sink.rows[0].escalatedTo, 'fake:big');
  const unsure = createGateway({
    providers: { fake: fakeProvider((req) => ({ text: req.model === 'cheap' ? '{"flags":[],"unsure":true}' : '{"flags":[]}' })) },
    routes: { check: [route('cheap'), route('big')] }, prices, sink: memorySink(),
  });
  assert.equal((await unsure.run(jsonReq())).attempts.length, 2);
});

test('caps: a call that could cost too much, or has no price, is not made', async () => {
  let calls = 0;
  const provider = fakeProvider(() => { calls++; return { text: '{"flags":[]}' }; });
  const capped = createGateway({ providers: { fake: provider }, routes: { check: [route('big', { maxTokens: 100000 })] }, prices, caps: { perCallUsd: 0.01 }, sink: memorySink() });
  const r = await capped.run(jsonReq());
  assert.equal(r.ok, false);
  assert.equal(r.attempts[0].outcome, 'cap');
  const unknown = createGateway({ providers: { fake: provider }, routes: { check: [route('mystery')] }, prices, caps: { perDayUsd: 1 }, sink: memorySink() });
  assert.equal((await unknown.run(jsonReq())).attempts[0].outcome, 'cap');
  assert.equal(calls, 0);
  const daily = createGateway({ providers: { fake: provider }, routes: { check: [route('cheap')] }, prices, caps: { perDayUsd: 0.00104 }, sink: memorySink() }); // room for one worst case, not two
  assert.equal((await daily.run(jsonReq())).ok, true);
  assert.equal((await daily.run(jsonReq())).attempts[0].outcome, 'cap', 'the day is spent');
});

test('a call that hangs times out, and the next route is tried', async () => {
  const gw = createGateway({
    providers: { fake: fakeProvider((req) => (req.model === 'cheap' ? new Promise(() => {}) : { text: '{"flags":[]}' })) },
    routes: { check: [route('cheap', { timeoutMs: 30 }), route('big')] }, prices, sink: memorySink(),
  });
  const r = await gw.run(jsonReq());
  assert.equal(r.attempts[0].outcome, 'timeout');
  assert.equal(r.ok, true);
});

test('prices: cache reads and writes at their own rates; rollups by user and operation', () => {
  const p = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 };
  assert.ok(Math.abs(costOf(p, { input: 1e6, cacheRead: 1e6, cacheWrite: 0, output: 1e5 }) - (2 + 0.2 + 1)) < 1e-9);
  assert.equal(costOf({ input: null, output: null }, { input: 1 }), null);
  const rows = [
    { ts: '2026-10-05T00:00:00Z', user: 'a', op: 'check', costUsd: 0.01, ms: 100, outcome: 'ok', tokens: { input: 10, output: 5 } },
    { ts: '2026-10-05T00:00:01Z', user: 'a', op: 'check', costUsd: 0.03, ms: 300, outcome: 'ok', tokens: { input: 10, output: 5 } },
    { ts: '2026-10-05T00:00:02Z', user: 'b', op: 'impact', costUsd: 0.05, ms: 200, outcome: 'schema', tokens: { input: 10, output: 5 } },
  ];
  const r = rollup(rows);
  assert.equal(r.users.find((u) => u.user === 'a').usd.toFixed(2), '0.04');
  assert.equal(r.ops.find((o) => o.op === 'check').calls, 2);
});

test('reading JSON out of an answer', () => {
  assert.deepEqual(parseJSON('Here you go:\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJSON('{"a":[1,2]} trailing words'), { a: [1, 2] });
  assert.throws(() => parseJSON('no json here'));
});

// ---------------------------------------------------------------- deterministic checks

import { check } from './checks.mjs';

test('checks: the dead acting is flagged; the dead remembered is not', () => {
  const p4 = world.passages.find((p) => p.id === 'p4');
  const flags = check(E.world, p4);
  assert.deepEqual(flags.map((f) => [f.kind, f.fact]), [['dead-acts', 'f8']]);
  const memory = { id: 'x', chapter: 7, cast: ['mara'], text: 'Mara remembered how Ilse used to laugh at nothing.' };
  assert.deepEqual(check(E.world, memory), []);
  assert.deepEqual(check(E.world, p4, { flashback: true }), [], 'a flashback the author marked');
});

test('checks: an event recalled before it happens, at its own place only', () => {
  const early = { id: 'x', chapter: 1, cast: ['oren'], text: 'Oren had not been back to Harrow Gate since the granary burned.' };
  assert.deepEqual(check(E.world, early).map((f) => [f.kind, f.fact]), [['event-early', 'f10']]);
  const elsewhere = { id: 'y', chapter: 1, cast: ['oren'], text: 'Oren had not been back to Salt Reach since the granary burned.' };
  assert.deepEqual(check(E.world, elsewhere).filter((f) => f.kind === 'event-early'), [], 'the same deed elsewhere is another event');
});

test('checks: a former ruler acting as ruler', () => {
  const p = { id: 'x', chapter: 7, cast: ['oren'], text: 'Oren Daal heard petitions in the great hall of Salt Reach, as its ruler.' };
  assert.deepEqual(check(E.world, p).map((f) => [f.kind, f.fact]), [['former-ruler', 'f5']]);
  const now = { id: 'y', chapter: 3, cast: ['oren'], text: 'Oren Daal heard petitions in the great hall of Salt Reach, as its ruler.' };
  assert.deepEqual(check(E.world, now), []);
});

// ---------------------------------------------------------------- a whole check, with a stand-in model

import { runCheck, checkPrompt } from './ops.mjs';

test('a continuity check end to end: engine flags, then the model\'s, verified against what it saw', async () => {
  const { prompt, keys } = checkPrompt(E, 'p5');
  assert.ok(prompt.includes('Oren Daal is left-handed'));
  const lawKey = [...keys].find(([, fid]) => fid === 'f7')[0];
  const sink = memorySink();
  const gw = createGateway({
    providers: { fake: fakeProvider(() => ({ text: JSON.stringify({ flags: [{ ref: lawKey, quote: 'Salt Reach went dark', why: 'fine, actually', sure: true }, { ref: 'F99', quote: 'x', why: 'made up' }] }) })) },
    routes: { check: [route('cheap')] }, prices, sink,
  });
  const r = await runCheck(E, gw, 'p5', { user: 'u', worldId: 'w' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.flags.map((f) => [f.source, f.fact]), [['model', 'f7']], 'the made-up reference is dropped');
  assert.equal(sink.rows[0].verification.dropped, 1);
  const dead = await runCheck(E, gw, 'p4', { user: 'u', worldId: 'w' });
  assert.equal(dead.flags[0].source, 'engine');
  assert.equal(dead.flags[0].kind, 'dead-acts');
});

// ---------------------------------------------------------------- the studio's worlds

import { fromStudio } from './adapters/studio.mjs';

test('a studio backup in the engine\'s shape: order, cast from threads, ledger, notes, guessed pronouns', () => {
  const on = Array(120).fill(1), off = Array(120).fill(0);
  const backup = {
    world: { title: 'A test', chapterOrder: ['c2', 'c1'] },
    chapters: [
      { id: 'c1', title: 'Second', scenes: 2, cast: ['a', 'b'], threads: { a: on, b: off.map((x, i) => (i < 60 ? 1 : 0)) }, notes: [{ scene: 1, text: 'They meet at the Mill.' }], pins: [] },
      { id: 'c2', title: 'First', scenes: 1, cast: [], threads: {}, notes: [], pins: [] },
    ],
    entities: [
      { id: 'a', kind: 'character', name: 'Ada Lune', facts: [{ id: 'f1', text: 'She keeps the mill.', secret: false, endsIn: 'c2' }, { id: 'f4', text: 'Ada Lune is the miller.', from: 'c1' }, { id: 'f2', text: 'Ada Lune is the heir.', secret: true, reveal: 'c1', hints: ['Ada Lune wears her mother\'s ring.'] }, { id: 'f9', text: 'Retired.', retired: true }] },
      { id: 'b', kind: 'character', name: 'Bo', facts: [{ id: 'f3', text: 'Bo is a baker.', secret: true, reveal: null }] },
      { id: 'm', kind: 'place', name: 'the Mill', facts: [] },
    ],
    passages: [
      { id: 'p1', chapter: 'c1', scene: 1, text: 'Ada came in.', premises: [{ f: 'f1', v: 1 }], pending: [{ f: 'f1', v: 1 }, { f: 'f2', v: 1 }, { f: 'gone', v: 1 }] },
      { id: 'p0', chapter: 'c1', scene: 0, text: 'Bo baked.', premises: [], pending: [] },
    ],
  };
  const w = fromStudio(backup);
  assert.deepEqual(w.chapters.map((c) => c.id), ['c2', 'c1']);
  assert.equal(w.facts.length, 4, 'retired facts are left out');
  assert.deepEqual([w.facts.find((f) => f.id === 'f1').to, w.facts.find((f) => f.id === 'f4').from], [2, 2], 'story time in ordinals: true through the chapter it ends in');
  assert.equal(w.facts.find((f) => f.id === 'f2').secretUntil, 2, 'secret until its reveal chapter');
  assert.equal(w.facts.find((f) => f.id === 'f3').secretUntil, 3, 'a secret with no reveal is secret to the end');
  assert.deepEqual(w.facts.find((f) => f.id === 'f2').hints, ['Ada Lune wears her mother\'s ring.'], 'a secret\'s hints come across');
  assert.equal(w.facts.find((f) => f.id === 'f1').hints, undefined);
  assert.deepEqual(w.passages.map((p) => p.id), ['p0', 'p1'], 'in story order');
  assert.deepEqual(w.passages[0].cast, ['a', 'b'], 'scene 1: both threads on');
  assert.deepEqual(w.passages[1].cast, ['a'], 'scene 2: only Ada');
  assert.deepEqual(w.passages[1].premises.map((x) => x.f), ['f1', 'f2'], 'the ledger: confirmed and pending, known facts only');
  assert.equal(w.passages[1].notes, 'They meet at the Mill.');
  assert.ok(w.passages[1].chapterNotes.includes('Second'));
  assert.equal(w.entities[0].pronoun, 'she');
  assert.ok(w.entities[0].pronounGuessed);
  const e = createEngine(w);
  assert.ok(e.workingSet({ type: 'check', passage: 'p1' }).manifest.entities.some((x) => x.id === 'm' && x.how.includes('notes')), 'a place named in the notes is in play');
});

// ---------------------------------------------------------------- what a chapter changed

import { changesPrompt, checkChanges, applyChanges, undoChange, changeReach } from './changes.mjs';
import { runChanges } from './ops.mjs';

// chapter 8: Tomas swims, the key changes hands, and a new place comes in; chapter 9 still has
// Mara using the key
const changed = structuredClone(world);
changed.facts.push({ id: 'f13', entity: 'tomas', text: 'Tomas Vell owes Oren Daal a debt.', from: null, to: null, secretUntil: 10 });
changed.passages.push(
  { id: 'p7', chapter: 8, cast: ['tomas', 'mara'], text: 'Tomas Vell swam out past the breakwater and brought the boat back himself. On the jetty, Mara Vell pressed the Brass Key into his hand and walked away without it. They slept that night at the Weir House.', premises: [] },
  { id: 'p8', chapter: 9, cast: ['mara'], text: 'Mara Vell turned the Brass Key in the lock of the tide-house.', premises: [{ f: 'f9' }] },
);
const CE = createEngine(changed);
const allKeys = new Map(changed.facts.map((f, i) => [`F${i + 1}`, f.id]));
const keyOf = (fid) => [...allKeys].find(([, id]) => id === fid)[0];
const chapter8 = changed.passages.find((p) => p.id === 'p7').text;
const answer8 = {
  new: [
    { about: 'Tomas Vell', fact: 'Tomas Vell can swim.', quote: 'Tomas Vell swam out past the breakwater' },
    { about: 'the Brass Key', fact: 'The Brass Key is carried by Tomas Vell.', quote: 'pressed the Brass Key into his hand' },
    { about: 'the Weir House', kind: 'place', fact: 'The Weir House stands by the jetty.', quote: '“They slept that night at the Weir House.”' },
    { about: 'Mara Vell', fact: 'Mara Vell lives in Salt Reach.', quote: 'On the jetty, Mara Vell' },
    { about: 'Oren Daal', fact: 'Oren Daal is away at sea.', quote: 'walked away without it' },
    { about: 'Mara Vell', fact: 'Mara Vell is afraid of the sea.', quote: 'Mara feared the water' },
    { about: 'Vell', fact: 'The Vells are rich.', quote: 'brought the boat back' },
  ],
  ended: [
    { ref: keyOf('f4'), quote: 'swam out past the breakwater', why: 'He swims now.' },
    { ref: `[${keyOf('f9').toLowerCase()}]`, quote: 'pressed the Brass Key ... walked away without it', why: 'She gave it to him.' },
    { ref: keyOf('f8'), quote: 'brought the boat back', why: 'x' },
    { ref: keyOf('f10'), quote: 'brought the boat back', why: 'x' },
    { ref: keyOf('f5'), quote: 'brought the boat back', why: 'x' },
    { ref: keyOf('f13'), quote: 'brought the boat back', why: 'x' },
    { ref: keyOf('f12'), quote: 'Mara left Salt Reach for good', why: 'x' },
    { ref: 'F99', quote: 'brought the boat back', why: 'x' },
  ],
};

test('what a chapter changed: only what the world allows, and why the rest is dropped', () => {
  const c = checkChanges(CE, 8, answer8, { keys: allKeys, text: chapter8 });
  assert.deepEqual(c.ended.map((x) => x.fact), ['f4', 'f9'], 'a reference is read however it is written');
  assert.deepEqual(c.new.map((x) => [x.about.id || x.about.new, x.text]), [
    ['tomas', 'Tomas Vell can swim.'],
    ['key', 'The Brass Key is carried by Tomas Vell.'],
    ['the Weir House', 'The Weir House stands by the jetty.'],
  ]);
  assert.equal(c.new[2].about.kind, 'place');
  const why = Object.fromEntries(c.dropped.map((x) => [x.item.fact || x.item.ref, x.why]));
  assert.equal(why['Mara Vell lives in Salt Reach.'], 'the canon already says so');
  assert.match(why['Oren Daal is away at sea.'], /isn't in chapter 8/);
  assert.match(why['Mara Vell is afraid of the sea.'], /doesn't say so/);
  assert.match(why['The Vells are rich.'], /could be Mara Vell or Tomas Vell/);
  assert.equal(why.f8, 'a death');
  assert.match(why.f10, /happened in chapter 2/);
  assert.match(why.f5, /not true in chapter 8/);
  assert.match(why.f13, /a secret until chapter 10/);
  assert.match(why.f12, /doesn't say so/);
  assert.match(why.F99, /wasn't shown/);
  // the old fact, not ended, makes the same fact in the same words not new
  const again = checkChanges(CE, 8, { new: [{ about: 'Tomas Vell', fact: 'Tomas Vell cannot swim.', quote: 'swam out past the breakwater' }] }, { keys: allKeys, text: chapter8 });
  assert.equal(again.new.length, 0);
});

test('keeping what a chapter changed: new facts from the chapter, ended ones through it, and undo', () => {
  const c = checkChanges(CE, 8, answer8, { keys: allKeys, text: chapter8 });
  const { data, log } = applyChanges(changed, c, { chapter: 8, at: 1 });
  assert.equal(log.length, 5);
  const swim = data.facts.find((f) => f.text === 'Tomas Vell can swim.');
  assert.equal(swim.from, 8);
  assert.equal(data.facts.find((f) => f.id === 'f4').to, 9, 'true through chapter 8, not after');
  const weir = data.entities.find((e) => e.name === 'the Weir House');
  assert.equal(weir.kind, 'place');
  assert.ok(log.find((x) => x.entity === weir.id).madeEntity);
  const after = createEngine(data);
  const ws = after.workingSet({ type: 'draft', chapter: 9, cast: ['tomas'], notes: 'Tomas Vell at the harbour.' });
  assert.ok(ws.facts.indexOf(swim.id) < ws.facts.indexOf('f4'), 'in chapter 9 he swims; the old fact goes last');
  assert.deepEqual(holdersAt(after.world, 'key', 'possess', 9).map((t) => t.person), ['tomas'], 'the key changed hands');
  // undo, one change at a time
  const u = undoChange(data, log.find((x) => x.fact === 'f4'));
  assert.ok(u.ok);
  assert.equal(u.data.facts.find((f) => f.id === 'f4').to, null);
  const w2 = undoChange(data, log.find((x) => x.entity === weir.id));
  assert.ok(w2.ok);
  assert.ok(!w2.data.entities.some((e) => e.id === weir.id), 'a thing the change made goes with it');
  const edited = { ...data, facts: data.facts.map((f) => (f.id === swim.id ? { ...f, text: 'Tomas Vell can swim, badly.' } : f)) };
  const refused = undoChange(edited, log.find((x) => x.fact === swim.id));
  assert.equal(refused.ok, false, 'never takes back the author\'s own edit');
  assert.ok(undoChange(u.data, log.find((x) => x.fact === 'f4')).already, 'undoing twice is a no-op');
});

test('what a chapter\'s changes reach: a later scene that relied on what ended', () => {
  const c = checkChanges(CE, 8, answer8, { keys: allKeys, text: chapter8 });
  const reach = changeReach(CE, c, 8);
  assert.deepEqual(reach.find((x) => x.kind === 'ended' && x.fact === 'f9').passages, ['p8']);
  assert.ok(!reach.some((x) => x.passages.includes('p7')), 'only later chapters');
});

test('what a chapter changed, end to end: its working set, the model, the checks', async () => {
  const { prompt, keys } = changesPrompt(CE, 8);
  assert.ok(prompt.includes('CHAPTER 8') && prompt.includes('pressed the Brass Key'));
  assert.ok([...keys.values()].includes('f13'), 'a secret is in it, so it isn\'t offered back as new');
  assert.equal(CE.workingSet({ type: 'changes', chapter: 8 }).manifest.op, 'changes');
  const k = (fid) => [...keys].find(([, id]) => id === fid)[0];
  const sink = memorySink();
  const gw = createGateway({
    providers: { fake: fakeProvider(() => ({ text: JSON.stringify({ new: [answer8.new[0]], ended: [{ ref: k('f4'), quote: 'swam out past the breakwater', why: 'He swims.' }, { ref: 'F99', quote: 'x' }] }) })) },
    routes: { changes: [route('cheap')] }, prices, sink,
  });
  const r = await runChanges(CE, gw, 8, { user: 'u', worldId: 'w' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.changes.ended.map((x) => x.fact), ['f4']);
  assert.deepEqual(r.changes.new.map((x) => x.text), ['Tomas Vell can swim.']);
  assert.equal(sink.rows[0].verification.dropped, 1, 'the made-up reference is dropped before the checks');
  const empty = await runChanges(CE, gw, 10, { user: 'u', worldId: 'w' });
  assert.equal(empty.attempts, 0, 'a chapter with no text costs no call');
});

// ---------------------------------------------------------------- who knows what

import { knowsAt } from './time.mjs';

// Mara spies for Oren; only the two of them know, and Tomas finds out in chapter 9
const spying = (knownBy) => {
  const w = structuredClone(world);
  w.facts.push({ id: 'f14', entity: 'mara', text: 'Mara Vell is a spy for Oren Daal.', from: null, to: null, secretUntil: null, knownBy });
  return w;
};
const KNOWN = [{ who: 'mara', from: null }, { who: 'oren', from: null }, { who: 'tomas', from: 9 }];

test('who knows a fact: anyone, unless it says who, each from a chapter', () => {
  const f = spying(KNOWN).facts.at(-1);
  assert.equal(knowsAt(f, 'mara', 1), true);
  assert.equal(knowsAt(f, 'tomas', 8), false);
  assert.equal(knowsAt(f, 'tomas', 9), true);
  assert.equal(knowsAt(f, 'ilse', 9), false);
  assert.equal(knowsAt(world.facts[0], 'ilse', 1), true, 'a fact that doesn\'t say who knows it, anyone may');
  const E2 = createEngine(spying(KNOWN));
  assert.equal(E2.line('f14'), 'Mara Vell: Mara Vell is a spy for Oren Daal. (known only to Mara Vell, Oren Daal, Tomas Vell from chapter 9)');
  assert.equal(createEngine(spying([])).line('f14'), 'Mara Vell: Mara Vell is a spy for Oren Daal. (known to no one yet)');
  const spyCheck = createEngine({ ...spying(KNOWN), passages: [...world.passages, { id: 'pk', chapter: 6, cast: ['tomas', 'mara'], text: 'Tomas Vell watched Mara Vell burn the letter from Oren Daal.', premises: [] }] });
  assert.ok(checkPrompt(spyCheck, 'pk').prompt.includes('before they know it'), 'the model\'s check is told, when a fact says who knows it');
  assert.ok(!checkPrompt(E, 'p5').prompt.includes('before they know it'), 'and not otherwise');
});

test('a draft told through someone\'s eyes leaves out what they don\'t know yet', () => {
  const E2 = createEngine(spying(KNOWN));
  const op = { type: 'draft', chapter: 6, cast: ['mara', 'tomas'], notes: 'Mara Vell and Tomas Vell at supper; Oren Daal\'s letter.' };
  const tomas = E2.workingSet({ ...op, pov: 'tomas' });
  assert.ok(!tomas.facts.includes('f14'));
  assert.deepEqual(tomas.manifest.pov, { who: 'tomas', keptBack: ['f14'] });
  assert.ok(E2.workingSet({ ...op, pov: 'mara' }).facts.includes('f14'), 'she knows it');
  assert.ok(E2.workingSet({ ...op, chapter: 9, pov: 'tomas' }).facts.includes('f14'), 'he knows it from chapter 9');
  assert.ok(E2.workingSet(op).facts.includes('f14'), 'no point of view: in, with who knows it on its line');
  assert.equal(E2.workingSet(op).manifest.pov, undefined);
});

test('checks: someone acting on what they don\'t know yet', () => {
  const E2 = createEngine(spying(KNOWN));
  const at = (chapter, text, cast = ['tomas', 'mara']) => check(E2.world, { id: 'x', chapter, cast, text }).filter((f) => f.kind === 'knows-early').map((f) => [f.entity, f.why]);
  assert.deepEqual(at(6, 'Tomas Vell knew that Mara Vell was a spy for Oren Daal.'), [['tomas', 'Tomas Vell learns this in chapter 9']]);
  // a limit: the sentence is taken to be about whoever it names first, so a line Tomas speaks
  // that names Oren first isn't caught here (the model's check reads dialogue)
  assert.deepEqual(at(6, '"You spy for Oren Daal," Tomas Vell said.'), []);
  assert.deepEqual(at(9, 'Tomas Vell knew that Mara Vell was a spy for Oren Daal.'), [], 'from chapter 9 he knows');
  assert.deepEqual(at(6, 'Mara Vell was afraid Tomas Vell would find out she was a spy.'), [], 'she knows; the sentence is hers');
  assert.deepEqual(at(6, 'Tomas Vell had no idea Mara Vell was a spy.'), [], 'saying he doesn\'t know is not knowing');
  assert.deepEqual(at(2, 'Ilse Vell knew Mara Vell was a spy.', ['ilse', 'mara']), [['ilse', 'Ilse Vell doesn\'t know this']]);
  assert.deepEqual(at(6, 'Tomas Vell knew the tide.'), [], 'not the fact\'s words');
});

test('what a chapter changed: who learned what, checked, kept and undone', () => {
  const w = spying([{ who: 'mara', from: null }, { who: 'oren', from: null }]);
  w.passages.push({ id: 'p9', chapter: 8, cast: ['tomas', 'mara'], text: 'Tomas Vell found the letters under the floor and knew at last that Mara Vell was a spy for Oren Daal. Mara Vell said nothing.', premises: [] });
  const E2 = createEngine(w);
  const { prompt, keys, text } = changesPrompt(E2, 8);
  assert.ok(prompt.includes('"learned"'), 'asked only when a fact says who knows it');
  assert.ok(!changesPrompt(CE, 8).prompt.includes('"learned"'));
  const key = [...keys].find(([, id]) => id === 'f14')[0];
  const c = checkChanges(E2, 8, { learned: [
    { who: 'Tomas Vell', ref: key, quote: 'knew at last that Mara Vell was a spy' },
    { who: 'Mara Vell', ref: key, quote: 'Mara Vell said nothing' },
    { who: 'Ilse Vell', ref: key, quote: 'Mara Vell said nothing' },
    { who: 'Tomas Vell', ref: [...keys].find(([, id]) => id === 'f4')[0], quote: 'found the letters' },
  ] }, { keys, text });
  assert.deepEqual(c.learned, [{ fact: 'f14', who: 'tomas', quote: 'knew at last that Mara Vell was a spy' }]);
  assert.deepEqual(c.dropped.map((x) => x.why), ['Mara Vell already knows it', 'Ilse Vell isn\'t in chapter 8', 'the canon doesn\'t say who knows it, so anyone may']);
  const planned = checkChanges(createEngine({ ...w, facts: w.facts.map((f) => (f.id === 'f14' ? { ...f, knownBy: KNOWN } : f)) }), 8, { learned: [{ who: 'Tomas Vell', ref: key, quote: 'knew at last that Mara Vell was a spy' }] }, { keys, text });
  assert.equal(planned.dropped[0].why, 'the canon has Tomas Vell learn it in chapter 9', 'the author\'s plan stands');
  const { data, log } = applyChanges(w, c, { chapter: 8 });
  assert.deepEqual(data.facts.find((f) => f.id === 'f14').knownBy.at(-1), { who: 'tomas', from: 8 });
  assert.equal(log[0].kind, 'learned');
  assert.deepEqual(check(createEngine(data).world, { id: 'y', chapter: 8, cast: ['tomas'], text: 'Tomas Vell knew Mara Vell was a spy for Oren Daal.' }).filter((f) => f.kind === 'knows-early'), [], 'from then on he knows');
  const u = undoChange(data, log[0]);
  assert.ok(u.ok);
  assert.ok(!u.data.facts.find((f) => f.id === 'f14').knownBy.some((k) => k.who === 'tomas'));
});

test('a studio backup carries who knows a fact, in chapter ordinals', () => {
  const on = Array(120).fill(1);
  const w = fromStudio({
    world: { chapterOrder: ['c1', 'c2'] },
    chapters: [{ id: 'c1', scenes: 1, cast: ['a'], threads: { a: on } }, { id: 'c2', scenes: 1, cast: [], threads: {} }],
    entities: [{ id: 'a', kind: 'character', name: 'Ada', facts: [{ id: 'f1', text: 'Ada is the heir.', knownBy: [{ who: 'a', from: null }, { who: 'b', from: 'c2' }] }] }, { id: 'b', kind: 'character', name: 'Bo', facts: [] }],
    passages: [],
  });
  assert.deepEqual(w.facts[0].knownBy, [{ who: 'a', from: null }, { who: 'b', from: 2 }]);
});
