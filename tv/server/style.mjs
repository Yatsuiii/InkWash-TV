// A picture of their world's place, sent with each picture asked for (a painting made real, a
// thing, their world's map) so the image model paints it by the same hand: its style, palette and
// light, and nothing else of it (gemini.mjs). Optional: a JPEG or PNG data URL. Bedrock's models
// don't take it, and it is left out for them (lambda.mjs).
import { BadRequest } from './errors.mjs';

export const STYLE = { most: 1_000_000 };

export function checkStyle(v) {
  if (v == null || v === '') return null;
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(v));
  if (!m) throw new BadRequest('style must be a JPEG or PNG data URL');
  if (m[2].length > STYLE.most) throw new BadRequest('style is too large');
  return m[2];
}

// a picture request with their world's picture to paint it in the look of
export const withStyle = (request, style) => (style && request ? { ...request, styleImage: style } : request);
