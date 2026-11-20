import { Sparkle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * What the AI does while it reads a new transcript. Shown as a loop (the highlight moves on every
 * few seconds), never as ticks: the api only says "processing", so the page doesn't pretend to
 * know which step is finished.
 */
const STEPS = [
  'Reading the transcript',
  'Finding the decisions',
  'Finding the action items',
  'Checking owners and dates against the transcript',
];
const STEP_MS = 2400;

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * The notes column while the AI analyses the meeting (beside the transcript): a turning AI orb,
 * a card with a travelling gradient border listing what the AI is doing, and two shimmering ghost
 * cards where the decisions and action items will appear.
 *
 * Wide screens: it sits on the dark frame, so it uses the frame's colours. Narrow: inside the
 * light sheet, with the light colours. The custom properties (--ai-card, --shimmer-*,
 * --skeleton-*) feed the utilities in base.css.
 */
export function AnalysisNotesLoader() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    // role="status" with a fixed name: screen readers hear "AI is finding notes" once, not every
    // step change (the cycling step is decorative, aria-hidden).
    <div
      role="status"
      aria-label="AI is finding notes"
      className={cn(
        'space-y-3',
        '[--ai-card:var(--color-surface)] [--shimmer-base:var(--color-muted)] [--shimmer-hi:var(--color-accent)] [--skeleton-base:var(--color-surface-2)] [--skeleton-hi:var(--color-surface)]',
        'xl:[--ai-card:var(--color-sidebar-hover)] xl:[--shimmer-base:var(--color-sidebar-muted)] xl:[--shimmer-hi:#ffffff] xl:[--skeleton-base:rgb(255_255_255/0.05)] xl:[--skeleton-hi:rgb(255_255_255/0.12)]',
      )}
    >
      <div className="rounded-card p-4 shadow-raised ai-border xl:shadow-none">
        <div className="flex items-center gap-3.5">
          <AiOrb />
          <div className="min-w-0">
            <p className="font-semibold text-fg xl:text-white">AI is finding notes</p>
            {/* Keyed by step: each new step fades in. */}
            <p
              key={step}
              aria-hidden="true"
              className="truncate animate-page-in text-sm font-medium ai-shimmer-text"
            >
              {STEPS[step]}…
            </p>
          </div>
        </div>

        <ol aria-hidden="true" className="mt-4 space-y-2 text-sm">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2.5">
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-pill transition-all duration-500',
                  index === step
                    ? 'scale-125 bg-accent shadow-[0_0_0_3px_rgb(43_54_245/0.18)] xl:bg-spark xl:shadow-[0_0_0_3px_rgb(212_255_60/0.18)]'
                    : 'bg-line-strong/50 xl:bg-sidebar-line',
                )}
              />
              <span
                className={cn(
                  'transition-colors duration-500',
                  index === step
                    ? 'font-medium text-fg xl:text-sidebar-fg'
                    : 'text-muted xl:text-sidebar-muted/70',
                )}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-4 border-t border-line pt-3 text-sm text-muted xl:border-sidebar-line xl:text-sidebar-muted">
          Decisions and action items will appear beside the transcript.
        </p>
      </div>

      {/* Where the notes will land: two ghost cards, softly shimmering. */}
      <GhostCard lines={['w-3/4', 'w-1/2']} />
      <GhostCard lines={['w-2/3', 'w-5/6', 'w-1/3']} delay />
    </div>
  );
}

/**
 * A soft orb of the AI gradient, slowly turning, with a sparkle in the middle. Two layers of the
 * same gradient: a blurred one behind (the glow) and a crisp one in front.
 */
function AiOrb() {
  return (
    <div aria-hidden="true" className="relative grid size-11 shrink-0 place-items-center">
      <span className="absolute -inset-1.5 rounded-pill opacity-60 blur-md ai-gradient" />
      <span className="absolute inset-0 rounded-pill ai-gradient" />
      {/* A darker centre, so the white sparkle reads on any part of the gradient. */}
      <span className="absolute inset-[5px] rounded-pill bg-[#171923]/55 backdrop-blur-sm" />
      <Sparkle
        className="relative size-5 text-white motion-safe:animate-ai-spark-spin"
        fill="currentColor"
      />
    </div>
  );
}

/** A placeholder note card: a kind chip and a few lines of "text", shimmering. */
function GhostCard({ lines, delay = false }: { lines: string[]; delay?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="rounded-card border border-line bg-surface/60 p-4 xl:border-sidebar-line xl:bg-white/[0.03]"
    >
      <div className={cn('h-5 w-20 rounded-pill ai-skeleton', delay && '[animation-delay:-0.6s]')} />
      <div className="mt-3 space-y-2">
        {lines.map((width, index) => (
          <div
            key={index}
            className={cn('h-3 rounded-pill ai-skeleton', width, delay && '[animation-delay:-0.6s]')}
          />
        ))}
      </div>
    </div>
  );
}
