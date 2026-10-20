// Walking through their world. Their world at night (night.js) is seen from an eye at the edge of
// the still water; here the eye walks into it. ◀ ▶ turn, ▲ ▼ walk on or back; OK goes to each thing
// in turn and stands before it, eye to eye, rising to meet what is up in the sky; ▶‖ hears the
// nights it came in, as they were told. Things stand where the home view puts them, so the walk
// starts on the very picture of their world, and Back walks home to it.
//
// Pure: where each thing stands in the world, where the eye is and what it sees, a step of the
// walk, where to stand before a thing, and what was told of it, night by night.
import { STAGE } from './stage.js';

// How fast the eye walks (world units a second) and turns (radians a second); the nearest it sees;
// how tall a thing gone to stands on the screen, at most how wide, and how much its light may be
// magnified and stay sharp; where its middle is on the screen, on the water and up in the sky; the
// lowest the eye stands before what is on the water; how high it stands to look up at what is in
// the sky, and how far up it can look (pixels the horizon moves down the screen); how high in the
// air a thing is, to be up in the sky
export const PACE = { walk: 560, turn: 0.95, near: 40, fill: 430, wide: 1000, sharp: 4.5, middle: 610, sky: 520, low: 150, high: 460, look: 520, risen: 120 };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// a turn the short way round, from -π to π
export const turn = (a) => { const t = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return t === -Math.PI ? Math.PI : t; };

// The eye of the home view: at the water's edge, looking straight in. `lift`: how far up it looks,
// as pixels the horizon moves down the screen (the eye looks up without tilting, so what stands
// upright stays upright)
export const HOME = { x: 0, z: 0, yaw: 0, h: STAGE.eye.h, lift: 0 };

// Where each thing stands in the world (x across, z ahead, in world units; `rise`, how high it is up
// in the air), from where placeWorld put it on the home view, which this eye at HOME sees
export function worldOf(placed, S = STAGE) {
  return placed.map((p) => ({ id: p.id, x: (p.foot[0] - S.W / 2) / p.k, z: S.eye.f / p.k, rise: p.rise / p.k }));
}

// How far the eye may go: round the things, and the water's edge where it starts
export function boundsOf(spots, margin = 900) {
  const xs = [0, ...spots.map((s) => s.x)], zs = [0, ...spots.map((s) => s.z)];
  return { x0: Math.min(...xs) - margin, x1: Math.max(...xs) + margin, z0: Math.min(...zs) - margin * 0.6, z1: Math.max(...zs) + margin };
}
export const within = (eye, b) => ({
  x: b ? clamp(eye.x, b.x0, b.x1) : eye.x, z: b ? clamp(eye.z, b.z0, b.z1) : eye.z,
  yaw: turn(eye.yaw), h: clamp(eye.h ?? HOME.h, 60, 1100), lift: clamp(eye.lift || 0, 0, PACE.look),
});

// A point of the world [x, y up, z] as the eye sees it: [screen x, screen y, how far ahead], or null
// behind the eye (or nearer than it sees). The horizon stays where it is on the screen, unless the
// eye looks up.
export function view(eye, [x, y, z], S = STAGE) {
  const dx = x - eye.x, dz = z - eye.z, c = Math.cos(eye.yaw), s = Math.sin(eye.yaw);
  const across = dx * c - dz * s, ahead = dx * s + dz * c;
  if (ahead < PACE.near) return null;
  return [S.W / 2 + (S.eye.f * across) / ahead, S.horizon + (eye.lift || 0) + (S.eye.f * ((eye.h ?? HOME.h) - y)) / ahead, ahead];
}
// the way the eye looks, and its right, on the water: unit vectors [x, z]
export const ahead = (eye) => [Math.sin(eye.yaw), Math.cos(eye.yaw)];
export const right = (eye) => [Math.cos(eye.yaw), -Math.sin(eye.yaw)];

// A moment of the walk: held ◀ ▶ turn, ▲ ▼ walk on and back the way it looks, for `dt` seconds.
// Walking, the eye comes back down to walk on the water, and looks ahead again.
export function walk(eye, held, dt, { bounds = null, pace = PACE } = {}) {
  const has = (b) => !!held && (held.has ? held.has(b) : held.includes(b));
  const yaw = eye.yaw + ((has('right') ? 1 : 0) - (has('left') ? 1 : 0)) * pace.turn * dt;
  const step = ((has('up') ? 1 : 0) - (has('down') ? 1 : 0)) * pace.walk * dt;
  const e = ['left', 'right', 'up', 'down'].some(has) ? 1 - Math.exp(-dt * 1.6) : 0, h = eye.h ?? HOME.h;
  return within({ x: eye.x + Math.sin(yaw) * step, z: eye.z + Math.cos(yaw) * step, yaw, h: h + (HOME.h - h) * e, lift: (eye.lift || 0) * (1 - e) }, bounds);
}

// Where to stand before a thing at `spot`, `tall` world units tall: on the line from where the eye
// is, near enough that it stands about PACE.fill pixels tall in the middle of the screen; but far
// enough that something long and low (a pier, a ferry) fits across it, `wide` world units, and that
// its light, `detail` pixels of it a world unit, is not magnified past sharp. On the water, eye to
// eye with it, a little above its middle. Up in the sky (the moon, a dragon in flight), from below
// it, looking up: all sky round it, the horizon low on the screen.
export function standBefore(eye, spot, tall, { wide = 0, detail = 0, pace = PACE, S = STAGE, bounds = null } = {}) {
  let dx = spot.x - eye.x, dz = spot.z - eye.z;
  const d = Math.hypot(dx, dz);
  if (d < 1) { dx = 0; dz = 1; } else { dx /= d; dz /= d; }
  const near = Math.max((S.eye.f * tall) / pace.fill, (S.eye.f * wide) / pace.wide, detail > 0 ? S.eye.f / (detail * pace.sharp) : 0);
  const far = clamp(near, 220, 2600), k = far / S.eye.f;
  const rise = spot.rise || 0, middle = rise + tall / 2;
  let h = Math.max(pace.low, middle + (pace.middle - S.horizon) * k), lift = 0;
  if (rise >= pace.risen) {
    h = clamp(Math.min(pace.high, rise - 40), 60, 1100);
    lift = pace.sky - S.horizon - (h - middle) / k;
    // too high to look up to from there: the eye rises the rest of the way
    if (lift > pace.look) { lift = pace.look; h = middle + (pace.sky - S.horizon - lift) * k; }
  }
  return within({ x: spot.x - dx * far, z: spot.z - dz * far, yaw: Math.atan2(dx, dz), h, lift }, bounds);
}

// A step of a glide from `eye` toward `to`, `e` of the way (0 to 1); whether it has arrived
export function glide(eye, to, e) {
  const t = turn(to.yaw - eye.yaw);
  const l0 = eye.lift || 0, l1 = to.lift || 0;
  const next = { x: eye.x + (to.x - eye.x) * e, z: eye.z + (to.z - eye.z) * e, yaw: turn(eye.yaw + t * e), h: eye.h + (to.h - eye.h) * e, lift: l0 + (l1 - l0) * e };
  const there = Math.abs(t) < 0.002 && Math.hypot(to.x - next.x, to.z - next.z) < 1.5 && Math.abs(to.h - next.h) < 1.5 && Math.abs(l1 - next.lift) < 1.5;
  return { eye: there ? { ...to } : next, there };
}

// What was told of a thing, night by night: [{ night, next, title, lines: [text] }], the nights it
// came in (or in what they painted next) with the lines about it they kept, in the order they came
export function nightsOf(world, id) {
  const e = (world.entities || []).find((x) => x.id === id);
  if (!e) return [];
  const came = [...(e.appearances || []).map((a) => ({ ...a, next: false })), ...(e.endings || []).map((a) => ({ ...a, next: true }))]
    .filter((a) => Number.isFinite(a.night)).sort((a, b) => a.night - b.night || a.next - b.next);
  const out = [];
  for (const a of came) {
    const N = (world.nights || []).find((n) => n.n === a.night);
    if (!N) continue;
    const told = (a.next ? N.ending && N.ending.lines : N.lines) || [];
    const picked = Array.isArray(a.lines) && a.lines.length ? a.lines.map((i) => told[i]) : told.filter((l) => (l.entities || []).includes(id));
    const lines = picked.filter((l) => l && l.text && l.reaction !== 'no').map((l) => l.text);
    if (lines.length) out.push({ night: a.night, next: a.next, title: N.title || null, lines });
  }
  return out;
}
