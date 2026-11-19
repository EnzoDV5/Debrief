import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { pool } from '../src/db/client';
import { analyzeMeeting, type AnalysisJob } from '../src/modules/analysis/analysis.service';
import { AiError, type AiClient, type AiRequest } from '../src/modules/analysis/openRouterClient';
import { closeDatabase, resetDatabase, signUp, WEB_ORIGIN } from './helpers';

const jobs: AnalysisJob[] = [];
const app = createApp({
  analysisQueue: {
    enqueue: async (job) => {
      jobs.push(job);
    },
  },
});
const log = { info: () => {}, warn: () => {}, error: () => {} } as const;
let cookie: string;

beforeEach(async () => {
  jobs.length = 0;
  await resetDatabase();
  cookie = await signUp(app, 'Alice');
});
afterAll(closeDatabase);

async function meeting(
  transcript = 'Ann: We chose blue.\nBen: Ann will send the files by Friday 27 November.',
) {
  const res = await request(app)
    .post('/api/meetings')
    .set('Origin', WEB_ORIGIN)
    .set('Cookie', cookie)
    .send({ title: 'Plan', meetingDate: '2026-11-24', transcript });
  expect(res.status).toBe(201);
  expect(jobs).toHaveLength(1);
  return res.body.meeting.id as string;
}

function fakeAi(responses: Partial<Record<AiRequest['schemaName'], string>>): AiClient {
  return {
    complete: async (input) => responses[input.schemaName] ?? '{}',
  };
}

const valid = {
  meeting_summary: JSON.stringify({ summary: 'The team chose blue. Ann will send the files.' }),
  meeting_decisions: JSON.stringify({
    decisions: [{ text: 'Use blue', source_line: 1, source_quote: 'We chose blue' }],
  }),
  meeting_action_items: JSON.stringify({
    action_items: [
      {
        text: 'Send the files',
        owner: 'Ann',
        due_date_text: 'by Friday 27 November',
        source_line: 2,
        source_quote: 'Ann will send the files by Friday 27 November',
      },
    ],
  }),
};

describe('analysis worker', () => {
  it('saves three validated steps with citations, a resolved date and audit rows', async () => {
    const id = await meeting();
    await analyzeMeeting(jobs[0]!, { ai: fakeAi(valid), models: ['test-model'], log });
    const res = await request(app).get(`/api/meetings/${id}`).set('Cookie', cookie);

    expect(res.body.meeting).toMatchObject({
      analysisStatus: 'done',
      summary: 'The team chose blue. Ann will send the files.',
      decisions: [{ text: 'Use blue', sourceLine: 1 }],
      actionItems: [
        {
          text: 'Send the files',
          owner: 'Ann',
          dueDate: '2026-11-27',
          sourceLine: 2,
          needsReview: false,
        },
      ],
    });
    const runs = await pool.query(
      'SELECT step, status FROM analysis_runs ORDER BY started_at, step',
    );
    expect(runs.rows).toHaveLength(3);
    expect(runs.rows.every((row) => row.status === 'success')).toBe(true);
  });

  it('tries another model after invalid output and never saves an invented owner', async () => {
    const id = await meeting();
    const ai: AiClient = {
      complete: async (input) =>
        input.model === 'bad'
          ? '{broken'
          : input.schemaName === 'meeting_action_items'
            ? JSON.stringify({
                action_items: [
                  {
                    text: 'Send the files',
                    owner: 'Charlie',
                    due_date_text: 'tomorrow',
                    source_line: 2,
                    source_quote: 'Ann will send the files',
                  },
                ],
              })
            : valid[input.schemaName as keyof typeof valid],
    };
    await analyzeMeeting(jobs[0]!, { ai, models: ['bad', 'good'], log });
    const res = await request(app).get(`/api/meetings/${id}`).set('Cookie', cookie);
    expect(res.body.meeting.analysisStatus).toBe('done');
    expect(res.body.meeting.actionItems[0]).toMatchObject({
      owner: null,
      dueDate: null,
      needsReview: true,
    });
    const runs = await pool.query('SELECT status FROM analysis_runs');
    expect(runs.rows.filter((row) => row.status === 'invalid_output')).toHaveLength(3);
  });

  it('keeps an empty action list empty and lets the user retry after an AI failure', async () => {
    const id = await meeting('Ann: We finished the retro.');
    await analyzeMeeting(jobs[0]!, {
      ai: {
        complete: async () => {
          throw new AiError('daily_limit', 'Daily quota');
        },
      },
      models: ['test-model'],
      log,
    });
    const failed = await request(app).get(`/api/meetings/${id}`).set('Cookie', cookie);
    expect(failed.body.meeting.analysisStatus).toBe('failed');
    expect(failed.body.meeting.analysisError).toMatch(/quota/);

    const retry = await request(app)
      .post(`/api/meetings/${id}/analyze`)
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', cookie);
    expect(retry.status).toBe(202);
    expect(jobs).toHaveLength(2);
    await analyzeMeeting(jobs[1]!, {
      ai: fakeAi({
        meeting_summary: JSON.stringify({ summary: 'The retro finished.' }),
        meeting_decisions: '{"decisions":[]}',
        meeting_action_items: '{"action_items":[]}',
      }),
      models: ['test-model'],
      log,
    });
    const done = await request(app).get(`/api/meetings/${id}`).set('Cookie', cookie);
    expect(done.body.meeting).toMatchObject({
      analysisStatus: 'done',
      decisions: [],
      actionItems: [],
    });
  });

  it('gives another user 404 on retry and does not queue a job', async () => {
    const id = await meeting();
    const bob = await signUp(app, 'Bob');
    const res = await request(app)
      .post(`/api/meetings/${id}/analyze`)
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', bob);
    expect(res.status).toBe(404);
    expect(jobs).toHaveLength(1);
  });

  it('keeps manually added items when re-analysis replaces AI results', async () => {
    const id = await meeting();
    await analyzeMeeting(jobs[0]!, { ai: fakeAi(valid), models: ['test-model'], log });
    await pool.query(
      `INSERT INTO action_items (meeting_id, user_id, text, origin, position)
       VALUES ($1, $2, 'Check the budget', 'manual', 1)`,
      [id, jobs[0]!.userId],
    );
    const retry = await request(app)
      .post(`/api/meetings/${id}/analyze`)
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', cookie);
    expect(retry.status).toBe(202);
    await analyzeMeeting(jobs[1]!, {
      ai: fakeAi({
        meeting_summary: '{"summary":"Updated summary"}',
        meeting_decisions: '{"decisions":[]}',
        meeting_action_items: '{"action_items":[]}',
      }),
      models: ['test-model'],
      log,
    });
    const res = await request(app).get(`/api/meetings/${id}`).set('Cookie', cookie);
    expect(res.body.meeting.summary).toBe('Updated summary');
    expect(res.body.meeting.decisions).toEqual([]);
    expect(res.body.meeting.actionItems).toMatchObject([
      { text: 'Check the budget', origin: 'manual' },
    ]);
  });

  it('saves the transcript and offers Retry when the queue is down', async () => {
    const offlineApp = createApp({
      analysisQueue: {
        enqueue: async () => {
          throw new Error('queue down');
        },
      },
    });
    const res = await request(offlineApp)
      .post('/api/meetings')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({ title: 'Plan', meetingDate: '2026-11-24', transcript: 'Ann: Hello' });
    expect(res.status).toBe(201);
    expect(res.body.meeting).toMatchObject({
      analysisStatus: 'failed',
      transcriptLines: [{ text: 'Hello' }],
    });
    expect(res.body.meeting.analysisError).toMatch(/try again/i);
  });
});
