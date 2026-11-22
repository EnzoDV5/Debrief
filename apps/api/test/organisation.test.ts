// Projects, pinning and archiving meetings.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { pool } from '../src/db/client';
import {
  closeDatabase,
  markAnalysed,
  resetDatabase,
  signUp,
  testAppDeps,
  WEB_ORIGIN,
} from './helpers';

// A fresh app per test, so the sign-up rate limit starts at zero each time.
let app: ReturnType<typeof createApp>;
let alice: string;
let bob: string;

beforeEach(async () => {
  await resetDatabase();
  app = createApp(testAppDeps);
  alice = await signUp(app, 'Alice');
  bob = await signUp(app, 'Bob');
});
afterAll(closeDatabase);

const write = (cookie: string, method: 'post' | 'patch' | 'delete', path: string, body?: object) =>
  request(app)[method](path).set('Cookie', cookie).set('Origin', WEB_ORIGIN).send(body);

describe('meeting organisation', () => {
  it('pins, archives, restores and searches only the owner’s meetings', async () => {
    const first = await write(alice, 'post', '/api/meetings', {
      title: 'Planning',
      meetingDate: '2026-11-19',
      transcript: 'Ann: Discussed the violet homepage.',
    });
    const second = await write(alice, 'post', '/api/meetings', {
      title: 'Standup',
      meetingDate: '2026-11-19',
      transcript: 'Ben: Reviewed the pricing page.',
    });
    await write(bob, 'post', '/api/meetings', {
      title: 'Private violet',
      meetingDate: '2026-11-19',
      transcript: 'Bob: violet',
    });
    const id = first.body.meeting.id as string;

    expect(
      (await write(alice, 'patch', `/api/meetings/${id}`, { pinned: true })).body.meeting.pinnedAt,
    ).toBeTruthy();
    const list = await request(app).get('/api/meetings').set('Cookie', alice);
    expect(list.body.meetings.map((m: { id: string }) => m.id)).toEqual([
      id,
      second.body.meeting.id,
    ]);
    const search = await request(app).get('/api/meetings?q=VIOLET').set('Cookie', alice);
    expect(search.body.meetings.map((m: { id: string }) => m.id)).toEqual([id]);

    await markAnalysed(id);
    expect((await write(alice, 'patch', `/api/meetings/${id}`, { archived: true })).status).toBe(
      200,
    );
    expect(
      (await request(app).get('/api/meetings').set('Cookie', alice)).body.meetings,
    ).toHaveLength(1);
    const archived = await request(app).get('/api/meetings?archived=true').set('Cookie', alice);
    expect(archived.body.meetings.map((m: { id: string }) => m.id)).toEqual([id]);
    expect(
      (await write(alice, 'patch', `/api/meetings/${id}`, { archived: false })).body.meeting
        .archivedAt,
    ).toBeNull();
  });

  it('refuses to archive a meeting while it is still being analysed', async () => {
    const created = await write(alice, 'post', '/api/meetings', {
      title: 'Planning',
      meetingDate: '2026-11-19',
      transcript: 'Ann: Hello',
    });
    const id = created.body.meeting.id as string;
    expect(created.body.meeting.analysisStatus).toBe('pending');

    for (const status of ['pending', 'processing']) {
      await pool.query('UPDATE meetings SET analysis_status = $1 WHERE id = $2', [status, id]);
      const res = await write(alice, 'patch', `/api/meetings/${id}`, { archived: true });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ANALYSIS_RUNNING');
    }
    // Other edits still work mid-analysis, and it can be archived once done.
    expect((await write(alice, 'patch', `/api/meetings/${id}`, { pinned: true })).status).toBe(200);
    await markAnalysed(id);
    expect((await write(alice, 'patch', `/api/meetings/${id}`, { archived: true })).status).toBe(
      200,
    );
  });

  it('keeps projects private and never assigns a meeting to someone else’s project', async () => {
    const project = await write(alice, 'post', '/api/projects', { name: 'Launch' });
    expect(project.status).toBe(201);
    const duplicate = await write(alice, 'post', '/api/projects', { name: 'launch' });
    expect(duplicate.status).toBe(409);
    const id = project.body.project.id as string;
    const meeting = await write(bob, 'post', '/api/meetings', {
      title: 'Bob meeting',
      meetingDate: '2026-11-19',
      transcript: 'Bob: hello',
    });
    const meetingId = meeting.body.meeting.id as string;

    expect((await request(app).get('/api/projects').set('Cookie', bob)).body.projects).toEqual([]);
    expect((await write(bob, 'patch', `/api/projects/${id}`, { name: 'Taken' })).status).toBe(404);
    expect((await write(bob, 'delete', `/api/projects/${id}`)).status).toBe(404);
    expect(
      (await write(bob, 'patch', `/api/meetings/${meetingId}`, { projectId: id })).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/meetings?projectId=${id}`).set('Cookie', bob)).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/meetings/${meetingId}`).set('Cookie', bob)).body.meeting
        .projectId,
    ).toBeNull();

    const own = await write(alice, 'post', '/api/meetings', {
      title: 'Launch sync',
      meetingDate: '2026-11-19',
      transcript: 'Ann: ship it',
    });
    const ownId = own.body.meeting.id as string;
    expect(
      (await write(alice, 'patch', `/api/meetings/${ownId}`, { projectId: id })).body.meeting
        .projectId,
    ).toBe(id);
    expect(
      (await request(app).get(`/api/meetings?projectId=${id}`).set('Cookie', alice)).body.meetings,
    ).toHaveLength(1);
    const projects = await request(app).get('/api/projects').set('Cookie', alice);
    expect(projects.body.projects).toMatchObject([{ id, name: 'Launch', meetingCount: 1 }]);
    expect(projects.body.projects[0].createdAt).toBeTruthy();
    await markAnalysed(ownId);
    await write(alice, 'patch', `/api/meetings/${ownId}`, { archived: true });
    expect(
      (await request(app).get('/api/projects').set('Cookie', alice)).body.projects[0].meetingCount,
    ).toBe(0);
    await write(alice, 'patch', `/api/meetings/${ownId}`, { archived: false });
    expect((await write(alice, 'delete', `/api/projects/${id}`)).status).toBe(204);
    expect(
      (await request(app).get(`/api/meetings/${ownId}`).set('Cookie', alice)).body.meeting
        .projectId,
    ).toBeNull();
  });
});

describe('PUT /api/meetings/order (drag to reorder)', () => {
  const put = (cookie: string, ids: unknown) =>
    request(app)
      .put('/api/meetings/order')
      .set('Cookie', cookie)
      .set('Origin', WEB_ORIGIN)
      .send({ ids });
  const titles = async (cookie: string) =>
    (
      (await request(app).get('/api/meetings').set('Cookie', cookie)).body.meetings as {
        title: string;
      }[]
    ).map((m) => m.title);
  const create = async (cookie: string, title: string) =>
    (
      await write(cookie, 'post', '/api/meetings', {
        title,
        meetingDate: '2026-11-24',
        transcript: 'Ann: Hello',
      })
    ).body.meeting.id as string;

  it('saves the order, keeps pinned first, and puts new meetings on top', async () => {
    const a = await create(alice, 'A');
    const b = await create(alice, 'B');
    const c = await create(alice, 'C');
    expect(await titles(alice)).toEqual(['C', 'B', 'A']);

    expect((await put(alice, [a, c, b])).status).toBe(204);
    expect(await titles(alice)).toEqual(['A', 'C', 'B']);

    await create(alice, 'D');
    expect(await titles(alice)).toEqual(['D', 'A', 'C', 'B']);

    await write(alice, 'patch', `/api/meetings/${b}`, { pinned: true });
    expect(await titles(alice)).toEqual(['B', 'D', 'A', 'C']);
  });

  it('validates the ids', async () => {
    expect((await put(alice, ['not-a-uuid'])).status).toBe(400);
    expect((await put(alice, [])).status).toBe(400);
    const a = await create(alice, 'A');
    expect((await put(alice, [a, a])).status).toBe(400);
  });

  it('cannot reorder another user’s meetings', async () => {
    const a = await create(alice, 'A');
    const b = await create(alice, 'B');
    expect((await put(bob, [a, b])).status).toBe(204);
    expect(await titles(alice)).toEqual(['B', 'A']);
  });
});

describe('POST /api/meetings/archive-all (clear the Meetings list)', () => {
  const create = async (cookie: string, title: string, { analysed = true } = {}) => {
    const id = (
      await write(cookie, 'post', '/api/meetings', {
        title,
        meetingDate: '2026-11-24',
        transcript: 'Ann: Hello',
      })
    ).body.meeting.id as string;
    if (analysed) await markAnalysed(id);
    return id;
  };
  const listTitles = async (cookie: string, query = '') =>
    (
      (await request(app).get(`/api/meetings${query}`).set('Cookie', cookie)).body.meetings as {
        title: string;
      }[]
    ).map((m) => m.title);

  it('archives every unpinned meeting, keeps pinned ones, and touches nobody else', async () => {
    await create(alice, 'A');
    await create(alice, 'B');
    const pinned = await create(alice, 'Pinned');
    await write(alice, 'patch', `/api/meetings/${pinned}`, { pinned: true });
    await create(bob, 'Bob meeting');

    const res = await write(alice, 'post', '/api/meetings/archive-all');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ archived: 2 });

    expect(await listTitles(alice)).toEqual(['Pinned']);
    expect((await listTitles(alice, '?archived=true')).sort()).toEqual(['A', 'B']);
    expect(await listTitles(bob)).toEqual(['Bob meeting']);
  });

  it('skips meetings that are still being analysed', async () => {
    await create(alice, 'Done');
    await create(alice, 'Running', { analysed: false });

    const res = await write(alice, 'post', '/api/meetings/archive-all');
    expect(res.body).toEqual({ archived: 1 });
    expect(await listTitles(alice)).toEqual(['Running']);
  });

  it('requires a session', async () => {
    const res = await request(app).post('/api/meetings/archive-all').set('Origin', WEB_ORIGIN);
    expect(res.status).toBe(401);
  });
});
