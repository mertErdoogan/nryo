import { FIVE_LETTER_ANSWERS, FIVE_LETTER_GUESSES } from '../_shared/words/five-letter.data';
import { unpack } from '../_shared/words';

export type Mark = 'correct' | 'present' | 'absent';

export const MAX_GUESSES = 6;
export const WORD_LENGTH = 5;

let answers: string[] | null = null;
let valid: Set<string> | null = null;

export function answerList(): string[] {
  answers ??= unpack(FIVE_LETTER_ANSWERS, WORD_LENGTH);
  return answers;
}

export function isValidGuess(word: string): boolean {
  valid ??= new Set([...unpack(FIVE_LETTER_GUESSES, WORD_LENGTH), ...answerList()]);
  return valid.has(word);
}

/** Standard two-pass scoring so repeated letters are marked correctly. */
export function evaluate(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(WORD_LENGTH).fill('absent');
  const remaining = new Map<string, number>();
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) marks[i] = 'correct';
    else remaining.set(answer[i]!, (remaining.get(answer[i]!) ?? 0) + 1);
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (marks[i] === 'correct') continue;
    const c = guess[i]!;
    const n = remaining.get(c) ?? 0;
    if (n > 0) {
      marks[i] = 'present';
      remaining.set(c, n - 1);
    }
  }
  return marks;
}

const RANK: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };

/** Best known state for each letter, for colouring the keyboard. */
export function keyStates(guesses: readonly string[], answer: string): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  for (const g of guesses) {
    evaluate(g, answer).forEach((m, i) => {
      const c = g[i]!;
      if (!out[c] || RANK[m] > RANK[out[c]!]) out[c] = m;
    });
  }
  return out;
}

/** Points for solving in `guesses` tries, with a growing streak bonus. */
export const solvePoints = (guesses: number, streak: number) =>
  (MAX_GUESSES + 1 - guesses) * 100 + streak * 50;
