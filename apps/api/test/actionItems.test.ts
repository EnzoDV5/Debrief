import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { pool } from '../src/db/client';
import { closeDatabase, resetDatabase, signUp, testAppDeps, WEB_ORIGIN } from './helpers';

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

const send = (method: 'post' | 'patch' | 'delete', url: string, cookie: string, body?: object) =>
  request(app)[method](url).set('Origin', WEB_ORIGIN).set('Cookie', cookie).send(body);
const get = (url: string, cookie: string) => request(app).get(url).set('Cookie', cookie);

/** A meeting owned by `cookie`'s user, plus AI-made items inserted directly (no AI needed). */
async function meetingWithItems(
  cookie: string,
  title = 'Plan',
  items: Array<{
    text: string;
    owner?: string;
    due?: string;
    status?: string;
    review?: string;
  }> = [],
) {
  const res = await send('post', '/api/meetings', cookie, {
    title,
    meetingDate: '2026-11-24',
    transcript: 'Ann: hi',
  });
  const meetingId: string = res.body.meeting.id;
  const { rows } = await pool.query('SELECT user_id FROM meetings WHERE id = $1', [meetingId]);
  const userId = rows[0].user_id;
  const ids: string[] = [];
  for (const [position, item] of items.entries()) {
    const inserted = await pool.query(
      `INSERT INTO action_items
         (meeting_id, user_id, text, owner, due_date, due_date_text, status, needs_review,
          review_reason, origin, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ai', $10) RETURNING id`,
      [
        meetingId,
        userId,
        item.text,
        item.owner ?? null,
        item.due ?? null,
        item.due ? 'the words' : null,
        item.status ?? 'todo',
        Boolean(item.review),
        item.review ?? null,
        position,
      ],
    );
    ids.push(inserted.rows[0].id);
  }
  return { meetingId, ids };
}

describe('adding, editing and deleting action items', () => {
  it('adds a hand-made item at the end of the list, never flagged', async () => {
    const { meetingId } = await meetingWithItems(alice, 'Plan', [{ text: 'AI item' }]);
    const res = await send('post', `/api/meetings/${meetingId}/action-items`, alice, {
      text: '  Book the venue ',
      owner: 'Ann',
      dueDate: '2026-12-01',
    });

    expect(res.status).toBe(201);
    expect(res.body.actionItem).toMatchObject({
      text: 'Book the venue',
      owner: 'Ann',
      dueDate: '2026-12-01',
      status: 'todo',
      origin: 'manual',
      needsReview: false,
      position: 1,
    });
  });

  it('validates new items and treats empty owner/date as none', async () => {
    const { meetingId } = await meetingWithItems(alice);
    const bad = await send('post', `/api/meetings/${meetingId}/action-items`, alice, {
      text: ' ',
      dueDate: '2026-02-30',
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields).toEqual({
      text: 'Describe the action item',
      dueDate: 'Pick a valid date',
    });

    const empty = await send('post', `/api/meetings/${meetingId}/action-items`, alice, {
      text: 'Call Ben',
      owner: '',
      dueDate: '',
    });
    expect(empty.body.actionItem).toMatchObject({ owner: null, dueDate: null });
  });

  it('ticks an item off without clearing its review flag', async () => {
    const { ids } = await meetingWithItems(alice, 'Plan', [
      { text: 'Send files', review: 'Owner “X” isn’t mentioned' },
    ]);
    const res = await send('patch', `/api/action-items/${ids[0]}`, alice, { status: 'done' });

    expect(res.status).toBe(200);
    expect(res.body.actionItem).toMatchObject({ status: 'done', needsReview: true });
  });

  it('keeps the context summary when ticking off, then clears it when the task changes', async () => {
    const { ids } = await meetingWithItems(alice, 'Plan', [{ text: 'Send files' }]);
    await pool.query('UPDATE action_items SET context_summary = $1 WHERE id = $2', [
      'Ann offered to send the final files.',
      ids[0],
    ]);

    const done = await send('patch', `/api/action-items/${ids[0]}`, alice, { status: 'done' });
    expect(done.body.actionItem.contextSummary).toBe('Ann offered to send the final files.');

    const edited = await send('patch', `/api/action-items/${ids[0]}`, alice, {
      text: 'Send updated files',
    });
    expect(edited.body.actionItem.contextSummary).toBeNull();
  });

  it('clears the review flag once the user edits the item', async () => {
    const { ids } = await meetingWithItems(alice, 'Plan', [
      { text: 'Send files', review: 'Owner “X” isn’t mentioned' },
    ]);
    const res = await send('patch', `/api/action-items/${ids[0]}`, alice, { owner: 'Ann' });

    expect(res.body.actionItem).toMatchObject({
      owner: 'Ann',
      needsReview: false,
      reviewReason: null,
    });
  });

  it('drops the transcript’s date words when a date is picked by hand', async () => {
    const { ids } = await meetingWithItems(alice, 'Plan', [{ text: 'Send', due: '2026-11-27' }]);
    const res = await send('patch', `/api/action-items/${ids[0]}`, alice, {
      dueDate: '2026-12-05',
    });
    expect(res.body.actionItem).toMatchObject({ dueDate: '2026-12-05', dueDateText: null });
  });

  it('keeps the transcript’s date words when an edit re-sends the same date', async () => {
    const { ids } = await meetingWithItems(alice, 'Plan', [{ text: 'Send', due: '2026-11-27' }]);
    // What the edit dialog sends: every field, with only the owner actually changed.
    const res = await send('patch', `/api/action-items/${ids[0]}`, alice, {
      text: 'Send',
      owner: 'Ann',
      dueDate: '2026-11-27',
      status: 'todo',
    });
    expect(res.body.actionItem).toMatchObject({ owner: 'Ann', dueDateText: 'the words' });
  });

  it('rejects an empty or invalid patch', async () => {
    const { ids } = await meetingWithItems(alice, 'Plan', [{ text: 'Send' }]);
    expect((await send('patch', `/api/action-items/${ids[0]}`, alice, {})).status).toBe(400);
    expect(
      (await send('patch', `/api/action-items/${ids[0]}`, alice, { status: 'finished' })).status,
    ).toBe(400);
  });

  it('deletes an item', async () => {
    const { ids } = await meetingWithItems(alice, 'Plan', [{ text: 'Send' }]);
    expect((await send('delete', `/api/action-items/${ids[0]}`, alice)).status).toBe(204);
    expect((await send('delete', `/api/action-items/${ids[0]}`, alice)).status).toBe(404);
  });
});

describe('GET /api/action-items ("my open items")', () => {
  async function seed() {
    await meetingWithItems(alice, 'Sprint review', [
      { text: 'Overdue task', owner: 'Ann', due: '2026-11-20' },
      { text: 'Future task', owner: 'ann', due: '2026-12-20', status: 'in_progress' },
      { text: 'Done task', owner: 'Ben', due: '2026-11-01', status: 'done' },
      { text: 'Nobody’s task' },
    ]);
    await meetingWithItems(bob, 'Bob only', [{ text: 'Bob’s secret task', owner: 'Ann' }]);
  }
  const texts = (res: request.Response) =>
    res.body.actionItems.map((i: { text: string }) => i.text);

  it('defaults to open items (to do + in progress), soonest due first, with meeting titles', async () => {
    await seed();
    const res = await get('/api/action-items', alice);

    expect(res.status).toBe(200);
    expect(texts(res)).toEqual(['Overdue task', 'Future task', 'Nobody’s task']);
    expect(res.body.actionItems[0]).toMatchObject({ meetingTitle: 'Sprint review' });
    expect(res.body.owners).toEqual(['ann', 'Ann', 'Ben']);
  });

  it('filters by status', async () => {
    await seed();
    expect(texts(await get('/api/action-items?status=done', alice))).toEqual(['Done task']);
    expect(texts(await get('/api/action-items?status=all', alice))).toHaveLength(4);
  });

  it('filters by owner, ignoring case, and by "no owner"', async () => {
    await seed();
    expect(texts(await get('/api/action-items?owner=ANN', alice))).toEqual([
      'Overdue task',
      'Future task',
    ]);
    expect(texts(await get('/api/action-items?owner=__unassigned', alice))).toEqual([
      'Nobody’s task',
    ]);
  });

  it('filters overdue items relative to the user’s today, excluding done ones', async () => {
    await seed();
    const res = await get('/api/action-items?overdue=true&status=all&today=2026-11-24', alice);
    expect(texts(res)).toEqual(['Overdue task']); // "Done task" is past due but done
  });

  it('validates the query', async () => {
    const res = await get('/api/action-items?status=later&today=tomorrow', alice);
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(['status', 'today']);
  });

  it('never includes another user’s items or owner names', async () => {
    await seed();
    const res = await get('/api/action-items?status=all', alice);
    expect(texts(res)).not.toContain('Bob’s secret task');
    const bobs = await get('/api/action-items', bob);
    expect(texts(bobs)).toEqual(['Bob’s secret task']);
    expect(bobs.body.owners).toEqual(['Ann']);
  });
});

describe('decisions and summary', () => {
  it('adds, edits and deletes a decision', async () => {
    const { meetingId } = await meetingWithItems(alice);
    const created = await send('post', `/api/meetings/${meetingId}/decisions`, alice, {
      text: 'Use blue',
    });
    expect(created.status).toBe(201);
    expect(created.body.decision).toMatchObject({ text: 'Use blue', sourceLine: null });

    const id = created.body.decision.id;
    const edited = await send('patch', `/api/decisions/${id}`, alice, { text: 'Use green' });
    expect(edited.body.decision.text).toBe('Use green');
    expect((await send('patch', `/api/decisions/${id}`, alice, { text: '' })).status).toBe(400);

    expect((await send('delete', `/api/decisions/${id}`, alice)).status).toBe(204);
    const meeting = await get(`/api/meetings/${meetingId}`, alice);
    expect(meeting.body.meeting.decisions).toEqual([]);
  });

  it('edits the summary', async () => {
    const { meetingId } = await meetingWithItems(alice);
    const res = await send('patch', `/api/meetings/${meetingId}`, alice, {
      summary: '  Corrected summary. ',
    });
    expect(res.body.meeting.summary).toBe('Corrected summary.');
    expect(
      (await send('patch', `/api/meetings/${meetingId}`, alice, { summary: ' ' })).status,
    ).toBe(400);
  });
});

describe('isolation: Bob can never touch Alice’s items or decisions', () => {
  it('returns 404 for every write, and changes nothing', async () => {
    const { meetingId, ids } = await meetingWithItems(alice, 'Plan', [{ text: 'Alice task' }]);
    const decision = await send('post', `/api/meetings/${meetingId}/decisions`, alice, {
      text: 'Alice decision',
    });
    const decisionId = decision.body.decision.id;

    const attempts = await Promise.all([
      send('post', `/api/meetings/${meetingId}/action-items`, bob, { text: 'Injected' }),
      send('post', `/api/meetings/${meetingId}/decisions`, bob, { text: 'Injected' }),
      send('patch', `/api/action-items/${ids[0]}`, bob, { status: 'done' }),
      send('delete', `/api/action-items/${ids[0]}`, bob),
      send('patch', `/api/decisions/${decisionId}`, bob, { text: 'Hacked' }),
      send('delete', `/api/decisions/${decisionId}`, bob),
      send('patch', `/api/meetings/${meetingId}`, bob, { summary: 'Hacked' }),
    ]);
    for (const res of attempts) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }

    const mine = await get(`/api/meetings/${meetingId}`, alice);
    expect(mine.body.meeting.actionItems).toMatchObject([{ text: 'Alice task', status: 'todo' }]);
    expect(mine.body.meeting.decisions).toMatchObject([{ text: 'Alice decision' }]);
  });

  it('gives the same 404 for a malformed id as for someone else’s', async () => {
    const { ids } = await meetingWithItems(alice, 'Plan', [{ text: 'Alice task' }]);
    const theirs = await send('patch', `/api/action-items/${ids[0]}`, bob, { status: 'done' });
    const malformed = await send('patch', '/api/action-items/not-a-uuid', bob, { status: 'done' });
    expect(malformed.body).toEqual(theirs.body);
  });

  it('requires a session for every route', async () => {
    const res = await request(app).get('/api/action-items');
    expect(res.status).toBe(401);
  });
});
