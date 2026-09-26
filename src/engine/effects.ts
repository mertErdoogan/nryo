import type { Rng } from '../lib/rng';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  shape: 'circle' | 'square';
}

export interface BurstOptions {
  count?: number;
  colors?: string[];
  color?: string;
  speed?: number;
  speedVariance?: number;
  life?: number;
  size?: number;
  gravity?: number;
  drag?: number;
  /** Emission direction and spread in radians (default: full circle). */
  angle?: number;
  spread?: number;
  shape?: 'circle' | 'square';
}

/** Pooled particle system — cheap enough for hundreds of sparks per frame. */
export class Particles {
  private items: Particle[] = [];
  constructor(
    private readonly max = 600,
    private readonly random: () => number = Math.random,
  ) {}

  burst(x: number, y: number, opts: BurstOptions = {}): void {
    const count = opts.count ?? 16;
    const colors = opts.colors ?? [opts.color ?? '#fff'];
    const speed = opts.speed ?? 180;
    const variance = opts.speedVariance ?? 0.6;
    const spread = opts.spread ?? Math.PI * 2;
    const base = opts.angle ?? 0;
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.max) this.items.shift();
      const a = base + (this.random() - 0.5) * spread;
      const s = speed * (1 - variance / 2 + this.random() * variance);
      const life = (opts.life ?? 0.6) * (0.6 + this.random() * 0.8);
      this.items.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        size: (opts.size ?? 4) * (0.6 + this.random() * 0.8),
        color: colors[Math.floor(this.random() * colors.length)]!,
        gravity: opts.gravity ?? 0,
        drag: opts.drag ?? 1.5,
        shape: opts.shape ?? 'circle',
      });
    }
  }

  update(dt: number): void {
    let w = 0;
    for (const p of this.items) {
      p.life -= dt;
      if (p.life <= 0) continue;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.items[w++] = p;
    }
    this.items.length = w;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.items) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t * 1.5);
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + 0.6 * t);
      if (p.shape === 'square') {
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.items.length = 0;
  }

  get count(): number {
    return this.items.length;
  }
}

interface Floater {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

/** "+10", "Perfect!", "Combo x3" style floating labels. */
export class FloatingText {
  private items: Floater[] = [];

  add(text: string, x: number, y: number, color = '#fff', size = 20, life = 0.9): void {
    this.items.push({ text, x, y, life, maxLife: life, color, size });
    if (this.items.length > 40) this.items.shift();
  }

  update(dt: number): void {
    for (const f of this.items) {
      f.life -= dt;
      f.y -= 40 * dt;
    }
    this.items = this.items.filter((f) => f.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.items) {
      const t = f.life / f.maxLife;
      const pop = t > 0.85 ? 1 + (t - 0.85) * 2 : 1;
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.font = `800 ${Math.round(f.size * pop)}px ${GAME_FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.items = [];
  }
}

/** Decaying screen shake. Call `apply` inside save()/restore(). */
export class Shake {
  private intensity = 0;
  constructor(private readonly random: () => number = Math.random) {}

  add(amount: number): void {
    this.intensity = Math.min(24, this.intensity + amount);
  }

  update(dt: number): void {
    this.intensity = Math.max(0, this.intensity - dt * 40);
  }

  apply(ctx: CanvasRenderingContext2D): void {
    if (this.intensity <= 0) return;
    ctx.translate((this.random() - 0.5) * this.intensity, (this.random() - 0.5) * this.intensity);
  }
}

export const GAME_FONT = "'Rubik Variable', Rubik, system-ui, sans-serif";

/** A gentle drifting starfield / dust background, deterministic per seed. */
export function makeStars(rng: Rng, count: number, width: number, height: number) {
  return Array.from({ length: count }, () => ({
    x: rng.range(0, width),
    y: rng.range(0, height),
    r: rng.range(0.4, 1.8),
    speed: rng.range(0.2, 1),
    alpha: rng.range(0.25, 0.9),
  }));
}
