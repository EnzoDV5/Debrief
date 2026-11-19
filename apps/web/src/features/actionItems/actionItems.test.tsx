import type { ActionItem } from '@debrief/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, renderApp, testUser } from '@/test/renderApp';

const me = { 'GET /api/auth/me': { status: 200, body: { user: testUser } } };
const MEETING_ID = '0b6f9c2e-4f6d-4c1a-9d3e-2a7b8c9d0e1f';

function item(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    meetingId: MEETING_ID,
    text: 'Send the files',
    owner: 'Ann',
    dueDate: '2026-11-27',
    dueDateText: 'by Friday 27 November',
    status: 'todo',
    needsReview: false,
    reviewReason: null,
    sourceLine: 2,
    sourceQuote: 'Ann will send the files',
    origin: 'ai',
    position: 0,
    ...overrides,
  };
}

function meetingWith(actionItems: ActionItem[]) {
  return {
    id: MEETING_ID,
    title: 'Weekly sync',
    meetingDate: '2026-11-24',
    sourceType: 'paste',
    analysisStatus: 'done',
    lineCount: 2,
    createdAt: '2026-11-24T08:00:00.000Z',
    updatedAt: '2026-11-24T08:00:00.000Z',
    transcriptLines: [
      { n: 1, speaker: 'Ben', text: 'We chose blue.' },
      { n: 2, speaker: 'Ann', text: 'Ann will send the files by Friday 27 November.' },
    ],
    summary: 'The team chose blue.',
    analysisError: null,
    decisions: [
      { id: '22222222-2222-4222-8222-222222222222', text: 'Use blue', sourceLine: 1, position: 0 },
    ],
    actionItems,
  };
}

const meetingUrl = `/api/meetings/${MEETING_ID}`;
const itemUrl = (id = item().id) => `/api/action-items/${id}`;

describe('action items on the meeting page', () => {
  it('ticks an item off instantly, before the server answers', async () => {
    let answer: (value: { status: number; body: unknown }) => void = () => {};
    let sent: unknown;
    mockApi({
      ...me,
      [`GET ${meetingUrl}`]: { status: 200, body: { meeting: meetingWith([item()]) } },
      [`PATCH ${itemUrl()}`]: (body) => {
        sent = body;
        return new Promise((resolve) => (answer = resolve));
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${MEETING_ID}`);

    const box = await screen.findByRole('checkbox', { name: 'Mark “Send the files” as done' });
    await user.click(box);

    // Optimistic: checked straight away, while the request is still in flight.
    expect(
      screen.getByRole('checkbox', { name: 'Mark “Send the files” as not done' }),
    ).toBeChecked();
    expect(sent).toEqual({ status: 'done' });
    answer({ status: 200, body: { actionItem: item({ status: 'done' }) } });
    expect(await screen.findByText('1 of 1 done')).toBeInTheDocument();
  });

  it('undoes the tick and says why when saving fails', async () => {
    mockApi({
      ...me,
      [`GET ${meetingUrl}`]: { status: 200, body: { meeting: meetingWith([item()]) } },
      [`PATCH ${itemUrl()}`]: { status: 500, body: {} },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${MEETING_ID}`);

    await user.click(await screen.findByRole('checkbox', { name: /as done/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save');
    expect(
      screen.getByRole('checkbox', { name: 'Mark “Send the files” as done' }),
    ).not.toBeChecked();
  });

  it('shows why an item needs review, and editing it clears the warning', async () => {
    const flagged = item({
      owner: null,
      needsReview: true,
      reviewReason: 'Owner “Zed” isn’t mentioned in the transcript',
    });
    let sent: unknown;
    mockApi({
      ...me,
      [`GET ${meetingUrl}`]: { status: 200, body: { meeting: meetingWith([flagged]) } },
      [`PATCH ${itemUrl()}`]: (body) => {
        sent = body;
        return { status: 200, body: { actionItem: item({ owner: 'Ann' }) } };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${MEETING_ID}`);

    expect(await screen.findByText(/Owner “Zed” isn’t mentioned/)).toBeInTheDocument();
    expect(screen.getByText('1 needs review', { exact: false })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit “Send the files”' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit action item' });
    expect(
      within(dialog).getByText('Saving your changes marks this item as reviewed.'),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Owner'), 'Ann');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.queryByText(/Owner “Zed”/)).not.toBeInTheDocument());
    expect(sent).toMatchObject({ text: 'Send the files', owner: 'Ann', dueDate: '2026-11-27' });
  });

  it('adds an action item by hand', async () => {
    let sent: unknown;
    mockApi({
      ...me,
      [`GET ${meetingUrl}`]: { status: 200, body: { meeting: meetingWith([]) } },
      [`POST ${meetingUrl}/action-items`]: (body) => {
        sent = body;
        return {
          status: 201,
          body: {
            actionItem: item({
              id: '33333333-3333-4333-8333-333333333333',
              text: 'Book the venue',
              owner: null,
              dueDate: null,
              dueDateText: null,
              sourceLine: null,
              sourceQuote: null,
              origin: 'manual',
            }),
          },
        };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${MEETING_ID}`);

    await user.click(await screen.findByRole('button', { name: 'Add action item' }));
    const dialog = screen.getByRole('dialog', { name: 'Add an action item' });
    await user.click(within(dialog).getByRole('button', { name: 'Add item' }));
    expect(await within(dialog).findByText('Describe the action item')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Task'), 'Book the venue');
    await user.click(within(dialog).getByRole('button', { name: 'Add item' }));

    expect(await screen.findByText('Book the venue')).toBeInTheDocument();
    expect(screen.getByText('Added by you')).toBeInTheDocument();
    expect(sent).toEqual({ text: 'Book the venue', owner: null, dueDate: null, status: 'todo' });
  });

  it('edits the summary and adds a decision', async () => {
    const sent: Record<string, unknown> = {};
    const base = meetingWith([]);
    mockApi({
      ...me,
      [`GET ${meetingUrl}`]: { status: 200, body: { meeting: base } },
      [`PATCH ${meetingUrl}`]: (body) => {
        sent.summary = body;
        return { status: 200, body: { meeting: { ...base, summary: 'Corrected.' } } };
      },
      [`POST ${meetingUrl}/decisions`]: (body) => {
        sent.decision = body;
        return {
          status: 201,
          body: {
            decision: {
              id: '44444444-4444-4444-8444-444444444444',
              text: 'Ship Friday',
              sourceLine: null,
              position: 1,
            },
          },
        };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${MEETING_ID}`);

    await user.click(await screen.findByRole('button', { name: 'Edit summary' }));
    const summary = screen.getByLabelText('Summary text');
    await user.clear(summary);
    await user.type(summary, 'Corrected.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Corrected.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add decision' }));
    await user.type(screen.getByLabelText('New decision'), 'Ship Friday');
    await user.click(screen.getByRole('button', { name: 'Add decision' }));
    expect(await screen.findByText('Ship Friday')).toBeInTheDocument();
    expect(sent).toEqual({ summary: { summary: 'Corrected.' }, decision: { text: 'Ship Friday' } });
  });
});

describe('"My open items" page', () => {
  const listed = (overrides: Partial<ActionItem> = {}) => ({
    ...item(overrides),
    meetingTitle: 'Weekly sync',
    meetingDate: '2026-11-24',
  });

  it('lists items across meetings with a link back to the source line', async () => {
    mockApi({
      ...me,
      'GET /api/action-items': {
        status: 200,
        body: { actionItems: [listed({ dueDate: '2020-01-01' })], owners: ['Ann'] },
      },
    });
    renderApp('/items');

    expect(await screen.findByText('Send the files')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Weekly sync/ })).toHaveAttribute(
      'href',
      `/meetings/${MEETING_ID}#L2`,
    );
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 item · 1 overdue');
  });

  it('sends the chosen filters to the api and keeps them in the URL', async () => {
    const urls: string[] = [];
    mockApi({
      ...me,
      'GET /api/action-items': (_body, url) => {
        urls.push(url);
        return { status: 200, body: { actionItems: [listed()], owners: ['Ann', 'Ben'] } };
      },
    });
    const user = userEvent.setup();
    const { router } = renderApp('/items');

    await screen.findByText('Send the files');
    expect(urls[0]).toMatch(/status=open/);

    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.selectOptions(screen.getByLabelText('Owner'), 'Ben');
    await user.click(screen.getByLabelText('Overdue only'));

    await waitFor(() =>
      expect(urls.at(-1)).toMatch(/status=done.*today=.*owner=Ben.*overdue=true/),
    );
    expect(screen.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
    expect(router.state.location.search).toBe('?status=done&owner=Ben&overdue=true');
  });

  it('explains an empty filtered list and offers to clear the filters', async () => {
    mockApi({
      ...me,
      'GET /api/action-items': { status: 200, body: { actionItems: [], owners: [] } },
    });
    const user = userEvent.setup();
    const { router } = renderApp('/items?overdue=true');

    expect(await screen.findByText('No items match these filters')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByText('Nothing open right now')).toBeInTheDocument();
  });
});
