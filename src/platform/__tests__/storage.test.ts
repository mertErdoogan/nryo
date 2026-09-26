import { describe, expect, it } from 'vitest';
import { num, obj } from '../../lib/schema';
import { createMemoryDriver, KEY_PREFIX } from '../storage/driver';
import { decodeEnvelope, PersistentStore } from '../storage/persistent-store';
import { GameSaveService } from '../services/saves';

const schema = obj({ count: num({ int: true, min: 0 }) });
const options = { key: 'test', version: 2, schema, defaults: () => ({ count: 0 }) };

describe('PersistentStore', () => {
  it('persists and reloads values', () => {
    const driver = createMemoryDriver();
    const store = new PersistentStore(driver, options);
    store.set({ count: 3 });
    expect(new PersistentStore(driver, options).get()).toEqual({ count: 3 });
  });

  it('notifies subscribers and supports updater functions', () => {
    const store = new PersistentStore(createMemoryDriver(), options);
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.set((prev) => ({ count: prev.count + 1 }));
    off();
    store.set({ count: 5 });
    expect(calls).toBe(1);
    expect(store.get().count).toBe(5);
  });

  it('recovers from corrupted JSON, wrong shapes and future versions', () => {
    for (const raw of ['{not json', JSON.stringify({ v: 2, d: { count: -1 } }), JSON.stringify({ v: 9, d: { count: 1 } }), '"string"']) {
      const driver = createMemoryDriver({ [`${KEY_PREFIX}test`]: raw });
      expect(new PersistentStore(driver, options).get()).toEqual({ count: 0 });
    }
  });

  it('migrates older versions and repairs partial data', () => {
    const migrated = decodeEnvelope(JSON.stringify({ v: 1, d: { n: 4 } }), {
      ...options,
      migrate: (_from, data) => ({ count: (data as { n: number }).n }),
    });
    expect(migrated).toEqual({ count: 4 });
    const repaired = decodeEnvelope(JSON.stringify({ v: 2, d: { count: 'x' } }), { ...options, repair: () => ({ count: 1 }) });
    expect(repaired).toEqual({ count: 1 });
  });
});

describe('GameSaveService', () => {
  const spec = { version: 1, is: (d: unknown): d is { score: number } => typeof (d as { score?: unknown })?.score === 'number' };

  it('writes, indexes, loads and clears saves', () => {
    let now = 1000;
    const saves = new GameSaveService(createMemoryDriver(), () => now);
    saves.write('merge-2048', 1, { score: 12 }, { label: 'Score 12', progress: 0.3 });
    now = 2000;
    saves.write('sudoku', 1, { score: 1 }, { label: 'Easy', progress: 2 });
    expect(saves.get().map((s) => s.gameId)).toEqual(['sudoku', 'merge-2048']);
    expect(saves.summary('sudoku')?.summary.progress).toBe(1);
    expect(saves.load('merge-2048', spec)).toEqual({ score: 12 });
    saves.clear('merge-2048');
    expect(saves.has('merge-2048')).toBe(false);
  });

  it('discards saves that fail the game validator or come from a newer version', () => {
    const saves = new GameSaveService(createMemoryDriver());
    saves.write('a', 1, { nope: true }, { label: '', progress: 0 });
    expect(saves.load('a', spec)).toBeNull();
    expect(saves.has('a')).toBe(false);
    saves.write('b', 5, { score: 1 }, { label: '', progress: 0 });
    expect(saves.load('b', spec)).toBeNull();
  });

  it('migrates old save versions when the game supports it', () => {
    const saves = new GameSaveService(createMemoryDriver());
    saves.write('a', 1, { points: 7 }, { label: '', progress: 0 });
    const v2 = { version: 2, is: spec.is, migrate: (_v: number, d: unknown) => ({ score: (d as { points: number }).points }) };
    expect(saves.load('a', v2)).toEqual({ score: 7 });
  });

  it('removes corrupted entries when rebuilding the index', () => {
    const driver = createMemoryDriver({ [`${KEY_PREFIX}save:broken`]: 'garbage' });
    const saves = new GameSaveService(driver);
    expect(saves.get()).toEqual([]);
    expect(driver.get(`${KEY_PREFIX}save:broken`)).toBeNull();
  });

  it('stores long-lived progress separately', () => {
    const saves = new GameSaveService(createMemoryDriver());
    saves.writeProgress('pipe-link', 1, { score: 4 });
    expect(saves.loadProgress('pipe-link', spec)).toEqual({ score: 4 });
    saves.write('pipe-link', 1, { score: 1 }, { label: '', progress: 0 });
    saves.clear('pipe-link');
    expect(saves.loadProgress('pipe-link', spec)).toEqual({ score: 4 });
  });
});
