/**
 * Build-time site generation (production builds only):
 *  - prerendered HTML per route with real <title>, description, Open Graph
 *    and JSON-LD — so every game has meaningful metadata without a server;
 *  - sitemap.xml (when SITE_URL is set);
 *  - a precaching service worker listing every emitted asset for offline play;
 *  - a strict Content-Security-Policy meta tag.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { createServer } from 'vite';

interface PageMeta {
  title: string;
  description: string;
  path: string;
  jsonLd?: Record<string, unknown>;
}

interface GameLike {
  id: string;
  title: string;
}

interface SeoModule {
  homeMeta(): PageMeta;
  gamesMeta(): PageMeta;
  categoriesMeta(): PageMeta;
  favoritesMeta(): PageMeta;
  profileMeta(): PageMeta;
  notFoundMeta(): PageMeta;
  gameMeta(game: GameLike): PageMeta;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// JSON inside <script> must not be able to close the tag.
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

function renderPage(template: string, meta: PageMeta, siteUrl: string, base: string): string {
  const url = siteUrl ? new URL(base + meta.path.replace(/^\//, ''), siteUrl).href : base + meta.path.replace(/^\//, '');
  const image = siteUrl ? new URL(`${base}og-image.png`, siteUrl).href : `${base}og-image.png`;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, `$1${escapeHtml(image)}$2`)
    .replace(
      '</head>',
      `    <link rel="canonical" href="${escapeHtml(url)}" />\n    <meta property="og:url" content="${escapeHtml(url)}" />\n  </head>`,
    );
  if (meta.jsonLd) {
    html = html.replace('</head>', `    <script type="application/ld+json">${safeJson(meta.jsonLd)}</script>\n  </head>`);
  }
  // Lightweight, real content for crawlers and the first paint; React replaces it on boot.
  const splash = `<div class="prerender" style="min-height:100dvh;display:grid;place-content:center;gap:12px;padding:24px;text-align:center;font-family:system-ui,sans-serif;color:#f5f5ff;background:#090916"><h1 style="margin:0;font-size:1.6rem">${title.split(' — ')[0]!.split(' | ')[0]}</h1><p style="margin:0;max-width:520px;color:#a9a9c9">${description}</p></div>`;
  return html.replace('<div id="root"></div>', `<div id="root">${splash}</div>`);
}

async function listFiles(dir: string, root = dir): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir)) {
    const full = path.join(dir, entry);
    const s = await stat(full);
    if (s.isDirectory()) out.push(...(await listFiles(full, root)));
    else out.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return out;
}

function serviceWorkerSource(version: string, precache: string[], base: string): string {
  return `/* Generated at build time — offline support for Nryo Arcade. */
const CACHE = 'nryo-${version}';
const BASE = ${JSON.stringify(base)};
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('nryo-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function networkFirst(request) {
  return new Promise((resolve) => {
    let settled = false;
    const fallback = () =>
      caches.match(request).then((hit) => hit || caches.match(BASE + 'index.html')).then((r) => {
        if (!settled) { settled = true; resolve(r || Response.error()); }
      });
    const timer = setTimeout(fallback, 3500);
    fetch(request).then((response) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      resolve(response);
    }).catch(() => { clearTimeout(timer); fallback(); });
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(
    caches.match(request).then((hit) =>
      hit ||
      fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return response;
      }),
    ),
  );
});
`;
}

export function sitePlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'nryo-site',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
    async closeBundle(error?: Error) {
      if (error) return;
      const outDir = path.resolve(config.root, config.build.outDir);
      const base = config.base.endsWith('/') ? config.base : `${config.base}/`;
      const siteUrl = (process.env.SITE_URL ?? '').replace(/\/?$/, process.env.SITE_URL ? '/' : '');

      // Load catalog metadata + SEO builders through Vite so import.meta.glob works.
      const server = await createServer({
        root: config.root,
        configFile: false,
        logLevel: 'error',
        appType: 'custom',
        server: { middlewareMode: true, hmr: false, ws: false },
        optimizeDeps: { noDiscovery: true, include: [] },
      });
      let seo: SeoModule;
      let games: GameLike[];
      try {
        seo = (await server.ssrLoadModule('/src/seo.ts')) as unknown as SeoModule;
        games = ((await server.ssrLoadModule('/src/games/metas.ts')) as { GAME_METAS: GameLike[] }).GAME_METAS;
      } finally {
        await server.close();
      }

      const template = await readFile(path.join(outDir, 'index.html'), 'utf8');
      const pages: PageMeta[] = [
        seo.homeMeta(),
        seo.gamesMeta(),
        seo.categoriesMeta(),
        seo.favoritesMeta(),
        seo.profileMeta(),
        ...games.map((g) => seo.gameMeta(g)),
      ];
      for (const page of pages) {
        const file = page.path === '/' ? 'index.html' : path.join(page.path.replace(/^\//, ''), 'index.html');
        const target = path.join(outDir, file);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, renderPage(template, page, siteUrl, base));
      }
      await writeFile(path.join(outDir, '404.html'), renderPage(template, seo.notFoundMeta(), siteUrl, base));

      if (siteUrl) {
        const urls = pages
          .filter((p) => p.path !== '/favorites' && p.path !== '/profile')
          .map((p) => `  <url><loc>${escapeHtml(new URL(base + p.path.replace(/^\//, ''), siteUrl).href)}</loc></url>`);
        await writeFile(
          path.join(outDir, 'sitemap.xml'),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
        );
        await writeFile(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${new URL(`${base}sitemap.xml`, siteUrl).href}\n`);
      }

      // Precache the app shell and every asset (all games) for offline play.
      const files = (await listFiles(outDir)).filter(
        (f) =>
          !f.endsWith('.map') &&
          f !== 'sw.js' &&
          f !== 'sitemap.xml' &&
          f !== 'robots.txt' &&
          f !== '404.html' &&
          (!f.endsWith('.html') || f === 'index.html') &&
          !f.endsWith('og-image.png') &&
          // Non-Latin font subsets are fetched on demand by unicode-range only.
          !(f.endsWith('.woff2') && !/latin/.test(f)),
      );
      const precache = files.map((f) => base + f);
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12);
      await writeFile(path.join(outDir, 'sw.js'), serviceWorkerSource(version, precache, base));
    },
  };
}
