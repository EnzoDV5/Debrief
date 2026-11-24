// Meetings in the UI: new meeting, list, detail and analysis states.
import {
  ARCHIVE_WHILE_ANALYSING_MESSAGE,
  EDIT_WHILE_ANALYSING_MESSAGE,
  RENAME_WHILE_ANALYSING_MESSAGE,
  type Meeting,
} from '@debrief/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { todayDate } from '@/lib/format';
import { mockApi, renderApp, testUser } from '@/test/renderApp';

const me = { 'GET /api/auth/me': { status: 200, body: { user: testUser } } };

const meeting = {
  id: '0b6f9c2e-4f6d-4c1a-9d3e-2a7b8c9d0e1f',
  title: 'Weekly sync',
  meetingDate: '2026-11-24',
  sourceType: 'paste' as const,
  analysisStatus: 'pending' as const,
  lineCount: 2,
  createdAt: '2026-11-24T08:00:00.000Z',
  pinnedAt: null,
  archivedAt: null,
  projectId: null,
  updatedAt: '2026-11-24T08:00:00.000Z',
  transcriptLines: [
    { n: 1, speaker: 'Ann', text: 'Hello' },
    { n: 2, speaker: 'Ben', text: 'Hi there' },
  ],
  summary: null,
  analysisError: null,
  decisions: [],
  actionItems: [],
};
const {
  transcriptLines: _l,
  summary: _s,
  analysisError: _e,
  updatedAt: _u,
  decisions: _d,
  actionItems: _a,
  ...listItem
} = meeting;
const detailUrl = `/api/meetings/${meeting.id}`;

describe('workspace history', () => {
  it('keeps previous meetings in the sidebar without repeating a list in the main area', async () => {
    const sprint = {
      ...listItem,
      id: 'e84b8177-ecb1-48b7-aa22-b53b09a637e2',
      title: 'Sprint review',
      analysisStatus: 'done' as const,
    };
    mockApi({
      ...me,
      'GET /api/meetings': { status: 200, body: { meetings: [sprint, listItem] } },
    });
    renderApp('/meetings');

    await screen.findByRole('heading', { name: 'What would you like to debrief?', level: 1 });
    const sidebar = screen.getByRole('complementary');
    expect(await within(sidebar).findByRole('link', { name: 'Sprint review' })).toHaveAttribute(
      'href',
      `/meetings/${sprint.id}`,
    );
    expect(within(sidebar).getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(within(sidebar).queryByRole('link', { name: 'All meetings' })).not.toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'Workspace home' })).toHaveAttribute(
      'href',
      '/meetings',
    );
    expect(
      within(screen.getByRole('main')).queryByRole('link', { name: /Sprint review/ }),
    ).not.toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByLabelText('Transcript file')).toBeInTheDocument();
  });

  it('shows pinned meetings in their own section and counts open actions', async () => {
    const pinned = {
      ...listItem,
      id: 'e84b8177-ecb1-48b7-aa22-b53b09a637e2',
      title: 'Board prep',
      pinnedAt: '2026-11-24T09:00:00.000Z',
    };
    const openItem = (id: string) => ({
      id,
      meetingId: meeting.id,
      text: 'Send the files',
      owner: null,
      dueDate: null,
      dueDateText: null,
      status: 'todo',
      needsReview: false,
      reviewReason: null,
      sourceLine: null,
      sourceQuote: null,
      contextSummary: null,
      decisionId: null,
      inCalendar: false,
      origin: 'manual',
      position: 0,
      editedAt: null,
      meetingTitle: 'Weekly sync',
      meetingDate: '2026-11-24',
    });
    mockApi({
      ...me,
      'GET /api/meetings': { status: 200, body: { meetings: [pinned, listItem] } },
      'GET /api/action-items': {
        status: 200,
        body: {
          actionItems: [openItem(crypto.randomUUID()), openItem(crypto.randomUUID())],
          owners: [],
        },
      },
    });
    renderApp('/meetings');

    const sidebar = await screen.findByRole('complementary');
    const pinnedSection = await within(sidebar).findByRole('region', { name: 'Pinned meetings' });
    expect(within(pinnedSection).getByRole('link', { name: 'Board prep' })).toBeInTheDocument();
    const recentSection = within(sidebar).getByRole('region', { name: 'Meetings' });
    expect(within(recentSection).getByRole('link', { name: 'Weekly sync' })).toBeInTheDocument();
    expect(
      within(recentSection).queryByRole('link', { name: 'Board prep' }),
    ).not.toBeInTheDocument();
    expect(await within(sidebar).findByRole('link', { name: 'Actions, 2 open' })).toHaveAttribute(
      'href',
      '/items',
    );
  });

  it('reorders meetings with Alt + arrow keys, and saves the new order', async () => {
    const second = {
      ...listItem,
      id: 'e84b8177-ecb1-48b7-aa22-b53b09a637e2',
      title: 'Sprint review',
    };
    let saved: unknown;
    mockApi({
      ...me,
      'GET /api/meetings': { status: 200, body: { meetings: [listItem, second] } },
      'PUT /api/meetings/order': (body) => {
        saved = body;
        return { status: 204 };
      },
    });
    const user = userEvent.setup();
    renderApp('/meetings');

    const sidebar = await screen.findByRole('complementary');
    const recent = await within(sidebar).findByRole('region', { name: 'Meetings' });
    within(recent).getByRole('link', { name: 'Weekly sync' }).focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

    await waitFor(() => expect(saved).toEqual({ ids: [second.id, listItem.id] }));
    const titles = within(recent)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(titles).toEqual(['Sprint review', 'Weekly sync']);
    expect(within(recent).getByText('Moved “Weekly sync” to position 2 of 2.')).toBeInTheDocument();
    expect(within(recent).getByRole('link', { name: 'Weekly sync' })).toHaveFocus();
  });

  it('opens the meeting history as a mobile drawer', async () => {
    mockApi({
      ...me,
      'GET /api/meetings': { status: 200, body: { meetings: [listItem] } },
      [`GET ${detailUrl}`]: { status: 200, body: { meeting } },
    });
    const user = userEvent.setup();
    const { router } = renderApp('/meetings');
    await screen.findByRole('heading', { name: 'What would you like to debrief?', level: 1 });

    await user.click(screen.getByRole('button', { name: 'Open sidebar' }));
    const drawer = screen.getByRole('dialog', { name: 'Workspace sidebar' });
    expect(drawer).toHaveAttribute('open');
    await user.click(within(drawer).getByRole('link', { name: 'Weekly sync' }));
    await screen.findByRole('heading', { name: 'Weekly sync', level: 1 });
    expect(router.state.location.pathname).toBe(`/meetings/${meeting.id}`);
    expect(drawer).not.toHaveAttribute('open');
  });

  it('shows a simple start screen and leaves meeting history in the sidebar', async () => {
    mockApi({ ...me, 'GET /api/meetings': { status: 200, body: { meetings: [listItem] } } });
    renderApp('/meetings');

    expect(
      await screen.findByRole('heading', { name: 'What would you like to debrief?', level: 1 }),
    ).toBeInTheDocument();
    const sidebar = screen.getByRole('complementary');
    expect(await within(sidebar).findByRole('link', { name: 'Weekly sync' })).toHaveAttribute(
      'href',
      `/meetings/${meeting.id}`,
    );
    expect(within(screen.getByRole('main')).queryByText('Weekly sync')).not.toBeInTheDocument();
  });

  it('shows an error with retry in the sidebar when history fails to load', async () => {
    mockApi({ ...me, 'GET /api/meetings': { status: 500, body: {} } });
    renderApp('/meetings');

    const sidebar = await screen.findByRole('complementary');
    expect(await within(sidebar).findByText("Couldn't load meeting history.")).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('new meeting: drop, review, then analyse', () => {
  const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Ann>Hello</v>\n';
  const posts = (fetchMock: ReturnType<typeof mockApi>) =>
    fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');

  it('reads a dropped file, shows it for checking, and only saves on confirm', async () => {
    let posted: unknown;
    const fetchMock = mockApi({
      ...me,
      'POST /api/meetings': (body) => {
        posted = body;
        return { status: 201, body: { meeting } };
      },
    });
    const user = userEvent.setup();
    const { router } = renderApp('/meetings');

    await user.upload(
      await screen.findByLabelText('Transcript file'),
      new File([vtt], 'q1-planning_call.vtt', { type: 'text/vtt' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Check your transcript' }),
    ).toBeInTheDocument();
    expect(screen.getByText('q1-planning_call.vtt')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 line · 1 speaker');
    expect(screen.getByLabelText('Title')).toHaveValue('Q1 planning call');
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Save & analyse' }));
    await screen.findByRole('heading', { name: 'Weekly sync', level: 1 });

    expect(router.state.location.pathname).toBe(`/meetings/${meeting.id}`);
    expect(posted).toBeInstanceOf(FormData);
    expect((posted as FormData).get('title')).toBe('Q1 planning call');
    expect(((posted as FormData).get('file') as File).name).toBe('q1-planning_call.vtt');
  });

  it('accepts pasted text through the same review step', async () => {
    let posted: unknown;
    mockApi({
      ...me,
      'POST /api/meetings': (body) => {
        posted = body;
        return { status: 201, body: { meeting } };
      },
    });
    const user = userEvent.setup();
    renderApp('/meetings');

    await user.click(await screen.findByRole('button', { name: 'Paste text instead' }));
    // The paste box appears once the drop box has animated out.
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeDisabled();
    await user.click(screen.getByLabelText('Transcript text'));
    await user.paste('Ann: Hello\nBen: Hi there');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('status')).toHaveTextContent('2 lines · 2 speakers');
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Weekly sync');
    await user.click(screen.getByRole('button', { name: 'Save & analyse' }));

    await screen.findByRole('heading', { name: 'Weekly sync', level: 1 });
    expect(posted).toEqual({
      title: 'Weekly sync',
      meetingDate: todayDate(),
      transcript: 'Ann: Hello\nBen: Hi there',
    });
  });

  it('checks the details on the review step and sends nothing until they are valid', async () => {
    const fetchMock = mockApi(me);
    const user = userEvent.setup();
    renderApp('/meetings');

    await user.click(await screen.findByRole('button', { name: 'Paste text instead' }));
    await user.click(await screen.findByLabelText('Transcript text'));
    await user.paste('Ann: Hello');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.clear(await screen.findByLabelText('Title'));
    await user.click(screen.getByRole('button', { name: 'Save & analyse' }));

    expect(await screen.findByText('Give the meeting a title')).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it('rejects a file type the app does not accept, without leaving the drop zone', async () => {
    mockApi(me);
    const user = userEvent.setup({ applyAccept: false });
    renderApp('/meetings');

    const input = await screen.findByLabelText('Transcript file');
    await user.upload(input, new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Upload a .txt, .vtt or .md file');
    expect(screen.getByLabelText('Transcript file')).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.queryByRole('heading', { name: 'Check your transcript' }),
    ).not.toBeInTheDocument();
  });

  it('goes back to the drop zone to pick a different file', async () => {
    mockApi(me);
    const user = userEvent.setup();
    renderApp('/meetings');

    await user.upload(
      await screen.findByLabelText('Transcript file'),
      new File(['Ann: hi'], 'wrong.txt', { type: 'text/plain' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Choose a different transcript' }));

    expect(
      await screen.findByRole('heading', { name: 'What would you like to debrief?' }),
    ).toBeInTheDocument();
  });
});

describe('analysis in the background', () => {
  it('keeps working while you move around, then notifies you and marks the meeting new', async () => {
    let calls = 0;
    let itemFetches = 0;
    mockApi({
      ...me,
      'GET /api/action-items': () => {
        itemFetches += 1;
        return { status: 200, body: { actionItems: [], owners: [] } };
      },
      'GET /api/meetings': () => {
        calls += 1;
        const analysisStatus = calls === 1 ? 'processing' : 'done';
        return { status: 200, body: { meetings: [{ ...listItem, analysisStatus }] } };
      },
      [`GET ${detailUrl}`]: {
        status: 200,
        body: { meeting: { ...meeting, analysisStatus: 'done' } },
      },
    });
    const user = userEvent.setup();
    renderApp('/items');

    const sidebar = await screen.findByRole('complementary');
    const link = await within(sidebar).findByRole('link', { name: 'Weekly sync' });
    expect(link).toHaveAccessibleDescription('Analysing');

    const fetchesBefore = itemFetches;
    expect(await screen.findByText('Analysis finished', {}, { timeout: 5000 })).toBeInTheDocument();
    // The new action items are fetched straight away (Actions page and its badge).
    await waitFor(() => expect(itemFetches).toBeGreaterThan(fetchesBefore));
    expect(within(sidebar).getByRole('link', { name: 'Weekly sync' })).toHaveAccessibleDescription(
      'New results',
    );

    await user.click(screen.getByRole('link', { name: 'Open meeting' }));
    await waitFor(() =>
      expect(within(sidebar).getByRole('link', { name: 'Weekly sync' })).not.toHaveAttribute(
        'aria-describedby',
      ),
    );
  }, 10_000);
});

describe('while you are on the meeting that finishes', () => {
  it('shows the result there, without a notification', async () => {
    let calls = 0;
    mockApi({
      ...me,
      'GET /api/meetings': {
        status: 200,
        body: { meetings: [{ ...listItem, analysisStatus: 'processing' }] },
      },
      [`GET ${detailUrl}`]: () => {
        calls += 1;
        const analysisStatus = calls === 1 ? 'processing' : 'done';
        return { status: 200, body: { meeting: { ...meeting, analysisStatus, summary: 'Done.' } } };
      },
    });
    renderApp(`/meetings/${meeting.id}`);

    expect(await screen.findByText('Analysed', {}, { timeout: 5000 })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByText('Analysis finished')).not.toBeInTheDocument();
  }, 10_000);
});

describe('your account', () => {
  it('changes your name right where it is shown', async () => {
    let sent: unknown;
    mockApi({
      ...me,
      'PATCH /api/auth/me': (body) => {
        sent = body;
        return { status: 200, body: { user: { ...testUser, name: 'Alice Dlamini' } } };
      },
    });
    const user = userEvent.setup();
    renderApp('/account');

    await user.click(await screen.findByRole('button', { name: new RegExp(testUser.name) }));
    const input = screen.getByRole('textbox', { name: 'Your name' });
    await user.clear(input);
    await user.type(input, 'Alice Dlamini{Enter}');

    await waitFor(() => expect(sent).toEqual({ name: 'Alice Dlamini' }));
    expect(await screen.findByRole('button', { name: /Alice Dlamini/ })).toBeInTheDocument();
    expect(
      within(screen.getByRole('complementary')).getByText('Alice Dlamini'),
    ).toBeInTheDocument();
  });
});

describe('a failed analysis', () => {
  it('is marked in the sidebar, and Summary and Ask are disabled with a reason', async () => {
    const failed = {
      ...meeting,
      analysisStatus: 'failed' as const,
      analysisError: 'Today’s free AI quota has been used up.',
    };
    mockApi({
      ...me,
      'GET /api/meetings': {
        status: 200,
        body: { meetings: [{ ...listItem, analysisStatus: 'failed' }] },
      },
      [`GET ${detailUrl}`]: { status: 200, body: { meeting: failed } },
    });
    renderApp(`/meetings/${meeting.id}`);

    const sidebar = await screen.findByRole('complementary');
    expect(
      await within(sidebar).findByRole('link', { name: 'Weekly sync' }),
    ).toHaveAccessibleDescription('Analysis failed');
    expect(await screen.findByRole('button', { name: 'Summary' })).toBeDisabled();
    const ask = screen.getByRole('textbox', { name: 'Ask a question about this meeting' });
    expect(ask).toBeDisabled();
    expect(ask).toHaveAccessibleDescription(
      'Retry the analysis first, then you can ask about this meeting.',
    );
    expect(screen.getByRole('button', { name: 'Retry analysis' })).toBeInTheDocument();
  });
});

describe('search and archive in the sidebar', () => {
  const searchResults = {
    meetings: [listItem],
    actionItems: [
      {
        id: crypto.randomUUID(),
        text: 'Send the invoice',
        owner: 'Ben',
        meetingId: meeting.id,
        meetingTitle: 'Weekly sync',
        sourceLine: 2,
      },
    ],
    decisions: [
      {
        id: crypto.randomUUID(),
        text: 'Keep the budget',
        meetingId: meeting.id,
        meetingTitle: 'Weekly sync',
        sourceLine: 1,
      },
    ],
  };

  it('opens search from the sidebar, finds actions and decisions, and opens the line', async () => {
    const searched: string[] = [];
    mockApi({
      ...me,
      'GET /api/search': (_body, url) => {
        searched.push(url);
        return { status: 200, body: searchResults };
      },
      [`GET ${detailUrl}`]: { status: 200, body: { meeting } },
    });
    const user = userEvent.setup();
    const { router } = renderApp('/meetings');

    const sidebar = await screen.findByRole('complementary');
    await user.click(within(sidebar).getByRole('button', { name: 'Search' }));
    const dialog = screen.getByRole('dialog', { name: 'Search' });
    await user.type(
      within(dialog).getByRole('combobox', { name: 'Search meetings, actions and decisions' }),
      'invoice',
    );

    expect(
      await within(dialog).findByRole('option', { name: /Keep the budget/ }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: /Send the invoice/ })).toBeInTheDocument();
    expect(await within(dialog).findByText('Decisions', { selector: 'p' })).toBeInTheDocument();
    expect(searched.at(-1)).toContain('q=invoice');

    await user.click(within(dialog).getByRole('button', { name: /^Show/ }));
    await user.click(within(dialog).getByRole('option', { name: 'Decisions' }));
    expect(
      within(dialog).queryByRole('option', { name: /Send the invoice/ }),
    ).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('option', { name: /Keep the budget/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/meetings/${meeting.id}`));
    expect(router.state.location.hash).toBe('#L1');
  });

  it('loads the chosen kind straight away, before anything is typed', async () => {
    const searched: string[] = [];
    mockApi({
      ...me,
      'GET /api/search': (_body, url) => {
        searched.push(url);
        return { status: 200, body: searchResults };
      },
    });
    const user = userEvent.setup();
    renderApp('/meetings');

    const sidebar = await screen.findByRole('complementary');
    await user.click(within(sidebar).getByRole('button', { name: 'Search' }));
    const dialog = screen.getByRole('dialog', { name: 'Search' });
    await user.click(within(dialog).getByRole('button', { name: /^Show/ }));
    await user.click(within(dialog).getByRole('option', { name: 'Action items' }));

    expect(
      await within(dialog).findByRole('option', { name: /Send the invoice/ }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Recent action items')).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('option', { name: /Keep the budget/ }),
    ).not.toBeInTheDocument();
    expect(searched[0]).toBe('/api/search');
  });

  it('opens search with Ctrl+K and closes it with the cross', async () => {
    mockApi(me);
    const user = userEvent.setup();
    renderApp('/meetings');
    await screen.findByRole('complementary');

    await user.keyboard('{Control>}k{/Control}');
    const dialog = screen.getByRole('dialog', { name: 'Search' });
    expect(dialog).toHaveAttribute('open');
    await user.click(within(dialog).getByRole('button', { name: 'Close search' }));
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
  });

  it('clears the Meetings list from the account page after a confirm step', async () => {
    const pinned = {
      ...listItem,
      id: 'e84b8177-ecb1-48b7-aa22-b53b09a637e2',
      title: 'Board prep',
      pinnedAt: '2026-11-24T09:00:00.000Z',
    };
    const done = { ...listItem, analysisStatus: 'done' as const };
    const running = {
      ...listItem,
      id: 'a1f2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      title: 'Still running',
      analysisStatus: 'processing' as const,
    };
    let archived = false;
    mockApi({
      ...me,
      'GET /api/meetings': () => ({
        status: 200,
        body: { meetings: archived ? [pinned, running] : [pinned, done, running] },
      }),
      'POST /api/meetings/archive-all': () => {
        archived = true;
        return { status: 200, body: { archived: 1 } };
      },
    });
    const user = userEvent.setup();
    renderApp('/account');

    await user.click(await screen.findByRole('button', { name: 'Clear list' }));
    // The meeting still being analysed isn't counted: the server skips it too.
    const question = screen.getByText(/Move 1 meeting to Archived?/);
    expect(question).toHaveTextContent('1 pinned meeting will stay.');
    expect(question).toHaveTextContent('1 meeting still being analysed will stay.');
    expect(archived).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Yes, archive 1 meeting' }));
    expect(await screen.findByText('1 meeting moved to Archived.')).toBeInTheDocument();
    expect(archived).toBe(true);
  });

  it('shows archived meetings in a dropdown instead of a page', async () => {
    const archived = {
      ...listItem,
      id: crypto.randomUUID(),
      title: 'Old retro',
      archivedAt: '2026-11-20T08:00:00.000Z',
    };
    mockApi({
      ...me,
      'GET /api/meetings?archived=true': { status: 200, body: { meetings: [archived] } },
    });
    const user = userEvent.setup();
    renderApp('/meetings');

    const sidebar = await screen.findByRole('complementary');
    const toggle = within(sidebar).getByRole('button', { name: /Archived/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(await within(sidebar).findByRole('link', { name: 'Old retro' })).toHaveAttribute(
      'href',
      `/meetings/${archived.id}`,
    );
  });
});

describe('meeting detail', () => {
  it('answers meeting questions with source links and handles missing answers', async () => {
    const asked: string[] = [];
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: { status: 200, body: { meeting } },
      [`POST ${detailUrl}/ask`]: (body) => {
        const question = (body as { question: string }).question;
        asked.push(question);
        return question === 'What decisions were made?'
          ? {
              status: 200,
              body: { answer: 'Ben agreed to send the files.', citations: [2] },
            }
          : { status: 200, body: { answer: null, citations: [] } };
      },
    });
    const user = userEvent.setup();
    const { router } = renderApp(`/meetings/${meeting.id}`);

    await screen.findByRole('region', { name: 'Ask this meeting' });
    await user.click(screen.getByRole('button', { name: 'What decisions were made?' }));
    const input = screen.getByRole('textbox', { name: 'Ask a question about this meeting' });
    expect(input).toHaveValue('What decisions were made?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Ben agreed to send the files.')).toBeInTheDocument();
    expect(asked).toEqual(['What decisions were made?']);
    await user.click(
      within(screen.getByRole('region', { name: 'Ask this meeting' })).getByRole('link', {
        name: 'Line 2',
      }),
    );
    expect(router.state.location.hash).toBe('#L2');

    await user.type(input, 'Who owns the budget?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(
      await screen.findByText('I couldn’t find an answer supported by this transcript.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'What decisions were made?' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(asked).toEqual(['What decisions were made?', 'Who owns the budget?']);
  });

  it('keeps the question and shows a retryable error when the AI is busy', async () => {
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: { status: 200, body: { meeting } },
      [`POST ${detailUrl}/ask`]: {
        status: 429,
        body: { error: { code: 'AI_BUSY', message: 'The AI is busy. Try again in a minute.' } },
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);
    await screen.findByRole('region', { name: 'Ask this meeting' });
    const input = screen.getByRole('textbox', { name: 'Ask a question about this meeting' });
    await user.type(input, 'What is blocking progress?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(await screen.findByText('The AI is busy. Try again in a minute.')).toBeInTheDocument();
    expect(input).toHaveValue('What is blocking progress?');
    expect(screen.getByRole('button', { name: 'Ask' })).toBeEnabled();
  });

  it('marks edited cards and keeps the transcript as it was said', async () => {
    const said = 'Okay, we will use Resend for the contact form.';
    const analysed = {
      ...meeting,
      analysisStatus: 'done' as const,
      summary: 'The team chose Resend.',
      lineCount: 2,
      transcriptLines: [
        { n: 1, speaker: 'Sarah', text: said },
        { n: 2, speaker: 'Tom', text: 'I will set up Resend by Friday.' },
      ],
      decisions: [
        {
          id: crypto.randomUUID(),
          text: 'Use Resend for all transactional email',
          sourceLine: 1,
          position: 0,
          editedAt: '2026-11-20T09:00:00.000Z',
        },
      ],
      actionItems: [
        {
          id: crypto.randomUUID(),
          meetingId: meeting.id,
          text: 'Set up Resend and the DNS records',
          owner: 'Tom',
          dueDate: null,
          dueDateText: null,
          status: 'todo',
          needsReview: false,
          reviewReason: null,
          sourceLine: 2,
          sourceQuote: 'I will set up Resend',
          contextSummary: null,
          decisionId: null,
          inCalendar: false,
          origin: 'ai',
          position: 0,
          editedAt: '2026-11-20T09:05:00.000Z',
        },
      ],
    };
    mockApi({ ...me, [`GET ${detailUrl}`]: { status: 200, body: { meeting: analysed } } });
    renderApp(`/meetings/${meeting.id}`);

    expect(await screen.findByText('The team chose Resend.')).toBeInTheDocument();
    const decisionLine = document.getElementById('L1')!;
    expect(
      within(decisionLine).getByText('Use Resend for all transactional email'),
    ).toBeInTheDocument();
    expect(within(decisionLine).getByText('Edited by you')).toBeInTheDocument();
    expect(within(document.getElementById('L2')!).getByText('Edited by you')).toBeInTheDocument();

    const decisionMark = within(decisionLine).getByText(said);
    expect(decisionMark).toHaveAttribute('data-edited', 'true');
    expect(decisionMark).toHaveClass('decoration-dashed');
    expect(
      within(document.getElementById('L2')!).getByText('I will set up Resend'),
    ).toHaveAttribute('data-edited', 'true');
  });

  it('says clearly when the AI found no action items or decisions, with the summary', async () => {
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: {
        status: 200,
        body: { meeting: { ...meeting, analysisStatus: 'done', summary: 'A quick catch-up.' } },
      },
    });
    renderApp(`/meetings/${meeting.id}`);

    const card = (await screen.findByText('Nothing to action')).closest('[role="status"]');
    expect(card).toHaveTextContent('No action items or decisions were found in this meeting.');
    expect(card).toHaveTextContent('A quick catch-up.');

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('Nothing to action')).not.toBeInTheDocument());
  });

  it('notes a missing kind when only decisions were found', async () => {
    const decision = { id: crypto.randomUUID(), text: 'Use blue', sourceLine: 1, position: 0 };
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: {
        status: 200,
        body: {
          meeting: {
            ...meeting,
            analysisStatus: 'done',
            summary: 'The team chose blue.',
            decisions: [{ ...decision, editedAt: null }],
          },
        },
      },
    });
    renderApp(`/meetings/${meeting.id}`);

    expect(await screen.findByText('No action items in this meeting')).toBeInTheDocument();
    expect(screen.queryByText('Nothing to action')).not.toBeInTheDocument();
  });

  it('shows no "nothing found" message while the analysis is still running', async () => {
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: {
        status: 200,
        body: { meeting: { ...meeting, analysisStatus: 'processing' } },
      },
    });
    renderApp(`/meetings/${meeting.id}`);

    expect(await screen.findByRole('status', { name: 'AI is finding notes' })).toBeInTheDocument();
    expect(screen.queryByText('Nothing to action')).not.toBeInTheDocument();
  });

  it('highlights the card you jumped to from Actions or search, and its transcript words', async () => {
    const decisionId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const analysed = {
      ...meeting,
      analysisStatus: 'done' as const,
      summary: 'The team chose blue.',
      transcriptLines: [
        { n: 1, speaker: 'Ann', text: 'We chose blue for the design.' },
        { n: 2, speaker: 'Ben', text: 'Can you send the files to the team?' },
      ],
      decisions: [{ id: decisionId, text: 'Use blue', sourceLine: 1, position: 0, editedAt: null }],
      actionItems: [
        {
          id: itemId,
          meetingId: meeting.id,
          text: 'Send the files',
          owner: 'Ann',
          dueDate: null,
          dueDateText: null,
          status: 'todo',
          needsReview: false,
          reviewReason: null,
          sourceLine: 2,
          sourceQuote: 'send the files',
          contextSummary: null,
          decisionId: null,
          inCalendar: false,
          origin: 'ai',
          position: 0,
          editedAt: null,
        },
      ],
    };
    mockApi({ ...me, [`GET ${detailUrl}`]: { status: 200, body: { meeting: analysed } } });
    // What clicking the card on the Actions page does: the line in the URL, the card in state.
    renderApp({
      pathname: `/meetings/${meeting.id}`,
      hash: '#L2',
      state: { highlight: itemId },
    });

    const card = (await screen.findByText('Send the files')).closest('article')!;
    expect(card).toHaveAttribute('data-active');
    expect(within(document.getElementById('L2')!).getByText('send the files')).toHaveAttribute(
      'data-active',
    );
    // Only that card: the decision on line 1 stays as it was.
    expect(screen.getByText('Use blue').closest('article')).not.toHaveAttribute('data-active');
  });

  it('shows analysis results, review flags, and transcript links', async () => {
    const analysed = {
      ...meeting,
      analysisStatus: 'done' as const,
      summary: 'The team chose blue.',
      lineCount: 3,
      transcriptLines: [
        { n: 1, speaker: 'Ann', text: 'We chose blue for the design.' },
        { n: 2, speaker: 'Ben', text: 'The draft is ready. Can you send the files to the team?' },
        { n: 3, speaker: 'Ann', text: 'Thanks everyone.' },
      ],
      decisions: [
        { id: crypto.randomUUID(), text: 'Use blue', sourceLine: 1, position: 0, editedAt: null },
      ],
      actionItems: [
        {
          id: crypto.randomUUID(),
          meetingId: meeting.id,
          text: 'Send the files',
          owner: 'Ann',
          dueDate: null,
          dueDateText: 'soon',
          status: 'todo',
          needsReview: true,
          reviewReason: 'Check the due date',
          sourceLine: 2,
          sourceQuote: 'send the files',
          contextSummary: 'Ben wants the ready draft circulated to the team.',
          decisionId: null,
          inCalendar: false,
          origin: 'ai',
          position: 0,
          editedAt: null,
        },
      ],
    };
    mockApi({ ...me, [`GET ${detailUrl}`]: { status: 200, body: { meeting: analysed } } });
    renderApp(`/meetings/${meeting.id}`);

    expect(await screen.findByText('The team chose blue.')).toBeInTheDocument();
    const decisionLine = document.getElementById('L1')!;
    expect(within(decisionLine).getByText('Use blue')).toBeInTheDocument();
    expect(within(decisionLine).getByText('Decision')).toBeInTheDocument();
    expect(screen.queryByText('Edited by you')).not.toBeInTheDocument();
    expect(document.querySelector('mark[data-edited]')).toBeNull();
    expect(screen.getAllByText('Use blue')).toHaveLength(1);
    const user = userEvent.setup();
    await user.hover(within(decisionLine).getByText('Use blue'));
    expect(within(decisionLine).getByText('We chose blue for the design.')).toHaveClass('ring-2');
    await user.unhover(within(decisionLine).getByText('Use blue'));
    expect(screen.getByText('Send the files')).toBeInTheDocument();
    const sourceLine = document.getElementById('L2')!;
    expect(within(sourceLine).getByText('In brief:')).toBeInTheDocument();
    expect(within(sourceLine).getByText('Send the files')).toBeInTheDocument();
    expect(
      within(sourceLine).getByText('Ben wants the ready draft circulated to the team.'),
    ).toBeInTheDocument();
    expect(within(sourceLine).queryByText(/What was said:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Check the due date/)).toHaveTextContent('Needs review:');
    await user.click(within(sourceLine).getByRole('link', { name: 'Line 2' }));
    expect(screen.getByRole('heading', { name: 'Transcript' })).toBeInTheDocument();

    const map = screen.getByRole('navigation', { name: 'Transcript map' });
    expect(
      await within(map).findByRole('button', { name: 'Line 1: decision: Use blue' }),
    ).toBeInTheDocument();
    const original = Element.prototype.scrollIntoView;
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    try {
      await userEvent.click(
        within(map).getByRole('button', { name: 'Line 2: action item: Send the files' }),
      );
      expect(scrolled.at(-1)?.id).toBe('L2');
      await userEvent.click(within(map).getByRole('button', { name: 'Jump to line 3' }));
      expect(scrolled.at(-1)?.id).toBe('L3');
    } finally {
      Element.prototype.scrollIntoView = original;
    }
    expect(screen.getByRole('link', { name: 'Line 2' })).toBeInTheDocument();
    expect(document.getElementById('L2')).toBeInTheDocument();
  });

  it('paraphrases an older action beside its source without repeating the transcript', async () => {
    const analysed = {
      ...meeting,
      analysisStatus: 'done' as const,
      transcriptLines: [
        { n: 1, speaker: 'Sarah', text: 'Where are we with the homepage design?' },
        {
          n: 2,
          speaker: 'Lerato',
          text: "The homepage is done. I'm finishing the pricing page now and I'll have it ready for review by Wednesday the 18th.",
        },
      ],
      actionItems: [
        {
          id: crypto.randomUUID(),
          meetingId: meeting.id,
          text: 'Finish pricing page for review',
          owner: 'Lerato',
          dueDate: null,
          dueDateText: 'by Wednesday the 18th',
          status: 'todo',
          needsReview: false,
          reviewReason: null,
          sourceLine: 2,
          sourceQuote: "I'm finishing the pricing page now",
          decisionId: null,
          inCalendar: false,
          origin: 'ai',
          position: 0,
          editedAt: null,
        },
      ],
    };
    mockApi({ ...me, [`GET ${detailUrl}`]: { status: 200, body: { meeting: analysed } } });
    renderApp(`/meetings/${meeting.id}`);

    await screen.findByRole('heading', { name: 'Weekly sync', level: 1 });
    const sourceLine = document.getElementById('L2')!;
    expect(
      await within(sourceLine).findByText(
        /With the homepage complete, Lerato plans to finish the pricing page for review\./,
      ),
    ).toBeInTheDocument();
    expect(within(sourceLine).queryByText(/What was said:/)).not.toBeInTheDocument();
  });

  it('opens the summary from the meeting bar and closes it with Escape', async () => {
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: {
        status: 200,
        body: { meeting: { ...meeting, analysisStatus: 'done', summary: 'The team chose blue.' } },
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);

    const toggle = await screen.findByRole('button', { name: 'Summary' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Meeting summary' })).toHaveTextContent(
      'The team chose blue.',
    );

    await user.click(screen.getByRole('button', { name: 'Edit summary' }));
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('fixes a transcript line in place and marks it as edited', async () => {
    const withText = {
      ...meeting,
      analysisStatus: 'done' as const,
      transcriptLines: [
        { n: 1, speaker: 'Ann', text: 'Hello all.' },
        { n: 2, speaker: 'Ben', text: 'I will send the deck to Lorato.' },
      ],
    };
    let sent: unknown;
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: { status: 200, body: { meeting: withText } },
      [`PATCH ${detailUrl}/lines/2`]: (body) => {
        sent = body;
        const fixed = {
          n: 2,
          speaker: 'Ben',
          text: 'I will send the deck to Lerato.',
          edited: true,
        };
        return {
          status: 200,
          body: { meeting: { ...withText, transcriptLines: [withText.transcriptLines[0], fixed] } },
        };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);

    const line = (await screen.findByText('I will send the deck to Lorato.')).closest(
      '[data-line-text]',
    );
    (line as HTMLElement).focus();
    await user.keyboard('{Enter}');
    const toolbar = screen.getByRole('toolbar', { name: 'Create from the transcript' });
    await user.click(within(toolbar).getByRole('button', { name: 'Edit line' }));

    const box = screen.getByRole('textbox', { name: 'Edit line 2' });
    await user.clear(box);
    await user.type(box, 'I will send the deck to Lerato.{Enter}');

    await waitFor(() => expect(sent).toEqual({ text: 'I will send the deck to Lerato.' }));
    expect(await screen.findByText('I will send the deck to Lerato.')).toBeInTheDocument();
    expect(screen.getByText('Edited')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Edit line 2' })).not.toBeInTheDocument();
  });

  it('lets you say who spoke a line that has no speaker', async () => {
    const withText = {
      ...meeting,
      analysisStatus: 'done' as const,
      transcriptLines: [
        { n: 1, speaker: 'Ann', text: 'Hello all.' },
        { n: 2, text: 'I will send the deck on Friday.' },
      ],
    };
    let sent: unknown;
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: { status: 200, body: { meeting: withText } },
      [`PATCH ${detailUrl}/lines/2`]: (body) => {
        sent = body;
        const fixed = { ...withText.transcriptLines[1], speaker: 'Ben', speakerEdited: true };
        return {
          status: 200,
          body: { meeting: { ...withText, transcriptLines: [withText.transcriptLines[0], fixed] } },
        };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);

    const line = (await screen.findByText('I will send the deck on Friday.')).closest(
      '[data-line-text]',
    );
    (line as HTMLElement).focus();
    await user.keyboard('{Enter}');
    const toolbar = screen.getByRole('toolbar', { name: 'Create from the transcript' });
    await user.click(within(toolbar).getByRole('button', { name: 'Who said this?' }));

    const name = screen.getByRole('combobox', { name: 'Who said line 2?' });
    await user.type(name, 'Ben{Enter}');

    await waitFor(() => expect(sent).toEqual({ speaker: 'Ben' }));
    expect(await screen.findByText('Speaker set by you: Ben')).toBeInTheDocument();
    expect(screen.getByText('Ben', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Who said line 2?' })).not.toBeInTheDocument();
  });

  it('sets a speaker by clicking one of the people already in the meeting', async () => {
    const withText = {
      ...meeting,
      analysisStatus: 'done' as const,
      transcriptLines: [
        { n: 1, speaker: 'Ann', text: 'Hello all.' },
        { n: 2, text: 'I will send the deck on Friday.' },
      ],
    };
    let sent: unknown;
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: { status: 200, body: { meeting: withText } },
      [`PATCH ${detailUrl}/lines/2`]: (body) => {
        sent = body;
        const fixed = { ...withText.transcriptLines[1], speaker: 'Ann', speakerEdited: true };
        return {
          status: 200,
          body: { meeting: { ...withText, transcriptLines: [withText.transcriptLines[0], fixed] } },
        };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);

    const line = (await screen.findByText('I will send the deck on Friday.')).closest(
      '[data-line-text]',
    );
    (line as HTMLElement).focus();
    await user.keyboard('{Enter}');
    const toolbar = screen.getByRole('toolbar', { name: 'Create from the transcript' });
    await user.click(within(toolbar).getByRole('button', { name: 'Who said this?' }));

    await user.click(screen.getByRole('button', { name: 'Show people in this meeting' }));
    const people = screen.getByRole('listbox', { name: 'People in this meeting' });
    await user.click(within(people).getByRole('option', { name: 'Ann' }));
    expect(screen.getByRole('combobox', { name: 'Who said line 2?' })).toHaveValue('Ann');
    await user.click(screen.getByRole('button', { name: 'Save speaker' }));

    await waitFor(() => expect(sent).toEqual({ speaker: 'Ann' }));
  });

  it('makes an action item from a line with the keyboard (Enter on the line)', async () => {
    const withText = {
      ...meeting,
      analysisStatus: 'done' as const,
      transcriptLines: [
        { n: 1, speaker: 'Ann', text: 'Hello all.' },
        { n: 2, speaker: 'Ben', text: 'I will send the deck to Lerato.' },
      ],
    };
    let sent: unknown;
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: { status: 200, body: { meeting: withText } },
      [`POST ${detailUrl}/action-items`]: (body) => {
        sent = body;
        return {
          status: 201,
          body: {
            actionItem: {
              id: crypto.randomUUID(),
              meetingId: meeting.id,
              text: 'Send the deck to Lerato',
              owner: null,
              dueDate: null,
              dueDateText: null,
              status: 'todo',
              needsReview: false,
              reviewReason: null,
              sourceLine: 2,
              sourceQuote: 'I will send the deck to Lerato.',
              contextSummary: null,
              decisionId: null,
              inCalendar: false,
              origin: 'manual',
              position: 0,
              editedAt: null,
            },
          },
        };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);

    const line = (await screen.findByText('I will send the deck to Lerato.')).closest(
      '[data-line-text]',
    );
    (line as HTMLElement).focus();
    await user.keyboard('{Enter}');
    const toolbar = screen.getByRole('toolbar', { name: 'Create from the transcript' });
    expect(within(toolbar).getByRole('button', { name: 'Action item' })).toHaveFocus();
    await user.keyboard('{Enter}');

    const dialog = screen.getByRole('dialog', { name: 'Add an action item' });
    expect(within(dialog).getByRole('figure', { name: /Ben.*Line 2/ })).toBeInTheDocument();
    const task = within(dialog).getByRole('textbox', { name: 'What needs to be done' });
    expect(task).toHaveValue('I will send the deck to Lerato.');
    await user.clear(task);
    await user.type(task, 'Send the deck to Lerato');
    await user.click(within(dialog).getByRole('button', { name: 'Add item' }));

    await waitFor(() =>
      expect(sent).toMatchObject({
        text: 'Send the deck to Lerato',
        sourceLine: 2,
        sourceQuote: 'I will send the deck to Lerato.',
      }),
    );
  });

  it('while the analysis runs, shows the transcript buttons but blocks them, saying why', async () => {
    // A re-analysis: the earlier results stay on screen while the AI reads the transcript again.
    const running = {
      ...meeting,
      analysisStatus: 'processing' as const,
      summary: 'The team agreed to ship on Friday.',
      transcriptLines: [
        { n: 1, speaker: 'Ann', text: 'We ship on Friday.' },
        { n: 2, speaker: 'Ben', text: 'I will send the deck to Lerato.' },
      ],
      decisions: [
        {
          id: crypto.randomUUID(),
          text: 'Ship on Friday',
          sourceLine: 1,
          position: 0,
          editedAt: null,
        },
      ],
    };
    mockApi({ ...me, [`GET ${detailUrl}`]: { status: 200, body: { meeting: running } } });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);

    const line = (await screen.findByText('I will send the deck to Lerato.')).closest(
      '[data-line-text]',
    );
    (line as HTMLElement).focus();
    await user.keyboard('{Enter}');

    const toolbar = screen.getByRole('toolbar', { name: 'Create from the transcript' });
    expect(toolbar).toHaveAccessibleDescription(EDIT_WHILE_ANALYSING_MESSAGE);
    for (const name of ['Action item', 'Decision', 'Change speaker', 'Edit line']) {
      expect(within(toolbar).getByRole('button', { name })).toBeDisabled();
    }
    // Nothing opens, and Escape still closes the toolbar.
    await user.click(within(toolbar).getByRole('button', { name: 'Action item' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Add a task for “Ship on Friday”' })).toBeDisabled();
  });

  it('adds to a project, archives and offers delete from the meeting bar', async () => {
    const projectId = '5d1c6b8e-2f3a-4c5d-8e9f-0a1b2c3d4e5f';
    let current: Meeting = { ...meeting, analysisStatus: 'done' };
    const patches: unknown[] = [];
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: () => ({ status: 200, body: { meeting: current } }),
      'GET /api/projects': {
        status: 200,
        body: {
          projects: [
            {
              id: projectId,
              name: 'Launch',
              createdAt: '2026-11-01T08:00:00.000Z',
              meetingCount: 0,
            },
          ],
        },
      },
      [`PATCH ${detailUrl}`]: (body) => {
        patches.push(body);
        const patch = body as { projectId?: string | null; archived?: boolean };
        current = {
          ...current,
          ...('projectId' in patch ? { projectId: patch.projectId ?? null } : {}),
          ...('archived' in patch
            ? { archivedAt: patch.archived ? '2026-11-20T10:00:00.000Z' : null }
            : {}),
        };
        return { status: 200, body: { meeting: current } };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);

    await user.click(await screen.findByText('Add to project'));
    await user.click(await screen.findByRole('button', { name: 'Launch' }));
    expect(await screen.findByText('Launch', { selector: 'summary span' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument();
    expect(patches).toEqual([{ projectId }, { archived: true }]);

    await user.click(screen.getByRole('button', { name: 'Delete meeting' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(meeting.title);
  });

  it('blocks archiving and renaming while the analysis runs', async () => {
    const running = { ...meeting, analysisStatus: 'processing' as const };
    const patches: unknown[] = [];
    mockApi({
      ...me,
      'GET /api/meetings': { status: 200, body: { meetings: [{ ...listItem, ...running }] } },
      [`GET ${detailUrl}`]: { status: 200, body: { meeting: running } },
      [`PATCH ${detailUrl}`]: (body) => {
        patches.push(body);
        return { status: 200, body: { meeting: running } };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);

    const barButton = await screen.findByRole('button', { name: 'Archive' });
    expect(barButton).toBeDisabled();
    expect(barButton).toHaveAttribute('title', ARCHIVE_WHILE_ANALYSING_MESSAGE);

    const sidebar = await screen.findByRole('complementary');
    await user.click(
      await within(sidebar).findByRole('button', { name: `More options for ${meeting.title}` }),
    );
    const menu = screen.getByRole('group', { name: `Options for ${meeting.title}` });
    expect(within(menu).getByRole('button', { name: 'Archive' })).toBeDisabled();
    const rename = within(menu).getByRole('button', { name: 'Rename' });
    expect(rename).toBeDisabled();
    expect(rename).toHaveAttribute('title', RENAME_WHILE_ANALYSING_MESSAGE);
    expect(patches).toEqual([]);
  });

  it('confirms a re-analysis and keeps existing results visible while it runs', async () => {
    let current: Meeting = { ...meeting, analysisStatus: 'done', summary: 'Original summary' };
    const fetchMock = mockApi({
      ...me,
      [`GET ${detailUrl}`]: () => ({ status: 200, body: { meeting: current } }),
      [`POST ${detailUrl}/analyze`]: () => {
        current = { ...current, analysisStatus: 'pending' as const };
        return { status: 202, body: { meeting: current } };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);
    await user.click(await screen.findByRole('button', { name: 'Re-analyse' }));
    expect(screen.queryByRole('status', { name: /AI is finding notes/ })).not.toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: 'Re-analyse this meeting?' });
    expect(dialog).toHaveTextContent('Items you added yourself stay');
    expect(fetchMock.mock.calls.filter(([url]) => url === `${detailUrl}/analyze`)).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Re-analyse' }));
    expect(
      await screen.findByText(
        'Your transcript is saved. The AI will start reading it in a moment.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /AI is finding notes/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Meeting summary' })).toHaveTextContent(
      'Original summary',
    );
    expect(fetchMock.mock.calls.filter(([url]) => url === `${detailUrl}/analyze`)).toHaveLength(1);
  });

  it('shows the notes loader while analysis is processing', async () => {
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: {
        status: 200,
        body: { meeting: { ...meeting, analysisStatus: 'processing' } },
      },
    });
    renderApp(`/meetings/${meeting.id}`);

    expect(await screen.findByRole('status', { name: /AI is finding notes/ })).toHaveTextContent(
      'Decisions and action items will appear beside the transcript.',
    );
  });

  it('shows the failure reason and lets the user retry', async () => {
    const failed = {
      ...meeting,
      analysisStatus: 'failed' as const,
      analysisError: 'AI quota used up',
    };
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: { status: 200, body: { meeting: failed } },
      [`POST ${detailUrl}/analyze`]: {
        status: 202,
        body: { meeting: { ...failed, analysisStatus: 'pending', analysisError: null } },
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);
    expect(await screen.findByText('AI quota used up')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry analysis' }));
    expect(
      await screen.findByText(
        'Your transcript is saved. The AI will start reading it in a moment.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the numbered transcript with linkable line numbers', async () => {
    mockApi({ ...me, [`GET ${detailUrl}`]: { status: 200, body: { meeting } } });
    renderApp(`/meetings/${meeting.id}`);

    expect(
      await screen.findByRole('heading', { name: 'Weekly sync', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Line 2' })).toHaveAttribute('href', '#L2');
    expect(screen.getByText('Hi there')).toBeInTheDocument();
    expect(screen.getAllByText('Not analysed yet').length).toBeGreaterThan(0);
  });

  it('shows "not found" for a meeting that does not exist or is not mine', async () => {
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'Meeting not found' } },
      },
    });
    renderApp(`/meetings/${meeting.id}`);

    expect(await screen.findByRole('heading', { name: 'Meeting not found' })).toBeInTheDocument();
  });

  it('renames a meeting', async () => {
    const done = { ...meeting, analysisStatus: 'done' as const };
    mockApi({
      ...me,
      'GET /api/meetings': {
        status: 200,
        body: { meetings: [{ ...listItem, analysisStatus: 'done' }] },
      },
      [`GET ${detailUrl}`]: { status: 200, body: { meeting: done } },
      [`PATCH ${detailUrl}`]: (body) => ({
        status: 200,
        body: { meeting: { ...done, ...(body as object) } },
      }),
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);

    await screen.findByRole('heading', { name: 'Weekly sync', level: 1 });
    await user.click(
      await within(
        screen.getByRole('complementary', { name: 'Workspace sidebar' }),
      ).findByLabelText('More options for Weekly sync'),
    );
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit meeting' });
    const title = within(dialog).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Product sync');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByRole('heading', { name: 'Product sync', level: 1 }),
    ).toBeInTheDocument();
  });

  it('deletes after confirming and returns to the list with a message', async () => {
    mockApi({
      ...me,
      'GET /api/meetings': { status: 200, body: { meetings: [listItem] } },
      [`GET ${detailUrl}`]: { status: 200, body: { meeting } },
      [`DELETE ${detailUrl}`]: { status: 204 },
    });
    const user = userEvent.setup();
    const { router } = renderApp(`/meetings/${meeting.id}`);

    await screen.findByRole('heading', { name: 'Weekly sync', level: 1 });
    await user.click(
      await within(
        screen.getByRole('complementary', { name: 'Workspace sidebar' }),
      ).findByLabelText('More options for Weekly sync'),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this meeting?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete meeting' }));

    expect(await screen.findByText('Deleted “Weekly sync”.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/meetings'));
  });
});
