// Action items in the UI: tick, edit, add, delete and filters.
import type { ActionItem } from '@debrief/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addDays } from '@/components/ui/DatePicker';
import { todayDate } from '@/lib/format';
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
    decisionId: null,
    inCalendar: false,
    origin: 'ai',
    position: 0,
    editedAt: null,
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
    pinnedAt: null,
    archivedAt: null,
    projectId: null,
    updatedAt: '2026-11-24T08:00:00.000Z',
    transcriptLines: [
      { n: 1, speaker: 'Ben', text: 'We chose blue.' },
      { n: 2, speaker: 'Ann', text: 'Ann will send the files by Friday 27 November.' },
    ],
    summary: 'The team chose blue.',
    analysisError: null,
    decisions: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        text: 'Use blue',
        sourceLine: 1,
        position: 0,
        editedAt: null,
      },
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

    expect(
      screen.getByRole('checkbox', { name: 'Mark “Send the files” as not done' }),
    ).toBeChecked();
    expect(sent).toEqual({ status: 'done' });
    answer({ status: 200, body: { actionItem: item({ status: 'done' }) } });
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Mark “Send the files” as not done' }),
      ).toBeChecked(),
    );
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

    await user.click(screen.getByRole('button', { name: 'Edit “Send the files”' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit action item' });
    expect(
      within(dialog).getByText('Saving your changes marks this item as reviewed.'),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Assigned to/), 'Ann');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.queryByText(/Owner “Zed”/)).not.toBeInTheDocument());
    expect(sent).toMatchObject({ text: 'Send the files', owner: 'Ann', dueDate: '2026-11-27' });
  });

  it('offers to add a missing owner and due date by hand', async () => {
    const gaps = item({ owner: null, dueDate: null, dueDateText: null });
    let sent: unknown;
    mockApi({
      ...me,
      [`GET ${meetingUrl}`]: { status: 200, body: { meeting: meetingWith([gaps]) } },
      [`PATCH ${itemUrl()}`]: (body) => {
        sent = body;
        return { status: 200, body: { actionItem: item({ owner: 'Ann', dueDate: '2026-12-04' }) } };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${MEETING_ID}`);

    expect(
      await screen.findByRole('button', { name: 'Add a due date to “Send the files”' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Assign someone to “Send the files”' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit action item' });
    await user.type(within(dialog).getByLabelText(/^Assigned to/), 'Ann');
    // The due date comes from our calendar: "Tomorrow" is one of its shortcuts.
    await user.click(within(dialog).getByRole('button', { name: /^Due date/ }));
    await user.click(screen.getByRole('button', { name: 'Tomorrow' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    const tomorrow = addDays(todayDate(), 1);
    await waitFor(() => expect(sent).toMatchObject({ owner: 'Ann', dueDate: tomorrow }));
    expect(screen.queryByRole('button', { name: /Assign someone to/ })).not.toBeInTheDocument();
  });

  it('shows the source words, picks someone from the meeting and sets the status', async () => {
    let sent: unknown;
    mockApi({
      ...me,
      [`GET ${meetingUrl}`]: { status: 200, body: { meeting: meetingWith([item()]) } },
      [`PATCH ${itemUrl()}`]: (body) => {
        sent = body;
        return { status: 200, body: { actionItem: item({ owner: 'Ben', status: 'in_progress' }) } };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${MEETING_ID}`);

    await user.click(await screen.findByRole('button', { name: 'Edit “Send the files”' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit action item' });
    // The whole transcript line, with who said it.
    expect(within(dialog).getByRole('figure', { name: /Ann.*Line 2/ })).toHaveTextContent(
      '“Ann will send the files by Friday 27 November.”',
    );
    // The date is spelled out next to the words said in the meeting.
    expect(within(dialog).getByLabelText(/^Due date/)).toHaveAccessibleDescription(
      'Friday, 27 November 2026 · said in the meeting as “by Friday 27 November”',
    );

    // Everyone in the meeting is in the dropdown; the current assignee is marked.
    const assignee = within(dialog).getByRole('combobox', { name: /^Assigned to/ });
    await user.click(within(dialog).getByRole('button', { name: 'Show people in this meeting' }));
    const people = screen.getByRole('listbox', { name: 'People in this meeting' });
    expect(within(people).getByRole('option', { name: 'Ann' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(within(people).getByRole('option', { name: 'Ben' }));
    expect(assignee).toHaveValue('Ben');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Typing narrows the list; Enter on a highlighted name picks it.
    await user.clear(assignee);
    await user.type(assignee, 'an');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Ann' })).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(assignee).toHaveValue('Ann');
    await user.click(within(dialog).getByRole('button', { name: 'Show people in this meeting' }));
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Ben' }));

    expect(within(dialog).getByRole('radio', { name: 'To do' })).toBeChecked();
    await user.click(within(dialog).getByRole('radio', { name: 'In progress' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(sent).toMatchObject({ owner: 'Ben', status: 'in_progress' }));
  });

  it('adds an action item by clicking a sentence in the transcript', async () => {
    const said = 'Ann will send the files by Friday 27 November.';
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
              sourceLine: 2,
              sourceQuote: said,
              origin: 'manual',
            }),
          },
        };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${MEETING_ID}`);

    await user.click(await screen.findByText(said));
    const toolbar = screen.getByRole('toolbar', { name: 'Create from the transcript' });
    await user.click(within(toolbar).getByRole('button', { name: 'Action item' }));

    const dialog = screen.getByRole('dialog', { name: 'Add an action item' });
    expect(within(dialog).getByRole('figure', { name: /Line 2/ })).toBeInTheDocument();
    const task = within(dialog).getByLabelText('What needs to be done');
    expect(task).toHaveValue(said);
    await user.clear(task);
    await user.click(within(dialog).getByRole('button', { name: 'Add item' }));
    expect(await within(dialog).findByText('Describe the action item')).toBeInTheDocument();

    await user.type(task, 'Book the venue');
    await user.click(within(dialog).getByRole('button', { name: 'Add item' }));

    expect(
      await within(document.getElementById('L2')!).findByText('Book the venue'),
    ).toBeInTheDocument();
    expect(sent).toEqual({
      text: 'Book the venue',
      owner: null,
      dueDate: null,
      status: 'todo',
      decisionId: null,
      sourceLine: 2,
      sourceQuote: said,
    });
  });

  it('lists a decision’s tasks on its card, ticks them off there and adds new ones', async () => {
    const DECISION_ID = '22222222-2222-4222-8222-222222222222';
    const linked = item({ decisionId: DECISION_ID });
    const sent: Record<string, unknown> = {};
    mockApi({
      ...me,
      [`GET ${meetingUrl}`]: { status: 200, body: { meeting: meetingWith([linked]) } },
      [`PATCH ${itemUrl()}`]: (body) => {
        sent.patch = body;
        return { status: 200, body: { actionItem: { ...linked, status: 'done' } } };
      },
      [`POST ${meetingUrl}/action-items`]: (body) => {
        sent.create = body;
        return {
          status: 201,
          body: {
            actionItem: item({
              id: '55555555-5555-4555-8555-555555555555',
              text: 'Order blue paint',
              decisionId: DECISION_ID,
              origin: 'manual',
            }),
          },
        };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${MEETING_ID}`);

    const tasks = await screen.findByRole('region', { name: 'Tasks for “Use blue”' });
    expect(tasks).toHaveTextContent('0/1 done');
    expect(within(tasks).getByRole('button', { name: /Send the files/ })).toBeInTheDocument();

    await user.click(
      within(tasks).getByRole('checkbox', { name: 'Mark “Send the files” as done' }),
    );
    expect(sent.patch).toEqual({ status: 'done' });
    await waitFor(() => expect(tasks).toHaveTextContent('1/1 done'));

    await user.click(within(tasks).getByRole('button', { name: 'Add a task for “Use blue”' }));
    const dialog = screen.getByRole('dialog', { name: 'Add an action item' });
    expect(dialog).toHaveTextContent('Add a task that puts this decision into action.');
    expect(within(dialog).getByRole('button', { name: 'For decision, Use blue' })).toBeVisible();
    await user.type(within(dialog).getByLabelText('What needs to be done'), 'Order blue paint');
    await user.click(within(dialog).getByRole('button', { name: 'Add item' }));

    await waitFor(() =>
      expect(sent.create).toEqual({
        text: 'Order blue paint',
        owner: null,
        dueDate: null,
        status: 'todo',
        decisionId: DECISION_ID,
        // It sits beside the decision's line in the transcript.
        sourceLine: 1,
        sourceQuote: null,
      }),
    );
    expect(await within(tasks).findByRole('button', { name: /Order blue paint/ })).toBeVisible();
  });

  it('says when nobody is acting on a decision, and links a task from its edit form', async () => {
    let sent: unknown;
    mockApi({
      ...me,
      [`GET ${meetingUrl}`]: { status: 200, body: { meeting: meetingWith([item()]) } },
      [`PATCH ${itemUrl()}`]: (body) => {
        sent = body;
        return {
          status: 200,
          body: { actionItem: item({ decisionId: '22222222-2222-4222-8222-222222222222' }) },
        };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${MEETING_ID}`);

    const tasks = await screen.findByRole('region', { name: 'Tasks for “Use blue”' });
    expect(tasks).toHaveTextContent('No tasks yet');

    await user.click(screen.getByRole('button', { name: 'Edit “Send the files”' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit action item' });
    await user.click(within(dialog).getByRole('button', { name: 'For decision, No decision' }));
    await user.click(screen.getByRole('option', { name: 'Use blue' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(sent).toMatchObject({ decisionId: '22222222-2222-4222-8222-222222222222' }),
    );
    expect(await within(tasks).findByRole('button', { name: /Send the files/ })).toBeVisible();
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
              sourceLine: 1,
              position: 1,
              editedAt: null,
            },
          },
        };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${MEETING_ID}`);

    await user.click(await screen.findByRole('button', { name: 'Summary' }));
    await user.click(screen.getByRole('button', { name: 'Edit summary' }));
    const summary = screen.getByLabelText('Summary text');
    await user.clear(summary);
    await user.type(summary, 'Corrected.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Corrected.')).toBeInTheDocument();

    await user.click(screen.getByText('We chose blue.'));
    const toolbar = screen.getByRole('toolbar', { name: 'Create from the transcript' });
    await user.click(within(toolbar).getByRole('button', { name: 'Decision' }));
    const dialog = screen.getByRole('dialog', { name: 'Add decision' });
    expect(dialog).toHaveTextContent('From line 1 of the transcript');
    const text = within(dialog).getByLabelText('New decision');
    expect(text).toHaveValue('We chose blue.');
    await user.clear(text);
    await user.type(text, 'Ship Friday');
    await user.click(within(dialog).getByRole('button', { name: 'Add decision' }));
    expect(
      await within(document.getElementById('L1')!).findByText('Ship Friday'),
    ).toBeInTheDocument();
    expect(sent).toEqual({
      summary: { summary: 'Corrected.' },
      decision: { text: 'Ship Friday', sourceLine: 1 },
    });
  });
});

describe('Actions page', () => {
  const listed = (overrides: Partial<ActionItem> = {}) => ({
    ...item(overrides),
    meetingTitle: 'Weekly sync',
    meetingDate: '2026-11-24',
  });

  it('groups items by meeting in a carousel, each linking to its transcript line', async () => {
    mockApi({
      ...me,
      'GET /api/action-items': {
        status: 200,
        body: { actionItems: [listed({ dueDate: '2020-01-01' })], owners: ['Ann'] },
      },
    });
    renderApp('/items');

    expect(await screen.findByText('Send the files')).toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Weekly sync' });
    expect(within(section).getByRole('link', { name: 'Open Weekly sync' })).toHaveAttribute(
      'href',
      `/meetings/${MEETING_ID}`,
    );
    const carousel = within(section).getByRole('region', { name: 'Actions from Weekly sync' });
    expect(
      within(carousel).getByRole('link', { name: 'Line 2 in the transcript' }),
    ).toHaveAttribute('href', `/meetings/${MEETING_ID}#L2`);
    // In the carousel the date chip sits by the Action tag and says "Overdue" itself.
    expect(within(carousel).getByText(/^Overdue · /)).toHaveTextContent('1 Jan 2020');
    expect(screen.getByRole('status')).toHaveTextContent('1 item in 1 meeting · 1 overdue');
  });

  it('removes an item from the Open list as soon as it is ticked off', async () => {
    let status: ActionItem['status'] = 'todo';
    mockApi({
      ...me,
      'GET /api/action-items': () => ({
        status: 200,
        body: {
          actionItems: status === 'done' ? [] : [listed({ status })],
          owners: ['Ann'],
        },
      }),
      [`PATCH /api/action-items/${item().id}`]: () => {
        status = 'done';
        return { status: 200, body: { actionItem: item({ status: 'done' }) } };
      },
    });
    const user = userEvent.setup();
    renderApp('/items');

    await user.click(
      await screen.findByRole('checkbox', { name: 'Mark “Send the files” as done' }),
    );
    await waitFor(() => expect(screen.queryByText('Send the files')).not.toBeInTheDocument());
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
    await user.click(screen.getByRole('button', { name: /^Assigned to/ }));
    await user.click(screen.getByRole('option', { name: 'Ben' }));
    await user.click(screen.getByRole('button', { name: 'Overdue only' }));

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
