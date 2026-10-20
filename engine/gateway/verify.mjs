// Reading a model's answer: JSON, with or without a code fence or a sentence around it.
export function parseJSON(text) {
  const s = String(text || '').trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : s;
  const first = Math.min(...['{', '['].map((c) => body.indexOf(c)).filter((i) => i >= 0));
  if (!Number.isFinite(first)) throw new Error('no JSON object');
  const close = body[first] === '{' ? '}' : ']';
  const last = body.lastIndexOf(close);
  if (last < first) throw new Error('unterminated JSON');
  return JSON.parse(body.slice(first, last + 1));
}
