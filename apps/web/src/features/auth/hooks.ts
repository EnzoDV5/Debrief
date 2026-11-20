import {
  authProvidersSchema,
  authResponseSchema,
  type DeleteAccountInput,
  type ForgotPasswordInput,
  type LoginInput,
  type PublicUser,
  type RegisterInput,
  type ResetPasswordInput,
} from '@debrief/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, request, requestNoContent } from '@/api/client';
import { setFlash } from '@/lib/flash';

export const meQueryKey = ['auth', 'me'] as const;

/**
 * Who is logged in. `data` is the user, or `null` when logged out: being logged out is a normal
 * state, not an error. Real errors (server down) still come through as `error`.
 */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async (): Promise<PublicUser | null> => {
      try {
        return (await request('/auth/me', { schema: authResponseSchema })).user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });
}

/**
 * Which sign-in options the server offers (Google only when it's set up there). Fetched once per
 * visit: it only changes when the server's configuration does.
 */
export function useAuthProviders() {
  return useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: () => request('/auth/providers', { schema: authProvidersSchema }),
    staleTime: Infinity,
  });
}

/** For components inside RequireAuth, where a user is guaranteed. */
export function useCurrentUser(): PublicUser {
  const { data } = useMe();
  if (!data) throw new Error('useCurrentUser must be used inside <RequireAuth>');
  return data;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      request('/auth/login', { method: 'POST', body: input, schema: authResponseSchema }),
    // Put the user straight into the cache: the app shell renders without another request.
    onSuccess: ({ user }) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      request('/auth/register', { method: 'POST', body: input, schema: authResponseSchema }),
    onSuccess: ({ user }) => queryClient.setQueryData(meQueryKey, user),
  });
}

/** Clears every cached query on the way out, so the next person on this device sees nothing. */
function useSignedOut() {
  const queryClient = useQueryClient();
  return () => {
    // Forget everything this user loaded, except "who is logged in", which becomes "nobody".
    // (Removing that one too would make the screens still showing ask the server again.)
    queryClient.removeQueries({
      predicate: (query) => !(query.queryKey[0] === 'auth' && query.queryKey[1] === 'me'),
    });
    queryClient.setQueryData(meQueryKey, null);
  };
}

export function useLogout() {
  const signedOut = useSignedOut();
  return useMutation({
    mutationFn: () => requestNoContent('/auth/logout', { method: 'POST' }),
    // Even if the request fails (e.g. offline), the user asked to leave: clear local state.
    onSettled: signedOut,
  });
}

export function useDeleteAccount() {
  const signedOut = useSignedOut();
  return useMutation({
    mutationFn: (input: DeleteAccountInput) =>
      requestNoContent('/auth/account', { method: 'DELETE', body: input }),
    // The message first: signing out sends the page to /login straight away.
    onSuccess: () => {
      setFlash('account-deleted');
      signedOut();
    },
  });
}

/** "Forgot password": asks the server to email a reset link. Always succeeds (see the api). */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      requestNoContent('/auth/forgot-password', { method: 'POST', body: input }),
  });
}

/**
 * Sets a new password with the token from the emailed link. The server ends every session, so
 * anything this browser still thinks about who's logged in is cleared too.
 */
export function useResetPassword() {
  const signedOut = useSignedOut();
  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      requestNoContent('/auth/reset-password', { method: 'POST', body: input }),
    onSuccess: signedOut,
  });
}
