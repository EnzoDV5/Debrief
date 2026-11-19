# AI usage log

One line per step: `- YYYY-MM-DD: <what AI helped with> | <what I decided/changed myself>`

- 2026-11-19: Claude Code reviewed the brief vs CLAUDE.md, found missing .gitignore and a malformed .env, flagged cross-site cookie risk for Vercel+Render | I chose the stack, wrote CLAUDE.md, decided to commit it and to proxy /api through the web host
- 2026-11-19: Claude Code scaffolded Phase 0 (workspaces, TS/ESLint/Prettier, env validation, /api/health, error shape, Vite+Tailwind shell, Docker Postgres, CI) and caught that typescript-eslint doesn't support TS 7 yet | I approved the plan; pinned TypeScript 6.0 as the trade-off
- 2026-11-19: Claude Code rebuilt my malformed .env without printing the key, added Dockerfiles (api, nginx web) + compose services, debugged a missing tsconfig.base.json in the image | I asked for the full stack in Docker now rather than in Phase 7
