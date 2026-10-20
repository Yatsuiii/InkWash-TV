import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARBLE, checkWorld, worldRequest, pickSplat, worldOf, world, worldCheck, worldFile, worldLabs, standInMarble, standInSplats } from '../marble.mjs';
import { handle } from '../guide.mjs';
import { memoryBudget } from '../budget.mjs';
import { memorySpend, metered, WORLD } from '../limits.mjs';

// the head of a JPEG, as far as its size
const jpeg = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9, ...Array(80).fill(0)]);
const PICTURE = `data:image/jpeg;base64,${jpeg(1280, 800).toString('base64')}`;

test('walk inside: a world asked for from the picture made real and what it shows, private, the quick model; a child\'s gentle', () => {
  const r = checkWorld({ image: PICTURE, scene: 'A white ferry\non a dark lake.', name: 'The Low Shore', young: true });
  assert.deepEqual([r.ext, r.scene, r.name, r.young], ['jpg', 'A white ferry on a dark lake.', 'The Low Shore', true]);
  assert.throws(() => checkWorld({ image: 'data:image/gif;base64,AAAA' }), /JPEG or PNG data URL/);
  assert.throws(() => checkWorld({ image: 'data:image/png;base64,QUJD' }), /must be a JPEG or PNG/);
  assert.throws(() => checkWorld(null), /JSON object/);
  const body = worldRequest(r);
  assert.equal(body.model, 'marble-1.0-draft');
  assert.deepEqual(body.permission, { public: false });
  assert.equal(body.display_name, 'The Low Shore');
  assert.deepEqual(body.world_prompt.image_prompt, { source: 'data_base64', data_base64: r.image, extension: 'jpg' });
  assert.equal(body.world_prompt.text_prompt, 'A white ferry on a dark lake. Gentle, friendly and calm, for a young child.');
  assert.equal(worldRequest({ image: 'QUJD' }).world_prompt.text_prompt, undefined, 'nothing said, no text');
});

test('walk inside: the TV is given the lighter file it can draw, where the ground is, and nothing it can\'t reach', () => {
  const urls = { '100k': 'https://cdn.example/a/100k.spz', '500k': 'https://cdn.example/a/500k.spz', full_res: 'https://cdn.example/a/full.spz' };
  assert.equal(pickSplat(urls).key, '100k');
  assert.equal(pickSplat({ '500k': urls['500k'], full_res: urls.full_res }).key, '500k', 'too big for a TV, the smallest there is');
  assert.equal(pickSplat({ '100k': 'http://not-https/100k.spz' }), null);
  const w = worldOf({ world_id: 'abc123', assets: { thumbnail_url: 'https://cdn.example/t.jpg', imagery: { pano_url: 'https://cdn.example/p.jpg' }, splats: { spz_urls: urls, semantics_metadata: { metric_scale_factor: 1.4, ground_plane_offset: 1.7 } } } });
  assert.deepEqual(w, { id: 'abc123', splat: '100k', pano: 'https://cdn.example/p.jpg', thumbnail: 'https://cdn.example/t.jpg', scale: 1.4, ground: 1.7 });
});

test('walk inside: asked for, looked in on until it is built, its file handed over here; none without a key, none past the day\'s count', async () => {
  const marble = standInMarble();
  assert.deepEqual((await world({ image: PICTURE }, {})).json, { off: true }, 'no key: no worlds');
  const started = await world({ image: PICTURE, scene: 'A ferry.' }, { marble, budget: memoryBudget({ perDay: 1 }) });
  assert.match(started.json.job, /^op\d{6}$/);
  assert.equal(marble.asked.length, 1);
  assert.deepEqual((await world({ image: PICTURE }, { marble, budget: { take: async () => false } })).json, { off: true, today: true });
  assert.deepEqual((await worldCheck({ job: started.json.job }, { marble })).json, { waiting: true });
  const built = (await worldCheck({ job: started.json.job }, { marble })).json.world;
  assert.equal(built.splat, '100k');
  assert.equal(built.ground, 1.6);
  const got = await worldFile({ id: built.id, splat: built.splat }, { marble });
  assert.equal(got.json.type, 'ply');
  assert.match(Buffer.from(got.json.file, 'base64').subarray(0, 3).toString(), /^ply/);
  await assert.rejects(worldCheck({ job: '../etc' }, { marble }), /job must be what \/world gave/);
  await assert.rejects(worldFile({ id: built.id, splat: '../x' }, { marble }), /splat must be what/);
  assert.deepEqual((await worldFile({ id: built.id, splat: 'huge' }, { marble })).json, { failed: true }, 'only a file that world has');
  // a world World Labs turns down, or that fails, says so
  const refuses = { ...marble, async start() { const e = new Error('World Labs 400: content policy violation'); e.status = 400; throw e; } };
  assert.deepEqual((await world({ image: PICTURE }, { marble: refuses })).json, { blocked: true });
  const fails = { ...marble, async poll(id) { return { operation_id: id, done: true, error: { message: 'out of memory' } }; } };
  assert.deepEqual((await worldCheck({ job: 'op000001' }, { marble: fails })).json, { failed: true });
  // a file too big to come through here isn't sent
  const big = { ...marble, async fetch() { return Buffer.alloc(MARBLE.file); } };
  assert.deepEqual((await worldFile({ id: built.id, splat: '100k' }, { marble: big })).json, { failed: true, big: true });
});

test('walk inside: through the guide, a world priced as it is asked for and none once the day\'s spending is reached', async () => {
  const spend = memorySpend({ perDay: 1 }), marble = standInMarble();
  const paid = metered({ claude: null, marble }, { spend });
  const r = await handle('/world', { image: PICTURE }, { claude: null, marble: paid.marble, worlds: memoryBudget({ perDay: 5 }) });
  assert.match(r.json.job, /^op/);
  assert.equal(await spend.today(), WORLD);
  assert.equal((await handle('/world/check', { job: r.json.job }, { claude: null, marble: paid.marble })).json.waiting, true);
  assert.equal((await handle('/world/check', { job: r.json.job }, { claude: null, marble: paid.marble })).json.world.splat, '100k');
  assert.equal((await handle('/world/check', { job: 'x' }, { claude: null, marble: paid.marble })).status, 400);
  await spend.add(1);
  assert.equal((await handle('/world', { image: PICTURE }, { claude: null, marble: paid.marble })).status, 429, 'the day\'s spending reached');
});

test('walk inside: the World Labs API as the Dream Canvas calls it, its key in a header', async () => {
  const seen = [];
  const f = async (url, init = {}) => {
    seen.push([url, init.method || 'GET', init.headers && init.headers['WLT-Api-Key']]);
    if (/worlds:generate$/.test(url)) return new Response(JSON.stringify({ operation_id: 'op-1234567', done: false }));
    if (/operations\//.test(url)) return new Response(JSON.stringify({ operation_id: 'op-1234567', done: true, response: { world_id: 'w-1234567' } }));
    if (/worlds\//.test(url)) return new Response(JSON.stringify({ world_id: 'w-1234567', assets: {} }));
    return new Response('no', { status: 404 });
  };
  const api = worldLabs({ key: 'k-secret', fetch: f });
  assert.equal((await api.start({})).operation_id, 'op-1234567');
  assert.equal((await api.poll('op-1234567')).response.world_id, 'w-1234567');
  assert.equal((await api.world('w-1234567')).world_id, 'w-1234567');
  assert.deepEqual(seen.map(([u, m, k]) => [u.replace(MARBLE.api, ''), m, k]), [['/worlds:generate', 'POST', 'k-secret'], ['/operations/op-1234567', 'GET', 'k-secret'], ['/worlds/w-1234567', 'GET', 'k-secret']]);
  await assert.rejects(api.fetch('http://plain/x.spz'), /https/);
  const err = await worldLabs({ key: 'k', fetch: async () => new Response('slow down', { status: 429 }) }).start({}).catch((e) => e);
  assert.equal(err.status, 429);
  assert.ok(standInSplats({ count: 10 }).length > 10 * 17 * 4, 'a stand-in world, as a PLY');
});
