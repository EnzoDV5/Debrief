// Search: finds meetings, action items and decisions, and never another user's.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import {
  closeDatabase,
  markAnalysed,
  resetDatabase,
  signUp,
  testAppDeps,
  WEB_ORIGIN,
} from './helpers';

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

const post = (cookie: string, path: string, body: object) =>
  request(app).post(path).set('Origin', WEB_ORIGIN).set('Cookie', cookie).send(body);
const search = (cookie: string, q: string) =>
  request(app).get('/api/search').query({ q }).set('Cookie', cookie);

async function meetingWithNotes(cookie: string) {
  const res = await post(cookie, '/api/meetings', {
    title: 'Budget review',
    meetingDate: '2026-11-24',
    transcript: 'Ann: We keep the 100% budget.\nBen: I will send the invoice to Coastline.',
  });
  const id = res.body.meeting.id as string;
  await markAnalysed(id);
  await post(cookie, `/api/meetings/${id}/action-items`, {
    text: 'Send the invoice to Coastline',
    owner: 'Ben',
    sourceLine: 2,
  });
  await post(cookie, `/api/meetings/${id}/decisions`, {
    text: 'Keep the 100% budget',
    sourceLine: 1,
  });
  return id;
}

describe('GET /api/search', () => {
  it('finds action items and decisions with their meeting and line', async () => {
    const id = await meetingWithNotes(alice);

    const items = await search(alice, 'invoice');
    expect(items.status).toBe(200);
    expect(items.body.actionItems).toEqual([
      expect.objectContaining({
        text: 'Send the invoice to Coastline',
        owner: 'Ben',
        meetingId: id,
        meetingTitle: 'Budget review',
        sourceLine: 2,
      }),
    ]);
    expect(items.body.meetings.map((m: { id: string }) => m.id)).toEqual([id]);

    const decisions = await search(alice, 'budget');
    expect(decisions.body.decisions).toEqual([
      expect.objectContaining({ text: 'Keep the 100% budget', meetingId: id, sourceLine: 1 }),
    ]);
  });

  it('treats % as a normal character, not a wildcard', async () => {
    await meetingWithNotes(alice);
    expect((await search(alice, '100%')).body.decisions).toHaveLength(1);
    expect((await search(alice, '%%')).body.decisions).toHaveLength(0);
  });

  it('lists the latest items and decisions when there is no search text', async () => {
    const id = await meetingWithNotes(alice);
    const res = await request(app).get('/api/search').set('Cookie', alice);
    expect(res.status).toBe(200);
    expect(res.body.meetings.map((m: { id: string }) => m.id)).toEqual([id]);
    expect(res.body.actionItems).toHaveLength(1);
    expect(res.body.decisions).toHaveLength(1);
  });

  it('needs at least 2 characters', async () => {
    const res = await search(alice, 'a');
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('q');
  });

  it('never returns another user’s meetings, items or decisions', async () => {
    await meetingWithNotes(alice);
    const res = await search(bob, 'invoice');
    expect(res.body).toEqual({ meetings: [], actionItems: [], decisions: [] });
  });

  it('requires a session', async () => {
    expect((await request(app).get('/api/search').query({ q: 'invoice' })).status).toBe(401);
  });
});
