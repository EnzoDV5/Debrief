// Applies any migrations that haven't run yet, then exits. Safe to run on every start:
// drizzle records applied migrations in its own table and skips them.
//
//   npm run db:migrate            → DATABASE_URL (local Docker Postgres; on Render, Supabase)
//   npm run db:migrate:supabase   → SUPABASE_DATABASE_URL, from a developer machine
//
// The Docker api runs the first form before starting the server.
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { createPool, MIGRATIONS_FOLDER, pool as defaultPool } from './client';

const toSupabase = process.argv.includes('--supabase');
if (toSupabase && !env.SUPABASE_DATABASE_URL) {
  logger.error('SUPABASE_DATABASE_URL is not set in .env');
  process.exit(1);
}

const pool =
  toSupabase && env.SUPABASE_DATABASE_URL ? createPool(env.SUPABASE_DATABASE_URL) : defaultPool;
const target = toSupabase ? 'Supabase' : 'DATABASE_URL';

try {
  await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  logger.info(`Database migrations are up to date (${target})`);
} catch (err) {
  logger.error({ err }, `Database migration failed (${target})`);
  process.exitCode = 1;
} finally {
  await pool.end();
  if (pool !== defaultPool) await defaultPool.end();
}
