// Projects, pinning and archiving meetings.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { closeDatabase, resetDatabase, signUp, testAppDeps, WEB_ORIGIN } from './helpers';

const app = createApp(testAppDeps);
let alice: string;
let bob: string;

beforeEach(async () => {
  await resetDatabase();
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
    expect((await write(alice, 'delete', `/api/projects/${id}`)).status).toBe(204);
    expect(
      (await request(app).get(`/api/meetings/${ownId}`).set('Cookie', alice)).body.meeting
        .projectId,
    ).toBeNull();
  });
});
