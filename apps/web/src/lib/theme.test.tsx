// Dark (default) and light mode: switching, remembering it, and the Account page setting.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { mockApi, renderApp, testUser } from '@/test/renderApp';
import { getTheme, setTheme } from './theme';

afterEach(() => setTheme('dark'));

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
