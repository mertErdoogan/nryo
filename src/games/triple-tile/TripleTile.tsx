import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Banner, DomStage, Stat, StatBar, createContinueGate, useSeededRng } from '../../engine';
import type { GameProps } from '../../platform/types';
import { clearTriples, generate, insertIntoTray, isFree, levelSpec, type Tile } from './logic';
import styles from './TripleTile.module.css';

const SETS: Record<string, string[]> = {
  fruit: ['🍓', '🍋', '🍇', '🍉', '🍑', '🍍', '🥝', '🍒', '🍌', '🥥', '🍏', '🫐', '🍐', '🥭'],
  animals: ['🐼', '🦊', '🐸', '🐵', '🐯', '🐨', '🐷', '🐙', '🦁', '🐰', '🐤', '🦄', '🐢', '🐳'],
  sweets: ['🧁', '🍩', '🍪', '🍫', '🍭', '🍬', '🎂', '🍦', '🥧', '🍰', '🍮', '🧇', '🥐', '🍯'],
  space: ['🚀', '🪐', '🌙', '⭐', '☄️', '🛸', '👽', '🌍', '🛰️', '🌞', '🔭', '👩‍🚀', '🌌', '🌠'],
  sports: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '⛳', '🥏', '🏒'],
};

export function TripleTile({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const icons = SETS[lo.skin.id] ?? SETS.fruit!;
  const [face, edge] = lo.skin.colors;
  const slots = 7 + lo.level('slot');
  const undoPerLevel = 1 + lo.level('undo');
  const shufflePerLevel = 1 + lo.level('shuffle');
  const [level, setLevel] = useState(1);
  const [tiles, setTiles] = useState<Tile[]>(() => generate(1, rng));
  const [tray, setTray] = useState<Tile[]>([]);
  const [lastPicked, setLastPicked] = useState<Tile | null>(null);
  const [undos, setUndos] = useState(undoPerLevel);
  const [shuffles, setShuffles] = useState(shufflePerLevel);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ key: number; text: string; sub?: string } | null>(null);
  const stats = useRef({ score: 0, triples: 0, over: false, waiting: false });
  const continueGate = useRef(createContinueGate(api)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const startLevel = (n: number) => {
    setLevel(n);
    setTiles(generate(n, rng));
    setTray([]);
    setLastPicked(null);
    setUndos(undoPerLevel);
    setShuffles(shufflePerLevel);
  };

  const stuck = (nextTray: Tile[], board: Tile[]) => {
    stats.current.waiting = true;
    api.sfx('gameover');
    continueGate(
      () => {
        // Put the last three tray tiles back on the board.
        const back = nextTray.slice(-3);
        const ids = new Set(back.map((t) => t.id));
        setTiles(board.map((t) => (ids.has(t.id) ? { ...t, state: 'board' } : t)));
        setTray(nextTray.slice(0, -3));
        setLastPicked(null);
        stats.current.waiting = false;
        setBanner({ key: Date.now(), text: '3 tiles returned' });
      },
      () => {
        stats.current.over = true;
        api.gameOver({
          score: stats.current.score,
          stats: [
            { label: 'Level', value: String(level) },
            { label: 'Triples', value: String(stats.current.triples) },
          ],
        });
      },
    );
  };

  const pick = (t: Tile) => {
    if (paused || busy || stats.current.over || stats.current.waiting) return;
    if (!isFree(t, tiles) || tray.length >= slots) return;
    const board = tiles.map((x) => (x.id === t.id ? { ...x, state: 'tray' as const } : x));
    let nextTray = insertIntoTray(tray, { ...t, state: 'tray' });
    const { tray: after, cleared } = clearTriples(nextTray);
    let finalBoard = board;
    if (cleared.length === 3) {
      const ids = new Set(cleared.map((c) => c.id));
      finalBoard = board.map((x) => (ids.has(x.id) ? { ...x, state: 'gone' as const } : x));
      nextTray = after;
      stats.current.triples += 1;
      stats.current.score += 30;
      api.setScore(stats.current.score);
      api.sfx('score');
      setLastPicked(null);
    } else {
      api.sfx('tap');
      setLastPicked(t);
    }
    setTiles(finalBoard);
    setTray(nextTray);
    if (finalBoard.every((x) => x.state === 'gone')) {
      const bonus = 150 + level * 50;
      stats.current.score += bonus;
      api.setScore(stats.current.score);
      api.addCoins(1 + Math.floor(level / 2));
      setBanner({ key: Date.now(), text: `Level ${level} clear!`, sub: `+${bonus} pts` });
      api.sfx('win');
      setBusy(true);
      timers.current.push(
        setTimeout(() => {
          setBusy(false);
          startLevel(level + 1);
        }, 1300),
      );
    } else if (nextTray.length >= slots) stuck(nextTray, finalBoard);
  };

  const doUndo = () => {
    if (!lastPicked || busy) return;
    const id = lastPicked.id;
    setTray((tr) => tr.filter((x) => x.id !== id));
    setTiles((ts) => ts.map((x) => (x.id === id ? { ...x, state: 'board' } : x)));
    setLastPicked(null);
    api.sfx('click');
  };

  const doShuffle = () => {
    const board = tiles.filter((t) => t.state === 'board');
    const types = rng.shuffle(board.map((t) => t.type));
    const map = new Map(board.map((t, i) => [t.id, types[i]!]));
    setTiles((ts) => ts.map((x) => (map.has(x.id) ? { ...x, type: map.get(x.id)! } : x)));
    api.sfx('swap');
  };

  const booster = async (kind: 'undo' | 'shuffle') => {
    if (busy || stats.current.over || stats.current.waiting) return;
    const left = kind === 'undo' ? undos : shuffles;
    if (kind === 'undo' && !lastPicked) return;
    if (left > 0) {
      if (kind === 'undo') {
        setUndos((u) => u - 1);
        doUndo();
      } else {
        setShuffles((s) => s - 1);
        doShuffle();
      }
      return;
    }
    setBusy(true);
    const ok = await api.watchAd(kind === 'undo' ? 'An undo' : 'A shuffle');
    setBusy(false);
    if (ok) {
      if (kind === 'undo') doUndo();
      else doShuffle();
    }
  };

  const style = { '--face': face, '--edge': edge, '--slots': slots } as CSSProperties;
  const remaining = tiles.filter((t) => t.state === 'board').length;

  return (
    <DomStage style={style}>
      <StatBar>
        <Stat label="Level" value={level} />
        <Stat label="Tiles left" value={`${remaining}/${levelSpec(level).total}`} />
        <Stat label="Score" value={stats.current.score} />
      </StatBar>
      <div className={styles.wrap}>
        <div className={styles.board}>
          {tiles
            .filter((t) => t.state === 'board')
            .sort((a, b) => a.layer - b.layer || a.y - b.y)
            .map((t) => {
              const free = isFree(t, tiles);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={styles.tile}
                  data-free={free}
                  aria-label={free ? `Tile ${icons[t.type % icons.length]}` : 'Covered tile'}
                  aria-disabled={!free}
                  style={{
                    left: `calc(var(--t) * ${t.x / 2 + 0.1})`,
                    top: `calc(var(--t) * ${t.y / 2 + 0.05} - var(--t) * ${t.layer * 0.06})`,
                    zIndex: t.layer * 20 + t.y,
                  }}
                  onClick={() => pick(t)}
                >
                  {icons[t.type % icons.length]}
                </button>
              );
            })}
        </div>
        <div className={styles.tray} data-danger={tray.length >= slots - 2} aria-label="Tray">
          {Array.from({ length: slots }, (_, i) => {
            const t = tray[i];
            return (
              <span key={t ? `t${t.id}` : `e${i}`} className={styles.slot} data-filled={!!t}>
                {t ? icons[t.type % icons.length] : ''}
              </span>
            );
          })}
        </div>
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.tool}
            onClick={() => void booster('undo')}
            disabled={busy || !lastPicked}
          >
            ↩️ Undo <small>{undos > 0 ? undos : 'ad'}</small>
          </button>
          <button
            type="button"
            className={styles.tool}
            onClick={() => void booster('shuffle')}
            disabled={busy}
          >
            🔀 Shuffle <small>{shuffles > 0 ? shuffles : 'ad'}</small>
          </button>
        </div>
      </div>
      {banner && <Banner key={banner.key} text={banner.text} sub={banner.sub} />}
    </DomStage>
  );
}
