// The layout for the sign-in pages, with the form on the left and the demo on the right.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router';
import { Logo } from '@/components/ui/Logo';
import { HowItWorksDemo } from '@/features/auth/HowItWorksDemo';
import { cn } from '@/lib/cn';
import { AUTH_EXIT_MS, AuthExitContext } from './authExit';
import { AuthMessageSlot } from './AuthMessage';
import { PanelBackdrop } from './PanelBackdrop';
import { SkipLink } from './SkipLink';

export function AuthLayout() {
  const [leaving, setLeaving] = useState(false);
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
        <main
          id="main"
          className={cn(
            'relative flex min-h-dvh flex-col px-4 py-6 text-fg on-frame sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:px-10 lg:py-20',
            'transition-[opacity,translate,filter] duration-450 ease-panel',
            leaving && 'pointer-events-none -translate-x-8 opacity-0 blur-sm',
          )}
        >
          <Logo inverse className="lg:absolute lg:top-6 lg:left-10" />
          <div className="mx-auto my-auto w-full max-w-md py-4 [view-transition-name:auth-form]">
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
