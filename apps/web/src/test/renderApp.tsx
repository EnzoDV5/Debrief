// Renders the real app in tests, with a fresh cache each time.
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type InitialEntry } from 'react-router';
import { vi } from 'vitest';
import { createQueryClient } from '@/api/queryClient';
import { routes } from '@/app/routes';

type MockResponse = { status: number; body?: unknown };
type Handler =
  MockResponse | ((body: unknown, url: string) => MockResponse | Promise<MockResponse>);

const defaultHandlers: Record<string, Handler> = {
  'GET /api/meetings': { status: 200, body: { meetings: [] } },
  'GET /api/meetings?archived=true': { status: 200, body: { meetings: [] } },
  'GET /api/projects': { status: 200, body: { projects: [] } },
  'GET /api/action-items': { status: 200, body: { actionItems: [], owners: [] } },
  'GET /api/auth/providers': { status: 200, body: { google: false, passwordReset: false } },
  'GET /api/integrations/google': {
    status: 200,
    body: { available: false, connected: false, connectedAt: null },
  },
};

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

// `path` is a URL, or an object when the test also needs navigation state ({ pathname, hash, state }).
export function renderApp(path: InitialEntry) {
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
  hasPassword: true,
};

export const unauthenticated = {
  status: 401,
  body: { error: { code: 'UNAUTHENTICATED', message: 'Please log in to continue' } },
};
