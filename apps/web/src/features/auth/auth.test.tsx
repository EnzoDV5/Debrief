import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, renderApp, testUser, unauthenticated } from '@/test/renderApp';

// These render the real routes and components; only the network is faked.

describe('route guards', () => {
  it('sends a logged-out visitor to login, remembering where they were going', async () => {
    mockApi({ 'GET /api/auth/me': unauthenticated });
    const { router } = renderApp('/account');

    expect(await screen.findByRole('heading', { name: 'Log in to Debrief' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2Faccount');
  });

  it('sends a logged-in user away from the login page', async () => {
    mockApi({ 'GET /api/auth/me': { status: 200, body: { user: testUser } } });
    renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'Meetings' })).toBeInTheDocument();
  });

  it('shows an error with retry when the api is unreachable', async () => {
    mockApi({ 'GET /api/auth/me': { status: 503, body: {} } });
    renderApp('/meetings');

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't load Debrief");
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('login', () => {
  it('shows inline errors and does not call the api when fields are empty', async () => {
    const fetchMock = mockApi({ 'GET /api/auth/me': unauthenticated });
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(await screen.findByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the session check
  });

  it('logs in and continues to the page the user asked for', async () => {
    mockApi({
      'GET /api/auth/me': unauthenticated,
      'POST /api/auth/login': { status: 200, body: { user: testUser } },
    });
    const user = userEvent.setup();
    const { router } = renderApp('/login?next=%2Faccount');

    await user.type(await screen.findByLabelText('Email'), 'alice@debrief.test');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/account');
  });

  it('shows the generic error, keeps the email and clears the password', async () => {
    mockApi({
      'GET /api/auth/me': unauthenticated,
      'POST /api/auth/login': {
        status: 401,
        body: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      },
    });
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(await screen.findByLabelText('Email'), 'alice@debrief.test');
    await user.type(screen.getByLabelText('Password'), 'wrong-password-123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByLabelText('Email')).toHaveValue('alice@debrief.test');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  it('disables the button while submitting, so it cannot be sent twice', async () => {
    let finish: (value: { status: number; body: unknown }) => void = () => {};
    const fetchMock = mockApi({
      'GET /api/auth/me': unauthenticated,
      'POST /api/auth/login': () => new Promise((resolve) => (finish = resolve)),
    });
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(await screen.findByLabelText('Email'), 'alice@debrief.test');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    const busy = await screen.findByRole('button', { name: /Logging in/ });
    expect(busy).toBeDisabled();
    await user.click(busy);
    const loginCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/auth/login');
    expect(loginCalls).toHaveLength(1);

    finish({ status: 200, body: { user: testUser } });
    expect(await screen.findByRole('heading', { name: 'Meetings' })).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    mockApi({ 'GET /api/auth/me': unauthenticated });
    const user = userEvent.setup();
    renderApp('/login');

    const password = await screen.findByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
  });
});

describe('register', () => {
  it('shows the server error under the field it belongs to', async () => {
    mockApi({
      'GET /api/auth/me': unauthenticated,
      'POST /api/auth/register': {
        status: 409,
        body: {
          error: {
            code: 'EMAIL_TAKEN',
            message: 'An account with this email already exists',
            fields: { email: 'An account with this email already exists' },
          },
        },
      },
    });
    const user = userEvent.setup();
    renderApp('/register');

    await user.type(await screen.findByLabelText('Name'), 'Alice');
    await user.type(screen.getByLabelText('Email'), 'alice@debrief.test');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const email = screen.getByLabelText('Email');
    await waitFor(() =>
      expect(email).toHaveAccessibleDescription('An account with this email already exists'),
    );
    expect(email).toHaveFocus();
  });

  it('enforces the password length rule before calling the api', async () => {
    mockApi({ 'GET /api/auth/me': unauthenticated });
    const user = userEvent.setup();
    renderApp('/register');

    await user.type(await screen.findByLabelText('Password'), 'short');
    await user.tab();

    expect(await screen.findByText('Use at least 12 characters')).toBeInTheDocument();
  });

  it('welcomes a new user on the meetings page', async () => {
    mockApi({
      'GET /api/auth/me': unauthenticated,
      'POST /api/auth/register': { status: 201, body: { user: testUser } },
    });
    const user = userEvent.setup();
    renderApp('/register');

    await user.type(await screen.findByLabelText('Name'), testUser.name);
    await user.type(screen.getByLabelText('Email'), testUser.email);
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Welcome to Debrief, Alice!')).toBeInTheDocument();
  });
});

describe('delete account', () => {
  async function openDeleteDialog(handlers: Parameters<typeof mockApi>[0]) {
    mockApi({ 'GET /api/auth/me': { status: 200, body: { user: testUser } }, ...handlers });
    const user = userEvent.setup();
    const result = renderApp('/account');
    await user.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete your account?' });
    return { user, dialog, ...result };
  }

  it('asks for the password and shows a wrong password inline', async () => {
    const { user, dialog } = await openDeleteDialog({
      'DELETE /api/auth/account': {
        status: 400,
        body: {
          error: {
            code: 'INCORRECT_PASSWORD',
            message: 'Password is incorrect',
            fields: { password: 'Password is incorrect' },
          },
        },
      },
    });

    await user.type(
      within(dialog).getByLabelText('Enter your password to confirm'),
      'wrong-password-123',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }));

    expect(await within(dialog).findByText('Password is incorrect')).toBeInTheDocument();
  });

  it('deletes, signs out and confirms on the login page', async () => {
    const { user, dialog, router } = await openDeleteDialog({
      'DELETE /api/auth/account': { status: 204 },
    });

    await user.type(
      within(dialog).getByLabelText('Enter your password to confirm'),
      'correct-horse-battery',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByText('Your account has been deleted.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });
});
