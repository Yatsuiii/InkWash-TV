// How the eye moves when they walk inside a world built from their picture (realwalk.js), with the
// remote: a press a step or a turn, never further than a little way from where the picture was
// taken. Pure.

// a step, in metres; a turn; how long the eye takes to get there, in seconds; how far it may go
export const STEP = 0.6, TURN = Math.PI / 12, EASE = 0.22, REACH = 6;
// Where the eye goes for a press: `want` { x, z, yaw }, the press, how far it may be from where it
// started. Pure, for the tests.
export function stepFor(want, button, reach = REACH) {
  let { x, z, yaw } = want;
  if (button === 'left') yaw += TURN;
  else if (button === 'right') yaw -= TURN;
  else if (button === 'up' || button === 'down') {
    const d = button === 'up' ? STEP : -STEP;
    x -= Math.sin(yaw) * d; z -= Math.cos(yaw) * d;
    const r = Math.hypot(x, z);
    if (r > reach) { x *= reach / r; z *= reach / r; }
  } else return null;
  return { x, z, yaw };
}
