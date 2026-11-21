// A coloured message box for errors, warnings and info.
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, { classes: string; Icon: typeof Info }> = {
  info: { classes: 'bg-accent-soft text-accent', Icon: Info },
  success: { classes: 'bg-success-soft text-success', Icon: CircleCheck },
  warning: { classes: 'bg-warning-soft text-warning', Icon: TriangleAlert },
  danger: { classes: 'bg-danger-soft text-danger', Icon: CircleAlert },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { classes, Icon } = tones[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-md px-4 py-3 text-sm', classes, className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-fg">{children}</div>}
      </div>
    </div>
  );
}
