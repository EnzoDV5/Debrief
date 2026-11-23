// Dark (default) and light mode: switching, remembering it, and the Account page setting.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderApp, testUser } from '@/test/renderApp';
import { getTheme, setTheme } from './theme';

afterEach(() => {
  // Drop any animation stubs first, so resetting to dark takes the instant path.
  // @ts-expect-error -- jsdom has neither; the test that needs them adds them
  delete document.startViewTransition;
  // @ts-expect-error -- see above
  delete document.documentElement.animate;
  setTheme('dark');
});

describe('theme', () => {
  it('starts dark, switches to light on <html> and remembers it, and switches back', () => {
    expect(getTheme()).toBe('dark');

    setTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('debrief-theme')).toBe('light');
    expect(getTheme()).toBe('light');

    setTheme('dark');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('debrief-theme')).toBeNull();
  });

  it('keeps the toggle in step when the browser animates the switch (one click is enough)', async () => {
    // Like a real browser: the page change happens a moment later, inside the transition.
    const animate = vi.fn();
    document.documentElement.animate = animate;
    document.startViewTransition = ((update: () => void) => {
      const updated = Promise.resolve().then(update);
      return { ready: updated, finished: updated, updateCallbackDone: updated };
    }) as unknown as typeof document.startViewTransition;
    mockApi({ 'GET /api/auth/me': { status: 200, body: { user: testUser } } });
    const user = userEvent.setup();
    renderApp('/account');

    await user.click(await screen.findByRole('radio', { name: 'Light' }));

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked());
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(getTheme()).toBe('light');
    // The new look grows from the button as a circle.
    await waitFor(() => expect(animate).toHaveBeenCalled());
    expect(animate.mock.calls[0]?.[1]).toMatchObject({
      pseudoElement: '::view-transition-new(root)',
    });
  });

  it('is chosen under Appearance on the Account page', async () => {
    mockApi({ 'GET /api/auth/me': { status: 200, body: { user: testUser } } });
    const user = userEvent.setup();
    renderApp('/account');

    const dark = await screen.findByRole('radio', { name: 'Dark' });
    expect(dark).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Light' }));

    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
  });
});
