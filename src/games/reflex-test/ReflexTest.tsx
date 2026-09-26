import { useCallback, useEffect, useRef, useState } from 'react';
import { DomStage, Hint, useKeyDown, useSeededRng } from '../../engine';
import type { GameProps } from '../../platform/types';
import { average, ROUNDS, verdict } from './logic';
import styles from './ReflexTest.module.css';

type State = 'ready' | 'waiting' | 'go' | 'early' | 'result';

export function ReflexTest({ api, paused }: GameProps) {
  const rng = useSeededRng(api.seed);
  const [state, setState] = useState<State>('ready');
  const [times, setTimes] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const [falseStarts, setFalseStarts] = useState(0);
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef(0);
  const finished = useRef(false);

  const clearTimers = () => {
    if (timer.current) clearTimeout(timer.current);
    cancelAnimationFrame(raf.current);
    timer.current = null;
  };
  useEffect(() => clearTimers, []);

  const beginWait = useCallback(() => {
    clearTimers();
    setState('waiting');
    timer.current = setTimeout(() => {
      setState('go');
      // Start timing on the frame the green panel is painted.
      raf.current = requestAnimationFrame(() => {
        goAt.current = performance.now();
      });
    }, rng.range(1300, 3600));
  }, [rng]);

  // Pausing mid-round voids that round; resume starts it again.
  useEffect(() => {
    if (paused && (state === 'waiting' || state === 'go')) {
      clearTimers();
      setState('ready');
    }
  }, [paused, state]);

  const press = (timeStamp: number) => {
    if (paused || finished.current) return;
    switch (state) {
      case 'ready':
      case 'early':
      case 'result':
        beginWait();
        api.sfx('click');
        break;
      case 'waiting':
        clearTimers();
        setFalseStarts((n) => n + 1);
        setState('early');
        api.sfx('error');
        api.haptic(80);
        break;
      case 'go': {
        clearTimers();
        const start = goAt.current || timeStamp;
        const ms = Math.max(80, Math.round(Math.min(timeStamp, performance.now()) - start));
        const next = [...times, ms];
        setTimes(next);
        setLast(ms);
        api.setScore(Math.round(average(next)));
        api.sfx(ms < 250 ? 'perfect' : 'score');
        if (next.length >= ROUNDS) {
          finished.current = true;
          setState('result');
          const avg = Math.round(average(next));
          timer.current = setTimeout(
            () =>
              api.gameOver({
                score: avg,
                stats: [
                  { label: 'Fastest', value: `${Math.min(...next)} ms` },
                  { label: 'Slowest', value: `${Math.max(...next)} ms` },
                  { label: 'False starts', value: String(falseStarts) },
                ],
              }),
            600,
          );
        } else {
          setState('result');
        }
        break;
      }
    }
  };

  useKeyDown((code, e) => {
    if (code === 'Space' || code === 'Enter') press(e.timeStamp);
  }, !paused);

  const content: Record<State, { icon: string; big: string; sub: string }> = {
    ready: { icon: '🎯', big: times.length ? `Round ${times.length + 1}` : 'Tap to start', sub: 'Wait for green, then tap fast.' },
    waiting: { icon: '✋', big: 'Wait…', sub: 'Tap when it turns green' },
    go: { icon: '⚡', big: 'TAP!', sub: '' },
    early: { icon: '😅', big: 'Too soon!', sub: 'Tap to try this round again' },
    result: {
      icon: last !== null && last < 250 ? '🚀' : '⏱️',
      big: `${last ?? 0} ms`,
      sub: times.length >= ROUNDS ? `Average ${Math.round(average(times))} ms` : `${verdict(last ?? 0)} · tap for round ${times.length + 1}`,
    },
  };
  const c = content[state];

  return (
    <DomStage>
      <button
        type="button"
        className={styles.panel}
        data-state={state}
        data-testid="reflex-panel"
        onPointerDown={(e) => {
          e.preventDefault();
          press(e.timeStamp);
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') e.preventDefault();
        }}
        aria-live="assertive"
      >
        <span className={styles.icon} aria-hidden="true">
          {c.icon}
        </span>
        <span className={styles.big}>{c.big}</span>
        {c.sub && <span className={styles.sub}>{c.sub}</span>}
      </button>
      <div className={styles.rounds} aria-label="Round times">
        {Array.from({ length: ROUNDS }, (_, i) => (
          <div key={i} className={styles.round} data-current={i === times.length}>
            Round {i + 1}
            <strong>{times[i] !== undefined ? `${times[i]} ms` : '—'}</strong>
          </div>
        ))}
      </div>
      <Hint>Average human reaction is about 250–300 ms.</Hint>
    </DomStage>
  );
}
