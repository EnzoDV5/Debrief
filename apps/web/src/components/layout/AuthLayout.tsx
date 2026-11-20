import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router';
import { Logo } from '@/components/ui/Logo';
import { HowItWorksDemo } from '@/features/auth/HowItWorksDemo';
import { cn } from '@/lib/cn';
import { AUTH_EXIT_MS, AuthExitContext } from './authExit';
import { AuthMessageSlot } from './AuthMessage';
import { PanelBackdrop } from './PanelBackdrop';
import { SkipLink } from './SkipLink';

/**
 * Login and register, built like the workspace after sign-in: the dark frame (sidebar colour)
 * with the logo and form sitting on it on the left, where the sidebar would be, and on the right
 * the rounded light panel with the drifting colour blobs and an animated walkthrough of how
 * Debrief works.
 * Mobile: just the logo and the form on the dark frame, nothing between the user and signing in.
 *
 * After a successful log in or sign up, the form fades away to the left and the walkthrough
 * fades out (the panel itself stays: in the app it becomes the page's panel), then the app opens.
 */
export function AuthLayout() {
  const [leaving, setLeaving] = useState(false);
  // State (not a ref) so pages re-render with the element once it exists.
  const [messageSlot, setMessageSlot] = useState<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const leave = useCallback((then: () => void) => {
    setLeaving(true);
    timer.current = setTimeout(then, AUTH_EXIT_MS);
  }, []);

  return (
    <AuthExitContext.Provider value={leave}>
      <div className="min-h-dvh bg-sidebar lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <SkipLink />
        {/* on-frame: re-points the colour tokens so the form reads well on the dark frame. */}
        <main
          id="main"
          className={cn(
            // lg:py-20 on both sides: the form is centred in the column's true middle, and the
            // top padding keeps a tall form from ever sliding under the corner logo.
            'relative flex min-h-dvh flex-col px-4 py-6 text-fg on-frame sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:px-10 lg:py-20',
            'transition-[opacity,translate,filter] duration-450 ease-panel',
            leaving && 'pointer-events-none -translate-x-8 opacity-0 blur-sm',
          )}
        >
          {/* Desktop: in the corner, out of the flow, so it doesn't push the form down. */}
          <Logo inverse className="lg:absolute lg:top-6 lg:left-10" />
          {/* Centred in the column (my-auto). Safe to centre because a form never changes height:
              every field keeps a line for its message, and banners have their own area above.
              my-auto rather than justify-center: a form taller than the window then starts at
              the top and scrolls, instead of being cut off at the top.
              max-w-md (a little wider than other forms): room for the two buttons side by side.
              auth-form: switching between log in and sign up animates just this part (a view
              transition, see base.css); the logo and the panel stay put. */}
          <div className="mx-auto my-auto w-full max-w-md py-4 [view-transition-name:auth-form]">
            {/* The message area (AuthMessage), just above the heading. Banners sit at its bottom
                and grow upwards, so the heading never moves. Desktop: it takes no space at all
                (h-0), so it doesn't count towards centring; banners rise into the empty space
                above the form. Phones: it keeps a little space, under the logo. */}
            <div className="relative h-16 lg:h-0">
              <div
                ref={setMessageSlot}
                className="absolute inset-x-0 bottom-3 flex flex-col gap-2"
              />
            </div>
            <AuthMessageSlot.Provider value={messageSlot}>
              <Outlet />
            </AuthMessageSlot.Provider>
          </div>
        </main>
        <BrandPanel leaving={leaving} />
      </div>
    </AuthExitContext.Provider>
  );
}

function BrandPanel({ leaving }: { leaving: boolean }) {
  return (
    // Same panel as the workspace: inset from the window by the frame and rounded the same way.
    // The walkthrough fills its height; if a short window can't fit it, the panel scrolls.
    <aside className="relative my-5 mr-5 hidden overflow-hidden rounded-panel bg-bg text-fg lg:block">
      <PanelBackdrop contained />
      <div
        className={cn(
          'relative h-full overflow-y-auto px-8 py-12 transition-opacity duration-450 ease-panel xl:px-14',
          leaving && 'opacity-0',
        )}
      >
        <h2 className="sr-only">How Debrief works</h2>
        <div className="mx-auto h-full min-h-152 max-w-3xl">
          <HowItWorksDemo />
        </div>
      </div>
    </aside>
  );
}
