import type { CSSProperties, ReactNode } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import styles from './CanvasStage.module.css';

export interface CanvasView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Logical (game-space) size. Draw using these coordinates. */
  width: number;
  height: number;
  /** CSS pixels per logical unit. */
  scale: number;
}

export interface StagePointer {
  x: number;
  y: number;
  id: number;
  type: string;
  event: PointerEvent;
}

export interface CanvasStageProps {
  /** Logical width (for `contain`) — or the width at `minAspect` for `fill`. */
  width: number;
  /** Logical height. Always fixed; the game is designed against it. */
  height: number;
  /**
   * contain: fixed aspect ratio, letterboxed.
   * fill: logical height fixed, width follows the container between min/max aspect.
   */
  fit?: 'contain' | 'fill';
  minAspect?: number;
  maxAspect?: number;
  label: string;
  onResize?: (view: CanvasView) => void;
  onPointerDown?: (p: StagePointer) => void;
  onPointerMove?: (p: StagePointer) => void;
  onPointerUp?: (p: StagePointer) => void;
  cursor?: CSSProperties['cursor'];
  /** DOM overlays aligned with the canvas (HUD pills, touch buttons…). */
  children?: ReactNode;
  className?: string;
}

const MAX_DPR = 2;

/**
 * Responsive, crisp canvas: fits the available game area, scales for
 * devicePixelRatio, and converts pointer events to logical coordinates.
 */
export const CanvasStage = forwardRef<CanvasView | null, CanvasStageProps>(function CanvasStage(
  { width, height, fit = 'contain', minAspect, maxAspect, label, onResize, onPointerDown, onPointerMove, onPointerUp, cursor, children, className },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<CanvasView | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const handlers = useRef({ onPointerDown, onPointerMove, onPointerUp, onResize });
  useLayoutEffect(() => {
    handlers.current = { onPointerDown, onPointerMove, onPointerUp, onResize };
  });

  useImperativeHandle(ref, () => viewRef.current as CanvasView, [box]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const layout = () => {
      const cw = wrap.clientWidth;
      const ch = wrap.clientHeight;
      if (cw <= 0 || ch <= 0) return;
      let logicalW = width;
      const logicalH = height;
      if (fit === 'fill') {
        const lo = minAspect ?? width / height;
        const hi = maxAspect ?? lo * 2.2;
        const aspect = Math.min(hi, Math.max(lo, cw / ch));
        logicalW = Math.round(height * aspect);
      }
      const scale = Math.min(cw / logicalW, ch / logicalH);
      const cssW = Math.floor(logicalW * scale);
      const cssH = Math.floor(logicalH * scale);
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform((cssW * dpr) / logicalW, 0, 0, (cssH * dpr) / logicalH, 0, 0);
      viewRef.current = { canvas, ctx, width: logicalW, height: logicalH, scale };
      setBox({ w: cssW, h: cssH });
      handlers.current.onResize?.(viewRef.current);
    };

    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [width, height, fit, minAspect, maxAspect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const toPointer = (e: PointerEvent): StagePointer | null => {
      const view = viewRef.current;
      if (!view) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * view.width,
        y: ((e.clientY - rect.top) / rect.height) * view.height,
        id: e.pointerId,
        type: e.pointerType,
        event: e,
      };
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events */
      }
      const p = toPointer(e);
      if (p) handlers.current.onPointerDown?.(p);
    };
    const move = (e: PointerEvent) => {
      const p = toPointer(e);
      if (p) handlers.current.onPointerMove?.(p);
    };
    const up = (e: PointerEvent) => {
      const p = toPointer(e);
      if (p) handlers.current.onPointerUp?.(p);
    };
    const prevent = (e: Event) => e.preventDefault();
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', prevent);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('contextmenu', prevent);
    };
  }, []);

  return (
    <div ref={wrapRef} className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <div className={styles.frame} style={{ width: box.w || undefined, height: box.h || undefined }}>
        <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={label} style={{ cursor }} />
        {children && <div className={styles.overlay}>{children}</div>}
      </div>
    </div>
  );
});
