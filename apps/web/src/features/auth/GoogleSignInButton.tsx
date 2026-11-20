import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import { useAuthProviders } from './hooks';

/**
 * "or", then "Sign in with Google" / "Sign up with Google", beside the form's own button.
 * Both start the same
 * flow: the server sends the user to Google and back, then logs them in, creating the account
 * the first time.
 *
 * A plain link, not a fetch: signing in with Google is a full-page trip to Google and back.
 * Shown only when the server has Google set up. While that's being checked it's already in the
 * page but invisible (and out of the tab order), so the form doesn't jump down when it appears.
 */
export function GoogleSignInButton({
  label,
  next,
}: {
  label: 'Sign in with Google' | 'Sign up with Google';
  /** Where to land after signing in (the page the user originally asked for). */
  next: string | null;
}) {
  const providers = useAuthProviders();
  const [leaving, setLeaving] = useState(false);

  // Coming back with the browser's Back button can restore this page from memory, still showing
  // the spinner from before. Reset it, so the button works again.
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
  // Two pieces, not one wrapper: they sit in the form's button row (see LoginForm's
  // `alternative`), side by side with the submit button from sm up, stacked below that.
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
          // A second click while Google is loading would start a second sign-in.
          if (leaving) event.preventDefault();
          setLeaving(true);
        }}
        aria-disabled={leaving || undefined}
        aria-hidden={checking || undefined}
        // Google's "dark" sign-in button colours, which sit naturally on the dark frame.
        className={cn(
          'flex min-h-11 items-center justify-center gap-2.5 rounded-md border border-[#8e918f] bg-[#131314] px-3 text-sm font-semibold whitespace-nowrap text-[#e3e3e3] transition-colors sm:flex-1',
          'hover:border-[#c4c7c5] hover:bg-[#1f1f20]',
          leaving && 'cursor-wait opacity-80',
          checking && 'invisible',
        )}
      >
        {leaving ? <Spinner className="[&_svg]:size-5" /> : <GoogleMark />}
        {leaving ? 'Opening Google…' : label}
      </a>
    </>
  );
}

/** Google's four-colour "G", as Google's sign-in branding guidelines ask. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5 shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
