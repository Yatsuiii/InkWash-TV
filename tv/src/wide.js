// What Dream Canvas did with a picture made real, on the TV: see all around it (a panorama, the
// picture widened to either side by Amazon Nova Canvas, server/wide.mjs), and paint it again in
// another look, keeping each version to go back to. The sheet and its mask are made on the TV
// (main.js wideSheet) to this layout; the rest is here, pure.

// the panorama's sheet: the picture, 1280 x 800 as it is made real, in the middle of 2560 x 800
export const SHEET = { W: 2560, H: 800, picture: { x: 640, w: 1280, h: 800 } };

// The looks a picture is painted again in (server/illustrator.mjs LOOKS), in turn from the one it
// has: a grown-up's from a photograph, a child's from a warm animated film. A look not yet tried
// comes before one already tried.
const TURN = { grown: ['real', 'painting', 'storybook', 'film'], young: ['film', 'storybook', 'painting'] };
export function nextLook(look, young = false, tried = []) {
  const order = young ? TURN.young : TURN.grown;
  const at = Math.max(0, order.indexOf(look));
  const after = [...order.slice(at + 1), ...order.slice(0, at + 1)];
  return after.find((l) => !tried.includes(l)) || after[0];
}
// what each look is called, said on the TV
export const LOOK_NAMES = { real: 'as a photograph', painting: 'as a painting', storybook: 'as a picture book', film: 'as an animated film' };

// which version is shown, of how many: on the chip that goes to the next
export const versionLabel = (k, n) => `Picture ${k + 1} of ${n}`;
export const isVersionLabel = (s) => /^Picture \d+ of \d+$/.test(String(s || ''));

// Looking around a panorama: `x` from 0 (its left end) to 1 (its right), and the way it drifts
// (`v`, 1 or -1) when no arrow is held. Held, an arrow looks that way at `speed` a second; let go,
// it drifts on slowly the same way, and turns back at each end.
export const PAN = { speed: 0.32, drift: 0.035 };
export function panStep({ x = 0.5, v = 1 } = {}, { dt = 0, dir = 0 } = {}) {
  const step = Math.max(0, Math.min(0.25, Number(dt) || 0));
  if (dir) return { x: Math.max(0, Math.min(1, x + Math.sign(dir) * PAN.speed * step)), v: Math.sign(dir) };
  let nx = x + v * PAN.drift * step, nv = v;
  if (nx >= 1) { nx = 1; nv = -1; } else if (nx <= 0) { nx = 0; nv = 1; }
  return { x: nx, v: nv };
}
// where the panorama sits on a screen `screenW` wide when it is `H` tall: how far left it is moved
// (one no wider than the screen, which Nova Canvas never sends back, stays in the middle)
export const panOffset = (x, { W = SHEET.W, H = SHEET.H, screenW = 1920, screenH = 1080 } = {}) => {
  const shown = (W / H) * screenH;
  if (shown <= screenW) return (screenW - shown) / 2;
  return -(shown - screenW) * Math.max(0, Math.min(1, x));
};
