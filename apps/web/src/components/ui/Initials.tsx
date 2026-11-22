// A small round avatar with a person's initials ("Aisha Patel" → AP).
import { cn } from '@/lib/cn';

export function Initials({ name, className }: { name: string; className?: string }) {
  const parts = name.trim().split(/\s+/);
  const letters = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '');
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-pill bg-accent text-[0.625rem] font-bold text-accent-fg',
        className,
      )}
    >
      {letters.toUpperCase()}
    </span>
  );
}
