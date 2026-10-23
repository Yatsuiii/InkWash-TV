import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWriter, IDEAS, PAUSE, HOLD, lineTime } from '../src/writestory.js';

const make = (over = {}) => {
  const el = { hidden: true, innerHTML: '' };
  const t = { now: 0 }, said = [], asked = [];
  let closed = 0;
  const ai = { write: async (b) => { asked.push(b); return over.reply || { title: 'The Lantern Shore', feeling: 'longing', lines: ['One.', 'Two.', 'Three.'], image: 'data:image/png;base64,AAAA' }; } };
  const w = createWriter({ ai: over.ai || ai, el, say: (x) => said.push(x), stop: () => said.push('<stop>'), qr: (u) => `<svg data-u="${u}"></svg>`, phone: () => ({ code: 'ABC234', url: 'https://x/phone?c=ABC234', listening: false }), seed: () => 7, onClose: () => { closed++; }, now: () => t.now });
  return { w, el, t, said, asked, closed: () => closed };
};
const settle = () => new Promise((r) => setTimeout(r, 0));

test('it opens on a phone QR and some ideas to choose with the remote', () => {
  const { w, el } = make();
  w.open();
  assert.equal(el.hidden, false);
  assert.match(el.innerHTML, /Write your story/);
  assert.match(el.innerHTML, /data-u="https:\/\/x\/phone\?c=ABC234"/);
  assert.match(el.innerHTML, /A B C 2 3 4/);
  for (const i of IDEAS) assert.ok(el.innerHTML.includes(i.label));
});

test('OK on an idea writes that story, paints it, and the first line is read aloud', async () => {
  const { w, asked, said, el } = make();
  w.open();
  w.press('right'); w.press('select');
  assert.equal(w.step, 'writing');
  await settle();
  assert.equal(w.step, 'story');
  assert.equal(asked[0].text, IDEAS[1].text);
  assert.deepEqual(said.filter((x) => x !== '<stop>'), ['One.']);
  assert.match(el.innerHTML, /The Lantern Shore/);
  assert.match(el.innerHTML, /data:image\/png/);
});

test('words from the phone are gathered for a moment, then written', async () => {
  const { w, t, asked } = make();
  w.open();
  w.words('a boat on a lake');
  w.words('and it is raining');
  t.now = PAUSE - 100; w.tick();
  assert.equal(w.step, 'ask');
  t.now = PAUSE + 100; w.tick();
  await settle();
  assert.equal(asked[0].text, 'a boat on a lake and it is raining');
  assert.equal(w.step, 'story');
});

test('the story goes line by line, by OK or by time, and ends with a choice to write another', async () => {
  const { w, t, said } = make();
  w.open(); w.press('select'); await settle();
  w.press('select');
  assert.equal(w.shown, 1);
  t.now += lineTime('Two.') + 10; w.tick();
  assert.equal(w.shown, 2);
  w.press('select');
  assert.equal(w.shown, 3);
  assert.match(w.story.title, /Lantern/);
  w.press('select');
  assert.equal(w.step, 'ask');
  assert.ok(said.includes('One.') && said.includes('Two.') && said.includes('Three.'));
});

test('no picture still tells the story; a failure says so and OK tries again; Back leaves', async () => {
  const none = make({ reply: { title: 'T', feeling: 'sad', lines: ['a', 'b'] } });
  none.w.open(); none.w.press('select'); await settle();
  assert.equal(none.w.step, 'story');
  assert.match(none.el.innerHTML, /plain/);
  const bad = make({ ai: { write: async () => { throw new Error('boom'); } } });
  bad.w.open(); bad.w.press('select'); await settle();
  assert.equal(bad.w.step, 'error');
  assert.match(bad.el.innerHTML, /couldn’t/);
  bad.w.press('select');
  assert.equal(bad.w.step, 'ask');
  bad.w.press('back');
  assert.equal(bad.closed(), 1);
  assert.equal(bad.el.hidden, true);
});

test('Back mid-story goes back a line first, and leaving while it writes drops the answer', async () => {
  const { w, closed } = make();
  w.open(); w.press('select'); await settle();
  w.press('select');
  w.press('back');
  assert.equal(w.shown, 0);
  const slow = make({ ai: { write: () => new Promise((r) => setTimeout(() => r({ title: 'x', feeling: 'joyful', lines: ['a', 'b'] }), 5)) } });
  slow.w.open(); slow.w.press('select');
  slow.w.press('back');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(slow.w.step, 'closed');
});

test('the story begins before the picture: it is asked for after, and fades in when it comes', async () => {
  const asked = [];
  const w2 = createWriter({ ai: { write: async (b) => { asked.push(b); return b.want === 'picture' ? { image: 'data:image/png;base64,BBBB' } : { title: 'T', feeling: 'joyful', lines: ['a', 'b'], picture: 'A bright field with a kite flying.' }; } }, el: { hidden: true, innerHTML: '', querySelector: () => null }, say: () => {}, now: () => 0 });
  w2.open(); w2.press('select'); await settle(); await settle();
  assert.deepEqual(asked.map((x) => x.want), ['story', 'picture']);
  assert.equal(asked[1].picture, 'A bright field with a kite flying.');
  assert.equal(w2.story.image, 'data:image/png;base64,BBBB');
});

test('the first line waits for its picture, up to a limit, then the telling goes on', async () => {
  let give; const t = { now: 0 };
  const ai = { write: (b) => (b.want === 'picture' ? new Promise((r) => { give = r; }) : Promise.resolve({ title: 'T', feeling: 'joyful', lines: ['a', 'b', 'c'], picture: 'A bright field with a kite flying.' })) };
  const w = createWriter({ ai, el: { hidden: true, innerHTML: '', querySelector: () => null }, say: () => {}, now: () => t.now });
  w.open(); w.press('select'); await settle();
  t.now = lineTime('a') + 50; w.tick();
  assert.equal(w.shown, 0, 'still waiting for the picture');
  t.now = HOLD + 100; w.tick();
  assert.equal(w.shown, 1, 'it waited long enough');
  give({ image: 'data:image/png;base64,CCCC' }); await settle();
  assert.equal(w.story.image, 'data:image/png;base64,CCCC');
});
