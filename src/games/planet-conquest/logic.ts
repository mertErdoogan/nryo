import type { Rng } from '../../lib/rng';

export interface Planet {
  id: number;
  x: number;
  y: number;
  r: number;
  owner: number; // 0 neutral, 1 player, 2+ AI
  ships: number;
}

export interface Fleet {
  from: number;
  to: number;
  owner: number;
  ships: number;
  x: number;
  y: number;
}

export const FLEET_SPEED = 95;
export const production = (p: Planet) => (p.owner === 0 ? 0 : p.r / 16);

export function generateMap(rng: Rng, level: number, width: number, height: number): Planet[] {
  const count = Math.min(18, 10 + level);
  const ais = level >= 3 ? 2 : 1;
  const planets: Planet[] = [];
  const fits = (x: number, y: number, r: number) =>
    planets.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + 22);
  planets.push({ id: 0, x: width / 2, y: height - 80, r: 30, owner: 1, ships: 30 });
  planets.push({ id: 1, x: width / 2, y: 90, r: 30, owner: 2, ships: 30 + level * 4 });
  if (ais === 2) planets.push({ id: 2, x: 60, y: height / 2 - 40, r: 26, owner: 3, ships: 24 + level * 3 });
  let guard = 0;
  while (planets.length < count && guard++ < 2000) {
    const r = rng.int(13, 28);
    const x = rng.range(r + 12, width - r - 12);
    const y = rng.range(r + 60, height - r - 30);
    if (!fits(x, y, r)) continue;
    planets.push({ id: planets.length, x, y, r, owner: 0, ships: Math.round(r * rng.range(0.4, 1.1)) });
  }
  return planets;
}

/** Resolves an arriving fleet against its target planet (mutates). Returns true if ownership changed. */
export function land(fleet: Fleet, target: Planet): boolean {
  if (target.owner === fleet.owner) {
    target.ships += fleet.ships;
    return false;
  }
  target.ships -= fleet.ships;
  if (target.ships < 0) {
    target.ships = -target.ships;
    target.owner = fleet.owner;
    return true;
  }
  return false;
}

export interface AiOrder {
  from: number;
  to: number;
}

/** Greedy AI: attack the most attractive target it can overwhelm. */
export function aiOrders(
  planets: readonly Planet[],
  fleets: readonly Fleet[],
  owner: number,
  aggression: number,
): AiOrder[] {
  const mine = planets.filter((p) => p.owner === owner);
  const orders: AiOrder[] = [];
  for (const src of mine) {
    const available = src.ships * 0.5;
    if (available < 6) continue;
    let best: Planet | null = null;
    let bestScore = -Infinity;
    for (const t of planets) {
      if (t.id === src.id) continue;
      const incoming = fleets
        .filter((f) => f.to === t.id)
        .reduce((s, f) => s + (f.owner === owner ? f.ships : -f.ships), 0);
      const d = Math.hypot(t.x - src.x, t.y - src.y);
      if (t.owner === owner) {
        // Reinforce threatened planets.
        const threat = -incoming;
        if (threat > t.ships) {
          const score = 50 - d / 20;
          if (score > bestScore) {
            bestScore = score;
            best = t;
          }
        }
        continue;
      }
      const defence = t.ships + (t.owner === 0 ? 0 : production(t) * (d / FLEET_SPEED)) - incoming;
      if (available <= defence + 2) continue;
      const value = t.r * (t.owner === 1 ? 1.4 * aggression + 0.4 : 1) + (t.owner !== 0 ? 10 : 0);
      const score = value - d / 18 - defence * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (best) orders.push({ from: src.id, to: best.id });
  }
  return orders;
}
