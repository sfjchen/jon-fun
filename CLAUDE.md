# sfjc.dev (Jon-fun)

Next.js 15 (App Router) + TypeScript + Tailwind v4 + Supabase, deployed to Vercel from `main`. Public repo, never commit secrets.

## Run
- `npm install && npm run dev` (http://localhost:3000). Env in `.env.local`, names listed in `README.md`.
- `npm run lint`, `npm run type-check`. `npm run build` before pushing risky changes.
- `Veridian/` and `finance/` are separate nested repos, gitignored, not part of the build.

## Test
- Playwright CLI (`@playwright/test`), specs in `e2e/*.spec.ts`, config `playwright.config.ts`.
- `npm run test:e2e:notes` (local mock API, dev server on :3001, kill the port first), `test:e2e:notes-mobile`, `test:e2e:notes-deploy` (hits sfjc.dev).
- Prefer mock routes in `e2e/helpers/*-mock.ts` for AI and sync. Deploy specs only for real APIs.
- After `npm update @playwright/test`, run `npm run playwright:install`.
- Notes also has `verify:notes-*` scripts. Details in `docs/NOTES.md`.

## Migrations
- SQL lives in `supabase/migrations/` (timestamped). That folder is the source of truth.
- Apply with `npm run db:push`, compare history with `npm run db:migrations` (Supabase CLI, linked project).
- Probe with ad-hoc SQL first, then commit one final migration file. Never delete an applied migration without `supabase migration repair`.
- See `supabase/README.md`.

## Deploy
- Push to `main` and Vercel deploys. Check the build status before calling changes live.
- On a build error, fix locally, run `npm run build`, push again.
- Production env vars are in the Vercel dashboard. Daily cleanup cron needs `CRON_SECRET`.

## Design and docs
- Design system: `docs/DESIGN-SYSTEM.md`. Routes, libs, backends: `docs/ARCHITECTURE-MAP.md`.
- Notes: `docs/NOTES.md`. Sync, devices and owner access: `docs/SYNC.md`.

## Conventions
- Strict TypeScript, minimal comments, no dead code.
- Keep the repo lean, no generated docs or changelogs.
