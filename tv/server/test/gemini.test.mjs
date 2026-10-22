import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEMINI, ratioOf, geminiRequest, geminiBody, readPicture, geminiPaint } from '../gemini.mjs';
import { backdropRequest } from '../scenery.mjs';
import { realRequest, thingRequest, cutRequest, thing, NOT, REAL } from '../illustrator.mjs';
import { WIDE, wideRequest, wide } from '../wide.mjs';

// the head of a picture, as far as its size (as wide.test.mjs)
const png = (w, h) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const jpeg = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9, ...Array(80).fill(0)]);
const url = (kind, b) => `data:image/${kind};base64,${b.toString('base64')}`;
const PICTURE = 'iVBOR' + 'A'.repeat(400);
const answer = (data = PICTURE) => ({ candidates: [{ content: { parts: [{ text: 'Here it is.' }, { inlineData: { mimeType: 'image/png', data } }] }, finishReason: 'STOP' }] });

// Gemini, as far as this asks it: each call kept, each answer from `reply(model, body)`
function fakeGemini(reply) {
  const calls = [];
  const f = async (u, init) => {
    const model = /models\/([^:]+):generateContent$/.exec(u)[1];
    const body = JSON.parse(init.body);
    calls.push({ url: u, model, headers: init.headers, body });
    const [status, json] = reply(model, body);
    return { ok: status < 300, status, statusText: String(status), text: async () => (json == null ? '' : JSON.stringify(json)) };
  };
  return { f, calls };
}

test('Gemini: the shape nearest the one asked for, of those it paints in', () => {
  assert.equal(ratioOf(1280, 800), '3:2');
  assert.equal(ratioOf(640, 640), '1:1');
  assert.equal(ratioOf(1536, 864), '16:9');
  assert.equal(ratioOf(2560, 800), '21:9');
  assert.equal(ratioOf(400, 800), '9:16');
  assert.equal(ratioOf(0, 0), '16:9', 'no size: the TV\'s shape');
  assert.equal(ratioOf(undefined, 512), '16:9');
});

test('Gemini: each Nova Canvas request read as one for Gemini, in the same words', () => {
  // the night made real: over their ink, its words and what to leave out
  const real = geminiRequest(realRequest({ image: 'SU5L', scene: 'A white ferry on a dark lake.', seed: 9 }));
  assert.deepEqual(real.images, ['SU5L']);
  assert.match(real.prompt, /^This is a rough drawing\. Make it into a finished picture of what it shows\./);
  assert.match(real.prompt, /keep where everything is/);
  assert.match(real.prompt, /A white ferry on a dark lake\./);
  assert.ok(real.prompt.includes(`Leave out: ${NOT}.`));
  assert.deepEqual([real.ratio, real.seed], ['3:2', undefined], 'the paper\'s shape, as near as Gemini paints; no seed');
  assert.ok(real.prompt.length <= GEMINI.text);
  // a place, painted over the TV's own drawing of it
  const place = geminiRequest(backdropRequest({ scene: { place: 'A shore of black sand.', things: {} }, image: 'UExB', seed: 2 }));
  assert.deepEqual(place.images, ['UExB']);
  assert.match(place.prompt, /A shore of black sand\./);
  // the things of their world are painted on their own and set into it: never in the place too
  const bare = geminiRequest(backdropRequest({ scene: { place: 'A moon desert.', things: {} }, image: 'UExB', leave: ['the moon castle', 'the rocket'] }));
  assert.match(bare.prompt, /Leave out: [^.]*moon castle, rocket\./);
  // nothing invented: no one and nothing the drawing and the words don't have
  assert.match(real.prompt, /Add no one and nothing that neither the drawing nor these words have/);
  assert.equal(place.ratio, '16:9');
  // a thing on white, and the same thing made again from its earlier picture
  const t = geminiRequest(thingRequest({ image: 'Rk9Y', name: 'the fox', seed: 4 }));
  assert.deepEqual(t.images, ['Rk9Y']);
  assert.match(t.prompt, /One single fox, whole, alone and centred, on a plain pure white background/);
  assert.equal(t.ratio, '1:1');
  // the white it stands on is never among what to leave out (an image model told to leave the
  // background out may paint a checkerboard there), and is asked for plainly; the rest is left out
  const leaveOut = (prompt) => (/Leave out: ([^.]*)\./.exec(prompt) || [])[1] || '';
  for (const r of [t, geminiRequest(thingRequest({ image: 'Rk9Y', name: 'the fox', reference: 'QkVGT1JF', young: true }))]) {
    assert.ok(!/background/.test(leaveOut(r.prompt)), leaveOut(r.prompt));
    assert.match(leaveOut(r.prompt), /scenery, landscape, .*cast shadow, other objects/);
    assert.match(r.prompt, /The background is flat plain white from edge to edge/);
  }
  assert.ok(!/flat plain white/.test(real.prompt), 'a painting made real is not asked for on white');
  const again = geminiRequest(thingRequest({ image: 'Rk9Y', name: 'the fox', rule: 'grey, and older', reference: 'QkVGT1JF', seed: 4 }));
  assert.deepEqual(again.images, ['QkVGT1JF'], 'from its earlier picture, not its strokes');
  assert.match(again.prompt, /^Paint this same thing again, so it is clearly the very same one/);
  assert.match(again.prompt, /grey, and older/);
  assert.equal(geminiRequest(thingRequest({ image: 'Rk9Y', name: 'the fox', reference: 'QkVGT1JF', width: 400, height: 768 })).ratio, '9:16');
  // with no picture to start from, the shape asked for, or else the TV's
  assert.equal(geminiRequest({ taskType: 'TEXT_IMAGE', textToImageParams: { text: 'x' } }).ratio, '16:9');
  const words = geminiRequest({ taskType: 'TEXT_IMAGE', textToImageParams: { text: 'A lamp.' }, imageGenerationConfig: { width: 512, height: 512, seed: 1 } });
  assert.deepEqual([words.images, words.prompt, words.ratio], [[], 'A lamp.', '1:1']);
  // all around it: the sheet widened, at Gemini's widest
  const all = geminiRequest(wideRequest({ image: 'U0hFRVQ', mask: 'TUFTSw', scene: 'A lake.', look: 'real', seed: 5 }));
  assert.deepEqual([all.images, all.ratio], [['U0hFRVQ'], '21:9']);
  assert.match(all.prompt, /keep the middle exactly as it is/);
  assert.match(all.prompt, /A lake\./);
  // cutting out of its white: Gemini can't, so the TV does
  assert.equal(geminiRequest(cutRequest('Rk9Y')), null);
  assert.equal(geminiRequest(null), null);
  assert.equal(geminiRequest({ taskType: 'INPAINTING' }), null);
  // no seed is sent, whatever Nova Canvas was asked with: the shape that ran live never sent one
  for (const r of [real, place, t, again, words, all]) assert.ok(!('seed' in r));
  assert.equal(REAL.seeds > 0, true);
});

test('Gemini: the body as its API takes it, each picture with its own type', () => {
  const b = geminiBody({ images: ['/9j/AAAA', 'iVBORw0K'], prompt: 'Make it real.', ratio: '3:2', seed: 7 });
  assert.deepEqual(b.contents, [{ role: 'user', parts: [
    { text: 'Make it real.' },
    { inlineData: { mimeType: 'image/jpeg', data: '/9j/AAAA' } },
    { inlineData: { mimeType: 'image/png', data: 'iVBORw0K' } },
  ] }]);
  assert.deepEqual(b.generationConfig, { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '3:2' } }, 'a seed never sent');
  assert.deepEqual(geminiBody({ prompt: 'x' }).generationConfig, { responseModalities: ['TEXT', 'IMAGE'] }, 'no shape, none sent');
});

test('Gemini: its answer read for the picture, and a refusal said so the callers know it was the filter', () => {
  assert.equal(readPicture(answer()), PICTURE);
  assert.equal(readPicture({ candidates: [{ content: { parts: [{ inline_data: { data: 'QUJD' } }] } }] }), 'QUJD', 'either spelling');
  // a draft it thought with, then the finished picture: the finished one
  const drafted = { candidates: [{ content: { parts: [{ thought: true, inlineData: { data: 'RFJBRlQ' } }, { text: 'Done.' }, { inlineData: { data: 'RklOQUw' } }] } }] };
  assert.equal(readPicture(drafted), 'RklOQUw');
  assert.equal(readPicture({ candidates: [{ content: { parts: [{ thought: true, inlineData: { data: 'RFJBRlQ' } }] } }] }), 'RFJBRlQ', 'only a draft: the draft');
  assert.throws(() => readPicture({ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } }), /blocked by Gemini's content filter \(PROHIBITED_CONTENT\)/);
  assert.throws(() => readPicture({ candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [] } }] }), /blocked/);
  assert.throws(() => readPicture({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'I can only describe it.' }] } }] }), /^Error: no picture came back \(STOP\)$/);
  assert.throws(() => readPicture({}), /^Error: no picture came back$/);
  assert.throws(() => readPicture(null), /no picture came back/);
});

test('Gemini: the best model this key has, found once and kept; its key in a header; an error said plainly', async () => {
  const logs = [];
  const g = fakeGemini((model) => (model === 'gemini-3-pro-image-preview' ? [404, { error: { code: 404, message: 'models/gemini-3-pro-image-preview is not found', status: 'NOT_FOUND' } }] : [200, answer()]));
  const paint = geminiPaint({ key: 'k-123', fetch: g.f, log: (m) => logs.push(m) });
  assert.equal(await paint(realRequest({ image: 'SU5L', scene: 'A lake.' })), PICTURE);
  assert.deepEqual(g.calls.map((c) => c.model), ['gemini-3-pro-image-preview', 'gemini-3-pro-image']);
  assert.equal(g.calls[0].url, `${GEMINI.base}/models/gemini-3-pro-image-preview:generateContent`);
  assert.equal(g.calls[0].headers['x-goog-api-key'], 'k-123');
  assert.ok(!g.calls[0].url.includes('k-123'), 'the key never in the address, where logs keep it');
  assert.match(logs[0], /gemini-3-pro-image-preview isn't open to this key; trying the next/);
  assert.equal(g.calls[1].body.contents[0].parts[1].inlineData.data, 'SU5L');
  await paint(realRequest({ image: 'SU5L', scene: 'A lake.' }));
  assert.deepEqual(g.calls.map((c) => c.model).slice(2), ['gemini-3-pro-image'], 'the one that answered, from then on');
  // the model asked for first, then the rest; none open to it, said so
  const none = fakeGemini(() => [400, { error: { message: 'Model does not exist' } }]);
  await assert.rejects(geminiPaint({ key: 'k', model: 'my-model', fetch: none.f })(realRequest({ image: 'SU5L', scene: 'x' })), /none of the Gemini image models is open to this key \(Gemini said 400: Model does not exist\)/);
  assert.deepEqual(none.calls.map((c) => c.model), ['my-model', ...GEMINI.models]);
  // any other error, at once, with what Google said
  const down = fakeGemini(() => [500, { error: { message: 'Internal error encountered.', status: 'INTERNAL' } }]);
  await assert.rejects(geminiPaint({ key: 'k', fetch: down.f })(realRequest({ image: 'SU5L', scene: 'x' })), /^Error: Gemini said 500: Internal error encountered\.$/);
  assert.equal(down.calls.length, 1);
  const busy = fakeGemini(() => [429, null]);
  await assert.rejects(geminiPaint({ key: 'k', fetch: busy.f })(realRequest({ image: 'SU5L', scene: 'x' })), /Gemini said 429/);
  assert.equal(busy.calls.length, 1, 'only busy: not another model');
  // a model with no quota at all on this key's tier: the next one
  const tier = fakeGemini((model) => (model === GEMINI.models[0] ? [429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: `Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: ${model}` } }] : [200, answer()]));
  assert.equal(await geminiPaint({ key: 'k', fetch: tier.f })(realRequest({ image: 'SU5L', scene: 'x' })), PICTURE);
  assert.deepEqual(tier.calls.map((c) => c.model), GEMINI.models.slice(0, 2));
  // what Gemini can't do, never asked
  const asked = fakeGemini(() => [200, answer()]);
  await assert.rejects(geminiPaint({ key: 'k', fetch: asked.f })(cutRequest('Rk9Y')), /Gemini can't do BACKGROUND_REMOVAL/);
  assert.equal(asked.calls.length, 0);
});

test('Gemini, through the guide: a thing on white for the TV to cut out, a panorama, and a refusal as Nova Canvas\'s was', async () => {
  const g = fakeGemini(() => [200, answer()]);
  const paint = geminiPaint({ key: 'k', fetch: g.f });
  const strokes = url('png', Buffer.from('its strokes, black on white'));
  const t = await thing({ image: strokes, name: 'the fox' }, { paint, cutout: false });
  assert.deepEqual(t.json, { image: `data:image/png;base64,${PICTURE}` });
  assert.equal(g.calls.length, 1, 'one picture, not cut out here');
  const sheet = url('jpeg', jpeg(WIDE.width, WIDE.height)), mask = url('png', png(WIDE.width, WIDE.height));
  const w = await wide({ image: sheet, mask, scene: 'A lake.' }, { paint });
  assert.deepEqual([w.status, w.json.image], [200, `data:image/png;base64,${PICTURE}`]);
  assert.deepEqual(g.calls[1].body.generationConfig.imageConfig, { aspectRatio: '21:9' });
  assert.equal(g.calls[1].body.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
  const blocked = geminiPaint({ key: 'k', fetch: fakeGemini(() => [200, { promptFeedback: { blockReason: 'SAFETY' } }]).f });
  assert.deepEqual((await wide({ image: sheet, mask, scene: 'A lake.' }, { paint: blocked })).json, { blocked: true });
  assert.deepEqual((await thing({ image: strokes, name: 'the fox' }, { paint: blocked, cutout: false })).json, { blocked: true });
  // a JPEG back is sent as one
  const jpg = geminiPaint({ key: 'k', fetch: fakeGemini(() => [200, answer('/9j/' + 'A'.repeat(400))]).f });
  assert.match((await thing({ image: strokes, name: 'the fox' }, { paint: jpg, cutout: false })).json.image, /^data:image\/jpeg;base64,\/9j\//);
});
