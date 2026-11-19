import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays "fresh" for 30s: navigating back and forth doesn't refetch every time.
        staleTime: 30_000,
        // Retry network blips and 5xx, but not 4xx: "not found" won't fix itself.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}
