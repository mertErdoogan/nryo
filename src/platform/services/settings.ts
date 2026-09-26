import { bool, num, obj, oneOf } from '../../lib/schema';
import type { Settings } from '../types';
import type { StorageDriver } from '../storage/driver';
import { PersistentStore } from '../storage/persistent-store';

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  volume: 0.6,
  haptics: true,
  motion: 'system',
};

const settingsSchema = obj({
  sound: bool(),
  volume: num({ min: 0, max: 1 }),
  haptics: bool(),
  motion: oneOf(['system', 'reduce', 'full'] as const),
});

export function createSettingsStore(driver: StorageDriver) {
  return new PersistentStore<Settings>(driver, {
    key: 'settings',
    version: 1,
    schema: settingsSchema,
    defaults: () => ({ ...DEFAULT_SETTINGS }),
    repair: (data) => {
      // Keep whichever individual settings are still valid.
      if (typeof data !== 'object' || data === null) return null;
      const d = data as Record<string, unknown>;
      return {
        sound: typeof d.sound === 'boolean' ? d.sound : DEFAULT_SETTINGS.sound,
        volume:
          typeof d.volume === 'number' && d.volume >= 0 && d.volume <= 1 ? d.volume : DEFAULT_SETTINGS.volume,
        haptics: typeof d.haptics === 'boolean' ? d.haptics : DEFAULT_SETTINGS.haptics,
        motion:
          d.motion === 'system' || d.motion === 'reduce' || d.motion === 'full'
            ? d.motion
            : DEFAULT_SETTINGS.motion,
      };
    },
  });
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;
