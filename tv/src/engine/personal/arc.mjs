// Copied from inkwash/engine/personal/arc.mjs by scripts/sync-personal.mjs. Edit it there, then sync.
// The feeling line: how a dream felt, moment by moment, as the person marked it themselves.
//
// On the TV ("Feel it again"), the painting comes back stroke by stroke, and they hold ▲ where
// the dream felt lighter, ▼ where it felt heavier, ▶ where it felt more stirred and ◀ where it
// felt calmer: a continuous self-report of feeling in two dimensions, the way emotion research
// measures it over time (the affect rating dial; FEELTRACE), turned into a remote. What comes
// back is their feeling at each stroke: valence, -1 (heavier) to +1 (lighter), and arousal, -1
// (calm) to +1 (stirred). Two dimensions tell fear (heavy, stirred) from grief (heavy, still).
//
// From it, the telling is built to follow them:
// - readLine: where the feeling turned, where it was lowest and highest, the dream's shape;
// - compileBeats: the parts of the telling, one line each, cut where *their* feeling changed,
//   each with its marks, its box and how it should feel;
// - arcBrief: the writer's instructions, part by part;
// - checkTelling: a reader who doesn't know the line rates each written line, and the telling
//   passes only if it follows the line (and turns, and ends, where they did); otherwise
//   rewriteNote says which lines to change;
// - voiceOf / ssml: the voice follows it too, slower and softer where it was heavier, with a
//   pause before the turn.
// Two people who painted the same night get different stories because they felt it differently,
// and the check makes that hold for every telling, not on average.

import { describe, whySays } from '../dreams/emotion.mjs';

const clamp = (x, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, x));
// how far apart two moments are, in feeling: valence counts most
const apart = (dv, da) => Math.hypot(dv, 0.7 * da);
const mean = (xs) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
const union = (boxes) => boxes.reduce((u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])], [Infinity, Infinity, -Infinity, -Infinity]);

// a feeling as words, for the writer (never to be said in the telling)
export const weightOf = (v) => (v >= 0.6 ? 'very light' : v >= 0.2 ? 'lighter' : v > -0.2 ? 'even' : v > -0.6 ? 'heavier' : 'very heavy');

// where they stayed longest: the stroke held still the longest, pooled the most, took the most time
function lingered(strokes) {
  let best = null, most = -1;
  for (const s of strokes) {
    const w = (s.still || 0) + 0.6 * (s.pools ? s.pools.length : 0) + (s.ms || 0) / 6000;
    if (w > most) { most = w; best = s.n; }
  }
  return best;
}

const SHAPES = {
  even: 'it held one feeling throughout',
  rise: 'it grew lighter',
  fall: 'it grew heavier',
  dip: 'it sank, then lifted',
  peak: 'it lifted, then sank',
  'wave-up': 'it lifted, sank, and lifted again',
  'wave-down': 'it sank, lifted, and sank again',
  // as heavy (or light) all through, but not as calm
  'stir-peak': 'it held its weight, but grew stirred, then settled',
  'stir-rise': 'it held its weight, and grew more and more stirred',
  'stir-fall': 'it held its weight, and settled as it went',
};

// The shape of a run of values: even, rising, falling, a dip, a peak, or a wave. When the weight
// holds but the stir moves (`stirs`), the shape is in the stir.
export function shapeOf(vs, { moved = true, stirs = null } = {}) {
  const range = vs.length ? Math.max(...vs) - Math.min(...vs) : 0;
  if (moved && vs.length >= 2 && range < 0.2 && Array.isArray(stirs) && stirs.length === vs.length && Math.max(...stirs) - Math.min(...stirs) >= 0.4) {
    const hi = stirs.indexOf(Math.max(...stirs)), first = stirs[0], last = stirs[stirs.length - 1];
    const id = hi > 0 && hi < stirs.length - 1 && stirs[hi] - first >= 0.3 && stirs[hi] - last >= 0.3 ? 'stir-peak' : last > first ? 'stir-rise' : 'stir-fall';
    return { id, says: SHAPES[id] };
  }
  if (!moved || vs.length < 2 || range < 0.2) return { id: 'even', says: SHAPES.even };
  const steps = [];
  for (let i = 1; i < vs.length; i++) { const d = vs[i] - vs[i - 1]; if (Math.abs(d) >= 0.15) steps.push(Math.sign(d)); }
  const turns = steps.filter((s, i) => i > 0 && s !== steps[i - 1]).length;
  const first = vs[0], last = vs[vs.length - 1];
  const lo = vs.indexOf(Math.min(...vs)), hi = vs.indexOf(Math.max(...vs));
  let id;
  if (turns >= 2) id = steps[0] > 0 ? 'wave-up' : 'wave-down';
  // a dip or a peak needs a real swing back, not a flicker
  else if (lo > 0 && lo < vs.length - 1 && first - vs[lo] >= 0.3 && last - vs[lo] >= 0.3) id = 'dip';
  else if (hi > 0 && hi < vs.length - 1 && vs[hi] - first >= 0.3 && vs[hi] - last >= 0.3) id = 'peak';
  else if (last - first >= 0.2) id = 'rise';
  else if (first - last >= 0.2) id = 'fall';
  else id = steps.length && steps[0] > 0 ? 'peak' : 'dip';
  return { id, says: SHAPES[id] };
}

// Their feeling, read: `byStroke` is the mean of the dial's lighter-heavier while each stroke came
// back, `arousal` its calm-stirred. `moved` is whether they marked anything at all. The turn is
// where it changed most, in either dimension.
export function readLine({ byStroke = [], arousal = [], strokes = [] }) {
  const values = strokes.map((s, i) => clamp(Number(byStroke[i]) || 0));
  const stirs = strokes.map((s, i) => clamp(Number(arousal[i]) || 0));
  const range = values.length ? Math.max(...values) - Math.min(...values) : 0;
  const stirRange = stirs.length ? Math.max(...stirs) - Math.min(...stirs) : 0;
  const moved = (range >= 0.12 && values.some((v) => Math.abs(v) >= 0.12)) || values.some((v) => Math.abs(v) >= 0.3)
    || stirRange >= 0.3 || stirs.some((a) => Math.abs(a) >= 0.3);
  let turn = null;
  if (moved) {
    for (let i = 1; i < values.length; i++) {
      const dv = values[i] - values[i - 1], da = stirs[i] - stirs[i - 1], d = apart(dv, da);
      if (d >= 0.15 && (!turn || d > turn.size)) turn = { n: strokes[i].n, from: values[i - 1], to: values[i], delta: dv, stir: da, size: d };
    }
  }
  const at = (v) => strokes[values.indexOf(v)]?.n ?? null;
  return {
    moved, values, stirs, turn,
    low: moved ? at(Math.min(...values)) : null,
    high: moved ? at(Math.max(...values)) : null,
    // the mark the telling turns on: where their feeling changed most, or else where they lingered
    focus: turn ? turn.n : lingered(strokes),
    mean: mean(values),
  };
}

// how a run of strokes was painted, against the brush's own pace (it cruises at 150 units a
// second; pressing slows it, easing off quickens it): restless (turning a lot), quick, or slow
function pace(strokes) {
  const ms = strokes.reduce((a, s) => a + (s.ms || 0), 0), len = strokes.reduce((a, s) => a + (s.length || 0), 0);
  if (!ms || !len) return null;
  const speed = len / (ms / 1000), turning = (strokes.reduce((a, s) => a + (s.turn || 0), 0) / Math.max(40, len)) * 100;
  if (turning > 1.6) return 'restless';
  if (speed > 230) return 'quick';
  if (speed < 110) return 'slow';
  return null;
}

// The parts of the telling, cut where their feeling changed (and where they paused before going
// on), always at the turn. Between 3 and 6 parts when there are enough strokes; one per stroke,
// and a closing part over the whole painting, when there aren't.
export function compileBeats({ strokes = [], line, pinned = null, minBeats = 3, maxBeats = 6 }) {
  const S = strokes.length;
  if (!S) return [];
  const v = line.values, a = line.stirs || strokes.map(() => 0);
  let groups;
  if (S < minBeats) {
    groups = strokes.map((_, i) => [i]);
  } else {
    const k = Math.max(minBeats, Math.min(maxBeats, Math.round(S / 2)));
    const turnAt = line.turn ? strokes.findIndex((s) => s.n === line.turn.n) : -1;
    const cuts = [];
    for (let i = 1; i < S; i++) {
      const gap = Math.min(1, (strokes[i].gap || 0) / 6);
      // their feeling's change counts most; a long pause a little; evenly spread parts break ties
      const even = 1 - Math.abs((i / S) * k - Math.round((i / S) * k));
      cuts.push({ i, score: apart(v[i] - v[i - 1], a[i] - a[i - 1]) * 2 + 0.25 * gap + 0.05 * even + (i === turnAt ? 10 : 0) });
    }
    const chosen = cuts.sort((a, b) => b.score - a.score).slice(0, k - 1).map((c) => c.i).sort((a, b) => a - b);
    groups = [];
    let start = 0;
    for (const c of [...chosen, S]) { groups.push(Array.from({ length: c - start }, (_, j) => start + j)); start = c; }
  }
  const beats = groups.map((g) => {
    const ss = g.map((i) => strokes[i]);
    return { strokes: ss.map((s) => s.n), box: union(ss.map((s) => s.box)), v: mean(g.map((i) => v[i])), a: mean(g.map((i) => a[i])), pace: pace(ss), roles: [], said: null, named: false };
  });
  if (S < minBeats) beats.push({ strokes: strokes.map((s) => s.n), box: union(strokes.map((s) => s.box)), v: v[S - 1], a: a[S - 1], pace: null, roles: [], said: null, named: false, whole: true });
  beats.forEach((b, i) => { b.delta = i ? b.v - beats[i - 1].v : 0; b.stirDelta = i ? b.a - beats[i - 1].a : 0; });
  beats[0].roles.push('opening');
  beats[beats.length - 1].roles.push('ending');
  if (line.moved) {
    const vs = beats.map((b) => b.v);
    const lo = vs.indexOf(Math.min(...vs)), hi = vs.indexOf(Math.max(...vs));
    if (vs[lo] <= -0.15) beats[lo].roles.push('lowest');
    if (vs[hi] >= 0.15) beats[hi].roles.push('highest');
  }
  const focus = beats.find((b) => !b.whole && b.strokes.includes(line.focus));
  if (focus) focus.roles.push(line.turn ? 'turn' : 'lingered');
  if (pinned && pinned.n != null) {
    const b = beats.find((x) => !x.whole && x.strokes.includes(pinned.n));
    if (b) { b.named = true; b.said = pinned.said ? String(pinned.said) : null; b.why = pinned.why || null; b.entity = pinned.entity || null; }
  }
  return beats;
}

const listMarks = (ns) => (ns.length === 1 ? `Mark ${ns[0]}` : ns.length === 2 ? `Marks ${ns[0]} and ${ns[1]}` : `Marks ${ns[0]} to ${ns[ns.length - 1]}`);

const quote = (t) => `"${String(t).replace(/"/g, "'")}"`;

// The writer's instructions: their line, part by part. A part may carry what they said while
// painting its marks (`heard`) and things from their dream world its marks look like (`known`),
// from dreams/brief.mjs attachTonight.
// `from` is where the feeling came from: their line ('line'), or, when they marked none, their one
// word ('said') or their marks ('marks', 'none'), held level through the telling.
export function arcBrief({ beats, shape, felt = null, marks = null, cliches = [], recent = [], named = [], from = 'line' }) {
  const out = [];
  const marked = beats.some((b) => Math.abs(b.a || 0) >= 0.2);
  if (from === 'line') out.push(`They watched their painting come back, part by part, and marked how each part of the dream felt: lighter or heavier${marked ? ', calmer or more stirred' : ''}. That is the dream's feeling, in their own hands. Tell it along that line. Overall, ${shape.says}.`);
  else out.push(`They didn't mark how each part of the dream felt${felt ? '' : ', or say'}: hold the whole telling at one feeling${felt ? ', theirs' : ', the one their marks suggest, lightly'}.`);
  if (felt) out.push(`In one word, they called the dream ${felt}.`);
  if (marks) out.push(`How they painted: ${marks}.`);
  out.push('', `Write exactly ${beats.length} lines, one for each part below, in this order. Each line is about that part's marks and carries that part's feeling, without naming the feeling.`);
  beats.forEach((b, i) => {
    // how it felt, as they marked it; how it was painted only where they didn't mark calm or stirred
    const how = [describe(b.v, marked ? b.a : 0), marked ? null : b.pace,
      i && b.delta >= 0.3 ? 'lifting' : i && b.delta <= -0.3 ? 'sinking' : null,
      i && marked && b.stirDelta >= 0.4 ? 'quickening' : i && marked && b.stirDelta <= -0.4 ? 'settling' : null].filter(Boolean).join(', ');
    const parts = [`${i + 1}. ${b.whole ? 'The whole painting' : listMarks(b.strokes)} (box ${JSON.stringify(b.box)}): ${how}.`];
    if (b.roles.includes('turn')) parts.push('Here their feeling turned the most: make this the heart of the dream.');
    else if (b.roles.includes('lingered')) parts.push('This is where they stayed longest: make it the heart of the dream.');
    if (b.named && b.said) parts.push(`They said this was ${b.said}${b.entity ? ', from their earlier dreams' : ''}. Use it, in their words.`);
    else if (b.named) parts.push("They chose to leave what this was a mystery: keep it unnamed, felt but not seen.");
    if (b.named && b.why && whySays(b.why)) parts.push(`Asked why it felt that way, they said: ${whySays(b.why)}. Let that happen in the line, without explaining it.`);
    if (b.heard && b.heard.length) parts.push(`As they painted these marks, they said: ${b.heard.map(quote).join(' / ')}. Build this line from their words.`);
    for (const k of (b.known || []).filter((x) => !b.named || x.name !== b.said)) parts.push(`Mark ${k.n} is shaped and placed like ${k.name}, from ${k.nights === 1 ? 'an earlier night' : `${k.nights} earlier nights`}: if the dream allows, it is ${k.name} again.`);
    if (b.roles.includes('opening') && i === 0) parts.push('The opening.');
    if (b.roles.includes('ending')) parts.push('The ending: end on this feeling.');
    out.push(parts.join(' '));
  });
  if (cliches.length) out.push('', `Many people's dreams lately are full of: ${cliches.join(', ')}. Use one only where a mark here clearly is that thing, or they named it.`);
  if (named.length) out.push(`In past dreams they have named: ${named.slice(0, 4).join('; ')}. If a mark here could be one of these, you may let it return, once.`);
  if (recent.length) out.push(`Their own recent dreams already had: ${recent.slice(0, 8).join(', ')}. Don't retell those.`);
  return out.join('\n');
}

// ---------------------------------------------------------------- checking a telling

const pearson = (a, b) => {
  const ma = mean(a), mb = mean(b);
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
};

// `ratings`: a blind reader's feel for each line, -2 (very heavy) to +2 (very light); `stirs`, if
// it gave them, -2 (very calm) to +2 (very stirred). The telling follows the line if its lines rise
// and fall with their marking (correlation), turn the same way at the turn, and end on the same
// side; and, where they marked calm and stirred, if its stir goes with theirs.
export function checkTelling({ ratings, stirs = null, beats, minAgree = 0.5, minStir = 0.3 }) {
  if (!Array.isArray(ratings) || ratings.length !== beats.length) return { ok: false, score: -1, reason: 'the reader gave no rating for every line', misses: [] };
  const want = beats.map((b) => b.v * 2), wantStir = beats.map((b) => (b.a || 0) * 2);
  const flat = Math.max(...want) - Math.min(...want) < 0.4;
  const misses = [];
  beats.forEach((b, i) => {
    const got = ratings[i], w = want[i];
    if (Math.abs(got - w) >= 1.5 || (Math.abs(w) >= 0.6 && Math.sign(got) === -Math.sign(w))) misses.push({ i, want: weightOf(b.v), got: got > 0 ? 'lighter' : got < 0 ? 'heavier' : 'even' });
    if (Array.isArray(stirs) && stirs.length === beats.length && Math.abs(stirs[i] - wantStir[i]) >= 2) {
      misses.push({ i, stir: true, want: (b.a || 0) > 0 ? 'stirred' : 'calm', got: stirs[i] > 0 ? 'stirred' : 'calm' });
    }
  });
  // calm and stirred: checked where they marked it, and it moved
  let stirAgree = null;
  if (Array.isArray(stirs) && stirs.length === beats.length && Math.max(...wantStir) - Math.min(...wantStir) >= 0.8) stirAgree = pearson(stirs, wantStir);
  const stirOk = stirAgree == null || stirAgree >= minStir;
  if (flat) {
    const ok = ratings.every((r) => Math.abs(r - mean(want)) <= 1.25) && Math.max(...ratings) - Math.min(...ratings) <= 2 && stirOk;
    return { ok, score: (ok ? 1 : 0) + (stirAgree ?? 0) * 0.5, agree: null, stirAgree, turn: null, end: null, misses };
  }
  const agree = pearson(ratings, want);
  const t = beats.findIndex((b) => b.roles.includes('turn'));
  const turn = t > 0 ? Math.sign(ratings[t] - ratings[t - 1]) === Math.sign(want[t] - want[t - 1]) : null;
  const last = beats.length - 1;
  const end = Math.abs(want[last]) < 0.4 ? Math.abs(ratings[last]) <= 1 : Math.sign(ratings[last]) === Math.sign(want[last]);
  const ok = agree >= minAgree && turn !== false && end && stirOk;
  return { ok, score: agree + (turn === false ? -0.5 : 0.25) + (end ? 0.25 : -0.5) + (stirAgree ?? 0) * 0.5, agree, stirAgree, turn, end, misses };
}

// What to tell the writer when a telling didn't follow the line.
export function rewriteNote(check, beats, { close = true } = {}) {
  const out = ['A reader who did not know how they felt read your lines, and some of them do not follow the line they marked.'];
  for (const m of check.misses) {
    const b = beats[m.i];
    if (m.stir) { out.push(`- Line ${m.i + 1} reads ${m.got}, but they marked this part ${m.want}: let its pace and what happens in it say so.`); continue; }
    out.push(`- Line ${m.i + 1} reads ${m.got}, but they marked this part ${m.want}${b.roles.includes('turn') ? ', and it is where their feeling turned' : ''}${b.roles.includes('ending') ? ', and the dream ends on it' : ''}.`);
  }
  if (check.stirAgree != null && check.stirAgree < 0.3) out.push('- Calm and stirred: where they marked it stirred, the telling should quicken; where calm, slow and settle.');
  const t = beats.findIndex((b) => b.roles.includes('turn'));
  if (check.turn === false && t > 0) out.push(`- At line ${t + 1} the dream should turn ${beats[t].delta > 0 ? 'lighter' : 'heavier'} than line ${t}, and it doesn't.`);
  if (check.end === false) out.push(`- The last line should end ${weightOf(beats[beats.length - 1].v)}.`);
  if (close) out.push('Rewrite those lines so the feeling follows their line. Keep the same number of lines, the same parts, and anything they named. Change the images and rhythm, not the feeling words: never name the feeling.');
  return out.join('\n');
}

// ---------------------------------------------------------------- the voice

// How a line is spoken: slower and softer where it was heavier, quicker where they marked it
// stirred and slower where calm (or, if they didn't mark that, as it was painted), a pause before
// the turn and before the end. Amazon Polly's neural voices take rate and volume, and breaks (not
// pitch).
export function voiceOf(beat) {
  const v = beat.v || 0, a = beat.a || 0;
  const pace = Math.abs(a) >= 0.15 ? Math.round(8 * a) : beat.pace === 'restless' || beat.pace === 'quick' ? 4 : beat.pace === 'slow' ? -3 : 0;
  let rate = 100 + Math.round(6 * v) + pace;
  rate = Math.max(86, Math.min(110, rate));
  const volume = v <= -0.5 ? '-3dB' : v <= -0.2 ? '-1.5dB' : v >= 0.5 ? '+1dB' : 'medium';
  const pause = beat.roles?.includes('turn') ? 700 : beat.roles?.includes('ending') && !beat.roles?.includes('opening') ? 400 : 0;
  return { rate: `${rate}%`, volume, pause };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export function ssml(text, { rate = '100%', volume = 'medium', pause = 0 } = {}) {
  return `<speak>${pause ? `<break time="${pause}ms"/>` : ''}<prosody rate="${rate}" volume="${volume}">${esc(text)}</prosody></speak>`;
}

// ---------------------------------------------------------------- without the guide service

// what a mark could be, by its shape, for the question at the turn when the guide can't look
const SHAPE_READINGS = {
  round: ['a face', 'a clock', 'a hole in the ice'],
  dab: ['a few lights', 'footprints', 'seeds'],
  tall: ['someone standing', 'a tower', 'a bare tree'],
  path: ['a road', 'a ladder', 'a crack'],
  house: ['a house', 'a shelter', 'a door'],
  wave: ['water', 'wind', 'a song'],
  long: ['a shore', 'a road', 'a long table'],
};
export function shapeKind(s) {
  const w = s.box[2] - s.box[0], h = s.box[3] - s.box[1];
  const closed = s.from && s.to && Math.hypot(s.from[0] - s.to[0], s.from[1] - s.to[1]) < 0.2 * Math.max(1, s.length);
  if (s.length < 45) return 'dab';
  if (closed && w / Math.max(1, h) > 0.6 && w / Math.max(1, h) < 1.6) return 'round';
  if (s.from && s.to && Math.abs(s.from[1] - s.to[1]) < 12 && w < 260 && h > 50 && s.length > 2.2 * w) return 'house';
  if (s.from && s.from[1] > 960 && h > 100) return 'path';
  if (w < 60 && h > 60) return 'tall';
  if (w > 250 && h < 140 && (s.turn || 0) > 2) return 'wave';
  return 'long';
}
export const readingsFor = (s) => SHAPE_READINGS[shapeKind(s)];

// A telling of the line itself, for when the guide service can't be reached: plain, and theirs.
const SAY = {
  lift: ['Then it lifted a little.', 'And lifted again.', 'Lighter still.'],
  sink: ['Then it grew heavier.', 'And heavier again.', 'Heavier still.'],
  hold: ['It went on like that.', 'And it held.', 'Nothing changed for a while.'],
};
export function plainTelling({ beats, shape }) {
  const used = { lift: 0, sink: 0, hold: 0 };
  const next = (k) => SAY[k][Math.min(SAY[k].length - 1, used[k]++)];
  const lines = beats.map((b, i) => {
    const w = weightOf(b.v);
    let text;
    if (b.named && b.said) text = b.roles.includes('turn') ? `Here it changed: ${b.said}.` : `Here, ${b.said}.`;
    else if (b.roles.includes('turn')) text = b.named ? 'Here it changed, for a reason you kept to yourself.' : 'Here it changed.';
    else if (i === 0) text = w === 'even' ? 'It began here, quietly.' : `It began here, already ${w}.`;
    else if (b.roles.includes('ending')) text = w === 'even' ? 'And it ended evenly, as if nothing had happened.' : `And it ended ${w}.`;
    else text = next(b.delta >= 0.2 ? 'lift' : b.delta <= -0.2 ? 'sink' : 'hold');
    return { text, box: b.box };
  });
  const title = { even: 'An Even Night', rise: 'A Dream That Lifted', fall: 'A Dream That Sank', dip: 'It Sank, Then Lifted', peak: 'It Lifted, Then Sank', 'wave-up': 'A Dream In Waves', 'wave-down': 'A Dream In Waves', 'stir-peak': 'A Storm That Passed', 'stir-rise': 'A Gathering Night', 'stir-fall': 'A Night That Settled' }[shape.id] || 'A Dream';
  return { title, lines };
}
