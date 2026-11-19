import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

// Tests never hit a real server: fetch is replaced with a fake per test.
function mockFetch(response: { ok: boolean; status: number; body: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status,
      json: () => Promise.resolve(response.body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows a loading state, then "API is up" when health is ok', async () => {
    mockFetch({ ok: true, status: 200, body: { status: 'ok' } });
    render(<App />);

    expect(screen.getByRole('status')).toHaveTextContent('Checking API');
    expect(await screen.findByText('API is up')).toBeInTheDocument();
  });

  it('shows an error when the API fails', async () => {
    mockFetch({ ok: false, status: 503, body: {} });
    render(<App />);

    expect(await screen.findByText('API is unreachable')).toBeInTheDocument();
  });

  it('shows an error when the response has the wrong shape', async () => {
    mockFetch({ ok: true, status: 200, body: { status: 'maybe' } });
    render(<App />);

    expect(await screen.findByText('API is unreachable')).toBeInTheDocument();
  });
});
