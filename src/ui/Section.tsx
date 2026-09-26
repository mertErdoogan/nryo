import type { ReactNode } from 'react';
import { Link } from '../app/router';
import { Icon } from './Icon';
import styles from './Section.module.css';

interface SectionProps {
  title: string;
  emoji?: string;
  subtitle?: ReactNode;
  action?: { label: string; to: string };
  children: ReactNode;
  id?: string;
  headingLevel?: 'h1' | 'h2';
}

export function Section({ title, emoji, subtitle, action, children, id, headingLevel = 'h2' }: SectionProps) {
  const Heading = headingLevel;
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={styles.section} aria-labelledby={headingId} id={id}>
      <div className={styles.head}>
        <div className={styles.titles}>
          <Heading className={styles.title} id={headingId}>
            {emoji && (
              <span className={styles.emoji} aria-hidden="true">
                {emoji}
              </span>
            )}
            {title}
          </Heading>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {action && (
          <Link to={action.to} className={styles.action}>
            {action.label}
            <Icon name="forward" size={16} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function CardGrid({ children, dense }: { children: ReactNode; dense?: boolean }) {
  return <div className={[styles.grid, dense && styles.dense].filter(Boolean).join(' ')}>{children}</div>;
}

export function Shelf({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className={styles.shelf} role="list" aria-label={label}>
      {children}
    </div>
  );
}

export function ShelfItem({ children }: { children: ReactNode }) {
  return <div role="listitem">{children}</div>;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  level = 3,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** Heading level of the title; the 404 page uses 1. */
  level?: 1 | 2 | 3;
}) {
  const Title = `h${level}` as const;
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        {icon}
      </span>
      <Title className={styles.emptyTitle}>{title}</Title>
      {children && <p className={styles.emptyBody}>{children}</p>}
      {action}
    </div>
  );
}
