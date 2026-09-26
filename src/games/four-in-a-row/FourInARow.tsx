import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { DomStage, Hint, Stat, StatBar, useKeyDown, useSeededRng } from '../../engine';
import { num, obj, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import {
  bestMove,
  canPlay,
  COLS,
  emptyBoard,
  LEVELS,
  play,
  ROWS,
  validMoves,
  winningLine,
  type Board,
} from './logic';
import styles from './FourInARow.module.css';

const progressSchema = obj({ unlocked: num({ int: true, min: 0, max: LEVELS.length - 1 }) });
type Progress = Infer<typeof progressSchema>;
export const progressSpec: VersionedSpec<Progress> = { version: 1, is: progressSchema.is };

export function FourInARow({ api, paused }: GameProps<unknown, Progress>) {
  const rng = useSeededRng(api.seed);
  const unlocked = api.progress?.unlocked ?? 0;
  const [level, setLevel] = useState<number | null>(null);
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [focus, setFocus] = useState(3);
  const [last, setLast] = useState<[number, number] | null>(null);
  const [win, setWin] = useState<[number, number][] | null>(null);
  const [moves, setMoves] = useState(0);
  const done = useRef(false);

  const finish = (result: 'win' | 'loss' | 'draw', totalMoves: number) => {
    if (done.current || level === null) return;
    done.current = true;
    const lv = LEVELS[level]!;
    const score =
      result === 'win' ? lv.points + Math.max(0, 42 - totalMoves) * 10 : result === 'draw' ? 100 : 0;
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
            { label: 'Result', value: result === 'win' ? 'You win' : result === 'draw' ? 'Draw' : 'AI wins' },
            { label: 'Moves', value: String(totalMoves) },
            ...(result === 'win' && level < LEVELS.length - 1 && level >= unlocked
              ? [{ label: 'Unlocked', value: LEVELS[level + 1]!.name }]
              : []),
          ],
        }),
      1400,
    );
  };

  const drop = (c: number, who: 1 | 2) => {
    if (!canPlay(board, c)) return;
    const next = board.map((col) => col.slice()) as Board;
    const r = play(next, c, who);
    const total = moves + 1;
    setBoard(next);
    setLast([c, r]);
    setMoves(total);
    api.sfx(who === 1 ? 'tap' : 'tick');
    const line = winningLine(next, c, r);
    if (line) {
      setWin(line);
      finish(who === 1 ? 'win' : 'loss', total);
      return;
    }
    if (validMoves(next).length === 0) {
      finish('draw', total);
      return;
    }
    setTurn(who === 1 ? 2 : 1);
  };

  // AI move after a short "thinking" pause.
  useEffect(() => {
    if (turn !== 2 || paused || done.current || level === null) return;
    const lv = LEVELS[level]!;
    const t = setTimeout(() => drop(bestMove(board, lv.depth, rng.next, lv.blunder), 2), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, paused, board, level]);

  const playerDrop = (c: number) => {
    if (paused || turn !== 1 || done.current || !canPlay(board, c)) return;
    setFocus(c);
    drop(c, 1);
  };

  useKeyDown((code) => {
    if (level === null) return false;
    if (code === 'ArrowLeft') setFocus((f) => Math.max(0, f - 1));
    else if (code === 'ArrowRight') setFocus((f) => Math.min(COLS - 1, f + 1));
    else if (code === 'Enter' || code === 'Space' || code === 'ArrowDown') playerDrop(focus);
    else if (/^Digit[1-7]$/.test(code)) playerDrop(Number(code.slice(5)) - 1);
    else return false;
  }, !paused);

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
              <small>{i > unlocked ? `Beat ${LEVELS[i - 1]!.name}` : `${lv.points} pts`}</small>
            </button>
          ))}
          <Hint>You play yellow and move first.</Hint>
        </div>
      </DomStage>
    );
  }

  const isWin = (c: number, r: number) => !!win?.some(([x, y]) => x === c && y === r);
  const status = done.current
    ? win
      ? turn === 1
        ? 'You connected four! 🎉'
        : 'The AI connected four.'
      : 'It’s a draw.'
    : turn === 1
      ? 'Your move'
      : 'AI is thinking…';

  return (
    <DomStage>
      <StatBar>
        <Stat label="Opponent" value={LEVELS[level]!.name} />
        <Stat label="Moves" value={moves} />
      </StatBar>
      <p className={styles.status} aria-live="polite">
        {status}
      </p>
      <div className={styles.board}>
        <div className={styles.cols} role="group" aria-label="Four in a Row board">
          {board.map((col, c) => (
            <button
              key={c}
              type="button"
              className={styles.col}
              data-focus={focus === c && turn === 1 && !done.current}
              disabled={turn !== 1 || done.current || !canPlay(board, c)}
              aria-label={`Column ${c + 1}`}
              onClick={() => playerDrop(c)}
            >
              {col.map((v, r) => (
                <span key={r} className={styles.slot}>
                  {v !== 0 && (
                    <span
                      className={styles.disc}
                      data-who={v}
                      data-win={isWin(c, r)}
                      style={
                        last && last[0] === c && last[1] === r
                          ? ({
                              '--fall': `${(ROWS - r) * 112}%`,
                              '--drop': `${180 + (ROWS - r) * 45}ms`,
                            } as CSSProperties)
                          : ({ animation: isWin(c, r) ? undefined : 'none' } as CSSProperties)
                      }
                    />
                  )}
                </span>
              ))}
            </button>
          ))}
        </div>
      </div>
    </DomStage>
  );
}
