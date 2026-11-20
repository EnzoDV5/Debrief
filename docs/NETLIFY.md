# Deploy: Netlify (web) + Render (api) + Supabase (database)

Netlify serves the static web app. The Express api and its analysis worker run as one Docker
service on Render, connected to Supabase Postgres. The browser only ever talks to the Netlify
site: Netlify proxies `/api/*` to Render, so the session cookie stays first-party.

Do the steps in this order: Netlify's build refuses to finish until it knows where the api is.

## 1. Api on Render

1. In Render: **New → Blueprint**, pick this GitHub repo. It reads `render.yaml` and creates the
   `debrief-api` web service. Change `region` there first if your Supabase project is elsewhere.
2. Fill in the secrets it asks for:
   - `DATABASE_URL`: the Supabase **session pooler** connection string (port 5432).
   - `OPENROUTER_API_KEY`: needed for analysis and Ask.
   - `ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: only for Google Calendar.
     Leave empty to turn it off.
3. Deploy. On start the container applies pending migrations to Supabase, then starts the api.
4. Check `https://<your-service>.onrender.com/api/health` returns `{"status":"ok"}`.

## 2. Web on Netlify

1. In Netlify: **Project configuration → Environment variables**, add `DEBRIEF_API_ORIGIN` =
   `https://<your-service>.onrender.com` (no `/api`, no trailing path).
2. **Deploys → Trigger deploy**. The build writes `/api/* → Render` before the page fallback.

The root `netlify.toml` sets the build command (`npm run build`), the publish directory
(`apps/web/dist`) and Node 24.

## If the site URL changes

`render.yaml` sets `WEB_ORIGIN`, `APP_URL` and `GOOGLE_REDIRECT_URI` to
`https://debriefweb.netlify.app`. A different site URL must be changed there (or in Render's
environment), otherwise the api rejects logins and edits from it (Origin check). For Google
Calendar, also register the redirect URI with Google.

## Free tier notes

Render's free service sleeps after about 15 minutes without requests, and the first request then
takes around a minute while it wakes. Netlify's proxy can give up before that, so the first page
load may show an error: refresh after a minute. Before a demo, open `/api/health` first to wake
it, or switch the service to a paid plan for the day.
