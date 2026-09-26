import { isPlainObject } from '../lib/schema';
import type { Platform } from './platform';
import { KEY_PREFIX } from './storage/driver';
import { GameSaveService } from './services/saves';

export const EXPORT_APP_ID = 'nryo-arcade';
export const EXPORT_FORMAT = 1;
const MAX_IMPORT_BYTES = 2_000_000;
const MAX_VALUE_BYTES = 400_000;

export interface ExportFile {
  app: typeof EXPORT_APP_ID;
  format: typeof EXPORT_FORMAT;
  exportedAt: string;
  data: Record<string, string>;
}

/** Everything needed to move progress to another browser — no account required. */
export function exportProgress(platform: Platform, now = new Date()): ExportFile {
  const data: Record<string, string> = {};
  for (const key of platform.storeByKey.keys()) {
    const raw = platform.driver.get(key);
    if (raw !== null) data[key] = raw;
  }
  Object.assign(data, platform.saves.exportRaw());
  platform.analytics.track('progress_exported', { keys: Object.keys(data).length });
  return { app: EXPORT_APP_ID, format: EXPORT_FORMAT, exportedAt: now.toISOString(), data };
}

export type ImportResult = { ok: true; imported: number; skipped: number } | { ok: false; error: string };

function looksLikeEnvelope(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainObject(parsed) && typeof parsed.v === 'number' && 'd' in parsed;
  } catch {
    return false;
  }
}

/**
 * Validates a backup file completely before touching current data. Unknown or
 * invalid entries are skipped; if nothing valid remains the import is refused.
 */
export function importProgress(platform: Platform, text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES)
    return { ok: false, error: 'That file is too large to be a Nryo backup.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (
    !isPlainObject(parsed) ||
    parsed.app !== EXPORT_APP_ID ||
    parsed.format !== EXPORT_FORMAT ||
    !isPlainObject(parsed.data)
  ) {
    return { ok: false, error: 'That file is not a Nryo Arcade backup.' };
  }

  const accepted: [string, string][] = [];
  let skipped = 0;
  for (const [key, raw] of Object.entries(parsed.data)) {
    if (typeof raw !== 'string' || raw.length > MAX_VALUE_BYTES || !key.startsWith(KEY_PREFIX)) {
      skipped++;
      continue;
    }
    const store = platform.storeByKey.get(key);
    const valid = store
      ? store.acceptsRaw(raw)
      : GameSaveService.isGameDataKey(key) && looksLikeEnvelope(raw);
    if (valid) accepted.push([key, raw]);
    else skipped++;
  }
  if (accepted.length === 0) return { ok: false, error: 'No usable progress was found in that file.' };

  for (const key of platform.driver.keys()) {
    if (key.startsWith(KEY_PREFIX) && key !== `${KEY_PREFIX}events`) platform.driver.remove(key);
  }
  for (const [key, raw] of accepted) platform.driver.set(key, raw);
  platform.reloadAll();
  platform.analytics.track('progress_imported', { imported: accepted.length, skipped });
  return { ok: true, imported: accepted.length, skipped };
}
