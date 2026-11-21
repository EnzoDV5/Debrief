// Project rows show their details and keep editing, deletion and meetings in place.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { mockApi, renderApp, testUser } from '@/test/renderApp';

const projectId = '94ac1d67-cc68-4f0e-b036-048f2e429348';
const meetingId = '8742d768-f974-49c4-b902-3f28205e6524';

it('shows a new project as an expanded row after creation', async () => {
  let projects: { id: string; name: string; createdAt: string; meetingCount: number }[] = [];
  mockApi({
    'GET /api/auth/me': { status: 200, body: { user: testUser } },
    'GET /api/projects': () => ({ status: 200, body: { projects } }),
    'POST /api/projects': (body) => {
      const project = {
        id: projectId,
        name: (body as { name: string }).name,
        createdAt: '2026-11-01T08:00:00.000Z',
        meetingCount: 0,
      };
      projects = [project];
      return { status: 201, body: { project } };
    },
  });
  const user = userEvent.setup();
  renderApp('/projects');

  await screen.findByRole('heading', { name: 'No projects yet' });
  await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Launch');
  await user.click(screen.getByRole('button', { name: 'Create' }));

  const row = await screen.findByRole('region', { name: 'Launch' });
  expect(within(row).getByText('0 meetings')).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Collapse Launch meetings' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

it('expands a large project row and lets its name be edited or deleted', async () => {
  let project = {
    id: projectId,
    name: 'Launch',
    createdAt: '2026-11-01T08:00:00.000Z',
    meetingCount: 1,
  };
  let deleted = false;
  mockApi({
    'GET /api/auth/me': { status: 200, body: { user: testUser } },
    'GET /api/projects': () => ({
      status: 200,
      body: { projects: deleted ? [] : [project] },
    }),
    [`GET /api/meetings?projectId=${projectId}`]: {
      status: 200,
      body: {
        meetings: [
          {
            id: meetingId,
            title: 'Launch sync',
            meetingDate: '2026-11-02',
            sourceType: 'paste',
            analysisStatus: 'done',
            lineCount: 2,
            createdAt: '2026-11-02T08:00:00.000Z',
            pinnedAt: null,
            archivedAt: null,
            projectId,
          },
        ],
      },
    },
    [`PATCH /api/projects/${projectId}`]: (body) => {
      project = { ...project, name: (body as { name: string }).name };
      return { status: 200, body: { project } };
    },
    [`DELETE /api/projects/${projectId}`]: () => {
      deleted = true;
      return { status: 204 };
    },
  });
  const user = userEvent.setup();
  const { router } = renderApp('/projects');

  const row = await screen.findByRole('region', { name: 'Launch' });
  expect(within(row).getByText('1 meeting')).toBeInTheDocument();
  expect(within(row).getByText('Created 1 Nov 2026')).toBeInTheDocument();
  expect(within(row).getByRole('button', { name: 'Expand Launch meetings' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );

  await user.click(within(row).getByRole('button', { name: 'Expand Launch meetings' }));
  await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${projectId}`));
  expect(await screen.findByRole('button', { name: 'Collapse Launch meetings' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  expect(screen.getByRole('region', { name: 'Launch' })).toBe(row);
  expect(
    await within(screen.getByRole('region', { name: 'Launch' })).findByRole('heading', {
      name: 'Launch sync',
    }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open meeting' })).toHaveAttribute(
    'href',
    `/meetings/${meetingId}`,
  );

  await user.click(screen.getByRole('button', { name: 'Edit name of Launch' }));
  const nameInput = screen.getByRole('textbox', { name: 'New name for Launch' });
  await user.clear(nameInput);
  await user.type(nameInput, 'Release');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('region', { name: 'Release' })).toBeInTheDocument();

  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: 'Delete Release' }));
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'No projects yet' })).toBeInTheDocument(),
  );
  expect(confirm).toHaveBeenCalledOnce();
  confirm.mockRestore();
});

it('removes a meeting from its project and updates the count', async () => {
  let assigned = true;
  const meeting = {
    id: meetingId,
    title: 'Launch sync',
    meetingDate: '2026-11-02',
    sourceType: 'paste',
    analysisStatus: 'done',
    lineCount: 2,
    createdAt: '2026-11-02T08:00:00.000Z',
    pinnedAt: null,
    archivedAt: null,
    projectId,
  };
  mockApi({
    'GET /api/auth/me': { status: 200, body: { user: testUser } },
    'GET /api/projects': () => ({
      status: 200,
      body: {
        projects: [
          {
            id: projectId,
            name: 'Launch',
            createdAt: '2026-11-01T08:00:00.000Z',
            meetingCount: assigned ? 1 : 0,
          },
        ],
      },
    }),
    [`GET /api/meetings?projectId=${projectId}`]: () => ({
      status: 200,
      body: { meetings: assigned ? [meeting] : [] },
    }),
    [`PATCH /api/meetings/${meetingId}`]: () => {
      assigned = false;
      return {
        status: 200,
        body: {
          meeting: {
            ...meeting,
            projectId: null,
            updatedAt: '2026-11-02T09:00:00.000Z',
            transcriptLines: [
              { n: 1, speaker: 'Ann', text: 'Hello' },
              { n: 2, speaker: 'Ben', text: 'Hi' },
            ],
            summary: null,
            analysisError: null,
            decisions: [],
            actionItems: [],
          },
        },
      };
    },
  });
  const user = userEvent.setup();
  renderApp(`/projects/${projectId}`);

  await screen.findByRole('heading', { name: 'Launch sync' });
  await user.click(screen.getByRole('button', { name: 'Remove from project' }));
  expect(
    await screen.findByRole('heading', { name: 'No meetings in this project' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Launch' })).toHaveTextContent('0 meetings');
});
