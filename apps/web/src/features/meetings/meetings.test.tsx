import type { Meeting } from '@debrief/shared';
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
    expect(within(sidebar).getByRole('link', { name: 'Search' })).toHaveAttribute(
      'href',
      '/search',
    );
    expect(within(sidebar).queryByRole('link', { name: 'All meetings' })).not.toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'Workspace home' })).toHaveAttribute(
      'href',
      '/meetings',
    );
    expect(
      within(screen.getByRole('main')).queryByRole('link', { name: /Sprint review/ }),
    ).not.toBeInTheDocument();
    // Home IS the drop zone: the one obvious thing to do.
    expect(within(screen.getByRole('main')).getByLabelText('Transcript file')).toBeInTheDocument();
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

    // Review step: the parsed transcript, a suggested title, and nothing sent yet.
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
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
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
    await user.click(screen.getByLabelText('Transcript text'));
    await user.paste('Ann: Hello');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.clear(await screen.findByLabelText('Title'));
    await user.click(screen.getByRole('button', { name: 'Save & analyse' }));

    expect(await screen.findByText('Give the meeting a title')).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it('rejects a file type the app does not accept, without leaving the drop zone', async () => {
    mockApi(me);
    // applyAccept: false lets the test pick a file the picker would normally hide.
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

    // Ask is always open, at the top of the notes column.
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

  it('shows analysis results, review flags, and transcript links', async () => {
    const analysed = {
      ...meeting,
      analysisStatus: 'done' as const,
      summary: 'The team chose blue.',
      transcriptLines: [
        { n: 1, speaker: 'Ann', text: 'We chose blue for the design.' },
        { n: 2, speaker: 'Ben', text: 'The draft is ready. Can you send the files to the team?' },
      ],
      decisions: [{ id: crypto.randomUUID(), text: 'Use blue', sourceLine: 1, position: 0 }],
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
          inCalendar: false,
          origin: 'ai',
          position: 0,
        },
      ],
    };
    mockApi({ ...me, [`GET ${detailUrl}`]: { status: 200, body: { meeting: analysed } } });
    renderApp(`/meetings/${meeting.id}`);

    expect(await screen.findByText('The team chose blue.')).toBeInTheDocument();
    const decisionLine = document.getElementById('L1')!;
    expect(within(decisionLine).getByText('Use blue')).toBeInTheDocument();
    expect(within(decisionLine).getByText('Agreed decision')).toBeInTheDocument();
    expect(
      within(decisionLine).getByText(
        'Keep this as a record of what the team agreed. Edit it if it is incorrect.',
      ),
    ).toBeInTheDocument();
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
          inCalendar: false,
          origin: 'ai',
          position: 0,
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

    // Escape from inside the panel closes it and puts focus back on its button.
    await user.click(screen.getByRole('button', { name: 'Edit summary' }));
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('makes an action item from a line with the keyboard (Enter on the line)', async () => {
    const withText = {
      ...meeting,
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
              inCalendar: false,
              origin: 'manual',
              position: 0,
            },
          },
        };
      },
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);

    // Each line's text is one tab stop; Enter opens the toolbar with focus inside it.
    const line = (await screen.findByText('I will send the deck to Lerato.')).closest(
      '[data-line-text]',
    );
    (line as HTMLElement).focus();
    await user.keyboard('{Enter}');
    const toolbar = screen.getByRole('toolbar', { name: 'Create from the transcript' });
    expect(within(toolbar).getByRole('button', { name: 'Action item' })).toHaveFocus();
    await user.keyboard('{Enter}');

    const dialog = screen.getByRole('dialog', { name: 'Add an action item' });
    expect(dialog).toHaveTextContent('From line 2 of the transcript');
    const task = within(dialog).getByRole('textbox', { name: 'Task' });
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

  it('adds to a project, archives and offers delete from the meeting bar', async () => {
    const projectId = '5d1c6b8e-2f3a-4c5d-8e9f-0a1b2c3d4e5f';
    let current: Meeting = { ...meeting };
    const patches: unknown[] = [];
    mockApi({
      ...me,
      [`GET ${detailUrl}`]: () => ({ status: 200, body: { meeting: current } }),
      'GET /api/projects': {
        status: 200,
        body: {
          projects: [{ id: projectId, name: 'Launch', createdAt: '2026-11-01T08:00:00.000Z' }],
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

    // Project menu: shows the chosen project's name afterwards.
    await user.click(await screen.findByText('Add to project'));
    await user.click(await screen.findByRole('button', { name: 'Launch' }));
    expect(await screen.findByText('Launch', { selector: 'summary span' })).toBeInTheDocument();

    // Archive toggles to Restore (the meeting stays open, so it can be undone here).
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument();
    expect(patches).toEqual([{ projectId }, { archived: true }]);

    // Delete is an icon button that asks first.
    await user.click(screen.getByRole('button', { name: 'Delete meeting' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(meeting.title);
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
    const dialog = screen.getByRole('dialog', { name: 'Re-analyse this meeting?' });
    expect(dialog).toHaveTextContent('Items you added yourself stay');
    expect(fetchMock.mock.calls.filter(([url]) => url === `${detailUrl}/analyze`)).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Re-analyse' }));
    expect(
      await screen.findByText(
        'Your transcript is saved. The AI will start reading it in a moment.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Original summary')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => url === `${detailUrl}/analyze`)).toHaveLength(1);
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
    mockApi({
      ...me,
      'GET /api/meetings': { status: 200, body: { meetings: [listItem] } },
      [`GET ${detailUrl}`]: { status: 200, body: { meeting } },
      [`PATCH ${detailUrl}`]: (body) => ({
        status: 200,
        body: { meeting: { ...meeting, ...(body as object) } },
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
