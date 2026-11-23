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
import { setFlash } from '@/lib/flash';

export const meQueryKey = ['auth', 'me'] as const;

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

function useSignedOut() {
  const queryClient = useQueryClient();
  return () => {
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
  const signedOut = useSignedOut();
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
