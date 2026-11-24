// Demo seed: Alice and Bob can log in, see only their own analysed meeting, and re-seeding is safe.
import { drizzle } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { pool } from '../src/db/client';
import * as schema from '../src/db/schema';
import { SEED_PASSWORD, SEED_USERS, seed } from '../src/db/seed';
import {
  closeDatabase,
  resetDatabase,
  sessionCookiePair,
  signUp,
  testAppDeps,
  WEB_ORIGIN,
} from './helpers';

const db = drizzle(pool, { schema });
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDatabase();
  app = createApp(testAppDeps);
});
afterAll(closeDatabase);

async function logIn(email: string) {
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', WEB_ORIGIN)
    .send({ email, password: SEED_PASSWORD });
  expect(res.status).toBe(200);
  return sessionCookiePair(res);
}

async function onlyMeeting(cookie: string) {
  const list = await request(app).get('/api/meetings').set('Cookie', cookie);
  expect(list.body.meetings).toHaveLength(1);
  const res = await request(app)
    .get(`/api/meetings/${list.body.meetings[0].id}`)
    .set('Cookie', cookie);
  return res.body.meeting;
}

describe('demo seed', () => {
  it('lets Alice log in to an analysed meeting whose cards all point at real transcript lines', async () => {
    await seed(db);
    const meeting = await onlyMeeting(await logIn(SEED_USERS[0].email));

    expect(meeting.analysisStatus).toBe('done');
    expect(meeting.decisions).toHaveLength(2);
    expect(meeting.actionItems).toHaveLength(4);
    expect(meeting.actionItems.filter((i: { needsReview: boolean }) => i.needsReview)).toHaveLength(
      1,
    );

    for (const item of meeting.actionItems) {
      const line = meeting.transcriptLines.find((l: { n: number }) => l.n === item.sourceLine);
      expect(line.text).toContain(item.sourceQuote);
      // No invented owners: every owner is a speaker or is named in the transcript.
      const everyone = meeting.transcriptLines
        .map((l: { speaker?: string; text: string }) => `${l.speaker ?? ''} ${l.text}`)
        .join('\n');
      if (item.owner) expect(everyone).toContain(item.owner);
    }
  });

  it('gives Bob a meeting with nothing to action, and keeps Alice’s meeting hidden from him', async () => {
    await seed(db);
    const aliceMeeting = await onlyMeeting(await logIn(SEED_USERS[0].email));
    const bob = await logIn(SEED_USERS[1].email);

    const bobMeeting = await onlyMeeting(bob);
    expect(bobMeeting.actionItems).toHaveLength(0);

    const peek = await request(app).get(`/api/meetings/${aliceMeeting.id}`).set('Cookie', bob);
    expect(peek.status).toBe(404);
  });

  it('can run again without duplicates, and never touches other accounts', async () => {
    const carol = await signUp(app, 'Carol');
    await seed(db);
    await seed(db);

    const users = await db.select().from(schema.users);
    expect(users.map((u) => u.email).sort()).toEqual(
      ['alice@example.com', 'bob@example.com', 'carol@debrief.test'].sort(),
    );
    const me = await request(app).get('/api/auth/me').set('Cookie', carol);
    expect(me.status).toBe(200);
  });
});
