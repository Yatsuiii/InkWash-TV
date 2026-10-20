// Three grown-ups share one TV, each with their own seal and world, and paint twelve nights between
// them, to see how the app takes what grown-ups bring: a night dreamer (Moon), a writer building
// a world for a story (Bird), and a daydreamer (Wave). The real page, brush, ink, harness and story
// server code, driven by scripted remote presses (painted-nights.mjs); the storyteller and the
// Worldbuilder are scripts, so no model is called and nothing costs anything.
//
// The nights are made up, from what research says grown-ups dream and imagine: the typical dreams
// (finding rooms in your home you never knew were there, arriving too late, an exam never studied
// for, someone who has died alive again and ordinary), writers who take what they dream and build a
// world from it, night after night, and the daydreams people most often have (leaving work for a
// house by the sea, being cheered on a stage, a journey with someone they love). No real person's
// dream is copied.
//
// Some tellings are told first the way a model might tell them (`first`): carelessly, explaining
// what the dream meant or with nothing of theirs in it, which the TV should send back; or naturally,
// with words a grown-up's telling uses all the time ("you realized", "you knew that", "because"),
// to see whether the TV sends those back too.
//
//   node scripts/grown-dreams.mjs      screenshots and results in test-shots/grown/
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openTV, R, UP, DOWN, wavy } from './painted-nights.mjs';

const OUT = fileURLToPath(new URL('../test-shots/grown/', import.meta.url));

// ---------------------------------------------------------------- the night dreamer: Moon

const DOOR = { at: [700, 900], heading: UP, ms: 2600, press: 400, ink: 'dense' };
const ROOMS = { at: [760, 720], heading: R, ms: 4200, ink: 'light', steer: wavy(4200, 900, 200) };
const MOON = [
  {
    title: 'The Rooms Behind the Bookcase',
    dream: 'There was a door behind my bookcase, and behind it a whole floor of rooms I never knew we had, dusty, with a piano at the far end.',
    strokes: [
      { at: [260, 900], heading: UP, ms: 2600, ink: 'dense' },
      { at: [480, 900], heading: UP, ms: 2600 },
      { at: [260, 640], heading: R, ms: 1400 },
      DOOR, ROOMS,
      { at: [1320, 760], heading: R, ms: 300, press: 1300, ink: 'dense' },
    ],
    words: [{ after: 2, text: 'there was a door behind my bookcase' }, { after: 5, text: 'a whole floor of rooms i never knew we had' }],
    marks: { 3: ['ArrowUp', 'ArrowRight'], 4: ['ArrowUp'], 5: ['ArrowDown'] },
    guide: {
      asks: [{ question: 'What was this, at the end of the rooms?', choices: ['a piano', 'a bed', 'a wardrobe'], answer: 'a piano', strokes: [6] }],
      // told naturally: "you realized" is how a dream is told
      first: [
        { text: 'Behind your bookcase there was a door you had never seen.', strokes: [1, 2, 3, 4] },
        { text: 'Through it, a whole floor of rooms you never knew you had.', strokes: [5] },
        { text: 'You realized they had been there all along, under the dust.', strokes: [5] },
        { text: 'At the far end stood a piano, pressed down into the dark.', strokes: [6] },
      ],
      lines: [
        { text: 'Behind your bookcase there was a door you had never seen.', strokes: [1, 2, 3, 4] },
        { text: 'Through it, a whole floor of rooms you never knew you had.', strokes: [5] },
        { text: 'They had been there all along, under the dust.', strokes: [5] },
        { text: 'At the far end stood a piano, pressed down into the dark.', strokes: [6] },
      ],
      remember: {
        things: [
          { name: 'the hidden rooms', kind: 'place', aliases: ['rooms'], strokes: [5], why: 'a whole floor they never knew they had' },
          { name: 'the bookcase door', kind: 'thing', aliases: ['door'], strokes: [4] },
          { name: 'the piano', kind: 'thing', aliases: ['piano'], strokes: [6] },
        ],
        facts: [{ about: 'the hidden rooms', text: 'They were behind your bookcase all along.', open: true }],
      },
    },
  },
  {
    title: 'Late for the Exam',
    dream: 'I was late for a maths exam I had never studied for, and the corridor kept getting longer. A huge clock was going round over my head.',
    strokes: [
      { at: [120, 300], heading: 0.28, ms: 4200, ink: 'dense' },
      { at: [120, 860], heading: -0.28, ms: 4200 },
      { at: [800, 170], heading: R, ms: 2600, ink: 'gold', steer: [['ArrowRight', 150, 2600]] },
      { at: [1250, 600], heading: R, ms: 700, press: 500, ink: 'dense' },
    ],
    words: [{ after: 1, text: 'i was late for a maths exam i never studied for' }, { after: 2, text: 'the corridor kept getting longer' }],
    marks: { 0: ['ArrowDown', 'ArrowRight'], 1: ['ArrowDown', 'ArrowRight'], 2: ['ArrowDown', 'ArrowRight'], 3: ['ArrowDown'] },
    guide: {
      asks: [{ question: 'What was waiting at the end?', choices: ['the exam room', 'my old teacher', 'a locked door'], answer: 'the exam room', strokes: [4] }],
      // as a model might carelessly tell it: what the dream meant
      first: [
        { text: 'The corridor kept getting longer, and you were late.', strokes: [1, 2] },
        { text: 'Deep down, you knew you were never ready for this.', strokes: [3] },
        { text: 'At the end, the exam room, and a paper you never studied for.', strokes: [4] },
      ],
      // a grown-up's telling may make what they marked darker huge: no child is listening
      lines: [
        { text: 'You were late for a maths exam, and the corridor kept getting longer.', strokes: [1, 2] },
        { text: 'The clock above you was huge, going round and round in gold.', strokes: [3] },
        { text: 'At the end, the exam room, and a paper you never studied for.', strokes: [4] },
      ],
      remember: {
        things: [
          { name: 'the long corridor', kind: 'place', aliases: ['corridor'], strokes: [1, 2], why: 'it kept getting longer as they ran late' },
          { name: 'the clock', kind: 'thing', aliases: ['clock'], strokes: [3] },
          { name: 'the exam room', kind: 'place', strokes: [4] },
        ],
      },
    },
  },
  {
    title: 'Grandmother’s Kitchen',
    dream: 'My grandmother was making tea in her kitchen like she had never died. I knew she had, and I did not say it. She told me to keep the piano.',
    strokes: [
      { at: [980, 220], heading: R, ms: 2000, ink: 'light' },
      { at: [980, 220], heading: DOWN, ms: 1500, ink: 'light' },
      { at: [220, 760], heading: R, ms: 2400, ink: 'dense', press: 300 },
      { at: [640, 820], heading: UP, ms: 1900, ink: 'dense', press: 700 },
      { at: [430, 700], heading: UP, ms: 1800, ink: 'light', steer: wavy(1800, 450, 160) },
    ],
    words: [{ after: 4, text: 'my grandmother was making tea like she never died' }, { after: 5, text: 'she told me to keep the piano' }],
    marks: { 3: ['ArrowUp'], 4: ['ArrowUp'] },
    guide: {
      asks: [{ question: 'Who was this, at the stove?', choices: ['my grandmother', 'my mother', 'a stranger'], answer: 'my grandmother', strokes: [4] }],
      // told naturally: knowing someone has died, in the dream, is part of what happened
      first: [
        { text: 'Your grandmother was at the stove, making tea like she never died.', strokes: [4] },
        { text: 'You knew that she had died, and you did not say it.', strokes: [4] },
        { text: 'Steam came off the pot, and she told you to keep the piano.', strokes: [5] },
      ],
      lines: [
        { text: 'Your grandmother was at the stove, making tea like she never died.', strokes: [4] },
        { text: 'The window was full of light, and you did not say a word.', strokes: [1, 2] },
        { text: 'Steam came off the pot, and she told you to keep the piano.', strokes: [5] },
      ],
      remember: {
        things: [
          { name: 'Grandmother', kind: 'person', aliases: ['grandmother', 'my grandmother'], strokes: [4], why: 'she was making tea like she never died' },
          { name: 'her kitchen', kind: 'place', aliases: ['kitchen'], strokes: [3, 1] },
        ],
        facts: [{ about: 'Grandmother', text: 'She told you to keep the piano.' }],
      },
    },
  },
  {
    title: 'The Rooms Again',
    dream: 'The rooms behind the bookcase were back, and this time there were stairs at the end, going all the way down to the sea.',
    strokes: [
      { ...DOOR, at: [710, 900] }, { ...ROOMS, at: [770, 720] },
      { at: [1150, 640], heading: 1.1, ms: 2400, ink: 'dense', steer: [['ArrowRight', 400, 600], ['ArrowLeft', 900, 1100], ['ArrowRight', 1400, 1600], ['ArrowLeft', 1900, 2100]] },
      { at: [700, 930], heading: R, ms: 5000, ink: 'indigo', steer: wavy(5000, 700, 220) },
    ],
    words: [{ after: 2, text: 'the rooms were back and this time there were stairs' }, { after: 4, text: 'the stairs went all the way down to the sea' }],
    marks: { 1: ['ArrowUp', 'ArrowRight'], 3: ['ArrowUp'] },
    guide: {
      sameAs: 'the hidden rooms', at: 2,
      asks: [],
      lines: [
        { text: 'The hidden rooms were back, behind the same door.', strokes: [1, 2] },
        { text: 'This time there were stairs at the end of them.', strokes: [3] },
        { text: 'The stairs went all the way down to the sea.', strokes: [3, 4] },
      ],
      remember: {
        things: [
          { ref: 'the hidden rooms', strokes: [2], why: 'they came back, with stairs down to the sea' },
          { ref: 'the bookcase door', strokes: [1] },
          { name: 'the stairs to the sea', kind: 'place', aliases: ['stairs'], strokes: [3, 4] },
        ],
      },
    },
    // what happens next, painted: a lamp lit in the last room
    ending: {
      strokes: [{ at: [1000, 640], heading: R, ms: 200, press: 900, ink: 'gold' }],
      marks: { 0: ['ArrowUp'] },
      guide: {
        asks: [{ question: 'What happened next?', choices: ['I lit a lamp and stayed', 'I went down to the sea', 'I woke up'], answer: 'I lit a lamp and stayed' }],
        lines: [
          { text: 'The hidden rooms were back, behind the same door.', strokes: [1, 2] },
          { text: 'This time there were stairs at the end of them.', strokes: [3] },
          { text: 'The stairs went all the way down to the sea.', strokes: [3, 4] },
          { text: 'Then you lit a lamp in the last room, and stayed.', strokes: [5] },
        ],
        remember: { things: [{ ref: 'the hidden rooms', strokes: [5], why: 'they lit a lamp there and stayed' }], settles: 'They were behind your bookcase all along.' },
      },
    },
  },
];

// ---------------------------------------------------------------- the writer: Bird

const ILSE = [
  { at: [1260, 620], heading: UP, ms: 700, ink: 'dense', press: 300 },
  { at: [1290, 500], heading: R, ms: 120, press: 600, ink: 'gold' },
];
const VALLEY = { at: [80, 900], heading: R, ms: 7200, ink: 'indigo', steer: wavy(7200, 900, 240) };
const BIRD = [
  {
    title: 'The City on Stilts',
    dream: 'A city on stilts over a drowned valley, joined by rope bridges. Ilse the lamplighter lights the bridges at dusk.',
    strokes: [
      VALLEY,
      { at: [380, 950], heading: UP, ms: 2600, ink: 'dense' },
      { at: [560, 950], heading: UP, ms: 2600 },
      { at: [740, 950], heading: UP, ms: 2600 },
      { at: [330, 560], heading: R, ms: 3000 },
      { at: [800, 560], heading: R, ms: 2600, ink: 'light', steer: [['ArrowRight', 300, 700], ['ArrowLeft', 1500, 1900]] },
      ...ILSE,
    ],
    words: [{ after: 5, text: 'the whole city stands on stilts over the drowned valley' }, { after: 8, text: 'ilse the lamplighter lights the rope bridges at dusk' }],
    marks: { 0: ['ArrowDown'], 6: ['ArrowUp', 'ArrowRight'] },
    guide: {
      asks: [{ question: 'Who is this, on the bridge?', choices: ['Ilse, the lamplighter', 'a guard', 'a stranger'], answer: 'Ilse, the lamplighter', strokes: [7, 8] }],
      // told naturally: a story world runs on why
      first: [
        { text: 'Under everything lay the drowned valley, deep and still.', strokes: [1] },
        { text: 'Above it the whole city stood on stilts.', strokes: [2, 3, 4, 5] },
        { text: 'Ilse the lamplighter crossed the rope bridge at dusk.', strokes: [6, 7] },
        { text: 'Her lamp burned gold, because the bridges are never left dark.', strokes: [8] },
      ],
      lines: [
        { text: 'Under everything lay the drowned valley, deep and still.', strokes: [1] },
        { text: 'Above it the whole city stood on stilts.', strokes: [2, 3, 4, 5] },
        { text: 'Ilse the lamplighter crossed the rope bridge at dusk.', strokes: [6, 7] },
        { text: 'Her lamp burned gold, and no bridge was ever left dark.', strokes: [8] },
      ],
      remember: {
        things: [
          { name: 'the stilt city', kind: 'place', aliases: ['the city', 'city'], strokes: [2, 3, 4, 5], why: 'it stands on stilts over the drowned valley' },
          { name: 'the drowned valley', kind: 'place', aliases: ['valley'], strokes: [1] },
          { name: 'Ilse', kind: 'person', aliases: ['the lamplighter', 'lamplighter'], strokes: [7, 8], why: 'she lights the rope bridges at dusk' },
          { name: 'the rope bridges', kind: 'thing', aliases: ['bridges', 'bridge'], strokes: [6] },
        ],
        facts: [{ about: 'Ilse', text: 'She lights the rope bridges at dusk.' }],
      },
    },
  },
  {
    title: 'The Tide Bell',
    dream: 'The tide bell at the top of the tower rings when the water rises. Ilse climbs up and rings it by hand.',
    strokes: [
      { at: [700, 920], heading: UP, ms: 3400, ink: 'dense' },
      { at: [700, 390], heading: R, ms: 150, press: 1000, ink: 'gold' },
      { ...VALLEY, ms: 6600 },
      ...ILSE,
    ],
    words: [{ after: 2, text: 'the tide bell rings when the water rises' }, { after: 5, text: 'ilse climbs up to ring it by hand' }],
    marks: { 2: ['ArrowDown', 'ArrowRight'], 3: ['ArrowUp'] },
    guide: {
      sameAs: 'Ilse', at: 4,
      asks: [],
      lines: [
        { text: 'The tide bell hung at the top of the tower, gold.', strokes: [1, 2] },
        { text: 'The water rises, and the tide bell rings.', strokes: [3] },
        { text: 'Ilse climbed up to ring it by hand.', strokes: [4, 5] },
      ],
      // the third line, not quite: told again
      react: { 2: 'no' },
      again: [{ text: 'Ilse climbed the tower with her lamp, and rang the tide bell by hand, twice.', strokes: [4, 5] }],
      remember: {
        things: [
          { ref: 'Ilse', strokes: [4, 5], why: 'she rang the tide bell by hand' },
          { name: 'the tide bell', kind: 'thing', aliases: ['bell'], strokes: [1, 2], why: 'it rings when the water rises' },
        ],
      },
    },
  },
  {
    title: 'The Drowned Library',
    dream: 'Asked what lies under the drowned valley, I painted my own answer: a library, its shelves under the water, and the books still dry inside a glass dome.',
    start: {
      wonder: {
        about: 'the drowned valley', question: 'What lies under the drowned valley?',
        choices: [
          { say: 'The old city, still lit', fact: 'Under the drowned valley, the old city is still lit.' },
          { say: 'A sleeping whale', fact: 'A whale sleeps under the drowned valley.' },
          { say: 'The first tide bell', fact: 'The first tide bell lies under the drowned valley.' },
        ],
        choose: 'own',
      },
    },
    strokes: [
      { at: [80, 260], heading: R, ms: 7000, ink: 'indigo', steer: wavy(7000, 900, 240) },
      { at: [300, 900], heading: UP, ms: 3000, ink: 'dense' },
      { at: [520, 900], heading: UP, ms: 3000 },
      { at: [740, 900], heading: UP, ms: 3000 },
      { at: [1100, 700], heading: UP, ms: 3200, ink: 'light', steer: [['ArrowRight', 300, 3200]] },
      { at: [1250, 760], heading: R, ms: 200, press: 900, ink: 'gold' },
    ],
    words: [{ after: 4, text: 'under the valley there is a drowned library' }, { after: 6, text: 'the books are still dry inside a glass dome' }],
    marks: { 4: ['ArrowUp'], 5: ['ArrowUp', 'ArrowRight'] },
    guide: {
      asks: [],
      lines: [
        { text: 'Under the drowned valley there is a library.', strokes: [2, 3, 4] },
        { text: 'Its shelves stand in the dark water, row after row.', strokes: [2, 3, 4] },
        { text: 'But inside a glass dome, the books are still dry.', strokes: [5, 6] },
      ],
      remember: {
        things: [
          { name: 'the drowned library', kind: 'place', aliases: ['library'], strokes: [2, 3, 4], why: 'it lies under the drowned valley' },
          { name: 'the glass dome', kind: 'thing', aliases: ['dome'], strokes: [5, 6], why: 'the books inside are still dry' },
        ],
        facts: [{ about: 'the drowned valley', text: 'Under it there is a drowned library.' }],
      },
    },
  },
  {
    title: 'The Last Bridge',
    dream: 'More of Ilse: she walks out alone onto the last bridge, which has never been lit. Then she lights every lamp on it.',
    start: { more: 'Ilse' },
    strokes: [
      { at: [300, 520], heading: R, ms: 5200, ink: 'light', steer: [['ArrowRight', 400, 900], ['ArrowLeft', 3000, 3500]] },
      ...ILSE.map((s) => ({ ...s, at: [s.at[0] - 10, s.at[1]] })),
      { ...VALLEY, ms: 6800 },
    ],
    words: [{ after: 1, text: 'the last bridge has never been lit' }, { after: 3, text: 'ilse walks out onto it alone' }],
    marks: { 0: ['ArrowDown', 'ArrowRight'], 1: ['ArrowDown'] },
    guide: {
      asks: [],
      lines: [
        { text: 'The last bridge had never been lit.', strokes: [1] },
        { text: 'Ilse walked out onto it alone, her lamp held high.', strokes: [2, 3] },
        { text: 'Below her, the drowned valley, black and still.', strokes: [4] },
      ],
      remember: {
        things: [
          { ref: 'Ilse', strokes: [2, 3], why: 'she walked out onto the last bridge alone' },
          { name: 'the last bridge', kind: 'thing', strokes: [1], why: 'it has never been lit' },
          { ref: 'the drowned valley', strokes: [4] },
        ],
        facts: [{ about: 'the last bridge', text: 'It has never been lit.', open: true }],
      },
    },
    ending: {
      strokes: [{ at: [700, 470], heading: R, ms: 150, press: 700, ink: 'gold' }, { at: [1000, 470], heading: R, ms: 150, press: 700, ink: 'gold' }],
      marks: { 0: ['ArrowUp'], 1: ['ArrowUp', 'ArrowRight'] },
      guide: {
        asks: [{ question: 'What happened next?', choices: ['she lit every lamp on it', 'the bridge fell', 'she turned back'], answer: 'she lit every lamp on it' }],
        lines: [
          { text: 'The last bridge had never been lit.', strokes: [1] },
          { text: 'Ilse walked out onto it alone, her lamp held high.', strokes: [2, 3] },
          { text: 'Below her, the drowned valley, black and still.', strokes: [4] },
          { text: 'Then she lit every lamp on it, one by one, to the far side.', strokes: [5, 6] },
        ],
        remember: { things: [{ ref: 'the last bridge', strokes: [5, 6], why: 'Ilse lit every lamp on it' }], settles: 'It has never been lit.' },
      },
    },
  },
];

// ---------------------------------------------------------------- the daydreamer: Wave

const COTTAGE = [
  { at: [1000, 700], heading: UP, ms: 1400, ink: 'dense' },
  { at: [1260, 700], heading: UP, ms: 1400 },
  { at: [960, 500], heading: R, ms: 2300 },
];
const WAVE = [
  {
    title: 'The Cottage by the Sea',
    dream: 'I quit my job and moved to a white cottage by the sea. Every morning I write at the window, and my dog runs on the beach.',
    strokes: [
      { at: [80, 800], heading: R, ms: 6400, ink: 'indigo', steer: wavy(6400, 800, 240) },
      ...COTTAGE,
      { at: [1110, 600], heading: R, ms: 120, press: 500, ink: 'gold' },
      { at: [520, 860], heading: R, ms: 250, press: 500, ink: 'dense' },
    ],
    words: [{ after: 4, text: 'i quit my job and moved to a white cottage by the sea' }, { after: 6, text: 'every morning i write and my dog runs on the beach' }],
    marks: { 4: ['ArrowUp'], 5: ['ArrowUp', 'ArrowRight'] },
    guide: {
      asks: [],
      // as a model might carelessly tell it: nothing of theirs in it
      first: [
        { text: 'A house stood by the water.', strokes: [2, 3, 4] },
        { text: 'Waves rolled in under a quiet sky.', strokes: [1] },
        { text: 'Somewhere, a light was on.', strokes: [5] },
      ],
      lines: [
        { text: 'You had quit your job, and the white cottage by the sea was yours.', alt: 'The white cottage by the sea was yours now, and the job was gone.', strokes: [2, 3, 4] },
        { text: 'Every morning you wrote at the window, in gold light.', strokes: [5] },
        { text: 'Your dog ran on the beach below.', strokes: [6] },
      ],
      remember: {
        things: [
          { name: 'the cottage', kind: 'place', aliases: ['cottage', 'the white cottage'], strokes: [2, 3, 4, 5], why: 'they quit their job to live there' },
          { name: 'the dog', kind: 'creature', aliases: ['dog', 'my dog'], strokes: [6] },
          { name: 'the sea', kind: 'place', strokes: [1] },
        ],
      },
    },
  },
  {
    title: 'The Stage',
    dream: 'I am singing to a huge crowd, the light coming straight down on me, and my old music teacher is in the front row, crying.',
    strokes: [
      { at: [160, 700], heading: R, ms: 8000, ink: 'dense' },
      { at: [820, 80], heading: DOWN, ms: 2600, ink: 'gold' },
      { at: [820, 690], heading: UP, ms: 800, press: 400, ink: 'dense' },
      { at: [120, 880], heading: R, ms: 7600, ink: 'light', steer: wavy(7600, 500, 180) },
      { at: [600, 800], heading: R, ms: 150, press: 600, ink: 'cinnabar' },
    ],
    words: [{ after: 3, text: 'i am singing to a huge crowd' }, { after: 5, text: 'my old music teacher is in the front row crying' }],
    marks: { 2: ['ArrowUp', 'ArrowRight'], 4: ['ArrowUp'] },
    guide: {
      asks: [],
      lines: [
        { text: 'You were singing to a huge crowd, and the stage was yours.', strokes: [1, 3] },
        { text: 'A spotlight came down on you like a pillar.', strokes: [2] },
        { text: 'In the front row, your old music teacher, crying.', strokes: [5] },
      ],
      // the second line, not quite: told again
      react: { 1: 'no' },
      again: [{ text: 'The light came straight down on you, and you sang to the huge crowd.', strokes: [2] }],
      remember: {
        things: [
          { name: 'the stage', kind: 'place', strokes: [1, 2, 3] },
          { name: 'my old music teacher', kind: 'person', aliases: ['music teacher', 'teacher'], strokes: [5], why: 'in the front row, crying' },
          { name: 'the crowd', kind: 'presence', strokes: [4] },
        ],
      },
    },
  },
  {
    title: 'The Night Train to Lisbon',
    dream: 'A night train to Lisbon with Mara. We share an orange and do not say anything, and the windows go by in gold.',
    strokes: [
      { at: [160, 600], heading: R, ms: 7400, ink: 'dense', press: 200 },
      { at: [420, 560], heading: R, ms: 100, press: 400, ink: 'gold' },
      { at: [760, 560], heading: R, ms: 100, press: 400, ink: 'gold' },
      { at: [1100, 560], heading: R, ms: 100, press: 400, ink: 'gold' },
      { at: [900, 440], heading: R, ms: 150, press: 800, ink: 'cinnabar' },
      { at: [100, 180], heading: R, ms: 7400, ink: 'indigo', steer: wavy(7400, 1100, 260) },
    ],
    words: [{ after: 1, text: 'a night train to lisbon with mara' }, { after: 5, text: 'we share an orange and do not say anything' }],
    marks: { 0: ['ArrowUp'], 4: ['ArrowUp', 'ArrowRight'] },
    guide: {
      asks: [{ question: 'What is this, in red?', choices: ['an orange', 'a ticket', 'a lamp'], answer: 'an orange', strokes: [5] }],
      lines: [
        { text: 'A night train to Lisbon, and Mara beside you.', strokes: [1] },
        { text: 'The windows went by in gold, one after another.', strokes: [2, 3, 4] },
        { text: 'You shared an orange and did not say anything.', strokes: [5] },
        { text: 'Outside, the night went on and on.', strokes: [6] },
      ],
      remember: {
        things: [
          { name: 'the night train', kind: 'place', aliases: ['train'], strokes: [1, 2, 3, 4] },
          { name: 'Mara', kind: 'person', strokes: [1], why: 'she was on the night train to Lisbon with them' },
          { name: 'the orange', kind: 'thing', strokes: [5] },
        ],
      },
    },
  },
  {
    title: 'The Garden at the Cottage',
    dream: 'More of the cottage: I planted a garden behind it, tomatoes and red poppies, and the dog sleeps in them.',
    start: { more: 'the cottage' },
    strokes: [
      ...COTTAGE.map((s) => ({ ...s, at: [s.at[0] + 10, s.at[1]] })),
      { at: [300, 820], heading: R, ms: 3400, ink: 'light', steer: wavy(3400, 400, 150) },
      { at: [450, 760], heading: R, ms: 120, press: 400, ink: 'cinnabar' },
      { at: [700, 860], heading: R, ms: 250, press: 500, ink: 'dense' },
    ],
    words: [{ after: 4, text: 'i planted a garden behind the cottage' }, { after: 6, text: 'tomatoes and red poppies and the dog sleeping in them' }],
    marks: { 3: ['ArrowUp'], 4: ['ArrowUp'] },
    guide: {
      asks: [],
      lines: [
        { text: 'Back at the cottage, you planted a garden behind it.', strokes: [1, 2, 3, 4] },
        { text: 'Tomatoes, and red poppies, and the dog asleep in them.', strokes: [5, 6] },
      ],
      remember: {
        things: [
          { ref: 'the cottage', strokes: [1, 2, 3], why: 'they planted a garden behind it' },
          { name: 'the garden', kind: 'place', strokes: [4, 5] },
          { ref: 'the dog', strokes: [6] },
        ],
      },
    },
  },
];

// ---------------------------------------------------------------- one TV, three evenings a week

const PAINTERS = { Moon: MOON, Bird: BIRD, Wave: WAVE };
// a family's evenings: each paints in turn
// (NIGHTS=3 paints only the first three, for a quick look)
const EVENINGS = [0, 1, 2, 3].flatMap((i) => Object.entries(PAINTERS).map(([seal, nights]) => ({ seal, ...nights[i], who: seal }))).slice(0, Number(process.env.NIGHTS) || undefined);

const TV = await openTV({ out: OUT, port: 5195, guidePort: 5196 });
const results = [], made = new Set();
// the worlds on this TV, by painter, as kept
const worlds = () => TV.tv(() => Object.keys(localStorage).filter((k) => k.startsWith('inkwash.world')).map((k) => ({ key: k, world: JSON.parse(localStorage.getItem(k)) })));
try {
  await TV.start();
  for (const [i, N] of EVENINGS.entries()) {
    if (i) await TV.seals();
    if (made.has(N.seal)) await TV.pick(N.seal);
    else { await TV.newPainter({ seal: N.seal }); made.add(N.seal); }
    const log = await TV.night(N, i + 1);
    results.push(log);
    const tellings = [log.main, log.ending].filter(Boolean).flatMap((x) => x.tellings || []);
    const sent = tellings.filter((t) => t.sentBack).map((t) => t.sentBack.replace(/^Sent back, not told\. /, '').split('. ')[0]);
    const held = (log.main.checks || []).flatMap((c) => c.held || []);
    console.log(`night ${log.night} (${N.seal}): ${N.title} (${log.seconds} s): recognised ${log.main.recognised}, sent back ${sent.length}${sent.length ? ` [${sent.join(' | ')}]` : ''}${held.length ? `, held back ${held}` : ''}${log.main.notQuite ? `, not quite ${log.main.notQuite} told again` : ''}, cards ${JSON.stringify(log.cards)}`);
  }

  // each world as it stands, the writer's walked through; and each painter's journal
  const homes = {};
  for (const seal of Object.keys(PAINTERS)) {
    await TV.seals();
    await TV.pick(seal);
    homes[seal] = await TV.visit({ prefix: `20-${seal.toLowerCase()}`, walk: seal === 'Bird' });
  }
  await TV.seals();
  const journals = {};
  for (const seal of Object.keys(PAINTERS)) journals[seal] = await TV.journal(seal, `24-${seal.toLowerCase()}-journal.png`);

  // a later day: Moon's last night was yesterday, and is offered again, as a series' last episode
  const moonKey = (await worlds()).find((w) => w.world.nights.some((n) => n.title === MOON[0].title)).key;
  await TV.tv((k) => {
    const w = JSON.parse(localStorage.getItem(k)), day = 26 * 3600000, last = w.nights[w.nights.length - 1];
    last.at -= day;
    if (last.ending) last.ending.at -= day;
    localStorage.setItem(k, JSON.stringify(w));
  }, moonKey);
  await TV.reopen();
  const back = await TV.pick('Moon');
  const recap = { home: back.home.about, actions: back.home.actions };
  // their world, lit again, as the TV comes back on
  const t0 = Date.now();
  await TV.until(() => window.__inktv.atlas && window.__inktv.atlas.pictures >= window.__inktv.atlas.things.length, null, 60000).catch(() => {});
  recap.lit = { pictures: (await TV.tv(() => window.__inktv.atlas.pictures)), of: back.home.things.length, seconds: Math.round((Date.now() - t0) / 100) / 10 };
  await TV.wait(1500);
  await TV.shot('25-moon-a-later-day.png');
  if (back.home.actions.includes('Hear last time’s story')) {
    await TV.act('Hear last time’s story');
    await TV.until(() => window.__inktv.previously, null, 8000).catch(() => {});
    recap.previously = await TV.tv(() => window.__inktv.previously);
    await TV.wait(2800);
    await TV.shot('25-moon-b-previously.png');
    await TV.key('Enter');
    await TV.until(() => window.__inktv.recap && window.__inktv.recap.i === 0, null, 10000);
    const r = await TV.tv(() => window.__inktv.recap);
    recap.title = r.title;
    recap.lines = [];
    for (let k = 0; k < r.n; k++) {
      recap.lines.push(await TV.tv(() => window.__inktv.recap.text));
      if (k === r.n - 1) await TV.shot('25-moon-c-heard-again.png');
      await TV.key('Enter');
    }
    await TV.until(() => window.__inktv.mode === 'offer', null, 10000).catch(() => {});
    recap.offer = await TV.tv(() => ({ mode: window.__inktv.mode, chips: [...document.querySelectorAll('#feel .chip')].map((c) => c.textContent) }));
  }

  const kept = (await worlds()).map(({ key, world: w }) => ({
    key, nights: w.nights.map((x) => ({ n: x.n, title: x.title, lines: (x.lines || []).map((l) => `${l.reaction === 'no' ? '(not quite) ' : ''}${l.text}`), ending: x.ending ? x.ending.lines.map((l) => l.text) : null, asked: x.asked })),
    entities: w.entities.map((e) => ({ name: e.name, kind: e.kind, nights: [...new Set([...(e.appearances || []), ...(e.endings || [])].map((a) => a.night))], status: e.status })),
    facts: w.facts.map((f) => ({ about: (w.entities.find((e) => e.id === f.entity) || {}).name, text: f.text, source: f.source, open: !!f.thread && f.to == null })),
    asked: (w.wonders || w.asked || null),
  }));
  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ nights: results, homes, journals, recap, worlds: kept, failed: TV.failed, errors: TV.errors, outside: TV.outside }, null, 2));
  for (const [seal, h] of Object.entries(homes)) console.log(`${seal}'s world: ${h.home.atlas.things.length} things, ${h.home.lit} lit${h.walked ? `; walked to ${h.walked.length}` : ''}; journal ${journals[seal] ? journals[seal].things.length : 0} things`);
  console.log(`a later day: ${JSON.stringify({ actions: recap.actions, title: recap.title, heard: recap.lines && recap.lines.length })}`);
  console.log(`errors: ${JSON.stringify(TV.errors)}; the service answered: ${JSON.stringify(TV.failed)}; fetched from outside: ${JSON.stringify(TV.outside)}`);
} finally {
  await TV.close();
}
