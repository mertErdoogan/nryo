/** Milliseconds each pad stays lit during playback for a sequence length. */
export const litTime = (length: number) => Math.max(200, 520 - length * 24);
export const gapTime = (length: number) => Math.max(90, litTime(length) * 0.45);

/** Checks a partial input against the sequence: 'ok', 'done' or 'wrong'. */
export function checkInput(sequence: readonly number[], input: readonly number[]): 'ok' | 'done' | 'wrong' {
  for (let i = 0; i < input.length; i++) if (input[i] !== sequence[i]) return 'wrong';
  return input.length === sequence.length ? 'done' : 'ok';
}
