// The Set Designer, one of the TV's agents: when a world's story starts, it reads what the world is
// and writes where it stands (engine/dreams/scene.mjs): the sky or roof, the light, what stands far
// off, the ground, what drifts in the air, and how the things painted into it stand there. The TV
// draws it, so every world's place is its own and none is a set background. Held to what the TV
// can draw in code (checkScene); sent back once if it can't be.
//
// `claude.messages.create(params)` is the Messages API, as for the storyteller; `standInScene`
// answers in its place for the dev server and the tests.

import { checkScene, sceneBrief, SHAPES, GROUND_KINDS, AIR_KINDS, LIGHT_KINDS } from './engine/dreams/index.mjs';
import { BadRequest } from './guide.mjs';
import { REAL } from './illustrator.mjs';

export const SCENE_SYSTEM = `You are the Set Designer of one person's imagined world, kept on their TV in Inkwash. They paint their world a piece at a time with the TV remote, and a storyteller tells each painting back. The TV shows their world as a place they can look across and walk through, with each thing they painted standing in it. You decide what that place is.

You are shown their world as far as it has gone: its nights (titles, the story told, and what they said themselves as they painted), and the things in it and what is true of them; and, if they said it, how they want their world to look ("look"), in their own words. Design the place THIS story happens in. What they said about its look comes first: follow it over anything else, in the colours, the light and how the things stand there. Read it closely: where is it, indoors or out, what time of day or night does it feel like, what weather, what is far off on the horizon, what is underfoot, what drifts in the air. An endless library is under a roof, lamplit, with shelves in the distance and boards underfoot. A drowned city might be a still lake at first light. Whales swimming in the sky might be over a floor of cloud. Inkwash is painted: every place is a painting, never a cartoon, a toy or a game, whoever the world belongs to, unless they asked for that in their own words. A playful story is still painted, in warm light and gentle colour. Never default to night on a lake: choose what the story says. If it says little, choose something that fits its mood and makes the things in it look their best: mist, dusk and lamplight suit most. Unless the story clearly happens by day, choose dusk or night: their world is seen by its own light, and what they draw into it glows.

The TV draws it in layers, from these parts only:
- "place": one sentence saying the place in plain words, as a painter would be told it.
- "look": how it looks, as an art director would put it, in at most twelve words: the style it is painted in (kinds of look, for example: a misty ink landscape at dusk; a moonlit ink-wash night; a warm lamplit oil painting; a soft watercolour in grey and gold; never a cartoon, a toy, a 3D game or anything glossy unless they asked for it). Say only what it is, never what it isn't: it is read out to them. An image model paints the place in this look, so choose it from what they said first, then from the story.
- "looks": three other looks this place could just as well have, each in at most eight words, made for this world and its story (never the examples above), different from "look" and from each other. They are offered to them to choose from, so make each one they could picture at once. In "look" and "looks", say the place, its light and its colour, never paper, parchment or a page: their world is a place they stand in, not a sheet.
- "roof": true if the story is under a roof (a hall, a library, a room, a cave); then "sky" is the ceiling's colours and has no stars or clouds.
- "sky": {"top", "middle", "bottom"} colours from the top of the sky to the horizon; "stars" 0 to 1; "clouds" 0 to 1; "cloud" and "cloudShade", the lit and shaded colour of clouds.
- "light": {"kind": one of ${LIGHT_KINDS.join(', ')}; "x" and "y" where it is, 0 to 1 across and down the sky (y near 1 is on the horizon); "color"; "glow" 0 to 1}. "lamps" are many small warm lights, for indoors.
- "far": up to three layers of what stands far off, farthest first, each {"shape": one of ${SHAPES.join(', ')}; "color"; "height" 0.03 to 0.45 of the sky; optional "top", a colour for its tops (snow on mountains, light on roofs); optional "windows", a colour for lit windows (towers, roofs, shelves)}. Farther layers are paler, nearer the haze.
- "ground": {"kind": one of ${GROUND_KINDS.join(', ')}; "far" and "near" colours; "shine" 0 to 1, how much it reflects (still water about 0.3); "shadow", the colour of shadows on it}.
- "haze": {"color", "amount" 0 to 1}: the air along the horizon.
- "air": {"kind": one of ${AIR_KINDS.join(', ')}; "color"; "amount" 0 to 1}.
- "things": how what they drew stands there: {"style": "light" (what they drew glowing as light, as they drew it into their world: right for most places, at dusk and at night) or "ink" (their lines standing in the place as solid shapes, with shadows: only for a place in full daylight)}.

Colours as "#rrggbb". Make the colours of the sky, the far layers, the ground and the haze belong together, as one painter's palette, mixed as an ink painter mixes them: ink greys, mist, a warm moonlit white, earth, indigo and a little gold; never candy-bright or saturated unless they asked. Light enough near the ground that black ink stands out clearly against it, unless the things are light: then the ground, the haze and the low sky stay deep enough (dusky, never cream or white) that their glow stands out.

Reply with JSON only, nothing else.`;

// for a child, said to the Set Designer as well
const YOUNG = 'They are a child. Make it a place a child would love to be in: warm and gently lit, never gloomy or frightening, and still a painting, never a cartoon.';

const LIMITS = { nights: 6, lines: 8, things: 24, text: 300 };
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// What the TV sends: the brief (engine sceneBrief), bounded (it is shown to the model as data)
export function checkSceneBody(body) {
  if (!body || typeof body !== 'object' || !body.brief || typeof body.brief !== 'object') throw new BadRequest('expected { brief, young }');
  const b = body.brief;
  const nights = (Array.isArray(b.nights) ? b.nights : []).slice(-LIMITS.nights).map((n) => {
    const said = (Array.isArray(n && n.said) ? n.said : []).slice(0, 6).map((l) => clean(l, 200)).filter(Boolean);
    return {
      n: Math.max(0, Math.round(Number(n && n.n) || 0)), title: clean(n && n.title, 80) || null,
      story: (Array.isArray(n && n.story) ? n.story : []).slice(0, LIMITS.lines).map((l) => clean(l, LIMITS.text)).filter(Boolean),
      ...(said.length ? { said } : {}),
    };
  });
  const things = (Array.isArray(b.things) ? b.things : []).slice(0, LIMITS.things).map((t) => ({
    name: clean(t && t.name, 60), kind: clean(t && t.kind, 16) || null, look: clean(t && t.look, 160) || null,
    facts: (Array.isArray(t && t.facts) ? t.facts : []).slice(0, 3).map((f) => clean(f, 200)).filter(Boolean),
  })).filter((t) => t.name);
  if (!nights.length && !things.length) throw new BadRequest('there is nothing in the world yet to design a place for');
  const look = clean(b.look, 300) || null;
  return { brief: { world: clean(b.world, 60) || null, ...(look ? { look } : {}), nights, things }, young: body.young === true };
}

export function sceneRequest(brief, { model, young = false } = {}) {
  return {
    model, max_tokens: 1400,
    system: young ? `${SCENE_SYSTEM}\n\n${YOUNG}` : SCENE_SYSTEM,
    messages: [{ role: 'user', content: `THEIR WORLD\n${JSON.stringify(brief)}\n\nDesign the place it stands in.` }],
  };
}

const textOf = (res) => (res && Array.isArray(res.content) ? res.content.filter((b) => b.type === 'text').map((b) => b.text).join('') : '');
const jsonOf = (text) => { const m = /\{[\s\S]*\}/.exec(String(text || '')); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };

// Returns { status, json: { scene } }: the place, as the TV draws it; or 502 if none could be drawn
export async function scenery(body, { claude, model, log = () => {} }) {
  const { brief, young } = checkSceneBody(body);
  const params = sceneRequest(brief, { model, young });
  let scene = checkScene(jsonOf(textOf(await claude.messages.create(params))));
  if (!scene) {
    log('the Set Designer, sent back: not a scene the TV can draw');
    scene = checkScene(jsonOf(textOf(await claude.messages.create({ ...params, messages: [{ role: 'user', content: `${params.messages[0].content}\n\n(An earlier answer couldn't be drawn: it needs "sky" with "top" and "bottom", and "ground" with "far" and "near", as #rrggbb colours.)` }] }))));
  }
  return scene ? { status: 200, json: { scene } } : { status: 502, json: { error: 'the Set Designer had no place for it' } };
}

// The stand-in, for the dev server and the tests: a meadow on a clear morning, in the look they
// asked for if they did
export function standInScene(params = null) {
  let asked = null;
  try { asked = JSON.parse(params.messages[0].content.split('\n').slice(1).join('\n').split('\n\nDesign the place')[0]).look || null; } catch { asked = null; }
  return { content: [{ type: 'text', text: JSON.stringify({
    place: 'A wide meadow on a clear morning.', look: asked || 'A soft ink-wash painting, warm and quiet',
    looks: ['A misty ink landscape', 'A moonlit ink-wash night', 'A golden evening in oils'], roof: false,
    sky: { top: '#4f9fe8', middle: '#94c9f0', bottom: '#fbe9cf', stars: 0, clouds: 0.5, cloud: '#ffffff', cloudShade: '#c9dbf0' },
    light: { kind: 'sun', x: 0.78, y: 0.18, color: '#fff3d4', glow: 0.7 },
    far: [{ shape: 'hills', color: '#9cc7d6', height: 0.12 }, { shape: 'trees', color: '#5c9a63', height: 0.08 }],
    ground: { kind: 'grass', far: '#8acb6c', near: '#3f9a47', shine: 0, shadow: '#1f4f26' },
    haze: { color: '#fbe9cf', amount: 0.4 }, air: { kind: 'motes', color: '#fff6c8', amount: 0.4 },
    things: { style: 'ink' },
  }) }], stop_reason: 'end_turn' };
}

export { sceneBrief };

// ---------------------------------------------------------------- the place, painted

// When its scene is written, Amazon Nova Canvas paints the place itself: in the scene's look, held
// to the edges of the TV's own drawing of it (its horizon where the things stand, its skyline, its
// sun), with nothing in the foreground for their things to stand in. Counted with the day's
// pictures. The TV keeps its drawing until the picture comes, and if none does.
export const BACKDROP = { model: REAL.model, width: 1536, height: 864, quality: 'standard', strength: 0.5, cfg: 7, text: 1024, most: 5_400_000 };
const NOT = 'people, person, figure, character, animal, creature, crowd, text, letters, words, watermark, logo, signature, frame, border, blurry, low resolution, distorted';
const GENTLE = 'Gentle, warm and safe, for a young child.';
const NOT_FOR_A_CHILD = 'scary, dark, gloomy, monster, weapon, blood';

export function checkBackdrop(body) {
  if (!body || typeof body !== 'object') throw new BadRequest('expected { scene, image, young, seed }');
  const scene = checkScene(body.scene);
  if (!scene) throw new BadRequest('scene must be one the TV can draw');
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
  if (!m) throw new BadRequest('image must be the drawn scene, as a JPEG or PNG data URL');
  if (m[2].length > 2_500_000) throw new BadRequest('image is too large');
  return { scene, image: m[2], young: body.young === true, seed: Math.max(0, Math.min(858993459, Math.round(Number(body.seed) || 0))) };
}

export function backdropRequest({ scene, image, young = false, seed = 0 }) {
  const look = scene.look || (scene.things.style === 'light' ? 'a luminous painted scene' : 'a bright painted world, soft warm light');
  const text = [`${look.replace(/[.\s]+$/, '')}.`, scene.place, 'A wide view across the place itself, from where someone stands at its edge: the horizon across the middle, open empty ground in front, the far distance richly detailed.', young ? GENTLE : ''].filter(Boolean).join(' ');
  return {
    taskType: 'TEXT_IMAGE',
    textToImageParams: {
      text: text.slice(0, BACKDROP.text),
      negativeText: young ? `${NOT}, ${NOT_FOR_A_CHILD}` : NOT,
      conditionImage: image,
      controlMode: 'CANNY_EDGE',
      controlStrength: BACKDROP.strength,
    },
    imageGenerationConfig: { numberOfImages: 1, width: BACKDROP.width, height: BACKDROP.height, quality: BACKDROP.quality, cfgScale: BACKDROP.cfg, seed },
  };
}

const isBlocked = (err) => /content filter|blocked|responsible ai|moderat/i.test(String((err && err.message) || ''));

// Returns { status, json }: { image } (a data URL); or { off: true } when no pictures are made here
// (none set up, none left today, or one too big to send); or { blocked: true }
export async function backdrop(body, { paint = null, budget = null, log = () => {} }) {
  const b = checkBackdrop(body);
  if (!paint) return { status: 200, json: { off: true } };
  if (budget && !(await budget.take())) { log('the place, painted: no pictures left today'); return { status: 200, json: { off: true, today: true } }; }
  try {
    const out = String(await paint(backdropRequest(b)) || '');
    if (!/^[A-Za-z0-9+/=]{100,}$/.test(out)) throw new Error('no picture came back');
    if (out.length > BACKDROP.most) { log(`the place, painted: too big to send (${out.length})`); return { status: 200, json: { off: true, big: true } }; }
    return { status: 200, json: { image: `data:image/${out.startsWith('/9j/') ? 'jpeg' : 'png'};base64,${out}` } };
  } catch (err) {
    if (!isBlocked(err)) throw err;
    log(`the place, painted: turned down by the image model's filter (${String(err.message).slice(0, 120)})`);
    return { status: 200, json: { blocked: true } };
  }
}
