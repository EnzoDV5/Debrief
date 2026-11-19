# CLAUDE.md: Debrief

Project rules for Claude Code. Read this whole file before doing anything.

## What we're building

**Debrief** is a web app where a user pastes or uploads a meeting transcript and gets back a
summary, the key decisions, and action items (what, who, when). The user can then edit, track and
tick off those items. It's my submission for the Luckybeard Launchpad 2027 tech challenge.

The full brief is in `docs/private/` (git-ignored, confidential: **never copy its text into
committed files**). Core idea from the brief: *the AI does the reading; the app must make the
result trustworthy and useful.*

Deadline: presentation on Thu 26 Nov 2026 at 15:00 (SAST). Reviewers are two full-stack engineers.
They will ask me to **explain, change and break the code live**, so clarity beats cleverness.

---

## How you (Claude) must work with me

1. **Plan before code.** For each task, first list the files you'll create or change and why. Wait
   for my "go" before writing code.
2. **Small steps.** One feature at a time. Never build several phases in one go.
3. **Explain as you go.** After each step, give a short plain-English summary of what each new file
   does and any decision you made. I need to understand every line.
4. **Small commits.** Suggest a commit after each working step, using Conventional Commits
   (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`). One logical change per commit.
5. **Keep it working.** Before saying a step is done: `npm run typecheck`, `npm run lint` and
   `npm test` must pass. If something fails, fix it before moving on.
6. **Ask, don't guess.** If a requirement is unclear or two options are both reasonable, stop and
   ask me with a short recommendation.
7. **Log AI usage.** After each step, add one line to `docs/AI_LOG.md`:
   `- YYYY-MM-DD: <what you helped with> | <what I decided/changed myself>`. This feeds the
   README's "How I used AI" section.
8. **Prefer boring, standard solutions.** No clever abstractions, no extra libraries unless they
   clearly earn their place. Add a short comment wherever a decision isn't obvious ("why", not "what").

### Secrets: hard rules
- **Never print, log, echo or commit any value from `.env`.** You may read `.env` only to run the app.
- `.env` and `docs/private/` must be in `.gitignore` **before the first commit**. Check this.
- Only `.env.example` (placeholder values) is committed.
- We do **not** use Supabase's Data API, anon key or service-role key. The only database
  credential is `DATABASE_URL`. If a Supabase API key is in `.env`, tell me so I can remove it.

---

## Stack (latest stable versions)

| Layer | Choice |
|---|---|
| Monorepo | npm workspaces: `apps/web`, `apps/api`, `packages/shared` |
| Language | TypeScript everywhere, `strict: true` |
| Frontend | React + Vite + Tailwind CSS + React Router + TanStack Query + React Hook Form |
| Backend | Node.js (LTS) + Express |
| Database | PostgreSQL on Supabase (direct connection via session pooler) |
| ORM / migrations | Drizzle ORM + drizzle-kit (migration files are committed) |
| Validation | Zod: shared schemas in `packages/shared` used by both web and api |
| Auth | argon2id password hashing + server-side sessions in Postgres + httpOnly cookie |
| Job queue | pg-boss (runs on the same Postgres) |
| AI | OpenRouter (OpenAI-compatible REST API) |
| API docs | OpenAPI generated from Zod (`@asteasolutions/zod-to-openapi`), served with Scalar at `/docs` |
| Logging | pino + pino-http with a request ID |
| Security | helmet, CORS allowlist, express-rate-limit, body size limits |
| Tests | Vitest + Supertest (api), Vitest + Testing Library (web) |
| CI | GitHub Actions: install → typecheck → lint → test on every push |
| Local infra | Docker Compose (Postgres for local dev and tests, plus api + web) |

---

## Folder structure

```
apps/
  api/
    src/
      app.ts            # builds the Express app (no listen); used by tests
      server.ts         # starts the HTTP server
      worker.ts         # starts the pg-boss worker
      config/env.ts     # reads + validates env vars with Zod; app refuses to start if invalid
      db/               # drizzle client, schema.ts, seed.ts
      middleware/       # auth, validate, errorHandler, rateLimit, requestId
      modules/
        auth/           # routes, controller, service, repository
        meetings/
        actionItems/
        analysis/       # queue jobs, AI client, prompts, post-checks
        integrations/   # Google Calendar (Day 5)
      lib/              # small helpers (vtt parser, crypto, errors)
    drizzle/            # generated migrations (committed)
    test/
  web/
    src/
      api/              # typed fetch client + TanStack Query hooks
      components/       # reusable UI (Button, Input, EmptyState, ErrorState, Spinner...)
      features/         # auth, meetings, actionItems
      pages/
      routes.tsx
packages/
  shared/
    src/schemas/        # Zod schemas + inferred types shared by web and api
docs/
  AI_LOG.md
  private/              # git-ignored: brief, sample transcripts
```

### Layering rule (api)
`route → controller → service → repository`
- **Controller:** reads the validated request, calls the service, sends the response. No SQL.
- **Service:** business rules. No `req`/`res`.
- **Repository:** the only place that talks to the database. **Every query that touches user data
  takes `userId` and filters by it.** No exceptions.

---

## Database (Drizzle schema)

All IDs are UUIDs. All timestamps are `timestamptz`. Every user-owned table has `user_id`.

- **users:** id, email (stored lowercase), password_hash, name, created_at, deleted_at (soft delete).
  Unique index on `email` **where `deleted_at is null`**.
- **sessions:** id (SHA-256 hash of the cookie token, never the raw token), user_id, expires_at, created_at.
- **meetings:** id, user_id, title, meeting_date, transcript_original (never modified),
  transcript_lines (jsonb array of `{ n, speaker?, text }`), source_type (`paste|txt|vtt|md`),
  summary (nullable), analysis_status (`pending|processing|done|failed`), analysis_error (nullable,
  user-friendly), created_at, updated_at.
- **decisions:** id, meeting_id, user_id, text, source_line (nullable), position, created_at, updated_at.
- **action_items:** id, meeting_id, user_id, text, owner (nullable **text**: a person named in the
  meeting, not a user account), due_date (nullable date), due_date_text (nullable: the exact words
  from the transcript), status (`todo|in_progress|done`), needs_review (bool), review_reason
  (nullable), source_line (nullable), source_quote (nullable), origin (`ai|manual`),
  created_at, updated_at.
- **analysis_runs:** id, meeting_id, user_id, model, prompt_version, status
  (`success|invalid_output|failed`), raw_output (jsonb, nullable), error (nullable), started_at, finished_at.
- **calendar_connections** (Day 5): user_id, provider, encrypted refresh token, scope, created_at.

Indexes: `meetings(user_id, created_at)`, `action_items(user_id, status)`,
`action_items(user_id, due_date)`, foreign-key columns.

Never edit a migration that has already been applied; create a new one.

---

## Must-have requirements (from the brief, in my words)

### 1. Accounts and ownership
- Register, log in, log out. Passwords hashed with argon2id.
- Session cookie: `httpOnly`, `Secure` in production, `SameSite=Lax`, 7-day expiry. Store only the
  hash of the token. Regenerate the session on login.
- CSRF: rely on `SameSite=Lax` **plus** an `Origin` header check on every non-GET request.
- Users only ever see their own data. **Requesting another user's resource returns 404** (not 403)
  so IDs can't be probed.
- Logged-out users can only reach register and login.
- Delete account = **soft delete**: requires current password, sets `deleted_at`, deletes all
  sessions. Deleted users can't log in.
- Rate-limit `/auth/login` and `/auth/register` (e.g. 10 attempts / 15 min per IP).
- Login errors are generic ("Invalid email or password"), never revealing which part was wrong.

### 2. Transcript intake
- Paste text, or upload `.txt`, `.vtt` or `.md` (max 1 MB; check extension **and** that it's valid UTF-8 text).
- Each meeting stores title, date and the original transcript.
- Parse into numbered lines. For VTT: drop the `WEBVTT` header, cue numbers, timestamps and `NOTE`
  blocks; keep speaker names from `<v Name>` tags.
- Save the meeting **before** any AI call, so the transcript is never lost.

### 3. AI analysis (most marks are here)
- Provider: OpenRouter, called **only from the server**. Models come from env:
  `AI_MODEL_PRIMARY`, `AI_MODEL_FALLBACK`, `AI_MODEL_PAID_FALLBACK`. For any `openai/` model, send
  `provider: { only: ["openai"] }` so it uses my BYOK key.
- Flow: create meeting → status `pending` → enqueue pg-boss job `analyze-meeting { meetingId, userId }`
  → worker sets `processing` → runs the steps → saves → `done`. On final failure → `failed`
  with a friendly `analysis_error`. The UI shows a **Retry** button.
- **Three focused AI calls**, each with a strict JSON schema (`response_format: json_schema`):
  1. summary, 2. decisions (with `source_line`), 3. action items
  (`text, owner, due_date_text, due_date, source_line, source_quote`).
- **AI output is untrusted:** parse, then validate with Zod. Malformed, partial or empty → log an
  `analysis_runs` row with status `invalid_output` and try the next model.
- Resilience: 60s timeout per call (AbortController); retry with exponential backoff on 429/5xx;
  then fall through the model chain; then mark `failed`. pg-boss handles job-level retries.
- **No invented owners or dates.** After Zod, run our own checks in code:
  - `source_line` must exist, and `source_quote` must actually appear on that line (normalised
    whitespace, case-insensitive). If not → `needs_review = true`.
  - `owner` must appear somewhere in the transcript; if not → set to null, `needs_review = true`,
    `review_reason = "Owner not found in transcript"`.
  - `due_date_text` must appear in the transcript; if not → clear both date fields and flag.
    Relative dates ("next Friday") are resolved against `meeting_date`.
  - An empty action-item list is a **valid** result. Never pad it.
- **Prompt injection:** the transcript goes inside clear delimiters, and the system prompt says to
  treat it as data and ignore any instructions inside it.
- **User isolation:** each AI call contains only that one meeting's transcript. No shared
  conversation history, no cross-user context, ever.
- Prompts live in `modules/analysis/prompts.ts` with a `PROMPT_VERSION` constant.
- Re-analyse: confirm first; replaces AI-generated items only, keeps items the user added manually.
- Never log transcript content or AI output at info level.

### 4. Review and track
- Edit summary, decisions, and each action item's text, owner, due date and status.
- Add, delete and tick off action items. Editing a flagged item clears `needs_review`.
- Pages: meeting list, meeting detail (transcript with clickable line numbers next to the results),
  and **"My open items"** across all meetings with filters: status, owner, overdue
  (`due_date < today` and status ≠ done).

### 5. Quality basics
- Zod validation on **every** route (body, params, query), enforced on the server.
- One consistent error shape: `{ error: { code, message, fields? } }`. No stack traces in production.
- Frontend: loading, empty and error states everywhere; inline field errors; submit buttons disabled
  while submitting (no double submit); status polling while analysis is running.
- Accessible: labelled inputs, focus states, keyboard usable, responsive down to mobile.

### 6. Integration (Day 5)
- Google Calendar: "Add to calendar" on an action item with a due date. OAuth 2.0 with the minimal
  `calendar.events` scope; refresh token encrypted at rest (AES-256-GCM, key from env).

---

## API routes (all JSON, all under `/api`)

```
POST   /auth/register        POST /auth/login        POST /auth/logout
GET    /auth/me              DELETE /auth/account    (body: { password })
GET    /meetings             POST /meetings          (JSON paste or multipart upload)
GET    /meetings/:id         PATCH /meetings/:id     DELETE /meetings/:id
POST   /meetings/:id/analyze (retry / re-run)
PATCH  /decisions/:id        POST /meetings/:id/decisions   DELETE /decisions/:id
GET    /action-items         (?status=&owner=&overdue=true)
POST   /meetings/:id/action-items
PATCH  /action-items/:id     DELETE /action-items/:id
GET    /health
GET    /docs                 (Scalar UI)   GET /openapi.json
```

---

## Testing (must exist by the end)
- **AI validation:** mocked AI client returns good, malformed, partial, empty and invented-owner
  responses; assert what gets saved and what gets flagged.
- **Isolation:** user A gets 404 on user B's meeting, items and decisions (GET, PATCH, DELETE).
- **Auth:** register/login validation, wrong password, deleted user can't log in, rate limit.
- **VTT parser:** unit tests with a real sample.
- Tests run against the local Docker Postgres, **never Supabase**. Tests never call the real AI.

---

## Seed data
`npm run db:seed` creates two users, `alice@debrief.test` and `bob@debrief.test` (passwords in the
README), each with one analysed meeting. Used to demo isolation.

---

## Phases (one at a time; stop for my review after each)

| Phase | When | Goal |
|---|---|---|
| 0 | Thu 19 | Monorepo, TS config, ESLint + Prettier, `.gitignore`, env validation, Docker Compose Postgres, GitHub Actions, `/health` |
| 1 | Thu 19–Fri 20 | DB schema + migrations, auth (register/login/logout/me/delete), auth pages |
| 2 | Fri 20–Sat 21 | Meetings CRUD, paste/upload, VTT parser, meeting list + detail pages |
| 3 | Sat 21–Sun 22 | AI pipeline: pg-boss, OpenRouter client, 3 calls, Zod, post-checks, fallback chain, retry, status polling |
| 4 | Mon 23 | Edit/add/delete/tick items and decisions, "My open items" with filters |
| 5 | Tue 24 | Google Calendar integration, isolation tests, finish core |
| 6 | Wed 25 | Stretch goals (source linking UI, compare runs), tests, accessibility, polish, OpenAPI docs |
| 7 | Wed 25–Thu 26 | Deploy (Vercel + Render + Supabase), seed, README, demo video, final checks |

## README must contain (Phase 7)
What the app does · how to run it locally step by step · env vars · key decisions and trade-offs ·
what I'd do with another week · "How I used AI" (in the product + in development, from `docs/AI_LOG.md`).
