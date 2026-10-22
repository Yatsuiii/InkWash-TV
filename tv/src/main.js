// Inkwash on Fire TV: paint a dream with the remote. A sheet of rice paper fills the screen, the
// remote is a brush (brush.js), and the ink takes to the paper the way real ink does (inkgl.js;
// ink.js where there's no WebGL2). A guide (guide.js) talks you through it, and with the guide
// service (ai.js) it looks at the painting as you go, and they can tell it about the dream on their
// phone as they paint (phone.js). Press play, and the painting comes back stroke by stroke while
// they mark how the dream felt, lighter or heavier, calmer or more stirred (feel.js): the dream is
// told back along that line, from their words. Each night is kept in their dream world, on this
// TV (world.js), by what they say rings true as it is told. A family shares the TV: each painter
// chooses a seal and keeps a dream world of their own, and a child's storyteller speaks simply and
// kindly (family.js). Once a dream is told, they can paint what happens next, and it is told again
// with it; when they come back, last time's story is there to hear again. (The code calls the
// storyteller the guide.)
import { buttonOf, createRemote } from './remote.js';
import { createBrush, step, press, spoke, INKS, summarize, sitting } from './brush.js';
import { readMarks } from './engine/personal/marks.mjs';
import { FEELING_WORDS, target } from './engine/personal/feelings.mjs';
import { readLine, readingsFor } from './engine/personal/arc.mjs';
import { affectName, WHY } from './engine/dreams/emotion.mjs';
import { wonderBrief, checkWonder } from './engine/dreams/wonder.mjs';
import { illustrateBrief } from './engine/dreams/illustrate.mjs';
import { sceneBrief } from './engine/dreams/scene.mjs';
import { createNightWorld, nightPainting, placeSky, STAGE, sparksEl, HOP, POP } from './night.js';
import { toneOf, drawSceneAround, lookSaid } from './scene.js';
import { nightsOf } from './walk.js';
import { getGlow } from './glow.js';
import { replayPlan, replayAt, createDial, createFeeling } from './feel.js';
import { loadWorld, putWorld, tonightOf, welcomeOf, keptOf, sitter, keepWorld, loadApart, apartKeys, roomOf, roomSays } from './world.js';
import { createPhone, qrSvg } from './phone.js';
import { runGuide, stepOf } from './agent.js';
import { SHEET as PANORAMA, nextLook, LOOK_NAMES, versionLabel, isVersionLabel, panStep, panOffset, MORE, foldChoices } from './wide.js';
import { createTools, firstMessage, laterMessage, briefFor, createRenderer, finalTelling } from './harness.js';
import { createPaintings, createNights, createWorlds, PLACE, COMPOSED } from './paintings.js';
import { composeSign, composeDue, COMPOSE_AT } from './compose.js';
import { regionOf, conditionOf, cutAway, solidOf, signOfThing } from './things.js';
import { createInside } from './inside.js';
import { loadFamily, saveFamily, addPainter, choose, freeSeals, sealOf, sealSvg, worldKey, paintingsKey, describe, demoFamily } from './family.js';
import DEMO from './demo-family.js';
import { visitsKey, loadVisits, saveVisits, visitOf, visitorsIn, canVisit, send as sendVisit, sendHome, prune as pruneVisits, visitorBrief, placeVisitor } from './visits.js';
import { bookOf, spreadsOf } from './book.js';
import { createAloud } from './aloud.js';
import { voiceOf } from './engine/personal/arc.mjs';
import { createInkGL } from './inkgl.js';
import { createInk2D } from './ink.js';
import { createGovernor } from './quality.js';
import { createSound } from './sound.js';
import { createGuide } from './guide.js';
import { createAI, guideEndpoint, guideKey } from './ai.js';
import { cutOut, cutLight, inkAsLight, inkOf, inkOnPaper, lightOnNight, motionOf, turnOf, reachOf, maskOf, UNITS } from './cutout.js';
import { cardsOf, cardLine, cardOrigin, mapOf, namedIn } from './cards.js';
import { createLife } from './life.js';
import { shotOf, cssOf, framedBox } from './camera.js';
import { createSky } from './sky.js';
import { forgetHere, forgetSays } from './forget.js';
import { createIntro } from './intro.js';

const SCALE = 0.98; // paper units to sheet pixels: the 1600 x 1000 sheet, drawn 1568 x 980
const SHEET = { x: 176, y: 22 }; // where the sheet lies on the 1920 x 1080 stage
const SMALL = 0.82; // while the painting comes back, the sheet draws back to make room for the line
const $ = (s) => document.querySelector(s);

// `line` is the feeling line: from "Feel it again", through the question at its turn, to the telling.
// `words` is what they said on their phone about this painting, each with the stroke ({ n, text });
// `kept` is what the last night added to their dream world; `nightKept`, whether this painting's
// night is in it yet (a painting is one night, however often it is told).
// `washed` is what was painted and washed out, before which stroke; `guiding`, the guide's loop
// while it runs (guide mode: it looks, asks, tells, remembers).
const state = { mode: 'loading', who: null, offer: null, ending: null, keptStrokes: 0, tell: null, feel: null, line: null, ask: null, freshArmed: -1e9, toastUntil: 0, sayUntil: 0, heardUntil: 0, cover: 1, words: [], washed: [], kept: null, nightKept: false, guiding: null, lastGuide: null, room: null, disk: null, unkept: new Map(), retryKeep: 0 };
const fastPace = new URLSearchParams(location.search).get('pace') === 'fast';

// where the sheet is on the stage: its corner, and pixels per paper unit
function sheetAt() {
  return state.mode === 'replay' || state.mode === 'ask'
    ? { x: 960 - 800 * SCALE * SMALL, y: SHEET.y, s: SCALE * SMALL }
    : { x: SHEET.x, y: SHEET.y, s: SCALE };
}
const remote = createRemote({ now: () => performance.now() });
const sound = createSound();
let brush = null, ink = null, guide = null, hand = null, brushCanvas = null, world = null, phone = null, ai = null, paintings = null, archive = null, render = null;
// the night around the paper (sky.js), and the telling, alive (life.js)
let sky = null, life = null, inside = null;
// who is painting, of the painters on this TV
let family = null, painter = null;
// the screen read aloud, for a child: the guide's questions, each choice as they reach it, its tips
let aloud = null;
const readsAloud = () => !!(aloud && painter && painter.young);
const young = () => !!(painter && painter.young);
const governor = createGovernor();
// the dial's words: for a child, brighter and darker, calmer and wilder
const dialWords = () => (painter && painter.young
  ? { up: 'brighter', down: 'darker', more: 'wilder', less: 'calm', moreHint: 'wilder', lessHint: 'calmer' }
  : { up: 'lighter', down: 'heavier', more: 'stirred', less: 'calm', moreHint: 'more stirred', lessHint: 'calmer' });

// ---------------------------------------------------------------- the screen

function fit() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  $('#stage').style.transform = `translate(${(innerWidth - 1920 * s) / 2}px, ${(innerHeight - 1080 * s) / 2}px) scale(${s})`;
}
addEventListener('resize', fit);
fit();

addEventListener('keydown', (e) => {
  const b = buttonOf(e);
  if (!b) return;
  e.preventDefault(); // the WebView's own spatial navigation must not move focus
  remote.down(b, performance.now());
});
addEventListener('keyup', (e) => {
  const b = buttonOf(e);
  if (!b) return;
  e.preventDefault();
  remote.up(b);
});
addEventListener('blur', () => remote.clear());
document.addEventListener('visibilitychange', () => remote.clear());

function toast(text, seconds = 2.4, { low = null } = {}) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  // out of the way of the guide's panel, when that is up top (or of what is, when told)
  el.classList.toggle('low', low ?? (!$('#say').hidden && $('#say').classList.contains('high')));
  state.toastUntil = performance.now() + seconds * 1000;
}

// The guide's panels sit low over the paper, out of the way, unless what's being painted (or
// told about) is down there too: then they move up.
function placePanel(el, y) {
  el.classList.toggle('high', y > 560);
}

// a line from the guide: on screen, and aloud when the service sent its voice
const voice = new Audio();
function say(text, audio) {
  const el = $('#say');
  placePanel(el, brush ? brush.y : 0);
  $('#toast').classList.toggle('low', el.classList.contains('high'));
  $('#heard').classList.toggle('low', el.classList.contains('high'));
  el.querySelector('.text').textContent = text;
  el.hidden = false;
  el.classList.remove('fading');
  $('#voice-mark').classList.add('speaking');
  const seconds = Math.max(3.5, text.split(/\s+/).length * 0.42 + 1.5);
  state.sayUntil = performance.now() + seconds * 1000;
  if (audio) {
    voice.src = `data:audio/mpeg;base64,${audio}`;
    voice.play().catch(() => {});
  } else if (readsAloud()) aloud.say(text);
}

const KEY = (k) => `<span class="key">${k}</span>`;
let hintsShown = '';
function updateHints() {
  let html;
  const w = dialWords();
  if (state.mode === 'journal') html = `<span>${KEY('◀')}${KEY('▶')}turn the page</span><span>${KEY('Back')}${state.journal && state.journal.from === 'atlas' ? 'back to your world' : 'back to the seals'}</span>`;
  else if (state.mode === 'who') {
    const step = state.who && state.who.step;
    const onPainter = step === 'pick' && state.who.i < family.painters.length;
    const back = step === 'for' || painter || (step === 'seal' && family.painters.length) ? 'back' : family.demo ? 'leave the demo' : null;
    html = `<span>${KEY('◀')}${KEY('▶')}choose</span><span>${KEY('OK')}${step === 'for' ? 'begin' : step === 'pick' ? 'go in' : 'choose this seal'}</span>${onPainter ? `<span>${KEY('»')}their world</span><span>${KEY('«')}their book</span>` : ''}${back ? `<span>${KEY('Back')}${back}</span>` : ''}${family.demo || step === 'for' ? '' : `<span>${KEY('▶‖')}a demo family</span>`}`;
  }
  else if (state.mode === 'atlas' && state.atlas && state.atlas.walk) html = walkHints(state.atlas.walk);
  else if (state.mode === 'atlas' && state.atlas && state.atlas.forget) html = `<span>${KEY('▲')}${KEY('▼')}choose</span><span>${KEY('OK')}this one</span><span>${KEY('Back')}keep it</span>`;
  else if (state.mode === 'atlas' && state.atlas && state.atlas.look) html = `<span>${KEY('▲')}${KEY('▼')}choose</span><span>${KEY('OK')}this one</span>${phone && phone.listening ? '<span>or say it on your phone</span>' : ''}<span>${KEY('Back')}keep it as it is</span>`;
  else if (state.mode === 'atlas' && state.atlas && state.atlas.said) html = `<span>${KEY('▲')}${KEY('▼')}choose</span><span>${KEY('OK')}this one</span><span>or say it on your phone</span><span>${KEY('Back')}keep it as it is</span>`;
  else if (state.mode === 'atlas' && state.atlas && state.atlas.wonder) html = `<span>${KEY('▲')}${KEY('▼')}choose</span><span>${KEY('OK')}this one</span><span>${KEY('Back')}not now</span>`;
  else if (state.mode === 'atlas') html = `<span>${KEY('▲')}${KEY('▼')}choose</span><span>${KEY('OK')}go</span>${state.atlas && state.atlas.cards && state.atlas.cards.length > 1 ? `<span>${KEY('◀')}${KEY('▶')}another thing in it</span>` : ''}<span>${KEY('Back')}the seals</span>`;
  else if (state.mode === 'gallery' || state.mode === 'intro') html = '';
  else if (state.mode === 'tell' && state.tell && state.tell.recap) html = `<span>${KEY('OK')}next</span><span>${KEY('▶‖')}pause</span><span>${KEY('Back')}back to drawing</span>`;
  else if (state.mode === 'tell') html = `<span>${KEY('▲')}that's it</span><span>${KEY('▼')}not quite</span><span>${KEY('OK')}next</span><span>${KEY('▶‖')}pause</span><span>${KEY('Back')}back to drawing</span>`;
  else if (state.mode === 'replay') html = `<span>${KEY('▲')}${KEY('▼')}${w.up} · ${w.down}</span><span>${KEY('◀')}${KEY('▶')}${w.lessHint} · ${w.moreHint}</span><span>${KEY('OK')}skip</span><span>${KEY('Back')}back to drawing</span>`;
  else if (state.mode === 'ask') html = state.ask && state.ask.agent ? `<span>${KEY('◀')}${KEY('▶')}choose</span><span>${KEY('OK')}answer</span>${phone && phone.listening ? '<span>or say it on your phone</span>' : ''}<span>${KEY('Back')}skip</span>` : `<span>${KEY('◀')}${KEY('▶')}choose</span><span>${KEY('OK')}tell it</span><span>${KEY('Back')}back to drawing</span>`;
  else if (state.mode === 'feel') html = `<span>${KEY('◀')}${KEY('▶')}choose</span><span>${KEY('OK')}tell it</span><span>${KEY('Back')}back to drawing</span>`;
  else if (state.mode === 'guide') html = `<span>${KEY('Back')}back to drawing</span>`;
  else if (state.mode === 'offer') html = `<span>${KEY('◀')}${KEY('▶')}choose</span><span>${KEY('OK')}choose</span><span>${KEY('Back')}${state.offer && state.offer.more ? 'back' : state.offer && state.offer.recap ? 'not now' : state.offer && state.offer.after ? 'a clean sheet' : 'that’s the end'}</span>`;
  else if (state.mode === 'wide') html = `<span>${KEY('◀')}${KEY('▶')}look around</span><span>${KEY('Back')}back to your picture</span>`;
  else if (state.mode === 'realwalk') html = `<span>${KEY('▲')}${KEY('▼')}walk</span><span>${KEY('◀')}${KEY('▶')}turn</span><span>${KEY('Back')}back to your picture</span>`;
  else if (state.mode === 'inside') html = `<span>${KEY('◀')}${KEY('▶')}turn it round</span><span>${KEY('▲')}${KEY('▼')}nearer · further</span><span>${KEY('OK')}the next thing</span><span>${KEY('Back')}back to what you drew</span>`;
  else if (brush.down) html = `<span>${KEY('◀')}${KEY('▶')}steer</span><span>${KEY('▼')}brighter · hold to glow</span><span>${KEY('▲')}fainter</span><span>${KEY('OK')}lift</span>`;
  else if (state.ending) html = `<span>${KEY('OK')}draw</span><span>${KEY('◀')}${KEY('▲')}${KEY('▼')}${KEY('▶')}move</span><span>${KEY('«')}${KEY('»')}${INKS[brush.ink].name.toLowerCase()}</span><span>${KEY('▶‖')}tell it with what happens next</span><span>${KEY('Back')}${brush.strokes.length > state.ending.from ? 'undo' : 'that’s the end'}</span>`;
  else html = `<span>${KEY('OK')}draw</span><span>${KEY('◀')}${KEY('▲')}${KEY('▼')}${KEY('▶')}move</span><span>${KEY('«')}${KEY('»')}${INKS[brush.ink].name.toLowerCase()}</span><span>${KEY('▶‖')}${stepNow() === 4 ? 'tell it again' : 'tell my story'}</span><span>${KEY('Back')}${stepNow() === 4 ? 'start over' : brush.strokes.length ? 'undo' : 'your world'}</span>`;
  if (html !== hintsShown) { $('#hints').innerHTML = html; hintsShown = html; }
  updateSteps();
  updateScene();
  $('#hints').classList.toggle('quiet', state.mode === 'paint' && brush.down);
}

// The room around the paper: the felt while a dream is painted; the night once it is felt, told or
// remembered. While it is told, what's on the felt steps back and the sheet moves like a camera.
const DREAMING = new Set(['who', 'journal', 'replay', 'feel', 'ask', 'guide', 'tell', 'offer', 'atlas', 'gallery', 'inside', 'intro']);
function updateScene() {
  const stage = $('#stage'), dreaming = DREAMING.has(state.mode);
  stage.classList.toggle('dreaming', dreaming);
  stage.classList.toggle('telling', state.mode === 'tell');
  stage.classList.toggle('apart', state.mode === 'who' || state.mode === 'journal' || state.mode === 'atlas');
  stage.classList.toggle('mapping', state.mode === 'atlas');
  stage.classList.toggle('resting', state.mode === 'gallery');
  stage.classList.toggle('opening', state.mode === 'intro');
  stage.classList.toggle('inside', state.mode === 'inside');
  stage.classList.toggle('drawing', state.mode === 'paint');
  // drawing into their world, not onto paper: what they draw is light in it, and stays light while
  // it is felt, told and kept; a place by day falls to dusk meanwhile, so their light shows (where
  // the screen can: the 2D fallback keeps the paper)
  const light = IN_WORLD.has(state.mode) && !!(ink && ink.setLight);
  if (ink && ink.setLight) ink.setLight(light);
  stage.classList.toggle('night-ink', light);
  stage.classList.toggle('choosing', state.mode === 'who');
  stage.classList.toggle('reading', state.mode === 'journal');
  if (sky) sky.show(dreaming || state.mode === 'paint');
  skyPlace();
  if (state.mode !== 'tell') unfilm();
}
// The sky round the paper: their world's place, once it has one, as it is at home (painted, once
// it has been); the night until then, and on the seals and at rest, which are everyone's
const PLACE_SKY = new Set(['paint', 'journal', 'replay', 'feel', 'ask', 'guide', 'tell', 'offer', 'inside']);
// where what they drew is light in their world, with no paper under it
const IN_WORLD = new Set(['paint', 'replay', 'feel', 'ask', 'guide', 'tell', 'offer']);
// whether this screen draws in light (the 2D fallback has paper)
const inWorld = () => !!(ink && ink.setLight);
// a brush, dipped fresh; drawn as light, its lines never run dry (brush.js steady)
const newBrush = (o) => Object.assign(createBrush(o), { steady: inWorld() });
const skyLooked = new Set();
function skyPlace() {
  if (!sky) return;
  const p = painter, scene = PLACE_SKY.has(state.mode) && p && world ? world.scene : null;
  // a place by day falls to dusk while what they drew is light in it (and as soon as it comes)
  const stage = $('#stage');
  stage.classList.toggle('dusk', stage.classList.contains('night-ink') && !!scene && toneOf(scene) === 'day');
  if (!scene) return sky.place(null);
  const sign = signOf(scene), seen = placeImages.get(worldKey(p)), backdrop = seen && seen.sign === sign ? seen.img : null;
  sky.place(`${sign}:${backdrop ? 'painted' : 'drawn'}`, (g, W, H) => placeSky(g, { W, H, horizon: Math.round(H * 0.62), seed: placeSeed(p), scene, backdrop }), { day: toneOf(scene) === 'day' });
  // the picture of it, if one is kept, looked for once
  if (!backdrop && !skyLooked.has(`${worldKey(p)}:${sign}`)) {
    skyLooked.add(`${worldKey(p)}:${sign}`);
    placeFor(p, scene).then((pl) => { if (pl && pl.backdrop) skyPlace(); }).catch(() => {});
  }
}

// Where they are tonight, in four steps always in view: a visual schedule, so what comes next is
// never a surprise. 4: all done, the night kept.
function stepNow() {
  if (!painter || !brush || ['who', 'journal', 'loading', 'atlas', 'gallery'].includes(state.mode)) return null;
  // last time's story, heard again, is apart from tonight's painting
  if ((state.offer && (state.offer.recap || state.offer.after)) || (state.tell && state.tell.recap) || (state.inside && state.inside.from.after)) return null;
  if (state.mode === 'replay' || state.mode === 'feel') return 1;
  if (state.mode === 'guide' || state.mode === 'ask' || state.mode === 'tell') return 2;
  if (state.mode === 'offer') return 3;
  if (state.nightKept && !state.ending && brush.strokes.length && brush.strokes.length <= state.keptStrokes) return 4;
  return 0;
}
let stepShown = undefined;
function updateSteps() {
  const k = stepNow();
  if (k === stepShown) return;
  stepShown = k;
  $('#steps').hidden = k == null;
  document.querySelectorAll('#steps li').forEach((li, i) => { li.classList.toggle('now', i === k); li.classList.toggle('done', i < k); });
}

// While painting only the ink in the brush is shown; all of them for a moment as it changes
let dishesShown = null, dishesOpen = null;
function updateDishes() {
  const id = INKS[brush.ink].id;
  document.querySelectorAll('#dishes li').forEach((li) => li.classList.toggle('on', li.dataset.ink === id));
  if (dishesShown && dishesShown !== id) { $('#dishes').classList.add('open'); clearTimeout(dishesOpen); dishesOpen = setTimeout(() => $('#dishes').classList.remove('open'), 1800); }
  dishesShown = id;
}

// ---------------------------------------------------------------- the brush, drawn

// the tuft, wet with each ink: its light side and its dark side
const TUFT = {
  dense: ['#3a3e47', '#0d0e12'], light: ['#9b9fa6', '#5f646c'], water: ['#c9d7dc', '#8ea4ab'],
  indigo: ['#5470b4', '#1b2a55'], gold: ['#f6d374', '#a66f17'], cinnabar: ['#e3624e', '#8a1f15'],
};

// What each of the two canvases over the paper shows, so each is drawn only when its picture
// changes: a changed canvas costs a TV stick much of a frame to show, however little changed on it.
// The feeling line's (`hand`, the stage's size): what drew it (the same `key` and `line`, the same
// picture) and whether anything is on it. The brush's, a canvas only a little bigger than the brush,
// moved with it: how the brush looks, and where the canvas stands.
const lineWas = { key: '', line: null, drawn: false }, brushWas = { look: '', at: '' };
// the brush as it looks: where it is and its ink, and, while it touches, how hard, how fast and
// which way it moves (its tuft bends back against that)
const brushLook = () => `${brush.x.toFixed(1)} ${brush.y.toFixed(1)} ${brush.ink}${brush.touching ? ` ${brush.pressure.toFixed(3)} ${brush.speed.toFixed(0)} ${brush.heading.toFixed(3)}` : ''}`;

// The line as the painting comes back, and the brush while they paint
function drawHand() {
  const line = (state.mode === 'replay' || state.mode === 'ask') && state.line ? state.line : null;
  // the line moves every frame while the painting comes back; at the question, only the turn on it
  const key = line ? (state.mode === 'replay' ? `replay ${performance.now()}` : `ask ${state.ask ? state.ask.n : ''}`) : '';
  if (key !== lineWas.key || line !== lineWas.line) {
    const g = hand.getContext('2d');
    if (lineWas.drawn) g.clearRect(0, 0, hand.width, hand.height);
    Object.assign(lineWas, { key, line, drawn: !!line });
    if (line) drawLine(g);
  }
  drawBrush(!line && state.mode === 'paint' && !!brush);
}

// What they draw with is a spark of light, in the ink's own colour: they draw light into their world,
// not paint onto paper. Lifted, it floats with a faint tail behind it, pointing the way it will go
// when it touches; down, it burns brighter and wider as it is pressed, its tail drawn out behind it
// as it moves.
const SPARK = { dense: '#f6f0e2', light: '#c3cad6', water: '#bfe6f2', indigo: '#93acff', gold: '#ffd27a', cinnabar: '#ff8f72' };
const glowOf = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
function drawBrush(on) {
  const look = on ? brushLook() : '';
  if (look === brushWas.look) return;
  brushWas.look = look;
  const c = brushCanvas, g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  if (!on) return;
  const x = SHEET.x + brush.x * SCALE, y = SHEET.y + brush.y * SCALE;
  const down = brush.touching, p = down ? brush.pressure : 0, col = SPARK[INKS[brush.ink].id] || SPARK.dense;
  const core = down ? 7 + 12 * p : 6, halo = down ? 40 + 44 * p : 30;
  const tail = down ? 26 + Math.min(1, brush.speed / 200) * 80 : 30;
  const hx = Math.cos(brush.heading), hy = Math.sin(brush.heading);
  // the canvas stands round the spark and its tail, drawn on in the stage's own pixels
  const reach = halo + tail + 6, x0 = Math.floor(x - reach), y0 = Math.floor(y - reach), w = Math.ceil(2 * reach);
  if (w > c.width || w > c.height) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, w); }
  const at = `translate(${x0}px, ${y0}px)`;
  if (at !== brushWas.at) { c.style.transform = at; brushWas.at = at; }
  g.setTransform(1, 0, 0, 1, -x0, -y0);
  g.globalCompositeOperation = 'lighter';
  // its tail, behind it
  const t = g.createLinearGradient(x, y, x - hx * tail, y - hy * tail);
  t.addColorStop(0, glowOf(col, down ? 0.6 : 0.35)); t.addColorStop(1, glowOf(col, 0));
  g.strokeStyle = t; g.lineCap = 'round'; g.lineWidth = core * 1.3;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x - hx * tail, y - hy * tail); g.stroke();
  // its halo, and its bright core
  const h = g.createRadialGradient(x, y, 0, x, y, halo);
  h.addColorStop(0, glowOf(col, down ? 0.5 : 0.32)); h.addColorStop(0.35, glowOf(col, down ? 0.18 : 0.1)); h.addColorStop(1, glowOf(col, 0));
  g.fillStyle = h; g.fillRect(x - halo, y - halo, 2 * halo, 2 * halo);
  const k = g.createRadialGradient(x, y, 0, x, y, core);
  k.addColorStop(0, 'rgba(255,255,255,0.98)'); k.addColorStop(0.45, glowOf(col, 0.95)); k.addColorStop(1, glowOf(col, 0));
  g.fillStyle = k; g.beginPath(); g.arc(x, y, core, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- painting

// What the guide service needs to see the painting, and what they have told it: their words on
// the phone, and the marks that look like things from their dream world. All as it is now; the
// painting made a JPEG away from the page's thread, so the brush doesn't stop for it.
// Drawn into their world, the guide sees it as they do: light on the night (`lit`), not ink on paper.
const snapshotOf = (width, quality, o) => (ink.snapshotLater ? ink.snapshotLater(width, quality, o) : Promise.resolve(ink.snapshot(width, quality, o)));
const NIGHT_SEEN = '#111a33';
const seenOf = (width, quality) => snapshotOf(width, quality, inWorld() ? { night: NIGHT_SEEN } : undefined);
async function look() {
  const strokes = summarize(brush), image = seenOf(768);
  return { image: await image, strokes, words: state.words.slice(-12), phone: !!(phone && phone.code), known: knownMarks(strokes.slice(-4)), ...(inWorld() ? { lit: true } : {}) };
}
function knownMarks(strokes) {
  if (!world) return [];
  return strokes.flatMap((s) => world.known(s).slice(0, 1).map((k) => ({ n: s.n, id: k.id, name: k.name, nights: (world.entities.find((e) => e.id === k.id)?.appearances || []).length || 1 })));
}

// ---------------------------------------------------------------- their words, by phone

// What they said on their phone: kept with the stroke being painted (or coming back) as they said
// it; at the question at the turn, it is their answer.
function heard(texts) {
  for (const text of texts.map((t) => t.slice(0, 300))) {
    if (state.mode === 'ask' && state.ask) { askHeard(text); continue; }
    // how a thing of theirs looks, in their own words
    if (state.mode === 'atlas' && state.atlas && state.atlas.said) { sayLook(state.atlas, text.replace(/[.!?]+$/, '').slice(0, 160)); continue; }
    // how their world looks, in their own words
    if (state.mode === 'atlas' && state.atlas && state.atlas.look && !state.atlas.look.waiting) { changeLook(state.atlas, text.replace(/[.!?]+$/, '').slice(0, 160)); continue; }
    if (state.mode === 'tell' && state.tell && state.tell.agent) { state.tell.agent.words.push(text); continue; }
    const L = state.line;
    const n = state.mode === 'replay' && L ? (L.strokes[replayAt(L.plan, L.t).i]?.n ?? null) : brush.strokes.length || null;
    if (state.mode === 'paint') spoke(brush);
    state.words.push({ n, text });
  }
  if (state.words.length > 40) state.words.splice(0, state.words.length - 40);
  const el = $('#heard');
  el.querySelector('.text').textContent = `“${texts[texts.length - 1].slice(0, 140)}”`;
  el.classList.toggle('low', !$('#say').hidden && $('#say').classList.contains('high'));
  el.hidden = false;
  state.heardUntil = performance.now() + 6000;
}

function showPairing() {
  if (!phone || !phone.code) return;
  const big = $('#pair'), small = $('#phone');
  // the codes made again only for a new address (each sheet shows them)
  if (big.dataset.url !== phone.url) {
    big.querySelector('.qr').innerHTML = qrSvg(phone.url, { size: 300 });
    big.querySelector('.code').textContent = phone.code.split('').join(' ');
    small.querySelector('.qr').innerHTML = qrSvg(phone.url, { size: 128 });
    big.dataset.url = phone.url;
  }
  big.hidden = !(state.mode === 'paint' && brush.strokes.length === 0);
  small.hidden = !big.hidden || state.mode === 'who';
}
// whether the label says their phone is listening: written only when that changes, since writing it
// has the page's style worked out again, every frame
let phoneSaid = null;
function updatePhone() {
  if (!phone || !phone.code) return;
  const small = $('#phone');
  if (phoneSaid !== phone.listening) {
    phoneSaid = phone.listening;
    small.classList.toggle('listening', phoneSaid);
    small.querySelector('.label').textContent = phoneSaid ? 'Your phone is listening' : 'Talk to the storyteller';
    // at home, what can be done with it (Say how … looks) comes and goes with it
    if (state.mode === 'atlas' && state.atlas) showWorldActions();
  }
  if (phone.listening || brush.strokes.length || state.mode !== 'paint') {
    if (!$('#pair').hidden) { $('#pair').hidden = true; small.hidden = false; }
  }
}

function onPress(button, t) {
  sound.wake();
  lastInput = performance.now();
  // their world, faded while left alone: a press brings its words back and does what it does (a
  // first press lost to waking it is a press they meant)
  if (document.body.classList.contains('quiet')) quiet(false);
  // the TV at rest: any button wakes it, and does nothing else; the opening, the same
  if (state.mode === 'gallery') return stopGallery();
  if (state.mode === 'intro') { if (opening) opening.skip(); return; }
  if (state.mode === 'atlas') return atlasPress(button);
  if (state.mode === 'tell') return tellPress(button);
  if (state.mode === 'feel') return feelPress(button);
  if (state.mode === 'replay') return replayPress(button);
  if (state.mode === 'ask') return askPress(button);
  if (state.mode === 'guide') return guidePress(button);
  if (state.mode === 'who') return whoPress(button);
  if (state.mode === 'journal') return journalPress(button);
  if (state.mode === 'offer') return offerPress(button);
  if (state.mode === 'inside') return insidePress(button);
  if (state.mode === 'realwalk') return realWalkPress(button);
  if (state.mode === 'wide') return widePress(button);
  if (state.mode !== 'paint') return;
  if (button !== 'back') state.freshArmed = -1e9;
  // painting what happens next, with none of it on the paper yet: Back leaves the dream as it was
  if (state.ending && button === 'back' && !brush.touching && brush.strokes.length <= state.ending.from) { endEnding('Kept as it was.'); return; }
  // the night is kept, with nothing new on it: Back puts the painting away
  if (button === 'back' && !brush.touching && stepNow() === 4) { askFresh('It’s kept in your world.'); return; }
  const last = brush.strokes[brush.strokes.length - 1];
  const r = press(brush, button);
  switch (r) {
    case 'down':
      ink.begin();
      sound.touch();
      guide.event('down');
      break;
    case 'ink': {
      const k = INKS[brush.ink];
      updateDishes();
      sound.dip(k.id === 'water');
      toast(brush.down ? `${k.name}, for the next stroke` : k.name, 1.6);
      guide.event('ink', k.id);
      break;
    }
    case 'undo':
      if (ink.undo()) {
        sound.wash(); toast('Washed out.', 1.6); guide.event('undo');
        for (const w of state.words) if (w.n != null && w.n > brush.strokes.length) w.n = null;
        // what was washed out, and where: the guide can read hesitation in it
        if (last && last.points.length) {
          const xs = last.points.map((q) => q.x), ys = last.points.map((q) => q.y);
          state.washed = state.washed.filter((w) => w.before <= brush.strokes.length + 1).concat([{ before: brush.strokes.length + 1, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(Math.round) }]).slice(-12);
        }
        // a clean sheet: the next painting is a new night
        if (!brush.strokes.length) { state.words = []; state.washed = []; state.nightKept = false; }
      } else { if (last) brush.strokes.push(last); brush.washes = Math.max(0, brush.washes - 1); askFresh('That one has set: only the last few lines can be undone.'); }
      break;
    case 'exit':
      // a clean paper: back to their world
      openWorld();
      break;
    case 'tell':
      ink.end();
      if (state.ending) {
        // what they painted next comes back, and only it, for them to mark how it feels
        if (brush.strokes.length > state.ending.from) startReplay(state.ending.from);
        else toast('Draw what happens next first.');
        break;
      }
      // first, the painting comes back and they mark how it felt; with or without the guide
      startReplay();
      break;
    case 'empty':
      toast('Draw something first: press OK to start.');
      break;
    default: break;
  }
  updateHints();
}

// A fresh sheet. Only the last few strokes wash out (inkgl.js keeps that many), so once the night is
// kept, or the next stroke back has soaked in, Back pressed again puts the painting away: twice,
// so one press never loses a painting. A told painting is kept in their dream world, picture and
// all; then Back on the clean sheet chooses who paints next.
const AGAIN_MS = 4000;
function askFresh(why) {
  const t = performance.now();
  if (t - state.freshArmed < AGAIN_MS) return freshSheet();
  state.freshArmed = t;
  toast(`${why} Press Back again to start over.`, AGAIN_MS / 1000);
}
function freshSheet() {
  const kept = state.nightKept;
  cleanSheet();
  sound.wash();
  updateDishes();
  updateHints();
  toast(kept ? (young() ? 'It’s kept in your world. Draw something new.' : 'Kept in your world. Draw something new.') : 'Started over.', 2.4);
}
// the paper clean, the brush where it was, and nothing of the last painting kept in hand
function cleanSheet() {
  state.freshArmed = -1e9;
  if (state.ending) endEnding(null);
  ink.clear();
  spotlight(null);
  brush = newBrush({ x: brush.x, y: brush.y, heading: brush.heading, ink: brush.ink });
  Object.assign(state, { words: [], washed: [], nightKept: false, keptStrokes: 0, tell: null, line: null, ask: null, feel: null, about: null });
  hideReal();
  // the last painting's seal goes with it
  $('#seal').hidden = true;
  guide.event('clean');
}

// ---------------------------------------------------------------- feel it again

// The painting comes back, stroke by stroke, in the order it was painted. Holding ▲ where the
// dream felt lighter and ▼ where it felt heavier draws the feeling line under it; ▶ where it felt
// more stirred and ◀ where calmer makes the line tremble and thicken, or thin and settle. OK skips
// to one word instead; Back returns to the paper.
function startReplay(from = 0) {
  const strokes = summarize(brush).slice(from);
  // slower for a child: time to look, and to choose
  const plan = replayPlan(strokes, fastPace ? { total: 4, lead: 0.8, min: 0.3, max: 1, tail: 0.3 } : young() ? { total: 20, lead: 3 } : { lead: 2.2 });
  if (readsAloud()) aloud.say('Press up where it felt brighter, and down where it felt darker.');
  state.mode = 'replay';
  state.line = { plan, strokes, points: brush.strokes.slice(from).map((s) => s.points), t: 0, dial: createDial(), feeling: createFeeling(plan), shown: -1, pressed: false, read: null, byStroke: null, arousal: null };
  $('#say').hidden = true;
  $('#stage').classList.add('replaying');
  spotlight(null);
  sound.dial(true, 0);
  updateHints();
  // the storyteller begins now, while they mark it: its first look is done by the time they finish
  dropAhead();
  if (ai && !state.ending) state.ahead = headStart();
}

// how fast the painting comes back: 1 on a TV; the browser test slows it, so a busy test machine
// can keep up with it
let replayRate = 1;
function replayFrame(t, dt) {
  const L = state.line;
  if (!L) return backToPaper();
  L.t += dt * replayRate;
  const held = remote.held(t);
  const dir = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
  const side = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  if (dir || side) L.pressed = true;
  L.dial.step(dt, dir, side);
  L.feeling.add(L.t, L.dial.v, L.dial.a);
  if (sky) sky.feel(L.dial.v, L.dial.a);
  sound.dial(true, L.dial.v, dir !== 0 || side !== 0, L.dial.a);
  const at = replayAt(L.plan, L.t);
  if (at.i >= 0 && at.i !== L.shown) { L.shown = at.i; spotlight(L.strokes[at.i].box); }
  if (L.t >= L.plan.end) finishReplay(false);
}

function replayPress(button) {
  if (button === 'select' || button === 'playpause') finishReplay(true);
  else if (button === 'back') backToPaper();
}

// What the line comes to: if they marked it, one question at its turn; if they didn't, or
// skipped, the one-word question instead.
function finishReplay(skipped) {
  const L = state.line;
  sound.dial(false);
  L.byStroke = L.feeling.byStroke();
  L.arousal = L.feeling.arousal();
  L.read = readLine({ byStroke: L.byStroke, arousal: L.arousal, strokes: L.strokes });
  // what happens next goes straight to the storyteller, marked or not
  if (state.ending && ai) return startGuide({ ending: true, feeling: !skipped && L.read.moved ? { byStroke: L.byStroke, arousal: L.arousal, line: L.feeling.line(120), moved: true } : null });
  if (skipped || !L.read.moved) {
    state.line = null;
    $('#stage').classList.remove('replaying');
    spotlight(null);
    return startFeeling();
  }
  // with the guide service, the guide takes it from here: it asks what it needs; without, the
  // TV's own question at the turn
  if (ai) return toGuide({ feeling: { byStroke: L.byStroke, arousal: L.arousal, line: L.feeling.line(120), moved: true } });
  startAsk();
}

// The question at the turn: "Here it changed. What was it?" First what they said, if they say it
// on their phone; then what it could be from their own dream world (a mark shaped and placed like
// one a thing came as before: "the stopped clock, again"); then three readings of that mark (the
// guide's, if it can look; else by its shape), never one they turned down before; or leave it a
// mystery. Then: why did it feel that way?
const MYSTERY = 'Leave it a mystery', DONT_KNOW = 'I don’t know';
function startAsk() {
  const L = state.line;
  const n = L.read.focus;
  const stroke = L.strokes.find((s) => s.n === n) || L.strokes[0];
  state.mode = 'ask';
  const known = world ? world.known(stroke).map((k) => ({ id: k.id, name: k.name })) : [];
  state.ask = { n: stroke.n, step: 'what', readings: null, known, heard: null, i: 0, said: null, entity: null, turn: !!L.read.turn };
  spotlight(stroke.box);
  const el = $('#feel');
  el.classList.remove('arriving', 'offering');
  el.querySelector('.ask').textContent = L.read.turn ? 'Here it changed. What was it?' : 'You stayed longest here. What was it?';
  el.querySelector('.marks').textContent = known.length ? 'It looks like something already in your world.' : phone && phone.listening ? 'Say it on your phone, or choose.' : '';
  // out of the way of the mark it asks about
  el.classList.toggle('high', (stroke.box[1] + stroke.box[3]) / 2 > 420);
  el.classList.toggle('over-line', (stroke.box[1] + stroke.box[3]) / 2 <= 420);
  showAsk();
  el.hidden = false;
  updateHints();
  picturesFor(state.ask);
  const mine = state.ask;
  const avoid = world ? world.slice().avoid : [];
  look().then((seen) => guide.readings({ ...seen, n: stroke.n, avoid }))
    .then((rs) => (rs && rs.length ? rs : readingsFor(stroke)))
    .catch(() => readingsFor(stroke))
    .then((rs) => {
      if (state.ask !== mine) return;
      const own = new Set(mine.known.map((k) => k.name));
      mine.readings = rs.filter((r) => !avoid.includes(r) && !own.has(r)).slice(0, 3);
      showAsk();
    });
}

// the chips, in order: [{ text, said, entity }]
function askChoices() {
  const a = state.ask;
  if (a.agent) return [...(a.heard ? [{ text: `“${a.heard}”`, said: a.heard, by: 'phone' }] : []), ...a.choices.map((c) => ({ text: c, said: c, by: 'choice' })), { text: 'Skip', said: null, by: 'skipped' }];
  if (a.step === 'why') return [...WHY.map((w) => ({ text: w.says, why: w.id })), { text: DONT_KNOW, why: null }];
  return [
    ...(a.heard ? [{ text: `“${a.heard}”`, said: a.heard }] : []),
    ...a.known.map((k) => ({ text: `${k.name}, again`, said: k.name, entity: k.id })),
    ...(a.readings || ['…', '…', '…']).map((r) => ({ text: r, said: r, waiting: !a.readings })),
    { text: MYSTERY, said: null },
  ];
}

function showAsk() {
  const a = state.ask, el = $('#feel');
  el.querySelector('.chips').innerHTML = askChoices().map((c, i) => {
    const pic = a.pics && a.pics.get(c.said);
    return `<span class="chip${i === a.i ? ' on' : ''}${c.waiting ? ' waiting' : ''}${pic ? ' pictured' : ''}">${pic ? `<img class="pic" src="${pic}" alt="">` : ''}${c.text.replace(/[<&>]/g, '')}</span>`;
  }).join('');
}

// their words, from the phone, as the answer: first among the choices, and chosen
function askHeard(text) {
  const a = state.ask;
  // the storyteller's question, answered on the phone: their words lit first a moment, then taken
  // (unless they choose something else with the remote meanwhile)
  if (a.agent) {
    a.heard = text.replace(/[.!?]+$/, '').slice(0, 80); a.i = 0; showAsk();
    clearTimeout(a.taking);
    a.taking = setTimeout(() => { if (state.ask === a && a.i === 0) { if (aloud) aloud.stop(); a.resolve({ answer: a.heard, by: 'phone' }); } }, 900);
    return;
  }
  if (a.step === 'why') { state.words.push({ n: a.n, text }); return; }
  a.heard = text.replace(/[.!?]+$/, '').slice(0, 60);
  a.i = 0;
  showAsk();
}

function askPress(button) {
  const a = state.ask, choices = askChoices(), n = choices.length, el = $('#feel');
  if (a.agent) {
    clearTimeout(a.taking);
    if (button === 'left' || button === 'up') { a.i = (a.i + n - 1) % n; showAsk(); sound.dip(false); if (readsAloud()) aloud.say(choices[a.i].text); }
    else if (button === 'right' || button === 'down') { a.i = (a.i + 1) % n; showAsk(); sound.dip(false); if (readsAloud()) aloud.say(choices[a.i].text); }
    else if (button === 'select' || button === 'playpause') { if (aloud) aloud.stop(); const c = choices[a.i]; a.resolve({ answer: c.said, by: c.by }); }
    else if (button === 'back') { if (aloud) aloud.stop(); a.resolve({ answer: null, by: 'skipped' }); }
    return;
  }
  if (button === 'left' || button === 'up') { a.i = (a.i + n - 1) % n; showAsk(); sound.dip(false); }
  else if (button === 'right' || button === 'down') { a.i = (a.i + 1) % n; showAsk(); sound.dip(false); }
  else if (button === 'select' || button === 'playpause') {
    const c = choices[a.i];
    if (c.waiting) return; // the readings are still coming
    if (a.step === 'what') {
      // what it was; then, why it felt that way
      a.said = c.said; a.entity = c.entity || null;
      a.step = 'why'; a.i = 0;
      el.querySelector('.ask').textContent = 'Why did it feel that way?';
      el.querySelector('.marks').textContent = c.said ? `${c.said.charAt(0).toUpperCase()}${c.said.slice(1)}.` : 'A mystery.';
      showAsk();
      sound.dip(false);
      return;
    }
    const L = state.line;
    el.hidden = true;
    el.classList.remove('over-line');
    state.ask = null;
    startTelling({ feeling: { byStroke: L.byStroke, arousal: L.arousal, line: L.feeling.line(120), moved: true }, pinned: { n: a.n, said: a.said, entity: a.entity, why: c.why } });
  } else if (button === 'back') {
    if (a.step === 'why') { a.step = 'what'; a.i = 0; el.querySelector('.ask').textContent = a.turn ? 'Here it changed. What was it?' : 'You stayed longest here. What was it?'; el.querySelector('.marks').textContent = ''; showAsk(); }
    else backToPaper();
  }
}

function backToPaper() {
  sound.dial(false);
  dropAhead();
  if (state.ending) $('#ending').hidden = false;
  state.mode = 'paint';
  state.line = null;
  state.ask = null;
  $('#feel').hidden = true;
  $('#feel').classList.remove('over-line');
  $('#stage').classList.remove('replaying');
  spotlight(null);
  updateHints();
}

function sunAt(g, x, y) {
  g.save(); g.fillStyle = g.strokeStyle = '#e3c26b'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill();
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.beginPath(); g.moveTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); g.lineTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18); g.stroke(); }
  g.restore();
}
function cloudAt(g, x, y) {
  g.save(); g.fillStyle = '#9aa0aa';
  g.beginPath(); g.arc(x - 10, y + 3, 8, 0, Math.PI * 2); g.arc(x, y - 3, 11, 0, Math.PI * 2); g.arc(x + 11, y + 3, 8, 0, Math.PI * 2); g.fill();
  g.restore();
}

function rounded(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// The line, drawn under the sheet as it comes back: lighter up, heavier down, even in the middle.
// The stroke coming back is traced in cinnabar.
function drawLine(g) {
  const L = state.line, P = L.plan, at = sheetAt();
  const x0 = at.x, x1 = at.x + 1600 * at.s, top = at.y + 1000 * at.s + 18, bottom = 1014;
  const cy = (top + bottom) / 2, amp = (bottom - top) / 2 - 12;
  const span = Math.max(0.001, P.end - P.lead);
  const xOf = (t) => x0 + 16 + ((t - P.lead) / span) * (x1 - x0 - 32);
  // the strip: the same dark glass as every panel; in their world, a shade of the dark under it
  if ($('#stage').classList.contains('night-ink')) {
    const shade = g.createLinearGradient(0, top - 24, 0, bottom);
    shade.addColorStop(0, 'rgba(4,6,16,0)'); shade.addColorStop(0.4, 'rgba(4,6,16,0.46)'); shade.addColorStop(1, 'rgba(4,6,16,0.6)');
    g.fillStyle = shade; g.fillRect(x0 - 40, top - 24, x1 - x0 + 80, bottom - top + 24);
  } else {
    g.fillStyle = 'rgba(9,12,30,0.84)';
    rounded(g, x0, top, x1 - x0, bottom - top, 18); g.fill();
    g.strokeStyle = 'rgba(255,236,210,0.16)'; g.lineWidth = 1.5; g.stroke();
  }
  g.strokeStyle = 'rgba(246,236,216,0.24)'; g.lineWidth = 2; g.setLineDash([8, 10]);
  g.beginPath(); g.moveTo(x0 + 16, cy); g.lineTo(x1 - 16, cy); g.stroke(); g.setLineDash([]);
  g.font = 'italic 26px Alegreya, Georgia, serif'; g.fillStyle = '#d9cfbd'; g.textAlign = 'right';
  const w = dialWords();
  g.fillText(w.up, x0 - 18, cy - amp + 12); g.fillText('even', x0 - 18, cy + 9); g.fillText(w.down, x0 - 18, cy + amp + 6);
  // for a child, the ends in pictures too: a sun above, a cloud below
  if (young()) { sunAt(g, x0 - 44 - g.measureText(w.up).width, cy - amp + 3); cloudAt(g, x0 - 48 - g.measureText(w.down).width, cy + amp - 3); }
  // where each stroke came back
  g.strokeStyle = 'rgba(246,236,216,0.32)'; g.lineWidth = 2;
  for (const a of P.at) { const x = xOf(a.t0); g.beginPath(); g.moveTo(x, bottom - 14); g.lineTo(x, bottom - 4); g.stroke(); }
  // the other dimension's key, on the felt to the right: stirred trembles thick, calm runs thin
  g.textAlign = 'left'; g.font = 'italic 24px Alegreya, Georgia, serif'; g.fillStyle = '#d9cfbd'; g.lineCap = 'round';
  g.strokeStyle = '#d9cfbd';
  g.lineWidth = 7; g.beginPath();
  for (let k = 0; k <= 24; k++) { const x = x1 + 22 + k * 3, y = cy - 28 + Math.sin(k * 1.9) * 4; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
  g.stroke();
  g.fillText(`${w.more} ▶`, x1 + 104, cy - 20);
  g.lineWidth = 2; g.beginPath(); g.moveTo(x1 + 22, cy + 28); g.lineTo(x1 + 94, cy + 28); g.stroke();
  g.fillText(`◀ ${w.less}`, x1 + 104, cy + 36);
  const S = L.feeling.samples;
  if (state.mode === 'replay' && !L.pressed) {
    g.font = 'italic 30px Alegreya, Georgia, serif'; g.fillStyle = 'rgba(246,236,216,0.86)'; g.textAlign = 'center';
    g.fillText(`As your drawing comes back, hold ▲ where it felt ${w.up}, ▼ ${w.down};`, (x0 + x1) / 2, cy - 22);
    g.fillText(`▶ where it felt ${w.moreHint}, ◀ ${w.lessHint}.`, (x0 + x1) / 2, cy + 20);
  }
  // the line itself: as heavy or light as it felt, trembling and thick where stirred, thin where calm
  if (S.length > 1) {
    g.strokeStyle = '#f6ecd8'; g.lineJoin = 'round'; g.lineCap = 'round';
    for (let k = 1; k < S.length; k++) {
      const [ta, va, aa] = S[k - 1], [tb, vb, ab] = S[k];
      const stir = (aa + ab) / 2, shake = Math.max(0, stir) * 7;
      g.lineWidth = Math.max(1.5, 4 + 6 * stir);
      g.beginPath();
      g.moveTo(xOf(ta), cy - va * amp + Math.sin(ta * 31) * shake);
      g.lineTo(xOf(tb), cy - vb * amp + Math.sin(tb * 31) * shake);
      g.stroke();
    }
  }
  if (state.mode === 'replay') {
    const t = Math.max(P.lead, L.t), x = xOf(Math.min(t, P.end)), y = cy - L.dial.v * amp;
    g.fillStyle = '#e2603f'; g.beginPath(); g.arc(x, y, 9 + 4 * Math.max(0, L.dial.a), 0, Math.PI * 2); g.fill();
    // how it feels now, in a word, once they have marked it
    if (L.pressed) {
      const word = affectName(L.dial.v, L.dial.a);
      if (word !== 'even') {
        g.font = 'italic 28px Alegreya, Georgia, serif'; g.fillStyle = '#f0a07c'; g.textAlign = 'center';
        g.fillText(word, Math.min(x1 - 60, Math.max(x0 + 60, x)), y < cy ? y + 44 : y - 22);
      }
    }
    // the stroke coming back, traced along the paper
    const now = replayAt(P, L.t);
    const pts = now.i >= 0 ? L.points[now.i] : null;
    if (pts && pts.length) {
      let total = 0;
      for (let k = 1; k < pts.length; k++) total += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
      let left = total * now.f, k = 1;
      g.strokeStyle = 'rgba(178,58,42,0.85)'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(at.x + pts[0].x * at.s, at.y + pts[0].y * at.s);
      let hx = at.x + pts[0].x * at.s, hy = at.y + pts[0].y * at.s;
      for (; k < pts.length && left > 0; k++) {
        const d = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y), f = Math.min(1, left / Math.max(0.001, d));
        hx = at.x + (pts[k - 1].x + (pts[k].x - pts[k - 1].x) * f) * at.s; hy = at.y + (pts[k - 1].y + (pts[k].y - pts[k - 1].y) * f) * at.s;
        g.lineTo(hx, hy); left -= d;
      }
      g.stroke();
      g.fillStyle = 'rgba(178,58,42,0.3)'; g.beginPath(); g.arc(hx, hy, 16, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#b23a2a'; g.beginPath(); g.arc(hx, hy, 7, 0, Math.PI * 2); g.fill();
    }
  } else if (state.ask) {
    // the turn, marked on the line
    const a = P.at.find((x) => x.n === state.ask.n);
    if (a) {
      const t = (a.t0 + a.t1) / 2, x = xOf(t);
      let v = 0;
      for (const [ts, vs] of S) if (ts <= t) v = vs;
      g.strokeStyle = '#e2603f'; g.lineWidth = 4; g.beginPath(); g.arc(x, cy - v * amp, 15, 0, Math.PI * 2); g.stroke();
    }
  }
}

// ---------------------------------------------------------------- how the dream felt, in a word

// If they'd rather not mark the line (or didn't), one question, answered with one press: how did
// the dream feel? The marks suggest an answer (the chip it starts on, and a line about how they
// were painted), and the person's word is what counts. "Don't say" tells it from the marks alone.
const FEEL_CHOICES = [...FEELING_WORDS, null];

function startFeeling() {
  state.mode = 'feel';
  $('#say').hidden = true;
  const marks = readMarks(summarize(brush), sitting(brush));
  const suggested = target(null, marks).feeling;
  state.feel = { i: Math.max(0, FEEL_CHOICES.indexOf(suggested)), marks };
  const el = $('#feel');
  el.classList.remove('arriving', 'offering');
  el.querySelector('.ask').textContent = 'How did it feel?';
  if (readsAloud()) aloud.say('How did it feel?');
  // the marks said back plainly: "Your marks were slow, heavy, lingering, mostly low on the paper."
  const words = marks ? marks.words : [];
  // drawn as light into their world, dense ink is bright, not dark, and there is no paper
  const lit = inWorld(), AS_LIGHT = { dark: 'bright', pale: 'faint', wet: 'soft' };
  const how = words.filter((w) => w !== 'low' && w !== 'high').map((w) => (lit && AS_LIGHT[w]) || w);
  const where = words.includes('low') ? (lit ? 'mostly low down' : 'mostly low on the paper') : words.includes('high') ? (lit ? 'mostly high up' : 'mostly high on the paper') : '';
  const said = [how.join(', '), where].filter(Boolean).join(', ');
  el.querySelector('.marks').textContent = said ? `Your marks were ${said}.` : '';
  el.querySelector('.chips').innerHTML = FEEL_CHOICES.map((f) => `<span class="chip">${f || 'Don\u2019t say'}</span>`).join('');
  // out of the painting's way: up top when the marks are mostly low
  placePanel(el, marks && marks.measures.lowness > 0.55 ? 1000 : 0);
  el.hidden = false;
  showFeel();
  updateHints();
}

function showFeel() {
  document.querySelectorAll('#feel .chip').forEach((c, i) => c.classList.toggle('on', i === state.feel.i));
}

function feelPress(button) {
  const n = FEEL_CHOICES.length;
  if (button === 'left' || button === 'up') { state.feel.i = (state.feel.i + n - 1) % n; showFeel(); sound.dip(false); if (readsAloud()) aloud.say(FEEL_CHOICES[state.feel.i] || 'Don’t say'); }
  else if (button === 'right' || button === 'down') { state.feel.i = (state.feel.i + 1) % n; showFeel(); sound.dip(false); if (readsAloud()) aloud.say(FEEL_CHOICES[state.feel.i] || 'Don’t say'); }
  else if (button === 'select' || button === 'playpause') { $('#feel').hidden = true; if (ai) toGuide({ felt: FEEL_CHOICES[state.feel.i] }); else startTelling({ felt: FEEL_CHOICES[state.feel.i] }); }
  else if (button === 'back') { $('#feel').hidden = true; state.feel = null; state.mode = 'paint'; dropAhead(); updateHints(); }
}

// ---------------------------------------------------------------- telling the dream

// `how` is what they gave: { felt } (one word), or { feeling, pinned } (the line, and their answer
// at its turn). With it go their words and tonight's slice of their dream world.
let tellings = 0;
async function startTelling(how = {}) {
  // which telling this is: if Back was pressed, and a new one begun (or last time's story) before
  // this one's answer came, the TV is that one's
  const mine = ++tellings;
  state.mode = 'tell';
  state.tell = null;
  guide.event('told');
  $('#stage').classList.remove('replaying');
  $('#say').hidden = true;
  spotlight(null);
  updateHints();
  const el = $('#tell');
  el.querySelector('.title').textContent = 'Reading your drawing';
  el.querySelector('.text').textContent = '…';
  el.querySelector('.count').textContent = '';
  el.querySelector('.line').innerHTML = '';
  el.classList.remove('high');
  el.hidden = false;
  film(null);
  const seen = await look();
  if (state.mode !== 'tell' || state.tell || mine !== tellings) return; // Back was pressed meanwhile
  const tonight = world ? tonightOf(world, { strokes: seen.strokes, words: state.words }) : null;
  const told = await guide.tell({ image: seen.image, strokes: seen.strokes, felt: how.felt ?? null, feeling: how.feeling || null, pinned: how.pinned || null, words: state.words.slice(), world: tonight, session: sitting(brush), seed: `${sitter()}:${painter ? painter.id : ''}:${world ? world.tonight() - 1 : 0}` });
  if (state.mode !== 'tell' || state.tell || mine !== tellings) return; // Back was pressed while it was being told
  stamp(told.title);
  state.tell = { ...told, i: -1, paused: false, next: 0, how, strokes: seen.strokes, reactions: told.lines.map(() => null), committed: false, layers: liveLayers() };
  nextLine();
}

// The night, kept in their dream world: what the telling proposed, weighed by their reactions to
// each line, felt as they marked it. Once a painting; a plain signing keeps nothing.
function keepNight() {
  const tell = state.tell;
  if (!tell || tell.committed || !world || state.nightKept || !tell.lines.some((l) => l.strokes && l.strokes.length)) return null;
  tell.committed = true;
  state.nightKept = true;
  state.keptStrokes = brush.strokes.length;
  const f = tell.how.feeling;
  const before = countsOf(world);
  state.kept = world.commit({
    telling: { title: tell.title, lines: tell.lines.map((l) => ({ text: l.text, strokes: l.strokes || [], v: l.v, a: l.a })) },
    shape: tell.shape || null, felt: tell.how.felt ?? null,
    feeling: f ? { byStroke: f.byStroke, arousal: f.arousal || [] } : null,
    pinned: tell.how.pinned || null, words: state.words.slice(), strokes: tell.strokes, diff: tell.diff || {}, reactions: tell.reactions,
  });
  saveMine();
  showCollected(before, painter);
  return state.kept;
}

// ▲ that's it, ▼ not quite: what they say of each line as it is told. Not quite, where the
// storyteller had another way to say the line (checked already, its voice already made): that is
// heard at once, in its place, and what they say of it is what they said of the line.
function react(r) {
  const tell = state.tell;
  if (!tell || tell.i < 0) return;
  const line = tell.lines[tell.i];
  if (r === 'no' && line.other && !line.was) return otherWay(tell, line);
  tell.reactions[tell.i] = tell.reactions[tell.i] === r ? null : r;
  showReaction();
  sound.dip(r === 'no');
}
function otherWay(tell, line) {
  Object.assign(line, { was: line.text, text: line.other, audio: line.otherAudio || null });
  (tell.swapped ||= []).push(tell.i);
  tell.reactions[tell.i] = null;
  sound.dip(true);
  toast('Another way', 1.4);
  showLine(tell);
}
function showReaction() {
  const tell = state.tell, el = $('#tell .react');
  const r = tell ? tell.reactions[tell.i] : null;
  el.textContent = r === 'yes' ? 'That’s it' : r === 'no' ? 'Not quite' : '';
  el.className = `react${r ? ` ${r}` : ''}`;
}

// the dream's seal: its title, as much of it as a seal holds
function stamp(title) {
  const seal = $('#seal'), words = String(title || '').split(/\s+/).filter(Boolean);
  let text = '';
  for (const w of words) { if ((text ? text.length + 1 : 0) + w.length > 24) break; text = text ? `${text} ${w}` : w; }
  seal.textContent = text || words[0] || '';
  seal.hidden = false;
  sound.seal();
}

function nextLine() {
  const tell = state.tell;
  if (!tell) return;
  if (tell.agent && tell.i + 1 >= tell.lines.length) return tell.agent.done(0);
  if (tell.recap && tell.i + 1 >= tell.lines.length) return endRecap(tell.lines.length);
  if (tell.i + 1 >= tell.lines.length) {
    const kept = keepNight();
    stopTelling(null);
    guide.event('told', null);
    backToWorld({ note: kept ? keptOf(kept) : null });
    return;
  }
  if (tell.recap && tell.i < 0) endPreviously(tell);
  // the part the last line was about settles into the paper, and wakes there
  if (tell.session && tell.i >= 0) wakeLine(tell.session, tell.lines[tell.i]);
  tell.i++;
  showLine(tell);
}
// the line being told: shown, framed, and voiced
function showLine(tell) {
  const line = tell.lines[tell.i];
  const el = $('#tell');
  el.hidden = false;
  el.querySelector('.title').textContent = tell.title;
  el.querySelector('.text').textContent = line.text;
  el.querySelector('.count').textContent = tell.lines.length > 1 ? `${tell.i + 1} of ${tell.lines.length}` : '';
  el.querySelector('.line').innerHTML = sparkline(line.strokes);
  showReaction();
  spotlight(line.box);
  // the camera frames its part of the painting above the panel, so the panel stays low
  el.classList.remove('high');
  film(tell, line);
  const seconds = Math.max(4, line.text.split(/\s+/).length * 0.42 + 1.5) * (young() ? 1.4 : 1);
  tell.next = performance.now() + seconds * 1000;
  if (line.audio) {
    voice.src = `data:audio/mpeg;base64,${line.audio}`;
    voice.onended = () => { if (state.tell === tell && !tell.paused) tell.next = performance.now() + (young() ? 2200 : 700); };
    voice.play().catch(() => {});
    tell.next = performance.now() + 60000; // until the voice finishes
  } else if (readsAloud()) aloud.say(line.text); // a child hears every line, voiced or not
}

// their feeling line, small, in the telling's panel, with the part being told lit
function sparkline(strokes) {
  const L = state.line;
  if (!L || !Array.isArray(strokes) || !strokes.length) return '';
  const vs = L.feeling.line(120), P = L.plan, W = 640, H = 70, span = Math.max(0.001, P.end - P.lead);
  const xOfT = (t) => 8 + ((t - P.lead) / span) * (W - 16);
  const pts = vs.map((v, k) => `${(8 + (k / (vs.length - 1)) * (W - 16)).toFixed(1)},${(H / 2 - v * (H / 2 - 8)).toFixed(1)}`).join(' ');
  const spans = P.at.filter((a) => strokes.includes(a.n));
  const lit = spans.length ? `<rect x="${xOfT(spans[0].t0).toFixed(1)}" y="2" width="${Math.max(6, xOfT(spans[spans.length - 1].t1) - xOfT(spans[0].t0)).toFixed(1)}" height="${H - 4}" rx="6" fill="rgba(231,184,120,0.22)"/>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${lit}<line x1="8" x2="${W - 8}" y1="${H / 2}" y2="${H / 2}" stroke="rgba(246,236,216,0.24)" stroke-width="2" stroke-dasharray="6 8"/><polyline points="${pts}" fill="none" stroke="#f6ecd8" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

// ---------------------------------------------------------------- the telling, filmed

// The painting pulled apart, for cutting its strokes out (cutout.js): tonight's, from the ink; a
// kept night's, from its picture and the paper it was painted on (the same sheet every night).
function liveLayers() {
  try { return ink && ink.layers ? ink.layers() : null; } catch (err) { console.log(`layers: ${err.message}`); return null; }
}
// the paper alone, at the sheet's size: the same sheet every night
let paperAlone = null;
const paperSheet = () => (paperAlone ||= ink.paper ? ink.paper() : ink.layers().paper);
// a kept night's painting pulled apart, kept for a while (a picture is cut many times over), a
// few at a time: each is three 768 x 480 pictures
const keptCache = new Map();
// a kept night's painting, by what it is, and decoded once (a few kept)
const picKey = (pic) => `${pic.image.length}:${pic.image.slice(-48)}`;
const keptImages = new Map();
function keptImage(pic) {
  const key = picKey(pic);
  if (!keptImages.has(key)) {
    const img = new Image();
    img.src = pic.image;
    const made = img.decode().then(() => img);
    keptImages.set(key, made);
    made.catch(() => keptImages.delete(key));
    while (keptImages.size > 8) keptImages.delete(keptImages.keys().next().value);
  }
  return keptImages.get(key);
}
function keptLayers(pic) {
  const key = picKey(pic);
  if (keptCache.has(key)) return keptCache.get(key);
  const made = (async () => {
    const img = await keptImage(pic);
    const paper = document.createElement('canvas');
    paper.width = img.naturalWidth; paper.height = img.naturalHeight;
    paper.getContext('2d').drawImage(paperSheet(), 0, 0, paper.width, paper.height);
    return { painting: img, paper, ink: inkOf(img, paper) };
  })();
  keptCache.set(key, made);
  while (keptCache.size > 6) keptCache.delete(keptCache.keys().next().value);
  made.catch(() => keptCache.delete(key));
  return made;
}
// A kept night's painting as it is seen in their world: its ink as light on the night (a JPEG, for
// the guide), or on nothing (`night` null: a PNG, for their book, over its own dark page)
async function seenAsLight(url, { night = NIGHT_SEEN } = {}) {
  const c = await lightCanvasOf(url, night);
  return night ? c.toDataURL('image/jpeg', 0.82) : c.toDataURL('image/png');
}
async function lightCanvasOf(url, night) {
  const { painting, ink: dark } = await keptLayers({ image: url });
  const c = document.createElement('canvas');
  c.width = painting.naturalWidth; c.height = painting.naturalHeight;
  const g = c.getContext('2d');
  if (night) { g.fillStyle = night; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(inkAsLight(dark, { floor: 14, glow: (7 * c.width) / UNITS.W }), 0, 0);
  return c;
}
// their book's chapters as light (a PNG made away from the page's thread, so a page turns
// smoothly), a few kept at a time
const bookLights = new Map();
const lightInBook = (url) => {
  if (!bookLights.has(url)) {
    bookLights.set(url, lightCanvasOf(url, null).then((c) => new Promise((ok) => c.toBlob((b) => ok(b ? URL.createObjectURL(b) : url), 'image/png'))).catch(() => url));
    while (bookLights.size > 8) {
      const [old, made] = bookLights.entries().next().value;
      bookLights.delete(old);
      made.then((u) => { if (u.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(u), 4000); });
    }
  }
  return bookLights.get(url);
};
// Strokes as cutout.js takes them: tonight's from the brush, a kept night's from what was kept of
// it. At most the six longest: a line, or a thing, is a part of the painting.
const longest = (xs) => xs.sort((a, b) => (b.length || 0) - (a.length || 0)).slice(0, 6);
function livePartsOf(ns) {
  const want = new Set(ns);
  return longest(summarize(brush).filter((x) => want.has(x.n)).map((x) => ({ ...x, path: (brush.strokes[x.n - 1]?.points || []).map((q) => [q.x, q.y]) })).filter((x) => x.path.length));
}
function keptPartsOf(pic, ns) {
  const want = new Set(ns);
  return longest((pic.strokes || []).filter((x) => want.has(x.n) && x.path && x.path.length).map((x) => ({ ...x, turn: turnOf(x.path), pools: [] })));
}
const partsOf = (tell, ns) => (tell.recap ? keptPartsOf(tell.recap.pic, ns) : livePartsOf(ns));
// The camera in on a line's part of the painting, which lifts off and moves by its shape; and the
// sky as that part felt to them. With no line, the whole painting, drawn back.
function film(tell, line = null) {
  const sheet = $('#sheet');
  sheet.classList.add('filmed');
  // in on its part, with whatever is joined to it whole, and never so close that a head is cut off
  const marks = tell && Array.isArray(tell.strokes) ? tell.strokes.map((s) => s.box) : [];
  const shot = shotOf(line && line.box ? framedBox(line.box, marks) : null, { px: SCALE, most: tell && tell.recap ? 1.3 : 1.45 });
  sheet.style.transform = cssOf(shot);
  state.shot = shot;
  if (!line) return;
  if (sky) sky.feel(line.v || 0, line.a || 0);
  if (life) life.rest(performance.now() / 1000);
  if (!life || !line.strokes || !line.strokes.length) return;
  Promise.resolve(tell.layers).then((layers) => {
    if (!layers || state.tell !== tell || tell.lines[tell.i] !== line) return;
    const parts = partsOf(tell, line.strokes);
    if (!parts.length) return;
    // in their world it lifts out as light; on paper, as ink
    const cut = ink && ink.light ? cutLight(layers, parts, { floor: tell.recap ? 14 : 0 }) : cutOut(layers, parts);
    if (cut && cut.light) cut.parts = parts;
    life.show(cut, motionOf(parts), performance.now() / 1000);
  }).catch((err) => console.log(`life: ${err.message}`));
}
// The light a part lifted out of, hidden while it moves on its own (life.js), each in its own soft
// shape: on the GPU for tonight's, and on a night told again, over its kept picture as light
const HOLE_K = 1 / 4;
function hideLifted(cuts) {
  const out = cuts.filter((c) => c && c.light && c.parts);
  let mask = null;
  if (out.length) {
    mask = document.createElement('canvas');
    mask.width = UNITS.W * HOLE_K; mask.height = UNITS.H * HOLE_K;
    const g = mask.getContext('2d');
    for (const c of out) {
      const [x0, y0, x1, y1] = c.box, w = Math.max(1, Math.ceil((x1 - x0) * HOLE_K)), h = Math.max(1, Math.ceil((y1 - y0) * HOLE_K));
      g.drawImage(maskOf(c.parts, c.box, HOLE_K, w, h), x0 * HOLE_K, y0 * HOLE_K);
    }
  }
  if (ink && ink.setHoles) ink.setHoles(mask);
  keptLight.holes(mask);
}
// A night told again, in their world: its kept painting as light (from the picture divided by the
// paper it was painted on), over the kept picture, which waits under it unseen
const keptLight = {
  key: null, base: null,
  show(pic) {
    const c = $('#keptlight'), key = picKey(pic);
    if (this.key === key) return;
    this.key = key; this.base = null;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    keptLayers(pic).then((L) => {
      if (this.key !== key) return;
      this.base = inkAsLight(L.ink, { floor: 14, glow: 7 * ((L.ink.width || 1600) / UNITS.W) });
      c.width = this.base.width; c.height = this.base.height;
      this.holes(null);
    }).catch((err) => console.log(`kept light: ${err.message}`));
  },
  holes(mask) {
    if (!this.base) return;
    const c = $('#keptlight'), g = c.getContext('2d');
    g.globalCompositeOperation = 'copy';
    g.drawImage(this.base, 0, 0);
    if (mask) { g.globalCompositeOperation = 'destination-out'; g.drawImage(mask, 0, 0, c.width, c.height); }
    g.globalCompositeOperation = 'source-over';
  },
};
function unfilm() {
  const sheet = $('#sheet');
  if (sheet.classList.contains('filmed')) { sheet.classList.remove('filmed'); sheet.style.transform = ''; }
  state.shot = null;
  if (life) life.rest(performance.now() / 1000);
}

// light the part of the painting a line is about; dim the rest a little
function spotlight(box) {
  // drawn into their world, the light itself dims round it (there is no paper to shade)
  if (inWorld() && ink.setFocus) ink.setFocus(box || null);
  const spot = $('#spot');
  if (!box) { spot.classList.remove('on'); return; }
  const [x0, y0, x1, y1] = box;
  const cx = ((x0 + x1) / 2) * SCALE, cy = ((y0 + y1) / 2) * SCALE;
  const r = Math.max(120, (Math.hypot(x1 - x0, y1 - y0) / 2) * SCALE * 1.15);
  // with the camera in close, the rest of the painting is half out of frame already: dim it less
  const dim = $('#sheet').classList.contains('filmed') ? 0.2 : 0.42;
  spot.style.background = `radial-gradient(circle ${Math.round(r * 1.6)}px at ${Math.round(cx)}px ${Math.round(cy)}px, rgba(20,18,16,0) 0%, rgba(20,18,16,0) 55%, rgba(20,18,16,${dim}) 100%)`;
  spot.classList.add('on');
}

function stopTelling(message) {
  state.mode = 'paint';
  state.tell = null;
  state.line = null;
  voice.pause();
  if (aloud) aloud.stop();
  $('#tell').hidden = true;
  spotlight(null);
  if (message) toast(message, 3);
  updateHints();
}

function tellPress(button) {
  const tell = state.tell;
  if (tell && tell.recap) {
    if (button === 'back') return endRecap(tell.i + 1);
    if (button === 'select') nextLine();
    else if (button === 'playpause') {
      tell.paused = !tell.paused;
      if (tell.paused) { voice.pause(); if (aloud) aloud.stop(); } else { voice.play().catch(() => {}); tell.next = performance.now() + 4000; }
      toast(tell.paused ? 'Paused.' : 'Telling.', 1.2);
    }
    return;
  }
  if (button === 'back' && tell && tell.agent) { if (state.guiding) state.guiding.leaving = true; return tell.agent.done(tell.i + 1); }
  if (button === 'back') {
    // what they reacted to so far is kept; the rest goes in as told
    const kept = tell && tell.i >= 0 ? keepNight() : null;
    stopTelling();
    guide.event('told', kept ? keptOf(kept) : null);
    return;
  }
  if (!tell) return;
  if (button === 'up') react('yes');
  else if (button === 'down') react('no');
  else if (button === 'select') nextLine();
  else if (button === 'playpause') {
    tell.paused = !tell.paused;
    if (tell.paused) voice.pause(); else { voice.play().catch(() => {}); tell.next = performance.now() + 4000; }
    toast(tell.paused ? 'Paused.' : 'Telling.', 1.2);
  }
}

// ---------------------------------------------------------------- the guide, as an agent

// After "Feel it again" (or one word), the guide takes over: Claude, through the guide service,
// with the harness's tools (harness.js): it looks at the painting (numbered, closer, as it was part
// way through, earlier nights'), reads how strokes were painted, searches their dream world, asks
// them on the TV when only they can answer, tells the dream as they answer each line, may tell
// what wasn't right again, and remembers the night. The screen says what it is doing.
function showWorking(text) {
  const el = $('#working');
  el.querySelector('.text').textContent = `${text}…`;
  el.hidden = false;
}
const hideWorking = () => { $('#working').hidden = true; };
const unionBox = (ns) => {
  const bs = summarize(brush).filter((s) => ns.includes(s.n)).map((s) => s.box);
  return bs.length ? bs.reduce((u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])]) : null;
};

// The head start: the storyteller begins as the painting comes back to be marked (startReplay), and
// hears how it felt once they have marked it or chosen a word (`give(how)`), or that they went back
// to the paper (`give(null)`). Its first look, read and recall are done by then: one turn fewer to
// wait for once they have marked it.
function headStart() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  const ahead = { promise, give: (how) => { if (state.ahead === ahead) state.ahead = null; resolve(how); } };
  startGuide({ ahead });
  return ahead;
}
// what they marked, to the storyteller: to its head start, if it has one; else to one begun now
function toGuide(how) {
  if (state.ahead) return state.ahead.give(how);
  return startGuide(how);
}
const dropAhead = () => { if (state.ahead) state.ahead.give(null); };

async function startGuide(how) {
  const L = state.line, ahead = how.ahead || null;
  // whose night this is: if someone else is painting by the time it is kept, it is still kept as theirs
  const who = painter, theirs = world, key = worldKey(painter), theirNights = archive, pics = paintings;
  const session = { leaving: false, step: null, steps: [], tools: [], who, real: null };
  state.guiding = session;
  // the screen is the storyteller's once they have marked it: with a head start, the painting is
  // still coming back
  const enter = () => {
    state.mode = 'guide';
    $('#stage').classList.remove('replaying');
    $('#say').hidden = true;
    spotlight(null);
    showWorking(session.step || 'The storyteller is looking at what you drew');
    updateHints();
  };
  if (!ahead) enter();
  const E = how.ending ? state.ending : null;
  const ctx = {
    strokes: summarize(brush), points: brush.strokes.map((x) => x.points), snapshot: null, // (below)
    feeling: E ? endingFeeling(E, how.feeling) : how.feeling ? { byStroke: how.feeling.byStroke, arousal: how.feeling.arousal || [] } : null, felt: how.felt ?? null,
    turn: L && L.read ? (L.read.turn || (L.read.focus != null ? { n: L.read.focus } : null)) : null,
    words: state.words.slice(), washed: state.washed.slice(), said: guide.remarks.slice(-6), session: sitting(brush), date: Date.now(), young: !!(who && who.young),
    ...(E ? { ending: { night: E.night, strokes: summarize(brush).slice(E.from).map((x) => x.n), told: E.told } } : {}),
    // what they chose in their world to paint tonight
    ...(state.about && !E ? { chose: state.about } : {}),
  };
  // what is visiting their world from another's tonight (visits.js)
  const guests = who ? visitorCards(who).map((c) => c.visit.brief) : [];
  if (guests.length) ctx.visitors = guests;
  if (E) $('#ending').hidden = true;
  const keep = !state.nightKept || !!E;
  const before = theirs ? countsOf(theirs) : null;
  const tools = createTools(ctx, {
    world, paintings, archive, render, save: () => keepTheirs(theirs, key, theirNights),
    ui: {
      ask: (q) => guideAsk(q, session), tell: (t) => guideTell(t, session, ctx),
      // a telling sent back: what the guide is doing now
      working: (step) => { session.steps.push(step); if (!session.leaving && state.mode === 'guide') { session.step = step; showWorking(step); } },
    },
  });
  if (!keep) tools.remember = async () => ({ kept: [], let_go: [], note: 'This is already kept as a chapter; nothing more is kept.' });
  // once a dream is told, they may paint what happens next, once a night
  const goesOn = !E && !!ai;
  // the night's mood, for the night it wakes into, from how it felt to them
  const moodOf = () => {
    const by = ctx.feeling && ctx.feeling.byStroke && ctx.feeling.byStroke.length ? ctx.feeling.byStroke : null;
    return { v: by ? by.reduce((a, v) => a + v, 0) / by.length : 0 };
  };
  // with a head start: what they marked, as the storyteller hears it once it has come (null if they
  // went back to the paper); then the screen is the storyteller's
  const since = ctx.words.length;
  const later = !ahead ? null : ahead.promise.then((got) => {
    if (!got || session.leaving || painter !== who) { session.leaving = true; return null; }
    how = got;
    const R = state.line && state.line.read;
    Object.assign(ctx, {
      feeling: got.feeling ? { byStroke: got.feeling.byStroke, arousal: got.feeling.arousal || [] } : null, felt: got.felt ?? null,
      turn: R ? (R.turn || (R.focus != null ? { n: R.focus } : null)) : null, words: state.words.slice(),
    });
    session.mood = moodOf();
    enter();
    // the night it will wake into, made now: making it stops the page a moment, which the painting
    // coming back to be marked shouldn't
    setTimeout(() => { if (!session.leaving) nightOf(session); }, 0);
    return laterMessage(ctx, { brief: briefFor(world, ctx), since });
  });
  try {
    // the painting kept is the painting; what the guide is shown is what they see
    ctx.snapshot = await snapshotOf(768);
    if (inWorld()) Object.assign(ctx, { lit: true, seen: await seenOf(768), asSeen: seenAsLight });
    const numbered = await render.over(ctx.seen || ctx.snapshot, ctx.strokes, {});
    // a child's guide: the service adds what it must hold to (simple, gentle, nothing frightening);
    // and that it is drawn as light, in their world
    const flags = { ...(who && who.young ? { young: true } : {}), ...(ctx.lit ? { lit: true } : {}) };
    const asked = Object.keys(flags).length ? { agent: (body) => ai.agent({ ...body, ...flags }) } : ai;
    // the night it will wake into as it is told, made while the storyteller thinks: making it stops
    // the page a moment, better now than as the story starts
    Object.assign(session, { layers: liveLayers(), mood: moodOf() });
    // (just after the storyteller's first request is on its way; with a head start, once they have marked it)
    if (!ahead) setTimeout(() => { if (!session.leaving) nightOf(session); }, 0);
    const brief = briefFor(world, ctx);
    tools.briefed(brief);
    const r = await runGuide({
      ai: asked, first: firstMessage(ctx, { numbered, brief, later: !!ahead }), tools, later,
      stop: () => session.leaving && !session.told,
      onTurn: (content) => {
        for (const b of content) if (b.type === 'tool_use') session.tools.push(b.name);
        const step = stepOf(content);
        if (step && !session.leaving && state.mode === 'guide') { session.step = step; session.steps.push(step); showWorking(step); }
      },
    });
    state.lastGuide = { tools: session.tools, steps: session.steps, rounds: r.rounds, early: r.early, told: r.told, kept: r.kept, goodnight: r.goodnight, checks: tools.checks, young: !!(who && who.young), painted: (brief.how_they_painted || {}).notable || [] };
    if (painter !== who) return; // someone else is painting now
    if (!r.told) throw new Error('the guide did not tell it');
    if (r.kept && keep) { state.nightKept = true; state.keptStrokes = brush.strokes.length; state.endsOn = who.id; }
    // the night made real, kept with its painting
    if (r.kept && keep && session.real) state.realKept = keepReal(session.real, { night: r.kept.night, who, pics, theirs, save: () => keepTheirs(theirs, key, theirNights) });
    finishGuide(session);
    if (r.kept && keep && before) showCollected(before, who);
    const kept = r.kept && keep ? keptOf({ kept: r.kept.kept || [], turnedDown: r.kept.let_go || [], next: !!r.kept.next }) : null;
    // what the night kept, and goodnight: said in their world, back where it has grown; or here,
    // if they left to paint on
    const told = [kept, r.goodnight].filter(Boolean).join(' ') || null;
    if (E) {
      endEnding(null);
      guide.event('told', session.leaving ? told : null);
      if (!session.leaving) backToWorld({ note: told });
      return;
    }
    if (goesOn && r.kept && keep && !session.leaving) {
      guide.event('told', kept);
      return offerEnding({ night: r.kept.night, told: finalTelling(tools.tellings), feeling: ctx.feeling, goodnight: r.goodnight });
    }
    guide.event('told', session.leaving ? told : null);
    if (!session.leaving) backToWorld({ note: told });
  } catch (err) {
    console.log(`the guide: ${err.message}`);
    state.lastGuide = { tools: session.tools, error: err.message };
    // with a head start, nothing changes on screen before they have marked it; gone back to the
    // paper, there is nothing to tell
    if (later && (await later.catch(() => null)) == null) { if (state.guiding === session) state.guiding = null; return; }
    if (painter !== who) return;
    finishGuide(session);
    if (E) { endEnding('The storyteller couldn’t be reached. What you drew stays in your world.'); return; }
    // the guide couldn't be reached, or went wrong: their line, told plainly (unless they left)
    if (!session.leaving && !session.told) startTelling(how);
  }
}

function finishGuide(session) {
  // a guide they left, finishing after another has begun: that one has the TV
  if (state.guiding !== session) return;
  state.guiding = null;
  hideWorking();
  // left, they went on painting, or are feeling a new painting again: what is on the TV now stays
  if (!(state.mode === 'guide' || state.mode === 'ask' || (state.mode === 'tell' && state.tell && state.tell.agent))) {
    if (state.mode === 'paint') state.line = null;
    return updateHints();
  }
  $('#feel').hidden = true;
  state.mode = 'paint';
  state.tell = null;
  state.ask = null;
  state.line = null;
  $('#tell').hidden = true;
  spotlight(null);
  updateHints();
}

// Back while the guide is looking: they'd rather paint. Before the telling, it stops; after, it
// finishes quietly.
function guidePress(button) {
  if (button !== 'back' || !state.guiding) return;
  state.guiding.leaving = true;
  hideWorking();
  // they paint on the ink; a picture made of this painting is kept with it, not shown over it
  hideReal();
  state.mode = 'paint';
  updateHints();
}

// The guide's question, on the TV: what it asks, its answers and Skip (and their words, if they
// say it on the phone), the marks it means lit, and an earlier night's mark beside them if it
// shows one.
function guideAsk(q, session) {
  if (session.leaving) return Promise.resolve({ answer: null, by: 'skipped' });
  return new Promise((resolve) => {
    hideWorking();
    state.mode = 'ask';
    const el = $('#feel');
    el.classList.remove('arriving', 'offering');
    state.ask = {
      agent: true, n: q.strokes[0] ?? null, choices: q.choices, heard: null, i: 0,
      resolve: (r) => { state.ask = null; el.hidden = true; el.querySelector('.beside').hidden = true; el.classList.remove('over-line'); spotlight(null); if (state.mode === 'ask') { state.mode = 'guide'; showWorking('The storyteller is listening'); } updateHints(); sound.dip(false); resolve(r); },
    };
    el.querySelector('.ask').textContent = q.question;
    el.querySelector('.marks').textContent = phone && phone.listening ? 'Choose, or say it on your phone.' : '';
    const beside = el.querySelector('.beside');
    if (q.beside) { beside.querySelector('img').src = q.beside.image; beside.querySelector('.caption').textContent = `Chapter ${q.beside.night}`; beside.hidden = false; } else beside.hidden = true;
    const box = unionBox(q.strokes);
    spotlight(box);
    el.classList.toggle('high', !!box && (box[1] + box[3]) / 2 > 520);
    showAsk();
    el.hidden = false;
    updateHints();
    if (phone) phone.ask(q.question);
    if (readsAloud()) aloud.say(q.question);
    picturesFor(state.ask);
  });
}
// Picture choices: an answer that names something already in their world (or visiting it) shows
// its own picture beside the words, its strokes as light, as it stands at home: so a child who
// can't read yet can still choose. The storyteller's answers, and the TV's own question's ("the
// moon castle, again"). Each made once, from the night it first came.
const choicePics = new Map();
function picturesFor(a) {
  if (!a || a !== state.ask || !world || !painter) return;
  a.pics = new Map();
  const p = painter, things = [...cardsOf(world.toJSON(), { young: young() }), ...visitorCards(p)];
  const choices = askChoices().filter((c) => c.said && c.by !== 'phone');
  for (const c of new Map(choices.map((c) => [c.said, c])).values()) {
    const t = c.entity ? things.find((x) => x.id === c.entity) : namedIn(c.said, things);
    if (t) pictureOfThing(p, t).then((url) => { if (url && state.ask === a) { a.pics.set(c.said, url); showAsk(); } });
  }
}
function pictureOfThing(p, card) {
  const pp = card.visit ? card.visit.p : p, at = `${worldKey(pp)}:${card.visit ? card.visit.id : card.id}`;
  if (!choicePics.has(at)) {
    choicePics.set(at, (async () => {
      const pic = await createPaintings(undefined, paintingsKey(pp)).get(card.first);
      const parts = pic ? keptPartsOf(pic, card.strokes) : [];
      if (!parts.length) return null;
      const layers = await keptLayers(pic);
      return lightOnNight(cutLight(layers, parts), 132, 92, { pad: 0.06 }).toDataURL('image/png');
    })().catch((err) => { console.log(`a choice's picture: ${err.message}`); return null; }));
    while (choicePics.size > 24) choicePics.delete(choicePics.keys().next().value);
  }
  return choicePics.get(at);
}

// The guide's telling: each line lit on its strokes and spoken, slower and softer where it felt
// heavier there, quicker where stirred; ▲ that's it, ▼ not quite. It ends by handing back what they
// said of each line (and anything said on the phone meanwhile); Back stops it there.
function guideTell(t, session, ctx) {
  if (session.leaving) return Promise.resolve({ reactions: [], words: [], stopped: 0 });
  return new Promise((resolve) => {
    hideWorking();
    const turnN = ctx.turn ? ctx.turn.n : null;
    const at = (ns, xs) => { const v = ns.map((n) => ctx.strokes.findIndex((s) => s.n === n)).filter((i) => i >= 0).map((i) => (xs || [])[i] ?? 0); return v.length ? v.reduce((a, x) => a + x, 0) / v.length : 0; };
    const lines = t.lines.map((l, i) => {
      const v = ctx.feeling ? at(l.strokes, ctx.feeling.byStroke) : 0, a = ctx.feeling ? at(l.strokes, ctx.feeling.arousal) : 0;
      return { text: l.text, strokes: l.strokes, ...(l.other ? { other: l.other, otherAudio: null } : {}), box: unionBox(l.strokes), v, a, audio: null, voice: voiceOf({ v, a, roles: [...(l.strokes.includes(turnN) ? ['turn'] : []), ...(i === t.lines.length - 1 && i ? ['ending'] : [])] }) };
    });
    // the voice, line by line, as it comes; and each line's other way, ready for a "not quite"
    for (const l of lines) ai.speak({ text: l.text, ...l.voice }).then((r) => { l.audio = r && r.audio; }).catch(() => {});
    for (const l of lines) if (l.other) ai.speak({ text: l.other, ...l.voice }).then((r) => { l.otherAudio = r && r.audio; }).catch(() => {});
    if (!t.again && !t.ending) stamp(t.title);
    const tell = {
      // a moment for the first line's voice to arrive
      title: t.again ? `${t.title}, once more` : t.ending ? `${t.title}, and what happened next` : t.title, lines, i: -1, paused: false, next: performance.now() + 900, reactions: lines.map(() => null), told: true, layers: liveLayers(), session,
      agent: {
        words: [],
        done: (stopped) => {
          const r = { reactions: tell.reactions.slice(), words: tell.agent.words.slice(), stopped, swapped: (tell.swapped || []).slice() };
          voice.pause();
          $('#tell').hidden = true;
          spotlight(null);
          state.tell = null;
          // back to the paper before the end: the dream goes back to sleep
          if (stopped) unwake();
          if (stopped) { state.mode = 'paint'; hideWorking(); } else { state.mode = 'guide'; showWorking('The storyteller is listening'); }
          updateHints();
          // told to the end: the ink becomes the picture, once it is made
          if (!stopped) revealReal(session);
          resolve(r);
        },
      },
    };
    // a night's first telling: its Illustrator starts on the picture as the story starts; told
    // again, it is told over the ink, and blooms again at its end
    const felt = ctx.feeling && ctx.feeling.byStroke && ctx.feeling.byStroke.length ? ctx.feeling.byStroke.reduce((a, v) => a + v, 0) / ctx.feeling.byStroke.length : 0;
    if (!t.again && !t.ending) dreamReal(session, { title: t.title, lines }, tell.layers, { v: felt });
    else veilReal();
    // where it wakes, made now (once, on the GPU), so the first line can wake its part: on a world's
    // first night, its place is asked for now, from the story it starts with
    unwake();
    if (!t.again && !t.ending) placeAsTold(session, { title: t.title, lines });
    nightOf(session);
    session.told = true;
    state.tell = tell;
    state.mode = 'tell';
    const el = $('#tell');
    el.querySelector('.title').textContent = tell.title;
    el.querySelector('.text').textContent = '…';
    el.querySelector('.count').textContent = '';
    el.classList.remove('high');
    el.hidden = false;
    updateHints();
    film(tell);
  });
}

// ---------------------------------------------------------------- dream it real

// Once a painting is told, its Illustrator (the guide service's illustrator.mjs) makes it real: it
// looks at the ink and reads the story and what is true of the things in it, and an image model
// paints that over their strokes, everything where they put it. It starts as the story starts, so
// the picture is mostly there by its end; then the ink blooms into it. Kept with the night's
// painting, it is how their world looks from then on: on its map and cards, in last time's story,
// on the TV at rest; and how each thing looks is kept in their world, so it looks the same night
// after night. Once a night, only with a guide; the ink stays wherever there is no picture.
const REAL_SIZE = { W: 1280, H: 800 };
// the same hand for a painter's pictures, night after night
const realSeed = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h % 858993459; };
// their ink alone, on white, at the picture's size: what the picture holds to
function inkForReal(layers) {
  const c = document.createElement('canvas');
  c.width = REAL_SIZE.W; c.height = REAL_SIZE.H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  if (layers && layers.ink) g.drawImage(layers.ink, 0, 0, c.width, c.height);
  else return ink.snapshot(REAL_SIZE.W, 0.9);
  return c.toDataURL('image/jpeg', 0.9);
}
function dreamReal(session, told, layers, mood = null) {
  const who = session.who;
  if (!who || painter !== who || !world || session.real) return;
  // what it wakes up into at night, if no picture is made of it
  Object.assign(session, { layers, mood });
  const R = state.real = { session, want: false, made: null };
  if (!ai || !ai.real) { session.real = Promise.resolve(null); return; }
  const lines = told.lines.map((l) => ({ text: l.text, box: l.box }));
  const things = world.recognize({ words: lines.map((l) => l.text) }).filter((x) => x.said).map((x) => x.id);
  // what it is asked with, kept to paint it again in another look (againChosen)
  R.ask = { image: inkForReal(layers), brief: illustrateBrief(world.toJSON(), { title: told.title, lines, things }), young: !!who.young, look: who.young ? 'film' : 'real' };
  session.real = ai.real({ ...R.ask, seed: realSeed(`${sitter()}:${who.id}`) }).then(toPaper).then((r) => {
    if (!r || !r.image) { if (r && r.blocked) console.log('dream it real: the picture was turned down'); return null; }
    // its versions, the one shown first (`k`)
    if (state.real === R) { R.made = { ...r, look: R.ask.look }; R.takes = [R.made]; R.k = 0; if (R.want) showReal(r); if (state.offer && !state.offer.after) showOffer(); }
    return r;
  }).catch((err) => { console.log(`dream it real: ${err.message}`); return null; });
}
// A picture made real, at the paper's own shape, as everything that crops it takes it: an image
// model that paints only in shapes of its own (Gemini's nearest to 16:10 is 3:2) is fitted back
async function toPaper(r) {
  if (!r || !r.image) return r;
  try {
    const im = new Image();
    im.src = r.image;
    await im.decode();
    if (Math.abs((im.naturalWidth * UNITS.H) / (im.naturalHeight * UNITS.W) - 1) < 0.01) return r;
    const c = document.createElement('canvas');
    c.width = 1280; c.height = 800;
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return { ...r, image: c.toDataURL('image/jpeg', 0.92) };
  } catch (err) { console.log(`dream it real, fitted to the paper: ${err.message}`); return r; }
}
// The story is told: the picture, if it is made; meanwhile, or if none is to be made, the painting
// wakes up at night, its own ink lit (night.js); a picture made later blooms over that.
function revealReal(session) {
  const R = state.real;
  if (!R || R.session !== session) return;
  R.want = true;
  if (R.made) return showReal(R.made);
  nightOf(session).then((night) => { if (night && state.real === R && R.want && !R.made) showReal(night); });
}
// While a dream is told, the parts already told wake into it: as the next line comes, the part
// the last one was about settles back into the paper (life.js), and wakes there into the night the
// painting wakes into at the end (nightOf), through a soft opening the shape of its own strokes; the
// rest is still paper until its own line. At the end the whole of it blooms (showReal) over
// them. How far the night opens around a part's strokes, in paper units, and its soft edge beyond:
const AURA = 50, EDGE = 70;
function wakeLine(session, line) {
  // drawn into their world, it is already there, lit: nothing to open onto
  if (!line || !line.strokes || !line.strokes.length || inWorld()) return;
  const tell = state.tell;
  nightOf(session).then((night) => {
    if (!night || state.tell !== tell || $('#real').classList.contains('shown')) return;
    const parts = partsOf(tell, line.strokes), reach = parts.length ? reachOf(parts) : null;
    if (!reach) return;
    // the box reaches past the softened edge, so that nothing of it is cut straight
    const pad = AURA + EDGE, out = pad + 64;
    const box = [Math.max(0, reach[0] - out), Math.max(0, reach[1] - out), Math.min(UNITS.W, reach[2] + out), Math.min(UNITS.H, reach[3] + out)];
    const bw = box[2] - box[0], bh = box[3] - box[1];
    if (bw <= 0 || bh <= 0) return;
    // the opening, drawn small: the strokes grown, in steps out to its edge, then softened. It is
    // laid over the night picture already shown, as its mask: one small picture, nothing redrawn
    const q = 1 / 8, mw = Math.max(1, Math.ceil(bw * q)), mh = Math.max(1, Math.ceil(bh * q));
    const canvas = () => { const c = document.createElement('canvas'); c.width = mw; c.height = mh; return c; };
    let shape = canvas();
    const sg = shape.getContext('2d');
    for (const [grow, a] of [[pad, 0.18], [AURA + EDGE * 0.6, 0.3], [AURA + EDGE * 0.25, 0.5], [AURA, 1]]) {
      sg.globalAlpha = a;
      sg.drawImage(maskOf(parts, box, q, mw, mh, { grow, hard: true }), 0, 0);
    }
    if ('filter' in sg) { const soft = canvas(), fg = soft.getContext('2d'); fg.filter = 'blur(2px)'; fg.drawImage(shape, 0, 0); shape = soft; }
    const sheet = $('#sheet'), W = sheet.offsetWidth, H = sheet.offsetHeight, kx = W / UNITS.W, ky = H / UNITS.H;
    const left = Math.round(box[0] * kx), top = Math.round(box[1] * ky);
    const w = Math.round(box[2] * kx) - left, h = Math.round(box[3] * ky) - top;
    const mask = `url(${shape.toDataURL()})`;
    const el = document.createElement('div');
    el.className = 'waken';
    Object.assign(el.style, {
      left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px`,
      backgroundImage: `url("${night.image}")`, backgroundSize: `${W}px ${H}px`, backgroundPosition: `${-left}px ${-top}px`,
      webkitMaskImage: mask, maskImage: mask, webkitMaskSize: '100% 100%', maskSize: '100% 100%', webkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
    });
    $('#woken').append(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  });
}
// back to the paper, or the whole picture over it: the openings fade, and go
function unwake() {
  for (const el of [...$('#woken').children]) {
    if (!el.classList.contains('on')) { el.remove(); continue; }
    el.classList.remove('on');
    setTimeout(() => el.remove(), 1900);
  }
}

// a canvas as a picture to show, encoded away from the page's thread
const asUrl = (c, quality = 0.9) => new Promise((ok) => (c ? c.toBlob((b) => ok(b ? URL.createObjectURL(b) : null), 'image/jpeg', quality) : ok(null)));
// tonight's painting at night, made once (on the GPU: glow.js); the last few kept
// tonight's painting woken, made once (on the GPU: glow.js), in their world's place, or at night
// until it has one; the last few kept
const woken = [];
function nightOf(session) {
  if (session.night) return session.night;
  // a world with no place yet has it written as tonight's story starts (placeAsTold), and wakes into it
  if (!session.place && placeDue(session.who)) return Promise.resolve(null);
  session.night = (async () => {
    const strokes = summarize(brush).map((x) => ({ ...x, path: (brush.strokes[x.n - 1]?.points || []).map((q) => [q.x, q.y]) }));
    const layers = session.layers && session.layers.ink ? session.layers : null;
    const place = session.place ? await Promise.race([session.place, new Promise((ok) => setTimeout(() => ok(null), PLACE_WAIT))]) : await placeFor(session.who, world && world.scene);
    const image = await asUrl(nightPainting({ ink: layers ? layers.ink : null, strokes, seed: realSeed(`${session.who.id}:${world.tonight()}`) % 997, mood: session.mood, scene: place && place.scene, backdrop: place && place.backdrop, lit: inWorld() }));
    if (!image) return null;
    woken.push(image);
    while (woken.length > 3) { const old = woken.shift(); if ($('#real').getAttribute('src') !== old) URL.revokeObjectURL(old); }
    return (session.woke = { image, night: true, place: !!place });
  })().catch((err) => { console.log(`woken: ${err.message}`); return null; });
  return session.night;
}
// where the ink is thickest, as a share of the paper: where the picture blooms from
function bloomAt(strokes) {
  const bs = (strokes || []).filter((s) => s && s.box);
  if (!bs.length) return [50, 55];
  let x = 0, y = 0, w = 0;
  for (const s of bs) { const [x0, y0, x1, y1] = s.box, a = Math.max(400, (x1 - x0) * (y1 - y0)); x += ((x0 + x1) / 2) * a; y += ((y0 + y1) / 2) * a; w += a; }
  return [Math.round((x / w / 1600) * 100), Math.round((y / w / 1000) * 100)];
}
function showReal(r, { strokes = null } = {}) {
  const img = $('#real');
  const [x, y] = bloomAt(strokes || summarize(brush));
  img.classList.remove('shown', 'gone');
  img.style.setProperty('--x', `${x}%`);
  img.style.setProperty('--y', `${y}%`);
  img.src = r.image;
  img.decode().then(() => {
    if (img.getAttribute('src') !== r.image) return;
    void img.offsetWidth;
    img.classList.add('shown');
    $('#stage').classList.add('woke');
    // once the whole of it has bloomed over them, the openings under it go
    setTimeout(() => { if (img.classList.contains('shown')) unwake(); }, 5200);
    sound.bloom();
  }).catch(() => {});
}
// the ink again, the picture still to come back (veilReal), or let go with this painting (hideReal)
function veilReal() {
  const img = $('#real');
  stillAgain();
  $('#stage').classList.remove('woke');
  unwake();
  if (!img.classList.contains('shown')) { img.removeAttribute('src'); return; }
  img.classList.add('gone');
  img.classList.remove('shown');
  setTimeout(() => { if (!img.classList.contains('shown')) { img.removeAttribute('src'); img.classList.remove('gone'); } }, 700);
}
function hideReal() {
  state.real = null;
  veilReal();
}
// a picture as a JPEG `width` wide, to keep
async function asJpeg(url, width = 1024, quality = 0.86) {
  const im = new Image();
  im.src = url;
  await im.decode();
  const c = document.createElement('canvas');
  c.width = width; c.height = Math.round((width * im.naturalHeight) / im.naturalWidth);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}
// kept with the night's painting; and how each thing in it looks, kept in their world (the first
// time only: a thing keeps its look)
async function keepReal(made, { night, who, pics, theirs, save }) {
  const r = await made;
  if (!r || !r.image) return;
  try {
    const real = await asJpeg(r.image);
    const p = await pics.get(night);
    if (p) await pics.put(night, { ...p, real });
    if (theirs.looked(r.looks || [], { night }).length) save();
    // their world, if it is open, shows it
    const A = state.atlas;
    if (A && A.p === who && !A.wonder && !A.look && !A.walk) showAtlas();
  } catch (err) { console.log(`dream it real, kept: ${err.message}`); }
}
// a part of a picture made real, around `box` (paper units), w by h: the card's shape, a little
// of what is around it too
function realCrop(img, box, w, h) {
  const k = img.naturalWidth / 1600, [x0, y0, x1, y1] = box;
  let bw = Math.max(340, (x1 - x0) * 1.7), bh = Math.max(240, (y1 - y0) * 1.7);
  if (bw / bh > w / h) bh = (bw * h) / w; else bw = (bh * w) / h;
  const fit = Math.min(1, 1600 / bw, 1000 / bh);
  bw *= fit; bh *= fit;
  const sx = Math.max(0, Math.min(1600 - bw, (x0 + x1) / 2 - bw / 2)), sy = Math.max(0, Math.min(1000 - bh, (y0 + y1) / 2 - bh / 2));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, sx * k, sy * k, bw * k, bh * k, 0, 0, w, h);
  return c;
}

// ---------------------------------------------------------------- their world, as cards

const cap = (t) => String(t || '').charAt(0).toUpperCase() + String(t || '').slice(1);
// how many nights each thing of a world has come, by id
const countsOf = (w) => new Map(cardsOf(w.toJSON()).map((c) => [c.id, c.nights]));
// A card: a thing's picture (a canvas), its name, when it came and how it felt; a badge on top
function cardEl(c, { badge = null, back = false, art = null } = {}) {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `${badge ? `<span class="badge${back ? ' back' : ''}">${esc(badge)}</span>` : ''}<span class="art"></span><p class="name">${esc(cap(c.name))}</p>${c.lore ? `<p class="lore">${esc(c.lore)}</p>` : ''}<p class="line">${esc(cardLine(c))}</p>${cardOrigin(c) ? `<p class="origin ${c.origin}">${esc(cardOrigin(c))}</p>` : ''}<p class="felt">${c.felt ? esc(`Felt ${c.felt}`) : ''}</p>`;
  if (art) el.querySelector('.art').append(art);
  return el;
}
// What tonight added to their world, as cards that fly in beside the painting: a thing new to
// their world, its picture cut from tonight's painting; or one come back, and how many nights.
function showCollected(before, who) {
  if (!world || painter !== who || !before) return;
  const S = world.toJSON(), night = S.nights.length ? S.nights[S.nights.length - 1].n : null;
  const cards = cardsOf(S, { young: young() });
  const show = [
    ...cards.filter((c) => !before.has(c.id)).map((c) => ({ c, fresh: true })),
    ...cards.filter((c) => before.has(c.id) && c.nights > before.get(c.id)).map((c) => ({ c, fresh: false })),
  ].slice(0, 3);
  if (!show.length) return;
  state.collected = show.map(({ c, fresh }) => ({ name: c.name, fresh }));
  const layers = liveLayers();
  // two on screen at most, so they fit: the next comes once one has gone; the storyteller's panel
  // steps aside while they are there. A thing new to their world comes to life on its card, which
  // stays until it has (or it can't)
  const STAY = 5600, LIFE = 22000, stage = $('#stage');
  let i = 0, up = 0, done = false;
  stage.classList.add('collecting');
  const finish = () => { if (!done && !up && i >= show.length) { done = true; if (!$('#collected').children.length) stage.classList.remove('collecting'); } };
  const gone = (el) => {
    if (el) { el.classList.add('leaving'); setTimeout(() => { el.remove(); up--; next(); finish(); }, 800); } else { up--; next(); finish(); }
  };
  const next = () => {
    if (painter !== who) { i = show.length; return finish(); }
    if (i >= show.length || up >= 2) return;
    const k = i++, { c, fresh } = show[k];
    up++;
    let el = null;
    try {
      const e = S.entities.find((x) => x.id === c.id);
      const ns = [...(e.appearances || []), ...(e.endings || [])].filter((a) => a.night === night).flatMap((a) => a.strokes || []);
      const parts = layers ? livePartsOf(ns.length ? ns : c.strokes) : [];
      // its picture as it was drawn: light, in their world; on the paper, ink
      const art = !parts.length ? null : inWorld() ? lightOnNight(cutLight(layers, parts), 408, 285) : inkOnPaper(cutOut(layers, parts), 408, 285, { paper: paperSheet() });
      el = cardEl(c, { badge: fresh ? 'New in your world' : `Came back · ${c.nights === 2 ? 'a second chapter' : `${c.nights} chapters`}`, back: !fresh, art });
      $('#collected').append(el);
      sound.seal();
      const life = fresh && art ? comeToLife(who, c, el, state.collected[k]).catch(() => false) : null;
      const stay = life ? Promise.race([life.then((ok) => (ok ? after(3400) : null)), after(LIFE)]) : null;
      // out of their way once they paint on (its picture is still made, for their world)
      const painting = new Promise((ok) => {
        const t = setInterval(() => { if (state.mode === 'paint' && brush.strokes.length > (state.keptStrokes || 0)) { clearInterval(t); ok(); } }, 400);
        setTimeout(() => clearInterval(t), STAY + LIFE);
      });
      Promise.race([Promise.all([after(STAY), stay]), painting]).catch(() => {}).then(() => gone(el));
    } catch (err) { console.log(`a card: ${err.message}`); gone(el); }
    if (i < show.length) setTimeout(next, 1900);
  };
  setTimeout(next, 700);
}
// A thing new to their world comes to life on its card: its ink shimmers while it is made, then its
// own picture springs out of it, with sparks and a chime. Made from its first strokes, as it will
// stand in their world. Resolves true once it has, false if it can't be
const CARD_PEAK = 0.37; // index.html popIn: 90 ms of its ink's breath in, then biggest 280 ms on
async function comeToLife(who, c, el, rec) {
  const parts = livePartsOf(c.strokes).map((x) => ({ ...x, turn: turnOf(x.path), pools: [] })), box = parts.length ? reachOf(parts) : null;
  if (!ai || !ai.thing || !box || Date.now() < thingsRest) return false;
  rec.alive = 'coming';
  el.classList.add('coming');
  const note = document.createElement('p');
  note.className = 'alive';
  note.textContent = 'Coming to life…';
  el.querySelector('.name').after(note);
  // how it looks, as the Illustrator said while it was told, once that is kept
  await Promise.race([state.realKept || null, after(9000)]);
  const r = painter === who ? await bringToLife(who, c, parts, box, looksNow().get(c.id) || c.look || null) : { it: null };
  note.remove();
  el.classList.remove('coming');
  if (!r.it || !el.isConnected) { rec.alive = 'no'; return false; }
  // its picture, fitted to the card, over its ink
  const pic = document.createElement('canvas');
  pic.width = 544; pic.height = 380; pic.className = 'alive-pic';
  const src = r.it.canvas, sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, f = Math.min((pic.width * 0.9) / sw, (pic.height * 0.9) / sh);
  pic.getContext('2d').drawImage(src, (pic.width - sw * f) / 2, (pic.height - sh * f) / 2, sw * f, sh * f);
  el.querySelector('.art').append(pic);
  // its ink draws in a breath, then the picture springs out; sparks and the chime as it is biggest
  // (index.html popIn: its peak at 70% of 950 ms)
  el.append(sparksEl({ at: CARD_PEAK }));
  el.classList.add('alive');
  el.querySelector('.badge').textContent = 'It came to life!';
  after(CARD_PEAK * 1000 + 17).then(() => sound.alive());
  rec.alive = 'yes';
  return true;
}

// ---------------------------------------------------------------- their world: the home

// A painter's world is where they come back to: the map of everything painted into it, each thing
// where it first came, and what to do next: paint something new into it, paint more of one thing
// in it, or hear last time's story. ◀ ▶ go from thing to thing; ▲ ▼ choose what to do; OK does
// it; Back is the seals. Choosing a seal opens it, and so does every night's end, the world grown.
// The pictures are cut from the nights' paintings as they load.
function openWorld({ note = null, grew = false } = {}) {
  if (!painter) return openWho();
  for (const id of ['#who', '#feel', '#say', '#pair', '#ending']) $(id).hidden = true;
  const kept = $('#kept');
  kept.hidden = true;
  kept.removeAttribute('src');
  state.offer = null;
  state.mode = 'atlas';
  state.atlas = { id: painter.id, i: 0, k: 0, art: new Map(), note, grew };
  showAtlas();
  $('#atlas').hidden = false;
  updateHints();
  if (note && readsAloud()) aloud.say(note);
  // home after a night kept: the night closes on a question; else one still waiting is asked again
  if (grew && state.endsOn === painter.id) { state.endsOn = null; wonderAtEnd(state.atlas); }
  else wonderStill(state.atlas);
}
function closeWorld() {
  $('#atlas').hidden = true;
  state.atlas = null;
}
// what can be done from their world, the one chosen first; or, once the Worldbuilder has asked,
// the answers to its question
function worldActions(A) {
  if (A.look) return lookActions(A);
  if (A.said) return saidActions(A);
  if (A.forget) return A.forget.waiting ? [{ id: 'wait', text: 'Forgetting…' }] : [{ id: 'keep-it', text: 'Keep it' }, { id: 'forget-it', text: 'Forget it' }];
  if (A.wonder) {
    if (!A.wonder.w) return [{ id: 'wait', text: 'Wondering…' }];
    return [...A.wonder.w.choices.map((c) => ({ id: 'chose', text: c.say, c })), { id: 'answer', text: 'Draw my own answer' }, { id: 'let', text: 'Not now' }];
  }
  const c = A.cards[A.i];
  return [
    ...(A.due ? [{ id: 'recap', text: 'Hear last time’s story' }] : []),
    { id: 'new', text: A.mine ? 'Draw something new' : 'Draw the first thing in it' },
    ...(A.cards.length && A.night && A.night.canWalk ? [{ id: 'walk', text: 'Walk through your world' }] : []),
    ...(ai && A.cards.length ? [{ id: 'wonder', text: 'What’s out there?' }] : []),
    ...(ai && world && world.scene ? [{ id: 'looks', text: 'How it looks' }] : []),
    // how one of theirs looks, in their own words: said on their phone
    ...(ai && c && !c.visit && phone && phone.listening ? [{ id: 'say-look', text: `Say how ${c.name} looks` }] : []),
    ...(c && !c.visit ? [{ id: 'more', text: `Draw more of ${c.name}` }] : []),
    ...visitActions(A, c),
    ...(A.nights ? [{ id: 'book', text: 'Read your book' }] : []),
    ...(c && !c.visit ? [{ id: 'forget', text: `Forget ${c.name}` }] : []),
  ];
}
function showAtlas() {
  const A = state.atlas, p = painter;
  const S = world.toJSON();
  // theirs, and after them what is visiting from another's world, standing clear of theirs
  const mine = cardsOf(S, { young: !!p.young }), map = mapOf(S);
  A.visits = liveVisits();
  const guests = visitorCards(p, A.visits);
  // what is in each other world on this TV, read once as it opens (a thing never visits a world
  // that has one of its name)
  A.names = new Map((family ? family.painters : []).filter((q) => q.id !== p.id).map((q) => [q.id, namesIn(q)]));
  for (const g of guests) map.nodes.push({ id: g.id, name: g.name, kind: g.kind, ...placeVisitor(map, g, { r: 115 }), nights: 1, first: g.first, visiting: true });
  Object.assign(A, { p, cards: [...mine, ...guests], mine: mine.length, map, nights: world.tonight() - 1, art: new Map() });
  A.due = world.recap({ now: Date.now() });
  // after a night, the thing it brought is the one shown
  if (A.grew && mine.length) A.i = Math.max(0, mine.reduce((b, c, i) => ((c.last || c.first || 0) >= (mine[b].last || mine[b].first || 0) ? i : b), 0));
  const n = A.cards.length, name = sealOf(p.seal).name;
  const about = mine.length ? `${mine.length} ${mine.length === 1 ? 'thing' : 'things'} in ${A.nights} ${A.nights === 1 ? 'chapter' : 'chapters'}.` : 'Nothing in it yet.';
  // on screen, a word of welcome and no more: what came back and what is still to find is in the
  // world itself, and on each thing's card
  const welcome = welcomeOf(world, { name }), note = A.note || (welcome && A.nights ? welcome.split(/(?<=\.) /).slice(0, 2).join(' ') : welcome);
  $('#atlas').innerHTML = `<div class="night"></div><header><span class="stamp">${sealSvg(p.seal, 44)}</span><div><h2>${esc(name)}’s world</h2><p>${esc(A.note || !A.nights ? `${note ? `${note} ` : ''}${about}` : note)}</p></div></header>`
    + (mine.length ? '' : '<p class="empty">Draw something, and it will stand here, in a place made from its story: a place, someone who lives there, something that happens. A piece at a time, your world grows.</p>')
    + '<div class="side"><div class="card-slot"></div><p class="count"></p><div class="choices"><p class="ask" hidden></p><ul class="do"></ul></div></div>'
    + '<div class="veil"></div><div class="walk-caption" hidden><p class="kicker"></p><p class="name"></p><p class="line"></p></div>';
  // where their world stands: the scene written for it when its story started (scene.js), or,
  // until it has one, the night on the lake
  const scene = world.scene, seen = scene && placeImages.get(worldKey(p));
  $('#atlas').dataset.tone = toneOf(scene);
  A.night = createNightWorld($('#atlas .night'), { seed: placeSeed(p), scene, backdrop: seen && seen.sign === signOf(scene) ? seen.img : null });
  placeOf(A, scene);
  showWorldActions();
  if (!n) return;
  showAtlasCard();
  lightAtlas(A);
  // the paths of nights the world has let go, from where every night is kept
  if (S.nights.length && S.nights[0].n > 1) {
    createNights(undefined, paintingsKey(p)).all().then((old) => {
      if (state.atlas !== A || !old.length) return;
      const held = new Set(S.nights.map((x) => x.n));
      A.map = mapOf({ ...S, nights: [...old.filter((x) => !held.has(x.n)), ...S.nights] });
      placeLights(A);
    });
  }
}
// Where their world stands, made as its story starts: once it has a night, its scene is written
// (the Set Designer, server/scenery.mjs) and drawn at once; then the place is painted from it (an
// image model, over the TV's own drawing of it, so the horizon stays where their things stand) and
// laid over the drawing when it comes. Each is kept with the world (the scene in it, the picture
// among its paintings); one that fails isn't asked for again that visit. Without the guide, the
// night on the lake.
// each by the world it is of (a demo family's painters share ids with the TV's own)
const placeImages = new Map(), placeAsked = { scene: new Set(), paint: new Set() };
const placeSeed = (p) => realSeed(`world:${p.id}`) % 997;
const signOf = (scene) => (scene ? realSeed(JSON.stringify(scene)) : null);
// their world's place as it is shown elsewhere (the painting woken, the TV at rest, Step inside, the
// sky round the paper): its scene, and the picture of it painted, if one is kept for this scene
async function placeFor(p, scene) {
  if (!p || !scene) return null;
  const w = worldKey(p), sign = signOf(scene), seen = placeImages.get(w);
  if (seen && seen.sign === sign) return { scene, backdrop: seen.img };
  const kept = await createPaintings(undefined, paintingsKey(p)).get(PLACE).catch(() => null);
  if (!kept || !kept.image || kept.sign !== sign) return { scene, backdrop: null };
  const img = new Image(); img.src = kept.image;
  try { await img.decode(); } catch { return { scene, backdrop: null }; }
  placeImages.set(w, { img, sign });
  return { scene, backdrop: img };
}
// A world that has no place yet has it written as its story starts: as tonight's telling begins,
// the Set Designer is shown the world with tonight's story in it, and the painting wakes into the
// place once it comes (at night, if it doesn't come in time). It is kept with the world; how it
// should look is asked when they are next home (lookDue), before it is painted.
const PLACE_WAIT = 12000, lookDue = new Set();
const placeDue = (p) => !!(p && world && !world.scene && ai && ai.scene && !placeAsked.scene.has(worldKey(p)));
function placeAsTold(session, told) {
  const p = session.who;
  if (session.place || !placeDue(p)) return;
  const w = worldKey(p), young = !!p.young, S = world.toJSON();
  placeAsked.scene.add(w);
  const tonight = { n: world.tonight(), title: told.title || null, lines: told.lines.map((l) => l.text), said: state.words.map((x) => x.text).filter(Boolean) };
  session.place = (async () => {
    let r = null;
    try { r = await ai.scene({ brief: sceneBrief({ ...S, nights: [...(S.nights || []), tonight] }, { young }), young }); } catch (err) { console.log(`the Set Designer: ${err.message}`); }
    if (!r || !r.scene || !painter || painter.id !== p.id || !world || !world.setScene(r.scene)) return null;
    placeAsked.scene.delete(w);
    lookDue.add(w);
    await keepTheirs(world, w, archive).catch(() => {});
    // round the paper as it is told; and, home already before it came, shown there at once
    skyPlace();
    const A = state.atlas;
    if (A && A.p && A.p.id === p.id && !A.look && redrawPlace(A)) placeOf(A, world.scene);
    return { scene: world.scene, backdrop: null };
  })();
}
async function placeOf(A, scene) {
  const p = A.p, pics = createPaintings(undefined, paintingsKey(p));
  const w = worldKey(p);
  const show = (img) => { placeImages.set(w, { img, sign: signOf(scene) }); if (state.atlas === A && A.night && A.night.setBackdrop) A.night.setBackdrop(img); };
  if (scene) {
    const kept = await pics.get(PLACE).catch(() => null);
    // painted once they have said how it looks (or let it be): asked once its place is written
    if (A.look) return;
    if (lookDue.has(w) && state.atlas === A) { lookDue.delete(w); if (scene.looks.length && !A.wonder) return openLook(A, scene); makeThings(A); }
    if (kept && kept.image && kept.sign === signOf(scene)) {
      if (A.night && A.night.painted) return;
      const img = new Image(); img.src = kept.image;
      return img.decode().then(() => show(img)).catch(() => {});
    }
    if (!ai || !ai.backdrop || placeAsked.paint.has(w)) return;
    placeAsked.paint.add(w);
    // its layout, drawn bare at the picture's size: the horizon where the stage's is
    const W = 1536, H = 864, c = document.createElement('canvas');
    c.width = W; c.height = H;
    drawSceneAround(c.getContext('2d'), { W, H, horizon: Math.round(STAGE.horizon * (H / STAGE.H)), seed: placeSeed(p), scene, bare: true });
    let r = null;
    try { r = await ai.backdrop({ scene, image: c.toDataURL('image/jpeg', 0.85), young: !!p.young, seed: realSeed(`place:${p.id}`) }); } catch (err) { console.log(`the place, painted: ${err.message}`); }
    if (!r || !r.image) { if (r && r.blocked) console.log('the place, painted: turned down'); return; }
    placeAsked.paint.delete(w);
    // kept as a JPEG at the size the TV draws it from: an image model may send a PNG several times
    // the size, and every world keeps one
    const keep = await asJpeg(r.image, 1536, 0.88).catch(() => r.image);
    await pics.put(PLACE, { image: keep, sign: signOf(scene), at: Date.now() }).catch((err) => console.log(`the place, not kept: ${err.message}`));
    const img = new Image(); img.src = r.image;
    return img.decode().then(() => show(img)).catch(() => {});
  }
  if (!ai || !ai.scene || placeAsked.scene.has(w) || world.tonight() < 2) return;
  placeAsked.scene.add(w);
  A.asking = true;
  let r = null;
  try { r = await ai.scene({ brief: sceneBrief(world.toJSON(), { young: !!p.young }), young: !!p.young }); } catch (err) { console.log(`the Set Designer: ${err.message}`); }
  try { await placeWritten(A, p, w, r); } finally { A.asking = false; }
}
async function placeWritten(A, p, w, r) {
  // still theirs: the same painter (by who they are; the painter is made again as the family is read)
  if (!r || !r.scene || !painter || painter.id !== p.id || !world) return;
  if (!world.setScene(r.scene)) return;
  // asked once a visit only while it fails: one kept is in the world (a world made again, as a demo
  // family's is each time, asks again)
  placeAsked.scene.delete(w);
  await keepTheirs(world, worldKey(p), archive).catch(() => {});
  // drawn at once, in place (the card, the choices and the one chosen as they were); then they are
  // asked how it should look, and it is painted once they have said
  if (!redrawPlace(A)) return;
  const sc = world.scene;
  if (sc.looks.length && !A.wonder) openLook(A, sc); else placeOf(A, sc);
}
// their world's place drawn again where it is shown, the rest of their world as it was
function redrawPlace(A) {
  if (state.atlas !== A || state.mode !== 'atlas' || A.walk) return false;
  const sc = world.scene;
  $('#atlas').dataset.tone = toneOf(sc);
  A.night = createNightWorld($('#atlas .night'), { seed: placeSeed(A.p), scene: sc });
  placeLights(A);
  return true;
}
// How their world looks: asked once its place is first written, and whenever they choose "How it
// looks". The Set Designer's other looks, their own words (on their phone), or as it is.
function lookActions(A) {
  if (A.look.waiting) return [{ id: 'wait', text: 'Changing how it looks…' }];
  return [...A.look.options.map((o) => ({ id: 'look', text: cap(lookSaid(o) || o).replace(/[.\s]+$/, ''), o })), { id: 'keep', text: 'Keep it as it is' }];
}
// `asked`: they chose "How it looks". Otherwise it comes by itself, once its place is written, and
// may come under a press meant for what was there: it begins on "Keep it as it is", and an OK
// pressed before they have moved in it, as it comes, is let go
function openLook(A, scene, { asked = false } = {}) {
  if (!scene) return;
  const said = lookSaid(scene.look), now = said ? `It looks like ${said.charAt(0).toLowerCase()}${said.slice(1)}. ` : '';
  A.look = { k: asked ? 0 : scene.looks.length, options: scene.looks, waiting: false, fresh: !asked, at: performance.now(), question: `${now}How should your world look?${phone && phone.listening ? ' Choose, or say it on your phone.' : ''}` };
  showWorldActions(); updateHints();
  if (readsAloud()) aloud.say(A.look.question);
}
function closeLook(A) {
  A.look = null;
  showWorldActions(); updateHints();
  placeOf(A, world.scene);
  lookSettled(A);
}
function lookPress(A, button) {
  const L = A.look;
  if (L.waiting) return;
  const acts = lookActions(A);
  if (button === 'up' || button === 'down' || button === 'left' || button === 'right') {
    L.fresh = false;
    L.k = (L.k + (button === 'up' || button === 'left' ? acts.length - 1 : 1)) % acts.length;
    showWorldActions(); sound.dip(false);
    if (readsAloud()) aloud.say(acts[L.k].text);
    return;
  }
  if (button === 'back') return closeLook(A);
  if (button !== 'select' && button !== 'playpause') return;
  if (L.fresh && performance.now() - L.at < 1500) { sound.dip(false); return; }
  const a = acts[L.k];
  if (a.id === 'keep') return closeLook(A);
  return changeLook(A, a.o);
}
// a look chosen, or said: the Set Designer writes the place again in it, and it is painted
async function changeLook(A, words) {
  const L = A.look, p = A.p;
  L.waiting = true; L.k = 0;
  showWorldActions(); updateHints();
  let r = null;
  try { r = await ai.scene({ brief: { ...sceneBrief(world.toJSON(), { young: !!p.young }), look: words }, young: !!p.young }); } catch (err) { console.log(`the Set Designer: ${err.message}`); }
  if (state.atlas !== A || A.look !== L || !painter || painter.id !== p.id) return;
  if (!r || !r.scene || !world.setScene(r.scene)) { L.waiting = false; showWorldActions(); updateHints(); toast('The Set Designer couldn’t be reached just now.', 3); return; }
  await keepTheirs(world, worldKey(p), archive).catch(() => {});
  sound.seal();
  A.look = null;
  redrawPlace(A);
  showWorldActions(); updateHints();
  placeOf(A, world.scene);
  lookSettled(A);
}
// the most things the night shows at once: the latest to come
const LIGHTS_AT_ONCE = 14;
// Each thing in its own light: its strokes lit from the painting of the night it first came, on
// the GPU, through the shape of their reach (night.js, glow.js). And, if a night of it was made
// real, its picture, for its card.
async function lightAtlas(A) {
  const mine = createPaintings(undefined, paintingsKey(A.p));
  // a visitor is lit from its own world's paintings, and stands as it was made real there
  const picsOf = (c) => (c.visit ? createPaintings(undefined, paintingsKey(c.visit.p)) : mine);
  const shown = new Set([...A.cards].sort((x, y) => Number(!!y.visit) - Number(!!x.visit) || (y.last || y.first) - (x.last || x.first)).slice(0, LIGHTS_AT_ONCE).map((c) => c.id));
  for (const c of A.cards) {
    if (state.atlas !== A) return;
    let art = null;
    const pics = picsOf(c);
    try {
      const pic = await pics.get(c.first);
      const parts = pic ? keptPartsOf(pic, c.strokes) : [];
      if (parts.length && shown.has(c.id)) {
        const img = await keptImage(pic), box = reachOf(parts), k = img.naturalWidth / UNITS.W;
        const mask = maskOf(parts, box, k, Math.max(1, Math.round((box[2] - box[0]) * k)), Math.max(1, Math.round((box[3] - box[1]) * k)), { steps: true });
        art = { painting: img, key: picKey(pic), box, k, mask, strokes: parts };
        // made real on its own, if it has been: its picture stands in place of its strokes, once read
        const held = art;
        (c.visit ? keptThing(c.visit.p, { ...c, id: c.visit.id }, parts, c.visit.place) : keptThing(A.p, c, parts)).then((it) => { if (it && state.atlas === A && A.art.get(c.id) === held && !held.sprite) { held.sprite = it; placeLights(A); } }).catch(() => {});
      }
      for (const at of [...(c.came || [])].reverse()) {
        const night = at.night === c.first ? pic : await pics.get(at.night);
        if (night && night.real) { art = { ...(art || {}), ...(await realPortrait(night, at.strokes)) }; break; }
      }
    } catch (err) { console.log(`atlas: ${err.message}`); }
    if (state.atlas !== A) return;
    A.art.set(c.id, art);
    if (A.cards[A.i] === c) showAtlasCard();
  }
  placeLights(A);
  makeThings(A);
}
// Each thing made real on its own (things.js, server/illustrator.mjs `thing`): painted from its
// strokes as it looks, in the look of their world's place, alone on white; cut out by the image
// model, or (as with Gemini, which can't) its white cut away here; kept among their paintings below
// night 0 (e3 as -3), with what it was made from (its sign), so it is made again only when that
// changes, and then from the picture it had. A thing new to their world comes to life on its card
// as the story ends (comeToLife); the rest when their world opens and how it looks is settled
// (makeThings): the ones that come most first, two at a time, as many as the day's pictures allow.
// One turned down, or that can't be cut out, is kept as that, and not asked for again until what it
// is made from changes; its strokes stand there instead. With none to be had for now, none is asked
// for again for a while.
const THINGS_A_VISIT = 12, THINGS_AT_ONCE = 2, THINGS_KEPT = 16, thingAsked = new Set(), thingImages = new Map();
let thingsRest = 0;
const after = (ms) => new Promise((ok) => setTimeout(ok, ms));
const thingKey = (id) => { const n = Number(String(id).replace(/^e/, '')); return Number.isFinite(n) && n > 0 ? -n : null; };
const placeLook = () => (world && world.scene && world.scene.look) || null;
const signOfIt = (look, parts, place = placeLook(), rule = null) => signOfThing({ strokes: parts, look: look || null, place, rule });
// the place look a picture was made in, from its sign
const placeOfSign = (sign) => { try { return JSON.parse(sign)[2] || null; } catch { return undefined; } };
// and how they said it looks, if they had
const ruleOfSign = (sign) => { try { return JSON.parse(sign)[3] || null; } catch { return null; } };
// how each thing looks, as their world keeps it now (the Illustrator may have said since its card was made)
const looksNow = () => new Map((world ? world.toJSON().entities : []).map((e) => [e.id, e.look || null]));
// and how they said each looks, if they have
const rulesNow = () => new Map((world ? world.toJSON().entities : []).map((e) => [e.id, e.rule || null]));
// a few pictures kept in memory, the latest
const keepImage = (at, it) => { thingImages.delete(at); thingImages.set(at, it); while (thingImages.size > THINGS_KEPT) thingImages.delete(thingImages.keys().next().value); };
// a kept picture of a thing, ready to draw (a Blob, or a data URL as the first were kept)
async function loadThing(kept) {
  if (!kept || !kept.image || !kept.region || !kept.box) return null;
  const blob = typeof kept.image !== 'string', url = blob ? URL.createObjectURL(kept.image) : kept.image, img = new Image();
  img.src = url;
  try { await img.decode(); } catch { return null; } finally { if (blob) URL.revokeObjectURL(url); }
  return { canvas: img, region: kept.region, box: kept.box, sign: kept.sign };
}
async function keptThing(p, c, parts, place = placeLook()) {
  const k = thingKey(c.id), sign = signOfIt(c.look, parts, place, c.rule), at = `${worldKey(p)}:${c.id}`;
  if (k == null) return null;
  const seen = thingImages.get(at);
  if (seen && seen.sign === sign) return seen;
  const kept = await createPaintings(undefined, paintingsKey(p)).get(k).catch(() => null);
  if (!kept || kept.sign !== sign) return null;
  const it = await loadThing(kept);
  if (it) keepImage(at, it);
  return it;
}
// a thing just made real, shown at once if their world is open: it springs up there (night.js)
function showMade(p, id, it) {
  const A = state.atlas, art = A && A.p && A.p.id === p.id ? A.art.get(id) : null;
  if (!art || art.sprite || placeOfSign(it.sign) !== placeLook()) return false;
  art.sprite = it;
  placeLights(A);
  return true;
}
// One thing of theirs made real on its own, from its `parts` (strokes with their paths) over `box`,
// as it `look`s and as they said it looks (`rule`), in the look their world's place has now: asked
// for (made again from the picture it had, if it had one), cut out (by the image model, or its
// white cut away here), kept with what it was made from.
// { it: { canvas, region, box, sign }, fresh } (fresh: made just now), or { it: null }
async function bringToLife(p, c, parts, box, look, rule = c.rule || null) {
  const k = thingKey(c.id), at = `${worldKey(p)}:${c.id}`;
  if (!ai || !ai.thing || k == null || !parts.length || !box) return { it: null };
  const place = placeLook(), sign = signOfIt(look, parts, place, rule);
  const seen = thingImages.get(at);
  if (seen && seen.sign === sign) return { it: seen };
  if (thingAsked.has(at) || Date.now() < thingsRest) return { it: null };
  thingAsked.add(at);
  try {
    const pics = createPaintings(undefined, paintingsKey(p));
    // already made from just this (or found not to be): not asked for again
    const kept = await pics.get(k).catch(() => null);
    if (kept && kept.sign === sign) {
      if (kept.failed) return { it: null };
      const it = await loadThing(kept);
      if (it) { keepImage(at, it); return { it }; }
    }
    const R = regionOf(box);
    // made before, in another look or before they said how it looks: made again from that picture,
    // so that it is still the same one
    const reference = kept && kept.image && sameRegion(kept.region, R.region) ? await onWhite(kept, R) : null;
    let r = null;
    try {
      r = await ai.thing({ image: conditionOf(parts, R).toDataURL('image/png'), name: c.name, look, rule, place, young: !!p.young, seed: realSeed(`thing:${p.id}:${c.id}`), width: R.width, height: R.height, ...(reference ? { reference } : {}) });
    } catch (err) {
      // the guide can't be reached, or won't make more today: none asked for a while
      console.log(`a thing, made real: ${err.message}`);
      thingsRest = Date.now() + (/429/.test(err.message) ? 3600e3 : 300e3);
      return { it: null };
    }
    const failed = (why) => pics.put(k, { failed: why, sign, at: Date.now() }).catch(() => {});
    if (!r || !r.image) {
      if (r && r.blocked) { console.log('a thing, made real: turned down'); await failed('blocked'); }
      if (r && r.off && !r.big) thingsRest = Date.now() + 3600e3;
      return { it: null };
    }
    const got = new Image(); got.src = r.image;
    try { await got.decode(); } catch { return { it: null }; }
    const cv = document.createElement('canvas'); cv.width = R.width; cv.height = R.height;
    const g = cv.getContext('2d');
    g.drawImage(got, 0, 0, R.width, R.height);
    // cut out by the image model; or, if it wasn't (or nothing was cut away), its white cut here
    let px = g.getImageData(0, 0, R.width, R.height), left = r.cut ? solidOf(px) : 1;
    const here = left > 0.96;
    if (here) { px = cutAway(px); left = px.kept; }
    // nothing cut away (it was painted with a place round it), or nothing left: their strokes stay
    if (left > 0.96 || left < 0.01) { console.log(`a thing, made real: not cut out (${Math.round(left * 100)}% of it kept)`); await failed('uncut'); return { it: null }; }
    if (here) g.putImageData(px, 0, 0);
    const image = await new Promise((ok) => cv.toBlob(ok, 'image/png'));
    if (image) await pics.put(k, { image, sign, region: R.region, box, at: Date.now() }).catch((err) => console.log(`a thing, not kept: ${err.message}`));
    const it = { canvas: cv, region: R.region, box, sign };
    keepImage(at, it);
    showMade(p, c.id, it);
    return { it, fresh: true };
  } finally { thingAsked.delete(at); }
}
// the region a picture was made over, the same as another (to the paper unit)
const sameRegion = (a, b) => !!a && !!b && a.length === 4 && a.every((v, i) => Math.abs(v - b[i]) < 1);
// a kept picture of a thing on white, to make it again from (no clear pixels)
async function onWhite(kept, R) {
  const it = await loadThing(kept);
  if (!it) return null;
  const cv = document.createElement('canvas'); cv.width = R.width; cv.height = R.height;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, R.width, R.height);
  g.drawImage(it.canvas, 0, 0, R.width, R.height);
  return cv.toDataURL('image/jpeg', 0.9);
}
// the things of a night made real, for stepping inside: each kept picture still in their world's look
async function thingPictures(p, things) {
  const out = {}, looks = looksNow(), rules = rulesNow();
  for (const t of things) {
    const k = thingKey(t.id), at = `${worldKey(p)}:${t.id}`;
    if (k == null || !looks.has(t.id)) continue;
    const it = thingImages.get(at) || await loadThing(await createPaintings(undefined, paintingsKey(p)).get(k).catch(() => null));
    let made = null;
    try { made = JSON.parse(it.sign); } catch {}
    if (!made || (made[1] || null) !== looks.get(t.id) || (made[2] || null) !== placeLook() || (made[3] || null) !== (rules.get(t.id) || null)) continue;
    out[t.id] = it;
  }
  return out;
}
// their world's things made real, once it opens and how it looks is settled: each that has a
// painting and no picture yet, glowing while it is made, and springing up when it comes
async function makeThings(A) {
  if (!ai || !ai.thing || A.look || state.atlas !== A) return;
  // asked again while some are being made (more of their world read since): it looks again once
  // those are, so none read later is left in ink
  if (A.making) { A.again = true; return; }
  const p = A.p;
  // asked how it should look first: what is made in one look before then would be made again
  if (lookDue.has(worldKey(p))) return;
  A.making = true;
  const looks = looksNow(), rules = rulesNow();
  const queue = A.cards.filter((c) => { const art = A.art.get(c.id); return !c.visit && art && art.painting && !art.sprite && thingKey(c.id) != null && !thingAsked.has(`${worldKey(p)}:${c.id}`); })
    .sort((a, b) => b.nights - a.nights || b.last - a.last).slice(0, THINGS_A_VISIT);
  const one = async (c) => {
    const art = A.art.get(c.id);
    if (A.night) A.night.making(c.id, true);
    const r = await bringToLife(p, c, art.strokes, art.box, looks.get(c.id) || c.look || null, rules.get(c.id) || null);
    if (A.night) A.night.making(c.id, false);
    if (!r.it || state.atlas !== A) return;
    // kept already (and not yet shown): it stands there; made just now: it comes to life
    if (!art.sprite && placeOfSign(r.it.sign) === placeLook()) { art.sprite = r.it; placeLights(A); }
    if (!r.fresh) return;
    A.came = (A.came || 0) + 1;
    // the chime as it is biggest, with its sparks (night.js POP)
    after(POP.s * POP.peak * 1000 + 17).then(() => sound.alive());
    toast(`${cap(c.name)} came to life!`, 2.6, { low: true });
  };
  try {
    await Promise.all(Array.from({ length: THINGS_AT_ONCE }, async () => { while (queue.length && Date.now() >= thingsRest && state.atlas === A && !A.look) await one(queue.shift()); }));
  } finally { A.making = false; }
  if (A.again) { A.again = false; makeThings(A); }
}
// how it looks, settled (kept, or another chosen): a picture made in another look than it has now
// goes, and each thing is made real in this one
function lookSettled(A) {
  if (state.atlas !== A) return;
  let gone = false;
  for (const art of A.art.values()) if (art && art.sprite && placeOfSign(art.sprite.sign) !== placeLook()) { art.sprite = null; gone = true; }
  if (gone) placeLights(A);
  makeThings(A);
}
// where the choices are laid over their world (index.html #atlas .side .do): no name under them
const MENU_ZONE = [1470, 740, 1920, 1000];
// their things, where each first came, in the night
function placeLights(A) {
  if (!A.night || state.atlas !== A) return;
  // not under their feet: once they have walked home
  if (A.walk) { A.relight = true; return; }
  A.night.set(A.cards.map((c) => {
    const a = A.art.get(c.id), node = A.map.nodes.find((x) => x.id === c.id);
    return a && a.painting && node ? { id: c.id, name: c.name, node, box: a.box, k: a.k, painting: a.painting, key: a.key, paper: paperSheet(), paperKey: 'paper', mask: a.mask, strokes: a.strokes, sprite: a.sprite || null } : null;
  }).filter(Boolean), { links: A.map.paths, keepOut: MENU_ZONE });
  if (A.cards[A.i]) A.night.choose(A.cards[A.i].id);
  // as their world opens, each thing says hello as it first stands there: a hop, left to right
  A.hello = A.hello || new Set();
  const hello = A.night.state.things.filter((t) => !A.hello.has(t.id)).sort((a, b) => a.foot[0] - b.foot[0]);
  hello.forEach((t, i) => { A.hello.add(t.id); setTimeout(() => { if (state.atlas === A && A.night && !A.walk) A.night.greet(t.id); }, 300 + i * 150); });
  composeSoon(A);
}
// Their world painted as one (compose.js): once home has been still a moment, with its place
// painted and two or more things made real in it, what is on screen is sent to be repainted as one
// picture, kept, and shown over the place instead of the things laid on it
const composeAsked = new Set();
function composeSoon(A) {
  clearTimeout(A.composeTimer);
  A.composeTimer = setTimeout(() => composeNow(A).catch((err) => console.log(`painted as one: ${err.message}`)), COMPOSE_AT.still * 1000 + 600);
}
function composeSignOf(A) {
  const seen = placeImages.get(worldKey(A.p));
  const made = A.night ? A.night.state.things.filter((t) => t.made) : [];
  return { sign: composeSign({ place: A.night && A.night.painted && seen ? seen.sign : null, things: made.map((t) => ({ id: t.id, sign: A.art.get(t.id) && A.art.get(t.id).sprite && A.art.get(t.id).sprite.sign })) }), made: made.length, making: A.night ? A.night.state.things.some((t) => t.making) : false };
}
async function composeNow(A) {
  if (state.atlas !== A || !A.night || A.walk || state.mode !== 'atlas') return;
  const p = A.p, pics = createPaintings(undefined, paintingsKey(p)), w = worldKey(p);
  const { sign, made, making } = composeSignOf(A);
  const kept = await pics.get(COMPOSED).catch(() => null);
  const asked = new Set([...composeAsked].filter((k) => k.startsWith(`${w}|`)).map((k) => k.slice(w.length + 1)));
  const due = composeDue({ sign, painted: A.night.painted, made, making, kept: kept && kept.image ? kept.sign : null, shown: A.composed || null, asked });
  if (due === 'drop') { A.composed = null; A.night.setComposed(null); return composeSoon(A); }
  if (due === 'use') return showComposed(A, kept.image, sign);
  if (due !== 'ask' || !ai || !ai.compose) return;
  const view = A.night.snapshot({ W: 1536, H: 864 });
  if (!view) return;
  composeAsked.add(`${w}|${sign}`);
  let r = null;
  try { r = await ai.compose({ scene: world.scene, image: view.toDataURL('image/jpeg', 0.85), young: !!p.young, seed: realSeed(`one:${p.id}:${sign}`) }); } catch (err) { console.log(`painted as one: ${err.message}`); }
  if (!r || !r.image) { if (r && r.blocked) console.log('painted as one: turned down'); return; }
  const keep = await asJpeg(r.image, 1536, 0.88).catch(() => r.image);
  await pics.put(COMPOSED, { image: keep, sign, at: Date.now() }).catch((err) => console.log(`painted as one, not kept: ${err.message}`));
  // still the same world, as it was when it was asked for
  if (state.atlas === A && composeSignOf(A).sign === sign) return showComposed(A, keep, sign);
}
async function showComposed(A, url, sign) {
  const img = new Image(); img.src = url;
  await img.decode();
  if (state.atlas !== A || !A.night || composeSignOf(A).sign !== sign) return;
  A.night.setComposed(img);
  A.composed = sign;
}
// a thing as its night was made real, for its card
async function realPortrait(pic, ns) {
  const img = new Image();
  img.src = pic.real;
  await img.decode();
  const bs = (pic.strokes || []).filter((x) => ns.includes(x.n) && x.box).map((x) => x.box);
  const box = bs.length ? bs.reduce((u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])]) : [400, 250, 1200, 750];
  return { real: realCrop(img, box, 600, 344) };
}
// what is told of the one chosen, under the night: when it came, its name, what is true of it, how it felt
function showAtlasCard() {
  const A = state.atlas, slot = $('#atlas .card-slot');
  if (!A || !slot || !A.cards.length) return;
  const c = A.cards[A.i], art = A.art.get(c.id);
  // its name, and what they chose to be true of it if they did: when it came, and how it felt, are
  // in their book and on its card when it is kept
  // and where it came from: theirs, or the storyteller's reading of it
  const where = whereOf(A, c), origin = where || cardOrigin(c);
  slot.innerHTML = `<div class="card${c.visit ? ' visiting' : ''}">${art && art.real ? '<span class="art"></span>' : ''}<div><p class="name">${esc(cap(c.name))}</p>${c.lore ? `<p class="lore">${esc(c.lore)}</p>` : ''}${c.rule ? `<p class="said">In your words: ${esc(c.rule)}</p>` : ''}${origin ? `<p class="origin ${where ? 'visit' : c.origin}">${esc(origin)}</p>` : ''}</div></div>`;
  if (art && art.real) { Object.assign(art.real.style, { width: '100%', height: '100%', borderRadius: '12px', display: 'block' }); slot.querySelector('.art').append(art.real); }
  $('#atlas .count').textContent = `${A.i + 1} of ${A.cards.length}`;
  if (A.night) A.night.choose(c.id);
}
// when a thing came: the night it first came, and how often since
const whenOf = (c) => `${c.bornNext ? 'Drawn in what happened next · ' : ''}Chapter ${c.first}${c.nights > 1 ? ` · ${c.nights === 2 ? 'came back once' : `in ${c.nights} chapters`}` : ''}`;
// what is on screen to choose from: the first few things to do, and the rest under More… (a look
// or a question shows all its answers)
const SHOWN = 3;
function shownActions(A) {
  const acts = worldActions(A);
  if (A.look || A.wonder || A.forget || A.said || A.more || acts.length <= SHOWN + 1) return acts;
  return [...acts.slice(0, SHOWN), { id: 'more-ways', text: 'More…' }];
}
function showWorldActions() {
  const A = state.atlas, list = $('#atlas .do');
  if (!A || !list) return;
  const acts = shownActions(A), W = A.look || A.wonder || A.forget || A.said;
  const k = W ? W.k : (A.k = Math.min(A.k, acts.length - 1));
  list.innerHTML = acts.map((a, i) => `<li class="chip${i === k ? ' on' : ''}${a.id === 'wait' ? ' waiting' : ''}">${esc(a.text)}</li>`).join('');
  const ask = $('#atlas .side .ask'), q = A.look ? A.look.question : A.forget ? A.forget.question : A.said ? A.said.question : W && W.w ? `${W.again ? 'Still wondering. ' : ''}${W.w.question}` : '';
  ask.textContent = q;
  ask.hidden = !q;
  // while it asks, the card shows only what it is about, so its answers fit under it
  $('#atlas').classList.toggle('wondering', !!W);
}
function atlasPress(button) {
  const A = state.atlas, n = A.cards.length;
  if (A.walk) return walkPress(A, button);
  if (A.look) return lookPress(A, button);
  if (A.forget) return forgetPress(A, button);
  if (A.said) return saidPress(A, button);
  if (A.wonder) return wonderPress(A, button);
  if (n && (button === 'left' || button === 'right')) {
    A.i = (A.i + (button === 'left' ? n - 1 : 1)) % n;
    showAtlasCard(); showWorldActions();
    // the one gone to says hello: it hops, with a sound of its own, and a child hears what is true of it
    const c = A.cards[A.i], t = A.night && A.night.greet(c.id) ? A.night.state.things.find((x) => x.id === c.id) : null;
    // its sound as it leaves the ground, and a tap as it lands: a frame after each (night.js HOP)
    if (t) { after(HOP.s * HOP.takeoff * 1000 + 17).then(() => sound.greet(t.motion)); after(HOP.s * HOP.land * 1000 + 17).then(() => sound.land()); } else sound.dip(false);
    if (readsAloud()) aloud.say(`${cap(c.name)}.${c.visit ? ` ${whereOf(A, c)}` : ''}${c.lore ? ` ${c.lore}` : ''}`);
  } else if (button === 'up' || button === 'down') {
    const acts = shownActions(A);
    A.k = (A.k + (button === 'up' ? acts.length - 1 : 1)) % acts.length;
    showWorldActions(); sound.dip(false);
    if (readsAloud()) aloud.say(acts[A.k].text);
  } else if (button === 'select' || button === 'playpause') {
    const a = shownActions(A)[A.k], c = A.cards[A.i];
    // the rest of what can be done, shown where More… was
    if (a.id === 'more-ways') { A.more = true; showWorldActions(); sound.dip(false); if (readsAloud()) aloud.say(shownActions(A)[A.k].text); return; }
    if (a.id === 'recap') return hearAgain(A.due);
    if (a.id === 'wonder') return askWorldbuilder(A);
    if (a.id === 'looks') return openLook(A, world.scene, { asked: true });
    if (a.id === 'say-look') return openSaid(A, c);
    if (a.id === 'walk') return startWalk(A);
    if (a.id === 'book') return openJournal(painter, { from: 'atlas' });
    if (a.id === 'forget') return openForget(A, c);
    if (a.id === 'visit') return goVisit(A, c, a.to);
    if (a.id === 'come-home') return comeHome(A, c);
    return paintNew(a.id === 'more' && c ? { about: { id: c.id, name: c.name } } : {});
  } else if (button === 'back') {
    const k = family.painters.findIndex((p) => p.id === A.id);
    closeWorld();
    openWho();
    state.who.i = Math.max(0, k);
    showWho();
    updateHints();
  }
}
// ---------------------------------------------------------------- worlds that meet

// A thing of one painter's world can visit another's on this TV (visits.js): its painter sends it,
// and either of them sends it home. It stands in the world it visits with a card that says where
// it is from, read from its own world each time, and the storyteller there may bring it into the
// story; at home, its card says where it has gone.
const visitsNow = () => (family ? loadVisits(visitsKey(family)) : []);
const keepVisits = (vs) => (family ? saveVisits(vs, visitsKey(family)) : false);
const painterOf = (id) => (family && family.painters.find((p) => p.id === id)) || null;
// a painter's world as it is kept (the one open, as it is now)
const worldOf = (p) => (painter && world && p.id === painter.id ? world : loadWorld(undefined, worldKey(p)));
// the visits whose painters and things are still here; the rest let go
function liveVisits() {
  const vs = visitsNow();
  const has = (from, thing) => { const q = painterOf(from); return !!q && worldOf(q).toJSON().entities.some((e) => e.id === thing && e.status !== 'rejected'); };
  const live = family ? pruneVisits(vs, { painters: family.painters, alive: has }) : [];
  if (live.length !== vs.length) keepVisits(live);
  return live;
}
// the things visiting `p`'s world, as cards, read from their own worlds: each with whose it is,
// and what the storyteller there hears of it (for a child, only what is gentle)
function visitorCards(p, vs = liveVisits()) {
  return visitorsIn(vs, p.id).map((v) => {
    const q = painterOf(v.from), S = q ? worldOf(q).toJSON() : null;
    const c = S && cardsOf(S, { young: !!p.young }).find((x) => x.id === v.thing);
    if (!c) return null;
    const from = sealOf(q.seal).name;
    const brief = visitorBrief(c, { from, facts: (S.facts || []).filter((f) => f.entity === v.thing && f.to == null && !f.thread), young: !!p.young });
    return { ...c, id: `v-${q.id}-${c.id}`, lore: brief.true_of_it ? brief.true_of_it.at(-1) : null, visit: { p: q, id: c.id, from, place: (S.scene && S.scene.look) || null, brief } };
  }).filter(Boolean);
}
// said on a card: where a visitor is from, or where one of theirs has gone
function whereOf(A, c) {
  if (!c) return '';
  if (c.visit) return `Visiting from ${c.visit.from}’s world.`;
  const v = visitOf(A.visits || [], A.p.id, c.id), q = v && painterOf(v.to);
  return q ? `Visiting ${sealOf(q.seal).name}’s world.` : '';
}
// what can be done about a visit, for the one chosen
function visitActions(A, c) {
  if (!c || !family) return [];
  if (c.visit) return [{ id: 'come-home', text: `Send ${c.name} home` }];
  if (visitOf(A.visits || [], A.p.id, c.id)) return [{ id: 'come-home', text: `Bring ${c.name} home` }];
  return family.painters.filter((q) => q.id !== A.p.id && canVisit(c, q, A.visits || [], A.p.id, { names: (A.names && A.names.get(q.id)) || [] }).ok)
    .map((q) => ({ id: 'visit', text: `Send ${c.name} to ${sealOf(q.seal).name}’s world`, to: q.id }));
}
// their world again as it is now, the same thing chosen (or the nearest, if it has gone)
function reopenWorld(A, note, id) {
  closeWorld();
  openWorld({ note });
  const B = state.atlas;
  if (!B || !B.cards.length) return;
  const i = B.cards.findIndex((x) => x.id === id);
  B.i = i >= 0 ? i : Math.min(A.i, B.cards.length - 1);
  showAtlasCard(); showWorldActions();
}
// the names of what is in a painter's world now: theirs, and what is visiting it
const namesIn = (q) => [...worldOf(q).toJSON().entities.filter((e) => e.status !== 'rejected').map((e) => e.name), ...visitorCards(q).map((v) => v.name)];
function goVisit(A, c, to) {
  const q = painterOf(to);
  if (!q || !canVisit(c, q, liveVisits(), A.p.id, { names: namesIn(q) }).ok) return;
  keepVisits(sendVisit(liveVisits(), { thing: c.id, from: A.p.id, to }));
  sound.dip(true);
  const name = sealOf(q.seal).name;
  reopenWorld(A, A.p.young ? `${cap(c.name)} went to visit ${name}’s world!` : `${cap(c.name)} is visiting ${name}’s world. It is still yours: bring it home whenever you like.`, c.id);
}
function comeHome(A, c) {
  const from = c.visit ? c.visit.p.id : A.p.id, thing = c.visit ? c.visit.id : c.id;
  keepVisits(sendHome(liveVisits(), { thing, from }));
  sound.dip(false);
  reopenWorld(A, c.visit ? `${cap(c.name)} went home to ${c.visit.from}’s world.` : `${cap(c.name)} came home.`, c.id);
}

// ---------------------------------------------------------------- how a thing looks, in their words

// How a thing of theirs looks, as they say it on their phone ("the fox has a white tip on its
// tail"): kept on it in their world (world.ruled), over any look the Illustrator gave it, in every
// picture of it from then on, its own and the night's; and its picture made again, from the one it
// had. The choice begins on Keep it as it is; their words are let go of the same way, on ▼.
function openSaid(A, c) {
  const was = c.rule ? `In your words, ${c.rule.charAt(0).toLowerCase()}${c.rule.slice(1)}. ` : '';
  A.said = { id: c.id, name: c.name, k: 0, question: `${was}How does ${c.name} look? Say it on your phone.` };
  showWorldActions(); updateHints(); sound.dip(false);
  if (readsAloud()) aloud.say(A.said.question);
}
function saidActions(A) {
  const c = A.cards.find((x) => x.id === A.said.id);
  return [{ id: 'keep', text: 'Keep it as it is' }, ...(c && c.rule ? [{ id: 'let-go', text: 'Let go of your words' }] : [])];
}
function saidPress(A, button) {
  const S = A.said, acts = saidActions(A);
  if (button === 'up' || button === 'down') {
    S.k = (S.k + 1) % acts.length;
    showWorldActions(); sound.dip(false);
    if (readsAloud()) aloud.say(acts[S.k].text);
  } else if (button === 'select' || button === 'playpause') {
    if (acts[S.k].id === 'let-go') return sayLook(A, '');
    A.said = null; showWorldActions(); updateHints();
  } else if (button === 'back') { A.said = null; showWorldActions(); updateHints(); }
}
// their words kept on it (none: let go), and it made again so
async function sayLook(A, words) {
  const S = A.said, p = A.p, r = S && world.ruled(S.id, words);
  A.said = null;
  if (r) for (const c of A.cards) if (c.id === r.id && !c.visit) c.rule = r.rule;
  showAtlasCard(); showWorldActions(); updateHints();
  if (!r) return;
  // said on its card (In your words: …), so nothing laid over it
  sound.seal();
  await keepTheirs(world, worldKey(p), archive).catch(() => {});
  remakeThing(A, r.id);
}
// a thing of theirs made again as it looks now: what stands there stays until the new one comes
async function remakeThing(A, id) {
  const c = A.cards.find((x) => x.id === id), art = c && A.art.get(id);
  if (!art || !art.painting || !ai || !ai.thing || state.atlas !== A) return;
  if (A.night) A.night.making(id, true);
  const r = await bringToLife(A.p, c, art.strokes, art.box, looksNow().get(id) || c.look || null, c.rule || null);
  if (A.night && state.atlas === A) A.night.making(id, false);
  if (!r.it || state.atlas !== A || A.art.get(id) !== art) return;
  art.sprite = r.it;
  placeLights(A);
  if (!r.fresh) return;
  A.came = (A.came || 0) + 1;
  after(POP.s * POP.peak * 1000 + 17).then(() => sound.alive());
}

// ---------------------------------------------------------------- forgetting a thing

// Forget a thing (forget.js, engine/dreams/forget.mjs): what goes with it is said first, and the
// choice begins on Keep it, so no press meant for something else can take it. Forgotten, it goes
// from their world with everything that grew from it, and nothing else does.
function openForget(A, c) {
  const plan = world.forgetPlan(c.id);
  if (!plan) return;
  const art = A.art.get(c.id), young = !!(painter && painter.young);
  A.forget = { id: c.id, name: c.name, plan, k: 0, question: forgetSays(plan, { picture: !!(art && (art.sprite || art.real)), young }) };
  showWorldActions(); updateHints(); sound.dip(false);
  if (readsAloud()) aloud.say(A.forget.question);
}
function forgetPress(A, button) {
  const F = A.forget;
  if (F.waiting) return;
  if (button === 'up' || button === 'down') {
    F.k = 1 - F.k;
    showWorldActions(); sound.dip(false);
    if (readsAloud()) aloud.say(worldActions(A)[F.k].text);
  } else if (button === 'select' || button === 'playpause') {
    if (F.k === 1) return forgetNow(A);
    A.forget = null; showWorldActions(); updateHints();
  } else if (button === 'back') { A.forget = null; showWorldActions(); updateHints(); }
}
async function forgetNow(A) {
  const F = A.forget, p = A.p;
  F.waiting = true; showWorldActions();
  const r = await forgetHere(world, F.id, { archive, pics: createPaintings(undefined, paintingsKey(p)), erase: eraseMarks, pictureKey: thingKey })
    .catch((err) => { console.log(`forget: ${err.message}`); return null; });
  thingImages.delete(`${worldKey(p)}:${F.id}`);
  if (r) { keepVisits(sendHome(visitsNow(), { thing: F.id, from: p.id })); await saveMine(); }
  if (state.atlas !== A || painter !== p) return;
  A.forget = null;
  if (!r) { toast('That couldn’t be forgotten just now.', 4); showWorldActions(); updateHints(); return; }
  sound.dip(true);
  closeWorld();
  openWorld({ note: painter.young ? 'It’s gone from your world. Everything else is still here.' : 'Forgotten, with everything that grew from it. Everything else is as it was.' });
}
// A kept drawing with some of its marks painted out in the paper's own colour (forget.js `erase`)
async function eraseMarks(src, strokes) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  // the paper: the colour most of the drawing is, its lightest common shade
  const d = g.getImageData(0, 0, c.width, c.height).data, seen = [];
  for (let i = 0; i < d.length; i += 4 * 97) seen.push([d[i], d[i + 1], d[i + 2], d[i] + d[i + 1] + d[i + 2]]);
  seen.sort((a, b) => b[3] - a[3]);
  const top = seen.slice(0, Math.max(1, Math.round(seen.length * 0.4)));
  const paper = [0, 1, 2].map((k) => Math.round(top.reduce((a, x) => a + x[k], 0) / top.length));
  const k = c.width / UNITS.W;
  g.strokeStyle = `rgb(${paper.join(',')})`; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 64 * k;
  g.filter = `blur(${Math.max(1, Math.round(3 * k))}px)`;
  for (const s of strokes) {
    const pts = s.path && s.path.length ? s.path : [s.from, s.to].filter(Boolean);
    if (!pts.length) continue;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)));
    if (pts.length === 1) g.lineTo(pts[0][0] * k + 0.5, pts[0][1] * k);
    g.stroke();
  }
  return c.toDataURL('image/jpeg', 0.86);
}

// ---------------------------------------------------------------- walking through their world

// Their world, walked through (walk.js, night.js): every thing they painted, from every night,
// standing where it first came, in its own light. ◀ ▶ turn, ▲ ▼ walk; OK goes to each thing in turn;
// ▶‖ hears the nights it came in, as they were told; Back walks home to the water's edge. Nothing in
// it is generated: it is their world as it is kept.
function startWalk(A) {
  if (!A.night || !A.night.walkStart({ onHome: () => walkedHome(A) })) { toast('Your world is still lighting up. Try again in a moment.', 2.6); return; }
  A.walk = { at: null, hearing: null, leaving: false };
  $('#atlas').classList.add('walking');
  // the things lit in it, which the walk goes to: the latest to come, as many as the night shows
  const n = A.cards.filter((c) => { const a = A.art.get(c.id); return a && a.painting && A.map.nodes.some((x) => x.id === c.id); }).length;
  showWalkCaption(A, { kicker: $('#atlas h2').textContent, name: 'Walk through it', line: `${n} ${n === 1 ? 'thing' : 'things'}, each where it first came. OK goes to each in turn.` });
  updateHints();
  sound.dip(false);
  if (readsAloud()) aloud.say('Walk through your world. Press OK to go to each thing in it.');
}
function walkHints(W) {
  if (W.leaving) return '';
  return `<span>${KEY('◀')}${KEY('▶')}turn</span><span>${KEY('▲')}${KEY('▼')}walk</span><span>${KEY('OK')}the next thing</span><span>${KEY('▶‖')}${W.hearing ? 'stop' : 'hear the stories it came in'}</span><span>${KEY('Back')}walk home</span>`;
}
// the caption over the walk: what it is, and a line of it
function showWalkCaption(A, { kicker = '', name = '', line = '' } = {}) {
  const el = $('#atlas .walk-caption');
  if (!el) return;
  el.querySelector('.kicker').textContent = kicker;
  el.querySelector('.name').textContent = name;
  el.querySelector('.line').textContent = line;
  el.querySelector('.line').hidden = !line;
  el.hidden = !kicker && !name && !line;
}
// gone to a thing: when it came, its name, and what they chose for it, or else the first thing told
// of it, as they heard it (or else what is true of it)
function walkedTo(A, id) {
  const W = A.walk, i = A.cards.findIndex((c) => c.id === id), c = A.cards[i];
  W.at = id;
  if (!c) return;
  // and back home, it is the one shown
  A.i = i;
  showAtlasCard();
  const told = c.visit ? [] : nightsOf(world.toJSON(), id);
  showWalkCaption(A, { kicker: c.visit ? whereOf(A, c) : whenOf(c), name: cap(c.name), line: (c.loreChosen && c.lore) || (told[0] && told[0].lines[0]) || c.lore || '' });
  sound.dip(false);
  if (readsAloud()) aloud.say(cap(c.name));
}
function walkPress(A, button) {
  const W = A.walk;
  if (W.leaving) return;
  if (button === 'back') {
    stopHearing(A);
    W.leaving = true;
    A.night.walkPress('back');
    showWalkCaption(A);
    updateHints();
    return;
  }
  if (button === 'select') {
    stopHearing(A);
    const r = A.night.walkPress('select');
    if (r) walkedTo(A, r.id);
    return;
  }
  if (button === 'playpause') {
    if (W.hearing) { stopHearing(A); walkedTo(A, W.at); updateHints(); return; }
    if (!W.at) { const r = A.night.walkPress('select'); if (!r) return; walkedTo(A, r.id); }
    hearNights(A);
    return;
  }
  if (['left', 'right', 'up', 'down'].includes(button)) {
    A.night.walkPress(button);
    // walking on, what was said of the last thing goes, unless it is being heard
    if (!W.hearing) showWalkCaption(A);
  }
}
// The nights it came in, as they were told: each line kept of it, in turn, read aloud
function hearNights(A) {
  const W = A.walk;
  const guest = A.cards.find((x) => x.id === W.at && x.visit);
  if (guest) { toast(`Its stories are told in ${guest.visit.from}’s world.`, 2.8); return; }
  const told = nightsOf(world.toJSON(), W.at).flatMap((n) => n.lines.map((text) => ({ ...n, text })));
  if (!told.length) { toast('Nothing has been told of it yet.', 2.4); return; }
  W.hearing = { told, i: -1, next: 0 };
  heardNext(A);
  updateHints();
}
function heardNext(A) {
  const W = A.walk, H = W && W.hearing;
  if (!H) return;
  H.i++;
  if (H.i >= H.told.length) { W.hearing = null; walkedTo(A, W.at); updateHints(); return; }
  const l = H.told[H.i], c = A.cards.find((x) => x.id === W.at);
  showWalkCaption(A, { kicker: `Chapter ${l.night}${l.next ? ' · what happened next' : ''}${l.title ? ` · ${l.title}` : ''}`, name: c ? cap(c.name) : '', line: l.text });
  if (aloud) aloud.say(l.text);
  H.next = performance.now() + Math.max(3.5, l.text.split(/\s+/).length * 0.42 + 1.5) * 1000;
}
function stopHearing(A) {
  const W = A.walk;
  if (!W || !W.hearing) return;
  W.hearing = null;
  if (aloud) aloud.stop();
}
// walked home to the water's edge: their world as it was, the last thing gone to the one shown
function walkedHome(A) {
  if (state.atlas !== A) return;
  A.walk = null;
  $('#atlas').classList.remove('walking');
  showWalkCaption(A);
  if (A.relight) { A.relight = false; placeLights(A); } else if (A.cards[A.i]) A.night.choose(A.cards[A.i].id);
  showWorldActions();
  updateHints();
}
// The Worldbuilder (server/worldbuilder.mjs): asked about their world, it asks one question about
// one thing in it, with answers to choose from. The answer chosen is kept as true of that thing;
// or they paint their own; or let it be. Either way it isn't asked again.
async function askWorldbuilder(A) {
  const who = painter, brief = wonderBrief(world.toJSON());
  A.wonder = { w: null, k: 0 };
  showWorldActions(); updateHints();
  let w = null;
  try { w = await ai.wonder({ brief, young: young() }); } catch (err) { console.log(`the Worldbuilder: ${err.message}`); }
  if (painter !== who || state.atlas !== A || !A.wonder) return;
  // held to their world here too
  const r = w ? checkWonder(w, brief, { young: young() }) : { ok: false };
  if (!r.ok) { A.wonder = null; showWorldActions(); updateHints(); toast('The Worldbuilder couldn’t be reached just now.', 3); return; }
  showWonder(A, r.wonder);
}
// its question on screen, with the thing it is about shown; `again`: still waiting from before
function showWonder(A, wonder, { again = false } = {}) {
  A.wonder = { w: wonder, k: 0, again };
  const i = A.cards.findIndex((c) => c.id === wonder.about);
  if (i >= 0 && i !== A.i) { A.i = i; showAtlasCard(); }
  showWorldActions(); updateHints();
  if (readsAloud()) aloud.say(again ? `Still wondering. ${wonder.question}` : wonder.question);
}

// The night's last word: once a night is kept and they are home, their Worldbuilder asks one
// question about their world, unasked, as the night closes (from its second chapter, so it never
// meets the first night's question of how it should look). Kept until it is answered or let be, so
// a question left as the TV goes off is still waiting in their world next time.
const wonderingKey = (p) => `inkwash.wondering.${worldKey(p)}`;
function wonderingOf(p) {
  try { const w = JSON.parse(localStorage.getItem(wonderingKey(p)) || 'null'); return w && w.question && Array.isArray(w.choices) ? w : null; } catch { return null; }
}
function keepWondering(p, w) {
  try { if (w) localStorage.setItem(wonderingKey(p), JSON.stringify(w)); else localStorage.removeItem(wonderingKey(p)); } catch { /* a TV short of room: asked again another night */ }
}
const WONDER_AFTER = fastPace ? 1200 : 4000;
async function wonderAtEnd(A) {
  if (!ai || !ai.wonder || !A.cards.length || A.nights < 2 || lookDue.has(worldKey(A.p))) return;
  const who = painter, brief = wonderBrief(world.toJSON()), quiet = lastInput;
  // asked now, shown once what the night kept has come in
  const [w] = await Promise.all([ai.wonder({ brief, young: young() }).catch((err) => { console.log(`the Worldbuilder: ${err.message}`); return null; }), after(WONDER_AFTER)]);
  if (!w || painter !== who) return;
  const r = checkWonder(w, brief, { young: young() });
  if (!r.ok) return;
  keepWondering(who, r.wonder);
  // only into a world left as it was: if they are already doing something, it waits for next time
  if (state.atlas !== A || state.mode !== 'atlas' || A.look || A.wonder || A.walk || lastInput !== quiet) return;
  showWonder(A, r.wonder);
}
// a question still waiting, as their world opens
function wonderStill(A) {
  const w = wonderingOf(A.p);
  if (!w || A.look || A.wonder || lookDue.has(worldKey(A.p))) return;
  if ((world.toJSON().wonders || []).some((x) => x.question === w.question) || !A.cards.some((c) => c.id === w.about)) { keepWondering(A.p, null); return; }
  showWonder(A, w, { again: true });
}
function wonderPress(A, button) {
  const W = A.wonder;
  if (!W.w) { if (button === 'back') { A.wonder = null; showWorldActions(); updateHints(); } return; }
  const acts = worldActions(A);
  if (button === 'up' || button === 'down' || button === 'left' || button === 'right') {
    W.k = (W.k + (button === 'up' || button === 'left' ? acts.length - 1 : 1)) % acts.length;
    showWorldActions(); sound.dip(false);
    if (readsAloud()) aloud.say(acts[W.k].text);
    return;
  }
  if (button !== 'select' && button !== 'playpause' && button !== 'back') return;
  const a = button === 'back' ? { id: 'let' } : acts[W.k], q = W.w;
  A.wonder = null;
  keepWondering(painter, null);
  if (a.id === 'chose') {
    world.wondered({ about: q.about, question: q.question, chose: a.c.fact });
    saveMine();
    sound.seal();
    A.note = `Kept in your world: ${a.c.fact}`;
    A.k = 0;
    showAtlas();
    updateHints();
    if (readsAloud()) aloud.say(A.note);
    return;
  }
  world.wondered({ about: q.about, question: q.question });
  saveMine();
  if (a.id === 'answer') return paintNew({ about: { id: q.about, name: q.name, question: q.question } });
  showWorldActions(); updateHints();
}
// To the paper, clean, to paint something new into their world, or more of one thing in it
function paintNew({ about = null } = {}) {
  closeWorld();
  state.offer = null;
  $('#feel').hidden = true;
  const kept = $('#kept');
  kept.hidden = true;
  kept.removeAttribute('src');
  cleanSheet();
  state.about = about;
  state.mode = 'paint';
  updateDishes();
  updateHints();
  guide.event('paint', !about ? null : about.question ? `${about.question} Draw your answer. Press OK to start.` : `Draw more of ${about.name}: where it goes, who it meets, what happens to it. Press OK to start.`);
  showPairing();
}
// The night is over, or put away: back to their world, grown
function backToWorld({ note = null } = {}) {
  if (!painter) return;
  cleanSheet();
  openWorld({ note, grew: true });
}
// Last time's story, chosen from their world: its painting over the clean paper, told again
async function hearAgain(due) {
  const who = painter, pic = await paintings.get(due.night).catch(() => null);
  if (painter !== who || state.mode !== 'atlas') return;
  if (!pic) { toast('That drawing couldn’t be found on this TV.', 3); return; }
  closeWorld();
  cleanSheet();
  startRecap({ ...due, pic });
}

// ---------------------------------------------------------------- the TV at rest

// Left on the seals a while, the TV becomes a frame for the family's paintings: each in turn,
// slowly, with its title and whose world it is, and one part of it alive. Any button wakes it.
const IDLE = (Number(new URLSearchParams(location.search).get('idle')) || 50) * 1000;
// their world, left alone this long: its words fade, so that it is only their world (?quiet=0: never)
let QUIET = (() => { const q = new URLSearchParams(location.search).get('quiet'); return q == null ? 30000 : Number(q) > 0 ? Number(q) * 1000 : Infinity; })();
function quiet(on) { document.body.classList.toggle('quiet', !!on); }
// The opening (intro.js): the demo child's first chapter drawn as light, told back, and woken up
// as their world, chapter by chapter; then `then` (the seals, or the demo family). Their world is
// as it was made real, where it was, or at night (nightUrl), as the TV at rest shows it.
let opening = null;
function startIntro(then) {
  try { localStorage.setItem('inkwash.opened', '1'); } catch { /* a TV that can't keep it sees it again */ }
  const child = DEMO.painters.find((p) => p.young) || DEMO.painters[0];
  const W = DEMO.worlds[child.id], pics = DEMO.paintings[child.id] || {};
  const nights = W.nights.map((n) => ({ title: n.title || 'Untitled', lines: n.lines || [], strokes: (pics[n.n] && pics[n.n].strokes) || [] }));
  state.mode = 'intro';
  updateScene();
  updateHints();
  opening = createIntro($('#intro'), {
    nights,
    world: async (i) => { const pic = pics[W.nights[i].n]; return pic ? pic.real || nightUrl(pic, null) : null; },
    speak: (text) => { if (aloud) aloud.say(text); },
    done: () => { opening = null; next(); },
  });
  function next() { Promise.resolve(then()).catch((err) => console.log(`after the opening: ${err.message}`)); }
}
let lastInput = performance.now();
const HUSH = 4000;
function startGallery() {
  lastInput = performance.now();
  const items = [];
  const older = [];
  for (const p of family.painters) {
    const pics = createPaintings(undefined, paintingsKey(p)), W = loadWorld(undefined, worldKey(p)), held = W.toJSON().nights, scene = W.scene;
    for (const n of held) items.push({ p, n: n.n, title: n.title || 'Untitled', at: n.at || 0, pics, scene });
    if (held.length && held[0].n > 1) older.push({ p, pics, scene, held: new Set(held.map((n) => n.n)) });
  }
  if (!items.length) return;
  items.sort((a, b) => b.at - a.at || a.p.id.localeCompare(b.p.id));
  const hosts = [...document.querySelectorAll('#gallery .alive')];
  const G = state.gallery = { items, i: -1, frame: 0, next: 0, shown: 0, lives: hosts.map((h) => createLife(h, { px: 1440 / 1600 })) };
  // the nights a world has let go, from where every night is kept: after the rest
  for (const o of older) {
    createNights(undefined, paintingsKey(o.p)).all().then((all) => {
      if (state.gallery !== G) return;
      G.items.push(...all.filter((n) => !o.held.has(n.n)).reverse().map((n) => ({ p: o.p, n: n.n, title: n.title || 'Untitled', at: n.at || 0, pics: o.pics, scene: o.scene })));
    });
  }
  state.mode = 'gallery';
  $('#who').hidden = true;
  $('#gallery').hidden = false;
  updateHints();
  galleryNext(state.gallery);
}
async function galleryNext(G) {
  G.next = 0;
  G.i = (G.i + 1) % G.items.length;
  const it = G.items[G.i];
  const pic = await it.pics.get(it.n).catch(() => null);
  if (state.gallery !== G) return;
  if (!pic) { G.next = performance.now() + 50; return; }
  const frames = [...document.querySelectorAll('#gallery .frame')], f = frames[G.frame], other = frames[1 - G.frame];
  const img = f.querySelector('img');
  // as it was made real; or in their world's place (at night, until it has one)
  const place = pic.real ? null : await placeFor(it.p, it.scene).catch(() => null);
  const night = pic.real ? null : await nightUrl(pic, place);
  if (state.gallery !== G) return;
  img.src = pic.real || night || pic.image;
  G.look = pic.real ? 'real' : night ? (place ? 'place' : 'night') : 'ink';
  await img.decode().catch(() => {});
  if (state.gallery !== G) return;
  const now = performance.now() / 1000;
  G.lives[G.frame].clear();
  G.lives[1 - G.frame].rest(now);
  // the next painting fades in on top; the last stays solid beneath it, then goes at once
  other.classList.remove('top'); other.classList.add('under');
  f.classList.remove('on', 'under', 'gone'); f.classList.add('top');
  void f.offsetWidth;
  f.classList.add('on');
  setTimeout(() => { if (state.gallery === G && !other.classList.contains('top')) { other.classList.add('gone'); other.classList.remove('on', 'under'); } }, 2400);
  const cap_ = $('#gallery .caption');
  cap_.classList.remove('on');
  setTimeout(() => {
    if (state.gallery !== G) return;
    cap_.querySelector('.stamp').innerHTML = sealSvg(it.p.seal, 30);
    cap_.querySelector('.world').textContent = `${sealOf(it.p.seal).name}’s world · Chapter ${it.n}`;
    cap_.querySelector('.title').textContent = it.title;
    cap_.classList.add('on');
  }, 900);
  // one part of it alive: its longest stroke, once the painting has faded in (a picture, made real
  // or at night, drifts as it is)
  const life = G.lives[G.frame], main = G.look === 'ink' ? longest([...(pic.strokes || [])])[0] : null;
  if (main) setTimeout(() => {
    if (state.gallery !== G) return;
    keptLayers(pic).then((layers) => {
      if (state.gallery !== G) return;
      const parts = keptPartsOf(pic, [main.n]);
      if (parts.length) life.show(cutOut(layers, parts), motionOf(parts), performance.now() / 1000);
    }).catch(() => {});
  }, 1800);
  G.frame = 1 - G.frame;
  G.shown++;
  G.next = performance.now() + 9000;
}
// a kept night's painting in its world's place (`place`, placeFor), or at night, made once (on the
// GPU) and kept a while: the TV at rest shows a few in turn
const nightCache = new Map();
function nightUrl(pic, place = null) {
  const lit = inWorld(), key = picKey(pic), at = `${key}:${place ? `${signOf(place.scene)}:${place.backdrop ? 1 : 0}` : 'night'}${lit ? ':lit' : ''}`;
  if (!nightCache.has(at)) {
    nightCache.set(at, keptImage(pic).then((img) => asUrl(nightPainting({ painting: img, key, paper: paperSheet(), paperKey: 'paper', strokes: pic.strokes || [], seed: pic.image.length % 997, scene: place && place.scene, backdrop: place && place.backdrop, lit }), 0.88)).catch((err) => { console.log(`woken: ${err.message}`); return null; }));
    while (nightCache.size > 8) {
      const [k, made] = nightCache.entries().next().value;
      nightCache.delete(k);
      made.then((url) => url && setTimeout(() => { if ($('#real').getAttribute('src') !== url) URL.revokeObjectURL(url); }, 20000));
    }
  }
  return nightCache.get(at);
}
function stopGallery() {
  const G = state.gallery;
  if (G) G.lives.forEach((l) => l.clear());
  state.gallery = null;
  document.querySelectorAll('#gallery .frame').forEach((f) => f.classList.remove('on', 'top', 'under', 'gone'));
  $('#gallery .caption').classList.remove('on');
  $('#gallery').hidden = true;
  state.mode = 'who';
  $('#who').hidden = false;
  showWho();
  updateHints();
}

// ---------------------------------------------------------------- it comes alive

// A picture made real can come alive (server/reel.mjs): six seconds of it set moving by Amazon Nova
// Reel (retired by AWS on 30 September 2026, so offered only by a server that still has it, which
// says so with the picture), asked for only when they choose to watch it, once a night. It takes a
// minute or more, and they may do anything else meanwhile: the choice says it is coming. Once made
// it is kept with the night's painting, and plays over the picture if it is still showing; and
// again on a later night, over the picture, when last time's story is heard to the end. Its last
// frame stays.
const ALIVE = { say: { ask: 'Watch it come alive', making: 'Coming to life…', done: 'Watch it again' }, every: 5000, most: 6 * 60 * 1000 };
// each night's, while this page is open: { status: 'making' | 'done' | 'failed', clip }
const alives = new Map();
const aliveAt = (p, night) => `${worldKey(p)}:${night}`;
function aliveChoice(o) {
  if (!o || o.after || o.night == null || !painter) return [];
  const a = alives.get(aliveAt(painter, o.night)), R = state.real;
  if (a) return a.status === 'failed' ? [] : [ALIVE.say[a.status]];
  return ai && ai.alive && R && R.made && R.made.alive && R.made.image && canPlay(R.made.alive) ? [ALIVE.say.ask] : [];
}
// whether this TV can play a clip of the kind the server makes (an MP4 from Nova Reel): if its
// WebView can't, the choice is never offered, and no clip is paid for that would never play
function canPlay(type) {
  const kind = typeof type === 'string' && /^video\/[a-z0-9.+-]+/i.test(type) ? type : 'video/mp4';
  try { return !!$('#alive').canPlayType(kind); } catch { return false; }
}
// the picture as Reel takes it: 1280 x 720, from the middle of the picture made real
async function asReel(url) {
  const im = new Image();
  im.src = url;
  await im.decode();
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 720;
  const k = Math.max(1280 / im.naturalWidth, 720 / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
  c.getContext('2d').drawImage(im, (1280 - w) / 2, (720 - h) / 2, w, h);
  return c.toDataURL('image/jpeg', 0.9);
}
function aliveChosen(o) {
  const at = aliveAt(painter, o.night), a = alives.get(at);
  if (a && a.status === 'done') return playAlive(a.clip);
  if (a) { toast(young() ? 'It’s still coming to life!' : 'Still coming to life: a minute or so.', 2.6); return; }
  const R = state.real, who = painter, pics = paintings, night = o.night;
  const A = { status: 'making', clip: null };
  alives.set(at, A);
  showOffer(); sound.dip(true);
  if (readsAloud()) aloud.say(young() ? 'It’s coming to life! You can do something else while it does.' : 'It’s coming to life. That takes a minute or so; you can go on meanwhile.');
  const failed = (why) => { console.log(`it comes alive: ${why}`); A.status = 'failed'; if (state.offer) showOffer(); };
  (async () => {
    const r = await ai.alive({ image: await asReel(R.made.image), scene: R.made.scene || '', young: !!who.young, seed: realSeed(`alive:${who.id}:${night}`) });
    if (!r || !r.job) return failed(r && r.blocked ? 'turned down' : r && r.today ? 'none left today' : 'not here');
    const until = Date.now() + ALIVE.most;
    let video = null;
    while (!video && Date.now() < until) {
      await after(ALIVE.every);
      const c = await ai.aliveCheck(r.job).catch(() => ({ waiting: true }));
      if (c && c.video) video = c.video;
      else if (!c || !c.waiting) return failed(c && c.blocked ? 'turned down as it was made' : 'it could not be made');
    }
    if (!video) return failed('it took too long');
    const clip = await (await fetch(video)).blob();
    // kept with the night's painting, whoever is painting now
    const p = await pics.get(night).catch(() => null);
    if (p) await pics.put(night, { ...p, alive: clip }).catch((err) => console.log(`it comes alive, not kept: ${err.message}`));
    Object.assign(A, { status: 'done', clip });
    // still looking at the picture: it moves
    if (state.offer && state.offer.night === night && painter === who) { showOffer(); playAlive(clip); }
  })().catch((err) => failed(err.message));
}
let aliveUrl = null;
function playAlive(clip) {
  const v = $('#alive');
  if (aliveUrl) URL.revokeObjectURL(aliveUrl);
  aliveUrl = URL.createObjectURL(clip);
  v.src = aliveUrl;
  v.classList.remove('shown');
  v.onplaying = () => { v.classList.add('shown'); sound.alive(); };
  v.play().catch((err) => console.log(`it comes alive, not played: ${err.message}`));
  state.aliveShown = (state.aliveShown || 0) + 1;
}
// the picture still again, as it goes
function stillAgain() {
  const v = $('#alive');
  if (!v.getAttribute('src')) return;
  v.classList.remove('shown');
  v.pause();
  setTimeout(() => { if (!v.classList.contains('shown')) { v.removeAttribute('src'); v.load(); if (aliveUrl) { URL.revokeObjectURL(aliveUrl); aliveUrl = null; } } }, 1300);
}

// ---------------------------------------------------------------- all around it, and painted again

// What Dream Canvas did with a picture made real, here on the TV and with the image model
// (wide.js): see all around it, the picture widened to either side into a panorama
// (server/wide.mjs) that the remote looks across; and paint it again in another look (a painting, a
// picture book, an animated film), each version kept to go back to, the one shown kept with the
// night. Each is asked for only when chosen, a picture counted with the day's; meanwhile the choice
// says it is coming.
const WIDE = { say: { ask: 'See all around it', making: 'Looking all around…' } };
const AGAIN = { say: { ask: 'Paint it again', making: 'Painting it again…' } };
// the choices for the picture made real tonight, as it stands: shown, or still coming
function pictureChoices(o) {
  const R = state.real, T = R && R.made;
  if (!o || o.after || o.night == null || !painter || !T || !T.image || !R.takes) return [];
  return [
    ...(ai && ai.wide ? [T.wide && T.wide.status === 'making' ? WIDE.say.making : WIDE.say.ask] : []),
    ...(ai && ai.real && R.ask ? [R.again ? AGAIN.say.making : AGAIN.say.ask] : []),
    ...(R.takes.length > 1 ? [versionLabel(R.k, R.takes.length)] : []),
  ];
}
// after last time's story, a panorama kept with that night is there to look across again, for free
const keptWideChoice = (o) => (o && o.after && o.after.pic && o.after.pic.wide ? [WIDE.say.ask] : []);
// The panorama's sheet, made here: the picture in the middle, its own edges mirrored out to either
// side for the image model to start from; and the mask, black where the picture is kept, white
// where it is painted (a PNG, so only pure black and white)
async function wideSheet(url) {
  const im = new Image();
  im.src = url;
  await im.decode();
  const { W, H, picture: P } = PANORAMA;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(im, P.x, 0, P.w, P.h);
  g.save(); g.scale(-1, 1);
  g.drawImage(c, P.x, 0, P.x, H, -P.x, 0, P.x, H); // the left edge, mirrored to the left
  g.drawImage(c, P.x + P.w - (W - P.x - P.w), 0, W - P.x - P.w, H, -W, 0, W - P.x - P.w, H); // the right, to the right
  g.restore();
  const m = document.createElement('canvas');
  m.width = W; m.height = H;
  const mg = m.getContext('2d');
  mg.fillStyle = '#fff'; mg.fillRect(0, 0, W, H);
  mg.fillStyle = '#000'; mg.fillRect(P.x, 0, P.w, P.h);
  return { image: c.toDataURL('image/jpeg', 0.9), mask: m.toDataURL('image/png') };
}
function wideChosen(o) {
  const R = state.real, T = R && R.made;
  if (!T || !T.image) return;
  if (T.wide && T.wide.image) return openWide(T.wide.image, o);
  if (T.wide) { toast(young() ? 'Still looking all around!' : 'Still looking all around: a moment more.', 2.4); return; }
  const who = painter, pics = paintings, night = o.night;
  T.wide = { status: 'making', image: null };
  showOffer(); sound.dip(true);
  if (readsAloud()) aloud.say(young() ? 'Let’s see what’s all around it!' : 'Looking all around it.');
  const failed = (why) => {
    console.log(`all around it: ${why}`);
    T.wide = null;
    if (state.offer) showOffer();
    toast(young() ? 'It couldn’t look around just now.' : 'It couldn’t be widened just now.', 3);
  };
  (async () => {
    const r = await ai.wide({ ...(await wideSheet(T.image)), scene: T.scene || '', look: T.look || (who.young ? 'film' : 'real'), young: !!who.young, seed: realSeed(`wide:${who.id}:${night}:${R.takes.indexOf(T)}`) });
    if (!r || !r.image) return failed(r && r.blocked ? 'turned down' : r && r.today ? 'none left today' : 'not here');
    T.wide = { status: 'done', image: r.image };
    if (R.made === T) keepVersion(R, night, pics);
    // still on the picture: it opens
    if (state.offer === o && state.mode === 'offer' && state.real === R && R.made === T && painter === who) { showOffer(); openWide(r.image, o); }
    else if (state.offer === o) showOffer();
  })().catch((err) => failed(err.message));
}
function openWide(image, o) {
  if (!image) return;
  const el = $('#wide'), img = el.querySelector('img');
  state.wide = { from: o, x: 0.5, v: 1, image };
  img.onload = () => { if (state.wide && state.wide.image === image) panWide(0, 0); };
  img.src = image;
  for (const id of ['#feel', '#say', '#toast']) $(id).hidden = true;
  stillAgain();
  el.hidden = false;
  state.mode = 'wide';
  panWide(0, 0);
  updateHints();
  if (readsAloud()) aloud.say(young() ? 'Look all around! Press left and right.' : 'Left and right to look around.');
}
// a frame of looking across it: held, an arrow looks that way; let go, it drifts on slowly
function panWide(dt, dir) {
  const W = state.wide;
  if (!W) return;
  Object.assign(W, panStep(W, { dt, dir }));
  const img = $('#wide img'), h = window.innerHeight || 1080, w = img.naturalWidth && img.naturalHeight ? (img.naturalWidth / img.naturalHeight) * h : (PANORAMA.W / PANORAMA.H) * h;
  img.style.transform = `translate3d(${Math.round(panOffset(W.x, { W: w, H: h, screenW: window.innerWidth || 1920, screenH: h }))}px, 0, 0)`;
}
function widePress(button) {
  if (button === 'back' || button === 'select' || button === 'playpause') closeWide();
}
function closeWide() {
  const o = state.wide && state.wide.from;
  state.wide = null;
  $('#wide').hidden = true;
  if (o && state.offer === o) { state.mode = 'offer'; $('#feel').hidden = false; showOffer(); }
  else state.mode = 'paint';
  updateHints();
}
// Painted again, in the next look not yet tried: a new version, shown as it comes and kept with the
// night; the Illustrator writes it again from the same story and ink
function againChosen(o) {
  const R = state.real;
  if (!R || !R.ask || !R.takes) return;
  if (R.again) { toast(young() ? 'Still painting it!' : 'Still painting it: a moment more.', 2.4); return; }
  const who = painter, night = o.night, pics = paintings;
  const look = nextLook(R.made.look || R.ask.look, !!who.young, R.takes.map((t) => t.look));
  R.again = true;
  showOffer(); sound.dip(true);
  if (readsAloud()) aloud.say(`Painting it again, ${LOOK_NAMES[look] || ''}.`);
  ai.real({ ...R.ask, look, seed: realSeed(`again:${who.id}:${night}:${R.takes.length}`) }).then(toPaper).then((r) => {
    R.again = false;
    if (!r || !r.image) {
      if (state.offer === o) showOffer();
      toast(r && r.blocked ? 'That one couldn’t be painted. The picture stays as it was.' : 'It couldn’t be painted again just now.', 3);
      return;
    }
    const T = { ...r, look };
    R.takes.push(T);
    showVersion(R, R.takes.length - 1, o, { night, pics });
  }).catch((err) => { R.again = false; console.log(`painted again: ${err.message}`); if (state.offer === o) showOffer(); });
}
// the next version, round again to the first
function nextVersion(o) {
  const R = state.real;
  if (!R || !R.takes || R.takes.length < 2) return;
  showVersion(R, (R.k + 1) % R.takes.length, o, { night: o.night, pics: paintings });
}
function showVersion(R, k, o, { night, pics }) {
  R.k = k;
  R.made = R.takes[k];
  if (state.real === R) showReal(R.made);
  keepVersion(R, night, pics);
  if (state.offer === o) {
    // the choice that goes on to the next version stays chosen
    const i = offerChoices().findIndex(isVersionLabel);
    if (i >= 0) o.i = i;
    showOffer();
  }
}
// the version shown is the one kept with the night, and its panorama if it has one; after what the
// storyteller kept of the picture is in
async function keepVersion(R, night, pics) {
  const T = R.made;
  try {
    await Promise.resolve(state.realKept).catch(() => null);
    if (R.made !== T || night == null) return;
    const p = await pics.get(night);
    if (!p) return;
    await pics.put(night, { ...p, real: await asJpeg(T.image), wide: T.wide && T.wide.image ? await asJpeg(T.wide.image, 2048) : null });
  } catch (err) { console.log(`a version, kept: ${err.message}`); }
}

// ---------------------------------------------------------------- what happens next

// Once a dream is told, the TV asks what happens next. The strokes painted then are theirs to
// choose: more of the dream, or a different ending (the code calls them the night's `ending`). ▶‖
// brings them back, alone, to mark how they feel, and the storyteller tells the dream again with
// them. The night keeps both. Back, before any of it is painted, leaves the dream as it was.
// the night's feeling, as they marked it when it was told, then what came next
function endingFeeling(E, marked) {
  const n = summarize(brush).length - E.from;
  if (!E.feeling && !marked) return null;
  const old = E.feeling || { byStroke: Array(E.from).fill(0), arousal: Array(E.from).fill(0) };
  const now = marked || { byStroke: Array(n).fill(0), arousal: Array(n).fill(0) };
  return { byStroke: [...old.byStroke.slice(0, E.from), ...now.byStroke.slice(0, n)], arousal: [...(old.arousal || []).slice(0, E.from), ...(now.arousal || []).slice(0, n)] };
}

const OFFER = ['Draw what happens next', 'Step inside', 'That’s the end'];
// a panel goes high when what the storyteller said is showing low, and low when it is high
const awayFromSay = () => !$('#say').hidden && !$('#say').classList.contains('high');
function offerEnding(o) {
  state.mode = 'offer';
  state.offer = { ...o, i: 0, more: false };
  const el = $('#feel');
  el.querySelector('.ask').textContent = 'What happens next?';
  el.querySelector('.marks').textContent = painter && painter.young ? 'You can make it go any way you like.' : 'Draw more of it, or a different ending, and hear it told your way.';
  el.querySelector('.beside').hidden = true;
  // apart from what the storyteller said, which stays to be read
  el.classList.remove('over-line');
  el.classList.toggle('high', awayFromSay());
  // a moment after the painting has woken up, so it is seen whole first
  el.classList.add('arriving', 'offering');
  showOffer();
  el.hidden = false;
  updateHints();
  if (readsAloud()) aloud.say('What happens next?');
}
// tonight's row, the picture's own choices folded under More… when there are too many for one line
const offerRow = () => foldChoices([...OFFER.slice(0, 2), ...aliveChoice(state.offer), ...walkChoice(state.offer), OFFER[2]], pictureChoices(state.offer), { open: !!(state.offer && state.offer.more) });
const offerChoices = () => (state.offer && state.offer.after
  ? [AFTER[0], ...walkChoice(state.offer), ...keptWideChoice(state.offer), AFTER[1]]
  : offerRow().choices);
function showOffer() {
  walkAhead(state.offer);
  $('#feel .chips').innerHTML = offerChoices().map((c, i) => `<span class="chip${i === state.offer.i ? ' on' : ''}">${c}</span>`).join('');
}
function offerPress(button) {
  const o = state.offer;
  // More…: the picture's own choices in the row's place; Back, the row again, on More…
  if (!o.after && (button === 'select' || button === 'playpause') && !o.more && offerChoices()[o.i] === MORE) {
    o.more = true; o.i = 0;
    showOffer(); updateHints(); sound.dip(false);
    if (readsAloud()) aloud.say(offerChoices()[0]);
    return;
  }
  if (o.more && button === 'back') {
    o.more = false; o.i = Math.max(0, offerChoices().indexOf(MORE));
    showOffer(); updateHints(); sound.dip(false);
    return;
  }
  // (none of the picture's own left to fold: the row as it was)
  if (o.more && !offerRow().folded) { o.more = false; o.i = Math.min(o.i, offerChoices().length - 1); }
  const n = offerChoices().length;
  if (button === 'left' || button === 'up' || button === 'right' || button === 'down') {
    o.i = (o.i + (button === 'left' || button === 'up' ? n - 1 : 1)) % n;
    showOffer(); sound.dip(false);
    if (readsAloud()) aloud.say(offerChoices()[o.i]);
    return;
  }
  if ((button === 'select' || button === 'playpause') && o.i === 0 && !o.more) return o.after ? stepInside(o) : startEnding();
  if ((button === 'select' || button === 'playpause') && !o.after && offerChoices()[o.i] === OFFER[1]) return stepInside(o);
  if ((button === 'select' || button === 'playpause') && !o.after && Object.values(ALIVE.say).includes(offerChoices()[o.i])) return aliveChosen(o);
  if ((button === 'select' || button === 'playpause') && Object.values(WALK.say).includes(offerChoices()[o.i])) return walkChosen(o);
  if ((button === 'select' || button === 'playpause') && Object.values(WIDE.say).includes(offerChoices()[o.i])) return o.after ? openWide(o.after.pic.wide, o) : wideChosen(o);
  if ((button === 'select' || button === 'playpause') && !o.after && Object.values(AGAIN.say).includes(offerChoices()[o.i])) return againChosen(o);
  if ((button === 'select' || button === 'playpause') && !o.after && isVersionLabel(offerChoices()[o.i])) return nextVersion(o);
  // after last time's story: tonight's paper, clean; or Back, their world
  if (o.after && (button === 'select' || button === 'playpause')) return paintNew();
  if (o.after && button === 'back') return backToWorld();
  // the end: back to their world, which has grown
  if (button === 'select' || button === 'playpause' || button === 'back') {
    $('#feel .beside').hidden = true;
    backToWorld({ note: o.goodnight || null });
  }
}
// ---------------------------------------------------------------- walk inside

// Walk inside (server/marble.mjs, realwalk.js): the picture a night was made real as, built into a
// world by World Labs, to walk through with the remote. Like a clip, it is asked for when they
// choose it and built meanwhile, a minute or so: the choice says so, and they can go on. Once it is
// built its file is kept with the night, so walking it again, after last time's story too, costs
// nothing; and it opens. Where the story server says so (GUIDE_WORLDS_AHEAD, off unless it is
// turned on: a world not walked into is paid for all the same), it starts building as soon as
// Walk inside is offered, so it is nearer ready when chosen.
const WALK = { say: { ask: 'Walk inside', making: 'Building your world…', done: 'Walk inside' }, every: 5000, most: 8 * 60 * 1000 };
const walks = new Map();
const nightOfOffer = (o) => (o.after ? o.after.night : o.night);
function walkChoice(o) {
  if (!o || nightOfOffer(o) == null || !painter) return [];
  const w = walks.get(aliveAt(painter, nightOfOffer(o)));
  if (w) return w.status === 'failed' ? [] : [WALK.say[w.status]];
  // after last time's story: the world that night was built into, if it was
  if (o.after) return o.after.pic && o.after.pic.world && o.after.pic.world.file ? [WALK.say.done] : [];
  const R = state.real;
  return ai && ai.world && R && R.made && R.made.walk && R.made.image ? [WALK.say.ask] : [];
}
const bytesOf = (b64) => { const s = atob(b64), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
function walkChosen(o) {
  const night = nightOfOffer(o), at = aliveAt(painter, night);
  const kept = o.after && o.after.pic && o.after.pic.world;
  if (kept && kept.file && !walks.has(at)) walks.set(at, { status: 'done', ...kept });
  const w = walks.get(at);
  if (w && w.status === 'done') return openRealWalk(o, w);
  if (w) { w.chosen = true; toast(young() ? 'Your world is still being built!' : 'Still building your world: a minute or so.', 2.6); return; }
  buildWorld(o);
}
function walkAhead(o) {
  const R = state.real;
  if (!o || o.after || !R || !R.made || !R.made.ahead || !walkChoice(o).includes(WALK.say.ask)) return;
  buildWorld(o, { ahead: true });
}
function buildWorld(o, { ahead = false } = {}) {
  const night = nightOfOffer(o), at = aliveAt(painter, night);
  const R = state.real, who = painter, pics = paintings;
  const W = { status: 'making', chosen: !ahead };
  walks.set(at, W);
  showOffer();
  if (!ahead) {
    sound.dip(true);
    if (readsAloud()) aloud.say(young() ? 'Your world is being built! You can do something else while it is.' : 'Your world is being built. That takes a minute or so; you can go on meanwhile.');
  }
  const failed = (why) => {
    console.log(`walk inside: ${why}`);
    W.status = 'failed';
    if (state.offer) { state.offer.i = Math.min(state.offer.i, offerChoices().length - 1); showOffer(); }
    if (W.chosen) toast(young() ? 'Your world couldn’t be built this time.' : 'Your world couldn’t be built just now.', 3);
  };
  (async () => {
    const r = await ai.world({ image: await asJpeg(R.made.image, 1280, 0.9), scene: R.made.scene || '', name: (o.told && o.told.title) || '', young: !!who.young });
    if (!r || !r.job) return failed(r && r.blocked ? 'turned down' : r && r.today ? 'none left today' : 'not here');
    const until = Date.now() + WALK.most;
    let built = null;
    while (!built && Date.now() < until) {
      await after(WALK.every);
      const c = await ai.worldCheck(r.job).catch(() => ({ waiting: true }));
      if (c && c.world) built = c.world;
      else if (!c || !c.waiting) return failed(c && c.blocked ? 'turned down as it was built' : 'it could not be built');
    }
    if (!built) return failed('it took too long');
    const f = await ai.worldFile({ id: built.id, splat: built.splat });
    if (!f || !f.file) return failed(f && f.big ? 'its file is too big for this TV' : 'its file could not be had');
    const world = { id: built.id, type: f.type === 'ply' ? 'ply' : 'spz', scale: built.scale ?? null, file: new Blob([bytesOf(f.file)]) };
    // kept with the night's painting, whoever is painting now
    const p = await pics.get(night).catch(() => null);
    if (p) await pics.put(night, { ...p, world }).catch((err) => console.log(`walk inside, not kept: ${err.message}`));
    Object.assign(W, { status: 'done', ...world });
    if (state.offer && nightOfOffer(state.offer) === night && painter === who) { showOffer(); toast(young() ? 'Your world is ready! Walk inside it.' : 'Your world is ready to walk into.', 3); sound.alive(); }
  })().catch((err) => failed(err.message));
}
// three.js, Spark and the walk (realwalk.js), loaded only now: in the one packed file they wait in
// the page as text (scripts/bundle.mjs) and are read only once someone walks inside
let walkLib = null, walker = null;
async function realWalkLib() {
  if (walkLib) return walkLib;
  const packed = document.getElementById('realwalk-lib');
  if (packed) {
    const url = URL.createObjectURL(new Blob([packed.textContent], { type: 'text/javascript' }));
    try { await new Promise((ok, no) => { const el = document.createElement('script'); el.src = url; el.onload = ok; el.onerror = () => no(new Error('the walk did not load')); document.head.append(el); }); } finally { URL.revokeObjectURL(url); }
    walkLib = window.InkwashRealWalk;
  } else {
    const at = './realwalk.js';
    walkLib = await import(at);
  }
  if (!walkLib || !walkLib.createRealWalk) throw new Error('the walk did not load');
  return walkLib;
}
async function openRealWalk(o, w) {
  if (state.realwalk) return;
  state.realwalk = { from: o, opening: true };
  const el = $('#realwalk');
  try {
    const lib = await realWalkLib();
    const bytes = new Uint8Array(await w.file.arrayBuffer());
    el.hidden = false;
    walker = walker || lib.createRealWalk(el.querySelector('.view'));
    await walker.open({ bytes, type: w.type, scale: w.scale });
  } catch (err) {
    console.log(`walk inside: ${err.message}`);
    if (walker) walker.close();
    el.hidden = true;
    state.realwalk = null;
    toast('This world can’t open on this TV.', 3);
    return;
  }
  if (state.offer !== o) { walker.close(); el.hidden = true; state.realwalk = null; return; }
  state.offer = null;
  state.realwalk = { from: o };
  for (const id of ['#feel', '#say', '#toast']) $(id).hidden = true;
  state.mode = 'realwalk';
  updateHints();
  if (readsAloud()) aloud.say(young() ? 'You’re inside your world! Press up to walk.' : 'You’re inside it. Up and down to walk, left and right to turn.');
}
function realWalkPress(button) {
  if (button === 'back') return leaveRealWalk();
  if (walker) walker.press(button);
}
// out again: the picture, and what happens next (or, after last time's story, what to do now)
function leaveRealWalk() {
  const o = state.realwalk && state.realwalk.from;
  state.realwalk = null;
  if (walker) walker.close();
  $('#realwalk').hidden = true;
  if (o && o.after) { state.mode = 'offer'; state.offer = { ...o, i: 0 }; $('#feel').hidden = false; showOffer(); updateHints(); }
  else if (o) offerEnding(o);
  else { state.mode = 'paint'; updateHints(); }
}
// Step inside (inside.js): the painting opens into a world to walk into, each thing they painted
// standing up from the paper. Back folds it back, and asks again what happens next.
async function stepInside(o) {
  const pic = o.after ? o.after.pic : null;
  const layers = pic ? await keptImage(pic).then((img) => ({ painting: img, key: picKey(pic), paper: paperSheet(), paperKey: 'paper' })).catch(() => null) : liveLayers();
  // inside their world's place, as it is at home
  const place = await placeFor(painter, world && world.scene).catch(() => null);
  if (state.offer !== o) return; // they chose something else while it was made
  const strokes = pic
    ? (pic.strokes || []).filter((x) => x.box && x.path && x.path.length).map((x) => ({ ...x, turn: turnOf(x.path), pools: [] }))
    : summarize(brush).map((x) => ({ ...x, path: (brush.strokes[x.n - 1]?.points || []).map((q) => [q.x, q.y]) })).filter((x) => x.path.length);
  let opened = false;
  const tonight = keptTonight(pic ? o.after.night : o.night);
  // each thing in it that has been made real stands there as its own picture
  const sprites = await thingPictures(painter, tonight.things).catch(() => ({}));
  if (state.offer !== o) return;
  try { opened = !!inside && inside.open({ layers, strokes, ...tonight, sprites, scene: place && place.scene, backdrop: place && place.backdrop }, performance.now() / 1000); } catch (err) { console.log(`inside: ${err.message}`); }
  if (!opened) { toast('This drawing can’t open yet.', 2.4); return; }
  state.offer = null;
  state.inside = { from: o };
  for (const id of ['#feel', '#say', '#toast']) $(id).hidden = true;
  state.mode = 'inside';
  updateHints();
  if (readsAloud()) aloud.say(young() ? 'You’re inside what you drew. Press OK to go to each thing in it.' : 'Walk around inside it. OK goes to each thing in it.');
}
// what tonight kept, for stepping inside: each thing in it (or in what they painted next) with its
// strokes and the line the telling gave it, and the telling's lines
function keptTonight(night) {
  if (!world || night == null) return { things: [], lines: [] };
  const S = world.toJSON(), N = S.nights.find((x) => x.n === Number(night));
  const lines = N ? ((N.ending && N.ending.lines) || N.lines || []).filter((l) => l.reaction !== 'no') : [];
  const things = S.entities.filter((e) => e.status !== 'rejected').map((e) => {
    const came = [...(e.appearances || []), ...(e.endings || [])].filter((a) => a.night === Number(night));
    if (!came.length) return null;
    const said = e.name.toLowerCase().replace(/^(the|a|an|my) /, '');
    const told = lines.find((l) => (l.entities || []).includes(e.id)) || lines.find((l) => l.text.toLowerCase().includes(said));
    return { id: e.id, name: e.name, strokes: [...new Set(came.flatMap((a) => a.strokes || []))], line: told ? told.text : null };
  }).filter(Boolean);
  return { things, lines: lines.map((l) => ({ text: l.text, strokes: l.strokes || [] })) };
}
function insidePress(button) {
  const r = inside.press(button, performance.now() / 1000);
  if (r && readsAloud()) aloud.say([r.name ? `${r.name.charAt(0).toUpperCase()}${r.name.slice(1)}.` : null, r.line].filter(Boolean).join(' '));
  if (r) sound.dip(false);
}
// folded back: the painting, exactly as it was, without a flicker; then what happens next, again
function leftInside() {
  const o = state.inside && state.inside.from;
  state.inside = null;
  const stage = $('#stage');
  stage.classList.add('seam');
  if (o) offerEnding(o); else { state.mode = 'paint'; updateHints(); }
  requestAnimationFrame(() => requestAnimationFrame(() => { stage.classList.remove('seam'); if (inside) inside.clear(); }));
}
function startEnding() {
  const o = state.offer;
  state.offer = null;
  $('#feel').hidden = true;
  state.ending = { night: o.night, from: brush.strokes.length, told: o.told, feeling: o.feeling ? { byStroke: o.feeling.byStroke.slice(), arousal: (o.feeling.arousal || []).slice() } : null, goodnight: o.goodnight };
  // what happens next is painted on the ink
  hideReal();
  state.mode = 'paint';
  $('#ending').hidden = false;
  say(painter && painter.young ? 'Draw what happens next. It can go any way you like. Press ▶‖ when it is done.' : 'Draw what happens next, any way you like. Press ▶‖ when it is done.');
  updateHints();
}
function endEnding(message) {
  state.ending = null;
  $('#ending').hidden = true;
  if (message) toast(message, 3);
  updateHints();
}

// ---------------------------------------------------------------- previously in their world

// When they come back on a later day, the TV offers the last night's story again (world.recap),
// the way a series opens with what happened last time: as it was last told, with what they painted
// next if they did, over the painting kept that night, each line lit on its strokes and read aloud.
// No model is asked, so it is there without the story server. Each time is kept with the night
// (world.recapped), and so is "not now"; then the paper is theirs.
function startRecap(due) {
  hideReal();
  state.offer = null;
  $('#feel').hidden = true;
  $('#feel .beside').hidden = true;
  $('#say').hidden = true;
  // the painting as it was kept that night, over the clean paper
  const kept = $('#kept');
  kept.src = due.pic.image;
  kept.hidden = false;
  keptLight.show(due.pic);
  const boxOf = (ns) => { const bs = due.pic.strokes.filter((x) => ns.includes(x.n) && x.box).map((x) => x.box); return bs.length ? bs.reduce((u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])]) : null; };
  const lines = due.lines.map((l, i) => ({ text: l.text, strokes: l.strokes, box: boxOf(l.strokes), v: 0, a: 0, audio: null, voice: voiceOf({ v: 0, a: 0, roles: i === due.lines.length - 1 && i ? ['ending'] : [] }) }));
  if (ai) for (const l of lines) ai.speak({ text: l.text, ...l.voice }).then((r) => { l.audio = r && r.audio; }).catch(() => {});
  const name = painter ? sealOf(painter.seal).name : null;
  state.tell = { recap: { night: due.night, pic: due.pic }, title: `Previously${name ? ` in ${name}’s world` : ''}: ${due.title}`, lines, i: -1, paused: false, next: performance.now() + 5600, reactions: lines.map(() => null), told: true, layers: keptLayers(due.pic).catch(() => null) };
  state.mode = 'tell';
  const el = $('#tell');
  el.querySelector('.title').textContent = state.tell.title;
  el.querySelector('.text').textContent = '…';
  el.querySelector('.count').textContent = '';
  el.querySelector('.line').innerHTML = '';
  el.classList.remove('high');
  // the panel waits for the first line: "Previously in…" opens it
  el.hidden = true;
  updateHints();
  film(state.tell);
  showPreviously(due, state.tell);
}
// "Previously in Star's world", the way a series opens: the nights before going by, the last of
// them the one heard again, then its title, signed with their seal. OK skips it.
async function showPreviously(due, tell) {
  const el = $('#previously');
  const name = painter ? sealOf(painter.seal).name : null;
  const nights = world ? world.toJSON().nights : [];
  const reel = [];
  for (let n = Math.max(1, due.night - 2); n <= due.night; n++) {
    const pic = n === due.night ? due.pic : await paintings.get(n).catch(() => null);
    if (pic) reel.push({ n, pic, title: (nights.find((x) => x.n === n) || {}).title || 'Untitled' });
  }
  if (state.tell !== tell || tell.i >= 0) return;
  el.querySelector('.kicker').textContent = `Previously${name ? ` in ${name}’s world` : ''}`;
  el.querySelector('.title').textContent = due.title;
  el.querySelector('.night').textContent = `Chapter ${due.night}`;
  el.querySelector('.stamp').innerHTML = painter ? sealSvg(painter.seal, 40) : '';
  // in their world, each chapter as it was drawn there, as light (a picture made real, as it is)
  const lit = inWorld();
  el.querySelector('.reel').innerHTML = reel.length > 1 ? reel.map((r, i) => `<figure class="frame${r.n === due.night ? ' now' : ''}" style="--i:${i}"><img src="${r.pic.real || (lit ? '' : r.pic.image)}" alt=""><figcaption>Chapter ${r.n} · ${esc(r.title)}</figcaption></figure>`).join('') : '';
  if (lit && reel.length > 1) reel.forEach((r, i) => {
    if (r.pic.real) return;
    keptLayers(r.pic).then((L) => {
      const img = el.querySelectorAll('.reel img')[i];
      if (img && state.tell === tell) img.src = inkAsLight(L.ink, { floor: 14, glow: 7 * ((L.ink.width || 1600) / UNITS.W) }).toDataURL();
    }).catch(() => {});
  });
  el.classList.remove('play', 'out');
  el.hidden = false;
  void el.offsetWidth; // so it plays from the start
  el.classList.add('play');
  tell.card = setTimeout(() => { if (state.tell === tell && tell.i < 0 && !lit) sound.seal(); }, 2600);
}
function endPreviously(tell) {
  const el = $('#previously');
  if (tell && tell.card) clearTimeout(tell.card);
  if (el.hidden || el.classList.contains('out')) return;
  el.classList.add('out');
  setTimeout(() => { el.hidden = true; el.classList.remove('play', 'out'); }, 800);
}
// `heard`: how many of its lines they heard; none is a "not now"
function endRecap(heard) {
  const tell = state.tell;
  endPreviously(tell);
  world.recapped({ night: tell.recap.night, heard, of: tell.lines.length });
  saveMine();
  const kept = $('#kept');
  if (aloud) aloud.stop();
  const all = heard >= tell.lines.length;
  // heard to the end: they may step inside it, its painting still there (made real, if it was, or
  // else woken up in their world's place, as on the night it was told), or paint tonight's
  if (all) {
    stopTelling(null);
    const pic = tell.recap.pic;
    if (pic.real) showReal({ image: pic.real }, { strokes: pic.strokes || [] });
    offerAfter(tell.recap);
    if (pic.real && pic.alive) { const o = state.offer; after(5200).then(() => { if (state.offer === o) playAlive(pic.alive); }); }
    const o = state.offer;
    if (!pic.real) placeFor(painter, world && world.scene).then((place) => nightUrl(pic, place)).then((image) => { if (image && state.offer === o) showReal({ image }, { strokes: pic.strokes || [] }); });
    return;
  }
  stopTelling(null);
  backToWorld();
}
const AFTER = ['Step inside', 'Draw something new'];
function offerAfter(recap) {
  state.mode = 'offer';
  state.offer = { after: { night: recap.night, pic: recap.pic }, i: 0 };
  const el = $('#feel');
  el.classList.add('arriving', 'offering');
  el.querySelector('.ask').textContent = young() ? 'Do you want to go inside it?' : 'Step inside it?';
  el.querySelector('.marks').textContent = young() ? 'You can walk around in it, or draw something new.' : `Walk around in chapter ${recap.night}, or draw something new into your world.`;
  el.querySelector('.beside').hidden = true;
  el.classList.remove('over-line', 'high');
  showOffer();
  el.hidden = false;
  updateHints();
  if (readsAloud()) aloud.say('Do you want to go inside it?');
}
// ---------------------------------------------------------------- who's painting tonight

// Each painter on this TV keeps a dream world of their own (family.js). At the start, and when
// Back is pressed on a clean paper, they choose who is painting: a painter's seal, or a new
// painter, who chooses a seal and says who the guide is talking to, a grown-up or a child.
const WHO_TEXT = {
  pick: ['Who’s here?', 'Each of you keeps your own world on this TV.'],
  seal: ['Choose your seal', 'It signs what you draw, and keeps your world apart from everyone else’s on this TV.'],
  for: ['Who is the storyteller talking to?', null],
};
const FOR = [
  { text: 'A grown-up', young: false, sub: 'The storyteller tells what you draw back to you as stories, the way you drew it.' },
  { text: 'A child', young: true, sub: 'The storyteller reads everything aloud, uses simple words, and never adds anything scary.' },
];
// Keeping a painter's world (world.js keepWorld): at once on this TV, and every night with the
// paintings too. What became of it decides the word for the grown-ups on the seals; a world neither
// store would take is said so at once, and tried again every minute and each time the seals come up.
function keepTheirs(w, key, nights) {
  return keepWorld(w, key, { archive: nights }).then((r) => {
    state.room = r.room;
    if (r.kept) state.unkept.delete(key);
    else {
      if (!state.unkept.has(key)) { toast('This TV is out of room, so the last drawing isn’t kept yet. A grown-up can free up some space on it.', 6); state.retryKeep = performance.now() + 60000; }
      state.unkept.set(key, { w, nights });
    }
    if (state.mode === 'who') showRoom();
    return r;
  });
}
const saveMine = () => (world && painter ? keepTheirs(world, worldKey(painter), archive) : Promise.resolve(null));
// How full the TV's larger store is, as the browser estimates it (0 to 1), when it can
async function measureDisk() {
  try {
    const e = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
    state.disk = e && e.quota ? e.usage / e.quota : null;
  } catch { state.disk = null; }
}
// the word for the grown-ups on the seals, when the TV is short of room
function showRoom() {
  const el = $('#who .room');
  const t = roomSays({ room: state.room, disk: state.disk, apart: apartKeys().length, unkept: state.unkept.size > 0 });
  el.textContent = t ? t.text : '';
  el.hidden = !t;
  el.classList.toggle('alarm', !!(t && t.alarm));
}

function openWho() {
  const fresh = !family.painters.length;
  state.mode = 'who';
  state.who = {
    step: fresh ? 'seal' : 'pick', seal: null,
    i: fresh ? 0 : Math.max(0, family.painters.findIndex((p) => p.id === (painter ? painter.id : family.last))),
    nights: family.painters.map((p) => loadWorld(undefined, worldKey(p)).tonight() - 1),
  };
  for (const id of ['#say', '#pair', '#phone', '#painter', '#seal', '#toast']) $(id).hidden = true;
  state.toastUntil = 0;
  showWho();
  $('#who').hidden = false;
  updateHints();
  // how full the TV is: a world that couldn't be kept is tried again
  state.room = roomOf();
  showRoom();
  for (const [key, a] of state.unkept) keepTheirs(a.w, key, a.nights);
  measureDisk().then(() => { if (state.mode === 'who') showRoom(); });
}

function whoItems() {
  const w = state.who;
  if (w.step === 'pick') return [...family.painters.map((p) => ({ kind: 'painter', p })), ...(freeSeals(family).length ? [{ kind: 'new' }] : [])];
  if (w.step === 'seal') return freeSeals(family).map((seal) => ({ kind: 'seal', seal }));
  return FOR.map((f) => ({ kind: 'for', ...f }));
}

function showWho() {
  const w = state.who, el = $('#who'), items = whoItems();
  const [title, sub] = WHO_TEXT[w.step];
  el.querySelector('h2').textContent = w.step === 'seal' && !family.painters.length ? 'Welcome. Choose your seal' : title;
  el.querySelector('.sub').textContent = w.step === 'for' ? FOR[w.i].sub : sub;
  const tile = (seal, name, about, on, extra = '') => `<div class="tile${extra}${on ? ' on' : ''}"><span class="stamp">${seal ? sealSvg(seal, 84) : '+'}</span><span class="name">${name}</span><span class="about">${about}</span></div>`;
  if (w.step === 'for') {
    el.querySelector('.tiles').innerHTML = tile(w.seal, sealOf(w.seal).name, '', false);
    el.querySelector('.chips').innerHTML = items.map((it, i) => `<span class="chip${i === w.i ? ' on' : ''}">${it.text}</span>`).join('');
    return;
  }
  el.querySelector('.chips').innerHTML = '';
  el.querySelector('.tiles').innerHTML = items.map((it, i) => {
    if (it.kind === 'new') return tile(null, 'Someone new', '', i === w.i, ' new');
    if (it.kind === 'seal') return tile(it.seal.id, it.seal.name, '', i === w.i);
    const d = describe(it.p, w.nights[i]);
    return tile(it.p.seal, d.name, d.about, i === w.i);
  }).join('');
}

function whoPress(button) {
  const w = state.who, items = whoItems(), n = items.length;
  // ▶‖ opens the demo family (outside it, and before a new painter is half made)
  if (button === 'playpause' && !family.demo && w.step !== 'for') { enterDemo(); return; }
  // « on a painter's seal: their book; » the map of their world
  if (button === 'rewind' && w.step === 'pick' && w.i < family.painters.length) { openJournal(family.painters[w.i]); return; }
  if (button === 'fastforward' && w.step === 'pick' && w.i < family.painters.length) return startPainter(choose(family, family.painters[w.i].id));
  if (button === 'left' || button === 'up') { w.i = (w.i + n - 1) % n; sound.dip(false); }
  else if (button === 'right' || button === 'down') { w.i = (w.i + 1) % n; sound.dip(false); }
  else if (button === 'select' || button === 'playpause') {
    const it = items[w.i];
    if (it.kind === 'painter') return startPainter(choose(family, it.p.id));
    if (it.kind === 'new') { w.step = 'seal'; w.i = 0; }
    else if (it.kind === 'seal') { w.seal = it.seal.id; w.step = 'for'; w.i = 0; }
    else {
      const p = addPainter(family, { seal: w.seal, young: it.young });
      if (p) return startPainter(p);
      w.step = 'seal'; w.i = 0;
    }
    sound.dip(false);
  } else if (button === 'back') {
    if (w.step === 'for') { w.step = 'seal'; w.i = Math.max(0, freeSeals(family).findIndex((x) => x.id === w.seal)); }
    else if (w.step === 'seal' && family.painters.length) { w.step = 'pick'; w.i = family.painters.length; }
    else if (painter) return openWorld(); // back to their world
    else if (family.demo) return leaveDemo();
    else { toast('Press Home to leave Inkwash.'); return; }
  }
  showWho();
  updateHints();
}

const newGuide = () => createGuide({ say, ai, young: young(), pace: fastPace ? { gap: 1, pauseForRemark: 0.8, remarkEvery: 2, idle: 600 } : {}, onRemark: (text) => { if (phone) phone.ask(text); } });

// The demo family: two painters and their earlier nights, painted in this page with the real brush,
// ink and harness by scripted remote presses and told by a scripted guide (scripts/demo.mjs), laid
// out fresh each time, under their own names, with the nights moved to the days before today. The
// TV's own family is left as it was, and the demo is labelled on the felt while it is open.
async function enterDemo() {
  state.mode = 'loading';
  updateHints();
  for (const p of DEMO.painters) {
    putWorld(DEMO.worlds[p.id], `inkwash.demo.world.${p.id}`);
    const pics = createPaintings(undefined, `demo-${p.id}`);
    for (const [n, pic] of Object.entries(DEMO.paintings[p.id] || {})) await pics.put(Number(n), pic);
  }
  family = demoFamily(DEMO);
  saveVisits([], visitsKey(family));
  painter = null;
  brush = newBrush({ x: 800, y: 500, heading: 0 });
  ink.clear();
  $('#demo').hidden = false;
  openWho();
}
function leaveDemo() {
  family = loadFamily();
  painter = null;
  $('#demo').hidden = true;
  openWho();
}

// Their dream world, their paintings, a clean sheet and a guide that hasn't met them tonight; and
// their world, open
const copied = new Set();
function startPainter(p) {
  painter = p;
  if (!family.demo) saveFamily(family);
  world = loadWorld(undefined, worldKey(p));
  paintings = createPaintings(undefined, paintingsKey(p));
  // every night their world holds is kept with the paintings too (once a session, for nights kept
  // before there was anywhere else to keep them), and read there once it lets one go
  archive = createNights(undefined, paintingsKey(p));
  if (!copied.has(worldKey(p))) { copied.add(worldKey(p)); archive.putMany(world.nights).catch(() => copied.delete(worldKey(p))); }
  ink.clear();
  brush = newBrush({ x: 800, y: 500, heading: 0 });
  Object.assign(state, { words: [], washed: [], kept: null, nightKept: false, keptStrokes: 0, tell: null, line: null, ask: null, feel: null, offer: null, ending: null });
  $('#ending').hidden = true;
  hideReal();
  guide = newGuide();
  $('#painter .stamp').innerHTML = sealSvg(p.seal, 40);
  $('#painter .name').textContent = sealOf(p.seal).name;
  $('#painter').hidden = false;
  updateDishes();
  openWorld();
}

// ---------------------------------------------------------------- the book of their world

// Their world as a picture book (book.js), opened from the seals (« on a painter) or from their
// world: a title spread, with who and what keeps coming back; then a night to a spread, the
// painting on the left and its story on the right, as it was last told. ◀ ▶ or OK turn the page,
// about the spine; Back closes it. A child hears each page read aloud.
const esc = (t) => String(t ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const dayOf = (t) => { try { return t ? new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : ''; } catch { return ''; } };
const timesOf = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
function openJournal(p, { from = 'who' } = {}) {
  const book = bookOf(loadWorld(undefined, worldKey(p)), { young: !!p.young });
  if (from === 'atlas') closeWorld();
  state.mode = 'journal';
  state.journal = { id: p.id, from, book, spreads: spreadsOf(book), i: 0, turning: null, pics: createPaintings(undefined, paintingsKey(p)) };
  $('#who').hidden = true;
  $('#journal').innerHTML = '<div class="book"><div class="page left"></div><div class="page right"></div></div><p class="folio"></p>';
  // in their world, their book is of their nights: dark pages, each chapter's drawing as light,
  // made one after another as it opens, so each page is ready to turn to
  $('#journal').classList.toggle('lit', inWorld());
  showSpread();
  if (inWorld()) {
    const J = state.journal;
    book.nights.slice(0, 8).reduce((chain, n) => chain.then(() => (state.journal === J ? J.pics.get(n.n).then((pic) => pic && lightInBook(pic.image)) : null)).catch(() => {}), Promise.resolve());
  }
  $('#journal').hidden = false;
  updateHints();
}
// a page of the book: `side` 'left' or 'right' of spread `s`
function pageOf(s, side) {
  const J = state.journal, B = J.book, p = family.painters.find((x) => x.id === J.id), young = !!p.young;
  if (s.cover && side === 'left') {
    const first = B.nights[0], last = B.nights[B.nights.length - 1];
    const when = first && first.at ? (first === last ? dayOf(first.at) : `${dayOf(first.at)} to ${dayOf(last.at)}`) : '';
    return `<div class="cover"><span class="stamp">${sealSvg(p.seal, 92)}</span><h2>${esc(sealOf(p.seal).name)}’s book</h2><p class="sub">${B.total ? `${B.total} ${B.total === 1 ? 'chapter' : 'chapters'}${when ? `, ${esc(when)}` : ''}. Kept on this TV.` : 'Nothing in it yet.'}</p></div>`;
  }
  if (s.cover) {
    if (!B.things.length) return `<p class="empty">${B.total ? 'When something comes back in another chapter, it will be here.' : `Draw something, and ${young ? 'its' : 'your'} book begins.`}</p>`;
    return `<div class="keeps"><p class="kicker">What keeps coming back</p>${B.things.slice(0, 4).map((t) => `<div class="thing"><p class="name">${esc(cap(t.name))}</p><p class="says">${esc(t.says)}</p></div>`).join('')}</div>`;
  }
  const n = s.night;
  if (side === 'left') return `<figure class="art" data-n="${n.n}"><img alt=""></figure><p class="when">Chapter ${n.n}${n.at ? ` · ${esc(dayOf(n.at))}` : ''}</p>`;
  const k = n.lines.findIndex((l) => l.next);
  const story = n.lines.map((l, i) => `${i === k ? '<p class="then">What happened next</p>' : ''}<p${l.next ? ' class="next"' : ''}>${esc(l.text)}</p>`).join('');
  const heard = (world && painter && painter.id === J.id ? world : loadWorld(undefined, worldKey(p))).toJSON().nights.find((x) => x.n === n.n);
  const again = heard && (heard.heard || []).filter((r) => r.heard > 0).length;
  const foot = [n.felt ? `Felt ${n.felt}.` : '', n.things.length ? `In it: ${n.things.join(', ')}.` : '', again ? `Heard again ${timesOf(again)}.` : ''].filter(Boolean).join(' ');
  return `<p class="kicker">Chapter ${n.n}</p><h2>${esc(n.title)}</h2><div class="story">${story}</div>${foot ? `<p class="in">${esc(foot)}</p>` : ''}${n.remembered ? `<p class="remembered">${esc(n.remembered)}</p>` : ''}`;
}
// the open spread, drawn: its paintings found, its story fitted to its page, read aloud to a child
function showSpread() {
  const J = state.journal, s = J.spreads[J.i], el = $('#journal');
  el.querySelector('.page.left').innerHTML = pageOf(s, 'left');
  el.querySelector('.page.right').innerHTML = pageOf(s, 'right');
  settleSpread(el);
  el.querySelector('.folio').textContent = s.cover ? (J.spreads.length > 1 ? `${J.spreads.length - 1} ${J.spreads.length === 2 ? 'chapter' : 'chapters'} in it` : '') : `${J.i} of ${J.spreads.length - 1}`;
  if (!s.cover && readsAloud()) aloud.say([s.night.title, ...s.night.lines.map((l) => l.text)].join(' '));
}
// paintings into their frames, and a story too long for its page set a little smaller
function settleSpread(el) {
  const J = state.journal;
  for (const fig of el.querySelectorAll('figure.art[data-n]')) {
    const n = Number(fig.dataset.n), img = fig.querySelector('img');
    J.pics.get(n).then((pic) => pic && (inWorld() ? lightInBook(pic.image) : pic.image)).then((src) => { if (src && img.isConnected) img.src = src; }).catch(() => {});
  }
  for (const story of el.querySelectorAll('.story')) {
    for (let size = 32; size > 22 && story.scrollHeight > story.clientHeight + 1; size -= 2) story.style.fontSize = `${size - 2}px`;
  }
}
// a page turned: the page it was on goes over on a leaf, the next spread's under it
function turnPage(dir) {
  const J = state.journal, k = J.i + dir;
  if (J.turning || k < 0 || k >= J.spreads.length) return false;
  const el = $('#journal'), book = el.querySelector('.book'), next = J.spreads[k];
  const from = dir > 0 ? 'right' : 'left', to = dir > 0 ? 'left' : 'right';
  const leaf = document.createElement('div');
  leaf.className = `leaf ${dir > 0 ? 'fwd' : 'back'}`;
  leaf.innerHTML = `<div class="page ${from}">${book.querySelector(`.page.${from}`).innerHTML}</div><div class="page ${to} under">${pageOf(next, to)}</div>`;
  book.querySelector(`.page.${from}`).innerHTML = pageOf(next, from);
  book.append(leaf);
  settleSpread(el);
  sound.dip(true);
  J.turning = setTimeout(() => {
    if (state.journal !== J) return;
    J.i = k; J.turning = null;
    leaf.remove();
    showSpread();
  }, 920);
  requestAnimationFrame(() => requestAnimationFrame(() => leaf.classList.add('turned')));
  return true;
}
function journalPress(button) {
  if (button === 'left') { if (!turnPage(-1)) sound.dip(false); return; }
  if (button === 'right' || button === 'select') { if (!turnPage(1) && button === 'select') closeJournal(); return; }
  if (button === 'back') closeJournal();
}
function closeJournal() {
  const J = state.journal, k = family.painters.findIndex((p) => p.id === J.id);
  clearTimeout(J.turning);
  $('#journal').hidden = true;
  $('#journal').innerHTML = '';
  state.journal = null;
  if (J.from === 'atlas' && painter && painter.id === J.id) return openWorld();
  openWho();
  state.who.i = Math.max(0, k);
  showWho();
  updateHints();
}

// ---------------------------------------------------------------- the loop

let last = 0;
// Walking (inside a painting, or through their world): the arrows held long enough to walk on. A
// tap turns or steps a little by itself; a remote's tap is held a tenth of a second, and that is
// not a walk.
const WALK_AFTER = 180;
const walkingHeld = (t) => new Set([...remote.held(t)].filter((b) => remote.heldFor(b, t) > WALK_AFTER));
// how the frames go, for checking on a TV: the page's own work in a frame, and the time between
// frames (milliseconds, smoothed)
const pacing = { work: 0, gap: 0 };
// One thing going wrong in a frame is said once, and the next frame comes all the same: a TV whose
// frames stop doesn't answer its remote at all
const wentWrong = new Set();
function frame(t) {
  try { frameOnce(t); } catch (err) {
    const what = String((err && err.stack) || err);
    if (!wentWrong.has(what) && wentWrong.size < 20) { wentWrong.add(what); console.error(`a frame went wrong: ${what}`); }
  }
  requestAnimationFrame(frame);
}
function frameOnce(t) {
  const dt = last ? (t - last) / 1000 : 0;
  const began = performance.now();
  if (dt > 0 && dt < 0.5) pacing.gap += (dt * 1000 - pacing.gap) * 0.1;
  last = t;
  for (const b of remote.takePresses()) onPress(b, t);
  if (inside) inside.frame(t / 1000, state.mode === 'inside' ? walkingHeld(t) : null);
  // their world at night: each thing moving the way its shape moves; walked through, held arrows walk
  if (state.mode === 'atlas' && state.atlas && state.atlas.night) {
    const A = state.atlas, W = A.walk;
    if (W && W.hearing && t > W.hearing.next) heardNext(A);
    A.night.frame(t / 1000, W && !W.leaving ? walkingHeld(t) : null);
  }
  // a world neither store would take: tried again every minute, as well as each time the seals come up
  if (state.unkept.size && t > state.retryKeep) { state.retryKeep = t + 60000; for (const [key, a] of state.unkept) keepTheirs(a.w, key, a.nights); }
  if (state.mode === 'replay') {
    sound.brush(false, 0, 0, 1);
    replayFrame(t, dt);
  } else if (state.mode === 'paint') {
    const r = step(brush, { held: remote.held(t), arrow: remote.arrow(t) }, dt);
    if (r.segs.length) {
      ink.marks(r.segs);
      state.cover = r.segs.reduce((a, s) => a + s.cover, 0) / r.segs.length;
    }
    if (r.event === 'end') { ink.end(); guide.event('end'); updateHints(); }
    else if (r.event) guide.event(r.event);
    sound.brush(brush.touching, brush.speed, brush.pressure, state.cover);
    guide.tick(look);
  } else {
    sound.brush(false, 0, 0, 1);
    const tell = state.tell;
    if (tell && !tell.paused && t > tell.next) nextLine();
  }
  // left on the seals a while, the TV rests as a frame for their paintings
  if (state.mode === 'who' && state.who && state.who.step === 'pick' && t - lastInput > IDLE) startGallery();
  // painting: what the buttons do fades once they have let the remote be a while, and is back at a press
  $('#hints').classList.toggle('hush', state.mode === 'paint' && !brush.down && t - lastInput > HUSH);
  // (a world with nothing in it yet has nothing to leave them with: its words stay)
  const A = state.atlas, still = state.mode === 'atlas' && A && A.cards.length > 0 && !A.walk && !A.look && !A.wonder && !A.said && t - lastInput > QUIET;
  if (still !== document.body.classList.contains('quiet')) quiet(still);
  const G = state.gallery;
  if (G) { if (G.next && t > G.next) galleryNext(G); G.lives.forEach((l) => l.frame(t / 1000)); }
  // looking across a panorama: the arrows held look that way
  if (state.mode === 'wide') { const held = remote.held(t); panWide(dt, (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0)); }
  if (phone) { phone.tick(t / 1000, heard); updatePhone(); }
  if (sky) sky.frame(dt, t / 1000);
  if (life) life.frame(t / 1000);
  ink.frame(dt);
  // a slow TV: fewer wet steps, so the brush stays smooth
  if (ink.setQuality) { const q = governor.frame(dt, ink.wet); if (q != null) ink.setQuality(q); }
  drawHand();
  if (state.toastUntil && t > state.toastUntil) { $('#toast').hidden = true; state.toastUntil = 0; }
  if (state.heardUntil && t > state.heardUntil) { $('#heard').hidden = true; state.heardUntil = 0; }
  if (state.sayUntil && t > state.sayUntil) {
    $('#say').classList.add('fading');
    $('#voice-mark').classList.remove('speaking');
    if (t > state.sayUntil + 600) { $('#say').hidden = true; state.sayUntil = 0; }
  }
  pacing.work += (performance.now() - began - pacing.work) * 0.1;
}

// ---------------------------------------------------------------- start

async function boot() {
  // the bundled typefaces, before anything is drawn in them (a TV shouldn't flash fallbacks)
  if (document.fonts && document.fonts.load) {
    await Promise.race([
      Promise.all(['600 46px Alegreya', 'italic 42px Alegreya', '500 25px "Alegreya Sans"', '700 19px "Alegreya Sans"'].map((f) => document.fonts.load(f))).catch(() => null),
      new Promise((ok) => setTimeout(ok, 2500)),
    ]);
  }
  let canvas = $('#ink');
  ink = createInkGL(canvas);
  if (!ink) {
    // a canvas that has tried WebGL can't give 2D; a fresh one can
    const fresh = canvas.cloneNode();
    canvas.replaceWith(fresh);
    canvas = fresh;
    ink = createInk2D(canvas);
  }
  hand = $('#hand');
  brushCanvas = $('#brush');
  sky = createSky($('#sky'));
  life = createLife($('#life'), { px: SCALE, changed: hideLifted });
  inside = createInside($('#inside'), { onClosed: leftInside });
  brush = newBrush({ x: 800, y: 500, heading: 0 });
  ai = createAI({ endpoint: guideEndpoint(), key: guideKey() });
  render = createRenderer();
  // the guide (?pace=fast: it speaks up sooner, for the browser test); its questions go to the
  // phone too, where they answer them
  guide = newGuide();
  aloud = createAloud({ speak: ai && ai.speak ? (b) => ai.speak(b) : null, audio: new Audio() });
  phone = createPhone({ ai });
  if (phone) phone.pair().then(showPairing).catch(() => { phone = null; });
  family = loadFamily();
  // the worlds too big for localStorage, read from IndexedDB from now on; and the browser asked to
  // keep what the TV keeps even when the TV is short of space, rather than clear it
  await loadApart(createWorlds()).catch(() => []);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => false);
  updateDishes();
  $('#loading').hidden = true;
  // ?demo: straight to the demo family; first, on a TV that has never had Inkwash open (or with
  // ?intro), the opening (?intro=0: never; a browser driven by the tests: only when asked)
  const q = new URLSearchParams(location.search), next = () => (q.has('demo') ? enterDemo() : openWho());
  let seen = false;
  try { seen = !!localStorage.getItem('inkwash.opened'); } catch { seen = false; }
  if (q.get('intro') !== '0' && (q.has('intro') || (!navigator.webdriver && !seen && !family.painters.length))) startIntro(next);
  else await next();
  window.__inktv.ready = true;
  requestAnimationFrame(frame);
  // the night's GPU (glow.js: its context and shaders) and the paper a kept painting is divided by,
  // made ready while little else is happening, not when their world is first opened (during the
  // opening, its worlds make them ready, when it can bear it)
  setTimeout(() => { if (opening) return; try { if (getGlow()) paperSheet(); } catch (err) { console.log(`glow: ${err.message}`); } }, 2500);
}

// What the browser test reads and sets. `place` moves the brush only while it's lifted.
window.__inktv = {
  ready: false,
  // where the world stands: its scene (scene.js), and, for the tests, setting one and showing it
  get placeScene() { return world ? world.scene : null; },
  get sceneBrief() { return world ? sceneBrief(world.toJSON(), { young: young() }) : null; },
  // whether the place shown is painted (an image model's) or drawn (the TV's own)
  // the marks the light view is dimmed round, [u0, v0, u1, v1] (a question or a line), or null
  get focused() { return ink && ink.focused ? ink.focused : null; },
  get placeLook() { const A = state.atlas, L = A && A.look; return L && { question: L.question, options: L.options, waiting: L.waiting, k: L.k }; },
  // the place being written for it, just now
  get placeAsking() { const A = state.atlas; return !!(A && A.asking); },
  get placePainted() { const A = state.atlas; return !!(A && A.night && A.night.painted); },
  setScene(sc) { if (!world) return null; const kept = world.setScene(sc); if (state.mode === 'atlas') showAtlas(); return kept; },
  get mode() { return state.mode; },
  get opening() { return opening && { t: opening.t }; },
  get demo() { return !!(family && family.demo); },
  get steps() { return $('#steps').hidden ? null : [...document.querySelectorAll('#steps li')].map((li) => (li.classList.contains('now') ? 'now' : li.classList.contains('done') ? 'done' : '')); },
  get aloud() { return aloud && { kept: aloud.kept, heard: aloud.heard }; },
  // their book: its title, the spread open (0, the title spread), what keeps coming back, its nights in order, and the page open now
  get journal() { const J = state.journal; return J && { id: J.id, title: document.querySelector('#journal .cover h2') ? document.querySelector('#journal .cover h2').textContent : null, i: J.i, spreads: J.spreads.length, turning: !!J.turning, things: J.book.things.map((t) => ({ name: t.name, says: t.says })), nights: J.book.nights.map((n) => n.title), page: { left: document.querySelector('#journal .book > .page.left').innerText, right: document.querySelector('#journal .book > .page.right').innerText, art: [...document.querySelectorAll('#journal .book > .page img')].map((i) => !!i.getAttribute('src')) } }; },
  get who() { const w = state.who; return { step: w ? w.step : null, i: w ? w.i : null, painters: family ? family.painters.map((p) => ({ ...p })) : [], painter: painter && { ...painter, name: sealOf(painter.seal).name } }; },
  get ink() { return ink && ink.kind; },
  get quality() { return { level: governor.level, share: ink && ink.quality != null ? ink.quality : 1 }; },
  // the page's own work in a frame and the time between frames, in milliseconds
  get frames() { return { work: Math.round(pacing.work * 10) / 10, gap: Math.round(pacing.gap * 10) / 10 }; },
  // the paper still settling: wet ink spreading, or a stroke being washed out
  get wet() { return !!(ink && ink.wet); },
  get brush() { return brush && { x: brush.x, y: brush.y, heading: brush.heading, down: brush.down, touching: brush.touching, pressure: brush.pressure, ink: INKS[brush.ink].id, strokes: brush.strokes.length }; },
  get strokes() { return brush ? summarize(brush) : []; },
  get said() { return guide ? guide.remarks : []; },
  get tell() { return state.tell && { i: state.tell.i, n: state.tell.lines.length, title: state.tell.title, text: state.tell.lines[state.tell.i]?.text, told: state.tell.told }; },
  get feel() { return state.feel && { i: state.feel.i, choice: FEEL_CHOICES[state.feel.i] === null ? 'Don’t say' : FEEL_CHOICES[state.feel.i], words: state.feel.marks ? state.feel.marks.words : [] }; },
  get line() { const L = state.line; return L && { t: L.t, end: L.plan.end, v: L.dial.v, a: L.dial.a, pressed: L.pressed, shown: L.shown, byStroke: L.byStroke, arousal: L.arousal, turn: L.read ? L.read.turn : null, focus: L.read ? L.read.focus : null }; },
  get ask() { return state.ask && { n: state.ask.n, step: state.ask.step, readings: state.ask.readings, known: state.ask.known, i: state.ask.i, choice: askChoices()[state.ask.i].text, said: state.ask.said }; },
  get words() { return state.words.slice(); },
  get phone() { return phone && { code: phone.code, url: phone.url, listening: phone.listening }; },
  get world() { return world && { nights: world.nights.length, summary: world.summary(), kept: state.kept }; },
  // how full the TV is, and what the seals say of it; keeping the painter's world now; the nights kept apart
  get room() { const el = $('#who .room'); return { note: el.hidden ? null : el.textContent, alarm: el.classList.contains('alarm'), apart: apartKeys(), share: state.room ? state.room.share : null, unkept: [...state.unkept.keys()] }; },
  keep() { return saveMine(); },
  archived() { return archive ? archive.all().then((ns) => ns.map((n) => n.n)) : Promise.resolve([]); },
  // everything kept of the painter's world, for checking what forgetting leaves: the world, its
  // chapters kept apart, and each chapter's drawing (its marks, whether a picture was made of it)
  async memory() {
    if (!world) return null;
    const apart = archive ? await archive.all() : [];
    const pics = await Promise.all(world.nights.map((n) => paintings.get(n.n).catch(() => null)));
    return { world: world.toJSON(), apart, drawings: pics.map((p, i) => p && { n: world.nights[i].n, strokes: (p.strokes || []).map((s) => s.n), real: !!p.real }) };
  },
  get reactions() { return state.tell ? state.tell.reactions.slice() : null; },
  get guide() { const g = state.guiding; return { running: !!g, step: g ? g.step : null, last: state.lastGuide }; },
  get washed() { return state.washed.slice(); },
  get ending() { return state.ending && { night: state.ending.night, from: state.ending.from, told: state.ending.told.title }; },
  get offer() { return state.offer && { i: state.offer.i, choice: offerChoices()[state.offer.i], ...(state.offer.recap ? { recap: state.offer.recap.night } : {}) }; },
  get recap() { const t = state.tell; return t && t.recap ? { night: t.recap.night, i: t.i, n: t.lines.length, title: t.title, text: t.lines[t.i]?.text, lit: t.lines[t.i]?.box || null, painting: !$('#kept').hidden } : null; },
  // the room: the night around the paper and how it feels; the camera; what is alive in the painting
  get scene() { const st = $('#stage'); return { dreaming: st.classList.contains('dreaming'), telling: st.classList.contains('telling'), sky: !!(sky && sky.on), mood: sky ? sky.mood : null, shot: state.shot, alive: life ? life.alive : null, parts: life ? life.count : 0 }; },
  // "Previously in…", as it opens last time's story
  get previously() { const el = $('#previously'); return el.hidden ? null : { kicker: el.querySelector('.kicker').textContent, title: el.querySelector('.title').textContent, night: el.querySelector('.night').textContent, reel: [...el.querySelectorAll('figcaption')].map((x) => x.textContent) }; },
  // the cards that flew in for what the last night kept; the ones on screen now
  get collected() { return { last: state.collected || null, showing: [...document.querySelectorAll('#collected .card .name')].map((x) => x.textContent) }; },
  get atlas() { const A = state.atlas; return A && { id: A.id, title: $('#atlas h2') ? $('#atlas h2').textContent : null, about: $('#atlas header p') ? $('#atlas header p').textContent : null, things: (A.cards || []).map((c) => c.name), i: A.i, card: $('#atlas .side .name') ? $('#atlas .side .name').textContent : null, pictures: [...A.art.values()].filter(Boolean).length, real: [...A.art.values()].filter((a) => a && a.real).length, made: [...A.art.values()].filter((a) => a && a.sprite).length, inTheirWords: [...A.art.values()].filter((a) => a && a.sprite && ruleOfSign(a.sprite.sign)).length, came: A.came || 0, composed: !!(A.night && A.night.composed), making: A.night ? A.night.state.things.filter((t) => t.making).length : 0, hops: A.night ? Object.fromEntries(A.night.state.things.map((t) => [t.id, t.hops])) : {}, nodes: A.map ? A.map.nodes.map((n) => ({ name: n.name, x: n.x, y: n.y, r: n.r })) : [], actions: shownActions(A).map((a) => a.text), all: worldActions(A).map((a) => a.text), k: A.look ? A.look.k : A.forget ? A.forget.k : A.said ? A.said.k : A.wonder ? A.wonder.k : A.k, said: A.said ? { name: A.said.name, question: A.said.question } : null, rule: ((A.cards || [])[A.i] || {}).rule || null, quiet: document.body.classList.contains('quiet'), visiting: (A.cards || []).filter((c) => c.visit).map((c) => c.name), where: whereOf(A, (A.cards || [])[A.i]) }; },
  get about() { return state.about || null; },
  // for the tests: how long their world is left alone before its words fade (ms; Infinity: never)
  set quietAfter(ms) { QUIET = ms; },
  // walking through their world: where the eye is, what it has gone to, what the caption says, what is heard
  get walk() { const A = state.atlas, W = A && A.walk; if (!W) return null; const c = $('#atlas .walk-caption'); return { ...A.night.state.walk, gone: W.at, leaving: W.leaving, hearing: W.hearing ? { i: W.hearing.i, n: W.hearing.told.length } : null, caption: c.hidden ? null : { kicker: c.querySelector('.kicker').textContent, name: c.querySelector('.name').textContent, line: c.querySelector('.line').textContent } }; },
  // stepping inside the painting: what stands, the walk, the thing gone to
  get inside() { return inside && inside.state; },
  get insideProbe() { return inside && inside.probe(); },
  // Dream it real: the picture on the paper; what a night kept of it; how things look in their world
  // it comes alive: this night's clip, and whether it is playing over the picture
  get realWalk() { const o = state.offer, w = o && painter && nightOfOffer(o) != null ? walks.get(aliveAt(painter, nightOfOffer(o))) : null; return { status: w ? w.status : null, open: state.mode === 'realwalk', ...(walker ? walker.state : {}) }; },
  get alive() { const v = $('#alive'), o = state.offer, a = o && painter && o.night != null ? alives.get(aliveAt(painter, o.night)) : null; return { status: a ? a.status : null, shown: v.classList.contains('shown'), playing: !v.paused && !v.ended && !!v.getAttribute('src'), time: Math.round(v.currentTime * 10) / 10, plays: state.aliveShown || 0 }; },
  // a choice's picture: the thing of their world it names, drawn as light (or null)
  pictureOf(choice) { const t = world && painter ? namedIn(choice, [...cardsOf(world.toJSON()), ...visitorCards(painter)]) : null; return t ? pictureOfThing(painter, t).then((u) => (u ? { name: t.name, src: u.slice(0, 22) } : null)) : Promise.resolve(null); },
  get pictured() { return [...document.querySelectorAll('#feel .chip.pictured')].map((c) => c.textContent); },
  canPlay,
  keptAlive(n) { return paintings ? paintings.get(n).then((p) => (p && p.alive ? { type: p.alive.type, size: p.alive.size } : null)) : Promise.resolve(null); },
  keptWorld(n) { return paintings ? paintings.get(n).then((p) => (p && p.world && p.world.file ? { id: p.world.id, type: p.world.type, size: p.world.file.size } : null)) : Promise.resolve(null); },
  get real() { const img = $('#real'), R = state.real; return { shown: img.classList.contains('shown'), src: (img.getAttribute('src') || '').slice(0, 22), night: !!(R && R.session && R.session.woke && img.getAttribute('src') === R.session.woke.image), waiting: !!(R && !R.made), want: !!(R && R.want), alive: (R && R.made && R.made.alive) || null }; },
  keptReal(n) { return paintings ? paintings.get(n).then((p) => (p && p.real ? p.real.slice(0, 23) : null)) : Promise.resolve(null); },
  keptPicture(n) { return paintings ? paintings.get(n).then((p) => (p ? { real: p.real ? p.real.length : 0, wide: p.wide ? p.wide.slice(0, 23) : null } : null)) : Promise.resolve(null); },
  get wide() { const W = state.wide, T = state.real && state.real.made; return { open: state.mode === 'wide', x: W ? Math.round(W.x * 1000) / 1000 : null, status: T && T.wide ? T.wide.status : null, shown: !$('#wide').hidden }; },
  get versions() { const R = state.real; return R && R.takes ? { n: R.takes.length, k: R.k, looks: R.takes.map((t) => t.look), again: !!R.again, src: (R.made.image || '').length } : null; },
  get looks() { return world ? world.toJSON().entities.filter((e) => e.look).map((e) => ({ name: e.name, look: e.look })) : []; },
  get gallery() { const G = state.gallery; return G && { shown: G.shown, i: G.i, n: G.items.length, caption: $('#gallery .caption .world').textContent, title: $('#gallery .caption .title').textContent, alive: G.lives.some((l) => l.alive), look: G.look || null }; },
  inkAt(x, y, r) { return ink && ink.inkAt ? ink.inkAt(x, y, r) : null; },
  colorAt(x, y, r) { return ink && ink.colorAt ? ink.colorAt(x, y, r) : null; },
  replayRate(r) { replayRate = Math.max(0.1, Math.min(1, Number(r) || 1)); },
  place(x, y, heading) {
    if (!brush || brush.touching) return false;
    brush.x = x; brush.y = y;
    if (heading != null) brush.heading = brush.trail = heading;
    return true;
  },
};

boot().catch((err) => {
  $('#loading').textContent = `Couldn’t open the paper: ${err.message}`;
  console.error(err);
});
