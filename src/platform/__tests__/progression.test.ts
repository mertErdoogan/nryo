import { describe, expect, it } from 'vitest';
import { makeMeta } from '../../test/fixtures';
import { isBetter, medalFor, medalProgress, nextMedal, niceNumber } from '../scoring';
import { levelFromXp, levelProgress, xpForLevel } from '../services/levels';

describe('scoring', () => {
  const high = makeMeta();
  const low = makeMeta({ score: { label: 'ms', format: 'ms', lowerIsBetter: true }, medals: { bronze: 350, silver: 280, gold: 230 } });

  it('awards medals in both directions', () => {
    expect(medalFor(9, high)).toBe(0);
    expect(medalFor(10, high)).toBe(1);
    expect(medalFor(25, high)).toBe(2);
    expect(medalFor(99, high)).toBe(3);
    expect(medalFor(400, low)).toBe(0);
    expect(medalFor(300, low)).toBe(1);
    expect(medalFor(250, low)).toBe(2);
    expect(medalFor(200, low)).toBe(3);
    expect(medalFor(null, low)).toBe(0);
  });

  it('compares scores and finds the next medal', () => {
    expect(isBetter(5, null)).toBe(true);
    expect(isBetter(5, 4)).toBe(true);
    expect(isBetter(200, 250, true)).toBe(true);
    expect(nextMedal(15, high)).toEqual({ tier: 2, threshold: 20 });
    expect(nextMedal(31, high)).toBeNull();
  });

  it('reports monotonic medal progress', () => {
    const values = [0, 5, 10, 15, 20, 25, 30, 40].map((v) => medalProgress(v, high));
    for (let i = 1; i < values.length; i++) expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
    expect(values.at(-1)).toBe(1);
    expect(medalProgress(500, low)).toBeLessThan(medalProgress(300, low));
  });

  it('rounds to friendly targets', () => {
    expect(niceNumber(37)).toBe(37);
    expect(niceNumber(1234)).toBe(1250);
    expect(niceNumber(263)).toBe(260);
  });
});

describe('levels', () => {
  it('follows the XP curve', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(xpForLevel(10))).toBe(10);
    expect(levelFromXp(xpForLevel(10) - 1)).toBe(9);
    const p = levelProgress(150);
    expect(p.level).toBe(2);
    expect(p.current).toBe(50);
    expect(p.needed).toBe(200);
  });
});
