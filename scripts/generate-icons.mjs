/**
 * Renders the PNG app icons and the social share image from our own SVG
 * artwork (public/favicon.svg and the game thumbnails) using the Playwright
 * Chromium that the e2e tests already use. Output is committed, so builds
 * never depend on this script. Run with `npm run generate:icons`.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const iconsDir = path.join(pub, 'icons');
mkdirSync(iconsDir, { recursive: true });

const dataUri = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;
const logo = dataUri(path.join(pub, 'favicon.svg'), 'image/svg+xml');
const font = dataUri(
  path.join(root, 'node_modules/@fontsource-variable/rubik/files/rubik-latin-wght-normal.woff2'),
  'font/woff2',
);

const BG = '#090916';

/** Same mark as the favicon, drawn edge-to-edge for app icons. */
const iconHtml = (size, { maskable = false } = {}) => {
  // Maskable icons keep the mark inside the 80% safe zone on a full-bleed background.
  const inner = maskable ? Math.round(size * 0.62) : size;
  return `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${
    maskable ? 'linear-gradient(135deg,#8b5cf6,#ec4899)' : 'transparent'
  }">
  ${
    maskable
      ? `<svg width="${inner}" height="${inner}" viewBox="0 0 64 64"><path d="M22 16.5v31a2 2 0 0 0 3 1.7l24-15.5a2 2 0 0 0 0-3.4l-24-15.5a2 2 0 0 0-3 1.7z" fill="#fff"/><circle cx="50" cy="13" r="5" fill="#fff" opacity=".9"/></svg>`
      : `<img src="${logo}" width="${inner}" height="${inner}">`
  }</body></html>`;
};

function gameThumbs() {
  const gamesDir = path.join(root, 'src/games');
  const wanted = [
    'neon-snake',
    'merge-2048',
    'road-rush',
    'five-letters',
    'star-defender',
    'mini-golf',
    'sudoku',
    'gem-swap',
    'slither-arena',
  ];
  return wanted
    .map((id) => path.join(gamesDir, id, 'thumb.svg'))
    .filter((f) => existsSync(f))
    .map((f) => dataUri(f, 'image/svg+xml'));
}

function countGames() {
  const gamesDir = path.join(root, 'src/games');
  return readdirSync(gamesDir, { withFileTypes: true }).filter(
    (d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(path.join(gamesDir, d.name, 'meta.ts')),
  ).length;
}

const ogHtml = () => `<!doctype html><html><head><style>
@font-face { font-family: Rubik; src: url(${font}) format('woff2'); font-weight: 300 900; }
* { box-sizing: border-box; }
body { margin: 0; width: 1200px; height: 630px; overflow: hidden; font-family: Rubik, sans-serif; color: #fff;
  background: radial-gradient(900px 500px at 15% 10%, #3b1d7a 0%, transparent 60%), radial-gradient(700px 500px at 100% 100%, #6b1245 0%, transparent 60%), ${BG}; }
.wrap { position: absolute; inset: 0; padding: 72px; display: flex; flex-direction: column; justify-content: center; gap: 22px; width: 620px; }
.brand { display: flex; align-items: center; gap: 18px; font-size: 34px; font-weight: 800; letter-spacing: -0.02em; }
.brand img { width: 64px; height: 64px; }
h1 { margin: 0; font-size: 78px; line-height: 0.98; font-weight: 900; letter-spacing: -0.035em; }
h1 span { background: linear-gradient(90deg, #a78bfa, #f472b6 60%, #fbbf24); -webkit-background-clip: text; color: transparent; }
p { margin: 0; font-size: 28px; color: #c4c4e0; font-weight: 500; }
.pills { display: flex; gap: 10px; margin-top: 8px; }
.pill { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; padding: 10px 18px; border-radius: 999px; background: rgb(255 255 255 / 0.08); border: 1px solid rgb(255 255 255 / 0.14); font-size: 20px; font-weight: 600; }
.grid { position: absolute; right: -90px; top: -40px; display: grid; grid-template-columns: repeat(3, 240px); gap: 18px; transform: rotate(-12deg); }
.grid img { width: 240px; height: 150px; border-radius: 20px; display: block; box-shadow: 0 18px 40px rgb(0 0 0 / 0.5); border: 1px solid rgb(255 255 255 / 0.12); }
.fade { position: absolute; inset: 0; background: linear-gradient(90deg, ${BG} 42%, rgb(9 9 22 / 0.55) 60%, transparent 80%); }
</style></head><body>
<div class="grid">${[...gameThumbs(), ...gameThumbs()]
  .slice(0, 12)
  .map((src) => `<img src="${src}">`)
  .join('')}</div>
<div class="fade"></div>
<div class="wrap">
  <div class="brand"><img src="${logo}">Nryo Arcade</div>
  <h1>${countGames()} games.<br><span>No sign-up.</span></h1>
  <p>Free browser games that start instantly and remember your progress.</p>
  <div class="pills"><span class="pill">🧠 Brain</span><span class="pill">🏁 Racing</span><span class="pill">🚀 Action</span><span class="pill">🧩 Puzzle</span></div>
</div>
</body></html>`;

const browser = await chromium.launch();
try {
  const shots = [
    { file: 'icons/icon-192.png', size: 192, html: iconHtml(192), transparent: true },
    { file: 'icons/icon-512.png', size: 512, html: iconHtml(512), transparent: true },
    { file: 'icons/icon-maskable-512.png', size: 512, html: iconHtml(512, { maskable: true }) },
    // iOS ignores transparency and adds its own rounding, so use the full-bleed variant.
    { file: 'icons/apple-touch-icon.png', size: 180, html: iconHtml(180, { maskable: true }) },
  ];
  for (const s of shots) {
    const page = await browser.newPage({ viewport: { width: s.size, height: s.size } });
    await page.setContent(s.html, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(pub, s.file), omitBackground: !!s.transparent });
    await page.close();
    console.log(`wrote public/${s.file}`);
  }
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await og.setContent(ogHtml(), { waitUntil: 'load' });
  await og.evaluate(() => document.fonts.ready);
  await og.screenshot({ path: path.join(pub, 'og-image.jpg'), type: 'jpeg', quality: 86 });
  console.log('wrote public/og-image.jpg');
} finally {
  await browser.close();
}
