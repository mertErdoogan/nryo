import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ActionRow, DomStage, GameButton, Hint, Stat, StatBar, useSeededRng, useStopwatch } from '../../engine';
import { formatClock } from '../../lib/format';
import { arr, bool, num, obj, oneOf, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import { counts, flood, isWon, LEVELS, neighbors, placeMines, winScore, type Level } from './logic';
import styles from './MineSweeper.module.css';

const idx = num({ int: true, min: 0, max: 400 });
const saveSchema = obj({
  level: oneOf(['easy', 'medium', 'hard'] as const),
  mines: arr(bool(), { max: 400 }),
  revealed: arr(idx, { max: 400 }),
  flags: arr(idx, { max: 400 }),
  elapsed: num({ min: 0 }),
});
type Save = Infer<typeof saveSchema>;
export const saveSpec: VersionedSpec<Save> = { version: 1, is: saveSchema.is };

const LONG_PRESS_MS = 380;

export function MineSweeper({ api, paused }: GameProps<Save>) {
  const rng = useSeededRng(api.seed);
  const resume = api.resume;
  const [level, setLevel] = useState<Level | null>(() => resume?.level ?? (api.mode === 'daily' ? 'medium' : null));
  const [mines, setMines] = useState<boolean[] | null>(() => resume?.mines ?? null);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set(resume?.revealed));
  const [flags, setFlags] = useState<Set<number>>(() => new Set(resume?.flags));
  const [flagMode, setFlagMode] = useState(false);
  const [boom, setBoom] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [elapsed, readElapsed] = useStopwatch(!paused && !!mines && !done, resume?.elapsed ?? 0);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; index: number; fired: boolean } | null>(null);

  const cfg = level ? LEVELS[level] : null;
  const nums = mines && cfg ? counts(mines, cfg.rows, cfg.cols) : null;

  const persist = (m: boolean[], rev: Set<number>, fl: Set<number>) => {
    if (!level || !cfg) return;
    const safeCells = cfg.rows * cfg.cols - cfg.mines;
    api.save(
      { level, mines: m, revealed: [...rev], flags: [...fl], elapsed: readElapsed() },
      { label: `${cfg.label} · ${Math.round((rev.size / safeCells) * 100)}% cleared`, progress: rev.size / safeCells },
    );
  };

  // Keep the elapsed time fresh in the save while playing.
  const persistLatest = useRef(() => {});
  persistLatest.current = () => {
    if (mines && !done) persist(mines, revealed, flags);
  };
  useEffect(() => {
    if (!mines || done || paused) return;
    const t = setInterval(() => persistLatest.current(), 5000);
    return () => clearInterval(t);
  }, [mines, done, paused]);

  const lose = (hit: number, m: boolean[], rev: Set<number>) => {
    setBoom(hit);
    setDone(true);
    api.sfx('explode');
    api.haptic([80, 50, 120]);
    const safeRevealed = [...rev].filter((i) => !m[i]).length;
    setTimeout(
      () =>
        api.gameOver({
          score: safeRevealed * 2,
          won: false,
          stats: [
            { label: 'Board', value: cfg!.label },
            { label: 'Cleared', value: `${safeRevealed} squares` },
          ],
        }),
      1100,
    );
  };

  const win = (rev: Set<number>) => {
    setDone(true);
    api.sfx('win');
    const seconds = readElapsed();
    const score = winScore(level!, seconds);
    api.setScore(score);
    setTimeout(
      () =>
        api.gameOver({
          score,
          won: true,
          stats: [
            { label: 'Board', value: cfg!.label },
            { label: 'Time', value: formatClock(seconds) },
            { label: 'Squares', value: String(rev.size) },
          ],
        }),
      600,
    );
  };

  const toggleFlag = (i: number) => {
    if (done || revealed.has(i) || !mines) return;
    const next = new Set(flags);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setFlags(next);
    api.sfx('tick');
    api.haptic(25);
    persist(mines, revealed, next);
  };

  const reveal = (i: number) => {
    if (done || !cfg || flags.has(i)) return;
    let m = mines;
    if (!m) {
      m = placeMines(cfg.rows, cfg.cols, cfg.mines, i, rng);
      setMines(m);
    }
    const n = counts(m, cfg.rows, cfg.cols);
    let targets: number[];
    if (revealed.has(i)) {
      // Chord: reveal neighbours when flags match the number.
      if (n[i] === 0) return;
      const around = neighbors(i, cfg.rows, cfg.cols);
      const flagged = around.filter((a) => flags.has(a)).length;
      if (flagged !== n[i]) return;
      targets = around.filter((a) => !revealed.has(a) && !flags.has(a));
    } else targets = [i];
    const next = new Set(revealed);
    for (const t of targets) {
      if (m[t]) {
        lose(t, m, next);
        setRevealed(next);
        return;
      }
      for (const r of flood(t, m, n, next, flags, cfg.rows, cfg.cols)) next.add(r);
    }
    if (next.size === revealed.size) return;
    setRevealed(next);
    api.sfx(next.size - revealed.size > 5 ? 'swap' : 'tap');
    api.setScore([...next].filter((r) => !m[r]).length * 2);
    if (isWon(m, next)) win(next);
    else persist(m, next, flags);
  };

  if (!level || !cfg) {
    return (
      <DomStage center>
        <div className={styles.picker}>
          <p className={styles.pickerTitle}>Choose a minefield</p>
          {(Object.keys(LEVELS) as Level[]).map((l) => (
            <button key={l} type="button" className={styles.levelButton} onClick={() => setLevel(l)}>
              {LEVELS[l].label}
              <small>{LEVELS[l].mines} mines</small>
            </button>
          ))}
          <Hint>Harder boards are worth far more points.</Hint>
        </div>
      </DomStage>
    );
  }

  const style = { '--cols': cfg.cols, '--rows': cfg.rows } as CSSProperties;
  const minesLeft = cfg.mines - flags.size;

  return (
    <DomStage>
      <StatBar>
        <Stat label="Mines" value={minesLeft} />
        <Stat label="Time" value={formatClock(elapsed)} />
        <Stat label="Board" value={level} />
      </StatBar>
      <div className={styles.board} style={style} role="group" aria-label={`Minefield ${cfg.label}`}>
        {Array.from({ length: cfg.rows * cfg.cols }, (_, i) => {
          const open = revealed.has(i) || (done && !!mines?.[i]);
          const isMine = !!mines?.[i];
          const flagged = flags.has(i);
          let content: string | number = '';
          if (open && isMine) content = '💣';
          else if (open && nums && nums[i]! > 0) content = nums[i]!;
          else if (flagged) content = '🚩';
          return (
            <button
              key={i}
              type="button"
              className={`${styles.cell} ${typeof content === 'number' ? styles[`n${content}`] : ''}`}
              data-open={open}
              data-mine={open && isMine}
              data-boom={boom === i}
              data-wrongflag={done && flagged && !isMine}
              aria-label={open ? (isMine ? 'Mine' : `${nums?.[i] ?? 0} neighbouring mines`) : flagged ? 'Flagged' : 'Hidden'}
              onContextMenu={(e) => {
                e.preventDefault();
                toggleFlag(i);
              }}
              onPointerDown={(e) => {
                if (e.button !== 0 || paused) return;
                const timer = setTimeout(() => {
                  if (press.current) press.current.fired = true;
                  toggleFlag(i);
                }, LONG_PRESS_MS);
                press.current = { timer, index: i, fired: false };
              }}
              onPointerUp={(e) => {
                const p = press.current;
                press.current = null;
                if (!p || e.button !== 0) return;
                clearTimeout(p.timer);
                if (p.fired || p.index !== i || paused) return;
                if (flagMode && !revealed.has(i)) toggleFlag(i);
                else reveal(i);
              }}
              onPointerLeave={() => {
                if (press.current) clearTimeout(press.current.timer);
                press.current = null;
              }}
            >
              {content}
            </button>
          );
        })}
      </div>
      <ActionRow>
        <GameButton pressed={flagMode} onClick={() => setFlagMode((f) => !f)} label="Toggle flag mode">
          🚩 Flag mode {flagMode ? 'on' : 'off'}
        </GameButton>
      </ActionRow>
    </DomStage>
  );
}
