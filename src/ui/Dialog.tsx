import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { Button } from './Button';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  /** Hide the visible title (still announced to screen readers). */
  hideTitle?: boolean;
}

/** Accessible modal built on the native <dialog> element (focus trap and Escape for free). */
export function Dialog({ open, onClose, title, children, wide, hideTitle }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={[styles.dialog, wide && styles.wide].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <h2 id={titleId} className={hideTitle ? 'visually-hidden' : styles.title}>
              {title}
            </h2>
            <Button variant="ghost" icon="x" label="Close" onClick={onClose} />
          </div>
          <div className={styles.body}>{children}</div>
        </div>
      )}
    </dialog>
  );
}
