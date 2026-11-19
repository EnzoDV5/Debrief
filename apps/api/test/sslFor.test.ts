import { describe, expect, it } from 'vitest';
import { closeDatabase } from './helpers';
import { sslFor } from '../src/db/client';
import { afterAll } from 'vitest';

afterAll(closeDatabase);

describe('sslFor', () => {
  it('uses verified SSL with the Supabase root certificate for Supabase hosts', () => {
    const ssl = sslFor(
      'postgresql://postgres.ref:pw@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
    );

    expect(ssl).toMatchObject({ rejectUnauthorized: true });
    expect((ssl as { ca: string }).ca).toContain('BEGIN CERTIFICATE');
  });

  it('uses no SSL for local Postgres (Docker, tests, CI)', () => {
    expect(sslFor('postgres://debrief:debrief@localhost:5432/debrief')).toBeUndefined();
    expect(sslFor('postgres://debrief:debrief@db:5432/debrief')).toBeUndefined();
  });

  it('does not treat a look-alike host as Supabase', () => {
    expect(sslFor('postgres://u:p@supabase.com.evil.example:5432/db')).toBeUndefined();
  });
});
