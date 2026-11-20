import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, renderApp, testUser } from '@/test/renderApp';

const me = { 'GET /api/auth/me': { status: 200, body: { user: testUser } } };
const status = (connected: boolean) => ({
  'GET /api/integrations/google': {
    status: 200,
    body: {
      available: true,
      connected,
      connectedAt: connected ? '2026-11-19T10:00:00.000Z' : null,
    },
  },
});

const MEETING_ID = '0b6f9c2e-4f6d-4c1a-9d3e-2a7b8c9d0e1f';
const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const item = {
  id: ITEM_ID,
  meetingId: MEETING_ID,
  text: 'Send the files',
  owner: 'Ann',
  dueDate: '2026-11-27',
  dueDateText: null,
  status: 'todo',
  needsReview: false,
  reviewReason: null,
  sourceLine: null,
  sourceQuote: null,
  inCalendar: false,
  origin: 'manual',
  position: 0,
  editedAt: null,
};

describe('Google Calendar on the Account page', () => {
  it('offers to connect with a real link (OAuth is a full-page trip to Google)', async () => {
    mockApi({ ...me, ...status(false) });
    renderApp('/account');

    const link = await screen.findByRole('link', { name: 'Connect Google Calendar' });
    expect(link).toHaveAttribute('href', '/api/integrations/google/connect');
  });

  it('confirms the result when Google sends the user back', async () => {
    mockApi({ ...me, ...status(true) });
    renderApp('/account?calendar=connected');

    expect(await screen.findByText('Google Calendar is connected.')).toBeInTheDocument();
    // The message comes from the URL at once; the date arrives with the status request.
    expect(await screen.findByText(/since 19 Nov 2026/)).toBeInTheDocument();
  });

  it('explains a cancelled connection', async () => {
    mockApi({ ...me, ...status(false) });
    renderApp('/account?calendar=denied');
    expect(await screen.findByText(/Connecting was cancelled/)).toBeInTheDocument();
  });

  it('disconnects', async () => {
    let connected = true;
    const fetchMock = mockApi({
      ...me,
      'GET /api/integrations/google': () => ({
        status: 200,
        body: {
          available: true,
          connected,
          connectedAt: connected ? '2026-11-19T10:00:00.000Z' : null,
        },
      }),
      'DELETE /api/integrations/google': () => {
        connected = false;
        return { status: 204 };
      },
    });
    const user = userEvent.setup();
    renderApp('/account');

    await user.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(
      await screen.findByRole('link', { name: 'Connect Google Calendar' }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
  });
});

describe('"Add to calendar" on an action item', () => {
  const items = {
    'GET /api/action-items': {
      status: 200,
      body: {
        actionItems: [{ ...item, meetingTitle: 'Plan', meetingDate: '2026-11-24' }],
        owners: [],
      },
    },
  };

  it('is hidden until Google Calendar is connected', async () => {
    mockApi({ ...me, ...status(false), ...items });
    renderApp('/items');
    await screen.findByText('Send the files');
    expect(screen.queryByRole('button', { name: /Google Calendar/ })).not.toBeInTheDocument();
  });

  it('adds the item and links to the new event', async () => {
    mockApi({
      ...me,
      ...status(true),
      ...items,
      [`POST /api/action-items/${ITEM_ID}/calendar`]: {
        status: 200,
        body: {
          actionItem: { ...item, inCalendar: true },
          eventUrl: 'https://calendar.google.com/event?eid=abc',
        },
      },
    });
    const user = userEvent.setup();
    renderApp('/items');

    await user.click(
      await screen.findByRole('button', { name: 'Add “Send the files” in Google Calendar' }),
    );

    const link = await screen.findByRole('link', { name: /Open in Google Calendar/ });
    expect(link).toHaveAttribute('href', 'https://calendar.google.com/event?eid=abc');
    expect(link).toHaveAttribute('target', '_blank');
    // Now it's in the calendar, the button offers to update that event instead.
    expect(
      screen.getByRole('button', { name: 'Update “Send the files” in Google Calendar' }),
    ).toBeInTheDocument();
  });

  it('offers to reconnect when Google access was revoked', async () => {
    mockApi({
      ...me,
      ...status(true),
      ...items,
      [`POST /api/action-items/${ITEM_ID}/calendar`]: {
        status: 409,
        body: {
          error: { code: 'CALENDAR_RECONNECT', message: 'Google Calendar access was removed.' },
        },
      },
    });
    const user = userEvent.setup();
    renderApp('/items');

    await user.click(await screen.findByRole('button', { name: /in Google Calendar/ }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Google Calendar access was removed.');
    expect(within(alert).getByRole('link', { name: 'Reconnect' })).toHaveAttribute(
      'href',
      '/account',
    );
  });
});
