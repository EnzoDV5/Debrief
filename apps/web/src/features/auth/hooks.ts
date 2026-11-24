// Data hooks for the current user, logging in and out, and the account.
import {
  authProvidersSchema,
  authResponseSchema,
  type UpdateProfileInput,
  type DeleteAccountInput,
  type ForgotPasswordInput,
  type LoginInput,
  type PublicUser,
  type RegisterInput,
  type ResetPasswordInput,
} from '@debrief/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, request, requestNoContent } from '@/api/client';
import { forgetUser, meQueryKey } from '@/api/queryClient';
import { setFlash } from '@/lib/flash';

// How often an open, visible tab checks that you're still logged in, so a deleted account or an
// ended session logs out within a minute even if nobody clicks anything.
const SESSION_CHECK_MS = 60_000;

export function useMe() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async (): Promise<PublicUser | null> => {
      try {
        return (await request('/auth/me', { schema: authResponseSchema })).user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          // Logged in a moment ago: the session ended (for example, the account was deleted).
          if (queryClient.getQueryData(meQueryKey)) setFlash('session-ended');
          return null;
        }
        throw error;
      }
    },
    // Only while someone is logged in; React Query skips it when the tab is hidden.
    refetchInterval: (query) => (query.state.data ? SESSION_CHECK_MS : false),
  });
}

export function useAuthProviders() {
  return useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: () => request('/auth/providers', { schema: authProvidersSchema }),
    staleTime: Infinity,
  });
}

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
    onSuccess: ({ user }) => {
      leftOnPurpose = false;
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      request('/auth/register', { method: 'POST', body: input, schema: authResponseSchema }),
    onSuccess: ({ user }) => {
      leftOnPurpose = false;
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}

// True after you log out or delete your account, until you log in again. RequireAuth then sends you
// to a plain /login instead of adding ?next= for the page you were on, so logging back in starts on
// the New meeting page. (An expired session still remembers the page.)
let leftOnPurpose = false;
export const signedOutOnPurpose = () => leftOnPurpose;

function useSignedOut({ onPurpose = false } = {}) {
  const queryClient = useQueryClient();
  return () => {
    if (onPurpose) leftOnPurpose = true;
    forgetUser(queryClient);
  };
}

export function useLogout() {
  const signedOut = useSignedOut({ onPurpose: true });
  return useMutation({
    mutationFn: () => requestNoContent('/auth/logout', { method: 'POST' }),
    onSettled: signedOut,
  });
}

// Changes your display name; the new name shows everywhere at once (sidebar, account page).
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) =>
      (await request('/auth/me', { method: 'PATCH', body: input, schema: authResponseSchema }))
        .user,
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

// Uploads your own profile photo (already shrunk by the browser); it replaces the Google one.
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photo: Blob) => {
      const body = new FormData();
      body.append('file', photo, 'avatar');
      return (await request('/auth/me/avatar', { method: 'PUT', body, schema: authResponseSchema }))
        .user;
    },
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

// Removes your uploaded photo; your Google photo (if any) shows again.
export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await request('/auth/me/avatar', { method: 'DELETE', schema: authResponseSchema })).user,
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useDeleteAccount() {
  const signedOut = useSignedOut({ onPurpose: true });
  return useMutation({
    mutationFn: (input: DeleteAccountInput) =>
      requestNoContent('/auth/account', { method: 'DELETE', body: input }),
    onSuccess: () => {
      setFlash('account-deleted');
      signedOut();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      requestNoContent('/auth/forgot-password', { method: 'POST', body: input }),
  });
}

export function useResetPassword() {
  const signedOut = useSignedOut();
  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      requestNoContent('/auth/reset-password', { method: 'POST', body: input }),
    onSuccess: signedOut,
  });
}
