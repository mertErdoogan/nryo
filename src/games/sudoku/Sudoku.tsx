import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionRow,
  DomStage,
  GameButton,
  Hint,
  Stat,
  StatBar,
  useKeyDown,
  useSeededRng,
  useStopwatch,
} from '../../engine';
import { formatClock } from '../../lib/format';
import { arr, num, obj, oneOf, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import { generate, LEVELS, peers, winScore, type Level } from './logic';
import styles from './Sudoku.module.css';

const digits81 = arr(num({ int: true, min: 0, max: 9 }), { min: 81, max: 81 });
const saveSchema = obj({
  level: oneOf(['easy', 'medium', 'hard'] as const),
  puzzle: digits81,
  solution: digits81,
  entries: digits81,
  notes: arr(num({ int: true, min: 0, max: 1023 }), { min: 81, max: 81 }),
  mistakes: num({ int: true, min: 0, max: 3 }),
  hints: num({ int: true, min: 0 }),
  elapsed: num({ min: 0 }),
});
type Save = Infer<typeof saveSchema>;
export const saveSpec: VersionedSpec<Save> = { version: 1, is: saveSchema.is };

const MAX_MISTAKES = 3;

interface Game {
  level: Level;
  puzzle: number[];
  solution: number[];
}

export function Sudoku({ api, paused }: GameProps<Save>) {
  const rng = useSeededRng(api.seed);
  const r = api.resume;
  const [game, setGame] = useState<Game | null>(() =>
    r
      ? { level: r.level, puzzle: r.puzzle, solution: r.solution }
      : api.mode === 'daily'
        ? { level: 'medium', ...generate(rng, 'medium') }
        : null,
  );
  const [entries, setEntries] = useState<number[]>(() => r?.entries ?? new Array(81).fill(0));
  const [notes, setNotes] = useState<number[]>(() => r?.notes ?? new Array(81).fill(0));
  const [mistakes, setMistakes] = useState(r?.mistakes ?? 0);
  const [hints, setHints] = useState(r?.hints ?? 0);
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsed, readElapsed] = useStopwatch(!paused && !!game && !done, r?.elapsed ?? 0);

  const value = (i: number) => (game ? game.puzzle[i] || entries[i]! : 0);
  const persist = (e: number[], n: number[], m: number, h: number) => {
    if (!game) return;
    const filled =
      e.filter((v, i) => v && v === game.solution[i]).length + game.puzzle.filter(Boolean).length;
    api.save(
      {
        level: game.level,
        puzzle: game.puzzle,
        solution: game.solution,
        entries: e,
        notes: n,
        mistakes: m,
        hints: h,
        elapsed: readElapsed(),
      },
      {
        label: `${LEVELS[game.level].label} · ${Math.round((filled / 81) * 100)}% filled`,
        progress: filled / 81,
      },
    );
  };
  const latest = useRef(() => {});
  latest.current = () => {
    if (game && !done) persist(entries, notes, mistakes, hints);
  };
  useEffect(() => {
    if (!game || done || paused) return;
    const t = setInterval(() => latest.current(), 5000);
    return () => clearInterval(t);
  }, [game, done, paused]);

  const finish = (won: boolean, e: number[], m: number, h: number) => {
    if (!game) return;
    setDone(true);
    const seconds = readElapsed();
    const correct = e.filter((v, i) => v && v === game.solution[i]).length;
    const score = won ? winScore(game.level, seconds, m, h) : correct * 5;
    api.setScore(score);
    api.sfx(won ? 'win' : 'gameover');
    setTimeout(
      () =>
        api.gameOver({
          score,
          won,
          stats: [
            { label: 'Difficulty', value: LEVELS[game.level].label },
            { label: 'Time', value: formatClock(seconds) },
            { label: 'Mistakes', value: `${m}/${MAX_MISTAKES}` },
          ],
        }),
      won ? 600 : 900,
    );
  };

  const place = (d: number) => {
    if (!game || done || paused || selected === null || game.puzzle[selected]) return;
    const i = selected;
    if (noteMode) {
      if (entries[i]) return;
      const n = notes.slice();
      n[i] = n[i]! ^ (1 << d);
      setNotes(n);
      api.sfx('tick');
      persist(entries, n, mistakes, hints);
      return;
    }
    if (entries[i] === d) return;
    const e = entries.slice();
    e[i] = d;
    const n = notes.slice();
    n[i] = 0;
    if (d === game.solution[i]) {
      // Clear this digit from peer notes.
      for (const p of peers(i)) n[p] = n[p]! & ~(1 << d);
      setEntries(e);
      setNotes(n);
      api.sfx('tap');
      const complete = e.every((v, k) => game.puzzle[k] || v === game.solution[k]);
      if (complete) finish(true, e, mistakes, hints);
      else persist(e, n, mistakes, hints);
    } else {
      const m = mistakes + 1;
      setEntries(e);
      setNotes(n);
      setMistakes(m);
      api.sfx('error');
      api.haptic(60);
      if (m >= MAX_MISTAKES) finish(false, e, m, hints);
      else persist(e, n, m, hints);
    }
  };

  const erase = () => {
    if (!game || done || selected === null || game.puzzle[selected]) return;
    const e = entries.slice();
    const n = notes.slice();
    e[selected] = 0;
    n[selected] = 0;
    setEntries(e);
    setNotes(n);
    persist(e, n, mistakes, hints);
  };

  const hint = () => {
    if (!game || done) return;
    const target =
      selected !== null && !game.puzzle[selected] && entries[selected] !== game.solution[selected]
        ? selected
        : [...Array(81).keys()].find((i) => !game.puzzle[i] && entries[i] !== game.solution[i]);
    if (target === undefined) return;
    const e = entries.slice();
    e[target] = game.solution[target]!;
    const h = hints + 1;
    setEntries(e);
    setHints(h);
    setSelected(target);
    api.sfx('powerup');
    if (e.every((v, k) => game.puzzle[k] || v === game.solution[k])) finish(true, e, mistakes, h);
    else persist(e, notes, mistakes, h);
  };

  useKeyDown((code, ev) => {
    if (!game) return false;
    if (/^[1-9]$/.test(ev.key)) place(Number(ev.key));
    else if (code === 'Backspace' || code === 'Delete' || code === 'Digit0') erase();
    else if (code === 'KeyN') setNoteMode((m) => !m);
    else if (code.startsWith('Arrow')) {
      const cur = selected ?? 40;
      const rr = Math.floor(cur / 9);
      const cc = cur % 9;
      const next =
        code === 'ArrowUp'
          ? ((rr + 8) % 9) * 9 + cc
          : code === 'ArrowDown'
            ? ((rr + 1) % 9) * 9 + cc
            : code === 'ArrowLeft'
              ? rr * 9 + ((cc + 8) % 9)
              : rr * 9 + ((cc + 1) % 9);
      setSelected(next);
    } else return false;
  }, !paused);

  const counts = useMemo(() => {
    const c = new Array(10).fill(0);
    if (game) for (let i = 0; i < 81; i++) if (value(i) && value(i) === game.solution[i]) c[value(i)]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, entries]);

  if (!game) {
    return (
      <DomStage center>
        <div className={styles.picker}>
          <p className={styles.pickerTitle}>Pick a difficulty</p>
          {(Object.keys(LEVELS) as Level[]).map((l) => (
            <button
              key={l}
              type="button"
              className={styles.levelButton}
              onClick={() => setGame({ level: l, ...generate(rng, l) })}
            >
              {LEVELS[l].label}
            </button>
          ))}
          <Hint>Every puzzle has exactly one solution.</Hint>
        </div>
      </DomStage>
    );
  }

  const selVal = selected !== null ? value(selected) : 0;
  const peerSet = selected !== null ? peers(selected) : new Set<number>();

  return (
    <DomStage>
      <StatBar>
        <Stat label={LEVELS[game.level].label} value={formatClock(elapsed)} />
        <Stat
          label="Mistakes"
          value={`${mistakes}/${MAX_MISTAKES}`}
          tone={mistakes >= 2 ? 'warn' : undefined}
        />
        {hints > 0 && <Stat label="Hints" value={hints} />}
      </StatBar>
      <div className={styles.grid} role="group" aria-label="Sudoku grid">
        {Array.from({ length: 81 }, (_, i) => {
          const v = value(i);
          const wrong = !game.puzzle[i] && !!entries[i] && entries[i] !== game.solution[i];
          return (
            <button
              key={i}
              type="button"
              className={styles.cell}
              data-row={Math.floor(i / 9)}
              data-col={i % 9}
              data-given={!!game.puzzle[i]}
              data-selected={selected === i}
              data-peer={peerSet.has(i)}
              data-same={!!selVal && v === selVal && selected !== i}
              data-wrong={wrong}
              aria-label={`Row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1}: ${v || 'empty'}`}
              onClick={() => setSelected(i)}
            >
              {v ? (
                v
              ) : notes[i] ? (
                <span className={styles.notes} aria-hidden="true">
                  {Array.from({ length: 9 }, (_, k) => (
                    <span key={k}>{notes[i]! & (1 << (k + 1)) ? k + 1 : ''}</span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className={styles.pad}>
        {Array.from({ length: 9 }, (_, k) => (
          <button
            key={k}
            type="button"
            className={styles.digit}
            disabled={counts[k + 1] >= 9}
            onClick={() => place(k + 1)}
          >
            {k + 1}
            <small>{9 - counts[k + 1]}</small>
          </button>
        ))}
      </div>
      <ActionRow>
        <GameButton onClick={erase} label="Erase">
          ⌫ Erase
        </GameButton>
        <GameButton pressed={noteMode} onClick={() => setNoteMode((m) => !m)} label="Toggle notes">
          ✏️ Notes {noteMode ? 'on' : 'off'}
        </GameButton>
        <GameButton onClick={hint} label="Use a hint">
          💡 Hint
        </GameButton>
      </ActionRow>
    </DomStage>
  );
}
