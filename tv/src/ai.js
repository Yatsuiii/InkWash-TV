// The guide service, as the TV calls it: a small HTTPS API (server/ in this folder) that looks at
// the painting with Claude and speaks with Amazon Polly. All POST with JSON:
//
//   /remark    { image, strokes, said, words?, known?, phone? }  ->  { say, audio? }
//   /readings  { image, strokes, n, avoid? }  ->  { readings: [three things mark n could be] }
//   /tell      { image, strokes, feeling?, pinned?, words?, world?, felt?, session?, seed? }
//              ->  { title, lines: [{ text, box, strokes, v, a, audio? }], shape, says, followed, diff }
//   /agent     { messages }  ->  { content, stop_reason, model }: one turn of the guide's loop
//              (agent.js), the TV carrying out its tools (harness.js)
//   /speak     { text, rate?, volume?, pause? }  ->  { audio }: a line of the telling, voiced
//   /wonder    { brief, young }  ->  { about, name, question, choices: [{ say, fact }] }: the
//              Worldbuilder's question about their world (server/worldbuilder.mjs)
//   /real      { image, brief, young, look, seed }  ->  { image, scene, looks } (or { off } or
//              { blocked }): the Illustrator makes a told painting real (server/illustrator.mjs)
//   /scene     { brief, young }  ->  { scene }: where their world stands, written when its story
//              starts (server/scenery.mjs, engine/dreams/scene.mjs)
//   /backdrop  { scene, image, young, seed }  ->  { image } (or { off } or { blocked }): the place
//              painted from its scene, held to the TV's drawing of it (`image`)
//   /thing     { image, name, look, rule, place, young, seed, width, height, reference }  ->  { image,
//              cut } (or { off } or { blocked }): one thing of their world painted on its own, on
//              white, from its strokes, as they said it looks (`rule`), or made again from the
//              picture it had (`reference`); cut out of its white by Nova Canvas if `cut`
//   /world     { image, scene, name, young }  ->  { job } (or { off } or { blocked }): the night's
//              picture built into a world to walk through, by World Labs; then /world/check { job }
//              ->  { waiting } until it is built, then { world: { id, splat, scale } }; and
//              /world/file { id, splat }  ->  { file (base64), type }: the file it walks through
//   /alive     { image, scene, young, seed }  ->  { job } (or { off } or { blocked }): the night's
//              picture made real, set moving by Nova Reel, six seconds; then /alive/check { job }
//              ->  { waiting } until it is made, then { video }: a link to fetch it from
//   /pair      {}  ->  { code, expires }: the phone opens <guide>/phone?c=CODE
//   /heard     { code, since, ask?, end? }  ->  { words: [{ i, text }], next, phone }
//
// `image` is the painting as a JPEG data URL; `strokes` is brush.js's summarize(); `said` is what
// the guide said lately. `audio` is MP3 as base64. `box` is [x0, y0, x1, y1] in paper units
// (1600 by 1000), the part of the painting a line is about.
// - `feeling` is the feeling line they marked as the painting came back (feel.js): `byStroke`,
//   lighter (+1) to heavier (-1) at each stroke, `arousal`, calm (-1) to stirred (+1), and `line`;
// - `pinned` is their answer at its turn: { n, said, why, entity } (said is null when they left
//   it a mystery; entity, when it was something from their dream world);
// - `words` is what they said on their phone as they painted, with the stroke ({ n, text });
// - `world` is tonight's slice of their dream world (world.js), which is kept on the TV; `diff`
//   is what the night may add to it, kept by their reactions;
// - `felt` is one word, when they gave that instead of a line; `session` is how the painting
//   went (wash-outs, ink changes, time).

export function createAI({ endpoint, key = null, fetchImpl = (...a) => fetch(...a), timeout = 25000 } = {}) {
  if (!endpoint) return null;
  const base = String(endpoint).replace(/\/+$/, '');
  async function post(path, body, ms = timeout) {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
    try {
      const headers = { 'content-type': 'application/json', ...(key ? { 'x-inkwash-key': key } : {}) };
      const res = await fetchImpl(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined });
      if (!res.ok) throw new Error(`guide service: ${res.status}`);
      return await res.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return {
    endpoint: base,
    remark: (seen) => post('/remark', seen),
    // asked while the person waits on the question: a short wait, then the TV's own readings
    readings: (seen) => post('/readings', seen, 6000),
    tell: (seen) => post('/tell', seen, 60000),
    // a little longer than the service's own limit (120 s), so its error arrives first
    agent: (body) => post('/agent', body, 125000),
    speak: (body) => post('/speak', body, 15000),
    wonder: (body) => post('/wonder', body, 20000),
    // the Illustrator, then an image model: a picture takes a while
    real: (body) => post('/real', body, 90000),
    // all around it: the picture made real widened to either side (server/wide.mjs; a while)
    wide: (body) => post('/wide', body, 90000),
    scene: (body) => post('/scene', body, 30000),
    // the place painted from it, over the TV's own drawing of it (an image model: a while)
    backdrop: (body) => post('/backdrop', body, 90000),
    thing: (body) => post('/thing', body, 90000),
    // it comes alive: asked for, then looked in on until it is made (server/reel.mjs)
    alive: (body) => post('/alive', body, 30000),
    aliveCheck: (job) => post('/alive/check', { job }, 15000),
    // walk inside: a world built from the picture, asked for, looked in on until it is built, and
    // its file fetched through the guide (server/marble.mjs)
    world: (body) => post('/world', body, 30000),
    worldCheck: (job) => post('/world/check', { job }, 15000),
    worldFile: (body) => post('/world/file', body, 60000),
    pair: () => post('/pair', {}, 8000),
    heard: (body) => post('/heard', body, 8000),
  };
}

// Where the guide service is: `?guide=` in the address (for testing), or what the packaged app
// was built with. The service can ask for a key (GUIDE_KEY in server/lambda.mjs); the app is
// built with it as INKWASH_GUIDE_KEY.
export function guideKey() {
  return (typeof window !== 'undefined' && window.INKWASH_GUIDE_KEY) || null;
}

export function guideEndpoint() {
  try {
    const q = new URLSearchParams(location.search).get('guide');
    if (q) return q;
  } catch { /* no address */ }
  return (typeof window !== 'undefined' && window.INKWASH_GUIDE_URL) || null;
}
