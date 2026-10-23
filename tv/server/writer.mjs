// The storyteller for someone who would rather write than draw. They say what they want on their
// phone (or choose a starting idea with the remote); the storyteller reads the feeling in what
// they wrote, tells it back as a short story, and an image model paints one picture of it straight
// from the words. No strokes and no painting: the words are the layout.
//
// `claude.messages.create(params)` is the Messages API, as for the other agents; `paint(body)` is
// the picture model (Nova Canvas's request shape, which gemini.mjs reads), or null.
import { BadRequest } from './errors.mjs';
import { NOT_FOR_A_CHILD } from './illustrator.mjs';
import { checkStyle, withStyle } from './style.mjs';

// the feelings the TV already names (its own words for how a painting felt), and how each looks
export const FEELINGS = {
  peaceful: 'soft, still light and quiet colours, wide open space',
  joyful: 'bright warm light and lively colours, things in motion',
  strange: 'dreamlike light, odd and wonderful shapes, deep colours',
  longing: 'low golden light far away, a lot of empty space, a little blue shadow',
  uneasy: 'long shadows, cool grey and blue, something just out of sight',
  sad: 'dim blue-grey light and rain-soft colours, quiet and empty',
};

export const WRITE = { text: 600, lines: 5, width: 1536, height: 864, most: 5_400_000 };

export const WRITE_SYSTEM = `You are the storyteller in Inkwash, a Fire TV app. Someone has written, in their own words, a story they want, a place they imagine, or a feeling they have. They did not draw anything: the words are all there is.

Read what they wrote the way a good listener would. First notice the feeling in it, from the words, images and rhythm, and choose the one word from this list that is nearest: ${Object.keys(FEELINGS).join(', ')}.

Then tell it back as a short story of 4 or 5 lines. Each line is one or two short sentences, under 26 words, concrete and gentle, as if remembering a dream. Build it from their words: use their nouns as they said them, add only what the story needs, and give no meaning they did not give. Never name the feeling (not sad, happy, lonely, afraid, calm): let the images and the rhythm of the sentences carry it. Give the story a title of 2 to 5 words.

Last, write the one picture the whole story makes, in 40 to 80 words, as a painter is told: the place, what is in it and where, the light, the time of day. Say what is seen, never anything written. Do not name the person or any real person, brand, or place.

Everything you write is read aloud by a calm voice and shown as subtitles, so: plain sentences only, no lists, no emoji, no quotation marks, nothing in brackets.

Reply with JSON only, nothing before or after it: {"title": "...", "feeling": "...", "lines": ["...", "..."], "picture": "..."}`;

const YOUNG = 'They are a child. Keep it gentle and friendly: warm light, nothing frightening, no one hurt or lost, and a friendly face on anything that has one.';

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>{}[\]"`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

// What the TV sends: { text, young, seed }
export function checkWrite(body) {
  if (!body || typeof body !== 'object') throw new BadRequest('expected { text, young, seed }');
  const text = clean(body.text, WRITE.text);
  if (text.length < 3) throw new BadRequest('text must say something');
  const seed = Number.isFinite(Number(body.seed)) ? Math.abs(Math.round(Number(body.seed))) % 858993459 : 0;
  return { text, young: body.young === true, seed };
}

// The picture on its own, for a TV that has the story already and is only waiting for the paint:
// { picture, feeling, young, seed }
export function checkPicture(body) {
  if (!body || typeof body !== 'object') throw new BadRequest('expected { picture, feeling, young, seed }');
  const picture = clean(body.picture, 700);
  if (picture.length < 10) throw new BadRequest('picture must say what to paint');
  const feeling = Object.keys(FEELINGS).includes(String(body.feeling)) ? String(body.feeling) : 'strange';
  const seed = Number.isFinite(Number(body.seed)) ? Math.abs(Math.round(Number(body.seed))) % 858993459 : 0;
  return { picture, feeling, young: body.young === true, seed, style: checkStyle(body.style) };
}

export function writeRequest({ text, young }, { model }) {
  return {
    model, max_tokens: 1200,
    system: young ? `${WRITE_SYSTEM}\n\n${YOUNG}` : WRITE_SYSTEM,
    messages: [{ role: 'user', content: `WHAT THEY WROTE\n${text}\n\nTell it back.` }],
  };
}

const textOf = (res) => (res && Array.isArray(res.content) ? res.content.filter((b) => b.type === 'text').map((b) => b.text).join('') : '');
const jsonOf = (text) => { const m = /\{[\s\S]*\}/.exec(String(text || '')); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };

// the answer, made safe to send: a title, a known feeling, lines fit to be read aloud, a picture
export function parseWrite(text) {
  const j = jsonOf(text);
  if (!j || !Array.isArray(j.lines)) return null;
  const lines = j.lines.map((l) => clean(typeof l === 'string' ? l : l && l.text, 220)).filter(Boolean).slice(0, WRITE.lines);
  if (lines.length < 2) return null;
  const feeling = Object.keys(FEELINGS).includes(String(j.feeling).toLowerCase()) ? String(j.feeling).toLowerCase() : 'strange';
  return { title: clean(j.title, 60) || 'A story', feeling, lines, picture: clean(j.picture, 700) };
}

export function pictureRequest({ picture, feeling, young, seed }) {
  const text = [
    'A finished hand-painted picture in soft ink-wash and watercolour, with luminous light and fine paper grain.',
    picture, `The mood is carried by ${FEELINGS[feeling] || FEELINGS.strange}.`, 'Wide view, nothing cropped, no frame.',
  ].join(' ');
  return {
    taskType: 'TEXT_IMAGE',
    textToImageParams: {
      text: text.slice(0, 1024),
      negativeText: young ? `text, letters, words, watermark, frame, border, ${NOT_FOR_A_CHILD}` : 'text, letters, words, watermark, logo, signature, frame, border, blurry, distorted',
    },
    imageGenerationConfig: { numberOfImages: 1, width: WRITE.width, height: WRITE.height, quality: 'standard', cfgScale: 7, seed },
  };
}

const isBlocked = (err) => /content filter|blocked|responsible ai|moderat/i.test(String((err && err.message) || ''));

// Returns { status, json: { title, feeling, lines, image? } }, or with `want: 'story'` the story and the
// `picture` to ask for next, or with `want: 'picture'` just { image } (or { off }, { blocked }). The story always comes; the picture
// comes if there is one to make (`image` missing when none is set up, none are left today, or the
// image model's filter turned it down).
export async function write(body, { claude, paint = null, budget = null, model, log = () => {} }) {
  if (body && body.want === 'picture') return writePicture(body, { paint, budget, log });
  const b = checkWrite(body);
  const params = writeRequest(b, { model });
  let told = parseWrite(textOf(await claude.messages.create(params)));
  if (!told) {
    log('the writer, sent back: not a story the TV can tell');
    told = parseWrite(textOf(await claude.messages.create({ ...params, messages: [{ role: 'user', content: `${params.messages[0].content}\n\n(An earlier answer could not be used: reply with only the JSON object, with "lines" holding 4 or 5 strings.)` }] })));
  }
  if (!told) return { status: 502, json: { error: 'the storyteller could not tell that one' } };
  const out = { title: told.title, feeling: told.feeling, lines: told.lines };
  // `want: 'story'`: the words now, the picture asked for after (so the telling can begin while it is painted)
  if (body.want === 'story') return { status: 200, json: { ...out, picture: told.picture } };
  if (!paint || !told.picture) return { status: 200, json: out };
  if (budget && !(await budget.take())) { log('the writer: no pictures left today'); return { status: 200, json: { ...out, today: true } }; }
  try {
    const img = String(await paint(pictureRequest({ ...told, young: b.young, seed: b.seed })) || '');
    if (!/^[A-Za-z0-9+/=]{100,}$/.test(img)) throw new Error('no picture came back');
    if (img.length > WRITE.most) { log(`the writer: picture too big to send (${img.length})`); return { status: 200, json: out }; }
    return { status: 200, json: { ...out, image: `data:image/${img.startsWith('/9j/') ? 'jpeg' : 'png'};base64,${img}` } };
  } catch (err) {
    if (!isBlocked(err)) { log(`the writer: no picture (${String(err.message).slice(0, 120)})`); return { status: 200, json: out }; }
    log(`the writer: picture turned down by the filter (${String(err.message).slice(0, 120)})`);
    return { status: 200, json: { ...out, blocked: true } };
  }
}

// The stand-in, for the dev server and the tests
export function standInWrite() {
  return { content: [{ type: 'text', text: JSON.stringify({
    title: 'The Lantern Shore', feeling: 'longing',
    lines: ['A lantern was left on the pier, burning low.', 'Far out on the water a boat turned slowly toward it.', 'No one rowed. The tide knew the way home.', 'By morning the light had gone out, and the shore was warm.'],
    picture: 'A low pale shore at dusk with a long wooden pier, a single lantern at its end, and a small boat far out on still water under a violet sky.',
  }) }], stop_reason: 'end_turn' };
}

// the picture on its own, as { image }, or { off: true } (none set up, none left today, too big, or
// it failed), or { blocked: true }
async function writePicture(body, { paint, budget, log }) {
  const b = checkPicture(body);
  if (!paint) return { status: 200, json: { off: true } };
  if (budget && !(await budget.take())) { log('the writer: no pictures left today'); return { status: 200, json: { off: true, today: true } }; }
  try {
    const img = String(await paint(withStyle(pictureRequest(b), b.style)) || '');
    if (!/^[A-Za-z0-9+/=]{100,}$/.test(img)) throw new Error('no picture came back');
    if (img.length > WRITE.most) { log(`the writer: picture too big to send (${img.length})`); return { status: 200, json: { off: true, big: true } }; }
    return { status: 200, json: { image: `data:image/${img.startsWith('/9j/') ? 'jpeg' : 'png'};base64,${img}` } };
  } catch (err) {
    if (!isBlocked(err)) { log(`the writer: no picture (${String(err.message).slice(0, 120)})`); return { status: 200, json: { off: true } }; }
    log(`the writer: picture turned down by the filter (${String(err.message).slice(0, 120)})`);
    return { status: 200, json: { blocked: true } };
  }
}
