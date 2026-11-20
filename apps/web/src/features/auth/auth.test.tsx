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

    expect(
      await screen.findByRole('heading', { name: 'What would you like to debrief?' }),
    ).toBeInTheDocument();
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
    // Only the page's own checks (session, sign-in options), never a login attempt.
    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/login', expect.anything());
  });

  it('logs in and continues to the page the user asked for', async () => {
    mockApi({
      'GET /api/auth/me': unauthenticated,
      'POST /api/auth/login': { status: 200, body: { user: testUser } },
    });
    const user = userEvent.setup();
    const { router } = renderApp('/login?next=%2Faccount');

    await user.type(await screen.findByLabelText('Email'), 'alice@debrief.test');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery-42');
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
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery-42');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    const busy = await screen.findByRole('button', { name: /Logging in/ });
    expect(busy).toBeDisabled();
    await user.click(busy);
    const loginCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/auth/login');
    expect(loginCalls).toHaveLength(1);

    finish({ status: 200, body: { user: testUser } });
    expect(
      await screen.findByRole('heading', { name: 'What would you like to debrief?' }),
    ).toBeInTheDocument();
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
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery-42');
    await user.type(screen.getByLabelText('Confirm password'), 'correct-horse-battery-42');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const email = screen.getByLabelText('Email');
    await waitFor(() =>
      expect(email).toHaveAccessibleDescription('An account with this email already exists'),
    );
    expect(email).toHaveFocus();
  });

  it('checks the password rules when the field is left, before calling the api', async () => {
    mockApi({ 'GET /api/auth/me': unauthenticated });
    const user = userEvent.setup();
    renderApp('/register');

    await user.type(await screen.findByLabelText('Password'), 'short');
    await user.tab();

    expect(
      await screen.findByText('Add 7 more characters, a number and a symbol'),
    ).toBeInTheDocument();
  });

  it('catches a mistyped confirmation before calling the api', async () => {
    const fetchMock = mockApi({ 'GET /api/auth/me': unauthenticated });
    const user = userEvent.setup();
    renderApp('/register');

    await user.type(await screen.findByLabelText('Name'), 'Alice');
    await user.type(screen.getByLabelText('Email'), 'alice@debrief.test');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery-42');
    await user.type(screen.getByLabelText('Confirm password'), 'correct-horse-batery-42');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('The passwords don’t match')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/register', expect.anything());
  });

  it('says in one sentence what the password still needs, and rates it', async () => {
    mockApi({ 'GET /api/auth/me': unauthenticated });
    const user = userEvent.setup();
    renderApp('/register');

    // Empty: the rule itself, and nothing marked as done yet.
    expect(
      await screen.findByText('Use at least 12 characters, with letters, numbers and symbols.'),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Password'), 'lantern');
    expect(screen.getByText('Add 5 more characters, a number and a symbol.')).toBeInTheDocument();
    expect(screen.getByText('Weak')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'Lantern-orbit-Velvet-42');
    expect(screen.getByText('Strong password.')).toBeInTheDocument();
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('tells the user exactly what a rejected password is missing', async () => {
    const fetchMock = mockApi({ 'GET /api/auth/me': unauthenticated });
    const user = userEvent.setup();
    renderApp('/register');

    await user.type(await screen.findByLabelText('Name'), 'Alice');
    await user.type(screen.getByLabelText('Email'), 'alice@debrief.test');
    await user.type(screen.getByLabelText('Password'), 'longpasswordhere');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      expect.stringContaining('Add a number and a symbol'),
    );
    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/register', expect.anything());
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
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery-42');
    await user.type(screen.getByLabelText('Confirm password'), 'correct-horse-battery-42');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Welcome to Debrief, Alice!')).toBeInTheDocument();
  });
});

describe('sign in with Google', () => {
  it('offers Google on both forms when the server has it, keeping where the user was going', async () => {
    mockApi({
      'GET /api/auth/me': unauthenticated,
      'GET /api/auth/providers': { status: 200, body: { google: true, passwordReset: false } },
    });
    const user = userEvent.setup();
    renderApp('/login?next=%2Faccount');

    const signIn = await screen.findByRole('link', { name: 'Sign in with Google' });
    expect(signIn).toHaveAttribute('href', '/api/auth/google/start?next=%2Faccount');

    await user.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(await screen.findByRole('link', { name: 'Sign up with Google' })).toHaveAttribute(
      'href',
      '/api/auth/google/start?next=%2Faccount',
    );
  });

  it('hides the Google button when the server has no Google keys', async () => {
    mockApi({ 'GET /api/auth/me': unauthenticated });
    renderApp('/login');

    await screen.findByRole('heading', { name: 'Log in to Debrief' });
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Sign in with Google' })).not.toBeInTheDocument(),
    );
  });

  it('explains why Google sign-in sent the user back', async () => {
    mockApi({ 'GET /api/auth/me': unauthenticated });
    renderApp('/login?google=error');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t sign you in with Google. Please try again.',
    );
  });

  it('welcomes a brand-new Google account and tidies the address bar', async () => {
    mockApi({ 'GET /api/auth/me': { status: 200, body: { user: testUser } } });
    const { router } = renderApp('/meetings?signed_in=new');

    expect(await screen.findByText('Welcome to Debrief, Alice!')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('does not welcome a returning Google user again', async () => {
    mockApi({ 'GET /api/auth/me': { status: 200, body: { user: testUser } } });
    const { router } = renderApp('/meetings?signed_in=back');

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.queryByText('Welcome to Debrief, Alice!')).not.toBeInTheDocument();
  });

  it('ignores an unknown reason in the address bar', async () => {
    mockApi({ 'GET /api/auth/me': unauthenticated });
    renderApp('/login?google=%3Cscript%3E');

    await screen.findByRole('heading', { name: 'Log in to Debrief' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
      'correct-horse-battery-42',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByText('Your account has been deleted.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('asks a Google account (no password) to type its email instead', async () => {
    let sent: unknown;
    mockApi({
      'GET /api/auth/me': { status: 200, body: { user: { ...testUser, hasPassword: false } } },
      'DELETE /api/auth/account': (body) => {
        sent = body;
        return { status: 204 };
      },
    });
    const user = userEvent.setup();
    renderApp('/account');
    await user.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete your account?' });

    expect(within(dialog).queryByLabelText('Enter your password to confirm')).toBeNull();
    await user.type(within(dialog).getByLabelText('Type your email to confirm'), testUser.email);
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByText('Your account has been deleted.')).toBeInTheDocument();
    expect(sent).toEqual({ email: testUser.email });
  });
});

describe('forgot password', () => {
  const resetOn = { status: 200, body: { google: false, passwordReset: true } };

  it('offers "Forgot password?" next to sign up, only when the server can send email', async () => {
    mockApi({ 'GET /api/auth/me': unauthenticated, 'GET /api/auth/providers': resetOn });
    renderApp('/login');
    expect(await screen.findByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('hides it when email is not set up', async () => {
    mockApi({ 'GET /api/auth/me': unauthenticated });
    renderApp('/login');
    await screen.findByRole('link', { name: 'Create an account' });
    expect(screen.queryByRole('link', { name: 'Forgot password?' })).not.toBeInTheDocument();
  });

  it('asks for the email, then says to check it (the same whether or not it has an account)', async () => {
    let sent: unknown;
    mockApi({
      'GET /api/auth/me': unauthenticated,
      'POST /api/auth/forgot-password': (body) => {
        sent = body;
        return { status: 202, body: { ok: true } };
      },
    });
    const user = userEvent.setup();
    renderApp('/forgot-password');

    await user.type(await screen.findByLabelText('Email'), 'alice@debrief.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText('alice@debrief.test')).toBeInTheDocument();
    expect(sent).toEqual({ email: 'alice@debrief.test' });
  });
});

describe('reset password (the emailed link)', () => {
  it('sets the new password and sends the user to log in, with the token kept out of the address bar', async () => {
    let sent: unknown;
    mockApi({
      'GET /api/auth/me': unauthenticated,
      'POST /api/auth/reset-password': (body) => {
        sent = body;
        return { status: 204 };
      },
    });
    const user = userEvent.setup();
    const { router } = renderApp('/reset-password#token=abc123');

    await waitFor(() => expect(router.state.location.hash).toBe(''));
    await user.type(await screen.findByLabelText('New password'), 'Lantern-orbit-Velvet-42');
    await user.type(screen.getByLabelText('Confirm new password'), 'Lantern-orbit-Velvet-42');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(
      await screen.findByText('Your password has been changed. Log in with your new password.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(sent).toEqual({ token: 'abc123', password: 'Lantern-orbit-Velvet-42' });
  });

  it('explains an expired or used link and offers a new one', async () => {
    mockApi({
      'GET /api/auth/me': unauthenticated,
      'POST /api/auth/reset-password': {
        status: 400,
        body: {
          error: {
            code: 'RESET_LINK_INVALID',
            message: 'This reset link has expired or has already been used. Ask for a new one.',
          },
        },
      },
    });
    const user = userEvent.setup();
    renderApp('/reset-password#token=old');

    await user.type(await screen.findByLabelText('New password'), 'Lantern-orbit-Velvet-42');
    await user.type(screen.getByLabelText('Confirm new password'), 'Lantern-orbit-Velvet-42');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'has expired or has already been used',
    );
    expect(screen.getByRole('link', { name: 'Send me a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('says so when the link has no token', async () => {
    mockApi({ 'GET /api/auth/me': unauthenticated });
    renderApp('/reset-password');
    expect(
      await screen.findByRole('heading', { name: /This link doesn.t work/ }),
    ).toBeInTheDocument();
  });
});
