import { useEffect, useMemo, useRef, useState } from 'react';
import { DomStage, Hint, Stat, StatBar, createContinueGate, useSeededRng } from '../../engine';
import { num, obj, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import { apply, bestMove, count, flipsFor, initialBoard, legalMoves, LEVELS, N, type Board } from './logic';
import styles from './Reversi.module.css';

const progressSchema = obj({ unlocked: num({ int: true, min: 0, max: LEVELS.length - 1 }) });
type Progress = Infer<typeof progressSchema>;
export const progressSpec: VersionedSpec<Progress> = { version: 1, is: progressSchema.is };

export function Reversi({ api, paused }: GameProps<unknown, Progress>) {
  const rng = useSeededRng(api.seed);
  const unlocked = api.progress?.unlocked ?? 0;
  const [level, setLevel] = useState<number | null>(null);
  const [board, setBoard] = useState<Board>(initialBoard);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [last, setLast] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const done = useRef(false);
  // Board at the start of each of the player's turns, for the "rewind" continue.
  const history = useRef<Board[]>([]);
  const continueGate = useRef(createContinueGate(api)).current;

  const playerMoves = useMemo(() => new Set(turn === 1 ? legalMoves(board, 1) : []), [board, turn]);

  const finish = (b: Board) => {
    if (done.current || level === null) return;
    done.current = true;
    const mine = count(b, 1);
    const theirs = count(b, 2);
    const result = mine > theirs ? 'win' : mine === theirs ? 'draw' : 'loss';
    if (result === 'loss' && history.current.length >= 3) {
      api.sfx('miss');
      continueGate(
        () => {
          // Rewind three of your moves and try a different line.
          const back = history.current[history.current.length - 3]!;
          history.current = history.current.slice(0, -3);
          setBoard(back);
          setFlipped(new Set());
          setLast(null);
          setNote('Rewound three moves — find a better line!');
          setTurn(1);
          done.current = false;
        },
        () => settle(b, result),
      );
      return;
    }
    settle(b, result);
  };

  const settle = (b: Board, result: 'win' | 'draw' | 'loss') => {
    if (level === null) return;
    const mine = count(b, 1);
    const theirs = count(b, 2);
    const lv = LEVELS[level]!;
    if (result === 'win') api.addCoins(2 + 2 * level);
    const score = result === 'win' ? lv.points + (mine - theirs) * 10 : result === 'draw' ? 150 : mine * 3;
    api.setScore(score);
    if (result === 'win' && level >= unlocked && level < LEVELS.length - 1 && api.mode === 'normal')
      api.saveProgress({ unlocked: level + 1 });
    api.sfx(result === 'win' ? 'win' : result === 'draw' ? 'score' : 'gameover');
    setTimeout(
      () =>
        api.gameOver({
          score,
          won: result === 'win',
          stats: [
            { label: 'Opponent', value: lv.name },
            { label: 'Discs', value: `${mine} – ${theirs}` },
          ],
        }),
      1400,
    );
  };

  const place = (i: number, who: 1 | 2) => {
    const flips = flipsFor(board, i, who);
    if (!flips.length) return;
    if (who === 1) history.current.push(board);
    const next = apply(board, i, who);
    setBoard(next);
    setFlipped(new Set(flips));
    setLast(i);
    setNote(null);
    api.sfx(flips.length >= 4 ? 'swap' : 'tap');
    const other: 1 | 2 = who === 1 ? 2 : 1;
    if (legalMoves(next, other).length) setTurn(other);
    else if (legalMoves(next, who).length) {
      setNote(other === 1 ? 'You have no moves — pass.' : 'AI has no moves — your turn again.');
      setTurn(who);
    } else finish(next);
  };

  useEffect(() => {
    if (turn !== 2 || paused || done.current || level === null) return;
    const lv = LEVELS[level]!;
    const t = setTimeout(() => {
      const m = bestMove(board, lv.depth, rng.next, lv.blunder);
      if (m !== null) place(m, 2);
    }, 550);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, paused, board, level]);

  if (level === null) {
    return (
      <DomStage center>
        <div className={styles.picker}>
          <p className={styles.pickerTitle}>Choose your opponent</p>
          {LEVELS.map((lv, i) => (
            <button
              key={lv.name}
              type="button"
              className={styles.level}
              disabled={i > unlocked}
              onClick={() => setLevel(i)}
            >
              {i > unlocked ? '🔒 ' : ''}
              {lv.name}
              <small>{i > unlocked ? `Beat ${LEVELS[i - 1]!.name}` : `${lv.points}+ pts`}</small>
            </button>
          ))}
          <Hint>You play black and move first.</Hint>
        </div>
      </DomStage>
    );
  }

  const mine = count(board, 1);
  const theirs = count(board, 2);
  const status = done.current
    ? mine > theirs
      ? 'You win! 🎉'
      : mine === theirs
        ? 'Draw'
        : 'The AI wins'
    : (note ?? (turn === 1 ? 'Your move' : 'AI is thinking…'));

  return (
    <DomStage>
      <StatBar>
        <Stat label="⚫ You" value={mine} tone={mine > theirs ? 'good' : undefined} />
        <Stat label="⚪ AI" value={theirs} />
        <Stat label="Opponent" value={LEVELS[level]!.name} />
      </StatBar>
      <p className={styles.status} aria-live="polite">
        {status}
      </p>
      <div className={styles.board} role="group" aria-label="Reversi board">
        {board.map((v, i) => {
          const legal = playerMoves.has(i) && !paused && !done.current;
          return (
            <button
              key={i}
              type="button"
              className={styles.cell}
              disabled={!legal}
              aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}${v ? (v === 1 ? ', black' : ', white') : legal ? ', legal move' : ''}`}
              onClick={() => legal && place(i, 1)}
            >
              {v !== 0 && (
                <span
                  key={`${i}-${v}`}
                  className={styles.disc}
                  data-who={v}
                  data-flip={flipped.has(i)}
                  data-new={last === i}
                />
              )}
              {legal && <span className={styles.hint} />}
              {last === i && <span className={styles.last} />}
            </button>
          );
        })}
      </div>
    </DomStage>
  );
}
