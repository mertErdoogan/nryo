import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { Link } from '../app/router';
import type { IconName } from './Icon';
import { Icon } from './Icon';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  /** Accessible label; required for icon-only buttons. */
  label?: string;
  children?: ReactNode;
  className?: string;
}

function classes({ variant = 'secondary', size = 'md', block, className, iconOnly }: CommonProps & { iconOnly: boolean }) {
  return [
    styles.button,
    variant !== 'secondary' && styles[variant],
    size !== 'md' && styles[size],
    iconOnly && styles.iconOnly,
    block && styles.block,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

const iconSize = (size: Size = 'md') => (size === 'lg' ? 22 : size === 'sm' ? 16 : 18);

function Content({ icon, iconRight, children, size }: CommonProps) {
  return (
    <>
      {icon && <Icon name={icon} size={iconSize(size)} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize(size)} />}
    </>
  );
}

export type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, iconRight, block, label, children, className, type = 'button', ...rest },
  ref,
) {
  const iconOnly = !children && !!icon;
  return (
    <button
      ref={ref}
      type={type}
      className={classes({ variant, size, block, className, iconOnly })}
      aria-label={label}
      title={iconOnly ? label : undefined}
      {...rest}
    >
      <Content icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Content>
    </button>
  );
});

export function ButtonLink({
  to,
  variant,
  size,
  icon,
  iconRight,
  block,
  label,
  children,
  className,
  onClick,
}: CommonProps & { to: string; onClick?: () => void }) {
  const iconOnly = !children && !!icon;
  return (
    <Link
      to={to}
      className={classes({ variant, size, block, className, iconOnly })}
      aria-label={label}
      title={iconOnly ? label : undefined}
      onClick={onClick}
    >
      <Content icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Content>
    </Link>
  );
}
