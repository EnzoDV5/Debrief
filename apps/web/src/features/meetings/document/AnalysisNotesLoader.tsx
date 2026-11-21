// What you see while the AI reads a transcript: a glowing sparkle with little stars orbiting it,
// and a line that cycles through what the AI is doing.
import { useEffect, useState } from 'react';

// Shown as a loop, never as ticks: the api only says "processing", so we don't pretend to know
// which step has finished.
const STEPS = [
  'Reading the transcript',
  'Finding the decisions',
  'Finding the action items',
  'Checking owners and dates',
];
const STEP_MS = 2400;

export function AnalysisNotesLoader() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-label="AI is finding notes"
      className="flex flex-col items-center text-center xl:text-sidebar-fg"
    >
      <div aria-hidden="true" className="relative grid size-32 place-items-center">
        <span className="absolute inset-5 motion-safe:animate-logo-glow">
          <span className="block size-full ai-gradient rounded-pill blur-2xl" />
        </span>

        <span className="absolute inset-0 motion-safe:animate-ai-orbit">
          <Star position="top-1 left-1/2 -ml-2 size-4" colour="bg-spark" />
          <Star position="bottom-4 left-2 size-3" colour="bg-violet" delay="-0.8s" />
          <Star position="right-2 bottom-7 size-2.5" colour="bg-accent xl:bg-white" delay="-1.4s" />
        </span>

        <span className="relative size-16 motion-safe:animate-ai-spark-spin">
          <span className="block size-full ai-gradient mask-sparkle" />
        </span>
      </div>

      <p className="mt-3 font-semibold">AI is reading your meeting</p>
      <p className="mt-1 h-5 text-sm">
        <span key={step} className="inline-block motion-safe:animate-step-in">
          <span className="ai-shimmer-text [--shimmer-base:var(--color-muted)] [--shimmer-hi:var(--color-accent)] xl:[--shimmer-base:var(--color-sidebar-muted)] xl:[--shimmer-hi:#fff]">
            {STEPS[step]}…
          </span>
        </span>
      </p>
      <p className="mt-3 max-w-64 text-xs text-muted xl:text-sidebar-muted">
        Decisions and action items will appear beside the transcript.
      </p>
    </div>
  );
}

// A small twinkling star. The outer span places it; the inner one twinkles (both use transform).
function Star({ position, colour, delay }: { position: string; colour: string; delay?: string }) {
  return (
    <span className={`absolute ${position}`}>
      <span
        className={`block size-full mask-sparkle motion-safe:animate-ai-spark-flicker ${colour}`}
        style={delay ? { animationDelay: delay } : undefined}
      />
    </span>
  );
}
