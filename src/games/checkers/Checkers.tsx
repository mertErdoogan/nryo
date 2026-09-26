import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Banner, DomStage, Hint, Stat, StatBar, createContinueGate, useSeededRng } from '../../engine';
import type { GameProps } from '../../platform/types';
import { applyMove, bestMove, count, initialBoard, isDark, legalMoves, type Board, type Move } from './logic';
import styles from './Checkers.module.css';

const LEVELS = [
  { name: 'Rookie', depth: 2, noise: 140, mult: 1 },
  { name: 'Club player', depth: 4, noise: 30, mult: 2 },
  { name: 'Master', depth: 6, noise: 0, mult: 3 },
] as const;

export function Checkers({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const [light, dark, mine] = lo.skin.colors;
  const [level, setLevel] = useState<number | null>(null);
  const [board, setBoard] = useState<Board>(initialBoard);
  const [turn, setTurn] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [last, setLast] = useState<number[]>([]);
  const [hint, setHint] = useState<Move | null>(null);
  const [hints, setHints] = useState(lo.level('hint'));
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ key: number; text: string; sub?: string } | null>(null);
  const history = useRef<Board[]>([]);
  const sinceCapture = useRef(0);
  const over = useRef(false);
  const continueGate = useRef(createContinueGate(api)).current;

  const myMoves = level !== null && turn === 1 ? legalMoves(board, 1) : [];

  const finish = (result: 'win' | 'loss' | 'draw', b: Board) => {
    const lv = LEVELS[level ?? 0]!;
    const mineLeft = count(b, 1);
    const taken = 12 - count(b, -1);
    if (result === 'loss') {
      api.sfx('gameover');
      continueGate(
        () => {
          // Take back your last two moves.
          const back =
            history.current.length >= 2
              ? history.current[history.current.length - 2]!
              : (history.current[0] ?? initialBoard());
          history.current = history.current.slice(0, Math.max(0, history.current.length - 2));
          setBoard(back);
          setTurn(1);
          setLast([]);
          setBanner({ key: Date.now(), text: 'Moves taken back', sub: 'Find a better line!' });
        },
        () => {
          over.current = true;
          api.gameOver({
            score: taken * 20,
            won: false,
            stats: [
              { label: 'Pieces captured', value: String(taken) },
              { label: 'Level', value: lv.name },
            ],
          });
        },
      );
      return;
    }
    over.current = true;
    const score = result === 'win' ? 400 * lv.mult + mineLeft * 25 : 150 * lv.mult;
    api.sfx(result === 'win' ? 'win' : 'score');
    api.gameOver({
      score,
      won: result === 'win',
      stats: [
        { label: 'Result', value: result === 'win' ? 'Victory' : 'Draw' },
        { label: 'Pieces left', value: String(mineLeft) },
        { label: 'Level', value: lv.name },
      ],
    });
  };

  const commit = (b: Board, m: Move, who: 1 | -1) => {
    const next = applyMove(b, m);
    sinceCapture.current = m.captures.length ? 0 : sinceCapture.current + 1;
    setBoard(next);
    setLast([m.from, ...m.path]);
    setSelected(null);
    setHint(null);
    api.sfx(m.captures.length ? (m.captures.length > 1 ? 'perfect' : 'hit') : 'tap');
    const other: 1 | -1 = who === 1 ? -1 : 1;
    if (legalMoves(next, other).length === 0) {
      finish(who === 1 ? 'win' : 'loss', next);
      return;
    }
    if (sinceCapture.current >= 80) {
      finish('draw', next);
      return;
    }
    setTurn(other);
  };

  // AI turn
  useEffect(() => {
    if (level === null || turn !== -1 || paused || over.current) return;
    const lv = LEVELS[level]!;
    const t = setTimeout(() => {
      const m = bestMove(board, -1, lv.depth, rng.next, lv.noise);
      if (m) commit(board, m, -1);
    }, 420);
    return () => clearTimeout(t);
  }, [turn, level, paused, board]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (i: number) => {
    if (paused || turn !== 1 || over.current || level === null) return;
    const movable = new Set(myMoves.map((m) => m.from));
    if (movable.has(i)) {
      setSelected(i);
      api.sfx('click');
      return;
    }
    if (selected === null) return;
    const options = myMoves.filter((m) => m.from === selected && m.path[m.path.length - 1] === i);
    if (options.length === 0) return;
    const m = options.sort((a, b) => b.captures.length - a.captures.length)[0]!;
    history.current.push(board);
    commit(board, m, 1);
  };

  const showHint = async () => {
    if (turn !== 1 || busy) return;
    if (hints <= 0) {
      setBusy(true);
      const ok = await api.watchAd('A hint');
      setBusy(false);
      if (!ok) return;
    } else setHints((h) => h - 1);
    const m = bestMove(board, 1, 5, rng.next, 0);
    if (m) {
      setHint(m);
      setSelected(m.from);
      api.sfx('powerup');
    }
  };

  if (level === null)
    return (
      <DomStage center>
        <div className={styles.picker}>
          <h2>Choose your opponent</h2>
          {LEVELS.map((l, i) => (
            <button key={l.name} type="button" className={styles.pick} onClick={() => setLevel(i)}>
              {l.name} (bot)
              <span>{['Learns the rules', 'Plays solid', 'Thinks 6 moves ahead'][i]}</span>
            </button>
          ))}
        </div>
      </DomStage>
    );

  const targets = new Set(
    selected === null
      ? []
      : myMoves.filter((m) => m.from === selected).map((m) => m.path[m.path.length - 1]!),
  );
  const movable = new Set(myMoves.map((m) => m.from));
  const style = { '--light': light, '--dark': dark, '--mine': mine } as CSSProperties;

  return (
    <DomStage style={style}>
      <StatBar>
        <Stat label="You" value={count(board, 1)} />
        <Stat label="Bot" value={count(board, -1)} />
        <Stat label="Turn" value={turn === 1 ? 'Yours' : 'Bot…'} tone={turn === 1 ? 'good' : undefined} />
      </StatBar>
      <div className={styles.board} role="grid" aria-label="Checkers board">
        {board.map((p, i) => (
          <button
            key={i}
            type="button"
            className={styles.sq}
            data-dark={isDark(i)}
            data-target={targets.has(i) || (hint !== null && hint.path[hint.path.length - 1] === i)}
            data-last={last.includes(i)}
            aria-label={
              p === 0 ? `Square ${i}` : `${p > 0 ? 'Your' : 'Bot'} ${Math.abs(p) === 2 ? 'king' : 'piece'}`
            }
            onClick={() => tap(i)}
          >
            {p !== 0 && (
              <span
                className={styles.piece}
                data-side={p > 0 ? 'me' : 'ai'}
                data-selected={selected === i}
                data-movable={turn === 1 && movable.has(i) && myMoves.some((m) => m.captures.length > 0)}
              >
                {Math.abs(p) === 2 ? '👑' : ''}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className={styles.tools}>
        <button
          type="button"
          className={styles.tool}
          onClick={() => void showHint()}
          disabled={turn !== 1 || busy}
        >
          💡 Hint <small>{hints > 0 ? hints : 'ad'}</small>
        </button>
      </div>
      <Hint>
        {myMoves.some((m) => m.captures.length > 0) && turn === 1
          ? 'You must capture!'
          : 'Opponent is a bot.'}
      </Hint>
      {banner && <Banner key={banner.key} text={banner.text} sub={banner.sub} />}
    </DomStage>
  );
}
