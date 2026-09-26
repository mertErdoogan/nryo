import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import styles from './controls.module.css';

interface TouchButtonProps {
  label: string;
  children: ReactNode;
  onPress: () => void;
  onRelease?: () => void;
  /** Repeat `onPress` while held (ms), e.g. for moving pieces. */
  repeatMs?: number;
  size?: 'normal' | 'small' | 'wide';
  className?: string;
}

/** Large, touch-friendly game button with press/hold semantics. */
export function TouchButton({
  label,
  children,
  onPress,
  onRelease,
  repeatMs,
  size = 'normal',
  className,
}: TouchButtonProps) {
  const [pressed, setPressed] = useState(false);
  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>(
    {},
  );
  const handlers = useRef({ onPress, onRelease });
  handlers.current = { onPress, onRelease };

  const stop = () => {
    clearTimeout(timers.current.delay);
    clearInterval(timers.current.repeat);
    timers.current = {};
  };
  useEffect(() => stop, []);

  const release = () => {
    if (!pressed) return;
    setPressed(false);
    stop();
    handlers.current.onRelease?.();
  };

  return (
    <button
      type="button"
      aria-label={label}
      data-pressed={pressed}
      className={[styles.btn, size !== 'normal' && styles[size], className].filter(Boolean).join(' ')}
      onPointerDown={(e) => {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        setPressed(true);
        handlers.current.onPress();
        if (repeatMs) {
          timers.current.delay = setTimeout(() => {
            timers.current.repeat = setInterval(() => handlers.current.onPress(), repeatMs);
          }, 220);
        }
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        // Keyboard users trigger via the game's own key bindings; avoid double input.
        if (e.key === ' ' || e.key === 'Enter') e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

/** Bottom control bar with left and right button groups (touch devices only by default). */
export function ControlBar({
  left,
  right,
  alwaysVisible,
}: {
  left?: ReactNode;
  right?: ReactNode;
  alwaysVisible?: boolean;
}) {
  return (
    <div className={[styles.bar, !alwaysVisible && styles.touchOnly].filter(Boolean).join(' ')}>
      <div className={styles.group}>{left}</div>
      <div className={styles.group}>{right}</div>
    </div>
  );
}

/**
 * Floating virtual joystick for canvas games: the stick appears wherever the
 * finger lands and reports a normalised direction vector.
 */
export class FloatingStick {
  active = false;
  pointerId = -1;
  originX = 0;
  originY = 0;
  x = 0;
  y = 0;
  constructor(public radius = 56) {}

  down(id: number, x: number, y: number): void {
    this.active = true;
    this.pointerId = id;
    this.originX = this.x = x;
    this.originY = this.y = y;
  }

  move(id: number, x: number, y: number): void {
    if (!this.active || id !== this.pointerId) return;
    this.x = x;
    this.y = y;
  }

  up(id: number): void {
    if (id !== this.pointerId) return;
    this.active = false;
    this.pointerId = -1;
  }

  /** Direction with magnitude 0..1. */
  vector(): { x: number; y: number } {
    if (!this.active) return { x: 0, y: 0 };
    const dx = this.x - this.originX;
    const dy = this.y - this.originY;
    const len = Math.hypot(dx, dy);
    if (len < 4) return { x: 0, y: 0 };
    const mag = Math.min(1, len / this.radius);
    return { x: (dx / len) * mag, y: (dy / len) * mag };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    const v = this.vector();
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.originX, this.originY, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(
      this.originX + v.x * this.radius,
      this.originY + v.y * this.radius,
      this.radius * 0.42,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }
}
