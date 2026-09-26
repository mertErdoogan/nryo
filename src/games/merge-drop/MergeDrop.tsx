import type { CSSProperties } from 'react';
import { useRef, useState } from 'react';
import {
  Banner,
  DomStage,
  Stat,
  StatBar,
  createContinueGate,
  hsl,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { GameProps } from '../../platform/types';
import { COLS, ROWS, drop, emptyGrid, height, isFull, value, type Block, type Grid } from './logic';
import styles from './MergeDrop.module.css';

const HUES: Record<string, number> = { candy: 320, ocean: 190, sunset: 15, forest: 110, mono: 240 };
const fmt = (n: number) =>
  n >= 1_000_000
    ? `${Math.round(n / 100_000) / 10}M`
    : n >= 10_000
      ? `${Math.round(n / 100) / 10}K`
      : String(n);

export function MergeDrop({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const baseHue = HUES[lo.skin.id] ?? 320;
  const lucky = lo.level('lucky');
  const previewCount = 1 + lo.level('preview');
  const nextId = useRef(1);
  const stats = useRef({ score: 0, maxExp: 1, merges: 0, bestChain: 0, over: false, waiting: false });

  const randomExp = () => {
    const cap = Math.max(2, Math.min(6, stats.current.maxExp - 2));
    const lowWeight = Math.max(0.2, 1 - lucky * 0.25);
    const weights = Array.from({ length: cap }, (_, i) => (i === 0 ? lowWeight : 1 / (1 + i * 0.4)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * total;
    for (let i = 0; i < cap; i++) {
      r -= weights[i]!;
      if (r <= 0) return i + 1;
    }
    return 1;
  };
  const makeBlock = (): Block => ({ id: nextId.current++, exp: randomExp() });

  const [grid, setGrid] = useState<Grid>(() => emptyGrid());
  const [queue, setQueue] = useState<Block[]>(() => [makeBlock(), makeBlock(), makeBlock()]);
  const [hammers, setHammers] = useState(1 + lo.level('hammer'));
  const [hammerMode, setHammerMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [popped, setPopped] = useState<Set<number>>(new Set());
  const [banner, setBanner] = useState<{ key: number; text: string; sub?: string } | null>(null);
  const continueGate = useRef(createContinueGate(api)).current;

  const colorFor = (exp: number) => hsl(baseHue + exp * 33, 70, Math.max(38, 62 - exp * 1.5));

  const gameOver = (g: Grid) => {
    stats.current.waiting = true;
    api.sfx('gameover');
    continueGate(
      () => {
        stats.current.waiting = false;
        const next = g.map((col) => col.map((b, r) => (r >= ROWS - 3 ? null : b)));
        setGrid(next);
        setBanner({ key: Date.now(), text: 'Top rows cleared!' });
      },
      () => {
        stats.current.over = true;
        api.gameOver({
          score: stats.current.score,
          stats: [
            { label: 'Biggest block', value: fmt(value(stats.current.maxExp)) },
            { label: 'Best chain', value: String(stats.current.bestChain) },
          ],
        });
      },
    );
  };

  const dropInto = (col: number) => {
    if (paused || busy || stats.current.over || stats.current.waiting) return;
    if (hammerMode) return;
    if (height(grid, col) >= ROWS) {
      api.sfx('error');
      return;
    }
    const block = { ...queue[0]! };
    const next = grid.map((c) => c.slice());
    const result = drop(next, col, block);
    if (!result.ok) return;
    setQueue((q) => [...q.slice(1), makeBlock()]);
    setGrid(next);
    const s = stats.current;
    if (result.merges > 0) {
      s.score += result.points;
      s.merges += result.merges;
      s.bestChain = Math.max(s.bestChain, result.chain);
      api.setScore(s.score);
      setPopped(new Set([block.id]));
      if (result.chain >= 2)
        setBanner({ key: Date.now(), text: `Chain ×${result.chain}!`, sub: `+${fmt(result.points)}` });
      api.sfx(result.chain >= 2 ? 'perfect' : 'score');
      if (result.maxExp > s.maxExp) {
        s.maxExp = result.maxExp;
        if (result.maxExp >= 9) {
          api.addCoins(result.maxExp - 7);
          setBanner({ key: Date.now(), text: `New block: ${fmt(value(result.maxExp))}!` });
          api.sfx('levelup');
        }
      }
    } else api.sfx('tap');
    if (isFull(next)) gameOver(next);
  };

  const smash = (b: Block) => {
    if (!hammerMode) return;
    const next = grid.map((c) => {
      const kept = c.filter((x): x is Block => x !== null && x.id !== b.id);
      return Array.from({ length: ROWS }, (_, r) => kept[r] ?? null);
    });
    setGrid(next);
    setHammers((h) => Math.max(0, h - 1));
    setHammerMode(false);
    api.sfx('explode');
  };

  const hammerClick = async () => {
    if (busy || stats.current.over) return;
    if (hammerMode) {
      setHammerMode(false);
      return;
    }
    if (hammers > 0) {
      setHammerMode(true);
      return;
    }
    setBusy(true);
    const ok = await api.watchAd('A hammer');
    setBusy(false);
    if (ok) {
      setHammers(1);
      setHammerMode(true);
    }
  };

  useKeyDown((code) => {
    const m = /^Digit([1-5])$/.exec(code);
    if (m) dropInto(Number(m[1]) - 1);
  }, !paused);

  const maxHeight = Math.max(...Array.from({ length: COLS }, (_, c) => height(grid, c)));

  return (
    <DomStage>
      <StatBar>
        <Stat label="Score" value={fmt(stats.current.score)} />
        <Stat label="Biggest" value={fmt(value(stats.current.maxExp))} />
      </StatBar>
      <div className={styles.area}>
        <div className={styles.next}>
          Next
          {queue.slice(0, previewCount + 1).map((b, i) => (
            <span
              key={b.id}
              className={styles.block}
              style={
                {
                  position: 'relative',
                  background: colorFor(b.exp),
                  opacity: i === 0 ? 1 : 0.55,
                  transform: i === 0 ? 'none' : 'scale(0.75)',
                  fontSize: 'calc(var(--cell) * 0.34)',
                } as CSSProperties
              }
            >
              {fmt(value(b.exp))}
            </span>
          ))}
        </div>
        <div className={styles.board} data-hammer={hammerMode}>
          {maxHeight >= ROWS - 1 && <div className={styles.danger} />}
          {grid.flatMap((col, c) =>
            col.map((b, r) =>
              b ? (
                <button
                  key={b.id}
                  type="button"
                  tabIndex={hammerMode ? 0 : -1}
                  aria-label={hammerMode ? `Smash ${value(b.exp)}` : String(value(b.exp))}
                  className={styles.block}
                  data-pop={popped.has(b.id)}
                  onAnimationEnd={() => setPopped(new Set())}
                  onClick={() => smash(b)}
                  style={{
                    left: `calc(var(--cell) * ${c})`,
                    bottom: `calc(var(--cell) * ${r})`,
                    background: colorFor(b.exp),
                    fontSize: `calc(var(--cell) * ${b.exp >= 14 ? 0.24 : b.exp >= 10 ? 0.28 : 0.36})`,
                    zIndex: hammerMode ? 3 : 1,
                  }}
                >
                  {fmt(value(b.exp))}
                </button>
              ) : null,
            ),
          )}
          {Array.from({ length: COLS }, (_, c) => (
            <button
              key={`col${c}`}
              type="button"
              className={styles.col}
              style={{ left: `calc(var(--cell) * ${c})`, zIndex: 2 }}
              aria-label={`Drop in column ${c + 1}`}
              onClick={() => dropInto(c)}
            />
          ))}
        </div>
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.tool}
            aria-pressed={hammerMode}
            onClick={() => void hammerClick()}
            disabled={busy}
          >
            🔨 Hammer <small>{hammers > 0 ? hammers : 'ad'}</small>
          </button>
        </div>
      </div>
      {banner && <Banner key={banner.key} text={banner.text} sub={banner.sub} />}
    </DomStage>
  );
}
