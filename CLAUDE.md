# sfjc.dev (Jon-fun)

Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase, deployed to Vercel from `main`. Public repo, never commit secrets.

## Run

- `npm install && npm run dev` (http://localhost:3000). Env in `.env.local`, names listed in `README.md`.
- `npm run lint`, `npm run type-check`, `npm test` (unit tests in `tests/`). `npm run build` before pushing risky changes.
- Work in `~/dev/jon-fun`, never a copy under Desktop or Documents (iCloud evicts files and makes `* 2.*` conflict copies there).

## Test

- Playwright CLI (`@playwright/test`), specs in `e2e/*.spec.ts`, config `playwright.config.ts`.
- `npm run test:e2e` (starts the dev server on :3001, kill the port first), 1 area with `npm run test:e2e -- notes`, `test:e2e:deploy` (hits sfjc.dev).
- Prefer mock routes in `e2e/helpers/*-mock.ts` for AI and sync. Deploy specs only for real APIs.
- After `npm update @playwright/test`, run `npm run playwright:install`.
- Notes also has `npm run verify:notes`. Details in `docs/NOTES.md`.

## Migrations

- SQL lives in `supabase/migrations/` (timestamped). That folder is the source of truth.
- Apply with `npm run db:push`, compare history with `npm run db:migrations` (Supabase CLI, linked project).
- Probe with ad-hoc SQL first, then commit one final migration file. Never delete an applied migration without `supabase migration repair`.
- See `supabase/README.md`.

## Deploy

- Push to `main` and Vercel deploys. Check the build status before calling changes live.
- On a build error, fix locally, run `npm run build`, push again.
- Production env vars are in the Vercel dashboard. Every cron route needs `CRON_SECRET` and rejects all calls without it.

## Design and docs

- Design system: `docs/DESIGN-SYSTEM.md`. Routes, libs, backends: `docs/ARCHITECTURE-MAP.md`.
- Daily games (sources, cron, rules, score checks, the Daily and Beta shelves): `docs/DAILY-GAMES.md`. Codex reads `AGENTS.md`, so keep it in step with this file. Adding or changing a game, including its keyboard shortcuts: follow `docs/GAME-PLAYBOOK.md`.
- Notes: `docs/NOTES.md`. Sync, devices and owner access: `docs/SYNC.md`.

## Conventions

- Strict TypeScript, no dead code. Each file opens with a comment on what it is for, and each function has one.
- Keep the repo lean, no generated docs or changelogs.
- Prettier formats everything (`npm run format`, checked by `npm run format:check`). Add any format-only commit to `.git-blame-ignore-revs`.
