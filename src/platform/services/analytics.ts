import type { AnalyticsEvent, AnalyticsEventName, AnalyticsProps } from '../types';
import type { StorageDriver } from '../storage/driver';
import { KEY_PREFIX } from '../storage/driver';

/**
 * Internal analytics abstraction. Everything funnels through `track()`, which
 * fans out to pluggable sinks. Out of the box we only keep a small local ring
 * buffer (visible to the player, never sent anywhere); a real provider can be
 * added later by registering another sink — no call sites need to change.
 */
export interface AnalyticsSink {
  readonly name: string;
  track(event: AnalyticsEvent): void;
  flush?(): void;
}

export class Analytics {
  private readonly sinks: AnalyticsSink[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  addSink(sink: AnalyticsSink): () => void {
    this.sinks.push(sink);
    return () => {
      const i = this.sinks.indexOf(sink);
      if (i >= 0) this.sinks.splice(i, 1);
    };
  }

  track(name: AnalyticsEventName, props: AnalyticsProps = {}): void {
    const event: AnalyticsEvent = { name, at: this.now(), props };
    for (const sink of this.sinks) {
      try {
        sink.track(event);
      } catch {
        // A failing sink must never affect gameplay.
      }
    }
  }

  flush(): void {
    for (const sink of this.sinks) sink.flush?.();
  }
}

const BUFFER_KEY = `${KEY_PREFIX}events`;
const BUFFER_SIZE = 200;

/** Keeps the latest events in local storage (debounced writes). */
export function createLocalBufferSink(driver: StorageDriver): AnalyticsSink & { events(): AnalyticsEvent[] } {
  let buffer: AnalyticsEvent[] = [];
  try {
    const raw = driver.get(BUFFER_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      buffer = parsed.filter(
        (e): e is AnalyticsEvent =>
          typeof e === 'object' && e !== null && typeof e.name === 'string' && typeof e.at === 'number',
      );
    }
  } catch {
    buffer = [];
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const write = () => {
    timer = null;
    driver.set(BUFFER_KEY, JSON.stringify(buffer));
  };
  return {
    name: 'local-buffer',
    track(event) {
      buffer.push(event);
      if (buffer.length > BUFFER_SIZE) buffer = buffer.slice(-BUFFER_SIZE);
      if (timer === null) timer = setTimeout(write, 1500);
    },
    flush() {
      if (timer !== null) {
        clearTimeout(timer);
        write();
      }
    },
    events: () => buffer.slice(),
  };
}

export const consoleSink: AnalyticsSink = {
  name: 'console',
  track(event) {
    console.debug('[analytics]', event.name, event.props);
  },
};
