// Opens the Postgres connection (with Supabase SSL when needed) and hands out the Drizzle client.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

const SUPABASE_CA_PATH = fileURLToPath(
  new URL('../../certs/supabase-root-2021-ca.crt', import.meta.url),
);

export function sslFor(connectionString: string): PoolConfig['ssl'] {
  const { hostname } = new URL(connectionString);
  if (!hostname.endsWith('.supabase.com')) return undefined;
  return { ca: readFileSync(SUPABASE_CA_PATH, 'utf8'), rejectUnauthorized: true };
}

export function createPool(connectionString: string) {
  return new Pool({
    connectionString,
    ssl: sslFor(connectionString),
    max: 10,
    // Without this an unreachable database hangs startup forever with nothing in the logs.
    connectionTimeoutMillis: 15_000,
  });
}

export const pool = createPool(env.DATABASE_URL);

export const db = drizzle(pool, { schema });
export type Db = typeof db;

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));
