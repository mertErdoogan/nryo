export const ROUNDS = 5;

export function average(times: readonly number[]): number {
  if (times.length === 0) return 0;
  return times.reduce((a, b) => a + b, 0) / times.length;
}

/** Human-friendly verdict for a reaction time. */
export function verdict(ms: number): string {
  if (ms < 200) return 'Lightning!';
  if (ms < 240) return 'Excellent';
  if (ms < 290) return 'Great';
  if (ms < 350) return 'Good';
  if (ms < 450) return 'Okay';
  return 'Keep practicing';
}
