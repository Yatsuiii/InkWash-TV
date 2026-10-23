// Their world's map (main.js openMap): their world seen from above, as a hand-inked atlas drawn
// by the studio's atlas (atlas.js: rippled coasts, hatched hills, rivers, woods, a title cartouche,
// a compass and ships). A world is one place, the one its home and its pictures show (a moonlit
// lake, the moon's grey plain): the map's land is that place, named for it, and each thing of
// theirs stands on it where it stands in their world (left and right as there, the far ones to the
// north), with the mark a map gives such a thing (a castle a fortress, a ferry a port, a lantern a
// tower). The same world always draws the same map. A thing chosen and OK: the map grows round it
// until it is their world, there.
import { InkAtlas } from './atlas.js';

// where the map sits on the screen (it is drawn 1600 x 1000), how far it grows into a place, how big
// its marks are, and where on it their world's things stand (the part of the map their sheet is laid on)
export const MAP = { x: 40, y: 80, k: 0.9, zoom: 3.4, big: 2.3, land: [260, 230, 1340, 800] };

// what a place's land is like, from its ground
const GROUND = { water: 'grassland', grass: 'grassland', snow: 'tundra', sand: 'desert', stone: 'highlands', clouds: 'steppe', boards: 'forest', tiles: 'grassland' };
// the mark a map gives a thing, from what it is called
const MARKS = [
  [/castle|palace|fort|keep|citadel/, 'fortress'], [/tower|lighthouse|rocket|lantern|spire|beacon/, 'tower'],
  [/ferry|boat|ship|pier|harbou?r|port|dock|jetty|wharf/, 'port'], [/temple|shrine|church|chapel/, 'temple'],
  [/city|town/, 'town'], [/house|home|cottage|hut|village|inn/, 'village'], [/ruin|wreck/, 'ruin'],
  [/cave|mine/, 'mine'], [/camp|tent/, 'camp'],
];
export const markOf = (name) => { const n = String(name || '').toLowerCase(); const hit = MARKS.find(([re]) => re.test(n)); return hit ? hit[1] : 'landmark'; };
const SMALL = new Set(['a', 'an', 'the', 'of', 'on', 'in', 'at', 'to', 'and', 'by', 'with']);
export const titleOf = (s) => String(s || '').split(/\s+/).filter(Boolean).map((w, i) => (i && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
const bare = (s) => String(s || '').toLowerCase().replace(/^(the|a|an|my|our) /, '').trim();

// Their world's place, named as a map would name it, from the words its scene was written with
// ("A moonlit lake ringed by low hills" is The Moonlit Lake); without a scene, the TV's night on the lake
const STOP = /^(with|by|under|where|in|on|at|ringed|lit|beneath|below|above|full|that|which|and|from|across|surrounded|filled|covered|over|near|beside|between|among|whose|as|while|glowing|lined|dotted|scattered)$/i;
export function placeNameOf(scene) {
  const text = String((scene && scene.place) || '').trim();
  if (!text) return 'The Lake at Night';
  const words = text.replace(/[.;:,!?—–-].*$/, '').split(/\s+/).filter(Boolean), cut = [];
  for (const w of words) { if (cut.length && STOP.test(w)) break; cut.push(w); }
  const name = cut.join(' ').replace(/^(a|an|the)\s+/i, '');
  return name && name.split(' ').length <= 5 ? titleOf(`the ${name}`) : 'Their World';
}

// The atlas's spec for their world: `things` ({ id, name, kind, xy }: theirs, not visitors, where
// each first came on their 1600 x 1000 sheet), `scene` (their world's place), `seed`
export function atlasSpec({ title, chapters = 1, things = [], scene = null, seed = 1 } = {}) {
  const place = placeNameOf(scene), core = bare(place);
  const ground = scene && scene.ground ? scene.ground.kind : null;
  // a place of theirs that is the world's own place is the land itself, not a mark on it
  const isLand = (t) => t.kind === 'place' && bare(t.name).length > 2 && core.includes(bare(t.name));
  const land = things.find(isLand) || null;
  const [x0, y0, x1, y1] = MAP.land;
  const marks = things.filter((t) => t !== land).map((t) => {
    const kind = markOf(t.name), [sx, sy] = t.xy || [800, 500];
    return { id: `t-${t.id}`, name: titleOf(t.name), kind, region: 'world', near: kind === 'port' || ground === 'water' ? 'coast' : 'any', entity: t.id, xy: [Math.round(x0 + (sx / 1600) * (x1 - x0)), Math.round(y0 + (sy / 1000) * (y1 - y0))] };
  });
  return {
    seed: Math.max(1, Math.round(seed)), title: titleOf(title), subtitle: `the map of your story, ${chapters} ${chapters === 1 ? 'chapter' : 'chapters'} long`,
    // a world on water is a shore round it; else one land
    shape: ground === 'water' || (!scene && things.some((t) => markOf(t.name) === 'port')) ? 'inland-sea' : 'continent', climate: 'temperate', accent: '#a8572e',
    regions: [{ id: 'world', name: place, biome: GROUND[ground] || 'grassland', at: 'center', size: 'large', relief: 'hills', entity: land ? land.id : null }],
    places: marks, seas: [], features: [],
  };
}

// The map drawn: its picture (an SVG), and where each of their things is on it, west to east (the
// world's own place, if it is one of theirs, where its name is written across the land)
export function drawAtlas(spec, { id = 'tv' } = {}) {
  const { s, places } = InkAtlas.layout(spec);
  const spots = places.filter((p) => p.entity).map((p) => ({ id: p.entity, name: p.name, kind: p.kind, x: Math.round(p.x), y: Math.round(p.y), area: false }));
  // its marks and names large enough to read across a room
  const svg = InkAtlas.paint(spec, { id, big: MAP.big });
  const land = s.regions[0] && s.regions[0].entity;
  if (land) {
    const m = /<text class="lbl l1 atlas-region-name" x="([\d.]+)" y="([\d.]+)"/.exec(svg);
    spots.push({ id: land, name: s.regions[0].name, x: m ? Math.round(Number(m[1])) : InkAtlas.W / 2, y: m ? Math.round(Number(m[2])) - 10 : InkAtlas.H / 2, area: true });
  }
  spots.sort((a, b) => a.x - b.x);
  return { svg, spots, W: InkAtlas.W, H: InkAtlas.H };
}

// what the map is of: drawn again only when this changes
export const mapSign = (spec) => JSON.stringify([spec.seed, spec.title, spec.shape, spec.regions.map((r) => [r.name, r.biome, r.entity]), spec.places.map((p) => [p.entity, p.name, p.xy])]);

// a place on the map, on the screen
export const onScreen = (spot) => ({ x: Math.round(MAP.x + spot.x * MAP.k), y: Math.round(MAP.y + spot.y * MAP.k) });

// The map growing round one place until it is their world: where the zoom is centred, and how far
export function zoomInto(spot, { zoom = MAP.zoom } = {}) {
  const at = onScreen(spot);
  return { origin: `${at.x}px ${at.y}px`, scale: zoom };
}
