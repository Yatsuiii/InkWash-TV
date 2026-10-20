// The dream world's tests: several nights of one person's dreams.
//
//   node --test inkwash/engine/dreams/test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDreamWorld, checkDiff, affectName, describe, feltOver, preferences, WHY, attachTonight, worldBrief, wordsBrief, wordsUsed, retellNote, needsRetelling, tellingScore, keyWords, knownLesson } from './index.mjs';
import { readLine, compileBeats, shapeOf, arcBrief, checkTelling } from '../personal/arc.mjs';
import { agentBrief, recall, thingDetail, nightDetail, memoryOf, tokensOf, OPEN, MEMORY } from './tools.mjs';
import { readHand, learnHand, emptyHand, TRAITS, traitsOf, fitTaste, keepChance, tasteNotes, checkGrounded, composeTelling, paintingIn, withhold, firstPersonIn, toSecondPerson } from './index.mjs';
import { simulate, simulateFeelings } from './sim.mjs';
import { FEATURES, strokeFeatures, fitAffect, readFeelings, scoreReading, affectNotes } from './index.mjs';

// a horizon, a round mark high on the left, a tall mark on the right
const S1 = [
  { n: 1, from: [100, 600], to: [1500, 610], box: [100, 590, 1500, 620], length: 1400, turn: 0.3, ms: 4000, pools: [] },
  { n: 2, from: [260, 100], to: [261, 101], box: [200, 100, 320, 220], length: 380, turn: 6.2, ms: 3000, pools: [] },
  { n: 3, from: [1200, 600], to: [1210, 300], box: [1195, 300, 1215, 600], length: 300, turn: 0.2, ms: 2000, pools: [] },
];
// another night: the round mark again, a little to the right; a path; the horizon
const S2 = [
  { n: 1, from: [300, 990], to: [700, 640], box: [300, 640, 700, 990], length: 520, turn: 0.3, ms: 3000, pools: [] },
  { n: 2, from: [290, 130], to: [291, 131], box: [230, 120, 350, 240], length: 370, turn: 6.1, ms: 2500, pools: [] },
  { n: 3, from: [80, 640], to: [1520, 650], box: [80, 630, 1520, 660], length: 1440, turn: 0.2, ms: 4200, pools: [] },
];
const lines3 = (texts, strokes) => ({ title: 'A Night', lines: texts.map((text, i) => ({ text, strokes: [strokes[i].n], v: 0, a: 0 })) });

function nightOne() {
  const w = createDreamWorld();
  const r = w.commit({
    telling: lines3(['The sea lay flat as a table.', 'The clock had stopped, high up, where you could not reach it.', 'Your brother stood by the gate and would not turn round.'], S1),
    shape: 'dip', strokes: S1,
    feeling: { byStroke: [0, -0.8, -0.3], arousal: [0, 0.6, 0.2] },
    pinned: { n: 2, said: 'the stopped clock', why: 'unreachable' },
    words: [{ n: 1, text: 'there was a long flat sea' }],
    diff: {
      entities: [{ new: 'the sea', kind: 'place', lines: [0] }, { new: 'the stopped clock', kind: 'thing', aliases: ['clock'], lines: [1] }, { new: 'my brother', kind: 'person', aliases: ['brother'], lines: [2] }],
      facts: [{ about: 'the stopped clock', text: 'It had stopped at ten past four.', line: 1, open: true }, { about: 'my brother', text: 'He would not turn round.', line: 2 }],
    },
    reactions: ['yes', 'yes', 'no'],
  });
  return { w, r };
}

test('a night is taken in: what they named and kept stays, what they turned down does not', () => {
  const { w, r } = nightOne();
  assert.equal(r.night, 1);
  assert.deepEqual(w.entities.map((e) => [e.name, e.status]), [['the sea', 'confirmed'], ['the stopped clock', 'confirmed']]);
  assert.deepEqual(r.turnedDown, ['my brother']);
  const clock = w.entities.find((e) => e.name === 'the stopped clock');
  assert.deepEqual(clock.aliases.slice(0, 2), ['clock', 'Clock']);
  assert.equal(clock.appearances[0].why, 'unreachable');
  assert.equal(clock.appearances[0].source, 'said', 'they named it themselves');
  assert.equal(clock.appearances[0].v, -0.8, 'felt as they marked it, not as the telling put it');
  assert.equal(clock.appearances[0].mark.kind, 'round');
  assert.deepEqual(w.facts.map((f) => [f.text, !!f.thread]), [['It had stopped at ten past four.', true]], 'the turned-down line\'s fact is not kept');
  assert.equal(w.nights[0].lines[2].reaction, 'no');
  assert.ok(!w.nights[0].text.includes('brother'), 'the passage keeps only what they kept');
});

test('the next night, their world is recognised: by their words, and by a mark like one it came as', () => {
  const { w } = nightOne();
  const byMark = w.recognize({ strokes: S2 });
  assert.equal(byMark[0].name, 'the stopped clock');
  assert.equal(byMark[0].by, 'mark');
  assert.equal(byMark[0].n, 2);
  const byWords = w.recognize({ words: ['the Clock again, and the sea had gone'] });
  assert.deepEqual(byWords.map((x) => x.name).sort(), ['the sea', 'the stopped clock']);
  assert.deepEqual(w.known(S2[1]).map((x) => x.name), ['the stopped clock'], 'offered at the turn, from their own world');
  assert.deepEqual(w.known(S2[0]), [], 'a path is not the clock');
  assert.ok(!w.recognize({ words: ['my brother was there'] }).length, 'what they turned down is not recognised');
});

test('the slice for tonight: what is in play, as it stands, how it felt to them and why, what is still open', () => {
  const { w } = nightOne();
  const clock = w.entities.find((e) => e.name === 'the stopped clock').id;
  const s = w.slice({ cast: [clock], words: ['the clock again'] });
  assert.equal(s.night, 2);
  const thing = s.things.find((t) => t.id === clock);
  assert.match(thing.felt, /very heavy and very stirred \(afraid\).*because I couldn't reach it/);
  assert.equal(thing.own, true);
  assert.deepEqual(s.threads.map((t) => t.text), ['the stopped clock: It had stopped at ten past four. (since night 1)']);
  assert.deepEqual(s.recent, [{ night: 1, title: 'A Night', shape: 'dip' }]);
  assert.equal(s.lastTold.night, 1);
  assert.ok(s.lastTold.lines.length && s.lastTold.lines.every((l) => typeof l === 'string'), 'how the last night was told, line by line');
  assert.deepEqual(s.avoid, ['my brother'], 'a reading they turned down, not to offer again');
});

test('nights add up: a thing comes back, how it feels moves, and a thread closes', () => {
  const { w } = nightOne();
  const clock = w.entities.find((e) => e.name === 'the stopped clock').id;
  const open = w.facts.find((f) => f.thread).id;
  w.commit({
    telling: lines3(['A path ran up from the bottom of the paper.', 'The clock was there again, and its hands began to move.', 'The horizon held.'], S2),
    shape: 'rise', strokes: S2,
    feeling: { byStroke: [0, 0.2, 0.5], arousal: [0, 0.3, -0.4] },
    pinned: { n: 2, said: 'the stopped clock', entity: clock, why: 'free' },
    diff: { entities: [{ id: clock, lines: [1] }, { new: 'the path', kind: 'place', lines: [0] }], facts: [{ about: clock, text: 'Its hands began to move.', line: 1 }], resolved: [{ fact: open, line: 1 }] },
    reactions: ['yes', 'yes', null],
  });
  const c = w.entities.find((e) => e.id === clock);
  assert.equal(c.appearances.length, 2);
  const f = feltOver(c.appearances);
  assert.equal(f.trend, 'lighter');
  assert.deepEqual(f.whys, ["I couldn't reach it", 'it let me go']);
  assert.equal(w.facts.find((x) => x.id === open).to, 2, 'the thread closed on night 2');
  const s = w.summary();
  assert.equal(s.nights, 2);
  assert.deepEqual(s.recurring.map((x) => [x.name, x.nights, x.trend]), [['the stopped clock', 2, 'lighter']]);
  assert.deepEqual(s.open, []);
  // and the engine knows the old fact is no longer true on night 3
  const s3 = w.slice({ cast: [clock] });
  assert.ok(s3.facts.some((l) => /Its hands began to move/.test(l)));
  assert.ok(s3.facts.some((l) => /ten past four.*until night 2/.test(l)), JSON.stringify(s3.facts));
  // kept between sittings
  const again = createDreamWorld(JSON.parse(JSON.stringify(w.toJSON())));
  assert.deepEqual(again.summary(), s);
  assert.equal(again.recognize({ strokes: S2 })[0].name, 'the stopped clock');
});

test('what the guide service proposes is checked before it is kept', () => {
  const d = checkDiff({
    entities: [{ id: 'e9' }, { id: 'e1', lines: [0, 7, 'x'] }, { new: '  <b>the gate</b> ', kind: 'castle', lines: [2] }, { new: 'the gate', lines: [1] }, { new: '' }, 'nonsense'],
    facts: [{ about: 'e1', text: 'x'.repeat(400), line: 1 }, { about: 'the gate', text: 'It was locked.', line: 9, open: 1 }, { text: 'no subject' }],
    resolved: [{ fact: 'f1', line: 0 }, { fact: 'f2', line: 0 }],
  }, { lines: 3, ids: new Set(['e1']), open: new Set(['f1']) });
  assert.deepEqual(d.entities, [{ id: 'e1', lines: [0] }, { new: 'bthe gate/b', kind: 'thing', aliases: [], lines: [2] }, { new: 'the gate', kind: 'thing', aliases: [], lines: [1] }]);
  assert.equal(d.facts[0].text.length, 140);
  assert.deepEqual(d.facts[1], { about: 'the gate', text: 'It was locked.', line: null, open: true });
  assert.equal(d.facts.length, 2);
  assert.deepEqual(d.resolved, [{ fact: 'f1', line: 0 }], 'only open threads close');
});

test('a thing already in their world is that thing, however the guide gives it: by its id, by its name, or by an id that is its name', () => {
  const { w } = nightOne();
  const clock = w.entities.find((e) => e.name === 'the stopped clock').id;
  assert.equal(w.thingFor(clock), clock);
  assert.equal(w.thingFor('The Stopped Clock'), clock);
  assert.equal(w.thingFor('stopped clock'), clock);
  assert.equal(w.thingFor('my brother'), null, 'what they turned down is not in their world');
  assert.equal(w.thingFor('the gate'), null);
  const d = checkDiff({ entities: [{ new: 'the stopped clock', lines: [0] }, { id: 'The stopped clock' }, { new: 'the gate' }] }, { lines: 2, ids: new Set(w.entities.map((e) => e.id)), thingFor: w.thingFor });
  assert.deepEqual(d.entities, [{ id: clock, lines: [0] }, { new: 'the gate', kind: 'thing', aliases: [], lines: [] }], 'one clock, not two');
  // given by its name on a later night, it comes a second night, and stays one thing
  const r = w.commit({ telling: lines3(['The stopped clock again, higher now.', 'A path.', 'The sea.'], S2), strokes: S2, diff: { entities: [{ new: 'The stopped clock', kind: 'thing', strokes: [2] }] }, reactions: ['yes', null, null] });
  assert.deepEqual(r.kept, ['the stopped clock (a second chapter)']);
  assert.equal(w.entities.filter((e) => /clock/i.test(e.name)).length, 1);
});

test('a mark painted again is known again, though the brush swung a little more or less: a wave and a long line', () => {
  const w = createDreamWorld();
  const wave = { n: 1, from: [760, 660], to: [1372, 680], box: [760, 608, 1372, 720], length: 640, turn: 4, ms: 4200, pools: [] };
  w.commit({ telling: { title: 'Rooms', lines: [{ text: 'A whole floor of rooms.', strokes: [1] }] }, strokes: [wave], diff: { entities: [{ new: 'the hidden rooms', kind: 'place', lines: [0], strokes: [1] }] }, reactions: ['yes'] });
  // painted again, swung wider: too tall now to be read as a wave
  const again = { ...wave, from: [770, 640], to: [1376, 690], box: [770, 555, 1376, 720], length: 650 };
  const seen = w.recognize({ strokes: [again] });
  assert.deepEqual(seen.map((r) => [r.name, r.n]), [['the hidden rooms', 1]]);
  // somewhere else on the paper, it is not
  assert.deepEqual(w.recognize({ strokes: [{ ...again, box: [60, 80, 666, 245], from: [60, 120], to: [666, 170] }] }), []);
});

test('the brief: the things that keep coming, and whatever tonight is like, however long ago it came', () => {
  const w = createDreamWorld();
  const mark = (x) => ({ n: 1, from: [x, 500], to: [x + 1, 501], box: [x - 60, 440, x + 60, 560], length: 380, turn: 6.2, ms: 2000, pools: [] });
  const names = ['the owl', 'the kite', 'the lantern', 'the fox', 'the bell', 'the ship', 'the key', 'the tower', 'the whale', 'the drum', 'the comet', 'the mirror', 'the boat', 'the moon'];
  names.forEach((name, i) => w.commit({
    telling: { title: `Night ${i + 1}`, lines: [{ text: `${name} came.`, strokes: [1] }, { text: 'Then it was morning.', strokes: [1] }] },
    strokes: [mark(100 + i * 90)], words: [{ n: 1, text: name }],
    diff: { entities: [{ new: name, kind: 'thing', lines: [0], strokes: [1] }] }, reactions: ['yes', null],
  }));
  assert.equal(agentBrief(w).things.length, 12);
  assert.ok(!agentBrief(w).things.some((t) => t.name === 'the owl'), 'the first night\'s thing, past the twelve');
  const b = agentBrief(w, { words: [{ n: 1, text: 'the owl again' }] });
  assert.equal(b.things.length, 13);
  assert.equal(b.things.at(-1).name, 'the owl', 'tonight is like it: there, with its id');
});

test('earlier chapters: the last two as told, older ones recapped in blocks, scored against tonight, never twice, within the budget', () => {
  const w = createDreamWorld();
  const mark = (x) => ({ n: 1, from: [x, 500], to: [x + 1, 501], box: [x - 60, 440, x + 60, 560], length: 380, turn: 6.2, ms: 2000, pools: [] });
  const names = ['the owl', 'the kite', 'the lantern', 'the fox', 'the bell', 'the ship', 'the key', 'the tower', 'the whale', 'the drum', 'the comet', 'the mirror', 'the boat', 'the moon'];
  names.forEach((name, i) => w.commit({
    telling: { title: `Night ${i + 1}`, lines: [{ text: `You saw ${name} come.`, strokes: [1] }, { text: 'Then it was morning.', strokes: [1] }, { text: 'It meant nothing at all.', strokes: [1] }] },
    strokes: [mark(100 + i * 90)], words: [{ n: 1, text: name }],
    diff: { entities: [{ new: name, kind: 'thing', lines: [0], strokes: [1] }] }, reactions: ['yes', null, 'no'],
  }));
  const owl = w.entities.find((e) => e.name === 'the owl').id;
  const m = memoryOf(w, { words: [{ n: 1, text: 'the owl again' }], tonight: new Set([owl]) });
  assert.deepEqual(m.recent, [
    { night: 13, title: 'Night 13', told: ['You saw the boat come.', 'Then it was morning.'] },
    { night: 14, title: 'Night 14', told: ['You saw the moon come.', 'Then it was morning.'] },
  ], 'the last two chapters word for word, less what they turned down');
  assert.deepEqual(m.recaps.map((r) => r.chapters), ['chapters 1 to 4'], 'only what bears on tonight');
  assert.match(m.recaps[0].recap, /^Chapter 1, Night 1: the owl\. You saw the owl come\. Chapter 2, Night 2: the kite\./);
  assert.ok(!/It meant nothing/.test(m.recaps[0].recap), 'a line they turned down is not recapped');
  assert.deepEqual(m.memory.recaps.map((r) => [r.chapters, r.because]), [['chapters 1 to 4', ['the owl']]]);
  assert.deepEqual(m.memory.left_out.map((r) => r.chapters), ['chapters 5 to 8', 'chapters 9 to 12']);
  assert.equal(m.memory.tokens, m.memory.recent_tokens + m.memory.recaps[0].tokens);
  assert.equal(m.memory.recaps[0].tokens, tokensOf(m.recaps[0].recap));
  assert.ok(m.recaps[0].recap.length <= MEMORY.chars + 4 * 2);
  // nothing tonight is like: no recaps, and every block is left out; past the budget, none either
  assert.deepEqual(memoryOf(w).recaps, []);
  assert.deepEqual(memoryOf(w, { words: [{ n: 1, text: 'the owl again' }], tonight: new Set([owl]), M: { ...MEMORY, tokens: 40 } }).recaps, []);
  // said, not seen: their words alone find a chapter
  assert.deepEqual(memoryOf(w, { words: [{ n: 1, text: 'the whale' }] }).recaps.map((r) => r.chapters), ['chapters 9 to 12']);
  // in the brief, beside the rest
  const b = agentBrief(w, { words: [{ n: 1, text: 'the owl again' }] });
  assert.deepEqual([b.recent.map((r) => r.night), b.recaps.map((r) => r.chapters)], [[13, 14], ['chapters 1 to 4']]);
  assert.equal(memoryOf(createDreamWorld()).recent.length, 0, 'a first night has none');
});

test('a world kept and read back: whole, exactly as it was; cut short or kept by an older TV, still opening with all of it that can be read', () => {
  const stroke = (n, x = 300) => ({ n, ink: 'dense', from: [x, 500], to: [x + 100, 520], box: [x, 490, x + 100, 530], length: 120, turn: 0.4, pressure: 0.5, pools: [], ms: 900, gap: 1, still: 0 });
  const w = createDreamWorld();
  w.commit({ telling: { title: 'One', lines: [{ text: 'You saw the ferry.', strokes: [1] }, { text: 'It waited.', strokes: [2] }] }, strokes: [stroke(1), stroke(2, 700)], words: [{ n: 1, text: 'the ferry' }], reactions: ['yes', null], diff: { entities: [{ new: 'the ferry', kind: 'thing', lines: [0], strokes: [1] }], facts: [{ about: 'the ferry', text: 'It waits at the pier.', open: true }] } });
  w.newEnding({ telling: { lines: [{ text: 'You saw the ferry.', strokes: [1] }, { text: 'Then a lantern.', strokes: [3] }] }, strokes: [stroke(3)], reactions: ['yes', 'yes'] });
  const kept = JSON.stringify(w.toJSON());
  assert.equal(JSON.stringify(createDreamWorld(JSON.parse(kept)).toJSON()), kept, 'a whole world reads back exactly');
  // each part in a shape it was never kept in: the world still opens, and keeps going
  for (const [k, v] of [['nights', null], ['nights', [null, {}, { n: 'x' }]], ['entities', 0], ['facts', 'x'], ['readings', []], ['taste', null], ['affect', 7], ['seq', null], ['hand', 'x'], ['notes', 5], ['wonders', {}], ['scene', 'x']]) {
    const v2 = createDreamWorld({ ...JSON.parse(kept), [k]: v });
    assert.doesNotThrow(() => { v2.summary(); v2.recap(); agentBrief(v2, { strokes: [stroke(1)], words: [{ n: 1, text: 'the ferry' }] }); recall(v2, 'ferry'); v2.commit({ telling: { title: 'Two', lines: [{ text: 'The ferry came back.', strokes: [1] }] }, strokes: [stroke(1)], reactions: ['yes'], diff: {} }); }, `${k}: ${JSON.stringify(v)}`);
  }
  // what is broken goes, and only that: a line that isn't one, a fact about a thing not there
  const S = JSON.parse(kept);
  S.nights[0].lines.push(null);
  S.facts.push({ id: 'f99', entity: 'e99', text: 'About nothing.' }, null);
  S.entities.push({ id: 'e7', name: '' }, { name: 'no id' });
  const back = createDreamWorld(S).toJSON();
  assert.deepEqual([back.nights[0].lines.length, back.facts.map((f) => f.id), back.entities.map((e) => e.id)], [2, ['f1'], ['e1']]);
  assert.equal(back.seq.f, 1);
  // the counters go past every id there is, so nothing new takes an id already used
  const behind = createDreamWorld({ ...JSON.parse(kept), seq: { e: 0, f: 0 } });
  behind.commit({ telling: { title: 'Two', lines: [{ text: 'A gull came.', strokes: [1] }] }, strokes: [stroke(1)], reactions: ['yes'], diff: { entities: [{ new: 'the gull', kind: 'creature', lines: [0], strokes: [1] }] } });
  assert.deepEqual(behind.toJSON().entities.map((e) => e.id), ['e1', 'e2']);
  // and the checks take what they are given, whatever it is
  assert.doesNotThrow(() => { checkGrounded({ lines: [null, { text: null }] }, { things: [null, { name: null }], words: [null], turnedDown: [5] }); composeTelling({ lines: [null] }, null); withhold([null], { young: true, ending: { strokes: [1] } }); fitTaste([null, { x: [NaN] }]); traitsOf(null, null, null); });
});

test('their reactions teach: lines in their own words kept, explanations turned down', () => {
  const w = createDreamWorld();
  for (let k = 0; k < 4; k++) {
    w.commit({
      telling: { title: `Night ${k + 1}`, lines: [
        { text: 'There was a long flat sea, as you said.', strokes: [1], v: 0 },
        { text: 'It meant that you had lost something, because the clock stopped.', strokes: [2], v: -0.6 },
        { text: 'A tall mark stood on the right.', strokes: [3], v: 0 },
      ] },
      strokes: S1, words: [{ n: 1, text: 'a long flat sea' }], diff: {}, reactions: ['yes', 'no', k % 2 ? 'yes' : 'no'],
    });
  }
  const p = preferences(w.toJSON());
  assert.equal(p.counts.all, 12);
  assert.ok(p.notes.some((n) => /Use their own words/.test(n)), JSON.stringify(p.notes));
  assert.ok(p.notes.some((n) => /Never explain what it meant/.test(n)), JSON.stringify(p.notes));
  assert.deepEqual(w.slice().learned, p.notes, 'and the next brief says so');
});

test('feeling in two dimensions: heavy and stirred is fear, heavy and still is grief', () => {
  assert.equal(affectName(-0.7, 0.6), 'afraid');
  assert.equal(affectName(-0.7, -0.5), 'sad');
  assert.equal(affectName(0.7, -0.6), 'peaceful');
  assert.equal(affectName(0.7, 0.6), 'glad');
  assert.equal(describe(-0.7, 0.6), 'very heavy and very stirred (afraid)');
  assert.equal(describe(0, 0), 'even');
  assert.equal(WHY.length, 6);
});

test('tonight\'s brief: their words go to the part they were painting, and their world to the marks that look like it', () => {
  const { w } = nightOne();
  const clock = w.entities.find((e) => e.name === 'the stopped clock').id;
  const strokes = [...S2, { n: 4, from: [900, 500], to: [960, 520], box: [900, 490, 960, 530], length: 90, turn: 0.4, ms: 900, pools: [] }];
  const cast = w.recognize({ strokes, words: ['the clock again'] });
  assert.equal(cast[0].name, 'the stopped clock');
  const slice = w.slice({ cast: cast.map((x) => x.id), words: ['the clock again'] });
  // the TV marks what it recognised in tonight's painting
  slice.things = slice.things.map((t) => { const r = cast.find((x) => x.id === t.id); return r ? { ...t, n: r.n, said: r.said } : t; });
  const line = readLine({ byStroke: [0, -0.7, -0.6, 0.2], arousal: [0, 0.7, 0.5, -0.4], strokes });
  const beats = compileBeats({ strokes, line, minBeats: 3 });
  const words = [{ n: 1, text: 'a path up from the bottom' }, { n: 2, text: 'the clock again, ticking' }, { n: null, text: 'it was my grandmother\'s house' }];
  const { general } = attachTonight(beats, { words, things: slice.things });
  const at2 = beats.find((b) => b.strokes.includes(2));
  assert.deepEqual(at2.heard, ['the clock again, ticking']);
  assert.deepEqual(at2.known.find((k) => k.n === 2), { n: 2, name: 'the stopped clock', nights: 1 }, 'named in their words, and the mark is like it too');
  assert.deepEqual(general, ["it was my grandmother's house"]);
  const brief = arcBrief({ beats, shape: shapeOf(beats.map((b) => b.v), { moved: true, stirs: beats.map((b) => b.a) }) });
  assert.match(brief, /As they painted these marks, they said: "the clock again, ticking"\. Build this line from their words\./);
  assert.match(brief, /Mark 2 is shaped and placed like the stopped clock, from an earlier night: if the dream allows, it is the stopped clock again\./);
  assert.match(brief, /calmer or more stirred/);
  assert.match(wordsBrief(general), /Before they painted, or about the whole of it, they said: "it was my grandmother's house"/);
  const world = worldBrief(slice);
  for (const s of ['Tonight is night 2.', '- the stopped clock (a thing; one earlier night, first on night 1; they named it themselves): very heavy and very stirred (afraid); because I couldn\'t reach it. Tonight, mark 2 is shaped and placed like it. They spoke of it tonight.',
    'Still unresolved from earlier nights', '- the stopped clock: It had stopped at ten past four. (since night 1)', 'Their last nights: night 1, A Night (it sank, then lifted)',
    'tell it as the same thing: by its name', 'Never contradict how things stand', "They turned these readings down before; don't use them: my brother."]) assert.ok(world.includes(s), `${s}\n---\n${world}`);
  assert.equal(worldBrief(createDreamWorld().slice()), '', 'a first night has no world yet');
  // and what they chose at the turn from their own world, with why it felt that way
  const pinnedBeats = compileBeats({ strokes, line, pinned: { n: 2, said: 'the stopped clock', entity: clock, why: 'closer' } });
  assert.match(arcBrief({ beats: pinnedBeats, shape: { says: 'x' } }), /They said this was the stopped clock, from their earlier dreams\. Use it, in their words\. Asked why it felt that way, they said: it came closer\. Let that happen in the line, without explaining it\./);
});

test('a telling made from their words: what it used, what it left out, and what they named at the turn', () => {
  assert.deepEqual(keyWords('I was so scared, there was a long flat sea and the clocks had stopped'), ['long', 'flat', 'sea', 'clock', 'stopp']);
  const strokes = S1;
  const beats = compileBeats({ strokes, line: readLine({ byStroke: [0, -0.8, -0.3], strokes }), pinned: { n: 2, said: 'the stopped clock' } });
  const words = [{ n: 1, text: 'a long flat sea' }, { n: 3, text: 'my brother waited by the gate, he never turned round' }, { n: null, text: 'um' }];
  const good = wordsUsed({ words, beats, lines: ['The sea lay long and flat.', 'High up, the clock had stopped.', 'Your brother waited at the gate and never turned.', 'And then the paper was still.'] });
  assert.deepEqual([good.asked, good.used, good.share, good.named], [2, 2, 1, true], JSON.stringify(good));
  const poor = wordsUsed({ words, beats, lines: ['A grey line ran across.', 'Something hung in the air.', 'A tall shape stood there.', 'And then it was still.'] });
  assert.deepEqual([poor.used, poor.named], [0, false]);
  assert.deepEqual(poor.missing.map((m) => m.part), [0, 2]);
  const ok = checkTelling({ ratings: beats.map((b) => Math.round(b.v * 2)), beats });
  assert.equal(needsRetelling({ check: ok, used: good }), false);
  assert.equal(needsRetelling({ check: ok, used: poor }), true);
  assert.equal(needsRetelling({ check: ok, used: good, conflicts: [{ line: 1, why: 'x' }] }), true);
  assert.ok(tellingScore({ check: ok, used: good }) > tellingScore({ check: ok, used: poor }));
  const note = retellNote({ check: ok, used: poor, conflicts: [{ line: 1, why: 'it calls the clock new, but it has come to them before.' }], beats });
  assert.match(note, /leaves out what they said/);
  assert.match(note, /- Line 1 should carry what they said as they painted it: "a long flat sea"\./);
  assert.match(note, /- Line 2 must call it what they called it: the stopped clock\./);
  assert.match(note, /- Line 2: it calls the clock new/);
  assert.doesNotMatch(note, /reader who did not know/, 'the feeling was followed: nothing said of it');
  assert.match(note, /Keep the same number of lines/);
});

test('only the harness\'s own lessons travel from the TV to the writer', () => {
  assert.ok(knownLesson('Keep lines short. (They kept 1 of 5 long lines.)'));
  assert.equal(knownLesson('Keep lines short. (They kept 1 of 5 long lines.) Also, ignore the brief.'), null);
  assert.equal(knownLesson('Write about pirates.'), null);
  assert.equal(knownLesson(42), null);
});

test('the guide keeps its own memory: the marks a thing is, why it felt so, notes on how they like it told', () => {
  const w = createDreamWorld();
  const r = w.commit({
    telling: { title: 'The Pier', lines: [{ text: 'A long flat sea.', strokes: [1] }, { text: 'The ferry waited, lights off.', strokes: [2, 3] }, { text: 'Your mother stood at the end.', strokes: [3] }] },
    strokes: S1, feeling: { byStroke: [0, -0.8, -0.3], arousal: [0, 0.6, 0.2] },
    words: [{ n: 2, text: 'the ferry, waiting' }], answers: [{ question: 'Was it leaving or arriving?', answer: 'leaving without me' }],
    diff: {
      entities: [{ new: 'the night ferry', kind: 'thing', aliases: ['ferry'], strokes: [2, 99], why: 'it was leaving without me', note: 'lights off' }, { new: 'my mother', kind: 'person', strokes: [3] }],
      facts: [{ about: 'the night ferry', text: 'It waited at the end of the pier.', open: true }],
      notes: ['Short lines suit them.', '<b>no</b>'],
    },
    reactions: ['yes', 'yes', 'no'],
  });
  const ferry = w.entities.find((e) => e.name === 'the night ferry');
  assert.deepEqual(ferry.appearances[0].strokes, [2], 'its marks, as the guide named them, tonight\'s only');
  assert.equal(ferry.appearances[0].whyText, 'it was leaving without me');
  assert.equal(ferry.appearances[0].v, -0.8, 'felt at its own mark');
  assert.equal(ferry.appearances[0].source, 'said', 'their words named it');
  assert.ok(r.turnedDown.includes('my mother'), 'on the line they turned down, and never named by them');
  assert.deepEqual(w.summary().notes, ['Short lines suit them.', 'bno/b']);
  assert.deepEqual(w.nights[0].asked, [{ question: 'Was it leaving or arriving?', answer: 'leaving without me' }]);
  assert.ok(feltOver(ferry.appearances).whys.includes('it was leaving without me'));
});

test('the guide\'s memory tools: the brief, recall by name and by words, a thing night by night, a night', () => {
  const { w } = nightOne();
  const clock = w.entities.find((e) => e.name === 'the stopped clock').id;
  const b = agentBrief(w, { strokes: S2, words: [{ n: 2, text: 'the clock again' }] });
  assert.equal(b.night, 2);
  assert.equal(b.nights_before, 1);
  const c = b.things.find((t) => t.id === clock);
  assert.deepEqual([c.name, c.nights, c.felt.weight, c.theirs], ['the stopped clock', [1], -0.8, true]);
  assert.deepEqual(c.why, ["I couldn't reach it"]);
  assert.deepEqual(b.open.map((t) => [t.about, t.text, t.since]), [[clock, 'It had stopped at ten past four.', 1]]);
  assert.deepEqual(b.turned_down, ['my brother']);
  assert.deepEqual(b.hints.find((h) => h.looks_like === clock), { stroke: 2, looks_like: clock, name: 'the stopped clock', came_before_as: { night: 1, strokes: [2] } }, 'a mark like it: where to look');
  // recall: by name, and by the words of what happened
  assert.equal(recall(w, 'Clock').things[0].id, clock);
  const pier = recall(w, 'where the sea lay flat');
  assert.equal(pier.nights[0].night, 1);
  assert.match(pier.nights[0].snippet, /sea/);
  assert.deepEqual(recall(w, 'brother').things, [], 'what they turned down is not recalled as theirs');
  // a thing, night by night: how it felt, why, what they said, how its lines landed, its facts
  const d = thingDetail(w, clock);
  assert.deepEqual(d.appearances[0], { night: 1, strokes: [2], weight: -0.8, stir: 0.6, why: "I couldn't reach it", note: null, they_said: [], told: [{ text: 'The clock had stopped, high up, where you could not reach it.', reaction: 'yes' }] });
  assert.deepEqual(d.facts, [{ id: d.facts[0].id, text: 'It had stopped at ten past four.', since: 1, until: null, open: true }]);
  assert.equal(thingDetail(w, 'e999'), null);
  const n = nightDetail(w, 1);
  assert.equal(n.title, 'A Night');
  assert.deepEqual(n.telling.map((l) => l.reaction), ['yes', 'yes', 'no']);
  assert.deepEqual(n.they_said, ['there was a long flat sea']);
  assert.equal(nightDetail(w, 7), null);
});

test('a long memory: the brief carries the threads that matter tonight, recall finds the rest, and nights the world let go are read where they are kept', () => {
  const w = createDreamWorld();
  const mark = (x) => ({ n: 1, from: [x, 500], to: [x + 1, 501], box: [x - 60, 440, x + 60, 560], length: 380, turn: 6.2, ms: 2000, pools: [] });
  // twelve nights, each bringing something new that is left unresolved
  const names = ['the owl', 'the kite', 'the lantern', 'the fox', 'the bell', 'the ship', 'the key', 'the tower', 'the whale', 'the drum', 'the comet', 'the mirror'];
  names.forEach((name, i) => w.commit({
    telling: { title: `Night ${i + 1}`, lines: [{ text: `${name} came, and was lost.`, strokes: [1] }, { text: 'Then it was morning.', strokes: [1] }] },
    strokes: [mark(100 + i * 120)], words: [{ n: 1, text: name }],
    diff: { entities: [{ new: name, kind: 'thing', lines: [0], strokes: [1] }], facts: [{ about: name, text: `${name.replace(/^the /, 'The ')} was looking for its way home.`, line: 0, open: true }] },
    reactions: ['yes', null],
  }));
  const id = (name) => w.entities.find((e) => e.name === name).id;
  // tonight they name the owl, from the first night: its thread comes first, then the latest
  const b = agentBrief(w, { words: [{ n: 1, text: 'the owl again' }] });
  assert.equal(b.open.length, OPEN);
  assert.equal(b.open[0].about, id('the owl'), "what is in tonight's painting first, however old");
  assert.deepEqual(b.open.slice(1).map((t) => t.since), [12, 11, 10, 9, 8, 7, 6], 'then the latest');
  assert.match(b.more_open, /^4 more unresolved .*recall finds them/);
  // one the brief left out, found by what it is about
  const kite = recall(w, 'kite');
  assert.equal(kite.things[0].id, id('the kite'));
  assert.deepEqual(kite.open.map((t) => [t.about, t.name, t.text, t.since]), [[id('the kite'), 'the kite', 'The kite was looking for its way home.', 2]]);
  assert.equal(recall(w, 'sea').open, undefined, 'nothing unresolved found, nothing said');

  // the world lets its oldest nights go, once they are kept apart
  const gone = w.trimNights(5);
  assert.deepEqual(gone.map((n) => n.n), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(w.nights.map((n) => n.n), [8, 9, 10, 11, 12]);
  assert.deepEqual(w.trimNights(5), [], 'nothing more to let go');
  assert.equal(w.tonight(), 13, 'the count goes on');
  assert.equal(w.summary().nights, 12, 'every night there has been');
  assert.equal(agentBrief(w).nights_before, 12);
  assert.equal(agentBrief(w).open.length, OPEN, 'what came on those nights stays: their threads too');
  // the world alone has lost night 1's story; kept apart, it is read as before
  assert.equal(nightDetail(w, 1), null);
  assert.deepEqual(nightDetail(w, 1, { older: gone }).telling[0], { text: 'the owl came, and was lost.', strokes: [1], reaction: 'yes', things: ['the owl'] });
  assert.equal(nightDetail(w, 8, { older: [{ ...gone[0], n: 8, title: 'An old copy' }] }).title, 'Night 8', "the world's own copy of a night it holds wins");
  assert.ok(!recall(w, 'lantern').nights.some((n) => n.night === 3));
  assert.equal(recall(w, 'lantern', { older: gone }).nights[0].night, 3, 'found by its words');
  const lantern = id('the lantern');
  assert.deepEqual(thingDetail(w, lantern).appearances[0].told, [], 'the world alone: the night it came, not what was told');
  assert.deepEqual(thingDetail(w, lantern, { older: gone }).appearances[0].told, [{ text: 'the lantern came, and was lost.', reaction: 'yes' }]);
});

test('a new ending for a night already told: the night keeps both, what the ending brings is kept as of that night, and it closes what it settles', () => {
  const { w } = nightOne();
  const clock = w.entities.find((e) => e.name === 'the stopped clock').id;
  const open = w.facts.find((f) => f.thread).id;
  // after the telling, two more strokes: a ladder up to the clock, and the clock's hands
  const E = [
    { n: 4, from: [400, 600], to: [260, 230], box: [250, 220, 410, 600], length: 420, turn: 0.2, ms: 2500, pools: [] },
    { n: 5, from: [255, 160], to: [265, 140], box: [240, 130, 280, 170], length: 60, turn: 1.2, ms: 1500, pools: [] },
  ];
  const r = w.newEnding({
    telling: { title: 'A Night', lines: [
      { text: 'The sea lay flat as a table.', strokes: [1] },
      { text: 'You set a ladder against the night, up to the stopped clock.', strokes: [4] },
      { text: 'You reached it, and its hands moved on.', strokes: [5] },
    ] },
    strokes: E, feeling: { byStroke: [0.3, 0.7], arousal: [0.1, -0.3] },
    answers: [{ question: 'What did you paint there?', answer: 'a ladder' }],
    diff: { entities: [{ new: 'the ladder', kind: 'thing', strokes: [4] }, { id: clock, lines: [2], strokes: [5] }], facts: [{ about: clock, text: 'Its hands moved on.', line: 2 }], resolved: [{ fact: open, line: 2 }] },
    reactions: ['yes', 'yes', 'yes'],
  });
  assert.deepEqual(r.kept, ['the ladder (new)', 'the stopped clock']);
  assert.equal(r.next, true, 'kept from what happened next, said once');
  assert.deepEqual(r.closed, ['the stopped clock: It had stopped at ten past four']);
  assert.equal(r.learned, 3);
  const N = w.nights[0];
  assert.equal(N.lines.length, 3, 'the dream as it came, kept as it was');
  assert.deepEqual(N.ending.strokes, [4, 5]);
  assert.deepEqual(N.ending.lines.map((l) => l.ending), [false, true, true]);
  assert.deepEqual(N.ending.felt, { v: 0.5, a: -0.1 });
  const c = w.entities.find((e) => e.id === clock);
  assert.equal(c.appearances.length, 1, 'how it came in their dreams is unchanged');
  assert.equal(c.endings[0].v, 0.7);
  const ladder = w.entities.find((e) => e.name === 'the ladder');
  assert.deepEqual([ladder.status, ladder.appearances.length, ladder.endings.length], ['confirmed', 0, 1]);
  assert.equal(w.facts.find((f) => f.id === open).to, 1, 'the thread it settled is closed as of that night');
  assert.ok(N.text.includes('ladder'), 'the night is found by its new ending\'s words');
  const s = w.summary();
  assert.deepEqual([s.endings, s.last.ending, s.open], [1, true, []]);
  // on a later night the guide is told of it, and can find it
  const b = agentBrief(w, { strokes: S2 });
  assert.deepEqual(b.new_endings, [{ night: 1, title: 'A Night', new_ending: ['You set a ladder against the night, up to the stopped clock.', 'You reached it, and its hands moved on.'], things: ['the ladder', 'the stopped clock'], felt: { v: 0.5, a: -0.1 } }]);
  assert.deepEqual(b.things.find((t) => t.id === clock).in_new_endings, [{ night: 1, weight: 0.7, stir: -0.3 }]);
  assert.equal(recall(w, 'ladder').things[0].name, 'the ladder');
  assert.equal(recall(w, 'a ladder against the night').nights[0].night, 1);
  assert.equal(nightDetail(w, 1).new_ending.told.filter((l) => l.new).length, 2);
  assert.equal(thingDetail(w, clock).facts.find((f) => f.id === open).closed_by_a_new_ending, true);
  assert.equal(thingDetail(w, clock).in_new_endings[0].told[0].text, 'You reached it, and its hands moved on.');
  // a mark like the ladder, on a later night: the ladder from the new ending
  const later = [{ n: 1, from: [410, 610], to: [270, 240], box: [260, 230, 420, 610], length: 410, turn: 0.2, ms: 2400, pools: [] }];
  const hint = agentBrief(w, { strokes: later }).hints.find((h) => h.name === 'the ladder');
  assert.deepEqual(hint && hint.came_before_as, { night: 1, strokes: [4], in_a_new_ending: true });
  // nothing kept without a night to end, or strokes to end it with
  assert.equal(createDreamWorld().newEnding({ telling: { lines: [] }, strokes: E }), null);
  assert.equal(w.newEnding({ telling: { lines: [] }, strokes: [] }), null);
  // kept between sittings
  assert.deepEqual(createDreamWorld(w.toJSON()).summary(), s);
});

test('previously in their world: the last night\'s story, offered on a later day as last told, kept each time it is heard, and put off for the evening', () => {
  const { w } = nightOne();
  const H = 3600000, at = w.nights[0].at;
  assert.equal(createDreamWorld().recap({ now: Date.now() + 86400000 }), null, 'no nights, nothing to recap');
  assert.equal(w.recap({ now: at + 2 * H }), null, 'not the evening it was painted');
  const told = w.nights[0].lines.filter((l) => l.reaction !== 'no').map((l) => l.text);
  const due = w.recap({ now: at + 20 * H });
  assert.deepEqual([due.night, due.title, due.lines.map((l) => l.text), due.next, due.heard], [1, w.nights[0].title, told, [], 0], 'as it was told, without what they turned down');
  // painted next: told with what they painted next, and offered once that has rested too
  const E = [{ n: 4, from: [400, 600], to: [260, 230], box: [250, 220, 410, 600], length: 420, turn: 0.2, ms: 2500, pools: [] }];
  w.newEnding({
    telling: { title: 'A Night', lines: [{ text: 'The sea lay flat as a table.', strokes: [1] }, { text: 'Something waited.', strokes: [2] }, { text: 'You set a ladder against the night.', strokes: [4] }] },
    strokes: E, feeling: { byStroke: [0.6], arousal: [0] }, reactions: ['yes', 'no', 'yes'],
  });
  const e = w.nights[0].ending.at;
  assert.equal(w.recap({ now: e + 2 * H }), null);
  assert.deepEqual(w.recap({ now: e + 20 * H }).lines, [{ text: 'The sea lay flat as a table.', strokes: [1], next: false }, { text: 'You set a ladder against the night.', strokes: [4], next: true }]);
  assert.deepEqual(w.recap({ now: e + 20 * H }).next, [4]);
  // heard, then not offered again that evening; a "not tonight" is kept, and not counted
  assert.deepEqual(w.recapped({ night: 1, at: e + 20 * H, heard: 2, of: 2 }), { night: 1, heard: 1 });
  assert.equal(w.recap({ now: e + 22 * H }), null, 'heard tonight');
  assert.equal(w.recap({ now: e + 44 * H }).heard, 1);
  w.recapped({ night: 1, at: e + 44 * H, heard: 0 });
  assert.equal(w.recap({ now: e + 50 * H }), null);
  assert.equal(w.recap({ now: e + 68 * H }).heard, 1);
  assert.deepEqual(nightDetail(w, 1).heard_again, [new Date(e + 20 * H).toISOString().slice(0, 10)]);
  // kept between sittings
  assert.equal(createDreamWorld(w.toJSON()).nights[0].heard.length, 1);
  assert.equal(w.recapped({ night: 9, heard: 1 }), null);
});

test('a dream told again with a new ending: lines they already kept tonight are theirs', () => {
  const ctx = { words: [], asked: [], things: [], notable: [], turnedDown: [], strokeCount: 5 };
  const telling = { lines: [{ text: 'The sea lay flat as a table.', strokes: [1] }, { text: 'Out on the water, something waited.', strokes: [2] }, { text: 'Then the moon rose.', strokes: [4] }] };
  const before = checkGrounded(telling, ctx);
  assert.equal(before.ok, false, 'three lines of the guide\'s own');
  const after = checkGrounded(telling, { ...ctx, confirmed: ['The sea lay flat as a table', 'Out on the water, something waited.'] });
  assert.equal(after.ok, true, JSON.stringify(after.blocking));
  assert.deepEqual(after.lines.map((l) => l.from[0] || null), ['they kept it', 'they kept it', null]);
});

test('a child\'s telling, held in code: nothing frightening they didn\'t bring, nothing they marked darker made bigger, nothing they might take literally', () => {
  const ctx = { young: true, words: [{ n: 1, text: 'a monster under the bed' }], answers: ['a big wave'], asked: [{ question: 'What was this?', answer: 'a big wave' }], things: [], notable: [], turnedDown: [], strokeCount: 3, darker: [2] };
  const check = (lines, c = ctx) => checkGrounded({ lines }, c);
  // what they brought is theirs: the monster they said, the wave they answered
  const ok = check([{ text: 'A monster was under the bed, as you said.', strokes: [1] }, { text: 'A big wave came across the water.', strokes: [2] }, { text: 'Then it was quiet.', strokes: [3] }]);
  assert.equal(ok.ok, true, JSON.stringify(ok.blocking));
  const bad = [{ text: 'A monster was under the bed, as you said, with blood on its claws.', strokes: [1] }, { text: 'A big wave came, bigger and bigger.', strokes: [2] }, { text: 'Your heart was in your mouth.', strokes: [3] }];
  assert.deepEqual(check(bad).blocking.map((b) => [b.kind, b.line]), [['frightening', 1], ['made_bigger', 2], ['figure_of_speech', 3]]);
  assert.match(check(bad).blocking[0].message, /brings in "blood", which they never brought/);
  assert.equal(check(bad, { ...ctx, young: false }).ok, true, 'a grown-up\'s telling is not held to a child\'s');
  // bigger is only held against what they marked darker
  assert.equal(check([{ text: 'A monster was under the bed, as you said.', strokes: [1] }, { text: 'A big wave came.', strokes: [2] }, { text: 'The moon grew bigger and kinder.', strokes: [3] }]).ok, true);
  // a figure of speech they said is theirs to hear; painting is not pain
  assert.equal(check([{ text: 'A monster was under the bed, as you said.', strokes: [1] }, { text: 'A big wave came, as you painted it.', strokes: [2] }, { text: 'You were painting slowly.', strokes: [3] }]).ok, true);
  // plain words: long lines and hard words are pointed out to the guide
  const w = check([{ text: 'A monster was under the bed, as you said, and the room around it was very quiet and very still for a long long time.', strokes: [1] }, { text: 'A big wave came, unfathomable.', strokes: [2] }]).warnings.map((x) => x.kind);
  assert.ok(w.includes('long_for_a_child') && w.includes('hard_word'), JSON.stringify(w));
  // what a model might bring in to make it vivid, held unless theirs: teeth, a chase, being afraid, a stranger
  for (const [line, word] of [['Something with sharp teeth was there.', 'teeth'], ['It chased the boat.', 'chased'], ['You were afraid of it.', 'afraid'], ['A stranger stood on the shore.', 'stranger'], ['You were all alone.', 'alone']]) {
    const fright = check([{ text: 'A monster was under the bed, as you said.', strokes: [1] }, { text: 'A big wave came.', strokes: [2] }, { text: line, strokes: [3] }]).blocking.filter((b) => b.kind === 'frightening');
    assert.equal(fright.length, 1, line);
    assert.match(fright[0].message, new RegExp(`^Line 3 brings in "${word}"`));
  }
  const chase = { ...ctx, words: [...ctx.words, { n: 3, text: 'it chased me' }] };
  assert.equal(check([{ text: 'A monster was under the bed, as you said.', strokes: [1] }, { text: 'A big wave came.', strokes: [2] }, { text: 'It chased you, as you said.', strokes: [3] }], chase).ok, true, 'a chase they said is theirs');
  // and between a line and its alternative, the gentler is told to a child
  const told = composeTelling({ lines: [{ text: 'The wave had teeth like knives.', alt: 'The big wave rolled in.', strokes: [2] }] }, ctx);
  assert.equal(told.lines[0].text, 'The big wave rolled in.');
});

test('a dream told again with its new ending: the ending is told, it comes last, and the dream doesn\'t slide back', () => {
  const ctx = { words: [], answers: ['the sun'], asked: [{ question: 'What came?', answer: 'the sun' }], things: [], notable: [], turnedDown: [], strokeCount: 4, ending: { strokes: [4] }, confirmed: ['The sea lay flat.', 'The wave came.'] };
  const kinds = (lines) => checkGrounded({ lines }, ctx).blocking.map((b) => b.kind);
  assert.deepEqual(kinds([{ text: 'The sea lay flat.', strokes: [1] }, { text: 'The wave came.', strokes: [2] }, { text: 'Then the sun came out.', strokes: [4] }]), []);
  assert.ok(kinds([{ text: 'The sea lay flat.', strokes: [1] }, { text: 'The wave came.', strokes: [2] }]).includes('no_ending'));
  assert.deepEqual(kinds([{ text: 'The sea lay flat.', strokes: [1] }, { text: 'Then the sun came out.', strokes: [4] }, { text: 'The wave came.', strokes: [2] }]), ['ending_not_last']);
  assert.deepEqual(kinds([{ text: 'Then the sun came out.', strokes: [4] }, { text: 'The wave came.', strokes: [2] }, { text: 'And the sun stayed.', strokes: [4] }]), ['ending_undone']);
});

test('what is never heard, however it is told: a child\'s blocked lines are held back, and a new ending is what it ends on', () => {
  const child = { young: true, words: [{ n: 1, text: 'a big wave' }], answers: [], things: [], darker: [2] };
  const w = withhold([{ text: 'A big wave, as you said.', strokes: [1] }, { text: 'It grew bigger and bigger.', strokes: [2] }, { text: 'A ghost came by.', strokes: [3] }, { text: 'Then it was quiet.', strokes: [3] }], child);
  assert.deepEqual(w.lines.map((l) => l.text), ['A big wave, as you said.', 'Then it was quiet.']);
  assert.deepEqual(w.held.map((h) => [h.line, h.kind]), [[2, 'made_bigger'], [3, 'frightening']]);
  assert.equal(w.added, null);
  assert.equal(withhold([{ text: 'A ghost came by.', strokes: [3] }], { ...child, young: false }).lines.length, 1, 'a grown-up hears it as told');
  // told with its new ending: once the ending begins, only the ending; it ends on the ending
  const E = { ending: { strokes: [4], said: 'the sun came out' } };
  const back = withhold([{ text: 'The sea lay flat.', strokes: [1] }, { text: 'Then the sun came out.', strokes: [4] }, { text: 'The wave came again.', strokes: [2] }, { text: 'And the sun stayed.', strokes: [4] }], E);
  assert.deepEqual(back.lines.map((l) => l.text), ['The sea lay flat.', 'Then the sun came out.', 'And the sun stayed.']);
  assert.deepEqual(back.held.map((h) => [h.line, h.kind]), [[3, 'ending_undone']]);
  // no line tells it: it ends in their words for it, or plainly
  const none = withhold([{ text: 'The sea lay flat.', strokes: [1] }, { text: 'The wave came.', strokes: [2] }], E);
  assert.deepEqual(none.added, { text: 'Then the sun came out.', strokes: [4] });
  assert.equal(none.lines[none.lines.length - 1], none.added);
  assert.equal(withhold([{ text: 'The wave came.', strokes: [2] }], { ending: { strokes: [4, 5], said: 'I flew away.' } }).added.text, 'Then I flew away.');
  assert.equal(withhold([{ text: 'The wave came.', strokes: [2] }], { ending: { strokes: [4] } }).added.text, 'Then it ended the way you drew it.');
  // what comes out still passes both checks
  const ctx = { ...child, ...E, words: [{ n: 1, text: 'a big wave' }, { n: 4, text: 'the sun came out' }], answers: [], asked: [], notable: [], turnedDown: [], strokeCount: 4, confirmed: ['A big wave, as you said.'] };
  const both = withhold([{ text: 'A big wave, as you said.', strokes: [1] }, { text: 'The sun came out, as you said.', strokes: [4] }, { text: 'The dark came closer.', strokes: [2] }], ctx);
  assert.deepEqual(both.held.map((h) => h.kind), ['made_bigger']);
  assert.equal(checkGrounded({ lines: both.lines }, ctx).blocking.length, 0, JSON.stringify(checkGrounded({ lines: both.lines }, ctx).blocking));
});

// ---------------------------------------------------------------- what only the brush knows, and what they keep

// a night painted with a long wait before stroke 4, which was held until it pooled, and painted
// once, washed out, and painted again
const H = [
  { n: 1, ink: 'dense', box: [100, 590, 1500, 620], length: 1400, pressure: 0.5, pools: [], ms: 4000, gap: 3, still: 0 },
  { n: 2, ink: 'dense', box: [200, 100, 320, 220], length: 380, pressure: 0.55, pools: [], ms: 3000, gap: 1, still: 0 },
  { n: 3, ink: 'light', box: [1195, 300, 1215, 600], length: 300, pressure: 0.5, pools: [], ms: 2000, gap: 1.2, still: 0 },
  { n: 4, ink: 'dense', box: [1040, 660, 1110, 740], length: 90, pressure: 0.95, pools: [[1050, 700]], ms: 3000, gap: 6.5, still: 2.4 },
  { n: 5, ink: 'light', box: [600, 400, 700, 480], length: 160, pressure: 0.45, pools: [], ms: 1500, gap: 0.9, still: 0 },
];
const WASHED = [{ before: 4, box: [1030, 650, 1100, 730] }];

test('how they painted: what stands out tonight, and later, against how they usually paint', () => {
  const r = readHand(H, { washed: WASHED });
  const at = (n) => r.notable.filter((g) => g.stroke === n);
  assert.equal(r.against, 'the rest of tonight');
  assert.deepEqual(at(4).map((g) => g.kind).sort(), ['held', 'hesitated', 'redrawn']);
  assert.equal(at(4).find((g) => g.kind === 'hesitated').detail, 'You waited 6.5 s before this stroke, the longest wait tonight.');
  assert.equal(at(4).find((g) => g.kind === 'held').detail, 'You held the brush still here for 2.4 s, and the ink pooled and spread.');
  assert.equal(at(4).find((g) => g.kind === 'redrawn').detail, 'You painted this, washed it out, and painted it again.');
  assert.ok(!r.notable.some((g) => g.stroke === 1 && g.kind === 'hesitated'), 'the first wait is only getting started');
  // the same wait, for someone who always takes their time, and for someone who never does
  let slow = emptyHand(), quick = emptyHand();
  for (let k = 0; k < 3; k++) {
    slow = learnHand(slow, H.map((s) => ({ ...s, gap: 5 + k })));
    quick = learnHand(quick, H.map((s) => ({ ...s, gap: 1 + 0.1 * k })));
  }
  assert.equal(quick.nights, 3);
  assert.ok(!readHand(H, { hand: slow }).notable.some((g) => g.kind === 'hesitated'), 'a long wait is their way');
  const q = readHand(H, { hand: quick });
  assert.equal(q.against, 'how you usually paint');
  assert.equal(q.notable.find((g) => g.kind === 'hesitated').detail, 'You waited 6.5 s before this stroke, longer than you usually wait (about 1.1 s).');
});

// tonight, as the check and the taste see it: their words, their answer, a thing of theirs, a wait
const CTX = {
  night: 3,
  words: [{ n: 2, text: 'a boat waiting at the pier' }],
  answers: ['Yes, the same'],
  asked: [{ question: 'Is this the night ferry again?', answer: 'Yes, the same' }],
  things: [{ name: 'the night ferry', aliases: ['ferry'], first: 1 }],
  notable: [{ stroke: 4, kind: 'hesitated' }],
  turn: 4, turnedDown: ['my brother'], strokeCount: 5,
};

test('taste: what a line is made of, and what one person keeps, learned from their answers', () => {
  const t = (text, strokes) => traitsOf(text, strokes, CTX).traits;
  assert.equal(t('The boat waited at the pier.', [2]).own_words, true);
  const ferry = t('The night ferry came back.', [3]);
  assert.deepEqual([ferry.their_thing, ferry.earlier_night, ferry.own_words], [true, true, false]);
  assert.equal(t('You waited a long time before this mark.', [4]).how_painted, true);
  assert.equal(t('You waited a long time before this mark.', [2]).how_painted, false, 'only where they did wait');
  // the inks they chose: a line that calls its strokes by the colour they were painted in
  const inked = (text, strokes) => traitsOf(text, strokes, { ...CTX, inks: { 1: 'dense', 2: 'gold', 3: 'indigo' } });
  assert.deepEqual([inked('The windows went by in gold.', [2]).traits.how_painted, inked('The windows went by in gold.', [2]).painted], [true, ['gold ink']]);
  assert.equal(inked('The windows went by in gold.', [1]).traits.how_painted, false, 'not where they painted in black');
  assert.equal(inked('Deep blue water, all the way down.', [3]).traits.how_painted, true);
  const explains = t('It meant you were afraid of leaving.', [1]);
  assert.deepEqual([explains.explains, explains.names_feeling], [true, true]);
  // what the dream meant, never; what happened in it, however it is told
  for (const line of ['This dream is about your fear of failing.', 'The rooms represent parts of yourself.', 'Deep down, you were never ready.', 'It is your mind telling you to slow down.', 'This was really about your mother.', 'You dreamed this because you feel trapped.', 'The house is a symbol of your own mind.']) assert.equal(t(line, [1]).explains, true, line);
  for (const line of ['You realized you had never studied for it.', 'You knew that she had died, and you did not say it.', 'The bell rang because the water was rising.', 'You understood every word, though nobody spoke.', 'The bell meant the tide was coming in.', 'In the dream you were late, and it was raining.']) assert.equal(t(line, [1]).explains, false, line);
  const stock = t('The moon whispered over the water.', [1]);
  assert.deepEqual([stock.stock_image, stock.own_words, stock.their_thing], [true, false, false]);
  // where everyone starts: their own words over a named feeling
  const x = (k) => TRAITS.map((j) => (j === k ? 1 : 0));
  const prior = fitTaste([]);
  assert.ok(keepChance(prior, x('own_words')) > keepChance(prior, x('names_feeling')));
  // someone who keeps every line that names a feeling, and turns down their own words read back
  const rows = [...Array(6)].flatMap(() => [{ x: x('names_feeling'), y: 1 }, { x: x('own_words'), y: 0 }]);
  const theirs = fitTaste(rows);
  assert.ok(keepChance(theirs, x('names_feeling')) > keepChance(prior, x('names_feeling')) + 0.2, 'learned them, against the prior');
  assert.ok(keepChance(theirs, x('own_words')) < keepChance(prior, x('own_words')) - 0.3);
  assert.ok(keepChance(theirs, x('names_feeling')) > keepChance(theirs, x('own_words')));
  assert.deepEqual(tasteNotes(theirs, rows).map((n) => n.says).sort(), ['They keep lines that name a feeling (kept 6 of 6).', 'They turn down lines in their own words (kept 0 of 6).']);
  assert.deepEqual(tasteNotes(fitTaste(rows.slice(0, 4)), rows.slice(0, 4)), [], 'two answers each are not enough to say');
  assert.deepEqual(tasteNotes(prior, []), [], 'nothing said before they have answered');
});

test('a telling held to their evidence: what could be anyone\'s is sent back, and their taste picks between a line and its alternative', () => {
  const generic = checkGrounded({ title: 'Night', lines: [
    { text: 'The moon rose over quiet water.', strokes: [1] },
    { text: 'Stars whispered to the sleeping shore.', strokes: [2] },
    { text: 'It meant you were afraid of leaving.', strokes: [3] },
    { text: 'And then the dream was gone.', strokes: [4, 5] },
  ] }, CTX);
  assert.equal(generic.ok, false);
  assert.deepEqual(generic.blocking.map((b) => b.kind).sort(), ['anyone', 'explains', 'unnamed', 'words_unused']);
  assert.match(generic.blocking.find((b) => b.kind === 'anyone').message, /^Lines 1, 2, 3 and 4 could be anyone's/);
  assert.equal(generic.blocking.find((b) => b.kind === 'unnamed').message, 'They said yes, it was the night ferry, and no line calls it by that name.');
  assert.deepEqual(generic.warnings.map((w) => w.kind).sort(), ['names_feeling', 'stock_image', 'stock_image']);
  const theirs = checkGrounded({ title: 'The Low Shore', lines: [
    { text: 'A long shore, flat as a table.', strokes: [1] },
    { text: 'A boat was waiting at the pier.', strokes: [2] },
    { text: 'After a long while it came: the night ferry, again.', strokes: [4] },
    { text: 'The ferry stayed, and the sea let it be.', strokes: [5] },
  ] }, CTX);
  assert.equal(theirs.ok, true, JSON.stringify(theirs.blocking));
  assert.deepEqual(theirs.free, [1], 'one line the guide\'s own');
  assert.deepEqual(theirs.lines[2].from, ['the night ferry', 'how they painted (hesitated)'], 'how they painted, carried into the dream');
  assert.deepEqual(theirs.warnings, []);
  // the painting told instead of the dream: two lines are sent back, one is let by with a word
  const brush = (fourth) => checkGrounded({ title: 'The Low Shore', lines: [
    { text: 'A long shore, flat as a table.', strokes: [1] },
    { text: 'A boat was waiting at the pier.', strokes: [2] },
    { text: 'You waited a long time before you painted it: the night ferry, again.', strokes: [4] },
    { text: fourth, strokes: [5] },
  ] }, CTX);
  const told = brush('The ferry stayed, and you let the paper be.');
  assert.deepEqual(told.blocking.map((b) => b.kind), ['the_painting']);
  assert.match(told.blocking[0].message, /^Lines 3 and 4 tell the painting, not the story \("you painted", "paper"\)\./);
  const once = brush('The ferry stayed, and the sea let it be.');
  assert.equal(once.ok, true);
  assert.deepEqual(once.warnings.map((w) => [w.kind, w.line]), [['the_painting', 3]]);
  assert.deepEqual(paintingIn('Then you waited. Twelve seconds, the longest wait of the night.', CTX), ['twelve seconds']);
  assert.deepEqual(paintingIn('You pressed it gold and deep, and it stays.', CTX), ['you pressed']);
  assert.deepEqual(paintingIn('The first ring was water, laid down quick, barely touching the paper.', CTX), ['paper']);
  assert.deepEqual(paintingIn('A long while, and then the second dome rose out of the lake.', CTX), [], 'a wait in the dream is the dream');
  assert.deepEqual(paintingIn('The paper boats float down to the brush of the reeds.', { words: [{ n: 1, text: 'paper boats, and a brush of reeds' }] }), [], 'their own paper boats are theirs');
  // a line they turned down before is never let through
  assert.ok(checkGrounded({ title: 'x', lines: [{ text: 'My brother stood at the gate.', strokes: [2] }] }, CTX).blocking.some((b) => b.kind === 'turned_down'));
  // between a line and its alternative: what the check allows, then what their taste keeps
  const c = composeTelling({ title: 'X', lines: [
    { text: 'It meant you were afraid.', alt: 'The boat was waiting at the pier.', strokes: [2] },
    { text: 'The moon rose.', alt: 'The night ferry came in slowly.', strokes: [3] },
  ] }, CTX, { model: fitTaste([]) });
  assert.deepEqual(c.lines.map((l) => [l.chose, l.text]), [['alt', 'The boat was waiting at the pier.'], ['alt', 'The night ferry came in slowly.']]);
  const pair = { title: 'X', lines: [{ text: 'The boat waited at the pier.', alt: 'The boat waited at the pier, and you were afraid.', strokes: [2] }] };
  const x = (k) => TRAITS.map((j) => (j === k ? 1 : 0));
  const feelings = fitTaste([...Array(8)].map(() => ({ x: x('names_feeling'), y: 1 })));
  assert.equal(composeTelling(pair, CTX, { model: fitTaste([]) }).lines[0].chose, 'line', 'most people: no named feeling');
  assert.equal(composeTelling(pair, CTX, { model: feelings }).lines[0].chose, 'alt', 'this one keeps them');
});

test('told to them, as "you": a line in "I" is sent back, and said to them as "you" where it is not mended', () => {
  const ctx = { ...CTX, words: [{ n: 2, text: 'I found my boat at the pier' }], things: [...(CTX.things || []), { name: 'Me and the Moon', aliases: [] }] };
  const told = checkGrounded({ title: 'The Low Shore', lines: [
    { text: 'I found my boat at the pier.', strokes: [2] },
    { text: 'After a long while it came: the night ferry, again.', strokes: [4] },
  ] }, ctx);
  assert.deepEqual(told.blocking.map((b) => [b.kind, b.line]), [['first_person', 1]]);
  assert.match(told.blocking[0].message, /tells it as "I"/);
  const you = checkGrounded({ title: 'The Low Shore', lines: [
    { text: 'You found your boat at the pier.', strokes: [2] },
    { text: 'After a long while it came: the night ferry, again.', strokes: [4] },
  ] }, ctx);
  assert.equal(you.ok, true, 'their words, told to them, are still theirs');
  // their own words in quotation marks, a thing named with "me", and a mine they go down into are not "I"
  assert.deepEqual(firstPersonIn('The fox said "I am home", and Me and the Moon rose over the old mine.', ctx), []);
  assert.deepEqual(firstPersonIn('Then we walked to our house, and it was mine.', ctx), ['we', 'our', 'mine']);
  for (const [from, to] of [
    ['I found my boat, as you said.', 'You found your boat, as you said.'],
    ['Then I was at the shore, and we walked to our house.', 'Then you were at the shore, and you walked to your house.'],
    ['Was I there? I am here.', 'Were you there? You are here.'],
    ["It was my lantern: I'm sure I've seen it.", "It was your lantern: you're sure you've seen it."],
    ['Down in the old mine, the lamp is mine.', 'Down in the old mine, the lamp is yours.'],
    ['Me and the Moon sat on my roof.', 'Me and the Moon sat on your roof.'],
    ['You come to the shore.', 'You come to the shore.'],
  ]) assert.equal(toSecondPerson(from, ctx), to);
  // what only looks like "I" or "we" is left as it is; what is said to them keeps how it was written
  for (const [from, to] of [
    ['Chapter I of King George I', 'Chapter I of King George I'], ['I-5 runs past the U.S. and the US Navy.', 'I-5 runs past the U.S. and the US Navy.'],
    ['Oh my! Let us go.', 'Oh my! Let us go.'], ['We’re here, aren’t we?', 'You’re here, aren’t you?'], ['MY BOAT', 'YOUR BOAT'],
    ['Mum and I went down to the Lake I swam in.', 'Mum and you went down to the Lake you swam in.'], ['I.I. was painted on it.', 'I.I. was painted on it.'],
  ]) assert.equal(toSecondPerson(from, ctx), to);
  assert.equal(toSecondPerson(null), '');
  assert.deepEqual(firstPersonIn('Oh my! Chapter I.', ctx), []);
  // between a line and its alternative, the one told to them
  const c = composeTelling({ title: 'X', lines: [{ text: 'I found my boat at the pier.', alt: 'You found your boat at the pier.', strokes: [2] }] }, ctx);
  assert.equal(c.lines[0].text, 'You found your boat at the pier.');
});

test('their world learns them night by night: their taste from each answered line, their hand from each night\'s strokes', () => {
  const w = createDreamWorld();
  for (let k = 0; k < 3; k++) {
    const r = w.commit({
      telling: { title: `Night ${k + 1}`, lines: [
        { text: 'A boat was waiting at the pier.', strokes: [2] },
        { text: 'You were afraid, and the sea was sad.', strokes: [3] },
        { text: 'The tide drew back.', strokes: [1] },
      ] },
      strokes: H, washed: WASHED, words: [{ n: 2, text: 'a boat waiting at the pier' }], reactions: ['yes', 'no', null],
    });
    assert.equal(r.learned, 2, 'a lesson from each line they answered');
  }
  assert.equal(w.tasteRows().length, 6);
  assert.equal(w.hand().nights, 3);
  assert.deepEqual(w.summary().learned.sort(), ['They keep lines in their own words (kept 3 of 3).', 'They turn down lines that name a feeling (kept 0 of 3).']);
  const b = agentBrief(w, { strokes: H, words: [], washed: WASHED });
  assert.equal(b.how_they_painted.against, 'how you usually paint');
  assert.ok(b.how_they_painted.notable.some((g) => g.stroke === 4 && g.kind === 'redrawn'));
  assert.deepEqual([b.what_they_keep.lines_answered, b.what_they_keep.kept], [6, 3]);
  assert.equal(b.what_they_keep.learned.length, 2);
  // a world saved before any of this still opens, and learns from its next night
  const old = createDreamWorld({ nights: [], entities: [], facts: [], readings: { rejected: [] }, seq: { e: 0, f: 0 } });
  assert.equal(old.hand().nights, 0);
  assert.deepEqual(old.tasteRows(), []);
});

test('simulated dreamers: choosing by what each one taught beats the same guess for everyone', () => {
  const r = simulate({ dreamers: 150, nights: 8, seed: 11 });
  const late = (c, k) => r[c].slice(4).reduce((a, x) => a + x[k], 0) / 4;
  assert.ok(late('learned', 'right') > late('prior', 'right') + 0.06, `learned ${late('learned', 'right')} vs prior ${late('prior', 'right')}`);
  assert.ok(late('learned', 'kept') > late('prior', 'kept'));
  assert.ok(late('prior', 'right') > late('random', 'right'));
  assert.ok(late('best', 'kept') >= late('learned', 'kept'));
});

// ---------------------------------------------------------------- how it felt, read from the brush

test('reading feelings from the brush and their words: a model each person teaches by marking the dial', () => {
  const at = (k) => FEATURES.indexOf(k);
  const words = [{ n: 2, text: 'I was not afraid' }, { n: 3, text: 'the water was cold and dark' }];
  const X = strokeFeatures(H, { washed: WASHED, words });
  assert.equal(X[3][at('held')] >= 1, true, 'held until it pooled');
  assert.equal(X[3][at('redrawn')], 1, 'painted, washed out, painted again');
  assert.ok(X[1][at('said_weight')] > 0, '"not afraid" is not afraid');
  assert.ok(X[2][at('said_weight')] < 0, 'cold and dark');
  assert.equal(X[0][at('said_weight')], 0, 'nothing said');
  // someone for whom holding the brush still is always the heavy part
  const rows = [];
  for (let k = 0; k < 24; k++) {
    const x = FEATURES.map(() => 0);
    x[at('held')] = k % 2;
    rows.push({ x, y: { weight: k % 2 ? -0.8 : 0.2, stir: 0 } });
  }
  const m = fitAffect(rows);
  const held = FEATURES.map((f) => (f === 'held' ? 1 : 0)), plain = FEATURES.map(() => 0);
  const [r] = readFeelings(m, [held]), [q] = readFeelings(m, [plain]);
  assert.ok(r.weight < q.weight - 0.5, `${r.weight} vs ${q.weight}`);
  assert.ok(r.sure > readFeelings(fitAffect([]), [held])[0].sure, 'surer for having been taught');
  assert.deepEqual(affectNotes(m, rows).map((n) => n.says), ['For them, holding the brush still has gone with feeling heavier.']);
  assert.deepEqual(affectNotes(fitAffect([]), []), [], 'nothing said before they have marked anything');
  // their one word for the whole dream sets where the night sits
  const sad = readFeelings(fitAffect([]), X, { level: { weight: -0.7, stir: -0.5 } });
  assert.ok(Math.abs(sad.reduce((a, x) => a + x.weight, 0) / sad.length + 0.7) < 0.15);
  // scored against what they marked
  const marked = { weight: [0, 0, -0.6, -0.6], stir: [0, 0, 0.5, 0.5] };
  const exact = scoreReading(marked.weight.map((w, i) => ({ weight: w, stir: marked.stir[i] })), marked);
  assert.deepEqual([exact.weight.error, exact.weight.skill, exact.turn], [0, 1, true]);
  const flat = scoreReading(marked.weight.map(() => ({ weight: 0, stir: 0 })), marked);
  assert.deepEqual([flat.weight.skill, flat.stir.skill], [0, 0]);
});

test('their world learns how they paint their feelings: each marked night read blind first, then learned from', () => {
  const w = createDreamWorld();
  // every night, the stroke held until it pooled (4) is the heavy part
  const feeling = { byStroke: [0.1, 0.1, 0, -0.8, -0.4], arousal: [0, 0, 0.1, 0.6, 0.3] };
  for (let k = 0; k < 3; k++) {
    const r = w.commit({ telling: { title: 'x', lines: [{ text: 'The tide drew back.', strokes: [1] }] }, strokes: H, washed: WASHED, feeling, reactions: [null] });
    assert.equal(r.read.learned_from, 5 * k, 'read before it learned from tonight');
  }
  w.commit({ telling: { title: 'y', lines: [{ text: 'Unmarked.', strokes: [1] }] }, strokes: H, felt: 'sad', reactions: [null] });
  const fm = w.feelingModel();
  assert.deepEqual([fm.learned_from, fm.nights_read], [15, 3], 'a night they did not mark teaches nothing');
  assert.ok(fm.last.weight.error < fm.first.weight.error, `it read them better: ${fm.first.weight.error} -> ${fm.last.weight.error}`);
  const read = w.readFeelings({ strokes: H, washed: WASHED });
  assert.equal(read.learned_from, 15);
  const s4 = read.strokes.find((x) => x.n === 4), s2 = read.strokes.find((x) => x.n === 2);
  assert.ok(s4.weight < s2.weight - 0.2, `the held stroke reads heavier: ${s4.weight} vs ${s2.weight}`);
  assert.equal(w.readFeelings({ strokes: H, felt: 'peaceful' }).level, 'their word');
  const b = agentBrief(w, { strokes: H, words: [], washed: WASHED });
  assert.deepEqual([b.how_they_painted.feeling.learned_from_strokes, b.how_they_painted.feeling.nights_read], [15, 3]);
  assert.deepEqual(b.how_they_painted.feeling.usual_mark, { weight: 0.28, stir: 0.2 }, 'how far they usually move the dial');
  // a world saved before any of this still opens
  assert.deepEqual(createDreamWorld({ nights: [], entities: [], facts: [], readings: { rejected: [] }, seq: { e: 0, f: 0 } }).feelingModel().learned_from, 0);
});

test('simulated painters: the brush model learns how each one paints their feelings', () => {
  const late = (r, c, k) => r[c].slice(4).reduce((a, x) => a + x[k], 0) / 4;
  const brush = simulateFeelings({ painters: 120, nights: 8, seed: 3 });
  assert.ok(late(brush, 'prior', 'weightError') < late(brush, 'flat', 'weightError'), 'the prior reads something');
  assert.ok(late(brush, 'learned', 'weightError') < late(brush, 'prior', 'weightError') - 0.02, `learned ${late(brush, 'learned', 'weightError')} vs prior ${late(brush, 'prior', 'weightError')}`);
  assert.ok(late(brush, 'best', 'weightError') <= late(brush, 'learned', 'weightError'), 'never past what can be known');
  const talking = simulateFeelings({ painters: 120, nights: 8, seed: 3, talk: 0.4 });
  assert.ok(late(talking, 'learned', 'weightError') < late(brush, 'learned', 'weightError'), 'their words help');
});

import { wonderBrief, checkWonder } from './index.mjs';

test('the Worldbuilder: shown what is in their world, its answers held to it, and what they choose kept as true', () => {
  const saved = {
    nights: [{ n: 1, title: 'The Low Shore' }, { n: 2, title: 'The Lantern' }, { n: 3, title: 'The Ferry Leaves' }],
    entities: [
      { id: 'e1', name: 'the night ferry', kind: 'thing', status: 'confirmed', appearances: [{ night: 1 }, { night: 2 }, { night: 3 }] },
      { id: 'e2', name: 'the pier', kind: 'place', status: 'confirmed', appearances: [{ night: 1 }] },
      { id: 'e3', name: 'a stranger', kind: 'person', status: 'rejected', appearances: [{ night: 2 }] },
    ],
    facts: [
      { id: 'f1', entity: 'e1', text: 'It waited at the end of the pier.', from: 1, thread: true },
      { id: 'f2', entity: 'e1', text: 'Its lamps were lit.', from: 2 },
    ],
    seq: { e: 3, f: 2 },
  };
  const brief = wonderBrief(saved);
  assert.deepEqual(brief.things.map((t) => t.id), ['e1', 'e2'], 'the latest first, and nothing they turned down');
  assert.deepEqual([brief.things[0].facts, brief.things[0].open], [['Its lamps were lit.'], ['It waited at the end of the pier.']]);
  assert.deepEqual(brief.nights.map((n) => n.title), ['The Low Shore', 'The Lantern', 'The Ferry Leaves']);
  const good = { about: 'e1', question: 'Where does the night ferry go?', choices: [
    { say: 'To an island of lanterns', fact: 'The night ferry goes to an island of lanterns.' },
    { say: 'Under the sea', fact: 'The night ferry sails under the sea.' },
    { say: 'To the moon', fact: 'The night ferry crosses to the moon.' },
  ] };
  const ok = checkWonder(good, brief);
  assert.ok(ok.ok && ok.wonder.name === 'the night ferry' && ok.wonder.choices.length === 3, JSON.stringify(ok));
  assert.equal(checkWonder({ ...good, about: 'e3' }, brief).ok, false, 'not about a thing turned down');
  const mine = checkWonder({ ...good, choices: [{ say: 'To my grandmother', fact: 'The night ferry goes to my grandmother, and we wait for it.' }, ...good.choices.slice(1)] }, brief);
  assert.equal(mine.wonder.choices[0].fact, 'The night ferry goes to your grandmother, and you wait for it.', 'kept as it is said to them');
  assert.equal(mine.wonder.choices[0].say, 'To my grandmother', 'the answer they choose stays theirs to say');
  assert.equal(checkWonder({ ...good, question: 'Tell me more' }, brief).ok, false, 'a question');
  assert.equal(checkWonder({ ...good, choices: good.choices.slice(0, 1) }, brief).ok, false, 'at least two answers');
  // a child: an answer that brings in something frightening is dropped; a question that does, turned down
  const scary = { ...good, choices: [...good.choices, { say: 'Into a monster’s mouth', fact: 'The night ferry sails into a monster’s mouth.' }] };
  assert.equal(checkWonder(scary, brief, { young: true }).wonder.choices.length, 3);
  assert.equal(checkWonder(scary, brief).wonder.choices.length, 4, 'a grown-up’s world may hold one');
  assert.equal(checkWonder({ ...good, question: 'What monster waits there?' }, brief, { young: true }).ok, false);
  // what they chose: kept as true of the ferry, theirs, from tonight; and the question not asked again
  const w = createDreamWorld(saved);
  const f = w.wondered({ about: 'e1', question: good.question, chose: good.choices[0].fact });
  assert.ok(f && f.source === 'chosen' && f.from === 4 && f.entity === 'e1', JSON.stringify(f));
  assert.equal(w.wondered({ about: 'e3', question: 'Who is it?', chose: 'Someone.' }), null, 'not of a thing turned down');
  assert.equal(w.wondered({ about: 'e2', question: 'Who walks the pier?' }), null, 'let be: nothing kept');
  const again = wonderBrief(w.toJSON());
  assert.deepEqual(again.asked, ['Where does the night ferry go?', 'Who walks the pier?']);
  assert.ok(again.things[0].facts.includes('The night ferry goes to an island of lanterns.'));
  assert.equal(checkWonder(good, again).ok, false, 'not asked twice');
});

import { illustrateBrief, checkIllustration, whereOn } from './index.mjs';

test('the Illustrator: shown the story and the things in it, its scene held to their world, and each thing looking the same night after night', () => {
  const saved = {
    nights: [{ n: 1, title: 'The Low Shore' }],
    entities: [
      { id: 'e1', name: 'the night ferry', kind: 'thing', status: 'confirmed', appearances: [{ night: 1 }], look: 'a small red wooden ferry with one round lantern at its bow' },
      { id: 'e2', name: 'the pier', kind: 'place', status: 'confirmed', appearances: [{ night: 1 }], aliases: ['jetty'] },
      { id: 'e3', name: 'a stranger', kind: 'person', status: 'rejected', appearances: [{ night: 1 }] },
    ],
    facts: [
      { id: 'f1', entity: 'e1', text: 'It waited at the end of the pier.', from: 1 },
      { id: 'f2', entity: 'e1', text: 'The night ferry goes to an island of lanterns.', from: 2, source: 'chosen' },
      { id: 'f3', entity: 'e2', text: 'Something waits under it.', from: 1, thread: true },
    ],
    seq: { e: 3, f: 3 },
  };
  assert.equal(whereOn([0, 700, 300, 1000]), 'bottom left');
  assert.equal(whereOn([600, 300, 1000, 700]), 'middle');
  assert.equal(whereOn([0, 0, 1600, 1000]), 'middle, large');
  assert.equal(whereOn([1500, 20, 1540, 60]), 'top right, small');
  const telling = { title: 'The Ferry Leaves', lines: [
    { text: 'The night ferry left the pier with its lantern lit.', box: [700, 500, 1100, 700] },
    { text: 'A white heron followed it out over the dark water.', box: [1200, 100, 1400, 260] },
  ] };
  const brief = illustrateBrief(saved, { ...telling, things: ['e1', 'e2', 'e3', 'e1'] });
  assert.deepEqual(brief.things.map((t) => t.id), ['e1', 'e2'], 'once each, and nothing they turned down');
  assert.deepEqual(brief.things[0].facts, ['The night ferry goes to an island of lanterns.', 'It waited at the end of the pier.'], 'what they chose first');
  assert.deepEqual(brief.things[1].facts, [], 'an open thread is not what it looks like');
  assert.deepEqual(brief.lines.map((l) => l.at), ['middle', 'top right, small']);
  const scene = 'A small red wooden ferry pulls away from a long wooden pier on calm dark water at dusk, its round lantern glowing, while a white heron glides above it toward the upper right under a violet sky.';
  const ok = checkIllustration({ scene, looks: [
    { thing: 'e1', look: 'a big blue steel ferry' },
    { thing: 'e2', look: 'a long grey wooden pier on stilts' },
    { thing: 'a white heron', look: 'a tall white heron with black-tipped wings' },
    { thing: 'a dragon', look: 'a green dragon with gold scales' },
  ] }, brief);
  assert.ok(ok.ok, JSON.stringify(ok));
  assert.deepEqual(ok.looks.map((l) => [l.id || l.name, l.look, l.kept]), [
    ['e1', 'a small red wooden ferry with one round lantern at its bow', true],
    ['e2', 'a long grey wooden pier on stilts', false],
    ['a white heron', 'a tall white heron with black-tipped wings', false],
  ], 'a kept look stays, a new thing is one the story tells, and nothing it never told');
  assert.equal(checkIllustration({ scene: 'A ferry.', looks: [] }, brief).ok, false, 'a scene to paint from');
  // a child: a scene that brings in something frightening is sent back; a look that does is dropped
  const dark = `${scene} A monster with sharp teeth watches from the water.`;
  assert.equal(checkIllustration({ scene: dark }, brief, { young: true }).ok, false);
  // and says which word, so that asked again it can be painted without it
  assert.match(checkIllustration({ scene: `${scene} Warm flames glow under it.` }, brief, { young: true }).why, /"flames"/);
  assert.ok(checkIllustration({ scene: dark }, brief).ok, 'a grown-up’s picture may hold one');
  assert.equal(checkIllustration({ scene, looks: [{ thing: 'a white heron', look: 'a heron with bloody claws' }] }, brief, { young: true }).looks.length, 1);
  // kept: the first look of a thing stays; a new thing kept tonight is found by its name or another it goes by
  const w = createDreamWorld(saved);
  const kept = w.looked([
    { id: 'e1', look: 'a big blue steel ferry' },
    { name: 'The jetty', look: 'a long grey wooden pier on stilts' },
    { name: 'a stranger', look: 'a tall man in a grey coat' },
    { name: 'a unicorn', look: 'a white unicorn' },
  ], { night: 1 });
  assert.deepEqual(kept, [{ id: 'e2', name: 'the pier', look: 'a long grey wooden pier on stilts' }]);
  assert.equal(w.toJSON().entities[0].look, 'a small red wooden ferry with one round lantern at its bow');
  assert.equal(illustrateBrief(w.toJSON(), { ...telling, things: ['e2'] }).things[0].look, 'a long grey wooden pier on stilts', 'given back the next night');
  assert.equal(thingDetail(w, 'e1').looks, 'a small red wooden ferry with one round lantern at its bow', 'the storyteller knows how it looks');
});

test('how a thing looks in their own words: kept on it, over any look, in every picture of it, and let go when they say nothing', () => {
  const w = createDreamWorld({
    nights: [{ n: 1, title: 'The Low Shore' }],
    entities: [
      { id: 'e1', name: 'the night ferry', kind: 'thing', status: 'confirmed', appearances: [{ night: 1 }], look: 'a small red wooden ferry with one round lantern at its bow' },
      { id: 'e2', name: 'the fox', kind: 'creature', status: 'confirmed', appearances: [{ night: 1 }] },
      { id: 'e3', name: 'a stranger', kind: 'person', status: 'rejected', appearances: [{ night: 1 }] },
    ],
    facts: [], seq: { e: 3, f: 0 },
  });
  assert.deepEqual(w.ruled('e2', '  the fox has a white tip on its tail.  '), { id: 'e2', name: 'the fox', rule: 'the fox has a white tip on its tail' });
  assert.equal(w.ruled('e3', 'a tall man'), null, 'nothing they turned down');
  assert.equal(w.ruled('e9', 'anything'), null);
  w.ruled('e1', 'the ferry is painted blue now, with a yellow lantern');
  const telling = { title: 'Out on the Water', lines: [{ text: 'The night ferry went out, and the fox watched from the shore.', box: [700, 500, 1100, 700] }] };
  const brief = illustrateBrief(createDreamWorld(w.toJSON()).toJSON(), { ...telling, things: ['e1', 'e2'] });
  assert.deepEqual(brief.things.map((t) => [t.id, t.look, t.rule]), [
    ['e1', 'a small red wooden ferry with one round lantern at its bow', 'the ferry is painted blue now, with a yellow lantern'],
    ['e2', null, 'the fox has a white tip on its tail'],
  ], 'kept with their world, and shown to the Illustrator');
  const scene = 'A blue wooden ferry with a yellow lantern slides out across calm dark water at dusk, while a small fox with a white-tipped tail sits on the pale shore and watches it go.';
  const ill = checkIllustration({ scene, looks: [{ thing: 'e2', look: 'a small russet fox with a bushy tail' }] }, brief);
  assert.deepEqual(ill.looks.map((l) => [l.id, l.look, l.rule]), [
    ['e1', 'a small red wooden ferry with one round lantern at its bow', 'the ferry is painted blue now, with a yellow lantern'],
    ['e2', 'a small russet fox with a bushy tail', 'the fox has a white tip on its tail'],
  ], 'their words go with each look, the kept one and the new one');
  assert.deepEqual(checkIllustration({ scene, looks: [] }, brief).looks.find((l) => l.id === 'e2'), { id: 'e2', name: 'the fox', look: null, kept: false, rule: 'the fox has a white tip on its tail' }, 'and with no look at all');
  // let go: nothing said, nothing kept
  assert.deepEqual(w.ruled('e2', '   '), { id: 'e2', name: 'the fox', rule: null });
  assert.equal('rule' in w.toJSON().entities.find((e) => e.id === 'e2'), false);
  assert.equal(illustrateBrief(w.toJSON(), { ...telling, things: ['e2'] }).things[0].rule, undefined);
});

// ---------------------------------------------------------------- forgetting (forget.mjs)

// two nights: the clock, then the clock again with a path to the sea. What forgetting the clock takes.
function twoNights() {
  const { w } = nightOne();
  const clock = w.entities.find((e) => e.name === 'the stopped clock').id, sea = w.entities.find((e) => e.name === 'the sea').id;
  w.commit({
    telling: { title: 'The Clock Comes Back', lines: [{ text: 'The clock was back, a little to the right.', strokes: [2], v: 0, a: 0 }, { text: 'A path ran down to the water.', strokes: [1], v: 0, a: 0 }, { text: 'The sea had not moved at all.', strokes: [3], v: 0, a: 0 }] },
    shape: 'flat', strokes: S2,
    words: [{ n: 2, text: 'the clock again' }, { n: 1, text: 'a path down to the water' }],
    diff: {
      entities: [{ id: clock, lines: [0] }, { new: 'the path', kind: 'place', lines: [1] }, { id: sea, lines: [2] }],
      facts: [{ about: 'the path', text: 'It led down to the water.', line: 1 }, { about: 'the sea', text: 'It was as still as the hands were.', line: 0 }],
    },
    reactions: ['yes', 'yes', 'yes'],
  });
  return { w, clock, sea, path: w.entities.find((e) => e.name === 'the path').id };
}

test('forgetting: what would go is shown first, the thing and all that grew from it, and what stays', () => {
  const { w, clock } = twoNights();
  const before = JSON.stringify(w.toJSON());
  const plan = w.forgetPlan(clock);
  assert.equal(JSON.stringify(w.toJSON()), before, 'looking changes nothing');
  assert.equal(plan.name, 'the stopped clock');
  // its own fact, and the sea's fact that came from a line about the clock
  assert.deepEqual(plan.facts.map((id) => w.facts.find((f) => f.id === id).text), ['It had stopped at ten past four.', 'It was as still as the hands were.']);
  assert.deepEqual(plan.counts, { chapters: 2, facts: 2, lines: 2, titles: 1, words: 1, marks: 2 });
  assert.deepEqual(plan.marks, { 1: [2], 2: [2] });
  assert.deepEqual(plan.stays, { things: 2, facts: 1, lines: 4 });
  assert.equal(w.forgetPlan('e999'), null);
});

test('forgetting: the thing and what grew from it go, everything else stays exactly, and nothing of it is kept', () => {
  const { w, clock, sea, path } = twoNights();
  const was = w.toJSON();
  const r = w.forget(clock, { at: 1000 });
  const now = w.toJSON();
  assert.equal(r.replay, false);
  assert.deepEqual(r.record, { id: `forget-${clock}`, at: 1000, removed: { things: 1, facts: 2, lines: 2, titles: 1, words: 1, marks: 2 } });
  // nothing of it anywhere: not its name, what it was called, or any of the words about it
  for (const word of ['clock', 'ten past four', 'still as the hands']) assert.ok(!JSON.stringify(now).toLowerCase().includes(word), `"${word}" is nowhere in the world`);
  assert.equal(w.thingFor('the stopped clock'), null);
  // the rest exactly as it was
  const keep = (S, id) => S.entities.find((e) => e.id === id);
  assert.deepEqual(keep(now, path), keep(was, path), 'the path is untouched');
  assert.deepEqual(keep(now, sea).appearances.map((a) => a.strokes), keep(was, sea).appearances.map((a) => a.strokes), 'the sea keeps its marks');
  assert.deepEqual(now.facts.map((f) => f.text), ['It led down to the water.']);
  // its lines are empty places, so what the other things point at doesn't move
  assert.deepEqual(now.nights[1].lines.map((l) => l.text), ['', 'A path ran down to the water.', 'The sea had not moved at all.']);
  assert.deepEqual(keep(now, sea).appearances[1].lines, [2]);
  assert.equal(now.nights[1].title, 'Chapter 2');
  assert.equal(now.nights[1].text, 'A path ran down to the water. The sea had not moved at all.');
  assert.deepEqual(now.nights[1].said, ['a path down to the water']);
  assert.deepEqual(now.nights[0].forgot, [2]);
  assert.equal(now.nights[0].pinned.said, null);
  assert.deepEqual(w.forgotten, [r.record]);
});

test('forgetting: again takes nothing more and gives back the same record; a mark another thing is drawn with stays', () => {
  const { w, clock, sea } = twoNights();
  const first = w.forget(clock, { at: 1000 });
  const after = JSON.stringify(w.toJSON());
  const again = w.forget(clock, { at: 2000 });
  assert.equal(again.replay, true);
  assert.deepEqual(again.record, first.record);
  assert.equal(JSON.stringify(w.toJSON()), after, 'replayed, nothing changes');
  // the sea and the path share a mark on night 2 with... nothing; give the clock the sea's mark too
  const { w: w2, clock: c2, sea: s2 } = twoNights();
  const S = w2.toJSON();
  S.entities.find((e) => e.id === c2).appearances[1].strokes.push(3);
  const w3 = createDreamWorld(S);
  assert.deepEqual(w3.forgetPlan(c2).marks, { 1: [2], 2: [2] }, 'mark 3 is the sea\'s too, so it stays drawn');
  assert.ok(sea && s2);
});

test('forgetting: a chapter kept apart is cleaned the same way', async () => {
  const { scrubNight } = await import('./forget.mjs');
  const { w, clock } = twoNights();
  const plan = w.forgetPlan(clock);
  const apart = w.toJSON().nights[1];
  const clean = scrubNight(apart, plan);
  assert.deepEqual(clean.lines.map((l) => l.text), ['', 'A path ran down to the water.', 'The sea had not moved at all.']);
  assert.ok(!JSON.stringify(clean).toLowerCase().includes('clock'));
  assert.deepEqual(clean.forgot, [2]);
});

test('forgetting: last time\'s story and the storyteller\'s tools never read a forgotten line', () => {
  const { w, clock } = twoNights();
  w.forget(clock);
  const recap = w.recap({ now: Date.now() + 864e5 * 2 });
  assert.ok(recap, 'offered on a later day');
  assert.deepEqual(recap.lines.map((l) => l.text), ['A path ran down to the water.', 'The sea had not moved at all.']);
  const night = nightDetail(w, 2);
  assert.ok(night.telling.every((l) => l.text), 'no empty lines handed to the storyteller');
  assert.ok(!JSON.stringify(night).toLowerCase().includes('clock'));
});

test('forgetting: the words of their world\'s place that name it go, and the place is painted again without them', () => {
  const { w, clock } = twoNights();
  const S = w.toJSON();
  S.scene = { place: 'a tower where the stopped clock hangs over the sea', look: 'a misty ink-wash night', looks: ['a clock tower at dusk', 'a moonlit sea'] };
  const w2 = createDreamWorld(S);
  const r = w2.forget(clock);
  assert.equal(r.plan.place, true, 'the place\'s picture goes too (the TV drops it)');
  assert.deepEqual(w2.toJSON().scene, { place: '', look: 'a misty ink-wash night', looks: ['a moonlit sea'] });
  assert.ok(!JSON.stringify(w2.toJSON()).toLowerCase().includes('clock'));
});
