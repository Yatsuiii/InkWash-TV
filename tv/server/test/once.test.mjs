import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOnce, ONCE } from '../once.mjs';
import { createHandler } from '../lambda.mjs';
import { standInMarble } from '../marble.mjs';
import { memorySpend } from '../limits.mjs';

const jpeg = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9, ...Array(80).fill(0)]);
const PICTURE = `data:image/jpeg;base64,${jpeg(1280, 800).toString('base64')}`;
const post = (h, path, body) => h({ rawPath: path, headers: {}, requestContext: { http: { method: 'POST', sourceIp: '203.0.113.9' } }, body: JSON.stringify(body) });

test('never paid twice: the same paid request asked again is answered with the first, and one still being made is waited for', async () => {
  let made = 0;
  const once = createOnce();
  const make = async () => { made++; await new Promise((r) => setTimeout(r, 5)); return { status: 200, json: { image: `pic${made}` } }; };
  const [a, b] = await Promise.all([once.run('/real', { image: 'x' }, make), once.run('/real', { image: 'x' }, make)]);
  assert.equal(made, 1, 'asked twice at once: made once');
  assert.deepEqual([a.json, b.json], [{ image: 'pic1' }, { image: 'pic1', again: true }]);
  assert.deepEqual((await once.run('/real', { image: 'x' }, make)).json, { image: 'pic1', again: true });
  assert.equal((await once.run('/real', { image: 'y' }, make)).json.image, 'pic2', 'asked for something else, made');
  assert.equal(once.saved, 2);
  // what costs nothing is never kept
  await once.run('/remark', { image: 'x' }, make);
  await once.run('/remark', { image: 'x' }, make);
  assert.equal(made, 4);
  assert.deepEqual(ONCE.paths, ['/real', '/thing', '/backdrop', '/wide', '/world', '/alive', '/scene']);
});

test('never paid twice: only what was made is kept, for ten minutes, the oldest let go first', async () => {
  let t = 0, made = 0;
  const once = createOnce({ most: 2, now: () => t });
  const answer = (json, status = 200) => async () => { made++; return { status, json }; };
  // turned down, none left today, or gone wrong: asked again, it is asked again
  for (const [json, status] of [[{ blocked: true }], [{ off: true, today: true }], [{ error: 'busy' }, 429]]) {
    await once.run('/thing', { n: 1 }, answer(json, status));
    await once.run('/thing', { n: 1 }, answer(json, status));
  }
  assert.equal(made, 6);
  await assert.rejects(once.run('/thing', { n: 2 }, async () => { throw new Error('no'); }));
  assert.equal((await once.run('/thing', { n: 2 }, answer({ image: 'ok' }))).json.image, 'ok', 'a request that failed can be made');
  // ten minutes on, made again
  made = 0;
  await once.run('/backdrop', { k: 1 }, answer({ image: 'a' }));
  t += ONCE.ttl - 1;
  await once.run('/backdrop', { k: 1 }, answer({ image: 'a' }));
  assert.equal(made, 1);
  t += 2;
  await once.run('/backdrop', { k: 1 }, answer({ image: 'a' }));
  assert.equal(made, 2);
  // at most two kept: the oldest goes
  await once.run('/scene', { k: 2 }, answer({ scene: 'b' }));
  await once.run('/scene', { k: 3 }, answer({ scene: 'c' }));
  assert.ok(once.size <= 3);
  await once.run('/scene', { k: 4 }, answer({ scene: 'd' }));
  made = 0;
  await once.run('/backdrop', { k: 1 }, answer({ image: 'a' }));
  assert.equal(made, 1, 'let go to make room');
});

test('never paid twice, through the story server: a world asked for twice is one world, counted once, and answered again even once the day is spent', async () => {
  let taken = 0;
  const marble = standInMarble(), worlds = { async take() { taken++; return true; } }, spend = memorySpend({ perDay: 1 });
  const h = createHandler({ claude: null, speak: async () => null, marble, worlds, spend });
  const logged = [], was = console.log;
  console.log = (m) => logged.push(m);
  try {
    const first = JSON.parse((await post(h, '/world', { image: PICTURE, scene: 'A ferry.' })).body);
    await spend.add(1);
    const again = JSON.parse((await post(h, '/world', { image: PICTURE, scene: 'A ferry.' })).body);
    assert.equal(again.job, first.job);
    assert.equal(again.again, true);
    assert.equal(marble.asked.length, 1, 'World Labs asked once');
    assert.equal(taken, 1, 'counted once against the day');
    assert.match(logged.join('\n'), /asked again: \/world, answered with what was made/);
    // something new, once the day is spent, is not made
    assert.equal((await post(h, '/world', { image: PICTURE, scene: 'Another.' })).statusCode, 429);
  } finally { console.log = was; }
});

test('a world built ahead is off unless whoever runs the server turns it on', async () => {
  const { readFileSync } = await import('node:fs');
  const template = readFileSync(new URL('../template.yaml', import.meta.url), 'utf8');
  assert.match(template, /WorldsAhead:\n    Type: String\n    Default: 'off'/);
  assert.match(template, /GUIDE_WORLDS_AHEAD: !Ref WorldsAhead/);
});
