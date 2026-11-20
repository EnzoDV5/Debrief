import { GOOGLE_SIGN_IN_ERRORS, type GoogleSignInError } from '@debrief/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useLeaveAuth, type EntranceState } from '@/components/layout/authExit';
import { AuthMessage } from '@/components/layout/AuthMessage';
import { Alert } from '@/components/ui/Alert';
import { GoogleSignInButton } from '@/features/auth/GoogleSignInButton';
import { useAuthProviders } from '@/features/auth/hooks';
import { LoginForm } from '@/features/auth/LoginForm';
import { clearFlash, peekFlash, type FlashMessage } from '@/lib/flash';
import { safeRedirect } from '@/lib/safeRedirect';
import { usePageTitle } from '@/lib/usePageTitle';

/** One-off messages other pages leave for the login page (see lib/flash.ts). */
const notices: Record<FlashMessage, string> = {
  'account-deleted': 'Your account has been deleted.',
  'password-reset': 'Your password has been changed. Log in with your new password.',
};

/** Why Google sign-in sent the user back here (?google=...), in words. */
const googleMessages: Record<GoogleSignInError, string> = {
  denied: 'Google sign-in was cancelled. You can try again, or log in with your email.',
  unverified:
    'Google hasn’t verified the email on that account, so we can’t use it to sign you in. Verify it with Google, or use your email and a password.',
  unavailable: 'Sign in with Google isn’t available right now. Log in with your email instead.',
  error: 'We couldn’t sign you in with Google. Please try again.',
};

function googleError(value: string | null): GoogleSignInError | null {
  return GOOGLE_SIGN_IN_ERRORS.find((code) => code === value) ?? null;
}

export function LoginPage() {
  usePageTitle('Log in');
  const navigate = useNavigate();
  const leave = useLeaveAuth();
  const providers = useAuthProviders();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const [notice] = useState(peekFlash);
  useEffect(clearFlash, []); // shown once: gone on the next visit

  const google = googleError(searchParams.get('google'));

  return (
    <>
      <h1 className="text-2xl font-bold">Log in to Debrief</h1>
      <p className="mt-2 text-muted">Welcome back. Your meetings and action items are waiting.</p>

      {notice && (
        <AuthMessage>
          <Alert tone="success">{notices[notice]}</Alert>
        </AuthMessage>
      )}

      {google && (
        // Cancelling is the user's own choice, so it's information, not an error.
        <AuthMessage>
          <Alert tone={google === 'denied' ? 'info' : 'danger'}>{googleMessages[google]}</Alert>
        </AuthMessage>
      )}

      <div className="mt-6 space-y-5">
        {/* After logging in: the sign-in page fades away and the app grows in (authExit.ts),
            continuing to the page the user originally asked for. */}
        <LoginForm
          alternative={<GoogleSignInButton label="Sign in with Google" next={next} />}
          onSuccess={() =>
            leave(() =>
              navigate(safeRedirect(next), {
                replace: true,
                state: { entrance: true } satisfies EntranceState,
              }),
            )
          }
        />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        New to Debrief?{' '}
        <Link
          viewTransition
          to={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}
          className="font-semibold text-spark underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
        {/* Only when the server can send the email (see GET /api/auth/providers). */}
        {providers.data?.passwordReset && (
          <>
            <span aria-hidden="true" className="mx-2">
              ·
            </span>
            <Link
              viewTransition
              to="/forgot-password"
              className="font-semibold text-spark underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </>
        )}
      </p>
    </>
  );
}
