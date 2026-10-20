// The Appstore listing's pictures, drawn in the app's own look: a stroke of light on the night,
// and the cinnabar seal. A Live App Test asks for the app icon (512 x 512); the full listing also
// takes a small icon (114 x 114) and, for Fire TV, a 1280 x 720 app icon and a 1920 x 1080
// background. Written to docs/listing/.
//   node scripts/listing.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TV = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(TV, 'docs', 'listing');
// the fonts as data, so the page needs nothing from outside it
const font = (f) => `url(data:font/woff2;base64,${readFileSync(join(TV, 'fonts', f)).toString('base64')}) format('woff2')`;
const { chromium } = createRequire(import.meta.url)(join(execSync('npm root -g').toString().trim(), 'playwright'));

// one brush stroke, as a filled shape that swells and tapers: a crescent sweep, like the moon drawn
// in one movement
const STROKE = 'M 128 330 C 150 214, 262 136, 372 150 C 300 164, 214 226, 188 322 C 178 360, 182 396, 196 424 C 160 404, 122 372, 128 330 Z';
const art = (size, { word = false, wide = false } = {}) => {
  const w = wide ? Math.round(size * 16 / 9) : size;
  const s = size / 512;
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Alegreya;font-style:italic;src:${font('alegreya-italic-latin.woff2')}}
@font-face{font-family:'Alegreya Sans';font-weight:700;src:${font('alegreya-sans-700-latin.woff2')}}
html,body{margin:0;background:#080a17}
#a{position:relative;width:${w}px;height:${size}px;overflow:hidden;background:radial-gradient(120% 90% at 50% 38%,#1b2140 0%,#0d1024 55%,#080a17 100%)}
svg{position:absolute;left:${wide ? (w - size * 0.9) / 2 - size * 0.42 : 0}px;top:0}
.word{position:absolute;left:${w / 2 + size * 0.02}px;top:${size * 0.36}px;font:italic 400 ${size * 0.2}px Alegreya,serif;color:#f6ecd8;letter-spacing:.01em}
.k{position:absolute;left:${w / 2 + size * 0.03}px;top:${size * 0.62}px;font:700 ${size * 0.04}px 'Alegreya Sans',sans-serif;letter-spacing:.2em;text-transform:uppercase;white-space:nowrap;color:#e7b878}
</style><div id="a">
<svg width="${wide ? size * 0.9 : size}" height="${wide ? size * 0.9 : size}" viewBox="0 0 512 512" style="${wide ? `top:${size * 0.05}px` : ''}">
  <defs>
    <filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.max(6, 14)}"/></filter>
    <filter id="g2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    <radialGradient id="ink" cx="40%" cy="45%" r="70%"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#f3dcae"/></radialGradient>
  </defs>
  ${[[60, 30, 1.6], [420, 90, 1.2], [455, 300, 1.8], [330, 420, 1.1], [90, 120, 1], [250, 70, 1.3], [470, 470, 1]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r * 2.2}" fill="#f6ecd8" opacity=".55"/>`).join('')}
  <path d="${STROKE}" fill="#ffd9a0" opacity=".55" filter="url(#g)"/>
  <path d="${STROKE}" fill="url(#ink)" filter="url(#g2)"/>
  <path d="${STROKE}" fill="url(#ink)"/>
  <g transform="translate(318 318) rotate(-4)">
    <rect width="122" height="122" rx="16" fill="#b23a2a"/>
    <rect x="9" y="9" width="104" height="104" rx="10" fill="none" stroke="#f6e9dc" stroke-opacity=".85" stroke-width="6"/>
    <path d="M 34 84 C 44 52, 66 38, 90 40" fill="none" stroke="#f6e9dc" stroke-width="10" stroke-linecap="round"/>
  </g>
</svg>
${word ? `<div class="word">Inkwash</div><div class="k">Draw the world in your head</div>` : ''}
</div>`;
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const shots = [
  ['icon-512.png', 512, {}],
  ['icon-114.png', 114, {}],
  ['firetv-icon-1280x720.png', 720, { wide: true, word: true }],
  ['firetv-background-1920x1080.png', 1080, { wide: true, word: true }],
];
for (const [name, size, opts] of shots) {
  const w = opts.wide ? Math.round(size * 16 / 9) : size;
  const page = await browser.newPage({ viewport: { width: w, height: size } });
  await page.setContent(art(size, opts));
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#a').screenshot({ path: join(OUT, name) });
  await page.close();
  console.log(`docs/listing/${name}: ${w} x ${size}`);
}
await browser.close();
