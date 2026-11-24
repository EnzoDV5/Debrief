// Demo accounts so reviewers can log in straight away: Alice and Bob, each with an analysed meeting.
// Two users, because there is one role (a normal user) and two show that nobody can see the other's data.
//
// Safe to run again: it deletes and recreates ONLY these two accounts and everything they own.
// Nobody else's data is touched.
//
//   npm run db:seed            -> the DATABASE_URL database (your laptop)
//   npm run db:seed:supabase   -> Supabase (needs SUPABASE_DATABASE_URL in .env)
//
// The analysis below is written by hand, not by the AI, so the demo works even with no OpenRouter key.
// Every quote is looked up in the parsed transcript, so a wrong quote stops the seed instead of
// saving a card that points at the wrong line.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseTranscript, type SourceType, type TranscriptLine } from '@debrief/shared';
import { inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { hashPassword } from '../modules/auth/auth.service';
import { createPool, pool as defaultPool } from './client';
import * as schema from './schema';

// Public on purpose: these are demo accounts, listed in the README.
export const SEED_PASSWORD = 'Debrief-Demo-2026!';
export const SEED_USERS = [
  { email: 'alice@example.com', name: 'Alice Demo' },
  { email: 'bob@example.com', name: 'Bob Demo' },
] as const;

const FIXTURES = new URL('../../test/fixtures/transcripts/', import.meta.url);

async function loadTranscript(file: string, sourceType: SourceType) {
  const original = await readFile(new URL(file, FIXTURES), 'utf8');
  return { original, lines: parseTranscript(original, sourceType), sourceType };
}

// Finds the numbered line that contains this exact quote, like the post-checks do for AI output.
function lineOf(lines: TranscriptLine[], quote: string): number {
  const line = lines.find((l) => l.text.includes(quote));
  if (!line) throw new Error(`Seed quote not found in transcript: "${quote}"`);
  return line.n;
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

export async function seed(db: Db) {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const standup = await loadTranscript('clean-standup.txt', 'txt');
  const retro = await loadTranscript('no-actions-retro.md', 'md');

  await db.transaction(async (tx) => {
    // Hard delete the old demo accounts. ON DELETE CASCADE removes their sessions, photos,
    // projects, meetings, decisions, action items and AI runs with them.
    await tx.delete(schema.users).where(
      inArray(
        schema.users.email,
        SEED_USERS.map((u) => u.email),
      ),
    );

    const [alice, bob] = await tx
      .insert(schema.users)
      .values(SEED_USERS.map((u) => ({ ...u, passwordHash })))
      .returning();
    if (!alice || !bob) throw new Error('Could not create the demo users');

    // ---------- Alice: a clean standup, fully analysed ----------
    const [project] = await tx
      .insert(schema.projects)
      .values({ userId: alice.id, name: 'Product team' })
      .returning();

    const [aliceMeeting] = await tx
      .insert(schema.meetings)
      .values({
        userId: alice.id,
        projectId: project?.id ?? null,
        title: 'Weekly product sync',
        meetingDate: '2026-11-24',
        transcriptOriginal: standup.original,
        transcriptLines: standup.lines,
        sourceType: standup.sourceType,
        summary:
          'The team confirmed the onboarding release for Thursday, agreed to launch the three-tier pricing page after legal approved the wording, and planned fixes for a support backlog of password-reset tickets.',
        analysisStatus: 'done',
      })
      .returning();
    if (!aliceMeeting) throw new Error('Could not create Alice’s meeting');

    const owned = { meetingId: aliceMeeting.id, userId: alice.id };
    const L = (quote: string) => lineOf(standup.lines, quote);
    // The card's line number and the exact words it quotes from that line.
    const source = (quote: string) => ({ sourceLine: L(quote), sourceQuote: quote });

    const [pricingDecision] = await tx
      .insert(schema.decisions)
      .values([
        {
          ...owned,
          text: 'Launch the three-tier pricing page.',
          sourceLine: L('decision made: we launch the three-tier pricing page'),
          position: 0,
          origin: 'ai',
        },
        {
          ...owned,
          text: 'Move password reset emails to the new email provider.',
          sourceLine: L('move password reset emails to the new provider'),
          position: 1,
          origin: 'ai',
        },
      ])
      .returning();

    await tx.insert(schema.actionItems).values([
      {
        ...owned,
        text: 'Deploy the onboarding release to production after the 10am check.',
        owner: 'Pieter van Wyk',
        dueDate: '2026-11-26',
        dueDateText: 'Thursday 26 November',
        ...source("I'll deploy the onboarding release to production on Thursday 26 November"),
        position: 0,
        origin: 'ai',
      },
      {
        ...owned,
        text: 'Update the pricing page copy and send it to Thandi for review.',
        owner: 'Aisha Patel',
        dueDate: '2026-11-27',
        dueDateText: 'Friday 27 November',
        decisionId: pricingDecision?.id ?? null,
        ...source("I'll update the pricing page copy and send it to Thandi for review"),
        position: 1,
        origin: 'ai',
      },
      {
        ...owned,
        text: 'Move password reset emails to the new email provider.',
        owner: 'Pieter van Wyk',
        dueDate: '2026-12-02',
        dueDateText: 'Wednesday 2 December',
        status: 'in_progress',
        ...source(
          'Pieter, please move password reset emails to the new provider by Wednesday 2 December',
        ),
        position: 2,
        origin: 'ai',
      },
      {
        // Flagged on purpose, to show how an unclear date looks: the person decides, not the AI.
        ...owned,
        text: 'Write a help article on resetting passwords.',
        owner: 'Thandi Nkosi',
        dueDate: null,
        dueDateText: 'by the end of this week',
        needsReview: true,
        reviewReason: '“by the end of this week” doesn’t give an exact day',
        ...source("I'll write a help article on resetting passwords by the end of this week"),
        position: 3,
        origin: 'ai',
      },
    ]);

    // ---------- Bob: a retro with nothing to action (the empty state) ----------
    await tx.insert(schema.meetings).values({
      userId: bob.id,
      title: 'Sprint 14 retrospective',
      meetingDate: '2026-11-20',
      transcriptOriginal: retro.original,
      transcriptLines: retro.lines,
      sourceType: retro.sourceType,
      summary:
        'A positive retrospective: the review checklist sped up pull requests and pairing helped on the payments bug. Long standups and a half-day staging outage were raised; the outage cause (an expired certificate) is already fixed. No changes were agreed.',
      analysisStatus: 'done',
    });
  });
}

const isMain =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const toSupabase = process.argv.includes('--supabase');
  if (toSupabase && !env.SUPABASE_DATABASE_URL) {
    logger.error('SUPABASE_DATABASE_URL is not set in .env');
    process.exit(1);
  }
  const pool =
    toSupabase && env.SUPABASE_DATABASE_URL ? createPool(env.SUPABASE_DATABASE_URL) : defaultPool;
  const target = toSupabase ? 'Supabase' : 'DATABASE_URL';

  try {
    await seed(drizzle(pool, { schema }));
    logger.info(
      `Demo users ready (${target}): ${SEED_USERS.map((u) => u.email).join(', ')} / ${SEED_PASSWORD}`,
    );
  } catch (err) {
    logger.error({ err }, `Seeding failed (${target})`);
    process.exitCode = 1;
  } finally {
    await pool.end();
    if (pool !== defaultPool) await defaultPool.end();
  }
}
