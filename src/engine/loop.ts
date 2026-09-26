import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * requestAnimationFrame loop with delta time (seconds). Stops completely while
 * `running` is false (pause, game over, hidden tab) and always cleans up.
 * Delta is clamped so a long frame never teleports objects through walls.
 */
export function useGameLoop(step: (dt: number, elapsed: number) => void, running: boolean, maxDt = 1 / 20): void {
  const stepRef = useRef(step);
  useLayoutEffect(() => {
    stepRef.current = step;
  });
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    const frame = (now: number) => {
      const dt = Math.min(maxDt, Math.max(0, (now - last) / 1000));
      last = now;
      elapsed += dt;
      stepRef.current(dt, elapsed);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, maxDt]);
}

/** setInterval that respects pause and always uses the latest callback. */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const ref = useRef(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  });
  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => ref.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}

/** One-shot timeout that is cancelled on unmount or when deps change. */
export function useTimeout(callback: () => void, delayMs: number | null): void {
  const ref = useRef(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  });
  useEffect(() => {
    if (delayMs === null) return;
    const id = setTimeout(() => ref.current(), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
}
