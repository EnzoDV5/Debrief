import type { ComponentProps, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerOutline';
type Size = 'sm' | 'md';

// Each variant owns its colours completely. className can still adjust layout (and cn() makes
// a conflicting class win), but a new colour scheme belongs in a new variant, so every button
// of that kind looks the same everywhere.

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap select-none ' +
  'transition-colors duration-150 ease-out-3 active:translate-y-px ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg shadow-glow hover:bg-accent-hover',
  // Glass: translucent with the bright rim. The border stays strong (3:1) so it reads as a control.
  secondary: 'border border-line-strong bg-surface/60 text-fg shadow-card hover:bg-surface',
  // No text colour: inherits from its surroundings (e.g. muted in the sidebar).
  ghost: 'hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-white hover:bg-danger-hover',
  // A destructive action that shouldn't shout, e.g. "Delete" next to "Edit".
  dangerOutline: 'border border-danger/40 bg-surface/60 text-danger hover:bg-danger-soft',
};

// md is 44px tall: a comfortable touch target on phones.
const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
};

type Common = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

type AsLink = Common & { to: LinkProps['to'] } & Omit<LinkProps, 'to' | 'className' | 'children'>;
type AsButton = Common & {
  to?: never;
  /** Shows a spinner and disables the button, e.g. while a form submits (no double submit). */
  loading?: boolean;
} & Omit<ComponentProps<'button'>, 'className' | 'children'>;

export type ButtonProps = AsLink | AsButton;

/** One look for every action. Renders a router <Link> when given `to`, else a <button>. */
export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', fullWidth, icon, className, children } = props;
  const classes = cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className);

  if (props.to !== undefined) {
    const { variant: _v, size: _s, fullWidth: _f, icon: _i, className: _c, ...rest } = props;
    return (
      <Link {...rest} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }

  const {
    variant: _v,
    size: _s,
    fullWidth: _f,
    icon: _i,
    className: _c,
    loading = false,
    disabled,
    type = 'button',
    ...rest
  } = props;
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}
