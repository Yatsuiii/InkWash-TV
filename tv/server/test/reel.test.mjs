import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REEL, MOTION, sizeOf, checkAlive, aliveRequest, alive, aliveCheck, standInReel } from '../reel.mjs';
import { handle } from '../guide.mjs';
import { memoryBudget } from '../budget.mjs';
import { memorySpend, metered, CLIP } from '../limits.mjs';
import { clipFolder } from '../lambda.mjs';

// the head of a picture, as far as its size: a PNG's IHDR, or a JPEG's frame
const png = (w, h) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const jpeg = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9, ...Array(80).fill(0)]);
const url = (kind, b) => `data:image/${kind};base64,${b.toString('base64')}`;
const PICTURE = url('jpeg', jpeg(1280, 720));

test('it comes alive: only a picture the size Reel takes, its size read from its own bytes', () => {
  assert.deepEqual(sizeOf(png(1280, 720)), [1280, 720]);
  assert.deepEqual(sizeOf(jpeg(1280, 720)), [1280, 720]);
  assert.equal(sizeOf(Buffer.from('not a picture')), null);
  assert.equal(checkAlive({ image: PICTURE, scene: 'A ferry\nat night', young: true, seed: 9 }).scene, 'A ferry at night');
  assert.equal(checkAlive({ image: url('png', png(1280, 720)) }).format, 'png');
  assert.throws(() => checkAlive({ image: url('jpeg', jpeg(1280, 800)) }), /must be 1280 x 720/);
  assert.throws(() => checkAlive({ image: 'data:image/gif;base64,AAAA' }), /JPEG or PNG/);
  assert.throws(() => checkAlive(null), /JSON object/);
  assert.equal(checkAlive({ image: PICTURE, seed: 1e12 }).seed, REEL.seeds, 'a seed Reel takes');
});

test('it comes alive: one six-second shot from the picture, moving softly through its scene; a child\'s gentle', () => {
  const r = aliveRequest({ image: 'QUJD', format: 'jpeg', scene: 'A white ferry on a dark lake, a lantern at its bow.', young: true, seed: 4 });
  assert.deepEqual(r.videoGenerationConfig, { durationSeconds: 6, fps: 24, dimension: '1280x720', seed: 4 });
  assert.deepEqual(r.textToVideoParams.images, [{ format: 'jpeg', source: { bytes: 'QUJD' } }]);
  assert.equal(r.taskType, 'TEXT_VIDEO');
  assert.ok(r.textToVideoParams.text.startsWith(MOTION) && /white ferry/.test(r.textToVideoParams.text) && /for a young child/.test(r.textToVideoParams.text));
  assert.ok(aliveRequest({ image: 'x', scene: 'y'.repeat(2000) }).textToVideoParams.text.length <= REEL.text, 'as long as Reel takes, no longer');
});

test('it comes alive: asked for, looked in on until it is made, then a link to it; counted each day; turned down, it stays still', async () => {
  const reel = standInReel({ clip: 'https://clips.example/output.mp4' });
  const started = await alive({ image: PICTURE, scene: 'A ferry.' }, { reel });
  assert.match(started.json.job, /^arn:aws:bedrock:us-east-1:\d{12}:async-invoke\/standin\d+$/);
  assert.equal(reel.asked.length, 1);
  const { job } = started.json;
  assert.deepEqual((await aliveCheck({ job }, { reel })).json, { waiting: true });
  assert.deepEqual((await aliveCheck({ job }, { reel })).json, { waiting: true });
  assert.deepEqual((await aliveCheck({ job }, { reel })).json, { video: 'https://clips.example/output.mp4' });
  await assert.rejects(aliveCheck({ job: 'arn:aws:s3:::someone-elses' }, { reel }), /what \/alive gave/);
  // none without Reel; none past the day's clips
  assert.deepEqual((await alive({ image: PICTURE }, {})).json, { off: true });
  const clips = memoryBudget({ perDay: 1 });
  assert.ok((await alive({ image: PICTURE }, { reel, budget: clips })).json.job);
  assert.deepEqual((await alive({ image: PICTURE }, { reel, budget: clips })).json, { off: true, today: true });
  // Reel's filter: when asked, or as it makes it
  const refuses = { start: async () => { throw new Error('This request has been blocked by our content filters.'); } };
  assert.deepEqual((await alive({ image: PICTURE }, { reel: refuses })).json, { blocked: true });
  const fails = { check: async () => ({ status: 'Failed', why: 'The output was blocked by our content filters.' }) };
  assert.deepEqual((await aliveCheck({ job }, { reel: fails })).json, { blocked: true });
  assert.deepEqual((await aliveCheck({ job }, { reel: { check: async () => ({ status: 'Failed', why: 'internal' }) } })).json, { failed: true });
});

test('it comes alive through the guide: its two calls, a bad picture a 400, and each clip counted in the day\'s spending as it is asked for', async () => {
  const reel = standInReel({ clip: 'data:video/webm;base64,AAAA', ready: 1 });
  const deps = { claude: null, reel, clips: memoryBudget({ perDay: 5 }) };
  const r = await handle('/alive', { image: PICTURE }, deps);
  assert.equal(r.status, 200);
  assert.deepEqual((await handle('/alive/check', { job: r.json.job }, deps)).json, { video: 'data:video/webm;base64,AAAA' });
  assert.equal((await handle('/alive', { image: url('png', png(64, 64)) }, deps)).status, 400);
  const spend = memorySpend({ perDay: 1 });
  const paid = metered({ claude: null, reel: standInReel({ clip: 'x' }) }, { spend });
  await paid.reel.start({});
  assert.ok(Math.abs((await spend.today()) - CLIP) < 1e-6 && CLIP > 0.5 && CLIP < 0.6, `about 50 cents a clip: ${CLIP}`);
  await paid.reel.start({});
  await assert.rejects(paid.reel.start({}), /spent all it may today/, 'not one past the day\'s spending');
  // what kind of video a clip is, so a TV that can't play it is never offered one: Reel's an MP4,
  // the stand-in's a WebM, carried through the day's spending
  assert.equal(REEL.type, 'video/mp4');
  assert.equal(paid.reel.type, 'video/webm');
  assert.equal(standInReel({ clip: 'x', type: 'video/mp4' }).type, 'video/mp4');
});

test('it comes alive: a clip is looked for only in its own job\'s folder, never elsewhere in the bucket', () => {
  const job = 'arn:aws:bedrock:us-east-1:123456789012:async-invoke/abc123def456';
  assert.equal(clipFolder('s3://clips-b/clips', 'clips-b', job), 'clips/abc123def456/', 'Reel reports where it was told to write');
  assert.equal(clipFolder('s3://clips-b/clips/abc123def456', 'clips-b', job), 'clips/abc123def456/', 'or the job\'s own folder');
  assert.equal(clipFolder('s3://clips-b/clips/abc123def456/', 'clips-b', job), 'clips/abc123def456/');
  assert.equal(clipFolder('s3://clips-b', 'clips-b', job), 'abc123def456/');
  assert.equal(clipFolder('s3://someone-else/clips', 'clips-b', job), null, 'not in the clips bucket');
  assert.equal(clipFolder('', 'clips-b', job), null);
});
