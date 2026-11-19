import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { createQueryClient } from '@/api/queryClient';
import { routes } from '@/app/routes';

type MockResponse = { status: number; body?: unknown };
type Handler =
  MockResponse | ((body: unknown, url: string) => MockResponse | Promise<MockResponse>);

// Answers every test gets unless it overrides them.
const defaultHandlers: Record<string, Handler> = {
  'GET /api/meetings': { status: 200, body: { meetings: [] } },
  'GET /api/integrations/google': {
    status: 200,
    body: { available: false, connected: false, connectedAt: null },
  },
};

/**
 * Fake api: keys like "POST /api/auth/login" map to a response (or a function of the request
 * body). Unmatched requests fail the test loudly. Returns the mock so tests can inspect calls.
 * JSON bodies are parsed; FormData (file uploads) is passed to the handler as-is.
 * A key without a query string matches any query (the handler gets the full URL to inspect).
 */
export function mockApi(overrides: Record<string, Handler>) {
  const handlers = { ...defaultHandlers, ...overrides };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const key = `${method} ${url}`;
    const handler = handlers[key] ?? handlers[`${method} ${url.split('?')[0]}`];
    if (!handler) throw new Error(`Unexpected request in test: ${key}`);
    const body: unknown =
      init?.body instanceof FormData
        ? init.body
        : init?.body
          ? JSON.parse(String(init.body))
          : undefined;
    const { status, body: responseBody } =
      typeof handler === 'function' ? await handler(body, url) : handler;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseBody,
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Renders the real app routes at `path`, with a fresh query cache. */
export function renderApp(path: string) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
}

export const testUser = {
  id: '6f1c1b2e-6c39-4c50-9b8a-3c1f6f8a2d11',
  email: 'alice@debrief.test',
  name: 'Alice Mokoena',
  createdAt: '2026-11-19T10:00:00.000Z',
};

export const unauthenticated = {
  status: 401,
  body: { error: { code: 'UNAUTHENTICATED', message: 'Please log in to continue' } },
};
