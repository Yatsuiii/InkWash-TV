// It comes alive. A painting made real (illustrator.mjs) can be set moving: six seconds of it, by
// Amazon Nova Reel on Amazon Bedrock, from the picture and the scene the Illustrator wrote for it.
// A clip takes a minute or more to make, so it is asked for and then looked in on: Reel writes it
// to the bucket kept for clips (lambda.mjs, GUIDE_ALIVE_BUCKET, where each is let go after a day),
// and once it is done the TV is given a link to fetch it from, good for ten minutes. The TV keeps
// the clip with the night's painting; nothing of it is kept here.
//
// Counted with the day's spending (limits.mjs) and by its own count a day (GUIDE_ALIVE_PER_DAY,
// budget.mjs), and only ever asked for when someone chooses to watch it come alive. A child's is
// gentle; one Reel's filter turns down leaves the picture still.
//
// `reel.start(modelInput)` resolves { job }, the invocation's ARN; `reel.check(job)` resolves
// { status: 'InProgress' | 'Completed' | 'Failed', url?, why? }; `reel.type` is the kind of video
// its clips are (REEL.type, unless it says otherwise). lambda.mjs makes them from Bedrock
// and S3; dev.mjs and the tests stand in for them (standInReel). Without `reel`, there are no clips.
import { BadRequest } from './guide.mjs';

export const REEL = {
  model: 'amazon.nova-reel-v1:0',
  width: 1280, height: 720, // the one size Reel takes and gives
  seconds: 6, fps: 24, // its one length and rate for a single shot
  text: 512, // the longest prompt it takes
  seeds: 2147483646,
  scene: 400, // of the Illustrator's scene, what is passed on
  image: 2_000_000, // the picture as base64, at most
  type: 'video/mp4', // what it gives: an MP4, so a TV that can't play one is never offered a clip
};
// how it moves: the picture as it is, coming softly to life, the camera barely moving
export const MOTION = 'The picture slowly comes to life, like a living storybook illustration: the camera drifts gently forward, light shimmers and glows, water ripples, leaves, grass and cloth sway in a soft breeze, and everything stays where it is.';
const GENTLE = 'Gentle, friendly and calm, for a young child.';
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// how big a JPEG or PNG is, from its bytes: [width, height], or null
export function sizeOf(bytes) {
  const b = bytes;
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    // a frame's start: its height, then its width
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

// What the TV sends: the night's picture made real, as Reel takes it (1280 x 720, a JPEG or PNG
// data URL); the scene the Illustrator wrote for it; whether a child painted it; a seed.
export function checkAlive(body) {
  if (!body || typeof body !== 'object') throw new BadRequest('expected a JSON object');
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
  if (!m) throw new BadRequest('image must be a JPEG or PNG data URL');
  if (m[2].length > REEL.image) throw new BadRequest('image is too large');
  const size = sizeOf(Buffer.from(m[2], 'base64'));
  if (!size || size[0] !== REEL.width || size[1] !== REEL.height) throw new BadRequest(`image must be ${REEL.width} x ${REEL.height}`);
  return {
    image: m[2], format: m[1], scene: clean(body.scene, REEL.scene), young: body.young === true,
    seed: Math.max(0, Math.min(REEL.seeds, Math.round(Number(body.seed) || 0))),
  };
}

// Reel's request: one shot, from the picture, moving as MOTION says, through what the scene shows
export function aliveRequest({ image, format = 'jpeg', scene = '', young = false, seed = 0 }) {
  const text = [MOTION, scene, young ? GENTLE : ''].filter(Boolean).join(' ').slice(0, REEL.text);
  return {
    taskType: 'TEXT_VIDEO',
    textToVideoParams: { text, images: [{ format, source: { bytes: image } }] },
    videoGenerationConfig: { durationSeconds: REEL.seconds, fps: REEL.fps, dimension: `${REEL.width}x${REEL.height}`, seed },
  };
}

const isBlocked = (why) => /content filter|blocked|responsible ai|moderat|filtered/i.test(String(why || ''));
// a job is the ARN of a Bedrock async invocation, and nothing else
const JOB = /^arn:aws[a-z-]*:bedrock:[a-z0-9-]+:\d{12}:async-invoke\/[a-z0-9]{6,64}$/;

// POST /alive { image, scene?, young?, seed? } -> { job } (looked in on with /alive/check), or
// { off } (no clips here, or { today } none left today), or { blocked }
export async function alive(body, { reel = null, budget = null, log = () => {} }) {
  const r = checkAlive(body);
  if (!reel) return { status: 200, json: { off: true } };
  if (budget && !(await budget.take())) { log('it comes alive: no clips left today'); return { status: 200, json: { off: true, today: true } }; }
  try {
    const { job } = await reel.start(aliveRequest(r));
    if (!JOB.test(String(job || ''))) throw new Error('no job came back');
    return { status: 200, json: { job } };
  } catch (err) {
    if (!isBlocked(err && err.message)) throw err;
    log(`it comes alive: turned down by Reel's filter (${String(err.message).slice(0, 120)})`);
    return { status: 200, json: { blocked: true } };
  }
}

// POST /alive/check { job } -> { waiting } | { video: a link to fetch it from } | { blocked } | { failed }
export async function aliveCheck(body, { reel = null, log = () => {} }) {
  const job = String((body && body.job) || '');
  if (!JOB.test(job)) throw new BadRequest('job must be what /alive gave');
  if (!reel) return { status: 200, json: { off: true } };
  const r = await reel.check(job);
  if (r.status === 'InProgress') return { status: 200, json: { waiting: true } };
  if (r.status === 'Completed' && r.url) return { status: 200, json: { video: r.url } };
  log(`it comes alive: ${r.status || 'no status'} (${String(r.why || '').slice(0, 160)})`);
  return { status: 200, json: isBlocked(r.why) ? { blocked: true } : { failed: true } };
}

// For the dev server and the tests: a clip that is ready on its third look, a few seconds of
// moving light (STANDIN_CLIP, a small WebM a browser can play), no calls and no cost
export function standInReel({ clip, ready = 3, type = 'video/webm' } = {}) {
  const seen = new Map();
  let n = 0;
  return {
    asked: [],
    type,
    async start(input) {
      this.asked.push(input);
      const job = `arn:aws:bedrock:us-east-1:000000000000:async-invoke/standin${String(++n).padStart(6, '0')}`;
      seen.set(job, 0);
      return { job };
    },
    async check(job) {
      if (!seen.has(job)) return { status: 'Failed', why: 'no such job' };
      const k = seen.get(job) + 1;
      seen.set(job, k);
      return k < ready ? { status: 'InProgress' } : { status: 'Completed', url: clip };
    },
  };
}
