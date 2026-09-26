import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Banner,
  DomStage,
  Stat,
  StatBar,
  TimerBar,
  createContinueGate,
  useCountdown,
  useKeyDown,
  useSeededRng,
} from '../../engine';
import type { GameProps } from '../../platform/types';
import { applyMove, canMove, colorsForLevel, generate, isSolved, solve, CAPACITY, type Tubes } from './logic';
import styles from './BallSort.module.css';

const PALETTES: Record<string, string[]> = {
  classic: [
    '#ef4444',
    '#3b82f6',
    '#22c55e',
    '#facc15',
    '#a855f7',
    '#f97316',
    '#ec4899',
    '#14b8a6',
    '#8b5cf6',
    '#84cc16',
    '#f8fafc',
  ],
  pastel: [
    '#fda4af',
    '#a5b4fc',
    '#86efac',
    '#fde68a',
    '#d8b4fe',
    '#fdba74',
    '#f9a8d4',
    '#99f6e4',
    '#c4b5fd',
    '#d9f99d',
    '#e2e8f0',
  ],
  neon: [
    '#f0abfc',
    '#67e8f9',
    '#bef264',
    '#fde047',
    '#c084fc',
    '#fb923c',
    '#f472b6',
    '#2dd4bf',
    '#818cf8',
    '#a3e635',
    '#ffffff',
  ],
  gems: [
    '#be123c',
    '#1d4ed8',
    '#047857',
    '#ca8a04',
    '#7e22ce',
    '#c2410c',
    '#be185d',
    '#0f766e',
    '#4338ca',
    '#4d7c0f',
    '#cbd5e1',
  ],
  planets: [
    '#f97316',
    '#0ea5e9',
    '#a3e635',
    '#fbbf24',
    '#e879f9',
    '#dc2626',
    '#fb7185',
    '#22d3ee',
    '#6366f1',
    '#65a30d',
    '#f1f5f9',
  ],
};
const START_TIME = 100;

export function BallSort({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const palette = PALETTES[lo.skin.id] ?? PALETTES.classic!;
  const undoPerLevel = 3 + 2 * lo.level('undo');
  const [level, setLevel] = useState(1);
  const [tubes, setTubes] = useState<Tubes>(() => generate(colorsForLevel(1), rng));
  const [selected, setSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<Tubes[]>([]);
  const [undos, setUndos] = useState(undoPerLevel);
  const [freeHints, setFreeHints] = useState(lo.level('hint'));
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [extraUsed, setExtraUsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ key: number; text: string; sub?: string } | null>(null);
  const [transition, setTransition] = useState(false);
  const stats = useRef({ score: 0, moves: 0, levelMoves: 0, solved: 0, over: false, waiting: false });
  const continueGate = useRef(createContinueGate(api)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const timeUp = () => {
    if (stats.current.over || stats.current.waiting) return;
    stats.current.waiting = true;
    api.sfx('gameover');
    continueGate(
      () => {
        stats.current.waiting = false;
        clock.reset(45);
        setBanner({ key: Date.now(), text: '+45 seconds' });
      },
      () => {
        stats.current.over = true;
        api.gameOver({
          score: stats.current.score,
          stats: [
            { label: 'Levels solved', value: String(stats.current.solved) },
            { label: 'Moves', value: String(stats.current.moves) },
          ],
        });
      },
    );
  };
  const clock = useCountdown(START_TIME + 20 * lo.level('time'), !paused && !transition && !busy, timeUp);

  const nextLevel = () => {
    const n = level + 1;
    setLevel(n);
    setTubes(generate(colorsForLevel(n), rng));
    setHistory([]);
    setUndos(undoPerLevel);
    setExtraUsed(false);
    setSelected(null);
    setHint(null);
    setTransition(false);
  };

  const tap = (i: number) => {
    if (paused || transition || busy || stats.current.over || stats.current.waiting) return;
    setHint(null);
    if (selected === null) {
      if (tubes[i]!.length === 0) return;
      setSelected(i);
      api.sfx('tap');
      return;
    }
    if (selected === i) {
      setSelected(null);
      return;
    }
    if (!canMove(tubes, selected, i)) {
      if (tubes[i]!.length > 0) setSelected(i);
      else setSelected(null);
      api.sfx('error');
      return;
    }
    const next = tubes.map((t) => t.slice());
    applyMove(next, selected, i);
    setHistory((h) => [...h.slice(-30), tubes]);
    setTubes(next);
    setSelected(null);
    stats.current.moves += 1;
    stats.current.levelMoves += 1;
    const doneTube = next[i]!.length === CAPACITY && next[i]!.every((c) => c === next[i]![0]);
    api.sfx(doneTube ? 'score' : 'swap');
    if (isSolved(next)) {
      const colors = colorsForLevel(level);
      const par = colors * 4;
      const pts = 100 + colors * 20 + Math.max(0, par - stats.current.levelMoves) * 5;
      stats.current.score += pts;
      stats.current.solved += 1;
      stats.current.levelMoves = 0;
      api.setScore(stats.current.score);
      clock.add(30 + colors * 3);
      setTransition(true);
      setBanner({
        key: Date.now(),
        text: `Level ${level} solved!`,
        sub: `+${pts} pts · +${30 + colors * 3}s`,
      });
      api.sfx('win');
      if (level % 3 === 0) api.addCoins(2);
      timers.current.push(setTimeout(nextLevel, 1300));
    }
  };

  const undo = () => {
    if (undos <= 0 || history.length === 0 || transition) return;
    setTubes(history[history.length - 1]!);
    setHistory((h) => h.slice(0, -1));
    setUndos((u) => u - 1);
    setSelected(null);
    api.sfx('click');
  };

  const showHint = () => {
    const sol = solve(tubes, CAPACITY, 40000);
    if (sol && sol.length) {
      setHint(sol[0]!);
      setSelected(null);
      api.sfx('powerup');
    } else {
      setBanner({ key: Date.now(), text: 'No clear path', sub: 'Try undo or an extra tube' });
      api.sfx('error');
    }
  };

  const hintClick = async () => {
    if (transition || busy) return;
    if (freeHints > 0) {
      setFreeHints((h) => h - 1);
      showHint();
      return;
    }
    setBusy(true);
    const ok = await api.watchAd('A hint');
    setBusy(false);
    if (ok) showHint();
  };

  const extraTube = async () => {
    if (extraUsed || transition || busy) return;
    setBusy(true);
    const ok = await api.watchAd('An extra empty tube');
    setBusy(false);
    if (ok) {
      setTubes((t) => [...t.map((x) => x.slice()), []]);
      setExtraUsed(true);
      api.sfx('powerup');
    }
  };

  useKeyDown((code) => {
    const m = /^Digit(\d)$/.exec(code);
    if (m) {
      const n = Number(m[1]) === 0 ? 9 : Number(m[1]) - 1;
      if (n < tubes.length) tap(n);
    } else if (code === 'KeyZ' || code === 'Backspace') undo();
    else if (code === 'Escape') setSelected(null);
  }, !paused);

  const perRow = tubes.length <= 7 ? tubes.length : Math.ceil(tubes.length / 2);
  const style = { '--per-row': perRow } as CSSProperties;

  return (
    <DomStage>
      <StatBar>
        <Stat label="Level" value={level} />
        <Stat
          label="Time"
          value={`${Math.ceil(clock.remaining)}s`}
          tone={clock.remaining < 15 ? 'warn' : undefined}
        />
        <Stat label="Score" value={stats.current.score} />
      </StatBar>
      <TimerBar ratio={Math.min(1, clock.remaining / 120)} label="Time left" />
      <div className={styles.board} style={style} role="group" aria-label="Tubes">
        {tubes.map((t, i) => {
          const done = t.length === CAPACITY && t.every((c) => c === t[0]);
          return (
            <button
              key={i}
              type="button"
              className={styles.tube}
              data-selected={selected === i}
              data-hint={hint !== null && (hint[0] === i || hint[1] === i)}
              data-done={done}
              aria-label={`Tube ${i + 1}: ${t.length} balls`}
              onClick={() => tap(i)}
            >
              {t.map((c, k) => (
                <span key={k} className={styles.ball} style={{ background: palette[c % palette.length] }} />
              ))}
            </button>
          );
        })}
      </div>
      <div className={styles.tools}>
        <button
          type="button"
          className={styles.tool}
          onClick={undo}
          disabled={undos <= 0 || history.length === 0}
        >
          ↩️ Undo <small>{undos}</small>
        </button>
        <button type="button" className={styles.tool} onClick={() => void hintClick()} disabled={busy}>
          💡 Hint <small>{freeHints > 0 ? freeHints : 'ad'}</small>
        </button>
        <button
          type="button"
          className={styles.tool}
          onClick={() => void extraTube()}
          disabled={extraUsed || busy}
        >
          ➕ Tube <small>ad</small>
        </button>
      </div>
      {banner && <Banner key={banner.key} text={banner.text} sub={banner.sub} />}
    </DomStage>
  );
}
