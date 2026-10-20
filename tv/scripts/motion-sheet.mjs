// Contact sheets of how things move, frame by frame, to look at and fix: a thing coming to life at
// home (night.js popped), a thing hopping when it is greeted (night.js hopped), and a card coming
// to life (index.html's own CSS on the page itself, each animation paused at each frame). The home
// moves are drawn with the very functions night.js draws them with, on a little character whose
// squash and stretch shows; each sheet has the frames side by side, and an onion skin of them all.
// And the curves: how high it is and how it is stretched, a dot a frame.
//
//   node scripts/motion-sheet.mjs [fps=30]     test-shots/motion/{hop,pop,card,curves}.png
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const OUT = fileURLToPath(new URL('../test-shots/motion/', import.meta.url));
const FPS = Number(process.argv[2]) || 30, PORT = 5211;
mkdirSync(OUT, { recursive: true });
const { chromium } = createRequire(import.meta.url)(`${execSync('npm root -g').toString().trim()}/playwright`);

const server = await serve(PORT);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  // ---------------------------------------------------------------- home: the pop and the hop
  const page = await browser.newPage({ viewport: { width: 1800, height: 2400 } });
  await page.goto(`http://localhost:${PORT}/index.html?quiet=0`);
  await page.evaluate(async (fps) => {
    const N = await import('/src/night.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#f4f1ea';
    // a little character: a round body, two eyes, feet; its box is 120 x 140, its foot at the bottom
    const who = document.createElement('canvas'); who.width = 120; who.height = 140;
    const g = who.getContext('2d');
    g.fillStyle = '#d97757'; g.beginPath(); g.roundRect(10, 20, 100, 105, 34); g.fill();
    g.fillStyle = '#2a211c'; g.fillRect(36, 58, 12, 18); g.fillRect(72, 58, 12, 18);
    g.fillRect(30, 125, 18, 15); g.fillRect(72, 125, 18, 15);
    const sheet = (name, frames, place) => {
      const W = 150, H = 230, cols = Math.min(frames, 12), rows = Math.ceil(frames / cols);
      const c = document.createElement('canvas'); c.width = cols * W; c.height = rows * H + 260; c.id = name;
      const x = c.getContext('2d');
      x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, c.width, c.height);
      x.font = '16px monospace';
      const draw = (f, ox, oy, alpha = 1) => {
        const foot = [ox + W / 2, oy + H - 40], box = [foot[0] - 60, foot[1] - 140, foot[0] + 60, foot[1]];
        const at = place([[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]], foot, f);
        x.globalAlpha = alpha;
        x.drawImage(who, at[0][0], at[0][1], at[1][0] - at[0][0], at[2][1] - at[0][1]);
        x.globalAlpha = 1;
        return foot;
      };
      for (let f = 0; f < frames; f++) {
        const ox = (f % cols) * W, oy = Math.floor(f / cols) * H, foot = draw(f, ox, oy);
        x.strokeStyle = '#b9b2a4'; x.beginPath(); x.moveTo(ox + 8, foot[1]); x.lineTo(ox + W - 8, foot[1]); x.stroke();
        x.fillStyle = '#5b5248'; x.fillText(`${f}`, ox + 8, oy + 20);
      }
      // the onion skin: every frame at once, faintly, on one floor
      const oy = rows * H;
      x.fillStyle = '#5b5248'; x.fillText(`${name}: every frame at once (${frames} frames at ${fps} fps)`, 8, oy + 24);
      for (let f = 0; f < frames; f++) draw(f, c.width / 2 - W / 2, oy + 20, 0.16);
      document.body.append(c);
    };
    const popN = Math.round(N.POP.s * fps), hopN = Math.round(N.HOP.s * fps);
    sheet('pop', popN + 2, (at, foot, f) => N.popped(at, foot, f / (N.POP.s * fps)));
    sheet('hop', hopN + 2, (at, foot, f) => N.hopped(at, foot, f / (N.HOP.s * fps), N.hopHeight(140)));
    // the curves, a dot a frame: dots close together are slow, far apart are fast
    const c = document.createElement('canvas'); c.width = 1200; c.height = 520; c.id = 'curves';
    const x = c.getContext('2d');
    x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, c.width, c.height); x.font = '16px monospace';
    const plot = (title, n, ox, series) => {
      const w = 560, h = 400, oy = 60;
      x.fillStyle = '#2a211c'; x.fillText(title, ox, 30);
      x.strokeStyle = '#b9b2a4'; x.strokeRect(ox, oy, w, h);
      for (const [label, color, f, lo, hi] of series) {
        x.fillStyle = color;
        for (let i = 0; i <= n; i++) { const v = f(i / n); x.beginPath(); x.arc(ox + (i / n) * w, oy + h - ((v - lo) / (hi - lo)) * h, 4, 0, 7); x.fill(); }
        x.fillText(label, ox + 8, oy + 20 + 18 * series.indexOf(series.find((s) => s[0] === label)));
      }
    };
    plot(`pop: size (${popN} frames)`, popN, 20, [['size', '#d97757', N.popOf, 0, 1.3]]);
    plot(`hop: height, width, tallness (${hopN} frames)`, hopN, 620, [
      ['height', '#2a6fdb', (u) => N.hopOf(u).lift, -0.2, 1.2],
      ['width', '#3a9d5d', (u) => N.hopOf(u).sx, 0.75, 1.25],
      ['tallness', '#d97757', (u) => N.hopOf(u).sy, 0.75, 1.25],
    ]);
    document.body.append(c);
  }, FPS);
  for (const id of ['pop', 'hop', 'curves']) await page.locator(`#${id}`).screenshot({ path: `${OUT}${id}.png` });

  // ---------------------------------------------------------------- the card, as the page draws it
  const card = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await card.goto(`http://localhost:${PORT}/index.html?quiet=0`);
  await card.waitForFunction(() => window.__inktv && window.__inktv.ready, null, { timeout: 60000 });
  const shots = [], n = Math.round(1.2 * FPS);
  await card.evaluate(async () => {
    const { sparksEl } = await import('/src/night.js');
    const host = document.querySelector('#collected');
    host.innerHTML = '';
    host.style.cssText = 'position:fixed;left:40px;top:80px;right:auto;z-index:99999';
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = '<span class="badge">New in your world</span><span class="art"></span><p class="name">The lantern</p>';
    // its ink: a few strokes; its picture: the lantern, cut out
    const ink = document.createElement('canvas'); ink.width = 544; ink.height = 380;
    const g = ink.getContext('2d'); g.fillStyle = '#f3ecdc'; g.fillRect(0, 0, 544, 380);
    g.strokeStyle = '#151515'; g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(272, 70); g.lineTo(272, 300); g.moveTo(222, 300); g.lineTo(322, 300); g.stroke();
    const pic = document.createElement('canvas'); pic.width = 544; pic.height = 380; pic.className = 'alive-pic';
    const p = pic.getContext('2d');
    p.fillStyle = '#7a4a1e'; p.fillRect(232, 80, 80, 24); p.fillRect(222, 290, 100, 20);
    p.fillStyle = '#ffc85a'; p.beginPath(); p.roundRect(236, 104, 72, 186, 16); p.fill();
    p.fillStyle = '#fff3c4'; p.beginPath(); p.arc(272, 196, 22, 0, 7); p.fill();
    el.querySelector('.art').append(ink);
    host.append(el);
    // as comeToLife does it
    el.querySelector('.art').append(pic);
    // a copy of its sparks, which stays while the frames are taken one by one (sparksEl's own goes
    // in 2 s, as it should)
    const CARD_PEAK = 0.37; // main.js CARD_PEAK
    el.append(sparksEl({ at: CARD_PEAK }).cloneNode(true));
    el.classList.add('alive');
    el.querySelector('.badge').textContent = 'It came to life!';
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    // the card has flown in already; only its coming to life is stepped through
    for (const a of document.getAnimations()) { if (a.animationName === 'cardIn') a.finish(); else a.pause(); }
  });
  const box = await card.locator('#collected .card').boundingBox();
  for (let f = 0; f < n; f++) {
    await card.evaluate((ms) => { for (const a of document.getAnimations()) if (a.animationName !== 'cardIn') { a.currentTime = ms; a.pause(); } }, (f / FPS) * 1000);
    shots.push((await card.screenshot({ clip: { x: box.x - 60, y: box.y - 60, width: box.width + 120, height: box.height + 120 } })).toString('base64'));
  }
  await card.evaluate(async ({ shots, fps }) => {
    document.body.innerHTML = '';
    const imgs = await Promise.all(shots.map((b) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = `data:image/png;base64,${b}`; })));
    const s = 0.5, w = imgs[0].width * s, h = imgs[0].height * s, cols = 9;
    const c = document.createElement('canvas'); c.width = cols * w; c.height = Math.ceil(imgs.length / cols) * h; c.id = 'sheet';
    const x = c.getContext('2d'); x.font = '14px monospace';
    imgs.forEach((im, f) => { x.drawImage(im, (f % cols) * w, Math.floor(f / cols) * h, w, h); x.fillStyle = '#fff'; x.fillText(`${f} (${Math.round((f / fps) * 1000)} ms)`, (f % cols) * w + 6, Math.floor(f / cols) * h + 16); });
    document.body.append(c);
  }, { shots, fps: FPS });
  await card.setViewportSize({ width: 3600, height: 2000 });
  await card.locator('#sheet').screenshot({ path: `${OUT}card.png` });
  console.log(`contact sheets in ${OUT}: pop.png, hop.png, curves.png, card.png (${FPS} fps)`);
} finally {
  await browser.close();
  server.close();
}
