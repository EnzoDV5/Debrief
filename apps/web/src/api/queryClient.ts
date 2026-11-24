// React Query settings: data stays fresh for 30s, and 4xx errors aren't retried. A request answered
// "not logged in" means the session has ended, so the app forgets the user.
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { setFlash } from '@/lib/flash';
import { ApiError } from './client';

// Who is logged in (null when nobody is).
export const meQueryKey = ['auth', 'me'] as const;

// Drops the user and everything loaded for them. RequireAuth then sends them to the login page.
export function forgetUser(client: QueryClient) {
  client.removeQueries({
    predicate: (query) => !(query.queryKey[0] === 'auth' && query.queryKey[1] === 'me'),
  });
  client.setQueryData(meQueryKey, null);
}

export function createQueryClient() {
  // The session can end while the page is open: the account was deleted or disabled in the
  // database, or the session expired or was ended elsewhere (a password reset logs out every
  // device). Only UNAUTHENTICATED means that; a wrong password is INVALID_CREDENTIALS.
  const sessionEnded = (error: unknown) => {
    if (!(error instanceof ApiError) || error.code !== 'UNAUTHENTICATED') return;
    if (!client.getQueryData(meQueryKey)) return; // already logged out
    setFlash('session-ended');
    forgetUser(client);
  };

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: sessionEnded }),
    mutationCache: new MutationCache({ onError: sessionEnded }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
  return client;
}
