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
    const user = userEvent.setup();
    renderApp('/meetings');

    await screen.findByRole('heading', { name: 'What would you like to debrief?', level: 1 });
    const sidebar = screen.getByRole('complementary');
    expect(await within(sidebar).findByRole('link', { name: 'Sprint review' })).toHaveAttribute(
      'href',
      `/meetings/${sprint.id}`,
    );
    await user.type(within(sidebar).getByRole('searchbox', { name: 'Search meetings' }), 'sprint');
    expect(within(sidebar).queryByRole('link', { name: 'Weekly sync' })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole('link', { name: 'All meetings' })).not.toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'Workspace home' })).toHaveAttribute(
      'href',
      '/meetings',
    );
    expect(
      within(screen.getByRole('main')).queryByRole('link', { name: /Sprint review/ }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'New meeting' }),
    ).toBeInTheDocument();
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

describe('new meeting: paste', () => {
  it('previews the parsed lines, saves, and opens the meeting', async () => {
    let posted: unknown;
    mockApi({
      ...me,
      'POST /api/meetings': (body) => {
        posted = body;
        return { status: 201, body: { meeting } };
      },
    });
    const user = userEvent.setup();
    const { router } = renderApp('/meetings/new');

    await user.type(await screen.findByLabelText('Title'), 'Weekly sync');
    await user.click(screen.getByLabelText('Transcript text'));
    await user.paste('Ann: Hello\nBen: Hi there');

    const preview = screen.getByRole('region', { name: 'Transcript preview' });
    expect(within(preview).getByRole('status')).toHaveTextContent('2 lines · 2 speakers');

    await user.click(screen.getByRole('button', { name: 'Save meeting' }));

    expect(
      await screen.findByRole('heading', { name: 'Weekly sync', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Meeting saved/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/meetings/${meeting.id}`);
    expect(posted).toEqual({
      title: 'Weekly sync',
      meetingDate: todayDate(),
      transcript: 'Ann: Hello\nBen: Hi there',
    });
  });

  it('shows inline errors and sends nothing when required fields are empty', async () => {
    const fetchMock = mockApi(me);
    const user = userEvent.setup();
    renderApp('/meetings/new');

    await user.click(await screen.findByRole('button', { name: 'Save meeting' }));

    expect(await screen.findByText('Give the meeting a title')).toBeInTheDocument();
    expect(screen.getByText('Paste the transcript text')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });
});

describe('new meeting: upload', () => {
  const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Ann>Hello</v>\n';

  it('reads the file, suggests a title, previews it and uploads it as a form', async () => {
    let posted: unknown;
    mockApi({
      ...me,
      'POST /api/meetings': (body) => {
        posted = body;
        return { status: 201, body: { meeting } };
      },
    });
    const user = userEvent.setup();
    renderApp('/meetings/new');

    await user.click(await screen.findByLabelText('Upload a file'));
    await user.upload(
      screen.getByLabelText('Transcript file'),
      new File([vtt], 'q1-planning_call.vtt', { type: 'text/vtt' }),
    );

    expect(await screen.findByText('q1-planning_call.vtt')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Q1 planning call');
    expect(screen.getByRole('region', { name: 'Transcript preview' })).toHaveTextContent(
      '1 line · 1 speaker',
    );

    await user.click(screen.getByRole('button', { name: 'Save meeting' }));
    await screen.findByRole('heading', { name: 'Weekly sync', level: 1 });

    expect(posted).toBeInstanceOf(FormData);
    const form = posted as FormData;
    expect(form.get('title')).toBe('Q1 planning call');
    expect((form.get('file') as File).name).toBe('q1-planning_call.vtt');
  });

  it('rejects a file type the app does not accept, before uploading', async () => {
    mockApi(me);
    // applyAccept: false lets the test pick a file the picker would normally hide.
    const user = userEvent.setup({ applyAccept: false });
    renderApp('/meetings/new');

    await user.click(await screen.findByLabelText('Upload a file'));
    await user.upload(
      screen.getByLabelText('Transcript file'),
      new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' }),
    );

    expect(await screen.findByText('Upload a .txt, .vtt or .md file')).toBeInTheDocument();
    expect(screen.getByLabelText('Transcript file')).toHaveAttribute('aria-invalid', 'true');
  });

  it('asks for a file when none was chosen', async () => {
    mockApi(me);
    const user = userEvent.setup();
    renderApp('/meetings/new');

    await user.type(await screen.findByLabelText('Title'), 'Retro');
    await user.click(screen.getByLabelText('Upload a file'));
    await user.click(screen.getByRole('button', { name: 'Save meeting' }));

    expect(await screen.findByText('Choose a transcript file to upload')).toBeInTheDocument();
  });
});

describe('meeting detail', () => {
  it('shows analysis results, review flags, and transcript links', async () => {
    const analysed = {
      ...meeting,
      analysisStatus: 'done' as const,
      summary: 'The team chose blue.',
      decisions: [{ id: crypto.randomUUID(), text: 'Use blue', sourceLine: 1, position: 0 }],
      actionItems: [
        {
          id: crypto.randomUUID(),
          meetingId: meeting.id,
          text: 'Send the files',
          owner: null,
          dueDate: null,
          dueDateText: 'soon',
          status: 'todo',
          needsReview: true,
          reviewReason: 'Check the due date',
          sourceLine: 2,
          sourceQuote: 'Hi there',
          origin: 'ai',
          position: 0,
        },
      ],
    };
    mockApi({ ...me, [`GET ${detailUrl}`]: { status: 200, body: { meeting: analysed } } });
    renderApp(`/meetings/${meeting.id}`);

    expect(await screen.findByText('The team chose blue.')).toBeInTheDocument();
    expect(screen.getByText('Use blue')).toBeInTheDocument();
    expect(screen.getByText('Send the files')).toBeInTheDocument();
    expect(screen.getByText(/Check the due date/)).toHaveTextContent('Needs review:');
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Line 2' }));
    expect(screen.getByRole('button', { name: /Transcript/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getAllByRole('link', { name: 'Line 2' })).toHaveLength(2);
    expect(document.getElementById('L2')).toHaveAttribute('aria-current', 'location');
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
    expect(dialog).toHaveTextContent('Items you added yourself will stay');
    expect(fetchMock.mock.calls.filter(([url]) => url === `${detailUrl}/analyze`)).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Re-analyse' }));
    expect(
      await screen.findByText('Your transcript is saved. Analysis will start shortly.'),
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
      await screen.findByText('Your transcript is saved. Analysis will start shortly.'),
    ).toBeInTheDocument();
  });

  it('shows the numbered transcript with linkable line numbers', async () => {
    mockApi({ ...me, [`GET ${detailUrl}`]: { status: 200, body: { meeting } } });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);

    expect(
      await screen.findByRole('heading', { name: 'Weekly sync', level: 1 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Transcript/ }));
    expect(screen.getByRole('link', { name: 'Line 2' })).toHaveAttribute(
      'href',
      `/meetings/${meeting.id}#L2`,
    );
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
      [`GET ${detailUrl}`]: { status: 200, body: { meeting } },
      [`PATCH ${detailUrl}`]: (body) => ({
        status: 200,
        body: { meeting: { ...meeting, ...(body as object) } },
      }),
    });
    const user = userEvent.setup();
    renderApp(`/meetings/${meeting.id}`);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
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
      [`GET ${detailUrl}`]: { status: 200, body: { meeting } },
      [`DELETE ${detailUrl}`]: { status: 204 },
    });
    const user = userEvent.setup();
    const { router } = renderApp(`/meetings/${meeting.id}`);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this meeting?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete meeting' }));

    expect(await screen.findByText('Deleted “Weekly sync”.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/meetings'));
  });
});
