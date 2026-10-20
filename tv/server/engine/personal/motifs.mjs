// Copied from inkwash/engine/personal/motifs.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// The images a telling is made of: its content words, with the common ways of saying the same
// image folded together (moonlight, moonlit and crescent are all the moon). Used to see how alike
// two tellings are, and what everyone's tellings keep reaching for. Things, not qualities: "the
// small pale boat" is a boat (and colours stay: a red kite is its own image).
import { STOP, stem } from '../text.mjs';

// words that carry no image of their own
const PLAIN = new Set(('dream dreams dreamed dreamt dreaming something someone somebody nothing anything everything thing things way ways time times moment moments '
  + 'came come comes coming went go goes going gone began begin begins felt feel feels feeling looked look looks looking saw see sees seeing seen knew know knows '
  + 'said say says told tell tells like back still just even almost again already always never ever only very much more most less little long last first next '
  + 'other another same each every both few many some one two three four once twice side part kind sort enough there here where when then than while '
  + 'into onto upon over under above below behind beside between through across along around toward towards away down out off near far '
  + 'made make makes making took take takes taking gave give gives giving kept keep keeps found find finds stood stand stands sat sit sits held hold holds '
  + 'turned turn turns waited wait waits walked walk walks left leave leaves stayed stay stays seemed seem seems became become becomes could would should might '
  + 'your yours you their they them his her its our we were was are is be been being had has have having did does done not no yes '
  + 'got get gets let lets put puts new old big ran run sat lay lie hid led met own yet now too why how who all any can may '
  // nobody and somewhere, though and until: not things
  + 'nobody somebody anybody everybody everyone anyone somewhere anywhere everywhere nowhere itself themselves yourself myself ourselves '
  + 'though although because until unless whether within against beyond beneath inside outside among past since during instead together apart '
  + 'slowly quickly softly gently quietly nearly barely simply really quite rather perhaps maybe somehow suddenly finally later soon ago tonight today tomorrow yesterday '
  // where on the paper, how big, how near: not things either
  + 'place places piece pieces shape shapes middle centre center top bottom end edge front '
  + 'small tiny large huge whole half full single certain real true sure able different right good bad great '
  + 'move moves moved moving reach reaches reached reaching closer nearer further farther distance distant '
  // how something is, rather than what it is: the feeling shapes these, and should
  + 'dim pale faint bright soft quiet slow warm cold empty alone lonely gentle tender calm strange heavy').split(' '));

// the same image, said differently
const SAME = {
  moon: 'moon moonlight moonlit crescent', star: 'star stars starlight starry', lamp: 'lamp lamps lantern lanterns candle candles lamplight torch',
  river: 'river rivers stream streams brook creek', sea: 'sea seas ocean wave waves shore shores tide beach harbour harbor surf', lake: 'lake lakes pond ponds',
  rain: 'rain rains raining rained drizzle', snow: 'snow snowing snowed snowfall', mist: 'mist misty fog foggy haze hazy', cloud: 'cloud clouds cloudy',
  house: 'house houses home homes cottage hut', room: 'room rooms hall hallway corridor', door: 'door doors doorway gate gates', window: 'window windows',
  stairs: 'stair stairs staircase steps step ladder', bridge: 'bridge bridges', road: 'road roads path paths lane lanes track tracks street streets',
  tree: 'tree trees forest forests wood woods pine pines willow willows branch branches', mountain: 'mountain mountains hill hills peak peaks cliff cliffs ridge',
  bird: 'bird birds owl owls crow crows heron herons crane cranes gull gulls', boat: 'boat boats ship ships raft ferry', train: 'train trains railway station',
  mother: 'mother mothers mum mom grandmother grandma', father: 'father fathers dad grandfather grandpa', child: 'child children girl girls boy boys daughter son',
  town: 'village villages town towns city cities', garden: 'garden gardens flower flowers blossom blossoms', fire: 'fire fires flame flames ember embers',
  shadow: 'shadow shadows', letter: 'letter letters message messages note notes', voice: 'voice voices song songs singing hum humming',
  night: 'night nights midnight dark darkness', light: 'light lights glow glowing', key: 'key keys', mirror: 'mirror mirrors', bell: 'bell bells',
};
const CANON = new Map();
for (const [k, v] of Object.entries(SAME)) for (const w of v.split(' ')) CANON.set(w, k);

// faintly, silently, lovely: how, not what (a butterfly and a family are still things)
const manner = (w) => w.length > 5 && w.endsWith('ly') && !w.endsWith('fly') && !['family', 'assembly', 'anomaly', 'melancholy'].includes(w);

export function motifs(text) {
  const out = new Set();
  for (const w of String(text || '').toLowerCase().match(/[a-z]+/g) || []) {
    if (CANON.has(w)) { out.add(CANON.get(w)); continue; }
    if (w.length < 3 || STOP.has(w) || PLAIN.has(w) || manner(w)) continue;
    const s = stem(w);
    if (PLAIN.has(s)) continue;
    out.add(CANON.get(s) || s);
  }
  return out;
}

// how alike two sets are: shared over all (0: nothing shared, 1: the same)
export function jaccard(a, b) {
  const A = a instanceof Set ? a : new Set(a), B = b instanceof Set ? b : new Set(b);
  if (!A.size && !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
}

// a whole telling's images: its title and lines
export const tellingMotifs = (t) => motifs([t.title, ...(t.lines || []).map((l) => l.text)].join(' '));
