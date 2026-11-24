# How I used AI to build Debrief

I used **Claude Code** (and **Codex** for part of 19–20 Nov). The AI wrote most of the code, to my
plan and my rules. I owned the plan, the decisions and the checking, reviewed every step, and can
explain each part.

## My workflow

1. **Rules before code.** On day one, before any code, I wrote `CLAUDE.md`: the stack, the folder
   structure, the security rules and how the agent must work with me.
2. **One small step at a time**, each with a plain-English explanation of every new file, so I
   understood the code before moving on.
3. **Quality gates.** A step only counted as done when type checks, lint and tests passed. CI runs
   the same checks (plus a migration check, an audit and the Docker builds) on every push.
4. **A log of every step**: what the AI did and what I decided (this file).

## Guardrails I set

- **Secrets never reach the AI or the repo.** The agent was told never to print, log or commit any
  value from `.env`. I entered every live secret into Render's dashboard myself.
- **The agent never decides security or data rules.** It could suggest options; I chose.
- **Tests that prove the important rules**, including breaking the code on purpose to check that the
  isolation tests really fail (mutation testing).

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
- **Frontend:** the design direction and the look of every page, from my own style and references.

## What I set up and did myself

- Created and configured **Supabase, Render, Cloudflare, the Google Cloud OAuth client, EmailJS and
  OpenRouter**, and registered the Google redirect addresses.
- **Found bugs by testing**: a due date resolving to the wrong Friday on the live site, archiving
  during an analysis breaking it, a misplaced text cursor in pop-ups, clipped highlights, the page
  bouncing on Mac.
- **Brought in my own frontend work**: reusable components from websites I built before, and
  components from React Bits that I altered myself to fit Debrief.

## Where AI helped most

- Getting me unstuck: fixing broken logic or structure, and explaining what I didn't understand.
- Failing tests: finding the cause and explaining it before I fixed it.
- Debugging: tracing a flaky Windows test to a drive-letter issue, and finding why Google sign-in
  failed (missing redirect addresses).
- Pointing out risks I hadn't thought of, like the cross-site cookie problem.
- Folder structure: planning the layout (web, API, shared package, one folder per feature) so I know
  where each piece of code goes.
- The AI design: how a transcript is parsed into numbered lines before the AI sees it, which models to
  use (a free OpenRouter chain), and how to use fewer credits while getting better answers (focused
  calls, temperature 0, a strict JSON schema, line numbers instead of long quotes, stopping when the
  daily quota runs out).

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
- **24 Nov:** demo seed users; this log; README.

The full step-by-step log from the build (about 115 lines) is in the git history:
`git show 3c2f6a5~1:docs/AI_LOG.md`

## Log

What I asked for, what the AI did, and what I decided or found, grouped by day. "Claude" means
Claude Code; Codex entries are marked.

### 19 Nov

- **Rules and review before code.** I chose the stack and wrote `CLAUDE.md` (structure, security
  rules, how the agent works with me). Claude reviewed it against the brief, found a missing
  `.gitignore` and a malformed `.env`, and flagged a cross-site cookie risk with the website and API
  on different hosts. I decided to commit `CLAUDE.md` and to forward `/api` through the website's
  host so cookies stay same-site.

### 20 Nov

- **Flaky Windows tests.** Claude traced "Invalid Chai property" errors to drive-letter case on
  Windows loading a second copy of Vitest, and fixed it by registering jest-dom's matchers in our own
  setup file.
- **Sign-in screen.** I chose the layout (form on the dark frame, light panel with the blobs) and
  asked for a fun tutorial instead of a copy of the app. Claude built a looping walkthrough with a
  pretend pointer that uploads a file, reads the transcript, makes cards and ticks one off.

### 21 Nov

- **Empty results and AI stress tests.** A Zoom transcript came back with nothing found, which looked
  broken. Claude found the result was correct (summary saved, nothing to action), added a clear
  "Nothing to action" card, and wrote `npm run ai:eval` with 8 tricky transcripts to test the real AI
  by hand. I kept my Zoom sample out of the repo.
- **Analysis in the background.** I asked to keep exploring while an analysis runs. Claude made it
  visible across the app: a spinner in the sidebar, a notification when one finishes or fails, and a
  "New" mark until opened. It also confirmed the server job already survives navigation and
  restarts.

### 22 Nov

- **Bugs I found by testing.** I reported the AI loader drifting before it stopped, faint
  highlights, clipped highlight rings, and the whole page bouncing on my Mac. Claude found each cause
  and fixed it (for the Mac, `overscroll-behavior: none` on wide screens).
- **Text cursor outside the boxes.** I reported the cursor appearing outside the fields in pop-ups.
  Claude found the first field was focused while the pop-up was still animating in, and now focuses
  it when the animation ends.

### 24 Nov

- **Decision cards spilling sideways after a live analysis.** I noticed that decision cards
  overflowed their column when an analysis finished while I was on the page, but looked right after
  a refresh, and asked why. Claude found the cause: cards that appear live use a "grow-in" wrapper
  that is a one-column CSS grid, and the grid's column stretched to the full width of a task line
  that never wraps. Claude wrote the one-class fix (`grid-cols-[minmax(0,1fr)]`) after I approved
  the plan. Tests can't measure layout, so I check it by hand with a re-analysis.
- **Live site "offline" while local and Docker work.** I asked why the Cloudflare site looked
  offline right after a Wrangler deploy. Claude checked the live addresses: the website itself loaded
  (200), but every `/api/*` call failed with `429` and `Cf-Mitigated: challenge`, both through the
  Worker and when calling the Render address directly. So the deploy was fine; Render's own edge was
  showing a bot check that a server-to-server `fetch` can't pass, and the request never reached
  Express. No code was changed.
- **Actions cards jumping taller when ticked off.** I asked why a card on the Actions page briefly
  grew taller when I ticked it, then snapped back. Claude found the cause: the leave animation
  shrinks the card's slot to zero width, so the text kept re-wrapping onto more lines and the row
  stretched every card to match. After I approved the plan, Claude wrote the fix: an inner wrapper
  keeps the card at full width while its slot shrinks and clips it. I check it by hand, since tests
  can't measure layout.
