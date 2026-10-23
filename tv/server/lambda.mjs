// The guide service on AWS Lambda, behind a function URL. Claude looks at the painting: through
// Anthropic's own API when GUIDE_ANTHROPIC_KEY is set (an AWS account Bedrock isn't open to yet),
// or on Amazon Bedrock (the Anthropic SDK's AnthropicBedrockMantle client). Amazon Polly speaks, and
// Google's Gemini image models make a told painting real (gemini.mjs), since AWS retired Amazon Nova
// Canvas on 30 September 2026; with no Gemini key, a Nova Canvas-shaped model on Bedrock still can.
//
// Configuration, all optional, from the function's environment:
//   GUIDE_ANTHROPIC_KEY an Anthropic API key: Claude through Anthropic's API, not Bedrock (the
//                       model IDs below are then read without their `anthropic.` prefix)
//   GUIDE_REMARK_MODEL  default anthropic.claude-haiku-4-5
//   GUIDE_WORLD_MODEL   default anthropic.claude-haiku-4-5: the Worldbuilder, which asks about
//                       their world between paintings (worldbuilder.mjs)
//   GUIDE_ILLUSTRATE_MODEL  default anthropic.claude-haiku-4-5: the Illustrator, which writes
//                       the scene a told painting is made real from (illustrator.mjs)
//   GUIDE_TELL_MODEL    default anthropic.claude-opus-5-5: the guide's agent, which tells the
//                       dream (falls back to the remark model if this account can't use it yet)
//   GUIDE_EFFORT        how hard the agent thinks: low, medium (the default) or high
//   GUIDE_VOICE         Polly voice, default Ruth
//   GUIDE_ENGINE        Polly engine, default neural
//   GUIDE_REAL          off: make no pictures (Dream it real); the TV keeps the ink
//   GUIDE_GEMINI_KEY    a Gemini API key (Google AI Studio): pictures are made by Gemini
//   GUIDE_GEMINI_MODEL  which Gemini image model first; without it, gemini.mjs's order
//   GUIDE_PICTURE_PRICE what one picture is counted at in the day's spending, in dollars
//   GUIDE_REAL_MODEL    without a Gemini key, the Bedrock image model that paints them
//   GUIDE_REAL_REGION   where it is called, default AWS_REGION (it is not in every region)
//   GUIDE_REAL_PER_DAY  the most pictures a day, default 60; a few cents each (budget.mjs)
//   GUIDE_CUTOUT        'tv' to have the TV cut each thing out of its white, not Nova Canvas
//   GUIDE_ALIVE_BUCKET  an S3 bucket for clips (it comes alive: reel.mjs); without it, no clips.
//                       Each is let go a day after it is made (the bucket's lifecycle rule)
//   GUIDE_ALIVE_MODEL   default amazon.nova-reel-v1:0, the video model that sets a picture moving
//   GUIDE_ALIVE_REGION  where it is called, default us-east-1 (it is not in every region; the
//                       bucket must be in the same one)
//   GUIDE_ALIVE_PER_DAY the most clips a day, default 6; about 50 cents each
//   GUIDE_WORLDLABS_KEY a World Labs API key (walk inside: marble.mjs); without it, no worlds
//   GUIDE_WORLDS_PER_DAY the most worlds a day, default 10; about 20 cents each
//   GUIDE_KEY           if set, every call from the TV must carry it in an x-inkwash-key header
//                       (the phone's page and its two calls carry the pairing code instead)
//   GUIDE_SPEND_PER_DAY the most the guide may spend in a day, in dollars, default 10: then the TV
//                       tells offline until tomorrow (limits.mjs)
//   GUIDE_CALLS_PER_CALLER  how many paid calls one address may make in ten minutes, default 150
//   GUIDE_CONTACT       where people can write, shown on /privacy
//   GUIDE_AI_OPT_OUT    yes: this AWS account has opted out of AWS using Polly's input to improve
//                       Polly (an AI services opt-out policy), and /privacy says so
//   GUIDE_COMMONS_TABLE    a DynamoDB table for the commons (the images everyone's tellings use,
//                          counts only) and for pairings with a phone (their words, until the TV
//                          has them); without it, each copy of the guide keeps its own
//   GUIDE_COMMONS_SALT     the salt images are hashed with in the commons; keep it secret
// AWS_REGION is set by Lambda; Claude on Bedrock and Polly are called in that region, and a Bedrock
// image model too unless GUIDE_REAL_REGION says otherwise.
import { timingSafeEqual } from 'node:crypto';
import { handle, MODELS } from './guide.mjs';
import { REAL } from './illustrator.mjs';
import { REEL } from './reel.mjs';
import { worldLabs } from './marble.mjs';
import { geminiPaint } from './gemini.mjs';
import { memoryBudget, dynamoBudget } from './budget.mjs';
import { memoryCommons, dynamoCommons } from './commons-store.mjs';
import { memorySessions, dynamoSessions, PHONE_PAGE, PHONE_HEADERS } from './phone.mjs';
import { memorySpend, dynamoSpend, callerLimits, metered } from './limits.mjs';
import { createOnce } from './once.mjs';
import { privacyPage, PRIVACY_HEADERS } from './privacy.mjs';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-inkwash-key',
  'access-control-max-age': '600',
};
// what the phone may call without the TV's key: its page, and saying and listening by code
const PHONE_CALLS = new Set(['/words', '/asked']);
// what costs money: a model, a voice or a picture
const PAID = new Set(['/remark', '/readings', '/tell', '/agent', '/wonder', '/real', '/speak', '/scene', '/backdrop', '/compose', '/thing', '/wide', '/alive', '/world']);
// pictures by Gemini: a key is set, and pictures aren't off
const byGemini = () => process.env.GUIDE_REAL !== 'off' && !!process.env.GUIDE_GEMINI_KEY;
// Claude through Anthropic's own API: a key is set
const byAnthropic = () => !!process.env.GUIDE_ANTHROPIC_KEY;
// a model as Anthropic's API names it: Bedrock's ID without its `anthropic.` (or region) prefix
export const bareModel = (m) => String(m || '').replace(/^(?:(?:global|us|eu|apac|jp|au)\.)?anthropic\./, '');
// How long one call to Claude may take, and whether it is made again, so the guide answers within
// the function's 120 s (the SDK alone would wait ten minutes and try twice more). The most capable
// model is asked once: if it fails, the fast one stands in for it (guide.mjs) in the time left.
// The fast one answers in seconds, so it gets a second go.
export const callLimits = (model) => (/opus/.test(String(model || '')) ? { timeout: 80_000, maxRetries: 0 } : { timeout: 20_000, maxRetries: 1 });
// a Messages API client that asks within those limits, by `name` for the model (as it was given)
export const withLimits = (client, name = (m) => m) => ({
  messages: { create: (params, opts) => client.messages.create({ ...params, model: name(params && params.model) }, { ...callLimits(params && params.model), ...opts }) },
});
// one that is given Bedrock's model IDs and asks with Anthropic's
export const withBareModels = (client) => withLimits(client, bareModel);
const count = (v, fallback) => (/^\d+(\.\d+)?$/.test(v || '') ? Number(v) : fallback);

let clients = null;
async function realClients() {
  if (clients) return clients;
  const { PollyClient, SynthesizeSpeechCommand } = await import('@aws-sdk/client-polly');
  const region = process.env.AWS_REGION;
  let claude;
  if (byAnthropic()) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    claude = withBareModels(new Anthropic({ apiKey: process.env.GUIDE_ANTHROPIC_KEY }));
  } else {
    const { AnthropicBedrockMantle } = await import('@anthropic-ai/bedrock-sdk');
    claude = withLimits(new AnthropicBedrockMantle({ awsRegion: region }));
  }
  const polly = new PollyClient({ region });
  // a line is spoken as SSML when the guide gives it (slower and softer where the dream was
  // heavier); if Polly refuses the SSML, plainly
  const say = async (Text, TextType) => {
    const out = await polly.send(new SynthesizeSpeechCommand({
      Text, TextType, OutputFormat: 'mp3', VoiceId: process.env.GUIDE_VOICE || 'Ruth', Engine: process.env.GUIDE_ENGINE || 'neural',
    }));
    return Buffer.from(await out.AudioStream.transformToByteArray()).toString('base64');
  };
  const speak = async (text, { ssml = null } = {}) => {
    if (ssml) { try { return await say(ssml, 'ssml'); } catch (err) { console.log(`Polly refused the SSML (${err.name}); speaking plainly`); } }
    return say(text, 'text');
  };
  // Dream it real: given a Nova Canvas request body, one picture back (base64): from Gemini, or
  // from a Bedrock model that takes Nova Canvas's requests
  let paint = null;
  if (byGemini()) {
    paint = geminiPaint({ key: process.env.GUIDE_GEMINI_KEY, model: process.env.GUIDE_GEMINI_MODEL || null, log: (m) => console.log(m) });
  } else if (process.env.GUIDE_REAL !== 'off') {
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const canvas = new BedrockRuntimeClient({ region: process.env.GUIDE_REAL_REGION || region });
    paint = async (body) => {
      // what Gemini is told the picture is for, and the picture of their world it is painted in the
      // look of (gemini.mjs), are not Nova Canvas's to read
      const { intent, styleImage, ...nova } = body || {};
      const out = await canvas.send(new InvokeModelCommand({ modelId: process.env.GUIDE_REAL_MODEL || REAL.model, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(nova) }));
      const json = JSON.parse(new TextDecoder().decode(out.body));
      if (json.error) throw new Error(json.error);
      return json.images && json.images[0];
    };
  }
  // It comes alive: Nova Reel writes each clip to the clips bucket, and the TV is given a link to
  // it for ten minutes once it is made
  let reel = null;
  if (process.env.GUIDE_ALIVE_BUCKET && process.env.GUIDE_ALIVE !== 'off') {
    const { BedrockRuntimeClient, StartAsyncInvokeCommand, GetAsyncInvokeCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const { S3Client, ListObjectsV2Command, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const at = process.env.GUIDE_ALIVE_REGION || 'us-east-1', bucket = process.env.GUIDE_ALIVE_BUCKET;
    const bedrock = new BedrockRuntimeClient({ region: at }), s3 = new S3Client({ region: at });
    reel = {
      type: REEL.type,
      async start(modelInput) {
        const out = await bedrock.send(new StartAsyncInvokeCommand({ modelId: process.env.GUIDE_ALIVE_MODEL || REEL.model, modelInput, outputDataConfig: { s3OutputDataConfig: { s3Uri: `s3://${bucket}/clips` } } }));
        return { job: out.invocationArn };
      },
      async check(job) {
        const out = await bedrock.send(new GetAsyncInvokeCommand({ invocationArn: job }));
        if (out.status !== 'Completed') return { status: out.status, why: out.failureMessage || '' };
        // the clip, wherever under this job's own folder Reel put it (named by the job's id), and
        // never anywhere else in the bucket: another TV's clips are there too
        const uri = (out.outputDataConfig && out.outputDataConfig.s3OutputDataConfig && out.outputDataConfig.s3OutputDataConfig.s3Uri) || '';
        const prefix = clipFolder(uri, bucket, job);
        if (!prefix) return { status: 'Failed', why: 'the clip is not where it should be' };
        const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
        const clip = (listed.Contents || []).find((o) => /\.mp4$/.test(o.Key));
        if (!clip) return { status: 'Failed', why: 'no clip in the bucket' };
        return { status: 'Completed', url: await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: clip.Key }), { expiresIn: 600 }) };
      },
    };
  }
  // Walk inside: World Labs builds the picture into a world, on this guide's own key
  const marble = process.env.GUIDE_WORLDLABS_KEY && process.env.GUIDE_WORLDS !== 'off' ? worldLabs({ key: process.env.GUIDE_WORLDLABS_KEY }) : null;
  const perDay = /^\d+$/.test(process.env.GUIDE_REAL_PER_DAY || '') ? Number(process.env.GUIDE_REAL_PER_DAY) : 60;
  const clipsPerDay = /^\d+$/.test(process.env.GUIDE_ALIVE_PER_DAY || '') ? Number(process.env.GUIDE_ALIVE_PER_DAY) : 6;
  const worldsPerDay = /^\d+$/.test(process.env.GUIDE_WORLDS_PER_DAY || '') ? Number(process.env.GUIDE_WORLDS_PER_DAY) : 10;
  const spendPerDay = count(process.env.GUIDE_SPEND_PER_DAY, 10);
  let commons = memoryCommons({ salt: process.env.GUIDE_COMMONS_SALT || undefined }), sessions = memorySessions(), budget = memoryBudget({ perDay }), clips = memoryBudget({ perDay: clipsPerDay }), worlds = memoryBudget({ perDay: worldsPerDay });
  let spend = memorySpend({ perDay: spendPerDay });
  if (process.env.GUIDE_COMMONS_TABLE) {
    const { DynamoDBClient, QueryCommand, UpdateItemCommand, GetItemCommand, PutItemCommand, DeleteItemCommand } = await import('@aws-sdk/client-dynamodb');
    const client = new DynamoDBClient({ region }), table = process.env.GUIDE_COMMONS_TABLE;
    commons = dynamoCommons({ client, table, commands: { QueryCommand, UpdateItemCommand }, salt: process.env.GUIDE_COMMONS_SALT || undefined });
    sessions = dynamoSessions({ client, table, commands: { GetItemCommand, PutItemCommand, UpdateItemCommand, QueryCommand, DeleteItemCommand } });
    budget = dynamoBudget({ client, table, commands: { UpdateItemCommand }, perDay });
    clips = dynamoBudget({ client, table, commands: { UpdateItemCommand }, perDay: clipsPerDay, kind: 'alive' });
    worlds = dynamoBudget({ client, table, commands: { UpdateItemCommand }, perDay: worldsPerDay, kind: 'world' });
    spend = dynamoSpend({ client, table, commands: { GetItemCommand, UpdateItemCommand }, perDay: spendPerDay });
  }
  // every call to Bedrock and Polly priced and counted, and none once the day's spending is reached
  const price = Number(process.env.GUIDE_PICTURE_PRICE);
  const paid = metered({ claude, speak, paint, reel, marble }, { spend, log: (m) => console.log(m), ...(price > 0 ? { picture: price } : {}) });
  clients = { ...paid, commons, sessions, budget, clips, worlds, spend, callers: callerLimits({ paid: count(process.env.GUIDE_CALLS_PER_CALLER, 150) }) };
  return clients;
}

// `deps` replaces the real clients (for the tests); `spend` and `callers` (limits.mjs) are left
// out there unless a test is about them.
export function createHandler(deps = null) {
  // the same paid request, asked again, is answered with what it was the first time (once.mjs)
  const once = createOnce();
  return async (event) => {
    // whatever goes wrong, the caller hears only that it did: the details go to the log
    try {
      return await answer(event, deps, once);
    } catch (err) {
      console.log(`guide error: ${err.name || 'Error'}: ${err.message}`);
      return reply(502, { error: 'the guide could not be reached' });
    }
  };
}

async function answer(event, deps, once) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'POST';
  const path = event.rawPath || event.path || '/';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  // the phone's page: the code it is for stays in the address, read on the phone
  if (method === 'GET' && path === '/phone') return { statusCode: 200, headers: PHONE_HEADERS, body: PHONE_PAGE };
  if (method === 'GET' && path === '/privacy') return { statusCode: 200, headers: PRIVACY_HEADERS, body: privacyPage({ contact: process.env.GUIDE_CONTACT || '', optedOut: process.env.GUIDE_AI_OPT_OUT === 'yes', models: byAnthropic() ? 'anthropic' : 'bedrock', pictures: byGemini() ? 'gemini' : process.env.GUIDE_REAL === 'off' ? 'off' : 'bedrock', clips: !!process.env.GUIDE_ALIVE_BUCKET && process.env.GUIDE_ALIVE !== 'off' }) };
  if (method === 'GET') return { statusCode: 404, headers: PRIVACY_HEADERS, body: NOT_HERE };
  if (method !== 'POST') return reply(405, { error: 'POST only' });
  const key = process.env.GUIDE_KEY;
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (key && !PHONE_CALLS.has(path) && !sameKey(headers['x-inkwash-key'], key)) return reply(403, { error: 'not this guide' });
  const { claude, speak, commons, sessions, paint = null, budget = null, reel = null, clips = null, marble = null, worlds = null, spend = null, callers = null } = deps || await realClients();
  // one caller can't spend the day alone, or try pairing codes until one fits
  const who = event.requestContext?.http?.sourceIp || 'unknown';
  if (callers && !callers.allow(who, PAID.has(path))) return reply(429, { error: 'too many calls: try again in a few minutes' });
  let body;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'expected JSON' });
  }
  const models = {
    remark: process.env.GUIDE_REMARK_MODEL || MODELS.remark, tell: process.env.GUIDE_TELL_MODEL || MODELS.tell,
    world: process.env.GUIDE_WORLD_MODEL || MODELS.world, illustrate: process.env.GUIDE_ILLUSTRATE_MODEL || MODELS.illustrate,
  };
  const effort = ['low', 'medium', 'high'].includes(process.env.GUIDE_EFFORT) ? process.env.GUIDE_EFFORT : 'medium';
  // a thing's white cut away by the image model, unless GUIDE_CUTOUT=tv says the TV cuts it
  // itself; Gemini can't cut a picture out of its white, so with it the TV does
  const cutout = process.env.GUIDE_CUTOUT !== 'tv' && !byGemini();
  const r = await once.run(path, body, async () => {
    // asked again, what was already made costs nothing: the day's spending is for what is new
    if (spend && PAID.has(path) && await spend.over()) {
      console.log(`the guide has told enough for today: $${spend.perDay} spent`); // the SpentAlarm's line
      return { status: 429, json: { error: 'the guide has told enough for today', today: true } };
    }
    return handle(path, body, { claude, speak, paint, budget, reel, clips, marble, worlds, models, effort, cutout, log: (m) => console.log(m), ...(commons ? { commons } : {}), ...(sessions ? { sessions } : {}) });
  });
  if (r.json && r.json.again) console.log(`asked again: ${path}, answered with what was made`);
  // a picture that can be walked into starts building as soon as it is offered, if this server says so
  if (path === '/real' && r.json && r.json.walk && process.env.GUIDE_WORLDS_AHEAD === 'on') r.json.ahead = true;
  return reply(r.status, r.json);
}

// the key, compared in the same time whatever it is
function sameKey(given, key) {
  const a = Buffer.from(String(given || '')), b = Buffer.from(String(key));
  return a.length === b.length && timingSafeEqual(a, b);
}

const NOT_HERE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Inkwash</title></head>'
  + '<body style="font:17px/1.5 Georgia,serif;max-width:32em;margin:0 auto;padding:40px 18px"><h1 style="font-size:1.4em">Nothing here</h1>'
  + '<p>This is the story server for Inkwash, a painting and storytelling app for Fire TV. Open Inkwash on your TV to paint. <a href="privacy">Privacy and terms</a>.</p></body></html>';

function reply(statusCode, json) {
  return { statusCode, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(json) };
}

export const handler = createHandler();

// Where one job's clip is, in the clips bucket: its own folder, named by the job's id, under where
// Reel was told to write (or as Reel reports it, if it reports the folder itself). Null if what
// Reel reports is not in the bucket.
export function clipFolder(uri, bucket, job) {
  const id = String(job || '').split('/').pop();
  const at = `s3://${bucket}/`;
  const u = String(uri || '').replace(/\/*$/, '/');
  if (!id || !u.startsWith(at)) return null;
  const prefix = u.slice(at.length).replace(/\/*$/, '');
  return prefix.split('/').includes(id) ? `${prefix}/` : `${prefix ? `${prefix}/` : ''}${id}/`;
}
