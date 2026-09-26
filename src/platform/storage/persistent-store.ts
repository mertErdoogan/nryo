import type { Schema } from '../../lib/schema';
import { isPlainObject } from '../../lib/schema';
import type { StorageDriver } from './driver';
import { KEY_PREFIX } from './driver';

export type Listener = () => void;

export interface ReadableStore<T> {
  get(): T;
  subscribe(listener: Listener): () => void;
}

export interface StoreOptions<T> {
  /** Key without the global prefix. */
  key: string;
  version: number;
  schema: Schema<T>;
  defaults: () => T;
  /** Upgrade data written by an older version. Return null to reset. */
  migrate?: (fromVersion: number, data: unknown) => T | null;
  /**
   * Best-effort recovery when data fails validation (e.g. drop the one broken
   * entry instead of wiping all progress). Return null to reset.
   */
  repair?: (data: unknown) => T | null;
}

interface Envelope {
  v: number;
  d: unknown;
}

const isEnvelope = (value: unknown): value is Envelope =>
  isPlainObject(value) && typeof value.v === 'number' && Number.isInteger(value.v) && 'd' in value;

/**
 * Decodes a raw storage string into validated data. Never throws: corrupted,
 * foreign or future-version data results in `null` (caller uses defaults).
 */
export function decodeEnvelope<T>(raw: string | null, options: StoreOptions<T>): T | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isEnvelope(parsed)) return null;
  let data: unknown = parsed.d;
  if (parsed.v !== options.version) {
    if (parsed.v > options.version || !options.migrate) return null;
    try {
      data = options.migrate(parsed.v, data);
    } catch {
      return null;
    }
    if (data === null) return null;
  }
  if (options.schema.is(data)) return data;
  if (options.repair) {
    try {
      const repaired = options.repair(data);
      if (repaired !== null && options.schema.is(repaired)) return repaired;
    } catch {
      return null;
    }
  }
  return null;
}

export function encodeEnvelope(version: number, data: unknown): string {
  return JSON.stringify({ v: version, d: data });
}

/**
 * A validated, versioned value persisted under a single storage key, with
 * change subscription (compatible with React's useSyncExternalStore).
 */
export class PersistentStore<T> implements ReadableStore<T> {
  private value: T;
  private readonly listeners = new Set<Listener>();
  readonly storageKey: string;

  constructor(
    private readonly driver: StorageDriver,
    private readonly options: StoreOptions<T>,
  ) {
    this.storageKey = KEY_PREFIX + options.key;
    this.value = this.read();
  }

  private read(): T {
    return decodeEnvelope(this.driver.get(this.storageKey), this.options) ?? this.options.defaults();
  }

  get = (): T => this.value;

  set(next: T | ((prev: T) => T)): void {
    const value = typeof next === 'function' ? (next as (prev: T) => T)(this.value) : next;
    if (Object.is(value, this.value)) return;
    this.value = value;
    this.driver.set(this.storageKey, encodeEnvelope(this.options.version, value));
    this.emit();
  }

  /** Re-read from storage (another tab changed it, or data was imported). */
  reload(): void {
    this.value = this.read();
    this.emit();
  }

  reset(): void {
    this.driver.remove(this.storageKey);
    this.value = this.options.defaults();
    this.emit();
  }

  /** True when a raw storage string (e.g. from an imported backup) decodes to valid data. */
  acceptsRaw(raw: string): boolean {
    return decodeEnvelope(raw, this.options) !== null;
  }

  get version(): number {
    return this.options.version;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    for (const l of [...this.listeners]) l();
  }
}

/** A derived read-only store that recomputes when any source changes. */
export function derived<T>(sources: ReadableStore<unknown>[], compute: () => T): ReadableStore<T> {
  let cached = compute();
  let dirty = false;
  const listeners = new Set<Listener>();
  for (const s of sources) {
    s.subscribe(() => {
      dirty = true;
      for (const l of [...listeners]) l();
    });
  }
  return {
    get: () => {
      if (dirty) {
        cached = compute();
        dirty = false;
      }
      return cached;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
