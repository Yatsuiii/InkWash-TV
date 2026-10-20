// The guide (the storyteller, on screen): what the TV says while you paint, and how it tells the
// dream back at the end.
//
// It always knows what the brush did: pressed in, ran dry, pooled, changed ink. From that alone
// it's a painting teacher, and it says so plainly: it doesn't pretend to see the picture. With a
// connection to the guide service (ai.js), it also looks: after you pause, it says one short
// thing about what's on the paper, and at the end it tells the dream, line by line, pointing at
// the part of the painting each line is about, along the feeling line they marked as it came
// back, from their own words and their dream world. Without the service, that line is told
// plainly, still theirs. Pure, apart from the clock and the calls it's given: `say(text, audio)`
// shows (and plays) a line; `ai` is the service, or null; `onRemark(text)` hears each remark
// (for the phone, which shows the guide's questions).
import { readLine, compileBeats, shapeOf, plainTelling } from './engine/personal/arc.mjs';
import { toSecondPerson } from './engine/dreams/ground.mjs';

export const COACH = {
  start: 'Draw something into your world: a place, someone who lives there, or something that happens. Press OK to start drawing.',
  firstStroke: 'Hold ▼ to press harder: the line grows bright and wide. ▲ eases it to a fine thread.',
  pool: 'Stay pressed, and the light keeps spreading.',
  dry: 'The line is running thin, so it breaks up. OK fills it again.',
  light: 'Soft light: for mist, for far hills, for things half remembered.',
  water: 'Water. Lay it beside a fresh line and watch the line bloom into it.',
  tryLight: 'Try soft light with « for what is far away.',
  indigo: 'Blue: for the night sky, deep water, things far away.',
  gold: 'Gold: for whatever shines in your world.',
  cinnabar: 'Red, the colour of your seal: for what matters most.',
  tellAI: 'When it is there, press ▶‖ and I will tell it back to you as a story.',
  tellOffline: 'When it is there, press ▶‖ to sign it with your seal.',
  idle: 'Take your time. Press OK when you are ready.',
};
// the same, for a child, who hears each read aloud: plain words, nothing to take the wrong way
export const COACH_YOUNG = {
  ...COACH,
  start: 'Draw something from your world: a place, someone in it, or something that happens. Press OK to start drawing.',
  firstStroke: 'Hold ▼ to press hard, and the line gets big and bright. Hold ▲ to make it thin.',
  pool: 'Keep pressing, and the light spreads out like a puddle.',
  dry: 'Your line is running out, so it breaks up. Press OK to fill it again.',
  light: 'Soft light is pale: for mist, and for things far away.',
  water: 'Water: put it next to a fresh line, and watch the line spread into it.',
  tryLight: 'Try soft light with « for things far away.',
  indigo: 'Blue: for the night sky and the sea.',
  gold: 'Gold: for anything that shines.',
  cinnabar: 'Red, like your seal: for what matters most.',
  tellAI: 'When it is there, press ▶‖ and I will tell it back to you as a story.',
  tellOffline: 'When it is there, press ▶‖ to sign it with your seal.',
};

export const PACE = {
  gap: 7, // seconds between two things said
  pauseForRemark: 3, // seconds of stillness after a stroke before the guide looks
  remarkEvery: 14, // seconds between two remarks at most... at least
  idle: 25, // seconds without a stroke before a gentle nudge
};

export function createGuide({ say, ai = null, now = () => performance.now() / 1000, pace = {}, onRemark = () => {}, young = false } = {}) {
  const PACE_ = { ...PACE, ...pace }, TIPS = young ? COACH_YOUNG : COACH;
  const said = new Set();
  const history = []; // what the guide has said, so it doesn't repeat itself
  let lastSaid = -1e9, strokes = 0, lastEnd = 0, lastRemark = -1e9, lastActivity = now(), asking = false;
  let painting = false, inks = new Set(['dense']), awaitingLook = false;

  function speak(text, audio = null, force = false) {
    if (!text) return false;
    if (!force && now() - lastSaid < PACE_.gap) return false;
    lastSaid = now();
    history.push(text);
    if (history.length > 12) history.shift();
    say(text, audio);
    return true;
  }
  // a coaching line, once per session
  function coach(key, force = false) {
    if (said.has(key)) return false;
    if (speak(TIPS[key], null, force)) { said.add(key); return true; }
    return false;
  }

  return {
    get remarks() { return history.slice(); },
    get online() { return !!ai; },
    event(type, data) {
      lastActivity = now();
      switch (type) {
        // `data`: the welcome back, on a night after the first
        case 'start': if (data) { said.add('start'); speak(`${data} ${TIPS.start}`, null, true); } else coach('start', true); break;
        // to the paper from their world: how to begin, or (`data`) what they chose to paint
        case 'paint': said.add('start'); speak(data || TIPS.start, null, true); break;
        case 'down': painting = true; awaitingLook = false; break;
        case 'end':
          painting = false; strokes++; lastEnd = now(); awaitingLook = true;
          if (strokes === 1) coach('firstStroke');
          else if (strokes === 6 && !inks.has('light')) coach('tryLight');
          else if (strokes === 9) coach(ai ? 'tellAI' : 'tellOffline');
          break;
        case 'dry': coach('dry'); break;
        case 'pool': coach('pool'); break;
        case 'ink': inks.add(data); if (TIPS[data] && data !== 'dense') coach(data); break;
        case 'undo': strokes = Math.max(0, strokes - 1); break;
        // a fresh sheet
        case 'clean': strokes = 0; painting = false; awaitingLook = false; break;
        // a telling began, or ended (`data`: what the night kept, said once it ends). The guide
        // doesn't remark on a painting it has just told.
        case 'told': awaitingLook = false; lastRemark = now(); if (data) speak(data, null, true); break;
        default: break;
      }
    },
    // once a frame. `look()` gives what the guide service needs to see the painting (or a promise
    // of it): { image, strokes }, and what they have said on their phone ({ words, known, phone });
    // it's only called when the guide is about to look.
    tick(look) {
      const t = now();
      if (!painting && strokes === 0 && t - lastActivity > PACE_.idle) { lastActivity = t; speak(COACH.idle); }
      if (!ai || asking || painting || !awaitingLook || strokes < 2) return;
      if (t - lastEnd < PACE_.pauseForRemark || t - lastRemark < PACE_.remarkEvery || t - lastSaid < PACE_.gap) return;
      awaitingLook = false;
      asking = true;
      lastRemark = t;
      Promise.resolve(look())
        .then((seen) => ai.remark({ ...seen, said: history.slice(-6) }))
        .then((r) => { if (r && r.say) { const text = String(r.say).slice(0, 240); speak(text, r.audio || null, true); onRemark(text); } })
        .catch(() => {})
        .finally(() => { asking = false; });
    },
    // what the mark at the turn could be: three readings from the service, or null
    async readings(seen) {
      if (!ai || !ai.readings) return null;
      const r = await ai.readings(seen);
      return r && Array.isArray(r.readings) ? r.readings.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 40)).slice(0, 3) : null;
    },
    // the dream told back: { title, lines: [{ text, box, strokes, v, a, audio }], shape, diff }.
    // `seen` carries the feeling line (or one word), their answer at its turn, their words and
    // tonight's slice of their dream world. Without the service, or if it fails: their line told
    // plainly (and nothing proposed for their world but what they named), or, with no line, a
    // plain signing.
    async tell(seen) {
      if (ai) {
        try {
          const r = await ai.tell(seen);
          const lines = (r && Array.isArray(r.lines) ? r.lines : []).filter((l) => l && l.text).slice(0, 12)
            .map((l) => ({
              text: String(l.text).slice(0, 300), box: Array.isArray(l.box) && l.box.length === 4 ? l.box.map(Number) : null, audio: l.audio || null,
              strokes: Array.isArray(l.strokes) ? l.strokes.map(Number).filter(Number.isFinite) : null, v: Number.isFinite(l.v) ? l.v : null, a: Number.isFinite(l.a) ? l.a : null,
            }));
          if (lines.length) return { title: String(r.title || 'Untitled').slice(0, 80), lines, told: true, felt: r.felt || null, shape: r.shape || null, diff: r.diff && typeof r.diff === 'object' ? r.diff : {}, followed: r.followed || null };
        } catch { /* told plainly below */ }
      }
      const f = seen && seen.feeling;
      if (f && f.moved && Array.isArray(f.byStroke) && Array.isArray(seen.strokes) && seen.strokes.length) {
        const line = readLine({ byStroke: f.byStroke, arousal: f.arousal || [], strokes: seen.strokes });
        const beats = compileBeats({ strokes: seen.strokes, line, pinned: seen.pinned || null });
        const shape = shapeOf(beats.map((b) => b.v), { moved: line.moved, stirs: beats.map((b) => b.a) });
        const plain = plainTelling({ beats, shape });
        return {
          title: plain.title,
          // their words, said to them: "I found it" is "you found it"
          lines: plain.lines.map((l, i) => ({ text: toSecondPerson(l.text), box: l.box, audio: null, strokes: beats[i].strokes, v: beats[i].v, a: beats[i].a })),
          told: false, shape: shape.id, diff: {},
        };
      }
      return {
        title: 'Untold',
        lines: [{ text: ai ? 'I couldn’t reach the storyteller just now, so this one stays yours alone. Signed and sealed.' : 'Signed and sealed. Connect the storyteller, and it will tell what you draw back to you as stories.', box: null, audio: null }],
        told: false,
      };
    },
  };
}
