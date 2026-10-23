import { test } from 'node:test';
import assert from 'node:assert/strict';
import { write, writeRequest, checkWrite, parseWrite, pictureRequest, standInWrite, WRITE_SYSTEM, FEELINGS } from '../writer.mjs';
import { BadRequest } from '../errors.mjs';
import { geminiRequest } from '../gemini.mjs';

const said = (texts) => { let i = 0; const asked = []; return { asked, messages: { async create(p) { asked.push(p); const t = texts[Math.min(i++, texts.length - 1)]; return typeof t === 'string' ? { content: [{ type: 'text', text: t }] } : standInWrite(); } } }; };
const PNG = 'iVBORw0KGgo'.padEnd(200, 'A');

test('what they wrote is kept short and clean, and must say something', () => {
  assert.throws(() => checkWrite({ text: ' ' }), BadRequest);
  assert.throws(() => checkWrite(null), BadRequest);
  const b = checkWrite({ text: `a <b>boat</b>\n{"x":1}${'z'.repeat(900)}`, young: true, seed: -7.2 });
  assert.equal(b.text.length <= 600, true);
  assert.doesNotMatch(b.text, /[<>{}"]/);
  assert.deepEqual([b.young, b.seed], [true, 7]);
});

test('the answer is kept only as it can be told: known feeling, 2 to 5 lines, a picture', () => {
  const t = parseWrite(standInWrite().content[0].text);
  assert.deepEqual([t.title, t.feeling, t.lines.length], ['The Lantern Shore', 'longing', 4]);
  assert.equal(parseWrite(JSON.stringify({ lines: ['one'] })), null, 'one line is not a story');
  assert.equal(parseWrite('not json'), null);
  const odd = parseWrite(JSON.stringify({ title: 'x', feeling: 'ecstatic', lines: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], picture: 'p' }));
  assert.deepEqual([odd.feeling, odd.lines.length], ['strange', 5], 'an unknown feeling becomes strange; at most 5 lines');
});

test('the storyteller is told to read the feeling and the picture, and never name the feeling', () => {
  for (const f of Object.keys(FEELINGS)) assert.ok(WRITE_SYSTEM.includes(f));
  assert.match(WRITE_SYSTEM, /Never name the feeling/);
  const p = writeRequest({ text: 'a boat', young: true }, { model: 'm' });
  assert.match(p.system, /They are a child/);
  assert.match(p.messages[0].content, /a boat/);
});

test('the picture is asked for from words alone, and Gemini reads it as text to image', () => {
  const req = pictureRequest({ picture: 'A pier at dusk.', feeling: 'longing', young: false, seed: 3 });
  assert.equal(req.textToImageParams.conditionImage, undefined, 'no drawing goes with it');
  const g = geminiRequest(req);
  assert.deepEqual(g.images, []);
  assert.match(g.prompt, /A pier at dusk/);
  assert.match(g.prompt, /low golden light/);
  assert.equal(g.ratio, '16:9');
});

test('a story comes with its picture; sent back once if it could not be used', async () => {
  const claude = said(['nonsense', standInWrite().content[0].text]);
  let painted = null;
  const r = await write({ text: 'a lantern on a pier' }, { claude, model: 'm', paint: async (b) => { painted = b; return PNG; } });
  assert.equal(r.status, 200);
  assert.equal(r.json.lines.length, 4);
  assert.match(r.json.image, /^data:image\/png;base64,/);
  assert.equal(claude.asked.length, 2);
  assert.ok(painted.textToImageParams.text.includes('lantern'));
});

test('no picture left today, none set up, or a refusal: the story still comes', async () => {
  const claude = said([standInWrite().content[0].text]);
  const none = await write({ text: 'a boat' }, { claude, model: 'm', paint: null });
  assert.equal(none.json.image, undefined);
  const spent = await write({ text: 'a boat' }, { claude, model: 'm', paint: async () => PNG, budget: { take: async () => false } });
  assert.deepEqual([spent.json.today, spent.json.image], [true, undefined]);
  const blocked = await write({ text: 'a boat' }, { claude, model: 'm', paint: async () => { throw new Error('blocked by Gemini\'s content filter'); } });
  assert.deepEqual([blocked.json.blocked, blocked.json.lines.length], [true, 4]);
  const broke = await write({ text: 'a boat' }, { claude, model: 'm', paint: async () => { throw new Error('socket hang up'); } });
  assert.deepEqual([broke.json.blocked, broke.json.image, broke.json.lines.length], [undefined, undefined, 4]);
  const failed = await write({ text: 'a boat' }, { claude: said(['x', 'y']), model: 'm' });
  assert.equal(failed.status, 502);
});

test('the story can come first and the picture after, so the telling begins while it is painted', async () => {
  const claude = said([standInWrite().content[0].text]);
  let painted = 0;
  const paint = async () => { painted++; return PNG; };
  const first = await write({ text: 'a lantern on a pier', want: 'story' }, { claude, model: 'm', paint });
  assert.equal(painted, 0, 'nothing painted yet');
  assert.equal(first.json.image, undefined);
  assert.match(first.json.picture, /lantern/);
  const second = await write({ want: 'picture', picture: first.json.picture, feeling: first.json.feeling }, { paint, budget: { take: async () => true } });
  assert.match(second.json.image, /^data:image\/png/);
  assert.equal(painted, 1);
  assert.deepEqual((await write({ want: 'picture', picture: 'A pier at dusk with a lantern.' }, { paint: null })).json, { off: true });
  assert.deepEqual((await write({ want: 'picture', picture: 'A pier at dusk with a lantern.' }, { paint, budget: { take: async () => false } })).json, { off: true, today: true });
  const blocked = await write({ want: 'picture', picture: 'A pier at dusk with a lantern.' }, { paint: async () => { throw new Error('blocked by Gemini'); } });
  assert.deepEqual(blocked.json, { blocked: true });
  await assert.rejects(() => write({ want: 'picture', picture: 'short' }, { paint }), BadRequest);
});

test('the picture is painted in the look of their world when its picture comes with it', async () => {
  let got = null;
  const jpg = `data:image/jpeg;base64,${'A'.repeat(120)}`;
  await write({ want: 'picture', picture: 'A pier at dusk with a lantern.', style: jpg }, { paint: async (b) => { got = b; return PNG; } });
  assert.equal(got.styleImage, 'A'.repeat(120));
  await assert.rejects(() => write({ want: 'picture', picture: 'A pier at dusk with a lantern.', style: 'nope' }, { paint: async () => PNG }), BadRequest);
});
