// Twenty-five worlds, made on the TV the way a person makes one: painted with the remote, a few
// words on the phone, marked as each comes back, the storyteller's questions answered, and the
// Worldbuilder's. Everything the TV tells, names and keeps is made by the app itself, with the real
// storyteller and Worldbuilder (Claude, through Claude Code on the subscription it is signed in
// with: server/claude-cli.mjs). Nothing here tells a story: a night says only what the person
// paints, says and marks, and how they answer.
//
// Each world is an idea found online (`source`): cities from Calvino's Invisible Cities, drowned and
// hidden cities from legend, worlds from myth, from books, from architecture, two children's
// imaginary countries from history, and worldbuilding prompts people have posted. Three nights
// each: the first thing in it; more of it, and what happens next; then the Worldbuilder's question
// and something new. Then their world at night, walked through, and their book. And one written
// here, not found: one grown-up's recurring dream, 52 nights over eleven weeks (tide-town).
//
//   node scripts/worlds.mjs                  every world, two TVs at a time
//   WORLDS=octavia,ys NIGHTS=1 node scripts/worlds.mjs
//   KEEP=1 WORLDS=babel NIGHTS=8 node scripts/worlds.mjs           a TV kept on disk (<world>/profile)
//   KEEP=1 WORLDS=babel FROM=9 NIGHTS=14 node scripts/worlds.mjs   the same TV, another day: night 9 on
// A world with a `clock` (tide-town) has each night on its own day on the TV's clock (`day`, `at`),
// the TV turned on again for it, so it is days apart to the TV as it is to the person.
// With KEEP, results.json is written after every night, and their world and book are shot at the
// end as w<NN>-… and b<NN>-…, NN the last night.
// Screenshots and results.json in test-shots/worlds/<world>/; all of them in test-shots/worlds/.
import { join, resolve } from 'node:path';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openTV, R, L, UP, DOWN, wavy } from './painted-nights.mjs';
import { createClaudeCli } from '../server/claude-cli.mjs';

// WORLDS_OUT: somewhere else, to make some again beside the ones made before
const OUT = process.env.WORLDS_OUT ? resolve(process.env.WORLDS_OUT) : fileURLToPath(new URL('../test-shots/worlds/', import.meta.url));
const UR = -Math.PI / 4, UL = (-3 * Math.PI) / 4, DR = Math.PI / 4, DL = (3 * Math.PI) / 4;

// ---------------------------------------------------------------- the brush, as a hand moves it

// The brush runs about 150 paper units a second (300 with ▲ held: `ease`), and turns 2.4 radians a
// second while ◀ or ▶ is held: so a ring is about 125 across (250 eased).
const msFor = (len, ease) => Math.round((len / (ease ? 300 : 150)) * 1000) + 200;
const line = (x, y, heading, len, o = {}) => ({ at: [x, y], heading, ms: msFor(len, o.ease), ...o });
const ring = (x, y, o = {}) => ({ at: [x, y], heading: R, ms: 2900, steer: [['ArrowLeft', 100, 2750]], ...o });
const dot = (x, y, ink, press = 800) => ({ at: [x, y], heading: R, ms: 140, press, ink });
const wave = (x, y, len, o = {}) => ({ at: [x, y], heading: R, ms: msFor(len, o.ease), steer: wavy(msFor(len, o.ease), 700, 240), ...o });

// ---------------------------------------------------------------- how a person answers

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'it', 'is', 'was', 'to', 'with', 'my', 'your', 'this', 'that', 'at', 'by', 'for', 'from', 'or', 'its', 'there', 'they', 'what', 'who', 'are', 'be', 'were', 'did', 'does', 'how', 'why', 'you']);
const keys = (t) => (String(t).toLowerCase().match(/[a-z']+/g) || []).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/'s$/, '').replace(/(?<=[^s])s$/, ''));
// A question is answered with the choice that says what they meant, if one does; else in their own
// words, on the phone. A thing asked about as one from before is the same if they meant it to be.
function personFor(N) {
  const said = new Set();
  const mine = N.answers || [];
  // what they know of tonight: what they painted, what they said on the phone, what they meant to answer
  const tonight = [N.dream || '', ...(N.words || []).map((w) => w.text), ...mine];
  const overlap = (t, texts) => { const k = keys(t); return texts.reduce((n, a) => n + keys(a).filter((w) => k.includes(w)).length, 0); };
  const bestOf = (texts, chips) => chips.reduce((b, c) => { const s = overlap(c, texts); return s > b.s ? { c, s } : b; }, { c: null, s: 0 }).c;
  return {
    answer(q) {
      const chips = q.chips.filter((c) => !/^(skip|not now|something else|none of these)$/i.test(c));
      // the choice that is what they meant to answer; else one that is something of tonight's; else
      // the storyteller's first guess, as a person who isn't sure takes it (words that only share
      // the question's own words, "the twilight line" for "what stands on the line?", are no answer)
      const best = bestOf(mine, chips) || bestOf(tonight, chips) || chips[0];
      if (best) return { chip: best };
      // no choices: their own words, on the phone
      const say = mine.find((a) => !said.has(a)) || mine[0];
      if (say) { said.add(say); return { say }; }
      return { chip: q.chips[0] };
    },
    // how it felt in a word, when the TV asks because nothing was marked
    feel: N.feel || null,
    same(q) {
      if (N.same === false) return false;
      if (N.start && N.start.more) return true;
      const k = keys(q.question);
      return mine.some((a) => keys(a).some((w) => k.includes(w)));
    },
  };
}

// ---------------------------------------------------------------- one person, the same dream for weeks

// How they paint the things that keep coming back in their tide town, the same way each time, as
// a hand does: the sea a wavy line (far out it is high up the paper, in it is low), the
// lighthouse a tall stroke with its lamp a dot, mum's kitchen window a square with its light
const sea = (y, o = {}) => wave(250, y, 1100, { ink: 'indigo', ...o });
const sand = () => line(150, 830, R, 1300, { ink: 'light', ease: true });
const houses = () => [line(250, 830, UP, 90, { ink: 'dense' }), line(330, 830, UP, 120), line(410, 830, UP, 80)];
const lighthouse = (lit) => [line(1250, 830, UP, 430, { ink: 'dense' }), dot(1250, 380, lit ? 'gold' : 'light', lit ? 1400 : 500)];
const beam = (len = 900, o = {}) => line(1230, 380, L, len, { ink: 'gold', ...o });
const windowAt = (x, y, lit) => [line(x, y, R, 120, { ink: 'dense' }), line(x, y + 120, R, 120), line(x, y, DOWN, 120), line(x + 120, y, DOWN, 120), ...(lit ? [dot(x + 60, y + 60, 'gold', lit === 'dim' ? 300 : 900)] : [])];
const fox = (x, y) => [line(x, y, R, 70, { ink: 'cinnabar' }), line(x + 70, y, UR, 45, { ink: 'cinnabar' })];
const bus = (y = 600) => [line(300, y, R, 700, { ink: 'dense', ease: true }), line(300, y + 100, R, 700, { ink: 'dense', ease: true }), dot(420, y + 50, 'gold', 400), dot(600, y + 50, 'gold', 400), dot(780, y + 50, 'gold', 400)];
const door = (x = 650) => [line(x, 820, UP, 300, { ink: 'dense' }), line(x + 150, 820, UP, 300), line(x, 520, R, 150)];
const piano = (x = 700, y = 600) => [line(x, y, R, 220, { ink: 'dense' }), line(x, y, DOWN, 120), line(x + 220, y, DOWN, 120), line(x + 20, y + 40, R, 180, { ink: 'light' })];
const umbrellaMan = (x = 950) => [line(x, 820, UP, 180, { ink: 'dense' }), ring(x - 60, 600, { ink: 'gold' })];
const sandTown = () => [line(400, 820, UP, 60, { ink: 'light' }), line(460, 820, UP, 90)];
const rain = (n = 5) => Array.from({ length: n }, (_, i) => line(350 + i * 200, 250, DOWN, 150, { ink: 'light' }));

// ---------------------------------------------------------------- the worlds

const WORLDS = [
  {
    id: 'octavia', name: 'Octavia, the net city', seal: 'Star',
    idea: 'A city hung in a net of ropes over an abyss between two mountains; its people know the net won\'t last forever.',
    source: { name: 'Italo Calvino, Invisible Cities (1972): Octavia', url: 'https://www.litcharts.com/lit/invisible-cities/summary' },
    nights: [
      {
        dream: 'the city in its net', offer: 'inside',
        strokes: [line(260, 940, UP, 660, { ink: 'dense' }), line(1340, 940, UP, 660), line(260, 330, R, 1080, { ink: 'light' }), line(260, 430, R, 1080), dot(640, 470, 'dense', 700), dot(960, 470, 'dense', 700)],
        words: [{ after: 2, text: 'two mountains with a city strung between them on ropes' }, { after: 6, text: 'the houses hang under the ropes like spiders. below them nothing, it just drops forever' }],
        marks: { 2: ['ArrowRight'], 5: ['ArrowDown'] },
        answers: ['the rope city', 'the ropes between the mountains', 'houses hanging like spiders', 'the drop below'],
      },
      {
        dream: 'a mender with a lantern, and a fraying rope', start: { more: 'rope' }, offer: 'next',
        strokes: [line(800, 470, DOWN, 300, { ink: 'dense' }), dot(800, 790, 'gold', 900), line(980, 420, R, 160, { ink: 'cinnabar' })],
        words: [{ after: 2, text: 'a mender climbs down at night with a lantern' }, { after: 3, text: 'one rope is fraying, it\'s red where it\'s wearing through' }],
        marks: { 0: ['ArrowDown', 'ArrowRight'], 2: ['ArrowDown'] },
        answers: ['the mender', 'her lantern', 'the fraying rope', 'a new knot'],
        ending: { strokes: [ring(820, 860, { ink: 'gold' })], words: [{ after: 1, text: 'she ties a new knot and the whole city sways but holds' }], marks: { 0: ['ArrowUp'] } },
      },
      {
        dream: 'birds nesting in the ropes', start: { wonder: { about: 'rope', choose: 0 } }, offer: 'end',
        strokes: [line(500, 300, UR, 120, { ink: 'dense' }), line(585, 215, DR, 120), line(1100, 280, UR, 120), line(1185, 195, DR, 120)],
        words: [{ after: 4, text: 'birds nest in the top ropes and the children leave crumbs for them' }],
        marks: { 0: ['ArrowUp'], 2: ['ArrowUp'] },
        answers: ['the rope birds', 'their nests in the ropes', 'the children feed them'],
      },
    ],
  },
  {
    id: 'zenobia', name: 'Zenobia, the city on stilts', seal: 'Bird',
    idea: 'A city raised on tall stilts over dry land, its platforms and huts at every height, joined by ladders.',
    source: { name: 'Italo Calvino, Invisible Cities (1972): Zenobia', url: 'https://www.litcharts.com/lit/invisible-cities/summary' },
    nights: [
      {
        dream: 'the stilt city over dry ground', offer: 'inside',
        strokes: [line(200, 920, UP, 500, { ink: 'dense' }), line(420, 920, UP, 560), line(640, 920, UP, 480), line(160, 420, R, 600, { ink: 'dense' }), dot(300, 380, 'dense', 600), line(80, 940, R, 1400, { ink: 'light', ease: true })],
        words: [{ after: 3, text: 'a city standing on tall stilts, but there\'s no water under it, just dry ground' }, { after: 5, text: 'the huts sit at different heights and ladders join them' }],
        marks: { 3: ['ArrowUp'], 5: ['ArrowLeft'] },
        answers: ['the stilt city', 'the stilts', 'the platforms and huts', 'dry ground below'],
      },
      {
        dream: 'the highest platform, and a lamp to see the old sea', start: { more: 'stilt' }, offer: 'next',
        strokes: [line(900, 920, UP, 620, { ink: 'dense' }), line(860, 300, R, 200), dot(960, 260, 'gold', 900)],
        words: [{ after: 3, text: 'someone built the highest platform yet, and lit a lamp up there so they can see the old sea' }],
        marks: { 2: ['ArrowUp', 'ArrowRight'] },
        answers: ['the highest platform', 'the lamp', 'the old sea', 'nobody remembers the water'],
        ending: { strokes: [wave(150, 800, 1200, { ink: 'indigo' })], words: [{ after: 1, text: 'far away a line of blue comes back, water is coming' }], marks: { 0: ['ArrowRight'] } },
      },
      {
        dream: 'the children\'s own stilt house', start: { wonder: { about: 'stilt', choose: 0 } }, offer: 'end',
        strokes: [line(1200, 920, UP, 300, { ink: 'light' }), line(1300, 920, UP, 300), line(1160, 620, R, 200)],
        words: [{ after: 3, text: 'children build a tiny stilt house of their own, the way the first builders did' }],
        marks: { 0: ['ArrowUp'] },
        answers: ['the children\'s stilt house', 'the first builders'],
      },
    ],
  },
  {
    id: 'valdrada', name: 'Valdrada, the city doubled in its lake', seal: 'Wave',
    idea: 'A lakeside city with an upside-down twin in the water; everything done above is done again below, so no one is careless.',
    source: { name: 'Italo Calvino, Invisible Cities (1972): Valdrada', url: 'https://www.enotes.com/topics/invisible-cities' },
    nights: [
      {
        dream: 'towers and their twins in the water', offer: 'inside',
        strokes: [line(100, 500, R, 1400, { ink: 'indigo', ease: true }), line(500, 490, UP, 300, { ink: 'dense' }), line(500, 520, DOWN, 300, { ink: 'light' }), line(900, 490, UP, 220, { ink: 'dense' }), line(900, 520, DOWN, 220, { ink: 'light' })],
        words: [{ after: 3, text: 'a city on a lake, and every tower has its twin upside down in the water' }, { after: 5, text: 'whatever happens up here happens again down there' }],
        marks: { 0: ['ArrowLeft'], 2: ['ArrowDown'] },
        answers: ['the twin city', 'the reflection', 'towers and their twins', 'the lake'],
      },
      {
        dream: 'a lamp lit twice, and a watcher', start: { more: 'twin' }, offer: 'next',
        strokes: [dot(700, 460, 'gold', 800), dot(700, 560, 'gold', 800), line(1100, 490, UP, 150, { ink: 'cinnabar' })],
        words: [{ after: 2, text: 'two lovers light a lamp and its twin lights in the water' }, { after: 3, text: 'someone in red is watching, careful, because down there it\'s watched too' }],
        marks: { 0: ['ArrowUp'], 2: ['ArrowRight', 'ArrowDown'] },
        answers: ['the lamp and its twin', 'the watcher in red', 'the lovers', 'the water remembers'],
        ending: { strokes: [line(200, 600, R, 1200, { ink: 'water', ease: true })], words: [{ after: 1, text: 'a stone breaks the water and for a moment the twins don\'t match' }], marks: { 0: ['ArrowRight'] } },
      },
      {
        dream: 'the moon and the moon below', start: { wonder: { about: 'lake', choose: 0 } }, offer: 'end',
        strokes: [ring(800, 380, { ink: 'dense' }), ring(800, 750, { ink: 'light' })],
        words: [{ after: 2, text: 'the moon and the moon below. the city waits to see which one sets first' }],
        marks: { 0: ['ArrowUp'], 1: ['ArrowLeft'] },
        answers: ['the two moons', 'which one sets first'],
      },
    ],
  },
  {
    id: 'ys', name: 'Ys, the drowned city', seal: 'Fish',
    idea: 'A city swallowed by the sea when the one key to its sea gate was stolen; its cathedral bells still ring under the water.',
    source: { name: 'The Breton legend of Ys', url: 'https://en.wikipedia.org/wiki/Ys' },
    nights: [
      {
        dream: 'the city under the sea, its bell and its gate', offer: 'inside',
        strokes: [wave(80, 300, 1400, { ink: 'indigo' }), line(600, 900, UP, 450, { ink: 'dense' }), dot(600, 420, 'gold', 900), line(1100, 900, UP, 250, { ink: 'dense' }), dot(1100, 640, 'cinnabar', 700)],
        words: [{ after: 3, text: 'a city under the sea and the cathedral bell still rings down there' }, { after: 5, text: 'the gate that let the sea in, and its one red key' }],
        marks: { 0: ['ArrowRight'], 2: ['ArrowLeft', 'ArrowUp'], 4: ['ArrowDown'] },
        answers: ['the drowned city', 'the cathedral bell', 'the sea gate', 'the red key'],
      },
      {
        dream: 'a fisherman hears the bell', start: { more: 'bell' }, offer: 'next',
        strokes: [line(300, 280, R, 300, { ink: 'dense' }), line(330, 290, DOWN, 200, { ink: 'light' })],
        words: [{ after: 2, text: 'a fisherman hears the bell under his boat and lowers a line' }],
        marks: { 1: ['ArrowDown'] },
        answers: ['the fisherman', 'his line', 'the bell under the boat'],
        ending: { strokes: [dot(360, 500, 'gold', 900)], words: [{ after: 1, text: 'something gold comes up on the hook, a little bell' }], marks: { 0: ['ArrowUp', 'ArrowRight'] } },
      },
      {
        dream: 'a window lit under the water', start: { wonder: { about: 'city', choose: 0 } }, offer: 'end',
        strokes: [line(150, 950, R, 1300, { ink: 'light', ease: true }), ring(1200, 900, { ink: 'dense' })],
        words: [{ after: 2, text: 'on calm nights you can see a lit window down there, someone still lives in Ys' }],
        marks: { 1: ['ArrowUp'] },
        answers: ['the lit window', 'someone still lives there', 'calm nights'],
      },
    ],
  },
  {
    id: 'kitezh', name: 'Kitezh, the city in the lake', seal: 'Mountain',
    idea: 'A city that vanished into a forest lake to escape an army; only the pure in heart see its domes in the water and hear its bells.',
    source: { name: 'The Russian legend of Kitezh and Lake Svetloyar', url: 'https://en.wikipedia.org/wiki/Kitezh' },
    nights: [
      {
        dream: 'domes in the water, and a pilgrim', offer: 'inside',
        strokes: [line(100, 450, R, 1400, { ink: 'water', ease: true }), ring(500, 700, { ink: 'light' }), ring(800, 720, { ink: 'light' }), line(1000, 440, UP, 250, { ink: 'dense' })],
        words: [{ after: 3, text: 'a lake in the forest and the domes of a city show in the water but there\'s nothing on the shore' }, { after: 4, text: 'a pilgrim kneels to look, only the pure in heart can see it' }],
        marks: { 1: ['ArrowUp'], 3: ['ArrowLeft'] },
        answers: ['the invisible city', 'the domes in the water', 'the pilgrim', 'only the pure in heart'],
      },
      {
        dream: 'the bells, and an army coming', start: { more: 'dome' }, offer: 'next',
        strokes: [dot(500, 640, 'gold', 900), dot(800, 660, 'gold', 900), line(150, 200, R, 500, { ink: 'cinnabar' })],
        words: [{ after: 2, text: 'the bells ring under the lake' }, { after: 3, text: 'an army is coming over the hill' }],
        marks: { 0: ['ArrowUp'], 2: ['ArrowDown', 'ArrowRight'] },
        answers: ['the bells under the lake', 'the army', 'riders on the hill'],
        ending: { strokes: [line(100, 480, R, 1400, { ink: 'water', ease: true })], words: [{ after: 1, text: 'the city sinks deeper and the army only finds a quiet lake' }], marks: { 0: ['ArrowLeft', 'ArrowUp'] } },
      },
      {
        dream: 'a child with a candle', start: { wonder: { about: 'lake', choose: 0 } }, offer: 'end',
        strokes: [line(1200, 440, UP, 180, { ink: 'dense' }), dot(1250, 300, 'gold', 700)],
        words: [{ after: 2, text: 'a child brings a candle to the shore every year and the bells answer' }],
        marks: { 1: ['ArrowUp'] },
        answers: ['the child with the candle', 'the bells answer'],
      },
      // nights 4 on: the same pilgrim, coming back to it (KEEP=1, NIGHTS=…)
      {
        dream: 'the soldier who stayed', offer: 'end',
        strokes: [line(100, 450, R, 1400, { ink: 'water', ease: true }), dot(300, 300, 'cinnabar', 600), dot(450, 280, 'cinnabar', 600), dot(600, 310, 'cinnabar', 600), line(1100, 440, UP, 200, { ink: 'dense' })],
        words: [{ after: 4, text: 'their fires are still burning on the hill, the army is leaving' }, { after: 5, text: 'one soldier stays behind, he can hear the bells but he can not see anything' }],
        marks: { 1: ['ArrowDown'], 4: ['ArrowLeft', 'ArrowDown'] },
        answers: ['the soldier who stayed', 'he hears the bells', 'the army leaving', 'the campfires'],
      },
      {
        dream: 'the bell ringer under the water', start: { more: 'bell' }, offer: 'next',
        strokes: [line(650, 800, UP, 220, { ink: 'dense' }), ring(760, 700, { ink: 'gold' }), line(760, 575, UP, 120, { ink: 'light' })],
        words: [{ after: 2, text: 'under the water an old man rings the bells so the city does not forget the shore' }, { after: 3, text: 'the bell rope goes all the way up to the surface' }],
        marks: { 1: ['ArrowUp'] },
        answers: ['the bell ringer', 'the old man under the water', 'the bell rope', 'so they remember the shore'],
        ending: { strokes: [line(1100, 300, DL, 300, { ink: 'dense' })], words: [{ after: 1, text: 'the soldier throws his sword into the lake and the rope moves' }], marks: { 0: ['ArrowUp', 'ArrowRight'] } },
      },
      {
        dream: 'the white path round the lake', offer: 'end', react: { 2: 'no' },
        strokes: [wave(150, 750, 1300, { ink: 'light' }), dot(300, 760, 'light', 500), dot(700, 740, 'light', 500), dot(1100, 760, 'light', 500), line(900, 740, UP, 80, { ink: 'dense' })],
        words: [{ after: 1, text: 'pilgrims walk round the lake three times on their knees' }, { after: 5, text: 'the path is worn white and smooth' }],
        marks: { 0: ['ArrowUp', 'ArrowLeft'] },
        answers: ['the pilgrims path', 'three times round', 'on their knees', 'the white stones'],
      },
      {
        dream: 'letters for the people under the lake', start: { wonder: { about: 'lake', choose: 0 } }, offer: 'end',
        strokes: [wave(200, 600, 1000, { ink: 'indigo' }), dot(500, 300, 'light', 500), dot(900, 320, 'light', 500)],
        words: [{ after: 3, text: 'people fold letters and drop them in the lake for the people underneath, and the fish carry them down' }],
        marks: { 0: ['ArrowRight'] },
        answers: ['the letters in the lake', 'the fish carry them', 'for the people underneath'],
      },
      {
        dream: 'winter, walking on the frozen lake', offer: 'inside',
        strokes: [line(100, 450, R, 1400, { ink: 'light', ease: true }), ring(500, 700, { ink: 'light' }), ring(800, 720, { ink: 'light' }), line(650, 440, UP, 150, { ink: 'dense' })],
        words: [{ after: 1, text: 'in winter the lake freezes over' }, { after: 4, text: 'you can walk right over the city and see the domes under your feet' }],
        marks: { 0: ['ArrowLeft'], 3: ['ArrowUp'] },
        answers: ['the frozen lake', 'walking over the city', 'the domes under the ice', 'winter'],
      },
      {
        dream: 'the bells ring the soldier\'s name', start: { more: 'soldier' }, offer: 'next',
        strokes: [line(100, 450, R, 1400, { ink: 'water', ease: true }), line(1150, 440, UP, 200, { ink: 'dense' }), ring(900, 700, { ink: 'gold' })],
        words: [{ after: 2, text: 'the soldier comes back to the shore every night' }, { after: 3, text: 'the bells ring his name and he does not know how they know it' }],
        marks: { 2: ['ArrowUp', 'ArrowRight'] },
        answers: ['the soldier', 'the bells ring his name', 'the shore'],
        ending: { strokes: [line(1150, 460, DOWN, 120, { ink: 'dense' })], words: [{ after: 1, text: 'he walks into the lake up to his knees but the water will not let him go further' }], marks: { 0: ['ArrowDown', 'ArrowRight'] } },
      },
      {
        dream: 'the old man\'s daughter', offer: 'end',
        strokes: [line(650, 800, UP, 220, { ink: 'dense' }), line(760, 800, UP, 140, { ink: 'cinnabar' }), ring(900, 700, { ink: 'gold' })],
        words: [{ after: 2, text: 'the old man has a daughter down there' }, { after: 3, text: 'she has never seen the sun, only the candle once a year' }],
        marks: { 1: ['ArrowUp'] },
        answers: ['the old mans daughter', 'she has never seen the sun', 'the candle once a year', 'the bell ringer'],
      },
      {
        dream: 'spring, the ice breaks', start: { wonder: { about: 'soldier', choose: 0 } }, offer: 'end',
        strokes: [line(100, 450, R, 1400, { ink: 'light', ease: true }), line(400, 450, DR, 150, { ink: 'dense' }), line(900, 450, DL, 150), wave(150, 500, 1300, { ink: 'water' })],
        words: [{ after: 3, text: 'in spring the ice breaks with a sound like a bell' }, { after: 4, text: 'for one week the bells are louder than ever' }],
        marks: { 1: ['ArrowRight'], 3: ['ArrowUp', 'ArrowRight'] },
        answers: ['the ice breaking', 'spring', 'the bells are louder', 'a week'],
      },
      {
        dream: 'the child, grown up', start: { more: 'child' }, offer: 'end',
        strokes: [line(1200, 440, UP, 260, { ink: 'dense' }), line(1300, 440, UP, 120), dot(1250, 280, 'gold', 700)],
        words: [{ after: 3, text: 'the child with the candle is grown up now and brings her own little girl' }],
        marks: { 2: ['ArrowUp'] },
        answers: ['the child grown up', 'her little girl', 'the candle', 'the child'],
      },
      {
        dream: 'the army comes back', offer: 'end', react: { 2: 'no' },
        strokes: [line(150, 200, R, 700, { ink: 'cinnabar' }), dot(300, 250, 'dense', 400), dot(500, 240, 'dense', 400), dot(700, 260, 'dense', 400), line(100, 450, R, 1400, { ink: 'water', ease: true })],
        words: [{ after: 4, text: 'years later the army comes back to find the city' }, { after: 5, text: 'but the lake is just a lake, they look and look and see nothing' }],
        marks: { 0: ['ArrowDown', 'ArrowRight'] },
        answers: ['the army comes back', 'years later', 'just a lake', 'they see nothing'],
      },
      {
        dream: 'the daughter comes up to see the candle', start: { wonder: { about: 'people underneath', choose: 'own' } }, offer: 'inside',
        strokes: [line(800, 800, UP, 300, { ink: 'cinnabar' }), ring(800, 460, { ink: 'light' }), dot(1250, 300, 'gold', 700)],
        words: [{ after: 3, text: 'the old mans daughter comes up through the water to see the candle, just for one night' }],
        marks: { 0: ['ArrowUp', 'ArrowRight'], 2: ['ArrowUp'] },
        answers: ['the daughter comes up', 'to see the candle', 'one night', 'the old mans daughter'],
      },
      {
        dream: 'the soldier and the daughter meet', start: { more: 'daughter' }, offer: 'next',
        strokes: [line(100, 450, R, 1400, { ink: 'water', ease: true }), line(1150, 440, UP, 200, { ink: 'dense' }), line(800, 600, UP, 150, { ink: 'cinnabar' }), ring(800, 460, { ink: 'light' })],
        words: [{ after: 4, text: 'the soldier sees the daughter come up for the candle, the first person from the city he has ever seen' }],
        marks: { 2: ['ArrowUp', 'ArrowRight'] },
        answers: ['the soldier', 'the daughter', 'the first person from the city', 'she comes up'],
        ending: { strokes: [line(820, 450, R, 300, { ink: 'gold' })], words: [{ after: 1, text: 'she gives him back his sword from the bottom of the lake' }], marks: { 0: ['ArrowUp'] } },
      },
      {
        dream: 'the bells go quiet', offer: 'end',
        strokes: [line(650, 800, UP, 160, { ink: 'dense' }), dot(500, 640, 'light', 300), dot(800, 660, 'light', 300)],
        words: [{ after: 3, text: 'one night the bells do not ring, the old man is too tired' }],
        marks: { 0: ['ArrowDown', 'ArrowLeft'], 2: ['ArrowDown'] },
        answers: ['the bells are quiet', 'the old man is tired', 'the bells do not ring'],
      },
      {
        dream: 'the daughter rings the bells now', start: { wonder: { about: 'old man', choose: 0 } }, offer: 'end',
        strokes: [line(760, 800, UP, 140, { ink: 'cinnabar' }), ring(900, 700, { ink: 'gold' }), line(900, 575, UP, 120, { ink: 'light' })],
        words: [{ after: 3, text: 'the daughter rings the bells now, slower than her father did' }],
        marks: { 1: ['ArrowUp'] },
        answers: ['the daughter rings the bells', 'slower than her father', 'the bells'],
      },
      {
        dream: 'so many pilgrims now', offer: 'end', react: { 1: 'no' },
        strokes: [wave(150, 750, 1300, { ink: 'light' }), line(300, 740, UP, 70, { ink: 'dense' }), line(450, 750, UP, 70), line(600, 740, UP, 70), line(750, 750, UP, 70), line(900, 740, UP, 70)],
        words: [{ after: 6, text: 'more pilgrims come every year now, the path round the lake is full of them' }],
        marks: { 0: ['ArrowUp'], 5: ['ArrowUp', 'ArrowRight'] },
        answers: ['the pilgrims', 'the path round the lake', 'every year more'],
      },
      {
        dream: 'the soldier, old on the shore', start: { more: 'soldier' }, offer: 'end',
        strokes: [line(1150, 440, UP, 160, { ink: 'light' }), line(1260, 440, UP, 120, { ink: 'dense' }), dot(1210, 300, 'gold', 700)],
        words: [{ after: 3, text: 'the soldier is old now and still comes every night, the girl with the candle brings him one too' }],
        marks: { 0: ['ArrowLeft'], 2: ['ArrowUp'] },
        answers: ['the old soldier', 'the girl with the candle', 'a candle for him', 'every night'],
      },
      {
        dream: 'the city rises for one night', offer: 'inside',
        strokes: [line(100, 600, R, 1400, { ink: 'water', ease: true }), ring(500, 590, { ink: 'light', ease: true }), ring(950, 590, { ink: 'light', ease: true }), dot(500, 420, 'gold', 700), dot(950, 420, 'gold', 700), line(1250, 590, UP, 150, { ink: 'cinnabar' })],
        words: [{ after: 3, text: 'one night the whole city rises out of the lake' }, { after: 6, text: 'and everyone who ever waited on the shore can see it' }],
        marks: { 1: ['ArrowUp', 'ArrowRight'], 2: ['ArrowUp', 'ArrowRight'], 5: ['ArrowUp'] },
        answers: ['the city rises', 'everyone who waited', 'one night', 'the domes above the water'],
      },
      {
        dream: 'the morning after', offer: 'end',
        strokes: [line(100, 450, R, 1400, { ink: 'water', ease: true }), ring(500, 700, { ink: 'light' }), ring(950, 700, { ink: 'light' }), dot(1250, 300, 'gold', 500)],
        words: [{ after: 3, text: 'in the morning the city is back under the water' }, { after: 4, text: 'and the bells ring like nothing happened' }],
        marks: { 0: ['ArrowLeft'], 3: ['ArrowUp'] },
        answers: ['the morning after', 'back under the water', 'the bells ring'],
      },
      {
        dream: 'the soldier\'s candle', start: { more: 'soldier' }, offer: 'inside',
        strokes: [line(100, 450, R, 1400, { ink: 'water', ease: true }), line(1260, 440, UP, 120, { ink: 'dense' }), dot(1150, 430, 'gold', 900)],
        words: [{ after: 3, text: 'the soldier is gone now, the little girl leaves his candle on the shore where he used to stand, and the bells ring his name' }],
        marks: { 1: ['ArrowDown', 'ArrowLeft'], 2: ['ArrowUp'] },
        answers: ['the soldier is gone', 'his candle', 'where he used to stand', 'the bells ring his name'],
      },
    ],
  },
  {
    id: 'hy-brasil', name: 'Hy-Brasil, the island in the mist', seal: 'Wave',
    idea: 'An island west of Ireland hidden in mist, seen for one day every seven years, when its king holds court; never reached.',
    source: { name: 'Irish legend of Hy-Brasil', url: 'https://folklorethursday.com/legends/five-islands-fable/' },
    nights: [
      {
        dream: 'the island coming out of the mist', offer: 'inside',
        strokes: [line(100, 650, R, 1400, { ink: 'light', ease: true }), wave(100, 760, 1400, { ink: 'indigo' }), line(600, 640, R, 400, { ink: 'dense' }), line(800, 640, UP, 120, { ink: 'dense' })],
        words: [{ after: 3, text: 'an island comes out of the mist once every seven years' }, { after: 4, text: 'the king holds court there for one day and then it\'s gone again' }],
        marks: { 0: ['ArrowLeft'], 2: ['ArrowUp'] },
        answers: ['the island in the mist', 'the king\'s court', 'one day every seven years', 'the mist'],
      },
      {
        dream: 'a captain rowing for its harbour', start: { more: 'island' }, offer: 'next',
        strokes: [line(250, 790, R, 220, { ink: 'dense' }), line(360, 785, UP, 140), dot(900, 560, 'gold', 800)],
        words: [{ after: 2, text: 'a captain rows for the island' }, { after: 3, text: 'he can see a harbour light but the mist closes before he gets there' }],
        marks: { 0: ['ArrowRight'], 2: ['ArrowDown'] },
        answers: ['the captain', 'the harbour light', 'the mist closes'],
        ending: { strokes: [line(100, 600, R, 1400, { ink: 'light', ease: true })], words: [{ after: 1, text: 'the mist closes, he\'ll have to wait seven years' }], marks: { 0: ['ArrowDown', 'ArrowLeft'] } },
      },
      {
        dream: 'the day it comes back', start: { wonder: { about: 'island', choose: 0 } }, offer: 'end',
        strokes: [ring(1300, 350, { ink: 'gold' })],
        words: [{ after: 1, text: 'this is the day it comes back, everyone on the cliffs is watching' }],
        marks: { 0: ['ArrowUp', 'ArrowRight'] },
        answers: ['the day it comes back', 'everyone watching'],
      },
    ],
  },
  {
    id: 'atlantis', name: 'Atlantis, the city of rings', seal: 'Sun',
    idea: 'A city of alternating rings of land and water around a temple hill, bridged, with a canal out to the sea.',
    source: { name: 'Plato, Critias: Atlantis', url: 'https://exhibits.lib.lehigh.edu/exhibits/show/imaginary-places/ancient-history/atlantis' },
    nights: [
      {
        dream: 'rings of water and land, a gold temple, a canal', offer: 'inside',
        strokes: [ring(800, 800, { ink: 'indigo', ease: true }), ring(800, 737, { ink: 'dense' }), dot(800, 675, 'gold', 900), line(800, 810, DOWN, 150, { ink: 'indigo' })],
        words: [{ after: 2, text: 'a city in rings, water then land then water' }, { after: 4, text: 'a canal cuts out to the sea, and the temple is gold in the middle' }],
        marks: { 0: ['ArrowUp'], 2: ['ArrowUp', 'ArrowRight'] },
        answers: ['the ring city', 'rings of water and land', 'the gold temple', 'the canal'],
      },
      {
        dream: 'ships coming in, red stone bridges', start: { more: 'ring' }, offer: 'next',
        strokes: [line(300, 500, R, 200, { ink: 'dense' }), line(400, 500, UP, 120), line(1100, 540, R, 180, { ink: 'cinnabar' })],
        words: [{ after: 2, text: 'ships sail right into the middle through the canal' }, { after: 3, text: 'the bridges are red stone' }],
        marks: { 0: ['ArrowRight'] },
        answers: ['the ships', 'the red stone bridges', 'the canal'],
        ending: { strokes: [wave(100, 950, 1400, { ink: 'indigo' })], words: [{ after: 1, text: 'the sea starts to rise, slowly, and nobody believes it' }], marks: { 0: ['ArrowDown', 'ArrowRight'] } },
      },
      {
        dream: 'the racecourse on the middle ring', start: { wonder: { about: 'ring', choose: 0 } }, offer: 'end',
        strokes: [ring(1250, 500, { ink: 'light' }), dot(1250, 440, 'cinnabar', 600)],
        words: [{ after: 2, text: 'on the middle ring there\'s a racecourse, the horses run all night' }],
        marks: { 0: ['ArrowRight'], 1: ['ArrowRight', 'ArrowUp'] },
        answers: ['the racecourse', 'the horses'],
      },
    ],
  },
  {
    id: 'laputa', name: 'Laputa, the flying island', seal: 'Moon',
    idea: 'An island that flies over the land below, steered by a great lodestone, its court lost in the stars and in music.',
    source: { name: 'Jonathan Swift, Gulliver\'s Travels (1726): Laputa', url: 'https://en.wikipedia.org/wiki/Laputa' },
    nights: [
      {
        dream: 'the island over the land, and its magnet stone', offer: 'inside',
        strokes: [line(450, 350, R, 700, { ink: 'dense' }), line(500, 360, DR, 300), line(1100, 360, DL, 300), line(100, 900, R, 1400, { ink: 'light', ease: true }), dot(800, 480, 'dense', 900)],
        words: [{ after: 3, text: 'an island flying over the land, flat on top and pointed underneath' }, { after: 5, text: 'a giant magnet stone in the middle steers it' }],
        marks: { 0: ['ArrowUp'], 4: ['ArrowRight'] },
        answers: ['the flying island', 'the magnet stone', 'the land below', 'its flat top'],
      },
      {
        dream: 'the astronomers, and a rope let down', start: { more: 'island' }, offer: 'next',
        strokes: [line(700, 330, UP, 200, { ink: 'dense' }), ring(780, 180, { ink: 'light' })],
        words: [{ after: 2, text: 'the astronomers spend all night looking at the stars and forget the people below' }],
        marks: { 1: ['ArrowUp'] },
        answers: ['the astronomers', 'their telescope', 'the people below'],
        ending: { strokes: [line(800, 560, DOWN, 250, { ink: 'cinnabar' })], words: [{ after: 1, text: 'a girl from the island lets down a rope to the town below' }], marks: { 0: ['ArrowUp', 'ArrowRight'] } },
      },
      {
        dream: 'the town below waving lanterns', start: { wonder: { about: 'island', choose: 0 } }, offer: 'end',
        strokes: [line(300, 850, UP, 150, { ink: 'dense' }), line(1300, 850, UP, 200), dot(1300, 640, 'gold', 700)],
        words: [{ after: 3, text: 'the town below waves lanterns when the island passes over' }],
        marks: { 2: ['ArrowUp'] },
        answers: ['the town below', 'lanterns', 'waving at the island'],
      },
    ],
  },
  {
    id: 'babel', name: 'The Library of Babel', seal: 'Leaf',
    idea: 'A library of endless galleries round an air shaft, floors without end above and below, holding every possible book.',
    source: { name: 'Jorge Luis Borges, The Library of Babel (1941)', url: 'https://web.stanford.edu/class/history34q/readings/textualizingscience/library_of_babel.html' },
    nights: [
      {
        dream: 'shelves without end, a shaft through the middle', offer: 'inside',
        strokes: [line(300, 300, R, 1000, { ink: 'dense', ease: true }), line(300, 500, R, 1000, { ink: 'dense', ease: true }), line(300, 700, R, 1000, { ink: 'dense', ease: true }), line(800, 100, DOWN, 800, { ink: 'light', ease: true }), dot(800, 880, 'gold', 800)],
        words: [{ after: 3, text: 'shelves and shelves, a library that never ends' }, { after: 5, text: 'a shaft goes down through the middle and you can see floors forever up and down' }],
        marks: { 0: ['ArrowLeft'], 3: ['ArrowDown'] },
        answers: ['the endless library', 'the shelves', 'the shaft in the middle', 'the lamp'],
      },
      {
        dream: 'a librarian finds her own name', start: { more: 'library' }, offer: 'next',
        strokes: [line(500, 500, UP, 120, { ink: 'cinnabar' }), dot(560, 400, 'gold', 700)],
        words: [{ after: 2, text: 'a librarian finds a book with her own name in it' }],
        marks: { 1: ['ArrowUp', 'ArrowRight'] },
        answers: ['the librarian', 'the book with her name', 'her own story'],
        ending: { strokes: [line(560, 420, UP, 250, { ink: 'gold' })], words: [{ after: 1, text: 'she climbs up the shaft to find the next page' }], marks: { 0: ['ArrowUp'] } },
      },
      {
        dream: 'the mirror at the end of the hall', start: { wonder: { about: 'library', choose: 0 } }, offer: 'end',
        strokes: [ring(1200, 650, { ink: 'light' })],
        words: [{ after: 1, text: 'a mirror at the end of the hall. some say it means the library ends, i think it means it doesn\'t' }],
        marks: { 0: ['ArrowLeft'] },
        answers: ['the mirror', 'the library never ends'],
      },
      // nights 4 on: the same reader, coming back to it (KEEP=1, NIGHTS=…)
      {
        dream: 'the gallery of nonsense books, and one true line', offer: 'end',
        strokes: [line(250, 650, R, 1100, { ink: 'dense', ease: true }), line(350, 640, UP, 90, { ink: 'dense' }), line(420, 640, UP, 90), line(490, 640, UP, 90), line(560, 640, UP, 90), line(630, 640, UP, 90), dot(1000, 600, 'gold', 800)],
        words: [{ after: 6, text: 'row after row of books, every page letters that mean nothing' }, { after: 7, text: 'then one page with a single true sentence on it' }],
        marks: { 0: ['ArrowLeft'], 6: ['ArrowUp'] },
        answers: ['the books of nonsense', 'the letters that mean nothing', 'the one true sentence', 'a gallery of books'],
      },
      {
        dream: 'the librarian on the stairs round the shaft', start: { more: 'librarian' }, offer: 'next',
        strokes: [ring(800, 500, { ink: 'light', ease: true }), line(800, 380, UP, 60, { ink: 'cinnabar' }), dot(800, 250, 'gold', 600)],
        words: [{ after: 2, text: 'she is still climbing, the stairs go round and round the shaft' }, { after: 3, text: 'someone has left a lamp on the landing for her' }],
        marks: { 1: ['ArrowUp', 'ArrowRight'] },
        answers: ['the librarian', 'the spiral stairs', 'the lamp on the landing', 'someone left it for her'],
        ending: { strokes: [line(700, 200, R, 200, { ink: 'dense' })], words: [{ after: 1, text: 'at the top there is just another floor, exactly like hers' }], marks: { 0: ['ArrowDown'] } },
      },
      {
        dream: 'the burners going through the halls', offer: 'end', react: { 1: 'no' },
        strokes: [line(200, 800, R, 1200, { ink: 'dense', ease: true }), line(500, 780, UP, 150, { ink: 'cinnabar' }), line(560, 780, UP, 200), line(620, 780, UP, 130), line(900, 780, UP, 160, { ink: 'dense' }), line(960, 780, UP, 170)],
        words: [{ after: 4, text: 'men who think most books are useless go through the halls burning them' }, { after: 6, text: 'they think they are making the library better' }],
        marks: { 1: ['ArrowDown', 'ArrowRight'], 2: ['ArrowDown', 'ArrowRight'], 4: ['ArrowDown'] },
        answers: ['the burners', 'the burning books', 'they think they are helping'],
      },
      {
        dream: 'someone in the mirror', start: { wonder: { about: 'mirror', choose: 'own' } }, offer: 'end',
        strokes: [ring(1200, 650, { ink: 'light' }), line(1200, 640, UP, 90, { ink: 'cinnabar' })],
        words: [{ after: 2, text: 'in the mirror there is another librarian, she waves back a moment too late' }],
        marks: { 1: ['ArrowRight'] },
        answers: ['the librarian in the mirror', 'she waves too late', 'another librarian'],
      },
      {
        dream: 'the man of the book', offer: 'inside',
        strokes: [line(300, 300, R, 1000, { ink: 'dense', ease: true }), line(300, 700, R, 1000, { ink: 'dense', ease: true }), ring(800, 500, { ink: 'gold' }), line(800, 640, UP, 110, { ink: 'dense' })],
        words: [{ after: 3, text: 'somewhere there is a book that is the catalogue of all the others' }, { after: 4, text: 'one librarian read it once, people call him the man of the book, everyone is looking for him' }],
        marks: { 2: ['ArrowUp'], 3: ['ArrowRight'] },
        answers: ['the catalogue of all the books', 'the man of the book', 'everyone is looking for him', 'the gold book'],
      },
      {
        dream: 'she finds the man of the book', start: { more: 'librarian' }, offer: 'next',
        strokes: [line(600, 700, UP, 120, { ink: 'cinnabar' }), line(760, 700, UP, 160, { ink: 'dense' }), dot(680, 600, 'gold', 600)],
        words: [{ after: 2, text: 'she finds the man of the book at last, he is very old' }, { after: 3, text: 'he has forgotten what the catalogue said' }],
        marks: { 1: ['ArrowDown'], 2: ['ArrowUp'] },
        answers: ['the librarian', 'the man of the book', 'he forgot', 'one page'],
        ending: { strokes: [line(680, 590, UP, 150, { ink: 'gold' })], words: [{ after: 1, text: 'he gives her one page he kept from it' }], marks: { 0: ['ArrowUp'] } },
      },
      {
        dream: 'the page with one sentence', offer: 'end',
        strokes: [line(600, 400, R, 400, { ink: 'light' }), line(600, 600, R, 400), line(600, 400, DOWN, 200), line(1000, 400, DOWN, 200), line(650, 500, R, 250, { ink: 'dense' })],
        words: [{ after: 5, text: 'the page has only one sentence on it and the sentence is about her' }],
        marks: { 4: ['ArrowUp', 'ArrowRight'] },
        answers: ['the page', 'one sentence', 'about her'],
      },
      {
        dream: 'the burners come to her floor', offer: 'end', react: { 0: 'no' },
        strokes: [line(200, 800, R, 1200, { ink: 'dense', ease: true }), line(400, 780, UP, 180, { ink: 'cinnabar' }), line(460, 780, UP, 140), line(1000, 780, UP, 150), dot(1000, 700, 'gold', 400)],
        words: [{ after: 3, text: 'the burners come to her floor' }, { after: 5, text: 'she hides the page inside her coat' }],
        marks: { 1: ['ArrowDown', 'ArrowRight'], 2: ['ArrowDown', 'ArrowRight'] },
        answers: ['the burners', 'her floor', 'the hidden page', 'inside her coat'],
      },
      {
        dream: 'a bird in the shaft', start: { wonder: { about: 'shaft', choose: 0 } }, offer: 'end',
        strokes: [line(800, 900, UP, 800, { ink: 'light', ease: true }), line(780, 400, UR, 60, { ink: 'dense' }), line(822, 358, DR, 60)],
        words: [{ after: 3, text: 'a bird flies up the shaft and nobody knows how it got in' }],
        marks: { 1: ['ArrowUp'] },
        answers: ['the bird in the shaft', 'nobody knows how', 'flying up'],
      },
      {
        dream: 'the mirror: the same page, blank', start: { more: 'mirror' }, offer: 'next',
        strokes: [ring(1200, 650, { ink: 'light' }), line(1200, 640, UP, 90, { ink: 'cinnabar' }), dot(1230, 560, 'light', 400)],
        words: [{ after: 3, text: 'in the mirror the other librarian holds the same page but hers is blank' }],
        marks: { 2: ['ArrowLeft'] },
        answers: ['the mirror', 'the other librarian', 'the same page', 'hers is blank'],
        ending: { strokes: [line(1180, 560, R, 60, { ink: 'dense' })], words: [{ after: 1, text: 'she writes her own sentence on it' }], marks: { 0: ['ArrowUp'] } },
      },
      {
        dream: 'she climbs down for the first time', offer: 'inside',
        strokes: [line(800, 100, DOWN, 800, { ink: 'light', ease: true }), line(800, 500, DOWN, 100, { ink: 'cinnabar' }), dot(800, 880, 'gold', 800)],
        words: [{ after: 2, text: 'for the first time she climbs down the shaft instead of up' }, { after: 3, text: 'all the way to the lamp at the bottom' }],
        marks: { 1: ['ArrowRight'], 2: ['ArrowUp'] },
        answers: ['climbing down', 'the lamp at the bottom', 'the first time', 'the shaft'],
      },
      {
        dream: 'her sentence, already in a book', start: { more: 'page' }, offer: 'next',
        strokes: [line(600, 400, R, 400, { ink: 'light' }), line(600, 600, R, 400), line(650, 500, R, 250, { ink: 'dense' }), dot(1200, 500, 'gold', 600)],
        words: [{ after: 3, text: 'she reads the sentence she wrote' }, { after: 4, text: 'and it is already in a book on another floor' }],
        marks: { 3: ['ArrowUp', 'ArrowRight'] },
        answers: ['her sentence', 'already in a book', 'another floor', 'the page'],
        ending: { strokes: [line(1250, 560, UP, 120, { ink: 'dense' })], words: [{ after: 1, text: 'someone she has never met is reading it right now' }], marks: { 0: ['ArrowRight'] } },
      },
      {
        dream: 'the burners at the mirror', offer: 'end', react: { 1: 'no' },
        strokes: [ring(1200, 650, { ink: 'light' }), line(1000, 780, UP, 160, { ink: 'cinnabar' }), line(1060, 780, UP, 200), line(900, 780, UP, 150, { ink: 'dense' })],
        words: [{ after: 3, text: 'the burners come to the mirror and want to break it' }, { after: 4, text: 'they say it makes the library look bigger than it is' }],
        marks: { 1: ['ArrowDown', 'ArrowRight'], 2: ['ArrowDown', 'ArrowRight'] },
        answers: ['the burners', 'the mirror', 'they want to break it', 'bigger than it is'],
      },
      {
        dream: 'the catalogue is missing a page', start: { wonder: { about: 'man of the book', choose: 0 } }, offer: 'end',
        strokes: [ring(800, 550, { ink: 'gold' }), line(860, 430, DR, 60, { ink: 'light' })],
        words: [{ after: 2, text: 'the catalogue is missing one page, the one he gave her' }],
        marks: { 1: ['ArrowDown'] },
        answers: ['the missing page', 'the catalogue', 'the one he gave her'],
      },
      {
        dream: 'the librarian in the mirror steps out', start: { more: 'mirror' }, offer: 'end',
        strokes: [ring(1200, 650, { ink: 'light' }), line(1000, 700, UP, 110, { ink: 'cinnabar' })],
        words: [{ after: 2, text: 'the librarian in the mirror steps out into the hall, she is the same as her but left handed' }],
        marks: { 1: ['ArrowUp', 'ArrowRight'] },
        answers: ['the librarian from the mirror', 'she steps out', 'left handed', 'the same as her'],
      },
      {
        dream: 'the lamp at the bottom', start: { more: 'lamp' }, offer: 'end',
        strokes: [line(800, 100, DOWN, 750, { ink: 'light', ease: true }), dot(800, 880, 'gold', 1400), dot(800, 880, 'cinnabar', 400)],
        words: [{ after: 3, text: 'the lamp at the bottom is not a lamp, it is a page on fire that never burns up' }],
        marks: { 1: ['ArrowUp'], 2: ['ArrowRight'] },
        answers: ['the lamp', 'a page on fire', 'it never burns up', 'the bottom of the shaft'],
      },
      {
        dream: 'the two of them carry the page down', offer: 'inside',
        strokes: [line(800, 100, DOWN, 750, { ink: 'light', ease: true }), line(770, 520, DOWN, 100, { ink: 'cinnabar' }), line(830, 520, DOWN, 100), dot(800, 650, 'gold', 500), dot(800, 880, 'gold', 900)],
        words: [{ after: 4, text: 'the two librarians carry the page down the shaft together' }, { after: 5, text: 'to put it back where it belongs, at the bottom, with the light' }],
        marks: { 1: ['ArrowUp'], 4: ['ArrowUp', 'ArrowLeft'] },
        answers: ['the two librarians', 'carrying the page down', 'where it belongs', 'the light at the bottom'],
      },
      {
        dream: 'the shaft lit all the way up', start: { more: 'shaft' }, offer: 'end',
        strokes: [line(800, 880, UP, 780, { ink: 'gold', ease: true }), line(300, 300, R, 1000, { ink: 'dense', ease: true }), line(300, 700, R, 1000, { ink: 'dense', ease: true })],
        words: [{ after: 1, text: 'with the page back at the bottom the shaft is lit all the way up' }, { after: 3, text: 'every floor can see every other floor now' }],
        marks: { 0: ['ArrowUp', 'ArrowRight'] },
        answers: ['the shaft lit up', 'every floor', 'the page at the bottom'],
      },
      {
        dream: 'a new reader', offer: 'inside',
        strokes: [line(300, 700, R, 1000, { ink: 'dense', ease: true }), line(500, 690, UP, 90, { ink: 'cinnabar' }), dot(560, 600, 'gold', 600)],
        words: [{ after: 3, text: 'a girl comes into the library for the first time and finds a book with her own name in it' }],
        marks: { 1: ['ArrowUp'], 2: ['ArrowUp', 'ArrowRight'] },
        answers: ['a new reader', 'the girl', 'a book with her name', 'the first time'],
      },
    ],
  },
  {
    id: 'walking-city', name: 'The Walking City', seal: 'Mountain',
    idea: 'A city of pods on long telescoping legs that roams the earth and stops where its people like the place.',
    source: { name: 'Ron Herron (Archigram), Walking City (1964)', url: 'https://cyberneticzoo.com/walking-machines/1964-walking-city-ron-herron-british/' },
    nights: [
      {
        dream: 'a city on long legs, walking', offer: 'inside',
        strokes: [ring(700, 450, { ink: 'dense', ease: true }), line(620, 470, DL, 300, { ink: 'dense' }), line(780, 470, DR, 300), line(700, 470, DOWN, 320), line(100, 900, R, 1400, { ink: 'light', ease: true }), dot(700, 330, 'gold', 800)],
        words: [{ after: 4, text: 'a whole city on long metal legs, walking' }, { after: 6, text: 'it walks until the people like a place and then it stops' }],
        marks: { 1: ['ArrowRight'], 3: ['ArrowRight'] },
        answers: ['the walking city', 'its legs', 'the people inside', 'where it stops'],
      },
      {
        dream: 'another walking city on the horizon', start: { more: 'city' }, offer: 'next',
        strokes: [ring(1250, 500, { ink: 'light' }), line(1250, 510, DOWN, 250, { ink: 'light' })],
        words: [{ after: 2, text: 'another walking city on the horizon, they meet once a year to trade' }],
        marks: { 0: ['ArrowUp'] },
        answers: ['the other city', 'they meet to trade', 'once a year'],
        ending: { strokes: [line(800, 420, R, 350, { ink: 'gold' })], words: [{ after: 1, text: 'they reach out a bridge and people cross for the festival' }], marks: { 0: ['ArrowUp', 'ArrowRight'] } },
      },
      {
        dream: 'wading into the sea', start: { wonder: { about: 'city', choose: 0 } }, offer: 'end',
        strokes: [wave(100, 940, 1400, { ink: 'indigo' })],
        words: [{ after: 1, text: 'the city wades out into the sea for the first time' }],
        marks: { 0: ['ArrowRight', 'ArrowDown'] },
        answers: ['the sea', 'the first time'],
      },
    ],
  },
  {
    id: 'baba-yaga', name: 'The hut on chicken legs', seal: 'Leaf',
    idea: 'A hut deep in the forest that stands on chicken legs and turns its back on travellers until they say the right words.',
    source: { name: 'Slavic folklore: Baba Yaga\'s hut', url: 'https://en.wikipedia.org/wiki/Baba_Yaga' },
    nights: [
      {
        dream: 'the hut on its legs, its back turned', offer: 'inside',
        strokes: [line(700, 500, R, 250, { ink: 'dense' }), line(700, 500, UP, 220), line(950, 500, UP, 220), line(680, 280, R, 290), line(760, 510, DOWN, 250, { ink: 'dense' }), line(890, 510, DOWN, 250)],
        words: [{ after: 4, text: 'a hut deep in the woods' }, { after: 6, text: 'it stands on chicken legs and turns its back on you until you say the words' }],
        marks: { 4: ['ArrowRight'], 5: ['ArrowRight'] },
        answers: ['the hut on chicken legs', 'the woods', 'the words that turn it', 'its door'],
      },
      {
        dream: 'a light in the window; a girl with a question', start: { more: 'hut' }, offer: 'next',
        strokes: [line(300, 900, UP, 500, { ink: 'dense' }), line(1300, 900, UP, 550), dot(825, 400, 'gold', 900)],
        words: [{ after: 3, text: 'someone lit a light inside, she\'s home' }],
        marks: { 2: ['ArrowRight'] },
        answers: ['the light in the window', 'she is home', 'the old woman'],
        ending: { strokes: [line(500, 880, R, 300, { ink: 'cinnabar' })], words: [{ after: 1, text: 'a girl comes with a question and the hut turns its door to her' }], marks: { 0: ['ArrowUp'] } },
      },
      {
        dream: 'its footprints in the night', start: { wonder: { about: 'hut', choose: 0 } }, offer: 'end',
        strokes: [line(150, 950, R, 1300, { ink: 'light', ease: true })],
        words: [{ after: 1, text: 'the hut walks off in the night, you can follow its footprints' }],
        marks: { 0: ['ArrowRight'] },
        answers: ['the footprints', 'it walks at night'],
      },
    ],
  },
  {
    id: 'world-turtle', name: 'The world on the turtle\'s back', seal: 'Fish',
    idea: 'The land rides on the back of a great turtle swimming in the dark sea; in one telling, a woman dances on its shell and the land grows.',
    source: { name: 'The World Turtle in myth (Haudenosaunee, Hindu, Chinese)', url: 'https://en.wikipedia.org/wiki/World_Turtle' },
    nights: [
      {
        dream: 'the turtle swimming, the land and a tree on its back', offer: 'inside',
        strokes: [ring(800, 800, { ink: 'dense', ease: true }), line(920, 700, R, 200, { ink: 'dense' }), line(700, 790, DL, 120), line(900, 790, DR, 120), line(650, 600, R, 300, { ink: 'light' }), line(800, 590, UP, 150, { ink: 'dense' })],
        words: [{ after: 4, text: 'a giant turtle swimming in the dark sea' }, { after: 6, text: 'the whole land is on its back, with a tree and people' }],
        marks: { 0: ['ArrowLeft'], 5: ['ArrowUp'] },
        answers: ['the world turtle', 'the land on its back', 'the tree', 'the dark sea'],
      },
      {
        dream: 'swimming toward one star', start: { more: 'turtle' }, offer: 'next',
        strokes: [wave(100, 950, 1400, { ink: 'indigo' }), dot(1300, 300, 'gold', 900)],
        words: [{ after: 2, text: 'it swims toward one star, nobody knows why' }],
        marks: { 1: ['ArrowUp'] },
        answers: ['the star it swims to', 'the sea', 'nobody knows why'],
        ending: { strokes: [line(1050, 650, UR, 300, { ink: 'gold' })], words: [{ after: 1, text: 'a path of light from the star to its head, it\'s following' }], marks: { 0: ['ArrowUp', 'ArrowRight'] } },
      },
      {
        dream: 'a woman dancing on its shell', start: { wonder: { about: 'turtle', choose: 0 } }, offer: 'end',
        strokes: [line(700, 580, R, 80, { ink: 'cinnabar' }), dot(740, 560, 'cinnabar', 500)],
        words: [{ after: 2, text: 'a woman dances on its shell and the land grows wider' }],
        marks: { 0: ['ArrowUp', 'ArrowRight'] },
        answers: ['the dancing woman', 'the land grows'],
      },
    ],
  },
  {
    id: 'yggdrasil', name: 'The world tree', seal: 'Leaf',
    idea: 'A vast tree whose branches and roots hold all the worlds, rising from a well where it is watered.',
    source: { name: 'Norse cosmology: Yggdrasil and the Well of Urd', url: 'https://norse-mythology.org/cosmology/yggdrasil-and-the-well-of-urd' },
    nights: [
      {
        dream: 'the great tree, its branches, the well at its roots', offer: 'inside',
        strokes: [line(800, 850, UP, 650, { ink: 'dense', ease: true }), line(800, 400, UL, 350), line(800, 400, UR, 350), line(800, 860, DL, 120), line(800, 860, DR, 120), dot(800, 930, 'water', 900)],
        words: [{ after: 3, text: 'a tree so big the worlds hang in its branches' }, { after: 6, text: 'a well at its roots where three women water it' }],
        marks: { 0: ['ArrowUp'], 5: ['ArrowLeft'] },
        answers: ['the world tree', 'its branches', 'the well at the roots', 'the worlds in the branches'],
      },
      {
        dream: 'two worlds in the branches, and a messenger', start: { more: 'tree' }, offer: 'next',
        strokes: [ring(560, 180, { ink: 'gold' }), ring(1040, 180, { ink: 'indigo' })],
        words: [{ after: 2, text: 'two worlds in the branches, one gold and one blue' }],
        marks: { 0: ['ArrowUp'], 1: ['ArrowLeft'] },
        answers: ['the gold world', 'the blue world', 'worlds in the branches'],
        ending: { strokes: [line(560, 250, R, 480, { ink: 'cinnabar' })], words: [{ after: 1, text: 'a squirrel runs between them carrying messages' }], marks: { 0: ['ArrowRight', 'ArrowUp'] } },
      },
      {
        dream: 'a serpent at the roots', start: { wonder: { about: 'tree', choose: 0 } }, offer: 'end',
        strokes: [wave(200, 960, 1200, { ink: 'dense' })],
        words: [{ after: 1, text: 'a serpent gnaws the roots, the tree knows' }],
        marks: { 0: ['ArrowDown', 'ArrowRight'] },
        answers: ['the serpent at the roots', 'the tree knows'],
      },
    ],
  },
  {
    id: 'moon-rabbit', name: 'The rabbit on the moon', seal: 'Moon', young: true,
    idea: 'A rabbit lives on the moon, pounding an elixir (or rice cakes) with a mortar and pestle, friend of the moon lady.',
    source: { name: 'East Asian folklore: the Moon rabbit (Jade Rabbit)', url: 'https://en.wikipedia.org/wiki/Moon_rabbit' },
    nights: [
      {
        dream: 'a bunny on the moon making medicine', offer: 'inside',
        strokes: [ring(800, 560, { ink: 'dense', ease: true }), line(780, 420, UP, 100, { ink: 'dense' }), line(820, 420, UP, 100), dot(800, 440, 'dense', 600), line(850, 450, DOWN, 60, { ink: 'light' })],
        words: [{ after: 3, text: 'there\'s a bunny on the moon' }, { after: 5, text: 'he makes medicine with a big stick in a bowl' }],
        marks: { 0: ['ArrowUp'], 2: ['ArrowUp', 'ArrowRight'] },
        answers: ['the moon bunny', 'the moon', 'his medicine', 'the big stick and bowl'],
      },
      {
        dream: 'the moon lady and a ladder of light', start: { more: 'bunny' }, offer: 'next',
        strokes: [line(300, 850, UP, 200, { ink: 'cinnabar' }), line(500, 800, UR, 400, { ink: 'gold' })],
        words: [{ after: 1, text: 'a lady lives on the moon too, she is his friend' }, { after: 2, text: 'there\'s a ladder of light to come visit' }],
        marks: { 1: ['ArrowUp'] },
        answers: ['the moon lady', 'the ladder of light', 'his friend'],
        ending: { strokes: [dot(850, 380, 'gold', 800)], words: [{ after: 1, text: 'they make rice cakes and share them' }], marks: { 0: ['ArrowUp'] } },
      },
      {
        dream: 'looking at our house', start: { wonder: { about: 'moon', choose: 0 } }, offer: 'end',
        strokes: [ring(250, 250, { ink: 'light' })],
        words: [{ after: 1, text: 'the bunny looks at our house from up there' }],
        marks: { 0: ['ArrowUp'] },
        answers: ['our house', 'the earth'],
      },
    ],
  },
  {
    id: 'glass-town', name: 'Glass Town', seal: 'Star', young: true,
    idea: 'Twelve toy soldiers come alive and build a city by the sea; the children who own them are its giants. A childhood world four siblings shared.',
    source: { name: 'The Brontë children\'s Glass Town (from 1826)', url: 'https://en.wikipedia.org/wiki/Glass_Town' },
    nights: [
      {
        dream: 'the toy soldiers and their glass city', offer: 'inside',
        strokes: [line(400, 700, UP, 250, { ink: 'dense' }), line(500, 700, UP, 250), line(600, 700, UP, 250), line(700, 700, UP, 250), line(300, 710, R, 1000, { ink: 'light', ease: true }), line(1100, 700, UP, 400, { ink: 'gold' })],
        words: [{ after: 4, text: 'twelve toy soldiers came alive' }, { after: 6, text: 'they built a city of glass by the sea and it sparkles' }],
        marks: { 0: ['ArrowRight'], 5: ['ArrowUp'] },
        answers: ['the twelve soldiers', 'the glass city', 'the glass tower', 'by the sea'],
      },
      {
        dream: 'the soldiers sail away', start: { more: 'glass' }, offer: 'next',
        strokes: [wave(100, 850, 1400, { ink: 'indigo' }), line(400, 800, R, 200, { ink: 'dense' })],
        words: [{ after: 2, text: 'the soldiers sail away to find a new land' }],
        marks: { 1: ['ArrowRight'] },
        answers: ['the soldiers ship', 'a new land'],
        ending: { strokes: [line(1200, 450, UP, 200, { ink: 'cinnabar' })], words: [{ after: 1, text: 'but the giant children who made them can bring them back any time' }], marks: { 0: ['ArrowUp', 'ArrowRight'] } },
      },
      {
        dream: 'a newspaper too small to read', start: { wonder: { about: 'glass', choose: 0 } }, offer: 'end',
        strokes: [line(500, 300, R, 300, { ink: 'dense' }), dot(650, 260, 'dense', 500)],
        words: [{ after: 2, text: 'the soldiers print a newspaper so small only they can read it' }],
        marks: { 0: ['ArrowUp'] },
        answers: ['the tiny newspaper', 'only they can read it'],
      },
    ],
  },
  {
    id: 'ejuxria', name: 'Ejuxria, a boy\'s country', seal: 'Wave', young: true,
    idea: 'A country a boy invented, full of nations with their own kings, where a hidden river surfaces and builds an island.',
    source: { name: 'Hartley Coleridge\'s childhood country Ejuxria (from 1806)', url: 'https://en.wikipedia.org/wiki/Paracosm' },
    nights: [
      {
        dream: 'a secret river under my country', offer: 'inside',
        strokes: [line(100, 500, R, 1400, { ink: 'light', ease: true }), line(300, 700, R, 800, { ink: 'water' }), line(1100, 700, UR, 280, { ink: 'indigo' }), dot(1300, 480, 'indigo', 900)],
        words: [{ after: 3, text: 'a river runs under my country where nobody can see it' }, { after: 4, text: 'then it pops up out of the ground here' }],
        marks: { 1: ['ArrowLeft'], 3: ['ArrowUp', 'ArrowRight'] },
        answers: ['the secret river', 'my country', 'where it comes up', 'the spring'],
      },
      {
        dream: 'the river makes an island', start: { more: 'river' }, offer: 'next',
        strokes: [wave(1150, 600, 300, { ink: 'indigo' }), ring(1350, 900, { ink: 'dense' })],
        words: [{ after: 2, text: 'the river builds an island at the end, it\'s getting bigger' }],
        marks: { 1: ['ArrowUp'] },
        answers: ['the new island', 'it gets bigger', 'the river'],
        ending: { strokes: [line(1300, 800, UP, 100, { ink: 'cinnabar' })], words: [{ after: 1, text: 'i put my flag on it, it\'s my island now' }], marks: { 0: ['ArrowUp', 'ArrowRight'] } },
      },
      {
        dream: 'all the kings', start: { wonder: { about: 'island', choose: 0 } }, offer: 'end',
        strokes: [line(400, 480, UP, 120, { ink: 'dense' }), line(500, 480, UP, 150), line(600, 480, UP, 100)],
        words: [{ after: 3, text: 'lots of countries live in my country and they all have kings' }],
        marks: { 0: ['ArrowRight'] },
        answers: ['the other countries', 'the kings'],
      },
    ],
  },
  {
    id: 'twilight-ring', name: 'The twilight ring', seal: 'Sun',
    idea: 'A planet that always shows the same face to its sun: people live on the thin ring between burning day and frozen night.',
    source: { name: 'Terminator habitability on tidally locked planets', url: 'https://earthsky.org/space/terminator-zone-life-on-exoplanets/' },
    nights: [
      {
        dream: 'the line between day and night, a house on it', offer: 'inside',
        strokes: [line(100, 500, R, 1400, { ink: 'dense', ease: true }), dot(250, 200, 'gold', 1000), line(200, 700, R, 500, { ink: 'indigo' }), line(900, 490, UP, 150, { ink: 'dense' })],
        words: [{ after: 2, text: 'a world where the sun never moves, it just sits on the edge of the sky' }, { after: 4, text: 'people live on the thin line between burning day and frozen night' }],
        marks: { 0: ['ArrowLeft'], 1: ['ArrowUp'] },
        answers: ['the twilight line', 'the sun that never moves', 'the frozen night side', 'the houses on the line'],
      },
      {
        dream: 'the road round the world, and a caravan', start: { more: 'line' }, offer: 'next',
        strokes: [line(300, 520, R, 900, { ink: 'cinnabar', ease: true }), dot(1200, 520, 'gold', 700)],
        words: [{ after: 2, text: 'a road runs all the way around the world, the caravans never stop walking' }],
        marks: { 0: ['ArrowRight'] },
        answers: ['the road around the world', 'the caravans'],
        ending: { strokes: [line(1200, 540, DOWN, 300, { ink: 'indigo' })], words: [{ after: 1, text: 'one caravan walks into the night side to find out what\'s there' }], marks: { 0: ['ArrowDown', 'ArrowRight'] } },
      },
      {
        dream: 'a light far into the night side', start: { wonder: { about: 'night', choose: 0 } }, offer: 'end',
        strokes: [dot(800, 800, 'gold', 900)],
        words: [{ after: 1, text: 'a light, far into the night side, where nobody should live' }],
        marks: { 0: ['ArrowRight'] },
        answers: ['the light in the night', 'nobody should live there'],
      },
    ],
  },
  {
    id: 'skybeast', name: 'The city on the sky-beast', seal: 'Bird',
    idea: 'A city on the back of a vast flying creature, steered gently through towers on its spine; it may know its riders are there.',
    source: { name: 'Floating Realms art challenge, Adobe community (2025)', url: 'https://community.adobe.com/t5/adobe-firefly-discussions/weekly-challenge-quot-floating-realms-quot/m-p/15111167/highlight/true' },
    nights: [
      {
        dream: 'the beast flying, towers on its spine', offer: 'inside',
        strokes: [wave(200, 500, 1200, { ink: 'dense' }), line(500, 480, UP, 200, { ink: 'dense' }), line(800, 470, UP, 250), line(1100, 480, UP, 200), line(150, 800, R, 400, { ink: 'light' })],
        words: [{ after: 4, text: 'a huge creature flying through the sky with a city on its back' }, { after: 5, text: 'they steer it from towers on its spine, gently, they don\'t want to hurt it' }],
        marks: { 0: ['ArrowRight'], 2: ['ArrowLeft'] },
        answers: ['the sky beast', 'the city on its back', 'the spine towers', 'steering gently'],
      },
      {
        dream: 'its eye opens', start: { more: 'beast' }, offer: 'next',
        strokes: [dot(800, 210, 'gold', 800), line(1350, 520, R, 150, { ink: 'cinnabar' })],
        words: [{ after: 2, text: 'the beast opens its eye, it\'s awake and it knows we\'re here' }],
        marks: { 1: ['ArrowRight', 'ArrowDown'] },
        answers: ['its eye', 'it knows we are here', 'the tower light'],
        ending: { strokes: [line(1400, 500, DR, 250, { ink: 'gold' })], words: [{ after: 1, text: 'it turns toward the sunrise on its own and the steerers let it' }], marks: { 0: ['ArrowUp'] } },
      },
      {
        dream: 'another beast, flashing lights', start: { wonder: { about: 'beast', choose: 0 } }, offer: 'end',
        strokes: [ring(300, 300, { ink: 'light' })],
        words: [{ after: 1, text: 'another beast far away, its city is flashing lights at us' }],
        marks: { 0: ['ArrowUp', 'ArrowRight'] },
        answers: ['the other beast', 'flashing lights'],
      },
    ],
  },
  {
    id: 'sung-islands', name: 'The islands that are sung aloft', seal: 'Bird',
    idea: 'Islands that float only while they are sung to; the stone that answers the song may be failing.',
    source: { name: 'A worldbuilding thread on the Scratch forums', url: 'https://scratch.mit.edu/discuss/post/9278737/' },
    nights: [
      {
        dream: 'floating islands, and a singer', offer: 'inside',
        strokes: [line(300, 400, R, 300, { ink: 'dense' }), line(300, 410, DR, 150), line(900, 300, R, 350, { ink: 'dense' }), line(950, 310, DR, 150), line(100, 920, R, 1400, { ink: 'light', ease: true }), dot(1075, 270, 'gold', 800)],
        words: [{ after: 4, text: 'islands floating in the sky' }, { after: 6, text: 'they only stay up while someone sings to the stone under them' }],
        marks: { 0: ['ArrowUp'], 5: ['ArrowUp', 'ArrowRight'] },
        answers: ['the floating islands', 'the singing', 'the singing stone', 'the singer'],
      },
      {
        dream: 'an island sinking, its singer sick', start: { more: 'island' }, offer: 'next',
        strokes: [line(450, 420, DOWN, 200, { ink: 'cinnabar' })],
        words: [{ after: 1, text: 'one island\'s singer got sick and it\'s sinking' }],
        marks: { 0: ['ArrowDown'] },
        answers: ['the sinking island', 'its sick singer'],
        ending: { strokes: [dot(450, 560, 'gold', 900)], words: [{ after: 1, text: 'everyone on the other islands sings for it and it stops' }], marks: { 0: ['ArrowUp'] } },
      },
      {
        dream: 'a new singing stone', start: { wonder: { about: 'stone', choose: 0 } }, offer: 'end',
        strokes: [ring(800, 760, { ink: 'gold' })],
        words: [{ after: 1, text: 'a new singing stone was found in the sea, nobody knows its song' }],
        marks: { 0: ['ArrowUp', 'ArrowRight'] },
        answers: ['the new stone', 'its song'],
      },
    ],
  },
  {
    id: 'cloud-giants', name: 'The cloud giants\' islands', seal: 'Mountain',
    idea: 'Islands shaped from cloud by giants, which outlast the giants who made them.',
    source: { name: 'Cloud kingdoms brainstorm, EN World forums', url: 'https://www.enworld.org/threads/cloud-kingdoms-brainstorming.681833/' },
    nights: [
      {
        dream: 'an island of packed cloud, and the last giant', offer: 'inside',
        strokes: [wave(300, 350, 600, { ink: 'light' }), wave(300, 420, 600, { ink: 'light' }), line(1100, 600, UP, 350, { ink: 'dense' }), dot(1100, 220, 'dense', 800)],
        words: [{ after: 2, text: 'an island made of cloud, packed hard so you can walk on it' }, { after: 4, text: 'the giants who made it are gone but one is still here, old' }],
        marks: { 0: ['ArrowUp'], 2: ['ArrowDown'] },
        answers: ['the cloud island', 'the old giant', 'the giants who made it', 'packed cloud'],
      },
      {
        dream: 'cloud sheep, and rain', start: { more: 'cloud' }, offer: 'next',
        strokes: [line(500, 330, UP, 120, { ink: 'cinnabar' }), dot(650, 330, 'light', 700), dot(750, 330, 'light', 700)],
        words: [{ after: 3, text: 'people live here now, they herd cloud sheep' }],
        marks: { 1: ['ArrowUp'] },
        answers: ['the shepherd', 'cloud sheep', 'people live here now'],
        ending: { strokes: [line(300, 450, DOWN, 200, { ink: 'water' })], words: [{ after: 1, text: 'the island rains when it\'s sad, the giant is dying' }], marks: { 0: ['ArrowDown', 'ArrowLeft'] } },
      },
      {
        dream: 'the giant\'s last island', start: { wonder: { about: 'giant', choose: 0 } }, offer: 'end',
        strokes: [line(900, 700, R, 300, { ink: 'gold' })],
        words: [{ after: 1, text: 'the giant shapes one last island before he goes, a little one for the children' }],
        marks: { 0: ['ArrowUp'] },
        answers: ['the last island', 'for the children'],
      },
    ],
  },
  {
    id: 'desert-giants', name: 'The clans on the desert giants', seal: 'Sun',
    idea: 'Clans who live on the backs of huge beasts walking the desert, which remember where the water is hidden.',
    source: { name: 'Creating fictional worlds (worldbuilding prompts), Tita Costa', url: 'https://titacosta.substack.com/p/creating-fictional-worlds' },
    nights: [
      {
        dream: 'a giant walking the dunes, tents on its back', offer: 'inside',
        strokes: [line(100, 820, R, 1400, { ink: 'light', ease: true }), ring(600, 600, { ink: 'dense', ease: true }), line(550, 610, DOWN, 200, { ink: 'dense' }), line(650, 610, DOWN, 200), line(560, 340, R, 100, { ink: 'cinnabar' })],
        words: [{ after: 3, text: 'huge animals walk across the desert' }, { after: 5, text: 'families live in tents on their backs' }],
        marks: { 1: ['ArrowRight'], 4: ['ArrowUp'] },
        answers: ['the walking giants', 'the tents on its back', 'the desert', 'the families'],
      },
      {
        dream: 'the hidden water', start: { more: 'giant' }, offer: 'next',
        strokes: [dot(1200, 780, 'water', 900), line(1150, 790, R, 100, { ink: 'indigo' })],
        words: [{ after: 1, text: 'the giants remember where the water is hidden under the sand' }],
        marks: { 0: ['ArrowUp'] },
        answers: ['the hidden water', 'the giants remember'],
        ending: { strokes: [line(700, 700, R, 450, { ink: 'dense' })], words: [{ after: 1, text: 'they reach it on the festival day and everyone drinks and sings' }], marks: { 0: ['ArrowUp', 'ArrowRight'] } },
      },
      {
        dream: 'the giants kneel in a storm', start: { wonder: { about: 'water', choose: 0 } }, offer: 'end',
        strokes: [wave(100, 300, 1400, { ink: 'light' })],
        words: [{ after: 1, text: 'a storm is coming, the giants kneel down and the families hold on' }],
        marks: { 0: ['ArrowRight', 'ArrowDown'] },
        answers: ['the sandstorm', 'the giants kneel'],
      },
    ],
  },
  {
    id: 'sky-whales', name: 'The whales that carry towns', seal: 'Fish', young: true,
    idea: 'Whales that fly through the sky with little towns on their backs; on a clear day you could count dozens.',
    source: { name: 'Flying whales carrying cities, LEGO Ideas fan project', url: 'https://ideas.lego.com/projects/6274c83d-1f97-45e3-b6f7-da64b6832aab' },
    nights: [
      {
        dream: 'a whale flying, a town on its back', offer: 'inside',
        strokes: [ring(700, 560, { ink: 'indigo', ease: true }), line(820, 520, R, 250, { ink: 'indigo' }), line(620, 440, UP, 80, { ink: 'dense' }), line(680, 430, UP, 100), line(740, 440, UP, 80)],
        words: [{ after: 2, text: 'whales flying in the sky' }, { after: 5, text: 'with little towns on their backs' }],
        marks: { 0: ['ArrowUp'], 4: ['ArrowUp'] },
        answers: ['the sky whales', 'the towns on their backs', 'the whale', 'little houses'],
      },
      {
        dream: 'counting whales from my window', start: { more: 'whale' }, offer: 'next',
        strokes: [ring(1200, 350, { ink: 'light' }), ring(300, 300, { ink: 'light' })],
        words: [{ after: 2, text: 'lots of whales, i counted them from my window' }],
        marks: { 0: ['ArrowUp'] },
        answers: ['all the whales', 'counting them', 'my window'],
        ending: { strokes: [line(700, 600, DOWN, 300, { ink: 'water' })], words: [{ after: 1, text: 'the whale sprays and it rains on our garden' }], marks: { 0: ['ArrowUp', 'ArrowRight'] } },
      },
      {
        dream: 'whales asleep on the sea', start: { wonder: { about: 'whale', choose: 0 } }, offer: 'end',
        strokes: [line(500, 900, R, 400, { ink: 'gold' })],
        words: [{ after: 1, text: 'at night the whales come down and sleep on the sea' }],
        marks: { 0: ['ArrowLeft'] },
        answers: ['whales sleeping', 'on the sea'],
      },
      // nights 4 on: the same child, coming back to it (KEEP=1, NIGHTS=…)
      {
        dream: 'a baby whale with one little house', offer: 'end',
        strokes: [ring(900, 500, { ink: 'indigo' }), line(900, 372, UP, 45, { ink: 'dense' }), line(965, 470, R, 120, { ink: 'indigo' })],
        words: [{ after: 1, text: 'a baby whale' }, { after: 2, text: 'it has no town yet just one little house' }],
        marks: { 0: ['ArrowUp'] },
        answers: ['the baby whale', 'one little house', 'no town yet'],
      },
      {
        dream: 'a bridge between two whales', start: { more: 'whale' }, offer: 'next',
        strokes: [ring(400, 500, { ink: 'indigo' }), ring(1100, 500, { ink: 'indigo' }), line(470, 420, R, 560, { ink: 'dense' }), dot(700, 410, 'dense', 300)],
        words: [{ after: 3, text: 'there is a bridge from one whale to the other' }, { after: 4, text: 'the people walk across and wave at me' }],
        marks: { 2: ['ArrowRight'] },
        answers: ['the bridge', 'between the whales', 'the people waving', 'two whales'],
        ending: { strokes: [wave(470, 440, 560, { ink: 'dense' })], words: [{ after: 1, text: 'the bridge wobbles but nobody falls off' }], marks: { 0: ['ArrowRight', 'ArrowUp'] } },
      },
      {
        dream: 'a storm, and the whales hide in the clouds', offer: 'end', react: { 1: 'no' },
        strokes: [wave(150, 250, 1300, { ink: 'dense' }), line(700, 300, DR, 250, { ink: 'cinnabar' }), line(877, 477, DL, 150), ring(1100, 350, { ink: 'light' })],
        words: [{ after: 3, text: 'a big storm came with lightning' }, { after: 4, text: 'the whales went inside the clouds to hide' }],
        marks: { 1: ['ArrowDown', 'ArrowRight'], 2: ['ArrowDown', 'ArrowRight'] },
        answers: ['the storm', 'the lightning', 'hiding in the clouds'],
      },
      {
        dream: 'the whales sing at night', start: { wonder: { about: 'whale', choose: 0 } }, offer: 'end',
        strokes: [wave(300, 600, 900, { ink: 'light' }), dot(400, 550, 'gold', 500), dot(800, 520, 'gold', 500)],
        words: [{ after: 3, text: 'the whales sing at night and the stars come out to listen' }],
        marks: { 0: ['ArrowUp', 'ArrowLeft'] },
        answers: ['the whale song', 'the stars listen', 'singing at night'],
      },
      {
        dream: 'my birthday, the whales come down low', offer: 'inside',
        strokes: [ring(800, 400, { ink: 'indigo', ease: true }), dot(600, 750, 'gold', 600), dot(800, 780, 'gold', 600), dot(1000, 760, 'gold', 600), ring(1200, 650, { ink: 'indigo' })],
        words: [{ after: 4, text: 'on my birthday the whales came down low over the garden' }, { after: 5, text: 'the baby whale ate my cake' }],
        marks: { 0: ['ArrowUp'], 4: ['ArrowUp', 'ArrowRight'] },
        answers: ['my birthday', 'the whales came low', 'the baby whale', 'my cake'],
      },
      {
        dream: 'the baby whale gets a town', start: { more: 'baby whale' }, offer: 'next',
        strokes: [ring(900, 500, { ink: 'indigo' }), line(870, 372, UP, 40, { ink: 'dense' }), line(900, 372, UP, 55), line(930, 372, UP, 40)],
        words: [{ after: 4, text: 'the baby whale has a town now, three houses and a tiny school' }],
        marks: { 0: ['ArrowUp'], 3: ['ArrowUp'] },
        answers: ['the baby whale', 'its town', 'three houses', 'a tiny school'],
        ending: { strokes: [dot(900, 300, 'cinnabar', 500)], words: [{ after: 1, text: 'they put a red flag on top so the baby whale is proud' }], marks: { 0: ['ArrowUp'] } },
      },
      {
        dream: 'the big whale is sick', offer: 'end',
        strokes: [ring(800, 700, { ink: 'light', ease: true }), line(500, 900, R, 600, { ink: 'dense' }), line(780, 560, DOWN, 60, { ink: 'water' })],
        words: [{ after: 2, text: 'the big whale is sick and cant fly high' }, { after: 3, text: 'it flies very low over the houses and it is crying' }],
        marks: { 0: ['ArrowDown', 'ArrowLeft'], 2: ['ArrowDown'] },
        answers: ['the sick whale', 'flying very low', 'it is crying', 'the flying whale'],
      },
      {
        dream: 'the whale doctor', offer: 'next',
        strokes: [line(1100, 900, UP, 350, { ink: 'light' }), line(1120, 560, UP, 80, { ink: 'dense' }), dot(1000, 520, 'cinnabar', 500)],
        words: [{ after: 2, text: 'a whale doctor climbs up a very long ladder' }, { after: 3, text: 'and gives the whale medicine made of clouds' }],
        marks: { 1: ['ArrowUp'], 2: ['ArrowUp', 'ArrowRight'] },
        answers: ['the whale doctor', 'the long ladder', 'medicine made of clouds'],
        ending: { strokes: [ring(700, 350, { ink: 'indigo', ease: true })], words: [{ after: 1, text: 'the whale feels better and flies up high again' }], marks: { 0: ['ArrowUp', 'ArrowRight'] } },
      },
      {
        dream: 'baby whales under the sea', start: { wonder: { about: 'flying whale', choose: 0 } }, offer: 'end',
        strokes: [wave(200, 850, 1200, { ink: 'water' }), dot(500, 700, 'gold', 500)],
        words: [{ after: 2, text: 'under the sea there are whale babies that will fly one day' }],
        marks: { 1: ['ArrowUp'] },
        answers: ['sea babies', 'they will fly one day', 'under the sea'],
      },
      {
        dream: 'riding the whale to the moon', offer: 'inside',
        strokes: [ring(1250, 300, { ink: 'gold' }), ring(600, 600, { ink: 'indigo', ease: true }), line(600, 345, UP, 40, { ink: 'dense' })],
        words: [{ after: 2, text: 'at night i ride on the whale all the way to the moon' }, { after: 3, text: 'and back before my mum wakes up' }],
        marks: { 0: ['ArrowUp'], 2: ['ArrowUp', 'ArrowRight'] },
        answers: ['riding the whale', 'the moon', 'me on top', 'before mum wakes up'],
      },
      {
        dream: 'the whales and the stars sing together', offer: 'end', react: { 1: 'no' },
        strokes: [wave(150, 600, 1300, { ink: 'light' }), dot(300, 300, 'gold', 400), dot(600, 250, 'gold', 400), dot(900, 280, 'gold', 400), dot(1200, 240, 'gold', 400)],
        words: [{ after: 5, text: 'all the whales sing together and the stars sing too and it sounds like bells' }],
        marks: { 0: ['ArrowUp'], 4: ['ArrowUp', 'ArrowRight'] },
        answers: ['everyone singing', 'the whales and the stars', 'sounds like bells'],
      },
      {
        dream: 'the whale school', start: { more: 'baby whale' }, offer: 'end',
        strokes: [ring(400, 500, { ink: 'indigo' }), ring(700, 450, { ink: 'indigo' }), ring(1000, 500, { ink: 'indigo' }), wave(300, 700, 900, { ink: 'light' })],
        words: [{ after: 4, text: 'at the whale school the baby whales learn to fly in circles' }],
        marks: { 3: ['ArrowUp', 'ArrowRight'] },
        answers: ['the whale school', 'flying in circles', 'the baby whales'],
      },
      {
        dream: 'the baby whale lost in the fog', offer: 'next',
        strokes: [line(200, 400, R, 1200, { ink: 'light', ease: true }), line(200, 500, R, 1200, { ink: 'light', ease: true }), ring(900, 520, { ink: 'indigo' })],
        words: [{ after: 3, text: 'the baby whale got lost in the fog and couldnt find its mum' }],
        marks: { 2: ['ArrowDown', 'ArrowRight'] },
        answers: ['the fog', 'the baby whale is lost', 'its mum'],
        ending: { strokes: [line(300, 900, UR, 400, { ink: 'gold' })], words: [{ after: 1, text: 'i shine my torch from my window and it finds the way home' }], marks: { 0: ['ArrowUp'] } },
      },
      {
        dream: 'the whales go south for winter', start: { wonder: { about: 'baby whale', choose: 0 } }, offer: 'end',
        strokes: [wave(150, 300, 1300, { ink: 'light' }), ring(500, 650, { ink: 'indigo' }), ring(800, 680, { ink: 'indigo' })],
        words: [{ after: 3, text: 'in winter the whales fly south where it is warm and come back in spring' }],
        marks: { 0: ['ArrowLeft'], 2: ['ArrowUp'] },
        answers: ['winter', 'flying south', 'coming back in spring'],
      },
      {
        dream: 'my friend sam saw them too', offer: 'end', react: { 1: 'no' },
        strokes: [line(400, 900, UP, 120, { ink: 'dense' }), line(1100, 900, UP, 120, { ink: 'dense' }), ring(750, 400, { ink: 'indigo', ease: true })],
        words: [{ after: 3, text: 'my friend sam says he saw the whales too, from his window, so they are real' }],
        marks: { 1: ['ArrowUp', 'ArrowRight'] },
        answers: ['my friend sam', 'he saw them too', 'they are real', 'from his window'],
      },
      {
        dream: 'a party on the whale town', start: { more: 'town' }, offer: 'end',
        strokes: [ring(800, 600, { ink: 'indigo', ease: true }), dot(700, 330, 'gold', 400), dot(800, 310, 'cinnabar', 400), dot(900, 330, 'gold', 400)],
        words: [{ after: 4, text: 'the little town on the big whale has a party with lights and music for the baby whale' }],
        marks: { 1: ['ArrowUp'], 3: ['ArrowUp', 'ArrowRight'] },
        answers: ['the party', 'lights and music', 'the little town', 'for the baby whale'],
      },
      {
        dream: 'tonight i fly with them', offer: 'inside',
        strokes: [ring(700, 600, { ink: 'indigo', ease: true }), line(700, 345, UP, 40, { ink: 'dense' }), ring(1250, 300, { ink: 'light' }), ring(250, 250, { ink: 'light' })],
        words: [{ after: 2, text: 'tonight i fly with all the whales, all the way round the world' }, { after: 4, text: 'and i am not scared at all' }],
        marks: { 0: ['ArrowUp', 'ArrowRight'], 1: ['ArrowUp'] },
        answers: ['flying with the whales', 'round the world', 'not scared', 'me'],
      },
      {
        dream: 'the whales come back in spring', start: { more: 'baby whale' }, offer: 'end',
        strokes: [ring(500, 450, { ink: 'indigo', ease: true }), ring(1050, 450, { ink: 'indigo', ease: true }), dot(800, 800, 'gold', 400)],
        words: [{ after: 3, text: 'in spring all the whales came back and the baby whale is big now, as big as its mum' }],
        marks: { 0: ['ArrowUp'], 1: ['ArrowUp', 'ArrowRight'] },
        answers: ['the whales came back', 'spring', 'the baby whale is big now', 'as big as its mum'],
      },
      {
        dream: 'goodnight, whales', offer: 'inside',
        strokes: [line(200, 800, R, 1200, { ink: 'gold' }), ring(800, 780, { ink: 'indigo' }), line(1300, 900, UP, 100, { ink: 'dense' })],
        words: [{ after: 3, text: 'the whales say goodnight and go to sleep on the sea and so do i' }],
        marks: { 0: ['ArrowLeft'], 2: ['ArrowLeft'] },
        answers: ['goodnight', 'sleeping on the sea', 'me too'],
      },
    ],
  },
  {
    id: 'armada', name: 'The city of tied ships', seal: 'Wave',
    idea: 'A floating city of hundreds of ships lashed together, later towed by a vast sea beast its rulers have harnessed.',
    source: { name: 'China Miéville, The Scar (2002): Armada', url: 'https://www.ragpickinghistory.co.uk/amp/armada' },
    nights: [
      {
        dream: 'ships tied into one city', offer: 'inside',
        strokes: [wave(100, 760, 1400, { ink: 'indigo' }), line(400, 700, R, 250, { ink: 'dense' }), line(650, 700, R, 250), line(900, 700, R, 250), line(500, 690, UP, 200), line(1000, 690, UP, 250)],
        words: [{ after: 4, text: 'hundreds of ships tied together into one floating city' }, { after: 6, text: 'bridges and ropes everywhere, you can walk from ship to ship' }],
        marks: { 0: ['ArrowRight'], 3: ['ArrowUp'] },
        answers: ['the ship city', 'ships tied together', 'the masts', 'bridges between ships'],
      },
      {
        dream: 'a monster chained under it', start: { more: 'ship' }, offer: 'next',
        strokes: [wave(1150, 880, 350, { ink: 'dense' }), line(1100, 710, DR, 150, { ink: 'cinnabar' })],
        words: [{ after: 2, text: 'a monster under the sea is chained to the city and pulls it' }],
        marks: { 0: ['ArrowDown', 'ArrowRight'] },
        answers: ['the sea monster', 'the chains', 'it pulls the city'],
        ending: { strokes: [line(1200, 860, R, 300, { ink: 'cinnabar' })], words: [{ after: 1, text: 'nobody knows where the rulers are making it pull us' }], marks: { 0: ['ArrowDown'] } },
      },
      {
        dream: 'the night market on the biggest ship', start: { wonder: { about: 'city', choose: 0 } }, offer: 'end',
        strokes: [dot(700, 620, 'gold', 800), dot(800, 610, 'gold', 800)],
        words: [{ after: 2, text: 'the night market on the biggest ship, lanterns everywhere' }],
        marks: { 0: ['ArrowUp'], 1: ['ArrowUp'] },
        answers: ['the night market', 'lanterns'],
      },
    ],
  },
  {
    id: 'living-ship', name: 'The living ship', seal: 'Star',
    idea: 'A world-ship that is alive: it breathes, its heart beats, and its people live inside it like cells in a body.',
    source: { name: 'Kameron Hurley, The Stars Are Legion (2017), via Now Novel', url: 'https://nownovel.com/how-to-create-a-fantasy-world/' },
    nights: [
      {
        dream: 'a ship that breathes, its heart', offer: 'inside',
        strokes: [ring(800, 620, { ink: 'dense', ease: true }), line(680, 500, L, 300, { ink: 'light' }), line(920, 500, R, 300), dot(800, 490, 'cinnabar', 900)],
        words: [{ after: 3, text: 'a spaceship that\'s alive, it breathes' }, { after: 4, text: 'its heart beats in the middle and the people live inside it like in a body' }],
        marks: { 0: ['ArrowLeft'], 3: ['ArrowRight'] },
        answers: ['the living ship', 'its heart', 'people living inside', 'it breathes'],
      },
      {
        dream: 'dying, looking for a star', start: { more: 'ship' }, offer: 'next',
        strokes: [dot(300, 250, 'gold', 600), dot(1300, 200, 'gold', 600), dot(1100, 850, 'gold', 600)],
        words: [{ after: 3, text: 'it\'s dying slowly and it\'s looking for a star to rest near' }],
        marks: { 0: ['ArrowDown'] },
        answers: ['the stars', 'it is dying', 'a star to rest near'],
        ending: { strokes: [line(900, 520, UR, 350, { ink: 'gold' })], words: [{ after: 1, text: 'it turns toward a young star and the heart beats faster' }], marks: { 0: ['ArrowUp', 'ArrowRight'] } },
      },
      {
        dream: 'a small ship growing inside it', start: { wonder: { about: 'ship', choose: 0 } }, offer: 'end',
        strokes: [ring(400, 760, { ink: 'light' })],
        words: [{ after: 1, text: 'it\'s growing a small ship inside it, a child' }],
        marks: { 0: ['ArrowUp'] },
        answers: ['the child ship', 'growing inside'],
      },
    ],
  },
  {
    // one grown-up, eleven weeks, most nights or first thing in the morning: `day` (days after
    // the first night) and `at` are when it is on the TV's clock, so last time's story comes back
    // when it would for a person (`recap`: they hear it first); a week away with nothing painted
    id: 'tide-town', name: 'The tide town', seal: 'Moon',
    idea: 'One person\'s recurring dream for eleven weeks after moving to a new city, while their mum is ill back home: a seaside town where the tide has gone out and doesn\'t come back.',
    source: { name: 'Written for this test as one person\'s nights, not taken from a book or a post', url: '' },
    clock: '2026-11-03T00:00:00Z',
    nights: [
      {
        day: 0, at: '23:10', dream: 'the town where the tide went out', offer: 'end',
        strokes: [sand(), ...houses(), sea(260), ...lighthouse(false)],
        words: [{ after: 5, text: 'ok so i keep having this dream since i moved. a town by the sea but the tide is out, like really far out, you can barely see the water' }, { after: 7, text: 'theres a lighthouse but its not on. nobody in it i think' }],
        marks: { 4: ['ArrowLeft'], 5: ['ArrowDown'], 6: ['ArrowDown'] },
        answers: ['the tide is out', 'the lighthouse', 'its not on', 'the town by the sea', 'nobody in it'],
      },
      {
        day: 1, at: '07:05', dream: 'the night bus that only goes to the sea', offer: 'next',
        strokes: [...bus(600), line(250, 820, R, 1100, { ink: 'light' })],
        words: [{ after: 2, text: 'on the night bus after work again. it only goes one way, to the sea' }, { after: 5, text: 'nobody else on it, just the driver, who never turns round' }],
        marks: { 0: ['ArrowLeft'], 4: ['ArrowRight'] },
        answers: ['the night bus', 'it only goes to the sea', 'one way', 'the driver never turns round', 'nobody else on it'],
        ending: { strokes: [line(1000, 650, R, 350, { ink: 'light' })], words: [{ after: 1, text: 'it drops me at the sand and drives off with its lights off' }], marks: { 0: ['ArrowDown'] } },
      },
      {
        day: 2, at: '22:45', dream: 'mum\'s kitchen window in the dunes', offer: 'inside',
        strokes: [wave(200, 760, 1200, { ink: 'light' }), ...windowAt(650, 520, true)],
        words: [{ after: 1, text: 'the dunes behind the town' }, { after: 6, text: 'and mums kitchen window just standing in the dunes. no house, just the window, with the light on like when i used to come home late' }],
        marks: { 5: ['ArrowUp', 'ArrowLeft'] },
        answers: ['mums kitchen window', 'the light on', 'no house just the window', 'in the dunes', 'coming home late'],
      },
      {
        day: 4, at: '23:30', recap: true, dream: 'a fox on the sand', offer: 'end',
        strokes: [sand(), ...fox(500, 790), dot(620, 815, 'light', 200), dot(700, 815, 'light', 200), dot(780, 815, 'light', 200)],
        words: [{ after: 3, text: 'a fox followed me along the sand' }, { after: 6, text: 'not scary. it stopped every time i stopped, like a game' }],
        marks: { 1: ['ArrowUp'], 2: ['ArrowUp', 'ArrowRight'] },
        answers: ['the fox', 'it stops when i stop', 'following me', 'not scary', 'like a game'],
      },
      {
        day: 5, at: '07:40', dream: 'the lighthouse door is locked', start: { more: 'lighthouse' }, offer: 'next',
        strokes: [...lighthouse(false), line(1225, 830, UP, 80, { ink: 'dense' }), line(1275, 830, UP, 80), line(1300, 720, R, 120, { ink: 'light' }), wave(1300, 750, 120, { ink: 'light' })],
        words: [{ after: 4, text: 'went up to the lighthouse door. locked' }, { after: 6, text: 'theres a sign on it but i cant read it, the letters keep moving about' }],
        marks: { 2: ['ArrowDown'], 5: ['ArrowRight'] },
        answers: ['the lighthouse door', 'locked', 'cant read the sign', 'the letters keep moving', 'the fox waiting'],
        ending: { strokes: [...fox(1120, 820)], words: [{ after: 2, text: 'the fox sat down by the door like its waiting too' }], marks: { 1: ['ArrowUp', 'ArrowLeft'] } },
      },
      {
        day: 6, at: '23:55', dream: 'the office on the sand', offer: 'end', react: { 0: 'no' },
        strokes: [sand(), line(400, 700, R, 200, { ink: 'dense' }), line(700, 700, R, 200), line(1000, 700, R, 200), line(450, 700, UP, 70, { ink: 'cinnabar' }), sea(270)],
        words: [{ after: 4, text: 'ugh. work dream. the whole office was set up on the sand, desks and everything' }, { after: 6, text: 'tide still out. everyone pretending its totally normal' }],
        marks: { 1: ['ArrowDown', 'ArrowRight'], 4: ['ArrowDown', 'ArrowRight'] },
        answers: ['the office on the sand', 'pretending its normal', 'work', 'the desks'],
      },
      {
        day: 7, at: '22:20', dream: 'a piano where the sea should be', start: { wonder: { about: 'sea', choose: 0 } }, offer: 'inside',
        strokes: [sand(), sea(240), ...piano(700, 600)],
        words: [{ after: 2, text: 'walked out on the sand where the sea should be. for ages' }, { after: 6, text: 'found a piano just sitting there. a proper one. nobody around' }],
        marks: { 1: ['ArrowLeft'], 2: ['ArrowUp', 'ArrowRight'] },
        answers: ['the piano', 'where the sea should be', 'walking out on the sand', 'nobody around'],
      },
      {
        day: 8, at: '07:15', dream: 'the fox and the empty swimming pool', start: { more: 'fox' }, offer: 'end',
        strokes: [...fox(400, 760), line(600, 600, R, 400, { ink: 'water' }), line(600, 760, R, 400), line(600, 600, DOWN, 160), line(1000, 600, DOWN, 160), line(620, 740, UP, 100, { ink: 'light' })],
        words: [{ after: 2, text: 'the fox again!' }, { after: 7, text: 'it took me to the old swimming pool, the one from when i was a kid. but its empty, no water, just the tiles' }],
        marks: { 0: ['ArrowUp'], 4: ['ArrowLeft'], 5: ['ArrowDown', 'ArrowLeft'] },
        answers: ['the fox', 'the old swimming pool', 'its empty', 'from when i was a kid', 'no water'],
      },
      {
        day: 10, at: '23:00', recap: true, dream: 'a door in my flat that opens on the beach', offer: 'next',
        strokes: [...door(650), line(500, 500, UP, 250, { ink: 'light' }), sand(), sea(300)],
        words: [{ after: 3, text: 'theres a door in my new flat that wasnt there before. behind the wardrobe' }, { after: 6, text: 'i opened it and it was just the beach. the same beach' }],
        marks: { 0: ['ArrowRight'], 2: ['ArrowRight'], 4: ['ArrowUp'] },
        answers: ['the door in my flat', 'behind the wardrobe', 'it opens onto the beach', 'the same beach', 'the night bus waiting'],
        ending: { strokes: [...bus(450).slice(0, 2), dot(600, 500, 'gold', 400)], words: [{ after: 3, text: 'i went through and the night bus was waiting. so i guess thats how i get there now' }], marks: { 2: ['ArrowUp'] } },
      },
      {
        day: 11, at: '22:35', dream: 'the man selling umbrellas', offer: 'end',
        strokes: [sand(), ...umbrellaMan(950), line(1150, 820, UP, 100, { ink: 'light' }), line(1200, 820, UP, 100)],
        words: [{ after: 3, text: 'a man on the beach selling umbrellas. its never rained here once' }, { after: 5, text: 'he knew my name. said it like hed been waiting' }],
        marks: { 1: ['ArrowRight'], 2: ['ArrowUp', 'ArrowRight'] },
        answers: ['the umbrella man', 'he knew my name', 'it never rains', 'selling umbrellas', 'like hed been waiting'],
      },
      {
        day: 13, at: '08:10', recap: true, dream: 'inside mum\'s kitchen, nobody there', start: { more: 'window' }, offer: 'inside',
        strokes: [...windowAt(650, 480, true), line(670, 560, R, 40, { ink: 'dense' }), dot(740, 560, 'cinnabar', 300)],
        words: [{ after: 5, text: 'mums window again. this time i could see inside, the kitchen' }, { after: 7, text: 'the kettle, her radio on the side. but nobody there. the radio was on though' }],
        marks: { 4: ['ArrowUp', 'ArrowLeft'], 6: ['ArrowDown'] },
        answers: ['mums kitchen', 'the kettle', 'her radio', 'nobody there', 'the radio was on'],
      },
      {
        day: 14, at: '23:20', dream: 'my old red bike in the sand', offer: 'end',
        strokes: [sand(), sea(220), ring(600, 760, { ink: 'dense' }), ring(760, 760), line(620, 700, R, 150, { ink: 'cinnabar' })],
        words: [{ after: 2, text: 'the sea is even further out than last week. i walked for ages and no water' }, { after: 5, text: 'found my old red bike stuck in the sand. i had that when i was 10' }, { after: 5, text: '(rang mum today. she says shes fine. she always says shes fine)' }],
        marks: { 1: ['ArrowDown'], 4: ['ArrowUp'] },
        answers: ['my old red bike', 'stuck in the sand', 'the sea is further out', 'no water', 'when i was 10'],
      },
      {
        day: 15, at: '22:50', dream: 'why he sells umbrellas', start: { wonder: { about: 'umbrella', choose: 'own' } }, offer: 'end',
        strokes: [...rain(5), ...umbrellaMan(950)],
        words: [{ after: 5, text: 'my answer: he sells them because he remembers when it used to rain here' }, { after: 7, text: 'like hes the only one who remembers' }],
        marks: { 0: ['ArrowLeft'], 5: ['ArrowUp', 'ArrowLeft'] },
        answers: ['he remembers the rain', 'it used to rain here', 'the only one who remembers'],
      },
      {
        day: 16, at: '07:30', dream: 'a different fox, grey', offer: 'end', same: false,
        strokes: [sand(), line(800, 790, R, 90, { ink: 'dense' }), line(890, 790, UR, 55, { ink: 'dense' }), dot(820, 770, 'light', 200)],
        words: [{ after: 3, text: 'a fox again but a different one. grey, older, thinner' }, { after: 4, text: 'it didnt follow me, it just watched from far off' }],
        marks: { 1: ['ArrowDown'], 3: ['ArrowLeft'] },
        answers: ['a grey fox', 'a different fox', 'it just watched', 'older', 'from far off'],
      },
      {
        day: 18, at: '23:40', recap: true, dream: 'the bus driver turns round', start: { more: 'bus' }, offer: 'next',
        strokes: [...bus(550), line(950, 600, UP, 70, { ink: 'cinnabar' })],
        words: [{ after: 5, text: 'night bus. the driver turned round tonight' }, { after: 6, text: 'it was me. like an older me, grey hair. that was so weird' }],
        marks: { 5: ['ArrowRight', 'ArrowDown'] },
        answers: ['the bus driver', 'it was me', 'an older me', 'grey hair', 'weird', 'get off whenever you want'],
        ending: { strokes: [line(950, 520, L, 150, { ink: 'light' })], words: [{ after: 1, text: 'the older me said you can get off whenever you want you know' }], marks: { 0: ['ArrowLeft'] } },
      },
      {
        day: 20, at: '22:10', dream: 'kids building a town of sand', offer: 'inside',
        strokes: [sand(), line(400, 820, UP, 60, { ink: 'light' }), line(460, 820, UP, 90), line(520, 820, UP, 50), line(580, 820, UP, 110), line(400, 760, R, 180), line(700, 815, UP, 50, { ink: 'cinnabar' }), line(760, 815, UP, 40)],
        words: [{ after: 5, text: 'kids building a whole town out of sand where the sea used to be' }, { after: 8, text: 'they said its for when the water comes back. so it has somewhere to go' }],
        marks: { 4: ['ArrowUp'], 6: ['ArrowUp', 'ArrowRight'] },
        answers: ['the sand town', 'the kids', 'for when the water comes back', 'somewhere to go'],
      },
      {
        day: 21, at: '23:05', dream: 'footprints round the piano', start: { more: 'piano' }, offer: 'end',
        strokes: [...piano(700, 600), dot(650, 780, 'light', 200), dot(690, 800, 'light', 200), dot(940, 790, 'light', 200)],
        words: [{ after: 4, text: 'went back to the piano' }, { after: 7, text: 'someone had been playing it. theres footprints all round it and theyre not mine' }],
        marks: { 4: ['ArrowRight'], 6: ['ArrowRight'] },
        answers: ['the piano', 'footprints', 'not mine', 'someone was playing it'],
      },
      {
        day: 22, at: '06:50', dream: 'the water came back all at once', offer: 'end', react: { 1: 'no' },
        strokes: [wave(200, 300, 1200, { ink: 'indigo', ease: true }), line(300, 300, DOWN, 400, { ink: 'indigo', ease: true }), line(800, 300, DOWN, 450, { ink: 'indigo', ease: true }), line(1300, 300, DOWN, 400, { ink: 'indigo', ease: true }), line(1400, 820, UP, 120, { ink: 'dense' }), line(1460, 820, UP, 120)],
        words: [{ after: 4, text: 'bad one. woke up at 5. the water came back all at once, like a wall' }, { after: 6, text: 'and i couldnt find the door back to the flat. it was there and then it wasnt' }],
        marks: { 0: ['ArrowDown', 'ArrowRight'], 1: ['ArrowDown', 'ArrowRight'], 2: ['ArrowDown', 'ArrowRight'], 4: ['ArrowDown'] },
        answers: ['the water came back', 'all at once', 'couldnt find the door', 'a wall of water'],
      },
      {
        day: 24, at: '22:30', recap: true, dream: 'a chair in front of the door', start: { more: 'wardrobe' }, offer: 'end',
        strokes: [...door(650), line(560, 820, UP, 100, { ink: 'light' }), line(560, 720, R, 80), line(640, 820, UP, 100)],
        words: [{ after: 3, text: 'checked the door is still there. it is' }, { after: 6, text: 'i put a chair in front of it. dont know why. in the dream i mean, not real life lol' }],
        marks: { 0: ['ArrowLeft'], 4: ['ArrowDown'] },
        answers: ['the door', 'a chair in front of it', 'still there'],
      },
      {
        day: 25, at: '23:15', dream: 'someone in the lighthouse', offer: 'next',
        strokes: [...lighthouse(false), line(1250, 360, UP, 50, { ink: 'cinnabar' }), line(1270, 360, UR, 40, { ink: 'cinnabar' })],
        words: [{ after: 3, text: 'theres someone in the lighthouse after all' }, { after: 4, text: 'an old woman. she waved from the top. the light still isnt on though' }],
        marks: { 2: ['ArrowUp'], 3: ['ArrowUp', 'ArrowRight'] },
        answers: ['the lighthouse keeper', 'an old woman', 'she waved', 'the light isnt on', 'the key', 'the fox ran off with it'],
        ending: { strokes: [line(1250, 420, DOWN, 350, { ink: 'gold' }), ...fox(1050, 820)], words: [{ after: 1, text: 'she dropped a key down to me' }, { after: 3, text: 'but the fox grabbed it and ran off with it. typical' }], marks: { 0: ['ArrowUp'], 1: ['ArrowRight'] } },
      },
      {
        day: 27, at: '08:00', dream: 'the fox buried the key', start: { more: 'fox' }, offer: 'end',
        strokes: [...fox(500, 790), ...sandTown(), dot(430, 800, 'gold', 500)],
        words: [{ after: 2, text: 'found the fox' }, { after: 5, text: 'it had buried the key in the sand town the kids made. right in the middle' }],
        marks: { 0: ['ArrowUp', 'ArrowRight'], 4: ['ArrowUp'] },
        answers: ['the fox', 'the key', 'buried in the sand town', 'right in the middle'],
      },
      {
        day: 28, at: '22:40', dream: 'dan from work buying an umbrella', offer: 'end',
        strokes: [line(700, 820, UP, 170, { ink: 'dense' }), ring(640, 620, { ink: 'gold' }), ...umbrellaMan(1000)],
        words: [{ after: 2, text: 'dan from work was in it for some reason. buying an umbrella' }, { after: 4, text: 'i was like dan what are you doing here. he didnt know either lol' }],
        marks: { 0: ['ArrowUp', 'ArrowRight'] },
        answers: ['dan from work', 'buying an umbrella', 'he didnt know either'],
      },
      {
        day: 29, at: '23:50', dream: 'the stairs that go up forever', start: { more: 'lighthouse' }, offer: 'end',
        strokes: [...lighthouse(false), ring(1190, 700, { ink: 'light' }), ring(1190, 560, { ink: 'light' }), dot(1250, 620, 'gold', 400)],
        words: [{ after: 3, text: 'used the key. went in' }, { after: 5, text: 'the stairs go round and round and up forever. like a hundred floors. i got tired and sat down halfway' }],
        marks: { 2: ['ArrowRight'], 3: ['ArrowDown'] },
        answers: ['the lighthouse stairs', 'the key', 'they go up forever', 'sat down halfway', 'a hundred floors'],
      },
      {
        day: 31, at: '01:30', dream: 'her window was dark', offer: 'end',
        strokes: [...windowAt(650, 480, false), dot(710, 540, 'light', 300)],
        words: [{ after: 2, text: 'mums in hospital. they found something. i dont really want to paint tonight' }, { after: 5, text: 'but i did. her window was dark' }],
        marks: { 0: ['ArrowDown'], 3: ['ArrowDown', 'ArrowLeft'], 4: ['ArrowDown'] },
        answers: ['mums window', 'it was dark', 'the window is dark', 'mum'],
      },
      // a week at mum's: nothing painted
      {
        day: 38, at: '21:30', recap: true, dream: 'the light is on again, just a bit', start: { more: 'window' }, offer: 'inside',
        strokes: [...windowAt(650, 480, 'dim')],
        words: [{ after: 1, text: 'back from mums. she had the operation, its gone ok they think. i didnt dream at all at hers' }, { after: 5, text: 'tonight i went back to the window and the light was on again. just a bit' }],
        marks: { 4: ['ArrowUp', 'ArrowLeft'] },
        answers: ['the window', 'the light is on again', 'just a bit', 'mum', 'the operation'],
      },
      {
        day: 39, at: '22:00', dream: 'the kettle at the top of the lighthouse', start: { more: 'lighthouse' }, offer: 'next',
        strokes: [...lighthouse(false), line(1250, 360, UP, 50, { ink: 'cinnabar' }), line(1290, 380, R, 30, { ink: 'dense' })],
        words: [{ after: 2, text: 'climbed the rest of the stairs. all the way' }, { after: 4, text: 'the old woman at the top had the kettle on. the same kettle as mums. like exactly the same one' }],
        marks: { 2: ['ArrowUp'], 3: ['ArrowUp', 'ArrowLeft'] },
        answers: ['the top of the lighthouse', 'the old woman', 'the kettle', 'same as mums', 'the lamp', 'light it every night'],
        ending: { strokes: [ring(1190, 330, { ink: 'gold' })], words: [{ after: 1, text: 'she showed me the lamp. its not broken. it just needs someone to light it every night' }], marks: { 0: ['ArrowUp'] } },
      },
      {
        day: 41, at: '07:20', dream: 'the hospital corridor turns to sand', offer: 'end',
        strokes: [line(200, 400, R, 1200, { ink: 'dense', ease: true }), line(200, 700, R, 1200, { ink: 'dense', ease: true }), line(900, 700, R, 500, { ink: 'light' }), dot(1350, 550, 'light', 300)],
        words: [{ after: 2, text: 'the hospital corridor. it kept getting longer' }, { after: 3, text: 'and then the floor was sand. i could smell the sea' }],
        marks: { 0: ['ArrowDown'], 1: ['ArrowDown', 'ArrowRight'], 2: ['ArrowLeft'] },
        answers: ['the hospital corridor', 'the floor was sand', 'it kept getting longer', 'smell the sea'],
      },
      {
        day: 42, at: '23:30', dream: 'i lit the lamp', start: { wonder: { about: 'lighthouse', choose: 0 } }, offer: 'inside',
        strokes: [...lighthouse(true), beam(900, { ease: true }), sea(330)],
        words: [{ after: 2, text: 'i lit the lamp. it took ages, my hands were shaking' }, { after: 4, text: 'the beam went right out over the sand to where the sea is' }],
        marks: { 1: ['ArrowUp', 'ArrowRight'], 2: ['ArrowUp', 'ArrowRight'] },
        answers: ['the lamp', 'i lit it', 'the beam', 'where the sea is', 'my hands were shaking'],
      },
      {
        day: 43, at: '22:15', dream: 'the sea is coming back', start: { more: 'sea' }, offer: 'end',
        strokes: [beam(900), sea(450), sand()],
        words: [{ after: 2, text: 'in the light from the beam you can see the sea now' }, { after: 3, text: 'its a long way off but its there. its coming back. slowly' }],
        marks: { 1: ['ArrowUp', 'ArrowLeft'] },
        answers: ['the sea', 'its coming back', 'slowly', 'the beam', 'you can see it now'],
      },
      {
        day: 45, at: '16:40', dream: 'the fox asleep under the piano', offer: 'end',
        strokes: [...piano(700, 600).slice(0, 3), ring(560, 780, { ink: 'cinnabar' })],
        words: [{ after: 4, text: 'fell asleep on the sofa. short one. the fox was asleep too, curled up under the piano' }],
        marks: { 3: ['ArrowLeft'] },
        answers: ['the fox', 'asleep', 'under the piano', 'curled up'],
      },
      {
        day: 45, at: '23:55', dream: 'he says it will rain', start: { more: 'umbrella' }, offer: 'next',
        strokes: [...umbrellaMan(950), line(400, 300, R, 600, { ink: 'light' })],
        words: [{ after: 3, text: 'the umbrella man said its going to rain tomorrow. first time hes ever said that' }],
        marks: { 2: ['ArrowRight'] },
        answers: ['the umbrella man', 'its going to rain', 'first time', 'a yellow umbrella', 'for free'],
        ending: { strokes: [ring(640, 620, { ink: 'gold' }), line(700, 820, UP, 170, { ink: 'dense' })], words: [{ after: 2, text: 'he gave me one for free. a yellow one' }], marks: { 0: ['ArrowUp'] } },
      },
      {
        day: 46, at: '07:10', dream: 'it rained', offer: 'inside',
        strokes: [...rain(6), ring(640, 620, { ink: 'gold' }), line(400, 820, UP, 60, { ink: 'light' })],
        words: [{ after: 6, text: 'IT RAINED. on the whole town' }, { after: 8, text: 'the sand town the kids built is melting a bit but they dont even mind, theyre dancing' }],
        marks: { 0: ['ArrowUp', 'ArrowRight'], 3: ['ArrowUp', 'ArrowRight'], 6: ['ArrowUp'] },
        answers: ['the rain', 'it rained', 'the sand town melting', 'they dont mind', 'the yellow umbrella', 'dancing'],
      },
      {
        day: 48, at: '22:50', recap: true, dream: 'a stop on the way back', start: { more: 'bus' }, offer: 'end',
        strokes: [...bus(550), line(1100, 820, UP, 160, { ink: 'dense' }), line(1100, 660, R, 90, { ink: 'gold' })],
        words: [{ after: 5, text: 'the night bus has a stop on the way back now' }, { after: 7, text: 'theres a sign that just says TOWN. i dont think it was there before. it goes both ways now?' }],
        marks: { 5: ['ArrowUp'], 6: ['ArrowUp', 'ArrowLeft'] },
        answers: ['the night bus', 'a way back', 'a stop that says town', 'both ways'],
      },
      {
        day: 49, at: '23:20', dream: 'mum rang: is that you', offer: 'end',
        strokes: [line(400, 500, R, 100, { ink: 'dense' }), line(400, 500, DOWN, 60), ...windowAt(800, 480, true), beam(300)],
        words: [{ after: 2, text: 'mum rang me in the dream. on the old phone from the hall at home' }, { after: 8, text: 'she said she can see the lighthouse from her window. the light. she said is that you' }],
        marks: { 0: ['ArrowUp'], 6: ['ArrowUp', 'ArrowLeft'], 7: ['ArrowUp', 'ArrowLeft'] },
        answers: ['mum rang', 'the old phone', 'she can see the lighthouse', 'is that you', 'her window'],
      },
      {
        day: 50, at: '07:00', dream: 'cant remember', offer: 'end', same: false, feel: 'Don’t say', react: { 0: 'no', 1: 'no', 2: 'no' },
        strokes: [line(600, 500, R, 150, { ink: 'light' }), line(650, 560, R, 100, { ink: 'light' })],
        words: [{ after: 2, text: 'honestly cant remember much. something about teeth. not painting that' }],
        marks: {},
        answers: ['cant remember', 'nothing really', 'teeth'],
      },
      {
        day: 52, at: '22:40', recap: true, dream: 'the piano half in the water', start: { more: 'piano' }, offer: 'next',
        strokes: [...piano(700, 600), wave(250, 700, 1100, { ink: 'indigo' })],
        words: [{ after: 5, text: 'the piano is half in the water now. the sea came all the way up to it' }, { after: 5, text: 'i played one note and the fox howled lol' }],
        marks: { 4: ['ArrowUp', 'ArrowRight'] },
        answers: ['the piano', 'half in the water', 'one note', 'the fox howled', 'play another one'],
        ending: { strokes: [...lighthouse(true)], words: [{ after: 2, text: 'the old woman shouted down from the lighthouse, play another one!' }], marks: { 1: ['ArrowUp', 'ArrowRight'] } },
      },
      {
        day: 53, at: '23:10', dream: 'my brother, little again', offer: 'inside',
        strokes: [...sandTown(), line(560, 815, UP, 60, { ink: 'cinnabar' }), dot(560, 745, 'cinnabar', 300)],
        words: [{ after: 2, text: 'the sand town again' }, { after: 4, text: 'my brother was there, but little, like 8. building it with the other kids. hes 30 now and lives in canada. havent seen him in 2 years' }],
        marks: { 2: ['ArrowUp', 'ArrowLeft'], 3: ['ArrowDown', 'ArrowLeft'] },
        answers: ['my brother', 'little again', 'building the sand town', 'in canada', 'havent seen him'],
      },
      {
        day: 55, at: '08:20', dream: 'the fox had cubs', start: { wonder: { about: 'fox', choose: 0 } }, offer: 'end',
        strokes: [...lighthouse(true), dot(1180, 810, 'cinnabar', 300), dot(1210, 815, 'cinnabar', 300), dot(1240, 810, 'cinnabar', 300), ...fox(1050, 800)],
        words: [{ after: 5, text: 'the fox had cubs!! three of them' }, { after: 7, text: 'under the lighthouse steps' }],
        marks: { 2: ['ArrowUp', 'ArrowRight'], 3: ['ArrowUp', 'ArrowRight'], 4: ['ArrowUp', 'ArrowRight'] },
        answers: ['the cubs', 'three of them', 'under the lighthouse steps', 'the fox'],
      },
      {
        day: 56, at: '22:30', dream: 'moved the chair away', start: { more: 'wardrobe' }, offer: 'next',
        strokes: [...door(650), line(480, 820, UP, 100, { ink: 'light' })],
        words: [{ after: 4, text: 'moved the chair away from the door' }],
        marks: { 3: ['ArrowLeft'] },
        answers: ['the door', 'moved the chair', 'left it open', 'hear the sea from my bedroom'],
        ending: { strokes: [wave(800, 650, 400, { ink: 'indigo' })], words: [{ after: 1, text: 'left it open a bit. you can hear the sea from my bedroom now' }], marks: { 0: ['ArrowUp', 'ArrowLeft'] } },
      },
      {
        day: 57, at: '23:45', dream: 'the office in the sand town', offer: 'end',
        strokes: [...sandTown(), line(600, 700, R, 200, { ink: 'dense' }), line(900, 820, UP, 170, { ink: 'dense' }), ring(840, 620, { ink: 'gold' })],
        words: [{ after: 3, text: 'work dream again but the office is in the sand town now and its actually kind of nice' }, { after: 5, text: 'dan is there with his umbrella. still doesnt know why' }],
        marks: { 2: ['ArrowUp'], 4: ['ArrowUp', 'ArrowRight'] },
        answers: ['the office', 'in the sand town', 'dan', 'kind of nice', 'his umbrella'],
      },
      {
        day: 59, at: '07:30', recap: true, dream: 'she\'s teaching me the lamp', start: { more: 'lighthouse' }, offer: 'end',
        strokes: [...lighthouse(true), line(1250, 360, UP, 50, { ink: 'cinnabar' }), beam(700)],
        words: [{ after: 2, text: 'lit the lamp again' }, { after: 4, text: 'you have to do it every night, the old woman said. shes teaching me. theres a way you hold the match' }],
        marks: { 1: ['ArrowLeft'], 3: ['ArrowUp', 'ArrowLeft'] },
        answers: ['the lamp', 'every night', 'shes teaching me', 'the lighthouse', 'the match'],
      },
      {
        day: 60, at: '22:00', dream: 'mum on the beach in her blue coat', offer: 'inside',
        strokes: [sand(), line(700, 820, UP, 130, { ink: 'indigo' }), dot(700, 680, 'indigo', 300), ring(850, 760, { ink: 'dense' }), ring(1010, 760), line(870, 700, R, 150, { ink: 'cinnabar' })],
        words: [{ after: 3, text: 'mum was in the town. walking on the beach in her blue coat' }, { after: 3, text: 'slow, but walking' }, { after: 6, text: 'she found my red bike and laughed. she said i thought we gave that away' }],
        marks: { 1: ['ArrowUp', 'ArrowLeft'], 2: ['ArrowUp', 'ArrowLeft'], 5: ['ArrowUp', 'ArrowRight'] },
        answers: ['mum', 'her blue coat', 'walking on the beach', 'my red bike', 'she laughed', 'we gave that away'],
      },
      {
        day: 62, at: '23:30', dream: 'the storm, and everyone on the bus', offer: 'next', react: { 2: 'no' },
        strokes: [wave(200, 500, 1200, { ink: 'indigo', ease: true }), wave(200, 620, 1200, { ink: 'indigo', ease: true }), ...lighthouse(true), ...bus(250).slice(0, 2)],
        words: [{ after: 2, text: 'storm. massive waves' }, { after: 6, text: 'but the light was on, and the bus came, and i got everyone on it. the kids and the foxes and the old woman and dan lol' }],
        marks: { 0: ['ArrowDown', 'ArrowRight'], 1: ['ArrowDown', 'ArrowRight'], 3: ['ArrowUp'], 5: ['ArrowUp', 'ArrowRight'] },
        answers: ['the storm', 'big waves', 'the light was on', 'got everyone on the bus', 'the sand town was gone', 'started again'],
        ending: { strokes: [sand(), line(400, 820, UP, 60, { ink: 'light' })], words: [{ after: 2, text: 'in the morning the sand town was gone. the kids just started again, like it was nothing' }], marks: { 1: ['ArrowUp', 'ArrowLeft'] } },
      },
      {
        day: 63, at: '22:50', dream: 'where they build it now', start: { wonder: { about: 'sand town', choose: 'own' } }, offer: 'end',
        strokes: [wave(200, 700, 1200, { ink: 'light' }), line(500, 700, UP, 60, { ink: 'light' }), line(560, 700, UP, 90), ...windowAt(800, 520, true)],
        words: [{ after: 3, text: 'my answer: theyre building it further up this time, by the dunes' }, { after: 8, text: 'near mums window. where the water cant get it' }],
        marks: { 2: ['ArrowUp'], 7: ['ArrowUp', 'ArrowLeft'] },
        answers: ['further up', 'by the dunes', 'near mums window', 'where the water cant get it'],
      },
      {
        day: 64, at: '07:45', dream: 'the umbrella stall is closed', start: { more: 'umbrella' }, offer: 'end',
        strokes: [...umbrellaMan(950), line(850, 700, R, 200, { ink: 'dense' })],
        words: [{ after: 3, text: 'the umbrella man has closed his stall' }, { after: 3, text: 'he says now it rains people buy their own. he looked really happy about it' }],
        marks: { 2: ['ArrowUp', 'ArrowLeft'] },
        answers: ['the umbrella man', 'closed his stall', 'happy about it', 'people buy their own'],
      },
      {
        day: 66, at: '23:15', recap: true, dream: 'the grey fox came back', offer: 'end',
        strokes: [line(800, 790, R, 90, { ink: 'dense' }), line(890, 790, UR, 55, { ink: 'dense' }), dot(1180, 810, 'cinnabar', 300), dot(1210, 815, 'cinnabar', 300)],
        words: [{ after: 2, text: 'the grey fox came back. the old one from before, the one that just watched' }, { after: 4, text: 'it sat with the cubs. like a grandad' }],
        marks: { 0: ['ArrowLeft'], 2: ['ArrowUp', 'ArrowLeft'] },
        answers: ['the grey fox', 'came back', 'with the cubs', 'from before', 'like a grandad'],
      },
      {
        day: 68, at: '22:20', dream: 'i drove the night bus', start: { more: 'bus' }, offer: 'next',
        strokes: [...bus(550), line(400, 600, UP, 60, { ink: 'cinnabar' }), line(900, 620, R, 60, { ink: 'light' })],
        words: [{ after: 6, text: 'drove the night bus myself tonight' }, { after: 7, text: 'the older me is a passenger now. asleep at the back' }],
        marks: { 5: ['ArrowUp', 'ArrowRight'], 6: ['ArrowLeft'] },
        answers: ['the night bus', 'i drove it', 'the older me', 'asleep at the back', 'every stop', 'nobody waiting'],
        ending: { strokes: [dot(1100, 620, 'gold', 300), dot(1250, 620, 'gold', 300)], words: [{ after: 2, text: 'i stopped at every stop. even the ones with nobody waiting' }], marks: { 1: ['ArrowLeft'] } },
      },
      {
        day: 70, at: '08:05', recap: true, dream: 'a house round mum\'s window', start: { more: 'window' }, offer: 'inside',
        strokes: [...windowAt(650, 480, true), line(600, 470, UP, 150, { ink: 'dense' }), line(820, 470, UP, 150), line(600, 320, UR, 155), line(710, 210, DR, 155)],
        words: [{ after: 5, text: 'mums window has a house round it now' }, { after: 9, text: 'just the kitchen so far. like someone is building it back, bit by bit' }],
        marks: { 4: ['ArrowUp'], 7: ['ArrowUp', 'ArrowLeft'], 8: ['ArrowUp', 'ArrowLeft'] },
        answers: ['mums window', 'a house round it', 'the kitchen', 'building it back', 'bit by bit'],
      },
      {
        day: 71, at: '23:00', dream: 'the night bus to canada', offer: 'end',
        strokes: [...bus(400).slice(0, 2), beam(1000, { ease: true }), sea(650)],
        words: [{ after: 2, text: 'my brother is flying over for christmas!! booked it today' }, { after: 4, text: 'in the dream the night bus went all the way to canada. over the sea, on the beam of light lol' }],
        marks: { 0: ['ArrowUp', 'ArrowRight'], 2: ['ArrowUp', 'ArrowRight'] },
        answers: ['my brother', 'the night bus', 'over the sea', 'on the beam of light', 'canada', 'christmas'],
      },
      {
        day: 73, at: '22:40', dream: 'the piano floated off', start: { more: 'piano' }, offer: 'end',
        strokes: [wave(250, 700, 1100, { ink: 'indigo' }), ...piano(1000, 560), line(1240, 600, R, 100, { ink: 'light' })],
        words: [{ after: 1, text: 'the tide is all the way in now' }, { after: 6, text: 'the piano floated off. i didnt mind. it felt like it was time' }],
        marks: { 0: ['ArrowUp', 'ArrowLeft'], 5: ['ArrowLeft'] },
        answers: ['the piano', 'floated off', 'the tide is in', 'it was time'],
      },
      {
        day: 74, at: '23:30', dream: 'she gave me the key for good', offer: 'next',
        strokes: [...lighthouse(true), dot(1150, 700, 'gold', 500), line(1000, 815, UP, 60, { ink: 'cinnabar' }), ...bus(600).slice(0, 2)],
        words: [{ after: 3, text: 'the old woman gave me the key for good' }, { after: 6, text: 'shes going on the night bus. she said youll be fine. i think she was me as well, older again, or mum, or both' }],
        marks: { 2: ['ArrowUp'], 3: ['ArrowDown', 'ArrowLeft'], 5: ['ArrowLeft'] },
        answers: ['the key', 'the old woman', 'youll be fine', 'she was me or mum', 'on the night bus', 'lit the lamp on my own'],
        ending: { strokes: [beam(900, { ease: true })], words: [{ after: 1, text: 'i waved her off and then i went up and lit the lamp. on my own' }], marks: { 0: ['ArrowUp', 'ArrowLeft'] } },
      },
      {
        day: 77, at: '22:10', recap: true, dream: 'the whole town, tide in', offer: 'inside',
        strokes: [sand(), wave(250, 700, 1100, { ink: 'indigo' }), ...houses(), ...lighthouse(true), beam(700), ...windowAt(500, 440, true), ...fox(900, 800), line(400, 820, UP, 60, { ink: 'light' })],
        words: [{ after: 2, text: 'the whole town tonight. tide in' }, { after: 8, text: 'the light on' }, { after: 13, text: 'mums kitchen lit' }, { after: 16, text: 'the foxes, the sand town up by the dunes. i dont think i need to come here every night anymore. ill still come sometimes' }],
        marks: { 1: ['ArrowLeft'], 6: ['ArrowUp', 'ArrowLeft'], 12: ['ArrowUp', 'ArrowLeft'], 14: ['ArrowUp'] },
        answers: ['the whole town', 'the tide is in', 'the light is on', 'mums kitchen', 'i dont need to come every night', 'ill still come sometimes'],
      },
    ],
  },
];

// ---------------------------------------------------------------- running them

const only = process.env.WORLDS ? process.env.WORLDS.split(',') : null;
const NIGHTS = Number(process.env.NIGHTS) || 3;
const LANES = Number(process.env.LANES) || 2;
const calls = [];
// each world its own client, so that its results.json counts only its own calls while another lane
// makes a world beside it (AT_MOST calls at once, for each world)
const clientFor = (mine) => createClaudeCli({ atMost: Number(process.env.AT_MOST) || 3, onCall: (c) => { const x = { ...c, at: new Date().toISOString() }; calls.push(x); mine.push(x); } });
mkdirSync(OUT, { recursive: true });

// When a night is on the TV's clock: `day` days after the world's first, at `at`
const timeOf = (W, N) => { const [h, m] = String(N.at || '21:30').split(':').map(Number); return Date.parse(W.clock) + (N.day || 0) * 86400000 + (h * 60 + m) * 60000; };
// A world: a new TV, a new painter, their nights; their world at night, walked through; their book
const KEEP = !!process.env.KEEP, FROM = KEEP ? Number(process.env.FROM) || 1 : 1;
async function makeWorld(W, port) {
  const out = join(OUT, W.id);
  const mine = [];
  // going on from a night: what was kept of the nights before it, and their calls. The TV keeps a
  // world by its address, so a world goes on at the port it was made at
  const before = FROM > 1 ? JSON.parse(readFileSync(join(out, 'results.json'), 'utf8')) : null;
  if (before && before.port) port = before.port;
  const TV = await openTV({ out, port, guidePort: port + 1, claude: clientFor(mine), patience: 6, tellShots: !!process.env.TELL_SHOTS, profile: KEEP ? join(out, 'profile') : null, clock: !!W.clock });
  const log = before
    ? { ...before, nights: before.nights.filter((n) => n.night < FROM), error: undefined, days: [...(before.days || [before.started]), new Date().toISOString()] }
    : { id: W.id, name: W.name, idea: W.idea, source: W.source, seal: W.seal, young: !!W.young, nights: [], started: new Date().toISOString() };
  log.port = port;
  const earlier = before ? before.calls || [] : [];
  const t0 = Date.now();
  const save = () => {
    log.seconds = (before ? before.seconds || 0 : 0) + Math.round((Date.now() - t0) / 1000);
    log.calls = [...earlier, ...mine];
    log.errors = TV.errors;
    log.failed = TV.failed;
    log.outside = TV.outside;
    writeFileSync(join(out, 'results.json'), JSON.stringify(log, null, 2));
  };
  try {
    await TV.start({ clean: FROM === 1 });
    if (W.clock && FROM === 1) await TV.day(timeOf(W, W.nights[0]));
    log.painter = FROM === 1 ? await TV.newPainter({ seal: W.seal, young: !!W.young }) : (await TV.pick(W.seal)).painter;
    for (const [i, N] of W.nights.slice(FROM - 1, NIGHTS).entries()) {
      const n = FROM + i;
      // a later day: the TV turned on again, and their seal chosen
      if (W.clock && timeOf(W, N) > (await TV.now()) + 60000) {
        await TV.day(timeOf(W, N));
        await TV.pick(W.seal);
      }
      const night = await TV.night({ ...N, title: N.dream, person: personFor(N) }, n);
      night.said = N.words.map((w) => w.text).concat(N.ending ? (N.ending.words || []).map((w) => w.text) : []);
      log.nights.push(night);
      if (KEEP) save();
      console.log(`${W.id} night ${n} (${night.seconds}s): ${(night.main.heard || []).map((h) => h.title).join(' / ')}${night.main.guideError ? ` [storyteller not reached: ${night.main.guideError}]` : ''}`);
    }
    const last = log.nights.length ? log.nights[log.nights.length - 1].night : 0;
    const canWalk = await TV.tv(() => !!(window.__inktv.atlas && window.__inktv.atlas.actions.includes('Walk through your world')));
    log.home = await TV.visit({ prefix: KEEP ? `w${String(last).padStart(2, '0')}` : '20', walk: canWalk, most: 2 });
    await TV.seals();
    log.book = await TV.journal(W.seal, KEEP ? `b${String(last).padStart(2, '0')}-book.png` : '24-book.png');
    log.world = await TV.tv(() => Object.keys(localStorage).filter((k) => k.startsWith('inkwash.world')).map((k) => JSON.parse(localStorage.getItem(k))));
  } catch (err) {
    log.error = String((err && err.stack) || err).slice(0, 2000);
    log.lastSaid = TV.said.slice(-60);
    // how many nights their world has kept, so a run that goes on knows whether the night it
    // stopped in was kept before it stopped
    log.keptNights = await Promise.race([TV.tv(() => window.__inktv.world && window.__inktv.world.nights), new Promise((ok) => setTimeout(() => ok(null), 10000))]).catch(() => null);
    log.where = await Promise.race([TV.tv(() => ({ mode: window.__inktv.mode, running: window.__inktv.guide.running, tell: window.__inktv.tell && { i: window.__inktv.tell.i, title: window.__inktv.tell.title } })), new Promise((ok) => setTimeout(() => ok('the page did not answer in 10 s'), 10000))]).catch((e) => String(e));
    await Promise.race([TV.shot('99-where-it-stopped.png'), new Promise((ok) => setTimeout(ok, 15000))]).catch(() => {});
    console.log(`${W.id}: stopped: ${String(err && err.message).slice(0, 300)}`);
  } finally {
    save();
    await TV.close();
  }
  return log;
}

const made = (w) => { try { const r = JSON.parse(readFileSync(join(OUT, w.id, 'results.json'), 'utf8')); return !r.error && r.nights.length >= NIGHTS; } catch { return false; } };
const queue = WORLDS.filter((w) => (!only || only.includes(w.id)) && !(process.env.RESUME && made(w)));
const done = [];
await Promise.all(Array.from({ length: Math.min(LANES, queue.length) }, async (_, lane) => {
  for (let W = queue.shift(); W; W = queue.shift()) done.push(await makeWorld(W, (Number(process.env.PORT) || 5310) + lane * 10));
}));
writeFileSync(join(OUT, 'worlds.json'), JSON.stringify(done.map((w) => ({ id: w.id, name: w.name, seconds: w.seconds, nights: w.nights.length, error: w.error || null })), null, 2));
const by = (k) => calls.reduce((m, c) => ((m[c[k]] = (m[c[k]] || 0) + 1), m), {});
console.log(`done: ${done.length} worlds, ${done.reduce((n, w) => n + w.nights.length, 0)} nights; ${done.filter((w) => w.error).length} stopped; model calls ${JSON.stringify(by('family'))}`);
