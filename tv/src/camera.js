// Where the sheet goes while a dream is told: in close enough to see the part of the painting a
// line is about, and over so that part sits above the telling's panel, as a camera would frame
// it. Between lines it glides (a CSS transition on the sheet); with nothing to frame, the whole
// painting floats in the night, a little drawn back.
//
// The sheet lies at SHEET on the 1920 x 1080 stage, and moves by `translate(tx, ty) scale(s)` from
// its top left corner. Boxes are in paper units (the sheet is 1600 by 1000, drawn at `px` sheet
// pixels a unit). Pure.

export const SHEET = { x: 176, y: 22, w: 1568, h: 980 };
// the part of the stage a framed part of the painting sits in: above the telling's panel
export const FRAME = [60, 36, 1860, 690];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// The whole painting, drawn back to `s` and floated top and centre
export function wideShot({ s = 0.86, top = FRAME[1] } = {}) {
  return { s, tx: 960 - SHEET.x - (s * SHEET.w) / 2, ty: top - SHEET.y };
}

// The shot for a box: `room` is how much space around it the frame keeps; the zoom stays within
// [least, most] (a kept painting is a smaller picture, so it is framed less close).
export function shotOf(box, { px = 0.98, frame = FRAME, least = 0.86, most = 1.6, room = 1.8 } = {}) {
  if (!box) return wideShot({ s: least, top: frame[1] });
  const [x0, y0, x1, y1] = box;
  const fw = frame[2] - frame[0], fh = frame[3] - frame[1];
  const s = clamp(Math.min(fw / Math.max(1, (x1 - x0) * px * room), fh / Math.max(1, (y1 - y0) * px * room)), least, most);
  const cx = ((x0 + x1) / 2) * px, cy = ((y0 + y1) / 2) * px;
  let tx = (frame[0] + frame[2]) / 2 - SHEET.x - s * cx;
  let ty = (frame[1] + frame[3]) / 2 - SHEET.y - s * cy;
  // the paper fills the frame where it is big enough to: no night shows past its edges inside it
  const W = s * SHEET.w, H = s * SHEET.h;
  if (W >= fw) tx = clamp(tx, frame[2] - SHEET.x - W, frame[0] - SHEET.x);
  else tx = (frame[0] + frame[2]) / 2 - SHEET.x - W / 2;
  if (H >= fh) ty = clamp(ty, frame[3] - SHEET.y - H, frame[1] - SHEET.y);
  else ty = frame[1] - SHEET.y;
  return { s: Math.round(s * 1000) / 1000, tx: Math.round(tx * 10) / 10, ty: Math.round(ty * 10) / 10 };
}

// The box a line is framed by: its own, and the whole of each mark that touches it, so a camera in
// close on someone's arms doesn't cut their head off at the neck (a mark that only touches it
// is taken in whole, but nothing further). `boxes`: every mark's box, in paper units.
export function framedBox(box, boxes = [], pad = 24) {
  if (!box) return null;
  let [x0, y0, x1, y1] = box;
  for (const b of boxes) {
    if (!b || b[0] > box[2] + pad || b[2] < box[0] - pad || b[1] > box[3] + pad || b[3] < box[1] - pad) continue;
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
  }
  return [x0, y0, x1, y1];
}

// where a point on the paper lands on the stage, in a shot
export const onStage = ({ s, tx, ty }, [x, y], px = 0.98) => [SHEET.x + tx + s * x * px, SHEET.y + ty + s * y * px];

export const cssOf = ({ s, tx, ty }) => `translate(${tx}px, ${ty}px) scale(${s})`;
