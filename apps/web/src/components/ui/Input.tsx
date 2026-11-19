import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { cn } from '@/lib/cn';

// text-base (16px) on purpose: iOS zooms into any input with a smaller font when it's focused.
// The red border comes from aria-invalid, so the visual state and the screen-reader state can
// never disagree.
const inputClasses =
  'block w-full min-h-11 rounded-md border border-line-strong bg-surface px-3 text-base text-fg ' +
  'placeholder:text-muted transition-colors duration-150 ' +
  'hover:border-fg/60 focus:border-accent focus-visible:outline-accent focus-visible:outline-offset-0 ' +
  'aria-invalid:border-danger aria-invalid:focus-visible:outline-danger ' +
  'disabled:cursor-not-allowed disabled:bg-surface-2';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input {...props} className={cn(inputClasses, className)} />;
}

/** Password input with a show/hide toggle (instead of a "confirm password" field). */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('pr-12', className)}
        // Stops browsers offering to "translate" or autocorrect a visible password.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label="Show password"
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </button>
    </div>
  );
}
