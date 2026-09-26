/** Territory rules for Color Land, kept pure so they can be unit-tested. */

export const N = 48;
export const NONE = -1;

export const idx = (x: number, y: number) => y * N + x;
export const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N;

/**
 * Claims a closed trail for `id`: the trail becomes owned, then every cell
 * that can't reach the map edge without crossing `id`'s land is enclosed and
 * claimed too. Returns how many cells changed hands.
 */
export function capture(owner: Int8Array, id: number, trail: readonly number[]): number {
  let changed = 0;
  for (const c of trail) {
    if (owner[c] !== id) changed++;
    owner[c] = id;
  }
  const outside = new Uint8Array(N * N);
  const queue: number[] = [];
  for (let i = 0; i < N; i++)
    for (const c of [idx(i, 0), idx(i, N - 1), idx(0, i), idx(N - 1, i)])
      if (owner[c] !== id && !outside[c]) {
        outside[c] = 1;
        queue.push(c);
      }
  while (queue.length) {
    const c = queue.pop()!;
    const x = c % N;
    const y = (c / N) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inside(nx, ny)) continue;
      const n = idx(nx, ny);
      if (outside[n] || owner[n] === id) continue;
      outside[n] = 1;
      queue.push(n);
    }
  }
  for (let c = 0; c < N * N; c++)
    if (!outside[c] && owner[c] !== id) {
      owner[c] = id;
      changed++;
    }
  return changed;
}

export function count(owner: Int8Array, id: number): number {
  let n = 0;
  for (let c = 0; c < owner.length; c++) if (owner[c] === id) n++;
  return n;
}

export function clearOwner(owner: Int8Array, id: number): void {
  for (let c = 0; c < owner.length; c++) if (owner[c] === id) owner[c] = NONE;
}

export function claimSquare(owner: Int8Array, id: number, cx: number, cy: number, half: number): void {
  for (let y = cy - half; y <= cy + half; y++)
    for (let x = cx - half; x <= cx + half; x++) if (inside(x, y)) owner[idx(x, y)] = id;
}
