// The guide service's core: what it asks Claude about a painting, how it reads the answer, and
// how it answers the TV. No AWS here: the model, the voice and the stores are passed in, so the
// tests run with stand-ins and lambda.mjs plugs in Claude on Amazon Bedrock, Amazon Polly and
// DynamoDB.
//
//   POST /remark    { image, strokes, said, words?, known?, phone? }  ->  { say, audio? }
//   POST /readings  { image, strokes, n, avoid? }  ->  { readings: [three things mark n could be] }
//   POST /tell      { image, strokes, feeling?, pinned?, words?, world?, felt?, session?, seed? }
//                   ->  { title, lines: [{ text, box, strokes, v, a, audio? }], shape, says,
//                         followed, diff, felt, feltFrom, marks }
//   and their words by phone (phone.mjs): the TV pairs (/pair), the phone opens /phone?c=CODE
//   and sends what they say (/words), the TV collects it (/heard) and sends the guide's
//   questions back the same way, which the phone shows (/asked).
//   POST /agent     { messages, young?, lit? }  ->  { content, stop_reason, model, usage }
//   POST /speak     { text, rate?, volume?, pause? }  ->  { audio }
//   POST /wonder    { brief, young? }  ->  { about, name, question, choices }: the Worldbuilder
//                   (worldbuilder.mjs) asks one question about their world
//   POST /real      { image, brief, young?, look?, seed? }  ->  { image, scene, looks }: the
//                   Illustrator (illustrator.mjs) makes a told painting real
//   POST /wide      { image, mask, scene?, look?, young?, seed? }  ->  { image }: all around it
//                   (wide.mjs), the picture made real widened to either side by Nova Canvas
//   POST /alive     { image, scene?, young?, seed? }  ->  { job }: it comes alive (reel.mjs), six
//                   seconds of the picture made real, set moving by Amazon Nova Reel; and
//   POST /alive/check { job }  ->  { waiting } | { video }: looked in on until it is made
//   POST /world     { image, scene?, name?, young? }  ->  { job }: walk inside (marble.mjs), the
//                   picture made real built into a world by World Labs; then
//   POST /world/check { job }  ->  { waiting } | { world }, and POST /world/file { id, splat }
//                   ->  { file, type }: its lighter file, to walk through
//   The guide as an agent (agent.mjs): how the TV tells a dream now. The loop runs on the TV,
//   which carries out the guide's tools; /agent carries each turn to Claude and back. /tell below
//   is the earlier pipeline, kept for the evals.
//
// The telling is their dream, told back from what only they can give:
// - their feeling line (`feeling`): how each stroke felt as their painting came back, lighter (+1)
//   to heavier (-1) in `byStroke`, calm (-1) to stirred (+1) in `arousal`, marked with the remote
//   (the TV's feel.js); without one, their one word (`felt`), or softly the marks, hold it level;
// - their answer at the turn (`pinned`): what that mark was (`said`; null, a mystery), the thing
//   from their world it was (`entity`), and why it felt that way (`why`);
// - their own words (`words`): what they told the guide on their phone as they painted, each with
//   the stroke they were painting (`n`);
// - their dream world (`world`): the slice the TV's engine compiled for tonight (dreams/world.mjs):
//   what may be in tonight's dream and how it felt to them, how things stand, what is unresolved,
//   their last nights, what their reactions have taught. The world is kept on the TV; this slice
//   is all that comes, and nothing of it is kept here.
// The telling is cut into parts where their feeling changed, and written part by part from their
// words and their world. Then it is checked three ways: a reader who doesn't know the line rates
// each line (does it follow their line?); their key words are looked for (was it made from what
// they said?); and an archivist reads it against their world (does it go against it?). If it
// fails any, it is rewritten once, with what to change, and the better kept. The archivist also
// proposes what tonight adds to their world (`diff`): the TV keeps what the person keeps, by their
// reactions as the dream is told. Each line is voiced slower and softer where it was heavier,
// quicker where stirred. Around it, the commons: what everyone's tellings use, counts only.
//
// `image` is the painting, a JPEG (or PNG) data URL; `strokes` is the TV's summary of each stroke
// (brush.js summarize()); `said` is what the guide said lately. Boxes are [x0, y0, x1, y1] in
// paper units: the sheet is 1600 wide and 1000 tall, y down.
import {
  FEELING_WORDS, target, readMarks, describeMarks, tellingMotifs,
  readLine, compileBeats, shapeOf, arcBrief, checkTelling, voiceOf, ssml,
} from './engine/personal/index.mjs';
import {
  KINDS, WHY, checkDiff, knownLesson, attachTonight, worldBrief, wordsBrief, wordsUsed, retellNote, needsRetelling, tellingScore,
} from './engine/dreams/index.mjs';
import { memoryCommons } from './commons-store.mjs';
import { memorySessions, CODE } from './phone.mjs';
import { checkConversation, agentRequest, agentReply, withoutThinking, speakRequest, BadConversation, LIGHT } from './agent.mjs';
import { wonder } from './worldbuilder.mjs';
import { REEL, alive, aliveCheck } from './reel.mjs';
import { world, worldCheck, worldFile } from './marble.mjs';
import { BadRequest } from './errors.mjs';
import { real, thing } from './illustrator.mjs';
import { wide } from './wide.mjs';
import { scenery, backdrop, compose } from './scenery.mjs';

export const MODELS = {
  // a remark has to come back while the painter is still pausing: the fast model. It also offers
  // the readings at the turn, reads the telling back blind, and keeps the record.
  remark: 'anthropic.claude-haiku-4-5',
  // the telling is the moment the painter waits for: the most capable model
  tell: 'anthropic.claude-opus-5-5',
  // the Worldbuilder's question, asked while they look at their world: the fast model
  world: 'anthropic.claude-haiku-4-5',
  // the Illustrator, which writes the scene a told painting is made real from: the fast model
  illustrate: 'anthropic.claude-haiku-4-5',
  // the Set Designer, which writes where a world stands when its story starts: the fast model
  scene: 'anthropic.claude-haiku-4-5',
};

const PAPER = { W: 1600, H: 1000 };
const LIMITS = { image: 1_500_000, strokes: 200, said: 12, line: 240, words: 40, word: 300 };

const VOICE_RULES = `Everything you write is read aloud on a television by a calm voice, and shown as a subtitle, so: plain sentences only, no lists, no emoji, no quotation marks, no stage directions, nothing in brackets.`;

export const REMARK_SYSTEM = `You are the storyteller in Inkwash, a Fire TV app where someone paints a world of their own, a piece at a time (a story they are writing, a place they imagine, a dream they had), with their TV remote as an ink brush, on rice paper, in black ink and grey washes. You are a warm, quiet ink-painting teacher who loves the worlds people carry in their heads.

You see their painting so far, and a list of their strokes in the order they were painted. Say one short thing: at most 22 words.

Read the marks generously and with wonder. Wonder aloud what they might be in their world (a shore? someone climbing?), or ask one question about it, or suggest one small thing to paint next. Never judge the painting, never explain brush technique (the app already does that), and never repeat something you have already said.

If they are talking to you on their phone as they paint (you will see what they said), you are gently interviewing them about their world: ask one short question that helps them say more about what they are painting now, or about what they haven't said yet: what it is, who is there, where it is, what happens next. Never ask what it meant or how they felt.

If a mark looks like something from their world before (you will be told), you may ask whether it is that, by its name: is that the stopped clock again?

Say it to them, as you would to someone beside you: never talk about them, never say what you are going to ask or do, and never call them the user.

${VOICE_RULES}

Reply with JSON only, nothing before or after it: {"say": "..."}`;

// The telling without a feeling line or a world: the app before "Feel it again". Kept as the
// eval's baseline (today's prompt).
export const TELL_SYSTEM = `You are the storyteller in Inkwash, a Fire TV app where someone paints a dream with their TV remote as an ink brush, on rice paper. They have finished, and asked you to tell their dream back to them.

Look at the painting, and at the strokes in the order they were painted: the order is the order of the dream. Tell it as a short story in 3 to 6 lines. Each line is one or two short sentences, under 28 words, as if remembering a dream: concrete, strange, gentle. Build on what the marks could be; where a mark could be many things, choose one and commit to it. Each line is about one part of the painting: give that part's box [x0, y0, x1, y1] in paper units (the sheet is 1600 wide and 1000 tall, x to the right, y down), taken from the strokes' boxes. Give the dream a title of 2 to 5 words.

${VOICE_RULES}

Reply with JSON only, nothing before or after it: {"title": "...", "lines": [{"text": "...", "box": [x0, y0, x1, y1]}]}`;

// The telling: the parts, how each should feel, their words and their world come in the brief
// (arcBrief, wordsBrief, worldBrief); the boxes come from the parts, so the writer gives only words.
export const ARC_SYSTEM = `You are the storyteller in Inkwash, a Fire TV app where someone paints a world of their own, a piece at a time (a story they are writing, a place they imagine, a dream they had), with their TV remote as an ink brush, on rice paper. They have finished, watched their painting come back stroke by stroke, and marked how each part of it felt. Now tell it back to them as a story: theirs, from their words, along their feeling.

Write exactly the lines you are asked for: one line for each part, in order. Each line is one or two short sentences, under 28 words, seen as if you were there: concrete, strange, gentle.

What they said comes first. Where they said what something was, who was there or what happened, build the line from their words and images, and use their nouns as they said them; add only what the marks and the story need, and no meaning they didn't give. Where they said nothing, build on what the marks could be, and where a mark could be many things, choose one and commit to it.

If things from their world before are in tonight's painting, they are the same things: call them by their names, and keep them as they were, unless tonight's story changes them.

Never name the feeling (not sad, heavy, light, happy, afraid, calm, anxious): let the images, what happens, and the rhythm of the sentence carry it. Never explain what it meant. Give the story a title of 2 to 5 words.

${VOICE_RULES}

Reply with JSON only, nothing before or after it: {"title": "...", "lines": ["...", "..."]}`;

// The reader: it rates each line by itself, and never sees the line it is checked against.
export const READ_SYSTEM = `You will read the lines of a short story, in order. Rate how each line feels to read, by itself, from its words, images and rhythm, on two scales.

weight: -2 very heavy (dark, sad or frightening), -1 heavier, 0 even, 1 lighter, 2 very light (bright, warm or glad).
stir: -2 very calm (still, slow, settled), -1 calm, 0 neither, 1 stirred, 2 very stirred (urgent, quick, tense or thrilling).

Reply with JSON only, nothing before or after it: {"weight": [one number per line], "stir": [one number per line]}`;

// What the mark at the turn could be, for them to choose from.
export const READINGS_SYSTEM = `You are the storyteller in Inkwash, a Fire TV app where someone paints a world of their own, a piece at a time, with their TV remote as an ink brush. They have painted part of it and watched it come back, marking how it felt, and their feeling turned at one mark. Offer three different things that mark could be in their world, for them to choose from with the remote.

Each reading is 1 to 4 words, concrete, lowercase, with "a" or "the" as fits: "a locked gate", "the night ferry". The first may be the plainest reading of the mark's shape; the other two less expected, and each a different kind of thing (an object, a place or creature, a person or a presence). Never a feeling.

Reply with JSON only, nothing before or after it: {"readings": ["...", "...", "..."]}`;

// The archivist: what tonight's telling adds to their world, and where it goes against it. It
// reads the words only.
export const EXTRACT_SYSTEM = `You keep the record of one person's world: the people, places, things, creatures and presences in the stories told of what they paint with Inkwash, and what happened, night after night. Read tonight's telling and say what it adds to their world.

entities: what the telling makes really present in their world (named, or seen and acted on), at most 6; never the paper, the ink, the marks or the feeling. Each is either a thing already in their world, by its id: {"id": "e3", "lines": [2]}, or a new one: {"new": "the night ferry", "kind": "thing", "aliases": ["ferry"], "lines": [1, 3]}. Kind is one of person, place, thing, creature, presence. Name a new one as they named it, if they did, or else as the telling does: short, with "the", "a" or "my" ("the stopped clock", "my brother"). A thing already in their world is the same thing whenever the telling means it, even by another word. "lines" are the numbers of the lines it is in.

facts: what tonight's telling says happened or is true, at most 6, each one short plain sentence about one entity ("about": its id, or a new one's name), in the past tense, with no feeling words, and the number of the line it comes from. "open": true when it leaves something unresolved that a later painting could return to (a door not opened, someone not reached, a question not answered).

resolved: an unresolved thread from earlier nights that tonight's telling settles, by its id, with the line that settles it.

conflicts: a line that goes against how things stand in their world. Not a change that happens in tonight's story, but a thing told wrong: called new when it has come before, given a past it did not have, made into something else without the story changing it. Only clear ones, each with its line and why, in one short sentence.

Reply with JSON only, nothing before or after it: {"entities": [...], "facts": [...], "resolved": [...], "conflicts": [{"line": 2, "why": "..."}]}`;

// ---------------------------------------------------------------- what the TV sends

export { BadRequest } from './errors.mjs';

// plain text from the TV or the phone: no markup, braces or quotes, one line, bounded
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>{}[\]"`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const int = (x, lo, hi) => { const n = Math.round(Number(x)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null; };

export function checkSeen(body, { needSaid = false } = {}) {
  if (!body || typeof body !== 'object') throw new BadRequest('expected a JSON object');
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
  if (!m) throw new BadRequest('image must be a JPEG or PNG data URL');
  if (m[2].length > LIMITS.image) throw new BadRequest('image is too large');
  if (!Array.isArray(body.strokes) || body.strokes.length > LIMITS.strokes) throw new BadRequest(`strokes must be a list of at most ${LIMITS.strokes}`);
  if (!body.strokes.every((s) => s && typeof s === 'object')) throw new BadRequest('each stroke must be an object');
  const strokes = body.strokes.map((s) => ({
    n: Number(s.n) || 0,
    ink: ['dense', 'light', 'water', 'indigo', 'gold', 'cinnabar'].includes(s.ink) ? s.ink : 'dense',
    from: nums(s.from, 2), to: nums(s.to, 2), box: nums(s.box, 4),
    length: Number(s.length) || 0, pressure: Number(s.pressure) || 0, turn: Number(s.turn) || 0,
    pools: Array.isArray(s.pools) ? s.pools.slice(0, 8).map((p) => nums(p, 2)) : [],
    // how it was painted, when the TV knows: the stroke's time, the wait before it, time held still
    ...(s.ms != null ? { ms: Math.max(0, Number(s.ms) || 0), gap: Math.max(0, Number(s.gap) || 0), still: Math.max(0, Number(s.still) || 0) } : {}),
  }));
  const isStroke = (n) => n != null && strokes.some((s) => s.n === Number(n));
  const said = Array.isArray(body.said) ? body.said.slice(-LIMITS.said).map((x) => String(x).slice(0, 300)) : [];
  if (needSaid && !Array.isArray(body.said)) throw new BadRequest('said must be a list');
  if (body.felt != null && !FEELING_WORDS.includes(body.felt)) throw new BadRequest(`felt must be one of ${FEELING_WORDS.join(', ')}`);
  const session = body.session && typeof body.session === 'object'
    ? { washes: Math.max(0, Number(body.session.washes) || 0), inks: Math.max(0, Number(body.session.inks) || 0), seconds: Math.max(0, Number(body.session.seconds) || 0) } : {};
  const seed = String(body.seed || m[2].slice(-64)).slice(0, 64);
  // the feeling line, marked as the painting came back: one value per stroke, -1 to 1, in each
  // dimension (arousal may be left out)
  let feeling = null;
  if (body.feeling != null) {
    const f = body.feeling;
    if (!f || !Array.isArray(f.byStroke) || f.byStroke.length !== strokes.length) throw new BadRequest('feeling.byStroke must have one value for each stroke');
    if (f.arousal != null && (!Array.isArray(f.arousal) || f.arousal.length !== strokes.length)) throw new BadRequest('feeling.arousal must have one value for each stroke');
    const unit = (x) => Math.max(-1, Math.min(1, Number(x) || 0));
    feeling = { byStroke: f.byStroke.map(unit), arousal: (f.arousal || []).map(unit), line: Array.isArray(f.line) ? f.line.slice(0, LIMITS.line).map(unit) : [], moved: !!f.moved };
  }
  let pinned = null;
  if (body.pinned != null) {
    const n = Number(body.pinned && body.pinned.n);
    if (!isStroke(n)) throw new BadRequest('pinned.n must be one of the strokes');
    const p = body.pinned;
    pinned = {
      n, said: p.said == null ? null : clean(p.said, 60) || null,
      why: WHY.some((w) => w.id === p.why) ? p.why : null,
      entity: typeof p.entity === 'string' && /^e\d{1,6}$/.test(p.entity) ? p.entity : null,
    };
  }
  // what they said on their phone, with the stroke they were painting (or null: before, or about
  // the whole dream)
  const words = Array.isArray(body.words) ? body.words.slice(-LIMITS.words)
    .map((w) => (w && typeof w === 'object' ? { n: isStroke(w.n) ? Number(w.n) : null, text: clean(w.text, LIMITS.word) } : null))
    .filter((w) => w && w.text) : [];
  return { media: `image/${m[1]}`, data: m[2], strokes, said, felt: body.felt ?? null, feeling, pinned, words, world: checkWorld(body.world, isStroke), session, seed, lit: body.lit === true };
}
const nums = (a, n) => (Array.isArray(a) ? a.slice(0, n).map((v) => Math.round(Number(v) || 0)) : new Array(n).fill(0));

// The slice of their world the TV sends (dreams/world.mjs slice, with what it recognised tonight:
// a thing's `n`, the mark like it, and `said`, whether their words named it). Bounded; only the
// harness's own lessons pass.
export function checkWorld(w, isStroke = () => false) {
  if (w == null) return null;
  if (typeof w !== 'object' || Array.isArray(w)) throw new BadRequest('world must be an object');
  const list = (x, n) => (Array.isArray(x) ? x.slice(0, n) : []);
  const id = (x, p) => (typeof x === 'string' && new RegExp(`^${p}\\d{1,6}$`).test(x) ? x : null);
  const things = list(w.things, 12).map((t) => (t && typeof t === 'object' ? {
    id: id(t.id, 'e'), name: clean(t.name, 40), kind: KINDS.includes(t.kind) ? t.kind : 'thing',
    nights: int(t.nights, 0, 9999) || 0, first: int(t.first, 1, 99999), own: !!t.own, felt: t.felt ? clean(t.felt, 240) || null : null,
    n: isStroke(t.n) ? Number(t.n) : null, said: !!t.said,
  } : null)).filter((t) => t && t.id && t.name);
  return {
    night: int(w.night, 1, 99999) || 1,
    things,
    facts: list(w.facts, 12).map((f) => clean(f, 200)).filter(Boolean),
    threads: list(w.threads, 4).map((t) => (t && typeof t === 'object' ? { id: id(t.id, 'f'), text: clean(t.text, 200) } : null)).filter((t) => t && t.id && t.text),
    recent: list(w.recent, 3).map((r) => (r && typeof r === 'object' ? { night: int(r.night, 1, 99999), title: clean(r.title, 60), shape: /^[a-z-]{2,12}$/.test(r.shape) ? r.shape : null } : null)).filter((r) => r && r.night),
    learned: list(w.learned, 6).map(knownLesson).filter(Boolean),
    avoid: list(w.avoid, 12).map((a) => clean(a, 40)).filter(Boolean),
  };
}

// ---------------------------------------------------------------- what Claude is asked

// the system prompt, and when it is drawn into their world as light, what that means (agent.mjs LIGHT)
const systemFor = (system, seen) => (seen.lit ? `${system}\n\n${LIGHT}` : system);
function picture(seen, text) {
  return [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: seen.media, data: seen.data } },
      { type: 'text', text },
    ],
  }];
}
const strokesText = (seen) => `The strokes, in the order they were painted (paper units, 1600 wide by 1000 tall, y down):\n${JSON.stringify(seen.strokes)}`;
const q = (t) => `"${t}"`;

// `known`: marks that look like things from their world, [{ n, name, nights }]; `phone`: whether
// they are talking to the guide on their phone.
export function remarkRequest(seen, model = MODELS.remark, { known = [], phone = false } = {}) {
  const said = seen.said.length ? seen.said.map((s) => `- ${s}`).join('\n') : '(nothing yet)';
  const out = [`The strokes so far, in order (paper units, 1600 wide by 1000 tall, y down):\n${JSON.stringify(seen.strokes)}`, `What you have already said:\n${said}`];
  if (phone || seen.words.length) {
    out.push(seen.words.length
      ? `They are talking to you on their phone. What they have said so far, and the mark they were painting:\n${seen.words.map((w) => `- ${w.n != null ? `mark ${w.n}` : 'before painting'}: ${q(w.text)}`).join('\n')}`
      : 'Their phone is ready, if they want to talk to you about it. Nothing has come from it yet.');
  }
  if (known.length) out.push(`Marks that look like things from their earlier dreams:\n${known.map((k) => `- mark ${k.n}: ${k.name} (${k.nights === 1 ? 'one earlier night' : `${k.nights} earlier nights`})`).join('\n')}`);
  return { model, max_tokens: 200, system: systemFor(REMARK_SYSTEM, seen), messages: picture(seen, out.join('\n\n')) };
}

// Claude Opus 5.5 always thinks before it answers; low effort keeps the wait short, and the
// token budget leaves room for the thinking as well as the telling. Haiku 4.5 (the fallback)
// doesn't think unless asked, and takes no effort setting.
// The baseline telling, from the painting alone (and, for the eval, an extra brief).
export function tellRequest(seen, model = MODELS.tell, brief = null) {
  const thinks = !/haiku/.test(model);
  const personal = brief ? `\n\nFor this telling (from the person, and from what other people's dreams have been): \n${brief}` : '';
  return {
    model,
    max_tokens: thinks ? 6000 : 1200,
    ...(thinks ? { output_config: { effort: 'low' } } : {}),
    system: systemFor(TELL_SYSTEM, seen),
    messages: picture(seen, `${strokesText(seen)}${personal}`),
  };
}

// The telling, part by part. `brief` is arcBrief, wordsBrief and worldBrief together.
export function arcRequest(seen, model = MODELS.tell, brief = '') {
  const thinks = !/haiku/.test(model);
  return {
    model,
    max_tokens: thinks ? 6000 : 1200,
    ...(thinks ? { output_config: { effort: 'low' } } : {}),
    system: systemFor(ARC_SYSTEM, seen),
    messages: picture(seen, `${strokesText(seen)}\n\n${brief}`),
  };
}

// the reader gets the lines only: no painting, no line, no brief
export function readRequest(lines, model = MODELS.remark) {
  return { model, max_tokens: 300, system: READ_SYSTEM, messages: [{ role: 'user', content: lines.map((l, i) => `${i + 1}. ${l}`).join('\n') }] };
}

export function readingsRequest(seen, stroke, model = MODELS.remark, cliches = [], avoid = []) {
  const crowd = cliches.length ? `\n\nMany people's dreams lately are full of: ${cliches.join(', ')}. Offer one of these only if the mark plainly is it.` : '';
  const no = avoid.length ? `\n\nThey have turned these down in earlier dreams; never offer them: ${avoid.join(', ')}.` : '';
  return {
    model,
    max_tokens: 200,
    system: systemFor(READINGS_SYSTEM, seen),
    messages: picture(seen, `${strokesText(seen)}\n\nTheir feeling turned at mark ${stroke.n} (box ${JSON.stringify(stroke.box)}). What could it be?${crowd}${no}`),
  };
}

// The archivist reads the telling, their world as it stood, and what they said: words only.
export function extractRequest(told, { world = null, words = [], beats = [] } = {}, model = MODELS.remark) {
  const night = world ? world.night : 1;
  const out = [`Tonight's telling (night ${night}), ${q(told.title)}, line by line:`, ...told.lines.map((l, i) => `${i + 1}. ${l}`)];
  if (world && world.things.length) out.push('', 'What of their world was in play tonight (id: name, kind):', ...world.things.map((t) => `${t.id}: ${t.name} (${t.kind})`));
  if (world && world.facts.length) out.push('', 'How things stood before tonight:', ...world.facts.map((f) => `- ${f}`));
  if (world && world.threads.length) out.push('', 'Unresolved threads from earlier nights (id: text):', ...world.threads.map((t) => `${t.id}: ${t.text}`));
  if (!world || (!world.things.length && !world.facts.length && !world.threads.length)) out.push('', night > 1 ? 'Nothing from their earlier dreams was in play tonight.' : 'This is the first night of their dream world: everything in it is new.');
  if (words.length) {
    const partOf = (n) => beats.findIndex((b) => !b.whole && b.strokes.includes(n));
    out.push('', 'What they said themselves as they painted (name things as they did):', ...words.map((w) => { const i = partOf(w.n); return `- ${i >= 0 ? `(line ${i + 1}) ` : ''}${q(w.text)}`; }));
  }
  const named = beats.findIndex((b) => !b.whole && b.named && b.said);
  if (named >= 0) out.push('', `At line ${named + 1}, they said the mark there was ${beats[named].said}${beats[named].entity ? ` (${beats[named].entity})` : ''}.`);
  return { model, max_tokens: 1500, system: EXTRACT_SYSTEM, messages: [{ role: 'user', content: out.join('\n') }] };
}

// ---------------------------------------------------------------- reading the answer

// The first JSON object in a reply, tolerating a code fence or a stray sentence around it.
export function jsonIn(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

// what's fit to be read aloud: no brackets, quotes or asterisks, one line, not too long
function spoken(text, max) {
  const t = String(text || '').replace(/[*_#`"“”]/g, '').replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

function clampBox(b) {
  if (!Array.isArray(b) || b.length !== 4 || b.some((v) => !Number.isFinite(Number(v)))) return null;
  let [x0, y0, x1, y1] = b.map(Number);
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  x0 = Math.max(0, Math.min(PAPER.W, x0)); x1 = Math.max(0, Math.min(PAPER.W, x1));
  y0 = Math.max(0, Math.min(PAPER.H, y0)); y1 = Math.max(0, Math.min(PAPER.H, y1));
  return x1 - x0 < 2 || y1 - y0 < 2 ? null : [x0, y0, x1, y1].map(Math.round);
}

// A note the model wrote to itself rather than to them ("The user hasn't spoken yet. Ask what
// the room is like") is never said: those sentences go, and a remark with nothing else in it isn't one.
const SELF_TALK = /\b(the user|user's|the painter|the person)\b|^(ask|say|tell them|wonder aloud|suggest)\b/i;
export function aloud(text) {
  return String(text || '').split(/(?<=[.?!])\s+/).filter((s) => s && !SELF_TALK.test(s.trim())).join(' ');
}

export function parseRemark(text) {
  const j = jsonIn(text);
  const say = spoken(aloud(j && typeof j.say === 'string' ? j.say : ''), 200);
  return say ? { say } : null;
}

export function parseTell(text) {
  const j = jsonIn(text);
  if (!j || !Array.isArray(j.lines)) return null;
  const lines = j.lines
    .map((l) => ({ text: spoken(l && l.text, 220), box: clampBox(l && l.box) }))
    .filter((l) => l.text)
    .slice(0, 6);
  if (!lines.length) return null;
  return { title: spoken(j.title, 60) || 'A dream', lines };
}

// a telling along the line: exactly `n` lines of words
export function parseArc(text, n) {
  const j = jsonIn(text);
  if (!j || !Array.isArray(j.lines)) return null;
  const lines = j.lines.map((l) => spoken(typeof l === 'string' ? l : l && l.text, 220)).filter(Boolean);
  if (lines.length < n) return null;
  return { title: spoken(j.title, 60) || 'A dream', lines: lines.slice(0, n) };
}

// the reader's ratings, -2 to 2 for each of `n` lines: weight (needed) and stir (if it gave them)
export function parseRead(text, n) {
  const j = jsonIn(text);
  if (!j) return null;
  const ratings = (a) => (Array.isArray(a) && a.length === n && a.every((x) => Number.isFinite(Number(x)) && Number(x) >= -2 && Number(x) <= 2) ? a.map(Number) : null);
  const weight = ratings(j.weight ?? j.lines);
  return weight ? { weight, stir: ratings(j.stir) } : null;
}

export function parseReadings(text) {
  const j = jsonIn(text);
  if (!j || !Array.isArray(j.readings)) return null;
  const rs = [...new Set(j.readings.map((x) => spoken(x, 40).toLowerCase().replace(/[.!?]+$/, '')).filter(Boolean))].slice(0, 3);
  return rs.length ? rs : null;
}

// The archivist's answer, made safe to send to the TV: line numbers from 1 become indexes from
// 0; only things in tonight's slice by id; only its open threads resolved (dreams checkDiff).
// Conflicts count only where there was a world to go against.
export function parseExtract(text, { lines = 0, world = null } = {}) {
  const j = jsonIn(text);
  if (!j) return null;
  const at = (x) => (Number.isInteger(Number(x)) ? Number(x) - 1 : null);
  const each = (xs, f) => (Array.isArray(xs) ? xs.map((x) => (x && typeof x === 'object' ? f(x) : x)) : []);
  const diff = checkDiff({
    entities: each(j.entities, (e) => ({ ...e, lines: Array.isArray(e.lines) ? e.lines.map(at) : [] })),
    facts: each(j.facts, (f) => ({ ...f, line: at(f.line) })),
    resolved: each(j.resolved, (r) => ({ ...r, line: at(r.line) })),
  }, { lines, ids: new Set((world?.things || []).map((t) => t.id)), open: new Set((world?.threads || []).map((t) => t.id)) });
  const hadWorld = !!world && (world.things.length || world.facts.length || world.threads.length);
  const conflicts = hadWorld ? each(j.conflicts, (c) => ({ line: at(c.line), why: spoken(c.why, 160) }))
    .filter((c) => c && Number.isInteger(c.line) && c.line >= 0 && c.line < lines && c.why).slice(0, 4) : [];
  return { diff, conflicts };
}

const textOf = (message) => (message && Array.isArray(message.content) ? message.content.filter((b) => b.type === 'text').map((b) => b.text).join('') : '');
const r2 = (x) => Math.round((x || 0) * 100) / 100;

// ---------------------------------------------------------------- answering the TV

// `claude.messages.create(params)` is the Messages API (AnthropicBedrockMantle in lambda.mjs);
// `speak(text, { ssml })` returns MP3 as base64, or null; `commons` is where everyone's images are
// counted (commons-store.mjs); `sessions` is where a phone's words wait for the TV (phone.mjs).
// Returns { status, json }.
const sharedCommons = memoryCommons();
const sharedSessions = memorySessions();
export async function handle(path, body, { claude, speak = async () => null, paint = null, budget = null, reel = null, clips = null, marble = null, worlds = null, models = MODELS, log = () => {}, commons = sharedCommons, sessions = sharedSessions, effort = 'medium', cutout = true }) {
  // the most capable model may not be enabled on this AWS account yet: the fast one stands in
  const create = async (params) => {
    try {
      return await claude.messages.create(params);
    } catch (err) {
      if (err.spent || params.model !== models.tell || models.tell === models.remark) throw err;
      log(`${models.tell} failed (${err.status || err.message}); using ${models.remark}`);
      const { output_config: thinking, ...rest } = params; // Haiku 4.5 takes no effort setting
      return claude.messages.create({ ...rest, model: models.remark, max_tokens: 1200 });
    }
  };
  try {
    // their words, by phone
    if (['/pair', '/heard', '/words', '/asked'].includes(path)) return await phone(path, body || {}, sessions);
    if (path === '/remark') {
      const seen = checkSeen(body);
      const known = (Array.isArray(body.known) ? body.known.slice(0, 4) : [])
        .map((k) => (k && typeof k === 'object' ? { n: Number(k.n), name: clean(k.name, 40), nights: int(k.nights, 1, 9999) || 1 } : null))
        .filter((k) => k && k.name && seen.strokes.some((s) => s.n === k.n));
      const reply = await claude.messages.create(remarkRequest(seen, models.remark, { known, phone: !!body.phone }));
      const r = parseRemark(textOf(reply));
      if (!r) return { status: 502, json: { error: 'the guide had nothing to say' } };
      r.audio = await speak(r.say).catch(() => null);
      return { status: 200, json: r };
    }
    if (path === '/readings') {
      const seen = checkSeen(body);
      const stroke = seen.strokes.find((s) => s.n === Number(body.n));
      if (!stroke) throw new BadRequest('n must be one of the strokes');
      const avoid = (Array.isArray(body.avoid) ? body.avoid.slice(-12) : []).map((a) => clean(a, 40)).filter(Boolean);
      const everyone = await commons.load();
      const readings = parseReadings(textOf(await claude.messages.create(readingsRequest(seen, stroke, models.remark, everyone.cliches(), avoid))));
      if (!readings) return { status: 502, json: { error: 'the guide had no reading' } };
      const fresh = readings.filter((r) => !avoid.includes(r));
      return { status: 200, json: { readings: fresh.length ? fresh : readings } };
    }
    if (path === '/tell') return await tell(body, { claude, create, speak, models, log, commons });
    if (path === '/agent') {
      const messages = checkConversation(body && body.messages);
      const young = !!(body && body.young === true), lit = !!(body && body.lit === true);
      let res, used = models.tell;
      try {
        res = await claude.messages.create(agentRequest(messages, { model: models.tell, effort, young, lit }));
      } catch (err) {
        if (err.spent || models.tell === models.remark) throw err;
        // a 400 here is Claude refusing the conversation itself (an edited turn, say): worth reading
        const why = err.status === 400 ? `400: ${String(err.message || '').slice(0, 200)}` : err.status || err.message;
        log(`${models.tell} failed (${why}); the guide goes on with ${models.remark}`);
        used = models.remark;
        res = await claude.messages.create(agentRequest(withoutThinking(messages), { model: models.remark, young, lit }));
      }
      return { status: 200, json: agentReply(res, used) };
    }
    if (path === '/wonder') return await wonder(body, { claude, model: models.world || models.remark, log });
    if (path === '/real') {
      const r = await real(body, { claude, paint, budget, model: models.illustrate || models.remark, log });
      // a picture that can come alive here says so, and as what kind of video, so a TV that can't
      // play it is never offered a clip it would only pay for (reel.mjs)
      if (reel && r.json && r.json.image) r.json.alive = reel.type || REEL.type;
      // and one that can be walked into here says so too (marble.mjs)
      if (marble && r.json && r.json.image) r.json.walk = true;
      return r;
    }
    if (path === '/scene') return await scenery(body, { claude, model: models.scene || models.remark, log });
    if (path === '/backdrop') return await backdrop(body, { paint, budget, log });
    if (path === '/compose') return await compose(body, { paint, budget, log });
    if (path === '/thing') return await thing(body, { paint, budget, log, cutout });
    if (path === '/wide') return await wide(body, { paint, budget, log });
    if (path === '/alive') return await alive(body, { reel, budget: clips, log });
    if (path === '/alive/check') return await aliveCheck(body, { reel, log });
    if (path === '/world') return await world(body, { marble, budget: worlds, log });
    if (path === '/world/check') return await worldCheck(body, { marble, log });
    if (path === '/world/file') return await worldFile(body, { marble, log });
    if (path === '/speak') {
      const { text, ssml: voiced } = speakRequest(body);
      return { status: 200, json: { audio: await speak(text, { ssml: voiced }).catch(() => null) } };
    }
    return { status: 404, json: { error: 'no such call' } };
  } catch (err) {
    if (err instanceof BadRequest || err instanceof BadConversation) return { status: 400, json: { error: err.message } };
    // the day's spending is reached (limits.mjs): the TV tells offline until tomorrow
    if (err.spent) return { status: 429, json: { error: 'the guide has told enough for today', today: true } };
    log(`guide error: ${err.status || ''} ${err.message}`);
    return { status: 502, json: { error: 'the guide could not be reached' } };
  }
}

async function tell(body, { claude, create, speak, models, log, commons }) {
  const seen = checkSeen(body);
  const everyone = await commons.load();
  const marks = readMarks(seen.strokes, seen.session);
  // their line; or, if they didn't mark one, the whole telling held at their word's feeling (or,
  // softly, the marks')
  const marked = seen.feeling && seen.feeling.moved;
  let byStroke = marked ? seen.feeling.byStroke : null, arousal = marked ? seen.feeling.arousal : [], from = 'line';
  if (!byStroke) {
    const aim = target(seen.felt, marks);
    byStroke = seen.strokes.map(() => (aim.source === 'said' ? aim.v : aim.v * 0.5));
    arousal = aim.source === 'said' ? seen.strokes.map(() => aim.a) : [];
    from = aim.source;
  }
  const line = readLine({ byStroke, arousal, strokes: seen.strokes });
  const beats = compileBeats({ strokes: seen.strokes, line, pinned: seen.pinned });
  if (!beats.length) throw new BadRequest('there is nothing painted to tell');
  const shape = shapeOf(beats.map((b) => b.v), { moved: line.moved, stirs: beats.map((b) => b.a) });
  const { general } = attachTonight(beats, { words: seen.words, things: seen.world ? seen.world.things : [] });
  const brief = [
    arcBrief({ beats, shape, felt: seen.felt, marks: describeMarks(marks), cliches: everyone.cliches(), from }),
    wordsBrief(general),
    worldBrief(seen.world),
  ].filter(Boolean).join('\n\n');

  const write = async (text) => parseArc(textOf(await create(arcRequest(seen, models.tell, text))), beats.length);
  // the reader: blind to their line
  const read = async (told) => {
    try {
      const r = parseRead(textOf(await claude.messages.create(readRequest(told.lines, models.remark))), beats.length);
      return r ? { ...checkTelling({ ratings: r.weight, stirs: r.stir, beats }), ratings: r.weight, stirs: r.stir } : { ok: true, score: -Infinity, unread: true };
    } catch (err) {
      log(`the reader failed (${err.status || err.message}); the telling goes unchecked`);
      return { ok: true, score: -Infinity, unread: true };
    }
  };
  // the archivist: what it adds to their world, and where it goes against it
  const archive = async (told) => {
    try {
      const x = parseExtract(textOf(await claude.messages.create(extractRequest(told, { world: seen.world, words: seen.words, beats }, models.remark))), { lines: beats.length, world: seen.world });
      return x ? { ...x, kept: true } : { diff: null, conflicts: [], kept: false };
    } catch (err) {
      log(`the archivist failed (${err.status || err.message}); nothing is proposed for their world`);
      return { diff: null, conflicts: [], kept: false };
    }
  };
  const judge = async (told) => {
    const [check, record] = await Promise.all([read(told), archive(told)]);
    return { told, check, used: wordsUsed({ words: seen.words, lines: told.lines, beats }), conflicts: record.conflicts, diff: record.diff, kept: record.kept };
  };

  const first = await write(brief);
  if (!first) return { status: 502, json: { error: 'the guide could not tell this one' } };
  let best = await judge(first), rewritten = false;
  if (needsRetelling(best)) {
    const again = await write(`${brief}\n\nYour first telling was:\n${first.lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n\n${retellNote({ ...best, beats })}`).catch(() => null);
    if (again) {
      const second = await judge(again);
      if (tellingScore(second) > tellingScore(best)) { best = second; rewritten = true; }
    }
  }

  const { told, check, used } = best;
  const lines = told.lines.map((text, i) => ({ text, box: beats[i].box, strokes: beats[i].strokes, v: r2(beats[i].v), a: r2(beats[i].a) }));
  const motifs = [...tellingMotifs({ title: told.title, lines })];
  everyone.add(motifs);
  await commons.saved(motifs).catch((err) => log(`commons not saved: ${err.message}`));
  await Promise.all(lines.map(async (l, i) => { l.audio = await speak(l.text, { ssml: ssml(l.text, voiceOf(beats[i])) }).catch(() => null); }));
  return {
    status: 200,
    json: {
      title: told.title, lines, shape: shape.id, says: shape.says,
      felt: seen.felt, feltFrom: from, marks: describeMarks(marks),
      followed: {
        checked: !check.unread, ok: !!check.ok,
        agree: check.agree == null ? null : r2(check.agree), stirAgree: check.stirAgree == null ? null : r2(check.stirAgree),
        turn: check.turn ?? null, end: check.end ?? null, rewritten,
        words: { asked: used.asked, used: used.used, named: used.named },
        world: { checked: best.kept, conflicts: best.conflicts.length },
      },
      // what tonight may add to their world: the TV keeps what they keep
      diff: best.diff || { entities: [], facts: [], resolved: [] },
    },
  };
}

// ---------------------------------------------------------------- their words, by phone

async function phone(path, body, sessions) {
  if (path === '/pair') return { status: 200, json: await sessions.create() };
  const code = String(body.code || '').toUpperCase();
  if (!CODE.test(code)) throw new BadRequest('code must be the six letters and numbers the TV shows');
  const gone = { status: 404, json: { error: 'no such pairing, or it has ended' } };
  if (path === '/words') {
    const text = clean(body.text, LIMITS.word);
    if (!text) throw new BadRequest('text must say something');
    const n = await sessions.say(code, text);
    return n ? { status: 200, json: { ok: true, n } } : gone;
  }
  if (path === '/asked') {
    const r = await sessions.asked(code);
    return r ? { status: 200, json: r } : gone;
  }
  // /heard, from the TV
  if (body.end) { await sessions.end(code); return { status: 200, json: { ended: true } }; }
  const r = await sessions.heard(code, Math.max(0, int(body.since, 0, 1e6) || 0), body.ask === undefined ? undefined : (clean(body.ask, 200) || null));
  return r ? { status: 200, json: r } : gone;
}
