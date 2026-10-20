import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIDE, WIDER, checkWide, wideRequest, wide } from '../wide.mjs';
import { LOOKS, NOT, NOT_FOR_A_CHILD, REAL } from '../illustrator.mjs';
import { handle } from '../guide.mjs';
import { memoryBudget } from '../budget.mjs';

// the head of a picture, as far as its size: a PNG's IHDR, or a JPEG's frame
const png = (w, h) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const jpeg = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9, ...Array(80).fill(0)]);
const url = (kind, b) => `data:image/${kind};base64,${b.toString('base64')}`;
const SHEET = url('jpeg', jpeg(WIDE.width, WIDE.height)), MASK = url('png', png(WIDE.width, WIDE.height));
const PANORAMA = 'A'.repeat(400);

test('all around it: the sheet and its mask, both the size Nova Canvas is asked to widen, read from their own bytes', () => {
  assert.ok(WIDE.width % 16 === 0 && WIDE.height % 16 === 0 && WIDE.width * WIDE.height < 4_194_304 && WIDE.width / WIDE.height <= 4, 'a size Nova Canvas takes');
  const r = checkWide({ image: SHEET, mask: MASK, scene: 'A white ferry\non a dark lake', seed: 1e12 });
  assert.deepEqual([r.scene, r.look, r.young, r.seed], ['A white ferry on a dark lake', 'real', false, REAL.seeds]);
  assert.equal(checkWide({ image: SHEET, mask: MASK, young: true }).look, 'film', "a child's look, unless another is asked");
  assert.equal(checkWide({ image: SHEET, mask: MASK, look: 'storybook' }).look, 'storybook');
  assert.equal(checkWide({ image: SHEET, mask: MASK, look: 'nonsense' }).look, 'real');
  assert.throws(() => checkWide(null), /JSON object/);
  assert.throws(() => checkWide([]), /image must be/);
  assert.throws(() => checkWide({ image: 'data:image/gif;base64,AAAA', mask: MASK }), /JPEG or PNG/);
  assert.throws(() => checkWide({ image: SHEET, mask: url('jpeg', jpeg(WIDE.width, WIDE.height)) }), /mask must be a PNG/, 'a JPEG mask would not be pure black and white');
  assert.throws(() => checkWide({ image: url('jpeg', jpeg(1280, 800)), mask: MASK }), /image must be 2560 x 800/);
  assert.throws(() => checkWide({ image: SHEET, mask: url('png', png(1280, 800)) }), /mask must be 2560 x 800/);
  assert.throws(() => checkWide({ image: `data:image/jpeg;base64,${'A'.repeat(WIDE.image + 4)}`, mask: MASK }), /too large/);
});

test('all around it: outpainting, the picture kept and its sides painted as more of the same place, in its look; a child\'s gentle', () => {
  const r = wideRequest({ image: 'SU1H', mask: 'TUFTSw', scene: 'A white ferry on a dark lake.', look: 'painting', seed: 7 });
  assert.equal(r.taskType, 'OUTPAINTING');
  assert.deepEqual([r.outPaintingParams.image, r.outPaintingParams.maskImage, r.outPaintingParams.outPaintingMode], ['SU1H', 'TUFTSw', 'DEFAULT']);
  assert.equal(r.outPaintingParams.text, `${LOOKS.painting} A white ferry on a dark lake. ${WIDER}`);
  assert.equal(r.outPaintingParams.negativeText, NOT);
  assert.ok(!('width' in r.imageGenerationConfig) && !('height' in r.imageGenerationConfig), 'outpainting keeps the size it is given');
  assert.deepEqual([r.imageGenerationConfig.numberOfImages, r.imageGenerationConfig.seed], [1, 7]);
  const child = wideRequest({ image: 'SU1H', mask: 'TUFTSw', scene: 'x'.repeat(2000), young: true, look: 'film' });
  assert.ok(child.outPaintingParams.text.length <= REAL.text && child.outPaintingParams.negativeText === `${NOT}, ${NOT_FOR_A_CHILD}`);
});

test('all around it: a picture counted with the day\'s, none without Nova Canvas, and a refusal said plainly', async () => {
  const body = { image: SHEET, mask: MASK, scene: 'A lake.' };
  const asked = [];
  const paint = async (b) => { asked.push(b); return PANORAMA; };
  assert.deepEqual((await wide(body, {})).json, { off: true });
  assert.deepEqual((await wide(body, { paint, budget: memoryBudget({ perDay: 0 }) })).json, { off: true, today: true });
  assert.equal(asked.length, 0, 'none left today: nothing asked');
  const budget = memoryBudget({ perDay: 1 });
  const ok = await wide(body, { paint, budget });
  assert.deepEqual([ok.status, ok.json.image], [200, `data:image/png;base64,${PANORAMA}`]);
  assert.equal(asked[0].taskType, 'OUTPAINTING');
  assert.deepEqual((await wide(body, { paint, budget })).json, { off: true, today: true }, 'counted');
  const blocked = await wide(body, { paint: async () => { throw new Error('This request has been blocked by our content filters.'); } });
  assert.deepEqual(blocked.json, { blocked: true });
  await assert.rejects(wide(body, { paint: async () => { throw new Error('ThrottlingException'); } }), /Throttling/);
  assert.deepEqual((await wide(body, { paint: async () => 'A'.repeat(WIDE.most + 4) })).json, { off: true, big: true });
  // through the guide: a bad sheet is a 400, never a call
  const r = await handle('/wide', { image: SHEET, mask: url('png', png(10, 10)) }, { claude: null, paint });
  assert.deepEqual([r.status, /mask must be/.test(r.json.error)], [400, true]);
  const good = await handle('/wide', body, { claude: null, paint });
  assert.equal(good.status, 200);
});
