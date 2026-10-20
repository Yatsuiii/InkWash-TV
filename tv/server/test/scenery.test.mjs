import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenery, sceneRequest, standInScene, SCENE_SYSTEM, checkSceneBody } from '../scenery.mjs';
import { checkScene, sceneTone, sceneBrief, createDreamWorld } from '../engine/dreams/index.mjs';

const said = (texts) => { let i = 0; const asked = []; return { asked, messages: { async create(p) { asked.push(p); const t = texts[Math.min(i++, texts.length - 1)]; return { content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t) }] }; } } }; };
const BRIEF = { world: 'Leaf', nights: [{ n: 1, title: 'The library that never ends', story: ['Shelves and shelves, one long thin row of them.'] }], things: [{ name: 'the lamp', facts: ['It sits gold and heavy at the bottom of the shaft.'] }] };
const SCENE = JSON.parse(standInScene().content[0].text);

test('a scene is kept only as the TV can draw it: colours, amounts and kinds it knows', () => {
  const s = checkScene({ ...SCENE, far: [{ shape: 'hills', color: '#9CC7D6', height: 2 }, { shape: 'spaceships', color: '#ffffff' }, { shape: 'trees', color: 'green' }], light: { kind: 'laser', x: 7, color: 'red' }, things: { style: 'neon', colors: ['#ff0000', 'nope'] } });
  assert.deepEqual(s.far, [{ shape: 'hills', color: '#9cc7d6', height: 0.45 }], 'unknown shapes and colours dropped, heights held');
  assert.deepEqual([s.light.kind, s.light.x, s.light.color], ['none', 1, '#fff4dc']);
  assert.deepEqual([s.things.style, s.things.colors], ['ink', ['#ff0000']]);
  assert.equal(checkScene({ ...SCENE, things: { style: 'toy' } }).things.style, 'ink', 'a scene written before, as a toy world, stands as their own ink');
  assert.equal(checkScene({ sky: { top: '#000000' }, ground: { far: '#111111', near: '#222222' } }), null, 'no horizon colour, no scene');
  assert.equal(checkScene('a meadow'), null);
  const roofed = checkScene({ ...SCENE, roof: true });
  assert.deepEqual([roofed.sky.stars, roofed.sky.clouds], [0, 0], 'no stars or clouds under a roof');
  assert.equal(sceneTone(checkScene(SCENE)), 'day');
  assert.equal(sceneTone(checkScene({ ...SCENE, sky: { ...SCENE.sky, top: '#02030a', middle: '#0a0f2c' } })), 'night');
});

test('the world keeps its scene, and only one it can draw', () => {
  const w = createDreamWorld();
  assert.equal(w.scene, null, 'a new world has none: the night on the lake until its story starts');
  assert.equal(w.setScene({ nope: true }), null);
  assert.equal(w.setScene(SCENE).place, SCENE.place);
  const again = createDreamWorld(w.toJSON());
  assert.equal(again.scene.ground.kind, 'grass', 'kept with the world');
  assert.equal(again.setScene('rubbish').ground.kind, 'grass', 'a bad scene leaves the one it had');
});

test('the Set Designer: shown the world, its look in their words first; sent back once when it can\'t be drawn', async () => {
  const claude = said([{ place: 'nothing drawable' }, SCENE]);
  const r = await scenery({ brief: { ...BRIEF, look: 'Bright and toy-like, like It Takes Two.' } }, { claude, model: 'anthropic.claude-haiku-5-5' });
  assert.equal(r.status, 200);
  assert.equal(r.json.scene.ground.kind, 'grass');
  assert.equal(claude.asked.length, 2);
  assert.match(claude.asked[1].messages[0].content, /couldn't be drawn/);
  const shown = claude.asked[0].messages[0].content;
  assert.ok(shown.includes('"look":"Bright and toy-like, like It Takes Two."') && shown.includes('The library that never ends'), 'their words and their story, as data');
  assert.match(SCENE_SYSTEM, /What they said about its look comes first/);
  assert.match(SCENE_SYSTEM, /Never default to night on a lake/);
  assert.equal((await scenery({ brief: BRIEF }, { claude: said(['{}']), model: 'm' })).status, 502, 'nothing drawable twice');
  assert.throws(() => checkSceneBody({ brief: { nights: [], things: [] } }), /nothing in the world yet/);
  assert.match(sceneRequest(BRIEF, { model: 'm', young: true }).system, /a place a child would love/);
});

test('how it looks: three others to choose from, and what they said as they painted, given to the Set Designer', async () => {
  const s = checkScene({ ...SCENE, look: 'A misty ink landscape', looks: ['A misty ink landscape', 'A golden evening in oils', 'A golden evening in oils', '', 'Pixel art', 'A paper cut-out theatre', 'A fourth'] });
  assert.deepEqual(s.looks, ['A golden evening in oils', 'Pixel art', 'A paper cut-out theatre'], 'other than its own look, each once, three at most');
  assert.deepEqual(checkScene({ ...SCENE, looks: 'nope' }).looks, []);
  const S = { name: 'Leaf', nights: [{ n: 1, title: 'The stacks', lines: [{ text: 'Shelves, and shelves.' }], said: ['make it bright, like a toy'] }, { n: 2, lines: [] }], entities: [{ id: 'e1', name: 'the lamp' }], facts: [] };
  const brief = sceneBrief(S);
  assert.deepEqual(brief.nights[0].said, ['make it bright, like a toy']);
  assert.ok(!('said' in brief.nights[1]), 'a night they said nothing in says nothing');
  const sent = checkSceneBody({ brief: { ...brief, look: `  Like ${'a toy '.repeat(80)}`, nights: [{ ...brief.nights[0], said: ['x'.repeat(500), '', 'and warm'] }] } });
  assert.equal(sent.brief.look.length, 300, 'their words for its look, bounded');
  assert.deepEqual(sent.brief.nights[0].said.map((l) => l.length), [200, 8]);
  const claude = said([SCENE]);
  await scenery({ brief: { ...BRIEF, look: 'A bright toy world, chunky and rounded' } }, { claude, model: 'm' });
  assert.match(claude.asked[0].messages[0].content, /"look":"A bright toy world, chunky and rounded"/);
  assert.match(SCENE_SYSTEM, /"looks": three other looks/);
  assert.equal(JSON.parse(standInScene({ messages: [{ content: `THEIR WORLD\n${JSON.stringify({ look: 'Pixel art' })}\n\nDesign the place it stands in.` }] }).content[0].text).look, 'Pixel art', 'the stand-in, in the look asked for');
});

import { backdrop, backdropRequest, BACKDROP } from '../scenery.mjs';
import { memoryBudget } from '../budget.mjs';
import { standInPaint } from '../illustrator.mjs';
import { handle } from '../guide.mjs';

test('the place, painted: Nova Canvas in the scene\'s look, held to the edges of the TV\'s own drawing of it', async () => {
  const scene = checkScene({ ...SCENE, look: 'A bright stylized 3D animated adventure game, toy-like and chunky.' });
  const drawn = `data:image/jpeg;base64,${Buffer.from('the drawn scene').toString('base64')}`;
  const sent = [];
  const paint = async (b) => { sent.push(b); return standInPaint(); };
  const r = await backdrop({ scene, image: drawn, seed: 42 }, { paint });
  assert.equal(r.status, 200);
  assert.match(r.json.image, /^data:image\/png;base64,iVBOR/);
  const b = sent[0];
  assert.deepEqual([b.taskType, b.textToImageParams.controlMode, b.textToImageParams.conditionImage, b.imageGenerationConfig.width, b.imageGenerationConfig.height, b.imageGenerationConfig.seed], ['TEXT_IMAGE', 'CANNY_EDGE', drawn.split(',')[1], 1536, 864, 42]);
  assert.equal(BACKDROP.width / BACKDROP.height, 16 / 9, 'the stage\'s shape');
  assert.ok(b.textToImageParams.text.startsWith('A bright stylized 3D animated adventure game, toy-like and chunky. A wide meadow on a clear morning.'), b.textToImageParams.text);
  assert.ok(b.textToImageParams.text.length <= BACKDROP.text && /open empty ground in front/.test(b.textToImageParams.text));
  assert.match(b.textToImageParams.negativeText, /people, person, figure, character, animal/);
  // a child's: gentle, and nothing frightening
  const kid = backdropRequest({ scene, image: 'x', young: true });
  assert.ok(kid.textToImageParams.text.endsWith('for a young child.') && /monster/.test(kid.textToImageParams.negativeText));
  // none set up, none left today, too big to send, turned down, nonsense
  assert.deepEqual((await backdrop({ scene, image: drawn }, {})).json, { off: true });
  const budget = memoryBudget({ perDay: 1 });
  assert.equal((await backdrop({ scene, image: drawn }, { paint, budget })).status, 200);
  assert.deepEqual((await backdrop({ scene, image: drawn }, { paint, budget })).json, { off: true, today: true });
  assert.deepEqual((await backdrop({ scene, image: drawn }, { paint: async () => 'A'.repeat(BACKDROP.most + 4), log: () => {} })).json, { off: true, big: true });
  assert.deepEqual((await backdrop({ scene, image: drawn }, { paint: async () => { throw new Error('This request has been blocked by our content filters.'); }, log: () => {} })).json, { blocked: true });
  for (const bad of [{ scene, image: 'nope' }, { scene: { sky: {} }, image: drawn }, null]) assert.equal((await handle('/backdrop', bad, { claude: said(['{}']), paint })).status, 400);
  // through the guide: the Set Designer, then the place painted
  const set = await handle('/scene', { brief: BRIEF }, { claude: said([SCENE]) });
  assert.equal(set.json.scene.ground.kind, 'grass');
  assert.match((await handle('/backdrop', { scene: set.json.scene, image: drawn }, { claude: said(['{}']), paint })).json.image, /^data:image\/png/);
});

import { thing, thingRequest, checkThing, realRequest, THING } from '../illustrator.mjs';

test('a thing made real on its own: its strokes held to, as it looks, in the place\'s look, alone on white', async () => {
  const strokes = `data:image/png;base64,${Buffer.from('its strokes, black on white').toString('base64')}`;
  const sent = [];
  const paint = async (b) => { sent.push(b); return standInPaint(); };
  const r = await thing({ image: strokes, name: 'the lighthouse', look: 'A tall white lighthouse with a red cap.', place: 'A bright stylized 3D animated adventure game.', seed: 7, width: 400, height: 640 }, { paint });
  assert.equal(r.status, 200);
  assert.match(r.json.image, /^data:image\/png;base64,iVBOR/);
  // painted, then cut out of its white by Nova Canvas itself
  assert.equal(r.json.cut, true);
  assert.deepEqual(sent.map((x) => x.taskType), ['TEXT_IMAGE', 'BACKGROUND_REMOVAL']);
  assert.deepEqual(sent[1], { taskType: 'BACKGROUND_REMOVAL', backgroundRemovalParams: { image: await standInPaint() } });
  const b = sent[0], t = b.textToImageParams;
  assert.deepEqual([b.taskType, t.controlMode, t.conditionImage, t.controlStrength, b.imageGenerationConfig.width, b.imageGenerationConfig.height, b.imageGenerationConfig.seed], ['TEXT_IMAGE', 'CANNY_EDGE', strokes.split(',')[1], THING.strength, 400, 640, 7]);
  assert.equal(t.text, 'The lighthouse: A tall white lighthouse with a red cap. One single lighthouse, whole, alone and centred, on a plain pure white background, with nothing else in the picture. Painted as a bright stylized 3D animated adventure game.');
  assert.match(t.negativeText, /background, scenery, landscape, ground/);
  // a child's: gentle, and nothing frightening
  const kid = thingRequest({ image: 'x', name: 'dragon', young: true });
  assert.ok(kid.textToImageParams.text.endsWith('for a young child.') && /scary, frightening/.test(kid.textToImageParams.negativeText), kid.textToImageParams.text);
  // its size, as Nova Canvas takes it: 320 to 768 a side, in sixteens, at most 4 to 1
  assert.deepEqual([checkThing({ image: strokes, name: 'x', width: 100, height: 2000 })].map((c) => [c.width, c.height])[0], [320, 768]);
  assert.deepEqual([checkThing({ image: strokes, name: 'x', width: 777, height: 330 })].map((c) => [c.width, c.height])[0], [768, 336]);
  // none set up, none left today, too big to send, turned down, nonsense
  assert.deepEqual((await thing({ image: strokes, name: 'x' }, {})).json, { off: true });
  const budget = memoryBudget({ perDay: 1 });
  assert.equal((await thing({ image: strokes, name: 'x' }, { paint, budget, cutout: false })).status, 200);
  assert.deepEqual((await thing({ image: strokes, name: 'x' }, { paint, budget, cutout: false })).json, { off: true, today: true });
  assert.deepEqual((await thing({ image: strokes, name: 'x' }, { paint: async () => 'A'.repeat(THING.big + 4), log: () => {} })).json, { off: true, big: true });
  assert.deepEqual((await thing({ image: strokes, name: 'x' }, { paint: async () => { throw new Error('This request has been blocked by our content filters.'); }, log: () => {} })).json, { blocked: true });
  for (const bad of [{ image: strokes }, { image: 'nope', name: 'x' }, null]) assert.equal((await handle('/thing', bad, { claude: said(['{}']), paint })).status, 400);
  // things take only part of the day's pictures: the rest is left for a painting made real and its place
  const four = memoryBudget({ perDay: 4 });
  const made = [];
  for (let n = 0; n < 4; n++) made.push((await thing({ image: strokes, name: 'x' }, { paint, budget: four, log: () => {}, cutout: false })).json.image ? 'made' : 'none');
  assert.deepEqual(made, ['made', 'made', 'made', 'none']);
  assert.equal((await backdrop({ scene: checkScene(SCENE), image: strokes }, { paint, budget: four })).status, 200);
  assert.equal(await four.take(), false, 'and then the day is done');
  // an article in the place's look is kept as it is
  assert.match(thingRequest({ image: 'x', name: 'boat', place: 'An oil painting, warm and lamplit.' }).textToImageParams.text, /Painted as an oil painting, warm and lamplit\.$/);
  assert.match((await handle('/thing', { image: strokes, name: 'the lighthouse' }, { claude: said(['{}']), paint })).json.image, /^data:image\/png/);
});

test('a thing in their own words, made again from its earlier picture, and cut out by Nova Canvas or else by the TV', async () => {
  const strokes = `data:image/png;base64,${Buffer.from('its strokes, black on white').toString('base64')}`;
  const before = `data:image/png;base64,${Buffer.from('the fox as it was first made, flat on white').toString('base64')}`;
  const sent = [];
  const paint = async (b) => { sent.push(b); return standInPaint(); };
  // their words first, then the look kept
  const ruled = thingRequest(checkThing({ image: strokes, name: 'the fox', look: 'A small russet fox with a bushy tail.', rule: 'the fox has a white tip on its tail.' }));
  assert.match(ruled.textToImageParams.text, /^The fox: the fox has a white tip on its tail; A small russet fox with a bushy tail\. One single fox/);
  assert.match(thingRequest(checkThing({ image: strokes, name: 'the fox', rule: 'grey, and older' })).textToImageParams.text, /^The fox: grey, and older\. /, 'their words alone, with no look kept');
  // made again: from its earlier picture, as it looks now, at the size its strokes take
  const r = await thing({ image: strokes, name: 'the fox', look: 'A small russet fox with a bushy tail.', rule: 'the fox has a white tip on its tail', reference: before, seed: 3, width: 400, height: 320 }, { paint });
  assert.equal(r.json.cut, true);
  const v = sent[0];
  assert.equal(v.taskType, 'IMAGE_VARIATION');
  assert.deepEqual(v.imageVariationParams.images, [before.split(',')[1]]);
  assert.equal(v.imageVariationParams.similarityStrength, THING.similar);
  assert.match(v.imageVariationParams.text, /white tip on its tail/);
  assert.match(v.imageVariationParams.negativeText, /background, scenery/);
  assert.deepEqual(v.imageGenerationConfig, { numberOfImages: 1, width: 400, height: 320, cfgScale: THING.cfg, seed: 3 });
  assert.ok(THING.similar >= 0.2 && THING.similar <= 1, 'as Nova Canvas takes it');
  for (const bad of ['nope', 'data:image/gif;base64,R0lG', `data:image/png;base64,${'A'.repeat(1_500_004)}`]) assert.throws(() => checkThing({ image: strokes, name: 'x', reference: bad }), /reference/);
  // Nova Canvas can't cut it out (or none are left today to): the TV cuts the white away, as before
  const cutFails = async (b) => { if (b.taskType === 'BACKGROUND_REMOVAL') throw new Error('ValidationException: busy'); return standInPaint(); };
  const logged = [];
  const white = await thing({ image: strokes, name: 'the fox' }, { paint: cutFails, log: (m) => logged.push(m) });
  assert.match(white.json.image, /^data:image\/png/);
  assert.equal(white.json.cut, undefined);
  assert.match(logged.join(' '), /a thing, cut out: ValidationException: busy, so the TV cuts it/);
  const two = memoryBudget({ perDay: 1 });
  const paid = await thing({ image: strokes, name: 'the fox' }, { paint, budget: two, log: () => {} });
  assert.ok(paid.json.image && !paid.json.cut, 'the picture first; its cutting out only if there is one to spare');
  // asked for the TV to cut them: not cut here
  sent.length = 0;
  assert.equal((await thing({ image: strokes, name: 'the fox' }, { paint, cutout: false })).json.cut, undefined);
  assert.deepEqual(sent.map((x) => x.taskType), ['TEXT_IMAGE']);
  assert.equal((await handle('/thing', { image: strokes, name: 'the fox' }, { claude: said(['{}']), paint, cutout: false })).json.cut, undefined);
});

test('the night made real: their own words for a thing come first in what it is painted from', () => {
  const r = realRequest({ image: 'x', scene: 'A blue ferry goes out over calm water while a fox watches from the shore.', looks: [
    { id: 'e1', name: 'the night ferry', look: 'a small red wooden ferry.', kept: true },
    { id: 'e2', name: 'the fox', look: null, kept: false, rule: 'the fox has a white tip on its tail' },
    { id: 'e3', name: 'the pier', look: 'a long grey pier.', kept: true, rule: 'the pier is broken in the middle' },
  ] });
  const text = r.textToImageParams.text;
  assert.ok(text.indexOf('The fox: the fox has a white tip on its tail.') < text.indexOf('The night ferry: a small red wooden ferry.'), text);
  assert.match(text, /The pier: the pier is broken in the middle; a long grey pier\./);
});
