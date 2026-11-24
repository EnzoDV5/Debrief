# How I used AI to build Debrief

I used **Claude Code** as a pair programmer, the way many teams now use AI coding agents: I owned the
plan, the decisions and the checking; the agent did much of the typing, in small reviewed steps.
Every commit it helped with is marked `Co-Authored-By: Claude` in the git history.

## My workflow

1. **Rules before code.** On day one, before any code, I wrote `CLAUDE.md`: the stack, the folder
   structure, the security rules and how the agent must work with me.
2. **Plan, then approve.** For every feature, Claude first listed the files it would change and why.
   Nothing was written until I said go.
3. **One small step at a time**, each with a plain-English explanation of every new file, so I
   understood the code before moving on.
4. **Quality gates.** A step only counted as done when type checks, lint and tests passed. CI runs
   the same checks (plus a migration check, an audit and the Docker builds) on every push.
5. **I tested by hand** in the browser after each step, on desktop and phone, and reported what was
   wrong.
6. **A log of every step**: what the AI did and what I decided (this file).

## Guardrails I set

- **Secrets never reach the AI or the repo.** The agent was told never to print, log or commit any
  value from `.env`. I entered every live secret into Render's dashboard myself.
- **The agent never decides security or data rules.** It could suggest options; I chose.
- **Tests that prove the important rules**, including breaking the code on purpose to check that the
  isolation tests really fail (mutation testing).
- **Explainable over clever.** I chose our own date picker over a library so I can explain and change
  every line.

## Decisions that were mine

- **Architecture:** forward `/api` through the website's host so cookies stay same-site (after Claude
  flagged the cross-site cookie risk); sessions in Postgres instead of JWTs; plain Postgres on
  Supabase with the Data API off.
- **Security:** 12+ character passwords, generic login errors, rate limits counting only failed
  logins, row level security on before connecting Supabase, verified email only for Google account
  linking, a "forgot password" answer that never reveals whether an account exists.
- **AI behaviour:** a free model chain with fallbacks; nothing saved unless it passes the schema and
  the transcript checks; the AI never guesses owners, dates or speakers.
- **Product:** Google Calendar as the integration; keep the transcript unchanged as the evidence for
  every card (I changed my mind on this after weighing it); link tasks to the decisions they carry
  out; block renaming and archiving while a meeting is being analysed.
- **Hosting:** when Netlify's free credits ran out, move the website to Cloudflare, but keep the
  database on Supabase rather than rewrite the schema for Cloudflare D1. Store small profile photos in
  Postgres instead of adding a bucket.

## What I set up and did myself

- Created and configured **Supabase, Render, Cloudflare, the Google Cloud OAuth client, EmailJS and
  OpenRouter**, and registered the Google redirect addresses.
- **Found bugs by testing**: a due date resolving to the wrong Friday on the live site, archiving
  during an analysis breaking it, a misplaced text cursor in pop-ups, clipped highlights, the page
  bouncing on Mac.
- Set the **design direction** from my portfolio and Stack Studio's style.
- **Studied the whole codebase** so I can explain, change and break any part of it.

## Where AI helped most

- Writing code from a clear plan, especially UI, tests and repetitive changes.
- Debugging: tracing a flaky Windows test to a drive-letter issue, and finding why Google sign-in
  failed (missing redirect addresses).
- Pointing out risks I hadn't thought of, like the cross-site cookie problem.

## What I'd do differently next time

- **Keep commits small to the end.** My first days have small commits; the last days have bigger ones.
- **Write the README and seed data earlier**, not at the end.
- **Write tests for each rule before the feature**, not alongside it.

## Short timeline

- **19 Nov:** rules and plan; foundations, CI and Docker; accounts; meetings and uploads; Supabase;
  the AI pipeline; Google Calendar.
- **20 Nov:** Ask this meeting; Google sign-in; forgot password; first live deploy; design system.
- **21 Nov:** CI hardening; `npm run ai:eval` stress tests; search; analysis notifications.
- **22 Nov:** rules for running analyses; speakers; tasks linked to decisions; date picker; light theme.
- **23 Nov:** moved the website to Cloudflare; profile photos.
- **24 Nov:** demo seed users; this log; README.

The full step-by-step log from the build (about 115 lines) is in the git history:
`git show 3c2f6a5~1:docs/AI_LOG.md`
