import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { pool } from '../src/db/client';
import { closeDatabase, resetDatabase, signUp, testAppDeps, WEB_ORIGIN } from './helpers';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/transcripts/${name}`, import.meta.url));

let app: ReturnType<typeof createApp>;
let alice: string; // session cookies
let bob: string;

beforeEach(async () => {
  await resetDatabase();
  app = createApp(testAppDeps);
  alice = await signUp(app, 'Alice');
  bob = await signUp(app, 'Bob');
});
afterAll(closeDatabase);

const details = { title: 'Weekly sync', meetingDate: '2026-11-24' };

function paste(cookie: string, body: object) {
  return request(app)
    .post('/api/meetings')
    .set('Origin', WEB_ORIGIN)
    .set('Cookie', cookie)
    .send(body);
}

function upload(cookie: string, file: Buffer, filename: string, fields: object = details) {
  let req = request(app).post('/api/meetings').set('Origin', WEB_ORIGIN).set('Cookie', cookie);
  for (const [key, value] of Object.entries(fields)) req = req.field(key, String(value));
  return req.attach('file', file, filename);
}

async function createMeeting(cookie: string, transcript = 'Ann: Hello\nBen: Hi there') {
  const res = await paste(cookie, { ...details, transcript });
  expect(res.status).toBe(201);
  return res.body.meeting as { id: string };
}

describe('POST /api/meetings (paste)', () => {
  it('saves the meeting with parsed lines, pending analysis, and the original text untouched', async () => {
    const transcript = '  Ann: Hello  \n\nBen: Hi there\n';
    const res = await paste(alice, { ...details, transcript });

    expect(res.status).toBe(201);
    expect(res.body.meeting).toMatchObject({
      title: 'Weekly sync',
      meetingDate: '2026-11-24',
      sourceType: 'paste',
      analysisStatus: 'pending',
      lineCount: 2,
      transcriptLines: [
        { n: 1, speaker: 'Ann', text: 'Hello' },
        { n: 2, speaker: 'Ben', text: 'Hi there' },
      ],
    });
    const row = await pool.query('SELECT transcript_original FROM meetings');
    expect(row.rows[0].transcript_original).toBe(transcript); // byte-for-byte what was sent
  });

  it('requires a session', async () => {
    const res = await request(app)
      .post('/api/meetings')
      .set('Origin', WEB_ORIGIN)
      .send({ ...details, transcript: 'x' });
    expect(res.status).toBe(401);
  });

  it('validates every field', async () => {
    const res = await paste(alice, { title: ' ', meetingDate: '2026-13-45', transcript: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({
      title: 'Give the meeting a title',
      meetingDate: 'Pick the date of the meeting',
      transcript: 'Paste the transcript text',
    });
  });

  it('rejects pasted text over 1 MB', async () => {
    const res = await paste(alice, { ...details, transcript: 'a'.repeat(1024 * 1024 + 1) });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.transcript).toBe('Transcript is larger than 1 MB');
  });

  it('rejects text with no readable lines', async () => {
    const res = await paste(alice, { ...details, transcript: 'WEBVTT\n\nNOTE nothing here\n' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMPTY_TRANSCRIPT');
  });
});

describe('POST /api/meetings (upload)', () => {
  it.each([
    ['messy-planning.vtt', 'vtt', 15],
    ['clean-standup.txt', 'txt', 17],
    ['no-actions-retro.md', 'md', 13],
  ])('accepts %s', async (filename, sourceType, lineCount) => {
    const res = await upload(alice, fixture(filename), filename);

    expect(res.status).toBe(201);
    expect(res.body.meeting).toMatchObject({ sourceType, lineCount, title: 'Weekly sync' });
  });

  it('keeps speakers from a VTT upload', async () => {
    const res = await upload(alice, fixture('messy-planning.vtt'), 'planning.vtt');
    expect(res.body.meeting.transcriptLines[0].speaker).toBe('Lerato Dlamini');
  });

  it('accepts upper-case extensions', async () => {
    expect((await upload(alice, Buffer.from('Ann: hi'), 'NOTES.TXT')).status).toBe(201);
  });

  it.each([
    ['wrong extension', Buffer.from('Ann: hi'), 'notes.pdf', 'Upload a .txt, .vtt or .md file'],
    ['no extension', Buffer.from('Ann: hi'), 'notes', 'Upload a .txt, .vtt or .md file'],
    [
      'invalid UTF-8',
      Buffer.from([0x41, 0x6e, 0x6e, 0x3a, 0x20, 0xff, 0xfe, 0xc3]),
      'notes.txt',
      "This file isn't valid UTF-8 text",
    ],
    [
      'binary renamed to .txt',
      Buffer.from('%PDF-1.7\0\0binary'),
      'notes.txt',
      "This file doesn't look like a text file",
    ],
    ['empty file', Buffer.from('  \n  '), 'notes.txt', 'This file is empty'],
  ])('rejects %s with a message on the file field', async (_label, file, filename, message) => {
    const res = await upload(alice, file, filename);
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ file: message });
  });

  it('rejects files over 1 MB with 413', async () => {
    const res = await upload(alice, Buffer.alloc(1024 * 1024 + 1, 'a'), 'big.txt');
    expect(res.status).toBe(413);
    expect(res.body.error.fields).toEqual({ file: 'File is larger than 1 MB' });
  });

  it('still validates the title and date sent with the file', async () => {
    const res = await upload(alice, Buffer.from('Ann: hi'), 'notes.txt', { title: '' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(['title', 'meetingDate']);
  });
});

describe('reading, updating and deleting meetings', () => {
  it('lists only my meetings, newest first, without transcript text', async () => {
    const first = await createMeeting(alice);
    const second = await createMeeting(alice);
    await createMeeting(bob);

    const res = await request(app).get('/api/meetings').set('Cookie', alice);

    expect(res.status).toBe(200);
    expect(res.body.meetings.map((m: { id: string }) => m.id)).toEqual([second.id, first.id]);
    expect(res.body.meetings[0]).toMatchObject({ lineCount: 2 });
    expect(res.body.meetings[0]).not.toHaveProperty('transcriptLines');
  });

  it('gets one meeting with its transcript', async () => {
    const meeting = await createMeeting(alice);
    const res = await request(app).get(`/api/meetings/${meeting.id}`).set('Cookie', alice);

    expect(res.status).toBe(200);
    expect(res.body.meeting.transcriptLines).toHaveLength(2);
  });

  it('updates the title and date, and validates the patch', async () => {
    const meeting = await createMeeting(alice);
    const patch = (body: object) =>
      request(app)
        .patch(`/api/meetings/${meeting.id}`)
        .set('Origin', WEB_ORIGIN)
        .set('Cookie', alice)
        .send(body);

    const ok = await patch({ title: 'Renamed', meetingDate: '2026-12-01' });
    expect(ok.status).toBe(200);
    expect(ok.body.meeting).toMatchObject({ title: 'Renamed', meetingDate: '2026-12-01' });

    expect((await patch({})).status).toBe(400);
    expect((await patch({ title: '' })).body.error.fields).toEqual({
      title: 'Give the meeting a title',
    });
  });

  it('deletes a meeting', async () => {
    const meeting = await createMeeting(alice);
    const del = await request(app)
      .delete(`/api/meetings/${meeting.id}`)
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', alice);

    expect(del.status).toBe(204);
    expect(
      (await request(app).get(`/api/meetings/${meeting.id}`).set('Cookie', alice)).status,
    ).toBe(404);
  });

  it('returns 404 for a malformed id and for an id that does not exist', async () => {
    const malformed = await request(app).get('/api/meetings/not-a-uuid').set('Cookie', alice);
    const missing = await request(app)
      .get('/api/meetings/00000000-0000-4000-8000-000000000000')
      .set('Cookie', alice);

    expect(malformed.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(malformed.body).toEqual(missing.body); // indistinguishable
  });
});

describe('isolation: another user can never reach my meeting', () => {
  it('returns 404 to Bob for GET, PATCH and DELETE on Alice’s meeting, and changes nothing', async () => {
    const meeting = await createMeeting(alice);
    const url = `/api/meetings/${meeting.id}`;

    const get = await request(app).get(url).set('Cookie', bob);
    const patch = await request(app)
      .patch(url)
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', bob)
      .send({ title: 'Hacked' });
    const del = await request(app).delete(url).set('Origin', WEB_ORIGIN).set('Cookie', bob);

    for (const res of [get, patch, del]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }

    // Alice's meeting is untouched.
    const mine = await request(app).get(url).set('Cookie', alice);
    expect(mine.status).toBe(200);
    expect(mine.body.meeting.title).toBe('Weekly sync');
  });

  it('gives Bob the same 404 as for a meeting that never existed', async () => {
    const meeting = await createMeeting(alice);
    const theirs = await request(app).get(`/api/meetings/${meeting.id}`).set('Cookie', bob);
    const nobody = await request(app)
      .get('/api/meetings/00000000-0000-4000-8000-000000000000')
      .set('Cookie', bob);

    expect(theirs.body).toEqual(nobody.body);
  });
});
