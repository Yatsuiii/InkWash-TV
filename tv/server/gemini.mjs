// Pictures from Google's Gemini image models (Nano Banana), in place of Amazon Nova Canvas, which
// AWS retired on 30 September 2026. The guide asks for every picture as a Nova Canvas request body
// (illustrator.mjs, scenery.mjs, wide.mjs); `geminiPaint` reads that body and asks Gemini for the
// same picture, so nothing else changes: a drawing made real over its own lines, a thing alone on
// white, a thing made again from its last picture, a place, a panorama. Gemini can't cut a picture
// out of its white, so with it the TV does that itself (lambda.mjs). The request and the answer
// follow the Gemini API's REST mapping (generateContent, with pictures as inline data).
//
// `geminiPaint({ key })` returns `paint(body)`: one picture, base64, or an error whose message says
// "blocked" when Google's filter turned it down (the callers' isBlocked reads that).

export const GEMINI = {
  base: 'https://generativelanguage.googleapis.com/v1beta',
  // the best first, then the rest in turn if this key doesn't have it
  models: ['gemini-3-pro-image-preview', 'gemini-3-pro-image', 'gemini-3.1-flash-image-preview', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image'],
  // within the TV's 90 seconds for a picture (ai.js), with the Illustrator's turn before it
  timeout: 70_000,
  // the shapes Gemini paints in
  ratios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
  text: 4000,
};

// the shape nearest a width and height, of those Gemini paints in
export function ratioOf(width, height) {
  const want = Number(width) / Number(height);
  if (!(want > 0) || !Number.isFinite(want)) return '16:9';
  let best = GEMINI.ratios[0], gap = Infinity;
  for (const r of GEMINI.ratios) {
    const [a, b] = r.split(':').map(Number), g = Math.abs(Math.log(want / (a / b)));
    if (g < gap) { gap = g; best = r; }
  }
  return best;
}

const avoid = (negative) => (negative ? `Leave out: ${negative}.` : '');
const join = (...parts) => parts.filter(Boolean).join('\n\n').slice(0, GEMINI.text);
// the image's own type, from its first bytes
const mimeOf = (b64) => (String(b64 || '').startsWith('/9j/') ? 'image/jpeg' : 'image/png');

// Nova Canvas's request, as one for Gemini: what to say, which pictures go with it, and in what shape
export function geminiRequest(nova) {
  const n = nova || {}, cfg = n.imageGenerationConfig || {};
  const seed = Number.isInteger(cfg.seed) ? cfg.seed : undefined;
  // the shape asked for, as near as Gemini paints (outpainting keeps the sheet's, so at its widest)
  const ratio = cfg.width && cfg.height ? ratioOf(cfg.width, cfg.height) : null;
  if (n.taskType === 'TEXT_IMAGE') {
    const p = n.textToImageParams || {};
    if (p.conditionImage) {
      return {
        images: [p.conditionImage],
        prompt: join(
          'This is a rough drawing. Make it into a finished picture of what it shows.',
          'The drawing is the layout: keep where everything is, how big it is, its shape, and the horizon. Replace the drawing’s lines and flat colours entirely: no outlines, no scribbles, no text, no labels, no borders.',
          p.text, avoid(p.negativeText)),
        ratio,
        seed,
      };
    }
    return { images: [], prompt: join(p.text, avoid(p.negativeText)), ratio: ratio || '16:9', seed };
  }
  if (n.taskType === 'IMAGE_VARIATION') {
    const p = n.imageVariationParams || {};
    return {
      images: (p.images || []).slice(0, 1),
      prompt: join('Paint this same thing again, so it is clearly the very same one, as it is described now.', p.text, avoid(p.negativeText)),
      ratio,
      seed,
    };
  }
  if (n.taskType === 'OUTPAINTING') {
    const p = n.outPaintingParams || {};
    return {
      images: [p.image],
      prompt: join(
        'The middle of this wide picture is a finished picture of a place. Its left and right sides are only its own edges mirrored, a rough guide.',
        'Paint the whole wide view: keep the middle exactly as it is, and repaint both sides as more of the same place, going on to either side seamlessly, in the same light and the same look. No seams, no text, no borders.',
        p.text, avoid(p.negativeText)),
      ratio: '21:9',
      seed,
    };
  }
  // BACKGROUND_REMOVAL, and anything else: Gemini can't
  return null;
}

// the request body, as the Gemini API takes it
export function geminiBody({ images = [], prompt, ratio = null, seed }) {
  return {
    contents: [{ role: 'user', parts: [{ text: prompt }, ...images.map((data) => ({ inlineData: { mimeType: mimeOf(data), data } }))] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      ...(seed !== undefined ? { seed } : {}),
      ...(ratio ? { imageConfig: { aspectRatio: ratio } } : {}),
    },
  };
}

// its answer: the picture, base64; or why there isn't one ("blocked" when Google's filter said no)
export function readPicture(json) {
  const cand = ((json && json.candidates) || [])[0];
  for (const p of (cand && cand.content && cand.content.parts) || []) {
    const d = p.inlineData || p.inline_data;
    if (d && d.data) return d.data;
  }
  const reason = (json && json.promptFeedback && json.promptFeedback.blockReason) || (cand && cand.finishReason) || '';
  if (/SAFETY|PROHIBITED|BLOCK|IMAGE_SAFETY|RECITATION/i.test(reason)) throw new Error(`blocked by Gemini's content filter (${reason})`);
  throw new Error(reason ? `no picture came back (${reason})` : 'no picture came back');
}

// a model this key doesn't have: the next one is tried
const missing = (status, message) => status === 404 || (status === 400 && /not found|not supported|unsupported model|does not exist/i.test(message));

export function geminiPaint({ key, model = null, fetch: f = globalThis.fetch, log = () => {} }) {
  const order = [...new Set([model, ...GEMINI.models].filter(Boolean))];
  let found = null; // the model that answered, once one has
  async function ask(name, body) {
    const res = await f(`${GEMINI.base}/models/${name}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GEMINI.timeout),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok) {
      const message = String((json && json.error && (json.error.message || json.error.status)) || text || res.statusText).slice(0, 300);
      const err = new Error(`Gemini said ${res.status}: ${message}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }
  return async function paint(nova) {
    const r = geminiRequest(nova);
    if (!r) throw new Error(`Gemini can't do ${(nova && nova.taskType) || 'that'}`);
    const body = geminiBody(r);
    for (const name of found ? [found] : order) {
      try {
        const picture = readPicture(await ask(name, body));
        found = name;
        return picture;
      } catch (err) {
        if (!found && err.status && missing(err.status, err.message)) { log(`pictures: ${name} isn't open to this key; trying the next`); continue; }
        throw err;
      }
    }
    throw new Error('none of the Gemini image models is open to this key');
  };
}
