import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Banner,
  DomStage,
  Stat,
  StatBar,
  TimerBar,
  createContinueGate,
  useCountdown,
  useSeededRng,
} from '../../engine';
import type { GameProps } from '../../platform/types';
import { generate, isSolved, slideRange, solve, type Car, type Move } from './logic';
import styles from './ParkingJam.module.css';

const START_TIME = 150;

export function ParkingJam({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const lo = api.loadout;
  const palette = lo.skin.colors;
  const undoPerLevel = 3 + 3 * lo.level('undo');
  const [level, setLevel] = useState(1);
  const [puzzle] = useState(() => generate(1, rng));
  const [cars, setCars] = useState<Car[]>(puzzle.cars);
  const [minMoves, setMinMoves] = useState(puzzle.min);
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<Car[][]>([]);
  const [undos, setUndos] = useState(undoPerLevel);
  const [freeHints, setFreeHints] = useState(lo.level('hint'));
  const [hint, setHint] = useState<Move | null>(null);
  const [drag, setDrag] = useState<null | {
    id: number;
    start: number;
    offset: number;
    range: [number, number];
  }>(null);
  const [exiting, setExiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ key: number; text: string; sub?: string } | null>(null);
  const lotRef = useRef<HTMLDivElement>(null);
  const stats = useRef({ score: 0, solved: 0, over: false, waiting: false });
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
        clock.reset(60);
        setBanner({ key: Date.now(), text: '+60 seconds' });
      },
      () => {
        stats.current.over = true;
        api.gameOver({
          score: stats.current.score,
          stats: [{ label: 'Lots cleared', value: String(stats.current.solved) }],
        });
      },
    );
  };
  const clock = useCountdown(START_TIME + 20 * lo.level('time'), !paused && !exiting && !busy, timeUp);

  const cellSize = () => (lotRef.current?.clientWidth ?? 360) / 6;

  const finishLevel = (final: Car[], movesUsed: number) => {
    setExiting(true);
    const pts = 100 + level * 20 + Math.max(0, minMoves * 2 - movesUsed) * 15;
    stats.current.score += pts;
    stats.current.solved += 1;
    api.setScore(stats.current.score);
    clock.add(25 + Math.min(20, minMoves * 2));
    if (movesUsed <= minMoves) api.addCoins(2);
    setBanner({
      key: Date.now(),
      text: movesUsed <= minMoves ? 'Perfect solve!' : 'Lot cleared!',
      sub: `+${pts} pts · ${movesUsed} moves (best ${minMoves})`,
    });
    api.sfx('win');
    setCars(final.map((c) => (c.id === 0 ? { ...c, x: 8 } : c)));
    timers.current.push(
      setTimeout(() => {
        const n = level + 1;
        const next = generate(n, rng);
        setLevel(n);
        setCars(next.cars);
        setMinMoves(next.min);
        setMoves(0);
        setHistory([]);
        setUndos(undoPerLevel);
        setHint(null);
        setExiting(false);
      }, 1200),
    );
  };

  const onPointerDown = (e: ReactPointerEvent, car: Car) => {
    if (paused || exiting || busy || stats.current.over || stats.current.waiting) return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setDrag({
      id: car.id,
      start: car.horiz ? e.clientX : e.clientY,
      offset: 0,
      range: slideRange(cars, car.id),
    });
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    const car = cars.find((c) => c.id === drag.id)!;
    const px = (car.horiz ? e.clientX : e.clientY) - drag.start;
    const cells = px / cellSize();
    setDrag({ ...drag, offset: Math.max(drag.range[0], Math.min(drag.range[1], cells)) });
  };
  const onPointerUp = () => {
    if (!drag) return;
    const d = Math.round(drag.offset);
    setDrag(null);
    if (d === 0) return;
    const next = cars.map((c) =>
      c.id === drag.id ? { ...c, x: c.horiz ? c.x + d : c.x, y: c.horiz ? c.y : c.y + d } : c,
    );
    setHistory((h) => [...h.slice(-40), cars]);
    setCars(next);
    setMoves((m) => m + 1);
    setHint(null);
    api.sfx('swap');
    if (isSolved(next)) finishLevel(next, moves + 1);
  };

  const undo = () => {
    if (undos <= 0 || history.length === 0 || exiting) return;
    setCars(history[history.length - 1]!);
    setHistory((h) => h.slice(0, -1));
    setUndos((u) => u - 1);
    setMoves((m) => m + 1);
    api.sfx('click');
  };

  const showHint = () => {
    const sol = solve(cars);
    if (sol && sol.length) {
      setHint(sol[0]!);
      api.sfx('powerup');
    }
  };
  const hintClick = async () => {
    if (exiting || busy) return;
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

  return (
    <DomStage>
      <StatBar>
        <Stat label="Lot" value={level} />
        <Stat
          label="Time"
          value={`${Math.ceil(clock.remaining)}s`}
          tone={clock.remaining < 15 ? 'warn' : undefined}
        />
        <Stat label="Moves" value={`${moves} / ${minMoves}`} />
      </StatBar>
      <TimerBar ratio={Math.min(1, clock.remaining / 150)} label="Time left" />
      <div className={styles.wrap}>
        <div
          ref={lotRef}
          className={styles.lot}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className={styles.exit} aria-hidden="true">
            ›
          </div>
          {cars.map((c) => {
            const dragging = drag?.id === c.id;
            const off = dragging ? drag.offset : 0;
            const x = c.horiz ? c.x + off : c.x;
            const y = c.horiz ? c.y : c.y + off;
            const color = c.id === 0 ? '#ef4444' : palette[c.id % palette.length]!;
            const hinted = hint?.id === c.id;
            return (
              <div
                key={c.id}
                className={styles.car}
                data-horiz={c.horiz}
                data-dragging={dragging}
                data-hint={hinted}
                data-exiting={exiting && c.id === 0}
                role="button"
                aria-label={`${c.id === 0 ? 'Red car' : `Car ${c.id}`}${hinted ? `, hint: move ${hint!.delta > 0 ? (c.horiz ? 'right' : 'down') : c.horiz ? 'left' : 'up'}` : ''}`}
                onPointerDown={(e) => onPointerDown(e, c)}
                style={
                  {
                    left: `calc(var(--cell) * ${x})`,
                    top: `calc(var(--cell) * ${y})`,
                    width: `calc(var(--cell) * ${c.horiz ? c.len : 1})`,
                    height: `calc(var(--cell) * ${c.horiz ? 1 : c.len})`,
                    '--car': color,
                  } as CSSProperties
                }
              >
                <div className={styles.body} />
              </div>
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
        </div>
      </div>
      {banner && <Banner key={banner.key} text={banner.text} sub={banner.sub} />}
    </DomStage>
  );
}
