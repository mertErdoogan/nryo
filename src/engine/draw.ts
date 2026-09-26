import { GAME_FONT } from './effects';

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export interface TextOptions {
  size?: number;
  weight?: number;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  stroke?: string;
  strokeWidth?: number;
  alpha?: number;
}

export function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, opts: TextOptions = {}): void {
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.font = `${opts.weight ?? 700} ${opts.size ?? 18}px ${GAME_FONT}`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = opts.baseline ?? 'middle';
  if (opts.stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = opts.strokeWidth ?? 4;
    ctx.strokeStyle = opts.stroke;
    ctx.strokeText(value, x, y);
  }
  ctx.fillStyle = opts.color ?? '#fff';
  ctx.fillText(value, x, y);
  ctx.restore();
}

export function verticalGradient(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
  stops: [number, string][],
): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** HSL helper for procedural palettes. */
export const hsl = (h: number, s: number, l: number, a = 1) =>
  a === 1 ? `hsl(${h % 360} ${s}% ${l}%)` : `hsl(${h % 360} ${s}% ${l}% / ${a})`;

/** Pulsing "Tap to start" style prompt. */
export function prompt(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, time: number, size = 20): void {
  const alpha = 0.55 + Math.sin(time * 4) * 0.35;
  text(ctx, value, x, y, { size, weight: 700, alpha, stroke: 'rgba(0,0,0,0.35)', strokeWidth: 5 });
}
