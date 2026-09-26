import { BLITZ_SEEDS } from './blitz-seeds.data';
import { FIVE_LETTER_ANSWERS } from './five-letter.data';
import { unpack } from './index';

/** Words we never want to show as puzzle answers, even if they are real words. */
const BLOCKED = [
  'bastard',
  'bitch',
  'whore',
  'slut',
  'nigg',
  'fag',
  'retard',
  'rape',
  'porn',
  'penis',
  'vagina',
  'sex',
  'dildo',
  'fuck',
  'shit',
  'cunt',
  'nazi',
  'kill',
  'suicid',
  'murder',
  'abus',
  'assault',
  'drunk',
  'drug',
  'corpse',
  'slave',
  'torture',
  'terror',
  'dead',
];

export const isFamilyFriendly = (w: string) => !BLOCKED.some((b) => w.includes(b));

let five: string[] | null = null;
let seven: string[] | null = null;

/** Curated, family-friendly puzzle answers of 5 or 7 letters. */
export function answerWords(length: 5 | 7): readonly string[] {
  if (length === 5) return (five ??= unpack(FIVE_LETTER_ANSWERS, 5).filter(isFamilyFriendly));
  return (seven ??= unpack(BLITZ_SEEDS, 7).filter(isFamilyFriendly));
}
