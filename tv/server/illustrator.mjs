// The Illustrator, one of the TV's agents, beside the storyteller and the Worldbuilder: once a
// painting is told, it makes it real. It looks at their painting, reads tonight's story and what
// is true of the things in it (engine/dreams/illustrate.mjs illustrateBrief), and writes the scene
// for an image model, Amazon Nova Canvas on Amazon Bedrock, and how each thing in it looks. Nova
// Canvas paints that scene over their strokes: the ink is its condition image and it holds to the
// ink's edges (CANNY_EDGE), so everything stands where they put it, made real. What it answers is
// held to their world in code (checkIllustration), sent back once with why; a thing's look, once
// kept, is given back every night, so their world looks the same night after night.
//
// `claude.messages.create(params)` is the Messages API, as for the storyteller; `paint(body)` is
// Nova Canvas (lambda.mjs: Bedrock InvokeModel), given its request body and returning one base64
// image; `budget.take()` says whether a picture is left today (budget.mjs). Without `paint`, there
// are no pictures. dev.mjs and the tests stand in for all three. Nothing is kept here.

import { checkIllustration, ILLUSTRATE } from './engine/dreams/index.mjs';
import { BadRequest } from './guide.mjs';

export const REAL = {
  model: 'amazon.nova-canvas-v1:0',
  width: 1280, height: 800, // the paper's 16:10, in multiples of 16
  // how closely it holds to the ink's edges, 0 to 1: loosely, since their drawing is a rough guide
  // to where things are and how big, not to how they look, so a scribble becomes the real thing
  // and not a traced scribble
  strength: 0.45,
  cfg: 6.5, // how closely it holds to the words
  quality: 'standard',
  seeds: 858993459, // the largest seed it takes
  text: 1024, // the longest prompt it takes
};
// how it looks: real, for a grown-up's world; a frame of a warm animated film, for a child's; and,
// painted again (main.js PAINT_AGAIN), as a painting or a picture-book page
export const LOOKS = {
  real: 'A cinematic photograph of a real place, a dream come true: natural light, rich colour, fine detail and texture, atmosphere and depth.',
  film: 'A frame from a warm animated family film: soft cinematic light, rich colour, depth and atmosphere, every shape solid and real.',
  painting: 'A luminous painting of a real place, as a master painter would see it: painterly colour and light, atmosphere, depth and detail.',
  storybook: 'A page from a beautifully illustrated picture book: soft painted colour, warm light, gentle detail, full of wonder.',
};
const GENTLE = 'Gentle, friendly and cosy, for a young child.';
// never in it: what isn't the scene itself (their marks, words, frames), nor anything cruel; for a
// child, nothing frightening at all
export const NOT = 'text, letters, words, signature, watermark, frame, border, pencil sketch, line drawing, ink lines, brush strokes, scribbles, paper texture, blurry, distorted, deformed, horror, blood, gore, weapon';
export const NOT_FOR_A_CHILD = 'scary, frightening, menacing, sharp teeth, claws, angry face, darkness, crying';

export const ILLUSTRATE_SYSTEM = `You are the Illustrator of one person's imagined world, kept on their TV in Inkwash. They paint their world a piece at a time in ink with the TV remote, and a storyteller tells each painting back. Tonight's painting has been told. Now it is made real: an image model paints the real thing over their drawing. Their drawing is rough, made with a TV remote: it shows where each thing is and how big, not how it looks. What each thing is comes from what they said and answered, and from the story. You write what it paints.

You see their ink painting, tonight's story (each line with where its part of the painting is), and the things of their world in it: what is true of each, and how it looks, if it has a look already.

Write the scene as the caption of the finished picture, one paragraph of 40 to 90 words: what each mark is, as the real thing they meant, where it is (left, right, top, bottom, middle; near or far) and how big, as they painted it; the place around it; the time of day, the light, the weather and the colours, as the story feels. Only what can be seen: things, materials, colours, light. No names that can't be seen, no words or letters in the picture, no meaning, no instructions.

Then how each thing in the picture looks, in under 15 words, so it looks the same night after night: its colour, material, size and one feature. A thing that already has a look keeps it, word for word, in the scene too. A thing with a rule has its look in their own words: that is how it looks, over anything else, and the scene shows it so. Give the things of their world by id, and anything new the story names by the name the story calls it.

Nothing cruel or gruesome.

Reply with JSON only: {"scene": "...", "looks": [{"thing": "e1", "look": "..."}, {"thing": "the white heron", "look": "..."}]}`;

// for a child, said to the Illustrator as well
const YOUNG = 'A child painted it. Keep it gentle and friendly: warm light, nothing frightening, no one hurt or lost. Even for what is gentle, choose gentle words: light under a rocket or round a lantern is a warm glow, never fire or flames; a dragon is a friendly dragon.';

const LIMITS = { image: 1_500_000, at: 40, kind: 16 };
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// What the TV sends: its painting, the ink alone on white (a JPEG or PNG data URL), which the
// Illustrator looks at and the picture holds to; the Illustrator's brief, bounded (it is shown to
// the model as data); whether a child painted it; the look; and a seed (the same seed, the same hand).
export function checkReal(body) {
  if (!body || typeof body !== 'object') throw new BadRequest('expected a JSON object');
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
  if (!m) throw new BadRequest('image must be a JPEG or PNG data URL');
  if (m[2].length > LIMITS.image) throw new BadRequest('image is too large');
  const b = body.brief && typeof body.brief === 'object' ? body.brief : {};
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, ILLUSTRATE.lines)
    .map((l) => ({ text: clean(l && l.text, ILLUSTRATE.line), at: clean(l && l.at, LIMITS.at) || null })).filter((l) => l.text);
  if (!lines.length) throw new BadRequest('brief.lines must tell the painting');
  const things = (Array.isArray(b.things) ? b.things : []).slice(0, ILLUSTRATE.things).map((t) => ({
    id: clean(t && t.id, 12), name: clean(t && t.name, ILLUSTRATE.name), kind: clean(t && t.kind, LIMITS.kind) || 'thing',
    facts: (Array.isArray(t && t.facts) ? t.facts : []).slice(0, ILLUSTRATE.facts).map((f) => clean(f, ILLUSTRATE.line)).filter(Boolean),
    look: clean(t && t.look, ILLUSTRATE.look) || null,
  })).filter((t) => /^e\d+$/.test(t.id) && t.name);
  const young = body.young === true;
  const look = Object.hasOwn(LOOKS, body.look) ? body.look : young ? 'film' : 'real';
  const seed = Math.max(0, Math.min(REAL.seeds, Math.round(Number(body.seed) || 0)));
  return { image: { type: m[1], data: m[2] }, brief: { title: clean(b.title, ILLUSTRATE.title), lines, things }, young, look, seed };
}

// The Illustrator's request: their painting, seen, and the brief
export function illustrateRequest(brief, image, { model, young = false }) {
  return {
    model, max_tokens: 700,
    system: young ? `${ILLUSTRATE_SYSTEM}\n\n${YOUNG}` : ILLUSTRATE_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: `image/${image.type}`, data: image.data } },
        { type: 'text', text: `TONIGHT'S STORY, AND THE THINGS OF THEIR WORLD IN IT\n${JSON.stringify(brief)}\n\nWrite the scene.` },
      ],
    }],
  };
}

const cap = (t) => String(t || '').charAt(0).toUpperCase() + String(t || '').slice(1);
// how a thing looks, as said to the image model: their own words first, then the look kept
const lookSaid = ({ rule = null, look = null }) => [rule, look].filter(Boolean).map((x) => String(x).replace(/[.\s]+$/, '')).join('; ');
// Nova Canvas's request: text to image, held to the edges of their ink. The prompt is the look, the
// scene, and how each thing looks, as many as fit.
export function realRequest({ image, scene, looks = [], young = false, look = 'real', seed = 0 }) {
  const parts = [LOOKS[look] || LOOKS.real, scene];
  const room = REAL.text - (young ? GENTLE.length + 1 : 0);
  // a thing they said the look of in their own words, first, so theirs are never what is left out
  for (const l of [...looks.filter((x) => x.rule), ...looks.filter((x) => !x.rule)]) {
    const said = lookSaid(l);
    if (!said) continue;
    const s = `${cap(l.name)}: ${said}.`;
    if ([...parts, s].join(' ').length <= room) parts.push(s);
  }
  if (young) parts.push(GENTLE);
  return {
    taskType: 'TEXT_IMAGE',
    textToImageParams: {
      text: parts.join(' ').slice(0, REAL.text),
      negativeText: young ? `${NOT}, ${NOT_FOR_A_CHILD}` : NOT,
      conditionImage: image,
      controlMode: 'CANNY_EDGE',
      controlStrength: REAL.strength,
    },
    imageGenerationConfig: { numberOfImages: 1, width: REAL.width, height: REAL.height, quality: REAL.quality, cfgScale: REAL.cfg, seed },
  };
}

const jsonOf = (text) => { const m = /\{[\s\S]*\}/.exec(String(text || '')); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };
const textOf = (r) => (r && Array.isArray(r.content) ? r.content.filter((b) => b.type === 'text').map((b) => b.text).join('') : '');
// the image model's own filter turned it down
const isBlocked = (err) => /content filter|blocked|responsible ai|moderat/i.test(String((err && err.message) || ''));

// Returns { status, json }: { image (a data URL), scene, looks: [{ id?, name, look, kept }] }; or
// { off: true } when there are no pictures here (none set up, or none left today); or { blocked:
// true } when the image model's filter turned the picture down. The TV keeps the ink, either way.
export async function real(body, { claude, paint = null, budget = null, model, log = () => {} }) {
  const r = checkReal(body);
  if (!paint) return { status: 200, json: { off: true } };
  if (budget && !(await budget.take())) { log('dream it real: no pictures left today'); return { status: 200, json: { off: true, today: true } }; }
  const params = illustrateRequest(r.brief, r.image, { model, young: r.young });
  let ill = checkIllustration(jsonOf(textOf(await claude.messages.create(params))), r.brief, { young: r.young });
  if (!ill.ok) {
    // sent back once, with why
    log(`the Illustrator, sent back: ${ill.why}`);
    const [seen, asked] = params.messages[0].content;
    const again = { ...params, messages: [{ role: 'user', content: [seen, { ...asked, text: `${asked.text}\n\n(An earlier answer couldn't be used: ${ill.why}.)` }] }] };
    ill = checkIllustration(jsonOf(textOf(await claude.messages.create(again))), r.brief, { young: r.young });
  }
  if (!ill.ok) return { status: 502, json: { error: 'the Illustrator had nothing to paint' } };
  try {
    const out = String(await paint(realRequest({ image: r.image.data, scene: ill.scene, looks: ill.looks, young: r.young, look: r.look, seed: r.seed })) || '');
    if (!/^[A-Za-z0-9+/=]{100,}$/.test(out)) throw new Error('no picture came back');
    return { status: 200, json: { image: `data:image/${out.startsWith('/9j/') ? 'jpeg' : 'png'};base64,${out}`, scene: ill.scene, looks: ill.looks } };
  } catch (err) {
    if (!isBlocked(err)) throw err;
    log(`dream it real: turned down by the image model's filter (${String(err.message).slice(0, 120)})`);
    return { status: 200, json: { blocked: true } };
  }
}

// ---------------------------------------------------------------- one thing, made real on its own

// A thing of their world, painted on its own so it can stand in their world's place: what they
// painted of it (its strokes alone, in ink on white) is the condition image, and Nova Canvas holds to
// its edges, so it keeps the shape they gave it; it is painted as the Illustrator said it looks, in
// the look of their world's place, alone on plain white, which the TV cuts away. Counted with the
// day's pictures; a child's is gentle; turned down, or none left today, and the TV keeps their ink.
// `share`: things take at most this part of the day's pictures (budget.mjs), the rest left for a
// painting made real and its world's place. A thing made again (it looks another way now: their own
// words for it, or their world's look) is painted from its earlier picture, so it is still the same
// thing (IMAGE_VARIATION; `similar`: how close to it, 0.2 to 1); and once painted, Nova Canvas cuts
// it out itself, its edges clean (BACKGROUND_REMOVAL, counted with the day's pictures too), or the TV
// cuts the white away if that can't be had
export const THING = { min: 320, most: 768, strength: 0.5, cfg: 7, quality: 'standard', name: 60, look: 160, rule: 160, place: 160, big: 3_000_000, share: 0.75, similar: 0.6 };
// never in it, besides what is never in any picture: anything but the thing itself
export const NOT_THING = 'background, scenery, landscape, ground, floor, grass, sky, horizon, cast shadow, other objects, several, crowd, cropped, cut off';

export function checkThing(body) {
  if (!body || typeof body !== 'object') throw new BadRequest('expected a JSON object');
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
  if (!m) throw new BadRequest('image must be a JPEG or PNG data URL');
  if (m[2].length > LIMITS.image) throw new BadRequest('image is too large');
  const name = clean(body.name, THING.name);
  if (!name) throw new BadRequest('name the thing');
  // its earlier picture, if it is being made again: flat on white, as Nova Canvas takes it
  let reference = null;
  if (body.reference != null) {
    const r = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.reference));
    if (!r) throw new BadRequest('reference must be a JPEG or PNG data URL');
    if (r[2].length > LIMITS.image) throw new BadRequest('reference is too large');
    reference = r[2];
  }
  // its size, as Nova Canvas takes it: each side 320 to 768, in sixteens, at most 4 to 1
  const side = (v) => Math.round(Math.max(THING.min, Math.min(THING.most, Number(v) || 512)) / 16) * 16;
  let width = side(body.width), height = side(body.height);
  if (width > 4 * height) width = height * 4;
  if (height > 4 * width) height = width * 4;
  return {
    image: m[2], name, look: clean(body.look, THING.look) || null, rule: clean(body.rule, THING.rule) || null, place: clean(body.place, THING.place) || null, reference,
    young: body.young === true, seed: Math.max(0, Math.min(REAL.seeds, Math.round(Number(body.seed) || 0))), width, height,
  };
}

export function thingRequest({ image, name, look = null, rule = null, place = null, young = false, seed = 0, width = 512, height = 512, reference = null }) {
  const said = lookSaid({ rule, look });
  const parts = [
    `${cap(name)}${said ? `: ${said}` : ''}.`,
    `One single ${name.replace(/^(the|a|an|my|our) /i, '')}, whole, alone and centred, on a plain pure white background, with nothing else in the picture.`,
    place ? `Painted as ${place.replace(/[.\s]+$/, '').replace(/^(an?|the) /i, (m) => m.toLowerCase())}.` : 'A clean, finished illustration with solid shapes, rich colour and soft light.',
  ];
  if (young) parts.push(GENTLE);
  const text = parts.join(' ').slice(0, REAL.text), negativeText = `${NOT}, ${NOT_THING}${young ? `, ${NOT_FOR_A_CHILD}` : ''}`;
  // made again: from its earlier picture (which held to their strokes), as it looks now
  if (reference) {
    return {
      taskType: 'IMAGE_VARIATION',
      imageVariationParams: { images: [reference], similarityStrength: THING.similar, text, negativeText },
      imageGenerationConfig: { numberOfImages: 1, width, height, cfgScale: THING.cfg, seed },
    };
  }
  return {
    taskType: 'TEXT_IMAGE',
    textToImageParams: { text, negativeText, conditionImage: image, controlMode: 'CANNY_EDGE', controlStrength: THING.strength },
    imageGenerationConfig: { numberOfImages: 1, width, height, quality: THING.quality, cfgScale: THING.cfg, seed },
  };
}

// Its white cut away by Nova Canvas: the picture back with clear pixels round it, or null (none left
// today, or it couldn't be done), and then the TV cuts it out itself
export const cutRequest = (image) => ({ taskType: 'BACKGROUND_REMOVAL', backgroundRemovalParams: { image } });
async function cutOut(image, { paint, budget, log }) {
  if (budget && !(await budget.take(Date.now(), { share: THING.share }))) { log('a thing, cut out: no pictures left today, so the TV cuts it'); return null; }
  try {
    const out = String(await paint(cutRequest(image)) || '');
    if (!/^[A-Za-z0-9+/=]{100,}$/.test(out)) throw new Error('no picture came back');
    if (out.length > THING.big) throw new Error(`too big to send (${out.length})`);
    return out;
  } catch (err) {
    log(`a thing, cut out: ${String(err.message).slice(0, 120)}, so the TV cuts it`);
    return null;
  }
}

// Returns { status, json }: { image } (a data URL: the thing on white, or with `cut`, cut out with
// clear pixels round it); or { off } / { blocked }, as `real`. `cutout`: whether Nova Canvas cuts it
export async function thing(body, { paint = null, budget = null, log = () => {}, cutout = true }) {
  const t = checkThing(body);
  if (!paint) return { status: 200, json: { off: true } };
  if (budget && !(await budget.take(Date.now(), { share: THING.share }))) { log('a thing, made real: no pictures left today'); return { status: 200, json: { off: true, today: true } }; }
  try {
    const out = String(await paint(thingRequest(t)) || '');
    if (!/^[A-Za-z0-9+/=]{100,}$/.test(out)) throw new Error('no picture came back');
    if (out.length > THING.big) { log(`a thing, made real: too big to send (${out.length})`); return { status: 200, json: { off: true, big: true } }; }
    const cut = cutout ? await cutOut(out, { paint, budget, log }) : null;
    if (cut) return { status: 200, json: { image: `data:image/png;base64,${cut}`, cut: true } };
    return { status: 200, json: { image: `data:image/${out.startsWith('/9j/') ? 'jpeg' : 'png'};base64,${out}` } };
  } catch (err) {
    if (!isBlocked(err)) throw err;
    log(`a thing, made real: turned down by the image model's filter (${String(err.message).slice(0, 120)})`);
    return { status: 200, json: { blocked: true } };
  }
}

// Stand-ins, for the dev server and the tests. The Illustrator: tonight's story as the scene, and a
// plain look for each thing that has none.
export function standInIllustrator(params) {
  const asked = params.messages[0].content.find((c) => c.type === 'text').text;
  const brief = jsonOf(asked.split('\n').slice(1).join('\n').split('\n\nWrite the scene.')[0]) || { lines: [], things: [] };
  const scene = `A stand-in picture of the painting, made real: ${(brief.lines || []).map((l) => `${l.text}${l.at ? ` (${l.at})` : ''}`).join(' ')}`;
  const looks = (brief.things || []).filter((t) => !t.look).map((t) => ({ thing: t.id, look: `${t.name}, as the stand-in sees it` }));
  return { content: [{ type: 'text', text: JSON.stringify({ scene, looks }) }], stop_reason: 'end_turn' };
}

// Nova Canvas: a picture of dusk over water, 160 by 100, the same whatever is asked
let picture = null;
export async function standInPaint() {
  if (picture) return picture;
  const { deflateSync } = await import('node:zlib');
  const W = 160, H = 100, rows = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    rows[y * (W * 3 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const t = y / (H - 1), sea = t > 0.62, glow = Math.max(0, 1 - Math.hypot(x - W * 0.66, y - H * 0.6) / 40);
      const rgb = sea ? [30 + 40 * glow, 52 + 30 * glow, 84 + 20 * glow] : [70 + 170 * t + 30 * glow, 60 + 110 * t + 20 * glow, 120 + 40 * t];
      rgb.forEach((v, k) => { rows[y * (W * 3 + 1) + 1 + x * 3 + k] = Math.min(255, Math.round(v)); });
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), sum = Buffer.alloc(4); len.writeUInt32BE(data.length); sum.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, sum]); };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(W, 0); head.writeUInt32BE(H, 4); head[8] = 8; head[9] = 2;
  picture = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
  return picture;
}
