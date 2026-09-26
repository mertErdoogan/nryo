import { PACKED_DICTIONARY } from './dictionary.data';

/** Splits a string of concatenated fixed-length words. */
export function unpack(packed: string, length: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + length <= packed.length; i += length) out.push(packed.slice(i, i + length));
  return out;
}

let dictionary: Set<string> | null = null;
let byLength: Map<number, string[]> | null = null;

function load(): void {
  if (dictionary) return;
  dictionary = new Set();
  byLength = new Map();
  for (const [len, packed] of Object.entries(PACKED_DICTIONARY)) {
    const words = unpack(packed, Number(len));
    byLength.set(Number(len), words);
    for (const w of words) dictionary.add(w);
  }
}

/** True for common English words of 3–7 letters (SCOWL-derived list). */
export function isWord(word: string): boolean {
  load();
  return dictionary!.has(word.toLowerCase());
}

export function wordsOfLength(length: number): readonly string[] {
  load();
  return byLength!.get(length) ?? [];
}

function letterCounts(word: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of word) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
}

/** Every dictionary word (≥ minLength) that can be spelled from the given letters. */
export function subAnagrams(letters: string, minLength = 3): string[] {
  load();
  const available = letterCounts(letters.toLowerCase());
  const out: string[] = [];
  for (let len = minLength; len <= letters.length; len++) {
    for (const w of byLength!.get(len) ?? []) {
      const need = new Map<string, number>();
      let ok = true;
      for (const c of w) {
        const n = (need.get(c) ?? 0) + 1;
        if (n > (available.get(c) ?? 0)) {
          ok = false;
          break;
        }
        need.set(c, n);
      }
      if (ok) out.push(w);
    }
  }
  return out;
}
