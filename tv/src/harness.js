// The harness: the storyteller's senses, memory and voice on the TV (the code calls it the guide).
// These are the tools its agent calls (agent.js runs the loop), and what it is told at the start.
// The guide makes every judgement:
// what a mark is, what to look at, what to remember, what to ask, how to tell it. The harness gives
// it what no chat window has:
// - the painting with each stroke numbered, closer, or as it was part way through; and the
//   paintings of earlier nights, kept on the TV;
// - how each stroke was painted (pace, waits, pressure, pools, what was washed out before it), what
//   they said on their phone while painting it, and how that part felt to them as it came back;
// - their dream world (engine/dreams): searched by the guide, thing by thing and night by night;
// - their answers, when it asks, pointing at the marks it means;
// - their reactions to each line of the telling, as it is told;
// - and it keeps the night, through the engine, as they confirmed it.
// And the harness holds it to them (engine/dreams/ground.mjs): each telling is checked against
// their evidence before it is told, and sent back once if it could be anyone's; where the guide
// offers another way to say a line, their taste (engine/dreams/taste.mjs), learned from every line
// they have answered, chooses which they hear. Some things are never heard, however the guide tells
// it (engine/dreams/gentle.mjs): by a child, a line that brings in something frightening they never
// brought, makes what they marked darker bigger or closer, or says it in a figure of speech; and a
// dream told with what they painted next always ends on it. Sent back once, and then held back.
// After a dream is told, they may paint what happens next (`ctx.ending`): more of it, or a
// different ending. The guide carries the story on from where it stopped, telling only what happens
// next, and the night keeps the story so far and what happens next together (world.newEnding).
// Pure, apart from what it is given: `world` (engine/dreams/world.mjs), `paintings` (paintings.js),
// `render` (the pictures; createRenderer in a browser), `ui` (the screen: ask, tell).
import { recall, thingDetail, nightDetail, agentBrief } from './engine/dreams/tools.mjs';
import { readHand } from './engine/dreams/gesture.mjs';
import { composeTelling, checkGrounded, toSecondPerson, heldAgainst } from './engine/dreams/ground.mjs';
import { withhold } from './engine/dreams/gentle.mjs';

// what the TV held back from a telling, and why, as the guide hears it
const GENTLE = new Set(['frightening', 'made_bigger', 'figure_of_speech']);
const HELD = {
  frightening: 'it brought in something frightening they never brought',
  made_bigger: 'it made what they marked darker bigger or closer',
  figure_of_speech: 'a child may take its figure of speech literally',
  ending_undone: 'it went back to the story as it was, after what they painted next began',
};
const r1 = (x) => Math.round((Number(x) || 0) * 10) / 10;
const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const keyOf = (name) => String(name || '').toLowerCase().replace(/^\s*(the|a|an|my)\s+/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>{}[\]"`\\*_#]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

// a stroke as the guide reads it, with what stands out in how it was painted (`hand`, readHand's)
function strokeDetail(ctx, n, hand = null) {
  const i = ctx.strokes.findIndex((s) => s.n === n), s = ctx.strokes[i];
  const f = ctx.feeling;
  return {
    n, ink: s.ink, box: s.box, length: s.length, seconds: r1((s.ms || 0) / 1000), wait: r1(s.gap), still: r1(s.still), pools: (s.pools || []).length,
    pressure: r2(s.pressure), turning: r1(s.turn),
    they_said: ctx.words.filter((w) => w.n === n).map((w) => w.text),
    felt: f ? { weight: r2(f.byStroke[i]), stir: r2((f.arousal || [])[i] ?? 0) } : null,
    washed_out_before_it: ctx.washed.filter((w) => w.before === n).map((w) => w.box),
    stands_out: hand ? hand.notable.filter((g) => g.stroke === n).map((g) => g.detail) : [],
  };
}

// their words, and how the story says them to them ("I found my boat": "you found your boat"),
// where that is different (`things`: theirs, which keep their own names)
const withYou = (x, key, things = []) => {
  const you = x && typeof x[key] === 'string' ? toSecondPerson(x[key], { things }) : null;
  return you && you !== x[key] ? { ...x, as_you: you } : x;
};

// How it felt to them, and where it turned, under their headings: marked stroke by stroke, or
// their one word with how the model their marks taught reads tonight (`read`).
function feelingLines(ctx, painted, read) {
  const f = ctx.feeling;
  const turn = ctx.turn ? (ctx.turn.size ? { stroke: ctx.turn.n, weight_change: r2(ctx.turn.delta), stir_change: r2(ctx.turn.stir) } : { stroke: ctx.turn.n, lingered: true }) : null;
  return [
    f ? `FEELING (they marked it as the painting came back, stroke by stroke: weight -1 heavier to 1 lighter, stir -1 calm to 1 stirred${painted.feeling && painted.feeling.usual_mark ? `; for them an ordinary mark is about ${painted.feeling.usual_mark.weight} either way in weight and ${painted.feeling.usual_mark.stir} in stir, so read these against that` : ''})`
      : 'FEELING (they did not mark it stroke by stroke: their one word, if they gave one; and how each stroke probably felt, read from how they painted it and what they said, by a model their marks on earlier nights taught: a guess, with how sure, 0 to 1. Never tell them this is how they felt.)',
    JSON.stringify(f ? ctx.strokes.map((s, i) => ({ n: s.n, weight: r2(f.byStroke[i]), stir: r2((f.arousal || [])[i] ?? 0) })) : { word: ctx.felt || null, read_from_brush: read || null }),
    'TURN (where their feeling changed most; or, if it never changed, where they lingered longest)',
    JSON.stringify(turn),
  ];
}

// The first turn: the painting twice (as it is, and numbered), and everything the TV knows of
// tonight, each part under a heading, as data. `brief` is engine/dreams/tools.mjs agentBrief.
// A new thing's name as it will be said: "the someone" is just "someone" (a model told to put the,
// a or my before a name can put it before a word that never takes one)
export const named = (name) => (typeof name === 'string' ? name.replace(/^\s*(the|a|an|my)\s+(?=(someone|somebody|something|anyone|anybody|anything|everyone|everybody|everything|no one|nobody|nothing)\b)/i, '') : name);

// `later`: the head start, begun while the painting is still coming back to be marked; how it felt
// to them, and where it turned, come in a message of their own (laterMessage), and until then the
// guide looks, reads and remembers.
export function firstMessage(ctx, { numbered, brief, later = false }) {
  // earlier chapters come under their own headings, fenced from the rest; what it cost, never
  const { how_they_painted: painted = {}, what_they_keep: keep = null, read_from_brush: read = null, recent = [], recaps = [], memory: _memory = null, ...world } = brief;
  const at = (d) => new Date(d || Date.now());
  const when = at(ctx.date);
  const E = ctx.ending;
  const tonight = {
    night: E ? E.night : brief.night, date: when.toISOString().slice(0, 10), time: when.toTimeString().slice(0, 5),
    minutes_painting: r1((ctx.session.seconds || 0) / 60), strokes: ctx.strokes.length, washed_out: ctx.session.washes || 0, ink_changes: ctx.session.inks || 0,
  };
  const text = [
    ctx.lit ? "Tonight's painting is above as they see it, drawn into their world as light on the night: as it is, and with each stroke numbered where it begins." : "Tonight's painting is above: as it is, and with each stroke numbered where it begins.",
    '',
    'TONIGHT',
    JSON.stringify(tonight),
    'STROKES (in the order painted; box [x0, y0, x1, y1] on a sheet 1600 wide and 1000 tall, y down; seconds it took; seconds waited before it; seconds the brush was held still; ink pools; pressure 0 to 1)',
    JSON.stringify(ctx.strokes.map((s) => ({ n: s.n, ink: s.ink, box: s.box, length: s.length, seconds: r1((s.ms || 0) / 1000), wait: r1(s.gap), still: r1(s.still), pools: (s.pools || []).length, pressure: r2(s.pressure) }))),
    'WASHED OUT (painted, then washed out with Back, before the stroke numbered)',
    JSON.stringify(ctx.washed),
    ...(later ? [
      'FEELING (still coming: they are marking it now, as the painting comes back to them stroke by stroke. How it felt and where it turned come in a message of their own, after the results of your first tools)',
      'null',
    ] : feelingLines(ctx, painted, read)),
    'THEIR WORDS (said on their phone, with the stroke they were painting; n null: before they painted; as_you: the same words told to them, as the story tells them)',
    JSON.stringify(ctx.words.map((w) => withYou(w, 'text', world.things || []))),
    'THE GUIDE SAID (to them, while they painted)',
    JSON.stringify(ctx.said),
    `HOW THEY PAINTED IT (what stands out, against ${painted.against || 'the rest of tonight'}: only their brush knows this, so it is theirs alone; carry it into what happens in the story, never tell it as painting)`,
    JSON.stringify({ notable: painted.notable || [], overall: painted.overall || [], ...(painted.feeling ? { feeling: painted.feeling } : {}) }),
    'WHAT THEY KEEP (learned from every line of earlier tellings they answered: "that\'s it" or "not quite")',
    JSON.stringify(keep || { lines_answered: 0, kept: 0, learned: [] }),
    ...(E ? [
      `WHAT HAPPENS NEXT (this was told a moment ago and kept as night ${E.night}. Then they painted what happens next: strokes ${E.strokes.join(', ')}, the last in STROKES. Here is the telling as it was told, with what they said of each line: the story so far, which stays as it was, less any line they said was not quite. Carry it on from its last line)`,
      JSON.stringify({ night: E.night, new_strokes: E.strokes, told: { title: E.told.title, lines: E.told.lines.map((l, i) => ({ line: i + 1, text: l.text, strokes: l.strokes, said: l.reaction ?? null })) } }),
    ] : []),
    ...(ctx.chose ? [
      'WHAT THEY CHOSE TO PAINT (in their world, before they began: more of one thing in it, or their own answer to a question their Worldbuilder asked about it)',
      JSON.stringify({ more_of: { id: ctx.chose.id, name: ctx.chose.name }, ...(ctx.chose.question ? { answering: ctx.chose.question } : {}) }),
    ] : []),
    'THEIR WORLD (kept on their TV from earlier nights; recall, thing and night tell you more; look shows earlier paintings; hints are marks shaped and placed like ones before, for you to check)',
    JSON.stringify(world),
    ...(recent.length ? [
      'THE LAST CHAPTERS (as they were told, word for word, the latest last, with what they drew next if they did: what happened just before tonight. Find new words tonight: never reuse your own turns of phrase from these, and never begin the way the last began; their own words may come back)',
      JSON.stringify(recent),
    ] : []),
    ...(recaps.length ? [
      'EARLIER CHAPTERS (brief recaps of older chapters that bear on tonight, kept by the TV from what each chapter kept: for reference only, never lines to tell, and never told back as they are; night and recall tell you more)',
      JSON.stringify(recaps),
    ] : []),
    ...(ctx.visitors && ctx.visitors.length ? [
      "VISITING (from another painter's world on this TV, sent to visit theirs: it is in their world tonight, and theirs to see. Bring it into the story where it could truly be, by its name, as what is true of it says. It stays its own world's: never remember it as a thing of theirs, and never say more of where it is from than its name)",
      JSON.stringify(ctx.visitors),
    ] : []),
    '',
    later ? 'Look, read and remember while they mark it: call those tools together now. Ask and tell once how it felt has come.'
      : E ? 'Carry it on, with what they painted next.' : 'Tell it.',
  ].join('\n');
  const pic = (url) => { const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(url); return m ? [{ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }] : []; };
  return [...pic(ctx.seen || ctx.snapshot), ...pic(numbered), { type: 'text', text }];
}

// The head start's second half: once they have marked it (or chosen one word, or neither), how it
// felt and where it turned, under the same headings as a first message has them; and anything they
// said on their phone while it came back (`since`: how many of ctx.words the first message had).
export function laterMessage(ctx, { brief, since = ctx.words.length }) {
  const { how_they_painted: painted = {}, read_from_brush: read = null } = brief;
  const more = ctx.words.slice(since);
  return [
    'They have marked it now.',
    ...feelingLines(ctx, painted, read),
    ...(more.length ? ['THEIR WORDS (more, said on their phone while it came back)', JSON.stringify(more)] : []),
    '',
    'Tell it.',
  ].join('\n');
}

// The telling as it ends up: the first, with each line told again in place of the line it mends
// (the first "not quite" line that shares a mark with it, else the next "not quite" line); with
// what they said of each line.
export function finalTelling(tellings) {
  if (!tellings.length) return null;
  const [first, ...again] = tellings;
  const lines = first.lines.map((l, i) => ({ ...l, reaction: first.reactions[i] ?? null }));
  for (const t of again) {
    t.lines.forEach((l, j) => {
      const open = lines.map((x, i) => (x.reaction === 'no' && !x.mended ? i : -1)).filter((i) => i >= 0);
      const at = open.find((i) => lines[i].strokes.some((n) => l.strokes.includes(n))) ?? open[0];
      const line = { ...l, reaction: t.reactions[j] ?? null, mended: true };
      if (at != null) lines[at] = line; else lines.push(line);
    });
  }
  return { title: first.title, lines: lines.map(({ mended, ...l }) => l) };
}

// the strokes as kept with a night's painting: their summary, and a few points of their path
// each ink, as a sketch draws it
const SKETCH = { dense: '#1c1e24', light: 'rgba(60,58,56,0.55)', water: 'rgba(120,130,140,0.4)', indigo: '#2f4a86', gold: '#c99428', cinnabar: '#d0503f' };

export const keptStrokes = (strokes, points = []) => strokes.map((s, i) => {
  const pts = points[i] || [];
  const step = Math.max(1, Math.ceil(pts.length / 16));
  return { n: s.n, ink: s.ink, box: s.box, from: s.from, to: s.to, length: s.length, path: pts.filter((_, k) => k % step === 0 || k === pts.length - 1).map((p) => [Math.round(p.x), Math.round(p.y)]) };
});

// The tools. `ctx` is tonight: { strokes, points, snapshot, feeling, felt, turn, words, washed,
// said, session, date, young (a child is painting), visitors (things visiting from another
// painter's world: visits.js visitorBrief) }, and, for what they painted next, `ending`: { night, strokes (its stroke numbers),
// told: { title, lines: [{ text, strokes, reaction }] } }. `save()` keeps the world after remember.
// `archive`: every night of their world, kept apart from it (paintings.js createNights), where
// recall, thing and night read the nights the world has let go.
// A telling the check sends back (at most `sendBacks` times) is not told: the guide hears why, and
// the screen says what it is doing (`ui.working`, if given).
export function createTools(ctx, { world, paintings, archive = null, render, ui, save = async () => {}, sendBacks = 1 }) {
  const tonight = new Set(ctx.strokes.map((s) => s.n));
  const only = (ns) => (Array.isArray(ns) ? [...new Set(ns.map(Number).filter((n) => tonight.has(n)))] : []);
  const tellings = [], answers = [], checks = [];
  // what it was given of earlier chapters (briefed: the brief's memory), and what it looked up:
  // kept with the night, for "what it remembered"
  let given = null;
  const used = { looked_up: [], read: [], nights: [] };
  const rememberedOf = () => ({
    recent: given ? given.recent : [], recaps: given ? given.recaps.map(({ chapters, because }) => ({ chapters, because })) : [],
    ...used, tokens: given ? given.tokens : null,
  });
  // an earlier night's painting as they would see it now (ctx.asSeen: drawn into their world, as
  // light); as kept, if that can't be made
  const seenAs = async (url) => { try { return ctx.asSeen ? await ctx.asSeen(url) : url; } catch { return url; } };
  // what they said came again: a thing shown beside tonight's marks when the guide asked, and they
  // said yes. `refused`: a remember sent back once already
  const again = [];
  let refused = false;
  const shownThing = (night, ns) => {
    let best = null, most = 0;
    for (const e of world.entities) {
      if (e.status === 'rejected') continue;
      const k = Math.max(0, ...[...(e.appearances || []), ...(e.endings || [])].filter((a) => a.night === night).map((a) => (a.strokes || []).filter((n) => ns.includes(n)).length));
      if (k > most) { most = k; best = e; }
    }
    return best;
  };
  const hand = readHand(ctx.strokes, { washed: ctx.washed, hand: world.hand() });
  // what they painted next: its strokes, and the words said as they were painted
  const E = ctx.ending || null;
  const fresh = E ? new Set(E.strokes) : null;
  const endingWords = E ? ctx.words.filter((w) => w.n != null && fresh.has(w.n)) : null;
  // their own words for what they painted next: what they said as they painted it, else what they answered
  const endingSaid = () => (endingWords.length ? endingWords[endingWords.length - 1].text : (answers.filter((a) => a.answer).slice(-1)[0] || {}).answer) || null;
  // the story so far: told a moment ago, less the lines they said were not quite. What happens next
  // carries on from it: the guide tells only the new lines, and the night keeps the two together.
  const soFar = E ? E.told.lines.filter((l) => l.reaction !== 'no').map((l) => ({ text: l.text, strokes: l.strokes || [], reaction: l.reaction ?? null })) : [];
  const toldBefore = new Set(soFar.map((l) => keyOf(l.text)));
  const withSoFar = (t) => ({ title: t.title, lines: [...soFar, ...t.lines] });
  // what a telling is held to, as it stands now (their answers grow as the guide asks). Told again
  // with what they painted next: their words for it, and the lines told tonight that they didn't turn down
  // (held to their evidence when first told), are theirs.
  // For a child, also held gentle (engine/dreams/gentle.mjs), against the strokes they marked darker.
  // (read as each telling is checked: with a head start, how it felt comes after the tools are made)
  const darker = () => (ctx.feeling ? ctx.strokes.filter((s, i) => (ctx.feeling.byStroke[i] ?? 0) <= -0.3).map((s) => s.n) : []);
  // a thing visiting from another painter's world is theirs to see here: said by its name, it is theirs
  const visitors = (ctx.visitors || []).filter((v) => v && v.name);
  const visiting = new Set(visitors.map((v) => keyOf(v.name)));
  const evidence = () => {
    const c = world.context({ words: E ? endingWords : ctx.words, asked: answers, strokes: ctx.strokes, washed: ctx.washed, turn: ctx.turn ? ctx.turn.n : null });
    return {
      ...c,
      ...(visitors.length ? { things: [...(c.things || []), ...visitors.map((v) => ({ name: v.name, aliases: [], visiting: true }))] } : {}),
    ...(E ? { confirmed: E.told.lines.filter((l) => l.reaction !== 'no').map((l) => l.text), ending: { strokes: E.strokes } } : {}),
      ...(ctx.young ? { young: true, darker: darker() } : {}),
    };
  };
  let sentBack = 0;
  // the nights kept apart, read once a night, when first wanted
  let olderNights = null;
  const older = () => (olderNights ||= archive ? archive.all().catch(() => []) : Promise.resolve([]));
  const kept = async (k) => {
    const p = await paintings.get(Number(k));
    if (!p) throw new Error(`There is no painting kept for night ${k}.`);
    return p;
  };
  return {
    tellings, answers, checks,
    briefed(brief) { given = (brief && brief.memory) || null; },
    get remembered() { return rememberedOf(); },
    async look({ night = null, strokes = [], zoom = false, after = null } = {}) {
      if (night != null) {
        const p = await kept(night);
        used.nights.push(Number(night));
        const hs = (Array.isArray(strokes) ? strokes : []).map(Number).filter((n) => p.strokes.some((s) => s.n === n));
        return { image: await render.over(await seenAs(p.image), p.strokes, { highlight: hs, zoom: !!zoom && hs.length > 0 }), text: `Night ${night}'s painting${hs.length ? `, marks ${hs.join(', ')} lit${zoom ? ', close up' : ''}` : ''}.` };
      }
      if (after != null) {
        if (!tonight.has(Number(after))) throw new Error(`There is no mark ${after} tonight.`);
        return { image: await render.sketch(ctx.strokes, ctx.points, { upTo: Number(after), highlight: only(strokes) }), text: `A sketch of tonight's strokes in the order they came, up to mark ${after}: their paths, not the ink.` };
      }
      const hs = only(strokes);
      return { image: await render.over(ctx.seen || ctx.snapshot, ctx.strokes, { highlight: hs, zoom: !!zoom && hs.length > 0 }), text: `Tonight's painting${hs.length ? `, marks ${hs.join(', ')} lit${zoom ? ', close up' : ''}` : ''}.` };
    },
    async strokes({ strokes = [], night = null } = {}) {
      if (night != null) {
        const p = await kept(night);
        const want = new Set((Array.isArray(strokes) ? strokes : []).map(Number));
        return p.strokes.filter((s) => want.has(s.n)).map(({ path, ...s }) => s);
      }
      const ns = only(strokes);
      if (!ns.length) throw new Error("Name tonight's strokes by number.");
      return ns.map((n) => strokeDetail(ctx, n, hand));
    },
    async recall({ query = '' } = {}) {
      if (!clean(query, 200)) throw new Error('Say what to look for.');
      used.looked_up.push(clean(query, 80));
      return recall(world, clean(query, 200), { older: await older() });
    },
    async thing({ id = '' } = {}) {
      const d = thingDetail(world, String(id), { older: await older() });
      if (!d) throw new Error(`There is no ${id} in their world.`);
      used.read.push(d.name);
      return d;
    },
    async night({ night = null } = {}) {
      const d = nightDetail(world, night, { older: await older() });
      if (!d) throw new Error(`There is no night ${night} in their world.`);
      used.nights.push(d.night);
      return d;
    },
    async ask({ question = '', choices = [], strokes = [], show = null } = {}) {
      const q = clean(question, 120);
      const cs = (Array.isArray(choices) ? choices : []).map((c) => clean(c, 48)).filter(Boolean).slice(0, 4);
      if (!q || !cs.length) throw new Error('Ask a short question, with two to four answers to choose from.');
      let beside = null;
      // (its marks as numbers, however they were given)
      const marks = (show ? [show.strokes].flat() : []).filter((n) => n != null && n !== '').map(Number).filter((n) => Number.isInteger(n) && n > 0);
      if (show && show.night != null) {
        const p = await paintings.get(Number(show.night));
        if (p) beside = { night: Number(show.night), image: await render.over(await seenAs(p.image), p.strokes, { highlight: marks, zoom: true, width: 420 }) };
      }
      const r = await ui.ask({ question: q, choices: cs, strokes: only(strokes), beside });
      const answer = r && r.answer ? clean(r.answer, 120) : null;
      answers.push({ question: q, answer });
      const shown = beside && answer && /^(yes|yeah|yep|the same|same)\b/i.test(answer) ? shownThing(beside.night, marks) : null;
      if (shown) again.push({ id: shown.id, name: shown.name, question: q, answer, strokes: only(strokes) });
      return withYou({ answer, by: (r && r.by) || (answer ? 'choice' : 'skipped') }, 'answer', world.entities);
    },
    async tell({ title = '', lines = [] } = {}) {
      const again = tellings.length > 0;
      const offered = (Array.isArray(lines) ? lines : []).map((l) => ({ text: clean(l && l.text, 240), ...(clean(l && l.alt, 240) ? { alt: clean(l.alt, 240) } : {}), strokes: only(l && l.strokes) })).filter((l) => l.text).slice(0, 8);
      if (!offered.length || (!again && !E && offered.length < 2)) throw new Error(again ? 'Give the lines to tell again.' : E ? 'Give the lines of what happens next.' : 'A telling needs two to seven lines.');
      const t = clean(title, 60) || (again ? tellings[0].title : 'Untitled');
      // the line or its alternative, as their taste chooses; then held to their evidence: the whole
      // telling the first time, and anything told again with what it mends
      const ev = evidence();
      const told = composeTelling({ title: t, lines: offered }, ev, { model: world.taste() });
      // what happens next, carried on: a line of the story so far is told already, not again
      const repeats = E ? told.lines.map((l, i) => (toldBefore.has(keyOf(l.text)) ? i + 1 : null)).filter(Boolean) : [];
      const composed = repeats.length ? { ...told, lines: told.lines.filter((_, i) => !repeats.includes(i + 1)) } : told;
      // a line's number as the guide gave it
      const yours = told.lines.map((_, i) => i + 1).filter((k) => !repeats.includes(k));
      const now = again ? finalTelling([...tellings, { title: t, lines: composed.lines, reactions: composed.lines.map(() => null) }]) : composed;
      // held to their evidence as it will be kept: with what happens next, after the story so far
      const whole = E ? withSoFar(now) : now;
      const check = checkGrounded(whole, ev);
      const sending = !check.ok && sentBack < sendBacks;
      // past its send-backs, what must never be heard is held back from what is told
      const w = sending ? null : withhold(composed.lines, { ...ev, ending: E && !again ? { strokes: E.strokes, said: endingSaid() } : null });
      checks.push({
        ok: check.ok, blocking: check.blocking.map((b) => b.kind), free: check.free.length, anchored: check.anchored, lines: whole.lines.length,
        ...(sending ? { sent_back: true } : {}), ...(w && w.held.length ? { held: w.held.map((h) => h.kind) } : {}), ...(w && w.added ? { added: w.added.text } : {}),
      });
      if (sending) {
        sentBack++;
        const kinds = check.blocking.map((b) => b.kind);
        if (ui.working) ui.working(kinds.some((k) => GENTLE.has(k)) ? 'Finding gentler words' : kinds.some((k) => k.startsWith('ending') || k === 'no_ending') ? 'Keeping to what you painted next' : 'Keeping to what you painted and said');
        throw new Error(`Sent back, not told. ${check.blocking.map((b) => b.message).join(' ')} Tell it from what is theirs${ctx.young ? ', gently' : ''}.`);
      }
      if (!w.lines.length) throw new Error(`Nothing in it can be told to them. ${check.blocking.map((b) => b.message).join(' ')}`);
      // told to them, as "you", whatever was sent: a line still in "I" is said to them
      const ls = w.lines.map(({ text, strokes }) => ({ text: toSecondPerson(text, ev), strokes }));
      const asYou = ls.map((l, i) => (l.text !== w.lines[i].text ? i + 1 : null)).filter(Boolean);
      if (asYou.length) checks.at(-1).as_you = asYou;
      // the other way to say a line, ready: heard at once if they say "not quite", when nothing
      // holds against it
      const others = w.lines.map((l, i) => { const o = l.other ? toSecondPerson(l.other, ev) : null; return o && !heldAgainst(o, ls[i].strokes, ev).length ? o : null; });
      const r = await ui.tell({ title: t, lines: ls.map((l, i) => (others[i] ? { ...l, other: others[i] } : l)), again, ending: !!E });
      // what they heard instead, and what they said of that
      const swapped = (Array.isArray(r.swapped) ? r.swapped : []).filter((i) => others[i]);
      for (const i of swapped) ls[i] = { ...ls[i], text: others[i] };
      const reactions = ls.map((_, i) => (r.reactions && r.reactions[i]) || null);
      tellings.push({ title: t, lines: ls, reactions });
      const alts = w.lines.map((l, i) => (l.chose === 'alt' ? { line: i + 1, told: l.text } : null)).filter(Boolean);
      const renumbered = w.held.length > 0 || !!w.added || repeats.length > 0 || swapped.length > 0;
      return {
        reactions: ls.map((l, i) => ({ line: i + 1, said: reactions[i], ...(renumbered ? { text: l.text } : {}) })),
        ...(w.held.length ? { held_back: w.held.map((h) => ({ your_line: yours[h.line - 1] ?? h.line, why: HELD[h.kind] || h.kind })) } : {}),
        ...(w.added ? { ended_with: `No line told what they painted next, so it ended in their words: ${w.added.text}` } : {}),
        meaning: 'yes is "that\'s it", no is "not quite", null is no answer',
        ...(alts.length ? { told_the_alt: alts } : {}),
        ...(asYou.length ? { told_as_you: asYou.map((k) => ({ line: k, told: ls[k - 1].text })) } : {}),
        ...(swapped.length ? { heard_the_other: swapped.map((i) => ({ line: i + 1, told: ls[i].text, said: reactions[i] })) } : {}),
        ...(repeats.length ? { already_told: `Your line${repeats.length > 1 ? 's' : ''} ${repeats.join(', ')} ${repeats.length > 1 ? 'were' : 'was'} the story so far, told already: what happens next carries on after it.` } : {}),
        said_on_phone: r.words || [],
        ...(check.warnings.length ? { to_mind: check.warnings.map((w) => w.message) } : {}),
        ...(r.stopped ? { stopped: `They went back to the paper after line ${r.stopped}.` } : {}),
      };
    },
    async remember({ things = [], facts = [], resolved = [], notes = undefined } = {}) {
      const told = finalTelling(tellings);
      // what is kept of their world is kept as it is told to them: "your sister", never "my sister"
      const youOf = (t) => (typeof t === 'string' ? toSecondPerson(t, evidence()) : t);
      // a visitor stays its own world's: it is not kept as a thing of this one
      const all = Array.isArray(things) ? things : [];
      const list = all.filter((x) => !(x && !x.id && visiting.has(keyOf(x.name)) && !world.thingFor(String(x.name))));
      const away = all.filter((x) => !list.includes(x)).map((x) => visitors.find((v) => keyOf(v.name) === keyOf(x.name)));
      // what can't be placed in their world, and a thing they said came again that nothing keeps:
      // sent back once, with why, before anything is kept. After that, what can be is kept, and
      // what they said came again is kept with it.
      const placed = list.map((x) => (x && (x.id || x.name) ? world.thingFor(String(x.id || x.name)) : null));
      const unplaced = list.map((x, i) => (!x || (!x.id && !clean(x.name, 40)) ? `Thing ${i + 1} has neither an id nor a name.` : x.id && !placed[i] ? `There is no ${clean(x.id, 40)} in their world (thing ${i + 1}).` : null)).filter(Boolean);
      const missed = again.filter((c, k) => again.findIndex((o) => o.id === c.id) === k && !placed.includes(c.id));
      if (!refused && (unplaced.length || missed.length)) {
        refused = true;
        const said = missed.map((c) => `They said "${c.answer}" when you asked "${c.question}": ${c.name} (${c.id}) came again tonight, and nothing here keeps it.`);
        throw new Error(`Nothing is kept yet. ${[...unplaced, ...said].join(' ')} Keep a thing from an earlier night by its id (the hints give it as looks_like), and a new one by its name.`);
      }
      const diff = {
        entities: [
          ...list.map((x) => (x && x.id ? { id: String(x.id), strokes: x.strokes, why: x.why, note: youOf(x.note) } : { new: x && named(x.name), kind: x && x.kind, aliases: x && x.aliases, strokes: x && x.strokes, why: x && x.why, note: youOf(x && x.note) })),
          ...missed.map((c) => ({ id: c.id, strokes: c.strokes })),
        ],
        facts: (Array.isArray(facts) ? facts : []).map((f) => ({ about: f && f.about, text: youOf(f && f.text), open: !!(f && f.open) })),
        resolved: (Array.isArray(resolved) ? resolved : []).map((id) => ({ fact: String(id) })),
        ...(Array.isArray(notes) ? { notes } : {}),
      };
      if (E) {
        // what they painted next, kept with its night; the night's painting now has it
        const at = ctx.strokes.map((s, i) => (fresh.has(s.n) ? i : -1)).filter((i) => i >= 0);
        const both = withSoFar(told);
        const r = world.newEnding({
          night: E.night, telling: { title: told.title, lines: both.lines }, strokes: at.map((i) => ctx.strokes[i]),
          feeling: ctx.feeling ? { byStroke: at.map((i) => ctx.feeling.byStroke[i]), arousal: at.map((i) => (ctx.feeling.arousal || [])[i] ?? 0) } : null,
          words: endingWords, answers, diff, reactions: both.lines.map((l) => l.reaction), remembered: rememberedOf(),
        });
        if (!r) throw new Error('There is nothing they painted next to keep.');
        // the night as it was made real stays its picture
        const was = await paintings.get(r.night).catch(() => null);
        await paintings.put(r.night, { ...(was && was.real ? { real: was.real, ...(was.alive ? { alive: was.alive } : {}) } : {}), image: ctx.snapshot, strokes: keptStrokes(ctx.strokes, ctx.points) });
        await save();
        return { night: r.night, next: true, kept: r.kept, let_go: r.turnedDown, ...(r.closed.length ? { settled: r.closed } : {}) };
      }
      const r = world.commit({
        telling: { title: told.title, lines: told.lines }, felt: ctx.felt || null,
        feeling: ctx.feeling ? { byStroke: ctx.feeling.byStroke, arousal: ctx.feeling.arousal || [] } : null,
        words: ctx.words, answers, strokes: ctx.strokes, washed: ctx.washed, diff, reactions: told.lines.map((l) => l.reaction), remembered: rememberedOf(),
      });
      await paintings.put(r.night, { image: ctx.snapshot, strokes: keptStrokes(ctx.strokes, ctx.points) });
      await save();
      return { night: r.night, kept: r.kept, let_go: r.turnedDown, ...(away.length ? { visiting: away.map((v) => `${v.name} is visiting from ${v.from}: it stays theirs, so it is not kept here`) } : {}) };
    },
  };
}

// What the guide is told of their world at the start (engine/dreams/tools.mjs agentBrief).
// And, when they did not mark the feeling, how the model their marks taught reads tonight.
export function briefFor(world, ctx) {
  const brief = agentBrief(world, { strokes: ctx.strokes, words: ctx.words, washed: ctx.washed });
  if (ctx.feeling) return brief;
  const r = world.readFeelings({ strokes: ctx.strokes, washed: ctx.washed, words: ctx.words, felt: ctx.felt });
  return { ...brief, read_from_brush: { strokes: r.strokes, learned_from_strokes: r.learned_from, level_from: r.level } };
}

// ---------------------------------------------------------------- the pictures, in a browser

// The guide's pictures, drawn on a canvas: a painting with each stroke numbered where it begins
// (lit strokes boxed in dashed cinnabar), closer in on lit strokes; or a sketch of the strokes in
// the order they came, each in its ink (lit strokes glowing). Paper units: the sheet is 1600 by 1000.
export function createRenderer({ makeCanvas = () => document.createElement('canvas') } = {}) {
  const load = async (url) => { const img = new Image(); img.src = url; await img.decode(); return img; };
  const area = (strokes, highlight) => {
    const hs = strokes.filter((s) => highlight.includes(s.n));
    if (!hs.length) return [0, 0, 1600, 1000];
    let [x0, y0, x1, y1] = hs.reduce((u, s) => [Math.min(u[0], s.box[0]), Math.min(u[1], s.box[1]), Math.max(u[2], s.box[2]), Math.max(u[3], s.box[3])], [Infinity, Infinity, -Infinity, -Infinity]);
    const pad = 90;
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    // at least a sixth of the sheet across, and the sheet's shape
    const w = Math.max(320, x1 - x0, (y1 - y0) * 1.6), h = w / 1.6, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = Math.max(0, Math.min(1600 - w, cx - w / 2)); y0 = Math.max(0, Math.min(1000 - h, cy - h / 2));
    return [x0, y0, Math.min(1600, x0 + w), Math.min(1000, y0 + h)];
  };
  const numbers = (g, strokes, highlight, X, Y, inside) => {
    g.font = 'bold 15px "Alegreya Sans", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const s of strokes) {
      const [fx, fy] = s.from || [s.box[0], s.box[1]];
      if (!inside(fx, fy)) continue;
      const lit = highlight.includes(s.n);
      g.fillStyle = lit ? '#b23a2a' : 'rgba(28,30,36,0.78)';
      g.beginPath(); g.arc(X(fx), Y(fy), 12, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff7ee'; g.fillText(String(s.n), X(fx), Y(fy) + 1);
    }
  };
  return {
    async over(url, strokes, { highlight = [], zoom = false, width = 768 } = {}) {
      const img = await load(url);
      const [x0, y0, x1, y1] = zoom ? area(strokes, highlight) : [0, 0, 1600, 1000];
      const c = makeCanvas();
      c.width = width; c.height = Math.round((width * (y1 - y0)) / (x1 - x0));
      const g = c.getContext('2d');
      const px = img.width / 1600;
      g.drawImage(img, x0 * px, y0 * px, (x1 - x0) * px, (y1 - y0) * px, 0, 0, c.width, c.height);
      const k = c.width / (x1 - x0), X = (x) => (x - x0) * k, Y = (y) => (y - y0) * k;
      g.strokeStyle = 'rgba(178,58,42,0.9)'; g.lineWidth = 3; g.setLineDash([8, 6]);
      for (const s of strokes) if (highlight.includes(s.n)) g.strokeRect(X(s.box[0]) - 10, Y(s.box[1]) - 10, (s.box[2] - s.box[0]) * k + 20, (s.box[3] - s.box[1]) * k + 20);
      g.setLineDash([]);
      numbers(g, strokes, highlight, X, Y, (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
      return c.toDataURL('image/jpeg', 0.86);
    },
    async sketch(strokes, points, { upTo, highlight = [], width = 768 } = {}) {
      const c = makeCanvas();
      c.width = width; c.height = Math.round(width / 1.6);
      const g = c.getContext('2d'), k = width / 1600;
      g.fillStyle = '#f4eee0'; g.fillRect(0, 0, c.width, c.height);
      g.lineCap = 'round'; g.lineJoin = 'round';
      strokes.forEach((s, i) => {
        if (s.n > upTo) return;
        const pts = points[i] || [];
        const w = Math.max(2, 3 + 10 * (s.pressure || 0.4)) * (width / 768);
        const path = () => { g.beginPath(); pts.forEach((p, j) => (j ? g.lineTo(p.x * k, p.y * k) : g.moveTo(p.x * k, p.y * k))); };
        // a lit stroke glows cinnabar under its own ink, so a stroke painted in cinnabar still reads as itself
        if (highlight.includes(s.n)) { g.strokeStyle = 'rgba(178,58,42,0.3)'; g.lineWidth = w + 16 * (width / 768); path(); g.stroke(); }
        g.strokeStyle = SKETCH[s.ink] || SKETCH.dense;
        g.lineWidth = w;
        path();
        g.stroke();
      });
      numbers(g, strokes.filter((s) => s.n <= upTo), highlight, (x) => x * k, (y) => y * k, () => true);
      return c.toDataURL('image/jpeg', 0.86);
    },
  };
}
