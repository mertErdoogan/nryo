import type { Rng } from '../../lib/rng';

export interface Problem {
  text: string;
  answer: number;
  options: number[];
  tier: number;
}

/** Difficulty tier from the number of correct answers so far. */
export const tierFor = (solved: number) => Math.min(5, 1 + Math.floor(solved / 6));

export function makeProblem(rng: Rng, tier: number): Problem {
  let text = '';
  let answer = 0;
  const kind = rng.int(0, Math.min(tier, 4));
  if (tier >= 5 && rng.chance(0.4)) {
    const a = rng.int(2, 9);
    const b = rng.int(2, 9);
    const c = rng.int(1, 20);
    answer = a * b + c;
    text = `${a} × ${b} + ${c}`;
  } else if (kind <= 1) {
    const max = tier === 1 ? 10 : 20 + tier * 10;
    const a = rng.int(1, max);
    const b = rng.int(1, max);
    answer = a + b;
    text = `${a} + ${b}`;
  } else if (kind === 2) {
    const a = rng.int(5, 20 + tier * 10);
    const b = rng.int(1, a);
    answer = a - b;
    text = `${a} − ${b}`;
  } else if (kind === 3) {
    const a = rng.int(2, tier >= 4 ? 12 : 9);
    const b = rng.int(2, tier >= 4 ? 12 : 9);
    answer = a * b;
    text = `${a} × ${b}`;
  } else {
    const b = rng.int(2, 9);
    answer = rng.int(2, 12);
    text = `${answer * b} ÷ ${b}`;
  }
  return { text, answer, options: makeOptions(answer, rng), tier };
}

export function makeOptions(answer: number, rng: Rng): number[] {
  const set = new Set<number>([answer]);
  const candidates = [answer + 1, answer - 1, answer + 10, answer - 10, answer + 2, answer - 2, answer + 5];
  const swapped = Number(String(answer).split('').reverse().join(''));
  if (swapped !== answer && answer >= 10) candidates.unshift(swapped);
  for (const c of rng.shuffle(candidates)) {
    if (set.size >= 4) break;
    if (c >= 0) set.add(c);
  }
  while (set.size < 4) set.add(answer + rng.int(3, 15));
  return rng.shuffle([...set]);
}
