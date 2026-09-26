import { GAME_FONT } from './effects';

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
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

export function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string | CanvasGradient,
): void {
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

export function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  opts: TextOptions = {},
): void {
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
export function prompt(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  time: number,
  size = 20,
): void {
  const alpha = 0.55 + Math.sin(time * 4) * 0.35;
  text(ctx, value, x, y, { size, weight: 700, alpha, stroke: 'rgba(0,0,0,0.35)', strokeWidth: 5 });
}

/** A spinning gold coin (pickups in canvas games). `time` drives the spin. */
export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time = 0): void {
  const squash = Math.abs(Math.cos(time * 3 + x * 0.05));
  const w = Math.max(0.18, squash) * r;
  ctx.save();
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 1, w, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.ellipse(x, y, w, r, 0, 0, Math.PI * 2);
  ctx.fill();
  if (squash > 0.4) {
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.ellipse(x - w * 0.25, y - r * 0.25, w * 0.35, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Rounded translucent label used for in-canvas HUD readouts (coins, lives, wave…). */
export function hudPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  opts: { align?: 'left' | 'right' | 'center'; color?: string; size?: number; coin?: boolean } = {},
): void {
  const size = opts.size ?? 15;
  ctx.save();
  ctx.font = `800 ${size}px ${GAME_FONT}`;
  const tw = ctx.measureText(label).width;
  const pad = 10;
  const icon = opts.coin ? size + 4 : 0;
  const w = tw + pad * 2 + icon;
  const h = size + 14;
  const left = opts.align === 'right' ? x - w : opts.align === 'center' ? x - w / 2 : x;
  fillRoundRect(ctx, left, y, w, h, h / 2, 'rgba(0,0,0,0.42)');
  if (opts.coin) drawCoin(ctx, left + pad + size / 2 - 1, y + h / 2, size / 2, 0);
  ctx.fillStyle = opts.color ?? '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, left + pad + icon, y + h / 2 + 1);
  ctx.restore();
}

/** Lightens (amount > 0) or darkens (amount < 0) a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const mix = (c: number) =>
    Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))
      .toString(16)
      .padStart(2, '0');
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}
