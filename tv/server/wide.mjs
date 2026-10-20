// All around it: a night's picture made real, widened to either side into a panorama by Amazon Nova
// Canvas (OUTPAINTING), the way Dream Canvas widened a sketch's picture. The TV sends the picture
// already set in the middle of a wider sheet (WIDE.width x WIDE.height, its sides the picture's own
// edges mirrored, for the model to start from), and a mask the same size: black where the picture
// is, kept as it is; white to either side, painted as more of the same place, in the same look. The
// panorama comes back the same size. Counted with the day's pictures; a child's is gentle; turned
// down, or none left today, and the picture stays as it was. Nothing is kept here.
//
// `paint(body)` is Nova Canvas (lambda.mjs: Bedrock InvokeModel), given its request body and
// returning one base64 image; `budget.take()` says whether a picture is left today (budget.mjs).

import { BadRequest } from './guide.mjs';
import { sizeOf } from './reel.mjs';
import { LOOKS, NOT, NOT_FOR_A_CHILD, REAL } from './illustrator.mjs';

// a 16:5 sheet, the picture's 16:10 in its middle: within what Nova Canvas takes (each side 320 to
// 4096 and a multiple of 16, at most 4:1, under 4,194,304 pixels)
export const WIDE = { width: 2560, height: 800, image: 4_000_000, mask: 400_000, scene: 640, quality: 'standard', cfg: 6.5, most: 5_500_000 };
export const WIDER = 'The same place, seen further to either side: the land, water and sky go on as they are, in the same light, the same weather and the same look.';
const GENTLE = 'Gentle, friendly and cosy, for a young child.';
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const dataUrl = (s) => /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''));

// What the TV sends: the sheet (a JPEG or PNG data URL), its mask (a PNG, black and white only),
// both WIDE.width x WIDE.height; the scene the Illustrator wrote for the picture; its look; whether
// a child painted it; a seed.
export function checkWide(body) {
  if (!body || typeof body !== 'object') throw new BadRequest('expected a JSON object');
  const im = dataUrl(body.image), mk = dataUrl(body.mask);
  if (!im) throw new BadRequest('image must be a JPEG or PNG data URL');
  if (!mk || mk[1] !== 'png') throw new BadRequest('mask must be a PNG data URL');
  if (im[2].length > WIDE.image) throw new BadRequest('image is too large');
  if (mk[2].length > WIDE.mask) throw new BadRequest('mask is too large');
  const a = sizeOf(Buffer.from(im[2], 'base64')), b = sizeOf(Buffer.from(mk[2], 'base64'));
  if (!a || a[0] !== WIDE.width || a[1] !== WIDE.height) throw new BadRequest(`image must be ${WIDE.width} x ${WIDE.height}`);
  if (!b || b[0] !== WIDE.width || b[1] !== WIDE.height) throw new BadRequest(`mask must be ${WIDE.width} x ${WIDE.height}`);
  const young = body.young === true;
  return {
    image: im[2], mask: mk[2], scene: clean(body.scene, WIDE.scene), young,
    look: Object.hasOwn(LOOKS, body.look) ? body.look : young ? 'film' : 'real',
    seed: Math.max(0, Math.min(REAL.seeds, Math.round(Number(body.seed) || 0))),
  };
}

// Nova Canvas's request: outpainting, the picture kept (black in the mask) and its sides painted
// (white); the prompt is its look, its scene and that it goes on to either side
export function wideRequest({ image, mask, scene = '', young = false, look = 'real', seed = 0 }) {
  const text = [LOOKS[look] || LOOKS.real, scene, WIDER, young ? GENTLE : ''].filter(Boolean).join(' ').slice(0, REAL.text);
  return {
    taskType: 'OUTPAINTING',
    outPaintingParams: { image, maskImage: mask, outPaintingMode: 'DEFAULT', text, negativeText: young ? `${NOT}, ${NOT_FOR_A_CHILD}` : NOT },
    imageGenerationConfig: { numberOfImages: 1, quality: WIDE.quality, cfgScale: WIDE.cfg, seed },
  };
}

const isBlocked = (err) => /content filter|blocked|responsible ai|moderat/i.test(String((err && err.message) || ''));

// Returns { status, json }: { image (a data URL) }; or { off: true } when there are no pictures here
// (none set up, none left today, or too big to send back); or { blocked: true } when the image
// model's filter turned it down.
export async function wide(body, { paint = null, budget = null, log = () => {} }) {
  const r = checkWide(body);
  if (!paint) return { status: 200, json: { off: true } };
  if (budget && !(await budget.take())) { log('all around it: no pictures left today'); return { status: 200, json: { off: true, today: true } }; }
  try {
    const out = String(await paint(wideRequest(r)) || '');
    if (!/^[A-Za-z0-9+/=]{100,}$/.test(out)) throw new Error('no picture came back');
    if (out.length > WIDE.most) { log(`all around it: too big to send (${out.length})`); return { status: 200, json: { off: true, big: true } }; }
    return { status: 200, json: { image: `data:image/${out.startsWith('/9j/') ? 'jpeg' : 'png'};base64,${out}` } };
  } catch (err) {
    if (!isBlocked(err)) throw err;
    log(`all around it: turned down by the image model's filter (${String(err.message).slice(0, 120)})`);
    return { status: 200, json: { blocked: true } };
  }
}
