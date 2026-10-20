// The personal layer's tests.
//
//   node --test inkwash/engine/personal/test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  target, readText, fit, readMarks, describeMarks, motifs, tellingMotifs, jaccard, createCommons, createHistory,
  chooseLenses, LENSES, personalBrief, scoreTelling, choose, planTelling, finishTelling,
} from './index.mjs';

// a slow, heavy, low painting: a few long dense strokes along the bottom, ink pooled
const heavyLow = [
  { n: 1, ink: 'dense', box: [100, 700, 1500, 820], length: 1450, turn: 1, pressure: 0.8, pools: [[300, 760], [900, 770], [1300, 760]], ms: 16000, gap: 1, still: 2 },
  { n: 2, ink: 'dense', box: [600, 650, 900, 900], length: 500, turn: 2, pressure: 0.75, pools: [[700, 800]], ms: 6000, gap: 3, still: 1.5 },
  { n: 3, ink: 'dense', box: [1100, 680, 1300, 950], length: 420, turn: 1, pressure: 0.7, pools: [], ms: 5000, gap: 2, still: 1 },
];
// a quick, light, high painting: many short turning strokes up top
const quickHigh = Array.from({ length: 8 }, (_, i) => ({ n: i + 1, ink: 'light', box: [100 + i * 180, 80, 250 + i * 180, 300], length: 260, turn: 6, pressure: 0.22, pools: [], ms: 700, gap: 0.5, still: 0 }));

test('feelings: their own word wins; the marks only suggest', () => {
  assert.deepEqual(target('longing', null), { feeling: 'longing', v: -0.2, a: -0.1, source: 'said', sure: 1 });
  const m = readMarks(heavyLow);
  const t = target(null, m);
  assert.equal(t.source, 'marks');
  assert.ok(t.sure <= 0.5);
  assert.equal(target('peaceful', m).feeling, 'peaceful', 'what they said beats what the marks suggest');
  assert.equal(target(null, null).source, 'none');
});

test('reading the marks: heavy, slow, low and lingering; or quick, light, high and restless', () => {
  const a = readMarks(heavyLow), b = readMarks(quickHigh);
  for (const w of ['heavy', 'dark', 'slow', 'lingering', 'low']) assert.ok(a.words.includes(w), `heavyLow is ${w}`);
  for (const w of ['light', 'quick', 'restless', 'high']) assert.ok(b.words.includes(w), `quickHigh is ${w}`);
  assert.ok(a.affect.a < b.affect.a, 'slow marks are calmer than quick ones');
  assert.ok(a.affect.v < b.affect.v, 'heavy low marks lean darker than light high ones');
  assert.match(describeMarks(a), /heavy.*marks, mostly low down/);
  assert.equal(readMarks([]), null);
});

test('reading the marks: a painting in the dream inks is colourful, not pale', () => {
  const inks = ['gold', 'indigo', 'cinnabar', 'gold'];
  const m = readMarks(quickHigh.slice(0, 4).map((s, i) => ({ ...s, ink: inks[i], pressure: 0.5 })));
  assert.ok(m.words.includes('colourful'), m.words.join(', '));
  assert.ok(!m.words.includes('pale'), 'colour is not pale ink');
  assert.equal(m.measures.colour, 1);
  assert.ok(!readMarks(quickHigh).words.includes('colourful'), 'light ink is not colour');
});

test('a telling\'s mood, and how near it is to the feeling', () => {
  assert.ok(readText('The house was empty and grey, and everyone was gone.').v < 0);
  assert.ok(readText('They laughed and danced in the bright warm light.').v > 0.5);
  assert.equal(readText('A table. A chair.'), null);
  const sad = target('sad', null), joy = target('joyful', null);
  const t = 'The chair was empty. She had gone, and the room was grey and still.';
  assert.ok(fit(t, sad) > fit(t, joy));
});

test('motifs: one image however it is said; plain words and qualities are not images', () => {
  assert.deepEqual([...motifs('Moonlight on the river, and a lantern in the misty window.')].sort(), ['lamp', 'mist', 'moon', 'river', 'window']);
  assert.equal(motifs('Something came back again, and then it was gone.').size, 0);
  assert.deepEqual([...motifs('Somewhere, though nobody saw it, the small pale boat moved slowly.')], ['boat'], 'things, not qualities or places on the paper');
  assert.deepEqual([...motifs('A butterfly shone faintly over the family, silently.')].sort(), ['butterfly', 'family', 'shone']);
  assert.equal(jaccard(['moon', 'river'], ['moon', 'lamp']), 1 / 3);
  assert.deepEqual([...tellingMotifs({ title: 'The Red Kite', lines: [{ text: 'A kite over the stream.' }] })].sort(), ['kite', 'red', 'river']);
});

test('the commons: counts only; a rare image is never kept readable; clichés once common enough', () => {
  const c = createCommons({ k: 3, minTellings: 5, minShare: 0.3 });
  for (let i = 0; i < 6; i++) c.add(['moon', 'star', `own${i}`]);
  c.add(['grandmother-ruth']);
  const saved = JSON.stringify(c.toJSON());
  assert.ok(!saved.includes('grandmother-ruth') && !saved.includes('own1'), 'rare images are only hashes');
  assert.ok(saved.includes('moon'), 'a common image is readable');
  assert.deepEqual(c.cliches(), ['moon', 'star']);
  assert.ok(c.novelty(['kite', 'violin']) > c.novelty(['moon', 'star']));
  const again = createCommons({ k: 3, minTellings: 5, minShare: 0.3 }, JSON.parse(saved));
  assert.deepEqual(again.cliches(), ['moon', 'star'], 'it saves and loads');
  assert.deepEqual(createCommons({ minTellings: 50 }).cliches(), [], 'no clichés until there are enough tellings');
});

test('history: their repeats, their recurring images, their recent angles', () => {
  const h = createHistory();
  h.add({ feeling: 'sad', lens: 'empty-chair', motifs: ['chair', 'river'] });
  h.add({ feeling: 'longing', lens: 'not-there', motifs: ['river', 'door'] });
  assert.ok(h.repeats(['river', 'door']) > h.repeats(['kite']));
  assert.deepEqual(h.symbols(), ['river']);
  assert.ok(h.lensesUsed().has('not-there'));
  assert.equal(createHistory(JSON.parse(JSON.stringify(h.toJSON()))).list.length, 2, 'it saves and loads');
});

test('angles: fitting the marks, not the person\'s recent ones, and different for different people', () => {
  const m = readMarks(heavyLow);
  const picked = chooseLenses({ feeling: 'sad', marks: m, k: 2, seed: 'a' });
  assert.equal(picked[0].id, 'set-down', 'heavy, low, dark marks: carrying something heavy, then setting it down');
  const without = chooseLenses({ feeling: 'sad', marks: m, used: new Set(['set-down']), k: 2, seed: 'a' });
  assert.ok(!without.some((l) => l.id === 'set-down'));
  const seen = new Set();
  for (let i = 0; i < 20; i++) seen.add(chooseLenses({ feeling: 'longing', marks: null, k: 1, seed: `person-${i}` })[0].id);
  assert.ok(seen.size >= 4, 'with nothing to go on, people still get different angles');
  const none = chooseLenses({ feeling: null, marks: m, k: 3, seed: 'a' });
  assert.ok(none.every((l) => LENSES[l.feeling]), 'no feeling: angles from the feelings nearest the marks');
});

test('the brief carries the feeling, the marks, the angle, the clichés and their own images', () => {
  const m = readMarks(heavyLow);
  const b = personalBrief({ aim: target('longing', m), marks: m, lens: LENSES.longing[1], cliches: ['moon', 'star'], recent: ['river'], symbols: ['river'] });
  for (const s of ['longing', 'Let it reach', 'heavy', 'a place you cannot go back to', 'moon, star', 'Don\'t retell', 'keeps coming back']) assert.ok(b.includes(s), s);
});

const grounded = { title: 'The Long Shore', lines: [
  { text: 'You walked the long dark shore, slowly.', box: [100, 700, 1500, 820] },
  { text: 'A kite was caught in the reeds.', box: [600, 650, 900, 900] },
  { text: 'You set the heavy basket down at last.', box: [1100, 680, 1300, 950] },
] };
const floating = { title: 'Night', lines: [
  { text: 'The moon rose over the stars.', box: [100, 0, 400, 100] },
  { text: 'Stars, and the moon, and stars.', box: [500, 0, 800, 100] },
  { text: 'The moon was bright.', box: [900, 0, 1200, 100] },
] };

test('choosing: grounded in the marks, unlike the crowd, unlike their own last dreams', () => {
  const commons = createCommons({ k: 2, minTellings: 3, minShare: 0.3 });
  for (let i = 0; i < 6; i++) commons.add(['moon', 'star', 'night']);
  const a = scoreTelling(grounded, { strokes: heavyLow, aim: target('sad', null), commons });
  const b = scoreTelling(floating, { strokes: heavyLow, aim: target('sad', null), commons });
  assert.ok(a.parts.grounded > b.parts.grounded && a.parts.crowd > b.parts.crowd);
  assert.equal(choose([{ telling: floating }, { telling: grounded }], { strokes: heavyLow, commons }).best.telling, grounded);
  const h = createHistory([{ motifs: ['shore', 'kite', 'basket', 'reed'] }]);
  assert.ok(scoreTelling(grounded, { strokes: heavyLow, history: h }).parts.self < scoreTelling(floating, { strokes: heavyLow, history: h }).parts.self);
});

test('a whole telling: plan, write candidates, keep the best, remember it', () => {
  const commons = createCommons({ k: 2, minTellings: 3, minShare: 0.3 });
  for (let i = 0; i < 5; i++) commons.add(['moon', 'star']);
  const history = createHistory();
  const plan = planTelling({ strokes: heavyLow, felt: 'sad', history, commons, k: 3, seed: 'p1' });
  assert.equal(plan.candidates.length, 3);
  assert.equal(new Set(plan.candidates.map((c) => c.lens.id)).size, 3, 'three different angles');
  assert.ok(plan.candidates[0].brief.includes('moon, star'));
  const done = finishTelling({ plan, written: [floating, grounded, null], strokes: heavyLow, history, commons });
  assert.equal(done.telling, grounded);
  assert.equal(history.list.length, 1);
  assert.equal(commons.tellings(), 6);
  assert.equal(done.scores.length, 2);
});

// ---------------------------------------------------------------- the feeling line

import { readLine, shapeOf, compileBeats, arcBrief, checkTelling, rewriteNote, voiceOf, ssml, plainTelling, readingsFor } from './index.mjs';

// ten strokes left to right, the sixth one held long
const row = Array.from({ length: 10 }, (_, i) => ({ n: i + 1, ink: 'dense', from: [100 + i * 140, 500], to: [200 + i * 140, 520], box: [100 + i * 140, 480, 200 + i * 140, 540], length: 120, turn: 0.4, pressure: 0.5, pools: [], ms: 2000, gap: i === 5 ? 7 : 1, still: i === 5 ? 3 : 0 }));
// they felt it even, sinking hard at the sixth mark, lowest at the seventh, lifting by the end
const dip = [0, 0, 0.05, -0.1, -0.15, -0.8, -0.85, -0.5, 0.1, 0.45];

test('reading the line: where it turned, lowest, highest; nothing invented when they never marked', () => {
  const l = readLine({ byStroke: dip, strokes: row });
  assert.equal(l.moved, true);
  assert.equal(l.turn.n, 6);
  assert.ok(l.turn.delta < -0.6);
  assert.equal(l.low, 7);
  assert.equal(l.high, 10);
  const flat = readLine({ byStroke: row.map(() => 0), strokes: row });
  assert.equal(flat.moved, false);
  assert.equal(flat.turn, null);
  assert.equal(flat.focus, 6, 'unmarked: the mark they stayed on longest');
  const light = readLine({ byStroke: row.map(() => 0.5), strokes: row });
  assert.equal(light.moved, true, 'all of it lighter is still a feeling');
  assert.equal(light.turn, null, 'but not a turn');
});

test('the shape of a line', () => {
  assert.equal(shapeOf([0, -0.5, 0.3]).id, 'dip');
  assert.equal(shapeOf([0, 0.6, -0.2]).id, 'peak');
  assert.equal(shapeOf([-0.5, 0, 0.5]).id, 'rise');
  assert.equal(shapeOf([0.5, 0, -0.5]).id, 'fall');
  assert.equal(shapeOf([0, 0.5, -0.4, 0.5]).id, 'wave-up');
  assert.equal(shapeOf([0.1, 0.1, 0.12]).id, 'even');
  assert.equal(shapeOf([0, -0.8, -0.6]).id, 'fall', 'a flicker back up is not a lift');
  assert.match(shapeOf([0, -0.5, 0.3]).says, /sank, then lifted/);
});

test('the parts of the telling are cut where their feeling changed, always at the turn', () => {
  const line = readLine({ byStroke: dip, strokes: row });
  const beats = compileBeats({ strokes: row, line, pinned: { n: 6, said: 'a stopped clock' } });
  assert.ok(beats.length >= 3 && beats.length <= 6);
  assert.deepEqual(beats.flatMap((b) => b.strokes), row.map((s) => s.n), 'every mark, once, in order');
  const turn = beats.find((b) => b.roles.includes('turn'));
  assert.equal(turn.strokes[0], 6, 'the turn starts a part');
  assert.equal(turn.said, 'a stopped clock');
  assert.ok(turn.v < -0.5 && turn.delta < -0.4);
  assert.ok(beats[0].roles.includes('opening') && beats.at(-1).roles.includes('ending'));
  assert.ok(beats.some((b) => b.roles.includes('lowest')));
  assert.deepEqual(beats[0].box, [100, 480, beats[0].box[2], 540]);
  const two = compileBeats({ strokes: row.slice(0, 2), line: readLine({ byStroke: [0, -0.6], strokes: row.slice(0, 2) }) });
  assert.equal(two.length, 3, 'two marks: a part each, and the whole painting to close');
  assert.ok(two[2].whole && two[2].roles.includes('ending'));
});

test('the brief gives the writer their line, part by part', () => {
  const line = readLine({ byStroke: dip, strokes: row });
  const beats = compileBeats({ strokes: row, line, pinned: { n: 6, said: 'a stopped clock' } });
  const b = arcBrief({ beats, shape: shapeOf(beats.map((x) => x.v)), felt: 'longing', marks: 'slow marks, mostly low on the paper', cliches: ['moon', 'lantern'], named: ['the ferry'], recent: ['river'] });
  for (const s of [`Write exactly ${beats.length} lines`, 'in their own hands', 'sank, then lifted', 'called the dream longing', 'turned the most', 'They said this was a stopped clock', 'very heavy', 'end on this feeling', 'moon, lantern', 'the ferry', "Don't retell"]) assert.ok(b.includes(s), s);
  const mystery = arcBrief({ beats: compileBeats({ strokes: row, line, pinned: { n: 6, said: null } }), shape: { says: 'x' } });
  assert.match(mystery, /leave what this was a mystery/);
});

test('checking a telling against their line: it follows, or it is sent back with what to change', () => {
  const line = readLine({ byStroke: dip, strokes: row });
  const beats = compileBeats({ strokes: row, line });
  const follows = beats.map((b) => Math.round(b.v * 2));
  const good = checkTelling({ ratings: follows, beats });
  assert.equal(good.ok, true, JSON.stringify(good));
  const backwards = checkTelling({ ratings: follows.map((r) => -r), beats });
  assert.equal(backwards.ok, false);
  assert.ok(backwards.misses.length > 0);
  const note = rewriteNote(backwards, beats);
  assert.match(note, /Line \d reads lighter, but they marked this part (heavier|very heavy)/);
  assert.match(note, /never name the feeling/);
  assert.equal(checkTelling({ ratings: beats.map(() => 0), beats }).ok, false, 'a telling that never moves does not follow a line that does');
  assert.equal(checkTelling({ ratings: [0, 1], beats }).ok, false, 'a rating for every line');
  const flatBeats = compileBeats({ strokes: row, line: readLine({ byStroke: row.map(() => 0), strokes: row }) });
  assert.equal(checkTelling({ ratings: flatBeats.map(() => 0), beats: flatBeats }).ok, true);
  assert.equal(checkTelling({ ratings: flatBeats.map((_, i) => (i % 2 ? 2 : -2)), beats: flatBeats }).ok, false);
});

test('the voice follows the line: slower and softer where heavier, a pause before the turn', () => {
  const line = readLine({ byStroke: dip, strokes: row });
  const beats = compileBeats({ strokes: row, line });
  const turn = voiceOf(beats.find((b) => b.roles.includes('turn')));
  const end = voiceOf(beats.at(-1));
  assert.ok(parseInt(turn.rate, 10) < 100 && turn.volume === '-3dB' && turn.pause === 700);
  assert.ok(parseInt(end.rate, 10) > parseInt(turn.rate, 10));
  assert.equal(ssml('Tom & "Ann" <here>', turn), '<speak><break time="700ms"/><prosody rate="' + turn.rate + '" volume="-3dB">Tom &amp; &quot;Ann&quot; &lt;here&gt;</prosody></speak>');
});

test('without the guide: their line told plainly, and what a mark could be by its shape', () => {
  const line = readLine({ byStroke: dip, strokes: row });
  const beats = compileBeats({ strokes: row, line, pinned: { n: 6, said: 'a stopped clock' } });
  const t = plainTelling({ beats, shape: shapeOf(beats.map((b) => b.v)) });
  assert.equal(t.lines.length, beats.length);
  assert.ok(t.lines.some((l) => l.text === 'Here it changed: a stopped clock.'));
  assert.equal(t.title, 'It Sank, Then Lifted');
  const moon = { n: 1, from: [300, 100], to: [301, 101], box: [250, 50, 350, 150], length: 300 };
  assert.deepEqual(readingsFor(moon), ['a face', 'a clock', 'a hole in the ice']);
  const h = createHistory();
  h.add({ said: 'a stopped clock', motifs: ['clock'] });
  h.add({ said: null, motifs: ['river'] });
  assert.deepEqual(h.named(), ['a stopped clock']);
});

test('two dimensions: a turn in stir alone, fear told from grief, a telling calm where they marked it stirred sent back', () => {
  // the same heaviness all through, but calm, then suddenly very stirred at the sixth mark
  const heavy = row.map(() => -0.5);
  const stir = [-0.5, -0.5, -0.4, -0.5, -0.5, 0.9, 0.8, 0.7, 0.2, 0];
  const line = readLine({ byStroke: heavy, arousal: stir, strokes: row });
  assert.equal(line.moved, true);
  assert.equal(line.turn.n, 6, 'the turn is where it was stirred, though no heavier');
  assert.ok(line.turn.stir > 1);
  const beats = compileBeats({ strokes: row, line });
  const turn = beats.find((b) => b.roles.includes('turn'));
  assert.ok(turn.a > 0.6 && beats[0].a < -0.3);
  const shape = shapeOf(beats.map((b) => b.v), { moved: true, stirs: beats.map((b) => b.a) });
  assert.equal(shape.id, 'stir-peak');
  const brief = arcBrief({ beats, shape });
  assert.match(brief, /held its weight, but grew stirred, then settled/);
  assert.match(brief, /heavier and calm \(sad\)/, 'heavy and calm: grief');
  assert.match(brief, /heavier and very stirred \((afraid|tense)\)/, 'heavy and stirred: fear, or near it');
  assert.match(brief, /quickening/);
  // a reader who feels the weight right but the stir backwards
  const weight = beats.map((b) => Math.round(b.v * 2));
  const along = beats.map((b) => Math.round(b.a * 2));
  assert.equal(checkTelling({ ratings: weight, stirs: along, beats }).ok, true);
  const calm = checkTelling({ ratings: weight, stirs: along.map((x) => -x), beats });
  assert.equal(calm.ok, false);
  assert.ok(calm.stirAgree < 0);
  assert.match(rewriteNote(calm, beats), /reads calm, but they marked this part stirred/);
  // and the voice: quicker where stirred, slower where calm
  assert.ok(parseInt(voiceOf(turn).rate, 10) > parseInt(voiceOf(beats[0]).rate, 10) + 8);
});
