// The "Sign in with Google" button.
import { useEffect, useState } from 'react';
import { GoogleLogo } from '@/components/ui/GoogleLogo';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import { useAuthProviders } from './hooks';

export function GoogleSignInButton({
  label,
  next,
}: {
  label: 'Sign in with Google' | 'Sign up with Google';
  next: string | null;
}) {
  const providers = useAuthProviders();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setLeaving(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const checking = providers.isPending;
  if (!checking && !providers.data?.google) return null;

  const href = `/api/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'text-center text-xs font-semibold tracking-label text-muted uppercase',
          checking && 'invisible',
        )}
      >
        or
      </span>
      <a
        href={href}
        onClick={(event) => {
          if (leaving) event.preventDefault();
          setLeaving(true);
        }}
        aria-disabled={leaving || undefined}
        aria-hidden={checking || undefined}
        className={cn(
          'flex min-h-11 items-center justify-center gap-2.5 rounded-md border border-[#8e918f] bg-[#131314] px-3 text-sm font-semibold whitespace-nowrap text-[#e3e3e3] transition-colors sm:flex-1',
          'hover:border-[#c4c7c5] hover:bg-[#1f1f20]',
          leaving && 'cursor-wait opacity-80',
          checking && 'invisible',
        )}
      >
        {leaving ? <Spinner className="[&_svg]:size-5" /> : <GoogleLogo />}
        {leaving ? 'Opening Google…' : label}
      </a>
    </>
  );
}
