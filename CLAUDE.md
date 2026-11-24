# CLAUDE.md

Instructions for Claude Code working in this repo. Read it fully before any task.

First written on 19 Nov 2026, before any code; kept up to date as the project changed.

## Project

**Debrief**: paste or upload a meeting transcript, get back a summary, decisions and action items
(what, who, when), then edit, track and tick them off. Built for the Luckybeard Launchpad 2027 tech
challenge.

Core idea: **the AI does the reading; the app makes the result trustworthy.** The reviewers will ask
me to explain, change and break this code live, so prefer clear code over clever code.

## Commands

```
npm run dev                 Postgres in Docker, migrations, then API (:3000) + web (:5173)
npm run docker:up           the whole stack in Docker (:8080)
npm test                    all tests (needs the local database: npm run db:up)
npm run typecheck           TypeScript, every workspace
npm run lint                ESLint
npm run format:check        Prettier
npm run db:generate         write a migration after changing schema.ts
npm run db:migrate          apply migrations locally
npm run db:seed             demo users Alice and Bob
npm run ai:eval             real AI on tricky transcripts (manual only, uses the OpenRouter key)
npm run deploy:cloudflare   build and upload the website
```

## Architecture

- **Monorepo** (npm workspaces): `apps/web` (React + Vite), `apps/api` (Express), `packages/shared`
  (Zod schemas, password rules, transcript parser used by both).
- **Live:** website on Cloudflare (static assets + `cloudflare/worker.js` forwards `/api/*`), API as
  a Docker container on Render, data in Postgres on Supabase. The browser only sees one address.
- **API layers:** `route → controller → service → repository`, one folder per feature in
  `apps/api/src/modules/`.
  - Controller: validate with Zod, call the service, reply. No SQL.
  - Service: business rules. No `req`/`res`.
  - Repository: the only database access. **Every query on user data filters by `userId`.**
- **AI:** `apps/api/src/modules/analysis/`. A pg-boss job runs three OpenRouter calls (summary,
  decisions, action items), then Zod, then post-checks, then saves.
- **Database:** Drizzle. Tables in `apps/api/src/db/schema.ts`, migrations in `apps/api/drizzle/`.

## How to work with me

1. **Plan first.** List the files you'll change and why, then wait for my "go".
2. **One small step at a time.** No multi-feature changes.
3. **Explain each step** in plain English: what each changed file does and any decision made.
4. **Ask, don't guess.** If two options are reasonable, stop and give me a short recommendation.
   Security, data and product decisions are mine.
5. **Done means green:** `typecheck`, `lint` and `test` pass. Fix failures before moving on.
6. **Never commit or push.** No `git commit`, `git push`, or anything else that changes git
   history or the remote. I review the changes and commit them myself. When a step is done, suggest
   a commit message: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`,
   `refactor:`), one logical change each.
7. **Update my AI log whenever I use you.** Every time you help (fix something, explain something,
   find why a test failed, or write code), add a dated entry to the **Log** section at the end of
   `docs/AI_LOG.md` (create the section if it's missing). Say what I asked for, what you did and
   what I decided or changed. Be accurate: if you wrote the code, say so. If something changes the
   summary at the top of the log (my workflow, guardrails or decisions), update that too.

## Code style

- TypeScript strict everywhere. No `any` without a comment saying why.
- Prefer standard, boring solutions. Add a library only if it clearly earns its place.
- Comment the **why**, not the what. Each file starts with a one-line summary.
- Styling with Tailwind and the tokens in `apps/web/src/styles/`; no one-off magic values.
- Accessible by default: labelled inputs, keyboard use, visible focus, reduced motion respected.

## Security: never break these

- **Never print, log, echo or commit any value from `.env`.** Only `.env.example` is committed.
- `docs/private/` is git-ignored and confidential; never copy the brief's text into the repo.
- The only database credential is `DATABASE_URL`. No Supabase Data API or Supabase keys.
- Passwords: argon2id. Session, reset and similar tokens: store only their hash. The Google refresh
  token: AES-256-GCM encrypted.
- Another user's data answers **404**, not 403. Every change request passes the origin check.
- Validate every request body, query and param with Zod on the server, even if the form already did.
- Uploads are checked by their contents, not just their name (UTF-8 text; real image bytes).

## AI rules: the heart of the app

- **AI output is untrusted input.** Validate with Zod; a wrong shape saves nothing, is logged as
  `invalid_output`, and the next model is tried.
- **Never invent owners or dates.** Post-checks: the quote must be on its line, the owner must be in
  the transcript, date words must be in the transcript. Otherwise clear the field and flag for review.
  An empty list is a valid answer; never pad it.
- The transcript is wrapped as data, never instructions. One call = one meeting from one user.
- Save the meeting before any AI call. Timeouts, retries and the model chain keep the app working
  when the AI is slow, down or out of quota.
- Bump `PROMPT_VERSION` whenever a prompt changes.

## Testing

- API: Vitest + Supertest. Web: Vitest + Testing Library (find elements by label and role).
- Tests use the local `debrief_test` database, **never Supabase**, and a **mocked AI**.
- Every important rule needs a test: isolation, auth, AI validation (good, broken, partial, empty,
  invented owner), uploads. For isolation, break the code on purpose and check the test fails.

## Gotchas

- **Never edit a migration that has already run.** Add a new one with `npm run db:generate`.
- TypeScript is pinned to 6.0 until typescript-eslint supports 7.
- Windows: jest-dom's matchers are registered in our own setup file because of a drive-letter
  case issue that loaded a second copy of Vitest.
- The dev server must stay on port 5173 (`strictPort`): Google sign-in and the origin check expect it.
- Google only redirects to addresses listed in the OAuth client; new hosts need both callback URLs.
- Render's free plan sleeps after 15 minutes; the first request takes about a minute.
- Rate limits are kept in memory: restart the API to reset them after local testing.
