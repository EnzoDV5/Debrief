// The strength bar and missing rules under the sign-up password.
import { PASSWORD_RULE, passwordMissing, passwordStrength } from '@debrief/shared';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

const SCORE_COLOURS = { 0: '', 1: 'bg-danger', 2: 'bg-warning', 4: 'bg-success' } as const;
const LABEL_COLOURS = {
  0: 'text-muted',
  1: 'text-danger',
  2: 'text-warning',
  4: 'text-success',
} as const;

export function PasswordStrength({
  id,
  password,
  error,
}: {
  id: string;
  password: string;
  error?: string;
}) {
  const { score, label } = passwordStrength(password);
  const missing = passwordMissing(password);
  const sentence = !password ? PASSWORD_RULE : missing ? `${missing}.` : 'Strong password.';

  return (
    <div id={id} className="space-y-2 text-sm">
      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="grid flex-1 grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={cn(
                'h-1.5 rounded-pill transition-colors duration-300',
                score >= step ? SCORE_COLOURS[score] : 'bg-sidebar-active',
              )}
            />
          ))}
        </div>
        <p
          aria-live="polite"
          className={cn('w-14 shrink-0 text-right font-semibold', LABEL_COLOURS[score])}
        >
          {label}
          {label && <span className="sr-only"> password</span>}
        </p>
      </div>
      {error ? (
        <p className="flex min-h-5.25 items-start gap-1.5 font-medium text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : (
        <p
          className={cn(
            'min-h-5.25 transition-colors',
            password && !missing ? 'text-success' : 'text-muted',
          )}
        >
          {sentence}
        </p>
      )}
    </div>
  );
}
