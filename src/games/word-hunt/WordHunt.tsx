import { useMemo, useRef, useState } from 'react';
import {
  Banner,
  DomStage,
  PowerChip,
  Stat,
  StatBar,
  TimerBar,
  createContinueGate,
  useCountdown,
  useSeededRng,
} from '../../engine';
import type { GameProps } from '../../platform/types';
import { generate, lineCells, matchSelection, SIZE, wordPoints, type Cell, type Placement } from './logic';
import styles from './WordHunt.module.css';

const ROUND = 150;
const COLORS = ['#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#22d3ee', '#f87171'];

export function WordHunt({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const puzzle = useMemo(() => generate(rng), [rng]);
  const [found, setFound] = useState<Placement[]>([]);
  const [selection, setSelection] = useState<Cell[]>([]);
  const [banner, setBanner] = useState<{ key: number; text: string } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const start = useRef<Cell | null>(null);
  const score = useRef(0);
  const foundCount = useRef(0);
  const over = useRef(false);
  const lo = api.loadout;
  const roundTime = ROUND + 15 * lo.level('time');
  const [hints, setHints] = useState(lo.level('hint'));
  const [hinted, setHinted] = useState<Placement | null>(null);
  const [busy, setBusy] = useState(false);
  const continueGate = useRef(createContinueGate(api)).current;

  const finish = (all: boolean, remaining: number) => {
    if (over.current) return;
    over.current = true;
    if (!all) {
      continueGate(
        () => {
          over.current = false;
          clock.reset(45);
          setBanner({ key: Date.now(), text: '+45 seconds' });
        },
        () => settle(false, 0),
      );
      return;
    }
    api.addCoins(3);
    settle(true, remaining);
  };

  const settle = (all: boolean, remaining: number) => {
    const bonus = all ? Math.round(remaining * 5) : 0;
    score.current += bonus;
    api.setScore(score.current);
    api.gameOver({
      score: score.current,
      won: all,
      stats: [
        { label: 'Theme', value: puzzle.theme },
        { label: 'Words', value: `${foundCount.current}/${puzzle.placements.length}` },
        ...(all ? [{ label: 'Time bonus', value: `+${bonus}` }] : []),
      ],
    });
  };

  const clock = useCountdown(roundTime, !paused && !busy, () => finish(false, 0));

  const cellAt = (clientX: number, clientY: number): Cell | null => {
    const el = boardRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const pad = rect.width * 0.02;
    const size = (rect.width - pad * 2) / SIZE;
    const c = Math.floor((clientX - rect.left - pad) / size);
    const r = Math.floor((clientY - rect.top - pad) / size);
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return null;
    return { r, c };
  };

  const commit = (cells: Cell[]) => {
    if (cells.length < 2) return;
    const match = matchSelection(cells, puzzle.placements);
    if (!match) {
      api.sfx('miss');
      return;
    }
    if (found.includes(match)) return;
    const next = [...found, match];
    setFound(next);
    foundCount.current = next.length;
    if (next.length % 3 === 0) api.addCoins(1);
    if (hinted === match) setHinted(null);
    score.current += wordPoints(match.word);
    api.setScore(score.current);
    api.sfx(next.length === puzzle.placements.length ? 'win' : 'score');
    api.haptic(20);
    setBanner({ key: Date.now(), text: match.word });
    if (next.length === puzzle.placements.length) setTimeout(() => finish(true, clock.remaining), 400);
  };

  const centre = (cell: Cell) => {
    const pad = 2;
    const size = (100 - pad * 2) / SIZE;
    return { x: pad + (cell.c + 0.5) * size, y: pad + (cell.r + 0.5) * size };
  };

  /** Hint: circle the first letter of a word you haven't found. */
  const hint = async () => {
    if (busy || over.current) return;
    const left = puzzle.placements.filter((p) => !found.includes(p) && p !== hinted);
    if (!left.length) return;
    if (hints > 0) setHints((n) => n - 1);
    else {
      setBusy(true);
      const ok = await api.watchAd('A word hint');
      setBusy(false);
      if (!ok) return;
    }
    setHinted(rng.pick(left));
    api.sfx('powerup');
  };

  const renderLine = (cells: Cell[], color: string, key: string, opacity = 0.45) => {
    if (cells.length === 0) return null;
    const a = centre(cells[0]!);
    const b = centre(cells[cells.length - 1]!);
    return (
      <line
        key={key}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={color}
        strokeWidth={8.2}
        strokeLinecap="round"
        opacity={opacity}
      />
    );
  };

  return (
    <DomStage>
      <StatBar>
        <Stat label="Theme" value={<span className={styles.theme}>{puzzle.theme}</span>} />
        <Stat
          label="Time"
          value={`${Math.ceil(clock.remaining)}s`}
          tone={clock.remaining < 15 ? 'warn' : undefined}
        />
        <Stat label="Found" value={`${found.length}/${puzzle.placements.length}`} />
      </StatBar>
      <TimerBar ratio={Math.min(1, clock.remaining / roundTime)} label="Time remaining" />
      <div
        ref={boardRef}
        className={styles.board}
        role="application"
        aria-label={`Word search, theme ${puzzle.theme}`}
        onPointerDown={(e) => {
          if (paused || over.current) return;
          const cell = cellAt(e.clientX, e.clientY);
          if (!cell) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          start.current = cell;
          setSelection([cell]);
          api.sfx('tick');
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const cell = cellAt(e.clientX, e.clientY);
          if (!cell) return;
          const cells = lineCells(start.current, cell);
          if (cells.length !== selection.length) api.sfx('tick');
          setSelection(cells);
        }}
        onPointerUp={() => {
          if (start.current) commit(selection);
          start.current = null;
          setSelection([]);
        }}
        onPointerCancel={() => {
          start.current = null;
          setSelection([]);
        }}
      >
        <svg className={styles.lines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {found.map((p, i) =>
            renderLine(
              Array.from({ length: p.word.length }, (_, k) => ({ r: p.r + p.dr * k, c: p.c + p.dc * k })),
              COLORS[i % COLORS.length]!,
              p.word,
            ),
          )}
          {renderLine(selection, '#0ea5e9', 'selection', 0.55)}
          {hinted && !found.includes(hinted) && (
            <circle
              className={styles.hint}
              cx={centre(hinted).x}
              cy={centre(hinted).y}
              r={4.6}
              fill="none"
              stroke="#fde047"
              strokeWidth={1.2}
            />
          )}
        </svg>
        <div className={styles.grid}>
          {puzzle.grid.flatMap((row, r) =>
            row.map((letter, c) => (
              <span key={`${r}-${c}`} className={styles.cell}>
                {letter}
              </span>
            )),
          )}
        </div>
      </div>
      <div className={styles.words} aria-label="Words to find">
        {puzzle.placements.map((p) => (
          <span key={p.word} className={styles.word} data-found={found.includes(p)}>
            {p.word}
          </span>
        ))}
      </div>
      <PowerChip
        corner="inline"
        icon="💡"
        label="Hint"
        badge={hints > 0 ? hints : 'ad'}
        onClick={() => void hint()}
        disabled={busy}
      />
      {banner && (
        <Banner
          key={banner.key}
          text={banner.text}
          sub={banner.text.startsWith('+') ? undefined : `+${wordPoints(banner.text)}`}
        />
      )}
    </DomStage>
  );
}
