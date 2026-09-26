import { describe, expect, it } from 'vitest';
import { addDays, parseDateKey, toDateKey } from './date';
import { formatClock, formatCompact, formatScore, pluralize } from './format';
import { createRng, hashString } from './rng';
import { sanitizeName, normalizeQuery } from './sanitize';
import { arr, bool, grid, literal, nullable, num, obj, oneOf, optional, record, str } from './schema';

describe('schema', () => {
  const player = obj({ name: str({ max: 5 }), level: num({ int: true, min: 1 }), tags: arr(str()), nick: optional(str()) });

  it('accepts valid shapes and rejects invalid ones', () => {
    expect(player.is({ name: 'Ada', level: 2, tags: [] })).toBe(true);
    expect(player.is({ name: 'Ada', level: 2, tags: ['a'], nick: 'x' })).toBe(true);
    expect(player.is({ name: 'Ada Lovelace', level: 2, tags: [] })).toBe(false);
    expect(player.is({ name: 'Ada', level: 1.5, tags: [] })).toBe(false);
    expect(player.is({ name: 'Ada', level: 0, tags: [] })).toBe(false);
    expect(player.is({ name: 'Ada', level: 2, tags: [1] })).toBe(false);
    expect(player.is(null)).toBe(false);
    expect(player.is([])).toBe(false);
  });

  it('handles numbers strictly', () => {
    expect(num().is(Number.NaN)).toBe(false);
    expect(num().is(Infinity)).toBe(false);
    expect(num({ max: 3 }).is(4)).toBe(false);
  });

  it('supports literals, unions, nullables, records and grids', () => {
    expect(literal('a').is('a')).toBe(true);
    expect(oneOf(['x', 'y'] as const).is('z')).toBe(false);
    expect(nullable(num()).is(null)).toBe(true);
    expect(bool().is(0)).toBe(false);
    expect(record(num(), { maxKeys: 2 }).is({ a: 1, b: 2 })).toBe(true);
    expect(record(num(), { maxKeys: 1 }).is({ a: 1, b: 2 })).toBe(false);
    expect(grid(num(), 2, 2).is([[1, 2], [3, 4]])).toBe(true);
    expect(grid(num(), 2, 2).is([[1, 2], [3]])).toBe(false);
  });
});

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(createRng(43).next()).not.toBe(seqA[0]);
  });

  it('respects ranges and shuffles without losing items', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const n = rng.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
    const items = [1, 2, 3, 4, 5, 6];
    expect(rng.shuffle(items).sort()).toEqual(items);
    expect(() => rng.pick([])).toThrow();
  });

  it('hashes strings stably', () => {
    expect(hashString('2026-01-01')).toBe(hashString('2026-01-01'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});

describe('format', () => {
  it('formats scores by type', () => {
    expect(formatScore(1234)).toBe('1,234');
    expect(formatScore(250, 'ms')).toBe('250 ms');
    expect(formatScore(250, 'ms', true)).toBe('250ms');
    expect(formatScore(65_400, 'time')).toBe('1:05.4');
    expect(formatScore(1, 'strokes')).toBe('1 stroke');
    expect(formatScore(28, 'strokes', true)).toBe('28');
    expect(formatCompact(12_500)).toBe('12.5K');
    expect(formatClock(59.99)).toBe('0:59');
    expect(pluralize(2, 'game')).toBe('2 games');
  });
});

describe('dates', () => {
  it('produces YYYY-MM-DD keys and does arithmetic', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(parseDateKey('2026-02-30')).toBeNull();
  });
});

describe('sanitize', () => {
  it('cleans names and queries', () => {
    expect(sanitizeName('  <b>Ada‮</b>  Lovelace  ')).toBe('bAda/b Lovelace');
    expect(sanitizeName('x'.repeat(40))).toHaveLength(16);
    expect(normalizeQuery('  RACE\u0000 ')).toBe('race');
  });
});
