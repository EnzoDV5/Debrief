# Host the web app on Netlify

The web app is static. The Express API, PostgreSQL database, and analysis worker need a separate Node host.

1. Deploy the API first and note its public HTTPS origin, for example `https://api.example.com` (no `/api` suffix).
2. Connect this repository to Netlify. The root `netlify.toml` sets the build command to `npm run build`, the publish directory to `apps/web/dist`, and Node 24.
3. In Netlify's build environment variables, set `DEBRIEF_API_ORIGIN` to the API origin. The build writes a `/api/*` proxy rule before the React Router fallback. Redeploy after changing this variable.
4. On the API host, set `WEB_ORIGIN` and `APP_URL` to your Netlify site URL. If using Google Calendar, set `GOOGLE_REDIRECT_URI` to `https://your-site.netlify.app/api/integrations/google/callback` and register that URI with Google. Keep `DATABASE_URL`, `OPENROUTER_API_KEY`, and other server secrets on the API host.

For a manual Netlify upload, set `DEBRIEF_API_ORIGIN` in your local shell, run `npm run build`, and upload `apps/web/dist`. A local build without the variable is useful for checking the static assets, but cannot connect to the API when uploaded.
