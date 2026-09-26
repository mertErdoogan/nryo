import { useRef, useState } from 'react';
import { useSettings } from '../hooks/usePlatform';
import { platform } from '../platform';
import { sound } from '../platform/audio';
import { exportProgress, importProgress } from '../platform/data-transfer';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Range, Segmented, SettingRow, Switch } from '../ui/Toggle';
import { setUi, useUi } from './ui-state';
import styles from './SettingsDialog.module.css';

type Message = { tone: 'ok' | 'error'; text: string } | null;

export function SettingsDialog() {
  const { settingsOpen } = useUi();
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const update = (patch: Partial<typeof settings>) => platform.settings.set((s) => ({ ...s, ...patch }));
  const close = () => {
    setUi({ settingsOpen: false });
    setMessage(null);
    setConfirmReset(false);
  };

  const onExport = () => {
    const file = exportProgress(platform);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nryo-progress-${file.exportedAt.slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ tone: 'ok', text: 'Backup downloaded. Import it on any browser to continue there.' });
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const result = importProgress(platform, text);
    setMessage(
      result.ok
        ? {
            tone: 'ok',
            text: `Progress restored (${result.imported} items${result.skipped ? `, ${result.skipped} skipped` : ''}).`,
          }
        : { tone: 'error', text: result.error },
    );
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog open={settingsOpen} onClose={close} title="Settings">
      <div className={styles.group}>
        <p className={styles.groupTitle}>Sound & feel</p>
        <SettingRow title="Sound effects" description="Short effects during play. Never autoplays.">
          <Switch
            checked={settings.sound}
            label="Sound effects"
            onChange={(v) => {
              update({ sound: v });
              if (v) {
                sound.configure(true, settings.volume);
                sound.unlock();
                sound.play('tap');
              }
            }}
          />
        </SettingRow>
        <SettingRow title="Volume">
          <Range
            value={settings.volume}
            label="Volume"
            disabled={!settings.sound}
            onChange={(v) => update({ volume: v })}
          />
        </SettingRow>
        <SettingRow title="Vibration" description="Haptic feedback on supported phones.">
          <Switch checked={settings.haptics} label="Vibration" onChange={(v) => update({ haptics: v })} />
        </SettingRow>
        <SettingRow title="Motion" description="Reduce animations across the arcade.">
          <Segmented
            label="Motion"
            value={settings.motion}
            onChange={(v) => update({ motion: v })}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'reduce', label: 'Less' },
              { value: 'full', label: 'Full' },
            ]}
          />
        </SettingRow>
      </div>

      <div className={styles.group}>
        <p className={styles.groupTitle}>Your progress</p>
        <p className={styles.note}>
          No account needed — scores, saves and achievements live in this browser. Download a backup to move
          them to another device.
        </p>
        <div className={styles.actions}>
          <Button icon="download" size="sm" onClick={onExport}>
            Export backup
          </Button>
          <Button icon="upload" size="sm" onClick={() => fileRef.current?.click()}>
            Import backup
          </Button>
          <Button icon="trash" size="sm" variant="danger" onClick={() => setConfirmReset(true)}>
            Reset everything
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onImportFile(e.target.files?.[0])}
          />
        </div>
        {confirmReset && (
          <div className={styles.confirm} role="alertdialog" aria-label="Confirm reset">
            <p>Erase all scores, saves, favorites and achievements on this browser? This cannot be undone.</p>
            <div className={styles.actions}>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  platform.resetAll();
                  setConfirmReset(false);
                  setMessage({ tone: 'ok', text: 'All progress was reset. Fresh start!' });
                }}
              >
                Yes, erase it
              </Button>
              <Button size="sm" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {message && (
          <p className={styles.message} data-tone={message.tone} role="status">
            {message.text}
          </p>
        )}
      </div>
    </Dialog>
  );
}
