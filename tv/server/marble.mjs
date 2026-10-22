// Walk inside. A night's picture made real (illustrator.mjs) can be built into a world they walk
// through on the TV: World Labs' Marble builds a 3D world from the picture and the scene the
// Illustrator wrote for it, as soft coloured points (Gaussian splats). A world takes a minute or
// more to build, so it is asked for and then looked in on, like a clip (reel.mjs). Once it is
// built, the TV is handed its lighter file (about a hundred thousand splats, which a TV can draw)
// through here, so the TV only ever talks to its own guide. The world stays on World Labs, private
// to this guide's account; the TV keeps its id with the night. Nothing of it is kept here.
//
// Counted with the day's spending (limits.mjs) and by its own count a day (GUIDE_WORLDS_PER_DAY,
// budget.mjs), and only ever asked for when someone chooses to walk inside. A child's is gentle.
//
// `marble.start(body)` resolves World Labs' operation; `marble.poll(id)` the operation, with the
// world once it is done; `marble.fetch(url)` a world file's bytes. lambda.mjs makes them from the
// World Labs API (the requests as the Dream Canvas, an earlier prototype, sent them);
// dev.mjs and the tests stand in for them (standInMarble). Without `marble`, there are no worlds.
import { BadRequest } from './errors.mjs';
import { sizeOf } from './reel.mjs';

export const MARBLE = {
  api: 'https://api.worldlabs.ai/marble/v1',
  model: 'marble-1.0-draft', // the quick world: a minute or so, about 20 cents
  image: 2_000_000, // the picture as base64, at most
  prompt: 2000, // the longest text it takes
  splats: 150_000, // the most a TV is given to draw
  file: 4_400_000, // the most a file can be to come through here (base64 under the 6 MB a reply can be)
};
const GENTLE = 'Gentle, friendly and calm, for a young child.';
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// What the TV sends: the night's picture made real (a JPEG or PNG data URL); the scene the
// Illustrator wrote for it; what the night is called; whether a child painted it.
export function checkWorld(body) {
  if (!body || typeof body !== 'object') throw new BadRequest('expected a JSON object');
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
  if (!m) throw new BadRequest('image must be a JPEG or PNG data URL');
  if (m[2].length > MARBLE.image) throw new BadRequest('image is too large');
  if (!sizeOf(Buffer.from(m[2], 'base64'))) throw new BadRequest('image must be a JPEG or PNG');
  return { image: m[2], ext: m[1] === 'jpeg' ? 'jpg' : 'png', scene: clean(body.scene, 1200), name: clean(body.name, 64), young: body.young === true };
}

// Marble's request: a world from the picture, with what it shows, private to this account
export function worldRequest({ image, ext = 'jpg', scene = '', name = '', young = false, model = MARBLE.model }) {
  const text = [scene, young ? GENTLE : ''].filter(Boolean).join(' ').slice(0, MARBLE.prompt);
  return {
    display_name: name || 'A world made real',
    model,
    permission: { public: false },
    tags: ['inkwash-tv'],
    world_prompt: { type: 'image', image_prompt: { source: 'data_base64', data_base64: image, extension: ext }, is_pano: 'auto', ...(text ? { text_prompt: text } : {}) },
  };
}

// Which of a world's splat files a TV draws: the largest no bigger than it can, or the smallest
// there is ("100k", "500k", "full_res")
export function pickSplat(urls, most = MARBLE.splats) {
  const size = (k) => { const m = /^(\d+(?:\.\d+)?)\s*([km]?)$/i.exec(k); return m ? Number(m[1]) * ({ k: 1e3, m: 1e6 }[m[2].toLowerCase()] || 1) : Infinity; };
  const all = Object.entries(urls || {}).filter(([, u]) => typeof u === 'string' && /^https:\/\//.test(u)).map(([key, url]) => ({ key, url, n: size(key) }));
  if (!all.length) return null;
  const fits = all.filter((x) => x.n <= most).sort((a, b) => b.n - a.n);
  return fits[0] || all.sort((a, b) => a.n - b.n)[0];
}

// What the TV is told of a world built: its id, the file it walks through (by its size's name),
// its panorama and picture, and where its ground is
export function worldOf(w) {
  const a = (w && w.assets) || {}, sm = (a.splats && a.splats.semantics_metadata) || {};
  const splat = pickSplat(a.splats && a.splats.spz_urls);
  return {
    id: String(w.world_id), splat: splat ? splat.key : null,
    pano: (a.imagery && a.imagery.pano_url) || null, thumbnail: a.thumbnail_url || null,
    scale: Number.isFinite(sm.metric_scale_factor) ? sm.metric_scale_factor : null,
    ground: Number.isFinite(sm.ground_plane_offset) ? sm.ground_plane_offset : null,
  };
}

// an operation and a world are named by World Labs' ids, and nothing else
const ID = /^[A-Za-z0-9_-]{6,128}$/;
const isBlocked = (why) => /content|moderat|safety|blocked|policy/i.test(String(why || ''));

// POST /world { image, scene?, name?, young? } -> { job } (looked in on with /world/check), or
// { off } (no worlds here, or { today } none left today), or { blocked }
export async function world(body, { marble = null, budget = null, log = () => {} }) {
  const r = checkWorld(body);
  if (!marble) return { status: 200, json: { off: true } };
  if (budget && !(await budget.take())) { log('walk inside: no worlds left today'); return { status: 200, json: { off: true, today: true } }; }
  try {
    const op = await marble.start(worldRequest(r));
    const job = String((op && op.operation_id) || '');
    if (!ID.test(job)) throw new Error('no operation came back');
    if (op.error) throw new Error(op.error.message || 'the world failed');
    return { status: 200, json: { job } };
  } catch (err) {
    if (!(err && err.status >= 400 && err.status < 500 && isBlocked(err.message))) throw err;
    log(`walk inside: turned down by World Labs (${String(err.message).slice(0, 120)})`);
    return { status: 200, json: { blocked: true } };
  }
}

// POST /world/check { job } -> { waiting } | { world: { id, splat, pano, thumbnail, scale, ground } }
// | { blocked } | { failed }
export async function worldCheck(body, { marble = null, log = () => {} }) {
  const job = String((body && body.job) || '');
  if (!ID.test(job)) throw new BadRequest('job must be what /world gave');
  if (!marble) return { status: 200, json: { off: true } };
  const op = await marble.poll(job);
  if (op && op.error) {
    const why = op.error.message || '';
    log(`walk inside: the world failed (${String(why).slice(0, 160)})`);
    return { status: 200, json: isBlocked(why) ? { blocked: true } : { failed: true } };
  }
  if (!op || !op.done) return { status: 200, json: { waiting: true } };
  // a finished operation names only part of its world: the world itself is read for the rest
  const id = op.response && op.response.world_id;
  const full = id ? await marble.world(id).catch(() => null) : null;
  const w = full && full.world_id ? worldOf(full) : id ? worldOf(op.response) : null;
  if (!w || !ID.test(w.id) || !w.splat) { log('walk inside: the world came back with nothing to walk through'); return { status: 200, json: { failed: true } }; }
  return { status: 200, json: { world: w } };
}

// POST /world/file { id, splat } -> { file: base64, type: 'spz' | 'ply' }: the world's file to walk
// through, read from World Labs' storage here (the TV never reaches it itself); { failed } if it
// can't be had, or is too big to come through
export async function worldFile(body, { marble = null, log = () => {} }) {
  const id = String((body && body.id) || ''), key = String((body && body.splat) || '');
  if (!ID.test(id)) throw new BadRequest('id must be what /world/check gave');
  if (!/^[a-z0-9_]{1,16}$/i.test(key)) throw new BadRequest('splat must be what /world/check gave');
  if (!marble) return { status: 200, json: { off: true } };
  const w = await marble.world(id);
  const url = w && w.assets && w.assets.splats && w.assets.splats.spz_urls && w.assets.splats.spz_urls[key];
  if (typeof url !== 'string' || !/^https:\/\//.test(url)) { log('walk inside: no such file in that world'); return { status: 200, json: { failed: true } }; }
  const bytes = await marble.fetch(url);
  const file = Buffer.from(bytes).toString('base64');
  if (file.length > MARBLE.file) { log(`walk inside: the world's file is too big to send (${bytes.length})`); return { status: 200, json: { failed: true, big: true } }; }
  return { status: 200, json: { file, type: /\.ply(\?|$)/i.test(url) ? 'ply' : 'spz' } };
}

// The World Labs API, for lambda.mjs: its key goes in a header, and errors carry their status
export function worldLabs({ key, fetch: f = globalThis.fetch, api = MARBLE.api }) {
  const headers = { 'WLT-Api-Key': key, 'content-type': 'application/json' };
  const call = async (url, init = {}) => {
    const res = await f(url, { ...init, headers });
    const text = await res.text();
    if (!res.ok) { const err = new Error(`World Labs ${res.status}: ${text.slice(0, 200)}`); err.status = res.status; throw err; }
    return JSON.parse(text);
  };
  return {
    start: (body) => call(`${api}/worlds:generate`, { method: 'POST', body: JSON.stringify(body) }),
    poll: (id) => call(`${api}/operations/${encodeURIComponent(id)}`),
    world: (id) => call(`${api}/worlds/${encodeURIComponent(id)}`).then((w) => (w && w.world_id ? w : w && w.world) || null),
    async fetch(url) {
      if (!/^https:\/\//.test(String(url))) throw new Error('a world file has no https link');
      const res = await f(url);
      if (!res.ok) throw new Error(`a world file: ${res.status}`);
      if (Number(res.headers.get('content-length')) > MARBLE.file) throw new Error('a world file too big to send');
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

// For the dev server and the tests: a world that is built on its second look, a small valley under
// a starry sky (`file`, a Gaussian-splat PLY in Marble's frame, y down and z ahead), no calls and no
// cost
export function standInMarble({ file = standInSplats(), ready = 2 } = {}) {
  const ops = new Map();
  let n = 0;
  const worldFor = (id) => ({ world_id: `world${id}`, display_name: 'A world made real', assets: { thumbnail_url: null, imagery: { pano_url: null }, splats: { spz_urls: { '100k': `https://stand-in.invalid/${id}/100k.ply`, '500k': `https://stand-in.invalid/${id}/500k.ply` }, semantics_metadata: { metric_scale_factor: 1, ground_plane_offset: 1.6 } } } });
  return {
    asked: [],
    async start(body) { this.asked.push(body); const id = `op${String(++n).padStart(6, '0')}`; ops.set(id, 0); return { operation_id: id, done: false }; },
    async poll(id) {
      if (!ops.has(id)) return { operation_id: id, done: true, error: { message: 'no such operation' } };
      const k = ops.get(id) + 1;
      ops.set(id, k);
      return k < ready ? { operation_id: id, done: false } : { operation_id: id, done: true, response: worldFor(id.slice(2)) };
    },
    async world(id) { return worldFor(String(id).replace(/^world/, '')); },
    async fetch() { return file; },
  };
}

// a small world to walk through: a valley floor, a ring of trees, a dome of sky with stars, as a
// standard Gaussian-splat PLY (as the Dream Canvas stands in for one)
export function standInSplats({ count = 24000, seed = 7 } = {}) {
  let t = seed >>> 0;
  const rand = () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  const SH = 0.28209479177387814, dc = (c) => (c - 0.5) / SH, logit = (a) => Math.log(a / (1 - a));
  const props = ['x', 'y', 'z', 'nx', 'ny', 'nz', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3'];
  const head = `ply\nformat binary_little_endian 1.0\nelement vertex ${count}\n${props.map((p) => `property float ${p}`).join('\n')}\nend_header\n`;
  const body = Buffer.alloc(count * props.length * 4);
  const hill = (x, z) => 0.9 * Math.sin(x * 0.35) * Math.cos(z * 0.28) + 0.5 * Math.sin(x * 0.9 + z * 0.6);
  for (let i = 0; i < count; i++) {
    let x, y, z, c, s;
    const k = rand();
    if (k < 0.62) {
      const r = 12 * Math.sqrt(rand()), a = rand() * Math.PI * 2;
      x = Math.cos(a) * r; z = Math.sin(a) * r; y = 1.6 - hill(x, z) * Math.min(1, r / 4);
      const g = 0.35 + 0.3 * rand();
      c = [0.18 + 0.2 * g, 0.38 + 0.3 * g, 0.2 + 0.1 * g]; s = 0.09;
    } else if (k < 0.74) {
      const a = rand() * Math.PI * 2, r = 6 + 4 * rand(), h = rand();
      x = Math.cos(a) * r; z = Math.sin(a) * r; y = 1.6 - hill(x, z) - h * 2.2;
      c = [0.08, 0.25 + 0.15 * rand(), 0.14]; s = 0.12;
    } else {
      const u = rand(), a = rand() * Math.PI * 2, el = Math.asin(u), R = 30;
      x = Math.cos(a) * Math.cos(el) * R; z = Math.sin(a) * Math.cos(el) * R; y = -Math.sin(el) * R + 1;
      const star = rand() < 0.03 && u > 0.3;
      c = star ? [1, 0.97, 0.85] : [0.95 - 0.7 * u, 0.55 - 0.3 * u, 0.45 + 0.1 * u]; s = star ? 0.08 : 0.9;
    }
    const v = [x, y, z, 0, 0, 0, dc(c[0]), dc(c[1]), dc(c[2]), logit(0.92), Math.log(s), Math.log(s), Math.log(s), 1, 0, 0, 0];
    for (let j = 0; j < v.length; j++) body.writeFloatLE(v[j], (i * props.length + j) * 4);
  }
  return Buffer.concat([Buffer.from(head, 'latin1'), body]);
}
