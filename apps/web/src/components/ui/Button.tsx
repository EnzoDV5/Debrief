// The app's button, with a few variants and a loading state.
import type { ComponentProps, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerOutline';
type Size = 'sm' | 'md';

// Hover: a solid colour wipes up from the bottom and the text flips to stay readable. The fill is
// the lower half of a two-colour background that slides up, so its corners match the button exactly
// (no halo), and the background stops at the border (no light gaps on dark backgrounds). It is a
// little taller than twice the button, so neither colour leaves a hairline at the edge.
// The resting shadow has a thin white top highlight; it is dropped on hover so it never sits on
// top of the fill.
const base =
  'inline-flex items-center justify-center gap-2 rounded-md bg-clip-padding font-semibold whitespace-nowrap select-none ' +
  '[background-size:100%_210%] bg-top hover:bg-bottom ' +
  'transition-[background-position,color,border-color,box-shadow,scale] duration-300 ease-out-3 active:scale-[0.97] ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-top disabled:active:scale-100';

const variants: Record<Variant, string> = {
  primary:
    'bg-[linear-gradient(to_top,var(--color-accent-hover)_50%,var(--color-accent)_50%)] text-accent-fg shadow-glow hover:shadow-[0_8px_20px_-10px_var(--color-accent)]',
  secondary:
    'border border-line-strong bg-[linear-gradient(to_top,var(--color-fg)_50%,var(--color-surface)_50%)] text-fg shadow-card hover:border-fg hover:text-white hover:shadow-none',
  ghost:
    'bg-[linear-gradient(to_top,var(--color-accent-soft)_50%,transparent_50%)] hover:text-accent',
  danger:
    'bg-[linear-gradient(to_top,var(--color-danger-hover)_50%,var(--color-danger)_50%)] text-white shadow-card hover:shadow-none',
  dangerOutline:
    'border border-danger/40 bg-[linear-gradient(to_top,var(--color-danger)_50%,var(--color-surface)_50%)] text-danger hover:border-danger hover:text-white',
};

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
  loading?: boolean;
} & Omit<ComponentProps<'button'>, 'className' | 'children'>;

export type ButtonProps = AsLink | AsButton;

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
