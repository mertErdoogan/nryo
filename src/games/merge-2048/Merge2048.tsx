import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Banner,
  DomStage,
  PowerChip,
  Stat,
  StatBar,
  createContinueGate,
  swipeDirection,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import { arr, bool, num, obj, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import { canMove, maxTile, move, nextId, SIZE, spawn, type Dir, type Tile } from './logic';
import styles from './Merge2048.module.css';

export const saveSchema = obj({
  tiles: arr(
    obj({
      value: num({ int: true, min: 2 }),
      r: num({ int: true, min: 0, max: SIZE - 1 }),
      c: num({ int: true, min: 0, max: SIZE - 1 }),
    }),
    { max: SIZE * SIZE },
  ),
  score: num({ min: 0 }),
  moves: num({ int: true, min: 0 }),
  won: bool(),
});
export type Save2048 = Infer<typeof saveSchema>;
export const saveSpec: VersionedSpec<Save2048> = { version: 1, is: saveSchema.is };

const PALETTE: Record<number, [string, string, number?]> = {
  2: ['#fef3c7', '#422006'],
  4: ['#fde68a', '#422006'],
  8: ['#fdba74', '#431407'],
  16: ['#fb923c', '#fff'],
  32: ['#f87171', '#fff'],
  64: ['#ef4444', '#fff'],
  128: ['#facc15', '#422006', 14],
  256: ['#eab308', '#fff', 18],
  512: ['#a3e635', '#1a2e05', 20],
  1024: ['#22d3ee', '#083344', 24],
  2048: ['#a78bfa', '#fff', 30],
};

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

/** Board themes from the shop, applied as a hue rotation of the classic palette. */
const THEME_HUE: Record<string, number> = { classic: 0, ocean: 170, berry: 270, lime: 70, mono: 0 };

export function Merge2048({ api, paused }: GameProps<Save2048>) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const themeFilter =
    lo.skin.id === 'mono' ? 'grayscale(1) contrast(1.1)' : `hue-rotate(${THEME_HUE[lo.skin.id] ?? 0}deg)`;
  const [undos, setUndos] = useState(1 + lo.level('undo'));
  const [busy, setBusy] = useState(false);
  const history = useRef<{ tiles: Tile[]; score: number; moves: number; won: boolean } | null>(null);
  const continueGate = useRef(createContinueGate(api)).current;
  const [state, setState] = useState(() => {
    if (api.resume) {
      return {
        tiles: api.resume.tiles.map((t) => ({ ...t, id: nextId() })) as Tile[],
        ghosts: [] as Tile[],
        score: api.resume.score,
        moves: api.resume.moves,
        won: api.resume.won,
      };
    }
    return { tiles: spawn(spawn([], rng), rng), ghosts: [] as Tile[], score: 0, moves: 0, won: false };
  });
  const [banner, setBanner] = useState<{ key: number; text: string; sub?: string } | null>(null);
  const over = useRef(false);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);

  useEffect(() => {
    api.setScore(state.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doMove = (dir: Dir) => {
    if (paused || over.current || busy) return;
    const result = move(state.tiles, dir);
    if (!result.moved) return;
    history.current = { tiles: state.tiles, score: state.score, moves: state.moves, won: state.won };
    const tiles = spawn(result.tiles, rng);
    const score = state.score + result.gained;
    const top = maxTile(tiles);
    const justWon = !state.won && top >= 2048;
    // New personal tile records from 256 up pay coins: 256 → 1, 512 → 2, 1024 → 3…
    if (top >= 256 && top > maxTile(state.tiles)) api.addCoins(Math.log2(top) - 7);
    const next = { tiles, ghosts: result.ghosts, score, moves: state.moves + 1, won: state.won || justWon };
    setState(next);
    api.setScore(score);
    if (result.gained > 0) api.sfx(result.gained >= 128 ? 'powerup' : 'swap');
    else api.sfx('tick');
    if (justWon) {
      setBanner({ key: Date.now(), text: '2048!', sub: 'You did it — keep going for more' });
      api.sfx('win');
      api.haptic([30, 50, 30]);
    }
    if (!canMove(tiles)) {
      over.current = true;
      continueGate(
        () => {
          // Clear the four smallest tiles to open the board back up.
          const keep = [...tiles].sort((a, b) => a.value - b.value).slice(4);
          setState((st) => ({ ...st, tiles: keep, ghosts: [] }));
          setBanner({ key: Date.now(), text: 'Board opened up!' });
          over.current = false;
        },
        () =>
          api.gameOver({
            score,
            won: next.won,
            stats: [
              { label: 'Biggest tile', value: String(top) },
              { label: 'Moves', value: String(next.moves) },
            ],
          }),
      );
      return;
    }
    api.save(
      { tiles: tiles.map(({ value, r, c }) => ({ value, r, c })), score, moves: next.moves, won: next.won },
      {
        label: `Score ${score.toLocaleString('en')} · best tile ${top}`,
        progress: Math.min(1, Math.log2(top) / 11),
      },
    );
  };

  // Ghost tiles only exist for one slide animation.
  useEffect(() => {
    if (state.ghosts.length === 0) return;
    const t = setTimeout(() => setState((s) => ({ ...s, ghosts: [] })), 130);
    return () => clearTimeout(t);
  }, [state.ghosts]);

  useKeyDown((code) => {
    const dir = KEY_DIRS[code];
    if (!dir) return false;
    doMove(dir);
  }, !paused);

  const undo = async () => {
    const prev = history.current;
    if (!prev || busy || over.current) return;
    if (undos > 0) setUndos((n) => n - 1);
    else {
      setBusy(true);
      const ok = await api.watchAd('An undo');
      setBusy(false);
      if (!ok) return;
    }
    history.current = null;
    setState({ ...prev, ghosts: [] });
    api.setScore(prev.score);
    api.sfx('swap');
  };

  const renderTile = (t: Tile, ghost = false) => {
    const [bg, fg, glow] = PALETTE[t.value] ?? ['#f472b6', '#fff', 34];
    const style = {
      '--r': t.r,
      '--c': t.c,
      '--bg': bg,
      '--fg': fg,
      '--glow': glow ? `${glow}px` : '0',
    } as CSSProperties;
    const digits = String(t.value).length;
    const cls = [
      styles.tile,
      ghost && styles.ghost,
      !ghost && t.isNew && styles.new,
      !ghost && t.merged && styles.merged,
      digits === 3 && styles.big,
      digits >= 4 && styles.huge,
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <div
        key={`t${t.id}`}
        className={cls}
        style={style}
        data-tile={ghost ? undefined : `${t.value}@${t.r},${t.c}`}
      >
        <div className={styles.inner}>{t.value}</div>
      </div>
    );
  };

  return (
    <DomStage>
      <StatBar>
        <Stat label="Best tile" value={maxTile(state.tiles)} />
        <Stat label="Moves" value={state.moves} />
      </StatBar>
      <div
        className={styles.board}
        style={{ filter: themeFilter }}
        role="group"
        aria-label={`2048 board. ${state.tiles.length} tiles. Largest ${maxTile(state.tiles)}.`}
        onPointerDown={(e) => {
          swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerUp={(e) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start || start.id !== e.pointerId) return;
          const dir = swipeDirection(e.clientX - start.x, e.clientY - start.y, 22);
          if (dir) doMove(dir);
        }}
        onPointerCancel={() => (swipe.current = null)}
      >
        {Array.from({ length: SIZE * SIZE }, (_, i) => (
          <div
            key={i}
            className={styles.cell}
            style={{ '--r': Math.floor(i / SIZE), '--c': i % SIZE } as CSSProperties}
          />
        ))}
        {state.ghosts.map((t) => renderTile(t, true))}
        {state.tiles.map((t) => renderTile(t))}
      </div>
      <PowerChip
        corner="inline"
        icon="↩️"
        label="Undo move"
        badge={undos > 0 ? undos : 'ad'}
        onClick={() => void undo()}
        disabled={busy || !history.current}
      />
      {banner && <Banner key={banner.key} text={banner.text} sub={banner.sub} />}
    </DomStage>
  );
}
