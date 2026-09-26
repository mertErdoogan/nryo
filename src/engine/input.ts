import { useEffect, useLayoutEffect, useRef } from 'react';

const GAME_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
]);

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** Whether a keyboard event belongs to the game (not typing, no shortcuts, not inside a dialog). */
export function isGameKeyEvent(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (isTyping(e.target)) return false;
  if (e.target instanceof HTMLElement && e.target.closest('dialog, [data-game-overlay]')) return false;
  return true;
}

/**
 * Discrete key presses (e.code). Prevents page scrolling for game keys.
 * Return `false` from the handler to let the event propagate normally.
 */
export function useKeyDown(
  handler: (code: string, e: KeyboardEvent) => void | boolean,
  active: boolean,
): void {
  const ref = useRef(handler);
  useLayoutEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isGameKeyEvent(e)) return;
      const result = ref.current(e.code, e);
      if (result !== false && GAME_KEYS.has(e.code)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}

/** Continuous key state for real-time movement. Cleared when inactive or the window blurs. */
export function useHeldKeys(active: boolean): React.RefObject<Set<string>> {
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const held = keys.current;
    if (!active) {
      held.clear();
      return;
    }
    const down = (e: KeyboardEvent) => {
      if (!isGameKeyEvent(e)) return;
      held.add(e.code);
      if (GAME_KEYS.has(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => held.delete(e.code);
    const clear = () => held.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      held.clear();
    };
  }, [active]);
  return keys;
}

/** -1, 0 or 1 on each axis from arrow keys / WASD. */
export function axisFromKeys(keys: Set<string>): { x: number; y: number } {
  const x =
    (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) -
    (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
  const y =
    (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
  return { x, y };
}

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

/** Detects a swipe from pointer down/up positions (in any coordinate space). */
export function swipeDirection(dx: number, dy: number, threshold = 24): SwipeDirection | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}
