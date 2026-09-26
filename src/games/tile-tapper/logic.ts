export const LANES = 4;
export const ROW_H = 160;

export const speedForScore = (score: number) => Math.min(950, 330 + score * 4.2);

export interface Row {
  lane: number;
  /** Row index from the start; row i occupies world y ∈ [-(i+1)·ROW_H, -i·ROW_H). */
  index: number;
  tapped: boolean;
}

/** Screen y of a row's top edge given the current scroll distance and screen height. */
export const rowTop = (index: number, scroll: number, height: number) => height - (index + 1) * ROW_H + scroll;

/** Lane for a new row: avoids repeating the same lane too often. */
export function nextLane(prev: number, roll: number): number {
  const lane = Math.floor(roll * (LANES - 1));
  return lane >= prev ? lane + 1 : lane;
}
