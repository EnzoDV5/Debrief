// Row-level security: the database itself blocks direct access.
import { afterAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/client';
import { closeDatabase } from './helpers';

afterAll(closeDatabase);

describe('row level security', () => {
  it('is enabled on every table in the public schema', async () => {
    const { rows } = await pool.query<{ table: string; rls: boolean }>(`
      SELECT c.relname AS table, c.relrowsecurity AS rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => !r.rls).map((r) => r.table)).toEqual([]);
  });
});
