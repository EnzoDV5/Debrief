import { CalendarDays, Link2, TriangleAlert, UserRound } from 'lucide-react';
import { Outlet } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { Logo } from '@/components/ui/Logo';
import { SkipLink } from './SkipLink';

/**
 * Login and register. Desktop: cobalt brand panel on the left that explains the product in one
 * look, form on the right. Mobile: just the logo and the form, nothing between the user and
 * signing in.
 */
export function AuthLayout() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <SkipLink />
      <BrandPanel />
      <main id="main" className="flex min-h-dvh flex-col px-4 py-8 sm:px-6 lg:min-h-0 lg:py-12">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-form flex-1 flex-col justify-center py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-accent p-12 text-white lg:flex lg:flex-col xl:p-16">
      {/* Soft light in the corner, purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-40 size-[32rem] rounded-full bg-white/10 blur-3xl"
      />
      <Logo inverse />

      <div className="relative mt-auto max-w-lg">
        <p className="eyebrow text-white/75">Meeting notes you can check</p>
        <h2 className="mt-4 text-3xl font-bold">
          Meetings in.
          <br />
          Decisions <span className="text-spark">out.</span>
        </h2>
        <p className="mt-5 text-lg text-white/85">
          Paste a transcript and get the summary, the decisions and every action item, each one
          linked back to the line it came from.
        </p>

        <ExampleActionItem />
      </div>
    </aside>
  );
}

/** A sample result card: shows what "trustworthy" means before the user has even signed up. */
function ExampleActionItem() {
  return (
    <figure className="mt-10 rounded-card bg-surface p-5 text-fg shadow-raised">
      <figcaption className="sr-only">Example of an action item Debrief extracts</figcaption>
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow text-muted">Action item</p>
        <span className="eyebrow inline-flex items-center gap-1 text-accent">
          <Link2 aria-hidden="true" className="size-3.5" /> Line 42
        </span>
      </div>
      <p className="mt-2 font-semibold">Send the revised budget to finance</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <UserRound aria-hidden="true" className="size-4" /> Thandi
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" className="size-4" /> No date mentioned
        </span>
        <Badge tone="warning" icon={<TriangleAlert aria-hidden="true" />}>
          Needs review
        </Badge>
      </div>
    </figure>
  );
}
