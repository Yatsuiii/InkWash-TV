// Ten children's dreams, painted on the TV by one child, a night each, to see how the app takes
// them: the real page, brush, ink, harness and story server code, driven by scripted remote
// presses (painted-nights.mjs), the way scripts/demo.mjs paints the demo family. The storyteller is
// a script too: it calls the storyteller's tools as Claude would and tells lines written here, so
// no model is called and nothing costs anything. Where a night has a `first` telling, that is told
// first, the way a model might tell it carelessly, to see whether the TV's checks for a child send
// it back.
//
// The dreams are made up, from what research and parents' reports say young children dream: animals
// (most often dogs, cats and horses, sometimes bigger than life or talking), the people they know,
// being chased by a monster, falling, being lost, flying, and the wonderfully strange (riding a
// dinosaur to school, candy falling from the sky). No real child's dream is copied.
//
//   node scripts/kids-dreams.mjs      screenshots and results in test-shots/kids/
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openTV, R, L, UP, DOWN, wavy } from './painted-nights.mjs';

const OUT = fileURLToPath(new URL('../test-shots/kids/', import.meta.url));

// ---------------------------------------------------------------- the dreams

// the big dog, the same way both nights it came
const DOG = [
  { at: [480, 640], heading: R, ms: 2400, ink: 'dense', steer: [['ArrowLeft', 300, 480], ['ArrowRight', 1500, 1680]] },
  { at: [850, 590], heading: R, ms: 150, press: 1500 },
  { at: [540, 655], heading: DOWN, ms: 900 },
  { at: [760, 655], heading: DOWN, ms: 900 },
];
// Each night, as painted-nights.mjs paints it.
const NIGHTS = [
  {
    title: 'My Dog Got Big',
    dream: 'My dog got as big as our house, and he could talk. He said hello in a deep voice, and I rode on his back to Grandma’s.',
    strokes: [...DOG, { at: [1250, 790], heading: UP, ms: 1500, ink: 'dense' }, { at: [1300, 690], heading: R, ms: 120, press: 900, ink: 'gold' }],
    words: [{ after: 2, text: 'my dog got really big and he could talk' }, { after: 5, text: 'we went to grandma’s house' }],
    marks: { 0: ['ArrowUp'], 1: ['ArrowUp', 'ArrowRight'], 5: ['ArrowUp'] },
    guide: {
      asks: [{ question: 'Who was this?', choices: ['my dog', 'a horse', 'a bear'], answer: 'my dog', strokes: [1, 2] }],
      lines: [
        { text: 'Your dog was there, and he got really, really big.', strokes: [1, 2, 3, 4] },
        { text: 'He could talk! He said hello in a big, deep voice.', strokes: [2] },
        { text: 'You rode on his back all the way to Grandma’s house.', strokes: [5] },
        { text: 'Everything held still there, and her window glowed gold.', strokes: [6] },
      ],
      remember: { things: [{ name: 'the big dog', kind: 'creature', aliases: ['dog'], strokes: [1, 2, 3, 4], why: 'he got really big and could talk' }, { name: 'Grandma’s house', kind: 'place', strokes: [5, 6] }], facts: [{ about: 'the big dog', text: 'He could talk.' }] },
    },
  },
  {
    title: 'The Monster in the Hall',
    dream: 'A big monster chased me down the hall at school. I hid under the slide. Then my mum came and it went away.',
    strokes: [
      { at: [160, 780], heading: R, ms: 6200, ink: 'light' },
      { at: [330, 760], heading: UP, ms: 1700, ink: 'dense', press: 1000, steer: [['ArrowRight', 300, 480], ['ArrowLeft', 700, 1000], ['ArrowRight', 1200, 1380]] },
      { at: [980, 560], heading: 0.75, ms: 1700, ink: 'dense' },
      { at: [1110, 745], heading: R, ms: 120, press: 700, ink: 'cinnabar' },
      { at: [1420, 790], heading: UP, ms: 1500, ink: 'gold' },
    ],
    words: [{ after: 2, text: 'a monster was chasing me' }],
    marks: { 1: ['ArrowDown', 'ArrowRight'], 3: ['ArrowDown'], 4: ['ArrowUp'] },
    guide: {
      asks: [
        { question: 'Where did you hide?', choices: ['under the slide', 'behind a door', 'in a box'], answer: 'under the slide', strokes: [3, 4] },
        { question: 'Who came?', choices: ['my mum', 'my teacher', 'my dog'], answer: 'my mum', strokes: [5] },
      ],
      // as a model might carelessly tell it: what scared them, bigger and closer
      first: [
        { text: 'You were at school, in the long hall.', strokes: [1] },
        { text: 'The monster was huge, and it came closer and closer.', strokes: [2] },
        { text: 'You hid under the slide.', strokes: [3, 4] },
        { text: 'Then your mum came, and the monster went away.', strokes: [5] },
      ],
      lines: [
        { text: 'You were at school, in the long hall.', strokes: [1] },
        { text: 'A monster was chasing you, but it was slow, and you were quick.', strokes: [2] },
        { text: 'You hid under the slide, small and safe.', strokes: [3, 4] },
        { text: 'Then your mum came, and the monster went away.', strokes: [5] },
      ],
      remember: { things: [{ name: 'the monster', kind: 'creature', strokes: [2], why: 'it chased them down the hall at school' }, { name: 'the slide', kind: 'thing', strokes: [3] }, { name: 'Mum', kind: 'person', aliases: ['my mum', 'mum', 'mom'], strokes: [5], why: 'she came, and the monster went away' }], facts: [{ about: 'the monster', text: 'It chased you down the hall at school.', open: true }] },
    },
    // what happens next, painted: the monster, small
    ending: {
      strokes: [{ at: [700, 740], heading: R, ms: 120, press: 450, ink: 'dense' }],
      marks: { 0: ['ArrowUp'] },
      guide: {
        asks: [{ question: 'What happened next?', choices: ['the monster got tiny', 'it ran away', 'we were friends'], answer: 'the monster got tiny' }],
        lines: [
          { text: 'You were at school, in the long hall.', strokes: [1] },
          { text: 'A monster was chasing you, but it was slow, and you were quick.', strokes: [2] },
          { text: 'You hid under the slide, small and safe.', strokes: [3, 4] },
          { text: 'Then your mum came, and the monster went away.', strokes: [5] },
          { text: 'Then the monster got tiny, and it said sorry.', strokes: [6] },
        ],
        remember: { things: [{ ref: 'the monster', strokes: [6], why: 'it got tiny and said sorry' }], settles: 'It chased you down the hall at school.' },
      },
    },
  },
  {
    title: 'Raining Candy',
    dream: 'It rained candy out of the clouds, red and yellow, and I caught it in my hat.',
    strokes: [
      { at: [380, 230], heading: R, ms: 3800, ink: 'light', steer: wavy(3800) },
      { at: [520, 420], heading: R, ms: 100, press: 450, ink: 'cinnabar' },
      { at: [760, 520], heading: R, ms: 100, press: 450, ink: 'gold' },
      { at: [980, 400], heading: R, ms: 100, press: 450, ink: 'cinnabar' },
      { at: [1180, 500], heading: R, ms: 100, press: 450, ink: 'gold' },
      { at: [700, 860], heading: R, ms: 1300, press: 500, ink: 'indigo' },
    ],
    words: [],
    marks: { 1: ['ArrowUp', 'ArrowRight'], 2: ['ArrowUp', 'ArrowRight'], 3: ['ArrowUp', 'ArrowRight'], 4: ['ArrowUp', 'ArrowRight'], 5: ['ArrowUp'] },
    guide: {
      asks: [
        { question: 'What was falling?', choices: ['candy', 'rain', 'snow'], answer: 'candy', strokes: [2, 3, 4, 5] },
        { question: 'What is this, at the bottom?', choices: ['my hat', 'a boat', 'the ground'], answer: 'my hat', strokes: [6] },
      ],
      lines: [
        { text: 'A soft cloud floated over you.', strokes: [1] },
        { text: 'Then it rained candy, red and gold!', strokes: [2, 3, 4, 5] },
        { text: 'You caught the candy in your hat.', strokes: [6] },
      ],
      remember: { things: [{ name: 'the candy cloud', kind: 'thing', strokes: [1], why: 'it rained candy' }, { name: 'the hat', kind: 'thing', strokes: [6], why: 'it caught the candy' }] },
    },
  },
  {
    title: 'The Dinosaur Bus',
    dream: 'I rode a dinosaur to school, but it was too big to fit through the door, so we went to the park instead.',
    strokes: [
      { at: [260, 760], heading: -0.35, ms: 3000, ink: 'dense', press: 900, steer: [['ArrowLeft', 1800, 2200]] },
      { at: [270, 765], heading: L - 0.3, ms: 800 },
      { at: [380, 735], heading: DOWN, ms: 700 },
      { at: [480, 705], heading: DOWN, ms: 800 },
      { at: [1250, 830], heading: UP, ms: 1800, ink: 'dense' },
      { at: [1190, 600], heading: R, ms: 900 },
    ],
    words: [{ after: 6, text: 'it was too big for the school door' }],
    marks: { 0: ['ArrowUp', 'ArrowRight'], 4: ['ArrowUp'] },
    guide: {
      asks: [{ question: 'What were you riding?', choices: ['a dinosaur', 'a giraffe', 'a big dog'], answer: 'a dinosaur', strokes: [1] }],
      lines: [
        { text: 'You rode a dinosaur, with a long, long neck.', strokes: [1, 2, 3, 4] },
        { text: 'It took you all the way to school.', strokes: [5, 6] },
        { text: 'But it was too big for the door, so you went to the park.', strokes: [5, 6] },
      ],
      remember: { things: [{ name: 'the dinosaur', kind: 'creature', aliases: ['dinosaur', 'dino'], strokes: [1, 2, 3, 4], why: 'it was too big for the school door' }, { name: 'school', kind: 'place', strokes: [5, 6] }] },
    },
  },
  {
    title: 'Falling Down and Down',
    dream: 'I fell off my bed and kept falling down and down, but I landed on a big soft cloud.',
    strokes: [
      { at: [560, 250], heading: R, ms: 1600, ink: 'dense', press: 300 },
      { at: [820, 285], heading: DOWN, ms: 3200, ink: 'light', steer: [['ArrowLeft', 500, 700], ['ArrowRight', 1100, 1400], ['ArrowLeft', 1800, 2100], ['ArrowRight', 2500, 2700]] },
      { at: [520, 840], heading: R, ms: 3400, ink: 'light', steer: wavy(3400) },
      { at: [820, 805], heading: R, ms: 100, press: 600, ink: 'cinnabar' },
    ],
    words: [{ after: 2, text: 'i was falling and falling' }],
    marks: { 1: ['ArrowDown', 'ArrowRight'], 2: ['ArrowUp'], 3: ['ArrowUp'] },
    guide: {
      asks: [{ question: 'Where did you land?', choices: ['on a cloud', 'in the water', 'in my bed'], answer: 'on a cloud', strokes: [3] }],
      // as a model might carelessly tell it: a figure of speech a child could take literally
      first: [
        { text: 'You were in your bed, way up high.', strokes: [1] },
        { text: 'Then you were falling and falling, with your heart in your mouth.', strokes: [2] },
        { text: 'You landed on a big soft cloud.', strokes: [3, 4] },
      ],
      lines: [
        { text: 'You were in your bed, way up high.', strokes: [1] },
        { text: 'Then you were falling and falling, very slowly.', strokes: [2] },
        { text: 'You landed on a big soft cloud, and it held you.', strokes: [3, 4] },
      ],
      remember: { things: [{ name: 'the soft cloud', kind: 'place', strokes: [3], why: 'it caught them when they fell' }, { name: 'the bed', kind: 'thing', strokes: [1] }] },
    },
  },
  {
    title: 'Lost at the Big Shop',
    dream: 'I lost my mum at the big shop. The shelves were super tall. Then I heard her calling my name and I ran to her.',
    strokes: [
      { at: [380, 860], heading: UP, ms: 3000, ink: 'dense' },
      { at: [660, 860], heading: UP, ms: 3000 },
      { at: [940, 860], heading: UP, ms: 3000 },
      { at: [520, 830], heading: R, ms: 100, press: 650, ink: 'cinnabar' },
      { at: [1420, 790], heading: UP, ms: 1500, ink: 'gold' },
    ],
    words: [{ after: 3, text: 'i lost my mum at the big shop' }],
    marks: { 3: ['ArrowDown'], 4: ['ArrowUp'] },
    guide: {
      sameAs: 'Mum', at: 5,
      asks: [{ question: 'Who was calling you?', choices: ['my mum', 'my dad', 'my teacher'], answer: 'my mum', strokes: [5] }],
      // as a model might carelessly tell it: something frightening they never said
      first: [
        { text: 'You were at the big shop, and the shelves were so tall.', strokes: [1, 2, 3] },
        { text: 'You were all alone, and you could not find your mum.', strokes: [4] },
        { text: 'Then you heard Mum calling your name, and you ran to her.', strokes: [5] },
      ],
      lines: [
        { text: 'You were at the big shop, and the shelves were so tall.', strokes: [1, 2, 3] },
        { text: 'You looked and looked for your mum.', strokes: [4] },
        { text: 'Then you heard Mum calling your name, and you ran to her.', strokes: [5] },
      ],
      remember: { things: [{ name: 'the big shop', kind: 'place', strokes: [1, 2, 3], why: 'the shelves were so tall' }, { ref: 'Mum', strokes: [5], why: 'she called their name, and they ran to her' }] },
    },
  },
  {
    title: 'The Monster Came Back Little',
    dream: 'The monster came back, but it was little, and it wanted to play hide and seek.',
    strokes: [
      { at: [700, 740], heading: R, ms: 120, press: 500, ink: 'dense' },
      { at: [980, 560], heading: 0.75, ms: 1700, ink: 'dense' },
      { at: [1300, 200], heading: R, ms: 2600, ink: 'gold', steer: [['ArrowRight', 150, 2600]] },
    ],
    words: [{ after: 1, text: 'the monster came back but it was little' }],
    marks: { 0: ['ArrowUp'], 2: ['ArrowUp', 'ArrowRight'] },
    guide: {
      sameAs: 'the monster', at: 1,
      asks: [{ question: 'Who came back?', choices: ['the monster', 'my dog', 'a friend'], answer: 'the monster', strokes: [1] }],
      lines: [
        { text: 'The monster came back, but now it was little.', strokes: [1] },
        { text: 'It wanted to play hide and seek by the slide.', strokes: [2] },
        { text: 'The sun came out, and you played until it was time to go home.', strokes: [3] },
      ],
      remember: { things: [{ ref: 'the monster', strokes: [1], why: 'it came back little and wanted to play' }, { ref: 'the slide', strokes: [2] }, { name: 'the sun', kind: 'thing', strokes: [3] }] },
    },
  },
  {
    title: 'I Could Fly',
    dream: 'I could fly! I flew over my house with my arms out, and my cat was watching me from the window.',
    strokes: [
      { at: [260, 330], heading: -0.2, ms: 3400, ink: 'cinnabar', steer: [['ArrowRight', 900, 1300], ['ArrowLeft', 1900, 2300], ['ArrowRight', 2800, 3100]] },
      { at: [940, 860], heading: UP, ms: 1300, ink: 'dense' },
      { at: [880, 680], heading: R, ms: 1100 },
      { at: [1010, 780], heading: R, ms: 100, press: 550 },
    ],
    words: [{ after: 1, text: 'i could fly' }],
    marks: { 0: ['ArrowUp', 'ArrowRight'], 3: ['ArrowUp'] },
    guide: {
      asks: [{ question: 'Who was in the window?', choices: ['my cat', 'my mum', 'a bird'], answer: 'my cat', strokes: [4] }],
      lines: [
        { text: 'You could fly!', strokes: [1] },
        { text: 'You could fly over your house, with your arms out wide.', strokes: [1, 2, 3] },
        { text: 'Your cat was in the window, watching you go by.', strokes: [4] },
      ],
      remember: { things: [{ name: 'my house', kind: 'place', strokes: [2, 3] }, { name: 'the cat', kind: 'creature', aliases: ['cat'], strokes: [4], why: 'it watched them fly' }], facts: [{ about: 'my house', text: 'You flew over it.' }] },
    },
  },
  {
    title: 'The Flying Garbage Truck',
    dream: 'The garbage truck turned into an airplane, and we flew through clouds made of ice cream, and a dolphin jumped up out of the sea.',
    strokes: [
      { at: [240, 560], heading: R, ms: 2600, ink: 'dense', press: 400, steer: [['ArrowLeft', 1800, 2200]] },
      { at: [700, 200], heading: R, ms: 1800, ink: 'light', steer: wavy(1800, 500, 200) },
      { at: [1150, 260], heading: R, ms: 1600, ink: 'cinnabar', steer: wavy(1600, 500, 200) },
      { at: [140, 850], heading: R, ms: 6400, ink: 'indigo', steer: wavy(6400, 800, 240) },
      { at: [980, 820], heading: -1.0, ms: 900, ink: 'indigo', steer: [['ArrowRight', 200, 900]] },
    ],
    words: [],
    marks: { 0: ['ArrowUp', 'ArrowRight'], 1: ['ArrowUp'], 4: ['ArrowUp', 'ArrowRight'] },
    guide: {
      asks: [
        { question: 'What did the truck turn into?', choices: ['an airplane', 'a boat', 'a train'], answer: 'an airplane', strokes: [1] },
        { question: 'What were the clouds made of?', choices: ['ice cream', 'cotton', 'smoke'], answer: 'ice cream', strokes: [2, 3] },
      ],
      lines: [
        { text: 'The garbage truck turned into an airplane!', strokes: [1] },
        { text: 'You flew through clouds made of ice cream.', strokes: [2, 3] },
        { text: 'Down in the sea, a dolphin jumped up to say hello.', strokes: [4, 5] },
      ],
      remember: { things: [{ name: 'the flying truck', kind: 'thing', strokes: [1], why: 'it turned into an airplane' }, { name: 'the ice cream clouds', kind: 'place', strokes: [2, 3] }, { name: 'the dolphin', kind: 'creature', strokes: [5], why: 'it jumped up to say hello' }] },
    },
  },
  {
    title: 'The Big Dog at the Beach',
    dream: 'My big dog came back! We went to the beach and he dug a giant hole, and we both jumped in.',
    strokes: [...DOG, { at: [140, 860], heading: R, ms: 6400, ink: 'light' }, { at: [1250, 850], heading: R, ms: 150, press: 1800, ink: 'dense' }],
    words: [{ after: 2, text: 'my big dog came back' }, { after: 6, text: 'he dug a giant hole' }],
    marks: { 0: ['ArrowUp'], 1: ['ArrowUp', 'ArrowRight'], 5: ['ArrowRight'] },
    guide: {
      sameAs: 'the big dog', at: 2,
      asks: [{ question: 'Who was this?', choices: ['my big dog', 'a horse', 'a bear'], answer: 'my big dog', strokes: [1, 2] }],
      lines: [
        { text: 'Your big dog came back!', strokes: [1, 2, 3, 4] },
        { text: 'You went to the beach together, and the sand was soft.', strokes: [5] },
        { text: 'He dug a giant hole, and you both jumped in.', strokes: [6] },
      ],
      remember: { things: [{ ref: 'the big dog', strokes: [1, 2, 3, 4], why: 'he dug a giant hole at the beach' }, { name: 'the beach', kind: 'place', strokes: [5] }] },
    },
  },
];

// ---------------------------------------------------------------- the nights, painted

const TV = await openTV({ out: OUT, tellShots: !!process.env.TELL_SHOTS });
const results = [];
try {
  await TV.start();
  const who = await TV.newPainter({ seal: 'Sun', young: true });
  console.log(`painting as ${who.name || 'Sun'}${who.young ? ', a child' : ''}`);
  for (const [i, night] of NIGHTS.slice(0, Number(process.env.NIGHTS) || NIGHTS.length).entries()) {
    const log = await TV.night(night, i + 1);
    results.push(log);
    const sent = [log.main, log.ending].filter(Boolean).flatMap((x) => (x.tellings || []).filter((t) => t.sentBack)).length;
    console.log(`night ${log.night}: ${night.title} (${log.seconds} s): recognised ${log.main.recognised}, sent back ${sent}, cards ${JSON.stringify(log.cards)}`);
  }
  // their world after ten nights, walked through; and the dream journal, for the grown-ups
  const home = await TV.visit({ prefix: '20', walk: true });
  await TV.seals();
  const journal = await TV.journal('Sun', '24-journal.png');
  const world = await TV.tv(() => JSON.parse(localStorage.getItem('inkwash.world') || localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('inkwash.world')))));
  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ nights: results, home: home.home, walked: home.walked, hearing: home.hearing, journal, failed: TV.failed, world: { nights: world.nights.map((x) => ({ n: x.n, title: x.title, lines: (x.lines || []).map((l) => l.text), ending: x.ending ? x.ending.lines.map((l) => l.text) : null })), entities: world.entities.map((e) => ({ name: e.name, kind: e.kind, nights: [...new Set([...(e.appearances || []), ...(e.endings || [])].map((a) => a.night))], status: e.status, facts: e.facts })) }, errors: TV.errors, outside: TV.outside }, null, 2));
  console.log(`world: ${home.home.atlas.things.length} things, ${home.home.lit} lit; walked to ${home.walked.length}; journal ${journal ? journal.things.length : 0} things`);
  console.log(`errors: ${JSON.stringify(TV.errors)}; the service answered: ${JSON.stringify(TV.failed)}; fetched from outside: ${JSON.stringify(TV.outside)}`);
} finally {
  await TV.close();
}
