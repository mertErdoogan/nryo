import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface Countdown {
  /** Seconds remaining (updates ~10×/s). */
  remaining: number;
  /** Add (or subtract) seconds. */
  add(seconds: number): void;
  reset(seconds?: number): void;
}

/**
 * Pause-aware countdown for DOM-based games. Uses wall-clock deltas so it
 * stays accurate even if the browser throttles timers.
 */
export function useCountdown(total: number, running: boolean, onEnd: () => void): Countdown {
  const [remaining, setRemaining] = useState(total);
  const remainingRef = useRef(total);
  const endRef = useRef(onEnd);
  const endedRef = useRef(false);
  useLayoutEffect(() => {
    endRef.current = onEnd;
  });

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (endedRef.current) return;
      remainingRef.current = Math.max(0, remainingRef.current - dt);
      setRemaining(remainingRef.current);
      if (remainingRef.current <= 0) {
        endedRef.current = true;
        endRef.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  const add = useCallback((seconds: number) => {
    if (endedRef.current) return;
    remainingRef.current = Math.max(0, remainingRef.current + seconds);
    setRemaining(remainingRef.current);
  }, []);

  const reset = useCallback(
    (seconds = total) => {
      endedRef.current = false;
      remainingRef.current = seconds;
      setRemaining(seconds);
    },
    [total],
  );

  return { remaining, add, reset };
}

/** Pause-aware stopwatch (seconds). */
export function useStopwatch(running: boolean, initial = 0): [number, () => number] {
  const [elapsed, setElapsed] = useState(initial);
  const ref = useRef(initial);
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      ref.current += (now - last) / 1000;
      last = now;
      setElapsed(ref.current);
    }, 200);
    return () => clearInterval(id);
  }, [running]);
  const read = useCallback(() => ref.current, []);
  return [elapsed, read];
}
