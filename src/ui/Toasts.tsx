import { useSyncExternalStore } from 'react';
import styles from './Toasts.module.css';

export interface Toast {
  id: number;
  kind: 'achievement' | 'level' | 'info';
  icon: string;
  kicker: string;
  title: string;
  body?: string;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(toast: Omit<Toast, 'id'>, durationMs = 3800): void {
  const id = nextId++;
  toasts = [...toasts, { ...toast, id }].slice(-3);
  emit();
  setTimeout(() => dismissToast(id), durationMs);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function ToastHost() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
  return (
    <div className={styles.host} role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={styles.toast} data-kind={t.kind} onClick={() => dismissToast(t.id)}>
          <span className={styles.icon} aria-hidden="true">
            {t.icon}
          </span>
          <span className={styles.text}>
            <span className={styles.kicker}>{t.kicker}</span>
            <span className={styles.title}>{t.title}</span>
            {t.body && <span className={styles.body}>{t.body}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
