<a id="top"></a>

<div align="center">

<img src="apps/web/public/favicon.svg" alt="Debrief logo: three lines of notes with a green tick dot" width="84" />

<h1>Debrief</h1>

<p><strong>The AI does the reading. The app makes it trustworthy.</strong></p>

<p>Paste or upload a meeting transcript and get back a summary, the decisions made and the action items:<br />what, who and when. Then edit them, track them and tick them off.</p>

<p>
  <a href="https://debrief.enzodv.workers.dev">
    <img src="https://img.shields.io/badge/VIEW_LIVE_SITE-2B36F5?style=for-the-badge&logoColor=white&labelColor=0B0D1A" alt="View the live site" height="42" />
  </a>
</p>

<p><a href="https://debrief.enzodv.workers.dev">debrief.enzodv.workers.dev</a></p>

<p>
  <a href="#demo-accounts"><strong>Demo accounts</strong></a>
  &nbsp;·&nbsp;
  <a href="#run-it-locally"><strong>Run it locally</strong></a>
  &nbsp;·&nbsp;
  <a href="#check-every-requirement"><strong>Check every requirement</strong></a>
  &nbsp;·&nbsp;
  <a href="#how-i-used-ai"><strong>How I used AI</strong></a>
</p>

[![React][React-shield]][React-url]
[![TypeScript][TS-shield]][TS-url]
[![Node.js][Node-shield]][Node-url]
[![Express][Express-shield]][Express-url]
[![PostgreSQL][Postgres-shield]][Postgres-url]
[![OpenRouter][OpenRouter-shield]][OpenRouter-url]
[![Docker][Docker-shield]][Docker-url]
[![License: MIT][License-shield]][License-url]

</div>

<!-- Screenshots: add images to docs/readme/ and show them here, like the Stack Studio README. -->

---

<details>
  <summary><strong>Contents</strong></summary>

- [What Debrief does](#what-debrief-does)
- [Demo accounts](#demo-accounts)
- [Check every requirement](#check-every-requirement)
- [Stretch goals I chose](#stretch-goals-i-chose)
- [Built with](#built-with)
- [How it works](#how-it-works)
- [Run it locally](#run-it-locally)
- [Environment variables](#environment-variables)
- [Key decisions and trade-offs](#key-decisions-and-trade-offs)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [With another week](#with-another-week)
- [How I used AI](#how-i-used-ai)
- [Project map](#project-map)

</details>

## What Debrief does

Teams forget what they agreed in meetings. Debrief turns a transcript into notes you can act on,
and shows its working so you never have to take the AI's word for it.

| Step           | What happens                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Add**        | Paste text or upload a `.txt`, `.vtt` or `.md` file. The meeting (title, date, original transcript) is saved **before** any AI call, so nothing is ever lost.          |
| **Analyse**    | A background job asks the AI for a summary, the decisions and the action items, in three separate calls. Every answer is checked against a schema and the transcript.  |
| **Check**      | Every decision and action item links to the transcript line it came from. Click one and the line is highlighted. Anything the AI wasn't sure of is flagged for review. |
| **Edit**       | Change anything: the summary, decisions, and each item's text, owner, due date and status. Add, delete and tick off items. Fix a speaker's name or a transcript line.  |
| **Track**      | **Actions** lists every item across all meetings, filtered by status, owner and overdue.                                                                               |
| **Go further** | Ask a question about one meeting and get an answer with line references, search everything, group meetings into projects, and send action items to Google Calendar.    |

The app keeps working when the AI is slow, down or out of free quota: the transcript stays saved,
the meeting shows a plain-English reason, and **Retry analysis** runs the analysis again.

## Demo accounts

Log in at **[debrief.enzodv.workers.dev](https://debrief.enzodv.workers.dev)**, or on your own
machine after [running it locally](#run-it-locally).

There is one role (a normal user), so there are two demo users. Two show that nobody can see the
other's data.

| Email               | Password             | What's there                                                                                             |
| ------------------- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| `alice@example.com` | `Debrief-Demo-2026!` | An analysed product sync: 2 decisions, 4 action items, one flagged for review because its date is vague. |
| `bob@example.com`   | `Debrief-Demo-2026!` | A retrospective with **no** action items, to show the empty state.                                       |

These are demo accounts, public on purpose. `npm run db:seed` creates them (see
[Run it locally](#run-it-locally)). It is safe to run again: it only replaces these two accounts.

> The live API runs on Render's free plan, which sleeps after 15 minutes. The first request after a
> quiet spell can take about a minute; after that it is quick.

Sample transcripts to upload are in
[`apps/api/test/fixtures/transcripts/`](apps/api/test/fixtures/transcripts/): a clean standup, a
messy WebVTT export, a meeting with no actions, a prompt-injection attempt and more.

## Check every requirement

How to try each part of the brief in the app, without reading the code.

| Requirement                        | How to check it                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register and log in                | **Create account** on the login page. Passwords need 12+ characters; errors show next to the field and the button can't be pressed twice.                                                               |
| Only your own data                 | Log in as Alice, copy a meeting URL, log in as Bob and open it: **not found**. Changing any ID in the URL or API answers `404`.                                                                         |
| Logged-out visitors can do nothing | Open any app page while logged out: you are sent to the login page. Without a session, the API only allows register, log in, password reset and the health check; everything else answers `401`.        |
| Delete your account (soft delete)  | **Account → Delete account**, then confirm your password. The account is marked deleted, all its sessions end, and it can't log in again. The rows stay in the database.                                |
| Paste or upload a transcript       | **New meeting**: paste, or drop a `.txt`, `.vtt` or `.md` file. The title comes from the file name and the date from the transcript when it has one; you can change both.                               |
| Summary, decisions, action items   | Open a meeting. The analysis runs in the background; the page updates and notifies you when it's done.                                                                                                  |
| AI output is untrusted             | Shown by the tests (`apps/api/test/analysis.test.ts`, `postChecks.test.ts`): broken JSON, wrong shapes, partial and empty answers save nothing, and the next model is tried.                            |
| Works when the AI fails            | The meeting shows why it failed (busy, out of quota, timed out) and a **Retry analysis** button. The transcript is always there.                                                                        |
| No invented owners or dates        | An owner must be someone in the transcript, and a date must come from words in it. Otherwise the field is left blank and the item is **flagged for review** with the reason.                            |
| AI context isolation               | Each AI call carries one meeting from one user. Ask this meeting only sees that meeting.                                                                                                                |
| Edit everything the AI made        | **Edit summary** on a meeting, or open any decision or action item to edit it. Status is To do, In progress or Done.                                                                                    |
| Add, delete and tick off items     | Select or click words in the transcript and turn them into an action item (it keeps that line as its source), or use **Add task** on a decision. Delete from the item; tick its circle to mark it done. |
| Meeting list and detail page       | The sidebar lists every meeting (pin, reorder, archive, group into projects); click one for its page.                                                                                                   |
| "My open action items"             | **Actions** in the sidebar, with filters for status, owner (or unassigned) and overdue.                                                                                                                 |
| Validation enforced on the server  | Every body, query and URL parameter is checked with Zod on the API, even when the form already checked it.                                                                                              |
| Loading, empty and error states    | Skeletons while loading, an empty state for a meeting with nothing to action (Bob), and clear errors with a way forward.                                                                                |
| No secrets in the repo             | Only [`.env.example`](.env.example) is committed. Live secrets live in Render's dashboard.                                                                                                              |
| Schema and migrations              | [`apps/api/src/db/schema.ts`](apps/api/src/db/schema.ts) and the SQL migrations in [`apps/api/drizzle/`](apps/api/drizzle/).                                                                            |
| Seed users                         | [Demo accounts](#demo-accounts).                                                                                                                                                                        |

## Stretch goals I chose

| Stretch goal                 | What I built                                                                                                                                                                                                       | Why                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Source linking**           | Every decision and action item stores its transcript line and the exact words it quotes. Click a card and the line lights up; the quote is checked on save.                                                        | It's the most direct way to make AI output trustworthy: you can check every card in one click.                                             |
| **Integration**              | Google Calendar: connect once, then add or update an action item as an event on its due date.                                                                                                                      | Due dates are the part of an action item people forget. OAuth with PKCE, a narrow `calendar.events` scope, and an encrypted refresh token. |
| **Automated tests**          | 457 tests: 313 API tests against a real Postgres with the AI mocked, and 144 web tests with Testing Library.                                                                                                       | The brief's important rules (isolation, auth, AI validation) should be proven, not just claimed.                                           |
| **Infrastructure**           | `npm run docker:up` starts Postgres, the API and the website with one command. CI builds both images on every push.                                                                                                | Easy for anyone to run, and the same container runs in production.                                                                         |
| **Accessibility and mobile** | Labelled inputs, keyboard use everywhere, visible focus, a skip link, reduced motion respected, light and dark themes, and a layout that works on a phone.                                                         | People read meeting notes on their phone, and the app should work for everyone.                                                            |
| **My own ideas**             | **Ask this meeting** (answers with line references), global search, projects, Google sign-in, forgot password, decisions linked to the tasks that carry them out, speaker and line editing, and `npm run ai:eval`. | Each one makes the notes more useful after the meeting, or makes the AI easier to trust and test.                                          |

## Built with

| Layer           | Tools                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Website**     | [![React][React-shield]][React-url] [![TypeScript][TS-shield]][TS-url] [![Vite][Vite-shield]][Vite-url] [![Tailwind CSS][Tailwind-shield]][Tailwind-url] |
| **API**         | [![Node.js][Node-shield]][Node-url] [![Express][Express-shield]][Express-url] [![Zod][Zod-shield]][Zod-url]                                              |
| **Database**    | [![PostgreSQL][Postgres-shield]][Postgres-url] [![Drizzle][Drizzle-shield]][Drizzle-url] [![Supabase][Supabase-shield]][Supabase-url]                    |
| **AI**          | [![OpenRouter][OpenRouter-shield]][OpenRouter-url]                                                                                                       |
| **Integration** | [![Google Calendar][GCal-shield]][GCal-url]                                                                                                              |
| **Hosting**     | [![Cloudflare][Cloudflare-shield]][Cloudflare-url] [![Render][Render-shield]][Render-url] [![Docker][Docker-shield]][Docker-url]                         |
| **Testing**     | [![Vitest][Vitest-shield]][Vitest-url] [![GitHub Actions][GHA-shield]][GHA-url]                                                                          |
| **AI helper**   | [![Claude Code][Claude-shield]][Claude-url]                                                                                                              |

## How it works

```text
 Browser ──► Cloudflare (website + /api/* forwarder) ──► Render: Express API ──► Supabase Postgres
                                                              │
                                                              └─ pg-boss job ──► OpenRouter (3 calls)
```

- **One address for the browser.** Cloudflare serves the website and forwards `/api/*` to the API,
  so the session cookie stays first-party and there is no CORS to get wrong.
- **API layers:** `route → controller → service → repository`, one folder per feature in
  [`apps/api/src/modules/`](apps/api/src/modules/). Only repositories touch the database, and
  every query on user data filters by the logged-in user's ID.
- **Shared rules:** [`packages/shared`](packages/shared/) holds the Zod schemas, the password rules
  and the transcript parser, used by both the website and the API.

### The analysis pipeline

1. **Save first.** The meeting and its parsed, numbered transcript lines are saved before any AI call.
2. **Queue it.** A [pg-boss](https://github.com/timgit/pg-boss) job (stored in Postgres, so no
   extra service) picks it up.
3. **Three small calls, not one big prompt.** Summary, then decisions, then action items. Each asks
   for a JSON schema, so free models have an easier, smaller job.
4. **Validate.** Each answer must pass its Zod schema. A wrong shape saves nothing, is logged as
   `invalid_output`, and the next model in the chain is tried.
5. **Check against the transcript.** The quote must be on its line, the owner must be in the
   transcript, and date words must be there too. Words like "next Friday" become a real date counted
   from the meeting date. Anything that fails is cleared and flagged for review, never guessed.
6. **Save, or explain.** Results are saved in one go. If every model fails, the meeting shows a
   plain-English reason and **Retry analysis**.

Every attempt is recorded in `analysis_runs` (model, prompt version, outcome), and
`PROMPT_VERSION` changes whenever a prompt does.

<details>
  <summary><strong>API routes</strong></summary>

Every route is under `/api`. All need a session except where marked.

| Method                        | Route                                                   | Purpose                                     |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| `GET`                         | `/health`                                               | Health check (no session)                   |
| `POST`                        | `/auth/register`, `/auth/login`                         | Create an account, log in (no session)      |
| `POST`                        | `/auth/forgot-password`, `/auth/reset-password`         | Password reset by email (no session)        |
| `GET`                         | `/auth/google/start`                                    | Sign in with Google (no session)            |
| `POST`                        | `/auth/logout`                                          | Log out                                     |
| `GET` `PATCH`                 | `/auth/me`                                              | Your profile                                |
| `DELETE`                      | `/auth/account`                                         | Delete your account (soft delete)           |
| `GET` `PUT` `DELETE`          | `/auth/me/avatar`                                       | Profile photo                               |
| `GET` `POST`                  | `/meetings`                                             | List meetings; create one (paste or upload) |
| `GET` `PATCH` `DELETE`        | `/meetings/:id`                                         | One meeting: read, edit, delete             |
| `POST`                        | `/meetings/:id/analyze`                                 | Run or retry the analysis                   |
| `POST`                        | `/meetings/:id/ask`                                     | Ask this meeting a question                 |
| `PATCH`                       | `/meetings/:id/lines/:n`                                | Fix a transcript line or speaker            |
| `POST`                        | `/meetings/:id/action-items`, `/meetings/:id/decisions` | Add an item or decision                     |
| `GET`                         | `/action-items`                                         | Every action item, with filters             |
| `PATCH` `DELETE`              | `/action-items/:id`, `/decisions/:id`                   | Edit or delete one                          |
| `POST`                        | `/action-items/:id/calendar`                            | Add or update its Google Calendar event     |
| `GET` `DELETE`                | `/integrations/google`                                  | Calendar connection status; disconnect      |
| `GET` `POST` `PATCH` `DELETE` | `/projects`                                             | Group meetings into projects                |
| `GET`                         | `/search`                                               | Search meetings, decisions and action items |

</details>

## Run it locally

You need **Node.js 24** and **Docker Desktop** (for Postgres).

```bash
# 1. Get the code and install
git clone https://github.com/EnzoDV5/Debrief.git
cd Debrief
npm ci

# 2. Create your .env (on Windows PowerShell: copy .env.example .env)
cp .env.example .env

# 3. Start Postgres in Docker, run the migrations, then the API (:3000) and website (:5173)
npm run dev

# 4. In a second terminal, add the demo users
npm run db:seed
```

Open **http://localhost:5173** and log in as `alice@example.com` / `Debrief-Demo-2026!`.

The app runs without any keys: the demo meetings are already analysed. To analyse your own
transcripts, put a free [OpenRouter](https://openrouter.ai/) key in `OPENROUTER_API_KEY`. Google
and EmailJS are optional; without them, those buttons are hidden.

### Or run everything in Docker

```bash
npm run docker:up                                              # Postgres, API and website
docker compose exec api node --import tsx src/db/seed.ts       # demo users
```

Open **http://localhost:8080**. Stop it with `npm run docker:down`.

### Useful commands

| Command                | What it does                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`          | Postgres in Docker, migrations, then the API and website with live reload     |
| `npm run docker:up`    | The whole stack in Docker on port 8080                                        |
| `npm run db:seed`      | Create (or reset) the demo users                                              |
| `npm test`             | Every test (needs the local database: `npm run db:up`)                        |
| `npm run typecheck`    | TypeScript, every workspace                                                   |
| `npm run lint`         | ESLint                                                                        |
| `npm run format:check` | Prettier                                                                      |
| `npm run db:generate`  | Write a new migration after changing `schema.ts`                              |
| `npm run db:migrate`   | Apply migrations                                                              |
| `npm run ai:eval`      | Run the real AI on tricky transcripts and report pass or fail (uses your key) |

## Environment variables

Copy [`.env.example`](.env.example) to `.env`. The API checks every value on startup and stops with
a clear message if one is wrong. Only `.env.example` is committed.

| Variable                                          | Needed?      | Purpose                                                                         |
| ------------------------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| `DATABASE_URL`                                    | Yes          | Postgres. The default points at the Docker database.                            |
| `TEST_DATABASE_URL`                               | For tests    | The local `debrief_test` database. Tests never touch Supabase.                  |
| `WEB_ORIGIN`                                      | Yes          | The website's address. Only this origin may send changes (CSRF check).          |
| `PORT`, `NODE_ENV`, `LOG_LEVEL`, `TRUST_PROXY`    | Defaults     | Server settings.                                                                |
| `OPENROUTER_API_KEY`                              | For AI       | Your OpenRouter key. Without it, meetings save but can't be analysed.           |
| `AI_MODEL_PRIMARY`, `AI_MODEL_FALLBACK`           | Optional     | Model IDs tried in order. Defaults to free models.                              |
| `AI_MODEL_PAID_FALLBACK`                          | Optional     | A last-resort paid model. Leave empty to stay free.                             |
| `APP_URL`                                         | Optional     | Sent to OpenRouter to identify the app. Defaults to `WEB_ORIGIN`.               |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`        | Optional     | Google Calendar and Sign in with Google.                                        |
| `GOOGLE_REDIRECT_URI`, `GOOGLE_AUTH_REDIRECT_URI` | Optional     | Override the callback URLs (by default built from `WEB_ORIGIN`).                |
| `ENCRYPTION_KEY`                                  | For Calendar | 32 random bytes (base64) that encrypt Google refresh tokens.                    |
| `EMAILJS_*`                                       | Optional     | Forgot-password and welcome emails. Without them, "Forgot password?" is hidden. |
| `SUPABASE_DATABASE_URL`                           | Optional     | Only for `npm run db:migrate:supabase` and `npm run db:seed:supabase`.          |

## Key decisions and trade-offs

| Decision                                       | Why                                                                                                                                | Trade-off                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Sessions in Postgres, not JWTs**             | A session can be ended at once: logout, password reset and account deletion log out every device. Only the token's hash is stored. | One database lookup per request.                                                                           |
| **Forward `/api` through the website's host**  | Cookies stay same-site and there's no CORS. Claude flagged the cross-site cookie risk; I chose this fix.                           | An extra hop through Cloudflare.                                                                           |
| **Three AI calls instead of one prompt**       | Smaller jobs suit free models, each step has its own schema, and one failed step doesn't hide the others' problems.                | Three times the calls, so more exposure to free-tier rate limits (handled by retries and the model chain). |
| **Check, don't trust**                         | Zod first, then post-checks against the transcript. An empty list is a valid answer and is never padded.                           | Some true items get flagged for review when the AI paraphrases a quote too loosely.                        |
| **Flag instead of guess**                      | A vague owner or date is cleared and flagged with a reason, so a person decides.                                                   | More items to review on messy transcripts.                                                                 |
| **Keep the transcript unchanged as evidence**  | Every card points at the original words. Edits to a line or speaker are explicit and stored.                                       | I changed my mind on this: it's stricter than letting the AI tidy the transcript.                          |
| **Background job queue in Postgres (pg-boss)** | Analysis survives restarts and slow models without adding Redis.                                                                   | Postgres does a little more work.                                                                          |
| **Free OpenRouter models with fallbacks**      | Costs nothing; the chain moves on when a model is busy, broken or out of quota.                                                    | Free models are slower and less consistent, so the checks matter more.                                     |
| **`404` for someone else's data, not `403`**   | Doesn't reveal that the record exists.                                                                                             | None worth noting.                                                                                         |
| **Plain Postgres on Supabase, Data API off**   | One credential (`DATABASE_URL`) and nothing else exposed. Row level security is on as a second wall.                               | No Supabase extras (auth, storage, realtime).                                                              |
| **Website on Cloudflare, API on Render**       | Netlify's free credits ran out; Cloudflare's free plan serves the site and the forwarder.                                          | Render's free plan sleeps after 15 minutes, so the first request is slow.                                  |
| **Profile photos in Postgres**                 | They're small (resized in the browser, checked by their bytes on the server), so no storage bucket is needed.                      | Wouldn't scale to large files.                                                                             |
| **Own date picker, not a library**             | I can explain and change every line.                                                                                               | More code to maintain.                                                                                     |
| **Rate limits in memory**                      | Simple, and enough for one API instance. Only failed logins count.                                                                 | They reset on restart and wouldn't be shared across several instances.                                     |

## Security

- **Passwords:** argon2id, at least 12 characters, with a strength meter. Login errors never say
  whether the email exists, and neither does "forgot password".
- **Sessions:** random tokens in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production),
  7 days. Only a hash is stored. A new session on every login.
- **Isolation:** every query filters by user ID; another user's data answers `404`. Row level
  security is on in Postgres, and `rls.test.ts` proves direct access is blocked.
- **Requests:** Zod on every body, query and parameter; an origin check on every change; rate limits
  on login, registration, password reset and Ask; Helmet headers.
- **Uploads:** checked by content, not name: transcripts must be UTF-8 text, photos must be real
  image bytes.
- **Secrets:** never in the repo. The Google refresh token is encrypted with AES-256-GCM.
- **AI:** the transcript is wrapped as data, never instructions (see `prompt-injection.txt` and
  `speaker-injection.vtt`). One call holds one meeting from one user.

## Testing

```bash
npm run db:up    # local Postgres (creates the debrief_test database)
npm test         # 313 API tests + 144 web tests
```

- **API:** Vitest and Supertest against a real local Postgres, with the AI mocked. Covers isolation,
  auth, sessions, rate limits, uploads, the analysis pipeline (good, broken, partial, empty and
  invented-owner answers), the queue, Calendar, password reset and the demo seed.
- **Isolation tests were broken on purpose** (mutation testing) to check that they really fail.
- **Website:** Vitest and Testing Library, finding elements by label and role.
- **Real AI:** `npm run ai:eval` runs every sample transcript through the real models and the real
  checks, and reports pass or fail per scenario. It's manual because it uses the OpenRouter quota.
- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs formatting, types, lint, a
  check that migrations match the schema, every test, the build, `npm audit` and both Docker builds
  on every push.

## Deployment

| Part     | Where                                                                                | How                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Website  | Cloudflare Workers: [debrief.enzodv.workers.dev](https://debrief.enzodv.workers.dev) | `npm run deploy:cloudflare` builds the site and uploads it with [`cloudflare/worker.js`](cloudflare/worker.js), which forwards `/api/*`. |
| API      | Render (Docker, free)                                                                | [`render.yaml`](render.yaml). Runs migrations on start, then the server. Secrets are set in Render's dashboard.                          |
| Database | Supabase Postgres                                                                    | Migrations with `npm run db:migrate:supabase`; demo users with `npm run db:seed:supabase`.                                               |

Google only redirects to addresses listed in the OAuth client, so a new host needs both callback
URLs added there (they're listed in `.env.example`).

## With another week

### Transcripts that arrive on their own

Today someone has to download a meeting's transcript and upload it. With another week, I'd connect
Debrief to the meeting tools teams already use, so the transcript is fetched and summarised
automatically after the meeting ends.

1. **Connect once.** Google Meet first: Debrief already connects to Google for sign-in and Calendar.
   Then Zoom and Microsoft Teams, which offer their transcripts through their APIs too.
2. **Fetch it when the meeting ends.** A background job on the existing pg-boss queue picks up the
   new transcript. Zoom and Teams provide `.vtt` files, which Debrief already reads.
3. **Analyse it as usual.** The title and date come from the calendar event, and the transcript goes
   through the same pipeline: the schema, the transcript checks and the review flags.
4. **The user stays in control.** They choose which meetings are imported (for example, only ones
   they organise). Upload stays for everyone else, such as Google Meet users without a Workspace plan
   that records transcripts.

### Smaller things after that

- **Reminders:** a pg-boss job that emails owners the day before an item is due.
- **Compare runs:** analyse a meeting again with another model and show both results side by side.
  Every run is already stored in `analysis_runs`.
- **Shareable read-only links** that expire and can be revoked.
- **End-to-end tests** in a real browser (Playwright) for the main journeys.

## How I used AI

### AI in the product

- **Analysis:** OpenRouter free models produce the summary, decisions and action items in three
  structured calls, each checked by Zod and then against the transcript. The AI never decides an
  owner or a date on its own: if the transcript doesn't say, the field is blank and flagged.
- **Ask this meeting:** answers questions about one meeting using only its transcript, and returns
  the lines it used so you can check them. If the answer isn't there, it says so.
- **Resilience:** timeouts, retries with back-off, a model chain, clear messages and Retry, so the
  app is still useful when the AI is not.

### AI in building it

I used **Claude Code** when I got stuck, as a helper, not as the author: it didn't write the app for
me. I owned the plan, the decisions and the code that went in. I used it for four things:

- **Fixing what was broken:** when a formula, a query or the structure of a piece of code wasn't
  working, it helped me find why and fix it.
- **Explaining what I didn't understand:** a library, an error message or a pattern, until I could explain it myself.
- **Failing tests:** when a test failed, it found the cause and explained it, so I understood what had
  gone wrong before fixing it.
- **Code I reviewed:** when it did write code, I reviewed it line by line before it went in, and
  changed or rejected what I didn't agree with.

How I kept it in check:

- **Rules first.** Before any code I wrote [`CLAUDE.md`](CLAUDE.md): the stack, the structure, the
  security rules and how it must work with me (plan first, wait for my go, one small step, done means
  green).
- **Decisions stayed mine:** security, data, product and hosting choices. It could suggest; I chose.
- **I checked the work:** type checks, lint and tests on every step, plus testing by hand on desktop
  and phone. I found and reported bugs such as a due date landing on the wrong Friday.
- **Secrets never reached it.** It was told never to print, log or commit any `.env` value, and I
  entered every live secret myself.

Commits it contributed to are marked `Co-Authored-By: Claude`. The full story, including what I'd do
differently, is in [`docs/AI_LOG.md`](docs/AI_LOG.md).

## Project map

```text
apps/
  web/                React website
    src/pages/          One file per route
    src/features/       Auth, meetings, action items, integrations
    src/components/     Layout and UI building blocks (Button, Dialog, DatePicker…)
    src/styles/         Design tokens and base styles
  api/                Express API
    src/modules/        One folder per feature: route → controller → service → repository
    src/db/             Schema, migrations runner, demo seed
    drizzle/            SQL migrations
    scripts/aiEval/     Real-AI stress tests
    test/               API tests and sample transcripts
packages/shared/      Zod schemas, password rules and transcript parser used by both apps
cloudflare/           The Worker that serves the site and forwards /api
docker/               Postgres setup for local dev and tests
docs/                 AI log
```

---

<div align="center">
  <p><strong>Debrief</strong> · Enzo De Vittorio · 2026</p>
  <p><a href="#top">Back to top ↑</a></p>
</div>

<!-- Stack and tool logos (shields.io + Simple Icons) -->

[React-shield]: https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://react.dev
[TS-shield]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[TS-url]: https://www.typescriptlang.org
[Vite-shield]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vite.dev
[Tailwind-shield]: https://img.shields.io/badge/Tailwind_CSS_v4-0B1120?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8
[Tailwind-url]: https://tailwindcss.com
[Node-shield]: https://img.shields.io/badge/Node.js_24-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white
[Node-url]: https://nodejs.org
[Express-shield]: https://img.shields.io/badge/Express_5-000000?style=for-the-badge&logo=express&logoColor=white
[Express-url]: https://expressjs.com
[Zod-shield]: https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white
[Zod-url]: https://zod.dev
[Postgres-shield]: https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white
[Postgres-url]: https://www.postgresql.org
[Drizzle-shield]: https://img.shields.io/badge/Drizzle_ORM-121212?style=for-the-badge&logo=drizzle&logoColor=C5F74F
[Drizzle-url]: https://orm.drizzle.team
[Supabase-shield]: https://img.shields.io/badge/Supabase-1C1C1C?style=for-the-badge&logo=supabase&logoColor=3ECF8E
[Supabase-url]: https://supabase.com
[OpenRouter-shield]: https://img.shields.io/badge/OpenRouter-6566F1?style=for-the-badge&logo=openrouter&logoColor=white
[OpenRouter-url]: https://openrouter.ai
[GCal-shield]: https://img.shields.io/badge/Google_Calendar-4285F4?style=for-the-badge&logo=googlecalendar&logoColor=white
[GCal-url]: https://developers.google.com/calendar
[Cloudflare-shield]: https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white
[Cloudflare-url]: https://workers.cloudflare.com
[Render-shield]: https://img.shields.io/badge/Render-000000?style=for-the-badge&logo=render&logoColor=white
[Render-url]: https://render.com
[Docker-shield]: https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white
[Docker-url]: https://www.docker.com
[Vitest-shield]: https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white
[Vitest-url]: https://vitest.dev
[GHA-shield]: https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white
[GHA-url]: https://github.com/features/actions
[Claude-shield]: https://img.shields.io/badge/Claude_Code-D97757?style=for-the-badge&logo=claude&logoColor=white
[Claude-url]: https://claude.com/claude-code
[License-shield]: https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge
[License-url]: ./LICENSE
