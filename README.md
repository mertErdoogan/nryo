# Nryo Arcade

**41 free browser games. No sign-up. Play instantly.**

Nryo Arcade is a static web gaming platform: arcade, puzzle, word, brain, racing, action, physics, strategy and
reflex games that start with one tap and remember your progress on your device. There are no accounts, no
backend and no third-party scripts. Everything runs in the browser and works offline once loaded.

- **41 original games** across 13 categories, each with its own mechanics, controls, scoring, medals and
  results screen
- **Progress that persists**: best scores, medals, favorites, recently played, unfinished rounds, XP and levels,
  34 achievements, unlockable avatars and colors, settings, daily challenge streaks, all versioned and validated
- **Daily challenge**: one game a day, the same seed and target for everyone, with streaks
- **Continue Playing**: 11 games save unfinished rounds (2048, Sudoku, Mine Sweeper, Mini Golf, Tower Guard…)
- **Clearly labelled AI rivals** instead of fake multiplayer: racing opponents, board-game AIs, arena bots, a
  ghost lap for Turbo Laps, and a leaderboard of "(bot)" players per game
- **Mobile-first**: touch controls, safe areas, bottom navigation, works from 360 px up to large desktops
- **PWA**: installable, and a service worker precaches every game for offline play
- **Accessible**: keyboard play wherever it makes sense, focus management, labelled controls, reduced-motion
  support, no autoplaying audio

---

## Quick start

Requires **Node.js 20.19+** (or 22.12+).

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command                  | What it does                                                              |
| ------------------------ | ------------------------------------------------------------------------- |
| `npm run dev`            | Vite dev server with hot reload                                           |
| `npm run build`          | Type-check, then production build into `dist/` (prerendered routes, SW)   |
| `npm run preview`        | Serve `dist/` on http://localhost:4173                                    |
| `npm run typecheck`      | `tsc` for the app and for the Node-side config/build/e2e code             |
| `npm run lint`           | ESLint (zero warnings allowed)                                            |
| `npm run format`         | Prettier                                                                  |
| `npm test`               | Unit, logic and component tests (Vitest + Testing Library, jsdom)         |
| `npm run test:e2e`       | Playwright end-to-end tests against a production build (desktop + mobile) |
| `npm run check`          | Everything above in order: typecheck, lint, unit, build, e2e              |
| `npm run generate:icons` | Re-render PWA icons and the social image from our SVG artwork             |
| `npm run generate:words` | Regenerate the word lists used by the word games                          |

First e2e run on a new machine: `npx playwright install chromium`. Set `E2E_SKIP_BUILD=1` to reuse an existing
`dist/` instead of rebuilding.

---

## Games

| Category     | Games                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| Hyper Casual | Stack Tower, Sky Hopper, Pin Spin, Wall Flip, Tile Tapper, Sky Climber, Hoop Shot, Block Fit…         |
| Arcade       | Neon Snake, Block Drop, Brick Breaker, Star Defender, Whack Attack, Air Hockey…                       |
| Action       | Arena Survivor, Slither Arena, Star Defender, Meteor Dodge, Target Rush                               |
| Racing       | Road Rush (endless traffic), Turbo Laps (3 AI rivals + your ghost lap)                                |
| Puzzle       | 2048 Merge, Sudoku, Mine Sweeper, Pipe Link, Gem Swap, Block Fit, Word Hunt, Tower Guard…             |
| Brain        | Math Sprint, Color Clash, Reflex Test, Echo Pads, Grid Recall, Memory Match, Five Letters…            |
| Word         | Five Letters, Word Blitz, Word Hunt                                                                   |
| Memory       | Memory Match, Grid Recall, Echo Pads                                                                  |
| Strategy     | Tower Guard, Planet Conquest, Four in a Row, Reversi, Gem Miner Tycoon (incremental), Arena Survivor… |
| Reflex       | Reflex Test, Target Rush, Whack Attack, Tile Tapper, Pin Spin, Stack Tower, Color Clash…              |
| Physics      | Mini Golf, Hoop Shot, Bounce Barrage, Air Hockey, Brick Breaker, Sky Climber                          |
| Endless      | Meteor Dodge, Road Rush, Sky Hopper, Sky Climber, Wall Flip, Neon Snake, Slither Arena…               |
| Versus (AI)  | Air Hockey, Four in a Row, Reversi, Planet Conquest, Slither Arena, Turbo Laps                        |

Games belong to up to three categories (the first is primary), so rows overlap and "…" marks a longer list.
The app builds its catalog, filters and search from each game's metadata. This table is just a summary.

---

## Architecture

```
┌──────────────────────────────── App shell (React) ────────────────────────────────┐
│  Router (History API)   Header / search palette / settings   Pages   Toasts        │
│        │                                                                            │
│        ▼                                                                            │
│  PlayPage ──► GameShell ── lifecycle: ready → playing ⇄ paused → over → results     │
│                  │   HUD · overlays · error boundary · auto-pause · keyboard        │
│                  │                                                                  │
│                  ▼  GameApi (score, gameOver, save, progress, sfx, haptics, seed)   │
│              Game component  ◄── lazy chunk: src/games/<id>/index.tsx               │
│                  │   uses the engine: canvas stage, loop, input, effects, UI kit    │
│                  ▼                                                                  │
│  Platform services: player · stats · favorites · recent · saves · daily ·           │
│                     achievements · settings · analytics · discovery · rivals        │
│                  │                                                                  │
│                  ▼                                                                  │
│  PersistentStore (versioned envelope + schema validation + migration/repair)        │
│                  ▼                                                                  │
│  StorageDriver: localStorage, memory fallback, cross-tab sync                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Tech stack

- **React 19 + TypeScript 6 (strict)**, bundled with **Vite 7**
- **CSS Modules** with design tokens (`src/styles/tokens.css`) and container queries for game boards
- **No runtime dependencies** beyond React and the self-hosted Rubik font. Routing, state, persistence, schema
  validation, seeded RNG, audio synthesis and the game engine are small in-repo modules.
- **Vitest + Testing Library** for unit/component tests, **Playwright** for end-to-end tests
- **ESLint 9** (typescript-eslint, react-hooks, bans `eval`/`new Function`) and **Prettier**

### Key decisions

- **Static, backend-free.** The whole product is a static site. Player identity is an anonymous random id stored
  locally, not an account. Nothing leaves the device.
- **Games are plugins.** Each game is a folder discovered at build time with `import.meta.glob`. Metadata and
  thumbnails load eagerly (they're tiny). Game code is a separate lazy chunk, so the first page load doesn't grow
  with the catalog.
- **One shell for every game.** Pausing, restarting, results, best scores, medals, XP, achievements, daily
  challenges, saves, crash isolation and keyboard shortcuts live in `GameShell`. Games only implement gameplay and
  report through a small typed API.
- **Deterministic randomness.** Games get a seed from the shell. Daily runs use `hash(date + gameId)`, so everyone
  gets the same board, and tests can reproduce runs.
- **Synthesized audio.** Sound effects are generated with WebAudio (no audio files). Audio unlocks on the first
  user gesture and can be muted, with volume control.
- **Honest multiplayer.** Opponents are AI and always labelled as bots. Leaderboards are deterministic bot
  ladders, not fake real players.
- **Prerendered HTML per route.** A build plugin writes `index.html` for every route with its own title,
  description, Open Graph tags, canonical URL and JSON-LD. Crawlers and link previews see real metadata, and
  every deep link has a real file behind it.

---

## Project structure

```
├── build/site-plugin.ts        # Vite plugin: per-route HTML + SEO, 404.html, sitemap/robots, service worker, CSP
├── e2e/                        # Playwright specs (home, persistence, games smoke, daily, responsive, offline)
├── public/                     # favicon, manifest, icons, social image, robots.txt
├── scripts/                    # generate-icons.mjs, generate-wordlists.mjs
└── src/
    ├── main.tsx                # entry: fonts, styles, <App/>, service worker registration
    ├── seo.ts                  # page titles/descriptions/JSON-LD (shared by the app and the build plugin)
    ├── app/                    # router, App, header, search palette, settings dialog, app error boundary
    ├── pages/                  # Home, Games (search/filter/sort), Categories, Favorites, Profile, Play, 404
    ├── components/             # DailyChallengeCard, ContinueCard
    ├── ui/                     # design system: Button, Dialog, GameCard, Section, Toggle, Medal, Icon…
    ├── shell/                  # GameShell, HUD, ready/pause/results overlays, GameErrorBoundary, GameInfo
    ├── engine/                 # game toolkit: CanvasStage, loop, timers, input, particles, draw, touch controls, DOM UI kit
    ├── games/
    │   ├── define.ts           # defineMeta / defineGame
    │   ├── metas.ts            # auto-discovers every src/games/<id>/meta.ts
    │   ├── catalog.ts          # GAMES + lazy loaders + thumbnails
    │   ├── _shared/words/      # generated word lists + helpers
    │   └── <game-id>/          # meta.ts, index.tsx, thumb.svg, component, logic, styles
    ├── platform/
    │   ├── types.ts            # domain model (GameMeta, GameApi, PlayerState, …)
    │   ├── platform.ts         # createPlatform(): recordRound, favorites, achievements, daily, reset
    │   ├── storage/            # StorageDriver + PersistentStore (versioning, validation, migration)
    │   ├── services/           # player, stats, lists, saves, daily, settings, levels, analytics
    │   ├── achievements.ts  cosmetics.ts  scoring.ts  rivals.ts  discovery.ts  categories.ts
    │   ├── audio.ts  pwa.ts  ads.ts  data-transfer.ts
    ├── hooks/                  # useStore, usePlatform hooks, useDocumentMeta, useToday
    ├── lib/                    # schema, rng, format, date, sanitize, math
    ├── styles/                 # tokens.css, base.css
    └── test/                   # setup, fixtures, render helpers
```

---

## Game architecture

Every game is a folder under `src/games/<id>/`:

| File           | Purpose                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `meta.ts`      | Static metadata (`defineMeta`): title, copy, categories, tags, controls, score format, medals, theme |
| `thumb.svg`    | Card artwork (original SVG, 16:10)                                                                   |
| `index.tsx`    | Lazy entry (`defineGame`): the component, plus optional save/progress specs                          |
| `*.tsx / *.ts` | The game itself. Pure logic in `logic.ts` is unit-tested in `src/games/logic.test.ts`                |

A game component receives `{ api, paused }`:

```ts
interface GameApi<Save, Progress> {
  meta: GameMeta;
  mode: 'normal' | 'daily';
  seed: number; // deterministic in daily mode
  target: number | null; // daily challenge target
  best: number | null; // personal best before this round
  resume: Save | null; // unfinished round to continue, if the player chose "Continue"
  progress: Progress | null; // long-lived per-game data (unlocked levels, ghost laps…)
  setScore(score: number): void; // live HUD score
  gameOver(result: { score: number; won?: boolean; stats?: { label: string; value: string }[] }): void;
  save(data: Save, summary: { label: string; progress: number }): void; // enables "Continue Playing"
  clearSave(): void;
  saveProgress(data: Progress): void;
  sfx(name: SoundName): void;
  haptic(pattern: number | number[]): void;
}
```

Rules every game follows:

- Stop loops and timers while `paused` is true. The shell auto-pauses real-time games when the tab is hidden or
  the window loses focus.
- Call `gameOver` once. The shell then records stats, awards XP, medals and achievements, updates the daily
  challenge and shows the results screen.
- Use `api.seed` (via `useSeededRng`) for any randomness that decides the layout, so daily challenges are fair.
- A new round is a fresh mount (the shell changes the component `key`), so no manual reset logic is needed.

The engine (`src/engine`) provides `CanvasStage` (DPR-aware canvas with logical coordinates and pointer mapping),
`useGameLoop` (rAF with clamped delta time), countdown/stopwatch hooks, keyboard/touch helpers, particles, floating
text, screen shake, touch buttons and a DOM UI kit (`DomStage`, `StatBar`, `Banner`, `Hint`, …).

---

## Adding a new game

Adding a game takes three files, and nothing needs registering.

1. **Create the folder** `src/games/color-flood/` (the folder name must equal the id).

2. **`meta.ts`**

   ```ts
   import { defineMeta } from '../define';

   export default defineMeta({
     id: 'color-flood',
     title: 'Color Flood',
     tagline: 'Flood the board with one color in as few moves as possible.',
     description: 'Pick colors to grow your region from the corner until the whole board is one color.',
     howToPlay: ['Tap a color to flood your region.', 'Fill the board before you run out of moves.'],
     categories: ['puzzle', 'brain'], // first = primary
     tags: ['colors', 'flood', 'logic'],
     difficulty: 'easy',
     controls: { desktop: 'Click a color or press 1–6', touch: 'Tap a color' },
     score: { label: 'Points', format: 'points' }, // 'points' | 'time' | 'ms' | 'strokes' | 'level'
     medals: { bronze: 300, silver: 600, gold: 900 },
     theme: { from: '#0ea5e9', to: '#6366f1', accent: '#38bdf8' },
     sessionLength: '1–3 min',
     orientation: 'portrait',
     realtime: false,
     popularity: 60,
     addedAt: '2026-10-01',
   });
   ```

3. **`index.tsx`** and the component

   ```tsx
   import { defineGame } from '../define';
   import { ColorFlood } from './ColorFlood';

   export default defineGame({ Component: ColorFlood });
   ```

   ```tsx
   import { useState } from 'react';
   import { DomStage, useSeededRng } from '../../engine';
   import type { GameProps } from '../../platform/types';

   export function ColorFlood({ api, paused }: GameProps) {
     const rng = useSeededRng(api.seed);
     const [moves, setMoves] = useState(0);
     // …build the board with rng, handle input (ignore it while `paused`)…
     const finish = (score: number, won: boolean) =>
       api.gameOver({ score, won, stats: [{ label: 'Moves', value: String(moves) }] });
     return <DomStage>{/* board + color buttons */}</DomStage>;
   }
   ```

4. **`thumb.svg`**: a 320×200 original illustration. Keep the top corners clear; badges and the favorite
   button sit there.

5. **Optional: resumable rounds.** Set `resumable: true` in the meta, call `api.save(data, summary)` as the round
   progresses, and export a save spec so stored data is validated before it reaches your component:

   ```tsx
   export default defineGame({
     Component: ColorFlood,
     save: { version: 1, is: (d): d is FloodSave => floodSaveSchema.is(d) },
   });
   ```

Run `npm test`. The catalog tests check the new game's metadata (unique id, categories, medal order, thumbnail)
and that its chunk loads and exports a component. The e2e smoke test picks the new folder up automatically and
plays it on desktop and mobile.

---

## Persistence

All state lives in `localStorage` under the `nryo:` prefix, behind one API
(`src/platform/storage/persistent-store.ts`).

| Key                    | Contents                                                                       |
| ---------------------- | ------------------------------------------------------------------------------ |
| `nryo:player`          | anonymous id, nickname, avatar, accent, XP, rounds, totals, days played        |
| `nryo:settings`        | sound, volume, haptics, motion preference                                      |
| `nryo:stats`           | per game: plays, best, last score, medal, wins, time played, first/last played |
| `nryo:favorites`       | favorite game ids                                                              |
| `nryo:recent`          | recently played game ids (most recent first)                                   |
| `nryo:achievements`    | unlocked achievement ids with timestamps                                       |
| `nryo:daily`           | daily challenge records per date, streaks                                      |
| `nryo:save:<game>`     | an unfinished round + summary (powers "Continue Playing")                      |
| `nryo:progress:<game>` | long-lived game data (unlocked AI levels, ghost laps, idle economy, level)     |
| `nryo:events`          | local analytics ring buffer (never transmitted)                                |

How it stays safe:

- **Versioned envelopes**: every value is stored as `{ v: <schemaVersion>, d: <data> }`. Older versions go
  through `migrate()`, and unknown future versions are ignored rather than trusted.
- **Validation on read**: each store has a schema (`src/lib/schema.ts`: small typed combinators with `Infer<>`).
  Invalid data is repaired field by field where possible (e.g. one bad stats entry is dropped, the rest kept),
  otherwise reset to defaults. Corrupt JSON never crashes the app. The e2e suite checks this with deliberately
  broken storage.
- **Game saves are validated** against the game's own `save` spec before being handed to it, and discarded if
  they don't match.
- **Graceful degradation**: if storage is unavailable (private mode, quota), an in-memory driver takes over and
  the app keeps working for the session.
- **Cross-tab sync**: `storage` events reload the affected store, so two open tabs stay consistent.
- **Backup**: Settings → _Export backup_ downloads a JSON file. _Import backup_ validates every entry before
  replacing anything. _Reset everything_ wipes all data and creates a fresh anonymous identity.

---

## Testing

| Layer      | Where                                               | What it covers                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit       | `src/lib`, `src/platform/__tests__`                 | schema, RNG, formatting, dates, storage envelopes/migration/corruption, XP/levels, medals, achievements, daily rotation and streaks, discovery/search, rivals                                                                                                                                                                                                   |
| Game logic | `src/games/logic.test.ts`, `turbo-laps/sim.test.ts` | rules of many games (2048 merges, Sudoku uniqueness, Mine Sweeper flood fill, Four in a Row AI, Reversi, word lists…), plus an AI race simulation                                                                                                                                                                                                               |
| Catalog    | `src/games/catalog.test.ts`                         | metadata consistency for every game; every game chunk lazy-loads a component                                                                                                                                                                                                                                                                                    |
| Component  | `*.test.tsx`                                        | GameCard, header navigation/search, home & favorites pages, GameShell lifecycle, resume, crash isolation                                                                                                                                                                                                                                                        |
| End-to-end | `e2e/`                                              | play → results → refresh → best score kept; favorite → refresh; recently played; 2048 continue after refresh; settings persist; corrupted storage recovery; daily challenge; every game loads, plays, pauses and resumes without errors (desktop + mobile); no horizontal overflow from 360 to 1440 px; offline play via the service worker; per-route metadata |

---

## Deployment

`npm run build` produces a fully static `dist/` that any static host can serve (Netlify, Vercel, Cloudflare
Pages, GitHub Pages, S3/CloudFront, nginx).

- **Routes**: every route has a prerendered HTML file (`/games/sudoku/index.html`, …), and trailing slashes are
  handled. For unknown paths the build ships a `404.html` that boots the app and shows the not-found page. Hosts
  that serve `404.html` automatically (Netlify, GitHub Pages, Cloudflare Pages, Vercel) need no configuration.
  On nginx/S3, set `404.html` as the error document, or rewrite unknown paths to `/index.html`.
- **Environment variables** (build time):

  | Variable    | Default | Purpose                                                                                                                                   |
  | ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
  | `SITE_URL`  | unset   | Public origin, e.g. `https://arcade.example.com`. Enables absolute canonical/OG URLs, `sitemap.xml` and the sitemap line in `robots.txt`. |
  | `BASE_PATH` | `/`     | Serve from a sub-path, e.g. `BASE_PATH=/arcade/` for GitHub Pages project sites.                                                          |

  ```bash
  SITE_URL=https://arcade.example.com npm run build
  ```

- **Caching**: files in `assets/` are content-hashed and can be cached forever. Serve `sw.js` and HTML with
  `Cache-Control: no-cache`, so updates roll out on the next visit.
- **Security**: a strict Content-Security-Policy `<meta>` is injected at build time (`script-src 'self'`, no
  third-party origins). There is no `eval`, no `dangerouslySetInnerHTML`, and no user-provided HTML. Nicknames
  are sanitized and length-limited.
- **Offline**: the generated service worker precaches the app shell, every game chunk, thumbnails and fonts.
  Navigations are network-first with an offline fallback, and assets are cache-first.

### Extension points

- **Analytics**: `platform.analytics.track(name, props)` records typed events: app opened, game viewed, started,
  resumed, completed, restarted, abandoned or crashed, favorites, achievements, level-ups, daily challenge, search,
  recommendation clicks, export/import/reset. Events currently go only to a local ring buffer. To connect a
  provider, register a sink with `platform.analytics.addSink({ name, track })`.
- **Ads**: `src/platform/ads.ts` defines typed placements and a `maybeShowInterstitial()` hook between rounds.
  Ads are disabled and no ad code is loaded. `AdSlot` components render nothing while disabled.

---

## Credits & licenses

- All game code, thumbnails, icons and sound effects are original to this project. Sounds are synthesized at
  runtime.
- Word lists are derived from **SCOWL** (Spell Checker Oriented Word Lists), © 2000–2016 Kevin Atkinson, used
  under its permissive license. The full notice is embedded in `src/games/_shared/words/*.data.ts`.
- **Rubik** typeface via Fontsource, SIL Open Font License 1.1.
