import { any, num, obj, str } from '../../lib/schema';
import type { GameSaveState, SaveSummary, VersionedSpec } from '../types';
import type { StorageDriver } from '../storage/driver';
import { KEY_PREFIX } from '../storage/driver';
import type { Listener, ReadableStore } from '../storage/persistent-store';
import { decodeEnvelope, encodeEnvelope } from '../storage/persistent-store';

const SAVE_PREFIX = `${KEY_PREFIX}save:`;
const PROGRESS_PREFIX = `${KEY_PREFIX}progress:`;
const ENVELOPE_VERSION = 1;

const summarySchema = obj({ label: str({ max: 120 }), progress: num({ min: 0, max: 1 }) });
const saveStateSchema = obj({
  gameId: str({ max: 64 }),
  version: num({ int: true, min: 0 }),
  updatedAt: num({ min: 0 }),
  summary: summarySchema,
  data: any(),
});
const progressStateSchema = obj({ version: num({ int: true, min: 0 }), updatedAt: num({ min: 0 }), data: any() });

export interface SaveIndexEntry {
  gameId: string;
  updatedAt: number;
  summary: SaveSummary;
}

function decodeData<T>(stored: { version: number; data: unknown }, spec: VersionedSpec<T>): T | null {
  let data: unknown = stored.data;
  if (stored.version !== spec.version) {
    if (stored.version > spec.version || !spec.migrate) return null;
    try {
      data = spec.migrate(stored.version, data);
    } catch {
      return null;
    }
  }
  return data !== null && spec.is(data) ? data : null;
}

/**
 * Per-game persistence. Two kinds of data:
 *  - save: an unfinished round ("Continue Playing"), cleared when the round ends.
 *  - progress: long-lived game data (unlocked levels, ghost laps, idle economy).
 * Each lives under its own key so a broken game can never corrupt another.
 */
export class GameSaveService implements ReadableStore<SaveIndexEntry[]> {
  private index = new Map<string, SaveIndexEntry>();
  private snapshot: SaveIndexEntry[] = [];
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly driver: StorageDriver,
    private readonly now: () => number = Date.now,
  ) {
    this.rebuildIndex();
  }

  private readState(gameId: string): GameSaveState | null {
    const state = decodeEnvelope(this.driver.get(SAVE_PREFIX + gameId), {
      key: '',
      version: ENVELOPE_VERSION,
      schema: saveStateSchema,
      defaults: () => null as never,
    });
    return state && state.gameId === gameId ? state : null;
  }

  rebuildIndex(): void {
    this.index.clear();
    for (const key of this.driver.keys()) {
      if (!key.startsWith(SAVE_PREFIX)) continue;
      const gameId = key.slice(SAVE_PREFIX.length);
      const state = this.readState(gameId);
      if (state) this.index.set(gameId, { gameId, updatedAt: state.updatedAt, summary: state.summary });
      else this.driver.remove(key); // corrupted: discard quietly
    }
    this.emit();
  }

  get = (): SaveIndexEntry[] => this.snapshot;

  has(gameId: string): boolean {
    return this.index.has(gameId);
  }

  summary(gameId: string): SaveIndexEntry | null {
    return this.index.get(gameId) ?? null;
  }

  /** Loads and validates a save with the game's own spec; invalid data is removed. */
  load<T>(gameId: string, spec: VersionedSpec<T>): T | null {
    const state = this.readState(gameId);
    if (!state) return null;
    const data = decodeData(state, spec);
    if (data === null) this.clear(gameId);
    return data;
  }

  write<T>(gameId: string, version: number, data: T, summary: SaveSummary): void {
    const safeSummary: SaveSummary = {
      label: summary.label.slice(0, 120),
      progress: Math.min(1, Math.max(0, Number.isFinite(summary.progress) ? summary.progress : 0)),
    };
    const state: GameSaveState<T> = { gameId, version, updatedAt: this.now(), summary: safeSummary, data };
    this.driver.set(SAVE_PREFIX + gameId, encodeEnvelope(ENVELOPE_VERSION, state));
    this.index.set(gameId, { gameId, updatedAt: state.updatedAt, summary: safeSummary });
    this.emit();
  }

  clear(gameId: string): void {
    this.driver.remove(SAVE_PREFIX + gameId);
    if (this.index.delete(gameId)) this.emit();
  }

  loadProgress<T>(gameId: string, spec: VersionedSpec<T>): T | null {
    const state = decodeEnvelope(this.driver.get(PROGRESS_PREFIX + gameId), {
      key: '',
      version: ENVELOPE_VERSION,
      schema: progressStateSchema,
      defaults: () => null as never,
    });
    return state ? decodeData(state, spec) : null;
  }

  writeProgress<T>(gameId: string, version: number, data: T): void {
    this.driver.set(
      PROGRESS_PREFIX + gameId,
      encodeEnvelope(ENVELOPE_VERSION, { version, updatedAt: this.now(), data }),
    );
  }

  /** Raw entries for export: { key: rawString }. */
  exportRaw(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of this.driver.keys()) {
      if (key.startsWith(SAVE_PREFIX) || key.startsWith(PROGRESS_PREFIX)) {
        const raw = this.driver.get(key);
        if (raw !== null) out[key] = raw;
      }
    }
    return out;
  }

  static isGameDataKey(key: string): boolean {
    return (
      (key.startsWith(SAVE_PREFIX) || key.startsWith(PROGRESS_PREFIX)) &&
      /^[a-z0-9-]{1,64}$/.test(key.slice(key.indexOf(':', KEY_PREFIX.length) + 1))
    );
  }

  clearAll(): void {
    for (const key of this.driver.keys()) {
      if (key.startsWith(SAVE_PREFIX) || key.startsWith(PROGRESS_PREFIX)) this.driver.remove(key);
    }
    this.rebuildIndex();
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    this.snapshot = [...this.index.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    for (const l of [...this.listeners]) l();
  }
}
